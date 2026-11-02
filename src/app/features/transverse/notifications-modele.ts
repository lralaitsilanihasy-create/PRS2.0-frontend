import { NomIcone } from '../../shared/ui/icone';

/**
 * ⚠️ 01/11 (pilote, maquette « Notifications », variante A) — règles pures de l'écran des notifications : ce qui demande un geste,
 * le ton de l'icône, l'intitulé du geste, et le texte rendu lisible quand le marché est nommé à part.
 */

/** Les notifications qui demandent un geste au destinataire (pastille « à faire », filtre « Demandent une action »). */
const TYPES_ACTION: ReadonlySet<string> = new Set([
  'AVIS_A_IMPRIMER', 'RECU_A_VALIDER', 'RECEPTION_A_SIGNER', 'ECHEANCE_AVIS_ATTRIBUTION', 'LIVRAISON_DECLAREE',
  'PIECES_ATTRIBUTAIRE_DEPOSEES',
]);

/** Une notification demande-t-elle un geste ? Les types listés, et tout type « …_A_<verbe> » (à examiner, à vérifier, à signer…). */
export function demandeAction(type: string | null | undefined): boolean {
  if (!type) return false;
  return TYPES_ACTION.has(type) || /(^|_)A_[A-Z]+$/.test(type);
}

/** Les bonnes nouvelles : un document prêt, signé, publié, une décision transmise. */
const TYPES_POSITIFS = /(SIGNE|PRET|PUBLIEES?|PRONONCEE|TRANSMISE_SIGMP|PV_OUVERTURE|APPROUVE)$/;

export type TonNotification = 'action' | 'positif' | 'neutre';

export function tonNotification(type: string | null | undefined): TonNotification {
  if (demandeAction(type)) return 'action';
  return type && TYPES_POSITIFS.test(type) ? 'positif' : 'neutre';
}

export function iconeNotification(ton: TonNotification): NomIcone {
  return ton === 'action' ? 'alert' : ton === 'positif' ? 'check' : 'bell';
}

/** L'intitulé du geste, au bout de la ligne ; « Ouvrir » à défaut. */
const GESTES: Readonly<Record<string, string>> = {
  AVIS_A_IMPRIMER: 'Imprimer l’avis',
  RECU_A_VALIDER: 'Valider le reçu',
  RECEPTION_A_SIGNER: 'Signer le PV de réception',
  ECHEANCE_AVIS_ATTRIBUTION: 'Publier l’avis d’attribution',
  LIVRAISON_DECLAREE: 'Établir la réception',
  PIECES_ATTRIBUTAIRE_DEPOSEES: 'Vérifier la pièce',
  DAO_COMPLET_PRET: 'Ouvrir les informations du DAO',
  PV_SIGNE: 'Lire le PV',
  DEPOTS_CLOS: 'Voir les dépôts',
};

export function gesteNotification(type: string | null | undefined): string {
  return (type && GESTES[type]) || 'Ouvrir';
}

/**
 * Le texte servi, une fois le marché nommé à part : « Procédure 5, lot 1 : 20 jours… » → « Lot 1 : 20 jours… », « de la procédure 2 »
 * → « de cette procédure », « (lot 1, procédure 5) » → « (lot 1) ». Les heures perdent leurs secondes (« 08:00:00 » → « 08:00 »).
 */
export function corpsLisible(corps: string | null | undefined, marcheNomme: boolean): string {
  let t = (corps ?? '').replace(/\b(\d{2}:\d{2}):\d{2}\b/g, '$1');
  if (!marcheNomme) return t;
  t = t.replace(/^Procédure \d+, (lot \d+)/, (_m, lot: string) => lot.charAt(0).toUpperCase() + lot.slice(1));
  t = t.replace(/^Procédure \d+ : /, '');
  t = t.replace(/\((lot \d+), procédure \d+\)/g, '($1)');
  t = t.replace(/\b(de|à) la procédure \d+\b/g, '$1 cette procédure');
  t = t.replace(/\bla procédure \d+\b/g, 'cette procédure');
  return t;
}
