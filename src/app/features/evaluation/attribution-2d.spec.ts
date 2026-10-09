import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { LotAttribution, SansSuite } from '../../models';
import { DecisionsLot, infructuositeDeclarable, refus2d, repriseOuverte } from './decisions-lot';
import { SansSuiteVue } from './sans-suite';

const LOT = (extra: Partial<LotAttribution>): LotAttribution =>
  ({ lot: 1, etat: 'AVIS_RENDU', proposition: null, dossierMarche: null, projetDisponible: false, ...extra }) as LotAttribution;
const DEF = { idDossier: 900, sousType: 'MAOO', statut: 'CLOTURE', avis: 'DEF' } as LotAttribution['dossierMarche'];
const api = (status: number, corps: object): ApiError => ({ status, message: 'x', raw: new HttpErrorResponse({ status, error: corps }) }) as unknown as ApiError;
const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

function preparer() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }] });
  return TestBed.inject(HttpTestingController);
}

describe('Attribution, tranche 2d (V91-V93)', () => {
  it('2d-1 : l’infructuosité suit la proposition du rapport ou l’avis défavorable, jamais l’attribution ; la reprise, l’avis défavorable seul', () => {
    const propose = LOT({ proposition: { idOffre: null, numero: null, candidat: null, montant: null, montantTtc: null, delai: null, infructueux: true } });
    expect(infructuositeDeclarable(propose)).toBe(true);
    expect(repriseOuverte(propose)).toBe(false);
    expect(infructuositeDeclarable(LOT({ dossierMarche: DEF }))).toBe(true);
    expect(repriseOuverte(LOT({ dossierMarche: DEF }))).toBe(true);
    expect(infructuositeDeclarable(LOT({ dossierMarche: DEF, attributaire: { idOffre: 'o', numero: 1, candidat: 'X', nif: null, montant: 1, montantTtc: 1, delai: null, motif: null, le: '', par: null } }))).toBe(false);
    expect(infructuositeDeclarable(LOT({ dossierMarche: DEF, infructuosite: { le: '', par: null, motif: 'x', decisionReference: null, decisionDate: null, suite: null } }))).toBe(false);
  });

  it('nomme les refus de la tranche 2d', () => {
    expect(refus2d(api(409, { code: 'AUTRES_LOTS_ATTRIBUES', details: { lots: [2] } }))).toContain('(lot(s) 2)');
    expect(refus2d(api(409, { code: 'AUCUN_SUIVANT_ELIGIBLE' }))).toContain('seule une déclaration sans suite');
    expect(refus2d(api(409, { code: 'DEJA_ATTRIBUE' }))).toContain('art. 56-VI');
  });

  it('2d-1 : la PRMP déclare l’infructuosité après un avis défavorable, décision et suite comprises', () => {
    const http = preparer();
    const fixture = TestBed.createComponent(DecisionsLot);
    fixture.componentRef.setInput('idDmc', 40);
    fixture.componentRef.setInput('lot', LOT({ dossierMarche: DEF }));
    fixture.componentRef.setInput('prmp', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(texte(el)).toContain('Ou reprendre l’évaluation');
    const c = fixture.componentInstance;
    c.motifInfructuosite.set('Avis défavorable de la Commission sur le dossier de marché');
    c.reference.set('DEC-2026-014');
    c.date.set('2026-10-09');
    c.suite.set('RELANCE');
    c.declarer();
    const post = http.expectOne('/api/fiches-marche/40/attribution/lots/1/infructueux');
    expect(post.request.body).toEqual({ motif: 'Avis défavorable de la Commission sur le dossier de marché', decision: { reference: 'DEC-2026-014', date: '2026-10-09' }, suite: 'RELANCE' });
    post.flush({ idDmc: 40, lots: [] });
    c.motifReprise.set('Erreur de calcul relevée par la Commission');
    c.reprendre();
    http.expectOne('/api/fiches-marche/40/attribution/lots/1/reprendre').flush({ code: 'AUTRES_LOTS_ATTRIBUES', message: 'x', details: { lots: [2] } }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(texte(el.querySelector('[role="alert"]'))).toContain('Un autre lot de la procédure est déjà attribué');
    http.verify();
  });

  describe('2d-3 : la déclaration sans suite', () => {
    const DEMANDE = { id: 3, motifs: 'Besoin disparu', demandeLe: '2026-10-09T09:00:00', demandePar: 'PRMP001', idDossier: 100400, statutDossier: 'BROUILLON', recuLe: null, echeance: null, echeanceDepassee: false, avis: null, etat: 'A_SOUMETTRE' as const, decisionReference: null, decisionDate: null, declareLe: null, motifsDisponibles: true };

    function monter(s: SansSuite) {
      const http = preparer();
      const fixture = TestBed.createComponent(SansSuiteVue);
      fixture.componentRef.setInput('idDmc', 40);
      fixture.componentRef.setInput('prmp', true);
      fixture.componentRef.setInput('lienDossier', true);
      fixture.detectChanges();
      http.expectOne('/api/fiches-marche/40/sans-suite').flush(s);
      fixture.detectChanges();
      return { http, fixture, el: fixture.nativeElement as HTMLElement };
    }

    it('sans demande : la PRMP crée le dossier DSS avec ses motifs', () => {
      const { http, fixture } = monter({ idDmc: 40, declaree: false, courante: null, demandes: [] });
      fixture.componentInstance.motifsSaisis.set('Besoin disparu');
      fixture.componentInstance.demander();
      const post = http.expectOne('/api/fiches-marche/40/sans-suite');
      expect(post.request.body).toEqual({ motifs: 'Besoin disparu' });
      post.flush({ idDmc: 40, declaree: false, courante: DEMANDE, demandes: [DEMANDE] });
      fixture.detectChanges();
      expect(texte((fixture.nativeElement as HTMLElement).querySelector('.ss__actions'))).toContain('Ouvrir le dossier pour le soumettre');
      http.verify();
    });

    it('avis favorable : la PRMP déclare, avec sa décision', () => {
      const favorable = { ...DEMANDE, etat: 'FAVORABLE' as const, avis: 'FAV', statutDossier: 'CLOTURE', recuLe: '2026-10-09T10:00:00', echeance: '2026-10-16' };
      const { http, fixture, el } = monter({ idDmc: 40, declaree: false, courante: favorable, demandes: [favorable] });
      expect(texte(el.querySelector('.ss__ligne'))).toContain('Avis favorable — à déclarer');
      fixture.componentInstance.reference.set('DEC-2026-020');
      fixture.componentInstance.date.set('2026-10-09');
      fixture.componentInstance.declarer();
      const post = http.expectOne('/api/fiches-marche/40/sans-suite/declarer');
      expect(post.request.body).toEqual({ decision: { reference: 'DEC-2026-020', date: '2026-10-09' } });
      post.flush({ idDmc: 40, declaree: true, courante: null, demandes: [{ ...favorable, etat: 'DECLAREE', declareLe: '2026-10-09T11:00:00', decisionReference: 'DEC-2026-020' }] });
      fixture.detectChanges();
      expect(texte(el)).toContain('La procédure est déclarée sans suite');
      http.verify();
    });
  });
});
