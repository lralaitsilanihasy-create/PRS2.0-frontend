import { HttpClient, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';

import { skipErrorToast } from '../../core/errors/api-error';
import { environment } from '../../../environments/environment';
import { Page } from '../../models/common.model';

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

  /**
   * Même chose, mais **sans boîte d'erreur** si l'appel échoue.
   *
   * ⚠️ À réserver aux lectures d'**enrichissement** : celles dont l'échec n'empêche pas l'écran de
   * fonctionner et dont le refus est ATTENDU pour certains profils. Sans cela, un `catchError` ne
   * suffit pas — l'intercepteur affiche l'erreur avant lui. Cas réel : la fiche UGPM du détail d'un
   * PPM, réservée à l'ADMINISTRATEUR, faisait surgir « Accès refusé » à chaque ouverture du modal
   * par une PRMP alors que le bloc était simplement destiné à rester masqué.
   */
  listeSilencieuse(): Observable<T[]> {
    return this.http.get<T[]>(this.baseUrl, { context: skipErrorToast() });
  }

  /**
   * `GET /api/{resource}?page=&size=` — page de la liste (enveloppe Spring `Page`).
   * Disponible sur les grandes listes (dossiers, ppms, marches — livraison backend c16407f) ;
   * sans le paramètre `page`, le même endpoint continue de renvoyer la liste plate.
   * Les filtres habituels de la ressource (ex. `statut=`) se combinent via `filtres`.
   */
  listePage(page: number, size: number, filtres?: Record<string, string>): Observable<Page<T>> {
    let params = new HttpParams().set('page', page).set('size', size);
    for (const [cle, valeur] of Object.entries(filtres ?? {})) {
      params = params.set(cle, valeur);
    }
    return this.http.get<Page<T>>(this.baseUrl, { params });
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
