import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CrudService } from './api/crud.service';
import { skipErrorToast } from '../core/errors/api-error';
import {
  AbrogerMandatRequest,
  Controleur,
  CreerMandatRequest,
  CreerPrmpRequest,
  CreerUgpmRequest,
  Mandat,
  ModifierUgpmRequest,
  Organigramme,
  Prmp,
  RattachementDto,
  Ugpm,
} from '../models';

/** Types de pièce jointe d'une PRMP (sous-chemins `/pieces/{type}`). */
export type PrmpPieceType = 'ARRETE_NOMIN' | 'CIN' | 'PHOTO';

/** Types de pièce jointe d'une UGPM — pas d'arrêté (identité alignée PRMP sans arrêté de nomination). */
export type UgpmPieceType = 'CIN' | 'PHOTO';

/**
 * Gestion des comptes et de la hiérarchie (§3.8).
 * Lecture ouverte ; écriture réservée à ADMINISTRATEUR (403 sinon).
 */

@Injectable({ providedIn: 'root' })
export class ControleurService extends CrudService<Controleur, string> {
  protected readonly resource = 'controleurs';

  /** `POST /api/controleurs` — crée la fiche + (si fournie) la photo, en un appel multipart (`data` + `photo`). */
  creerAvecPhoto(body: Controleur, photo: File | null): Observable<Controleur> {
    if (!photo) {
      return this.create(body);
    }
    return this.http.post<Controleur>(this.baseUrl, this.multipart(body, photo));
  }

  /** `PUT /api/controleurs/{id}` — met à jour la fiche + (si fournie) remplace la photo, multipart (`data` + `photo`). */
  modifierAvecPhoto(id: string, body: Controleur, photo: File | null): Observable<Controleur> {
    if (!photo) {
      return this.update(id, body);
    }
    return this.http.put<Controleur>(`${this.baseUrl}/${encodeURIComponent(id)}`, this.multipart(body, photo));
  }

  private multipart(body: Controleur, photo: File): FormData {
    const fd = new FormData();
    fd.append('data', new Blob([JSON.stringify(body)], { type: 'application/json' }));
    fd.append('photo', photo);
    return fd;
  }

