import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ChangePasswordRequest,
  CompteAuthResume,
  MessageResponse,
  ReinitMotDePasseRequest,
} from '../models';

/**
 * Gestion / validation des comptes de connexion (réservé ADMINISTRATEUR).
 * Sert notamment à valider les inscriptions PRMP en attente. Le mot de passe
 * n'est jamais exposé par l'API.
 */
@Injectable({ providedIn: 'root' })
export class CompteAuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/comptes-auth`;

  /** Comptes inactifs en attente de validation (ex. inscriptions PRMP). */
  enAttente(): Observable<CompteAuthResume[]> {
    return this.http.get<CompteAuthResume[]>(`${this.baseUrl}/en-attente`);
  }

  /** Active un compte (autorise la connexion). */
  activer(login: string): Observable<CompteAuthResume> {
    return this.http.post<CompteAuthResume>(
      `${this.baseUrl}/${encodeURIComponent(login)}/activer`,
      null,
    );
  }

  /** Désactive un compte (bloque la connexion). */
  desactiver(login: string): Observable<CompteAuthResume> {
    return this.http.post<CompteAuthResume>(
      `${this.baseUrl}/${encodeURIComponent(login)}/desactiver`,
      null,
    );
  }

  /** Impose un nouveau mot de passe (ex. mot de passe oublié). */
  reinitialiserMotDePasse(
    login: string,
    body: ReinitMotDePasseRequest,
  ): Observable<CompteAuthResume> {
    return this.http.post<CompteAuthResume>(
      `${this.baseUrl}/${encodeURIComponent(login)}/reinitialiser-mot-de-passe`,
      body,
    );
  }
}

/** Actions de l'utilisateur authentifié sur son propre compte (tout rôle). */
@Injectable({ providedIn: 'root' })
export class MonCompteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/mon-compte`;

  /** Change le mot de passe (vérifie l'ancien ; 400 si incorrect ou identique au nouveau). */
  changerMotDePasse(body: ChangePasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/changer-mot-de-passe`, body);
  }
}
