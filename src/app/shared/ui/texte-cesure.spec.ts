import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TexteCesure } from './texte-cesure';

@Component({
  selector: 'app-hote-cesure-test',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TexteCesure],
  template: `<span class="cible" [appTexteCesure]="texte()"></span>`,
})
class HoteCesure {
  readonly texte = signal<string | null>('Fournitures de bureau\nLot 1');
}

describe('TexteCesure', () => {
  it('écrit un mot par boîte, espaces entre les mots, saut de ligne entre les lignes', () => {
    const fixture = TestBed.createComponent(HoteCesure);
    fixture.detectChanges();
    const cible = (fixture.nativeElement as HTMLElement).querySelector('.cible') as HTMLElement;

    expect(Array.from(cible.querySelectorAll('.doc-mot')).map((m) => m.textContent)).toEqual(['Four­ni­tures', 'de', 'bu­reau', 'Lot', '1']);
    expect(cible.querySelectorAll('br').length).toBe(1);
    expect((cible.textContent ?? '').replace(/­/g, '')).toBe('Fournitures de bureauLot 1');
    // Aucun HTML interprété : un texte à balises reste du texte.
    fixture.componentInstance.texte.set('<b>Travaux</b>');
    fixture.detectChanges();
    expect(cible.querySelector('b')).toBeNull();
    expect(cible.querySelectorAll('.doc-mot').length).toBe(1);

    fixture.componentInstance.texte.set(null);
    fixture.detectChanges();
    expect(cible.childNodes.length).toBe(0);
  });
});
