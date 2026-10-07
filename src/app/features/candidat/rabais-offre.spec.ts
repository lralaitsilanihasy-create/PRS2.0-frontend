import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RabaisOffre, RabaisOffreSaisie, controlerRabais, phraseRabais } from './rabais-offre';

// Rabais structuré (arbitrage Q4 du 07/10) : contrôlé avant le scellement, sur les règles que le serveur rejoue à l'ouverture.
const POURCENT: RabaisOffre = { nature: 'POURCENTAGE', valeur: 2, condition: 'AUCUNE', lots: null, libelle: null };

describe('Rabais structuré — contrôle avant le scellement', () => {
  it('RABAIS_INVALIDE : nul, pourcentage d’au moins 100, montant au-delà du HT', () => {
    expect(controlerRabais(null, 1000, null, [1])).toBeNull();
    expect(controlerRabais(POURCENT, 1000, null, [1])).toBeNull();
    expect(controlerRabais({ ...POURCENT, valeur: 0 }, 1000, null, [1])?.code).toBe('RABAIS_INVALIDE');
    expect(controlerRabais({ ...POURCENT, valeur: 100 }, 1000, null, [1])?.code).toBe('RABAIS_INVALIDE');
    expect(controlerRabais({ ...POURCENT, nature: 'MONTANT', valeur: 1500 }, 1000, null, [1])?.code).toBe('RABAIS_INVALIDE');
    expect(controlerRabais({ ...POURCENT, nature: 'MONTANT', valeur: 900 }, 1000, null, [1])).toBeNull();
  });

  it('RABAIS_LOTS : au moins deux lots, dont celui de l’offre, tous connus de la procédure', () => {
    const lie = { ...POURCENT, condition: 'LOTS' as const };
    expect(controlerRabais({ ...lie, lots: [1] }, 1000, 1, [1, 2, 3])?.code).toBe('RABAIS_LOTS');
    expect(controlerRabais({ ...lie, lots: [2, 3] }, 1000, 1, [1, 2, 3])?.message).toContain('lot 1');
    expect(controlerRabais({ ...lie, lots: [1, 4] }, 1000, 1, [1, 2, 3])?.message).toContain('4');
    expect(controlerRabais({ ...lie, lots: [1, 2] }, 1000, 1, [1, 2, 3])).toBeNull();
    // Procédure non allotie : le lot de l'offre est le lot 1, et la fiche n'en a qu'un.
    expect(controlerRabais({ ...lie, lots: [1, 2] }, 1000, null, [1])?.code).toBe('RABAIS_LOTS');
  });

  it('la phrase lue, comme en séance', () => {
    expect(phraseRabais(POURCENT)).toBe('2 % du montant hors taxes');
    // Intl sépare les milliers par une espace insécable fine : on compare en espaces simples.
    expect(phraseRabais({ ...POURCENT, nature: 'MONTANT', valeur: 100000, condition: 'LOTS', lots: [2, 1] }).replace(/\s/g, ' ')).toBe('100 000 Ariary hors taxes, si les lots 1, 2 sont attribués au candidat');
  });
});

describe('Rabais structuré — la saisie au dépôt', () => {
  let fixture: ComponentFixture<RabaisOffreSaisie>;
  let emis: (RabaisOffre | null)[];
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function monter(rabais: RabaisOffre | null, lots: number[]): void {
    fixture = TestBed.createComponent(RabaisOffreSaisie);
    emis = [];
    fixture.componentInstance.modifie.subscribe((r) => emis.push(r));
    fixture.componentRef.setInput('rabais', rabais);
    fixture.componentRef.setInput('lots', lots);
    fixture.componentRef.setInput('lotOffre', 1);
    fixture.componentRef.setInput('montantHt', 1000000);
    fixture.detectChanges();
  }

  it('choisir un pourcentage émet un rabais inconditionnel ; « Aucun rabais » émet nul', () => {
    monter(null, [1, 2]);
    (racine().querySelectorAll('input[name=ro-nature]')[1] as HTMLInputElement).dispatchEvent(new Event('change'));
    expect(emis.at(-1)).toEqual({ nature: 'POURCENTAGE', valeur: 0, condition: 'AUCUNE', lots: null, libelle: null });
    (racine().querySelectorAll('input[name=ro-nature]')[0] as HTMLInputElement).dispatchEvent(new Event('change'));
    expect(emis.at(-1)).toBeNull();
  });

  it('lié à plusieurs lots : les cases des lots, et le contrôle affiché sous le champ', () => {
    monter({ ...POURCENT, condition: 'LOTS', lots: [1] }, [1, 2, 3]);
    expect(racine().querySelectorAll('.ro__lots input[type=checkbox]').length).toBe(3);
    expect(racine().querySelector('.form-error')?.textContent).toContain('au moins deux');
    (racine().querySelectorAll('.ro__lots input[type=checkbox]')[2] as HTMLInputElement).click();
    expect(emis.at(-1)?.lots).toEqual([1, 3]);
  });

  it('marché non alloti : pas de condition de lots', () => {
    monter(POURCENT, [1]);
    expect(racine().querySelector('input[name=ro-cond]')).toBeNull();
  });
});
