import { BilanControles, BlocFiche, Cadrage, CategorieDao, ChampFiche, DocumentDao, ReferentielFiche, RubriqueFiche, TypeChamp, TypeMarche } from '../../../models';

/**
 * Règles PURES de la fiche DAO (esquisse « DAO par type de marché », 22/09) : questions de cadrage, conditions
 * d'affichage, regroupement des champs, progression, repli sur la structure de l'esquisse. Testées à part.
 */

export const LIBELLES_TYPES_MARCHE: Readonly<Record<TypeMarche, string>> = {
  QUANTITE_FIXE: 'Quantité fixe',
  A_COMMANDE: 'À commande',
  CONTRAT_CADRE: 'Contrat-cadre',
};

/** ⚠️ Lot 5 — les trois catégories de dossier d'appel d'offres, telles qu'on les nomme à l'écran. */
export const LIBELLES_CATEGORIES: Readonly<Record<CategorieDao, string>> = {
  FOURNITURES_SERVICES: 'Fournitures et services',
  TRAVAUX: 'Travaux et réhabilitation',
  PRESTATIONS_INTELLECTUELLES: 'Prestations intellectuelles',
};

export const LIBELLES_DOCUMENTS: Readonly<Record<DocumentDao, string>> = {
  DPAO: 'DPAO',
  DPAC: 'DPAC',
  DPIC: 'DPIC',
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

/**
 * ⚠️ Lot 1c (23/09, décision du pilote) — **le type de marché ne se demande plus** : il est déduit de la forme du
 * marché portée par la ligne du plan (`t_marche.FORME_MARCHE`). Les règles le reçoivent quand même dans le cadrage,
 * comme une donnée de contexte injectée par l'écran (les conditions d'affichage s'en servent), mais il n'est plus
 * une réponse et n'est jamais renvoyé au serveur. Neuf questions.
 */
export const QUESTIONS_CADRAGE: readonly QuestionCadrage[] = [
  {
    cle: 'alloti',
    libelle: 'Le marché est-il alloti ?',
    aide: 'Oui : nombre et description des lots, attribution divisible ou pour la totalité, évaluation par lot ou sur l’ensemble. Non : description du projet global seulement.',
    documents: 'DPAO, AE',
    options: [{ code: 'OUI', libelle: 'Oui' }, { code: 'NON', libelle: 'Non' }],
    complement: { cle: 'nbLots', libelle: 'Nombre de lots', si: 'OUI' },
  },
  {
    // ⚠️ Lot 5 (24/09) — propre aux TRAVAUX : le classeur range les tranches parmi les lignes ordinaires, à côté
    // des lots et des variantes. C'est une réponse de cadrage, pas une forme de marché.
    cle: 'tranches',
    libelle: 'Le marché comporte-t-il des tranches ?',
    aide: 'Oui : tranche ferme, puis tranches conditionnelles, chacune avec son objet et son montant. Non : le marché est exécuté d’un seul tenant.',
    documents: 'DPAO, AE, CCAP',
    options: [{ code: 'OUI', libelle: 'Oui' }, { code: 'NON', libelle: 'Non' }],
    si: { cle: 'categorie', valeur: 'TRAVAUX' },
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

/** Types de marché pris en charge aujourd'hui ; la liste s'allonge aux lots suivants (le serveur fait foi). */
export const TYPES_OUTILLES: readonly TypeMarche[] = ['QUANTITE_FIXE'];

/** Vrai si la fiche d'une ligne de cette forme peut être préparée aujourd'hui. */
export function typeOutille(t: TypeMarche | null | undefined): boolean {
  return !!t && TYPES_OUTILLES.includes(t);
}

/** Questions à poser pour un cadrage donné (celles dont la condition `si` est satisfaite). */
/** Ordre de lecture des documents d'un dossier d'appel d'offres. */
export const ORDRE_DOCUMENTS: readonly DocumentDao[] = ['DPAO', 'DPAC', 'DPIC', 'AE', 'CCAP'];

/** Les documents en toutes lettres, tels que le serveur les nomme (lot 2a). */
export const NOMS_DOCUMENTS: Readonly<Record<DocumentDao, string>> = {
  DPAO: "les données particulières de l'appel d'offres",
  DPAC: 'les données particulières du cahier des clauses administratives',
  DPIC: 'les données particulières des instructions aux consultants',
  AE: "l'acte d'engagement",
  CCAP: 'le cahier des clauses administratives particulières',
  AUCUN: '',
};

/**
 * Le document où ce champ atterrit **réellement**, une fois la forme et la catégorie connues.
 *
 * Les champs partagés (repris du plan, reflets du cadrage) portent `DPAO` et `CCAP` pour maître, parce qu'ils
 * valent pour tout le monde. Le document de consultation, lui, change de nom :
 * - **contrat-cadre** — répartition du fichier de correspondance : `DPAO → DPAC`, `CCAP → AE` (un contrat-cadre
 *   n'a pas de CCAP) ;
 * - **prestations intellectuelles** (lot 6, 24/09) — `DPAO → DPIC` : on ne consulte pas des candidats, on consulte
 *   des consultants. Le CCAP et l'acte d'engagement, eux, restent.
 *
 * Un même champ ne peut pas s'afficher `DPAO` sur sa ligne et `DPIC` dans le rail : l'écran passe **partout** par
 * cette fonction, faute de quoi il annonce un document qui ne sera jamais produit.
 */
export function documentEffectif(
  document: DocumentDao,
  typeMarche: TypeMarche | null,
  categorie: CategorieDao | null,
): DocumentDao {
  if (typeMarche === 'CONTRAT_CADRE') return document === 'DPAO' ? 'DPAC' : document === 'CCAP' ? 'AE' : document;
  if (categorie === 'PRESTATIONS_INTELLECTUELLES') return document === 'DPAO' ? 'DPIC' : document;
  return document;
}

/**
 * ⚠️ Lot 4 (23/09), étendu aux catégories (lot 6, 24/09) — les documents que cette fiche produira, **déduits du
 * référentiel de sa forme et de sa catégorie**, jamais d'une liste en dur : un contrat-cadre produit DPAC et AE, une
 * fiche de prestations intellectuelles DPIC, AE et CCAP, les autres DPAO, AE et CCAP.
 */
export function documentsProduits(
  referentiel: ReferentielFiche,
  typeMarche: TypeMarche | null,
  categorie: CategorieDao | null = null,
): DocumentDao[] {
  const vus = new Set(
    referentiel.champs.map((c) => (c.documentMaitre ? documentEffectif(c.documentMaitre, typeMarche, categorie) : undefined)),
  );
  return ORDRE_DOCUMENTS.filter((d) => vus.has(d));
}

/**
 * La largeur utile d'un contrôle, d'après ce qu'il reçoit : une date ou un pourcentage n'a pas besoin de la largeur
 * d'une phrase, et une phrase ne se saisit pas dans 220 pixels. Trois largeurs suffisent — au-delà, la ligne de texte
 * devient trop longue pour se relire.
 */
export function largeurChamp(type: TypeChamp): 'court' | 'moyen' | 'long' {
  if (type === 'NOMBRE' || type === 'POURCENTAGE' || type === 'DATE' || type === 'MONTANT') return 'court';
  if (type === 'LISTE' || type === 'OUI_NON') return 'moyen';
  return 'long';
}

/**
 * Les documents où ce champ est **repris**, tels qu'on les affiche : chacun une fois, et jamais son propre document
 * maître. ⚠️ Sans cela un contrat-cadre affiche « AE AE » — le champ est repris dans l'AE, et son CCAP devient un AE
 * par la répartition de la forme.
 */
export function reprisesAffichees(
  champ: Pick<ChampFiche, 'documentMaitre' | 'reprises'>,
  typeMarche: TypeMarche | null,
  categorie: CategorieDao | null,
): DocumentDao[] {
  const maitre = champ.documentMaitre ? documentEffectif(champ.documentMaitre, typeMarche, categorie) : null;
  const vues: DocumentDao[] = [];
  for (const d of champ.reprises ?? []) {
    const effectif = documentEffectif(d, typeMarche, categorie);
    if (effectif === maitre || vues.includes(effectif)) continue;
    vues.push(effectif);
  }
  return vues;
}

/**
 * ⚠️ Ergonomie (24/09) — la ligne d'étiquettes sous un champ répétait ce que la rubrique venait de dire (« AE » sous
 * une rubrique « AE ») et l'évidence (« à saisir » sous un champ à saisir) : une ligne de bruit sous chacune des cent
 * informations du formulaire. Ne restent que les **exceptions** — une valeur qui vient d'ailleurs, un document autre
 * que celui de la rubrique, les reprises, une condition.
 */
export function metaChamp(
  champ: ChampFiche,
  rubrique: Pick<RubriqueFiche, 'documentMaitre'> | null,
  typeMarche: TypeMarche | null,
  categorie: CategorieDao | null,
): { source: string | null; document: DocumentDao | null; reprises: DocumentDao[]; condition: string | null } {
  const doc = champ.documentMaitre ? documentEffectif(champ.documentMaitre, typeMarche, categorie) : null;
  const docRubrique = rubrique?.documentMaitre ? documentEffectif(rubrique.documentMaitre, typeMarche, categorie) : null;
  return {
    source: champ.source === 'PPM' ? 'repris du PPM' : champ.source === 'CADRAGE' ? 'repris du cadrage' : null,
    document: doc && doc !== docRubrique ? doc : null,
    reprises: reprisesAffichees(champ, typeMarche, categorie),
    condition: champ.condition ?? null,
  };
}

/** Clé PPM du champ qui porte le nombre de lots de la ligne du plan de passation (aujourd'hui `B02-LV-01`). */
export const CLE_PPM_NB_LOTS = 'NB_LOTS_PPM';

/**
 * ⚠️ Demande du pilote (23/09) — le nombre de lots **du plan de passation**, tel que le serveur le reprend dans
 * `valeursPpm`. Le champ est retrouvé par sa `clePpm`, jamais par son code en dur : c'est le référentiel qui fait foi.
 * `null` si le serveur ne le sert pas, ou s'il n'est pas un entier — on ne devine rien d'un plan incomplet.
 */
export function nbLotsDuPlan(
  referentiel: ReferentielFiche,
  valeursPpm: Record<string, string | number | null> | null | undefined,
): number | null {
  if (!valeursPpm) return null;
  const champ = referentiel.champs.find((c) => c.clePpm === CLE_PPM_NB_LOTS);
  const brut = champ ? valeursPpm[champ.code] : undefined;
  if (brut == null || brut === '') return null;
  const n = Number(brut);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * ⚠️ Demande du pilote (23/09) — l'allotissement **se déduit du plan**, il ne se redemande pas : un lot = marché
 * non alloti, deux lots et plus = marché alloti, avec le nombre du plan. Même principe que le type de marché
 * (lot 1c) : une donnée déjà décidée au plan de passation n'est pas resaisie, et ne peut pas le contredire.
 * `null` = le plan ne dit rien, la question reste posée.
 */
export function allotissementDuPlan(nbLots: number | null): { alloti: 'OUI' | 'NON'; nbLots: number | null } | null {
  if (nbLots == null) return null;
  return nbLots >= 2 ? { alloti: 'OUI', nbLots } : { alloti: 'NON', nbLots: null };
}

/** Clés de cadrage imposées par le plan : ni saisies, ni modifiables. */
export const CLES_IMPOSEES_PAR_LE_PLAN: readonly string[] = ['alloti', 'nbLots'];

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
    const s = sujet(q.cle);
    // ⚠️ La minuscule ne porte QUE sur la première lettre : « Selon le CCAG » ne devient pas « selon le ccag ».
    const enSuite = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
    let texte = s ? `${s} ${enSuite(opt.libelle)}` : opt.libelle;
    if (q.cle === 'alloti') texte = non ? 'Non alloti' : `Alloti${cadrage['nbLots'] ? ` · ${cadrage['nbLots']} lots` : ''}`;
    if (q.cle === 'variantes') texte = non ? 'Variantes non' : 'Variantes autorisées';
    // ⚠️ Lot 5 — propre aux travaux : « Oui » tout seul ne dit pas de quoi il s'agit.
    if (q.cle === 'tranches') texte = non ? 'Sans tranche' : 'Marché à tranches';
    if (q.cle === 'groupement') texte = non ? 'Groupement non' : 'Groupement autorisé';
    if (q.cle === 'garantieSoumission') texte = non ? 'Sans garantie de soumission' : 'Garantie de soumission exigée';
    if (q.cle === 'avance') texte = non ? 'Sans avance' : `Avance${cadrage['tauxAvance'] ? ` ${cadrage['tauxAvance']} %` : ''}`;
    if (q.cle === 'prixRevisable') texte = non ? 'Prix ferme' : 'Prix révisable';
    if (q.cle === 'penalites') texte = non ? 'Sans pénalités' : `Pénalités ${enSuite(opt.libelle)}`;
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

/** Code court d'une rubrique : le serveur sert `B05-GS` (livraison du 22/09), l'esquisse `GS` — les deux se valent. */
function codeCourt(bloc: string, code: string): string {
  return code.startsWith(`${bloc}-`) ? code.slice(bloc.length + 1) : code;
}
function memeRubrique(c: ChampFiche, bloc: string, rubrique: string): boolean {
  return c.bloc === bloc && codeCourt(bloc, c.rubrique) === codeCourt(bloc, rubrique);
}

/** Champs d'une rubrique, dans l'ordre, ouverts par le cadrage. */
export function champsDeRubrique(champs: readonly ChampFiche[], bloc: string, rubrique: string, cadrage: Cadrage): ChampFiche[] {
  return champs
    .filter((c) => memeRubrique(c, bloc, rubrique) && c.actif !== false && evaluerCondition(c.condition, cadrage))
    .sort((a, b) => a.rang - b.rang);
}

/** Une rubrique est ouverte si au moins un de ses champs l'est — ou si elle n'a pas encore de champs (référentiel à compléter). */
export function rubriqueOuverte(champs: readonly ChampFiche[], bloc: string, rubrique: RubriqueFiche, cadrage: Cadrage): boolean {
  const tous = champs.filter((c) => memeRubrique(c, bloc, rubrique.code) && c.actif !== false);
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
  // ⚠️ Lot 5 — un champ de type PIECE se joint au dossier, il ne se saisit pas dans la fiche : le serveur l'exclut
  // de son bilan, l'écran doit l'exclure de son compte, sinon les deux chiffres se contredisent.
  const ouverts = referentiel.champs.filter(
    (c) => c.source === 'SAISIE' && c.type !== 'PIECE' && c.actif !== false && evaluerCondition(c.condition, cadrage),
  );
  if (ouverts.length) {
    const saisis = ouverts.filter((c) => valeurs[c.code] != null && valeurs[c.code] !== '').length;
    return { saisis, attendus: ouverts.length };
  }
  const attendus = referentiel.blocs.flatMap((b) => b.rubriques).reduce((n, r) => n + (r.nbAttendu ?? 0), 0);
  return { saisis: 0, attendus };
}

/** Champs repris : chaque champ qui a des `reprises`, avec sa valeur (PPM, cadrage dérivé par le serveur, ou saisie) — l'étape 4 de l'esquisse. */
export function reprises(
  referentiel: ReferentielFiche,
  cadrage: Cadrage,
  valeurs: Record<string, unknown>,
  valeursPpm: Record<string, unknown>,
  valeursCadrage: Record<string, unknown> = {},
): { champ: ChampFiche; valeur: unknown }[] {
  return referentiel.champs
    .filter((c) => c.reprises?.length && c.actif !== false && evaluerCondition(c.condition, cadrage))
    .map((champ) => ({ champ, valeur: champ.source === 'PPM' ? valeursPpm[champ.code] : champ.source === 'CADRAGE' ? valeursCadrage[champ.code] : valeurs[champ.code] }));
}

/** Bilan vide (avant tout contrôle serveur). */
export const BILAN_VIDE: BilanControles = { bloquants: [], avertissements: [], ok: [], nbSaisis: 0, nbAttendus: 0 };

/** Structure de l'esquisse (quantité fixe) — REPLI tant que le référentiel serveur n'est pas servi : blocs et rubriques, comptes attendus, aucun champ. */
export const REFERENTIEL_ESQUISSE: ReferentielFiche = {
  blocs: [
    // 22 informations reprises du PPM ; avec les rubriques à saisir, 158 au total (esquisse, quantité fixe).
    { code: 'B01', libelle: 'Identification & données du PPM', rang: 1, rubriques: [{ code: 'AC', libelle: 'Acheteur', rang: 1, nbAttendu: 22 }] },
    {
      code: 'B02',
      libelle: 'Objet, allotissement & forme du marché',
      rang: 2,
      rubriques: [
        { code: 'OB', libelle: 'Objet de l’appel d’offres', rang: 1, documentMaitre: 'DPAO', nbAttendu: 1 },
        { code: 'LV', libelle: 'Lots et variantes', rang: 2, documentMaitre: 'DPAO', nbAttendu: 6 },
      ],
    },
    {
      code: 'B03',
      libelle: 'Candidats : groupement, sous-traitance, qualifications',
      rang: 3,
      rubriques: [
        { code: 'GR', libelle: 'Groupement', rang: 1, documentMaitre: 'DPAO', nbAttendu: 3 },
        { code: 'CQ', libelle: 'Capacité et qualifications des candidats', rang: 2, documentMaitre: 'DPAO', nbAttendu: 8 },
        { code: 'ST', libelle: 'Sous-traitance', rang: 3, documentMaitre: 'AE', nbAttendu: 2 },
        { code: 'NA', libelle: 'Nantissement', rang: 4, documentMaitre: 'AE', nbAttendu: 2 },
      ],
    },
    {
      code: 'B04',
      libelle: 'Dossier, remise & ouverture des offres',
      rang: 4,
      rubriques: [
        { code: 'DE', libelle: 'Demande d’éclaircissement', rang: 1, documentMaitre: 'DPAO', nbAttendu: 3 },
        { code: 'CO', libelle: 'Contenu des offres', rang: 2, documentMaitre: 'DPAO', nbAttendu: 1 },
        { code: 'VO', libelle: 'Délai de validité des offres', rang: 3, documentMaitre: 'DPAO', nbAttendu: 1 },
        { code: 'LA', libelle: 'Langue', rang: 4, documentMaitre: 'DPAO', nbAttendu: 2 },
        { code: 'FP', libelle: 'Remise des offres – forme des plis', rang: 5, documentMaitre: 'DPAO', nbAttendu: 2 },
        { code: 'LR', libelle: 'Lieu, date et heure de remise des offres', rang: 6, documentMaitre: 'DPAO', nbAttendu: 4 },
        { code: 'OP', libelle: 'Ouverture des plis', rang: 7, documentMaitre: 'DPAO', nbAttendu: 2 },
      ],
    },
    {
      code: 'B05',
      libelle: 'Prix, montants & garantie de soumission',
      rang: 5,
      rubriques: [
        { code: 'CP', libelle: 'Contenu et décomposition des prix', rang: 1, documentMaitre: 'DPAO', nbAttendu: 6 },
        { code: 'VP', libelle: 'Variation des prix', rang: 2, documentMaitre: 'DPAO', nbAttendu: 2 },
        { code: 'MO', libelle: 'Monnaie', rang: 3, documentMaitre: 'DPAO', nbAttendu: 2 },
        { code: 'GS', libelle: 'Garantie de soumission', rang: 4, documentMaitre: 'DPAO', nbAttendu: 6 },
        { code: 'TP', libelle: 'Type de prix', rang: 5, documentMaitre: 'AE', nbAttendu: 4 },
      ],
    },
    {
      code: 'B06',
      libelle: 'Évaluation, attribution & notification',
      rang: 6,
      rubriques: [
        { code: 'EP', libelle: 'Évaluation des plis – relations candidats / PRMP', rang: 1, documentMaitre: 'DPAO', nbAttendu: 1 },
        { code: 'EO', libelle: 'Évaluation des offres – montant évalué de l’offre', rang: 2, documentMaitre: 'DPAO', nbAttendu: 13 },
        { code: 'AN', libelle: 'Attribution et notification du marché', rang: 3, documentMaitre: 'CCAP', nbAttendu: 2 },
        { code: 'SD', libelle: 'Attribution, appel infructueux, notification (sans document)', rang: 4, documentMaitre: 'AUCUN', nbAttendu: 3 },
      ],
    },
    {
      code: 'B08',
      libelle: 'Paiements, avances & garanties financières',
      rang: 8,
      rubriques: [
        { code: 'PA', libelle: 'Paiements', rang: 1, documentMaitre: 'CCAP', nbAttendu: 13 },
        { code: 'AV', libelle: 'Avance', rang: 2, documentMaitre: 'CCAP', nbAttendu: 9 },
        { code: 'AC', libelle: 'Acompte', rang: 3, documentMaitre: 'CCAP', nbAttendu: 1 },
        { code: 'IM', libelle: 'Intérêts moratoires dus au fournisseur', rang: 4, documentMaitre: 'CCAP', nbAttendu: 1 },
        { code: 'GB', libelle: 'Garantie de bonne exécution', rang: 5, documentMaitre: 'CCAP', nbAttendu: 1 },
        { code: 'RG', libelle: 'Retenue de garantie', rang: 6, documentMaitre: 'CCAP', nbAttendu: 1 },
      ],
    },
    {
      code: 'B09',
      libelle: 'Exécution du marché & livraison',
      rang: 9,
      rubriques: [
        { code: 'LL', libelle: 'Lieu de livraison', rang: 1, documentMaitre: 'DPAO', nbAttendu: 1 },
        { code: 'PC', libelle: 'Pièces contractuelles', rang: 2, documentMaitre: 'CCAP', nbAttendu: 1 },
        { code: 'OM', libelle: 'Ordres de modification et avenants', rang: 3, documentMaitre: 'CCAP', nbAttendu: 3 },
        { code: 'PS', libelle: 'Protection du secret – mesures de sécurité', rang: 4, documentMaitre: 'CCAP', nbAttendu: 3 },
        { code: 'DX', libelle: 'Délai d’exécution', rang: 5, documentMaitre: 'CCAP', nbAttendu: 3 },
        { code: 'PR', libelle: 'Pénalités de retard', rang: 6, documentMaitre: 'CCAP', nbAttendu: 3 },
        { code: 'MC', libelle: 'Matériels, objets et approvisionnements confiés', rang: 7, documentMaitre: 'CCAP', nbAttendu: 1 },
        { code: 'SF', libelle: 'Stockage des fournitures', rang: 8, documentMaitre: 'CCAP', nbAttendu: 1 },
        { code: 'EM', libelle: 'Emballage', rang: 9, documentMaitre: 'CCAP', nbAttendu: 2 },
        { code: 'RT', libelle: 'Responsabilité du transport', rang: 10, documentMaitre: 'CCAP', nbAttendu: 3 },
        { code: 'LF', libelle: 'Livraison des fournitures', rang: 11, documentMaitre: 'CCAP', nbAttendu: 2 },
        { code: 'AS', libelle: 'Assurance', rang: 12, documentMaitre: 'CCAP', nbAttendu: 2 },
        { code: 'CR', libelle: 'Contrôle des prix de revient', rang: 13, documentMaitre: 'CCAP', nbAttendu: 1 },
        { code: 'IV', libelle: 'Inspections, vérifications et essais', rang: 14, documentMaitre: 'CCAP', nbAttendu: 1 },
        { code: 'DI', libelle: 'Décision après inspection et essais', rang: 15, documentMaitre: 'CCAP', nbAttendu: 1 },
        { code: 'DG', libelle: 'Délai de garantie', rang: 16, documentMaitre: 'CCAP', nbAttendu: 2 },
      ],
    },
    {
      code: 'B10',
      libelle: 'Modifications, résiliation & litiges',
      rang: 10,
      rubriques: [
        { code: 'IR', libelle: 'Indemnité de résiliation', rang: 1, documentMaitre: 'CCAP', nbAttendu: 2 },
        { code: 'AR', libelle: 'Arbitrage', rang: 2, documentMaitre: 'CCAP', nbAttendu: 1 },
        { code: 'DD', libelle: 'Dérogation aux documents généraux', rang: 3, documentMaitre: 'CCAP', nbAttendu: 1 },
      ],
    },
  ],
  champs: [],
};
