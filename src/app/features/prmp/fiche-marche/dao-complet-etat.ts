import { DaoCompletFile } from '../../../models';

/**
 * ⚠️ 28/10 (demande « dao-complet-en-file », V144) — l'état du DAO complet en une phrase, pour l'étape « Validation », l'étape
 * « Documents » et le message de la validation. `null` quand il n'y a rien à dire : pas de version validée, ou DAO complet prêt (il est
 * alors dans la liste des documents).
 */
export interface PhraseDaoComplet {
  texte: string;
  /** `info` : il viendra ; `alerte` : il ne viendra pas sans intervention. */
  ton: 'info' | 'alerte';
}

export function phraseDaoComplet(d: DaoCompletFile | null | undefined): PhraseDaoComplet | null {
  if (!d) return null;
  const motif = d.motif?.trim() ? ` (${d.motif.trim().replace(/[.\s]+$/, '')})` : '';
  switch (d.etat) {
    case 'EN_FILE':
      return motif
        ? { ton: 'info', texte: `Le DAO complet n’a pas pu être assemblé${motif} : un nouvel essai est prévu${rangDans(d.rang)}. Vous serez prévenu quand il sera prêt.` }
        : { ton: 'info', texte: `Le DAO complet est en préparation${rangDans(d.rang)}. Vous serez prévenu quand il sera prêt.` };
    case 'EN_COURS':
      return { ton: 'info', texte: 'Le DAO complet est en cours d’assemblage par Word : une à deux minutes. Vous serez prévenu quand il sera prêt.' };
    case 'ECHEC':
      return {
        ton: 'alerte',
        texte: `Le DAO complet n’a pas pu être assemblé après trois essais${motif}. L’Administrateur est prévenu ; les documents séparés restent valables, et l’impression de l’avis relancera l’assemblage.`,
      };
    case 'SANS_WORD':
      return { ton: 'info', texte: 'Ce serveur n’assemble pas le DAO complet : les documents séparés font foi.' };
    default:
      return null;
  }
}

/** Vrai tant que le DAO complet est attendu : l'écran se relit pour suivre la file. */
export function daoCompletEnPreparation(d: DaoCompletFile | null | undefined): boolean {
  return d?.etat === 'EN_FILE' || d?.etat === 'EN_COURS';
}

/** « — n° 3 dans la file », vide sans rang. */
export function rangDans(rang: number | null | undefined): string {
  return rang != null ? ` — n° ${rang} dans la file` : '';
}
