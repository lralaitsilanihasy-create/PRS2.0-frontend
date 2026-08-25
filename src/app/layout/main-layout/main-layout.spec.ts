import { provideHttpClient } from '@angular/common/http';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { MainLayout } from './main-layout';

/**
 * Recherche « aller à un dossier par référence » (topbar, PRMP/UGPM) — constat de relecture (hors
 * AUDIT.md) : `forkJoin({ dossiers: list(), ppms: list() })` téléchargeait les DEUX tables entières à
 * chaque recherche pour n'en retenir qu'une seule ligne, sans borne de taille.
 *
 * Ces tests verrouillent le contrat observable qui empêche d'y revenir : le filtre `reference=` part
 * au SERVEUR pour chaque ressource (`listePage`, page=0, size=1 — une seule ligne suffit, jamais la
 * liste plate), une correspondance directe navigue sans appel supplémentaire, une correspondance
 * trouvée seulement via la référence du PPM déclenche une requête ciblée `GET /api/dossiers/{id}`
 * (le seul cas qui en a besoin) avant de naviguer, et une saisie sans correspondance affiche le
 * message existant sans naviguer.
 */
describe('MainLayout — recherche « aller à un dossier »', () => {
  const versDossiers = (r: HttpRequest<unknown>) => r.url === '/api/dossiers' && r.method === 'GET';
  const versPpms = (r: HttpRequest<unknown>) => r.url === '/api/ppms' && r.method === 'GET';

  /** Enveloppe `Page` de Spring Data, telle que servie par le backend. */
  const page = (content: unknown[]) => ({
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 1,
  });

  function preparer(): {
    fixture: ComponentFixture<MainLayout>;
    http: HttpTestingController;
    navigate: ReturnType<typeof vi.fn>;
    toast: ToastService;
  } {
    const navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Router,
          useValue: { events: of(), url: '/', navigate, navigateByUrl: vi.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(MainLayout);
    const http = TestBed.inject(HttpTestingController);
    // Annonce des actualités à l'ouverture de session (constructeur) : hors périmètre de ces tests.
    http.expectOne('/api/actualites/mes-actualites').flush([]);
    return { fixture, http, navigate, toast: TestBed.inject(ToastService) };
  }

  it('transmet le filtre reference aux deux ressources, en une seule ligne (jamais la liste plate)', () => {
    const { fixture, http } = preparer();
    fixture.componentInstance.recherche.set('CNM-2026');

    fixture.componentInstance.allerAuDossier();

    const reqDossiers = http.expectOne(versDossiers);
    expect(reqDossiers.request.params.get('reference')).toBe('CNM-2026');
    expect(reqDossiers.request.params.get('page')).toBe('0');
    expect(reqDossiers.request.params.get('size')).toBe('1');

    const reqPpms = http.expectOne(versPpms);
    expect(reqPpms.request.params.get('reference')).toBe('CNM-2026');
    expect(reqPpms.request.params.get('page')).toBe('0');
    expect(reqPpms.request.params.get('size')).toBe('1');

    reqDossiers.flush(page([]));
    reqPpms.flush(page([]));
    http.verify();
  });

  it('un dossier trouvé directement déclenche la navigation attendue, sans requête supplémentaire', () => {
    const { fixture, http, navigate } = preparer();
    fixture.componentInstance.recherche.set('CNM-2026-007');

    fixture.componentInstance.allerAuDossier();

    http
      .expectOne(versDossiers)
      .flush(page([{ idDossier: 7, idTypeDossier: 'DDP', statut: 'SOUMIS' }]));
    http.expectOne(versPpms).flush(page([]));

    expect(navigate).toHaveBeenCalledWith(['/prmp/dossiers', 'DDP', 'soumis'], {
      queryParams: { focus: 7 },
    });
    // La saisie est réinitialisée après une résolution réussie.
    expect(fixture.componentInstance.recherche()).toBe('');
    expect(fixture.componentInstance.rechercheEnCours()).toBe(false);
    http.verify();
  });

  it('une correspondance venue du PPM déclenche la requête ciblée puis la navigation', () => {
    const { fixture, http, navigate } = preparer();
    fixture.componentInstance.recherche.set('PPM-2026-042');

    fixture.componentInstance.allerAuDossier();

    http.expectOne(versDossiers).flush(page([]));
    http.expectOne(versPpms).flush(page([{ idDossier: 9, reference: 'PPM-2026-042', idPpm: 1 }]));

    // Repli PPM : l'objet dossier n'est pas sous la main (seul idDossier l'est) — requête ciblée.
    const parId = http.expectOne('/api/dossiers/9');
    expect(parId.request.method).toBe('GET');
    parId.flush({ idDossier: 9, idTypeDossier: 'DMC', statut: 'CLOTURE' });

    expect(navigate).toHaveBeenCalledWith(['/prmp/dossiers', 'DMC', 'soumis'], {
      queryParams: { focus: 9 },
    });
    expect(fixture.componentInstance.rechercheEnCours()).toBe(false);
    http.verify();
  });

  it('une saisie sans correspondance affiche le message existant, sans naviguer', () => {
    const { fixture, http, navigate, toast } = preparer();
    const info = vi.spyOn(toast, 'info');
    fixture.componentInstance.recherche.set('INTROUVABLE');

    fixture.componentInstance.allerAuDossier();

    http.expectOne(versDossiers).flush(page([]));
    http.expectOne(versPpms).flush(page([]));

    expect(info).toHaveBeenCalledWith('Aucun dossier pour « INTROUVABLE ».');
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.rechercheEnCours()).toBe(false);
    http.verify();
  });
});
