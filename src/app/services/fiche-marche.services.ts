import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { skipErrorToast } from '../core/errors/api-error';
import { BilanControles, Cadrage, ChampFiche, Dmc, DocumentFiche, Dossier, FicheMarche, FicheRattachable, LigneEligible, ReferentielFiche, TypeMarche, VersionFiche } from '../models';
import { CrudService } from './api/crud.service';

/**
 * Fiche DAO d'un appel d'offres — services du CONTRAT PROPOSÉ (`docs/demande-backend-2026-09-22-fiche-marche-dao.md`).
 * ⚠️ Développés contre le contrat, avant livraison backend : les écrans traitent le 404 des routes absentes comme
 * « contrat en attente » (repli sur la structure de l'esquisse), jamais comme une erreur de l'utilisateur.
 */

/** Référentiel des champs (`/api/champs-fiche-marche`) — blocs, rubriques et informations d'un type de marché. */
@Injectable({ providedIn: 'root' })
export class ChampFicheMarcheService extends CrudService<ChampFiche, string> {
  protected readonly resource = 'champs-fiche-marche';

  /** `GET ?typeMarche=` → blocs (avec rubriques) + champs actifs ; sans type : tout, inactifs compris (vue d'administration). Silencieux. */
  referentiel(typeMarche?: TypeMarche): Observable<ReferentielFiche> {
    const params = typeMarche ? new HttpParams().set('typeMarche', typeMarche) : new HttpParams();
    return this.http.get<ReferentielFiche>(this.baseUrl, { params, context: skipErrorToast() });
  }

  /** `POST` — Administrateur ; 400 nominatifs (`code`, `condition`, `options`…) posés par l'écran sous les champs. */
  creer(champ: ChampFiche): Observable<ChampFiche> {
    return this.http.post<ChampFiche>(this.baseUrl, champ, { context: skipErrorToast() });
  }

  /** `PUT /{code}` — Administrateur ; mêmes 400 nominatifs. */
  modifier(code: string, champ: ChampFiche): Observable<ChampFiche> {
    return this.http.put<ChampFiche>(`${this.baseUrl}/${encodeURIComponent(code)}`, champ, { context: skipErrorToast() });
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

  /** `GET /{idDmc}/versions` — versions figées (en-têtes). Silencieux : absente tant que le contrat n'est pas servi. */
  versions(idDmc: number): Observable<VersionFiche[]> {
    return this.http.get<VersionFiche[]>(`${this.baseUrl}/${idDmc}/versions`, { context: skipErrorToast() });
  }

  /** `GET /{idDmc}/versions/{numero}` — une version figée, en entier (livraison du 22/09). */
  version(idDmc: number, numero: number): Observable<FicheMarche> {
    return this.http.get<FicheMarche>(`${this.baseUrl}/${idDmc}/versions/${numero}`);
  }

  /**
   * ⚠️ Lot 1b (23/09) — `POST /{idDmc}/dossier` : la fiche **produit** le dossier à soumettre (entité, localité et
   * PRMP dérivées de la ligne du plan). **PRMP seule** ; 409 à code stable `DMC_NON_DAO`, `DOSSIER_EXISTANT` (qui
   * porte l'`idDossier` déjà lié), `FICHE_NON_VALIDEE` (la **dernière** version doit être validée : une révision
   * ouverte bloque). Silencieux : l'écran traite le 409 lui-même.
   */
  creerDossier(idDmc: number): Observable<Dossier> {
    return this.http.post<Dossier>(`${this.baseUrl}/${idDmc}/dossier`, null, { context: skipErrorToast() });
  }

  /**
   * ⚠️ Lot 2 (demande du 23/09, non encore livrée) — `GET /{idDmc}/documents` : les documents de la version
   * courante, ou d'une version figée avec `?version=`. Une version non validée répond **200 et une liste vide**.
   * Silencieux : tant que la route n'existe pas (404), l'écran replie l'étape sans alarmer l'utilisateur.
   */
  documents(idDmc: number, version?: number): Observable<DocumentFiche[]> {
    const params = version != null ? new HttpParams().set('version', version) : new HttpParams();
    return this.http.get<DocumentFiche[]>(`${this.baseUrl}/${idDmc}/documents`, { params, context: skipErrorToast() });
  }

  /** `GET /documents/{idDocument}/contenu` — le binaire, à ouvrir ou enregistrer par `fichiers-surs`. */
  contenuDocument(idDocument: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/documents/${idDocument}/contenu`, { responseType: 'blob', context: skipErrorToast() });
  }

  /** `GET /rattachables` — fiches validées et non liées du périmètre (PRMP et UGPM ; 403 aux autres). Silencieux. */
  rattachables(): Observable<FicheRattachable[]> {
    return this.http.get<FicheRattachable[]>(`${this.baseUrl}/rattachables`, { context: skipErrorToast() });
  }
}
