import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import { InscriptionEnAttente } from '../models';

/**
 * Instruction des inscriptions **PRMP et UGPM** en attente (`/api/inscriptions`, ADMINISTRATEUR).
 * `valider` active le compte (PRMP : rattache aussi les entités disponibles ; UGPM : simple activation).
 * `refuser` passe le compte à REFUSE. Le téléchargement d'une pièce est réservé Admin/propriétaire.
 */
@Injectable({ providedIn: 'root' })
export class InscriptionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/inscriptions`;

  /** `GET /api/inscriptions/en-attente` — inscriptions PRMP + UGPM au statut EN_ATTENTE. */
  enAttente(): Observable<InscriptionEnAttente[]> {
    return this.http.get<InscriptionEnAttente[]>(`${this.baseUrl}/en-attente`);
  }

  /** `POST /api/inscriptions/{login}/valider` — active le compte (corps optionnel non requis ici). */
  valider(login: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${encodeURIComponent(login)}/valider`, {});
  }

  /** `POST /api/inscriptions/{login}/refuser` — refuse l'inscription (motif obligatoire). */
  refuser(login: string, motif: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${encodeURIComponent(login)}/refuser`, { motif });
  }

  /** `GET /api/inscriptions/{login}/pieces/{type}` — télécharge une pièce (404 si absente ; toast désactivé). */
  downloadPiece(login: string, type: 'ARRETE_NOMIN' | 'CIN' | 'PHOTO'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${encodeURIComponent(login)}/pieces/${type}`, {
      responseType: 'blob',
      context: skipErrorToast(),
    });
  }
}
