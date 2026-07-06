import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { CreerUgpmRequest, ModifierUgpmRequest, Prmp, Ugpm } from '../../models';
import { PrmpService, UgpmService } from '../../services';

/**
 * Administration des UGPM (`/api/ugpms`, ADMINISTRATEUR) : création (POST, avec compte login/mot de
 * passe), **modification** (PUT — champs métier, ni l'id ni le compte) et **suppression** (DELETE —
 * supprime l'UGPM et son compte). La **PRMP de tutelle** est choisie dans `/api/prmps`.
 * L'identifiant d'une UGPM est son **matricule** (`idUgpm`), non modifiable.
 */
@Component({
  selector: 'app-ugpm-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <section class="ua cnm-card">
      <header class="ua__head">
        <h1 class="ua__title">{{ editId() ? 'Modifier l\\'UGPM ' + editId() : 'Créer une UGPM' }}</h1>
        <p class="cnm-muted">
          Une UGPM saisit et corrige les dossiers sous le périmètre de sa PRMP de tutelle ; seule la PRMP
          peut soumettre.
        </p>
      </header>

      <form class="ua__form cnm-form" [formGroup]="form" (ngSubmit)="enregistrer()" novalidate>
        <div class="cnm-form-grid">
          <label class="form-group">
            <span class="form-label">Matricule (identifiant) *</span>
            <input class="form-control" type="text" formControlName="idUgpm" placeholder="matricule UGPM" [readonly]="editId() !== null" />
            @if (editId()) { <span class="form-hint">Non modifiable (identifiant).</span> }
            @if (invalide('idUgpm')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Libellé</span>
            <input class="form-control" type="text" formControlName="libelle" placeholder="(optionnel)" />
          </label>
          <label class="form-group">
            <span class="form-label">PRMP de tutelle *</span>
            <select class="form-control" formControlName="idPrmpTutelle">
              <option value="" disabled>— Sélectionner —</option>
              @for (p of prmps(); track p.idPrmp) {
                <option [value]="p.idPrmp">{{ prmpLabel(p) }}</option>
              }
            </select>
            @if (invalide('idPrmpTutelle')) { <span class="form-error">Obligatoire.</span> }
            @if (!prmps().length) { <span class="form-hint">Aucune PRMP disponible — créez d'abord une PRMP.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Nom *</span>
            <input class="form-control" type="text" formControlName="nomUgpm" />
            @if (invalide('nomUgpm')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Prénoms *</span>
            <input class="form-control" type="text" formControlName="prenomsUgpm" />
            @if (invalide('prenomsUgpm')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">CIN *</span>
            <input class="form-control" type="text" formControlName="cin" />
            @if (invalide('cin')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Date CIN *</span>
            <input class="form-control" type="date" formControlName="dateCin" />
            @if (invalide('dateCin')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Lieu CIN *</span>
            <input class="form-control" type="text" formControlName="lieuCin" />
            @if (invalide('lieuCin')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Email *</span>
            <input class="form-control" type="email" formControlName="emailUgpm" autocomplete="off" />
            @if (invalide('emailUgpm')) { <span class="form-error">Email valide obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Téléphone *</span>
            <input class="form-control" type="text" formControlName="telUgpm" />
            @if (invalide('telUgpm')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <!-- Compte : uniquement à la création (le PUT ne touche pas au compte). -->
          @if (!editId()) {
            <label class="form-group">
              <span class="form-label">Login *</span>
              <input class="form-control" type="text" formControlName="login" autocomplete="off" />
              @if (invalide('login')) { <span class="form-error">Obligatoire.</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Mot de passe *</span>
              <input class="form-control" type="password" formControlName="motDePasse" autocomplete="new-password" />
              @if (invalide('motDePasse')) { <span class="form-error">8 caractères minimum.</span> }
            </label>
          }
        </div>
        <footer class="ua__foot">
          @if (editId()) {
            <button type="button" class="btn btn-outline" (click)="nouveau()">Annuler</button>
          }
          <button type="submit" class="btn btn-primary" [disabled]="submitting()">
            {{ submitting() ? 'Enregistrement…' : editId() ? 'Enregistrer les modifications' : 'Créer l\\'UGPM' }}
          </button>
        </footer>
      </form>

      <h2 class="ua__sub">UGPM existantes ({{ ugpms().length }})</h2>
      @if (ugpms().length) {
        <table class="cnm-table">
          <thead><tr><th>Matricule</th><th>Responsable</th><th>Libellé</th><th>PRMP de tutelle</th><th>Actions</th></tr></thead>
          <tbody>
            @for (u of ugpms(); track u.idUgpm) {
              <tr>
                <td>{{ u.idUgpm }}</td>
                <td>{{ u.nomUgpm }} {{ u.prenomsUgpm }}</td>
                <td>{{ u.libelle || '—' }}</td>
                <td>{{ tutelleLabel(u.idPrmpTutelle) }}</td>
                <td>
                  <div class="ua__row-actions">
                    <button type="button" class="btn btn-outline btn-sm" (click)="modifier(u)">Modifier</button>
                    <button type="button" class="btn btn-danger btn-sm" (click)="demanderSuppression(u)">Supprimer</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="cnm-muted">Aucune UGPM enregistrée.</p>
      }
    </section>

    @if (confirmDelete(); as u) {
      <div class="modal-backdrop" (click)="annulerSuppression()">
        <div class="modal confirm-modal cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="modal-header-plain"><span class="modal-title">Supprimer l'UGPM</span></div>
          <div class="modal-body">
            Supprimer l'UGPM <strong>{{ u.idUgpm }}</strong> ({{ u.nomUgpm }} {{ u.prenomsUgpm }}) et son compte de connexion ?
            Cette action est irréversible.
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="annulerSuppression()">Annuler</button>
            <button type="button" class="btn btn-danger" [disabled]="submitting()" (click)="confirmerSuppression()">Supprimer</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .ua { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; max-width: min(64rem, 96vw); }
    .ua__head { display: flex; flex-direction: column; gap: 0.35rem; }
    .ua__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .ua__form { display: flex; flex-direction: column; gap: 1rem; }
    .ua__foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .ua__sub { margin: 0.5rem 0 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .ua__row-actions { display: flex; gap: 0.4rem; }
  `,
})
export class UgpmAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly ugpmService = inject(UgpmService);
  private readonly prmpService = inject(PrmpService);
  private readonly toast = inject(ToastService);

  readonly prmps = signal<Prmp[]>([]);
  readonly ugpms = signal<Ugpm[]>([]);
  readonly submitting = signal(false);
  /** UGPM en cours d'édition (matricule) ; null = mode création. */
  readonly editId = signal<string | null>(null);
  /** UGPM dont la suppression est en attente de confirmation. */
  readonly confirmDelete = signal<Ugpm | null>(null);
  private readonly prmpMap = computed(() => new Map(this.prmps().map((p) => [p.idPrmp, this.prmpLabel(p)])));

  readonly form = this.fb.nonNullable.group({
    idUgpm: ['', Validators.required],
    libelle: [''],
    idPrmpTutelle: ['', Validators.required],
    nomUgpm: ['', Validators.required],
    prenomsUgpm: ['', Validators.required],
    cin: ['', Validators.required],
    dateCin: ['', Validators.required],
    lieuCin: ['', Validators.required],
    emailUgpm: ['', [Validators.required, Validators.email]],
    telUgpm: ['', Validators.required],
    login: ['', Validators.required],
    motDePasse: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.prmpService.list().subscribe((r) => this.prmps.set(r));
    this.charger();
  }
  private charger(): void {
    this.ugpmService.list().subscribe((r) => this.ugpms.set(r));
  }

  invalide(champ: string): boolean {
    const c = this.form.get(champ)!;
    return c.invalid && (c.touched || c.dirty);
  }
  prmpLabel(p: Prmp): string {
    return `${p.prenomsPrmp ?? ''} ${p.nomPrmp ?? ''}`.trim() || p.idPrmp;
  }
  tutelleLabel(idPrmp: string): string {
    return this.prmpMap().get(idPrmp) ?? idPrmp;
  }

  /** Repasse en mode création (formulaire vierge, compte requis). */
  nouveau(): void {
    this.editId.set(null);
    this.form.reset();
    this.form.controls.login.setValidators([Validators.required]);
    this.form.controls.motDePasse.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls.login.updateValueAndValidity();
    this.form.controls.motDePasse.updateValueAndValidity();
  }
  /** Charge une UGPM dans le formulaire pour édition (le compte n'est pas modifiable ici). */
  modifier(u: Ugpm): void {
    this.editId.set(u.idUgpm);
    this.form.reset();
    this.form.patchValue({
      idUgpm: u.idUgpm,
      libelle: u.libelle ?? '',
      idPrmpTutelle: u.idPrmpTutelle,
      nomUgpm: u.nomUgpm,
      prenomsUgpm: u.prenomsUgpm,
      cin: u.cin,
      dateCin: u.dateCin,
      lieuCin: u.lieuCin,
      emailUgpm: u.emailUgpm,
      telUgpm: u.telUgpm,
    });
    // Le compte (login/mot de passe) est hors du PUT → retirer leurs validateurs.
    this.form.controls.login.clearValidators();
    this.form.controls.motDePasse.clearValidators();
    this.form.controls.login.updateValueAndValidity();
    this.form.controls.motDePasse.updateValueAndValidity();
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const id = this.editId();
    this.submitting.set(true);
    if (id) {
      const req: ModifierUgpmRequest = {
        libelle: v.libelle || undefined,
        idPrmpTutelle: v.idPrmpTutelle,
        nomUgpm: v.nomUgpm,
        prenomsUgpm: v.prenomsUgpm,
        cin: v.cin,
        dateCin: v.dateCin,
        lieuCin: v.lieuCin,
        emailUgpm: v.emailUgpm,
        telUgpm: v.telUgpm,
      };
      this.ugpmService.modifier(id, req).subscribe({
        next: () => {
          this.toast.success(`UGPM « ${id} » modifiée.`);
          this.submitting.set(false);
          this.nouveau();
          this.charger();
        },
        error: (_e: ApiError) => this.submitting.set(false),
      });
      return;
    }
    const creation = v as CreerUgpmRequest;
    this.ugpmService.creer(creation).subscribe({
      next: () => {
        this.toast.success(`UGPM « ${creation.idUgpm} » créée.`);
        this.submitting.set(false);
        this.nouveau();
        this.charger();
      },
      error: (_e: ApiError) => this.submitting.set(false), // message via l'intercepteur (409 : id/login pris, tutelle inconnue)
    });
  }

  demanderSuppression(u: Ugpm): void {
    this.confirmDelete.set(u);
  }
  annulerSuppression(): void {
    if (!this.submitting()) {
      this.confirmDelete.set(null);
    }
  }
  confirmerSuppression(): void {
    const u = this.confirmDelete();
    if (!u) {
      return;
    }
    this.submitting.set(true);
    this.ugpmService.delete(u.idUgpm).subscribe({
      next: () => {
        this.toast.success(`UGPM « ${u.idUgpm} » supprimée.`);
        this.submitting.set(false);
        this.confirmDelete.set(null);
        if (this.editId() === u.idUgpm) {
          this.nouveau();
        }
        this.charger();
      },
      error: (_e: ApiError) => {
        this.submitting.set(false);
        this.confirmDelete.set(null);
      },
    });
  }
}
