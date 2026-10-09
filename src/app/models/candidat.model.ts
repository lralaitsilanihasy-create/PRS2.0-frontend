import { ArticleFiche, CategorieDao, MaterielExige, PersonnelExige } from './fiche-marche.model';

/**
 * Soumission en ligne — lot 1, l'espace candidat (demande `docs/demande-backend-2026-10-04-soumission-en-ligne.md`,
 * §B2 à §B8 ; backend V63 à V65, contrat `docs/api-endpoints.md` § *Comptes candidats*, § *Entreprise du candidat…*,
 * § *Procédures ouvertes en ligne et retrait du DAO*). Rien ici ne touche au dépôt d'une offre (lots 2 à 4).
 */

// ── Compte (§B2, §B7) ─────────────────────────────────────────────────────────────────────────────────────────

/** Corps de `POST /api/candidats/inscription` (public). */
export interface InscriptionCandidatCorps {
  email: string;
  telephone: string;
  motDePasse: string;
  nom: string;
  prenom: string;
}

/** Réponse de l'inscription : le compte existe, non confirmé. `idCompte` = `C` + 9 chiffres. */
export interface InscriptionCandidat {
  idCompte: string;
  etat: 'A_CONFIRMER';
}

/**
 * Corps de `POST /api/candidats/confirmation` (public). `codeTelephone` n'est exigé que si l'Administrateur a activé
 * la confirmation par téléphone (`confirmationTelephone`) — aucune passerelle SMS n'est raccordée aujourd'hui.
 */
export interface ConfirmationCandidatCorps {
  email: string;
  codeEmail: string;
  codeTelephone?: string;
}

export interface ConfirmationCandidat {
  etat: 'CONFIRME';
}

/** `GET` / `PUT /api/parametres/candidats` (Administrateur). Au `PUT`, un champ absent garde sa valeur. */
export interface ParametresCandidats {
  /** Voie de vérification du NIF : le raccordement à la DGI est vide, `AUTOMATIQUE` retombe sur les pièces. */
  verificationNif: 'AUTOMATIQUE' | 'SUR_PIECES';
  /** Exiger un code par SMS à la confirmation — à laisser à `false` tant qu'aucune passerelle n'est raccordée. */
  confirmationTelephone: boolean;
  /** Inscriptions par adresse IP sur 24 heures (429 au-delà). */
  inscriptionsParJour: number;
  /** Un compte jamais confirmé est supprimé après ce délai (jours). */
  delaiConfirmationJours: number;
  /** Un compte sans connexion depuis ce délai (mois) est archivé, jamais supprimé. */
  delaiInactiviteMois: number;
  /** Plafond d'une pièce de l'entreprise (Mo) — la limite multipart du serveur est de 10 Mo. */
  tailleMaxPieceMo: number;
  /**
   * ⚠️ V70 (arbitrage du pilote, 04/10) — durée de conservation des offres, en années après la clôture de la séance (1 à 100).
   * `null` = sans limite (défaut). Au `PUT`, `0` l'efface (retour à « sans limite »).
   */
  offreConservationAnnees?: number | null;
}

/** Une procédure dont la durée de conservation est échue et qui garde des offres sur disque (V70). */
export interface ProcedureEchue {
  idDmc: number;
  reference: string;
  objet: string;
  etatSeance: string;
  /** PV entièrement signé, ou constat S5 dont le PV est signé. */
  closeLe: string;
  echeance: string;
  offresAPurger: number;
}

/** `GET /api/admin/offres/conservation` (Administrateur) — vide tant que la durée n'est pas fixée ; la plus ancienne d'abord. */
export interface ConservationOffres {
  annees: number | null;
  echues: ProcedureEchue[];
}

/** `POST /api/admin/offres/conservation/{idDmc}/purger` — restent la ligne de l'offre, l'empreinte, la lecture, l'accusé, le PV. */
export interface PurgeOffres {
  idDmc: number;
  offresPurgees: number;
  purgeeLe: string;
}

// ── Entreprise (§B3 à §B5) ────────────────────────────────────────────────────────────────────────────────────

