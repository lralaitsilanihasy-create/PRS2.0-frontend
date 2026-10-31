import { NavItem, separerParDelegation } from './navigation';

/**
 * Regroupement du menu en RUBRIQUES (refonte ergonomique, lot 5 — maquettes validées le
 * 2026-09-14, table arbitrée le 2026-09-16).
 *
 * ⚠️ Règle du lot : `navigation.ts` n'est PAS modifié. `NAV_BY_ROLE` est un littéral de données que
 * le pilote fait vivre presque chaque jour (33 commits depuis le 28/08) ; y ajouter un champ
 * `groupe` mettrait un conflit git sous chacun de ses ajouts. Le regroupement et l'ordre des rubriques sont donc DÉRIVÉS ici, dans un fichier neuf, exactement comme
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

/**
 * Rubriques du menu. `pied` n'est pas une rubrique : c'est le bas de la barre (Notifications), et
 * `accueil` en est une sans intitulé — l'entrée d'accueil ouvre le menu, au-dessus des rubriques.
 *
 * ⚠️ Lot 6 F1 (2026-09-17) — les cinq rubriques `suivi`, `demandes`, `organisation`, `parametrage`
 * et `donnees` ont disparu : elles ne servaient QUE l'Administrateur, dont le classement est refait
 * (§3 du plan L6). Les rubriques des neuf autres profils ne bougent pas d'une ligne.
 */
export type CleGroupe =
  | 'accueil'
  | 'travail'
  | 'decisions'
  | 'acces'
  | 'pilotage'
  | 'planification'
  | 'archivage'
  | 'regles'
  | 'referentiels'
  | 'traces'
  | 'delegation'
  | 'interim'
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
  /**
   * SANS intitulé, et c'est voulu : l'accueil d'un profil est une entrée unique, posée en tête du
   * menu juste sous le bloc de marque. Un intitulé « Accueil » au-dessus d'une seule ligne ne
   * classerait rien et coûterait 21 px de hauteur au menu le plus chargé (Administrateur).
   */
  accueil: null,
  travail: 'Mon travail',
  decisions: 'Décisions',
  acces: 'Accès',
  pilotage: 'Pilotage',
  planification: 'Planification',
  archivage: 'Archivage',
  regles: 'Règles du contrôle',
  referentiels: 'Référentiels',
  traces: 'Traces',
  // Intitulé HISTORIQUE, repris tel quel de `separerParDelegation` (demande user 2026-08-28).
  delegation: 'Exercé par délégation',
  // ⚠️ Intérim désigné (2026-09-21) — entrées du titulaire suppléé, offertes à son intérimaire ; toujours la dernière.
  interim: 'Exercé par intérim',
  pied: null,
};

/**
 * Ordre d'affichage des rubriques, commun aux dix menus. Un profil n'en voit que celles qu'il
 * remplit : l'Administrateur n'a ni « Mon travail » ni « Décisions » — il a les quatre siennes,
 * précédées de son accueil ; le Secrétaire n'a que « Mon travail ». « Exercé par délégation » reste
 * la DERNIÈRE (demande user 2026-08-28).
 */
export const ORDRE_GROUPES: readonly CleGroupe[] = [
  'accueil',
  'travail',
  'decisions',
  'acces',
  'pilotage',
  'planification',
  'archivage',
  'regles',
  'referentiels',
  'traces',
  'delegation',
];

/**
 * Rubrique de chaque entrée, par chemin complet ou par suffixe de chemin.
 *
 * ⚠️ 30/10/2026 (design institutionnel) — les rubriques deviennent les menus déroulants de la barre horizontale
 * (`barreDuMenu`, main-layout). Les libellés courts du rail compact (lot F4) sont retirés avec lui.
 */
