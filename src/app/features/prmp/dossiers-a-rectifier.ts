import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

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
            </li>
          }
        </ul>
      } @else {
        <p class="cnm-muted">Aucune observation à traiter.</p>
      }
    </section>
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
  `,
})
export class DossiersARectifier {
  private readonly dossierService = inject(DossierService);
  private readonly notificationService = inject(NotificationService);

  readonly loading = signal(true);
  readonly messages = signal<Notification[]>([]);
  private readonly dossierMap = signal<Map<number, Dossier>>(new Map());

  constructor() {
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
