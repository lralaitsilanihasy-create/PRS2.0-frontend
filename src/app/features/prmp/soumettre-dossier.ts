import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { DetailPpmModal } from '../../shared/prmp/detail-ppm-modal';
import { PpmFormFactory } from '../../shared/prmp/ppm-form-factory';
import { PpmSaisieGrid } from '../../shared/prmp/ppm-saisie-grid';
import { AnomalieTranscription, Capm, Compte, Dossier, FormeMarche, Marche, ModePassation, Nature, SaisieImportMarche, SaisieMarcheLigne, SaisieMarcheLot, SaisiePpmImportResult, SoaBeneficiaire, SousTypeDossier, TypePieceJointe } from '../../models';
import {
  CapmService,
  CompteService,
  DossierService,
  EntiteContractService,
  LocaliteService,
  MarcheService,
  ModePassationService,
  NatureService,
  PieceJointeDossierService,
  PpmService,
  PrmpEntiteService,
  PrmpService,
  ReferenceLookupService,
  SaisieService,
  SoaBeneficiaireService,
  SousTypeDossierService,
  TypePieceJointeService,
} from '../../services';

type Phase = 'choix' | 'saisiePpm' | 'saisieDossier' | 'brouillon';

/**
 * Famille de dossier hors planification (référentiel `type-dossiers`) : `DMC` (mise en concurrence)
 * ou `DDM` (marché). La famille DDP (planification) a son propre flux (saisie PPM) ; les sous-types
 * (DAO, DAOR, MAOO, MAOR…) viennent du référentiel serveur `sous-type-dossiers` (par-famille).
 */
type FamilleDossier = 'DMC' | 'DDM';

/** Bénéficiaire d'un marché dans l'aperçu (snapshot lecture seule du formulaire). */
interface ApercuBenef {
  soaCode?: string;
  numCompte?: string;
  ancMontBenef?: number | null;
  nouvMontBenef?: number | null;
}
/** Marché dans l'aperçu — colonnes du PPM officiel (snapshot lecture seule du formulaire). */
interface ApercuMarche {
  natureLibelle?: string;
  designationMarche?: string;
  montEstim?: number | null;
  nouvMontEstim?: number | null;
  modeLibelle?: string;
  financement?: string;
  /** Lignes bénéficiaires (au moins 1 ; placeholder vide si aucun) — pilote le rowspan des colonnes marché. */
  benefRows: ApercuBenef[];
  /** Dates prévisionnelles (date de début) par jalon, format dd/MM/yyyy. */
  dateLancement: string;
  dateOuverture: string;
  dateAttribution: string;
  coherenceErr: string | null;
  sansDates: boolean;
}
/** Snapshot du dossier PPM à créer, mis en forme comme le PPM officiel (aucune création). */
interface ApercuDossier {
  entite: string;
  adresse: string;
  localite: string;
  exercice: number | null;
  signataire: string;
  dateSignature: string;
  marches: ApercuMarche[];
  pieces: { libelle: string; nom: string }[];
}

/**
 * Parcours de saisie & soumission PRMP (§3.1, Modules 02-03).
 *
 * Saisir = créer un dossier BROUILLON via la façade /api/saisies (POST /dossiers & /ppms
 * sont réservés ADMIN). Le brouillon est éditable (lignes de marché : /api/marches) tant
 * qu'il n'est pas soumis ; « Soumettre » (/dossiers/{id}/soumettre) le passe SOUMIS,
 * génère la référence et notifie le Secrétaire/CC, puis on redirige vers le suivi.
 *
 * Le backend reste l'autorité (403 propriété/rôle, 409 statut ou cohérence type↔contenu,
 * 400 validation) ; erreurs via l'intercepteur centralisé, fieldErrors 400 sous les champs.
 */
