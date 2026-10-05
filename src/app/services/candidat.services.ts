import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import {
  Accuse,
  BesoinEnLigne,
  ConfirmationCandidat,
  CreationOffreCorps,
  Horloge,
  Offre,
  PieceAttendue,
  ConfirmationCandidatCorps,
  DecisionVerificationNif,
  DocumentProcedureEnLigne,
  Entreprise,
  EntrepriseCorps,
  ExclusionArmp,
  ExclusionArmpCorps,
  InscriptionCandidat,
  InscriptionCandidatCorps,
  PieceEntreprise,
  ProcedureEnLigne,
  StatutVerificationNif,
  TypePieceEntreprise,
  VerificationNif,
} from '../models';

/**
 * Soumission en ligne, lot 1 (demande du 04/10, §B2 à §B8 ; backend V63 à V65). Services BESPOKE : aucune de ces
 * ressources n'est un CRUD complet (pas de `DELETE` sur une exclusion, pas d'identifiant de compte dans les routes du
 * candidat, qui est toujours celui du jeton). Les appels dont l'écran nomme lui-même le refus (409 à code, 400 par
 * champ, 404 « pas encore déclarée ») sont silencieux ; les autres laissent le dialogue centralisé parler.
 */

/** Le compte du candidat — routes PUBLIQUES, sans session (`/api/candidats/**`). */
@Injectable({ providedIn: 'root' })
export class CandidatInscriptionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/candidats`;

  /** `POST /inscription` → 201 ; 400 par champ, 409 `EMAIL_EXISTANT` (unique parmi TOUS les comptes), 429. */
  inscrire(corps: InscriptionCandidatCorps): Observable<InscriptionCandidat> {
    return this.http.post<InscriptionCandidat>(`${this.base}/inscription`, corps, { context: skipErrorToast() });
  }

  /**
   * `POST /confirmation` → 200 `CONFIRME` (déjà confirmé : 200 aussi) ; 400 `CODE_INVALIDE` / `CODE_EXPIRE`, 404, 429
   * (essais épuisés : il faut un nouveau code). Réactive aussi un compte archivé (409 `COMPTE_ARCHIVE` à la connexion).
   */
  confirmer(corps: ConfirmationCandidatCorps): Observable<ConfirmationCandidat> {
    return this.http.post<ConfirmationCandidat>(`${this.base}/confirmation`, corps, { context: skipErrorToast() });
  }

  /** `POST /codes` → toujours 204, même pour une adresse inconnue (un tiers n'apprend rien) ; 429 : 5 par heure. */
  renvoyerCodes(email: string): Observable<void> {
    return this.http.post<void>(`${this.base}/codes`, { email }, { context: skipErrorToast() });
  }
}

/** L'entreprise du candidat connecté (`/api/candidat/entreprise`) — un compte, une entreprise. */
@Injectable({ providedIn: 'root' })
export class EntrepriseCandidatService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/candidat/entreprise`;

  /** `GET` → 200, ou **404 tant qu'elle n'est pas déclarée** : l'écran ouvre alors le formulaire vide. Silencieux. */
  lire(): Observable<Entreprise> {
    return this.http.get<Entreprise>(this.base, { context: skipErrorToast() });
  }

  /** `PUT` → 400 par champ, 409 `NIF_EXISTANT` / `STAT_EXISTANT` / `RCS_EXISTANT` (message servi, sans nommer l'autre compte). */
  declarer(corps: EntrepriseCorps): Observable<Entreprise> {
    return this.http.put<Entreprise>(this.base, corps, { context: skipErrorToast() });
  }

  /** `POST /pieces` (multipart `type`, `fichier`) → 201 ; 400 (type), 409 `ENTREPRISE_ABSENTE`, 413 (`tailleMaxPieceMo`). */
  ajouterPiece(type: TypePieceEntreprise, fichier: File): Observable<PieceEntreprise> {
    const fd = new FormData();
    fd.append('type', type);
    fd.append('fichier', fichier);
    return this.http.post<PieceEntreprise>(`${this.base}/pieces`, fd, { context: skipErrorToast() });
  }

  /** `DELETE /pieces/{id}` → 204. */
  supprimerPiece(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/pieces/${id}`);
  }
}

/** Les procédures ouvertes à la remise électronique (`/api/procedures-en-ligne`) : liste et détail PUBLICS. */
@Injectable({ providedIn: 'root' })
export class ProceduresEnLigneService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/procedures-en-ligne`;

  /** `GET` (public) — la date limite la plus proche d'abord ; une procédure close en sort. */
  liste(): Observable<ProcedureEnLigne[]> {
    return this.http.get<ProcedureEnLigne[]>(this.base);
  }

  /** `GET /{idDmc}` (public) — **404 hors critères**, sans dire lequel manque ; une procédure close reste lisible. Silencieux. */
  detail(idDmc: number): Observable<ProcedureEnLigne> {
    return this.http.get<ProcedureEnLigne>(`${this.base}/${idDmc}`, { context: skipErrorToast() });
  }

  /** `GET /{idDmc}/documents` — CANDIDAT seul (401 sans session, 403 à un agent). */
  documents(idDmc: number): Observable<DocumentProcedureEnLigne[]> {
    return this.http.get<DocumentProcedureEnLigne[]>(`${this.base}/${idDmc}/documents`);
  }

  /** ⚠️ Lot 3 (V68) — `GET /{idDmc}/pieces` (public) : les pièces attendues dans l'offre, AE, reçu et garantie en tête. */
  pieces(idDmc: number): Observable<PieceAttendue[]> {
    return this.http.get<PieceAttendue[]>(`${this.base}/${idDmc}/pieces`, { context: skipErrorToast() });
  }

  /**
   * ⚠️ Lot 5 (05/10) — `GET /{idDmc}/besoin` (CANDIDAT) : articles, délais, garanties et seuils par lot, de quoi pré-remplir les
   * formulaires de l'offre ; `formulaires: false` sans besoin (dépôt par pièces seules). Silencieux : l'écran retombe sur les pièces.
   */
  besoin(idDmc: number): Observable<BesoinEnLigne> {
    return this.http.get<BesoinEnLigne>(`${this.base}/${idDmc}/besoin`, { context: skipErrorToast() });
  }

  /** ⚠️ Lot 3 — `GET /api/horloge` (public) : l'heure du serveur, qui fait foi pour la date limite. */
  horloge(): Observable<Horloge> {
    return this.http.get<Horloge>(`${environment.apiUrl}/horloge`, { context: skipErrorToast() });
  }

  /**
   * `GET /{idDmc}/documents/{code}` → le fichier. **Chaque appel inscrit une ligne au registre des retraits** de la
   * PRMP : l'écran le dit avant le clic, et ne télécharge jamais de lui-même.
   */
  telecharger(idDmc: number, code: string): Observable<Blob> {
    return this.http.get(`${this.base}/${idDmc}/documents/${encodeURIComponent(code)}`, { responseType: 'blob' });
  }

  /**
   * `GET /{idDmc}/pv` (public) — l'extrait du PV d'ouverture (sans les alertes), publié à la dernière signature quand la fiche
   * le prévoit (`B04-OP-13`) ; 404 sinon. La procédure ne dit pas s'il est publié : l'écran le demande au clic. Silencieux.
   */
  pv(idDmc: number): Observable<Blob> {
    return this.http.get(`${this.base}/${idDmc}/pv`, { responseType: 'blob', context: skipErrorToast() });
  }
}

