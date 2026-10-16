import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../environments/environment';
import { skipErrorToast } from '../core/errors/api-error';
import {
  Attribution,
  DossierSoumis,
  dossierSoumis,
  Explication,
  InfructuositeCorps,
  SansSuite,
  PiecesAttributaire,
  TypePieceAttributaire,
  ResultatOffre,
  ResultatPublic,
  CodeVerification,
  DecisionCritere,
  DemandeEvaluation,
  EntreeJournalEvaluation,
  EtapeEvaluation,
  Evaluation,
  EstimationEvaluation,
  IndicateursPrix,
  LigneTableau,
  MontantRequest,
  Qualification,
  QualificationRejet,
  CoteConformite,
  SpecificationOffre,
} from '../models';

/**
 * Corps de `PUT …/conformite`. ⚠️ Guide de la CAO (§B3) : la `cote` fixe `satisfaite` ; les `specifications` cotées partent dans le
 * même PUT, qui remplace toute la décision (renvoyer toutes les cotes à chaque enregistrement).
 */
export interface ConformiteCorps {
  verifications: { code: CodeVerification; cote?: CoteConformite | null; satisfaite?: boolean | null; observation?: string | null }[];
  specifications?: { idArticle: number; idCaracteristique: number; cote: CoteConformite; observation?: string | null }[];
  decision: 'CONFORME' | 'ECARTEE';
  qualification?: QualificationRejet | null;
  motif?: string | null;
  clause?: string | null;
}

/** Corps de `PUT …/qualification`. */
export interface QualificationCorps {
  criteres: { code: string; decision: DecisionCritere; motif?: string | null }[];
  decision: 'QUALIFIE' | 'NON_QUALIFIE';
  motif?: string | null;
  clause?: string | null;
}

/**
 * ⚠️ Évaluation des offres, lot 1 (V76-V78) — `/api/fiches-marche/{idDmc}/evaluation/**`. Silencieux : l'écran nomme chaque refus
 * (codes du contrat). Le serveur garde par identité : membre de la CAO déclaré sans conflit pour décider, président pour arrêter,
 * responsable pour ouvrir et produire le rapport, PRMP pour les demandes aux candidats.
 */
