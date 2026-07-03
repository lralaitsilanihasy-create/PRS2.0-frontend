import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Output } from '@angular/core';
import { debounceTime, forkJoin, merge, Subscription } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Capm, Compte, Marche, MarchePrevision, Nature, PieceJointeDossier, Ppm, ServiceBeneficiaire, Situation, TypePieceJointe } from '../../models';
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
  ServiceBeneficiaireService,
  SituationService,
  SoaBeneficiaireService,
  TypePieceJointeService,
} from '../../services';
import { DatePipe, DecimalPipe } from '@angular/common';

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
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe],
  template: `
    <div class="modal-backdrop" [class.closing]="closing()" (click)="emitFermer()">
      @if (loading()) {
        <div class="spinner-wrap"><div class="spinner"></div></div>
      } @else {
      <div class="modal modal-xl" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">

        <!-- ── HEADER ── -->
        <div class="dpm-header">

          <!-- Ligne 1 : chips + fermer -->
          <div class="dpm-header-top">
            <div class="dpm-chips">
              <span class="dpm-chip dpm-chip-type">Plan de passation</span>
              <span class="dpm-chip dpm-chip-active"><span class="dpm-chip-dot"></span>Actif</span>
            </div>
            <div class="dpm-head-actions">
              @if (modeEdition && !editHeaderOpen()) {
                <button class="btn btn-secondary btn-sm" type="button" (click)="ouvrirEditionHeader()">✎ Modifier</button>
              }
              <button class="btn-close" type="button" (click)="emitFermer()">✕</button>
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
              <span class="dpm-meta-label">Référence</span>
              <span class="dpm-meta-value">{{ ppm()?.reference || '—' }}</span>
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
            <div class="dpm-meta-row">
              <span class="dpm-meta-label">Libellé</span>
              @if (editHeaderOpen()) {
                <input class="form-control dpm-meta-input" type="text" formControlName="libelle" placeholder="Libellé (facultatif)" />
              } @else {
                <span class="dpm-meta-value" [class.dpm-meta-empty]="!ppm()?.libelle">
                  {{ ppm()?.libelle || 'Non renseigné' }}
                </span>
              }
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

        <!-- ── CORPS ── -->
        <div class="dpm-body">

            <!-- Lignes de marché -->
            <div class="dpm-section">
              <div class="dpm-section-head">
                <div class="section-block-title">
                  <div class="section-icon">🏛</div>
                  <span class="section-label">Lignes de marché</span>
                  <span class="section-count">{{ marches().length }} marché(s)</span>
                </div>
                @if (modeEdition) {
                  <div class="section-btns">
                    <button class="btn btn-primary btn-sm" type="button" (click)="nouveauMarche()">+ Nouveau marché</button>
                  </div>
                }
              </div>

              <div class="table-card">
                <table>
                  <colgroup>
                    <col />
                    <col style="width:150px;" />
                    <col style="width:170px;" />
                    <col style="width:90px;" />
                    @if (modeEdition) { <col style="width:220px;" /> }
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Désignation</th>
                      <th class="r">Montant estimé</th>
                      <th>Mode</th>
                      <th>Statut</th>
                      @if (modeEdition) { <th>Actions</th> }
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of marches(); track m.idDetail) {
                      <tr>
                        <td [title]="m.designationMarche || ''" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ m.designationMarche || '—' }}</td>
                        <td class="td-montant">{{ m.montEstim | number }}</td>
                        <td>{{ resolve(modeMap(), m.idMode) }}</td>
                        <td>
                          <span class="badge badge-dot"
                            [class.badge-prevu]="m.statut === 'PREVU'"
                            [class.badge-cours]="m.statut === 'EN_COURS'"
                            [class.badge-cloture]="m.statut === 'CLOTURE'">
                            {{ m.statut || '—' }}
                          </span>
                        </td>
                        @if (modeEdition) {
                          <td>
                            <div class="td-actions">
                              <button class="btn btn-secondary btn-sm" type="button" (click)="voirDates(m)">Voir dates</button>
                              <button class="btn btn-primary btn-sm" type="button" (click)="modifierDates(m)">Modifier dates</button>
                              <button class="btn btn-outline btn-sm" type="button" (click)="modifierMarche(m)">Modifier</button>
                              <button class="btn btn-danger btn-sm" type="button" (click)="supprimerMarche(m)">Supprimer</button>
                            </div>
                          </td>
                        }
                      </tr>
                      @if (benefsDe(m.idDetail).length) {
                        <tr class="dpm-benef-row">
                          <td [attr.colspan]="modeEdition ? 5 : 4">
                            <span class="dpm-benef-title">Services bénéficiaires</span>
                            @for (b of benefsDe(m.idDetail); track b.idBenef) {
                              <div class="dpm-benef-line">
                                <span class="dpm-benef-soa">{{ soaLabel(b.soaCode) }}</span>
                                <span class="dpm-benef-cell">Compte : {{ compteLabel(b.numCompte) }}</span>
                                <span class="dpm-benef-cell">Montant : {{ (b.ancMontBenef | number) || '—' }}</span>
                                @if (b.nouvMontBenef != null) {
                                  <span class="dpm-benef-cell">Nouveau : {{ (b.nouvMontBenef | number) || '—' }}</span>
                                }
                              </div>
                            }
                          </td>
                        </tr>
                      }
                      @if (datesDe(m.idDetail).length) {
                        <tr class="dpm-benef-row">
                          <td [attr.colspan]="modeEdition ? 5 : 4">
                            <span class="dpm-benef-title">Dates prévisionnelles</span>
                            @for (p of datesDe(m.idDetail); track p.idPrevision) {
                              <div class="dpm-benef-line">
                                <span class="dpm-benef-soa">{{ capmLabel(p.idCapm) }}</span>
                                <span class="dpm-benef-cell">{{ p.dateDebut || '—' }} → {{ p.dateFin || '—' }}</span>
                              </div>
                            }
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            </div>

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
              <button class="btn btn-success" type="button" [disabled]="marches().length === 0" (click)="soumettre.emit()">
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
                    <select class="form-control" formControlName="idCapm">
                      <option [ngValue]="null" disabled>— Processus —</option>
                      @for (c of capmsPourLigne(ef, ctrl); track c.idCapm) { <option [ngValue]="c.idCapm">{{ c.libelleProcessus || ('#' + c.idCapm) }}</option> }
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
              <span class="form-label">Situation</span>
              <select class="form-control" formControlName="idSituation">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (s of situations(); track s.idSituation) { <option [ngValue]="s.idSituation">{{ s.libelle || '#' + s.idSituation }}</option> }
              </select>
            </label>
            <label class="form-group">
              <span class="form-label">Nature</span>
              <select class="form-control" formControlName="idNature">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (n of natures(); track n.idNature) { <option [ngValue]="n.idNature">{{ n.libelle || '#' + n.idNature }}</option> }
              </select>
            </label>
            <div class="form-group dpm-form__mode">
              <span class="form-label">Mode de passation</span>
              @switch (modeSuggestion().state) {
                @case ('loading') { <span class="cnm-muted">Détermination du mode…</span> }
                @case ('ready') {
                  <select class="form-control" formControlName="idMode">
                    @for (m of modeSuggestion().modes; track m.idMode) { <option [ngValue]="m.idMode">{{ m.libelle }}</option> }
                  </select>
                }
                @case ('none') { <span class="cnm-badge cnm-badge--warning">Mode à déterminer (aucune règle)</span> }
                @default { <span class="cnm-muted">Renseignez situation, nature et montant.</span> }
              }
              <span class="form-hint">Localité (dérivée de l'entité) : {{ localiteLabel() }}</span>
            </div>
            <div class="form-group dpm-form__dates">
              <span class="form-label">Dates prévisionnelles (par processus)</span>
              @for (ctrl of datesControls(createForm); track $index) {
                <div class="dpm-date-row" [formGroup]="ctrl">
                  <select class="form-control" formControlName="idCapm">
                    <option [ngValue]="null" disabled>— Processus —</option>
                    @for (c of capmsPourLigne(createForm, ctrl); track c.idCapm) { <option [ngValue]="c.idCapm">{{ c.libelleProcessus || ('#' + c.idCapm) }}</option> }
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
  private readonly marcheService = inject(MarcheService);
  private readonly serviceBenefService = inject(ServiceBeneficiaireService);
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
  private readonly typePieceService = inject(TypePieceJointeService);

  readonly loading = signal(true);
  /** Animation de fermeture en cours : retarde l'émission de `fermer` le temps du fondu sortant. */
  readonly closing = signal(false);
  readonly ppm = signal<Ppm | null>(null);
  readonly marches = signal<Marche[]>([]);
  readonly pieces = signal<PieceJointeDossier[]>([]);
  readonly modeMap = signal<Map<string, string>>(new Map());
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

  /** Services bénéficiaires des marchés du PPM (lecture seule) + libellés SOA / compte. */
  private readonly serviceBenefs = signal<ServiceBeneficiaire[]>([]);
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
  /** Dates prévisionnelles (bulk, lecture seule sous chaque marché). */
  private readonly previsions = signal<MarchePrevision[]>([]);
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
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.lookups.lookup(SoaBeneficiaireService, 'soaCode', ['libelle']).subscribe((m) => this.soaMap.set(m));
    this.lookups.lookup(CompteService, 'numCompte', ['libelle']).subscribe((m) => this.compteMap.set(m));
    this.capmService.getAll().subscribe((rows) => this.capms.set([...rows].sort((a, b) => a.ordre - b.ordre)));
    // Types de pièces attendus (édition) — dossier PPM.
    if (this.modeEdition) {
      this.typePieceService.getByTypeDossier('PPM').subscribe((rows) => this.typesPiece.set(rows));
    }
    forkJoin({
      ppm: this.ppmService.getById(this.idPpm),
      marches: this.marcheService.list(),
      pieces: this.pieceService.getByDossier(this.idDossier),
      benefs: this.serviceBenefService.list(),
      previsions: this.previsionService.list(),
    }).subscribe({
      next: ({ ppm, marches, pieces, benefs, previsions }) => {
        this.ppm.set(ppm);
        const mine = marches.filter((m) => m.idPpm === this.idPpm);
        this.marches.set(mine);
        this.pieces.set(pieces);
        // Bénéficiaires + dates : ne garder que ceux des marchés du PPM (pas de filtre par PPM côté API).
        const detailIds = new Set(mine.map((m) => m.idDetail));
        this.serviceBenefs.set(benefs.filter((b) => detailIds.has(b.idDetail)));
        this.previsions.set(previsions.filter((p) => detailIds.has(p.idDetail)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false), // 403/404 → toast centralisé
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
    // Entité / référence / signataire fixés serveur → renvoyés inchangés.
    const body: Ppm = { ...p, exercice: v.exercice, dateSignature: v.dateSignature, libelle: v.libelle || undefined };
    this.ppmService.update(p.idPpm, body).subscribe({
      next: (updated) => {
        this.ppm.set(updated);
        this.submittingHeader.set(false);
        this.editHeaderOpen.set(false);
        this.toast.success('En-tête du PPM mis à jour.');
        this.modifie.emit();
      },
      error: (e: ApiError) => {
        this.submittingHeader.set(false);
        this.headerErrors.set(e.fieldErrors ?? {});
      },
    });
  }

  // — Pièces jointes (upload / suppression, modeEdition) —
  onUploadFile(ev: Event): void {
    this.uploadFile.set((ev.target as HTMLInputElement).files?.[0] ?? null);
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
      idDetail: [{ value: m?.idDetail ?? null, disabled: true }],
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
