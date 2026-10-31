import { deplacerDansLaListe, focaliserRecherche, raccourciDe } from './raccourcis-clavier';

/** Raccourcis clavier (Espace de travail, lot 5, 31/10). */
describe('raccourcis clavier', () => {
  afterEach(() => (document.body.innerHTML = ''));

  function frappe(key: string, cible: EventTarget = document.body, opts: KeyboardEventInit = {}): KeyboardEvent {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, ...opts });
    Object.defineProperty(e, 'target', { value: cible });
    return e;
  }

  it('reconnaît J, K, / et ?', () => {
    expect(raccourciDe(frappe('j'), document)).toBe('suivant');
    expect(raccourciDe(frappe('K'), document)).toBe('precedent');
    expect(raccourciDe(frappe('/'), document)).toBe('recherche');
    expect(raccourciDe(frappe('?', document.body, { shiftKey: true }), document)).toBe('aide');
    expect(raccourciDe(frappe('x'), document)).toBeNull();
  });

  it('se tait pendant une saisie, avec Ctrl et quand une modale est ouverte', () => {
    const champ = document.createElement('input');
    expect(raccourciDe(frappe('j', champ), document)).toBeNull();
    expect(raccourciDe(frappe('j', document.body, { ctrlKey: true }), document)).toBeNull();
    document.body.innerHTML = '<div class="modal-backdrop"></div>';
    expect(raccourciDe(frappe('j'), document)).toBeNull();
  });

  it('J et K choisissent la ligne suivante / précédente de la liste en deux volets', () => {
    document.body.innerHTML = `
      <app-deux-volets><section class="dv__liste">
        <button aria-pressed="true">A</button><button aria-pressed="false">B</button><button aria-pressed="false">C</button>
      </section></app-deux-volets>`;
    const [a, b] = Array.from(document.querySelectorAll('button'));
    const clics: string[] = [];
    document.querySelectorAll('button').forEach((x) => x.addEventListener('click', () => clics.push(x.textContent ?? '')));
    expect(deplacerDansLaListe(document, 1)).toBe(true);
    expect(clics).toEqual(['B']);
    expect(document.activeElement).toBe(b);
    // Depuis B (focus), K revient sur A — déjà choisi : pas de clic, seulement le focus.
    a.setAttribute('aria-pressed', 'true');
    deplacerDansLaListe(document, -1);
    expect(document.activeElement).toBe(a);
    expect(clics).toEqual(['B']);
  });

  it('sans liste ni recherche, rien ne se passe', () => {
    expect(deplacerDansLaListe(document, 1)).toBe(false);
    expect(focaliserRecherche(document)).toBe(false);
    document.body.innerHTML = '<main><input type="search" aria-label="Rechercher"></main>';
    expect(focaliserRecherche(document)).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('input'));
  });
});
