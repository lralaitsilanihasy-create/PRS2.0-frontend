import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, combineLatest, distinctUntilChanged, finalize, forkJoin, map, of, startWith, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Dossier } from '../../../models';
import { DossierService } from '../../../services';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { Icone } from '../../../shared/ui/icone';
import { EtatGestes, classerEchecGestes } from './etape-courante-modele';
import { PageDossierCorps } from './page-dossier-corps';
import { EchecOuverture, SuiteGeste, classerEchec, lireIdDossier, retourPage } from './page-dossier-modele';

/** `retire` : relecture refusée (403) juste après l'acceptation d'un retrait — le dossier a quitté le périmètre. */
type FinOuverture = EchecOuverture | 'retire';
type EtatOuverture = { etat: 'chargement' } | { etat: 'pret'; dossier: Dossier } | { etat: FinOuverture };

const ECHECS: Record<FinOuverture, { message: string; aide: string; reprise: boolean }> = {
  // Lot L4-F5 — sans ce cas, le Chef de commission qui accepte un retrait lirait « hors de votre périmètre ».
  retire: {
    message: 'Retrait accepté : le dossier est revenu en brouillon chez la PRMP.',
    aide: "Son circuit à la CNM est effacé ; il sort de votre périmètre jusqu'à ce que la PRMP le soumette à nouveau.",
    reprise: false,
  },
  interdit: {
    message: 'Ce dossier est hors de votre périmètre.',
    aide: "Il relève d'une autre localité ou d'une autre autorité contractante.",
    reprise: false,
  },
  introuvable: {
    message: "Ce dossier n'existe pas.",
    aide: 'Le lien est peut-être erroné, ou le dossier a été supprimé.',
    reprise: false,
  },
  echec: {
    message: "Le dossier n'a pas pu être chargé.",
    aide: 'Vérifiez votre connexion, puis réessayez.',
    reprise: true,
  },
};

/**
 * Page d'un dossier (refonte ergonomique, lot L4-F2 — maquette `GuideDossier`, direction C) :
 * `/<espace>/dossier/:idDossier`, en lecture seule. Remplacera, écran par écran (lot F6), la modale
 * `DossierConsultation`, dont elle assemble les mêmes blocs (`features/circuit/dossier/`).
 *
 * Cette route ouvre le dossier et tranche les états d'ouverture — chargement, hors périmètre (403),
 * introuvable (404), échec — en UN seul message, sans toast. Le dossier chargé est confié à
 * `PageDossierCorps`, qui fournit son `DossierContenuStore` : changer de dossier sans quitter la route
 * repasse par le chargement, qui démonte le corps — un store neuf par dossier.
 *
 * Lot L4-F3 : une fois le dossier ouvert, la page lit ses gestes (`GET /api/dossiers/{id}/gestes`), en
 * parallèle de la vague des documents. Après un geste, elle RELIT le dossier et ses gestes seulement —
 * le corps, ses documents et son store restent en place. `?geste=` est confié au corps, qui ne le
 * déclenche que s'il est servi, puis retiré de l'URL.
 */
@Component({
  selector: 'app-page-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, Icone, PageDossierCorps],
  template: `
    @if (dossierCharge(); as dossier) {
      <app-page-dossier-corps
        [dossier]="dossier"
        [retour]="retour()"
        [retourLien]="retourLien()"
        [gestes]="gestes()"
        [relecture]="relecture()"
        [gesteDemande]="gesteDemande()"
        (gesteReussi)="relire($event)"
        (relancerGestes)="relancerGestes()"
        (gesteTraite)="retirerGesteDemande()"
      />
    } @else {
      <div class="pd">
        <div class="pd-fil">
          <nav class="pd-ariane" aria-label="Fil d'Ariane">
            <a class="pd-ariane__retour" [routerLink]="retourLien()"><app-icone nom="chevl" [taille]="15" />{{ retour().libelle }}</a>
            <app-icone class="pd-ariane__sep" nom="chev" [taille]="13" />
            <span class="pd-ariane__ici" aria-current="page">{{ titre() }}</span>
          </nav>
        </div>
        @if (ouverture().etat === 'chargement') {
          <div class="pd-attente" role="status">
            <div class="spinner" aria-hidden="true"></div>
            <span class="cnm-sr-only">Chargement du dossier…</span>
          </div>
        } @else {
          <!-- Point de reprise du focus (recette L4-Q2, défaut (e)) : sans panneau — retrait accepté,
               hors périmètre, panne — la modale de succès rend la main ici, pas au corps de page. -->
          <h1 class="pd-ref" tabindex="-1" data-focus-repli>{{ titre() }}</h1>
          @if (echec(); as e) {
            @if (ouverture().etat === 'retire') {
              <!-- Lot L4-F5 : l'issue d'un geste réussi, pas une erreur — annoncée comme telle. -->
              <div class="pd-retire" role="status">
                <app-icone nom="check" [taille]="20" />
                <div>
                  <p class="pd-retire__message">{{ e.message }}</p>
                  <p class="pd-retire__aide">{{ e.aide }}</p>
                </div>
              </div>
            } @else {
              <app-etat-erreur class="pd-erreur" [message]="e.message" [aide]="e.aide" [reprise]="e.reprise" (reessayer)="relancer()" />
            }
          }
        }
      </div>
    }
  `,
  styleUrl: './page-dossier.scss',
})
export class PageDossier {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly dossiers = inject(DossierService);

