import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Output } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiError, estConflitVersion } from '../../core/errors/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, validerFichier } from '../../core/securite/fichiers-surs';
import { ModaleDirective } from '../a11y/modale.directive';
import { AnomalieTranscription, Capm, Compte, Dossier, EditionPpmRequest, FORME_MARCHE_LIBELLES, FormeMarche, Lot, Marche, MarchePrevision, ModePassation, Nature, EntiteContract, PieceJointeDossier, Ppm, Prmp, Role, Ugpm, SaisieMarcheLigne, SaisiePpmImportResult, ServiceBeneficiaire, SoaBeneficiaire, TypeChangementLigne, TypePieceJointe } from '../../models';
import {
  CapmService,
  CompteService,
  DossierService,
  EntiteContractService,
  LocaliteService,
  LotService,
  MarcheService,
  MarchePrevisionService,
  MiseAJourPpmService,
  ModePassationService,
  NatureService,
  PieceJointeDossierService,
  PrmpService,
  UgpmService,
  PpmService,
  ReferenceLookupService,
  SaisieService,
  ServiceBeneficiaireService,
  SoaBeneficiaireService,
  TypePieceJointeService,
} from '../../services';
import { DatePipe } from '@angular/common';
import { PpmMarchesTable } from './ppm-marches-table';
import { PpmSaisieGrid } from './ppm-saisie-grid';
import { PpmFormFactory } from './ppm-form-factory';
import { DpmBenefsMarche } from './dpm-benefs-marche';
import { CibleSuppression, DpmConfirmationSuppression } from './dpm-confirmation-suppression';
import { DpmDatesMarche, libelleCapm } from './dpm-dates-marche';
import { calculerFichePresentation } from './fiche-presentation';
import { calculerAgpm } from './agpm';
import { DpmLotsMarche } from './dpm-lots-marche';
import { DpmReimportRefuse } from './dpm-reimport-refuse';

/**
 * Profils auxquels le backend ouvre `GET /api/ugpms/par-tutelle/{idPrmp}` — **miroir exact** du
 * `@PreAuthorize` serveur (livraison `b6f4adb`, 2026-08-20) : ceux qui **instruisent** le dossier,
 * plus l'Administrateur. Le Chargé de publication en est absent (hors instruction → 403), tout
 * comme la PRMP et l'UGPM, dont la lecture est limitée à leur propre tutelle et à qui cet onglet
 * est de toute façon masqué. Ce n'est qu'un garde de confort : l'autorité reste le serveur.
 */
const ROLES_UGPM_PAR_TUTELLE: readonly Role[] = [
  'ADMINISTRATEUR',
  'PRESIDENT',
  'CHEF_COMMISSION',
  'SECRETAIRE',
  'MEMBRE',
  'VERIFICATEUR',
  'ASSISTANT_CONTROLEUR',
];

/**
 * Modal « Détail PPM » réutilisable (partagé) : en-tête PPM + lignes de marché + pièces jointes du dossier.
 *
 * Autonome : charge ses données (`GET /api/ppms/{idPpm}`, `GET /api/marches`, `GET /api/piece-jointe-dossiers?dossier=`)
 * et, en `modeEdition`, embarque la gestion CRUD des marchés/dates et la suppression du PPM (formulaires inclus).
 * Découplé des features : émet `(fermer)` (fermeture demandée) et `(modifie)` (après une mutation) ; le composant
 * hôte gère le rechargement de ses listes. Le backend reste l'autorité (403/409 → toasts centralisés).
 */
