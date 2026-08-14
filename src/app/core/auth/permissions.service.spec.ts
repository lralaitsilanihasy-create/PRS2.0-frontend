import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DelegationProfil, Profile, Role } from '../../models';
import { DelegationProfilService, ProfileService } from '../../services';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';

/** Référentiel des profils du décor (libellés réels → mapping par motif). */
const PROFILS: Profile[] = [
  { idProfile: 1, profile: 'Président' },
  { idProfile: 2, profile: 'Secrétaire' },
  { idProfile: 3, profile: 'Chef de commission' },
  { idProfile: 4, profile: 'Membre' },
  { idProfile: 5, profile: 'Contrôleur vérificateur' },
  { idProfile: 6, profile: 'Assistant contrôleur' },
  { idProfile: 7, profile: 'PRMP' },
  { idProfile: 8, profile: 'Administrateur' },
  { idProfile: 9, profile: 'Chargé de publication' },
];

/** Les 9 paires OFFICIELLES (delegant → delegue), actives. */
const PAIRES_OFFICIELLES: DelegationProfil[] = [
  { idDelegation: 1, idProfileDelegant: 1, idProfileDelegue: 2, actif: true }, // Président → Secrétaire
  { idDelegation: 2, idProfileDelegant: 1, idProfileDelegue: 3, actif: true }, // Président → CC
  { idDelegation: 3, idProfileDelegant: 1, idProfileDelegue: 4, actif: true }, // Président → Membre
  { idDelegation: 4, idProfileDelegant: 1, idProfileDelegue: 5, actif: true }, // Président → Vérificateur
  { idDelegation: 5, idProfileDelegant: 1, idProfileDelegue: 6, actif: true }, // Président → Assistant
  { idDelegation: 6, idProfileDelegant: 3, idProfileDelegue: 2, actif: true }, // CC → Secrétaire (⚠️ exception)
  { idDelegation: 7, idProfileDelegant: 3, idProfileDelegue: 4, actif: true }, // CC → Membre
  { idDelegation: 8, idProfileDelegant: 3, idProfileDelegue: 5, actif: true }, // CC → Vérificateur
  { idDelegation: 9, idProfileDelegant: 3, idProfileDelegue: 6, actif: true }, // CC → Assistant
];

/** Stub complet : AuthService (rôle) + référentiels délégations/profils (réponses synchrones). */
function configure(role: Role | null, delegations: DelegationProfil[] = PAIRES_OFFICIELLES): PermissionsService {
  const roleSignal = signal<Role | null>(role);
  TestBed.configureTestingModule({
    providers: [
      PermissionsService,
      { provide: AuthService, useValue: { role: roleSignal } },
      { provide: DelegationProfilService, useValue: { list: () => of(delegations) } },
      { provide: ProfileService, useValue: { list: () => of(PROFILS) } },
    ],
  });
  return TestBed.inject(PermissionsService);
}

