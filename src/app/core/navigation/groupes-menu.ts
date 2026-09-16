import { Role } from '../../models';
import { NavItem, separerParDelegation } from './navigation';

/**
 * Regroupement du menu latéral en RUBRIQUES (refonte ergonomique, lot 5 — maquettes validées le
 * 2026-09-14, table arbitrée le 2026-09-16).
 *
 * ⚠️ Règle du lot : `navigation.ts` n'est PAS modifié. `NAV_BY_ROLE` est un littéral de données que
 * le pilote fait vivre presque chaque jour (33 commits depuis le 28/08) ; y ajouter un champ
 * `groupe` mettrait un conflit git sous chacun de ses ajouts. Le regroupement, les libellés courts
 * et l'ordre des rubriques sont donc DÉRIVÉS ici, dans un fichier neuf, exactement comme
 * `separerParDelegation()` dérive déjà la séparation des délégations « sur la donnée, et non par
 * l'ordre de déclaration du menu ».
 *
 * L'indexation se fait sur le CHEMIN DE ROUTE, jamais sur le libellé : le pilote renomme souvent une
 * entrée, il redirige rarement. Deux clés sont acceptées, la plus précise l'emportant :
 *  1. le chemin complet (`/admin/tableau-de-bord`) — pour lever une ambiguïté d'espace ;
 *  2. le SUFFIXE, chemin privé de son segment d'espace (`/president/retraits` et `/cc/retraits` →
 *     `retraits`) — c'est ce qui permet à `menuCommission()` de servir deux espaces sur une ligne.
 *
 * Ajouter une entrée de menu se fait dans `navigation.ts` ; lui donner sa rubrique, ICI. Une entrée
 * non classée reste affichée (elle tombe dans la première rubrique du menu) et fait ROUGIR
 * `groupes-menu.spec.ts`, qui nomme la ligne à écrire.
 */

/** Rubriques du menu. `pied` n'est pas une rubrique : c'est le bas de la barre (Notifications). */
export type CleGroupe =
  | 'travail'
  | 'suivi'
  | 'decisions'
  | 'demandes'
  | 'pilotage'
  | 'planification'
  | 'archivage'
  | 'organisation'
  | 'parametrage'
  | 'donnees'
  | 'delegation'
  | 'pied';

/** Une section affichable du menu : un intitulé (ou rien) et ses entrées, dans l'ordre déclaré. */
export interface SectionMenu {
  cle: string;
  titre: string | null;
  /** Seule « Exercé par délégation » se replie — un intitulé de rubrique n'est pas un bouton. */
  repliable: boolean;
  items: NavItem[];
}

/** Intitulé affiché de chaque rubrique. */
export const TITRES_GROUPES: Readonly<Record<CleGroupe, string | null>> = {
  travail: 'Mon travail',
  suivi: 'Suivi',
  decisions: 'Décisions',
  demandes: 'Demandes',
  pilotage: 'Pilotage',
  planification: 'Planification',
  archivage: 'Archivage',
  organisation: 'Organisation',
  parametrage: 'Paramétrage',
  donnees: 'Données',
  // Intitulé HISTORIQUE, repris tel quel de `separerParDelegation` (demande user 2026-08-28).
  delegation: 'Exercé par délégation',
  pied: null,
};

/**
 * Ordre d'affichage des rubriques, commun aux dix menus. Un profil n'en voit que celles qu'il
 * remplit : l'Administrateur n'a ni « Mon travail » ni « Décisions », le Secrétaire n'a que la
 * première. « Exercé par délégation » reste la DERNIÈRE (demande user 2026-08-28).
 */
export const ORDRE_GROUPES: readonly CleGroupe[] = [
  'travail',
  'suivi',
  'decisions',
  'demandes',
  'pilotage',
  'planification',
  'archivage',
  'organisation',
  'parametrage',
  'donnees',
  'delegation',
];

/**
 * Rubrique et libellé court de chaque entrée, par chemin complet ou par suffixe de chemin.
 *
 * Les libellés courts servent le rail compact (lot F4) ; ils sont repris de `D.MENU` des maquettes.
 * Quand deux profils partagent un chemin avec des libellés différents, le libellé court se surcharge
 * dans `COURTS_PAR_ROLE` — la rubrique, elle, reste la même.
 */
