import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { skipErrorToast } from '../core/errors/api-error';
import { CrudService } from './api/crud.service';
import {
  Avis,
  Capm,
  CatCompte,
  Compte,
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
  ReglePassation,
  Seuil,
  Situation,
  SuggestionModeRequest,
  SuggestionModeResponse,
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

@Injectable({ providedIn: 'root' })
export class PointsCtrlService extends CrudService<PointsCtrl> {
  protected readonly resource = 'points-ctrls';
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
export class ReglePassationService extends CrudService<ReglePassation> {
  protected readonly resource = 'regle-passations';

  /**
   * `POST /api/regle-passations/suggestion-mode` (réservé PRMP). Suggestion non contraignante.
   * 400/404 (aucune règle) sont gérés par l'appelant → pas de toast d'erreur global.
   */
  suggestionMode(body: SuggestionModeRequest): Observable<SuggestionModeResponse> {
    return this.http.post<SuggestionModeResponse>(`${this.baseUrl}/suggestion-mode`, body, {
      context: skipErrorToast(),
    });
  }
}

@Injectable({ providedIn: 'root' })
export class SeuilService extends CrudService<Seuil> {
  protected readonly resource = 'seuils';
}

@Injectable({ providedIn: 'root' })
export class SituationService extends CrudService<Situation> {
  protected readonly resource = 'situations';
}

@Injectable({ providedIn: 'root' })
export class TypeDossierService extends CrudService<TypeDossier, string> {
  protected readonly resource = 'type-dossiers';
}
