import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { CrudService } from './api/crud.service';
import {
  Anomalie,
  CompteursPrmp,
  Echeance,
  IndicateurCtrl,
  IndicateurPrmp,
  Message,
  MessageEnvoiRequest,
  Notification,
  SnapshotStats,
  TableauBord,
} from '../models';

/** Messagerie interne (confidentialité : expéditeur/destinataire uniquement). */
@Injectable({ providedIn: 'root' })
export class MessageService extends CrudService<Message> {
  protected readonly resource = 'messages';

  /** `POST /api/messages/envoyer` — id et expéditeur générés par le serveur. */
  envoyer(body: MessageEnvoiRequest): Observable<Message> {
    return this.http.post<Message>(`${this.baseUrl}/envoyer`, body);
  }

  /** Messages reçus par l'utilisateur courant. */
  recus(): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.baseUrl}/recus`);
  }

  /** Messages envoyés par l'utilisateur courant. */
  envoyes(): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.baseUrl}/envoyes`);
  }

  /** Marquer un message reçu comme lu (destinataire uniquement). */
  marquerLu(id: number): Observable<Message> {
    return this.http.post<Message>(`${this.baseUrl}/${id}/lu`, null);
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationService extends CrudService<Notification> {
  protected readonly resource = 'notifications';

  /** Mes notifications (scopées à l'utilisateur courant). */
  mes(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.baseUrl}/mes`);
  }
  /** Compteur de non-lues. */
  nonLuesCount(): Observable<{ nonLues: number }> {
    return this.http.get<{ nonLues: number }>(`${this.baseUrl}/mes/non-lues/count`);
  }
  /** Marquer une notification comme lue (destinataire uniquement ; 403 sinon). */
  marquerLu(id: number): Observable<Notification> {
    return this.http.post<Notification>(`${this.baseUrl}/${id}/lu`, null);
  }
  /** Tout marquer lu. */
  lireTout(): Observable<{ traitees: number }> {
    return this.http.post<{ traitees: number }>(`${this.baseUrl}/lire-tout`, null);
  }
}

@Injectable({ providedIn: 'root' })
export class EcheanceService extends CrudService<Echeance> {
  protected readonly resource = 'echeances';
}

@Injectable({ providedIn: 'root' })
export class AnomalieService extends CrudService<Anomalie> {
  protected readonly resource = 'anomalies';
}

@Injectable({ providedIn: 'root' })
export class IndicateurCtrlService extends CrudService<IndicateurCtrl> {
  protected readonly resource = 'indicateur-ctrls';
}

@Injectable({ providedIn: 'root' })
export class IndicateurPrmpService extends CrudService<IndicateurPrmp> {
  protected readonly resource = 'indicateur-prmps';
}

@Injectable({ providedIn: 'root' })
export class SnapshotStatsService extends CrudService<SnapshotStats> {
  protected readonly resource = 'snapshot-statss';
}

/** Tableau de bord / KPIs — lecture seule (PRESIDENT / ADMINISTRATEUR). */
@Injectable({ providedIn: 'root' })
export class KpiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/kpis`;

  tableauBord(): Observable<TableauBord> {
    return this.http.get<TableauBord>(`${this.baseUrl}/tableau-bord`);
  }

  /** `GET /api/kpis/mes-compteurs` (PRMP) — compteurs du menu (filtrés sur la PRMP authentifiée). */
  mesCompteurs(): Observable<CompteursPrmp> {
    return this.http.get<CompteursPrmp>(`${this.baseUrl}/mes-compteurs`);
  }
}

/**
 * Rapports périodiques — réponses binaires (PDF/Excel) ; PRESIDENT / ADMINISTRATEUR.
 * `from`/`to` (yyyy-MM-dd) facultatifs bornent la période sur DATE_REF.
 */
@Injectable({ providedIn: 'root' })
export class RapportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/rapports`;

  /** PDF des dossiers traités. */
  dossiersPdf(from?: string, to?: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/dossiers`, {
      params: this.periode(from, to),
      responseType: 'blob',
    });
  }

  /** Export Excel (.xlsx) des dossiers traités. */
  dossiersExcel(from?: string, to?: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/dossiers/excel`, {
      params: this.periode(from, to),
      responseType: 'blob',
    });
  }

  private periode(from?: string, to?: string): HttpParams {
    let params = new HttpParams();
    if (from) {
      params = params.set('from', from);
    }
    if (to) {
      params = params.set('to', to);
    }
    return params;
  }
}
