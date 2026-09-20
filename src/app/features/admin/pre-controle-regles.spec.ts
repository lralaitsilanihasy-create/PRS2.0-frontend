import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { StatistiquesRegles } from '../../models';
import { PreControleRegles } from './pre-controle-regles';

/**
 * Taux d'écartement des règles du pré-contrôle (lot 3, étape 7).
 *
 * Ce que ces tests protègent : la règle massivement écartée est **signalée**, un signalement **levé** n'est
 * pas compté comme un écartement — les confondre ferait éteindre les règles qui marchent —, une **piste** de
 * l'assistant se distingue d'une **règle**, une règle éteinte se voit, et l'échec de lecture affiche son
 * état avec une reprise plutôt qu'un écran vide.
 */
const STATS: StatistiquesRegles = {
  exercice: null,
  total: 16,
  ecartes: 10,
  tauxGlobal: 0.625,
  regles: [
    {
      code: 'MENTION_DELAI_REDUIT',
      libelle: 'Délai aménagé sans la mention « délai réduit » dans l’objet',
      source: 'REGLE',
      actif: true,
      total: 12,
      ouverts: 2,
      ecartes: 10,
      leves: 0,
      taux: 0.8333,
      suspecte: true,
    },
    {
      code: 'MODE_SOUS_LE_SEUIL',
      libelle: 'Mode de passation en deçà du seuil applicable au montant',
      source: 'REGLE',
      actif: true,
      total: 4,
      ouverts: 1,
      ecartes: 0,
      leves: 3,
      taux: 0,
      suspecte: false,
    },
    {
      code: 'FRACTIONNEMENT_DEGUISE',
      libelle: 'Même besoin réparti sur plusieurs lignes',
      source: 'IA',
      actif: false,
      total: 0,
      ouverts: 0,
      ecartes: 0,
      leves: 0,
      taux: 0,
      suspecte: false,
    },
  ],
};

describe('Taux d’écartement des règles du pré-contrôle', () => {
  let fixture: ComponentFixture<PreControleRegles>;
  let http: HttpTestingController;

  const monter = (reponse: StatistiquesRegles | null = STATS) => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PreControleRegles);
    fixture.detectChanges();
    const requete = http.expectOne('/api/pre-controle/statistiques');
    if (reponse === null) {
      requete.flush('non', { status: 500, statusText: 'Server Error' });
    } else {
      requete.flush(reponse);
    }
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  const texte = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('marque « À revoir » la règle écartée presque à chaque fois, et donne son taux en pourcentage', () => {
    const ecran = monter();

    expect(ecran.suspectes().map((r) => r.code)).toEqual(['MENTION_DELAI_REDUIT']);
    expect(texte()).toContain('83 %');
    expect(texte()).toContain('À revoir');
    const lignes = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(lignes[0].classList.contains('pcr-suspecte')).toBe(true);
  });

  it('un signalement LEVÉ n’est pas un écartement : la règle qui fait corriger les plans reste active', () => {
    monter();
    const lignes = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    const mode = lignes[1].textContent ?? '';

    expect(mode).toContain('Mode de passation en deçà du seuil');
    expect(mode).toContain('Active');
    expect(mode).not.toContain('À revoir');
  });

  it('distingue une piste de l’assistant d’une règle, et montre qu’une règle éteinte l’est', () => {
    monter();
    const lignes = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');

    expect(lignes[2].textContent).toContain('Piste');
    expect(lignes[2].textContent).toContain('Éteinte');
    expect(lignes[0].textContent).toContain('Règle');
  });

  it('explique comment le tableau se lit — sans quoi « écartés » et « levés » se confondent', () => {
    monter();
    expect(texte()).toContain("c'est la réussite de la règle");
    expect(texte()).toContain('désaccords motivés');
  });

  it('un échec de lecture affiche l’état d’erreur et sa reprise, jamais un tableau vide', () => {
    const ecran = monter(null);

    expect(ecran.erreur()).toBe(true);
    expect(texte()).toContain("n'ont pas pu être chargés");

    ecran.charger();
    fixture.detectChanges();
    http.expectOne('/api/pre-controle/statistiques').flush(STATS);
    fixture.detectChanges();
    expect(ecran.erreur()).toBe(false);
    expect(texte()).toContain('83 %');
  });
});
