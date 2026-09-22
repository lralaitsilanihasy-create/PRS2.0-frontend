import { BilanControles, BlocFiche, Cadrage, ChampFiche, DocumentDao, ReferentielFiche, RubriqueFiche, TypeMarche } from '../../../models';

/**
 * Règles PURES de la fiche marché (esquisse « DAO par type de marché », 22/09) : questions de cadrage, conditions
 * d'affichage, regroupement des champs, progression, repli sur la structure de l'esquisse. Testées à part.
 */

export const LIBELLES_TYPES_MARCHE: Readonly<Record<TypeMarche, string>> = {
  QUANTITE_FIXE: 'Quantité fixe',
  A_COMMANDE: 'À commande',
  CONTRAT_CADRE: 'Contrat-cadre',
};

export const LIBELLES_DOCUMENTS: Readonly<Record<DocumentDao, string>> = {
  DPAO: 'DPAO',
  DPAC: 'DPAC',
  AE: 'AE',
  CCAP: 'CCAP',
  AUCUN: 'sans document',
};

/** Les sept étapes du parcours (esquisse, « Le parcours de constitution »). */
export interface EtapeFiche {
  cle: 'ligne' | 'cadrage' | 'blocs' | 'reprises' | 'controles' | 'validation' | 'documents';
  titre: string;
  qui: string;
}
export const ETAPES_FICHE: readonly EtapeFiche[] = [
  { cle: 'ligne', titre: 'Ligne du PPM', qui: 'automatique' },
  { cle: 'cadrage', titre: 'Cadrage', qui: 'PRMP ou UGPM' },
  { cle: 'blocs', titre: 'Saisie par bloc', qui: 'PRMP ou UGPM' },
  { cle: 'reprises', titre: 'Reprises', qui: 'automatique' },
  { cle: 'controles', titre: 'Contrôles', qui: 'automatique, puis relecture' },
  { cle: 'validation', titre: 'Validation PRMP', qui: 'PRMP' },
  { cle: 'documents', titre: 'Documents', qui: 'automatique (lot 2)' },
];

/** Une question de cadrage ; `si` = elle n'apparaît que si une autre réponse vaut telle valeur. */
export interface QuestionCadrage {
  cle: string;
  libelle: string;
  aide: string;
  options: readonly { code: string; libelle: string; aide?: string; indisponible?: string }[];
  /** Documents que la réponse ouvre ou ferme (esquisse). */
  documents: string;
  si?: { cle: string; valeur: string };
  /** Champ numérique complémentaire (nombre de lots, taux d'avance) affiché quand la réponse est `valeur`. */
  complement?: { cle: string; libelle: string; si: string; unite?: string };
}

