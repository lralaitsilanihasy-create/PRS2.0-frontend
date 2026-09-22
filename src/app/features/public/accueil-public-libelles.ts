/**
 * Contenu de l'ENTRÉE PUBLIQUE (proposition `docs/proposition-2026-09-22-entree-publique-et-reperes.md`, arbitrée
 * le 22/09) — fichier UNIQUE : deux audiences, chacune avec sa barre « ce que vous pouvez faire », sa bannière (titre,
 * promesse, actions, repères), sa section à trois cartes. Les repères chiffrés sont FIXES (arbitrage Q2) et
 * structurels — rien qui dépende d'un paramétrage (un délai standard se règle chez l'Administrateur, il n'a pas sa
 * place ici). Les mots-clés des cartes sont des LIENS vers l'écran concerné quand il existe pour toute l'audience
 * (PRMP) ; côté Commission, l'écran dépend du profil : les mots-clés restent en gras.
 */
export type AudiencePublique = 'prmp' | 'commission';

export const AUDIENCES: readonly AudiencePublique[] = ['prmp', 'commission'];

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
  titre: string;
  promesse: string;
  actions: readonly { libelle: string; lien: string; principal: boolean }[];
  nav: readonly LienPublic[];
  /** Bouton détaché de la barre secondaire (« Créer un compte PRMP ») ; `null` pour la Commission. */
  cta: LienPublic | null;
  reperes: readonly { valeur: string; libelle: string }[];
  sectionTitre: string;
  sectionTexte: string;
  cartes: readonly CartePublique[];
}

export const CONTENU_PUBLIC: Readonly<Record<AudiencePublique, ContenuAudience>> = {
  prmp: {
    onglet: 'PRMP & UGPM',
    titre: 'Déposez vos plans, suivez leur contrôle',
    promesse:
      'La Commission nationale des marchés reçoit vos plans de passation, les examine et vous rend un procès-verbal. ' +
      'Ici, vous déposez, vous complétez, vous suivez chaque étape et ses délais.',
    actions: [
      { libelle: 'Se connecter', lien: '/login', principal: true },
      { libelle: 'Créer un compte PRMP', lien: '/inscription', principal: false },
    ],
    nav: [
      { libelle: 'Déposer un plan de passation', lien: '/prmp/soumettre-dossier' },
      { libelle: 'Suivre le contrôle', lien: '/prmp/tableau-de-bord' },
      { libelle: 'Consulter les PV définitifs', lien: '/prmp/resultat-examen/pv-definitifs' },
    ],
    cta: { libelle: 'Créer un compte PRMP', lien: '/inscription' },
    reperes: [
      { valeur: '7', libelle: 'étapes suivies, de la réception à la clôture' },
      { valeur: '1', libelle: 'version par mise à jour : rien ne s’écrase' },
      { valeur: '0', libelle: 'papier : PV et lettres en ligne dès leur signature' },
    ],
    sectionTitre: 'Un seul guichet pour vos dossiers de planification.',
    sectionTexte: 'Trois choses se font ici, et rien d’autre : le reste du circuit se joue à la Commission, et vous le voyez avancer.',
    cartes: [
      {
        titre: 'Déposer un dossier',
        texte: [
          'Importez votre ',
          { mot: 'plan de passation au format PDF', lien: '/prmp/soumettre-dossier' },
          ', complétez la fiche, joignez les pièces et soumettez. Une mise à jour est une ',
          { mot: 'nouvelle version', lien: '/prmp/dossiers-verifies' },
          ' : rien ne s’écrase.',
        ],
      },
      {
        titre: 'Suivre le contrôle',
        texte: [
          'Chaque dossier avance sur une frise de sept étapes, avec sa ',
          { mot: 'fin de traitement prévue', lien: '/prmp/tableau-de-bord' },
          '. Une demande de pièces suspend le compteur ; vous êtes ',
          { mot: 'notifié', lien: '/notifications' },
          ' à chaque geste de la Commission.',
        ],
      },
      {
        titre: 'Consulter les PV',
        texte: [
          'Le ',
          { mot: 'procès-verbal signé', lien: '/prmp/resultat-examen/pv-definitifs' },
          ' et, s’il y a lieu, la ',
          { mot: 'lettre de renvoi', lien: '/prmp/resultat-examen' },
          ' sont à vous dès leur signature. Les observations à lever sont listées, avec leur état, jusqu’à la clôture.',
        ],
      },
    ],
  },
  commission: {
    onglet: 'Commission',
    titre: 'Votre travail du jour, sans rien chercher',
    promesse:
      'À la connexion, « À faire » vous montre ce que le circuit attend de vous, par urgence, avec le délai qui court. ' +
      'Un dossier s’ouvre sur sa page guidée : la frise, l’étape en cours et le geste à poser.',
    actions: [{ libelle: 'Se connecter', lien: '/login', principal: true }],
    nav: [
      { libelle: 'Mon travail du jour', lien: '/login' },
      { libelle: 'Le circuit de contrôle', lien: '#circuit' },
    ],
    // Pas de « Créer un compte » : les comptes de la Commission sont créés par l'Administrateur.
    cta: null,
    reperes: [
      { valeur: '10', libelle: 'profils, un menu chacun' },
      { valeur: '1', libelle: 'page par dossier, pour tous les profils' },
      { valeur: '2', libelle: 'personnes distinctes signent chaque PV' },
    ],
    sectionTitre: 'Le circuit, du dépôt à l’archivage.',
    sectionTexte: 'Sept étapes, chacune chronométrée et attribuée ; les gestes possibles sont calculés par le serveur, jamais devinés par l’écran.',
    cartes: [
      {
        titre: 'Recevoir et dispatcher',
        texte: [
          'Le Secrétaire ',
          { mot: 'contrôle la recevabilité' },
          ' pièce par pièce et numérote ; le Président ou le Chef de commission ',
          { mot: 'dispatche' },
          ' à un Membre, avec une consigne.',
        ],
      },
      {
        titre: 'Examiner et viser',
        texte: [
          'Le Membre ',
          { mot: 'examine ligne à ligne' },
          ', aidé du pré-contrôle ; le projet de PV remonte, est ',
          { mot: 'visé' },
          ' et signé par deux personnes distinctes, l’intérim désigné couvrant les absences.',
        ],
      },
      {
        titre: 'Vérifier et clore',
        texte: [
          'Le Vérificateur suit la ',
          { mot: 'levée des observations' },
          ' et transmet à SIGMP ; l’Assistant ',
          { mot: 'archive' },
          ' le PV définitif. Le journal du dossier raconte tout, y compris « par intérim de ».',
        ],
      },
    ],
  },
};

/** Audience lue dans l'URL ; toute autre valeur vaut `prmp` (l'audience qui s'inscrit). */
export function audienceDepuis(param: string | null | undefined): AudiencePublique {
  return param === 'commission' ? 'commission' : 'prmp';
}
