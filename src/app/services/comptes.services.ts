import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CrudService } from './api/crud.service';
import { Controleur, CreerUgpmRequest, Organigramme, Prmp, Ugpm } from '../models';

/**
 * Gestion des comptes et de la hiérarchie (§3.8).
 * Lecture ouverte ; écriture réservée à ADMINISTRATEUR (403 sinon).
 */

@Injectable({ providedIn: 'root' })
export class ControleurService extends CrudService<Controleur, string> {
  protected readonly resource = 'controleurs';
}

@Injectable({ providedIn: 'root' })
export class PrmpService extends CrudService<Prmp, string> {
  protected readonly resource = 'prmps';
}

@Injectable({ providedIn: 'root' })
export class OrganigrammeService extends CrudService<Organigramme> {
  protected readonly resource = 'organigrammes';
}

/**
 * UGPM (`/api/ugpms`, ADMINISTRATEUR). Le contrat n'expose que **POST** (création UGPM + compte) et
 * **GET** (liste) — pas de PUT/DELETE. `creer` envoie un `CreerUgpmRequest` (login + mot de passe).
 */
@Injectable({ providedIn: 'root' })
export class UgpmService extends CrudService<Ugpm, string> {
  protected readonly resource = 'ugpms';

  /** `POST /api/ugpms` — crée l'UGPM et son compte d'authentification actif. */
  creer(req: CreerUgpmRequest): Observable<Ugpm> {
    return this.http.post<Ugpm>(this.baseUrl, req);
  }
}
