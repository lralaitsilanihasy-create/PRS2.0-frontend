import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, Subject, catchError, concatMap, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, estConflitVersion } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { urlBlobSure } from '../../core/securite/fichiers-surs';
import {
  Avis,
  Capm,
  Chronometrage,
  DelaiStandard,
  Dossier,
  Examen,
  ExamenDetail,
  ExamenPiece,
  Marche,
  MarchePrevision,
  ModePassation,
  ObservationControle,
  PieceJointeDossier,
  PointsCtrl,
  Ppm,
  PvExamen,
  ServiceBeneficiaire,
  TypeChangementLigne,
  PerimetreExamen,
} from '../../models';
import {
  AvisService,
  CapmService,
  DelaiStandardService,
  DispatchService,
  DossierService,
  EntiteContractService,
  ExamenDetailService,
  ExamenPieceService,
  ExamenService,
  LocaliteService,
  MarcheService,
  MarchePrevisionService,
  MiseAJourPpmService,
  ModePassationService,
  NatureService,
  PieceJointeDossierService,
  PointsCtrlService,
  PpmService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
  ServiceBeneficiaireService,
  TypeDossierService,
} from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { examenRectifiable } from '../../shared/circuit';
import { PpmMarchesTable, RowExamState } from '../../shared/prmp/ppm-marches-table';
import { calculerFichePresentation } from '../../shared/prmp/fiche-presentation';
import { calculerAgpm } from '../../shared/prmp/agpm';
import { FichePresentationDoc } from '../../shared/prmp/fiche-presentation-doc';
import { AgpmDoc } from '../../shared/prmp/agpm-doc';
import {
  COLONNES_PPM_OFFICIEL,
  CelluleCliquee,
  ChampPpmOfficiel,
  ListeFichePresentation,
  ObservationCellule,
  ObservationLigne,
  ObservationLigneFiche,
  dateOfficielle,
  documentDuChamp,
  libelleChampCible,
  montantOfficiel,
} from '../../shared/prmp/document-officiel';
import { DocumentVisionneuse } from '../../shared/ui/document-visionneuse';
import { Icone } from '../../shared/ui/icone';
import { ExamenGrille } from './examen/examen-grille';
import {
  ActionGrille,
  CleEtapeParcours,
  EntreeParcours,
  GroupeRecap,
  ObsLigne,
  ObservationNumerotee,
  OptionCible,
  PointVue,
  ResultatPiece,
  RowState,
  VueGrille,
  aDuTexte,
  construireParcours,
  delaiExamen,
  lignesViseesParConsigne,
  numerosEnTexte,
  pluriel,
  raisonValidationImpossible,
} from './examen/examen-modele';
import { ExamenParcours } from './examen/examen-parcours';
import { ExamenSynthese } from './examen/examen-synthese';

type OngletDocument = 'ppm' | 'fiche' | 'agpm' | 'pieces';

/** Proposition « Observer cette cellule » ouverte sur le document. */
interface PropositionCellule {
  cellule: CelluleCliquee;
  /** Clé du résultat visé : la ligne pour un point LIGNE, `null` pour un point évalué une fois. */
  idDetail: number | null;
  points: PointsCtrl[];
  libelle: string;
  left: number;
  top: number | null;
  bottom: number | null;
}

/**
 * Écran d'examen d'un dossier dispatché (profil Membre, et CC / Président par délégation).
 *
 * ⚠️ REFONTE ERGONOMIQUE, LOT 2 (2026-09-14 — maquettes `ExamenLigne` et `ExamenSynthese` validées
 * par Mathieu et ses chefs) : en-tête compact (référence, entité, consigne du dispatch, délai tiré du
 * chronométrage) ; parcours en six étapes cochées ; documents au format du PDF officiel avec
 * l'examen en annotations (marge d'état, ligne en cours, cellules observées numérotées) ; grille de
 * contrôle en panneau droit repliable, qui dit pourquoi une validation est impossible ; geste
 * « Observer cette cellule » (cible `champ` / `idMarcheCible` / `idBenefCible`, contrat V30) ;
 * synthèse avant soumission. La route passe l'application en mode « concentration » (barre
 * latérale en tiroir) : l'écran tient à 1366 px sans défilement horizontal.
 *
 * Inchangé : la règle séquentielle et l'ordre des étapes (pilote 2026-09-04), RAS par défaut
 * (2026-09-06), le périmètre d'une mise à jour (2026-09-10), les enregistrements (brouillon de
 * progression à chaque validation, soumission, modification, réexamen), les messages.
 *
 * ⚠️ Visa unique (2026-08-31, inverse la règle du 01/08) — le Membre ÉMET SON AVIS à la fin de
 * l'examen (pré-rempli par la suggestion, modifiable, obligatoire à la soumission) ; le Président
 * ou le CC pourra l'ajuster au VISA qui clôt la navette (écran « Projets de PV »).
 *
 * Enregistrement : POST /examens → POST /examen-details ×N + POST /pv-examens (BROUILLON),
 * ce qui matérialise le « projet de PV » (points de contrôle + synthèse + avis). Le backend
 * reste l'autorité (409 si non DISPATCHE, 403 hors localité) ; erreurs via l'intercepteur.
 */
