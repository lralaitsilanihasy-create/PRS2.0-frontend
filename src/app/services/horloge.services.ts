import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import { Horloge } from '../models';

/** ⚠️ 24/10 (« heure-serveur ») — `GET /api/horloge` (public, depuis le 04/10) : l'heure du serveur, horloge de recette comprise. */
@Injectable({ providedIn: 'root' })
export class HorlogeService {
  private readonly http = inject(HttpClient);

  lire(): Observable<Horloge> {
    return this.http.get<Horloge>(`${environment.apiUrl}/horloge`, { context: skipErrorToast() });
  }
}
