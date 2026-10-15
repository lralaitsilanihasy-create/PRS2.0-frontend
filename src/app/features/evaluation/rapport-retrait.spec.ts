import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToastService } from '../../core/notifications/toast.service';
import { Evaluation } from '../../models';
import { DroitsEvaluation } from './droits-evaluation';
import { RapportEvaluationVue } from './rapport-evaluation';

// ⚠️ V120 (15/10, guide de la CAO, §B5) — la commission ne valide pas : le président retire le rapport, motif obligatoire.
const DROITS: DroitsEvaluation = { membre: true, declaree: true, conflit: false, decider: true, president: true, prmp: false, responsable: false };

function evaluation(rapportSigne = false): Evaluation {
  return {
    idDmc: 44, etat: 'EN_COURS', ouverteLe: '2026-10-15T08:00:00', ouvertePar: 'R1', nonEvaluees: [], lots: [],
    declarations: [
      { membre: 'K1', nom: 'Rakoto', president: true, signeeLe: '2026-10-15T08:00:00', conflit: false, precision: null },
      { membre: 'K2', nom: 'Rabe', president: false, signeeLe: '2026-10-15T08:00:00', conflit: false, precision: null },
    ],
    rapport: {
      produitLe: '2026-10-15T09:00:00', observations: null, signe: rapportSigne, signeLe: null,
      signatures: [{ im: 'K2', nom: 'Rabe', president: false, date: '2026-10-15T09:10:00', empechement: false, motif: null, constatePar: null, observation: null }],
      signaturesAttendues: rapportSigne ? [] : [{ im: 'K1', nom: 'Rakoto', qualite: 'PRESIDENT' }],
    },
    rapportsRetires: [],
  } as Evaluation;
}

describe('V120 — retirer le rapport d’évaluation avant sa validation', () => {
  let http: HttpTestingController;
  let f: ComponentFixture<RapportEvaluationVue>;
  const el = () => f.nativeElement as HTMLElement;
  const bouton = (t: string) => Array.from(el().querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === t) as HTMLButtonElement | undefined;

  function monter(moi: string, ev: Evaluation, droits: DroitsEvaluation = DROITS): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: () => undefined, error: () => undefined } }] });
    http = TestBed.inject(HttpTestingController);
    f = TestBed.createComponent(RapportEvaluationVue);
    f.componentRef.setInput('idDmc', 44);
    f.componentRef.setInput('evaluation', ev);
    f.componentRef.setInput('droits', droits);
    f.componentRef.setInput('moi', moi);
    f.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('proposé au président seul, et jamais sur un rapport signé de tous', () => {
    monter('K2', evaluation(), { ...DROITS, president: false });
    expect(bouton('Retirer le rapport')).toBeUndefined();
    TestBed.resetTestingModule();
    monter('K1', evaluation(true));
    expect(bouton('Retirer le rapport')).toBeUndefined();
  });

  it('motif obligatoire, puis le retrait : l’évaluation remontée au parent, le rapport retiré listé', () => {
    monter('K1', evaluation());
    bouton('Retirer le rapport')!.click();
    f.detectChanges();
    const modale = el().querySelector('[role="dialog"]')!;
    expect(modale.textContent).toContain('Les 1 signature(s) déjà posée(s) tombent');
    const confirmer = Array.from(modale.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Retirer le rapport') as HTMLButtonElement;
    expect(confirmer.disabled).toBe(true);
    f.componentInstance.motifRetrait.set('Demande d’éclaircissement au candidat n° 2');
    f.detectChanges();
    expect(confirmer.disabled).toBe(false);

    let remontee: Evaluation | null = null;
    f.componentInstance.maj.subscribe((e) => (remontee = e));
    confirmer.click();
    const req = http.expectOne('/api/fiches-marche/44/evaluation/rapport/retirer');
    expect(req.request.body).toEqual({ motif: 'Demande d’éclaircissement au candidat n° 2' });
    const apres = {
      ...evaluation(), rapport: null,
      rapportsRetires: [{ id: 7, produitLe: '2026-10-15T09:00:00', retireLe: '2026-10-15T10:00:00', retirePar: 'K1', nom: 'Rakoto', motif: 'Demande d’éclaircissement au candidat n° 2', signatures: 'Rabe, signé le 15/10/2026' }],
    } as Evaluation;
    req.flush(apres);
    f.componentRef.setInput('evaluation', apres);
    f.detectChanges();
    expect(remontee).not.toBeNull();
    expect(el().querySelector('[role="dialog"]')).toBeNull();
    expect((el().textContent ?? '').replace(/\s+/g, ' ')).toContain('Rapports retirés');
    expect(el().textContent).toContain('motif : « Demande d’éclaircissement au candidat n° 2 »');

    (el().querySelector('[aria-label^="Lire le rapport retiré"]') as HTMLButtonElement).click();
    http.expectOne('/api/fiches-marche/44/evaluation/rapport/retires/7').flush(new Blob(['%PDF']));
  });
});
