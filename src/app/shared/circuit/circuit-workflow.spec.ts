import {
  CIRCUIT_ETAPES,
  PV_STATUT_LABELS,
  etapeIndexForDossier,
  peutAccepter,
  peutRetourner,
  peutSigner,
  peutSoumettre,
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

    it('retourner et accepter : seulement PROJET_SOUMIS', () => {
      expect(peutRetourner('PROJET_SOUMIS')).toBe(true);
      expect(peutAccepter('PROJET_SOUMIS')).toBe(true);
      expect(peutRetourner('BROUILLON')).toBe(false);
      expect(peutAccepter('PROJET_ACCEPTE')).toBe(false);
    });

    it('signer : seulement PROJET_ACCEPTE', () => {
      expect(peutSigner('PROJET_ACCEPTE')).toBe(true);
      expect(peutSigner('PROJET_SOUMIS')).toBe(false);
      expect(peutSigner('SIGNE')).toBe(false);
    });
  });

  describe('PV_STATUT_LABELS', () => {
    it('fournit un libellé pour chaque statut du cycle', () => {
      expect(PV_STATUT_LABELS.BROUILLON).toBe('Brouillon');
      expect(PV_STATUT_LABELS.SIGNE).toBe('Signé');
      expect(PV_STATUT_LABELS.PROJET_ACCEPTE).toBe('Projet accepté');
    });
  });
});
