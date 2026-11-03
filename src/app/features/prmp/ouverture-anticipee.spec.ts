import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OuvertureAnticipee } from '../../models';
import { OuvertureAnticipeePanneau } from './ouverture-anticipee';

describe('Ouverture anticipée des plis, côté PRMP (V160, demande du 02/11, B7)', () => {
  let fixture: ComponentFixture<OuvertureAnticipeePanneau>;
  let http: HttpTestingController;

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const bouton = (debut: string): HTMLButtonElement | undefined =>
    Array.from(racine().querySelectorAll('button')).find((b) => texte(b).startsWith(debut));
  const URL = '/api/fiches-marche/12/ouverture-anticipee';

  const demande = (etat: OuvertureAnticipee['etat'], accords: (boolean | null)[]): OuvertureAnticipee => ({
    idDmc: 12, etat, ouvertureInitiale: '2026-11-25T10:00:00', nouvelleOuverture: etat === 'FIXEE' ? '2026-11-12T09:00:00' : null,
    demandeeLe: '2026-11-03T09:00:00',
    consentements: accords.map((a, i) => ({ idCandidat: `C00000000${i + 1}`, nom: `Invité ${i + 1}`, accord: a, reponduLe: a === null ? null : '2026-11-04T08:00:00' })),
  });

  function monter(existante: OuvertureAnticipee | null, restreint = true, clos = false): void {
    TestBed.configureTestingModule({ imports: [OuvertureAnticipeePanneau], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OuvertureAnticipeePanneau);
    fixture.componentRef.setInput('idDmc', 12);
    fixture.componentRef.setInput('restreint', restreint);
    fixture.componentRef.setInput('clos', clos);
    fixture.componentRef.setInput('prmp', true);
    fixture.detectChanges();
    http.expectOne(URL).flush(existante);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('se tait hors appel d’offres restreint, et une fois les dépôts clos sans demande', () => {
    monter(null, false);
    expect(racine().querySelector('section')).toBeNull();
    TestBed.resetTestingModule();
    monter(null, true, true);
    expect(racine().querySelector('section')).toBeNull();
  });

  it('demande après confirmation et nomme les invités qui n’ont pas déposé', () => {
    monter(null);
    bouton('Demander l’ouverture anticipée')!.click();
    fixture.detectChanges();
    expect(texte(racine().querySelector('.modal-body'))).toContain('les offres sont figées');
    bouton('Demander les consentements')!.click();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    req.flush({ code: 'DEPOTS_INCOMPLETS', details: { manquants: ['Invité 2'] } }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(texte(racine().querySelector('[role=alert]'))).toContain('Invité 2');
  });

  it('liste les réponses puis fixe l’heure une fois tous d’accord', () => {
    monter(demande('ACCORDEE', [true, true, true]));
    expect(racine().querySelectorAll('.oa__ligne').length).toBe(3);
    expect(texte(racine())).toContain('a consenti le 04/11/2026 à 08:00');
    const champ = racine().querySelector('input[type=datetime-local]') as HTMLInputElement;
    expect(champ.max).toBe('2026-11-25T10:00');
    champ.value = '2026-11-12T09:00';
    champ.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    bouton('Fixer l’heure')!.click();
    const req = http.expectOne(`${URL}/date`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nouvelleOuverture: '2026-11-12T09:00' });
    req.flush(demande('FIXEE', [true, true, true]));
    fixture.detectChanges();
    expect(texte(racine())).toContain('Les plis s’ouvriront le 12/11/2026 à 09:00');
  });

  it('dit le refus, sans geste', () => {
    monter(demande('REFUSEE', [true, false]));
    expect(texte(racine())).toContain('Un invité a refusé');
    expect(texte(racine())).toContain('a refusé le');
    expect(racine().querySelector('input')).toBeNull();
  });
});
