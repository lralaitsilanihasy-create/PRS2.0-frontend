import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import { CrudService } from './api/crud.service';
import {
  DiffDossier,
  Dossier,
  EditionPpmRequest,
  Lot,
  Marche,
  MarchePrevision,
  PieceJointeDossier,
  Ppm,
  PrmpEntite,
  SaisieDossierRequest,
  SaisiePpmImportResult,
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
   * `POST /api/marches` — ajoute une ligne de marché à un brouillon. Le corps est un `MarcheDto`
   * incluant **`idDossier`** (et `idPpm`), tous deux `@NotNull` (cf. contrat §« Ajouter une ligne de
   * marché »). La PK `idDetail` est **générée par le serveur** (`seq_marche`) : non envoyée. Le mode de
   * passation est calculé/validé côté serveur.
   */
  createMarche(idDossier: number, body: Partial<Marche>): Observable<Marche> {
    return this.http.post<Marche>(this.baseUrl, { ...body, idDossier });
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

  /**
   * `PUT /api/saisies/ppm/{idDossier}` — édite un **brouillon** PPM en une transaction :
   * en-tête + `marches` réconciliées par `idDetail` (absentes → retirées). 409 hors brouillon.
   */
  editionPpm(idDossier: number, req: EditionPpmRequest): Observable<Dossier> {
    return this.http.put<Dossier>(`${this.baseUrl}/ppm/${idDossier}`, req);
  }

  /**
   * `POST /api/saisies/ppm/import` (multipart, part `fichier` = PDF) — **read-only** : parse un PPM PDF
   * et renvoie les données extraites pour **pré-remplir** le formulaire. **Ne crée rien** (la création
   * reste `ppm`/`ppmAvecPieces`). 400 si le PDF est illisible / non reconnu.
   */
  importPpm(fichier: File): Observable<SaisiePpmImportResult> {
    const fd = new FormData();
    fd.append('fichier', fichier);
    return this.http.post<SaisiePpmImportResult>(`${this.baseUrl}/ppm/import`, fd);
  }
  /**
   * `POST /api/saisies/ppm/import-xlsx` (multipart, part `fichier` = `.xlsx`) — **read-only** : import
   * à colonnes explicites (transcription exacte), même `SaisiePpmImportResult` que l'import PDF.
   */
  importPpmXlsx(fichier: File): Observable<SaisiePpmImportResult> {
    const fd = new FormData();
    fd.append('fichier', fichier);
    return this.http.post<SaisiePpmImportResult>(`${this.baseUrl}/ppm/import-xlsx`, fd);
  }
  /** `GET /api/saisies/ppm/import-xlsx/gabarit` — gabarit `.xlsx` à remplir (binaire). */
  telechargerGabaritXlsx(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/ppm/import-xlsx/gabarit`, { responseType: 'blob' });
  }

  /**
   * ⚠️ 2026-08-05 — `POST /api/saisies/ppm/{idDossier}/mise-a-jour` : ouvre la version suivante d'un PPM
   * en vigueur. Crée un **nouveau dossier BROUILLON**, copie conforme du précédent, qu'il ne modifie
   * pas — le prédécesseur ne bascule en « Remplacé » qu'à la soumission de cette nouvelle version.
   *
   * 400 motif vide · 409 dossier encore en instruction, déjà remplacé, ou mise à jour déjà en cours.
   */
  creerMiseAJour(idDossier: number, motif: string): Observable<Dossier> {
    return this.http.post<Dossier>(`${this.baseUrl}/ppm/${idDossier}/mise-a-jour`, { motif });
  }
}

/**
 * ⚠️ 2026-08-05 — versionnement d'un PPM : comparaison avec le prédécesseur, chaîne des versions et
 * suppression/restauration logique d'une ligne. Les chemins portent sur les ressources concernées
 * (`/dossiers`, `/marches`), la façade de création restant `SaisieService.creerMiseAJour`.
 */
@Injectable({ providedIn: 'root' })
export class MiseAJourPpmService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * `GET /api/dossiers/{id}/diff` — récapitulatif chiffré + détail ligne à ligne. Recalculé tant que la
   * version est un brouillon (il suit la saisie), relu depuis la trace figée une fois soumise.
   * 409 si le dossier n'est pas une mise à jour.
   */
  diff(idDossier: number, silencieux = false): Observable<DiffDossier> {
    // `silencieux` : sondage d'affichage (surlignage des lignes changées) — un 403 (profil non
    // propriétaire) ou 409 ne doit pas toaster, l'écran dégrade simplement sans surlignage.
    return this.http.get<DiffDossier>(
      `${this.apiUrl}/dossiers/${idDossier}/diff`,
      silencieux ? { context: skipErrorToast() } : {},
    );
  }

  /**
   * `GET /api/dossiers/{id}/diff-rectification` (backend 3178aa4) — diff du DERNIER cycle de
   * rectification (état pré-correction figé au premier PUT saisies/ppm du cycle → état courant),
   * même DTO que le diff de versions. Lisible par la PRMP et les profils du circuit. 404/409 si
   * aucun instantané (dossier jamais rectifié, ou cycle antérieur à la règle).
   */
  diffRectification(idDossier: number, silencieux = false): Observable<DiffDossier> {
    return this.http.get<DiffDossier>(
      `${this.apiUrl}/dossiers/${idDossier}/diff-rectification`,
      silencieux ? { context: skipErrorToast() } : {},
    );
  }

  /** `GET /api/dossiers/{id}/versions` — chaîne complète, **la plus récente d'abord**. */
  versions(idDossier: number): Observable<Dossier[]> {
    return this.http.get<Dossier[]>(`${this.apiUrl}/dossiers/${idDossier}/versions`);
  }

  /**
   * ⚠️ 2026-08-05 — `POST /api/saisies/ppm/{idDossier}/mise-a-jour/import` (multipart, part `fichier`).
   * Une mise à jour arrive comme un **document**, comme la création : on importe le PPM modifié au lieu
   * de le ressaisir. Le serveur parse le PDF, **rapproche** ses lignes de celles de la version (identité
   * conservée), marque supprimées celles qui en ont disparu, crée les nouvelles — et renvoie le diff.
   */
  importerMiseAJour(idDossier: number, fichier: File): Observable<DiffDossier> {
    const fd = new FormData();
    fd.append('fichier', fichier);
    return this.http.post<DiffDossier>(`${this.apiUrl}/saisies/ppm/${idDossier}/mise-a-jour/import`, fd);
  }

  /** `PATCH /api/marches/{idDetail}/supprimer` — suppression LOGIQUE (la ligne reste, restaurable). */
  supprimerLigne(idDetail: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/marches/${idDetail}/supprimer`, {});
  }

  /** `PATCH /api/marches/{idDetail}/restaurer` — remet la ligne en service. */
  restaurerLigne(idDetail: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/marches/${idDetail}/restaurer`, {});
  }
}
