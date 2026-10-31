import { etiqueterTableau, intitulesColonnes } from './tableaux-en-fiches';

const tableau = (html: string): HTMLTableElement => {
  const conteneur = document.createElement('div');
  conteneur.innerHTML = html;
  return conteneur.querySelector('table') as HTMLTableElement;
};

describe('Tableaux en fiches sur téléphone (Espace de travail, lot 2)', () => {
  it('un tableau simple : chaque cellule reçoit l’intitulé de sa colonne, le tableau est marqué', () => {
    const t = tableau(`<table><thead><tr><th>Référence</th><th> Date
      de dépôt </th><th></th></tr></thead>
      <tbody><tr><td>00010/MAOO/CNM/2026</td><td>24/08/2026</td><td><button>Ouvrir</button></td></tr></tbody></table>`);
    expect(etiqueterTableau(t)).toBe(true);
    expect(t.hasAttribute('data-fiches')).toBe(true);
    expect(Array.from(t.tBodies[0].rows[0].cells).map((c) => c.getAttribute('data-label'))).toEqual(['Référence', 'Date de dépôt', '']);
  });

  it('une ligne qui fusionne ses cellules (« Aucun élément ») reste une ligne pleine', () => {
    const t = tableau(`<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td colspan="2">Aucun élément</td></tr></tbody></table>`);
    etiqueterTableau(t);
    const ligne = t.tBodies[0].rows[0];
    expect(ligne.hasAttribute('data-ligne-pleine')).toBe(true);
    expect(ligne.cells[0].hasAttribute('data-label')).toBe(false);
  });

  it('les tableaux complexes ou exclus gardent leur défilement : en-tête sur deux lignes, cellules fusionnées, documents officiels', () => {
    expect(intitulesColonnes(tableau(`<table><thead><tr><th colspan="2">Groupe</th></tr><tr><th>A</th><th>B</th></tr></thead></table>`))).toBeNull();
    expect(intitulesColonnes(tableau(`<table><thead><tr><th colspan="2">Groupe</th></tr></thead></table>`))).toBeNull();
    expect(intitulesColonnes(tableau(`<table class="doc-table"><thead><tr><th>A</th></tr></thead></table>`))).toBeNull();
    expect(intitulesColonnes(tableau(`<table class="ppm-table"><thead><tr><th>A</th></tr></thead></table>`))).toBeNull();
    expect(intitulesColonnes(tableau(`<table data-sans-fiches><thead><tr><th>A</th></tr></thead></table>`))).toBeNull();
    expect(intitulesColonnes(tableau(`<table><tbody><tr><td>sans en-tête</td></tr></tbody></table>`))).toBeNull();
    const t = tableau(`<table class="doc-table"><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>`);
    expect(etiqueterTableau(t)).toBe(false);
    expect(t.hasAttribute('data-fiches')).toBe(false);
  });
});
