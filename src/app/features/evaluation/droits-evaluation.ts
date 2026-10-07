import { EtapeEvaluation, Evaluation, LotEvaluation } from '../../models';

/** L'espace d'où l'on regarde : celui des membres de la CAO (`/cao`), ou la coquille interne (responsable, PRMP, UGPM). */
export type EspaceEvaluation = 'cao' | 'interne';

export interface DroitsEvaluation {
  /** Membre de la commission (espace `/cao`, présent dans les déclarations). */
  membre: boolean;
  /** Sa déclaration est signée ; `conflit` : il y a déclaré un conflit d'intérêts. */
  declaree: boolean;
  conflit: boolean;
  /** Décide (membre déclaré sans conflit, évaluation en cours). */
  decider: boolean;
  /** Arrête et rouvre les étapes (président déclaré sans conflit, évaluation en cours). */
  president: boolean;
  /** Demande des précisions et des justifications aux candidats. */
  prmp: boolean;
  /** Ouvre l'évaluation et produit le rapport. */
  responsable: boolean;
}

/**
 * Ce que l'interface **propose** — jamais une garde : le serveur refuse ce qui n'est pas permis (contrat, tranche 1a), et
 * l'écran nomme le refus. Le responsable n'est pas un rôle de session mais une identité ; comme pour la séance, la coquille
 * interne le suppose hors PRMP et UGPM, et le serveur tranche.
 */
export function droitsEvaluation(ev: Evaluation | null, espace: EspaceEvaluation, moi: string | null, role: string | null): DroitsEvaluation {
  const maDeclaration = espace === 'cao' && ev ? ev.declarations.find((d) => d.membre === moi) ?? null : null;
  const membre = !!maDeclaration;
  const declaree = !!maDeclaration?.signeeLe;
  const conflit = !!maDeclaration?.conflit;
  const enCours = ev?.etat === 'EN_COURS';
  const decider = membre && declaree && !conflit && enCours;
  return {
    membre,
    declaree,
    conflit,
    decider,
    president: decider && !!maDeclaration?.president,
    prmp: espace === 'interne' && role === 'PRMP' && enCours,
    responsable: espace === 'interne' && !['PRMP', 'UGPM'].includes(role ?? ''),
  };
}

/** L'étape est-elle arrêtée pour ce lot ? Une étape arrêtée fige ses décisions. */
export function etapeArretee(lot: LotEvaluation, etape: EtapeEvaluation): boolean {
  return lot.etapesArretees.some((a) => a.etape === etape);
}

/** L'étape est-elle atteinte (l'étape courante du lot, ou une étape déjà arrêtée) ? */
export function etapeAtteinte(lot: LotEvaluation, etape: EtapeEvaluation): boolean {
  const ordre: EtapeEvaluation[] = ['CONFORMITE', 'EVALUATION', 'ANORMALES', 'QUALIFICATION', 'RAPPORT'];
  return ordre.indexOf(etape) <= ordre.indexOf(lot.etape);
}
