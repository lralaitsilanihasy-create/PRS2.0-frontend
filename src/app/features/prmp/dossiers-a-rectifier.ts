import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, Notification } from '../../models';
import { DossierService, NotificationService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/** Une carte « à rectifier » = un dossier EN_ATTENTE_DECISION_PRMP + l'historique de ses observations. */
interface CarteRectif {
  dossier: Dossier;
  /** Observations OBSERVATION_VERIFICATION du dossier, triées par date décroissante (plus récente d'abord). */
  observations: Notification[];
  /** Observation la plus récente (en-tête de carte + clé d'isolement du champ motif). */
  latest?: Notification;
}

/**
 * « Dossiers à rectifier » (PRMP) : **une seule carte par dossier** EN_ATTENTE_DECISION_PRMP, alimentée par
 * `GET /api/dossiers?statut=EN_ATTENTE_DECISION_PRMP`. Les observations du vérificateur (notifications
 * OBSERVATION_VERIFICATION du dossier) sont **regroupées** dans un historique trié décroissant, la plus
 * récente mise en évidence. La PRMP saisit un motif de rectification puis resoumet le dossier.
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
      } @else if (cartes().length) {
        <ul class="ar__list">
          @for (c of cartes(); track c.dossier.idDossier) {
            <li class="cnm-card ar__item">
              <div class="ar__item-head">
                <span class="ar__p--ref">Dossier {{ c.dossier.refeDossier || '#' + c.dossier.idDossier }}</span>
                <app-statut-badge [statut]="c.dossier.statut" [label]="'À rectifier'" />
                <span class="ar__date cnm-mono">{{ c.latest?.dateEnvoi || '—' }}</span>
              </div>

              <div class="ar__hist">
                <h3 class="ar__hist-title">Observations du vérificateur</h3>
                <ul class="ar__obs">
                  @for (o of c.observations; track o.idNotification; let first = $first) {
                    <li class="ar__obs-item" [class.ar__obs-item--latest]="first">
                      <span class="ar__obs-meta cnm-mono">{{ o.dateEnvoi || '—' }} · {{ verificateurDe(o) }}</span>
                      <span class="ar__obs-text">{{ observationTexte(o) }}</span>
                    </li>
                  } @empty {
                    <li class="cnm-muted">Aucune observation enregistrée.</li>
                  }
                </ul>
              </div>

              <p class="ar__p ar__p--action">Veuillez rectifier le dossier.</p>

              <div class="ar__form cnm-form">
                <label class="cnm-field">
                  <span class="cnm-field__label">Motif de rectification *</span>
                  <textarea
                    class="cnm-textarea"
                    rows="2"
                    maxlength="255"
                    [value]="motif(cleDe(c))"
                    (input)="setMotif(cleDe(c), $any($event.target).value)"
                  ></textarea>
                </label>
                @if (errPour(cleDe(c))) { <span class="cnm-field__hint">{{ errPour(cleDe(c)) }}</span> }
                <div class="ar__form-foot">
                  <button
                    type="button"
                    class="cnm-btn cnm-btn--primary cnm-btn--sm"
                    [disabled]="saving() === cleDe(c)"
                    (click)="demanderResoumission(c)"
                  >
                    {{ saving() === cleDe(c) ? 'Resoumission…' : 'Resoumettre le dossier' }}
                  </button>
                </div>
              </div>
            </li>
          }
        </ul>
      } @else {
        <p class="cnm-muted">Aucun dossier à rectifier.</p>
      }
    </section>

    @if (confirmCle() !== null) {
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
    .ar__p--ref { font-weight: var(--cnm-fw-semibold); font-size: var(--cnm-fs-sm); }
    .ar__p--action { color: var(--cnm-text-2); font-style: italic; }
    .ar__hist { margin-top: var(--cnm-space-2); }
    .ar__hist-title { margin: 0 0 var(--cnm-space-1); font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: 0.04em; color: var(--cnm-text-3); }
    .ar__obs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--cnm-space-1); }
    .ar__obs-item { display: flex; flex-direction: column; gap: 2px; padding: var(--cnm-space-1) var(--cnm-space-2); border-left: 2px solid var(--cnm-border); }
    .ar__obs-item--latest { border-left-color: var(--cnm-accent-fg); font-weight: var(--cnm-fw-semibold); }
    .ar__obs-meta { color: var(--cnm-text-3); font-size: var(--cnm-fs-micro); }
    .ar__obs-text { font-size: var(--cnm-fs-sm); }
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
  /** Une carte par dossier EN_ATTENTE_DECISION_PRMP (dédoublonné par dossier). */
  readonly cartes = signal<CarteRectif[]>([]);

  /** Saisie du motif par carte (clé = cleDe(c), unique par dossier). */
  readonly motifs = signal<Record<number, string>>({});
  /** Erreurs de resoumission par carte (clé = cleDe(c)). */
  readonly errors = signal<Record<number, string>>({});
  /** Clé de carte en cours de resoumission (désactive son bouton). */
  readonly saving = signal<number | null>(null);
  /** Clé de la carte dont la confirmation est ouverte (null = fermée). */
  readonly confirmCle = signal<number | null>(null);

  constructor() {
    this.charger();
  }

  private charger(): void {
    this.loading.set(true);
    forkJoin({
      dossiers: this.dossierService.list('EN_ATTENTE_DECISION_PRMP'),
      notifs: this.notificationService.mes(),
    }).subscribe({
      next: ({ dossiers, notifs }) => {
        // Regroupe les observations du vérificateur par dossier (idDossier, repli idObjet).
        const parDossier = new Map<number, Notification[]>();
        for (const n of notifs.filter((x) => x.typeNotif === 'OBSERVATION_VERIFICATION')) {
          const id = n.idDossier ?? n.idObjet;
          if (id == null) {
            continue;
          }
          const arr = parDossier.get(id);
          if (arr) {
            arr.push(n);
          } else {
            parDossier.set(id, [n]);
          }
        }
        // Tri des observations de chaque dossier par date décroissante (plus récente d'abord).
        for (const arr of parDossier.values()) {
          arr.sort((a, b) => (b.dateEnvoi ?? '').localeCompare(a.dateEnvoi ?? ''));
        }
        // Une carte par dossier EN_ATTENTE_DECISION_PRMP, avec son historique d'observations.
        const cartes: CarteRectif[] = dossiers
          .filter((d) => d.statut === 'EN_ATTENTE_DECISION_PRMP')
          .map((d) => {
            const observations = parDossier.get(d.idDossier) ?? [];
            return { dossier: d, observations, latest: observations[0] };
          })
          .sort((a, b) => (b.latest?.dateEnvoi ?? '').localeCompare(a.latest?.dateEnvoi ?? ''));
        this.cartes.set(cartes);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Clé d'isolement du champ motif d'une carte = id de la dernière notification, sinon id du dossier. */
  cleDe(c: CarteRectif): number {
    return c.latest?.idNotification ?? c.dossier.idDossier;
  }

  motif(cle: number): string {
    return this.motifs()[cle] ?? '';
  }
  setMotif(cle: number, v: string): void {
    this.motifs.update((m) => ({ ...m, [cle]: v }));
  }
  errPour(cle: number): string | undefined {
    return this.errors()[cle];
  }

  /** Vérifie le motif de CETTE carte puis ouvre la confirmation. */
  demanderResoumission(c: CarteRectif): void {
    const cle = this.cleDe(c);
    if (!this.motif(cle).trim()) {
      this.errors.update((e) => ({ ...e, [cle]: 'Veuillez décrire les corrections apportées.' }));
      return;
    }
    this.errors.update((e) => ({ ...e, [cle]: '' }));
    this.confirmCle.set(cle);
  }
  annulerResoumission(): void {
    this.confirmCle.set(null);
  }
  /** Resoumet le dossier de la carte confirmée avec SON propre motif (EN_ATTENTE_DECISION_PRMP → EN_VERIFICATION). */
  confirmerResoumission(): void {
    const cle = this.confirmCle();
    if (cle == null) {
      return;
    }
    const c = this.cartes().find((x) => this.cleDe(x) === cle);
    this.confirmCle.set(null);
    if (!c) {
      return;
    }
    const idDossier = c.dossier.idDossier;
    this.saving.set(cle);
    this.dossierService.resoumettre(idDossier, { motifRectification: this.motif(cle).trim() }).subscribe({
      next: () => {
        this.toast.success('Dossier resoumis au vérificateur.');
        this.saving.set(null);
        this.motifs.update((mm) => {
          const n = { ...mm };
          delete n[cle];
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
        this.errors.update((er) => ({ ...er, [cle]: msg }));
      },
    });
  }

  /** Matricule du vérificateur extrait du corps de la notification (« le vérificateur X a relevé… »). */
  verificateurDe(m: Notification): string {
    const match = /le vérificateur (\S+) a relevé/.exec(m.corps ?? '');
    return match ? match[1] : '—';
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
