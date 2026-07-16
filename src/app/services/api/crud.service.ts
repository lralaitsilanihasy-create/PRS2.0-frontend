import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/**
 * Service CRUD générique pour les ressources REST standard de l'API CNM.
 *
 * Toutes les ressources suivent la même convention (cf. api-endpoints.md) :
 * `GET /api/{resource}`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`.
 * Les classes concrètes fixent `resource` et ajoutent leurs méthodes d'action métier
 * (ex. `/soumettre`, `/publier`, `/rectifier`).
 *
 * Rappel : le backend reste l'autorité. Ce service ne fait aucun filtrage par
 * rôle/localité — il transmet ; les listes arrivent déjà filtrées côté serveur.
 *
 * @typeParam T  Type du DTO de la ressource.
 * @typeParam Id Type de la clé primaire (number par défaut ; string pour certains référentiels).
 */
export abstract class CrudService<T, Id extends string | number = number> {
  protected readonly http = inject(HttpClient);

  /** Segment d'URL de la ressource, sans slash (ex. `'dossiers'`, `'pv-examens'`). */
  protected abstract readonly resource: string;

  /** URL complète de la collection (`{apiUrl}/{resource}`). */
  protected get baseUrl(): string {
    return `${environment.apiUrl}/${this.resource}`;
  }

  /** `GET /api/{resource}` — liste (déjà filtrée par le backend si applicable). */
  list(): Observable<T[]> {
    return this.http.get<T[]>(this.baseUrl);
  }

  /** `GET /api/{resource}/{id}`. */
  getById(id: Id): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${id}`);
  }

  /**
   * `GET /api/{resource}/par-nom/{nom}` — recherche partielle par nom (contient, insensible à la casse).
   * À n'utiliser que pour les ressources qui exposent ce sous-chemin (ex. contrôleurs, PRMP).
   */
  searchByName(nom: string): Observable<T[]> {
    return this.http.get<T[]>(`${this.baseUrl}/par-nom/${encodeURIComponent(nom)}`);
  }

  /** `POST /api/{resource}` — la clé primaire doit être présente dans `body` (sinon 400). */
  create(body: T): Observable<T> {
    return this.http.post<T>(this.baseUrl, body);
  }

  /** `PUT /api/{resource}/{id}`. */
  update(id: Id, body: T): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${id}`, body);
  }

  /** `DELETE /api/{resource}/{id}`. */
  delete(id: Id): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
