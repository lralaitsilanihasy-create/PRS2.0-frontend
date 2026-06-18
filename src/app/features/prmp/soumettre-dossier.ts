import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, forkJoin, merge } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Compte, Dossier, Marche, Nature, SaisieMarcheLigne, Situation, TypeDossier } from '../../models';
import {
  CompteService,
  DossierService,
  EntiteContractService,
  LocaliteService,
  MarcheService,
  ModePassationService,
  NatureService,
  PpmService,
  PrmpEntiteService,
  ReferenceLookupService,
  ReglePassationService,
  SaisieService,
  SituationService,
  TypeDossierService,
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
  imports: [ReactiveFormsModule],
  template: `
    <section class="sd">
      <header class="sd__header">
        <span class="cnm-section-label">Domaine PRMP</span>
        <h1 class="sd__title">Saisir & soumettre un dossier</h1>
      </header>

      @switch (phase()) {
        @case ('choix') {
          <div class="cnm-card sd__note">
            « Saisir » crée un dossier en <strong>brouillon</strong> : invisible des contrôleurs
            jusqu'à la soumission. Choisissez ce que vous souhaitez saisir.
          </div>
          <div class="sd__choix">
            <button type="button" class="cnm-card sd__choix-card" (click)="choisirPpm()">
              <span class="sd__choix-titre">PPM</span>
              <span class="sd__choix-desc">Plan de passation + lignes de marché (mode calculé automatiquement).</span>
            </button>
            <button type="button" class="cnm-card sd__choix-card" (click)="choisirDossier()">
              <span class="sd__choix-titre">DAO / MAOO</span>
              <span class="sd__choix-desc">Dossier simple : un type + une localité, sans PPM.</span>
            </button>
          </div>
        }

        @case ('saisiePpm') {
          <form class="cnm-card sd__form cnm-form" [formGroup]="ppmForm" (ngSubmit)="creerPpm()" novalidate>
            <h2 class="sd__sub">En-tête du PPM</h2>
            <div class="cnm-form-grid">
              <label class="cnm-field">
                <span class="cnm-field__label">Entité contractante *</span>
                <select class="cnm-select" formControlName="idEntiteContract">
                  <option [ngValue]="null">— Sélectionner —</option>
                  @for (e of entites(); track e.idEntiteContract) {
                    <option [ngValue]="e.idEntiteContract">{{ e.libelle }}</option>
                  }
                </select>
                @if (req(ppmForm, 'idEntiteContract')) { <span class="cnm-field__hint">Obligatoire.</span> }
                @if (!entites().length) { <span class="cnm-field__hint cnm-muted">Aucune entité rattachée à votre profil PRMP.</span> }
              </label>
              <label class="cnm-field">
                <span class="cnm-field__label">Localité (dérivée de l'entité)</span>
                <input class="cnm-input" type="text" [value]="localiteLabel()" readonly disabled />
                <span class="cnm-field__hint cnm-muted">Le dossier sera déposé dans cette localité.</span>
              </label>
              <label class="cnm-field">
                <span class="cnm-field__label">Exercice *</span>
                <input class="cnm-input" type="number" formControlName="exercice" />
                @if (req(ppmForm, 'exercice')) { <span class="cnm-field__hint">Obligatoire.</span> }
              </label>
              <label class="cnm-field">
                <span class="cnm-field__label">Référence PPM *</span>
                <input class="cnm-input" type="text" formControlName="reference" />
                @if (req(ppmForm, 'reference')) { <span class="cnm-field__hint">Obligatoire.</span> }
                @if (err('reference')) { <span class="cnm-field__hint">{{ err('reference') }}</span> }
              </label>
              <label class="cnm-field">
                <span class="cnm-field__label">Signataire *</span>
                <input class="cnm-input" type="text" formControlName="signataire" />
                @if (req(ppmForm, 'signataire')) { <span class="cnm-field__hint">Obligatoire.</span> }
              </label>
              <label class="cnm-field">
                <span class="cnm-field__label">Date de signature *</span>
                <input class="cnm-input" type="date" formControlName="dateSignature" />
                @if (req(ppmForm, 'dateSignature')) { <span class="cnm-field__hint">Obligatoire.</span> }
              </label>
            </div>

            <div class="sd__lignes-head">
              <h2 class="sd__sub">Marchés</h2>
              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ajouterMarche()">+ Ajouter un marché</button>
            </div>
            @if (!marcheControls().length) {
              <p class="cnm-muted">Aucun marché. Vous pouvez créer le brouillon sans marché et en ajouter plus tard.</p>
            }
            @for (g of marcheControls(); track g.get('uid')!.value) {
              <div class="sd__ligne cnm-form" [formGroup]="g">
                <div class="cnm-form-grid">
                  <label class="cnm-field"><span class="cnm-field__label">Désignation</span>
                    <input class="cnm-input" type="text" formControlName="designationMarche" /></label>
                  <label class="cnm-field"><span class="cnm-field__label">Montant estimé</span>
                    <input class="cnm-input" type="number" formControlName="montEstim" /></label>
                  <label class="cnm-field"><span class="cnm-field__label">Compte</span>
                    <select class="cnm-select" formControlName="numCompte">
                      <option [ngValue]="null">— Sélectionner —</option>
                      @for (c of comptes(); track c.numCompte) { <option [ngValue]="c.numCompte">{{ c.libelle || c.numCompte }}</option> }
                    </select></label>
                  <label class="cnm-field"><span class="cnm-field__label">Situation</span>
                    <select class="cnm-select" formControlName="idSituation">
                      <option [ngValue]="null">— Sélectionner —</option>
                      @for (s of situations(); track s.idSituation) { <option [ngValue]="s.idSituation">{{ s.libelle || '#' + s.idSituation }}</option> }
                    </select></label>
                  <label class="cnm-field"><span class="cnm-field__label">Nature</span>
                    <select class="cnm-select" formControlName="idNature">
                      <option [ngValue]="null">— Sélectionner —</option>
                      @for (n of natures(); track n.idNature) { <option [ngValue]="n.idNature">{{ n.libelle || '#' + n.idNature }}</option> }
                    </select></label>
                  <label class="cnm-field"><span class="cnm-field__label">Financement</span>
                    <input class="cnm-input" type="text" formControlName="financement" /></label>
                  <label class="cnm-field"><span class="cnm-field__label">Statut</span>
                    <input class="cnm-input" type="text" formControlName="statut" /></label>
                  <label class="cnm-field"><span class="cnm-field__label">Mode de passation</span>
                    @switch (modeLigne(g).state) {
                      @case ('loading') { <span class="cnm-field__hint cnm-muted">Détermination…</span> }
                      @case ('ready') {
                        <select class="cnm-select" formControlName="idMode">
                          @for (m of modeLigne(g).modes; track m.idMode) { <option [ngValue]="m.idMode">{{ m.libelle }}</option> }
                        </select>
                      }
                      @case ('none') { <span class="cnm-field__hint cnm-muted">Mode à déterminer (aucune règle).</span> }
                      @default { <span class="cnm-field__hint cnm-muted">Renseignez situation, nature et montant.</span> }
                    }
                  </label>
                </div>
                <div class="sd__ligne-foot">
                  <button type="button" class="cnm-btn cnm-btn--danger cnm-btn--sm" (click)="retirerMarche($index)">Retirer</button>
                </div>
              </div>
            }

            <p class="sd__hint cnm-muted">Les dates prévisionnelles s'ajoutent ensuite, par marché, dans « Mes PPM &amp; marchés ».</p>

            <footer class="sd__foot">
              <button type="button" class="cnm-btn cnm-btn--ghost" (click)="retourChoix()">Retour</button>
              <button type="submit" class="cnm-btn cnm-btn--primary" [disabled]="submitting()">
                {{ submitting() ? 'Création…' : 'Créer le brouillon' }}
              </button>
            </footer>
          </form>
        }

        @case ('saisieDossier') {
          <form class="cnm-card sd__form cnm-form" [formGroup]="dossierForm" (ngSubmit)="creerDossier()" novalidate>
            <div class="cnm-form-grid">
              <label class="cnm-field">
                <span class="cnm-field__label">Type de dossier *</span>
                <select class="cnm-select" formControlName="idTypeDossier">
                  <option [ngValue]="null">— Sélectionner —</option>
                  @for (t of typesNonPpm(); track t.idTypeDossier) {
                    <option [ngValue]="t.idTypeDossier">{{ t.libelleType || t.idTypeDossier }}</option>
                  }
                </select>
                @if (req(dossierForm, 'idTypeDossier')) { <span class="cnm-field__hint">Obligatoire.</span> }
                @if (err('idTypeDossier')) { <span class="cnm-field__hint">{{ err('idTypeDossier') }}</span> }
              </label>
              <label class="cnm-field">
                <span class="cnm-field__label">Entité contractante *</span>
                <select class="cnm-select" formControlName="idEntiteContract">
                  <option [ngValue]="null">— Sélectionner —</option>
                  @for (e of entites(); track e.idEntiteContract) {
                    <option [ngValue]="e.idEntiteContract">{{ e.libelle }}</option>
                  }
                </select>
                @if (req(dossierForm, 'idEntiteContract')) { <span class="cnm-field__hint">Obligatoire.</span> }
                @if (!entites().length) { <span class="cnm-field__hint cnm-muted">Aucune entité rattachée à votre profil PRMP.</span> }
              </label>
              <label class="cnm-field">
                <span class="cnm-field__label">Localité (dérivée de l'entité)</span>
                <input class="cnm-input" type="text" [value]="localiteLabel()" readonly disabled />
                <span class="cnm-field__hint cnm-muted">Le dossier sera déposé dans cette localité.</span>
              </label>
            </div>
            <footer class="sd__foot">
              <button type="button" class="cnm-btn cnm-btn--ghost" (click)="retourChoix()">Retour</button>
              <button type="submit" class="cnm-btn cnm-btn--primary" [disabled]="submitting()">
                {{ submitting() ? 'Création…' : 'Créer le brouillon' }}
              </button>
            </footer>
          </form>
        }

        @case ('brouillon') {
          @if (dossier(); as d) {
            <div class="cnm-card sd__brouillon">
              <div class="sd__brouillon-head">
                <div>
                  <span class="cnm-badge cnm-badge--warning">BROUILLON</span>
                  <span class="sd__brouillon-id">Dossier #{{ d.idDossier }} · {{ d.idTypeDossier || '—' }}</span>
                </div>
                <span class="cnm-muted">Localité : {{ d.idLocalite || '—' }}</span>
              </div>
              <p class="sd__warn cnm-muted">
                Ce brouillon est éditable tant qu'il n'est pas soumis. Vous pourrez le retrouver
                dans « Mes brouillons » pour le reprendre plus tard.
              </p>

              @if (estPpm()) {
                <div class="sd__lignes">
                  <div class="sd__lignes-head">
                    <h2 class="sd__sub">Lignes de marché</h2>
                    <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ouvrirAjout()">
                      + Ajouter une ligne
                    </button>
                  </div>
                  @if (marches().length) {
                    <table class="cnm-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Désignation</th><th class="cnm-num">Montant</th>
                          <th>Mode (auto)</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (m of marches(); track m.idDetail) {
                          <tr>
                            <td class="cnm-mono">{{ m.idDetail }}</td>
                            <td>{{ m.designationMarche || '—' }}</td>
                            <td class="cnm-num">{{ montant(m.montEstim) }}</td>
                            <td>{{ resolve(modeMap(), m.idMode) }}</td>
                            <td class="sd__row-actions">
                              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="editer(m)">Éditer</button>
                              <button type="button" class="cnm-btn cnm-btn--danger cnm-btn--sm" (click)="supprimer(m)">Suppr.</button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  } @else {
                    <p class="cnm-muted">Aucune ligne. Un PPM peut être soumis sans ligne, ou ajoutez-en une.</p>
                  }

                  @if (ligneOuverte()) {
                    <form class="sd__ligne-form cnm-form" [formGroup]="marcheForm" (ngSubmit)="enregistrerLigne()" novalidate>
                      <div class="cnm-form-grid">
                        <label class="cnm-field">
                          <span class="cnm-field__label">Identifiant marché (PK) *</span>
                          <input class="cnm-input" type="number" formControlName="idDetail" [readonly]="editId() !== null" />
                          @if (req(marcheForm, 'idDetail')) { <span class="cnm-field__hint">Obligatoire.</span> }
                          @if (err('idDetail')) { <span class="cnm-field__hint">{{ err('idDetail') }}</span> }
                        </label>
                        <label class="cnm-field">
                          <span class="cnm-field__label">Désignation</span>
                          <input class="cnm-input" type="text" formControlName="designationMarche" />
                        </label>
                        <label class="cnm-field">
                          <span class="cnm-field__label">Montant estimé</span>
                          <input class="cnm-input" type="number" formControlName="montEstim" />
                        </label>
                        <label class="cnm-field">
                          <span class="cnm-field__label">Compte</span>
                          <select class="cnm-select" formControlName="numCompte">
                            <option [ngValue]="null">— Sélectionner —</option>
                            @for (c of comptes(); track c.numCompte) {
                              <option [ngValue]="c.numCompte">{{ c.libelle || c.numCompte }}</option>
                            }
                          </select>
                        </label>
                        <label class="cnm-field">
                          <span class="cnm-field__label">Situation</span>
                          <select class="cnm-select" formControlName="idSituation">
                            <option [ngValue]="null">— Sélectionner —</option>
                            @for (s of situations(); track s.idSituation) {
                              <option [ngValue]="s.idSituation">{{ s.libelle || '#' + s.idSituation }}</option>
                            }
                          </select>
                        </label>
                        <label class="cnm-field">
                          <span class="cnm-field__label">Nature</span>
                          <select class="cnm-select" formControlName="idNature">
                            <option [ngValue]="null">— Sélectionner —</option>
                            @for (n of natures(); track n.idNature) {
                              <option [ngValue]="n.idNature">{{ n.libelle || '#' + n.idNature }}</option>
                            }
                          </select>
                        </label>
                      </div>
                      <div class="cnm-field sd__mode">
                        <span class="cnm-field__label">Mode de passation</span>
                        @switch (modeSuggestion().state) {
                          @case ('loading') { <span class="cnm-muted">Détermination du mode…</span> }
                          @case ('ready') {
                            <select class="cnm-select" formControlName="idMode">
                              @for (m of modeSuggestion().modes; track m.idMode) { <option [ngValue]="m.idMode">{{ m.libelle }}</option> }
                            </select>
                          }
                          @case ('none') { <span class="cnm-field__hint cnm-muted">Mode à déterminer (aucune règle).</span> }
                          @default { <span class="cnm-muted">Complétez situation, nature et montant pour voir le mode.</span> }
                        }
                      </div>
                      <div class="sd__foot">
                        <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annulerLigne()">Annuler</button>
                        <button type="submit" class="cnm-btn cnm-btn--primary" [disabled]="submitting()">
                          {{ editId() !== null ? 'Mettre à jour' : 'Ajouter' }}
                        </button>
                      </div>
                    </form>
                  }
                </div>
              }

              <footer class="sd__foot sd__foot--main">
                @if (ppmSansMarche()) {
                  <span class="cnm-field__hint cnm-muted sd__soumettre-hint">
                    Ajoutez au moins un marché avant de soumettre.
                  </span>
                }
                <button
                  type="button"
                  class="cnm-btn cnm-btn--success"
                  [disabled]="submitting() || ppmSansMarche()"
                  (click)="soumettre()"
                >
                  Soumettre le dossier
                </button>
              </footer>
            </div>
          }
        }
      }
    </section>
  `,
  styles: `
    .sd__header { margin-bottom: var(--cnm-space-4); }
    .sd__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .sd__note, .sd__brouillon { padding: var(--cnm-space-4) var(--cnm-space-5); }
    .sd__note { color: var(--cnm-text-2); margin-bottom: var(--cnm-space-3); }
    .sd__choix { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cnm-space-3); }
    .sd__choix-card { text-align: left; cursor: pointer; border: 1px solid var(--cnm-border); padding: var(--cnm-space-4) var(--cnm-space-5); display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .sd__choix-card:hover { border-color: var(--cnm-brand); }
    .sd__choix-titre { font-size: var(--cnm-fs-md); font-weight: var(--cnm-fw-semibold); color: var(--cnm-text); }
    .sd__choix-desc { color: var(--cnm-text-2); font-size: var(--cnm-fs-sm); }
    .sd__form { padding: var(--cnm-space-4) var(--cnm-space-5); display: flex; flex-direction: column; gap: var(--cnm-space-3); max-width: min(64rem, 96vw); }
    .sd__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cnm-space-3); }
    .sd__hint { margin: 0; }
    .sd__foot { display: flex; justify-content: flex-end; gap: var(--cnm-space-2); border-top: 1px solid var(--cnm-border); padding-top: var(--cnm-space-3); }
    .sd__foot--main { margin-top: var(--cnm-space-3); }
    .sd__soumettre-hint { margin-right: auto; align-self: center; }
    .sd__brouillon-head { display: flex; align-items: center; justify-content: space-between; gap: var(--cnm-space-3); margin-bottom: var(--cnm-space-2); }
    .sd__brouillon-id { margin-left: var(--cnm-space-2); font-weight: var(--cnm-fw-semibold); }
    .sd__warn { margin: 0 0 var(--cnm-space-3); }
    .sd__lignes-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--cnm-space-2); }
    .sd__sub { margin: 0; font-size: var(--cnm-fs-md); }
    .sd__row-actions { display: flex; gap: var(--cnm-space-1); justify-content: flex-end; }
    .sd__ligne-form { margin-top: var(--cnm-space-3); padding: var(--cnm-space-3); background: var(--cnm-surface-2); border: 1px solid var(--cnm-border); border-radius: var(--cnm-radius-sm); display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .sd__mode { display: flex; flex-direction: column; gap: var(--cnm-space-1); }
    .sd__ligne { padding: var(--cnm-space-3); background: var(--cnm-surface-2); border: 1px solid var(--cnm-border); border-radius: var(--cnm-radius-sm); display: flex; flex-direction: column; gap: var(--cnm-space-2); margin-bottom: var(--cnm-space-2); }
    .sd__ligne-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--cnm-space-2); }
    .sd__ligne-mode { display: inline-flex; align-items: center; gap: var(--cnm-space-2); }
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
  private createdPpmId: number | null = null;
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

  readonly ppmForm = this.fb.nonNullable.group({
    idEntiteContract: [null as number | null, Validators.required],
    exercice: [new Date().getFullYear(), Validators.required],
    reference: ['', Validators.required],
    signataire: ['', Validators.required],
    dateSignature: ['', Validators.required],
    marches: this.fb.array([] as FormGroup[]),
  });

  readonly dossierForm = this.fb.nonNullable.group({
    idTypeDossier: [null as string | null, Validators.required],
    idEntiteContract: [null as number | null, Validators.required],
  });

  readonly marcheForm = this.fb.nonNullable.group({
    idDetail: [null as number | null, Validators.required],
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
    this.createdPpmId = null;
    if (d.idTypeDossier === 'PPM') {
      this.ensureMarcheRefs();
      // Le DossierDto ne porte pas l'idPpm : on le résout via le PPM rattaché.
      this.ppmService.list().subscribe((ppms) => {
        this.createdPpmId = ppms.find((p) => p.idDossier === d.idDossier)?.idPpm ?? null;
      });
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
      statut: [''],
      idSituation: [null as number | null],
      idNature: [null as number | null],
      idMode: [null as number | null],
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
    return !!(
      l['designationMarche'] ||
      l['montEstim'] != null ||
      l['numCompte'] ||
      l['financement'] ||
      l['statut'] ||
      l['idSituation'] != null ||
      l['idNature'] != null
    );
  }

  // — Création du brouillon PPM (en-tête + marchés en un seul POST ; PK posées serveur) —
  creerPpm(): void {
    if (this.ppmForm.invalid) {
      this.ppmForm.markAllAsTouched();
      return;
    }
    this.formError.set(null);
    this.submitting.set(true);
    const v = this.ppmForm.getRawValue();
    const marches: SaisieMarcheLigne[] = (v.marches as Record<string, unknown>[])
      .filter((l) => this.ligneNonVide(l))
      .map((l) => ({
        designationMarche: (l['designationMarche'] as string) || undefined,
        montEstim: (l['montEstim'] as number) ?? undefined,
        numCompte: (l['numCompte'] as string) ?? undefined,
        financement: (l['financement'] as string) || undefined,
        statut: (l['statut'] as string) || undefined,
        idSituation: (l['idSituation'] as number) ?? undefined,
        idNature: (l['idNature'] as number) ?? undefined,
        idMode: (l['idMode'] as number) ?? undefined,
      }));
    this.saisie
      .ppm({
        idEntiteContract: v.idEntiteContract as number,
        exercice: v.exercice,
        reference: v.reference,
        signataire: v.signataire,
        dateSignature: v.dateSignature,
        marches,
      })
      .subscribe({
        next: (d) => {
          this.submitting.set(false);
          this.toast.success(`Brouillon créé (dossier #${d.idDossier}).`);
          this.router.navigate(['/prmp/ppm-marches']);
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
    this.createdPpmId = null;
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
  private rechargerMarches(): void {
    const id = this.dossier()?.idDossier;
    if (id == null) return;
    this.marcheService.list().subscribe((rows) => this.marches.set(rows.filter((m) => m.idDossier === id)));
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
      idDetail: m.idDetail,
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
    if (!d || this.createdPpmId == null) return;
    this.formError.set(null);
    this.submitting.set(true);
    const v = this.marcheForm.getRawValue();
    // idMode = choix de la PRMP (facultatif) ; absent → recommandé serveur ; hors ensemble → 409.
    const body: Marche = {
      idDetail: v.idDetail as number,
      idDossier: d.idDossier,
      idPpm: this.createdPpmId,
      designationMarche: v.designationMarche || undefined,
      montEstim: v.montEstim ?? undefined,
      numCompte: v.numCompte ?? undefined,
      idSituation: v.idSituation ?? undefined,
      idNature: v.idNature ?? undefined,
      idMode: v.idMode ?? undefined,
    };
    const op =
      this.editId() !== null
        ? this.marcheService.update(body.idDetail, body)
        : this.marcheService.create(body);
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
        this.router.navigate(['/prmp/soumission']);
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