export const QUESTIONS_CADRAGE: readonly QuestionCadrage[] = [
  {
    cle: 'typeMarche',
    libelle: 'Quel type de marché ?',
    aide: 'Tronc commun des fournitures, ou ses variantes.',
    documents: 'Tous les documents',
    options: [
      { code: 'QUANTITE_FIXE', libelle: 'Quantité fixe', aide: 'Tronc commun fournitures.' },
      { code: 'A_COMMANDE', libelle: 'À commande', aide: 'Ajoute quantités minimum et maximum, durée de validité, date d’effet, montants annuels, délai maximum de livraison.', indisponible: 'lot 3' },
      { code: 'CONTRAT_CADRE', libelle: 'Contrat-cadre', aide: 'DPAC au lieu du DPAO, titulaire, marchés subséquents, reconduction.', indisponible: 'lot 4' },
    ],
  },
  {
    cle: 'alloti',
    libelle: 'Le marché est-il alloti ?',
    aide: 'Oui : nombre et description des lots, attribution divisible ou pour la totalité, évaluation par lot ou sur l’ensemble. Non : description du projet global seulement.',
    documents: 'DPAO, AE',
    options: [{ code: 'OUI', libelle: 'Oui' }, { code: 'NON', libelle: 'Non' }],
    complement: { cle: 'nbLots', libelle: 'Nombre de lots', si: 'OUI' },
  },
  {
    cle: 'variantes',
    libelle: 'Les variantes sont-elles autorisées ?',
    aide: 'Question séparée de l’allotissement.',
    documents: 'DPAO',
    options: [{ code: 'OUI', libelle: 'Oui' }, { code: 'NON', libelle: 'Non' }],
  },
  {
    cle: 'groupement',
    libelle: 'Le groupement est-il autorisé ?',
    aide: 'Oui : identité de chaque membre dans l’AE, domiciliation bancaire du groupement. Même logique pour la sous-traitance et le nantissement.',
    documents: 'DPAO, repris dans AE et CCAP',
    options: [{ code: 'OUI', libelle: 'Oui' }, { code: 'NON', libelle: 'Non' }],
  },
  {
    cle: 'formeGroupement',
    libelle: 'Quelle forme de groupement ?',
    aide: '',
    documents: 'DPAO, AE',
    si: { cle: 'groupement', valeur: 'OUI' },
    options: [
      { code: 'CONJOINT_OU_SOLIDAIRE', libelle: 'Conjoint ou solidaire, au choix des candidats' },
      { code: 'SOLIDAIRE_OBLIGATOIRE', libelle: 'Obligatoirement solidaire' },
    ],
  },
  {
    cle: 'provenance',
    libelle: 'D’où viennent les fournitures ?',
    aide: 'Territoire national : prix EXW hors TVA, transport intérieur, assurance. Importées : CIP ou CIF, part en devises.',
    documents: 'DPAO, repris dans AE et CCAP',
    options: [{ code: 'NATIONAL', libelle: 'Territoire national' }, { code: 'IMPORTEES', libelle: 'Importées' }],
  },
  {
    cle: 'typePrix',
    libelle: 'Quel type de prix ?',
    aide: 'Unitaires : bordereau des prix, quantités réellement livrées, paiement à la livraison. Global forfaitaire : au moins 60 % à la réception, au plus 40 % sur PV.',
    documents: 'AE, CCAP',
    options: [{ code: 'UNITAIRES', libelle: 'Prix unitaires' }, { code: 'FORFAITAIRE', libelle: 'Prix global forfaitaire' }],
  },
  {
    cle: 'prixRevisable',
    libelle: 'Le prix est-il révisable ?',
    aide: 'Ferme ou révisable, en question séparée.',
    documents: 'DPAO, CCAP',
    options: [{ code: 'NON', libelle: 'Ferme' }, { code: 'OUI', libelle: 'Révisable' }],
  },
  {
    cle: 'garantieSoumission',
    libelle: 'Une garantie de soumission est-elle exigée ?',
    aide: 'Oui : forme (dépôt au Trésor, caution agréée, garantie bancaire, chèque de banque) et montant en chiffres et en lettres.',
    documents: 'DPAO, repris dans AE et CCAP',
    options: [{ code: 'OUI', libelle: 'Oui' }, { code: 'NON', libelle: 'Non' }],
  },
  {
    cle: 'avance',
    libelle: 'Une avance est-elle prévue ?',
    aide: 'Oui : pourcentage du montant ; au-delà de 5 %, garantie de restitution d’avance (bancaire ou caution) ; modalités de remboursement.',
    documents: 'AE, CCAP',
    options: [{ code: 'OUI', libelle: 'Oui' }, { code: 'NON', libelle: 'Non' }],
    complement: { cle: 'tauxAvance', libelle: 'Taux de l’avance', si: 'OUI', unite: '%' },
  },
  {
    cle: 'penalites',
    libelle: 'Des pénalités de retard s’appliquent-elles ?',
    aide: 'Selon le CCAG (article 12.1), ou un plafond différent des 15 % prévus, à préciser.',
    documents: 'CCAP',
    options: [
      { code: 'CCAG', libelle: 'Selon le CCAG' },
      { code: 'PLAFOND_DIFFERENT', libelle: 'Plafond différent, à préciser' },
      { code: 'NON', libelle: 'Non applicables' },
    ],
  },
  {
    cle: 'attributaires',
    libelle: 'Contrat-cadre : mono ou multi-attributaire ?',
    aide: 'Mono : délai et modalités de complétude de l’offre. Multi : remise en concurrence, options selon allotissement.',
    documents: 'DPAC, AE',
    si: { cle: 'typeMarche', valeur: 'CONTRAT_CADRE' },
    options: [{ code: 'MONO', libelle: 'Mono-attributaire' }, { code: 'MULTI', libelle: 'Multi-attributaire' }],
  },
];