describe('PermissionsService', () => {
  describe('canForRole (titulaires)', () => {
    it('autorise un rôle titulaire de la capacité', () => {
      const perms = configure(null);
      expect(perms.canForRole('REFERENTIEL_WRITE', 'ADMINISTRATEUR')).toBe(true);
      expect(perms.canForRole('RECEPTION_WRITE', 'SECRETAIRE')).toBe(true);
      expect(perms.canForRole('EXAMEN_WRITE', 'MEMBRE')).toBe(true);
      expect(perms.canForRole('VERIFICATION_WRITE', 'VERIFICATEUR')).toBe(true);
      expect(perms.canForRole('PV_RETOURNER', 'CHEF_COMMISSION')).toBe(true);
    });

    it('refuse un rôle ni titulaire ni délégant', () => {
      const perms = configure(null);
      expect(perms.canForRole('REFERENTIEL_WRITE', 'MEMBRE')).toBe(false);
      expect(perms.canForRole('DEMANDE_RETRAIT_DECISION', 'MEMBRE')).toBe(false);
    });

    it('refuse toujours quand le rôle est null', () => {
      const perms = configure(null);
      expect(perms.canForRole('KPIS_VIEW', null)).toBe(false);
    });
  });

  describe('délégation ascendante (table explicite, spec 2026-08-14)', () => {
    it('le Président exécute les tâches de ses 5 subordonnés (paires listées)', () => {
      const perms = configure('PRESIDENT');
      expect(perms.peutExecuter('SECRETAIRE')).toBe(true);
      expect(perms.peutExecuter('CHEF_COMMISSION')).toBe(true);
      expect(perms.peutExecuter('MEMBRE')).toBe(true);
      expect(perms.peutExecuter('VERIFICATEUR')).toBe(true);
      expect(perms.peutExecuter('ASSISTANT_CONTROLEUR')).toBe(true);
      // Reflet capacités : réception (Secrétaire), examen (Membre), vérification (Vérificateur).
      expect(perms.can('RECEPTION_WRITE')).toBe(true);
      expect(perms.can('EXAMEN_WRITE')).toBe(true);
      expect(perms.can('VERIFICATION_WRITE')).toBe(true);
      expect(perms.can('PV_ACCEPTER')).toBe(true); // titulaire CC, obtenu via Président → CC
    });

    // ⚠️ ANTI-RÉGRESSION — LE cas qu'un modèle « rang ≥ rang requis » casserait : le Chef de
    // commission est SOUS le Secrétaire dans la hiérarchie (Président > Secrétaire > CC > …)
    // mais hérite quand même de ses droits, parce que la paire CC → Secrétaire est LISTÉE.
    it('le Chef de commission exécute les tâches du Secrétaire (exception au rang)', () => {
      const perms = configure('CHEF_COMMISSION');
      expect(perms.peutExecuter('SECRETAIRE')).toBe(true);
      expect(perms.can('RECEPTION_WRITE')).toBe(true);
    });

    it('le Chef de commission exécute les tâches de Membre, Vérificateur et Assistant', () => {
      const perms = configure('CHEF_COMMISSION');
      expect(perms.peutExecuter('MEMBRE')).toBe(true);
      expect(perms.peutExecuter('VERIFICATEUR')).toBe(true);
      expect(perms.peutExecuter('ASSISTANT_CONTROLEUR')).toBe(true);
      expect(perms.can('EXAMEN_WRITE')).toBe(true);
      expect(perms.can('VERIFICATION_WRITE')).toBe(true);
    });

    it('chaque profil exécute ses propres tâches (identité, sans paire)', () => {
      expect(configure('SECRETAIRE').peutExecuter('SECRETAIRE')).toBe(true);
      TestBed.resetTestingModule();
      expect(configure('MEMBRE').peutExecuter('MEMBRE')).toBe(true);
      TestBed.resetTestingModule();
      expect(configure('ASSISTANT_CONTROLEUR').peutExecuter('ASSISTANT_CONTROLEUR')).toBe(true);
    });

    it('cas négatifs : aucun autre profil ne délègue (aucune paire hors table)', () => {
      // La délégation est ASCENDANTE et EXPLICITE : ni descente, ni transversal, ni hors hiérarchie.
      expect(configure('SECRETAIRE').peutExecuter('MEMBRE')).toBe(false);
      TestBed.resetTestingModule();
      expect(configure('MEMBRE').peutExecuter('SECRETAIRE')).toBe(false);
      TestBed.resetTestingModule();
      expect(configure('MEMBRE').peutExecuter('ASSISTANT_CONTROLEUR')).toBe(false);
      TestBed.resetTestingModule();
      expect(configure('VERIFICATEUR').peutExecuter('MEMBRE')).toBe(false);
      TestBed.resetTestingModule();
      expect(configure('ASSISTANT_CONTROLEUR').peutExecuter('VERIFICATEUR')).toBe(false);
      TestBed.resetTestingModule();
      expect(configure('PRMP').peutExecuter('SECRETAIRE')).toBe(false);
      TestBed.resetTestingModule();
      expect(configure('CHARGE_PUBLICATION').peutExecuter('ASSISTANT_CONTROLEUR')).toBe(false);
      TestBed.resetTestingModule();
      // L'Administrateur n'est pas dans la hiérarchie : pas de délégation — ses accès natifs restent.
      const admin = configure('ADMINISTRATEUR');
      expect(admin.peutExecuter('SECRETAIRE')).toBe(false);
      expect(admin.can('REFERENTIEL_WRITE')).toBe(true);
    });

    it('PILOTÉ PAR LES DONNÉES : désactiver une paire retire le droit, zéro changement de code', () => {
      // Décor = l'état live constaté : CC → Membre existe mais actif=false.
      const delegations = PAIRES_OFFICIELLES.map((d) =>
        d.idDelegation === 7 ? { ...d, actif: false } : d,
      );
      const perms = configure('CHEF_COMMISSION', delegations);
      expect(perms.peutExecuter('MEMBRE')).toBe(false);
      expect(perms.can('EXAMEN_WRITE')).toBe(false);
      // Les autres paires du CC restent effectives.
      expect(perms.peutExecuter('SECRETAIRE')).toBe(true);
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