export const GROUPES_PAR_CHEMIN: Readonly<Record<string, { groupe: CleGroupe }>> = {
  // ── Mon travail : ce que le profil traite au quotidien ──
  'a-faire': { groupe: 'travail' },
  'tableau-de-bord': { groupe: 'travail' },
  'soumettre-dossier': { groupe: 'travail' },
  'dossiers-verifies': { groupe: 'travail' },
  'mes-brouillons': { groupe: 'travail' },
  'a-verifier': { groupe: 'travail' },
  verifies: { groupe: 'travail' },
  publications: { groupe: 'travail' },
  documents: { groupe: 'travail' },
  // ⚠️ 2026-10-06 — les fiches DAO et la soumission en ligne (PRMP, UGPM).
  dao: { groupe: 'travail' },
  recus: { groupe: 'travail' },
  // ⚠️ 06/10 — entrée DYNAMIQUE (main-layout) : le responsable d'au moins une procédure en ligne.
  '/procedures-en-ligne': { groupe: 'travail' },
  // ⚠️ Lot MS-1 (V124, 16/10) — les contrats-cadres et marchés à commandes notifiés (PRMP, UGPM).
  'contrats-en-vigueur': { groupe: 'travail' },

  // ── Décisions : les productions de l'examen et les demandes à statuer ──
  'resultat-examen': { groupe: 'decisions' },
  retraits: { groupe: 'decisions' },

  // ── Pilotage (Président / CC) ──
  'repartition-dispatch': { groupe: 'pilotage' },
  'chaines-controle': { groupe: 'pilotage' },
  // ⚠️ Intérim désigné (2026-09-21) — « Intérim » du Président / CC : qui agit à sa place pendant son absence.
  interim: { groupe: 'pilotage' },

  // ── Planification (PRMP) ──
  calendrier: { groupe: 'planification' },

  // ── Archivage (Assistant contrôleur) ──
  'lettre-renvois': { groupe: 'archivage' },
  'pv-examens': { groupe: 'archivage' },

  // ── Administrateur (classement refait au lot 6 F1 — plan L6, §3). Deux de ses suffixes servent
  //    déjà un autre espace (`tableau-de-bord`, `chaines-controle`) : la clé en chemin COMPLET lève
  //    l'ambiguïté sans table de rôles.
  //
  //    Quatre rubriques, précédées de l'accueil : ce que l'Administrateur ouvre pour DONNER l'accès,
  //    ce qu'il règle pour que le contrôle se comporte comme la loi le demande, le vocabulaire des
  //    écrans, et ce que l'application garde ou dit d'elle-même. Les trois défauts corrigés : le
  //    journal de connexions n'est plus un « suivi », la communication n'est plus un « paramétrage »,
  //    et les réglages du moteur de contrôle ne sont plus noyés dans les nomenclatures.
  '/admin/tableau-de-bord': { groupe: 'accueil' },
  inscriptions: { groupe: 'acces' },
  comptes: { groupe: 'acces' },
  '/admin/chaines-controle': { groupe: 'regles' },
  'delais-standards': { groupe: 'regles' },
  // Deux écrans de référentiel promus en entrées de menu : leur chemin garde le segment
  // `referentiels/`, la clé est donc le suffixe complet — la clé `referentiels` (le sommaire) ne
  // l'attrape pas, `entreeTable` compare le suffixe entier.
  'referentiels/points-ctrls': { groupe: 'regles' },
  'agpm-seuil': { groupe: 'regles' },
  'referentiels/regle-alertes': { groupe: 'regles' },
  referentiels: { groupe: 'referentiels' },
  audit: { groupe: 'traces' },
  actualites: { groupe: 'traces' },

  // ── Pied de barre : transverse, chemin absolu, répété à l'identique dans les dix menus ──
  '/notifications': { groupe: 'pied' },
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
function entreeTable(item: NavItem): { groupe: CleGroupe } | undefined {
  return GROUPES_PAR_CHEMIN[item.path] ?? GROUPES_PAR_CHEMIN[suffixeChemin(item.path)];
}

/**
 * Rubrique EXPLICITE de l'entrée, `null` si elle n'est rangée nulle part.
 *
 * Une entrée déléguée n'a pas à figurer dans la table : sa rubrique est `delegation` par
 * construction (`separerParDelegation` la range sur la donnée, pas sur l'ordre de déclaration).
 */
export function groupeExplicite(item: NavItem): CleGroupe | null {
  // Une entrée reçue d'un titulaire suppléé (2026-09-21) est « exercée par intérim », quoi qu'elle soit chez lui.
  if (item.interimDe) {
    return 'interim';
  }
  if (item.delegation) {
    return 'delegation';
  }
  return entreeTable(item)?.groupe ?? null;
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
 *  - un menu qui ne produit qu'UNE rubrique porte son intitulé comme les autres (pilote 22/09 — la règle
 *    « pas d'intitulé pour une rubrique unique » du lot 5 est levée) ;
 *  - une entrée non classée n'est jamais perdue : elle rejoint la première rubrique du menu, et
 *    c'est la spec qui le signale, pas l'utilisateur.
 */
export function sectionsMenu(items: NavItem[]): SectionMenu[] {
  const affichables = items.filter((i) => groupeExplicite(i) !== 'pied');
  const interims = affichables.filter((i) => !!i.interimDe);
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

  // ⚠️ Demande pilote (2026-09-22, « valable pour tout profil ») — un menu d'UNE rubrique porte son intitulé
  // comme les autres : depuis que l'intitulé est une bande dorée, son absence chez le Secrétaire, le Vérificateur,
  // l'UGPM et le Chargé de publication se voyait. La règle du lot 5 (« pas d'intitulé pour une rubrique unique ») tombe.

  if (delegues.length > 0) {
    sections.push({
      cle: 'delegation',
      titre: TITRES_GROUPES.delegation,
      repliable: true,
      items: delegues,
    });
  }

  // ⚠️ Intérim désigné (2026-09-21) — les entrées reçues d'un titulaire suppléé ferment le menu, sous leur
  // propre intitulé : un intérim est un état passager, il ne se mêle ni aux rubriques ni à la délégation.
  if (interims.length > 0) {
    sections.push({
      cle: 'interim',
      titre: TITRES_GROUPES.interim,
      repliable: false,
      items: interims,
    });
  }

  return sections;
}
