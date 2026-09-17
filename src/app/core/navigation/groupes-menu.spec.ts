import { Role } from '../../models';
import {
  COURTS_PAR_ROLE,
  GROUPES_PAR_CHEMIN,
  ORDRE_GROUPES,
  courtContenuDansLibelle,
  groupeExplicite,
  libelleCourt,
  nomAccessibleRail,
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

const ROLES = Object.keys(NAV_BY_ROLE) as Role[];

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
      expect(valeur.court.length).toBeGreaterThan(0);
    }
  });

  it('les surcharges de libellé court visent une entrée qui existe dans le menu du profil', () => {
    for (const [role, surcharges] of Object.entries(COURTS_PAR_ROLE)) {
      for (const cle of Object.keys(surcharges ?? {})) {
        const trouvee = NAV_BY_ROLE[role as Role].some(
          (i) => i.path === cle || suffixeChemin(i.path) === cle,
        );
        expect(trouvee, `${role} → ${cle}`).toBe(true);
      }
    }
  });

  it('« Notifications » est la seule entrée de pied, et elle l’est dans les DIX menus', () => {
    for (const role of ROLES) {
      const pied = piedMenu(NAV_BY_ROLE[role]);
      expect(pied.map((i) => i.label), role).toEqual(['Notifications']);
    }
  });
});

