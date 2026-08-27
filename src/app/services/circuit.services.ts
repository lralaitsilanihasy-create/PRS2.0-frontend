import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { skipErrorToast } from '../core/errors/api-error';
import { CrudService } from './api/crud.service';
import {
  ActionDossier,
  CopieDossier,
  DemandeRetrait,
  Dispatch,
  Dossier,
  DossierResoumissionRequest,
  EchangeDto,
  Examen,
  ExamenDetail,
  ExamenPiece,
  ExamenSoumissionRequest,
  LettreRenvoi,
  ObservationControle,
  ObservationPv,
  Page,
  PvActionRequest,
  PvExamen,
  PvNavette,
  Reception,
  ReceptionExiste,
  RechercheDossier,
  StatutDossier,
  TransmissionSigmp,
  Verification,
  VerificationPieceDepot,
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

  /**
   * `GET /api/dossiers/recherche?q=` — résout une saisie en dossiers du périmètre, **10 au plus**,
   * les plus récents d'abord. La recherche porte sur la référence du dossier **ou** sur celle de son
   * PPM (la topbar affiche l'une ou l'autre selon l'avancement) ; insensible à la casse, sous-chaîne.
   *
   * ⚠️ Le serveur exige **2 caractères minimum** (400 en deçà) : filtrer côté appelant avant d'appeler
   * (cf. `LONGUEUR_MIN_RECHERCHE`), une saisie plus courte ne discriminant rien de toute façon.
   */
  rechercher(q: string): Observable<RechercheDossier[]> {
    return this.http.get<RechercheDossier[]>(`${this.baseUrl}/recherche`, {
      params: new HttpParams().set('q', q),
    });
  }

  /** `GET /api/dossiers/a-receptionner` (Secrétaire/Admin) — SOUMIS sans réception, filtré serveur (pas de N+1). */
  aReceptionner(): Observable<Dossier[]> {
    return this.http.get<Dossier[]>(`${this.baseUrl}/a-receptionner`);
  }

  /**
   * `GET /api/dossiers/{id}/journal` — journal MÉTIER des actions (spec « Mandats PRMP ») : qui a agi,
   * quand et sous quel mandat (l'opérateur courant peut différer de la PRMP d'attribution, figée).
   */
  journal(idDossier: number): Observable<ActionDossier[]> {
    return this.http.get<ActionDossier[]>(`${this.baseUrl}/${idDossier}/journal`);
  }

  /** `GET /api/dossiers/a-examiner` (Membre/Admin) — ses dossiers DISPATCHE + A_REEXAMINER (réexamen après lettre de renvoi), scopé serveur. */
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

  /** `GET /api/dossiers/retirables` (PRMP) — dossiers éligibles au retrait : statuts **avant PV signé** (SOUMIS, PRET_DISPATCH, DISPATCHE, EXAMINE — source unique serveur). */
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
   * `POST /api/dossiers/{id}/transmettre-complements` (PRMP propriétaire) — ⚠️ spec navette (cas 3,
   * MODIFIÉE 2026-08-02) : compléments de lettre de renvoi transmis, le dossier suspendu
   * (EN_ATTENTE_PIECES) passe A_REEXAMINER — retour dans la file « à examiner » du Membre pour
   * réexamen ; la navette repart à la re-soumission du projet de PV (→ EXAMINE). 409 hors
   * EN_ATTENTE_PIECES ou si aucune pièce n'a été déposée pour la lettre du cycle courant.
   */
  transmettreComplements(id: number): Observable<Dossier> {
    return this.http.post<Dossier>(`${this.baseUrl}/${id}/transmettre-complements`, {});
  }

  /**
   * `POST /api/dossiers/{id}/signaler-pieces-manquantes` (SECRÉTAIRE) — ⚠️ spec recevabilité au dépôt :
   * notifie la PRMP des pièces manquantes / non conformes (liste + observations reprises du contrôle),
   * SOUMIS → EN_ATTENTE_COMPLEMENTS_DEPOT (non enregistrable). Sans archivage.
   */
  signalerPiecesManquantes(id: number): Observable<Dossier> {
    return this.http.post<Dossier>(`${this.baseUrl}/${id}/signaler-pieces-manquantes`, {}, { context: skipErrorToast() });
  }

  /**
   * `POST /api/dossiers/{id}/transmettre-complements-depot` (PRMP propriétaire) — ⚠️ spec recevabilité :
   * compléments de DÉPÔT transmis, EN_ATTENTE_COMPLEMENTS_DEPOT → SOUMIS (le Secrétaire reprend le
   * contrôle, les pièces déjà conformes restent acquises).
   */
  transmettreComplementsDepot(id: number): Observable<Dossier> {
    return this.http.post<Dossier>(`${this.baseUrl}/${id}/transmettre-complements-depot`, {}, { context: skipErrorToast() });
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

  /**
   * `POST /api/dispatchs/{id}/annuler` (Président/CC, CC = sa localité) — retire le dossier au Membre,
   * possible tant que le PV n'est pas signé (dossier DISPATCHE **ou** EXAMINE, 409 au-delà) : purge
   * l'aval du dispatch (examen, détails, projet de PV…, réception conservée) puis le dispatch, et fait
   * revenir le dossier en PRET_DISPATCH (re-dispatchable). Le Membre est notifié côté serveur.
   */
  annuler(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/annuler`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class CopieDossierService extends CrudService<CopieDossier> {
  protected readonly resource = 'copie-dossiers';
}

@Injectable({ providedIn: 'root' })
export class ExamenService extends CrudService<Examen> {
  protected readonly resource = 'examens';

  /**
   * `POST /api/examens/{id}/soumettre` (MEMBRE) — produit toujours le **projet de PV**.
   * ⚠️ Règle modifiée (2026-08-01) — `idAvis`/`idSecretaireSeance` OPTIONNELS : posés à la clôture
   * de navette (`/pv-examens/{id}/accepter`, Président/CC). `skipErrorToast` : messages dédiés.
   */
  soumettre(id: number, body: ExamenSoumissionRequest): Observable<PvExamen> {
    return this.http.post<PvExamen>(`${this.baseUrl}/${id}/soumettre`, body, { context: skipErrorToast() });
  }
}

@Injectable({ providedIn: 'root' })
export class ExamenDetailService extends CrudService<ExamenDetail> {
  protected readonly resource = 'examen-details';
}

/** Examen des **pièces jointes** une par une (`/api/examen-pieces`, ⚠️ règle ajoutée — miroir des examen-details). */
@Injectable({ providedIn: 'root' })
export class ExamenPieceService extends CrudService<ExamenPiece> {
  protected readonly resource = 'examen-pieces';

  /** `GET /api/examen-pieces?examen={idExamen}` — résultats des pièces d'UN examen. */
  byExamen(idExamen: number): Observable<ExamenPiece[]> {
    return this.http.get<ExamenPiece[]>(this.baseUrl, { params: new HttpParams().set('examen', idExamen) });
  }
}

/** Lettres de renvoi (alternative au projet de PV) — cycle BROUILLON → SOUMIS → SIGNE. */
@Injectable({ providedIn: 'root' })
export class LettreRenvoiService extends CrudService<LettreRenvoi> {
  protected readonly resource = 'lettre-renvois';

  /** `GET /api/lettre-renvois` — liste filtrée par profil/localité (MEMBRE→siennes, ASSISTANT→SIGNE localité…). */
  getAll(): Observable<LettreRenvoi[]> {
    return this.list();
  }
  /** `GET /api/lettre-renvois/mes-lettres` (PRMP) — lettres SIGNE de ses dossiers (lecture seule). */
  getMesLettres(): Observable<LettreRenvoi[]> {
    return this.http.get<LettreRenvoi[]>(`${this.baseUrl}/mes-lettres`);
  }
  // `getById(id)` : hérité de CrudService (`GET /api/lettre-renvois/{id}`).
  /**
   * `GET /api/lettre-renvois/{id}/document` — PDF de la lettre signée (dans le périmètre).
   * `skipErrorToast` : l'écran affiche un message dédié (évite le toast générique « Ressource introuvable »).
   */
  document(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/document`, { responseType: 'blob', context: skipErrorToast() });
  }
  /** `POST /api/lettre-renvois` (Président/CC — ⚠️ règle modifiée 2026-08-01) — crée une lettre (BROUILLON). */
  creer(dto: LettreRenvoi): Observable<LettreRenvoi> {
    return this.create(dto);
  }
  /** `PUT /api/lettre-renvois/{id}` (Président/CC, brouillon). */
  modifier(id: number, dto: LettreRenvoi): Observable<LettreRenvoi> {
    return this.update(id, dto);
  }
  /** `POST /api/lettre-renvois/{id}/soumettre` (Président/CC) — BROUILLON → SOUMIS. */
  soumettre(id: number): Observable<LettreRenvoi> {
    return this.http.post<LettreRenvoi>(`${this.baseUrl}/${id}/soumettre`, {});
  }
  /** `POST /api/lettre-renvois/{id}/signer` (CC/Président) — SOUMIS → SIGNE. */
  signer(id: number): Observable<LettreRenvoi> {
    return this.http.post<LettreRenvoi>(`${this.baseUrl}/${id}/signer`, {}, { context: skipErrorToast() });
  }
  /** `POST /api/lettre-renvois/{id}/archiver` (Assistant contrôleur) — ⚠️ spec navette : archive la lettre signée. */
  archiver(id: number): Observable<LettreRenvoi> {
    return this.http.post<LettreRenvoi>(`${this.baseUrl}/${id}/archiver`, {}, { context: skipErrorToast() });
  }
}

