import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ConservationOffres,
  DelaiLegal,
  DelaiParametre,
  ParametreAgpmSeuil,
  ParametreCaoQuorum,
  ParametreCompteDao,
  ParametreRemiseElectronique,
  ParametreSigmpTransition,
  ParametresCandidats,
  PurgeOffres,
} from '../models';
import { skipErrorToast } from '../core/errors/api-error';

/**
 * Seuil AGPM (montant) au-delà duquel un marché en appel à manifestation d'intérêt (AMI) déclenche
 * l'AGPM — paramètre système ADMINISTRABLE (livré backend ; `PUT` réservé à l'Administrateur).
 * Défaut serveur = 0 → tout marché AMI déclenche tant que le pilote n'a pas relevé le seuil.
 *
 * ⚠️ Bespoke, comme `ParametreActualitesService` : il n'existe pas de ressource CRUD `/api/parametres`,
 * seulement les deux appels réels du contrat — hériter du CRUD générique pointerait vers des chemins
 * inexistants (404 garanti).
 */
@Injectable({ providedIn: 'root' })
export class ParametreAgpmSeuilService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/parametres/agpm-seuil-montant`;

  /** `GET /api/parametres/agpm-seuil-montant`. */
  lire(): Observable<ParametreAgpmSeuil> {
    return this.http.get<ParametreAgpmSeuil>(this.url);
  }

  /** `PUT /api/parametres/agpm-seuil-montant` (ADMINISTRATEUR). */
  definir(seuil: number): Observable<ParametreAgpmSeuil> {
    return this.http.put<ParametreAgpmSeuil>(this.url, { seuil });
  }
}

/**
 * ⚠️ Remise électronique (27/09, demande §B1.4) — défauts et bornes du bloc « Remise électronique » :
 * `GET` ouvert à tout authentifié, `PUT` Administrateur (état complet, `null` efface). Bespoke, comme les autres
 * paramètres : un seul chemin réel, pas de ressource CRUD.
 */
@Injectable({ providedIn: 'root' })
export class ParametreRemiseElectroniqueService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/parametres/fiche-remise-electronique`;

  lire(): Observable<ParametreRemiseElectronique> {
    return this.http.get<ParametreRemiseElectronique>(this.url);
  }

  definir(p: ParametreRemiseElectronique): Observable<ParametreRemiseElectronique> {
    return this.http.put<ParametreRemiseElectronique>(this.url, p);
  }
}

/**
 * ⚠️ 01/10 (avis spécifique §B8) — le compte bancaire de l'ARMP pour le prix du DAO. Bespoke, comme les autres
 * paramètres. La lecture est silencieuse : la modale d'impression de l'avis s'en sert pour prévenir, sans alarmer.
 */
@Injectable({ providedIn: 'root' })
export class ParametreCompteDaoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/parametres/compte-dao`;

  lire(): Observable<ParametreCompteDao> {
    return this.http.get<ParametreCompteDao>(this.url, { context: skipErrorToast() });
  }

  /** ADMINISTRATEUR seul ; 400 nominatif (`banque`, `titulaire`, `numeroCompte`). Silencieux : l'écran nomme le refus. */
  definir(corps: Pick<ParametreCompteDao, 'banque' | 'titulaire' | 'numeroCompte'>): Observable<ParametreCompteDao> {
    return this.http.put<ParametreCompteDao>(this.url, corps, { context: skipErrorToast() });
  }
}

/**
 * ⚠️ Soumission en ligne, lot 1 (04/10, §B7) — les réglages de l'espace candidat : voie de vérification du NIF,
 * confirmation par téléphone, limites et délais du ménage, plafond des pièces. `GET` et `PUT` **Administrateur
 * seul** (le `GET` aussi, à la différence de la remise électronique). Au `PUT`, un champ absent garde sa valeur et
 * une valeur hors bornes donne un 400 nominatif, que l'écran pose sous le champ.
 */
@Injectable({ providedIn: 'root' })
export class ParametresCandidatsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/parametres/candidats`;

  lire(): Observable<ParametresCandidats> {
    return this.http.get<ParametresCandidats>(this.url);
  }

  definir(p: Partial<ParametresCandidats>): Observable<ParametresCandidats> {
    return this.http.put<ParametresCandidats>(this.url, p, { context: skipErrorToast() });
  }
}

