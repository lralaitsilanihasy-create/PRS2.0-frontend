import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { SeanceFinanciere } from '../../models';
import { DroitsEvaluation, EspaceEvaluation } from './droits-evaluation';
import { SeanceFinanciereVue, montantLu, refusSeanceFinanciere } from './seance-financiere';

const SEANCE: SeanceFinanciere = {
  idDmc: 49, etat: 'DECHIFFREE', methode: 'Qualité technique et coût', quorum: 2,
  aOuvrir: [{ idOffre: 'f-1', numero: 1, raisonSociale: 'Bureau d’études A', lot: null, noteTechnique: 82.5, rangTechnique: 1, partsRecues: 0, integrite: 'INTACTE', acteEngagement: { montantHt: 150000000, montantTtc: '180000000' } }],
  nonOuvertes: [{ numero: 2, raisonSociale: 'Bureau d’études B', lot: null, motif: 'Note technique de 58 points, sous le score minimum de 70 points' }],
  presents: [], autres: [], secoursEmploye: false, ouverteLe: '2026-10-09T10:00:00', dechiffreeLe: '2026-10-09T10:20:00', closeLe: null,
  pvDisponible: false, ronde: 1, motif: null, rondes: [],
};
const DROITS = (responsable: boolean, membre: boolean): DroitsEvaluation => ({ membre, declaree: membre, conflit: false, decider: membre, president: false, prmp: false, responsable });
const api = (status: number, corps: object): ApiError => ({ status, message: 'x', raw: new HttpErrorResponse({ status, error: corps }) }) as unknown as ApiError;

describe('Seconde séance d’ouverture (lot 3 PI, tranche PI-d1 — V88)', () => {
  it('lit les montants de l’acte, nombre ou texte', () => {
    expect(montantLu(SEANCE.aOuvrir[0], 'montantHt')).toBe(150000000);
    expect(montantLu(SEANCE.aOuvrir[0], 'montantTtc')).toBe(180000000);
    expect(montantLu({ ...SEANCE.aOuvrir[0], acteEngagement: null }, 'montantHt')).toBeNull();
  });

  it('nomme les refus, lots compris', () => {
    expect(refusSeanceFinanciere(api(409, { code: 'TECHNIQUE_NON_ARRETEE', details: { lots: [2, 3] } }))).toBe('L’évaluation technique n’est pas arrêtée (lot(s) 2, 3) : la seconde séance l’attend.');
    expect(refusSeanceFinanciere(api(409, { code: 'AUCUNE_FINANCIERE_A_OUVRIR' }))).toContain('aucune proposition n’est qualifiée');
  });

  describe('l’encart', () => {
    let fixture: ComponentFixture<SeanceFinanciereVue>;
    let http: HttpTestingController;
    const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const bouton = (debut: string) => Array.from(racine().querySelectorAll('button')).find((b) => texte(b).startsWith(debut)) as HTMLButtonElement | undefined;

    function monter(espace: EspaceEvaluation, droits: DroitsEvaluation, reponse: SeanceFinanciere | null): void {
      TestBed.configureTestingModule({
        imports: [SeanceFinanciereVue],
        providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }],
      });
      http = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(SeanceFinanciereVue);
      fixture.componentRef.setInput('idDmc', 49);
      fixture.componentRef.setInput('droits', droits);
      fixture.componentRef.setInput('espace', espace);
      fixture.componentRef.setInput('membres', [{ membre: 'K1', nom: 'Président', president: true }, { membre: 'K2', nom: 'Membre', president: false }]);
      fixture.detectChanges();
      const r = http.expectOne('/api/fiches-marche/49/seance/financiere');
      if (reponse) r.flush(reponse);
      else r.flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
    }

    afterEach(() => {
      fixture.destroy();
      http.verify();
    });

    it('pas encore ouverte : le responsable l’ouvre ; un membre attend', () => {
      monter('interne', DROITS(true, false), null);
      bouton('Ouvrir la seconde séance')!.click();
      const post = http.expectOne('/api/fiches-marche/49/seance/financiere/ouvrir');
      expect(post.request.method).toBe('POST');
      post.flush({ ...SEANCE, etat: 'OUVERTE' });
      fixture.detectChanges();
      expect(texte(racine().querySelector('.sf__etat'))).toContain('Ouverte');
    });

    it('ouverte : le membre apporte ses parts de la seconde séance', () => {
      monter('cao', DROITS(false, true), { ...SEANCE, etat: 'OUVERTE' });
      expect(racine().querySelector('app-apport-parts')).not.toBeNull();
      expect(bouton('Ouvrir la seconde séance')).toBeUndefined();
    });

    it('déchiffrée : les montants lus, les enveloppes non ouvertes et leur motif ; le responsable clôt avec les présents', () => {
      monter('interne', DROITS(true, false), SEANCE);
      expect(texte(racine().querySelector('.sf__table tbody tr'))).toContain('82.5');
      expect(texte(racine().querySelector('.sf__table tbody tr'))).toContain('150');
      expect(texte(racine().querySelector('.sf__non'))).toContain('sous le score minimum');
      expect(bouton('Clore la séance')!.disabled).toBe(true);
      fixture.componentInstance.basculer('K1', true);
      fixture.detectChanges();
      bouton('Clore la séance')!.click();
      const post = http.expectOne('/api/fiches-marche/49/seance/financiere/cloturer');
      expect(post.request.body).toEqual({ presents: ['K1'], autres: [], observations: null });
      post.flush({ ...SEANCE, etat: 'CLOSE', pvDisponible: true });
      fixture.detectChanges();
      expect(bouton('PV de la seconde séance')).toBeDefined();
    });
  });
});
