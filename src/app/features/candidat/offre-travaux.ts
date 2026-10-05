import { FormulairesOffre, NatureDebourse, TotauxOffre } from '../../core/securite/scellement';
import { ArticleBesoin, BesoinEnLigne, LotBesoin } from '../../models';

/**
 * L'**offre des travaux, lot 5b** (`demande-backend-2026-10-05-formulaires-en-ligne`) : coefficient K1, sous-détail des prix,
 * capacités (chiffre d'affaires, liquidité, références), personnel et matériel. Des calculs purs, comme `offre-financiere` ; le
 * serveur refait les contrôles à l'ouverture (hors K1, H3) et n'écarte jamais une offre.
 */

/** Les neuf frais du K1 (annexe 2 de l'AE-T type ARMP) : indice, origine, catégorie. Fixes (H3) : la fiche n'en sert aucun. */
export const TAUX_K1: readonly { code: string; libelle: string; categorie: 'A1' | 'A2' | 'A3' }[] = [
  { code: 'a1', libelle: 'Frais d’agence et de patente', categorie: 'A1' },
  { code: 'a2', libelle: 'Frais de chantier', categorie: 'A1' },
  { code: 'a3', libelle: 'Frais d’études et de laboratoire', categorie: 'A1' },
  { code: 'a4', libelle: 'Assurances', categorie: 'A1' },
  { code: 'a5', libelle: 'Bénéfice et impôts sur le bénéfice', categorie: 'A2' },
  { code: 'a6', libelle: 'Aléas techniques', categorie: 'A2' },
  { code: 'a7', libelle: 'Aléas de révision de prix', categorie: 'A2' },
  { code: 'a8', libelle: 'Frais financiers', categorie: 'A2' },
  { code: 'a9', libelle: 'Frais de siège', categorie: 'A3' },
];

export const NATURES_DEBOURSE: readonly { code: NatureDebourse; libelle: string }[] = [
  { code: 'MAIN_OEUVRE', libelle: 'Personnel' },
  { code: 'MATERIEL', libelle: 'Matériel' },
  { code: 'MATERIAUX', libelle: 'Matériaux' },
  { code: 'OUTILLAGE', libelle: 'Outillage' },
];

export interface LigneDebourse {
  nature: NatureDebourse;
  designation: string;
  unite: string;
  quantite: number | null;
  prixUnitaire: number | null;
}

export interface ReferenceSaisie {
  objet: string;
  maitreOuvrage: string;
  annee: number | null;
  montant: number | null;
}

export interface PersonneSaisie {
  nom: string;
  diplome: string;
  experienceAnnees: number | null;
}

/** Ce que le candidat a saisi au lot 5b. */
export interface SaisieTravaux {
  k1: Record<string, number | null>;
  siegeEtranger: boolean;
  sousDetails: Record<number, { rendement: number | null; lignes: LigneDebourse[] }>;
  chiffresAffaires: Record<number, number | null>;
  liquidite: { montant: number | null; nature: string; emetteur: string };
  references: ReferenceSaisie[];
  /** Par `idPersonnel` : une entrée par personne exigée. */
  personnel: Record<number, PersonneSaisie[]>;
  /** Par `idMateriel`. */
  materiel: Record<number, { designation: string; nombre: number | null; enPropre: number | null }>;
}

export function saisieTravauxVide(): SaisieTravaux {
  return { k1: {}, siegeEtranger: false, sousDetails: {}, chiffresAffaires: {}, liquidite: { montant: null, nature: '', emetteur: '' }, references: [], personnel: {}, materiel: {} };
}

/**
 * K1 = (1 + A1/100) × (1 + A2/100) / (1 − A3/100 × (1 + TVA/100)), arrondi au centième **par défaut** ; A3 est nul pour une
 * entreprise ayant son siège à Madagascar. Les taux vides comptent pour zéro.
 */
export function calculerK1(s: SaisieTravaux, tauxTva: number): { A1: number; A2: number; A3: number; k1: number } {
  const somme = (g: string) => TAUX_K1.filter((t) => t.categorie === g).reduce((x, t) => x + (s.k1[t.code] ?? 0), 0);
  const A1 = somme('A1');
  const A2 = somme('A2');
  const A3 = s.siegeEtranger ? somme('A3') : 0;
  const brut = ((1 + A1 / 100) * (1 + A2 / 100)) / (1 - (A3 / 100) * (1 + tauxTva / 100));
  return { A1, A2, A3, k1: Math.floor(brut * 100 + 1e-9) / 100 };
}

