import { Role, RoleInterne } from '../../models';
import {
  GROUPES_PAR_CHEMIN,
  ORDRE_GROUPES,
  groupeExplicite,
  piedMenu,
  sectionsMenu,
  suffixeChemin,
} from './groupes-menu';
import { NAV_BY_ROLE, NavItem, navFor } from './navigation';

/**
 * Regroupement du menu (refonte ergonomique, lot 5 — F1).
 *
 * Ces tests portent sur les MENUS RÉELS de `NAV_BY_ROLE`, jamais sur des décors : c'est la seule
 * façon de voir venir un ajout du pilote. `navigation.ts` n'est pas modifié par le lot ; la dérive
 * se rattrape ICI, en une ligne de table.
 */

const ROLES = Object.keys(NAV_BY_ROLE) as RoleInterne[];

describe('suffixeChemin', () => {
  it('retire le segment d’espace, et laisse intact un chemin transverse', () => {
    expect(suffixeChemin('/president/retraits')).toBe('retraits');
    expect(suffixeChemin('/cc/retraits')).toBe('retraits');
    expect(suffixeChemin('/prmp/dossiers-verifies')).toBe('dossiers-verifies');
    // Chemin d'un seul segment : pas d'espace à retirer, il vaut sa propre clé.
    expect(suffixeChemin('/notifications')).toBe('/notifications');
    // Chemin profond : tout ce qui suit l'espace fait la clé.
    expect(suffixeChemin('/admin/comptes/controleurs')).toBe('comptes/controleurs');
  });
});

describe('Garde-fou de DÉRIVE — toute entrée de menu a sa rubrique', () => {
  /**
   * ⚠️ Décision Mathieu du 2026-09-16 : ce test est ROUGE, pas tolérant. Une entrée mal classée est
   * invisible à l'œil (elle s'affiche quand même, dans la première rubrique) et survivrait des
   * semaines ; un test rouge se corrige en trente secondes — le message donne la ligne à écrire.
   */
  it('aucune entrée des dix menus ne reste sans rubrique', () => {
    const sansGroupe: string[] = [];
    for (const role of ROLES) {
      for (const item of NAV_BY_ROLE[role]) {
        if (!groupeExplicite(item)) {
          sansGroupe.push(
            `« ${item.path} » (${role} — « ${item.label} ») n'a pas de rubrique : ajouter la ligne ` +
              `\`'${suffixeChemin(item.path)}': { groupe: 'travail', court: '${item.label.split(' ')[0]}' },\` ` +
              `à GROUPES_PAR_CHEMIN (core/navigation/groupes-menu.ts) — en choisissant la bonne rubrique.`,
          );
        }
      }
    }
    expect(sansGroupe).toEqual([]);
  });

  it('le message de dérive nomme le chemin, la rubrique à écrire et le fichier à compléter', () => {
    // Simulation d'un ajout du pilote dans `navigation.ts` : l'entrée n'est dans aucune table.
    const nouvelle: NavItem = { label: 'Nouvelle entrée', path: '/admin/nouvelle-entree', icon: 'board' };
    expect(groupeExplicite(nouvelle)).toBeNull();

    const message =
      `« ${nouvelle.path} » n'a pas de rubrique : ajouter la ligne ` +
      `\`'${suffixeChemin(nouvelle.path)}': { groupe: 'travail', court: 'Nouvelle' },\` ` +
      `à GROUPES_PAR_CHEMIN (core/navigation/groupes-menu.ts).`;
    expect(message).toContain('/admin/nouvelle-entree');
    expect(message).toContain("'nouvelle-entree':");
    expect(message).toContain('GROUPES_PAR_CHEMIN');
    expect(message).toContain('core/navigation/groupes-menu.ts');
  });

  it('une entrée non classée reste AFFICHÉE : elle rejoint la première rubrique, rien n’est perdu', () => {
    const menu: NavItem[] = [
      ...navFor('PRESIDENT'),
      { label: 'Nouvelle entrée', path: '/president/nouvelle-entree', icon: 'board' },
    ];
    const sections = sectionsMenu(menu);
    const rendues = sections.flatMap((s) => s.items.map((i) => i.path));
    expect(rendues).toContain('/president/nouvelle-entree');
    expect(sections[0].cle).toBe('travail');
    expect(sections[0].items.map((i) => i.path)).toContain('/president/nouvelle-entree');
  });
});