@Component({
  selector: 'app-detail-ppm-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    ModaleDirective,
    PpmMarchesTable,
    PpmSaisieGrid,
    DpmBenefsMarche,
    DpmConfirmationSuppression,
    DpmDatesMarche,
    DpmLotsMarche,
    DpmReimportRefuse,
  ],
  template: `
    <div class="modal-backdrop" [class.closing]="closing()">
      @if (loading()) {
        <div class="spinner-wrap"><div class="spinner"></div></div>
      } @else {
      <div class="modal dpm-wide" role="dialog" aria-modal="true" aria-label="Détail du plan de passation" appModale appModaleClicExterieur (appModaleFermer)="emitFermer()">

        <!-- ── HEADER ── -->
        <div class="dpm-header">

          <!-- Ligne 1 : chips + fermer -->
          <div class="dpm-header-top">
            <div class="dpm-chips">
              <span class="dpm-chip dpm-chip-type">Plan de passation</span>
              <span class="dpm-chip dpm-chip-active"><span class="dpm-chip-dot"></span>Actif</span>
            </div>
            <div class="dpm-head-actions">
              @if (modeEdition && !editHeaderOpen() && !importApercu()) {
                <!-- Action principale du brouillon : ré-import (parse read-only → prévisualisation → Enregistrer). -->
                <label class="btn btn-primary dpm-import-btn" [class.dpm-import-btn--busy]="importEnCours()">
                  <span aria-hidden="true">📄</span>
                  {{ importEnCours() ? 'Analyse…' : 'Importer un PPM (PDF)' }}
                  <input type="file" accept=".pdf,application/pdf" hidden (change)="importerPdf($event)" [disabled]="importEnCours() || applyingImport()" />
                </label>
              }
              <button class="btn-close" type="button" aria-label="Fermer" (click)="emitFermer()">✕</button>
            </div>
          </div>

          <!-- Ligne 2 : titre -->
          <div class="dpm-title">{{ ppm()?.reference || 'PPM #' + idPpm }}</div>

          <!-- Ligne 3 : localité · exercice -->
          <div class="dpm-subtitle">
            <i aria-hidden="true">📍</i>
            <span>{{ ppm()?.idLocalite || '—' }}</span>
            <span class="dpm-sep">·</span>
            <i aria-hidden="true">📅</i>
            <span>Exercice {{ ppm()?.exercice }}</span>
          </div>

          <!-- Métadonnées : une par ligne (éditables inline en modeEdition) -->
          <div class="dpm-meta" [formGroup]="headerForm">
            <div class="dpm-meta-row">
              <span class="dpm-meta-label">Référence PRMP</span>
              <span class="dpm-meta-value">{{ ppm()?.reference || '—' }}</span>
            </div>
            <div class="dpm-meta-row">
              <span class="dpm-meta-label">Entité contractante</span>
              <span class="dpm-meta-value">{{ entiteLabel() }}</span>
            </div>
            <div class="dpm-meta-row">
              <span class="dpm-meta-label">Exercice</span>
              @if (editHeaderOpen()) {
                <input class="form-control dpm-meta-input" type="number" formControlName="exercice" />
              } @else {
                <span class="dpm-meta-value">{{ ppm()?.exercice }}</span>
              }
            </div>
            <div class="dpm-meta-row">
              <span class="dpm-meta-label">Date signature</span>
              @if (editHeaderOpen()) {
                <input class="form-control dpm-meta-input" type="date" formControlName="dateSignature" />
              } @else {
                <span class="dpm-meta-value">{{ (ppm()?.dateSignature | date: 'dd/MM/yyyy') || '—' }}</span>
              }
            </div>
            <div class="dpm-meta-row">
              <span class="dpm-meta-label">Signataire</span>
              <span class="dpm-meta-value">{{ ppm()?.signataire || '—' }}</span>
            </div>
            @if (ppm()?.datePpmInit) {
              <div class="dpm-meta-row">
                <span class="dpm-meta-label">Établi le</span>
                <span class="dpm-meta-value">{{ ppm()?.datePpmInit }}</span>
              </div>
            }
            @if (ppm()?.numMaj != null) {
              <div class="dpm-meta-row">
                <span class="dpm-meta-label">Mise à jour</span>
                <span class="dpm-meta-value">n° {{ ppm()?.numMaj }}{{ ppm()?.dateMaj ? ' · ' + ppm()?.dateMaj : '' }}</span>
              </div>
            }
          </div>

          @if (editHeaderOpen()) {
            <div class="dpm-header-savebar">
              @if (headerErr('exercice')) { <span class="form-error">{{ headerErr('exercice') }}</span> }
              @if (headerErr('dateSignature')) { <span class="form-error">{{ headerErr('dateSignature') }}</span> }
              <button class="btn btn-ghost btn-sm" type="button" [disabled]="submittingHeader()" (click)="annulerEditionHeader()">Annuler</button>
              <button class="btn btn-primary btn-sm" type="button" [disabled]="submittingHeader()" (click)="enregistrerHeader()">
                {{ submittingHeader() ? 'Enregistrement…' : 'Enregistrer' }}
              </button>
            </div>
          }

        </div>

        <!-- ⚠️ 2026-08-19 (demande user) — trois onglets : identité de l'entité, plan de passation,
             pièces jointes. Tout est déjà chargé (même vague) : changer d'onglet n'appelle rien. -->
        <div class="dpm-tabs" role="tablist" aria-label="Sections du plan de passation">
          <!-- ⚠️ Réservé aux profils qui découvrent le dossier : la PRMP et l'UGPM y liraient leur
               propre fiche d'identité (cf. afficheIdentites). -->
          @if (afficheIdentites()) {
            <button type="button" class="dpm-tab" role="tab" [class.dpm-tab--on]="onglet() === 'entite'"
              [attr.aria-selected]="onglet() === 'entite'" (click)="onglet.set('entite')">
              Entité contractante
            </button>
          }
          <button type="button" class="dpm-tab" role="tab" [class.dpm-tab--on]="onglet() === 'ppm'"
            [attr.aria-selected]="onglet() === 'ppm'" (click)="onglet.set('ppm')">
            Plan de passation <span class="dpm-tab__n">{{ marches().length }}</span>
          </button>
          <!-- ⚠️ Demande user (2026-09-01) — la « Fiche de présentation » officielle, DÉRIVÉE des
               marchés saisis à la création : rien de plus n'est chargé, rien n'est persisté. -->
          <button type="button" class="dpm-tab" role="tab" [class.dpm-tab--on]="onglet() === 'fiche'"
            [attr.aria-selected]="onglet() === 'fiche'" (click)="onglet.set('fiche')">
            Fiche de présentation <span class="dpm-tab__n">{{ fiche().nbMarchesConcernes }}</span>
          </button>
          <!-- ⚠️ Demande user (2026-09-01) — le « Projet d'AGPM », dérivé du plan comme la fiche :
               marchés dont le mode déclenche l'AGPM (drapeau administrable du référentiel). -->
          <button type="button" class="dpm-tab" role="tab" [class.dpm-tab--on]="onglet() === 'agpm'"
            [attr.aria-selected]="onglet() === 'agpm'" (click)="onglet.set('agpm')">
            Projet d'AGPM <span class="dpm-tab__n">{{ agpm().length }}</span>
          </button>
          <button type="button" class="dpm-tab" role="tab" [class.dpm-tab--on]="onglet() === 'pieces'"
            [attr.aria-selected]="onglet() === 'pieces'" (click)="onglet.set('pieces')">
            Pièces jointes <span class="dpm-tab__n">{{ pieces().length }}</span>
          </button>
        </div>

        <!-- ── CORPS ── -->
        <div class="dpm-body">

            @if (onglet() === 'entite' && afficheIdentites()) {
              <div class="dpm-section dpm-fiches" role="tabpanel">
                <!-- Entité contractante — lisible par tout utilisateur authentifié. -->
                <div class="dpm-fiche">
                  <div class="dpm-fiche__titre">🏛 Entité contractante</div>
                  @if (entiteDetail(); as e) {
                    <dl class="dpm-fiche__liste">
                      <div><dt>Libellé</dt><dd>{{ e.libelleEntite || '—' }}</dd></div>
                      <div><dt>Adresse</dt><dd>{{ e.adresse || '—' }}</dd></div>
                      <div><dt>Catégorie</dt><dd>{{ e.categorieEntite || '—' }}</dd></div>
                      <div><dt>Localité</dt><dd>{{ localiteLabel() }}</dd></div>
                      <div><dt>Niveau hiérarchique</dt><dd>{{ e.niveauHierarchique ?? '—' }}</dd></div>
                    </dl>
                  } @else {
                    <p class="dpm-fiche__vide">{{ entiteLabel() }}</p>
                  }
                </div>

                <!-- PRMP signataire du plan — lecture ouverte à tout profil authentifié. -->
                <div class="dpm-fiche">
                  <div class="dpm-fiche__titre">👤 Personne responsable des marchés publics</div>
                  @if (prmpDetail(); as pr) {
                    <dl class="dpm-fiche__liste">
                      <div><dt>Identité</dt><dd>{{ pr.nomPrmp }} {{ pr.prenomsPrmp }}</dd></div>
                      <div><dt>Matricule</dt><dd class="cnm-mono">{{ pr.idPrmp }}</dd></div>
                      <div><dt>Arrêté de nomination</dt><dd>{{ pr.arreteNomin || '—' }}</dd></div>
                      <div><dt>Date de nomination</dt><dd>{{ (pr.dateNomin | date: 'dd/MM/yyyy') || '—' }}</dd></div>
                      <div><dt>Courriel</dt><dd>{{ pr.emailPrmp || '—' }}</dd></div>
                      <div><dt>Téléphone</dt><dd>{{ pr.telPrmp || '—' }}</dd></div>
                    </dl>
                  } @else {
                    <p class="dpm-fiche__vide">Aucune PRMP rattachée à ce plan.</p>
                  }
                </div>

                <!-- ⚠️ Auteur du dossier — livré par le backend le 2026-08-19 (b264cce) : creePar
                     et soumisPar (logins) sont accompagnés des noms lisibles creeParNom /
                     soumisParNom, résolus SERVEUR (le login n'est pas l'identifiant de l'acteur).
                     Plus aucun rapprochement local avec la liste des UGPM : on affiche le nom quand
                     il est résolu, le login sinon — toujours quelque chose d'utile. -->
                @if (auteurDossier(); as a) {
                  <div class="dpm-fiche">
                    <div class="dpm-fiche__titre">✍ Saisie du dossier</div>
                    <dl class="dpm-fiche__liste">
                      <!-- ⚠️ Le cas courant est que la PRMP saisisse ET soumette : répéter son nom
                           puis deux fois le même compte n'apprenait rien. Les deux actes sont donc
                           réunis sur une ligne quand c'est le même compte, et séparés dès qu'ils
                           diffèrent — cas qui, lui, mérite l'attention (saisie par une UGPM, puis
                           soumission par sa PRMP de tutelle). -->
                      @if (a.memeActeur) {
                        <div><dt>Créé et soumis par</dt><dd>{{ a.libelle }}</dd></div>
                      } @else {
                        <div><dt>Créé par</dt><dd>{{ a.libelle }}</dd></div>
                      }
                      <!-- Le compte n'est rappelé que s'il apporte quelque chose : quand le nom n'a
                           pas pu être résolu, le libellé EST déjà le login — inutile de le répéter. -->
                      @if (a.login && a.libelle !== a.login) { <div><dt>Compte</dt><dd class="cnm-mono">{{ a.login }}</dd></div> }
                      @if (!a.memeActeur && a.soumisPar) {
                        <div><dt>Soumis par</dt><dd>{{ a.soumisParLibelle }}</dd></div>
                        @if (a.soumisParLibelle !== a.soumisPar) {
                          <div><dt>Compte</dt><dd class="cnm-mono">{{ a.soumisPar }}</dd></div>
                        }
                      }
                    </dl>
                  </div>
                }

                <!-- UGPM rattachées : lues via GET /api/ugpms/par-tutelle/{idPrmp}, ouvert à la
                     PRMP concernée depuis b264cce. Le bloc reste conditionnel car les contrôleurs,
                     eux, n'ont pas accès au répertoire des UGPM (l'appel n'est alors pas émis). -->
                @if (ugpmsRattachees().length) {
                  <div class="dpm-fiche">
                    <div class="dpm-fiche__titre">🏢 Unité(s) de gestion rattachée(s)</div>
                    @for (u of ugpmsRattachees(); track u.idUgpm) {
                      <dl class="dpm-fiche__liste dpm-fiche__liste--sep">
                        <div><dt>Identité</dt><dd>{{ u.nomUgpm }} {{ u.prenomsUgpm }}</dd></div>
                        <div><dt>Matricule</dt><dd class="cnm-mono">{{ u.idUgpm }}</dd></div>
                        @if (u.libelle) { <div><dt>Libellé</dt><dd>{{ u.libelle }}</dd></div> }
                        <div><dt>Courriel</dt><dd>{{ u.emailUgpm || '—' }}</dd></div>
                        <div><dt>Téléphone</dt><dd>{{ u.telUgpm || '—' }}</dd></div>
                      </dl>
                    }
                  </div>
                }
              </div>
            }

            @if (onglet() === 'ppm') {
            <!-- Lignes de marché -->
            <div class="dpm-section">
              @if (importApercu(); as r) {
                <!-- PRÉVISUALISATION de l'import : RIEN n'est écrit tant qu'« Enregistrer » n'est pas cliqué. -->
                <div class="alert alert-warning">
                  ⚠ <strong>Prévisualisation de l'import</strong> — {{ importMarches()?.length ?? 0 }} marché(s) du PDF
                  remplaceront les {{ marches().length }} ligne(s) actuelle(s). <strong>Modifications non
                  enregistrées.</strong> En-tête (exercice, date de signature) repris du PDF à l'enregistrement ;
                  pièces jointes conservées ; entité et référence inchangées{{ r.autoriteContractante ? ' (PDF : « ' + r.autoriteContractante + ' »)' : '' }}.
                  @if (r.avertissements?.length) { {{ r.avertissements!.length }} avertissement(s) d'import. }
                </div>
                <!-- Grille éditable partagée (identique à la soumission) : édition, revue de transcription, validation par ligne. -->
                @if (importMarches(); as arr) {
                  <app-ppm-saisie-grid
                    [marches]="arr"
                    [natures]="natures()"
                    [modesList]="modes()"
                    [comptes]="comptes()"
                    [soaList]="soaList()"
                    [capms]="capms()"
                    [anomaliesParLigne]="anomaliesImport()"
                    mode="import"
                  />
                }
                <!-- ⚠️ Fiche de présentation (2026-09-01) — la justification GLOBALE accompagne le PUT
                     (la garde serveur l'exige si une liste de la fiche est non vide) ; les
                     justifications PAR LIGNE se saisissent dans la grille ci-dessus. -->
                <label class="form-group dpm-justif-globale">
                  <span class="form-label">Justification de la fiche de présentation</span>
                  <textarea class="form-control" rows="2" [value]="justifFicheImport()"
                    (input)="justifFicheImport.set($any($event.target).value)"
                    placeholder="Justification globale (bas de la fiche de présentation)…"></textarea>
                </label>
                <div class="dpm-apercu-actions">
                  <button class="btn btn-outline" type="button" [disabled]="applyingImport()" (click)="annulerImport()">Annuler l'import</button>
                  <button class="btn btn-primary" type="button"
                    [disabled]="applyingImport() || !importPret() || entitePdfDifferente()"
                    [title]="titreEnregistrerImport()"
                    (click)="enregistrerImport()">
                    {{ applyingImport() ? 'Enregistrement…' : '💾 Enregistrer' }}
                  </button>
                </div>
              } @else if (modeEdition) {
                <!-- Même affichage que la lecture (format PPM officiel : montants, mode, forme, financement,
                     bénéficiaires, dates) + colonne ACTIONS injectée dans la table partagée. -->
                <app-ppm-marches-table [marches]="marches()" [beneficiaires]="serviceBenefs()" [previsions]="previsions()" [changements]="changements()">
                  <ng-template #rowActions let-m>
                    <div class="dpm-actions-stack">
                      <button class="btn btn-secondary btn-sm" type="button" (click)="voirDates(m)">Voir dates</button>
                      <button class="btn btn-secondary btn-sm" type="button" (click)="modifierBenefs(m)">Bénéficiaires</button>
                      <button class="btn btn-secondary btn-sm" type="button" (click)="modifierLots(m)">Lots ({{ lotsDe(m.idDetail).length }})</button>
                      <button class="btn btn-outline btn-sm" type="button" (click)="modifierMarche(m)">Modifier</button>
                    </div>
                  </ng-template>
                </app-ppm-marches-table>
              } @else {
                <app-ppm-marches-table [marches]="marches()" [beneficiaires]="serviceBenefs()" [previsions]="previsions()" [changements]="changements()" />
              }
            </div>
            }

            <!-- ⚠️ Demande user (2026-09-01) — reprend la FORME de la « Fiche de présentation »
                 officielle (pièce du dépôt) : trois listes dérivées du plan. Les JUSTIFICATIONS
                 restent à compléter sur la fiche signée — l'écran les signale, il ne les saisit pas. -->
            @if (onglet() === 'fiche') {
              <div class="dpm-section dpm-doc-panel" role="tabpanel">
                <!-- ⚠️ Demande user (2026-09-01, mise à jour) — le libellé de version remplace
                     « Initial » sur une version de mise à jour (numMaj > 0). -->
                <p class="dpm-fp-nature"><u>Nature du dossier</u> :
                  <strong>Projet de Plan de passation des marchés de l'année {{ ppm()?.exercice ?? '____' }}, {{ libelleVersionFiche() }}</strong>
                </p>
                <p class="dpm-fp-note cnm-muted">
                  Listes établies depuis les marchés du plan — même forme que la fiche de présentation
                  jointe au dépôt.
                </p>

                <h3 class="dpm-fp-titre">1. Liste des marchés à passer par mode dérogatoire avec justifications</h3>
                @if (fiche().derogatoires.length) {
                  <div class="table-responsive">
                    <table class="cnm-table">
                      <thead><tr><th scope="col">Objet du marché</th><th scope="col">Montant estimatif</th><th scope="col">Mode de passation</th><th scope="col">Justification</th></tr></thead>
                      <tbody>
                        @for (l of fiche().derogatoires; track l.idDetail) {
                          <tr>
                            <td>{{ l.objet }}</td>
                            <td class="cnm-mono">{{ montantFr(l.montant) }}</td>
                            <td>{{ l.modeLibelle }}</td>
                            <td>@if (l.justifModeDerogatoire) { {{ l.justifModeDerogatoire }} } @else { <span class="cnm-muted">À compléter</span> }</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <p class="cnm-muted">Aucun marché à passer par mode dérogatoire.</p>
                }

                <h3 class="dpm-fp-titre">2. Liste des marchés à délais aménagés avec justifications</h3>
                @if (fiche().delaisAmenages.length) {
                  <div class="table-responsive">
                    <table class="cnm-table">
                      <thead><tr><th scope="col">Objet du marché</th><th scope="col">Montant estimatif</th><th scope="col">Mode de passation</th><th scope="col">Délai de remise des offres</th><th scope="col">Justifications</th></tr></thead>
                      <tbody>
                        @for (l of fiche().delaisAmenages; track l.idDetail) {
                          <tr>
                            <td>{{ l.objet }}</td>
                            <td class="cnm-mono">{{ montantFr(l.montant) }}</td>
                            <td>{{ l.modeLibelle }}</td>
                            <td>{{ l.delaiJours }} jours <span class="cnm-muted">(minimum du mode : {{ l.delaiMinJours }})</span></td>
                            <td>@if (l.justifDelaiAmenage) { {{ l.justifDelaiAmenage }} } @else { <span class="cnm-muted">À compléter</span> }</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <p class="cnm-muted">Aucun marché à délais aménagés.</p>
                }

                <h3 class="dpm-fp-titre">3. Liste des contrats-cadres</h3>
                @if (fiche().contratsCadres.length) {
                  <div class="table-responsive">
                    <table class="cnm-table">
                      <thead><tr><th scope="col">Objet du marché</th><th scope="col">Montant estimatif</th><th scope="col">Mode de passation</th><th scope="col">Délai de remise des offres</th></tr></thead>
                      <tbody>
                        @for (l of fiche().contratsCadres; track l.idDetail) {
                          <tr>
                            <td>{{ l.objet }}</td>
                            <td class="cnm-mono">{{ montantFr(l.montant) }}</td>
                            <td>{{ l.modeLibelle }}</td>
                            <td>@if (l.delaiJours != null) { {{ l.delaiJours }} jours } @else { — }</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <p class="cnm-muted">Aucun contrat-cadre.</p>
                }

                <!-- ⚠️ Demande user (2026-09-01, mise à jour) — le MOTIF de la mise à jour s'AJOUTE
                     à la justification du bas des listes (une version de mise à jour porte toujours
                     son motif, même quand la justification manque encore — cas de l'import). -->
                @if (fiche().nbMarchesConcernes > 0 || ppm()?.justificationFiche || ppm()?.motifMaj) {
                  <p class="dpm-fp-justif"><u>Justification :</u>
                    @if (ppm()?.justificationFiche) { {{ ppm()!.justificationFiche }} } @else { <span class="cnm-muted">À compléter</span> }
                    @if (ppm()?.motifMaj) { — <strong>Motif de la mise à jour :</strong> {{ ppm()!.motifMaj }} }
                  </p>
                }
              </div>
            }

            <!-- ⚠️ Demande user (2026-09-01) — « Projet d'AGPM » au format du modèle officiel :
                 en-tête du document + tableau des marchés en mode déclencheur d'AGPM. DÉRIVÉ du
                 plan (créé de fait à la création / mise à jour du dossier), rien de persisté —
                 la pièce AGPM signée reste, elle, une pièce jointe. -->
            @if (onglet() === 'agpm') {
              <div class="dpm-section dpm-doc-panel" role="tabpanel">
                <h3 class="dpm-fp-titre dpm-agpm-titre">AVIS GENERAL DE PASSATION DES MARCHES POUR L'ANNEE {{ ppm()?.exercice ?? '____' }}</h3>
                <div class="dpm-agpm-entete">
                  <div>
                    <p><u>Autorité Contractante</u> : <strong>{{ entiteLabel() }}</strong></p>
                    <p><u>Nom de la PRMP</u> : <strong>{{ ppm()?.signataire || '—' }}</strong></p>
                  </div>
                  <div>
                    <p><u>Date d'établissement du Document initial</u> : {{ dateCourt(ppm()?.datePpmInit || ppm()?.dateSignature) }}</p>
                    <p><u>Numéro et date de la dernière mise à jour</u> : {{ ppm()?.numMajPrec ?? 0 }}@if (ppm()?.dateMajPrec) { - {{ dateCourt(ppm()?.dateMajPrec) }} }</p>
                    <p><u>Numéro de la présente mise à jour</u> : {{ ppm()?.numMaj ?? 0 }}</p>
                  </div>
                </div>
                @if (agpm().length) {
                  <div class="table-responsive">
                    <table class="cnm-table">
                      <thead><tr><th scope="col">Compte</th><th scope="col">Nature</th><th scope="col">Objet</th><th scope="col">Montant estimatif du marché</th><th scope="col">Financement</th><th scope="col">Mode de passation</th><th scope="col">Date du DAO</th></tr></thead>
                      <tbody>
                        @for (l of agpm(); track l.idDetail) {
                          <tr>
                            <td class="cnm-mono">{{ l.compte || '—' }}</td>
                            <td>{{ l.nature || '—' }}</td>
                            <td>{{ l.objet }}</td>
                            <td class="cnm-mono">{{ montantFr(l.montant) }}</td>
                            <td>{{ l.financement || '—' }}</td>
                            <td>{{ l.modeLibelle }}</td>
                            <td class="cnm-mono">{{ dateCourt(l.dateDao) }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <p class="dpm-fp-note cnm-muted">Date du DAO = date prévisionnelle de lancement du marché.</p>
                } @else {
                  <p class="cnm-muted">Aucun marché en mode déclencheur d'AGPM — l'avis est sans objet pour ce plan.</p>
                }
              </div>
            }

            @if (onglet() === 'pieces') {
            <!-- Pièces jointes -->
            <div class="dpm-section">
              <div class="dpm-section-head">
                <div class="section-block-title">
                  <div class="section-icon">📎</div>
                  <span class="section-label">Pièces jointes</span>
                  <span class="section-count">{{ pieces().length }} pièce(s)</span>
                </div>
              </div>

              <div class="pieces-card">
                @if (agpmRequise()) {
                  <div class="dpm-agpm" [class.dpm-agpm--ok]="!agpmManquante()" role="note">
                    <span class="dpm-agpm-ic" aria-hidden="true">{{ agpmManquante() ? '⚠️' : '✅' }}</span>
                    @if (agpmManquante()) {
                      <span>Ce PPM comporte un marché en « appel d'offres ouvert » : la pièce
                        <strong>AGPM</strong> (Avis Général de Passation de Marché) est
                        <strong>requise</strong> avant la soumission.</span>
                    } @else {
                      <span>Pièce <strong>AGPM</strong> requise — bien fournie.</span>
                    }
                  </div>
                }
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
                        <div class="piece-actions">
                          <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">
                            Ouvrir <span class="arrow">↗</span>
                          </button>
                          @if (modeEdition) {
                            <button class="btn btn-danger btn-sm" type="button" [disabled]="suppressionPiece() === p.idPiece" (click)="supprimerPiece(p)">Supprimer</button>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }

                <!-- ⚠️ 2026-08-03 — versions CORRIGÉES (rectification sur observations du PV). -->
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
                        <div class="piece-actions">
                          <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">
                            Ouvrir <span class="arrow">↗</span>
                          </button>
                        </div>
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
                        <div class="piece-actions">
                          <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">
                            Ouvrir <span class="arrow">↗</span>
                          </button>
                          @if (modeEdition) {
                            <button class="btn btn-danger btn-sm" type="button" [disabled]="suppressionPiece() === p.idPiece" (click)="supprimerPiece(p)">Supprimer</button>
                          }
                        </div>
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

                @if (modeEdition) {
                  <div class="dpm-piece-upload">
                    <select class="form-control" [value]="uploadType() ?? ''"
                      (change)="uploadType.set($any($event.target).value ? +$any($event.target).value : null)">
                      <option value="">— Type de pièce —</option>
                      @for (t of typesPiece(); track t.idTypePiece) {
                        <option [value]="t.idTypePiece">{{ t.libellePiece }}</option>
                      }
                    </select>
                    <input type="file" accept=".pdf,.jpeg,.jpg,.png" (change)="onUploadFile($event)" />
                    <button class="btn btn-primary btn-sm" type="button"
                      [disabled]="uploading() || uploadType() == null || !uploadFile()" (click)="ajouterPiece()">
                      {{ uploading() ? 'Ajout…' : '+ Ajouter une pièce' }}
                    </button>
                  </div>
                }
              </div>
            </div>
            }
        </div>

        <!-- ── PIED ── -->
        <div class="modal-footer modal-footer-spaced">
          <div class="modal-footer-info">
            <strong>{{ marches().length }}</strong> marché(s) ·
            <strong>{{ pieces().length }}</strong> pièce(s) jointe(s)
          </div>
          @if (soumissible) {
            <div class="dpm-foot-actions">
              <button class="btn btn-ghost" type="button" (click)="emitFermer()">Retour</button>
              <button class="btn btn-success" type="button" [disabled]="marches().length === 0 || importApercu() !== null" (click)="soumettre.emit()">
                Soumettre le dossier
              </button>
            </div>
          } @else {
            <button class="btn btn-ghost" type="button" (click)="emitFermer()">Fermer</button>
          }
        </div>

      </div>
      }
    </div>

    @if (modalMarche(); as m) {
      <app-dpm-dates-marche
        [marche]="m"
        [capms]="capms()"
        [chargement]="modalLoading()"
        [dates]="modalData()"
        (fermer)="fermerDates()"
      />
    }

    @if (editMarche(); as m) {
      @if (editForm(); as ef) {
        <div class="dpm__overlay">
          <form class="dpm dpm--sm cnm-card" [formGroup]="ef" (ngSubmit)="enregistrerEdition()" role="dialog" aria-modal="true" aria-label="Modifier le marché" appModale appModaleClicExterieur (appModaleFermer)="annulerEdition()" novalidate>
            <header class="dpm__head">
              <h2 class="dpm__title">Modifier les dates — {{ m.designationMarche || 'Marché #' + m.idDetail }}</h2>
              <button type="button" class="dpm__close" aria-label="Fermer" (click)="annulerEdition()">&times;</button>
            </header>
            <div class="dpm__body dpm__body--pad">
              @if (editLoading()) {
                <p class="dpm__info" role="status">Chargement des dates…</p>
              } @else {
                @for (ctrl of datesControls(ef); track $index) {
                  <div class="dpm-date-row" [formGroup]="ctrl">
                    <select class="form-control" formControlName="idCapm">
                      <option [ngValue]="null" disabled>— Processus —</option>
                      @for (grp of groupesPourLigne(ef, ctrl); track grp.groupe) {
                        @if (grp.groupe) {
                          <optgroup [label]="grp.groupe">
                            @for (c of grp.capms; track c.idCapm) { <option [ngValue]="c.idCapm">{{ c.libelleProcessus || ('#' + c.idCapm) }}</option> }
                          </optgroup>
                        } @else {
                          @for (c of grp.capms; track c.idCapm) { <option [ngValue]="c.idCapm">{{ c.libelleProcessus || ('#' + c.idCapm) }}</option> }
                        }
                      }
                    </select>
                    <input class="form-control" type="date" formControlName="dateDebut" />
                    <input class="form-control" type="date" formControlName="dateFin" />
                    <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="retirerDate(ef, $index)">✕</button>
                  </div>
                  @if (procErreur(ctrl.get('idCapm')!.value)) {
                    <span class="form-error dpm-date-err">{{ procErreur(ctrl.get('idCapm')!.value) }}</span>
                  }
                } @empty {
                  <p class="dpm__info">Aucune date. Ajoutez-en une.</p>
                }
                <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" [disabled]="!peutAjouterDate(ef)" (click)="ajouterDate(ef)">+ Ajouter une date</button>
              }
            </div>
            <footer class="dpm__foot">
              <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annulerEdition()">Annuler</button>
              <button type="submit" class="cnm-btn cnm-btn--primary" [disabled]="submittingEdit() || editLoading()">Enregistrer</button>
            </footer>
          </form>
        </div>
      }
    }

    @if (editBenefMarche(); as m) {
      <app-dpm-benefs-marche
        [marche]="m"
        [formulaire]="benefForm"
        [soaList]="soaList()"
        [comptes]="comptes()"
        [busy]="submittingBenef()"
        (ajouter)="ajouterBenef()"
        (retirer)="retirerBenef($event)"
        (annuler)="annulerBenefs()"
        (enregistrer)="enregistrerBenefs()"
      />
    }

    @if (editLotMarche(); as m) {
      <app-dpm-lots-marche
        [marche]="m"
        [formulaire]="lotForm"
        [busy]="submittingLot()"
        (ajouter)="ajouterLot()"
        (retirer)="retirerLot($event)"
        (annuler)="annulerLots()"
        (enregistrer)="enregistrerLots()"
      />
    }

    @if (createOpen()) {
      <div class="dpm__overlay">
        <form class="dpm dpm--sm cnm-card" [formGroup]="createForm" (ngSubmit)="enregistrerMarche()" role="dialog" aria-modal="true" aria-label="Nouveau marché" appModale appModaleClicExterieur (appModaleFermer)="annulerCreation()" novalidate>
          <header class="dpm__head">
            <h2 class="dpm__title">
              {{ editingMarche() ? 'Modifier le marché #' + editingMarche()!.idDetail : 'Nouveau marché — PPM ' + (ppm()?.reference || '#' + idPpm) }}
            </h2>
            <button type="button" class="dpm__close" aria-label="Fermer" (click)="annulerCreation()">&times;</button>
          </header>
          <div class="dpm__body dpm__body--pad dpm-form">
            <label class="form-group">
              <span class="form-label">Désignation</span>
              <input class="form-control" type="text" formControlName="designationMarche" />
            </label>
            <label class="form-group">
              <span class="form-label">Compte</span>
              <select class="form-control" formControlName="numCompte">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (c of comptes(); track c.numCompte) { <option [ngValue]="c.numCompte">{{ c.libelle || c.numCompte }}</option> }
              </select>
              @if (refsLoading()) { <span class="form-hint">Chargement…</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Montant estimé</span>
              <input class="form-control" type="number" formControlName="montEstim" />
            </label>
            <label class="form-group">
              <span class="form-label">Financement</span>
              <input class="form-control" type="text" formControlName="financement" />
            </label>
            <label class="form-group">
              <span class="form-label">Statut</span>
              <input class="form-control" type="text" formControlName="statut" />
            </label>
            <label class="form-group">
              <span class="form-label">Nature</span>
              <select class="form-control" formControlName="idNature">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (n of natures(); track n.idNature) { <option [ngValue]="n.idNature">{{ n.libelle || '#' + n.idNature }}</option> }
              </select>
            </label>
            <label class="form-group">
              <span class="form-label">Mode de passation</span>
              <select class="form-control" formControlName="idMode">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (m of modes(); track m.idMode) { <option [ngValue]="m.idMode">{{ m.libelle || '#' + m.idMode }}</option> }
              </select>
            </label>
            <label class="form-group">
              <span class="form-label">Forme du marché</span>
              <select class="form-control" formControlName="formeMarche">
                @for (f of formes; track f.code) { <option [value]="f.code">{{ f.libelle }}</option> }
              </select>
            </label>
            <div class="form-group dpm-form__dates">
              <span class="form-label">Dates prévisionnelles (par processus)</span>
              @for (ctrl of datesControls(createForm); track $index) {
                <div class="dpm-date-row" [formGroup]="ctrl">
                  <select class="form-control" formControlName="idCapm">
                    <option [ngValue]="null" disabled>— Processus —</option>
                    @for (grp of groupesPourLigne(createForm, ctrl); track grp.groupe) {
                      @if (grp.groupe) {
                        <optgroup [label]="grp.groupe">
                          @for (c of grp.capms; track c.idCapm) { <option [ngValue]="c.idCapm">{{ c.libelleProcessus || ('#' + c.idCapm) }}</option> }
                        </optgroup>
                      } @else {
                        @for (c of grp.capms; track c.idCapm) { <option [ngValue]="c.idCapm">{{ c.libelleProcessus || ('#' + c.idCapm) }}</option> }
                      }
                    }
                  </select>
                  <input class="form-control" type="date" formControlName="dateDebut" />
                  <input class="form-control" type="date" formControlName="dateFin" />
                  <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="retirerDate(createForm, $index)">✕</button>
                </div>
              }
              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" [disabled]="!peutAjouterDate(createForm)" (click)="ajouterDate(createForm)">+ Ajouter une date</button>
            </div>
          </div>
          <footer class="dpm__foot">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annulerCreation()">Annuler</button>
            <button type="submit" class="cnm-btn cnm-btn--primary" [disabled]="submittingCreate()">Enregistrer</button>
          </footer>
        </form>
      </div>
    }

    @if (confirmState(); as c) {
      <app-dpm-confirmation-suppression
        [cible]="c"
        [busy]="confirmBusy()"
        (annuler)="annulerSuppression()"
        (confirmer)="confirmerSuppression()"
      />
    }

    @if (reimportRefus(); as ref) {
      <app-dpm-reimport-refuse
        [autorite]="ref.autorite"
        [entite]="entiteLabel()"
        (fermer)="reimportRefus.set(null)"
      />
    }

  `,
  styleUrl: './detail-ppm-modal.scss',
})
export class DetailPpmModal implements OnInit {
  /** Dossier dont on affiche les pièces jointes (obligatoire). */
  @Input({ required: true }) idDossier!: number;
  /** PPM à détailler (obligatoire). */
  @Input({ required: true }) idPpm!: number;
  /** `true` = PRMP propriétaire (boutons + colonne ACTION) ; `false` = lecture seule. */
  @Input() modeEdition = false;
  /** `true` = pied « Retour + Soumettre le dossier » (édition d'un brouillon) au lieu de « Fermer ». */
  @Input() soumissible = false;
  /** Fermeture demandée (× / backdrop / Fermer / Retour). */
  @Output() fermer = new EventEmitter<void>();
  /** Émis après une mutation (création/édition/suppression) pour rafraîchir l'hôte. */
  @Output() modifie = new EventEmitter<void>();
  /** Demande de soumission du dossier (bouton « Soumettre le dossier »). */
  @Output() soumettre = new EventEmitter<void>();