/** Vérification des entreprises par l'Administrateur (`/api/admin/entreprises`, §B4). */
@Injectable({ providedIn: 'root' })
export class EntreprisesAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/entreprises`;

  /** `GET ?verification=` — `NON_VERIFIE` par défaut côté serveur, les plus anciennes d'abord. */
  liste(statut?: StatutVerificationNif): Observable<Entreprise[]> {
    const params = statut ? new HttpParams().set('verification', statut) : new HttpParams();
    return this.http.get<Entreprise[]>(this.base, { params });
  }

  /** `POST /{id}/verification` → 400 si le motif d'un refus manque (message servi, posé par l'écran). Silencieux. */
  decider(id: number, decision: DecisionVerificationNif): Observable<VerificationNif> {
    return this.http.post<VerificationNif>(`${this.base}/${id}/verification`, decision, { context: skipErrorToast() });
  }

  /** `GET /{id}/pieces/{idPiece}/fichier` → le fichier, à ouvrir par `ouvrirBlobSur` (jamais une URL brute). */
  fichierPiece(id: number, idPiece: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pieces/${idPiece}/fichier`, { responseType: 'blob' });
  }
}

/** Le répertoire des entreprises exclues par l'ARMP (`/api/exclusions-armp`, Administrateur, §B5). */
@Injectable({ providedIn: 'root' })
export class ExclusionsArmpService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/exclusions-armp`;

  liste(): Observable<ExclusionArmp[]> {
    return this.http.get<ExclusionArmp[]>(this.base);
  }

  /** `POST` → 201 ; 400 par champ. Silencieux : l'écran pose les erreurs sous les champs. */
  creer(corps: ExclusionArmpCorps): Observable<ExclusionArmp> {
    return this.http.post<ExclusionArmp>(this.base, corps, { context: skipErrorToast() });
  }

  /** `PUT /{id}` — une exclusion ne se supprime pas (405) : on la corrige, ou on avance sa date de fin. */
  modifier(id: number, corps: ExclusionArmpCorps): Observable<ExclusionArmp> {
    return this.http.put<ExclusionArmp>(`${this.base}/${id}`, corps, { context: skipErrorToast() });
  }
}

/**
 * ⚠️ Lot 3 (V68) — les offres du candidat connecté (`/api/candidat/offres`). Le serveur ne reçoit qu'un en-tête et des
 * morceaux chiffrés : le scellement se fait dans `core/securite/scellement.ts`. Tout est silencieux — l'écran du dépôt nomme
 * chaque refus (409 à code), et un dialogue centralisé couperait le fil d'un envoi en plusieurs morceaux.
 */
@Injectable({ providedIn: 'root' })
export class OffresCandidatService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/candidat/offres`;

  /** `POST` → 201 `EN_COURS` ; 400 `EN_TETE_INVALIDE` / `LOT_INVALIDE` / `REMPLACE_INVALIDE`, 409 des conditions du dépôt. */
  creer(corps: CreationOffreCorps): Observable<Offre> {
    return this.http.post<Offre>(this.base, corps, { context: skipErrorToast() });
  }

  /** `PUT /{id}/morceaux/{rang}` (octets bruts, `X-Empreinte`) — rejouable : c'est la reprise d'un envoi coupé. */
  envoyerMorceau(idOffre: string, rang: number, morceau: Uint8Array<ArrayBuffer>, empreinte: string): Observable<{ rang: number; taille: number; recus: number }> {
    return this.http.put<{ rang: number; taille: number; recus: number }>(`${this.base}/${idOffre}/morceaux/${rang}`, new Blob([morceau], { type: 'application/octet-stream' }), {
      headers: { 'Content-Type': 'application/octet-stream', 'X-Empreinte': empreinte },
      context: skipErrorToast(),
    });
  }

  /** `POST /{id}/sceller` `{ empreinte }` → l'accusé ; 409 `MORCEAU_MANQUANT` (`details.rangs`), `EMPREINTE_DIFFERENTE`, `DELAI_DEPASSE`… */
  sceller(idOffre: string, empreinte: string): Observable<Accuse> {
    return this.http.post<Accuse>(`${this.base}/${idOffre}/sceller`, { empreinte }, { context: skipErrorToast() });
  }

  /** `GET` — toutes ses offres, toutes procédures. */
  liste(): Observable<Offre[]> {
    return this.http.get<Offre[]>(this.base);
  }

  /** `GET /{id}/accuse` → le PDF de l'accusé (409 `OFFRE_NON_DEPOSEE` pour un dépôt en cours). */
  accuse(idOffre: string): Observable<Blob> {
    return this.http.get(`${this.base}/${idOffre}/accuse`, { responseType: 'blob', context: skipErrorToast() });
  }

  /** `DELETE /{id}` → `RETIREE` ; 409 `DELAI_DEPASSE`, `REMPLACEMENT_INTERDIT`, `OFFRE_NON_DEPOSEE`. */
  retirer(idOffre: string): Observable<Offre> {
    return this.http.delete<Offre>(`${this.base}/${idOffre}`, { context: skipErrorToast() });
  }
}
