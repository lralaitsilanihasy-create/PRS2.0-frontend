import { PieceJointeDossier } from '../../../models';
import { controlesEffectifs } from '../../../shared/circuit/controles-libelles';
import { DossierContenuStore } from './dossier-contenu.store';
import { OngletPieceFournie, avecProcedure, ongletDuFichier } from './dossier-pieces';

/** Les éléments d'un dossier de procédure : les onglets (ou, sur la page du dossier né d'une fiche, les boutons qui ouvrent la modale). */
export type OngletDossier = OngletPieceFournie | 'pieces' | 'figes' | 'controles';

export interface DocumentDuDossier {
  cle: OngletDossier;
  libelle: string;
  /** Un compteur (pièces, écrans figés, contrôles). */
  n?: number;
  /** ⚠️ 18/10 (pilote) — une ligne de résumé pour la carte de la page (les onglets ne l'affichent pas). */
  resume?: string;
  /** La teinte de l'onglet, reprise des onglets du dossier de planification. */
  teinte?: 'vert' | 'bleu' | 'gris';
}

/** Les fichiers produits par la fiche que montre un élément (hors pièces d'après lettre de renvoi). */
export function fichiersDeLOnglet(pieces: readonly PieceJointeDossier[], onglet: OngletPieceFournie): PieceJointeDossier[] {
  return pieces.filter((p) => !p.apresLettreRenvoi && ongletDuFichier(p, true) === onglet);
}

/**
 * ⚠️ 17-18/10 (pilote) — la liste des éléments d'un dossier de procédure, dans l'ordre : pour un dossier né d'une fiche, ses données
 * (fiche de présentation, fiche DAO, avis, plan, canevas, bordereau) avant les pièces jointes ; puis les écrans figés et les
 * contrôles quand ils existent. Source unique des onglets et des boutons de la page du dossier.
 */
export function documentsDuDossier(contenu: DossierContenuStore, manquantes = 0): DocumentDuDossier[] {
  const d = contenu.dossier();
  const f = d.ficheMarche;
  const version = f ? `version ${f.versionSoumise || f.version}${f.versionSoumise ? ' soumise' : ''}` : '';
  const liste: DocumentDuDossier[] = [];
  if (d.idDmc) {
    const avis = fichiersDeLOnglet(contenu.pieces(), 'avis');
    // ⚠️ 28/10 (pilote) — le plan de passation avant la fiche DAO, comme les onglets de l'examen.
    liste.push(
      { cle: 'presentation', libelle: 'Fiche de présentation', teinte: 'vert', resume: 'Identification, marché, procédure et cohérence avec l’AGPM' },
      { cle: 'plan', libelle: 'Plan de passation', teinte: 'bleu', resume: d.idDossierPlan
        ? `Plan n° ${d.idDossierPlan}${d.idPvPlan ? ` · PV n° ${d.idPvPlan} signé` : ' · PV non signé'}` : 'Plan hors de l’application' },
      { cle: 'fiche-dao', libelle: 'Fiche DAO', resume: [f?.statut === 'VALIDEE' ? 'Validée' : 'Brouillon', version,
        f?.nbAttendus ? `${f.nbSaisis ?? 0} sur ${f.nbAttendus} informations` : ''].filter(Boolean).join(' · ') },
    );
    if (avis.length) {
      const lettre = avis.some((p) => (p.nomFichier ?? '').startsWith('LETTRE_PROJET_'));
      liste.push({ cle: 'avis', libelle: lettre ? 'Lettre d’invitation' : 'Avis spécifique', resume: 'Les mentions du modèle type, avec leurs valeurs' });
    }
    // Produit par l'application hors contrat-cadre (manuel p. 32).
    if (f?.typeMarche !== 'CONTRAT_CADRE') liste.push({ cle: 'canevas', libelle: 'Canevas de rapport', resume: 'Plan du rapport d’évaluation, à remplir par la commission' });
    liste.push({ cle: 'bordereau', libelle: 'Bordereau estimatif', resume: 'Prix unitaires estimés et total face au plan' });
  } else if (d.procedure) {
    // ⚠️ 20/10 (pilote, « dossier-marche-donnees ») — le dossier de marché né d'une attribution : sa procédure, lue en données.
    const p = d.procedure;
    liste.push(
      { cle: 'presentation', libelle: 'Fiche de présentation', teinte: 'vert', resume: 'Identification, marché, procédure et attribution' },
      { cle: 'pv-cnm', libelle: 'PV de la Commission sur le DAO', resume: p.refeDossierMiseEnConcurrence ? 'Dossier ' + p.refeDossierMiseEnConcurrence : 'Le dossier de mise en concurrence' },
      { cle: 'fiche-dao', libelle: 'Fiche DAO', resume: 'Le dossier d’appel d’offres de la procédure' },
      // ⚠️ 27/10 (« dossier-marche-remise-papier », P4) — remise papier : ni séance, ni évaluation, ni attribution dans l'application ;
      // leurs pièces papier se lisent dans « Pièces jointes ».
      ...(p.remisePapier ? [] : [
        { cle: 'seance' as const, libelle: 'Séance d’ouverture', teinte: 'bleu' as const, resume: 'La lecture des offres (PV d’ouverture)' },
        { cle: 'evaluation' as const, libelle: 'Rapport d’évaluation', teinte: 'bleu' as const, resume: 'Décisions par offre, classement, signatures (PV de validation)' },
        { cle: 'attribution' as const, libelle: 'Attribution', resume: 'Titulaires proposés, montants, délais ; projet de marché' },
      ]),
      { cle: 'bordereau', libelle: 'Bordereau estimatif', resume: 'Prix unitaires estimés de la fiche' },
    );
  }
  // ⚠️ 18/10 (pilote) — le compteur dit ce que montre « Pièces jointes » : les fichiers produits par la fiche (DAO complet, projet d'avis,
  // bordereau) se lisent dans leur propre élément et n'y comptent pas.
  const avecFiche = avecProcedure(d);
  const nPieces = contenu.pieces().filter((p) => !ongletDuFichier(p, avecFiche)).length;
  liste.push({ cle: 'pieces', libelle: 'Pièces jointes', n: nPieces, resume: manquantes
    ? `${manquantes} obligatoire${manquantes > 1 ? 's' : ''} manquante${manquantes > 1 ? 's' : ''}`
    : nPieces ? `${nPieces} fichier${nPieces > 1 ? 's' : ''} joint${nPieces > 1 ? 's' : ''}` : 'Aucun fichier joint' });
  if (contenu.instantanesVisible()) {
    const n = contenu.instantanes().length;
    liste.push({ cle: 'figes', libelle: 'Écrans figés', n, teinte: 'gris', resume: `${n} écran${n > 1 ? 's' : ''} figé${n > 1 ? 's' : ''} à la soumission` });
  }
  if (contenu.controlesVisible()) {
    const n = controlesEffectifs(contenu.controles()).length;
    liste.push({ cle: 'controles', libelle: 'Contrôles', n, teinte: 'vert', resume: `${n} contrôle${n > 1 ? 's' : ''} du dossier` });
  }
  return liste;
}
