import { Injectable } from '@angular/core';

import { CrudService } from './api/crud.service';
import { Controleur, Organigramme, Prmp } from '../models';

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
