import { forkJoin, map, Observable } from 'rxjs';

import { Dossier } from '../../models';
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
 * Groupes du circuit (Président / CC) : réceptions (délégation Secrétaire), pré-dispatch (en attente)
 * et dispatch (dispatché — avec « Examiner » par délégation Membre, A_REEXAMINER inclus).
 */
export const CIRCUIT_GROUPES: ClassementGroupe[] = [
  GROUPE_RECEPTIONS,
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