/** Les déboursés secs « D » d'un sous-détail. */
export function deboursesSecs(lignes: LigneDebourse[]): number {
  return lignes.reduce((x, l) => x + Math.round((l.quantite ?? 0) * (l.prixUnitaire ?? 0)), 0);
}

/** Le prix de vente à l'unité = D × K1 / R (R = 1 pour un forfait ou s'il manque). */
export function prixSousDetail(sd: { rendement: number | null; lignes: LigneDebourse[] } | undefined, k1: number): number | null {
  if (!sd?.lignes.length) return null;
  const d = deboursesSecs(sd.lignes);
  return d ? Math.round((d * k1) / (sd.rendement || 1)) : null;
}

/** Les exercices demandés : les `annees` dernières années complètes avant celle de la date limite, la plus récente d'abord. */
export function exercices(lot: LotBesoin, dateLimite: string | null): number[] {
  const n = lot.qualification?.chiffreAffaires?.annees || 5;
  const ref = dateLimite ? Number(dateLimite.slice(0, 4)) : new Date().getFullYear();
  return Array.from({ length: n }, (_, i) => ref - 1 - i);
}

/** Moyenne des `meilleures` années saisies (toutes, si le dossier ne le dit pas). */
export function moyenneCa(lot: LotBesoin, s: SaisieTravaux, dateLimite: string | null): number | null {
  const valeurs = exercices(lot, dateLimite).map((a) => s.chiffresAffaires[a] ?? 0);
  if (!valeurs.some(Boolean)) return null;
  const k = lot.qualification?.chiffreAffaires?.meilleures || valeurs.length;
  const meilleures = [...valeurs].sort((a, b) => b - a).slice(0, k);
  return Math.round(meilleures.reduce((x, v) => x + v, 0) / k);
}

/** Le seuil de liquidité : le plus exigeant du montant fixe et du pourcentage du TTC de l'offre. */
export function seuilLiquidite(lot: LotBesoin, ttc: number): number | null {
  const q = lot.qualification;
  const parts = [q?.liquiditeMontant ?? null, q?.liquiditePourcentage != null ? Math.round((ttc * q.liquiditePourcentage) / 100) : null].filter((x): x is number => x != null);
  return parts.length ? Math.max(...parts) : null;
}

/** Les références retenues : celles de la période, les `nombre` meilleures ; leur cumul (ou la meilleure, sans cumul). */
export function referencesRetenues(lot: LotBesoin, s: SaisieTravaux, dateLimite: string | null): number {
  const r = lot.qualification?.references;
  const ref = dateLimite ? Number(dateLimite.slice(0, 4)) : new Date().getFullYear();
  const recevables = s.references.filter((x) => x.montant && x.annee && (!r?.annees || x.annee >= ref - r.annees)).map((x) => x.montant!);
  const tri = recevables.sort((a, b) => b - a).slice(0, r?.cumul ? r.nombre || recevables.length : 1);
  return tri.reduce((x, v) => x + v, 0);
}

const nombre = (v: number) => new Intl.NumberFormat('fr-FR').format(v);

