import { CrudResourceConfig } from '../../shared/crud/crud-config';
import {
  AuditLogService,
  AvisService,
  CatCompteService,
  CompteService,
  ControleurService,
  DelegationProfilService,
  EntiteContractService,
  LocaliteService,
  MinistereService,
  ModePassationService,
  NatureService,
  OrganigrammeService,
  PointsCtrlService,
  ProfileService,
  PrmpEntiteService,
  PrmpService,
  RegleAlerteService,
  RegleAnomalieService,
  SessionUtilisateurService,
  SoaBeneficiaireService,
  SousTypeDossierService,
  TypeDmcService,
  TypeDossierService,
  TypePieceJointeService,
} from '../../services';

/** Une entrée navigable de l'espace admin : slug d'URL + configuration CRUD. */
export interface AdminResource {
  slug: string;
  config: CrudResourceConfig;
}

/** Référentiels (écriture ADMINISTRATEUR). */
export const REFERENTIELS: AdminResource[] = [
  {
    slug: 'aviss',
    config: {
      title: 'Avis',
      service: AvisService,
      idKey: 'idAvis',
      writeCapability: 'REFERENTIEL_WRITE',
      fields: [
        { key: 'idAvis', label: 'Identifiant', pk: true, required: true },
        { key: 'libelleAvis', label: 'Libellé' },
      ],
    },
  },
  {
    slug: 'cat-comptes',
    config: {
      title: 'Catégories de compte',
      service: CatCompteService,
      idKey: 'idCatCompte',
      writeCapability: 'REFERENTIEL_WRITE',
      fields: [
        { key: 'idCatCompte', label: 'Identifiant', pk: true, required: true },
        { key: 'catCompte', label: 'Catégorie' },
      ],
    },
  },
  {
    slug: 'comptes',
    config: {
      title: 'Comptes budgétaires',
      service: CompteService,
      idKey: 'numCompte',
      writeCapability: 'REFERENTIEL_WRITE',
      fields: [
        { key: 'numCompte', label: 'N° compte', pk: true, required: true },
        { key: 'libelle', label: 'Libellé' },
        { key: 'idCatCompte', label: 'Catégorie' },
      ],
    },
  },
  {
    slug: 'soa-beneficiaires',
    config: {
      title: 'SOA bénéficiaires',
      service: SoaBeneficiaireService,
      idKey: 'soaCode',
      writeCapability: 'REFERENTIEL_WRITE',
      fields: [
        { key: 'soaCode', label: 'Code SOA', pk: true, required: true },
        { key: 'libelle', label: 'Libellé' },
      ],
    },
  },
  {
    slug: 'delegation-profils',
    config: {
      title: 'Délégations de profil',
      service: DelegationProfilService,
      idKey: 'idDelegation',
      writeCapability: 'REFERENTIEL_WRITE',
      fields: [
        // PK technique sans signification métier : masquée de la liste et du formulaire (auto max+1 à la création).
        { key: 'idDelegation', label: 'Identifiant', type: 'number', pk: true, required: true, autoId: true, hideInList: true },
        // Libellés résolus via le référentiel Profils (liste) ; dropdown de profils en formulaire.
        {
          key: 'idProfileDelegant',
          label: 'Profil délégant',
          type: 'number',
          required: true,
          ref: { service: ProfileService, idKey: 'idProfile', labelKeys: ['profile'] },
        },
        {
          key: 'idProfileDelegue',
          label: 'Profil délégué',
          type: 'number',
          required: true,
          ref: { service: ProfileService, idKey: 'idProfile', labelKeys: ['profile'] },
        },
        { key: 'actif', label: 'Actif', type: 'boolean', required: true },
      ],
    },
  },
  {
    slug: 'entite-contracts',
    config: {
      title: 'Entités contractantes',
      service: EntiteContractService,
      idKey: 'idEntiteContract',
      writeCapability: 'REFERENTIEL_WRITE',
      filters: [
        { param: 'organigramme', key: 'idOrganigramme', label: 'Organigramme' },
        { param: 'parent', key: 'idEntiteParent', label: 'Entité parente' },
      ],
      rowActions: [
        { label: 'Sous-entités', path: '/admin/referentiels/entite-contracts', queryParam: 'parent', valueKey: 'idEntiteContract' },
        { label: 'Affectations PRMP', path: '/admin/comptes/prmp-entites', queryParam: 'entite', valueKey: 'idEntiteContract' },
      ],
      fields: [
        { key: 'idEntiteContract', label: 'Identifiant', type: 'number', pk: true, required: true, autoId: true },
        { key: 'libelleEntite', label: 'Libellé', required: true },
        { key: 'adresse', label: 'Adresse', required: true },
        { key: 'categorieEntite', label: 'Catégorie', optionsFromData: true },
        {
          key: 'idOrganigramme',
          label: 'Organigramme',
          type: 'number',
          required: true,
          ref: { service: OrganigrammeService, idKey: 'idOrganigramme', labelKeys: ['libelle'] },
        },
        {
          key: 'idEntiteParent',
          label: 'Entité parente',
          type: 'number',
          ref: { service: EntiteContractService, idKey: 'idEntiteContract', labelKeys: ['libelleEntite'] },
        },
        { key: 'niveauHierarchique', label: 'Niveau', type: 'number', optionsFromData: true },
      ],
    },
  },
  {
    slug: 'localites',
    config: {
      title: 'Localités',
      service: LocaliteService,
      idKey: 'idLocalite',
      writeCapability: 'REFERENTIEL_WRITE',
      note: "L'identifiant (max 5) est la clé référencée partout (dossiers, contrôleurs, périmètre de visibilité) ; le code référence (max 3) compose le segment localité des références de dossier (ex. CRM-ANT). Ils peuvent différer.",
      fields: [
        { key: 'idLocalite', label: 'Identifiant', pk: true, required: true },
        { key: 'libelleLocalite', label: 'Libellé', required: true },
        // Rôle exact de « referencement » en cours de clarification côté backend (dérivable du code ?).
        { key: 'referencement', label: 'Référencement (interne)', required: true },
        { key: 'localite', label: 'Code référence (3 lettres)', required: true },
      ],
    },
  },
  {
    slug: 'ministeres',
    config: {
      title: 'Ministères',
      service: MinistereService,
      idKey: 'idMinistere',
      writeCapability: 'REFERENTIEL_WRITE',
      rowActions: [
        { label: 'Voir organigrammes', path: '/admin/comptes/organigrammes', queryParam: 'ministere', valueKey: 'idMinistere' },
      ],
      fields: [
        { key: 'idMinistere', label: 'Identifiant', type: 'number', pk: true, required: true },
        { key: 'libelleMinistere', label: 'Libellé', required: true },
        { key: 'sigle', label: 'Sigle' },
      ],
    },
  },
  {
    slug: 'mode-passations',
    config: {
      title: 'Modes de passation',
      service: ModePassationService,
      idKey: 'idMode',
      writeCapability: 'REFERENTIEL_WRITE',
      fields: [
        { key: 'idMode', label: 'Identifiant', type: 'number', pk: true, required: true },
        { key: 'libelle', label: 'Libellé' },
        { key: 'description', label: 'Description' },
        { key: 'publiciteRequise', label: 'Publicité requise', type: 'boolean' },
        { key: 'declencheAgpm', label: 'Déclenche AGPM', type: 'boolean' },
        { key: 'delaiMinJours', label: 'Délai min. (jours)', type: 'number' },
        { key: 'baseLegale', label: 'Base légale' },
      ],
    },
  },
  {
    slug: 'natures',
    config: {
      title: 'Natures',
      service: NatureService,
      idKey: 'idNature',
      writeCapability: 'REFERENTIEL_WRITE',
      fields: [
        { key: 'idNature', label: 'Identifiant', type: 'number', pk: true, required: true },
        { key: 'libelle', label: 'Libellé' },
        { key: 'description', label: 'Description' },
      ],
    },
  },
  {
    slug: 'type-dmc',
    config: {
      title: 'Types de document DMC (par marché)',
      service: TypeDmcService,
      idKey: 'idTypeDmc',
      writeCapability: 'REFERENTIEL_WRITE',
      note: 'Types du DOCUMENT de mise en concurrence exigé pour chaque marché (DAO, DC, BC…), dérivé de son mode de passation (voir « Mapping mode → document DMC »). À ne pas confondre avec « Sous-types de dossier », qui classe les dossiers soumis à la CNM.',
      fields: [
        // idTypeDmc est une PK IDENTITY (générée par la base) → masquée à la création ET de la liste (technique).
        { key: 'idTypeDmc', label: 'Identifiant', type: 'number', pk: true, required: true, autoId: true, hideInList: true },
        { key: 'code', label: 'Code', required: true },
        { key: 'libelle', label: 'Libellé', required: true },
        { key: 'actif', label: 'Actif', type: 'boolean' },
      ],
    },
  },
  {
    slug: 'type-piece-jointes',
    config: {
      title: 'Types de pièces jointes',
      service: TypePieceJointeService,
      idKey: 'idTypePiece',
      writeCapability: 'REFERENTIEL_WRITE',
      note: 'Pièces jointes attendues par type de dossier (ex. PPM). « Obligatoire » = exigée à la soumission du dossier ; « Ordre » fixe l’ordre d’affichage dans le formulaire de saisie.',
      fields: [
        // idTypePiece est une PK IDENTITY (générée par la base) → masquée à la création (envoyée mais ignorée serveur).
        { key: 'idTypePiece', label: 'Identifiant', type: 'number', pk: true, required: true, autoId: true },
        { key: 'libellePiece', label: 'Libellé', required: true },
        {
          key: 'idTypeDossier',
          label: 'Type de dossier',
          required: true,
          ref: { service: TypeDossierService, idKey: 'idTypeDossier', labelKeys: ['libelleType'] },
        },
        { key: 'obligatoire', label: 'Obligatoire', type: 'boolean', required: true },
        { key: 'ordre', label: 'Ordre', type: 'number' },
      ],
    },
  },
  {
    slug: 'points-ctrls',
    config: {
      title: 'Points de contrôle',
      service: PointsCtrlService,
      idKey: 'idPointCtrl',
      writeCapability: 'REFERENTIEL_WRITE',
      note: 'Grille d\'examen : un point porte sa famille (DDP/DMC/DDM) et, en option, un sous-type ciblé — vide = commun à toute la famille. Un sous-type hors de la famille du point est refusé (400).',
      fields: [
        // PK technique sans signification métier : masquée de la liste et du formulaire (auto max+1 à la création).
        { key: 'idPointCtrl', label: 'Identifiant', type: 'number', pk: true, required: true, autoId: true, hideInList: true },
        { key: 'libelPointCtrl', label: 'Libellé' },
        { key: 'decriptPointCtrl', label: 'Description' },
        { key: 'ordrePointCtrl', label: 'Ordre', type: 'number' },
        { key: 'obligatoire', label: 'Obligatoire', type: 'boolean', required: true },
        {
          key: 'idTypeDossier',
          label: 'Famille',
          required: true,
          ref: { service: TypeDossierService, idKey: 'idTypeDossier', labelKeys: ['libelleType'] },
        },
        {
          key: 'idSousType',
          label: 'Sous-type (vide = commun)',
          ref: { service: SousTypeDossierService, idKey: 'idSousType', labelKeys: ['libelleSousType'] },
        },
      ],
    },
  },
  {
    slug: 'profiles',
    config: {
      title: 'Profils',
      service: ProfileService,
      idKey: 'idProfile',
      writeCapability: 'REFERENTIEL_WRITE',
      fields: [
        { key: 'idProfile', label: 'Identifiant', type: 'number', pk: true, required: true },
        { key: 'profile', label: 'Libellé' },
      ],
    },
  },
  {
    slug: 'regle-alertes',
    config: {
      title: "Règles d'alerte",
      service: RegleAlerteService,
      idKey: 'idRegleAlerte',
      writeCapability: 'REFERENTIEL_WRITE',
      fields: [
        // PK technique sans signification métier : masquée de la liste et du formulaire (auto max+1 à la création).
        { key: 'idRegleAlerte', label: 'Identifiant', type: 'number', pk: true, required: true, autoId: true, hideInList: true },
        { key: 'typeJalon', label: 'Type de jalon', required: true },
        { key: 'joursAvant', label: 'Jours avant', type: 'number', required: true },
        { key: 'destinataireProfil', label: 'Profil destinataire', type: 'number' },
        { key: 'actif', label: 'Actif', type: 'boolean' },
      ],
    },
  },
  {
    slug: 'regle-anomalies',
    config: {
      title: "Règles d'anomalie",
      service: RegleAnomalieService,
      idKey: 'idRegleAnomalie',
      writeCapability: 'REFERENTIEL_WRITE',
      fields: [
        // PK technique (codeRegle est la clé métier) : masquée de la liste et du formulaire (auto max+1 à la création).
        { key: 'idRegleAnomalie', label: 'Identifiant', type: 'number', pk: true, required: true, autoId: true, hideInList: true },
        { key: 'codeRegle', label: 'Code règle', required: true },
        { key: 'libelle', label: 'Libellé' },
        { key: 'parametreNum', label: 'Paramètre num.', type: 'number' },
        { key: 'parametreTxt', label: 'Paramètre texte' },
        { key: 'actif', label: 'Actif', type: 'boolean' },
        { key: 'graviteDefaut', label: 'Gravité par défaut' },
      ],
    },
  },
  {
    slug: 'type-dossiers',
    config: {
      title: 'Types de dossier',
      service: TypeDossierService,
      idKey: 'idTypeDossier',
      writeCapability: 'REFERENTIEL_WRITE',
      note: 'Familles de dossier (DDP / DMC / DDM) ; leurs déclinaisons vivent dans « Sous-types de dossier ».',
      fields: [
        { key: 'idTypeDossier', label: 'Identifiant', pk: true, required: true },
        { key: 'libelleType', label: 'Libellé' },
      ],
    },
  },
  {
    slug: 'sous-type-dossiers',
    config: {
      title: 'Sous-types de dossier',
      service: SousTypeDossierService,
      idKey: 'idSousType',
      writeCapability: 'REFERENTIEL_WRITE',
      note: 'Chaque sous-type est rattaché à une famille (DDP / DMC / DDM). Les sous-types DDP (PPM / PPM-AGPM) sont dérivés par le serveur selon les marchés du dossier ; supprimer un sous-type référencé par un dossier est refusé (409).',
      fields: [
        { key: 'idSousType', label: 'Identifiant', pk: true, required: true },
        { key: 'libelleSousType', label: 'Libellé' },
        {
          key: 'idTypeDossier',
          label: 'Famille',
          required: true,
          ref: { service: TypeDossierService, idKey: 'idTypeDossier', labelKeys: ['libelleType'] },
        },
      ],
    },
  },
];

