import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';

import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { ActionDossier, Capm, Chronometrage, DiffDossier, Dossier, Marche, MarchePrevision, ModePassation, PieceJointeDossier, Ppm, ServiceBeneficiaire, TypeChangementLigne } from '../../models';
import {
  CapmService,
  CompteService,
  DossierService,
  EntiteContractService,
  LocaliteService,
  MarcheService,
  MarchePrevisionService,
  MiseAJourPpmService,
  ModePassationService,
  NatureService,
  PieceJointeDossierService,
  PpmService,
  ReferenceLookupService,
  ServiceBeneficiaireService,
  SoaBeneficiaireService,
  TypeDossierService,
} from '../../services';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import { ChronometrageDossier, StatutBadge } from '../../shared/circuit';
import { PpmMarchesTable } from '../../shared/prmp/ppm-marches-table';
import { FichePresentationDoc } from '../../shared/prmp/fiche-presentation-doc';
import { AgpmDoc } from '../../shared/prmp/agpm-doc';
import { calculerFichePresentation } from '../../shared/prmp/fiche-presentation';
import { calculerAgpm } from '../../shared/prmp/agpm';

/**
 * Consultation d'un dossier en LECTURE SEULE (modale réutilisable).
 * - PPM : en-tête du PPM + lignes de marché (mode en libellé).
 * - DAO/MAOO : infos du dossier.
 * Contenu reconstruit via les listes scopées (GET /api/ppms, /api/marches) filtrées par
 * idDossier (1 appel chacun, pas de N+1) ; libellés via référentiels en cache. Aucune action.
 * Mise en forme alignée sur le modal « Détail PPM » (DetailPpmModal).
 */