export type TypePieceEntreprise = 'CARTE_FISCALE' | 'STATUTS' | 'POUVOIR' | 'AUTRE';

/** Une pièce de l'entreprise (PDF, JPEG ou PNG, reconnue à ses premiers octets). */
export interface PieceEntreprise {
  id: number;
  type: TypePieceEntreprise;
  nomFichier: string;
  format: string;
  /** Octets. */
  taille: number;
  dateDepot: string;
}

export type StatutVerificationNif = 'VERIFIE_DGI' | 'VERIFIE_SUR_PIECES' | 'INCONNU_DGI' | 'REFUSE_SUR_PIECES' | 'NON_VERIFIE';

/** L'état de la vérification du NIF, avec sa source. Elle ne bloque jamais un dépôt (décision du pilote, Q2). */
export interface VerificationNif {
  statut: StatutVerificationNif;
  source: 'DGI' | 'SUR_PIECES' | null;
  date: string | null;
  /** `DGI`, ou le login de l'Administrateur. */
  acteur: string | null;
  motif: string | null;
}

export interface RepresentantEntreprise {
  nom: string;
  prenom: string;
  fonction?: string | null;
}

/** Corps de `PUT /api/candidat/entreprise`. `stat` et `rcs` sont facultatifs ; NIF, STAT et RCS sont uniques. */
export interface EntrepriseCorps {
  raisonSociale: string;
  nif: string;
  stat?: string | null;
  rcs?: string | null;
  adresse: string;
  representant: RepresentantEntreprise;
}

export interface Entreprise extends EntrepriseCorps {
  id: number;
  pieces: PieceEntreprise[];
  verification: VerificationNif;
  /** L'exclusion en cours rapprochée par le NIF, `null` sinon — un SIGNALEMENT ici ; le refus ne vient qu'au dépôt. */
  exclusion: ExclusionArmp | null;
}

/** Corps de `POST` / `PUT /api/exclusions-armp` (Administrateur). `dateFin` nulle = sans date de fin. */
export interface ExclusionArmpCorps {
  nif: string;
  raisonSociale: string;
  motif: string;
  referenceDecision: string;
  dateDebut: string;
  dateFin: string | null;
}

/** Une ligne du journal d'une exclusion ; `anciennes` vaut `null` à la création. */
export interface JournalExclusion {
  date: string;
  acteur: string;
  anciennes: Partial<ExclusionArmpCorps> | null;
  nouvelles: Partial<ExclusionArmpCorps>;
}

/** Une exclusion du répertoire de l'ARMP : jamais supprimée (405), corrigée ou close par sa date de fin. */
export interface ExclusionArmp extends ExclusionArmpCorps {
  id: number;
  enCours: boolean;
  journal: JournalExclusion[];
}

/** Corps de `POST /api/admin/entreprises/{id}/verification` ; le motif est obligatoire pour un refus. */
export interface DecisionVerificationNif {
  statut: 'VERIFIE_SUR_PIECES' | 'REFUSE_SUR_PIECES';
  motif: string | null;
}

// ── Procédures ouvertes en ligne (§B8) ────────────────────────────────────────────────────────────────────────

export type EtatProcedureEnLigne = 'A_VENIR' | 'OUVERTE' | 'CLOSE';

export interface LotProcedureEnLigne {
  numero: number;
  intitule: string | null;
}

/**
 * Une procédure ouverte à la remise électronique, lue sur la dernière version validée de sa fiche DAO. Un champ
 * fermé par le cadrage vaut `null`. **Aucun paramètre interne** (V50, ADR-0010) n'y figure.
 */
