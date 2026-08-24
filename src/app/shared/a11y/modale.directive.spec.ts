import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ModaleDirective } from './modale.directive';

/**
 * `appModale` (AUDIT.md A1) : focus initial dans la modale, piège de Tab, Échap, restitution du
 * focus au déclencheur. Seule directive du dépôt à porter ce comportement — sans spec dédiée
 * jusqu'ici bien qu'elle équipe les 29 dialogues de l'application ; ce test verrouille son
 * contrat pour que toute régression future casse un test, pas seulement un audit manuel.
 */
@Component({
  standalone: true,
  imports: [ModaleDirective],
  template: `
    <button type="button" id="declencheur" (click)="ouvert.set(true)">Ouvrir</button>
    @if (ouvert()) {
      <div role="dialog" aria-label="Test" appModale (appModaleFermer)="ouvert.set(false)">
        <button type="button" id="premier">Premier</button>
        <button type="button" id="dernier">Dernier</button>
      </div>
    }
  `,
})
class HoteTest {
  readonly ouvert = signal(false);
}

function creer() {
  const fixture = TestBed.createComponent(HoteTest);
  fixture.detectChanges();
  return fixture;
}

function keydown(el: HTMLElement, key: string, shiftKey = false): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
}

/**
 * jsdom ne fait aucune mise en page : `offsetParent` y vaut toujours `null`, y compris pour un
 * élément bien présent dans le DOM. La directive s'en sert pour écarter les éléments masqués
 * (`display: none`) du piège de focus — nécessaire en environnement réel, mais qui viderait la
 * liste des « focalisables » dans ce test si on ne rétablissait pas la valeur ici.
 */
function rendreVisible(el: HTMLElement): void {
  Object.defineProperty(el, 'offsetParent', { get: () => document.body, configurable: true });
}

describe('ModaleDirective (appModale)', () => {
  it('déplace le focus dans la modale à l’ouverture', () => {
    const fixture = creer();
    const declencheur = fixture.nativeElement.querySelector('#declencheur') as HTMLButtonElement;
    declencheur.focus();
    declencheur.click();
    fixture.detectChanges();

    const hote = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    // Aucun [autofocus] : le conteneur lui-même reçoit le focus (tabindex="-1" posé par la directive).
    expect(document.activeElement).toBe(hote);
    expect(hote.getAttribute('tabindex')).toBe('-1');
  });

  it('restitue le focus au déclencheur à la fermeture', () => {
    const fixture = creer();
    const declencheur = fixture.nativeElement.querySelector('#declencheur') as HTMLButtonElement;
    declencheur.focus();
    declencheur.click();
    fixture.detectChanges();

    fixture.componentInstance.ouvert.set(false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(declencheur);
  });

  it('Échap émet appModaleFermer', () => {
    const fixture = creer();
    const declencheur = fixture.nativeElement.querySelector('#declencheur') as HTMLButtonElement;
    declencheur.click();
    fixture.detectChanges();

    const hote = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    keydown(hote, 'Escape');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('Tab depuis le dernier élément focalisable boucle sur le premier', () => {
    const fixture = creer();
    fixture.nativeElement.querySelector('#declencheur').click();
    fixture.detectChanges();

    const dernier = fixture.nativeElement.querySelector('#dernier') as HTMLButtonElement;
    const premier = fixture.nativeElement.querySelector('#premier') as HTMLButtonElement;
    rendreVisible(dernier);
    rendreVisible(premier);
    dernier.focus();
    keydown(dernier, 'Tab');

    expect(document.activeElement).toBe(premier);
  });

  it('Maj+Tab depuis le premier élément boucle sur le dernier', () => {
    const fixture = creer();
    fixture.nativeElement.querySelector('#declencheur').click();
    fixture.detectChanges();

    const dernier = fixture.nativeElement.querySelector('#dernier') as HTMLButtonElement;
    const premier = fixture.nativeElement.querySelector('#premier') as HTMLButtonElement;
    rendreVisible(dernier);
    rendreVisible(premier);
    premier.focus();
    keydown(premier, 'Tab', true);

    expect(document.activeElement).toBe(dernier);
  });
});
