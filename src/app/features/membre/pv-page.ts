import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ToastService } from '../../core/notifications/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import {
  Dispatch,
  Dossier,
  Examen,
  ExamenDetail,
  ExamenPiece,
  Marche,
  ObservationControle,
  PieceJointeDossier,
  PvExamen,
  PvNavette,
  Reception,
} from '../../models';
import {
  AvisService,
  ControleurService,
  DispatchService,
  DossierService,
  EntiteContractService,
  ExamenDetailService,
  ExamenPieceService,
  ExamenService,
  MarcheService,
  PieceJointeDossierService,
  PointsCtrlService,
  PvExamenService,
  PvNavetteService,
  ReceptionService,
  ReferenceLookupService,
} from '../../services';
import { ChronometrageDossier, PvWorkflow, PV_STATUT_LABELS, StatutBadge, examenRectifiable } from '../../shared/circuit';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { LienDossier } from '../circuit/page-dossier/lien-dossier';
import { EtapeCircuitPv, etapesCircuitPv, phraseEtatPv } from './pv-circuit';

/**
 * Projets de PV du Membre : liste (lecture + contenu détaillé) et actions de workflow
 * (soumettre / signer…) déléguées au composant partagé `app-pv-workflow`.
 * Le PV brouillon est créé automatiquement au moment de l'examen (pas de création manuelle ici).
 */
