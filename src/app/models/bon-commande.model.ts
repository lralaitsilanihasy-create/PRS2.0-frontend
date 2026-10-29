/**
 * ⚠️ Lot MS-3 (V126, 16/10 ; demande « marchés subséquents ») — **les bons de commande**, un seul module pour les deux formes (loi
 * n° 2016-055, art. 30 ; décret n° 2019-1064, art. 8, 33, 34). Contrat-cadre : rattaché à un marché subséquent attribué, son
 * titulaire est le retenu, les prix sont saisis, le cumul ne dépasse pas le montant retenu. Marché à commandes : l'attributaire,
 * les articles du besoin aux prix du bordereau scellé, le maximum annuel. Le bon est émis par la PRMP ; la première lecture par le
 * titulaire vaut accusé de réception.
 */
import type { TypeContratVigueur } from './contrat-vigueur.model';

export type EtatBonCommande = 'EMIS' | 'ANNULE' | (string & {});

export type AlerteConsommation = 'MINIMUM_NON_ATTEINT' | 'MONTANT_ESTIME_DEPASSE' | (string & {});

export interface LigneBonCommande {
  rang: number;
  idArticle: number | null;
  designation: string;
  unite: string | null;
  quantite: number;
  prixUnitaire: number;
  montant: number;
  /** Prix repris du bordereau scellé de l'offre (marché à commandes). */
  prixDuBordereau: boolean;
}

export interface BonCommande {
  id: number;
  idContrat: number;
  idDmc: number;
  lot: number;
  typeMarche: TypeContratVigueur | null;
  numero: number;
  idRemise: number | null;
  numeroRemise: number | null;
  idOffre: string | null;
  numeroOffre: number | null;
  titulaire: string | null;
  etat: EtatBonCommande;
  objet: string | null;
  lieuLivraison: string | null;
  delaiLivraison: string | null;
  observations: string | null;
  lignes: LigneBonCommande[];
  montantHt: number;
  emisLe: string;
  emisPar: string | null;
  /** Première lecture du bon par le titulaire. */
  accuseLe: string | null;
  annuleLe: string | null;
  annulePar: string | null;
  motifAnnulation: string | null;
}

/** Un marché subséquent attribué et ce que ses bons ont commandé (contrat-cadre). */
export interface SubsequentConsomme {
  idRemise: number;
  numero: number;
  objet: string | null;
  idOffre: string | null;
  titulaire: string | null;
  montantRetenu: number | null;
  commande: number;
  reste: number | null;
}

/** `GET /api/contrats-en-vigueur/{id}/bons-commande`. */
export interface Consommation {
  idContrat: number;
  typeMarche: TypeContratVigueur | null;
  /** Les bons émis du contrat, sur toute sa durée. */
  cumulHt: number;
  /** Marché à commandes : l'année contractuelle en cours, son cumul, les minimum et maximum annuels. */
  anneeDebut: string | null;
  anneeFin: string | null;
  cumulAnnee: number | null;
  minimum: number | null;
  maximum: number | null;
  resteMaximum: number | null;
  montantEstime: number | null;
  subsequents: SubsequentConsomme[];
  alertes: AlerteConsommation[];
  bons: BonCommande[];
}

/** Corps de `POST /api/contrats-en-vigueur/{id}/bons-commande` (PRMP de la fiche). */
export interface EmissionBonCommande {
  idRemise: number | null;
  objet: string | null;
  lieuLivraison: string | null;
  delaiLivraison: string | null;
  observations: string | null;
  lignes: { idArticle: number | null; designation: string | null; unite: string | null; quantite: number; prixUnitaire: number | null }[];
}
