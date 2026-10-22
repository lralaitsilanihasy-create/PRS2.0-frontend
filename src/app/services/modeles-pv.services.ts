import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';

import { ApiError, isApiError, skipErrorToast } from '../core/errors/api-error';
import { environment } from '../../environments/environment';
import {
  AvisApercu,
  CategorieMarche,
  CatalogueModelePv,
  ChampModelePv,
  CouvertureSousType,
  DocumentDaoIntegre,
  EcartArmp,
  JuristeValidation,
  ConditionModelePv,
  DocumentPage,
  ImageModelePv,
  ModeleIntegre,
  ModelePvFiche,
  ModelePvResume,
  NatureModelePv,
  PorteeDepart,
  SchemaModelePv,
  VersionModelePv,
} from '../models';

/**
 * ⚠️ Générateur de modèles de PV, lot G1 (V138, 20/10) — `/api/modeles-pv`, réservé à l'Administrateur. Toutes les
 * écritures sont journalisées par le serveur (`historique` de la fiche). Erreurs gérées par l'écran (pas de toast).
 */
@Injectable({ providedIn: 'root' })
export class ModelePvService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/modeles-pv`;
  private readonly ctx = { context: skipErrorToast() };

  lister(): Observable<ModelePvResume[]> {
    return this.http.get<ModelePvResume[]>(this.url, this.ctx);
  }

  creer(corps: { code: string; libelle: string; nature: NatureModelePv }): Observable<ModelePvFiche> {
    return this.http.post<ModelePvFiche>(this.url, corps, this.ctx);
  }

  fiche(id: number): Observable<ModelePvFiche> {
    return this.http.get<ModelePvFiche>(`${this.url}/${id}`, this.ctx);
  }

  dupliquer(id: number, corps: { code?: string; libelle?: string } = {}): Observable<ModelePvFiche> {
    return this.http.post<ModelePvFiche>(`${this.url}/${id}/dupliquer`, corps, this.ctx);
  }


  version(id: number, numero: number): Observable<VersionModelePv> {
    return this.http.get<VersionModelePv>(`${this.url}/${id}/versions/${numero}`, this.ctx);
  }

  /**
   * ⚠️ 21/10 (demande « modele-pv-depart ») — le modèle de départ assemblé par le serveur : une version en brouillon, tirée du PV
   * officiel et des phrases de la famille des sous-types servis, conditions et champs déjà déclarés. Rien n'est mis en vigueur.
   * 400 `SANS_SOUS_TYPE`, `NATURE_SANS_DEPART`, `PORTEE_INCONNUE` ; 409 `FAMILLES_MULTIPLES` (`details`), `FAMILLE_SANS_DEPART`, `MODELE_ARCHIVE`.
   */
  /**
   * Un PV ou une lettre : la portée ; ⚠️ 22/10 (M1) un projet de marché : la catégorie (à défaut la seule rattachée) ; (D1-D3) un
   * document du DAO : son sigle rattaché, rien à envoyer.
   */
  genererDepart(id: number, portee: PorteeDepart = 'les-deux', categorie?: CategorieMarche | null, dao = false): Observable<VersionModelePv> {
    return this.http.post<VersionModelePv>(`${this.url}/${id}/versions/depart`, dao ? {} : categorie ? { categorie } : { portee }, this.ctx);
  }

  /** ⚠️ 22/10 (D0) — les 15 documents intégrés du DAO. */
  integresDao(): Observable<DocumentDaoIntegre[]> {
    return this.http.get<DocumentDaoIntegre[]>(`${this.url}/integres/dao`, this.ctx);
  }

  /** ⚠️ 22/10 (D0) — le rendu brut d'un document intégré du DAO (jetons visibles), en PDF ou en Word. */
  fichierIntegreDao(sigle: string, format: 'pdf' | 'docx'): Observable<Blob> {
    return this.http
      .get(`${this.url}/integres/dao/${encodeURIComponent(sigle)}/fichier`, { ...this.ctx, params: { format }, responseType: 'blob' })
      .pipe(catchError((e: unknown) => relireErreurBinaire(e)));
  }

  /** ⚠️ 22/10 (D1-D3) — un document du DAO se rattache à son sigle (un seul : `UN_SEUL_SIGLE`). */
  rattacherSigles(id: number, sigles: string[]): Observable<ModelePvFiche> {
    return this.http.put<ModelePvFiche>(`${this.url}/${id}/rattachements`, { sigles }, this.ctx);
  }

  /** ⚠️ 22/10 (D-ARMP) — les écarts d'une version avec le document type de l'ARMP. */
  ecarts(id: number, numero: number): Observable<EcartArmp[]> {
    return this.http.get<EcartArmp[]>(`${this.url}/${id}/versions/${numero}/ecarts`, this.ctx);
  }

  /** ⚠️ 21/10 (option C') — une nouvelle version page, en brouillon, avec son rapport. 400 `DOCUMENT_INVALIDE` (`details` par chemin). */
  enregistrerPage(id: number, document: DocumentPage, motif?: string | null): Observable<VersionModelePv> {
    return this.http.post<VersionModelePv>(`${this.url}/${id}/versions`, { document, motif: motif ?? null }, this.ctx);
  }

  /** Remplace le document d'un brouillon page (409 `VERSION_FIGEE` hors brouillon, `SUPPORT_ABANDONNE` sur un Word). */
  modifierDocument(id: number, numero: number, document: DocumentPage): Observable<VersionModelePv> {
    return this.http.put<VersionModelePv>(`${this.url}/${id}/versions/${numero}/document`, { document }, this.ctx);
  }

  /** Le schéma des pages : polices, couleurs, fonds, formats, limites. */
  schema(): Observable<SchemaModelePv> {
    return this.http.get<SchemaModelePv>(`${this.url}/schema`, this.ctx);
  }

  /** L'emblème des PV officiels, servi par le serveur (créé au premier appel, identifiant stable ensuite). */
  embleme(): Observable<ImageModelePv> {
    return this.http.get<ImageModelePv>(`${this.url}/images/embleme`, this.ctx);
  }

  /** Dépose une image (PNG ou JPEG, 2 Mo, contrôlée par son contenu). */
  deposerImage(fichier: File): Observable<ImageModelePv> {
    const corps = new FormData();
    corps.append('fichier', fichier);
    return this.http.post<ImageModelePv>(`${this.url}/images`, corps, this.ctx);
  }

  /** L'adresse d'une image, à poser dans la page (même origine : la session suit). */
  urlImage(idImage: number): string {
    return `${this.url}/images/${idImage}`;
  }

  /** Remplace l'ensemble des conditions d'une version en brouillon ; le rapport est recalculé. */
  definirConditions(id: number, numero: number, conditions: ConditionModelePv[]): Observable<VersionModelePv> {
    return this.http.put<VersionModelePv>(`${this.url}/${id}/versions/${numero}/conditions`, conditions, this.ctx);
  }

  /** Remplace l'ensemble des champs saisis d'une version en brouillon ; le rapport est recalculé. */
  definirChamps(id: number, numero: number, champs: ChampModelePv[]): Observable<VersionModelePv> {
    return this.http.put<VersionModelePv>(`${this.url}/${id}/versions/${numero}/champs`, champs, this.ctx);
  }

  /**
   * Le document rempli sur un dossier réel — ou, ⚠️ 22/10 (« apercu-exemple »), sur le dossier d'exemple fictif du catalogue
   * (`exemple=true`, sans `dossier` ; pied « EXEMPLE — valeurs fictives »). Rien n'est enregistré. Le corps d'erreur (binaire) est relu.
   */
  apercu(
    id: number,
    numero: number,
    p: {
      dossier?: number | null;
      /** ⚠️ 22/10 (M1) — un projet de marché s'essaie sur une procédure et un lot, pas sur un dossier. */
      procedure?: { idDmc: number; lot: number } | null;
      exemple?: boolean;
      avis?: AvisApercu | null;
      format: 'pdf' | 'docx';
      saisis?: Record<string, string>;
    },
  ): Observable<Blob> {
    const params: Record<string, string> = p.exemple
      ? { exemple: 'true', format: p.format }
      : p.procedure
        ? { procedure: String(p.procedure.idDmc), lot: String(p.procedure.lot), format: p.format }
        : { dossier: String(p.dossier), format: p.format };
    if (p.avis) params['avis'] = p.avis;
    return this.http
      .post(`${this.url}/${id}/versions/${numero}/apercu`, { saisis: p.saisis ?? {} }, { ...this.ctx, params, responseType: 'blob' })
      .pipe(catchError((e: unknown) => relireErreurBinaire(e)));
  }

  /** ⚠️ 22/10 (D-ARMP) — `juriste` exigé dès qu'un document du DAO s'écarte du document type (400 `VALIDATION_JURISTE_REQUISE`). */
  mettreEnVigueur(id: number, numero: number, motif: string, juriste?: JuristeValidation | null): Observable<VersionModelePv> {
    return this.http.post<VersionModelePv>(`${this.url}/${id}/versions/${numero}/mettre-en-vigueur`, juriste ? { motif, juriste } : { motif }, this.ctx);
  }

  /** ⚠️ 22/10 (M1) — un projet de marché se rattache à des catégories (409 `CATEGORIE_DEJA_SERVIE`). */
  rattacherCategories(id: number, categories: CategorieMarche[]): Observable<ModelePvFiche> {
    return this.http.put<ModelePvFiche>(`${this.url}/${id}/rattachements`, { categories }, this.ctx);
  }

  rattacher(id: number, sousTypes: string[]): Observable<ModelePvFiche> {
    return this.http.put<ModelePvFiche>(`${this.url}/${id}/rattachements`, { sousTypes }, this.ctx);
  }

  archiver(id: number, motif: string | null): Observable<ModelePvFiche> {
    return this.http.post<ModelePvFiche>(`${this.url}/${id}/archiver`, motif ? { motif } : {}, this.ctx);
  }

  /** ⚠️ 21/10 — un brouillon seulement (409 `VERSION_NON_SUPPRIMABLE` sinon) ; rend la fiche sans la version. Son numéro n'est jamais repris. */
  supprimerVersion(id: number, numero: number): Observable<ModelePvFiche> {
    return this.http.delete<ModelePvFiche>(`${this.url}/${id}/versions/${numero}`, this.ctx);
  }

  /** ⚠️ 21/10 — un modèle jamais en vigueur et sans sous-type (409 `MODELE_NON_SUPPRIMABLE` sinon) ; 204. Trace au journal général. */
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, this.ctx);
  }

  /** Le `.docx` tel que déposé. */
  fichier(id: number, numero: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/versions/${numero}/fichier`, { ...this.ctx, responseType: 'blob' });
  }

  /** Les modèles intégrés au backend (fichiers livrés avec le serveur), lus là où le choix se fait. */
  integres(): Observable<ModeleIntegre[]> {
    return this.http.get<ModeleIntegre[]>(`${this.url}/integres`, this.ctx);
  }

  /** Pour chaque sous-type et chaque nature, ce qui produit son document (intégré, géré, rien) et le modèle qui le sert. */
  couverture(): Observable<CouvertureSousType[]> {
    return this.http.get<CouvertureSousType[]>(`${this.url}/couverture`, this.ctx);
  }

  /** Un fichier intégré tel que livré dans le JAR — seuls les noms de la liste servie (404 sinon). */
  fichierIntegre(code: string, nom: string): Observable<Blob> {
    return this.http.get(`${this.url}/integres/${encodeURIComponent(code)}/fichiers/${encodeURIComponent(nom)}`, { ...this.ctx, responseType: 'blob' });
  }

  /**
   * L'aperçu d'un modèle intégré sur un dossier réel — rien n'est enregistré. Le fichier est choisi par la règle de la production
   * (`PvDocumentService.choisirModele`) et nommé par l'en-tête `X-Fichier-Modele`. 409 `PV_ABSENT`, `AUCUN_DOCUMENT` (raison en
   * clair), `LETTRE_ABSENTE`, `CONVERSION_INDISPONIBLE`.
   */
  apercuIntegre(code: string, p: { dossier: number; avis?: AvisApercu | null; format: 'pdf' | 'docx' }): Observable<{ blob: Blob; fichier: string | null }> {
    const params: Record<string, string> = { dossier: String(p.dossier), format: p.format };
    if (p.avis) params['avis'] = p.avis;
    return this.http
      .post(`${this.url}/integres/${encodeURIComponent(code)}/apercu`, {}, { ...this.ctx, params, responseType: 'blob', observe: 'response' })
      .pipe(
        map((r) => ({ blob: r.body ?? new Blob(), fichier: r.headers.get('X-Fichier-Modele') })),
        catchError((e: unknown) => relireErreurBinaire(e)),
      );
  }

  /** Le catalogue des variables, filtré par la famille du sous-type (tout le catalogue sans sous-type). */
  /** ⚠️ 22/10 (L1 « modele-lettre-renvoi ») — `nature` filtre le catalogue : une lettre n'a ni `PV.*` ni listes répétées. */
  variables(sousType?: string | null, nature?: NatureModelePv | null, sigle?: string | null): Observable<CatalogueModelePv> {
    const params: Record<string, string> = {};
    if (sousType) params['sousType'] = sousType;
    if (nature) params['nature'] = nature;
    if (sigle) params['sigle'] = sigle;
    return this.http.get<CatalogueModelePv>(`${this.url}/variables`, { ...this.ctx, params });
  }
}

/** Une erreur sur une réponse binaire porte son `ErrorResponse` dans un `Blob` : on le relit pour garder message et code. */
function relireErreurBinaire(e: unknown): Observable<never> {
  const brut = isApiError(e) ? e.raw : e instanceof HttpErrorResponse ? e : null;
  if (!brut || !(brut.error instanceof Blob)) return throwError(() => e);
  return from(brut.error.text()).pipe(
    switchMap((texte) => {
      let corps: { message?: string; code?: string; details?: unknown } = {};
      try {
        corps = JSON.parse(texte) as typeof corps;
      } catch {
        /* corps non JSON : on garde le message par défaut */
      }
      const err: ApiError = {
        status: brut.status,
        message: corps.message || (isApiError(e) ? e.message : 'L’aperçu n’a pas pu être produit.'),
        code: corps.code,
        raw: new HttpErrorResponse({ error: corps, status: brut.status, statusText: brut.statusText, url: brut.url ?? undefined }),
      };
      return throwError(() => err);
    }),
  );
}
