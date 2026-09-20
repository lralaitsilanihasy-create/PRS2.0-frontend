import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { EcartementRequest, ResumePreControle, Signalement } from '../models';

/**
 * Pré-contrôle du PPM (assistant IA, lot 3) — `/api/pre-controle`.
 *
 * Ouvert aux deux côtés du circuit : la PRMP (et l'agent de son UGPM) sur ses propres plans, les
 * contrôleurs sur ceux de leur commission. **Le serveur tient le périmètre** : ce service transmet, il
 * ne filtre rien — un plan hors périmètre répond 403.
 *
 * ⚠️ Aucun appel ici ne bloque quoi que ce soit : le pré-contrôle signale. La soumission d'un plan ne
 * dépend d'aucune de ces réponses.
 */
@Injectable({ providedIn: 'root' })
export class PreControleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/pre-controle`;

  /** `GET /ppm/{idPpm}` — relit les signalements du plan, sans relancer les règles. */
  lire(idPpm: number): Observable<ResumePreControle> {
    return this.http.get<ResumePreControle>(`${this.baseUrl}/ppm/${idPpm}`);
  }

  /**
   * `POST /ppm/{idPpm}/verifier` — « Vérifier mon PPM ». Sur un bouton explicite, jamais à chaque
   * frappe. Idempotent : deux vérifications de suite ne créent aucun signalement de plus et n'effacent
   * aucun écartement motivé.
   */
  verifier(idPpm: number): Observable<ResumePreControle> {
    return this.http.post<ResumePreControle>(`${this.baseUrl}/ppm/${idPpm}/verifier`, {});
  }

  /**
   * `POST /signalements/{id}/ecarter` — écarte un signalement avec son motif.
   *
   * Le corps porte `avertissementLu` : le serveur refuse (400) si l'écran n'a pas confirmé avoir montré
   * que l'écartement et son motif seront lus de l'autre côté. 409 si le signalement est déjà écarté
   * (le motif du premier auteur ne s'écrase pas) ou si le plan est soumis (écartements figés).
   */
  ecarter(idSignalement: number, corps: EcartementRequest): Observable<Signalement> {
    return this.http.post<Signalement>(`${this.baseUrl}/signalements/${idSignalement}/ecarter`, corps);
  }

  /**
   * `POST /signalements/{id}/reprendre` — reprend **son propre** écartement, tant que le plan n'est pas
   * soumis. 403 si l'écartement est celui d'un autre, 409 s'il est figé.
   */
  reprendre(idSignalement: number): Observable<Signalement> {
    return this.http.post<Signalement>(`${this.baseUrl}/signalements/${idSignalement}/reprendre`, {});
  }
}
