import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import { Subject, catchError, combineLatest, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Dossier } from '../../../models';
import { DossierService } from '../../../services';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { Icone } from '../../../shared/ui/icone';
import { PageDossierCorps } from './page-dossier-corps';
import { EchecOuverture, classerEchec, lireIdDossier, retourPage } from './page-dossier-modele';

type EtatOuverture = { etat: 'chargement' } | { etat: 'pret'; dossier: Dossier } | { etat: EchecOuverture };

const ECHECS: Record<EchecOuverture, { message: string; aide: string; reprise: boolean }> = {
  interdit: {
    message: 'Ce dossier est hors de votre périmètre.',
    aide: "Il relève d'une autre localité ou d'une autre autorité contractante : le serveur ne vous en ouvre pas la consultation.",
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
 */
@Component({
  selector: 'app-page-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, Icone, PageDossierCorps],
  template: `
    @if (dossierCharge(); as dossier) {
      <app-page-dossier-corps [dossier]="dossier" [retour]="retour()" [retourLien]="retourLien()" />
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
          <h1 class="pd-ref">{{ titre() }}</h1>
          @if (echec(); as e) {
            <app-etat-erreur class="pd-erreur" [message]="e.message" [aide]="e.aide" [reprise]="e.reprise" (reessayer)="relancer()" />
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
      .subscribe((o) => this.ouverture.set(o));
  }

  relancer(): void {
    this.relance$.next();
  }
}
