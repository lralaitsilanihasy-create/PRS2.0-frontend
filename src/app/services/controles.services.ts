import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { skipErrorToast } from '../core/errors/api-error';
import { environment } from '../../environments/environment';
import { ControleCorps, ControleResultat } from '../models';

/**
 * ⚠️ Manuel révisé, R5 (V105, 13/10) — `GET /api/dossiers/{id}/controles[?soumission=n]` (garde du dossier : profils CNM, Président,
 * Administrateur, PRMP et UGPM ; la dernière soumission par défaut, vide sans contrôle), `POST …/controles` (Membre attributaire, même
 * garde que `t_examen_detail` ; 400 nominatif, 409 `EXAMEN_ABSENT`), `GET …/controles/pdf[?soumission=n]` (synthèse pour l'archivage).
 */
@Injectable({ providedIn: 'root' })
export class ControleService {
  private readonly http = inject(HttpClient);

  private url(idDossier: number, suite = ''): string {
    return `${environment.apiUrl}/dossiers/${idDossier}/controles${suite}`;
  }

  private params(soumission?: number | null): HttpParams {
    return soumission != null ? new HttpParams().set('soumission', String(soumission)) : new HttpParams();
  }

  liste(idDossier: number, soumission?: number | null): Observable<ControleResultat[]> {
    return this.http.get<ControleResultat[]>(this.url(idDossier), { params: this.params(soumission), context: skipErrorToast() });
  }

  poser(idDossier: number, corps: ControleCorps): Observable<ControleResultat> {
    return this.http.post<ControleResultat>(this.url(idDossier), corps, { context: skipErrorToast() });
  }

  pdf(idDossier: number, soumission?: number | null): Observable<Blob> {
    return this.http.get(this.url(idDossier, '/pdf'), { params: this.params(soumission), responseType: 'blob', context: skipErrorToast() });
  }
}
