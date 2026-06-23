import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { skipErrorToast } from '../core/errors/api-error';
import { CrudService } from './api/crud.service';
import {
  CopieDossier,
  DemandeRetrait,
  Dispatch,
  Dossier,
  DossierResoumissionRequest,
  EchangeDto,
  Examen,
  ExamenDetail,
  Page,
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

  /** `GET /api/dossiers/a-examiner` (Membre/Admin) — ses dossiers DISPATCHE à examiner (scopé serveur). */
  aExaminer(): Observable<Dossier[]> {
    return this.http.get<Dossier[]>(`${this.baseUrl}/a-examiner`);
  }

  /** `GET /api/dossiers/examines` (Membre/Admin) — historique EXAMINE+PV_SIGNE+CLOTURE, paginé. */
  examines(page = 0, size = 10): Observable<Page<Dossier>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<Dossier>>(`${this.baseUrl}/examines`, { params });
  }

  /** `GET /api/dossiers/a-verifier` (Vérificateur/Admin) — dossiers EN_VERIFICATION (scopé localité). */
  aVerifier(): Observable<Dossier[]> {
    return this.http.get<Dossier[]>(`${this.baseUrl}/a-verifier`);
  }

  /** `GET /api/dossiers/verifies` (Vérificateur/Admin) — historique CLOTURE (PV signé), paginé, lecture seule. */
  verifies(page = 0, size = 10): Observable<Page<Dossier>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<Dossier>>(`${this.baseUrl}/verifies`, { params });
  }

  /** `GET /api/dossiers/retirables` (PRMP) — dossiers SOUMIS/PRET_DISPATCH éligibles au retrait. */
  retirables(): Observable<Dossier[]> {
    return this.http.get<Dossier[]>(`${this.baseUrl}/retirables`);
  }

  /** `GET /api/dossiers/en-attente-prmp` (Vérificateur/Admin) — dossiers EN_ATTENTE_DECISION_PRMP, lecture seule. */
  enAttentePrmp(): Observable<Dossier[]> {
    return this.http.get<Dossier[]>(`${this.baseUrl}/en-attente-prmp`);
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

  /**
   * `POST /api/dossiers/{id}/resoumettre` (PRMP propriétaire) — resoumet un dossier rectifié :
   * `EN_ATTENTE_DECISION_PRMP` → `EN_VERIFICATION` (retour au vérificateur). Motif obligatoire (400 sinon),
   * dossier hors état → 409. `skipErrorToast` : 400/409 affichés en clair dans l'écran (messages dédiés).
   */
  resoumettre(id: number, body: DossierResoumissionRequest): Observable<Dossier> {
    return this.http.post<Dossier>(`${this.baseUrl}/${id}/resoumettre`, body, { context: skipErrorToast() });
  }

  /** `GET /api/dossiers/{id}/historique-echanges` (PRMP/Vérificateur/Admin) — fil ASC d'un dossier CLOTURE (403 sinon). */
  historiqueEchanges(id: number): Observable<EchangeDto[]> {
    return this.http.get<EchangeDto[]>(`${this.baseUrl}/${id}/historique-echanges`);
  }

  /**
   * `DELETE /api/dossiers/{id}` (PRMP propriétaire) — supprime un dossier **BROUILLON sans historique**
   * de circuit (204). 409 si historique conservé (traces) ; 403 non-propriétaire ; 404 inexistant.
   * `skipErrorToast` : messages dédiés affichés par l'écran.
   */
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { context: skipErrorToast() });
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

  /**
   * `GET /api/pv-examens/definitifs` — **PV signés uniquement** (lecture seule, scopé localité).
   * Complément de `list()` (`GET /api/pv-examens`) qui ne renvoie plus que les **projets** (statut ≠ SIGNE).
   */
  definitifs(): Observable<PvExamen[]> {
    return this.http.get<PvExamen[]>(`${this.baseUrl}/definitifs`);
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
  // `list()` = worklist PRMP (GET de base, filtré serveur — pas d'endpoint /mes).

  /** `GET /api/demande-retraits/a-valider` — EN_ATTENTE de la localité (CC/Président). */
  aValider(): Observable<DemandeRetrait[]> {
    return this.http.get<DemandeRetrait[]>(`${this.baseUrl}/a-valider`);
  }

  /** `GET /api/demande-retraits/historique` — demandes décidées (CC/Président). */
  historique(): Observable<DemandeRetrait[]> {
    return this.http.get<DemandeRetrait[]>(`${this.baseUrl}/historique`);
  }

  /** `POST /{id}/accepter` — ACCEPTEE + dossier renvoyé en BROUILLON (décidé serveur). */
  accepter(id: number): Observable<DemandeRetrait> {
    return this.http.post<DemandeRetrait>(`${this.baseUrl}/${id}/accepter`, {});
  }

  /** `POST /{id}/refuser` — REFUSEE (motif → obsDecision côté serveur). */
  refuser(id: number, motif: string): Observable<DemandeRetrait> {
    return this.http.post<DemandeRetrait>(`${this.baseUrl}/${id}/refuser`, { motif });
  }

  /**
   * `POST /api/demande-retraits` (PRMP) — crée une demande ; corps réduit à `{ idDossier, motifRetrait }`
   * (identité/date/statut posés serveur). `skipErrorToast` : l'écran affiche ses messages dédiés
   * (400 par champ, 409 « déjà dispatché », 403 non-propriétaire).
   */
  creer(body: DemandeRetrait): Observable<DemandeRetrait> {
    return this.http.post<DemandeRetrait>(this.baseUrl, body, { context: skipErrorToast() });
  }
}