/** Questions à poser pour un cadrage donné (celles dont la condition `si` est satisfaite). */
export function questionsPosees(cadrage: Cadrage): QuestionCadrage[] {
  return QUESTIONS_CADRAGE.filter((q) => !q.si || String(cadrage[q.si.cle] ?? '') === q.si.valeur);
}

/** Le cadrage est-il complet (toutes les questions posées ont une réponse, compléments compris) ? */
export function cadrageComplet(cadrage: Cadrage): boolean {
  return questionsPosees(cadrage).every((q) => {
    const v = cadrage[q.cle];
    if (v == null || v === '') return false;
    if (q.complement && String(v) === q.complement.si) {
      const c = cadrage[q.complement.cle];
      return c != null && c !== '' && Number(c) > 0;
    }
    return true;
  });
}

/** Résumé du cadrage en puces (« Quantité fixe · Alloti (3 lots) · Groupement autorisé · … »). */
export function resumeCadrage(cadrage: Cadrage): { texte: string; non: boolean }[] {
  const puces: { texte: string; non: boolean }[] = [];
  for (const q of questionsPosees(cadrage)) {
    const v = cadrage[q.cle];
    if (v == null || v === '') continue;
    const opt = q.options.find((o) => o.code === String(v));
    if (!opt) continue;
    const non = String(v) === 'NON';
    const s = q.cle === 'typeMarche' ? '' : sujet(q.cle);
    let texte = s ? `${s} ${opt.libelle.toLowerCase()}` : opt.libelle;
    if (q.cle === 'alloti') texte = non ? 'Non alloti' : `Alloti${cadrage['nbLots'] ? ` · ${cadrage['nbLots']} lots` : ''}`;
    if (q.cle === 'variantes') texte = non ? 'Variantes non' : 'Variantes autorisées';
    if (q.cle === 'groupement') texte = non ? 'Groupement non' : 'Groupement autorisé';
    if (q.cle === 'garantieSoumission') texte = non ? 'Sans garantie de soumission' : 'Garantie de soumission exigée';
    if (q.cle === 'avance') texte = non ? 'Sans avance' : `Avance${cadrage['tauxAvance'] ? ` ${cadrage['tauxAvance']} %` : ''}`;
    if (q.cle === 'prixRevisable') texte = non ? 'Prix ferme' : 'Prix révisable';
    if (q.cle === 'penalites') texte = non ? 'Sans pénalités' : `Pénalités ${opt.libelle.toLowerCase()}`;
    puces.push({ texte, non });
  }
  return puces;
}
function sujet(cle: string): string {
  return { provenance: 'Fournitures', typePrix: '', formeGroupement: 'Groupement', attributaires: '' }[cle] ?? '';
}

/**
 * Évalue une condition d'affichage (`garantieSoumission = OUI`, `provenance = IMPORTEES et typePrix = UNITAIRES`,
 * `a = X ou b = Y`) sur le cadrage. `null`/vide = toujours vrai ; une clé absente vaut faux. `ou` prime sur rien :
 * la grammaire de la demande n'a pas de parenthèses — `ou` sépare des groupes de `et`.
 */
