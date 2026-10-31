import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BandeauSection } from './bandeau-section';
import { Bloc } from './bloc';
import { CarteIndicateurs, Indicateur } from './carte-indicateurs';
import { TitrePage } from './titre-page';

@Component({
  imports: [TitrePage, Bloc, CarteIndicateurs, BandeauSection],
  template: `
    <app-titre-page titre="Tous les dossiers" sousTitre="Votre périmètre">
      <span statut class="badge badge-success">Clôturé</span>
      <button class="btn btn-primary">Nouveau dossier</button>
    </app-titre-page>
    <app-carte-indicateurs [indicateurs]="indicateurs" />
    <app-bandeau-section titre="À traiter" />
    <app-bloc titre="Informations">
      <p>Contenu</p>
      <div actions><button class="btn btn-secondary">Retour</button></div>
    </app-bloc>
  `,
})
class Hote {
  readonly indicateurs: Indicateur[] = [
    { libelle: 'En cours', valeur: 12 },
    { libelle: 'En retard', valeur: 3, alerte: true },
  ];
}

const texte = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Composants du design institutionnel (30/10/2026)', () => {
  const monter = () => {
    const fixture = TestBed.createComponent(Hote);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('titre-page : un h1, son sous-titre, la pastille de statut dans le titre, les actions à droite', () => {
    const el = monter();
    const h1 = el.querySelector('app-titre-page h1') as HTMLElement;
    expect(texte(h1)).toBe('Tous les dossiers Clôturé');
    expect(h1.querySelector('.badge')).not.toBeNull();
    expect(texte(el.querySelector('.tp__sous-titre'))).toBe('Votre périmètre');
    expect(texte(el.querySelector('.tp__actions'))).toBe('Nouveau dossier');
  });

  it('carte-indicateurs : une case par chiffre, libellé puis valeur ; l’alerte est marquée', () => {
    const el = monter();
    const cases = Array.from(el.querySelectorAll('.ci__case'));
    expect(cases.map((c) => [texte(c.querySelector('dt')), texte(c.querySelector('dd'))])).toEqual([
      ['En cours', '12'],
      ['En retard', '3'],
    ]);
    expect(cases[1].querySelector('dd')?.classList).toContain('ci__valeur--alerte');
    expect(cases[0].querySelector('dd')?.classList).not.toContain('ci__valeur--alerte');
  });

  it('bandeau-section : un intitulé de niveau 2, annoncé comme tel', () => {
    const el = monter();
    const b = el.querySelector('app-bandeau-section [role="heading"]') as HTMLElement;
    expect(texte(b)).toBe('À traiter');
    expect(b.getAttribute('aria-level')).toBe('2');
  });

  it('bloc : une section nommée par son titre, le contenu, puis les actions en bas', () => {
    const el = monter();
    const section = el.querySelector('app-bloc section') as HTMLElement;
    expect(section.getAttribute('aria-label')).toBe('Informations');
    expect(texte(section.querySelector('h2'))).toBe('Informations');
    expect(texte(section.querySelector('.bloc__corps'))).toBe('Contenu');
    expect(texte(section.querySelector('.bloc__actions'))).toBe('Retour');
  });
});
