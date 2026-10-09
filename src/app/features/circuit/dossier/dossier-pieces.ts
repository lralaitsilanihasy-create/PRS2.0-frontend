import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';

import { ToastService } from '../../../core/notifications/toast.service';
import { ouvrirBlobSur } from '../../../core/securite/fichiers-surs';
import { PieceJointeDossier, TypePieceJointe } from '../../../models';
import { DossierService, PieceJointeDossierService } from '../../../services';
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
      <!-- ⚠️ Manuel de contrôle, M2 (V95) — en brouillon, la liste que la soumission exigera, cochée pièce par pièce. -->
      @if (exigees().length > 0) {
        <div class="pieces-group" aria-labelledby="pieces-exigees">
          <div class="pieces-group-hd">
            <span id="pieces-exigees" class="group-pill gp-blue">Pièces exigées pour soumettre</span>
            <span class="group-count">{{ nbObligatoiresManquantes() ? nbObligatoiresManquantes() + ' obligatoire(s) manquante(s)' : 'toutes les obligatoires sont jointes' }}</span>
          </div>
          <ul class="pe-liste">
            @for (t of exigees(); track t.idTypePiece) {
              <li class="pe-ligne" [class.pe-ligne--manque]="t.obligatoire && !deposees().has(t.idTypePiece)">
                <span class="pe-etat" aria-hidden="true">{{ deposees().has(t.idTypePiece) ? '✓' : t.obligatoire ? '✕' : '–' }}</span>
                <span class="pe-lib">{{ t.libellePiece }}</span>
                <span class="pe-tag">{{ deposees().has(t.idTypePiece) ? 'jointe' : t.obligatoire ? 'obligatoire, manquante' : 'facultative' }}</span>
              </li>
            }
          </ul>
        </div>
      }
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
                <span class="piece-name">
                  {{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}
                  <!-- ⚠️ Lot 2a (23/09) — un dossier porte désormais PLUSIEURS pièces du même type (le dossier
                       d'appel d'offres complet en compte quatre) : seul le nom du fichier les distingue. -->
                  @if (p.libellePiece && p.nomFichier) { <span class="piece-file">{{ p.nomFichier }}</span> }
                </span>
                @if (p.idDocumentFiche) { <span class="piece-fiche" title="Produite par la fiche DAO : elle se corrige dans la fiche, pas ici.">fiche DAO</span> }
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
                <span class="piece-name">
                  {{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}
                  <!-- ⚠️ Lot 2a (23/09) — un dossier porte désormais PLUSIEURS pièces du même type (le dossier
                       d'appel d'offres complet en compte quatre) : seul le nom du fichier les distingue. -->
                  @if (p.libellePiece && p.nomFichier) { <span class="piece-file">{{ p.nomFichier }}</span> }
                </span>
                @if (p.idDocumentFiche) { <span class="piece-fiche" title="Produite par la fiche DAO : elle se corrige dans la fiche, pas ici.">fiche DAO</span> }
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
                <span class="piece-name">
                  {{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}
                  <!-- ⚠️ Lot 2a (23/09) — un dossier porte désormais PLUSIEURS pièces du même type (le dossier
                       d'appel d'offres complet en compte quatre) : seul le nom du fichier les distingue. -->
                  @if (p.libellePiece && p.nomFichier) { <span class="piece-file">{{ p.nomFichier }}</span> }
                </span>
                @if (p.idDocumentFiche) { <span class="piece-fiche" title="Produite par la fiche DAO : elle se corrige dans la fiche, pas ici.">fiche DAO</span> }
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
    .piece-file { display: block; font-size: 0.78rem; color: var(--n-500); overflow-wrap: anywhere; }
    .pe-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
    .pe-ligne { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.85rem; }
    .pe-etat { width: 1rem; font-weight: 700; color: var(--success-700, #047857); }
    .pe-ligne--manque .pe-etat, .pe-ligne--manque .pe-tag { color: var(--danger-700, #b42318); }
    .pe-lib { flex: 1; }
    .pe-tag { font-size: 0.75rem; color: var(--n-500); }
    .piece-fiche { flex: none; padding: 0.1rem 0.5rem; border-radius: 8px; background: #ecfdf5; color: #047857; font-size: 0.72rem; font-weight: 600; }
  `,
})
export class DossierPieces {
  protected readonly contenu = inject(DossierContenuStore);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly toast = inject(ToastService);
  private readonly dossiers = inject(DossierService);

  /**
   * ⚠️ Manuel de contrôle, M2 (V95) — les pièces exigées de ce dossier (sous-type, conditions de sa fiche), lues en **brouillon**
   * seulement : c'est la liste que la soumission refuse incomplète. Silencieux en cas d'échec (le groupe ne s'affiche pas).
   */
  readonly exigees = signal<TypePieceJointe[]>([]);
  readonly deposees = computed(() => new Set(this.contenu.pieces().map((p) => p.idTypePiece)));
  readonly nbObligatoiresManquantes = computed(() => this.exigees().filter((t) => t.obligatoire && !this.deposees().has(t.idTypePiece)).length);

  constructor() {
    effect((nettoyer) => {
      const d = this.contenu.dossier();
      this.exigees.set([]);
      if (d.statut !== 'BROUILLON') return;
      const abonnement = this.dossiers.piecesExigees(d.idDossier).subscribe({
        next: (l) => this.exigees.set([...l].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))),
        error: () => this.exigees.set([]),
      });
      nettoyer(() => abonnement.unsubscribe());
    });
  }

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