  private readonly ppmService = inject(PpmService);
  private readonly dossierService = inject(DossierService);
  private readonly miseAJourService = inject(MiseAJourPpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly lotService = inject(LotService);
  private readonly serviceBenefService = inject(ServiceBeneficiaireService);
  private readonly soaBenefService = inject(SoaBeneficiaireService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly natureService = inject(NatureService);
  private readonly modeService = inject(ModePassationService);
  private readonly compteService = inject(CompteService);
  private readonly capmService = inject(CapmService);
  private readonly entiteService = inject(EntiteContractService);
  private readonly prmpService = inject(PrmpService);
  private readonly ugpmService = inject(UgpmService);
  /** Profil courant : décide si la route « UGPM par tutelle » peut aboutir (pas d'appel voué au 403). */
  private readonly auth = inject(AuthService);
  private readonly typePieceService = inject(TypePieceJointeService);
  private readonly saisieService = inject(SaisieService);
  private readonly factory = inject(PpmFormFactory);

  readonly loading = signal(true);
  /** Animation de fermeture en cours : retarde l'émission de `fermer` le temps du fondu sortant. */
  readonly closing = signal(false);
  readonly ppm = signal<Ppm | null>(null);
  /** Dossier porteur du PPM — conservé pour la traçabilité de saisie (créé par / soumis par). */
  readonly dossier = signal<Dossier | null>(null);
  /** Entité contractante du dossier (fixe) — sert à interdire un réimport d'un PDF d'une autre entité + affichage. */
  readonly dossierEntite = signal<number | null>(null);
  /** Versionnement : idDetail → type de changement vs la version précédente (surlignage du tableau). */
  readonly changements = signal<Map<number, TypeChangementLigne> | null>(null);
  /** idEntiteContract → libellé (référentiel entités contractantes, un seul chargement). */
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  /** Libellé de l'entité contractante du dossier (affiché dans l'en-tête). */
  readonly entiteLabel = computed(() => {
    const id = this.dossierEntite();
    return id != null ? this.entiteMap().get(String(id)) ?? '#' + id : '—';
  });
  /** Fiche complète de l'entité du dossier (onglet « Entité contractante »). */
  readonly entiteDetail = computed(() => {
    const id = this.dossierEntite();
    return id != null ? this.entites().find((e) => e.idEntiteContract === id) ?? null : null;
  });
  /** Localité de l'entité, ou à défaut celle portée par le PPM. */
  readonly localiteLabel = computed(() => {
    const id = this.entiteDetail()?.idLocalite ?? this.ppm()?.idLocalite;
    return id ? this.localiteMap().get(String(id)) ?? id : '—';
  });
  /** PRMP signataire du plan (`Ppm.idPrmp`), fiche complète. */
  readonly prmpDetail = computed(() => {
    const id = this.ppm()?.idPrmp;
    return id ? this.prmps().find((p) => p.idPrmp === id) ?? null : null;
  });
  /**
   * UGPM sous la tutelle de la PRMP du plan, chargées par `GET /api/ugpms/par-tutelle/{idPrmp}`
   * (cf. `chargerUgpmsRattachees`). Depuis la livraison backend `b6f4adb`, les contrôleurs y ont
   * accès : le bloc s'affiche pour eux. Hors Administrateur, le serveur renvoie une **vue
   * restreinte** — identité, matricule, libellé, courriel, téléphone ; ni CIN ni login.
   */
  readonly ugpmsRattachees = computed(() => {
    const id = this.ppm()?.idPrmp;
    return id ? this.ugpms().filter((u) => u.idPrmpTutelle === id) : [];
  });
  /**
   * Auteur de la saisie du dossier. Le serveur expose à la fois le **login** (`creePar` /
   * `soumisPar`) et le **nom lisible** (`creeParNom` / `soumisParNom`) : lui seul peut faire la
   * jointure login → PRMP / UGPM. On affiche donc le nom dès qu'il est résolu, et le login sinon
   * (compte supprimé) — sans jamais dépendre de la lecture du répertoire des UGPM.
   * `null` si le dossier ne porte aucune trace de saisie : le bloc reste alors masqué.
   */
  readonly auteurDossier = computed<{
    libelle: string;
    login?: string;
    soumisPar?: string;
    soumisParLibelle?: string;
    /** Saisie et soumission par le même compte — une seule ligne suffit alors. */
    memeActeur: boolean;
  } | null>(() => {
    const d = this.dossier();
    const login = d?.creePar;
    if (!login) {
      return null;
    }
    const soumisPar = d.soumisPar;
    return {
      libelle: d.creeParNom || login,
      login,
      soumisPar,
      soumisParLibelle: soumisPar ? d.soumisParNom || soumisPar : undefined,
      /** Saisie et soumission par le même compte — le cas courant : une seule ligne suffit. */
      memeActeur: !!soumisPar && soumisPar === login,
    };
  });
  /**
   * ⚠️ 2026-08-20 (demande user) — l'onglet « Entité contractante » s'adresse aux profils qui
   * DÉCOUVRENT le dossier (contrôleurs, administration). La PRMP et l'UGPM y liraient leur propre
   * fiche : redondant pour elles, et trois requêtes pour rien. L'onglet leur est donc masqué.
   */
  readonly afficheIdentites = computed(() => {
    const r = this.auth.role();
    return r !== 'PRMP' && r !== 'UGPM';
  });
  /** Onglet courant — le plan de passation est le motif d'ouverture le plus fréquent du modal. */
  readonly onglet = signal<'entite' | 'ppm' | 'fiche' | 'agpm' | 'pieces'>('ppm');
  /** Fiches d'identité de l'onglet 1 (UGPM vide hors ADMINISTRATEUR : lecture réservée). */
  readonly entites = signal<EntiteContract[]>([]);
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  readonly prmps = signal<Prmp[]>([]);
  readonly ugpms = signal<Ugpm[]>([]);
  readonly marches = signal<Marche[]>([]);
  readonly pieces = signal<PieceJointeDossier[]>([]);
  readonly modeMap = signal<Map<string, string>>(new Map());
  readonly natureMap = signal<Map<string, string>>(new Map());
  readonly capms = signal<Capm[]>([]);
  readonly procErreurs = signal<Record<number, string>>({});

  // Édition de l'en-tête du PPM (modeEdition) : exercice / date signature / libellé.
  readonly editHeaderOpen = signal(false);
  readonly submittingHeader = signal(false);
  readonly headerErrors = signal<Record<string, string>>({});
  headerForm: FormGroup = this.fb.group({});

  // Gestion des pièces jointes (modeEdition) : upload + suppression.
  readonly typesPiece = signal<TypePieceJointe[]>([]);
  readonly uploadType = signal<number | null>(null);
  readonly uploadFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly suppressionPiece = signal<number | null>(null);

  // — Ré-import PDF sur le brouillon (modeEdition) : parse read-only → PRÉVISUALISATION, puis
  //   remplacement en une transaction SEULEMENT à « Enregistrer » (annuler/fermer = rien d'écrit). —
  readonly importEnCours = signal(false);
  /** Import en prévisualisation (null = aucune) — les lignes affichées ne sont PAS persistées. */
  readonly importApercu = signal<SaisiePpmImportResult | null>(null);
  /** Marchés de l'import montés en formulaire (grille éditable partagée) — corps du PUT à l'enregistrement. */
  readonly importMarches = signal<FormArray | null>(null);
  /** Anomalies de transcription par ligne (clé = uid), calculées à l'import — pilotent la revue de la grille. */
  readonly anomaliesImport = signal<Map<number, AnomalieTranscription[]>>(new Map());
  /** ⚠️ Fiche de présentation (2026-09-01) — justification GLOBALE éditée au panneau de réimport (pré-remplie de l'existante). */
  readonly justifFicheImport = signal('');
  /** Grille de saisie partagée (prévisualisation d'import) — lue pour conditionner « Enregistrer ». */
  readonly grid = viewChild(PpmSaisieGrid);
  readonly applyingImport = signal(false);
  /**
   * Réimport refusé (entité du PDF ≠ entité du dossier) : boîte de dialogue d'avertissement (null = fermée).
   * Le mismatch est détecté **au parse** : la prévisualisation n'est PAS chargée (données actuelles conservées).
   */
  readonly reimportRefus = signal<{ autorite: string } | null>(null);
  /**
   * Le résultat d'import concerne-t-il une **autre entité contractante** que le dossier ? L'entité d'un dossier
   * est fixe : réimporter un PDF d'une autre entité injecterait des marchés étrangers. Deux cas de blocage :
   * 1) le PDF **résout** à une entité connue **différente** de celle du dossier (comparaison par id) ;
   * 2) le PDF **ne résout pas** (entité absente du référentiel) mais son **autorité lue diffère** du libellé
   *    de l'entité du dossier (comparaison par nom normalisé, quand les deux noms sont connus).
   */
  private pdfEntiteDifferente(r: SaisiePpmImportResult): boolean {
    const de = this.dossierEntite();
    if (r.idEntiteContract != null) return de != null && r.idEntiteContract !== de;
    // Entité du PDF non résolue → comparaison par nom (sinon on ne bloque pas, faute de base de comparaison).
    const dossNom = de != null ? this.normEntite(this.entiteMap().get(String(de)) ?? '') : '';
    const pdfNom = this.normEntite(r.autoriteContractante ?? '');
    return !!dossNom && !!pdfNom && dossNom !== pdfNom;
  }
  /** Défense : la prévisualisation en cours porte-t-elle une entité ≠ dossier ? (normalement jamais chargée si ≠). */
  readonly entitePdfDifferente = computed(() => {
    const r = this.importApercu();
    return !!r && this.pdfEntiteDifferente(r);
  });

  // — AGPM conditionnel : le PPM porte `agpmRequis` (autorité backend) ; pièce repérée par code stable. —
  /** Type de pièce AGPM parmi les pièces attendues (chargées en modeEdition). */
  private readonly agpmType = computed(() => this.typesPiece().find((t) => t.code === 'AGPM') ?? null);
  /** Le backend requiert-il l'AGPM pour ce PPM ? (`agpmRequis`, lecture seule). */
  readonly agpmRequise = computed(() => this.ppm()?.agpmRequis === true && this.agpmType() != null);
  /** AGPM requis mais pièce non encore déposée. */
  readonly agpmManquante = computed(() => {
    const t = this.agpmType();
    return this.agpmRequise() && t != null && !this.pieces().some((p) => p.idTypePiece === t.idTypePiece);
  });

  // Consultation des dates d'un marché
  readonly modalMarche = signal<Marche | null>(null);
  readonly modalLoading = signal(false);
  readonly modalData = signal<MarchePrevision[]>([]);

  // Édition des dates d'un marché existant
  readonly editMarche = signal<Marche | null>(null);
  readonly editForm = signal<FormGroup | null>(null);
  private readonly editOriginal = signal<MarchePrevision[]>([]);
  readonly editLoading = signal(false);
  readonly submittingEdit = signal(false);

  // Création / édition de ligne de marché
  readonly createOpen = signal(false);
  readonly submittingCreate = signal(false);
  readonly createErrors = signal<Record<string, string>>({});
  createForm: FormGroup = this.fb.group({});
  readonly editingMarche = signal<Marche | null>(null);
  private readonly createOriginalDates = signal<MarchePrevision[]>([]);

  // Édition des services bénéficiaires d'un marché (modeEdition)
  readonly editBenefMarche = signal<Marche | null>(null);
  benefForm: FormGroup = this.fb.group({ lignes: this.fb.array([] as FormGroup[]) });
  private readonly editBenefOriginal = signal<ServiceBeneficiaire[]>([]);
  readonly submittingBenef = signal(false);
  readonly soaList = signal<SoaBeneficiaire[]>([]);

  // Édition des lots d'un marché (allotissement, modeEdition)
  readonly editLotMarche = signal<Marche | null>(null);
  lotForm: FormGroup = this.fb.group({ lignes: this.fb.array([] as FormGroup[]) });
  private readonly editLotOriginal = signal<Lot[]>([]);
  readonly submittingLot = signal(false);

  // Suppression (marché ou PPM)
  readonly confirmState = signal<CibleSuppression | null>(null);
  readonly confirmBusy = signal(false);

  readonly natures = signal<Nature[]>([]);
  readonly modes = signal<ModePassation[]>([]);
  readonly comptes = signal<Compte[]>([]);
  /** Options du select « Forme du marché » (liste fermée, libellés d'affichage). */
  readonly formes = (Object.entries(FORME_MARCHE_LIBELLES) as [FormeMarche, string][]).map(([code, libelle]) => ({ code, libelle }));
  readonly refsLoading = signal(false);
  private refsLoaded = false;

  /** Services bénéficiaires des marchés du PPM (lecture seule) + libellés SOA / compte. */
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
  /** Lots (allotissement) des marchés du PPM. */
  readonly lots = signal<Lot[]>([]);
  private readonly lotParDetail = computed(() => {
    const map = new Map<number, Lot[]>();
    for (const l of this.lots()) {
      const list = map.get(l.idDetail) ?? [];
      list.push(l);
      map.set(l.idDetail, list);
    }
    return map;
  });
  /** Dates prévisionnelles (bulk, lecture seule sous chaque marché). */
  readonly previsions = signal<MarchePrevision[]>([]);

  /**
   * ⚠️ Demande user (2026-09-01) — onglet « Fiche de présentation » : les trois listes du
   * formulaire officiel, DÉRIVÉES du plan (fonction pure testée, rien de persisté).
   */
  readonly fiche = computed(() =>
    calculerFichePresentation(this.marches(), this.previsions(), this.modes(), this.capms()),
  );

  /** Montant au format français (« — » si absent) — même rendu que la table des marchés. */
  montantFr(v?: number): string {
    return v == null ? '—' : new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(v);
  }

  /**
   * ⚠️ Demande user (2026-09-01) — libellé de version de la fiche : « Initial » pour le plan
   * d'origine, « Mise à jour n° N » (numMaj) pour une version de mise à jour.
   */
  libelleVersionFiche(): string {
    const n = this.ppm()?.numMaj ?? 0;
    return n > 0 ? `Mise à jour n° ${n}` : 'Initial';
  }

  /**
   * ⚠️ Demande user (2026-09-01) — « Projet d'AGPM » dérivé du plan : marchés dont le mode porte
   * `declencheAgpm` (fonction pure testée) ; nature résolue par le référentiel d'affichage.
   */
  readonly agpm = computed(() =>
    calculerAgpm(
      this.marches(),
      this.previsions(),
      this.modes(),
      this.capms(),
      new Map([...this.natureMap()].map(([k, v]) => [Number(k), v])),
    ),
  );

  /** Date `yyyy-MM-dd` → `dd/MM/yyyy` (« — » si absente) — format des documents officiels. */
  dateCourt(iso?: string | null): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  }
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

  ngOnInit(): void {
    this.charger();
  }

  /** Charge le PPM, ses marchés, ses pièces jointes et les référentiels d'affichage (modes, CAPM). */
  private charger(): void {
    this.loading.set(true);
    // Types de pièces attendus (édition) — famille DDP (planification).
    if (this.modeEdition) {
      this.typePieceService.getByTypeDossier('DDP').subscribe((rows) => this.typesPiece.set(rows));
    }
    // UNE SEULE VAGUE : les référentiels d'affichage sont joints au même forkJoin que les données —
    // le corps se rend une fois complet (pas de libellés qui « clignotent » à mesure des arrivées).
    forkJoin({
      ppm: this.ppmService.getById(this.idPpm),
      dossier: this.dossierService.getById(this.idDossier),
      marches: this.marcheService.list(),
      pieces: this.pieceService.getByDossier(this.idDossier),
      benefs: this.serviceBenefService.list(),
      previsions: this.previsionService.list(),
      lots: this.lotService.list(),
      // ⚠️ Fiche de présentation (2026-09-01) — la LISTE complète des modes (categorie,
      // delaiMinJours) remplace le simple lookup de libellés : un seul appel, deux usages.
      modes: this.modeService.list(),
      natureMap: this.lookups.lookup(NatureService, 'idNature', ['libelle']),
      entiteMap: this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']),
      compteMap: this.lookups.lookup(CompteService, 'numCompte', ['libelle']),
      // Liste SOA (dropdown d'édition) + map libellés (affichage) en un seul appel.
      soas: this.soaBenefService.list(),
      capms: this.capmService.getAll(),
      // ⚠️ Onglet « Entité contractante » (2026-08-19) : chargé dans LA MÊME vague que le reste —
      // ouvrir l'onglet ne doit déclencher aucun appel ni spinner tardif.
      // `prmps` échoue en silence (lecture réservée selon le profil) : le bloc est alors absent.
      // Les UGPM ne sont PLUS lues ici : la liste complète est réservée à l'ADMINISTRATEUR et
      // provoquait un 403 à chaque ouverture du modal. On interroge désormais la route ciblée
      // `par-tutelle/{idPrmp}` — mais elle exige l'identifiant de la PRMP, connu seulement une fois
      // le plan chargé : voir `chargerUgpmsRattachees`, déclenché juste après.
      entites: this.afficheIdentites() ? this.entiteService.listeSilencieuse().pipe(catchError(() => of([] as EntiteContract[]))) : of([] as EntiteContract[]),
      localiteMap: this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']),
      prmps: this.afficheIdentites() ? this.prmpService.listeSilencieuse().pipe(catchError(() => of([] as Prmp[]))) : of([] as Prmp[]),
    }).subscribe({
      next: ({ ppm, dossier, marches, pieces, benefs, previsions, lots, modes, natureMap, entiteMap, compteMap, soas, capms, entites, localiteMap, prmps }) => {
        this.entites.set(entites);
        this.localiteMap.set(localiteMap);
        this.prmps.set(prmps);
        this.chargerUgpmsRattachees(ppm?.idPrmp);
        this.modes.set(modes);
        this.modeMap.set(new Map(modes.map((m) => [String(m.idMode), m.libelle ?? ''])));
        this.natureMap.set(natureMap);
        this.entiteMap.set(entiteMap);
        this.compteMap.set(compteMap);
        this.soaList.set(soas);
        this.soaMap.set(new Map(soas.map((s) => [s.soaCode, s.libelle ?? ''])));
        this.capms.set([...capms].sort((a, b) => a.ordre - b.ordre));
        this.ppm.set(ppm);
        this.dossier.set(dossier);
        this.dossierEntite.set(dossier?.idEntiteContract ?? null);
        this.chargerChangements(dossier);
        const mine = marches.filter((m) => m.idPpm === this.idPpm);
        this.marches.set(mine);
        this.pieces.set(pieces);
        // Bénéficiaires + dates + lots : ne garder que ceux des marchés du PPM (pas de filtre par PPM côté API).
        const detailIds = new Set(mine.map((m) => m.idDetail));
        this.serviceBenefs.set(benefs.filter((b) => detailIds.has(b.idDetail)));
        this.previsions.set(previsions.filter((p) => detailIds.has(p.idDetail)));
        this.lots.set(lots.filter((l) => detailIds.has(l.idDetail)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false), // 403/404 → toast centralisé
    });
  }

  /**
   * Unités de gestion rattachées à la PRMP du plan — `GET /api/ugpms/par-tutelle/{idPrmp}`.
   *
   * ⚠️ Fin du 403 silencieux (2026-08-19), puis ouverture aux contrôleurs (2026-08-20). L'écran
   * lisait au départ la liste COMPLÈTE des UGPM, réservée à l'ADMINISTRATEUR : chaque ouverture du
   * modal déclenchait un 403 qu'il fallait taire. On interroge désormais la route ciblée, que le
   * backend (`b6f4adb`) ouvre aux profils qui **instruisent** le dossier — pour toute tutelle et
   * sans filtre de localité. Le bloc apparaît donc enfin à ceux qui en ont l'usage.
   * Appelé après le chargement principal (l'identifiant de la PRMP vient du plan) ; l'affichage du
   * bloc ne bloque pas le rendu du modal.
   */
  private chargerUgpmsRattachees(idPrmp?: string): void {
    this.ugpms.set([]);
    // Dernier filtre, miroir du @PreAuthorize serveur : le Chargé de publication, hors instruction,
    // recevrait un 403 — on ne lui émet pas la requête plutôt que d'avoir à la taire. (PRMP et UGPM
    // sont déjà écartées en amont : l'onglet leur est masqué, et le serveur ne leur ouvrirait de
    // toute façon que leur propre tutelle.)
    const role = this.auth.role();
    if (!idPrmp || !this.afficheIdentites() || !role || !ROLES_UGPM_PAR_TUTELLE.includes(role)) {
      return;
    }
    this.ugpmService.parTutelle(idPrmp).subscribe({
      next: (rows) => this.ugpms.set(rows),
      error: () => this.ugpms.set([]), // filet : le bloc reste simplement absent
    });
  }

  /**
   * Dossier issu d'une mise à jour (`idDossierParent` renseigné) → charge le diff vs la version précédente
   * pour surligner les lignes changées. Appel **silencieux** : 403 (profil non propriétaire) / 409 → pas de
   * surlignage, l'affichage reste complet.
   */
  private chargerChangements(dossier: Dossier | null | undefined): void {
    if (dossier?.idDossierParent == null) return;
    this.miseAJourService.diff(dossier.idDossier, true).subscribe({
      next: (diff) => {
        const m = new Map<number, TypeChangementLigne>();
        for (const l of diff.lignes) if (l.idDetail != null) m.set(l.idDetail, l.type);
        this.changements.set(m);
      },
      error: () => {},
    });
  }

  // — Ré-import PDF (modeEdition) : parse read-only → prévisualisation, remplacement à « Enregistrer ». —
  importerPdf(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // autorise la re-sélection du même fichier
    if (!file) return;
    this.importEnCours.set(true);
    this.chargerReferentiels(); // datalists (nature/mode/compte) de la grille éditable
    this.saisieService.importPpm(file).subscribe({
      next: (r) => {
        this.importEnCours.set(false);
        // Entité du PDF ≠ entité du dossier → réimport refusé : NE PAS charger la prévisualisation
        // (les lignes actuelles restent intactes), avertir via une boîte de dialogue.
        if (this.pdfEntiteDifferente(r)) {
          this.reimportRefus.set({ autorite: (r.autoriteContractante ?? '').trim() || '(entité non identifiée)' });
          return;
        }
        // Prévisualisation seulement : rien n'est écrit tant qu'« Enregistrer » n'est pas cliqué.
        // Marchés montés en formulaire via la MÊME fabrique qu'à la soumission (grille éditable partagée),
        // + revue de transcription (anomalies backend, hors REFERENTIEL_INCONNU géré à la volée au POST).
        const arr = this.fb.array([] as FormGroup[]);
        const anomMap = new Map<number, AnomalieTranscription[]>();
        for (const m of r.marches ?? []) {
          const g = this.factory.construireMarcheDepuisImport(m, this.capms(), this.modes());
          arr.push(g);
          const anom = (m.anomalies ?? []).filter((a) => a.type !== 'REFERENTIEL_INCONNU');
          if (anom.length) anomMap.set(g.get('uid')!.value as number, anom);
        }
        this.importApercu.set(r);
        this.importMarches.set(arr);
        this.anomaliesImport.set(anomMap);
        // ⚠️ Fiche de présentation (2026-09-01) — la justification GLOBALE part avec le PUT (garde
        // serveur si une liste de la fiche est non vide) : pré-remplie de l'existante, éditable.
        this.justifFicheImport.set(this.ppm()?.justificationFiche ?? '');
      },
      error: () => this.importEnCours.set(false), // 400 PDF illisible → toast centralisé
    });
  }
  /** Abandonne la prévisualisation : aucune écriture n'a eu lieu, le contenu existant reste tel quel. */
  annulerImport(): void {
    if (this.applyingImport()) return;
    this.importApercu.set(null);
    this.importMarches.set(null);
    this.anomaliesImport.set(new Map());
  }
  /** Vrai si la grille d'import est prête à être enregistrée (toutes les lignes signalées validées + montants cohérents). */
  importPret(): boolean {
    const g = this.grid();
    return !!this.importMarches() && !!g && g.nbAValiderRestantes() === 0 && g.benefsCoherents;
  }
  /**
   * Info-bulle du bouton « Enregistrer » de l'import. Sortie du gabarit à dessein : une apostrophe
   * échappée dans une expression inline met en échec l'analyseur de gabarits d'ESLint (le
   * compilateur Angular, lui, l'accepte) — les trois textes sont identiques.
   */
  titreEnregistrerImport(): string {
    if (this.entitePdfDifferente()) {
      return 'Le PDF concerne une autre entité contractante que le dossier.';
    }
    return this.importPret()
      ? ''
      : "Validez chaque ligne signalée et corrigez les montants incohérents avant d'enregistrer.";
  }
  /** Normalise un nom d'entité pour comparaison tolérante (majuscules, sans accents/diacritiques, espaces réduits). */
  private normEntite(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }
  /** Enregistre le remplacement : `PUT /api/saisies/ppm/{idDossier}` (réconciliation — lignes actuelles retirées). */
  enregistrerImport(): void {
    const r = this.importApercu();
    const p = this.ppm();
    const arr = this.importMarches();
    if (!r || !p || !arr) return;
    if (this.entitePdfDifferente()) return; // garde : entité du PDF ≠ entité du dossier
    // Corps du PUT reconstruit depuis la grille éditée (mapping identique à la soumission) : lignes non vides,
    // lot-objet par défaut, dates de fin optionnelles.
    const lignes: SaisieMarcheLigne[] = (arr.controls as FormGroup[])
      .map((g) => g.getRawValue() as Record<string, unknown>)
      .filter((l) => this.factory.ligneNonVide(l))
      .map((l) => this.factory.payloadDepuisMarche(l));
    this.applyingImport.set(true);
    const req: EditionPpmRequest = {
      // En-tête : exercice/date du PDF (repli sur l'existant) ; signataire/référence actuels conservés (non extraits).
      exercice: r.exercice ?? p.exercice,
      dateSignature: r.dateSignature ?? p.dateSignature,
      signataire: p.signataire,
      reference: p.reference,
      marches: lignes,
      // ⚠️ Fiche de présentation (2026-09-01) — toujours renvoyée (éditée au panneau d'import).
      justificationFiche: this.justifFicheImport().trim() || undefined,
    };
    this.saisieService.editionPpm(this.idDossier, req).subscribe({
      next: () => {
        this.toast.success('Brouillon remplacé par le contenu du PDF.');
        this.applyingImport.set(false);
        this.importApercu.set(null);
        this.importMarches.set(null);
        this.anomaliesImport.set(new Map());
        this.charger();
        this.modifie.emit();
      },
      error: (e: ApiError) => {
        this.applyingImport.set(false);
        // 400 fieldErrors : pas de formulaire ici → toast explicite, préfixé par la ligne (marches[11] → Ligne 12).
        const detail = e.fieldErrors
          ? Object.entries(e.fieldErrors)
              .map(([champ, msg]) => {
                const m = champ.match(/^marches\[(\d+)\]/);
                return m ? `Ligne ${Number(m[1]) + 1} : ${msg}` : msg;
              })
              .join(' ')
          : '';
        this.toast.error(detail || e.message || 'Échec du remplacement.', 'Import impossible');
      },
    });
  }
  /** Dates prévisionnelles d'un marché (triées par ordre CAPM ; lecture seule). */
  datesDe(idDetail: number): MarchePrevision[] {
    return this.prevParDetail().get(idDetail) ?? [];
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

  emitFermer(): void {
    if (this.closing()) {
      return;
    }
    // Joue le fondu sortant (.closing) avant de demander la fermeture à l'hôte.
    this.closing.set(true);
    setTimeout(() => {
      this.closing.set(false);
      this.fermer.emit();
    }, 160);
  }

  // — Édition de l'en-tête du PPM (PUT /api/ppms/{id}) : en-tête seul, marchés non touchés —
  ouvrirEditionHeader(): void {
    const p = this.ppm();
    if (!p) {
      return;
    }
    this.headerErrors.set({});
    this.headerForm = this.fb.group({
      exercice: [p.exercice, Validators.required],
      dateSignature: [p.dateSignature, Validators.required],
      libelle: [p.libelle ?? ''],
    });
    this.editHeaderOpen.set(true);
  }
  annulerEditionHeader(): void {
    if (!this.submittingHeader()) {
      this.editHeaderOpen.set(false);
    }
  }
  headerErr(key: string): string | undefined {
    return this.headerErrors()[key];
  }
  enregistrerHeader(): void {
    const p = this.ppm();
    if (!p) {
      return;
    }
    if (this.headerForm.invalid) {
      this.headerForm.markAllAsTouched();
      return;
    }
    const v = this.headerForm.getRawValue();
    this.submittingHeader.set(true);
    this.headerErrors.set({});
    // Entité / référence / signataire fixés serveur → renvoyés inchangés. Le spread embarque aussi
    // `version` (verrou optimiste) : le serveur refuse le PUT si le plan a bougé depuis le chargement.
    const body: Ppm = { ...p, exercice: v.exercice, dateSignature: v.dateSignature, libelle: v.libelle || undefined };
    this.ppmService.update(p.idPpm, body).subscribe({
      next: (updated) => {
        // La réponse porte la version incrémentée : la reposer permet d'enchaîner une 2e édition.
        this.ppm.set(updated);
        this.submittingHeader.set(false);
        this.editHeaderOpen.set(false);
        this.toast.success('En-tête du PPM mis à jour.');
        this.modifie.emit();
      },
      error: (e: ApiError) => {
        this.submittingHeader.set(false);
        if (estConflitVersion(e)) {
          // Le plan a changé ailleurs : la saisie est perdue (le toast centralisé le dit), on repart du serveur.
          this.editHeaderOpen.set(false);
          this.charger();
          return;
        }
        this.headerErrors.set(e.fieldErrors ?? {});
      },
    });
  }

  // — Pièces jointes (upload / suppression, modeEdition) —
  onUploadFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f) {
      const erreurFichier = validerFichier(f);
      if (erreurFichier) {
        this.toast.error(erreurFichier);
        input.value = '';
        this.uploadFile.set(null);
        return;
      }
    }
    this.uploadFile.set(f);
  }
  ajouterPiece(): void {
    const type = this.uploadType();
    const file = this.uploadFile();
    if (type == null || !file) {
      this.toast.error('Sélectionnez un type de pièce et un fichier.');
      return;
    }
    const fd = new FormData();
    fd.append(
      'data',
      new Blob([JSON.stringify({ idDossier: this.idDossier, idTypePiece: type })], { type: 'application/json' }),
    );
    fd.append('fichier', file);
    this.uploading.set(true);
    this.pieceService.upload(fd).subscribe({
      next: () => {
        this.toast.success('Pièce ajoutée.');
        this.uploadType.set(null);
        this.uploadFile.set(null);
        this.uploading.set(false);
        this.rechargerPieces();
        this.modifie.emit();
      },
      error: (e: ApiError) => {
        this.uploading.set(false);
        this.toast.error(e.message || "Erreur lors de l'ajout de la pièce.");
      },
    });
  }
  supprimerPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) {
      return;
    }
    this.suppressionPiece.set(p.idPiece);
    this.pieceService.supprimer(p.idPiece).subscribe({
      next: () => {
        this.toast.success('Pièce supprimée.');
        this.suppressionPiece.set(null);
        this.rechargerPieces();
        this.modifie.emit();
      },
      error: () => this.suppressionPiece.set(null),
    });
  }
  private rechargerPieces(): void {
    this.pieceService.getByDossier(this.idDossier).subscribe((rows) => this.pieces.set(rows));
  }

