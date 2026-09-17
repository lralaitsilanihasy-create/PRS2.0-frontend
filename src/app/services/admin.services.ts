import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CrudService } from './api/crud.service';
import { AuditLog, Page, SessionUtilisateur } from '../models';

/** Sécurité & administration (§3.8) : réservé à ADMINISTRATEUR (lecture comprise). */

@Injectable({ providedIn: 'root' })
export class AuditLogService extends CrudService<AuditLog> {
  protected readonly resource = 'audit-logs';
  // Journal immuable : DELETE interdit côté backend (409).

  /**
   * `GET /api/audit-logs?page=0&size=&table=…&table=…` — les dernières écritures sur **plusieurs**
   * ressources, en **un seul appel** (livraison backend B5 du 2026-09-17, `table` en liste).
   *
   * ⚠️ Le paramètre est **répété** plutôt que joint par des virgules : les deux formes sont
   * acceptées, mais la répétition ne dépend d'aucune règle d'échappement de l'encodeur d'URL.
   *
   * ⚠️ `table` compare le **nom de ressource de l'API** (`delais-standards`, `points-ctrls`…), pas
   * le nom de la table SQL : `AuditInterceptor` écrit dans `NOM_TABLE` le premier segment du chemin
   * appelé. Passer `t_delai_standard` ne ramènerait jamais rien.
   */
  dernieresEcritures(ressources: readonly string[], taille: number): Observable<Page<AuditLog>> {
    let params = new HttpParams().set('page', 0).set('size', taille);
    for (const ressource of ressources) {
      params = params.append('table', ressource);
    }
    return this.http.get<Page<AuditLog>>(this.baseUrl, { params });
  }
}

@Injectable({ providedIn: 'root' })
export class SessionUtilisateurService extends CrudService<SessionUtilisateur, string> {
  protected readonly resource = 'session-utilisateurs';
}
