import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
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

/** Session persistée = réponse de login + date d'expiration calculée (epoch ms). */
interface StoredSession extends LoginResponse {
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

  /** Session courante (null si déconnecté). */
  private readonly session = signal<StoredSession | null>(this.restore());

  // --- État dérivé, lisible partout (templates, guards, services) ---

  /** JWT courant, ou null. */
  readonly token = computed(() => this.session()?.token ?? null);
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
  /** Vrai si un jeton valide et non expiré est présent. */
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

  /** Efface la session (déconnexion locale ; le backend reste sans état avec le JWT). */
  logout(): void {
    this.session.set(null);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  // --- Persistance ---

  private persist(res: LoginResponse, remember: boolean): void {
    const stored: StoredSession = { ...res, expiresAt: Date.now() + res.expiresIn * 1000 };
    this.session.set(stored);
    const primary = remember ? localStorage : sessionStorage;
    const secondary = remember ? sessionStorage : localStorage;
    primary.setItem(STORAGE_KEY, JSON.stringify(stored));
    secondary.removeItem(STORAGE_KEY);
  }

  /** Restaure une session valide depuis le stockage (local ou session) au démarrage. */
  private restore(): StoredSession | null {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const stored = JSON.parse(raw) as StoredSession;
      if (!stored.token || Date.now() >= stored.expiresAt) {
        this.clearStorage();
        return null;
      }
      return stored;
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
