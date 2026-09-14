import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FichePresentation } from './fiche-presentation';
import { FichePresentationDoc } from './fiche-presentation-doc';

/**
 * ⚠️ 2026-09-14 (décision des chefs, refonte ergonomique lot 1) — la fiche de présentation suit la
 * même feuille officielle que le PPM : bordures noires, en-têtes gris clair. Les en-têtes VERTS
 * (demande pilote du 06/09) et le tableau « cnm-table » ne doivent pas revenir.
 */
const FICHE: FichePresentation = {
  derogatoires: [
    { idDetail: 6, objet: 'Frais de colloque', montant: 85000000, modeLibelle: 'Gré à gré', delaiJours: null, delaiMinJours: null, justifModeDerogatoire: 'Prestataire unique' },
  ],
  delaisAmenages: [
    { idDetail: 6, objet: 'Frais de colloque', montant: 85000000, modeLibelle: 'Gré à gré', delaiJours: 10, delaiMinJours: 15 },
  ],
  contratsCadres: [],
  nbMarchesConcernes: 1,
};

/** Toutes les feuilles de style injectées par les composants rendus (encapsulation émulée). */
const stylesInjectes = (): string =>
  Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');

describe('FichePresentationDoc — feuille officielle', () => {
  let fixture: ComponentFixture<FichePresentationDoc>;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FichePresentationDoc] }).compileComponents();
    fixture = TestBed.createComponent(FichePresentationDoc);
    fixture.componentRef.setInput('fiche', FICHE);
    fixture.componentRef.setInput('exercice', 2026);
    fixture.detectChanges();
  });

  it("pose le titre officiel et des tableaux au format du document, en-têtes non colorés", () => {
    expect(racine().querySelector('.doc-titre')?.textContent?.trim()).toBe('FICHE DE PRESENTATION');
    const tables = Array.from(racine().querySelectorAll('table'));
    expect(tables.length).toBe(2);
    for (const t of tables) {
      expect(t.classList).toContain('doc-table');
      expect(t.classList).not.toContain('cnm-table');
    }
    for (const th of Array.from(racine().querySelectorAll('th'))) {
      expect(th.getAttribute('style')).toBeNull();
    }
    // Plus aucune règle de couleur d'en-tête propre au composant (vert du 06/09, orange du 02/09) —
    // les styles du composant sont bien injectés (garde effective), sans ces couleurs.
    expect(stylesInjectes()).toContain('doc-justif');
    expect(stylesInjectes().toLowerCase()).not.toContain('#15803d');
    expect(stylesInjectes().toLowerCase()).not.toContain('#c2410c');
  });

  it("marque une ligne observée dans la marge, avec sa pastille numérotée", () => {
    expect(racine().querySelectorAll('.doc-marqueur').length).toBe(0);
    fixture.componentRef.setInput('observations', [{ idDetail: 6, numero: 3, liste: 'derogatoires' }]);
    fixture.detectChanges();

    const marqueurs = Array.from(racine().querySelectorAll<HTMLElement>('.doc-marqueur'));
    // Liste ciblée seulement : la même ligne dans « délais aménagés » reste sans marque.
    expect(marqueurs.length).toBe(1);
    expect(marqueurs[0].classList).toContain('doc-marqueur--obs');
    expect(marqueurs[0].getAttribute('aria-label')).toBe('Observation n° 3');
    expect(marqueurs[0].querySelector('.doc-pastille')?.textContent?.trim()).toBe('3');
    expect(racine().querySelector('.doc-document')?.classList).toContain('doc-gouttiere-g');
  });

  it("« Observer cette cellule » : émet le code préfixé de la liste et la valeur affichée, seulement si observable", () => {
    const emis: { idDetail: number; champ: string; valeur: string }[] = [];
    fixture.componentInstance.celluleClick.subscribe(({ idDetail, champ, valeur }) => emis.push({ idDetail, champ, valeur }));
    const justification = (): HTMLElement => racine().querySelectorAll<HTMLElement>('tbody')[0].querySelectorAll('td')[3];
    justification().click();
    expect(emis).toEqual([]);
    expect(racine().querySelector('.doc-corps--observable')).toBeNull();

    fixture.componentRef.setInput('observable', true);
    fixture.detectChanges();
    expect(racine().querySelectorAll('.doc-corps--observable').length).toBe(2);
    justification().click();
    (racine().querySelectorAll<HTMLElement>('tbody')[1].querySelectorAll('td')[3] as HTMLElement).click();
    expect(emis).toEqual([
      { idDetail: 6, champ: 'derogatoires.justification', valeur: 'Prestataire unique' },
      { idDetail: 6, champ: 'delaisAmenages.delaiRemise', valeur: '10 jours' },
    ]);
  });

  it("masque ses annotations (mention d'origine, observations) sans toucher au document", () => {
    fixture.componentRef.setInput('observations', [{ idDetail: 6, numero: 1 }]);
    fixture.detectChanges();
    expect(racine().querySelectorAll('.doc-marqueur').length).toBe(2);
    expect(racine().querySelector('.doc-note')).not.toBeNull();

    fixture.componentRef.setInput('annotations', false);
    fixture.detectChanges();

    expect(racine().querySelectorAll('.doc-annot').length).toBe(0);
    expect(racine().querySelector('.doc-document')?.classList).not.toContain('doc-gouttiere-g');
    expect(racine().querySelectorAll('tbody tr').length).toBe(2);
  });
});