  // — Alias appelés par le template (mode édition) —
  nouveauMarche(): void {
    this.ouvrirCreation();
  }
  voirDates(m: Marche): void {
    this.ouvrirDates(m);
  }
  modifierDates(m: Marche): void {
    this.ouvrirEdition(m);
  }
  modifierMarche(m: Marche): void {
    this.ouvrirEditionLigne(m);
  }
  supprimerMarche(m: Marche): void {
    this.demanderSuppressionMarche(m);
  }
  /** Ouvre la confirmation de suppression du PPM courant (cascade marchés + dates côté backend). */
  supprimerPpm(): void {
    const p = this.ppm();
    if (!p) {
      return;
    }
    this.confirmState.set({ kind: 'ppm', id: p.idPpm, label: p.reference || `PPM #${p.idPpm}`, count: this.marches().length });
  }

  // — Pièces jointes —
  piecesInitiales(): PieceJointeDossier[] {
    return this.pieces().filter((p) => !p.apresLettreRenvoi && !p.versionCorrigee);
  }
  piecesApresRenvoi(): PieceJointeDossier[] {
    return this.pieces().filter((p) => p.apresLettreRenvoi);
  }
  /** ⚠️ 2026-08-03 — versions CORRIGÉES déposées pendant la rectification (distinctes des originales). */
  piecesCorrigees(): PieceJointeDossier[] {
    return this.pieces().filter((p) => !p.apresLettreRenvoi && p.versionCorrigee);
  }
  ouvrirPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) {
      return;
    }
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (blob) => ouvrirBlobSur(blob),
      error: () => this.toast.error("Impossible d'ouvrir la pièce."),
    });
  }

  // — Consultation des dates —
  ouvrirDates(m: Marche): void {
    this.modalMarche.set(m);
    this.modalLoading.set(true);
    this.modalData.set([]);
    this.previsionService.byMarche(m.idDetail).subscribe({
      next: (data) => {
        this.modalData.set(data);
        this.modalLoading.set(false);
      },
      error: () => this.modalLoading.set(false),
    });
  }
  fermerDates(): void {
    this.modalMarche.set(null);
  }

  // — Dates prévisionnelles par processus CAPM (création + édition) —
  capmLabel(id: number): string {
    return libelleCapm(this.capms(), id);
  }
  procErreur(idCapm: number | null): string | undefined {
    return idCapm == null ? undefined : this.procErreurs()[idCapm];
  }
  private validerChronologie(controls: FormGroup[]): boolean {
    const parId = new Map(this.capms().map((c) => [c.idCapm, c]));
    const items = controls
      .map((g) => ({
        idCapm: g.get('idCapm')!.value as number | null,
        dateDebut: g.get('dateDebut')!.value as string,
        dateFin: g.get('dateFin')!.value as string,
      }))
      .filter((p) => p.idCapm != null && p.dateDebut && p.dateFin)
      .sort((a, b) => (parId.get(a.idCapm!)?.ordre ?? 0) - (parId.get(b.idCapm!)?.ordre ?? 0));
    const err: Record<number, string> = {};
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (p.dateDebut >= p.dateFin) {
        err[p.idCapm!] = 'La date de fin doit être postérieure à la date de début.';
        continue;
      }
      if (i > 0 && p.dateDebut < items[i - 1].dateFin) {
        const lib = parId.get(p.idCapm!)?.libelleProcessus ?? '#' + p.idCapm;
        const libPrec = parId.get(items[i - 1].idCapm!)?.libelleProcessus ?? '#' + items[i - 1].idCapm;
        err[p.idCapm!] = `La date de début de ${lib} doit être postérieure ou égale à la date de fin de ${libPrec}.`;
      }
    }
    this.procErreurs.set(err);
    return Object.keys(err).length === 0;
  }
  private ligneDate(p?: Partial<MarchePrevision>): FormGroup {
    return this.fb.group({
      idPrevision: [p?.idPrevision ?? null],
      idCapm: [p?.idCapm ?? null, Validators.required],
      dateDebut: [p?.dateDebut ?? '', Validators.required],
      // Date de fin **optionnelle** (backend : `dateFin` nullable ; chronologie ignorée si absente).
      dateFin: [p?.dateFin ?? ''],
    });
  }
  datesControls(form: FormGroup): FormGroup[] {
    return (form.get('datesPrev') as FormArray).controls as FormGroup[];
  }
  /** Mode de passation du contexte du formulaire de dates : marché en édition, sinon champ `idMode` (création). */
  private modeDuForm(form: FormGroup): number | null {
    if (form === this.editForm()) return this.editMarche()?.idMode ?? null;
    return (form.get('idMode')?.value as number | null) ?? null;
  }
  /** Grille CAPM EFFECTIVE du contexte (spécifiques au mode — ou son modèle partagé — sinon communs). */
  private capmsEffectifsDe(form: FormGroup): Capm[] {
    return this.factory.capmsEffectifsParMode(this.capms(), this.modeDuForm(form), this.modes());
  }
  capmsPourLigne(form: FormGroup, ctrl: FormGroup): Capm[] {
    const autres = new Set(
      this.datesControls(form)
        .filter((g) => g !== ctrl)
        .map((g) => g.get('idCapm')!.value as number)
        .filter((v) => v != null),
    );
    return this.capmsEffectifsDe(form).filter((c) => !autres.has(c.idCapm));
  }
  /** Options du sélecteur regroupées par phase du modèle (`groupe` ; null = sans phase). */
  groupesPourLigne(form: FormGroup, ctrl: FormGroup): { groupe: string | null; capms: Capm[] }[] {
    const groupes: { groupe: string | null; capms: Capm[] }[] = [];
    for (const c of this.capmsPourLigne(form, ctrl)) {
      const g = c.groupe ?? null;
      const dernier = groupes[groupes.length - 1];
      if (dernier && dernier.groupe === g) dernier.capms.push(c);
      else groupes.push({ groupe: g, capms: [c] });
    }
    return groupes;
  }
  peutAjouterDate(form: FormGroup): boolean {
    const utilises = new Set(this.datesControls(form).map((g) => g.get('idCapm')!.value as number));
    return this.capmsEffectifsDe(form).some((c) => !utilises.has(c.idCapm));
  }
  ajouterDate(form: FormGroup): void {
    const utilises = new Set(this.datesControls(form).map((g) => g.get('idCapm')!.value as number));
    const libre = this.capmsEffectifsDe(form).find((c) => !utilises.has(c.idCapm));
    (form.get('datesPrev') as FormArray).push(this.ligneDate({ idCapm: libre?.idCapm }));
  }
  retirerDate(form: FormGroup, i: number): void {
    (form.get('datesPrev') as FormArray).removeAt(i);
  }

  ouvrirEdition(m: Marche): void {
    this.procErreurs.set({});
    this.editMarche.set(m);
    this.editLoading.set(true);
    const form = this.fb.group({ datesPrev: this.fb.array([] as FormGroup[]) });
    this.editForm.set(form);
    this.previsionService.byMarche(m.idDetail).subscribe({
      next: (rows) => {
        this.editOriginal.set(rows);
        const arr = form.get('datesPrev') as FormArray;
        rows.forEach((p) => arr.push(this.ligneDate(p)));
        this.editLoading.set(false);
      },
      error: () => this.editLoading.set(false),
    });
  }
  annulerEdition(): void {
    this.procErreurs.set({});
    this.editMarche.set(null);
    this.editForm.set(null);
    this.editOriginal.set([]);
  }
  enregistrerEdition(): void {
    const m = this.editMarche();
    const form = this.editForm();
    if (!m || !form) return;
    if (!this.validerChronologie(this.datesControls(form))) {
      return;
    }
    const rows = (form.get('datesPrev') as FormArray).getRawValue() as {
      idPrevision: number | null;
      idCapm: number | null;
      dateDebut: string;
      dateFin: string;
    }[];
    this.submittingEdit.set(true);
    this.reconcilierDates(
      m.idDetail,
      this.editOriginal(),
      rows,
      () => {
        this.toast.success('Dates prévisionnelles enregistrées.');
        this.submittingEdit.set(false);
        this.annulerEdition();
        this.modifie.emit();
      },
      () => this.submittingEdit.set(false),
    );
  }

  private reconcilierDates(
    idDetail: number,
    original: MarchePrevision[],
    rows: { idPrevision: number | null; idCapm: number | null; dateDebut: string; dateFin: string }[],
    done: () => void,
    fail: () => void,
  ): void {
    const currentIds = new Set(rows.filter((r) => r.idPrevision != null).map((r) => r.idPrevision));
    const toDelete = original.filter((o) => !currentIds.has(o.idPrevision));
    const toUpdate = rows.filter((r) => r.idPrevision != null);
    const toCreate = rows.filter((r) => r.idPrevision == null && r.idCapm != null);
    const run = (base: number) => {
      const ops = [
        ...toDelete.map((o) => this.previsionService.delete(o.idPrevision)),
        ...toUpdate.map((r) =>
          this.previsionService.update(r.idPrevision as number, {
            idPrevision: r.idPrevision as number,
            idDetail,
            idCapm: r.idCapm as number,
            dateDebut: r.dateDebut,
            // Date de fin optionnelle : chaîne vide → omise (date ISO ou rien, pas '').
            dateFin: r.dateFin || undefined,
          }),
        ),
        ...toCreate.map((r, i) =>
          this.previsionService.create({
            idPrevision: base + i + 1,
            idDetail,
            idCapm: r.idCapm as number,
            dateDebut: r.dateDebut,
            // Date de fin optionnelle : chaîne vide → omise (date ISO ou rien, pas '').
            dateFin: r.dateFin || undefined,
          }),
        ),
      ];
      if (!ops.length) {
        done();
        return;
      }
      forkJoin(ops).subscribe({ next: () => done(), error: () => fail() });
    };
    if (toCreate.length) {
      this.previsionService.list().subscribe((all) => run(all.length ? Math.max(...all.map((p) => p.idPrevision)) : 0));
    } else {
      run(0);
    }
  }

  // — Édition des services bénéficiaires d'un marché (CRUD + réconciliation) —
  private ligneBenef(b?: ServiceBeneficiaire): FormGroup {
    return this.fb.group({
      idBenef: [b?.idBenef ?? null],
      soaCode: [b?.soaCode ?? null],
      numCompte: [b?.numCompte ?? null],
      ancMontBenef: [b?.ancMontBenef ?? null],
      nouvMontBenef: [b?.nouvMontBenef ?? null],
    });
  }
  modifierBenefs(m: Marche): void {
    this.chargerReferentiels(); // comptes pour le sélecteur
    this.editBenefMarche.set(m);
    const current = this.benefsDe(m.idDetail);
    this.editBenefOriginal.set(current);
    this.benefForm = this.fb.group({ lignes: this.fb.array(current.map((b) => this.ligneBenef(b))) });
  }
  ajouterBenef(): void {
    (this.benefForm.get('lignes') as FormArray).push(this.ligneBenef());
  }
  retirerBenef(i: number): void {
    (this.benefForm.get('lignes') as FormArray).removeAt(i);
  }
  annulerBenefs(): void {
    this.editBenefMarche.set(null);
    this.editBenefOriginal.set([]);
  }
  enregistrerBenefs(): void {
    const m = this.editBenefMarche();
    if (!m) return;
    const rows = (this.benefForm.get('lignes') as FormArray).getRawValue() as {
      idBenef: number | null;
      soaCode: string | null;
      numCompte: string | null;
      ancMontBenef: number | null;
      nouvMontBenef: number | null;
    }[];
    this.submittingBenef.set(true);
    this.reconcilierBenefs(
      m.idDetail,
      this.editBenefOriginal(),
      rows,
      () => {
        this.toast.success('Services bénéficiaires enregistrés.');
        this.submittingBenef.set(false);
        this.annulerBenefs();
        this.rechargerBenefs();
        this.modifie.emit();
      },
      () => this.submittingBenef.set(false),
    );
  }
  private rechargerBenefs(): void {
    const detailIds = new Set(this.marches().map((m) => m.idDetail));
    this.serviceBenefService.list().subscribe((rows) => this.serviceBenefs.set(rows.filter((b) => detailIds.has(b.idDetail))));
  }
  private reconcilierBenefs(
    idDetail: number,
    original: ServiceBeneficiaire[],
    rows: { idBenef: number | null; soaCode: string | null; numCompte: string | null; ancMontBenef: number | null; nouvMontBenef: number | null }[],
    done: () => void,
    fail: () => void,
  ): void {
    const currentIds = new Set(rows.filter((r) => r.idBenef != null).map((r) => r.idBenef));
    const toDelete = original.filter((o) => !currentIds.has(o.idBenef));
    const toUpdate = rows.filter((r) => r.idBenef != null);
    const toCreate = rows.filter((r) => r.idBenef == null);
    const body = (r: (typeof rows)[number], id: number): ServiceBeneficiaire => ({
      idBenef: id,
      idDetail,
      soaCode: r.soaCode || undefined,
      numCompte: r.numCompte || undefined,
      ancMontBenef: r.ancMontBenef ?? undefined,
      nouvMontBenef: r.nouvMontBenef ?? undefined,
    });
    const run = (base: number) => {
      const ops = [
        ...toDelete.map((o) => this.serviceBenefService.delete(o.idBenef)),
        ...toUpdate.map((r) => this.serviceBenefService.update(r.idBenef as number, body(r, r.idBenef as number))),
        ...toCreate.map((r, i) => this.serviceBenefService.create(body(r, base + i + 1))),
      ];
      if (!ops.length) {
        done();
        return;
      }
      forkJoin(ops).subscribe({ next: () => done(), error: () => fail() });
    };
    if (toCreate.length) {
      this.serviceBenefService.list().subscribe((all) => run(all.length ? Math.max(...all.map((b) => b.idBenef)) : 0));
    } else {
      run(0);
    }
  }

  // — Édition des lots d'un marché (allotissement : CRUD + réconciliation, comme les bénéficiaires) —
  /** Lots d'un marché (lecture seule, pour le compteur du bouton). */
  lotsDe(idDetail: number): Lot[] {
    return this.lotParDetail().get(idDetail) ?? [];
  }
  private ligneLot(l?: Lot): FormGroup {
    return this.fb.group({
      idLot: [l?.idLot ?? null],
      designationLot: [l?.designationLot ?? '', Validators.required],
      montLot: [l?.montLot ?? null],
      qteLot: [l?.qteLot ?? null],
      uniteLot: [l?.uniteLot ?? ''],
    });
  }
  modifierLots(m: Marche): void {
    this.editLotMarche.set(m);
    const current = this.lotsDe(m.idDetail);
    this.editLotOriginal.set(current);
    this.lotForm = this.fb.group({ lignes: this.fb.array(current.map((l) => this.ligneLot(l))) });
  }
  ajouterLot(): void {
    (this.lotForm.get('lignes') as FormArray).push(this.ligneLot());
  }
  retirerLot(i: number): void {
    (this.lotForm.get('lignes') as FormArray).removeAt(i);
  }
  annulerLots(): void {
    this.editLotMarche.set(null);
    this.editLotOriginal.set([]);
  }
  enregistrerLots(): void {
    const m = this.editLotMarche();
    if (!m) return;
    if (this.lotForm.invalid) {
      this.lotForm.markAllAsTouched();
      this.toast.error('La désignation est obligatoire pour chaque lot.');
      return;
    }
    const rows = (this.lotForm.get('lignes') as FormArray).getRawValue() as {
      idLot: number | null;
      designationLot: string;
      montLot: number | null;
      qteLot: number | null;
      uniteLot: string;
    }[];
    this.submittingLot.set(true);
    this.reconcilierLots(
      m.idDetail,
      m.idDossier,
      this.editLotOriginal(),
      rows,
      () => {
        this.toast.success('Lots enregistrés.');
        this.submittingLot.set(false);
        this.annulerLots();
        this.rechargerLots();
        this.modifie.emit();
      },
      () => this.submittingLot.set(false),
    );
  }
  private rechargerLots(): void {
    const detailIds = new Set(this.marches().map((m) => m.idDetail));
    this.lotService.list().subscribe((rows) => this.lots.set(rows.filter((l) => detailIds.has(l.idDetail))));
  }
  private reconcilierLots(
    idDetail: number,
    idDossier: number,
    original: Lot[],
    rows: { idLot: number | null; designationLot: string; montLot: number | null; qteLot: number | null; uniteLot: string }[],
    done: () => void,
    fail: () => void,
  ): void {
    const currentIds = new Set(rows.filter((r) => r.idLot != null).map((r) => r.idLot));
    const toDelete = original.filter((o) => !currentIds.has(o.idLot));
    const toUpdate = rows.filter((r) => r.idLot != null);
    const toCreate = rows.filter((r) => r.idLot == null);
    const body = (r: (typeof rows)[number], id: number): Lot => ({
      idLot: id,
      idDossier,
      idDetail,
      designationLot: r.designationLot.trim(),
      montLot: r.montLot ?? undefined,
      qteLot: r.qteLot ?? undefined,
      uniteLot: r.uniteLot || undefined,
    });
    const run = (base: number) => {
      const ops = [
        ...toDelete.map((o) => this.lotService.delete(o.idLot)),
        ...toUpdate.map((r) => this.lotService.update(r.idLot as number, body(r, r.idLot as number))),
        ...toCreate.map((r, i) => this.lotService.create(body(r, base + i + 1))),
      ];
      if (!ops.length) {
        done();
        return;
      }
      forkJoin(ops).subscribe({ next: () => done(), error: () => fail() });
    };
    if (toCreate.length) {
      this.lotService.list().subscribe((all) => run(all.length ? Math.max(...all.map((l) => l.idLot)) : 0));
    } else {
      run(0);
    }
  }

  private construireForm(m?: Marche): void {
    const p = this.ppm();
    this.createForm = this.fb.group({
      idDetail: [{ value: m?.idDetail ?? null, disabled: true }],
      idDossier: [{ value: m?.idDossier ?? this.idDossier, disabled: true }, Validators.required],
      idPpm: [{ value: m?.idPpm ?? this.idPpm, disabled: true }, Validators.required],
      designationMarche: [m?.designationMarche ?? ''],
      numCompte: [m?.numCompte ?? (null as string | null)],
      montEstim: [m?.montEstim ?? (null as number | null)],
      financement: [m?.financement ?? ''],
      statut: [m?.statut ?? ''],
      idNature: [m?.idNature ?? (null as number | null)],
      idMode: [m?.idMode ?? (null as number | null)],
      // Forme courante pré-remplie : elle DOIT repartir au PUT (défaut serveur sinon → écrasement silencieux).
      formeMarche: [m?.formeMarche ?? ('QUANTITE_FIXE' as FormeMarche)],
      datesPrev: this.fb.array([] as FormGroup[]),
    });
    void p;
  }

  ouvrirCreation(): void {
    this.createErrors.set({});
    this.chargerReferentiels();
    this.editingMarche.set(null);
    this.createOriginalDates.set([]);
    this.construireForm();
    this.createOpen.set(true);
  }
  ouvrirEditionLigne(m: Marche): void {
    this.createErrors.set({});
    this.chargerReferentiels();
    this.editingMarche.set(m);
    this.construireForm(m);
    this.previsionService.byMarche(m.idDetail).subscribe((rows) => {
      this.createOriginalDates.set(rows);
      const arr = this.createForm.get('datesPrev') as FormArray;
      rows.forEach((p) => arr.push(this.ligneDate(p)));
    });
    this.createOpen.set(true);
  }
  annulerCreation(): void {
    this.createOpen.set(false);
    this.editingMarche.set(null);
    this.createOriginalDates.set([]);
  }

  // — Suppression marché / PPM —
  demanderSuppressionMarche(m: Marche): void {
    this.confirmState.set({ kind: 'marche', id: m.idDetail, label: m.designationMarche || `marché #${m.idDetail}`, count: null });
    this.previsionService.byMarche(m.idDetail).subscribe({
      next: (rows) =>
        this.confirmState.update((c) => (c && c.kind === 'marche' && c.id === m.idDetail ? { ...c, count: rows.length } : c)),
      error: () => {},
    });
  }
  annulerSuppression(): void {
    if (!this.confirmBusy()) {
      this.confirmState.set(null);
    }
  }
  confirmerSuppression(): void {
    const c = this.confirmState();
    if (!c) {
      return;
    }
    this.confirmBusy.set(true);
    const op = c.kind === 'ppm' ? this.ppmService.delete(c.id) : this.marcheService.delete(c.id);
    op.subscribe({
      next: () => {
        if (c.kind === 'ppm') {
          this.toast.success('PPM supprimé.');
          this.confirmBusy.set(false);
          this.confirmState.set(null);
          this.modifie.emit();
          this.fermer.emit(); // le PPM affiché n'existe plus
        } else {
          this.toast.success('Marché supprimé.');
          this.marches.update((arr) => arr.filter((m) => m.idDetail !== c.id));
          this.confirmBusy.set(false);
          this.confirmState.set(null);
          this.modifie.emit();
        }
      },
      error: () => {
        this.confirmBusy.set(false);
        this.confirmState.set(null);
      },
    });
  }

  private chargerReferentiels(): void {
    if (this.refsLoaded) {
      return;
    }
    this.refsLoading.set(true);
    forkJoin({
      natures: this.natureService.list(),
      modes: this.modeService.list(),
      comptes: this.compteService.list(),
    }).subscribe({
      next: (r) => {
        this.natures.set(r.natures);
        this.modes.set(r.modes);
        this.comptes.set(r.comptes);
        this.refsLoaded = true;
        this.refsLoading.set(false);
      },
      error: () => this.refsLoading.set(false),
    });
  }
  createErr(key: string): string | undefined {
    return this.createErrors()[key];
  }

  enregistrerMarche(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.submittingCreate.set(true);
    this.createErrors.set({});
    const v = this.createForm.getRawValue();
    const body: Marche = {
      idDetail: v.idDetail,
      idDossier: v.idDossier,
      idPpm: v.idPpm,
      designationMarche: v.designationMarche || undefined,
      numCompte: v.numCompte ?? undefined,
      montEstim: v.montEstim ?? undefined,
      financement: v.financement || undefined,
      statut: v.statut || undefined,
      idNature: v.idNature ?? undefined,
      idMode: v.idMode ?? undefined,
      // Toujours renvoyée (création ET édition) : absente, le serveur appliquerait le défaut QUANTITE_FIXE.
      formeMarche: (v.formeMarche as FormeMarche) ?? undefined,
    };
    const editing = this.editingMarche();
    if (editing) {
      // Corps construit champ à champ : `version` n'y entre pas toute seule, on la reprend de la
      // ligne chargée (verrou optimiste — absente, le dernier écrit gagnerait en silence).
      // ⚠️ Fiche de présentation (2026-09-01) — les justifications sont PRÉSERVÉES au passage (même
      // piège que formeMarche : omises, elles seraient effacées à chaque édition de la ligne).
      const corps: Marche = {
        ...body,
        version: editing.version,
        justifModeDerogatoire: editing.justifModeDerogatoire,
        justifDelaiAmenage: editing.justifDelaiAmenage,
      };
      this.marcheService.update(corps.idDetail, corps).subscribe({
        next: (updated) =>
          this.reconcilierDates(
            corps.idDetail,
            this.createOriginalDates(),
            v.datesPrev ?? [],
            () => {
              this.toast.success('Marché modifié.');
              this.submittingCreate.set(false);
              this.annulerCreation();
              this.marches.update((arr) => arr.map((x) => (x.idDetail === updated.idDetail ? updated : x)));
              this.modifie.emit();
            },
            () => this.submittingCreate.set(false),
          ),
        error: (e: ApiError) => {
          this.submittingCreate.set(false);
          if (estConflitVersion(e)) {
            // La ligne a changé ailleurs : on ferme la saisie (perdue) et on repart du serveur.
            this.annulerCreation();
            this.charger();
            return;
          }
          this.createErrors.set(e.fieldErrors ?? {});
        },
      });
      return;
    }
    // Création : idDetail (PK) généré serveur (absent du corps) ; idDossier passé en query param.
    const { idDetail: _pk, idDossier: _d, ...payload } = body;
    void _pk;
    void _d;
    this.marcheService.createMarche(this.idDossier, payload).subscribe({
      next: (created) =>
        this.creerDates(created.idDetail, v.datesPrev ?? [], () => {
          this.toast.success((v.datesPrev?.length ?? 0) ? 'Marché et dates créés.' : 'Marché créé.');
          this.submittingCreate.set(false);
          this.annulerCreation();
          this.marches.update((arr) => [...arr, created]);
          this.modifie.emit();
        }),
      error: (e: ApiError) => {
        this.submittingCreate.set(false);
        this.createErrors.set(e.fieldErrors ?? {});
      },
    });
  }

  private creerDates(idDetail: number, lignes: { idCapm: number | null; dateDebut: string; dateFin: string }[], done: () => void): void {
    const valides = lignes.filter((l) => l.idCapm != null);
    if (!valides.length) {
      done();
      return;
    }
    this.previsionService.list().subscribe((all) => {
      const base = all.length ? Math.max(...all.map((p) => p.idPrevision)) : 0;
      forkJoin(
        valides.map((l, i) =>
          this.previsionService.create({
            idPrevision: base + i + 1,
            idDetail,
            idCapm: l.idCapm as number,
            dateDebut: l.dateDebut,
            dateFin: l.dateFin,
          }),
        ),
      ).subscribe({
        next: () => done(),
        error: (e: ApiError) => {
          this.submittingCreate.set(false);
          this.createErrors.set(e.fieldErrors ?? {});
        },
      });
    });
  }

  /** Libellé d'affichage de la forme du marché (repli sur le code ; « — » si absente). */
  formeLabel(f?: string): string {
    return f ? FORME_MARCHE_LIBELLES[f as FormeMarche] ?? f : '—';
  }

  resolve(map: Map<string, string>, id?: number): string {
    if (id === null || id === undefined) {
      return '—';
    }
    return map.get(String(id)) ?? `#${id}`;
  }
  montant(v?: number): string {
    return v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
}
