import { TestBed } from '@angular/core/testing';

import { Icone, NOMS_ICONES } from './icone';

describe('Icone', () => {
  it('rend un SVG décoratif au trait de la maquette (1,8, grille 24, currentColor)', () => {
    const fixture = TestBed.createComponent(Icone);
    fixture.componentRef.setInput('nom', 'check');
    fixture.componentRef.setInput('taille', 14);
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('stroke-width')).toBe('1.8');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.querySelector('path')?.getAttribute('d')).toBe('M5 12.5l4.5 4.5L19 7.5');
  });

  it('reprend le jeu complet des icônes des maquettes, plus celles du menu (2026-09-15)', () => {
    expect(NOMS_ICONES.length).toBe(44);
    for (const nom of ['link', 'globe', 'key']) expect(NOMS_ICONES).toContain(nom);
    // Lot 5 (2026-09-16) : le bouton de tiroir de la coquille, qui portait encore un « ☰ ».
    expect(NOMS_ICONES).toContain('menu');
    for (const nom of ['clock', 'message', 'alert', 'chevl', 'chev', 'pen', 'edit', 'send', 'eye', 'x', 'plus']) {
      expect(NOMS_ICONES).toContain(nom);
    }
  });
});
