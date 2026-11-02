/**
 * Contenu de l'ENTRÉE PUBLIQUE (proposition `docs/proposition-2026-09-22-entree-publique-et-reperes.md`, arbitrée
 * le 22/09) — fichier UNIQUE : trois audiences, chacune avec sa bannière (titre, promesse, actions, repères) et sa section
 * de cartes (⚠️ 02/11 : six étapes, le résumé des processus de l'audience). Les repères chiffrés sont FIXES (arbitrage Q2) et
 * structurels — rien qui dépende d'un paramétrage (un délai standard se règle chez l'Administrateur, il n'a pas sa
 * place ici). Les mots-clés des cartes sont des LIENS vers l'écran concerné quand il existe pour toute l'audience
 * (PRMP) ; côté Commission, l'écran dépend du profil : les mots-clés restent en gras.
 */
/** ⚠️ Soumission en ligne, lot 1 (04/10) — troisième audience : les ENTREPRISES candidates, qui retirent un DAO en ligne. */
export type AudiencePublique = 'prmp' | 'commission' | 'candidat';

export const AUDIENCES: readonly AudiencePublique[] = ['prmp', 'commission', 'candidat'];

export interface LienPublic {
  libelle: string;
  /** Route interne (`/…`) — derrière la session, `authGuard` mène à la connexion puis y revient — ou ancre (`#…`). */
  lien: string;
}

/** Fragment de texte d'une carte : une chaîne, ou un mot-clé (lien si `lien`, gras sinon). */
export type Fragment = string | { mot: string; lien?: string };

export interface CartePublique {
  titre: string;
  texte: readonly Fragment[];
}

export interface ContenuAudience {
  onglet: string;
  /** ⚠️ 01/11 (variante A) — pour qui est cet espace : sous le titre du formulaire de connexion. */
  pour: string;
  titre: string;
  promesse: string;
  /**
   * ⚠️ 01/11 (variante A) — les actions de la bannière AUTRES que se connecter et créer un compte, qui vivent dans le formulaire
   * de connexion posé à côté : aujourd'hui, seulement les avis ouverts des entreprises (consultables sans compte).
   */
  actions: readonly { libelle: string; lien: string; principal: boolean }[];
  /** « Créer un compte PRMP », sous le formulaire de connexion ; `null` pour la Commission (comptes créés par l'Administrateur). */
  cta: LienPublic | null;
  /** ⚠️ 02/11 (pilote) — trois repères en colonnes égales : le chiffre, puis une phrase courte qui se lit seule. */
  reperes: readonly { valeur: string; libelle: string }[];
  sectionTitre: string;
  sectionTexte: string;
  cartes: readonly CartePublique[];
}