@Injectable({ providedIn: 'root' })
export class EvaluationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/fiches-marche`;
  private readonly ctx = { context: skipErrorToast() };

  private url(idDmc: number, suite = ''): string {
    return `${this.base}/${idDmc}/evaluation${suite}`;
  }

  /** 404 tant que l'évaluation n'est pas ouverte. */
  lire(idDmc: number): Observable<Evaluation> {
    return this.http.get<Evaluation>(this.url(idDmc), this.ctx);
  }

  /** Responsable : 409 `SEANCE_NON_CLOSE`, `EVALUATION_DEJA_OUVERTE`. */
  ouvrir(idDmc: number): Observable<Evaluation> {
    return this.http.post<Evaluation>(this.url(idDmc, '/ouvrir'), null, this.ctx);
  }

  /** Membre de la CAO, une fois : 409 `DEJA_DECLARE`. */
  declarer(idDmc: number, conflit: boolean, precision: string | null): Observable<Evaluation> {
    return this.http.post<Evaluation>(this.url(idDmc, '/declaration'), { conflit, precision }, this.ctx);
  }

  /** Président : 409 `ETAPE_INCOMPLETE` (`details.offres`), `ETAPE_PRECEDENTE_OUVERTE`, `EGALITE_A_DEPARTAGER`, `ETAPE_ARRETEE`. */
  arreter(idDmc: number, lot: number, etape: EtapeEvaluation, observation: string | null): Observable<Evaluation> {
    return this.http.post<Evaluation>(this.url(idDmc, `/lots/${lot}/etapes/${etape}/arreter`), { observation }, this.ctx);
  }

  /** Président, motif obligatoire : rouvre l'étape et les suivantes du lot. 409 `RAPPORT_SIGNE`, `ETAPE_NON_ARRETEE`. */
  rouvrir(idDmc: number, lot: number, etape: EtapeEvaluation, motif: string): Observable<Evaluation> {
    return this.http.post<Evaluation>(this.url(idDmc, `/lots/${lot}/etapes/${etape}/rouvrir`), { motif }, this.ctx);
  }

  /** ⚠️ Guide de la CAO (§B3.2) — les spécifications techniques d'une offre, à coter (vide pour une offre déposée par pièces). */
  specifications(idDmc: number, idOffre: string): Observable<SpecificationOffre[]> {
    return this.http.get<SpecificationOffre[]>(this.url(idDmc, `/offres/${idOffre}/specifications`), this.ctx);
  }

  conformite(idDmc: number, idOffre: string, corps: ConformiteCorps): Observable<Evaluation> {
    return this.http.put<Evaluation>(this.url(idDmc, `/offres/${idOffre}/conformite`), corps, this.ctx);
  }

  /** PRMP (art. 35-VI) : 201 ; délai de la fiche par défaut (400 `DELAI_OBLIGATOIRE` sans délai). */
  demanderPrecision(idDmc: number, idOffre: string, question: string, delaiJours: number | null): Observable<DemandeEvaluation> {
    return this.http.post<DemandeEvaluation>(this.url(idDmc, `/offres/${idOffre}/precisions`), { question, delaiJours }, this.ctx);
  }

  precisions(idDmc: number, idOffre: string): Observable<DemandeEvaluation[]> {
    return this.http.get<DemandeEvaluation[]>(this.url(idDmc, `/offres/${idOffre}/precisions`), this.ctx);
  }

  /** Le fichier joint à la réponse d'un candidat — à ouvrir par `ouvrirBlobSur`. */
  fichierDemande(idDmc: number, idDemande: number): Observable<Blob> {
    return this.http.get(this.url(idDmc, `/demandes/${idDemande}/fichier`), { responseType: 'blob', context: skipErrorToast() });
  }

  /** CAO, responsable, PRMP (403 pour l'UGPM). */
  journal(idDmc: number): Observable<EntreeJournalEvaluation[]> {
    return this.http.get<EntreeJournalEvaluation[]>(this.url(idDmc, '/journal'), this.ctx);
  }

  /** 409 `OFFRE_ECARTEE` ; `[]` pour une offre sans bordereau. */
  correctionsProposees(idDmc: number, idOffre: string): Observable<MontantRequest['corrections']> {
    return this.http.get<MontantRequest['corrections']>(this.url(idDmc, `/offres/${idOffre}/corrections-proposees`), this.ctx);
  }

  montant(idDmc: number, idOffre: string, corps: MontantRequest): Observable<Evaluation> {
    return this.http.put<Evaluation>(this.url(idDmc, `/offres/${idOffre}/montant`), corps, this.ctx);
  }

  /** Q5 : la CAO départage des ex aequo, avec un motif. 400 `ORDRE_INVALIDE`. */
  departager(idDmc: number, lot: number, ordre: string[], motif: string): Observable<Evaluation> {
    return this.http.post<Evaluation>(this.url(idDmc, `/lots/${lot}/departage`), { ordre, motif }, this.ctx);
  }

  tableau(idDmc: number, lot: number): Observable<LigneTableau[]> {
    return this.http.get<LigneTableau[]>(this.url(idDmc, `/lots/${lot}/tableau`), this.ctx);
  }

  /** ⚠️ Q11 (B4, V116) — l'estimation détaillée de la PRMP (lecteurs de l'évaluation ; 404 sans estimation). */
  estimation(idDmc: number, lot: number): Observable<EstimationEvaluation> {
    return this.http.get<EstimationEvaluation>(`${this.base}/${idDmc}/evaluation/lots/${lot}/estimation`, this.ctx);
  }

  indicateursPrix(idDmc: number, lot: number): Observable<IndicateursPrix> {
    return this.http.get<IndicateursPrix>(this.url(idDmc, `/lots/${lot}/indicateurs-prix`), this.ctx);
  }

  /** PRMP (art. 48), une par offre : 201 ; 409 `DEJA_DEMANDEE`. */
  demanderJustification(idDmc: number, idOffre: string, elements: string, delaiJours: number | null): Observable<DemandeEvaluation> {
    return this.http.post<DemandeEvaluation>(this.url(idDmc, `/offres/${idOffre}/justification`), { elements, delaiJours }, this.ctx);
  }

  justifications(idDmc: number, idOffre: string): Observable<DemandeEvaluation[]> {
    return this.http.get<DemandeEvaluation[]>(this.url(idDmc, `/offres/${idOffre}/justification`), this.ctx);
  }

  /** 409 `JUSTIFICATION_NON_DEMANDEE`, `DELAI_EN_COURS` : aucun rejet sans demande écrite. */
  anormale(idDmc: number, idOffre: string, suspectee: boolean, decision: 'MAINTENUE' | 'REJETEE' | null, motif: string | null): Observable<Evaluation> {
    return this.http.put<Evaluation>(this.url(idDmc, `/offres/${idOffre}/anormale`), { suspectee, decision, motif }, this.ctx);
  }

  /** L'offre dont c'est le tour ; 409 `CLASSEMENT_NON_ARRETE`. */
  qualificationDuLot(idDmc: number, lot: number): Observable<Qualification> {
    return this.http.get<Qualification>(this.url(idDmc, `/lots/${lot}/qualification`), this.ctx);
  }

  qualifier(idDmc: number, idOffre: string, corps: QualificationCorps): Observable<Evaluation> {
    return this.http.put<Evaluation>(this.url(idDmc, `/offres/${idOffre}/qualification`), corps, this.ctx);
  }

  /** Responsable : 409 `ETAPES_INCOMPLETES` (`details.lots`), `RAPPORT_DEJA_PRODUIT`. */
  produireRapport(idDmc: number, observations: string | null): Observable<Evaluation> {
    return this.http.post<Evaluation>(this.url(idDmc, '/rapport'), { observations }, this.ctx);
  }

  rapport(idDmc: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    const params = format === 'docx' ? new HttpParams().set('format', 'docx') : new HttpParams();
    return this.http.get(this.url(idDmc, '/rapport'), { params, responseType: 'blob', context: skipErrorToast() });
  }

  /** Membre appelé : 403 `NON_SIGNATAIRE`, 409 `DEJA_SIGNE`, `RAPPORT_NON_PRODUIT`. */
  signerRapport(idDmc: number, observation: string | null): Observable<Evaluation> {
    return this.http.post<Evaluation>(this.url(idDmc, '/rapport/signer'), { observation }, this.ctx);
  }

  /**
   * ⚠️ V120 (§B5) — président, ou son représentant désigné pour le rapport : retire le rapport avant la dernière signature (les
   * signatures tombent, l'évaluation reprend). 400 `MOTIF_OBLIGATOIRE`, 403, 409 `RAPPORT_NON_PRODUIT`, `RAPPORT_SIGNE`.
   */
  retirerRapport(idDmc: number, motif: string): Observable<Evaluation> {
    return this.http.post<Evaluation>(this.url(idDmc, '/rapport/retirer'), { motif }, this.ctx);
  }

  /** Un rapport retiré (PDF, ou Word). */
  rapportRetire(idDmc: number, id: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    const params = format === 'docx' ? new HttpParams().set('format', 'docx') : new HttpParams();
    return this.http.get(this.url(idDmc, `/rapport/retires/${id}`), { params, responseType: 'blob', context: skipErrorToast() });
  }

  /** Président (à défaut, le responsable) : 400 `MOTIF_ABSENT`, `NON_SIGNATAIRE`. */
  constaterEmpechement(idDmc: number, im: string, motif: string): Observable<Evaluation> {
    return this.http.post<Evaluation>(this.url(idDmc, '/rapport/empechement'), { im, motif }, this.ctx);
  }
}

/** Côté candidat : les demandes reçues sur une de ses offres, et sa réponse (texte, et une pièce PDF, JPEG ou PNG). */
@Injectable({ providedIn: 'root' })
export class CandidatDemandesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/candidat/offres`;
  private readonly ctx = { context: skipErrorToast() };

  precisions(idOffre: string): Observable<DemandeEvaluation[]> {
    return this.http.get<DemandeEvaluation[]>(`${this.base}/${idOffre}/precisions`, this.ctx);
  }

  justifications(idOffre: string): Observable<DemandeEvaluation[]> {
    return this.http.get<DemandeEvaluation[]>(`${this.base}/${idOffre}/justification`, this.ctx);
  }

  /** 400 `TEXTE_OBLIGATOIRE` / `FORMAT_INVALIDE`, 409 `DEJA_REPONDU` / `DELAI_DEPASSE`, 413. */
  repondre(idOffre: string, demande: DemandeEvaluation, texte: string, fichier: File | null): Observable<DemandeEvaluation> {
    const fd = new FormData();
    fd.append('texte', texte);
    if (fichier) fd.append('fichier', fichier, fichier.name);
    const suite = demande.type === 'JUSTIFICATION' ? 'justification/reponse' : `precisions/${demande.idDemande}/reponse`;
    return this.http.post<DemandeEvaluation>(`${this.base}/${idOffre}/${suite}`, fd, this.ctx);
  }
}

