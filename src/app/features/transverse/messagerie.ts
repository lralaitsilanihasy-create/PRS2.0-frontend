import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError, getFieldError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Message } from '../../models';
import { MessageService } from '../../services';

/**
 * Messagerie interne, réutilisable par tout profil (confidentialité gérée côté backend :
 * on ne voit que ses messages). Onglets reçus/envoyés, composition et marquage comme lu.
 */
@Component({
  selector: 'app-messagerie',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <section class="msg">
      <header class="msg__header">
        <h1 class="msg__title">Messagerie</h1>
        <button type="button" class="cnm-btn cnm-btn--primary" (click)="toggleCompose()">
          {{ composeOpen() ? 'Fermer' : '✉ Nouveau message' }}
        </button>
      </header>

      @if (composeOpen()) {
        <form class="msg__compose" [formGroup]="form" (ngSubmit)="envoyer()" novalidate>
          <label class="field">
            <span class="field__label">Destinataire (matricule) *</span>
            <input type="text" formControlName="destinataireIm" />
            @if (fieldErr('destinataireIm')) { <span class="cnm-field__hint">{{ fieldErr('destinataireIm') }}</span> }
          </label>
          <label class="field">
            <span class="field__label">Sujet</span>
            <input type="text" formControlName="sujet" />
            @if (fieldErr('sujet')) { <span class="cnm-field__hint">{{ fieldErr('sujet') }}</span> }
          </label>
          <label class="field">
            <span class="field__label">Message</span>
            <textarea rows="3" formControlName="corps"></textarea>
            @if (fieldErr('corps')) { <span class="cnm-field__hint">{{ fieldErr('corps') }}</span> }
          </label>
          <label class="field">
            <span class="field__label">Dossier lié (facultatif)</span>
            <input type="number" formControlName="idDossier" />
          </label>
          <div class="msg__compose-actions">
            <button type="submit" class="cnm-btn cnm-btn--primary">Envoyer</button>
          </div>
        </form>
      }

      <div class="msg__tabs">
        <button
          type="button"
          class="msg__tab"
          [class.msg__tab--active]="tab() === 'recus'"
          (click)="tab.set('recus')"
        >
          Reçus
        </button>
        <button
          type="button"
          class="msg__tab"
          [class.msg__tab--active]="tab() === 'envoyes'"
          (click)="tab.set('envoyes')"
        >
          Envoyés
        </button>
      </div>

      @let liste = tab() === 'recus' ? recus() : envoyes();
      @if (loading()) {
        <p class="msg__info">Chargement…</p>
      } @else {
        <ul class="msg__list">
          @for (m of liste; track m.idMessage) {
            <li class="msg-item" [class.msg-item--unread]="tab() === 'recus' && !m.lu">
              <div class="msg-item__head">
                <span class="msg-item__who">
                  {{ tab() === 'recus' ? m.expediteurIm : '→ ' + m.destinataireIm }}
                </span>
                <span class="msg-item__date">{{ m.dateEnvoi || '' }}</span>
              </div>
              <strong class="msg-item__sujet">{{ m.sujet || '(sans sujet)' }}</strong>
              @if (m.corps) {
                <p class="msg-item__corps">{{ m.corps }}</p>
              }
              @if (tab() === 'recus' && !m.lu) {
                <button type="button" class="cnm-btn cnm-btn--ghost" (click)="marquerLu(m)">
                  Marquer comme lu
                </button>
              }
            </li>
          } @empty {
            <li class="msg__info">Aucun message.</li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .msg__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .msg__title {
      margin: 0;
      font-size: 1.35rem;
      color: var(--cnm-text);
    }
    .msg__info {
      color: var(--cnm-text-2);
      padding: 0.5rem 0;
    }
    .msg__compose {
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-width: 32rem;
    }
    .msg__compose-actions {
      display: flex;
      justify-content: flex-end;
    }
    .msg__tabs {
      display: flex;
      gap: 0.25rem;
      margin-bottom: 0.75rem;
    }
    .msg__tab {
      border: 0;
      background: var(--cnm-surface-2);
      color: var(--cnm-text-2);
      padding: 0.4rem 1rem;
      border-radius: 0.375rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .msg__tab--active {
      background: var(--cnm-brand);
      color: #fff;
    }
    .msg__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .msg-item {
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .msg-item--unread {
      border-left: 3px solid var(--cnm-brand);
    }
    .msg-item__head {
      display: flex;
      justify-content: space-between;
      font-size: 0.78rem;
      color: var(--cnm-text-2);
    }
    .msg-item__who {
      font-weight: 600;
      color: var(--cnm-brand);
    }
    .msg-item__corps {
      margin: 0;
      font-size: 0.85rem;
      color: var(--cnm-text-2);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .field__label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--cnm-text-2);
    }
    .field input,
    .field textarea {
      border: 1px solid var(--cnm-border-strong);
      border-radius: 0.375rem;
      padding: 0.45rem 0.6rem;
      font: inherit;
    }
    .btn {
      border: 0;
      border-radius: 0.375rem;
      padding: 0.4rem 0.75rem;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      align-self: flex-start;
    }
    .btn--primary {
      background: var(--cnm-brand);
      color: #fff;
    }
    .btn--ghost {
      background: var(--cnm-surface-2);
      color: var(--cnm-text-2);
    }
  `,
})
export class Messagerie {
  private readonly service = inject(MessageService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly tab = signal<'recus' | 'envoyes'>('recus');
  readonly recus = signal<Message[]>([]);
  readonly envoyes = signal<Message[]>([]);
  readonly loading = signal(false);
  readonly composeOpen = signal(false);
  readonly formError = signal<ApiError | null>(null);

  fieldErr(champ: string): string | undefined {
    return getFieldError(this.formError(), champ);
  }

  readonly form = this.fb.nonNullable.group({
    destinataireIm: ['', Validators.required],
    sujet: [''],
    corps: [''],
    idDossier: [null as number | null],
  });

  constructor() {
    this.charger();
  }

  toggleCompose(): void {
    this.composeOpen.update((v) => !v);
  }

  charger(): void {
    this.loading.set(true);
    this.service.recus().subscribe({
      next: (rows) => this.recus.set(rows),
      error: () => this.loading.set(false),
    });
    this.service.envoyes().subscribe({
      next: (rows) => {
        this.envoyes.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  envoyer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.formError.set(null);
    const v = this.form.getRawValue();
    this.service
      .envoyer({
        destinataireIm: v.destinataireIm,
        sujet: v.sujet || undefined,
        corps: v.corps || undefined,
        idDossier: v.idDossier ?? undefined,
      })
      .subscribe({
        next: () => {
          this.toast.success('Message envoyé.');
          this.form.reset();
          this.composeOpen.set(false);
          this.charger();
        },
        error: (err: ApiError) => this.formError.set(err),
      });
  }

  marquerLu(m: Message): void {
    this.service.marquerLu(m.idMessage).subscribe({
      next: () => this.charger(),
    });
  }
}
