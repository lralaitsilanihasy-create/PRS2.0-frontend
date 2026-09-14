/**
 * Documents officiels du dossier de planification — plan de passation (PPM), fiche de présentation,
 * projet d'AGPM : colonnes du PDF, formats d'affichage et forme des ANNOTATIONS.
 *
 * ⚠️ Décision des chefs (2026-09-14, refonte ergonomique, lot 1) : ces documents s'affichent tels
 * que dans le PDF officiel. Ce que l'application y ajoute (état d'examen, versionnement, statut du
 * marché, observations) est une annotation posée par-dessus ou en marge, masquable — jamais une
 * colonne. Styles : `styles/_document-officiel.scss`.
 *
 * Fonctions pures, sans Angular : testables à froid.
 */

/** Clé d'une des 13 colonnes du PPM officiel (sert aussi à désigner une cellule observée). */
export type ChampPpmOfficiel =
  | 'nature'
  | 'objet'
  | 'montEstim'
  | 'nouvMontEstim'
  | 'mode'
  | 'financement'
  | 'soa'
  | 'compte'
  | 'montBenef'
  | 'nouvMontBenef'
  | 'lancement'
  | 'ouverture'
  | 'attribution';

export interface ColonnePpmOfficielle {
  champ: ChampPpmOfficiel;
  /** Intitulé de l'en-tête, tel qu'imprimé sur le PDF. */
  libelle: string;
  /** Largeur en % de la table (somme = 100). */
  largeur: number;
  /** Colonne du groupe « Informations sur le Bénéficiaire » (une valeur par bénéficiaire). */
  beneficiaire?: boolean;
}

/**
 * Les 13 colonnes du PDF officiel, dans son ordre et à ses largeurs (6/18/8/8/8/5/8/5/8/8/6/6/6 %).
 *
 * ⚠️ 2026-09-14 (décision des chefs) — plus de colonne « STATUT DU MARCHÉ » : ajoutée à la grille
 * sur demande pilote du 2026-09-09, elle modifiait le document officiel. Le statut s'affiche
 * désormais en annotation dans la marge droite de la ligne (`PpmMarchesTable`).
 */
export const COLONNES_PPM_OFFICIEL: readonly ColonnePpmOfficielle[] = [
  { champ: 'nature', libelle: 'NATURE', largeur: 6 },
  { champ: 'objet', libelle: 'OBJET', largeur: 18 },
  { champ: 'montEstim', libelle: 'MONTANT ESTIMATIF INITIAL', largeur: 8 },
  { champ: 'nouvMontEstim', libelle: 'NOUVEAU MONTANT ESTIMATIF', largeur: 8 },
  { champ: 'mode', libelle: 'MODE DE PASSATION', largeur: 8 },
  { champ: 'financement', libelle: 'FINANCEMENT', largeur: 5 },
  { champ: 'soa', libelle: 'SERVICE BENEFICIAIRE', largeur: 8, beneficiaire: true },
  { champ: 'compte', libelle: 'COMPTE', largeur: 5, beneficiaire: true },
  { champ: 'montBenef', libelle: 'MONTANT ESTIMATIF PAR BENEFICIAIRE', largeur: 8, beneficiaire: true },
  { champ: 'nouvMontBenef', libelle: 'NOUVEAU MONTANT ESTIMATIF PAR BENEFICIAIRE', largeur: 8, beneficiaire: true },
  { champ: 'lancement', libelle: 'DATE PREVISIONNELLE DE LANCEMENT', largeur: 6 },
  { champ: 'ouverture', libelle: 'DATE PREVISIONNELLE OUVERTURE DES PLIS', largeur: 6 },
  { champ: 'attribution', libelle: "DATE PREVISIONNELLE D'ATTRIBUTION", largeur: 6 },
];

/**
 * Coupures syllabiques (U+00AD, césure conditionnelle) des seuls mots qui ne tiennent pas dans leur
 * colonne (5-6 %) aux largeurs cibles. Pas davantage : le navigateur remplit la ligne au plus près
 * et couperait aussi un mot qui aurait tenu seul sur la ligne suivante (« PASSA-TION »).
 */
const CESURES_ENTETE: Readonly<Record<string, string>> = {
  FINANCEMENT: 'FINAN\u00ADCEMENT',
  PREVISIONNELLE: 'PREVI\u00ADSION\u00ADNELLE',
  LANCEMENT: 'LANCE\u00ADMENT',
  OUVERTURE: 'OUVER\u00ADTURE',
  "D'ATTRIBUTION": "D'ATTRI\u00ADBUTION",
};

/**
 * Intitulé d'en-tête prêt à l'affichage : les colonnes du PDF sont étroites (5 à 8 %) et leurs mots
 * longs (« PREVISIONNELLE », « FINANCEMENT ») ne tiennent pas sur une ligne. Une césure
 * conditionnelle les coupe à une syllabe, avec un tiret, au lieu de les trancher n'importe où
 * (« LANCEMEN/T »). Invisible quand le mot tient ; ignorée par les lecteurs d'écran.
 */
