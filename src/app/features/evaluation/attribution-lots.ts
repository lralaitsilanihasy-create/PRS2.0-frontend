import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { Attribution, LotAttribution } from '../../models';
import { AttributionService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { AttributionLot } from './attribution-lot';
import { ariary } from './libelles-evaluation';

const LIBELLES_ETAT: Readonly<Record<string, string>> = {
  EN_EVALUATION: 'Évaluation en cours',
  PROPOSE: 'Proposition du rapport — dossier de marché à créer',
  AU_CONTROLE: 'Au contrôle de la Commission',
  AVIS_RENDU: 'Avis de la Commission rendu',
};
const LIBELLES_AVIS: Readonly<Record<string, string>> = { FAV: 'Favorable', FAVR: 'Favorable avec réserves', DEF: 'Défavorable' };

/**
 * ⚠️ Attribution, lot 2, tranche 2a (V79) — sous l'évaluation, l'état de chaque lot après le rapport : la proposition d'attribution, puis
 * le **dossier de marché** (famille `DDM`) que la PRMP ou son UGPM crée ; le serveur y joint d'office le projet de marché (qu'il
 * produit), le cahier des charges, le devis rempli de l'offre, le PV d'ouverture et le rapport. Le dossier suit ensuite le circuit de
 * la Commission ; l'avis rendu remonte ici. Les gestes suivants (attribution, information des candidats…) viennent avec la tranche 2b.
 */
@Component({
  selector: 'app-attribution-lots',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AttributionLot],
  template: `
    @if (attribution(); as a) {
      <section class="card at" aria-labelledby="at-titre">
        <h2 id="at-titre" class="at__h2">Attribution</h2>
        @for (l of a.lots; track l.lot) {
          <article class="at__lot" [attr.aria-label]="'Lot ' + l.lot">
            <header class="at__tete">
              <h3 class="at__h3">Lot {{ l.lot }}</h3>
              <span class="badge" [class.badge-info]="l.etat === 'AU_CONTROLE'" [class.badge-warning]="l.etat === 'PROPOSE'" [class.badge-success]="l.etat === 'AVIS_RENDU' && l.dossierMarche?.avis !== 'DEF'" [class.badge-danger]="l.dossierMarche?.avis === 'DEF'" [class.badge-neutral]="l.etat === 'EN_EVALUATION'">{{ libelleEtat(l) }}</span>
            </header>
            @if (l.proposition; as p) {
              @if (p.infructueux) {
                <p class="text-sm">Aucune offre qualifiée : le rapport propose de déclarer le lot <strong>infructueux</strong> (décision de la PRMP, à venir).</p>
              } @else {
                <p class="text-sm">Proposition du rapport : offre n° {{ p.numero }} · <strong>{{ p.candidat }}</strong> — {{ ariary(p.montant) }} HT · délai {{ p.delai ?? '—' }}</p>
              }
            }
            @if (l.dossierMarche; as d) {
              <p class="text-sm">
                Dossier de marché n° <span class="cnm-mono">{{ d.idDossier }}</span> ({{ d.sousType }}){{ d.statut ? ' · ' + d.statut : '' }}{{ d.creeLe ? ' · créé le ' + dateHeure(d.creeLe) : '' }}{{ d.creePar ? ' par ' + d.creePar : '' }}
                @if (d.avis) { · avis de la Commission : <strong>{{ avis[d.avis] ?? d.avis }}</strong> }
              </p>
            }
            <div class="at__actions">
              @if (peutCreer(l)) {
                <button type="button" class="btn btn-primary btn-sm" [disabled]="travail() === l.lot" (click)="creer(l)">Créer le dossier de marché</button>
              }
              @if (l.dossierMarche && lienDossier()) {
                <a class="btn btn-outline btn-sm" [routerLink]="['/prmp/dossier', l.dossierMarche.idDossier]">Ouvrir le dossier de marché</a>
              }
              @if (l.projetDisponible) {
                <button type="button" class="btn btn-outline btn-sm" [disabled]="travail() === l.lot" (click)="projet(l, 'pdf')">Projet de marché (PDF)</button>
                <button type="button" class="btn btn-ghost btn-sm" [disabled]="travail() === l.lot" (click)="projet(l, 'docx')">Enregistrer en Word</button>
              }
            </div>
            <!-- ⚠️ Tranches 2b et 2c — de l'avis de la Commission à l'avis d'attribution. -->
            @if (l.dossierMarche?.avis || l.attributaire) { <app-attribution-lot [idDmc]="idDmc()" [lot]="l" [prmp]="prmp()" (maj)="maj($event)" /> }
            @if (peutCreer(l)) {
              <p class="text-sm text-muted at__aide">Le serveur y joint d'office le projet de marché (qu'il produit), le cahier des charges (DAO complet), le devis rempli de l'offre, le PV d'ouverture et le rapport d'évaluation ; vous soumettez ensuite le dossier à la Commission depuis sa page.</p>
            }
          </article>
        }
        @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
      </section>
    }
  `,
  styles: `
    .at { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.7rem; }
    .at__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .at__lot { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.6rem 0.8rem; border: 1px solid var(--n-200); border-radius: 6px; }
    .at__tete { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .at__h3 { margin: 0; font-size: 1rem; }
    .at__lot p { margin: 0; }
    .at__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  `,
})
export class AttributionLots implements OnInit {
  readonly idDmc = input.required<number>();
  /** La PRMP ou son UGPM : elles créent le dossier de marché et en ouvrent la page. */
  readonly prmpOuUgpm = input(false);
  /** La PRMP seule : attribuer, informer, signer, notifier… (tranches 2b, 2c). */
  readonly prmp = input(false);

