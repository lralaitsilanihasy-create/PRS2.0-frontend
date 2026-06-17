import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';

import { PermissionsService } from '../../core/auth/permissions.service';
import { Capability } from '../../core/auth/permissions';

/**
 * Directive structurelle : n'affiche le contenu que si le profil courant possède
 * la capacité fonctionnelle donnée (cf. table CAPABILITY_ROLES).
 *
 * Préférer cette directive à `*appHasRole` pour les actions métier — elle est
 * sémantique (l'action, pas la liste de rôles) et reste cohérente avec la table.
 *
 * Usage : `<button *appCan="'PV_RETOURNER'" (click)="retourner()">Retourner</button>`.
 */
@Directive({ selector: '[appCan]' })
export class CanDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionsService);

  readonly appCan = input.required<Capability>();

  private visible = false;

  constructor() {
    effect(() => {
      this.render(this.permissions.can(this.appCan()));
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