/** Comptes & hiérarchie (écriture ADMINISTRATEUR). */
export const COMPTES: AdminResource[] = [
  {
    slug: 'controleurs',
    config: {
      // Écran contrôleur dédié (fiche + photo inline via multipart) : ce CRUD générique n'est plus routé
      // pour les contrôleurs ; la config sert au libellé du lien de la section « Comptes ».
      title: 'Contrôleurs',
      service: ControleurService,
      idKey: 'imControleur',
      writeCapability: 'COMPTE_WRITE',
      fields: [
        { key: 'imControleur', label: 'Matricule', pk: true, required: true },
        { key: 'nomCont', label: 'Nom' },
        { key: 'prenomsCont', label: 'Prénoms' },
        { key: 'emailCont', label: 'Email' },
        { key: 'telCont', label: 'Téléphone' },
        { key: 'idProfile', label: 'Profil', type: 'number' },
        { key: 'idLocalite', label: 'Localité' },
        { key: 'idSuperieur', label: 'Supérieur (matricule)' },
        { key: 'transversal', label: 'Transversal', type: 'boolean', required: true },
      ],
    },
  },
  {
    slug: 'prmps',
    config: {
      title: 'PRMP',
      service: PrmpService,
      idKey: 'idPrmp',
      writeCapability: 'COMPTE_WRITE',
      rowActions: [
        { label: 'Voir ses entités', path: '/admin/comptes/prmp-entites', queryParam: 'prmp', valueKey: 'idPrmp' },
        { label: 'Pièces jointes', path: '/admin/comptes/prmp-pieces', queryParam: 'prmp', valueKey: 'idPrmp' },
      ],
      fields: [
        { key: 'idPrmp', label: 'Matricule (identifiant)', pk: true, required: true },
        { key: 'nomPrmp', label: 'Nom', required: true },
        { key: 'prenomsPrmp', label: 'Prénoms', required: true },
        { key: 'arreteNomin', label: 'Arrêté de nomination (référence)', required: true },
        { key: 'dateNomin', label: 'Date de nomination', type: 'date', required: true },
        { key: 'cin', label: 'CIN', required: true },
        { key: 'dateCin', label: 'Date du CIN', type: 'date', required: true },
        { key: 'lieuCin', label: 'Lieu du CIN', required: true },
        { key: 'emailPrmp', label: 'Email', required: true },
        { key: 'telPrmp', label: 'Téléphone', required: true },
        // Pas de « Localité » : PrmpDto ne porte plus idLocalite (la PRMP n'a pas de localité propre).
      ],
    },
  },
  {
    slug: 'organigrammes',
    config: {
      title: 'Organigrammes',
      service: OrganigrammeService,
      idKey: 'idOrganigramme',
      writeCapability: 'COMPTE_WRITE',
      filters: [{ param: 'ministere', key: 'idMinistere', label: 'Ministère' }],
      rowActions: [
        { label: 'Voir entités', path: '/admin/referentiels/entite-contracts', queryParam: 'organigramme', valueKey: 'idOrganigramme' },
        { label: 'Arbre des entités', path: '/admin/referentiels/entite-arbre', queryParam: 'organigramme', valueKey: 'idOrganigramme' },
      ],
      fields: [
        { key: 'idOrganigramme', label: 'Identifiant', type: 'number', pk: true, required: true, autoId: true },
        {
          key: 'idMinistere',
          label: 'Ministère',
          type: 'number',
          required: true,
          ref: { service: MinistereService, idKey: 'idMinistere', labelKeys: ['libelleMinistere'] },
        },
        { key: 'libelle', label: 'Libellé' },
        { key: 'version', label: 'Version' },
        { key: 'dateValidation', label: 'Date de validation', type: 'date' },
        { key: 'actif', label: 'Actif', type: 'boolean', required: true },
      ],
    },
  },
  {
    slug: 'prmp-entites',
    config: {
      title: 'Affectations PRMP ⇄ Entité',
      service: PrmpEntiteService,
      idKey: 'idPrmpEntite',
      writeCapability: 'COMPTE_WRITE',
      filters: [
        { param: 'prmp', key: 'idPrmp', label: 'PRMP' },
        { param: 'entite', key: 'idEntiteContract', label: 'Entité' },
      ],
      fields: [
        { key: 'idPrmpEntite', label: 'Identifiant', type: 'number', pk: true, required: true },
        {
          key: 'idPrmp',
          label: 'PRMP',
          required: true,
          ref: { service: PrmpService, idKey: 'idPrmp', labelKeys: ['nomPrmp', 'prenomsPrmp'] },
        },
        {
          key: 'idEntiteContract',
          label: 'Entité contractante',
          type: 'number',
          required: true,
          ref: { service: EntiteContractService, idKey: 'idEntiteContract', labelKeys: ['libelleEntite'] },
        },
        { key: 'dateAffectation', label: "Date d'affectation", type: 'date' },
        { key: 'actif', label: 'Actif', type: 'boolean', required: true },
      ],
    },
  },
];

