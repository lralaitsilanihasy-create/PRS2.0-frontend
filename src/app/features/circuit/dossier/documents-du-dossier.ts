import { PieceJointeDossier } from '../../../models';
import { controlesEffectifs } from '../../../shared/circuit/controles-libelles';
import { DossierContenuStore } from './dossier-contenu.store';
import { OngletPieceFournie, ongletDuFichier } from './dossier-pieces';

/** Les éléments d'un dossier de procédure : les onglets (ou, sur la page du dossier né d'une fiche, les boutons qui ouvrent la modale). */
export type OngletDossier = OngletPieceFournie | 'pieces' | 'figes' | 'controles';

export interface DocumentDuDossier {
  cle: OngletDossier;
  libelle: string;
  /** Un compteur (pièces, écrans figés, contrôles). */
  n?: number;
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
export function documentsDuDossier(contenu: DossierContenuStore): DocumentDuDossier[] {
  const d = contenu.dossier();
  const liste: DocumentDuDossier[] = [];
  if (d.idDmc) {
    const avis = fichiersDeLOnglet(contenu.pieces(), 'avis');
    liste.push({ cle: 'presentation', libelle: 'Fiche de présentation', teinte: 'vert' }, { cle: 'fiche-dao', libelle: 'Fiche DAO' });
    if (avis.length) {
      const lettre = avis.some((p) => (p.nomFichier ?? '').startsWith('LETTRE_PROJET_'));
      liste.push({ cle: 'avis', libelle: lettre ? 'Lettre d’invitation' : 'Avis spécifique' });
    }
    liste.push({ cle: 'plan', libelle: 'Plan de passation', teinte: 'bleu' });
    // Produit par l'application hors contrat-cadre (manuel p. 32).
    if (d.ficheMarche?.typeMarche !== 'CONTRAT_CADRE') liste.push({ cle: 'canevas', libelle: 'Canevas de rapport' });
    liste.push({ cle: 'bordereau', libelle: 'Bordereau estimatif' });
  }
  liste.push({ cle: 'pieces', libelle: 'Pièces jointes', n: contenu.pieces().length });
  if (contenu.instantanesVisible()) liste.push({ cle: 'figes', libelle: 'Écrans figés', n: contenu.instantanes().length, teinte: 'gris' });
  if (contenu.controlesVisible()) liste.push({ cle: 'controles', libelle: 'Contrôles', n: controlesEffectifs(contenu.controles()).length, teinte: 'vert' });
  return liste;
}
