import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, Notification } from '../../models';
import { DossierService, NotificationService } from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossierModificationStore } from './dossier-modification.store';

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
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Dossiers à rectifier</h1>
        </div>
      </header>

      <div class="alert alert-info">
        Observations transmises par le vérificateur. Corrigez le dossier concerné, puis resoumettez-le.
      </div>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else if (cartes().length) {
        <div class="ar-list">
          @for (c of cartes(); track c.dossier.idDossier) {
            <div class="card ar-item">
              <div class="ar-item__head">
                <span class="ar-item__ref">Dossier {{ c.dossier.refeDossier || '#' + c.dossier.idDossier }}</span>
                <app-statut-badge [statut]="c.dossier.statut" [label]="'À rectifier'" />
                <button type="button" class="btn btn-outline btn-sm" (click)="modifierDossier(c)">
                  Modifier le dossier
                </button>
                <span class="ar-item__date">{{ c.latest?.dateEnvoi || '—' }}</span>
              </div>

              <div class="ar-hist">
                <h3 class="ar-hist__title">Observations du vérificateur</h3>
                <ul class="ar-obs">
                  @for (o of c.observations; track o.idNotification; let first = $first) {
                    <li class="ar-obs__item" [class.ar-obs__item--latest]="first">
                      <span class="ar-obs__meta">{{ o.dateEnvoi || '—' }} · {{ verificateurDe(o) }}</span>
                      <span class="ar-obs__text">{{ observationTexte(o) }}</span>
                    </li>
                  } @empty {
                    <li class="text-muted">Aucune observation enregistrée.</li>
                  }
                </ul>
              </div>

              <div class="form-group ar-form">
                <label class="form-label required">Motif de rectification</label>
                <textarea
                  class="form-control"
                  rows="2"
                  maxlength="255"
                  [value]="motif(cleDe(c))"
                  (input)="setMotif(cleDe(c), $any($event.target).value)"
                ></textarea>
                @if (errPour(cleDe(c))) { <span class="form-error">{{ errPour(cleDe(c)) }}</span> }
              </div>
              <div class="ar-item__foot">
                @if (!estModifie(c)) {
                  <span class="form-hint">Veuillez modifier le dossier avant de resoumettre.</span>
                }
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="saving() === cleDe(c) || !estModifie(c)"
                  (click)="demanderResoumission(c)"
                >
                  {{ saving() === cleDe(c) ? 'Resoumission…' : 'Resoumettre le dossier' }}
                </button>
              </div>
            </div>
          }
        </div>
      } @else {
        <p class="text-muted">Aucun dossier à rectifier.</p>
      }
    </section>

    @if (confirmCle() !== null) {
      <div class="modal-backdrop" (click)="annulerResoumission()">
        <div class="modal confirm-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="modal-header-plain">
            <span class="modal-title">Resoumettre au vérificateur ?</span>
            <button type="button" class="btn-close-plain" (click)="annulerResoumission()">✕</button>
          </div>
          <div class="modal-body">
            <p>Ce dossier sera renvoyé au vérificateur avec votre motif de rectification.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="annulerResoumission()">Annuler</button>
            <button type="button" class="btn btn-primary" (click)="confirmerResoumission()">
              Confirmer la resoumission
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .ar-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .ar-item { padding: 1rem 1.25rem; border-left: 4px solid var(--warning-text); }
    .ar-item__head { display: flex; align-items: center; gap: 0.6rem; }
    .ar-item__ref { font-weight: 700; color: var(--c-800); font-size: var(--text-sm); }
    .ar-item__date { margin-left: auto; color: var(--n-400); font-size: var(--text-xs); }
    .ar-hist { margin-top: 0.75rem; }
    .ar-hist__title { margin: 0 0 0.4rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-400); }
    .ar-obs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .ar-obs__item { display: flex; flex-direction: column; gap: 2px; padding: 0.25rem 0.5rem; border-left: 2px solid var(--c-100); }
    .ar-obs__item--latest { border-left-color: var(--c-500); font-weight: 600; }
    .ar-obs__meta { color: var(--n-400); font-size: var(--text-xs); }
    .ar-obs__text { font-size: var(--text-sm); }
    .ar-form { margin-top: 0.75rem; }
    .ar-item__foot { display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; }
    .confirm-modal { max-width: 28rem; }
  `,
})
export class DossiersARectifier {
  private readonly dossierService = inject(DossierService);
  private readonly notificationService = inject(NotificationService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly modifications = inject(DossierModificationStore);

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
    // Retour de l'édition du PPM : les dossiers ouverts en édition deviennent « modifiés ».
    this.modifications.consommerRetours();
    this.charger();
  }

  /** Le dossier de cette carte a-t-il été ouvert en édition puis re-visité ? (active « Resoumettre »). */
  estModifie(c: CarteRectif): boolean {
    return this.modifications.estModifie(c.dossier.idDossier);
  }

  /**
   * Clic « Modifier le dossier » : mémorise l'intention et navigue vers le **formulaire de rectification
   * restreint** du dossier concerné (`idDossier` de la carte), avec un `returnUrl` vers « Dossiers à rectifier ».
   */
  modifierDossier(c: CarteRectif): void {
    this.modifications.partirEnEdition(c.dossier.idDossier);
    this.router.navigate(['/prmp/rectifier', c.dossier.idDossier], {
      queryParams: { returnUrl: '/prmp/a-rectifier' },
    });
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
    if (!this.estModifie(c)) {
      this.errors.update((e) => ({ ...e, [cle]: 'Veuillez modifier le dossier avant de resoumettre.' }));
      return;
    }
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
        this.modifications.reinitialiser(idDossier);
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
