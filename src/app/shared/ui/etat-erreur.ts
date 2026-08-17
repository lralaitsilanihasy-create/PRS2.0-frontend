import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * État d'échec de chargement d'une liste, avec action de reprise.
 *
 * Sans lui, un appel en erreur laissait l'écran VIDE — indistinguable d'un « aucun résultat » :
 * le toast de l'intercepteur est éphémère et, une fois disparu, l'utilisateur n'a plus ni
 * explication ni moyen de relancer sans recharger la page (AUDIT.md P9).
 *
 * `role="alert"` : l'échec est annoncé immédiatement aux lecteurs d'écran.
 */
@Component({
  selector: 'app-etat-erreur',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="etat-erreur" role="alert">
      <span class="etat-erreur__icone" aria-hidden="true">⚠</span>
      <div class="etat-erreur__corps">
        <p class="etat-erreur__titre">{{ message() }}</p>
        <p class="etat-erreur__aide">Vérifiez votre connexion, puis réessayez.</p>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" (click)="reessayer.emit()">Réessayer</button>
    </div>
  `,
  styles: `
    .etat-erreur {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      padding: 1rem 1.15rem;
      background: var(--danger-bg, #fef2f2);
      border: 1px solid var(--danger-border, #fecaca);
      border-radius: var(--radius-lg, 12px);
      color: var(--danger-text, #b91c1c);
    }
    .etat-erreur__icone { font-size: 1.3rem; line-height: 1; }
    .etat-erreur__corps { flex: 1 1 auto; min-width: 0; }
    .etat-erreur__titre { margin: 0; font-weight: 700; }
    .etat-erreur__aide { margin: 0.15rem 0 0; font-size: var(--text-sm, 0.8rem); opacity: 0.85; }
  `,
})
export class EtatErreur {
  /** Message principal — décrire ce qui n'a pas pu être chargé. */
  readonly message = input('Le chargement a échoué.');
  readonly reessayer = output<void>();
}
