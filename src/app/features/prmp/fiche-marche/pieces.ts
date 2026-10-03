import { PieceExigee } from '../../../models';

/**
 * ⚠️ Lot 4 du chantier b (03/10) — les pièces de l'offre exigées : l'**aperçu** de la ligne que la clause 6.2 du DPAO
 * imprimera, telle que le serveur l'imprime (`demande-backend-2026-10-03-pieces-offre-travaux` §B2, livrée en V61 à la
 * lettre des exemples, « d'un mois » compris). C'est le serveur qui imprime : si sa forme change, c'est ici qu'on s'aligne.
 */

const nonVide = (s: string | null | undefined): string | null => (s?.trim() ? s.trim() : null);

/**
 * « - 01 : Carte professionnelle 2026, copie légalisée par le centre fiscal, datée de moins de 3 mois » ·
 * « - Extrait du Registre de Commerce, photocopie certifiée » · « - 09 : Planning général, selon le modèle : annexe 5 ».
 */
export function lignePiece(p: PieceExigee): string {
  const numero = nonVide(p.numero);
  const morceaux = [
    nonVide(p.libelle) ?? '………',
    nonVide(p.forme),
    p.ancienneteMaxMois != null ? (p.ancienneteMaxMois === 1 ? "datée de moins d'un mois" : `datée de moins de ${p.ancienneteMaxMois} mois`) : null,
    p.parLot ? 'une par lot' : null,
    nonVide(p.modele) ? `selon le modèle : ${nonVide(p.modele)}` : null,
  ].filter(Boolean);
  return `- ${numero ? numero + ' : ' : ''}${morceaux.join(', ')}`;
}

/**
 * Les six pièces administratives du **document type** (DPAO-T, clause 6.2, 2°), proposées en un clic : la liste que
 * `B03-CQ-01` porte en texte par défaut, ici découpée pièce par pièce, avec ses formes et ses anciennetés. Les libellés
 * sont ceux du document type, à l'orthographe près (« Etat 211 bis », « certificat de non faillite datée »).
 */
export const PIECES_ADMINISTRATIVES_DOCUMENT_TYPE: PieceExigee[] = [
  { rubrique: 'ADMINISTRATIVE', libelle: 'Carte professionnelle de l’année en cours', forme: 'photocopie certifiée' },
  { rubrique: 'ADMINISTRATIVE', libelle: 'État 211 bis', forme: 'photocopie certifiée', ancienneteMaxMois: 3 },
  { rubrique: 'ADMINISTRATIVE', libelle: 'Extrait du Registre de Commerce', forme: 'photocopie certifiée' },
  { rubrique: 'ADMINISTRATIVE', libelle: 'Certificat de non-faillite', ancienneteMaxMois: 2 },
  { rubrique: 'ADMINISTRATIVE', libelle: 'Numéro d’Identification Fiscale (NIF)', forme: 'photocopie certifiée' },
  { rubrique: 'ADMINISTRATIVE', libelle: 'Carte statistique', forme: 'photocopie certifiée' },
];