  private readonly service = inject(AttributionService);
  private readonly toast = inject(ToastService);
  readonly etats = LIBELLES_ETAT;
  readonly avis = LIBELLES_AVIS;
  readonly ariary = ariary;
  readonly dateHeure = dateHeureFr;

  readonly attribution = signal<Attribution | null>(null);
  readonly travail = signal<number | null>(null);
  readonly erreur = signal<string | null>(null);
  readonly lienDossier = computed(() => this.prmpOuUgpm());

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    // 404 tant que l'évaluation n'est pas ouverte : rien à montrer.
    this.service.lire(this.idDmc()).subscribe({ next: (a) => this.attribution.set(a), error: () => this.attribution.set(null) });
  }

  /** Un lot proposé infructueux n'a pas de dossier de marché : son état le dit, au lieu d'inviter à en créer un. */
  libelleEtat(l: LotAttribution): string {
    if (l.etat === 'PROPOSE' && l.proposition?.infructueux) return 'Infructuosité proposée — décision de la PRMP à venir';
    return this.etats[l.etat] ?? l.etat;
  }

  /** Un geste rend l'attribution à jour ; une réponse à une explication ne la rend pas : on la relit. */
  maj(a: Attribution | null): void {
    if (a) this.attribution.set(a);
    else this.charger();
  }

  peutCreer(l: LotAttribution): boolean {
    return this.prmpOuUgpm() && l.etat === 'PROPOSE' && !l.dossierMarche && !!l.proposition && !l.proposition.infructueux;
  }

  creer(l: LotAttribution): void {
    this.travail.set(l.lot);
    this.erreur.set(null);
    this.service.creerDossier(this.idDmc(), l.lot).subscribe({
      next: (a) => {
        this.travail.set(null);
        this.attribution.set(a);
        this.toast.success('Le dossier de marché est créé, ses pièces jointes ; soumettez-le à la Commission depuis sa page.');
      },
      error: (e: ApiError) => {
        this.travail.set(null);
        const code = codeErreur(e);
        const existant = corpsErreur<{ idDossier?: number; details?: { idDossier?: number } }>(e);
        this.erreur.set(
          code === 'EVALUATION_NON_CLOSE' ? 'Le dossier de marché se crée quand le rapport d’évaluation est signé de tous.'
          : code === 'LOT_INFRUCTUEUX' ? 'Ce lot est proposé infructueux : il n’a pas de dossier de marché.'
          // ⚠️ PI-d2b (V90) — le dossier d'un marché de prestations intellectuelles se crée au sous-type MPI.
          : code === 'SOUS_TYPE_ABSENT' ? 'Le sous-type « Marché de prestations intellectuelles » (MPI) manque au référentiel : l’Administrateur doit le rétablir.'
          : code === 'DOSSIER_EXISTANT' ? `Le dossier de marché de ce lot existe déjà (n° ${existant?.idDossier ?? existant?.details?.idDossier ?? '?'}).`
          : e.message || 'Le dossier n’a pas pu être créé.',
        );
        if (code === 'DOSSIER_EXISTANT') this.charger();
      },
    });
  }

  projet(l: LotAttribution, format: 'pdf' | 'docx'): void {
    this.travail.set(l.lot);
    this.service.projet(this.idDmc(), l.lot, format).subscribe({
      next: (b) => {
        this.travail.set(null);
        if (format === 'pdf') ouvrirBlobSur(b);
        else telechargerBlob(b, `projet-marche-${this.idDmc()}-lot${l.lot}.docx`);
      },
      error: (e: ApiError) => {
        this.travail.set(null);
        this.erreur.set(e.status === 404 ? 'Le projet de marché n’est pas encore produit.' : e.message || 'Le projet n’a pas pu être lu.');
      },
    });
  }
}
