import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { skipErrorToast } from '../core/errors/api-error';
import { AppliquerImportCorps, ArticleFiche, BilanControles, Cadrage, CategorieDao, ChampFiche, CompteDesignable, Depots, DisponibiliteAvis, Dmc, DocumentFiche, Dossier, FicheMarche, FicheRattachable, ImportDaoResult, LigneEligible, MaterielExige, ParametresInternes, ParametresInternesCorps, PersonnelExige, PieceExigee, PublicationAvis, PublicationLettres, RecuDao, ReferentielFiche, RetraitDao, TypeMarche, VersionFiche } from '../models';
import { CrudService } from './api/crud.service';

/**
 * Fiche DAO d'un appel d'offres — services du CONTRAT PROPOSÉ (`docs/demande-backend-2026-09-22-fiche-marche-dao.md`).
 * ⚠️ Développés contre le contrat, avant livraison backend : les écrans traitent le 404 des routes absentes comme
 * « contrat en attente » (repli sur la structure de l'esquisse), jamais comme une erreur de l'utilisateur.
 */

/** Référentiel des champs (`/api/champs-fiche-marche`) — blocs, rubriques et informations d'un type de marché. */
@Injectable({ providedIn: 'root' })
export class ChampFicheMarcheService extends CrudService<ChampFiche, string> {
  protected readonly resource = 'champs-fiche-marche';

  /**
   * `GET ?typeMarche=&categorie=` → blocs (avec rubriques) + champs actifs. Sans paramètre : tout, inactifs
   * compris (vue d'administration).
   *
   * ⚠️ Lot 5 (24/09) — **les deux axes se demandent ensemble**. Le type seul ne suffit plus : le référentiel porte
   * désormais des champs de plusieurs catégories, et une fiche de fournitures n'a que faire d'un lieu d'exécution
   * de travaux. Silencieux.
   */
  referentiel(typeMarche?: TypeMarche, categorie?: CategorieDao | null): Observable<ReferentielFiche> {
    let params = new HttpParams();
    if (typeMarche) params = params.set('typeMarche', typeMarche);
    if (categorie) params = params.set('categorie', categorie);
    return this.http.get<ReferentielFiche>(this.baseUrl, { params, context: skipErrorToast() });
  }

  /** `POST` — Administrateur ; 400 nominatifs (`code`, `condition`, `options`…) posés par l'écran sous les champs. */
  creer(champ: ChampFiche): Observable<ChampFiche> {
    return this.http.post<ChampFiche>(this.baseUrl, champ, { context: skipErrorToast() });
  }

  /** `PUT /{code}` — Administrateur ; mêmes 400 nominatifs. */
  modifier(code: string, champ: ChampFiche): Observable<ChampFiche> {
    return this.http.put<ChampFiche>(`${this.baseUrl}/${encodeURIComponent(code)}`, champ, { context: skipErrorToast() });
  }
}

/** DMC par ligne de marché (`/api/dmcs`, lot 3a) — ouvert à la PRMP / UGPM par la demande du 22/09 (B2). */
@Injectable({ providedIn: 'root' })
export class DmcService extends CrudService<Dmc> {
  protected readonly resource = 'dmcs';

  /** `GET /eligibles` — lignes de PPM qui peuvent porter un DAO (PV signé, mode mappé DAO, sans DAO). */
  eligibles(): Observable<LigneEligible[]> {
    return this.http.get<LigneEligible[]>(`${this.baseUrl}/eligibles`, { context: skipErrorToast() });
  }

  /** `POST /par-marche/{idDetail}` — crée le DMC (409 : déjà un DAO, mode non mappé, PPM non signé). */
  creerParMarche(idDetail: number): Observable<Dmc> {
    return this.http.post<Dmc>(`${this.baseUrl}/par-marche/${idDetail}`, null);
  }

  /** `GET /par-marche/{idDetail}` (existant). */
  parMarche(idDetail: number): Observable<Dmc> {
    return this.http.get<Dmc>(`${this.baseUrl}/par-marche/${idDetail}`, { context: skipErrorToast() });
  }
}

/** La fiche elle-même (`/api/fiches-marche/{idDmc}`) : cadrage, valeurs par bloc, contrôles, validation, versions. */
@Injectable({ providedIn: 'root' })
export class FicheMarcheService extends CrudService<FicheMarche> {
  protected readonly resource = 'fiches-marche';

