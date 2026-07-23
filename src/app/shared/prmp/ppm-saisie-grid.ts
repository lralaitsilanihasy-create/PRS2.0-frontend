import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { AutosizeDirective } from '../autosize.directive';
import { MontantFrDirective } from '../montant-fr.directive';
import { AnomalieTranscription, Capm, Compte, FORME_MARCHE_LIBELLES, FormeMarche, ModePassation, Nature, SoaBeneficiaire } from '../../models';
import { PpmFormFactory } from './ppm-form-factory';

/**
 * Grille **éditable partagée** de saisie des marchés d'un PPM : table façon PPM (marché + bénéficiaires
 * + lots + processus/CAPM), revue de transcription (bandeaux auto-corrigé / à vérifier, surlignage
 * cellules, validation par ligne) et modals CAPM & Lots. Portée par la soumission d'un dossier ET le
 * réimport dans le détail PPM, pour une expérience identique des deux côtés.
 *
 * Le composant **ne possède pas** le `FormArray` des marchés (passé en entrée `marches`) ni les
 * anomalies (`anomaliesParLigne`, calculées par l'appelant à l'import) : il possède seulement l'état
 * d'UI (lignes validées, copies de travail des modals). Il **expose** `nbAValiderRestantes()` et
 * `benefsCoherents` pour que le parent conditionne son action (Créer / Enregistrer).
 */
