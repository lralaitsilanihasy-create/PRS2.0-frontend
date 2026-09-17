import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { genererMotDePasse } from '../../core/securite/mot-de-passe';
import { CompteAuthResume, TypeActeur } from '../../models';
import { CompteAuthService } from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/** Geste en attente de confirmation — `null` = la modale montre l'état du compte et ses actions. */
type Confirmation = 'suspendre' | 'reinitialiser';

/**
 * Les trois gestes d'administration d'un COMPTE DE CONNEXION, là où l'administrateur se trouve déjà
 * : la liste des PRMP, celle des UGPM, celle des contrôleurs (lot 6 F4).
 *
 * ⚠️ Les trois routes existaient déjà côté serveur et aucun écran ne les appelait franchement :
 * `desactiver` n'était appelée **nulle part**, `activer` seulement pour valider une inscription, et
 * `reinitialiser-mot-de-passe` n'était atteinte que **par effet de bord**, en remplissant deux
 * champs optionnels du formulaire PRMP ou UGPM (« laisser vide = inchangé »). Suspendre un compte
 * n'était donc pas faisable, et réinitialiser un mot de passe ne ressemblait pas à un geste.
 *
 * ⚠️ Ce que le serveur ne dit pas encore. Il n'existe aucune route qui donne le login d'un compte
 * ACTIF : `UgpmDto` le porte (lecture seule), `PrmpDto` et `ControleurDto` non, et
 * `GET /api/comptes-auth/en-attente` ne liste que les comptes **inactifs**. La modale en tire tout
 * ce qu'elle peut — statut et login d'un compte inactif, login d'une UGPM — et, quand elle ne sait
 * pas, elle le DIT et demande le login plutôt que d'inventer une correspondance matricule↔login qui
 * n'existe pas. L'annuaire (besoin B2) rendra cette saisie inutile ; F3 reprendra alors ces actions
 * dans la fiche.
 */
