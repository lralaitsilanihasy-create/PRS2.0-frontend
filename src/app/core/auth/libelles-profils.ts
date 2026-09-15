import { Role, TypeActeur } from '../../models';

/**
 * Libellés français des profils et des types d'acteur — fichier UNIQUE (recette du 2026-09-15 :
 * « CHEF_COMMISSION », « ASSISTANT_CONTROLEUR »… s'affichaient tels quels dans la pastille de
 * l'en-tête, la carte profil de la barre latérale et l'accueil). Le serveur ne sert que des codes ;
 * tout affichage passe par ici. Tables `Record` exhaustives : un nouveau code ne compile pas tant
 * qu'il n'a pas son libellé.
 */
export const LIBELLES_ROLES: Readonly<Record<Role, string>> = {
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

export const LIBELLES_TYPES_ACTEUR: Readonly<Record<TypeActeur, string>> = {
  CONTROLEUR: 'Contrôleur',
  PRMP: 'PRMP',
  UGPM: 'UGPM',
};

/** Libellé d'un profil ; vide sans profil. Un code inconnu (backend plus récent) reste lisible tel quel. */
export function libelleRole(role: Role | string | null | undefined): string {
  if (!role) return '';
  return LIBELLES_ROLES[role as Role] ?? role;
}

/** Libellé d'un type d'acteur ; vide sans type. */
export function libelleTypeActeur(type: TypeActeur | string | null | undefined): string {
  if (!type) return '';
  return LIBELLES_TYPES_ACTEUR[type as TypeActeur] ?? type;
}
