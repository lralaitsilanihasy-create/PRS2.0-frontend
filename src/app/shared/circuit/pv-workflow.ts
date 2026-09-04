import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, validerFichier } from '../../core/securite/fichiers-surs';
import { Avis, Controleur, LettreRenvoi, PvExamen, PvSignataireRole } from '../../models';
import { AvisService, ControleurService, LettreRenvoiService, ProfileService, PvExamenService } from '../../services';
import { CanDirective } from '../security/can.directive';
import { StatutBadge } from './statut-badge';
import {
  PV_STATUT_LABELS,
  peutRetourner,
  peutSAutoProposer,
  peutSigner,
  peutSoumettre,
  peutViser,
  pvSignataireRole,
} from './circuit-workflow';

/**
 * Actions de workflow d'un PV d'examen (soumettre / retourner / viser / signer),
 * reflétant la machine d'états du §3. Chaque action est proposée seulement si :
 *  - le statut courant l'autorise (état), ET
 *  - le profil possède la capacité correspondante (`*appCan`).
 *
 * ⚠️ Visa unique (2026-08-31) — la clôture de navette est UN SEUL GESTE, le « visa », qui remplace
 * « Accepter le projet » puis « Signer et désigner… » : l'avis du Membre (émis à la soumission de
 * l'examen, modifiable ici), le Secrétaire de séance, le Membre co-signataire, et la part de
 * signature du rôle, en un POST. Réservé au DISPATCHEUR du dossier — contrainte d'IDENTITÉ (403
 * serveur, délégation comprise : le dispatcheur suit qui a POSTÉ le dispatch, pas le rang — un
 * Président compétent partout est refusé si c'est le CC qui a dispatché, et l'écran doit en écrire
 * la raison, sinon elle paraît arbitraire). La « Lettre de renvoi » reste disponible à cette étape,
 * au rôle. `signer` ne concerne plus que la part MEMBRE, ouverte APRÈS le visa (ordre B conservé).
 *
 * ⚠️ Intérim (2026-09-01) — l'exception à la contrainte du dispatcheur : un P/CC du PÉRIMÈTRE
 * (Président partout, CC dans sa localité) vise en joignant la NOTE D'INTÉRIM (PDF) qui justifie
 * l'absence — même panneau, en multipart. Sans note c'est un 400, pas un interdit ; le 403 reste
 * pour un CC d'une autre localité, à qui le bouton n'est pas proposé (distinction 400/403 du
 * backend, rendue à l'écran). Mention « par intérim » posée serveur sur les seuls PV régionaux.
 *
 * Le composant exécute l'action puis émet le PV mis à jour via `(changed)`.
 * Le backend valide réellement la transition (409 en cas d'enchaînement interdit).
 */
