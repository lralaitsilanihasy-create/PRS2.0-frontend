import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import {
  ActivationCaoCorps,
  Cao,
  CaoCorps,
  Ceremonie,
  CleCorps,
  ClesPubliques,
  DefiOuvert,
  Detenteur,
  Enveloppe,
  MaProcedureCao,
  MembreCao,
  RoleDetenteur,
  VueProcedureCao,
} from '../models';

/**
 * Soumission en ligne — lot 2a (la CAO, V67) et lot 2b (la cérémonie des clés, V66). Services BESPOKE. Presque tout est
 * silencieux : ces écrans nomment eux-mêmes le refus (403 « réservé au responsable », 409 à code « clés incomplètes : … »,
 * 404 « pas encore »), et le dialogue centralisé parlerait à côté.
 */

/** La commission d'appel d'offres d'une fiche (`/api/fiches-marche/{idDmc}/cao`) — lue par qui lit la fiche, écrite par la PRMP. */
@Injectable({ providedIn: 'root' })
export class CaoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/fiches-marche`;

  /** `GET` → `CaoDto` (`etat = ABSENTE` tant que rien n'est déclaré) ; 403 hors périmètre, 404 fiche inconnue. */
  lire(idDmc: number): Observable<Cao> {
    return this.http.get<Cao>(`${this.base}/${idDmc}/cao`, { context: skipErrorToast() });
  }

  /** `PUT` (PRMP de la fiche) → 400 par champ (`decision.reference`, `membres[i].email`…), 409 `MEMBRE_EXCLU` / `CEREMONIE_CLOSE`. */
  definir(idDmc: number, corps: CaoCorps): Observable<Cao> {
    return this.http.put<Cao>(`${this.base}/${idDmc}/cao`, corps, { context: skipErrorToast() });
  }

  /** `POST /decision` (multipart `fichier`, PDF reconnu à ses octets) → 400 `FORMAT_INVALIDE` / `FICHIER_ABSENT`, 404 sans CAO, 413. */
  deposerDecision(idDmc: number, fichier: File): Observable<Cao> {
    const fd = new FormData();
    fd.append('fichier', fichier);
    return this.http.post<Cao>(`${this.base}/${idDmc}/cao/decision`, fd, { context: skipErrorToast() });
  }

  /** `POST /membres/{id}/inviter` — renvoie l'invitation (le code précédent ne vaut plus) ; 409 `COMPTE_ACTIF`. */
  inviter(idDmc: number, idMembre: number): Observable<MembreCao> {
    return this.http.post<MembreCao>(`${this.base}/${idDmc}/cao/membres/${idMembre}/inviter`, null, { context: skipErrorToast() });
  }
}

/** L'espace du membre de CAO (`/api/cao/**`) : activation publique, puis ses procédures. */
@Injectable({ providedIn: 'root' })
export class CaoEspaceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cao`;

  /** `POST /activation` (public) → `{ etat: 'ACTIF' }` ; 400 `CODE_INVALIDE` / `CODE_EXPIRE` / mot de passe, 404, 429. */
  activer(corps: ActivationCaoCorps): Observable<{ etat: 'ACTIF' }> {
    return this.http.post<{ etat: 'ACTIF' }>(`${this.base}/activation`, corps, { context: skipErrorToast() });
  }

  /** `GET /mes-procedures` — les procédures où le membre connecté siège. */
  mesProcedures(): Observable<MaProcedureCao[]> {
    return this.http.get<MaProcedureCao[]>(`${this.base}/mes-procedures`);
  }

  /** `GET /procedures/{idDmc}` — 403 s'il n'y siège pas, 404. Silencieux : l'écran le dit. */
  procedure(idDmc: number): Observable<VueProcedureCao> {
    return this.http.get<VueProcedureCao>(`${this.base}/procedures/${idDmc}`, { context: skipErrorToast() });
  }
}

/**
 * La cérémonie des clés d'une procédure (`/api/fiches-marche/{idDmc}/ceremonie/**`, V66) : responsable et membres de la
 * CAO par identité. **Rien de cryptographique ici** : les clés naissent et se déverrouillent dans
 * `core/securite/cles-detenteur.ts` ; ce service ne transporte que des enveloppes et des octets chiffrés.
 */
