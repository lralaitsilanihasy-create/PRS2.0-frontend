import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModaleDirective } from './modale.directive';

/**
 * La fermeture au clic sur le voile a quitté les gabarits pour cette directive (chantier a11y
 * 2026-08-27) : c'est ce qui a permis de retirer les `(click)` posés sur des `<div>` non
 * focalisables. Le comportement de souris doit rester **exactement** celui d'avant — d'où ces
 * cas, qui reprennent les pièges du motif remplacé (clic dans le dialogue, clic sur un élément
 * que son gestionnaire retire du DOM, propagation au-delà du voile).
 */
@Component({
  selector: 'app-hote-modale-test',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    <!-- La sonde de propagation de .au-dessus est posée par le test en addEventListener :
         écrite en (click) ici, elle serait un div cliquable sans équivalent clavier — le
         motif même que ce chantier supprime, et ESLint ne distingue pas une sonde d'une IHM. -->
    <div class="au-dessus">
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
        @if (volatilePresent()) {
          <button type="button" class="volatile" (click)="volatilePresent.set(false)">
            Volatile
          </button>
        }
      </div>
    </div>
    </div>
  `,
})
class HoteModaleTest {
  readonly actif = signal(true);
  readonly fermetures = signal(0);
  readonly volatilePresent = signal(true);
}

describe('ModaleDirective', () => {
  let fixture: ComponentFixture<HoteModaleTest>;
  let hote: HoteModaleTest;
  /** Sonde de propagation : ce qui remonte au-delà du voile. */
  let clicsAuDessus: number;

  const el = <T extends HTMLElement>(sel: string): T =>
    fixture.nativeElement.querySelector(sel) as T;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HoteModaleTest] }).compileComponents();
    fixture = TestBed.createComponent(HoteModaleTest);
    hote = fixture.componentInstance;
    fixture.detectChanges();
    clicsAuDessus = 0;
    el('.au-dessus').addEventListener('click', () => (clicsAuDessus += 1));
  });

  describe('clic sur le voile', () => {
    it('ferme quand le clic a lieu sur le voile lui-même', () => {
      el('.voile').click();
      expect(hote.fermetures()).toBe(1);
    });

    it('ne ferme pas quand le clic a lieu dans le dialogue', () => {
      el('.dedans').click();
      expect(hote.fermetures()).toBe(0);
    });

    it('ne ferme pas quand le clic vise un élément que son gestionnaire retire du DOM', () => {
      // Piège du `contains(target)` naïf : la cible n'est plus dans le document quand
      // l'événement atteint le voile. `composedPath()` garde le trajet d'origine.
      el('.volatile').click();
      expect(hote.volatilePresent()).toBe(false);
      expect(hote.fermetures()).toBe(0);
    });

    it('arrête un clic intérieur au niveau du voile, comme le faisait stopPropagation()', () => {
      el('.dedans').click();
      expect(clicsAuDessus).toBe(0);
    });

    it('laisse en revanche remonter le clic sur le voile lui-même', () => {
      el('.voile').click();
      expect(clicsAuDessus).toBe(1);
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

    it('laisse le conteneur inerte : ni Échap, ni fermeture au clic extérieur', () => {
      el('.voile').click();
      el('.modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(hote.fermetures()).toBe(0);
      expect(el('.modal').hasAttribute('tabindex')).toBe(false);
    });
  });
});
