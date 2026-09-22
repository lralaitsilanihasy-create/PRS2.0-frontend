import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, finalize, shareReplay, tap } from 'rxjs/operators';

import { Interim, MesInterims, Role } from '../../models';
import { InterimService } from '../../services/comptes.services';
import { AuthService } from '../auth/auth.service';

const VIDE: MesInterims = { exerces: [], subi: null, aVenir: [] };

/**
 * Intérim DÉSIGNÉ (demande `docs/demande-backend-2026-09-21-gestion-interim.md`, backend `e867082`,
 * ADR-0008) — état de session : **qui je supplée** (`exerces`, intérims ACTIFS où je suis l'intérimaire),
 * **qui me supplée** (`subi`, l'intérim ACTIF où je suis le titulaire) et ce qui vient (`aVenir`).
 * Alimenté par `GET /api/interims/mes`, **le signal du front** : bannière de la coquille, rubrique de menu
 * « Exercé par intérim », droits étendus de `PermissionsService`, identités du circuit (« le dispatcheur
 * ou son intérimaire »). Le backend reste l'autorité : il relit le contexte d'intérim à CHAQUE requête
 * (403 / 409 nominatifs) ; ici on ne fait que montrer et proposer.
 *
 * Seuls le Président, le Chef de commission et le Membre sont concernés (lot 1) : pour les autres
 * profils, l'état est vide sans requête. `InterimService` est résolu paresseusement (Injector) pour
 * que le store se construise sans `HttpClient` — les specs de `PermissionsService` le stubbent ainsi.
 */
@Injectable({ providedIn: 'root' })
export class InterimStore {
  /** Profils qui peuvent être titulaire ou intérimaire dans ce lot. */
  static readonly ROLES_CONCERNES: readonly Role[] = ['PRESIDENT', 'CHEF_COMMISSION', 'MEMBRE'];

  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  /** Intérims ACTIFS que j'exerce (je suis l'intérimaire). */
  readonly exerces = signal<readonly Interim[]>([]);
  /** Intérim ACTIF que je subis (je suis le titulaire absent) ; `null` sinon. */
  readonly subi = signal<Interim | null>(null);
  /** Intérims A_VENIR où je suis titulaire ou intérimaire. */
  readonly aVenir = signal<readonly Interim[]>([]);
  /** Matricule pour lequel l'état a été chargé ; `null` tant qu'aucune réponse n'est arrivée. */
  readonly chargePour = signal<string | null>(null);

  /** Je supplée au moins quelqu'un aujourd'hui. */
  readonly suppleeQuelquUn = computed(() => this.exerces().length > 0);

  private enCours: Observable<MesInterims> | null = null;

  /** (Re)lit `interims/mes` — à l'ouverture et à chaque navigation, comme la vacance PRMP. Silencieux. */
  verifier(): void {
    this.charger().subscribe({ error: () => undefined });
  }

  /**
   * État pour la session courante, chargé UNE fois (garde de route, permissions) : renvoie l'état connu
   * s'il vaut pour ce matricule, sinon le charge. Ne lève jamais : en échec, l'état courant est rendu.
   */
  assurer(): Observable<MesInterims> {
    const ref = this.auth.ref();
    if (ref && this.chargePour() === ref) return of(this.etat());
    return this.charger();
  }

  /** Charge `interims/mes` pour la session (appel partagé tant qu'il est en cours). */
  charger(): Observable<MesInterims> {
    const role = this.auth.role();
    const ref = this.auth.ref();
    if (!role || !ref || !InterimStore.ROLES_CONCERNES.includes(role)) {
      this.appliquer(VIDE, ref);
      return of(VIDE);
    }
    if (this.enCours) return this.enCours;
    const service = this.injector.get(InterimService);
    this.enCours = service.mes().pipe(
      tap((m) => this.appliquer(m, ref)),
      // Échec (réseau, backend antérieur) : on garde l'état connu — les gardes serveur tranchent.
      catchError(() => of(this.etat())),
      finalize(() => (this.enCours = null)),
      shareReplay(1),
    );
    return this.enCours;
  }

  /** L'intérim ACTIF par lequel je supplée ce matricule, `null` si je ne le supplée pas. */
  titulaireSupplee(imTitulaire: string | null | undefined): Interim | null {
    if (!imTitulaire) return null;
    return this.exerces().find((i) => i.imTitulaire === imTitulaire) ?? null;
  }

  /** Nom d'un titulaire que je supplée (sinon le matricule tel quel — l'annuaire n'est pas ici). */
  nomTitulaire(imTitulaire: string): string {
    return this.titulaireSupplee(imTitulaire)?.nomTitulaire || imTitulaire;
  }

  /** Efface l'état (déconnexion, changement de session). */
  reinitialiser(): void {
    this.appliquer(VIDE, null);
  }

  private etat(): MesInterims {
    return { exerces: [...this.exerces()], subi: this.subi(), aVenir: [...this.aVenir()] };
  }

  private appliquer(m: MesInterims, ref: string | null): void {
    this.exerces.set(m.exerces ?? []);
    this.subi.set(m.subi ?? null);
    this.aVenir.set(m.aVenir ?? []);
    this.chargePour.set(ref);
  }
}
