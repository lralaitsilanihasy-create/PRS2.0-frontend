import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Une information reprise de la ligne du plan : code du champ, libellé du référentiel, valeur servie. */
export interface ValeurPpm {
  code: string;
  libelle: string;
  valeur: string | number | null | undefined;
}

/** Les rubriques de l'identification, dans l'ordre de lecture ; un code non rangé tombe dans « Autres informations ». */
const RUBRIQUES: readonly { titre: string; codes: readonly string[] }[] = [
  { titre: 'Autorité contractante', codes: ['B01-AC-01', 'B01-AC-02', 'B01-AC-03', 'B01-AC-04', 'B01-AC-05', 'B01-AC-06', 'B01-AC-07'] },
  { titre: 'Plan de passation', codes: ['B01-AC-11', 'B01-AC-08', 'B01-AC-09', 'B01-AC-10'] },
  { titre: 'Marché', codes: ['B02-OB-01', 'B01-AC-12', 'B01-AC-13', 'B01-AC-19', 'B01-AC-14', 'B01-AC-15', 'B01-AC-17', 'B02-LV-01', 'B02-LV-02', 'B02-LV-03'] },
];
/** Valeurs longues et structurées : présentées en tableau sous les rubriques. */
const SERVICES = 'B01-AC-16';
const CALENDRIER = 'B01-AC-18';
/** Montants en ariary (affichés avec l'unité). */
const MONTANTS = new Set(['B01-AC-14']);
/** Références et codes : police à chasse fixe. */
const CODES = new Set(['B01-AC-08', 'B01-AC-11', 'B01-AC-17']);

/** « 00-21-0-B00-00000 (159 652 575) ; … » → lignes service / montant ; `null` si le format n'est pas reconnu. */
export function lireServices(v: string | number | null | undefined): { service: string; montant: string | null }[] | null {
  const t = v == null ? '' : String(v);
  if (!t.trim()) return null;
  const lignes = t.split(/\s;\s/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = /^(.*?)\s*\(([\d\s.,]+)\)$/.exec(x);
    return m ? { service: m[1].trim(), montant: m[2].trim() } : { service: x, montant: null };
  });
  return lignes.length ? lignes : null;
}

/** « Processus : 2026-04-08 ; Processus : sans objet ; … » → lignes processus / date ; `null` si le format n'est pas reconnu. */
export function lireCalendrier(v: string | number | null | undefined): { processus: string; date: string; sansObjet: boolean }[] | null {
  const t = v == null ? '' : String(v);
  if (!t.trim()) return null;
  const lignes = t.split(/\s;\s/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.lastIndexOf(' : ');
    if (i < 0) return null;
    const brut = x.slice(i + 3).trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(brut);
    return { processus: x.slice(0, i).trim(), date: iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : brut, sansObjet: /sans objet/i.test(brut) };
  });
  return lignes.every((l) => l !== null) && lignes.length ? (lignes as { processus: string; date: string; sansObjet: boolean }[]) : null;
}

/**
 * ⚠️ 15/10 (demande du pilote) — l'identification reprise de la ligne du plan, lisible : trois rubriques (autorité contractante,
 * plan de passation, marché) en grille, valeurs en police courante (les codes et références seuls en chasse fixe), et les deux
 * valeurs longues en tableaux pleine largeur — les services bénéficiaires (service, montant) et le calendrier de passation
 * (processus, date ; replié). Une valeur au format inattendu reste affichée telle quelle.
 */
