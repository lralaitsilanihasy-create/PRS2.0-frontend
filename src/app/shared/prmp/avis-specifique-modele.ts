import { Cadrage, ChampFiche, DocumentFiche, PublicationAvis, RaisonAvisIndisponible } from '../../models';

/**
 * Avis spécifique d'appel d'offres (plan du 30/09, lot AV-3) — règles pures, sans appel ni écran.
 * La règle de DISPONIBILITÉ n'est pas ici : elle est lue du serveur (`…/avis-specifique/disponibilite`).
 */

/** Une impression de l'avis : sa paire de fichiers (PDF d'abord), sa version de fiche et sa trace de publication. */
export interface AvisImprime {
  cle: string;
  dateGeneration: string | null;
  version: number | null;
  publication: PublicationAvis | null;
  fichiers: DocumentFiche[];
}

const extension = (d: DocumentFiche): string => (d.extension ?? d.nomFichier.split('.').pop() ?? '').toLowerCase();

/**
 * Les avis déjà imprimés, du plus récent au plus ancien. Une impression = une paire .pdf/.docx de même nom (le nom
 * porte l'horodatage : `AVIS_<plan>_<ligne>_v2_20261005-143000`) ; les autres documents de la fiche sont ignorés.
 */
export function avisImprimes(documents: readonly DocumentFiche[]): AvisImprime[] {
  const parCle = new Map<string, AvisImprime>();
  for (const d of documents) {
    if (d.type !== 'AVIS') continue;
    const cle = d.nomFichier.replace(/\.[^.]+$/, '');
    const deja = parCle.get(cle);
    if (deja) {
      deja.fichiers.push(d);
      deja.publication ??= d.publication ?? null;
      deja.dateGeneration ??= d.dateGeneration ?? null;
    } else {
      parCle.set(cle, { cle, dateGeneration: d.dateGeneration ?? null, version: d.version ?? null, publication: d.publication ?? null, fichiers: [d] });
    }
  }
  const rangFormat = (d: DocumentFiche): number => (extension(d) === 'pdf' ? 0 : 1);
  const liste = [...parCle.values()];
  for (const a of liste) a.fichiers.sort((x, y) => rangFormat(x) - rangFormat(y));
  const cleTri = (a: AvisImprime): string => a.dateGeneration ?? a.cle;
  return liste.sort((a, b) => cleTri(b).localeCompare(cleTri(a)));
}

/** Les documents du DAO sans les avis : l'étape « Documents » les regroupe par pièce, l'avis a sa propre liste. */
export function sansAvis(documents: readonly DocumentFiche[]): DocumentFiche[] {
  return documents.filter((d) => d.type !== 'AVIS');
}

/** Ce que la PRMP lit quand l'avis n'est pas encore disponible (`null` : rien à montrer). */
export function messageIndisponible(raison: RaisonAvisIndisponible | null): string | null {
  switch (raison) {
    case null:
    case 'CATEGORIE_SANS_AVIS':
      return null;
    case 'SANS_DOSSIER':
      return 'L’avis s’imprime une fois le dossier soumis, examiné, et son PV signé avec un avis favorable.';
    case 'PV_NON_SIGNE':
      return 'L’avis s’imprime quand le PV de la Commission est signé avec un avis favorable.';
    case 'AVIS_NON_FAVORABLE':
      return 'Le PV signé ne porte pas d’avis favorable : il n’y a pas d’avis spécifique à publier.';
    case 'RESERVES_NON_LEVEES':
      return 'PV favorable avec réserves : l’avis s’imprimera après la levée des réserves, sur le DAO corrigé.';
    case 'FICHE_NON_VALIDEE':
      return 'Aucune version validée de la fiche : l’avis ne peut pas être produit.';
    default:
      return 'L’avis spécifique n’est pas encore disponible pour ce dossier.';
  }
}

/** Les informations de la fiche que l'avis imprime, hors celles qui sont toujours renseignées (plan, dates, remise). */
const CODES_IMPRIMES = ['B04-DS-05', 'B04-DS-07', 'B04-DS-08', 'B04-DS-09', 'B04-DS-10'];
const CODES_GARANTIE = ['B05-GS-03', 'B05-GQ-03'];

/**
 * Les informations imprimées par l'avis et encore vides dans la fiche : l'avis mettrait des pointillés à leur place.
 * Seuls comptent les champs servis à cette forme (le référentiel de la fiche) ; le montant de la garantie ne compte
 * que si une garantie est exigée, et, s'il est saisi par lot, chaque lot compte.
 */
export function champsVidesAvis(
  champs: readonly ChampFiche[],
  valeurs: Readonly<Record<string, unknown>>,
  cadrage: Cadrage,
  nbLots: number,
  saisieParLot: boolean,
): ChampFiche[] {
  const vide = (cle: string) => valeurs[cle] == null || String(valeurs[cle]).trim() === '';
  const garantie = String(cadrage['garantieSoumission'] ?? '') === 'OUI';
  return champs.filter((c) => {
    if (c.actif === false) return false;
    if (CODES_IMPRIMES.includes(c.code)) return vide(c.code);
    if (!garantie || !CODES_GARANTIE.includes(c.code)) return false;
    if (c.parLot && saisieParLot && nbLots > 0) return Array.from({ length: nbLots }, (_, i) => `${c.code}#${i + 1}`).some(vide);
    return vide(c.code);
  });
}

/** `AAAA-MM-JJ` (ou un horodatage ISO) → `JJ/MM/AAAA`. */
export function jjmmaaaa(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Un horodatage ISO → `JJ/MM/AAAA à HH:MM`. */
export function horodatage(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]} à ${m[4]}:${m[5]}` : jjmmaaaa(iso);
}