export const CONTENU_PUBLIC: Readonly<Record<AudiencePublique, ContenuAudience>> = {
  // ⚠️ 02/11 (pilote) — chaque onglet résume les PROCESSUS de son public, en six étapes, du premier au dernier geste.
  prmp: {
    onglet: 'PRMP & UGPM',
    pour: 'Personnes responsables des marchés publics et leurs unités de gestion',
    titre: 'Du plan de passation au contrat, chaque étape de vos marchés',
    promesse:
      'Vous soumettez vos dossiers au contrôle a priori de la CNM, vous lancez vos appels d’offres en ligne et vous suivez ' +
      'vos contrats jusqu’à la réception. L’UGPM prépare les dossiers ; la PRMP les soumet et décide.',
    actions: [],
    cta: { libelle: 'Créer un compte PRMP', lien: '/inscription' },
    reperes: [
      { valeur: '7', libelle: 'étapes suivies pour chaque dossier, de la réception à la clôture' },
      { valeur: '1', libelle: 'nouvelle version à chaque mise à jour : l’historique est conservé' },
      { valeur: '100 %', libelle: 'des PV et lettres de renvoi en ligne dès leur signature' },
    ],
    sectionTitre: 'Le parcours d’un marché, en six étapes.',
    sectionTexte:
      'Chaque dossier soumis à la CNM revient avec un procès-verbal : favorable, favorable avec réserves ou défavorable.',
    cartes: [
      {
        titre: 'Planifier',
        texte: [
          'Importez le ',
          { mot: 'plan de passation au format PDF', lien: '/prmp/soumettre-dossier' },
          ' et son avis général, complétez la fiche, joignez les pièces et soumettez. Une mise à jour est une ',
          { mot: 'nouvelle version', lien: '/prmp/dossiers-verifies' },
          ' : rien ne s’écrase.',
        ],
      },
      {
        titre: 'Préparer l’appel d’offres',
        texte: [
          'Pour chaque ligne du plan, remplissez la ',
          { mot: 'fiche DAO', lien: '/prmp/dao' },
          ' : l’application produit le dossier d’appel d’offres et l’avis, contrôlés par la CNM avant leur publication.',
        ],
      },
      {
        titre: 'Recevoir les offres',
        texte: [
          'Faites paraître l’avis, validez les ',
          { mot: 'reçus des frais de dossier', lien: '/prmp/recus' },
          ' ; les offres déposées en ligne ne s’ouvrent qu’en séance, à l’heure prévue, par la commission d’appel d’offres.',
        ],
      },
      {
        titre: 'Évaluer et attribuer',
        texte: [
          'La commission d’appel d’offres évalue, classe et propose l’attributaire. Le dossier de marché passe au contrôle de la ',
          'CNM avant la signature du contrat.',
        ],
      },
      {
        titre: 'Exécuter le contrat',
        texte: [
          'Pour les ',
          { mot: 'contrats-cadres et marchés à commandes', lien: '/prmp/contrats-en-vigueur' },
          ' : bons de commande, accusés du titulaire, réception par la commission de réception, reconductions.',
        ],
      },
      {
        titre: 'Suivre et recevoir les PV',
        texte: [
          'Chaque dossier avance sur une frise, avec sa ',
          { mot: 'fin de traitement prévue', lien: '/prmp/tableau-de-bord' },
          ' ; vous êtes ',
          { mot: 'notifié', lien: '/notifications' },
          ' à chaque geste de la CNM. Le ',
          { mot: 'procès-verbal signé', lien: '/prmp/resultat-examen' },
          ' et la lettre de renvoi sont à vous dès leur signature.',
        ],
      },
    ],
  },
  commission: {
    onglet: 'CNM',
    pour: 'Président, chefs de commission, membres, secrétaires, vérificateurs et assistants',
    titre: 'Le contrôle a priori des marchés, du dépôt à l’archivage',
    promesse:
      'À la connexion, « À faire » montre à chacun ce que le circuit attend de lui, par urgence, avec le délai qui court. ' +
      'Un dossier s’ouvre sur sa page : la frise, l’étape en cours et le geste à poser.',
    actions: [],
    // Pas de « Créer un compte » : les comptes de la CNM sont créés par l'Administrateur.
    cta: null,
    reperes: [
      { valeur: '10', libelle: 'profils, chacun avec son menu et son « À faire »' },
      { valeur: '1', libelle: 'page par dossier, la même pour tous les profils' },
      { valeur: '2', libelle: 'signataires distincts pour chaque procès-verbal' },
    ],
    sectionTitre: 'Le circuit de contrôle, en six étapes.',
    sectionTexte: 'Chaque étape est chronométrée et attribuée ; les gestes possibles sont calculés par le serveur, jamais devinés par l’écran.',
    cartes: [
      {
        titre: 'Recevoir',
        texte: [
          'Le Secrétaire ',
          { mot: 'contrôle la recevabilité' },
          ' pièce par pièce, numérote le dossier ou demande à la PRMP les pièces qui manquent.',
        ],
      },
      {
        titre: 'Dispatcher',
        texte: [
          'Le Président ou le Chef de commission ',
          { mot: 'attribue le dossier' },
          ' à un Membre, avec une consigne ; il peut le réattribuer en cours de route.',
        ],
      },
      {
        titre: 'Examiner',
        texte: [
          'Le Membre ',
          { mot: 'examine ligne à ligne' },
          ', aidé du pré-contrôle, et rédige le projet de procès-verbal avec son avis.',
        ],
      },
      {
        titre: 'Viser et signer',
        texte: [
          'Le dispatcheur ',
          { mot: 'vise' },
          ' le projet ; deux personnes distinctes signent le PV, l’intérim désigné couvrant les absences. Un dossier peut aussi revenir à la PRMP par une ',
          { mot: 'lettre de renvoi' },
          '.',
        ],
      },
      {
        titre: 'Vérifier',
        texte: [
          'Après un avis favorable avec réserves, le Vérificateur suit la ',
          { mot: 'levée des observations' },
          ', puis transmet le dossier à SIGMP.',
        ],
      },
      {
        titre: 'Archiver',
        texte: [
          'L’Assistant ',
          { mot: 'archive' },
          ' le PV définitif. Le journal du dossier garde chaque geste, y compris « par intérim de ».',
        ],
      },
    ],
  },
  // ⚠️ Soumission en ligne (04/10) — lots 1 à 4 livrés : consulter, retirer, déclarer, puis déposer une offre scellée,
  // ouverte en séance par la commission d'appel d'offres.
  candidat: {
    onglet: 'Entreprises',
    pour: 'Entreprises candidates aux appels d’offres en remise électronique',
    titre: 'Retirez le dossier, déposez votre offre en ligne',
    promesse:
      'Les appels d’offres ouverts à la remise électronique sont publiés ici. Avec un compte, vous retirez le dossier ' +
      'complet et vous déposez votre offre : chiffrée sur votre poste, elle ne s’ouvre qu’en séance, à l’heure prévue. ' +
      'Titulaire d’un contrat, vous y suivez aussi vos remises en concurrence et vos bons de commande.',
    actions: [{ libelle: 'Voir les avis ouverts', lien: '/candidat/procedures', principal: true }],
    cta: { libelle: 'Créer un compte candidat', lien: '/candidat/inscription' },
    reperes: [
      { valeur: '1', libelle: 'compte par entreprise, identifiée par son NIF, son STAT et son RCS' },
      { valeur: '1', libelle: 'accusé horodaté pour chaque offre déposée' },
      { valeur: '0', libelle: 'offre lue avant la séance d’ouverture : elle part chiffrée' },
    ],
    sectionTitre: 'Votre parcours, de l’avis au bon de commande.',
    sectionTexte: 'Les deux dernières étapes concernent les titulaires des contrats-cadres et des marchés à commandes.',
    cartes: [
      {
        // ⚠️ 02/11 (pilote) — l'entreprise découvre l'offre par l'AVIS : avis spécifique (appel d'offres) ou avis à manifestation
        // d'intérêt (prestations intellectuelles). « Procédure » reste là où l'on retire le dossier et où l'on dépose l'offre.
        titre: 'Trouver l’avis',
        texte: [
          'Les ',
          { mot: 'avis spécifiques', lien: '/candidat/procedures' },
          ' et les avis à manifestation d’intérêt se consultent sans compte : référence, objet, lots, date limite, formats acceptés. Chaque avis se lit en PDF.',
        ],
      },
      {
        titre: 'Déclarer votre entreprise',
        texte: [
          'Raison sociale, NIF, STAT, RCS, représentant et pièces : ',
          { mot: 'une déclaration', lien: '/candidat/entreprise' },
          ', vérifiée sur pièces par l’Administrateur. Elle ne bloque jamais un dépôt ; la commission la lit à l’ouverture des plis.',
        ],
      },
      {
        titre: 'Retirer le dossier',
        texte: [
          'Avec un compte confirmé, vous téléchargez le ',
          { mot: 'dossier d’appel d’offres', lien: '/candidat/procedures' },
          ' et ses formulaires. Chaque retrait est inscrit au registre de la personne responsable des marchés.',
        ],
      },
      {
        titre: 'Déposer votre offre',
        texte: [
          'Avant la date limite, ',
          { mot: 'votre offre', lien: '/candidat/offres' },
          ' part chiffrée ; un accusé horodaté vous est remis, et personne ne la lit avant la séance d’ouverture.',
        ],
      },
      {
        titre: 'Répondre aux remises en concurrence',
        texte: [
          'Titulaire d’un contrat-cadre, vous recevez les ',
          { mot: 'remises en concurrence', lien: '/candidat/remises' },
          ' des marchés subséquents et y répondez en ligne.',
        ],
      },
      {
        titre: 'Exécuter les bons de commande',
        texte: [
          'Vous recevez les ',
          { mot: 'bons de commande', lien: '/candidat/bons-commande' },
          ', en accusez réception et déclarez la livraison ; la commission de réception l’établit.',
        ],
      },
    ],
  },
};

/** Audience lue dans l'URL ; toute autre valeur vaut `prmp` (l'audience qui s'inscrit). Les membres de CAO n'ont pas d'audience : ils arrivent par leur invitation. */
export function audienceDepuis(param: string | null | undefined): AudiencePublique {
  return param === 'commission' || param === 'candidat' ? param : 'prmp';
}
