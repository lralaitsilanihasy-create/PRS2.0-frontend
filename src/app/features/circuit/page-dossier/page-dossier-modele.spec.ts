import { HttpErrorResponse } from '@angular/common/http';

import { ApiError } from '../../../core/errors/api-error';
import { Dossier, Role } from '../../../models';
import { classerEchec, etapesPage, lireIdDossier, referenceDossier, retourInterne, retourPage } from './page-dossier-modele';

const erreur = (status: number): ApiError => ({ status, message: 'x', raw: new HttpErrorResponse({ status }) });

/** Lot L4-F2 — règles pures de la page dossier (plan L4, §2 et §3.2). */
describe('Page dossier — règles pures', () => {
  describe('returnUrl', () => {
    it('refuse tout ce qui sortirait de l’application', () => {
      for (const refuse of [
        '//exemple.org',
        '//exemple.org/prmp/a-faire',
        'https://exemple.org',
        'http://localhost:4200/prmp/a-faire',
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        '/\\exemple.org',
        '\\\\exemple.org',
        ' /prmp/a-faire',
        '/prmp/a-faire\n//exemple.org',
        'prmp/a-faire',
        '',
        null,
        undefined,
      ]) {
        expect(retourInterne(refuse), String(refuse)).toBeNull();
      }
    });

    it('accepte un chemin interne, paramètres compris', () => {
      expect(retourInterne('/prmp/a-faire')).toBe('/prmp/a-faire');
      expect(retourInterne('/president/tableau-de-bord?page=2&statut=DISPATCHE')).toBe('/president/tableau-de-bord?page=2&statut=DISPATCHE');
    });

    it('à défaut, retour à « À faire » dans l’espace du profil', () => {
      const attendus: [Role, string][] = [
        ['PRESIDENT', '/president/a-faire'],
        ['CHEF_COMMISSION', '/cc/a-faire'],
        ['SECRETAIRE', '/secretaire/a-faire'],
        ['MEMBRE', '/membre/a-faire'],
        ['VERIFICATEUR', '/verificateur/a-faire'],
        ['ASSISTANT_CONTROLEUR', '/assistant/a-faire'],
        ['PRMP', '/prmp/a-faire'],
        ['UGPM', '/prmp/a-faire'],
      ];
      for (const [role, url] of attendus) {
        expect(retourPage('//exemple.org', role)).toEqual({ url, libelle: 'À faire' });
        expect(retourPage(null, role)).toEqual({ url, libelle: 'À faire' });
      }
      expect(retourPage('javascript:alert(1)', 'ADMINISTRATEUR')).toEqual({ url: '/', libelle: 'Retour' });
    });

    it('libellé « Retour » vers une liste, « À faire » vers l’accueil', () => {
      expect(retourPage('/membre/tableau-de-bord?page=3', 'MEMBRE')).toEqual({ url: '/membre/tableau-de-bord?page=3', libelle: 'Retour' });
      expect(retourPage('/cc/a-faire?vue=etape', 'CHEF_COMMISSION')).toEqual({ url: '/cc/a-faire?vue=etape', libelle: 'À faire' });
    });
  });

  it('identifiant de l’URL : entier positif seulement', () => {
    expect(lireIdDossier('100007')).toBe(100007);
    for (const brut of ['abc', '0', '-3', '12.5', '1e3', '', null, '99999999999']) {
      expect(lireIdDossier(brut), String(brut)).toBeNull();
    }
  });

  it('référence du titre : officielle, sinon date de dépôt, sinon numéro', () => {
    expect(referenceDossier({ idDossier: 7, refeDossier: '00001/PPM-AGPM/CNM/2027' })).toBe('00001/PPM-AGPM/CNM/2027');
    expect(referenceDossier({ idDossier: 7, dateSoumission: '2026-09-11T09:30:00' })).toBe('Dépôt du 11/09');
    expect(referenceDossier({ idDossier: 7 })).toBe('Dossier n° 7');
  });

  describe('frise', () => {
    const dossier: Dossier = {
      idDossier: 7,
      statut: 'EXAMINE',
      datesEtapes: { RECEPTION: '2026-09-04T10:00:00', DISPATCH: '2026-09-07T09:00:00', EXAMEN: '2026-09-11T11:50:00' },
      acteursEtapes: { RECEPTION: 'Voahangy Rasoa', DISPATCH: 'Jean Claude Rakoto', EXAMEN: 'Jean Claude Rakoto' },
    };

    it('CNM : date et acteur au survol, préfixe de l’étape', () => {
      const e = etapesPage(dossier, true);
      expect(e.map((x) => x.etat)).toEqual(['faite', 'faite', 'faite', 'courante', 'a-venir', 'a-venir', 'a-venir']);
      expect(e[1].infobulle).toBe('Dispatch · lun. 07/09/2026 · Attribué à Jean Claude Rakoto');
      expect(e[1].lu).toBe('franchie, lun. 07/09/2026, Attribué à Jean Claude Rakoto');
      expect(e[3].infobulle).toBe('Projet PV · en cours');
    });

    it('PRMP et UGPM : la date seule, même si une réponse portait un acteur (règle C2)', () => {
      const e = etapesPage(dossier, false);
      expect(e.every((x) => x.acteur === null)).toBe(true);
      expect(e[1].infobulle).toBe('Dispatch · lun. 07/09/2026');
      expect(JSON.stringify(e)).not.toContain('Rakoto');
      expect(JSON.stringify(e)).not.toContain('Rasoa');
    });
  });

  it('échec d’ouverture : 403 hors périmètre, 404 ou 400 introuvable, le reste à réessayer', () => {
    expect(classerEchec(erreur(403))).toBe('interdit');
    expect(classerEchec(erreur(404))).toBe('introuvable');
    expect(classerEchec(erreur(400))).toBe('introuvable');
    expect(classerEchec(erreur(500))).toBe('echec');
    expect(classerEchec(erreur(0))).toBe('echec');
    expect(classerEchec(new Error('x'))).toBe('echec');
  });
});
