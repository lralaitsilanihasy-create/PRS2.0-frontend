import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { Technique } from '../../models';
import { DroitsEvaluation } from './droits-evaluation';
import { EtapeTechnique, chargeGrille, parCritere } from './etape-technique';

const ELEMENTS: Technique['elements'] = [
  { code: 'B06-TP-02', critere: 'B06-TP-02', libelleCritere: 'Expérience du consultant', libelle: null, max: 10 },
  { code: 'B06-TP-03#1', critere: 'B06-TP-03', libelleCritere: 'Méthodologie', libelle: 'Approche technique', max: 20 },
  { code: 'B06-TP-03#2', critere: 'B06-TP-03', libelleCritere: 'Méthodologie', libelle: 'Plan de travail', max: 10 },
];
const TECHNIQUE: Technique = {
  idDmc: 49, scoreMinimum: 25, seuilEcartPourcent: 20, elements: ELEMENTS,
  lots: [{
    lot: 1, conformiteArretee: true, arret: null,
    offres: [{
      idOffre: 'p-1', numero: 1, nif: '1000', raisonSociale: 'Bureau d’études A',
      grilles: [{ im: 'K1', nom: 'Président', notes: [{ element: 'B06-TP-02', note: 8, motif: 'Trois missions similaires', le: null }] },
        { im: 'K2', nom: 'Membre', notes: [{ element: 'B06-TP-02', note: 5, motif: 'Une seule mission', le: null }] }],
      moyennes: [{ element: 'B06-TP-02', moyenne: 6.5, min: 5, max: 8, nombreNotes: 2, ecart: true }],
      total: 6.5, complete: false, statut: 'EN_COURS', motifElimination: null, rang: 1,
    }],
  }],
};
const DROITS = (president: boolean): DroitsEvaluation => ({ membre: true, declaree: true, conflit: false, decider: true, president, prmp: false, responsable: false });

describe('Évaluation technique des propositions (lot 3 PI, tranche PI-c — V87)', () => {
  it('regroupe les éléments par critère, dans l’ordre servi', () => {
    expect(parCritere(ELEMENTS).map((g) => [g.libelle, g.elements.length])).toEqual([['Expérience du consultant', 1], ['Méthodologie', 2]]);
  });

  it('ma grille : les notes saisies seulement, dans le barème, chacune motivée', () => {
    const s = new Map([['B06-TP-02', { note: '7', motif: 'Deux missions' }], ['B06-TP-03#1', { note: '', motif: '' }]]);
    expect(chargeGrille(ELEMENTS, (c) => s.get(c))).toEqual({ notes: [{ element: 'B06-TP-02', note: 7, motif: 'Deux missions' }] });
    expect(chargeGrille(ELEMENTS, () => ({ note: '12', motif: 'x' }))).toEqual({ erreur: '« Expérience du consultant » : la note va de 0 à 10.' });
    expect(chargeGrille(ELEMENTS, () => ({ note: '4', motif: ' ' }))).toEqual({ erreur: '« Expérience du consultant » : chaque note se motive.' });
    expect(chargeGrille(ELEMENTS, () => undefined)).toEqual({ erreur: 'Saisissez au moins une note, motivée.' });
  });

  describe('l’étape', () => {
    let fixture: ComponentFixture<EtapeTechnique>;
    let http: HttpTestingController;
    let maj: Technique[];
    const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

    function monter(president: boolean, moi = 'K2'): void {
      TestBed.configureTestingModule({
        imports: [EtapeTechnique],
        providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }],
      });
      http = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(EtapeTechnique);
      fixture.componentRef.setInput('idDmc', 49);
      fixture.componentRef.setInput('technique', TECHNIQUE);
      fixture.componentRef.setInput('lot', 1);
      fixture.componentRef.setInput('droits', DROITS(president));
      fixture.componentRef.setInput('moi', moi);
      maj = [];
      fixture.componentInstance.maj.subscribe((t) => maj.push(t));
      fixture.detectChanges();
    }

    afterEach(() => http.verify());

    it('classe les propositions, signale l’écart, et reprend ma grille enregistrée', () => {
      monter(false);
      expect(texte(racine().querySelector('.et__classement tbody tr'))).toContain('6.5');
      expect(texte(racine().querySelector('.et__classement tbody tr'))).toContain('1 écart(s)');
      expect(racine().querySelector('.et__ligne--ecart')).not.toBeNull();
      const note = racine().querySelector('input[aria-label="Ma note — Expérience du consultant"]') as HTMLInputElement;
      expect(note.value).toBe('5');
      expect(racine().querySelector('app-etape-technique section.et__president, .et__president')).toBeNull();
    });

    it('enregistre ma grille : les notes saisies, motivées', () => {
      monter(false);
      const ecrire = (label: string, v: string) => {
        const champ = racine().querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
        champ.value = v;
        champ.dispatchEvent(new Event('input'));
      };
      ecrire('Ma note — Approche technique', '16');
      ecrire('Motif de ma note — Approche technique', 'Démarche claire, calendrier réaliste');
      fixture.detectChanges();
      (Array.from(racine().querySelectorAll('button')).find((b) => texte(b) === 'Enregistrer ma grille') as HTMLButtonElement).click();
      const put = http.expectOne('/api/fiches-marche/49/evaluation/technique/offres/p-1/notes');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ notes: [
        { element: 'B06-TP-02', note: 5, motif: 'Une seule mission' },
        { element: 'B06-TP-03#1', note: 16, motif: 'Démarche claire, calendrier réaliste' },
      ] });
      put.flush(TECHNIQUE);
      expect(maj).toHaveLength(1);
    });

    it('le président arrête ; une notation incomplète est nommée avec ses propositions', () => {
      monter(true, 'K1');
      (Array.from(racine().querySelectorAll('button')).find((b) => texte(b).startsWith('Arrêter l’évaluation technique')) as HTMLButtonElement).click();
      http.expectOne('/api/fiches-marche/49/evaluation/technique/lots/1/arreter').flush(
        { code: 'NOTATION_INCOMPLETE', message: 'x', details: { offres: [1] } },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();
      expect(texte(racine().querySelector('[role="alert"]'))).toContain('la ou les propositions n° 1 attendent les grilles de tous les membres');
    });

    it('arrêtée : plus de saisie ; le président peut rouvrir avec un motif', () => {
      monter(true, 'K1');
      fixture.componentRef.setInput('technique', { ...TECHNIQUE, lots: [{ ...TECHNIQUE.lots[0], arret: { le: '2026-10-09T10:00:00', par: 'K1', nom: null, observation: null, rouverteLe: null, motifReouverture: null } }] });
      fixture.detectChanges();
      expect(racine().querySelector('input[aria-label^="Ma note"]')).toBeNull();
      expect(texte(racine().querySelector('.et__president'))).toContain('Rouvrir l’évaluation technique');
    });
  });
});
