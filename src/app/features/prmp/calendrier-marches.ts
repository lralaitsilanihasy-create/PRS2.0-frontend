import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { Capm, Echeance, Marche, MarchePrevision, Ppm, RegleAlerte } from '../../models';
import {
  CapmService,
  EcheanceService,
  MarcheService,
  MarchePrevisionService,
  PpmService,
  RegleAlerteService,
} from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/** Alerte d'un jalon d'une ligne : imminent (dans ≤ seuil jours) ou en retard (prévu dépassé, pas de réel). */
interface AlerteJalon {
  processus: string;
  genre: 'imminent' | 'retard';
  jours: number;
}

/**
 * **Calendrier des jalons** (PRMP) — demande user 2026-08-12 : l'objet de chaque ligne des dossiers de
 * planification avec, pour chaque **processus CAPM** utilisé, la date **prévue** (prévisions du dossier)
 * et la date **réelle** (`/api/echeances`, rapprochée par ligne + type de jalon), plus une colonne
 * **Alerte** qui signale les jalons **imminents** (prévu dans ≤ seuil jours — `regle-alertes.joursAvant`
 * si une règle active correspond au jalon, 7 jours sinon) ou **en retard** (prévu dépassé sans réel).
 *
 * Lecture seule — les dates prévues s'éditent dans le dossier (dialogue « CAPM du marché »).
 */
