import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Output } from '@angular/core';
import { debounceTime, forkJoin, merge, Subscription } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Capm, Compte, Marche, MarchePrevision, Nature, PieceJointeDossier, Ppm, Situation } from '../../models';
import {
  CapmService,
  CompteService,
  MarcheService,
  MarchePrevisionService,
  ModePassationService,
  NatureService,
  PieceJointeDossierService,
  PpmService,
  ReferenceLookupService,
  ReglePassationService,
  SituationService,
} from '../../services';
import { StatutBadge } from '../circuit';

/** État d'aperçu du mode de passation (ensemble autorisé + recommandé). */
type ModeSuggestion = {
  state: 'idle' | 'loading' | 'ready' | 'none';
  modes: { idMode: number; libelle: string }[];
  recommande: number | null;
};

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
  imports: [StatutBadge, ReactiveFormsModule],
  template: `
    <div class="dpm__overlay" (click)="emitFermer()">
      <div class="dpm cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <header class="dpm__head">
          <h2 class="dpm__title">Détail PPM — {{ ppm()?.reference || 'PPM #' + idPpm }}</h2>
          <button type="button" class="dpm__close" aria-label="Fermer" (click)="emitFermer()">&times;</button>
        </header>

        <div class="dpm__body">
          @if (loading()) {
            <p class="dpm__info">Chargement…</p>
          } @else if (ppm(); as p) {
            <dl class="dpm__meta">
              <div class="dpm__col">
                <div class="dpm__field"><dt>Référence</dt><dd>{{ p.reference || '—' }}</dd></div>
                <div class="dpm__field"><dt>Signataire</dt><dd>{{ p.signataire || '—' }}</dd></div>
                <div class="dpm__field"><dt>Libellé</dt><dd>{{ p.libelle || '—' }}</dd></div>
              </div>
              <div class="dpm__col">
                <div class="dpm__field"><dt>Exercice</dt><dd>{{ p.exercice }}</dd></div>
                <div class="dpm__field"><dt>Date sign.</dt><dd>{{ p.dateSignature || '—' }}</dd></div>
              </div>
            </dl>

            <section class="dpm__section">
              <div class="dpm__section-head">
                <h3 class="dpm__section-title">Lignes de marché</h3>
                @if (modeEdition) {
                  <div class="dpm__section-actions">
                    <button type="button" class="cnm-btn cnm-btn--primary cnm-btn--sm" (click)="ouvrirCreation()">+ Nouveau marché</button>
                  </div>
                }
              </div>
              @if (marches().length === 0) {
                <p class="dpm__empty">Aucun marché rattaché à ce PPM.</p>
              } @else {
                <table class="dpm__table">
                  <colgroup>
                    <col class="dpm__c-num" />
                    <col class="dpm__c-desig" />
                    <col class="dpm__c-mont" />
                    <col class="dpm__c-mode" />
                    <col class="dpm__c-statut" />
                    <col class="dpm__c-action" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Désignation</th>
                      <th class="dpm__num">Montant</th>
                      <th>Mode</th>
                      <th>Statut</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of marches(); track m.idDetail) {
                      <tr>
                        <td class="cnm-mono">{{ m.idDetail }}</td>
                        <td class="dpm__desig" [title]="m.designationMarche || ''">{{ m.designationMarche || '—' }}</td>
                        <td class="dpm__num">{{ montant(m.montEstim) }}</td>
                        <td>{{ resolve(modeMap(), m.idMode) }}</td>
                        <td><app-statut-badge [statut]="m.statut" /></td>
                        <td>
                          <div class="dpm__row-actions">
                            <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ouvrirDates(m)">Voir dates</button>
                            @if (modeEdition) {
                              <button type="button" class="cnm-btn cnm-btn--primary cnm-btn--sm" (click)="ouvrirEdition(m)">Modifier dates</button>
                              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ouvrirEditionLigne(m)">Modifier</button>
                              <button type="button" class="cnm-btn cnm-btn--danger cnm-btn--sm" (click)="demanderSuppressionMarche(m)">Supprimer</button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </section>

            <section class="dpm__section">
              <h3 class="dpm__section-title dpm__section-title--pieces">Pièces jointes</h3>
              @if (pieces().length === 0) {
                <p class="dpm__empty">Aucune pièce jointe.</p>
              } @else {
                @if (piecesInitiales().length) {
                  <h4 class="dpm__pieces-sub">Pièces initiales</h4>
                  <ul class="dpm__pieces">
                    @for (pj of piecesInitiales(); track pj.idPiece) {
                      <li class="dpm__piece">
                        <span class="dpm__piece-id">
                          <span aria-hidden="true">📎</span>
                          {{ pj.libellePiece || pj.nomFichier || ('Pièce #' + pj.idPiece) }}
                        </span>
                        <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm dpm__piece-btn" (click)="ouvrirPiece(pj)">Ouvrir</button>
                      </li>
                    }
                  </ul>
                }
                @if (piecesApresRenvoi().length) {
                  <h4 class="dpm__pieces-sub">Pièces ajoutées après lettre de renvoi</h4>
                  <ul class="dpm__pieces">
                    @for (pj of piecesApresRenvoi(); track pj.idPiece) {
                      <li class="dpm__piece">
                        <span class="dpm__piece-id">
                          <span aria-hidden="true">📎</span>
                          {{ pj.libellePiece || pj.nomFichier || ('Pièce #' + pj.idPiece) }}
                          <span class="cnm-badge cnm-badge--warning">Après lettre de renvoi</span>
                        </span>
                        <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm dpm__piece-btn" (click)="ouvrirPiece(pj)">Ouvrir</button>
                      </li>
                    }
                  </ul>
                }
              }
            </section>
          } @else {
            <p class="dpm__info">PPM introuvable.</p>
          }
        </div>

        <footer class="dpm__foot">
          <button type="button" class="cnm-btn cnm-btn--ghost" (click)="emitFermer()">Fermer</button>
        </footer>
      </div>
    </div>

    @if (modalMarche(); as m) {
      <div class="dpm__overlay" (click)="fermerDates()">
        <div class="dpm dpm--sm cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header class="dpm__head">
            <h2 class="dpm__title">Dates prévisionnelles — {{ m.designationMarche || 'Marché #' + m.idDetail }}</h2>
            <button type="button" class="dpm__close" aria-label="Fermer" (click)="fermerDates()">&times;</button>
          </header>
          <div class="dpm__body dpm__body--pad">
            @if (modalLoading()) {
              <p class="dpm__info">Chargement des dates…</p>
            } @else if (modalData().length) {
              <table class="cnm-table">
                <thead><tr><th>Processus</th><th>Période prévisionnelle</th></tr></thead>
                <tbody>
                  @for (d of modalData(); track d.idPrevision) {
                    <tr><td>{{ capmLabel(d.idCapm) }}</td><td class="cnm-mono">{{ d.dateDebut || '—' }} → {{ d.dateFin || '—' }}</td></tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="dpm__info">Aucune date prévisionnelle pour ce marché.</p>
            }
          </div>
          <footer class="dpm__foot">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="fermerDates()">Fermer</button>
          </footer>
        </div>
      </div>
    }

    @if (editMarche(); as m) {
      @if (editForm(); as ef) {
        <div class="dpm__overlay" (click)="annulerEdition()">
          <form class="dpm dpm--sm cnm-card" [formGroup]="ef" (ngSubmit)="enregistrerEdition()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" novalidate>
            <header class="dpm__head">
              <h2 class="dpm__title">Modifier les dates — {{ m.designationMarche || 'Marché #' + m.idDetail }}</h2>
              <button type="button" class="dpm__close" aria-label="Fermer" (click)="annulerEdition()">&times;</button>
            </header>
            <div class="dpm__body dpm__body--pad">
              @if (editLoading()) {
                <p class="dpm__info">Chargement des dates…</p>
              } @else {
                @for (ctrl of datesControls(ef); track $index) {
                  <div class="dpm-date-row" [formGroup]="ctrl">
                    <select class="cnm-select" formControlName="idCapm">
                      <option [ngValue]="null" disabled>— Processus —</option>
                      @for (c of capmsPourLigne(ef, ctrl); track c.idCapm) { <option [ngValue]="c.idCapm">{{ c.libelleProcessus || ('#' + c.idCapm) }}</option> }
                    </select>
                    <input class="cnm-input" type="date" formControlName="dateDebut" />
                    <input class="cnm-input" type="date" formControlName="dateFin" />
                    <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="retirerDate(ef, $index)">✕</button>
                  </div>
                  @if (procErreur(ctrl.get('idCapm')!.value)) {
                    <span class="cnm-field__hint dpm-date-err">{{ procErreur(ctrl.get('idCapm')!.value) }}</span>
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

    @if (createOpen()) {
      <div class="dpm__overlay" (click)="annulerCreation()">
        <form class="dpm dpm--sm cnm-card" [formGroup]="createForm" (ngSubmit)="enregistrerMarche()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" novalidate>
          <header class="dpm__head">
            <h2 class="dpm__title">
              {{ editingMarche() ? 'Modifier le marché #' + editingMarche()!.idDetail : 'Nouveau marché — PPM ' + (ppm()?.reference || '#' + idPpm) }}
            </h2>
            <button type="button" class="dpm__close" aria-label="Fermer" (click)="annulerCreation()">&times;</button>
          </header>
          <div class="dpm__body dpm__body--pad dpm-form">
            <label class="cnm-field">
              <span class="cnm-field__label">Identifiant marché (PK) *</span>
              <input class="cnm-input" type="number" formControlName="idDetail" [readonly]="!!editingMarche()" />
              @if (createForm.get('idDetail')?.touched && createForm.get('idDetail')?.hasError('required')) { <span class="cnm-field__hint">Obligatoire.</span> }
              @if (createErr('idDetail')) { <span class="cnm-field__hint">{{ createErr('idDetail') }}</span> }
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Dossier</span>
              <input class="cnm-input" type="number" formControlName="idDossier" readonly />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Désignation</span>
              <input class="cnm-input" type="text" formControlName="designationMarche" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Compte</span>
              <select class="cnm-select" formControlName="numCompte">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (c of comptes(); track c.numCompte) { <option [ngValue]="c.numCompte">{{ c.libelle || c.numCompte }}</option> }
              </select>
              @if (refsLoading()) { <span class="cnm-field__hint cnm-muted">Chargement…</span> }
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Montant estimé</span>
              <input class="cnm-input" type="number" formControlName="montEstim" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Financement</span>
              <input class="cnm-input" type="text" formControlName="financement" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Statut</span>
              <input class="cnm-input" type="text" formControlName="statut" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Situation</span>
              <select class="cnm-select" formControlName="idSituation">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (s of situations(); track s.idSituation) { <option [ngValue]="s.idSituation">{{ s.libelle || '#' + s.idSituation }}</option> }
              </select>
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Nature</span>
              <select class="cnm-select" formControlName="idNature">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (n of natures(); track n.idNature) { <option [ngValue]="n.idNature">{{ n.libelle || '#' + n.idNature }}</option> }
              </select>
            </label>
            <div class="cnm-field dpm-form__mode">
              <span class="cnm-field__label">Mode de passation</span>
              @switch (modeSuggestion().state) {
                @case ('loading') { <span class="cnm-muted">Détermination du mode…</span> }
                @case ('ready') {
                  <select class="cnm-select" formControlName="idMode">
                    @for (m of modeSuggestion().modes; track m.idMode) { <option [ngValue]="m.idMode">{{ m.libelle }}</option> }
                  </select>
                }
                @case ('none') { <span class="cnm-badge cnm-badge--warning">Mode à déterminer (aucune règle)</span> }
                @default { <span class="cnm-muted">Renseignez situation, nature et montant.</span> }
              }
              <span class="cnm-field__hint cnm-muted">Localité (dérivée de l'entité) : {{ localiteLabel() }}</span>
            </div>
            <div class="cnm-field dpm-form__dates">
              <span class="cnm-field__label">Dates prévisionnelles (par processus)</span>
              @for (ctrl of datesControls(createForm); track $index) {
                <div class="dpm-date-row" [formGroup]="ctrl">
                  <select class="cnm-select" formControlName="idCapm">
                    <option [ngValue]="null" disabled>— Processus —</option>
                    @for (c of capmsPourLigne(createForm, ctrl); track c.idCapm) { <option [ngValue]="c.idCapm">{{ c.libelleProcessus || ('#' + c.idCapm) }}</option> }
                  </select>
                  <input class="cnm-input" type="date" formControlName="dateDebut" />
                  <input class="cnm-input" type="date" formControlName="dateFin" />
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
      <div class="dpm__overlay" (click)="annulerSuppression()">
        <div class="dpm dpm--sm cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header class="dpm__head">
            <h2 class="dpm__title">{{ c.kind === 'ppm' ? 'Supprimer le PPM' : 'Supprimer le marché' }}</h2>
            <button type="button" class="dpm__close" aria-label="Fermer" (click)="annulerSuppression()">&times;</button>
          </header>
          <div class="dpm__body dpm__body--pad">
            <p>{{ messageSuppression(c) }}</p>
            <p class="cnm-muted">Action irréversible.</p>
          </div>
          <footer class="dpm__foot">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annulerSuppression()">Annuler</button>
            <button type="button" class="cnm-btn cnm-btn--danger" [disabled]="confirmBusy()" (click)="confirmerSuppression()">
              {{ confirmBusy() ? 'Suppression…' : 'Supprimer définitivement' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: `
    .dpm__overlay {
      position: fixed;
      inset: 0;
      z-index: 1050;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--cnm-space-4);
    }
    .dpm {
      width: 90vw;
      min-width: 900px;
      max-width: 90vw;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: var(--cnm-shadow);
    }
    .dpm--sm { width: 100%; min-width: 0; max-width: 32rem; }

    .dpm__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cnm-space-3);
      padding: 1.5rem 1.5rem 1rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .dpm__title { margin: 0; font-size: 1.25rem; font-weight: 600; }
    .dpm__close { background: transparent; border: 0; color: var(--cnm-text-2); font-size: 1.5rem; line-height: 1; cursor: pointer; }
    .dpm__close:hover { color: var(--cnm-text); }

    .dpm__body { display: block; }
    .dpm__body--pad { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .dpm__info, .dpm__empty { color: var(--cnm-text-2); padding: 1.25rem 1.5rem; }
    .dpm__empty { font-style: italic; text-align: center; }

    /* Métadonnées : 2 colonnes */
    .dpm__meta { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; padding: 1.25rem 1.5rem 1.5rem; margin: 0; }
    .dpm__col { display: flex; flex-direction: column; gap: 0.75rem; }
    .dpm__field { display: flex; flex-direction: column; gap: 0.2rem; }
    .dpm__field dt { font-size: 0.75rem; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
    .dpm__field dd { margin: 0; font-size: 0.95rem; font-weight: 500; }

    /* Séparateur entre sections */
    .dpm__section { border-top: 1px solid #e5e7eb; margin: 0 1.5rem; padding: 0 0 1.25rem; }
    .dpm__section-head { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0 0.75rem; }
    .dpm__section-title { margin: 0; font-size: 1rem; font-weight: 600; }
    .dpm__section-title--pieces { padding: 1rem 0 0.5rem; }
    .dpm__section-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

    /* Tableau des marchés (non compressé) */
    .dpm__table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 0.85rem; }
    .dpm__c-num { width: 80px; }
    .dpm__c-desig { width: 300px; }
    .dpm__c-mont { width: 160px; }
    .dpm__c-mode { width: 160px; }
    .dpm__c-statut { width: 100px; }
    .dpm__c-action { width: 250px; }
    .dpm__table th, .dpm__table td { padding: 0.75rem 1rem; text-align: left; vertical-align: middle; height: 56px; }
    .dpm__desig { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dpm__table thead th { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    .dpm__table tbody tr:nth-child(even) { background: #f9fafb; }
    .dpm__num { text-align: right; }
    .dpm__row-actions { display: flex; gap: 0.4rem; flex-wrap: nowrap; align-items: center; white-space: nowrap; }

    /* Pièces jointes */
    .dpm__pieces-sub { margin: 0; font-size: 0.7rem; text-transform: uppercase; color: #6b7280; letter-spacing: 0.08em; padding: 0.5rem 0; }
    .dpm__pieces { list-style: none; margin: 0; padding: 0; }
    .dpm__piece { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px solid #f3f4f6; }
    .dpm__piece-id { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
    .dpm__piece-btn { font-size: 0.8rem; }

    .dpm__foot { display: flex; justify-content: flex-end; gap: var(--cnm-space-2); padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; }

    /* Formulaires (création/édition marché, dates) */
    .dpm-form { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cnm-space-3); }
    .dpm-form .cnm-input:read-only { opacity: 0.7; }
    .dpm-form__mode, .dpm-form__dates {
      grid-column: 1 / -1;
      gap: var(--cnm-space-2);
      padding: var(--cnm-space-3);
      background: var(--cnm-surface-2);
      border: 1px solid var(--cnm-border);
      border-radius: var(--cnm-radius-sm);
    }
    .dpm-date-row { display: flex; align-items: center; gap: var(--cnm-space-2); }
    .dpm-date-row .cnm-select { flex: 1; }
    .dpm-date-err { color: var(--cnm-danger-fg); display: block; }

    @media (max-width: 960px) {
      .dpm { min-width: 0; width: 100%; }
    }
  `,
})
export class DetailPpmModal implements OnInit {
  /** Dossier dont on affiche les pièces jointes (obligatoire). */
  @Input({ required: true }) idDossier!: number;
  /** PPM à détailler (obligatoire). */
  @Input({ required: true }) idPpm!: number;
  /** `true` = PRMP propriétaire (boutons + colonne ACTION) ; `false` = lecture seule. */
  @Input() modeEdition = false;
  /** Fermeture demandée (× / backdrop / Fermer). */
  @Output() fermer = new EventEmitter<void>();
  /** Émis après une mutation (création/édition/suppression) pour rafraîchir l'hôte. */
  @Output() modifie = new EventEmitter<void>();

  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly reglePassation = inject(ReglePassationService);
  private readonly natureService = inject(NatureService);
  private readonly situationService = inject(SituationService);
  private readonly compteService = inject(CompteService);
  private readonly capmService = inject(CapmService);

  readonly loading = signal(true);
  readonly ppm = signal<Ppm | null>(null);
  readonly marches = signal<Marche[]>([]);
  readonly pieces = signal<PieceJointeDossier[]>([]);
  readonly modeMap = signal<Map<string, string>>(new Map());
  readonly capms = signal<Capm[]>([]);
  readonly procErreurs = signal<Record<number, string>>({});

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

  // Suppression (marché ou PPM)
  readonly confirmState = signal<{ kind: 'marche' | 'ppm'; id: number; label: string; count: number | null } | null>(null);
  readonly confirmBusy = signal(false);

  readonly modeSuggestion = signal<ModeSuggestion>({ state: 'idle', modes: [], recommande: null });
  private modeSub?: Subscription;

  readonly natures = signal<Nature[]>([]);
  readonly situations = signal<Situation[]>([]);
  readonly comptes = signal<Compte[]>([]);
  readonly refsLoading = signal(false);
  private refsLoaded = false;

  ngOnInit(): void {
    this.charger();
  }

  /** Charge le PPM, ses marchés, ses pièces jointes et les référentiels d'affichage (modes, CAPM). */
  private charger(): void {
    this.loading.set(true);
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.capmService.getAll().subscribe((rows) => this.capms.set([...rows].sort((a, b) => a.ordre - b.ordre)));
    forkJoin({
      ppm: this.ppmService.getById(this.idPpm),
      marches: this.marcheService.list(),
      pieces: this.pieceService.getByDossier(this.idDossier),
    }).subscribe({
      next: ({ ppm, marches, pieces }) => {
        this.ppm.set(ppm);
        this.marches.set(marches.filter((m) => m.idPpm === this.idPpm));
        this.pieces.set(pieces);
        this.loading.set(false);
      },
      error: () => this.loading.set(false), // 403/404 → toast centralisé
    });
  }

  emitFermer(): void {
    this.fermer.emit();
  }

  // — Pièces jointes —
  piecesInitiales(): PieceJointeDossier[] {
    return this.pieces().filter((p) => !p.apresLettreRenvoi);
  }
  piecesApresRenvoi(): PieceJointeDossier[] {
    return this.pieces().filter((p) => p.apresLettreRenvoi);
  }
  ouvrirPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) {
      return;
    }
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (blob) => window.open(URL.createObjectURL(blob), '_blank'),
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
    return this.capms().find((c) => c.idCapm === id)?.libelleProcessus ?? '#' + id;
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
      dateFin: [p?.dateFin ?? '', Validators.required],
    });
  }
  datesControls(form: FormGroup): FormGroup[] {
    return (form.get('datesPrev') as FormArray).controls as FormGroup[];
  }
  capmsPourLigne(form: FormGroup, ctrl: FormGroup): Capm[] {
    const autres = new Set(
      this.datesControls(form)
        .filter((g) => g !== ctrl)
        .map((g) => g.get('idCapm')!.value as number)
        .filter((v) => v != null),
    );
    return this.capms().filter((c) => !autres.has(c.idCapm));
  }
  peutAjouterDate(form: FormGroup): boolean {
    const utilises = new Set(this.datesControls(form).map((g) => g.get('idCapm')!.value as number));
    return this.capms().some((c) => !utilises.has(c.idCapm));
  }
  ajouterDate(form: FormGroup): void {
    const utilises = new Set(this.datesControls(form).map((g) => g.get('idCapm')!.value as number));
    const libre = this.capms().find((c) => !utilises.has(c.idCapm));
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
            dateFin: r.dateFin,
          }),
        ),
        ...toCreate.map((r, i) =>
          this.previsionService.create({
            idPrevision: base + i + 1,
            idDetail,
            idCapm: r.idCapm as number,
            dateDebut: r.dateDebut,
            dateFin: r.dateFin,
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

  private construireForm(m?: Marche): void {
    const p = this.ppm();
    this.createForm = this.fb.group({
      idDetail: [{ value: m?.idDetail ?? null, disabled: !!m }, Validators.required],
      idDossier: [{ value: m?.idDossier ?? this.idDossier, disabled: true }, Validators.required],
      idPpm: [{ value: m?.idPpm ?? this.idPpm, disabled: true }, Validators.required],
      designationMarche: [m?.designationMarche ?? ''],
      numCompte: [m?.numCompte ?? (null as string | null)],
      montEstim: [m?.montEstim ?? (null as number | null)],
      financement: [m?.financement ?? ''],
      statut: [m?.statut ?? ''],
      idSituation: [m?.idSituation ?? (null as number | null)],
      idNature: [m?.idNature ?? (null as number | null)],
      idMode: [m?.idMode ?? (null as number | null)],
      datesPrev: this.fb.array([] as FormGroup[]),
    });
    void p;
    this.modeSuggestion.set({ state: 'idle', modes: [], recommande: null });
    this.modeSub?.unsubscribe();
    this.modeSub = merge(
      this.createForm.get('idSituation')!.valueChanges,
      this.createForm.get('idNature')!.valueChanges,
      this.createForm.get('montEstim')!.valueChanges,
    )
      .pipe(debounceTime(350))
      .subscribe(() => this.determinerMode());
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
    this.modeSub?.unsubscribe();
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
  messageSuppression(c: { kind: 'marche' | 'ppm'; label: string; count: number | null }): string {
    if (c.kind === 'ppm') {
      return `Supprimer le PPM « ${c.label} » ? Cela supprimera aussi ses ${c.count ?? 0} marché(s) et toutes leurs dates prévisionnelles.`;
    }
    const n = c.count == null ? '…' : c.count;
    return `Supprimer le marché « ${c.label} » et ses ${n} date(s) prévisionnelle(s) ?`;
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

  private determinerMode(): void {
    const v = this.createForm.getRawValue();
    const idLocalite = this.localiteCourante();
    const idMode = this.createForm.get('idMode')!;
    if (v.idSituation == null || v.idNature == null || v.montEstim == null || !idLocalite) {
      this.modeSuggestion.set({ state: 'idle', modes: [], recommande: null });
      return;
    }
    this.modeSuggestion.set({ state: 'loading', modes: [], recommande: null });
    this.reglePassation
      .suggestionMode({ idSituation: v.idSituation, idNature: v.idNature, montant: v.montEstim, idLocalite })
      .subscribe({
        next: (res) => {
          if (res.modesAutorises.length) {
            const cur = idMode.value as number | null;
            if (cur == null || !res.modesAutorises.some((m) => m.idMode === cur)) {
              idMode.setValue(res.modeRecommande, { emitEvent: false });
            }
            this.modeSuggestion.set({ state: 'ready', modes: res.modesAutorises, recommande: res.modeRecommande });
          } else {
            idMode.setValue(null, { emitEvent: false });
            this.modeSuggestion.set({ state: 'none', modes: [], recommande: null });
          }
        },
        error: () => {
          idMode.setValue(null, { emitEvent: false });
          this.modeSuggestion.set({ state: 'none', modes: [], recommande: null });
        },
      });
  }
  /** Localité (code) du dossier courant, dérivée de l'entité côté serveur (portée par le PPM chargé). */
  private localiteCourante(): string | null {
    return this.ppm()?.idLocalite ?? null;
  }
  localiteLabel(): string {
    return this.localiteCourante() ?? '— (dérivée de l’entité)';
  }

  private chargerReferentiels(): void {
    if (this.refsLoaded) {
      return;
    }
    this.refsLoading.set(true);
    forkJoin({
      natures: this.natureService.list(),
      situations: this.situationService.list(),
      comptes: this.compteService.list(),
    }).subscribe({
      next: (r) => {
        this.natures.set(r.natures);
        this.situations.set(r.situations);
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
      idSituation: v.idSituation ?? undefined,
      idNature: v.idNature ?? undefined,
      idMode: v.idMode ?? undefined,
    };
    const editing = this.editingMarche();
    if (editing) {
      this.marcheService.update(body.idDetail, body).subscribe({
        next: (updated) =>
          this.reconcilierDates(
            body.idDetail,
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
          this.createErrors.set(e.fieldErrors ?? {});
        },
      });
      return;
    }
    this.marcheService.create(body).subscribe({
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
