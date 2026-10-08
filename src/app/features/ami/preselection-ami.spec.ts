import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import { ExpressionNotee, Preselection } from '../../models';
import { PreselectionAmi } from './preselection-ami';

// AMI-b (07/10, V83) — la présélection : déclaration, notation, arrêt de la liste, relance.
const URL = '/api/fiches-marche/50/ami';
const note = (code: string, max: number, n: number | null = null) => ({ code, libelle: code === 'C1' ? 'Expérience' : 'Références', max, note: n, motif: n != null ? 'vu' : null, par: null, nom: null, le: null });
const expr = (id: string, numero: number, autres: Partial<ExpressionNotee> = {}): ExpressionNotee => ({
  id, numero, nif: '100' + numero, raisonSociale: 'Cabinet ' + numero, notes: [note('C1', 60), note('C2', 40)], total: null, complete: false,
  qualifiee: false, ecartee: false, motifEcartement: null, rang: null, exAequo: false, ...autres,
});
const BASE: Preselection = {
  idDmc: 50, etat: 'NOTATION',
  declarations: [
    { membre: 'K001', nom: 'Président P.', president: true, signeeLe: '2026-10-21T08:00:00', conflit: false, precision: null },
    { membre: 'K002', nom: 'Membre M.', president: false, signeeLe: null, conflit: null, precision: null },
  ],
  expressions: [expr('e-1', 1), expr('e-2', 2)], liste: [], nombreRetenus: 6, noteMinimale: 60, motifNombre: null, observations: null,
  rapport: null, nombreRelances: 0, motifInfructueux: null,
};

describe('Présélection de l’AMI', () => {
  let fixture: ComponentFixture<PreselectionAmi>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const bouton = (texte: string): HTMLButtonElement =>
    Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.includes(texte)) as HTMLButtonElement;

  function monter(espace: 'cao' | 'interne', ref: string | null, role: string | null, ps: Preselection = BASE): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ idDmc: '50' }), data: { espace } } } },
        { provide: AuthService, useValue: { ref: signal(ref), role: signal(role) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PreselectionAmi);
    fixture.detectChanges();
    http.expectOne(`${URL}/preselection`).flush(ps);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('un membre non déclaré signe d’abord sa déclaration', () => {
    monter('cao', 'K002', 'MEMBRE_CAO');
    expect(racine().textContent).toContain('membre de la commission');
    expect(racine().querySelector('#n-e-1-C1')).toBeNull();
    (racine().querySelector('input[name="ps-conflit"]') as HTMLInputElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();
    bouton('Signer ma déclaration').click();
    const post = http.expectOne(`${URL}/preselection/declaration`);
    expect(post.request.body).toEqual({ conflit: false, precision: null });
    post.flush(BASE);
  });

  it('le président note critère par critère, dans le barème et motivé', () => {
    monter('cao', 'K001', 'MEMBRE_CAO');
    const c = fixture.componentInstance;
    const x = BASE.expressions[0];
    c.poser('e-1', 'C1', 'note', '70');
    c.poser('e-1', 'C1', 'motif', 'Dix ans de missions');
    c.poser('e-1', 'C2', 'note', '30');
    c.poser('e-1', 'C2', 'motif', 'Trois références');
    expect(c.grilleComplete(x)).toBe(false);
    c.poser('e-1', 'C1', 'note', '55');
    expect(c.grilleComplete(x)).toBe(true);
    c.noter(x);
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === `${URL}/expressions/e-1/notes`);
    expect(put.request.body).toEqual({ notes: [{ code: 'C1', note: 55, motif: 'Dix ans de missions' }, { code: 'C2', note: 30, motif: 'Trois références' }] });
    put.flush({ message: 'x', code: 'NOTE_HORS_BAREME' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(racine().textContent).toContain('Une note dépasse les points du critère');
  });

  it('arrêt : égalité au seuil → l’ordre se fixe et se renvoie', () => {
    const qualifiees = { ...BASE, nombreRetenus: 1, expressions: [
      expr('e-1', 1, { complete: true, qualifiee: true, total: 80, rang: 1, exAequo: true }),
      expr('e-2', 2, { complete: true, qualifiee: true, total: 80, rang: 1, exAequo: true }),
    ] };
    monter('cao', 'K001', 'MEMBRE_CAO', qualifiees);
    bouton('Arrêter la liste').click();
    http.expectOne(`${URL}/preselection/arreter`).flush({ message: 'x', code: 'EGALITE_A_DEPARTAGER', details: { expressions: ['e-1', 'e-2'] } }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(racine().textContent).toContain('fixez leur ordre');
    fixture.componentInstance.deplacer(0, 1);
    fixture.detectChanges();
    bouton('Arrêter la liste').click();
    const post = http.expectOne(`${URL}/preselection/arreter`);
    expect(post.request.body).toEqual({ motifNombre: null, observations: null, ordre: ['e-2', 'e-1'] });
    post.flush({ ...qualifiees, etat: 'LISTE_ARRETEE', liste: [{ rang: 1, idExpression: 'e-2', idCandidat: 'C2', nif: '1002', raisonSociale: 'Cabinet 2', note: 80 }],
      rapport: { produitLe: '2026-10-22T10:00:00', signe: false, signeLe: null, signatures: [], attendues: [{ im: 'K001', nom: 'Président P.' }] } });
    fixture.detectChanges();
    expect(racine().textContent).toContain('Liste restreinte arrêtée');
    expect(bouton('Signer le rapport')).toBeDefined();
  });

  it('la PRMP lit, relance l’appel ; elle ne note pas', () => {
    monter('interne', 'PRMP001', 'PRMP');
    expect(racine().querySelector('#n-e-1-C1')).toBeNull();
    const c = fixture.componentInstance;
    c.relanceDate.set('2026-11-15T10:00');
    c.motifPrmp.set('Trop peu d’expressions');
    fixture.detectChanges();
    bouton('Relancer l’appel').click();
    const post = http.expectOne(`${URL}/relancer`);
    expect(post.request.body).toEqual({ dateLimite: '2026-11-15T10:00:00', motif: 'Trop peu d’expressions' });
    post.flush({});
    http.expectOne(`${URL}/preselection`).flush({ ...BASE, etat: 'EN_ATTENTE', expressions: [], nombreRelances: 1 });
    fixture.detectChanges();
    expect(racine().textContent).toContain('relancé 1 fois');
  });
});
