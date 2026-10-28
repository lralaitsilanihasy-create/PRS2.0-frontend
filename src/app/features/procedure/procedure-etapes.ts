import { ProcedureInterne } from '../../models';
import { dateHeureFr } from '../candidat/libelles-candidat';

/**
 * ⚠️ 28/10 (pilote : « améliorer la présentation ») — la vue du responsable d'une procédure en carte : la frise des étapes de la
 * procédure et la prochaine étape, en clair. Tout se déduit de `GET /api/fiches-marche/en-ligne` ; rien n'est inventé.
 */
export type EtatEtapeProcedure = 'fait' | 'encours' | 'avenir';
export interface EtapeProcedure {
  libelle: string;
  detail: string;
  etat: EtatEtapeProcedure;
}

/** Le geste que la carte met en avant, ou aucun quand la suite attend quelqu'un d'autre. */
export type GesteProcedure = 'parametres' | 'seance' | null;
export interface ProchaineEtape {
  texte: string;
  /** Qui doit agir : vous, la PRMP, les candidats… */
  qui: string;
  geste: GesteProcedure;
}

const SEANCE_FINIE = ['CLOSE'];

export function etapesProcedure(p: ProcedureInterne): EtapeProcedure[] {
  const caoOk = p.etatCao === 'COMPLETE';
  const clesOk = p.etatCeremonie === 'CLOSE';
  const lancee = p.etat !== 'NON_LANCEE';
  const depotsClos = p.etat === 'CLOSE';
  const seanceFinie = !!p.etatSeance && SEANCE_FINIE.includes(p.etatSeance);
  const offres = `${p.nbOffres} ${p.nbOffres > 1 ? 'offres' : 'offre'}`;
  const etapes: EtapeProcedure[] = [
    { libelle: 'Commission', detail: caoOk ? 'constituée' : 'à constituer', etat: caoOk ? 'fait' : 'encours' },
    { libelle: 'Cérémonie des clés', detail: clesOk ? 'close, clés publiées' : 'clés à publier', etat: clesOk ? 'fait' : caoOk ? 'encours' : 'avenir' },
    {
      libelle: 'Avis publié',
      detail: p.datePublication ? `le ${jour(p.datePublication)}` : 'par la PRMP',
      etat: lancee ? 'fait' : clesOk ? 'encours' : 'avenir',
    },
    {
      libelle: 'Dépôt des offres',
      detail: depotsClos ? `clos · ${offres}` : p.dateLimite ? `jusqu’au ${dateHeureFr(p.dateLimite)}` : '—',
      etat: depotsClos ? 'fait' : lancee ? 'encours' : 'avenir',
    },
    {
      libelle: 'Séance d’ouverture',
      detail: seanceFinie ? 'close' : p.dateOuverturePlis ? dateHeureFr(p.dateOuverturePlis) : 'après la date limite',
      etat: seanceFinie ? 'fait' : depotsClos ? 'encours' : 'avenir',
    },
  ];
  return etapes;
}

export function prochaineEtape(p: ProcedureInterne): ProchaineEtape {
  if (p.etatCao !== 'COMPLETE') {
    return { qui: 'La PRMP', texte: 'Constituer la commission d’appel d’offres : la cérémonie des clés en dépend.', geste: null };
  }
  if (p.etatCeremonie !== 'CLOSE') {
    return { qui: 'Vous', texte: 'Conduire la cérémonie des clés : chaque membre publie sa clé, puis vous la clôturez.', geste: 'parametres' };
  }
  if (p.etat === 'NON_LANCEE') {
    return { qui: 'La PRMP', texte: 'Imprimer l’avis spécifique : la procédure paraîtra alors dans l’espace candidat.', geste: null };
  }
  if (p.etat === 'A_VENIR') {
    return { qui: 'Les candidats', texte: p.dateOuvertureDepots ? `Les dépôts ouvrent le ${dateHeureFr(p.dateOuvertureDepots)}.` : 'Les dépôts vont ouvrir.', geste: null };
  }
  if (p.etat === 'OUVERTE') {
    const offres = `${p.nbOffres} ${p.nbOffres > 1 ? 'offres reçues' : 'offre reçue'}`;
    return { qui: 'Les candidats', texte: `Dépôts ouverts : ${offres}${p.dateLimite ? `, jusqu’au ${dateHeureFr(p.dateLimite)}` : ''}.`, geste: null };
  }
  if (p.etatSeance && SEANCE_FINIE.includes(p.etatSeance)) {
    return { qui: 'Vous', texte: 'Séance close : poursuivre l’évaluation des offres.', geste: 'seance' };
  }
  return { qui: 'Vous', texte: `Conduire la séance d’ouverture des plis${p.dateOuverturePlis ? ` (${dateHeureFr(p.dateOuverturePlis)})` : ''}.`, geste: 'seance' };
}

/** « 2026-11-16… » → « 16/11/2026 ». */
function jour(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
