import { EtapeCircuit, GesteAFaire, ModeTache, SectionAFaire, UrgenceTache } from '../../../models';
import { NomIcone } from '../../../shared/ui/icone';

/**
 * Libellés français de l'accueil « À faire » — fichier UNIQUE : le serveur ne sert que des codes
 * (demande 2026-09-14-accueil-a-faire, §2 et §7). Tout nouveau code serveur s'ajoute ici, et TypeScript
 * refuse de compiler tant qu'il manque (tables `Record` exhaustives).
 */

export interface LibelleSection {
  titre: string;
  /** Sous-titre quand la section n'a pas de délai standard (sinon « Délai standard N h »). */
  sansStandard: string;
}

export const LIBELLES_SECTIONS: Readonly<Record<SectionAFaire, LibelleSection>> = {
  A_RECEPTIONNER: { titre: 'À réceptionner et numéroter', sansStandard: 'Sans délai standard' },
  A_DISPATCHER: { titre: 'À dispatcher', sansStandard: 'Sans délai standard' },
  A_EXAMINER: { titre: 'À examiner', sansStandard: 'Sans délai standard' },
  A_REEXAMINER: { titre: 'À réexaminer', sansStandard: 'Pièces complémentaires reçues' },
  PV_A_SOUMETTRE: { titre: 'Projets de PV à soumettre', sansStandard: 'Sans délai standard' },
  PV_A_REPRENDRE: { titre: 'Projets de PV à reprendre', sansStandard: 'Retournés pour rectification' },
  PV_A_ACCEPTER: { titre: 'Projets de PV à accepter', sansStandard: 'Sans délai standard' },
  PV_A_VISER: { titre: 'Projets de PV à viser', sansStandard: 'Sans délai standard' },
  PV_A_SIGNER: { titre: 'PV à signer', sansStandard: 'Sans délai standard' },
  LETTRES_A_SIGNER: { titre: 'Lettres de renvoi à signer', sansStandard: 'Sans délai standard' },
  RETRAITS_A_DECIDER: { titre: 'Demandes de retrait', sansStandard: 'Sans délai standard' },
  A_VERIFIER: { titre: 'À vérifier', sansStandard: 'Sans délai standard' },
  A_TRANSMETTRE_SIGMP: { titre: 'Observations levées, à transmettre à SIGMP', sansStandard: 'Sans délai standard' },
  A_ARCHIVER: { titre: 'PV à archiver', sansStandard: 'Sans délai standard' },
  LETTRES_A_ARCHIVER: { titre: 'Lettres de renvoi à archiver', sansStandard: 'Sans délai standard' },
  EN_ATTENTE_PRMP: { titre: 'En attente de la PRMP', sansStandard: 'Compteur suspendu' },
  BROUILLONS: { titre: 'Brouillons à soumettre', sansStandard: 'Pas encore transmis à la CNM' },
  PIECES_DEPOT_A_COMPLETER: { titre: 'Pièces du dépôt à compléter', sansStandard: 'Le délai de la CNM est suspendu' },
  COMPLEMENTS_A_TRANSMETTRE: { titre: 'Pièces complémentaires à transmettre', sansStandard: 'Le délai de la CNM est suspendu' },
  A_RECTIFIER: { titre: 'À rectifier', sansStandard: 'Le délai de la CNM est suspendu' },
  EN_COURS_CNM: { titre: 'En cours à la CNM', sansStandard: 'Aucune action attendue' },
};

/** L'UGPM prépare sans soumettre (arbitrage 6 du 2026-09-15) : ses brouillons sont « à compléter ». */
export const TITRE_BROUILLONS_UGPM = 'Brouillons à compléter';

/**
 * ⚠️ 2026-09-15 (recette) — UNE action, UN verbe : chez le Président, la ligne disait « Dispatcher » et
 * le bouton de l'aperçu « Attribuer le dossier à un Membre ». Le libellé long (aperçu : « Prochaine
 * action » et bouton principal) reprend désormais le verbe du bouton de ligne et n'y ajoute qu'un
 * complément (« Dispatcher le dossier », « Numéroter le dépôt ») — règle vérifiée par un test.
 */
export interface LibelleGeste {
  /** Bouton de la ligne. */
  court: string;
  /** « Prochaine action » et bouton de l'aperçu : le MÊME verbe que `court`, plus un complément. */
  long: string;
  icone: NomIcone;
}

