import { HttpErrorResponse } from '@angular/common/http';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { DecisionAnormale, EtapeEvaluation, EtatDemande, EtatEvaluation, GroupeCritere, QualificationRejet, RegleCorrection, TypePieceAttributaire, TypeRecours } from '../../models';
import { messageQuorum } from '../procedure/quorum-cao';

export const LIBELLES_ETAT_EVALUATION: Readonly<Record<EtatEvaluation, string>> = {
  EN_COURS: 'En cours',
  RAPPORT_A_SIGNER: 'Rapport à signer',
  CLOSE: 'Close — rapport signé',
};

export const LIBELLES_ETAPE: Readonly<Record<EtapeEvaluation, string>> = {
  CONFORMITE: 'Examen préliminaire',
  EVALUATION: 'Montant évalué et classement',
  ANORMALES: 'Offres anormales',
  QUALIFICATION: 'Post-qualification',
  RAPPORT: 'Rapport',
};

/** Le numéro de l'étape dans le guide d'évaluation (l'étape 1 est la séance d'ouverture). */
export const NUMERO_ETAPE: Readonly<Record<EtapeEvaluation, string>> = {
  CONFORMITE: '2',
  EVALUATION: '3',
  ANORMALES: '4',
  QUALIFICATION: '5',
  RAPPORT: '',
};

export const LIBELLES_QUALIFICATION_REJET: Readonly<Record<QualificationRejet, string>> = {
  IRRECEVABLE: 'Irrecevable',
  NON_CONFORME: 'Non conforme ou irrégulière',
  INAPPROPRIEE: 'Inappropriée',
  INACCEPTABLE: 'Inacceptable',
};

/** Les définitions de l'article 1, reprises par le guide (§2.3) — aide au choix de la qualification. */
export const AIDES_QUALIFICATION_REJET: Readonly<Record<QualificationRejet, string>> = {
  IRRECEVABLE: 'Ne remplit pas les conditions de fond ou de forme de présentation (art. 43).',
  NON_CONFORME: 'Ne remplit pas une ou plusieurs conditions essentielles du DAO.',
  INAPPROPRIEE: 'Sans rapport avec le besoin de l’acheteur, assimilée à une absence d’offre.',
  INACCEPTABLE: 'Trop chère, non finançable par les crédits, ou contraire à la législation.',
};

export const LIBELLES_REGLE: Readonly<Record<RegleCorrection, string>> = {
  PU_PREVAUT: 'Le prix unitaire prévaut',
  LETTRES_PREVALENT: 'Les lettres prévalent',
  REPORT: 'Erreur de report',
  AUTRE: 'Autre correction',
};

export const LIBELLES_ANORMALE: Readonly<Record<DecisionAnormale, string>> = {
  NON_SUSPECTEE: 'Non suspectée',
  SUSPECTEE: 'Suspectée — justification attendue',
  MAINTENUE: 'Maintenue après justification',
  REJETEE: 'Rejetée',
};

export const LIBELLES_GROUPE_CRITERE: Readonly<Record<GroupeCritere, string>> = {
  JURIDIQUE: 'Capacité juridique',
  FINANCIERE: 'Capacité financière',
  TECHNIQUE: 'Capacité technique et expérience',
};

export const LIBELLES_ETAT_DEMANDE: Readonly<Record<EtatDemande, string>> = {
  EN_ATTENTE: 'En attente de réponse',
  REPONDUE: 'Répondue',
  EXPIREE: 'Délai expiré sans réponse',
};

/** « 1 700 000 Ar » ; « — » sans valeur. */
export function ariary(v: number | null | undefined): string {
  return v == null ? '—' : `${new Intl.NumberFormat('fr-FR').format(v)} Ar`;
}

