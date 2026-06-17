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
}

@Injectable({ providedIn: 'root' })
export class MarcheService extends CrudService<Marche> {
  protected readonly resource = 'marches';
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

  /** `POST /api/saisies/dossier` → dossier DAO/MAOO créé (statut BROUILLON). */
  dossier(req: SaisieDossierRequest): Observable<Dossier> {
    return this.http.post<Dossier>(`${this.baseUrl}/dossier`, req);
  }
}
