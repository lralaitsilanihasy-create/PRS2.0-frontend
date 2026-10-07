import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Evaluation, OffreEvaluee } from '../../models';
import { DroitsEvaluation, droitsEvaluation, etapeArretee, etapeAtteinte } from './droits-evaluation';
import { ConformiteOffre } from './etape-conformite';
import { MontantOffre } from './etape-montant';
import { EvaluationEcran } from './evaluation-ecran';
import { refusEvaluation } from './libelles-evaluation';

// Évaluation des offres, lot 1 (07/10, V76-V78) — noms du contrat (`docs/api-endpoints.md`, § L'évaluation des offres).
const OFFRE: OffreEvaluee = {
  idOffre: 'o-1',
  numero: 1,
  entreprise: { nif: '3000000001', raisonSociale: 'Entreprise Une' },
  conformite: {
    verifications: [
      { code: 'AE_PRIX', libelle: 'Acte d’engagement et prix', proposee: true, constat: 'Montant lu', satisfaite: true, observation: null },
      { code: 'GARANTIE', libelle: 'Garantie de soumission', proposee: null, constat: 'Non exigée', satisfaite: null, observation: null },
      { code: 'FRAIS_DOSSIER', libelle: 'Frais de dossier', proposee: false, constat: 'Aucun reçu validé', satisfaite: false, observation: null },
    ],
    decision: null, qualification: null, motif: null, clause: null, par: null, nom: null, le: null,
  },
  evaluation: null, anormale: null, qualification: null, rang: null, ecartee: null, precisionsEnAttente: 0,
};

const EVALUATION: Evaluation = {
  idDmc: 40,
  etat: 'EN_COURS',
  ouverteLe: '2026-10-07T09:00:00',
  ouvertePar: 'Responsable',
  declarations: [
    { membre: 'K1', nom: 'Membre Un', president: true, signeeLe: '2026-10-07T09:05:00', conflit: false, precision: null },
    { membre: 'K2', nom: 'Membre Deux', president: false, signeeLe: null, conflit: null, precision: null },
    { membre: 'K3', nom: 'Membre Trois', president: false, signeeLe: '2026-10-07T09:06:00', conflit: true, precision: 'Parent d’un gérant' },
  ],
  lots: [{ lot: 1, etape: 'CONFORMITE', etapesArretees: [], offres: [OFFRE] }],
  nonEvaluees: [],
};

const DECIDEUR: DroitsEvaluation = { membre: true, declaree: true, conflit: false, decider: true, president: false, prmp: false, responsable: false };

function refus(status: number, code: string, details?: Record<string, unknown>): ApiError {
  const raw = new HttpErrorResponse({ status, error: { code, message: 'serveur', details } });
  return { status, message: 'serveur', code, raw };
}

describe('Évaluation des offres — règles de l’écran', () => {
  it('les droits suivent l’espace, la déclaration et l’état — jamais une garde', () => {
    expect(droitsEvaluation(EVALUATION, 'cao', 'K1', null)).toMatchObject({ membre: true, decider: true, president: true });
    expect(droitsEvaluation(EVALUATION, 'cao', 'K2', null)).toMatchObject({ membre: true, declaree: false, decider: false });
    expect(droitsEvaluation(EVALUATION, 'cao', 'K3', null)).toMatchObject({ conflit: true, decider: false, president: false });
    expect(droitsEvaluation(EVALUATION, 'interne', 'PRMP001', 'PRMP')).toMatchObject({ membre: false, prmp: true, responsable: false });
    expect(droitsEvaluation(EVALUATION, 'interne', 'X', 'UGPM')).toMatchObject({ prmp: false, responsable: false, decider: false });
    expect(droitsEvaluation({ ...EVALUATION, etat: 'RAPPORT_A_SIGNER' }, 'cao', 'K1', null).decider).toBe(false);
  });

  it('étapes atteintes et arrêtées d’un lot', () => {
    const lot = { lot: 1, etape: 'ANORMALES' as const, etapesArretees: [{ etape: 'CONFORMITE' as const, par: 'K1', nom: null, le: '', observation: null }], offres: [] };
    expect(etapeAtteinte(lot, 'EVALUATION')).toBe(true);
    expect(etapeAtteinte(lot, 'QUALIFICATION')).toBe(false);
    expect(etapeArretee(lot, 'CONFORMITE')).toBe(true);
    expect(etapeArretee(lot, 'EVALUATION')).toBe(false);
  });

  it('un refus est nommé, avec les offres que le serveur désigne', () => {
    expect(refusEvaluation(refus(409, 'ETAPE_INCOMPLETE', { offres: [2, 3] }))).toContain('offre(s) n° 2, 3 sans décision');
    expect(refusEvaluation(refus(409, 'JUSTIFICATION_NON_DEMANDEE'))).toContain('Aucun rejet sans demande écrite');
    expect(refusEvaluation(refus(409, 'CODE_INCONNU'))).toBe('serveur');
  });
});

