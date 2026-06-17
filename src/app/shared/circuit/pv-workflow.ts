import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import { PvExamen } from '../../models';
import { PvExamenService } from '../../services';
import { CanDirective } from '../security/can.directive';
import { StatutBadge } from './statut-badge';
import {
  PV_STATUT_LABELS,
  peutAccepter,
  peutRetourner,
  peutSigner,
  peutSoumettre,
  pvSignataireRole,
} from './circuit-workflow';

/**
 * Actions de workflow d'un PV d'examen (soumettre / retourner / accepter / signer),
 * reflétant la machine d'états du §3. Chaque action est proposée seulement si :
 *  - le statut courant l'autorise (état), ET
 *  - le profil possède la capacité correspondante (`*appCan`).
 *
 * Le composant exécute l'action puis émet le PV mis à jour via `(changed)`.
 * Le backend valide réellement la transition (409 en cas d'enchaînement interdit).
 */
@Component({
  selector: 'app-pv-workflow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CanDirective, StatutBadge],
  template: `
    <div class="pv-workflow">
      <div class="pv-workflow__state">
        <span class="pv-workflow__label">Statut du PV :</span>
        <app-statut-badge [statut]="pv().statutPv" [label]="statutLabel()" />
      </div>

      <div class="pv-workflow__actions">
        @if (canSoumettre()) {
          <button *appCan="'PV_SOUMETTRE'" type="button" class="cnm-btn cnm-btn--primary" (click)="onSoumettre()">
            Soumettre le projet
          </button>
        }
        @if (canAccepter()) {
          <button *appCan="'PV_ACCEPTER'" type="button" class="cnm-btn cnm-btn--success" (click)="accepter()">
            Accepter le projet
          </button>
        }
        @if (canRetourner()) {
          <button *appCan="'PV_RETOURNER'" type="button" class="cnm-btn cnm-btn--warning" (click)="toggleRetour()">
            Retourner pour rectification
          </button>
        }
        @if (canSigner()) {
          <button *appCan="'PV_SIGNER'" type="button" class="cnm-btn cnm-btn--primary" (click)="signer()">
            Signer
          </button>
        }
      </div>

      @if (soumettreOuvert()) {
        <div class="pv-workflow__retour pv-workflow__retour--reponse">
          <label class="pv-workflow__retour-label" for="pv-soum-comment">
            Réponse au retour (commentaire, optionnel)
          </label>
          <textarea id="pv-soum-comment" class="cnm-textarea" #soum rows="3"></textarea>
          <div class="pv-workflow__retour-actions">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="toggleSoumettre()">Annuler</button>
            <button type="button" class="cnm-btn cnm-btn--primary" (click)="confirmerSoumission(soum.value)">
              Confirmer la soumission
            </button>
          </div>
        </div>
      }

      @if (retourOuvert()) {
        <div class="pv-workflow__retour">
          <label class="pv-workflow__retour-label" for="pv-retour-comment">
            Commentaire de rectification (obligatoire)
          </label>
          <textarea id="pv-retour-comment" class="cnm-textarea" #commentaire rows="3"></textarea>
          <div class="pv-workflow__retour-actions">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="toggleRetour()">Annuler</button>
            <button type="button" class="cnm-btn cnm-btn--warning" (click)="retourner(commentaire.value)">
              Confirmer le retour
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .pv-workflow {
      display: flex;
      flex-direction: column;
      gap: var(--cnm-space-3);
    }
    .pv-workflow__state {
      display: flex;
      align-items: center;
      gap: var(--cnm-space-2);
    }
    .pv-workflow__label {
      font-size: var(--cnm-fs-sm);
      color: var(--cnm-text-2);
      font-weight: var(--cnm-fw-semibold);
    }
    .pv-workflow__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--cnm-space-2);
    }
    .pv-workflow__retour {
      display: flex;
      flex-direction: column;
      gap: var(--cnm-space-1);
      background: var(--cnm-warning-bg);
      border: 1px solid rgba(246, 168, 50, 0.35);
      border-radius: var(--cnm-radius);
      padding: var(--cnm-space-3);
    }
    .pv-workflow__retour-label {
      font-size: var(--cnm-fs-sm);
      font-weight: var(--cnm-fw-semibold);
      color: var(--cnm-warning-fg);
    }
    .pv-workflow__retour--reponse {
      background: var(--cnm-surface-2);
      border-color: var(--cnm-border);
    }
    .pv-workflow__retour--reponse .pv-workflow__retour-label {
      color: var(--cnm-text-2);
    }
    .pv-workflow__retour .cnm-textarea {
      resize: vertical;
    }
    .pv-workflow__retour-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--cnm-space-2);
    }
  `,
})
export class PvWorkflow {
  private readonly pvService = inject(PvExamenService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** PV courant. */
  readonly pv = input.required<PvExamen>();
  /** Émis après une transition réussie, avec le PV mis à jour. */
  readonly changed = output<PvExamen>();

  readonly retourOuvert = signal(false);
  readonly soumettreOuvert = signal(false);

  readonly statutLabel = computed(() => PV_STATUT_LABELS[this.pv().statutPv]);
  readonly canSoumettre = computed(() => peutSoumettre(this.pv().statutPv));
  readonly canRetourner = computed(() => peutRetourner(this.pv().statutPv));
  readonly canAccepter = computed(() => peutAccepter(this.pv().statutPv));
  readonly canSigner = computed(() => peutSigner(this.pv().statutPv));

  toggleRetour(): void {
    this.retourOuvert.update((v) => !v);
  }
  toggleSoumettre(): void {
    this.soumettreOuvert.update((v) => !v);
  }

  /** Re-soumission après rectification → boîte de réponse ; 1ʳᵉ soumission → direct. */
  onSoumettre(): void {
    if (this.pv().statutPv === 'EN_RECTIFICATION') {
      this.toggleSoumettre();
    } else {
      this.soumettre();
    }
  }

  soumettre(): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    this.pvService.soumettre(this.pv().idPv, { imActeur: acteur }).subscribe({
      next: (pv) => this.onSuccess(pv, 'Projet soumis.'),
    });
  }

