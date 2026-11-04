import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { maintenantServeur } from '../../../core/horloge/heure-serveur';
import { Echeance, JalonReel, LigneEligible, Marche, MarchePrevision, NoeudFiliation } from '../../../models';
import { ChaineLigne, ChainesDuPlan, dossiersDeLaLigne } from '../../circuit/page-dossier/chaine-ligne';
import { OngletDossier } from '../../circuit/dossier/documents-du-dossier';
import { ContenuDossierChaine, OuvertureElement } from './contenu-dossier-chaine';
import { ProcedureLigne } from './procedure-ligne';
import { OuvertureEcran } from './ecrans-procedure';
import { LIBELLES_LIEN } from '../../circuit/dossier/historique-dossier';

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

/**
 * ⚠️ 04/11 (pilote, redondances) — les éléments d'un dossier que le plan ne montre pas, parce que l'écran les affiche déjà : le plan
 * lui-même (on y est) ; la fiche de présentation de tous les dossiers de la procédure sauf le dernier (celle du dossier de marché reprend
 * celle du DAO, plus l'attribution, la séance et l'évaluation) ; les informations du DAO et le bordereau d'un dossier de marché quand le
 * dossier de mise en concurrence est affiché au-dessus. `contenus` : les dossiers affichés, dans l'ordre de la chaîne.
 */
