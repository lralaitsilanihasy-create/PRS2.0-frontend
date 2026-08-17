import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  EntitePubliqueDto,
  LoginRequest,
  LoginResponse,
  PrmpPublique,
  RegisterPrmpRequest,
  RegisterPrmpV2Request,
  RegisterResponse,
  RegisterUgpmRequest,
  Role,
  TypeActeur,
} from '../../models';
import { skipErrorToast } from '../errors/api-error';

/**
 * Session persistée = réponse de login SANS LE JETON + date d'expiration calculée (epoch ms).
 * ⚠️ Phase 2 du plan cookie (2026-08-17) : le jeton vit exclusivement dans le cookie HttpOnly
 * `PRS_SESSION` posé par le serveur — il n'est JAMAIS stocké côté front (un XSS ne peut plus le
 * voler). Le stockage ne garde que le profil d'affichage (rôle, localité, nom…) et l'échéance.
 */
interface StoredSession extends Omit<LoginResponse, 'token'> {
  expiresAt: number;
}

const STORAGE_KEY = 'cnm.session';

/**
 * Source unique de vérité de l'identité courante côté frontend.
 *
 * Expose le profil, la localité et la référence de l'utilisateur via des signals,
 * pour piloter l'affichage conditionnel (rôles, périmètre) et les guards.
 *
 * IMPORTANT : il ne s'agit que de confort UX. Le backend applique réellement les
 * droits et renvoie 401/403 ; le frontend ne fait que refléter ces règles.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** Session courante (null si déconnecté). */
  private readonly session = signal<StoredSession | null>(this.restore());

  /** Minuterie de déconnexion automatique à l'échéance du jeton. */
  private expirationTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const s = this.session();
    if (s) {
      this.armerExpiration(s.expiresAt);
    }
  }

  // --- État dérivé, lisible partout (templates, guards, services) ---
  // (Plus de `token()` : le jeton est dans le cookie HttpOnly, invisible au JS — phase 2.)

  /** Profil métier courant, ou null. */
  readonly role = computed<Role | null>(() => this.session()?.role ?? null);
  /** Localité de rattachement ; `null` = toutes localités (Président/Admin). */
  readonly localite = computed<string | null>(() => this.session()?.localite ?? null);
  /** Matricule contrôleur ou identifiant PRMP de l'utilisateur courant. */
  readonly ref = computed<string | null>(() => this.session()?.ref ?? null);
  /** Type d'acteur : CONTROLEUR ou PRMP. */
  readonly typeActeur = computed<TypeActeur | null>(() => this.session()?.typeActeur ?? null);
  /** Login connecté. */
  readonly login = computed<string | null>(() => this.session()?.login ?? null);
  /** « Nom Prénoms » résolu par le serveur au login (toujours renseigné) ; null sur une session antérieure. */
  readonly nomAffichage = computed<string | null>(() => this.session()?.nomAffichage ?? null);
  /** Vrai si une session non expirée est présente (le jeton lui-même vit dans le cookie HttpOnly). */
  readonly isAuthenticated = computed(() => {
    const s = this.session();
    return !!s && Date.now() < s.expiresAt;
  });

  /**
   * `POST /api/auth/login` (route publique). Persiste la session en cas de succès.
   * Le toast d'erreur global est désactivé : la page de login affiche son propre message.
   *
   * @param remember si `true` (défaut), session conservée dans `localStorage`
   *   (persistante entre fermetures du navigateur) ; sinon `sessionStorage` (effacée à la fermeture).
   */
  authenticate(credentials: LoginRequest, remember = true): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, credentials, {
        context: skipErrorToast(),
      })
      .pipe(tap((res) => this.persist(res, remember)));
  }

  /**
   * POST /api/auth/register/prmp (route publique). Crée la fiche PRMP + un compte INACTIF.
   * Ne connecte pas : la connexion reste refusée tant que l'admin n'a pas validé le compte.
   * Toast d'erreur désactivé : la page d'inscription gère 400/409 (doublon) elle-même.
   */
  registerPrmp(body: RegisterPrmpRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${environment.apiUrl}/auth/register/prmp`, body, {
      context: skipErrorToast(),
    });
  }

  /** GET /api/auth/entites (public) : référentiel réduit pour le formulaire d'inscription. */
  entitesPubliques(): Observable<EntitePubliqueDto[]> {
    return this.http.get<EntitePubliqueDto[]>(`${environment.apiUrl}/auth/entites`);
  }

  /**
   * POST /api/auth/register/prmp (multipart v2, public). Crée un compte EN_ATTENTE.
   * `data` = JSON (identité + entités) ; pièces arrete/cin obligatoires, photo optionnelle.
   * Toast désactivé : la page gère 400/409.
   */
  registerPrmpV2(
    data: RegisterPrmpV2Request,
    files: { arrete: File; cin: File; photo?: File | null },
  ): Observable<RegisterResponse> {
    const fd = new FormData();
    fd.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    fd.append('arrete', files.arrete);
    fd.append('cin', files.cin);
    if (files.photo) {
      fd.append('photo', files.photo);
    }
    return this.http.post<RegisterResponse>(`${environment.apiUrl}/auth/register/prmp`, fd, {
      context: skipErrorToast(),
    });
  }

  /** GET /api/auth/prmps (public) : liste réduite des PRMP pour le menu « PRMP de tutelle » (inscription UGPM). */
  prmpsPubliques(): Observable<PrmpPublique[]> {
    return this.http.get<PrmpPublique[]>(`${environment.apiUrl}/auth/prmps`);
  }

  /**
   * POST /api/auth/register/ugpm (multipart, public). Crée un compte UGPM EN_ATTENTE.
   * `data` = JSON (identité + PRMP de tutelle) ; CIN obligatoire, photo optionnelle (image).
   * Toast désactivé : la page gère 400/409.
   */
  registerUgpm(
    data: RegisterUgpmRequest,
    files: { cin: File; photo?: File | null },
  ): Observable<RegisterResponse> {
    const fd = new FormData();
    fd.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    fd.append('cin', files.cin);
    if (files.photo) {
      fd.append('photo', files.photo);
    }
    return this.http.post<RegisterResponse>(`${environment.apiUrl}/auth/register/ugpm`, fd, {
      context: skipErrorToast(),
    });
  }

  /** Vrai si le rôle courant fait partie des rôles autorisés (commodité d'affichage). */
  hasRole(...roles: Role[]): boolean {
    const r = this.role();
    return r !== null && roles.includes(r);
  }

  /**
   * Déconnexion : efface l'état local ET demande au serveur de vider le cookie de session
   * (`POST /api/auth/logout`, route publique — un cookie HttpOnly n'est pas supprimable par le JS).
   * L'appel serveur est en « meilleur effort » : silencieux en cas d'échec (session déjà expirée,
   * réseau coupé), l'état local est purgé dans tous les cas.
   */
  logout(): void {
    clearTimeout(this.expirationTimer);
    this.session.set(null);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    this.http
      .post<void>(`${environment.apiUrl}/auth/logout`, null, { context: skipErrorToast() })
      .subscribe({ error: () => {} });
  }

  // --- Persistance ---

  private persist(res: LoginResponse, remember: boolean): void {
    // ⚠️ Phase 2 : le jeton est ÉCARTÉ avant toute persistance — il vit dans le cookie HttpOnly.
    const { token: _jeton, ...profil } = res;
    const stored: StoredSession = { ...profil, expiresAt: Date.now() + res.expiresIn * 1000 };
    this.session.set(stored);
    const primary = remember ? localStorage : sessionStorage;
    const secondary = remember ? sessionStorage : localStorage;
    primary.setItem(STORAGE_KEY, JSON.stringify(stored));
    secondary.removeItem(STORAGE_KEY);
    this.armerExpiration(stored.expiresAt);
  }

  /**
   * Déconnexion automatique à l'échéance du jeton. Sans cette minuterie,
   * `isAuthenticated` (mémoïsé sur la session seule, `Date.now()` n'étant pas
   * réactif) resterait vrai après expiration, jusqu'au premier 401 serveur.
   */
  private armerExpiration(expiresAt: number): void {
    clearTimeout(this.expirationTimer);
    this.expirationTimer = setTimeout(() => {
      this.logout();
      this.router.navigate(['/login']);
    }, Math.max(0, expiresAt - Date.now()));
  }

  /**
   * Restaure une session valide depuis le stockage (local ou session) au démarrage.
   * Une session d'AVANT la phase 2 contenait le jeton : il est purgé du stockage à la volée
   * (si le cookie correspondant n'existe pas, le premier appel API fera un 401 → reconnexion).
   */
  private restore(): StoredSession | null {
    const depuisLocal = localStorage.getItem(STORAGE_KEY);
    const raw = depuisLocal ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const brut = JSON.parse(raw) as StoredSession & { token?: string | null };
      if (!brut.login || Date.now() >= brut.expiresAt) {
        this.clearStorage();
        return null;
      }
      if ('token' in brut) {
        delete brut.token;
        (depuisLocal !== null ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(brut));
      }
      return brut;
    } catch {
      this.clearStorage();
      return null;
    }
  }

  private clearStorage(): void {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