/**
 * ⚠️ Spec recevabilité au dépôt (2026-08-02) — contrôle de complétude des pièces par le SECRÉTAIRE
 * (`/api/verification-pieces-depot`, append-only : historisation de chaque décision).
 */
@Injectable({ providedIn: 'root' })
export class VerificationPieceDepotService extends CrudService<VerificationPieceDepot> {
  protected readonly resource = 'verification-pieces-depot';

  /** `GET ?dossier=` — historique ASC des vérifications du dossier (état courant = dernière par type). */
  parDossier(idDossier: number): Observable<VerificationPieceDepot[]> {
    return this.http.get<VerificationPieceDepot[]>(this.baseUrl, {
      params: new HttpParams().set('dossier', idDossier),
    });
  }

  /** `POST` (SECRÉTAIRE) — enregistre une décision (CONFORME / NON_CONFORME / MANQUANTE). */
  decider(v: VerificationPieceDepot): Observable<VerificationPieceDepot> {
    return this.http.post<VerificationPieceDepot>(this.baseUrl, v, { context: skipErrorToast() });
  }
}

/**
 * ⚠️ Spec « circuit des observations FAVR » (2026-08-02) — suivi des observations du PV
 * (`/api/observations-pv`, périmètre FIGÉ) : lecture vérificateur/PRMP propriétaire ; passage
 * VÉRIFICATEUR = décision individuelle (LEVEE | MAINTENUE + précision) pour chaque observation
 * restante. Aucune création possible (rejet backend hors périmètre).
 */
