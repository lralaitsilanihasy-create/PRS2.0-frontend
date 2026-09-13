import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModaleDirective } from './modale.directive';

/**
 * ⚠️ Demande pilote (2026-09-13) — les modals ne se ferment PLUS au clic sur le voile (clic hors du
 * dialogue) : la fermeture est réservée au bouton « Fermer » / « Annuler » (ou Échap au clavier).
 * Le flag `appModaleClicExterieur` est conservé (compat des gabarits) mais n'a plus aucun effet.
 */
@Component({
  selector: 'app-hote-modale-test',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    <div class="voile">
      <div
        class="modal"
        role="dialog"
        aria-label="Dialogue de test"
        [appModale]="actif()"
        appModaleClicExterieur
        (appModaleFermer)="fermetures.set(fermetures() + 1)"
      >
        <button type="button" class="dedans">Action</button>
      </div>
    </div>
  `,
})
class HoteModaleTest {
  readonly actif = signal(true);
  readonly fermetures = signal(0);
}

describe('ModaleDirective', () => {
  let fixture: ComponentFixture<HoteModaleTest>;
  let hote: HoteModaleTest;

  const el = <T extends HTMLElement>(sel: string): T =>
    fixture.nativeElement.querySelector(sel) as T;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HoteModaleTest] }).compileComponents();
    fixture = TestBed.createComponent(HoteModaleTest);
    hote = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('clic sur le voile — ne ferme plus (2026-09-13)', () => {
    it('ne ferme pas quand le clic a lieu sur le voile', () => {
      el('.voile').click();
      expect(hote.fermetures()).toBe(0);
    });

    it('ne ferme pas non plus quand le clic a lieu dans le dialogue', () => {
      el('.dedans').click();
      expect(hote.fermetures()).toBe(0);
    });
  });

  describe('clavier', () => {
    it('Échap demande la fermeture', () => {
      el('.modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(hote.fermetures()).toBe(1);
    });

    it('donne un tabindex au conteneur et y place le focus', () => {
      expect(el('.modal').getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('[appModale]="false"', () => {
    beforeEach(async () => {
      fixture = TestBed.createComponent(HoteModaleTest);
      hote = fixture.componentInstance;
      hote.actif.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('laisse le conteneur inerte : ni Échap, ni tabindex', () => {
      el('.modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(hote.fermetures()).toBe(0);
      expect(el('.modal').hasAttribute('tabindex')).toBe(false);
    });
  });
});