/**
 * ⚠️ Attribution, lot 2, tranche 2a (V79) — `/api/fiches-marche/{idDmc}/attribution/**` : l'état de chaque lot après l'évaluation, le
 * dossier de marché (famille `DDM`) créé par la PRMP ou son UGPM, le projet de marché produit par le serveur. Silencieux.
 */
@Injectable({ providedIn: 'root' })
export class AttributionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/fiches-marche`;
  private readonly ctx = { context: skipErrorToast() };

  lire(idDmc: number): Observable<Attribution> {
    return this.http.get<Attribution>(`${this.base}/${idDmc}/attribution`, { context: skipErrorToast() });
  }

  /**
   * ⚠️ R9c (14/10) — le dossier de marché soumis qui ferme la séance, l'évaluation et l'AMI ; nul sans lui, et nul quand
   * l'attribution ne se lit pas (évaluation non ouverte : 404 ; profil sans lecture) — le serveur reste la garde.
   */
  dossierSoumis(idDmc: number): Observable<DossierSoumis | null> {
    return this.lire(idDmc).pipe(
      map(dossierSoumis),
      catchError(() => of(null)),
    );
  }

  /** 201 avec l'attribution ; 409 `EVALUATION_NON_CLOSE`, `LOT_INFRUCTUEUX`, `DOSSIER_EXISTANT` (avec `idDossier`). */
  creerDossier(idDmc: number, lot: number): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.base}/${idDmc}/attribution/lots/${lot}/dossier`, null, { context: skipErrorToast() });
  }

  /** Le projet de marché, PDF (ou Word) — 404 tant qu'il n'est pas produit. */
  projet(idDmc: number, lot: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    return this.blob(`${this.lotUrl(idDmc, lot)}/projet`, format);
  }

  /**
   * ⚠️ 10/10 — refaire le projet de marché (loi n° 2016-055, art. 28 et 60) : PDF et Word reproduits, la pièce `PROJET_MARCHE` du
   * dossier de marché remplacée s'il est encore modifiable. PRMP ou UGPM ; 404 sans dossier de marché ; 409 `MARCHE_SIGNE`.
   */
  refaireProjet(idDmc: number, lot: number): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/projet`, null, this.ctx);
  }

  // ── Tranche 2b (V80) : attribuer, informer, explications. Tous les gestes : PRMP de la fiche seule. ──

  /** 409 `AVIS_NON_RENDU`, `AVIS_DEFAVORABLE`, `OFFRE_NON_PROPOSEE`, `LOT_INFRUCTUEUX`, `DEJA_ATTRIBUE` (Q4 : l'offre proposée seule). */
  // ⚠️ MT-b1 (V122, 15/10) — contrat-cadre multi-attributaire : `titulaires` = les offres retenues parmi les proposées (absent : toutes) ;
  // 400 `MOTIF_OBLIGATOIRE` si une partie seulement, `TITULAIRES_TROP_NOMBREUX` au-delà de B07-MA-08 ; 409 `OFFRE_NON_PROPOSEE` (`details.offres`).
  attribuer(idDmc: number, lot: number, motif: string | null, titulaires: string[] | null = null): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/attribuer`, titulaires ? { motif, titulaires } : { motif }, this.ctx);
  }

  /** Lettres produites et signées, délai de dix jours francs ; 400 `DATE_AFFICHAGE_OBLIGATOIRE` / `_INVALIDE`, 409 `DEJA_INFORME`. */
  informer(idDmc: number, lot: number, dateAffichage: string): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/informer`, { dateAffichage }, this.ctx);
  }

  lettre(idDmc: number, lot: number, idOffre: string, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    return this.blob(`${this.lotUrl(idDmc, lot)}/lettres/${idOffre}`, format);
  }

  /** 409 `DEJA_REPONDU` ; fichier PDF, JPEG ou PNG facultatif. */
  repondreExplication(idDmc: number, id: number, texte: string, fichier: File | null): Observable<unknown> {
    return this.http.post(`${this.base}/${idDmc}/attribution/explications/${id}/reponse`, this.formulaire({ texte }, fichier), this.ctx);
  }

  fichierExplication(idDmc: number, id: number): Observable<Blob> {
    return this.blob(`${this.base}/${idDmc}/attribution/explications/${id}/fichier`);
  }

  // ── Tranche 2c (V81) : mise au point, recours, pièces de l'attributaire, signature, enregistrement, notification, avis. ──

  miseAuPoint(idDmc: number, lot: number, rapport: string, fichier: File | null): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/mise-au-point`, this.formulaire({ rapport }, fichier), this.ctx);
  }

  /** `REEXAMEN` n'arrête rien (réponse sous 10 jours) ; `REVISION_ARMP` et `REFERE` suspendent la signature, 20 jours au plus. */
  declarerRecours(idDmc: number, lot: number, r: { type: string; dateReception: string; requerant: string; objet: string }, fichier: File | null): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/recours`, this.formulaire(r, fichier), this.ctx);
  }

  deciderRecours(idDmc: number, lot: number, id: number, d: { date: string; issue: string; motif: string }, fichier: File | null): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/recours/${id}/decision`, this.formulaire(d, fichier), this.ctx);
  }

  verifierPiece(idDmc: number, lot: number, id: number, conforme: boolean, motif: string | null): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/pieces/${id}/verifier`, { conforme, motif }, this.ctx);
  }

  /** Art. 20-I : après l'échéance des pièces, si elles ne sont pas toutes deux conformes ; 409 `DELAI_EN_COURS`, `PIECES_CONFORMES`. */
  // ⚠️ MT-b2 (V123, 16/10) — en multi-attributaire, `idOffre` (obligatoire) retire UN titulaire : le contrat-cadre continue avec les autres.
  retirer(idDmc: number, lot: number, motif: string, idOffre: string | null = null): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/retirer`, idOffre ? { motif, idOffre } : { motif }, this.ctx);
  }

  // ── 2d-1 (V91) : infructuosité, reprise après avis défavorable ; 2d-2 (V92) : réattribution après retrait ──

  /** PRMP seule : le lot proposé infructueux par le rapport, ou au dossier de marché refusé (`DEF`) ; jamais après l'attribution. */
  declarerInfructueux(idDmc: number, lot: number, corps: InfructuositeCorps): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/infructueux`, corps, this.ctx);
  }

  /** PRMP seule, après un avis défavorable : l'évaluation se rouvre en entier, le rapport signé est archivé. */
  reprendre(idDmc: number, lot: number, motif: string): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/reprendre`, { motif }, this.ctx);
  }

  /** PRMP seule, après le retrait du marché : au candidat suivant (409 `AUCUN_SUIVANT_ELIGIBLE`, `OFFRE_EXPIREE`). */
  reattribuer(idDmc: number, lot: number, motif: string): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/reattribuer`, { motif }, this.ctx);
  }

  /** Le rapport archivé d'une reprise (PDF, ou Word). */
  rapportArchive(idDmc: number, idReprise: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    const params = format === 'docx' ? new HttpParams().set('format', 'docx') : new HttpParams();
    return this.http.get(`${this.base}/${idDmc}/attribution/reprises/${idReprise}/rapport`, { params, responseType: 'blob', context: skipErrorToast() });
  }

  // ── 2d-3 (V93) : la déclaration sans suite ──

  sansSuite(idDmc: number): Observable<SansSuite> {
    return this.http.get<SansSuite>(`${this.base}/${idDmc}/sans-suite`, this.ctx);
  }

  /** PRMP seule : crée le dossier DSS (brouillon) avec la pièce des motifs ; à soumettre par le circuit. */
  demanderSansSuite(idDmc: number, motifs: string): Observable<SansSuite> {
    return this.http.post<SansSuite>(`${this.base}/${idDmc}/sans-suite`, { motifs }, this.ctx);
  }

  /** PRMP seule, après l'avis favorable : la procédure est close sans suite. */
  declarerSansSuite(idDmc: number, decision: { reference: string; date: string }): Observable<SansSuite> {
    return this.http.post<SansSuite>(`${this.base}/${idDmc}/sans-suite/declarer`, { decision }, this.ctx);
  }

  motifsSansSuite(idDmc: number, id: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    const params = format === 'docx' ? new HttpParams().set('format', 'docx') : new HttpParams();
    return this.http.get(`${this.base}/${idDmc}/sans-suite/${id}/motifs`, { params, responseType: 'blob', context: skipErrorToast() });
  }

  /** 409 `DELAI_ATTENTE`, `RECOURS_EN_COURS`, `PIECES_NON_CONFORMES`. */
  signer(idDmc: number, lot: number, dateSignature: string, fichier: File): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/signature`, this.formulaire({ dateSignature }, fichier), this.ctx);
  }

  enregistrer(idDmc: number, lot: number, dateEnregistrement: string, reference: string | null, fichier: File): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/enregistrement`, this.formulaire({ dateEnregistrement, reference: reference ?? '' }, fichier), this.ctx);
  }

  /**
   * ⚠️ R10 (V113, 14/10) — l'original signé de l'acte d'engagement reçu par la PRMP (scan) : `dateRemise` facultative (pas à venir).
   * 400 `DATE_INVALIDE`, `FICHIER_OBLIGATOIRE` ; 409 `NON_INFORME`, `DEJA_SIGNE`, `LOT_RETIRE`. Vérifié ensuite comme une pièce.
   */
  // ⚠️ MT-b2 (V123) — `idOffre` : le titulaire dont c'est l'original, obligatoire en multi-attributaire (400 `TITULAIRE_OBLIGATOIRE`, 409 `NON_TITULAIRE`).
  deposerAeOriginal(idDmc: number, lot: number, dateRemise: string | null, fichier: File, idOffre: string | null = null): Observable<Attribution> {
    const champs: Record<string, string> = {};
    if (dateRemise) champs['dateRemise'] = dateRemise;
    if (idOffre) champs['idOffre'] = idOffre;
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/acte-engagement-original`, this.formulaire(champs, fichier), this.ctx);
  }

  /**
   * ⚠️ R9a (V111, 14/10) — l'approbation du marché (PRMP) : `autorite`, `dateApprobation` entre la signature et aujourd'hui, la décision
   * en fichier. 400 `CHAMP_OBLIGATOIRE`, `CHAMP_TROP_LONG`, `DATE_INVALIDE`, `FICHIER_OBLIGATOIRE` ; 409 `NON_SIGNE`, `DEJA_APPROUVE`,
   * `DEJA_NOTIFIE`.
   */
  approuver(idDmc: number, lot: number, autorite: string, dateApprobation: string, fichier: File): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/approbation`, this.formulaire({ autorite, dateApprobation }, fichier), this.ctx);
  }

  /** 409 `MARCHE_NON_APPROUVE` (R9a), `NON_ENREGISTRE` : aucune notification sans approbation ni enregistrement (art. 54). */
  notifier(idDmc: number, lot: number, dateNotification: string, dateReception: string | null): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/notification`, { dateNotification, dateReception }, this.ctx);
  }

  publierAvis(idDmc: number, lot: number, datePublication: string): Observable<Attribution> {
    return this.http.post<Attribution>(`${this.lotUrl(idDmc, lot)}/avis`, { datePublication }, this.ctx);
  }

  avis(idDmc: number, lot: number, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    return this.blob(`${this.lotUrl(idDmc, lot)}/avis`, format);
  }

  fichier(idDmc: number, id: number): Observable<Blob> {
    return this.blob(`${this.base}/${idDmc}/attribution/pieces/${id}/fichier`);
  }

  private lotUrl(idDmc: number, lot: number): string {
    return `${this.base}/${idDmc}/attribution/lots/${lot}`;
  }

  private blob(url: string, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    const params = format === 'docx' ? new HttpParams().set('format', 'docx') : new HttpParams();
    return this.http.get(url, { params, responseType: 'blob', context: skipErrorToast() });
  }

  private formulaire(champs: Record<string, string>, fichier: File | null): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(champs)) if (v != null && v !== '') fd.append(k, v);
    if (fichier) fd.append('fichier', fichier, fichier.name);
    return fd;
  }
}