export const GROUPES_PAR_CHEMIN: Readonly<Record<string, { groupe: CleGroupe; court: string }>> = {
  // ── Mon travail : ce que le profil traite au quotidien ──
  'a-faire': { groupe: 'travail', court: 'À faire' },
  'tableau-de-bord': { groupe: 'travail', court: 'Dossiers' },
  'soumettre-dossier': { groupe: 'travail', court: 'Créer' },
  'dossiers-verifies': { groupe: 'travail', court: 'Mise à jour' },
  'mes-brouillons': { groupe: 'travail', court: 'Brouillons' },
  'a-verifier': { groupe: 'travail', court: 'À vérifier' },
  verifies: { groupe: 'travail', court: 'Vérifiés' },
  publications: { groupe: 'travail', court: 'Publications' },
  documents: { groupe: 'travail', court: 'Documents' },

  // ── Décisions : les productions de l'examen et les demandes à statuer ──
  'resultat-examen': { groupe: 'decisions', court: 'PV' },
  retraits: { groupe: 'decisions', court: 'Retraits' },

  // ── Pilotage (Président / CC) ──
  'repartition-dispatch': { groupe: 'pilotage', court: 'Charge' },
  'chaines-controle': { groupe: 'pilotage', court: 'Chaînes' },

  // ── Planification (PRMP) ──
  calendrier: { groupe: 'planification', court: 'Calendrier' },

  // ── Archivage (Assistant contrôleur) ──
  'lettre-renvois': { groupe: 'archivage', court: 'Lettres' },
  'pv-examens': { groupe: 'archivage', court: 'Archives' },

  // ── Administrateur — chemins COMPLETS : trois de ses suffixes servent déjà un autre espace
  //    (`tableau-de-bord` et `chaines-controle`), la clé précise lève l'ambiguïté sans table de rôles.
  '/admin/tableau-de-bord': { groupe: 'suivi', court: 'Global' },
  '/admin/chaines-controle': { groupe: 'organisation', court: 'Chaînes' },
  audit: { groupe: 'suivi', court: 'Journal' },
  sessions: { groupe: 'suivi', court: 'Sessions' },
  inscriptions: { groupe: 'demandes', court: 'Inscriptions' },
  rattachements: { groupe: 'demandes', court: 'Rattachements' },
  comptes: { groupe: 'organisation', court: 'Comptes' },
  'delais-standards': { groupe: 'parametrage', court: 'Délais' },
  'agpm-seuil': { groupe: 'parametrage', court: 'Seuil' },
  referentiels: { groupe: 'parametrage', court: 'Référentiels' },
  actualites: { groupe: 'parametrage', court: 'Actualités' },
  'ppm-marches': { groupe: 'donnees', court: 'PPM' },
  'marches-previsions': { groupe: 'donnees', court: 'Marchés' },

  // ── Pied de barre : transverse, chemin absolu, répété à l'identique dans les dix menus ──
  '/notifications': { groupe: 'pied', court: 'Alertes' },
};

/**
 * Libellé court surchargé pour un profil donné (clé = chemin complet ou suffixe). Deux profils
 * peuvent servir le MÊME écran sous deux libellés : la rubrique ne change pas, le mot du rail si.
 */
export const COURTS_PAR_ROLE: Readonly<Partial<Record<Role, Readonly<Record<string, string>>>>> = {
  // « Suivi des dossiers CNM » (cadrage délais) ≠ « Tous les dossiers » de l'UGPM, même écran.
  PRMP: { 'tableau-de-bord': 'Suivi' },
  // « Examen de dossiers » (le hub P/CC a les projets de PV) ≠ « PV et lettres de renvoi ».
  PRESIDENT: { 'resultat-examen': 'Examen' },
  CHEF_COMMISSION: { 'resultat-examen': 'Examen' },
  // « PV reçus » de l'Assistant ≠ « Archivage des PV » exercé par délégation chez le P/CC.
  ASSISTANT_CONTROLEUR: { 'pv-examens': 'PV' },
};

/**
 * Suffixe de chemin : le chemin privé de son segment d'espace. Un chemin d'un seul segment
 * (`/notifications`, transverse) est rendu tel quel — il n'a pas d'espace à retirer.
 */
export function suffixeChemin(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments.length > 1 ? segments.slice(1).join('/') : path;
}

/** Entrée de la table pour cette route : chemin complet d'abord, suffixe ensuite. */
function entreeTable(item: NavItem): { groupe: CleGroupe; court: string } | undefined {
  return GROUPES_PAR_CHEMIN[item.path] ?? GROUPES_PAR_CHEMIN[suffixeChemin(item.path)];
}

/**
 * Rubrique EXPLICITE de l'entrée, `null` si elle n'est rangée nulle part.
 *
 * Une entrée déléguée n'a pas à figurer dans la table : sa rubrique est `delegation` par
 * construction (`separerParDelegation` la range sur la donnée, pas sur l'ordre de déclaration).
 */
export function groupeExplicite(item: NavItem): CleGroupe | null {
  if (item.delegation) {
    return 'delegation';
  }
  return entreeTable(item)?.groupe ?? null;
}

/**
 * Libellé court de l'entrée (rail compact) : surcharge du profil, sinon table, sinon repli sur le
 * PREMIER MOT du libellé — un ajout du pilote reste lisible en rail sans toucher à ce fichier.
 */
export function libelleCourt(item: NavItem, role: Role | null = null): string {
  const surcharges = role ? COURTS_PAR_ROLE[role] : undefined;
  const surcharge = surcharges?.[item.path] ?? surcharges?.[suffixeChemin(item.path)];
  return surcharge ?? entreeTable(item)?.court ?? item.label.split(' ')[0];
}

/**
 * Le libellé court est-il CONTENU dans le libellé complet ? C'est la question exacte que pose le
 * critère WCAG 2.5.3 « Label in Name ». La comparaison ignore la casse et les espaces surnuméraires
 * — « Global » vaut pour « Tableau de bord global » — mais PAS les accents : ce que l'utilisateur
 * lit à l'écran est accentué, la correspondance doit l'être aussi.
 */
