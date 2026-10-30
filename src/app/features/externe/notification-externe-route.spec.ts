import { describe, expect, it } from 'vitest';

import { Notification } from '../../models';
import { routeNotificationExterne } from './notification-externe-route';

const notif = (typeNotif: string, extra: Partial<Notification> = {}): Notification => ({
  idNotification: 1,
  typeNotif,
  typeObjet: 'PROCEDURE',
  idObjet: 2,
  ...extra,
});

describe('routeNotificationExterne (29/10, PRS20 51351b2)', () => {
  it('le PV d’ouverture à signer ouvre la procédure dans l’espace de la CAO', () => {
    expect(routeNotificationExterne(notif('PV_A_SIGNER'), 'cao')).toEqual(['/cao/procedures', '2']);
  });

  it('une étape de l’évaluation ouvre l’écran d’évaluation du membre', () => {
    expect(routeNotificationExterne(notif('EVALUATION_ETAPE'), 'cao')).toEqual(['/cao/procedures', '2', 'evaluation']);
    expect(routeNotificationExterne(notif('RAPPORT_A_SIGNER'), 'cao')).toEqual(['/cao/procedures', '2', 'evaluation']);
  });

  it('le dépositaire et le candidat ouvrent la procédure de leur espace', () => {
    expect(routeNotificationExterne(notif('CLES_PUBLIEES'), 'depositaire')).toEqual(['/depositaire/procedures', '2']);
    expect(routeNotificationExterne(notif('PROCEDURE_INFRUCTUEUSE'), 'candidat')).toEqual(['/candidat/procedures', '2']);
  });

  it('la réception des commandes mène à l’écran des réceptions', () => {
    expect(routeNotificationExterne(notif('RECEPTION_A_SIGNER', { typeObjet: 'COMMANDE', idObjet: 9 }), 'cao')).toEqual(['/cao/receptions']);
    expect(routeNotificationExterne(notif('DECISION_RECEPTION', { typeObjet: 'PROCEDURE', idObjet: 50 }), 'cao')).toEqual(['/cao/receptions']);
  });

  it('une notification sans procédure ne mène nulle part', () => {
    expect(routeNotificationExterne(notif('OFFRE_RECUE', { typeObjet: 'OFFRE' }), 'candidat')).toBeNull();
    expect(routeNotificationExterne(notif('PV_A_SIGNER', { idObjet: undefined }), 'cao')).toBeNull();
  });
});
