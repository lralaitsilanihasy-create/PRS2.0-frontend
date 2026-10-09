/**
 * ⚠️ Manuel de contrôle a priori, tranche M5a (V98, 09/10) — les **actes de gestion contractuelle** d'un marché (famille `DGC`) :
 * avenant, résiliation, indemnité, remise de pénalités, sursis d'exécution. Un acte se dépose **depuis le marché** contrôlé
 * favorablement (`POST /api/dossiers/{idMarche}/actes-gestion`) et naît en brouillon ; il suit ensuite le circuit ordinaire.
 */
export type SousTypeActe = 'AVN' | 'DR' | 'INDEMN' | 'PENAL' | 'SURSIS';

/** La catégorie d'un marché, lue (attribution en ligne, fiche) ou déclarée. */
export type CategorieMarche = 'FOURNITURES_SERVICES' | 'TRAVAUX' | 'PRESTATIONS_INTELLECTUELLES';

/**
 * Corps de `POST /api/dossiers/{idMarche}/actes-gestion` et de `PUT /api/actes-gestion/{idDossier}`. `sousType` est ignoré au `PUT`.
 * `montantHt` : l'avenant, **HT**, hausse positive, baisse négative (ignoré hors avenant). `montantInitialHt` et `categorie` ne servent
 * que si le serveur ne les connaît pas ; réceptions et solde : les faits qui gardent l'avenant. Le `PUT` remplace toutes les déclarations.
 */
export interface DemandeActe {
  sousType: SousTypeActe;
  montantHt: number | null;
  montantInitialHt: number | null;
  categorie: CategorieMarche | null;
  /** `AAAA-MM-JJ`. */
  dateReceptionProvisoire: string | null;
  dateReceptionDefinitive: string | null;
  dateSolde: string | null;
}

/** Un acte : son dossier DGC (statut, référence, dernier avis signé) et ce qu'il déclare. */
export interface ActeGestion {
  idActe: number;
  /** Le dossier DGC de l'acte. */
  idDossier: number;
  idDossierMarche: number;
  sousType: SousTypeActe;
  /** Le rang de l'avenant (1, 2…) ; nul hors avenant. La référence le porte : « …/AVN2/… ». */
  rang: number | null;
  montantHt: number | null;
  montantInitialHt: number | null;
  categorie: CategorieMarche | null;
  dateReceptionProvisoire: string | null;
  dateReceptionDefinitive: string | null;
  dateSolde: string | null;
  statutDossier: string | null;
  refeDossier: string | null;
  /** Le dernier PV signé (`FAV`, `FAVR`, `DEF`…), nul avant. */
  avis: string | null;
  /** L'avenant compte dans le cumul : soumis, ni retiré, dernier avis autre que `DEF`. */
  compteDansLeCumul: boolean;
  creeLe: string | null;
}

/** `GET /api/dossiers/{idMarche}/actes-gestion` — le marché, ses faits retenus et ses actes. */
export interface MarcheActes {
  idDossierMarche: number;
  sousTypeMarche: string | null;
  refeDossier: string | null;
  /** Le dernier PV signé du marché : un acte ne se dépose que sur `FAV` ou `FAVR`. */
  avisMarche: string | null;
  montantInitialHt: number | null;
  sourceMontantInitial: 'ATTRIBUTION' | 'DECLARE' | null;
  categorie: CategorieMarche | null;
  sourceCategorie: 'FICHE' | 'DECLARE' | null;
  dateReceptionProvisoire: string | null;
  dateReceptionDefinitive: string | null;
  dateSolde: string | null;
  /** Les avenants comptés, HT. */
  cumulAvenantsHt: number | null;
  /** Le tiers du montant initial HT ; nul sans montant initial. */
  plafondAvenantsHt: number | null;
  rangAvenantSuivant: number;
  actes: ActeGestion[];
}
