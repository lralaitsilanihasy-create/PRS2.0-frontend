import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { CrudService } from './api/crud.service';
import {
  Dossier,
  Lot,
  Marche,
  MarchePrevision,
  PieceJointeDossier,
  Ppm,
  PrmpEntite,
  SaisieDossierRequest,
  SaisiePpmRequest,
  ServiceBeneficiaire,
  SoaBeneficiaire,
  Tranche,
} from '../models';

/** Domaine PRMP : PPM, marchés et leurs détails. Écriture : tout utilisateur authentifié. */

@Injectable({ providedIn: 'root' })
export class PpmService extends CrudService<Ppm> {
  protected readonly resource = 'ppms';

  /**
   * `PATCH /api/ppms/{id}/rectifier` (PRMP propriétaire) — corrige l'en-tête d'un PPM dont le dossier
   * est `EN_ATTENTE_DECISION_PRMP`, sans repasser par le brouillon (statut inchangé). Identité **figée**
   * côté serveur : `idDossier`/`idPrmp`/`idLocalite` ignorés — donc absents du corps. Hors
   * `EN_ATTENTE_DECISION_PRMP` → 409 ; non-propriétaire / profil ≠ PRMP → 403.
   */
  rectifier(id: number, body: Partial<Ppm>): Observable<Ppm> {
    return this.http.patch<Ppm>(`${this.baseUrl}/${id}/rectifier`, body);
  }
}

@Injectable({ providedIn: 'root' })
export class MarcheService extends CrudService<Marche> {
  protected readonly resource = 'marches';

  /**
   * `POST /api/marches?idDossier={id}` — ajoute une ligne de marché ; la PK (`idDetail`) est **générée
   * par le serveur** (non envoyée). `idDossier` passe en **query param** (pas dans le corps).
   */
  createMarche(idDossier: number, body: Partial<Marche>): Observable<Marche> {
    return this.http.post<Marche>(this.baseUrl, body, { params: new HttpParams().set('idDossier', idDossier) });
  }

  /**
   * `PATCH /api/marches/{id}/rectifier` (PRMP propriétaire) — corrige une ligne de marché d'un dossier
   * `EN_ATTENTE_DECISION_PRMP`, sans repasser par le brouillon (statut inchangé) ; mode de passation
   * revalidé. Identité **figée** : `idDossier`/`idPpm` ignorés (absents du corps), `idMode` recalculé.
   * Hors `EN_ATTENTE_DECISION_PRMP` → 409 ; non-propriétaire / profil ≠ PRMP → 403.
   */
  rectifier(id: number, body: Partial<Marche>): Observable<Marche> {
    return this.http.patch<Marche>(`${this.baseUrl}/${id}/rectifier`, body);
  }
}

/** Dates prévisionnelles d'un marché (relation 1,N ; remplace les datePrev* du marché). */
@Injectable({ providedIn: 'root' })
export class MarchePrevisionService extends CrudService<MarchePrevision> {
  protected readonly resource = 'marche-previsions';

  /** `GET /api/marche-previsions?marche={idDetail}` — dates prévisionnelles d'UN marché. */
  byMarche(idDetail: number): Observable<MarchePrevision[]> {
    return this.http.get<MarchePrevision[]>(this.baseUrl, {
      params: new HttpParams().set('marche', idDetail),
    });
  }
}

@Injectable({ providedIn: 'root' })
export class LotService extends CrudService<Lot> {
  protected readonly resource = 'lots';
}

@Injectable({ providedIn: 'root' })
export class TrancheService extends CrudService<Tranche> {
  protected readonly resource = 'tranches';
}

@Injectable({ providedIn: 'root' })
export class ServiceBeneficiaireService extends CrudService<ServiceBeneficiaire> {
  protected readonly resource = 'service-beneficiaires';
}

@Injectable({ providedIn: 'root' })
export class SoaBeneficiaireService extends CrudService<SoaBeneficiaire, string> {
  protected readonly resource = 'soa-beneficiaires';
}

@Injectable({ providedIn: 'root' })
export class PrmpEntiteService extends CrudService<PrmpEntite> {
  protected readonly resource = 'prmp-entites';
}

/** Pièces jointes déposées sur un dossier (upload multipart ; contenu binaire via `/contenu`). */
@Injectable({ providedIn: 'root' })
export class PieceJointeDossierService extends CrudService<PieceJointeDossier> {
  protected readonly resource = 'piece-jointe-dossiers';

  /** `GET /api/piece-jointe-dossiers?dossier={idDossier}` — pièces d'un dossier. */
  getByDossier(idDossier: number): Observable<PieceJointeDossier[]> {
    return this.http.get<PieceJointeDossier[]>(this.baseUrl, {
      params: new HttpParams().set('dossier', idDossier),
    });
  }
  /** `POST /api/piece-jointe-dossiers` (multipart : part `data` JSON + part `fichier`). */
  upload(fd: FormData): Observable<PieceJointeDossier> {
    return this.http.post<PieceJointeDossier>(this.baseUrl, fd);
  }
  /** `GET /api/piece-jointe-dossiers/{id}/contenu` — contenu binaire du fichier. */
  telecharger(idPiece: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${idPiece}/contenu`, { responseType: 'blob' });
  }
  /** `DELETE /api/piece-jointe-dossiers/{id}` (PRMP, dossier BROUILLON, ou Admin). */
  supprimer(idPiece: number): Observable<void> {
    return this.delete(idPiece);
  }
}

/**
 * Façade de saisie PRMP (`/api/saisies`). Crée un dossier BROUILLON (+ PPM + lignes
 * pour une saisie PPM) en une transaction. Réservée PRMP côté backend (403 sinon).
 * Remplace l'usage direct de `POST /api/dossiers` / `POST /api/ppms` (désormais ADMIN).
 */
@Injectable({ providedIn: 'root' })
export class SaisieService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/saisies`;

  /** `POST /api/saisies/ppm` → dossier créé (type PPM, statut BROUILLON). */
  ppm(req: SaisiePpmRequest): Observable<Dossier> {
    return this.http.post<Dossier>(`${this.baseUrl}/ppm`, req);
  }

  /**
   * `POST /api/saisies/ppm` (multipart) → dossier PPM + pièces jointes initiales en une transaction.
   * Parts : `data` (JSON `SaisiePpmRequest`) + `piece_<idTypePiece>` (fichiers PDF/JPEG/PNG).
   */
  ppmAvecPieces(req: SaisiePpmRequest, pieces: Map<number, File>): Observable<Dossier> {
    const fd = new FormData();
    fd.append('data', new Blob([JSON.stringify(req)], { type: 'application/json' }));
    pieces.forEach((file, idTypePiece) => fd.append(`piece_${idTypePiece}`, file));
    return this.http.post<Dossier>(`${this.baseUrl}/ppm`, fd);
  }

  /** `POST /api/saisies/dossier` → dossier DAO/MAOO créé (statut BROUILLON). */
  dossier(req: SaisieDossierRequest): Observable<Dossier> {
    return this.http.post<Dossier>(`${this.baseUrl}/dossier`, req);
  }
}