@Component({
  selector: 'app-pv-workflow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CanDirective, StatutBadge],
  template: `
    <div class="pv-workflow">
      <div class="pv-workflow__state">
        <span class="pv-workflow__label">Statut du PV :</span>
        <app-statut-badge [statut]="pv().statutPv" [label]="statutLabel()" />
        <!-- ⚠️ Navette à DEUX NIVEAUX (2026-09-04) : Membre ↔ CC puis CC ↔ Président. -->
        @if (estDeuxNiveaux() && pv().statutPv === 'PROJET_SOUMIS') {
          <span class="pv-workflow__niveau">
            Navette à deux niveaux — le PV est au niveau
            <strong>{{ niveau() === 'CC' ? 'du Chef de commission' : 'du Président' }}</strong>.
          </span>
        }
      </div>

      <div class="pv-workflow__actions">
        @if (canSoumettre()) {
          <button *appCan="'PV_SOUMETTRE'" type="button" class="btn btn-primary" (click)="onSoumettre()">
            Soumettre le projet
          </button>
        }
        @if (canAccepter()) {
          <!-- Niveau CC du deux-niveaux : jalon SANS visa — « accepté au niveau CC, transmis au Président ». -->
          <button *appCan="'PV_ACCEPTER'" type="button" class="btn btn-success" [disabled]="saving()" (click)="accepterNiveauCc()">
            {{ saving() ? 'Transmission…' : 'Accepter et transmettre au Président' }}
          </button>
        }
        @if (canViser()) {
          @if (estViseurAttendu()) {
            <button *appCan="'PV_SIGNER'" type="button" class="btn btn-success" (click)="toggleViser()">
              {{ pv().statutPv === 'PROJET_ACCEPTE' ? 'Compléter le visa…' : 'Viser…' }}
            </button>
          } @else if (peutSuppleer()) {
            <!-- ⚠️ Intérim (2026-09-01) — pour un P/CC DU PÉRIMÈTRE, l'absence de note est un 400,
                 pas un interdit : la raison écrite s'accompagne de son issue. -->
            <span class="pv-workflow__deja-signe">
              Le visa revient à <strong>{{ nomDispatcheur() }}</strong>, qui a effectué le dispatch de
              ce dossier. En son absence, vous pouvez le suppléer en joignant la note d'intérim.
            </span>
            <button *appCan="'PV_SIGNER'" type="button" class="btn btn-outline" (click)="toggleViser(true)">
              Viser par intérim…
            </button>
          } @else if (nomDispatcheur()) {
            <!-- CC d'une autre localité : 403 serveur, aucune note ne l'autoriserait — pas de bouton. -->
            <span class="pv-workflow__deja-signe">
              Seul <strong>{{ nomDispatcheur() }}</strong> — qui a effectué le dispatch de ce dossier —
              peut viser ce PV ; votre localité ne vous permet pas de le suppléer par intérim.
            </span>
          }
        }
        @if (pv().viseParInterim) {
          <span class="pv-workflow__deja-signe">Visé <strong>par intérim</strong>.</span>
          @if (pv().noteInterimDisponible) {
            <button type="button" class="btn btn-outline btn-sm" (click)="ouvrirNoteInterim()"
              title="Ouvrir la note d'intérim (PDF) jointe au visa">
              Note d'intérim
            </button>
          }
        }
        @if (canRetourner()) {
          <button *appCan="'PV_RETOURNER'" type="button" class="btn btn-warning" (click)="toggleRetour()">
            {{ retourLabel() }}
          </button>
        }
        @if (canLettre()) {
          <button *appCan="'PV_ACCEPTER'" type="button" class="btn btn-outline" (click)="toggleLettre()">
            Lettre de renvoi
          </button>
        }
        @if (canSignerMembre()) {
          <!-- ⚠️ Règle ajoutée (2026-08-02) : une signature par rôle — déjà signé ⇒ bouton désactivé.
               ⚠️ Visa unique (2026-08-31) : seule la part MEMBRE passe encore par ce bouton — le
               Président / CC pose la sienne au visa. Elle revient au Membre DÉSIGNÉ, à lui seul. -->
          <!-- [disabled] pendant la requête : garde anti-double-clic (le serveur pose un verrou
               pessimiste en miroir). -->
          <button *appCan="'PV_SIGNER'" type="button" class="btn btn-primary"
            [disabled]="dejaSigne() || saving() || partMembreFermee() || pasLeDesigne()"
            [title]="dejaSigne()
              ? 'Vous avez déjà signé ce PV — en attente des autres signataires.'
              : partMembreFermee()
                ? 'La part Membre n’est pas encore ouverte : le visa du Président ou du Chef de commission désigne d’abord le co-signataire.'
                : pasLeDesigne()
                  ? 'La part Membre revient au Membre désigné au visa.'
                  : ''"
            (click)="signer()">
            {{ dejaSigne() ? 'Signé ✓' : saving() ? 'Signature…' : 'Signer' }}
          </button>
          @if (dejaSigne()) {
            <span class="pv-workflow__deja-signe">Vous avez déjà signé — en attente des autres signataires.</span>
          } @else if (partMembreFermee()) {
            <!-- ⚠️ Ordre B conservé — la part Membre ne s'ouvre qu'après le visa (qui désigne). -->
            <span class="pv-workflow__deja-signe">
              La <strong>part Membre</strong> n'est pas encore ouverte : le visa du Président ou du
              Chef de commission désigne d'abord le Membre co-signataire.
            </span>
          } @else if (pasLeDesigne()) {
            <span class="pv-workflow__deja-signe">
              La part Membre revient à <strong>{{ nomMembreDesigne() }}</strong>, désigné co-signataire au visa.
            </span>
          } @else if (estDesigne()) {
            <span class="pv-workflow__deja-signe">
              Vous avez été <strong>désigné co-signataire</strong> de ce PV : votre signature posera la
              <strong>part Membre</strong> et clôturera la signature.
            </span>
          }
        }
        @if (canSignerCc()) {
          <!-- ⚠️ Deux niveaux (2026-09-04) — le CC DÉSIGNÉ co-signataire pose sa part via signer(CC). -->
          <button *appCan="'PV_SIGNER'" type="button" class="btn btn-primary" [disabled]="saving()" (click)="signer('CC')">
            {{ saving() ? 'Signature…' : 'Signer (part Chef de commission)' }}
          </button>
          <span class="pv-workflow__deja-signe">
            Vous avez été <strong>désigné co-signataire</strong> au visa du Président : votre signature
            posera la <strong>part Chef de commission</strong>.
          </span>
        }
        @if (attenteCoSignature()) {
          <span class="pv-workflow__deja-signe">
            En attente de la co-signature de <strong>{{ partsEnAttente().join(' et ') }}</strong>.
          </span>
        }
      </div>

      @if (soumettreOuvert()) {
        <div class="pv-workflow__retour pv-workflow__retour--reponse">
          <label class="pv-workflow__retour-label" for="pv-soum-comment">
            Réponse au retour (commentaire, optionnel)
          </label>
          <textarea id="pv-soum-comment" class="form-control" #soum rows="3"></textarea>
          <div class="pv-workflow__retour-actions">
            <button type="button" class="btn btn-outline" (click)="toggleSoumettre()">Annuler</button>
            <button type="button" class="btn btn-primary" (click)="confirmerSoumission(soum.value)">
              Confirmer la soumission
            </button>
          </div>
        </div>
      }

      @if (retourOuvert()) {
        <div class="pv-workflow__retour">
          <label class="pv-workflow__retour-label" for="pv-retour-comment">
            Commentaire de rectification (obligatoire)
          </label>
          <textarea id="pv-retour-comment" class="form-control" #commentaire rows="3"></textarea>
          <div class="pv-workflow__retour-actions">
            <button type="button" class="btn btn-outline" (click)="toggleRetour()">Annuler</button>
            <button type="button" class="btn btn-warning" (click)="retourner(commentaire.value)">
              Confirmer le retour
            </button>
          </div>
        </div>
      }

      <!-- ⚠️ Visa unique (2026-08-31, allégé 02/09 : le Secrétaire de séance a disparu du cycle) —
           clôture de la navette EN UN GESTE (Président/CC dispatcheur) : avis du Membre modifiable,
           Membre co-signataire obligatoire, et la part de signature du rôle posée dans le même POST. -->
      @if (viserOuvert()) {
        <div class="pv-workflow__retour pv-workflow__retour--accept cnm-form">
          <span class="pv-workflow__retour-label">{{ interim() ? 'Visa par intérim — clôture de la navette' : 'Visa — clôture de la navette' }}</span>
          @if (estDeuxNiveaux()) {
            <span class="form-hint">
              Le visa clôt la navette en un geste : il arrête l'avis, désigne les
              <strong>co-signataires</strong>, et pose <strong>votre part de signature</strong>.
              Chaque désigné posera ensuite la sienne — le PV est signé par 2 ou 3 personnes selon
              la combinaison.
            </span>
          } @else {
            <span class="form-hint">
              Le visa clôt la navette en un geste : il arrête l'avis, désigne le Membre co-signataire,
              et pose <strong>votre part de signature</strong>. Le Membre désigné posera la part
              Membre : le PV est signé par deux personnes distinctes.
            </span>
          }
          @if (interim()) {
            <!-- ⚠️ Intérim (2026-09-01) — la note EST la justification (l'absence n'est pas vérifiable
                 serveur) ; PDF seul, type lu sur les octets côté backend, validé en miroir ici. -->
            <label class="form-group">
              <span class="form-label">Note d'intérim (PDF) *</span>
              <input type="file" class="form-control" accept="application/pdf" (change)="choisirNote($event)" />
              <span class="form-hint">
                Elle justifie l'absence de {{ nomDispatcheur() }} et reste consultable par la
                commission ; elle engage votre responsabilité de signataire.
              </span>
            </label>
          }
          @if (avisSuggereHint(); as hint) { <span class="form-hint">{{ hint }}</span> }
          <!-- [selected] sur les options : les référentiels arrivent APRÈS l'ouverture du panneau,
               [value] seul ne serait pas ré-appliqué au rendu des options (pré-sélection perdue). -->
          <label class="form-group">
            <span class="form-label">Avis global *</span>
            <select class="form-control" [value]="avisChoisi() ?? ''" (change)="avisChoisi.set($any($event.target).value || null)">
              <option value="" [selected]="!avisChoisi()">— Sélectionner —</option>
              @for (a of aviss(); track a.idAvis) {
                <option [value]="a.idAvis" [selected]="a.idAvis === avisChoisi()">{{ a.libelleAvis || a.idAvis }}</option>
              }
            </select>
            @if (pv().idAvis) {
              <span class="form-hint">Pré-rempli avec l'avis émis par le Membre à l'examen — le changer ici le remplace.</span>
            }
          </label>
          @if (estDeuxNiveaux()) {
            <!-- ⚠️ Combinaisons de signataires (arbitrage pilote 2026-09-04) — le Président choisit. -->
            <fieldset class="form-group pv-workflow__combos">
              <span class="form-label">Signataires du PV (avec vous) *</span>
              <label class="pv-workflow__combo">
                <input type="radio" [name]="'pv-combo-' + pv().idPv" [checked]="comboChoisie() === 'P_CC_M'" (change)="comboChoisie.set('P_CC_M')" />
                Chef de commission ({{ nomDispatcheur() }}) <strong>et</strong> Membre examinateur ({{ nomControleur(imExaminateur()) }})
              </label>
              <label class="pv-workflow__combo">
                <input type="radio" [name]="'pv-combo-' + pv().idPv" [checked]="comboChoisie() === 'P_CC'" (change)="comboChoisie.set('P_CC')" />
                Chef de commission seul ({{ nomDispatcheur() }})
              </label>
              <label class="pv-workflow__combo">
                <input type="radio" [name]="'pv-combo-' + pv().idPv" [checked]="comboChoisie() === 'P_M'" (change)="comboChoisie.set('P_M')" />
                Membre examinateur seul ({{ nomControleur(imExaminateur()) }})
              </label>
              <label class="pv-workflow__combo">
                <input type="radio" [name]="'pv-combo-' + pv().idPv" [checked]="comboChoisie() === 'P_AUTRE'" (change)="comboChoisie.set('P_AUTRE')" />
                Un autre Membre de la centrale
              </label>
              @if (comboChoisie() === 'P_AUTRE') {
                <select class="form-control" [value]="autreMembreChoisi() ?? ''"
                  (change)="autreMembreChoisi.set($any($event.target).value || null)">
                  <option value="" [selected]="!autreMembreChoisi()">— Sélectionner le Membre —</option>
                  @for (m of autresMembresOptions(); track m.id) {
                    <option [value]="m.id" [selected]="m.id === autreMembreChoisi()">{{ m.label }}</option>
                  }
                </select>
              }
            </fieldset>
          } @else {
            <label class="form-group">
              <span class="form-label">Membre co-signataire *</span>
              <select class="form-control" [value]="membreChoisi() ?? ''"
                (change)="membreChoisi.set($any($event.target).value || null)">
                <option value="" [selected]="!membreChoisi()">— Sélectionner —</option>
                @for (m of membreOptions(); track m.id) {
                  <option [value]="m.id" [selected]="m.id === membreChoisi()">{{ m.label }}</option>
                }
              </select>
            </label>
            @if (!membreOptions().length) {
              <span class="form-hint pv-workflow__alerte" role="status">
                Aucun Membre de la localité du dossier n'est disponible pour co-signer. Le PV ne peut pas
                être visé tant qu'un Membre n'y est pas rattaché.
              </span>
            }
          }
          @if (viserErreur()) { <span class="form-error">{{ viserErreur() }}</span> }
          <div class="pv-workflow__retour-actions">
            <button type="button" class="btn btn-outline" (click)="toggleViser()">Annuler</button>
            <button type="button" class="btn btn-success" [disabled]="saving()" (click)="confirmerVisa()">
              {{ saving() ? 'Visa…' : interim() ? 'Viser par intérim' : 'Viser et signer ma part' }}
            </button>
          </div>
        </div>
      }

      <!-- ⚠️ Lettre de renvoi (Président/CC, clôture de navette) : brouillon + soumission ; signature dans « Lettres de renvoi ». -->
      @if (lettreOuvert()) {
        <div class="pv-workflow__retour pv-workflow__retour--reponse cnm-form">
          <label class="pv-workflow__retour-label" for="pv-lettre-corps">Lettre de renvoi — corps de la lettre</label>
          <textarea id="pv-lettre-corps" class="form-control" rows="5" placeholder="Corps de la lettre…"
            [value]="corpsLettre()" (input)="corpsLettre.set($any($event.target).value)"></textarea>
          <div class="pv-workflow__retour-actions">
            <button type="button" class="btn btn-outline" [disabled]="saving()" (click)="toggleLettre()">Fermer</button>
            <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="enregistrerBrouillonLettre()">
              {{ saving() ? 'Enregistrement…' : 'Enregistrer brouillon' }}
            </button>
          </div>
          @if (lettres().length) {
            <div class="pv-workflow__lettres">
              <table>
                <thead><tr><th scope="col">Référence</th><th scope="col">Statut</th><th scope="col">Date</th><th scope="col"></th></tr></thead>
                <tbody>
                  @for (l of lettres(); track l.idLettre) {
                    <tr>
                      <td class="cnm-mono">{{ l.refLettre || ('#' + l.idLettre) }}</td>
                      <td><app-statut-badge [statut]="l.statut" /></td>
                      <td class="cnm-mono">{{ l.dateLettre || '—' }}</td>
                      <td>
                        @if (l.statut === 'BROUILLON') {
                          <button type="button" class="btn btn-primary btn-sm" [disabled]="saving()" (click)="soumettreLettre(l)">Soumettre</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              <span class="form-hint">La signature des lettres soumises se fait dans « Lettres de renvoi ».</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    /* Barre de DÉCISION du PV (demande pilote 2026-09-04) : dégradé indigo profond, statut en
       petites capitales, filet séparateur avant les gestes — remarquable ET professionnelle.
       Même dérogation assumée aux tokens que le bouton de prise en charge. */
    .pv-workflow {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      background: linear-gradient(120deg, #1e1b4b, #312e81 48%, #4338ca);
      border-radius: var(--radius-lg);
      padding: 0.9rem 1.15rem;
      box-shadow: 0 8px 20px rgba(30, 27, 75, 0.28);
    }
    .pv-workflow__state {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    .pv-workflow__label {
      font-size: var(--text-xs);
      color: #c7d2fe;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .pv-workflow__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.16);
      padding-top: 0.75rem;
    }
    /* Sur fond sombre, les boutons « outline » gardent leur contraste. */
    .pv-workflow__actions .btn-outline {
      color: #fff;
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.08);
    }
    .pv-workflow__deja-signe {
      font-size: var(--text-sm);
      color: #c7d2fe;
      font-style: italic;
    }
    /* Navette à deux niveaux : où est le PV (2026-09-04). */
    .pv-workflow__niveau {
      font-size: var(--text-sm);
      color: #e0e7ff;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: var(--radius-full);
      padding: 0.2rem 0.7rem;
    }
    /* Combinaisons de signataires (visa du Président, deux niveaux). */
    .pv-workflow__combos {
      border: 0;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .pv-workflow__combo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--text-sm);
      color: var(--n-700);
      cursor: pointer;
    }
    /* Impasse de co-signature : aucun Membre de la localité n'est disponible. Ce n'est pas un
       simple conseil — le PV ne peut pas être signé — donc la couleur d'alerte, pas celle d'un
       texte d'aide. */
    .pv-workflow__alerte {
      color: var(--danger-text);
      font-weight: 600;
      font-style: normal;
    }
    .pv-workflow__retour {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      background: var(--warning-bg);
      border: 1px solid var(--warning-bdr);
      border-radius: var(--radius-lg);
      padding: 0.75rem;
    }
    .pv-workflow__retour-label {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--warning-text);
    }
    .pv-workflow__retour--reponse {
      background: var(--c-50);
      border-color: var(--c-100);
    }
    .pv-workflow__retour--reponse .pv-workflow__retour-label {
      color: var(--n-500);
    }
    /* Panneau de clôture de navette (acceptation) : ton succès, cohérent avec le bouton vert. */
    .pv-workflow__retour--accept {
      background: var(--success-bg, #f0fdf4);
      border-color: var(--success-bdr, #bbf7d0);
    }
    .pv-workflow__retour--accept .pv-workflow__retour-label {
      color: var(--success-text, #15803d);
    }
    .pv-workflow__retour .form-control {
      resize: vertical;
    }
    .pv-workflow__retour-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    .pv-workflow__lettres { overflow-x: auto; }
    .pv-workflow__lettres table { width: 100%; }
  `,
})
export class PvWorkflow {
  private readonly pvService = inject(PvExamenService);
  private readonly avisService = inject(AvisService);
  private readonly controleurService = inject(ControleurService);
  private readonly profileService = inject(ProfileService);
  private readonly lettreService = inject(LettreRenvoiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** PV courant. */
  readonly pv = input.required<PvExamen>();
  /** Localité du dossier du PV (périmètre de l'intérim et candidats Membre co-signataire). */
  readonly idLocalite = input<string | null>(null);
  /**
   * Nombre d'observations de l'examen (points de contrôle + pièces jointes), fourni par le parent.
   * ⚠️ Règle de cohérence (2026-08-01) : > 0 → avis FAVR suggéré (FAV refusé par le backend) ;
   * 0 → FAV suggéré (FAVR refusé). `null` = inconnu (pas de suggestion).
   */
  readonly nbObservationsExamen = input<number | null>(null);
  /** Émis après une transition réussie, avec le PV mis à jour. */
  readonly changed = output<PvExamen>();

  readonly retourOuvert = signal(false);
  readonly soumettreOuvert = signal(false);
  /** Panneau « visa » (avis + co-signataire + part de signature, Président/CC dispatcheur). */
  readonly viserOuvert = signal(false);
  /** Panneau « lettre de renvoi » (Président/CC, même étape). */
  readonly lettreOuvert = signal(false);
  readonly saving = signal(false);

  readonly avisChoisi = signal<string | null>(null);
  readonly viserErreur = signal<string | null>(null);
  readonly corpsLettre = signal('');
  /** Lettres de renvoi de l'examen du PV (affichées dans le panneau lettre). */
  readonly lettres = signal<LettreRenvoi[]>([]);

  readonly aviss = signal<Avis[]>([]);
  private readonly controleurs = signal<Controleur[]>([]);
  private readonly profileLib = signal<Map<number, string>>(new Map());
  /** Référentiels (avis / contrôleurs / profils) chargés une seule fois, à l'ouverture du panneau. */
  private refsCharges = false;
  readonly statutLabel = computed(() => PV_STATUT_LABELS[this.pv().statutPv]);
  readonly canSoumettre = computed(() => peutSoumettre(this.pv().statutPv));
  /**
   * ⚠️ Navette à DEUX NIVEAUX (2026-09-04, backend `f648254`) — dossier Président → CC → Membre :
   * `niveauNavette` (servi) dit OÙ est le PV. Niveau CC : le CC accepte (transmet au Président) ou
   * retourne au Membre — SANS visa. Niveau PRESIDENT : le Président vise (co-signataires 1..2) ou
   * retourne AU CC. Verrou par niveau : rien ne saute d'étage (409 serveur en miroir).
   */
  readonly estDeuxNiveaux = computed(() => this.pv().niveauNavette != null);
  readonly niveau = computed(() => this.pv().niveauNavette ?? null);
  readonly canRetourner = computed(() => {
    if (!peutRetourner(this.pv().statutPv)) return false;
    if (!this.estDeuxNiveaux()) return true;
    // Étage par étage : au niveau CC c'est le CC qui retourne (au Membre) ; au niveau Président,
    // le Président (au CC).
    return this.niveau() === 'CC' ? this.roleSignature() === 'CC' : this.roleSignature() === 'PRESIDENT';
  });
  /** Libellé du retour selon sa destination (étage par étage). */
  readonly retourLabel = computed(() =>
    this.estDeuxNiveaux() && this.niveau() === 'PRESIDENT' ? 'Retourner au Chef de commission' : 'Retourner pour rectification',
  );
  /** Deux niveaux, niveau CC : le CC du circuit ACCEPTE — « accepté au niveau CC, transmis au Président ». */
  readonly canAccepter = computed(
    () =>
      this.estDeuxNiveaux() &&
      this.niveau() === 'CC' &&
      this.pv().statutPv === 'PROJET_SOUMIS' &&
      this.roleSignature() === 'CC' &&
      this.estDispatcheur(),
  );
  /**
   * ⚠️ Visa unique (2026-08-31) — le visa s'offre au rôle P/CC tant que sa part n'est pas posée :
   * sur PROJET_SOUMIS (cas normal) et sur PROJET_ACCEPTE (PV accepté sous l'ancien contrat, à
   * compléter). L'identité du dispatcheur est vérifiée à part (`estDispatcheur`) pour pouvoir
   * ÉCRIRE la raison du refus au lieu de faire disparaître le bouton sans explication.
   * ⚠️ Deux niveaux : le visa est réservé au PRÉSIDENT, au niveau Président seulement.
   */
  readonly canViser = computed(() => {
    const r = this.roleSignature();
    if (!peutViser(this.pv().statutPv) || this.dejaSigne()) return false;
    // ⚠️ Constat pilote (2026-09-04) : sur PROJET_ACCEPTE, « Compléter le visa… » ne vaut que pour
    // un PV accepté sous l'ANCIEN contrat, au visa INCOMPLET. Un visa qui a désigné son ou ses
    // co-signataires est complet — il ne reste que les signatures (le CC désigné voyait encore le
    // panneau de visa avec son sélecteur de Membre vide).
    if (this.pv().statutPv === 'PROJET_ACCEPTE' && (this.pv().imMembreCoSignataire || this.pv().imCcCoSignataire)) {
      return false;
    }
    if (this.estDeuxNiveaux()) return this.niveau() === 'PRESIDENT' && r === 'PRESIDENT';
    return r === 'PRESIDENT' || r === 'CC';
  });
  /** Viseur attendu : le dispatcheur (navette simple) ; le PRÉSIDENT (deux niveaux — le dispatcheur du dispatch est le CC). */
  readonly estViseurAttendu = computed(() =>
    this.estDeuxNiveaux() ? this.roleSignature() === 'PRESIDENT' : this.estDispatcheur(),
  );
  /**
   * Le connecté est-il LE dispatcheur du dossier (`imDispatcheur` du DTO) ? Contrainte d'IDENTITÉ
   * (403 serveur même sous délégation active). DTO muet (backend antérieur) → optimiste, le serveur
   * tranche — même philosophie que `DELEGATIONS_OPTIMISTES`.
   */
  readonly estDispatcheur = computed(() => {
    const d = this.pv().imDispatcheur;
    return d == null || d === this.auth.ref();
  });
  /** Nom du dispatcheur, servi par le backend — pour écrire la raison du refus. */
  readonly nomDispatcheur = computed(() => this.pv().nomDispatcheur || this.pv().imDispatcheur || '');
  /**
   * ⚠️ Intérim (2026-09-01) — un P/CC non dispatcheur DU PÉRIMÈTRE peut viser en joignant la note
   * d'intérim : Président (sans localité) partout, CC dans SA localité seulement (contrairement à
   * l'INTERIM_DISPATCH du dispatch, la garde de localité est MAINTENUE — 403 serveur, aucune note ne
   * l'autoriserait ; le bouton doit donc être proposé au premier cas et ABSENT au second — c'est la
   * distinction 400/403 du backend, rendue à l'écran). Même règle de périmètre §3.3 que
   * `peutSAutoProposer`, avec la localité de session.
   */
  readonly peutSuppleer = computed(() => {
    // Deux niveaux : le visa est celui du Président — pas d'intérim à ce niveau.
    if (this.estDeuxNiveaux()) return false;
    const r = this.roleSignature();
    if (r !== 'PRESIDENT' && r !== 'CC') return false;
    return peutSAutoProposer(this.auth.localite(), this.idLocalite());
  });
  /** La lettre de renvoi reste une issue de la navette ouverte au rôle (pas au seul dispatcheur). */
  readonly canLettre = computed(() => this.pv().statutPv === 'PROJET_SOUMIS');
  /** Part MEMBRE — masquée quand le visa deux-niveaux est posé SANS Membre désigné (combinaison P+CC). */
  readonly canSignerMembre = computed(() => {
    if (!peutSigner(this.pv().statutPv) || this.roleSignature() !== 'MEMBRE') return false;
    if (this.estDeuxNiveaux() && this.pv().dateSignaturePresident != null && !this.membreDesigne()) return false;
    return true;
  });
  /** ⚠️ Deux niveaux — CC DÉSIGNÉ co-signataire au visa : sa part CC passe par `signer(CC)`. */
  readonly ccDesigne = computed(() => this.pv().imCcCoSignataire ?? null);
  readonly estCcDesigne = computed(() => !!this.ccDesigne() && this.ccDesigne() === this.auth.ref());
  readonly canSignerCc = computed(
    () =>
      peutSigner(this.pv().statutPv) &&
      this.roleSignature() === 'CC' &&
      this.estCcDesigne() &&
      this.pv().dateSignatureCc == null,
  );
  /** L'utilisateur courant est l'ATTRIBUTAIRE du PV (`imCtrlMembre` = son matricule). */
  // ⚠️ 2026-08-28 — `estAttributaire` a été retiré : il servait à faire signer la part Membre par
  // l'attributaire. Celle-ci revient désormais au Membre DÉSIGNÉ (voir `estDesigne`) ; `imCtrlMembre`
  // ne dit plus que QUI A EXAMINÉ — c'est lui qu'imprime le PV officiel.
  /**
   * Rôle sous lequel le signataire courant signe — simplement celui de son profil.
   *
   * ⚠️ Co-signature (backend `e8b5b2e`, 2026-08-28) — l'aiguillage « l'attributaire signe d'abord la
   * part Membre » a disparu avec l'auto-co-signature. La part Membre appartient désormais au Membre
   * DÉSIGNÉ par le Président ou le CC, et le désigné est nécessairement un Membre de la localité :
   * son profil suffit donc à déterminer sa part. Un P/CC ne signe plus que la sienne.
   */
  readonly roleSignature = computed<PvSignataireRole | null>(() => pvSignataireRole(this.auth.role()));

  /** Membre déjà désigné sur ce PV — `null` tant que le P/CC n'a pas visé (ou PV d'avant la règle). */
  readonly membreDesigne = computed(() => this.pv().imMembreCoSignataire ?? null);
  /** Nom du Membre désigné, servi par le backend — évite un appel pour l'afficher. */
  readonly nomMembreDesigne = computed(() => this.pv().nomMembreCoSignataire || this.membreDesigne() || '');
  /** L'utilisateur courant est le Membre désigné : la part Membre lui revient, à lui seul. */
  readonly estDesigne = computed(() => !!this.membreDesigne() && this.membreDesigne() === this.auth.ref());
  /** Un autre Membre a été désigné : la part n'est pas la sienne (403 serveur) — raison écrite. */
  readonly pasLeDesigne = computed(
    () => this.roleSignature() === 'MEMBRE' && !!this.membreDesigne() && !this.estDesigne(),
  );
  /**
   * La part Membre est-elle encore fermée ? Sous l'ordre B, elle ne s'ouvre qu'APRÈS le visa (qui
   * désigne) : un Membre qui signerait spontanément avant viderait de son objet le choix du P/CC
   * (409 serveur).
   */
  readonly partMembreFermee = computed(() => this.roleSignature() === 'MEMBRE' && !this.membreDesigne());
  /** Parts DÉSIGNÉES encore non signées (noms) — Membre et/ou CC selon la combinaison du visa. */
  readonly partsEnAttente = computed(() => {
    const pv = this.pv();
    const noms: string[] = [];
    if (pv.imMembreCoSignataire && pv.dateSignatureMembre == null) noms.push(pv.nomMembreCoSignataire || pv.imMembreCoSignataire);
    if (pv.imCcCoSignataire && pv.dateSignatureCc == null) noms.push(pv.nomCcCoSignataire || pv.imCcCoSignataire);
    return noms;
  });
  /** Part(s) de co-signature en attente — affiché à qui n'est pas lui-même un désigné en attente. */
  readonly attenteCoSignature = computed(
    () => this.partsEnAttente().length > 0 && !this.estDesigne() && !this.estCcDesigne() && this.pv().statutPv !== 'SIGNE',
  );

  /** Matricule du Membre co-signataire choisi dans le panneau de visa (navette SIMPLE). */
  readonly membreChoisi = signal<string | null>(null);
  /**
   * ⚠️ Deux niveaux — combinaison de signataires choisie par le Président au visa (arbitrage
   * pilote 2026-09-04) : P+CC+Membre / P+CC / P+Membre / P+autre Membre de la centrale.
   */
  readonly comboChoisie = signal<'P_CC_M' | 'P_CC' | 'P_M' | 'P_AUTRE' | null>(null);
  readonly autreMembreChoisi = signal<string | null>(null);
  /** Le panneau de visa est ouvert en mode INTÉRIM (note d'intérim exigée). */
  readonly interim = signal(false);
  /** Note d'intérim choisie (PDF validé par `validerFichier`). */
  readonly noteChoisie = signal<File | null>(null);

  /**
   * Membres éligibles à la co-signature : ceux de la LOCALITÉ du dossier (§3.3, garde serveur
   * `ControleurDirectory.peutEtreMembreCoSignataire` — sans exemption pour un contrôleur sans
   * localité, contrairement au Secrétaire de séance), moins soi-même : le PV est co-signé par deux
   * personnes distinctes. Aucun appel supplémentaire, les contrôleurs sont déjà chargés.
   */
  readonly membreOptions = computed(() => {
    const loc = this.idLocalite();
    const libs = this.profileLib();
    const moi = this.auth.ref();
    return this.controleurs()
      .filter((c) => c.idLocalite === loc && c.idProfile != null && /membre/i.test(libs.get(c.idProfile) ?? ''))
      .filter((c) => c.imControleur !== moi)
      .map((c) => ({ id: c.imControleur, label: [c.nomCont, c.prenomsCont].filter(Boolean).join(' ') || c.imControleur }));
  });
  /** Nom lisible d'un contrôleur (référentiels du panneau de visa) — repli matricule. */
  nomControleur(im: string | undefined | null): string {
    if (!im) return '—';
    const c = this.controleurs().find((x) => x.imControleur === im);
    return c ? [c.nomCont, c.prenomsCont].filter(Boolean).join(' ') || im : im;
  }
  /** Membre EXAMINATEUR (imprimé au PV) — cible des combinaisons P+CC+Membre et P+Membre. */
  readonly imExaminateur = computed(() => this.pv().imCtrlMembre ?? null);
  /** Autres Membres de la centrale (hors examinateur) — combinaison « P + autre Membre ». */
  readonly autresMembresOptions = computed(() => this.membreOptions().filter((o) => o.id !== this.imExaminateur()));
  /**
   * ⚠️ Règle ajoutée (2026-08-02) — une signature par rôle : le signataire courant a déjà posé la
   * sienne (date du rôle renseignée) ⇒ bouton « Signer » désactivé (garde 409 miroir côté backend).
   */
  readonly dejaSigne = computed(() => {
    const pv = this.pv();
    switch (this.roleSignature()) {
      case 'MEMBRE':
        return pv.dateSignatureMembre != null;
      case 'PRESIDENT':
        return pv.dateSignaturePresident != null;
      case 'CC':
        return pv.dateSignatureCc != null;
      default:
        return false;
    }
  });

  toggleRetour(): void {
    this.retourOuvert.update((v) => !v);
  }
  toggleSoumettre(): void {
    this.soumettreOuvert.update((v) => !v);
  }
  /** Suggestion d'avis dérivée des observations : FAVR si ≥1, FAV sinon ; null si inconnu. */
  readonly avisSuggere = computed(() => {
    const n = this.nbObservationsExamen();
    return n == null ? null : n > 0 ? 'FAVR' : 'FAV';
  });
  /** Libellé de la suggestion pour le hint du panneau de clôture. */
  readonly avisSuggereHint = computed(() => {
    const n = this.nbObservationsExamen();
    if (n == null) {
      return null;
    }
    return n > 0
      ? `Avis suggéré : « Favorable avec réserves » — ${n} observation(s) relevée(s) (points de contrôle + pièces jointes).`
      : 'Avis suggéré : « Favorable » — aucune observation relevée à l\'examen.';
  });

  constructor() {
    // Suggestion tardive : si le compte d'observations arrive APRÈS l'ouverture du panneau (input
    // asynchrone du parent), pré-sélectionne l'avis suggéré tant que l'utilisateur n'a rien choisi.
    effect(() => {
      const suggestion = this.avisSuggere();
      if (suggestion && this.viserOuvert() && !this.avisChoisi()) {
        this.avisChoisi.set(suggestion);
      }
    });
  }

  /**
   * Ouvre le panneau de visa (pré-rempli de l'avis du Membre, sinon de la suggestion) et charge
   * les référentiels.
   * ⚠️ 2026-08-30 — leçon conservée du panneau de désignation : charger les référentiels À CHAQUE
   * ouverture de panneau, quel que soit le chemin d'arrivée, sinon liste vide et fausse impasse.
   */
  toggleViser(interimMode = false): void {
    const opening = !this.viserOuvert();
    this.viserOuvert.set(opening);
    if (opening) {
      this.interim.set(interimMode);
      this.noteChoisie.set(null);
      this.viserErreur.set(null);
      this.avisChoisi.set(this.pv().idAvis ?? this.avisSuggere());
      this.membreChoisi.set(null);
      this.comboChoisie.set(null);
      this.autreMembreChoisi.set(null);
      this.chargerReferentiels();
    }
  }

  /** Deux niveaux, niveau CC : « Accepter et transmettre au Président » — jalon sans visa. */
  accepterNiveauCc(): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    this.saving.set(true);
    this.pvService.accepter(this.pv().idPv, { imActeur: acteur }).subscribe({
      next: (pv) => {
        this.saving.set(false);
        this.onSuccess(pv, 'Projet accepté au niveau Chef de commission — transmis au Président.');
      },
      error: () => this.saving.set(false), // 403/409/404 → toast centralisé (message backend)
    });
  }