@Injectable({ providedIn: 'root' })
export class CeremonieService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/fiches-marche`;

  private url(idDmc: number, suite = ''): string {
    return `${this.base}/${idDmc}/ceremonie${suite}`;
  }

  private params(role?: RoleDetenteur): HttpParams {
    return role === 'SECOURS' ? new HttpParams().set('role', 'SECOURS') : new HttpParams();
  }

  /** `GET` — responsable et membres ; 403 aux autres. */
  lire(idDmc: number): Observable<Ceremonie> {
    return this.http.get<Ceremonie>(this.url(idDmc), { context: skipErrorToast() });
  }

  /** `POST /cles` (membre, pour lui-même) → 201 ; 400 `CLE_INVALIDE` / `EMPREINTE_INVALIDE` / `ENVELOPPE_INVALIDE`, 409 `CEREMONIE_CLOSE` / `CLE_EXISTANTE`. */
  publierCle(idDmc: number, corps: CleCorps): Observable<Detenteur> {
    return this.http.post<Detenteur>(this.url(idDmc, '/cles'), corps, { context: skipErrorToast() });
  }

  /** `PUT /cles` (S4) — remplace sa clé, cérémonie close ou non. */
  remplacerCle(idDmc: number, corps: CleCorps): Observable<Detenteur> {
    return this.http.put<Detenteur>(this.url(idDmc, '/cles'), corps, { context: skipErrorToast() });
  }

  /** `GET /cles/mienne` — l'enveloppe du membre connecté, à lui seul ; 404 sans clé. */
  maCle(idDmc: number): Observable<Enveloppe> {
    return this.http.get<Enveloppe>(this.url(idDmc, '/cles/mienne'), { context: skipErrorToast() });
  }

  /** `POST /cles/secours` (responsable, en présence du dépositaire) ; 409 `DEPOSITAIRE_ABSENT` / `CEREMONIE_CLOSE` / `CLE_EXISTANTE`. */
  publierSecours(idDmc: number, corps: CleCorps): Observable<Detenteur> {
    return this.http.post<Detenteur>(this.url(idDmc, '/cles/secours'), corps, { context: skipErrorToast() });
  }

  /** `PUT /cles/secours` (S4). */
  remplacerSecours(idDmc: number, corps: CleCorps): Observable<Detenteur> {
    return this.http.put<Detenteur>(this.url(idDmc, '/cles/secours'), corps, { context: skipErrorToast() });
  }

  /** `GET /cles/secours` — l'enveloppe de la part de secours, responsable seul ; le pli n'apporte que la phrase. */
  enveloppeSecours(idDmc: number): Observable<Enveloppe> {
    return this.http.get<Enveloppe>(this.url(idDmc, '/cles/secours'), { context: skipErrorToast() });
  }

  /** `POST /cles/perdue[?role=SECOURS]` → `PERDUE`, responsable notifié ; 409 `CLE_ABSENTE`. */
  declarerPerdue(idDmc: number, role?: RoleDetenteur): Observable<Detenteur> {
    return this.http.post<Detenteur>(this.url(idDmc, '/cles/perdue'), null, { params: this.params(role), context: skipErrorToast() });
  }

  /** `POST /cloturer` (responsable) → 409 `CLES_INCOMPLETES`, dont le message nomme les manquants. */
  cloturer(idDmc: number): Observable<Ceremonie> {
    return this.http.post<Ceremonie>(this.url(idDmc, '/cloturer'), null, { context: skipErrorToast() });
  }

  /** `POST /rouvrir` (responsable, S4) → toutes les parts `ABSENTE` ; 409 `DEPOT_EXISTANT` dès la première offre. */
  rouvrir(idDmc: number): Observable<Ceremonie> {
    return this.http.post<Ceremonie>(this.url(idDmc, '/rouvrir'), null, { context: skipErrorToast() });
  }

  /** `POST /defi[?role=SECOURS]` (S2) → 201 `{ idDefi, chiffre, expire }` : 32 octets chiffrés pour la clé publique, cinq minutes. */
  ouvrirDefi(idDmc: number, role?: RoleDetenteur): Observable<DefiOuvert> {
    return this.http.post<DefiOuvert>(this.url(idDmc, '/defi'), null, { params: this.params(role), context: skipErrorToast() });
  }

  /** `POST /defi/{idDefi}` `{ clair }` → `VERIFIEE` ; 409 `DEFI_EXPIRE` / `DEFI_ECHOUE` (la part ne change pas). */
  repondreDefi(idDmc: number, idDefi: string, clair: string): Observable<Detenteur> {
    return this.http.post<Detenteur>(this.url(idDmc, `/defi/${encodeURIComponent(idDefi)}`), { clair }, { context: skipErrorToast() });
  }

  /** `GET /api/procedures-en-ligne/{idDmc}/cles` (public) — 404 tant que la cérémonie n'est pas close, ou hors de la liste publique. */
  clesPubliques(idDmc: number): Observable<ClesPubliques> {
    return this.http.get<ClesPubliques>(`${environment.apiUrl}/procedures-en-ligne/${idDmc}/cles`, { context: skipErrorToast() });
  }
}