@Component({
  selector: 'app-dossier-consultation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, StatutBadge, PpmMarchesTable, ModaleDirective, ChronometrageDossier, FichePresentationDoc, AgpmDoc],
  template: `
    <div [class.modal-backdrop]="!embedded()" [class.closing]="closing()">
      <!-- ⚠️ En modale, le corps n'est monté qu'une fois les données là : sinon le panneau
           s'ouvrait à la taille de son seul en-tête puis grandissait par à-coups (552 → 724 →
           964 px mesurés) PENDANT son animation d'entrée — d'où une ouverture « brusque ».
           Le voile porte donc d'abord le seul indicateur d'attente. En mode embarqué (pas de
           voile), le rendu progressif reste préférable : le bloc est déjà dans la page. -->
      @if (loading() && !embedded()) {
        <div class="dc-attente" role="status"><div class="spinner"></div></div>
      } @else {
      <div
        class="dc"
        [class.dc--embedded]="embedded()"
        [class.dc--large]="estPpm()"
        [attr.role]="embedded() ? null : 'dialog'"
        [attr.aria-modal]="embedded() ? null : 'true'"
        [attr.aria-label]="embedded() ? null : 'Consultation — ' + typeLabel()"
        [appModale]="!embedded()"
        appModaleClicExterieur
        (appModaleFermer)="fermer()"
      >
        <!-- ── En-tête ── -->
        <div class="dc-header">
          <div class="dc-header-top">
            <div class="dc-chips">
              <span class="dc-chip dc-chip-type">{{ typeLabel() }}</span>
              <app-statut-badge [statut]="dossier().statut" />
            </div>
            @if (!embedded()) {
              <button type="button" class="dc-close" aria-label="Fermer" (click)="fermer()">✕</button>
            }
          </div>

          <div class="dc-title">{{ dossier().refeDossier || ('Dossier #' + dossier().idDossier) }}</div>

          <div class="dc-subtitle">
            <i aria-hidden="true">📍</i>
            <span>{{ localiteLabel() }}</span>
            <span class="dc-sep">·</span>
            <i aria-hidden="true">📅</i>
            <span>{{ dossier().dateRef || '—' }}</span>
            <!-- ⚠️ Demande pilote (2026-09-02, précisée) — l'en-tête d'identité est MASQUÉ à
                 CHAQUE ouverture ; le bouton le déplie à la demande (état local au modal). -->
            <button type="button" class="btn btn-ghost btn-sm dc-toggle-entete"
              [attr.aria-expanded]="!enteteReplie()" (click)="enteteReplie.set(!enteteReplie())">
              {{ enteteReplie() ? "▸ Afficher l'en-tête" : "▾ Masquer l'en-tête" }}
            </button>
          </div>

          <!-- ⚠️ Demande pilote (2026-09-02, précisée 2×) — l'identité et le chronométrage se
               partagent la MÊME rangée, sous la ligne de titre : le bloc « Chronométrage & délais »
               est AU MÊME NIVEAU que l'en-tête d'identité (qui reste repliable). -->
          <div class="dc-header-corps">
          <!-- ⚠️ 2026-08-14 (demande user) — en-tête ÉPURÉ : seuls Entité contractante, Localité,
               Référence PRMP, Exercice, Signataire et Mise à jour restent (Type est déjà en chip,
               la date réf. dans le sous-titre ; PRMP d'attribution/dates de signature retirés). -->
          @if (!enteteReplie()) {
          <div class="dc-meta dc-header-gauche">
            <div class="dc-meta-row">
              <span class="dc-meta-label">Entité contractante</span>
              <span class="dc-meta-value">{{ entiteLabel() }}</span>
            </div>
            <div class="dc-meta-row">
              <span class="dc-meta-label">Localité</span>
              <span class="dc-meta-value">{{ localiteLabel() }}</span>
            </div>
            @if (ppm(); as p) {
              @if (montrerReferencePpm()) {
                <div class="dc-meta-row">
                  <span class="dc-meta-label">Référence PRMP</span>
                  <span class="dc-meta-value">{{ p.reference || '—' }}</span>
                </div>
              }
              <div class="dc-meta-row">
                <span class="dc-meta-label">Exercice</span>
                <span class="dc-meta-value">{{ p.exercice }}</span>
              </div>
              <div class="dc-meta-row">
                <span class="dc-meta-label">Signataire</span>
                <span class="dc-meta-value">{{ p.signataire || '—' }}</span>
              </div>
              @if (p.numMaj != null) {
                <div class="dc-meta-row">
                  <span class="dc-meta-label">Mise à jour</span>
                  <span class="dc-meta-value">n° {{ p.numMaj }}{{ p.dateMaj ? ' · ' + p.dateMaj : '' }}</span>
                </div>
              }
            }
          </div>
          }

          <!-- Chronométrage & délais (2026-09-01, dans l'en-tête depuis le 02/09) : chargé DANS
               la vague unique (donnees) ; zone absente pour un dossier hors circuit.
               ⚠️ Constat pilote (2026-09-04, écran Vérifier) : la consultation est une RESTITUTION —
               le geste « Prendre en charge » vit sur le bandeau compact des écrans d'action, qui
               l'affichent déjà en tête ; ici il faisait DOUBLON (deux boutons sur le même écran).
               pecPermise=false : compteurs et passages restent, le geste disparaît. -->
          @if (chronoDossier(); as chrono) {
            @if (chrono.taches.length || chrono.etapeCourante || chrono.datePrevisionnelleFin || chrono.debutCompteur) {
              <div class="dc-header-droite">
                <div class="dc-chrono-titre"><span aria-hidden="true">⏱</span> Chronométrage &amp; délais</div>
                <app-chronometrage-dossier [idDossier]="dossier().idDossier" [donnees]="chrono" [pecPermise]="false" />
              </div>
            }
          }
          </div>
        </div>

        <!-- ── Corps ── (une seule vague : tout est affiché quand TOUT est chargé — pas de sauts) -->
        <div class="dc-body">
          @if (loading()) {
            <div class="spinner-wrap dc-load"><div class="spinner"></div></div>
          } @else {
          @if (estPpm()) {
            <!-- ⚠️ Demande pilote (2026-09-03) — chaque élément du dossier EN ONGLET : fiche de
                 présentation / plan / projet d'AGPM (si lignes) / pièces jointes — même langage
                 (classes GLOBALES onglets-dossier) que le détail PPM, l'examen et l'aperçu. -->
            <div class="onglets-dossier" role="tablist" aria-label="Éléments du dossier">
              <button type="button" class="onglets-dossier__tab" role="tab" [class.onglets-dossier__tab--on]="ongletDossier() === 'fiche'"
                [attr.aria-selected]="ongletDossier() === 'fiche'" (click)="ongletDossier.set('fiche')">
                Fiche de présentation <span class="onglets-dossier__n">{{ ficheDoc().nbMarchesConcernes }}</span>
              </button>
              <button type="button" class="onglets-dossier__tab" role="tab" [class.onglets-dossier__tab--on]="ongletDossier() === 'ppm'"
                [attr.aria-selected]="ongletDossier() === 'ppm'" (click)="ongletDossier.set('ppm')">
                Plan de passation <span class="onglets-dossier__n">{{ marches().length }}</span>
              </button>
              @if (agpmDoc().length) {
                <button type="button" class="onglets-dossier__tab" role="tab" [class.onglets-dossier__tab--on]="ongletDossier() === 'agpm'"
                  [attr.aria-selected]="ongletDossier() === 'agpm'" (click)="ongletDossier.set('agpm')">
                  Projet d'AGPM <span class="onglets-dossier__n">{{ agpmDoc().length }}</span>
                </button>
              }
              <button type="button" class="onglets-dossier__tab" role="tab" [class.onglets-dossier__tab--on]="ongletDossier() === 'pieces'"
                [attr.aria-selected]="ongletDossier() === 'pieces'" (click)="ongletDossier.set('pieces')">
                Pièces jointes <span class="onglets-dossier__n">{{ pieces().length }}</span>
              </button>
            </div>

            @if (ongletDossier() === 'ppm') {
              <div class="dc-section">
                <app-ppm-marches-table [marches]="marches()" [beneficiaires]="serviceBenefs()" [previsions]="previsions()" [changements]="changements()" [legendeTitre]="legendeChangements()" [detailsChangements]="detailsChangements()" />
              </div>
            }
            @if (ongletDossier() === 'fiche') {
              <div class="dc-section">
                <app-fiche-presentation-doc
                  [fiche]="ficheDoc()"
                  [exercice]="ppm()?.exercice"
                  [libelleVersion]="libelleVersionFiche()"
                  [justificationFiche]="ppm()?.justificationFiche"
                  [motifMaj]="ppm()?.motifMaj"
                />
              </div>
            }
            @if (ongletDossier() === 'agpm') {
              <div class="dc-section">
                <app-agpm-doc
                  [lignes]="agpmDoc()"
                  [exercice]="ppm()?.exercice"
                  [entite]="entiteLabel()"
                  [signataire]="ppm()?.signataire"
                  [dateInitiale]="ppm()?.datePpmInit || ppm()?.dateSignature"
                  [numMajPrec]="ppm()?.numMajPrec"
                  [dateMajPrec]="ppm()?.dateMajPrec"
                  [numMaj]="ppm()?.numMaj"
                />
              </div>
            }
          }

          <!-- Pièces jointes (onglet pour un PPM ; section directe pour les autres familles) -->
          @if (!estPpm() || ongletDossier() === 'pieces') {
          <div class="dc-section">
            <div class="dc-section-head">
              <div class="section-block-title">
                <div class="section-icon">📎</div>
                <span class="section-label">Pièces jointes</span>
                <span class="section-count">{{ pieces().length }} pièce(s)</span>
              </div>
            </div>

              <div class="pieces-card">
                @if (piecesInitiales().length > 0) {
                  <div class="pieces-group">
                    <div class="pieces-group-hd">
                      <span class="group-pill gp-blue">Pièces initiales</span>
                      <span class="group-count">{{ piecesInitiales().length }} fichier(s)</span>
                    </div>
                    @for (p of piecesInitiales(); track p.idPiece; let i = $index) {
                      <div class="piece-row">
                        <div class="piece-left">
                          <span class="piece-index pi-blue">{{ i + 1 }}</span>
                          <span class="piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                        </div>
                        <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">Ouvrir <span class="arrow">↗</span></button>
                      </div>
                    }
                  </div>
                }

                <!-- ⚠️ 2026-08-03 (demande user) — versions CORRIGÉES (rectification sur observations
                     du PV) : section dédiée, distinctes des originales conservées ci-dessus. -->
                @if (piecesCorrigees().length > 0) {
                  <div class="pieces-group">
                    <div class="pieces-group-hd">
                      <span class="group-pill gp-green">Versions corrigées (rectification)</span>
                      <span class="group-count">{{ piecesCorrigees().length }} fichier(s)</span>
                    </div>
                    @for (p of piecesCorrigees(); track p.idPiece; let i = $index) {
                      <div class="piece-row">
                        <div class="piece-left">
                          <span class="piece-index pi-green">{{ i + 1 }}</span>
                          <span class="piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                          <span class="vc-tag">Corrigée</span>
                        </div>
                        <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">Ouvrir <span class="arrow">↗</span></button>
                      </div>
                    }
                  </div>
                }

                @if (piecesApresRenvoi().length > 0) {
                  <div class="pieces-group">
                    <div class="pieces-group-hd">
                      <span class="group-pill gp-orange">Après lettre de renvoi</span>
                      <span class="group-count">{{ piecesApresRenvoi().length }} fichier(s)</span>
                    </div>
                    @for (p of piecesApresRenvoi(); track p.idPiece; let i = $index) {
                      <div class="piece-row">
                        <div class="piece-left">
                          <span class="piece-index pi-orange">{{ i + 1 }}</span>
                          <span class="piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                          <span class="lr-tag">LR</span>
                        </div>
                        <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">Ouvrir <span class="arrow">↗</span></button>
                      </div>
                    }
                  </div>
                }

                @if (pieces().length === 0) {
                  <div class="empty-state">
                    <span class="empty-state-icon" aria-hidden="true">📭</span>
                    <span class="empty-state-text">Aucune pièce jointe.</span>
                  </div>
                }
              </div>
          </div>
          }

          <!-- Journal des actions (spec « Mandats PRMP ») : qui a agi, quand et sous quel mandat.
               L'OPÉRATEUR d'une action peut différer de la PRMP d'attribution (figée) — il est alors marqué. -->
          @if (journalVisible().length) {
            <div class="dc-section">
              <div class="dc-section-head">
                <div class="section-block-title">
                  <div class="section-icon">🕘</div>
                  <span class="section-label">Journal des actions</span>
                  <span class="section-count">{{ journalVisible().length }} action(s)</span>
                </div>
              </div>
              <table class="dc-journal">
                <thead>
                  <tr><th scope="col">Date</th><th scope="col">Action</th><th scope="col">Opérateur</th><th scope="col">Détail</th></tr>
                </thead>
                <tbody>
                  @for (a of journalVisible(); track a.idAction) {
                    <tr>
                      <td class="dc-journal__date">{{ a.dateAction | date: 'dd/MM/yyyy HH:mm' }}</td>
                      <td>{{ actionLabel(a.typeAction) }}</td>
                      <td>
                        {{ a.nomOperateur || a.auteur || a.idPrmpOperateur || '—' }}
                        @if (a.idPrmpOperateur && dossier().idPrmp && a.idPrmpOperateur !== dossier().idPrmp) {
                          <span class="badge dc-journal__succ" title="PRMP en fonction à la date de l'action — différente de la PRMP d'attribution (figée)">≠ attribution</span>
                        }
                      </td>
                      <td class="dc-journal__detail">{{ a.detail || '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          }
        </div>

        <!-- ── Pied ── -->
        @if (!embedded()) {
          <footer class="dc-foot">
            <div class="dc-foot-info">
              @if (estPpm()) { <strong>{{ marches().length }}</strong> marché(s) · }
              <strong>{{ pieces().length }}</strong> pièce(s) jointe(s)
            </div>
            <button type="button" class="btn btn-ghost" (click)="fermer()">Fermer</button>
          </footer>
        }
      </div>
      }
    </div>
  `,
  styles: `
    /* Attente avant montage du panneau : discrète, sans cadre — le panneau qui suit doit être la
       PREMIÈRE forme pleine que l'œil voit apparaître. */
    .dc-attente { display: flex; align-items: center; justify-content: center; padding: 3rem; }
    .dc {
      width: 100%;
      /* Jamais plus large que la zone utile du backdrop (100 % = viewport − padding), quel que soit le zoom. */
      max-width: min(96rem, 100%);
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 0 0 0.5px var(--p-200), var(--shadow-xl);
    }
    /* ⚠️ 2026-08-06 (demande user) — un dossier de PLANIFICATION porte le tableau des marchés et ses
       15 colonnes : à 96rem, les en-têtes d'un mot long (« PREVISIONNELLE ») débordaient sur la colonne
       voisine. Le modal prend alors toute la largeur utile. Les autres types de dossier, eux, n'ont
       que des champs : les élargir ne ferait qu'étirer du vide. */
    .dc--large {
      max-width: min(118rem, 100%);
    }
    .dc--embedded {
      max-width: none;
      max-height: none;
      overflow: visible;
      box-shadow: none;
      border-radius: 0;
    }

    /* En-tête */
    .dc-header { padding: 18px 24px 16px; border-bottom: 0.5px solid var(--n-200); flex-shrink: 0; }
    /* Corps de l'en-tête (2026-09-02, précisé 2×) : SOUS la ligne de titre, l'identité (repliable)
       et le chronométrage se partagent la même rangée — même niveau. */
    .dc-header-corps { display: flex; align-items: flex-start; gap: 1.5rem; flex-wrap: wrap; }
    .dc-header-gauche { flex: 1 1 26rem; min-width: 22rem; max-width: 44rem; }
    /* ⚠️ Demande pilote (2026-09-02) — bloc en COULEUR VIVE : carte teintée du bleu primaire,
       accent appuyé à gauche, titre et date prévisionnelle en vif. Le contenu reste sur fond
       clair pour la lisibilité du tableau des tâches. */
    .dc-header-droite {
      flex: 2 1 32rem;
      min-width: 0;
      background: linear-gradient(135deg, #e0f2fe, #f0f9ff 55%, #fff);
      border: 1px solid var(--p-200, #bae6fd);
      border-left: 5px solid var(--p-500);
      border-radius: 12px;
      padding: 12px 16px 14px;
      box-shadow: 0 1px 3px rgb(2 132 199 / 0.12);
    }
    .dc-chrono-titre { font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--p-600); margin-bottom: 8px; }
    .dc-header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 0.75rem; }
    .dc-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .dc-chip { font-size: 9.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 2px 9px; border-radius: var(--radius-full); }
    .dc-chip-type { background: var(--p-50); color: var(--p-600); }
    .dc-close {
      width: 28px; height: 28px; border-radius: 7px;
      background: var(--n-100); border: 0.5px solid var(--n-200); color: var(--n-400);
      font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-family: var(--font-base); transition: var(--transition); flex-shrink: 0;
    }
    .dc-close:hover { background: var(--n-200); color: var(--n-800); }
    .dc-title { font-size: 20px; font-weight: 700; color: var(--n-800); letter-spacing: -.025em; line-height: 1.1; margin-bottom: 6px; }
    .dc-subtitle { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--n-400); margin-bottom: 14px; }
    .dc-subtitle i { font-size: 12px; font-style: normal; }
    /* Repli de l'en-tête (2026-09-02) : bouton discret en bout de sous-titre. */
    .dc-toggle-entete { margin-left: auto; font-size: var(--text-xs); color: var(--n-500); }
    .dc-sep { opacity: .4; }
    .dc-meta { background: var(--n-50); border: 0.5px solid var(--n-200); border-radius: 10px; overflow: hidden; }
    .dc-meta-row { display: flex; align-items: center; gap: 10px; padding: 7px 14px; border-bottom: 0.5px solid var(--n-200); }
    .dc-meta-row:last-child { border-bottom: none; }
    .dc-meta-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--n-400); width: 110px; flex-shrink: 0; }
    .dc-meta-value { font-size: 12.5px; font-weight: 600; color: var(--n-800); }
    .dc-meta-empty { color: var(--n-300); font-style: italic; font-weight: 400; }

    /* Journal des actions (spec « Mandats PRMP »). */
    .dc-journal { width: 100%; border-collapse: collapse; font-size: 12.5px; background: #fff; border: 0.5px solid var(--n-200); border-radius: 10px; overflow: hidden; }
    .dc-journal th { text-align: left; padding: 7px 12px; background: var(--n-50); border-bottom: 0.5px solid var(--n-200); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--n-400); white-space: nowrap; }
    .dc-journal td { padding: 7px 12px; border-bottom: 0.5px solid var(--n-100); vertical-align: top; white-space: normal; }
    .dc-journal tr:last-child td { border-bottom: none; }
    .dc-journal__date { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--n-500); }
    .dc-journal__detail { color: var(--n-500); }
    .dc-journal__succ { background: var(--warning-bg, #fef3c7); color: var(--warning-text, #b45309); margin-left: 6px; font-size: 10px; }

    /* Corps / sections — overscroll contenu : la molette ne « fuit » pas vers la page derrière. */
    .dc-body { overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: var(--p-200) transparent; overscroll-behavior: contain; }
    /* Hauteur réservée pendant le chargement : le contenu remplace le spinner sans saut brutal. */
    .dc-load { min-height: 18rem; }
    .dc-section { padding: 16px 24px; }
    .dc-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 1rem; }
    .dc-empty { margin: 0; }

    /* Badges statut (alignés sur le modal PPM) */
    .badge.badge-prevu { background: var(--info-bg); color: var(--info-text); }
    .badge.badge-cours { background: var(--success-bg); color: var(--success-text); }
    .badge.badge-cloture { background: var(--n-100); color: var(--n-500); }

    /* Pied */
    .dc-foot { border-top: 0.5px solid var(--n-200); padding: 11px 24px; display: flex; align-items: center; justify-content: space-between; background: var(--p-50); flex-shrink: 0; }
    .dc-foot-info { font-size: 11.5px; color: var(--n-400); }
    .dc-foot-info strong { color: var(--p-600); font-weight: 600; }

    .table-card td { white-space: normal; }

    /* Services bénéficiaires (sous-ligne lecture seule d'un marché) */
    .dc-benef-row td { background: var(--n-50); padding: 8px 14px 10px; }
    .dc-benef-title { display: block; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--n-400); margin-bottom: 4px; }
    .dc-benef-line { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--n-600); padding: 2px 0; }
    .dc-benef-soa { font-weight: 600; color: var(--n-800); }
    .dc-benef-cell { color: var(--n-500); }
  `,
})
export class DossierConsultation implements OnInit {
  readonly dossier = input.required<Dossier>();
  /** En mode embarqué : rendu inline (sans overlay, bouton fermer, ni pied) pour insertion dans une colonne. */
  readonly embedded = input(false);
  readonly closed = output<void>();