  /** Re-soumission avec une réponse (commentaire) au retour de rectification. */
  confirmerSoumission(commentaire: string): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    this.pvService
      .soumettre(this.pv().idPv, { imActeur: acteur, commentaire: commentaire.trim() || undefined })
      .subscribe({
        next: (pv) => {
          this.soumettreOuvert.set(false);
          this.onSuccess(pv, 'Projet re-soumis.');
        },
      });
  }

  accepter(): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    this.pvService.accepter(this.pv().idPv, { imActeur: acteur }).subscribe({
      next: (pv) => this.onSuccess(pv, 'Projet accepté.'),
    });
  }

  retourner(commentaire: string): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    if (!commentaire.trim()) {
      this.toast.error('Le commentaire de rectification est obligatoire.');
      return;
    }
    this.pvService
      .retourner(this.pv().idPv, { imActeur: acteur, commentaire: commentaire.trim() })
      .subscribe({
        next: (pv) => {
          this.retourOuvert.set(false);
          this.onSuccess(pv, 'Projet retourné pour rectification.');
        },
      });
  }

  signer(): void {
    const acteur = this.acteur();
    if (!acteur) {
      return;
    }
    const role = pvSignataireRole(this.auth.role());
    if (!role) {
      this.toast.error("Votre profil n'est pas signataire du PV.");
      return;
    }
    this.pvService.signer(this.pv().idPv, { imActeur: acteur, role }).subscribe({
      next: (pv) => this.onSuccess(pv, 'PV signé.'),
    });
  }

  private acteur(): string | null {
    const ref = this.auth.ref();
    if (!ref) {
      this.toast.error('Acteur courant introuvable.');
    }
    return ref;
  }

  private onSuccess(pv: PvExamen, message: string): void {
    this.toast.success(message);
    this.changed.emit(pv);
  }
}
