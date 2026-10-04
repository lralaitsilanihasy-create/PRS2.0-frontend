import { dateFr } from '../../core/interim/interim-libelles';
import { EtatProcedureEnLigne, ExclusionArmp, StatutVerificationNif, TypePieceEntreprise } from '../../models';

/**
 * Soumission en ligne, lot 1 (04/10) — libellés et formats de l'espace candidat, fichier UNIQUE : le serveur ne
 * sert que des codes, l'écran du candidat comme celui de l'Administrateur passent par ici.
 */

export const LIBELLES_ETAT_PROCEDURE: Readonly<Record<EtatProcedureEnLigne, string>> = {
  A_VENIR: 'À venir',
  OUVERTE: 'Ouverte',
  CLOSE: 'Close',
};

export const LIBELLES_STATUT_NIF: Readonly<Record<StatutVerificationNif, string>> = {
  VERIFIE_DGI: 'NIF vérifié auprès de la DGI',
  VERIFIE_SUR_PIECES: 'NIF vérifié sur pièces',
  INCONNU_DGI: 'NIF inconnu de la DGI',
  REFUSE_SUR_PIECES: 'Pièces refusées',
  NON_VERIFIE: 'Non vérifié',
};

/** Ce que le statut veut dire pour le candidat — la vérification ne bloque jamais un dépôt (pilote, Q2). */
export const EXPLICATIONS_STATUT_NIF: Readonly<Record<StatutVerificationNif, string>> = {
  VERIFIE_DGI: 'Le service des impôts a reconnu ce NIF.',
  VERIFIE_SUR_PIECES: 'L’Administrateur a rapproché votre NIF de la carte fiscale téléversée.',
  INCONNU_DGI: 'Le service des impôts ne connaît pas ce NIF : vérifiez votre saisie, ou téléversez votre carte fiscale pour une vérification sur pièces.',
  REFUSE_SUR_PIECES: 'Les pièces téléversées ne permettent pas de vérifier ce NIF : voyez le motif, corrigez, et téléversez de nouveau.',
  NON_VERIFIE: 'Pas encore vérifié. Téléversez votre carte fiscale : l’Administrateur la rapproche de votre NIF. Cela ne bloque aucun dépôt ; la commission lit ce statut à l’ouverture des plis.',
};

export const LIBELLES_TYPE_PIECE: Readonly<Record<TypePieceEntreprise, string>> = {
  CARTE_FISCALE: 'Carte fiscale',
  STATUTS: 'Statuts',
  POUVOIR: 'Pouvoir du signataire',
  AUTRE: 'Autre pièce',
};

export const TYPES_PIECE_ENTREPRISE: readonly TypePieceEntreprise[] = ['CARTE_FISCALE', 'STATUTS', 'POUVOIR', 'AUTRE'];

/** « 04/10/2026 à 09:30 » pour un `AAAA-MM-JJTHH:MM` ; la date seule sinon. */
export function dateHeureFr(iso: string | null | undefined): string {
  if (!iso) return '';
  const [jour, heure] = iso.split('T');
  const h = heure?.slice(0, 5);
  return h ? `${dateFr(jour)} à ${h}` : dateFr(jour);
}

/** Taille lisible d'un fichier : « 820 Ko », « 1,2 Mo ». */
export function tailleLisible(octets: number | null | undefined): string {
  if (octets == null) return '';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

/**
 * Le message de l'exclusion, dans les termes arrêtés par le pilote (plan du 04/10, Q2) : au dépôt, le serveur le sert
 * tel quel ; ici il est **composé** pour le signalement qui précède (déclaration de l'entreprise, écran de
 * l'Administrateur), afin que le candidat lise la même phrase du premier au dernier écran.
 */
export function messageExclusion(e: Pick<ExclusionArmp, 'nif' | 'referenceDecision' | 'dateDebut' | 'dateFin'>): string {
  const fin = e.dateFin ? `, jusqu’au ${dateFr(e.dateFin)}` : ', sans date de fin';
  return (
    `Votre entreprise (NIF ${e.nif}) est exclue des marchés publics par la décision de l’ARMP ${e.referenceDecision} ` +
    `du ${dateFr(e.dateDebut)}${fin}. Vous ne pouvez pas déposer d’offre pendant cette période.`
  );
}
