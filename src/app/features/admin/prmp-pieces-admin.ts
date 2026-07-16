import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { PrmpPieceType, PrmpService } from '../../services';

interface PieceDef {
  type: PrmpPieceType;
  label: string;
  maxMo: number;
  accept: string;
  /** Types MIME acceptés côté client (contrôle de courtoisie ; le serveur vérifie les magic-bytes). */
  mimes: string[];
}

const IMAGES = ['image/jpeg', 'image/png'];
const DOCS = ['application/pdf', ...IMAGES];

const PIECES: PieceDef[] = [
  { type: 'ARRETE_NOMIN', label: 'Arrêté de nomination', maxMo: 10, accept: '.pdf,image/png,image/jpeg', mimes: DOCS },
  { type: 'CIN', label: 'CIN', maxMo: 5, accept: '.pdf,image/png,image/jpeg', mimes: DOCS },
  { type: 'PHOTO', label: 'Photo', maxMo: 5, accept: 'image/png,image/jpeg', mimes: IMAGES },
];

/**
 * Gestion des pièces jointes d'une PRMP (arrêté / CIN / photo), réservée à l'ADMINISTRATEUR.
 * Atteint via l'action « Pièces jointes » de la liste PRMP (`?prmp={matricule}`). Chaque pièce est
 * **optionnelle** : dépôt/remplacement via `POST /api/prmps/{id}/pieces/{type}`, consultation via
 * `GET …/pieces/{type}` (ouverte dans un nouvel onglet ; 404 si la pièce n'a pas été déposée).
 */
@Component({
  selector: 'app-prmp-pieces-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { '[class.pp--embedded]': 'embedded()' },
  template: `
    <section class="pp cnm-card">
      <header class="pp__head">
        <h1 class="pp__title">Pièces jointes — PRMP {{ idPrmp() || '?' }}</h1>
        @if (embedded()) {
          <button type="button" class="btn btn-outline btn-sm" (click)="close.emit()">Fermer</button>
        } @else {
          <a class="btn btn-outline btn-sm" routerLink="/admin/comptes/prmps">← Retour aux PRMP</a>
        }
      </header>

      @if (!idPrmp()) {
        <p class="cnm-muted">PRMP non précisée. Revenez à la liste et cliquez « Pièces jointes » sur une ligne.</p>
      } @else {
        <p class="cnm-muted">
          PDF, JPEG ou PNG. Chaque pièce est facultative ; déposer une nouvelle pièce remplace la précédente.
        </p>
        <div class="pp__grid">
          @for (p of pieces; track p.type) {
            <div class="pp__card">
              <span class="pp__label">{{ p.label }} <span class="pp__hint">(≤ {{ p.maxMo }} Mo)</span></span>
              <input class="form-control" type="file" [accept]="p.accept" (change)="onFile(p, $event)" />
              @if (selected()[p.type]; as f) { <span class="form-hint">{{ f.name }}</span> }
              <div class="pp__actions">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="!selected()[p.type] || busy() === p.type"
                  (click)="deposer(p)"
                >
                  {{ busy() === p.type ? 'Envoi…' : 'Déposer' }}
                </button>
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  [disabled]="busy() === p.type"
                  (click)="telecharger(p)"
                >
                  Consulter
                </button>
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    :host(.pp--embedded) { flex: 1 1 26rem; align-self: flex-start; position: sticky; top: 1rem; }
    .pp { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; max-width: min(56rem, 96vw); }
    .pp__head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .pp__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .pp__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 1rem; }
    .pp__card {
      display: flex; flex-direction: column; gap: 0.5rem;
      padding: 0.85rem 1rem; border: 1px solid var(--c-100); border-radius: var(--radius-md); background: #fff;
    }
    .pp__label { font-weight: 600; color: var(--c-800); }
    .pp__hint { font-weight: 400; color: var(--n-400); }
    .pp__actions { display: flex; gap: 0.4rem; margin-top: 0.25rem; }
  `,
})
export class PrmpPiecesAdmin {
  private readonly route = inject(ActivatedRoute);
  private readonly prmpService = inject(PrmpService);
  private readonly toast = inject(ToastService);

  /** Id fourni en mode embarqué (panneau de droite) ; sinon lu depuis le query param en mode page. */
  readonly idPrmpInput = input<string | null>(null, { alias: 'idPrmp' });
  readonly close = output<void>();
  readonly embedded = computed(() => this.idPrmpInput() !== null);

  protected readonly pieces = PIECES;
  private readonly idFromRoute = this.route.snapshot.queryParamMap.get('prmp') ?? '';
  /** Id effectif : entrée si embarqué, sinon query param. */
  readonly idPrmp = computed(() => this.idPrmpInput() ?? this.idFromRoute);
  readonly selected = signal<Record<string, File | null>>({ ARRETE_NOMIN: null, CIN: null, PHOTO: null });
  /** Type de pièce en cours d'envoi/consultation (désactive ses boutons). */
  readonly busy = signal<string | null>(null);

  onFile(p: PieceDef, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) {
      if (!p.mimes.includes(file.type)) {
        this.toast.error('Format non autorisé (PDF, JPEG ou PNG).', 'Pièce invalide');
        input.value = '';
        this.setSelected(p.type, null);
        return;
      }
      if (file.size > p.maxMo * 1024 * 1024) {
        this.toast.error(`Fichier trop volumineux (max ${p.maxMo} Mo).`, 'Pièce invalide');
        input.value = '';
        this.setSelected(p.type, null);
        return;
      }
    }
    this.setSelected(p.type, file);
  }

  deposer(p: PieceDef): void {
    const file = this.selected()[p.type];
    const id = this.idPrmp();
    if (!file || !id) {
      return;
    }
    this.busy.set(p.type);
    this.prmpService.uploadPiece(id, p.type, file).subscribe({
      next: () => {
        this.toast.success(`« ${p.label} » déposée.`);
        this.setSelected(p.type, null);
        this.busy.set(null);
      },
      error: (_e: ApiError) => this.busy.set(null),
    });
  }

  telecharger(p: PieceDef): void {
    const id = this.idPrmp();
    if (!id) {
      return;
    }
    this.busy.set(p.type);
    this.prmpService.downloadPiece(id, p.type).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.busy.set(null);
      },
      error: (e: ApiError) => {
        this.busy.set(null);
        if (e.status === 404) {
          this.toast.info(`Aucune « ${p.label} » déposée pour cette PRMP.`, 'Pièce absente');
        } else {
          this.toast.error('Téléchargement impossible.', 'Erreur');
        }
      },
    });
  }

  private setSelected(type: PrmpPieceType, file: File | null): void {
    this.selected.update((cur) => ({ ...cur, [type]: file }));
  }
}
