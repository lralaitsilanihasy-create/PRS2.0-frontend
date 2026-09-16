import { Notification } from '../../models';
import { routePourNotification } from './notification-route';

/**
 * Lot L4-F6 : le repli « consultation » d'une notification mène à la PAGE du dossier pour les huit
 * profils du circuit. Les types déjà routés vers un écran d'action ne bougent pas — c'est ce que
 * vérifie la première série.
 */
describe('Routage d’une notification', () => {
  const n = (p: Partial<Notification>): Notification => ({ idNotification: 1, typeNotif: 'X', ...p });

  it('les types routés vers un écran d’action ne changent pas', () => {
    expect(routePourNotification(n({ typeNotif: 'EXAMEN_A_FAIRE', idDossier: 42 }), 'MEMBRE')).toEqual({ genre: 'route', commands: ['/membre/examiner', '42'] });
    expect(routePourNotification(n({ typeNotif: 'PV_A_VERIFIER', idDossier: 42 }), 'VERIFICATEUR')).toEqual({ genre: 'route', commands: ['/verificateur/verifier', '42'] });
    expect(routePourNotification(n({ typeNotif: 'PRET_DISPATCH', idDossier: 42 }), 'PRESIDENT')).toEqual({ genre: 'route', commands: ['/president/tableau-de-bord'] });
    expect(routePourNotification(n({ typeNotif: 'DEMANDE_RETRAIT_A_VALIDER', idDossier: 42 }), 'CHEF_COMMISSION')).toEqual({ genre: 'route', commands: ['/cc/retraits'] });
    expect(routePourNotification(n({ typeNotif: 'OBSERVATION_VERIFICATION', idDossier: 42 }), 'PRMP')).toEqual({ genre: 'route', commands: ['/prmp/a-rectifier'] });
    expect(routePourNotification(n({ typeNotif: 'PIECES_MANQUANTES_DEPOT', idDossier: 42 }), 'PRMP')).toMatchObject({ genre: 'route-type-dossier' });
  });

  it('type non mappé avec dossier : la page du dossier, dans l’espace du connecté', () => {
    const attendu: [string, string][] = [
      ['PRESIDENT', 'president'],
      ['CHEF_COMMISSION', 'cc'],
      ['SECRETAIRE', 'secretaire'],
      ['MEMBRE', 'membre'],
      ['VERIFICATEUR', 'verificateur'],
      ['ASSISTANT_CONTROLEUR', 'assistant'],
      ['PRMP', 'prmp'],
      ['UGPM', 'prmp'],
    ];
    for (const [role, espace] of attendu) {
      expect(routePourNotification(n({ typeNotif: 'TYPE_INCONNU', idDossier: 1052 }), role)).toEqual({ genre: 'page-dossier', commands: [`/${espace}`, 'dossier', '1052'] });
    }
  });

  it('sans la page (Administrateur, Chargé de publication) : rien, l’appelant garde sa modale', () => {
    expect(routePourNotification(n({ typeNotif: 'TYPE_INCONNU', idDossier: 1052 }), 'ADMINISTRATEUR')).toBeNull();
    expect(routePourNotification(n({ typeNotif: 'TYPE_INCONNU', idDossier: 1052 }), 'CHARGE_PUBLICATION')).toBeNull();
  });

  it('sans dossier : rien à consulter (messagerie ou repli de l’appelant)', () => {
    expect(routePourNotification(n({ typeNotif: 'TYPE_INCONNU' }), 'MEMBRE')).toBeNull();
    expect(routePourNotification(n({ typeNotif: 'NOUVEAU_MESSAGE', idDossier: 1052 }), 'MEMBRE')).toEqual({ genre: 'route', commands: ['/membre/messagerie'] });
    expect(routePourNotification(n({ typeNotif: 'TYPE_INCONNU', idDossier: 1052 }), null)).toBeNull();
  });
});
