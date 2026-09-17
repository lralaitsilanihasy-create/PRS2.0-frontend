import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CrudService } from './api/crud.service';
import { environment } from '../../environments/environment';
import {
  AnnuaireFiche,
  AnnuairePersonne,
  AuditLog,
  FiltresSessions,
  Page,
  SessionConnexion,
  TypeActeur,
} from '../models';

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

/**
 * **Journal des connexions** (`/api/sessions`, lot 6 — besoin B4), **ADMINISTRATEUR seul**.
 *
 * ⚠️ **Il ne dérive PAS de `CrudService`, et c'est le fond du besoin.** Il remplace
 * `SessionUtilisateurService`, qui servait le CRUD générique `/api/session-utilisateurs` —
 * **retiré du serveur le 2026-09-17, 404 désormais**. Cette route laissait l'Administrateur forger
 * une trace de connexion, corriger une date ou supprimer la sienne : un journal de preuve
 * modifiable est pire qu'absent (même conclusion que pour `/api/audit-logs` le 2026-08-27).
 * Hériter de `CrudService` remettrait `create`, `update` et `delete` à portée de main pour des
 * verbes que le serveur refuse (405).
 */
@Injectable({ providedIn: 'root' })
export class JournalConnexionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/sessions`;

  /**
   * `GET /api/sessions?page=&size=&acteur=&succes=&du=&au=` — une page de connexions.
   *
   * La pagination et les quatre filtres partent au **serveur** : filtrer la seule page affichée est
   * le défaut M15 de l'audit — on croit chercher dans le journal et l'on ne cherche que dans vingt
   * lignes. Le serveur impose le tri, du plus récent au plus ancien : un journal n'a qu'un ordre de
   * lecture sensé.
   *
   * ⚠️ Un filtre vide est **omis**, jamais envoyé vide : le serveur attend `AAAA-MM-JJ` sur les
   * dates et refuserait (400) une chaîne vide, là où l'absence du paramètre vaut « pas de borne ».
   */
  page(page: number, taille: number, filtres: FiltresSessions = {}): Observable<Page<SessionConnexion>> {
    let params = new HttpParams().set('page', page).set('size', taille);
    if (filtres.acteur) {
      params = params.set('acteur', filtres.acteur);
    }
    if (filtres.succes !== undefined) {
      params = params.set('succes', filtres.succes);
    }
    if (filtres.du) {
      params = params.set('du', filtres.du);
    }
    if (filtres.au) {
      params = params.set('au', filtres.au);
    }
    return this.http.get<Page<SessionConnexion>>(this.baseUrl, { params });
  }
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
