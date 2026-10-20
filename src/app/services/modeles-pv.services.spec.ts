import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiError } from '../core/errors/api-error';
import { ModelePvService } from './modeles-pv.services';

/** Générateur de modèles de PV, G1 (V138, 20/10) — les chemins du contrat `/api/modeles-pv`. */
describe('ModelePvService — chemins du contrat', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('dépôt multipart, conditions et champs en bloc, mise en vigueur avec motif', () => {
    const s = TestBed.inject(ModelePvService);
    const http = TestBed.inject(HttpTestingController);

    s.deposer(4, new File(['x'], 'PV.docx')).subscribe();
    const depot = http.expectOne({ method: 'POST', url: '/api/modeles-pv/4/versions' });
    expect((depot.request.body as FormData).get('fichier')).toBeInstanceOf(File);
    depot.flush({});

    s.definirConditions(4, 2, [{ nom: 'AVEC_RESERVES', expression: 'avis = FAVR', libelle: null }]).subscribe();
    expect(http.expectOne({ method: 'PUT', url: '/api/modeles-pv/4/versions/2/conditions' }).request.body).toEqual([
      { nom: 'AVEC_RESERVES', expression: 'avis = FAVR', libelle: null },
    ]);

    s.mettreEnVigueur(4, 2, 'première version').subscribe();
    expect(http.expectOne({ method: 'POST', url: '/api/modeles-pv/4/versions/2/mettre-en-vigueur' }).request.body).toEqual({ motif: 'première version' });

    s.variables('MAOO-CC').subscribe();
    http.expectOne((r) => r.url === '/api/modeles-pv/variables' && r.params.get('sousType') === 'MAOO-CC').flush({});
  });

  it('aperçu : paramètres en requête, saisis dans le corps, erreur binaire relue (code et message)', async () => {
    const s = TestBed.inject(ModelePvService);
    const http = TestBed.inject(HttpTestingController);

    const erreur = new Promise<ApiError>((ok) =>
      s.apercu(4, 1, { dossier: 100383, avis: 'FAVR', format: 'pdf', saisis: { motif: 'x' } }).subscribe({ error: ok }),
    );
    const req = http.expectOne((r) => r.url === '/api/modeles-pv/4/versions/1/apercu');
    expect(req.request.params.get('dossier')).toBe('100383');
    expect(req.request.params.get('avis')).toBe('FAVR');
    expect(req.request.params.get('format')).toBe('pdf');
    expect(req.request.body).toEqual({ saisis: { motif: 'x' } });
    const corps = new Blob([JSON.stringify({ message: 'Word absent du serveur.', code: 'CONVERSION_INDISPONIBLE' })], { type: 'application/json' });
    req.flush(corps, { status: 409, statusText: 'Conflict' });

    const e = await erreur;
    expect(e.status).toBe(409);
    expect(e.code).toBe('CONVERSION_INDISPONIBLE');
    expect(e.message).toBe('Word absent du serveur.');
  });
});
