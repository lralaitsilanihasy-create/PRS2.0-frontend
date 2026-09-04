import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
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
import { DossierConsultation } from '../circuit/dossier-consultation';

/**
 * Projets de PV du Membre : liste (lecture + contenu détaillé) et actions de workflow
 * (soumettre / signer…) déléguées au composant partagé `app-pv-workflow`.
 * Le PV brouillon est créé automatiquement au moment de l'examen (pas de création manuelle ici).
 */
@Component({
  selector: 'app-membre-pv',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, PvWorkflow, DossierConsultation, DatePipe, RouterLink, ChronometrageDossier],
  template: `
    <section class="pv">
      <header class="page-header">
        <h1 class="page-title">Projets de PV</h1>
      </header>

      @if (loading()) {
        <p class="pv__info" role="status">Chargement…</p>
      } @else {
        <ul class="pv__list">
          @for (pv of pvs(); track pv.idPv) {
            <li class="card pv-card" [class.pv-card--open]="selected()?.idPv === pv.idPv">
              <div class="pv-card__head">
                <!-- ⚠️ Demande user (2026-08-03) — le projet de PV est ACCOMPAGNÉ de son dossier :
                     référence + entité visibles dès la liste, et consultation complète du dossier
                     (PPM, marchés, pièces jointes) sans quitter l'écran. -->
                <div class="pv-card__ident">
                  <span class="pv-card__ref">{{ pv.refePv || pv.referencePv || ('PV #' + pv.idPv) }}</span>
                  <span class="pv-card__dossier">
                    <span class="pv-card__dossier-lbl">Dossier</span>
                    <span class="cnm-mono">{{ dossierRef(pv) }}</span>
                    @if (dossierEntite(pv); as ent) { <span class="pv-card__sep">·</span>{{ ent }} }
                  </span>
                </div>
                <app-statut-badge [statut]="pv.statutPv" [label]="label(pv)" />
                @if (dossierDe(pv); as d) {
                  <button type="button" class="btn btn-outline btn-sm" (click)="dossierConsulte.set(d)">
                    📂 Voir le dossier
                  </button>
                }
                <button type="button" class="btn btn-secondary" (click)="selectionner(pv)">
                  {{ selected()?.idPv === pv.idPv ? 'Masquer' : 'Gérer' }}
                </button>
              </div>
              @if (selected()?.idPv === pv.idPv) {
                <div class="pv-content" #pvContent>
                  <div class="pv-print-bar">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="imprimer(pv)" title="Imprimer" aria-label="Imprimer">🖨 Imprimer</button>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="imprimer(pv)" title="Enregistrer au format PDF" aria-label="Enregistrer au format PDF">📄 PDF</button>
                  </div>
                  <!-- Chronométrage EN TÊTE (demande pilote 2026-09-04 : « Prendre en charge »
                       toujours en haut) : prise en charge des étapes VISA / COSIGNATURE. -->
                  @if (idDossierDe(pv); as idDos) {
                    <div class="pv-chrono-strip">
                      <app-chronometrage-dossier [idDossier]="idDos" [compact]="true" [attributaire]="attributaireDe(pv)" [pecPermise]="pecPermiseDe(pv)" (actionAutorisee)="majAutorisation(pv.idPv, $event)" />
                    </div>
                    @if (!autorisation(pv.idPv)) {
                      <div class="pv__verrou" role="status">
                        🔒 Cliquez d'abord « <strong>Prendre en charge</strong> » ci-dessus : la prise en
                        charge marque le début de votre action et alimente le chronométrage.
                      </div>
                    }
                  }
                  @if (pv.statutPv === 'EN_RECTIFICATION' && dernierRetour()) {
                    <!-- ⚠️ 2026-08-18 — le retour se lit ici : l'accès à la correction doit y être
                         aussi. Sans ce lien, le Membre ne dispose que de « Soumettre le projet » et
                         resoumet à l'identique ; le chemin réel (Mes dossiers → Examinés → Modifier
                         l'examen) n'est signalé nulle part. -->
                    <div class="alert alert-warning pv-retour">
                      <span><strong>Retour pour rectification :</strong> {{ dernierRetour() }}</span>
                      @if (peutRectifier(pv)) {
                        <a class="btn pv-retour__cta" [routerLink]="lienRectification(pv)">
                          ✎ Rectifier l'examen
                        </a>
                      }
                    </div>
                    @if (peutRectifier(pv)) {
                      <p class="pv-retour__aide">
                        Corrigez la grille de contrôle et la synthèse, enregistrez, puis revenez ici
                        pour <strong>soumettre le projet</strong> au Chef de commission.
                      </p>
                    }
                  }
                  <!-- En-tête du projet de PV : référence + tuiles d'identification (avis en badge coloré). -->
                  <div class="pv-entete">
                    <div class="pv-entete__titre">
                      <span class="pv-entete__ref">{{ pv.refePv || pv.referencePv || ('Projet de PV #' + pv.idPv) }}</span>
                      <app-statut-badge [statut]="pv.statutPv" [label]="label(pv)" />
                    </div>
                    <!-- ⚠️ Demande pilote (2026-09-04) : reprendre les COULEURS du tableau de bord
                         « Mes dossiers » — chaque donnée porte sa pastille au même dégradé. -->
                    <div class="pv-entete__grid">
                      <div class="pv-entete__item pv-entete__item--large">
                        <span class="pv-chip pv-chip--blue">📁</span>
                        <span class="pv-entete__txt">
                          <span class="pv-entete__lbl">Dossier</span>
                          <span class="pv-entete__val cnm-mono">{{ dossierRef(pv) }}</span>
                        </span>
                      </div>
                      <div class="pv-entete__item pv-entete__item--large">
                        <span class="pv-chip pv-chip--indigo">🏛️</span>
                        <span class="pv-entete__txt">
                          <span class="pv-entete__lbl">Entité contractante</span>
                          <span class="pv-entete__val">{{ dossierEntite(pv) }}</span>
                        </span>
                      </div>
                      <div class="pv-entete__item">
                        <span class="pv-chip pv-chip--amber">⚖️</span>
                        <span class="pv-entete__txt">
                          <span class="pv-entete__lbl">Avis global</span>
                          <span class="pv-entete__val">
                            @if (pv.idAvis) {
                              <span [class]="avisClasse(pv.idAvis)">{{ avisLabel(pv.idAvis) }}</span>
                            } @else {
                              <span class="pv-entete__attente">En attente du visa</span>
                            }
                          </span>
                        </span>
                      </div>
                      <div class="pv-entete__item">
                        <span class="pv-chip pv-chip--purple">🔁</span>
                        <span class="pv-entete__txt">
                          <span class="pv-entete__lbl">Navettes</span>
                          <span class="pv-entete__val">{{ pv.nbNavettes }}</span>
                        </span>
                      </div>
                      @if (pv.dateSoumissionInitiale) {
                        <div class="pv-entete__item">
                          <span class="pv-chip pv-chip--teal">📤</span>
                          <span class="pv-entete__txt">
                            <span class="pv-entete__lbl">Soumis le</span>
                            <span class="pv-entete__val cnm-mono">{{ pv.dateSoumissionInitiale }}</span>
                          </span>
                        </div>
                      }
                      @if (pv.dateAcceptation) {
                        <div class="pv-entete__item">
                          <span class="pv-chip pv-chip--green">✅</span>
                          <span class="pv-entete__txt">
                            <span class="pv-entete__lbl">Accepté le</span>
                            <span class="pv-entete__val cnm-mono">{{ pv.dateAcceptation }}</span>
                          </span>
                        </div>
                      }
                      @if (pv.datePv) {
                        <div class="pv-entete__item">
                          <span class="pv-chip pv-chip--orange">📅</span>
                          <span class="pv-entete__txt">
                            <span class="pv-entete__lbl">Date PV</span>
                            <span class="pv-entete__val cnm-mono">{{ pv.datePv }}</span>
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                  @if (pv.syntheseObservations) {
                    <div class="pv-synthese">
                      <span class="pv-synthese__lbl">Synthèse des observations du Membre</span>
                      <p class="pv-synthese__texte">{{ pv.syntheseObservations }}</p>
                    </div>
                  }

                  <h3 class="pv-sub"><span class="pv-chip pv-chip--sm pv-chip--indigo">✍️</span> Signataires</h3>
                  <!-- Tuiles d'état de signature (présentation 2026-09-04) : qui, et où en est chaque part. -->
                  <div class="pv-sig">
                    <!-- ⚠️ Deux niveaux (2026-09-04) : après le visa du Président, seules les parts
                         DÉSIGNÉES existent — la tuile d'un rôle non retenu est masquée ; le nom
                         affiché est celui du désigné (qui peut différer de l'examinateur). -->
                    @if (!masquerTuileMembre(pv)) {
                      <div class="pv-sig__tuile" [class.pv-sig__tuile--ok]="pv.dateSignatureMembre" [class.pv-sig__tuile--attente]="!pv.dateSignatureMembre">
                        <span class="pv-sig__role">Membre</span>
                        <span class="pv-sig__nom">{{ pv.nomMembreCoSignataire || acteurNom(pv.imCtrlMembre) || '—' }}</span>
                        <span class="pv-sig__etat">{{ pv.dateSignatureMembre ? '✓ Signé le ' + pv.dateSignatureMembre : 'Signature en attente' }}</span>
                      </div>
                    }
                    @if (!masquerTuileCc(pv)) {
                      <div class="pv-sig__tuile" [class.pv-sig__tuile--ok]="pv.dateSignatureCc" [class.pv-sig__tuile--attente]="!pv.dateSignatureCc">
                        <span class="pv-sig__role">Chef de commission</span>
                        <span class="pv-sig__nom">{{ pv.nomCcCoSignataire || acteurNom(pv.imCtrlCc) || '—' }}</span>
                        <span class="pv-sig__etat">{{ pv.dateSignatureCc ? '✓ Signé le ' + pv.dateSignatureCc : 'Signature en attente' }}</span>
                      </div>
                    }
                    <div class="pv-sig__tuile" [class.pv-sig__tuile--ok]="pv.dateSignaturePresident" [class.pv-sig__tuile--attente]="!pv.dateSignaturePresident">
                      <span class="pv-sig__role">Président</span>
                      <span class="pv-sig__nom">{{ acteurNom(pv.imCtrlPresident) || '—' }}</span>
                      <span class="pv-sig__etat">{{ pv.dateSignaturePresident ? '✓ Signé le ' + pv.dateSignaturePresident : 'Signature en attente' }}</span>
                    </div>
                    <!-- Notion retirée du cycle le 02/09 : la tuile ne subsiste que sur les PV historiques qui en portent un. -->
                    @if (pv.nomSecretaireSeance || pv.idSecretaireSeance) {
                      <div class="pv-sig__tuile">
                        <span class="pv-sig__role">Secrétaire de séance</span>
                        <span class="pv-sig__nom">{{ pv.nomSecretaireSeance || pv.idSecretaireSeance }}</span>
                      </div>
                    }
                  </div>

                  <!-- ⚠️ Demande pilote (2026-09-04, 2ᵉ) — les actions du PV AU-DESSUS de la grille
                       de contrôle (plus de descente en bas de page pour viser/retourner) ; le
                       VERROU de prise en charge s'applique inchangé. -->
                  <div class="pv__bande-actions" [class.pv__actions--verrouillees]="!autorisation(pv.idPv)">
                    <app-pv-workflow [pv]="pv" [idLocalite]="dossierLocalite(pv)"
                      [nbObservationsExamen]="nbObservations() + nbObservationsPieces()" (changed)="onChanged($event)" />
                  </div>

                  <div class="pv-grille-head">
                    <h3 class="pv-sub"><span class="pv-chip pv-chip--sm pv-chip--blue">☑️</span> Grille de contrôle</h3>
                    @if (details().length) {
                      <!-- ⚠️ Par défaut : seuls les points AVEC OBSERVATION sont listés ; bascule vers la grille complète. -->
                      <button type="button" class="btn btn-secondary btn-sm" (click)="grilleComplete.set(!grilleComplete())">
                        {{ grilleComplete() ? 'Observations seulement (' + nbObservations() + ')' : 'Tout afficher (' + details().length + ')' }}
                      </button>
                    }
                  </div>
                  @if (details().length && !groupesAffiches().length) {
                    <p class="pv-grille-ok">✓ Tous les points de contrôle sont conformes — aucune observation.</p>
                  }
                  @if (details().length && groupesAffiches().length) {
                    <table>
                      <thead><tr><th scope="col">Point de contrôle</th><th scope="col">Résultat</th><th scope="col">Observation</th></tr></thead>
                      <tbody>
                        <!-- ⚠️ Résultats groupés par LIGNE DE MARCHÉ (puis points inter-lignes « Dossier »),
                             pour refléter l'examen séquentiel — même donnée, contexte restitué. -->
                        @for (g of groupesAffiches(); track g.cle) {
                          <tr class="pv-grp"><td colspan="3">{{ g.titre }}</td></tr>
                          @for (d of g.rows; track d.idDetailExamen) {
                            <tr>
                              <td>{{ pointLabel(d.idPtControle) }}</td>
                              <td><span class="pv-res" [class.pv-res--obs]="!d.conforme">{{ d.conforme ? 'Conforme' : 'Non conforme' }}</span></td>
                              <td>
                                @if (!d.conforme && observationsTriees(d).length) {
                                  <table class="obs-pv-table">
                                    <thead><tr><th scope="col">AU LIEU DE</th><th scope="col">LIRE</th></tr></thead>
                                    <tbody>
                                      @for (o of observationsTriees(d); track o.idObservation ?? $index) {
                                        <tr><td>{{ o.auLieuDe || '—' }}</td><td>{{ o.lire || '—' }}</td></tr>
                                      }
                                    </tbody>
                                  </table>
                                } @else {
                                  —
                                }
                              </td>
                            </tr>
                          }
                        }
                      </tbody>
                    </table>
                  } @else if (!details().length) {
                    <p class="pv__info">Aucun détail d'examen pour ce PV.</p>
                  }

                  <div class="pv-grille-head">
                    <h3 class="pv-sub"><span class="pv-chip pv-chip--sm pv-chip--teal">📎</span> Pièces jointes</h3>
                    @if (examenPiecesPv().length) {
                      <!-- ⚠️ Même bascule que la grille : observations seulement (défaut) ↔ toutes les pièces. -->
                      <button type="button" class="btn btn-secondary btn-sm" (click)="piecesCompletes.set(!piecesCompletes())">
                        {{ piecesCompletes() ? 'Observations seulement (' + nbObservationsPieces() + ')' : 'Tout afficher (' + examenPiecesPv().length + ')' }}
                      </button>
                    }
                  </div>
                  @if (examenPiecesPv().length && !piecesAffichees().length) {
                    <p class="pv-grille-ok">✓ Toutes les pièces jointes sont conformes — aucune observation.</p>
                  }
                  @if (examenPiecesPv().length && piecesAffichees().length) {
                    <table>
                      <thead><tr><th scope="col">Pièce</th><th scope="col">Résultat</th><th scope="col">Observation</th></tr></thead>
                      <tbody>
                        @for (ep of piecesAffichees(); track ep.idExamenPiece) {
                          <tr>
                            <td>{{ pieceLabel(ep.idPiece) }}</td>
                            <td><span class="pv-res" [class.pv-res--obs]="!ep.conforme">{{ ep.conforme ? 'Conforme' : 'Non conforme' }}</span></td>
                            <td>{{ ep.observation || '—' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  } @else if (!examenPiecesPv().length) {
                    <p class="pv__info">Aucun examen de pièce pour ce PV.</p>
                  }

                  <h3 class="pv-sub"><span class="pv-chip pv-chip--sm pv-chip--purple">🔁</span> Historique des navettes</h3>
                  @if (navettes().length) {
                    <table>
                      <thead><tr><th scope="col">#</th><th scope="col">Sens</th><th scope="col">Acteur</th><th scope="col">Date</th><th scope="col">Commentaire</th></tr></thead>
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
                    <p class="pv__info">Aucune navette pour ce PV.</p>
                  }
                </div>
              }
            </li>
          } @empty {
            <li class="pv__info">Aucun projet de PV en cours.</li>
          }
        </ul>
      }
    </section>

    <!-- Dossier d'origine du projet de PV (lecture seule : PPM, marchés, pièces jointes). -->
    @if (dossierConsulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="dossierConsulte.set(null)" />
    }
  `,
  styles: `
    .pv__info { color: var(--n-500); padding: 0.5rem 0; }
    /* « Aucune action sans prise en charge » (2026-09-04) : actions du PV inertes avant la prise en charge. */
    .pv__verrou { margin: 0.5rem 0; padding: 0.6rem 0.9rem; border: 1px solid #FDE68A; background: #FFFBEB; color: #92400E; border-radius: 8px; font-size: var(--text-sm); }
    /* Bande des actions du PV (demande pilote 2026-09-04) : le style vit dans app-pv-workflow
       (barre de décision indigo) — ici seuls l'espacement et le verrou. */
    .pv__bande-actions {
      margin: 0.9rem 0 1.1rem;
    }
    .pv__actions--verrouillees { pointer-events: none; opacity: 0.45; }
    .pv__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    /* Mise en forme d'ensemble (demande pilote 2026-09-04) : carte ouverte mise en relief,
       respirations et ombrages cohérents sur toutes les rubriques. */
    .pv-card { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; }
    .pv-card--open { border-color: var(--c-200, #c7d2fe); box-shadow: 0 10px 28px rgba(30, 27, 75, 0.1); }
    .pv-card__head { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    /* Identité : référence du PV + dossier d'origine (⚠️ 2026-08-03). */
    .pv-card__ident { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; min-width: 14rem; }
    .pv-card__ref { font-weight: 700; font-size: var(--text-md); color: var(--c-800); letter-spacing: -0.01em; }
    .pv-card__dossier { font-size: var(--text-xs); color: var(--n-500); display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.3rem; }
    .pv-card__dossier-lbl { text-transform: uppercase; letter-spacing: .06em; font-weight: 700; color: var(--n-400); }
    .pv-card__sep { color: var(--n-300); }
    .pv-content {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      border-top: 1px solid var(--c-100);
      padding-top: 1rem;
    }
    /* Le chronométrage ouvre le détail : posé sur sa propre bande, il ne flotte plus dans la page. */
    .pv-chrono-strip {
      background: var(--n-50, #f8fafc);
      border: 1px solid var(--n-200);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.95rem;
    }
    .pv-content td { white-space: normal; }
    .pv-info { display: flex; flex-direction: column; gap: 0.35rem; margin: 0; }
    .pv-info > div { display: flex; gap: 0.5rem; align-items: baseline; }
    .pv-info dt { flex: 0 0 11rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--n-400); }
    .pv-info dd { margin: 0; color: var(--n-700); }
    /* En-tête du projet de PV : fiche d'identité — dégradé doux, référence en grand, filet interne. */
    .pv-entete { display: flex; flex-direction: column; gap: 0.8rem; background: linear-gradient(180deg, var(--c-50), #fff); border: 1px solid var(--c-100); border-radius: var(--radius-lg); padding: 1rem 1.15rem; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05); }
    .pv-entete__titre { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; padding-bottom: 0.6rem; border-bottom: 1px dashed var(--c-100); }
    .pv-entete__ref { font-size: var(--text-xl, 1.25rem); font-weight: 800; color: var(--c-800); letter-spacing: -0.015em; }
    .pv-entete__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.75rem 1rem; }
    .pv-entete__item { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
    .pv-entete__txt { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
    .pv-entete__item--large { grid-column: span 2; }
    @media (max-width: 48rem) { .pv-entete__item--large { grid-column: span 1; } }
    /* Pastilles d'icônes aux dégradés du tableau de bord « Mes dossiers » (.cnm-stat--*) —
       demande pilote 2026-09-04 : les mêmes couleurs vivent ici. */
    .pv-chip { flex-shrink: 0; width: 2.3rem; height: 2.3rem; display: inline-flex; align-items: center; justify-content: center; font-size: 1.05rem; color: #fff; border-radius: var(--radius-md); box-shadow: 0 3px 8px rgba(15, 23, 42, 0.18); }
    .pv-chip--sm { width: 1.75rem; height: 1.75rem; font-size: 0.85rem; border-radius: 8px; }
    .pv-chip--blue { background: linear-gradient(135deg, #0ea5e9, #0284c7); }
    .pv-chip--indigo { background: linear-gradient(135deg, #6366f1, #4f46e5); }
    .pv-chip--green { background: linear-gradient(135deg, #22c55e, #16a34a); }
    .pv-chip--amber { background: linear-gradient(135deg, #fbbf24, #f59e0b); }
    .pv-chip--orange { background: linear-gradient(135deg, #fb923c, #ea580c); }
    .pv-chip--purple { background: linear-gradient(135deg, #a855f7, #7c3aed); }
    .pv-chip--teal { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
    .pv-entete__lbl { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--n-400); }
    .pv-entete__val { font-weight: 600; color: var(--n-700); overflow-wrap: anywhere; }
    .pv-entete__val .badge { font-weight: 700; }
    .pv-entete__attente { font-weight: 500; font-style: italic; color: var(--n-400); }
    /* Synthèse du Membre : panneau dédié, liseré accent (même langage visuel que l'examen). */
    .pv-synthese { display: flex; flex-direction: column; gap: 0.3rem; background: var(--c-50); border: 1px solid var(--c-100); border-left: 3px solid var(--c-500, #4f46e5); border-radius: var(--radius-md); padding: 0.75rem 1rem; }
    .pv-synthese__lbl { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: var(--c-800); }
    .pv-synthese__texte { margin: 0; font-size: var(--text-sm); color: var(--n-700); white-space: pre-wrap; }
    /* Titres de section (présentation 2026-09-04) : intitulé discret + filet séparateur — chaque
       rubrique du PV se détache clairement de la précédente. */
    .pv-sub { margin: 1.35rem 0 0.5rem; padding-top: 1rem; border-top: 1px solid var(--n-100); font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.09em; color: var(--n-400); display: flex; align-items: center; gap: 0.45rem; }
    /* Tuiles des signataires : rôle, nom, état de la part — vert quand la signature est posée. */
    .pv-sig { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.6rem; }
    .pv-sig__tuile { display: flex; flex-direction: column; gap: 0.2rem; border: 1px solid var(--n-200); border-left: 3px solid var(--n-300); border-radius: var(--radius-md); background: #fff; padding: 0.7rem 0.95rem; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06); }
    .pv-sig__tuile--ok { border-left-color: #22C55E; background: #F6FEF9; }
    /* Part en attente : ambre — mêmes codes que « À examiner / Examinés » du tableau de bord. */
    .pv-sig__tuile--attente { border-left-color: #F59E0B; background: #FFFDF5; }
    .pv-sig__role { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--n-400); font-weight: 700; }
    .pv-sig__nom { font-weight: 700; color: var(--n-800); }
    .pv-sig__etat { font-size: var(--text-xs); color: var(--n-400); }
    .pv-sig__tuile--ok .pv-sig__etat { color: #15803D; font-weight: 600; }
    .pv-sig__tuile--attente .pv-sig__etat { color: #B45309; }
    /* Résultat d'un point / d'une pièce : badge sobre (vert conforme, ambre observation). */
    .pv-res { display: inline-block; padding: 0.15rem 0.6rem; border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 700; background: #F0FDF4; color: #15803D; border: 1px solid #BBF7D0; white-space: nowrap; }
    .pv-res--obs { background: #FFFBEB; color: #B45309; border-color: #FDE68A; }
    /* Rangée d'en-tête de groupe (ligne de marché / dossier) dans la grille de contrôle. */
    .pv-grp td { background: var(--c-50); color: var(--c-800); font-weight: 700; font-size: var(--text-sm); border-top: 2px solid var(--c-100); }
    /* Titre de la grille + bascule « observations seulement / tout afficher ». */
    .pv-grille-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
    /* Examen entièrement conforme (mode observations) : constat vert, pas de tableau vide. */
    .pv-grille-ok { margin: 0; padding: 0.5rem 0.75rem; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-md); color: #15803D; font-size: var(--text-sm); font-weight: 600; }
    .pv-print-bar { display: flex; justify-content: flex-end; gap: 0.5rem; }
    /* Le retour de navette porte son action : le motif à gauche, « Rectifier » à droite. */
    .pv-retour { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .pv-retour .btn { flex-shrink: 0; text-decoration: none; }
    .pv-retour__aide { margin: 0.4rem 0 0; font-size: var(--text-sm); color: var(--n-500); }
    /*
     * Action attendue du Membre : elle doit se voir sur le jaune pâle du bandeau (#fef9c3).
     * « btn-warning » y est invisible (même fond que l'alerte) et le bleu primaire s'y fond ;
     * d'où cet orange soutenu. Blanc sur #C2410C = 5,2:1 — au-dessus du seuil AA, comme
     * l'exige le design system pour tout texte.
     */
    .pv-retour .pv-retour__cta {
      background: linear-gradient(135deg, #C2410C, #9A3412);
      border-color: #9A3412;
      color: #fff;
      font-weight: 700;
      box-shadow: 0 2px 6px rgb(154 52 18 / 35%);
    }
    .pv-retour .pv-retour__cta:hover {
      background: linear-gradient(135deg, #9A3412, #7C2D12);
      box-shadow: 0 4px 10px rgb(154 52 18 / 45%);
      transform: translateY(-1px);
    }
    .pv-retour .pv-retour__cta:focus-visible { outline: 3px solid #7C2D12; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      .pv-retour .pv-retour__cta:hover { transform: none; }
    }
    .obs-pv-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    /* Neutralise la bande bleue globale (thead tr en dégradé) : ce sous-tableau reste discret. */
    .obs-pv-table thead tr { background: transparent; }
    .obs-pv-table th { text-align: left; font-weight: 700; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.06em; padding: 0.2rem 0.5rem; border-bottom: 1px solid var(--n-200); background: none; color: var(--n-400); }
    .obs-pv-table td { padding: 0.2rem 0.5rem; vertical-align: top; border-bottom: 1px solid var(--c-100); word-wrap: break-word; white-space: normal; }
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

  readonly pvs = signal<PvExamen[]>([]);
  readonly loading = signal(false);
  readonly selected = signal<PvExamen | null>(null);
  /** ⚠️ 2026-08-03 — dossier ouvert en consultation depuis un projet de PV (null = fermé). */
  readonly dossierConsulte = signal<Dossier | null>(null);

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
  /** ⚠️ Demande pilote (2026-09-04) — « aucune action sans prise en charge », par PV (widget par carte). */
  private readonly autorisations = signal<Map<number, boolean>>(new Map());
  majAutorisation(idPv: number, autorise: boolean): void {
    this.autorisations.update((m) => new Map(m).set(idPv, autorise));
  }
  /** Autorisé par défaut SEULEMENT sans widget (pas de dossier lié) — le widget émet dès son premier calcul. */
  autorisation(idPv: number): boolean {
    return this.autorisations().get(idPv) ?? true;
  }
  /** ⚠️ Deux niveaux (2026-09-04) : après le visa, seules les parts DÉSIGNÉES existent — tuile masquée sinon. */
  masquerTuileMembre(pv: PvExamen): boolean {
    return pv.niveauNavette != null && pv.dateSignaturePresident != null && !pv.imMembreCoSignataire && pv.dateSignatureMembre == null;
  }
  masquerTuileCc(pv: PvExamen): boolean {
    return pv.niveauNavette != null && pv.dateSignaturePresident != null && !pv.imCcCoSignataire && pv.dateSignatureCc == null;
  }
  /**
   * ⚠️ Constat pilote (04/09, dossier 100286) : le CC, son acceptation faite, prenait la tâche
   * VISA du niveau PRÉSIDENT et verrouillait le Président. Verdict de PEC dérivé de l'état du PV
   * — VISA d'un deux-niveaux : le CC DISPATCHEUR à l'étage CC, un PRESIDENT à l'étage Président ;
   * COSIGNATURE : les désignés seulement. `undefined` ailleurs (navette simple : dispatcheur +
   * intérim du périmètre, le serveur tranche ; rectification : l'input `attributaire` couvre).
   */
  pecPermiseDe(pv: PvExamen): boolean | undefined {
    if (pv.statutPv === 'PROJET_SOUMIS' && pv.niveauNavette != null) {
      return pv.niveauNavette === 'CC'
        ? this.auth.ref() === pv.imDispatcheur
        : this.auth.role() === 'PRESIDENT';
    }
    if (pv.statutPv === 'PROJET_ACCEPTE') {
      const moi = this.auth.ref();
      return moi != null && [pv.imCcCoSignataire, pv.imMembreCoSignataire].includes(moi);
    }
    return undefined;
  }
  /**
   * Attributaire COURANT du dispatch de l'examen du PV (`imCtrlMembre`, réattributions comprises).
   * Public : le template le passe au widget de chronométrage (PEC d'EXAMEN réservée à lui).
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
  /** Signataire : nom du contrôleur (+ date de signature si présente), ou « — ». */
  signataire(im?: string, date?: string): string {
    if (!im) {
      return '—';
    }
    const nom = this.controleurMap().get(im) ?? im;
    return date ? `${nom} · signé le ${date}` : nom;
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
    const heading = `Projet de PV — ${ref}`;
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
        // En-tête du PV (bandeau + tuiles).
        `.pv-entete{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px 14px;margin-bottom:8px}` +
        `.pv-entete__titre{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700;margin-bottom:8px}` +
        `.pv-entete__grid{display:flex;flex-wrap:wrap;gap:10px 24px}` +
        `.pv-entete__lbl{display:block;text-transform:uppercase;font-size:10px;color:#888}` +
        `.pv-entete__val{font-weight:600;font-size:13px}` +
        `.pv-entete__attente{font-style:italic;font-weight:500;color:#888}` +
        // Synthèse du Membre (panneau à liseré).
        `.pv-synthese{background:#F8FAFC;border:1px solid #E2E8F0;border-left:3px solid #4F46E5;border-radius:6px;padding:10px 14px;margin:6px 0}` +
        `.pv-synthese__lbl{display:block;text-transform:uppercase;font-size:10px;font-weight:700;color:#334155;margin-bottom:4px}` +
        `.pv-synthese__texte{margin:0;font-size:13px;white-space:pre-wrap}` +
        // Rangées de groupe de la grille (Ligne N — … / Dossier) + tableau AU LIEU DE / LIRE imbriqué.
        `.pv-grp td{background:#EEF2F7;font-weight:700;font-size:12px;color:#1a2230}` +
        `.pv-grille-ok{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:6px;padding:8px 12px;color:#15803D;font-size:13px;font-weight:600;margin:6px 0}` +
        `.obs-pv-table{margin:0}` +
        `.obs-pv-table th{background:none;border:none;border-bottom:1px solid #ddd;text-transform:uppercase;font-size:10px;letter-spacing:.06em;color:#888;text-align:left}` +
        `.obs-pv-table td{border:none;border-bottom:1px solid #eee;vertical-align:top}` +
        // Présentation 2026-09-04 : titres de section, tuiles signataires, badges de résultat.
        `.pv-sub{margin:14px 0 4px;padding-top:10px;border-top:1px solid #E5E7EB;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#888}` +
        `.pv-sig{display:flex;flex-wrap:wrap;gap:8px}` +
        `.pv-sig__tuile{border:1px solid #E5E7EB;border-left:3px solid #CBD5E1;border-radius:6px;padding:8px 12px;min-width:170px}` +
        `.pv-sig__tuile--ok{border-left-color:#22C55E;background:#F6FEF9}` +
        `.pv-sig__role{display:block;text-transform:uppercase;font-size:9px;letter-spacing:.08em;color:#888;font-weight:700}` +
        `.pv-sig__nom{display:block;font-weight:700;font-size:13px}` +
        `.pv-sig__etat{display:block;font-size:11px;color:#666}` +
        `.pv-sig__tuile--ok .pv-sig__etat{color:#15803D;font-weight:600}` +
        `.pv-res{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0}` +
        `.pv-res--obs{background:#FFFBEB;color:#B45309;border-color:#FDE68A}` +
        `button,.pv-print-bar{display:none!important}` +
        `</style></head><body><h1>${heading}</h1>${el.innerHTML}</body></html>`,
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
