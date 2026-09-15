import { Role, TypeActeur } from '../../models';
import { LIBELLES_ROLES, LIBELLES_TYPES_ACTEUR, libelleRole, libelleTypeActeur } from './libelles-profils';

describe('Libellés des profils (recette du 2026-09-15)', () => {
  it('chaque rôle a son libellé français, jamais son code brut (sauf les sigles PRMP et UGPM)', () => {
    const attendus: Record<Role, string> = {
      PRESIDENT: 'Président',
      CHEF_COMMISSION: 'Chef de commission',
      SECRETAIRE: 'Secrétaire',
      MEMBRE: 'Membre',
      VERIFICATEUR: 'Contrôleur vérificateur',
      ASSISTANT_CONTROLEUR: 'Assistant contrôleur',
      CHARGE_PUBLICATION: 'Chargé de publication',
      ADMINISTRATEUR: 'Administrateur',
      PRMP: 'PRMP',
      UGPM: 'UGPM',
    };
    expect(LIBELLES_ROLES).toEqual(attendus);
    for (const [role, libelle] of Object.entries(LIBELLES_ROLES)) {
      expect(libelleRole(role)).toBe(libelle);
      expect(libelle).not.toContain('_');
    }
  });

  it("types d'acteur : Contrôleur / PRMP / UGPM", () => {
    const attendus: Record<TypeActeur, string> = { CONTROLEUR: 'Contrôleur', PRMP: 'PRMP', UGPM: 'UGPM' };
    expect(LIBELLES_TYPES_ACTEUR).toEqual(attendus);
    expect(libelleTypeActeur('CONTROLEUR')).toBe('Contrôleur');
  });

  it('sans profil : rien ; code inconnu : lisible tel quel', () => {
    expect(libelleRole(null)).toBe('');
    expect(libelleTypeActeur(undefined)).toBe('');
    expect(libelleRole('NOUVEAU_PROFIL')).toBe('NOUVEAU_PROFIL');
  });
});