describe('GROUPES_PAR_CHEMIN — la table elle-même', () => {
  it('ne déclare que des rubriques connues', () => {
    const connues = new Set<string>([...ORDRE_GROUPES, 'pied']);
    for (const [cle, valeur] of Object.entries(GROUPES_PAR_CHEMIN)) {
      expect(connues.has(valeur.groupe), `${cle} → ${valeur.groupe}`).toBe(true);
    }
  });

  it('« Notifications » est dans le pied des DIX menus ; Messagerie la rejoint chez le Président et le CC (31/10)', () => {
    for (const role of ROLES) {
      const pied = piedMenu(NAV_BY_ROLE[role]);
      const attendu = role === 'PRESIDENT' || role === 'CHEF_COMMISSION' ? ['Messagerie', 'Notifications'] : ['Notifications'];
      expect(pied.map((i) => i.label), role).toEqual(attendu);
    }
  });
});

describe('sectionsMenu — dérivation des rubriques', () => {
  it('« Notifications » quitte les rubriques : elle n’apparaît qu’une fois, dans le pied', () => {
    for (const role of ROLES) {
      const menu = NAV_BY_ROLE[role];
      const dansSections = sectionsMenu(menu).flatMap((s) => s.items.map((i) => i.path));
      expect(dansSections.filter((p) => p === '/notifications'), role).toEqual([]);
      expect(piedMenu(menu).filter((i) => i.path === '/notifications').length, role).toBe(1);
    }
  });

  it('aucune entrée n’est perdue ni dupliquée : sections + pied = le menu', () => {
    for (const role of ROLES) {
      const menu = NAV_BY_ROLE[role];
      const rendues = [
        ...sectionsMenu(menu).flatMap((s) => s.items),
        ...piedMenu(menu),
      ].map((i) => i.path);
      expect(rendues.length, role).toBe(menu.length);
      expect([...rendues].sort(), role).toEqual(menu.map((i) => i.path).sort());
    }
  });

  it('aucune section vide n’est rendue, et l’ordre des entrées d’une rubrique suit la déclaration', () => {
    for (const role of ROLES) {
      const menu = NAV_BY_ROLE[role];
      for (const section of sectionsMenu(menu)) {
        expect(section.items.length, `${role} / ${section.cle}`).toBeGreaterThan(0);
        const ordreDeclare = menu.filter((i) => section.items.includes(i)).map((i) => i.path);
        expect(section.items.map((i) => i.path), `${role} / ${section.cle}`).toEqual(ordreDeclare);
      }
    }
  });

  it('les rubriques sortent dans l’ordre de ORDRE_GROUPES', () => {
    for (const role of ROLES) {
      const cles = sectionsMenu(NAV_BY_ROLE[role]).map((s) => s.cle);
      const rangs = cles.map((c) => ORDRE_GROUPES.indexOf(c as (typeof ORDRE_GROUPES)[number]));
      expect(rangs, role).toEqual([...rangs].sort((a, b) => a - b));
      expect(rangs.every((r) => r >= 0), role).toBe(true);
    }
  });

  it('Vérificateur et Chargé de publication : UNE section « Mon travail » ; Secrétaire : Mon travail · Dossiers (31/10)', () => {
    for (const role of ['VERIFICATEUR', 'CHARGE_PUBLICATION'] as const) {
      const sections = sectionsMenu(NAV_BY_ROLE[role]);
      expect(sections.length, role).toBe(1);
      expect(sections[0].titre, role).toBe('Mon travail');
      expect(sections[0].repliable, role).toBe(false);
      expect(sections[0].items.map((i) => i.label), role).toEqual(
        NAV_BY_ROLE[role].filter((i) => i.label !== 'Notifications').map((i) => i.label),
      );
    }
    const secretaire = sectionsMenu(navFor('SECRETAIRE'));
    expect(secretaire.map((s) => s.titre)).toEqual(['Mon travail', 'Dossiers']);
    expect(secretaire[1].items.map((i) => i.label)).toEqual(['Dossiers']);
  });

  it('UGPM : Mon travail · Dossiers · Passation · Exécution — les rubriques de la PRMP, sans Décisions ni Calendrier (31/10)', () => {
    const sections = sectionsMenu(navFor('UGPM'));
    expect(sections.map((s) => s.titre)).toEqual(['Mon travail', 'Dossiers', 'Passation', 'Exécution']);
    expect(sections[1].items.map((i) => i.label)).toEqual(['Tous mes dossiers', 'Créer un dossier', 'Mes brouillons']);
    expect(sections[2].items.map((i) => i.label)).toEqual(['Appels d’offres', 'Reçus des frais de dossier']);
    expect(sections[3].items.map((i) => i.label)).toEqual(['Contrats en vigueur']);
  });

  it('PRMP : les rubriques suivent le cycle du marché — Dossiers · Passation · Exécution · Décisions · Planification (31/10)', () => {
    const sections = sectionsMenu(navFor('PRMP'));
    expect(sections.map((s) => s.titre)).toEqual(['Mon travail', 'Dossiers', 'Passation', 'Exécution', 'Décisions', 'Planification']);
    expect(sections[0].items.map((i) => i.label)).toEqual(['À faire']);
    expect(sections[1].items.map((i) => i.label)).toEqual(['Tous mes dossiers', 'Créer un dossier', 'Mettre à jour un PPM']);
    expect(sections[2].items.map((i) => i.label)).toEqual(['Appels d’offres', 'Reçus des frais de dossier']);
    expect(sections[3].items.map((i) => i.label)).toEqual(['Contrats en vigueur']);
    expect(sections[4].items.map((i) => i.label)).toEqual(['PV et lettres de renvoi', 'Demandes de retrait']);
    expect(sections[5].items.map((i) => i.label)).toEqual(['Calendrier']);
  });

  it('Membre : Mon travail · Dossiers · Décisions', () => {
    const sections = sectionsMenu(navFor('MEMBRE'));
    expect(sections.map((s) => s.titre)).toEqual(['Mon travail', 'Dossiers', 'Décisions']);
    expect(sections[1].items.map((i) => i.label)).toEqual(['Dossiers']);
    expect(sections[2].items.map((i) => i.label)).toEqual(['PV et lettres de renvoi']);
  });

  it('Assistant contrôleur : Mon travail · Dossiers · Reçus (les PV d’abord, 31/10)', () => {
    const sections = sectionsMenu(navFor('ASSISTANT_CONTROLEUR'));
    expect(sections.map((s) => s.titre)).toEqual(['Mon travail', 'Dossiers', 'Reçus']);
    expect(sections[2].items.map((i) => i.label)).toEqual(['PV reçus', 'Lettres de renvoi reçues']);
  });

  /**
   * ⚠️ Lot 6 F1 (2026-09-17) — classement REFAIT pour l'Administrateur (plan L6, §3). Ce test dit
   * le menu cible en toutes lettres : c'est lui qui rattrapera une entrée rangée au hasard.
   */
  it('Administrateur : son accueil SANS intitulé, puis Accès · Règles du contrôle · Référentiels · Traces', () => {
    const sections = sectionsMenu(navFor('ADMINISTRATEUR'));
    expect(sections.map((s) => s.titre)).toEqual([null, 'Accès', 'Règles du contrôle', 'Référentiels', 'Traces']);
    expect(sections[0].items.map((i) => i.label)).toEqual(['Poste d’administration']);
    // ⚠️ 31/10 (pilote) — Accès en deux colonnes ; mandats, intérims, rattachements et entreprises remontés au menu.
    expect(sections[1].items.map((i) => [i.colonne, i.label])).toEqual([
      ['Demandes', 'Demandes d’accès'],
      ['Demandes', 'Rattachements PRMP ⇄ entité'],
      ['Comptes', 'Comptes & personnes'],
      ['Comptes', 'Mandats PRMP'],
      ['Comptes', 'Intérims'],
      ['Comptes', 'Entreprises candidates'],
    ]);
    // Les points de contrôle d'abord : le réglage le plus consulté.
    expect(sections[2].items.map((i) => i.label)).toEqual([
      'Points de contrôle',
      'Chaînes de contrôle',
      'Délais standards',
      'Règles d’alerte',
      'Seuil AGPM (AMI)',
    ]);
    // Référentiels : cinq colonnes, dans cet ordre (naguère le carrefour « Nomenclatures »).
    expect([...new Set(sections[3].items.map((i) => i.colonne))]).toEqual([
      'Organisation',
      'Budget',
      'Dossiers et marchés',
      'Documents',
      'Passation en ligne',
    ]);
    // ⚠️ Lot 6 F5 — l'écran porte les écritures ET les connexions ; ⚠️ 31/10 le libellé le dit.
    expect(sections[4].items.map((i) => i.label)).toEqual(['Journal (écritures et connexions)', 'Actualités']);
  });

  it('Administrateur : chaque référentiel du carrefour « Nomenclatures » a son entrée dans le menu en colonnes (31/10)', () => {
    const referentiels = navFor('ADMINISTRATEUR').filter((i) => i.colonne && i.path.startsWith('/admin/referentiels/'));
    // 20 nomenclatures génériques (points de contrôle et règles d'alerte sont dans « Règles du contrôle ») + 10 écrans dédiés.
    expect(referentiels.length).toBe(30);
    expect(new Set(referentiels.map((i) => i.path)).size).toBe(30);
  });

  it('les écrans retirés du menu de l’Administrateur n’y reviennent pas par accident', () => {
    const chemins = navFor('ADMINISTRATEUR').map((i) => i.path);
    // Écrans PRMP réutilisés, de la consultation (décision Mathieu 2026-09-17) — routes conservées.
    expect(chemins).not.toContain('/admin/ppm-marches');
    expect(chemins).not.toContain('/admin/marches-previsions');
    // Journal des connexions : c'est un ONGLET du Journal depuis le lot F5, et la route
    // `/admin/sessions` a été retirée avec lui — le serveur ne sert plus `/api/session-utilisateurs`.
    expect(chemins).not.toContain('/admin/sessions');
  });

  it('« Points de contrôle » et « Règles d’alerte » pointent bien sur leurs écrans de référentiel', () => {
    const chemin = (label: string) => navFor('ADMINISTRATEUR').find((i) => i.label === label)?.path;
    expect(chemin('Points de contrôle')).toBe('/admin/referentiels/points-ctrls');
    expect(chemin('Règles d’alerte')).toBe('/admin/referentiels/regle-alertes');
    // Le SUFFIXE complet est la clé : le sommaire `referentiels` ne doit pas les happer.
    const rubrique = (path: string) =>
      sectionsMenu(navFor('ADMINISTRATEUR')).find((s) => s.items.some((i) => i.path === path))?.cle;
    expect(rubrique('/admin/referentiels/points-ctrls')).toBe('regles');
    expect(rubrique('/admin/referentiels/regle-alertes')).toBe('regles');
    // ⚠️ 31/10 — le carrefour `/admin/referentiels` n'est plus au menu (route conservée) ; ses écrans le sont, un par un.
    expect(rubrique('/admin/referentiels/ministeres')).toBe('referentiels');
  });

  it('Président et CC : Mon travail · Dossiers · Décisions · Pilotage · Exercé par délégation', () => {
    for (const role of ['PRESIDENT', 'CHEF_COMMISSION'] as const) {
      const sections = sectionsMenu(navFor(role));
      expect(sections.map((s) => s.titre), role).toEqual(['Mon travail', 'Dossiers', 'Décisions', 'Pilotage', 'Exercé par délégation']);
      expect(sections[2].items.map((i) => i.label), role).toEqual(['PV et lettres de renvoi', 'Demandes de retrait']);
      expect(sections[3].items.map((i) => i.label), role).toEqual([
        'Répartition du dispatch',
        'Intérim', // intérim désigné (2026-09-21) : qui agit à la place du P/CC absent
        'Chaînes de contrôle',
        'Rapports', // ⚠️ 31/10 (pilote) — remis au menu
        'Statistiques',
      ]);
    }
  });

  it('le SUFFIXE suffit : /president/retraits et /cc/retraits tombent dans la même rubrique', () => {
    const rubrique = (role: Role, path: string) =>
      sectionsMenu(navFor(role)).find((s) => s.items.some((i) => i.path === path))?.cle;
    expect(rubrique('PRESIDENT', '/president/retraits')).toBe('decisions');
    expect(rubrique('CHEF_COMMISSION', '/cc/retraits')).toBe('decisions');
    expect(rubrique('PRMP', '/prmp/retraits')).toBe('decisions');
    expect(GROUPES_PAR_CHEMIN['retraits'].groupe).toBe('decisions');
  });

  it('le chemin COMPLET l’emporte sur le suffixe : les chaînes de contrôle de l’Admin ne sont pas du pilotage', () => {
    const rubrique = (role: Role, path: string) =>
      sectionsMenu(navFor(role)).find((s) => s.items.some((i) => i.path === path))?.cle;
    expect(rubrique('PRESIDENT', '/president/chaines-controle')).toBe('pilotage');
    expect(rubrique('ADMINISTRATEUR', '/admin/chaines-controle')).toBe('regles');
    expect(rubrique('MEMBRE', '/membre/tableau-de-bord')).toBe('dossiers');
    expect(rubrique('ADMINISTRATEUR', '/admin/tableau-de-bord')).toBe('accueil');
  });
});