@Injectable({ providedIn: 'root' })
export class ObservationPvService extends CrudService<ObservationPv> {
  protected readonly resource = 'observations-pv';

  /** `GET ?dossier=` — observations du dossier (statut courant + historique par itération). */
  parDossier(idDossier: number): Observable<ObservationPv[]> {
    return this.http.get<ObservationPv[]>(this.baseUrl, {
      params: new HttpParams().set('dossier', idDossier),
    });
  }

  /** `POST /passage` (VÉRIFICATEUR) — statue toutes les observations restantes du périmètre. */
  passage(
    idDossier: number,
    decisions: { idObservationPv: number; decision: 'LEVEE' | 'MAINTENUE'; precision?: string }[],
  ): Observable<ObservationPv[]> {
    return this.http.post<ObservationPv[]>(`${this.baseUrl}/passage`, { idDossier, decisions });
  }
}

/**
 * ⚠️ Spec navette (2026-08-01) — transmissions SIGMP (`/api/sigmp-transmissions`) : le VÉRIFICATEUR
 * transmet le sens de la décision de la Commission (dérivé serveur de l'avis du PV signé) ;
 * enregistrement côté PRS 2.0 en attendant l'API SIGMP réelle.
 */
@Injectable({ providedIn: 'root' })
export class TransmissionSigmpService extends CrudService<TransmissionSigmp> {
  protected readonly resource = 'sigmp-transmissions';

  /** `GET /api/sigmp-transmissions?dossier=` — transmissions d'un dossier. */
  parDossier(idDossier: number): Observable<TransmissionSigmp[]> {
    return this.http.get<TransmissionSigmp[]>(this.baseUrl, {
      params: new HttpParams().set('dossier', idDossier),
    });
  }

  /** `POST /api/sigmp-transmissions` (VERIFICATEUR) — corps `{ idDossier }` ; sens dérivé serveur. */
  transmettre(idDossier: number): Observable<TransmissionSigmp> {
    return this.http.post<TransmissionSigmp>(this.baseUrl, { idDossier }, { context: skipErrorToast() });
  }
}