/** Sécurité : journal d'audit (lecture seule) et sessions utilisateur (ADMINISTRATEUR). */
export const SECURITE: AdminResource[] = [
  {
    slug: 'audit-logs',
    config: {
      title: "Journal d'audit",
      service: AuditLogService,
      idKey: 'idLog',
      readOnly: true,
      fields: [
        { key: 'idLog', label: 'ID', type: 'number' },
        { key: 'dateAction', label: 'Date' },
        { key: 'imActeur', label: 'Acteur' },
        { key: 'nomTable', label: 'Table' },
        { key: 'idEnregistrement', label: 'Enregistrement' },
        { key: 'typeAction', label: 'Action' },
        { key: 'champModifie', label: 'Champ' },
      ],
    },
  },
  {
    slug: 'session-utilisateurs',
    config: {
      title: 'Sessions utilisateur',
      service: SessionUtilisateurService,
      idKey: 'idSession',
      writeCapability: 'COMPTE_WRITE',
      fields: [
        { key: 'idSession', label: 'Session', pk: true, required: true },
        { key: 'imControleur', label: 'Contrôleur' },
        { key: 'dateConnexion', label: 'Connexion' },
        { key: 'dateDeconnexion', label: 'Déconnexion' },
        { key: 'ipAdresse', label: 'IP' },
        { key: 'userAgent', label: 'User-Agent' },
        { key: 'succes', label: 'Succès', type: 'boolean' },
      ],
    },
  },
];