describe('sectionsMenu — la section « Exercé par délégation » ne bouge pas', () => {
  it('reste la DERNIÈRE, garde sa clé, son intitulé et son repli', () => {
    for (const role of ['PRESIDENT', 'CHEF_COMMISSION'] as const) {
      const sections = sectionsMenu(navFor(role));
      const derniere = sections[sections.length - 1];
      expect(derniere.cle, role).toBe('delegation');
      expect(derniere.titre, role).toBe('Exercé par délégation');
      expect(derniere.repliable, role).toBe(true);
      expect(derniere.items.map((i) => i.label), role).toEqual(['Vérifications', 'Archivage des PV']);
      expect(derniere.items.every((i) => !!i.delegation), role).toBe(true);
    }
  });

  it('les rubriques PROPRES, elles, ne se replient pas (ce ne sont pas des boutons)', () => {
    const propres = sectionsMenu(navFor('PRESIDENT')).filter((s) => s.cle !== 'delegation');
    expect(propres.every((s) => !s.repliable)).toBe(true);
  });

  it('un profil sans délégation active ne voit aucune section déléguée', () => {
    for (const role of ROLES.filter((r) => r !== 'PRESIDENT' && r !== 'CHEF_COMMISSION')) {
      expect(
        sectionsMenu(NAV_BY_ROLE[role]).some((s) => s.cle === 'delegation'),
        role,
      ).toBe(false);
    }
  });

  it('un menu entièrement délégué ne produit que la section déléguée', () => {
    const sections = sectionsMenu([{ label: 'A', path: '/president/verifications', delegation: 'VERIFICATEUR' }]);
    expect(sections.map((s) => s.cle)).toEqual(['delegation']);
  });

  it('un menu vide, ou réduit au pied, ne produit aucune section', () => {
    expect(sectionsMenu([])).toEqual([]);
    expect(sectionsMenu([{ label: 'Notifications', path: '/notifications', icon: 'bell' }])).toEqual([]);
  });
});
