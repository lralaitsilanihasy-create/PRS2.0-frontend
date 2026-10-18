import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { LigneEligible, RecuDao } from '../../models';
import { DmcService, FicheMarcheService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { Icone } from '../../shared/ui/icone';
import { RecusTable } from './recus-table';

/** Une fiche de la PRMP et ses reçus en attente, lus ensemble. */
interface FicheAvecRecus {
  ligne: LigneEligible;
  idDmc: number;
  /** Les reçus EN_ATTENTE de la fiche ; `null` tant qu'ils ne sont pas lus, ou si la lecture a échoué. */
  recus: RecuDao[] | null;
}

/**
 * ⚠️ 18/10 (pilote) — « Reçus des frais » : une entrée de menu pour tous les reçus des frais de dossier, au lieu du seul chemin
 * Appels d'offres › fiche › reçus. L'écran lit les lignes du plan de la PRMP (`GET /api/dmcs/eligibles`, qui porte `idDmc` et
 * `recusEnAttente`), puis les reçus des SEULES fiches qui en ont en attente (quelques appels, jamais un par fiche) : la PRMP et
 * l'UGPM décident sur place, avec le même tableau que l'écran de la fiche. Les autres fiches sont listées avec leur lien.
 */
@Component({
  selector: 'app-recus-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, Icone, RecusTable],
  template: `
    <section class="rh">
      <header class="page-header">
        <div class="page-subtitle">Domaine PRMP</div>
        <h1 class="page-title">Reçus des frais de dossier</h1>
      </header>
      <p class="page-role">Les reçus déposés par les entreprises sur vos appels d’offres à dossier payant. Un reçu validé ouvre le retrait du dossier à l’entreprise ; comparez-le au relevé de l’ARMP avant de décider : une décision ne se reprend pas.</p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des reçus…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Les reçus n'ont pas pu être chargés." (reessayer)="charger()" />
      } @else if (!fiches().length) {
        <div class="empty-state">
          <p class="empty-state-title">Aucun appel d’offres n’a encore de fiche.</p>
          <p class="empty-state-text">Les reçus se déposent sur une fiche validée en remise électronique, à dossier payant. <a routerLink="/prmp/dao">Voir les appels d’offres</a>.</p>
        </div>
      } @else {
        <h2 class="rh__h2"><app-icone nom="clock" [taille]="16" />À valider<span class="rh__compte">{{ nbEnAttente() }}</span></h2>
        @if (!aValider().length) {
          <p class="rh__calme" role="status"><app-icone nom="check" [taille]="15" />Aucun reçu n’attend votre décision.</p>
        }
        @for (f of aValider(); track f.idDmc) {
          <section class="card rh__fiche" [attr.aria-label]="f.ligne.designationMarche">
            <header class="rh__fiche-tete">
              <div>
                <h3 class="rh__fiche-titre">{{ f.ligne.designationMarche }}</h3>
                <p class="rh__fiche-sous"><span class="cnm-mono">{{ f.ligne.refeDossier || ('plan n° ' + f.ligne.idDossier) }}</span>@if (f.ligne.sousType) { <span class="badge badge-neutral">{{ f.ligne.sousType }}</span> }</p>
              </div>
              <a class="btn btn-sm btn-outline" [routerLink]="['/prmp', 'dao', f.idDmc, 'recus']">Tous les reçus de cette fiche</a>
            </header>
            @if (f.recus === null) {
              <p class="text-sm text-muted" role="status">Les reçus de cette fiche n’ont pas pu être lus : ouvrez-les depuis la fiche.</p>
            } @else {
              <app-recus-table [idDmc]="f.idDmc" [recus]="f.recus" [legende]="'Reçus en attente — ' + f.ligne.designationMarche" (decide)="appliquer(f.idDmc, $event)" (recharger)="charger()" />
            }
          </section>
        }

        <h2 class="rh__h2 rh__h2--liste"><app-icone nom="clip" [taille]="16" />Tous les appels d’offres</h2>
        <div class="cnm-table-wrap">
          <table class="cnm-table rh__table">
            <caption class="cnm-sr-only">Appels d'offres de la PRMP et leurs reçus</caption>
            <thead><tr><th scope="col">Appel d’offres</th><th scope="col">Plan</th><th scope="col" class="cnm-num">Reçus à valider</th><th scope="col" class="cnm-num">Offres déposées</th><th scope="col"><span class="cnm-sr-only">Actions</span></th></tr></thead>
            <tbody>
              @for (f of fiches(); track f.idDmc) {
                <tr>
                  <td class="rh__objet">{{ f.ligne.designationMarche }}@if (f.ligne.sousType) { <span class="badge badge-neutral">{{ f.ligne.sousType }}</span> }</td>
                  <td class="cnm-mono">{{ f.ligne.refeDossier || '—' }}</td>
                  <td class="cnm-num">@if (f.ligne.recusEnAttente) { <span class="badge badge-warning">{{ f.ligne.recusEnAttente }}</span> } @else { — }</td>
                  <td class="cnm-num">{{ f.ligne.nbOffres || '—' }}</td>
                  <td class="rh__action"><a class="btn btn-sm btn-outline" [routerLink]="['/prmp', 'dao', f.idDmc, 'recus']">Voir les reçus</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .rh { display: flex; flex-direction: column; gap: 0.75rem; }
    .rh__h2 { margin: 0.5rem 0 0; display: flex; gap: 0.45rem; align-items: center; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-600); }
    .rh__h2 app-icone { color: var(--p-600); }
    .rh__h2--liste { margin-top: 1.25rem; }
    .rh__compte { min-width: 1.4rem; padding: 0 0.45rem; border-radius: var(--radius-full); background: var(--p-100); color: var(--p-800); font-size: var(--text-xs); text-align: center; }
    .rh__calme { margin: 0; display: flex; gap: 0.4rem; align-items: center; color: var(--n-600); font-size: var(--text-sm); }
    .rh__fiche { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .rh__fiche-tete { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
    .rh__fiche-titre { margin: 0; font-size: 1rem; }
    .rh__fiche-sous { margin: 0.2rem 0 0; display: flex; gap: 0.5rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); }
    .rh__table td { white-space: normal; vertical-align: middle; }
    .rh__objet .badge { margin-left: 0.5rem; }
    .rh__action { text-align: right; }
  `,
})
export class RecusHub implements OnInit {
  private readonly service = inject(FicheMarcheService);
  private readonly dmcs = inject(DmcService);
  private readonly document = inject(DOCUMENT);

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly fiches = signal<FicheAvecRecus[]>([]);
  readonly aValider = computed(() => this.fiches().filter((f) => (f.ligne.recusEnAttente ?? 0) > 0));
  readonly nbEnAttente = computed(() => this.fiches().reduce((n, f) => n + (f.ligne.recusEnAttente ?? 0), 0));

  ngOnInit(): void {
    this.document.title = 'Reçus des frais de dossier — PRS 2.0';
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.dmcs.eligibles().subscribe({
      next: (lignes) => {
        const fiches: FicheAvecRecus[] = lignes
          .filter((l): l is LigneEligible & { idDmc: number } => l.idDmc != null)
          .map((l) => ({ ligne: l, idDmc: l.idDmc, recus: null }));
        // Les fiches qui ont un reçu en attente d'abord, puis l'ordre du serveur.
        fiches.sort((a, b) => Number((b.ligne.recusEnAttente ?? 0) > 0) - Number((a.ligne.recusEnAttente ?? 0) > 0));
        const avecAttente = fiches.filter((f) => (f.ligne.recusEnAttente ?? 0) > 0);
        if (!avecAttente.length) {
          this.fiches.set(fiches);
          this.chargement.set(false);
          return;
        }
        forkJoin(
          avecAttente.map((f) =>
            this.service.recus(f.idDmc).pipe(
              map((r) => ({ idDmc: f.idDmc, recus: r.filter((x) => x.etat === 'EN_ATTENTE') })),
              catchError(() => of({ idDmc: f.idDmc, recus: null as RecuDao[] | null })),
            ),
          ),
        ).subscribe((lus) => {
          const parFiche = new Map(lus.map((x) => [x.idDmc, x.recus]));
          this.fiches.set(fiches.map((f) => (parFiche.has(f.idDmc) ? { ...f, recus: parFiche.get(f.idDmc) ?? null } : f)));
          this.chargement.set(false);
        });
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  /** Un reçu décidé : il quitte la liste « à valider » de sa fiche, et le compte de la ligne suit. */
  appliquer(idDmc: number, maj: RecuDao): void {
    this.fiches.update((liste) =>
      liste.map((f) => {
        if (f.idDmc !== idDmc) return f;
        const recus = (f.recus ?? []).filter((r) => r.idRecu !== maj.idRecu || maj.etat === 'EN_ATTENTE');
        return { ...f, recus, ligne: { ...f.ligne, recusEnAttente: recus.length } };
      }),
    );
  }
}