  /** `GET /{idDmc}` — 404 = pas encore de fiche (créée au premier PUT). Silencieux. */
  lire(idDmc: number): Observable<FicheMarche> {
    return this.http.get<FicheMarche>(`${this.baseUrl}/${idDmc}`, { context: skipErrorToast() });
  }

  /** `PUT /{idDmc}/cadrage` — fixe le type de marché et les réponses ; 409 si la version est VALIDEE. */
  cadrage(idDmc: number, cadrage: Cadrage): Observable<FicheMarche> {
    return this.http.put<FicheMarche>(`${this.baseUrl}/${idDmc}/cadrage`, { cadrage });
  }

  /** `PUT /{idDmc}/blocs/{bloc}` — valeurs du bloc ; 400 nominatifs par champ (affichés par l'écran, pas de toast). */
  bloc(idDmc: number, bloc: string, valeurs: Record<string, string | number | null>): Observable<FicheMarche> {
    return this.http.put<FicheMarche>(`${this.baseUrl}/${idDmc}/blocs/${bloc}`, { valeurs }, { context: skipErrorToast() });
  }

  /** `POST /{idDmc}/controler` — recalcule le bilan sans écrire. */
  controler(idDmc: number): Observable<BilanControles> {
    return this.http.post<BilanControles>(`${this.baseUrl}/${idDmc}/controler`, null);
  }

  /** `POST /{idDmc}/valider` — PRMP seule ; fige et versionne ; 409 s'il reste un contrôle bloquant. */
  valider(idDmc: number): Observable<FicheMarche> {
    return this.http.post<FicheMarche>(`${this.baseUrl}/${idDmc}/valider`, null);
  }

  /** `POST /{idDmc}/reviser` — nouvelle version brouillon copiée de la dernière validée. */
  reviser(idDmc: number): Observable<FicheMarche> {
    return this.http.post<FicheMarche>(`${this.baseUrl}/${idDmc}/reviser`, null);
  }

  /**
   * `GET /{idDmc}/articles` — le besoin de la fiche (bloc `B12`), tous lots confondus, trié par lot puis
   * ordre. Silencieux : le bloc s'affiche vide plutôt que de lever une boîte d'erreur.
   */
  articles(idDmc: number): Observable<ArticleFiche[]> {
    return this.http.get<ArticleFiche[]>(`${this.baseUrl}/${idDmc}/articles`, { context: skipErrorToast() });
  }

  /**
   * `PUT /{idDmc}/articles?lot=n` — **remplacement en bloc** du besoin d'un lot : la grille envoie ses lignes
   * dans l'ordre affiché, le serveur recrée les articles et pose leur `ordre`. Sans `lot`, c'est tout le
   * besoin d'une ligne non allotie. 400 nominatifs par article (affichés dans la grille, pas en toast).
   */
  enregistrerBesoin(idDmc: number, lot: number | null, articles: ArticleFiche[]): Observable<ArticleFiche[]> {
    const params = lot == null ? undefined : new HttpParams().set('lot', lot);
    return this.http.put<ArticleFiche[]>(`${this.baseUrl}/${idDmc}/articles`, { articles }, { params, context: skipErrorToast() });
  }

  /**
   * ⚠️ Lot 3 du chantier b — livré le 03/10 (V60, `demande-backend-2026-10-03-materiel-personnel-travaux`) :
   * le matériel et le personnel exigés des travaux, deux listes de la version de fiche ; `PUT` remplace la liste.
   */
  materiel(idDmc: number): Observable<MaterielExige[]> {
    return this.http.get<MaterielExige[]>(`${this.baseUrl}/${idDmc}/materiel`, { context: skipErrorToast() });
  }

  enregistrerMateriel(idDmc: number, materiel: MaterielExige[]): Observable<MaterielExige[]> {
    return this.http.put<MaterielExige[]>(`${this.baseUrl}/${idDmc}/materiel`, { materiel }, { context: skipErrorToast() });
  }

  personnel(idDmc: number): Observable<PersonnelExige[]> {
    return this.http.get<PersonnelExige[]>(`${this.baseUrl}/${idDmc}/personnel`, { context: skipErrorToast() });
  }

