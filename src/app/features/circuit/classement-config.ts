import { forkJoin, map, Observable } from 'rxjs';

import { Dossier, Role } from '../../models';
import { DossierService } from '../../services';

/** Colonnes optionnelles de la liste (drill-down), selon le groupe. */
export type ColonneCircuit = 'reception' | 'dateDispatch' | 'attributaire';

/** Un groupe de classement (colonne du classement) : libellé + statuts couverts + habillage. */
export interface ClassementGroupe {
  /** Segment d'URL du groupe (ex. 'pre-dispatch'). */
  key: string;
  label: string;
  /** Statuts de dossier rattachés à ce groupe. */
  statuts: string[];
  icon: string;
  /** Teinte : 'a' (en attente) ou 'b' (avancé). */
  kind: 'a' | 'b';
  /** Colonnes supplémentaires affichées dans la liste de ce groupe (drill-down). */
  colonnes?: ColonneCircuit[];
  /** Propose l'action « Dispatcher » dans la liste (gardée par la capacité DISPATCH_WRITE). */
  actionDispatch?: boolean;
  /** Propose « Enregistrer » la réception initiale (gardée par RECEPTION_WRITE, dossier sans réception). */
  actionReception?: boolean;
  /** Propose « Retirer » (annuler le dispatch → retour pré-dispatch ; gardée par DISPATCH_WRITE). */
  actionAnnulerDispatch?: boolean;
  /** Propose l'action « Examiner » dans la liste (→ `/membre/examiner/:idDossier`, espace Membre). */
  actionExamen?: boolean;
  /** Propose « Modifier l'examen » (même cible) tant que le dossier est EXAMINE et son PV non soumis. */
  actionModifierExamen?: boolean;
  /**
   * Groupe SANS action propre à un profil délégable (ex. « Enregistrement » du Secrétaire) : visible
   * seulement si `peutExecuter(delegation)` — identité chez le titulaire, paire active ET exercée
   * ailleurs (2026-08-15, parité des tâches du subordonné chez P/CC).
   */
  delegation?: Role;
}
/** Config d'un écran de classement, passée via `data.classement` de la route. */
export interface ClassementConfig {
  subtitle: string;
  /** Base des liens de drill-down (ex. '/president/mes-dossiers'). */
  base: string;
  groupes: ClassementGroupe[];
  /**
   * Source des dossiers : absente = `GET /api/dossiers` (scopé localité/PRMP) ; `'membre'` = files du
   * Membre attributaire (`/a-examiner` + `/examines`, scopées à SON IM — la liste générale montrerait
   * aussi les dossiers attribués aux autres Membres de la localité).
   */
  source?: 'membre';
  /** Affiche la section « Dispatchs par contrôleur » sous le classement (Président : toutes localités ; CC : sa localité). */
  statDispatchsControleurs?: boolean;
  /**
   * ⚠️ 2026-08-07 (demande user) — chemin de l'écran des demandes de retrait (ex. `/president/retraits`).
   * Renseigné, il ajoute à CHAQUE carte de type une ligne « Demandes de retrait » comptant les demandes
   * en attente sur les dossiers de ce type, et menant à l'écran filtré (`?type=DDP`). C'est ce qui
   * remplace l'entrée de menu : une demande de retrait porte toujours sur un dossier, donc sur un type.
   */
  retraitsPath?: string;
}

/**
 * File de réception du Secrétaire (SOUMIS → « Enregistrer ») — TITULAIRE : Secrétaire ; montée aussi
 * chez Président/CC par DÉLÉGATION ASCENDANTE (paire active en base ; le groupe est masqué sinon,
 * cf. `DossiersClassement.groupesVisibles`).
 */
export const GROUPE_RECEPTIONS: ClassementGroupe = {
  key: 'receptions',
  label: 'Réceptions',
  statuts: ['SOUMIS'],
  icon: '📥',
  kind: 'a',
  actionReception: true,
};

