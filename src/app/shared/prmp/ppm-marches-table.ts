import { ChangeDetectionStrategy, Component, OnInit, TemplateRef, computed, contentChild, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { FORME_MARCHE_LIBELLES, Marche, MarchePrevision, ServiceBeneficiaire } from '../../models';
import {
  CapmService,
  ModePassationService,
  NatureService,
  ReferenceLookupService,
  TypeDmcService,
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
  /** Marché d'origine — contexte transmis au template d'actions optionnel (`#rowActions`). */
  source: Marche;
  nature: string;
  objet: string;
  montEstim?: number | null;
  nouvMontEstim?: number | null;
  mode: string;
  /** Type de DMC **dérivé** du mode (code court + libellé en tooltip) ; absent si mode non mappé. */
  typeDmcCode?: string;
  typeDmcLibelle?: string;
  /** Libellé de la forme du marché — vide si `QUANTITE_FIXE` (défaut non affiché, seules les exceptions le sont). */
  formeLibelle: string;
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
  imports: [NgTemplateOutlet],
  template: `
    @if (rows().length) {
      <div class="pmt-wrap">
        <table class="pmt">
          <colgroup>
            <col style="width: 6%" /><col style="width: 15%" /><col style="width: 9%" /><col style="width: 9%" />
            <col style="width: 6%" /><col style="width: 5%" /><col style="width: 8%" /><col style="width: 5%" />
            <col style="width: 9%" /><col style="width: 9%" /><col style="width: 6%" /><col style="width: 6%" /><col style="width: 6%" />
            @if (actionsTpl()) { <col style="width: 11%" /> }
          </colgroup>
          <thead>
            <tr>
              <th rowspan="2">NATURE</th>
              <th rowspan="2">OBJET</th>
              <th rowspan="2">MONTANT ESTIMATIF INITIAL</th>
              <th rowspan="2">NOUVEAU MONTANT ESTIMATIF</th>
              <th rowspan="2">MODE DE PASSATION</th>
              <th rowspan="2">FINANCEMENT</th>
              <th colspan="4">Informations sur le Bénéficiaire</th>
              <th rowspan="2">DATE PREVISIONNELLE DE LANCEMENT</th>
              <th rowspan="2">DATE PREVISIONNELLE OUVERTURE DES PLIS</th>
              <th rowspan="2">DATE PREVISIONNELLE D'ATTRIBUTION</th>
              @if (actionsTpl()) { <th rowspan="2">ACTIONS</th> }
            </tr>
            <tr>
              <th>SERVICE BENEFICIAIRE</th><th>COMPTE</th><th>MONTANT ESTIMATIF PAR BENEFICIAIRE</th><th>NOUVEAU MONTANT ESTIMATIF PAR BENEFICIAIRE</th>
            </tr>
          </thead>
          <tbody>
            @for (m of rows(); track $index) {
              @for (b of m.benefRows; track $index; let first = $first) {
                <tr [class.pmt-row-done]="etat(m.source) === 'done'" [class.pmt-row-current]="etat(m.source) === 'current'">
                  @if (first) {
                    <td [attr.rowspan]="m.benefRows.length">{{ m.nature }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="pmt-objet">{{ m.objet }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="pmt-num">{{ montantFmt(m.montEstim) }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="pmt-num">{{ montantFmt(m.nouvMontEstim) }}</td>
                    <td [attr.rowspan]="m.benefRows.length">
                      {{ m.mode }}
                      @if (m.typeDmcCode) {
                        <span class="badge pmt-dmc" [title]="m.typeDmcLibelle || ''">{{ m.typeDmcCode }}</span>
                      } @else if (m.mode) {
                        <span class="badge badge-warning pmt-dmc" title="Aucun type de DMC mappé pour ce mode. Configurez le mapping en administration.">DMC ?</span>
                      }
                      @if (m.formeLibelle) {
                        <span class="badge pmt-forme" title="Forme du marché">{{ m.formeLibelle }}</span>
                      }
                    </td>
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
                    @if (actionsTpl(); as tpl) {
                      <td [attr.rowspan]="m.benefRows.length" class="pmt-actions">
                        <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: m.source }" />
                      </td>
                    }
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
    .pmt-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    /* min-width : en dessous, .pmt-wrap défile au lieu de tasser les 13 colonnes (illisible sur mobile) ;
       au-dessus, le tableau reste à 100 % de son conteneur (desktop inchangé). */
    .pmt { border-collapse: collapse; width: 100%; min-width: 56rem; table-layout: fixed; font-size: 0.64rem; color: #000; background: #fff; }
    /* white-space: normal force le retour à la ligne (évite un nowrap hérité d'un style global de th/table). */
    .pmt th, .pmt td { border: 1px solid #000; padding: 3px 4px; vertical-align: top; white-space: normal; overflow-wrap: break-word; word-break: break-word; }
    .pmt thead th { background: #f0f0f0; text-align: center; font-weight: 700; line-height: 1.15; }
    .pmt td.pmt-num { text-align: right; }
    .pmt td.pmt-date { text-align: center; white-space: nowrap; }
    .pmt td.pmt-objet { white-space: pre-wrap; }
    /* Badge de type de DMC (dérivé) : compact pour cette table dense ; libellé complet en tooltip. */
    .pmt .pmt-dmc { display: inline-block; margin-top: 2px; font-size: 0.56rem; padding: 0 3px; line-height: 1.4; }
    /* Badge de forme du marché (affiché seulement hors défaut « à quantité fixe »). */
    .pmt .pmt-forme { display: inline-block; margin-top: 2px; font-size: 0.56rem; padding: 0 3px; line-height: 1.4; background: var(--p-50, #eef2ff); color: var(--p-600, #4f46e5); border: 1px solid var(--p-200, #c7d2fe); }
    .pmt-empty { color: var(--n-400, #71717a); margin: 0; }
    /* États d'examen séquentiel : ligne traitée (vert) / en cours (bleu) ; les autres restent neutres. */
    .pmt tbody tr.pmt-row-done > td { background: var(--success-bg, #ecfdf5); }
    .pmt tbody tr.pmt-row-current > td { background: var(--info-bg, #eff6ff); box-shadow: inset 3px 0 0 var(--info-text, #2563eb); }
  `,
})
export class PpmMarchesTable implements OnInit {
  /** Marchés à afficher (déjà chargés par l'écran appelant). */
  readonly marches = input<Marche[]>([]);
  /** Services bénéficiaires de ces marchés (tous marchés confondus ; regroupés par idDetail en interne). */
  readonly beneficiaires = input<ServiceBeneficiaire[]>([]);
  /** Dates prévisionnelles de ces marchés (regroupées par idDetail en interne). */
  readonly previsions = input<MarchePrevision[]>([]);
  /** Colonne ACTIONS optionnelle : template projeté `#rowActions` (contexte = le `Marche` de la ligne). */
  readonly actionsTpl = contentChild<TemplateRef<unknown>>('rowActions');
  /** État visuel optionnel d'une ligne (ex. examen séquentiel) : 'done' | 'current' | 'pending' → classe de fond. */
  readonly rowStateFn = input<((idDetail: number) => 'done' | 'current' | 'pending' | null) | null>(null);

