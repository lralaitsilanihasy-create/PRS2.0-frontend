import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import {
  Avis,
  Dossier,
  Examen,
  ExamenDetail,
  LettreRenvoi,
  Marche,
  MarchePrevision,
  ObservationControle,
  PieceJointeDossier,
  PointsCtrl,
  Ppm,
  PvExamen,
  ServiceBeneficiaire,
} from '../../models';
import {
  AvisService,
  DispatchService,
  DossierService,
  ExamenDetailService,
  ExamenService,
  LettreRenvoiService,
  LocaliteService,
  MarcheService,
  MarchePrevisionService,
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
import { StatutBadge } from '../../shared/circuit';
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
 * en cache) + formulaire d'examen (grille des points de contrôle, avis global, synthèse).
 *
 * Enregistrement : POST /examens → POST /examen-details ×N + POST /pv-examens (BROUILLON),
 * ce qui matérialise le « projet de PV ». Le backend reste l'autorité (409 si non DISPATCHE,
 * 403 hors localité) ; erreurs via l'intercepteur centralisé.
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
        <p class="text-muted">Chargement…</p>
      } @else if (!dossier()) {
        <p class="text-muted">Dossier introuvable ou hors de votre périmètre.</p>
      } @else {
        <div class="exam__grid">
          <div class="card exam__panel">
            <div class="card-header"><span class="card-title">Contenu du dossier</span></div>
            <div class="card-body">
              <dl class="exam__info">
                <div><dt>Type</dt><dd>{{ typeLabel() }}</dd></div>
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
                    <div><dt>Libellé</dt><dd>{{ p.libelle || '—' }}</dd></div>
                  </dl>
                }
                <div class="exam__marches">
                  <app-ppm-marches-table [marches]="marches()" [beneficiaires]="serviceBenefs()" [previsions]="previsions()" [rowStateFn]="etatLigneFn" (rowClick)="ouvrirLigne($event)" />
                </div>
              }
              <div class="exam__pieces">
                <h3 class="exam__sub">Pièces jointes</h3>
                @if (loadingPieces()) {
                  <p class="cnm-muted">Chargement des pièces…</p>
                } @else {
                  @if (piecesInitiales().length) {
                    <div class="exam__pieces-grp">
                      <span class="exam__pieces-pill">Pièces initiales · {{ piecesInitiales().length }}</span>
                      @for (p of piecesInitiales(); track p.idPiece; let i = $index) {
                        <div class="exam__piece">
                          <span class="exam__piece-idx">{{ i + 1 }}</span>
                          <span class="exam__piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                          @if (p.format) { <span class="badge exam__piece-fmt">{{ p.format }}</span> }
                          <button type="button" class="btn btn-outline btn-sm exam__piece-btn" (click)="ouvrirPiece(p)">Ouvrir ↗</button>
                        </div>
                      }
                    </div>
                  }
                  @if (piecesApresRenvoi().length) {
                    <div class="exam__pieces-grp">
                      <span class="exam__pieces-pill exam__pieces-pill--lr">Après lettre de renvoi · {{ piecesApresRenvoi().length }}</span>
                      @for (p of piecesApresRenvoi(); track p.idPiece; let i = $index) {
                        <div class="exam__piece">
                          <span class="exam__piece-idx exam__piece-idx--lr">{{ i + 1 }}</span>
                          <span class="exam__piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                          @if (p.format) { <span class="badge exam__piece-fmt">{{ p.format }}</span> }
                          <button type="button" class="btn btn-outline btn-sm exam__piece-btn" (click)="ouvrirPiece(p)">Ouvrir ↗</button>
                        </div>
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
                <!-- Fil d'étapes : un marché après l'autre (haut → bas), puis dossier (si points DOSSIER), puis avis. -->
                <div class="exam__steps">
                  @for (m of marches(); track m.idDetail; let i = $index) {
                    <button type="button" class="exam__step exam__step--{{ etatOngletMarche(i) }}" (click)="allerEtape(i)">
                      <span class="exam__step-dot"></span>Ligne {{ i + 1 }}
                    </button>
                  }
                  @if (hasEtapeDossier()) {
                    <button type="button" class="exam__step exam__step--{{ etatOngletDossier() }}" (click)="allerEtape(nbLignes())">
                      <span class="exam__step-dot"></span>Dossier
                    </button>
                  }
                  <button type="button" class="exam__step" [class.exam__step--current]="estEtapeAvis()"
                    [disabled]="!toutTraite()" (click)="allerEtape(etapeAvis())">
                    <span class="exam__step-dot"></span>Avis
                  </button>
                </div>

                @if (estEtapeMarche()) {
                  <h3 class="exam__sub">Ligne {{ etape() + 1 }} / {{ nbLignes() }} — grille de contrôle</h3>
                  @if (marcheCourant(); as m) { <p class="exam__point-desc cnm-muted">{{ m.designationMarche || ('Ligne #' + m.idDetail) }}</p> }
                } @else if (estEtapeDossier()) {
                  <h3 class="exam__sub">Contrôles au niveau du dossier</h3>
                  <p class="exam__point-desc cnm-muted">Points inter-lignes (ex. fractionnement, cohérence) — évalués une fois pour le dossier.</p>
                }

                @if (!estEtapeAvis()) {
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
                    <button type="button" class="btn btn-outline" [disabled]="saving() || idDispatch() == null" (click)="ouvrirModalLettre()">Lettre de renvoi</button>
                    <button type="button" class="btn btn-primary" [disabled]="mode() === 'locked' || !etapeCouranteStatuee()" (click)="validerEtape()">
                      {{ estEtapeDossier() ? 'Valider les contrôles dossier' : 'Valider la ligne et continuer' }}
                    </button>
                  </div>
                }

                @if (estEtapeAvis()) {
                  @if (avisEditable()) {
                    <h3 class="exam__sub">Avis & synthèse (projet de PV)</h3>
                    <p class="form-hint">Toutes les lignes ont été traitées.</p>
                    @if (avisSuggereLabel(); as s) { <p class="form-hint"><strong>Avis suggéré :</strong> {{ s }}</p> }
                    <label class="form-group">
                      <span class="form-label">Avis global *</span>
                      <select class="form-control" [value]="avis() ?? ''" (change)="avis.set($any($event.target).value || null)">
                        <option value="">— Sélectionner —</option>
                        @for (a of aviss(); track a.idAvis) { <option [value]="a.idAvis">{{ a.libelleAvis || a.idAvis }}</option> }
                      </select>
                    </label>
                    <label class="form-group">
                      <span class="form-label">Synthèse des observations</span>
                      <textarea class="form-control" rows="3" [value]="synthese()" (input)="synthese.set($any($event.target).value)"></textarea>
                    </label>
                  } @else if (mode() === 'edit') {
                    <h3 class="exam__sub">Avis & synthèse (projet de PV)</h3>
                    <p class="form-hint"><strong>Avis global :</strong> {{ avisLabel(avis()) }}</p>
                    @if (synthese()) { <p class="form-hint"><strong>Synthèse :</strong> {{ synthese() }}</p> }
                    <p class="form-hint">Le projet de PV a déjà été soumis : l'avis et la synthèse se modifient désormais dans « Projets de PV ».</p>
                  }
                  @if (formError()) { <span class="form-error">{{ formError() }}</span> }
                  <div class="exam__foot">
                    <button type="button" class="btn btn-outline" (click)="allerEtape(etape() - 1)">Précédent</button>
                    <button type="button" class="btn btn-outline" (click)="annuler()">Annuler</button>
                    <button type="button" class="btn btn-outline" [disabled]="saving() || idDispatch() == null" (click)="ouvrirModalLettre()">Lettre de renvoi</button>
                    @if (mode() === 'create') {
                      <button type="button" class="btn btn-primary" [disabled]="saving() || idDispatch() == null" (click)="soumettre()">{{ saving() ? 'Enregistrement…' : "Soumettre l'examen" }}</button>
                    } @else if (mode() === 'edit') {
                      <button type="button" class="btn btn-primary" [disabled]="saving() || idDispatch() == null" (click)="enregistrer()">{{ saving() ? 'Enregistrement…' : "Modifier l'examen" }}</button>
                    }
                  </div>
                }
              }
            </div>
          </div>
        </div>
      }

      @if (lettreModal()) {
        <div class="modal-backdrop" (click)="fermerLettre()">
          <div class="exam-modal cnm-form" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
            <h2 class="exam-modal__title">Lettre de renvoi</h2>
            <dl class="exam-modal__info">
              <div><dt>Référence dossier</dt><dd>{{ dossier()?.refeDossier || ('Dossier #' + idDossier) }}</dd></div>
              <div><dt>Date d'examen</dt><dd class="cnm-mono">{{ dateExamen() || '—' }}</dd></div>
              <div><dt>Date de la lettre</dt><dd class="cnm-mono">{{ dateLettre }}</dd></div>
            </dl>
            <label class="form-group">
              <span class="form-label">Corps de la lettre</span>
              <textarea class="form-control exam-modal__corps" rows="6" placeholder="Corps de la lettre…" [value]="corpsLettre()" (input)="corpsLettre.set($any($event.target).value)"></textarea>
            </label>
            <div class="exam-modal__foot">
              <button type="button" class="btn btn-outline" [disabled]="saving()" (click)="fermerLettre()">Fermer</button>
              <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="enregistrerBrouillonLettre()">
                {{ saving() ? 'Enregistrement…' : 'Enregistrer brouillon' }}
              </button>
            </div>

            @if (lettresExamen().length) {
              <div class="exam-modal__list">
                <h3 class="exam__sub">Lettres de cet examen</h3>
                <table>
                  <thead><tr><th>Référence</th><th>Statut</th><th>Date</th><th></th></tr></thead>
                  <tbody>
                    @for (l of lettresExamen(); track l.idLettre) {
                      <tr>
                        <td class="cnm-mono">{{ l.refLettre || ('#' + l.idLettre) }}</td>
                        <td><app-statut-badge [statut]="l.statut" /></td>
                        <td class="cnm-mono">{{ l.dateLettre || '—' }}</td>
                        <td>
                          @if (l.statut === 'BROUILLON') {
                            <button type="button" class="btn btn-primary btn-sm" [disabled]="saving()" (click)="soumettreLettre(l)">Soumettre</button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
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
    .exam__step--done-obs { background: #FFFBEB; color: #B45309; border-color: #F59E0B; }
    .exam__step--done-obs .exam__step-dot { background: #F59E0B; }
    .exam__info { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0; }
    .exam__info dt { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .08em; color: var(--n-400); }
    .exam__info dd { margin: 2px 0 0; }
    .exam__marches { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1.25rem; }
    /* Pièces jointes du dossier (liste + téléchargement) sous les lignes de marché. */
    .exam__pieces { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem; }
    .exam__pieces-grp { display: flex; flex-direction: column; gap: 0.35rem; }
    .exam__pieces-pill { align-self: flex-start; font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--info-text, #2563eb); background: var(--info-bg, #eff6ff); padding: 0.15rem 0.5rem; border-radius: 999px; }
    .exam__pieces-pill--lr { color: #B45309; background: #FFFBEB; }
    .exam__piece { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; background: #fff; border: 1px solid var(--c-100); border-radius: var(--radius-md); }
    .exam__piece-idx { flex: none; width: 1.4rem; height: 1.4rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: var(--info-bg, #eff6ff); color: var(--info-text, #2563eb); font-size: var(--text-xs); font-weight: 700; }
    .exam__piece-idx--lr { background: #FFFBEB; color: #B45309; }
    .exam__piece-name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
    .exam__piece-fmt { flex: none; font-size: 0.6rem; }
    .exam__piece-btn { flex: none; white-space: nowrap; }
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
    .exam-modal { width: 100%; max-width: 44rem; max-height: 88vh; overflow: auto; background: #fff; border-radius: var(--radius-2xl); box-shadow: var(--shadow-xl); padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .exam-modal__list { overflow-x: auto; }
    .exam-modal__list table { width: 100%; }
    .exam-modal__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .exam-modal__info { display: flex; flex-direction: column; gap: 0.35rem; margin: 0; }
    .exam-modal__info > div { display: flex; gap: 0.5rem; align-items: baseline; }
    .exam-modal__info dt { flex: 0 0 10rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-400); }
    .exam-modal__info dd { margin: 0; }
    .exam-modal__foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .exam-modal__corps { resize: vertical; }
    @media (max-width: 60rem) { .exam__grid { grid-template-columns: 1fr; } }
  `,
})
export class ExamenDossier {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dossierService = inject(DossierService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly pointsCtrlService = inject(PointsCtrlService);
  private readonly avisService = inject(AvisService);
  private readonly examenService = inject(ExamenService);
  private readonly examenDetailService = inject(ExamenDetailService);
  private readonly pvExamenService = inject(PvExamenService);
  private readonly lettreRenvoiService = inject(LettreRenvoiService);
  private readonly serviceBenefService = inject(ServiceBeneficiaireService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly idDossier = Number(this.route.snapshot.paramMap.get('idDossier'));
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly dossier = signal<Dossier | null>(null);
  readonly ppm = signal<Ppm | null>(null);
  readonly marches = signal<Marche[]>([]);
  /** Bénéficiaires + dates prévisionnelles des marchés du dossier (pour le tableau PPM partagé). */
  readonly serviceBenefs = signal<ServiceBeneficiaire[]>([]);
  readonly previsions = signal<MarchePrevision[]>([]);
  /** Pièces jointes réellement déposées sur le dossier (lecture + téléchargement). */
  readonly pieces = signal<PieceJointeDossier[]>([]);
  readonly loadingPieces = signal(false);
  readonly piecesInitiales = computed(() => this.pieces().filter((p) => !p.apresLettreRenvoi));
  readonly piecesApresRenvoi = computed(() => this.pieces().filter((p) => p.apresLettreRenvoi));
  readonly idDispatch = signal<number | null>(null);
  readonly points = signal<PointsCtrl[]>([]);
  readonly aviss = signal<Avis[]>([]);
  private readonly examens = signal<Examen[]>([]);
  private readonly details = signal<ExamenDetail[]>([]);
  private readonly pvs = signal<PvExamen[]>([]);

  readonly dateExamen = signal(new Date().toISOString().slice(0, 10));
  readonly avis = signal<string | null>(null);
  readonly synthese = signal('');
  /** Modal « Lettre de renvoi » (création) : visibilité + corps (objet fixe « lettre de renvoi »). */
  readonly lettreModal = signal(false);
  readonly corpsLettre = signal('');
  /** Lettres de renvoi déjà créées pour l'examen courant (affichées dans le modal). */
  readonly lettresExamen = signal<LettreRenvoi[]>([]);
  /** Date de la lettre = aujourd'hui (lecture seule). */
  readonly dateLettre = new Date().toISOString().slice(0, 10);
  /**
   * Résultats de l'examen, clé `${idDetail}:${idPt}` (point LIGNE, par marché) ou `D:${idPt}` (point DOSSIER).
   * Remplace l'ancien état par-dossier : l'examen se fait ligne par ligne.
   */
  private readonly resultats = signal<Map<string, RowState>>(new Map());
  /** Erreur « ≥1 ligne obligatoire » par point non conforme de l'étape courante (clé = idPtControle). */
  readonly pointErreurs = signal<Map<number, string>>(new Map());

  // — Workflow séquentiel : une ligne active à la fois, de haut en bas, puis étape dossier, puis avis. —
  /** Étape courante : 0..N-1 = marchés ; N = points DOSSIER (si présents) ; dernière = avis global. */
  readonly etape = signal(0);

  /** Points de portée LIGNE (évalués par marché) — défaut LIGNE si portée absente. */
  readonly pointsLigne = computed(() => this.points().filter((p) => (p.portee ?? 'LIGNE') === 'LIGNE'));
  /** Points de portée DOSSIER (inter-lignes, évalués une fois). */
  readonly pointsDossier = computed(() => this.points().filter((p) => p.portee === 'DOSSIER'));
  readonly nbLignes = computed(() => this.marches().length);
  readonly hasEtapeDossier = computed(() => this.pointsDossier().length > 0);
  /** Index de l'étape « avis global » (après les marchés + l'éventuelle étape dossier). */
  readonly etapeAvis = computed(() => this.nbLignes() + (this.hasEtapeDossier() ? 1 : 0));
  readonly estEtapeMarche = computed(() => this.etape() < this.nbLignes());
  readonly estEtapeDossier = computed(() => this.hasEtapeDossier() && this.etape() === this.nbLignes());
  readonly estEtapeAvis = computed(() => this.etape() >= this.etapeAvis());
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
  /** Tous les points de l'étape courante sont-ils statués (→ « Valider » activable) ? */
  readonly etapeCouranteStatuee = computed(() =>
    this.estEtapeMarche()
      ? this.idDetailCourant() != null && this.ligneStatuee(this.idDetailCourant() as number)
      : this.estEtapeDossier()
        ? this.dossierStatue()
        : true,
  );
  /** Toutes les lignes + l'étape dossier ont-elles été traitées ? (condition d'ouverture de l'avis). */
  readonly toutTraite = computed(
    () => this.marches().every((m) => this.ligneStatuee(m.idDetail)) && (!this.hasEtapeDossier() || this.dossierStatue()),
  );

  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly modeMap = signal<Map<string, string>>(new Map());

  /** Mode déduit du statut : DISPATCHE → création ; EXAMINE → édition ; sinon verrouillé. */
  readonly mode = computed<'create' | 'edit' | 'locked'>(() => {
    const s = this.dossier()?.statut;
    if (s === 'DISPATCHE') return 'create';
    if (s === 'EXAMINE') return 'edit';
    return 'locked';
  });
  private readonly existingExamenId = signal<number | null>(null);
  /** Projet de PV rattaché à l'examen (mode edit) — porte l'avis + la synthèse à éditer. */
  private readonly existingPv = signal<PvExamen | null>(null);
  /**
   * Avis/synthèse éditables ici si : aucun projet de PV n'existe encore (examen créé sans soumission,
   * ex. via lettre de renvoi → « Modifier l'examen » le créera), OU le PV existant est encore BROUILLON.
   * Un PV déjà soumis (≠ BROUILLON) reste en lecture seule (→ « Projets de PV »).
   */
  readonly pvEditable = computed(() => {
    if (this.mode() !== 'edit') return false;
    const pv = this.existingPv();
    return pv === null || pv.statutPv === 'BROUILLON';
  });
  /** Le bloc avis/synthèse est éditable à la création, ou en édition tant que le PV est BROUILLON. */
  readonly avisEditable = computed(() => this.mode() === 'create' || this.pvEditable());

  readonly estPpm = computed(() => this.dossier()?.idTypeDossier === 'DDP');
  readonly typeLabel = computed(() => {
    const id = this.dossier()?.idTypeDossier;
    return id ? this.typeMap().get(id) ?? id : '—';
  });
  readonly localiteLabel = computed(() => {
    const id = this.dossier()?.idLocalite;
    return id ? this.localiteMap().get(id) ?? id : '—';
  });

  constructor() {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.avisService.list().subscribe((a) => this.aviss.set(a));

    // Pièces jointes du dossier (tous types) — chargées à part pour ne pas bloquer l'examen si l'appel échoue.
    this.loadingPieces.set(true);
    this.pieceService.getByDossier(this.idDossier).subscribe({
      next: (rows) => {
        this.pieces.set(rows);
        this.loadingPieces.set(false);
      },
      error: () => this.loadingPieces.set(false),
    });

    // Dossier partagé : consommé par le forkJoin ET par la grille (dérivée de son sous-type), un seul GET.
    const dossier$ = this.dossierService.getById(this.idDossier).pipe(shareReplay(1));
    forkJoin({
      dossier: dossier$,
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
        this.examens.set(r.examens);
        this.details.set(r.details);
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
        // Mode édition (dossier EXAMINE) : pré-remplir depuis l'examen existant + ses détails (statut dérivé de conforme).
        if (r.dossier.statut === 'EXAMINE') {
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
            // Examen déjà réalisé (tout statué) → l'avis est directement accessible (navigation libre).
            this.etape.set(this.etapeAvis());
          }
        }
        this.resultats.set(map);
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
  /** Libellé lisible de l'avis suggéré (`avisSuggere` de l'examen) ; `null` si absent. */
  avisSuggereLabel(): string | null {
    const s = this.examens().find((e) => e.idExamen === this.existingExamenId())?.avisSuggere;
    if (!s) return null;
    return this.aviss().find((a) => a.idAvis === s)?.libelleAvis ?? (s === 'DEF' ? 'Défavorable' : s === 'FAV' ? 'Favorable' : s);
  }

  /** Valide l'étape courante (points OBS ⇒ ≥1 observation) et avance. Bouton activable seulement si tout est statué. */
  validerEtape(): void {
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
    // Avance vers l'étape suivante (marché suivant → dossier → avis). L'état « traité » est dérivé des statuts.
    this.etape.update((e) => Math.min(e + 1, this.etapeAvis()));
    this.preRemplirAvisSuggere();
  }
  /** Navigation : n'importe quelle ligne jusqu'à la frontière (rouvrir une ligne examinée pour la corriger), dossier/avis si atteints. */
  allerEtape(i: number): void {
    const atteignable =
      (i < this.nbLignes() && i <= this.frontiere()) ||
      (this.hasEtapeDossier() && i === this.nbLignes() && this.frontiere() === this.nbLignes()) ||
      (i === this.etapeAvis() && this.toutTraite());
    if (atteignable) this.etape.set(i);
  }
  /** Rouvre la ligne cliquée dans le tableau (repasse « en cours » ; son état RAS/observation est recalculé après re-validation). */
  ouvrirLigne(m: Marche): void {
    const i = this.marches().findIndex((x) => x.idDetail === m.idDetail);
    if (i >= 0) this.allerEtape(i);
  }
  /** Ouvre/télécharge une pièce jointe dans un nouvel onglet (contenu binaire via /contenu). */
  ouvrirPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) return;
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (blob) => window.open(URL.createObjectURL(blob), '_blank'),
      error: () => this.toast.error("Impossible d'ouvrir la pièce."),
    });
  }
  /** Pré-remplit l'avis final depuis `avisSuggere` (si non encore choisi et présent au référentiel). */
  private preRemplirAvisSuggere(): void {
    if (this.avis()) return;
    const sugg = this.examens().find((e) => e.idExamen === this.existingExamenId())?.avisSuggere;
    if (sugg && this.aviss().some((a) => a.idAvis === sugg)) this.avis.set(sugg);
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
    if (manque) this.toast.error('Un point avec observation n\'a pas d\'observation renseignée — vérifiez chaque ligne.');
    return !manque;
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
    // PV encore BROUILLON : l'avis est édité ici (requis) et mis à jour avec l'examen.
    if (this.pvEditable() && !this.avis()) {
      this.formError.set('Sélectionnez un avis global (requis pour le projet de PV).');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);
    this.modifier(idDispatch);
  }

  /** Création — « Soumettre l'examen » : toutes les lignes traitées + avis global, crée l'examen puis le projet de PV. */
  soumettre(): void {
    if (!this.dossier() || this.idDispatch() == null) return;
    if (!this.toutTraite()) {
      this.formError.set('Traitez toutes les lignes de marché (et l\'étape dossier) avant de soumettre.');
      return;
    }
    if (!this.observationsCompletes()) return;
    if (!this.avis()) {
      this.formError.set('Sélectionnez un avis global (requis pour le projet de PV).');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);
    this.ensureExamen()
      .pipe(
        switchMap((idExamen) => this.examenService.soumettre(idExamen, { idAvis: this.avis() as string })),
        // ExamenSoumissionRequest ne porte que idAvis : on persiste la synthèse via une MAJ du PV créé
        // (encore BROUILLON) — PUT /api/pv-examens/{id}.
        switchMap((pv) => {
          const synthese = this.synthese().trim();
          return synthese ? this.pvExamenService.update(pv.idPv, { ...pv, syntheseObservations: synthese }) : of(pv);
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success('Examen enregistré · projet de PV créé.');
          void this.router.navigate(['/membre/pv']);
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          this.toast.error(e.message || "Erreur lors de la soumission de l'examen.");
        },
      });
  }

  // — Lettre(s) de renvoi pendant l'examen (action séparée ; plusieurs lettres possibles) —
  ouvrirModalLettre(): void {
    if (!this.dossier() || this.idDispatch() == null) return;
    if (!this.observationsCompletes()) return;
    this.corpsLettre.set('');
    this.chargerLettresExamen();
    this.lettreModal.set(true);
  }
  fermerLettre(): void {
    if (!this.saving()) {
      this.lettreModal.set(false);
    }
  }
  /** Enregistre un brouillon de lettre (crée l'examen au besoin), puis recharge la liste de l'examen. */
  enregistrerBrouillonLettre(): void {
    this.saving.set(true);
    const corps = this.corpsLettre().trim();
    this.ensureExamen()
      .pipe(switchMap((idExamen) => this.lettreRenvoiService.creer({ idExamen, corpsLettre: corps || undefined })))
      .subscribe({
        next: () => {
          this.toast.success('Brouillon de lettre de renvoi enregistré.');
          this.corpsLettre.set('');
          this.saving.set(false);
          this.chargerLettresExamen();
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          this.toast.error(e.message || "Erreur lors de l'enregistrement de la lettre.");
        },
      });
  }
  /** Soumet une lettre de renvoi (BROUILLON → SOUMIS). */
  soumettreLettre(l: LettreRenvoi): void {
    if (l.idLettre == null) return;
    this.saving.set(true);
    this.lettreRenvoiService.soumettre(l.idLettre).subscribe({
      next: () => {
        this.toast.success('Lettre de renvoi soumise.');
        this.saving.set(false);
        this.chargerLettresExamen();
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.toast.error(e.message || 'Erreur lors de la soumission de la lettre.');
      },
    });
  }

  /** Recharge les lettres de l'examen courant (vide tant que l'examen n'existe pas). */
  private chargerLettresExamen(): void {
    const idExamen = this.existingExamenId();
    if (idExamen == null) {
      this.lettresExamen.set([]);
      return;
    }
    this.lettreRenvoiService
      .getAll()
      .subscribe((rows) => this.lettresExamen.set(rows.filter((l) => l.idExamen === idExamen)));
  }

  /** Garantit l'existence de l'examen (le crée + ses détails si besoin) et renvoie son id. */
  private ensureExamen(): Observable<number> {
    const existing = this.existingExamenId();
    if (existing != null) {
      return of(existing);
    }
    const im = this.auth.ref() ?? '';
    const idExamen = this.nextId(this.examens().map((e) => e.idExamen));
    const examen: Examen = {
      idExamen,
      idDispatch: this.idDispatch() as number,
      imCtrlMembre: im || undefined,
      dateExamen: this.dateExamen(),
    };
    return this.examenService.create(examen).pipe(
      switchMap(() => {
        let idd = this.nextId(this.details().map((d) => d.idDetailExamen));
        // Un ExamenDetail par (marché × point LIGNE) + un par point DOSSIER (idDetail null).
        const detailCalls = this.entreesResultats().map((e) =>
          this.examenDetailService.create({
            idDetailExamen: idd++,
            idExamen,
            idDetail: e.idDetail,
            idPtControle: e.idPt,
            conforme: e.st.statut !== 'OBS',
            observations: this.observationsBody(e.st),
          }),
        );
        return detailCalls.length ? forkJoin(detailCalls) : of([]);
      }),
      map(() => {
        this.existingExamenId.set(idExamen);
        this.examens.update((arr) => [...arr, examen]);
        return idExamen;
      }),
    );
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
          const calls = this.entreesResultats().map((e) => {
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
          return calls.length ? forkJoin(calls) : of([]);
        }),
        // Projet de PV éditable : on met à jour (PV BROUILLON existant) ou on le CRÉE (aucun PV encore),
        // puis on persiste la synthèse — dans la foulée de la mise à jour de l'examen.
        switchMap(() => {
          if (!this.pvEditable()) return of(null);
          const pv = this.existingPv();
          const synthese = this.synthese().trim() || undefined;
          if (pv) {
            return this.pvExamenService.update(pv.idPv, {
              ...pv,
              idAvis: this.avis() as string,
              syntheseObservations: synthese,
            });
          }
          // Aucun projet de PV (examen créé sans soumission, ex. via lettre de renvoi) → le créer
          // DIRECTEMENT (POST /api/pv-examens). On n'utilise pas la façade examens/{id}/soumettre :
          // elle attend un dossier DISPATCHE et renvoie 400 sur un dossier déjà EXAMINE.
          const nouveauPv: PvExamen = {
            idPv: this.nextId(this.pvs().map((p) => p.idPv)),
            idExamen,
            idAvis: this.avis() as string,
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
          this.toast.success('Examen modifié.');
          void this.router.navigate(['/membre/examines']);
        },
        error: (_e: ApiError) => this.saving.set(false), // 409 (verrouillé) / 403 → toast centralisé
      });
  }
}
