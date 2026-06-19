import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, Notification } from '../../models';
import { DossierService, NotificationService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * « Dossiers à rectifier » (PRMP) : suite des messages d'observation transmis par le vérificateur
 * (notifications OBSERVATION_VERIFICATION — aucun champ observation dans DossierDto). Chaque message
 * affiche la référence du dossier, son statut, la date et le texte complet de l'observation.
 * Lecture seule ; la PRMP corrige le dossier puis le resoumet depuis ses écrans de saisie.
 */
@Component({
  selector: 'app-dossiers-a-rectifier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="ar">
      <header class="ar__header">
        <span class="cnm-section-label">Domaine PRMP</span>
        <h1 class="ar__title">Dossiers à rectifier</h1>
      </header>

      <div class="cnm-card ar__note">
        Observations transmises par le vérificateur. Corrigez le dossier concerné, puis resoumettez-le.
      </div>

      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else if (messages().length) {
        <ul class="ar__list">
          @for (m of messages(); track m.idNotification) {
            <li class="cnm-card ar__item">
              <div class="ar__item-head">
                @if (statutPour(m.idDossier); as s) { <app-statut-badge [statut]="s" /> }
                <span class="ar__date cnm-mono">{{ m.dateEnvoi || '—' }}</span>
              </div>
              <p class="ar__p ar__p--ref">Dossier {{ refPour(m.idDossier) }}</p>
              <p class="ar__p">{{ observationTexte(m) }}</p>
              <p class="ar__p ar__p--action">Veuillez rectifier le dossier.</p>
              @if (statutPour(m.idDossier) === 'EN_ATTENTE_DECISION_PRMP') {
                <div class="ar__form cnm-form">
                  <label class="cnm-field">
                    <span class="cnm-field__label">Motif de rectification *</span>
                    <textarea
                      class="cnm-textarea"
                      rows="2"
                      maxlength="255"
                      [value]="motif(m.idDossier!)"
                      (input)="setMotif(m.idDossier!, $any($event.target).value)"
                    ></textarea>
                  </label>
                  @if (errPour(m.idDossier)) { <span class="cnm-field__hint">{{ errPour(m.idDossier) }}</span> }
                  <div class="ar__form-foot">
                    <button
                      type="button"
                      class="cnm-btn cnm-btn--primary cnm-btn--sm"
                      [disabled]="saving() === m.idDossier"
                      (click)="demanderResoumission(m.idDossier!)"
                    >
                      {{ saving() === m.idDossier ? 'Resoumission…' : 'Resoumettre le dossier' }}
                    </button>
                  </div>
                </div>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="cnm-muted">Aucune observation à traiter.</p>
      }
    </section>

    @if (confirmId() !== null) {
      <div class="ar-modal__overlay" (click)="annulerResoumission()">
        <div class="ar-modal cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <h2 class="ar-modal__title">Resoumettre au vérificateur ?</h2>
          <p>Ce dossier sera renvoyé au vérificateur avec votre motif de rectification.</p>
          <div class="ar-modal__foot">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annulerResoumission()">Annuler</button>
            <button type="button" class="cnm-btn cnm-btn--primary" (click)="confirmerResoumission()">
              Confirmer la resoumission
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .ar__header { margin-bottom: var(--cnm-space-3); }
    .ar__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .ar__note { padding: var(--cnm-space-3) var(--cnm-space-4); color: var(--cnm-text-2); margin-bottom: var(--cnm-space-3); }
    .ar__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .ar__item { padding: var(--cnm-space-3) var(--cnm-space-4); border-left: 4px solid var(--cnm-warning-fg); }
    .ar__item-head { display: flex; align-items: center; gap: var(--cnm-space-2); }
    .ar__date { margin-left: auto; color: var(--cnm-text-3); font-size: var(--cnm-fs-micro); }
    .ar__p { margin: var(--cnm-space-1) 0 0; font-size: var(--cnm-fs-sm); }
    .ar__p--ref { font-weight: var(--cnm-fw-semibold); }
    .ar__p--action { color: var(--cnm-text-2); font-style: italic; }
    .ar__form { margin-top: var(--cnm-space-2); display: flex; flex-direction: column; gap: var(--cnm-space-1); }
    .ar__form-foot { display: flex; justify-content: flex-end; }
    .ar-modal__overlay { position: fixed; inset: 0; z-index: 1050; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; padding: var(--cnm-space-4); }
    .ar-modal { width: 100%; max-width: 30rem; padding: var(--cnm-space-4) var(--cnm-space-5); display: flex; flex-direction: column; gap: var(--cnm-space-3); box-shadow: var(--cnm-shadow); }
    .ar-modal__title { margin: 0; font-size: var(--cnm-fs-md); }
    .ar-modal__foot { display: flex; justify-content: flex-end; gap: var(--cnm-space-2); }
  `,
})
export class DossiersARectifier {
  private readonly dossierService = inject(DossierService);
  private readonly notificationService = inject(NotificationService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly messages = signal<Notification[]>([]);
  private readonly dossierMap = signal<Map<number, Dossier>>(new Map());

  /** Saisie du motif de rectification par dossier (clé = idDossier). */
  readonly motifs = signal<Record<number, string>>({});
  /** Erreurs de resoumission par dossier (clé = idDossier). */
  readonly errors = signal<Record<number, string>>({});
  /** idDossier en cours de resoumission (désactive le bouton). */
  readonly saving = signal<number | null>(null);
  /** idDossier dont la confirmation de resoumission est ouverte (null = fermée). */
  readonly confirmId = signal<number | null>(null);

  constructor() {
    this.charger();
  }

  private charger(): void {
    this.loading.set(true);
    forkJoin({ notifs: this.notificationService.mes(), dossiers: this.dossierService.list() }).subscribe({
      next: ({ notifs, dossiers }) => {
        this.dossierMap.set(new Map(dossiers.map((d) => [d.idDossier, d])));
        this.messages.set(
          notifs
            .filter((n) => n.typeNotif === 'OBSERVATION_VERIFICATION')
            .sort((a, b) => (b.dateEnvoi ?? '').localeCompare(a.dateEnvoi ?? '')),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  motif(id: number): string {
    return this.motifs()[id] ?? '';
  }
  setMotif(id: number, v: string): void {
    this.motifs.update((m) => ({ ...m, [id]: v }));
  }
  errPour(id?: number): string | undefined {
    return id == null ? undefined : this.errors()[id];
  }

  /** Vérifie le motif puis ouvre la confirmation. */
  demanderResoumission(id: number): void {
    if (!this.motif(id).trim()) {
      this.errors.update((e) => ({ ...e, [id]: 'Veuillez décrire les corrections apportées.' }));
      return;
    }
    this.errors.update((e) => ({ ...e, [id]: '' }));
    this.confirmId.set(id);
  }
  annulerResoumission(): void {
    this.confirmId.set(null);
  }
  /** Resoumet le dossier rectifié au vérificateur (EN_ATTENTE_DECISION_PRMP → EN_VERIFICATION). */
  confirmerResoumission(): void {
    const id = this.confirmId();
    if (id == null) {
      return;
    }
    this.confirmId.set(null);
    this.saving.set(id);
    this.dossierService.resoumettre(id, { motifRectification: this.motif(id).trim() }).subscribe({
      next: () => {
        this.toast.success('Dossier resoumis au vérificateur.');
        this.saving.set(null);
        this.motifs.update((m) => {
          const n = { ...m };
          delete n[id];
          return n;
        });
        this.charger();
      },
      error: (e: ApiError) => {
        this.saving.set(null);
        const msg =
          e.status === 400
            ? 'Le motif de rectification est obligatoire.'
            : e.status === 409
              ? "Ce dossier n'est pas en attente de rectification."
              : e.message || 'Erreur lors de la resoumission.';
        this.errors.update((er) => ({ ...er, [id]: msg }));
      },
    });
  }

  /** Référence du dossier (réf. officielle ou #id). */
  refPour(idDossier?: number): string {
    if (idDossier == null) {
      return '—';
    }
    return this.dossierMap().get(idDossier)?.refeDossier || '#' + idDossier;
  }
  statutPour(idDossier?: number): string | undefined {
    return idDossier == null ? undefined : this.dossierMap().get(idDossier)?.statut;
  }

  /** Texte de l'observation seul (contenu entre « … » du corps ; ni préfixe vérificateur/date, ni guillemets). */
  observationTexte(m: Notification): string {
    const t = m.corps ?? '';
    const open = t.indexOf('«');
    const close = t.lastIndexOf('»');
    if (open >= 0 && close > open) {
      return t.slice(open + 1, close).trim();
    }
    // Repli : retire le préfixe « … : » et l'instruction finale, sans guillemets.
    let s = t.trim();
    const colon = s.indexOf(' : ');
    if (colon >= 0) {
      s = s.slice(colon + 3);
    }
    const instr = s.indexOf('Veuillez rectifier');
    if (instr >= 0) {
      s = s.slice(0, instr);
    }
    return s.replace(/[«»]/g, '').trim() || (m.corps ?? '—');
  }
}
