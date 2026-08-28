import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { Role } from '../../models';
import { DelegationProfilService, ProfileService } from '../../services';
import { AuthService } from './auth.service';
import { Capability, CAPABILITY_ROLES, DELEGATIONS_OPTIMISTES } from './permissions';

/** Reconnaissance des libellés du référentiel `profiles` → code de rôle (tolérante casse/accents). */
const LIBELLE_ROLE: readonly (readonly [RegExp, Role])[] = [
  [/chef.*commission/i, 'CHEF_COMMISSION'],
  [/pr[ée]sident/i, 'PRESIDENT'],
  [/secr[ée]taire/i, 'SECRETAIRE'],
  [/v[ée]rificateur/i, 'VERIFICATEUR'],
  [/assistant/i, 'ASSISTANT_CONTROLEUR'],
  [/publication/i, 'CHARGE_PUBLICATION'],
  [/admin/i, 'ADMINISTRATEUR'],
  [/ugpm/i, 'UGPM'],
  [/prmp/i, 'PRMP'],
  [/membre/i, 'MEMBRE'],
];

/**
 * Évalue les capacités fonctionnelles pour le profil courant.
 * Utilisé par les directives de sécurité UX (`*appCan`, `[appEditableIf]`, badge).
 *
 * ⚠️ **Délégation ascendante (spec 2026-08-14) — pilotée par les données** : `can()` autorise le
 * TITULAIRE de la capacité (`CAPABILITY_ROLES`) **OU** un profil relié au titulaire par une paire
 * **active** de `t_delegation_profil` (`/api/delegation-profils`, chargée une fois par session).
 * Table explicite et non transitive — voir `permissions.ts` (l'exception CC → Secrétaire interdit
 * tout modèle de rang). Retirer/désactiver une paire en base retire les boutons, zéro code.
 * Repli optimiste (`DELEGATIONS_OPTIMISTES`) tant que la table n'est pas chargée. Le backend reste
 * l'autorité (garde centrale « titulaire OU délégation », périmètre, état du dossier).
 *
 * ⚠️ 2026-08-28 — la délégation est de nouveau **AUTOMATIQUE** (demande user). La couche
 * « délégations EXERCÉES » introduite le 15/08 — un interrupteur d'opt-in par profil délégué,
 * éteint par défaut — est retirée : une paire active en base suffit désormais à faire apparaître
 * les tâches du profil délégué. Les deux seuls délégants étant le Président et le Chef de
 * commission (les 9 paires partent d'eux), l'interrupteur n'avait plus de porteur une fois leur
 * cas rendu automatique. Conséquence utile : plus de préférence d'affichage en `localStorage`,
 * donc plus de rémanence d'identité sur poste partagé (constat S9 de l'audit, sans objet).
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly auth = inject(AuthService);
  private readonly delegationService = inject(DelegationProfilService);
  private readonly profileService = inject(ProfileService);

  /** Paires actives « delegant→delegue » (source serveur) ; `null` = pas encore chargées (repli optimiste). */
  private readonly paires = signal<ReadonlySet<string> | null>(null);
  /** Rôle pour lequel la table a été (re)chargée — recharge après un changement de session. */
  private roleCharge: Role | null = null;

  /** Le profil courant peut-il tenter cette capacité ? (confort UX, non contraignant) */
  can(capability: Capability): boolean {
    return this.canForRole(capability, this.auth.role());
  }

  /** Variante explicite pour un rôle donné : TITULAIRE ou relié au titulaire par une paire active. */
  canForRole(capability: Capability, role: Role | null): boolean {
    if (role === null) return false;
    this.assurerChargement();
    const titulaires = CAPABILITY_ROLES[capability];
    return titulaires.includes(role) || titulaires.some((t) => this.paireActive(role, t));
  }

  /** Le profil courant est-il TITULAIRE de la capacité (hors délégation) ? Sert à signaler « par délégation ». */
  estTitulaire(capability: Capability): boolean {
    const role = this.auth.role();
    return role !== null && CAPABILITY_ROLES[capability].includes(role);
  }

  /** La capacité n'est acquise que PAR DÉLÉGATION (permise, mais profil courant non titulaire). */
  parDelegation(capability: Capability): boolean {
    return this.can(capability) && !this.estTitulaire(capability);
  }

  /**
   * Garde générique de la spec : le profil courant peut-il exécuter les tâches du profil `requis` ?
   * `true` si profil courant == requis OU si la paire (courant → requis) est active en base.
   * La délégation est AUTOMATIQUE depuis le 2026-08-28 : plus d'opt-in à activer.
   */
  peutExecuter(requis: Role): boolean {
    const role = this.auth.role();
    if (!role) return false;
    if (role === requis) return true;
    this.assurerChargement();
    return this.paireActive(role, requis);
  }

  // ⚠️ 2026-08-28 — `delegationsDisponibles()` a été retirée avec les interrupteurs : elle
  // n'existait que pour les alimenter et pour formuler le message « activez la délégation »
  // de l'écran des retraits. La délégation étant automatique, personne n'a plus à savoir
  // QUELLES paires existent — seulement si l'on peut agir, ce que répond `peutExecuter`.


  /** La paire (delegant → delegue) est-elle active ? (table serveur, repli optimiste avant chargement). */
  private paireActive(delegant: Role, delegue: Role): boolean {
    const paires = this.paires();
    if (paires) return paires.has(`${delegant}→${delegue}`);
    return DELEGATIONS_OPTIMISTES.some(([a, b]) => a === delegant && b === delegue);
  }

  /** Charge `delegation-profils` + `profiles` une fois par session (relance si le rôle change). */
  private assurerChargement(): void {
    const role = this.auth.role();
    if (!role || this.roleCharge === role) return;
    this.roleCharge = role;
    forkJoin({ delegations: this.delegationService.list(), profiles: this.profileService.list() }).subscribe({
      next: ({ delegations, profiles }) => {
        const roleParId = new Map<number, Role>();
        for (const p of profiles) {
          const r = LIBELLE_ROLE.find(([motif]) => motif.test(p.profile ?? ''))?.[1];
          if (r) roleParId.set(p.idProfile, r);
        }
        const paires = new Set<string>();
        for (const d of delegations) {
          if (!d.actif) continue;
          const delegant = roleParId.get(d.idProfileDelegant);
          const delegue = roleParId.get(d.idProfileDelegue);
          if (delegant && delegue) paires.add(`${delegant}→${delegue}`);
        }
        this.paires.set(paires);
      },
      // Échec de chargement : on RESTE sur le repli optimiste (le backend tranchera par 403).
      error: () => {},
    });
  }
}