export function enteteAvecCesures(libelle: string): string {
  return libelle
    .split(' ')
    .map((mot) => CESURES_ENTETE[mot] ?? mot)
    .join(' ');
}

/** Intitulé du groupe d'en-tête qui coiffe les 4 colonnes bénéficiaire. */
export const GROUPE_BENEFICIAIRE_PPM = 'Informations sur le Bénéficiaire';

/** Bénéficiaire d'une ligne du PPM officiel (valeurs brutes, mises en forme au rendu). */
export interface BeneficiairePpmOfficiel {
  soaCode?: string;
  numCompte?: string;
  ancMontBenef?: number | null;
  nouvMontBenef?: number | null;
  /** Identifiant du bénéficiaire (`t_service_beneficiaire.ID_BENEF`) — cible d'une observation par bénéficiaire. */
  idBenef?: number | null;
}

/**
 * Ligne du PPM officiel, libellés DÉJÀ résolus — forme d'entrée pour un appelant qui n'a pas de
 * `Marche` enregistré (aperçu de la saisie). Les écrans de consultation passent, eux, les marchés
 * chargés et laissent le tableau résoudre les libellés.
 */
export interface LignePpmOfficielle {
  /** Clé de la ligne : identifiant du marché, ou rang pour une saisie non enregistrée. */
  idDetail: number;
  nature: string;
  objet: string;
  montEstim?: number | null;
  nouvMontEstim?: number | null;
  mode: string;
  financement: string;
  /** Libellé du statut du marché — ANNOTATION de marge, vide si non renseigné. */
  statut?: string;
  /** Au moins une entrée au rendu (une ligne vide est ajoutée s'il n'y en a aucune). */
  beneficiaires: BeneficiairePpmOfficiel[];
  /** Dates prévisionnelles déjà au format `dd/MM/yyyy` (vides si absentes). */
  dateLancement: string;
  dateOuverture: string;
  dateAttribution: string;
}

/** État d'examen d'une ligne (examen séquentiel du Membre). */
export type RowExamState = 'current' | 'done-ras' | 'done-obs' | 'pending' | 'hors';

/** Libellé accessible (et infobulle) du marqueur d'état. */
export const LIBELLES_ETAT_EXAMEN: Readonly<Record<RowExamState, string>> = {
  'done-ras': 'Examinée — sans observation',
  'done-obs': 'Examinée — avec observation(s)',
  current: "Ligne en cours d'examen",
  pending: 'À examiner',
  hors: 'Hors examen — inchangée, déjà validée à la version précédente',
};

/** Modificateur CSS du marqueur de marge (`.doc-marqueur--…`) pour un état d'examen. */
export const MARQUEUR_ETAT_EXAMEN: Readonly<Record<RowExamState, string>> = {
  'done-ras': 'ras',
  'done-obs': 'obs',
  current: 'cours',
  pending: 'attente',
  hors: 'hors',
};

/**
 * Observation posée sur une CELLULE du PPM (encadré + pastille numérotée).
 * ⚠️ 2026-09-14 (contrat V30, `idBenefCible`) — pour une colonne PAR BÉNÉFICIAIRE, `idBenef` n'encadre
 * que la rangée de ce bénéficiaire ; absent, toutes les rangées de la ligne le sont. Ignoré ailleurs.
 */
export interface ObservationCellule {
  idDetail: number;
  champ: ChampPpmOfficiel;
  numero: number;
  idBenef?: number | null;
}

/** Colonnes du PPM qui portent une valeur PAR BÉNÉFICIAIRE (seules à accepter `idBenefCible`). */
export const CHAMPS_PPM_BENEFICIAIRE: readonly ChampPpmOfficiel[] = COLONNES_PPM_OFFICIEL.filter((c) => c.beneficiaire).map((c) => c.champ);

// ── Cible d'une observation dans un document (contrat V30, liste fermée de codes) ──────────────
// Les préfixes disent le document : sans point = PPM, `derogatoires.` / `delaisAmenages.` /
// `contratsCadres.` = fiche de présentation, `agpm.` = projet d'AGPM.

/** Colonnes observables de chaque liste de la fiche de présentation. */
export const COLONNES_FICHE_CIBLE = {
  derogatoires: ['objet', 'montEstim', 'mode', 'justification'],
  delaisAmenages: ['objet', 'montEstim', 'mode', 'delaiRemise', 'justification'],
  contratsCadres: ['objet', 'montEstim', 'mode', 'delaiRemise'],
} as const;

export type ChampFicheOfficiel = {
  [L in keyof typeof COLONNES_FICHE_CIBLE]: `${L}.${(typeof COLONNES_FICHE_CIBLE)[L][number]}`;
}[keyof typeof COLONNES_FICHE_CIBLE];

/** Colonnes observables du projet d'AGPM. */
export const COLONNES_AGPM_CIBLE = ['compte', 'nature', 'objet', 'montEstim', 'financement', 'mode', 'dateDao'] as const;
export type ChampAgpmOfficiel = `agpm.${(typeof COLONNES_AGPM_CIBLE)[number]}`;