describe('Examen préliminaire d’une offre (étape 2)', () => {
  let fixture: ComponentFixture<ConformiteOffre>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const bouton = (nom: string): HTMLButtonElement => Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(nom)) as HTMLButtonElement;

  function monter(droits: DroitsEvaluation, figee = false): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConformiteOffre);
    fixture.componentRef.setInput('idDmc', 40);
    fixture.componentRef.setInput('offre', OFFRE);
    fixture.componentRef.setInput('droits', droits);
    fixture.componentRef.setInput('figee', figee);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('écarter : la grille part entière (sans objet → nul), avec qualification, motif et clause', () => {
    monter(DECIDEUR);
    (racine().querySelectorAll('input[type=radio]')[1] as HTMLInputElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const champs = racine().querySelectorAll('.co__ecart select, .co__ecart input');
    (champs[0] as HTMLSelectElement).value = 'NON_CONFORME';
    champs[0].dispatchEvent(new Event('change'));
    (champs[1] as HTMLInputElement).value = 'Spécifications non respectées';
    champs[1].dispatchEvent(new Event('input'));
    (champs[2] as HTMLInputElement).value = 'IC 30.2';
    champs[2].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    bouton('Enregistrer la décision').click();
    const put = http.expectOne('/api/fiches-marche/40/evaluation/offres/o-1/conformite');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      verifications: [
        { code: 'AE_PRIX', satisfaite: true, observation: null },
        { code: 'GARANTIE', satisfaite: null, observation: null },
        { code: 'FRAIS_DOSSIER', satisfaite: false, observation: null },
      ],
      decision: 'ECARTEE',
      qualification: 'NON_CONFORME',
      motif: 'Spécifications non respectées',
      clause: 'IC 30.2',
    });
    put.flush(EVALUATION);
  });

  it('une vérification non satisfaite n’empêche pas de retenir l’offre : l’écran le rappelle', () => {
    monter(DECIDEUR);
    (racine().querySelectorAll('input[type=radio]')[0] as HTMLInputElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(racine().textContent).toContain('1 vérification(s) non satisfaite(s)');
  });

  it('étape arrêtée, ou lecteur : aucun geste de décision', () => {
    monter(DECIDEUR, true);
    expect(racine().querySelector('.co__decision')).toBeNull();
    expect((racine().querySelector('select') as HTMLSelectElement).disabled).toBe(true);
  });
});

describe('Montant évalué d’une offre (étape 3)', () => {
  let fixture: ComponentFixture<MontantOffre>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MontantOffre);
    fixture.componentRef.setInput('idDmc', 40);
    fixture.componentRef.setInput('offre', { ...OFFRE, conformite: { ...OFFRE.conformite!, decision: 'CONFORME' } });
    fixture.componentRef.setInput('droits', DECIDEUR);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('les corrections proposées se chargent à l’ouverture ; une correction décochée part non retenue ; le prix lu est demandé sur 400', () => {
    const details = racine().querySelector('details') as HTMLDetailsElement;
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    http.expectOne('/api/fiches-marche/40/evaluation/offres/o-1/corrections-proposees').flush([
      { ligne: 3, libelle: 'Article 3', avant: 300000, apres: 330000, regle: 'LETTRES_PREVALENT' },
      { ligne: null, libelle: 'Total de l’acte', avant: 1000000, apres: 1030000, regle: 'PU_PREVAUT' },
    ]);
    fixture.detectChanges();
    const cases = racine().querySelectorAll('tbody input[type=checkbox]');
    expect(cases.length).toBe(2);
    (cases[1] as HTMLInputElement).checked = false;
    cases[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.includes('Enregistrer et calculer')) as HTMLButtonElement).click();
    const put = http.expectOne('/api/fiches-marche/40/evaluation/offres/o-1/montant');
    expect(put.request.body.corrections.map((k: { retenue: boolean }) => k.retenue)).toEqual([true, false]);
    expect(put.request.body.refusCandidat).toBeNull();
    put.flush({ code: 'PRIX_LU_OBLIGATOIRE', message: 'x' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(racine().textContent).toContain('Prix lu hors taxes');
  });
});

describe('Écran de l’évaluation', () => {
  let fixture: ComponentFixture<EvaluationEcran>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function monter(espace: 'cao' | 'interne', role: string | null, ref: string): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ToastService, useValue: { success: vi.fn() } },
        { provide: AuthService, useValue: { role: signal(role), ref: signal(ref) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['idDmc', '40']]), data: { espace } } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EvaluationEcran);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('non ouverte : le responsable l’ouvre ; un PV non signé est nommé', () => {
    monter('interne', 'RESPONSABLE', 'R1');
    http.expectOne('/api/fiches-marche/40/evaluation').flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    (Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.includes('Ouvrir l')) as HTMLButtonElement).click();
    http.expectOne('/api/fiches-marche/40/evaluation/ouvrir').flush({ code: 'SEANCE_NON_CLOSE', message: 'x' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(racine().textContent).toContain('une fois le PV d’ouverture signé de tous');
  });

  it('membre non déclaré : la déclaration s’impose avant toute décision, et part au serveur', () => {
    monter('cao', null, 'K2');
    http.expectOne('/api/fiches-marche/40/evaluation').flush(EVALUATION);
    fixture.detectChanges();
    const form = racine().querySelector('.ev__form-decl') as HTMLElement;
    expect(form).not.toBeNull();
    (form.querySelectorAll('input[type=radio]')[0] as HTMLInputElement).dispatchEvent(new Event('change'));
    const engagement = form.querySelector('input[type=checkbox]') as HTMLInputElement;
    engagement.checked = true;
    engagement.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (form.querySelector('button') as HTMLButtonElement).click();
    const post = http.expectOne('/api/fiches-marche/40/evaluation/declaration');
    expect(post.request.body).toEqual({ conflit: false, precision: null });
    post.flush(EVALUATION);
  });

  it('président déclaré : il voit le geste d’arrêter l’étape en cours', () => {
    monter('cao', null, 'K1');
    http.expectOne('/api/fiches-marche/40/evaluation').flush(EVALUATION);
    fixture.detectChanges();
    expect(racine().textContent).toContain('Arrêter l\'étape « Examen préliminaire »');
    expect(racine().querySelectorAll('app-conformite-offre').length).toBe(1);
  });
});