  private readonly relance$ = new Subject<void>();
  readonly ouverture = signal<EtatOuverture>({ etat: 'chargement' });

  private readonly idDossier = toSignal(this.route.paramMap.pipe(map((p) => lireIdDossier(p.get('idDossier')))), { initialValue: null });
  private readonly returnUrl = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('returnUrl'))), { initialValue: null });
  readonly gesteDemande = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('geste'))), { initialValue: null });

  /** Gestes du dossier ouvert ; relus avec lui après un geste. */
  readonly gestes = signal<EtatGestes>({ etat: 'chargement' });
  /** Relecture du dossier et de ses gestes après un geste : les boutons attendent. */
  readonly relecture = signal(false);
  /**
   * `dossier: false` : les gestes seuls (ouverture, Réessayer) ; `true` : relecture après un geste, avec ce
   * que le geste laisse attendre (`suite`). `null` annule.
   */
  private readonly lecture$ = new Subject<{ id: number; dossier: boolean; suite?: SuiteGeste } | null>();

  readonly retour = computed(() => retourPage(this.returnUrl(), this.auth.role()));
  /** Lien du fil d'Ariane : un `UrlTree`, pour que Ctrl+clic ouvre un onglet avec les paramètres du retour. */
  readonly retourLien = computed<UrlTree>(() => {
    try {
      return this.router.parseUrl(this.retour().url);
    } catch {
      return this.router.parseUrl('/');
    }
  });
  readonly dossierCharge = computed(() => {
    const o = this.ouverture();
    return o.etat === 'pret' ? o.dossier : null;
  });
  readonly echec = computed(() => {
    const o = this.ouverture();
    return o.etat === 'chargement' || o.etat === 'pret' ? null : ECHECS[o.etat];
  });
  /** Titre d'attente ou d'échec : l'identifiant, seul connu avant la réponse du serveur. */
  readonly titre = computed(() => {
    const id = this.idDossier();
    return id == null ? 'Dossier' : `Dossier n° ${id}`;
  });

  constructor() {
    combineLatest([this.route.paramMap.pipe(map((p) => lireIdDossier(p.get('idDossier'))), distinctUntilChanged()), this.relance$.pipe(startWith(undefined))])
      .pipe(
        switchMap(([id]) => {
          this.ouverture.set({ etat: 'chargement' });
          if (id == null) return of<EtatOuverture>({ etat: 'introuvable' });
          return this.dossiers.lire(id).pipe(
            map((dossier): EtatOuverture => ({ etat: 'pret', dossier })),
            catchError((err: unknown) => of<EtatOuverture>({ etat: classerEchec(err) })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((o) => {
        this.ouverture.set(o);
        this.lecture$.next(o.etat === 'pret' ? { id: o.dossier.idDossier, dossier: false } : null);
      });

    this.lecture$
      .pipe(
        switchMap((demande) => {
          if (!demande) return EMPTY;
          const gestes$: Observable<EtatGestes> = this.dossiers.gestes(demande.id).pipe(
            map((gestes): EtatGestes => ({ etat: 'pret', gestes })),
            catchError((err: unknown) => of(classerEchecGestes(err))),
          );
          if (!demande.dossier) {
            this.gestes.set({ etat: 'chargement' });
            return gestes$.pipe(map((gestes) => ({ gestes, ouverture: null })));
          }
          this.relecture.set(true);
          const ouverture$ = this.dossiers.lire(demande.id).pipe(
            map((dossier): EtatOuverture => ({ etat: 'pret', dossier })),
            catchError((err: unknown) => {
              const echec = classerEchec(err);
              return of<EtatOuverture>({ etat: echec === 'interdit' && demande.suite === 'retrait-accepte' ? 'retire' : echec });
            }),
          );
          return forkJoin({ gestes: gestes$, ouverture: ouverture$ }).pipe(finalize(() => this.relecture.set(false)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ gestes, ouverture }) => {
        if (ouverture) this.ouverture.set(ouverture);
        this.gestes.set(gestes);
      });
  }

  relancer(): void {
    this.relance$.next();
  }

  /** Après un geste réussi : le dossier et ses gestes, rien d'autre (le corps et ses documents restent). */
  relire(suite: SuiteGeste = null): void {
    const o = this.ouverture();
    if (o.etat === 'pret') this.lecture$.next({ id: o.dossier.idDossier, dossier: true, suite });
  }

  relancerGestes(): void {
    const o = this.ouverture();
    if (o.etat === 'pret') this.lecture$.next({ id: o.dossier.idDossier, dossier: false });
  }

  /** `?geste=` lu : retiré de l'URL (sans nouvelle entrée d'historique), il ne rejouera pas au retour. */
  retirerGesteDemande(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { geste: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