@Component({
  selector: 'app-soumettre-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DetailPpmModal, PpmSaisieGrid],
  template: `
    <section class="sd">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Saisir &amp; soumettre un dossier</h1>
        </div>
      </header>

      @switch (phase()) {
        @case ('choix') {
          <div class="alert alert-info">
            « Saisir » crée un dossier en <strong>brouillon</strong> : invisible des contrôleurs
            jusqu'à la soumission. Choisissez ce que vous souhaitez saisir.
          </div>
          <div class="sd__choix">
            <button type="button" class="sd__choix-card sd__choix-card--plan" (click)="choisirPpm()">
              <span class="sd__choix-head">
                <span class="sd__choix-ic" aria-hidden="true">📄</span>
                <span class="sd__choix-titre">Dossier de planification</span>
              </span>
              <span class="sd__choix-desc">PPM — Plan de passation des marchés : lignes de marché, bénéficiaires, dates prévisionnelles et lots.</span>
              <span class="sd__choix-go">Commencer<span class="sd__choix-arrow" aria-hidden="true">›</span></span>
            </button>
            <button type="button" class="sd__choix-card sd__choix-card--concurrence" (click)="choisirFamille('DMC')">
              <span class="sd__choix-head">
                <span class="sd__choix-ic" aria-hidden="true">📢</span>
                <span class="sd__choix-titre">Dossier de mise en concurrence</span>
              </span>
              <span class="sd__choix-desc">Appel d'offres, consultation… — un type + une localité. Pièces jointes selon le type choisi.</span>
              <span class="sd__choix-go">Commencer<span class="sd__choix-arrow" aria-hidden="true">›</span></span>
            </button>
            <button type="button" class="sd__choix-card sd__choix-card--marche" (click)="choisirFamille('DDM')">
              <span class="sd__choix-head">
                <span class="sd__choix-ic" aria-hidden="true">📝</span>
                <span class="sd__choix-titre">Dossier de marché</span>
              </span>
              <span class="sd__choix-desc">Marché / contrat — un type + une localité. Pièces jointes selon le type choisi.</span>
              <span class="sd__choix-go">Commencer<span class="sd__choix-arrow" aria-hidden="true">›</span></span>
            </button>
          </div>
        }

        @case ('saisiePpm') {
          <form class="card sd__form sd__form--wide cnm-form" [formGroup]="ppmForm" (ngSubmit)="creerPpm()" novalidate>
            <div class="sd__import">
              <label class="btn btn-outline btn-sm sd__import-btn">
                📄 {{ importe() ? 'Changer le PDF' : 'Importer un PPM (PDF)' }}
                <input type="file" accept=".pdf,application/pdf" hidden (change)="importerPpm($event)" [disabled]="importing()" />
              </label>
              @if (importe()) {
                <button type="button" class="btn btn-sm sd__reset-btn" (click)="reinitialiserImport()">↺ Réinitialiser l'import</button>
              }
              @if (importing()) { <span class="cnm-muted">Analyse du PDF…</span> }
              <span class="form-hint">Pré-remplit le formulaire depuis un PPM PDF officiel — à vérifier avant création.</span>
            </div>
            @if (importAvertissements().length) {
              <div class="alert alert-warning">
                <div class="sd__warn-title">Import — points à vérifier</div>
                <ul class="sd__warn-list">
                  @for (a of importAvertissements(); track $index) { <li>{{ a }}</li> }
                </ul>
              </div>
            }
            @if (soaInconnus().length) {
              <div class="alert alert-warning sd__soa">
                <div class="sd__warn-title">Services bénéficiaires (SOA) inconnus au référentiel — {{ soaInconnus().length }}</div>
                <p class="sd__hint">Saisissez leur libellé et enregistrez-les au référentiel (réutilisables ensuite). À défaut, ils seront créés automatiquement à la soumission, sans libellé.</p>
                @for (code of soaInconnus(); track code) {
                  <div class="sd__soa-row">
                    <span class="sd__soa-code">{{ code }}</span>
                    <input class="form-control" type="text" [value]="soaLibelle(code)" (input)="setSoaLibelle(code, $any($event.target).value)" placeholder="Libellé du service bénéficiaire" maxlength="100" />
                    <button type="button" class="btn btn-primary btn-sm" [disabled]="soaCreating() === code || !soaLibelle(code).trim()" (click)="creerSoa(code)">
                      {{ soaCreating() === code ? 'Enregistrement…' : 'Enregistrer' }}
                    </button>
                  </div>
                }
              </div>
            }
            @if (entiteAResoudre()) {
              <div class="alert alert-warning sd__soa">
                <div class="sd__warn-title">Entité contractante à sélectionner</div>
                <p class="sd__hint">
                  @if (autoriteImportee()) { Entité lue dans le PDF : « <strong>{{ autoriteImportee() }}</strong> » — non résolue automatiquement. }Choisissez l'entité contractante parmi les vôtres.
                </p>
                @if (entites().length) {
                  <div class="sd__soa-row">
                    <select class="form-control" (change)="choisirEntite($any($event.target).value)">
                      <option value="">— Sélectionner —</option>
                      @for (e of entites(); track e.idEntiteContract) {
                        <option [value]="e.idEntiteContract" [selected]="e.idEntiteContract === selectedEntiteId()">{{ e.libelle }}</option>
                      }
                    </select>
                  </div>
                } @else {
                  <span class="form-hint">Aucune entité rattachée à votre profil PRMP — contactez l'administrateur.</span>
                }
              </div>
            }
            <div class="cnm-form-grid">
              <label class="form-group">
                <span class="form-label">Entité contractante *</span>
                <select class="form-control" formControlName="idEntiteContract">
                  <option [ngValue]="null">— Sélectionner —</option>
                  @for (e of optionsEntite(); track e.idEntiteContract) {
                    <option [ngValue]="e.idEntiteContract">{{ e.libelle }}</option>
                  }
                </select>
                @if (req(ppmForm, 'idEntiteContract')) { <span class="form-error">Obligatoire.</span> }
                @if (err('idEntiteContract')) { <span class="form-error">{{ err('idEntiteContract') }}</span> }
                @if (!entites().length) { <span class="form-hint">Aucune entité rattachée à votre profil PRMP.</span> }
              </label>
              <label class="form-group">
                <span class="form-label">Localité (dérivée de l'entité)</span>
                <input class="form-control" type="text" [value]="localiteLabel()" readonly disabled />
                <span class="form-hint">Le dossier sera déposé dans cette localité.</span>
              </label>
              <label class="form-group">
                <span class="form-label">Exercice *</span>
                <input class="form-control" type="number" formControlName="exercice" />
                @if (req(ppmForm, 'exercice')) { <span class="form-error">Obligatoire.</span> }
                @if (err('exercice')) { <span class="form-error">{{ err('exercice') }}</span> }
              </label>
              <label class="form-group">
                <span class="form-label">Signataire</span>
                <input class="form-control" type="text" [value]="signataireConnecte()" readonly />
                <span class="form-hint">Renseigné automatiquement depuis votre profil PRMP.</span>
              </label>
              <label class="form-group">
                <span class="form-label">Date de signature *</span>
                <input class="form-control" type="date" formControlName="dateSignature" />
                @if (req(ppmForm, 'dateSignature')) { <span class="form-error">Obligatoire.</span> }
                @if (err('dateSignature')) { <span class="form-error">{{ err('dateSignature') }}</span> }
              </label>
            </div>

            <!-- Grille de saisie riche partagée (soumission ET réimport du détail PPM) : table éditable,
                 revue de transcription (bandeaux + surlignage), validation par ligne, modals CAPM & Lots. -->
            <app-ppm-saisie-grid
              [marches]="marchesArray"
              [natures]="natures()"
              [modesList]="modesList()"
              [comptes]="comptes()"
              [soaList]="soaList()"
              [capms]="capms()"
              [anomaliesParLigne]="anomaliesParLigne()"
              [mode]="importe() ? 'import' : 'manuel'"
            />

            <div class="sd__pieces">
              <h2 class="sd__sub">Pièces jointes</h2>
              @if (!typesPiece().length) {
                <p class="cnm-muted">Aucune pièce attendue pour ce type de dossier.</p>
              }
              @for (t of typesPiece(); track t.idTypePiece) {
                <div class="sd__piece" [class.sd__piece--manquante]="t.obligatoire && !pieces().has(t.idTypePiece)">
                  <span class="sd__piece-lbl">📎 {{ t.libellePiece }}</span>
                  <div class="sd__piece-right">
                    @if (t.obligatoire) {
                      <span class="badge badge-danger">obligatoire</span>
                    } @else if (t.code === 'AGPM' && agpmRequisSaisie()) {
                      <span class="badge badge-warning">requise (appel d'offres ouvert)</span>
                    } @else {
                      <span class="badge badge-neutral">optionnel</span>
                    }
                    @if (pieceNom(t.idTypePiece); as nom) {
                      <span class="sd__piece-file">{{ nom }} · {{ pieceTaille(t.idTypePiece) }}</span>
                      <button type="button" class="btn btn-secondary btn-sm" (click)="retirerPiece(t.idTypePiece)" aria-label="Retirer">✕</button>
                    } @else {
                      <label class="btn btn-secondary btn-sm sd__piece-choisir">
                        Choisir
                        <input type="file" accept=".pdf,.jpeg,.jpg,.png" hidden (change)="onPiece(t.idTypePiece, $event)" />
                      </label>
                    }
                  </div>
                  @if (pieceErreurs().has(t.idTypePiece)) {
                    <span class="form-error sd__piece-err">Cette pièce est obligatoire.</span>
                  }
                </div>
              }
              <p class="sd__hint cnm-muted">Formats acceptés : PDF, JPEG, PNG.</p>
            </div>

            @if (piecesObligatoiresManquantes().length) {
              <div class="alert alert-warning">
                <span aria-hidden="true">⚠</span>
                <div>
                  <div class="sd__warn-title">Pièces obligatoires manquantes</div>
                  <ul class="sd__warn-list">
                    @for (p of piecesObligatoiresManquantes(); track p.idTypePiece) {
                      <li>{{ p.libellePiece }}</li>
                    }
                  </ul>
                </div>
              </div>
            }

            @if (agpmManquanteSaisie()) {
              <div class="alert alert-info">
                <span aria-hidden="true">ℹ️</span>
                <div>Un marché est saisi en « appel d'offres ouvert » : la pièce <strong>AGPM</strong>
                  (Avis Général de Passation de Marché) sera <strong>exigée à la soumission</strong>.
                  Le brouillon peut être créé sans elle ; joignez-la avant de soumettre.</div>
              </div>
            }

            <footer class="sd__foot">
              <button type="button" class="btn btn-outline" (click)="retourChoix()">Retour</button>
              <button type="button" class="btn btn-secondary" (click)="ouvrirApercu()">Aperçu</button>
              <button type="submit" class="btn btn-primary" [disabled]="submitting() || !ppmFormValide || !benefsCoherents || (grid()?.nbAValiderRestantes() ?? 0) > 0">
                {{ submitting() ? 'Création…' : 'Créer le dossier' }}
              </button>
            </footer>
          </form>
        }

        @case ('saisieDossier') {
          <form class="card sd__form cnm-form" [formGroup]="dossierForm" (ngSubmit)="creerDossier()" novalidate>
            <div class="alert alert-info">Dossier de <strong>{{ familleLabel() }}</strong>. Choisissez le sous-type précis parmi ceux de cette famille.</div>
            <div class="cnm-form-grid">
              <label class="form-group">
                <span class="form-label">Sous-type de dossier *</span>
                <select class="form-control" formControlName="idSousType">
                  <option [ngValue]="null">— Sélectionner —</option>
                  @for (t of sousTypesDeLaFamille(); track t.idSousType) {
                    <option [ngValue]="t.idSousType">{{ t.libelleSousType || t.idSousType }}</option>
                  }
                </select>
                @if (req(dossierForm, 'idSousType')) { <span class="form-error">Obligatoire.</span> }
                @if (err('idSousType')) { <span class="form-error">{{ err('idSousType') }}</span> }
                @if (!sousTypesDeLaFamille().length) { <span class="form-hint">Aucun sous-type dans la famille « {{ familleLabel() }} » (référentiel « Sous-types de dossier »).</span> }
              </label>
              <label class="form-group">
                <span class="form-label">Entité contractante *</span>
                <select class="form-control" formControlName="idEntiteContract">
                  <option [ngValue]="null">— Sélectionner —</option>
                  @for (e of entites(); track e.idEntiteContract) {
                    <option [ngValue]="e.idEntiteContract">{{ e.libelle }}</option>
                  }
                </select>
                @if (req(dossierForm, 'idEntiteContract')) { <span class="form-error">Obligatoire.</span> }
                @if (!entites().length) { <span class="form-hint">Aucune entité rattachée à votre profil PRMP.</span> }
              </label>
              <label class="form-group">
                <span class="form-label">Localité (dérivée de l'entité)</span>
                <input class="form-control" type="text" [value]="localiteLabel()" readonly disabled />
                <span class="form-hint">Le dossier sera déposé dans cette localité.</span>
              </label>
            </div>

            <!-- Pièces jointes : rattachées à la FAMILLE (référentiel type-piece-jointes), connues dès l'entrée. -->
            <div class="sd__pieces">
              <h2 class="sd__sub">Pièces jointes</h2>
              @if (!typesPiece().length) {
                <p class="cnm-muted">Aucune pièce attendue pour cette famille de dossier.</p>
              }
                @for (t of typesPiece(); track t.idTypePiece) {
                  <div class="sd__piece" [class.sd__piece--manquante]="t.obligatoire && !pieces().has(t.idTypePiece)">
                    <span class="sd__piece-lbl">📎 {{ t.libellePiece }}</span>
                    <div class="sd__piece-right">
                      @if (t.obligatoire) {
                        <span class="badge badge-danger">obligatoire</span>
                      } @else {
                        <span class="badge badge-neutral">optionnel</span>
                      }
                      @if (pieceNom(t.idTypePiece); as nom) {
                        <span class="sd__piece-file">{{ nom }} · {{ pieceTaille(t.idTypePiece) }}</span>
                        <button type="button" class="btn btn-secondary btn-sm" (click)="retirerPiece(t.idTypePiece)" aria-label="Retirer">✕</button>
                      } @else {
                        <label class="btn btn-secondary btn-sm sd__piece-choisir">
                          Choisir
                          <input type="file" accept=".pdf,.jpeg,.jpg,.png" hidden (change)="onPiece(t.idTypePiece, $event)" />
                        </label>
                      }
                    </div>
                    @if (pieceErreurs().has(t.idTypePiece)) {
                      <span class="form-error sd__piece-err">Cette pièce est obligatoire.</span>
                    }
                  </div>
                }
                <p class="sd__hint cnm-muted">Formats acceptés : PDF, JPEG, PNG. Déposées après création du brouillon.</p>
              </div>
              @if (piecesObligatoiresManquantes().length) {
                <div class="alert alert-warning">
                  <span aria-hidden="true">⚠</span>
                  <div>
                    <div class="sd__warn-title">Pièces obligatoires manquantes</div>
                    <ul class="sd__warn-list">
                      @for (p of piecesObligatoiresManquantes(); track p.idTypePiece) {
                        <li>{{ p.libellePiece }}</li>
                      }
                    </ul>
                  </div>
                </div>
              }

            <footer class="sd__foot">
              <button type="button" class="btn btn-outline" (click)="retourChoix()">Retour</button>
              <button type="submit" class="btn btn-primary" [disabled]="submitting() || piecesObligatoiresManquantes().length">
                {{ submitting() ? 'Création…' : 'Créer le dossier' }}
              </button>
            </footer>
          </form>
        }

        @case ('brouillon') {
          @if (dossier(); as d) {
            @if (estPpm() && createdPpmId() !== null) {
              <!-- PPM : rendu et édition via le modal de détail partagé (même design que l'écran de détail). -->
              <app-detail-ppm-modal
                [idDossier]="d.idDossier"
                [idPpm]="createdPpmId()!"
                [modeEdition]="true"
                [soumissible]="estPrmp()"
                (fermer)="retourChoix()"
                (soumettre)="soumettre()"
                (modifie)="rechargerMarches()"
              />
            } @else {
              <!-- DAO/MAOO : pas de PPM ni de lignes de marché. -->
              <div class="card sd__brouillon">
                <div class="sd__brouillon-head">
                  <div>
                    <span class="badge badge-warning">BROUILLON</span>
                    <span class="sd__brouillon-id">Dossier #{{ d.idDossier }} · {{ d.idTypeDossier || '—' }}</span>
                  </div>
                  <span class="cnm-muted">Localité : {{ d.idLocalite || '—' }}</span>
                </div>
                <p class="sd__warn cnm-muted">
                  Ce brouillon est éditable tant qu'il n'est pas soumis. Vous pourrez le retrouver
                  dans « Mes brouillons » pour le reprendre plus tard.
                </p>
                <footer class="sd__foot sd__foot--main">
                  <button type="button" class="btn btn-outline" (click)="retourChoix()">Retour</button>
                  <!-- Soumission réservée à la PRMP ; l'UGPM édite le brouillon mais ne soumet pas (backend 403). -->
                  @if (estPrmp()) {
                    <button type="button" class="btn btn-success" [disabled]="submitting()" (click)="soumettre()">
                      Soumettre le dossier
                    </button>
                  }
                </footer>
              </div>
            }
          }
        }
      }

      @if (apercu(); as a) {
        <div class="modal-backdrop" (click)="fermerApercu()">
          <div class="modal sd__apercu cnm-form" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
            <div class="modal-header-plain">
              <span class="modal-title">Aperçu du dossier à créer</span>
              <button type="button" class="btn btn-secondary btn-sm" (click)="fermerApercu()" aria-label="Fermer">✕</button>
            </div>
            <div class="modal-body">
              <div class="ppm-doc">
                <h1 class="ppm-doc__titre">PLAN DE PASSATION DES MARCHES POUR L'ANNEE {{ a.exercice ?? '____' }}</h1>
                <div class="ppm-doc__entete">
                  <div>
                    <p><u>Autorité Contractante</u> : <strong>{{ a.entite }}</strong></p>
                    <p><u>Nom de la PRMP</u> : <strong>{{ a.signataire || '—' }}</strong></p>
                    <p><u>Adresse</u> : <strong>{{ a.adresse }}</strong></p>
                  </div>
                  <div>
                    <p><u>Date d'établissement du Document initial</u> : {{ a.dateSignature || '—' }}</p>
                    <p><u>Numéro et date de la dernière mise à jour</u> : 0</p>
                    <p><u>Numéro de la présente mise à jour</u> : 0</p>
                  </div>
                </div>

                <div class="ppm-doc__table-wrap">
                  <table class="ppm-doc__table">
                    <colgroup>
                      <col style="width: 6%" /><col style="width: 18%" /><col style="width: 8%" /><col style="width: 8%" />
                      <col style="width: 8%" /><col style="width: 5%" /><col style="width: 8%" /><col style="width: 5%" />
                      <col style="width: 8%" /><col style="width: 8%" /><col style="width: 6%" /><col style="width: 6%" /><col style="width: 6%" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowspan="2">NATURE</th>
                        <th rowspan="2">OBJET</th>
                        <th rowspan="2">MONTANT ESTIMATIF INITIAL</th>
                        <th rowspan="2">NOUVEAU MONTANT ESTIMATIF</th>
                        <th rowspan="2">MODE DE PASSATION</th>
                        <th rowspan="2">FINANCEMENT</th>
                        <th colspan="4">Informations sur le Bénéficiaire</th>
                        <th rowspan="2">DATE PREVISIONNELLE DE LANCEMENT</th>
                        <th rowspan="2">DATE PREVISIONNELLE OUVERTURE DES PLIS</th>
                        <th rowspan="2">DATE PREVISIONNELLE D'ATTRIBUTION</th>
                      </tr>
                      <tr>
                        <th>SERVICE BENEFICIAIRE</th>
                        <th>COMPTE</th>
                        <th>MONTANT ESTIMATIF PAR BENEFICIAIRE</th>
                        <th>NOUVEAU MONTANT ESTIMATIF PAR BENEFICIAIRE</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (m of a.marches; track $index) {
                        @for (b of m.benefRows; track $index; let first = $first) {
                          <tr>
                            @if (first) {
                              <td [attr.rowspan]="m.benefRows.length">{{ m.natureLibelle || '' }}</td>
                              <td [attr.rowspan]="m.benefRows.length" class="ppm-doc__objet">{{ m.designationMarche || '' }}</td>
                              <td [attr.rowspan]="m.benefRows.length" class="ppm-doc__num">{{ montantFmt(m.montEstim) }}</td>
                              <td [attr.rowspan]="m.benefRows.length" class="ppm-doc__num">{{ montantFmt(m.nouvMontEstim) }}</td>
                              <td [attr.rowspan]="m.benefRows.length">{{ m.modeLibelle || '' }}</td>
                              <td [attr.rowspan]="m.benefRows.length">{{ m.financement || '' }}</td>
                            }
                            <td>{{ b.soaCode || '' }}</td>
                            <td>{{ b.numCompte || '' }}</td>
                            <td class="ppm-doc__num">{{ montantFmt(b.ancMontBenef) }}</td>
                            <td class="ppm-doc__num">{{ montantFmt(b.nouvMontBenef) }}</td>
                            @if (first) {
                              <td [attr.rowspan]="m.benefRows.length" class="ppm-doc__date">{{ m.dateLancement }}</td>
                              <td [attr.rowspan]="m.benefRows.length" class="ppm-doc__date">{{ m.dateOuverture }}</td>
                              <td [attr.rowspan]="m.benefRows.length" class="ppm-doc__date">{{ m.dateAttribution }}</td>
                            }
                          </tr>
                        }
                      } @empty {
                        <tr><td colspan="13" class="cnm-muted">Aucun marché saisi.</td></tr>
                      }
                    </tbody>
                  </table>
                </div>

                <div class="ppm-doc__pied">
                  <p>Fait à ______________________________, le _ _ /_ _ /_ _ _ _</p>
                  <p class="ppm-doc__prmp">LA PERSONNE RESPONSABLE DES MARCHES PUBLICS</p>
                  <p><strong>{{ a.signataire || '' }}</strong></p>
                </div>
              </div>

              @if (apercuAvertissements(a).length) {
                <div class="alert alert-warning sd__ap-alertes">
                  <span aria-hidden="true">⚠</span>
                  <ul class="sd__warn-list">
                    @for (w of apercuAvertissements(a); track $index) { <li>{{ w }}</li> }
                  </ul>
                </div>
              }

              @if (a.pieces.length) {
                <p class="sd__ap-pieces"><strong>Pièces jointes :</strong> {{ piecesLabel(a) }}</p>
              } @else {
                <p class="sd__ap-pieces cnm-muted">Aucune pièce jointe fournie.</p>
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline" (click)="fermerApercu()">Fermer</button>
              <button type="button" class="btn btn-primary" [disabled]="submitting() || !ppmFormValide || !benefsCoherents || (grid()?.nbAValiderRestantes() ?? 0) > 0" (click)="fermerApercu(); creerPpm()">
                Créer le dossier
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .sd__brouillon { padding: 1.25rem 1.5rem; }
    /* Cartes de choix (PPM / DAO-MAOO) : style carte moderne, bandeau et pastille d'accent, relief au survol. */
    .sd__choix { display: grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); gap: 1.1rem; }
    .sd__choix-card {
      position: relative; overflow: hidden;
      text-align: left; cursor: pointer; font: inherit;
      background: #fff; border: 1px solid var(--n-200); border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 1.4rem 1.5rem 1.15rem;
      display: flex; flex-direction: column; gap: 0.65rem; min-height: 11rem;
      transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }
    /* Bandeau d'accent coloré en haut de carte (distinct par type). */
    .sd__choix-card::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 4px; background: var(--grad-primary); }
    .sd__choix-card--concurrence::before { background: linear-gradient(135deg, #0ea5e9, #14b8a6); }
    .sd__choix-card--marche::before { background: linear-gradient(135deg, #f59e0b, #f97316); }
    .sd__choix-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: var(--c-300); }
    .sd__choix-head { display: flex; align-items: center; gap: 0.8rem; }
    .sd__choix-ic {
      width: 2.75rem; height: 2.75rem; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: var(--radius-md); font-size: 1.3rem;
      background: var(--grad-primary); color: #fff;
      box-shadow: 0 3px 10px rgba(102, 126, 234, 0.35);
    }
    .sd__choix-card--concurrence .sd__choix-ic { background: linear-gradient(135deg, #0ea5e9, #14b8a6); box-shadow: 0 3px 10px rgba(20, 184, 166, 0.35); }
    .sd__choix-card--marche .sd__choix-ic { background: linear-gradient(135deg, #f59e0b, #f97316); box-shadow: 0 3px 10px rgba(249, 115, 22, 0.32); }
    .sd__choix-titre { font-size: var(--text-lg); font-weight: 700; color: var(--n-800); }
    .sd__choix-desc { color: var(--n-500); font-size: var(--text-sm); line-height: 1.5; }
    .sd__choix-go { margin-top: auto; display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 700; font-size: var(--text-sm); color: var(--c-600); }
    .sd__choix-card--concurrence .sd__choix-go { color: #0d9488; }
    .sd__choix-card--marche .sd__choix-go { color: #c2620c; }
    .sd__choix-arrow { font-size: 1.15rem; line-height: 1; transition: transform 0.16s ease; }
    .sd__choix-card:hover .sd__choix-arrow { transform: translateX(4px); }
    @media (max-width: 40rem) { .sd__choix { grid-template-columns: 1fr; } }
    .sd__form { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; max-width: min(64rem, 96vw); }
    .sd__form--wide { max-width: min(100rem, 98vw); }
    .sd__import { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; padding-bottom: 0.75rem; border-bottom: 1px solid var(--c-100); }
    /* Bouton d'import mis en avant : dégradé chaud distinct du primaire (violet), lueur douce + relief au survol. */
    .sd__import-btn {
      cursor: pointer;
      color: #fff;
      border: none;
      font-weight: 700;
      letter-spacing: 0.01em;
      background: linear-gradient(135deg, #f59e0b, #f97316 55%, #ef4444);
      box-shadow: 0 4px 14px rgba(249, 115, 22, 0.45);
      transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
      animation: sd-import-glow 2.6s ease-in-out infinite;
    }
    .sd__import-btn:hover {
      color: #fff;
      filter: brightness(1.06);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(249, 115, 22, 0.58);
    }
    @keyframes sd-import-glow {
      0%, 100% { box-shadow: 0 4px 14px rgba(249, 115, 22, 0.38); }
      50% { box-shadow: 0 4px 22px rgba(249, 115, 22, 0.62); }
    }
    @media (prefers-reduced-motion: reduce) { .sd__import-btn { animation: none; } }
    /* Bouton « Réinitialiser l'import » : vert. */
    .sd__reset-btn { cursor: pointer; color: #fff; border: none; font-weight: 700; background: linear-gradient(135deg, #059669, #10b981); box-shadow: 0 3px 10px rgba(16, 185, 129, 0.35); transition: filter 0.15s ease, transform 0.15s ease; }
    .sd__reset-btn:hover { color: #fff; filter: brightness(1.06); transform: translateY(-1px); }
    .sd__hint { margin: 0; }
    .sd__pieces { display: flex; flex-direction: column; gap: 0.5rem; }
    .sd__piece { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
    .sd__piece-lbl { font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sd__piece-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
    .sd__piece-file { font-size: var(--text-sm); color: var(--n-500); }
    .sd__piece-choisir { cursor: pointer; }
    .sd__piece-err { color: var(--danger-text); flex-basis: 100%; }
    .sd__piece--manquante { background: #fff8f8; border-left: 2.5px solid var(--danger-text); padding-left: 8px; border-radius: var(--radius-sm); }
    .sd__warn-title { font-weight: 600; margin-bottom: 4px; }
    .sd__warn-list { margin: 0; padding-left: 1rem; font-size: var(--text-sm); }
    /* Panneau des SOA inconnus : une ligne par code (code + libellé + enregistrer au référentiel). */
    .sd__soa { display: flex; flex-direction: column; gap: 0.4rem; }
    .sd__soa-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .sd__soa-code { font-weight: 700; flex: 0 0 auto; min-width: 11rem; }
    .sd__soa-row .form-control { flex: 1 1 14rem; min-width: 10rem; }
    .sd__foot { display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px solid var(--c-100); padding-top: 1rem; }
    .sd__foot--main { margin-top: 1rem; }
    .sd__soumettre-hint { margin-right: auto; align-self: center; }
    .sd__brouillon-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.5rem; }
    .sd__brouillon-id { margin-left: 0.5rem; font-weight: 700; }
    .sd__warn { margin: 0 0 1rem; }
    .sd__sub { margin: 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .sd__apercu { max-width: min(112rem, 98vw); max-height: 92vh; display: flex; flex-direction: column; }
    .sd__apercu .modal-body { overflow-y: auto; }
    .ppm-doc { background: #fff; color: #000; padding: 1rem 1.25rem; font-size: 0.8rem; }
    .ppm-doc__titre { text-align: center; font-size: 1.1rem; font-weight: 700; margin: 0 0 1rem; text-transform: uppercase; }
    .ppm-doc__entete { display: flex; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
    .ppm-doc__entete p { margin: 0.15rem 0; }
    .ppm-doc__table-wrap { overflow-x: auto; }
    /* table-layout: fixed + colgroup en % → le tableau tient dans la fenêtre ; le contenu long (OBJET) revient à la ligne au lieu de déborder. */
    .ppm-doc__table { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 0.72rem; }
    .ppm-doc__table th, .ppm-doc__table td { border: 1px solid #000; padding: 3px 5px; vertical-align: top; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
    .ppm-doc__table th { text-align: center; font-weight: 700; background: #f0f0f0; }
    .ppm-doc__num { text-align: right; }
    .ppm-doc__date { text-align: center; white-space: nowrap; }
    .ppm-doc__objet { white-space: pre-wrap; }
    .ppm-doc__pied { margin-top: 1.75rem; text-align: right; }
    .ppm-doc__pied p { margin: 0.2rem 0; }
    .ppm-doc__prmp { margin-top: 1rem; font-weight: 700; text-transform: uppercase; }
    .sd__ap-alertes { margin-top: 1rem; }
    .sd__ap-pieces { margin-top: 0.75rem; font-size: var(--text-sm); }
    .confirm-modal { max-width: 36rem; }
    .table-card td { white-space: normal; }
  `,
})
export class SoumettreDossier {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly saisie = inject(SaisieService);
  private readonly dossierService = inject(DossierService);
  private readonly marcheService = inject(MarcheService);
  private readonly ppmService = inject(PpmService);
  private readonly prmpEntiteService = inject(PrmpEntiteService);
  private readonly prmpService = inject(PrmpService);
  private readonly capmService = inject(CapmService);
  private readonly typePieceService = inject(TypePieceJointeService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly entiteContractService = inject(EntiteContractService);
  private readonly sousTypeService = inject(SousTypeDossierService);
  private readonly natureService = inject(NatureService);
  private readonly modeService = inject(ModePassationService);
  private readonly compteService = inject(CompteService);
  private readonly soaService = inject(SoaBeneficiaireService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly factory = inject(PpmFormFactory);
  /** Grille de saisie partagée (rendue en phase « saisie ») — lue pour la garde de validation « Créer ». */
  readonly grid = viewChild(PpmSaisieGrid);

  readonly phase = signal<Phase>('choix');
  readonly submitting = signal(false);
  readonly formError = signal<ApiError | null>(null);

  private readonly localiteMap = signal<Map<string, string>>(new Map());
  readonly natures = signal<Nature[]>([]);
  readonly modesList = signal<ModePassation[]>([]);
  readonly comptes = signal<Compte[]>([]);
  readonly soaList = signal<SoaBeneficiaire[]>([]);
  /** Libellés saisis pour les SOA inconnus (clé = soaCode). */
  readonly soaLibelles = signal<Map<string, string>>(new Map());
  /** Code SOA dont la création au référentiel est en cours (null = aucune). */
  readonly soaCreating = signal<string | null>(null);
  /**
   * Codes SOA (distincts) des bénéficiaires importés absents du référentiel → à créer via le panneau
   * (`POST /api/soa-beneficiaires`, ouvert à tout authentifié). Nature/mode/compte = ADMINISTRATEUR,
   * donc non créables ici (résolus/créés à la volée au POST).
   */
  readonly soaInconnus = computed<string[]>(() => {
    if (!this.importe()) return [];
    const connus = new Set(this.soaList().map((s) => s.soaCode));
    const inconnus = new Set<string>();
    for (const g of this.marcheControls()) {
      for (const b of this.beneficiairesControls(g)) {
        const code = ((b.get('soaCode')?.value as string) ?? '').trim();
        if (code && !connus.has(code)) inconnus.add(code);
      }
    }
    return [...inconnus];
  });
  readonly modeMap = signal<Map<string, string>>(new Map());

  readonly dossier = signal<Dossier | null>(null);
  /** idPpm du brouillon PPM courant (créé ou repris) — alimente le DetailPpmModal en phase brouillon. */
  readonly createdPpmId = signal<number | null>(null);
  readonly marches = signal<Marche[]>([]);
  readonly ligneOuverte = signal(false);
  readonly editId = signal<number | null>(null);

  /** Entités de la PRMP courante (id, libellé, localité dérivée). */
  readonly entites = signal<{ idEntiteContract: number; libelle: string; idLocalite?: string; adresse?: string }[]>([]);
  readonly selectedEntiteId = signal<number | null>(null);
  /** Entité du PPM importé hors du périmètre PRMP — ajoutée aux options pour l'afficher/sélectionner (§3.1). */
  readonly entiteImportee = signal<{ idEntiteContract: number; libelle: string; idLocalite?: string; adresse?: string } | null>(null);
  /** Options du sélecteur d'entité = entités du PRMP + éventuelle entité importée hors périmètre. */
  readonly optionsEntite = computed(() => {
    const base = this.entites();
    const imp = this.entiteImportee();
    return imp && !base.some((e) => e.idEntiteContract === imp.idEntiteContract) ? [...base, imp] : base;
  });
  /** Nom de l'autorité contractante lue dans le PDF (contexte du panneau de résolution). */
  readonly autoriteImportee = signal<string | null>(null);
  /** Entité importée non résolue à une entité de la PRMP → panneau de sélection inline. */
  readonly entiteAResoudre = computed(
    () => this.importe() && !this.entites().some((e) => e.idEntiteContract === this.selectedEntiteId()),
  );
  /**
   * Anomalies de transcription par ligne (clé = uid du marché), calculées **à l'import** (contrat backend
   * `SaisieImportMarche.anomalies[]`, heuristique `detecterAnomalies` en repli). Transmises telles quelles à
   * la grille partagée `<app-ppm-saisie-grid>`, qui gère la revue et la validation par ligne.
   */
  readonly anomaliesParLigne = signal<Map<number, AnomalieTranscription[]>>(new Map());

  /** Famille planification = `DDP` (le sous-type PPM / PPM-AGPM est dérivé serveur, jamais saisi). */
  readonly estPpm = computed(() => this.dossier()?.idTypeDossier === 'DDP');
  /** Soumission bloquée : un PPM doit comporter au moins un marché (§3.1 M03 ; sinon 409). */
  readonly ppmSansMarche = computed(() => this.estPpm() && this.marches().length === 0);
  /** Famille de dossier hors planification choisie sur l'écran d'accueil (`DMC` / `DDM`). */
  readonly familleChoisie = signal<FamilleDossier>('DMC');
  readonly familleLabel = computed(() => (this.familleChoisie() === 'DMC' ? 'mise en concurrence' : 'marché'));
  /** Sous-types de la famille choisie (référentiel serveur, `GET /api/sous-type-dossiers/par-famille/{famille}`). */
  readonly sousTypesDeLaFamille = signal<SousTypeDossier[]>([]);
  /** Localité (lecture seule) dérivée de l'entité contractante sélectionnée. */
  readonly localiteLabel = computed(() => {
    const id = this.selectedEntiteId();
    if (id == null) return '— (sélectionnez une entité)';
    const ent = this.optionsEntite().find((e) => e.idEntiteContract === id);
    const loc = ent?.idLocalite;
    if (!loc) return '— (dérivée de l\'entité à la création)';
    return this.localiteMap().get(loc) ?? loc;
  });

  /** Seule la PRMP peut soumettre ; l'UGPM saisit/édite mais ne soumet pas (bouton masqué, backend 403). */
  readonly estPrmp = computed(() => this.auth.role() === 'PRMP');

  /** Signataire du PRMP connecté (lecture seule ; le serveur le génère, ce champ n'est qu'un aperçu). */
  readonly signataireConnecte = signal('');

  readonly ppmForm = this.fb.nonNullable.group({
    idEntiteContract: [null as number | null, Validators.required],
    exercice: [new Date().getFullYear(), Validators.required],
    dateSignature: ['', Validators.required],
    marches: this.fb.array([] as FormGroup[]),
  });

  readonly dossierForm = this.fb.nonNullable.group({
    idSousType: [null as string | null, Validators.required],
    idEntiteContract: [null as number | null, Validators.required],
  });

  /** Import PPM PDF (pré-remplissage read-only) : état d'analyse + avertissements du parsing. */
  readonly importing = signal(false);
  readonly importAvertissements = signal<string[]>([]);
  /** Vrai quand les lignes courantes proviennent d'un import PDF (pilote la revue/validation ; les champs restent éditables). */
  readonly importe = signal(false);
  /** Snapshot lecture seule du dossier à créer (aperçu) ; null = fermé. Ne crée rien. */
  readonly apercu = signal<ApercuDossier | null>(null);

  /** Référentiel CAPM (processus de marché), trié par `ordre` ASC. */
  readonly capms = signal<Capm[]>([]);
  /** Types de pièces jointes attendues (référentiel, type PPM). */
  readonly typesPiece = signal<TypePieceJointe[]>([]);
  /** Fichiers sélectionnés par type de pièce (idTypePiece → File). */
  readonly pieces = signal<Map<number, File>>(new Map());
  /** Types de pièces obligatoires manquants à la création (affichage de l'erreur). */
  readonly pieceErreurs = signal<Set<number>>(new Set());
  /** Pièces obligatoires non encore fournies (bloque la création du dossier PPM). */
  readonly piecesObligatoiresManquantes = computed(() =>
    this.typesPiece().filter((t) => t.obligatoire && !this.pieces().has(t.idTypePiece)),
  );
  /** Le formulaire PPM est-il prêt ? (champs requis valides + toutes les pièces obligatoires fournies) */
  get ppmFormValide(): boolean {
    return this.ppmForm.valid && this.piecesObligatoiresManquantes().length === 0;
  }

  // — AGPM conditionnel (hint non bloquant) : reflète la règle backend sans la dupliquer en dur. —
  /** Libellés (normalisés) des modes déclencheurs d'AGPM, d'après le référentiel des modes existants. */
  private agpmModeLabels(): Set<string> {
    return new Set(
      this.modesList().filter((m) => m.declencheAgpm).map((m) => (m.libelle ?? '').trim().toLowerCase()),
    );
  }
  /** ≥1 marché saisi avec un mode déclencheur → AGPM exigée à la soumission (règle backend). */
  agpmRequisSaisie(): boolean {
    const labels = this.agpmModeLabels();
    if (!labels.size) return false;
    return this.marcheControls().some((g) =>
      labels.has(((g.get('modeLibelle')?.value as string) ?? '').trim().toLowerCase()),
    );
  }
  /** Type de pièce AGPM (code stable) parmi les pièces attendues. */
  agpmType(): TypePieceJointe | undefined {
    return this.typesPiece().find((t) => t.code === 'AGPM');
  }
  /** AGPM requis (mode déclencheur saisi) mais pièce non fournie — avertissement non bloquant. */
  agpmManquanteSaisie(): boolean {
    const t = this.agpmType();
    return this.agpmRequisSaisie() && t != null && !this.pieces().has(t.idTypePiece);
  }

  readonly marcheForm = this.fb.nonNullable.group({
    designationMarche: [''],
    montEstim: [null as number | null],
    numCompte: [null as string | null],
    idNature: [null as number | null],
    idMode: [null as number | null],
  });

  private marcheRefsLoaded = false;

  constructor() {
    // Référentiel CAPM (processus), trié par ordre ASC — pour les selects de processus par marché.
    this.capmService.getAll().subscribe((rows) => this.capms.set([...rows].sort((a, b) => a.ordre - b.ordre)));
    // Pièces jointes attendues : rattachées à la **famille** (référentiel `type-piece-jointes`, triées
    // par ordre côté serveur). DDP chargée à l'entrée du flux ; DMC/DDM chargées à `choisirFamille`.
    this.chargerTypesPiece('DDP');
    // Signataire = PRMP connectée (lecture seule) ; le serveur le génère aussi à la création.
    const refPrmp = this.auth.ref();
    if (refPrmp) {
      this.prmpService.getById(refPrmp).subscribe({
        next: (p) => this.signataireConnecte.set(`${p.prenomsPrmp ?? ''} ${p.nomPrmp ?? ''}`.trim() || refPrmp),
        error: () => this.signataireConnecte.set(refPrmp),
      });
    }
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.chargerEntites();
    // La localité lecture seule suit l'entité sélectionnée (PPM ou DAO/MAOO).
    this.ppmForm.controls.idEntiteContract.valueChanges.subscribe((v) => this.selectedEntiteId.set(v));
    this.dossierForm.controls.idEntiteContract.valueChanges.subscribe((v) => this.selectedEntiteId.set(v));
    // Reprise d'un brouillon depuis « Mes brouillons » (?reprendre=<idDossier>).
    const reprendreId = this.route.snapshot.queryParamMap.get('reprendre');
    if (reprendreId) {
      this.dossierService.getById(Number(reprendreId)).subscribe((d) => this.reprendre(d));
    }
  }

  /** Entités contractantes de la PRMP courante (jointure liens↔entités) ; pré-sélection si unique. */
  private chargerEntites(): void {
    const ref = this.auth.ref();
    forkJoin({ liens: this.prmpEntiteService.list(), entites: this.entiteContractService.list() }).subscribe(
      ({ liens, entites }) => {
        const parId = new Map(entites.map((e) => [e.idEntiteContract, e]));
        const miennes = liens
          .filter((l) => l.idPrmp === ref && l.actif)
          .map((l) => parId.get(l.idEntiteContract))
          .filter((e): e is NonNullable<typeof e> => !!e)
          .map((e) => ({ idEntiteContract: e.idEntiteContract, libelle: e.libelleEntite, idLocalite: e.idLocalite, adresse: e.adresse }));
        this.entites.set(miennes);
        if (miennes.length === 1) {
          const id = miennes[0].idEntiteContract;
          this.ppmForm.controls.idEntiteContract.setValue(id);
          this.dossierForm.controls.idEntiteContract.setValue(id);
        }
      },
    );
  }

  // — Erreurs / requis —
  err(champ: string): string | undefined {
    return this.formError()?.fieldErrors?.[champ];
  }
  req(form: FormGroup, champ: string): boolean {
    const c = form.get(champ);
    return !!c && c.touched && c.hasError('required');
  }

  // — Chargement paresseux des référentiels —
  private ensureMarcheRefs(): void {
    if (this.marcheRefsLoaded) return;
    this.marcheRefsLoaded = true;
    this.natureService.list().subscribe((r) => this.natures.set(r));
    this.modeService.list().subscribe((r) => this.modesList.set(r));
    this.compteService.list().subscribe((r) => this.comptes.set(r));
    this.soaService.list().subscribe((r) => this.soaList.set(r));
  }

  // — Choix de la famille —
  choisirPpm(): void {
    this.formError.set(null);
    this.importe.set(false); // saisie manuelle : tableau éditable
    this.anomaliesParLigne.set(new Map());
    this.phase.set('saisiePpm');
    // Pièces attendues de la planification (le flux PPM crée toujours un dossier de famille DDP).
    this.chargerTypesPiece('DDP');
  }

  /** Ouvre la saisie d'un dossier hors planification pour la **famille** choisie (`DMC` / `DDM`). */
  choisirFamille(f: FamilleDossier): void {
    this.formError.set(null);
    this.familleChoisie.set(f);
    // Repart d'une sélection vierge : le sous-type précédent pourrait ne pas appartenir à la nouvelle famille.
    this.dossierForm.controls.idSousType.setValue(null);
    this.phase.set('saisieDossier');
    // Sous-types de la famille (référentiel serveur) — alimente le select du formulaire.
    this.sousTypesDeLaFamille.set([]);
    this.sousTypeService.parFamille(f).subscribe({
      next: (rows) => this.sousTypesDeLaFamille.set(rows),
      error: () => this.sousTypesDeLaFamille.set([]),
    });
    // Pièces attendues : rattachées à la famille (connues dès l'entrée, pas au choix du sous-type).
    this.chargerTypesPiece(f);
  }

  /**
   * Charge les pièces jointes **attendues pour une famille de dossier** (référentiel, triées serveur) et
   * **réinitialise** les fichiers déjà choisis + erreurs (les clés `idTypePiece` diffèrent d'une famille à l'autre).
   */
  private chargerTypesPiece(idTypeDossier: string): void {
    this.pieces.set(new Map());
    this.pieceErreurs.set(new Set());
    this.typePieceService.getByTypeDossier(idTypeDossier).subscribe({
      next: (rows) => this.typesPiece.set(rows),
      error: () => this.typesPiece.set([]),
    });
  }
  retourChoix(): void {
    this.formError.set(null);
    this.phase.set('choix');
  }

  /** Rouvre un brouillon existant pour l'éditer/soumettre (reprise différée). */
  reprendre(d: Dossier): void {
    this.formError.set(null);
    this.dossier.set(d);
    this.createdPpmId.set(null);
    if (d.idTypeDossier === 'DDP') {
      this.ensureMarcheRefs();
      // Le DossierDto ne porte pas l'idPpm et `GET /api/ppms` exclut les BROUILLON (scoping serveur) :
      // l'idPpm d'un brouillon se résout via ses marchés (qui le portent), chargés par rechargerMarches().
      this.rechargerMarches();
    }
    this.phase.set('brouillon');
  }

  // — Lignes de marché du formulaire de création (FormArray) —
  get marchesArray(): FormArray {
    return this.ppmForm.get('marches') as FormArray;
  }
  marcheControls(): FormGroup[] {
    return this.marchesArray.controls as FormGroup[];
  }

  /** Lignes bénéficiaires d'un marché (copie de travail du formulaire). */
  beneficiairesControls(g: FormGroup): FormGroup[] {
    return (g.get('beneficiaires') as FormArray).controls as FormGroup[];
  }
  /** Libellé saisi pour un SOA inconnu (binding d'input). */
  soaLibelle(code: string): string {
    return this.soaLibelles().get(code) ?? '';
  }
  setSoaLibelle(code: string, v: string): void {
    this.soaLibelles.update((m) => new Map(m).set(code, v));
  }
  /** Enregistre un SOA inconnu au référentiel puis recharge la liste (le code sort des inconnus). */
  creerSoa(code: string): void {
    const libelle = this.soaLibelle(code).trim();
    if (!libelle) return;
    this.soaCreating.set(code);
    this.soaService.create({ soaCode: code, libelle }).subscribe({
      next: () => {
        this.soaCreating.set(null);
        this.toast.success(`Service bénéficiaire « ${code} » enregistré au référentiel.`);
        this.soaService.list().subscribe((r) => this.soaList.set(r));
      },
      error: (e: ApiError) => {
        this.soaCreating.set(null);
        this.toast.error(e.message || 'Création du service bénéficiaire impossible.');
      },
    });
  }
  /** Sélection de l'entité contractante depuis le panneau de résolution (import). */
  choisirEntite(v: string): void {
    this.ppmForm.controls.idEntiteContract.setValue(v ? +v : null);
  }
  /**
   * Détecte les anomalies de transcription d'un marché importé (repli heuristique).
   * OBJET_TRONQUE_PROBABLE : objet finissant par un préfixe de route sans numéro.
   * MONTANT_INCOHERENT : montant estimé ≠ Σ des montants par bénéficiaire.
   */
  private detecterAnomalies(m: SaisieImportMarche): AnomalieTranscription[] {
    const list: AnomalieTranscription[] = [];
    const objet = (m.designationMarche ?? '').trim();
    if (/(RN|RNT|RNS|RNP|RIP|RR)\s*$/i.test(objet)) {
      list.push({
        champ: 'objet',
        type: 'OBJET_TRONQUE_PROBABLE',
        gravite: 'A_VERIFIER',
        message: "Objet possiblement tronqué : se termine par un n° de route incomplet (ex. « RNS » → « RNS 44 »).",
      });
    }
    const benefs = (m.beneficiaires ?? []).filter(
      (b) => b.soaCode || b.numCompte || b.ancMontBenef != null || b.nouvMontBenef != null,
    );
    if (benefs.length) {
      const somme = benefs.reduce((a, b) => a + (Number(b.ancMontBenef) || 0), 0);
      const me = Number(m.montEstim) || 0;
      if (somme !== me) {
        list.push({
          champ: 'montEstim',
          type: 'MONTANT_INCOHERENT',
          gravite: 'BLOQUANT',
          message: `Montant incohérent : Σ bénéficiaires (${this.montantFmt(somme)}) ≠ montant estimé (${this.montantFmt(me)}).`,
        });
      }
    }
    return list;
  }
  /** Un bénéficiaire est-il renseigné (SOA, compte ou un montant) ? */
  private benefRempli(b: FormGroup): boolean {
    return !!(b.get('soaCode')!.value || b.get('numCompte')!.value || b.get('ancMontBenef')!.value != null || b.get('nouvMontBenef')!.value != null);
  }
  /**
   * Écart de cohérence des montants d'un marché (message inline, null si cohérent). Vérifié seulement si
   * au moins un bénéficiaire est saisi : `Σ ancMontBenef = montEstim` (et `Σ nouvMontBenef = nouvMontEstim`
   * si le nouveau montant du marché est renseigné). Reflète la règle serveur (sinon 400).
   */
  erreurCoherenceBenefs(g: FormGroup): string | null {
    const benefs = this.beneficiairesControls(g).filter((b) => this.benefRempli(b));
    if (!benefs.length) return null;
    const somme = (champ: string) =>
      benefs.reduce((acc, b) => acc + (Number(b.get(champ)!.value) || 0), 0);
    const montEstim = Number(g.get('montEstim')!.value) || 0;
    if (somme('ancMontBenef') !== montEstim) {
      return `La somme des montants par bénéficiaire (${this.montantFmt(somme('ancMontBenef'))}) doit égaler le montant estimé du marché (${this.montantFmt(montEstim)}).`;
    }
    const nouvMont = g.get('nouvMontEstim')!.value;
    if (nouvMont != null && nouvMont !== '' && somme('nouvMontBenef') !== Number(nouvMont)) {
      return `La somme des nouveaux montants par bénéficiaire (${this.montantFmt(somme('nouvMontBenef'))}) doit égaler le nouveau montant estimé (${this.montantFmt(Number(nouvMont))}).`;
    }
    return null;
  }
  /** Toutes les lignes de marché ont-elles des bénéficiaires cohérents ? (bloque la création si non) */
  get benefsCoherents(): boolean {
    return this.marcheControls().every((g) => this.erreurCoherenceBenefs(g) === null);
  }

  // — Aperçu du dossier à créer (lecture seule ; ne crée rien) —
  /** Libellé d'un processus CAPM (pour l'affichage). */
  private capmLabel(idCapm: number | null): string {
    if (idCapm == null) return '—';
    return this.capms().find((c) => c.idCapm === idCapm)?.libelleProcessus ?? '#' + idCapm;
  }
  /** Formate un montant (2 décimales, séparateur de milliers = espace visible), ou « » si absent. */
  montantFmt(v?: number | null): string {
    if (v === null || v === undefined || (v as unknown) === '') return '';
    const n = Number(v);
    const [ent, dec] = Math.abs(n).toFixed(2).split('.');
    return (n < 0 ? '-' : '') + ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec;
  }
  /** Convertit une date ISO `yyyy-MM-dd` en `dd/MM/yyyy` (vide si absente). */
  dateFr(iso?: string | null): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  }
  /** Construit le snapshot du formulaire (mis en forme comme le PPM officiel) et ouvre l'aperçu. */
  ouvrirApercu(): void {
    const marches: ApercuMarche[] = this.marcheControls()
      .filter((g) => this.ligneNonVide(g.getRawValue() as Record<string, unknown>))
      .map((g) => {
        const l = g.getRawValue() as Record<string, unknown>;
        const beneficiaires: ApercuBenef[] = ((l['beneficiaires'] as Record<string, unknown>[]) ?? [])
          .filter((b) => b['soaCode'] || b['numCompte'] || b['ancMontBenef'] != null || b['nouvMontBenef'] != null)
          .map((b) => ({
            soaCode: (b['soaCode'] as string) || undefined,
            numCompte: (b['numCompte'] as string) || undefined,
            ancMontBenef: (b['ancMontBenef'] as number | null) ?? null,
            nouvMontBenef: (b['nouvMontBenef'] as number | null) ?? null,
          }));
        // Date de début par jalon (LANCEMENT / OUVERTURE / ATTRIBUTION), résolue depuis le libellé CAPM.
        const processus = (l['processus'] as Record<string, unknown>[]) ?? [];
        const dateDe = (kw: string): string => {
          const p = processus.find((x) =>
            this.capmLabel(x['idCapm'] as number | null).toUpperCase().includes(kw),
          );
          return p ? this.dateFr(p['dateDebut'] as string) : '';
        };
        return {
          natureLibelle: (l['natureLibelle'] as string) || undefined,
          designationMarche: (l['designationMarche'] as string) || undefined,
          montEstim: (l['montEstim'] as number | null) ?? null,
          nouvMontEstim: (l['nouvMontEstim'] as number | null) ?? null,
          modeLibelle: (l['modeLibelle'] as string) || undefined,
          financement: (l['financement'] as string) || undefined,
          benefRows: beneficiaires.length ? beneficiaires : [{}],
          dateLancement: dateDe('LANCEMENT'),
          dateOuverture: dateDe('OUVERTURE'),
          dateAttribution: dateDe('ATTRIBUTION'),
          coherenceErr: this.erreurCoherenceBenefs(g),
          sansDates: processus.length === 0,
        };
      });
    const v = this.ppmForm.getRawValue();
    const ent = this.optionsEntite().find((e) => e.idEntiteContract === v.idEntiteContract);
    const pieces = this.typesPiece()
      .filter((t) => this.pieces().has(t.idTypePiece))
      .map((t) => ({ libelle: t.libellePiece, nom: this.pieces().get(t.idTypePiece)!.name }));
    this.apercu.set({
      entite: ent?.libelle ?? '—',
      adresse: ent?.adresse ?? '—',
      localite: this.localiteLabel(),
      exercice: (v.exercice as number | null) ?? null,
      signataire: this.signataireConnecte(),
      dateSignature: this.dateFr(v.dateSignature as string),
      marches,
      pieces,
    });
  }
  fermerApercu(): void {
    this.apercu.set(null);
  }
  /** Avertissements de l'aperçu (cohérence des montants + dates manquantes), hors mise en page PDF. */
  apercuAvertissements(a: ApercuDossier): string[] {
    const w: string[] = [];
    a.marches.forEach((m, i) => {
      const nom = m.designationMarche || `marché ${i + 1}`;
      if (m.coherenceErr) w.push(`« ${nom} » : ${m.coherenceErr}`);
      if (m.sansDates) w.push(`« ${nom} » : aucune date prévisionnelle (au moins un processus est obligatoire).`);
    });
    return w;
  }
  /** Libellés des pièces jointes fournies, pour l'aperçu. */
  piecesLabel(a: ApercuDossier): string {
    return a.pieces.map((p) => p.libelle).join(', ');
  }

  // — Import d'un PPM PDF (pré-remplissage read-only ; POST /api/saisies/ppm/import) —
  importerPpm(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // autorise la re-sélection du même fichier
    if (!file) return;
    this.importing.set(true);
    this.importAvertissements.set([]);
    this.saisie.importPpm(file).subscribe({
      next: (r) => {
        this.appliquerImport(r);
        this.importing.set(false);
        this.toast.success('PPM importé — vérifiez les données pré-remplies avant de créer le dossier.');
      },
      error: (e: ApiError) => {
        this.importing.set(false);
        // 400 = PDF illisible / non reconnu → message d'import dédié ; autres statuts (500, 503…) → toast centralisé.
        if (e.status === 400) {
          this.toast.error(e.message || 'PDF illisible ou non reconnu comme un PPM.');
        }
      },
    });
  }
  /**
   * Réinitialise l'import : vide les lignes et l'état d'import (verrou, anomalies, revue, entité/en-tête
   * repris du PDF) pour repartir d'une feuille propre — importer un autre PDF ou saisir manuellement.
   */
  reinitialiserImport(): void {
    this.marchesArray.clear();
    this.importe.set(false);
    this.anomaliesParLigne.set(new Map());
    this.importAvertissements.set([]);
    this.entiteImportee.set(null);
    this.autoriteImportee.set(null);
    this.soaLibelles.set(new Map());
    this.soaCreating.set(null);
    // En-tête repris du PDF remis aux valeurs par défaut.
    this.ppmForm.controls.exercice.setValue(new Date().getFullYear());
    this.ppmForm.controls.dateSignature.setValue('');
    this.ppmForm.controls.idEntiteContract.setValue(null);
  }
  /** Pré-remplit le formulaire depuis le résultat d'import (best-effort ; à vérifier avant création). */
  private appliquerImport(r: SaisiePpmImportResult): void {
    if (r.exercice != null) this.ppmForm.controls.exercice.setValue(r.exercice);
    if (r.dateSignature) this.ppmForm.controls.dateSignature.setValue(r.dateSignature);
    // Entité : pré-remplir depuis le PDF. Si elle est hors du périmètre du PRMP (§3.1), on l'ajoute aux
    // options (marquée « hors périmètre ») pour l'afficher/sélectionner, et on avertit — la création
    // restera refusée (403) tant que le PRMP n'est pas rattaché à cette entité.
    const idEntiteImportee = r.idEntiteContract;
    const entiteHorsPerimetre =
      idEntiteImportee != null && !this.entites().some((e) => e.idEntiteContract === idEntiteImportee);
    this.entiteImportee.set(
      entiteHorsPerimetre
        ? { idEntiteContract: idEntiteImportee!, libelle: `${r.autoriteContractante ?? '#' + idEntiteImportee} — hors périmètre` }
        : null,
    );
    this.autoriteImportee.set(r.autoriteContractante ?? null);
    if (idEntiteImportee != null) {
      this.ppmForm.controls.idEntiteContract.setValue(idEntiteImportee);
    }
    // Marchés (best-effort) : remplace les lignes actuelles par celles du PDF.
    this.ensureMarcheRefs();
    this.marchesArray.clear();
    let previsionsPresentes = false;
    const anomMap = new Map<number, AnomalieTranscription[]>();
    for (const m of r.marches ?? []) {
      const g = this.factory.ligneMarche();
      g.patchValue({
        designationMarche: m.designationMarche ?? '',
        montEstim: m.montEstim ?? null,
        nouvMontEstim: m.nouvMontEstim ?? null,
        // Compte : le PDF le porte au niveau bénéficiaire ; on pré-remplit le compte du marché avec le 1er (éditable).
        numCompte: m.beneficiaires?.[0]?.numCompte ?? null,
        financement: m.financement ?? '',
        // Nature/mode : libellé du PDF pré-rempli directement dans le champ (créé/résolu au POST).
        natureLibelle: m.natureLibelle ?? '',
        modeLibelle: m.modeLibelle ?? '',
        // Forme relevée dans l'objet par le parser (« contrat cadre », « à commande ») ; sinon défaut.
        formeMarche: m.formeMarche ?? ('QUANTITE_FIXE' as FormeMarche),
      });
      // Bénéficiaires (SOA + montants) pré-remplis depuis le PDF — saisis directement (résolus/créés au POST).
      const benefArr = g.get('beneficiaires') as FormArray;
      benefArr.clear(); // retire la ligne vide par défaut de ligneMarche()
      for (const b of m.beneficiaires ?? []) {
        benefArr.push(
          this.factory.ligneBeneficiaire({ soaCode: b.soaCode, numCompte: b.numCompte, ancMontBenef: b.ancMontBenef, nouvMontBenef: b.nouvMontBenef }),
        );
      }
      if (!benefArr.length) benefArr.push(this.factory.ligneBeneficiaire()); // toujours au moins une ligne
      // Lots : le parser ne les extrait pas des PPM actuels (toujours vide) ; mappé par fidélité au contrat.
      const lotArr = g.get('lots') as FormArray;
      for (const lt of m.lots ?? []) {
        if (!lt.designationLot) continue;
        lotArr.push(this.factory.ligneLot({ designationLot: lt.designationLot, montLot: lt.montLot, qteLot: lt.qteLot, uniteLot: lt.uniteLot }));
      }
      // Prévisions (jalons) : idCapm résolu depuis le libellé + date de début ; date de fin à compléter (non fournie).
      const procArr = g.get('processus') as FormArray;
      for (const p of m.previsions ?? []) {
        const idCapm =
          this.capms().find((c) => (c.libelleProcessus ?? '').toUpperCase() === (p.processus ?? '').toUpperCase())
            ?.idCapm ?? null;
        procArr.push(this.factory.processusGroup({ idCapm, dateDebut: p.dateDebut, dateFin: '' }));
        previsionsPresentes = true;
      }
      this.marchesArray.push(g);
      // Anomalies : contrat backend (`m.anomalies`, dont LOT_INCOHERENT) prioritaire ; heuristique locale en repli.
      // REFERENTIEL_INCONNU retiré de la revue : SOA géré par le panneau dédié, nature/mode/compte créés à la volée.
      const anom = (m.anomalies?.length ? m.anomalies : this.detecterAnomalies(m)).filter(
        (a) => a.type !== 'REFERENTIEL_INCONNU',
      );
      if (anom.length) anomMap.set(g.get('uid')!.value as number, anom);
    }
    this.anomaliesParLigne.set(anomMap);
    // Avertissements : ceux du backend + entité non résolue + dates + bénéficiaires.
    const av = [...(r.avertissements ?? [])];
    if (r.idEntiteContract == null && r.autoriteContractante) {
      av.unshift(`Entité « ${r.autoriteContractante} » non résolue automatiquement — sélectionnez l'entité contractante.`);
    } else if (entiteHorsPerimetre) {
      av.unshift(
        `L'entité du PPM${r.autoriteContractante ? ` « ${r.autoriteContractante} »` : ''} ne fait pas partie de vos entités contractantes (§3.1) — sélectionnez une de vos entités avant de créer le dossier.`,
      );
    }
    if ((r.marches ?? []).length) {
      av.push(
        previsionsPresentes
          ? 'Dates de début pré-remplies depuis le PDF — vous pouvez compléter la date de fin de chaque processus (optionnelle).'
          : 'Complétez les dates prévisionnelles (au moins la date de début d\'un processus) de chaque marché avant de créer le dossier.',
      );
    }
    if ((r.marches ?? []).some((m) => (m.beneficiaires ?? []).length)) {
      av.push('Bénéficiaires pré-remplis depuis le PDF — vérifiez SOA et montants (la somme par bénéficiaire doit égaler le montant du marché).');
    }
    // SOA inconnus traités par le panneau dédié → on retire ces avertissements répétitifs, et on
    // dédoublonne le reste (le backend en répète certains par marché).
    const filtres = av.filter(
      (w) =>
        !(/\(SOA\)/i.test(w) && /inconnu/i.test(w)) &&
        !(/entit/i.test(w) && (/non r/i.test(w) || /lectionner/i.test(w) || /rim/i.test(w))),
    );
    this.importAvertissements.set([...new Set(filtres)]);
    // Données issues du PDF : import détecté (revue + validation ; champs éditables pour corriger).
    // La grille partagée réinitialise sa validation quand la map d'anomalies change (nouvelle transcription).
    this.importe.set(true);
  }
  private ligneNonVide(l: Record<string, unknown>): boolean {
    // `statut` exclu : il a une valeur par défaut ('PREVU') et ne suffit pas à rendre une ligne « non vide ».
    return !!(
      l['designationMarche'] ||
      l['montEstim'] != null ||
      l['nouvMontEstim'] != null ||
      l['numCompte'] ||
      l['financement'] ||
      l['natureLibelle'] ||
      l['modeLibelle']
    );
  }


  // — Pièces jointes du dossier (PPM) —
  onPiece(idTypePiece: number, ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.pieces.update((m) => new Map(m).set(idTypePiece, file));
    this.pieceErreurs.update((s) => {
      const n = new Set(s);
      n.delete(idTypePiece);
      return n;
    });
  }
  retirerPiece(idTypePiece: number): void {
    this.pieces.update((m) => {
      const n = new Map(m);
      n.delete(idTypePiece);
      return n;
    });
  }
  pieceNom(idTypePiece: number): string | undefined {
    return this.pieces().get(idTypePiece)?.name;
  }
  pieceTaille(idTypePiece: number): string {
    const f = this.pieces().get(idTypePiece);
    if (!f) {
      return '';
    }
    if (f.size < 1024) {
      return f.size + ' o';
    }
    if (f.size < 1024 * 1024) {
      return Math.round(f.size / 1024) + ' Ko';
    }
    return (f.size / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  // — Création du dossier PPM (en-tête + marchés + pièces en un seul POST multipart ; PK posées serveur) —
  creerPpm(): void {
    if (this.ppmForm.invalid) {
      this.ppmForm.markAllAsTouched();
      return;
    }
    const v = this.ppmForm.getRawValue();
    const lignes = (v.marches as Record<string, unknown>[]).filter((l) => this.ligneNonVide(l));
    // Au moins un processus prévisionnel par marché à la création (contrat /api/saisies/ppm).
    if (lignes.some((l) => !((l['processus'] as unknown[]) ?? []).length)) {
      this.toast.error('Veuillez saisir les dates prévisionnelles (au moins un processus) pour tous les marchés.');
      return;
    }
    // Cohérence des montants par bénéficiaire (règle serveur) : Σ par bénéficiaire = montant du marché.
    if (!this.benefsCoherents) {
      this.toast.error('Bénéficiaires : la somme des montants par bénéficiaire doit égaler le montant du marché.');
      return;
    }
    // Pièces obligatoires : toutes doivent être fournies (vérif. backend renforcée à la soumission).
    const manquantes = this.typesPiece().filter((t) => t.obligatoire && !this.pieces().has(t.idTypePiece));
    if (manquantes.length) {
      this.pieceErreurs.set(new Set(manquantes.map((t) => t.idTypePiece)));
      this.toast.error('Veuillez fournir toutes les pièces obligatoires.');
      return;
    }
    this.pieceErreurs.set(new Set());
    this.formError.set(null);
    this.submitting.set(true);
    const marches: SaisieMarcheLigne[] = lignes.map((l) => {
      // Bénéficiaires non vides uniquement (SOA ou compte ou un montant renseigné).
      const beneficiaires = ((l['beneficiaires'] as Record<string, unknown>[]) ?? [])
        .filter((b) => b['soaCode'] || b['numCompte'] || b['ancMontBenef'] != null || b['nouvMontBenef'] != null)
        .map((b) => ({
          soaCode: (b['soaCode'] as string)?.trim() || undefined,
          numCompte: (b['numCompte'] as string)?.trim() || undefined,
          ancMontBenef: (b['ancMontBenef'] as number) ?? undefined,
          nouvMontBenef: (b['nouvMontBenef'] as number) ?? undefined,
        }));
      // Lots non vides uniquement (désignation renseignée) — le serveur crée une t_lot par élément.
      const lotsSaisis: SaisieMarcheLot[] = ((l['lots'] as Record<string, unknown>[]) ?? [])
        .filter((lt) => (lt['designationLot'] as string)?.trim())
        .map((lt) => ({
          designationLot: (lt['designationLot'] as string).trim(),
          montLot: (lt['montLot'] as number) ?? undefined,
          qteLot: (lt['qteLot'] as number) ?? undefined,
          uniteLot: (lt['uniteLot'] as string)?.trim() || undefined,
        }));
      // Règle : un marché **sans lot explicite** est traité comme un **lot unique = l'objet du marché**
      // (désignation = objet, tronquée à 200 pour @NotBlank max 200 ; montant = montant estimatif du marché).
      // Si l'objet est vide, aucun lot n'est envoyé (impossible de respecter @NotBlank).
      const objet = (l['designationMarche'] as string)?.trim();
      const lots: SaisieMarcheLot[] = lotsSaisis.length
        ? lotsSaisis
        : objet
          ? [{ designationLot: objet.slice(0, 200), montLot: this.factory.montantLotObjet(l['montEstim'], l['nouvMontEstim']) }]
          : [];
      return {
        designationMarche: (l['designationMarche'] as string) || undefined,
        montEstim: (l['montEstim'] as number) ?? undefined,
        nouvMontEstim: (l['nouvMontEstim'] as number) ?? undefined,
        numCompte: (l['numCompte'] as string) ?? undefined,
        financement: (l['financement'] as string) || undefined,
        statut: (l['statut'] as string) || 'PREVU',
        // Nature/mode en saisie libre : on envoie le libellé, le serveur le résout-ou-crée au POST.
        natureLibelle: (l['natureLibelle'] as string)?.trim() || undefined,
        modeLibelle: (l['modeLibelle'] as string)?.trim() || undefined,
        formeMarche: (l['formeMarche'] as FormeMarche) || undefined,
        // Bénéficiaires (SOA + montants) — le serveur crée une t_service_beneficiaire par élément.
        beneficiaires: beneficiaires.length ? beneficiaires : undefined,
        // Lots (allotissement) — optionnels ; le serveur crée une t_lot par élément (aucun contrôle de somme).
        lots: lots.length ? lots : undefined,
        processus: ((l['processus'] as Record<string, unknown>[]) ?? []).map((p) => ({
          idCapm: p['idCapm'] as number,
          dateDebut: p['dateDebut'] as string,
          // Date de fin optionnelle : chaîne vide → omise (le backend attend une date ISO ou rien, pas '').
          dateFin: (p['dateFin'] as string) || undefined,
        })),
      };
    });
    this.saisie
      .ppmAvecPieces(
        {
          idEntiteContract: v.idEntiteContract as number,
          exercice: v.exercice,
          dateSignature: v.dateSignature,
          marches,
        },
        this.pieces(),
      )
      .subscribe({
        next: (d) => {
          // Référence PPM générée serveur (absente du DossierDto) : lue via le PPM rattaché pour l'afficher.
          this.ppmService.list().subscribe({
            next: (ppms) => {
              const ref = ppms.find((p) => p.idDossier === d.idDossier)?.reference;
              this.submitting.set(false);
              this.toast.success(`Brouillon créé (dossier #${d.idDossier})${ref ? ' · réf. générée ' + ref : ''}.`);
              this.router.navigate(['/prmp/ppm-marches']);
            },
            error: () => {
              this.submitting.set(false);
              this.toast.success(`Brouillon créé (dossier #${d.idDossier}).`);
              this.router.navigate(['/prmp/ppm-marches']);
            },
          });
        },
        error: (e: ApiError) => this.echec(e),
      });
  }

  creerDossier(): void {
    if (this.dossierForm.invalid) {
      this.dossierForm.markAllAsTouched();
      return;
    }
    // Pièces obligatoires du type de dossier : toutes doivent être fournies (déposées après création).
    const manquantes = this.typesPiece().filter((t) => t.obligatoire && !this.pieces().has(t.idTypePiece));
    if (manquantes.length) {
      this.pieceErreurs.set(new Set(manquantes.map((t) => t.idTypePiece)));
      this.toast.error('Veuillez fournir toutes les pièces obligatoires.');
      return;
    }
    this.pieceErreurs.set(new Set());
    this.formError.set(null);
    this.submitting.set(true);
    const v = this.dossierForm.getRawValue();
    this.createdPpmId.set(null);
    this.saisie
      .dossier({
        idSousType: v.idSousType as string,
        idEntiteContract: v.idEntiteContract as number,
      })
      .subscribe({
        // `POST /api/saisies/dossier` est « sans contenu » : les pièces se déposent ensuite, une par une,
        // via `POST /api/piece-jointe-dossiers` (multipart) sur le brouillon créé.
        next: (d) => this.deposerPiecesPuisBrouillon(d),
        error: (e: ApiError) => this.echec(e),
      });
  }

  /** Dépose les pièces choisies sur le dossier créé (multipart, une par pièce), puis entre dans le brouillon. */
  private deposerPiecesPuisBrouillon(d: Dossier): void {
    const entries = [...this.pieces().entries()];
    if (!entries.length) {
      this.entrerBrouillon(d);
      return;
    }
    const ops = entries.map(([idTypePiece, file]) => {
      const fd = new FormData();
      fd.append('data', new Blob([JSON.stringify({ idDossier: d.idDossier, idTypePiece })], { type: 'application/json' }));
      fd.append('fichier', file);
      return this.pieceService.upload(fd);
    });
    forkJoin(ops).subscribe({
      next: () => this.entrerBrouillon(d),
      // Le dossier est déjà créé : si un dépôt échoue, on entre quand même dans le brouillon (les pièces
      // restent redéposables depuis le suivi du dossier) et on signale l'échec plutôt que de bloquer.
      error: () => {
        this.toast.error('Dossier créé, mais une pièce jointe n’a pas pu être déposée — vous pourrez la redéposer.');
        this.entrerBrouillon(d);
      },
    });
  }

  private entrerBrouillon(d: Dossier): void {
    this.submitting.set(false);
    this.dossier.set(d);
    this.toast.success(`Brouillon créé (dossier #${d.idDossier}).`);
    this.phase.set('brouillon');
    if (this.estPpm()) {
      this.ensureMarcheRefs();
      this.rechargerMarches();
    }
  }
  private echec(e: ApiError): void {
    this.submitting.set(false);
    if (e.fieldErrors) {
      this.formError.set(e); // 403/409 → toast centralisé (intercepteur)
    }
  }

  // — Édition des lignes de marché du brouillon (PPM) —
  rechargerMarches(): void {
    const id = this.dossier()?.idDossier;
    if (id == null) return;
    this.marcheService.list().subscribe((rows) => {
      const mine = rows.filter((m) => m.idDossier === id);
      this.marches.set(mine);
      // `GET /api/ppms` exclut les BROUILLON : on résout l'idPpm du brouillon via ses marchés (idPpm porté
      // par MarcheDto, `GET /api/marches` non filtré par statut pour le propriétaire).
      if (this.estPpm() && this.createdPpmId() == null && mine.length) {
        this.createdPpmId.set(mine[0].idPpm);
      }
    });
  }
  ouvrirAjout(): void {
    this.formError.set(null);
    this.editId.set(null);
    this.marcheForm.reset();
    this.ligneOuverte.set(true);
  }
  editer(m: Marche): void {
    this.formError.set(null);
    this.editId.set(m.idDetail);
    this.marcheForm.reset();
    this.marcheForm.patchValue({
      designationMarche: m.designationMarche ?? '',
      montEstim: m.montEstim ?? null,
      numCompte: m.numCompte ?? null,
      idNature: m.idNature ?? null,
      idMode: m.idMode ?? null,
    });
    this.ligneOuverte.set(true);
  }
  annulerLigne(): void {
    this.ligneOuverte.set(false);
  }

  enregistrerLigne(): void {
    if (this.marcheForm.invalid) {
      this.marcheForm.markAllAsTouched();
      return;
    }
    const d = this.dossier();
    const idPpm = this.createdPpmId();
    if (!d || idPpm == null) return;
    this.formError.set(null);
    this.submitting.set(true);
    const v = this.marcheForm.getRawValue();
    // idMode = choix de la PRMP (facultatif) ; absent → recommandé serveur ; hors ensemble → 409.
    // idDetail (PK) n'est jamais saisi : généré serveur à la création, repris de editId() en édition.
    const champs = {
      idPpm,
      designationMarche: v.designationMarche || undefined,
      montEstim: v.montEstim ?? undefined,
      numCompte: v.numCompte ?? undefined,
      idNature: v.idNature ?? undefined,
      idMode: v.idMode ?? undefined,
    };
    const idDetail = this.editId();
    const op =
      idDetail !== null
        ? this.marcheService.update(idDetail, { idDetail, idDossier: d.idDossier, ...champs })
        : this.marcheService.createMarche(d.idDossier, champs);
    op.subscribe({
      next: () => {
        this.submitting.set(false);
        this.ligneOuverte.set(false);
        this.toast.success('Ligne enregistrée.');
        this.rechargerMarches();
      },
      error: (e: ApiError) => this.echec(e),
    });
  }
  supprimer(m: Marche): void {
    this.submitting.set(true);
    this.marcheService.delete(m.idDetail).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Ligne supprimée.');
        this.rechargerMarches();
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  // — Soumission —
  soumettre(): void {
    const d = this.dossier();
    if (!d) return;
    this.submitting.set(true);
    this.dossierService.soumettre(d.idDossier).subscribe({
      next: (res) => {
        this.toast.success(`Dossier soumis${res.refeDossier ? ' · réf. ' + res.refeDossier : ''}.`);
        this.router.navigate(['/prmp/tableau-de-bord']);
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  resolve(map: Map<string, string>, id?: number): string {
    return id === null || id === undefined ? '—' : map.get(String(id)) ?? `#${id}`;
  }
  montant(v?: number): string {
    return v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
}
