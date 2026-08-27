import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { skip } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { VacanceStore } from '../../core/vacance/vacance.store';
import { Dossier, Page } from '../../models';
import {
  DossierService,
  EntiteContractService,
  LocaliteService,
  MarcheService,
  PpmService,
  ReferenceLookupService,
  SousTypeDossierService,
  TypeDossierService,
} from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { DetailPpmModal } from '../../shared/prmp';
import { StatutBadge } from '../../shared/circuit';
import { CompleterPiecesDepotModal } from './completer-pieces-depot-modal';
import { DossiersRefreshStore } from './dossiers-refresh.store';

/** Groupe de statut du menu « Mes dossiers » : brouillons vs tout ce qui est soumis (non brouillon). */
type Groupe = 'brouillon' | 'soumis';

/**
 * Liste des dossiers d'un **type** donné (référentiel `type-dossier`) filtrés par **groupe de statut**
 * (`brouillon` = BROUILLON ; `soumis` = tout sauf BROUILLON). Route : `/prmp/dossiers/:type/:groupe`.
 * Écran générique du menu « Mes dossiers » (arborescence type → statut construite dynamiquement).
 *
 * Liste = `GET /api/dossiers` (déjà scopé à la PRMP propriétaire par le backend), filtrée côté client
 * par type + statut. Pour un brouillon : ouvrir/soumettre/supprimer ; pour un dossier soumis : consulter.
 */