/** Code de cellule accepté par le serveur (`ObservationControle.champ`). */
export type ChampCible = ChampPpmOfficiel | ChampFicheOfficiel | ChampAgpmOfficiel;

/** Document d'un code de cellule (déduit du préfixe, comme `documentCible` côté serveur). */
export function documentDuChamp(champ: string | null | undefined): 'PPM' | 'FICHE' | 'AGPM' | null {
  if (!champ) return null;
  if (champ.startsWith('agpm.')) return 'AGPM';
  return champ.includes('.') ? 'FICHE' : 'PPM';
}

const LIBELLES_LISTES_FICHE: Readonly<Record<ListeFichePresentation, string>> = {
  derogatoires: 'Mode dérogatoire',
  delaisAmenages: 'Délais aménagés',
  contratsCadres: 'Contrats-cadres',
};
const LIBELLES_COLONNES_DERIVEES: Readonly<Record<string, string>> = {
  objet: 'Objet du marché',
  montEstim: 'Montant estimatif',
  mode: 'Mode de passation',
  justification: 'Justification',
  delaiRemise: 'Délai de remise des offres',
  compte: 'Compte',
  nature: 'Nature',
  financement: 'Financement',
  dateDao: 'Date du DAO',
};

/**
 * Intitulé humain d'une cellule visée : l'en-tête imprimé pour le PPM (« MODE DE PASSATION »), la
 * liste et la colonne pour la fiche (« Mode dérogatoire · Justification »), « AGPM · Date du DAO ».
 */
export function libelleChampCible(champ: string): string {
  const ppm = COLONNES_PPM_OFFICIEL.find((c) => c.champ === champ);
  if (ppm) return ppm.libelle;
  const [prefixe, colonne] = champ.split('.');
  const libelleColonne = LIBELLES_COLONNES_DERIVEES[colonne] ?? colonne ?? champ;
  if (prefixe === 'agpm') return `AGPM · ${libelleColonne}`;
  const liste = LIBELLES_LISTES_FICHE[prefixe as ListeFichePresentation];
  return liste ? `${liste} · ${libelleColonne}` : champ;
}

/**
 * Clic sur une cellule d'un document officiel (geste « Observer cette cellule » de l'examen) :
 * la ligne, le code de la cellule, le bénéficiaire pour une colonne par bénéficiaire, la valeur
 * AFFICHÉE (pré-remplit « Au lieu de ») et la cellule elle-même (ancrage de la proposition).
 */
export interface CelluleCliquee {
  idDetail: number;
  champ: ChampCible;
  idBenef: number | null;
  valeur: string;
  element: HTMLElement;
}

/** Observation posée sur une LIGNE d'un document (marqueur de marge + pastille numérotée). */
export interface ObservationLigne {
  idDetail: number;
  numero: number;
}

/** Liste de la fiche de présentation où figure une ligne (un marché peut figurer dans deux listes). */
export type ListeFichePresentation = 'derogatoires' | 'delaisAmenages' | 'contratsCadres';

/** Observation sur une ligne de la fiche : `liste` absente = toutes les listes où figure le marché. */
export interface ObservationLigneFiche extends ObservationLigne {
  liste?: ListeFichePresentation;
}

/** Tableau vide PARTAGÉ : une entrée stable pour les cellules sans observation (OnPush). */
export const AUCUN_NUMERO: readonly number[] = [];

/** Regroupe des numéros par clé, triés et dédoublonnés. */
export function grouperNumeros<T>(items: readonly T[], cle: (item: T) => string | number, numero: (item: T) => number): Map<string | number, number[]> {
  const parCle = new Map<string | number, number[]>();
  for (const item of items) {
    const k = cle(item);
    const liste = parCle.get(k) ?? [];
    if (!liste.includes(numero(item))) liste.push(numero(item));
    parCle.set(k, liste);
  }
  for (const liste of parCle.values()) liste.sort((a, b) => a - b);
  return parCle;
}

/** Clé d'indexation d'une cellule observée (`*` = sans bénéficiaire visé). */
export function cleCellule(idDetail: number, champ: ChampPpmOfficiel, idBenef?: number | null): string {
  return `${idDetail}|${champ}|${idBenef ?? '*'}`;
}

/** Libellé accessible d'un ensemble d'observations (« Observation n° 2 », « Observations n° 1, 3 »). */
export function libelleObservations(numeros: readonly number[]): string {
  return (numeros.length > 1 ? 'Observations n° ' : 'Observation n° ') + numeros.join(', ');
}

/**
 * Montant au format du document officiel : groupes de 3 chiffres, virgule, 2 décimales ; '' si absent.
 * ⚠️ Séparateur = espace SÉCABLE (et non insécable) : dans une colonne étroite du PDF, le montant
 * revient à la ligne entre deux groupes plutôt que de déborder ou d'être coupé dans un groupe.
 */
export function montantOfficiel(v?: number | null): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '';
  const n = Number(v);
  const [ent, dec] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec;
}

/** Date ISO `yyyy-MM-dd` → `dd/MM/yyyy` ; '' si absente. */
export function dateOfficielle(iso?: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