export function evaluerCondition(condition: string | null | undefined, cadrage: Cadrage): boolean {
  if (!condition || !condition.trim()) return true;
  return condition.split(/\s+ou\s+/i).some((groupe) =>
    groupe.split(/\s+et\s+/i).every((terme) => {
      const m = terme.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(=|!=)\s*([A-Za-z0-9_]+)$/);
      if (!m) return false;
      const [, cle, op, valeur] = m;
      const v = String(cadrage[cle] ?? '');
      return op === '=' ? v === valeur : v !== valeur;
    }),
  );
}

/** Champs d'une rubrique, dans l'ordre, ouverts par le cadrage. */
export function champsDeRubrique(champs: readonly ChampFiche[], bloc: string, rubrique: string, cadrage: Cadrage): ChampFiche[] {
  return champs
    .filter((c) => c.bloc === bloc && c.rubrique === rubrique && c.actif !== false && evaluerCondition(c.condition, cadrage))
    .sort((a, b) => a.rang - b.rang);
}

/** Une rubrique est ouverte si au moins un de ses champs l'est — ou si elle n'a pas encore de champs (référentiel à compléter). */
export function rubriqueOuverte(champs: readonly ChampFiche[], bloc: string, rubrique: RubriqueFiche, cadrage: Cadrage): boolean {
  const tous = champs.filter((c) => c.bloc === bloc && c.rubrique === rubrique.code && c.actif !== false);
  if (!tous.length) return true;
  return tous.some((c) => evaluerCondition(c.condition, cadrage));
}

/** Blocs à saisir (tout sauf B01, repris du PPM, et B07 hors contrat-cadre), triés. */
export function blocsASaisir(referentiel: ReferentielFiche, typeMarche: TypeMarche | null): BlocFiche[] {
  return referentiel.blocs
    .filter((b) => b.code !== 'B01' && (b.code !== 'B07' || typeMarche === 'CONTRAT_CADRE'))
    .sort((a, b) => a.rang - b.rang);
}

/** Progression : champs `SAISIE` ouverts et renseignés / attendus (référentiel chargé) — ou compte de l'esquisse. */
export function progression(referentiel: ReferentielFiche, cadrage: Cadrage, valeurs: Record<string, unknown>): { saisis: number; attendus: number } {
  const ouverts = referentiel.champs.filter((c) => c.source === 'SAISIE' && c.actif !== false && evaluerCondition(c.condition, cadrage));
  if (ouverts.length) {
    const saisis = ouverts.filter((c) => valeurs[c.code] != null && valeurs[c.code] !== '').length;
    return { saisis, attendus: ouverts.length };
  }
  const attendus = referentiel.blocs.flatMap((b) => b.rubriques).reduce((n, r) => n + (r.attendus ?? 0), 0);
  return { saisis: 0, attendus };
}

/** Champs repris : chaque champ qui a des `reprises`, avec sa valeur (PPM ou saisie) — l'étape 4 de l'esquisse. */
export function reprises(referentiel: ReferentielFiche, cadrage: Cadrage, valeurs: Record<string, unknown>, valeursPpm: Record<string, unknown>): { champ: ChampFiche; valeur: unknown }[] {
  return referentiel.champs
    .filter((c) => c.reprises?.length && c.actif !== false && evaluerCondition(c.condition, cadrage))
    .map((champ) => ({ champ, valeur: champ.source === 'PPM' ? valeursPpm[champ.code] : valeurs[champ.code] }));
}

/** Bilan vide (avant tout contrôle serveur). */
export const BILAN_VIDE: BilanControles = { bloquants: [], avertissements: [], ok: [], nbSaisis: 0, nbAttendus: 0 };

