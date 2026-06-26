import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, LettreRenvoi, PieceJointeDossier, TypePieceJointe } from '../../models';
import { DossierService, LettreRenvoiService, PieceJointeDossierService, TypePieceJointeService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Consultation des lettres de renvoi, partagée par profil via `route.data` :
 * - PRMP (`source = 'mes'`) → `GET /api/lettre-renvois/mes-lettres` (ses lettres SIGNE), lecture seule ;
 * - Assistant contrôleur (`source = 'localite'`) → `GET /api/lettre-renvois` (SIGNE localité), lecture seule ;
 * - CC / Président (`source = 'localite'`, `signable = true`) → `GET /api/lettre-renvois` (SOUMIS à signer) :
 *   bouton « Signer » (`POST …/{id}/signer`) tant que `statut = SOUMIS`.
 *
 * Lien de notification : `…/lettre-renvois/{idLettre}` déplie automatiquement le détail.
 */
@Component({
  selector: 'app-lettre-renvoi-consultation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="lrc">
      <header class="page-header">
        <h1 class="page-title">{{ titre }}</h1>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else {
        <div class="table-card">
        <table>
          <thead>
            <tr><th>Référence lettre</th><th>Dossier</th><th>Objet</th><th>Date lettre</th><th>Statut</th><th></th></tr>
          </thead>
          <tbody>
            @for (l of lettres(); track l.idLettre) {
              <tr>
                <td class="cnm-mono">{{ l.refLettre || ('#' + l.idLettre) }}</td>
                <td>{{ refDossier(l) }}</td>
                <td>{{ l.objetLettre || '—' }}</td>
                <td class="cnm-mono">{{ l.dateLettre || '—' }}</td>
                <td><app-statut-badge [statut]="l.statut" /></td>
                <td class="lrc__actions">
                  <button type="button" class="btn btn-secondary btn-sm" (click)="basculer(l)">
                    {{ ouvert() === l.idLettre ? 'Masquer' : 'Détails' }}
                  </button>
                  @if (signable && l.statut === 'SOUMIS') {
                    <button type="button" class="btn btn-primary btn-sm" [disabled]="signature() === l.idLettre" (click)="signer(l)">
                      {{ signature() === l.idLettre ? 'Signature…' : 'Signer' }}
                    </button>
                  }
                </td>
              </tr>
              @if (ouvert() === l.idLettre) {
                <tr class="lrc__detail">
                  <td colspan="6">
                    <dl class="lrc__dl">
                      <div><dt>Référence</dt><dd class="cnm-mono">{{ l.refLettre || '—' }}</dd></div>
                      <div><dt>Dossier</dt><dd>{{ refDossier(l) }}</dd></div>
                      <div><dt>Objet</dt><dd>{{ l.objetLettre || '—' }}</dd></div>
                      <div><dt>Corps</dt><dd class="lrc__corps">{{ l.corpsLettre || '—' }}</dd></div>
                      <div><dt>Date d'examen</dt><dd class="cnm-mono">{{ l.dateExamen || '—' }}</dd></div>
                      <div><dt>Date lettre</dt><dd class="cnm-mono">{{ l.dateLettre || '—' }}</dd></div>
                      <div><dt>Statut</dt><dd><app-statut-badge [statut]="l.statut" /></dd></div>
                      <div><dt>Signataire</dt><dd>{{ l.nomSignataire || '—' }}</dd></div>
                    </dl>
                    @if (signable && l.statut === 'SOUMIS') {
                      <div class="lrc__detail-foot">
                        <button type="button" class="btn btn-primary" [disabled]="signature() === l.idLettre" (click)="signer(l)">
                          {{ signature() === l.idLettre ? 'Signature…' : 'Signer la lettre' }}
                        </button>
                      </div>
                    }

                    @if (piecesUpload && l.statut === 'SIGNE') {
                      <div class="lrc__pieces">
                        <h3 class="lrc__pieces-title">Pièces initiales du dossier</h3>
                        @for (p of piecesInitiales(); track p.idPiece) {
                          <div class="lrc__piece">
                            <span>📎 {{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                            <button type="button" class="btn btn-secondary btn-sm" (click)="telecharger(p)">Télécharger</button>
                          </div>
                        } @empty {
                          <p class="text-muted">Aucune pièce initiale.</p>
                        }

                        <h3 class="lrc__pieces-title">Pièces ajoutées suite à cette lettre</h3>
                        @for (p of piecesApres(l); track p.idPiece) {
                          <div class="lrc__piece">
                            <span>📎 {{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                            <span class="badge badge-warning">Ajoutée après lettre</span>
                            <button type="button" class="btn btn-secondary btn-sm" (click)="telecharger(p)">Télécharger</button>
                          </div>
                        } @empty {
                          <p class="text-muted">Aucune pièce ajoutée après cette lettre.</p>
                        }

                        <div class="lrc__upload">
                          <select class="form-control" [value]="uploadType() ?? ''" (change)="uploadType.set($any($event.target).value ? +$any($event.target).value : null)">
                            <option value="">— Type de pièce —</option>
                            @for (t of typesPour(l); track t.idTypePiece) {
                              <option [value]="t.idTypePiece">{{ t.libellePiece }}</option>
                            }
                          </select>
                          <input type="file" accept=".pdf,.jpeg,.jpg,.png" (change)="onUploadFile($event)" />
                          <button type="button" class="btn btn-primary btn-sm" [disabled]="uploading() || uploadType() == null || !uploadFile()" (click)="ajouterPiece(l)">
                            {{ uploading() ? 'Ajout…' : '+ Ajouter une pièce' }}
                          </button>
                        </div>
                      </div>
                    }
                  </td>
                </tr>
              }
            } @empty {
              <tr><td colspan="6" class="text-muted">Aucune lettre de renvoi.</td></tr>
            }
          </tbody>
        </table>
        </div>
      }
    </section>
  `,
  styles: `
    .lrc__actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
    .lrc__detail-foot { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
    .lrc__dl { display: flex; flex-direction: column; gap: 0.35rem; margin: 0; }
    .lrc__dl > div { display: flex; gap: 0.5rem; align-items: baseline; }
    .lrc__dl dt { flex: 0 0 10rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-400); }
    .lrc__dl dd { margin: 0; }
    .lrc__corps { white-space: pre-wrap; }
    .lrc__pieces { margin-top: 0.75rem; border-top: 1px solid var(--c-100); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .lrc__pieces-title { margin: 0.5rem 0 0; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-400); }
    .lrc__piece { display: flex; align-items: center; gap: 0.5rem; }
    .lrc__upload { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .table-card td { white-space: normal; }
    .lrc__detail > td { background: var(--c-50); }
  `,
})
export class LettreRenvoiConsultation {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(LettreRenvoiService);
  private readonly dossierService = inject(DossierService);
  private readonly toast = inject(ToastService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly typePieceService = inject(TypePieceJointeService);

  private readonly source = (this.route.snapshot.data['source'] as 'mes' | 'localite') ?? 'localite';
  /** CC / Président : autorise la signature des lettres SOUMIS. */
  readonly signable = (this.route.snapshot.data['signable'] as boolean) ?? false;
  /** PRMP : autorise l'ajout de pièces après une lettre de renvoi signée. */
  readonly piecesUpload = (this.route.snapshot.data['piecesUpload'] as boolean) ?? false;
  readonly titre = (this.route.snapshot.data['title'] as string) ?? 'Lettres de renvoi';
  readonly loading = signal(true);
  readonly lettres = signal<LettreRenvoi[]>([]);
  readonly ouvert = signal<number | null>(null);
  /** idLettre en cours de signature (désactive le bouton). */
  readonly signature = signal<number | null>(null);
  private readonly dossierRefs = signal<Map<number, string>>(new Map());
  private readonly dossierTypes = signal<Map<number, string>>(new Map());
  /** Pièces du dossier de la lettre ouverte (chargées au dépliage). */
  readonly pieces = signal<PieceJointeDossier[]>([]);
  /** Types de pièces (référentiel) pour le select d'ajout. */
  readonly typesPiece = signal<TypePieceJointe[]>([]);
  /** Saisie d'ajout de pièce (type + fichier). */
  readonly uploadType = signal<number | null>(null);
  readonly uploadFile = signal<File | null>(null);
  readonly uploading = signal(false);

  constructor() {
    const param = this.route.snapshot.paramMap.get('idLettre');
    if (param) {
      this.ouvert.set(Number(param));
    }
    this.dossierService.list().subscribe((rows: Dossier[]) => {
      this.dossierRefs.set(new Map(rows.map((d) => [d.idDossier, d.refeDossier ?? ''])));
      this.dossierTypes.set(new Map(rows.map((d) => [d.idDossier, d.idTypeDossier ?? ''])));
    });
    if (this.piecesUpload) {
      this.typePieceService.list().subscribe((rows) => this.typesPiece.set(rows));
    }
    const call = this.source === 'mes' ? this.service.getMesLettres() : this.service.getAll();
    call.subscribe({
      next: (rows) => {
        this.lettres.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  basculer(l: LettreRenvoi): void {
    const ouverture = this.ouvert() !== l.idLettre;
    this.ouvert.update((cur) => (cur === l.idLettre ? null : (l.idLettre ?? null)));
    // À l'ouverture d'une lettre signée (PRMP) : charge les pièces du dossier pour les deux sections.
    if (ouverture && this.piecesUpload && l.statut === 'SIGNE' && l.idDossier != null) {
      this.uploadType.set(null);
      this.uploadFile.set(null);
      this.pieces.set([]);
      this.pieceService.getByDossier(l.idDossier).subscribe((rows) => this.pieces.set(rows));
    }
  }

  // — Pièces jointes (PRMP, après lettre signée) —
  piecesInitiales(): PieceJointeDossier[] {
    return this.pieces().filter((p) => !p.apresLettreRenvoi);
  }
  piecesApres(l: LettreRenvoi): PieceJointeDossier[] {
    return this.pieces().filter((p) => p.apresLettreRenvoi && p.idLettre === l.idLettre);
  }
  /** Types de pièces attendus pour le type du dossier de la lettre. */
  typesPour(l: LettreRenvoi): TypePieceJointe[] {
    const type = l.idDossier != null ? this.dossierTypes().get(l.idDossier) : undefined;
    return this.typesPiece().filter((t) => !t.idTypeDossier || t.idTypeDossier === type);
  }
  onUploadFile(ev: Event): void {
    this.uploadFile.set((ev.target as HTMLInputElement).files?.[0] ?? null);
  }
  /** Téléverse une pièce après la lettre (apresLettreRenvoi=true côté serveur via idLettre). */
  ajouterPiece(l: LettreRenvoi): void {
    const type = this.uploadType();
    const file = this.uploadFile();
    if (l.idDossier == null || l.idLettre == null || type == null || !file) {
      this.toast.error('Sélectionnez un type de pièce et un fichier.');
      return;
    }
    const fd = new FormData();
    fd.append(
      'data',
      new Blob([JSON.stringify({ idDossier: l.idDossier, idTypePiece: type, idLettre: l.idLettre })], {
        type: 'application/json',
      }),
    );
    fd.append('fichier', file);
    this.uploading.set(true);
    this.pieceService.upload(fd).subscribe({
      next: () => {
        this.toast.success('Pièce ajoutée.');
        this.uploadType.set(null);
        this.uploadFile.set(null);
        this.uploading.set(false);
        if (l.idDossier != null) {
          this.pieceService.getByDossier(l.idDossier).subscribe((rows) => this.pieces.set(rows));
        }
      },
      error: (e: ApiError) => {
        this.uploading.set(false);
        this.toast.error(e.message || "Erreur lors de l'ajout de la pièce.");
      },
    });
  }
  /** Télécharge le contenu d'une pièce (blob → téléchargement navigateur). */
  telecharger(p: PieceJointeDossier): void {
    if (p.idPiece == null) {
      return;
    }
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = p.nomFichier || `piece-${p.idPiece}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (e: ApiError) => this.toast.error(e.message || 'Erreur lors du téléchargement.'),
    });
  }
  /** Signe une lettre SOUMIS (CC/Président) → SIGNE ; met à jour la ligne en place. */
  signer(l: LettreRenvoi): void {
    if (l.idLettre == null) {
      return;
    }
    this.signature.set(l.idLettre);
    this.service.signer(l.idLettre).subscribe({
      next: (maj) => {
        this.toast.success('Lettre de renvoi signée.');
        this.lettres.update((arr) => arr.map((x) => (x.idLettre === maj.idLettre ? maj : x)));
        this.signature.set(null);
      },
      error: (e: ApiError) => {
        this.signature.set(null);
        this.toast.error(
          e.status === 403
            ? 'Seuls le Chef de commission ou le Président peuvent signer.'
            : e.status === 409
              ? "Cette lettre n'est pas au statut « Soumis »."
              : e.message || 'Erreur lors de la signature.',
        );
      },
    });
  }
  refDossier(l: LettreRenvoi): string {
    const ref = l.idDossier != null ? this.dossierRefs().get(l.idDossier) : '';
    return ref || (l.idDossier != null ? 'Dossier #' + l.idDossier : '—');
  }
}