/** Côté candidat (tranches 2b, 2c) : son résultat, sa lettre, ses explications ; attributaire : ses pièces et le marché signé. */
@Injectable({ providedIn: 'root' })
export class CandidatResultatService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/candidat/offres`;
  private readonly ctx = { context: skipErrorToast() };

  /** 404 avant l'information des candidats. */
  resultat(idOffre: string): Observable<ResultatOffre> {
    return this.http.get<ResultatOffre>(`${this.base}/${idOffre}/resultat`, this.ctx);
  }

  /** La lire vaut accusé de lecture. */
  lettre(idOffre: string, format: 'pdf' | 'docx' = 'pdf'): Observable<Blob> {
    const params = format === 'docx' ? new HttpParams().set('format', 'docx') : new HttpParams();
    return this.http.get(`${this.base}/${idOffre}/resultat/lettre`, { params, responseType: 'blob', context: skipErrorToast() });
  }

  explications(idOffre: string): Observable<Explication[]> {
    return this.http.get<Explication[]>(`${this.base}/${idOffre}/explications`, this.ctx);
  }

  /** Candidat non retenu, une fois informé : 409 `NON_INFORME`, `OFFRE_RETENUE`. */
  demanderExplication(idOffre: string, question: string): Observable<Explication> {
    return this.http.post<Explication>(`${this.base}/${idOffre}/explication`, { question }, this.ctx);
  }

  fichierExplication(idOffre: string, id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${idOffre}/explications/${id}/fichier`, { responseType: 'blob', context: skipErrorToast() });
  }

  /**
   * Attributaire : 400 `PIECE_PERIMEE`, `FORMAT_INVALIDE` ; 409 `DELAI_DEPASSE`, `DEJA_SIGNE`, `LOT_RETIRE`. ⚠️ R10 (V113) —
   * `ACTE_ENGAGEMENT_ORIGINAL` : sans l'échéance de 15 jours ; `dateDelivrance` = date de remise, facultative (défaut : aujourd'hui).
   */
  deposerPiece(idOffre: string, type: TypePieceAttributaire, dateDelivrance: string | null, fichier: File): Observable<PiecesAttributaire> {
    const fd = new FormData();
    fd.append('type', type);
    if (dateDelivrance) fd.append('dateDelivrance', dateDelivrance);
    fd.append('fichier', fichier, fichier.name);
    return this.http.post<PiecesAttributaire>(`${this.base}/${idOffre}/pieces-attributaire`, fd, this.ctx);
  }

  pieceFichier(idOffre: string, id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${idOffre}/pieces-attributaire/${id}/fichier`, { responseType: 'blob', context: skipErrorToast() });
  }

  /** Le marché signé : le lire après la notification vaut réception (date d'effet, art. 54). */
  marche(idOffre: string): Observable<Blob> {
    return this.http.get(`${this.base}/${idOffre}/marche`, { responseType: 'blob', context: skipErrorToast() });
  }
}

/** Public, sans session : les résultats d'une procédure en ligne et ses avis d'attribution. */
@Injectable({ providedIn: 'root' })
export class ResultatsPublicsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/procedures-en-ligne`;

  resultats(idDmc: number): Observable<ResultatPublic[]> {
    return this.http.get<ResultatPublic[]>(`${this.base}/${idDmc}/resultats`, { context: skipErrorToast() });
  }

  avis(idDmc: number, lot: number | null): Observable<Blob> {
    return this.http.get(`${this.base}/${idDmc}/avis-attribution/${lot ?? 1}`, { responseType: 'blob', context: skipErrorToast() });
  }
}
