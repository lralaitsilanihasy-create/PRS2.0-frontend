import { ChangeDetectionStrategy, Component, OnInit, TemplateRef, computed, contentChild, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Marche, MarchePrevision, ServiceBeneficiaire, TypeChangementLigne } from '../../models';
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
/** État visuel d'une ligne dans l'examen séquentiel. */
export type RowExamState = 'current' | 'done-ras' | 'done-obs' | 'pending';

/** Ligne de marché mise en forme pour le tableau (libellés résolus, dates par jalon). */
interface MarcheRow {
  /** Marché d'origine — contexte transmis au template d'actions optionnel (`#rowActions`). */
  source: Marche;
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
  imports: [NgTemplateOutlet],
  template: `
    @if (rows().length) {
      <!-- Légende du versionnement : visible seulement si au moins une ligne diffère de la version
           précédente (le surlignage doit rester lisible dans TOUS les profils qui voient ce tableau). -->
      @if (typesPresents().length) {
        <div class="pmt-legende">
          <span class="pmt-legende-titre">{{ legendeTitre() }}</span>
          @for (t of typesPresents(); track t) {
            <span class="pmt-legende-chip" [class]="'pmt-legende-chip--' + t.toLowerCase()">{{ chgLabel(t) }}</span>
          }
        </div>
      }
      <!-- ⚠️ 2026-08-06 — présentation COMMUNE à tous les tableaux du dossier de planification
           (« .ppm-table », styles/_ppm-table.scss) : le tableau tient dans l'écran, seules les
           colonnes d'identité restent à gauche. « .pmt » ne porte plus que ce qui lui est propre
           (états d'examen, badges). -->
      <div class="pmt-wrap ppm-table-wrap">
        <table class="pmt ppm-table">
          <!-- Largeurs calibrées sur le plus long libellé d'en-tête d'un mot seul (FINANCEMENT,
               COMPTE) et sur un montant à 10 chiffres, qui ne doivent jamais se couper. Les deux
               colonnes optionnelles portent la somme au-delà de 100 % : le navigateur normalise. -->
          <colgroup>
            @if (rowStateFn()) { <col style="width: 3%" /> }
            <col style="width: 7%" /><col style="width: 17%" /><col style="width: 8%" /><col style="width: 8%" />
            <col style="width: 8%" /><col style="width: 7%" /><col style="width: 7%" /><col style="width: 5%" />
            <col style="width: 8%" /><col style="width: 8%" /><col style="width: 6%" /><col style="width: 6%" /><col style="width: 6%" />
            @if (actionsTpl()) { <col style="width: 9%" /> }
          </colgroup>
          <thead>
            <tr>
              @if (rowStateFn()) { <th scope="col" rowspan="2" class="ppm-c" title="État d'examen de la ligne"></th> }
              <th scope="col" rowspan="2">NATURE</th>
              <th scope="col" rowspan="2">OBJET</th>
              <th scope="col" rowspan="2" class="ppm-c">MONTANT ESTIMATIF INITIAL</th>
              <th scope="col" rowspan="2" class="ppm-c">NOUVEAU MONTANT ESTIMATIF</th>
              <th scope="col" rowspan="2" class="ppm-c">MODE DE PASSATION</th>
              <th scope="col" rowspan="2" class="ppm-c">FINANCEMENT</th>
              <th scope="col" colspan="4" class="ppm-c">Informations sur le Bénéficiaire</th>
              <th scope="col" rowspan="2" class="ppm-c">DATE PREVISIONNELLE DE LANCEMENT</th>
              <th scope="col" rowspan="2" class="ppm-c">DATE PREVISIONNELLE OUVERTURE DES PLIS</th>
              <th scope="col" rowspan="2" class="ppm-c">DATE PREVISIONNELLE D'ATTRIBUTION</th>
              @if (actionsTpl()) { <th scope="col" rowspan="2" class="ppm-c">ACTIONS</th> }
            </tr>
            <tr>
              <th scope="col" class="ppm-c">SERVICE BENEFICIAIRE</th><th scope="col" class="ppm-c">COMPTE</th><th scope="col" class="ppm-c">MONTANT ESTIMATIF PAR BENEFICIAIRE</th><th scope="col" class="ppm-c">NOUVEAU MONTANT ESTIMATIF PAR BENEFICIAIRE</th>
            </tr>
          </thead>
          <tbody>
            @for (m of rows(); track $index) {
              @for (b of m.benefRows; track $index; let first = $first) {
                <tr [class]="rowClass(m.source)"
                    [class.pmt-lead]="first"
                    [class.pmt-clickable]="rowStateFn()"
                    [attr.title]="detailDe(m.source)"
                    (click)="onRowClick(m.source)">
                  @if (first) {
                    <!-- État d'examen : ✓ vert = examinée sans observation ; ✗ rouge = avec observation(s) ; ● = en cours. -->
                    @if (rowStateFn()) {
                      <td [attr.rowspan]="m.benefRows.length" class="pmt-etat">
                        @switch (etat(m.source)) {
                          @case ('done-ras') { <span class="pmt-etat-ok" title="Examinée — sans observation">✓</span> }
                          @case ('done-obs') { <span class="pmt-etat-obs" title="Examinée — avec observation(s)">✗</span> }
                          @case ('current') { <span class="pmt-etat-cur" title="Ligne en cours d'examen">●</span> }
                          @default { <span class="pmt-etat-att" title="À examiner">•</span> }
                        }
                      </td>
                    }
                    <td [attr.rowspan]="m.benefRows.length">{{ m.nature }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="pmt-objet ppm-objet">{{ m.objet }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="ppm-mont">{{ montantFmt(m.montEstim) }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="ppm-mont">{{ montantFmt(m.nouvMontEstim) }}</td>
                    <!-- ⚠️ Demande pilote (2026-09-03) — le SEUL libellé du mode, sans badges
                         (type DMC, forme, catégorie) : règle valable pour tout affichage du mode
                         de passation, tout profil — ce tableau partagé est la source unique. -->
                    <td [attr.rowspan]="m.benefRows.length" class="ppm-c">{{ m.mode }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="ppm-c">{{ m.financement }}</td>
                  }
                  <td class="ppm-c">{{ b.soaCode || '' }}</td>
                  <td class="ppm-c">{{ b.numCompte || '' }}</td>
                  <td class="ppm-mont">{{ montantFmt(b.ancMontBenef) }}</td>
                  <td class="ppm-mont">{{ montantFmt(b.nouvMontBenef) }}</td>
                  @if (first) {
                    <td [attr.rowspan]="m.benefRows.length" class="ppm-date">{{ m.dateLancement }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="ppm-date">{{ m.dateOuverture }}</td>
                    <td [attr.rowspan]="m.benefRows.length" class="ppm-date">{{ m.dateAttribution }}</td>
                    @if (actionsTpl(); as tpl) {
                      <td [attr.rowspan]="m.benefRows.length" class="pmt-actions ppm-actions">
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
    /* ⚠️ 2026-08-06 — cadre, largeurs, retours à la ligne, alignements et en-tête bleu viennent
       désormais de « .ppm-table » (styles/_ppm-table.scss), commun à tous les tableaux du dossier de
       planification. Ce qui suit est PROPRE à ce tableau : états d'examen et badges.
       ⚠️ Ne pas y remettre « min-width », « border 1px solid #000 » ni un fond d'en-tête : c'est ce qui
       imposait le défilement horizontal et l'ancien rendu « document ». */
    .pmt td.pmt-objet { white-space: pre-wrap; }
    /* (Badges type DMC / forme / catégorie retirés le 2026-09-03 : la colonne Mode n'affiche que le libellé.) */
    .pmt-empty { color: var(--n-400, #71717a); margin: 0; }
    /* Versionnement : lignes changées vs version précédente — fonds pastel distincts + liseré gauche.
       Déclarées AVANT les états d'examen pour que l'examen (workflow actif) garde la priorité visuelle. */
    .pmt tbody tr.pmt-chg-modifiee > td { background: #FEF3C7; }
    .pmt tbody tr.pmt-chg-modifiee.pmt-lead > td:first-child { box-shadow: inset 3px 0 0 #F59E0B; }
    .pmt tbody tr.pmt-chg-nouvelle > td { background: #DCFCE7; }
    .pmt tbody tr.pmt-chg-nouvelle.pmt-lead > td:first-child { box-shadow: inset 3px 0 0 #16A34A; }
    .pmt tbody tr.pmt-chg-restauree > td { background: #E0F2FE; }
    .pmt tbody tr.pmt-chg-restauree.pmt-lead > td:first-child { box-shadow: inset 3px 0 0 #0284C7; }
    /* Légende (chips aux mêmes fonds que les lignes). */
    .pmt-legende { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.45rem; font-size: var(--text-xs, 0.75rem); }
    .pmt-legende-titre { font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--n-400, #71717a); }
    .pmt-legende-chip { padding: 0.1rem 0.5rem; border-radius: 999px; font-weight: 600; color: #000; }
    .pmt-legende-chip--modifiee { background: #FEF3C7; border: 1px solid #F59E0B; }
    .pmt-legende-chip--nouvelle { background: #DCFCE7; border: 1px solid #16A34A; }
    .pmt-legende-chip--restauree { background: #E0F2FE; border: 1px solid #0284C7; }
    /* États d'examen séquentiel : à examiner (neutre) / EN COURS (indigo appuyé, bien visible) /
       examinée RAS (vert + ✓) / examinée avec observation (rouge + ✗). */
    .pmt tbody tr.pmt-clickable { cursor: pointer; }
    .pmt tbody tr.pmt-row-current > td { background: #E0E7FF; }
    .pmt tbody tr.pmt-row-current.pmt-lead > td:first-child { box-shadow: inset 5px 0 0 #4F46E5; }
    .pmt tbody tr.pmt-row-done-ras > td { background: #F0FDF4; }
    .pmt tbody tr.pmt-row-done-ras.pmt-lead > td:first-child { box-shadow: inset 3px 0 0 #22C55E; }
    .pmt tbody tr.pmt-row-done-obs > td { background: #FEF2F2; }
    .pmt tbody tr.pmt-row-done-obs.pmt-lead > td:first-child { box-shadow: inset 3px 0 0 #DC2626; }
    /* Colonne d'état (mode examen) : marqueur centré, gros et contrasté. */
    .pmt td.pmt-etat { text-align: center; vertical-align: middle; font-size: 1.05rem; font-weight: 800; }
    .pmt-etat-ok { color: #16A34A; }
    .pmt-etat-obs { color: #DC2626; }
    .pmt-etat-cur { color: #4F46E5; }
    .pmt-etat-att { color: var(--n-300, #d4d4d8); }
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
  /**
   * État visuel optionnel d'une ligne (examen séquentiel) → classe de fond :
   * `current` (en cours), `done-ras` (examinée, RAS), `done-obs` (examinée avec observation), `pending` (à examiner).
   */
  readonly rowStateFn = input<((idDetail: number) => RowExamState | null) | null>(null);
  /** Émis au clic sur une ligne (le `Marche` cliqué) — sert à rouvrir une ligne déjà examinée. Actif seulement si `rowStateFn` est fourni. */
  readonly rowClick = output<Marche>();
  /**
   * Versionnement (optionnel) : idDetail → type de changement vs la version précédente
   * (`GET /api/dossiers/{id}/diff`). Les lignes MODIFIEE / NOUVELLE / RESTAUREE reçoivent un fond
   * distinctif + une légende ; INCHANGEE reste neutre (les SUPPRIMEE ne figurent pas dans ce tableau).
   */
  readonly changements = input<Map<number, TypeChangementLigne> | null>(null);
  /** Titre de la légende du surlignage (« Mise à jour : » par défaut ; « Rectification : » au diff de rectification). */
  readonly legendeTitre = input('Mise à jour :');
  /**
   * Détail humain des champs changés par ligne (idDetail → « champ : avant → après ; … ») — affiché
   * en infobulle sur la ligne surlignée (2026-08-15, visibilité de la rectification au vérificateur).
   */
  readonly detailsChangements = input<Map<number, string> | null>(null);

  /** Infobulle de la ligne : détail des champs changés, seulement si la ligne est surlignée. */
  detailDe(m: Marche): string | null {
    return this.chg(m) ? this.detailsChangements()?.get(m.idDetail) ?? null : null;
  }

  private readonly lookups = inject(ReferenceLookupService);
  private readonly natureMap = signal<Map<string, string>>(new Map());
  private readonly modeMap = signal<Map<string, string>>(new Map());
  private readonly capmMap = signal<Map<string, string>>(new Map());

  // ⚠️ Demande pilote (2026-09-03) — la colonne Mode n'affiche plus QUE le libellé : la dérivation
  // type DMC / catégorie / forme (badges) et son chargement (modes + types-dmc) ont été retirés.
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
    // ⚠️ 2026-08-05 (versionnement des PPM) — une ligne SUPPRIMÉE d'une version est conservée en base
    // (restaurable, jamais effacée) mais ne fait plus partie du plan : elle est donc absente de toute
    // vue « officielle » du PPM (consultation, détail, grille d'examen, dates prévisionnelles).
    // L'écran de mise à jour, lui, a sa propre table et continue de les montrer, grisées.
    return this.marches().filter((m) => !m.supprimee).map((m) => {
      const prevs = prevByDetail.get(m.idDetail) ?? [];
      const dateDe = (kw: string): string => {
        const p = prevs.find((x) => (capm.get(String(x.idCapm)) ?? '').toUpperCase().includes(kw));
        return p ? this.dateFr(p.dateDebut) : '';
      };
      const benefs = benefByDetail.get(m.idDetail) ?? [];
      return {
        source: m,
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

  /** État visuel d'une ligne (délègue au `rowStateFn` fourni ; `null` si aucun). */
  etat(m: Marche): RowExamState | null {
    const fn = this.rowStateFn();
    return fn ? fn(m.idDetail) : null;
  }
  /** Type de changement d'une ligne (hors INCHANGEE) — `null` si pas de diff fourni. */
  private chg(m: Marche): TypeChangementLigne | null {
    const t = this.changements()?.get(m.idDetail);
    return t && t !== 'INCHANGEE' ? t : null;
  }
  /** Classes de la ligne : état d'examen (prioritaire visuellement) + changement de version. */
  rowClass(m: Marche): string {
    const exam = this.etat(m);
    const chg = this.chg(m);
    return [exam ? 'pmt-row-' + exam : '', chg ? 'pmt-chg-' + chg.toLowerCase() : ''].filter(Boolean).join(' ');
  }
  /** Types de changement présents parmi les lignes affichées (pilote la légende, dans un ordre stable). */
  readonly typesPresents = computed<TypeChangementLigne[]>(() => {
    const ch = this.changements();
    if (!ch) return [];
    const presents = new Set<TypeChangementLigne>();
    for (const m of this.marches()) {
      if (m.supprimee) continue;
      const t = ch.get(m.idDetail);
      if (t && t !== 'INCHANGEE') presents.add(t);
    }
    return (['MODIFIEE', 'NOUVELLE', 'RESTAUREE'] as TypeChangementLigne[]).filter((t) => presents.has(t));
  });
  chgLabel(t: TypeChangementLigne): string {
    switch (t) {
      case 'MODIFIEE': return 'Modifiée';
      case 'NOUVELLE': return 'Nouvelle';
      case 'RESTAUREE': return 'Restaurée';
      default: return t;
    }
  }
  /** Clic sur une ligne : ne réémet que si un état séquentiel est actif (contexte examen). */
  onRowClick(m: Marche): void {
    if (this.rowStateFn()) this.rowClick.emit(m);
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
