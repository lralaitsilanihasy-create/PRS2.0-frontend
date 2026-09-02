import { Role } from '../../models';

/** Entrée de menu latéral. */
export interface NavItem {
  label: string;
  /** Chemin de route (implémenté progressivement aux étapes suivantes). */
  path: string;
  icon?: string;
  /** Sous-entrées affichées en retrait sous cette entrée (jusqu'à deux niveaux d'imbrication). */
  children?: NavItem[];
  /**
   * ⚠️ Délégation ascendante (spec 2026-08-14) — l'entrée n'est affichée que si le profil courant peut
   * exécuter les tâches de CE profil (titulaire, ou paire active de `t_delegation_profil`) : désactiver
   * la paire en base retire l'entrée du menu, zéro code. Absent = entrée toujours affichée.
   */
  delegation?: Role;
}

/**
 * Sépare un menu en deux blocs : les entrées du profil connecté, puis celles exercées PAR
 * DÉLÉGATION ascendante.
 *
 * ⚠️ Demande user (2026-08-28) : « ne pas mélanger ». Les entrées déléguées étaient déclarées au
 * fil du menu — chez le Président, « Vérifications » et « Archivage des PV » tombaient entre
 * « Examen de dossiers » et « Rapports ». Le badge ⤴ les signalait une par une, mais rien ne
 * distinguait d'un coup d'œil ce qui relève de sa fonction de ce qu'il exerce à la place d'un
 * subordonné.
 *
 * La séparation est faite ICI, sur la donnée, et non par l'ordre de déclaration du menu : ajouter
 * une entrée déléguée n'importe où dans `menuCommission` la place au bon endroit sans y penser.
 * Un bloc vide est omis — un profil sans délégation retrouve exactement son menu d'avant.
 */
export function separerParDelegation(items: NavItem[]): { cle: string; titre: string | null; items: NavItem[] }[] {
  return [
    { cle: 'propre', titre: null, items: items.filter((i) => !i.delegation) },
    { cle: 'delegation', titre: 'Exercé par délégation', items: items.filter((i) => !!i.delegation) },
  ].filter((s) => s.items.length > 0);
}

/**
 * Menu commun **Président / Chef de commission** (demande user 2026-08-04 : « les menus gauches de ces
 * deux profils doivent être les mêmes »). Les deux rôles conduisent la même commission, à un périmètre
 * près (national vs localité) que le **backend** scope déjà : les écrans sont identiques, seules les
 * données diffèrent. Source UNIQUE pour que les deux menus ne puissent plus diverger — les suffixes de
 * route sont volontairement identiques de part et d'autre, seule la base change (`/president` | `/cc`).
 *
 * Accès vérifié le 2026-08-04 avec PRES001 et CCANT01 : `/ppms`, `/marches`, `/marche-previsions`,
 * `/messages` et `/rapports/dossiers` répondent 200 pour les DEUX rôles (cf. `api-endpoints.md` —
 * rapports = PRESIDENT / ADMINISTRATEUR / CHEF_COMMISSION).
 */
