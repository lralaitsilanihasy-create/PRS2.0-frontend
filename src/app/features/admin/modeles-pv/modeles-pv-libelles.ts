import { CouvertureSousType, EtatVersionModelePv, ModelePvResume, NatureModelePv, TypeChampSaisi } from '../../../models';

/**
 * ⚠️ Générateur de modèles de PV, lot G1 (20/10) — libellés et règles pures de l'écran « Modèles de PV ». Les motifs de nom
 * reprennent ceux du serveur (`ModelePvService`) : l'écran refuse avant l'envoi ce que le serveur refuserait.
 */

export const LIBELLES_NATURE: Readonly<Record<NatureModelePv, string>> = { PV: 'Procès-verbal', LETTRE_RENVOI: 'Lettre de renvoi' };

export const LIBELLES_ETAT_VERSION: Readonly<Record<EtatVersionModelePv, string>> = {
  BROUILLON: 'Brouillon',
  EN_VIGUEUR: 'En vigueur',
  REMPLACEE: 'Remplacée',
};

export const LIBELLES_TYPE_CHAMP: Readonly<Record<TypeChampSaisi, string>> = {
  TEXTE: 'Texte court',
  TEXTE_LONG: 'Texte long',
  LISTE: 'Liste de choix',
  CASE: 'Case à cocher',
  DATE: 'Date',
  NOMBRE: 'Nombre',
  PIECE: 'Pièce jointe',
};

export const TYPES_CHAMP: readonly TypeChampSaisi[] = ['TEXTE', 'TEXTE_LONG', 'LISTE', 'CASE', 'DATE', 'NOMBRE', 'PIECE'];

export const LIBELLES_ACTION: Readonly<Record<string, string>> = {
  CREE: 'Modèle créé',
  DEPOSEE: 'Version déposée',
  CONDITIONS: 'Conditions déclarées',
  CHAMPS: 'Champs saisis déclarés',
  MISE_EN_VIGUEUR: 'Mise en vigueur',
  RATTACHEMENTS: 'Sous-types servis modifiés',
  DUPLIQUE: 'Modèle dupliqué',
  ARCHIVE: 'Modèle archivé',
};

export const MOTIF_CODE_MODELE = /^[A-Za-z0-9_.-]{1,50}$/;
export const MOTIF_NOM_CONDITION = /^[A-Za-z0-9_-]{1,60}$/;
export const MOTIF_CODE_CHAMP = /^[A-Za-z0-9_]{1,60}$/;

export type Ton = 'ok' | 'at' | 'ko' | 'n';

/** L'état d'un modèle tel que la liste le dit : ce qu'il sert aujourd'hui, ou ce qu'il reste à faire. */
export function etatModele(m: ModelePvResume): { libelle: string; ton: Ton } {
  if (m.etat === 'ARCHIVE') return { libelle: 'Archivé', ton: 'n' };
  const d = m.derniere;
  const brouillonApres = !!d && d.etat === 'BROUILLON' && (!m.enVigueur || d.numero > m.enVigueur.numero);
  if (m.enVigueur) {
    if (!m.sousTypes.length) return { libelle: 'En vigueur, sans sous-type servi', ton: 'at' };
    return brouillonApres ? { libelle: `En vigueur — v${d!.numero} en préparation`, ton: 'ok' } : { libelle: 'En vigueur', ton: 'ok' };
  }
  if (!d) return { libelle: 'Aucune version déposée', ton: 'at' };
  return d.bloquant ? { libelle: 'Brouillon — contrôle bloquant', ton: 'ko' } : { libelle: 'À mettre en vigueur', ton: 'at' };
}

/**
 * ⚠️ 20/10 (demande « modeles-pv-integres », B2) — la couverture est servie par `GET /api/modeles-pv/couverture` : le front ne
 * la calcule plus. Une ligne « Sans document » de la liste est un sous-type que rien ne produit (`AUCUN`) **et** qu'aucun modèle ne
 * sert encore : rattaché à un modèle en préparation, il figure sur la ligne de ce modèle, qui dit ce qu'il lui manque.
 */
export function sansDocument(couverture: readonly CouvertureSousType[], nature: NatureModelePv = 'PV'): CouvertureSousType[] {
  return couverture.filter((c) => c.nature === nature && c.produitPar === 'AUCUN' && !c.modeleRattache);
}

