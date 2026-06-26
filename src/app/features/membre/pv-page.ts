import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ToastService } from '../../core/notifications/toast.service';
import { Dispatch, Dossier, Examen, ExamenDetail, ObservationControle, PvExamen, PvNavette, Reception } from '../../models';
import {
  AvisService,
  ControleurService,
  DispatchService,
  DossierService,
  EntiteContractService,
  ExamenDetailService,
  ExamenService,
  PointsCtrlService,
  PvExamenService,
  PvNavetteService,
  ReceptionService,
  ReferenceLookupService,
} from '../../services';
import { PvWorkflow, PV_STATUT_LABELS, StatutBadge } from '../../shared/circuit';

/**
 * Projets de PV du Membre : liste (lecture + contenu détaillé) et actions de workflow
 * (soumettre / signer…) déléguées au composant partagé `app-pv-workflow`.
 * Le PV brouillon est créé automatiquement au moment de l'examen (pas de création manuelle ici).
 */
@Component({
  selector: 'app-membre-pv',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, PvWorkflow],
  template: `
    <section class="pv">
      <header class="page-header">
        <h1 class="page-title">Projets de PV</h1>
      </header>

      @if (loading()) {
        <p class="pv__info">Chargement…</p>
      } @else {
        <ul class="pv__list">
          @for (pv of pvs(); track pv.idPv) {
            <li class="card pv-card">
              <div class="pv-card__head">
                <span class="pv-card__ref">{{ pv.refePv || pv.referencePv || ('PV #' + pv.idPv) }}</span>
                <app-statut-badge [statut]="pv.statutPv" [label]="label(pv)" />
                <button type="button" class="btn btn-secondary" (click)="selectionner(pv)">
                  {{ selected()?.idPv === pv.idPv ? 'Masquer' : 'Gérer' }}
                </button>
              </div>
              @if (selected()?.idPv === pv.idPv) {
                <div class="pv-content" #pvContent>
                  <div class="pv-print-bar">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="imprimer(pv)" title="Imprimer" aria-label="Imprimer">🖨 Imprimer</button>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="imprimer(pv)" title="Enregistrer au format PDF" aria-label="Enregistrer au format PDF">📄 PDF</button>
                  </div>
                  @if (pv.statutPv === 'EN_RECTIFICATION' && dernierRetour()) {
                    <div class="alert alert-warning">
                      <span><strong>Retour pour rectification :</strong> {{ dernierRetour() }}</span>
                    </div>
                  }
                  <dl class="pv-info">
                    <div><dt>Dossier</dt><dd>{{ dossierRef(pv) }}</dd></div>
                    <div><dt>Entité</dt><dd>{{ dossierEntite(pv) }}</dd></div>
                    <div><dt>Avis</dt><dd>{{ avisLabel(pv.idAvis) }}</dd></div>
                    <div><dt>Navettes</dt><dd>{{ pv.nbNavettes }}</dd></div>
                    @if (pv.dateSoumissionInitiale) { <div><dt>Soumis le</dt><dd class="cnm-mono">{{ pv.dateSoumissionInitiale }}</dd></div> }
                    @if (pv.dateAcceptation) { <div><dt>Accepté le</dt><dd class="cnm-mono">{{ pv.dateAcceptation }}</dd></div> }
                    @if (pv.datePv) { <div><dt>Date PV</dt><dd class="cnm-mono">{{ pv.datePv }}</dd></div> }
                  </dl>
                  @if (pv.syntheseObservations) {
                    <p class="pv-synthese"><strong>Synthèse :</strong> {{ pv.syntheseObservations }}</p>
                  }

                  <h3 class="pv-sub">Signataires</h3>
                  <dl class="pv-info">
                    <div><dt>Membre</dt><dd>{{ signataire(pv.imCtrlMembre, pv.dateSignatureMembre) }}</dd></div>
                    <div><dt>Chef de commission</dt><dd>{{ signataire(pv.imCtrlCc, pv.dateSignatureCc) }}</dd></div>
                    <div><dt>Président</dt><dd>{{ signataire(pv.imCtrlPresident, pv.dateSignaturePresident) }}</dd></div>
                  </dl>

                  <h3 class="pv-sub">Grille de contrôle</h3>
                  @if (details().length) {
                    <table>
                      <thead><tr><th>Point de contrôle</th><th>Résultat</th><th>Observation</th></tr></thead>
                      <tbody>
                        @for (d of details(); track d.idDetailExamen) {
                          <tr>
                            <td>{{ pointLabel(d.idPtControle) }}</td>
                            <td>{{ d.conforme ? 'Conforme' : 'Non conforme' }}</td>
                            <td>
                              @if (!d.conforme && observationsTriees(d).length) {
                                <table class="obs-pv-table">
                                  <thead><tr><th>AU LIEU DE</th><th>LIRE</th></tr></thead>
                                  <tbody>
                                    @for (o of observationsTriees(d); track o.idObservation ?? $index) {
                                      <tr><td>{{ o.auLieuDe || '—' }}</td><td>{{ o.lire || '—' }}</td></tr>
                                    }
                                  </tbody>
                                </table>
                              } @else {
                                —
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  } @else {
                    <p class="pv__info">Aucun détail d'examen pour ce PV.</p>
                  }

                  <h3 class="pv-sub">Historique des navettes</h3>
                  @if (navettes().length) {
                    <table>
                      <thead><tr><th>#</th><th>Sens</th><th>Acteur</th><th>Date</th><th>Commentaire</th></tr></thead>
                      <tbody>
                        @for (n of navettes(); track n.idNavette) {
                          <tr>
                            <td class="cnm-mono">{{ n.numNavette }}</td>
                            <td>{{ sensLabel(n.sens) }}</td>
                            <td class="cnm-mono">{{ n.imActeur }}</td>
                            <td class="cnm-mono">{{ n.dateAction }}</td>
                            <td>{{ n.commentaire || '—' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  } @else {
                    <p class="pv__info">Aucune navette pour ce PV.</p>
                  }
                </div>
                <app-pv-workflow [pv]="pv" (changed)="onChanged($event)" />
              }
            </li>
          } @empty {
            <li class="pv__info">Aucun projet de PV en cours.</li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .pv__info { color: var(--n-500); padding: 0.5rem 0; }
    .pv__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .pv-card { padding: 0.875rem 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .pv-card__head { display: flex; align-items: center; gap: 0.75rem; }
    .pv-card__ref { font-weight: 700; color: var(--c-800); flex: 1; }
    .pv-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      border-top: 1px solid var(--c-100);
      padding-top: 0.75rem;
    }
    .pv-content td { white-space: normal; }
    .pv-info { display: flex; flex-direction: column; gap: 0.35rem; margin: 0; }
    .pv-info > div { display: flex; gap: 0.5rem; align-items: baseline; }
    .pv-info dt { flex: 0 0 11rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--n-400); }
    .pv-info dd { margin: 0; color: var(--n-700); }
    .pv-synthese { margin: 0; font-size: var(--text-sm); }
    .pv-sub { margin: 0.5rem 0 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .pv-print-bar { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .obs-pv-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .obs-pv-table th { text-align: center; font-weight: 600; padding: 0.2rem 0.5rem; border-bottom: 1px solid var(--c-100); background: none; text-transform: none; letter-spacing: normal; color: var(--n-700); }
    .obs-pv-table td { padding: 0.2rem 0.5rem; vertical-align: top; border-bottom: 1px solid var(--c-100); word-wrap: break-word; white-space: normal; }
  `,
})
export class MembrePv {
  private readonly service = inject(PvExamenService);
  private readonly toast = inject(ToastService);
  private readonly detailService = inject(ExamenDetailService);
  private readonly navetteService = inject(PvNavetteService);
  private readonly examenService = inject(ExamenService);
  private readonly dispatchService = inject(DispatchService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly pvs = signal<PvExamen[]>([]);
  readonly loading = signal(false);
  readonly selected = signal<PvExamen | null>(null);

  /** Détails d'examen (grille) du PV ouvert + caches de libellés. */
  private readonly pvContent = viewChild<ElementRef<HTMLElement>>('pvContent');
  readonly details = signal<ExamenDetail[]>([]);
  readonly navettes = signal<PvNavette[]>([]);
  /** Dernier commentaire de retour pour rectification (navette RETOUR_RECTIF la plus récente). */
  readonly dernierRetour = computed(() => {
    const retours = this.navettes().filter((n) => n.sens === 'RETOUR_RECTIF');
    return retours.length ? retours[retours.length - 1].commentaire ?? '' : '';
  });
  private readonly avisMap = signal<Map<string, string>>(new Map());
  private readonly pointsMap = signal<Map<string, string>>(new Map());
  private readonly controleurMap = signal<Map<string, string>>(new Map());

  // Chaîne PV → examen → dispatch → réception → dossier (pour réf. + entité du dossier).
  private readonly examens = signal<Examen[]>([]);
  private readonly dispatchs = signal<Dispatch[]>([]);
  private readonly receptions = signal<Reception[]>([]);
  private readonly dossiers = signal<Dossier[]>([]);
  private readonly entiteMap = signal<Map<string, string>>(new Map());

  /** idExamen → dossier rattaché (jointure FK en mémoire). */
  private readonly dossierByExamen = computed(() => {
    const recById = new Map(this.receptions().map((r) => [r.idReception, r]));
    const dispById = new Map(this.dispatchs().map((d) => [d.idDispatch, d]));
    const dosById = new Map(this.dossiers().map((d) => [d.idDossier, d]));
    const map = new Map<number, Dossier>();
    for (const e of this.examens()) {
      const disp = e.idDispatch != null ? dispById.get(e.idDispatch) : undefined;
      const rec = disp ? recById.get(disp.idReception) : undefined;
      const dos = rec ? dosById.get(rec.idDossier) : undefined;
      if (dos) {
        map.set(e.idExamen, dos);
      }
    }
    return map;
  });

  private static readonly SENS_LABELS: Record<string, string> = {
    SOUMISSION: 'Soumission',
    RETOUR_RECTIF: 'Retour rectification',
    ACCEPTATION: 'Acceptation',
  };

  constructor() {
    this.charger();
    this.lookups.lookup(AvisService, 'idAvis', ['libelleAvis']).subscribe((m) => this.avisMap.set(m));
    this.lookups.lookup(PointsCtrlService, 'idPointCtrl', ['libelPointCtrl']).subscribe((m) => this.pointsMap.set(m));
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(ControleurService, 'imControleur', ['nomCont', 'prenomsCont']).subscribe((m) => this.controleurMap.set(m));
    // Chaîne pour relier chaque PV à son dossier (réf. + entité).
    forkJoin({
      examens: this.examenService.list(),
      dispatchs: this.dispatchService.list(),
      receptions: this.receptionService.list(),
      dossiers: this.dossierService.list(),
    }).subscribe(({ examens, dispatchs, receptions, dossiers }) => {
      this.examens.set(examens);
      this.dispatchs.set(dispatchs);
      this.receptions.set(receptions);
      this.dossiers.set(dossiers);
    });
  }

  dossierRef(pv: PvExamen): string {
    const d = this.dossierByExamen().get(pv.idExamen);
    return d ? d.refeDossier || 'Dossier #' + d.idDossier : '—';
  }
  dossierEntite(pv: PvExamen): string {
    const d = this.dossierByExamen().get(pv.idExamen);
    return d?.idEntiteContract != null
      ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract
      : '—';
  }
  /** Signataire : nom du contrôleur (+ date de signature si présente), ou « — ». */
  signataire(im?: string, date?: string): string {
    if (!im) {
      return '—';
    }
    const nom = this.controleurMap().get(im) ?? im;
    return date ? `${nom} · signé le ${date}` : nom;
  }

  /** Impression / PDF du contenu du PV (fenêtre dédiée → Imprimer ou « Enregistrer au format PDF »). */
  imprimer(pv: PvExamen): void {
    const el = this.pvContent()?.nativeElement;
    if (!el) {
      return;
    }
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      this.toast.error("Impossible d'ouvrir la fenêtre d'impression (popups bloqués ?).");
      return;
    }
    const ref = this.dossierRef(pv);
    // Le nom du PDF enregistré reprend la référence du dossier (titre du document).
    const titre = `PV ${ref}`;
    const heading = `Projet de PV — ${ref}`;
    w.document.write(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${titre}</title>` +
        `<style>` +
        `body{font-family:system-ui,'Segoe UI',Roboto,sans-serif;color:#1a2230;padding:24px;line-height:1.5}` +
        `h1{font-size:18px;margin:0 0 12px}` +
        `h3{font-size:13px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.05em;color:#555}` +
        `table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}` +
        `th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}` +
        `th{background:#f2f4f8;text-transform:uppercase;font-size:11px;color:#666}` +
        `dl{margin:0}dl>div{display:flex;gap:8px;margin:2px 0}` +
        `dt{flex:0 0 170px;text-transform:uppercase;font-size:11px;color:#888}dd{margin:0}` +
        `button,.pv-print-bar{display:none!important}` +
        `</style></head><body><h1>${heading}</h1>${el.innerHTML}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  label(pv: PvExamen): string {
    return PV_STATUT_LABELS[pv.statutPv];
  }
  avisLabel(id: string): string {
    return this.avisMap().get(id) ?? id;
  }
  pointLabel(id: number): string {
    return this.pointsMap().get(String(id)) ?? `#${id}`;
  }
  /** Lignes « AU LIEU DE / LIRE » du point, triées par `ordre` ASC. */
  observationsTriees(d: ExamenDetail): ObservationControle[] {
    return [...(d.observations ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  }
  sensLabel(sens: string): string {
    return MembrePv.SENS_LABELS[sens] ?? sens;
  }

  selectionner(pv: PvExamen): void {
    const opening = this.selected()?.idPv !== pv.idPv;
    this.selected.update((cur) => (cur?.idPv === pv.idPv ? null : pv));
    this.details.set([]);
    this.navettes.set([]);
    if (opening) {
      this.detailService.list().subscribe((rows) => this.details.set(rows.filter((d) => d.idExamen === pv.idExamen)));
      this.navetteService.list().subscribe((rows) =>
        this.navettes.set(rows.filter((n) => n.idPv === pv.idPv).sort((a, b) => a.numNavette - b.numNavette)),
      );
    }
  }

  charger(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.pvs.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onChanged(updated: PvExamen): void {
    this.selected.set(updated);
    this.charger();
  }
}
