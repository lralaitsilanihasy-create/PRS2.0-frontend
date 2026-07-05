import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { Marche, MarchePrevision, ServiceBeneficiaire } from '../../models';
import {
  CapmService,
  ModePassationService,
  NatureService,
  ReferenceLookupService,
} from '../../services';

/** Bénéficiaire d'une ligne (placeholder vide `{}` si aucun, pour garder une ligne). */
interface BenefRow {
  soaCode?: string;
  numCompte?: string;
  ancMontBenef?: number | null;
  nouvMontBenef?: number | null;
}
/** Ligne de marché mise en forme pour le tableau (libellés résolus, dates par jalon). */
interface MarcheRow {
  nature: string;
  objet: string;
  montEstim?: number | null;
  nouvMontEstim?: number | null;
  mode: string;
  financement: string;
  benefRows: BenefRow[];
  dateLancement: string;
  dateOuverture: string;
  dateAttribution: string;
}

/**
 * Affichage **lecture seule** des lignes de marché d'un PPM, mis en forme comme le PPM officiel
 * (mêmes colonnes que la saisie / l'aperçu). Reçoit les données déjà chargées (marchés,
 * bénéficiaires, prévisions) et **résout lui-même** les libellés (nature / mode / CAPM) via le
 * cache `ReferenceLookupService`. Réutilisable dans tous les écrans / profils.
 */
