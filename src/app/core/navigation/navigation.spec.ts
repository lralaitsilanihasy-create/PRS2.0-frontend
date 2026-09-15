import { Role } from '../../models';
import { NOMS_ICONES } from '../../shared/ui/icone';
import { NAV_BY_ROLE, NavItem, cheminAFaire, navFor, separerParDelegation } from './navigation';

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
    // ⚠️ 2026-09-12 — « Réception & Enregistrement » (délégation Secrétaire) a quitté le menu délégué :
    // son unique action « Numéroter » est inline dans « Tous les dossiers » (comme l'examen du Membre).
    // Restent les deux délégations sans équivalent inline complet : Vérifications et Archivage des PV.
    const [propres, delegues] = separerParDelegation(navFor('PRESIDENT'));
    expect(delegues.items.map((i) => i.label)).toEqual(['Vérifications', 'Archivage des PV']);
    expect(propres.items.map((i) => i.label)).not.toContain('Vérifications');
    // « Rapports »/« Statistiques »/« Messagerie » sont retirés du menu pour le moment (2026-09-04).
    expect(propres.items.map((i) => i.label)).toContain('Chaînes de contrôle');
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

describe('Entrée « À faire » (refonte ergonomique, 2026-09-15)', () => {
  it('ouvre le menu des huit profils du circuit, dans leur espace', () => {
    const attendus: [Role, string][] = [
      ['PRESIDENT', '/president/a-faire'],
      ['CHEF_COMMISSION', '/cc/a-faire'],
      ['SECRETAIRE', '/secretaire/a-faire'],
      ['MEMBRE', '/membre/a-faire'],
      ['VERIFICATEUR', '/verificateur/a-faire'],
      ['ASSISTANT_CONTROLEUR', '/assistant/a-faire'],
      ['PRMP', '/prmp/a-faire'],
      ['UGPM', '/prmp/a-faire'],
    ];
    for (const [role, chemin] of attendus) {
      expect(navFor(role)[0]).toMatchObject({ label: 'À faire', path: chemin });
      expect(cheminAFaire(role)).toBe(chemin);
    }
  });

  it("absente des profils qui gardent leur accueil (Administrateur, Chargé de publication)", () => {
    for (const role of ['ADMINISTRATEUR', 'CHARGE_PUBLICATION'] as const) {
      expect(navFor(role).map((i) => i.label)).not.toContain('À faire');
      expect(cheminAFaire(role)).toBeNull();
    }
    expect(cheminAFaire(null)).toBeNull();
  });
});

describe('Icônes du menu (refonte ergonomique, lot 5 — 2026-09-15)', () => {
  const toutes = (items: NavItem[]): NavItem[] => items.flatMap((i) => [i, ...toutes(i.children ?? [])]);
  const EMOJI = /\p{Extended_Pictographic}/u;

  it('chaque entrée de chaque profil porte une icône SVG existante, jamais un emoji', () => {
    const entrees = Object.values(NAV_BY_ROLE).flatMap(toutes);
    expect(entrees.length).toBeGreaterThan(40);
    const fautives = entrees.filter((i) => !i.icon || !NOMS_ICONES.includes(i.icon) || EMOJI.test(i.icon) || EMOJI.test(i.label)).map((i) => `${i.label} : ${i.icon}`);
    expect(fautives).toEqual([]);
  });

  it('même geste, même icône d’un profil à l’autre', () => {
    const icone = (role: Role, label: string) => navFor(role).find((i) => i.label === label)?.icon;
    for (const role of ['PRESIDENT', 'CHEF_COMMISSION', 'SECRETAIRE', 'MEMBRE', 'VERIFICATEUR', 'ASSISTANT_CONTROLEUR', 'PRMP', 'UGPM'] as const) {
      expect(icone(role, 'À faire')).toBe('inbox');
    }
    for (const role of Object.keys(NAV_BY_ROLE) as Role[]) expect(icone(role, 'Notifications')).toBe('bell');
  });
});