/** Les sous-types qu'un modèle sert et que des fichiers intégrés produisent encore : il les reprendra (lot G4). */
export function reprisParModele(couverture: readonly CouvertureSousType[], idModele: number): string[] {
  return couverture.filter((c) => c.modeleRattache?.id === idModele && c.produitPar === 'INTEGRE').map((c) => c.sousType);
}

/** Une grille des fichiers d'un modèle intégré : un fichier par croisement, `null` quand le JAR ne le porte pas. */
export interface GrilleFichiers {
  colonnes: string[];
  lignes: { libelle: string; cellules: (string | null)[] }[];
}

const SENS_AVIS: Readonly<Record<string, string>> = { AF: 'Favorable', AFSR: 'Favorable avec réserves', ANF: 'Non favorable' };
const ORDRE_SENS = ['AF', 'AFSR', 'ANF'];
const PORTEES: readonly [string, string][] = [['CENTRALE', 'centrale'], ['REGIONALE', 'régionale']];

/**
 * Range les fichiers intégrés en grille, d'après leur nom (\`PvDocumentGenerator.modele()\`, \`LettreRenvoiDocumentGenerator\`) :
 * - PV du plan \`PV_{AF|AFSR|ANF}_{PPM|PPMAGPM}_{CENTRALE|REGIONALE}.docx\` : l'avis en ligne, AGPM × commission en colonne ;
 * - lettre \`LR_{CENTRALE|REGIONALE}.docx\` : une ligne, la commission en colonne.
 * Un nom qui ne suit aucun des deux motifs rend \`null\` : l'écran les liste alors simplement.
 */
export function grilleFichiers(fichiers: readonly string[]): GrilleFichiers | null {
  const pv = fichiers.map((f) => /^PV_(AF|AFSR|ANF)_(PPM|PPMAGPM)_(CENTRALE|REGIONALE)\.docx$/.exec(f));
  if (fichiers.length && pv.every(Boolean)) {
    const cols: [string, string, string][] = [];
    for (const [t, lt] of [['PPM', 'PPM'], ['PPMAGPM', 'PPM-AGPM']]) for (const [p, lp] of PORTEES) cols.push([t, p, `${lt} · ${lp}`]);
    const sens = ORDRE_SENS.filter((s) => pv.some((m) => m![1] === s));
    return {
      colonnes: cols.map((c) => c[2]),
      lignes: sens.map((s) => ({
        libelle: SENS_AVIS[s],
        cellules: cols.map(([t, p]) => fichiers.find((f) => f === `PV_${s}_${t}_${p}.docx`) ?? null),
      })),
    };
  }
  const lr = fichiers.map((f) => /^LR_(CENTRALE|REGIONALE)\.docx$/.exec(f));
  if (fichiers.length && lr.every(Boolean)) {
    return {
      colonnes: PORTEES.map(([, l]) => `Commission ${l}`),
      lignes: [{ libelle: 'Lettre', cellules: PORTEES.map(([p]) => fichiers.find((f) => f === `LR_${p}.docx`) ?? null) }],
    };
  }
  return null;
}

/** La règle servie, coupée en phrases pour une liste lisible. */
export function phrasesRegle(regle: string): string[] {
  // Coupe aux « ; » et « . » suivis d'un blanc, jamais entre parenthèses (« (FAV ; FAVR avec l'annexe…) » reste entier).
  const phrases: string[] = [];
  let profondeur = 0;
  let courant = '';
  for (let i = 0; i < regle.length; i++) {
    const c = regle[i];
    if (c === '(') profondeur++;
    if (c === ')') profondeur = Math.max(0, profondeur - 1);
    if ((c === ';' || c === '.') && profondeur === 0 && (i === regle.length - 1 || /\s/.test(regle[i + 1]))) {
      phrases.push(courant);
      courant = '';
      continue;
    }
    courant += c;
  }
  phrases.push(courant);
  return phrases.map((p) => p.trim()).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
}

/** Libellé et code proposés pour le modèle d'une famille qui n'en a pas (ligne « Aucun modèle » de la liste). */
export function propositionPourFamille(famille: string, libelleFamille: string): { libelle: string; code: string } {
  const connus: Readonly<Record<string, { libelle: string; code: string }>> = {
    DDP: { libelle: 'PV d’examen du plan de passation', code: 'PV-PLAN' },
    DMC: { libelle: 'PV d’examen du dossier de mise en concurrence', code: 'PV-MISE-EN-CONCURRENCE' },
    DDM: { libelle: 'PV d’examen du dossier de marché', code: 'PV-MARCHE' },
  };
  return connus[famille] ?? { libelle: `PV d’examen — ${libelleFamille}`, code: `PV-${famille.replace(/[^A-Za-z0-9_.-]/g, '')}` };
}

