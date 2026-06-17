import { Injectable } from '@angular/core';

import { CrudService } from './api/crud.service';
import { AuditLog, SessionUtilisateur } from '../models';

/** Sécurité & administration (§3.8) : réservé à ADMINISTRATEUR (lecture comprise). */

@Injectable({ providedIn: 'root' })
export class AuditLogService extends CrudService<AuditLog> {
  protected readonly resource = 'audit-logs';
  // Journal immuable : DELETE interdit côté backend (409).
}

@Injectable({ providedIn: 'root' })
export class SessionUtilisateurService extends CrudService<SessionUtilisateur, string> {
  protected readonly resource = 'session-utilisateurs';
}
