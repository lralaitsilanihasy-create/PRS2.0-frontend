import { Capability } from '../../core/auth/permissions';
import { PvSignataireRole, Role, StatutPv } from '../../models';

/**
 * Helpers purs du circuit de contrôle (§2 et §3 de regles-gestion.md).
 * Aucune dépendance Angular : utilisables par les composants et les tests.
 *
 * Reflet UX du workflow ; le backend reste l'autorité sur les transitions (409).
 */

/** Étape ordonnée du circuit (pour la timeline). */
export interface CircuitEtape {
  key: string;
  label: string;
}

/** Les 7 étapes visibles du circuit, dans l'ordre (PRET_DISPATCH = statut interne rattaché à Dispatch). */
export const CIRCUIT_ETAPES: readonly CircuitEtape[] = [
  { key: 'RECEPTION', label: 'Réception' },
  { key: 'DISPATCH', label: 'Dispatch' },
  { key: 'EXAMEN', label: 'Examen' },
  { key: 'PROJET_PV', label: 'Projet PV' },
  { key: 'PV_SIGNE', label: 'PV signé' },
  { key: 'VERIFICATION', label: 'Vérification' },
  { key: 'CLOTURE', label: 'Clôture' },
];

/**
 * Index de l'étape courante (parmi les 7) d'après le statut du dossier (best effort).
 * `-1` = hors flux (dossier retiré). Les valeurs non reconnues retombent sur la réception.
 */
export function etapeIndexForDossier(statut?: string): number {
  switch (statut) {
    case 'BROUILLON':
    case 'SOUMIS':
    case 'RECU':
      return 0; // Réception
    case 'PRET_DISPATCH':
      return 1; // Dispatch (en attente)
    case 'DISPATCHE':
    case 'DISPATCH':
    case 'EN_DISPATCH':
    case 'EN_EXAMEN':
    case 'EXAMEN':
      return 2; // Examen
    case 'EXAMINE':
    case 'PROJET_PV':
    case 'EN_PV':
      return 3; // Projet PV (examen fait)
    case 'PV_SIGNE':
    case 'SIGNE':
      return 4; // PV signé
    case 'VERIFICATION':
    case 'EN_VERIFICATION':
    case 'EN_ATTENTE_DECISION_PRMP':
      return 5; // Vérification
    case 'CLOTURE':
      return 6; // Clôture
    case 'RETIRE':
      return -1; // hors flux
    default:
      return 0;
  }
}

/** Libellés lisibles des statuts du PV. */
export const PV_STATUT_LABELS: Record<StatutPv, string> = {
  BROUILLON: 'Brouillon',
  PROJET_SOUMIS: 'Projet soumis',
  EN_RECTIFICATION: 'En rectification',
  PROJET_ACCEPTE: 'Projet accepté',
  SIGNE: 'Signé',
};

/** Libellés lisibles des statuts de dossier (affichage ; les codes restent l'autorité). */
export const DOSSIER_STATUT_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  SOUMIS: 'Soumis',
  PRET_DISPATCH: 'Prêt à dispatcher',
  DISPATCHE: 'Dispatché',
  EN_EXAMEN: 'En examen',
  EXAMINE: 'Examiné',
  PV_SIGNE: 'PV signé',
  EN_VERIFICATION: 'En vérification',
  EN_ATTENTE_DECISION_PRMP: 'En attente PRMP',
  CLOTURE: 'Clôturé',
  RETIRE: 'Retiré',
};

/** Libellé d'affichage d'un statut de dossier (code brut si inconnu / hors dossier). */
export function statutDossierLabel(statut?: string): string {
  if (!statut) return '';
  return DOSSIER_STATUT_LABELS[statut] ?? statut;
}

/** Libellés lisibles des statuts de demande de retrait. */
export const DEMANDE_RETRAIT_STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  ACCEPTEE: 'Acceptée',
  REFUSEE: 'Refusée',
};

/** Libellé d'affichage d'un statut de demande de retrait (code brut si inconnu). */
export function statutDemandeRetraitLabel(statut?: string): string {
  if (!statut) return '';
  return DEMANDE_RETRAIT_STATUT_LABELS[statut] ?? statut;
}