function menuCommission(base: '/president' | '/cc'): NavItem[] {
  return [
    { label: 'Tableau de bord', path: `${base}/tableau-de-bord`, icon: '▤' },
    { label: 'Mes dossiers', path: `${base}/mes-dossiers`, icon: '📁' },
    // ⚠️ 2026-08-06 (demande user) — « Projets de PV », « PV définitifs » et « Lettres de renvoi »
    // sont regroupés dans un écran-hub à cartes : ce sont les trois productions d'un même examen.
    // Les trois écrans et leurs routes sont inchangés, seul le chemin d'accès l'est.
    { label: 'Examen de dossiers', path: `${base}/resultat-examen`, icon: '📑' },
    // ⚠️ Délégation ascendante (spec 2026-08-14) — tâches du Vérificateur et de l'Assistant exercées
    // par Président/CC : entrées affichées SEULEMENT si la paire est active en base (champ `delegation`).
    // Les tâches Secrétaire (réceptions) et Membre (Examiner) vivent dans « Mes dossiers » (groupes/actions
    // gardés par capacités, mêmes paires).
    { label: 'Vérifications', path: `${base}/verifications`, icon: '🔎', delegation: 'VERIFICATEUR' },
    { label: 'Archivage des PV', path: `${base}/pv-examens`, icon: '🗄', delegation: 'ASSISTANT_CONTROLEUR' },
    // ⚠️ Rattachements (2026-09-01) — chaînes Membre→Vérificateur→Assistant, administrées par
    // Admin + Président (partout) + CC (sa localité) : droit PROPRE du P/CC, pas une délégation.
    { label: 'Chaînes de contrôle', path: `${base}/chaines-controle`, icon: '⛓' },
    // « PPM & marchés » et « Marchés & dates prév. » : retirés du menu des DEUX profils
    // (demande user 2026-08-04). Routes conservées de part et d'autre — cf. president.routes.ts / cc.routes.ts.
    // ⚠️ 2026-08-07 (demande user) — « Demandes de retrait » quitte le menu : une demande porte sur un
    // dossier, donc sur un type, et figure désormais en ligne dans la carte de type correspondante de
    // « Mes dossiers » (config `retraitsPath`). Route conservée, atteinte avec `?type=`.
    { label: 'Rapports', path: `${base}/rapports`, icon: '📊' },
    { label: 'Statistiques', path: `${base}/statistiques`, icon: '📈' },
    { label: 'Messagerie', path: `${base}/messagerie`, icon: '✉' },
    // ⚠️ Spec notifications (2026-08-02) — écran transverse, chemin absolu commun à tous les profils.
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
  ];
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
    // « Mes dossiers » = page dédiée (cartes type → statut) ; l'arborescence s'affiche à l'écran.
    { label: 'Mes dossiers', path: '/prmp/dossiers', icon: '🗂' },
    // « Soumettre un dossier » : retiré du menu (demande user 2026-08-02) — la saisie s'ouvre par type
    // via la ligne « Créer » des cartes « Mes dossiers » (?famille=), route conservée.
    // « Créer compte UGPM » : déplacé dans le PIED de la barre latérale (à la place de la carte profil,
    // redondante avec la topbar) — cf. main-layout.html (demande user 2026-08-02).
    // « Dossiers à rectifier » / « Dossiers vérifiés » : retirés du menu (demande user 2026-08-02) —
    // accessibles par type via les cartes « Mes dossiers » (lignes À rectifier / Vérifiés), routes conservées.
    // ⚠️ 2026-08-12 (demande user) — « Mes lettres de renvoi » et « PV définitifs » regroupés dans le
    // hub « Examen de dossiers » (même modèle que Président/CC, variante PRMP à deux cartes).
    { label: 'Examen de dossiers', path: '/prmp/resultat-examen', icon: '📑' },
    { label: 'Demandes de retrait', path: '/prmp/retraits', icon: '↩' },
    { label: 'Calendrier', path: '/prmp/calendrier', icon: '📅' },
    // ⚠️ Spec notifications (2026-08-02) — écran transverse, présent dans TOUS les profils.
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
  ],
  // UGPM : agit sous sa PRMP de tutelle — saisit/édite des brouillons, ne soumet pas
  // (bouton masqué + backend 403). Sous-ensemble curé des écrans PRMP dont les endpoints
  // sont accessibles à l'UGPM. « Mes lettres de renvoi » retiré : GET /api/lettre-renvois/mes-lettres
  // est réservé PRMP (403). « Dossiers vérifiés » (GET /api/dossiers?statut=CLOTURE, scopé) est OK.
  UGPM: [
    { label: 'Saisir un dossier', path: '/prmp/soumettre-dossier', icon: '📨' },
    { label: 'Mes brouillons', path: '/prmp/mes-brouillons', icon: '🗒' },
    { label: 'Dossiers vérifiés', path: '/prmp/dossiers-verifies', icon: '✅' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
  ],
  // ⚠️ Président et Chef de commission partagent EXACTEMENT le même menu : ne pas éditer l'un des deux
  // isolément, modifier `menuCommission()` (source unique).
  PRESIDENT: menuCommission('/president'),
  CHEF_COMMISSION: menuCommission('/cc'),
  SECRETAIRE: [
    { label: 'Tableau de bord', path: '/secretaire/tableau-de-bord', icon: '▤' },
    { label: 'Mes dossiers', path: '/secretaire/mes-dossiers', icon: '📁' },
    { label: 'Messagerie', path: '/secretaire/messagerie', icon: '✉' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
  ],
  MEMBRE: [
    { label: 'Tableau de bord', path: '/membre/tableau-de-bord', icon: '▤' },
    { label: 'Mes dossiers', path: '/membre/mes-dossiers', icon: '📁' },
    { label: 'Projets de PV', path: '/membre/pv', icon: '📝' },
    { label: 'Projets de lettre de renvoi', path: '/membre/lettre-renvois', icon: '✉' },
    { label: 'PV définitifs', path: '/membre/pv-definitifs', icon: '✅' },
    { label: 'Messagerie', path: '/membre/messagerie', icon: '✉' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
  ],
  VERIFICATEUR: [
    { label: 'À vérifier', path: '/verificateur/a-verifier', icon: '✔' },
    // « En attente PRMP » : retiré du menu (demande user 2026-08-04) — sous-vue redondante. Ces dossiers
    // (EN_ATTENTE_DECISION_PRMP) figurent déjà dans « À vérifier », badgés « En attente PRMP » et en
    // lecture seule ; leur historique d'échanges s'affiche dans l'écran de vérification. Route conservée.
    { label: 'Vérifiés / clôturés', path: '/verificateur/verifies', icon: '🗂' },
    { label: 'Messagerie', path: '/verificateur/messagerie', icon: '✉' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
  ],
  ASSISTANT_CONTROLEUR: [
    { label: 'Tableau de bord', path: '/assistant/tableau-de-bord', icon: '▤' },
    { label: 'Lettres de renvoi reçues', path: '/assistant/lettre-renvois', icon: '✉' },
    { label: 'PV reçus', path: '/assistant/pv-examens', icon: '📄' },
    { label: 'Messagerie', path: '/assistant/messagerie', icon: '✉' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
  ],
  CHARGE_PUBLICATION: [
    { label: 'Publications', path: '/publication/publications', icon: '🌐' },
    { label: 'Documents publics', path: '/publication/documents', icon: '📎' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
  ],
  ADMINISTRATEUR: [
    { label: 'Tableau de bord global', path: '/admin/tableau-de-bord', icon: '▤' },
    { label: 'Inscriptions en attente', path: '/admin/inscriptions', icon: '📝' },
    { label: 'Rattachements en attente', path: '/admin/rattachements', icon: '🔗' },
    { label: 'Chaînes de contrôle', path: '/admin/chaines-controle', icon: '⛓' },
    { label: 'Délais standards', path: '/admin/delais-standards', icon: '⏱' },
    { label: 'Actualités', path: '/admin/actualites', icon: '📣' },
    { label: 'Référentiels', path: '/admin/referentiels', icon: '⚙' },
    { label: 'Comptes & hiérarchie', path: '/admin/comptes', icon: '👥' },
    { label: 'PPM & marchés', path: '/admin/ppm-marches', icon: '🗂' },
    { label: 'Marchés & dates prév.', path: '/admin/marches-previsions', icon: '📆' },
    { label: 'Journal d’audit', path: '/admin/audit', icon: '🛡' },
    { label: 'Sessions', path: '/admin/sessions', icon: '🔑' },
    { label: 'Rapports', path: '/admin/rapports', icon: '📊' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
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
