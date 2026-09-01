import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
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
      </div>

      <div class="pv-workflow__actions">
        @if (canSoumettre()) {
          <button *appCan="'PV_SOUMETTRE'" type="button" class="btn btn-primary" (click)="onSoumettre()">
            Soumettre le projet
          </button>
        }
        @if (canViser()) {
          @if (estDispatcheur()) {
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
            Retourner pour rectification
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
        @if (attenteCoSignature()) {
          <span class="pv-workflow__deja-signe">
            En attente de la co-signature de <strong>{{ nomMembreDesigne() }}</strong>.
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

      <!-- ⚠️ Visa unique (2026-08-31) — clôture de la navette EN UN GESTE (Président/CC dispatcheur) :
           avis du Membre modifiable, Secrétaire de séance et Membre co-signataire obligatoires, et la
           part de signature du rôle posée dans le même POST. -->
      @if (viserOuvert()) {
        <div class="pv-workflow__retour pv-workflow__retour--accept cnm-form">
          <span class="pv-workflow__retour-label">{{ interim() ? 'Visa par intérim — clôture de la navette' : 'Visa — clôture de la navette' }}</span>
          <span class="form-hint">
            Le visa clôt la navette en un geste : il arrête l'avis, désigne le Secrétaire de séance et
            le Membre co-signataire, et pose <strong>votre part de signature</strong>. Le Membre désigné
            posera la part Membre : le PV est signé par deux personnes distinctes.
          </span>
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
          <label class="form-group">
            <span class="form-label">Secrétaire de séance *</span>
            <select class="form-control" [value]="secretaireChoisi() ?? ''" (change)="secretaireChoisi.set($any($event.target).value || null)">
              <option value="" [selected]="!secretaireChoisi()">— Sélectionner —</option>
              @for (v of verificateurOptions(); track v.id) {
                <option [value]="v.id" [selected]="v.id === secretaireChoisi()">{{ v.label }}</option>
              }
            </select>
            <span class="form-hint">Vérificateur de la localité du dossier, désigné au PV.</span>
          </label>
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
    .pv-workflow {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .pv-workflow__state {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .pv-workflow__label {
      font-size: var(--text-sm);
      color: var(--n-500);
      font-weight: 600;
    }
    .pv-workflow__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .pv-workflow__deja-signe {
      font-size: var(--text-sm);
      color: var(--n-500);
      font-style: italic;
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
  private readonly permissions = inject(PermissionsService);
  private readonly toast = inject(ToastService);

  /** PV courant. */
  readonly pv = input.required<PvExamen>();
  /** Localité du dossier du PV (candidats Secrétaire de séance = Vérificateurs de cette localité). */
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
  /** Panneau « visa » (avis + secrétaire + co-signataire + part de signature, Président/CC dispatcheur). */
  readonly viserOuvert = signal(false);
  /** Panneau « lettre de renvoi » (Président/CC, même étape). */
  readonly lettreOuvert = signal(false);
  readonly saving = signal(false);

  readonly avisChoisi = signal<string | null>(null);
  readonly secretaireChoisi = signal<string | null>(null);
  readonly viserErreur = signal<string | null>(null);
  readonly corpsLettre = signal('');
  /** Lettres de renvoi de l'examen du PV (affichées dans le panneau lettre). */
  readonly lettres = signal<LettreRenvoi[]>([]);

  readonly aviss = signal<Avis[]>([]);
  private readonly controleurs = signal<Controleur[]>([]);
  private readonly profileLib = signal<Map<number, string>>(new Map());
  /** Référentiels (avis / contrôleurs / profils) chargés une seule fois, à l'ouverture du panneau. */
  private refsCharges = false;
  /**
   * Candidats Secrétaire de séance : Vérificateurs TITULAIRES de la localité + « moi-même » (⤴
   * délégation du profil Vérificateur — décision 2026-08-15 qui ANNULE le statu quo du même jour)
   * quand la paire « profil courant → Vérificateur » est ACTIVE en base : le Président/CC qui accepte
   * peut se désigner lui-même (garde backend en miroir « titulaire OU délégation », 409 sinon —
   * mention « (par délégation) » posée sur le document PV côté serveur). Paire désactivée → l'option
   * disparaît, zéro code.
   */
  readonly verificateurOptions = computed(() => {
    const loc = this.idLocalite();
    const libs = this.profileLib();
    const options = this.controleurs()
      .filter((c) => c.idLocalite === loc && c.idProfile != null && /v[ée]rificateur/i.test(libs.get(c.idProfile) ?? ''))
      .map((c) => ({ id: c.imControleur, label: [c.nomCont, c.prenomsCont].filter(Boolean).join(' ') || c.imControleur }));
    const ref = this.auth.ref();
    // ⚠️ 2026-08-28 — la paire ne suffit pas : `ControleurDirectory.peutEtreSecretaireSeance` exige
    // EN PLUS que le secrétaire de séance soit de la localité du dossier (§3.3). Voir `peutSAutoProposer`.
    const moi = ref ? this.controleurs().find((c) => c.imControleur === ref) : undefined;
    const eligible = !!moi && peutSAutoProposer(moi.idLocalite, loc);
    if (ref && moi && eligible && this.auth.role() !== 'VERIFICATEUR' && this.permissions.peutExecuter('VERIFICATEUR') && !options.some((o) => o.id === ref)) {
      const nom = [moi.nomCont, moi.prenomsCont].filter(Boolean).join(' ') || ref;
      options.unshift({ id: ref, label: `${nom} — moi-même ⤴ (délégation du profil Vérificateur)` });
    }
    return options;
  });

  readonly statutLabel = computed(() => PV_STATUT_LABELS[this.pv().statutPv]);
  readonly canSoumettre = computed(() => peutSoumettre(this.pv().statutPv));
  readonly canRetourner = computed(() => peutRetourner(this.pv().statutPv));
  /**
   * ⚠️ Visa unique (2026-08-31) — le visa s'offre au rôle P/CC tant que sa part n'est pas posée :
   * sur PROJET_SOUMIS (cas normal) et sur PROJET_ACCEPTE (PV accepté sous l'ancien contrat, à
   * compléter). L'identité du dispatcheur est vérifiée à part (`estDispatcheur`) pour pouvoir
   * ÉCRIRE la raison du refus au lieu de faire disparaître le bouton sans explication.
   */
  readonly canViser = computed(() => {
    const r = this.roleSignature();
    return peutViser(this.pv().statutPv) && (r === 'PRESIDENT' || r === 'CC') && !this.dejaSigne();
  });
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
    const r = this.roleSignature();
    if (r !== 'PRESIDENT' && r !== 'CC') return false;
    return peutSAutoProposer(this.auth.localite(), this.idLocalite());
  });
  /** La lettre de renvoi reste une issue de la navette ouverte au rôle (pas au seul dispatcheur). */
  readonly canLettre = computed(() => this.pv().statutPv === 'PROJET_SOUMIS');
  /** Part MEMBRE seule — le Président/CC pose la sienne au visa. */
  readonly canSignerMembre = computed(() => peutSigner(this.pv().statutPv) && this.roleSignature() === 'MEMBRE');
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
  /** Part de rôle posée, en attente de la co-signature du Membre désigné. */
  readonly attenteCoSignature = computed(
    () => !!this.membreDesigne() && this.pv().dateSignatureMembre == null && this.roleSignature() !== 'MEMBRE',
  );

  /** Matricule du Membre co-signataire choisi dans le panneau de visa. */
  readonly membreChoisi = signal<string | null>(null);
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
   * Ouvre le panneau de visa (pré-rempli du PV — avis du Membre, secrétaire éventuel — sinon de la
   * suggestion) et charge les référentiels.
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
      this.secretaireChoisi.set(this.pv().idSecretaireSeance ?? null);
      this.membreChoisi.set(null);
      this.chargerReferentiels();
    }
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
   * valeur affichée fait foi — la renvoyer identique est sans effet), Secrétaire de séance et
   * Membre co-signataire obligatoires, part de signature du rôle posée par le serveur.
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
    const idSecretaireSeance = this.secretaireChoisi();
    if (!idSecretaireSeance) {
      this.viserErreur.set('Désignez le Secrétaire de séance (Vérificateur de la localité du dossier).');
      return;
    }
    const imMembreCoSignataire = this.membreChoisi();
    if (!imMembreCoSignataire) {
      this.viserErreur.set('Désignez le Membre appelé à co-signer le PV.');
      return;
    }
    const note = this.noteChoisie();
    if (this.interim() && !note) {
      this.viserErreur.set("Joignez la note d'intérim (PDF) qui justifie l'absence du dispatcheur.");
      return;
    }
    this.viserErreur.set(null);
    this.saving.set(true);
    const body = { imActeur: acteur, idAvis, idSecretaireSeance, imMembreCoSignataire };
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
        this.onSuccess(
          pv,
          `PV visé${this.interim() ? ' par intérim' : ''} — votre part est signée ; en attente de la co-signature de ${this.nomDe(imMembreCoSignataire)}.`,
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
   * Signe la part MEMBRE — la seule qui passe encore par `signer` depuis le visa unique
   * (2026-08-31) : le Président / CC pose la sienne au visa, et un `signer(PRESIDENT|CC)`
   * recevrait 409 du serveur.
   */
  signer(): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    if (this.roleSignature() !== 'MEMBRE') {
      this.toast.error('Votre part de signature se pose au visa, pas ici.');
      return;
    }
    this.saving.set(true);
    this.pvService.signer(this.pv().idPv, { imActeur: acteur, role: 'MEMBRE' }).subscribe({
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
