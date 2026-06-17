import { Injectable, inject } from '@angular/core';

import { Role } from '../../models';
import { AuthService } from './auth.service';
import { Capability, CAPABILITY_ROLES } from './permissions';

/**
 * Évalue les capacités fonctionnelles pour le profil courant.
 * Utilisé par les directives de sécurité UX (`*appCan`, `[appEditableIf]`, badge).
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly auth = inject(AuthService);

  /** Le profil courant peut-il tenter cette capacité ? (confort UX, non contraignant) */
  can(capability: Capability): boolean {
    return this.canForRole(capability, this.auth.role());
  }

  /** Variante explicite pour un rôle donné. */
  canForRole(capability: Capability, role: Role | null): boolean {
    return role !== null && CAPABILITY_ROLES[capability].includes(role);
  }
}
