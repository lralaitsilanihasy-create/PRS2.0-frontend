import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, concatMap, forkJoin, from, map, of, toArray } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { ToastService } from '../../core/notifications/toast.service';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { Controleur, Dispatch, Dossier, Reception } from '../../models';
import {
  ControleurService,
  DispatchService,
  DossierService,
  EntiteContractService,
  LocaliteService,
  ProfileService,
  ReceptionService,
  ReferenceLookupService,
} from '../../services';

interface Option {
  id: string;
  label: string;
}

/** Un dossier à dispatcher et sa réception dispatchable (complète, non dispatchée). */
export interface DispatchItem {
  dossier: Dossier;
  reception: Reception;
}

/**
 * Formulaire de dispatch affiné (modal), unitaire ou **en lot** (`items` — mêmes CC/Membre/date/
 * instructions pour tous ; le parent garantit une sélection mono-localité). PK auto (max+1 lue une
 * fois puis incrémentée, POST séquentiels — pas de collision), dispatcheur = utilisateur connecté
 * (posé front), interimDispatch=false (Président/CC titulaire). CC et Membre = listes déroulantes
 * des contrôleurs de la localité des dossiers (rôle via profils). Échec partiel : la série continue
 * (erreurs toastées par l'intercepteur), bilan final + recharge dès qu'un dispatch a réussi.
 */