@Component({
  selector: 'app-ppm-saisie-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MontantFrDirective, AutosizeDirective],
  template: `
    @if (nbAutoCorrige()) {
      <div class="alert sd__soa sd__alert-ok">
        <div class="sd__warn-title">✓ {{ nbAutoCorrige() }} ligne(s) auto-corrigée(s) par le système (fragments recollés, montants réalignés) — à confirmer.</div>
      </div>
    }
    @if (nbAConfirmer()) {
      <div class="alert alert-warning sd__soa">
        <div class="sd__warn-title">⚠ {{ nbAConfirmer() }} ligne(s) à vérifier — transcription de l'import</div>
        <ul class="sd__warn-list">
          @for (g of marcheControls(); track g.get('uid')!.value; let i = $index) {
            @if (aVerifier(g)) {
              <li><button type="button" class="sd__lien-ligne" (click)="scrollToMarche(g.get('uid')!.value)">Ligne {{ i + 1 }}</button> : {{ messagesReels(g) }}</li>
            }
          }
        </ul>
      </div>
    }

    <div class="sd__lignes-head">
      <button type="button" class="btn btn-secondary btn-sm" (click)="ajouterMarche()">+ Ajouter une ligne</button>
    </div>
    @if (!marcheControls().length) {
      <p class="cnm-muted">Aucun marché. Vous pouvez enregistrer sans marché et en ajouter plus tard.</p>
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
            <tbody class="sd__marche-tb" [attr.id]="'psg-m-' + g.get('uid')!.value" [class.sd__row-valide]="estValidee(g)" [class.sd__row-warn]="aVerifier(g) && !estValidee(g)" [class.sd__row-ok]="corrigeeSeulement(g) && !estValidee(g)">
              @for (b of beneficiairesControls(g); track b.get('uid')!.value; let first = $first; let i = $index) {
                <tr>
                  @if (first) {
                    <td [attr.rowspan]="rowspanBenef(g)"><textarea class="form-control sd__c-wrap" rows="1" appAutosize [formControl]="ctrl(g, 'natureLibelle')" placeholder="Nature"></textarea></td>
                    <td [attr.rowspan]="rowspanBenef(g)" [class]="classeCellule(g, 'objet')"><textarea class="form-control sd__c-wrap" rows="1" appAutosize [formControl]="ctrl(g, 'designationMarche')" placeholder="Objet"></textarea></td>
                    <td [attr.rowspan]="rowspanBenef(g)" [class]="classeCellule(g, 'montEstim')"><input class="form-control sd__c-mont" type="text" inputmode="decimal" appMontantFr [formControl]="ctrl(g, 'montEstim')" /></td>
                    <td [attr.rowspan]="rowspanBenef(g)"><input class="form-control sd__c-mont" type="text" inputmode="decimal" appMontantFr [formControl]="ctrl(g, 'nouvMontEstim')" placeholder="(si révisé)" /></td>
                    <td [attr.rowspan]="rowspanBenef(g)"><input class="form-control" type="text" [formControl]="ctrl(g, 'modeLibelle')" list="psg-modes" placeholder="Mode" /></td>
                    <td [attr.rowspan]="rowspanBenef(g)">
                      <select class="form-control" [formControl]="ctrl(g, 'formeMarche')" title="Forme du marché">
                        @for (f of formes; track f.code) { <option [value]="f.code">{{ f.libelle }}</option> }
                      </select>
                    </td>
                    <td [attr.rowspan]="rowspanBenef(g)"><input class="form-control" type="text" [formControl]="ctrl(g, 'financement')" /></td>
                  }
                  <td><input class="form-control" type="text" [formControl]="bctrl(b, 'soaCode')" list="psg-soa" placeholder="SOA" /></td>
                  <td><input class="form-control" type="text" [formControl]="bctrl(b, 'numCompte')" list="psg-comptes" placeholder="Compte" /></td>
                  <td><input class="form-control sd__c-mont" type="text" inputmode="decimal" appMontantFr [formControl]="bctrl(b, 'ancMontBenef')" /></td>
                  <td>
                    <div class="sd__benef-cell">
                      <input class="form-control sd__c-mont" type="text" inputmode="decimal" appMontantFr [formControl]="bctrl(b, 'nouvMontBenef')" placeholder="(si révisé)" />
                      <button type="button" class="btn btn-secondary btn-sm" [disabled]="beneficiairesControls(g).length === 1" (click)="retirerBeneficiaire(g, i)" aria-label="Retirer le bénéficiaire">✕</button>
                    </div>
                  </td>
                  @if (first) {
                    <td [attr.rowspan]="rowspanBenef(g)" class="sd__marche-actions">
                      @if (!isImport()) {
                        <button type="button" class="btn btn-secondary btn-sm" (click)="ajouterBeneficiaire(g)">+ bénéficiaire</button>
                      }
                      <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirDates(g)">CAPM</button>
                      @if (!datesSaisies(g)) {
                        <span class="sd__dates-manq">⚠ Dates manquantes</span>
                      }
                      <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirLots(g)"
                        [class.sd__lot-warn]="aAnomalieLot(g)"
                        [title]="lotsExplicites(g) ? '' : 'Lot unique par défaut = objet du marché ; cliquez pour le modifier ou en ajouter.'">
                        Lots ({{ nbLots(g) }})
                      </button>
                      @if (!isImport()) {
                        <button type="button" class="btn btn-danger btn-sm" (click)="retirerMarche(marcheIndex(g))">Retirer</button>
                      }
                      @if (estValidee(g)) {
                        <span class="sd__badge-valide" [title]="messagesAnomalie(g)">✓ validé</span>
                      } @else if (aVerifier(g)) {
                        <span class="sd__badge-warn" [title]="messagesAnomalie(g)">⚠ à vérifier</span>
                      } @else if (corrigeeSeulement(g)) {
                        <span class="sd__badge-ok" [title]="messagesAnomalie(g)">✓ auto-corrigé</span>
                      }
                      @if (aValider(g)) {
                        <button type="button" class="btn btn-sm" [class.sd__valider-btn]="!estValidee(g)" [class.btn-outline]="estValidee(g)" (click)="basculerValidation(g)">
                          {{ estValidee(g) ? '↩ Annuler' : '✓ Valider' }}
                        </button>
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
    <datalist id="psg-modes">@for (m of modesList(); track m.idMode) { <option [value]="m.libelle"></option> }</datalist>
    <datalist id="psg-comptes">@for (c of comptes(); track c.numCompte) { <option [value]="c.numCompte">{{ c.libelle }}</option> }</datalist>
    <datalist id="psg-soa">@for (s of soaList(); track s.soaCode) { <option [value]="s.soaCode">{{ s.libelle }}</option> }</datalist>

    @if (nbAValider()) {
      <div class="sd__validation">
        <span [class.sd__validation--ok]="nbAValiderRestantes() === 0">
          ✓ {{ nbValidees() }} / {{ nbAValider() }} ligne(s) signalée(s) validée(s)@if (nbAValiderRestantes()) { — validez chaque ligne (bouton « Valider ») pour enregistrer. }
        </span>
        @if (nbAValiderRestantes()) {
          <button type="button" class="btn btn-secondary btn-sm" (click)="toutValider()">✓ Tout valider</button>
        } @else {
          <button type="button" class="btn btn-ghost btn-sm" (click)="toutInvalider()">↩ Tout dé-valider</button>
        }
      </div>
    }

    @if (datesCible()) {
      <div class="modal-backdrop" (click)="annulerDates()">
        <div class="modal confirm-modal cnm-form sd__dates-modal" (click)="$event.stopPropagation()">
          <div class="modal-header-plain">
            <span class="modal-title">CAPM du marché</span>
          </div>
          <div class="modal-body">
            <p class="form-hint">Au moins un processus est obligatoire ; un processus par ligne. La <strong>date de fin est optionnelle</strong>.</p>
            @for (ctrl of procControls(); track ctrl.get('uid')!.value) {
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
            <button type="button" class="btn btn-primary" [disabled]="!procControls().length" (click)="validerDates(); $event.stopPropagation()">Valider</button>
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
            <p class="form-hint">
              Par défaut, le marché forme un <strong>lot unique = son objet</strong> (ligne pré-remplie ci-dessous) ;
              modifiez-le ou ajoutez des lots pour l'allotir. La désignation est obligatoire ; montant, quantité et
              unité sont descriptifs (aucun contrôle de somme).
            </p>
            @for (ctrl of lotControls(); track ctrl.get('uid')!.value) {
              <div class="sd-lot-row" [formGroup]="ctrl">
                <input class="form-control" type="text" formControlName="designationLot" placeholder="Désignation du lot *" aria-label="Désignation du lot" />
                <input class="form-control sd__c-mont" type="number" formControlName="montLot" placeholder="Montant" aria-label="Montant" />
                <input class="form-control" type="number" formControlName="qteLot" placeholder="Quantité" aria-label="Quantité" />
                <input class="form-control" type="text" formControlName="uniteLot" placeholder="Unité" aria-label="Unité" />
                <button type="button" class="btn btn-secondary btn-sm" (click)="retirerLot($index)" aria-label="Retirer">✕</button>
              </div>
              @if (lotCtrl($index, 'designationLot').touched && lotCtrl($index, 'designationLot').hasError('required')) {
                <span class="form-error sd-proc-err">La désignation du lot est obligatoire.</span>
              }
            } @empty {
              <p class="form-hint">Renseignez d'abord l'<strong>objet</strong> du marché (il servira de lot unique), ou ajoutez un lot ci-dessous.</p>
            }
            <div>
              <button type="button" class="btn btn-secondary btn-sm" (click)="ajouterLot()">+ Ajouter un lot</button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="annulerLots(); $event.stopPropagation()">Annuler</button>
            <button type="button" class="btn btn-primary" (click)="validerLots(); $event.stopPropagation()">Valider</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .sd__soa { display: flex; flex-direction: column; gap: 0.4rem; }
    .sd__warn-title { font-weight: 600; margin-bottom: 4px; }
    .sd__warn-list { margin: 0; padding-left: 1rem; font-size: var(--text-sm); }
    /* Revue de transcription : surlignage des lignes/cellules signalées + badge. */
    .sd__row-warn td { background: rgba(245, 158, 11, 0.06); }
    .sd__row-ok td { background: rgba(34, 197, 94, 0.05); }
    .sd__cell-warn { background: #FFFBEB !important; }
    .sd__cell-err { background: #FEF2F2 !important; }
    .sd__cell-ok { background: #F0FDF4 !important; }
    .sd__badge-warn { display: inline-block; font-size: var(--text-xs); font-weight: 700; color: #B45309; background: #FFFBEB; border: 1px solid #F59E0B; border-radius: 999px; padding: 0.1rem 0.45rem; cursor: help; }
    .sd__badge-ok { display: inline-block; font-size: var(--text-xs); font-weight: 700; color: #15803D; background: #F0FDF4; border: 1px solid #22C55E; border-radius: 999px; padding: 0.1rem 0.45rem; cursor: help; }
    .sd__alert-ok { background: #F0FDF4; border: 1px solid #BBF7D0; color: #15803D; }
    .sd__lien-ligne { background: none; border: none; padding: 0; color: var(--info-text, #2563eb); font-weight: 700; text-decoration: underline; cursor: pointer; font: inherit; }
    /* Validation par ligne : ligne/badge « validé » (vert) + barre de progression. */
    .sd__row-valide td { background: rgba(34, 197, 94, 0.12); }
    .sd__badge-valide { display: inline-block; font-size: var(--text-xs); font-weight: 700; color: #fff; background: #22C55E; border: 1px solid #16A34A; border-radius: 999px; padding: 0.1rem 0.45rem; cursor: help; }
    .sd__validation { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; font-size: var(--text-sm); font-weight: 600; color: var(--n-600, #475569); margin-top: 0.75rem; }
    .sd__validation--ok { color: #15803D; }
    /* Bouton « Valider » remarquable : vert plein, léger relief. */
    .sd__valider-btn { color: #fff !important; border: none !important; font-weight: 700; background: linear-gradient(135deg, #16A34A, #22C55E); box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4); }
    .sd__valider-btn:hover { color: #fff !important; filter: brightness(1.06); }
    /* Message de cohérence inline : s'enroule proprement dans la cellule Actions (jamais coupé). */
    .sd__marche-actions .form-error { white-space: normal; overflow-wrap: anywhere; font-size: var(--text-xs); }
    .sd__lot-warn { border-color: #F59E0B !important; color: #B45309 !important; background: #FFFBEB !important; }
    .sd__lignes-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
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
    .sd__dates-manq { color: var(--warning-text); font-size: var(--text-sm); font-weight: 700; }
    .sd-proc-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .sd-proc-row .form-control { flex: 1 1 8rem; min-width: 7rem; }
    /* Sélecteur « Processus » (1er champ) élargi : ses libellés (LANCEMENT/OUVERTURE/ATTRIBUTION) sont longs. */
    .sd-proc-row .form-control:first-child { flex: 2 1 15rem; min-width: 12rem; }
    .sd-proc-err { color: var(--danger-text); display: block; }
    /* Modals lots & dates : plus larges que le confirm-modal standard pour laisser respirer les champs. */
    .modal.sd__lots-modal, .modal.sd__dates-modal { max-width: 54rem; }
    .sd__lots-modal .modal-header-plain, .sd__dates-modal .modal-header-plain { padding: 1.25rem 1.5rem 0.5rem; }
    .sd-lot-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .sd-lot-row .form-control { flex: 1 1 7rem; min-width: 6rem; }
    .sd-lot-row .form-control:first-child { flex: 3 1 16rem; min-width: 13rem; }
  `,
})
export class PpmSaisieGrid {
  private readonly fb = inject(FormBuilder);
  private readonly factory = inject(PpmFormFactory);

