import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { ToastService } from '../../core/notifications/toast.service';
import { ExamenDetail, ObservationControle, PvExamen } from '../../models';
import {
  AvisService,
  ControleurService,
  ExamenDetailService,
  PointsCtrlService,
  PvExamenService,
  ReferenceLookupService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Modal « Détail PV » réutilisable (lecture seule) : métadonnées, signataires (dont secrétaire de
 * séance), synthèse, grille de contrôle (points + observations), et téléchargement du PDF officiel.
 *
 * Reçoit le `PvExamen` déjà chargé (DTO complet de la liste) et charge la grille (détails d'examen)
 * + les libellés (avis, points, contrôleurs) via les référentiels en cache. Émet `(fermer)`.
 */
@Component({
  selector: 'app-detail-pv-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <div class="modal-backdrop" (click)="fermer.emit()">
      <div class="modal modal-lg" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <!-- En-tête -->
        <div class="modal-header">
          <div>
            <div class="dpv-head-top">
              <app-statut-badge [statut]="pv().statutPv" [label]="'Définitif'" />
              <span class="text-muted text-sm">{{ pv().datePv || '—' }}</span>
            </div>
            <h2 class="modal-title">{{ pv().refePv || pv().referencePv || ('PV #' + pv().idPv) }}</h2>
          </div>
          <button type="button" class="btn-close" aria-label="Fermer" (click)="fermer.emit()">✕</button>
        </div>

        <div class="modal-body">
          <!-- Métadonnées -->
          <div class="section-block">
            <table class="dpv-detail-table">
              <tbody>
                <tr><td>Avis</td><td>{{ avisLabel(pv().idAvis) }}</td></tr>
                <tr><td>Navettes</td><td>{{ pv().nbNavettes }}</td></tr>
                <tr><td>Soumis le</td><td>{{ pv().dateSoumissionInitiale || '—' }}</td></tr>
                <tr><td>Accepté le</td><td>{{ pv().dateAcceptation || '—' }}</td></tr>
                <tr><td>Date PV</td><td>{{ pv().datePv || '—' }}</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Signataires -->
          <div class="section-block">
            <h3 class="dpv-sub">Signataires</h3>
            <table class="dpv-detail-table">
              <tbody>
                <tr><td>Membre</td><td>{{ signataire(pv().imCtrlMembre, pv().dateSignatureMembre) }}</td></tr>
                <tr><td>Chef de commission</td><td>{{ signataire(pv().imCtrlCc, pv().dateSignatureCc) }}</td></tr>
                <tr><td>Président</td><td>{{ signataire(pv().imCtrlPresident, pv().dateSignaturePresident) }}</td></tr>
                <tr><td>Secrétaire de séance</td><td>{{ pv().nomSecretaireSeance || '—' }}</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Synthèse -->
          @if (pv().syntheseObservations) {
            <div class="section-block">
              <h3 class="dpv-sub">Synthèse</h3>
              <p class="dpv-synthese">{{ pv().syntheseObservations }}</p>
            </div>
          }

          <!-- Grille de contrôle -->
          <div class="section-block">
            <h3 class="dpv-sub">Grille de contrôle</h3>
            @if (loadingGrille()) {
              <div class="spinner-wrap"><div class="spinner"></div></div>
            } @else if (details().length) {
              <table class="dpv-grille-table">
                <thead>
                  <tr><th>Point de contrôle</th><th>Résultat</th><th>Observation</th></tr>
                </thead>
                <tbody>
                  @for (d of details(); track d.idDetailExamen) {
                    <tr>
                      <td>{{ pointLabel(d.idPtControle) }}</td>
                      <td [class.text-danger]="!d.conforme">{{ d.conforme ? 'Conforme' : 'Non conforme' }}</td>
                      <td>
                        @if (!d.conforme && observationsTriees(d).length) {
                          <div class="dpv-obs-box">
                            @for (o of observationsTriees(d); track o.idObservation ?? $index) {
                              <div><strong>Au lieu de :</strong> {{ o.auLieuDe || '—' }}<br /><strong>Lire :</strong> {{ o.lire || '—' }}</div>
                            }
                          </div>
                        } @else {
                          <span class="text-muted">—</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="text-muted">Aucun détail d'examen pour ce PV.</p>
            }
          </div>
        </div>

        <!-- Pied -->
        <div class="modal-footer modal-footer-spaced">
          @if (pv().documentDisponible === false) {
            <span class="text-muted text-sm">Aucun PDF officiel : ce PV n'est pas éligible à la génération de document.</span>
          } @else {
            <span class="text-muted text-sm">Document officiel signé</span>
            <button type="button" class="btn btn-secondary" (click)="telechargerPdf()">⬇ Télécharger le PDF</button>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .dpv-head-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .dpv-sub { margin: 0 0 8px; font-size: var(--text-md); font-weight: 700; color: var(--n-800); }
    .dpv-synthese { margin: 0; font-size: var(--text-sm); color: var(--n-600); white-space: pre-wrap; }
    .dpv-detail-table { width: 100%; font-size: var(--text-base); border-collapse: collapse; }
    .dpv-detail-table td { padding: 5px 0; vertical-align: top; }
    .dpv-detail-table td:first-child { color: var(--n-400); width: 160px; }
    .dpv-grille-table { width: 100%; font-size: var(--text-sm); border-collapse: collapse; table-layout: fixed; }
    .dpv-grille-table th { text-align: left; padding: 8px 10px; background: var(--n-50); border-bottom: 0.5px solid var(--n-200); font-weight: 600; color: var(--n-500); }
    .dpv-grille-table td { padding: 8px 10px; border-bottom: 0.5px solid var(--n-100); vertical-align: top; word-wrap: break-word; }
    .dpv-obs-box { background: var(--n-50); border-radius: var(--radius-md); padding: 8px 10px; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 6px; }
  `,
})
export class DetailPvModal implements OnInit {
  /** PV à détailler (DTO complet issu de la liste). */
  readonly pv = input.required<PvExamen>();
  /** Fermeture demandée (× / backdrop). */
  readonly fermer = output<void>();

  private readonly pvService = inject(PvExamenService);
  private readonly detailService = inject(ExamenDetailService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly toast = inject(ToastService);

  readonly details = signal<ExamenDetail[]>([]);
  readonly loadingGrille = signal(true);
  private readonly avisMap = signal<Map<string, string>>(new Map());
  private readonly pointsMap = signal<Map<string, string>>(new Map());
  private readonly controleurMap = signal<Map<string, string>>(new Map());

  ngOnInit(): void {
    this.lookups.lookup(AvisService, 'idAvis', ['libelleAvis']).subscribe((m) => this.avisMap.set(m));
    this.lookups.lookup(PointsCtrlService, 'idPointCtrl', ['libelPointCtrl']).subscribe((m) => this.pointsMap.set(m));
    this.lookups
      .lookup(ControleurService, 'imControleur', ['nomCont', 'prenomsCont'])
      .subscribe((m) => this.controleurMap.set(m));
    // Grille de contrôle : détails de l'examen du PV (observations embarquées).
    const idExamen = this.pv().idExamen;
    this.detailService.list().subscribe({
      next: (rows) => {
        this.details.set(rows.filter((d) => d.idExamen === idExamen));
        this.loadingGrille.set(false);
      },
      error: () => this.loadingGrille.set(false),
    });
  }

  avisLabel(id: string): string {
    return this.avisMap().get(id) ?? id;
  }
  pointLabel(id: number): string {
    return this.pointsMap().get(String(id)) ?? `#${id}`;
  }
  /** Signataire : nom du contrôleur (+ date si présente), ou « — ». */
  signataire(im?: string, date?: string): string {
    if (!im) {
      return '—';
    }
    const nom = this.controleurMap().get(im) ?? im;
    return date ? `${nom} · signé le ${date}` : nom;
  }
  /** Lignes « AU LIEU DE / LIRE » du point, triées par `ordre` ASC. */
  observationsTriees(d: ExamenDetail): ObservationControle[] {
    return [...(d.observations ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  }

  /** Télécharge le PDF officiel du PV (`GET /api/pv-examens/{id}/document`). */
  telechargerPdf(): void {
    this.pvService.document(this.pv().idPv).subscribe({
      next: (blob) => window.open(URL.createObjectURL(blob), '_blank'),
      error: (err: HttpErrorResponse) => {
        if (err.status === 404) {
          // Comportement attendu : un PDF n'est généré que pour un avis « Favorable sous réserve » (FAVR),
          // un dossier de localité centrale (ANT) et des marchés tous en appel d'offres ouvert.
          this.toast.info(
            "Ce PV n'a pas de document PDF officiel : il n'est généré que pour un avis « Favorable sous réserve », un dossier de la localité centrale et des marchés tous en appel d'offres ouvert.",
          );
        } else {
          this.toast.error('Impossible de télécharger le document.');
        }
      },
    });
  }
}
