import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Role } from '../../models';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';

/** Stub minimal d'AuthService : seul `role` est utilisé par PermissionsService. */
function configure(role: Role | null): PermissionsService {
  const roleSignal = signal<Role | null>(role);
  TestBed.configureTestingModule({
    providers: [
      PermissionsService,
      { provide: AuthService, useValue: { role: roleSignal } },
    ],
  });
  return TestBed.inject(PermissionsService);
}

describe('PermissionsService', () => {
  describe('canForRole (logique pure)', () => {
    it('autorise un rôle présent dans la whitelist de la capacité', () => {
      const perms = configure(null);
      expect(perms.canForRole('REFERENTIEL_WRITE', 'ADMINISTRATEUR')).toBe(true);
      expect(perms.canForRole('PV_RETOURNER', 'CHEF_COMMISSION')).toBe(true);
      expect(perms.canForRole('PV_RETOURNER', 'PRESIDENT')).toBe(true);
      // Décision de retrait : CC ou Président (cf. règle backend).
      expect(perms.canForRole('DEMANDE_RETRAIT_DECISION', 'PRESIDENT')).toBe(true);
    });

    it('refuse un rôle absent de la whitelist', () => {
      const perms = configure(null);
      expect(perms.canForRole('REFERENTIEL_WRITE', 'MEMBRE')).toBe(false);
      expect(perms.canForRole('PV_RETOURNER', 'MEMBRE')).toBe(false);
      expect(perms.canForRole('DEMANDE_RETRAIT_DECISION', 'MEMBRE')).toBe(false);
    });

    it('refuse toujours quand le rôle est null', () => {
      const perms = configure(null);
      expect(perms.canForRole('KPIS_VIEW', null)).toBe(false);
    });
  });

  describe('can (rôle courant)', () => {
    it('reflète le rôle de l’utilisateur connecté', () => {
      const perms = configure('VERIFICATEUR');
      expect(perms.can('VERIFICATION_WRITE')).toBe(true);
      expect(perms.can('PV_SOUMETTRE')).toBe(false);
    });

    it('le PRMP peut créer un retrait mais pas le décider', () => {
      const perms = configure('PRMP');
      expect(perms.can('DEMANDE_RETRAIT_CREATE')).toBe(true);
      expect(perms.can('DEMANDE_RETRAIT_DECISION')).toBe(false);
    });
  });
});
