import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { validerFichier } from '../../core/securite/fichiers-surs';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { Dossier, PieceJointeDossier, TypePieceJointe, VerificationPieceDepot } from '../../models';
import {
  DossierService,
  PieceJointeDossierService,
  TypePieceJointeService,
  VerificationPieceDepotService,
} from '../../services';

/**
 * ⚠️ Spec recevabilité au dépôt (2026-08-02) — modal PRMP « Compléter les pièces » : le dossier est
 * EN_ATTENTE_COMPLEMENTS_DEPOT (contrôle de complétude du Secrétaire). Affiche les DÉFAUTS relevés
 * (dernière décision non conforme / manquante + observation du Secrétaire), permet de déposer les
 * pièces demandées, puis « Transmettre les compléments » (→ SOUMIS, le Secrétaire reprend le contrôle,
 * les pièces déjà conformes restent acquises).
 */
@Component({
  selector: 'app-completer-pieces-depot-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    <div class="modal-backdrop" (click)="fermer.emit()">
      <div class="modal cnm-form cpd-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Compléter les pièces du dépôt" appModale (appModaleFermer)="fermer.emit()">
        <header class="modal-header-plain">
          <span class="modal-title">Compléter les pièces — {{ dossier().refeDossier || 'Dossier #' + dossier().idDossier }}</span>
          <button type="button" class="btn-close-plain" aria-label="Fermer" (click)="fermer.emit()">✕</button>
        </header>

        <div class="modal-body">
          <p class="form-hint">
            Le contrôle de complétude du Secrétaire a relevé des pièces manquantes ou non conformes.
            Déposez les pièces demandées puis transmettez les compléments.
          </p>

          <h3 class="cpd-sub">Pièces à corriger</h3>
          @if (chargement()) {
            <p class="text-muted" role="status">Chargement…</p>
          } @else {
            @for (d of defauts(); track d.type.idTypePiece) {
              <div class="cpd-defaut">
                <span class="cpd-defaut__lbl">{{ d.type.libellePiece }}</span>
                <span class="badge badge-danger">{{ d.manquante ? 'Manquante' : 'Non conforme' }}</span>
                @if (d.observation) { <span class="cpd-defaut__obs">« {{ d.observation }} »</span> }
              </div>
            } @empty {
              <p class="text-muted">Aucun défaut relevé (contrôle en attente côté Secrétaire).</p>
            }

            <h3 class="cpd-sub">Déposer une pièce</h3>
            <div class="cpd-upload">
              <select class="form-control" [value]="uploadType() ?? ''"
                (change)="uploadType.set($any($event.target).value ? +$any($event.target).value : null)">
                <option value="">— Type de pièce —</option>
                @for (t of typesAttendus(); track t.idTypePiece) {
                  <option [value]="t.idTypePiece">{{ t.libellePiece }}</option>
                }
              </select>
              <input type="file" accept=".pdf,.jpeg,.jpg,.png" (change)="onFile($event)" />
              <button type="button" class="btn btn-primary btn-sm"
                [disabled]="uploading() || uploadType() == null || !uploadFile()" (click)="deposer()">
                {{ uploading() ? 'Dépôt…' : '+ Déposer' }}
              </button>
            </div>

            @if (pieces().length) {
              <h3 class="cpd-sub">Pièces du dossier</h3>
              @for (p of pieces(); track p.idPiece) {
                <div class="cpd-piece">📎 {{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</div>
              }
            }
          }
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn btn-outline" (click)="fermer.emit()">Fermer</button>
          <button type="button" class="btn btn-primary" [disabled]="transmission()" (click)="transmettre()">
            {{ transmission() ? 'Transmission…' : 'Transmettre les compléments' }}
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: `
    .cpd-modal { max-width: 40rem; }
    .cpd-sub { margin: 0.75rem 0 0.35rem; font-size: var(--text-sm); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-400); }
    .cpd-defaut { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.45rem 0.6rem; background: #FEF2F2; border: 1px solid #FEE2E2; border-left: 3px solid #DC2626; border-radius: var(--radius-md); margin-bottom: 0.35rem; }
    .cpd-defaut__lbl { font-weight: 600; }
    .cpd-defaut__obs { color: var(--n-500); font-size: var(--text-sm); font-style: italic; }
    .cpd-upload { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .cpd-piece { padding: 0.3rem 0.5rem; font-size: var(--text-sm); }
  `,
})
export class CompleterPiecesDepotModal implements OnInit {
  readonly dossier = input.required<Dossier>();
  /** Émis après « Transmettre les compléments » (dossier revenu SOUMIS — liste à rafraîchir). */
  readonly transmis = output<Dossier>();
  readonly fermer = output<void>();

  private readonly toast = inject(ToastService);
  private readonly dossierService = inject(DossierService);
  private readonly typePieceService = inject(TypePieceJointeService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly verifService = inject(VerificationPieceDepotService);

  readonly chargement = signal(true);
  readonly uploading = signal(false);
  readonly transmission = signal(false);
  readonly typesAttendus = signal<TypePieceJointe[]>([]);
  readonly pieces = signal<PieceJointeDossier[]>([]);
  private readonly decisions = signal<Map<number, VerificationPieceDepot>>(new Map());
  readonly uploadType = signal<number | null>(null);
  readonly uploadFile = signal<File | null>(null);

  /** Défauts courants : dernière décision ≠ CONFORME, ou obligatoire sans pièce déposée. */
  readonly defauts = computed(() => {
    const deposees = new Set(this.pieces().map((p) => p.idTypePiece));
    return this.typesAttendus()
      .map((type) => {
        const d = this.decisions().get(type.idTypePiece) ?? null;
        if (d && d.decision !== 'CONFORME') {
          return { type, manquante: d.decision === 'MANQUANTE', observation: d.observation };
        }
        if (!d && type.obligatoire && !deposees.has(type.idTypePiece)) {
          return { type, manquante: true, observation: undefined };
        }
        return null;
      })
      .filter((x): x is { type: TypePieceJointe; manquante: boolean; observation: string | undefined } => x !== null);
  });

  ngOnInit(): void {
    this.recharger();
  }

  private recharger(): void {
    forkJoin({
      types: this.typePieceService.list().pipe(catchError(() => of([] as TypePieceJointe[]))),
      pieces: this.pieceService.getByDossier(this.dossier().idDossier).pipe(catchError(() => of([] as PieceJointeDossier[]))),
      verifs: this.verifService.parDossier(this.dossier().idDossier).pipe(catchError(() => of([] as VerificationPieceDepot[]))),
    }).subscribe(({ types, pieces, verifs }) => {
      this.typesAttendus.set(
        types
          .filter((t) => t.idTypeDossier === this.dossier().idTypeDossier)
          .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)),
      );
      this.pieces.set(pieces);
      const etat = new Map<number, VerificationPieceDepot>();
      for (const v of verifs) etat.set(v.idTypePiece, v);
      this.decisions.set(etat);
      this.chargement.set(false);
    });
  }

  onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f) {
      const erreurFichier = validerFichier(f);
      if (erreurFichier) {
        this.toast.error(erreurFichier);
        input.value = '';
        this.uploadFile.set(null);
        return;
      }
    }
    this.uploadFile.set(f);
  }

  /** Dépose une pièce (multipart `data` + `fichier`) — pièce initiale du dossier au dépôt. */
  deposer(): void {
    const idTypePiece = this.uploadType();
    const fichier = this.uploadFile();
    if (idTypePiece == null || !fichier) return;
    this.uploading.set(true);
    const fd = new FormData();
    fd.append(
      'data',
      new Blob([JSON.stringify({ idDossier: this.dossier().idDossier, idTypePiece })], { type: 'application/json' }),
    );
    fd.append('fichier', fichier, fichier.name);
    this.pieceService.upload(fd).subscribe({
      next: () => {
        this.uploading.set(false);
        this.uploadType.set(null);
        this.uploadFile.set(null);
        this.toast.success('Pièce déposée.');
        this.recharger();
      },
      error: (e: ApiError) => {
        this.uploading.set(false);
        this.toast.error(e.message || 'Dépôt impossible.');
      },
    });
  }

  /** EN_ATTENTE_COMPLEMENTS_DEPOT → SOUMIS : le Secrétaire reprend le contrôle de complétude. */
  transmettre(): void {
    this.transmission.set(true);
    this.dossierService.transmettreComplementsDepot(this.dossier().idDossier).subscribe({
      next: (maj) => {
        this.transmission.set(false);
        this.toast.success('Compléments transmis — le Secrétaire reprend le contrôle de complétude.');
        this.transmis.emit(maj);
      },
      error: (e: ApiError) => {
        this.transmission.set(false);
        this.toast.error(e.message || 'Transmission impossible.');
      },
    });
  }
}
