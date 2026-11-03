import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OuvertureAnticipee } from '../../models';
import { ConsentementAnticipation } from './consentement-anticipation';

describe('Consentement de l’invité à l’ouverture anticipée (V160, demande du 02/11, B7)', () => {
  let fixture: ComponentFixture<ConsentementAnticipation>;
  let http: HttpTestingController;

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const bouton = (libelle: string, dans: ParentNode = racine()): HTMLButtonElement | undefined =>
    Array.from(dans.querySelectorAll('button')).find((b) => texte(b) === libelle);
  const URL = '/api/candidat/invitations/12/ouverture-anticipee';
  const demande = (accord: boolean | null, etat: OuvertureAnticipee['etat'] = 'DEMANDEE'): OuvertureAnticipee => ({
    idDmc: 12, etat, ouvertureInitiale: '2026-11-25T10:00:00',
    consentements: [{ idCandidat: 'C000000001', nom: 'Invité 1', accord, reponduLe: accord === null ? null : '2026-11-04T08:00:00' }],
  });

  function monter(reponse: OuvertureAnticipee | null, statut = 200): void {
    TestBed.configureTestingModule({ imports: [ConsentementAnticipation], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConsentementAnticipation);
    fixture.componentRef.setInput('idDmc', 12);
    fixture.detectChanges();
    const req = http.expectOne(URL);
    if (statut === 200) req.flush(reponse);
    else req.flush({ code: 'NON_INVITE' }, { status: statut, statusText: 'Not Found' });
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('se tait sans demande et hors invités', () => {
    monter(null);
    expect(racine().querySelector('section')).toBeNull();
    TestBed.resetTestingModule();
    monter(null, 404);
    expect(racine().querySelector('section')).toBeNull();
  });

  it('consent par écrit après confirmation', () => {
    monter(demande(null));
    bouton('Je consens')!.click();
    fixture.detectChanges();
    expect(texte(racine().querySelector('.modal-body'))).toContain('ne se reprend pas');
    bouton('Je consens', racine().querySelector('.modal-footer')!)!.click();
    const req = http.expectOne(`${URL}/consentement`);
    expect(req.request.body).toEqual({ accord: true });
    req.flush(demande(true));
    fixture.detectChanges();
    expect(texte(racine())).toContain('Vous avez consenti le 04/11/2026 à 08:00');
    expect(bouton('Je refuse')).toBeUndefined();
  });

  it('annonce que le refus clôt la demande pour tous, et nomme une demande déjà close', () => {
    monter(demande(null));
    bouton('Je refuse')!.click();
    fixture.detectChanges();
    expect(texte(racine().querySelector('.modal-body'))).toContain('clôt la demande pour tous les invités');
    bouton('Je refuse', racine().querySelector('.modal-footer')!)!.click();
    http.expectOne(`${URL}/consentement`).flush({ code: 'ANTICIPATION_CLOSE' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(texte(racine().querySelector('[role=alert]'))).toContain('déjà close');
  });
});
