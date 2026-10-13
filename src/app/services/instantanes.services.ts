import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { skipErrorToast } from '../core/errors/api-error';
import { environment } from '../../environments/environment';
import { Instantane } from '../models';

/**
 * ⚠️ Manuel révisé, R4 (V104, 13/10) — `GET /api/dossiers/{id}/instantanes[/{ecran}[/pdf]][?soumission=n]` : les écrans figés à la
 * soumission. **Même garde que `GET /api/dossiers/{id}`** (profils CNM de la localité, Président, Administrateur, PRMP et UGPM du dossier).
 * Sans `soumission`, la dernière. 400 `ECRAN_INCONNU`, 404 sans instantané (écran sans donnée à cet instant, soumission inconnue).
 */
@Injectable({ providedIn: 'root' })
export class InstantaneService {
  private readonly http = inject(HttpClient);

  private url(idDossier: number, suite = ''): string {
    return `${environment.apiUrl}/dossiers/${idDossier}/instantanes${suite}`;
  }

  private params(soumission?: number | null): HttpParams {
    return soumission != null ? new HttpParams().set('soumission', String(soumission)) : new HttpParams();
  }

  liste(idDossier: number): Observable<Instantane[]> {
    return this.http.get<Instantane[]>(this.url(idDossier), { context: skipErrorToast() });
  }

  /** Le JSON figé, tel que l'écran vivant le lisait : son type dépend de l'écran (`Seance`, `Evaluation`, `Attribution`, `Cao`…). */
  lire(idDossier: number, ecran: string, soumission?: number | null): Observable<unknown> {
    return this.http.get<unknown>(this.url(idDossier, `/${ecran}`), { params: this.params(soumission), context: skipErrorToast() });
  }

  /** L'export PDF (`INSTANTANE_<ecran>_<dossier>_s<n>.pdf`), pour l'archivage avec le PV. */
  pdf(idDossier: number, ecran: string, soumission?: number | null): Observable<Blob> {
    return this.http.get(this.url(idDossier, `/${ecran}/pdf`), { params: this.params(soumission), responseType: 'blob', context: skipErrorToast() });
  }
}