export const LIBELLES_GESTES: Readonly<Record<GesteAFaire, LibelleGeste>> = {
  NUMEROTER: { court: 'Numéroter', long: 'Numéroter le dépôt', icone: 'hash' },
  DISPATCHER: { court: 'Dispatcher', long: 'Dispatcher le dossier', icone: 'send' },
  EXAMINER: { court: 'Examiner', long: 'Examiner le dossier', icone: 'search' },
  REATTRIBUER: { court: 'Attribuer à un Membre', long: 'Attribuer le dossier à un Membre', icone: 'users' },
  REEXAMINER: { court: 'Réexaminer', long: 'Réexaminer avec les pièces complémentaires', icone: 'search' },
  SOUMETTRE_PV: { court: 'Soumettre le PV', long: 'Soumettre le projet de PV', icone: 'send' },
  REPRENDRE_EXAMEN: { court: "Reprendre l'examen", long: "Reprendre l'examen retourné", icone: 'edit' },
  ACCEPTER: { court: 'Accepter', long: 'Accepter le projet de PV', icone: 'check' },
  RETOURNER: { court: 'Retourner', long: 'Retourner le projet pour rectification', icone: 'return' },
  VISER: { court: 'Viser', long: 'Viser le projet de PV', icone: 'pen' },
  LETTRE_RENVOI: { court: 'Lettre', long: 'Lettre de renvoi', icone: 'mail' },
  SIGNER: { court: 'Signer ma part', long: 'Signer ma part du PV', icone: 'pen' },
  SIGNER_LETTRE: { court: 'Signer la lettre', long: 'Signer la lettre de renvoi', icone: 'pen' },
  DECIDER_RETRAIT: { court: 'Examiner la demande', long: 'Examiner la demande de retrait', icone: 'undo' },
  VERIFIER: { court: 'Vérifier', long: 'Vérifier les observations du PV', icone: 'shield' },
  TRANSMETTRE_DECISION: { court: 'Transmettre la décision', long: 'Transmettre la décision à SIGMP', icone: 'send' },
  TRANSMETTRE_SIGMP: { court: 'Transmettre à SIGMP', long: 'Transmettre la décision à SIGMP', icone: 'send' },
  ARCHIVER_PV: { court: 'Archiver', long: 'Archiver le PV', icone: 'archive' },
  ARCHIVER_LETTRE: { court: 'Archiver', long: 'Archiver la lettre de renvoi', icone: 'archive' },
  VOIR: { court: 'Voir', long: 'Voir le dossier', icone: 'eye' },
  SOUMETTRE: { court: 'Soumettre', long: 'Soumettre le dossier', icone: 'send' },
  COMPLETER_BROUILLON: { court: 'Compléter', long: 'Compléter le brouillon', icone: 'edit' },
  COMPLETER_PIECES_DEPOT: { court: 'Compléter les pièces', long: 'Compléter les pièces du dépôt', icone: 'clip' },
  TRANSMETTRE_COMPLEMENTS: { court: 'Transmettre les pièces', long: 'Transmettre les pièces complémentaires', icone: 'clip' },
  RECTIFIER: { court: 'Rectifier', long: 'Rectifier puis resoumettre le dossier', icone: 'edit' },
  SUIVRE: { court: 'Suivre', long: "Suivre l'avancement à la CNM", icone: 'eye' },
};

/** Libellé de compteur par classe d'urgence (côté CNM). */
export const LIBELLES_URGENCES: Readonly<Record<UrgenceTache, string>> = {
  EN_RETARD: 'en retard',
  BIENTOT: 'bientôt à échéance',
  DANS_LES_DELAIS: 'dans les délais',
  SANS_DELAI: 'sans délai',
  HORS_DELAI: 'hors délai CNM',
  EN_PAUSE: 'chez la PRMP',
  SUIVI: 'en suivi',
};

/** À quel titre une ligne du bloc délégation est réalisable. */
export const LIBELLES_MODES: Readonly<Record<ModeTache, string>> = {
  TITULAIRE: 'Titulaire',
  DELEGATION: 'Par délégation',
  INTERIM: 'Par intérim',
  COLLEGUE: "Dossier d'un collègue",
  SUPPLEANCE: 'En suppléance',
};

/** Étape chronométrée en cours (« Étape : visa du projet de PV »). */
export const LIBELLES_ETAPES_CIRCUIT: Readonly<Record<EtapeCircuit, string>> = {
  RECEPTION: 'réception',
  DISPATCH: 'dispatch',
  EXAMEN: 'examen',
  VISA: 'visa du projet de PV',
  COSIGNATURE: 'signature du PV',
  VERIFICATION: 'vérification',
  TRANSMISSION_SIGMP: 'transmission à SIGMP',
  ARCHIVAGE: 'archivage',
  RECTIFICATION_PRMP: 'rectification par la PRMP',
};

/** Avis d'examen (référentiel `tr_avis`) ; un code inconnu s'affiche tel quel. */
export const LIBELLES_AVIS: Readonly<Record<string, string>> = {
  FAV: 'Favorable',
  FAVR: 'Favorable avec réserves',
  DEF: 'Défavorable',
};
