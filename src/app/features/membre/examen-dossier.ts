import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, Subject, catchError, concatMap, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { urlBlobSure } from '../../core/securite/fichiers-surs';
import {
  Avis,
  Dossier,
  Examen,
  ExamenDetail,
  ExamenPiece,
  Marche,
  MarchePrevision,
  ObservationControle,
  PieceJointeDossier,
  PointsCtrl,
  Ppm,
  PvExamen,
  ServiceBeneficiaire,
  TypeChangementLigne,
} from '../../models';
import {
  AvisService,
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
  PieceJointeDossierService,
  PointsCtrlService,
  PpmService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
  ServiceBeneficiaireService,
  TypeDossierService,
} from '../../services';
import { StatutBadge, examenRectifiable } from '../../shared/circuit';
import { PpmMarchesTable } from '../../shared/prmp/ppm-marches-table';

/** Une ligne « AU LIEU DE / LIRE » saisie pour un point non conforme. */
interface ObsLigne {
  auLieuDe: string;
  lire: string;
}
/** Statut explicite d'un point de contrôle : `null` = non statué, `RAS` = conforme, `OBS` = avec observation. */
type StatutPoint = 'RAS' | 'OBS' | null;
interface RowState {
  statut: StatutPoint;
  /** Lignes d'observation (statut OBS) ; vide sinon. */
  observations: ObsLigne[];
}

/**
 * Écran d'examen d'un dossier dispatché (profil Membre) : consultation en lecture seule
 * (en-tête + lignes de marché en libellés, listes scopées filtrées par idDossier, libellés
 * en cache) + formulaire d'examen (grille des points de contrôle, synthèse des observations).
 *
 * ⚠️ Règle modifiée (2026-08-01) — le Membre ne renseigne QUE la synthèse : l'avis global, le
 * Secrétaire de séance et la lettre de renvoi appartiennent à la CLÔTURE DE NAVETTE du projet
 * de PV (écran « Projets de PV », Président/CC uniquement).
 *
 * Enregistrement : POST /examens → POST /examen-details ×N + POST /pv-examens (BROUILLON),
 * ce qui matérialise le « projet de PV » (points de contrôle + synthèse, sans avis). Le backend
 * reste l'autorité (409 si non DISPATCHE, 403 hors localité) ; erreurs via l'intercepteur.
 */
