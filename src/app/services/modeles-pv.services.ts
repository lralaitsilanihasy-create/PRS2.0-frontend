import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';

import { ApiError, isApiError, skipErrorToast } from '../core/errors/api-error';
import { environment } from '../../environments/environment';
import {
  AvisApercu,
  CatalogueModelePv,
  ChampModelePv,
  CouvertureSousType,
  ConditionModelePv,
  ModeleIntegre,
  ModelePvFiche,
  ModelePvResume,
  NatureModelePv,
  VersionModelePv,
} from '../models';

/**
 * ⚠️ Générateur de modèles de PV, lot G1 (V138, 20/10) — `/api/modeles-pv`, réservé à l'Administrateur. Toutes les
 * écritures sont journalisées par le serveur (`historique` de la fiche). Erreurs gérées par l'écran (pas de toast).
 */
@Injectable({ providedIn: 'root' })
export class ModelePvService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/modeles-pv`;
  private readonly ctx = { context: skipErrorToast() };

  lister(): Observable<ModelePvResume[]> {
    return this.http.get<ModelePvResume[]>(this.url, this.ctx);
  }

  creer(corps: { code: string; libelle: string; nature: NatureModelePv }): Observable<ModelePvFiche> {
    return this.http.post<ModelePvFiche>(this.url, corps, this.ctx);
  }

  fiche(id: number): Observable<ModelePvFiche> {
    return this.http.get<ModelePvFiche>(`${this.url}/${id}`, this.ctx);
  }

  dupliquer(id: number, corps: { code?: string; libelle?: string } = {}): Observable<ModelePvFiche> {
    return this.http.post<ModelePvFiche>(`${this.url}/${id}/dupliquer`, corps, this.ctx);
  }

  /** Multipart, partie `fichier` (`.docx`, 10 Mo) → la version en brouillon et son rapport de contrôle. */
  deposer(id: number, fichier: File): Observable<VersionModelePv> {
    const corps = new FormData();
    corps.append('fichier', fichier);
    return this.http.post<VersionModelePv>(`${this.url}/${id}/versions`, corps, this.ctx);
  }

  version(id: number, numero: number): Observable<VersionModelePv> {
    return this.http.get<VersionModelePv>(`${this.url}/${id}/versions/${numero}`, this.ctx);
  }

  /** Remplace l'ensemble des conditions d'une version en brouillon ; le rapport est recalculé. */
  definirConditions(id: number, numero: number, conditions: ConditionModelePv[]): Observable<VersionModelePv> {
    return this.http.put<VersionModelePv>(`${this.url}/${id}/versions/${numero}/conditions`, conditions, this.ctx);
  }

  /** Remplace l'ensemble des champs saisis d'une version en brouillon ; le rapport est recalculé. */
  definirChamps(id: number, numero: number, champs: ChampModelePv[]): Observable<VersionModelePv> {
    return this.http.put<VersionModelePv>(`${this.url}/${id}/versions/${numero}/champs`, champs, this.ctx);
  }

  /** Le document rempli sur un dossier réel — rien n'est enregistré. Le corps d'erreur (binaire) est relu en JSON. */
  apercu(
    id: number,
    numero: number,
    p: { dossier: number; avis?: AvisApercu | null; format: 'pdf' | 'docx'; saisis?: Record<string, string> },
  ): Observable<Blob> {
    const params: Record<string, string> = { dossier: String(p.dossier), format: p.format };
    if (p.avis) params['avis'] = p.avis;
    return this.http
      .post(`${this.url}/${id}/versions/${numero}/apercu`, { saisis: p.saisis ?? {} }, { ...this.ctx, params, responseType: 'blob' })
      .pipe(catchError((e: unknown) => relireErreurBinaire(e)));
  }

  mettreEnVigueur(id: number, numero: number, motif: string): Observable<VersionModelePv> {
    return this.http.post<VersionModelePv>(`${this.url}/${id}/versions/${numero}/mettre-en-vigueur`, { motif }, this.ctx);
  }

  rattacher(id: number, sousTypes: string[]): Observable<ModelePvFiche> {
    return this.http.put<ModelePvFiche>(`${this.url}/${id}/rattachements`, { sousTypes }, this.ctx);
  }

  archiver(id: number, motif: string | null): Observable<ModelePvFiche> {
    return this.http.post<ModelePvFiche>(`${this.url}/${id}/archiver`, motif ? { motif } : {}, this.ctx);
  }

  /** Le `.docx` tel que déposé. */
  fichier(id: number, numero: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/versions/${numero}/fichier`, { ...this.ctx, responseType: 'blob' });
  }

  /** Les modèles intégrés au backend (fichiers livrés avec le serveur), lus là où le choix se fait. */
  integres(): Observable<ModeleIntegre[]> {
    return this.http.get<ModeleIntegre[]>(`${this.url}/integres`, this.ctx);
  }

  /** Pour chaque sous-type et chaque nature, ce qui produit son document (intégré, géré, rien) et le modèle qui le sert. */
  couverture(): Observable<CouvertureSousType[]> {
    return this.http.get<CouvertureSousType[]>(`${this.url}/couverture`, this.ctx);
  }

  /** Le catalogue des variables, filtré par la famille du sous-type (tout le catalogue sans sous-type). */
  variables(sousType?: string | null): Observable<CatalogueModelePv> {
    return this.http.get<CatalogueModelePv>(`${this.url}/variables`, { ...this.ctx, params: sousType ? { sousType } : {} });
  }
}

/** Une erreur sur une réponse binaire porte son `ErrorResponse` dans un `Blob` : on le relit pour garder message et code. */
function relireErreurBinaire(e: unknown): Observable<never> {
  const brut = isApiError(e) ? e.raw : e instanceof HttpErrorResponse ? e : null;
  if (!brut || !(brut.error instanceof Blob)) return throwError(() => e);
  return from(brut.error.text()).pipe(
    switchMap((texte) => {
      let corps: { message?: string; code?: string; details?: unknown } = {};
      try {
        corps = JSON.parse(texte) as typeof corps;
      } catch {
        /* corps non JSON : on garde le message par défaut */
      }
      const err: ApiError = {
        status: brut.status,
        message: corps.message || (isApiError(e) ? e.message : 'L’aperçu n’a pas pu être produit.'),
        code: corps.code,
        raw: new HttpErrorResponse({ error: corps, status: brut.status, statusText: brut.statusText, url: brut.url ?? undefined }),
      };
      return throwError(() => err);
    }),
  );
}
