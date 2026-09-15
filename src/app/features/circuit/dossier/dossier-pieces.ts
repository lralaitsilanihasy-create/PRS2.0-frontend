import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ToastService } from '../../../core/notifications/toast.service';
import { ouvrirBlobSur } from '../../../core/securite/fichiers-surs';
import { PieceJointeDossier } from '../../../models';
import { PieceJointeDossierService } from '../../../services';
import { DossierContenuStore } from './dossier-contenu.store';

/**
 * Pièces jointes d'un dossier, en trois groupes : initiales, versions corrigées (rectification) et
 * après lettre de renvoi. Lit le `DossierContenuStore` de l'hôte ; l'ouverture passe par
 * `ouvrirBlobSur` (fichier téléversé rendu inerte).
 */
@Component({
  selector: 'app-dossier-pieces',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dc-section-head">
      <div class="section-block-title">
        <div class="section-icon">📎</div>
        <span class="section-label">Pièces jointes</span>
        <span class="section-count">{{ contenu.pieces().length }} pièce(s)</span>
      </div>
    </div>

    <div class="pieces-card">
      @if (piecesInitiales().length > 0) {
        <div class="pieces-group">
          <div class="pieces-group-hd">
            <span class="group-pill gp-blue">Pièces initiales</span>
            <span class="group-count">{{ piecesInitiales().length }} fichier(s)</span>
          </div>
          @for (p of piecesInitiales(); track p.idPiece; let i = $index) {
            <div class="piece-row">
              <div class="piece-left">
                <span class="piece-index pi-blue">{{ i + 1 }}</span>
                <span class="piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
              </div>
              <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">Ouvrir <span class="arrow">↗</span></button>
            </div>
          }
        </div>
      }

      <!-- ⚠️ 2026-08-03 (demande user) — versions CORRIGÉES (rectification sur observations
           du PV) : section dédiée, distinctes des originales conservées ci-dessus. -->
      @if (piecesCorrigees().length > 0) {
        <div class="pieces-group">
          <div class="pieces-group-hd">
            <span class="group-pill gp-green">Versions corrigées (rectification)</span>
            <span class="group-count">{{ piecesCorrigees().length }} fichier(s)</span>
          </div>
          @for (p of piecesCorrigees(); track p.idPiece; let i = $index) {
            <div class="piece-row">
              <div class="piece-left">
                <span class="piece-index pi-green">{{ i + 1 }}</span>
                <span class="piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                <span class="vc-tag">Corrigée</span>
              </div>
              <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">Ouvrir <span class="arrow">↗</span></button>
            </div>
          }
        </div>
      }

      @if (piecesApresRenvoi().length > 0) {
        <div class="pieces-group">
          <div class="pieces-group-hd">
            <span class="group-pill gp-orange">Après lettre de renvoi</span>
            <span class="group-count">{{ piecesApresRenvoi().length }} fichier(s)</span>
          </div>
          @for (p of piecesApresRenvoi(); track p.idPiece; let i = $index) {
            <div class="piece-row">
              <div class="piece-left">
                <span class="piece-index pi-orange">{{ i + 1 }}</span>
                <span class="piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                <span class="lr-tag">LR</span>
              </div>
              <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">Ouvrir <span class="arrow">↗</span></button>
            </div>
          }
        </div>
      }

      @if (contenu.pieces().length === 0) {
        <div class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">📭</span>
          <span class="empty-state-text">Aucune pièce jointe.</span>
        </div>
      }
    </div>
  `,
  styles: `
    /* Sans boîte propre : l'en-tête et la carte restent les enfants directs de la section de l'hôte. */
    :host { display: contents; }
    .dc-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 1rem; }
  `,
})
export class DossierPieces {
  protected readonly contenu = inject(DossierContenuStore);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly toast = inject(ToastService);

  readonly piecesInitiales = computed(() => this.contenu.pieces().filter((p) => !p.apresLettreRenvoi && !p.versionCorrigee));
  readonly piecesApresRenvoi = computed(() => this.contenu.pieces().filter((p) => p.apresLettreRenvoi));
  /** ⚠️ 2026-08-03 — versions CORRIGÉES déposées pendant la rectification (distinctes des originales). */
  readonly piecesCorrigees = computed(() => this.contenu.pieces().filter((p) => !p.apresLettreRenvoi && p.versionCorrigee));

  /** Télécharge et ouvre une pièce jointe dans un nouvel onglet (lecture seule). */
  ouvrirPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) {
      return;
    }
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (blob) => ouvrirBlobSur(blob),
      error: () => this.toast.error("Impossible d'ouvrir la pièce."),
    });
  }
}
