import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Dossier, LigneEligible, Marche, Ppm } from '../../models';
import { MesPpmMarches } from './mes-ppm-marches';

const PPMS = [
  { idPpm: 10, idDossier: 3, exercice: 2026, reference: 'PPM-2026-003', libelle: 'Plan 2026' },
  { idPpm: 11, idDossier: 4, exercice: 2026, reference: 'PPM-2026-004', libelle: 'Plan bis' },
] as Ppm[];
const MARCHES = [{ idDetail: 7, idPpm: 10, idDossier: 3 }, { idDetail: 9, idPpm: 10, idDossier: 3 }, { idDetail: 12, idPpm: 11, idDossier: 4 }] as Marche[];
const DOSSIERS = [{ idDossier: 3, statut: 'PV_SIGNE' }, { idDossier: 4, statut: 'EN_VERIFICATION' }] as Dossier[];
const ELIGIBLES: LigneEligible[] = [
  { idDetail: 7, idDossier: 3, refeDossier: 'PPM-2026-003', designationMarche: 'Mobilier', idMode: 1, libelleMode: 'AOO', montEstim: 1, dejaDao: false },
  { idDetail: 9, idDossier: 3, refeDossier: 'PPM-2026-003', designationMarche: 'Véhicules', idMode: 1, libelleMode: 'AOO', montEstim: 1, dejaDao: true, idDmc: 42 },
];

describe('« Mes PPM & marchés » — raccourci vers la fiche marché (H3, 22/09)', () => {
  let fixture: ComponentFixture<MesPpmMarches>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function monter(eligibles: LigneEligible[] | 'absent'): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MesPpmMarches);
    fixture.detectChanges();
    http.expectOne('/api/ppms').flush(PPMS);
    http.expectOne('/api/marches').flush(MARCHES);
    http.expectOne('/api/dossiers').flush(DOSSIERS);
    const e = http.expectOne('/api/dmcs/eligibles');
    if (eligibles === 'absent') e.flush({}, { status: 400, statusText: 'Bad Request' });
    else e.flush(eligibles);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('un bouton « Appel d’offres (n) » par PPM dont une ligne est éligible, vers /prmp/dao?dossier=', () => {
    monter(ELIGIBLES);
    const cartes = Array.from(racine().querySelectorAll('.ppm-row'));
    expect(cartes.length).toBe(2);
    const lien = cartes[0].querySelector('a.btn-primary') as HTMLAnchorElement;
    expect(texte(lien)).toBe('Appel d’offres (2)');
    expect(lien.getAttribute('href')).toBe('/prmp/dao?dossier=3');
    expect(lien.getAttribute('title')).toBe('1 ligne(s) d’appel d’offres à préparer · 1 fiche(s) marché à reprendre');
    expect(cartes[1].querySelector('a.btn-primary')).toBeNull();
    // « Détails » reste le geste principal de chaque carte.
    expect(cartes.every((c) => texte(c.querySelector('button')) === 'Détails')).toBe(true);
  });

  it('contrat absent (400 sur eligibles) : aucun bouton, l’écran reste entier', () => {
    monter('absent');
    expect(racine().querySelectorAll('.ppm-row').length).toBe(2);
    expect(racine().querySelector('a.btn-primary')).toBeNull();
  });
});
