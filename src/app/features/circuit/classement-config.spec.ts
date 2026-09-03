import { Dossier } from '../../models';
import {
  attributairesParDossier,
  CIRCUIT_GROUPES,
  ClassementGroupe,
  dossierAttribueAMoi,
  dossierExcluDuGroupe,
  GROUPE_ENREGISTREMENT,
  GROUPE_RECEPTIONS,
  groupeMasquePourProfil,
  MEMBRE_GROUPES,
  separerGroupesParDelegation,
  statutsPartages,
} from './classement-config';

/**
 * ⚠️ Demande user (2026-08-28) : « il reste encore les menus dans les cards ». Les tâches exercées
 * par délégation ne doivent pas être mélangées à celles du profil connecté, dans les cartes de
 * « Mes dossiers » comme dans la barre latérale.
 *
 * Le prédicat de délégation est injecté (il dépend de l'utilisateur, pas de la configuration) : on
 * le simule ici par le décor réel des groupes du circuit.
 */
describe('separerGroupesParDelegation', () => {
  /** Ce que voit un Président / CC : Réceptions et Enregistrés sont exercés par délégation. */
  const commeDelegue = (g: ClassementGroupe) => g.key === 'receptions' || g.key === 'enregistrement';
  /** Ce que voit le Secrétaire : il est TITULAIRE de ces tâches, rien n'est délégué. */
  const commeTitulaire = () => false;

  it('Président / CC : deux sections, les tâches propres d’abord', () => {
    const sections = separerGroupesParDelegation(CIRCUIT_GROUPES, commeDelegue);
    expect(sections.map((s) => s.cle)).toEqual(['propre', 'delegation']);
    expect(sections[0].items.map((g) => g.key)).toEqual(['pre-dispatch', 'dispatch']);
    expect(sections[1].items.map((g) => g.key)).toEqual(['receptions', 'enregistrement']);
    expect(sections[1].titre).toBe('Exercé par délégation');
  });

  it('AUCUN MÉLANGE dans les deux sens', () => {
    const [propres, delegues] = separerGroupesParDelegation(CIRCUIT_GROUPES, commeDelegue);
    expect(propres.items.some(commeDelegue)).toBe(false);
    expect(delegues.items.every(commeDelegue)).toBe(true);
  });

  it('aucun groupe perdu ni dupliqué', () => {
    const sections = separerGroupesParDelegation(CIRCUIT_GROUPES, commeDelegue);
    const cles = sections.flatMap((s) => s.items.map((g) => g.key));
    expect(cles.length).toBe(CIRCUIT_GROUPES.length);
    expect(new Set(cles).size).toBe(CIRCUIT_GROUPES.length);
  });

  it('Secrétaire (titulaire) : une seule section, sans intitulé — son écran est inchangé', () => {
    const sections = separerGroupesParDelegation(CIRCUIT_GROUPES, commeTitulaire);
    expect(sections.length).toBe(1);
    expect(sections[0].cle).toBe('propre');
    expect(sections[0].titre).toBeNull();
    expect(sections[0].items.map((g) => g.key)).toEqual(CIRCUIT_GROUPES.map((g) => g.key));
  });

  // ⚠️ ANTI-RÉGRESSION — la ligne « Demandes de retrait » est ACCROCHÉE à la section « propre »
  // dans le gabarit, et c'est le seul chemin vers cet écran (règle du 2026-08-07). Filtrer les
  // sections vides la ferait disparaître pour un profil dont toutes les tâches sont déléguées.
  it('la section « propre » subsiste même VIDE — sinon le lien « Demandes de retrait » tombe avec elle', () => {
    const sections = separerGroupesParDelegation([GROUPE_RECEPTIONS, GROUPE_ENREGISTREMENT], () => true);
    expect(sections.map((s) => s.cle)).toEqual(['propre', 'delegation']);
    expect(sections[0].items).toEqual([]);
  });

  it('la section déléguée, elle, disparaît quand elle est vide', () => {
    const sections = separerGroupesParDelegation(CIRCUIT_GROUPES, () => false);
    expect(sections.map((s) => s.cle)).toEqual(['propre']);
  });

  it('l’ORDRE d’origine est préservé dans chaque section', () => {
    const [propres, delegues] = separerGroupesParDelegation(CIRCUIT_GROUPES, commeDelegue);
    expect(propres.items.map((g) => g.key)).toEqual(
      CIRCUIT_GROUPES.filter((g) => !commeDelegue(g)).map((g) => g.key),
    );
    expect(delegues.items.map((g) => g.key)).toEqual(
      CIRCUIT_GROUPES.filter(commeDelegue).map((g) => g.key),
    );
  });

  it('une liste vide ne produit qu’une section propre vide', () => {
    expect(separerGroupesParDelegation([], () => false)).toEqual([
      { cle: 'propre', titre: null, items: [] },
    ]);
  });
});


