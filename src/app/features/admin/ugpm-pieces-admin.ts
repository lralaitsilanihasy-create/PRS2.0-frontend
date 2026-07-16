import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { UgpmPieceType, UgpmService } from '../../services';

interface PieceDef {
  type: UgpmPieceType;
  label: string;
  accept: string;
  /** Types MIME acceptés côté client (contrôle de courtoisie ; le serveur vérifie les magic-bytes). */
  mimes: string[];
}

const IMAGES = ['image/jpeg', 'image/png'];
const DOCS = ['application/pdf', ...IMAGES];

// UGPM : CIN + photo uniquement (pas d'arrêté de nomination). Toutes deux ≤ 5 Mo.
const PIECES: PieceDef[] = [
  { type: 'CIN', label: 'CIN', accept: '.pdf,image/png,image/jpeg', mimes: DOCS },
  { type: 'PHOTO', label: 'Photo', accept: 'image/png,image/jpeg', mimes: IMAGES },
];

/**
 * Gestion des pièces jointes d'une UGPM (CIN + photo, pas d'arrêté), réservée à l'ADMINISTRATEUR.
 * Atteint via l'action « Pièces » de la liste UGPM (`?ugpm={matricule}`). Chaque pièce est optionnelle :
 * dépôt/remplacement via `POST /api/ugpms/{id}/pieces/{type}`, consultation via `GET …/pieces/{type}`
 * (ouverte dans un nouvel onglet ; 404 si la pièce n'a pas été déposée).
 */
@Component({
  selector: 'app-ugpm-pieces-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { '[class.up--embedded]': 'embedded()' },
  template: `
    <section class="up cnm-card">
      <header class="up__head">
        <h1 class="up__title">Pièces jointes — UGPM {{ idUgpm() || '?' }}</h1>
        @if (embedded()) {
          <button type="button" class="btn btn-outline btn-sm" (click)="close.emit()">Fermer</button>
        } @else {
          <a class="btn btn-outline btn-sm" routerLink="/admin/comptes/ugpms">← Retour aux UGPM</a>
        }
      </header>

      @if (!idUgpm()) {
        <p class="cnm-muted">UGPM non précisée. Revenez à la liste et cliquez « Pièces » sur une ligne.</p>
      } @else {
        <p class="cnm-muted">
          PDF, JPEG ou PNG, ≤ 5 Mo. Chaque pièce est facultative ; déposer une nouvelle pièce remplace la précédente.
        </p>
        <div class="up__grid">
          @for (p of pieces; track p.type) {
            <div class="up__card">
              <span class="up__label">{{ p.label }} <span class="up__hint">(≤ 5 Mo)</span></span>
              <input class="form-control" type="file" [accept]="p.accept" (change)="onFile(p, $event)" />
              @if (selected()[p.type]; as f) { <span class="form-hint">{{ f.name }}</span> }
              <div class="up__actions">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="!selected()[p.type] || busy() === p.type"
                  (click)="deposer(p)"
                >
                  {{ busy() === p.type ? 'Envoi…' : 'Déposer' }}
                </button>
                <button type="button" class="btn btn-outline btn-sm" [disabled]="busy() === p.type" (click)="telecharger(p)">
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
    :host(.up--embedded) { flex: 1 1 26rem; align-self: flex-start; position: sticky; top: 1rem; }
    .up { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; max-width: min(48rem, 96vw); }
    .up__head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .up__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .up__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 1rem; }
    .up__card {
      display: flex; flex-direction: column; gap: 0.5rem;
      padding: 0.85rem 1rem; border: 1px solid var(--c-100); border-radius: var(--radius-md); background: #fff;
    }
    .up__label { font-weight: 600; color: var(--c-800); }
    .up__hint { font-weight: 400; color: var(--n-400); }
    .up__actions { display: flex; gap: 0.4rem; margin-top: 0.25rem; }
  `,
})
export class UgpmPiecesAdmin {
  private readonly route = inject(ActivatedRoute);
  private readonly ugpmService = inject(UgpmService);
  private readonly toast = inject(ToastService);

  /** Id fourni en mode embarqué (panneau de droite) ; sinon lu depuis le query param en mode page. */
  readonly idUgpmInput = input<string | null>(null, { alias: 'idUgpm' });
  readonly close = output<void>();
  readonly embedded = computed(() => this.idUgpmInput() !== null);

  protected readonly pieces = PIECES;
  private readonly idFromRoute = this.route.snapshot.queryParamMap.get('ugpm') ?? '';
  /** Id effectif : entrée si embarqué, sinon query param. */
  readonly idUgpm = computed(() => this.idUgpmInput() ?? this.idFromRoute);
  readonly selected = signal<Record<string, File | null>>({ CIN: null, PHOTO: null });
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
      if (file.size > 5 * 1024 * 1024) {
        this.toast.error('Fichier trop volumineux (max 5 Mo).', 'Pièce invalide');
        input.value = '';
        this.setSelected(p.type, null);
        return;
      }
    }
    this.setSelected(p.type, file);
  }

  deposer(p: PieceDef): void {
    const file = this.selected()[p.type];
    const id = this.idUgpm();
    if (!file || !id) {
      return;
    }
    this.busy.set(p.type);
    this.ugpmService.uploadPiece(id, p.type, file).subscribe({
      next: () => {
        this.toast.success(`« ${p.label} » déposée.`);
        this.setSelected(p.type, null);
        this.busy.set(null);
      },
      error: (_e: ApiError) => this.busy.set(null),
    });
  }

  telecharger(p: PieceDef): void {
    const id = this.idUgpm();
    if (!id) {
      return;
    }
    this.busy.set(p.type);
    this.ugpmService.downloadPiece(id, p.type).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.busy.set(null);
      },
      error: (e: ApiError) => {
        this.busy.set(null);
        if (e.status === 404) {
          this.toast.info(`Aucune « ${p.label} » déposée pour cette UGPM.`, 'Pièce absente');
        } else {
          this.toast.error('Téléchargement impossible.', 'Erreur');
        }
      },
    });
  }

  private setSelected(type: UgpmPieceType, file: File | null): void {
    this.selected.update((cur) => ({ ...cur, [type]: file }));
  }
}
