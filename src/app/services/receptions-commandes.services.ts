import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import {
  CommissionReception, CommissionReceptionCorps, LivraisonCorps, PvReceptionCorps, ReceptionAMoi, ReceptionCommande, ReceptionsBon,
} from '../models';

/**
 * ⚠️ Lot MS-4 (V127, 16/10) — la réception des commandes côté **interne** (PRMP, UGPM, Commission, Administrateur) et côté
 * **membres de la commission de réception** (comptes K…). Silencieux : chaque écran nomme ses refus.
 */
@Injectable({ providedIn: 'root' })
export class ReceptionsCommandesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/receptions-commandes`;
  private readonly ctx = { context: skipErrorToast() };

  commission(idContrat: number): Observable<CommissionReception> {
    return this.http.get<CommissionReception>(`${environment.apiUrl}/contrats-en-vigueur/${idContrat}/commission-reception`, this.ctx);
  }

  /** PRMP ou UGPM ; 400 avec `erreurs[]` ; 409 `PV_EN_SIGNATURE`. */
  designer(idContrat: number, corps: CommissionReceptionCorps): Observable<CommissionReception> {
    return this.http.put<CommissionReception>(`${environment.apiUrl}/contrats-en-vigueur/${idContrat}/commission-reception`, corps, this.ctx);
  }

  duBon(idBon: number): Observable<ReceptionsBon> {
    return this.http.get<ReceptionsBon>(`${this.base}/bons/${idBon}`, this.ctx);
  }

  /** PRMP ou UGPM ; 409 `BON_ANNULE`, `RECEPTION_EN_COURS`, `DEJA_RECU`. */
  declarerLivraison(idBon: number, corps: LivraisonCorps): Observable<ReceptionsBon> {
    return this.http.post<ReceptionsBon>(`${this.base}/bons/${idBon}/livraison`, corps, this.ctx);
  }

  /** Le président, la garantie écoulée ; 409 `NON_RECU`, `GARANTIE_EN_COURS`, `SANS_GARANTIE`, `RECEPTION_EN_COURS`. */
  ouvrirDefinitive(idBon: number): Observable<ReceptionsBon> {
    return this.http.post<ReceptionsBon>(`${this.base}/bons/${idBon}/definitive`, null, this.ctx);
  }

  miennes(): Observable<ReceptionAMoi[]> {
    return this.http.get<ReceptionAMoi[]>(`${this.base}/miennes`, this.ctx);
  }

  /** Le président seul ; rétabli tant qu'il n'est pas signé (les signatures repartent de zéro). */
  etablirPv(id: number, corps: PvReceptionCorps): Observable<ReceptionCommande> {
    return this.http.post<ReceptionCommande>(`${this.base}/${id}/pv`, corps, this.ctx);
  }

  /** Chaque signataire attendu ; 409 `PV_NON_ETABLI`, `DEJA_SIGNE`. */
  signer(id: number): Observable<ReceptionCommande> {
    return this.http.post<ReceptionCommande>(`${this.base}/${id}/signature`, null, this.ctx);
  }

  pv(id: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    const params = format === 'docx' ? new HttpParams().set('format', 'docx') : new HttpParams();
    return this.http.get(`${this.base}/${id}/pv`, { params, responseType: 'blob', context: skipErrorToast() });
  }
}
