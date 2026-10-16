import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import { BonCommande, Consommation, EmissionBonCommande, LivraisonCorps, ReceptionsBon } from '../models';

function blob(http: HttpClient, url: string, format: 'pdf' | 'docx'): Observable<Blob> {
  const params = format === 'docx' ? new HttpParams().set('format', 'docx') : new HttpParams();
  return http.get(url, { params, responseType: 'blob', context: skipErrorToast() });
}

/**
 * ⚠️ Lot MS-3 (V126, 16/10) — les bons de commande côté **interne** : la consommation d'un contrat (PRMP, UGPM, Commission,
 * Administrateur), l'émission et l'annulation (PRMP de la fiche). Silencieux : l'écran nomme ses refus.
 */
@Injectable({ providedIn: 'root' })
export class BonsCommandeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bons-commande`;
  private readonly ctx = { context: skipErrorToast() };

  consommation(idContrat: number): Observable<Consommation> {
    return this.http.get<Consommation>(`${environment.apiUrl}/contrats-en-vigueur/${idContrat}/bons-commande`, this.ctx);
  }

  emettre(idContrat: number, corps: EmissionBonCommande): Observable<BonCommande> {
    return this.http.post<BonCommande>(`${environment.apiUrl}/contrats-en-vigueur/${idContrat}/bons-commande`, corps, this.ctx);
  }

  document(id: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    return blob(this.http, `${this.base}/${id}/document`, format);
  }

  /** Motivée ; le bon sort des cumuls. 409 `DEJA_ANNULE`. */
  annuler(id: number, motif: string): Observable<BonCommande> {
    return this.http.post<BonCommande>(`${this.base}/${id}/annulation`, { motif }, this.ctx);
  }
}

/** ⚠️ Lot MS-3 — les bons de commande côté **titulaire** ; la première lecture du document vaut accusé de réception. */
@Injectable({ providedIn: 'root' })
export class BonsCommandeTitulaireService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/candidat/bons-commande`;

  lister(): Observable<BonCommande[]> {
    return this.http.get<BonCommande[]>(this.base, { context: skipErrorToast() });
  }

  document(id: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    return blob(this.http, `${this.base}/${id}/document`, format);
  }

  // ⚠️ Lot MS-4 (V127, 16/10) — la livraison déclarée par le titulaire, et ses réceptions (PV signé seulement).

  /** 409 `BON_ANNULE`, `RECEPTION_EN_COURS`, `DEJA_RECU` ; 400 `DATE_INVALIDE`. */
  declarerLivraison(id: number, corps: LivraisonCorps): Observable<ReceptionsBon> {
    return this.http.post<ReceptionsBon>(`${this.base}/${id}/livraison`, corps, { context: skipErrorToast() });
  }

  receptions(id: number): Observable<ReceptionsBon> {
    return this.http.get<ReceptionsBon>(`${this.base}/${id}/receptions`, { context: skipErrorToast() });
  }

  /** 404 avant la signature. */
  pvSigne(id: number, idReception: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    return blob(this.http, `${this.base}/${id}/receptions/${idReception}/pv`, format);
  }
}
