import { corpsLisible, demandeAction, gesteNotification, tonNotification } from './notifications-modele';

/** ⚠️ 01/11 (pilote, maquette « Notifications », variante A) — textes réels de la PRMP (recette). */
describe('notifications — règles de présentation', () => {
  it('reconnaît ce qui demande un geste', () => {
    for (const t of ['AVIS_A_IMPRIMER', 'RECU_A_VALIDER', 'RECEPTION_A_SIGNER', 'ECHEANCE_AVIS_ATTRIBUTION', 'PIECES_ATTRIBUTAIRE_DEPOSEES', 'DOSSIER_A_EXAMINER']) {
      expect(demandeAction(t), t).toBe(true);
    }
    for (const t of ['PV_SIGNE', 'DAO_COMPLET_PRET', 'DECISION_TRANSMISE_SIGMP', 'DEPOTS_CLOS', null]) expect(demandeAction(t), String(t)).toBe(false);
  });

  it('donne un ton à l’icône et un intitulé au geste', () => {
    expect(tonNotification('RECU_A_VALIDER')).toBe('action');
    expect(tonNotification('PV_SIGNE')).toBe('positif');
    expect(tonNotification('DEPOTS_CLOS')).toBe('neutre');
    expect(gesteNotification('AVIS_A_IMPRIMER')).toBe('Imprimer l’avis');
    expect(gesteNotification('INCONNU')).toBe('Ouvrir');
  });

  it('retire le numéro interne de la procédure une fois le marché nommé, et les secondes des heures', () => {
    expect(corpsLisible('Procédure 5, lot 1 : 20 jours se sont écoulés depuis la notification du marché.', true))
      .toBe('Lot 1 : 20 jours se sont écoulés depuis la notification du marché.');
    expect(corpsLisible('Le PV d\'ouverture des plis de la procédure 2 est signé.', true)).toBe('Le PV d\'ouverture des plis de cette procédure est signé.');
    expect(corpsLisible('Le titulaire a déclaré la livraison du bon de commande n° 1 (lot 1, procédure 5) : la réception est à établir.', true))
      .toBe('Le titulaire a déclaré la livraison du bon de commande n° 1 (lot 1) : la réception est à établir.');
    expect(corpsLisible('La date limite de remise des offres de la procédure 2 est passée (29/10/2026 à 08:00:00).', true))
      .toBe('La date limite de remise des offres de cette procédure est passée (29/10/2026 à 08:00).');
    // Marché non nommé (profil sans accès à la fiche) : le texte garde son numéro, seules les secondes partent.
    expect(corpsLisible('La cérémonie des clés de la procédure 1 est close à 17:43:14.', false)).toBe('La cérémonie des clés de la procédure 1 est close à 17:43.');
  });
});
