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
      <header class="page-header">
        <h1 class="page-title">Messagerie</h1>
        <button type="button" class="btn btn-primary" (click)="toggleCompose()">
          {{ composeOpen() ? 'Fermer' : '✉ Nouveau message' }}
        </button>
      </header>

      @if (composeOpen()) {
        <form class="card msg__compose" [formGroup]="form" (ngSubmit)="envoyer()" novalidate>
          <div class="form-group">
            <label class="form-label required">Destinataire (matricule)</label>
            <input class="form-control" type="text" formControlName="destinataireIm" />
            @if (fieldErr('destinataireIm')) { <span class="form-error">{{ fieldErr('destinataireIm') }}</span> }
          </div>
          <div class="form-group">
            <label class="form-label">Sujet</label>
            <input class="form-control" type="text" formControlName="sujet" />
            @if (fieldErr('sujet')) { <span class="form-error">{{ fieldErr('sujet') }}</span> }
          </div>
          <div class="form-group">
            <label class="form-label">Message</label>
            <textarea class="form-control" rows="3" formControlName="corps"></textarea>
            @if (fieldErr('corps')) { <span class="form-error">{{ fieldErr('corps') }}</span> }
          </div>
          <div class="form-group">
            <label class="form-label">Dossier lié (facultatif)</label>
            <input class="form-control" type="number" formControlName="idDossier" />
          </div>
          <div class="msg__compose-actions">
            <button type="submit" class="btn btn-primary">Envoyer</button>
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
                <button type="button" class="btn btn-secondary btn-sm" (click)="marquerLu(m)">
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
    .msg__info {
      color: var(--n-500);
      padding: 0.5rem 0;
    }
    .msg__compose {
      padding: 1.25rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 32rem;
    }
    .msg__compose .form-group { margin-bottom: 0; }
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
      background: var(--n-100);
      color: var(--n-500);
      padding: 0.4rem 1rem;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-weight: 600;
      font-size: var(--text-sm);
    }
    .msg__tab--active {
      background: linear-gradient(135deg, var(--c-600), var(--c-700));
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
      background: #fff;
      border: 1px solid var(--c-100);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      align-items: flex-start;
    }
    .msg-item--unread {
      border-left: 3px solid var(--c-600);
    }
    .msg-item__head {
      display: flex;
      justify-content: space-between;
      width: 100%;
      font-size: var(--text-sm);
      color: var(--n-500);
    }
    .msg-item__who {
      font-weight: 600;
      color: var(--c-700);
    }
    .msg-item__corps {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--n-600);
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