  /** Animation de sortie en cours (pose `.closing` sur le voile) — voir `fermerAvecAnimation`. */
  readonly closing = signal(false);

  /**
   * Fermeture unique de tous les chemins (voile, ✕, bouton Fermer, Échap) : joue l'animation de
   * sortie avant de retirer le modal. En mode embarqué il n'y a pas de voile — sortie immédiate.
   */
  fermer(): void {
    if (this.embedded()) {
      return;
    }
    fermerAvecAnimation(this.closing, () => this.closed.emit());
  }

  /*
   * Échap et clic sur le voile sont portés par la directive `appModale`, liée à `!embedded()` :
   * le même conteneur est aussi rendu **embarqué** (sans voile, dans une colonne), où un piège
   * de focus serait nuisible — d'où l'entrée qui neutralise la directive dans ce mode. Elle
   * remplace l'écouteur `document:keydown.escape` et le `(click)` de l'overlay qui vivaient ici :
   * ce dernier annonçait un `<div>` non focalisable comme cliquable (ESLint a11y).
   */

  private readonly ppmService = inject(PpmService);
  private readonly modeService = inject(ModePassationService);
  private readonly capmService = inject(CapmService);
  private readonly miseAJourService = inject(MiseAJourPpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly serviceBenefService = inject(ServiceBeneficiaireService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly dossierService = inject(DossierService);
  private readonly toast = inject(ToastService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly auth = inject(AuthService);
  /** En-tête d'identité replié — MASQUÉ par défaut à chaque ouverture (demande pilote 02/09). */
  readonly enteteReplie = signal(true);

  /** La référence PPM interne (ex. « 00018/MLF/PPM/2026 ») n'est montrée qu'aux profils PRMP, UGPM et Secrétaire. */
  readonly montrerReferencePpm = computed(() => ['PRMP', 'UGPM', 'SECRETAIRE'].includes(this.auth.role() ?? ''));

  readonly ppm = signal<Ppm | null>(null);
  /** Versionnement : idDetail → type de changement vs la version précédente (surlignage du tableau). */
  readonly changements = signal<Map<number, TypeChangementLigne> | null>(null);
  /** Titre de la légende du surlignage (« Mise à jour : » ou « Rectification : » selon la source). */
  readonly legendeChangements = signal('Mise à jour :');
  /** idDetail → détail humain « champ : avant → après ; … » (infobulle des lignes surlignées). */
  readonly detailsChangements = signal<Map<number, string> | null>(null);
  /** Le diff de rectification a été appliqué — il prime sur le diff de versions (course des sondages). */
  private diffRectifApplique = false;

  /** Applique un diff (versions OU rectification) au tableau : types par ligne + infobulles de détail. */
  private appliquerDiff(diff: DiffDossier, legende: string): void {
    const types = new Map<number, TypeChangementLigne>();
    const details = new Map<number, string>();
    for (const l of diff.lignes) {
      if (l.idDetail == null) continue;
      types.set(l.idDetail, l.type);
      if (l.champs?.length) {
        details.set(l.idDetail, l.champs.map((c) => `${c.champ} : ${c.avant ?? '—'} → ${c.apres ?? '—'}`).join(' ; '));
      }
    }
    this.changements.set(types);
    this.detailsChangements.set(details);
    this.legendeChangements.set(legende);
  }
  /** Journal MÉTIER des actions (spec « Mandats PRMP ») — vide si le backend ne le sert pas encore. */
  readonly journal = signal<ActionDossier[]>([]);
  /**
   * ⚠️ Demande pilote (2026-09-04) — chaque profil voit le journal À PARTIR de son entrée dans le
   * circuit (« son action ») jusqu'à la fin du traitement : le Secrétaire depuis la Réception, le
   * Président et le CC depuis le Dispatch, le Membre depuis l'attribution qui le concerne
   * (Réattribution, à défaut Dispatch). La PRMP, l'Admin et les profils sans action journalisée
   * voient tout. Section masquée tant que le profil n'est pas entré dans le circuit.
   */
  readonly journalVisible = computed(() => {
    const rows = this.journal();
    const depuis = (types: string[]) => {
      const i = rows.findIndex((a) => types.includes(a.typeAction));
      return i < 0 ? [] : rows.slice(i);
    };
    switch (this.auth.role()) {
      case 'SECRETAIRE':
        return depuis(['RECEPTION']);
      case 'PRESIDENT':
      case 'CHEF_COMMISSION':
        return depuis(['DISPATCH']);
      case 'MEMBRE': {
        const re = depuis(['REATTRIBUTION']);
        return re.length ? re : depuis(['DISPATCH']);
      }
      default:
        return rows;
    }
  });
  /** Chronométrage du dossier (2026-09-01) — `null` si le backend ne le sert pas (section masquée). */
  readonly chronoDossier = signal<Chronometrage | null>(null);

  // ── Onglets du dossier (2026-09-03) : fiche / plan / AGPM / pièces ──
  /** Onglet actif — ouverture sur le plan, comme le détail PPM. */
  readonly ongletDossier = signal<'ppm' | 'fiche' | 'agpm' | 'pieces'>('ppm');
  /** Référentiels COMPLETS des calculs dérivés (les lookups ne portent que des libellés). */
  private readonly modesRef = signal<ModePassation[]>([]);
  private readonly capmsRef = signal<Capm[]>([]);
  /** Documents dérivés — mêmes fonctions pures que le détail PPM, l'examen et l'aperçu. */
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
  readonly libelleVersionFiche = computed(() => {
    const n = this.ppm()?.numMaj ?? 0;
    return n > 0 ? `Mise à jour n° ${n}` : 'Initial';
  });
  readonly marches = signal<Marche[]>([]);
  readonly pieces = signal<PieceJointeDossier[]>([]);
  /** Une seule vague de rendu : le corps s'affiche quand TOUT est chargé (données + référentiels). */
  readonly loading = signal(true);
  readonly piecesInitiales = computed(() => this.pieces().filter((p) => !p.apresLettreRenvoi && !p.versionCorrigee));
  readonly piecesApresRenvoi = computed(() => this.pieces().filter((p) => p.apresLettreRenvoi));
  /** ⚠️ 2026-08-03 — versions CORRIGÉES déposées pendant la rectification (distinctes des originales). */
  readonly piecesCorrigees = computed(() => this.pieces().filter((p) => !p.apresLettreRenvoi && p.versionCorrigee));
  private readonly modeMap = signal<Map<string, string>>(new Map());
  private readonly natureMap = signal<Map<string, string>>(new Map());
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  /** Services bénéficiaires des marchés du dossier (lecture seule), passés au tableau partagé. */
  readonly serviceBenefs = signal<ServiceBeneficiaire[]>([]);
  private readonly soaMap = signal<Map<string, string>>(new Map());
  private readonly compteMap = signal<Map<string, string>>(new Map());
  /** idDetail → ses services bénéficiaires. */
  private readonly benefParDetail = computed(() => {
    const map = new Map<number, ServiceBeneficiaire[]>();
    for (const b of this.serviceBenefs()) {
      const list = map.get(b.idDetail) ?? [];
      list.push(b);
      map.set(b.idDetail, list);
    }
    return map;
  });
  /** Dates prévisionnelles des marchés du dossier (lecture seule), passées au tableau partagé. */
  readonly previsions = signal<MarchePrevision[]>([]);
  private readonly capmMap = signal<Map<string, string>>(new Map());
  /** idDetail → ses dates prévisionnelles (triées par ordre CAPM). */
  private readonly prevParDetail = computed(() => {
    const map = new Map<number, MarchePrevision[]>();
    for (const p of this.previsions()) {
      const list = map.get(p.idDetail) ?? [];
      list.push(p);
      map.set(p.idDetail, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
    }
    return map;
  });

  readonly estPpm = computed(() => this.dossier().idTypeDossier === 'DDP');
  readonly typeLabel = computed(() => {
    const id = this.dossier().idTypeDossier;
    return id ? this.typeMap().get(id) ?? id : '—';
  });
  readonly localiteLabel = computed(() => {
    const id = this.dossier().idLocalite;
    return id ? this.localiteMap().get(id) ?? id : '—';
  });
  readonly entiteLabel = computed(() => {
    const id = this.dossier().idEntiteContract;
    return id != null ? this.entiteMap().get(String(id)) ?? '#' + id : '—';
  });

  /** Libellé d'une action du journal (code brut si inconnu — le backend reste l'autorité). */
  actionLabel(type: string): string {
    const labels: Record<string, string> = {
      CREATION: 'Création',
      SOUMISSION: 'Soumission',
      RESOUMISSION: 'Resoumission',
      TRANSMISSION_COMPLEMENTS: 'Transmission de compléments',
      TRANSMISSION_COMPLEMENTS_DEPOT: 'Compléments de dépôt',
      SUPPRESSION: 'Suppression',
      MISE_A_JOUR: 'Mise à jour',
      // ⚠️ Demande pilote (2026-09-04) — gestes du circuit de dispatch, consignés par le backend
      // (demande 2026-09-04-journal-circuit) : libellés prêts, inertes tant que rien n'est servi.
      RECEPTION: 'Réception',
      DISPATCH: 'Dispatch',
      REATTRIBUTION: 'Réattribution',
      REPRISE: 'Reprise par le dispatcheur',
      RETRAIT_DISPATCH: 'Retrait du dispatch',
    };
    return labels[type] ?? type;
  }

  ngOnInit(): void {
    const id = this.dossier().idDossier;
    // Dossier issu d'une mise à jour → diff vs version précédente pour surligner les lignes changées.
    // Appel SILENCIEUX (hors vague principale) : 403/409 → pas de surlignage, l'affichage reste complet.
    if (this.dossier().idDossierParent != null) {
      this.miseAJourService.diff(id, true).subscribe({
        // Le diff de RECTIFICATION prime (changement le plus récent) : ne pas l'écraser si les deux
        // sondages répondent (ordre d'arrivée non garanti).
        next: (diff) => {
          if (!this.diffRectifApplique) this.appliquerDiff(diff, 'Mise à jour :');
        },
        error: () => {},
      });
    }
    // ⚠️ 2026-08-15 — phase de vérification : diff du DERNIER cycle de RECTIFICATION (état
    // pré-correction figé au premier PUT saisies/ppm → état courant), pour que le vérificateur (et
    // tout profil qui consulte) voie ce que la PRMP a changé. Sondage silencieux (404/409 = jamais
    // rectifié → rien) ; s'il existe, il PRIME sur le diff de versions (changement le plus récent).
    const STATUTS_RECTIFIABLES = ['EN_ATTENTE_DECISION_PRMP', 'EN_VERIFICATION', 'OBSERVATIONS_LEVEES', 'DECISION_TRANSMISE_SIGMP', 'CLOTURE'];
    if (STATUTS_RECTIFIABLES.includes(this.dossier().statut ?? '')) {
      this.miseAJourService.diffRectification(id, true).subscribe({
        next: (diff) => {
          if (diff.lignes.some((l) => l.type !== 'INCHANGEE')) {
            this.diffRectifApplique = true;
            this.appliquerDiff(diff, 'Rectification :');
          }
        },
        error: () => {},
      });
    }
    // UNE SEULE VAGUE : données + référentiels joints dans un même forkJoin — le corps ne s'affiche
    // qu'une fois complet (pas de spinners successifs, pas de libellés qui « clignotent »). Chaque
    // source de données est tolérante à l'échec (of(...)) : le toast centralisé signale l'erreur,
    // le reste du modal s'affiche quand même. Les lookups (shareReplay) sont mis en cache : les
    // rouvrir — ou le tableau partagé qui les redemande — les résout alors de façon synchrone.
    const commun = {
      typeMap: this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).pipe(catchError(() => of(new Map<string, string>()))),
      localiteMap: this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).pipe(catchError(() => of(new Map<string, string>()))),
      entiteMap: this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).pipe(catchError(() => of(new Map<string, string>()))),
      // Pièces jointes du dossier (tous types) — GET /api/piece-jointe-dossiers?dossier={id}.
      pieces: this.pieceService.getByDossier(id).pipe(catchError(() => of([] as PieceJointeDossier[]))),
      // ⚠️ Journal des actions (spec « Mandats PRMP ») : DANS la vague. Chargé à part, sa section
      // s'ajoutait après coup et faisait grandir le panneau déjà affiché (+52 px mesurés) — le
      // mouvement se superposait à l'animation d'ouverture, d'où une entrée « brusque ».
      // Silencieux : un dossier sans journal (ou un backend antérieur) n'affiche pas la section.
      journal: this.dossierService.journal(id).pipe(catchError(() => of([] as ActionDossier[]))),
      // Chronométrage (2026-09-01) : DANS la vague, silencieux — un échec cache la section, sans dialogue.
      chrono: this.dossierService.chronometrage(id, true).pipe(catchError(() => of(null as Chronometrage | null))),
    };
    if (!this.estPpm()) {
      forkJoin(commun).subscribe(({ typeMap, localiteMap, entiteMap, pieces, journal, chrono }) => {
        this.typeMap.set(typeMap);
        this.localiteMap.set(localiteMap);
        this.entiteMap.set(entiteMap);
        this.pieces.set(pieces);
        this.journal.set(journal);
        this.chronoDossier.set(chrono);
        this.loading.set(false);
      });
      return;
    }
    forkJoin({
      ...commun,
      modeMap: this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      soaMap: this.lookups.lookup(SoaBeneficiaireService, 'soaCode', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      compteMap: this.lookups.lookup(CompteService, 'numCompte', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      capmMap: this.lookups.lookup(CapmService, 'idCapm', ['libelleProcessus']).pipe(catchError(() => of(new Map<string, string>()))),
      // Natures : utilisées par le tableau partagé — préchargées ici pour que son premier rendu soit complet.
      natureMap: this.lookups.lookup(NatureService, 'idNature', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      // Référentiels COMPLETS des documents dérivés (onglets fiche / AGPM, 2026-09-03).
      modesRef: this.modeService.list().pipe(catchError(() => of([] as ModePassation[]))),
      capmsRef: this.capmService.list().pipe(catchError(() => of([] as Capm[]))),
      ppms: this.ppmService.list().pipe(catchError(() => of([] as Ppm[]))),
      marches: this.marcheService.list().pipe(catchError(() => of([] as Marche[]))),
      benefs: this.serviceBenefService.list().pipe(catchError(() => of([] as ServiceBeneficiaire[]))),
      previsions: this.previsionService.list().pipe(catchError(() => of([] as MarchePrevision[]))),
    }).subscribe(({ typeMap, localiteMap, entiteMap, pieces, journal, chrono, modeMap, natureMap, modesRef, capmsRef, soaMap, compteMap, capmMap, ppms, marches, benefs, previsions }) => {
      this.typeMap.set(typeMap);
      this.localiteMap.set(localiteMap);
      this.entiteMap.set(entiteMap);
      this.pieces.set(pieces);
      this.journal.set(journal);
      this.chronoDossier.set(chrono);
      this.modeMap.set(modeMap);
      this.natureMap.set(natureMap);
      this.modesRef.set(modesRef);
      this.capmsRef.set(capmsRef);
      this.soaMap.set(soaMap);
      this.compteMap.set(compteMap);
      this.capmMap.set(capmMap);
      this.ppm.set(ppms.find((p) => p.idDossier === id) ?? null);
      const mine = marches.filter((m) => m.idDossier === id);
      this.marches.set(mine);
      // Bénéficiaires + dates : ne garder que ceux des marchés du dossier (pas de filtre par dossier côté API).
      const detailIds = new Set(mine.map((m) => m.idDetail));
      this.serviceBenefs.set(benefs.filter((b) => detailIds.has(b.idDetail)));
      this.previsions.set(previsions.filter((p) => detailIds.has(p.idDetail)));
      this.loading.set(false);
    });
  }

  /** Télécharge et ouvre une pièce jointe dans un nouvel onglet (lecture seule). */
  ouvrirPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) {
      return;
    }
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (blob) => ouvrirBlobSur(blob),
      error: () => this.toast.error("Impossible d'ouvrir la pièce."),
    });
  }

