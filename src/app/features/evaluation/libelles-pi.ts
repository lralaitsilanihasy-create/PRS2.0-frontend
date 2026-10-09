import { HttpErrorResponse } from '@angular/common/http';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { CodeMethodePi, StatutFinancier } from '../../models';
import { refusEvaluation } from './libelles-evaluation';

export const LIBELLES_METHODE_PI: Readonly<Record<CodeMethodePi, string>> = {
  QUALITE_COUT: 'Qualité technique et coût',
  BUDGET: 'Budget prédéterminé',
  MOINDRE_COUT: 'Moindre coût',
  QUALITE_TECHNIQUE: 'Qualité technique exclusivement',
  QUALIFICATION: 'Qualification du consultant',
};

export const LIBELLES_STATUT_FINANCIER: Readonly<Record<StatutFinancier, string>> = {
  NON_OUVERTE: 'Enveloppe non ouverte',
  A_EVALUER: 'À évaluer',
  EVALUEE: 'Évaluée',
  ECARTEE: 'Écartée (refus d’une correction)',
  HORS_BUDGET: 'Hors budget',
};

/** Les méthodes où la seule proposition du premier rang technique ouvre sa financière, puis se négocie (art. 42-III). */
export function methodeAuPremierRang(code: CodeMethodePi | null | undefined): boolean {
  return code === 'QUALITE_TECHNIQUE' || code === 'QUALIFICATION';
}

function liste(e: ApiError | HttpErrorResponse, cle: string): string {
  const v = corpsErreur<{ details?: Record<string, unknown> }>(e)?.details?.[cle];
  return Array.isArray(v) && v.length ? v.join(', ') : typeof v === 'number' || typeof v === 'string' ? String(v) : '';
}

/**
 * La phrase d'un refus de l'évaluation financière, du classement, de la négociation et des séances complémentaires (lot 3 PI, PI-d2a —
 * V89). Les codes propres aux prestations intellectuelles d'abord ; le reste suit le répertoire de l'évaluation.
 */
export function refusPi(e: ApiError): string {
  const offres = liste(e, 'offres');
  switch (codeErreur(e)) {
    case 'REMBOURSABLES_INVALIDES': return 'Les dépenses remboursables vont de 0 au prix corrigé.';
    case 'FINANCIERE_NON_OUVERTE': {
      const n = liste(e, 'numero');
      return `L’enveloppe financière${n ? ' de la proposition n° ' + n : ''} n’est pas ouverte : le responsable ouvre une séance complémentaire pour elle.`;
    }
    case 'CLASSEMENT_ARRETE': return 'Le classement du lot est arrêté : le président doit le rouvrir, avec un motif, pour le modifier.';
    case 'CLASSEMENT_NON_ARRETE': return 'Le classement du lot n’est pas arrêté par le président.';
    case 'NEGOCIATION_CONCLUE': return 'La négociation du lot est conclue : le classement et les montants ne bougent plus.';
    case 'NEGOCIATION_ENGAGEE': return 'Une négociation est engagée sur ce lot : le classement ne se rouvre plus.';
    case 'SEANCE_FINANCIERE_NON_OUVERTE': return 'La seconde séance n’a pas ouvert les enveloppes financières.';
    case 'EVALUATION_FINANCIERE_INCOMPLETE': return `Le classement ne peut pas être arrêté : ${offres ? 'la ou les propositions n° ' + offres + ' attendent' : 'une proposition attend'} leur évaluation financière.`;
    case 'POIDS_INVALIDES': return 'Les poids technique et financier de la fiche (B06-CS-02, B06-CS-03) ne totalisent ni 1 ni 100 : corrigez la fiche.';
    case 'BUDGET_DISPONIBLE_ABSENT': return 'La fiche ne porte pas le budget disponible (B05-PF-13) qu’exige la méthode du budget prédéterminé.';
    case 'EGALITE_NON_DEPARTAGEE': return `Égalité à départager${offres ? ' (propositions n° ' + offres + ')' : ''} : la commission les ordonne, avec un motif, avant l’arrêt.`;
    case 'AUCUNE_PROPOSITION_CLASSEE': return 'Aucune proposition n’est classée : le lot ne peut pas être arrêté.';
    case 'NEGOCIATION_EN_COURS': return 'Une négociation est déjà en cours sur ce lot.';
    case 'AUCUN_CANDIDAT_A_NEGOCIER': return 'Aucun candidat ne reste à négocier : le lot va à l’infructuosité.';
    case 'FICHIER_VIDE': return 'Le fichier est vide.';
    case 'NEGOCIATION_CLOSE': return 'Cette négociation est conclue.';
    case 'RESULTAT_INVALIDE': return 'Le résultat est « réussie » ou « échouée ».';
    case 'DATE_OBLIGATOIRE': return 'La date de la négociation est obligatoire.';
    case 'PV_OBLIGATOIRE': return 'Le texte du procès-verbal de négociation est obligatoire.';
    case 'MONTANT_NON_EVALUE': return 'La réussite exige l’évaluation financière de la proposition, non écartée.';
    case 'SEANCE_FINANCIERE_EN_COURS': return 'Une séance financière est déjà en cours.';
    case 'COMPLEMENTAIRE_SANS_OBJET': return 'Aucune enveloppe n’attend une séance complémentaire.';
    case 'LOT_OBLIGATOIRE': return 'Précisez le lot.';
  }
  return refusEvaluation(e);
}
