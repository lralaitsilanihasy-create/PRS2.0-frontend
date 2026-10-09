import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import { ActeGestion, DemandeActe, MarcheActes } from '../models';

/**
 * ⚠️ Manuel de contrôle a priori, tranche M5a (V98) — les actes de gestion contractuelle d'un marché. Tout est silencieux : les
 * refus (plafond des avenants, réception, solde, marché non contrôlé…) sont nommés par l'écran.
 */
@Injectable({ providedIn: 'root' })
export class ActesGestionService {
  private readonly http = inject(HttpClient);

  /** `GET /api/dossiers/{idMarche}/actes-gestion` — 400 `PAS_UN_MARCHE` hors dossier de marché. */
  marche(idMarche: number): Observable<MarcheActes> {
    return this.http.get<MarcheActes>(`${environment.apiUrl}/dossiers/${idMarche}/actes-gestion`, { context: skipErrorToast() });
  }

  /** `POST /api/dossiers/{idMarche}/actes-gestion` → 201 : l'acte et son dossier DGC en brouillon (PRMP ou UGPM du marché). */
  deposer(idMarche: number, demande: DemandeActe): Observable<ActeGestion> {
    return this.http.post<ActeGestion>(`${environment.apiUrl}/dossiers/${idMarche}/actes-gestion`, demande, { context: skipErrorToast() });
  }

  /** `GET /api/actes-gestion/{idDossier}` — l'acte d'un dossier DGC. */
  lire(idDossier: number): Observable<ActeGestion> {
    return this.http.get<ActeGestion>(`${environment.apiUrl}/actes-gestion/${idDossier}`, { context: skipErrorToast() });
  }

  /** `PUT /api/actes-gestion/{idDossier}` — les déclarations remplacées ; brouillon seulement (409 `DOSSIER_NON_BROUILLON`). */
  modifier(idDossier: number, demande: DemandeActe): Observable<ActeGestion> {
    return this.http.put<ActeGestion>(`${environment.apiUrl}/actes-gestion/${idDossier}`, demande, { context: skipErrorToast() });
  }
}
