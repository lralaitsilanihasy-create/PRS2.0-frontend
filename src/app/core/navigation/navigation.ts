import { Role } from '../../models';
import { NomIcone } from '../../shared/ui/icone';

/** Entrée de menu latéral. */
export interface NavItem {
  label: string;
  /** Chemin de route (implémenté progressivement aux étapes suivantes). */
  path: string;
  /** Paramètres de requête du lien (ex. `{ maj: 1 }`) — bindés en `[queryParams]` dans la barre latérale. */
  queryParams?: Record<string, string | number>;
  /**
   * Icône SVG du menu et des cartes de l'accueil (`shared/ui/icone.ts`). ⚠️ 2026-09-15 (refonte, lot 5) :
   * plus d'emoji — leur rendu variait d'un poste à l'autre et jurait avec le reste de l'interface.
   */
  icon?: NomIcone;
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
 * Refonte ergonomique (2026-09-15) — profils servis par l'accueil « À faire »
 * (`GET /api/dossiers/a-faire`, demande 2026-09-14-accueil-a-faire) → préfixe de leur espace, où l'écran
 * est monté (`/<espace>/a-faire`). L'UGPM agit dans l'espace de sa PRMP. Administrateur et Chargé de
 * publication gardent leur accueil (403 serveur).
 */
export const ESPACES_A_FAIRE: Readonly<Partial<Record<Role, string>>> = {
  PRESIDENT: 'president',
  CHEF_COMMISSION: 'cc',
  SECRETAIRE: 'secretaire',
  MEMBRE: 'membre',
  VERIFICATEUR: 'verificateur',
  ASSISTANT_CONTROLEUR: 'assistant',
  PRMP: 'prmp',
  UGPM: 'prmp',
};

/** Chemin de l'accueil « À faire » du profil, `null` s'il n'en a pas. */
export function cheminAFaire(role: Role | null): string | null {
  const espace = role ? ESPACES_A_FAIRE[role] : undefined;
  return espace ? `/${espace}/a-faire` : null;
}

/** Entrée « À faire », en tête du menu des profils concernés (pastille : `badges.aFaire`). */
function entreeAFaire(espace: string): NavItem {
  return { label: 'À faire', path: `/${espace}/a-faire`, icon: 'inbox' };
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
    entreeAFaire(base.slice(1)),
    // ⚠️ Demande pilote (2026-09-12) — « Tableau de bord » renommé « Tous les dossiers » (le pipeline
    // liste les dossiers du périmètre) ; route inchangée. S'applique à Président ET CC (menu partagé).
    { label: 'Tous les dossiers', path: `${base}/tableau-de-bord`, icon: 'folder' },
    // ⚠️ Demande pilote (2026-09-12) — « Mes dossiers » RETIRÉ (P/CC) : « Tous les dossiers » porte
    // désormais toute action par dossier dans sa colonne Actions (dispatch, examen — délégation Membre
    // comprise) ; le classement par type et les compteurs faisaient double emploi.
    // ⚠️ Demande pilote (2026-09-12) — la section « Dispatchs par contrôleur » quitte « Mes dossiers »
    // pour sa propre entrée de menu « Répartition de dispatch » (écran dédié, composant autonome).
    { label: 'Répartition de dispatch', path: `${base}/repartition-dispatch`, icon: 'board' },
    // ⚠️ 2026-08-06 (demande user) — « Projets de PV », « PV définitifs » et « Lettres de renvoi »
    // sont regroupés dans un écran-hub à cartes : ce sont les trois productions d'un même examen.
    // Les trois écrans et leurs routes sont inchangés, seul le chemin d'accès l'est.
    { label: 'Examen de dossiers', path: `${base}/resultat-examen`, icon: 'file' },
    // ⚠️ Demande pilote (2026-09-12) — « Demandes de retrait » REMISE au menu latéral (elle reste aussi
    // en ligne dans les cartes de « Mes dossiers » via `retraitsPath`). Sans `?type=`, l'écran liste TOUS
    // les types (bandeau « Voir tous les types »).
    { label: 'Demandes de retrait', path: `${base}/retraits`, icon: 'undo' },
    // ⚠️ Délégation ascendante (spec 2026-08-14) — tâches du Vérificateur et de l'Assistant exercées
    // par Président/CC : entrées affichées SEULEMENT si la paire est active en base (champ `delegation`).
    // Les tâches Secrétaire (Attribuer un numéro) et Membre (Examiner) vivent dans « Tous les dossiers »
    // (actions inline gardées par capacités, mêmes paires).
    // ⚠️ Demande pilote (2026-09-12) — « Réception & Enregistrement » RETIRÉ du menu délégué : son unique
    // action (« Attribuer un numéro ») est désormais inline dans « Tous les dossiers ». Restent les deux
    // délégations sans équivalent inline complet : Vérifications (PV joint, avis, ciblage) et Archivage
    // des PV (liste de PV, action de clôture).
    { label: 'Vérifications', path: `${base}/verifications`, icon: 'shield', delegation: 'VERIFICATEUR' },
    { label: 'Archivage des PV', path: `${base}/pv-examens`, icon: 'archive', delegation: 'ASSISTANT_CONTROLEUR' },
    // ⚠️ Rattachements (2026-09-01) — chaînes Membre→Vérificateur→Assistant, administrées par
    // Admin + Président (partout) + CC (sa localité) : droit PROPRE du P/CC, pas une délégation.
    { label: 'Chaînes de contrôle', path: `${base}/chaines-controle`, icon: 'layers' },
    // « PPM & marchés » et « Marchés & dates prév. » : retirés du menu des DEUX profils
    // (demande user 2026-08-04). Routes conservées de part et d'autre — cf. president.routes.ts / cc.routes.ts.
    // ⚠️ 2026-08-07 « Demandes de retrait » avait quitté le menu (accès en ligne dans les cartes de
    // « Mes dossiers » via `retraitsPath`, `?type=`) — REMISE au menu le 2026-09-12 (demande pilote,
    // entrée ajoutée plus haut) ; les deux accès coexistent.
    // ⚠️ Demande pilote (2026-09-04) — « Rapports », « Statistiques » et « Messagerie » retirés du
    // menu POUR LE MOMENT (routes et écrans conservés) : ré-activer en décommentant.
    // { label: 'Rapports', path: `${base}/rapports`, icon: 'board' },
    // { label: 'Statistiques', path: `${base}/statistiques`, icon: 'board' },
    // { label: 'Messagerie', path: `${base}/messagerie`, icon: 'message' },
    // ⚠️ Spec notifications (2026-08-02) — écran transverse, chemin absolu commun à tous les profils.
    { label: 'Notifications', path: '/notifications', icon: 'bell' },
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
    entreeAFaire('prmp'),
    // ⚠️ Demande pilote (2026-09-06) — l'entrée du tableau de bord devient le suivi des délais.
    { label: 'Suivi des dossiers CNM', path: '/prmp/tableau-de-bord', icon: 'clock' },
    // ⚠️ Demande pilote (2026-09-13) — « Mes dossiers » (cartes type × statut) RETIRÉ du menu : « Suivi
    // des dossiers CNM » liste désormais TOUS les dossiers (brouillons, à-rectifier compris) avec colonne
    // Type et actions inline (Soumettre / Rectifier). La route `/prmp/dossiers` reste montée (elle sert
    // encore la notif « compléter les pièces » et la recherche de dossier de la topbar), mais n'est plus
    // au menu ni à l'atterrissage.
    // ⚠️ Demande pilote (2026-09-13) — REMIS au menu (ils vivaient dans les cartes de « Mes dossiers ») :
    // la saisie d'un dossier et la mise à jour d'un PPM (liste des vérifiés en mode `?maj=1`). « Soumettre
    // un dossier » avait été retiré le 2026-08-02 ; le pilote le réintroduit comme raccourci d'entrée.
    { label: 'Créer dossier', path: '/prmp/soumettre-dossier', icon: 'plus' },
    // ⚠️ Route AUTONOME `dossiers-verifies` (pas l'enfant `dossiers/verifies` qui s'affiche SOUS les
    // cartes de « Mes dossiers ») : l'écran ne montre QUE le tableau des vérifiés en mode mise à jour.
    { label: 'Mettre à jour un PPM', path: '/prmp/dossiers-verifies', queryParams: { maj: 1 }, icon: 'edit' },
    // « Créer compte UGPM » : déplacé dans le PIED de la barre latérale (à la place de la carte profil,
    // redondante avec la topbar) — cf. main-layout.html (demande user 2026-08-02).
    // « Dossiers à rectifier » / « Dossiers vérifiés » : retirés du menu (demande user 2026-08-02) —
    // accessibles par type via les cartes « Mes dossiers » (lignes À rectifier / Vérifiés), routes conservées.
    // ⚠️ 2026-08-12 (demande user) — « Mes lettres de renvoi » et « PV définitifs » regroupés dans un
    // hub à deux cartes (même composant que Président/CC). ⚠️ 2026-09-13 (demande pilote) — renommé
    // « PV et lettres de renvoi » côté PRMP (le hub P/CC garde « Examen de dossiers », il a les projets de PV).
    { label: 'PV et lettres de renvoi', path: '/prmp/resultat-examen', icon: 'file' },
    { label: 'Demandes de retrait', path: '/prmp/retraits', icon: 'undo' },
    { label: 'Calendrier', path: '/prmp/calendrier', icon: 'calendar' },
    // ⚠️ Spec notifications (2026-08-02) — écran transverse, présent dans TOUS les profils.
    { label: 'Notifications', path: '/notifications', icon: 'bell' },
  ],
  // UGPM : agit sous sa PRMP de tutelle — saisit/édite des brouillons, ne soumet pas
  // (bouton masqué + backend 403). Sous-ensemble curé des écrans PRMP dont les endpoints
  // sont accessibles à l'UGPM. « Mes lettres de renvoi » retiré : GET /api/lettre-renvois/mes-lettres
  // est réservé PRMP (403). « Dossiers vérifiés » (GET /api/dossiers?statut=CLOTURE, scopé) est OK.
  UGPM: [
    entreeAFaire('prmp'),
    // ⚠️ Demande pilote (2026-09-13) — écran partagé du PRMP ouvert à l'UGPM en VUE SEULE (actions
    // Soumettre/Rectifier/Compléter masquées, cf. `estPrmp` dans suivi-delais). Libellé « Tous les
    // dossiers » côté UGPM (le PRMP garde « Suivi des dossiers CNM », son cadrage délais).
    { label: 'Tous les dossiers', path: '/prmp/tableau-de-bord', icon: 'folder' },
    { label: 'Créer dossier', path: '/prmp/soumettre-dossier', icon: 'plus' },
    { label: 'Mes brouillons', path: '/prmp/mes-brouillons', icon: 'edit' },
    // ⚠️ Demande pilote (2026-09-13) — « Dossiers vérifiés » RETIRÉ du menu UGPM : les dossiers vérifiés
    // sont visibles dans « Tous les dossiers » (avec leur badge de statut). Route conservée (le PRMP s'en
    // sert pour « Mettre à jour un PPM », /prmp/dossiers-verifies?maj=1).
    { label: 'Notifications', path: '/notifications', icon: 'bell' },
  ],
  // ⚠️ Président et Chef de commission partagent EXACTEMENT le même menu : ne pas éditer l'un des deux
  // isolément, modifier `menuCommission()` (source unique).
  PRESIDENT: menuCommission('/president'),
  CHEF_COMMISSION: menuCommission('/cc'),
  SECRETAIRE: [
    entreeAFaire('secretaire'),
    // ⚠️ Demande pilote (2026-09-13) — « Tous les dossiers » (pipeline partagé) : liste à plat des dossiers
    // du Secrétaire (réceptions + enregistrés), action « Numéroter » inline sur les réceptions.
    // ⚠️ Demande pilote (2026-09-13) — « Mes dossiers » (cartes) RETIRÉ : « Tous les dossiers » (pipeline)
    // porte réceptions + enregistrés à plat avec « Numéroter » inline.
    { label: 'Tous les dossiers', path: '/secretaire/tableau-de-bord', icon: 'folder' },
    // Messagerie retirée du menu pour le moment (demande pilote 2026-09-04) — route conservée.
    // { label: 'Messagerie', path: '/secretaire/messagerie', icon: 'message' },
    { label: 'Notifications', path: '/notifications', icon: 'bell' },
  ],
  MEMBRE: [
    entreeAFaire('membre'),
    // ⚠️ Demande pilote (2026-09-12) — même libellé que le P/CC (« Tous les dossiers »), même écran (le
    // pipeline `tableau-de-bord`) ; route inchangée.
    { label: 'Tous les dossiers', path: '/membre/tableau-de-bord', icon: 'folder' },
    // ⚠️ Demande pilote (2026-09-13) — « Mes dossiers » (cartes type × statut) RETIRÉ : « Tous les
    // dossiers » (pipeline) porte déjà les dossiers à examiner/examinés avec les actions inline
    // (Examiner / Réexaminer / Modifier l'examen) et la pastille « à examiner ». Route conservée.
    // ⚠️ Demande pilote (2026-09-13) — « Projets de PV », « Projets de lettre de renvoi » et « PV
    // définitifs » FUSIONNÉS dans un seul écran-hub « PV et lettres de renvoi » (comme le PRMP) : les
    // trois listes s'ouvrent sous des cartes. Anciens liens `/membre/{pv,lettre-renvois,pv-definitifs}`
    // redirigés vers le hub (voir membre.routes.ts).
    { label: 'PV et lettres de renvoi', path: '/membre/resultat-examen', icon: 'file' },
    // Messagerie retirée du menu pour le moment (demande pilote 2026-09-04) — route conservée.
    // { label: 'Messagerie', path: '/membre/messagerie', icon: 'message' },
    { label: 'Notifications', path: '/notifications', icon: 'bell' },
  ],
  VERIFICATEUR: [
    entreeAFaire('verificateur'),
    { label: 'À vérifier', path: '/verificateur/a-verifier', icon: 'shield' },
    // « En attente PRMP » : retiré du menu (demande user 2026-08-04) — sous-vue redondante. Ces dossiers
    // (EN_ATTENTE_DECISION_PRMP) figurent déjà dans « À vérifier », badgés « En attente PRMP » et en
    // lecture seule ; leur historique d'échanges s'affiche dans l'écran de vérification. Route conservée.
    { label: 'Vérifiés / clôturés', path: '/verificateur/verifies', icon: 'check' },
    // Messagerie retirée du menu pour le moment (demande pilote 2026-09-04) — route conservée.
    // { label: 'Messagerie', path: '/verificateur/messagerie', icon: 'message' },
    { label: 'Notifications', path: '/notifications', icon: 'bell' },
  ],
  ASSISTANT_CONTROLEUR: [
    entreeAFaire('assistant'),
    // ⚠️ Demande pilote (2026-09-12) — même libellé que P/CC/Membre (« Tous les dossiers »), même écran
    // (pipeline `tableau-de-bord`) ; route inchangée.
    { label: 'Tous les dossiers', path: '/assistant/tableau-de-bord', icon: 'folder' },
    { label: 'Lettres de renvoi reçues', path: '/assistant/lettre-renvois', icon: 'mail' },
    { label: 'PV reçus', path: '/assistant/pv-examens', icon: 'file' },
    // Messagerie retirée du menu pour le moment (demande pilote 2026-09-04) — route conservée.
    // { label: 'Messagerie', path: '/assistant/messagerie', icon: 'message' },
    { label: 'Notifications', path: '/notifications', icon: 'bell' },
  ],
  CHARGE_PUBLICATION: [
    { label: 'Publications', path: '/publication/publications', icon: 'globe' },
    { label: 'Documents publics', path: '/publication/documents', icon: 'clip' },
    { label: 'Notifications', path: '/notifications', icon: 'bell' },
  ],
  ADMINISTRATEUR: [
    { label: 'Tableau de bord global', path: '/admin/tableau-de-bord', icon: 'board' },
    { label: 'Inscriptions en attente', path: '/admin/inscriptions', icon: 'inbox' },
    { label: 'Rattachements en attente', path: '/admin/rattachements', icon: 'link' },
    { label: 'Chaînes de contrôle', path: '/admin/chaines-controle', icon: 'layers' },
    { label: 'Délais standards', path: '/admin/delais-standards', icon: 'clock' },
    { label: 'Seuil AGPM (AMI)', path: '/admin/agpm-seuil', icon: 'filter' },
    { label: 'Actualités', path: '/admin/actualites', icon: 'message' },
    { label: 'Référentiels', path: '/admin/referentiels', icon: 'table' },
    { label: 'Comptes & hiérarchie', path: '/admin/comptes', icon: 'users' },
    { label: 'PPM & marchés', path: '/admin/ppm-marches', icon: 'folder' },
    { label: 'Marchés & dates prév.', path: '/admin/marches-previsions', icon: 'calendar' },
    { label: 'Journal d’audit', path: '/admin/audit', icon: 'history' },
    { label: 'Sessions', path: '/admin/sessions', icon: 'key' },
    // Rapports retirés du menu pour le moment (demande pilote 2026-09-04) — route conservée.
    // { label: 'Rapports', path: '/admin/rapports', icon: 'board' },
    { label: 'Notifications', path: '/notifications', icon: 'bell' },
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
