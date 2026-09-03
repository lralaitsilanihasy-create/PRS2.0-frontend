import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { forkJoin, skip } from 'rxjs';

import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { Controleur, Dispatch, Dossier } from '../../models';
import {
  ControleurService,
  DelegationProfilService,
  DispatchService,
  DossierService,
  ExamenService,
  EntiteContractService,
  LocaliteService,
  ProfileService,
  ReceptionService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { ToastService } from '../../core/notifications/toast.service';
import { urlBlobSure } from '../../core/securite/fichiers-surs';
import { StatutBadge } from '../../shared/circuit';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { DossiersRefreshStore } from '../prmp/dossiers-refresh.store';
import { DossierConsultation } from './dossier-consultation';

/** Un dossier attribué à un contrôleur par le dernier dispatch (rôle joué : Membre attributaire ou CC). */
interface DossierAttribue {
  dossier: Dossier;
  /** Dispatch d'attribution COMPLET (cible du « Retirer » : annulation, ou REPRISE par le CC — 2026-09-03). */
  dispatch: Dispatch;
  idDispatch: number;
  dateDispatch?: string;
}
/** Carte de la statistique : un contrôleur et ses dossiers dispatchés. */
interface LigneControleur {
  im: string;
  /** Nom complet (détail, alt, initiales). */
  nom: string;
  /** Prénom(s) seul(s) — affiché sur la carte. */
  prenom: string;
  profil: string;
  dossiers: DossierAttribue[];
}

/**
 * Section « Dispatchs par contrôleur » — embarquée dans « Mes dossiers » (Président et CC, via
 * `ClassementConfig.statDispatchsControleurs` ; le périmètre — toutes localités vs sa localité —
 * vient du scoping serveur des listes) : grille de cartes (une par contrôleur, triées par
 * total décroissant) — avatar à initiales, profil, nom, total et répartition par type de dossier —
 * avec le détail des dossiers dépliable sous la grille (« Voir les dossiers »). Seuls les dossiers
 * encore en cours côté commission comptent (DISPATCHE / EXAMINE) : un dossier sort de la statistique
 * dès la signature de son PV définitif (statut PV_SIGNE et au-delà) ; attributions CC/Président
 * visibles seulement si la délégation « profil → Membre » est active (§3.5). Aucun endpoint dédié :
 * dispatchs + réceptions + dossiers joints côté client (mêmes listes que le drill-down, pas de N+1).
 */
@Component({
  selector: 'app-dispatchs-controleurs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation, DatePipe, ModaleDirective, EtatErreur],
  template: `
    <section class="dpc">
      <h2 class="dpc__titre"><span aria-hidden="true">📊</span> Dispatchs par contrôleur</h2>
      <p class="dpc__intro">Répartition des dossiers <strong>dispatchés</strong> entre leurs <strong>attributaires</strong> (dernier dispatch de chaque dossier) : chaque dossier compte <strong>une seule fois</strong> — la copie adressée au Chef de commission n'est pas une attribution. Un dossier sort de la statistique dès que son <strong>PV définitif est signé</strong> ; les attributions d'un CC ou d'un Président n'apparaissent que si la <strong>délégation du profil Membre</strong> est active.</p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger la répartition des dispatchs." (reessayer)="charger()" />
      } @else {
        <div class="dpc__kpis">
          <div class="cnm-stat cnm-stat--blue">
            <div class="cnm-stat__icon" aria-hidden="true">📦</div>
            <div class="cnm-stat__body">
              <div class="cnm-stat__value">{{ totalDossiers() }}</div>
              <div class="cnm-stat__label">Dossiers dispatchés</div>
            </div>
          </div>
          <div class="cnm-stat cnm-stat--green">
            <div class="cnm-stat__icon" aria-hidden="true">👥</div>
            <div class="cnm-stat__body">
              <div class="cnm-stat__value">{{ lignes().length }}</div>
              <div class="cnm-stat__label">Contrôleurs concernés</div>
            </div>
          </div>
        </div>

        <div class="dpc__grid">
          @for (l of lignes(); track l.im; let i = $index) {
            <article class="dpc__card">
              <span class="dpc__rank">#{{ i + 1 }}</span>
              <div class="dpc__avatar dpc__avatar--{{ i % 4 }}">
                @if (photoDe(l.im); as ph) {
                  <img class="dpc__photo" [src]="ph" [alt]="'Photo de ' + l.nom" />
                } @else {
                  <span class="dpc__initiales" aria-hidden="true">{{ initiales(l.nom) }}</span>
                }
              </div>
              <div class="dpc__role">{{ l.profil }}</div>
              <h3 class="dpc__nom">{{ l.prenom }}</h3>
              <div class="dpc__total">
                <span class="dpc__total-nb">{{ l.dossiers.length }}</span>
                <span class="dpc__total-lbl">dossier{{ l.dossiers.length > 1 ? 's' : '' }} au total</span>
              </div>
              <ul class="dpc__types">
                @for (t of typesDe(l); track t.libelle; let j = $index) {
                  <li class="dpc__type">
                    <div class="dpc__type-head">
                      <span>{{ t.libelle }}</span>
                      <span class="dpc__type-nb">{{ t.count }}</span>
                    </div>
                    <div class="dpc__tbar"><span class="dpc__tbar-fill dpc__tbar--{{ j % 5 }}" [style.width.%]="t.pct"></span></div>
                  </li>
                }
              </ul>
              <button type="button" class="dpc__voir" (click)="basculer(l.im)">
                {{ ouvert() === l.im ? 'Masquer les dossiers' : 'Voir les dossiers' }}
              </button>
            </article>
          } @empty {
            <div class="dpc__empty">Aucun dossier dispatché pour le moment.</div>
          }
        </div>

        @if (ligneOuverte(); as l) {
          <div class="table-card">
            <div class="dpc__detail-titre">Dossiers dispatchés à {{ l.nom }}</div>
            <table>
              <thead>
                <tr>
                  <th scope="col">Référence</th>
                  <th scope="col">Entité contractante</th>
                  <th scope="col">Type</th>
                  <th scope="col">Date dispatch</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Localité</th>
                  <th scope="col" class="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (a of l.dossiers; track a.dossier.idDossier) {
                  <tr>
                    <td>{{ a.dossier.refeDossier || '#' + a.dossier.idDossier }}</td>
                    <td>{{ entiteLabel(a.dossier) }}</td>
                    <td>{{ typeLabel(a.dossier) }}</td>
                    <td style="white-space:nowrap;">{{ (a.dateDispatch | date: 'dd/MM/yyyy HH:mm') || '—' }}</td>
                    <td>
                      @if (a.dossier.statut) { <app-statut-badge [statut]="a.dossier.statut" /> } @else { — }
                      @if (a.dossier.statut === 'DISPATCHE' && dossiersAvecExamen().has(a.dossier.idDossier)) {
                        <span class="badge dpc__brouillon" title="Un examen est commencé (brouillon enregistré par le Membre).">Examen en cours</span>
                      }
                    </td>
                    <td>{{ localiteLabel(a.dossier) }}</td>
                    <td>
                      <div class="td-actions dpc__actions-end">
                        <button type="button" class="btn btn-secondary btn-sm" (click)="consulte.set(a.dossier)">Voir détails</button>
                        @if (peutRetirer(a)) {
                          <button type="button" class="btn btn-danger btn-sm" (click)="retrait.set({ a, nom: l.nom })">Retirer</button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
    @if (retrait(); as r) {
      <div class="modal-backdrop" [class.closing]="closingRetrait()">
        <div class="modal dpc__confirm" role="alertdialog" aria-modal="true" aria-label="Retrait du dossier dispatché" appModale appModaleClicExterieur (appModaleFermer)="fermerRetrait()">
          <div class="modal-body">
            @if (estRendu(r.a)) {
              <p>Rendre le dossier <strong>{{ r.a.dossier.refeDossier || '#' + r.a.dossier.idDossier }}</strong> ?</p>
              <p class="dpc__confirm-hint">
                Vous <strong>rendez</strong> le dossier : il retournera en <strong>Pré-dispatch</strong>
                et vous n'en serez plus l'attributaire. Tout examen déjà commencé sera supprimé.
              </p>
            } @else if (estReprise(r.a)) {
              <p>
                Retirer le dossier <strong>{{ r.a.dossier.refeDossier || '#' + r.a.dossier.idDossier }}</strong> à
                <strong>{{ r.nom }}</strong> ?
              </p>
              <p class="dpc__confirm-hint">
                Le dossier <strong>vous reviendra</strong> : il rejoindra vos dossiers
                « <strong>À examiner</strong> » (vous pourrez l'examiner ou le réattribuer) — il ne
                repart pas en pré-dispatch.
              </p>
            } @else {
              <p>
                Retirer le dossier <strong>{{ r.a.dossier.refeDossier || '#' + r.a.dossier.idDossier }}</strong> à
                <strong>{{ r.nom }}</strong> ?
              </p>
              <p class="dpc__confirm-hint">
                Le dispatch sera annulé et le dossier reviendra en <strong>Pré-dispatch</strong> (re-dispatchable).
                @if (r.a.dossier.statut === 'EXAMINE') {
                  <strong>L'examen déjà produit (et son éventuel projet de PV) sera supprimé.</strong>
                }
                Le Membre sera notifié.
              </p>
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="fermerRetrait()">Annuler</button>
            <button type="button" class="btn btn-danger" [disabled]="retraitEnCours()" (click)="confirmerRetrait()">
              {{ retraitEnCours() ? 'Retrait…' : estRendu(r.a) ? 'Rendre le dossier' : 'Retirer le dossier' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    /* Accent corail de la maquette (nom, bouton) — barres de types en palette assortie. */
    .dpc { --dpc-accent: #e8687e; display: flex; flex-direction: column; gap: 1.15rem; margin-top: 1rem; padding-top: 1.25rem; border-top: 1px solid var(--n-200); }
    .dpc__titre { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--n-800); }
    .dpc__intro { margin: -0.4rem 0 0; color: var(--n-500); }
    .dpc__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.9rem; }

    /* Grille responsive : cartes étroites à largeur fixe (15rem), centrées ; pleine largeur en mobile. */
    .dpc__grid { display: grid; grid-template-columns: repeat(auto-fit, 15rem); gap: 1.15rem; justify-content: center; }
    @media (max-width: 40rem) { .dpc__grid { grid-template-columns: 1fr; } }

    .dpc__card { position: relative; display: flex; flex-direction: column; gap: 0.45rem; background: #fff; border: 1px solid var(--n-100); border-radius: 16px; box-shadow: 0 10px 28px rgba(30, 41, 59, 0.08); padding: 1.1rem 1.1rem 1.25rem; transition: var(--transition); }
    .dpc__card:hover { transform: translateY(-3px); box-shadow: 0 14px 34px rgba(30, 41, 59, 0.12); }

    /* Photo du membre : cercle à anneau (couleur de la palette), centré — carte compacte. */
    .dpc__avatar { width: 8.5rem; height: 8.5rem; margin: 0.85rem auto 0.35rem; border-radius: 50%; border: 4px solid #fff; display: flex; align-items: center; justify-content: center; color: #fff; overflow: hidden; }
    .dpc__avatar--0 { background: linear-gradient(160deg, #e8687e, #f29cab); box-shadow: 0 0 0 5px #e8687e, 0 8px 18px rgba(30, 41, 59, 0.14); }
    .dpc__avatar--1 { background: linear-gradient(160deg, #f0a05a, #f6c489); box-shadow: 0 0 0 5px #f0a05a, 0 8px 18px rgba(30, 41, 59, 0.14); }
    .dpc__avatar--2 { background: linear-gradient(160deg, #7b85d4, #a3abe8); box-shadow: 0 0 0 5px #7b85d4, 0 8px 18px rgba(30, 41, 59, 0.14); }
    .dpc__avatar--3 { background: linear-gradient(160deg, #38b2a0, #7bd4c6); box-shadow: 0 0 0 5px #38b2a0, 0 8px 18px rgba(30, 41, 59, 0.14); }
    .dpc__initiales { font-size: 2.4rem; font-weight: 800; letter-spacing: 0.04em; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.14); }
    .dpc__photo { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .dpc__rank { position: absolute; top: 0.75rem; left: 0.75rem; z-index: 1; background: #fff; color: var(--n-700); font-size: 0.72rem; font-weight: 800; padding: 0.16rem 0.55rem; border-radius: var(--radius-full); border: 1px solid var(--n-100); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12); }

    .dpc__role { margin-top: 0.4rem; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--n-400); text-align: center; }
    .dpc__nom { margin: 0; font-size: 1.3rem; font-weight: 800; line-height: 1.15; color: var(--dpc-accent); text-align: center; }
    .dpc__total { display: flex; align-items: baseline; justify-content: center; gap: 0.4rem; }
    .dpc__total-nb { font-size: 1.9rem; font-weight: 800; color: var(--n-800); font-variant-numeric: tabular-nums; }
    .dpc__total-lbl { font-size: var(--text-sm); color: var(--n-400); }

    .dpc__types { list-style: none; margin: 0.15rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .dpc__type-head { display: flex; justify-content: space-between; gap: 0.5rem; font-size: var(--text-sm); color: var(--n-700); }
    .dpc__type-nb { font-weight: 800; font-variant-numeric: tabular-nums; }
    .dpc__tbar { margin-top: 0.28rem; height: 5px; border-radius: var(--radius-full); background: var(--n-100); overflow: hidden; }
    .dpc__tbar-fill { display: block; height: 100%; border-radius: var(--radius-full); transition: width 300ms var(--ease-out); }
    .dpc__tbar--0 { background: #e8687e; }
    .dpc__tbar--1 { background: #f0a05a; }
    .dpc__tbar--2 { background: #7b85d4; }
    .dpc__tbar--3 { background: #38b2a0; }
    .dpc__tbar--4 { background: #b187c9; }

    .dpc__voir { margin-top: 0.6rem; padding: 0.5rem 0.75rem; border-radius: var(--radius-full); border: 1.5px solid var(--dpc-accent); background: #fff; color: var(--dpc-accent); font-weight: 700; cursor: pointer; transition: var(--transition); }
    .dpc__voir:hover { background: var(--dpc-accent); color: #fff; }

    .dpc__detail-titre { padding: 0.85rem 1rem 0; font-weight: 700; color: var(--n-800); }
    .dpc__actions-end { justify-content: flex-end; }
    .dpc__confirm { max-width: 28rem; }
    .dpc__confirm-hint { margin: 0.5rem 0 0; color: var(--n-500); font-size: var(--text-sm); }
    /* Brouillon d'examen (couleur « en cours » de l'examen : indigo). */
    .dpc__brouillon { margin-left: 0.4rem; background: #E0E7FF; color: #4338CA; border: 1px solid #C7D2FE; }
    .dpc__empty { grid-column: 1 / -1; text-align: center; color: var(--n-400); padding: 1.5rem; background: #fff; border: 1px dashed var(--n-200); border-radius: 16px; }
  `,
})
export class DispatchsControleurs implements OnDestroy {
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly examenService = inject(ExamenService);
  private readonly controleurService = inject(ControleurService);
  private readonly profileService = inject(ProfileService);
  private readonly delegationProfilService = inject(DelegationProfilService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly permissions = inject(PermissionsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  /** Échec du croisement : la section affiche l'erreur et propose de relancer (AUDIT.md P9). */
  readonly erreur = signal(false);
  readonly lignes = signal<LigneControleur[]>([]);
  /** Contrôleur dont la liste des dossiers est dépliée (im), null = tout replié. */
  readonly ouvert = signal<string | null>(null);
  readonly consulte = signal<Dossier | null>(null);
  /** Attribution dont la confirmation de retrait est ouverte (null = fermée). */
  readonly retrait = signal<{ a: DossierAttribue; nom: string } | null>(null);
  readonly retraitEnCours = signal(false);
  /** Carte du contrôleur déplié (détail affiché sous la grille). */
  readonly ligneOuverte = computed(() => this.lignes().find((l) => l.im === this.ouvert()) ?? null);

  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  /** im → object-URL de la photo (`GET /api/controleurs/{id}/pieces/PHOTO`) ; absent = repli initiales. */
  private readonly photos = signal<Map<string, string>>(new Map());
  /** idDossier avec examen commencé (brouillon si le dossier est encore DISPATCHE) → badge « Examen en cours ». */
  readonly dossiersAvecExamen = signal<Set<number>>(new Set());

  /** Dossiers distincts dispatchés (un dossier compté une fois, même partagé Membre + CC). */
  readonly totalDossiers = computed(() => {
    const ids = new Set<number>();
    for (const l of this.lignes()) for (const a of l.dossiers) ids.add(a.dossier.idDossier);
    return ids.size;
  });

  constructor() {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.charger();
    // Mutation signalée (ex. dispatch depuis le drill-down au-dessus) → statistique à jour sans navigation.
    toObservable(this.dossiersRefresh.revision)
      .pipe(skip(1), takeUntilDestroyed())
      .subscribe(() => this.charger());
  }

  /**
   * ⚠️ Audit 2026-08-27 (C-1) — cette statistique croisait SEPT listes complètes. Deux réductions
   * étaient possibles sans rien ajouter au serveur ; les autres listes restent telles quelles.
   *
   * 1. Les dossiers ne sont plus demandés en entier : seuls ceux qui sont ENCORE EN COURS côté
   *    commission entrent dans le décompte (`STATUTS_EN_COURS` ci-dessous, filtre jusqu'ici posé en
   *    JavaScript sur toute la table). `?statut=` sait le faire en SQL — brouillons, dossiers
   *    clôturés, retirés et tout l'historique ne traversent plus le réseau. Deux requêtes plutôt
   *    qu'une, mais d'un volume sans commune mesure, et le résultat est identique au dossier près.
   * 2. Les examens sont DIFFÉRÉS (voir `chargerExamensEnCours`) : ils n'alimentent qu'un badge.
   *
   * <b>Ce qu'il resterait à faire côté serveur.</b> Réceptions et dispatchs restent demandés en
   * entier : l'attribution courante d'un dossier, c'est son DERNIER dispatch, et le lien dispatch →
   * dossier passe par la réception — deux jointures que seul le serveur peut faire. Un endpoint qui
   * rendrait directement les attributions en cours (contrôleur, dossier, date du dernier dispatch,
   * examen commencé) remplacerait à lui seul les six listes restantes. `/api/receptions` accepte un
   * `idDossier` unique, ce qui n'aide pas ici : ce serait une requête par dossier.
   */
  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    forkJoin({
      dossiersDispatches: this.dossierService.list('DISPATCHE'),
      dossiersExamines: this.dossierService.list('EXAMINE'),
      receptions: this.receptionService.list(),
      dispatchs: this.dispatchService.list(),
      controleurs: this.controleurService.list(),
      profiles: this.profileService.list(),
      delegations: this.delegationProfilService.list(),
    }).subscribe({
      next: ({ dossiersDispatches, dossiersExamines, receptions, dispatchs, controleurs, profiles, delegations }) => {
        const dossierById = new Map([...dossiersDispatches, ...dossiersExamines].map((d) => [d.idDossier, d]));
        const recDossier = new Map(receptions.map((r) => [r.idReception, r.idDossier]));
        // Dernier dispatch par dossier (attribution courante — même règle que le drill-down circuit).
        const dernier = new Map<number, (typeof dispatchs)[number]>();
        for (const disp of dispatchs) {
          const idDossier = recDossier.get(disp.idReception);
          if (idDossier == null) continue;
          const prec = dernier.get(idDossier);
          if (!prec || (disp.dateDispatch ?? '') >= (prec.dateDispatch ?? '')) dernier.set(idDossier, disp);
        }
        const profilLib = new Map(profiles.map((p) => [p.idProfile, p.profile ?? '']));
        const ctrlById = new Map<string, Controleur>(controleurs.map((c) => [c.imControleur, c]));
        const parControleur = new Map<string, DossierAttribue[]>();
        // Un dossier sort de la statistique dès la signature de son PV définitif (PV_SIGNE et au-delà) :
        // seuls les dossiers encore en cours côté commission comptent (DISPATCHE / EXAMINE).
        // ⚠️ Ce prédicat est désormais appliqué CÔTÉ SERVEUR (les deux `list(statut)` ci-dessus) ;
        // il reste ici comme garde — `dossierById` ne contient plus rien d'autre.
        const STATUTS_EN_COURS = new Set(['DISPATCHE', 'EXAMINE']);
        // §3.5 — un CC / Président n'exerce la tâche du Membre que par DÉLÉGATION DE PROFIL active :
        // sans délégation « son profil → Membre » active, ses attributions ne sont pas affichées.
        const idProfileMembre = profiles.find((p) => /membre/i.test(p.profile ?? ''))?.idProfile;
        const delegantsMembre = new Set(
          delegations.filter((d) => d.actif && d.idProfileDelegue === idProfileMembre).map((d) => d.idProfileDelegant),
        );
        const estAffichable = (im: string): boolean => {
          const idProfile = ctrlById.get(im)?.idProfile;
          if (idProfile == null) return false;
          return idProfile === idProfileMembre || delegantsMembre.has(idProfile);
        };
        const ajouter = (im: string | undefined, idDossier: number, disp: (typeof dispatchs)[number]) => {
          const dossier = im ? dossierById.get(idDossier) : undefined;
          if (!im || !dossier || !estAffichable(im) || !STATUTS_EN_COURS.has(dossier.statut ?? '')) return;
          const liste = parControleur.get(im) ?? [];
          liste.push({ dossier, dispatch: disp, idDispatch: disp.idDispatch, dateDispatch: disp.dateDispatch });
          parControleur.set(im, liste);
        };
        // ⚠️ 2026-08-17 (demande user) — SEULE la part attributaire (`imCtrlMembre`) est comptée.
        // `imCtrlCc` n'est pas une attribution : c'est la COPIE adressée au Chef de commission
        // quand le Président dispatche à un Membre. La compter faisait apparaître le même dossier
        // sur deux cartes et doublait le total (1 dossier → « 1 dispatché, 2 contrôleurs »).
        // Un CC ou un Président qui s'attribue le dossier (« moi-même ⤴ ») est porté par
        // `imCtrlMembre` : il reste donc compté, à juste titre.
        for (const [idDossier, disp] of dernier) {
          ajouter(disp.imCtrlMembre, idDossier, disp);
        }
        // Brouillons d'examen (dossier encore DISPATCHE mais examen commencé) → badge « Examen en cours ».
        // Demandés APRÈS coup : les attendre retardait toutes les cartes derrière une table entière.
        this.chargerExamensEnCours(new Map([...dernier.entries()].map(([idD, disp]) => [disp.idDispatch, idD])));
        const lignes: LigneControleur[] = [...parControleur.entries()].map(([im, liste]) => {
          const c = ctrlById.get(im);
          return {
            im,
            nom: c ? [c.nomCont, c.prenomsCont].filter(Boolean).join(' ') || im : im,
            prenom: c?.prenomsCont || c?.nomCont || im,
            profil: c?.idProfile != null ? profilLib.get(c.idProfile) ?? '—' : '—',
            dossiers: [...liste].sort((a, b) => (b.dateDispatch ?? '').localeCompare(a.dateDispatch ?? '')),
          };
        });
        // Tri par nombre total de dossiers, décroissant (rang #1, #2, …).
        lignes.sort((a, b) => b.dossiers.length - a.dossiers.length || a.nom.localeCompare(b.nom));
        this.lignes.set(lignes);
        this.loading.set(false);
        // Photos des contrôleurs affichés (une requête binaire par carte, 404 = repli initiales) ;
        // déjà téléchargée (rechargement via revision) → conservée, pas de nouvelle requête.
        for (const l of lignes) {
          if (this.photos().has(l.im)) continue;
          this.controleurService.downloadPhoto(l.im).subscribe({
            next: (blob) => this.photos.update((m) => new Map(m).set(l.im, urlBlobSure(blob))),
            error: () => {},
          });
        }
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  /**
   * Badge « Examen en cours » : dossiers encore DISPATCHE dont un examen est commencé.
   *
   * Chargé HORS du croisement principal — il ne conditionne qu'un badge, et l'échec le laisse
   * simplement absent. `GET /api/examens` n'accepte aucun filtre : la liste arrive entière.
   */
  private chargerExamensEnCours(dossierParDispatch: Map<number, number>): void {
    this.examenService.list().subscribe({
      next: (examens) => {
        const avecExamen = new Set<number>();
        for (const e of examens) {
          const idD = e.idDispatch != null ? dossierParDispatch.get(e.idDispatch) : undefined;
          if (idD != null) avecExamen.add(idD);
        }
        this.dossiersAvecExamen.set(avecExamen);
      },
      error: () => this.dossiersAvecExamen.set(new Set()),
    });
  }

  ngOnDestroy(): void {
    for (const url of this.photos().values()) URL.revokeObjectURL(url);
  }

  photoDe(im: string): string | null {
    return this.photos().get(im) ?? null;
  }

  basculer(im: string): void {
    this.ouvert.set(this.ouvert() === im ? null : im);
  }
  /**
   * « Retirer » offert ? (DISPATCH_WRITE ; les dossiers listés sont tous DISPATCHE/EXAMINE, donc
   * annulables). ⚠️ Demande pilote (2026-09-03) : le CC ne retire QUE les dossiers qu'il a
   * lui-même dispatchés (dispatcheur = lui) — un dispatch du Président ne se retire pas sous lui ;
   * il peut en revanche l'examiner ou le réattribuer. Le Président n'est pas restreint.
   */
  peutRetirer(a: DossierAttribue): boolean {
    if (!this.permissions.can('DISPATCH_WRITE')) return false;
    if (this.auth.role() !== 'CHEF_COMMISSION') return true;
    // CC : uniquement la REPRISE d'un dossier qu'il a confié à un Membre — jamais d'auto-retrait
    // de sa propre attribution, même s'il en est devenu le dispatcheur via une reprise (2026-09-03).
    return a.dispatch.imCtrlDispatch === this.auth.ref() && a.dispatch.imCtrlMembre !== this.auth.ref();
  }
  /** Le retrait est-il une REPRISE ? (CC retirant un dossier confié à un Membre — il lui revient.) */
  estReprise(a: DossierAttribue): boolean {
    return this.auth.role() === 'CHEF_COMMISSION' && a.dispatch.imCtrlMembre !== this.auth.ref();
  }
  /** Le retrait est-il un RENVOI de MA propre attribution ? (rendre au pré-dispatch.) */
  estRendu(a: DossierAttribue): boolean {
    return a.dispatch.imCtrlMembre === this.auth.ref();
  }
  /** Animation de sortie du modal de retrait. */
  readonly closingRetrait = signal(false);
  /** Ferme le modal de retrait en jouant l'animation de sortie. */
  fermerRetrait(): void {
    fermerAvecAnimation(this.closingRetrait, () => this.retrait.set(null));
  }

  /**
   * Confirme le retrait — trois gestes (demandes pilote 2026-09-03) :
   * - REPRISE (CC × dossier confié à un Membre) : réattribution à soi-même (PUT, dossier toujours
   *   DISPATCHE, retour dans SA file « À examiner ») — il ne repart PAS chez le Président ;
   * - RENDU (attributaire = moi) : annulation — le dossier retourne en pré-dispatch ;
   * - ANNULATION classique (Président × dossier attribué à autrui) : retour PRET_DISPATCH.
   */
  confirmerRetrait(): void {
    const r = this.retrait();
    if (!r) return;
    this.retraitEnCours.set(true);
    const fin = (message: string | null) => {
      if (message) this.toast.success(message);
      this.retraitEnCours.set(false);
      this.retrait.set(null);
      // La notification recharge cette stat (abonnement revision) + classement + badges.
      // En erreur (404/409 : état changé ailleurs), le toast centralisé a déjà parlé — on resynchronise.
      this.dossiersRefresh.notifierChangement();
    };
    if (this.estReprise(r.a)) {
      const moi = this.auth.ref();
      const body: Dispatch = {
        ...r.a.dispatch,
        imCtrlDispatch: moi ?? r.a.dispatch.imCtrlDispatch,
        imCtrlCc: undefined,
        imCtrlMembre: moi ?? undefined,
        dateDispatch: new Date().toISOString().slice(0, 10),
      };
      this.dispatchService.update(r.a.dispatch.idDispatch, body).subscribe({
        next: () => fin('Dossier repris : de retour dans vos dossiers à examiner.'),
        error: () => fin(null),
      });
      return;
    }
    this.dispatchService.annuler(r.a.idDispatch).subscribe({
      next: () => fin(this.estRendu(r.a) ? 'Dossier rendu : de retour en pré-dispatch.' : 'Dossier retiré : de retour en pré-dispatch.'),
      error: () => fin(null),
    });
  }
  /** Initiales de l'avatar (deux premiers mots du nom). */
  initiales(nom: string): string {
    return nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((m) => m[0].toUpperCase())
      .join('');
  }
  /** Répartition des dossiers du contrôleur par type (libellé + compte + % du total), décroissante. */
  typesDe(l: LigneControleur): { libelle: string; count: number; pct: number }[] {
    const compte = new Map<string, number>();
    for (const a of l.dossiers) {
      const lib = this.typeLabel(a.dossier);
      compte.set(lib, (compte.get(lib) ?? 0) + 1);
    }
    return [...compte.entries()]
      .map(([libelle, count]) => ({ libelle, count, pct: (count / l.dossiers.length) * 100 }))
      .sort((a, b) => b.count - a.count);
  }
  typeLabel(d: Dossier): string {
    return d.idTypeDossier ? this.typeMap().get(d.idTypeDossier) ?? d.idTypeDossier : '—';
  }
  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract : '—';
  }
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }
}