export interface ProcedureEnLigne {
  idDmc: number;
  /** Numéro du DAO (`B02-OB-03`), à défaut la référence du plan. */
  reference: string | null;
  objet: string | null;
  autoriteContractante: string | null;
  categorie: CategorieDao | null;
  /** Les lots du plan, numérotés de 1 à n ; vide si le marché n'est pas alloti. */
  lots: LotProcedureEnLigne[];
  /** `AAAA-MM-JJ`, telle que saisie à la première impression de l'avis. */
  datePublication: string | null;
  /** `AAAA-MM-JJTHH:MM`. */
  dateOuvertureDepots: string | null;
  /** `AAAA-MM-JJTHH:MM`. */
  dateLimite: string | null;
  heureReference: string | null;
  signatureExigee: string | null;
  formatsAcceptes: string[] | null;
  tailleMaxFichierMo: number | null;
  tailleMaxOffreMo: number | null;
  assistance: string | null;
  etat: EtatProcedureEnLigne;
  /** ⚠️ Lot 3 (V68) — `B04-SE-10` : remplacer et retirer son offre avant la date limite. */
  remplacementAutorise?: boolean | null;
  /** ⚠️ Lot 3 (V68) — après l’ouverture des dépôts et avant la date limite, à l’horloge du serveur. */
  depotsOuverts?: boolean | null;
  /**
   * ⚠️ V72 (06/10, retrait après paiement, §B1) — le retrait exige un reçu **validé** : dossier payant ET premier avis imprimé
   * depuis la mise en service (H2). Faux : retrait libre, comme avant.
   */
  retraitPayant?: boolean | null;
  /** Les frais de dossier par lot (`B04-DS-05[#n]`) ; `lot = null` pour un marché non alloti. */
  fraisDossier?: { lot: number | null; montant: number }[] | null;
  /** Le compte de l'ARMP à créditer ; `null` pour un dossier gratuit ou un compte non réglé. */
  compteDao?: { banque: string | null; titulaire: string | null; numeroCompte: string | null } | null;
}

export type EtatRecu = 'EN_ATTENTE' | 'VALIDE' | 'REFUSE';

/**
 * ⚠️ V72 — un reçu des frais de dossier, **par entreprise** (clé : son NIF). Le candidat le dépose, la PRMP ou l'UGPM le valide
 * ou le refuse (motif) ; une décision ne se reprend pas. `entreprise`, `compte`, `fraisAttendus` et `montantInsuffisant` ne sont
 * servis qu'à la PRMP et à l'UGPM.
 */
export interface RecuDao {
  idRecu: number;
  /** `null` : tout le dossier. */
  lots: number[] | null;
  montant: number;
  referencePaiement: string;
  datePaiement: string;
  banque: string | null;
  nomFichier: string;
  dateDepot: string;
  etat: EtatRecu;
  motifRefus: string | null;
  dateDecision: string | null;
  decidePar: 'PRMP' | 'UGPM' | null;
  entreprise?: { raisonSociale: string; nif: string } | null;
  compte?: string | null;
  fraisAttendus?: number | null;
  montantInsuffisant?: boolean | null;
}

/** Le corps du dépôt d'un reçu (partie `data` du multipart). */
export interface DepotRecuCorps {
  lots: number[] | null;
  montant: number;
  referencePaiement: string;
  datePaiement: string;
  banque: string | null;
}

/** Un document du DAO téléchargeable par un candidat connecté ; `code` est le nom du fichier. */
export interface DocumentProcedureEnLigne {
  code: string;
  intitule: string;
  version: number;
  taille: number | null;
}

/** Une ligne du registre des retraits (`GET /api/fiches-marche/{idDmc}/retraits`, PRMP de la fiche). */
export interface RetraitDao {
  date: string;
  /** L'adresse électronique du candidat. */
  compte: string;
  /** `null` si l'entreprise n'était pas déclarée au moment du retrait. */
  entreprise: string | null;
  nif: string | null;
  document: string;
  version: number;
  /** ⚠️ V72 (§B6) — le reçu qui a ouvert ce retrait ; `null` pour un retrait libre. */
  recu?: { etat: EtatRecu; referencePaiement: string } | null;
}

// ── Le dépôt scellé (lot 3, V68) ──────────────────────────────────────────────────────────────────────────────

/** `GET /api/horloge` (public) : l'heure du serveur, qui fait foi pour la date limite. */
export interface Horloge {
  /** `AAAA-MM-JJTHH:MM:SS`, à l'heure de `fuseau`. */
  maintenant: string;
  fuseau: string;
}