  modeLabel(id?: number): string {
    return id === null || id === undefined ? '—' : this.modeMap().get(String(id)) ?? `#${id}`;
  }
  montant(v?: number): string {
    return v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
  /** Services bénéficiaires d'un marché (lecture seule). */
  benefsDe(idDetail: number): ServiceBeneficiaire[] {
    return this.benefParDetail().get(idDetail) ?? [];
  }
  /** Libellé du service bénéficiaire (code SOA + libellé si connu). */
  soaLabel(code?: string): string {
    if (!code) return '—';
    const lib = this.soaMap().get(code);
    return lib ? `${code} · ${lib}` : code;
  }
  /** Libellé du compte budgétaire (numéro + libellé si connu). */
  compteLabel(num?: string): string {
    if (!num) return '—';
    const lib = this.compteMap().get(num);
    return lib ? `${num} · ${lib}` : num;
  }
  /** Dates prévisionnelles d'un marché (triées par ordre CAPM). */
  datesDe(idDetail: number): MarchePrevision[] {
    return this.prevParDetail().get(idDetail) ?? [];
  }
  /** Libellé du processus CAPM (LANCEMENT / OUVERTURE / ATTRIBUTION…). */
  capmLabel(id?: number): string {
    return id === null || id === undefined ? '—' : this.capmMap().get(String(id)) ?? `#${id}`;
  }
}