/**
 * ⚠️ V70 (arbitrage du pilote, 04/10) — la conservation des offres, Administrateur seul : les procédures échues, puis la purge,
 * geste nommé et journalisé (jamais une tâche automatique).
 */
@Injectable({ providedIn: 'root' })
export class ConservationOffresService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/offres/conservation`;

  lire(): Observable<ConservationOffres> {
    return this.http.get<ConservationOffres>(this.url, { context: skipErrorToast() });
  }

  /** 409 `CONSERVATION_NON_FIXEE` ou `CONSERVATION_EN_COURS` (`details.echeance`). */
  purger(idDmc: number): Observable<PurgeOffres> {
    return this.http.post<PurgeOffres>(`${this.url}/${idDmc}/purger`, null, { context: skipErrorToast() });
  }
}

/**
 * ⚠️ Manuel révisé, R1 (V101, 10/10) — la règle du quorum de la CAO (`MAJORITE`, `TOUS` ou un nombre), globale ; lue par tout
 * authentifié, réglée par l'Administrateur (400 `QUORUM_REGLE_INVALIDE`).
 */
@Injectable({ providedIn: 'root' })
export class ParametreCaoQuorumService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/parametres/cao-quorum`;

  lire(): Observable<ParametreCaoQuorum> {
    return this.http.get<ParametreCaoQuorum>(this.url, { context: skipErrorToast() });
  }

  definir(regle: string): Observable<ParametreCaoQuorum> {
    return this.http.put<ParametreCaoQuorum>(this.url, { regle }, { context: skipErrorToast() });
  }
}

/**
 * ⚠️ Manuel révisé, R3a (13/10) — la transition SIGMP (date de fin, décision d'équivalence) ; lue par tout authentifié (le pied
 * s'imprime sur l'AGPM dérivé), réglée par l'Administrateur. Une valeur nulle efface ; 400 nominatif (dates, référence, décision
 * incomplète : référence et date vont ensemble).
 */
@Injectable({ providedIn: 'root' })
export class ParametreSigmpTransitionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/parametres/sigmp-transition`;

  lire(): Observable<ParametreSigmpTransition> {
    return this.http.get<ParametreSigmpTransition>(this.url, { context: skipErrorToast() });
  }

  definir(corps: Pick<ParametreSigmpTransition, 'finTransition' | 'decisionReference' | 'decisionDate'>): Observable<ParametreSigmpTransition> {
    return this.http.put<ParametreSigmpTransition>(this.url, corps, { context: skipErrorToast() });
  }
}

/**
 * ⚠️ Manuel révisé, R6a (V106, 13/10) — les neuf délais de la loi (lecture seule, table en code) et les délais administrables
 * (`t_delai_parametre`, signalés, jamais bloquants) ; `PUT` réservé à l'Administrateur, un champ absent garde sa valeur.
 */
@Injectable({ providedIn: 'root' })
export class DelaisLegauxService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  legaux(): Observable<DelaiLegal[]> {
    return this.http.get<DelaiLegal[]>(`${this.base}/delais-legaux`, { context: skipErrorToast() });
  }

  parametres(): Observable<DelaiParametre[]> {
    return this.http.get<DelaiParametre[]>(`${this.base}/delais-parametres`, { context: skipErrorToast() });
  }

  regler(code: string, corps: Partial<Pick<DelaiParametre, 'valeur' | 'unite' | 'texte' | 'actif'>>): Observable<DelaiParametre> {
    return this.http.put<DelaiParametre>(`${this.base}/delais-parametres/${encodeURIComponent(code)}`, corps, { context: skipErrorToast() });
  }
}
