import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import { Ami, AmiCorps, AmiPublic, Expression, ExpressionCorps, PublicationAmi } from '../models';

/**
 * ⚠️ AMI en ligne, tranche AMI-a (07/10, V82). Les refus à code (`PONDERATION_INVALIDE`, `LECTURE_FERMEE`, `PIECES_MANQUANTES`…)
 * sont nommés par l'écran : les appels sont silencieux.
 */

/** L'AMI vu par la PRMP, l'UGPM et la commission (`/api/fiches-marche/{idDmc}/ami`). */
@Injectable({ providedIn: 'root' })
export class AmiService {
  private readonly http = inject(HttpClient);
  private url(idDmc: number): string {
    return `${environment.apiUrl}/fiches-marche/${idDmc}/ami`;
  }

  /** 404 tant que l'AMI n'est pas préparé : l'écran ouvre alors un formulaire vide. */
  lire(idDmc: number): Observable<Ami> {
    return this.http.get<Ami>(this.url(idDmc), { context: skipErrorToast() });
  }

  /** PRMP ou UGPM, tant qu'il n'est pas publié ; 409 `CATEGORIE_SANS_AMI` hors prestations intellectuelles. */
  preparer(idDmc: number, corps: AmiCorps): Observable<Ami> {
    return this.http.put<Ami>(this.url(idDmc), corps, { context: skipErrorToast() });
  }

  /** Le projet tant que l'AMI n'est pas publié, l'avis signé ensuite. */
  avis(idDmc: number, format: 'pdf' | 'docx'): Observable<Blob> {
    const params = format === 'docx' ? { format } : undefined;
    return this.http.get(`${this.url(idDmc)}/avis`, { params, responseType: 'blob', context: skipErrorToast() });
  }

  /** PRMP seule : au moins un support daté ; l'AMI se fige. */
  publier(idDmc: number, publications: PublicationAmi[]): Observable<Ami> {
    return this.http.post<Ami>(`${this.url(idDmc)}/publier`, { publications }, { context: skipErrorToast() });
  }

  /** PRMP seule : dispense de publicité déclarée avec son motif (Q1 au juriste). */
  dispenser(idDmc: number, motif: string): Observable<Ami> {
    return this.http.post<Ami>(`${this.url(idDmc)}/dispense`, { motif }, { context: skipErrorToast() });
  }

  /** 409 `LECTURE_FERMEE` avant la date limite (arbitrage Q2). */
  expressions(idDmc: number): Observable<Expression[]> {
    return this.http.get<Expression[]>(`${this.url(idDmc)}/expressions`, { context: skipErrorToast() });
  }

  piece(idDmc: number, idExpression: string, idPiece: number): Observable<Blob> {
    return this.http.get(`${this.url(idDmc)}/expressions/${idExpression}/pieces/${idPiece}`, { responseType: 'blob', context: skipErrorToast() });
  }
}

/** Les AMI publiés (public, sans session) et l'expression d'intérêt du candidat connecté. */
@Injectable({ providedIn: 'root' })
export class AmisEnLigneService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/amis-en-ligne`;
  private readonly candidat = `${environment.apiUrl}/candidat/amis`;

  /** Publiés et ouverts, la date limite la plus proche d'abord. */
  liste(): Observable<AmiPublic[]> {
    return this.http.get<AmiPublic[]>(this.base, { context: skipErrorToast() });
  }

  lire(idDmc: number): Observable<AmiPublic> {
    return this.http.get<AmiPublic>(`${this.base}/${idDmc}`, { context: skipErrorToast() });
  }

  avis(idDmc: number, format: 'pdf' | 'docx'): Observable<Blob> {
    const params = format === 'docx' ? { format } : undefined;
    return this.http.get(`${this.base}/${idDmc}/avis`, { params, responseType: 'blob', context: skipErrorToast() });
  }

  /** 404 tant que le candidat n'a rien déposé. */
  sienne(idDmc: number): Observable<Expression> {
    return this.http.get<Expression>(`${this.candidat}/${idDmc}/expression`, { context: skipErrorToast() });
  }

  /**
   * Dépôt multipart : `expression` en texte JSON (paramètre de requête côté serveur), un fichier par pièce attendue dans
   * `fichiers`, nommé comme dans `pieces[].fichier`. Un nouveau dépôt remplace le précédent.
   */
  deposer(idDmc: number, corps: ExpressionCorps, fichiers: File[]): Observable<Expression> {
    const fd = new FormData();
    fd.append('expression', JSON.stringify(corps));
    for (const f of fichiers) fd.append('fichiers', f, f.name);
    return this.http.post<Expression>(`${this.candidat}/${idDmc}/expression`, fd, { context: skipErrorToast() });
  }

  retirer(idDmc: number): Observable<void> {
    return this.http.delete<void>(`${this.candidat}/${idDmc}/expression`, { context: skipErrorToast() });
  }

  piece(idDmc: number, idPiece: number): Observable<Blob> {
    return this.http.get(`${this.candidat}/${idDmc}/expression/pieces/${idPiece}`, { responseType: 'blob', context: skipErrorToast() });
  }
}