@Component({
  selector: 'app-examen-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, PpmMarchesTable],
  template: `
    <section class="exam">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine Membre</div>
          <h1 class="page-title">{{ mode() === 'edit' ? 'Modifier l\\'examen' : 'Examiner' }} — {{ dossier()?.refeDossier || ('Dossier #' + idDossier) }}</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (!dossier()) {
        <p class="text-muted">Dossier introuvable ou hors de votre périmètre.</p>
      } @else {
        <div class="exam__grid">
          <div class="card exam__panel">
            <div class="card-header"><span class="card-title">Contenu du dossier</span></div>
            <div class="card-body">
              <dl class="exam__info">
                <div><dt>Type</dt><dd>{{ typeLabel() }}</dd></div>
                <div><dt>Entité contractante</dt><dd>{{ entiteLabel() }}</dd></div>
                <div><dt>Localité</dt><dd>{{ localiteLabel() }}</dd></div>
                <div><dt>Statut</dt><dd><app-statut-badge [statut]="dossier()!.statut" /></dd></div>
                <div><dt>Date réf.</dt><dd class="cnm-mono">{{ dossier()!.dateRef || '—' }}</dd></div>
              </dl>
              @if (estPpm()) {
                @if (ppm(); as p) {
                  <h3 class="exam__sub">PPM — {{ p.reference || ('#' + p.idPpm) }}</h3>
                  <dl class="exam__info">
                    <div><dt>Exercice</dt><dd>{{ p.exercice }}</dd></div>
                    <div><dt>Signataire</dt><dd>{{ p.signataire || '—' }}</dd></div>
                  </dl>
                }
                <div class="exam__marches">
                  <app-ppm-marches-table [marches]="marches()" [beneficiaires]="serviceBenefs()" [previsions]="previsions()" [changements]="changements()" [rowStateFn]="etatLigneFn" (rowClick)="ouvrirLigne($event)" />
                </div>
              }
              <div class="exam__pieces">
                <h3 class="exam__sub">Pièces jointes</h3>
                @if (loadingPieces()) {
                  <p class="cnm-muted" role="status">Chargement des pièces…</p>
                } @else {
                  @if (piecesInitiales().length) {
                    <div class="exam__pieces-grp">
                      <span class="exam__pieces-pill">Pièces initiales · {{ piecesInitiales().length }}</span>
                      @for (p of piecesInitiales(); track p.idPiece; let i = $index) {
                        <!-- <button> et non <div> : l'ouverture d'une pièce doit être atteignable
                             au clavier — c'est l'action centrale de l'écran d'examen (AUDIT.md A4). -->
                        <button
                          type="button"
                          class="exam__piece exam__piece--{{ etatPiece(p) }}"
                          [class.is-open]="openPiece() === p.idPiece"
                          [attr.aria-expanded]="openPiece() === p.idPiece"
                          [attr.aria-controls]="'piece-vue-' + p.idPiece"
                          (click)="togglePiece(p)"
                        >
                          <span class="exam__piece-etat exam__piece-etat--{{ etatPiece(p) }}" aria-hidden="true">{{ marqueurPiece(p) }}</span>
                          <span class="exam__piece-idx">{{ i + 1 }}</span>
                          <span class="exam__piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                          @if (p.format) { <span class="badge exam__piece-fmt">{{ p.format }}</span> }
                          <span class="exam__piece-chev" [class.is-open]="openPiece() === p.idPiece" aria-hidden="true">▾</span>
                        </button>
                        @if (openPiece() === p.idPiece) {
                          <div class="exam__piece-view" [id]="'piece-vue-' + p.idPiece">
                            @if (loadingPiece() === p.idPiece) { <p class="cnm-muted exam__piece-loading" role="status">Chargement de l'aperçu…</p> }
                            @else if (openUrl(); as u) { <iframe [src]="u" class="exam__piece-frame" title="Aperçu de la pièce"></iframe> }
                          </div>
                        }
                      }
                    </div>
                  }
                  @if (piecesApresRenvoi().length) {
                    <div class="exam__pieces-grp">
                      <span class="exam__pieces-pill exam__pieces-pill--lr">Après lettre de renvoi · {{ piecesApresRenvoi().length }}</span>
                      @for (p of piecesApresRenvoi(); track p.idPiece; let i = $index) {
                        <button
                          type="button"
                          class="exam__piece exam__piece--{{ etatPiece(p) }}"
                          [class.is-open]="openPiece() === p.idPiece"
                          [attr.aria-expanded]="openPiece() === p.idPiece"
                          [attr.aria-controls]="'piece-vue-' + p.idPiece"
                          (click)="togglePiece(p)"
                        >
                          <span class="exam__piece-etat exam__piece-etat--{{ etatPiece(p) }}" aria-hidden="true">{{ marqueurPiece(p) }}</span>
                          <span class="exam__piece-idx exam__piece-idx--lr">{{ i + 1 }}</span>
                          <span class="exam__piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                          @if (p.format) { <span class="badge exam__piece-fmt">{{ p.format }}</span> }
                          <span class="exam__piece-chev" [class.is-open]="openPiece() === p.idPiece" aria-hidden="true">▾</span>
                        </button>
                        @if (openPiece() === p.idPiece) {
                          <div class="exam__piece-view" [id]="'piece-vue-' + p.idPiece">
                            @if (loadingPiece() === p.idPiece) { <p class="cnm-muted exam__piece-loading" role="status">Chargement de l'aperçu…</p> }
                            @else if (openUrl(); as u) { <iframe [src]="u" class="exam__piece-frame" title="Aperçu de la pièce"></iframe> }
                          </div>
                        }
                      }
                    </div>
                  }
                  @if (!pieces().length) { <p class="cnm-muted">Aucune pièce jointe.</p> }
                }
              </div>
            </div>
          </div>

          <div class="card exam__panel">
            <div class="card-header"><span class="card-title">Consigner l'examen</span></div>
            <div class="card-body cnm-form">
              @if (mode() === 'locked') {
                <p class="form-hint">Examen verrouillé (PV signé / dossier clôturé) — lecture seule.</p>
              }
              @if (idDispatch() == null) {
                <p class="form-hint">Aucun dispatch trouvé pour ce dossier : examen impossible.</p>
              }

              <label class="form-group">
                <span class="form-label">Date d'examen</span>
                <input class="form-control" type="date" [value]="dateExamen()" (input)="dateExamen.set($any($event.target).value)" />
              </label>

              @if (!points().length) {
                <p class="text-muted">Aucun point de contrôle défini pour ce type de dossier.</p>
              } @else {
                <!-- Fil d'étapes : un marché après l'autre, puis chaque PIÈCE JOINTE une par une, puis dossier, puis avis. -->
                <div class="exam__steps">
                  @for (m of marches(); track m.idDetail; let i = $index) {
                    <button type="button" class="exam__step exam__step--{{ etatOngletMarche(i) }}" (click)="allerEtape(i)">
                      <span class="exam__step-dot"></span>Ligne {{ i + 1 }}
                    </button>
                  }
                  @for (p of piecesOrdonnees(); track p.idPiece; let i = $index) {
                    <button type="button" class="exam__step exam__step--{{ etatOngletPiece(i) }}" (click)="allerEtape(nbLignes() + i)">
                      <span class="exam__step-dot"></span>Pièce {{ i + 1 }}
                    </button>
                  }
                  @if (hasEtapeDossier()) {
                    <button type="button" class="exam__step exam__step--{{ etatOngletDossier() }}" (click)="allerEtape(etapeDossierIdx())">
                      <span class="exam__step-dot"></span>Dossier
                    </button>
                  }
                  <button type="button" class="exam__step" [class.exam__step--current]="estEtapeAvis()"
                    [disabled]="!toutTraite()" (click)="allerEtape(etapeAvis())">
                    <span class="exam__step-dot"></span>Synthèse
                  </button>
                </div>
                @if (mode() === 'create') {
                  <p class="form-hint">💾 Progression enregistrée automatiquement à chaque validation — vous pouvez quitter et reprendre plus tard, l'examen n'est transmis qu'à la soumission.</p>
                }

                @if (estEtapeMarche()) {
                  <h3 class="exam__sub">Ligne {{ etape() + 1 }} / {{ nbLignes() }} — grille de contrôle</h3>
                  @if (marcheCourant(); as m) { <p class="exam__point-desc cnm-muted">{{ m.designationMarche || ('Ligne #' + m.idDetail) }}</p> }
                } @else if (estEtapePiece()) {
                  <h3 class="exam__sub">Pièce {{ indexPieceCourante() + 1 }} / {{ nbPieces() }} — grille de contrôle</h3>
                  @if (pieceCourante(); as p) {
                    <p class="exam__point-desc cnm-muted">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }} — cliquez la pièce dans la liste de gauche pour l'aperçu.</p>
                  }
                } @else if (estEtapeDossier()) {
                  <h3 class="exam__sub">Contrôles au niveau du dossier</h3>
                  <p class="exam__point-desc cnm-muted">Points inter-lignes (ex. fractionnement, cohérence) — évalués une fois pour le dossier.</p>
                }

                @if (!estEtapeAvis()) {
                  <!-- Étape pièce : un seul contrôle RAS / Observation (texte libre), mêmes codes visuels que les points. -->
                  @if (estEtapePiece()) {
                    @if (pieceCourante(); as pc) {
                      <div class="exam__point exam__point--{{ statutClasse(resultatPiece(pc.idPiece).statut) }}">
                        <div class="exam__point-head">
                          <span class="exam__point-lbl">{{ pc.libellePiece || pc.nomFichier || ('Pièce #' + pc.idPiece) }} *</span>
                          <div class="exam__statut" role="radiogroup">
                            <label class="exam__statut-opt exam__statut-opt--ras" [class.is-active]="resultatPiece(pc.idPiece).statut === 'RAS'">
                              <input type="radio" [name]="'piece-' + pc.idPiece"
                                [checked]="resultatPiece(pc.idPiece).statut === 'RAS'" [disabled]="mode() === 'locked'"
                                (change)="setStatutPiece(pc.idPiece, 'RAS')" />
                              RAS
                            </label>
                            <label class="exam__statut-opt exam__statut-opt--obs" [class.is-active]="resultatPiece(pc.idPiece).statut === 'OBS'">
                              <input type="radio" [name]="'piece-' + pc.idPiece"
                                [checked]="resultatPiece(pc.idPiece).statut === 'OBS'" [disabled]="mode() === 'locked'"
                                (change)="setStatutPiece(pc.idPiece, 'OBS')" />
                              Observation
                            </label>
                          </div>
                        </div>
                        @if (resultatPiece(pc.idPiece).statut === 'OBS') {
                          <div class="exam__obs">
                            <textarea class="form-control" rows="3" placeholder="Observation sur la pièce…"
                              [value]="resultatPiece(pc.idPiece).observation" [disabled]="mode() === 'locked'"
                              (input)="setObservationPiece(pc.idPiece, $any($event.target).value)"></textarea>
                            @if (pieceErreur()) { <span class="form-error exam__obs-err">{{ pieceErreur() }}</span> }
                          </div>
                        }
                      </div>
                    }
                  }
                  @for (p of pointsCourants(); track p.idPointCtrl) {
                    <div class="exam__point exam__point--{{ statutClasse(resultat(idDetailCourant(), p.idPointCtrl).statut) }}">
                      <div class="exam__point-head">
                        <span class="exam__point-lbl">{{ p.libelPointCtrl || ('Point #' + p.idPointCtrl) }}{{ p.obligatoire ? ' *' : '' }}</span>
                        <div class="exam__statut" role="radiogroup">
                          <label class="exam__statut-opt exam__statut-opt--ras" [class.is-active]="resultat(idDetailCourant(), p.idPointCtrl).statut === 'RAS'">
                            <input type="radio" [name]="'st-' + idDetailCourant() + '-' + p.idPointCtrl"
                              [checked]="resultat(idDetailCourant(), p.idPointCtrl).statut === 'RAS'" [disabled]="mode() === 'locked'"
                              (change)="setStatut(idDetailCourant(), p.idPointCtrl, 'RAS')" />
                            RAS
                          </label>
                          <label class="exam__statut-opt exam__statut-opt--obs" [class.is-active]="resultat(idDetailCourant(), p.idPointCtrl).statut === 'OBS'">
                            <input type="radio" [name]="'st-' + idDetailCourant() + '-' + p.idPointCtrl"
                              [checked]="resultat(idDetailCourant(), p.idPointCtrl).statut === 'OBS'" [disabled]="mode() === 'locked'"
                              (change)="setStatut(idDetailCourant(), p.idPointCtrl, 'OBS')" />
                            Observation
                          </label>
                        </div>
                      </div>
                      @if (p.decriptPointCtrl) { <p class="exam__point-desc cnm-muted">{{ p.decriptPointCtrl }}</p> }
                      @if (resultat(idDetailCourant(), p.idPointCtrl).statut === 'OBS') {
                        <div class="exam__obs">
                          <div class="exam__obs-header"><span>AU LIEU DE</span><span>LIRE</span><span class="exam__obs-actions"></span></div>
                          @for (o of resultat(idDetailCourant(), p.idPointCtrl).observations; track $index) {
                            <div class="exam__obs-row">
                              <textarea class="form-control" rows="2" placeholder="Au lieu de…" [value]="o.auLieuDe" (input)="setAuLieuDe(idDetailCourant(), p.idPointCtrl, $index, $any($event.target).value)"></textarea>
                              <textarea class="form-control" rows="2" placeholder="Lire…" [value]="o.lire" (input)="setLire(idDetailCourant(), p.idPointCtrl, $index, $any($event.target).value)"></textarea>
                              <button type="button" class="btn btn-secondary btn-sm exam__obs-del" (click)="retirerLigne(idDetailCourant(), p.idPointCtrl, $index)" aria-label="Retirer">✕</button>
                            </div>
                          } @empty { <p class="text-muted">Aucune ligne.</p> }
                          <button type="button" class="btn btn-secondary btn-sm exam__obs-add" (click)="ajouterLigne(idDetailCourant(), p.idPointCtrl)">+ Ajouter une ligne</button>
                          @if (pointErreur(p.idPointCtrl)) { <span class="form-error exam__obs-err">{{ pointErreur(p.idPointCtrl) }}</span> }
                        </div>
                      }
                    </div>
                  }
                  <div class="exam__foot">
                    @if (etape() > 0) { <button type="button" class="btn btn-outline" (click)="allerEtape(etape() - 1)">Précédent</button> }
                    <button type="button" class="btn btn-primary" [disabled]="mode() === 'locked' || !etapeCouranteStatuee()" (click)="validerEtape()">
                      {{ estEtapeDossier() ? 'Valider les contrôles dossier' : estEtapePiece() ? 'Valider la pièce et continuer' : 'Valider la ligne et continuer' }}
                    </button>
                  </div>
                }

                @if (estEtapeAvis()) {
                  @if (syntheseEditable()) {
                    <h3 class="exam__sub">Synthèse des observations (projet de PV)</h3>
                    <p class="form-hint">Tous les points de contrôle ont été traités. Le projet de PV = résultats des points de contrôle + votre synthèse.</p>
                    <label class="form-group">
                      <span class="form-label">Synthèse des observations</span>
                      <textarea class="form-control" rows="4" [value]="synthese()" (input)="synthese.set($any($event.target).value)"></textarea>
                    </label>
                    <p class="form-hint">L'avis global et le Secrétaire de séance seront renseignés par le Président ou le Chef de Commission à la clôture de la navette du projet de PV.</p>
                  } @else if (mode() === 'edit') {
                    <h3 class="exam__sub">Synthèse des observations (projet de PV)</h3>
                    @if (avis()) { <p class="form-hint"><strong>Avis global (clôture de navette) :</strong> {{ avisLabel(avis()) }}</p> }
                    @if (synthese()) { <p class="form-hint"><strong>Synthèse :</strong> {{ synthese() }}</p> }
                    <p class="form-hint">Le projet de PV a déjà été soumis : la suite se joue dans « Projets de PV ».</p>
                  }
                  @if (formError()) { <span class="form-error">{{ formError() }}</span> }
                  <div class="exam__foot">
                    <button type="button" class="btn btn-outline" (click)="allerEtape(etape() - 1)">Précédent</button>
                    <button type="button" class="btn btn-outline" (click)="annuler()">Annuler</button>
                    @if (mode() === 'create') {
                      <button type="button" class="btn btn-primary" [disabled]="saving() || idDispatch() == null" (click)="soumettre()">{{ saving() ? 'Enregistrement…' : "Soumettre l'examen" }}</button>
                    } @else if (mode() === 'edit') {
                      <button type="button" class="btn btn-primary" [disabled]="saving() || idDispatch() == null" (click)="enregistrer()">{{ saving() ? 'Enregistrement…' : estReexamen() ? 'Enregistrer le réexamen' : "Modifier l'examen" }}</button>
                    }
                  </div>
                }
              }
            </div>
          </div>
        </div>
      }

    </section>
  `,
  styles: `
    /* Colonne gauche (contenu du dossier + tableau dense des marchés) plus large que la grille de
       contrôle : le tableau tient sans scroll horizontal, le formulaire de droite (champs courts)
       reste confortable. minmax(0, ...) empêche le tableau de forcer la colonne au-delà de sa part. */
    .exam__grid { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 3fr); gap: 0.75rem; align-items: start; }
    /* Sous ~1200px, on empile (côte à côte devient illisible). */
    @media (max-width: 75rem) { .exam__grid { grid-template-columns: 1fr; } }
    .exam__sub { margin: 0.5rem 0 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    /* Fil d'étapes séquentielles (une ligne à la fois → dossier → avis). */
    .exam__steps { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.25rem 0 0.75rem; }
    .exam__step { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.75rem; border: 1px solid #E5E7EB; border-radius: 999px; background: #fff; color: var(--n-600, #475569); font-size: var(--text-sm); font-weight: 600; cursor: pointer; transition: var(--transition); }
    .exam__step:disabled { opacity: 0.5; cursor: not-allowed; }
    .exam__step-dot { width: 0.55rem; height: 0.55rem; border-radius: 999px; background: #D1D5DB; flex: none; }
    /* Pastilles alignées sur la palette sobre des lignes du tableau (indigo / vert / ambre). */
    .exam__step--pending { background: #F9FAFB; }
    .exam__step--pending .exam__step-dot { background: #D1D5DB; }
    .exam__step--current { background: #EEF2FF; color: #4338CA; border-color: #6366F1; }
    .exam__step--current .exam__step-dot { background: #6366F1; }
    .exam__step--done-ras { background: #F0FDF4; color: #15803D; border-color: #22C55E; }
    .exam__step--done-ras .exam__step-dot { background: #22C55E; }
    /* Avec observation = ROUGE (aligné sur le tableau des lignes et la liste des pièces : ✗ rouge). */
    .exam__step--done-obs { background: #FEF2F2; color: #B91C1C; border-color: #DC2626; }
    .exam__step--done-obs .exam__step-dot { background: #DC2626; }
    .exam__info { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0; }
    .exam__info dt { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .08em; color: var(--n-400); }
    .exam__info dd { margin: 2px 0 0; }
    .exam__marches { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1.25rem; }
    /* Pièces jointes du dossier (liste + téléchargement) sous les lignes de marché. */
    .exam__pieces { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem; }
    .exam__pieces-grp { display: flex; flex-direction: column; gap: 0.35rem; }
    .exam__pieces-pill { align-self: flex-start; font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--info-text, #2563eb); background: var(--info-bg, #eff6ff); padding: 0.15rem 0.5rem; border-radius: 999px; }
    .exam__pieces-pill--lr { color: #B45309; background: #FFFBEB; }
    /* États d'examen des pièces — mêmes couleurs que le tableau des lignes (en cours indigo / ✓ vert / ✗ rouge). */
    .exam__piece--current { background: #E0E7FF; box-shadow: inset 5px 0 0 #4F46E5; }
    .exam__piece--done-ras { background: #F0FDF4; box-shadow: inset 3px 0 0 #22C55E; }
    .exam__piece--done-obs { background: #FEF2F2; box-shadow: inset 3px 0 0 #DC2626; }
    .exam__piece-etat { flex: 0 0 auto; width: 1.1rem; text-align: center; font-weight: 800; font-size: 1rem; }
    .exam__piece-etat--done-ras { color: #16A34A; }
    .exam__piece-etat--done-obs { color: #DC2626; }
    .exam__piece-etat--current { color: #4F46E5; }
    .exam__piece-etat--pending { color: var(--n-400); }
    /* <button> : neutraliser les styles natifs (largeur, police, alignement) pour conserver
       exactement le rendu de l'ancienne ligne, tout en gagnant le clavier et le focus. */
    .exam__piece { display: flex; width: 100%; text-align: left; font: inherit; color: inherit; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; background: #fff; border: 1px solid var(--c-100); border-radius: var(--radius-md); cursor: pointer; transition: var(--transition); }
    .exam__piece:hover { border-color: var(--c-200, #c7d2fe); background: var(--c-50); }
    .exam__piece.is-open { border-color: var(--info-text, #2563eb); background: var(--info-bg, #eff6ff); }
    .exam__piece-idx { flex: none; width: 1.4rem; height: 1.4rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: var(--info-bg, #eff6ff); color: var(--info-text, #2563eb); font-size: var(--text-xs); font-weight: 700; }
    .exam__piece-idx--lr { background: #FFFBEB; color: #B45309; }
    .exam__piece-name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
    .exam__piece-fmt { flex: none; font-size: 0.6rem; }
    .exam__piece-chev { flex: none; color: var(--n-400); transition: transform 0.15s; }
    .exam__piece-chev.is-open { transform: rotate(180deg); }
    .exam__piece-view { border: 1px solid var(--c-100); border-radius: var(--radius-md); overflow: hidden; }
    .exam__piece-frame { width: 100%; height: 600px; border: 0; display: block; background: #fff; }
    .exam__piece-loading { padding: 1rem; margin: 0; }
    .exam__point { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; background: var(--c-50); border: 1px solid var(--c-100); border-left: 3px solid #D1D5DB; border-radius: var(--radius-md); transition: var(--transition); }
    .exam__point--ras { background: #F0FDF4; border-color: #DCFCE7; border-left-color: #22C55E; }
    .exam__point--obs { background: #FFFBEB; border-color: #FEF3C7; border-left-color: #F59E0B; }
    .exam__point-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .exam__point-lbl { font-weight: 500; }
    .exam__point-desc { font-size: var(--text-sm); margin: 0; }
    /* Choix mutuellement exclusif RAS / Observation (aucun par défaut ⇒ point non statué). */
    .exam__statut { display: inline-flex; gap: 0.35rem; flex: none; }
    .exam__statut-opt { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.6rem; border: 1px solid #E5E7EB; border-radius: 999px; background: #fff; font-size: var(--text-sm); font-weight: 600; color: var(--n-500); cursor: pointer; white-space: nowrap; transition: var(--transition); }
    .exam__statut-opt input { margin: 0; }
    .exam__statut-opt--ras.is-active { background: #F0FDF4; color: #15803D; border-color: #22C55E; }
    .exam__statut-opt--obs.is-active { background: #FFFBEB; color: #B45309; border-color: #F59E0B; }
    .exam__obs { display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start; }
    .exam__obs-header, .exam__obs-row { display: flex; gap: 0.75rem; align-items: flex-start; align-self: stretch; }
    .exam__obs-header span:first-child, .exam__obs-header span:nth-child(2) { flex: 1 1 0; text-align: center; font-weight: 700; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-400); }
    .exam__obs-actions { width: 2rem; }
    .exam__obs-row textarea { flex: 1 1 0; min-height: 2.5rem; resize: none; word-wrap: break-word; white-space: pre-wrap; }
    .exam__obs-del { width: 2rem; align-self: flex-start; margin-top: 0.3rem; }
    .exam__obs-err { color: var(--danger-text); }
    /* flex-wrap : la barre d'actions se replie si le panneau (droite, 30%) est trop étroit pour les 3 boutons. */
    .exam__foot { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.5rem; border-top: 1px solid var(--c-100); padding-top: 0.75rem; margin-top: 0.5rem; }
    @media (max-width: 60rem) { .exam__grid { grid-template-columns: 1fr; } }
  `,
})
export class ExamenDossier implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
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

  readonly idDossier = Number(this.route.snapshot.paramMap.get('idDossier'));
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly dossier = signal<Dossier | null>(null);
  readonly ppm = signal<Ppm | null>(null);
  /** Versionnement : idDetail → type de changement vs la version précédente (surlignage du tableau). */
  readonly changements = signal<Map<number, TypeChangementLigne> | null>(null);
  readonly marches = signal<Marche[]>([]);
  /** Bénéficiaires + dates prévisionnelles des marchés du dossier (pour le tableau PPM partagé). */
  readonly serviceBenefs = signal<ServiceBeneficiaire[]>([]);
  readonly previsions = signal<MarchePrevision[]>([]);
  /** Pièces jointes réellement déposées sur le dossier (lecture + téléchargement). */
  readonly pieces = signal<PieceJointeDossier[]>([]);
  readonly loadingPieces = signal(false);
  readonly piecesInitiales = computed(() => this.pieces().filter((p) => !p.apresLettreRenvoi));
  readonly piecesApresRenvoi = computed(() => this.pieces().filter((p) => p.apresLettreRenvoi));
  /** Aperçu inline : pièce ouverte (idPiece), son URL blob sécurisée, et le chargement éventuel. */
  readonly openPiece = signal<number | null>(null);
  readonly openUrl = signal<SafeResourceUrl | null>(null);
  readonly loadingPiece = signal<number | null>(null);
  private currentObjectUrl: string | null = null;
  readonly idDispatch = signal<number | null>(null);
  readonly points = signal<PointsCtrl[]>([]);
  readonly aviss = signal<Avis[]>([]);
  private readonly examens = signal<Examen[]>([]);
  private readonly details = signal<ExamenDetail[]>([]);
  private readonly pvs = signal<PvExamen[]>([]);

  readonly dateExamen = signal(new Date().toISOString().slice(0, 10));
  /** Avis global du PV — LECTURE SEULE ici (posé à la clôture de navette par le Président/CC). */
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
  private readonly resultatsPieces = signal<Map<number, { statut: 'RAS' | 'OBS' | null; observation: string }>>(new Map());
  /** Résultats de pièces persistés (`/api/examen-pieces`) — réconciliation en mode édition + PK max+1. */
  private readonly examenPieces = signal<ExamenPiece[]>([]);
  /** Erreur de l'étape pièce courante (observation manquante). */
  readonly pieceErreur = signal<string | null>(null);

  // — Workflow séquentiel : une ligne active à la fois, de haut en bas, puis étape dossier, puis avis. —
  /** Étape courante : 0..N-1 = marchés ; N = points DOSSIER (si présents) ; dernière = avis global. */
  readonly etape = signal(0);

  /** Points de portée LIGNE (évalués par marché) — défaut LIGNE si portée absente. */
  readonly pointsLigne = computed(() => this.points().filter((p) => (p.portee ?? 'LIGNE') === 'LIGNE'));
  /** Points de portée DOSSIER (inter-lignes, évalués une fois). */
  readonly pointsDossier = computed(() => this.points().filter((p) => p.portee === 'DOSSIER'));
  readonly nbLignes = computed(() => this.marches().length);
  readonly hasEtapeDossier = computed(() => this.pointsDossier().length > 0);
  /** Pièces dans l'ordre des étapes « Pièce N » (initiales puis après renvoi — même ordre que la liste). */
  readonly piecesOrdonnees = computed(() => [...this.piecesInitiales(), ...this.piecesApresRenvoi()].filter((p) => p.idPiece != null));
  readonly nbPieces = computed(() => this.piecesOrdonnees().length);
  /** Index de l'étape « contrôles dossier » (après les marchés + les pièces). */
  readonly etapeDossierIdx = computed(() => this.nbLignes() + this.nbPieces());
  /** Index de l'étape « avis global » (après les marchés + les pièces + l'éventuelle étape dossier). */
  readonly etapeAvis = computed(() => this.nbLignes() + this.nbPieces() + (this.hasEtapeDossier() ? 1 : 0));
  readonly estEtapeMarche = computed(() => this.etape() < this.nbLignes());
  /** ⚠️ Règle ajoutée — étapes « Pièce N » : chaque pièce jointe est examinée une par une. */
  readonly estEtapePiece = computed(() => this.etape() >= this.nbLignes() && this.etape() < this.etapeDossierIdx());
  readonly estEtapeDossier = computed(() => this.hasEtapeDossier() && this.etape() === this.etapeDossierIdx());
  readonly estEtapeAvis = computed(() => this.etape() >= this.etapeAvis());
  readonly indexPieceCourante = computed(() => (this.estEtapePiece() ? this.etape() - this.nbLignes() : -1));
  readonly pieceCourante = computed(() => (this.estEtapePiece() ? this.piecesOrdonnees()[this.indexPieceCourante()] ?? null : null));
  /** Marché de l'étape courante (null hors étape marché). */
  readonly marcheCourant = computed(() => (this.estEtapeMarche() ? this.marches()[this.etape()] ?? null : null));
  /** idDetail associé à l'étape courante (null pour l'étape dossier). */
  readonly idDetailCourant = computed(() => this.marcheCourant()?.idDetail ?? null);
  /** Points affichés à l'étape courante : LIGNE (marché) ou DOSSIER, sinon aucun (avis). */
  readonly pointsCourants = computed(() =>
    this.estEtapeMarche() ? this.pointsLigne() : this.estEtapeDossier() ? this.pointsDossier() : [],
  );

  // — États DÉRIVÉS des statuts (pas d'état manuel « validé ») : un point/une ligne est « examiné » dès qu'il est statué. —
  /** Tous les points LIGNE d'un marché sont-ils statués (RAS ou OBS) ? */
  ligneStatuee(idDetail: number): boolean {
    return this.pointsLigne().every((p) => this.resultat(idDetail, p.idPointCtrl).statut !== null);
  }
  /** Le marché porte-t-il ≥1 observation (→ « examinée avec observation ») ? */
  ligneAObs(idDetail: number): boolean {
    return this.pointsLigne().some((p) => this.resultat(idDetail, p.idPointCtrl).statut === 'OBS');
  }
  /** Tous les points DOSSIER sont-ils statués ? */
  readonly dossierStatue = computed(() => this.pointsDossier().every((p) => this.resultat(null, p.idPointCtrl).statut !== null));
  readonly dossierAObs = computed(() => this.pointsDossier().some((p) => this.resultat(null, p.idPointCtrl).statut === 'OBS'));
  /** Première étape marché non encore statuée (frontière atteignable) ; `nbLignes` si toutes faites. */
  readonly frontiere = computed(() => {
    const idx = this.marches().findIndex((m) => !this.ligneStatuee(m.idDetail));
    return idx === -1 ? this.nbLignes() : idx;
  });
  /** Première pièce non statuée (frontière des étapes pièces) ; `nbPieces` si toutes examinées. */
  readonly frontierePiece = computed(() => {
    const idx = this.piecesOrdonnees().findIndex((p) => !this.pieceStatuee(p.idPiece));
    return idx === -1 ? this.nbPieces() : idx;
  });
  readonly toutesPiecesStatuees = computed(() => this.piecesOrdonnees().every((p) => this.pieceStatuee(p.idPiece)));
  /** Tous les points de l'étape courante sont-ils statués (→ « Valider » activable) ? */
  readonly etapeCouranteStatuee = computed(() =>
    this.estEtapeMarche()
      ? this.idDetailCourant() != null && this.ligneStatuee(this.idDetailCourant() as number)
      : this.estEtapePiece()
        ? this.pieceStatuee(this.pieceCourante()?.idPiece)
        : this.estEtapeDossier()
          ? this.dossierStatue()
          : true,
  );
  /** Lignes + pièces + étape dossier toutes traitées ? (condition d'ouverture de l'avis). */
  readonly toutTraite = computed(
    () =>
      this.marches().every((m) => this.ligneStatuee(m.idDetail)) &&
      this.toutesPiecesStatuees() &&
      (!this.hasEtapeDossier() || this.dossierStatue()),
  );

  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly modeMap = signal<Map<string, string>>(new Map());

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

  constructor() {
    // Brouillon serveur : les sauvegardes de progression s'exécutent une par une (concatMap) ;
    // une erreur n'interrompt pas la file (toast centralisé, la prochaine validation resauvegarde tout).
    this.saveTrigger
      .pipe(
        concatMap(() => this.sauvegarderProgression().pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe();
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.avisService.list().subscribe((a) => this.aviss.set(a));

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
      benefs: this.serviceBenefService.list(),
      previsions: this.previsionService.list(),
    }).subscribe({
      next: (r) => {
        this.dossier.set(r.dossier);
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
        this.idDispatch.set(r.dispatchs.find((d) => recIds.has(d.idReception))?.idDispatch ?? null);
        const pts = r.points
          .filter((p) => p.idTypeDossier === r.dossier.idTypeDossier) // no-op sur la grille serveur ; filtre famille en repli
          .sort((a, b) => (a.ordrePointCtrl ?? 0) - (b.ordrePointCtrl ?? 0));
        this.points.set(pts);
        // Init des résultats : chaque point LIGNE × chaque marché, + chaque point DOSSIER (clé « D »). NON statué par défaut.
        const ligne = pts.filter((p) => (p.portee ?? 'LIGNE') === 'LIGNE');
        const dossierPts = pts.filter((p) => p.portee === 'DOSSIER');
        const map = new Map<string, RowState>();
        for (const m of mines) for (const p of ligne) map.set(this.cle(m.idDetail, p.idPointCtrl), { statut: null, observations: [] });
        for (const p of dossierPts) map.set(this.cle(null, p.idPointCtrl), { statut: null, observations: [] });
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
          for (const det of r.details.filter((d) => d.idExamen === ex.idExamen)) {
            map.set(this.cle(det.idDetail ?? null, det.idPtControle), {
              statut: det.conforme ? 'RAS' : 'OBS',
              observations: (det.observations ?? []).map((o) => ({ auLieuDe: o.auLieuDe ?? '', lire: o.lire ?? '' })),
            });
          }
          // Résultats des PIÈCES de l'examen existant (⚠️ règle ajoutée : examen pièce par pièce).
          const mapPieces = new Map<number, { statut: 'RAS' | 'OBS' | null; observation: string }>();
          for (const ep of r.examenPieces.filter((x) => x.idExamen === ex.idExamen)) {
            mapPieces.set(ep.idPiece, { statut: ep.conforme ? 'RAS' : 'OBS', observation: ep.observation ?? '' });
          }
          this.resultatsPieces.set(mapPieces);
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
    this.patchResultat(idDetail, idPt, { observations: this.resultat(idDetail, idPt).observations.map((o, idx) => (idx === i ? { ...o, auLieuDe: v } : o)) });
  }
  setLire(idDetail: number | null, idPt: number, i: number, v: string): void {
    this.patchResultat(idDetail, idPt, { observations: this.resultat(idDetail, idPt).observations.map((o, idx) => (idx === i ? { ...o, lire: v } : o)) });
  }
  pointErreur(id: number): string | undefined {
    return this.pointErreurs().get(id);
  }

  // — Examen des pièces jointes, une par une (⚠️ règle ajoutée) —
  resultatPiece(idPiece: number | undefined): { statut: 'RAS' | 'OBS' | null; observation: string } {
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
  /** État visuel d'une pièce (liste de gauche + onglet) — mêmes états/couleurs que le tableau des lignes. */
  etatPiece(p: PieceJointeDossier): 'current' | 'done-ras' | 'done-obs' | 'pending' {
    if (this.pieceCourante()?.idPiece === p.idPiece) return 'current';
    if (this.pieceStatuee(p.idPiece)) return this.pieceAObs(p.idPiece) ? 'done-obs' : 'done-ras';
    return 'pending';
  }
  /** Marqueur de la liste des pièces : ✓ (RAS) / ✗ (observation) / ● (en cours) / • (à examiner). */
  marqueurPiece(p: PieceJointeDossier): string {
    const e = this.etatPiece(p);
    return e === 'done-ras' ? '✓' : e === 'done-obs' ? '✗' : e === 'current' ? '●' : '•';
  }
  /** État d'un onglet « Pièce N » (pastille de progression). */
  etatOngletPiece(i: number): 'current' | 'done-ras' | 'done-obs' | 'pending' {
    if (this.etape() === this.nbLignes() + i) return 'current';
    const p = this.piecesOrdonnees()[i];
    if (p && this.pieceStatuee(p.idPiece)) return this.pieceAObs(p.idPiece) ? 'done-obs' : 'done-ras';
    return 'pending';
  }

  /** État visuel d'une ligne de marché (pour la table partagée) : traitée / en cours / à venir. */
  readonly etatLigneFn = (idDetail: number): 'current' | 'done-ras' | 'done-obs' | 'pending' => {
    if (this.idDetailCourant() === idDetail) return 'current';
    if (this.ligneStatuee(idDetail)) return this.ligneAObs(idDetail) ? 'done-obs' : 'done-ras';
    return 'pending';
  };
  /** État d'un onglet marché (pour la pastille de progression). */
  etatOngletMarche(i: number): 'current' | 'done-ras' | 'done-obs' | 'pending' {
    if (this.etape() === i) return 'current';
    const idDetail = this.marches()[i]?.idDetail;
    if (idDetail != null && this.ligneStatuee(idDetail)) return this.ligneAObs(idDetail) ? 'done-obs' : 'done-ras';
    return 'pending';
  }
  /** État de l'onglet dossier. */
  etatOngletDossier(): 'current' | 'done-ras' | 'done-obs' | 'pending' {
    if (this.estEtapeDossier()) return 'current';
    if (this.dossierStatue()) return this.dossierAObs() ? 'done-obs' : 'done-ras';
    return 'pending';
  }
  /** Classe visuelle d'un point selon son statut (bordure gauche colorée). */
  statutClasse(statut: StatutPoint): 'ras' | 'obs' | 'vide' {
    return statut === 'RAS' ? 'ras' : statut === 'OBS' ? 'obs' : 'vide';
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
    // Avance vers l'étape suivante (marché suivant → pièces → dossier → synthèse). L'état « traité » est dérivé des statuts.
    this.etape.update((e) => Math.min(e + 1, this.etapeAvis()));
    this.declencherSauvegarde(); // brouillon serveur : la progression survit à un départ de la page
  }
  /** Navigation : lignes jusqu'à leur frontière, puis pièces jusqu'à la leur, puis dossier/avis si atteints. */
  allerEtape(i: number): void {
    const lignesFaites = this.frontiere() === this.nbLignes();
    const atteignable =
      (i < this.nbLignes() && i <= this.frontiere()) ||
      (i >= this.nbLignes() && i < this.etapeDossierIdx() && lignesFaites && i - this.nbLignes() <= this.frontierePiece()) ||
      (this.hasEtapeDossier() && i === this.etapeDossierIdx() && lignesFaites && this.toutesPiecesStatuees()) ||
      (i === this.etapeAvis() && this.toutTraite());
    if (atteignable) this.etape.set(i);
  }
  /** Rouvre la ligne cliquée dans le tableau (repasse « en cours » ; son état RAS/observation est recalculé après re-validation). */
  ouvrirLigne(m: Marche): void {
    const i = this.marches().findIndex((x) => x.idDetail === m.idDetail);
    if (i >= 0) this.allerEtape(i);
  }
  /** Ouvre/ferme l'aperçu inline d'une pièce sous son nom (une seule à la fois). */
  togglePiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) return;
    if (this.openPiece() === p.idPiece) {
      this.fermerPiece();
      return;
    }
    this.revoquer();
    this.openUrl.set(null);
    this.openPiece.set(p.idPiece);
    this.loadingPiece.set(p.idPiece);
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (blob) => {
        this.currentObjectUrl = urlBlobSure(blob);
        this.openUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.currentObjectUrl));
        this.loadingPiece.set(null);
      },
      error: () => {
        this.loadingPiece.set(null);
        this.openPiece.set(null);
        this.toast.error("Impossible d'ouvrir la pièce.");
      },
    });
  }
  private fermerPiece(): void {
    this.revoquer();
    this.openPiece.set(null);
    this.openUrl.set(null);
    this.loadingPiece.set(null);
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
  /** Liste plate des résultats à persister : (marché × point LIGNE) + (point DOSSIER, `idDetail` null). */
  private entreesResultats(): { idDetail: number | null; idPt: number; st: RowState }[] {
    const out: { idDetail: number | null; idPt: number; st: RowState }[] = [];
    for (const m of this.marches())
      for (const p of this.pointsLigne())
        out.push({ idDetail: m.idDetail, idPt: p.idPointCtrl, st: this.resultat(m.idDetail, p.idPointCtrl) });
    for (const p of this.pointsDossier()) out.push({ idDetail: null, idPt: p.idPointCtrl, st: this.resultat(null, p.idPointCtrl) });
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
  /** Observations à envoyer pour un point (vide sauf statut OBS ; ordre 1-based). */
  private observationsBody(st: RowState): ObservationControle[] {
    if (st.statut !== 'OBS') {
      return [];
    }
    return st.observations
      .filter((o) => o.auLieuDe.trim() || o.lire.trim())
      .map((o, i) => ({ auLieuDe: o.auLieuDe.trim() || undefined, lire: o.lire.trim() || undefined, ordre: i + 1 }));
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

  annuler(): void {
    void this.router.navigate(['/membre/tableau-de-bord']);
  }

  /** Mode édition (dossier EXAMINE) : met à jour l'examen + ses détails (pas de nouveau PV/lettre). */
  enregistrer(): void {
    const idDispatch = this.idDispatch();
    if (!this.dossier() || idDispatch == null) return;
    if (!this.observationsCompletes()) return;
    this.formError.set(null);
    this.saving.set(true);
    this.modifier(idDispatch);
  }

  /**
   * Création — « Soumettre l'examen » : toutes les lignes/pièces traitées + synthèse, crée le projet
   * de PV. ⚠️ Règle modifiée (2026-08-01) — SANS avis ni secrétaire (posés à la clôture de navette).
   */
  soumettre(): void {
    if (!this.dossier() || this.idDispatch() == null) return;
    if (!this.toutTraite()) {
      this.formError.set('Traitez toutes les lignes de marché, toutes les pièces jointes (et l\'étape dossier) avant de soumettre.');
      return;
    }
    if (!this.observationsCompletes()) return;
    this.formError.set(null);
    this.saving.set(true);
    // Réconciliation FINALE (tous les résultats statués), puis soumission (corps vide : ni avis ni secrétaire).
    this.sauvegarderProgression()
      .pipe(
        switchMap((idExamen) => this.examenService.soumettre(idExamen, {})),
        // La synthèse ne fait pas partie d'ExamenSoumissionRequest : on la persiste via une MAJ du PV créé
        // (encore BROUILLON) — PUT /api/pv-examens/{id}.
        switchMap((pv) => {
          const synthese = this.synthese().trim();
          return synthese ? this.pvExamenService.update(pv.idPv, { ...pv, syntheseObservations: synthese }) : of(pv);
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success('Examen soumis · projet de PV créé (points de contrôle + synthèse).');
          void this.router.navigate(['/membre/pv']);
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

  /** Point de reprise d'un brouillon : première ligne non statuée, sinon première pièce, sinon dossier, sinon avis. */
  private calculerReprise(): number {
    if (this.frontiere() < this.nbLignes()) return this.frontiere();
    if (this.frontierePiece() < this.nbPieces()) return this.nbLignes() + this.frontierePiece();
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
        // pour persister la synthèse. ⚠️ L'avis n'est PAS touché ici (clôture de navette, Président/CC).
        switchMap(() => {
          if (!this.pvEditable()) return of(null);
          const pv = this.existingPv();
          const synthese = this.synthese().trim() || undefined;
          if (pv) {
            return this.pvExamenService.update(pv.idPv, { ...pv, syntheseObservations: synthese });
          }
          // Aucun projet de PV (examen créé sans soumission) → le créer DIRECTEMENT
          // (POST /api/pv-examens). On n'utilise pas la façade examens/{id}/soumettre :
          // elle attend un dossier DISPATCHE et renvoie 400 sur un dossier déjà EXAMINE.
          const nouveauPv: PvExamen = {
            idPv: this.nextId(this.pvs().map((p) => p.idPv)),
            idExamen,
            imCtrlMembre: this.auth.ref() ?? '', // @NotBlank requis ; valeur ignorée (dérivée du dispatch)
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
            void this.router.navigate(['/membre/pv']);
          } else {
            this.toast.success('Examen modifié.');
            void this.router.navigate(['/membre/mes-dossiers']);
          }
        },
        error: (_e: ApiError) => this.saving.set(false), // 409 (verrouillé) / 403 → toast centralisé
      });
  }
}
