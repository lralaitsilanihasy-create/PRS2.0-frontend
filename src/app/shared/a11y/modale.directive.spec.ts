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

  /**
   * ⚠️ Recette L4-Q2 (2026-09-16), défauts (e) et (k) — le focus ne doit JAMAIS retomber sur le corps
   * de page à la fermeture : sans élément focalisé, ni Échap ni Tab ne trouvent plus de destinataire,
   * et un lecteur d'écran n'a plus rien à annoncer.
   */
  describe('restitution du focus à la fermeture', () => {
    let fixtureRetour: ComponentFixture<HoteRetourTest>;
    const q = <T extends HTMLElement>(sel: string): T => fixtureRetour.nativeElement.querySelector(sel) as T;

    beforeEach(async () => {
      // Le module du `beforeEach` général est déjà instancié : on repart d'un module neuf.
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HoteRetourTest] }).compileComponents();
      fixtureRetour = TestBed.createComponent(HoteRetourTest);
      // Le fixture doit être DANS le document : `document.activeElement` ne suit pas un arbre détaché.
      document.body.appendChild(fixtureRetour.nativeElement);
      fixtureRetour.detectChanges();
    });

    afterEach(() => fixtureRetour.nativeElement.remove());

    it('déclencheur encore là : il reprend le focus', async () => {
      q('.declencheur').focus();
      fixtureRetour.componentInstance.ouverte.set(true);
      fixtureRetour.detectChanges();
      await fixtureRetour.whenStable();
      fixtureRetour.componentInstance.ouverte.set(false);
      fixtureRetour.detectChanges();
      expect(document.activeElement).toBe(q('.declencheur'));
    });

    it('déclencheur disparu : le focus va au point de reprise de l’écran, pas au corps de page', async () => {
      q('.declencheur').focus();
      fixtureRetour.componentInstance.ouverte.set(true);
      fixtureRetour.detectChanges();
      await fixtureRetour.whenStable();
      // Le geste lancé par le bouton l'a retiré de la page (transition, relecture…).
      fixtureRetour.componentInstance.avecDeclencheur.set(false);
      fixtureRetour.componentInstance.ouverte.set(false);
      fixtureRetour.detectChanges();
      expect(document.activeElement).toBe(q('.repli'));
    });

    it('sous une modale encore ouverte : le focus lui revient, elle reçoit de nouveau Échap', async () => {
      fixtureRetour.componentInstance.ouverte.set(true);
      fixtureRetour.detectChanges();
      await fixtureRetour.whenStable();
      // Cas de la visionneuse PDF : son déclencheur était DÉSACTIVÉ pendant le chargement du document,
      // donc le focus était déjà sur le corps de page au moment où elle s'est ouverte.
      (document.activeElement as HTMLElement | null)?.blur();
      expect(document.activeElement).toBe(document.body);
      fixtureRetour.componentInstance.dessus.set(true);
      fixtureRetour.detectChanges();
      await fixtureRetour.whenStable();
      fixtureRetour.componentInstance.dessus.set(false);
      fixtureRetour.detectChanges();
      expect(document.activeElement).toBe(q('.modale-dessous'));
      q('.modale-dessous').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(fixtureRetour.componentInstance.fermeturesDessous()).toBe(1);
    });
  });
});

@Component({
  selector: 'app-hote-retour-test',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    <h1 class="repli" tabindex="-1" data-focus-repli>Titre de l'écran</h1>
    @if (avecDeclencheur()) {
      <button type="button" class="declencheur">Agir</button>
    }
    @if (ouverte()) {
      <div class="modale-dessous" role="dialog" aria-label="Dialogue du dessous" appModale (appModaleFermer)="fermeturesDessous.set(fermeturesDessous() + 1)"></div>
    }
    @if (dessus()) {
      <div class="modale-dessus" role="dialog" aria-label="Dialogue du dessus" appModale></div>
    }
  `,
})
class HoteRetourTest {
  readonly avecDeclencheur = signal(true);
  readonly ouverte = signal(false);
  readonly dessus = signal(false);
  readonly fermeturesDessous = signal(0);
}
