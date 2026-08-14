import { Role } from '../../models';

/**
 * Capacités fonctionnelles = verbes métier sensibles, mappés sur les profils
 * **TITULAIRES** de la tâche. Table dérivée des rôles d'écriture/action déclarés
 * dans `api-endpoints.md` et des règles de `regles-gestion.md`.
 *
 * ⚠️ **Délégation ascendante (spec 2026-08-14) — pilotée par les données.**
 * Les droits « un supérieur exécute la tâche d'un subordonné » ne sont PLUS codés
 * en dur ici : ils viennent de `t_delegation_profil` (`/api/delegation-profils`),
 * chargée par `PermissionsService` — retirer/désactiver une paire en base retire
 * les boutons sans changement de code. Une **table explicite** (paires listées),
 * PAS une comparaison de rangs : le Chef de commission est SOUS le Secrétaire
 * dans la hiérarchie mais hérite quand même de ses droits (paire CC → Secrétaire
 * listée) — un modèle « rang ≥ rang requis » casserait ce cas. Et NON transitive :
 * Président → Secrétaire vaut parce que la paire est listée, pas via CC.
 *
 * IMPORTANT : ce n'est qu'un reflet pour le confort UX. Le backend applique
 * réellement le RBAC (garde centrale « titulaire OU délégation »), le périmètre
 * par localité et l'état du dossier (403/409).
 */
export type Capability =
  | 'REFERENTIEL_WRITE' // référentiels (avis, seuils, points de contrôle, …)
  | 'COMPTE_WRITE' // contrôleurs, prmps, organigrammes
  | 'RECEPTION_WRITE' // enregistrement / complétude d'un dossier
  | 'DISPATCH_WRITE' // affectation d'un dossier
  | 'EXAMEN_WRITE' // examen point par point
  | 'PV_WRITE' // rédaction / édition du projet de PV
  | 'PV_SOUMETTRE'
  | 'PV_RETOURNER'
  | 'PV_ACCEPTER'
  | 'PV_SIGNER'
  | 'VERIFICATION_WRITE' // vérification de la levée des observations
  | 'DEMANDE_RETRAIT_CREATE' // PRMP soumet une demande
  | 'DEMANDE_RETRAIT_DECISION' // CC approuve / rejette
  | 'PUBLICATION_MANAGE' // portail de transparence
  | 'KPIS_VIEW' // tableau de bord KPIs
  | 'RAPPORTS_GENERATE'
  | 'STATS_NON_CONFORMITE_VIEW'
  | 'AUDIT_VIEW'
  | 'SESSIONS_VIEW'
  | 'SUGGESTION_MODE';

/**
 * Profils **TITULAIRES** de chaque capacité (whitelist). Les supérieurs (Président, CC)
 * l'obtiennent par DÉLÉGATION (paire active en base), plus par inscription en dur.
 * Cas restés natifs (pas des délégations) :
 * - `DISPATCH_WRITE` : le contrat donne le dispatch au Président ET au CC en propre ;
 * - `PV_SIGNER` : chaque signataire (Membre, CC, Président) signe EN SON NOM.
 */
export const CAPABILITY_ROLES: Record<Capability, readonly Role[]> = {
  REFERENTIEL_WRITE: ['ADMINISTRATEUR'],
  COMPTE_WRITE: ['ADMINISTRATEUR'],
  RECEPTION_WRITE: ['SECRETAIRE'],
  DISPATCH_WRITE: ['PRESIDENT', 'CHEF_COMMISSION'],
  EXAMEN_WRITE: ['MEMBRE'],
  PV_WRITE: ['MEMBRE'],
  PV_SOUMETTRE: ['MEMBRE'],
  PV_RETOURNER: ['CHEF_COMMISSION'],
  PV_ACCEPTER: ['CHEF_COMMISSION'],
  PV_SIGNER: ['MEMBRE', 'CHEF_COMMISSION', 'PRESIDENT'],
  VERIFICATION_WRITE: ['VERIFICATEUR'],
  DEMANDE_RETRAIT_CREATE: ['PRMP'],
  DEMANDE_RETRAIT_DECISION: ['CHEF_COMMISSION'],
  PUBLICATION_MANAGE: ['CHARGE_PUBLICATION'],
  KPIS_VIEW: ['PRESIDENT', 'ADMINISTRATEUR'],
  RAPPORTS_GENERATE: ['PRESIDENT', 'ADMINISTRATEUR'],
  STATS_NON_CONFORMITE_VIEW: ['PRESIDENT', 'CHEF_COMMISSION', 'ADMINISTRATEUR'],
  AUDIT_VIEW: ['ADMINISTRATEUR'],
  SESSIONS_VIEW: ['ADMINISTRATEUR'],
  SUGGESTION_MODE: ['PRMP'],
};

/**
 * Les 9 paires OFFICIELLES de délégation ascendante (delegant → delegue) — **repli optimiste**
 * utilisé uniquement tant que `t_delegation_profil` n'est pas chargée (ou si l'appel échoue),
 * pour éviter un clignotement de boutons à l'ouverture. Une fois la table lue, elle fait seule foi.
 */
export const DELEGATIONS_OPTIMISTES: readonly (readonly [Role, Role])[] = [
  ['PRESIDENT', 'SECRETAIRE'],
  ['PRESIDENT', 'CHEF_COMMISSION'],
  ['PRESIDENT', 'MEMBRE'],
  ['PRESIDENT', 'VERIFICATEUR'],
  ['PRESIDENT', 'ASSISTANT_CONTROLEUR'],
  ['CHEF_COMMISSION', 'SECRETAIRE'],
  ['CHEF_COMMISSION', 'MEMBRE'],
  ['CHEF_COMMISSION', 'VERIFICATEUR'],
  ['CHEF_COMMISSION', 'ASSISTANT_CONTROLEUR'],
];
