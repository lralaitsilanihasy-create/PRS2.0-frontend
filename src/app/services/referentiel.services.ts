import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CrudService } from './api/crud.service';
import {
  Avis,
  Capm,
  CatCompte,
  CategorieEntite,
  Compte,
  DelaiStandard,
  DelegationProfil,
  EntiteContract,
  Localite,
  Ministere,
  ModePassation,
  Nature,
  PointsCtrl,
  Profile,
  RegleAlerte,
  RegleAnomalie,
  SousTypeDossier,
  TypeDmc,
  TypeDossier,
  TypePieceJointe,
} from '../models';

/**
 * Services des référentiels. Lecture ouverte ; écriture réservée à ADMINISTRATEUR
 * (le backend renvoie 403 sinon). PK string ou number selon la ressource.
 */

@Injectable({ providedIn: 'root' })
export class AvisService extends CrudService<Avis, string> {
  protected readonly resource = 'aviss';
}

@Injectable({ providedIn: 'root' })
export class CatCompteService extends CrudService<CatCompte, string> {
  protected readonly resource = 'cat-comptes';
}

/**
 * Référentiel des délais standards par étape du circuit (chronométrage 2026-09-01). `list()` rend
 * TOUJOURS les huit étapes (repli serveur à 1 jour si la table en manque une) ; `update(etape, dto)`
 * = `PUT /api/delais-standards/{etape}` (Administrateur, 400 si `delaiJours < 1`).
 */
@Injectable({ providedIn: 'root' })
export class DelaiStandardService extends CrudService<DelaiStandard, string> {
  protected readonly resource = 'delais-standards';
}

/** Référentiel des catégories d'entité contractante (`/api/categorie-entites`, PK = libellé). */
@Injectable({ providedIn: 'root' })
export class CategorieEntiteService extends CrudService<CategorieEntite, string> {
  protected readonly resource = 'categorie-entites';
}

/** Référentiel des types de pièces jointes attendues par type de dossier. */
@Injectable({ providedIn: 'root' })
export class TypePieceJointeService extends CrudService<TypePieceJointe> {
  protected readonly resource = 'type-piece-jointes';

  /** `GET /api/type-piece-jointes?typeDossier={id}` — types du dossier (triés par `ordre`). */
  getByTypeDossier(idTypeDossier: string): Observable<TypePieceJointe[]> {
    return this.http.get<TypePieceJointe[]>(this.baseUrl, {
      params: new HttpParams().set('typeDossier', idTypeDossier),
    });
  }
}

@Injectable({ providedIn: 'root' })
export class CapmService extends CrudService<Capm> {
  protected readonly resource = 'capm';

  /** `GET /api/capm` — processus de marché (référentiel), trié par `ordre` ASC côté serveur. */
  getAll(): Observable<Capm[]> {
    return this.list();
  }
}

@Injectable({ providedIn: 'root' })
export class CompteService extends CrudService<Compte, string> {
  protected readonly resource = 'comptes';
}

@Injectable({ providedIn: 'root' })
export class DelegationProfilService extends CrudService<DelegationProfil> {
  protected readonly resource = 'delegation-profils';
}

@Injectable({ providedIn: 'root' })
export class EntiteContractService extends CrudService<EntiteContract> {
  protected readonly resource = 'entite-contracts';
}

@Injectable({ providedIn: 'root' })
export class LocaliteService extends CrudService<Localite, string> {
  protected readonly resource = 'localites';
}

@Injectable({ providedIn: 'root' })
export class MinistereService extends CrudService<Ministere> {
  protected readonly resource = 'ministeres';
}

@Injectable({ providedIn: 'root' })
export class ModePassationService extends CrudService<ModePassation> {
  protected readonly resource = 'mode-passations';
}

@Injectable({ providedIn: 'root' })
export class NatureService extends CrudService<Nature> {
  protected readonly resource = 'natures';
}

/** Types de DMC (`/api/type-dmc`) — référentiel administrable ; le mapping mode→type vit sur `ModePassation.idTypeDmc`. */
@Injectable({ providedIn: 'root' })
export class TypeDmcService extends CrudService<TypeDmc> {
  protected readonly resource = 'type-dmc';
}

@Injectable({ providedIn: 'root' })
export class PointsCtrlService extends CrudService<PointsCtrl> {
  protected readonly resource = 'points-ctrls';

  /** `GET /api/points-ctrls?sousType=X` — grille effective (points communs de la famille + spécifiques du sous-type), triée par ordre. */
  grille(idSousType: string): Observable<PointsCtrl[]> {
    return this.http.get<PointsCtrl[]>(this.baseUrl, { params: new HttpParams().set('sousType', idSousType) });
  }
}

@Injectable({ providedIn: 'root' })
export class ProfileService extends CrudService<Profile> {
  protected readonly resource = 'profiles';
}

@Injectable({ providedIn: 'root' })
export class RegleAlerteService extends CrudService<RegleAlerte> {
  protected readonly resource = 'regle-alertes';
}

@Injectable({ providedIn: 'root' })
export class RegleAnomalieService extends CrudService<RegleAnomalie> {
  protected readonly resource = 'regle-anomalies';
}

@Injectable({ providedIn: 'root' })
export class TypeDossierService extends CrudService<TypeDossier, string> {
  protected readonly resource = 'type-dossiers';
}

/** Sous-types de dossier (`/api/sous-type-dossiers`) — référentiel administrable, rattaché à une famille. */
@Injectable({ providedIn: 'root' })
export class SousTypeDossierService extends CrudService<SousTypeDossier, string> {
  protected readonly resource = 'sous-type-dossiers';

  /** `GET /api/sous-type-dossiers/par-famille/{idTypeDossier}` — sous-types d'une famille (404 si inconnue). */
  parFamille(idTypeDossier: string): Observable<SousTypeDossier[]> {
    return this.http.get<SousTypeDossier[]>(`${this.baseUrl}/par-famille/${idTypeDossier}`);
  }
}
