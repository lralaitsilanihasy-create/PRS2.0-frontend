import { afterEach, describe, expect, it } from 'vitest';

import { BrouillonOffre, brouillonVide, cleBrouillon, ecrireBrouillon, effacerBrouillon, lireBrouillon } from './brouillon-offre';
import { saisieVide } from './offre-financiere';
import { saisieTravauxVide } from './offre-travaux';

function brouillon(p: Partial<BrouillonOffre> = {}): BrouillonOffre {
  return {
    v: 1,
    enregistreLe: '2026-10-06T08:00:00.000Z',
    dateLimite: '2099-01-01T10:00',
    lot: null,
    enGroupement: false,
    groupement: [],
    ae: { monnaie: 'MGA', delaiUnite: 'JOURS', rabais: null },
    garantie: { code: '', montant: null, emetteur: '' },
    saisieOffre: saisieVide(),
    saisieTravaux: saisieTravauxVide(),
    ...p,
  };
}

describe('Brouillon local de l’offre (lot 5, H4)', () => {
  afterEach(() => localStorage.clear());

  it('la clé porte le compte et la procédure : un autre compte ne lit pas le brouillon', () => {
    const a = cleBrouillon('Candidat.Demo@exemple.mg', 44);
    expect(a).toBe('prs.brouillon-offre:candidat.demo@exemple.mg:44');
    ecrireBrouillon(a, brouillon({ saisieOffre: { ...saisieVide(), prix: { 1: 2450000 } } }));
    expect(lireBrouillon(a)?.saisieOffre.prix[1]).toBe(2450000);
    expect(lireBrouillon(cleBrouillon('autre@exemple.mg', 44))).toBeNull();
    expect(lireBrouillon(cleBrouillon('candidat.demo@exemple.mg', 45))).toBeNull();
  });

  it('expiré à la date limite, illisible ou d’un autre format : jeté', () => {
    const cle = cleBrouillon('c@x.mg', 1);
    ecrireBrouillon(cle, brouillon({ dateLimite: '2026-10-05T10:00' }));
    expect(lireBrouillon(cle, new Date('2026-10-06T00:00:00').getTime())).toBeNull();
    expect(localStorage.getItem(cle)).toBeNull();
    localStorage.setItem(cle, '{pas du json');
    expect(lireBrouillon(cle)).toBeNull();
    localStorage.setItem(cle, JSON.stringify({ v: 2 }));
    expect(lireBrouillon(cle)).toBeNull();
  });

  it('vide tant que rien n’est saisi ; effacé à la demande', () => {
    expect(brouillonVide(brouillon())).toBe(true);
    expect(brouillonVide(brouillon({ ae: { delai: 30 } }))).toBe(false);
    expect(brouillonVide(brouillon({ saisieTravaux: { ...saisieTravauxVide(), k1: { a1: 5 } } }))).toBe(false);
    const cle = cleBrouillon('c@x.mg', 2);
    ecrireBrouillon(cle, brouillon());
    effacerBrouillon(cle);
    expect(lireBrouillon(cle)).toBeNull();
  });
});
