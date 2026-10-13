import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DonneesFigees, formeDe, libelleCle, texteSimple } from './donnees-figees';

describe('Rendu générique d’un JSON figé (manuel révisé, R4)', () => {
  describe('règles pures', () => {
    it('libelleCle : les clés connues en clair, les autres dépliées depuis le camelCase', () => {
      expect(libelleCle('idDmc')).toBe('Procédure n°');
      expect(libelleCle('montantTtc')).toBe('Montant (TTC)');
      expect(libelleCle('montEstim')).toBe('Montant estimé');
      expect(libelleCle('secoursGenerePar')).toBe('Secours genere par');
      expect(libelleCle('partsRecues')).toBe('Parts recues');
    });

    it('texteSimple : dates ISO, montants, booléens, vides', () => {
      expect(texteSimple('2026-10-13T09:05:00')).toBe('13/10/2026 à 09:05');
      expect(texteSimple('2026-10-13')).toBe('13/10/2026');
      expect(texteSimple(1700000, 'montant')).toBe(`${new Intl.NumberFormat('fr-FR').format(1700000)} Ar`);
      expect(texteSimple(16000000000, 'montEstim')).toBe(`${new Intl.NumberFormat('fr-FR').format(16000000000)} Ar`);
      expect(texteSimple(2026, 'exercice')).toBe('2026');
      expect(texteSimple(303120, 'idDetail')).toBe('303120');
      expect(texteSimple(true)).toBe('oui');
      expect(texteSimple(null)).toBe('—');
      expect(texteSimple('')).toBe('—');
    });

    it('formeDe : une liste d’objets devient un tableau dont les colonnes sont l’union des clés, dans l’ordre d’apparition', () => {
      const forme = formeDe([{ nom: 'A', present: true }, { nom: 'B', motif: 'x' }]);
      expect(forme.type).toBe('table');
      if (forme.type === 'table') expect(forme.colonnes.map((c) => c.cle)).toEqual(['nom', 'present', 'motif']);
    });

    it('formeDe : un objet sépare ses champs simples (et listes vides) de ses champs composés ; vide → « vide »', () => {
      const forme = formeDe({ etat: 'CLOSE', lots: [], membres: [{ nom: 'A' }], pv: { produit: true } });
      expect(forme.type).toBe('objet');
      if (forme.type === 'objet') {
        expect(forme.simples.map((c) => c.cle)).toEqual(['etat', 'lots']);
        expect(forme.composes.map((c) => c.cle)).toEqual(['membres', 'pv']);
      }
      expect(formeDe({}).type).toBe('vide');
      expect(formeDe([]).type).toBe('vide');
      expect(formeDe(['a', 'b'])).toEqual({ type: 'liste', elements: ['a', 'b'] });
    });
  });

  describe('composant', () => {
    let fixture: ComponentFixture<DonneesFigees>;
    const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
    /** Les nœuds de texte joints par un espace : deux cellules voisines restent deux mots. */
    const texte = (): string => {
      const marche = document.createTreeWalker(racine(), NodeFilter.SHOW_TEXT);
      const morceaux: string[] = [];
      while (marche.nextNode()) morceaux.push(marche.currentNode.textContent ?? '');
      return morceaux.join(' ').replace(/\s+/g, ' ').trim();
    };

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [DonneesFigees] });
      fixture = TestBed.createComponent(DonneesFigees);
    });

    it('rend un DTO en « libellé : valeur », ses listes d’objets en tableaux, récursivement', () => {
      fixture.componentRef.setInput('valeur', {
        idDmc: 40,
        etat: 'CLOSE',
        dechiffreeLe: '2026-10-13T10:30:00',
        membres: [
          { nom: 'Membre un', president: true, present: true },
          { nom: 'Membre deux', president: false, present: false },
        ],
        pv: { produit: true, signatures: [{ nom: 'Membre un', date: '2026-10-13T11:00:00' }] },
      });
      fixture.detectChanges();
      const t = texte();
      expect(t).toContain('Procédure n° 40');
      expect(t).toContain('État CLOSE');
      expect(t).toContain('Déchiffrée le 13/10/2026 à 10:30');
      expect(racine().querySelectorAll('h4').length).toBe(2);
      const tables = racine().querySelectorAll('table');
      expect(tables.length).toBe(2);
      expect(Array.from(tables[0].querySelectorAll('th')).map((th) => th.textContent?.trim())).toEqual(['Nom', 'Président', 'Présent']);
      expect(tables[0].querySelectorAll('tbody tr').length).toBe(2);
      expect(t).toContain('Membre un oui oui');
      expect(t).toContain('Signatures');
      expect(t).toContain('13/10/2026 à 11:00');
    });

    it('rend « — » pour un vide, et une liste simple jointe par des virgules', () => {
      fixture.componentRef.setInput('valeur', null);
      fixture.detectChanges();
      expect(texte()).toBe('—');
      fixture.componentRef.setInput('valeur', ['FAV', 'FAVR']);
      fixture.detectChanges();
      expect(texte()).toBe('FAV, FAVR');
    });
  });
});
