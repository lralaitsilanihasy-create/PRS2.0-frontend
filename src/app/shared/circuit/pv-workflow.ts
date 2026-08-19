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
          <!-- ⚠️ Règle ajoutée (2026-08-02) : une signature par rôle — déjà signé ⇒ bouton désactivé. -->
          <!-- [disabled] pendant la requête : garde anti-double-clic (le serveur pose un verrou
               pessimiste en miroir). -->
          <button *appCan="'PV_SIGNER'" type="button" class="btn btn-primary" [disabled]="dejaSigne() || saving()"
            [title]="dejaSigne() ? 'Vous avez déjà signé ce PV — en attente des autres signataires.' : ''"
            (click)="signer()">
            {{ dejaSigne() ? 'Signé ✓' : saving() ? 'Signature…' : 'Signer' }}
          </button>
          @if (dejaSigne()) {
            <span class="pv-workflow__deja-signe">Vous avez déjà signé — en attente des autres signataires.</span>
          } @else if (coSignatureRestante()) {
            <!-- ⚠️ Règle 2026-08-15 : auto-co-signature — la part Membre est posée, le même
                 utilisateur enchaîne sur sa part de rôle et clôt seul la signature du PV. -->
            <span class="pv-workflow__deja-signe">
              ⤴ Part Membre signée — votre signature vaudra maintenant la
              <strong>part {{ roleSignatureLabel() }}</strong> (auto-co-signature par délégation) : le PV
              sera <strong>signé</strong>.
            </span>
          } @else if (signeCommeAttributaire()) {
            <!-- ⚠️ Auto-attribution (délégation ascendante) : la 1ʳᵉ signature vaut PART MEMBRE ; la
                 part de rôle suit (auto-co-signature) ou reste co-signable par un autre signataire. -->
            <span class="pv-workflow__deja-signe">
              ⤴ Vous êtes l'attributaire : votre signature vaudra la <strong>part Membre</strong>. Vous
              pourrez ensuite signer vous-même la part {{ partRoleLabel() }} (auto-co-signature par
              délégation) — ou la laisser à un autre signataire.
            </span>
          }
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
    if (ref && this.auth.role() !== 'VERIFICATEUR' && this.permissions.peutExecuter('VERIFICATEUR') && !options.some((o) => o.id === ref)) {
      const moi = this.controleurs().find((c) => c.imControleur === ref);
      const nom = moi ? [moi.nomCont, moi.prenomsCont].filter(Boolean).join(' ') : ref;
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
  private readonly estAttributaire = computed(
    () => !!this.pv().imCtrlMembre && this.pv().imCtrlMembre === this.auth.ref(),
  );
  /**
   * Rôle sous lequel le signataire courant signe — la PROCHAINE part à poser. ⚠️ Délégation
   * ascendante (auto-attribution) : l'attributaire signe d'abord la **part Membre** (`role=MEMBRE`,
   * acte d'identité, non déléguable). ⚠️ Règle 2026-08-15 (annule la séparation des signataires) :
   * le verrou « une signature par personne » est LEVÉ pour le P/CC attributaire — part Membre posée,
   * le même utilisateur enchaîne sur SA part de rôle (auto-co-signature, conditionnée côté serveur à
   * la paire « → Membre » active : 403 si elle a été désactivée entre-temps). Le circuit court se
   * clôt donc seul : deux actions successives, PV → SIGNE.
   */
  readonly roleSignature = computed<PvSignataireRole | null>(() => {
    if (this.estAttributaire() && this.pv().dateSignatureMembre == null) return 'MEMBRE';
    return pvSignataireRole(this.auth.role());
  });
  /** L'utilisateur signe la part Membre en tant qu'ATTRIBUTAIRE alors que son profil n'est pas Membre. */
  readonly signeCommeAttributaire = computed(() => this.roleSignature() === 'MEMBRE' && this.auth.role() !== 'MEMBRE');
  /** Part Membre posée par l'attributaire P/CC → sa part de rôle reste à signer (auto-co-signature). */
  readonly coSignatureRestante = computed(
    () =>
      this.estAttributaire() &&
      this.auth.role() !== 'MEMBRE' &&
      this.pv().dateSignatureMembre != null &&
      !this.dejaSigne(),
  );
  /** Libellé humain de la part de rôle courante (hint d'auto-co-signature). */
  readonly roleSignatureLabel = computed(() =>
    this.roleSignature() === 'PRESIDENT' ? 'Président' : this.roleSignature() === 'CC' ? 'Chef de commission' : 'Membre',
  );
  /** Libellé de la part de rôle du PROFIL courant (hint avant la part Membre de l'attributaire). */
  readonly partRoleLabel = computed(() => (this.auth.role() === 'PRESIDENT' ? 'Président' : 'Chef de commission'));
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

  signer(): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    // Attributaire (auto-attribution par délégation) → part MEMBRE ; sinon le rôle du profil.
    const role = this.roleSignature();
    if (!role) {
      this.toast.error("Votre profil n'est pas signataire du PV.");
      return;
    }
    this.saving.set(true);
    this.pvService.signer(this.pv().idPv, { imActeur: acteur, role }).subscribe({
      next: (pv) => {
        this.saving.set(false);
        // Part intermédiaire (ex. part Membre de l'attributaire, auto-co-signature à suivre) ≠ PV complet.
        this.onSuccess(pv, pv.statutPv === 'SIGNE' ? 'PV signé.' : 'Signature enregistrée — en attente des autres parts.');
      },
      error: () => this.saving.set(false), // 409/403 → toast centralisé
    });
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
