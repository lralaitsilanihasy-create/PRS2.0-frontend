import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { maintenantServeur } from '../../../core/horloge/heure-serveur';
import { Echeance, JalonReel, LigneEligible, Marche, MarchePrevision, NoeudFiliation } from '../../../models';
import { statutDossierLabel } from '../../../shared/circuit/circuit-workflow';
import { ChaineLigne, ChainesDuPlan, dossiersDeLaLigne } from '../../circuit/page-dossier/chaine-ligne';
import { LIBELLES_ETAT_ATTRIBUTION } from '../../circuit/dossier/instantanes-vues';

const dateFr = (iso?: string | null): string => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};
const norm = (s?: string | null): string => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const joursEntre = (aIso: string, bIso: string): number => {
  const [ay, am, ad] = aIso.slice(0, 10).split('-').map(Number);
  const [by, bm, bd] = bIso.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
};

/** Référence et statut d'un dossier ; un brouillon, qui n'a pas encore de référence, n'a que son statut. */
const quoi = (ref: string | null | undefined, statut: string | null | undefined): string => (ref ? `${ref} · ` : '') + statutDossierLabel(statut ?? undefined);

/**
 * ⚠️ 03/11 (pilote, lot 3) — ce que la procédure de la ligne a déjà produit, en faits lisibles : fiche DAO, dossier, remise, avis,
 * offres, attribution par lot, rapport justificatif, dossiers de marché. Seulement ce qui existe : une ligne non lancée n'en a aucun.
 */
export function faitsDeProcedure(m: Pick<Marche, 'avisImprimeLe'>, e: LigneEligible | undefined, noeuds: readonly NoeudFiliation[]): [string, string][] {
  const f: [string, string][] = [];
  const visibles = noeuds.filter((n) => !n.masque);
  const rj = visibles.find((n) => n.lien === 'MISE_EN_CONCURRENCE' && n.idSousType === 'RJ');
  if (rj) f.push(['Rapport justificatif', quoi(rj.refeDossier, rj.statut)]);
  if (e?.dejaDao) {
    if (e.fiche) f.push(['Informations du DAO', `${e.fiche.statut === 'VALIDEE' ? 'validées' : 'brouillon'} · version ${e.fiche.version}`]);
    if (e.dossier) f.push(['Dossier de mise en concurrence', quoi(e.dossier.refeDossier, e.dossier.statut)]);
    if (e.modeRemise) f.push(['Remise des offres', e.modeRemise === 'PAPIER' ? 'papier' : 'électronique']);
  }
  if (m.avisImprimeLe) f.push(['Avis spécifique', `imprimé le ${dateFr(m.avisImprimeLe)}`]);
  if (e?.nbOffres) f.push(['Offres déposées', String(e.nbOffres)]);
  if (e?.recusEnAttente) f.push(['Reçus de frais à valider', String(e.recusEnAttente)]);
  const plusieurs = (e?.attributions?.length ?? 0) > 1;
  for (const a of e?.attributions ?? []) f.push([plusieurs ? `Attribution · lot ${a.lot}` : 'Attribution', LIBELLES_ETAT_ATTRIBUTION[a.etat] ?? a.etat]);
  for (const n of visibles.filter((x) => x.lien === 'MARCHE')) {
    f.push([n.lot != null ? `Dossier de marché · lot ${n.lot}` : 'Dossier de marché', quoi(n.refeDossier, n.statut)]);
  }
  for (const n of visibles.filter((x) => x.lien === 'MODIFICATION')) f.push(['Acte de gestion', quoi(n.refeDossier, n.statut)]);
  return f;
}

export interface JalonLigne {
  processus: string;
  prevu: string;
  reel: string;
  /** Ce qui donne la date réelle (le fait et sa date), en infobulle ; `null` pour une date d'échéance. */
  source: string | null;
  /** Le serveur ne connaît aucun fait pour ce processus : il n'a jamais de date réelle, et n'est pas compté en retard. */
  sansFait: boolean;
  /** Jours de retard : prévu dépassé sans date réelle ; `null` sinon. */
  retard: number | null;
}

/**
 * ⚠️ 03/11 (« jalons-reels », Q2 du backend) — les processus CAPM qu'aucun fait du serveur ne date (détermination des besoins,
 * préparation du DAO, établissement du projet de marché…). Liste fixée par le backend dans sa réponse.
 */
export const PROCESSUS_SANS_FAIT: ReadonlySet<number> = new Set([101, 103, 104, 105, 110, 116, 121, 122, 130]);

