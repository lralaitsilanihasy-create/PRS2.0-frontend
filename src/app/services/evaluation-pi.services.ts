import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import { NotesTechniquesCorps, Technique } from '../models';

/**
 * ⚠️ Lot 3 PI — l'évaluation des propositions de prestations intellectuelles. Tranche PI-c : la notation technique. Tout est silencieux :
 * l'écran nomme les refus (barème, motif, conflit, étape arrêtée, notation incomplète…).
 */
@Injectable({ providedIn: 'root' })
export class EvaluationPiService {
  private readonly http = inject(HttpClient);

  private base(idDmc: number): string {
    return `${environment.apiUrl}/fiches-marche/${idDmc}/evaluation/technique`;
  }

  technique(idDmc: number): Observable<Technique> {
    return this.http.get<Technique>(this.base(idDmc), { context: skipErrorToast() });
  }

  /** La grille du membre appelant pour une proposition ; une nouvelle saisie remplace la sienne (le journal les garde toutes). */
  noter(idDmc: number, idOffre: string, corps: NotesTechniquesCorps): Observable<Technique> {
    return this.http.put<Technique>(`${this.base(idDmc)}/offres/${encodeURIComponent(idOffre)}/notes`, corps, { context: skipErrorToast() });
  }

  /** Président : arrête l'étape technique du lot (409 `NOTATION_INCOMPLETE`, `details.offres`). */
  arreter(idDmc: number, lot: number, observation: string | null): Observable<Technique> {
    return this.http.post<Technique>(`${this.base(idDmc)}/lots/${lot}/arreter`, { observation }, { context: skipErrorToast() });
  }

  /** Président : rouvre l'étape technique du lot (motif obligatoire). */
  rouvrir(idDmc: number, lot: number, motif: string): Observable<Technique> {
    return this.http.post<Technique>(`${this.base(idDmc)}/lots/${lot}/rouvrir`, { motif }, { context: skipErrorToast() });
  }
}
