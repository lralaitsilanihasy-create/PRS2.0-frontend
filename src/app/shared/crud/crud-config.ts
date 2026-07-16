import { Type } from '@angular/core';

import { Capability } from '../../core/auth/permissions';
import { CrudService } from '../../services/api/crud.service';

/** Type d'un champ éditable dans le formulaire CRUD générique. */
export type FieldType = 'text' | 'number' | 'boolean' | 'date';

/**
 * Résolution d'une clé étrangère en libellé via un référentiel lié.
 * Le référentiel est chargé une seule fois (pas d'appel par ligne).
 */
export interface FieldRef {
  /** Service du référentiel à charger (ex. OrganigrammeService). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: Type<CrudService<any, string | number>>;
  /** Champ clé primaire dans le DTO du référentiel (ex. 'idOrganigramme'). */
  idKey: string;
  /** Champs composant le libellé (ex. ['libelle'] ou ['nomPrmp', 'prenomsPrmp']). */
  labelKeys: string[];
}

/** Description d'un champ d'une ressource (colonne de table + champ de formulaire). */
export interface FieldConfig {
  /** Nom du champ JSON (clé du DTO). */
  key: string;
  label: string;
  /** Défaut : 'text'. */
  type?: FieldType;
  required?: boolean;
  /** Clé primaire : éditable à la création, verrouillée en modification. */
  pk?: boolean;
  /**
   * PK numérique **auto-générée côté client** (`max(ids existants) + 1`) : le champ est masqué
   * du formulaire mais reste envoyé (le contrat exige une PK assignée par le client au POST).
   * À réserver aux PK numériques sans signification métier (ex. `idEntiteContract`).
   */
  autoId?: boolean;
  /**
   * Rend le champ en **liste déroulante** alimentée par les valeurs distinctes déjà présentes
   * dans la ressource (pas d'énumération figée). Pour les champs libres sans référentiel dédié
   * (ex. `categorieEntite`, `niveauHierarchique`).
   */
  optionsFromData?: boolean;
  /**
   * Si défini, la valeur (un id) est affichée via le libellé du référentiel lié ; en formulaire,
   * le champ devient une **liste déroulante** des enregistrements du référentiel.
   */
  ref?: FieldRef;
  /** Masque la colonne dans la liste (le champ reste dans le formulaire, ex. PK). */
  hideInList?: boolean;
  /**
   * En liste, affiche la valeur d'une AUTRE clé de la ligne (ex. libellé fourni par le serveur)
   * au lieu de `key`. Le formulaire continue d'utiliser `key` (l'id envoyé en écriture).
   */
  displayKey?: string;
}

/**
 * Action de ligne : un lien de navigation affiché par ligne du tableau
 * (ex. « Voir ses marchés » depuis un PPM → liste Marchés filtrée).
 */
export interface RowAction {
  label: string;
  /** Chemin de destination (ex. '/prmp/marches'). */
  path: string;
  /** Nom du paramètre de requête à transmettre (ex. 'ppm'). */
  queryParam: string;
  /** Champ de la ligne servant de valeur (défaut : la clé primaire `idKey`). */
  valueKey?: string;
}

/**
 * Filtre client par paramètre de requête : restreint la liste aux lignes dont
 * le champ `key` égale la valeur du query param `param` (ex. `?organigramme=2`
 * → lignes dont `idOrganigramme === 2`). Plusieurs filtres possibles ; le premier
 * présent dans l'URL s'applique.
 */
export interface CrudFilter {
  /** Nom du query param (ex. 'organigramme'). */
  param: string;
  /** Champ du DTO comparé (ex. 'idOrganigramme'). */
  key: string;
  /** Libellé affiché dans le bandeau (ex. 'Organigramme'). */
  label: string;
}

/**
 * Configuration d'une ressource pour l'écran CRUD générique.
 * Le service (concret, étendant CrudService) est résolu par injection à l'exécution.
 */
export interface CrudResourceConfig {
  /** Titre affiché (ex. « Avis »). */
  title: string;
  /** Classe de service à injecter (ex. AvisService). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: Type<CrudService<any, string | number>>;
  /** Champ clé primaire (utilisé pour update/delete et le suivi de ligne). */
  idKey: string;
  /**
   * Capacité requise pour créer / modifier / supprimer (affichage conditionnel).
   * Absente = ressource éditable par tout utilisateur authentifié (pas de masquage).
   */
  writeCapability?: Capability;
  /** Champs de la ressource, dans l'ordre d'affichage. */
  fields: FieldConfig[];
  /** Lecture seule : masque toute action d'écriture (ex. journal d'audit immuable). */
  readOnly?: boolean;
  /** Liens de navigation par ligne (ex. vers une ressource liée). */
  rowActions?: RowAction[];
  /** Filtres client par query param (ex. afficher les entités d'un organigramme). */
  filters?: CrudFilter[];
  /**
   * Active une **recherche par nom côté serveur** (`GET /api/{resource}/par-nom/{nom}`).
   * À réserver aux ressources qui exposent ce sous-chemin (ex. contrôleurs, PRMP).
   */
  searchByName?: { placeholder?: string };
  /** Note d'aide affichée en tête (ex. précondition de circuit). */
  note?: string;
}