@Component({
  selector: 'app-examen-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PpmMarchesTable,
    FichePresentationDoc,
    AgpmDoc,
    DocumentVisionneuse,
    Icone,
    ModaleDirective,
    ExamenParcours,
    ExamenGrille,
    ExamenSynthese,
  ],
  template: `
    <section class="exam" [class.exam--synthese]="estEtapeAvis() && points().length > 0">
      @if (loading()) {
        <p class="exam__info" role="status">Chargement…</p>
      } @else if (!dossier()) {
        <h1 class="exam__h1-seul">Examen</h1>
        <p class="exam__info">Dossier introuvable ou hors de votre périmètre.</p>
      } @else {
        <header class="tete">
          <div class="tete__id">
            <h1 class="tete__h1">
              <span class="tete__sur">{{ surtitre() }} </span>
              <span class="tete__ref">{{ dossier()!.refeDossier || 'Dossier #' + idDossier }}</span>
            </h1>
            <span class="tete__ent" [attr.title]="descriptionDossier()">{{ descriptionDossier() }}</span>
          </div>
          <div class="tete__droite">
            @if (consigne(); as c) {
              <!-- Tronquée dans l'en-tête à 1366 px : un clic la déplie en entier sous l'en-tête. -->
              <button type="button" class="consigne" [attr.aria-expanded]="consigneDepliee()" [attr.title]="c" (click)="consigneDepliee.set(!consigneDepliee())">
                <app-icone nom="message" [taille]="15" />
                <span class="consigne__txt">Consigne : <b>« {{ c }} »</b></span>
              </button>
            }
            @if (delai(); as d) {
              <p class="delai delai--{{ d.genre }}">
                <app-icone [nom]="d.genre === 'pause' ? 'pause' : 'clock'" [taille]="15" />{{ d.libelle }}
              </p>
            }
            <label class="tete__date">
              <span>Date<span class="cnm-sr-only"> d'examen</span></span>
              <input type="date" [value]="dateExamen()" [disabled]="mode() === 'locked'" (input)="dateExamen.set(valeurDe($event))" />
            </label>
          </div>
        </header>
        @if (consigneDepliee() && consigne()) {
          <p class="consigne-complete"><app-icone nom="message" [taille]="15" /><span>Consigne du dispatch : « {{ consigne() }} »</span></p>
        }

        @if (mode() === 'locked') {
          <p class="alerte" role="status">Examen verrouillé (PV signé / dossier clôturé) : lecture seule.</p>
        }
        @if (idDispatch() == null) {
          <p class="alerte" role="status">Aucun dispatch trouvé pour ce dossier : examen impossible.</p>
        }
        @if (!points().length) {
          <p class="alerte" role="status">Aucun point de contrôle défini pour ce type de dossier.</p>
        } @else {
          <app-examen-parcours [etapes]="parcours()" (choisir)="allerGroupe($event)" />
        }

        @if (!estEtapeAvis() || !points().length) {
          <div class="cols" [class.cols--repliee]="!grilleOuverte() || !points().length">
            <section class="doc" aria-label="Documents du dossier">
              <div class="doc__barre">
                @if (onglets().length > 1) {
                  <div class="doc__onglets" role="tablist" aria-label="Documents du dossier">
                    @for (o of onglets(); track o.cle) {
                      <button
                        type="button"
                        role="tab"
                        class="dtab"
                        [id]="'onglet-doc-' + o.cle"
                        aria-controls="panneau-doc"
                        [attr.aria-selected]="ongletAffiche() === o.cle"
                        [attr.tabindex]="ongletAffiche() === o.cle ? 0 : -1"
                        (click)="ouvrirOnglet(o.cle)"
                        (keydown)="naviguerOnglets($event)"
                      >
                        {{ o.libelle }}@if (o.nombre != null) { <small>{{ o.nombre }}</small> }
                      </button>
                    }
                  </div>
                } @else {
                  <h2 class="doc__titre">Pièces jointes <small>{{ nbPieces() }}</small></h2>
                }
                <span class="doc__esp"></span>
                @if (ongletAffiche() === 'ppm') {
                  <span class="legende" aria-hidden="true">
                    <span><i class="lg lg--ras"></i>RAS</span>
                    <span><i class="lg lg--obs"></i>Observation</span>
                    <span><i class="lg lg--attente"></i>À examiner</span>
                  </span>
                }
                @if (ongletAffiche() !== 'pieces') {
                  <button
                    type="button"
                    class="doc-interrupteur"
                    [attr.aria-pressed]="annotationsDoc()"
                    title="Afficher ou masquer ce que l'application ajoute au document : état d'examen, versionnement, statut du marché, observations"
                    (click)="annotationsDoc.set(!annotationsDoc())"
                  >
                    <span class="doc-interrupteur__piste" aria-hidden="true"></span>Annotations
                  </button>
                }
              </div>

              <div
                class="doc__corps"
                id="panneau-doc"
                [attr.role]="onglets().length > 1 ? 'tabpanel' : null"
                [attr.aria-labelledby]="onglets().length > 1 ? 'onglet-doc-' + ongletAffiche() : null"
                (scroll)="fermerProposition()"
              >
                @switch (ongletAffiche()) {
                  @case ('ppm') {
                    <app-document-visionneuse class="doc-entete-collante" [annotations]="annotationsDoc()">
                      <h3 class="doc-titre">PLAN DE PASSATION DES MARCHES POUR L'ANNEE {{ ppm()?.exercice ?? '____' }}</h3>
                      <div class="doc-entete">
                        <div>
                          <p><u>Autorité Contractante</u> : <strong>{{ entiteLabel() }}</strong></p>
                          <p><u>Nom de la PRMP</u> : <strong>{{ ppm()?.signataire || '—' }}</strong></p>
                        </div>
                        <div>
                          <p><u>Date d'établissement du Document initial</u> : {{ dateDoc(ppm()?.datePpmInit || ppm()?.dateSignature) }}</p>
                          <p><u>Numéro de la présente mise à jour</u> : {{ ppm()?.numMaj ?? 0 }}</p>
                        </div>
                      </div>
                      <app-ppm-marches-table
                        [marches]="marches()"
                        [beneficiaires]="serviceBenefs()"
                        [previsions]="previsions()"
                        [changements]="changements()"
                        [inclureSupprimees]="examenScope()"
                        [rowStateFn]="etatLigneFn"
                        [observations]="observationsPpm()"
                        [celluleObservableFn]="celluleObservableFn()"
                        (rowClick)="ouvrirLigne($event)"
                        (celluleClick)="proposerObservation($event)"
                      />
                    </app-document-visionneuse>
                  }
                  @case ('fiche') {
                    <app-document-visionneuse [annotations]="annotationsDoc()">
                      <app-fiche-presentation-doc
                        [fiche]="ficheDoc()"
                        [exercice]="ppm()?.exercice"
                        [libelleVersion]="libelleVersionFiche()"
                        [justificationFiche]="ppm()?.justificationFiche"
                        [motifMaj]="ppm()?.motifMaj"
                        [observations]="observationsFiche()"
                        [observable]="estEtapeFiche() && mode() !== 'locked'"
                        (celluleClick)="proposerObservation($event)"
                      />
                    </app-document-visionneuse>
                  }
                  @case ('agpm') {
                    <app-document-visionneuse [annotations]="annotationsDoc()">
                      <app-agpm-doc
                        [lignes]="agpmDoc()"
                        [exercice]="ppm()?.exercice"
                        [entite]="entiteLabel()"
                        [signataire]="ppm()?.signataire"
                        [dateInitiale]="ppm()?.datePpmInit || ppm()?.dateSignature"
                        [numMajPrec]="ppm()?.numMajPrec"
                        [dateMajPrec]="ppm()?.dateMajPrec"
                        [numMaj]="ppm()?.numMaj"
                        [observations]="observationsAgpm()"
                        [observable]="estEtapeAgpm() && mode() !== 'locked'"
                        (celluleClick)="proposerObservation($event)"
                      />
                    </app-document-visionneuse>
                  }
                  @case ('pieces') {
                    <div class="pj">
                      @if (loadingPieces()) {
                        <p class="exam__info" role="status">Chargement des pièces…</p>
                      } @else if (!piecesOrdonnees().length) {
                        <p class="exam__info">Aucune pièce jointe.</p>
                      } @else {
                        <ul class="pj__liste" aria-label="Pièces jointes du dossier">
                          @for (groupe of groupesPieces(); track groupe.cle) {
                            <li class="pj__groupe" [class.pj__groupe--lr]="groupe.cle === 'lr'">{{ groupe.libelle }} · {{ groupe.pieces.length }}</li>
                            @for (p of groupe.pieces; track p.idPiece) {
                              <li>
                                <!-- <button> : l'ouverture d'une pièce reste atteignable au clavier (AUDIT.md A4). -->
                                <button type="button" class="pj__item" [class.is-open]="openPiece() === p.idPiece" [attr.aria-pressed]="openPiece() === p.idPiece" (click)="choisirPiece(p)">
                                  <span class="pj__etat pj__etat--{{ etatPiece(p) }}" role="img" [attr.aria-label]="libelleEtatPiece(p)">
                                    @if (etatPiece(p) === 'done-ras') { <app-icone nom="check" [taille]="11" /> }
                                  </span>
                                  <span class="pj__idx">{{ rangPiece(p) }}</span>
                                  <span class="pj__nom">{{ libellePiece(p) }}</span>
                                  @if (p.format) { <span class="pj__fmt">{{ p.format }}</span> }
                                </button>
                              </li>
                            }
                          }
                        </ul>
                        <div class="pj__apercu">
                          @if (openPiece() == null) {
                            <p class="exam__info">Sélectionnez une pièce pour l'afficher.</p>
                          } @else if (loadingPiece() === openPiece()) {
                            <p class="exam__info" role="status">Chargement de l'aperçu…</p>
                          } @else if (openUrl(); as u) {
                            <iframe [src]="u" class="pj__cadre" [title]="'Aperçu de la pièce : ' + libellePieceOuverte()"></iframe>
                          }
                        </div>
                      }
                    </div>
                  }
                }
              </div>
            </section>

            @if (points().length) {
              <app-examen-grille [vue]="vueGrille()" [ouverte]="grilleOuverte()" [enregistre]="derniereSauvegarde()" (action)="surActionGrille($event)" />
            }
          </div>
        } @else {
          <app-examen-synthese
            [groupes]="recap()"
            [nbObservations]="observationsNumerotees().length"
            [consigne]="rappelConsigne()"
            [mode]="mode()"
            [estReexamen]="estReexamen()"
            [editable]="syntheseEditable()"
            [synthese]="synthese()"
            [avis]="avis()"
            [avisLibelle]="avis() ? avisLabel(avis()) : null"
            [aviss]="aviss()"
            [avisHint]="avisSuggereHint()"
            [apres]="apresSoumission()"
            [formError]="formError()"
            [saving]="saving()"
            [dispatchConnu]="idDispatch() != null"
            [libellePrecedent]="libelleRetourSynthese()"
            (modifier)="modifierObservation($event)"
            (syntheseChange)="synthese.set($event)"
            (avisChange)="avis.set($event)"
            (soumettre)="soumettre()"
            (enregistrer)="enregistrer()"
            (precedent)="allerEtape(etape() - 1)"
            (annuler)="annuler()"
          />
        }

        @if (proposition(); as prop) {
          <div
            class="prop"
            role="dialog"
            aria-label="Observer cette cellule"
            appModale
            (appModaleFermer)="fermerProposition()"
            [style.left.px]="prop.left"
            [style.top.px]="prop.top"
            [style.bottom.px]="prop.bottom"
          >
            <div class="prop__tete">
              <span>Observer « {{ prop.libelle }} »</span>
              <button type="button" class="prop__fermer" aria-label="Fermer" (click)="fermerProposition()"><app-icone nom="x" [taille]="14" /></button>
            </div>
            @if (prop.cellule.valeur) {
              <p class="prop__valeur">Au lieu de : « {{ prop.cellule.valeur }} »</p>
            }
            <p class="prop__question">Au titre du point :</p>
            <ul class="prop__points">
              @for (pt of prop.points; track pt.idPointCtrl; let i = $index) {
                <li>
                  <button type="button" class="prop__point" (click)="observerCellule(pt.idPointCtrl)">
                    <span class="prop__rang">{{ i + 1 }}.</span>{{ pt.libelPointCtrl || 'Point #' + pt.idPointCtrl }}
                  </button>
                </li>
              }
            </ul>
          </div>
        }
      }
    </section>
  `,
  styleUrl: './examen-dossier.scss',
})
export class ExamenDossier implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dossierService = inject(DossierService);
  private readonly miseAJourService = inject(MiseAJourPpmService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly pointsCtrlService = inject(PointsCtrlService);
  private readonly avisService = inject(AvisService);
  private readonly examenService = inject(ExamenService);
  private readonly examenDetailService = inject(ExamenDetailService);
  private readonly examenPieceService = inject(ExamenPieceService);
  private readonly pvExamenService = inject(PvExamenService);
  private readonly serviceBenefService = inject(ServiceBeneficiaireService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly modeService = inject(ModePassationService);
  private readonly capmService = inject(CapmService);
  private readonly delaiStandardService = inject(DelaiStandardService);

  readonly idDossier = Number(this.route.snapshot.paramMap.get('idDossier'));
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly dossier = signal<Dossier | null>(null);
  readonly ppm = signal<Ppm | null>(null);
  /** Versionnement : idDetail → type de changement vs la version précédente (surlignage du tableau). */
  readonly changements = signal<Map<number, TypeChangementLigne> | null>(null);
  /**
   * ⚠️ Périmètre d'examen d'une mise à jour (pilote 2026-09-10, backend `5d51d4b`) — AUTORITÉ serveur, même
   * calcul que la garde de complétude : n'examiner que les lignes changées. `null` tant que non chargé.
   */
  readonly perimetre = signal<PerimetreExamen | null>(null);
  readonly marches = signal<Marche[]>([]);
  /** Bénéficiaires + dates prévisionnelles des marchés du dossier (pour le tableau PPM partagé). */
  readonly serviceBenefs = signal<ServiceBeneficiaire[]>([]);
  readonly previsions = signal<MarchePrevision[]>([]);
  /** Pièces jointes réellement déposées sur le dossier (lecture + téléchargement). */
  readonly pieces = signal<PieceJointeDossier[]>([]);
  readonly loadingPieces = signal(false);
  readonly piecesInitiales = computed(() => this.pieces().filter((p) => !p.apresLettreRenvoi));
  readonly piecesApresRenvoi = computed(() => this.pieces().filter((p) => p.apresLettreRenvoi));
  /** Aperçu : pièce ouverte (idPiece), son URL blob sécurisée, et le chargement éventuel. */
  readonly openPiece = signal<number | null>(null);
  readonly openUrl = signal<SafeResourceUrl | null>(null);
  readonly loadingPiece = signal<number | null>(null);
  private currentObjectUrl: string | null = null;
  readonly idDispatch = signal<number | null>(null);
  /** Consigne donnée au dispatch (`instructions`), s'il y en a une. */
  readonly consigne = signal<string | null>(null);
  /** Consigne affichée en entier sous l'en-tête (elle y est tronquée faute de place). */
  readonly consigneDepliee = signal(false);
  readonly points = signal<PointsCtrl[]>([]);
  readonly aviss = signal<Avis[]>([]);
  private readonly examens = signal<Examen[]>([]);
  private readonly details = signal<ExamenDetail[]>([]);
  private readonly pvs = signal<PvExamen[]>([]);

  /** Chronométrage du dossier et délais standards : matière de la puce de délai de l'en-tête. */
  private readonly chrono = signal<Chronometrage | null>(null);
  private readonly delais = signal<DelaiStandard[]>([]);
  readonly delai = computed(() => delaiExamen(this.chrono(), this.delais()));

  readonly dateExamen = signal(new Date().toISOString().slice(0, 10));
  /**
   * Avis global du PV — ÉMIS PAR LE MEMBRE à la soumission (⚠️ visa unique 2026-08-31, règle du
   * 01/08 inversée), modifiable tant que le PV est entre ses mains ; le Président/CC peut encore
   * l'ajuster au visa.
   */
  readonly avis = signal<string | null>(null);
  readonly synthese = signal('');
  /**
   * Résultats de l'examen, clé `${idDetail}:${idPt}` (point LIGNE, par marché) ou `D:${idPt}` (point DOSSIER).
   * Remplace l'ancien état par-dossier : l'examen se fait ligne par ligne.
   */
  private readonly resultats = signal<Map<string, RowState>>(new Map());
  /** Erreur « ≥1 ligne obligatoire » par point non conforme de l'étape courante (clé = idPtControle). */
  readonly pointErreurs = signal<Map<number, string>>(new Map());
  /** ⚠️ Règle ajoutée — résultats d'examen des PIÈCES JOINTES, une par une (clé = idPiece). */
  private readonly resultatsPieces = signal<Map<number, ResultatPiece>>(new Map());
  /** Résultats de pièces persistés (`/api/examen-pieces`) — réconciliation en mode édition + PK max+1. */
  private readonly examenPieces = signal<ExamenPiece[]>([]);
  /** Erreur de l'étape pièce courante (observation manquante). */
  readonly pieceErreur = signal<string | null>(null);

  /**
   * Étapes VALIDÉES (bouton « Valider… », ou résultat déjà enregistré au chargement) — clés `F`, `A`,
   * `D`, `L<idDetail>`, `P<idPiece>`. Sert l'affichage de la progression (parcours, marge du plan) :
   * avec le RAS par défaut (2026-09-06), « statué » ne dit plus ce que le Membre a déjà parcouru.
   * La règle séquentielle, elle, reste fondée sur les statuts (inchangée).
   */
  readonly etapesValidees = signal<ReadonlySet<string>>(new Set());
  /** Heure du dernier brouillon de progression réellement enregistré (« Enregistré à … »). */
  readonly derniereSauvegarde = signal<string | null>(null);
  /** Grille de contrôle dépliée (panneau droit) ou repliée en languette. */
  readonly grilleOuverte = signal(true);
  /** Proposition « Observer cette cellule » ouverte. */
  readonly proposition = signal<PropositionCellule | null>(null);
  /** Le clic de cellule qui vient d'ouvrir une proposition ne doit pas, en remontant, changer de ligne. */
  private clicCelluleTraite = false;

  /** Observations relevées (points OBS + pièces OBS) — source de la suggestion d'avis. */
  private readonly nbObservations = computed(() => {
    const pts = [...this.resultats().values()].filter((st) => st.statut === 'OBS').length;
    const pcs = [...this.resultatsPieces().values()].filter((p) => p.statut === 'OBS').length;
    return pts + pcs;
  });
  /** ⚠️ Règle de cohérence — ≥ 1 observation → FAVR suggéré (FAV refusé serveur) ; 0 → FAV. */
  readonly avisSuggere = computed(() => (this.nbObservations() > 0 ? 'FAVR' : 'FAV'));
  readonly avisSuggereHint = computed(() => {
    const n = this.nbObservations();
    return n > 0
      ? `Avis suggéré : « Favorable avec réserves » — ${n} observation(s) relevée(s) (points de contrôle + pièces jointes).`
      : 'Avis suggéré : « Favorable » — aucune observation relevée à l\'examen.';
  });

  // — Workflow séquentiel : une ligne active à la fois, de haut en bas, puis étape dossier, puis avis. —
  /** Étape courante : 0..N-1 = marchés ; N = points DOSSIER (si présents) ; dernière = avis global. */
  readonly etape = signal(0);

  /** Points de portée LIGNE (évalués par marché) — défaut LIGNE si portée absente. */
  readonly pointsLigne = computed(() => this.points().filter((p) => (p.portee ?? 'LIGNE') === 'LIGNE'));
  /** Points de portée DOSSIER (inter-lignes, évalués une fois). */
  readonly pointsDossier = computed(() => this.points().filter((p) => p.portee === 'DOSSIER'));
  /**
   * ⚠️ Demande pilote (2026-09-02, backend `f361de9`) — la FICHE DE PRÉSENTATION et l'AGPM ont
   * chacun LEUR grille : points de portée FICHE / AGPM, servis par la grille effective du
   * sous-type (FICHE = commun famille DDP ; AGPM = spécifique PPM-AGPM — un dossier sans AGPM
   * n'en reçoit jamais). Évalués UNE fois, stockés comme les points DOSSIER (idDetail null).
   */
  readonly pointsFiche = computed(() => this.points().filter((p) => p.portee === 'FICHE'));
  readonly pointsAgpm = computed(() => this.points().filter((p) => p.portee === 'AGPM'));
  /** Tous les points évalués UNE fois (DOSSIER + FICHE + AGPM) — init, persistance, complétude. */
  readonly pointsHorsLigne = computed(() => this.points().filter((p) => (p.portee ?? 'LIGNE') !== 'LIGNE' && p.portee !== 'SUPPRESSION'));

  // ── Périmètre d'examen (pilote 2026-09-10) : n'examiner que les lignes changées d'une mise à jour ──
  private readonly aExaminerMap = computed(() => new Map((this.perimetre()?.lignes ?? []).map((l) => [l.idDetail, l.aExaminer])));
  private readonly constatMap = computed(() => new Map((this.perimetre()?.lignes ?? []).map((l) => [l.idDetail, l.constatRequis])));
  /** Examen SCOPÉ (mise à jour avec périmètre servi) ? Sinon tout le plan est examiné (comportement historique). */
  readonly examenScope = computed(() => this.perimetre()?.miseAJour === true);
  /** Point de CONSTAT de suppression (portée SUPPRESSION, ID semé) — évalué sur une ligne retirée. */
  readonly pointsSuppression = computed(() => this.points().filter((p) => p.portee === 'SUPPRESSION'));
  /** La ligne demande-t-elle le CONSTAT de retrait (grille = point SUPPRESSION, pas la grille LIGNE) ? */
  estConstat(idDetail: number): boolean {
    return this.constatMap().get(idDetail) === true;
  }
  /** La ligne est-elle HORS examen (inchangée, déjà validée à la version précédente) ? */
  estHorsExamen(idDetail: number): boolean {
    return this.examenScope() && !this.aExaminerMap().get(idDetail) && !this.constatMap().get(idDetail);
  }
  /** Grille applicable à une ligne : SUPPRESSION pour un constat, sinon la grille LIGNE. */
  pointsPourLigne(idDetail: number): PointsCtrl[] {
    return this.estConstat(idDetail) ? this.pointsSuppression() : this.pointsLigne();
  }
  /** Marchés effectivement soumis à examen, dans l'ordre du plan : dans un examen scopé, seulement le périmètre. */
  readonly marchesExamen = computed<Marche[]>(() => {
    if (!this.examenScope()) return this.marches();
    return this.marches().filter((m) => this.aExaminerMap().get(m.idDetail) || this.constatMap().get(m.idDetail));
  });
  readonly nbLignes = computed(() => this.marchesExamen().length);
  /** Lignes affichées par le plan (mêmes règles que le tableau) : leur rang est le numéro « Ligne N ». */
  private readonly lignesDuPlan = computed(() => this.marches().filter((m) => this.examenScope() || !m.supprimee));
  private readonly rangsDuPlan = computed(() => new Map(this.lignesDuPlan().map((m, i) => [m.idDetail, i + 1])));
  /** Points HORS ligne (fiche/AGPM/dossier) réellement à examiner selon le périmètre (init, persistance, complétude). */
  readonly pointsHorsLigneAExaminer = computed(() => {
    const perim = this.perimetre();
    const scope = perim?.miseAJour === true;
    return this.pointsHorsLigne().filter((p) =>
      p.portee === 'FICHE' ? !scope || perim!.ficheAExaminer
        : p.portee === 'AGPM' ? !scope || perim!.agpmAExaminer
          : p.portee === 'DOSSIER' ? !scope || perim!.dossierAExaminer
            : true,
    );
  });
  readonly hasEtapeDossier = computed(() => this.pointsDossier().length > 0 && (this.perimetre()?.dossierAExaminer ?? true));
  /**
   * ⚠️ Demande pilote (2026-09-04) — « on ne contrôle pas le vide » : la grille de la fiche (resp.
   * de l'AGPM) est SAUTÉE quand le document dérivé n'a aucun contenu (fiche sans marché dérogatoire,
   * ni délai aménagé, ni contrat-cadre ; AGPM sans ligne). Le document reste consultable dans son
   * onglet. Garde serveur miroir : demande backend 2026-09-04-completude-fiche-vide.
   */
  readonly hasEtapeFiche = computed(() => this.pointsFiche().length > 0 && this.ficheDoc().nbMarchesConcernes > 0 && (this.perimetre()?.ficheAExaminer ?? true));
  readonly hasEtapeAgpm = computed(() => this.pointsAgpm().length > 0 && this.agpmDoc().length > 0 && (this.perimetre()?.agpmAExaminer ?? true));
  /** Pièces dans l'ordre des étapes « Pièce N » (initiales puis après renvoi — même ordre que la liste). */
  readonly piecesOrdonnees = computed(() => [...this.piecesInitiales(), ...this.piecesApresRenvoi()].filter((p) => p.idPiece != null));
  readonly nbPieces = computed(() => this.piecesOrdonnees().length);
  /**
   * Fil (⚠️ ORDRE pilote 2026-09-04) : Fiche → lignes du plan → AGPM → pièces → Dossier → Synthèse
   * (les étapes absentes se retirent) — la grille de la fiche passe AVANT les lignes du PPM, et
   * l'AGPM suit immédiatement le PPM.
   */
  readonly etapeFicheIdx = computed(() => 0);
  /** Index de la première étape « ligne » (décalée de 1 si la fiche a sa grille). */
  readonly offsetLignes = computed(() => (this.hasEtapeFiche() ? 1 : 0));
  readonly etapeAgpmIdx = computed(() => this.offsetLignes() + this.nbLignes());
  /** Index de la première étape « pièce » (après l'AGPM éventuelle). */
  readonly offsetPieces = computed(() => this.etapeAgpmIdx() + (this.hasEtapeAgpm() ? 1 : 0));
  /** Index de l'étape « contrôles dossier » (après fiche, lignes, AGPM et pièces éventuelles). */
  readonly etapeDossierIdx = computed(() => this.offsetPieces() + this.nbPieces());
  /** Index de l'étape « avis global » (dernière du fil). */
  readonly etapeAvis = computed(() => this.etapeDossierIdx() + (this.hasEtapeDossier() ? 1 : 0));
  readonly estEtapeFiche = computed(() => this.hasEtapeFiche() && this.etape() === this.etapeFicheIdx());
  readonly estEtapeMarche = computed(
    () => this.etape() >= this.offsetLignes() && this.etape() < this.offsetLignes() + this.nbLignes(),
  );
  /** Index de la ligne courante dans `marches()` (−1 hors étape marché). */
  readonly indexMarcheCourant = computed(() => (this.estEtapeMarche() ? this.etape() - this.offsetLignes() : -1));
  /** ⚠️ Règle ajoutée — étapes « Pièce N » : chaque pièce jointe est examinée une par une. */
  readonly estEtapePiece = computed(
    () => this.etape() >= this.offsetPieces() && this.etape() < this.offsetPieces() + this.nbPieces(),
  );
  readonly estEtapeAgpm = computed(() => this.hasEtapeAgpm() && this.etape() === this.etapeAgpmIdx());
  readonly estEtapeDossier = computed(() => this.hasEtapeDossier() && this.etape() === this.etapeDossierIdx());
  readonly estEtapeAvis = computed(() => this.etape() >= this.etapeAvis());
  readonly indexPieceCourante = computed(() => (this.estEtapePiece() ? this.etape() - this.offsetPieces() : -1));
  readonly pieceCourante = computed(() => (this.estEtapePiece() ? this.piecesOrdonnees()[this.indexPieceCourante()] ?? null : null));
  /** Marché de l'étape courante (null hors étape marché). */
  readonly marcheCourant = computed(() => (this.estEtapeMarche() ? this.marchesExamen()[this.indexMarcheCourant()] ?? null : null));
  /** idDetail associé à l'étape courante (null pour les étapes fiche / AGPM / dossier). */
  readonly idDetailCourant = computed(() => this.marcheCourant()?.idDetail ?? null);
  /** Points affichés à l'étape courante : LIGNE (marché), FICHE, AGPM ou DOSSIER — sinon aucun (avis). */
  readonly pointsCourants = computed(() =>
    this.estEtapeMarche()
      ? this.pointsPourLigne(this.idDetailCourant() ?? -1)
      : this.estEtapeFiche()
        ? this.pointsFiche()
        : this.estEtapeAgpm()
          ? this.pointsAgpm()
          : this.estEtapeDossier()
            ? this.pointsDossier()
            : [],
  );

  // — États DÉRIVÉS des statuts (pas d'état manuel « validé ») : un point/une ligne est « examiné » dès qu'il est statué. —
  /** Tous les points applicables d'un marché sont-ils statués ? (grille LIGNE, ou point SUPPRESSION pour un
   *  constat ; une ligne HORS examen = inchangée est réputée déjà validée). */
  ligneStatuee(idDetail: number): boolean {
    if (this.estHorsExamen(idDetail)) return true;
    return this.pointsPourLigne(idDetail).every((p) => this.resultat(idDetail, p.idPointCtrl).statut !== null);
  }
  /** Le marché porte-t-il ≥1 observation (→ « examinée avec observation ») ? */
  ligneAObs(idDetail: number): boolean {
    return this.pointsPourLigne(idDetail).some((p) => this.resultat(idDetail, p.idPointCtrl).statut === 'OBS');
  }
  /** Tous les points DOSSIER sont-ils statués ? */
  readonly dossierStatue = computed(() => this.pointsDossier().every((p) => this.resultat(null, p.idPointCtrl).statut !== null));
  /** Mêmes états pour les grilles FICHE et AGPM (2026-09-02). */
  readonly ficheStatuee = computed(() => this.pointsFiche().every((p) => this.resultat(null, p.idPointCtrl).statut !== null));
  readonly agpmStatuee = computed(() => this.pointsAgpm().every((p) => this.resultat(null, p.idPointCtrl).statut !== null));
  /** Première étape marché non encore statuée (frontière atteignable) ; `nbLignes` si toutes faites. */
  readonly frontiere = computed(() => {
    const idx = this.marchesExamen().findIndex((m) => !this.ligneStatuee(m.idDetail));
    return idx === -1 ? this.nbLignes() : idx;
  });
  /** Première pièce non statuée (frontière des étapes pièces) ; `nbPieces` si toutes examinées. */
  readonly frontierePiece = computed(() => {
    const idx = this.piecesOrdonnees().findIndex((p) => !this.pieceStatuee(p.idPiece));
    return idx === -1 ? this.nbPieces() : idx;
  });
  readonly toutesPiecesStatuees = computed(() => this.piecesOrdonnees().every((p) => this.pieceStatuee(p.idPiece)));
  /** Lignes + pièces + fiche + AGPM + étape dossier toutes traitées ? (condition d'ouverture de l'avis). */
  readonly toutTraite = computed(
    () =>
      this.marchesExamen().every((m) => this.ligneStatuee(m.idDetail)) &&
      this.toutesPiecesStatuees() &&
      (!this.hasEtapeFiche() || this.ficheStatuee()) &&
      (!this.hasEtapeAgpm() || this.agpmStatuee()) &&
      (!this.hasEtapeDossier() || this.dossierStatue()),
  );

  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly modeMap = signal<Map<string, string>>(new Map());
  private readonly natureMap = signal<Map<string, string>>(new Map());

  // ── Fiche de présentation & Projet d'AGPM DANS l'examen (demande pilote 2026-09-02) ──
  /** Référentiels COMPLETS (les lookups ne portent que les libellés — les calculs veulent les objets). */
  private readonly modesRef = signal<ModePassation[]>([]);
  private readonly capmsRef = signal<Capm[]>([]);
  /** Onglet actif de la zone document (dossiers DDP ; les autres n'ont que les pièces). */
  readonly ongletContenu = signal<OngletDocument>('ppm');
  readonly ongletAffiche = computed<OngletDocument>(() => (this.estPpm() ? this.ongletContenu() : 'pieces'));
  /**
   * ⚠️ 2026-09-14 (décision des chefs) — annotations des documents officiels visibles (état d'examen,
   * statut du marché, versionnement…) : un seul interrupteur pour tous les onglets de l'écran.
   */
  readonly annotationsDoc = signal(true);
  /** Les deux documents dérivés — mêmes fonctions pures que le détail PPM et l'aperçu de création. */
  readonly ficheDoc = computed(() =>
    calculerFichePresentation(this.marches(), this.previsions(), this.modesRef(), this.capmsRef()),
  );
  readonly agpmDoc = computed(() =>
    calculerAgpm(
      this.marches(),
      this.previsions(),
      this.modesRef(),
      this.capmsRef(),
      new Map([...this.natureMap()].map(([k, v]) => [Number(k), v])),
    ),
  );
  /** « Initial » ou « Mise à jour n° N » — même libellé que l'onglet du détail PPM. */
  readonly libelleVersionFiche = computed(() => {
    const n = this.ppm()?.numMaj ?? 0;
    return n > 0 ? `Mise à jour n° ${n}` : 'Initial';
  });

  /**
   * Mode déduit du statut : DISPATCHE → création ; EXAMINE → édition ; A_REEXAMINER → édition
   * (⚠️ réexamen après lettre de renvoi, 2026-08-02 : pièces complémentaires transmises par la PRMP —
   * l'examen est rouvert, la navette repart à la re-soumission du projet de PV) ; sinon verrouillé.
   */
  readonly mode = computed<'create' | 'edit' | 'locked'>(() => {
    const s = this.dossier()?.statut;
    if (s === 'DISPATCHE') return 'create';
    if (s === 'EXAMINE' || s === 'A_REEXAMINER') return 'edit';
    return 'locked';
  });
  /** Réexamen après lettre de renvoi (statut A_REEXAMINER) — adapte libellés, reprise et sortie. */
  readonly estReexamen = computed(() => this.dossier()?.statut === 'A_REEXAMINER');
  private readonly existingExamenId = signal<number | null>(null);
  /** Projet de PV rattaché à l'examen (mode edit) — porte l'avis + la synthèse à éditer. */
  private readonly existingPv = signal<PvExamen | null>(null);
  /**
   * Synthèse éditable ici si : aucun projet de PV n'existe encore (examen créé sans soumission →
   * « Modifier l'examen » le créera), OU le PV est BROUILLON, OU il est revenu EN_RECTIFICATION.
   * Un PV entre les mains de la commission (PROJET_SOUMIS, PROJET_ACCEPTE, SIGNE) reste en lecture
   * seule (→ « Projets de PV »).
   */
  readonly pvEditable = computed(() => {
    if (this.mode() !== 'edit') return false;
    // ⚠️ EN_RECTIFICATION recouvre DEUX retours, tous deux destinés à être corrigés ici : le retour
    // de navette du P/CC (dossier EXAMINE) et le réexamen après lettre de renvoi signée (dossier
    // A_REEXAMINER). Le second seul était traité ; la règle est désormais partagée et testée.
    return examenRectifiable(this.existingPv()?.statutPv, this.dossier()?.statut);
  });
  /** Le bloc synthèse est éditable à la création, ou en édition tant que le PV est BROUILLON. */
  readonly syntheseEditable = computed(() => this.mode() === 'create' || this.pvEditable());

  readonly estPpm = computed(() => this.dossier()?.idTypeDossier === 'DDP');
  readonly typeLabel = computed(() => {
    const id = this.dossier()?.idTypeDossier;
    return id ? this.typeMap().get(id) ?? id : '—';
  });
  readonly localiteLabel = computed(() => {
    const id = this.dossier()?.idLocalite;
    return id ? this.localiteMap().get(id) ?? id : '—';
  });
  readonly entiteLabel = computed(() => {
    const id = this.dossier()?.idEntiteContract;
    return id != null ? this.entiteMap().get(String(id)) ?? '#' + id : '—';
  });

  // ── En-tête ─────────────────────────────────────────────────────────────────────────────────
  readonly surtitre = computed(() =>
    this.mode() === 'locked' ? 'Examen (lecture seule)' : this.estReexamen() ? 'Réexamen' : this.mode() === 'edit' ? "Modifier l'examen" : 'Examen',
  );
  /** « Entité · 14 lignes · 1 590 000 000 Ar » (PPM) ou « Type · Entité · Localité ». */
  readonly descriptionDossier = computed(() => {
    if (!this.estPpm()) return [this.typeLabel(), this.entiteLabel(), this.localiteLabel()].filter((x) => x && x !== '—').join(' · ');
    const lignes = this.lignesDuPlan().filter((m) => !m.supprimee);
    const total = lignes.reduce((s, m) => s + Number(m.nouvMontEstim ?? m.montEstim ?? 0), 0);
    const montant = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(total);
    return `${this.entiteLabel()} · ${pluriel(lignes.length, 'ligne')} · ${montant} Ar`;
  });
  /** Lignes du plan désignées par la consigne (numéros du plan), quand le texte les nomme. */
  private readonly lignesVisees = computed(() => lignesViseesParConsigne(this.consigne()));

  // ── Zone document ───────────────────────────────────────────────────────────────────────────
  readonly onglets = computed<{ cle: OngletDocument; libelle: string; nombre: number | null }[]>(() => {
    if (!this.estPpm()) return [{ cle: 'pieces', libelle: 'Pièces jointes', nombre: this.nbPieces() }];
    return [
      { cle: 'ppm' as const, libelle: 'Plan de passation', nombre: this.lignesDuPlan().length },
      { cle: 'fiche' as const, libelle: 'Fiche de présentation', nombre: this.ficheDoc().nbMarchesConcernes },
      ...(this.agpmDoc().length || this.hasEtapeAgpm() ? [{ cle: 'agpm' as const, libelle: "Projet d'AGPM", nombre: this.agpmDoc().length }] : []),
      { cle: 'pieces' as const, libelle: 'Pièces jointes', nombre: this.nbPieces() },
    ];
  });
  readonly groupesPieces = computed(() =>
    [
      { cle: 'init', libelle: 'Pièces initiales', pieces: this.piecesOrdonnees().filter((p) => !p.apresLettreRenvoi) },
      { cle: 'lr', libelle: 'Après lettre de renvoi', pieces: this.piecesOrdonnees().filter((p) => p.apresLettreRenvoi) },
    ].filter((g) => g.pieces.length),
  );
  /**
   * Lignes du plan qui proposent « Observer cette cellule » : la ligne en cours (hors constat de
   * retrait, qui n'accepte aucune cellule), ou toutes les lignes examinées à l'étape des contrôles
   * du dossier. Recalculée à chaque étape : le tableau reçoit une nouvelle fonction.
   */
  readonly celluleObservableFn = computed<((idDetail: number) => boolean) | null>(() => {
    if (this.mode() === 'locked') return null;
    const courant = this.idDetailCourant();
    if (courant != null) return this.estConstat(courant) ? null : (id: number) => id === courant;
    if (this.estEtapeDossier()) return (id: number) => !this.estHorsExamen(id);
    return null;
  });

  // ── Observations numérotées (numérotation globale = pastilles du document) ─────────────────
  readonly observationsNumerotees = computed<ObservationNumerotee[]>(() => {
    const out: Omit<ObservationNumerotee, 'numero'>[] = [];
    const vide = { cellule: null, champ: null, idMarcheCible: null, idBenefCible: null, auLieuDe: '', lire: '', texte: null };
    const pousser = (groupe: ObservationNumerotee['groupe'], etape: number, titre: string, idDetail: number | null, pts: PointsCtrl[]): void => {
      for (const p of pts) {
        const st = this.resultat(idDetail, p.idPointCtrl);
        if (st.statut !== 'OBS') continue;
        st.observations.forEach((o, index) => {
          if (!aDuTexte(o)) return;
          out.push({
            ...vide,
            groupe,
            etape,
            titre,
            sousTitre: p.libelPointCtrl || `Point #${p.idPointCtrl}`,
            cellule: o.champ ? libelleChampCible(o.champ) : null,
            auLieuDe: o.auLieuDe.trim(),
            lire: o.lire.trim(),
            idDetail,
            idPt: p.idPointCtrl,
            index,
            idPiece: null,
            champ: o.champ ?? null,
            idMarcheCible: o.champ ? o.idMarcheCible ?? idDetail : null,
            idBenefCible: o.champ ? o.idBenefCible ?? null : null,
          });
        });
      }
    };
    if (this.hasEtapeFiche()) pousser('fiche', this.etapeFicheIdx(), 'Fiche de présentation', null, this.pointsFiche());
    this.marchesExamen().forEach((m, i) =>
      pousser('lignes', this.offsetLignes() + i, this.libelleLigne(m.idDetail), m.idDetail, this.pointsPourLigne(m.idDetail)),
    );
    if (this.hasEtapeAgpm()) pousser('agpm', this.etapeAgpmIdx(), "Projet d'AGPM", null, this.pointsAgpm());
    this.piecesOrdonnees().forEach((p, i) => {
      const r = this.resultatPiece(p.idPiece);
      if (r.statut !== 'OBS') return;
      out.push({ ...vide, groupe: 'pieces', etape: this.offsetPieces() + i, titre: `Pièce ${i + 1}`, sousTitre: this.libellePiece(p), texte: r.observation.trim(), idDetail: null, idPt: null, index: 0, idPiece: p.idPiece ?? null });
    });
    if (this.hasEtapeDossier()) pousser('dossier', this.etapeDossierIdx(), 'Contrôles du dossier', null, this.pointsDossier());
    return out.map((o, i) => ({ ...o, numero: i + 1 }));
  });
  /** Cellules observées du plan (encadré + pastille), bénéficiaire compris. */
  readonly observationsPpm = computed<ObservationCellule[]>(() =>
    this.observationsNumerotees()
      .filter((o) => o.champ && documentDuChamp(o.champ) === 'PPM' && o.idMarcheCible != null)
      .map((o) => ({ idDetail: o.idMarcheCible as number, champ: o.champ as ChampPpmOfficiel, numero: o.numero, idBenef: o.idBenefCible })),
  );
  readonly observationsFiche = computed<ObservationLigneFiche[]>(() =>
    this.observationsNumerotees()
      .filter((o) => o.champ && documentDuChamp(o.champ) === 'FICHE' && o.idMarcheCible != null)
      .map((o) => ({ idDetail: o.idMarcheCible as number, numero: o.numero, liste: (o.champ as string).split('.')[0] as ListeFichePresentation })),
  );
  readonly observationsAgpm = computed<ObservationLigne[]>(() =>
    this.observationsNumerotees()
      .filter((o) => o.champ && documentDuChamp(o.champ) === 'AGPM' && o.idMarcheCible != null)
      .map((o) => ({ idDetail: o.idMarcheCible as number, numero: o.numero })),
  );

  // ── Parcours ────────────────────────────────────────────────────────────────────────────────
  readonly parcours = computed(() => {
    const v = this.etapesValidees();
    const obs = this.observationsNumerotees();
    const nbObs = (g: string): number => obs.filter((o) => o.groupe === g).length;
    const perim = this.perimetre();
    const scope = perim?.miseAJour === true;
    const ppm = this.estPpm();
    const entrees: EntreeParcours[] = [
      {
        cle: 'fiche',
        masquee: !ppm && !this.hasEtapeFiche(),
        sansObjet: this.hasEtapeFiche() ? null : !this.pointsFiche().length ? 'Sans objet pour ce dossier' : scope && !perim?.ficheAExaminer ? 'Sans objet — inchangée' : 'Sans objet — fiche vide',
        total: this.hasEtapeFiche() ? 1 : 0,
        faites: v.has('F') ? 1 : 0,
        nbObservations: nbObs('fiche'),
        courante: this.estEtapeFiche(),
        accessible: this.hasEtapeFiche() && this.estAtteignable(this.etapeFicheIdx()),
      },
      {
        cle: 'lignes',
        masquee: !ppm && this.nbLignes() === 0,
        sansObjet: this.nbLignes() ? null : this.marches().length ? 'Sans objet — aucune ligne à examiner' : 'Sans objet — aucune ligne',
        total: this.nbLignes(),
        faites: this.marchesExamen().filter((m) => v.has('L' + m.idDetail)).length,
        nbObservations: nbObs('lignes'),
        courante: this.estEtapeMarche(),
        accessible: this.nbLignes() > 0 && this.estAtteignable(this.offsetLignes()),
      },
      {
        cle: 'agpm',
        masquee: !ppm && !this.hasEtapeAgpm(),
        sansObjet: this.hasEtapeAgpm() ? null : !this.pointsAgpm().length ? 'Sans objet pour ce plan' : scope && !perim?.agpmAExaminer ? 'Sans objet — inchangé' : 'Sans objet — aucune ligne AGPM',
        total: this.hasEtapeAgpm() ? 1 : 0,
        faites: v.has('A') ? 1 : 0,
        nbObservations: nbObs('agpm'),
        courante: this.estEtapeAgpm(),
        accessible: this.hasEtapeAgpm() && this.estAtteignable(this.etapeAgpmIdx()),
      },
      {
        cle: 'pieces',
        masquee: false,
        sansObjet: this.nbPieces() ? null : 'Sans objet — aucune pièce',
        total: this.nbPieces(),
        faites: this.piecesOrdonnees().filter((p) => v.has('P' + p.idPiece)).length,
        nbObservations: nbObs('pieces'),
        courante: this.estEtapePiece(),
        accessible: this.nbPieces() > 0 && this.estAtteignable(this.offsetPieces()),
      },
      {
        cle: 'dossier',
        masquee: false,
        sansObjet: this.hasEtapeDossier() ? null : this.pointsDossier().length ? 'Sans objet — inchangé' : 'Sans objet — aucun contrôle',
        total: this.hasEtapeDossier() ? 1 : 0,
        faites: v.has('D') ? 1 : 0,
        nbObservations: nbObs('dossier'),
        courante: this.estEtapeDossier(),
        accessible: this.hasEtapeDossier() && this.estAtteignable(this.etapeDossierIdx()),
      },
      {
        cle: 'synthese',
        masquee: false,
        sansObjet: null,
        total: 1,
        faites: 0,
        nbObservations: 0,
        courante: this.estEtapeAvis(),
        accessible: this.toutTraite(),
      },
    ];
    return construireParcours(entrees);
  });

  // ── Grille de contrôle ──────────────────────────────────────────────────────────────────────
  /** Cellules du document proposées à la « cellule visée » (ligne en cours, hors constat). */
  readonly optionsCible = computed<OptionCible[]>(() => {
    const m = this.marcheCourant();
    if (!m || this.estConstat(m.idDetail)) return [];
    const benefs = this.serviceBenefs().filter((b) => b.idDetail === m.idDetail);
    const out: OptionCible[] = [];
    for (const col of COLONNES_PPM_OFFICIEL) {
      if (!col.beneficiaire) {
        out.push({ cle: `${col.champ}|`, libelle: col.libelle, champ: col.champ, idBenef: null, valeur: this.valeurCellule(m, col.champ, null) });
        continue;
      }
      for (const b of benefs) {
        const libelle = benefs.length > 1 ? `${col.libelle} · ${b.soaCode ?? '#' + b.idBenef}` : col.libelle;
        out.push({ cle: `${col.champ}|${b.idBenef}`, libelle, champ: col.champ, idBenef: b.idBenef, valeur: this.valeurCellule(m, col.champ, b) });
      }
    }
    return out;
  });

  readonly vueGrille = computed<VueGrille>(() => {
    const verrouille = this.mode() === 'locked';
    const numeros = this.observationsNumerotees();
    const erreurs = this.pointErreurs();
    const idDetail = this.idDetailCourant();
    const points: PointVue[] = this.pointsCourants().map((p, i) => {
      const st = this.resultat(idDetail, p.idPointCtrl);
      return {
        idPt: p.idPointCtrl,
        rang: i + 1,
        libelle: p.libelPointCtrl || `Point #${p.idPointCtrl}`,
        description: p.decriptPointCtrl || null,
        obligatoire: p.obligatoire,
        statut: st.statut,
        observations: st.observations.map((o, index) => ({
          index,
          numero: numeros.find((n) => n.idPt === p.idPointCtrl && n.idDetail === idDetail && n.index === index)?.numero ?? null,
          auLieuDe: o.auLieuDe,
          lire: o.lire,
          cellule: o.champ ? libelleChampCible(o.champ) : null,
          cleCible: o.champ ? `${o.champ}|${o.idBenefCible ?? ''}` : '',
        })),
        erreur: erreurs.get(p.idPointCtrl) ?? null,
      };
    });
    const resume = {
      ras: points.filter((p) => p.statut === 'RAS').length,
      obs: points.filter((p) => p.statut === 'OBS').length,
      aRenseigner: points.filter((p) => p.statut === null || (p.statut === 'OBS' && !p.observations.some((o) => o.auLieuDe.trim() || o.lire.trim()))).length,
    };
    const base = { points, resume, piece: null, options: [] as OptionCible[], verrouille, justifications: [] as VueGrille['justifications'], puces: [] as VueGrille['puces'] };
    const precedent = this.etape() > 0 ? 'Précédent' : null;
    const raison = (objet: string): string | null =>
      raisonValidationImpossible({ verrouille, objet, points: points.map((p) => ({ rang: p.rang, statut: p.statut, observations: this.resultat(idDetail, p.idPt).observations })) });

    const m = this.marcheCourant();
    if (m) {
      const i = this.indexMarcheCourant();
      const rang = this.rangLigne(m.idDetail);
      const suivant = this.marchesExamen()[i + 1];
      const precedente = this.marchesExamen()[i - 1];
      const puces: VueGrille['puces'] = [];
      const nature = this.natureMap().get(String(m.idNature));
      if (nature) puces.push({ texte: nature });
      if (m.idMode != null) puces.push({ texte: this.modeLabel(m.idMode) });
      const montant = m.nouvMontEstim ?? m.montEstim;
      if (montant != null) puces.push({ texte: `${montantOfficiel(montant)} Ar`, mono: true });
      const chg = this.changements()?.get(m.idDetail);
      if (m.supprimee) puces.push({ texte: 'Ligne supprimée' });
      else if (chg === 'MODIFIEE') puces.push({ texte: 'Modifiée' });
      else if (chg === 'NOUVELLE') puces.push({ texte: 'Nouvelle' });
      else if (chg === 'RESTAUREE') puces.push({ texte: 'Restaurée' });
      if (this.lignesVisees()?.has(rang)) puces.push({ texte: 'Consigne', consigne: true });
      const fiche = this.ficheDoc();
      const justifications: VueGrille['justifications'] = [];
      const derog = fiche.derogatoires.find((l) => l.idDetail === m.idDetail)?.justifModeDerogatoire;
      if (derog) justifications.push({ titre: 'Justification du mode dérogatoire', texte: derog });
      const amenage = fiche.delaisAmenages.find((l) => l.idDetail === m.idDetail)?.justifDelaiAmenage;
      if (amenage) justifications.push({ titre: 'Justification du délai aménagé', texte: amenage });
      return {
        ...base,
        eyebrow: this.examenScope()
          ? `Ligne ${rang} du plan · ${i + 1} sur ${this.nbLignes()} à examiner${this.estConstat(m.idDetail) ? ' · constat de retrait' : ''}`
          : `Ligne ${rang} sur ${this.lignesDuPlan().length}`,
        titre: m.designationMarche || `Ligne #${m.idDetail}`,
        puces,
        justifications,
        options: verrouille ? [] : this.optionsCible(),
        raison: raison(`la ligne ${rang}`),
        libelleValider: suivant ? `Valider la ligne ${rang} et passer à la ${this.rangLigne(suivant.idDetail)}` : `Valider la ligne ${rang} et continuer`,
        libellePrecedent: precedente ? `Ligne ${this.rangLigne(precedente.idDetail)}` : precedent,
      };
    }
    const pc = this.pieceCourante();
    if (pc) {
      const i = this.indexPieceCourante();
      const r = this.resultatPiece(pc.idPiece);
      const puces: VueGrille['puces'] = [];
      if (pc.format) puces.push({ texte: pc.format });
      puces.push({ texte: pc.apresLettreRenvoi ? 'Après lettre de renvoi' : 'Pièce initiale' });
      return {
        ...base,
        eyebrow: `Pièce ${i + 1} sur ${this.nbPieces()}`,
        titre: this.libellePiece(pc),
        puces,
        piece: {
          idPiece: pc.idPiece as number,
          libelle: this.libellePiece(pc),
          statut: r.statut,
          observation: r.observation,
          numero: numeros.find((n) => n.idPiece === pc.idPiece)?.numero ?? null,
          erreur: this.pieceErreur(),
        },
        resume: { ras: r.statut === 'RAS' ? 1 : 0, obs: r.statut === 'OBS' ? 1 : 0, aRenseigner: r.statut === null || (r.statut === 'OBS' && !r.observation.trim()) ? 1 : 0 },
        raison: raisonValidationImpossible({ verrouille, objet: `la pièce ${i + 1}`, points: [], piece: r }),
        libelleValider: i + 1 < this.nbPieces() ? `Valider la pièce ${i + 1} et passer à la ${i + 2}` : `Valider la pièce ${i + 1} et continuer`,
        libellePrecedent: i > 0 ? `Pièce ${i}` : precedent,
      };
    }
    if (this.estEtapeFiche()) {
      return {
        ...base,
        eyebrow: 'Fiche de présentation',
        titre: 'Contrôle de la fiche de présentation',
        puces: [{ texte: this.ficheDoc().nbMarchesConcernes > 1 ? `${this.ficheDoc().nbMarchesConcernes} marchés concernés` : '1 marché concerné' }],
        raison: raison('la fiche'),
        libelleValider: 'Valider la fiche et continuer',
        libellePrecedent: precedent,
      };
    }
    if (this.estEtapeAgpm()) {
      return {
        ...base,
        eyebrow: "Projet d'AGPM",
        titre: "Contrôle du projet d'AGPM",
        puces: [{ texte: pluriel(this.agpmDoc().length, 'ligne') }],
        raison: raison("l'AGPM"),
        libelleValider: "Valider l'AGPM et continuer",
        libellePrecedent: precedent,
      };
    }
    return {
      ...base,
      eyebrow: 'Contrôles du dossier',
      titre: 'Points inter-lignes : fractionnement, cohérence',
      raison: raison('les contrôles du dossier'),
      libelleValider: 'Valider les contrôles du dossier',
      libellePrecedent: precedent,
    };
  });

  // ── Synthèse ────────────────────────────────────────────────────────────────────────────────
  readonly recap = computed<GroupeRecap[]>(() => {
    const obs = this.observationsNumerotees();
    return this.parcours()
      .filter((e): e is typeof e & { cle: GroupeRecap['cle'] } => e.cle !== 'synthese')
      .map((e) => {
        const liste = obs.filter((o) => o.groupe === e.cle);
        const sansObjet = e.etat === 'sans-objet';
        let sousTitre: string | null = null;
        let sansObservation: string | null = null;
        if (!sansObjet && e.cle === 'lignes') {
          const n = this.nbLignes();
          sousTitre = n > 1 ? `${n} lignes examinées` : '1 ligne examinée';
          const avec = new Set(liste.map((o) => o.idDetail));
          const sans = this.marchesExamen().filter((m) => !avec.has(m.idDetail)).length;
          sansObservation = sans ? `${pluriel(sans, 'ligne')} sans observation` : null;
        }
        if (!sansObjet && e.cle === 'pieces') {
          const n = this.nbPieces();
          sousTitre = n > 1 ? `${n} pièces examinées` : '1 pièce examinée';
          const sans = n - liste.length;
          sansObservation = sans ? `${pluriel(sans, 'pièce')} sans observation` : null;
        }
        return {
          cle: e.cle,
          numero: e.numero,
          libelle: e.libelle,
          sansObjet,
          sousTitre,
          statut: sansObjet
            ? { texte: 'Sans objet', genre: 'na' as const }
            : liste.length
              ? { texte: pluriel(liste.length, 'observation'), genre: 'obs' as const }
              : { texte: 'RAS', genre: 'ok' as const },
          observations: liste,
          sansObservation,
        };
      });
  });
  /** Rappel de la consigne en tête du récapitulatif, avec les lignes visées quand elles se lisent. */
  readonly rappelConsigne = computed(() => {
    const c = this.consigne();
    if (!c) return null;
    const visees = this.lignesVisees();
    if (!visees || !this.estPpm()) return `Consigne du dispatch : « ${c} »`;
    const avecObs = [...new Set(this.observationsNumerotees().filter((o) => o.groupe === 'lignes' && o.idDetail != null).map((o) => this.rangLigne(o.idDetail as number)))].filter((r) => visees.has(r));
    return (
      `Consigne du dispatch : « ${c} » — lignes ${numerosEnTexte([...visees])} ; ` +
      (avecObs.length ? `observations sur ${avecObs.length > 1 ? 'les lignes' : 'la ligne'} ${numerosEnTexte(avecObs)}.` : 'aucune observation sur ces lignes.')
    );
  });
  /** Ce qui se passe réellement après le bouton de la synthèse (circuit en place, rien d'inventé). */
  readonly apresSoumission = computed<string[]>(() => {
    const n = this.observationsNumerotees().length;
    if (this.mode() === 'create') {
      return [
        `Le projet de PV est créé en brouillon avec ${n ? pluriel(n, 'observation') : 'aucune observation'}, votre synthèse et votre avis.`,
        'Vous arrivez dans « Projets de PV » : relisez-le, puis soumettez-le au Président ou au Chef de commission qui vous a confié le dossier — la navette suit le circuit en place.',
        'Au visa, votre avis peut être ajusté ; un projet retourné pour rectification revient dans vos « Projets de PV ».',
      ];
    }
    if (this.mode() !== 'edit') return [];
    if (this.estReexamen()) {
      return [
        'Les résultats du réexamen, la synthèse et l\'avis sont enregistrés sur le projet de PV.',
        'Vous arrivez dans « Projets de PV » : soumettez-le de nouveau pour reprendre la navette.',
      ];
    }
    return this.pvEditable()
      ? ["Les modifications de l'examen, la synthèse et l'avis sont enregistrés sur le projet de PV.", 'Le projet de PV poursuit ensuite son circuit depuis « Projets de PV ».']
      : ["Les résultats de l'examen sont mis à jour.", 'Le projet de PV, déjà soumis, suit son circuit dans « Projets de PV ».'];
  });
  readonly libelleRetourSynthese = computed(() => {
    if (this.hasEtapeDossier()) return 'Revenir aux contrôles du dossier';
    if (this.nbPieces()) return 'Revenir à la dernière pièce';
    if (this.hasEtapeAgpm()) return "Revenir à l'AGPM";
    if (this.nbLignes()) return 'Revenir à la dernière ligne';
    if (this.hasEtapeFiche()) return 'Revenir à la fiche';
    return 'Précédent';
  });

  constructor() {
    // Brouillon serveur : les sauvegardes de progression s'exécutent une par une (concatMap) ;
    // une erreur n'interrompt pas la file (toast centralisé, la prochaine validation resauvegarde tout).
    this.saveTrigger
      .pipe(
        concatMap(() =>
          this.sauvegarderProgression().pipe(
            map(() => this.derniereSauvegarde.set(this.heureCourante())),
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.lookups.lookup(NatureService, 'idNature', ['libelle']).subscribe((m) => this.natureMap.set(m));
    this.avisService.list().subscribe((a) => this.aviss.set(a));
    // Référentiels complets pour la fiche/AGPM dérivées (delaiMinJours, derogatoire, declencheAgpm…).
    this.modeService.list().subscribe((m) => this.modesRef.set(m));
    this.capmService.list().subscribe((c) => this.capmsRef.set(c));
    // Délai de l'en-tête (remplace la carte chrono compacte, qui faisait déjà ce GET) + délais
    // standards (lecture ouverte à tout authentifié) — enrichissement : un échec retire la puce.
    this.dossierService.chronometrage(this.idDossier, true).subscribe({ next: (c) => this.chrono.set(c), error: () => {} });
    this.delaiStandardService.listeSilencieuse().subscribe({ next: (d) => this.delais.set(d), error: () => {} });

    // ⚠️ 2026-09-02 — le contenu affiché SUIT l'étape en cours : ligne → Plan, pièce → Pièces,
    // fiche → Fiche, AGPM → AGPM (le document à contrôler est sous les yeux du Membre) ; contrôles
    // du dossier → Plan (lot 2 : les points inter-lignes se lisent sur le plan).
    effect(() => {
      if (this.estEtapeMarche()) this.ongletContenu.set('ppm');
      else if (this.estEtapePiece()) this.ongletContenu.set('pieces');
      else if (this.estEtapeFiche()) this.ongletContenu.set('fiche');
      else if (this.estEtapeAgpm()) this.ongletContenu.set('agpm');
      else if (this.estEtapeDossier()) this.ongletContenu.set('ppm');
    });
    // Étape « Pièce N » : la pièce s'affiche d'elle-même dans la zone document.
    effect(() => {
      const p = this.pieceCourante();
      if (p?.idPiece == null) return;
      untracked(() => {
        if (this.openPiece() !== p.idPiece) this.ouvrirPiece(p);
      });
    });
    // Toute proposition « Observer cette cellule » se referme quand l'étape change.
    effect(() => {
      this.etape();
      untracked(() => this.proposition.set(null));
    });
    // La ligne en cours reste visible dans le document.
    effect(() => {
      if (this.idDetailCourant() == null) return;
      afterNextRender(
        () => {
          const ligne = document.querySelector('.doc__corps tr.doc-ligne--courante') as (HTMLElement & { scrollIntoView?: (o: ScrollIntoViewOptions) => void }) | null;
          ligne?.scrollIntoView?.({ block: 'nearest' });
        },
        { injector: this.injector },
      );
    });

    // ⚠️ Visa unique (2026-08-31) — pré-sélectionne l'avis suggéré à l'arrivée sur l'étape
    // Synthèse, tant que le Membre n'a rien choisi (même patron que le panneau de visa de
    // pv-workflow : un effect qui écrit, jamais un computed).
    effect(() => {
      if (this.estEtapeAvis() && this.syntheseEditable() && !this.avis()) {
        this.avis.set(this.avisSuggere());
      }
    });

    this.loadingPieces.set(true);
    // Dossier partagé : consommé par le forkJoin ET par la grille (dérivée de son sous-type), un seul GET.
    const dossier$ = this.dossierService.getById(this.idDossier).pipe(shareReplay(1));
    forkJoin({
      dossier: dossier$,
      // Pièces jointes DANS la vague (elles portent des étapes d'examen : l'index de l'étape Avis en dépend) ;
      // tolérant à l'échec pour ne pas bloquer l'examen.
      pieces: this.pieceService.getByDossier(this.idDossier).pipe(catchError(() => of([] as PieceJointeDossier[]))),
      examenPieces: this.examenPieceService.list().pipe(catchError(() => of([] as ExamenPiece[]))),
      ppms: this.ppmService.list(),
      marches: this.marcheService.list(),
      receptions: this.receptionService.list(),
      dispatchs: this.dispatchService.list(),
      // Grille effective du sous-type (serveur : communs famille + spécifiques) ; repli famille si idSousType absent.
      points: dossier$.pipe(switchMap((d) => (d.idSousType ? this.pointsCtrlService.grille(d.idSousType) : this.pointsCtrlService.list()))),
      examens: this.examenService.list(),
      details: this.examenDetailService.list(),
      pvs: this.pvExamenService.list(),
      // ⚠️ Périmètre d'examen (pilote 2026-09-10) : AUTORITÉ serveur des lignes à examiner (mise à jour).
      perimetre: this.miseAJourService.perimetreExamen(this.idDossier).pipe(catchError(() => of(null))),
      benefs: this.serviceBenefService.list(),
      previsions: this.previsionService.list(),
    }).subscribe({
      next: (r) => {
        this.dossier.set(r.dossier);
        // ⚠️ Périmètre d'examen posé AVANT l'init des résultats (il en scope les points par ligne).
        this.perimetre.set(r.perimetre);
        // Dossier issu d'une mise à jour → diff vs version précédente (surlignage). Appel silencieux :
        // 403 (le diff est aujourd'hui réservé au PRMP propriétaire) / 409 → pas de surlignage.
        if (r.dossier.idDossierParent != null) {
          this.miseAJourService.diff(r.dossier.idDossier, true).subscribe({
            next: (diff) => {
              const m = new Map<number, TypeChangementLigne>();
              for (const l of diff.lignes) if (l.idDetail != null) m.set(l.idDetail, l.type);
              this.changements.set(m);
            },
            error: () => {},
          });
        }
        this.examens.set(r.examens);
        this.details.set(r.details);
        this.pieces.set(r.pieces);
        this.examenPieces.set(r.examenPieces);
        this.loadingPieces.set(false);
        this.pvs.set(r.pvs);
        this.ppm.set(r.ppms.find((p) => p.idDossier === this.idDossier) ?? null);
        const mines = r.marches.filter((m) => m.idDossier === this.idDossier);
        this.marches.set(mines);
        // Bénéficiaires + prévisions des marchés du dossier (pour le tableau PPM partagé).
        const detailIds = new Set(mines.map((m) => m.idDetail));
        this.serviceBenefs.set(r.benefs.filter((b) => detailIds.has(b.idDetail)));
        this.previsions.set(r.previsions.filter((p) => detailIds.has(p.idDetail)));
        const recIds = new Set(
          r.receptions.filter((x) => x.idDossier === this.idDossier).map((x) => x.idReception),
        );
        const dispatch = r.dispatchs.find((d) => recIds.has(d.idReception));
        this.idDispatch.set(dispatch?.idDispatch ?? null);
        this.consigne.set(dispatch?.instructions?.trim() || null);
        const pts = r.points
          .filter((p) => p.idTypeDossier === r.dossier.idTypeDossier) // no-op sur la grille serveur ; filtre famille en repli
          .sort((a, b) => (a.ordrePointCtrl ?? 0) - (b.ordrePointCtrl ?? 0));
        this.points.set(pts);
        // Init des résultats : chaque point LIGNE × chaque marché, + chaque point HORS LIGNE
        // (DOSSIER / FICHE / AGPM — clé « D », évalués une fois).
        // ⚠️ Demande pilote (2026-09-06) : chaque point de la grille de contrôle est RAS par DÉFAUT
        // — l'assignataire ne bascule sur « Observation » que les points où il relève une
        // irrégularité (un examen sans anomalie ne demande alors aucun clic point par point).
        // ⚠️ Périmètre (pilote 2026-09-10) : dans un examen scopé (mise à jour), n'initialiser QUE les points
        // à examiner — grille LIGNE pour les modifiés/nouveaux, point SUPPRESSION pour les supprimés (constat),
        // rien pour les inchangés ; fiche/AGPM seulement si concernés, dossier toujours.
        const perim = r.perimetre;
        const scope = perim?.miseAJour === true;
        const aExam = new Map((perim?.lignes ?? []).map((l) => [l.idDetail, l.aExaminer]));
        const constat = new Map((perim?.lignes ?? []).map((l) => [l.idDetail, l.constatRequis]));
        const ptsLigne = pts.filter((p) => (p.portee ?? 'LIGNE') === 'LIGNE');
        const ptsSupp = pts.filter((p) => p.portee === 'SUPPRESSION');
        const ptsFiche = pts.filter((p) => p.portee === 'FICHE');
        const ptsAgpm = pts.filter((p) => p.portee === 'AGPM');
        const ptsDossier = pts.filter((p) => p.portee === 'DOSSIER');
        const map = new Map<string, RowState>();
        for (const m of mines) {
          const enPerimetre = !scope || aExam.get(m.idDetail) === true || constat.get(m.idDetail) === true;
          if (!enPerimetre) continue; // ligne inchangée : rien à examiner
          const grille = scope && constat.get(m.idDetail) === true ? ptsSupp : ptsLigne;
          for (const p of grille) map.set(this.cle(m.idDetail, p.idPointCtrl), { statut: 'RAS', observations: [] });
        }
        if (!scope || perim!.ficheAExaminer) for (const p of ptsFiche) map.set(this.cle(null, p.idPointCtrl), { statut: 'RAS', observations: [] });
        if (!scope || perim!.agpmAExaminer) for (const p of ptsAgpm) map.set(this.cle(null, p.idPointCtrl), { statut: 'RAS', observations: [] });
        if (!scope || perim!.dossierAExaminer) for (const p of ptsDossier) map.set(this.cle(null, p.idPointCtrl), { statut: 'RAS', observations: [] });
        // Pré-remplissage depuis l'examen existant du dispatch — dossier EXAMINE (édition) OU dossier
        // encore DISPATCHE avec un BROUILLON de progression (⚠️ règle ajoutée : sauvegarde à chaque étape).
        const idDispatch = this.idDispatch();
        const ex = r.examens.find((e) => e.idDispatch != null && e.idDispatch === idDispatch);
        if (ex) {
          this.existingExamenId.set(ex.idExamen);
          if (ex.dateExamen) this.dateExamen.set(ex.dateExamen);
          const pv = r.pvs.find((p) => p.idExamen === ex.idExamen) ?? null;
          this.existingPv.set(pv);
          if (pv) {
            this.avis.set(pv.idAvis ?? null);
            this.synthese.set(pv.syntheseObservations ?? '');
          }
          const valides = new Set<string>();
          const porteeDe = new Map(pts.map((p) => [p.idPointCtrl, p.portee]));
          for (const det of r.details.filter((d) => d.idExamen === ex.idExamen)) {
            map.set(this.cle(det.idDetail ?? null, det.idPtControle), {
              statut: det.conforme ? 'RAS' : 'OBS',
              // Cible de cellule (V30) reprise telle quelle : l'encadrement se recalcule depuis elle.
              observations: (det.observations ?? []).map((o) => ({
                auLieuDe: o.auLieuDe ?? '',
                lire: o.lire ?? '',
                champ: o.champ ?? null,
                idMarcheCible: o.idMarcheCible ?? null,
                idBenefCible: o.idBenefCible ?? null,
              })),
            });
            // Un résultat déjà enregistré vaut étape validée (affichage de la progression).
            if (det.idDetail != null) valides.add('L' + det.idDetail);
            else {
              const portee = porteeDe.get(det.idPtControle);
              valides.add(portee === 'FICHE' ? 'F' : portee === 'AGPM' ? 'A' : 'D');
            }
          }
          // Résultats des PIÈCES de l'examen existant (⚠️ règle ajoutée : examen pièce par pièce).
          const mapPieces = new Map<number, ResultatPiece>();
          for (const ep of r.examenPieces.filter((x) => x.idExamen === ex.idExamen)) {
            mapPieces.set(ep.idPiece, { statut: ep.conforme ? 'RAS' : 'OBS', observation: ep.observation ?? '' });
            valides.add('P' + ep.idPiece);
          }
          this.resultatsPieces.set(mapPieces);
          this.etapesValidees.set(valides);
        }
        this.resultats.set(map);
        if (ex) {
          if (r.dossier.statut === 'EXAMINE') {
            // Examen déjà réalisé (tout statué) → l'avis est directement accessible (navigation libre).
            this.etape.set(this.etapeAvis());
          } else if (r.dossier.statut === 'A_REEXAMINER') {
            // ⚠️ Réexamen après lettre de renvoi (2026-08-02) : reprise à la première étape non traitée —
            // les pièces complémentaires (après renvoi) ne sont pas encore statuées, l'examen y atterrit.
            this.etape.set(this.calculerReprise());
            this.toast.info(
              'Réexamen — les pièces complémentaires transmises par la PRMP sont à examiner ; ' +
                'soumettez ensuite de nouveau le projet de PV.',
            );
          } else {
            // Brouillon en cours : REPRISE à la première étape non traitée (ligne → pièce → dossier → avis).
            this.etape.set(this.calculerReprise());
            this.toast.info('Examen en cours repris — vous reprenez à la première étape non traitée.');
          }
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Clé de résultat : `${idDetail}:${idPt}` (LIGNE) ou `D:${idPt}` (DOSSIER, idDetail null). */
  private cle(idDetail: number | null, idPt: number): string {
    return `${idDetail ?? 'D'}:${idPt}`;
  }
  /** Résultat d'un point pour une ligne (ou le dossier) — défaut NON statué. */
  resultat(idDetail: number | null, idPt: number): RowState {
    return this.resultats().get(this.cle(idDetail, idPt)) ?? { statut: null, observations: [] };
  }
  private patchResultat(idDetail: number | null, idPt: number, patch: Partial<RowState>): void {
    this.resultats.update((m) => {
      const next = new Map(m);
      next.set(this.cle(idDetail, idPt), { ...this.resultat(idDetail, idPt), ...patch });
      return next;
    });
  }
  private patchObservation(idDetail: number | null, idPt: number, i: number, patch: Partial<ObsLigne>): void {
    this.patchResultat(idDetail, idPt, { observations: this.resultat(idDetail, idPt).observations.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });
  }
  /** Statut d'un point : RAS → conforme (observations vidées) ; OBS → non conforme (amorce une ligne vide). */
  setStatut(idDetail: number | null, idPt: number, statut: 'RAS' | 'OBS'): void {
    if (statut === 'RAS') {
      this.patchResultat(idDetail, idPt, { statut: 'RAS', observations: [] });
    } else {
      const obs = this.resultat(idDetail, idPt).observations;
      this.patchResultat(idDetail, idPt, { statut: 'OBS', observations: obs.length ? obs : [{ auLieuDe: '', lire: '' }] });
    }
  }
  ajouterLigne(idDetail: number | null, idPt: number): void {
    this.patchResultat(idDetail, idPt, { observations: [...this.resultat(idDetail, idPt).observations, { auLieuDe: '', lire: '' }] });
  }
  retirerLigne(idDetail: number | null, idPt: number, i: number): void {
    this.patchResultat(idDetail, idPt, { observations: this.resultat(idDetail, idPt).observations.filter((_, idx) => idx !== i) });
  }
  setAuLieuDe(idDetail: number | null, idPt: number, i: number, v: string): void {
    this.patchObservation(idDetail, idPt, i, { auLieuDe: v });
  }
  setLire(idDetail: number | null, idPt: number, i: number, v: string): void {
    this.patchObservation(idDetail, idPt, i, { lire: v });
  }
  pointErreur(id: number): string | undefined {
    return this.pointErreurs().get(id);
  }

  // — Examen des pièces jointes, une par une (⚠️ règle ajoutée) —
  resultatPiece(idPiece: number | undefined): ResultatPiece {
    return (idPiece != null && this.resultatsPieces().get(idPiece)) || { statut: null, observation: '' };
  }
  setStatutPiece(idPiece: number | undefined, statut: 'RAS' | 'OBS'): void {
    if (idPiece == null) return;
    this.pieceErreur.set(null);
    this.resultatsPieces.update((m) => {
      const next = new Map(m);
      const cur = next.get(idPiece) ?? { statut: null, observation: '' };
      next.set(idPiece, { statut, observation: statut === 'RAS' ? '' : cur.observation });
      return next;
    });
  }
  setObservationPiece(idPiece: number | undefined, v: string): void {
    if (idPiece == null) return;
    this.resultatsPieces.update((m) => {
      const next = new Map(m);
      const cur = next.get(idPiece) ?? { statut: null, observation: '' };
      next.set(idPiece, { ...cur, observation: v });
      return next;
    });
  }
  pieceStatuee(idPiece: number | undefined): boolean {
    return this.resultatPiece(idPiece).statut !== null;
  }
  pieceAObs(idPiece: number | undefined): boolean {
    return this.resultatPiece(idPiece).statut === 'OBS';
  }
  /** État visuel d'une pièce (liste de la zone document) — mêmes états que la marge du plan. */
  etatPiece(p: PieceJointeDossier): 'current' | 'done-ras' | 'done-obs' | 'pending' {
    if (this.pieceCourante()?.idPiece === p.idPiece) return 'current';
    if (this.pieceAObs(p.idPiece)) return 'done-obs';
    if (this.etapesValidees().has('P' + p.idPiece)) return 'done-ras';
    return 'pending';
  }
  libelleEtatPiece(p: PieceJointeDossier): string {
    const e = this.etatPiece(p);
    return e === 'current' ? "Pièce en cours d'examen" : e === 'done-obs' ? 'Pièce avec observation' : e === 'done-ras' ? 'Pièce examinée — sans observation' : 'Pièce à examiner';
  }
  libellePiece(p: PieceJointeDossier): string {
    return p.libellePiece || p.nomFichier || 'Pièce #' + p.idPiece;
  }
  rangPiece(p: PieceJointeDossier): number {
    return this.piecesOrdonnees().findIndex((x) => x.idPiece === p.idPiece) + 1;
  }
  libellePieceOuverte(): string {
    const p = this.piecesOrdonnees().find((x) => x.idPiece === this.openPiece());
    return p ? this.libellePiece(p) : '';
  }

  /**
   * État d'une ligne dans la marge du plan : hors examen / en cours / avec observation / validée /
   * à examiner. « Validée » suit les étapes réellement passées (`etapesValidees`), pas le RAS par défaut.
   */
  readonly etatLigneFn = (idDetail: number): RowExamState => {
    if (this.estHorsExamen(idDetail)) return 'hors'; // inchangée : déjà validée à la version précédente
    if (this.idDetailCourant() === idDetail) return 'current';
    if (this.ligneAObs(idDetail)) return 'done-obs';
    if (this.etapesValidees().has('L' + idDetail)) return 'done-ras';
    return 'pending';
  };

  /** Rang d'une ligne dans le plan affiché (« Ligne 6 »). */
  rangLigne(idDetail: number): number {
    return this.rangsDuPlan().get(idDetail) ?? this.marchesExamen().findIndex((m) => m.idDetail === idDetail) + 1;
  }
  libelleLigne(idDetail: number): string {
    return `Ligne ${this.rangLigne(idDetail)}`;
  }

  /** Clé de l'étape séquentielle `i` dans `etapesValidees` (null pour la synthèse). */
  private cleEtape(i: number): string | null {
    if (this.hasEtapeFiche() && i === this.etapeFicheIdx()) return 'F';
    if (i >= this.offsetLignes() && i < this.offsetLignes() + this.nbLignes()) return 'L' + this.marchesExamen()[i - this.offsetLignes()].idDetail;
    if (this.hasEtapeAgpm() && i === this.etapeAgpmIdx()) return 'A';
    if (i >= this.offsetPieces() && i < this.offsetPieces() + this.nbPieces()) return 'P' + this.piecesOrdonnees()[i - this.offsetPieces()].idPiece;
    if (this.hasEtapeDossier() && i === this.etapeDossierIdx()) return 'D';
    return null;
  }
  private marquerValidee(i: number): void {
    const cle = this.cleEtape(i);
    if (cle && !this.etapesValidees().has(cle)) this.etapesValidees.update((s) => new Set([...s, cle]));
  }

  /** Valide l'étape courante (points OBS ⇒ ≥1 observation) et avance. Bouton activable seulement si tout est statué. */
  validerEtape(): void {
    // Étape pièce : statut requis (gate du bouton) + observation non vide si « Observation ».
    if (this.estEtapePiece()) {
      const st = this.resultatPiece(this.pieceCourante()?.idPiece);
      if (st.statut === 'OBS' && !st.observation.trim()) {
        this.pieceErreur.set("Renseignez l'observation de la pièce (statut « Observation »).");
        return;
      }
      this.pieceErreur.set(null);
      this.marquerValidee(this.etape());
      this.etape.update((e) => Math.min(e + 1, this.etapeAvis()));
      this.declencherSauvegarde(); // brouillon serveur : la progression survit à un départ de la page
      return;
    }
    const idDetail = this.idDetailCourant();
    const err = new Map<number, string>();
    for (const p of this.pointsCourants()) {
      const st = this.resultat(idDetail, p.idPointCtrl);
      if (st.statut === 'OBS' && !st.observations.some((o) => o.auLieuDe.trim() || o.lire.trim())) {
        err.set(p.idPointCtrl, "Au moins une ligne d'observation est obligatoire pour un point avec observation.");
      }
    }
    this.pointErreurs.set(err);
    if (err.size) return;
    // Avance vers l'étape suivante (fiche → lignes → AGPM → pièces → dossier → synthèse). L'état « traité » est dérivé des statuts.
    this.marquerValidee(this.etape());
    this.etape.update((e) => Math.min(e + 1, this.etapeAvis()));
    this.declencherSauvegarde(); // brouillon serveur : la progression survit à un départ de la page
  }
  /** Règle séquentielle (⚠️ ordre pilote 2026-09-04) : fiche d'abord, puis lignes jusqu'à leur frontière, puis AGPM → pièces → dossier → avis. */
  estAtteignable(i: number): boolean {
    const ficheFaite = !this.hasEtapeFiche() || this.ficheStatuee();
    const lignesFaites = ficheFaite && this.frontiere() === this.nbLignes();
    const agpmFait = lignesFaites && (!this.hasEtapeAgpm() || this.agpmStatuee());
    const piecesFaites = agpmFait && this.toutesPiecesStatuees();
    return (
      (this.hasEtapeFiche() && i === this.etapeFicheIdx()) || // la fiche OUVRE le fil : toujours atteignable
      (i >= this.offsetLignes() && i < this.offsetLignes() + this.nbLignes() && ficheFaite && i - this.offsetLignes() <= this.frontiere()) ||
      (this.hasEtapeAgpm() && i === this.etapeAgpmIdx() && lignesFaites) ||
      (i >= this.offsetPieces() && i < this.offsetPieces() + this.nbPieces() && agpmFait && i - this.offsetPieces() <= this.frontierePiece()) ||
      (this.hasEtapeDossier() && i === this.etapeDossierIdx() && piecesFaites) ||
      (i === this.etapeAvis() && this.toutTraite())
    );
  }
  allerEtape(i: number): void {
    if (this.estAtteignable(i)) this.etape.set(i);
  }
  /**
   * Clic sur une étape du parcours : la première sous-étape encore à valider (sinon la première), si
   * la règle séquentielle l'autorise ; sinon un mot explique la séquence (le clic muet donnait
   * l'impression que rien n'existait — même principe que les onglets, arbitrage pilote 02/09).
   */
  allerGroupe(cle: CleEtapeParcours): void {
    const v = this.etapesValidees();
    let cible: number;
    switch (cle) {
      case 'fiche':
        cible = this.etapeFicheIdx();
        break;
      case 'lignes': {
        const i = this.marchesExamen().findIndex((m) => !v.has('L' + m.idDetail));
        cible = this.offsetLignes() + Math.max(i, 0);
        break;
      }
      case 'agpm':
        cible = this.etapeAgpmIdx();
        break;
      case 'pieces': {
        const i = this.piecesOrdonnees().findIndex((p) => !v.has('P' + p.idPiece));
        cible = this.offsetPieces() + Math.max(i, 0);
        break;
      }
      case 'dossier':
        cible = this.etapeDossierIdx();
        break;
      default:
        cible = this.etapeAvis();
    }
    if (this.estAtteignable(cible)) {
      this.etape.set(cible);
      return;
    }
    const messages: Record<CleEtapeParcours, string> = {
      fiche: "La fiche de présentation n'a pas de contrôle à mener pour ce dossier.",
      lignes: "Les lignes du plan s'ouvrent après la fiche de présentation — l'examen est séquentiel.",
      agpm: "Le projet d'AGPM s'ouvre après la fiche de présentation et les lignes du plan — l'examen est séquentiel.",
      pieces: "Les pièces jointes s'ouvrent après la fiche, les lignes du plan et l'AGPM — l'examen est séquentiel.",
      dossier: "Les contrôles du dossier s'ouvrent quand les étapes précédentes sont traitées — l'examen est séquentiel.",
      synthese: "La synthèse s'ouvre quand toutes les étapes de contrôle sont traitées.",
    };
    this.toast.info(messages[cle]);
  }
  /**
   * ⚠️ Arbitrage pilote (2026-09-02) — l'onglet AMÈNE sa grille : cliquer « Fiche de
   * présentation » (ou AGPM, Pièces, Plan) place la grille de contrôle sur l'étape
   * correspondante quand elle est ATTEIGNABLE (la séquence reste la règle) ; sinon le document
   * s'affiche quand même et un mot explique la séquence.
   */
  ouvrirOnglet(o: OngletDocument): void {
    this.ongletContenu.set(o);
    const avant = this.etape();
    // ⚠️ Ordre pilote (2026-09-04) : fiche → lignes → AGPM → pièces. La fiche ouvre le fil, elle
    // est toujours atteignable ; les autres onglets expliquent la séquence quand leur tour n'est
    // pas venu (le document reste consultable).
    if (o === 'fiche' && this.hasEtapeFiche() && !this.estEtapeFiche()) {
      this.allerEtape(this.etapeFicheIdx());
    } else if (o === 'ppm' && !this.estEtapeMarche() && this.frontiere() < this.nbLignes()) {
      this.allerEtape(this.offsetLignes() + this.frontiere());
      if (this.etape() === avant && avant < this.offsetLignes()) {
        this.toast.info(
          "La grille des lignes du plan s'ouvrira après la fiche de présentation — l'examen est séquentiel. Le document reste consultable ici.",
        );
      }
    } else if (o === 'agpm' && this.hasEtapeAgpm() && !this.estEtapeAgpm()) {
      this.allerEtape(this.etapeAgpmIdx());
      if (this.etape() === avant && avant < this.etapeAgpmIdx()) {
        this.toast.info(
          "La grille de l'AGPM s'ouvrira après la fiche de présentation et les lignes du plan — l'examen est séquentiel. Le document reste consultable ici.",
        );
      }
    } else if (o === 'pieces' && this.nbPieces() > 0 && !this.estEtapePiece() && !this.toutesPiecesStatuees()) {
      this.allerEtape(this.offsetPieces() + this.frontierePiece());
      if (this.etape() === avant && avant < this.offsetPieces()) {
        this.toast.info(
          "Les grilles des pièces s'ouvriront après la fiche, les lignes du plan et l'AGPM — l'examen est séquentiel. Les documents restent consultables ici.",
        );
      }
    }
  }
  /** Onglets documentaires au clavier (motif ARIA « tabs », activation manuelle) : flèches, Début, Fin. */
  naviguerOnglets(ev: KeyboardEvent): void {
    const onglets = Array.from((ev.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
    const i = onglets.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const cible = ev.key === 'ArrowRight' ? (i + 1) % onglets.length : ev.key === 'ArrowLeft' ? (i - 1 + onglets.length) % onglets.length : ev.key === 'Home' ? 0 : ev.key === 'End' ? onglets.length - 1 : -1;
    if (cible < 0) return;
    ev.preventDefault();
    onglets[cible].focus();
  }

  /** Rouvre la ligne cliquée dans le tableau (repasse « en cours » ; son état RAS/observation est recalculé après re-validation). */
  ouvrirLigne(m: Marche): void {
    if (this.clicCelluleTraite) {
      this.clicCelluleTraite = false; // le clic de cellule a ouvert une proposition : on reste sur l'étape
      return;
    }
    if (this.estHorsExamen(m.idDetail)) return; // ligne inchangée (hors examen) : non cliquable
    const i = this.marchesExamen().findIndex((x) => x.idDetail === m.idDetail);
    if (i >= 0) this.allerEtape(this.offsetLignes() + i);
  }

  // ── Grille : gestes ─────────────────────────────────────────────────────────────────────────
  surActionGrille(a: ActionGrille): void {
    const idDetail = this.idDetailCourant();
    switch (a.type) {
      case 'statut':
        this.setStatut(idDetail, a.idPt, a.statut);
        break;
      case 'auLieuDe':
        this.setAuLieuDe(idDetail, a.idPt, a.index, a.valeur);
        break;
      case 'lire':
        this.setLire(idDetail, a.idPt, a.index, a.valeur);
        break;
      case 'ajouter':
        this.ajouterLigne(idDetail, a.idPt);
        break;
      case 'retirer':
        this.retirerLigne(idDetail, a.idPt, a.index);
        break;
      case 'cible': {
        const opt = this.optionsCible().find((o) => o.cle === a.cle);
        const o = this.resultat(idDetail, a.idPt).observations[a.index];
        if (!o) break;
        this.patchObservation(
          idDetail,
          a.idPt,
          a.index,
          opt
            ? { champ: opt.champ, idMarcheCible: idDetail, idBenefCible: opt.idBenef, auLieuDe: o.auLieuDe.trim() ? o.auLieuDe : opt.valeur }
            : { champ: null, idMarcheCible: null, idBenefCible: null },
        );
        break;
      }
      case 'statutPiece':
        this.setStatutPiece(this.pieceCourante()?.idPiece, a.statut);
        break;
      case 'observationPiece':
        this.setObservationPiece(this.pieceCourante()?.idPiece, a.valeur);
        break;
      case 'precedent':
        this.allerEtape(this.etape() - 1);
        break;
      case 'valider':
        this.validerEtape();
        break;
      case 'basculer':
        this.grilleOuverte.update((v) => !v);
        break;
    }
  }

  // ── « Observer cette cellule » ──────────────────────────────────────────────────────────────
  /**
   * Clic sur une cellule du document : à l'étape qui la contrôle (ligne en cours, contrôles du
   * dossier, fiche, AGPM), propose d'ouvrir une observation au titre d'un point de la grille.
   * Ailleurs, rien : le clic de ligne garde son rôle (aller à cette ligne).
   */
  proposerObservation(c: CelluleCliquee): void {
    if (this.mode() === 'locked') return;
    const doc = documentDuChamp(c.champ);
    let idDetail: number | null = null;
    let points: PointsCtrl[] = [];
    if (doc === 'PPM' && this.estEtapeMarche()) {
      if (c.idDetail !== this.idDetailCourant() || this.estConstat(c.idDetail)) return;
      idDetail = c.idDetail;
      points = this.pointsPourLigne(c.idDetail);
    } else if (doc === 'PPM' && this.estEtapeDossier()) {
      if (this.estHorsExamen(c.idDetail)) return;
      points = this.pointsDossier();
    } else if (doc === 'FICHE' && this.estEtapeFiche()) {
      points = this.pointsFiche();
    } else if (doc === 'AGPM' && this.estEtapeAgpm()) {
      points = this.pointsAgpm();
    }
    if (!points.length) return;
    this.clicCelluleTraite = doc === 'PPM';
    const r = c.element.getBoundingClientRect();
    const largeur = 300;
    const enBas = r.bottom < window.innerHeight * 0.6;
    this.proposition.set({
      cellule: c,
      idDetail,
      points,
      libelle: libelleChampCible(c.champ),
      left: Math.max(8, Math.min(r.left, window.innerWidth - largeur - 8)),
      top: enBas ? r.bottom + 6 : null,
      bottom: enBas ? null : window.innerHeight - r.top + 6,
    });
  }
  /** Ouvre l'observation au titre du point choisi : « Au lieu de » pré-rempli, cible mémorisée. */
  observerCellule(idPt: number): void {
    const prop = this.proposition();
    if (!prop) return;
    const { cellule: c, idDetail } = prop;
    const st = this.resultat(idDetail, idPt);
    const cible: ObsLigne = { auLieuDe: c.valeur, lire: '', champ: c.champ, idMarcheCible: c.idDetail, idBenefCible: c.idBenef };
    const existantes = st.statut === 'OBS' ? st.observations : [];
    // La ligne vide amorcée par « Observation » est réutilisée plutôt que doublée.
    const libre = existantes.findIndex((o) => !aDuTexte(o) && !o.champ);
    const index = libre >= 0 ? libre : existantes.length;
    const observations = libre >= 0 ? existantes.map((o, i) => (i === libre ? cible : o)) : [...existantes, cible];
    this.patchResultat(idDetail, idPt, { statut: 'OBS', observations });
    this.pointErreurs.update((m) => {
      const n = new Map(m);
      n.delete(idPt);
      return n;
    });
    this.proposition.set(null);
    this.clicCelluleTraite = false;
    this.grilleOuverte.set(true);
    this.focaliserApresRendu(`obs-lire-${idPt}-${index}`);
  }
  fermerProposition(): void {
    if (this.proposition()) this.proposition.set(null);
    this.clicCelluleTraite = false;
  }
  /** Synthèse → « Modifier » : retour à l'étape de l'observation, champ « Lire » ou observation de pièce sous le curseur. */
  modifierObservation(o: ObservationNumerotee): void {
    this.allerEtape(o.etape);
    this.grilleOuverte.set(true);
    this.focaliserApresRendu(o.idPiece != null ? 'obs-piece' : `obs-lire-${o.idPt}-${o.index}`);
  }
  private focaliserApresRendu(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  /** Clic sur une pièce de la liste : aperçu ; pendant les étapes pièces, la grille la suit. */
  choisirPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) return;
    const i = this.piecesOrdonnees().findIndex((x) => x.idPiece === p.idPiece);
    if (this.estEtapePiece() && i >= 0) this.allerEtape(this.offsetPieces() + i);
    if (this.openPiece() !== p.idPiece) this.ouvrirPiece(p);
  }
  /** Ouvre l'aperçu d'une pièce (une seule à la fois) — URL blob assainie (`fichiers-surs`). */
  ouvrirPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) return;
    const idPiece = p.idPiece;
    this.revoquer();
    this.openUrl.set(null);
    this.openPiece.set(idPiece);
    this.loadingPiece.set(idPiece);
    this.pieceService.telecharger(idPiece).subscribe({
      next: (blob) => {
        if (this.openPiece() !== idPiece) return; // une autre pièce a été demandée entre-temps
        this.currentObjectUrl = urlBlobSure(blob);
        this.openUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.currentObjectUrl));
        this.loadingPiece.set(null);
      },
      error: () => {
        if (this.openPiece() !== idPiece) return;
        this.loadingPiece.set(null);
        this.openPiece.set(null);
        this.toast.error("Impossible d'ouvrir la pièce.");
      },
    });
  }
  private revoquer(): void {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }
  ngOnDestroy(): void {
    this.revoquer();
  }
  /** Liste plate des résultats à persister : (marché × point LIGNE) + (points HORS LIGNE — dossier/fiche/AGPM, `idDetail` null). */
  private entreesResultats(): { idDetail: number | null; idPt: number; st: RowState }[] {
    const out: { idDetail: number | null; idPt: number; st: RowState }[] = [];
    // ⚠️ Périmètre (pilote 2026-09-10) : seulement les lignes du périmètre, avec leur grille applicable
    // (LIGNE, ou SUPPRESSION pour un constat), + les points hors-ligne réellement à examiner.
    for (const m of this.marchesExamen())
      for (const p of this.pointsPourLigne(m.idDetail))
        out.push({ idDetail: m.idDetail, idPt: p.idPointCtrl, st: this.resultat(m.idDetail, p.idPointCtrl) });
    for (const p of this.pointsHorsLigneAExaminer()) out.push({ idDetail: null, idPt: p.idPointCtrl, st: this.resultat(null, p.idPointCtrl) });
    return out;
  }
  /** Résultats de pièces à persister (pièces statuées uniquement). */
  private entreesPieces(): { idPiece: number; conforme: boolean; observation?: string }[] {
    return this.piecesOrdonnees()
      .map((p) => ({ idPiece: p.idPiece as number, st: this.resultatPiece(p.idPiece) }))
      .filter((e) => e.st.statut !== null)
      .map((e) => ({
        idPiece: e.idPiece,
        conforme: e.st.statut !== 'OBS',
        observation: e.st.statut === 'OBS' ? e.st.observation.trim() || undefined : undefined,
      }));
  }
  /**
   * Observations à envoyer pour un point (vide sauf statut OBS ; ordre 1-based). ⚠️ V30 (2026-09-14) —
   * la cellule visée part avec sa ligne (`champ`, `idMarcheCible`, `idBenefCible`), champs facultatifs.
   */
  private observationsBody(st: RowState): ObservationControle[] {
    if (st.statut !== 'OBS') {
      return [];
    }
    return st.observations
      .filter((o) => o.auLieuDe.trim() || o.lire.trim())
      .map((o, i) => ({
        auLieuDe: o.auLieuDe.trim() || undefined,
        lire: o.lire.trim() || undefined,
        ordre: i + 1,
        ...(o.champ ? { champ: o.champ, idMarcheCible: o.idMarcheCible ?? null, idBenefCible: o.idBenefCible ?? null } : {}),
      }));
  }

  modeLabel(id?: number): string {
    return id === null || id === undefined ? '—' : this.modeMap().get(String(id)) ?? `#${id}`;
  }
  /** Libellé d'un avis global (lecture seule, mode edit avec PV déjà soumis). */
  avisLabel(id: string | null): string {
    return id ? this.aviss().find((a) => a.idAvis === id)?.libelleAvis ?? id : '—';
  }
  montant(v?: number): string {
    return v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
  dateDoc(iso?: string | null): string {
    return dateOfficielle(iso) || '—';
  }
  valeurDe(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
  private heureCourante(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  /** Valeur affichée d'une cellule du plan (pré-remplissage « Au lieu de » depuis la cellule visée). */
  private valeurCellule(m: Marche, champ: ChampPpmOfficiel, b: ServiceBeneficiaire | null): string {
    const date = (motCle: string): string => {
      const capm = new Map(this.capmsRef().map((c) => [c.idCapm, (c.libelleProcessus ?? '').toUpperCase()]));
      const p = this.previsions().find((x) => x.idDetail === m.idDetail && (capm.get(x.idCapm) ?? '').includes(motCle));
      return dateOfficielle(p?.dateDebut);
    };
    switch (champ) {
      case 'nature': return m.idNature != null ? this.natureMap().get(String(m.idNature)) ?? '' : '';
      case 'objet': return m.designationMarche ?? '';
      case 'montEstim': return montantOfficiel(m.montEstim);
      case 'nouvMontEstim': return montantOfficiel(m.nouvMontEstim);
      case 'mode': return m.idMode != null ? this.modeLabel(m.idMode) : '';
      case 'financement': return m.financement ?? '';
      case 'soa': return b?.soaCode ?? '';
      case 'compte': return b?.numCompte ?? '';
      case 'montBenef': return montantOfficiel(b?.ancMontBenef);
      case 'nouvMontBenef': return montantOfficiel(b?.nouvMontBenef);
      case 'lancement': return date('LANCEMENT');
      case 'ouverture': return date('OUVERTURE');
      case 'attribution': return date('ATTRIBUTION');
    }
  }
  /** Contrôle final : tout point est statué, et tout point OBS a ≥1 observation. Sinon toast + false. */
  private observationsCompletes(): boolean {
    const nonStatue = this.entreesResultats().some((e) => e.st.statut === null);
    if (nonStatue) {
      this.toast.error('Un point de contrôle n\'a pas été statué (RAS ou Observation) — vérifiez chaque ligne.');
      return false;
    }
    const manque = this.entreesResultats().some(
      (e) => e.st.statut === 'OBS' && !e.st.observations.some((o) => o.auLieuDe.trim() || o.lire.trim()),
    );
    if (manque) {
      this.toast.error('Un point avec observation n\'a pas d\'observation renseignée — vérifiez chaque ligne.');
      return false;
    }
    // Pièces jointes : toute pièce « Observation » doit porter son texte (⚠️ règle ajoutée).
    const pieceManque = this.piecesOrdonnees().some((p) => {
      const st = this.resultatPiece(p.idPiece);
      return st.statut === 'OBS' && !st.observation.trim();
    });
    if (pieceManque) this.toast.error("Une pièce avec observation n'a pas d'observation renseignée — vérifiez les étapes Pièce.");
    return !pieceManque;
  }
  private nextId(ids: number[]): number {
    return (ids.length ? Math.max(...ids) : 0) + 1;
  }

  /**
   * ⚠️ 2026-09-08 — l'écran d'examen est PARTAGÉ (Membre, mais aussi CC / Président par délégation
   * ascendante ou redispatch au CC). Les redirections doivent rester DANS l'espace courant, sinon un
   * CC/Président tombe sur « Accès refusé » (les routes `/membre/*` sont réservées au Membre).
   */
  private espaceCourant(): string {
    return this.router.url.split('/')[1] || 'membre';
  }
  /** Liste « Projets de PV » de l'espace : sous le hub `resultat-examen` chez TOUS les profils (Membre inclus depuis 2026-09-13). */
  private routeProjetsPv(): unknown[] {
    return ['/' + this.espaceCourant(), 'resultat-examen', 'pv'];
  }

  annuler(): void {
    void this.router.navigate(['/' + this.espaceCourant(), 'tableau-de-bord']);
  }

  /** Mode édition (dossier EXAMINE) : met à jour l'examen + ses détails (pas de nouveau PV/lettre). */
  enregistrer(): void {
    const idDispatch = this.idDispatch();
    if (!this.dossier() || idDispatch == null) return;
    if (!this.observationsCompletes()) return;
    // ⚠️ Refonte lot 2 (maquette ExamenSynthese validée) — la synthèse est obligatoire dès qu'elle est saisissable.
    if (this.pvEditable() && !this.synthese().trim()) {
      this.formError.set('Rédigez la synthèse des observations : elle accompagne votre avis dans le projet de PV.');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);
    this.modifier(idDispatch);
  }

  /**
   * Création — « Soumettre l'examen » : toutes les lignes/pièces traitées + synthèse + AVIS, crée
   * le projet de PV. ⚠️ Visa unique (2026-08-31, inverse la règle du 01/08) — l'avis du Membre part
   * avec la soumission (cohérence validée serveur : ≥ 1 observation → FAV refusé) ; le Secrétaire
   * de séance reste posé au visa.
   */
  soumettre(): void {
    if (!this.dossier() || this.idDispatch() == null) return;
    if (!this.toutTraite()) {
      this.formError.set('Traitez toutes les lignes de marché, toutes les pièces jointes, la fiche de présentation, l\'AGPM et l\'étape dossier avant de soumettre.');
      return;
    }
    if (!this.observationsCompletes()) return;
    const idAvis = this.avis();
    if (!idAvis) {
      this.formError.set('Sélectionnez votre avis global — il accompagne la soumission de l\'examen.');
      return;
    }
    // ⚠️ Refonte lot 2 (maquette ExamenSynthese validée) — la synthèse des observations est obligatoire.
    if (!this.synthese().trim()) {
      this.formError.set('Rédigez la synthèse des observations : elle accompagne votre avis dans le projet de PV.');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);
    // Réconciliation FINALE (tous les résultats statués), puis soumission avec l'avis du Membre.
    this.sauvegarderProgression()
      .pipe(
        switchMap((idExamen) => this.examenService.soumettre(idExamen, { idAvis })),
        // La synthèse ne fait pas partie d'ExamenSoumissionRequest : on la persiste via une MAJ du PV créé
        // (encore BROUILLON) — PUT /api/pv-examens/{id}.
        // `pv` sort tout juste de la soumission : le spread renvoie donc la `version` COURANTE
        // (verrou optimiste, portée par le modèle) — ce PUT ne peut pas conflicter.
        switchMap((pv) => {
          const synthese = this.synthese().trim();
          return synthese ? this.pvExamenService.update(pv.idPv, { ...pv, syntheseObservations: synthese }) : of(pv);
        }),
      )
      .subscribe({
        next: (pv: PvExamen) => {
          this.toast.success('Examen soumis · projet de PV créé (points de contrôle + synthèse).');
          // ⚠️ Demande pilote (2026-09-08) — enchaîner directement sur la GESTION du projet de PV :
          // on passe l'id du PV créé en query param, la liste « Projets de PV » ouvre son modal
          // automatiquement (plus besoin de cliquer « Gérer »). Route de l'ESPACE courant (le CC /
          // le Président y accèdent aussi — /membre/pv leur serait refusé).
          void this.router.navigate(this.routeProjetsPv(), { queryParams: { gerer: pv.idPv } });
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          // 400 ciblé (grille incomplète…) : afficher le détail par champ, pas un message générique.
          const msg =
            (e.fieldErrors && Object.values(e.fieldErrors).join(' ')) ||
            e.message ||
            "Erreur lors de la soumission de l'examen.";
          this.formError.set(msg);
          this.toast.error(msg);
        },
      });
  }

  /** Création d'examen en cours (single-flight : deux appels rapprochés partagent le même POST). */
  private examenCreation$: Observable<number> | null = null;
  /**
   * Garantit l'existence de l'examen (créé SANS détails — ils sont réconciliés par
   * {@link sauvegarderProgression}) et renvoie son id.
   */
  private ensureExamen(): Observable<number> {
    const existing = this.existingExamenId();
    if (existing != null) {
      return of(existing);
    }
    if (!this.examenCreation$) {
      const im = this.auth.ref() ?? '';
      const idExamen = this.nextId(this.examens().map((e) => e.idExamen));
      const examen: Examen = {
        idExamen,
        idDispatch: this.idDispatch() as number,
        imCtrlMembre: im || undefined,
        dateExamen: this.dateExamen(),
      };
      this.examenCreation$ = this.examenService.create(examen).pipe(
        map(() => {
          this.existingExamenId.set(idExamen);
          this.examens.update((arr) => [...arr, examen]);
          return idExamen;
        }),
        catchError((e) => {
          this.examenCreation$ = null; // réessayable
          throw e;
        }),
        shareReplay(1),
      );
    }
    return this.examenCreation$;
  }

  /**
   * ⚠️ Règle ajoutée — SAUVEGARDE DE PROGRESSION (brouillon serveur) : garantit l'examen puis
   * réconcilie tous les résultats **statués** (détails par (idDetail, idPtControle) ; pièces par
   * idPiece) — création ou mise à jour, jamais les points non statués. Appelée à chaque validation
   * d'étape et avant la soumission (l'état serveur reflète toujours la dernière situation).
   */
  private sauvegarderProgression(): Observable<number> {
    return this.ensureExamen().pipe(
      switchMap((idExamen) => {
        const calls: Observable<unknown>[] = [];
        const detailParCle = new Map(
          this.details().filter((d) => d.idExamen === idExamen).map((d) => [this.cle(d.idDetail ?? null, d.idPtControle), d]),
        );
        let idd = this.nextId(this.details().map((d) => d.idDetailExamen));
        const nouveauxDetails: ExamenDetail[] = [];
        for (const e of this.entreesResultats().filter((x) => x.st.statut !== null)) {
          const existing = detailParCle.get(this.cle(e.idDetail, e.idPt));
          const body: ExamenDetail = {
            idDetailExamen: existing?.idDetailExamen ?? idd++,
            idExamen,
            idDetail: e.idDetail,
            idPtControle: e.idPt,
            conforme: e.st.statut !== 'OBS',
            observations: this.observationsBody(e.st),
          };
          if (!existing) nouveauxDetails.push(body);
          calls.push(existing ? this.examenDetailService.update(existing.idDetailExamen, body) : this.examenDetailService.create(body));
        }
        const pieceParId = new Map(this.examenPieces().filter((x) => x.idExamen === idExamen).map((x) => [x.idPiece, x]));
        let idp = this.nextId(this.examenPieces().map((x) => x.idExamenPiece));
        const nouvellesPieces: ExamenPiece[] = [];
        for (const e of this.entreesPieces()) {
          const existing = pieceParId.get(e.idPiece);
          const body: ExamenPiece = {
            idExamenPiece: existing?.idExamenPiece ?? idp++,
            idExamen,
            idPiece: e.idPiece,
            conforme: e.conforme,
            observation: e.observation,
          };
          if (!existing) nouvellesPieces.push(body);
          calls.push(existing ? this.examenPieceService.update(existing.idExamenPiece, body) : this.examenPieceService.create(body));
        }
        return (calls.length ? forkJoin(calls) : of([])).pipe(
          map(() => {
            // Caches locaux → la prochaine réconciliation mettra à jour au lieu de recréer.
            if (nouveauxDetails.length) this.details.update((arr) => [...arr, ...nouveauxDetails]);
            if (nouvellesPieces.length) this.examenPieces.update((arr) => [...arr, ...nouvellesPieces]);
            return idExamen;
          }),
        );
      }),
    );
  }

  /** File de sauvegardes SÉRIALISÉE (concatMap) : jamais deux réconciliations en parallèle. */
  private readonly saveTrigger = new Subject<void>();
  /** Déclenche une sauvegarde de progression en arrière-plan (mode création uniquement). */
  private declencherSauvegarde(): void {
    if (this.mode() !== 'create' || this.idDispatch() == null) return;
    this.saveTrigger.next();
  }

  /** Point de reprise d'un brouillon (ordre pilote 2026-09-04) : fiche, sinon première ligne non statuée, sinon AGPM, sinon première pièce, sinon dossier, sinon avis. */
  private calculerReprise(): number {
    if (this.hasEtapeFiche() && !this.ficheStatuee()) return this.etapeFicheIdx();
    if (this.frontiere() < this.nbLignes()) return this.offsetLignes() + this.frontiere();
    if (this.hasEtapeAgpm() && !this.agpmStatuee()) return this.etapeAgpmIdx();
    if (this.frontierePiece() < this.nbPieces()) return this.offsetPieces() + this.frontierePiece();
    if (this.hasEtapeDossier() && !this.dossierStatue()) return this.etapeDossierIdx();
    return this.etapeAvis();
  }

  /** Mode édition (dossier EXAMINE) : met à jour l'examen + réconcilie les détails (sans recréer le PV). */
  private modifier(idDispatch: number): void {
    const idExamen = this.existingExamenId();
    if (idExamen == null) {
      this.saving.set(false);
      return;
    }
    const im = this.auth.ref() ?? '';
    const examen: Examen = { idExamen, idDispatch, imCtrlMembre: im || undefined, dateExamen: this.dateExamen() };
    // Réconciliation par (idDetail, idPtControle) : un détail existant par couple ligne↔point.
    const detailParCle = new Map(
      this.details()
        .filter((d) => d.idExamen === idExamen)
        .map((d) => [this.cle(d.idDetail ?? null, d.idPtControle), d]),
    );
    let baseNew = this.nextId(this.details().map((d) => d.idDetailExamen));

    this.examenService
      .update(idExamen, examen)
      .pipe(
        switchMap(() => {
          const calls: Observable<unknown>[] = this.entreesResultats().map((e) => {
            const existing = detailParCle.get(this.cle(e.idDetail, e.idPt));
            const body: ExamenDetail = {
              idDetailExamen: existing?.idDetailExamen ?? baseNew++,
              idExamen,
              idDetail: e.idDetail,
              idPtControle: e.idPt,
              conforme: e.st.statut !== 'OBS',
              observations: this.observationsBody(e.st),
            };
            return existing
              ? this.examenDetailService.update(existing.idDetailExamen, body)
              : this.examenDetailService.create(body);
          });
          // Réconciliation des PIÈCES par (idExamen, idPiece) : mise à jour si un résultat existe, sinon création.
          const pieceParId = new Map(
            this.examenPieces().filter((x) => x.idExamen === idExamen).map((x) => [x.idPiece, x]),
          );
          let idpNew = this.nextId(this.examenPieces().map((x) => x.idExamenPiece));
          for (const e of this.entreesPieces()) {
            const existing = pieceParId.get(e.idPiece);
            const body: ExamenPiece = {
              idExamenPiece: existing?.idExamenPiece ?? idpNew++,
              idExamen,
              idPiece: e.idPiece,
              conforme: e.conforme,
              observation: e.observation,
            };
            calls.push(existing ? this.examenPieceService.update(existing.idExamenPiece, body) : this.examenPieceService.create(body));
          }
          return calls.length ? forkJoin(calls) : of([]);
        }),
        // Projet de PV éditable : on met à jour (PV BROUILLON existant) ou on le CRÉE (aucun PV encore),
        // pour persister la synthèse ET l'avis. ⚠️ Visa unique (2026-08-31) — l'avis est celui du
        // MEMBRE tant que le PV est entre ses mains (rectification comprise : il peut le changer d'un
        // cycle à l'autre) ; le Président/CC pourra encore l'ajuster au visa, où la cohérence est
        // revalidée par le serveur.
        switchMap(() => {
          if (!this.pvEditable()) return of(null);
          const pv = this.existingPv();
          const synthese = this.synthese().trim() || undefined;
          if (pv) {
            // Le spread renvoie la `version` du PV chargé (verrou optimiste) : si un autre acteur l'a
            // touché entre-temps, le serveur répond 409 CONFLIT_VERSION plutôt que d'écraser.
            return this.pvExamenService.update(pv.idPv, {
              ...pv,
              idAvis: this.avis() ?? pv.idAvis,
              syntheseObservations: synthese,
            });
          }
          // Aucun projet de PV (examen créé sans soumission) → le créer DIRECTEMENT
          // (POST /api/pv-examens). On n'utilise pas la façade examens/{id}/soumettre :
          // elle attend un dossier DISPATCHE et renvoie 400 sur un dossier déjà EXAMINE.
          const nouveauPv: PvExamen = {
            idPv: this.nextId(this.pvs().map((p) => p.idPv)),
            idExamen,
            imCtrlMembre: this.auth.ref() ?? '', // @NotBlank requis ; valeur ignorée (dérivée du dispatch)
            idAvis: this.avis() ?? undefined,
            statutPv: 'BROUILLON',
            nbNavettes: 0,
            syntheseObservations: synthese,
          };
          return this.pvExamenService.create(nouveauPv);
        }),
      )
      .subscribe({
        next: () => {
          // ⚠️ Réexamen (2026-08-02) : la navette ne repart qu'à la RE-SOUMISSION du projet de PV
          // (le dossier repasse alors EXAMINE côté serveur) → on guide vers « Projets de PV ».
          if (this.estReexamen()) {
            this.toast.success(
              'Réexamen enregistré — soumettez de nouveau le projet de PV au Président / Chef de commission pour reprendre la navette.',
            );
            void this.router.navigate(this.routeProjetsPv());
          } else {
            this.toast.success('Examen modifié.');
            void this.router.navigate(['/' + this.espaceCourant(), 'mes-dossiers']);
          }
        },
        error: (e: ApiError) => {
          this.saving.set(false); // 409 (verrouillé) / 403 → toast centralisé
          if (estConflitVersion(e)) {
            this.rechargerPv();
          }
        },
      });
  }

  /**
   * Conflit de version sur le projet de PV : un autre acteur l'a modifié depuis son chargement.
   * On le relit pour repartir de l'état serveur — la synthèse saisie est perdue, comme l'annonce le
   * toast (« Rechargez puis réessayez »), et la version fraîche permet de réessayer sans reconflicter.
   */
  private rechargerPv(): void {
    const idPv = this.existingPv()?.idPv;
    if (idPv == null) return;
    this.pvExamenService.getById(idPv).subscribe((pv) => {
      this.existingPv.set(pv);
      this.pvs.update((arr) => arr.map((p) => (p.idPv === pv.idPv ? pv : p)));
      this.synthese.set(pv.syntheseObservations ?? '');
    });
  }
}