  /**
   * FormArray des marchés (possédé par le parent ; la grille l'édite en place). Optionnel + défaut `null` :
   * le parent le passe toujours, mais l'input peut être lu (via son `viewChild`) avant d'être posé pendant
   * une passe de détection — le défaut évite alors un NG0950 (input requis lu trop tôt).
   */
  readonly marches = input<FormArray | null>(null);
  readonly natures = input<Nature[]>([]);
  readonly modesList = input<ModePassation[]>([]);
  readonly comptes = input<Compte[]>([]);
  readonly soaList = input<SoaBeneficiaire[]>([]);
  readonly capms = input<Capm[]>([]);
  /** Anomalies de transcription par ligne (clé = uid du marché), calculées à l'import par l'appelant. */
  readonly anomaliesParLigne = input<Map<number, AnomalieTranscription[]>>(new Map());
  /** `import` masque « + bénéficiaire » et « Retirer » (données importées) ; `manuel` les affiche. */
  readonly mode = input<'import' | 'manuel'>('manuel');
  readonly isImport = computed(() => this.mode() === 'import');

  readonly formes = (Object.entries(FORME_MARCHE_LIBELLES) as [FormeMarche, string][]).map(([code, libelle]) => ({ code, libelle }));

  /** Uid des lignes signalées validées par l'utilisateur (gate avant enregistrement). */
  readonly lignesValidees = signal<Set<number>>(new Set());

