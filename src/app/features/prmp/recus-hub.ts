import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LigneEligible, RecuDao } from '../../models';
import { DmcService, FicheMarcheService } from '../../services';
import { CarteIndicateurs, Indicateur } from '../../shared/ui/carte-indicateurs';
import { DeuxVolets } from '../../shared/ui/deux-volets';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { RecusTable } from './recus-table';

/** Une fiche (un appel d'offres) de la PRMP. */
interface FicheRecus {
  ligne: LigneEligible;
  idDmc: number;
}

/**
 * ⚠️ 18/10 (pilote) — « Reçus des frais » : une entrée de menu pour tous les reçus des frais de dossier, au lieu du seul chemin
 * Appels d'offres › fiche › reçus. L'écran lit les lignes du plan de la PRMP (`GET /api/dmcs/eligibles`, qui porte `idDmc` et
 * `recusEnAttente`) ; la PRMP et l'UGPM décident sur place, avec le même tableau que l'écran de la fiche.
 *
 * ⚠️ 31/10 (pilote, Espace de travail, lot 3b) — DEUX VOLETS : les appels d'offres à gauche (ceux qui ont des reçus à valider en
 * tête, avec leur compte), les reçus de l'appel d'offres choisi à droite (`GET /api/fiches-marche/{id}/recus`, lus au choix, un
 * appel à la fois). Le premier appel d'offres est choisi d'office.
 */
