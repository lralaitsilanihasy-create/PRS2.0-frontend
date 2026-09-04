import { forkJoin, map, Observable } from 'rxjs';

import { Dossier, estLocaliteCentrale, Role } from '../../models';
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
  /** Propose « Attribuer un numéro » — la réception initiale (gardée par RECEPTION_WRITE, dossier sans réception). */
  actionReception?: boolean;
  /** Propose « Retirer » (annuler le dispatch → retour pré-dispatch ; gardée par DISPATCH_WRITE). */
  actionAnnulerDispatch?: boolean;
  /**
   * ⚠️ Demande pilote (2026-09-03) — propose « Dispatcher » (réattribuer) sur un dossier DISPATCHE
   * dont l'utilisateur est l'ATTRIBUTAIRE et dont l'examen n'est pas commencé : le P/CC qui a reçu
   * le dossier (ex. Président → CC en localité centrale) choisit de l'examiner lui-même ou de le
   * confier à un Membre (PUT sur le dispatch existant — le dossier reste DISPATCHE).
   */
  actionReattribuer?: boolean;
  /**
   * ⚠️ Demande pilote (2026-09-03) — propose « Retirer » (RENDRE) sur un dossier DISPATCHE dont
   * l'utilisateur est l'ATTRIBUTAIRE : le CC (ou le Président auto-attribué) renvoie le dossier au
   * pré-dispatch (annulation du dispatch — il n'en est plus l'attributaire). Gardé par
   * DISPATCH_WRITE — invisible chez le Membre. ⚠️ Distinct d'`actionAnnulerDispatch` : ce dernier
   * sert AUSSI de marqueur du groupe « gestion » (`dossierAttribueAMoi`) — le réutiliser ici
   * exclurait mes attributions de ma propre file.
   */
  actionRendre?: boolean;
  /** Propose l'action « Examiner » dans la liste (→ `/membre/examiner/:idDossier`, espace Membre). */
  actionExamen?: boolean;
  /** Propose « Modifier l'examen » (même cible) tant que le dossier est EXAMINE et son PV non soumis. */
  actionModifierExamen?: boolean;
  /**
   * Groupe SANS action propre à un profil délégable (ex. « Enregistrés » du Secrétaire) : visible
   * seulement si `peutExecuter(delegation)` — identité chez le titulaire, paire active ET exercée
   * ailleurs (2026-08-15, parité des tâches du subordonné chez P/CC).
   */
  delegation?: Role;
  /**
   * ⚠️ Demande pilote (2026-09-03) — file DÉRIVÉE : le groupe ne retient que les dossiers dont
   * l'utilisateur est l'ATTRIBUTAIRE du dernier dispatch. Sert aux files « À examiner / Examinés »
   * montées DANS les cartes de « Mes dossiers » P/CC (le classement n'a qu'une source — la liste
   * générale — là où l'espace Membre utilise les files serveur via `source: 'membre'`).
   */
  attribueAMoi?: boolean;
}
/** Config d'un écran de classement, passée via `data.classement` de la route. */
export interface ClassementConfig {
  subtitle: string;
  /** Titre de la page (défaut : « Mes dossiers »). */
  titre?: string;
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
 * ⚠️ Demande pilote (2026-09-03) — un dossier de la localité CENTRALE (CNM) ne passe pas par le CC
 * au pré-dispatch : seul le Président a ce privilège. Le dossier est donc EXCLU des groupes à action
 * « Dispatcher » pour le rôle CHEF_COMMISSION — compteurs du classement ET lignes du drill-down.
 * Les commissions régionales (CRM) et les autres groupes (Enregistrés, Réceptions…) sont inchangés ;
 * la garde serveur miroir (403 au POST /api/dispatchs) fait l'objet de la demande backend du même jour.
 */
export function dossierExcluDuGroupe(g: ClassementGroupe, d: Dossier, role: Role | null): boolean {
  return !!g.actionDispatch && role === 'CHEF_COMMISSION' && estLocaliteCentrale(d.idLocalite);
}

/**
 * ⚠️ Suite (question pilote du même jour : « le menu pre-dispatch est-il encore utile dans ce
 * profil ? ») — chez le CC de la localité CENTRALE, le groupe « Pré-dispatch » est masqué en ENTIER
 * (tuile KPI + ligne des cartes) : tous ses dossiers sont centraux, le groupe resterait
 * définitivement à zéro. Les CC régionaux et le Président le gardent — même discriminant que
 * `dossierExcluDuGroupe`, appliqué à la localité de l'UTILISATEUR (un CC ne voit que la sienne).
 */
export function groupeMasquePourProfil(g: ClassementGroupe, role: Role | null, localiteUtilisateur: string | null): boolean {
  return !!g.actionDispatch && role === 'CHEF_COMMISSION' && estLocaliteCentrale(localiteUtilisateur);
}

/**
 * ⚠️ Demande pilote (2026-09-03, suite) — « si le président fait un dispatch vers CC, il doit être
 * dans À examiner et non pas dans Dispatch. Par contre, si ce dossier est dispatché à son tour à un
 * membre, en ce moment-là il doit être dans le Dispatch. » Un dossier dont JE suis l'ATTRIBUTAIRE
 * est une tâche d'EXAMEN (files « Dossiers à examiner »), pas de gestion : il est EXCLU du groupe
 * « Dispatch » (compteurs et drill-down) tant que je ne l'ai pas réattribué (attributaire ≠ moi).
 */
export function dossierAttribueAMoi(g: ClassementGroupe, attributaire: string | undefined, ref: string | null): boolean {
  return !!g.actionAnnulerDispatch && !!ref && attributaire === ref;
}

/** Miroir de `dossierAttribueAMoi` pour les files dérivées : un groupe `attribueAMoi` ne retient QUE mes attributions. */
export function dossierHorsFileAttribuee(g: ClassementGroupe, attributaire: string | undefined, ref: string | null): boolean {
  return !!g.attribueAMoi && (!ref || attributaire !== ref);
}

/**
 * idDossier → attributaire (`imCtrlMembre`) du DERNIER dispatch — même règle de jointure
 * réception → dispatch que le drill-down et « Dispatchs par contrôleur ».
 */
export function attributairesParDossier(
  receptions: readonly { idReception: number; idDossier: number }[],
  dispatchs: readonly { idReception: number; imCtrlMembre?: string; dateDispatch?: string }[],
): Map<number, string> {
  const recDossier = new Map(receptions.map((r) => [r.idReception, r.idDossier]));
  const dernier = new Map<number, { imCtrlMembre?: string; dateDispatch?: string }>();
  for (const disp of dispatchs) {
    const idDossier = recDossier.get(disp.idReception);
    if (idDossier == null) continue;
    const prec = dernier.get(idDossier);
    if (!prec || (disp.dateDispatch ?? '') >= (prec.dateDispatch ?? '')) dernier.set(idDossier, disp);
  }
  const m = new Map<number, string>();
  for (const [idDossier, disp] of dernier) if (disp.imCtrlMembre) m.set(idDossier, disp.imCtrlMembre);
  return m;
}

/**
 * File de réception du Secrétaire (SOUMIS → « Attribuer un numéro ») — TITULAIRE : Secrétaire ; montée aussi
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
  key: 'enregistrement', // clé de ROUTE — ne pas renommer avec le libellé
  label: 'Enregistrés', // « Enregistrement » → « Enregistrés » (demande user 2026-09-01)
  statuts: ['PRET_DISPATCH'],
  icon: '📚',
  kind: 'b',
  colonnes: ['reception'],
  delegation: 'SECRETAIRE',
};

/**
 * Groupes du Membre : à examiner (DISPATCHE + A_REEXAMINER, réexamen après lettre de renvoi) vs
 * examinés (historique `/examines`). SOURCE UNIQUE : l'espace Membre (« Mes dossiers », files
 * IM-scopées du serveur via `source: 'membre'`) et les files dérivées des cartes P/CC
 * ({@link GROUPES_MES_EXAMENS}) partagent ces groupes.
 */
export const MEMBRE_GROUPES: ClassementGroupe[] = [
  // `actionReattribuer` : chez P/CC (DISPATCH_WRITE), un dossier de MA file s'examine OU se réattribue
  // à un Membre — le geste vit ICI, pas dans « Dispatch », qui exclut mes attributions (2026-09-03).
  // Invisible chez le Membre (pas la capacité), zéro code.
  { key: 'a-examiner', label: 'À examiner', statuts: ['DISPATCHE', 'A_REEXAMINER'], icon: '🔍', kind: 'a', colonnes: ['dateDispatch'], actionExamen: true, actionReattribuer: true, actionRendre: true },
  { key: 'examines', label: 'Examinés', statuts: ['EXAMINE', 'PV_SIGNE', 'EN_VERIFICATION', 'CLOTURE'], icon: '✅', kind: 'b', colonnes: ['dateDispatch'], actionModifierExamen: true },
];

/**
 * Files du Membre DÉRIVÉES pour les cartes de « Mes dossiers » P/CC (⚠️ demande pilote 2026-09-03 :
 * « mettre les menus [À examiner / Examinés] dans les cards Exercé par délégation ») : mêmes groupes
 * que l'espace Membre, mais calculés depuis la LISTE GÉNÉRALE via l'attributaire du dernier
 * dispatch (`attribueAMoi`) — le classement n'a qu'une source de données.
 */
export const GROUPES_MES_EXAMENS: ClassementGroupe[] = MEMBRE_GROUPES.map((g) => ({ ...g, attribueAMoi: true }));

/**
 * Groupes du circuit (Président / CC) : pré-dispatch (en attente), dispatch (gestion — sans mes
 * attributions), et les files « À examiner / Examinés » (délégation Membre, dérivées).
 * ⚠️ 2026-09-03 (demande pilote) — les tâches du SECRÉTAIRE (Réceptions, Enregistrés) ne vivent
 * plus dans ces cartes : elles ont leurs entrées de MENU « Exercé par délégation » (navigation),
 * chacune vers son propre classement.
 */
export const CIRCUIT_GROUPES: ClassementGroupe[] = [
  { key: 'pre-dispatch', label: 'Pré-dispatch', statuts: ['PRET_DISPATCH'], icon: '📤', kind: 'a', colonnes: ['reception'], actionDispatch: true },
  {
    key: 'dispatch',
    label: 'Dispatch',
    statuts: ['DISPATCHE', 'A_REEXAMINER'],
    icon: '📦',
    kind: 'b',
    colonnes: ['reception', 'dateDispatch', 'attributaire'],
    actionAnnulerDispatch: true,
    // ⚠️ Demande pilote (2026-09-03 soir) — PAS d'« Examiner » ici : « celui qui a dispatché le
    // dossier n'a plus accès à l'examen de ce même dossier ; le CC en copie non plus ». Ce groupe
    // ne contient QUE des dossiers attribués à d'autres (dossierAttribueAMoi) — seul l'ASSIGNATAIRE
    // examine, depuis SA file « À examiner ». Garde serveur miroir : demande backend du même jour.
  },
  ...GROUPES_MES_EXAMENS,
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
 * Dans les cartes, « Réceptions » et « Enregistrés » (tâches du Secrétaire) s'intercalaient avant
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

/**
 * Statuts couverts par PLUSIEURS groupes à la fois, avec les libellés des groupes concernés.
 *
 * ⚠️ 2026-08-28 — sert à lever une ambiguïté de lecture signalée par le pilote : la somme des
 * tuiles ne tombe pas sur le total. Chez Président/CC, « Pré-dispatch » et « Enregistrés »
 * couvrent tous deux `PRET_DISPATCH` — ce sont deux vues de la même donnée (« lequel dispatcher ? »
 * d'un côté, le registre du Secrétaire de l'autre). Les mêmes dossiers y figurent donc deux fois,
 * quand le total, lui, compte en dossiers DISTINCTS.
 *
 * Calculé depuis la configuration plutôt qu'écrit en dur : si un groupe change de statuts, ou si un
 * troisième vient recouvrir les autres, l'explication affichée suit sans qu'on y pense.
 */
export function statutsPartages(groupes: ClassementGroupe[]): { statut: string; labels: string[] }[] {
  const parStatut = new Map<string, string[]>();
  for (const g of groupes) {
    for (const s of g.statuts) parStatut.set(s, [...(parStatut.get(s) ?? []), g.label]);
  }
  return [...parStatut.entries()]
    .filter(([, labels]) => labels.length > 1)
    .map(([statut, labels]) => ({ statut, labels }));
}
