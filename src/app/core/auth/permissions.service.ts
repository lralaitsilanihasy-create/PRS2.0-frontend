import { Injectable, computed, inject, signal } from '@angular/core';
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
 * ⚠️ 2026-08-15 — s'y ajoute la couche « délégations EXERCÉES » (opt-in par interrupteur, un par
 * profil délégué, défaut désactivé) : une tâche déléguée n'est visible que si paire active ET
 * interrupteur activé. Voir `exercees` / `basculerExercice` / `delegationsDisponibles`.
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
  /**
   * ⚠️ Demande user (2026-08-15) — délégations EXERCÉES : les tâches déléguées ne s'affichent que si
   * l'utilisateur a activé l'interrupteur du profil correspondant (opt-in, séparé par profil, défaut
   * TOUT DÉSACTIVÉ). Préférence d'AFFICHAGE locale (localStorage par matricule) : la table en base
   * reste l'autorité sur le permis — l'interrupteur ne peut que restreindre, jamais élargir.
   * `exerce()` LIT le stockage (lecture pure — `peutExecuter` est appelé depuis des `computed`, où
   * écrire un signal est interdit) ; `revisionExercees` rend cette lecture réactive aux bascules.
   */
  private readonly revisionExercees = signal(0);
  /** Repli mémoire si localStorage est indisponible (mode privé…) — la préférence vaut pour la session. */
  private readonly exerceesMemoire = new Map<string, ReadonlySet<Role>>();
  private static cleExercees(ref: string): string {
    return `cnm.delegations-exercees.${ref}`;
  }

  /** Le profil courant peut-il tenter cette capacité ? (confort UX, non contraignant) */
  can(capability: Capability): boolean {
    return this.canForRole(capability, this.auth.role());
  }

  /** Variante explicite pour un rôle donné : TITULAIRE ou relié au titulaire par une paire active ET exercée. */
  canForRole(capability: Capability, role: Role | null): boolean {
    if (role === null) return false;
    this.assurerChargement();
    const titulaires = CAPABILITY_ROLES[capability];
    return titulaires.includes(role) || titulaires.some((t) => this.paireActive(role, t) && this.exerce(t));
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
   * `true` si profil courant == requis OU si la paire (courant → requis) est active en base ET que
   * l'utilisateur EXERCE cette délégation (interrupteur activé — demande user 2026-08-15).
   */
  peutExecuter(requis: Role): boolean {
    const role = this.auth.role();
    if (!role) return false;
    if (role === requis) return true;
    this.assurerChargement();
    return this.paireActive(role, requis) && this.exerce(requis);
  }

  /** Rôles délégués DISPONIBLES pour mon profil (paires actives en base) — pour les interrupteurs. */
  readonly delegationsDisponibles = computed<Role[]>(() => {
    const role = this.auth.role();
    if (!role) return [];
    const paires = this.paires();
    const delegues = paires
      ? [...paires].filter((p) => p.startsWith(`${role}→`)).map((p) => p.split('→')[1] as Role)
      : DELEGATIONS_OPTIMISTES.filter(([a]) => a === role).map(([, b]) => b);
    // Ordre stable : celui de la hiérarchie de la spec.
    const ordre: Role[] = ['SECRETAIRE', 'CHEF_COMMISSION', 'MEMBRE', 'VERIFICATEUR', 'ASSISTANT_CONTROLEUR'];
    return delegues.sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b));
  });

  /** L'utilisateur exerce-t-il actuellement la délégation vers ce profil ? (interrupteur activé). */
  exerce(delegue: Role): boolean {
    this.revisionExercees(); // dépendance réactive : les computed consommateurs suivent les bascules
    const ref = this.auth.ref();
    return !!ref && this.lireExercees(ref).has(delegue);
  }

  /** Bascule l'exercice d'une délégation (persisté par matricule dans localStorage). */
  basculerExercice(delegue: Role): void {
    const ref = this.auth.ref();
    if (!ref) return;
    const suivant = new Set(this.lireExercees(ref));
    if (suivant.has(delegue)) suivant.delete(delegue);
    else suivant.add(delegue);
    this.exerceesMemoire.set(ref, suivant);
    try {
      localStorage.setItem(PermissionsService.cleExercees(ref), JSON.stringify([...suivant]));
    } catch {
      // Stockage indisponible : le repli mémoire ci-dessus porte la préférence pour la session.
    }
    this.revisionExercees.update((n) => n + 1);
  }

  /** Lecture PURE des délégations exercées d'un matricule (localStorage, repli mémoire). */
  private lireExercees(ref: string): ReadonlySet<Role> {
    try {
      const brut = localStorage.getItem(PermissionsService.cleExercees(ref));
      if (brut) return new Set(JSON.parse(brut) as Role[]);
    } catch {
      // Stockage illisible → repli mémoire.
    }
    return this.exerceesMemoire.get(ref) ?? new Set();
  }

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