/** Niveau de gravité visuelle d'un statut, pour le badge. */
export type Severity = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** Associe un statut (dossier, PV, demande, avis…) à un niveau visuel. */
export function statutSeverity(statut: string): Severity {
  switch (statut) {
    case 'CLOTURE':
    case 'SIGNE':
    case 'PV_SIGNE':
    case 'PROJET_ACCEPTE':
    case 'APPROUVE':
    case 'ACCEPTEE':
    case 'PUBLIE':
    case 'FAV':
      return 'success';
    case 'RETIRE':
    case 'REJETE':
    case 'REFUSEE':
    case 'DEFAVORABLE':
      return 'danger';
    case 'EN_RECTIFICATION':
    case 'EN_ATTENTE':
    case 'EN_ATTENTE_DECISION_PRMP':
    case 'FAVORABLE_RESERVES':
      return 'warning';
    case 'PRET_DISPATCH':
    case 'PROJET_SOUMIS':
    case 'EN_EXAMEN':
    case 'EXAMINE':
    case 'SOUMIS':
    case 'DISPATCHE':
      return 'info';
    default:
      return 'neutral';
  }
}

/** Convertit le profil courant en rôle signataire attendu par l'API du PV. */
export function pvSignataireRole(role: Role | null): PvSignataireRole | null {
  switch (role) {
    case 'MEMBRE':
      return 'MEMBRE';
    case 'PRESIDENT':
      return 'PRESIDENT';
    case 'CHEF_COMMISSION':
      return 'CC';
    default:
      return null;
  }
}

// --- Disponibilité des actions selon l'état du PV (cf. §3.3 du plan) ---

export function peutSoumettre(statut: StatutPv): boolean {
  return statut === 'BROUILLON' || statut === 'EN_RECTIFICATION';
}
export function peutRetourner(statut: StatutPv): boolean {
  return statut === 'PROJET_SOUMIS';
}
export function peutAccepter(statut: StatutPv): boolean {
  return statut === 'PROJET_SOUMIS';
}
export function peutSigner(statut: StatutPv): boolean {
  return statut === 'PROJET_ACCEPTE';
}

// --- Étape attendue d'un dossier selon son statut (orientation pour le pipeline) ---

/** Étape attendue d'un dossier + qui peut l'exécuter + capacité requise. */
export interface EtapeInfo {
  cle: 'BROUILLON' | 'RECEPTION' | 'DISPATCH' | 'EXAMEN' | 'PV' | 'VERIFICATION' | 'CLOTURE' | 'RETIRE' | 'INCONNU';
  label: string;
  acteurs: string;
  /** Capacité requise pour agir à cette étape (null si automatique/terminé). */
  capability: Capability | null;
}

/**
 * Étape suivante attendue d'après le statut du dossier (best effort ; le backend tranche).
 * Aligné §2/§3 et sur les préconditions 409 du contrat. Le statut étant « gros grain »,
 * l'état précis du PV/vérification vit sur pv-examens/verifications.
 */
export function etapeSuivante(statut?: string): EtapeInfo {
  switch (statut) {
    case 'BROUILLON':
      return { cle: 'BROUILLON', label: 'Brouillon — à soumettre', acteurs: 'PRMP', capability: null };
    case 'SOUMIS':
      return {
        cle: 'RECEPTION',
        label: 'Réception / complétude',
        acteurs: 'Secrétaire (ou CC/Président par délégation)',
        capability: 'RECEPTION_WRITE',
      };
    case 'PRET_DISPATCH':
      return {
        cle: 'DISPATCH',
        label: 'Dispatch',
        acteurs: 'Président / Chef de commission',
        capability: 'DISPATCH_WRITE',
      };
    case 'DISPATCH':
    case 'EN_DISPATCH':
    case 'DISPATCHE':
    case 'EN_EXAMEN':
    case 'EXAMEN':
      return { cle: 'EXAMEN', label: 'Examen & projet de PV', acteurs: 'Membre', capability: 'EXAMEN_WRITE' };
    case 'EXAMINE':
    case 'EN_PV':
    case 'PROJET_PV':
      return {
        cle: 'PV',
        label: 'Projet de PV (navette / signature)',
        acteurs: 'Membre → CC/Président',
        capability: 'PV_SOUMETTRE',
      };
    case 'PV_SIGNE':
    case 'SIGNE':
    case 'EN_VERIFICATION':
    case 'VERIFICATION':
      return {
        cle: 'VERIFICATION',
        label: 'Vérification de la levée',
        acteurs: 'Vérificateur (ou CC/Président par délégation)',
        capability: 'VERIFICATION_WRITE',
      };
    case 'CLOTURE':
      return { cle: 'CLOTURE', label: 'Dossier clôturé', acteurs: '—', capability: null };
    case 'RETIRE':
      return { cle: 'RETIRE', label: 'Dossier retiré', acteurs: '—', capability: null };
    default:
      return { cle: 'INCONNU', label: 'Étape indéterminée', acteurs: '—', capability: null };
  }
}
