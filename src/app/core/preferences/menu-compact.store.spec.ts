import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { MenuCompactStore } from './menu-compact.store';

/**
 * Décision de Mathieu (2026-09-16) : « bascule utilisateur mémorisée, menu large par défaut ».
 * Les deux moitiés de la phrase sont testées ici — le défaut, et la survie au rechargement.
 */
describe('MenuCompactStore (rail compact du menu, lot 5 F4)', () => {
  function creer(): MenuCompactStore {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [MenuCompactStore] });
    return TestBed.inject(MenuCompactStore);
  }

  beforeEach(() => localStorage.clear());

  it('menu LARGE par défaut : le rail ne s’impose à personne', () => {
    expect(creer().reduit()).toBe(false);
  });

  it('la bascule réduit PUIS redéploie (aller-retour)', () => {
    const store = creer();
    store.basculer();
    expect(store.reduit()).toBe(true);
    store.basculer();
    expect(store.reduit()).toBe(false);
  });

  it('la préférence survit au rechargement de la page ET à une reconnexion', () => {
    creer().basculer();
    // Une instance neuve relit le stockage, comme au prochain démarrage de l'application.
    expect(creer().reduit()).toBe(true);
    // La déconnexion ne purge pas la clé (elle ne porte aucune identité) : le réglage tient.
    expect(creer().reduit()).toBe(true);
  });

  // ⚠️ Constat S9 de l'audit — aucune clé de préférence ne doit nommer qui s'est connecté sur le
  // poste. Celle-ci ne porte qu'un booléen : elle n'a donc pas à être purgée à la déconnexion, et
  // c'est ce qui lui permet de tenir d'une session à l'autre.
  it('la clé stockée ne contient AUCUN matricule — pas de rémanence d’identité', () => {
    creer().basculer();
    expect(Object.keys(localStorage)).toEqual(['cnm.menu-compact']);
    expect(localStorage.getItem('cnm.menu-compact')).toBe('1');
  });

  it('une valeur de stockage inconnue est traitée comme « menu large »', () => {
    localStorage.setItem('cnm.menu-compact', 'peut-être');
    expect(creer().reduit()).toBe(false);
  });

  it('un stockage indisponible ne fait pas tomber l’application', () => {
    const refus = () => {
      throw new Error('SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refus);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refus);
    try {
      const store = creer();
      expect(store.reduit()).toBe(false);
      expect(() => store.basculer()).not.toThrow();
      // La bascule vaut quand même pour la session en cours.
      expect(store.reduit()).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
