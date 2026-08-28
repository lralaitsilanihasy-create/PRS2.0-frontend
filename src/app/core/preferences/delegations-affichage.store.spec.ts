import { TestBed } from '@angular/core/testing';

import { DelegationsAffichageStore } from './delegations-affichage.store';

/**
 * ⚠️ Demande user (2026-08-28) : « faire en sorte qu'on peut masquer ou afficher les menus de
 * exercice par délégation ». Repli d'AFFICHAGE, à ne pas confondre avec les interrupteurs de
 * PERMISSION du 15/08, retirés le même jour — d'où le test sur l'absence de matricule dans la clé.
 */
describe('DelegationsAffichageStore', () => {
  function creer(): DelegationsAffichageStore {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [DelegationsAffichageStore] });
    return TestBed.inject(DelegationsAffichageStore);
  }

  beforeEach(() => localStorage.clear());

  it('AFFICHÉ par défaut : la délégation étant automatique, on ne cache rien sans le demander', () => {
    expect(creer().affichees()).toBe(true);
  });

  it('la bascule replie PUIS déplie (aller-retour)', () => {
    const store = creer();
    store.basculer();
    expect(store.affichees()).toBe(false);
    store.basculer();
    expect(store.affichees()).toBe(true);
  });

  it('la préférence survit au rechargement de la page', () => {
    creer().basculer();
    // Une instance neuve relit le stockage, comme au prochain démarrage de l'application.
    expect(creer().affichees()).toBe(false);
  });

  // ⚠️ ANTI-RÉGRESSION — l'ancienne clé `cnm.delegations-exercees.<matricule>` nommait qui s'était
  // connecté sur le poste : c'est ce que le constat S9 de l'audit reprochait. Celle-ci ne porte
  // qu'un booléen, elle n'a donc pas à être purgée à la déconnexion.
  it('la clé stockée ne contient AUCUN matricule — pas de rémanence d’identité', () => {
    creer().basculer();
    const cles = Object.keys(localStorage);
    expect(cles).toEqual(['cnm.delegations-repliees']);
    expect(localStorage.getItem('cnm.delegations-repliees')).toBe('1');
    expect(cles.some((c) => c.startsWith('cnm.delegations-exercees.'))).toBe(false);
  });

  it('une valeur de stockage inconnue est traitée comme « affiché »', () => {
    localStorage.setItem('cnm.delegations-repliees', 'peut-être');
    expect(creer().affichees()).toBe(true);
  });
});