/** Une pièce attendue dans l'offre (`GET /api/procedures-en-ligne/{idDmc}/pieces`, public). `code` rattache un fichier à la pièce. */
export interface PieceAttendue {
  /** `AE`, `RECU-DAO`, `GARANTIE`, ou `PIECE-<idPiece>` (stable pour une version de la fiche). */
  code: string;
  rubrique: 'ADMINISTRATIVE' | 'OFFRE';
  numero: string | null;
  libelle: string;
  forme: string | null;
  ancienneteMaxMois: number | null;
  parLot: boolean | null;
  modele: string | null;
  obligatoire: boolean;
  /**
   * ⚠️ Lot 5 (05/10) — la pièce n'est plus jointe : elle est **remplie** dans un formulaire de l'offre ; servie `obligatoire = false`.
   * Les formulaires du lot 5b sont marqués dès maintenant : tant que le front ne les livre pas, la pièce reste à joindre.
   */
  formulaire?: FormulaireOffre | null;
  /**
   * ⚠️ V72 (§B5) — sur `RECU-DAO`, retrait payant seulement : l'entreprise du candidat connecté a un reçu **validé** ; la pièce
   * n'est alors plus à joindre (`obligatoire = false`). `null` ailleurs.
   */
  dejaFourni?: boolean | null;
  /**
   * ⚠️ V86 (PI-b, H-PI-1 corrigée le 08/10) — l'enveloppe où va la pièce, pour une consultation de prestations intellectuelles :
   * `FINANCIERE` (acte d'engagement, formulaires PF2 à PF5), `TECHNIQUE` (le reste) ; nulle hors PI.
   */
  enveloppe?: EnveloppeOffre | null;
}

export type FormulaireOffre = 'BORDEREAU' | 'CONFORMITE' | 'CALENDRIER' | 'DQE' | 'SOUS_DETAIL' | 'K1' | 'CAPACITES' | 'PERSONNEL' | 'MATERIEL';

/** Un article du besoin tel que le candidat le voit (le rédacteur n'est pas servi). */
export type ArticleBesoin = Omit<ArticleFiche, 'redigePar' | 'profilRedacteur'> & { idArticle: number };

/** Les seuils de qualification des travaux, résolus pour un lot (`B03-QT-*`). */
export interface QualificationLot {
  liquiditeMontant: number | null;
  liquiditePourcentage: number | null;
  chiffreAffaires: { montant: number | null; annees: number | null; meilleures: number | null; domaine: string | null } | null;
  references: { montant: number | null; nombre: number | null; annees: number | null; cumul: boolean } | null;
}

export interface LotBesoin {
  /** `null` : marché non alloti (une seule entrée). */
  numero: number | null;
  intitule: string | null;
  articles: ArticleBesoin[];
  /** `null` aux travaux. */
  lieuLivraison: string | null;
  /** En fournitures, en jours ; aux travaux `valeur` n'est remplie que si le texte commence par un nombre. */
  delaiExecution: { valeur: number | null; unite: string | null; texte: string | null } | null;
  garantieSoumission: number | null;
  /** `null` en fournitures. */
  qualification: QualificationLot | null;
}

/**
 * ⚠️ Lot 5 (05/10) — `GET /api/procedures-en-ligne/{idDmc}/besoin` (CANDIDAT) : de quoi pré-remplir les formulaires de l'offre,
 * depuis la version validée de la fiche. `formulaires: false` : dépôt par pièces seules.
 */
export interface BesoinEnLigne {
  idDmc: number;
  categorie: CategorieDao | null;
  typeMarche: string | null;
  formulaires: boolean;
  tauxTva: number | null;
  monnaie: string | null;
  lots: LotBesoin[];
  materiel: MaterielExige[];
  personnel: PersonnelExige[];
}

export type EtatOffre = 'EN_COURS' | 'DEPOSEE' | 'REMPLACEE' | 'RETIREE' | 'ECARTEE';

/** ⚠️ V86 (lot 3 PI, PI-b) — les deux enveloppes d'une proposition de prestations intellectuelles, scellées chacune à part. */
export type EnveloppeOffre = 'TECHNIQUE' | 'FINANCIERE';

