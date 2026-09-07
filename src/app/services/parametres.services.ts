import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { ParametreAgpmSeuil } from '../models';

/**
 * Seuil AGPM (montant) au-delà duquel un marché en appel à manifestation d'intérêt (AMI) déclenche
 * l'AGPM — paramètre système ADMINISTRABLE (livré backend ; `PUT` réservé à l'Administrateur).
 * Défaut serveur = 0 → tout marché AMI déclenche tant que le pilote n'a pas relevé le seuil.
 *
 * ⚠️ Bespoke, comme `ParametreActualitesService` : il n'existe pas de ressource CRUD `/api/parametres`,
 * seulement les deux appels réels du contrat — hériter du CRUD générique pointerait vers des chemins
 * inexistants (404 garanti).
 */
@Injectable({ providedIn: 'root' })
export class ParametreAgpmSeuilService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/parametres/agpm-seuil-montant`;

  /** `GET /api/parametres/agpm-seuil-montant`. */
  lire(): Observable<ParametreAgpmSeuil> {
    return this.http.get<ParametreAgpmSeuil>(this.url);
  }

  /** `PUT /api/parametres/agpm-seuil-montant` (ADMINISTRATEUR). */
  definir(seuil: number): Observable<ParametreAgpmSeuil> {
    return this.http.put<ParametreAgpmSeuil>(this.url, { seuil });
  }
}
