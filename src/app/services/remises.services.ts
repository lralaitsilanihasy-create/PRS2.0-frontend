import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import { EvaluationRemise, LancementRemise, Remise, RemiseTitulaire, ReponseRemiseCorps } from '../models';

/** Les champs d'une réponse en multipart (les nuls ne partent pas). */
function formulaireReponse(r: ReponseRemiseCorps, fichier: File, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.append('nature', r.nature);
  fd.append('montantHt', String(r.montantHt));
  if (r.montantTtc != null) fd.append('montantTtc', String(r.montantTtc));
  if (r.delai) fd.append('delai', r.delai);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  fd.append('fichier', fichier);
  return fd;
}

/**
 * ⚠️ Lot MS-2 (V125, 16/10) — la remise en concurrence côté **interne** (PRMP, UGPM, Commission, Administrateur) et **CAO** (le
 * président évalue, H1). Silencieux : chaque écran nomme ses refus.
 */
@Injectable({ providedIn: 'root' })
export class RemisesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/remises`;
  private readonly ctx = { context: skipErrorToast() };

  /** Les remises d'un contrat en vigueur. */
  duContrat(idContrat: number): Observable<Remise[]> {
    return this.http.get<Remise[]>(`${environment.apiUrl}/contrats-en-vigueur/${idContrat}/remises`, this.ctx);
  }

  /** 409 `CONTRAT_ECHU`, `FORME_SANS_REMISE`, `SANS_TITULAIRE`, `REMISE_EN_COURS` ; 400 `CHAMP_OBLIGATOIRE`, `ECHEANCE_INVALIDE`. */
  lancer(idContrat: number, corps: LancementRemise): Observable<Remise> {
    return this.http.post<Remise>(`${environment.apiUrl}/contrats-en-vigueur/${idContrat}/remises`, corps, this.ctx);
  }

  /** Les remises du périmètre du connecté (échéance décroissante) — l'entrée du membre de CAO. */
  lister(): Observable<Remise[]> {
    return this.http.get<Remise[]>(this.base, this.ctx);
  }

  lire(id: number): Observable<Remise> {
    return this.http.get<Remise>(`${this.base}/${id}`, this.ctx);
  }

  lettre(id: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    return this.blob(`${this.base}/${id}/lettre`, format);
  }

  /** 404 avant l'évaluation. */
  rapport(id: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    return this.blob(`${this.base}/${id}/rapport`, format);
  }

  /** 409 `REPONSES_FERMEES` avant l'échéance. */
  fichierReponse(id: number, idReponse: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/reponses/${idReponse}/fichier`, { responseType: 'blob', context: skipErrorToast() });
  }

  /** La réponse papier d'un titulaire, saisie par la PRMP ou l'UGPM (H2) ; `dateReception` entre le lancement et l'échéance. */
  reponsePapier(id: number, idOffre: string, r: ReponseRemiseCorps, dateReception: string, fichier: File): Observable<Remise> {
    return this.http.post<Remise>(`${this.base}/${id}/reponses`, formulaireReponse(r, fichier, { idOffre, dateReception }), this.ctx);
  }

  /** ⚠️ H1 — le président de la CAO, après l'échéance. */
  evaluer(id: number, corps: EvaluationRemise): Observable<Remise> {
    return this.http.post<Remise>(`${this.base}/${id}/evaluation`, corps, this.ctx);
  }

  /** PRMP : au seul proposé (art. 20). */
  attribuer(id: number, motif: string | null): Observable<Remise> {
    return this.http.post<Remise>(`${this.base}/${id}/attribution`, { motif }, this.ctx);
  }

  /** PRMP : motif obligatoire. */
  declarerInfructueuse(id: number, motif: string): Observable<Remise> {
    return this.http.post<Remise>(`${this.base}/${id}/infructueuse`, { motif }, this.ctx);
  }

  private blob(url: string, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    const params = format === 'docx' ? new HttpParams().set('format', 'docx') : new HttpParams();
    return this.http.get(url, { params, responseType: 'blob', context: skipErrorToast() });
  }
}

/** ⚠️ Lot MS-2 — la remise en concurrence côté **titulaire** (`/api/candidat/remises`). */
@Injectable({ providedIn: 'root' })
export class RemisesTitulaireService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/candidat/remises`;
  private readonly ctx = { context: skipErrorToast() };

  lister(): Observable<RemiseTitulaire[]> {
    return this.http.get<RemiseTitulaire[]>(this.base, this.ctx);
  }

  lettre(id: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    const params = format === 'docx' ? new HttpParams().set('format', 'docx') : new HttpParams();
    return this.http.get(`${this.base}/${id}/lettre`, { params, responseType: 'blob', context: skipErrorToast() });
  }

  /** Jusqu'à l'échéance ; une nouvelle réponse remplace la précédente. 409 `ECHEANCE_PASSEE`, `REMISE_CLOSE`. */
  repondre(id: number, r: ReponseRemiseCorps, fichier: File): Observable<RemiseTitulaire> {
    return this.http.post<RemiseTitulaire>(`${this.base}/${id}/reponse`, formulaireReponse(r, fichier), this.ctx);
  }
}