  /** Note d'intérim : PDF seul, taille plafonnée — validation miroir de la garde serveur (type lu sur les octets). */
  choisirNote(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) {
      this.noteChoisie.set(null);
      return;
    }
    const erreur = validerFichier(file, ['application/pdf']);
    if (erreur) {
      this.noteChoisie.set(null);
      this.viserErreur.set(erreur);
      (event.target as HTMLInputElement).value = '';
      return;
    }
    this.viserErreur.set(null);
    this.noteChoisie.set(file);
  }

  /** Ouvre le PDF de la note d'intérim dans un nouvel onglet (type inerte forcé par `blobSur`). */
  ouvrirNoteInterim(): void {
    this.pvService.noteInterim(this.pv().idPv).subscribe({
      next: (blob) => ouvrirBlobSur(blob),
    });
  }
  toggleLettre(): void {
    const opening = !this.lettreOuvert();
    this.lettreOuvert.set(opening);
    if (opening) {
      this.corpsLettre.set('');
      this.chargerLettres();
    }
  }

  /** Avis + contrôleurs + profils — une seule vague, uniquement quand le panneau s'ouvre (Président/CC). */
  private chargerReferentiels(): void {
    if (this.refsCharges) {
      return;
    }
    this.refsCharges = true;
    forkJoin({
      aviss: this.avisService.list(),
      ctrls: this.controleurService.list(),
      profiles: this.profileService.list(),
    }).subscribe({
      next: ({ aviss, ctrls, profiles }) => {
        this.aviss.set(aviss);
        this.controleurs.set(ctrls);
        this.profileLib.set(new Map(profiles.map((p) => [p.idProfile, p.profile ?? ''])));
      },
      error: () => (this.refsCharges = false), // rechargeable au prochain clic
    });
  }
  private chargerLettres(): void {
    const idExamen = this.pv().idExamen;
    this.lettreService.getAll().subscribe((rows) => this.lettres.set(rows.filter((l) => l.idExamen === idExamen)));
  }

  /** Re-soumission après rectification → boîte de réponse ; 1ʳᵉ soumission → direct. */
  onSoumettre(): void {
    if (this.pv().statutPv === 'EN_RECTIFICATION') {
      this.toggleSoumettre();
    } else {
      this.soumettre();
    }
  }

  soumettre(): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    this.pvService.soumettre(this.pv().idPv, { imActeur: acteur }).subscribe({
      next: (pv) => this.onSuccess(pv, 'Projet soumis.'),
    });
  }

  /** Re-soumission avec une réponse (commentaire) au retour de rectification. */
  confirmerSoumission(commentaire: string): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    this.pvService
      .soumettre(this.pv().idPv, { imActeur: acteur, commentaire: commentaire.trim() || undefined })
      .subscribe({
        next: (pv) => {
          this.soumettreOuvert.set(false);
          this.onSuccess(pv, 'Projet re-soumis.');
        },
      });
  }

  /**
   * ⚠️ Visa unique (2026-08-31) — clôture de la navette en UN POST : avis (toujours envoyé, la
   * valeur affichée fait foi — la renvoyer identique est sans effet) et Membre co-signataire
   * obligatoires, part de signature du rôle posée par le serveur. Le Secrétaire de séance a
   * DISPARU du cycle (règle du 01/09, backend `8ae307a`) : plus de champ, rien d'envoyé.
   */
  confirmerVisa(): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    const idAvis = this.avisChoisi();
    if (!idAvis) {
      this.viserErreur.set("Sélectionnez l'avis global (obligatoire pour viser).");
      return;
    }
    // ⚠️ Deux niveaux (2026-09-04) — combinaison de signataires choisie par le Président :
    // coSignataires (1..2) parmi {CC du circuit, Membre examinateur, autre Membre de la centrale}.
    let coSignataires: string[] | null = null;
    let imMembreCoSignataire: string | null = null;
    if (this.estDeuxNiveaux()) {
      const combo = this.comboChoisie();
      if (!combo) {
        this.viserErreur.set('Choisissez la combinaison de signataires du PV.');
        return;
      }
      const cc = this.pv().imDispatcheur ?? null;
      const mExam = this.imExaminateur();
      if (combo === 'P_AUTRE') {
        const autre = this.autreMembreChoisi();
        if (!autre) {
          this.viserErreur.set('Sélectionnez le Membre de la centrale appelé à co-signer.');
          return;
        }
        coSignataires = [autre];
      } else {
        coSignataires = combo === 'P_CC_M' ? [cc!, mExam!] : combo === 'P_CC' ? [cc!] : [mExam!];
        if (coSignataires.some((x) => !x)) {
          this.viserErreur.set('Co-signataire introuvable (CC du circuit ou Membre examinateur manquant sur ce PV).');
          return;
        }
      }
    } else {
      imMembreCoSignataire = this.membreChoisi();
      if (!imMembreCoSignataire) {
        this.viserErreur.set('Désignez le Membre appelé à co-signer le PV.');
        return;
      }
    }
    const note = this.noteChoisie();
    if (this.interim() && !note) {
      this.viserErreur.set("Joignez la note d'intérim (PDF) qui justifie l'absence du dispatcheur.");
      return;
    }
    this.viserErreur.set(null);
    this.saving.set(true);
    const body = {
      imActeur: acteur,
      idAvis,
      ...(coSignataires ? { coSignataires } : { imMembreCoSignataire: imMembreCoSignataire! }),
    };
    const visa$ =
      this.interim() && note
        ? this.pvService.viserParInterim(this.pv().idPv, body, note)
        : this.pvService.viser(this.pv().idPv, body);
    visa$.subscribe({
      next: (pv) => {
        this.saving.set(false);
        this.viserOuvert.set(false);
        this.membreChoisi.set(null);
        this.noteChoisie.set(null);
        const attendus = (coSignataires ?? [imMembreCoSignataire!]).map((im) => this.nomControleur(im)).join(' et ');
        this.onSuccess(
          pv,
          `PV visé${this.interim() ? ' par intérim' : ''} — votre part est signée ; en attente de la co-signature de ${attendus}.`,
        );
      },
      error: () => this.saving.set(false), // 400/403/409 → toast centralisé (message backend)
    });
  }

  retourner(commentaire: string): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    if (!commentaire.trim()) {
      this.toast.error('Le commentaire de rectification est obligatoire.');
      return;
    }
    this.pvService
      .retourner(this.pv().idPv, { imActeur: acteur, commentaire: commentaire.trim() })
      .subscribe({
        next: (pv) => {
          this.retourOuvert.set(false);
          this.onSuccess(pv, 'Projet retourné pour rectification.');
        },
      });
  }

  /** Brouillon de lettre de renvoi (Président/CC) rattaché à l'examen du PV. */
  enregistrerBrouillonLettre(): void {
    this.saving.set(true);
    const corps = this.corpsLettre().trim();
    this.lettreService.creer({ idExamen: this.pv().idExamen, corpsLettre: corps || undefined }).subscribe({
      next: () => {
        this.saving.set(false);
        this.corpsLettre.set('');
        this.toast.success('Brouillon de lettre de renvoi enregistré.');
        this.chargerLettres();
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.toast.error(e.message || "Erreur lors de l'enregistrement de la lettre.");
      },
    });
  }
  /** Soumet une lettre (BROUILLON → SOUMIS) ; la signature se fait dans l'écran « Lettres de renvoi ». */
  soumettreLettre(l: LettreRenvoi): void {
    if (l.idLettre == null) {
      return;
    }
    this.saving.set(true);
    this.lettreService.soumettre(l.idLettre).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Lettre de renvoi soumise.');
        this.chargerLettres();
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.toast.error(e.message || 'Erreur lors de la soumission de la lettre.');
      },
    });
  }

  /**
   * Signe une part de co-signature. MEMBRE : le Membre désigné (visa unique, 2026-08-31).
   * CC (2026-09-04, deux niveaux) : le CC DÉSIGNÉ co-signataire au visa du Président — `signer(CC)`
   * lui est ouvert (backend `f648254`) ; `signer(PRESIDENT)` reste 409 (sa part passe par `viser`).
   */
  signer(role: 'MEMBRE' | 'CC' = 'MEMBRE'): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    if (role === 'MEMBRE' && this.roleSignature() !== 'MEMBRE') {
      this.toast.error('Votre part de signature se pose au visa, pas ici.');
      return;
    }
    if (role === 'CC' && !this.estCcDesigne()) {
      this.toast.error('La part Chef de commission revient au CC désigné au visa.');
      return;
    }
    this.saving.set(true);
    this.pvService.signer(this.pv().idPv, { imActeur: acteur, role }).subscribe({
      next: (pv) => {
        this.saving.set(false);
        this.onSuccess(
          pv,
          pv.statutPv === 'SIGNE' ? 'PV signé.' : 'Signature enregistrée — en attente des autres parts.',
        );
      },
      error: () => this.saving.set(false), // 409/403 → toast centralisé
    });
  }

  /** Nom lisible d'un matricule parmi les options de co-signature (repli : le matricule). */
  private nomDe(im: string): string {
    return this.membreOptions().find((o) => o.id === im)?.label ?? im;
  }

  private acteur(): string | null {
    const ref = this.auth.ref();
    if (!ref) {
      this.toast.error('Acteur courant introuvable.');
    }
    return ref;
  }

  private onSuccess(pv: PvExamen, message: string): void {
    this.toast.success(message);
    this.changed.emit(pv);
  }
}
