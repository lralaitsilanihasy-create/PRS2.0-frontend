import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../models';

/**
 * Directive structurelle : n'affiche le contenu que si le profil courant figure
 * parmi les rôles fournis.
 *
 * Usage : `<button *appHasRole="['MEMBRE', 'PRESIDENT']">…</button>`
 * ou `<a *appHasRole="'ADMINISTRATEUR'">…</a>`.
 *
 * Réactif : suit le signal de rôle de l'AuthService.
 */
@Directive({ selector: '[appHasRole]' })
export class HasRoleDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly appHasRole = input.required<Role | Role[]>();

  private visible = false;

  constructor() {
    effect(() => {
      const value = this.appHasRole();
      const roles = Array.isArray(value) ? value : [value];
      this.render(this.auth.hasRole(...roles));
    });
  }

  private render(allowed: boolean): void {
    if (allowed && !this.visible) {
      this.vcr.createEmbeddedView(this.tpl);
      this.visible = true;
    } else if (!allowed && this.visible) {
      this.vcr.clear();
      this.visible = false;
    }
  }
}
