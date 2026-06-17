import { Role } from '../../models';

/**
 * Capacités fonctionnelles = verbes métier sensibles, mappés sur les profils
 * autorisés. Table dérivée des rôles d'écriture/action déclarés dans
 * `api-endpoints.md` et des règles de `regles-gestion.md`.
 *
 * Elle centralise l'affichage conditionnel (boutons, formulaires en lecture seule)
 * pour ne pas disperser des `if (role === …)` dans les composants.
 *
 * IMPORTANT : ce n'est qu'un reflet pour le confort UX. Le backend applique
 * réellement le RBAC, le périmètre par localité et les délégations (403/409).
 * Les délégations (Président/CC exerçant Secrétaire/Membre/Vérificateur) sont
 * incluses ici de façon optimiste ; c'est le backend qui valide t_delegation_profil.
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

/** Profils autorisés à tenter chaque capacité (whitelist). */
export const CAPABILITY_ROLES: Record<Capability, readonly Role[]> = {
  REFERENTIEL_WRITE: ['ADMINISTRATEUR'],
  COMPTE_WRITE: ['ADMINISTRATEUR'],
  RECEPTION_WRITE: ['SECRETAIRE', 'CHEF_COMMISSION', 'PRESIDENT'],
  DISPATCH_WRITE: ['PRESIDENT', 'CHEF_COMMISSION'],
  EXAMEN_WRITE: ['MEMBRE', 'CHEF_COMMISSION', 'PRESIDENT'],
  PV_WRITE: ['MEMBRE', 'CHEF_COMMISSION', 'PRESIDENT'],
  PV_SOUMETTRE: ['MEMBRE', 'CHEF_COMMISSION', 'PRESIDENT'],
  PV_RETOURNER: ['CHEF_COMMISSION', 'PRESIDENT'],
  PV_ACCEPTER: ['CHEF_COMMISSION', 'PRESIDENT'],
  PV_SIGNER: ['MEMBRE', 'CHEF_COMMISSION', 'PRESIDENT'],
  VERIFICATION_WRITE: ['VERIFICATEUR', 'CHEF_COMMISSION', 'PRESIDENT'],
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