/**
 * ⚠️ 03/11 (lot 3) — les jalons de la ligne : la date prévue au plan (processus CAPM), la date réelle (`/api/echeances`, rapprochée
 * par le type de jalon comme le fait le calendrier des jalons), et le retard d'un jalon prévu passé sans date réelle. `aujourdhui` au
 * format ISO, lu sur l'heure du serveur.
 */
export function jalonsDeLigne(
  previsions: readonly MarchePrevision[],
  capms: ReadonlyMap<string, string>,
  echeances: readonly Echeance[],
  aujourdhui: string,
  reels: readonly JalonReel[] | null = null,
): JalonLigne[] {
  return previsions
    .filter((p) => !p.sansObjet)
    .slice()
    .sort((a, b) => (a.dateDebut ?? '').localeCompare(b.dateDebut ?? ''))
    .map((p) => {
      const processus = capms.get(String(p.idCapm)) ?? `Processus ${p.idCapm}`;
      // ⚠️ 03/11 (« jalons-reels ») — la date calculée par le serveur d'abord, à défaut celle de l'échéance (Q1).
      const calculee = reels?.find((r) => r.idCapm === p.idCapm);
      const ech = echeances.find((x) => {
        const a = norm(x.typeJalon), b = norm(processus);
        return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
      });
      const reel = calculee ? dateFr(calculee.dateReelle) : ech?.dateReelle ? dateFr(ech.dateReelle) : '';
      // Sans fait possible (Q2), un jalon n'a jamais de date réelle : il n'est pas compté en retard — seulement si le serveur a répondu.
      const sansFait = reels != null && !reel && PROCESSUS_SANS_FAIT.has(p.idCapm);
      const ecart = p.dateDebut ? joursEntre(aujourdhui, p.dateDebut) : 0;
      return {
        processus, prevu: dateFr(p.dateDebut), reel, source: calculee?.source ?? null, sansFait,
        retard: !reel && !sansFait && p.dateDebut && ecart < 0 ? -ecart : null,
      };
    });
}

/** Les jalons réalisés, puis les `n` premiers qui ne le sont pas encore. */
export function prochainsJalons(jalons: readonly JalonLigne[], n: number): JalonLigne[] {
  let restants = n;
  return jalons.filter((j) => !!j.reel || restants-- > 0);
}

/** ⚠️ 03/11 (lot 3) — l'attribution prévue avant le lancement prévu : une incohérence du plan, signalée sans bloquer. */
export function datesIncoherentes(previsions: readonly MarchePrevision[], capms: ReadonlyMap<string, string>): string | null {
  const date = (mot: string): string | undefined => previsions.find((p) => !p.sansObjet && norm(capms.get(String(p.idCapm))).includes(mot))?.dateDebut;
  const lancement = date('LANCEMENT');
  const attribution = date('ATTRIBUTION');
  return lancement && attribution && attribution < lancement
    ? `L’attribution prévue (${dateFr(attribution)}) précède le lancement prévu (${dateFr(lancement)}).`
    : null;
}

const isoJour = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * ⚠️ 03/11 (pilote, maquette « espace PRMP », lot 3) — le détail d'une ligne du plan : sa chaîne et le geste suivant, ce que sa
 * procédure a produit, ses jalons prévus face aux dates réelles. Sert aux deux présentations du plan (document et deux volets).
 */