@Component({
  selector: 'app-calendrier-marches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <section class="cj">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Calendrier des jalons</h1>
        </div>
      </header>
      <p class="cj__intro">
        Pour chaque ligne de vos dossiers de planification : la date <strong>prévue</strong> et la date
        <strong>réelle</strong> de chaque processus <strong>CAPM</strong>, et une alerte quand un jalon est
        <strong>imminent</strong> ou <strong>en retard</strong>. Les dates prévues s'éditent dans le dossier, via « CAPM » sur la ligne.
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger le calendrier des jalons." (reessayer)="charger()" />
      } @else {
        <div class="table-card cj__wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Référence PRMP</th>
                <th scope="col">Objet</th>
                @for (c of capms(); track c.idCapm) { <th scope="col" class="cj__c">{{ c.libelleProcessus }}</th> }
                <th scope="col" class="cj__c">Alerte</th>
              </tr>
            </thead>
            <tbody>
              @for (l of lignes(); track l.idDetail) {
                <tr>
                  <td class="cj__ref">{{ l.reference }}</td>
                  <td class="cj__objet">{{ l.objet }}</td>
                  @for (c of capms(); track c.idCapm) {
                    <td class="cj__c">
                      @if (l.jalons[c.idCapm]; as j) {
                        <div class="cj__paire"><span class="cj__k">Prévu</span> <span class="cj__date">{{ j.prevu || '—' }}</span></div>
                        <div class="cj__paire"><span class="cj__k">Réel</span> <span class="cj__date" [class.cj__reel]="j.reel">{{ j.reel || '—' }}</span></div>
                      } @else {
                        <span class="cj__vide">—</span>
                      }
                    </td>
                  }
                  <td class="cj__c cj__alertes">
                    @for (a of l.alertes; track a.processus + a.genre) {
                      <span class="badge cj__badge" [class.cj__badge--retard]="a.genre === 'retard'" [class.cj__badge--imminent]="a.genre === 'imminent'">
                        @if (a.genre === 'retard') { ⏰ {{ a.processus }} — en retard de {{ a.jours }} j }
                        @else if (a.jours === 0) { ⚠ {{ a.processus }} — aujourd'hui }
                        @else { ⚠ {{ a.processus }} — dans {{ a.jours }} j }
                      </span>
                    } @empty {
                      <span class="cj__vide">—</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td [attr.colspan]="3 + capms().length" class="cj__empty">Aucune ligne de marché.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .cj { display: flex; flex-direction: column; gap: 1rem; }
    .cj__intro { margin: -0.4rem 0 0; color: var(--n-500); max-width: 62rem; }
    .cj__wrap { overflow-x: auto; }
    .cj__ref { white-space: nowrap; font-weight: 600; color: var(--c-800); }
    .cj__objet { white-space: normal; min-width: 16rem; max-width: 26rem; }
    .cj__c { text-align: center; }
    .cj__paire { display: flex; align-items: baseline; justify-content: center; gap: 0.35rem; white-space: nowrap; }
    .cj__k { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-400); width: 2.9rem; text-align: right; }
    .cj__date { font-variant-numeric: tabular-nums; }
    .cj__reel { color: var(--success-text, #16a34a); font-weight: 600; }
    .cj__vide { color: var(--n-400); }
    .cj__alertes { display: flex; flex-direction: column; gap: 0.3rem; align-items: center; }
    .cj__badge { white-space: nowrap; }
    .cj__badge--imminent { background: var(--warning-bg, #fef3c7); color: var(--warning-text, #b45309); }
    .cj__badge--retard { background: var(--danger-bg, #fee2e2); color: var(--danger-text, #dc2626); }
    .cj__empty { text-align: center; color: var(--n-400); padding: 1.5rem; }
  `,
})
export class CalendrierMarches implements OnInit {
  private readonly marcheService = inject(MarcheService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly capmService = inject(CapmService);
  private readonly ppmService = inject(PpmService);
  private readonly echeanceService = inject(EcheanceService);
  private readonly regleAlerteService = inject(RegleAlerteService);

  /** Seuil d'imminence par défaut quand aucune règle d'alerte active ne vise le jalon. */
  private static readonly SEUIL_DEFAUT_JOURS = 7;

  readonly loading = signal(true);
  /** Échec du chargement (affiche l'erreur + « Réessayer », AUDIT.md P9). */
  readonly erreur = signal(false);
  private readonly capmsTous = signal<Capm[]>([]);
  private readonly marches = signal<Marche[]>([]);
  private readonly previsions = signal<MarchePrevision[]>([]);
  private readonly ppms = signal<Ppm[]>([]);
  private readonly echeances = signal<Echeance[]>([]);
  private readonly regles = signal<RegleAlerte[]>([]);

  /**
   * Colonnes = processus CAPM réellement UTILISÉS par au moins une ligne (ordre du référentiel).
   * Le référentiel complet compte ~34 processus : les afficher tous noierait le tableau de colonnes vides.
   */
  readonly capms = computed(() => {
    const utilises = new Set(this.previsions().map((p) => p.idCapm));
    return this.capmsTous().filter((c) => utilises.has(c.idCapm));
  });

  /** Lignes du tableau : une par marché non supprimé — jalons {prévu, réel} par idCapm + alertes. */
  readonly lignes = computed(() => {
    const refParPpm = new Map(this.ppms().map((p) => [p.idPpm, p.reference || 'PPM #' + p.idPpm]));
    const prevParDetail = new Map<number, MarchePrevision[]>();
    for (const p of this.previsions()) {
      const l = prevParDetail.get(p.idDetail) ?? [];
      l.push(p);
      prevParDetail.set(p.idDetail, l);
    }
    const echParDetail = new Map<number, Echeance[]>();
    for (const e of this.echeances()) {
      const l = echParDetail.get(e.idDetail) ?? [];
      l.push(e);
      echParDetail.set(e.idDetail, l);
    }
    const aujourdhui = this.isoJour(new Date());
    return this.marches()
      .filter((m) => !m.supprimee)
      .map((m) => {
        const jalons: Record<number, { prevu?: string; prevuIso?: string; reel?: string }> = {};
        for (const p of prevParDetail.get(m.idDetail) ?? []) {
          jalons[p.idCapm] = { prevu: this.dateFr(p.dateDebut), prevuIso: p.dateDebut };
        }
        // Réel : échéance de la ligne dont le type de jalon correspond au processus (égalité de libellé
        // normalisé, sinon inclusion — même tolérance que la résolution CAPM à l'import).
        for (const c of this.capms()) {
          const ech = (echParDetail.get(m.idDetail) ?? []).find((e) => this.jalonCorrespond(e.typeJalon, c.libelleProcessus));
          if (ech?.dateReelle && jalons[c.idCapm]) jalons[c.idCapm].reel = this.dateFr(ech.dateReelle);
          else if (ech?.dateReelle) jalons[c.idCapm] = { reel: this.dateFr(ech.dateReelle) };
        }
        const alertes: AlerteJalon[] = [];
        for (const c of this.capms()) {
          const j = jalons[c.idCapm];
          if (!j?.prevuIso || j.reel) continue; // pas de prévu, ou jalon déjà réalisé → pas d'alerte
          const ecart = this.joursEntre(aujourdhui, j.prevuIso);
          if (ecart < 0) alertes.push({ processus: this.libelleCourt(c.libelleProcessus), genre: 'retard', jours: -ecart });
          else if (ecart <= this.seuilPour(c.libelleProcessus)) {
            alertes.push({ processus: this.libelleCourt(c.libelleProcessus), genre: 'imminent', jours: ecart });
          }
        }
        return {
          idDetail: m.idDetail,
          reference: refParPpm.get(m.idPpm) ?? '—',
          objet: m.designationMarche ?? '',
          jalons,
          alertes,
        };
      })
      .sort((a, b) => a.reference.localeCompare(b.reference) || a.idDetail - b.idDetail);
  });

  ngOnInit(): void {
    this.charger();
  }

  /** Public : rejoué tel quel par le bouton « Réessayer » de l'état d'erreur (AUDIT.md P9). */
  charger(): void {
    // Une seule vague : listes scopées PRMP par le backend ; CAPM trié par ordre pour les colonnes ;
    // échéances (dates réelles) + règles d'alerte (seuils d'imminence par jalon).
    this.loading.set(true);
    this.erreur.set(false);
    forkJoin({
      marches: this.marcheService.list(),
      previsions: this.previsionService.list(),
      capms: this.capmService.getAll(),
      ppms: this.ppmService.list(),
      echeances: this.echeanceService.list(),
      regles: this.regleAlerteService.list(),
    }).subscribe({
      next: ({ marches, previsions, capms, ppms, echeances, regles }) => {
        this.marches.set(marches);
        this.previsions.set(previsions);
        this.capmsTous.set([...capms].sort((a, b) => a.ordre - b.ordre));
        this.ppms.set(ppms);
        this.echeances.set(echeances);
        this.regles.set(regles);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  /** Un type de jalon (échéance / règle d'alerte) vise-t-il ce processus CAPM ? Égalité, sinon inclusion. */
  private jalonCorrespond(typeJalon: string | undefined, libelleProcessus: string | undefined): boolean {
    const a = this.norm(typeJalon);
    const b = this.norm(libelleProcessus);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
  }
  /** Seuil d'imminence du jalon : `joursAvant` de la règle d'alerte ACTIVE correspondante, sinon 7 jours. */
  private seuilPour(libelleProcessus: string | undefined): number {
    const regle = this.regles().find((r) => r.actif !== false && this.jalonCorrespond(r.typeJalon, libelleProcessus));
    return regle?.joursAvant ?? CalendrierMarches.SEUIL_DEFAUT_JOURS;
  }
  private norm(s?: string): string {
    return (s ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }
  /** Libellé de badge : premier mot significatif du processus (les libellés CAPM longs noieraient l'alerte). */
  private libelleCourt(libelle: string | undefined): string {
    const l = (libelle ?? '').trim();
    return l.length <= 24 ? l : l.slice(0, 22).trimEnd() + '…';
  }
  /** Écart en jours calendaires entre deux dates ISO (b - a). */
  private joursEntre(aIso: string, bIso: string): number {
    const [ay, am, ad] = aIso.split('-').map(Number);
    const [by, bm, bd] = bIso.split('-').map(Number);
    return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
  }
  private isoJour(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  /** Date ISO `yyyy-MM-dd` → `dd/MM/yyyy` (repli valeur brute). */
  private dateFr(iso?: string | null): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  }
}
