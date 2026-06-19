import { Role } from '../../models';

/** Entrée de menu latéral. */
export interface NavItem {
  label: string;
  /** Chemin de route (implémenté progressivement aux étapes suivantes). */
  path: string;
  icon?: string;
  /** Sous-entrées affichées en retrait sous cette entrée (un seul niveau). */
  children?: NavItem[];
}

/**
 * Menu par profil, dérivé des modules de `regles-gestion.md`.
 *
 * C'est la table de référence de l'affichage conditionnel par rôle (§2 du plan) :
 * la barre latérale n'affiche que les entrées du profil connecté. Les chemins
 * seront activés au fil des étapes 8 à 13 ; d'ici là, ils renvoient à l'accueil.
 *
 * Rappel : masquer une entrée est un confort UX ; le backend reste l'autorité (403).
 */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  PRMP: [
    { label: 'Tableau de bord', path: '/prmp/tableau-de-bord', icon: '▤' },
    {
      label: 'Mes PPM',
      path: '/prmp/ppm',
      icon: '📄',
      children: [
        { label: 'Mes brouillons', path: '/prmp/mes-brouillons', icon: '🗒' },
        { label: 'Mes PPM & marchés', path: '/prmp/ppm-marches', icon: '🗂' },
      ],
    },
    { label: 'Soumettre un dossier', path: '/prmp/soumettre-dossier', icon: '📨' },
    { label: 'Demandes de retrait', path: '/prmp/retraits', icon: '↩' },
    { label: 'Calendrier', path: '/prmp/calendrier', icon: '📅' },
  ],
  PRESIDENT: [
    { label: 'Tableau de bord', path: '/president/tableau-de-bord', icon: '▤' },
    { label: 'Pré-dispatch', path: '/president/pre-dispatch', icon: '📤' },
    { label: 'Circuit & dispatch', path: '/president/circuit', icon: '🔀' },
    { label: 'Demandes de retrait', path: '/president/retraits', icon: '↩' },
    { label: 'PPM, marchés & dates', path: '/president/ppm-marches', icon: '🗂' },
    { label: 'Calendrier', path: '/president/calendrier', icon: '📅' },
    { label: 'Rapports', path: '/president/rapports', icon: '📊' },
    { label: 'Statistiques', path: '/president/statistiques', icon: '📈' },
  ],
  CHEF_COMMISSION: [
    { label: 'Tableau de bord', path: '/cc/tableau-de-bord', icon: '▤' },
    { label: 'Circuit de contrôle', path: '/cc/circuit', icon: '🔀' },
    { label: 'PPM & marchés', path: '/cc/ppm-marches', icon: '🗂' },
    { label: 'Marchés & dates prév.', path: '/cc/marches-previsions', icon: '📆' },
    { label: 'Demandes de retrait', path: '/cc/retraits', icon: '↩' },
    { label: 'Statistiques', path: '/cc/statistiques', icon: '📈' },
    { label: 'Messagerie', path: '/cc/messagerie', icon: '✉' },
  ],
  SECRETAIRE: [
    { label: 'Tableau de bord', path: '/secretaire/tableau-de-bord', icon: '▤' },
    { label: 'Réceptions', path: '/secretaire/receptions', icon: '📥' },
    { label: 'Enregistrement', path: '/secretaire/enregistrement', icon: '📚' },
    { label: 'Messagerie', path: '/secretaire/messagerie', icon: '✉' },
  ],
  MEMBRE: [
    { label: 'Tableau de bord', path: '/membre/tableau-de-bord', icon: '▤' },
    { label: 'Dossiers à examiner', path: '/membre/examens', icon: '🔍' },
    { label: 'Dossiers examinés', path: '/membre/examines', icon: '✅' },
    { label: "Détails d'examen", path: '/membre/examen-details', icon: '☑' },
    { label: 'Projets de PV', path: '/membre/pv', icon: '📝' },
    { label: 'Messagerie', path: '/membre/messagerie', icon: '✉' },
  ],
  VERIFICATEUR: [
    { label: 'À vérifier', path: '/verificateur/a-verifier', icon: '✔' },
    { label: 'En attente PRMP', path: '/verificateur/en-attente-prmp', icon: '⏳' },
    { label: 'Vérifiés / clôturés', path: '/verificateur/verifies', icon: '🗂' },
    { label: 'Messagerie', path: '/verificateur/messagerie', icon: '✉' },
  ],
  CHARGE_PUBLICATION: [
    { label: 'Publications', path: '/publication/publications', icon: '🌐' },
    { label: 'Documents publics', path: '/publication/documents', icon: '📎' },
    { label: 'Notifications', path: '/publication/notifications', icon: '🔔' },
  ],
  ADMINISTRATEUR: [
    { label: 'Tableau de bord global', path: '/admin/tableau-de-bord', icon: '▤' },
    { label: 'Référentiels', path: '/admin/referentiels', icon: '⚙' },
    { label: 'Comptes & hiérarchie', path: '/admin/comptes', icon: '👥' },
    { label: 'PPM & marchés', path: '/admin/ppm-marches', icon: '🗂' },
    { label: 'Marchés & dates prév.', path: '/admin/marches-previsions', icon: '📆' },
    { label: 'Journal d’audit', path: '/admin/audit', icon: '🛡' },
    { label: 'Sessions', path: '/admin/sessions', icon: '🔑' },
    { label: 'Rapports', path: '/admin/rapports', icon: '📊' },
  ],
};

/** Menu du profil donné (vide si rôle inconnu/null). */
export function navFor(role: Role | null): NavItem[] {
  return role ? NAV_BY_ROLE[role] : [];
}

/** Menu aplati (parents + enfants) du profil donné, pour les affichages sans hiérarchie (accueil). */
export function navFlat(role: Role | null): NavItem[] {
  return navFor(role).flatMap((item) => (item.children ? [item, ...item.children] : [item]));
}
