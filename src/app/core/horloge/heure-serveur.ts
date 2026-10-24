import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';

import { Horloge } from '../../models';
import { HorlogeService } from '../../services/horloge.services';

/**
 * ⚠️ 24/10 (« heure-serveur », back 1705d00) — l'heure de l'application est celle du SERVEUR, pas celle du poste : depuis l'horloge
 * de recette (ADR-0016), le serveur peut vivre à une autre date, et un poste mal réglé ne doit pas fausser une date proposée.
 * Le module garde l'écart (serveur − poste), calé au démarrage sur `GET /api/horloge` (public) puis relu toutes les dix minutes.
 * `maintenantServeur()` et `aujourdhuiServeur()` sont de simples fonctions, utilisables dans les fonctions pures. ESLint refuse
 * `new Date()` et `Date.now()` ailleurs (exceptions motivées : session, identifiants techniques, brouillon du poste).
 *
 * `maintenant` est servi sans fuseau (`AAAA-MM-JJTHH:MM:SS`), comme toutes les dates de l'API : il se lit comme une heure locale,
 * et se compare aux dates de l'API telles quelles.
 */
let ecartMs = 0;

/** L'heure du serveur, en `Date` du poste (même représentation que les dates de l'API lues par `new Date(chaîne)`). */
export function maintenantServeur(): Date {
  return new Date(Date.now() + ecartMs);
}

/** Le jour d'une date, au format des champs de date (`AAAA-MM-JJ`), à l'heure locale. */
export function jourIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Aujourd'hui, à l'heure du serveur, au format des champs de date. */
export function aujourdhuiServeur(): string {
  return jourIso(maintenantServeur());
}

/** L'heure du poste, quand elle seule a un sens (expiration de la session, identifiants techniques, brouillon local). */
export function maintenantPoste(): number {
  return Date.now();
}

/** Lit `AAAA-MM-JJTHH:MM[:SS]` comme une heure locale ; `null` si illisible. */
export function lireHeureLocale(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
}

/** Cale l'écart sur une réponse de `/api/horloge` reçue à `recueLe` (heure du poste) ; rend l'écart retenu, en ms. */
export function caler(h: Pick<Horloge, 'maintenant'>, recueLe: number = Date.now()): number {
  const serveur = lireHeureLocale(h.maintenant);
  if (serveur) ecartMs = serveur.getTime() - recueLe;
  return ecartMs;
}

/** Pour les tests : remet l'écart à zéro. */
export function reinitialiserEcart(): void {
  ecartMs = 0;
}

const RELECTURE_MS = 10 * 60_000;

@Injectable({ providedIn: 'root' })
export class HeureServeur {
  private readonly http = inject(HorlogeService);
  /** Le serveur est-il sur une horloge de recette (décalée) ? Le bandeau de la coquille s'en sert. */
  readonly decalee = signal(false);
  /** L'heure du serveur, rafraîchie chaque minute (pour l'affichage). */
  readonly maintenant = signal(maintenantServeur());
  private minuterie: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.minuterie && clearInterval(this.minuterie));
  }

  /** Premier calage, au démarrage : n'attend pas plus de trois secondes (sinon, l'heure du poste en attendant). */
  async demarrer(): Promise<void> {
    await this.relire();
    let n = 0;
    this.minuterie = setInterval(() => {
      if (++n % (RELECTURE_MS / 60_000) === 0) void this.relire();
      this.maintenant.set(maintenantServeur());
    }, 60_000);
  }

  async relire(): Promise<void> {
    try {
      const h = await firstValueFrom(this.http.lire().pipe(timeout(3000)));
      caler(h);
      this.decalee.set(!!h.decalee);
      this.maintenant.set(maintenantServeur());
    } catch {
      // Hors d'atteinte : on garde l'écart connu.
    }
  }
}
