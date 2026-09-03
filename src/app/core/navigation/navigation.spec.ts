import { NavItem, navFor, separerParDelegation } from './navigation';

/**
 * ⚠️ Demande user (2026-08-28) : « séparer tous les menus de délégation de profil, à ne pas
 * mélanger avec les menus propres au profil ». Ces tests portent sur les MENUS RÉELS, pas sur des
 * décors : ajouter demain une entrée déléguée au milieu de `menuCommission` ne doit pas la faire
 * réapparaître parmi les entrées propres.
 */
describe('separerParDelegation', () => {
  it('sort les entrées propres AVANT les entrées déléguées, sans en perdre aucune', () => {
    const menu = navFor('PRESIDENT');
    const sections = separerParDelegation(menu);

    expect(sections.map((s) => s.cle)).toEqual(['propre', 'delegation']);
    expect(sections[0].titre).toBeNull();
    expect(sections[1].titre).toBe('Exercé par délégation');
    // Aucune entrée n'est perdue ni dupliquée par le partage.
    expect(sections.flatMap((s) => s.items).length).toBe(menu.length);
  });

  it('AUCUN MÉLANGE : chaque section ne contient que ce qui lui revient', () => {
    for (const role of ['PRESIDENT', 'CHEF_COMMISSION'] as const) {
      const [propres, delegues] = separerParDelegation(navFor(role));
      expect(propres.items.every((i) => !i.delegation)).toBe(true);
      expect(delegues.items.every((i) => !!i.delegation)).toBe(true);
    }
  });

  it('menu du Président : les entrées déléguées passent en section déléguée', () => {
    // « Vérifications »/« Archivage » étaient déclarées entre « Examen de dossiers » et « Rapports » ;
    // « Dossiers à examiner » (files du Membre, 2026-09-03) les rejoint.
    const [propres, delegues] = separerParDelegation(navFor('PRESIDENT'));
    expect(delegues.items.map((i) => i.label)).toEqual(['Dossiers à examiner', 'Vérifications', 'Archivage des PV']);
    expect(propres.items.map((i) => i.label)).not.toContain('Vérifications');
    expect(propres.items.map((i) => i.label)).toContain('Rapports');
  });

  it('l’ORDRE des entrées propres est préservé (le menu du profil ne se réorganise pas)', () => {
    const menu = navFor('PRESIDENT');
    const [propres] = separerParDelegation(menu);
    expect(propres.items.map((i) => i.label)).toEqual(
      menu.filter((i) => !i.delegation).map((i) => i.label),
    );
  });

  it('un profil SANS délégation ne gagne pas de section vide', () => {
    for (const role of ['MEMBRE', 'SECRETAIRE', 'PRMP', 'ADMINISTRATEUR'] as const) {
      const sections = separerParDelegation(navFor(role));
      expect(sections.length).toBe(1);
      expect(sections[0].cle).toBe('propre');
      expect(sections[0].titre).toBeNull();
    }
  });

  it('un menu entièrement délégué ne produit qu’une section, la déléguée', () => {
    const items: NavItem[] = [{ label: 'A', path: '/a', delegation: 'MEMBRE' }];
    const sections = separerParDelegation(items);
    expect(sections.length).toBe(1);
    expect(sections[0].cle).toBe('delegation');
  });

  it('un menu vide ne produit aucune section', () => {
    expect(separerParDelegation([])).toEqual([]);
  });
});
