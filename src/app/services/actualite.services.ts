import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { skipErrorToast } from '../core/errors/api-error';
import { environment } from '../../environments/environment';
import { Actualite, ActualiteImage, ParametreActualites } from '../models/actualite.model';
import { CrudService } from './api/crud.service';

/**
 * Actualités affichées à l'ouverture de session (`docs/spec-actualites.md`).
 *
 * ⚠️ Aucun filtrage ici : `mesActualites()` reçoit du serveur **exactement** ce que l'utilisateur
 * doit voir (profil lu dans la session, statut, fenêtre de dates, interrupteur global). Le front
 * n'a rien à masquer lui-même — masquer à l'écran n'autorise rien.
 */
@Injectable({ providedIn: 'root' })
export class ActualiteService extends CrudService<Actualite> {
  protected readonly resource = 'actualites';

  /**
   * `GET /api/actualites/mes-actualites` — ce que l'utilisateur connecté doit voir, rien de plus.
   *
   * ⚠️ `skipErrorToast` : cet appel part à **chaque** ouverture de session. Un incident serveur —
   * ou simplement un endpoint pas encore déployé — ne doit pas accueillir l'utilisateur par une
   * boîte d'erreur. L'absence d'actualités se traduit par un écran normal, sans modal.
   */
  mesActualites(): Observable<Actualite[]> {
    return this.http.get<Actualite[]>(`${this.baseUrl}/mes-actualites`, { context: skipErrorToast() });
  }

  /**
   * `POST /api/actualites/{id}/images` — JPEG uniquement, 10 Mo au plus (413 au-delà) ; le serveur
   * valide par magic-bytes, jamais sur le type déclaré, puis redimensionne avant stockage.
   */
  ajouterImage(id: number, fichier: File): Observable<ActualiteImage> {
    const corps = new FormData();
    corps.append('fichier', fichier);
    return this.http.post<ActualiteImage>(`${this.baseUrl}/${id}/images`, corps);
  }

  /** `DELETE /api/actualites/{id}/images/{idImage}`. */
  supprimerImage(id: number, idImage: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/images/${idImage}`);
  }

  /**
   * `GET /api/actualites/{id}/images/{idImage}` — binaire.
   * ⚠️ À afficher via `urlBlobSure()` (`core/securite/fichiers-surs`) : jamais d'URL d'objet brute.
   */
  image(id: number, idImage: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/images/${idImage}`, { responseType: 'blob' });
  }
}

/**
 * Interrupteur global des actualités — coupe la fonctionnalité pour tous, d'un seul geste.
 *
 * ⚠️ **N'hérite délibérément pas de `CrudService`** : il n'existe pas de ressource `/api/parametres`.
 * Le service n'expose que les deux appels réels du contrat (`/parametres/actualites-actives`) ;
 * hériter du CRUD générique aurait offert `list()`, `getById()`, `create()`… pointant vers des
 * chemins inexistants côté serveur — un 404 garanti au premier appelant qui s'y fierait.
 */
@Injectable({ providedIn: 'root' })
export class ParametreActualitesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/parametres/actualites-actives`;

  /** `GET /api/parametres/actualites-actives`. */
  lire(): Observable<ParametreActualites> {
    return this.http.get<ParametreActualites>(this.url, { context: skipErrorToast() });
  }

  /** `PUT /api/parametres/actualites-actives` (ADMINISTRATEUR). */
  definir(actif: boolean): Observable<ParametreActualites> {
    return this.http.put<ParametreActualites>(this.url, { actif });
  }
}