/**
 * ⚠️ Demande user (2026-08-28) : « lever l'ambiguïté ». Un Président lisait 3 + 0 + 1 + 3 = 7 en
 * face d'un total affiché à 4. Les deux chiffres sont justes : les tuiles comptent par groupe, le
 * total compte des dossiers DISTINCTS — et deux groupes couvrent le même statut.
 */
describe('statutsPartages', () => {
  it('repère PRET_DISPATCH, couvert à la fois par « Pré-dispatch » et « Enregistrés »', () => {
    const partages = statutsPartages(CIRCUIT_GROUPES);
    expect(partages.length).toBe(1);
    expect(partages[0].statut).toBe('PRET_DISPATCH');
    expect(partages[0].labels.sort()).toEqual(['Enregistrés', 'Pré-dispatch']);
  });

  it('ne signale RIEN quand aucun statut n’est partagé', () => {
    const sansRecouvrement = CIRCUIT_GROUPES.filter((g) => g.key !== 'enregistrement');
    expect(statutsPartages(sansRecouvrement)).toEqual([]);
  });

  it('les statuts couverts par un seul groupe ne sont jamais signalés', () => {
    const statuts = statutsPartages(CIRCUIT_GROUPES).map((p) => p.statut);
    expect(statuts).not.toContain('SOUMIS');
    expect(statuts).not.toContain('DISPATCHE');
  });

  it('remonte tous les groupes concernés, pas seulement deux', () => {
    const g = (key: string, statuts: string[]): ClassementGroupe => ({ key, label: key, statuts, icon: '', kind: 'a' });
    const partages = statutsPartages([g('a', ['X']), g('b', ['X']), g('c', ['X'])]);
    expect(partages).toEqual([{ statut: 'X', labels: ['a', 'b', 'c'] }]);
  });

  it('une liste vide ne partage rien', () => {
    expect(statutsPartages([])).toEqual([]);
  });
});


/**
 * ⚠️ Demande pilote (2026-09-03) : « Pour le dossier de localité centrale (CNM), le CC ne doit pas
 * voir les dossiers pour pré-dispatch. Seul le Président en a ce privilège. » L'exclusion ne touche
 * QUE les groupes à action « Dispatcher » et QUE le rôle CHEF_COMMISSION sur un dossier CENTRAL —
 * commissions régionales et autres groupes inchangés.
 */