/** Les avertissements du lot 5b — les mêmes règles que les alertes du serveur. Jamais bloquants. */
export function avertissementsTravaux(lot: LotBesoin, besoin: BesoinEnLigne, s: SaisieTravaux, prix: Record<number, number | null>, totaux: TotauxOffre, tauxTva: number, dateLimite: string | null): string[] {
  const m: string[] = [];
  const { k1 } = calculerK1(s, tauxTva);
  for (const a of lot.articles.filter((x) => x.sousDetail)) {
    const calcule = prixSousDetail(s.sousDetails[a.idArticle], k1);
    const pu = prix[a.idArticle];
    if (calcule == null) m.push(`Sous-détail du prix ${a.numeroPrix ?? ''} « ${a.designation} » à remplir.`);
    else if (pu && Math.abs(calcule - pu) / pu > 0.01) m.push(`Sous-détail du prix ${a.numeroPrix ?? ''} : ${nombre(calcule)} Ar calculés, contre ${nombre(pu)} Ar au bordereau (écart de plus de 1 %).`);
  }
  const q = lot.qualification;
  const ca = moyenneCa(lot, s, dateLimite);
  if (q?.chiffreAffaires?.montant && (ca == null || ca < q.chiffreAffaires.montant)) m.push(`Chiffre d’affaires : moyenne ${ca == null ? 'non saisie' : nombre(ca) + ' Ar'}, pour ${nombre(q.chiffreAffaires.montant)} Ar exigés.`);
  const seuil = seuilLiquidite(lot, totaux.ttc);
  if (seuil && !((s.liquidite.montant ?? 0) >= seuil)) m.push(`Liquidité : ${nombre(s.liquidite.montant ?? 0)} Ar attestés, pour ${nombre(seuil)} Ar exigés.`);
  if (q?.references?.montant) {
    const total = referencesRetenues(lot, s, dateLimite);
    if (total < q.references.montant) m.push(`Références : ${nombre(total)} Ar retenus, pour ${nombre(q.references.montant)} Ar exigés.`);
  }
  for (const p of besoin.personnel) {
    const saisis = (s.personnel[p.idPersonnel!] ?? []).filter((x) => x.nom.trim());
    const faibles = saisis.filter((x) => p.experienceAnnees && (x.experienceAnnees ?? 0) < p.experienceAnnees);
    if (saisis.length < (p.nombre ?? 1)) m.push(`Personnel « ${p.poste} » : ${saisis.length} personne(s) sur ${p.nombre ?? 1}.`);
    else if (faibles.length) m.push(`Personnel « ${p.poste} » : ${faibles.length} personne(s) sous les ${p.experienceAnnees} ans d’expérience exigés.`);
  }
  for (const x of besoin.materiel) {
    const v = s.materiel[x.idMateriel!];
    if (!((v?.nombre ?? 0) >= (x.nombre ?? 0))) m.push(`Matériel « ${x.designation} » : ${v?.nombre ?? 0} sur ${x.nombre}.`);
    else if (x.minimumEnPropre && !((v?.enPropre ?? 0) >= x.minimumEnPropre)) m.push(`Matériel « ${x.designation} » : ${v?.enPropre ?? 0} en propre, pour ${x.minimumEnPropre} exigés.`);
  }
  return m;
}

/** Les articles dont le sous-détail est exigé. */
export const articlesSousDetail = (lot: LotBesoin): ArticleBesoin[] => lot.articles.filter((a) => a.sousDetail);

/** Les parties du lot 5b scellées : seulement celles que la fiche demande (le serveur ne contrôle que les parties présentes). */
export function construireTravaux(lot: LotBesoin, besoin: BesoinEnLigne, s: SaisieTravaux, tauxTva: number, dateLimite: string | null): Partial<FormulairesOffre> {
  const K = calculerK1(s, tauxTva);
  const f: Partial<FormulairesOffre> = {
    k1: { taux: TAUX_K1.map((t) => ({ code: t.code, pourcentage: s.k1[t.code] ?? 0 })), siegeEtranger: s.siegeEtranger, k1: K.k1 },
  };
  const sd = articlesSousDetail(lot);
  if (sd.length) {
    f.sousDetails = sd.map((a) => {
      const x = s.sousDetails[a.idArticle] ?? { rendement: 1, lignes: [] };
      return {
        idArticle: a.idArticle,
        rendement: x.rendement || 1,
        lignes: x.lignes.filter((l) => l.designation.trim()).map((l) => ({ nature: l.nature, designation: l.designation.trim(), unite: l.unite.trim(), quantite: l.quantite ?? 0, prixUnitaire: l.prixUnitaire ?? 0 })),
        prixCalcule: prixSousDetail(x, K.k1) ?? 0,
      };
    });
  }
  if (lot.qualification) {
    f.capacites = {
      chiffresAffaires: exercices(lot, dateLimite).filter((a) => s.chiffresAffaires[a] != null).map((a) => ({ annee: a, montant: s.chiffresAffaires[a]! })),
      liquidite: s.liquidite.montant ? { montant: s.liquidite.montant, nature: s.liquidite.nature.trim(), emetteur: s.liquidite.emetteur.trim() } : null,
      references: s.references.filter((r) => r.objet.trim() && r.montant).map((r) => ({ objet: r.objet.trim(), maitreOuvrage: r.maitreOuvrage.trim(), annee: r.annee ?? 0, montant: r.montant! })),
    };
  }
  if (besoin.personnel.length) {
    f.personnel = besoin.personnel.flatMap((p) =>
      (s.personnel[p.idPersonnel!] ?? []).filter((x) => x.nom.trim()).map((x) => ({ idPersonnel: p.idPersonnel!, nom: x.nom.trim(), diplome: x.diplome.trim(), experienceAnnees: x.experienceAnnees ?? 0 })),
    );
  }
  if (besoin.materiel.length) {
    f.materiel = besoin.materiel.map((x) => {
      const v = s.materiel[x.idMateriel!];
      return { idMateriel: x.idMateriel!, designation: v?.designation.trim() || x.designation, nombre: v?.nombre ?? 0, enPropre: v?.enPropre ?? 0 };
    });
  }
  return f;
}
