import { Notification } from '../../models';
import type { CleEspaceExterne } from './espace-externe-layout';

/** Les notifications de l'évaluation des offres : elles mènent à l'écran d'évaluation de la procédure (membres de la CAO). */
const EVALUATION_CAO: ReadonlySet<string> = new Set([
  'EVALUATION_OUVERTE',
  'EVALUATION_REPRISE',
  'EVALUATION_ETAPE',
  'RAPPORT_A_SIGNER',
  'RAPPORT_RETIRE',
  'RAPPORT_EVALUATION',
  'NEGOCIATION',
]);

/** La réception des commandes (lot MS-4) : son écran propre, l'objet n'est pas une procédure. */
const RECEPTION_CAO: ReadonlySet<string> = new Set(['COMMISSION_RECEPTION', 'RECEPTION_A_SIGNER', 'LIVRAISON_DECLAREE', 'DECISION_RECEPTION']);

/**
 * ⚠️ 29/10 (pilote, PRS20 51351b2) — l'écran qu'ouvre une notification dans un espace externe. Le serveur porte
 * `typeObjet = PROCEDURE` et `idObjet = idDmc` sur toutes les notifications des membres et du dépositaire (B3) ; `null` quand
 * la notification ne mène à aucun écran de l'espace (la ligne reste lisible, sans bouton).
 */
export function routeNotificationExterne(n: Notification, espace: CleEspaceExterne): string[] | null {
  const type = n.typeNotif ?? '';
  if (espace === 'cao' && RECEPTION_CAO.has(type)) return ['/cao/receptions'];
  if (n.typeObjet !== 'PROCEDURE' || n.idObjet == null) return null;
  const procedure = [`/${espace}/procedures`, String(n.idObjet)];
  if (espace === 'cao' && EVALUATION_CAO.has(type)) return [...procedure, 'evaluation'];
  return procedure;
}
