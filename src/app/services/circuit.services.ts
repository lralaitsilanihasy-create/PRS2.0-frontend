import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CrudService } from './api/crud.service';
import {
  CopieDossier,
  DemandeRetrait,
  Dispatch,
  Dossier,
  Examen,
  ExamenDetail,
  PvActionRequest,
  PvExamen,
  PvNavette,
  Reception,
  ReceptionExiste,
  StatutDossier,
  Verification,
} from '../models';

/**
 * Services du circuit de contrôle. Lecture/écriture filtrées par localité côté
 * backend ; les rôles d'écriture sont appliqués par le serveur (403/409 sinon).
 */

@Injectable({ providedIn: 'root' })
export class DossierService extends CrudService<Dossier> {
  protected readonly resource = 'dossiers';

  /** `GET /api/dossiers[?statut=]` — liste déjà scopée par le backend ; option : filtre statut serveur. */
  override list(statut?: StatutDossier): Observable<Dossier[]> {
    const options = statut ? { params: new HttpParams().set('statut', statut) } : undefined;
    return this.http.get<Dossier[]>(this.baseUrl, options);
  }

  /** `GET /api/dossiers/a-receptionner` (Secrétaire/Admin) — SOUMIS sans réception, filtré serveur (pas de N+1). */
  aReceptionner(): Observable<Dossier[]> {
    return this.http.get<Dossier[]>(`${this.baseUrl}/a-receptionner`);
  }

  /**
   * `POST /api/dossiers/{id}/soumettre` (réservé PRMP, §3.1 Module 03).
   * Soumission officielle : génère `refeDossier`, renseigne `dateRef` si vide,
   * notifie le Secrétaire et le CC de la localité. 403 (hors périmètre PRMP),
   * 409 (déjà soumis), 400 (aucun PPM localisé rattaché).
   */
  soumettre(id: number): Observable<Dossier> {
    return this.http.post<Dossier>(`${this.baseUrl}/${id}/soumettre`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class ReceptionService extends CrudService<Reception> {
  protected readonly resource = 'receptions';

  /** `GET /api/receptions/dossier/{idDossier}/existe` — « déjà réceptionné ? » (léger, avant enregistrement). */
  existePourDossier(idDossier: number): Observable<ReceptionExiste> {
    return this.http.get<ReceptionExiste>(`${this.baseUrl}/dossier/${idDossier}/existe`);
  }
}

@Injectable({ providedIn: 'root' })
export class DispatchService extends CrudService<Dispatch> {
  protected readonly resource = 'dispatchs';
}

@Injectable({ providedIn: 'root' })
export class CopieDossierService extends CrudService<CopieDossier> {
  protected readonly resource = 'copie-dossiers';
}

@Injectable({ providedIn: 'root' })
export class ExamenService extends CrudService<Examen> {
  protected readonly resource = 'examens';
}

@Injectable({ providedIn: 'root' })
export class ExamenDetailService extends CrudService<ExamenDetail> {
  protected readonly resource = 'examen-details';
}

/**
 * PV d'examen + actions de workflow.
 * Cycle : BROUILLON → PROJET_SOUMIS → EN_RECTIFICATION → PROJET_ACCEPTE → SIGNE.
 */
@Injectable({ providedIn: 'root' })
export class PvExamenService extends CrudService<PvExamen> {
  protected readonly resource = 'pv-examens';

  /** Soumettre le projet (BROUILLON|EN_RECTIFICATION → PROJET_SOUMIS). */
  soumettre(id: number, body: PvActionRequest): Observable<PvExamen> {
    return this.http.post<PvExamen>(`${this.baseUrl}/${id}/soumettre`, body);
  }

  /** Retourner pour rectification (PROJET_SOUMIS → EN_RECTIFICATION ; commentaire obligatoire). */
  retourner(id: number, body: PvActionRequest): Observable<PvExamen> {
    return this.http.post<PvExamen>(`${this.baseUrl}/${id}/retourner`, body);
  }

  /** Accepter le projet (PROJET_SOUMIS → PROJET_ACCEPTE). */
  accepter(id: number, body: PvActionRequest): Observable<PvExamen> {
    return this.http.post<PvExamen>(`${this.baseUrl}/${id}/accepter`, body);
  }

  /** Signer (passe à SIGNE quand Membre + (Président ou CC) ont signé ; `role` obligatoire). */
  signer(id: number, body: PvActionRequest): Observable<PvExamen> {
    return this.http.post<PvExamen>(`${this.baseUrl}/${id}/signer`, body);
  }
}

@Injectable({ providedIn: 'root' })
export class PvNavetteService extends CrudService<PvNavette> {
  protected readonly resource = 'pv-navettes';
  // Note : DELETE interdit côté backend (409, traçabilité immuable).
}

@Injectable({ providedIn: 'root' })
export class VerificationService extends CrudService<Verification> {
  protected readonly resource = 'verifications';
}

@Injectable({ providedIn: 'root' })
export class DemandeRetraitService extends CrudService<DemandeRetrait> {
  protected readonly resource = 'demande-retraits';
  // Création : PRMP ; décision (PUT statut APPROUVE/REJETE) : CHEF_COMMISSION.
}