/**
 * Registre du Secrétaire : dossiers réceptionnés-enregistrés (PRET_DISPATCH), consultation. Partagé
 * avec P/CC via `delegation` (2026-08-15, demande user : la délégation Secrétaire monte ses DEUX
 * tâches — réceptions ET enregistrement). ⚠️ Même statut que « Pré-dispatch » chez P/CC : un dossier
 * y apparaît DANS LES DEUX groupes (vues différentes de la même donnée) — les totaux comptent en
 * dossiers DISTINCTS (cf. `DossiersClassement.grouper`).
 */
export const GROUPE_ENREGISTREMENT: ClassementGroupe = {
  key: 'enregistrement',
  label: 'Enregistrement',
  statuts: ['PRET_DISPATCH'],
  icon: '📚',
  kind: 'b',
  colonnes: ['reception'],
  delegation: 'SECRETAIRE',
};

/**
 * Groupes du circuit (Président / CC) : réceptions + enregistrement (délégation Secrétaire),
 * pré-dispatch (en attente) et dispatch (dispatché — « Examiner » par délégation Membre).
 */
export const CIRCUIT_GROUPES: ClassementGroupe[] = [
  GROUPE_RECEPTIONS,
  GROUPE_ENREGISTREMENT,
  { key: 'pre-dispatch', label: 'Pré-dispatch', statuts: ['PRET_DISPATCH'], icon: '📤', kind: 'a', colonnes: ['reception'], actionDispatch: true },
  {
    key: 'dispatch',
    label: 'Dispatch',
    statuts: ['DISPATCHE', 'A_REEXAMINER'],
    icon: '📦',
    kind: 'b',
    colonnes: ['reception', 'dateDispatch', 'attributaire'],
    actionAnnulerDispatch: true,
    actionExamen: true,
  },
];

/** Dossiers couverts par un classement, selon sa source (voir `ClassementConfig.source`). */
export function dossiersDuClassement(cfg: ClassementConfig, dossiers: DossierService): Observable<Dossier[]> {
  if (cfg.source === 'membre') {
    // `examines` est paginé : une page large couvre le classement (au-delà de 1000, comptes tronqués).
    return forkJoin({ a: dossiers.aExaminer(), e: dossiers.examines(0, 1000) }).pipe(
      map(({ a, e }) => [...a, ...e.content]),
    );
  }
  return dossiers.list();
}

/** Une section de lignes dans une carte de classement. */
export interface SectionGroupes {
  cle: 'propre' | 'delegation';
  titre: string | null;
  items: ClassementGroupe[];
}

/**
 * Scinde les groupes d'une carte : d'abord les tâches du profil connecté, puis celles exercées par
 * délégation ascendante.
 *
 * ⚠️ Demande user (2026-08-28) : « ne pas mélanger », même exigence que pour la barre latérale.
 * Dans les cartes, « Réceptions » et « Enregistrement » (tâches du Secrétaire) s'intercalaient avant
 * « Pré-dispatch » et « Dispatch », propres au Président et au CC.
 *
 * Le prédicat est INJECTÉ parce que la réponse dépend de l'utilisateur connecté, pas de la
 * configuration : « Réceptions » ne porte pas le champ `delegation` mais est bien exercé par
 * délégation chez P/CC (via son `actionReception`). Trier sur le champ seul le laisserait du
 * mauvais côté. C'est `DossiersClassement.delegationDe` qui tranche à l'exécution.
 *
 * ⚠️ La section « propre » est TOUJOURS rendue, même vide : c'est elle qui porte la ligne
 * « Demandes de retrait », seul chemin vers cet écran (règle du 2026-08-07). La filtrer sur
 * `items.length` la ferait disparaître avec sa dernière tâche.
 */
export function separerGroupesParDelegation(
  groupes: ClassementGroupe[],
  estDelegue: (g: ClassementGroupe) => boolean,
): SectionGroupes[] {
  const delegues = groupes.filter(estDelegue);
  const sections: SectionGroupes[] = [
    { cle: 'propre', titre: null, items: groupes.filter((g) => !estDelegue(g)) },
  ];
  if (delegues.length) sections.push({ cle: 'delegation', titre: 'Exercé par délégation', items: delegues });
  return sections;
}