  enregistrerPersonnel(idDmc: number, personnel: PersonnelExige[]): Observable<PersonnelExige[]> {
    return this.http.put<PersonnelExige[]>(`${this.baseUrl}/${idDmc}/personnel`, { personnel }, { context: skipErrorToast() });
  }

  /**
   * ⚠️ Lot 4 du chantier b — livré le 03/10 (V61, `demande-backend-2026-10-03-pieces-offre-travaux`) : les
   * pièces de l'offre exigées, une liste de la version de fiche ; `PUT` remplace la liste.
   */
  pieces(idDmc: number): Observable<PieceExigee[]> {
    return this.http.get<PieceExigee[]>(`${this.baseUrl}/${idDmc}/pieces`, { context: skipErrorToast() });
  }

  enregistrerPieces(idDmc: number, pieces: PieceExigee[]): Observable<PieceExigee[]> {
    return this.http.put<PieceExigee[]>(`${this.baseUrl}/${idDmc}/pieces`, { pieces }, { context: skipErrorToast() });
  }

  /**
   * ⚠️ Livré le 26/09 — `DELETE /{idDmc}` : supprime une fiche **sans histoire** (jamais validée), avec son besoin
   * et ses valeurs ; la ligne du plan redevient préparable. PRMP propriétaire et son UGPM. Refus à **code stable**
   * (`FICHE_VALIDEE`, `FICHE_AVEC_HISTORIQUE`, `FICHE_AVEC_DOCUMENTS`, `FICHE_AVEC_DOSSIER` qui porte l'`idDossier`) :
   * l'écran les NOMME au lieu de réimplémenter la règle. `DELETE /api/dmcs/{id}` reste 405.
   */
  supprimerFiche(idDmc: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idDmc}`, { context: skipErrorToast() });
  }

  /** `GET /{idDmc}/versions` — versions figées (en-têtes). Silencieux : absente tant que le contrat n'est pas servi. */
  versions(idDmc: number): Observable<VersionFiche[]> {
    return this.http.get<VersionFiche[]>(`${this.baseUrl}/${idDmc}/versions`, { context: skipErrorToast() });
  }

  /** `GET /{idDmc}/versions/{numero}` — une version figée, en entier (livraison du 22/09). */
  version(idDmc: number, numero: number): Observable<FicheMarche> {
    return this.http.get<FicheMarche>(`${this.baseUrl}/${idDmc}/versions/${numero}`);
  }

  /**
   * ⚠️ Lot 1b (23/09) — `POST /{idDmc}/dossier` : la fiche **produit** le dossier à soumettre (entité, localité et
   * PRMP dérivées de la ligne du plan). **PRMP seule** ; 409 à code stable `DMC_NON_DAO`, `DOSSIER_EXISTANT` (qui
   * porte l'`idDossier` déjà lié), `FICHE_NON_VALIDEE` (la **dernière** version doit être validée : une révision
   * ouverte bloque). Silencieux : l'écran traite le 409 lui-même.
   */
  creerDossier(idDmc: number): Observable<Dossier> {
    return this.http.post<Dossier>(`${this.baseUrl}/${idDmc}/dossier`, null, { context: skipErrorToast() });
  }

  /**
   * ⚠️ Lot 2 (demande du 23/09, non encore livrée) — `GET /{idDmc}/documents` : les documents de la version
   * courante, ou d'une version figée avec `?version=`. Une version non validée répond **200 et une liste vide**.
   * Silencieux : tant que la route n'existe pas (404), l'écran replie l'étape sans alarmer l'utilisateur.
   */
  documents(idDmc: number, version?: number): Observable<DocumentFiche[]> {
    const params = version != null ? new HttpParams().set('version', version) : new HttpParams();
    return this.http.get<DocumentFiche[]>(`${this.baseUrl}/${idDmc}/documents`, { params, context: skipErrorToast() });
  }

  /**
   * ⚠️ Soumission en ligne, lot 1 (04/10, §B8, V65) — `GET /{idDmc}/retraits` : le registre des retraits du DAO par
   * les candidats, du plus ancien au plus récent. **PRMP de la fiche seule** : 403 à l'UGPM et à l'Administrateur.
   * Silencieux : l'écran nomme le refus.
   */
  retraits(idDmc: number): Observable<RetraitDao[]> {
    return this.http.get<RetraitDao[]>(`${this.baseUrl}/${idDmc}/retraits`, { context: skipErrorToast() });
  }

  /**
   * ⚠️ V72 (06/10, retrait après paiement, §B3) — `GET /{idDmc}/recus` : les reçus des frais de dossier, les `EN_ATTENTE` d'abord.
   * PRMP **et** UGPM de la fiche. Silencieux : l'écran nomme le refus.
   */
  recus(idDmc: number): Observable<RecuDao[]> {
    return this.http.get<RecuDao[]>(`${this.baseUrl}/${idDmc}/recus`, { context: skipErrorToast() });
  }

  recuFichier(idDmc: number, idRecu: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${idDmc}/recus/${idRecu}/fichier`, { responseType: 'blob', context: skipErrorToast() });
  }

  /** 409 `RECU_DEJA_DECIDE` : une décision ne se reprend pas. */
  validerRecu(idDmc: number, idRecu: number): Observable<RecuDao> {
    return this.http.post<RecuDao>(`${this.baseUrl}/${idDmc}/recus/${idRecu}/valider`, {}, { context: skipErrorToast() });
  }

  /** Motif obligatoire (400 `MOTIF_ABSENT`). */
  refuserRecu(idDmc: number, idRecu: number, motif: string): Observable<RecuDao> {
    return this.http.post<RecuDao>(`${this.baseUrl}/${idDmc}/recus/${idRecu}/refuser`, { motif }, { context: skipErrorToast() });
  }

  /**
   * ⚠️ Lot 3 (V68) — `GET /{idDmc}/depots` : avant la date limite, **le nombre seul** (`depots = null`) ; après, le registre.
   * PRMP et UGPM de la fiche, responsable de la procédure ; 403 aux autres. Silencieux.
   */
  depots(idDmc: number): Observable<Depots> {
    return this.http.get<Depots>(`${this.baseUrl}/${idDmc}/depots`, { context: skipErrorToast() });
  }

  /**
   * ⚠️ Avis spécifique (30/09, V56) — `GET /{idDmc}/avis-specifique/disponibilite` : toujours 200 (PRMP et UGPM du
   * périmètre ; 403 aux autres). Silencieux : l'écran se tait s'il ne peut pas le lire.
   */
  disponibiliteAvis(idDmc: number): Observable<DisponibiliteAvis> {
    return this.http.get<DisponibiliteAvis>(`${this.baseUrl}/${idDmc}/avis-specifique/disponibilite`, { context: skipErrorToast() });
  }

  /**
   * `POST /{idDmc}/avis-specifique` — produit l'avis (docx et pdf) sur la dernière version validée. 400 nominatif
   * (`datePublication`, `jmpNumero`, `jmpDate`, `supports`), 409 `AVIS_INDISPONIBLE` (`details.raison`). Silencieux.
   */
  imprimerAvis(idDmc: number, corps: PublicationAvis): Observable<DocumentFiche[]> {
    return this.http.post<DocumentFiche[]>(`${this.baseUrl}/${idDmc}/avis-specifique`, corps, { context: skipErrorToast() });
  }

  /**
   * ⚠️ Lettres d'invitation (01/10, lot AV-4) — `GET /{idDmc}/lettres-invitation/disponibilite`, même forme que celle
   * de l'avis ; `CATEGORIE_SANS_LETTRE` hors prestations intellectuelles. Silencieux.
   */
  disponibiliteLettres(idDmc: number): Observable<DisponibiliteAvis> {
    return this.http.get<DisponibiliteAvis>(`${this.baseUrl}/${idDmc}/lettres-invitation/disponibilite`, { context: skipErrorToast() });
  }

  /**
   * `POST /{idDmc}/lettres-invitation` — une paire .docx/.pdf PAR candidat. 400 nominatif (`dateEnvoi`, `lieu`,
   * `candidats`, `candidats[i].nom` / `.adresse`, indices à partir de 0), 409 `LETTRE_INDISPONIBLE` (`details.raison`).
   */
  imprimerLettres(idDmc: number, corps: Omit<PublicationLettres, 'rang'>): Observable<DocumentFiche[]> {
    return this.http.post<DocumentFiche[]>(`${this.baseUrl}/${idDmc}/lettres-invitation`, corps, { context: skipErrorToast() });
  }

  /** `GET /documents/{idDocument}/contenu` — le binaire, à ouvrir ou enregistrer par `fichiers-surs`. */
  contenuDocument(idDocument: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/documents/${idDocument}/contenu`, { responseType: 'blob', context: skipErrorToast() });
  }

  /** `GET /rattachables` — fiches validées et non liées du périmètre (PRMP et UGPM ; 403 aux autres). Silencieux. */
  rattachables(): Observable<FicheRattachable[]> {
    return this.http.get<FicheRattachable[]>(`${this.baseUrl}/rattachables`, { context: skipErrorToast() });
  }

  // ── Remise électronique (27/09, demande §B4 et §B5) — développé CONTRE le contrat, avant livraison ──────────

  /**
   * `GET /{idDmc}/parametres-internes` — réservé au **responsable de la procédure** : 403 à tout autre lecteur,
   * Administrateur compris ; 404 tant que la route n'est pas servie. Silencieux : l'écran nomme le refus lui-même.
   */
  parametresInternes(idDmc: number): Observable<ParametresInternes> {
    return this.http.get<ParametresInternes>(`${this.baseUrl}/${idDmc}/parametres-internes`, { context: skipErrorToast() });
  }

  /** `PUT /{idDmc}/parametres-internes` — 400 nominatifs (`membresCommission`, `quorum`, `dateCeremonie`), 409 `MEMBRE_COMMISSION` / `FICHE_VALIDEE`. */
  enregistrerParametresInternes(idDmc: number, corps: ParametresInternesCorps): Observable<ParametresInternes> {
    return this.http.put<ParametresInternes>(`${this.baseUrl}/${idDmc}/parametres-internes`, corps, { context: skipErrorToast() });
  }

  /** ⚠️ V71 — renvoie l'invitation au dépositaire (responsable) ; 409 `DEJA_ACTIF` / `DEPOSITAIRE_ABSENT` (sans adresse). */
  inviterDepositaire(idDmc: number): Observable<ParametresInternes> {
    return this.http.post<ParametresInternes>(`${this.baseUrl}/${idDmc}/parametres-internes/depositaire/inviter`, null, { context: skipErrorToast() });
  }

  /**
   * ⚠️ Import du DAO (28/09) — `POST /{idDmc}/import`, multipart `fichier` (.docx) : LECTURE SEULE, le serveur rend des
   * propositions ; rien n'est écrit. 415 `FORMAT_NON_SUPPORTE`, 409 `FICHE_VALIDEE`, 422 `MODELE_ABSENT`, 403. Silencieux.
   */
  importerDao(idDmc: number, fichier: File): Observable<ImportDaoResult> {
    const corps = new FormData();
    corps.append('fichier', fichier, fichier.name);
    return this.http.post<ImportDaoResult>(`${this.baseUrl}/${idDmc}/import`, corps, { context: skipErrorToast() });
  }

  /** `PUT /{idDmc}/import/appliquer` — écrit d'un seul coup les lignes retenues (fusion ; 400 nominatif, rien d'écrit). */
  appliquerImport(idDmc: number, corps: AppliquerImportCorps): Observable<FicheMarche> {
    return this.http.put<FicheMarche>(`${this.baseUrl}/${idDmc}/import/appliquer`, corps, { context: skipErrorToast() });
  }

  // ⚠️ Lot 2a (04/10, V67) — `GET /{idDmc}/parametres-internes/candidats` répond **410 Gone** : les détenteurs de parts sont
  // les membres de la commission d'appel d'offres, désignés par la PRMP (`/cao`), le responsable ne les choisit plus.

  /** `GET /{idDmc}/responsable/candidats` — comptes désignables comme responsable, hors commission (Administrateur). */
  candidatsResponsable(idDmc: number): Observable<CompteDesignable[]> {
    return this.http.get<CompteDesignable[]>(`${this.baseUrl}/${idDmc}/responsable/candidats`, { context: skipErrorToast() });
  }

  /** `POST /{idDmc}/responsable` `{ im }` (Administrateur) — 409 `RESPONSABLE_EXISTANT` / `MEMBRE_COMMISSION`, 404 compte inconnu. */
  designerResponsable(idDmc: number, im: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${idDmc}/responsable`, { im }, { context: skipErrorToast() });
  }

  /** `DELETE /{idDmc}/responsable` (Administrateur) — 404 s'il n'y a pas de titulaire. */
  retirerResponsable(idDmc: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idDmc}/responsable`, { context: skipErrorToast() });
  }
}
