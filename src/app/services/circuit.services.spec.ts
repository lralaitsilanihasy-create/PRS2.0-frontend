import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Chronometrage, RechercheDossier } from '../models';
import { DossierService } from './circuit.services';
import { DelaiStandardService } from './referentiel.services';

/**
 * `rechercher()` sert la barre de recherche de la topbar : depuis `8a44426`, la référence est
 * résolue **par le serveur** (10 résultats au plus, périmètre appliqué côté backend) au lieu de
 * ramener toute la liste des dossiers pour filtrer dans le navigateur.
 *
 * Le contrat tient à deux détails que rien d'autre ne surveille : l'URL `/api/dossiers/recherche`
 * — un sous-chemin, pas un filtre sur la collection — et le nom du paramètre `q`. Se tromper sur
 * l'un ou l'autre ne casse aucune compilation : la barre renvoie simplement toujours zéro
 * résultat, ou pire, `GET /api/dossiers` recommence à tout charger.
 */
describe('DossierService.rechercher', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('interroge le sous-chemin de recherche avec la saisie en paramètre « q »', () => {
    const service = TestBed.inject(DossierService);
    const http = TestBed.inject(HttpTestingController);

    let recus: RechercheDossier[] | undefined;
    service.rechercher('DAO-2026').subscribe((r) => (recus = r));

    const req = http.expectOne((r) => r.url === '/api/dossiers/recherche');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('DAO-2026');
    // La liste complète ne doit plus être sollicitée pour résoudre une saisie.
    http.expectNone('/api/dossiers');

    req.flush([{ idDossier: 7, refeDossier: 'DAO-2026-07', reference: 'DAO-2026-07', idTypeDossier: 'AO', statut: 'SOUMIS' }]);
    expect(recus).toHaveLength(1);
  });

  it('confie l’échappement de la saisie à HttpParams (espaces, esperluettes)', () => {
    const service = TestBed.inject(DossierService);
    const http = TestBed.inject(HttpTestingController);

    service.rechercher('AO 12 & 13').subscribe();

    const req = http.expectOne((r) => r.url === '/api/dossiers/recherche');
    // La valeur brute est préservée côté paramètre ; c'est l'encodage de l'URL qui s'en charge.
    expect(req.request.params.get('q')).toBe('AO 12 & 13');
    expect(req.request.urlWithParams).toContain('q=AO%2012%20%26%2013');
    req.flush([]);
  });
});

/**
 * Chronométrage (2026-09-01 ; refonte AUTO sans prise en charge 2026-09-12, backend `9648729`).
 * Détail de contrat que rien d'autre ne surveille : le référentiel `/api/delais-standards` dont le
 * PUT est adressé PAR ÉTAPE (clé string, pas un id numérique). La lecture `/chronometrage` sert
 * désormais `etapes[]` (plus `taches[]`).
 */
describe('Chronométrage — DossierService et DelaiStandardService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('lit le chronométrage du dossier (compteurs + occurrences)', () => {
    const service = TestBed.inject(DossierService);
    const http = TestBed.inject(HttpTestingController);

    let chrono: Chronometrage | undefined;
    service.chronometrage(42).subscribe((c) => (chrono = c));

    const req = http.expectOne('/api/dossiers/42/chronometrage');
    expect(req.request.method).toBe('GET');
    req.flush({ idDossier: 42, etapes: [], dureeBruteHeuresOuvrees: 0, dureeNetteHeuresOuvrees: 0, attentePrmpHeuresOuvrees: 0, attentePrmp: false });
    expect(chrono?.idDossier).toBe(42);
  });

  it('adresse le PUT des délais standards par étape (clé string)', () => {
    const service = TestBed.inject(DelaiStandardService);
    const http = TestBed.inject(HttpTestingController);

    service.update('EXAMEN', { etape: 'EXAMEN', delaiHeures: 40 }).subscribe();

    const req = http.expectOne('/api/delais-standards/EXAMEN');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.delaiHeures).toBe(40);
    req.flush({ etape: 'EXAMEN', delaiHeures: 40, libelle: 'Examen' });
  });
});