@Component({
  selector: 'app-membre-pv',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, PvWorkflow, DatePipe, RouterLink, ChronometrageDossier, ModaleDirective],
  template: `
    <section class="pv">
      <header class="page-header">
        <h1 class="page-title">Projets de PV</h1>
      </header>

      @if (loading()) {
        <p class="pv__info" role="status">Chargement…</p>
      } @else {
        <!-- ⚠️ Demande pilote (2026-09-04) : MÊME présentation que le tableau des PV définitifs
             (table-card à colonnes, référence + entité dès la liste — 2026-08-03) ; le détail
             « Gérer » s'ouvre dans une rangée pleine largeur sous la ligne. -->
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th scope="col">Référence</th>
                <th scope="col">Dossier</th>
                <th scope="col">Entité contractante</th>
                <th scope="col">Statut</th>
                <th scope="col" class="r">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (pv of pvs(); track pv.idPv) {
                <tr>
                  <td><span class="pv-row__ref">{{ pv.refePv || pv.referencePv || ('PV #' + pv.idPv) }}</span></td>
                  <td class="cnm-mono" style="white-space:nowrap;">{{ dossierRef(pv) }}</td>
                  <td>{{ dossierEntite(pv) }}</td>
                  <td><app-statut-badge [statut]="pv.statutPv" [label]="label(pv)" /></td>
                  <td>
                    <div class="td-actions pv-row__actions">
                      <!-- Lot L4-F6 : le dossier s'ouvre sur sa PAGE (Ctrl+clic = nouvel onglet). -->
                      @if (dossierDe(pv); as d) {
                        <a class="btn btn-outline btn-sm" [routerLink]="lien.commandes(d.idDossier)" [queryParams]="lien.params()">
                          📂 Voir le dossier
                        </a>
                      }
                      <button type="button" class="btn btn-secondary btn-sm" (click)="selectionner(pv)">Gérer</button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="pv__info">Aucun projet de PV en cours.</td></tr>
              }
            </tbody>
          </table>
        </div>

        <!-- ⚠️ Demande pilote (2026-09-04) : le détail « Gérer » s'ouvre en MODALE — directive appModale (focus, Échap, piège de Tab).
             ⚠️ 28/10 (maquette validée, docs/maquette-2026-10-28-pv-simplifie.html) — fenêtre simplifiée : en-tête en trois lignes, le
             contenu du PV d'abord (synthèse, observations), la frise du circuit à la place des tuiles de signataires, les navettes
             repliées, et les gestes dans le pied, toujours visibles. Mêmes données, mêmes gestes. -->
        @if (selected(); as pv) {
          <div class="modal-backdrop" [class.closing]="closingDetail()">
            <div class="modal modal-lg pv-modal" role="dialog" aria-modal="true"
              [attr.aria-label]="'Projet de PV ' + (pv.refePv || pv.referencePv || pv.idPv)"
              appModale (appModaleFermer)="fermerDetail()">
              <div class="modal-header pv-tete">
                <div class="pv-tete__txt">
                  <h2 class="modal-title pv-tete__titre">
                    <span class="cnm-mono">{{ pv.refePv || pv.referencePv || ('Projet de PV #' + pv.idPv) }}</span>
                    <app-statut-badge [statut]="pv.statutPv" [label]="label(pv)" />
                  </h2>
                  <p class="pv-tete__ligne">Dossier <b class="cnm-mono">{{ dossierRef(pv) }}</b> · {{ dossierEntite(pv) }}</p>
                  <p class="pv-tete__ligne">
                    Avis {{ pv.statutPv === 'PROJET_ACCEPTE' || pv.statutPv === 'SIGNE' ? 'arrêté' : 'proposé' }} :
                    @if (pv.idAvis) { <span [class]="avisClasse(pv.idAvis)">{{ avisLabel(pv.idAvis) }}</span> } @else { <i>en attente</i> }
                    @if (pv.datePv) { · Date du PV <b>{{ dateFr(pv.datePv) }}</b> }
                  </p>
                  @if (idDossierDe(pv); as idDos) {
                    <app-chronometrage-dossier class="pv-tete__chrono" [idDossier]="idDos" [compact]="true" />
                  }
                </div>
                <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerDetail()">✕</button>
              </div>
              <div class="modal-body">
                <div class="pv-content" #pvContent>
                  @if (pv.statutPv === 'EN_RECTIFICATION' && dernierRetour()) {
                    <!-- ⚠️ 2026-08-18 — le retour se lit ici, avec l'accès à la correction. -->
                    <div class="alert alert-warning pv-retour">
                      <span><strong>Retour pour rectification :</strong> {{ dernierRetour() }}</span>
                      @if (peutRectifier(pv)) {
                        <a class="btn pv-retour__cta" [routerLink]="lienRectification(pv)">✎ Rectifier l'examen</a>
                      }
                    </div>
                    @if (peutRectifier(pv)) {
                      <p class="pv-retour__aide">
                        Corrigez la grille de contrôle et la synthèse, enregistrez, puis revenez ici pour <strong>soumettre le projet</strong>.
                      </p>
                    }
                  }

                  @if (pv.syntheseObservations) {
                    <section>
                      <h3 class="pv-sub">Synthèse du Membre</h3>
                      <p class="pv-synthese">{{ pv.syntheseObservations }}</p>
                    </section>
                  }

                  <section>
                    <div class="pv-sub">
                      <h3>Observations ({{ nbObservations() }})</h3>
                      @if (details().length) {
                        <!-- Par défaut : seuls les points AVEC OBSERVATION ; la grille complète est à un clic. -->
                        <button type="button" class="pv-lien" (click)="grilleComplete.set(!grilleComplete())">
                          {{ grilleComplete() ? 'Observations seulement (' + nbObservations() + ')' : 'Voir les ' + details().length + ' points' }}
                        </button>
                      }
                    </div>
                    @if (details().length && !groupesAffiches().length) {
                      <p class="pv-ok">Tous les points de contrôle sont conformes — aucune observation.</p>
                    } @else if (details().length) {
                      <table class="pv-table">
                        <thead><tr><th scope="col">Point de contrôle</th><th scope="col">Résultat</th><th scope="col">Au lieu de → Lire</th></tr></thead>
                        <tbody>
                          <!-- Groupés par LIGNE DE MARCHÉ, puis les points inter-lignes « Dossier » (examen séquentiel). -->
                          @for (g of groupesAffiches(); track g.cle) {
                            <tr class="pv-grp"><td colspan="3">{{ g.titre }}</td></tr>
                            @for (d of g.rows; track d.idDetailExamen) {
                              <tr>
                                <td class="pv-table__point">{{ pointLabel(d.idPtControle) }}</td>
                                <td class="pv-table__res" [class.pv-ko]="!d.conforme" [class.pv-bon]="d.conforme">{{ d.conforme ? 'Conforme' : 'Non conforme' }}</td>
                                <td>
                                  @if (!d.conforme && observationsTriees(d).length) {
                                    @for (o of observationsTriees(d); track o.idObservation ?? $index) {
                                      <div class="pv-obs"><span class="pv-obs__avant">{{ o.auLieuDe || '—' }}</span> → <span class="pv-obs__apres">{{ o.lire || '—' }}</span></div>
                                      @if (o.champFiche) {
                                        <div class="pv-obs__fiche">Information de la fiche DAO : <b>{{ o.libelleChampFiche || o.champFiche }}</b>@if (o.lot) { — lot {{ o.lot }} }@if (o.valeurChampFiche) { · valeur observée « {{ o.valeurChampFiche }} » }</div>
                                      }
                                    }
                                  } @else {
                                    <span class="pv-vide">—</span>
                                  }
                                </td>
                              </tr>
                            }
                          }
                        </tbody>
                      </table>
                    } @else {
                      <p class="pv__info">Aucun détail d'examen pour ce PV.</p>
                    }
                  </section>

                  <section>
                    <div class="pv-sub">
                      <h3>Pièces jointes</h3>
                      @if (examenPiecesPv().length && nbObservationsPieces()) {
                        <button type="button" class="pv-lien" (click)="piecesCompletes.set(!piecesCompletes())">
                          {{ piecesCompletes() ? 'Observations seulement (' + nbObservationsPieces() + ')' : 'Voir les ' + examenPiecesPv().length + ' pièces' }}
                        </button>
                      }
                    </div>
                    @if (examenPiecesPv().length && !piecesAffichees().length) {
                      <p class="pv-ok">{{ examenPiecesPv().length > 1 ? 'Les ' + examenPiecesPv().length + ' pièces examinées sont conformes.' : 'La pièce examinée est conforme.' }}</p>
                    } @else if (examenPiecesPv().length) {
                      <table class="pv-table">
                        <thead><tr><th scope="col">Pièce</th><th scope="col">Résultat</th><th scope="col">Observation</th></tr></thead>
                        <tbody>
                          @for (ep of piecesAffichees(); track ep.idExamenPiece) {
                            <tr>
                              <td class="pv-table__point">{{ pieceLabel(ep.idPiece) }}</td>
                              <td class="pv-table__res" [class.pv-ko]="!ep.conforme" [class.pv-bon]="ep.conforme">{{ ep.conforme ? 'Conforme' : 'Non conforme' }}</td>
                              <td>{{ ep.observation || '—' }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    } @else {
                      <p class="pv__info">Aucun examen de pièce pour ce PV.</p>
                    }
                  </section>

                  <section>
                    <h3 class="pv-sub">Circuit du PV</h3>
                    <ol class="pv-circuit">
                      @for (e of circuit(pv); track e.libelle) {
                        <li class="pv-circuit__etape" [class.pv-circuit__etape--fait]="e.etat === 'fait'" [class.pv-circuit__etape--encours]="e.etat === 'encours'"
                          [attr.aria-current]="e.etat === 'encours' ? 'step' : null">
                          <span class="pv-circuit__pt" aria-hidden="true"></span>
                          <span>{{ e.libelle }}<small>{{ e.detail }}</small></span>
                        </li>
                      }
                    </ol>
                    <!-- Notion retirée du cycle le 02/09 : mention réservée aux PV historiques qui en portent un. -->
                    @if (pv.nomSecretaireSeance || pv.idSecretaireSeance) {
                      <p class="pv__info">Secrétaire de séance : {{ pv.nomSecretaireSeance || pv.idSecretaireSeance }}</p>
                    }
                  </section>

                  <details class="pv-navettes">
                    <summary>Historique des navettes ({{ navettes().length }})</summary>
                    @if (navettes().length) {
                      <table class="pv-table">
                        <thead><tr><th scope="col">N°</th><th scope="col">Sens</th><th scope="col">Acteur</th><th scope="col">Date</th><th scope="col">Commentaire</th></tr></thead>
                        <tbody>
                          @for (n of navettes(); track n.idNavette) {
                            <tr>
                              <td class="cnm-mono">{{ n.numNavette }}</td>
                              <td>{{ sensLabel(n.sens) }}</td>
                              <td>{{ acteurNom(n.imActeur) }}</td>
                              <td style="white-space:nowrap;">{{ (n.dateAction | date: 'dd/MM/yyyy HH:mm') || '—' }}</td>
                              <td>{{ n.commentaire || '—' }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    } @else {
                      <p class="pv__info">Aucun aller-retour pour ce PV.</p>
                    }
                  </details>
                </div>
              </div>
              <!-- Les gestes du PV (soumettre, viser, retourner, lettre, signer), toujours visibles ; leurs panneaux s'ouvrent ici. -->
              <div class="modal-footer pv-pied">
                <p class="pv-pied__quoi">{{ phraseEtat(pv) }}</p>
                <button type="button" class="btn btn-outline" (click)="imprimer(pv)">Imprimer</button>
                <app-pv-workflow class="pv-pied__gestes" variante="pied" [pv]="pv" [idLocalite]="dossierLocalite(pv)" [idDossier]="idDossierDe(pv)"
                  [nbObservationsExamen]="nbObservations() + nbObservationsPieces()" (changed)="onChanged($event)" />
              </div>
            </div>
          </div>
        }
      }
    </section>

  `,
  styles: `
    .pv__info { color: var(--n-500); padding: 0.5rem 0; }
    /* « Aucune action sans prise en charge » (2026-09-04) : actions du PV inertes avant la prise en charge. */
    .pv__verrou { margin: 0.5rem 0; padding: 0.6rem 0.9rem; border: 1px solid var(--examen-texte); background: var(--examen-fond); color: var(--examen-texte); border-radius: 8px; font-size: var(--text-sm); }
    /* Tableau de liste (demande pilote 2026-09-04) : même style que « PV définitifs ». */
    .pv-row__ref { font-weight: 500; color: var(--c-800); }
    .pv-row__actions { justify-content: flex-end; }
    /* ⚠️ 28/10 (maquette validée) — la fenêtre du PV simplifiée : en-tête en trois lignes, contenu d'abord, gestes dans le pied. */
    .pv-modal { width: min(1080px, 96vw); max-width: 96vw; }
    .pv-tete { align-items: flex-start; }
    .pv-tete__txt { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
    .pv-tete__titre { margin: 0; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; font-size: var(--text-lg, 1.1rem); }
    .pv-tete__ligne { margin: 0; color: var(--n-500); font-size: var(--text-sm); }
    .pv-tete__ligne b { color: var(--n-700); font-weight: 500; }
    .pv-tete__chrono { margin-top: 0.2rem; font-size: var(--text-sm); }
    .pv-content { display: flex; flex-direction: column; gap: 1.3rem; }
    .pv-content td { white-space: normal; }
    .pv-sub, .pv-sub h3 { margin: 0 0 0.5rem; font-size: var(--text-xs); font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--n-500); }
    div.pv-sub { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
    div.pv-sub h3 { margin: 0; }
    .pv-lien { background: none; border: 0; padding: 0; font: 500 var(--text-sm) var(--font-base); color: var(--p-700); cursor: pointer; }
    .pv-lien:hover { text-decoration: underline; }
    .pv-lien:focus-visible { outline: 2px solid var(--p-600); outline-offset: 2px; }
    .pv-synthese { margin: 0; padding: 0.6rem 0.9rem; border-left: 3px solid var(--p-600); background: var(--p-50); border-radius: 0 8px 8px 0; color: var(--n-700); white-space: pre-wrap; }
    /* Tableaux sobres : pas de bande sombre, des filets fins. */
    .pv-table { width: 100%; border-collapse: collapse; }
    .pv-table thead tr { background: none; }
    .pv-table th { text-align: left; font-size: var(--text-xs); font-weight: 500; text-transform: uppercase; letter-spacing: 0.07em; color: var(--n-400); background: none; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--n-200); }
    .pv-table td { padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--n-100); vertical-align: top; }
    .pv-table__point { width: 34%; }
    .pv-table__res { width: 14%; white-space: nowrap; }
    .pv-ko { color: var(--danger-text); font-weight: 500; }
    .pv-bon { color: var(--success-text); }
    .pv-grp td { background: var(--n-50); color: var(--n-500); font-weight: 500; font-size: var(--text-xs); padding: 0.35rem 0.6rem; }
    .pv-obs__avant { color: var(--n-500); text-decoration: line-through; text-decoration-color: var(--retard-texte); }
    .pv-obs__apres { color: var(--n-800); font-weight: 500; }
    .pv-obs__fiche { font-size: var(--text-xs); color: var(--n-500); margin-top: 0.15rem; }
    .pv-vide { color: var(--n-400); }
    .pv-ok { margin: 0; color: var(--success-text); font-weight: 500; }
    .pv-ok::before { content: '✓ '; }
    /* La frise du circuit : examen, soumission, visa, signature. */
    .pv-circuit { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0; margin: 0; padding: 0; list-style: none; }
    .pv-circuit__etape { display: flex; align-items: center; gap: 0.5rem; font-size: var(--text-sm); color: var(--n-500); }
    .pv-circuit__etape + .pv-circuit__etape::before { content: ''; width: 2rem; height: 2px; background: var(--n-300); margin: 0 0.6rem; }
    .pv-circuit__etape small { display: block; font-size: var(--text-xs); color: var(--n-400); }
    .pv-circuit__pt { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--n-300); background: var(--carte-fond); flex: none; }
    .pv-circuit__etape--fait .pv-circuit__pt { background: var(--success-text); border-color: var(--success-text); }
    .pv-circuit__etape--encours { color: var(--n-800); font-weight: 500; }
    .pv-circuit__etape--encours .pv-circuit__pt { background: var(--bouton-principal); border-color: var(--bouton-principal); box-shadow: 0 0 0 4px var(--p-100); }
    .pv-navettes summary { cursor: pointer; font-size: var(--text-xs); font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--n-500); }
    .pv-navettes[open] summary { margin-bottom: 0.5rem; }
    /* Le pied : la phrase d'état à gauche, les gestes à droite ; un panneau ouvert (visa, retour, lettre) prend toute la largeur. */
    .pv-pied { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.6rem 0.75rem; max-height: 55vh; overflow: auto; }
    .pv-pied__quoi { flex: 1 1 18rem; margin: 0; align-self: center; color: var(--n-500); font-size: var(--text-sm); }
    .pv-pied__gestes { flex: 1 1 100%; }
    @media (min-width: 64rem) { .pv-pied__gestes { flex: 0 1 auto; } }
    @media (max-width: 40rem) { .pv-table__point, .pv-table__res { width: auto; } .pv-circuit__etape + .pv-circuit__etape::before { width: 0.8rem; margin: 0 0.4rem; } }
    /* Le retour de navette porte son action : le motif à gauche, « Rectifier » à droite. */
    .pv-retour { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .pv-retour .btn { flex-shrink: 0; text-decoration: none; }
    .pv-retour__aide { margin: 0.4rem 0 0; font-size: var(--text-sm); color: var(--n-500); }
    /*
     * Action attendue du Membre : elle doit se voir sur le jaune pâle du bandeau (var(--examen-fond)).
     * « btn-warning » y est invisible (même fond que l'alerte) et le bleu primaire s'y fond ;
     * d'où cet orange soutenu. Blanc sur #C2410C = 5,2:1 — au-dessus du seuil AA, comme
     * l'exige le design system pour tout texte.
     */
    .pv-retour .pv-retour__cta {
      background: var(--examen-texte);
      border-color: var(--examen-texte);
      color: var(--texte-menu);
      font-weight: 500;
      box-shadow: none;
    }
    .pv-retour .pv-retour__cta:hover {
      background: var(--examen-texte);
      box-shadow: none;
      transform: translateY(-1px);
    }
    .pv-retour .pv-retour__cta:focus-visible { outline: 3px solid var(--examen-texte); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      .pv-retour .pv-retour__cta:hover { transform: none; }
    }
  `,
})
export class MembrePv {
  private readonly service = inject(PvExamenService);
  private readonly toast = inject(ToastService);
  private readonly detailService = inject(ExamenDetailService);
  private readonly navetteService = inject(PvNavetteService);
  private readonly examenService = inject(ExamenService);
  private readonly examenPieceService = inject(ExamenPieceService);
  private readonly marcheService = inject(MarcheService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly dispatchService = inject(DispatchService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly permissions = inject(PermissionsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly pvs = signal<PvExamen[]>([]);
  readonly loading = signal(false);
  /**
   * ⚠️ Demande pilote (2026-09-08) — arrivée depuis « Soumettre l'examen » avec `?gerer=<idPv>` :
   * le modal de gestion du PV s'ouvre TOUT SEUL (plus besoin de cliquer « Gérer »). `chaineChargee`
   * signale que la jointure PV→dossier est prête, pour que le modal s'ouvre avec un contenu complet
   * (chronométrage, marchés). `autoOuvertFait` garantit une ouverture unique.
   */
  private readonly autoOuvrirId = signal<number | null>(null);
  private readonly chaineChargee = signal(false);
  private autoOuvertFait = false;
  readonly selected = signal<PvExamen | null>(null);
  /** Animation de sortie de la modale du détail (voir `fermerAvecAnimation`). */
  readonly closingDetail = signal(false);
  /** Ferme la modale du détail en jouant l'animation (voile, Échap, bouton ✕). */
  fermerDetail(): void {
    fermerAvecAnimation(this.closingDetail, () => this.selected.set(null));
  }
  /**
   * ⚠️ 2026-08-03 — le dossier d'origine se consultait en modale depuis un projet de PV.
   * Lot L4-F6 : « Voir le dossier » est un LIEN vers `/<espace>/dossier/:id`, avec le retour ici.
   */
  protected readonly lien = inject(LienDossier);

  /** Détails d'examen (grille) du PV ouvert + caches de libellés. */
  private readonly pvContent = viewChild<ElementRef<HTMLElement>>('pvContent');
  readonly details = signal<ExamenDetail[]>([]);
  readonly navettes = signal<PvNavette[]>([]);
  /** Résultats d'examen des pièces jointes du PV ouvert (t_examen_piece), dans l'ordre des pièces. */
  readonly examenPiecesPv = signal<ExamenPiece[]>([]);
  /** Marchés du dossier du PV ouvert (ordre de l'examen) + pièces jointes (libellés). */
  private readonly marchesDossier = signal<Marche[]>([]);
  private readonly piecesDossier = signal<PieceJointeDossier[]>([]);
  /**
   * Grille groupée : un groupe par ligne de marché (titre = « Ligne N — désignation »), puis un groupe
   * « Dossier » pour les points inter-lignes (idDetail null). Repli « Marché #id » si le marché est inconnu.
   */
  readonly groupesGrille = computed(() => {
    const parCle = new Map<number | 'D', ExamenDetail[]>();
    for (const d of this.details()) {
      const k = d.idDetail ?? 'D';
      const arr = parCle.get(k) ?? [];
      arr.push(d);
      parCle.set(k, arr);
    }
    const groupes: { cle: string; titre: string; rows: ExamenDetail[] }[] = [];
    this.marchesDossier().forEach((m, i) => {
      const rows = parCle.get(m.idDetail);
      if (rows?.length) {
        groupes.push({ cle: 'M' + m.idDetail, titre: `Ligne ${i + 1} — ${m.designationMarche || 'Marché #' + m.idDetail}`, rows });
        parCle.delete(m.idDetail);
      }
    });
    for (const [k, rows] of parCle) {
      if (k !== 'D') {
        groupes.push({ cle: 'M' + k, titre: `Marché #${k}`, rows });
      }
    }
    const dossierRows = parCle.get('D');
    if (dossierRows?.length) {
      groupes.push({ cle: 'D', titre: 'Dossier — points inter-lignes', rows: dossierRows });
    }
    return groupes;
  });
  /** Bascule d'affichage de la grille : observations seulement (défaut) ↔ grille complète. */
  readonly grilleComplete = signal(false);
  readonly nbObservations = computed(() => this.details().filter((d) => !d.conforme).length);
  /** Même bascule pour les pièces jointes. */
  readonly piecesCompletes = signal(false);
  readonly nbObservationsPieces = computed(() => this.examenPiecesPv().filter((p) => !p.conforme).length);
  readonly piecesAffichees = computed(() =>
    this.piecesCompletes() ? this.examenPiecesPv() : this.examenPiecesPv().filter((p) => !p.conforme),
  );
  /** Groupes rendus : filtrés aux points non conformes (groupes vides omis), sauf en mode complet. */
  readonly groupesAffiches = computed(() => {
    if (this.grilleComplete()) {
      return this.groupesGrille();
    }
    return this.groupesGrille()
      .map((g) => ({ ...g, rows: g.rows.filter((d) => !d.conforme) }))
      .filter((g) => g.rows.length > 0);
  });
  /** Dernier commentaire de retour pour rectification (navette RETOUR_RECTIF la plus récente). */
  readonly dernierRetour = computed(() => {
    const retours = this.navettes().filter((n) => n.sens === 'RETOUR_RECTIF');
    return retours.length ? retours[retours.length - 1].commentaire ?? '' : '';
  });
  private readonly avisMap = signal<Map<string, string>>(new Map());
  private readonly pointsMap = signal<Map<string, string>>(new Map());
  private readonly controleurMap = signal<Map<string, string>>(new Map());

  // Chaîne PV → examen → dispatch → réception → dossier (pour réf. + entité du dossier).
  private readonly examens = signal<Examen[]>([]);
  private readonly dispatchs = signal<Dispatch[]>([]);
  private readonly receptions = signal<Reception[]>([]);
  private readonly dossiers = signal<Dossier[]>([]);
  private readonly entiteMap = signal<Map<string, string>>(new Map());

  /** idExamen → dossier rattaché (jointure FK en mémoire). */
  private readonly dossierByExamen = computed(() => {
    const recById = new Map(this.receptions().map((r) => [r.idReception, r]));
    const dispById = new Map(this.dispatchs().map((d) => [d.idDispatch, d]));
    const dosById = new Map(this.dossiers().map((d) => [d.idDossier, d]));
    const map = new Map<number, Dossier>();
    for (const e of this.examens()) {
      const disp = e.idDispatch != null ? dispById.get(e.idDispatch) : undefined;
      const rec = disp ? recById.get(disp.idReception) : undefined;
      const dos = rec ? dosById.get(rec.idDossier) : undefined;
      if (dos) {
        map.set(e.idExamen, dos);
      }
    }
    return map;
  });

  private static readonly SENS_LABELS: Record<string, string> = {
    SOUMISSION: 'Soumission',
    RETOUR_RECTIF: 'Retour rectification',
    ACCEPTATION: 'Acceptation',
  };

  constructor() {
    // ⚠️ Demande pilote (2026-09-08) — `?gerer=<idPv>` posé par « Soumettre l'examen » : ouvrir le
    // modal de gestion du PV dès que la liste ET la jointure dossier sont prêtes (contenu complet).
    const g = this.route.snapshot.queryParamMap.get('gerer');
    this.autoOuvrirId.set(g != null && /^\d+$/.test(g) ? Number(g) : null);
    effect(() => {
      const id = this.autoOuvrirId();
      if (id == null || this.autoOuvertFait) return;
      if (this.loading() || !this.chaineChargee()) return; // attendre PVs + jointure dossier
      this.autoOuvertFait = true; // une seule fois, même si le PV n'est plus dans la liste
      this.autoOuvrirId.set(null);
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      const pv = this.pvs().find((p) => p.idPv === id);
      if (pv) this.selectionner(pv);
    });

    this.charger();
    this.lookups.lookup(AvisService, 'idAvis', ['libelleAvis']).subscribe((m) => this.avisMap.set(m));
    this.lookups.lookup(PointsCtrlService, 'idPointCtrl', ['libelPointCtrl']).subscribe((m) => this.pointsMap.set(m));
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(ControleurService, 'imControleur', ['nomCont', 'prenomsCont']).subscribe((m) => this.controleurMap.set(m));
    // Chaîne pour relier chaque PV à son dossier (réf. + entité).
    forkJoin({
      examens: this.examenService.list(),
      dispatchs: this.dispatchService.list(),
      receptions: this.receptionService.list(),
      dossiers: this.dossierService.list(),
    }).subscribe(({ examens, dispatchs, receptions, dossiers }) => {
      this.examens.set(examens);
      this.dispatchs.set(dispatchs);
      this.receptions.set(receptions);
      this.dossiers.set(dossiers);
      this.chaineChargee.set(true);
    });
  }

  /** ⚠️ 2026-08-03 — dossier d'origine du PV (bouton « Voir le dossier » + modale de consultation). */
  dossierDe(pv: PvExamen): Dossier | null {
    return this.dossierByExamen().get(pv.idExamen) ?? null;
  }
  dossierRef(pv: PvExamen): string {
    const d = this.dossierByExamen().get(pv.idExamen);
    return d ? d.refeDossier || 'Dossier #' + d.idDossier : '—';
  }
  dossierEntite(pv: PvExamen): string {
    const d = this.dossierByExamen().get(pv.idExamen);
    return d?.idEntiteContract != null
      ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract
      : '—';
  }
  /** Localité du dossier du PV (périmètre de l'intérim et candidats co-signataires au visa). */
  dossierLocalite(pv: PvExamen): string | null {
    return this.dossierByExamen().get(pv.idExamen)?.idLocalite ?? null;
  }
  /** Dossier du PV — pour le chronométrage (prise en charge VISA / COSIGNATURE). */
  idDossierDe(pv: PvExamen): number | null {
    return this.dossierByExamen().get(pv.idExamen)?.idDossier ?? null;
  }
  /**
   * Attributaire COURANT du dispatch de l'examen du PV (`imCtrlMembre`, réattributions comprises).
   * Sert de garde à « Rectifier l'examen » (`peutRectifier` : seul l'assignataire rectifie).
   */
  attributaireDe(pv: PvExamen): string | undefined {
    const exam = this.examens().find((e) => e.idExamen === pv.idExamen);
    if (exam?.idDispatch == null) return undefined;
    return this.dispatchs().find((d) => d.idDispatch === exam.idDispatch)?.imCtrlMembre;
  }
  /**
   * ⚠️ 2026-08-18 — « Rectifier l'examen » depuis le retour de navette. La règle d'ouverture de
   * l'examen est partagée (`examenRectifiable`) avec la liste des dossiers examinés et l'écran
   * d'examen : elle avait divergé entre ces trois écrans, au point de rendre la rectification
   * impossible.
   *
   * ⚠️ 2026-09-04 — « seul l'ASSIGNATAIRE examine » (règle pilote, garde serveur d24c115) : la
   * capacité EXAMEN_WRITE ne suffit plus — le Président et le CC la portent par délégation mais
   * n'ont pas à rectifier l'examen d'autrui. Le bouton n'apparaît qu'à l'attributaire courant du
   * dispatch ; les autres voient le motif du retour, sans le geste.
   */
  peutRectifier(pv: PvExamen): boolean {
    return (
      pv.statutPv === 'EN_RECTIFICATION' &&
      this.permissions.can('EXAMEN_WRITE') &&
      this.attributaireDe(pv) === this.auth.ref() &&
      examenRectifiable(pv.statutPv, this.dossierByExamen().get(pv.idExamen)?.statut)
    );
  }
  /** Cible de « Rectifier l'examen » — l'écran d'examen de l'espace courant (membre, cc, président). */
  lienRectification(pv: PvExamen): unknown[] {
    const idDossier = this.dossierByExamen().get(pv.idExamen)?.idDossier;
    return ['/' + (this.router.url.split('/')[1] || 'membre'), 'examiner', idDossier];
  }
  /** ⚠️ 28/10 (maquette validée) — la frise du circuit du PV, à la place des tuiles de signataires. */
  circuit(pv: PvExamen): EtapeCircuitPv[] {
    return etapesCircuitPv(pv, { nom: (im) => this.acteurNom(im ?? undefined), imDispatcheur: this.dispatcheurDe(pv) });
  }
  /** La phrase du pied : où en est le PV, avec le nom de celui qui vise. */
  phraseEtat(pv: PvExamen): string {
    const im = pv.imCtrlPresident ?? this.dispatcheurDe(pv);
    return phraseEtatPv(pv, im ? this.acteurNom(im) : 'le Président ou le Chef de commission');
  }
  /** Le dispatcheur de l'examen du PV : c'est lui qui vise (ADR visa unique). */
  private dispatcheurDe(pv: PvExamen): string | null {
    const exam = this.examens().find((e) => e.idExamen === pv.idExamen);
    return exam?.idDispatch == null ? null : this.dispatchs().find((d) => d.idDispatch === exam.idDispatch)?.imCtrlDispatch ?? null;
  }
  /** « 2026-10-28 » → « 28/10/2026 ». */
  dateFr(d?: string | null): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d ?? '';
  }
  /** Acteur d'une navette : nom résolu depuis la fiche contrôleur (repli matricule). */
  acteurNom(im?: string): string {
    if (!im) {
      return '—';
    }
    return this.controleurMap().get(im) ?? im;
  }

  /** Impression / PDF du contenu du PV (fenêtre dédiée → Imprimer ou « Enregistrer au format PDF »). */
  imprimer(pv: PvExamen): void {
    const el = this.pvContent()?.nativeElement;
    if (!el) {
      return;
    }
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      this.toast.error("Impossible d'ouvrir la fenêtre d'impression (popups bloqués ?).");
      return;
    }
    // Interpolée dans du HTML brut (document.write) : échappement obligatoire.
    const ref = this.echapperHtml(this.dossierRef(pv));
    // Le nom du PDF enregistré reprend la référence du dossier (titre du document).
    const titre = `PV ${ref}`;
    // ⚠️ 28/10 — l'en-tête de la fenêtre n'est plus dans le contenu imprimé : l'identification du PV est écrite ici.
    const refPv = this.echapperHtml(pv.refePv || pv.referencePv || 'Projet de PV n° ' + pv.idPv);
    const heading = `${pv.statutPv === 'SIGNE' ? 'PV' : 'Projet de PV'} ${refPv}`;
    const avis = pv.idAvis ? this.echapperHtml(this.avisLabel(pv.idAvis)) : 'en attente';
    const identite = `<p class="ident">Dossier <b>${ref}</b> · ${this.echapperHtml(this.dossierEntite(pv))}<br>Statut : <b>${this.echapperHtml(this.label(pv))}</b> · Avis : <b>${avis}</b></p>`;
    // Les navettes, repliées à l'écran, s'impriment dépliées.
    const contenu = el.cloneNode(true) as HTMLElement;
    contenu.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
    w.document.write(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${titre}</title>` +
        `<style>` +
        // ⚠️ Sans print-color-adjust:exact, l'impression/PDF supprime fonds et couleurs (badges, groupes…).
        `*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}` +
        `body{font-family:system-ui,'Segoe UI',Roboto,sans-serif;color:#1a2230;padding:24px;line-height:1.5}` +
        `h1{font-size:18px;margin:0 0 12px}` +
        `h3{font-size:13px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.05em;color:#555}` +
        `table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}` +
        `th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}` +
        `th{background:#f2f4f8;text-transform:uppercase;font-size:11px;color:#666}` +
        `dl{margin:0}dl>div{display:flex;gap:8px;margin:2px 0}` +
        `dt{flex:0 0 170px;text-transform:uppercase;font-size:11px;color:#888}dd{margin:0}` +
        `.cnm-mono{font-family:Consolas,'Courier New',monospace;font-size:12px}` +
        // Badges (statut du PV, avis global) — mêmes teintes que l'écran.
        `.badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid #E5E7EB;background:#F3F4F6;color:#4B5563}` +
        `.badge-success{background:#F0FDF4;color:#15803D;border-color:#BBF7D0}` +
        `.badge-warning{background:#FFFBEB;color:#B45309;border-color:#FDE68A}` +
        `.badge-danger{background:#FEF2F2;color:#B91C1C;border-color:#FECACA}` +
        `.badge-info{background:#EFF6FF;color:#1D4ED8;border-color:#BFDBFE}` +
        // ⚠️ 28/10 — la fenêtre simplifiée : identification, titres, synthèse, observations, frise.
        `.ident{margin:0 0 12px;font-size:13px;color:#444}` +
        `.pv-sub,.pv-sub h3{margin:16px 0 6px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#666}` +
        `.pv-synthese{margin:0;border-left:3px solid #0284c7;background:#f0f9ff;padding:8px 12px;white-space:pre-wrap}` +
        `.pv-grp td{background:#f3f5f9;font-weight:700;font-size:12px}` +
        `.pv-ko{color:#b42318;font-weight:700}.pv-bon{color:#059669}` +
        `.pv-obs__avant{text-decoration:line-through;color:#666}.pv-obs__apres{font-weight:700}.pv-obs__fiche{font-size:11px;color:#666}` +
        `.pv-ok{margin:0;color:#059669;font-weight:600}` +
        `.pv-circuit{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 18px}.pv-circuit small{display:block;color:#777;font-size:11px}.pv-circuit__pt{display:none}` +
        `summary{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#666;list-style:none}` +
        `button,.pv-lien{display:none!important}` +
        `</style></head><body><h1>${heading}</h1>${identite}${contenu.innerHTML}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  /** Échappe un texte interpolé dans le HTML brut de la fenêtre d'impression. */
  private echapperHtml(texte: string): string {
    return texte.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
    );
  }

  label(pv: PvExamen): string {
    return PV_STATUT_LABELS[pv.statutPv];
  }
  /** Libellé de l'avis — « — » sur un PV de l'ancien contrat sans avis (le visa le fournira). */
  avisLabel(id?: string): string {
    return id ? this.avisMap().get(id) ?? id : '—';
  }
  /** Couleur du badge d'avis (mêmes règles que la vue Assistant) : FAVR orange, FAV vert, DEF rouge. */
  avisClasse(id?: string): string {
    const code = (id || '').toUpperCase();
    if (code.startsWith('FAVR')) {
      return 'badge badge-warning';
    }
    if (code.startsWith('FAV')) {
      return 'badge badge-success';
    }
    if (code.startsWith('DEF')) {
      return 'badge badge-danger';
    }
    return 'badge badge-neutral';
  }
  pointLabel(id: number): string {
    return this.pointsMap().get(String(id)) ?? `#${id}`;
  }
  /** Lignes « AU LIEU DE / LIRE » du point, triées par `ordre` ASC. */
  observationsTriees(d: ExamenDetail): ObservationControle[] {
    return [...(d.observations ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  }
  sensLabel(sens: string): string {
    return MembrePv.SENS_LABELS[sens] ?? sens;
  }

  /** Ouverture du détail : UNE seule vague (détails + navettes + pièces + marchés), cf. [[modals-une-seule-vague]]. */
  selectionner(pv: PvExamen): void {
    const opening = this.selected()?.idPv !== pv.idPv;
    this.selected.update((cur) => (cur?.idPv === pv.idPv ? null : pv));
    this.details.set([]);
    this.navettes.set([]);
    this.examenPiecesPv.set([]);
    this.marchesDossier.set([]);
    this.piecesDossier.set([]);
    this.grilleComplete.set(false); // chaque ouverture repart en « observations seulement »
    this.piecesCompletes.set(false);
    if (opening) {
      const dossier = this.dossierByExamen().get(pv.idExamen);
      forkJoin({
        details: this.detailService.list(),
        navettes: this.navetteService.list(),
        examenPieces: this.examenPieceService.list().pipe(catchError(() => of([] as ExamenPiece[]))),
        marches: this.marcheService.list().pipe(catchError(() => of([] as Marche[]))),
        pieces: dossier
          ? this.pieceService.getByDossier(dossier.idDossier).pipe(catchError(() => of([] as PieceJointeDossier[])))
          : of([] as PieceJointeDossier[]),
      }).subscribe(({ details, navettes, examenPieces, marches, pieces }) => {
        this.details.set(details.filter((d) => d.idExamen === pv.idExamen));
        this.navettes.set(navettes.filter((n) => n.idPv === pv.idPv).sort((a, b) => a.numNavette - b.numNavette));
        // Marchés du dossier dans l'ordre de l'API (même numérotation « Ligne N » que l'écran d'examen).
        this.marchesDossier.set(dossier ? marches.filter((m) => m.idDossier === dossier.idDossier) : []);
        this.piecesDossier.set(pieces);
        // Résultats de pièces du PV, ordonnés comme la liste des pièces du dossier.
        const ordre = new Map(pieces.map((p, i) => [p.idPiece, i]));
        this.examenPiecesPv.set(
          examenPieces
            .filter((x) => x.idExamen === pv.idExamen)
            .sort((a, b) => (ordre.get(a.idPiece) ?? 999) - (ordre.get(b.idPiece) ?? 999)),
        );
      });
    }
  }

  /** Libellé d'une pièce jointe examinée (repli nom de fichier puis #id). */
  pieceLabel(idPiece: number): string {
    const p = this.piecesDossier().find((x) => x.idPiece === idPiece);
    return p?.libellePiece || p?.nomFichier || 'Pièce #' + idPiece;
  }

  charger(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.pvs.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onChanged(updated: PvExamen): void {
    this.selected.set(updated);
    this.charger();
  }
}
