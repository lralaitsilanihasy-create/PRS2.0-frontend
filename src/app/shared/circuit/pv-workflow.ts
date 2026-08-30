import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Avis, Controleur, LettreRenvoi, PvExamen, PvSignataireRole } from '../../models';
import { AvisService, ControleurService, LettreRenvoiService, ProfileService, PvExamenService } from '../../services';
import { CanDirective } from '../security/can.directive';
import { StatutBadge } from './statut-badge';
import {
  PV_STATUT_LABELS,
  peutAccepter,
  peutRetourner,
  peutSAutoProposer,
  peutSigner,
  peutSoumettre,
  pvSignataireRole,
} from './circuit-workflow';

/**
 * Actions de workflow d'un PV d'examen (soumettre / retourner / accepter / signer),
 * reflétant la machine d'états du §3. Chaque action est proposée seulement si :
 *  - le statut courant l'autorise (état), ET
 *  - le profil possède la capacité correspondante (`*appCan`).
 *
 * ⚠️ Règle modifiée (2026-08-01) — CLÔTURE DE NAVETTE : « Accepter le projet » (Président/CC)
 * renseigne l'avis global + le Secrétaire de séance (obligatoires, panneau dédié) ; l'action
 * « Lettre de renvoi » (brouillon + soumission) est disponible à cette même étape, pour les
 * mêmes rôles. Le Membre ne pose plus ni avis ni secrétaire.
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
        @if (canAccepter()) {
          <button *appCan="'PV_ACCEPTER'" type="button" class="btn btn-success" (click)="toggleAccepter()">
            Accepter le projet
          </button>
        }
        @if (canRetourner()) {
          <button *appCan="'PV_RETOURNER'" type="button" class="btn btn-warning" (click)="toggleRetour()">
            Retourner pour rectification
          </button>
        }
        @if (canAccepter()) {
          <button *appCan="'PV_ACCEPTER'" type="button" class="btn btn-outline" (click)="toggleLettre()">
            Lettre de renvoi
          </button>
        }
        @if (canSigner()) {
          <!-- ⚠️ Règle ajoutée (2026-08-02) : une signature par rôle — déjà signé ⇒ bouton désactivé.
               ⚠️ Co-signature (2026-08-28) : le Président / CC passe par le panneau de désignation ;
               le Membre désigné signe directement. Les deux encarts d'auto-co-signature ont disparu
               avec la règle qui les portait. -->
          <!-- [disabled] pendant la requête : garde anti-double-clic (le serveur pose un verrou
               pessimiste en miroir). -->
          <button *appCan="'PV_SIGNER'" type="button" class="btn btn-primary"
            [disabled]="dejaSigne() || saving() || partMembreFermee()"
            [title]="dejaSigne()
              ? 'Vous avez déjà signé ce PV — en attente des autres signataires.'
              : partMembreFermee()
                ? 'La part Membre n’est pas encore ouverte : le Président ou le Chef de commission doit d’abord signer et désigner le co-signataire.'
                : ''"
            (click)="doitDesigner() ? toggleDesignation() : signer()">
            {{ dejaSigne() ? 'Signé ✓' : saving() ? 'Signature…' : doitDesigner() ? 'Signer et désigner…' : 'Signer' }}
          </button>
          @if (dejaSigne()) {
            <span class="pv-workflow__deja-signe">Vous avez déjà signé — en attente des autres signataires.</span>
          } @else if (partMembreFermee()) {
            <!-- ⚠️ Ordre B — la part Membre ne s'ouvre qu'après la désignation par le P/CC. -->
            <span class="pv-workflow__deja-signe">
              La <strong>part Membre</strong> n'est pas encore ouverte : le Président ou le Chef de
              commission doit d'abord signer et désigner le Membre co-signataire.
            </span>
          } @else if (estDesigne()) {
            <span class="pv-workflow__deja-signe">
              Vous avez été <strong>désigné co-signataire</strong> de ce PV : votre signature posera la
              <strong>part Membre</strong> et clôturera la signature.
            </span>
          }
          @if (attenteCoSignature()) {
            <span class="pv-workflow__deja-signe">
              En attente de la co-signature de <strong>{{ nomMembreDesigne() }}</strong>.
            </span>
          }
        }

        <!-- ⚠️ Co-signature (2026-08-28) — le Président / CC désigne le Membre appelé à co-signer,
             au moment de signer. Obligatoire côté serveur : Membre de la LOCALITÉ du dossier et
             différent du signataire (le PV est co-signé par deux personnes distinctes). -->
        @if (designationOuverte()) {
          <div class="pv-workflow__retour pv-workflow__retour--accept cnm-form">
            <span class="pv-workflow__retour-label">Signature — désignation du Membre co-signataire</span>
            <span class="form-hint">
              Votre signature pose votre part. Le Membre que vous désignez ici posera la part Membre :
              le PV est signé par deux personnes distinctes.
            </span>
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
                être signé tant qu'un Membre n'y est pas rattaché.
              </span>
            }
            <div class="pv-workflow__retour-actions">
              <button type="button" class="btn btn-outline" (click)="toggleDesignation()">Annuler</button>
              <button type="button" class="btn btn-primary" [disabled]="!membreChoisi() || saving()" (click)="signer()">
                {{ saving() ? 'Signature…' : 'Signer et désigner' }}
              </button>
            </div>
          </div>
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

      <!-- ⚠️ Clôture de la navette (Président/CC) : avis global + Secrétaire de séance obligatoires. -->
      @if (accepterOuvert()) {
        <div class="pv-workflow__retour pv-workflow__retour--accept cnm-form">
          <span class="pv-workflow__retour-label">Clôture de la navette — avis global et Secrétaire de séance</span>
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
          @if (accepterErreur()) { <span class="form-error">{{ accepterErreur() }}</span> }
          <div class="pv-workflow__retour-actions">
            <button type="button" class="btn btn-outline" (click)="toggleAccepter()">Annuler</button>
            <button type="button" class="btn btn-success" [disabled]="saving()" (click)="confirmerAcceptation()">
              {{ saving() ? 'Acceptation…' : 'Accepter le projet' }}
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
  /** Panneau « clôture de navette » (avis + secrétaire, Président/CC). */
  readonly accepterOuvert = signal(false);
  /** Panneau « lettre de renvoi » (Président/CC, même étape). */
  readonly lettreOuvert = signal(false);
  readonly saving = signal(false);

  readonly avisChoisi = signal<string | null>(null);
  readonly secretaireChoisi = signal<string | null>(null);
  readonly accepterErreur = signal<string | null>(null);
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
  readonly canAccepter = computed(() => peutAccepter(this.pv().statutPv));
  readonly canSigner = computed(() => peutSigner(this.pv().statutPv));
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

  /**
   * ⚠️ Ordre B (arbitrage du pilote, 2026-08-28) — le Président / CC DÉSIGNE le Membre co-signataire
   * au moment de signer. Le champ est obligatoire côté serveur (`designerMembreCoSignataire`, 409
   * si absent), doit viser un Membre de la localité du dossier et différer du signataire.
   */
  readonly doitDesigner = computed(() => {
    const r = this.roleSignature();
    return r === 'PRESIDENT' || r === 'CC';
  });
  /** Membre déjà désigné sur ce PV — `null` tant que le P/CC n'a pas signé (ou PV d'avant la règle). */
  readonly membreDesigne = computed(() => this.pv().imMembreCoSignataire ?? null);
  /** Nom du Membre désigné, servi par le backend — évite un appel pour l'afficher. */
  readonly nomMembreDesigne = computed(() => this.pv().nomMembreCoSignataire || this.membreDesigne() || '');
  /** L'utilisateur courant est le Membre désigné : la part Membre lui revient, à lui seul. */
  readonly estDesigne = computed(() => !!this.membreDesigne() && this.membreDesigne() === this.auth.ref());
  /**
   * La part Membre est-elle encore fermée ? Sous l'ordre B, elle ne s'ouvre qu'APRÈS la désignation :
   * un Membre qui signerait spontanément avant viderait de son objet le choix du P/CC (409 serveur).
   */
  readonly partMembreFermee = computed(() => this.roleSignature() === 'MEMBRE' && !this.membreDesigne());
  /** Part de rôle posée, en attente de la co-signature du Membre désigné. */
  readonly attenteCoSignature = computed(
    () => !!this.membreDesigne() && this.pv().dateSignatureMembre == null && this.roleSignature() !== 'MEMBRE',
  );

  /** Panneau de désignation ouvert (le P/CC choisit son co-signataire avant de signer). */
  readonly designationOuverte = signal(false);
  /** Matricule du Membre choisi dans le panneau. */
  readonly membreChoisi = signal<string | null>(null);

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
      if (suggestion && this.accepterOuvert() && !this.avisChoisi()) {
        this.avisChoisi.set(suggestion);
      }
    });
  }

  /** Ouvre le panneau de clôture (pré-rempli du PV, sinon de la suggestion) et charge les référentiels. */
  toggleAccepter(): void {
    const opening = !this.accepterOuvert();
    this.accepterOuvert.set(opening);
    if (opening) {
      this.accepterErreur.set(null);
      this.avisChoisi.set(this.pv().idAvis ?? this.avisSuggere());
      this.secretaireChoisi.set(this.pv().idSecretaireSeance ?? null);
      this.chargerReferentiels();
    }
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

  /** Clôture de la navette : avis global + Secrétaire de séance OBLIGATOIRES (règle 2026-08-01). */
  confirmerAcceptation(): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    const idAvis = this.avisChoisi();
    if (!idAvis) {
      this.accepterErreur.set("Sélectionnez l'avis global (obligatoire pour clore la navette).");
      return;
    }
    const idSecretaireSeance = this.secretaireChoisi();
    if (!idSecretaireSeance) {
      this.accepterErreur.set('Désignez le Secrétaire de séance (Vérificateur de la localité du dossier).');
      return;
    }
    this.accepterErreur.set(null);
    this.saving.set(true);
    this.pvService.accepter(this.pv().idPv, { imActeur: acteur, idAvis, idSecretaireSeance }).subscribe({
      next: (pv) => {
        this.saving.set(false);
        this.accepterOuvert.set(false);
        this.onSuccess(pv, 'Projet accepté — navette close (avis et secrétaire posés).');
      },
      error: () => this.saving.set(false), // 400/409 → toast centralisé (message backend)
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

  /** Ouvre / referme le panneau de désignation du co-signataire (Président et CC). */
  toggleDesignation(): void {
    const ouverture = !this.designationOuverte();
    this.designationOuverte.set(ouverture);
    if (ouverture) {
      // ⚠️ 2026-08-30 — défaut constaté à l'écran : `chargerReferentiels()` n'était appelé que par
      // `toggleAccepter`. Un Président ou un CC qui va DIRECTEMENT à la signature — le cas normal
      // quand le PV a été accepté lors d'une visite précédente — ouvrait donc la désignation avec
      // une liste de contrôleurs vide, et lisait « aucun Membre disponible » alors que la
      // commission en compte un. Les tests ne pouvaient pas le voir : ils n'ouvrent pas de panneau.
      this.chargerReferentiels();
    }
  }

  /**
   * Signe la part du profil courant. Pour le Président et le CC, la désignation du Membre
   * co-signataire accompagne la signature dans le MÊME appel (`imMembreCoSignataire`) — c'est le
   * contrat serveur, et cela évite un état intermédiaire « désigné mais non signé ».
   */
  signer(): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    const role = this.roleSignature();
    if (!role) {
      this.toast.error("Votre profil n'est pas signataire du PV.");
      return;
    }
    const designe = this.doitDesigner() ? this.membreChoisi() : null;
    if (this.doitDesigner() && !designe) {
      this.toast.error('Désignez le Membre appelé à co-signer le PV avant de signer.');
      return;
    }
    this.saving.set(true);
    this.pvService
      .signer(this.pv().idPv, { imActeur: acteur, role, ...(designe ? { imMembreCoSignataire: designe } : {}) })
      .subscribe({
        next: (pv) => {
          this.saving.set(false);
          this.designationOuverte.set(false);
          this.membreChoisi.set(null);
          this.onSuccess(
            pv,
            pv.statutPv === 'SIGNE'
              ? 'PV signé.'
              : designe
                ? `Signature enregistrée — en attente de la co-signature de ${this.nomDe(designe)}.`
                : 'Signature enregistrée — en attente des autres parts.',
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