@Component({
  selector: 'app-ppm-identification',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (r of rubriques(); track r.titre) {
      <section class="pi__rub" [attr.aria-label]="r.titre">
        <h3 class="pi__titre">{{ r.titre }}</h3>
        <dl class="pi__grille">
          @for (v of r.valeurs; track v.code) {
            <div class="pi__item" [class.pi__item--large]="texte(v).length > 60">
              <dt>{{ v.libelle }}</dt>
              <dd [class.pi__code]="codes.has(v.code)">{{ texte(v) }}</dd>
            </div>
          }
        </dl>
      </section>
    }

    @if (services(); as s) {
      <section class="pi__rub" aria-label="Services bénéficiaires">
        <h3 class="pi__titre">Services bénéficiaires <span class="pi__nb">{{ s.lignes ? s.lignes.length : '' }}</span></h3>
        @if (s.lignes; as lignes) {
          <div class="cnm-table-wrap">
            <table class="cnm-table pi__table">
              <thead><tr><th scope="col">Service bénéficiaire</th><th scope="col" class="pi__num">Montant (Ariary)</th></tr></thead>
              <tbody>@for (l of lignes; track $index) { <tr><td class="pi__code">{{ l.service }}</td><td class="pi__num">{{ l.montant ?? '—' }}</td></tr> }</tbody>
            </table>
          </div>
        } @else { <p class="pi__brut">{{ s.brut }}</p> }
      </section>
    }

    @if (calendrier(); as c) {
      <details class="pi__rub pi__cal">
        <summary class="pi__titre">Calendrier de passation <span class="pi__nb">{{ c.lignes ? c.lignes.length + ' processus' : '' }}</span></summary>
        @if (c.lignes; as lignes) {
          <div class="cnm-table-wrap">
            <table class="cnm-table pi__table">
              <thead><tr><th scope="col">Processus</th><th scope="col" class="pi__date">Date prévue</th></tr></thead>
              <tbody>@for (l of lignes; track $index) { <tr><td>{{ l.processus }}</td><td class="pi__date" [class.pi__so]="l.sansObjet">{{ l.date }}</td></tr> }</tbody>
            </table>
          </div>
        } @else { <p class="pi__brut">{{ c.brut }}</p> }
      </details>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.9rem; margin-top: 0.7rem; }
    /* ⚠️ 15/10 (demande du pilote) — titres de rubrique et en-têtes de colonnes en couleur : bleu de la charte (--p-700 sur blanc,
       --p-800 sur --p-100 : contraste AA largement tenu). */
    .pi__titre { margin: 0 0 0.55rem; padding: 0.3rem 0.6rem; font-size: 0.8rem; font-weight: 700; color: var(--p-700); background: var(--p-50, #f0f9ff);
      border-left: 3px solid var(--p-600); border-radius: 0 6px 6px 0; text-transform: uppercase; letter-spacing: 0.04em; }
    .pi__nb { font-weight: 600; color: var(--p-800); text-transform: none; letter-spacing: 0; margin-left: 0.3rem; }
    .pi__table thead th { background: var(--p-100); color: var(--p-800); font-weight: 700; border-bottom: 2px solid var(--p-300); }
    .pi__grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.55rem 1.25rem; margin: 0; }
    .pi__item { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
    .pi__item--large { grid-column: 1 / -1; }
    .pi__item dt { font-size: 0.74rem; color: var(--n-500); }
    .pi__item dd { margin: 0; font-size: 0.88rem; color: var(--n-900); overflow-wrap: anywhere; }
    .pi__code { font-family: var(--cnm-mono); font-size: 0.82rem; }
    .pi__table { font-size: 0.84rem; table-layout: fixed; width: 100%; }
    .pi__table th, .pi__table td { padding-top: 0.3rem; padding-bottom: 0.3rem; white-space: normal; overflow-wrap: anywhere; }
    .pi__table th.pi__num, .pi__table th.pi__date { width: 9.5rem; }
    .pi__num, .pi__date { text-align: right; }
    .pi__table td.pi__num, .pi__table td.pi__date { white-space: nowrap; }
    .pi__so { color: var(--n-500); font-style: italic; }
    .pi__cal summary { cursor: pointer; }
    .pi__brut { margin: 0; font-size: 0.84rem; overflow-wrap: anywhere; }
  `,
})
export class PpmIdentification {
  readonly valeurs = input.required<ValeurPpm[]>();
  readonly codes = CODES;

  readonly rubriques = computed(() => {
    const par = new Map(this.valeurs().map((v) => [v.code, v]));
    const ranges = new Set([SERVICES, CALENDRIER]);
    const rubriques = RUBRIQUES.map((r) => ({
      titre: r.titre,
      valeurs: r.codes.filter((c) => par.has(c)).map((c) => (ranges.add(c), par.get(c)!)),
    }));
    const autres = this.valeurs().filter((v) => !ranges.has(v.code));
    if (autres.length) rubriques.push({ titre: 'Autres informations', valeurs: autres });
    return rubriques.filter((r) => r.valeurs.length);
  });
  readonly services = computed(() => {
    const v = this.valeurs().find((x) => x.code === SERVICES);
    return v ? { brut: String(v.valeur ?? '—'), lignes: lireServices(v.valeur) } : null;
  });
  readonly calendrier = computed(() => {
    const v = this.valeurs().find((x) => x.code === CALENDRIER);
    return v ? { brut: String(v.valeur ?? '—'), lignes: lireCalendrier(v.valeur) } : null;
  });

  texte(v: ValeurPpm): string {
    if (v.valeur == null || v.valeur === '') return '—';
    return MONTANTS.has(v.code) ? `${v.valeur} Ar` : String(v.valeur);
  }
}
