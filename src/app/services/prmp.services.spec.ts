import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { VersionArchivee, VersionArchiveeDetail } from '../models';
import { MiseAJourPpmService } from './prmp.services';

/**
 * ⚠️ 2026-09-06 — historique des versions à la rectification. Deux notions de « version » coexistent
 * côté API et seule l'URL les distingue : `/versions` (chaîne des mises à jour, un dossier par version)
 * et `/versions-archivees` (versions figées du MÊME dossier). Se tromper de chemin ne casse aucune
 * compilation : l'onglet afficherait des dossiers à la place de versions, ou n'apparaîtrait jamais.
 */
describe('MiseAJourPpmService — versions archivées', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('liste les versions archivées sur le sous-chemin dédié, distinct de /versions', () => {
    const service = TestBed.inject(MiseAJourPpmService);
    const http = TestBed.inject(HttpTestingController);

    let recues: VersionArchivee[] | undefined;
    service.versionsArchivees(700, true).subscribe((v) => (recues = v));

    const req = http.expectOne('/api/dossiers/700/versions-archivees');
    expect(req.request.method).toBe('GET');
    http.expectNone('/api/dossiers/700/versions');

    // Un dossier jamais rectifié répond une liste VIDE (200) — pas une erreur.
    req.flush([]);
    expect(recues).toEqual([]);
  });

  it('lit le contenu d’une version par son numéro', () => {
    const service = TestBed.inject(MiseAJourPpmService);
    const http = TestBed.inject(HttpTestingController);

    let recu: VersionArchiveeDetail | undefined;
    service.versionArchivee(700, 2).subscribe((d) => (recu = d));

    const req = http.expectOne('/api/dossiers/700/versions-archivees/2');
    expect(req.request.method).toBe('GET');
    req.flush({
      version: { idDossier: 700, numero: 2, origine: 'RECTIFICATION', cycle: 2, dateVersion: '2026-09-06T01:00:00', nbLignes: 1 },
      lignes: [{ idDetail: 7001, montEstim: 250, beneficiaires: [], lots: [], processus: [] }],
    });
    expect(recu?.version.numero).toBe(2);
    expect(recu?.lignes).toHaveLength(1);
  });
});