@Component({
  selector: 'app-actions-compte',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, ReactiveFormsModule, EtatErreur],
  template: `
    <div class="modal-backdrop" [class.closing]="closing()">
      <div
        class="modal cnm-card ac"
        role="dialog"
        aria-modal="true"
        aria-label="Compte de connexion"
        appModale
        (appModaleFermer)="fermerAnime()"
      >
        <div class="modal-header-plain">
          <span class="modal-title">Compte de connexion — {{ nom() }}</span>
        </div>

        <div class="modal-body ac__corps">
          <p class="ac__qui">
            {{ libelleType() }} <strong>{{ ref() }}</strong>
          </p>

          @if (chargement()) {
            <p class="text-muted" role="status">Lecture de l'état du compte…</p>
          } @else if (echecEtat()) {
            <app-etat-erreur
              message="L'état du compte n'a pas pu être lu."
              aide="Les actions restent possibles si vous connaissez le login."
              (reessayer)="chargerEtat()"
            />
          }

          @if (confirmation(); as geste) {
            <!-- ÉTAPE DE CONFIRMATION — même dialogue, pas une seconde modale : imbriquer deux
                 pièges de focus laisse l'utilisateur sans repère de retour. -->
            <p class="ac__confirmation">
              @if (geste === 'suspendre') {
                Suspendre le compte <strong>{{ loginCible() }}</strong> ? La personne ne pourra plus
                se connecter, et ses données ne sont pas touchées. Le geste se défait en réactivant
                le compte.
              } @else {
                Réinitialiser le mot de passe du compte <strong>{{ loginCible() }}</strong> ? Le mot
                de passe actuel cesse aussitôt de fonctionner. Le nouveau ne s'affichera
                <strong>qu'une seule fois</strong> : ayez de quoi le transmettre.
              }
            </p>
          } @else if (motDePasse(); as secret) {
            <!-- ⚠️ Affiché UNE FOIS. Le serveur ne stocke qu'une empreinte BCrypt : ni lui ni cet
                 écran ne pourront le redonner. Fermer la modale l'efface. -->
            <div class="ac__secret" role="status">
              <p class="ac__secret-titre">Mot de passe provisoire — notez-le maintenant</p>
              <p class="ac__secret-valeur"><code>{{ secret }}</code></p>
              <p class="ac__secret-aide">
                Il ne sera plus affiché après la fermeture de cette fenêtre, et personne ne peut le
                retrouver. Transmettez-le à la personne, qui le changera à sa première connexion.
              </p>
            </div>
          } @else {
            <p class="ac__statut" [class.ac__statut--suspendu]="inactif()">
              @if (inactif()) {
                Compte <strong>inactif</strong> — suspendu, ou inscription pas encore validée.
              } @else if (loginConnu()) {
                Compte <strong>actif</strong>.
              } @else {
                État inconnu : le serveur n'expose pas encore le compte d'un
                {{ libelleType().toLowerCase() }} actif.
              }
            </p>

            @if (loginConnu(); as login) {
              <p class="ac__login">Login : <strong>{{ login }}</strong></p>
            } @else {
              <label class="form-group ac__saisie">
                <span class="form-label">Login du compte *</span>
                <input class="form-control" type="text" autocomplete="off" [formControl]="loginSaisi" />
                <span class="form-hint">
                  À saisir tant que l'annuaire n'est pas livré : aucune route ne donne aujourd'hui le
                  login d'un compte actif. Le matricule n'est pas le login.
                </span>
              </label>
            }

            @if (estMonCompte()) {
              <p class="ac__refus" role="status">
                C'est votre propre compte : vous ne pouvez pas le suspendre. Un administrateur qui se
                suspend lui-même se ferme la porte, et personne d'autre ne peut la rouvrir.
              </p>
            }
          }
        </div>

        <div class="modal-footer ac__pied">
          @if (confirmation(); as geste) {
            <button type="button" class="btn btn-outline" [disabled]="occupe()" (click)="annulerConfirmation()">
              Annuler
            </button>
            <button
              type="button"
              [class]="geste === 'suspendre' ? 'btn btn-danger' : 'btn btn-primary'"
              [disabled]="occupe()"
              (click)="confirmer()"
            >
              {{ occupe() ? 'En cours…' : geste === 'suspendre' ? 'Suspendre le compte' : 'Réinitialiser' }}
            </button>
          } @else if (motDePasse()) {
            <button type="button" class="btn btn-primary" (click)="fermerAnime()">J'ai noté, fermer</button>
          } @else {
            <button type="button" class="btn btn-outline" (click)="fermerAnime()">Fermer</button>
            @if (inactif()) {
              <button type="button" class="btn btn-primary" [disabled]="occupe() || !loginCible()" (click)="reactiver()">
                {{ occupe() ? 'En cours…' : 'Réactiver le compte' }}
              </button>
            } @else {
              <button
                type="button"
                class="btn btn-danger"
                [disabled]="occupe() || !loginCible() || estMonCompte()"
                (click)="demander('suspendre')"
              >
                Suspendre le compte
              </button>
            }
            <button
              type="button"
              class="btn btn-secondary"
              [disabled]="occupe() || !loginCible()"
              (click)="demander('reinitialiser')"
            >
              Réinitialiser le mot de passe
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .ac { max-width: 34rem; }
    .ac__corps { display: flex; flex-direction: column; gap: 0.75rem; }
    .ac__qui { margin: 0; color: var(--n-500); }
    .ac__statut { margin: 0; }
    .ac__statut--suspendu { color: var(--warning-text, #92400e); }
    .ac__login { margin: 0; }
    .ac__saisie { margin: 0; }
    .ac__confirmation { margin: 0; }
    .ac__refus { margin: 0; color: var(--n-500); font-size: var(--text-sm); }
    .ac__secret {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding: 0.85rem 1rem;
      border: 1px solid var(--warning-border, #fde68a);
      border-radius: var(--radius-md);
      background: var(--warning-bg, #fffbeb);
      color: var(--warning-text, #92400e);
    }
    .ac__secret-titre { margin: 0; font-weight: 700; }
    .ac__secret-valeur { margin: 0; }
    .ac__secret-valeur code { font-size: var(--text-lg); font-weight: 700; letter-spacing: 0.06em; word-break: break-all; }
    .ac__secret-aide { margin: 0; font-size: var(--text-sm); }
    .ac__pied { flex-wrap: wrap; }
  `,
})
export class ActionsCompte implements OnInit {
  private readonly compteAuth = inject(CompteAuthService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Population de la personne — `refActeur` s'y rapporte (`t_compte_auth.TYPE_ACTEUR`). */
  readonly type = input.required<TypeActeur>();
  /** Matricule : `ID_PRMP`, identifiant UGPM ou `IM_CONTROLEUR`. */
  readonly ref = input.required<string>();
  /** Nom affiché dans le titre — l'administrateur doit voir QUI il suspend. */
  readonly nom = input.required<string>();
  /** Login déjà connu de l'écran appelant (`UgpmDto.login`) ; `null` sinon. */
  readonly login = input<string | null>(null);
  readonly fermer = output<void>();

  readonly closing = signal(false);
  readonly chargement = signal(false);
  readonly echecEtat = signal(false);
  readonly occupe = signal(false);
  readonly confirmation = signal<Confirmation | null>(null);
  /** Mot de passe tiré au sort, affiché UNE fois puis perdu avec la modale. */
  readonly motDePasse = signal<string | null>(null);

  /** Comptes INACTIFS du serveur : la seule vue qu'il offre aujourd'hui sur l'état des comptes. */
  private readonly inactifs = signal<CompteAuthResume[]>([]);

  readonly loginSaisi = new FormControl('', { nonNullable: true });
  private readonly saisie = toSignal(this.loginSaisi.valueChanges, { initialValue: '' });

  /** Le compte inactif de cette personne, s'il y en a un. */
  private readonly compteInactif = computed(() =>
    this.inactifs().find((c) => c.typeActeur === this.type() && c.refActeur === this.ref()),
  );
  readonly inactif = computed(() => !!this.compteInactif());

  /** Login que le serveur nous a donné : celui de l'écran appelant, sinon celui du compte inactif. */
  readonly loginConnu = computed(() => this.login() || this.compteInactif()?.login || null);
  /** Login sur lequel les actions porteront — connu, ou saisi à défaut. */
  readonly loginCible = computed(() => this.loginConnu() ?? this.saisie().trim() ?? null);

  /**
   * Est-ce le compte du connecté ? Les deux critères comptent : le LOGIN quand on le connaît, et
   * l'ACTEUR (type + matricule) qui, lui, est toujours connu — c'est le seul qui protège quand le
   * login est saisi à la main, ou mal saisi.
   */
  readonly estMonCompte = computed(() => {
    const memeActeur = this.auth.typeActeur() === this.type() && this.auth.ref() === this.ref();
    const cible = this.loginCible();
    return memeActeur || (!!cible && this.auth.login() === cible);
  });

  readonly libelleType = computed(
    () => ({ PRMP: 'PRMP', UGPM: 'UGPM', CONTROLEUR: 'Contrôleur' })[this.type()] ?? this.type(),
  );

  ngOnInit(): void {
    this.chargerEtat();
  }

  chargerEtat(): void {
    this.chargement.set(true);
    this.echecEtat.set(false);
    this.compteAuth.enAttente().subscribe({
      next: (comptes) => {
        this.inactifs.set(comptes);
        this.chargement.set(false);
      },
      error: () => {
        this.echecEtat.set(true);
        this.chargement.set(false);
      },
    });
  }

  fermerAnime(): void {
    if (!this.occupe()) {
      fermerAvecAnimation(this.closing, () => this.fermer.emit());
    }
  }

  demander(geste: Confirmation): void {
    if (geste === 'suspendre' && this.estMonCompte()) {
      return;
    }
    this.confirmation.set(geste);
  }
  annulerConfirmation(): void {
    if (!this.occupe()) {
      this.confirmation.set(null);
    }
  }

  confirmer(): void {
    if (this.confirmation() === 'suspendre') {
      this.suspendre();
    } else if (this.confirmation() === 'reinitialiser') {
      this.reinitialiser();
    }
  }

  /** Réactivation : pas de confirmation, le geste est réversible et rend un accès plutôt que de le retirer. */
  reactiver(): void {
    const login = this.loginCible();
    if (!login || this.occupe()) {
      return;
    }
    this.occupe.set(true);
    this.compteAuth.activer(login).subscribe({
      next: () => {
        this.occupe.set(false);
        this.toast.success(`Compte « ${login} » réactivé — la connexion est de nouveau possible.`);
        this.fermerAnime();
      },
      error: (_e: ApiError) => this.occupe.set(false), // message porté par l'intercepteur
    });
  }

  private suspendre(): void {
    const login = this.loginCible();
    // Seconde garde, après la saisie : le bouton était désactivé, le login a pu changer depuis.
    if (!login || this.occupe() || this.estMonCompte()) {
      return;
    }
    this.occupe.set(true);
    this.compteAuth.desactiver(login).subscribe({
      next: () => {
        this.occupe.set(false);
        this.toast.success(`Compte « ${login} » suspendu — la connexion est bloquée.`);
        this.fermerAnime();
      },
      error: (_e: ApiError) => this.occupe.set(false),
    });
  }

  private reinitialiser(): void {
    const login = this.loginCible();
    if (!login || this.occupe()) {
      return;
    }
    const nouveau = genererMotDePasse();
    this.occupe.set(true);
    this.compteAuth.reinitialiserMotDePasse(login, { nouveauMotDePasse: nouveau }).subscribe({
      next: () => {
        this.occupe.set(false);
        this.confirmation.set(null);
        // Affiché dans la modale, jamais dans un toast : un toast s'efface tout seul, et le mot de
        // passe n'existe plus nulle part ailleurs.
        this.motDePasse.set(nouveau);
      },
      error: (_e: ApiError) => this.occupe.set(false),
    });
  }
}