@Component({
  selector: 'app-dossiers-liste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DetailPpmModal, EtatErreur, ModaleDirective, StatutBadge, CompleterPiecesDepotModal],
  template: `
    <section>
      <header class="page-header page-header--actions" [class.page-header--colle]="encastre">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">{{ titre() }}</h1>
        </div>
        <a class="btn btn-retour-hub" routerLink="/prmp/dossiers">← Mes dossiers</a>
      </header>

      @if (premierChargement()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger vos dossiers." (reessayer)="charger()" />
      } @else {
        <div class="table-card" [class.dl-chargement]="chargement()">
          <table>
            <thead>
              <tr>
                <th scope="col">Référence</th><th scope="col">Entité contractante</th><th scope="col">Statut</th><th scope="col">Sous-type</th><th scope="col">Localité</th><th scope="col" class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of dossiers(); track d.idDossier) {
                <tr [id]="'dl-row-' + d.idDossier" [class.dl-row-focus]="d.idDossier === focusId()">
                  <td>{{ reference(d) }}</td>
                  <td>{{ entiteLabel(d) }}</td>
                  <td>@if (d.statut) { <app-statut-badge [statut]="d.statut" /> } @else { — }</td>
                  <td>{{ sousTypeLabel(d) }}</td>
                  <td>{{ localiteLabel(d) }}</td>
                  <td>
                    <div class="td-actions actions-end">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrir(d)">Ouvrir</button>
                      <!-- ⚠️ Spec recevabilité : le Secrétaire a signalé des pièces manquantes au dépôt. -->
                      @if (d.statut === 'EN_ATTENTE_COMPLEMENTS_DEPOT' && estPrmp()) {
                        <button type="button" class="btn btn-warning btn-sm" (click)="completer.set(d)">Compléter les pièces</button>
                      }
                      @if (groupe() === 'brouillon') {
                        <!-- Soumission réservée à la PRMP ; l'UGPM ouvre/édite mais ne soumet pas (backend 403). -->
                        @if (estPrmp()) {
                          <button
                            type="button"
                            class="btn btn-success btn-sm"
                            [disabled]="submittingId() === d.idDossier || ppmManquant(d) || vacance()"
                            [title]="vacance() ? 'Poste PRMP vacant — soumission suspendue en attente de nomination.' : ppmManquant(d) ? 'Impossible de soumettre : aucun PPM rattaché. Ouvrez le dossier pour ajouter un PPM.' : ''"
                            (click)="soumettre(d)"
                          >
                            Soumettre
                          </button>
                        }
                        <button
                          type="button"
                          class="btn btn-danger btn-sm"
                          [disabled]="suppression() === d.idDossier"
                          (click)="demanderSuppression(d)"
                        >
                          Supprimer
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="empty-cell">{{ messageVide() }}</td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (totalPages() > 1) {
          <nav class="dl-pager" aria-label="Pages de la liste">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              [disabled]="pageIndex() === 0 || chargement()"
              (click)="pagePrecedente()"
            >
              Précédent
            </button>
            <span class="dl-pager__info" aria-live="polite">
              @if (chargement()) { Chargement… } @else { Page {{ pageIndex() + 1 }} / {{ totalPages() }} }
            </span>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              [disabled]="pageIndex() + 1 >= totalPages() || chargement()"
              (click)="pageSuivante()"
            >
              Suivant
            </button>
          </nav>
          <!-- Limite assumée : voir chargerPage — le serveur ne sait filtrer qu'un statut EXACT. -->
          @if (groupe() === 'soumis') {
            <p class="dl-pager__limite">
              Les brouillons sont écartés page par page : une page peut compter moins de {{ pageSize }} lignes,
              et le nombre de pages est un majorant.
            </p>
          }
        }
      }
    </section>

    @if (confirmDossier(); as d) {
      <div class="modal-backdrop" [class.closing]="closingSuppression()">
        <div class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label="Confirmation de suppression" appModale appModaleClicExterieur (appModaleFermer)="annulerSuppression()">
          <div class="modal-header-plain">
            <span class="modal-title">Supprimer ce dossier ?</span>
            <button type="button" class="btn-close-plain" aria-label="Fermer" [disabled]="suppression() !== null" (click)="annulerSuppression()">✕</button>
          </div>
          <div class="modal-body">
            <p>Êtes-vous sûr de vouloir supprimer ce dossier ? Cette action est irréversible.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" [disabled]="suppression() !== null" (click)="annulerSuppression()">
              Annuler
            </button>
            <button type="button" class="btn btn-danger" [disabled]="suppression() !== null" (click)="confirmerSuppression()">
              {{ suppression() !== null ? 'Suppression…' : 'Confirmer' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (detail(); as d) {
      <app-detail-ppm-modal
        [idDossier]="d.idDossier"
        [idPpm]="d.idPpm"
        [modeEdition]="groupe() === 'brouillon'"
        (fermer)="fermerDetail()"
        (modifie)="onModifie()"
      />
    }

    @if (completer(); as d) {
      <app-completer-pieces-depot-modal [dossier]="d" (transmis)="onComplementsTransmis()" (fermer)="completer.set(null)" />
    }
  `,
  styles: `
    .actions-end { justify-content: flex-end; }
    .empty-cell { text-align: center; color: var(--n-400); padding: 1.5rem; }
    .confirm-modal { max-width: 28rem; }
    /* Changement de page : le tableau reste à l'écran, estompé — le remplacer par « Chargement… »
       ferait sauter la mise en page à chaque clic sur le pager. */
    .dl-chargement { opacity: 0.55; transition: opacity 0.15s ease; }
    .dl-pager {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 1rem;
    }
    .dl-pager__info { font-size: var(--text-sm); color: var(--n-500); font-weight: 600; }
    .dl-pager__limite {
      margin: 0.4rem 0 0;
      text-align: center;
      font-size: var(--text-sm);
      color: var(--n-500);
    }
    /* Ligne ciblée par la recherche topbar : flash bleu puis surlignage doux persistant. */
    .dl-row-focus > td { animation: dl-flash 1.8s ease; background: rgba(2, 132, 199, 0.06); }
    @keyframes dl-flash {
      0%, 30% { background: rgba(2, 132, 199, 0.28); }
      100% { background: rgba(2, 132, 199, 0.06); }
    }
  `,
})
export class DossiersListe {
  private readonly route = inject(ActivatedRoute);
  /** Rendu SOUS les cartes de « Mes dossiers » (route enfant) : l'en-tête se colle alors sous la
   *  topbar pour que le bouton de retour ne bouge pas quand la liste défile. */
  protected readonly encastre = this.route.snapshot.data['encastre'] === true;
  private readonly dossierService = inject(DossierService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly toast = inject(ToastService);
  private readonly vacanceStore = inject(VacanceStore);
  /** Vacance du poste PRMP (spec « Mandats PRMP ») — soumission suspendue. */
  readonly vacance = this.vacanceStore.vacance;
  private readonly router = inject(Router);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly auth = inject(AuthService);
  readonly estPrmp = computed(() => this.auth.role() === 'PRMP');

  /** Type de dossier (idTypeDossier) et groupe de statut, lus dans l'URL (réactifs aux changements de menu). */
  readonly type = signal<string>('');
  readonly groupe = signal<Groupe>('brouillon');

  readonly dossiers = signal<Dossier[]>([]);
  /** Un chargement de page est en cours (estompe le tableau, désactive le pager). */
  readonly chargement = signal(false);
  /** Une page a déjà été rendue — distingue le premier chargement d'un changement de page. */
  private readonly dejaCharge = signal(false);
  /** Premier chargement de l'écran : le tableau n'existe pas encore, on affiche « Chargement… ». */
  readonly premierChargement = computed(() => this.chargement() && !this.dejaCharge());
  /** Échec du chargement de la liste (affiche l'erreur + « Réessayer »). */
  readonly erreur = signal(false);

  // ── Pagination serveur (`GET /api/dossiers?page=&size=`, livraison backend 1a83b05) ──
  /** Taille de page demandée au serveur ; lue par le gabarit pour expliquer la limite du groupe « soumis ». */
  protected readonly pageSize = 20;
  /** Index (0-based) de la page affichée. */
  readonly pageIndex = signal(0);
  /** Nombre de pages annoncé par le serveur (0 tant qu'aucune page n'est chargée). */
  readonly totalPages = signal(0);
  /** idDossier à mettre en évidence (arrivée depuis la recherche topbar `?focus=`) ; null = aucun. */
  readonly focusId = signal<number | null>(null);
  readonly submittingId = signal<number | null>(null);
  readonly confirmDossier = signal<Dossier | null>(null);
  readonly suppression = signal<number | null>(null);
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  /** idSousType → libellé (référentiel sous-type-dossiers, un seul chargement). */
  private readonly sousTypeMap = signal<Map<string, string>>(new Map());
  /** idEntiteContract → libellé (référentiel entités contractantes, un seul chargement). */
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly ppmRef = signal<Map<number, string>>(new Map());
  /** idDossier → idPpm (via `GET /api/marches`, MarcheDto portant idPpm) pour ouvrir le détail PPM. */
  private readonly ppmParDossier = signal<Map<number, number>>(new Map());
  /** idDossier → idPpm depuis la LISTE DES PPM (couvre les PPM sans marché — ⚠️ correctif 2026-08-02). */
  private readonly ppmIdParDossier = signal<Map<number, number>>(new Map());

  readonly detail = signal<{ idDossier: number; idPpm: number } | null>(null);
  /** Dossier ouvert dans le modal « Compléter les pièces » (EN_ATTENTE_COMPLEMENTS_DEPOT ; null = fermé). */
  readonly completer = signal<Dossier | null>(null);

  /** Compléments transmis : ferme le modal et recharge la liste (statut revenu SOUMIS). */
  onComplementsTransmis(): void {
    this.completer.set(null);
    this.rafraichir();
  }

  /** Libellé du type courant (référentiel), repli sur l'id. */
  readonly typeLabel = computed(() => this.typeMap().get(this.type()) ?? this.type());
  readonly titre = computed(() => `${this.typeLabel()} — ${this.groupe() === 'brouillon' ? 'Brouillons' : 'Déposés'}`);
  readonly messageVide = computed(() =>
    this.groupe() === 'brouillon'
      ? 'Aucun brouillon de ce type. Saisissez un dossier depuis « Saisir & soumettre ».'
      : 'Aucun dossier déposé de ce type.',
  );

  constructor() {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(SousTypeDossierService, 'idSousType', ['libelleSousType']).subscribe((m) => this.sousTypeMap.set(m));
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    // Réagit aux changements d'URL (navigation entre entrées du menu, même composant réutilisé).
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.type.set(p.get('type') ?? '');
      this.groupe.set(p.get('groupe') === 'soumis' ? 'soumis' : 'brouillon');
      this.charger();
    });
    // Mise en évidence d'un dossier arrivé depuis la recherche topbar (`?focus=`).
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      const f = q.get('focus');
      this.focusId.set(f ? Number(f) : null);
    });
    // Recharge quand un autre écran signale un changement (suppression, soumission…).
    // skip(1) : le chargement initial est déjà déclenché par paramMap ci-dessus — un effect
    // s'exécutant aussi au premier cycle, chaque montage lançait les 3 requêtes deux fois.
    // ⚠️ On rafraîchit la page COURANTE : un retour en page 1 déplacerait l'utilisateur sous ses yeux.
    toObservable(this.dossiersRefresh.revision)
      .pipe(skip(1), takeUntilDestroyed())
      .subscribe(() => this.rafraichir());
  }

  /**
   * Chargement complet de l'écran : référentiels d'appoint + première page.
   * Public : rejoué tel quel par le bouton « Réessayer » de l'état d'erreur (AUDIT.md P9).
   *
   * ⚠️ Audit 2026-08-27 (C-1) — la liste est désormais PAGINÉE par le serveur ; les deux
   * référentiels d'appoint (PPM, marchés) ne sont chargés qu'ICI, une fois par écran : les tourner
   * de page en page les aurait retéléchargés à chaque clic.
   */
  charger(): void {
    const type = this.type();
    if (!type) return;
    this.dejaCharge.set(false);
    this.chargerPage(0, true);
    this.ppmService.list().subscribe((ppms) => {
      this.ppmRef.set(new Map(ppms.map((p) => [p.idDossier, p.reference])));
      this.ppmIdParDossier.set(new Map(ppms.map((p) => [p.idDossier, p.idPpm])));
    });
    this.marcheService.list().subscribe((marches) => {
      const ids = new Map<number, number>();
      for (const m of marches) ids.set(m.idDossier, m.idPpm);
      this.ppmParDossier.set(ids);
    });
  }

  /** Recharge la page affichée, sans retoucher aux référentiels d'appoint (après une mutation). */
  private rafraichir(): void {
    if (this.type()) {
      this.chargerPage(this.pageIndex());
    }
  }

  /**
   * Charge une page de `GET /api/dossiers?page=&size=&type=[&statut=]` (tri idDossier croissant
   * imposé par le serveur).
   *
   * <b>Filtres.</b> La FAMILLE (`type`) et, pour les brouillons, le STATUT sont passés au serveur :
   * ils y sont appliqués en SQL, donc le découpage et les compteurs de pages sont exacts.
   *
   * <b>Limite assumée.</b> Le groupe « soumis » signifie « tout SAUF brouillon », que `?statut=`
   * (égalité stricte) ne sait pas exprimer : ce seul prédicat reste appliqué CÔTÉ CLIENT, sur la
   * page courante. Conséquences, dites à l'écran : une page peut afficher moins de `pageSize`
   * lignes, et `totalPages` majore le nombre réel de pages. La sémantique de la liste, elle, est
   * intacte — aucun brouillon n'est jamais montré dans « Déposés ».
   */
  private chargerPage(page: number, chercherFocus = false): void {
    if (!this.type()) return;
    this.chargement.set(true);
    this.erreur.set(false);
    this.dossierService.listePage(page, this.pageSize, this.filtresServeur()).subscribe({
      next: (p) => {
        this.appliquerPage(p);
        // Le dossier mis en évidence peut se trouver sur une AUTRE page que la première : on va le
        // chercher (voir `positionnerSurFocus`) plutôt que de le laisser silencieusement invisible.
        const fid = this.focusId();
        if (chercherFocus && fid != null && !p.content.some((d) => d.idDossier === fid) && p.totalPages > 1) {
          this.positionnerSurFocus(fid, 1, p.totalPages - 1);
        }
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  /** Filtres transmis au serveur pour la liste courante (cf. la limite du groupe « soumis »). */
  private filtresServeur(): Record<string, string> {
    const type = this.type();
    return this.groupe() === 'brouillon' ? { type, statut: 'BROUILLON' } : { type };
  }

  /** Installe une page reçue : contenu (filtre client du groupe « soumis »), position, total. */
  private appliquerPage(p: Page<Dossier>): void {
    const brouillon = this.groupe() === 'brouillon';
    this.dossiers.set(brouillon ? p.content : p.content.filter((d) => d.statut !== 'BROUILLON'));
    this.pageIndex.set(p.number);
    this.totalPages.set(p.totalPages);
    this.chargement.set(false);
    this.dejaCharge.set(true);
    // Défile vers le dossier mis en évidence (recherche topbar), après rendu de la ligne.
    const fid = this.focusId();
    if (fid != null) {
      setTimeout(() => document.getElementById('dl-row-' + fid)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    }
  }

  /**
   * Ouvre la page qui contient le dossier arrivé de la recherche topbar (`?focus=`).
   *
   * Avant la pagination, la liste entière était à l'écran : le dossier cherché y était forcément.
   * Une page ne le contient plus qu'une fois sur N — sans quoi la recherche mènerait à une liste
   * où la ligne promise est absente. Le serveur trie par `idDossier` CROISSANT (tri imposé,
   * cf. `Pagination.page`) : les pages sont donc ordonnées par identifiant, et une **dichotomie**
   * trouve la bonne en log₂(N) requêtes d'une page — sans jamais retélécharger la table.
   *
   * Échec silencieux si l'intervalle se referme (dossier disparu entre-temps, ou écarté par le
   * filtre client du groupe « soumis ») : la page déjà affichée reste, simplement sans surlignage.
   */
  private positionnerSurFocus(fid: number, bas: number, haut: number): void {
    if (bas > haut) return;
    const milieu = Math.floor((bas + haut) / 2);
    this.chargement.set(true);
    this.dossierService.listePage(milieu, this.pageSize, this.filtresServeur()).subscribe({
      next: (p) => {
        const ids = p.content.map((d) => d.idDossier);
        const premier = ids[0];
        const dernier = ids[ids.length - 1];
        if (premier === undefined || dernier === undefined) {
          this.chargement.set(false);
          return;
        }
        if (fid < premier) {
          this.positionnerSurFocus(fid, bas, milieu - 1);
        } else if (fid > dernier) {
          this.positionnerSurFocus(fid, milieu + 1, haut);
        } else {
          this.appliquerPage(p);
        }
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  pagePrecedente(): void {
    if (this.pageIndex() > 0) {
      this.chargerPage(this.pageIndex() - 1);
    }
  }
  pageSuivante(): void {
    if (this.pageIndex() + 1 < this.totalPages()) {
      this.chargerPage(this.pageIndex() + 1);
    }
  }

  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }
  /** Libellé du sous-type (repli sur le code ; « — » si non renseigné). */
  sousTypeLabel(d: Dossier): string {
    return d.idSousType ? this.sousTypeMap().get(d.idSousType) ?? d.idSousType : '—';
  }
  /** Libellé de l'entité contractante du dossier (repli sur l'id ; « — » si absente). */
  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract : '—';
  }
  reference(d: Dossier): string {
    return d.refeDossier || this.ppmRef().get(d.idDossier) || '—';
  }
  /** Dossier PPM sans contenu rattaché → soumission impossible (409, §3.1). */
  ppmManquant(d: Dossier): boolean {
    // ⚠️ Correctif (2026-08-02) : deux sources COMPLÉMENTAIRES — les marchés (couvrent les brouillons,
    // exclus de GET /api/ppms côté PRMP) et la liste des PPM (couvre les PPM sans ligne de marché).
    // Résiduel : un BROUILLON DDP sans marché reste signalé « sans PPM » (les deux sources muettes) —
    // le backend tranche de toute façon (400 explicite à la soumission).
    return (
      d.idTypeDossier === 'DDP' &&
      !this.ppmParDossier().has(d.idDossier) &&
      !this.ppmIdParDossier().has(d.idDossier)
    );
  }

  /**
   * « Ouvrir » : détail PPM dans le modal partagé (édition si brouillon, lecture sinon). Pour un dossier
   * **sans PPM** (DAO/MAOO), repli sur le formulaire d'édition — uniquement pertinent pour un brouillon.
   */
  ouvrir(d: Dossier): void {
    const idPpm = this.ppmParDossier().get(d.idDossier) ?? this.ppmIdParDossier().get(d.idDossier);
    if (idPpm != null) {
      this.detail.set({ idDossier: d.idDossier, idPpm });
    } else if (this.groupe() === 'brouillon') {
      this.router.navigate(['/prmp/soumettre-dossier'], { queryParams: { reprendre: d.idDossier } });
    } else {
      this.toast.info('Aucun détail à afficher pour ce dossier (pas de PPM rattaché).');
    }
  }
  fermerDetail(): void {
    this.detail.set(null);
  }
  /**
   * ⚠️ `notifierChangement()` suffit à recharger CET écran (il observe `revision`) : l'appel local
   * qui l'accompagnait doublait chaque rechargement après une modification.
   */
  onModifie(): void {
    this.dossiersRefresh.notifierChangement();
  }

  soumettre(d: Dossier): void {
    this.submittingId.set(d.idDossier);
    this.dossierService.soumettre(d.idDossier).subscribe({
      next: (res) => {
        this.toast.success(`Dossier soumis${res.refeDossier ? ' · réf. ' + res.refeDossier : ''}.`);
        this.submittingId.set(null);
        // Recharge la page courante par la révision partagée (même remarque que `onModifie`).
        this.dossiersRefresh.notifierChangement();
      },
      error: (e: ApiError) => {
        this.submittingId.set(null);
        // Pas de formulaire ici pour porter les fieldErrors (ex. AGPM sur « piecesJointes ») : le toast
        // centralisé est supprimé en 400 fieldErrors → on affiche nous-mêmes le détail du backend.
        const detail = e.fieldErrors ? Object.values(e.fieldErrors).join(' ') : '';
        this.toast.error(detail || e.message || 'Échec de la soumission.', 'Soumission impossible');
      },
    });
  }

  demanderSuppression(d: Dossier): void {
    this.confirmDossier.set(d);
  }
  /** Animation de sortie du modal de confirmation (voir `fermerAvecAnimation`). */
  readonly closingSuppression = signal(false);
  /** Ferme la confirmation en jouant l'animation de sortie — sans effet pendant la suppression. */
  annulerSuppression(): void {
    if (this.suppression() === null) {
      fermerAvecAnimation(this.closingSuppression, () => this.confirmDossier.set(null));
    }
  }
  confirmerSuppression(): void {
    const d = this.confirmDossier();
    if (!d) return;
    this.suppression.set(d.idDossier);
    this.dossierService.supprimer(d.idDossier).subscribe({
      next: () => {
        this.toast.success('Dossier supprimé avec succès.');
        this.dossiers.update((arr) => arr.filter((x) => x.idDossier !== d.idDossier));
        this.dossiersRefresh.notifierSuppression(d.idDossier);
        this.suppression.set(null);
        this.confirmDossier.set(null);
      },
      error: (e: ApiError) => {
        this.suppression.set(null);
        this.confirmDossier.set(null);
        this.toast.error(
          e.status === 403
            ? "Vous n'êtes pas autorisé à supprimer ce dossier."
            : e.status === 404
              ? 'Dossier introuvable.'
              : e.message || 'Erreur lors de la suppression.',
        );
      },
    });
  }
}
