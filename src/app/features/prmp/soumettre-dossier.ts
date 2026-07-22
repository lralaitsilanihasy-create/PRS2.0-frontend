import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { DetailPpmModal } from '../../shared/prmp/detail-ppm-modal';
import { MontantFrDirective } from '../../shared/montant-fr.directive';
import { AutosizeDirective } from '../../shared/autosize.directive';
import { Capm, Compte, Dossier, FORME_MARCHE_LIBELLES, FormeMarche, Marche, ModePassation, Nature, SaisieMarcheLigne, SaisieMarcheLot, SaisiePpmImportResult, SoaBeneficiaire, SousTypeDossier, TypePieceJointe } from '../../models';
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
  imports: [ReactiveFormsModule, DetailPpmModal, MontantFrDirective, AutosizeDirective],
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
                📄 Importer un PPM (PDF)
                <input type="file" accept=".pdf,application/pdf" hidden (change)="importerPpm($event)" [disabled]="importing()" />
              </label>
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

            <div class="sd__lignes-head">
              @if (importe()) {
                <span class="cnm-muted">📄 Données importées du PDF (lecture seule) — seules les CAPM restent modifiables.</span>
              } @else {
                <button type="button" class="btn btn-secondary btn-sm" (click)="ajouterMarche()">+ Ajouter une ligne</button>
              }
            </div>
            @if (!marcheControls().length) {
              <p class="cnm-muted">Aucun marché. Vous pouvez créer le brouillon sans marché et en ajouter plus tard.</p>
            } @else {
              <div class="sd__marches-wrap">
                <table class="sd__marches-table">
                  <colgroup>
                    <col style="width: 7%" /><col style="width: 13%" /><col style="width: 9%" /><col style="width: 9%" />
                    <col style="width: 7%" /><col style="width: 7%" /><col style="width: 5%" /><col style="width: 9%" />
                    <col style="width: 6%" /><col style="width: 8%" /><col style="width: 8%" /><col style="width: 12%" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th rowspan="2">Nature</th>
                      <th rowspan="2">Objet</th>
                      <th rowspan="2">Montant estimé</th>
                      <th rowspan="2">Nouveau montant</th>
                      <th rowspan="2">Mode de passation</th>
                      <th rowspan="2">Forme</th>
                      <th rowspan="2">Financement</th>
                      <th colspan="4">Informations sur le bénéficiaire</th>
                      <th rowspan="2">Actions</th>
                    </tr>
                    <tr>
                      <th>Service bénéficiaire</th><th>Compte</th><th>Montant</th><th>Nouveau montant</th>
                    </tr>
                  </thead>
                  @for (g of marcheControls(); track g.get('uid')!.value) {
                    <tbody class="sd__marche-tb">
                      @for (b of beneficiairesControls(g); track $index; let first = $first; let i = $index) {
                        <tr>
                          @if (first) {
                            <td [attr.rowspan]="rowspanBenef(g)"><textarea class="form-control sd__c-wrap" rows="1" appAutosize [formControl]="ctrl(g, 'natureLibelle')" placeholder="Nature" [readonly]="importe()"></textarea></td>
                            <td [attr.rowspan]="rowspanBenef(g)"><textarea class="form-control sd__c-wrap" rows="1" appAutosize [formControl]="ctrl(g, 'designationMarche')" placeholder="Objet" [readonly]="importe()"></textarea></td>
                            <td [attr.rowspan]="rowspanBenef(g)"><input class="form-control sd__c-mont" type="text" inputmode="decimal" appMontantFr [formControl]="ctrl(g, 'montEstim')" [readonly]="importe()" /></td>
                            <td [attr.rowspan]="rowspanBenef(g)"><input class="form-control sd__c-mont" type="text" inputmode="decimal" appMontantFr [formControl]="ctrl(g, 'nouvMontEstim')" placeholder="(si révisé)" [readonly]="importe()" /></td>
                            <td [attr.rowspan]="rowspanBenef(g)"><input class="form-control" type="text" [formControl]="ctrl(g, 'modeLibelle')" list="sd-modes" placeholder="Mode" [readonly]="importe()" /></td>
                            <td [attr.rowspan]="rowspanBenef(g)">
                              @if (importe()) {
                                <input class="form-control" type="text" [value]="formeLabel(ctrl(g, 'formeMarche').value)" readonly />
                              } @else {
                                <select class="form-control" [formControl]="ctrl(g, 'formeMarche')" title="Forme du marché">
                                  @for (f of formes; track f.code) { <option [value]="f.code">{{ f.libelle }}</option> }
                                </select>
                              }
                            </td>
                            <td [attr.rowspan]="rowspanBenef(g)"><input class="form-control" type="text" [formControl]="ctrl(g, 'financement')" [readonly]="importe()" /></td>
                          }
                          <td><input class="form-control" type="text" [formControl]="benefCtrl(g, i, 'soaCode')" list="sd-soa" placeholder="SOA" [readonly]="importe()" /></td>
                          <td><input class="form-control" type="text" [formControl]="benefCtrl(g, i, 'numCompte')" list="sd-comptes" placeholder="Compte" [readonly]="importe()" /></td>
                          <td><input class="form-control sd__c-mont" type="text" inputmode="decimal" appMontantFr [formControl]="benefCtrl(g, i, 'ancMontBenef')" [readonly]="importe()" /></td>
                          <td>
                            <div class="sd__benef-cell">
                              <input class="form-control sd__c-mont" type="text" inputmode="decimal" appMontantFr [formControl]="benefCtrl(g, i, 'nouvMontBenef')" placeholder="(si révisé)" [readonly]="importe()" />
                              @if (!importe()) {
                                <button type="button" class="btn btn-secondary btn-sm" [disabled]="beneficiairesControls(g).length === 1" (click)="retirerBeneficiaire(g, i)" aria-label="Retirer le bénéficiaire">✕</button>
                              }
                            </div>
                          </td>
                          @if (first) {
                            <td [attr.rowspan]="rowspanBenef(g)" class="sd__marche-actions">
                              @if (!importe()) {
                                <button type="button" class="btn btn-secondary btn-sm" (click)="ajouterBeneficiaire(g)">+ bénéficiaire</button>
                              }
                              <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirDates(g)">CAPM</button>
                              @if (!datesSaisies(g)) {
                                <span class="sd__dates-manq">⚠ Dates manquantes</span>
                              }
                              <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirLots(g)"
                                [title]="importe() ? 'Lots (lecture seule)' : (lotsExplicites(g) ? '' : 'Lot unique par défaut = objet du marché ; cliquez pour le modifier ou en ajouter.')">
                                Lots ({{ nbLots(g) }})
                              </button>
                              @if (!importe()) {
                                <button type="button" class="btn btn-danger btn-sm" (click)="retirerMarche(marcheIndex(g))">Retirer</button>
                              }
                              @if (erreurCoherenceBenefs(g); as errBenef) {
                                <span class="form-error">{{ errBenef }}</span>
                              }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  }
                </table>
              </div>
            }
            <datalist id="sd-natures">@for (n of natures(); track n.idNature) { <option [value]="n.libelle"></option> }</datalist>
            <datalist id="sd-modes">@for (m of modesList(); track m.idMode) { <option [value]="m.libelle"></option> }</datalist>
            <datalist id="sd-comptes">@for (c of comptes(); track c.numCompte) { <option [value]="c.numCompte">{{ c.libelle }}</option> }</datalist>
            <datalist id="sd-soa">@for (s of soaList(); track s.soaCode) { <option [value]="s.soaCode">{{ s.libelle }}</option> }</datalist>

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
              <button type="submit" class="btn btn-primary" [disabled]="submitting() || !ppmFormValide || !benefsCoherents">
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

      @if (datesCible()) {
        <div class="modal-backdrop" (click)="annulerDates()">
          <div class="modal confirm-modal cnm-form sd__dates-modal" (click)="$event.stopPropagation()">
            <div class="modal-header-plain">
              <span class="modal-title">CAPM du marché</span>
            </div>
            <div class="modal-body">
              <p class="form-hint">Au moins un processus est obligatoire ; un processus par ligne. La <strong>date de fin est optionnelle</strong>.</p>
              @for (ctrl of procControls(); track $index) {
                <div class="sd-proc-row" [formGroup]="ctrl">
                  <select class="form-control" formControlName="idCapm">
                    <option [ngValue]="null" disabled>— Processus —</option>
                    @for (c of capmsPourProc(ctrl); track c.idCapm) { <option [ngValue]="c.idCapm">{{ c.libelleProcessus || ('#' + c.idCapm) }}</option> }
                  </select>
                  <input class="form-control" type="date" formControlName="dateDebut" />
                  <input class="form-control" type="date" formControlName="dateFin" />
                  <button type="button" class="btn btn-secondary btn-sm" (click)="retirerProc($index)" aria-label="Retirer">✕</button>
                </div>
                @if (procErreur(ctrl.get('idCapm')!.value)) {
                  <span class="form-error sd-proc-err">{{ procErreur(ctrl.get('idCapm')!.value) }}</span>
                }
              } @empty {
                <p class="form-hint">Aucun processus. Ajoutez-en au moins un.</p>
              }
              <div>
                <button type="button" class="btn btn-secondary btn-sm" [disabled]="!peutAjouterProc()" (click)="ajouterProc()">
                  + Ajouter un processus
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline" (click)="annulerDates(); $event.stopPropagation()">Annuler</button>
              <button
                type="button"
                class="btn btn-primary"
                [disabled]="!procControls().length"
                (click)="validerDates(); $event.stopPropagation()"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      }

      @if (lotsCible()) {
        <div class="modal-backdrop" (click)="annulerLots()">
          <div class="modal confirm-modal cnm-form sd__lots-modal" (click)="$event.stopPropagation()">
            <div class="modal-header-plain">
              <span class="modal-title">Lots (allotissement) du marché</span>
            </div>
            <div class="modal-body">
              @if (importe()) {
                <p class="form-hint">Lots issus de l'import PDF — <strong>lecture seule</strong>.</p>
              } @else {
                <p class="form-hint">
                  Par défaut, le marché forme un <strong>lot unique = son objet</strong> (ligne pré-remplie ci-dessous) ;
                  modifiez-le ou ajoutez des lots pour l'allotir. La désignation est obligatoire ; montant, quantité et
                  unité sont descriptifs (aucun contrôle de somme).
                </p>
              }
              @for (ctrl of lotControls(); track $index) {
                <div class="sd-lot-row" [formGroup]="ctrl">
                  <input class="form-control" type="text" formControlName="designationLot" placeholder="Désignation du lot *" aria-label="Désignation du lot" [readonly]="importe()" />
                  <input class="form-control sd__c-mont" type="number" formControlName="montLot" placeholder="Montant" aria-label="Montant" [readonly]="importe()" />
                  <input class="form-control" type="number" formControlName="qteLot" placeholder="Quantité" aria-label="Quantité" [readonly]="importe()" />
                  <input class="form-control" type="text" formControlName="uniteLot" placeholder="Unité" aria-label="Unité" [readonly]="importe()" />
                  @if (!importe()) {
                    <button type="button" class="btn btn-secondary btn-sm" (click)="retirerLot($index)" aria-label="Retirer">✕</button>
                  }
                </div>
                @if (!importe() && lotCtrl($index, 'designationLot').touched && lotCtrl($index, 'designationLot').hasError('required')) {
                  <span class="form-error sd-proc-err">La désignation du lot est obligatoire.</span>
                }
              } @empty {
                <p class="form-hint">Renseignez d'abord l'<strong>objet</strong> du marché (il servira de lot unique), ou ajoutez un lot ci-dessous.</p>
              }
              @if (!importe()) {
                <div>
                  <button type="button" class="btn btn-secondary btn-sm" (click)="ajouterLot()">+ Ajouter un lot</button>
                </div>
              }
            </div>
            <div class="modal-footer">
              @if (importe()) {
                <button type="button" class="btn btn-outline" (click)="annulerLots(); $event.stopPropagation()">Fermer</button>
              } @else {
                <button type="button" class="btn btn-outline" (click)="annulerLots(); $event.stopPropagation()">Annuler</button>
                <button type="button" class="btn btn-primary" (click)="validerLots(); $event.stopPropagation()">Valider</button>
              }
            </div>
          </div>
        </div>
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
              <button type="button" class="btn btn-primary" [disabled]="submitting() || !ppmFormValide || !benefsCoherents" (click)="fermerApercu(); creerPpm()">
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
    .sd__lignes-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
    .sd__sub { margin: 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    /* Tableau éditable des marchés (mise en forme façon PPM) */
    .sd__marches-wrap { overflow-x: auto; margin-bottom: 1rem; }
    .sd__marches-table { border-collapse: collapse; width: 100%; min-width: 52rem; table-layout: fixed; }
    .sd__marches-table th, .sd__marches-table td { border: 1px solid var(--c-200); padding: 0.25rem; vertical-align: top; }
    .sd__marches-table thead th { background: var(--c-50); font-size: var(--text-xs, 0.72rem); text-align: center; font-weight: 700; color: var(--c-800); overflow-wrap: break-word; }
    .sd__marches-table .form-control { width: 100%; min-width: 0; font-size: var(--text-sm); padding: 0.3rem 0.4rem; }
    .sd__c-wrap { resize: none; overflow: hidden; line-height: 1.3; white-space: pre-wrap; word-break: break-word; font-family: inherit; }
    .sd__marche-tb { border-bottom: 3px solid var(--c-200); }
    .sd__c-mont { text-align: right; }
    .sd__benef-cell { display: flex; gap: 0.25rem; align-items: center; }
    .sd__benef-cell .form-control { flex: 1; }
    .sd__marche-actions { display: flex; flex-direction: column; gap: 0.35rem; align-items: stretch; }
    .sd__marche-actions .btn { white-space: normal; }
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
    .sd__dates-manq { color: var(--warning-text); font-size: var(--text-sm); font-weight: 700; }
    .sd__dates-ok { color: var(--success-text); font-size: var(--text-sm); font-weight: 700; }
    .sd-proc-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .sd-proc-row .form-control { flex: 1 1 8rem; min-width: 7rem; }
    /* Sélecteur « Processus » (1er champ) élargi : ses libellés (LANCEMENT/OUVERTURE/ATTRIBUTION) sont longs. */
    .sd-proc-row .form-control:first-child { flex: 2 1 15rem; min-width: 12rem; }
    .sd-proc-err { color: var(--danger-text); display: block; }
    /* Modals lots & dates : plus larges que le confirm-modal standard pour laisser respirer les champs. */
    .modal.sd__lots-modal, .modal.sd__dates-modal { max-width: 54rem; }
    /* Titre décalé (droite + bas) : l'en-tête « plein » n'a pas de padding par défaut, on l'aligne sur le corps. */
    .sd__lots-modal .modal-header-plain, .sd__dates-modal .modal-header-plain { padding: 1.25rem 1.5rem 0.5rem; }
    .sd-lot-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .sd-lot-row .form-control { flex: 1 1 7rem; min-width: 6rem; }
    .sd-lot-row .form-control:first-child { flex: 3 1 16rem; min-width: 13rem; }
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
  private uidCounter = 0;

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
  /** Options du select « Forme du marché » (liste fermée, libellés d'affichage). */
  readonly formes = (Object.entries(FORME_MARCHE_LIBELLES) as [FormeMarche, string][]).map(([code, libelle]) => ({ code, libelle }));

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
  /** Vrai quand les lignes courantes proviennent d'un import PDF : le tableau passe en lecture seule (sauf les CAPM/dates). */
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
  /** Ligne de marché (création) dont les processus prévisionnels sont en cours d'édition (null = modal fermé). */
  readonly datesCible = signal<FormGroup | null>(null);
  /** Copie de travail des processus du marché en édition (FormArray de { idCapm, dateDebut, dateFin }). */
  readonly datesForm = this.fb.array([] as FormGroup[]);
  /** Erreurs de cohérence chronologique par processus (clé = idCapm). */
  readonly procErreurs = signal<Record<number, string>>({});

  /** Ligne de marché dont les lots (allotissement) sont en cours d'édition (null = modal fermé). */
  readonly lotsCible = signal<FormGroup | null>(null);
  /** Copie de travail des lots du marché en édition (FormArray de { designationLot, montLot, qteLot, uniteLot }). */
  readonly lotsForm = this.fb.array([] as FormGroup[]);

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

  /** Construit une ligne de marché (uid stable) ; aperçu du mode recalculé à chaque modification. */
  private ligneMarche(): FormGroup {
    const uid = ++this.uidCounter;
    return this.fb.group({
      uid: [uid],
      designationMarche: [''],
      montEstim: [null as number | null],
      nouvMontEstim: [null as number | null],
      numCompte: [null as string | null],
      financement: [''],
      statut: ['PREVU'],
      // Nature/mode en saisie libre (comme montant) : le libellé est résolu-ou-créé au POST par le backend.
      natureLibelle: [''],
      modeLibelle: [''],
      // Forme du marché : défaut réglementaire « à quantité fixe » (pré-remplie par l'import si relevée dans l'objet).
      formeMarche: ['QUANTITE_FIXE' as FormeMarche],
      // Ventilation par bénéficiaire (SOA + montants) — au moins une ligne (une ligne vide est ignorée au POST).
      beneficiaires: this.fb.array([this.ligneBeneficiaire()]),
      // Lots (allotissement) — optionnels, descriptifs (aucun contrôle de somme) ; édités via un modal dédié.
      lots: this.fb.array([] as FormGroup[]),
      processus: this.fb.array([] as FormGroup[]),
    });
  }
  /** Un groupe lot { designationLot, montLot, qteLot, uniteLot } d'une ligne de marché (désignation obligatoire). */
  private ligneLot(l?: { designationLot?: string; montLot?: number | null; qteLot?: number | null; uniteLot?: string }): FormGroup {
    return this.fb.group({
      designationLot: [l?.designationLot ?? '', Validators.required],
      montLot: [l?.montLot ?? (null as number | null)],
      qteLot: [l?.qteLot ?? (null as number | null)],
      uniteLot: [l?.uniteLot ?? ''],
    });
  }
  /**
   * Montant à retenir pour le **montant d'un lot dérivé du marché** (le lot-objet pré-rempli) : le
   * **nouveau montant estimatif** s'il est renseigné (marché révisé), sinon le montant estimatif initial.
   * `undefined` si les deux sont vides. Vaut quel que soit le nombre de lots (le lot-objet conserve ce
   * montant ; les lots ajoutés manuellement gardent leur propre saisie).
   */
  private montantLotObjet(montEstim: unknown, nouvMontEstim: unknown): number | undefined {
    if (nouvMontEstim != null && nouvMontEstim !== '') return Number(nouvMontEstim);
    return montEstim != null && montEstim !== '' ? Number(montEstim) : undefined;
  }
  /** Un groupe bénéficiaire { soaCode, numCompte, ancMontBenef, nouvMontBenef } d'une ligne de marché. */
  private ligneBeneficiaire(b?: { soaCode?: string; numCompte?: string; ancMontBenef?: number; nouvMontBenef?: number }): FormGroup {
    return this.fb.group({
      soaCode: [b?.soaCode ?? ''],
      numCompte: [b?.numCompte ?? ''],
      ancMontBenef: [b?.ancMontBenef ?? (null as number | null)],
      nouvMontBenef: [b?.nouvMontBenef ?? (null as number | null)],
    });
  }
  /** Lignes bénéficiaires d'un marché (copie de travail du formulaire). */
  beneficiairesControls(g: FormGroup): FormGroup[] {
    return (g.get('beneficiaires') as FormArray).controls as FormGroup[];
  }
  ajouterBeneficiaire(g: FormGroup): void {
    (g.get('beneficiaires') as FormArray).push(this.ligneBeneficiaire());
  }
  retirerBeneficiaire(g: FormGroup, i: number): void {
    (g.get('beneficiaires') as FormArray).removeAt(i);
  }
  // — Accès direct aux contrôles pour la liaison en cellules de tableau —
  /** Contrôle d'un champ de la ligne de marché. */
  ctrl(g: FormGroup, nom: string): FormControl {
    return g.get(nom) as FormControl;
  }
  /** Contrôle d'un champ du i-ème bénéficiaire d'un marché. */
  benefCtrl(g: FormGroup, i: number, nom: string): FormControl {
    return (g.get('beneficiaires') as FormArray).at(i).get(nom) as FormControl;
  }
  /** Rowspan des colonnes marché = nombre de lignes bénéficiaires (au moins 1). */
  rowspanBenef(g: FormGroup): number {
    return Math.max(1, this.beneficiairesControls(g).length);
  }
  /** Index d'un marché dans le FormArray (pour la suppression). */
  marcheIndex(g: FormGroup): number {
    return this.marcheControls().indexOf(g);
  }
  /** Libellé d'affichage d'une forme de marché (cellule lecture seule après import). */
  formeLabel(code: string | null | undefined): string {
    return code ? FORME_MARCHE_LIBELLES[code as FormeMarche] ?? code : '';
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
  ajouterMarche(): void {
    this.ensureMarcheRefs();
    this.marchesArray.push(this.ligneMarche());
  }
  retirerMarche(i: number): void {
    this.marchesArray.removeAt(i);
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
    for (const m of r.marches ?? []) {
      const g = this.ligneMarche();
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
          this.ligneBeneficiaire({ soaCode: b.soaCode, numCompte: b.numCompte, ancMontBenef: b.ancMontBenef, nouvMontBenef: b.nouvMontBenef }),
        );
      }
      if (!benefArr.length) benefArr.push(this.ligneBeneficiaire()); // toujours au moins une ligne
      // Lots : le parser ne les extrait pas des PPM actuels (toujours vide) ; mappé par fidélité au contrat.
      const lotArr = g.get('lots') as FormArray;
      for (const lt of m.lots ?? []) {
        if (!lt.designationLot) continue;
        lotArr.push(this.ligneLot({ designationLot: lt.designationLot, montLot: lt.montLot, qteLot: lt.qteLot, uniteLot: lt.uniteLot }));
      }
      // Prévisions (jalons) : idCapm résolu depuis le libellé + date de début ; date de fin à compléter (non fournie).
      const procArr = g.get('processus') as FormArray;
      for (const p of m.previsions ?? []) {
        const idCapm =
          this.capms().find((c) => (c.libelleProcessus ?? '').toUpperCase() === (p.processus ?? '').toUpperCase())
            ?.idCapm ?? null;
        procArr.push(this.processusGroup({ idCapm, dateDebut: p.dateDebut, dateFin: '' }));
        previsionsPresentes = true;
      }
      this.marchesArray.push(g);
    }
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
    // Données issues du PDF : verrouiller le tableau (seules les CAPM/dates restent modifiables).
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

  // — Processus prévisionnels d'une ligne de marché (création) —
  /** Un groupe { idCapm, dateDebut, dateFin } pour le modal des processus. */
  private processusGroup(p?: { idCapm?: number | null; dateDebut?: string; dateFin?: string }): FormGroup {
    return this.fb.group({
      idCapm: [p?.idCapm ?? null, Validators.required],
      dateDebut: [p?.dateDebut ?? '', Validators.required],
      // Date de fin **optionnelle** (backend : `dateFin` nullable ; chronologie ignorée si absente).
      dateFin: [p?.dateFin ?? ''],
    });
  }
  /** Nombre de processus saisis sur une ligne de marché. */
  nbProcessus(g: FormGroup): number {
    return (g.get('processus') as FormArray).length;
  }
  /** Au moins un processus saisi ? */
  datesSaisies(g: FormGroup): boolean {
    return this.nbProcessus(g) > 0;
  }
  /** Lignes de processus de la copie de travail (modal). */
  procControls(): FormGroup[] {
    return this.datesForm.controls as FormGroup[];
  }
  /** CAPM sélectionnables pour une ligne du modal = non utilisés par les autres lignes (+ sa valeur). */
  capmsPourProc(ctrl: FormGroup): Capm[] {
    const autres = new Set(
      this.procControls()
        .filter((g) => g !== ctrl)
        .map((g) => g.get('idCapm')!.value as number)
        .filter((v) => v != null),
    );
    return this.capms().filter((c) => !autres.has(c.idCapm));
  }
  peutAjouterProc(): boolean {
    const utilises = new Set(this.procControls().map((g) => g.get('idCapm')!.value as number));
    return this.capms().some((c) => !utilises.has(c.idCapm));
  }
  ajouterProc(): void {
    const utilises = new Set(this.procControls().map((g) => g.get('idCapm')!.value as number));
    const libre = this.capms().find((c) => !utilises.has(c.idCapm));
    this.datesForm.push(this.processusGroup({ idCapm: libre?.idCapm }));
  }
  retirerProc(i: number): void {
    this.datesForm.removeAt(i);
  }
  procErreur(idCapm: number | null): string | undefined {
    return idCapm == null ? undefined : this.procErreurs()[idCapm];
  }
  /**
   * Cohérence chronologique des processus (triés par `ordre` CAPM) : `dateDebut < dateFin` pour chacun,
   * et `dateDebut[n] >= dateFin[n-1]` entre consécutifs. Renseigne `procErreurs` (clé idCapm) ; renvoie
   * `true` si tout est cohérent. (Comparaison lexicographique d'ISO `yyyy-MM-dd` = chronologique.)
   */
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
        err[p.idCapm!] =
          `La date de début de ${lib} doit être postérieure ou égale à la date de fin de ${libPrec}.`;
      }
    }
    this.procErreurs.set(err);
    return Object.keys(err).length === 0;
  }
  /** Ouvre le modal des processus : copie de travail pré-remplie depuis la ligne. */
  ouvrirDates(g: FormGroup): void {
    this.procErreurs.set({});
    this.datesForm.clear();
    (g.get('processus') as FormArray).controls.forEach((p) =>
      this.datesForm.push(this.processusGroup((p as FormGroup).getRawValue())),
    );
    this.datesCible.set(g);
  }
  annulerDates(): void {
    this.procErreurs.set({});
    this.datesCible.set(null);
  }
  /** Valide la copie de travail (≥1 processus, tous complets, chronologie cohérente) et la recopie. */
  validerDates(): void {
    const g = this.datesCible();
    if (!g) {
      return;
    }
    if (!this.datesForm.length || this.datesForm.invalid) {
      this.datesForm.markAllAsTouched();
      return;
    }
    if (!this.validerChronologie(this.procControls())) {
      return;
    }
    const arr = g.get('processus') as FormArray;
    arr.clear();
    this.procControls().forEach((c) => arr.push(this.processusGroup(c.getRawValue())));
    g.markAsDirty();
    this.datesCible.set(null);
  }

  // — Lots (allotissement) d'une ligne de marché (création) —
  /**
   * Nombre de lots **effectifs** affiché sur le bouton : les lots saisis, ou **1** (le lot-objet par
   * défaut) dès qu'un objet est renseigné — reflète la règle « marché sans lot = lot unique = objet »
   * sans exiger d'ouvrir le modal ni de valider. 0 seulement si aucun lot ni objet.
   */
  nbLots(g: FormGroup): number {
    const saisis = (g.get('lots') as FormArray).length;
    if (saisis) return saisis;
    return (g.get('designationMarche')!.value as string)?.trim() ? 1 : 0;
  }
  /** Vrai si des lots ont été saisis explicitement (sinon le « lot » affiché est le lot-objet par défaut). */
  lotsExplicites(g: FormGroup): boolean {
    return (g.get('lots') as FormArray).length > 0;
  }
  /** Lignes de lot de la copie de travail (modal). */
  lotControls(): FormGroup[] {
    return this.lotsForm.controls as FormGroup[];
  }
  /** Contrôle d'un champ du i-ème lot de la copie de travail. */
  lotCtrl(i: number, nom: string): FormControl {
    return this.lotsForm.at(i).get(nom) as FormControl;
  }
  /** Ouvre le modal des lots : copie de travail pré-remplie depuis la ligne. */
  ouvrirLots(g: FormGroup): void {
    this.lotsForm.clear();
    const existants = (g.get('lots') as FormArray).controls;
    if (existants.length) {
      existants.forEach((l) => this.lotsForm.push(this.ligneLot((l as FormGroup).getRawValue())));
    } else {
      // Aucun lot saisi : on pré-affiche le lot unique = l'objet du marché (désignation = objet, montant = montEstim),
      // reflet de la règle appliquée au POST. Éditable : l'utilisateur peut le modifier ou ajouter d'autres lots.
      const objet = (g.get('designationMarche')!.value as string)?.trim();
      if (objet) {
        const montLot = this.montantLotObjet(g.get('montEstim')!.value, g.get('nouvMontEstim')!.value) ?? null;
        this.lotsForm.push(this.ligneLot({ designationLot: objet, montLot }));
      }
    }
    this.lotsCible.set(g);
  }
  ajouterLot(): void {
    this.lotsForm.push(this.ligneLot());
  }
  retirerLot(i: number): void {
    this.lotsForm.removeAt(i);
  }
  annulerLots(): void {
    this.lotsCible.set(null);
  }
  /** Valide (désignations non vides) et recopie les lots dans la ligne de marché. */
  validerLots(): void {
    const g = this.lotsCible();
    if (!g) return;
    if (this.lotsForm.invalid) {
      this.lotsForm.markAllAsTouched();
      return;
    }
    const arr = g.get('lots') as FormArray;
    arr.clear();
    this.lotControls().forEach((c) => arr.push(this.ligneLot(c.getRawValue())));
    g.markAsDirty();
    this.lotsCible.set(null);
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
          ? [{ designationLot: objet.slice(0, 200), montLot: this.montantLotObjet(l['montEstim'], l['nouvMontEstim']) }]
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
