import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Page affichée quand le profil courant n'est pas autorisé pour une route (roleGuard). */
@Component({
  selector: 'app-access-denied',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="access-denied">
      <h1>Accès refusé</h1>
      <p>Votre profil ne vous autorise pas à accéder à cette page.</p>
      <a routerLink="/">Retour à l'accueil</a>
    </section>
  `,
  styles: `
    .access-denied {
      max-width: 28rem;
      margin: 4rem auto;
      text-align: center;
      color: var(--cnm-text-2);
    }
    h1 {
      color: var(--cnm-danger-fg);
    }
  `,
})
export class AccessDenied {}