/** Structure de l'esquisse (quantité fixe) — REPLI tant que le référentiel serveur n'est pas servi : blocs et rubriques, comptes attendus, aucun champ. */
export const REFERENTIEL_ESQUISSE: ReferentielFiche = {
  blocs: [
    // 22 informations reprises du PPM ; avec les rubriques à saisir, 158 au total (esquisse, quantité fixe).
    { code: 'B01', libelle: 'Identification & données du PPM', rang: 1, rubriques: [{ code: 'AC', libelle: 'Acheteur', rang: 1, attendus: 22 }] },
    {
      code: 'B02',
      libelle: 'Objet, allotissement & forme du marché',
      rang: 2,
      rubriques: [
        { code: 'OB', libelle: 'Objet de l’appel d’offres', rang: 1, documentMaitre: 'DPAO', attendus: 1 },
        { code: 'LV', libelle: 'Lots et variantes', rang: 2, documentMaitre: 'DPAO', attendus: 6 },
      ],
    },
    {
      code: 'B03',
      libelle: 'Candidats : groupement, sous-traitance, qualifications',
      rang: 3,
      rubriques: [
        { code: 'GR', libelle: 'Groupement', rang: 1, documentMaitre: 'DPAO', attendus: 3 },
        { code: 'CQ', libelle: 'Capacité et qualifications des candidats', rang: 2, documentMaitre: 'DPAO', attendus: 8 },
        { code: 'ST', libelle: 'Sous-traitance', rang: 3, documentMaitre: 'AE', attendus: 2 },
        { code: 'NA', libelle: 'Nantissement', rang: 4, documentMaitre: 'AE', attendus: 2 },
      ],
    },
    {
      code: 'B04',
      libelle: 'Dossier, remise & ouverture des offres',
      rang: 4,
      rubriques: [
        { code: 'DE', libelle: 'Demande d’éclaircissement', rang: 1, documentMaitre: 'DPAO', attendus: 3 },
        { code: 'CO', libelle: 'Contenu des offres', rang: 2, documentMaitre: 'DPAO', attendus: 1 },
        { code: 'VO', libelle: 'Délai de validité des offres', rang: 3, documentMaitre: 'DPAO', attendus: 1 },
        { code: 'LA', libelle: 'Langue', rang: 4, documentMaitre: 'DPAO', attendus: 2 },
        { code: 'FP', libelle: 'Remise des offres – forme des plis', rang: 5, documentMaitre: 'DPAO', attendus: 2 },
        { code: 'LR', libelle: 'Lieu, date et heure de remise des offres', rang: 6, documentMaitre: 'DPAO', attendus: 4 },
        { code: 'OP', libelle: 'Ouverture des plis', rang: 7, documentMaitre: 'DPAO', attendus: 2 },
      ],
    },
    {
      code: 'B05',
      libelle: 'Prix, montants & garantie de soumission',
      rang: 5,
      rubriques: [
        { code: 'CP', libelle: 'Contenu et décomposition des prix', rang: 1, documentMaitre: 'DPAO', attendus: 6 },
        { code: 'VP', libelle: 'Variation des prix', rang: 2, documentMaitre: 'DPAO', attendus: 2 },
        { code: 'MO', libelle: 'Monnaie', rang: 3, documentMaitre: 'DPAO', attendus: 2 },
        { code: 'GS', libelle: 'Garantie de soumission', rang: 4, documentMaitre: 'DPAO', attendus: 6 },
        { code: 'TP', libelle: 'Type de prix', rang: 5, documentMaitre: 'AE', attendus: 4 },
      ],
    },
    {
      code: 'B06',
      libelle: 'Évaluation, attribution & notification',
      rang: 6,
      rubriques: [
        { code: 'EP', libelle: 'Évaluation des plis – relations candidats / PRMP', rang: 1, documentMaitre: 'DPAO', attendus: 1 },
        { code: 'EO', libelle: 'Évaluation des offres – montant évalué de l’offre', rang: 2, documentMaitre: 'DPAO', attendus: 13 },
        { code: 'AN', libelle: 'Attribution et notification du marché', rang: 3, documentMaitre: 'CCAP', attendus: 2 },
        { code: 'SD', libelle: 'Attribution, appel infructueux, notification (sans document)', rang: 4, documentMaitre: 'AUCUN', attendus: 3 },
      ],
    },
    {
      code: 'B08',
      libelle: 'Paiements, avances & garanties financières',
      rang: 8,
      rubriques: [
        { code: 'PA', libelle: 'Paiements', rang: 1, documentMaitre: 'CCAP', attendus: 13 },
        { code: 'AV', libelle: 'Avance', rang: 2, documentMaitre: 'CCAP', attendus: 9 },
        { code: 'AC', libelle: 'Acompte', rang: 3, documentMaitre: 'CCAP', attendus: 1 },
        { code: 'IM', libelle: 'Intérêts moratoires dus au fournisseur', rang: 4, documentMaitre: 'CCAP', attendus: 1 },
        { code: 'GB', libelle: 'Garantie de bonne exécution', rang: 5, documentMaitre: 'CCAP', attendus: 1 },
        { code: 'RG', libelle: 'Retenue de garantie', rang: 6, documentMaitre: 'CCAP', attendus: 1 },
      ],
    },
    {
      code: 'B09',
      libelle: 'Exécution du marché & livraison',
      rang: 9,
      rubriques: [
        { code: 'LL', libelle: 'Lieu de livraison', rang: 1, documentMaitre: 'DPAO', attendus: 1 },
        { code: 'PC', libelle: 'Pièces contractuelles', rang: 2, documentMaitre: 'CCAP', attendus: 1 },
        { code: 'OM', libelle: 'Ordres de modification et avenants', rang: 3, documentMaitre: 'CCAP', attendus: 3 },
        { code: 'PS', libelle: 'Protection du secret – mesures de sécurité', rang: 4, documentMaitre: 'CCAP', attendus: 3 },
        { code: 'DX', libelle: 'Délai d’exécution', rang: 5, documentMaitre: 'CCAP', attendus: 3 },
        { code: 'PR', libelle: 'Pénalités de retard', rang: 6, documentMaitre: 'CCAP', attendus: 3 },
        { code: 'MC', libelle: 'Matériels, objets et approvisionnements confiés', rang: 7, documentMaitre: 'CCAP', attendus: 1 },
        { code: 'SF', libelle: 'Stockage des fournitures', rang: 8, documentMaitre: 'CCAP', attendus: 1 },
        { code: 'EM', libelle: 'Emballage', rang: 9, documentMaitre: 'CCAP', attendus: 2 },
        { code: 'RT', libelle: 'Responsabilité du transport', rang: 10, documentMaitre: 'CCAP', attendus: 3 },
        { code: 'LF', libelle: 'Livraison des fournitures', rang: 11, documentMaitre: 'CCAP', attendus: 2 },
        { code: 'AS', libelle: 'Assurance', rang: 12, documentMaitre: 'CCAP', attendus: 2 },
        { code: 'CR', libelle: 'Contrôle des prix de revient', rang: 13, documentMaitre: 'CCAP', attendus: 1 },
        { code: 'IV', libelle: 'Inspections, vérifications et essais', rang: 14, documentMaitre: 'CCAP', attendus: 1 },
        { code: 'DI', libelle: 'Décision après inspection et essais', rang: 15, documentMaitre: 'CCAP', attendus: 1 },
        { code: 'DG', libelle: 'Délai de garantie', rang: 16, documentMaitre: 'CCAP', attendus: 2 },
      ],
    },
    {
      code: 'B10',
      libelle: 'Modifications, résiliation & litiges',
      rang: 10,
      rubriques: [
        { code: 'IR', libelle: 'Indemnité de résiliation', rang: 1, documentMaitre: 'CCAP', attendus: 2 },
        { code: 'AR', libelle: 'Arbitrage', rang: 2, documentMaitre: 'CCAP', attendus: 1 },
        { code: 'DD', libelle: 'Dérogation aux documents généraux', rang: 3, documentMaitre: 'CCAP', attendus: 1 },
      ],
    },
  ],
  champs: [],
};