  private readonly lookups = inject(ReferenceLookupService);
  private readonly modeService = inject(ModePassationService);
  private readonly typeDmcService = inject(TypeDmcService);
  private readonly natureMap = signal<Map<string, string>>(new Map());
  private readonly modeMap = signal<Map<string, string>>(new Map());
  private readonly capmMap = signal<Map<string, string>>(new Map());
  /** idMode → type de DMC dérivé (code + libellé), pour les modes mappés à un type. */
  private readonly modeTypeMap = signal<Map<number, { code: string; libelle: string }>>(new Map());

  ngOnInit(): void {
    this.lookups.lookup(NatureService, 'idNature', ['libelle']).subscribe((m) => this.natureMap.set(m));
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.lookups.lookup(CapmService, 'idCapm', ['libelleProcessus']).subscribe((m) => this.capmMap.set(m));
    // Type de DMC dérivé du mode : idMode → idTypeDmc → code/libellé. Chargé une fois (pas d'appel par ligne).
    this.modeService.list().subscribe((modes) => {
      this.typeDmcService.list().subscribe((types) => {
        const typeById = new Map(types.map((t) => [t.idTypeDmc, t]));
        const map = new Map<number, { code: string; libelle: string }>();
        for (const md of modes) {
          const t = md.idTypeDmc != null ? typeById.get(md.idTypeDmc) : undefined;
          if (t) map.set(md.idMode, { code: t.code, libelle: t.libelle });
        }
        this.modeTypeMap.set(map);
      });
    });
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
      const dmc = m.idMode != null ? this.modeTypeMap().get(m.idMode) : undefined;
      return {
        source: m,
        nature: this.lbl(this.natureMap(), m.idNature),
        objet: m.designationMarche ?? '',
        montEstim: m.montEstim,
        nouvMontEstim: m.nouvMontEstim,
        mode: this.lbl(this.modeMap(), m.idMode),
        typeDmcCode: dmc?.code,
        typeDmcLibelle: dmc?.libelle,
        // Forme affichée seulement hors défaut (« À quantité fixe » sur chaque ligne serait du bruit).
        formeLibelle: m.formeMarche && m.formeMarche !== 'QUANTITE_FIXE' ? FORME_MARCHE_LIBELLES[m.formeMarche] : '',
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

  /** État visuel d'une ligne (délègue au `rowStateFn` fourni ; `null` si aucun). */
  etat(m: Marche): 'done' | 'current' | 'pending' | null {
    const fn = this.rowStateFn();
    return fn ? fn(m.idDetail) : null;
  }

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