/** « +12,5 % » ; « — » sans valeur. */
export function ecartPourCent(v: number | null | undefined): string {
  if (v == null) return '—';
  const t = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.abs(v));
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${t} %`;
}

/** Les numéros d'offres que le serveur range dans `details.offres` (ou les lots dans `details.lots`). */
function details(e: ApiError | HttpErrorResponse, cle: string): string {
  const api = e as Partial<ApiError>;
  const corps = ((api.raw ?? e) as HttpErrorResponse).error as { details?: Record<string, unknown> } | null;
  const v = corps?.details?.[cle];
  if (Array.isArray(v)) return v.length ? v.join(', ') : '';
  // ⚠️ R9b — une valeur simple (`details.ligne` de `CORRECTION_NON_PROPOSEE`).
  return typeof v === 'number' || typeof v === 'string' ? String(v) : '';
}

/**
 * La phrase d'un refus de l'évaluation, par code du contrat (`docs/api-endpoints.md`, § *L'évaluation des offres*). Le serveur
 * reste l'autorité : un code inconnu laisse passer son propre message.
 */
export function refusEvaluation(e: ApiError): string {
  const offres = details(e, 'offres');
  switch (codeErreur(e)) {
    case 'QUORUM_NON_ATTEINT': return messageQuorum(e);
    case 'SEANCE_NON_CLOSE': return 'L’évaluation ne s’ouvre qu’une fois le PV d’ouverture signé de tous.';
    case 'EVALUATION_DEJA_OUVERTE': return 'L’évaluation est déjà ouverte.';
    case 'DEJA_DECLARE': return 'Votre déclaration est déjà signée : elle ne se reprend pas.';
    case 'DECLARATION_MANQUANTE': return 'Signez d’abord votre déclaration d’absence de conflit d’intérêts et de confidentialité.';
    case 'MEMBRE_EN_CONFLIT': return 'Vous avez déclaré un conflit d’intérêts : vous lisez l’évaluation, mais vous ne décidez rien.';
    case 'EVALUATION_CLOSE': return 'Le rapport est produit : plus aucune décision n’est possible.';
    case 'ETAPE_ARRETEE': return 'Cette étape est arrêtée : le président doit la rouvrir, avec un motif, pour la modifier.';
    case 'ETAPE_NON_ARRETEE': return 'Cette étape n’est pas arrêtée.';
    case 'ETAPE_PRECEDENTE_OUVERTE': return 'L’étape précédente n’est pas arrêtée.';
    case 'ETAPE_INCOMPLETE': return `L’étape ne peut pas être arrêtée : ${offres ? 'offre(s) n° ' + offres + ' sans décision.' : 'une offre attend sa décision.'}`;
    case 'EGALITE_A_DEPARTAGER': return `Égalité en tête à départager${offres ? ' (offres n° ' + offres + ')' : ''} : la CAO les ordonne, avec un motif, à l’étape 3.`;
    // ⚠️ V120 (§B5) — un rapport en signature se retire (président) avant de rouvrir une étape ; signé de tous, il ne se retire plus.
    case 'RAPPORT_SIGNE': return 'Le rapport est produit : pour rouvrir une étape, le président le retire d’abord. Un rapport signé de tous ne se retire plus : l’évaluation est close.';    case 'MOTIF_OBLIGATOIRE': return 'Le motif est obligatoire.';
    case 'CLAUSE_OBLIGATOIRE': return 'La clause du DAO visée est obligatoire.';
    case 'QUALIFICATION_OBLIGATOIRE': return 'Une offre écartée doit être qualifiée (irrecevable, non conforme, inappropriée, inacceptable).';
    case 'QUESTION_OBLIGATOIRE': return 'La question est obligatoire.';
    case 'DELAI_OBLIGATOIRE': return 'La fiche ne fixe pas de délai de réponse : saisissez-le.';
    case 'ELEMENTS_OBLIGATOIRES': return 'Dites sur quels éléments porte la justification demandée.';
    case 'OFFRE_ECARTEE': return 'Cette offre est écartée.';
    case 'PRIX_LU_OBLIGATOIRE': return 'L’acte d’engagement ne porte pas de montant hors taxes : saisissez le prix lu.';
    case 'REGLE_INCONNUE':
    case 'CORRECTION_INVALIDE': return 'Une correction est incomplète : libellé, montant avant et après.';
    // ⚠️ R9b (V112) — une correction du prix unitaire ou des lettres reprend exactement la proposition du serveur.
    case 'CORRECTION_NON_PROPOSEE': return `Une correction${details(e, 'ligne') ? ' (ligne ' + details(e, 'ligne') + ')' : ''} ne reprend pas celle que le serveur propose : rouvrez le détail pour recharger les corrections proposées.`;
    case 'RABAIS_INVALIDE': return 'Le rabais est un montant hors taxes positif ou nul.';
    case 'RABAIS_CONDITIONNEL': return 'Un rabais lié à l’attribution de plusieurs lots ne s’applique pas à l’évaluation lot par lot.';
    case 'PREFERENCE_NON_PREVUE': return 'Le DAO ne prévoit pas de marge de préférence.';
    case 'CRITERE_HORS_DAO': return 'Le DAO ne porte pas de critère additionnel : aucun ne peut être ajouté (règle d’or).';
    case 'CRITERE_INVALIDE': return 'Un critère est incomplet : libellé, montant et justification.';
    case 'ORDRE_INVALIDE': return 'Le départage cite au moins deux offres évaluées du lot, chacune une fois.';
    case 'DEJA_DEMANDEE': return 'Une justification a déjà été demandée pour cette offre.';
    case 'JUSTIFICATION_NON_DEMANDEE': return 'Aucun rejet sans demande écrite : la PRMP doit d’abord demander une justification au candidat.';
    case 'DELAI_EN_COURS': return 'Le candidat peut encore répondre : la décision attend sa réponse ou la fin du délai.';
    case 'CLASSEMENT_NON_ARRETE': return 'La post-qualification commence quand l’étape 4 est arrêtée.';
    case 'CRITERES_INCOMPLETS': return 'Chaque critère se décide : satisfait ou non satisfait.';
    case 'CRITERE_INCONNU': return 'Un critère n’est pas celui du DAO.';
    case 'QUALIFICATION_INCOHERENTE': return 'Une offre qualifiée satisfait tous les critères.';
    case 'PAS_LE_TOUR_DE_CETTE_OFFRE': return 'Ce n’est pas le tour de cette offre : la post-qualification suit le classement.';
    case 'ETAPES_INCOMPLETES': return `Le rapport attend que toutes les étapes soient arrêtées${details(e, 'lots') ? ' (lot(s) ' + details(e, 'lots') + ')' : ''}.`;
    case 'RAPPORT_DEJA_PRODUIT': return 'Le rapport est déjà produit.';
    case 'RAPPORT_NON_PRODUIT': return 'Le rapport n’est pas encore produit.';
    case 'NON_SIGNATAIRE': return 'Cette personne n’est pas appelée à signer le rapport.';
    case 'DEJA_SIGNE': return 'Cette signature est déjà posée.';
    case 'MOTIF_ABSENT': return 'Le motif de l’empêchement est obligatoire.';
    case 'DECISION_INVALIDE': return 'La décision n’est pas valide.';
    case 'VERIFICATION_INCONNUE': return 'Une vérification n’est pas celle de la grille.';
    // ⚠️ Lot 3 PI, tranche PI-c (V87) — la notation technique.
    case 'ELEMENT_INCONNU': return 'Un élément noté n’est pas dans la grille de la fiche validée.';
    case 'NOTE_HORS_BAREME': return 'Une note dépasse le maximum de son élément (ou est négative).';
    case 'CONFORMITE_NON_ARRETEE': return 'La notation s’ouvre quand l’examen préliminaire du lot est arrêté par le président.';
    case 'TECHNIQUE_ARRETEE': return 'L’évaluation technique du lot est arrêtée : le président doit la rouvrir, avec un motif, pour la modifier.';
    case 'TECHNIQUE_NON_ARRETEE': return 'L’évaluation technique du lot n’est pas arrêtée.';
    case 'NOTATION_INCOMPLETE': return `L’évaluation technique ne peut pas être arrêtée : ${offres ? 'la ou les propositions n° ' + offres + ' attendent' : 'une proposition attend'} les grilles de tous les membres.`;
    case 'CATEGORIE_SANS_NOTATION_TECHNIQUE': return 'La notation technique ne concerne que les prestations intellectuelles.';
  }
  if (e.status === 403) return 'Ce geste ne vous est pas ouvert.';
  return e.message || 'Le geste n’a pas abouti.';
}

/**
 * Les recours du titre VIII. ⚠️ R9a (V111, 14/10) — leur effet **suspensif** sur la signature n'est plus fixe : l'Administrateur le
 * règle (`/api/parametres/recours-suspensifs`) ; le libellé ne le dit donc plus, l'écran l'ajoute d'après le réglage du moment
 * (`MENTION_SUSPENSIF`), et un recours déclaré porte son `bloquant` servi.
 */
export const LIBELLES_RECOURS: Readonly<Record<TypeRecours, string>> = {
  REEXAMEN: 'Demande de réexamen auprès de la PRMP (art. 79) — réponse sous 10 jours',
  REVISION_ARMP: 'Demande en révision auprès de l’ARMP (art. 80)',
  REFERE: 'Référé précontractuel (art. 78)',
};
export const MENTION_SUSPENSIF = 'suspend la signature, 20 jours au plus';
export const MENTION_NON_SUSPENSIF = 'non suspensif';

/** Les pièces de l'attributaire : fiscale et sociale (art. 20-I) ; ⚠️ R10 (V113) l'original signé de l'acte d'engagement. */
export const LIBELLES_PIECE_ATTRIBUTAIRE: Readonly<Record<TypePieceAttributaire, string>> = {
  FISCALE: 'Fiscale',
  SOCIALE: 'Sociale',
  ACTE_ENGAGEMENT_ORIGINAL: 'Original signé de l’acte d’engagement',
};
