import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Financiere, Negociations } from '../../models';
import { DroitsEvaluation } from './droits-evaluation';
import { EtapeFinanciere, deplacer, exAequo } from './etape-financiere';
import { refusPi } from './libelles-pi';
import { NegociationPi, manquesConclusion } from './negociation-pi';
import { SaisieFinanciereVue, montantCompareIndicatif } from './saisie-financiere';

const P = (n: number, extra: object = {}) => ({
  idOffre: 't-' + n, idFinanciere: 'f-' + n, numero: n, nif: '100' + n, raisonSociale: 'Bureau ' + n, noteTechnique: 80 - n, rangTechnique: n,
  financiereOuverte: true, saisie: null, statut: 'A_EVALUER' as const, motif: null, montantCompare: null, scoreFinancier: null, scoreCombine: null,
  rang: null, egalite: false, ...extra,
});
const FINANCIERE: Financiere = {
  idDmc: 49, methode: 'Qualité technique et coût', codeMethode: 'QUALITE_COUT', poidsTechnique: 0.8, poidsFinancier: 0.2, budget: null,
  lots: [{ lot: 1, arret: null, departage: null, propositions: [
    P(1, { statut: 'EVALUEE', montantCompare: 100000000, scoreFinancier: 100, scoreCombine: 83.2, rang: 1, egalite: true }),
    P(2, { statut: 'EVALUEE', montantCompare: 110000000, scoreFinancier: 90.91, scoreCombine: 83.2, rang: 1, egalite: true }),
  ] }],
};
const NEGO: Negociations = { idDmc: 49, lots: [{ lot: 1, classementArrete: true, prochain: { idOffre: 't-1', numero: 1, raisonSociale: 'Bureau 1', rang: 1, financiereOuverte: true }, conclue: false, negociations: [] }] };
const DROITS = (president: boolean): DroitsEvaluation => ({ membre: true, declaree: true, conflit: false, decider: true, president, prmp: false, responsable: false });
const api = (status: number, corps: object): ApiError => ({ status, message: 'x', raw: new HttpErrorResponse({ status, error: corps }) }) as unknown as ApiError;
const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Évaluation financière, classement et négociation (lot 3 PI, tranche PI-d2a — V89)', () => {
  it('règles de l’écran : ex aequo, déplacement, montant comparé indicatif, conclusion complète', () => {
    expect(exAequo(FINANCIERE.lots[0]).map((p) => p.numero)).toEqual([1, 2]);
    expect(deplacer(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(deplacer(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(montantCompareIndicatif(120, 20)).toBe(100);
    expect(montantCompareIndicatif(null, 20)).toBeNull();
    expect(manquesConclusion({ resultat: 'ECHOUEE', date: '2026-10-09', texte: 'PV', motif: '' })).toEqual(['Le motif de l’échec.']);
    expect(manquesConclusion({ resultat: null, date: '', texte: '', motif: '' })).toHaveLength(3);
  });

  it('nomme les refus propres aux PI, avant ceux de l’évaluation des offres', () => {
    expect(refusPi(api(409, { code: 'CLASSEMENT_NON_ARRETE' }))).toBe('Le classement du lot n’est pas arrêté par le président.');
    expect(refusPi(api(409, { code: 'EGALITE_NON_DEPARTAGEE', details: { offres: [1, 2] } }))).toContain('(propositions n° 1, 2)');
    expect(refusPi(api(409, { code: 'FINANCIERE_NON_OUVERTE', details: { numero: 3 } }))).toContain('de la proposition n° 3');
  });

  function preparer() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }] });
    return TestBed.inject(HttpTestingController);
  }

  describe('le classement', () => {
    let fixture: ComponentFixture<EtapeFinanciere>;
    let http: HttpTestingController;

    function monter(president: boolean): void {
      http = preparer();
      fixture = TestBed.createComponent(EtapeFinanciere);
      fixture.componentRef.setInput('idDmc', 49);
      fixture.componentRef.setInput('financiere', FINANCIERE);
      fixture.componentRef.setInput('lot', 1);
      fixture.componentRef.setInput('droits', DROITS(president));
      fixture.detectChanges();
    }
    afterEach(() => http.verify());

    it('montre la méthode, les scores, l’égalité ; le départage part dans l’ordre choisi, motivé', () => {
      monter(false);
      const el = fixture.nativeElement as HTMLElement;
      expect(texte(el.querySelector('.ef__methode'))).toContain('Qualité technique et coût');
      expect(el.querySelectorAll('.ef__egal')).toHaveLength(2);
      expect(el.querySelectorAll('app-saisie-financiere')).toHaveLength(2);
      fixture.componentInstance.monter(1, -1);
      fixture.componentInstance.motifDepartage.set('Meilleure note technique');
      fixture.componentInstance.departager(FINANCIERE.lots[0]);
      const post = http.expectOne('/api/fiches-marche/49/evaluation/financiere/lots/1/departager');
      expect(post.request.body).toEqual({ ordre: ['t-2', 't-1'], motif: 'Meilleure note technique' });
      post.flush(FINANCIERE);
    });

    it('le président arrête ; une égalité non départagée est nommée', () => {
      monter(true);
      (Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => texte(b).startsWith('Arrêter le classement')) as HTMLButtonElement).click();
      http.expectOne('/api/fiches-marche/49/evaluation/financiere/lots/1/arreter').flush({ code: 'EGALITE_NON_DEPARTAGEE', message: 'x', details: { offres: [1, 2] } }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(texte((fixture.nativeElement as HTMLElement).querySelector('.ef [role="alert"]'))).toContain('Égalité à départager (propositions n° 1, 2)');
    });
  });

  it('la saisie d’une enveloppe financière : corrections, dépenses remboursables, sur l’enveloppe financière', () => {
    const http = preparer();
    const fixture = TestBed.createComponent(SaisieFinanciereVue);
    fixture.componentRef.setInput('idDmc', 49);
    fixture.componentRef.setInput('proposition', P(1));
    fixture.componentRef.setInput('modifiable', true);
    fixture.detectChanges();
    fixture.componentInstance.ouvert(true);
    http.expectOne('/api/fiches-marche/49/evaluation/financiere/offres/f-1/corrections-proposees').flush([{ ligne: 2, libelle: 'Total ligne 2', avant: 1000, apres: 1200, regle: 'PU_PREVAUT' }]);
    fixture.componentInstance.remboursables.set(5000000);
    fixture.componentInstance.motifRemboursables.set('Billets d’avion et per diem');
    fixture.componentInstance.enregistrer();
    const put = http.expectOne('/api/fiches-marche/49/evaluation/financiere/offres/f-1');
    expect(put.request.body).toEqual({
      prixLu: null,
      corrections: [{ ligne: 2, libelle: 'Total ligne 2', avant: 1000, apres: 1200, regle: 'PU_PREVAUT', retenue: true }],
      remboursables: 5000000, motifRemboursables: 'Billets d’avion et per diem', refusCandidat: null,
    });
    put.flush(FINANCIERE);
    http.verify();
  });

  describe('la négociation', () => {
    let fixture: ComponentFixture<NegociationPi>;
    let http: HttpTestingController;

    function monter(n: Negociations, conduite: boolean): void {
      http = preparer();
      fixture = TestBed.createComponent(NegociationPi);
      fixture.componentRef.setInput('idDmc', 49);
      fixture.componentRef.setInput('negociations', n);
      fixture.componentRef.setInput('lot', 1);
      fixture.componentRef.setInput('conduite', conduite);
      fixture.detectChanges();
    }
    afterEach(() => http.verify());

    it('la PRMP ouvre la négociation avec le premier classé', () => {
      monter(NEGO, true);
      fixture.componentInstance.lieu.set('Salle de réunion du ministère');
      fixture.componentInstance.ouvrir(NEGO.lots[0]);
      const post = http.expectOne('/api/fiches-marche/49/evaluation/negociation/lots/1/ouvrir');
      expect(post.request.body).toEqual({ prevueLe: null, lieu: 'Salle de réunion du ministère' });
      post.flush(NEGO);
    });

    it('en cours : elle se conclut échouée, motivée ; un suivant sans enveloppe ouverte attend la séance complémentaire', () => {
      const enCours: Negociations = { idDmc: 49, lots: [{ ...NEGO.lots[0], prochain: null, negociations: [{
        id: 7, idOffre: 't-1', idFinanciere: 'f-1', numero: 1, raisonSociale: 'Bureau 1', rang: 1, etat: 'EN_COURS', ouverteLe: null, ouvertePar: null,
        prevueLe: null, lieu: null, conclueLe: null, concluePar: null, dateNegociation: null, texte: null, motifEchec: null, pieceNom: null, pvDisponible: false,
      }] }] };
      monter(enCours, true);
      const c = fixture.componentInstance;
      c.resultat.set('ECHOUEE');
      c.date.set('2026-10-09');
      c.texte.set('Le candidat maintient ses honoraires.');
      c.motif.set('Désaccord sur les honoraires');
      c.conclure(enCours.lots[0].negociations[0]);
      const post = http.expectOne('/api/fiches-marche/49/evaluation/negociation/7/conclure');
      expect(post.request.body).toEqual({ resultat: 'ECHOUEE', dateNegociation: '2026-10-09', lieu: null, texte: 'Le candidat maintient ses honoraires.', motif: 'Désaccord sur les honoraires' });
      post.flush({ idDmc: 49, lots: [{ ...NEGO.lots[0], prochain: { idOffre: 't-2', numero: 2, raisonSociale: 'Bureau 2', rang: 2, financiereOuverte: false }, negociations: [{ ...enCours.lots[0].negociations[0], etat: 'ECHOUEE' }] }] });
      fixture.componentRef.setInput('negociations', { idDmc: 49, lots: [{ ...NEGO.lots[0], prochain: { idOffre: 't-2', numero: 2, raisonSociale: 'Bureau 2', rang: 2, financiereOuverte: false }, negociations: [{ ...enCours.lots[0].negociations[0], etat: 'ECHOUEE', motifEchec: 'Désaccord sur les honoraires' }] }] });
      fixture.detectChanges();
      expect(texte(fixture.nativeElement as HTMLElement)).toContain('le responsable de la procédure ouvre d’abord une séance complémentaire');
    });
  });
});