/** Lignes « AU LIEU DE / LIRE » d'un point de contrôle (écriture MEMBRE). */
@Injectable({ providedIn: 'root' })
export class ObservationControleService extends CrudService<ObservationControle> {
  protected readonly resource = 'observation-controles';

  /** `GET /api/observation-controles?detail={idDetail}` — lignes d'un point de contrôle (tri ASC par ordre). */
  getByDetail(idDetail: number): Observable<ObservationControle[]> {
    return this.http.get<ObservationControle[]>(this.baseUrl, { params: new HttpParams().set('detail', idDetail) });
  }
  /** `POST /api/observation-controles`. */
  creer(dto: ObservationControle): Observable<ObservationControle> {
    return this.create(dto);
  }
  /** `PUT /api/observation-controles/{id}`. */
  modifier(id: number, dto: ObservationControle): Observable<ObservationControle> {
    return this.update(id, dto);
  }
  /** `DELETE /api/observation-controles/{id}`. */
  supprimer(id: number): Observable<void> {
    return this.delete(id);
  }
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

  /**
   * Accepter le projet (PROJET_SOUMIS → PROJET_ACCEPTE) — clôture de navette, Président/CC.
   * ⚠️ Règle ajoutée (2026-08-01) — `idAvis` + `idSecretaireSeance` obligatoires (400 sinon).
   */
  accepter(id: number, body: PvActionRequest): Observable<PvExamen> {
    return this.http.post<PvExamen>(`${this.baseUrl}/${id}/accepter`, body);
  }

  /** Signer (passe à SIGNE quand Membre + (Président ou CC) ont signé ; `role` obligatoire). */
  signer(id: number, body: PvActionRequest): Observable<PvExamen> {
    return this.http.post<PvExamen>(`${this.baseUrl}/${id}/signer`, body);
  }

  /**
   * `POST /api/pv-examens/{id}/archiver` (Assistant contrôleur) — ⚠️ spec navette : archive le PV
   * (après transmission SIGMP) et CLÔT le dossier. 409 si la décision n'est pas encore transmise.
   */
  archiver(id: number): Observable<PvExamen> {
    return this.http.post<PvExamen>(`${this.baseUrl}/${id}/archiver`, {}, { context: skipErrorToast() });
  }

  /**
   * `GET /api/pv-examens/definitifs` — **PV signés uniquement** (lecture seule, scopé localité).
   * Complément de `list()` (`GET /api/pv-examens`) qui ne renvoie plus que les **projets** (statut ≠ SIGNE).
   */
  definitifs(): Observable<PvExamen[]> {
    return this.http.get<PvExamen[]>(`${this.baseUrl}/definitifs`);
  }

  /** `GET /api/pv-examens/{id}/document` — PDF officiel du PV (dans le périmètre localité). */
  document(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/document`, { responseType: 'blob', context: skipErrorToast() });
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

  /**
   * `GET /api/demande-retraits/mes-demandes` (PRMP) — ses demandes ; **marque l'écran consulté**
   * (dateDerniereVue = now) → remet à zéro le compteur `demandesRetraitNouvelles` du menu.
   */
  getMesDemandes(): Observable<DemandeRetrait[]> {
    return this.http.get<DemandeRetrait[]>(`${this.baseUrl}/mes-demandes`);
  }

  /**
   * `POST /api/demande-retraits` (**multipart**, PRMP) — la lettre de demande de retrait datée et
   * signée est **obligatoire** (règle 2026-08-17) : part `data` (JSON) + part `fichier` (PDF).
   * Le serveur valide le PDF par ses magic-bytes et refuse en 400 sinon (la demande n'est pas créée).
   *
   * ⚠️ **Seule voie de création.** L'endpoint n'accepte plus de corps JSON depuis cette règle :
   * le `create()` hérité de `CrudService` échouerait en 415.
   */
  creerAvecLettre(demande: DemandeRetrait, fichier: File): Observable<DemandeRetrait> {
    const fd = new FormData();
    fd.append('data', new Blob([JSON.stringify(demande)], { type: 'application/json' }));
    fd.append('fichier', fichier);
    return this.http.post<DemandeRetrait>(this.baseUrl, fd);
  }

  /**
   * `GET /api/demande-retraits/{id}/document` — la lettre signée (PDF).
   * Accessible à la PRMP demandeuse et au décideur ; **404** si la demande est antérieure à la règle.
   */
  document(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/document`, { responseType: 'blob' });
  }

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
}