@Component({
  selector: 'app-detail-ligne',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChaineLigne],
  template: `
    <div class="dl" [class.dl--empile]="empile()">
      <section class="dl__bloc" aria-label="Chaîne de la procédure">
        <h3 class="dl__t">Chaîne de la procédure</h3>
        <app-chaine-ligne [marche]="marche()" />
      </section>
      <section class="dl__bloc" aria-label="Procédure">
        <h3 class="dl__t">Procédure</h3>
        @if (faits().length) {
          <dl class="dl__faits">
            @for (f of faits(); track $index) { <div><dt>{{ f[0] }}</dt><dd>{{ f[1] }}</dd></div> }
          </dl>
        } @else {
          <p class="dl__vide">Rien encore : la procédure commence avec le premier dossier de la ligne.</p>
        }
      </section>
      <section class="dl__bloc" aria-label="Jalons">
        <h3 class="dl__t">Jalons</h3>
        @if (incoherence(); as i) { <p class="dl__alerte" role="note">{{ i }}</p> }
        @if (jalons().length) {
          <table class="dl__jalons">
            <thead><tr><th scope="col">Jalon</th><th scope="col">Prévu</th><th scope="col">Réel</th></tr></thead>
            <tbody>
              @for (j of jalonsVisibles(); track $index) {
                <tr>
                  <td [attr.title]="j.processus">{{ intituleCourt(j.processus) }}</td><td class="dl__d">{{ j.prevu }}</td>
                  <td class="dl__d">@if (j.reel) { <span [attr.title]="j.source">{{ j.reel }}</span> } @else if (j.sansFait) { <span class="dl__nr">non renseigné</span> } @else if (j.retard) { <span class="dl__retard" title="Date réelle non renseignée">prévu dépassé de {{ j.retard }} j</span> } @else { — }</td>
                </tr>
              }
            </tbody>
          </table>
          @if (jalons().length > jalonsVisibles().length || tous()) {
            <button type="button" class="btn btn-outline btn-sm dl__plus" (click)="tous.set(!tous())">
              {{ tous() ? 'Ne garder que les prochains jalons' : 'Voir les ' + jalons().length + ' jalons' }}
            </button>
          }
        } @else {
          <p class="dl__vide">Aucune date prévue au plan pour cette ligne.</p>
        }
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }
    .dl { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1.35fr); background: var(--carte-fond); font-size: 0.8125rem; }
    .dl--empile { grid-template-columns: minmax(0, 1fr); }
    .dl__bloc { padding: 0.6rem 0.8rem; border-right: 1px solid var(--bordure); display: grid; gap: 0.4rem; align-content: start; min-width: 0; }
    .dl__bloc:last-child { border-right: 0; }
    .dl--empile .dl__bloc { border-right: 0; border-bottom: 1px solid var(--bordure); }
    .dl--empile .dl__bloc:last-child { border-bottom: 0; }
    .dl__bloc:first-child { padding: 0; }
    .dl__bloc:first-child .dl__t { padding: 0.6rem 0.75rem 0; }
    .dl__t { margin: 0; font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-secondaire); }
    .dl__faits { margin: 0; display: grid; gap: 0.25rem; }
    .dl__faits div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.1rem 0.5rem; padding-bottom: 0.2rem; border-bottom: 1px dotted var(--bordure); }
    .dl__faits dt { color: var(--texte-secondaire); }
    .dl__faits dd { margin: 0; text-align: right; }
    .dl__vide { margin: 0; color: var(--texte-secondaire); }
    .dl__alerte { margin: 0; padding: 0.35rem 0.5rem; border-radius: 5px; background: var(--retard-fond); color: var(--retard-texte); }
    .dl__retard { color: var(--retard-texte); font-weight: 500; }
    .dl__d { white-space: nowrap; }
    .dl__nr { color: var(--texte-secondaire); }
    .dl__plus { justify-self: start; }
    .dl__jalons { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    .dl__jalons th, .dl__jalons td { text-align: left; padding: 0.2rem 0.35rem; border-bottom: 1px solid var(--bordure); }
    .dl__jalons th { background: var(--tableau-entete); font-weight: 500; font-size: 0.72rem; }
    @media (max-width: 64rem) { .dl { grid-template-columns: minmax(0, 1fr); } .dl__bloc { border-right: 0; border-bottom: 1px solid var(--bordure); } }
  `,
})
export class DetailLigne {
  private readonly source = inject(ChainesDuPlan);

  readonly marche = input.required<Marche>();
  readonly previsions = input<readonly MarchePrevision[]>([]);
  readonly echeances = input<readonly Echeance[]>([]);
  readonly capms = input<ReadonlyMap<string, string>>(new Map());
  /** Dates réelles calculées par le serveur pour cette ligne ; `null` tant que la lecture n'a pas répondu (ou a échoué). */
  readonly reels = input<readonly JalonReel[] | null>(null);
  /** Les trois blocs l'un sous l'autre (volet de droite). */
  readonly empile = input(false);

  readonly faits = computed(() => {
    const m = this.marche();
    const f = this.source.filiation();
    const noeuds = f ? dossiersDeLaLigne(f, m).filter((n) => n.lien !== 'RACINE' && n.lien !== 'VERSION_SUIVANTE') : [];
    return faitsDeProcedure(m, this.source.eligibles().find((e) => e.idDetail === m.idDetail), noeuds);
  });
  readonly jalons = computed(() => jalonsDeLigne(this.previsions(), this.capms(), this.echeances(), isoJour(maintenantServeur()), this.reels()));
  readonly incoherence = computed(() => datesIncoherentes(this.previsions(), this.capms()));
  /** Tous les jalons, ou seulement les réalisés et les trois suivants (un plan d'appel d'offres en compte près de trente). */
  readonly tous = signal(false);
  readonly jalonsVisibles = computed(() => (this.tous() ? this.jalons() : prochainsJalons(this.jalons(), 3)));

  /** L'intitulé d'un processus jusqu'à son deux-points (« Détermination des besoins »), l'intitulé entier restant en infobulle. */
  intituleCourt(processus: string): string {
    const t = processus.split(':')[0].trim();
    return t.length > 70 ? t.slice(0, 68).trimEnd() + '…' : t;
  }
}