describe('sectionsMenu — dérivation des rubriques', () => {
  it('« Notifications » quitte les rubriques : elle n’apparaît qu’une fois, dans le pied', () => {
    for (const role of ROLES) {
      const menu = NAV_BY_ROLE[role];
      const dansSections = sectionsMenu(menu).flatMap((s) => s.items.map((i) => i.path));
      expect(dansSections.filter((p) => p === '/notifications'), role).toEqual([]);
      expect(piedMenu(menu).length, role).toBe(1);
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

  it('Secrétaire, Vérificateur, UGPM et Chargé de publication : UNE section SANS intitulé (menu inchangé à l’écran)', () => {
    for (const role of ['SECRETAIRE', 'VERIFICATEUR', 'UGPM', 'CHARGE_PUBLICATION'] as const) {
      const sections = sectionsMenu(NAV_BY_ROLE[role]);
      expect(sections.length, role).toBe(1);
      expect(sections[0].titre, role).toBeNull();
      expect(sections[0].repliable, role).toBe(false);
      // Exactement le menu d'aujourd'hui, Notifications en moins (rendue dans le pied).
      expect(sections[0].items.map((i) => i.label), role).toEqual(
        NAV_BY_ROLE[role].filter((i) => i.label !== 'Notifications').map((i) => i.label),
      );
    }
  });

  it('PRMP : Mon travail · Décisions · Planification, dans cet ordre', () => {
    const sections = sectionsMenu(navFor('PRMP'));
    expect(sections.map((s) => s.titre)).toEqual(['Mon travail', 'Décisions', 'Planification']);
    expect(sections[0].items.map((i) => i.label)).toEqual([
      'À faire',
      'Suivi des dossiers CNM',
      'Créer dossier',
      'Mettre à jour un PPM',
    ]);
    expect(sections[1].items.map((i) => i.label)).toEqual(['PV et lettres de renvoi', 'Demandes de retrait']);
    expect(sections[2].items.map((i) => i.label)).toEqual(['Calendrier']);
  });

  it('Membre : Mon travail · Décisions', () => {
    const sections = sectionsMenu(navFor('MEMBRE'));
    expect(sections.map((s) => s.titre)).toEqual(['Mon travail', 'Décisions']);
    expect(sections[1].items.map((i) => i.label)).toEqual(['PV et lettres de renvoi']);
  });

  it('Assistant contrôleur : Mon travail · Archivage', () => {
    const sections = sectionsMenu(navFor('ASSISTANT_CONTROLEUR'));
    expect(sections.map((s) => s.titre)).toEqual(['Mon travail', 'Archivage']);
    expect(sections[1].items.map((i) => i.label)).toEqual(['Lettres de renvoi reçues', 'PV reçus']);
  });

  /**
   * ⚠️ Lot 6 F1 (2026-09-17) — classement REFAIT pour l'Administrateur (plan L6, §3). Ce test dit
   * le menu cible en toutes lettres : c'est lui qui rattrapera une entrée rangée au hasard.
   */
  it('Administrateur : son accueil SANS intitulé, puis Accès · Règles du contrôle · Référentiels · Traces', () => {
    const sections = sectionsMenu(navFor('ADMINISTRATEUR'));
    expect(sections.map((s) => s.titre)).toEqual([
      null,
      'Accès',
      'Règles du contrôle',
      'Référentiels',
      'Traces',
    ]);
    expect(sections.map((s) => s.items.map((i) => i.label))).toEqual([
      ['Tableau de bord global'],
      ['Demandes d’accès', 'Comptes & personnes'],
      [
        'Chaînes de contrôle',
        'Délais standards',
        'Points de contrôle',
        'Seuil AGPM (AMI)',
        'Règles d’alerte',
      ],
      ['Nomenclatures'],
      ['Journal d’audit', 'Actualités'],
    ]);
  });

  it('Administrateur : DOUZE entrées, Notifications comprise — le critère de hauteur du lot 6', () => {
    // 1366×768 et 1229×691 sans défilement : mesuré par `node scripts/hauteur-menu.mjs`. Douze est
    // le nombre pour lequel cette mesure a été faite ; au-delà, la mesure est à refaire.
    expect(navFor('ADMINISTRATEUR').length).toBe(12);
  });

  it('les écrans retirés du menu de l’Administrateur n’y reviennent pas par accident', () => {
    const chemins = navFor('ADMINISTRATEUR').map((i) => i.path);
    // Écrans PRMP réutilisés, de la consultation (décision Mathieu 2026-09-17) — routes conservées.
    expect(chemins).not.toContain('/admin/ppm-marches');
    expect(chemins).not.toContain('/admin/marches-previsions');
    // Journal des connexions : devient un onglet du Journal au lot F5 — route conservée jusque-là.
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
    expect(rubrique('/admin/referentiels')).toBe('referentiels');
  });

  it('Président et CC : Mon travail · Décisions · Pilotage · Exercé par délégation', () => {
    for (const role of ['PRESIDENT', 'CHEF_COMMISSION'] as const) {
      const sections = sectionsMenu(navFor(role));
      expect(sections.map((s) => s.titre), role).toEqual([
        'Mon travail',
        'Décisions',
        'Pilotage',
        'Exercé par délégation',
      ]);
      expect(sections[2].items.map((i) => i.label), role).toEqual([
        'Répartition de dispatch',
        'Chaînes de contrôle',
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
    expect(rubrique('MEMBRE', '/membre/tableau-de-bord')).toBe('travail');
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

describe('libelleCourt — le mot du rail (lot F4)', () => {
  it('reprend la table, et se surcharge par profil quand deux menus partagent un écran', () => {
    const court = (role: Role, label: string) => {
      const item = navFor(role).find((i) => i.label === label) as NavItem;
      return libelleCourt(item, role);
    };
    expect(court('PRMP', 'Suivi des dossiers CNM')).toBe('Suivi');
    expect(court('UGPM', 'Tous les dossiers')).toBe('Dossiers');
    expect(court('PRESIDENT', 'Examen de dossiers')).toBe('Examen');
    expect(court('PRMP', 'PV et lettres de renvoi')).toBe('PV');
    expect(court('ASSISTANT_CONTROLEUR', 'PV reçus')).toBe('PV');
    expect(court('PRESIDENT', 'Archivage des PV')).toBe('Archives');
    expect(court('ADMINISTRATEUR', 'Tableau de bord global')).toBe('Global');
  });

  it('replie sur le premier mot du libellé pour une entrée que la table ne connaît pas', () => {
    expect(libelleCourt({ label: 'Nouvelle entrée', path: '/admin/nouvelle-entree' })).toBe('Nouvelle');
    expect(libelleCourt({ label: 'Rapports', path: '/president/rapports' }, 'PRESIDENT')).toBe('Rapports');
  });

  it('aucun libellé court ambigu à l’intérieur d’un même menu', () => {
    for (const role of ROLES) {
      const courts = NAV_BY_ROLE[role].map((i) => libelleCourt(i, role));
      expect(new Set(courts).size, `${role} : ${courts.join(' / ')}`).toBe(courts.length);
    }
  });

  it('tout libellé court tient en un mot court (rail de 76 px)', () => {
    for (const role of ROLES) {
      for (const item of NAV_BY_ROLE[role]) {
        expect(libelleCourt(item, role).length, `${role} / ${item.label}`).toBeLessThanOrEqual(14);
      }
    }
  });
});

/**
 * WCAG 2.5.3 « Label in Name » (correctif du 2026-09-16).
 *
 * En rail, le seul texte VISIBLE d'une entrée est sa légende ; son nom accessible est le libellé
 * complet, rangé hors écran. Le critère exige que le second contienne le premier — sans quoi une
 * commande vocale prononçant ce qui est lu à l'écran ne désigne rien.
 *
 * Le garde-fou porte sur les DIX MENUS RÉELS : une légende ajoutée demain à `GROUPES_PAR_CHEMIN`
 * sans être un fragment de son libellé fait rougir ce test, et non la recette.
 */
describe('nomAccessibleRail — le texte visible tient dans le nom accessible (WCAG 2.5.3)', () => {
  it('laisse intactes les entrées dont la légende est déjà un fragment du libellé', () => {
    const nom = (role: Role, label: string) =>
      nomAccessibleRail(navFor(role).find((i) => i.label === label) as NavItem, role);
    expect(nom('UGPM', 'Tous les dossiers')).toBe('Tous les dossiers');
    expect(nom('PRMP', 'Suivi des dossiers CNM')).toBe('Suivi des dossiers CNM');
    expect(nom('ADMINISTRATEUR', 'Tableau de bord global')).toBe('Tableau de bord global');
    expect(nom('PRESIDENT', 'Examen de dossiers')).toBe('Examen de dossiers');
    expect(nom('ASSISTANT_CONTROLEUR', 'PV reçus')).toBe('PV reçus');
    expect(nom('VERIFICATEUR', 'Vérifiés / clôturés')).toBe('Vérifiés / clôturés');
  });

  it('préfixe la légende au libellé pour les CINQ entrées où elle en est un synonyme', () => {
    const nom = (role: Role, label: string) =>
      nomAccessibleRail(navFor(role).find((i) => i.label === label) as NavItem, role);
    expect(nom('PRESIDENT', 'Répartition de dispatch')).toBe('Charge — Répartition de dispatch');
    expect(nom('PRMP', 'Notifications')).toBe('Alertes — Notifications');
    expect(nom('PRMP', 'Mettre à jour un PPM')).toBe('Mise à jour — Mettre à jour un PPM');
    expect(nom('PRESIDENT', 'Archivage des PV')).toBe('Archives — Archivage des PV');
    expect(nom('PRMP', 'Demandes de retrait')).toBe('Retraits — Demandes de retrait');
  });

  it('les DIX menus passent le critère, entrée par entrée', () => {
    for (const role of ROLES) {
      for (const item of NAV_BY_ROLE[role]) {
        const court = libelleCourt(item, role);
        const nom = nomAccessibleRail(item, role);
        expect(
          courtContenuDansLibelle(nom, court),
          `${role} / « ${court} » n’est pas contenu dans « ${nom} » — WCAG 2.5.3, cf. nomAccessibleRail (groupes-menu.ts).`,
        ).toBe(true);
      }
    }
  });

  it('le nom accessible reste UNIQUE à l’intérieur d’un même menu', () => {
    for (const role of ROLES) {
      const noms = NAV_BY_ROLE[role].map((i) => nomAccessibleRail(i, role));
      expect(new Set(noms).size, `${role} : ${noms.join(' / ')}`).toBe(noms.length);
    }
  });

  it('le libellé complet est toujours présent : l’entrée reste identifiable à l’oreille', () => {
    for (const role of ROLES) {
      for (const item of NAV_BY_ROLE[role]) {
        expect(nomAccessibleRail(item, role)).toContain(item.label);
      }
    }
  });

  it('la comparaison ignore la casse et les espaces, pas les accents', () => {
    expect(courtContenuDansLibelle('Tableau de bord global', 'Global')).toBe(true);
    expect(courtContenuDansLibelle('Tous  les dossiers', ' Dossiers ')).toBe(true);
    expect(courtContenuDansLibelle('Delais standards', 'Délais')).toBe(false);
    expect(courtContenuDansLibelle('Demandes de retrait', 'Retraits')).toBe(false);
  });

  it('une entrée ajoutée par le pilote hors table passe d’office (repli sur le premier mot)', () => {
    const inedit: NavItem = { label: 'Rapports mensuels', path: '/admin/rapports' };
    expect(nomAccessibleRail(inedit, 'ADMINISTRATEUR')).toBe('Rapports mensuels');
  });
});
