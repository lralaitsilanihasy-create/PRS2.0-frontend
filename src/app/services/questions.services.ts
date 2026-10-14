import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import { QuestionCandidat, QuestionsProcedure } from '../models';

/**
 * ⚠️ R7 (V109, 13/10) — les questions des candidats, côté **page publique et candidat** (`/api/procedures-en-ligne/{idDmc}/questions`).
 * Silencieux : chaque écran nomme ses refus.
 */
@Injectable({ providedIn: 'root' })
export class QuestionsProcedureService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/procedures-en-ligne`;
  private readonly ctx = { context: skipErrorToast() };

  /** Sans session : la fenêtre et les questions **répondues, anonymisées** ; 404 hors d'une procédure en ligne. */
  publiques(idDmc: number): Observable<QuestionsProcedure> {
    return this.http.get<QuestionsProcedure>(`${this.base}/${idDmc}/questions`, this.ctx);
  }

  /** CANDIDAT : ses propres questions, répondues ou non. */
  miennes(idDmc: number): Observable<QuestionCandidat[]> {
    return this.http.get<QuestionCandidat[]>(`${this.base}/${idDmc}/questions/miennes`, this.ctx);
  }

  /**
   * CANDIDAT : 201 ; 403 `DOSSIER_NON_RETIRE` ; 400 `QUESTION_OBLIGATOIRE`, `QUESTION_TROP_LONGUE` (4 000) ; 409 `QUESTIONS_CLOSES`
   * (`details { dateLimite, clotureLe, joursAvantLimite }`), `DATE_LIMITE_INCONNUE`.
   */
  poser(idDmc: number, question: string): Observable<QuestionCandidat> {
    return this.http.post<QuestionCandidat>(`${this.base}/${idDmc}/questions`, { question }, this.ctx);
  }

  /** Sans session : le fichier joint à une réponse diffusée ; 404 sans fichier ou avant la diffusion. */
  fichier(idDmc: number, id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${idDmc}/questions/${id}/fichier`, { responseType: 'blob', context: skipErrorToast() });
  }
}

/** ⚠️ R7 (V109) — les questions des candidats, côté **PRMP** (`/api/fiches-marche/{idDmc}/questions`). Silencieux. */
@Injectable({ providedIn: 'root' })
export class QuestionsFicheService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/fiches-marche`;
  private readonly ctx = { context: skipErrorToast() };

  /** Lecteurs internes de la fiche : toutes les questions, avec leur auteur, et la fenêtre. */
  lire(idDmc: number): Observable<QuestionsProcedure> {
    return this.http.get<QuestionsProcedure>(`${this.base}/${idDmc}/questions`, this.ctx);
  }

  /**
   * PRMP de la fiche : répond **et diffuse** (définitif). 400 `TEXTE_OBLIGATOIRE`, `FORMAT_INVALIDE` (PDF, JPEG, PNG) ; 413 ; 409
   * `DEJA_REPONDUE` ; 403 hors PRMP.
   */
  repondre(idDmc: number, id: number, texte: string, fichier: File | null): Observable<QuestionCandidat> {
    const fd = new FormData();
    fd.append('texte', texte);
    if (fichier) fd.append('fichier', fichier, fichier.name);
    return this.http.post<QuestionCandidat>(`${this.base}/${idDmc}/questions/${id}/reponse`, fd, this.ctx);
  }

  /** Le PDF « Questions des candidats et réponses » ; 404 sans question. */
  pdf(idDmc: number): Observable<Blob> {
    return this.http.get(`${this.base}/${idDmc}/questions/pdf`, { responseType: 'blob', context: skipErrorToast() });
  }

  /** Le fichier joint à une réponse (même route publique, servie après la diffusion). */
  fichier(idDmc: number, id: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/procedures-en-ligne/${idDmc}/questions/${id}/fichier`, { responseType: 'blob', context: skipErrorToast() });
  }
}
