import { NatureAmi } from '../../models';

/**
 * ⚠️ V161 (03/11, « appel-offres-restreint », §B4) — les mots d'un même parcours selon sa nature : l'appel à manifestation d'intérêt
 * des prestations intellectuelles, ou l'appel à candidatures de l'appel d'offres restreint. Source unique des écrans de la PRMP, de la
 * commission et du candidat ; une nature absente (réponse antérieure à V161) vaut `AMI`.
 */
export interface LibellesAppel {
  /** « Appel à manifestation d'intérêt » / « Appel à candidatures ». */
  titre: string;
  /** Avec l'article défini : « l'appel à manifestation d'intérêt » / « l'appel à candidatures ». */
  le: string;
  /** Ce que dépose le candidat, au singulier et au pluriel. */
  depot: string;
  depots: string;
  /** Le document que signe la commission. */
  rapport: string;
  /** Le dossier qui suit la liste. */
  suite: string;
  /** Les invités de la liste. */
  invites: string;
}

const AMI: LibellesAppel = {
  titre: 'Appel à manifestation d’intérêt',
  le: 'l’appel à manifestation d’intérêt',
  depot: 'expression d’intérêt',
  depots: 'expressions d’intérêt',
  rapport: 'rapport de présélection',
  suite: 'dossier de la demande de propositions',
  invites: 'consultants',
};

const CANDIDATURES: LibellesAppel = {
  titre: 'Appel à candidatures',
  le: 'l’appel à candidatures',
  depot: 'candidature',
  depots: 'candidatures',
  rapport: 'procès-verbal de validation de la liste restreinte',
  suite: 'dossier d’appel d’offres restreint',
  invites: 'candidats',
};

export function libellesAppel(nature: NatureAmi | null | undefined): LibellesAppel {
  return nature === 'APPEL_CANDIDATURES' ? CANDIDATURES : AMI;
}

/** Première lettre en capitale (« Candidatures déposées »). */
export function capitale(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