  constructor() {
    // Chaque nouvel import produit une **nouvelle** map d'anomalies (identité différente) : on repart d'une
    // revue vierge. Indispensable pour la grille persistante de la soumission (le modal recrée une grille neuve).
    effect(() => {
      this.anomaliesParLigne();
      this.lignesValidees.set(new Set());
    });
  }

  // — Copies de travail des modals —
  readonly datesCible = signal<FormGroup | null>(null);
  readonly datesForm = this.fb.array([] as FormGroup[]);
  private readonly procErreurs = signal<Record<number, string>>({});
  readonly lotsCible = signal<FormGroup | null>(null);
  readonly lotsForm = this.fb.array([] as FormGroup[]);

  // — Accès aux contrôles —
  marcheControls(): FormGroup[] {
    return (this.marches()?.controls as FormGroup[]) ?? [];
  }
  beneficiairesControls(g: FormGroup): FormGroup[] {
    return (g.get('beneficiaires') as FormArray).controls as FormGroup[];
  }
  ajouterMarche(): void {
    this.marches()?.push(this.factory.ligneMarche());
  }
  retirerMarche(i: number): void {
    this.marches()?.removeAt(i);
  }
  marcheIndex(g: FormGroup): number {
    return this.marcheControls().indexOf(g);
  }
  ajouterBeneficiaire(g: FormGroup): void {
    (g.get('beneficiaires') as FormArray).push(this.factory.ligneBeneficiaire());
  }
  retirerBeneficiaire(g: FormGroup, i: number): void {
    (g.get('beneficiaires') as FormArray).removeAt(i);
  }
  ctrl(g: FormGroup, nom: string): FormControl {
    return g.get(nom) as FormControl;
  }
  bctrl(b: FormGroup, nom: string): FormControl {
    return b.get(nom) as FormControl;
  }
  /** Rowspan des colonnes marché = nombre de lignes bénéficiaires (au moins 1). */
  rowspanBenef(g: FormGroup): number {
    return Math.max(1, this.beneficiairesControls(g).length);
  }

