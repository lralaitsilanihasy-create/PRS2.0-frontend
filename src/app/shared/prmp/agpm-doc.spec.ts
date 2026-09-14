import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentVisionneuse } from '../ui/document-visionneuse';
import { LigneAgpm } from './agpm';
import { AgpmDoc } from './agpm-doc';
import { ObservationLigne } from './document-officiel';

/**
 * ⚠️ 2026-09-14 (décision des chefs, refonte ergonomique lot 1) — le projet d'AGPM suit la même
 * feuille officielle que le PPM : titre du modèle, en-têtes gris clair. L'en-tête ORANGE « à la
 * couleur de l'onglet » (demande pilote du 02/09) ne doit pas revenir.
 */
const LIGNES: LigneAgpm[] = [
  { idDetail: 1, compte: '2441', nature: 'Fournitures', objet: 'Matériels informatiques', montant: 420000000, financement: 'RPI', modeLibelle: "Appel d'Offres Ouvert", dateDao: '2026-10-05' },
  { idDetail: 2, compte: '6211', nature: 'Services', objet: 'Maintenance', montant: 380000000, financement: 'RPI', modeLibelle: "Appel d'Offres Ouvert", dateDao: null },
];

@Component({
  selector: 'app-hote-agpm-test',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgpmDoc, DocumentVisionneuse],
  template: `
    <app-document-visionneuse [interrupteur]="true">
      <app-agpm-doc [lignes]="lignes" [exercice]="2026" [observations]="observations()" />
    </app-document-visionneuse>
  `,
})
class HoteAgpmTest {
  readonly lignes = LIGNES;
  readonly observations = signal<ObservationLigne[]>([]);
}

describe('AgpmDoc — feuille officielle', () => {
  let fixture: ComponentFixture<HoteAgpmTest>;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HoteAgpmTest] }).compileComponents();
    fixture = TestBed.createComponent(HoteAgpmTest);
    fixture.detectChanges();
  });

  it("garde le titre du modèle officiel et des en-têtes non colorés", () => {
    expect(racine().querySelector('.doc-titre')?.textContent?.trim()).toBe("AVIS GENERAL DE PASSATION DES MARCHES POUR L'ANNEE 2026");
    const table = racine().querySelector('table') as HTMLTableElement;
    expect(table.classList).toContain('doc-table');
    expect(table.classList).not.toContain('cnm-table');
    expect(Array.from(table.querySelectorAll('th')).map((th) => th.textContent?.trim())).toEqual([
      'COMPTE', 'NATURE', 'OBJET', 'MONTANT ESTIMATIF du MARCHE', 'FINANCEMENT', 'MODE DE PASSATION', 'DATE du DAO',
    ]);
    const styles = Array.from(document.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n').toLowerCase();
    expect(styles).toContain('doc-note--apres'); // styles du composant injectés : la garde est effective
    expect(styles).not.toContain('#c2410c');
    expect(styles).not.toContain('#15803d');
  });

  it("marque une ligne observée (marqueur de marge + pastille), puis la masque avec l'interrupteur", () => {
    fixture.componentInstance.observations.set([
      { idDetail: 2, numero: 4 },
      { idDetail: 2, numero: 1 },
    ]);
    fixture.detectChanges();

    const marqueur = racine().querySelector('tbody tr:nth-child(2) .doc-marqueur') as HTMLElement;
    expect(marqueur.classList).toContain('doc-marqueur--obs');
    expect(marqueur.getAttribute('aria-label')).toBe('Observations n° 1, 4');
    expect(Array.from(marqueur.querySelectorAll('.doc-pastille')).map((p) => p.textContent?.trim())).toEqual(['1', '4']);
    expect(racine().querySelector('tbody tr:first-child .doc-marqueur')).toBeNull();

    (racine().querySelector('button.doc-interrupteur') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(racine().querySelectorAll('.doc-annot').length).toBe(0);
    expect(racine().querySelectorAll('tbody tr').length).toBe(2);
  });
});
