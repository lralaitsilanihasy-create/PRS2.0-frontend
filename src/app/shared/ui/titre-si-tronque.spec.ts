import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TitreSiTronqueDirective } from './titre-si-tronque';

@Component({
  standalone: true,
  imports: [TitreSiTronqueDirective],
  template: `<span class="obj" appTitreSiTronque>{{ texte() }}</span>`,
})
class Hote {
  readonly texte = signal('Fourniture et livraison de matériels');
}

/** jsdom ne calcule aucune mise en page : on impose les mesures que le navigateur donnerait. */
function mesurer(el: HTMLElement, contenu: { h: number; l: number }, visible: { h: number; l: number }): void {
  Object.defineProperty(el, 'scrollHeight', { value: contenu.h, configurable: true });
  Object.defineProperty(el, 'scrollWidth', { value: contenu.l, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: visible.h, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: visible.l, configurable: true });
}

describe('appTitreSiTronque — l’infobulle n’apparaît que sur un texte vraiment coupé', () => {
  let fixture: ComponentFixture<Hote>;
  let span: HTMLElement;
  let rejouer: (() => void)[];

  beforeEach(() => {
    rejouer = [];
    // jsdom n'a pas de ResizeObserver : on en pose un factice pour vérifier que la mesure est bien rejouée.
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(private readonly rappel: () => void) {
        rejouer.push(() => this.rappel());
      }
      observe(): void {
        /* rien à faire : le déclenchement est manuel dans le test */
      }
      disconnect(): void {
        /* rien à faire */
      }
    };
    TestBed.configureTestingModule({ imports: [Hote] });
    fixture = TestBed.createComponent(Hote);
    span = fixture.nativeElement.querySelector('.obj') as HTMLElement;
  });

  it('texte lisible en entier : aucun title — l’infobulle native ne répète pas ce qu’on lit déjà', async () => {
    mesurer(span, { h: 20, l: 300 }, { h: 20, l: 300 });
    fixture.detectChanges();
    await Promise.resolve();
    expect(span.hasAttribute('title')).toBe(false);
  });

  it('texte coupé en hauteur (line-clamp) : le title porte le texte complet', async () => {
    mesurer(span, { h: 96, l: 300 }, { h: 60, l: 300 });
    fixture.detectChanges();
    await Promise.resolve();
    expect(span.getAttribute('title')).toBe('Fourniture et livraison de matériels');
  });

  it('texte coupé en largeur (text-overflow) : même règle', async () => {
    mesurer(span, { h: 20, l: 820 }, { h: 20, l: 300 });
    fixture.detectChanges();
    await Promise.resolve();
    expect(span.getAttribute('title')).not.toBeNull();
  });

  it('un écart d’un pixel ne suffit pas : les hauteurs sous-pixel d’une police mise à l’échelle ne créent pas de fausse infobulle', async () => {
    mesurer(span, { h: 61, l: 300 }, { h: 60, l: 300 });
    fixture.detectChanges();
    await Promise.resolve();
    expect(span.hasAttribute('title')).toBe(false);
  });

  it('la colonne s’élargit : la mesure est rejouée et l’infobulle devenue inutile disparaît', async () => {
    mesurer(span, { h: 96, l: 300 }, { h: 60, l: 300 });
    fixture.detectChanges();
    await Promise.resolve();
    expect(span.hasAttribute('title')).toBe(true);

    mesurer(span, { h: 20, l: 300 }, { h: 20, l: 300 });
    rejouer.forEach((r) => r());
    expect(span.hasAttribute('title')).toBe(false);
  });
});