describe('dossierExcluDuGroupe (pré-dispatch central, demande pilote 2026-09-03)', () => {
  const preDispatch = CIRCUIT_GROUPES.find((g) => g.key === 'pre-dispatch')!;
  const enregistrement = GROUPE_ENREGISTREMENT;
  const dossier = (idLocalite: string): Dossier => ({ idDossier: 1, idLocalite, statut: 'PRET_DISPATCH' }) as Dossier;

  it('EXCLU : CC × dossier central × groupe « Pré-dispatch »', () => {
    expect(dossierExcluDuGroupe(preDispatch, dossier('ANT'), 'CHEF_COMMISSION')).toBe(true);
  });

  it('le Président garde son privilège sur le dossier central', () => {
    expect(dossierExcluDuGroupe(preDispatch, dossier('ANT'), 'PRESIDENT')).toBe(false);
  });

  it('une commission RÉGIONALE est inchangée : son CC dispatche toujours', () => {
    expect(dossierExcluDuGroupe(preDispatch, dossier('TOA'), 'CHEF_COMMISSION')).toBe(false);
  });

  it('les groupes SANS action « Dispatcher » ne sont pas touchés (registre « Enregistrés »)', () => {
    expect(dossierExcluDuGroupe(enregistrement, dossier('ANT'), 'CHEF_COMMISSION')).toBe(false);
  });

  it('un dossier sans localité, ou un rôle absent, n’est jamais exclu', () => {
    expect(dossierExcluDuGroupe(preDispatch, { idDossier: 1, statut: 'PRET_DISPATCH' } as Dossier, 'CHEF_COMMISSION')).toBe(false);
    expect(dossierExcluDuGroupe(preDispatch, dossier('ANT'), null)).toBe(false);
  });

  // Question pilote (même jour) : « le menu pre-dispatch est-il encore utile dans ce profil ? » —
  // non, chez le CC CENTRAL : le groupe entier (tuile + ligne) disparaît, il resterait à zéro.
  it('groupe « Pré-dispatch » MASQUÉ en entier chez le CC de la localité centrale', () => {
    expect(groupeMasquePourProfil(preDispatch, 'CHEF_COMMISSION', 'ANT')).toBe(true);
  });

  it('le groupe reste affiché : CC régional, Président (sans localité), autres groupes', () => {
    expect(groupeMasquePourProfil(preDispatch, 'CHEF_COMMISSION', 'TOA')).toBe(false);
    expect(groupeMasquePourProfil(preDispatch, 'PRESIDENT', null)).toBe(false);
    expect(groupeMasquePourProfil(enregistrement, 'CHEF_COMMISSION', 'ANT')).toBe(false);
  });
});


/**
 * ⚠️ Demande pilote (2026-09-03, suite) : « si le président fait un dispatch vers CC, il doit être
 * dans À examiner et non pas dans Dispatch. Par contre, si ce dossier est dispatché à son tour à un
 * membre, en ce moment-là il doit être dans le Dispatch. »
 */
describe('dossierAttribueAMoi (Dispatch sans mes attributions, demande pilote 2026-09-03)', () => {
  const dispatch = CIRCUIT_GROUPES.find((g) => g.key === 'dispatch')!;
  const aExaminer = MEMBRE_GROUPES.find((g) => g.key === 'a-examiner')!;

  it('EXCLU du groupe « Dispatch » : le dossier m’est attribué (il vit dans « À examiner »)', () => {
    expect(dossierAttribueAMoi(dispatch, 'CCANT01', 'CCANT01')).toBe(true);
  });

  it('réattribué à un Membre → il REVIENT dans « Dispatch »', () => {
    expect(dossierAttribueAMoi(dispatch, 'MEMANT1', 'CCANT01')).toBe(false);
  });

  it('ne touche jamais les files « À examiner », ni sans dispatch ou sans session', () => {
    expect(dossierAttribueAMoi(aExaminer, 'CCANT01', 'CCANT01')).toBe(false);
    expect(dossierAttribueAMoi(dispatch, undefined, 'CCANT01')).toBe(false);
    expect(dossierAttribueAMoi(dispatch, 'CCANT01', null)).toBe(false);
  });

  it('le geste « Réattribuer » a suivi le dossier : porté par « À examiner », plus par « Dispatch »', () => {
    expect(aExaminer.actionReattribuer).toBe(true);
    expect(dispatch.actionReattribuer).toBeUndefined();
  });

  it('attributairesParDossier : le DERNIER dispatch fait foi', () => {
    const receptions = [{ idReception: 10, idDossier: 1 }];
    const dispatchs = [
      { idReception: 10, imCtrlMembre: 'CCANT01', dateDispatch: '2026-09-03T10:00' },
      { idReception: 10, imCtrlMembre: 'MEMANT1', dateDispatch: '2026-09-03T13:00' },
    ];
    expect(attributairesParDossier(receptions, dispatchs).get(1)).toBe('MEMANT1');
  });
});
