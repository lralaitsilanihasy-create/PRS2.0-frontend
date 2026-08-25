import { provideHttpClient } from '@angular/common/http';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { DossiersListe } from './dossiers-liste';

/**
 * Pagination **serveur** de l'écran « Mes dossiers » (AUDIT.md P1) — écran d'origine du point P1.
 *
 * L'écran téléchargeait la table entière du profil (`GET /api/dossiers`, sans filtre) puis la filtrait
 * par type + statut en mémoire pour n'en afficher qu'une page. Ces tests verrouillent le contrat
 * observable qui empêche la régression : `type` et `brouillon` partent désormais AU SERVEUR (pas de
 * filtre mémoire après coup, ce qui casserait la pagination — pages incomplètes, total faux), le total
 * vient de `totalElements`, et le changement de page redemande au serveur au lieu de découper un
 * tableau local.
 *
 * Le second bloc verrouille la résolution du `?focus=` (recherche topbar) quand la ligne ciblée tombe
 * hors de la page chargée : une requête ciblée par id la va chercher et l'affiche en tête.
 */
describe('DossiersListe — pagination serveur et focus hors page', () => {
  /** Requête GET sur la collection des dossiers, quels que soient ses paramètres. */
  const versDossiers = (r: HttpRequest<unknown>) => r.url === '/api/dossiers' && r.method === 'GET';

  function preparer(
    params: Record<string, string> = { type: 'DDP', groupe: 'brouillon' },
    queryParams: Record<string, string> = {},
  ): { fixture: ComponentFixture<DossiersListe>; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: {} },
            paramMap: of(convertToParamMap(params)),
            queryParamMap: of(convertToParamMap(queryParams)),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(DossiersListe);
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  /** Vide les 4 référentiels de libellés + les deux listes complètes (ppms/marches) — hors périmètre
   *  de cette pagination (AUDIT.md P1 porte sur `/api/dossiers`, pas sur ces jointures d'enrichissement). */
  function flushAuxiliaires(http: HttpTestingController): void {
    http.expectOne('/api/type-dossiers').flush([]);
    http.expectOne('/api/localites').flush([]);
    http.expectOne('/api/sous-type-dossiers').flush([]);
    http.expectOne('/api/entite-contracts').flush([]);
    http.expectOne('/api/ppms').flush([]);
    http.expectOne('/api/marches').flush([]);
  }

  /** Enveloppe `Page` de Spring Data, telle que servie par le backend. */
  const page = (content: unknown[], totalElements: number, number = 0, size = 20) => ({
    content,
    totalElements,
    totalPages: Math.max(1, Math.ceil(totalElements / size)),
    number,
    size,
  });

  it('demande la page affichée avec type + brouillon en filtres serveur, jamais la liste plate', () => {
    const { http } = preparer();
    flushAuxiliaires(http);

    const req = http.expectOne(versDossiers);
    expect(req.request.params.get('type')).toBe('DDP');
    expect(req.request.params.get('brouillon')).toBe('true');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');

    req.flush(page([{ idDossier: 1, idTypeDossier: 'DDP', statut: 'BROUILLON' }], 57));
    http.verify();
  });

  it('« soumis » transmet brouillon=false (tout sauf BROUILLON) au serveur', () => {
    const { http } = preparer({ type: 'DMC', groupe: 'soumis' });
    flushAuxiliaires(http);

    const req = http.expectOne(versDossiers);
    expect(req.request.params.get('type')).toBe('DMC');
    expect(req.request.params.get('brouillon')).toBe('false');
    req.flush(page([], 0));
    http.verify();
  });

  it('le total et le nombre de pages viennent du serveur, jamais déduits du tableau reçu', () => {
    const { fixture, http } = preparer();
    flushAuxiliaires(http);

    http.expectOne(versDossiers).flush(page([{ idDossier: 1 }, { idDossier: 2 }], 340));
    fixture.detectChanges();

    // 2 lignes reçues, mais le total réel est 340 : impossible à déduire des lignes seules.
    expect(fixture.componentInstance.total()).toBe(340);
    expect(fixture.componentInstance.dossiers()).toHaveLength(2);
    expect(fixture.componentInstance.totalPages()).toBe(17);
    http.verify();
  });

  it('« Suivant » recharge depuis le serveur au lieu de découper un tableau local', () => {
    const { fixture, http } = preparer();
    flushAuxiliaires(http);
    http.expectOne(versDossiers).flush(page([{ idDossier: 1 }], 45));

    fixture.componentInstance.next();

    const suivante = http.expectOne(versDossiers);
    expect(suivante.request.params.get('page')).toBe('1');
    // Les référentiels d'enrichissement sont mis en cache par ReferenceLookupService — seuls
    // ppms/marches repartent à chaque `charger()`.
    http.expectOne('/api/ppms').flush([]);
    http.expectOne('/api/marches').flush([]);
    suivante.flush(page([{ idDossier: 21 }], 45, 1));
    expect(fixture.componentInstance.page()).toBe(1);
    http.verify();
  });

  it('« Suivant » sur la dernière page n’émet aucune requête', () => {
    const { fixture, http } = preparer();
    flushAuxiliaires(http);
    http.expectOne(versDossiers).flush(page([{ idDossier: 1 }], 3));

    fixture.componentInstance.next();
    fixture.componentInstance.next();

    http.verify(); // aucune requête en attente : la borne est respectée
    expect(fixture.componentInstance.page()).toBe(0);
  });

  it('un échec laisse un état d’erreur réessayable, pas une liste vide silencieuse', () => {
    const { fixture, http } = preparer();
    flushAuxiliaires(http);
    http.expectOne(versDossiers).flush('panne', { status: 500, statusText: 'Server Error' });

    expect(fixture.componentInstance.erreur()).toBe(true);
    expect(fixture.componentInstance.loading()).toBe(false);

    fixture.componentInstance.charger();
    http.expectOne('/api/ppms').flush([]);
    http.expectOne('/api/marches').flush([]);
    const reprise = http.expectOne(versDossiers);
    expect(reprise.request.params.get('page')).toBe('0');
    reprise.flush(page([{ idDossier: 1 }], 1));

    expect(fixture.componentInstance.erreur()).toBe(false);
    http.verify();
  });

  it('un dossier ciblé par ?focus= déjà présent dans la page ne déclenche aucune requête ciblée', () => {
    const { fixture, http } = preparer({ type: 'DDP', groupe: 'brouillon' }, { focus: '2' });
    flushAuxiliaires(http);

    http.expectOne(versDossiers).flush(page([{ idDossier: 1 }, { idDossier: 2 }], 2));

    expect(fixture.componentInstance.focusRow()).toBeNull();
    expect(fixture.componentInstance.lignes().map((d) => d.idDossier)).toEqual([1, 2]);
    http.verify();
  });

  it('un ?focus= hors de la page reçue déclenche une requête ciblée par id et l’affiche en tête', () => {
    const { fixture, http } = preparer({ type: 'DDP', groupe: 'brouillon' }, { focus: '999' });
    flushAuxiliaires(http);

    // La page chargée (2 lignes) ne contient pas #999 : caché derrière un total de 57.
    http.expectOne(versDossiers).flush(page([{ idDossier: 1 }, { idDossier: 2 }], 57));

    const cible = http.expectOne('/api/dossiers/999');
    expect(cible.request.method).toBe('GET');
    cible.flush({ idDossier: 999, idTypeDossier: 'DDP', statut: 'BROUILLON', refeDossier: 'DDP-999' });

    expect(fixture.componentInstance.focusRow()?.idDossier).toBe(999);
    // En tête, sans dupliquer la page reçue.
    expect(fixture.componentInstance.lignes().map((d) => d.idDossier)).toEqual([999, 1, 2]);
    http.verify();
  });

  it('un ?focus= introuvable (supprimé entre-temps) n’affiche pas de ligne en tête, sans planter', () => {
    const { fixture, http } = preparer({ type: 'DDP', groupe: 'brouillon' }, { focus: '999' });
    flushAuxiliaires(http);

    http.expectOne(versDossiers).flush(page([{ idDossier: 1 }], 1));
    http.expectOne('/api/dossiers/999').flush('introuvable', { status: 404, statusText: 'Not Found' });

    expect(fixture.componentInstance.focusRow()).toBeNull();
    expect(fixture.componentInstance.lignes().map((d) => d.idDossier)).toEqual([1]);
    http.verify();
  });
});
