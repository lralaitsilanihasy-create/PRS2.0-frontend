import { LigneEligible, NoeudFiliation } from '../../../models';

/** Étape d'une ligne du plan, dans l'ordre de la procédure. */
export type EtapeLigne = 'aucune' | 'lancer' | 'preparation' | 'commission' | 'lancee' | 'marche';

/**
 * ⚠️ 03/11 (pilote) — la couleur d'une ligne du plan selon son étape (familles de la palette) : rien pour une ligne sans étape,
 * couleurs vives (pilote, 03/11 ; jetons --suivi-*-fond) : bleu pour une ligne à lancer, ambre tant qu'elle se prépare ou passe à la Commission, vert une fois lancée ou au marché.
 */
export type TeinteLigne = 'lancer' | 'examen' | 'favorable';

export const TEINTE_ETAPE: Readonly<Record<EtapeLigne, TeinteLigne | null>> = {
  aucune: null, lancer: 'lancer', preparation: 'examen', commission: 'examen', lancee: 'favorable', marche: 'favorable',
};

export const ETAPES_LIGNE: readonly { cle: EtapeLigne; libelle: string }[] = [
  { cle: 'aucune', libelle: 'Sans étape définie' },
  { cle: 'lancer', libelle: 'À lancer' },
  { cle: 'preparation', libelle: 'En préparation' },
  { cle: 'commission', libelle: 'À la Commission' },
  { cle: 'lancee', libelle: 'Lancée' },
  { cle: 'marche', libelle: 'Dossier de marché' },
];

/** Le suivi affiché en marge de la ligne : son étape, ce qui la porte, et la famille de couleur (`.badge-*`). */
export interface SuiviLigne {
  etape: EtapeLigne;
  libelle: string;
  precision: string | null;
  famille: 'neutre' | 'examen' | 'favorable';
}

/** Statuts d'un dossier encore au circuit de la Commission (ni brouillon, ni clôturé). */
const HORS_CIRCUIT = new Set(['BROUILLON', 'CLOTURE', 'DECISION_TRANSMISE_SIGMP', 'RETIRE', 'REMPLACE']);
const CLOS = new Set(['CLOTURE', 'DECISION_TRANSMISE_SIGMP']);

const normaliser = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
/** La référence ; sans elle, « brouillon » ou, déposé mais pas encore reçu par la CNM, « soumis » (04/11). */
const ref = (n: NoeudFiliation): string => n.refeDossier || (n.statut === 'BROUILLON' ? 'brouillon' : 'soumis');

/**
 * ⚠️ 03/11 (pilote, maquette « espace PRMP », lot 2) — l'étape d'une ligne du plan, lue sur ses dossiers (`noeuds` : la filiation de
 * la ligne, sans le plan) et, pour un appel d'offres, sur sa fiche (`e`, `GET /api/dmcs/eligibles`). La consultation de prix reste
 * « sans étape définie » tant que le pilote n'a pas dit quel dossier elle produit.
 */
export function suiviDeLigne(e: LigneEligible | undefined, noeuds: readonly NoeudFiliation[], modeLibelle: string | null): SuiviLigne {
  const visibles = noeuds.filter((n) => !n.masque);
  const marches = visibles.filter((n) => n.lien === 'MARCHE');
  if (marches.length) {
    const lots = marches.length > 1 ? `${marches.length} lots` : ref(marches[0]);
    return { etape: 'marche', libelle: 'Dossier de marché', precision: lots, famille: 'favorable' };
  }
  const mec = visibles.find((n) => n.lien === 'MISE_EN_CONCURRENCE');
  const rapport = mec?.idSousType === 'RJ';
  if (mec) {
    const statut = mec.statut ?? '';
    const quoi = rapport ? 'Rapport justificatif' : 'Mise en concurrence';
    if (statut === 'BROUILLON') return { etape: 'preparation', libelle: quoi, precision: 'Brouillon', famille: 'examen' };
    if (!HORS_CIRCUIT.has(statut)) return { etape: 'commission', libelle: 'À la Commission', precision: ref(mec), famille: 'examen' };
    if (CLOS.has(statut)) return { etape: 'lancee', libelle: rapport ? 'Rapport clôturé' : 'Lancée', precision: ref(mec), famille: 'favorable' };
  }
  if (e) {
    if (!e.dejaDao) return { etape: 'lancer', libelle: 'À lancer', precision: 'Informations du DAO', famille: 'neutre' };
    const validee = e.fiche?.statut === 'VALIDEE';
    return { etape: 'preparation', libelle: 'Informations du DAO', precision: validee ? 'Validées' : 'Brouillon', famille: 'examen' };
  }
  if (modeLibelle && normaliser(modeLibelle).includes('GRE A GRE')) {
    return { etape: 'lancer', libelle: 'À lancer', precision: 'Rapport justificatif', famille: 'neutre' };
  }
  return { etape: 'aucune', libelle: 'Sans étape définie', precision: modeLibelle, famille: 'neutre' };
}
