import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import { NotesTechniquesCorps, PartChiffree, RoleDetenteur, SeanceFinanciere, Technique } from '../models';

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

  // ── PI-d1 (V88) : la seconde séance d'ouverture — les seules enveloppes financières des propositions qualifiées ──

  private seance(idDmc: number, suite = ''): string {
    return `${environment.apiUrl}/fiches-marche/${idDmc}/seance/financiere${suite}`;
  }

  /** 404 tant qu'elle n'est pas ouverte. */
  seanceFinanciere(idDmc: number): Observable<SeanceFinanciere> {
    return this.http.get<SeanceFinanciere>(this.seance(idDmc), { context: skipErrorToast() });
  }

  /** Responsable : 409 `SEANCE_TECHNIQUE_NON_CLOSE`, `TECHNIQUE_NON_ARRETEE` (`details.lots`), `AUCUNE_FINANCIERE_A_OUVRIR`, `SEANCE_FINANCIERE_OUVERTE`. */
  ouvrirSeanceFinanciere(idDmc: number): Observable<SeanceFinanciere> {
    return this.http.post<SeanceFinanciere>(this.seance(idDmc, '/ouvrir'), null, { context: skipErrorToast() });
  }

  /** Les parts chiffrées pour ma clé, des seules enveloppes financières à ouvrir (409 `SEANCE_NON_OUVERTE`). */
  mesPartsFinancieres(idDmc: number, role?: RoleDetenteur): Observable<PartChiffree[]> {
    const params = role === 'SECOURS' ? new HttpParams().set('role', 'SECOURS') : new HttpParams();
    return this.http.get<PartChiffree[]>(this.seance(idDmc, '/mes-parts'), { params, context: skipErrorToast() });
  }

  apporterPartsFinancieres(idDmc: number, parts: { idOffre: string; partClaire: string }[], role?: RoleDetenteur, motif?: string): Observable<SeanceFinanciere> {
    const params = role === 'SECOURS' ? new HttpParams().set('role', 'SECOURS') : new HttpParams();
    return this.http.post<SeanceFinanciere>(this.seance(idDmc, '/parts'), motif ? { parts, motif } : { parts }, { params, context: skipErrorToast() });
  }

  /** Responsable : les présents (membres de la CAO), les autres présents, les observations ; 409 `SEANCE_NON_DECHIFFREE`, `SEANCE_CLOSE`. */
  cloturerSeanceFinanciere(idDmc: number, presents: string[], autres: { nom: string; qualite: string | null }[], observations: string | null): Observable<SeanceFinanciere> {
    return this.http.post<SeanceFinanciere>(this.seance(idDmc, '/cloturer'), { presents, autres, observations }, { context: skipErrorToast() });
  }

  /** Le PV de la séance (PDF, ou Word) ; `ronde` pour une séance complémentaire. */
  pvSeanceFinanciere(idDmc: number, format: 'pdf' | 'docx' = 'pdf', ronde?: number): Observable<Blob> {
    let params = new HttpParams();
    if (format === 'docx') params = params.set('format', 'docx');
    if (ronde != null) params = params.set('ronde', String(ronde));
    return this.http.get(this.seance(idDmc, '/pv'), { params, responseType: 'blob', context: skipErrorToast() });
  }
}