  /** `GET /api/controleurs/{id}/pieces/PHOTO` — télécharge la photo (404 si absente ; toast désactivé). */
  downloadPhoto(imControleur: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${encodeURIComponent(imControleur)}/pieces/PHOTO`, {
      responseType: 'blob',
      context: skipErrorToast(),
    });
  }

  /**
   * ⚠️ Rattachements (2026-09-01) — `GET /api/controleurs/rattachements` : porteurs de chaîne
   * (Membres et Vérificateurs) avec leur rattaché courant. Ouvert à Admin / Président / CC (le CC
   * reçoit sa seule localité). Sous-ressource dédiée — le `PUT /api/controleurs/{id}` général reste
   * réservé à l'Admin (l'ouvrir aurait donné au P/CC l'écriture du profil et de la localité).
   */
  rattachements(): Observable<RattachementDto[]> {
    return this.http.get<RattachementDto[]>(`${this.baseUrl}/rattachements`);
  }

  /**
   * `PUT /api/controleurs/{im}/rattachement` — pose (`imRattache`) ou retire (`imRattache: null`)
   * le rattaché. 403 hors Admin/P/CC ou CC hors localité ; 409 profil sans chaîne, profil du
   * rattaché incorrect, inter-localités, auto-rattachement ; 404 matricule inconnu.
   */
  majRattachement(im: string, imRattache: string | null): Observable<RattachementDto> {
    return this.http.put<RattachementDto>(`${this.baseUrl}/${encodeURIComponent(im)}/rattachement`, { imRattache });
  }
}

/**
 * Mandats PRMP (`/api/mandats`) — habilitation 3 ans, renouvelable une fois ; écriture ADMINISTRATEUR,
 * lecture scopée (PRMP/UGPM = son périmètre). Ni PUT ni DELETE (un mandat matérialise un arrêté).
 */
@Injectable({ providedIn: 'root' })
export class MandatService extends CrudService<Mandat> {
  protected readonly resource = 'mandats';

  /** `GET /api/mandats[?prmp=|?ugpm=]` — historique CHRONOLOGIQUE (statut inclus) ; `?prmp` l'emporte. */
  historique(filtre?: { prmp?: string; ugpm?: string }): Observable<Mandat[]> {
    let params = new HttpParams();
    if (filtre?.prmp) params = params.set('prmp', filtre.prmp);
    else if (filtre?.ugpm) params = params.set('ugpm', filtre.ugpm);
    return this.http.get<Mandat[]>(this.baseUrl, { params });
  }

  /**
   * `GET /api/mandats/actif` — SIGNAL DE VACANCE : 200 = quelqu'un est en fonction, **404 = personne**
   * (« en attente de nomination »). Appel silencieux : le 404 est une réponse attendue, pas une erreur.
   */
  actif(filtre?: { prmp?: string; ugpm?: string }): Observable<Mandat> {
    let params = new HttpParams();
    if (filtre?.prmp) params = params.set('prmp', filtre.prmp);
    else if (filtre?.ugpm) params = params.set('ugpm', filtre.ugpm);
    return this.http.get<Mandat>(`${this.baseUrl}/actif`, { params, context: skipErrorToast() });
  }

  /** `POST /api/mandats` (ADMIN) — 409 : 3ᵉ mandat, arrêté réutilisé, prolongation déguisée, > 3 ans, chevauchement. */
  creer(body: CreerMandatRequest): Observable<Mandat> {
    return this.http.post<Mandat>(this.baseUrl, body);
  }

  /** `POST /api/mandats/{id}/abroger` (ADMIN) — fin avant terme, motif obligatoire. */
  abroger(idMandat: number, body: AbrogerMandatRequest): Observable<Mandat> {
    return this.http.post<Mandat>(`${this.baseUrl}/${idMandat}/abroger`, body);
  }
}

@Injectable({ providedIn: 'root' })
export class PrmpService extends CrudService<Prmp, string> {
  protected readonly resource = 'prmps';

  /**
   * `POST /api/prmps` — crée la fiche PRMP et, si `login`/`motDePasse` sont fournis, son compte
   * d'authentification **actif** (parité UGPM). Variante JSON (les pièces se déposent ensuite).
   */
  creer(req: CreerPrmpRequest): Observable<Prmp> {
    return this.http.post<Prmp>(this.baseUrl, req);
  }

  /**
   * `POST /api/prmps` **multipart** — même création, avec pièces jointes optionnelles (miroir de
   * l'inscription : part `data` = JSON `CreerPrmpRequest` + parts `arrete`/`cin`/`photo`). Repli sur
   * la variante JSON si aucune pièce n'est fournie.
   */
  creerAvecPieces(
    req: CreerPrmpRequest,
    pieces: { arrete?: File | null; cin?: File | null; photo?: File | null },
  ): Observable<Prmp> {
    if (!pieces.arrete && !pieces.cin && !pieces.photo) {
      return this.creer(req);
    }
    const fd = new FormData();
    fd.append('data', new Blob([JSON.stringify(req)], { type: 'application/json' }));
    if (pieces.arrete) fd.append('arrete', pieces.arrete);
    if (pieces.cin) fd.append('cin', pieces.cin);
    if (pieces.photo) fd.append('photo', pieces.photo);
    return this.http.post<Prmp>(this.baseUrl, fd);
  }

  /**
   * `POST /api/prmps/{id}/pieces/{type}` (multipart, part `fichier`) — dépose ou remplace une pièce
   * (arrêté / CIN / photo). ADMINISTRATEUR. 404 si la PRMP est inconnue.
   */
  uploadPiece(idPrmp: string, type: PrmpPieceType, fichier: File): Observable<unknown> {
    const fd = new FormData();
    fd.append('fichier', fichier);
    return this.http.post(`${this.baseUrl}/${encodeURIComponent(idPrmp)}/pieces/${type}`, fd);
  }

  /**
   * `GET /api/prmps/{id}/pieces/{type}` — télécharge une pièce (binaire). 404 si la pièce est absente
   * (toast désactivé : le composant gère le « aucune pièce »).
   */
  downloadPiece(idPrmp: string, type: PrmpPieceType): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${encodeURIComponent(idPrmp)}/pieces/${type}`, {
      responseType: 'blob',
      context: skipErrorToast(),
    });
  }
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

  /**
   * `GET /api/ugpms/par-tutelle/{idPrmp}` — unités rattachées à une PRMP de tutelle.
   *
   * ⚠️ Livraison backend `b264cce` (2026-08-19) : contrairement au reste de la ressource, cette
   * route est ouverte à la **PRMP concernée** (et à ses UGPM) en plus de l'ADMINISTRATEUR — une
   * PRMP consulte ses propres unités. C'est ce qui permet de ne plus appeler la liste complète,
   * réservée à l'Administrateur, et donc de supprimer le 403 que l'écran devait taire.
   * L'appelant vérifie qu'il est légitime avant d'appeler (cf. `detail-ppm-modal`).
   */
  parTutelle(idPrmp: string): Observable<Ugpm[]> {
    return this.http.get<Ugpm[]>(`${this.baseUrl}/par-tutelle/${encodeURIComponent(idPrmp)}`);
  }

  /** `PUT /api/ugpms/{id}` — modifie les champs métier (pas l'id ni le compte). */
  modifier(idUgpm: string, req: ModifierUgpmRequest): Observable<Ugpm> {
    return this.http.put<Ugpm>(`${this.baseUrl}/${idUgpm}`, req);
  }

  /**
   * `POST /api/ugpms` **multipart** — création avec pièces jointes optionnelles (CIN + photo ; pas
   * d'arrêté). Part `data` = JSON `CreerUgpmRequest` + parts `cin`/`photo`. Repli JSON si aucune pièce.
   */
  creerAvecPieces(
    req: CreerUgpmRequest,
    pieces: { cin?: File | null; photo?: File | null },
  ): Observable<Ugpm> {
    if (!pieces.cin && !pieces.photo) {
      return this.creer(req);
    }
    const fd = new FormData();
    fd.append('data', new Blob([JSON.stringify(req)], { type: 'application/json' }));
    if (pieces.cin) fd.append('cin', pieces.cin);
    if (pieces.photo) fd.append('photo', pieces.photo);
    return this.http.post<Ugpm>(this.baseUrl, fd);
  }

  /** `POST /api/ugpms/{id}/pieces/{type}` (multipart, part `fichier`) — dépose/remplace une pièce (CIN ou photo). */
  uploadPiece(idUgpm: string, type: UgpmPieceType, fichier: File): Observable<unknown> {
    const fd = new FormData();
    fd.append('fichier', fichier);
    return this.http.post(`${this.baseUrl}/${encodeURIComponent(idUgpm)}/pieces/${type}`, fd);
  }

  /** `GET /api/ugpms/{id}/pieces/{type}` — télécharge une pièce (404 si absente ; toast désactivé). */
  downloadPiece(idUgpm: string, type: UgpmPieceType): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${encodeURIComponent(idUgpm)}/pieces/${type}`, {
      responseType: 'blob',
      context: skipErrorToast(),
    });
  }
}