@Component({
  selector: 'app-recus-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, RecusTable, DeuxVolets, CarteIndicateurs],
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
        <app-carte-indicateurs [indicateurs]="indicateurs()" />
        <app-deux-volets [ouvert]="!!selection()" [cle]="selection()?.idDmc ?? null" libelleListe="Appels d’offres" libelleDetail="Reçus de l’appel d’offres"
                         invite="Choisissez un appel d’offres : ses reçus s’affichent ici.">
          <ul liste class="rh__liste">
            @for (f of fiches(); track f.idDmc) {
              <li class="rh__item" [class.rh__item--on]="selection()?.idDmc === f.idDmc">
                <button type="button" class="rh__ligne" [attr.aria-pressed]="selection()?.idDmc === f.idDmc" (click)="choisir(f.idDmc)">
                  <span class="rh__objet">{{ f.ligne.designationMarche }}</span>
                  <span class="rh__meta">
                    <span class="cnm-mono">{{ f.ligne.refeDossier || ('plan n° ' + f.ligne.idDossier) }}</span>
                    @if (f.ligne.sousType) { <span class="badge badge-neutral">{{ f.ligne.sousType }}</span> }
                    <span class="rh__offres">{{ f.ligne.nbOffres || 0 }} offre{{ (f.ligne.nbOffres || 0) > 1 ? 's' : '' }}</span>
                    @if (f.ligne.recusEnAttente) { <span class="badge badge-warning">{{ f.ligne.recusEnAttente }} à valider</span> }
                  </span>
                </button>
              </li>
            }
          </ul>
          <div detail>
            @if (selection(); as f) {
              <div class="rh__detail">
                <header class="rh__detail-tete">
                  <div>
                    <h2 class="rh__detail-titre">{{ f.ligne.designationMarche }}</h2>
                    <p class="rh__meta"><span class="cnm-mono">{{ f.ligne.refeDossier || ('plan n° ' + f.ligne.idDossier) }}</span>@if (f.ligne.sousType) { <span class="badge badge-neutral">{{ f.ligne.sousType }}</span> }</p>
                  </div>
                  <a class="btn btn-sm btn-outline" [routerLink]="['/prmp', 'dao', f.idDmc, 'recus']">Ouvrir la page des reçus</a>
                </header>
                @if (chargementRecus()) {
                  <p class="text-sm text-muted" role="status">Chargement des reçus…</p>
                } @else if (erreurRecus()) {
                  <app-etat-erreur message="Les reçus de cet appel d’offres n’ont pas pu être lus." (reessayer)="lireRecus(f.idDmc)" />
                } @else if (!recus().length) {
                  <p class="text-sm text-muted">Aucun reçu déposé pour l’instant : ils apparaissent ici dès qu’une entreprise en dépose un ; vous en êtes notifié.</p>
                } @else {
                  <p class="text-sm"><strong>{{ enAttente() }}</strong> {{ enAttente() > 1 ? 'reçus attendent' : 'reçu attend' }} votre décision · {{ recus().length }} au total.</p>
                  <app-recus-table [idDmc]="f.idDmc" [recus]="recus()" [legende]="'Reçus — ' + f.ligne.designationMarche" (decide)="appliquer(f.idDmc, $event)" (recharger)="lireRecus(f.idDmc)" />
                }
              </div>
            }
          </div>
        </app-deux-volets>
      }
    </section>
  `,
  styles: `
    .rh { display: flex; flex-direction: column; gap: 0.6rem; }
    .rh__liste { list-style: none; margin: 0; padding: 0; }
    .rh__item { border-bottom: 1px solid var(--bordure); }
    .rh__item--on { background: var(--onglet-actif-fond); box-shadow: inset 3px 0 0 var(--menu-fond); }
    .rh__ligne { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: flex; flex-direction: column; gap: 0.3rem; padding: 0.6rem 0.8rem; }
    .rh__ligne:hover { background: var(--ligne-survol); }
    .rh__item--on .rh__ligne:hover { background: transparent; }
    .rh__ligne:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: -2px; }
    .rh__objet { font-weight: 500; line-height: 1.35; overflow-wrap: anywhere; }
    .rh__meta { margin: 0; display: flex; flex-wrap: wrap; gap: 0.3rem 0.6rem; align-items: center; font-size: var(--text-sm); color: var(--texte-secondaire); }
    .rh__detail { display: flex; flex-direction: column; gap: 0.6rem; }
    .rh__detail-tete { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; padding-bottom: 8px; border-bottom: 1px solid var(--bordure); }
    .rh__detail-titre { margin: 0 0 0.2rem; font-size: 15px; font-weight: 500; line-height: 1.35; }
  `,
})
export class RecusHub implements OnInit {
  private readonly service = inject(FicheMarcheService);
  private readonly dmcs = inject(DmcService);
  private readonly document = inject(DOCUMENT);

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly fiches = signal<FicheRecus[]>([]);
  readonly nbEnAttente = computed(() => this.fiches().reduce((n, f) => n + (f.ligne.recusEnAttente ?? 0), 0));
  readonly indicateurs = computed<Indicateur[]>(() => [
    { libelle: this.nbEnAttente() > 1 ? 'reçus à valider' : 'reçu à valider', valeur: this.nbEnAttente(), alerte: this.nbEnAttente() > 0 },
    { libelle: this.fiches().length > 1 ? 'appels d’offres' : 'appel d’offres', valeur: this.fiches().length },
    { libelle: 'offres déposées', valeur: this.fiches().reduce((n, f) => n + (f.ligne.nbOffres ?? 0), 0) },
  ]);

  /** L'appel d'offres choisi dans le volet de gauche, et ses reçus (lus au choix). */
  private readonly choisi = signal<number | null>(null);
  readonly selection = computed(() => this.fiches().find((f) => f.idDmc === this.choisi()) ?? null);
  readonly recus = signal<RecuDao[]>([]);
  readonly chargementRecus = signal(false);
  readonly erreurRecus = signal(false);
  readonly enAttente = computed(() => this.recus().filter((r) => r.etat === 'EN_ATTENTE').length);

  ngOnInit(): void {
    this.document.title = 'Reçus des frais de dossier — PRS 2.0';
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.dmcs.eligibles().subscribe({
      next: (lignes) => {
        const fiches: FicheRecus[] = lignes
          .filter((l): l is LigneEligible & { idDmc: number } => l.idDmc != null)
          .map((l) => ({ ligne: l, idDmc: l.idDmc }));
        // Les fiches qui ont un reçu en attente d'abord, puis l'ordre du serveur.
        fiches.sort((a, b) => Number((b.ligne.recusEnAttente ?? 0) > 0) - Number((a.ligne.recusEnAttente ?? 0) > 0));
        this.fiches.set(fiches);
        this.chargement.set(false);
        const garde = fiches.find((f) => f.idDmc === this.choisi());
        const premier = garde ?? fiches[0];
        if (premier) this.choisir(premier.idDmc, true);
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  /** Choisir un appel d'offres : ses reçus s'affichent à droite. */
  choisir(idDmc: number, relire = false): void {
    if (this.choisi() === idDmc && !relire) return;
    this.choisi.set(idDmc);
    this.lireRecus(idDmc);
  }

  lireRecus(idDmc: number): void {
    this.chargementRecus.set(true);
    this.erreurRecus.set(false);
    this.recus.set([]);
    this.service.recus(idDmc).subscribe({
      next: (r) => {
        if (this.choisi() !== idDmc) return;
        this.recus.set(r);
        this.chargementRecus.set(false);
      },
      error: () => {
        if (this.choisi() !== idDmc) return;
        this.chargementRecus.set(false);
        this.erreurRecus.set(true);
      },
    });
  }

  /** Un reçu décidé : il prend son nouvel état, et le compte « à valider » de l'appel d'offres suit. */
  appliquer(idDmc: number, maj: RecuDao): void {
    const recus = this.recus().map((r) => (r.idRecu === maj.idRecu ? maj : r));
    this.recus.set(recus);
    const enAttente = recus.filter((r) => r.etat === 'EN_ATTENTE').length;
    this.fiches.update((liste) => liste.map((f) => (f.idDmc === idDmc ? { ...f, ligne: { ...f.ligne, recusEnAttente: enAttente } } : f)));
  }
}
