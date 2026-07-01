import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, forkJoin, merge } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { DetailPpmModal } from '../../shared/prmp/detail-ppm-modal';
import { Capm, Compte, Dossier, Marche, Nature, SaisieMarcheLigne, Situation, TypeDossier, TypePieceJointe } from '../../models';
import {
  CapmService,
  CompteService,
  DossierService,
  EntiteContractService,
  LocaliteService,
  MarcheService,
  ModePassationService,
  NatureService,
  PpmService,
  PrmpEntiteService,
  PrmpService,
  ReferenceLookupService,
  ReglePassationService,
  SaisieService,
  SituationService,
  TypeDossierService,
  TypePieceJointeService,
} from '../../services';

type Phase = 'choix' | 'saisiePpm' | 'saisieDossier' | 'brouillon';

/** État d'aperçu du mode de passation (ensemble autorisé + recommandé). */
type ModeSuggestion = {
  state: 'idle' | 'loading' | 'ready' | 'none';
  modes: { idMode: number; libelle: string }[];
  recommande: number | null;
};

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
  imports: [ReactiveFormsModule, DetailPpmModal],
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
            <button type="button" class="card sd__choix-card" (click)="choisirPpm()">
              <span class="sd__choix-titre">PPM</span>
              <span class="sd__choix-desc">Plan de passation + lignes de marché (mode calculé automatiquement).</span>
            </button>
            <button type="button" class="card sd__choix-card" (click)="choisirDossier()">
              <span class="sd__choix-titre">DAO / MAOO</span>
              <span class="sd__choix-desc">Dossier simple : un type + une localité, sans PPM.</span>
            </button>
          </div>
        }

        @case ('saisiePpm') {
          <form class="card sd__form cnm-form" [formGroup]="ppmForm" (ngSubmit)="creerPpm()" novalidate>
            <div class="cnm-form-grid">
              <label class="form-group">
                <span class="form-label">Entité contractante *</span>
                <select class="form-control" formControlName="idEntiteContract">
                  <option [ngValue]="null">— Sélectionner —</option>
                  @for (e of entites(); track e.idEntiteContract) {
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
              <h2 class="sd__sub">Marchés</h2>
              <button type="button" class="btn btn-secondary btn-sm" (click)="ajouterMarche()">+ Ajouter un marché</button>
            </div>
            @if (!marcheControls().length) {
              <p class="cnm-muted">Aucun marché. Vous pouvez créer le brouillon sans marché et en ajouter plus tard.</p>
            }
            @for (g of marcheControls(); track g.get('uid')!.value) {
              <div class="sd__ligne cnm-form" [formGroup]="g">
                <div class="cnm-form-grid">
                  <label class="form-group"><span class="form-label">Désignation</span>
                    <input class="form-control" type="text" formControlName="designationMarche" /></label>
                  <label class="form-group"><span class="form-label">Montant estimé</span>
                    <input class="form-control" type="number" formControlName="montEstim" /></label>
                  <label class="form-group"><span class="form-label">Compte</span>
                    <select class="form-control" formControlName="numCompte">
                      <option [ngValue]="null">— Sélectionner —</option>
                      @for (c of comptes(); track c.numCompte) { <option [ngValue]="c.numCompte">{{ c.libelle || c.numCompte }}</option> }
                    </select></label>
                  <label class="form-group"><span class="form-label">Situation</span>
                    <select class="form-control" formControlName="idSituation">
                      <option [ngValue]="null">— Sélectionner —</option>
                      @for (s of situations(); track s.idSituation) { <option [ngValue]="s.idSituation">{{ s.libelle || '#' + s.idSituation }}</option> }
                    </select></label>
                  <label class="form-group"><span class="form-label">Nature</span>
                    <select class="form-control" formControlName="idNature">
                      <option [ngValue]="null">— Sélectionner —</option>
                      @for (n of natures(); track n.idNature) { <option [ngValue]="n.idNature">{{ n.libelle || '#' + n.idNature }}</option> }
                    </select></label>
                  <label class="form-group"><span class="form-label">Financement</span>
                    <input class="form-control" type="text" formControlName="financement" /></label>
                  <label class="form-group"><span class="form-label">Statut</span>
                    <input class="form-control" type="text" formControlName="statut" /></label>
                  <label class="form-group"><span class="form-label">Mode de passation</span>
                    @switch (modeLigne(g).state) {
                      @case ('loading') { <span class="form-hint">Détermination…</span> }
                      @case ('ready') {
                        <select class="form-control" formControlName="idMode">
                          @for (m of modeLigne(g).modes; track m.idMode) { <option [ngValue]="m.idMode">{{ m.libelle }}</option> }
                        </select>
                      }
                      @case ('none') { <span class="form-hint">Mode à déterminer (aucune règle).</span> }
                      @default { <span class="form-hint">Renseignez situation, nature et montant.</span> }
                    }
                  </label>
                </div>
                <div class="sd__ligne-foot">
                  @if (datesSaisies(g)) {
                    <span class="sd__dates-ok">📅 {{ nbProcessus(g) }} processus prévisionnel(s)</span>
                  } @else {
                    <span class="sd__dates-manq">⚠ Dates manquantes</span>
                  }
                  <span class="sd__ligne-foot-actions">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirDates(g)">
                      Dates prévisionnelles
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" (click)="retirerMarche($index)">Retirer</button>
                  </span>
                </div>
              </div>
            }

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

            <footer class="sd__foot">
              <button type="button" class="btn btn-outline" (click)="retourChoix()">Retour</button>
              <button type="submit" class="btn btn-primary" [disabled]="submitting() || !ppmFormValide">
                {{ submitting() ? 'Création…' : 'Créer le dossier' }}
              </button>
            </footer>
          </form>
        }

        @case ('saisieDossier') {
          <form class="card sd__form cnm-form" [formGroup]="dossierForm" (ngSubmit)="creerDossier()" novalidate>
            <div class="cnm-form-grid">
              <label class="form-group">
                <span class="form-label">Type de dossier *</span>
                <select class="form-control" formControlName="idTypeDossier">
                  <option [ngValue]="null">— Sélectionner —</option>
                  @for (t of typesNonPpm(); track t.idTypeDossier) {
                    <option [ngValue]="t.idTypeDossier">{{ t.libelleType || t.idTypeDossier }}</option>
                  }
                </select>
                @if (req(dossierForm, 'idTypeDossier')) { <span class="form-error">Obligatoire.</span> }
                @if (err('idTypeDossier')) { <span class="form-error">{{ err('idTypeDossier') }}</span> }
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
            <footer class="sd__foot">
              <button type="button" class="btn btn-outline" (click)="retourChoix()">Retour</button>
              <button type="submit" class="btn btn-primary" [disabled]="submitting()">
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
                [soumissible]="true"
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
                  <button type="button" class="btn btn-success" [disabled]="submitting()" (click)="soumettre()">
                    Soumettre le dossier
                  </button>
                </footer>
              </div>
            }
          }
        }
      }

      @if (datesCible()) {
        <div class="modal-backdrop" (click)="annulerDates()">
          <div class="modal confirm-modal cnm-form" (click)="$event.stopPropagation()">
            <div class="modal-header-plain">
              <span class="modal-title">Dates prévisionnelles du marché</span>
            </div>
            <div class="modal-body">
              <p class="form-hint">Au moins un processus est obligatoire ; un processus par ligne.</p>
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
    </section>
  `,
  styles: `
    .sd__brouillon { padding: 1.25rem 1.5rem; }
    .sd__choix { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .sd__choix-card { text-align: left; cursor: pointer; font: inherit; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; transition: var(--transition); }
    .sd__choix-card:hover { border-color: var(--c-400); box-shadow: var(--shadow-lg); transform: translateY(-1px); }
    .sd__choix-titre { font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .sd__choix-desc { color: var(--n-400); font-size: var(--text-sm); }
    .sd__form { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; max-width: min(64rem, 96vw); }
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
    .sd__foot { display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px solid var(--c-100); padding-top: 1rem; }
    .sd__foot--main { margin-top: 1rem; }
    .sd__soumettre-hint { margin-right: auto; align-self: center; }
    .sd__brouillon-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.5rem; }
    .sd__brouillon-id { margin-left: 0.5rem; font-weight: 700; }
    .sd__warn { margin: 0 0 1rem; }
    .sd__lignes-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
    .sd__sub { margin: 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .sd__row-actions { display: flex; gap: 0.3rem; justify-content: flex-end; }
    .sd__ligne-form { margin-top: 1rem; padding: 1rem; background: var(--c-50); border: 1px solid var(--c-100); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 0.5rem; }
    .sd__mode { display: flex; flex-direction: column; gap: 0.25rem; }
    .sd__ligne { padding: 1rem; background: var(--c-50); border: 1px solid var(--c-100); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem; }
    .sd__ligne-foot { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .sd__ligne-foot-actions { display: flex; gap: 0.5rem; }
    .sd__dates-manq { color: var(--warning-text); font-size: var(--text-sm); font-weight: 700; }
    .sd__dates-ok { color: var(--success-text); font-size: var(--text-sm); font-weight: 700; }
    .sd-proc-row { display: flex; align-items: center; gap: 0.5rem; }
    .sd-proc-row .form-control { flex: 1; min-width: 8rem; }
    .sd-proc-err { color: var(--danger-text); display: block; }
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
  private readonly entiteContractService = inject(EntiteContractService);
  private readonly typeDossierService = inject(TypeDossierService);
  private readonly natureService = inject(NatureService);
  private readonly situationService = inject(SituationService);
  private readonly compteService = inject(CompteService);
  private readonly reglePassation = inject(ReglePassationService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly destroyRef = inject(DestroyRef);
  private uidCounter = 0;
  /** Mode suggéré par ligne de marché (clé = uid stable de la ligne). */
  readonly modes = signal<Record<number, ModeSuggestion>>({});

  readonly phase = signal<Phase>('choix');
  readonly submitting = signal(false);
  readonly formError = signal<ApiError | null>(null);

  private readonly localiteMap = signal<Map<string, string>>(new Map());
  readonly typeDossiers = signal<TypeDossier[]>([]);
  readonly natures = signal<Nature[]>([]);
  readonly situations = signal<Situation[]>([]);
  readonly comptes = signal<Compte[]>([]);
  readonly modeMap = signal<Map<string, string>>(new Map());

  /** Aperçu du mode de passation pour la ligne en cours d'édition (phase reprise). */
  readonly modeSuggestion = signal<ModeSuggestion>({ state: 'idle', modes: [], recommande: null });

  readonly dossier = signal<Dossier | null>(null);
  /** idPpm du brouillon PPM courant (créé ou repris) — alimente le DetailPpmModal en phase brouillon. */
  readonly createdPpmId = signal<number | null>(null);
  readonly marches = signal<Marche[]>([]);
  readonly ligneOuverte = signal(false);
  readonly editId = signal<number | null>(null);

  /** Entités de la PRMP courante (id, libellé, localité dérivée). */
  readonly entites = signal<{ idEntiteContract: number; libelle: string; idLocalite?: string }[]>([]);
  readonly selectedEntiteId = signal<number | null>(null);

  readonly estPpm = computed(() => this.dossier()?.idTypeDossier === 'PPM');
  /** Soumission bloquée : un PPM doit comporter au moins un marché (§3.1 M03 ; sinon 409). */
  readonly ppmSansMarche = computed(() => this.estPpm() && this.marches().length === 0);
  readonly typesNonPpm = computed(() => this.typeDossiers().filter((t) => t.idTypeDossier !== 'PPM'));
  /** Localité (lecture seule) dérivée de l'entité contractante sélectionnée. */
  readonly localiteLabel = computed(() => {
    const ent = this.entites().find((e) => e.idEntiteContract === this.selectedEntiteId());
    const loc = ent?.idLocalite;
    if (!loc) return '— (sélectionnez une entité)';
    return this.localiteMap().get(loc) ?? loc;
  });

  /** Signataire du PRMP connecté (lecture seule ; le serveur le génère, ce champ n'est qu'un aperçu). */
  readonly signataireConnecte = signal('');

  readonly ppmForm = this.fb.nonNullable.group({
    idEntiteContract: [null as number | null, Validators.required],
    exercice: [new Date().getFullYear(), Validators.required],
    dateSignature: ['', Validators.required],
    marches: this.fb.array([] as FormGroup[]),
  });

  readonly dossierForm = this.fb.nonNullable.group({
    idTypeDossier: [null as string | null, Validators.required],
    idEntiteContract: [null as number | null, Validators.required],
  });

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
  /** Ligne de marché (création) dont les processus prévisionnels sont en cours d'édition (null = modal fermé). */
  readonly datesCible = signal<FormGroup | null>(null);
  /** Copie de travail des processus du marché en édition (FormArray de { idCapm, dateDebut, dateFin }). */
  readonly datesForm = this.fb.array([] as FormGroup[]);
  /** Erreurs de cohérence chronologique par processus (clé = idCapm). */
  readonly procErreurs = signal<Record<number, string>>({});

  readonly marcheForm = this.fb.nonNullable.group({
    designationMarche: [''],
    montEstim: [null as number | null],
    numCompte: [null as string | null],
    idSituation: [null as number | null],
    idNature: [null as number | null],
    idMode: [null as number | null],
  });

  private marcheRefsLoaded = false;

  constructor() {
    this.typeDossierService.list().subscribe((r) => this.typeDossiers.set(r));
    // Référentiel CAPM (processus), trié par ordre ASC — pour les selects de processus par marché.
    this.capmService.getAll().subscribe((rows) => this.capms.set([...rows].sort((a, b) => a.ordre - b.ordre)));
    // Pièces jointes attendues pour un dossier PPM (référentiel, triées par ordre côté serveur).
    this.typePieceService.getByTypeDossier('PPM').subscribe((rows) => this.typesPiece.set(rows));
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
    this.ppmForm.controls.idEntiteContract.valueChanges.subscribe((v) => {
      this.selectedEntiteId.set(v);
      // La localité (dérivée de l'entité) change → recalcul du mode de chaque ligne.
      this.marcheControls().forEach((g) => this.determinerModeLigne(g));
    });
    this.dossierForm.controls.idEntiteContract.valueChanges.subscribe((v) => this.selectedEntiteId.set(v));
    // Aperçu en direct du mode (phase reprise) : recalcul sur les seuls champs déterminants
    // (pas sur idMode, pour ne pas écraser le choix manuel).
    merge(
      this.marcheForm.controls.idSituation.valueChanges,
      this.marcheForm.controls.idNature.valueChanges,
      this.marcheForm.controls.montEstim.valueChanges,
    )
      .pipe(debounceTime(350), takeUntilDestroyed())
      .subscribe(() => this.determinerMode());
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
          .map((e) => ({ idEntiteContract: e.idEntiteContract, libelle: e.libelleEntite, idLocalite: e.idLocalite }));
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
    this.situationService.list().subscribe((r) => this.situations.set(r));
    this.compteService.list().subscribe((r) => this.comptes.set(r));
  }

  // — Choix du type —
  choisirPpm(): void {
    this.formError.set(null);
    this.phase.set('saisiePpm');
  }

  choisirDossier(): void {
    this.formError.set(null);
    this.phase.set('saisieDossier');
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
    if (d.idTypeDossier === 'PPM') {
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
    const g = this.fb.group({
      uid: [uid],
      designationMarche: [''],
      montEstim: [null as number | null],
      numCompte: [null as string | null],
      financement: [''],
      statut: ['PREVU'],
      idSituation: [null as number | null],
      idNature: [null as number | null],
      idMode: [null as number | null],
      processus: this.fb.array([] as FormGroup[]),
    });
    // Recalcul du mode sur les seuls champs déterminants (pas idMode → choix manuel préservé).
    merge(g.get('idSituation')!.valueChanges, g.get('idNature')!.valueChanges, g.get('montEstim')!.valueChanges)
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.determinerModeLigne(g));
    return g;
  }
  ajouterMarche(): void {
    this.ensureMarcheRefs();
    this.marchesArray.push(this.ligneMarche());
  }
  retirerMarche(i: number): void {
    const uid = this.marcheControls()[i].get('uid')!.value as number;
    this.marchesArray.removeAt(i);
    this.modes.update((m) => {
      const n = { ...m };
      delete n[uid];
      return n;
    });
  }
  modeLigne(g: FormGroup): ModeSuggestion {
    return this.modes()[g.get('uid')!.value as number] ?? { state: 'idle', modes: [], recommande: null };
  }
  private setMode(uid: number, s: ModeSuggestion): void {
    this.modes.update((m) => ({ ...m, [uid]: s }));
  }
  /** Localité (code) dérivée de l'entité d'en-tête sélectionnée. */
  private selectedLocaliteCode(): string | null {
    return this.entites().find((e) => e.idEntiteContract === this.selectedEntiteId())?.idLocalite ?? null;
  }
  /** Aperçu du mode pour une ligne (suggestion-mode ; la PRMP choisit, le backend valide). */
  private determinerModeLigne(g: FormGroup): void {
    const uid = g.get('uid')!.value as number;
    const v = g.getRawValue();
    const idLocalite = this.selectedLocaliteCode();
    const idMode = g.get('idMode')!;
    if (v.idSituation == null || v.idNature == null || v.montEstim == null || !idLocalite) {
      idMode.setValue(null, { emitEvent: false });
      this.setMode(uid, { state: 'idle', modes: [], recommande: null });
      return;
    }
    this.setMode(uid, { state: 'loading', modes: [], recommande: null });
    this.reglePassation
      .suggestionMode({ idSituation: v.idSituation, idNature: v.idNature, montant: v.montEstim, idLocalite })
      .subscribe({
        next: (res) => {
          if (res.modesAutorises.length) {
            const cur = idMode.value as number | null;
            if (cur == null || !res.modesAutorises.some((m) => m.idMode === cur)) {
              idMode.setValue(res.modeRecommande, { emitEvent: false });
            }
            this.setMode(uid, { state: 'ready', modes: res.modesAutorises, recommande: res.modeRecommande });
          } else {
            idMode.setValue(null, { emitEvent: false });
            this.setMode(uid, { state: 'none', modes: [], recommande: null });
          }
        },
        error: () => {
          idMode.setValue(null, { emitEvent: false });
          this.setMode(uid, { state: 'none', modes: [], recommande: null });
        },
      });
  }
  private ligneNonVide(l: Record<string, unknown>): boolean {
    // `statut` exclu : il a une valeur par défaut ('PREVU') et ne suffit pas à rendre une ligne « non vide ».
    return !!(
      l['designationMarche'] ||
      l['montEstim'] != null ||
      l['numCompte'] ||
      l['financement'] ||
      l['idSituation'] != null ||
      l['idNature'] != null
    );
  }

  // — Processus prévisionnels d'une ligne de marché (création) —
  /** Un groupe { idCapm, dateDebut, dateFin } pour le modal des processus. */
  private processusGroup(p?: { idCapm?: number | null; dateDebut?: string; dateFin?: string }): FormGroup {
    return this.fb.group({
      idCapm: [p?.idCapm ?? null, Validators.required],
      dateDebut: [p?.dateDebut ?? '', Validators.required],
      dateFin: [p?.dateFin ?? '', Validators.required],
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
    const marches: SaisieMarcheLigne[] = lignes.map((l) => ({
      designationMarche: (l['designationMarche'] as string) || undefined,
      montEstim: (l['montEstim'] as number) ?? undefined,
      numCompte: (l['numCompte'] as string) ?? undefined,
      financement: (l['financement'] as string) || undefined,
      statut: (l['statut'] as string) || 'PREVU',
      idSituation: (l['idSituation'] as number) ?? undefined,
      idNature: (l['idNature'] as number) ?? undefined,
      idMode: (l['idMode'] as number) ?? undefined,
      processus: ((l['processus'] as Record<string, unknown>[]) ?? []).map((p) => ({
        idCapm: p['idCapm'] as number,
        dateDebut: p['dateDebut'] as string,
        dateFin: p['dateFin'] as string,
      })),
    }));
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
    this.formError.set(null);
    this.submitting.set(true);
    const v = this.dossierForm.getRawValue();
    this.createdPpmId.set(null);
    this.saisie
      .dossier({
        idTypeDossier: v.idTypeDossier as string,
        idEntiteContract: v.idEntiteContract as number,
      })
      .subscribe({
        next: (d) => this.entrerBrouillon(d),
        error: (e: ApiError) => this.echec(e),
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
      idSituation: m.idSituation ?? null,
      idNature: m.idNature ?? null,
      idMode: m.idMode ?? null,
    });
    this.ligneOuverte.set(true);
  }
  annulerLigne(): void {
    this.ligneOuverte.set(false);
  }

  /** Aperçu du mode (phase reprise) ; la PRMP choisit, le backend valide. */
  private determinerMode(): void {
    const idMode = this.marcheForm.controls.idMode;
    if (!this.ligneOuverte()) {
      this.modeSuggestion.set({ state: 'idle', modes: [], recommande: null });
      return;
    }
    const v = this.marcheForm.getRawValue();
    const idLocalite = this.dossier()?.idLocalite ?? this.auth.localite();
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
        }, // 400/404 (aucune règle) gérés sans toast (skipErrorToast)
      });
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
      idSituation: v.idSituation ?? undefined,
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
