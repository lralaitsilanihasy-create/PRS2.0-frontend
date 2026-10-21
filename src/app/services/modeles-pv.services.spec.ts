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

    s.genererDepart(3).subscribe();
    expect(http.expectOne({ method: 'POST', url: '/api/modeles-pv/3/versions/depart' }).request.body).toEqual({ portee: 'les-deux' });

    s.integres().subscribe();
    http.expectOne({ method: 'GET', url: '/api/modeles-pv/integres' }).flush([]);
    s.couverture().subscribe();
    http.expectOne({ method: 'GET', url: '/api/modeles-pv/couverture' }).flush([]);

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

  it('modèles intégrés : fichier par son nom, aperçu qui nomme le fichier ayant servi', async () => {
    const s = TestBed.inject(ModelePvService);
    const http = TestBed.inject(HttpTestingController);

    s.fichierIntegre('PV-PLAN-INTEGRE', 'PV_AF_PPM_CENTRALE.docx').subscribe();
    http.expectOne({ method: 'GET', url: '/api/modeles-pv/integres/PV-PLAN-INTEGRE/fichiers/PV_AF_PPM_CENTRALE.docx' }).flush(new Blob(['x']));

    const ok = new Promise<{ blob: Blob; fichier: string | null }>((r) => s.apercuIntegre('PV-PLAN-INTEGRE', { dossier: 100379, avis: 'FAVR', format: 'pdf' }).subscribe(r));
    const req = http.expectOne((r) => r.url === '/api/modeles-pv/integres/PV-PLAN-INTEGRE/apercu');
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('dossier')).toBe('100379');
    expect(req.request.params.get('avis')).toBe('FAVR');
    req.flush(new Blob(['%PDF']), { headers: { 'X-Fichier-Modele': 'PV_AFSR_PPMAGPM_CENTRALE.docx' } });
    expect((await ok).fichier).toBe('PV_AFSR_PPMAGPM_CENTRALE.docx');

    const refus = new Promise<ApiError>((r) => s.apercuIntegre('LETTRE-RENVOI-INTEGREE', { dossier: 100379, format: 'pdf' }).subscribe({ error: r }));
    const corps = new Blob([JSON.stringify({ message: 'Le dossier 100379 n’a pas de lettre de renvoi.', code: 'LETTRE_ABSENTE' })]);
    http.expectOne((r) => r.url === '/api/modeles-pv/integres/LETTRE-RENVOI-INTEGREE/apercu').flush(corps, { status: 409, statusText: 'Conflict' });
    const e = await refus;
    expect(e.code).toBe('LETTRE_ABSENTE');
    expect(e.message).toContain('pas de lettre de renvoi');
  });
});
