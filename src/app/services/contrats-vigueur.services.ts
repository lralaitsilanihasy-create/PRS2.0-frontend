import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import { ContratVigueur, ReconductionCorps } from '../models';

/**
 * ⚠️ Lot MS-1 (V124, 16/10) — les contrats en vigueur (`/api/contrats-en-vigueur`) : la PRMP et l'UGPM voient ceux de leurs
 * procédures, la Commission et l'Administrateur tous. Silencieux : l'écran nomme ses refus.
 */
@Injectable({ providedIn: 'root' })
export class ContratsVigueurService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/contrats-en-vigueur`;
  private readonly ctx = { context: skipErrorToast() };

  lister(): Observable<ContratVigueur[]> {
    return this.http.get<ContratVigueur[]>(this.base, this.ctx);
  }

  lire(id: number): Observable<ContratVigueur> {
    return this.http.get<ContratVigueur>(`${this.base}/${id}`, this.ctx);
  }

  /**
   * La décision écrite de la PRMP, une par période. 400 `DECISION_INVALIDE`, `DECISION_OBLIGATOIRE`, `DATE_INVALIDE` ; 409
   * `CONTRAT_ECHU`, `NON_RECONDUCTIBLE`, `RECONDUCTIONS_EPUISEES`, `DUREE_MAX_ATTEINTE` (`details.finMaximale`), `DEJA_DECIDE`.
   */
  reconduction(id: number, corps: ReconductionCorps): Observable<ContratVigueur> {
    return this.http.post<ContratVigueur>(`${this.base}/${id}/reconduction`, corps, this.ctx);
  }
}
