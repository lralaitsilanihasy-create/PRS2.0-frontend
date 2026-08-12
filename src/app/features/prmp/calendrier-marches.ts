import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { Capm, Marche, MarchePrevision, Ppm } from '../../models';
import { CapmService, MarcheService, MarchePrevisionService, PpmService } from '../../services';

/**
 * **Calendrier des jalons** (PRMP) — demande user 2026-08-12 : le tableau montre l'**objet de chaque
 * ligne** des dossiers de planification avec ses **processus CAPM** (une colonne par processus du
 * référentiel, dans l'ordre : période prévue début → fin).
 *
 * Données : marchés scopés PRMP (jointure client PPM → marchés), dates prévisionnelles en bulk,
 * référentiel CAPM pour l'ordre et les libellés des colonnes. Lecture seule — les dates s'éditent
 * dans le dossier (dialogue « CAPM du marché »).
 */
@Component({
  selector: 'app-calendrier-marches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cj">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Calendrier des jalons</h1>
        </div>
      </header>
      <p class="cj__intro">
        Les processus <strong>CAPM</strong> prévus pour chaque ligne de vos dossiers de planification
        (période début → fin). Les dates s'éditent dans le dossier, via « CAPM » sur la ligne.
      </p>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else {
        <div class="table-card cj__wrap">
          <table>
            <thead>
              <tr>
                <th>Référence PRMP</th>
                <th>Objet</th>
                @for (c of capms(); track c.idCapm) { <th class="cj__c">{{ c.libelleProcessus }}</th> }
              </tr>
            </thead>
            <tbody>
              @for (l of lignes(); track l.idDetail) {
                <tr>
                  <td class="cj__ref">{{ l.reference }}</td>
                  <td class="cj__objet">{{ l.objet }}</td>
                  @for (c of capms(); track c.idCapm) {
                    <td class="cj__c">
                      @if (l.periodes[c.idCapm]; as p) {
                        <span class="cj__date">{{ p.debut }}</span>
                        @if (p.fin) { <span class="cj__fleche">→</span> <span class="cj__date">{{ p.fin }}</span> }
                      } @else {
                        <span class="cj__vide">—</span>
                      }
                    </td>
                  }
                </tr>
              } @empty {
                <tr><td [attr.colspan]="2 + capms().length" class="cj__empty">Aucune ligne de marché.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .cj { display: flex; flex-direction: column; gap: 1rem; }
    .cj__intro { margin: -0.4rem 0 0; color: var(--n-500); max-width: 60rem; }
    .cj__wrap { overflow-x: auto; }
    .cj__ref { white-space: nowrap; font-weight: 600; color: var(--c-800); }
    .cj__objet { white-space: normal; min-width: 18rem; max-width: 30rem; }
    .cj__c { text-align: center; }
    .cj__date { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .cj__fleche { color: var(--n-400); margin: 0 0.25rem; }
    .cj__vide { color: var(--n-300); }
    .cj__empty { text-align: center; color: var(--n-400); padding: 1.5rem; }
  `,
})
export class CalendrierMarches implements OnInit {
  private readonly marcheService = inject(MarcheService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly capmService = inject(CapmService);
  private readonly ppmService = inject(PpmService);

  readonly loading = signal(true);
  private readonly capmsTous = signal<Capm[]>([]);
  private readonly marches = signal<Marche[]>([]);
  private readonly previsions = signal<MarchePrevision[]>([]);
  private readonly ppms = signal<Ppm[]>([]);

  /**
   * Colonnes = processus CAPM réellement UTILISÉS par au moins une ligne (ordre du référentiel).
   * Le référentiel complet compte ~34 processus : les afficher tous noierait le tableau de colonnes vides.
   */
  readonly capms = computed(() => {
    const utilises = new Set(this.previsions().map((p) => p.idCapm));
    return this.capmsTous().filter((c) => utilises.has(c.idCapm));
  });

  /** Lignes du tableau : une par marché non supprimé, périodes indexées par idCapm. */
  readonly lignes = computed(() => {
    const refParPpm = new Map(this.ppms().map((p) => [p.idPpm, p.reference || 'PPM #' + p.idPpm]));
    const prevParDetail = new Map<number, MarchePrevision[]>();
    for (const p of this.previsions()) {
      const l = prevParDetail.get(p.idDetail) ?? [];
      l.push(p);
      prevParDetail.set(p.idDetail, l);
    }
    return this.marches()
      .filter((m) => !m.supprimee)
      .map((m) => {
        const periodes: Record<number, { debut: string; fin?: string }> = {};
        for (const p of prevParDetail.get(m.idDetail) ?? []) {
          periodes[p.idCapm] = { debut: this.dateFr(p.dateDebut), fin: p.dateFin ? this.dateFr(p.dateFin) : undefined };
        }
        return {
          idDetail: m.idDetail,
          reference: refParPpm.get(m.idPpm) ?? '—',
          objet: m.designationMarche ?? '',
          periodes,
        };
      })
      .sort((a, b) => a.reference.localeCompare(b.reference) || a.idDetail - b.idDetail);
  });

  ngOnInit(): void {
    // Une seule vague : listes scopées PRMP par le backend ; CAPM trié par ordre pour les colonnes.
    forkJoin({
      marches: this.marcheService.list(),
      previsions: this.previsionService.list(),
      capms: this.capmService.getAll(),
      ppms: this.ppmService.list(),
    }).subscribe({
      next: ({ marches, previsions, capms, ppms }) => {
        this.marches.set(marches);
        this.previsions.set(previsions);
        this.capmsTous.set([...capms].sort((a, b) => a.ordre - b.ordre));
        this.ppms.set(ppms);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Date ISO `yyyy-MM-dd` → `dd/MM/yyyy` (repli valeur brute). */
  private dateFr(iso?: string | null): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  }
}
