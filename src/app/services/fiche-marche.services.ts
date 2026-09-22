import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { skipErrorToast } from '../core/errors/api-error';
import { BilanControles, Cadrage, ChampFiche, Dmc, FicheMarche, LigneEligible, ReferentielFiche, TypeMarche } from '../models';
import { CrudService } from './api/crud.service';

/**
 * Fiche marché d'un appel d'offres — services du CONTRAT PROPOSÉ (`docs/demande-backend-2026-09-22-fiche-marche-dao.md`).
 * ⚠️ Développés contre le contrat, avant livraison backend : les écrans traitent le 404 des routes absentes comme
 * « contrat en attente » (repli sur la structure de l'esquisse), jamais comme une erreur de l'utilisateur.
 */

/** Référentiel des champs (`/api/champs-fiche-marche`) — blocs, rubriques et informations d'un type de marché. */
@Injectable({ providedIn: 'root' })
export class ChampFicheMarcheService extends CrudService<ChampFiche, string> {
  protected readonly resource = 'champs-fiche-marche';

  /** `GET ?typeMarche=` → blocs (avec rubriques) + champs. Silencieux : le repli est décidé par l'écran. */
  referentiel(typeMarche: TypeMarche): Observable<ReferentielFiche> {
    const params = new HttpParams().set('typeMarche', typeMarche);
    return this.http.get<ReferentielFiche>(this.baseUrl, { params, context: skipErrorToast() });
  }
}

/** DMC par ligne de marché (`/api/dmcs`, lot 3a) — ouvert à la PRMP / UGPM par la demande du 22/09 (B2). */
@Injectable({ providedIn: 'root' })
export class DmcService extends CrudService<Dmc> {
  protected readonly resource = 'dmcs';

  /** `GET /eligibles` — lignes de PPM qui peuvent porter un DAO (PV signé, mode mappé DAO, sans DAO). */
  eligibles(): Observable<LigneEligible[]> {
    return this.http.get<LigneEligible[]>(`${this.baseUrl}/eligibles`, { context: skipErrorToast() });
  }

  /** `POST /par-marche/{idDetail}` — crée le DMC (409 : déjà un DAO, mode non mappé, PPM non signé). */
  creerParMarche(idDetail: number): Observable<Dmc> {
    return this.http.post<Dmc>(`${this.baseUrl}/par-marche/${idDetail}`, null);
  }

  /** `GET /par-marche/{idDetail}` (existant). */
  parMarche(idDetail: number): Observable<Dmc> {
    return this.http.get<Dmc>(`${this.baseUrl}/par-marche/${idDetail}`, { context: skipErrorToast() });
  }
}

/** La fiche elle-même (`/api/fiches-marche/{idDmc}`) : cadrage, valeurs par bloc, contrôles, validation, versions. */
@Injectable({ providedIn: 'root' })
export class FicheMarcheService extends CrudService<FicheMarche> {
  protected readonly resource = 'fiches-marche';

  /** `GET /{idDmc}` — 404 = pas encore de fiche (créée au premier PUT). Silencieux. */
  lire(idDmc: number): Observable<FicheMarche> {
    return this.http.get<FicheMarche>(`${this.baseUrl}/${idDmc}`, { context: skipErrorToast() });
  }

  /** `PUT /{idDmc}/cadrage` — fixe le type de marché et les réponses ; 409 si la version est VALIDEE. */
  cadrage(idDmc: number, cadrage: Cadrage): Observable<FicheMarche> {
    return this.http.put<FicheMarche>(`${this.baseUrl}/${idDmc}/cadrage`, { cadrage });
  }

  /** `PUT /{idDmc}/blocs/{bloc}` — valeurs du bloc ; 400 nominatifs par champ (affichés par l'écran, pas de toast). */
  bloc(idDmc: number, bloc: string, valeurs: Record<string, string | number | null>): Observable<FicheMarche> {
    return this.http.put<FicheMarche>(`${this.baseUrl}/${idDmc}/blocs/${bloc}`, { valeurs }, { context: skipErrorToast() });
  }

  /** `POST /{idDmc}/controler` — recalcule le bilan sans écrire. */
  controler(idDmc: number): Observable<BilanControles> {
    return this.http.post<BilanControles>(`${this.baseUrl}/${idDmc}/controler`, null);
  }

  /** `POST /{idDmc}/valider` — PRMP seule ; fige et versionne ; 409 s'il reste un contrôle bloquant. */
  valider(idDmc: number): Observable<FicheMarche> {
    return this.http.post<FicheMarche>(`${this.baseUrl}/${idDmc}/valider`, null);
  }

  /** `POST /{idDmc}/reviser` — nouvelle version brouillon copiée de la dernière validée. */
  reviser(idDmc: number): Observable<FicheMarche> {
    return this.http.post<FicheMarche>(`${this.baseUrl}/${idDmc}/reviser`, null);
  }

  /** `GET /{idDmc}/versions` — versions figées. */
  versions(idDmc: number): Observable<FicheMarche[]> {
    return this.http.get<FicheMarche[]>(`${this.baseUrl}/${idDmc}/versions`);
  }
}
