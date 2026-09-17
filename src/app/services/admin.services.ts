import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CrudService } from './api/crud.service';
import { AnnuaireFiche, AnnuairePersonne, AuditLog, Page, SessionUtilisateur, TypeActeur } from '../models';

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

/**
 * Annuaire unifié des personnes (`/api/annuaire`, lot 6 — besoins B2 et B3), **ADMINISTRATEUR seul**.
 *
 * Contrôleurs, PRMP et UGPM vivent dans trois tables aux identifiants de longueurs différentes ;
 * cette ressource est leur dénominateur commun, avec le statut du compte joint. Elle ne remplace pas
 * `/api/controleurs`, `/api/prmps` ni `/api/ugpms`, qui gardent leurs règles.
 *
 * ⚠️ **Lecture seule** : le serveur n'expose ni POST, ni PUT, ni DELETE — les gestes de compte
 * restent sur `/api/comptes-auth/**`. Les méthodes d'écriture héritées de `CrudService` ne sont
 * appelées nulle part (même situation que `AuditLogService`).
 */
@Injectable({ providedIn: 'root' })
export class AnnuaireService extends CrudService<AnnuairePersonne, string> {
  protected readonly resource = 'annuaire';

  /**
   * `GET /api/annuaire/{type}/{ref}` — la fiche ouverte à droite de la liste.
   *
   * `400` si le type n'est pas l'un des trois, `404` si la référence est inconnue **dans** cette
   * population — y compris la bonne personne cherchée dans la mauvaise (`/PRMP/CTRMEM`).
   */
  fiche(type: TypeActeur, ref: string): Observable<AnnuaireFiche> {
    return this.http.get<AnnuaireFiche>(`${this.baseUrl}/${type}/${encodeURIComponent(ref)}`);
  }
}