export function courtContenuDansLibelle(label: string, court: string): boolean {
  const normaliser = (texte: string) => texte.replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr');
  return normaliser(label).includes(normaliser(court));
}

/**
 * Nom accessible d'une entrée EN RAIL — le libellé complet, précédé du libellé court quand celui-ci
 * en est un SYNONYME et non un fragment (« Alertes — Notifications »).
 *
 * ⚠️ WCAG 2.5.3 « Label in Name » (correctif du 2026-09-16). En rail, le seul texte visible d'une
 * entrée est sa légende ; son nom accessible, lui, reste le libellé complet rangé hors écran. Pour
 * vingt-cinq entrées sur trente la légende est un fragment du libellé (« Dossiers » dans « Tous les
 * dossiers ») et le critère est satisfait d'office. Pour CINQ, la légende est un synonyme — Charge /
 * Répartition de dispatch, Alertes / Notifications, Mise à jour / Mettre à jour un PPM, Archives /
 * Archivage des PV, Retraits / Demandes de retrait. Qui pilote à la voix dit ce qu'il lit
 * (« Alertes ») : la commande ne correspondait alors à rien.
 *
 * Les légendes ne bougent pas (maquettes validées le 2026-09-14) : c'est le nom accessible qui
 * s'élargit, et seulement pour ces cinq entrées. Le mot visible vient EN TÊTE — l'avis du critère
 * recommande de commencer le nom accessible par l'étiquette visible, et plusieurs moteurs de
 * commande vocale ne reconnaissent que ce début. Le libellé complet suit, pour que l'entrée reste
 * identifiable à l'oreille et unique dans son menu (deux entrées « PV » coexistent chez le
 * Président). Le tiret cadratin entouré d'espaces est le séparateur déjà employé partout dans la
 * coquille (`infobulle()`, carte de profil) : un lecteur d'écran n'en dit pas le nom, il marque une
 * pause — « Alertes… Notifications ».
 *
 * En MENU LARGE, rien ne change : le texte visible EST le libellé complet, qui est son propre nom
 * accessible. L'infobulle non plus ne change pas — elle reste le libellé complet, seul.
 */
export function nomAccessibleRail(item: NavItem, role: Role | null = null): string {
  const court = libelleCourt(item, role);
  return courtContenuDansLibelle(item.label, court) ? item.label : `${court} — ${item.label}`;
}

/** Entrées du PIED de la barre (aujourd'hui : « Notifications », commune aux dix menus). */
export function piedMenu(items: NavItem[]): NavItem[] {
  return items.filter((i) => groupeExplicite(i) === 'pied');
}

/**
 * Sections affichables du menu d'un profil : les rubriques propres dans l'ordre de `ORDRE_GROUPES`,
 * puis « Exercé par délégation ». Les entrées de pied en sont retirées (`piedMenu` les rend).
 *
 * Deux garde-fous d'affichage :
 *  - un menu qui ne produit qu'UNE rubrique propre ne montre AUCUN intitulé — le Secrétaire, le
 *    Vérificateur, l'UGPM et le Chargé de publication retrouvent exactement le menu d'avant ;
 *  - une entrée non classée n'est jamais perdue : elle rejoint la première rubrique du menu, et
 *    c'est la spec qui le signale, pas l'utilisateur.
 */
export function sectionsMenu(items: NavItem[]): SectionMenu[] {
  const affichables = items.filter((i) => groupeExplicite(i) !== 'pied');
  const parDelegation = separerParDelegation(affichables);
  const propres = parDelegation.find((s) => s.cle === 'propre')?.items ?? [];
  const delegues = parDelegation.find((s) => s.cle === 'delegation')?.items ?? [];

  const classees = new Map<CleGroupe, NavItem[]>();
  const orphelines: NavItem[] = [];
  for (const item of propres) {
    const groupe = groupeExplicite(item);
    if (!groupe) {
      orphelines.push(item);
      continue;
    }
    const seau = classees.get(groupe);
    if (seau) {
      seau.push(item);
    } else {
      classees.set(groupe, [item]);
    }
  }

  const sections: SectionMenu[] = ORDRE_GROUPES.filter((cle) => classees.has(cle)).map((cle) => ({
    cle,
    titre: TITRES_GROUPES[cle],
    repliable: false,
    items: classees.get(cle) as NavItem[],
  }));

  if (orphelines.length > 0) {
    if (sections.length > 0) {
      sections[0].items = [...sections[0].items, ...orphelines];
    } else {
      sections.push({ cle: 'travail', titre: TITRES_GROUPES.travail, repliable: false, items: orphelines });
    }
  }

  // Une seule rubrique propre : pas d'intitulé, le menu est déjà sa propre rubrique.
  if (sections.length === 1) {
    sections[0].titre = null;
  }

  if (delegues.length > 0) {
    sections.push({
      cle: 'delegation',
      titre: TITRES_GROUPES.delegation,
      repliable: true,
      items: delegues,
    });
  }

  return sections;
}