export function ongletsMasquesDe(contenus: readonly NoeudFiliation[], n: NoeudFiliation): OngletDossier[] {
  const masques: OngletDossier[] = ['plan'];
  const procedure = contenus.filter((x) => x.lien === 'MISE_EN_CONCURRENCE' || x.lien === 'MARCHE');
  if (procedure.includes(n) && procedure[procedure.length - 1] !== n) masques.push('presentation');
  if (n.lien === 'MARCHE' && contenus.some((x) => x.lien === 'MISE_EN_CONCURRENCE')) masques.push('fiche-dao', 'bordereau');
  return masques;
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
 * ⚠️ 03/11 (pilote, maquette « espace PRMP », lot 3) — le détail d'une ligne du plan : le geste suivant de sa procédure, le contenu de
 * chacun de ses dossiers (04/11), ses jalons prévus face aux dates réelles. Sert aux deux présentations du plan (document et deux volets).
 */
@Component({
  selector: 'app-detail-ligne',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChaineLigne, ContenuDossierChaine, ProcedureLigne],
  template: `
    <!-- ⚠️ 04/11 (pilote, redondances) — plus de carte « Procédure » ni de chaîne : les contenus des dossiers disent tout. Reste l'étape
         « à créer » (ou « Aucune procédure lancée »), que la chaîne n'affiche que s'il y a lieu ; puis la barre des éléments de CHAQUE
         dossier (pilote, 04/11 : chaque élément s'ouvre en MODALE, rien ne s'étale sur l'écran), l'une sous l'autre — chacune ne se lit
         qu'à l'approche de l'écran (@defer), pour que J/K ne déclenche pas toutes les lectures ; puis les jalons. -->
    <div class="dl">
      <app-chaine-ligne class="dl__carte" [marche]="marche()" [maillons]="false" />
      <!-- ⚠️ 04/11 (pilote, temps 1) — la procédure en ligne d'une fiche qui n'a pas encore son dossier : sa rangée, seule ; avec le
           dossier, elle se loge sous la barre de celui-ci (plus bas). -->
      @if (procedureSeule(); as pr) { <app-procedure-ligne class="dl__carte" [ligne]="pr" (ouvrir)="ouvrirEcran.emit($event)" /> }
      @for (n of contenus(); track n.idDossier) {
        <div class="dl__contenu" [id]="'dl-contenu-' + n.idDossier">
          @defer (on viewport) {
            <app-contenu-dossier-chaine [idDossier]="n.idDossier!" [intitule]="intitule(n)" [ongletsMasques]="masquesDe(n)" (ouvrir)="ouvrir.emit($event)">
              @if (procedureDe(n); as pr) { <app-procedure-ligne [ligne]="pr" (ouvrir)="ouvrirEcran.emit($event)" /> }
            </app-contenu-dossier-chaine>
          } @placeholder {
            <p class="dl__carte dl__vide">{{ intitule(n) }} — chargement des éléments du dossier…</p>
          }
        </div>
      }
      <section class="dl__carte" aria-labelledby="dl-jal">
        <div class="dl__entete">
          <h3 class="dl__t" id="dl-jal">Jalons</h3>
          @if (jalons().length > jalonsVisibles().length || tous()) {
            <button type="button" class="btn btn-outline btn-sm" (click)="tous.set(!tous())">
              {{ tous() ? 'Ne garder que les prochains jalons' : 'Voir les ' + jalons().length + ' jalons' }}
            </button>
          }
        </div>
        @if (incoherence(); as i) { <p class="dl__alerte" role="note">{{ i }}</p> }
        @if (jalons().length) {
          <table class="dl__jalons">
            <colgroup><col /><col class="dl__c-date" /><col class="dl__c-reel" /></colgroup>
            <thead><tr><th scope="col">Jalon</th><th scope="col">Prévu</th><th scope="col">Réel</th></tr></thead>
            <tbody>
              @for (j of jalonsVisibles(); track $index) {
                <tr>
                  <td [attr.title]="j.processus">{{ intituleCourt(j.processus) }}</td><td class="dl__d">{{ j.prevu }}</td>
                  <td class="dl__d">@if (j.reel) { <span class="dl__reel" [attr.title]="j.source">{{ j.reel }}</span> } @else if (j.sansFait) { <span class="dl__nr">non renseigné</span> } @else if (j.retard) { <span class="dl__retard" title="Date réelle non renseignée">prévu dépassé de {{ j.retard }} j</span> } @else { — }</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="dl__vide">Aucune date prévue au plan pour cette ligne.</p>
        }
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }
    .dl { display: grid; gap: 0.75rem; font-size: 0.8125rem; }
    .dl__carte { display: grid; gap: 0.6rem; align-content: start; min-width: 0; padding: 0.75rem 0.9rem; border: 1px solid var(--bordure); border-radius: 8px; background: var(--carte-fond); }
    .dl__entete { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; justify-content: space-between; }
    .dl__t { margin: 0; font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-secondaire); }
    .dl__vide { margin: 0; color: var(--texte-secondaire); }
    .dl__contenu { min-width: 0; }
    .dl__alerte { margin: 0; padding: 0.35rem 0.5rem; border-radius: 5px; background: var(--retard-fond); color: var(--retard-texte); }
    .dl__jalons { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    .dl__c-date { width: 7.5rem; }
    .dl__c-reel { width: 11rem; }
    .dl__jalons th, .dl__jalons td { text-align: left; padding: 0.3rem 0.5rem; border-bottom: 1px solid var(--bordure); }
    .dl__jalons th { background: var(--tableau-entete); font-weight: 500; font-size: 0.72rem; }
    .dl__d { white-space: nowrap; }
    .dl__reel { font-weight: 500; }
    .dl__nr { color: var(--texte-secondaire); }
    .dl__retard { color: var(--retard-texte); font-weight: 500; }
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
  /** Conservé pour les écrans qui le passent encore ; les deux cartes s'empilent toujours. */
  readonly empile = input(false);
  /** Un élément d'un dossier à ouvrir en fenêtre — rendue par l'écran hôte, hors du volet collant. */
  readonly ouvrir = output<OuvertureElement>();
  /** Un écran de la procédure en ligne à ouvrir en fenêtre — rendue par l'écran hôte, hors du volet collant. */
  readonly ouvrirEcran = output<OuvertureEcran>();

  /** Les dossiers de la ligne, sans le plan (comme la chaîne). */
  readonly noeuds = computed(() => {
    const f = this.source.filiation();
    return f ? dossiersDeLaLigne(f, this.marche()).filter((n) => n.lien !== 'RACINE' && n.lien !== 'VERSION_SUIVANTE') : [];
  });
  /** ⚠️ 04/11 (pilote) — les dossiers dont le contenu s'affiche : ceux du périmètre, dans l'ordre de la chaîne. */
  readonly contenus = computed(() => this.noeuds().filter((n) => !n.masque && n.idDossier != null));

  masquesDe(n: NoeudFiliation): OngletDossier[] {
    return ongletsMasquesDe(this.contenus(), n);
  }

  /** ⚠️ 04/11 (temps 1) — la fiche DAO de la ligne (`GET /api/dmcs/eligibles`), quand elle existe : sa procédure en ligne. */
  readonly procedure = computed<LigneEligible | null>(() => {
    const m = this.marche();
    const e = this.source.eligibles().find((x) => x.idDetail === m.idDetail);
    return e?.dejaDao && e.idDmc != null ? e : null;
  });
  /** La procédure dont le dossier de mise en concurrence est ce nœud : sa rangée se loge sous la barre du dossier. */
  procedureDe(n: NoeudFiliation): LigneEligible | null {
    const pr = this.procedure();
    return pr && n.lien === 'MISE_EN_CONCURRENCE' && pr.dossier?.idDossier === n.idDossier ? pr : null;
  }
  /** La procédure sans barre pour l'accueillir (fiche sans dossier, ou dossier hors du périmètre affiché) : sa rangée, seule. */
  readonly procedureSeule = computed(() => {
    const pr = this.procedure();
    return pr && !this.contenus().some((n) => this.procedureDe(n)) ? pr : null;
  });

  intitule(n: NoeudFiliation): string {
    const base = LIBELLES_LIEN[n.lien] ?? n.lien;
    return n.lot != null ? `${base} · lot ${n.lot}` : base;
  }

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
