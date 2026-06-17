import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CrudService } from './api/crud.service';
import {
  DocumentPublic,
  EmpreinteRequest,
  Publication,
  RetraitPublicationRequest,
  VerificationIntegriteResult,
} from '../models';

/**
 * Portail de transparence (§3.7).
 * CRUD + actions réservés à CHARGE_PUBLICATION ; `consulter` ouvert à tout authentifié.
 */
@Injectable({ providedIn: 'root' })
export class PublicationService extends CrudService<Publication> {
  protected readonly resource = 'publications';

  /** EN_ATTENTE → PUBLIE (409 sinon). */
  publier(id: number): Observable<Publication> {
    return this.http.post<Publication>(`${this.baseUrl}/${id}/publier`, null);
  }

  /** PUBLIE → RETIRE (motif obligatoire ; 409 sinon). */
  retirer(id: number, body: RetraitPublicationRequest): Observable<Publication> {
    return this.http.post<Publication>(`${this.baseUrl}/${id}/retirer`, body);
  }

  /** Incrémente le compteur de consultations (tout utilisateur authentifié). */
  consulter(id: number): Observable<Publication> {
    return this.http.post<Publication>(`${this.baseUrl}/${id}/consulter`, null);
  }
}

@Injectable({ providedIn: 'root' })
export class DocumentPublicService extends CrudService<DocumentPublic> {
  protected readonly resource = 'document-publics';

  /** Calcule et enregistre l'empreinte SHA-256 du contenu fourni. */
  empreinte(id: number, body: EmpreinteRequest): Observable<DocumentPublic> {
    return this.http.post<DocumentPublic>(`${this.baseUrl}/${id}/empreinte`, body);
  }

  /** Vérifie l'intégrité : empreinte calculée vs empreinte enregistrée. */
  verifierIntegrite(
    id: number,
    body: EmpreinteRequest,
  ): Observable<VerificationIntegriteResult> {
    return this.http.post<VerificationIntegriteResult>(
      `${this.baseUrl}/${id}/verifier-integrite`,
      body,
    );
  }
}
