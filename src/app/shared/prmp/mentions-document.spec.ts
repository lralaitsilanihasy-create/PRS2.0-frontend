import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MentionsDocumentVue } from './mentions-document';

describe('Relecture des mentions du modèle type (manuel révisé, R3c)', () => {
  let fixture: ComponentFixture<MentionsDocumentVue>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (): string => (racine().textContent ?? '').replace(/\s+/g, ' ').trim();

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MentionsDocumentVue], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MentionsDocumentVue);
    fixture.componentRef.setInput('idDmc', 40);
    fixture.componentRef.setInput('document', 'avis');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('ne lit rien tant que le volet est fermé ; à l’ouverture, nomme les écarts de gabarit et de saisie', () => {
    http.expectNone('/api/fiches-marche/40/avis-specifique/mentions');
    fixture.componentInstance.basculer(true);
    http.expectOne('/api/fiches-marche/40/avis-specifique/mentions').flush({
      gabarit: 'AVIS-F',
      gabaritComplet: true,
      documentComplet: false,
      mentions: [
        { code: 'OBJET', libelle: 'Objet du marché', presenteAuGabarit: true, renseignee: true, sansObjet: false, detail: null },
        { code: 'COMPTE_PAIEMENT', libelle: 'Compte bancaire de l’ARMP', presenteAuGabarit: true, renseignee: false, sansObjet: false, detail: 'non renseignée sur la fiche (pointillés)' },
        { code: 'LOTS_MAX', libelle: 'Nombre de lots maximum', presenteAuGabarit: true, renseignee: false, sansObjet: true, detail: null },
      ],
    });
    fixture.detectChanges();
    expect(texte()).toContain('1 / 2 renseignée(s)');
    expect(texte()).toContain('✕ pointillés');
    expect(texte()).toContain('sans objet');
    expect(racine().querySelectorAll('.md__ko').length).toBe(1);
  });

  it('un document indisponible (appel d’offres restreint) est nommé, sans toast', () => {
    fixture.componentInstance.basculer(true);
    http.expectOne('/api/fiches-marche/40/avis-specifique/mentions').flush({ code: 'AVIS_INDISPONIBLE', message: 'x', details: { raison: 'MODE_SANS_AVIS' } }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(racine().querySelector('[role=alert]')?.textContent).toContain('n’existe pas pour cette fiche');
  });
});