// ——— Compositeur de conditions (grammaire de `ConditionsModele` : termes reliés par « et » puis « ou », sans parenthèses) ———

export type Operateur = '=' | '!=' | 'contient' | 'renseigne' | 'vide';
export const OPERATEURS: readonly { op: Operateur; libelle: string }[] = [
  { op: '=', libelle: 'vaut' },
  { op: '!=', libelle: 'ne vaut pas' },
  { op: 'contient', libelle: 'contient' },
  { op: 'renseigne', libelle: 'est renseigné' },
  { op: 'vide', libelle: 'est vide' },
];

export interface Terme {
  /** Lien avec le terme précédent ; ignoré pour le premier. */
  lien: 'et' | 'ou';
  cle: string;
  op: Operateur;
  valeur: string;
}

const CLE = String.raw`(?:B\d{2}-[A-Z0-9]{1,6}-\d{2}|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*)`;
const DEBUT_TERME = String.raw`(?=${CLE}(?:\s*!?=|\s+contient\s|\s+(?:renseigne|vide)(?:\s|$)))`;
const SEPARATEUR = new RegExp(String.raw`\s+(et|ou)\s+${DEBUT_TERME}`);
const EGAL = new RegExp(String.raw`^(${CLE})\s*(!=|=)\s*(.+)$`);
const CONTIENT = new RegExp(String.raw`^(${CLE})\s+contient\s+(.+)$`);
const ETAT = new RegExp(String.raw`^(${CLE})\s+(renseigne|vide)$`);

export const sansValeur = (op: Operateur): boolean => op === 'renseigne' || op === 'vide';

/** Écrit l'expression des termes ; un terme incomplet (clé, ou valeur exigée, absente) est omis. */
export function ecrireExpression(termes: readonly Terme[]): string {
  const complets = termes.filter((t) => t.cle.trim() && (sansValeur(t.op) || t.valeur.trim()));
  return complets
    .map((t, i) => {
      const terme = sansValeur(t.op) ? `${t.cle.trim()} ${t.op}` : `${t.cle.trim()} ${t.op} ${t.valeur.trim()}`;
      return i === 0 ? terme : `${t.lien} ${terme}`;
    })
    .join(' ');
}

/** Relit une expression en termes ; `null` si un terme ne se lit pas (l'écran passe alors en saisie libre). */
export function lireExpression(expression: string): Terme[] | null {
  const texte = expression.trim();
  if (!texte) return [];
  const morceaux = texte.split(SEPARATEUR); // [terme, lien, terme, lien, terme…]
  const termes: Terme[] = [];
  for (let i = 0; i < morceaux.length; i += 2) {
    const t = morceaux[i].trim();
    const lien = (i === 0 ? 'et' : morceaux[i - 1]) as 'et' | 'ou';
    let m: RegExpMatchArray | null;
    if ((m = t.match(EGAL))) termes.push({ lien, cle: m[1], op: m[2] as Operateur, valeur: m[3].trim() });
    else if ((m = t.match(CONTIENT))) termes.push({ lien, cle: m[1], op: 'contient', valeur: m[2].trim() });
    else if ((m = t.match(ETAT))) termes.push({ lien, cle: m[1], op: m[2] as Operateur, valeur: '' });
    else return null;
  }
  return termes;
}

/** L'expression dite en clair, avec les libellés des clés connues (« l'avis vaut FAVR »). */
export function expressionEnClair(expression: string, libelles: Readonly<Record<string, string>>): string {
  const termes = lireExpression(expression);
  if (!termes) return expression;
  return termes
    .map((t, i) => {
      const op = OPERATEURS.find((o) => o.op === t.op)?.libelle ?? t.op;
      const terme = `${libelles[t.cle] ?? t.cle} ${op}${sansValeur(t.op) ? '' : ` « ${t.valeur} »`}`;
      return i === 0 ? terme : `${t.lien} ${terme}`;
    })
    .join(' ');
}

/** Taille lisible d'un fichier. */
export function tailleLisible(octets: number | null | undefined): string {
  if (octets == null) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
