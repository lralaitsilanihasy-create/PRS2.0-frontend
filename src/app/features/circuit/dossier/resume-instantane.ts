import { jjmmaaaa } from '../../../shared/prmp/avis-specifique-modele';

/**
 * ⚠️ 01/11 (pilote, maquette « Écrans figés », variante A) — la ligne de résumé d'un écran figé, sous son nom dans le sommaire :
 * le fait qui le distingue (« avis publié le 15/07/2026 », « 2 membres · décision du 06/07/2026 », l'attributaire proposé…). Lue sur
 * le JSON figé ; une donnée absente donne une ligne vide plutôt qu'une supposition.
 */
type Json = Record<string, unknown>;

const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const liste = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const date = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? jjmmaaaa(v.slice(0, 10)) : '');
const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function resumeInstantane(ecran: string, donnees: unknown): string {
  const d = obj(donnees);
  switch (ecran) {
    case 'PLAN': {
      const v = obj(d['valeurs']);
      return [v['MONTANT_ESTIMATIF'] ? `${v['MONTANT_ESTIMATIF']} Ar` : '', v['FORME_MARCHE'] ?? ''].filter(Boolean).join(' · ');
    }
    case 'AVIS': {
      const publie = liste(d['documents']).map((x) => date(obj(x['publication'])['datePublication'])).find(Boolean);
      if (publie) return `avis publié le ${publie}`;
      return obj(d['avis'])['disponible'] === true ? 'avis non encore publié' : '';
    }
    case 'CAO': {
      const membres = liste(d['membres']).length;
      const le = date(obj(d['decision'])['date']);
      return [membres ? pluriel(membres, 'membre') : '', le ? `décision du ${le}` : ''].filter(Boolean).join(' · ');
    }
    case 'SEANCE': {
      const le = date(d['ouverteLe']);
      const offres = liste(d['offres']).length;
      const pv = obj(d['pv']);
      return [le ? `ouverte le ${le}` : '', offres ? pluriel(offres, 'offre') : '', pv['signe'] === true ? 'PV signé' : pv['produit'] === true ? 'PV non signé' : '']
        .filter(Boolean).join(' · ');
    }
    case 'EVALUATION': {
      const r = obj(d['rapport']);
      if (r['signe'] === true) return `rapport signé le ${date(r['signeLe'])}`.trim();
      return r['produitLe'] ? 'rapport produit, non signé' : 'évaluation en cours';
    }
    case 'ATTRIBUTION': {
      const lots = liste(d['lots']);
      const candidats = lots.map((l) => obj(l['proposition'])['candidat']).filter((c): c is string => typeof c === 'string' && !!c);
      if (lots.length === 1 && candidats.length) return candidats[0];
      return lots.length ? pluriel(lots.length, 'lot') : '';
    }
    default:
      return '';
  }
}