@Component({
  selector: 'app-dispatch-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, ReactiveFormsModule],
  template: `
    <div class="modal-backdrop" [class.closing]="closingDispatch()">
      <form
        class="modal cnm-form"
        [formGroup]="form"
        (ngSubmit)="enregistrer()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="titre()"
        appModale
        (appModaleFermer)="fermerDispatchAnime()"
        novalidate
      >
        <header class="modal-header-centered">
          <div class="modal-title-centered">{{ titre() }}</div>
          @if (sousTitre()) {
            <div class="df__contexte">{{ sousTitre() }}</div>
          }
        </header>
        <div class="modal-body">
          @if (items().length > 1) {
            <div class="df__lot">
              @for (it of items(); track it.dossier.idDossier) {
                <span class="df__lot-ref">{{ it.dossier.refeDossier || '#' + it.dossier.idDossier }}</span>
              }
            </div>
            <p class="df__lot-hint">Le même dispatch (CC, Membre, date, instructions) sera appliqué à chaque dossier.</p>
          }
          @if (!sansAssociationCc()) {
            <label class="form-group">
              <span class="form-label">Chef de commission</span>
              <select class="form-control" formControlName="imCtrlCc">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (o of ccOptions(); track o.id) { <option [ngValue]="o.id">{{ o.label }}</option> }
              </select>
              @if (ccOptions().length) {
                <span class="form-hint">Associé automatiquement : le CC reçoit copie du dispatch et suit le circuit du dossier.</span>
              } @else {
                <span class="form-hint">Aucun CC pour cette localité.</span>
              }
            </label>
          } @else {
            <!-- ⚠️ Règle 2026-08-15 : la copie CC ne vaut que quand le PRÉSIDENT dispatche À UN MEMBRE.
                 Dispatcheur CC, ou attributaire = soi-même → aucune association (imCtrlCc non envoyé,
                 normalisé null par le backend de toute façon). -->
            <p class="form-hint df__sans-cc">
              Pas d'association « Chef de commission » pour ce dispatch — la copie CC ne vaut que pour un
              dispatch du Président à un Membre.
            </p>
          }
          <label class="form-group">
            <span class="form-label required">Membre assigné</span>
            <select class="form-control" formControlName="imCtrlMembre">
              <option [ngValue]="null">— Sélectionner —</option>
              @for (o of membreOptions(); track o.id) {
                <option [ngValue]="o.id">{{ o.label }}{{ chargeLabel(o.id) }}</option>
              }
            </select>
            @if (req('imCtrlMembre')) { <span class="form-error">Obligatoire.</span> }
            @if (membreOptions().length) {
              <span class="form-hint">« n en cours » = dossiers dispatchés à ce membre, pas encore examinés — pour équilibrer la charge.</span>
            } @else {
              <span class="form-hint">Aucun membre pour cette localité.</span>
            }
          </label>
          <div class="df__deux-cols">
            <label class="form-group">
              <span class="form-label">Date de dispatch</span>
              <input class="form-control" type="date" formControlName="dateDispatch" />
              <span class="form-hint">Aujourd'hui par défaut.</span>
            </label>
          </div>
          <label class="form-group">
            <span class="form-label">Instructions</span>
            <textarea
              class="form-control"
              rows="3"
              formControlName="instructions"
              placeholder="Consignes pour le Membre (facultatif) — points d'attention, priorité, pièces à regarder de près…"
            ></textarea>
          </label>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn btn-outline" [disabled]="submitting()" (click)="fermerDispatchAnime()">Annuler</button>
          <button type="submit" class="btn btn-primary" [disabled]="submitting()">
            @if (submitting()) {
              Dispatch en cours…
            } @else {
              {{ items().length > 1 ? '📤 Dispatcher les ' + items().length + ' dossiers' : '📤 Dispatcher' }}
            }
          </button>
        </footer>
      </form>
    </div>
  `,
  styles: `
    .modal { max-width: 30rem; }
    .modal-header-centered {
      padding: 28px 24px 18px;
      border-bottom: 0.5px solid var(--n-200);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .modal-title-centered {
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--n-800);
      letter-spacing: -.015em;
      text-align: center;
    }
    .df__contexte { margin-top: 0.35rem; text-align: center; color: var(--n-500); font-size: var(--text-sm); }
    .df__deux-cols { display: grid; grid-template-columns: minmax(0, 14rem); }
    .df__lot { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .df__lot-ref { padding: 0.18rem 0.6rem; background: var(--p-50); color: var(--p-600); border: 1px solid var(--p-200); border-radius: var(--radius-full); font-size: var(--text-sm); font-weight: 600; }
    .df__lot-hint { margin: 0.5rem 0 0.75rem; color: var(--n-500); font-size: var(--text-sm); }
  `,
})
export class DispatchForm {
  /** Dossiers à dispatcher (1 = unitaire, plusieurs = lot mono-localité). */
  readonly items = input.required<DispatchItem[]>();
  readonly saved = output<void>();
  readonly closed = output<void>();
  /** Animation de sortie du modal (voir `fermerAvecAnimation`). */
  readonly closingDispatch = signal(false);
  /** Ferme le formulaire en jouant l'animation de sortie (Échap, bouton Annuler). */
  fermerDispatchAnime(): void {
    fermerAvecAnimation(this.closingDispatch, () => this.closed.emit());
  }

  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly dispatchService = inject(DispatchService);
  private readonly controleurService = inject(ControleurService);
  private readonly profileService = inject(ProfileService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly submitting = signal(false);
  private readonly controleurs = signal<Controleur[]>([]);
  private readonly profileLib = signal<Map<number, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  /** imCtrlMembre → nb de dossiers DISPATCHE (assignés, pas encore examinés) — équilibre de charge. */
  private readonly chargeMembres = signal<Map<string, number>>(new Map());

  readonly titre = computed(() => {
    const its = this.items();
    if (its.length > 1) return `Dispatcher ${its.length} dossiers`;
    const d = its[0]?.dossier;
    return d ? `Dispatcher — ${d.refeDossier || 'Dossier #' + d.idDossier}` : 'Dispatcher';
  });
  /** Contexte affiché sous le titre : « Entité · Localité » (dossier unitaire) ou la localité du lot. */
  readonly sousTitre = computed(() => {
    const d = this.items()[0]?.dossier;
    if (!d) return '';
    const entite = this.items().length === 1 && d.idEntiteContract != null ? this.entiteMap().get(String(d.idEntiteContract)) : '';
    const localite = d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '';
    return [entite, localite].filter(Boolean).join(' · ');
  });

  readonly form = this.fb.nonNullable.group({
    imCtrlCc: [null as string | null],
    imCtrlMembre: [null as string | null, Validators.required],
    dateDispatch: [new Date().toISOString().slice(0, 10)],
    instructions: [''],
  });

  private optionsParRole(motif: RegExp): Option[] {
    const loc = this.items()[0]?.dossier.idLocalite;
    const libs = this.profileLib();
    return this.controleurs()
      .filter((c) => c.idLocalite === loc && c.idProfile != null && motif.test(libs.get(c.idProfile) ?? ''))
      .map((c) => ({ id: c.imControleur, label: [c.nomCont, c.prenomsCont].filter(Boolean).join(' ') || c.imControleur }));
  }
  readonly ccOptions = computed(() => this.optionsParRole(/chef.*commission/i));
  /**
   * Attributaires possibles : les Membres de la localité + « moi-même » (⤴ AUTO-ATTRIBUTION par
   * délégation ascendante, spec 2026-08-14) quand la paire « profil courant → Membre » est ACTIVE en
   * base — permet le circuit court « je dispatche → je m'attribue → j'examine » sans passer par un
   * Membre (la signature « part Membre » du PV, non déléguable, revient alors à l'attributaire = soi).
   * Paire désactivée → l'option disparaît, zéro code (le CC la perd tant que CC → Membre est inactive).
   */
  readonly membreOptions = computed(() => {
    const options = this.optionsParRole(/membre/i);
    const ref = this.auth.ref();
    if (ref && this.auth.role() !== 'MEMBRE' && this.permissions.peutExecuter('MEMBRE') && !options.some((o) => o.id === ref)) {
      const moi = this.controleurs().find((c) => c.imControleur === ref);
      const nom = moi ? [moi.nomCont, moi.prenomsCont].filter(Boolean).join(' ') : ref;
      options.unshift({ id: ref, label: `${nom} — moi-même ⤴ (délégation du profil Membre)` });
    }
    return options;
  });

  /** Suffixe de charge d'un membre pour l'option (« — 2 en cours » ; rien si 0). */
  chargeLabel(im: string): string {
    const n = this.chargeMembres().get(im) ?? 0;
    return n > 0 ? ` — ${n} en cours` : '';
  }

  /** Miroir réactif de l'attributaire choisi dans le formulaire (pour `sansAssociationCc`). */
  private readonly attributaireChoisi = signal<string | null>(null);
  /**
   * ⚠️ Règle (2026-08-15) : l'association CC ne vaut que quand le PRÉSIDENT dispatche À UN MEMBRE.
   * Dispatcheur CC (il est déjà l'acteur du dispatch) ou attributaire = soi-même (l'association ne
   * désigne jamais l'attributaire) → champ masqué et `imCtrlCc` non envoyé (le backend normalise à
   * null de toute façon — garde miroir).
   */
  readonly sansAssociationCc = computed(() => {
    if (this.auth.role() === 'CHEF_COMMISSION') return true;
    const ref = this.auth.ref();
    return !!ref && this.attributaireChoisi() === ref;
  });

  constructor() {
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    forkJoin({ ctrls: this.controleurService.list(), profiles: this.profileService.list() }).subscribe(
      ({ ctrls, profiles }) => {
        this.controleurs.set(ctrls);
        this.profileLib.set(new Map(profiles.map((p) => [p.idProfile, p.profile ?? ''])));
      },
    );
    // Charge des membres : dossiers DISPATCHE (assignés, pas encore examinés) par membre — jointure
    // dispatch → réception → dossier (dernier dispatch par dossier), comme les listes du circuit.
    forkJoin({
      dispatchs: this.dispatchService.list(),
      receptions: this.receptionService.list(),
      dossiers: this.dossierService.list(),
    }).subscribe(({ dispatchs, receptions, dossiers }) => {
      const recById = new Map(receptions.map((r) => [r.idReception, r]));
      const statutById = new Map(dossiers.map((d) => [d.idDossier, d.statut]));
      const dernierParDossier = new Map<number, Dispatch>();
      for (const disp of dispatchs) {
        const idDossier = recById.get(disp.idReception)?.idDossier;
        if (idDossier == null) continue;
        const prec = dernierParDossier.get(idDossier);
        if (!prec || (disp.dateDispatch ?? '') >= (prec.dateDispatch ?? '')) dernierParDossier.set(idDossier, disp);
      }
      const charge = new Map<string, number>();
      for (const [idDossier, disp] of dernierParDossier) {
        if (statutById.get(idDossier) !== 'DISPATCHE' || !disp.imCtrlMembre) continue;
        charge.set(disp.imCtrlMembre, (charge.get(disp.imCtrlMembre) ?? 0) + 1);
      }
      this.chargeMembres.set(charge);
    });
    this.attributaireChoisi.set(this.form.controls.imCtrlMembre.value);
    this.form.controls.imCtrlMembre.valueChanges.subscribe((v) => this.attributaireChoisi.set(v));
    // Pré-sélection du CC de la localité (résolu côté serveur s'il est omis) pour que le dispatcheur
    // voie qui sera informé — modifiable. Sans objet quand l'association n'a pas lieu (champ masqué).
    effect(() => {
      const opts = this.ccOptions();
      const ctrl = this.form.controls.imCtrlCc;
      if (!this.sansAssociationCc() && opts.length && ctrl.value === null && ctrl.pristine) ctrl.setValue(opts[0].id);
    });
  }

  req(c: string): boolean {
    const ctrl = this.form.get(c);
    return !!ctrl && ctrl.touched && ctrl.hasError('required');
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const v = this.form.getRawValue();
    const commun = {
      imCtrlDispatch: this.auth.ref() ?? undefined,
      // Pas d'association hors « Président → Membre » : imCtrlCc omis (règle 2026-08-15).
      imCtrlCc: this.sansAssociationCc() ? undefined : v.imCtrlCc ?? undefined,
      imCtrlMembre: v.imCtrlMembre ?? undefined,
      dateDispatch: v.dateDispatch || undefined,
      instructions: v.instructions || undefined,
      interimDispatch: false, // Président / CC titulaire
    };
    // Création (action définitive) : idDispatch = PK client (max+1), lue une fois puis incrémentée
    // par dossier ; POST séquentiels (concatMap) pour éviter toute collision d'id en lot.
    this.dispatchService.list().subscribe((all) => {
      let prochainId = (all.length ? Math.max(...all.map((d) => d.idDispatch)) : 0) + 1;
      from(this.items())
        .pipe(
          concatMap((it) => {
            const body: Dispatch = { ...commun, idDispatch: prochainId++, idReception: it.reception.idReception };
            return this.dispatchService.create(body).pipe(
              map(() => null),
              // Échec : la série continue (l'erreur est déjà toastée par l'intercepteur centralisé).
              catchError(() => of(it.dossier.refeDossier || '#' + it.dossier.idDossier)),
            );
          }),
          toArray(),
        )
        .subscribe((resultats) => {
          const echecs = resultats.filter((r): r is string => r !== null);
          const ok = resultats.length - echecs.length;
          this.submitting.set(false);
          if (!echecs.length) this.toast.success(ok > 1 ? `${ok} dossiers dispatchés.` : 'Dossier dispatché.');
          else this.toast.error(`${ok}/${resultats.length} dossier(s) dispatché(s) — échec : ${echecs.join(', ')}.`);
          // Au moins un succès : le parent ferme et recharge. Échec total : modal laissé ouvert pour corriger.
          if (ok > 0) this.saved.emit();
        });
    });
  }
}