@Component({
  selector: 'app-ppm-marches-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length) {
      <div class="pmt-wrap">
        <table class="pmt">
          <colgroup>
            <col style="width: 7%" /><col style="width: 15%" /><col style="width: 9%" /><col style="width: 9%" />
            <col style="width: 7%" /><col style="width: 6%" /><col style="width: 9%" /><col style="width: 5%" />
            <col style="width: 9%" /><col style="width: 9%" /><col style="width: 5%" /><col style="width: 5%" /><col style="width: 5%" />
          </colgroup>
          <thead>
            <tr>
              <th rowspan="2">Nature</th>
              <th rowspan="2">Objet</th>
              <th rowspan="2">Montant estimatif initial</th>
              <th rowspan="2">Nouveau montant estimatif</th>
              <th rowspan="2">Mode de passation</th>
              <th rowspan="2">Financement</th>
              <th colspan="4">Informations sur le bénéficiaire</th>
              <th rowspan="2">Date prév. de lancement</th>
              <th rowspan="2">Date prév. ouverture des plis</th>
              <th rowspan="2">Date prév. d'attribution</th>
            </tr>
            <tr>
              <th>Service bénéficiaire</th><th>Compte</th><th>Montant estimatif par bénéficiaire</th><th>Nouveau montant estimatif par bénéficiaire</th>
            </tr>
          </thead>
          <tbody>
            @for (m of rows(); track $index) {
              @for (b of m.benefRows; track $index; let first = $first) {
                <tr>
                  @if (first) {
                    <td [attr.rowspan]="m.benefRows.length">{{ m.nature }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="pmt-objet">{{ m.objet }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="pmt-num">{{ montantFmt(m.montEstim) }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="pmt-num">{{ montantFmt(m.nouvMontEstim) }}</td>
                    <td [attr.rowspan]="m.benefRows.length">{{ m.mode }}</td>
                    <td [attr.rowspan]="m.benefRows.length">{{ m.financement }}</td>
                  }
                  <td>{{ b.soaCode || '' }}</td>
                  <td>{{ b.numCompte || '' }}</td>
                  <td class="pmt-num">{{ montantFmt(b.ancMontBenef) }}</td>
                  <td class="pmt-num">{{ montantFmt(b.nouvMontBenef) }}</td>
                  @if (first) {
                    <td [attr.rowspan]="m.benefRows.length" class="pmt-date">{{ m.dateLancement }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="pmt-date">{{ m.dateOuverture }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="pmt-date">{{ m.dateAttribution }}</td>
                  }
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="pmt-empty">Aucune ligne de marché.</p>
    }
  `,
  styles: `
    .pmt-wrap { overflow-x: auto; }
    .pmt { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 0.64rem; }
    .pmt th, .pmt td { border: 1px solid var(--n-300, #c8c8c8); padding: 2px 4px; vertical-align: top; overflow-wrap: break-word; word-break: break-word; }
    .pmt thead th { background: var(--n-50, #f4f4f5); text-align: center; font-weight: 700; color: var(--n-800, #27272a); line-height: 1.1; }
    .pmt-num { text-align: right; white-space: nowrap; }
    .pmt-date { text-align: center; white-space: nowrap; }
    .pmt-objet { white-space: pre-wrap; }
    .pmt-empty { color: var(--n-400, #71717a); margin: 0; }
  `,
})
export class PpmMarchesTable implements OnInit {
  /** Marchés à afficher (déjà chargés par l'écran appelant). */
  readonly marches = input<Marche[]>([]);
  /** Services bénéficiaires de ces marchés (tous marchés confondus ; regroupés par idDetail en interne). */
  readonly beneficiaires = input<ServiceBeneficiaire[]>([]);
  /** Dates prévisionnelles de ces marchés (regroupées par idDetail en interne). */
  readonly previsions = input<MarchePrevision[]>([]);

  private readonly lookups = inject(ReferenceLookupService);
  private readonly natureMap = signal<Map<string, string>>(new Map());
  private readonly modeMap = signal<Map<string, string>>(new Map());
  private readonly capmMap = signal<Map<string, string>>(new Map());

  ngOnInit(): void {
    this.lookups.lookup(NatureService, 'idNature', ['libelle']).subscribe((m) => this.natureMap.set(m));
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.lookups.lookup(CapmService, 'idCapm', ['libelleProcessus']).subscribe((m) => this.capmMap.set(m));
  }

  /** Lignes mises en forme (libellés résolus, bénéficiaires et dates regroupés par marché). */
  readonly rows = computed<MarcheRow[]>(() => {
    const benefByDetail = new Map<number, ServiceBeneficiaire[]>();
    for (const b of this.beneficiaires()) {
      const l = benefByDetail.get(b.idDetail) ?? [];
      l.push(b);
      benefByDetail.set(b.idDetail, l);
    }
    const prevByDetail = new Map<number, MarchePrevision[]>();
    for (const p of this.previsions()) {
      const l = prevByDetail.get(p.idDetail) ?? [];
      l.push(p);
      prevByDetail.set(p.idDetail, l);
    }
    const capm = this.capmMap();
    return this.marches().map((m) => {
      const prevs = prevByDetail.get(m.idDetail) ?? [];
      const dateDe = (kw: string): string => {
        const p = prevs.find((x) => (capm.get(String(x.idCapm)) ?? '').toUpperCase().includes(kw));
        return p ? this.dateFr(p.dateDebut) : '';
      };
      const benefs = benefByDetail.get(m.idDetail) ?? [];
      return {
        nature: this.lbl(this.natureMap(), m.idNature),
        objet: m.designationMarche ?? '',
        montEstim: m.montEstim,
        nouvMontEstim: m.nouvMontEstim,
        mode: this.lbl(this.modeMap(), m.idMode),
        financement: m.financement ?? '',
        benefRows: benefs.length
          ? benefs.map((b) => ({ soaCode: b.soaCode, numCompte: b.numCompte, ancMontBenef: b.ancMontBenef, nouvMontBenef: b.nouvMontBenef }))
          : [{}],
        dateLancement: dateDe('LANCEMENT'),
        dateOuverture: dateDe('OUVERTURE'),
        dateAttribution: dateDe('ATTRIBUTION'),
      };
    });
  });

  private lbl(map: Map<string, string>, id?: number): string {
    return id === null || id === undefined ? '' : map.get(String(id)) ?? `#${id}`;
  }
  /** Montant avec séparateur de milliers **visible** (espace insécable) et 2 décimales, ou '' si absent. */
  montantFmt(v?: number | null): string {
    if (v === null || v === undefined) return '';
    const [ent, dec] = Math.abs(Number(v)).toFixed(2).split('.');
    return (Number(v) < 0 ? '-' : '') + ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec;
  }
  /** Date ISO `yyyy-MM-dd` → `dd/MM/yyyy` (vide si absente). */
  private dateFr(iso?: string | null): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  }
}