  // — Revue de transcription (anomalies) —
  /** Anomalies de transcription d'une ligne (contrat backend `m.anomalies`). */
  anomaliesDe(g: FormGroup): AnomalieTranscription[] {
    return this.anomaliesParLigne().get(g.get('uid')!.value) ?? [];
  }
  /** Anomalie « réelle » (à examiner) : bloquante, ou à vérifier NON auto-corrigée. */
  private estReelle(a: AnomalieTranscription): boolean {
    return a.gravite === 'BLOQUANT' || !a.corrige;
  }
  /** Une ligne est validable dès qu'elle porte ≥1 anomalie. */
  private ligneValidable(list: AnomalieTranscription[]): boolean {
    return list.length > 0;
  }
  /** Une anomalie touche-t-elle les lots (pour surligner le bouton « Lots ») ? */
  aAnomalieLot(g: FormGroup): boolean {
    return this.anomaliesDe(g).some((a) => a.champ === 'lot');
  }
  aVerifier(g: FormGroup): boolean {
    return this.anomaliesDe(g).some((a) => this.estReelle(a));
  }
  corrigeeSeulement(g: FormGroup): boolean {
    const a = this.anomaliesDe(g);
    return a.length > 0 && !a.some((x) => this.estReelle(x));
  }
  aValider(g: FormGroup): boolean {
    return this.ligneValidable(this.anomaliesDe(g));
  }
  estValidee(g: FormGroup): boolean {
    return this.lignesValidees().has(g.get('uid')!.value);
  }
  basculerValidation(g: FormGroup): void {
    const uid = g.get('uid')!.value as number;
    this.lignesValidees.update((s) => {
      const n = new Set(s);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
  }
  toutValider(): void {
    const uids = [...this.anomaliesParLigne().entries()].filter(([, list]) => this.ligneValidable(list)).map(([uid]) => uid);
    this.lignesValidees.set(new Set(uids));
  }
  toutInvalider(): void {
    this.lignesValidees.set(new Set());
  }
  classeCellule(g: FormGroup, champ: 'objet' | 'montEstim'): string {
    const a = this.anomaliesDe(g).filter((x) => x.champ === champ);
    if (!a.length) return '';
    if (a.some((x) => x.gravite === 'BLOQUANT')) return 'sd__cell-err';
    if (a.some((x) => !x.corrige)) return 'sd__cell-warn';
    return 'sd__cell-ok';
  }
  messagesAnomalie(g: FormGroup): string {
    return this.anomaliesDe(g).map((a) => a.message).join(' ');
  }
  messagesReels(g: FormGroup): string {
    return this.anomaliesDe(g).filter((a) => this.estReelle(a)).map((a) => a.message).join(' ');
  }
  scrollToMarche(uid: number): void {
    document.getElementById('psg-m-' + uid)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // — Compteurs de revue / validation (exposés au parent pour son gate) —
  readonly nbAConfirmer = computed(
    () => [...this.anomaliesParLigne().values()].filter((list) => list.some((a) => this.estReelle(a))).length,
  );
  readonly nbAutoCorrige = computed(
    () => [...this.anomaliesParLigne().values()].filter((list) => list.length > 0 && !list.some((a) => this.estReelle(a))).length,
  );
  readonly nbAValider = computed(
    () => [...this.anomaliesParLigne().values()].filter((list) => this.ligneValidable(list)).length,
  );
  readonly nbValidees = computed(
    () => [...this.anomaliesParLigne().entries()].filter(([uid, list]) => this.ligneValidable(list) && this.lignesValidees().has(uid)).length,
  );
  /** Lignes validables restant à valider — le parent bloque son action tant que > 0. */
  readonly nbAValiderRestantes = computed(() => this.nbAValider() - this.nbValidees());

  // — Cohérence des montants par bénéficiaire —
  private benefRempli(b: FormGroup): boolean {
    return !!(b.get('soaCode')!.value || b.get('numCompte')!.value || b.get('ancMontBenef')!.value != null || b.get('nouvMontBenef')!.value != null);
  }
  /** Écart de cohérence des montants d'un marché (message inline, null si cohérent). */
  erreurCoherenceBenefs(g: FormGroup): string | null {
    const benefs = this.beneficiairesControls(g).filter((b) => this.benefRempli(b));
    if (!benefs.length) return null;
    const somme = (champ: string) => benefs.reduce((acc, b) => acc + (Number(b.get(champ)!.value) || 0), 0);
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
  /** Toutes les lignes ont-elles des bénéficiaires cohérents ? (le parent bloque l'action si non). */
  get benefsCoherents(): boolean {
    return this.marcheControls().every((g) => this.erreurCoherenceBenefs(g) === null);
  }
  /** Formate un montant (2 décimales, séparateur de milliers = espace visible), ou « » si absent. */
  private montantFmt(v?: number | null): string {
    if (v === null || v === undefined || (v as unknown) === '') return '';
    const n = Number(v);
    const [ent, dec] = Math.abs(n).toFixed(2).split('.');
    return (n < 0 ? '-' : '') + ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec;
  }

  // — Processus prévisionnels (CAPM) —
  nbProcessus(g: FormGroup): number {
    return (g.get('processus') as FormArray).length;
  }
  datesSaisies(g: FormGroup): boolean {
    return this.nbProcessus(g) > 0;
  }
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
    this.datesForm.push(this.factory.processusGroup({ idCapm: libre?.idCapm }));
  }
  retirerProc(i: number): void {
    this.datesForm.removeAt(i);
  }
  procErreur(idCapm: number | null): string | undefined {
    return idCapm == null ? undefined : this.procErreurs()[idCapm];
  }
  /**
   * Cohérence chronologique des processus (triés par `ordre` CAPM) : `dateDebut < dateFin` pour chacun,
   * et `dateDebut[n] >= dateFin[n-1]` entre consécutifs. Renseigne `procErreurs` (clé idCapm).
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
        err[p.idCapm!] = `La date de début de ${lib} doit être postérieure ou égale à la date de fin de ${libPrec}.`;
      }
    }
    this.procErreurs.set(err);
    return Object.keys(err).length === 0;
  }
  ouvrirDates(g: FormGroup): void {
    this.procErreurs.set({});
    this.datesForm.clear();
    (g.get('processus') as FormArray).controls.forEach((p) =>
      this.datesForm.push(this.factory.processusGroup((p as FormGroup).getRawValue())),
    );
    this.datesCible.set(g);
  }
  annulerDates(): void {
    this.procErreurs.set({});
    this.datesCible.set(null);
  }
  validerDates(): void {
    const g = this.datesCible();
    if (!g) return;
    if (!this.datesForm.length || this.datesForm.invalid) {
      this.datesForm.markAllAsTouched();
      return;
    }
    if (!this.validerChronologie(this.procControls())) return;
    const arr = g.get('processus') as FormArray;
    arr.clear();
    this.procControls().forEach((c) => arr.push(this.factory.processusGroup(c.getRawValue())));
    g.markAsDirty();
    this.datesCible.set(null);
  }

  // — Lots (allotissement) —
  /** Nombre de lots effectifs : les lots saisis, ou 1 (lot-objet par défaut) dès qu'un objet est renseigné. */
  nbLots(g: FormGroup): number {
    const saisis = (g.get('lots') as FormArray).length;
    if (saisis) return saisis;
    return (g.get('designationMarche')!.value as string)?.trim() ? 1 : 0;
  }
  lotsExplicites(g: FormGroup): boolean {
    return (g.get('lots') as FormArray).length > 0;
  }
  lotControls(): FormGroup[] {
    return this.lotsForm.controls as FormGroup[];
  }
  lotCtrl(i: number, nom: string): FormControl {
    return this.lotsForm.at(i).get(nom) as FormControl;
  }
  ouvrirLots(g: FormGroup): void {
    this.lotsForm.clear();
    const existants = (g.get('lots') as FormArray).controls;
    if (existants.length) {
      existants.forEach((l) => this.lotsForm.push(this.factory.ligneLot((l as FormGroup).getRawValue())));
    } else {
      const objet = (g.get('designationMarche')!.value as string)?.trim();
      if (objet) {
        const montLot = this.factory.montantLotObjet(g.get('montEstim')!.value, g.get('nouvMontEstim')!.value) ?? null;
        this.lotsForm.push(this.factory.ligneLot({ designationLot: objet, montLot }));
      }
    }
    this.lotsCible.set(g);
  }
  ajouterLot(): void {
    this.lotsForm.push(this.factory.ligneLot());
  }
  retirerLot(i: number): void {
    this.lotsForm.removeAt(i);
  }
  annulerLots(): void {
    this.lotsCible.set(null);
  }
  validerLots(): void {
    const g = this.lotsCible();
    if (!g) return;
    if (this.lotsForm.invalid) {
      this.lotsForm.markAllAsTouched();
      return;
    }
    const arr = g.get('lots') as FormArray;
    arr.clear();
    this.lotControls().forEach((c) => arr.push(this.factory.ligneLot(c.getRawValue())));
    g.markAsDirty();
    this.lotsCible.set(null);
  }
}
