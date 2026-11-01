/**
 * Historique complet d'un dossier (pilote, 31/10/2026 — demande `docs/demande-backend-2026-10-31-filiation-dossier.md`).
 *
 * - `GET /api/dossiers/{id}/filiation` (B1) : l'arbre des dossiers qui s'attachent les uns aux autres (versions du plan, dossier de
 *   mise en concurrence d'une ligne, dossiers de marché par lot, actes de gestion), quel que soit le point d'entrée ;
 * - `GET /api/dossiers/{id}/historique` (B2) : tout ce qui s'est passé sur UN dossier, trié par date.
 */

/** Nature du lien d'un nœud avec son parent. Le serveur peut en servir d'autres : le front affiche alors le code. */
export type LienFiliation = 'RACINE' | 'VERSION_SUIVANTE' | 'MISE_EN_CONCURRENCE' | 'MARCHE' | 'MODIFICATION';

export interface NoeudFiliation {
  idDossier: number | null;
  refeDossier: string | null;
  idTypeDossier: string | null;
  idSousType: string | null;
  statut: string | null;
  dateRef: string | null;
  lien: LienFiliation | string;
  lot: number | null;
  ligne: { idDetail: number; objet: string | null } | null;
  /** Dossier hors du périmètre du connecté : seuls `lien` et `enfants` sont servis. */
  masque: boolean;
  enfants: NoeudFiliation[];
}

export interface FiliationDossier {
  idDossierDemande: number;
  racine: NoeudFiliation;
}

/** Type d'un élément de l'historique (B2). Le serveur peut en servir d'autres : le front affiche alors le code. */
export type TypeHistorique =
  | 'RECEPTION'
  | 'DISPATCH'
  | 'EXAMEN'
  | 'PV'
  | 'LETTRE_RENVOI'
  | 'TRANSMISSION_SIGMP'
  | 'SUSPENSION'
  | 'RETRAIT'
  | 'VERSION_ARCHIVEE'
  | 'ACTE_GESTION'
  | 'PUBLICATION_AGPM'
  | 'PUBLICATION_AVIS'
  | 'SEANCE'
  | 'EVALUATION'
  | 'ATTRIBUTION'
  | 'CONTRAT'
  | 'BON_COMMANDE'
  | 'RECEPTION_COMMANDE';

export interface EvenementHistorique {
  type: TypeHistorique | string;
  /** Date et heure (`LocalDateTime` sérialisé). */
  date: string | null;
  /** Identifiant de l'objet du type (PV, lettre, dossier de marché pour ATTRIBUTION, dossier DGC pour ACTE_GESTION…). */
  id: number | null;
  reference: string | null;
  statut: string | null;
  avis: string | null;
  /** Nul pour la PRMP et l'UGPM. */
  acteur: string | null;
  detail: string | null;
  lot: number | null;
  /** Numéro de version (VERSION_ARCHIVEE). */
  numero: number | null;
}

/**
 * ⚠️ 01/11 (pilote, demande « essentiel-dossier », B1 — PRS20 0146646a) — `GET /api/dossiers/{id}/essentiel` : ce qu'est devenu le
 * dossier, en quatre blocs, chacun `null` tant qu'il n'existe pas (un plan n'a que l'avis). Pour la PRMP et l'UGPM, l'avis vient du
 * dernier PV SIGNÉ ; aucun nom de contrôleur n'est servi.
 */
export interface EssentielDossier {
  avis: { code: string; libelle: string | null; refePv: string | null; definitif: boolean; idPv: number | null } | null;
  /** Un élément par lot attribué et non retiré ; l'attributaire est l'offre attribuée, à défaut le titulaire de rang 1. */
  attributions: { lot: number | null; attributaire: string | null; numeroOffre: number | null; montant: number | null; idDossierMarche: number | null }[] | null;
  /** Celui du lot (le premier lot pour une mise en concurrence à plusieurs lots) ; `signeLe` = signature du marché, à défaut prise d'effet. */
  contrat: { forme: string | null; libelleForme: string | null; signeLe: string | null; finLe: string | null } | null;
  /** `null` sans bon de commande ni acte de gestion. */
  suites: { bonsCommande: number; dernierBon: { numero: number | null; date: string | null } | null; actesGestion: number } | null;
}
