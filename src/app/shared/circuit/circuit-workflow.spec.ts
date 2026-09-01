import {
  CIRCUIT_ETAPES,
  PV_STATUT_LABELS,
  etapeIndexForDossier,
  peutRetourner,
  peutSAutoProposer,
  examenRectifiable,
  peutSigner,
  peutSoumettre,
  peutViser,
  pvSignataireRole,
  statutSeverity,
} from './circuit-workflow';

describe('circuit-workflow', () => {
  describe('CIRCUIT_ETAPES', () => {
    it('décrit les 7 étapes du circuit dans l’ordre', () => {
      expect(CIRCUIT_ETAPES).toHaveLength(7);
      expect(CIRCUIT_ETAPES[0].key).toBe('RECEPTION');
      expect(CIRCUIT_ETAPES[6].key).toBe('CLOTURE');
    });
  });

  describe('etapeIndexForDossier', () => {
    it('mappe les statuts connus sur le bon index', () => {
      expect(etapeIndexForDossier('SOUMIS')).toBe(0);
      expect(etapeIndexForDossier('BROUILLON')).toBe(0);
      expect(etapeIndexForDossier('PRET_DISPATCH')).toBe(1);
      expect(etapeIndexForDossier('DISPATCHE')).toBe(2);
      expect(etapeIndexForDossier('EN_EXAMEN')).toBe(2);
      expect(etapeIndexForDossier('CLOTURE')).toBe(6);
      expect(etapeIndexForDossier('REMPLACE')).toBe(6);
    });

    it('renvoie -1 pour un dossier retiré (hors flux)', () => {
      expect(etapeIndexForDossier('RETIRE')).toBe(-1);
    });

    it('retombe sur la réception (0) pour un statut inconnu ou absent', () => {
      expect(etapeIndexForDossier('XYZ')).toBe(0);
      expect(etapeIndexForDossier(undefined)).toBe(0);
    });
  });

  describe('statutSeverity', () => {
    it('classe les statuts de réussite en success', () => {
      expect(statutSeverity('CLOTURE')).toBe('success');
      expect(statutSeverity('SIGNE')).toBe('success');
      expect(statutSeverity('APPROUVE')).toBe('success');
    });

    it('classe les statuts négatifs en danger', () => {
      expect(statutSeverity('RETIRE')).toBe('danger');
      expect(statutSeverity('REJETE')).toBe('danger');
      expect(statutSeverity('DEFAVORABLE')).toBe('danger');
    });

    it('classe les statuts intermédiaires en warning/info', () => {
      expect(statutSeverity('EN_RECTIFICATION')).toBe('warning');
      expect(statutSeverity('EN_ATTENTE')).toBe('warning');
      expect(statutSeverity('PROJET_SOUMIS')).toBe('info');
      expect(statutSeverity('SOUMIS')).toBe('info');
      expect(statutSeverity('DISPATCHE')).toBe('info');
    });

    it('renvoie neutral par défaut', () => {
      expect(statutSeverity('INCONNU')).toBe('neutral');
    });
  });

  describe('pvSignataireRole', () => {
    it('convertit le profil en rôle signataire du PV', () => {
      expect(pvSignataireRole('MEMBRE')).toBe('MEMBRE');
      expect(pvSignataireRole('PRESIDENT')).toBe('PRESIDENT');
      expect(pvSignataireRole('CHEF_COMMISSION')).toBe('CC');
    });

    it('renvoie null pour un profil non signataire', () => {
      expect(pvSignataireRole('SECRETAIRE')).toBeNull();
      expect(pvSignataireRole('PRMP')).toBeNull();
      expect(pvSignataireRole(null)).toBeNull();
    });
  });

  describe('disponibilité des actions du PV', () => {
    it('soumettre : BROUILLON ou EN_RECTIFICATION', () => {
      expect(peutSoumettre('BROUILLON')).toBe(true);
      expect(peutSoumettre('EN_RECTIFICATION')).toBe(true);
      expect(peutSoumettre('PROJET_SOUMIS')).toBe(false);
      expect(peutSoumettre('SIGNE')).toBe(false);
    });

    it('retourner : seulement PROJET_SOUMIS', () => {
      expect(peutRetourner('PROJET_SOUMIS')).toBe(true);
      expect(peutRetourner('BROUILLON')).toBe(false);
    });

    // ⚠️ Visa unique (2026-08-31) : PROJET_SOUMIS (cas normal) + PROJET_ACCEPTE (PV accepté sous
    // l'ancien contrat, part du rôle à compléter — le composant vérifie la part et le dispatcheur).
    it('viser : PROJET_SOUMIS, et PROJET_ACCEPTE en transition', () => {
      expect(peutViser('PROJET_SOUMIS')).toBe(true);
      expect(peutViser('PROJET_ACCEPTE')).toBe(true);
      expect(peutViser('BROUILLON')).toBe(false);
      expect(peutViser('EN_RECTIFICATION')).toBe(false);
      expect(peutViser('SIGNE')).toBe(false);
    });

    it('signer (part Membre) : seulement PROJET_ACCEPTE', () => {
      expect(peutSigner('PROJET_ACCEPTE')).toBe(true);
      expect(peutSigner('PROJET_SOUMIS')).toBe(false);
      expect(peutSigner('SIGNE')).toBe(false);
    });
  });


  /**
   * ⚠️ Régression du 2026-08-18 : la règle vivait recopiée dans trois écrans et y avait divergé.
   * Un PV revenu EN_RECTIFICATION était compté comme « soumis », si bien qu'un retour de navette
   * ne laissait au Membre aucun moyen de corriger — il ne pouvait que resoumettre à l'identique.
   */
  describe('examenRectifiable', () => {
    it('ouvre l’examen au retour de navette du Président/CC', () => {
      expect(examenRectifiable('EN_RECTIFICATION', 'EXAMINE')).toBe(true);
    });

    it('ouvre l’examen au réexamen après lettre de renvoi signée', () => {
      expect(examenRectifiable('EN_RECTIFICATION', 'A_REEXAMINER')).toBe(true);
    });

    it('ouvre l’examen tant que le PV est brouillon, ou avant qu’il existe', () => {
      expect(examenRectifiable('BROUILLON', 'EXAMINE')).toBe(true);
      expect(examenRectifiable(null, 'EXAMINE')).toBe(true);
      expect(examenRectifiable(undefined, 'EXAMINE')).toBe(true);
    });

    it('ferme l’examen quand la main est à la commission', () => {
      expect(examenRectifiable('PROJET_SOUMIS', 'EXAMINE')).toBe(false);
      expect(examenRectifiable('PROJET_ACCEPTE', 'EXAMINE')).toBe(false);
      expect(examenRectifiable('SIGNE', 'EXAMINE')).toBe(false);
    });

    it('ferme l’examen dès que le dossier a quitté l’état examinable', () => {
      for (const statut of ['PV_SIGNE', 'EN_VERIFICATION', 'CLOTURE', 'DISPATCHE', 'RETIRE', null, undefined]) {
        expect(examenRectifiable('EN_RECTIFICATION', statut)).toBe(false);
      }
    });
  });

  describe('PV_STATUT_LABELS', () => {
    it('fournit un libellé pour chaque statut du cycle', () => {
      expect(PV_STATUT_LABELS.BROUILLON).toBe('Brouillon');
      expect(PV_STATUT_LABELS.SIGNE).toBe('Signé');
      expect(PV_STATUT_LABELS.PROJET_ACCEPTE).toBe('Projet accepté');
    });
  });

  // ⚠️ Règle 2026-08-28, née d'un retour de la session backend : trois gardes serveur exigent, EN
  // PLUS de la paire de délégation, que l'acteur soit de la localité du dossier (§3.3). Sans elle,
  // un Chef de commission d'une autre commission voyait « moi-même ⤴ » et récoltait un 403.
  describe('peutSAutoProposer (localité — §3.3)', () => {
    it('le contrôleur SANS localité passe partout : c’est le cas du Président', () => {
      expect(peutSAutoProposer(null, 'ANT')).toBe(true);
      expect(peutSAutoProposer(undefined, 'ANT')).toBe(true);
      expect(peutSAutoProposer(null, null)).toBe(true);
    });

    it('même localité que le dossier : accepté', () => {
      expect(peutSAutoProposer('ANT', 'ANT')).toBe(true);
    });

    it('AUTRE localité : refusé — c’est le cas du CC d’une autre commission', () => {
      expect(peutSAutoProposer('ANT', 'FIA')).toBe(false);
    });

    it('un dossier sans localité ne rend pas éligible un contrôleur qui en a une', () => {
      expect(peutSAutoProposer('ANT', null)).toBe(false);
      expect(peutSAutoProposer('ANT', undefined)).toBe(false);
    });
  });
});