/** Une offre du candidat : le serveur en connaît la taille, l'empreinte et l'horodatage, jamais le contenu. */
export interface Offre {
  /** UUID tiré par le navigateur — l'identifiant de l'offre, dans l'en-tête et les données authentifiées. */
  idOffre: string;
  idDmc: number;
  reference: string | null;
  objet: string | null;
  lot: number | null;
  etat: EtatOffre;
  dateCreation: string;
  dateDepot: string | null;
  dateRetrait: string | null;
  /** Rang d'arrivée dans la procédure. */
  numero: number | null;
  taille: number;
  nombreMorceaux: number;
  recus: number;
  /** SHA-256 de l'en-tête puis des morceaux, hexadécimal. */
  empreinte: string | null;
  remplace: string | null;
  remplaceePar: string | null;
  /** ⚠️ V86 (PI-b) — `TECHNIQUE` ou `FINANCIERE` pour une proposition PI ; nulle pour une offre ordinaire. */
  enveloppe?: EnveloppeOffre | null;
}

/** Corps de `POST /api/candidat/offres`. `enTete` est le JSON **sérialisé** : ses octets UTF-8 entrent dans l'empreinte. */
export interface CreationOffreCorps {
  idDmc: number;
  lot: number | null;
  enTete: string;
  remplace: string | null;
  /** ⚠️ V86 (PI-b) — obligatoire pour une consultation restreinte de prestations intellectuelles, refusée ailleurs. */
  enveloppe?: EnveloppeOffre;
  /** Les NIF des membres d'un groupement, pour le seul contrôle d'exclusion ; jamais servis. */
  groupementNifs?: string[];
}

/** `POST …/sceller` → l'accusé de réception (l'offre imbriquée). */
export interface Accuse {
  offre: Offre;
  entreprise: { nif: string; raisonSociale: string };
  n: number;
  quorum: number;
  empreintesDetenteurs: string[];
  /** ⚠️ V86 (PI-b) — l'autre enveloppe de la proposition, si elle est déjà scellée : son empreinte figure sur l'accusé. */
  jumelle?: Offre | null;
}

/** Une ligne du registre des dépôts, servie après la date limite seulement. */
export interface LigneDepot {
  numero: number | null;
  entreprise: string;
  nif: string;
  lot: number | null;
  dateDepot: string | null;
  dateRetrait: string | null;
  empreinte: string | null;
  taille: number;
  etat: EtatOffre;
  /** ⚠️ V86 (PI-b) — l'enveloppe d'une proposition de prestations intellectuelles ; nulle pour une offre ordinaire. */
  enveloppe?: EnveloppeOffre | null;
}

/** `GET /api/fiches-marche/{idDmc}/depots` — avant la date limite, **le nombre seul** (`depots = null`). */
export interface Depots {
  clos: boolean;
  nombre: number;
  dateLimite: string | null;
  depots: LigneDepot[] | null;
}

// ── Invitations (consultation restreinte des prestations intellectuelles — lot 3 PI, tranche PI-a, V84) ──────

/** D'où vient l'invitation : la liste restreinte arrêtée par l'AMI (le compte du candidat), ou la saisie de la PRMP (son adresse). */
export type SourceInvitation = 'AMI' | 'SAISIE';

/**
 * `GET /api/candidat/invitations` — une procédure restreinte où le candidat est invité. Elle n'apparaît pas dans les
 * procédures ouvertes : c'est ici qu'il la trouve, avec sa lettre d'invitation.
 */
export interface InvitationCandidat {
  idDmc: number;
  reference: string | null;
  objet: string | null;
  autoriteContractante: string | null;
  /** Son rang dans la liste restreinte (1 à n). */
  rang: number | null;
  source: SourceInvitation;
  /** `AAAA-MM-JJTHH:MM:SS` — la première impression qui l'a invité. */
  inviteLe: string | null;
  etatProcedure: EtatProcedureEnLigne | null;
  /** `AAAA-MM-JJTHH:MM`. */
  dateLimite: string | null;
  lettreDisponible: boolean;
}
