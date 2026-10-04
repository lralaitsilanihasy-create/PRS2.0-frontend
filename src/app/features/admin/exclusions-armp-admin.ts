import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { ExclusionArmp, ExclusionArmpCorps } from '../../models';
import { ExclusionsArmpService } from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr, messageExclusion } from '../candidat/libelles-candidat';

/** Les champs du corps, dans l'ordre d'affichage du journal. */
const CHAMPS: readonly (keyof ExclusionArmpCorps)[] = ['nif', 'raisonSociale', 'referenceDecision', 'motif', 'dateDebut', 'dateFin'];
const LIBELLES_CHAMPS: Readonly<Record<keyof ExclusionArmpCorps, string>> = {
  nif: 'NIF',
  raisonSociale: 'Raison sociale',
  referenceDecision: 'Décision',
  motif: 'Motif',
  dateDebut: 'Début',
  dateFin: 'Fin',
};

/**
 * Écran Administrateur — le **répertoire des entreprises exclues par l'ARMP** (`/api/exclusions-armp`, soumission en
 * ligne §B5, décision du pilote du 04/10). Une exclusion ne se supprime JAMAIS (le serveur répond 405) : une erreur de
 * saisie se corrige, une levée anticipée avance la date de fin, et chaque changement reste au journal avec ses
 * anciennes et nouvelles valeurs — parce qu'un mauvais NIF bloquerait une entreprise à tort au dépôt. Le rapprochement
 * se fait par le NIF normalisé, sur le répertoire du jour : l'entreprise est signalée à la déclaration, et le système
 * refuse son dépôt (409 `ENTREPRISE_EXCLUE`, lot 3) avec le message composé ici à l'identique.
 */
@Component({
  selector: 'app-exclusions-armp-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModaleDirective, EtatErreur],
  template: `
    <section class="ex">
      <header class="page-header page-header--actions">
        <div>
          <div class="page-subtitle">Nomenclatures · espace candidat</div>
          <h1 class="page-title">Entreprises exclues par l'ARMP</h1>
        </div>
        <button type="button" class="btn btn-primary" (click)="ouvrir(null)">Ajouter une exclusion</button>
      </header>
      <p class="page-role">
        Le répertoire des décisions d'exclusion de l'ARMP, rapproché par le NIF. Une entreprise exclue est signalée dès
        sa déclaration, et le système refuse son dépôt d'offre pendant la période. Rien ne se supprime : on corrige, ou on
        avance la date de fin.
      </p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement du répertoire…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Le répertoire n'a pas pu être chargé." (reessayer)="charger()" />
      } @else if (!exclusions().length) {
        <div class="empty-state">
          <p class="empty-state-title">Aucune exclusion répertoriée.</p>
          <p class="empty-state-text">Ajoutez chaque décision de l'ARMP avec sa référence et ses dates.</p>
        </div>
      } @else {
        <div class="table-card">
          <table class="ex__table">
            <caption class="cnm-sr-only">Exclusions répertoriées</caption>
            <thead>
              <tr><th scope="col">NIF</th><th scope="col">Raison sociale</th><th scope="col">Décision de l'ARMP</th><th scope="col">Période</th><th scope="col">État</th><th scope="col"><span class="cnm-sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              @for (x of exclusions(); track x.id) {
                <tr>
                  <td class="cnm-mono">{{ x.nif }}</td>
                  <td>{{ x.raisonSociale }}</td>
                  <td>{{ x.referenceDecision }}<br /><span class="text-xs text-muted">{{ x.motif }}</span></td>
                  <td class="nowrap">du {{ date(x.dateDebut) }}{{ x.dateFin ? ' au ' + date(x.dateFin) : ', sans fin' }}</td>
                  <td><span class="badge" [class.badge-danger]="x.enCours" [class.badge-neutral]="!x.enCours">{{ x.enCours ? 'En cours' : 'Close' }}</span></td>
                  <td class="td-actions">
                    <button type="button" class="btn btn-sm btn-outline" (click)="ouvrir(x)">Modifier</button>
                    <button type="button" class="btn btn-sm btn-outline" [attr.aria-expanded]="journalOuvert() === x.id" (click)="basculerJournal(x.id)">Journal ({{ x.journal.length }})</button>
                  </td>
                </tr>
                @if (journalOuvert() === x.id) {
                  <tr class="ex__journal">
                    <td colspan="6">
                      <p class="text-sm"><strong>Message servi au candidat :</strong> {{ message(x) }}</p>
                      <ol class="ex__lignes">
                        @for (l of x.journal; track $index) {
                          <li>
                            <span class="nowrap">{{ dateHeure(l.date) }}</span> · {{ l.acteur }} ·
                            @if (!l.anciennes) { création }
                            @else {
                              @for (c of changements(l.anciennes, l.nouvelles); track c.champ) {
                                <span class="ex__chg">{{ libelles[c.champ] }} : <s>{{ c.avant || '—' }}</s> → {{ c.apres || '—' }}</span>
                              }
                            }
                          </li>
                        }
                      </ol>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }

      @if (ouvert()) {
        <div class="modal-backdrop" [class.closing]="fermeture()">
          <div class="modal cnm-form ex__modal" role="dialog" aria-modal="true" [attr.aria-label]="enCours() ? 'Modifier une exclusion' : 'Ajouter une exclusion'" appModale (appModaleFermer)="fermer()">
            <header class="modal-header">
              <span class="modal-title">{{ enCours() ? 'Modifier une exclusion' : 'Ajouter une exclusion' }}</span>
              <button type="button" class="btn-close" aria-label="Fermer" (click)="fermer()">✕</button>
            </header>
            <form [formGroup]="form" (ngSubmit)="enregistrer()" novalidate>
              <div class="modal-body ex__corps">
                @if (erreurForm(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
                <label class="form-group">
                  <span class="form-label">NIF</span>
                  <input class="form-control" type="text" formControlName="nif" required [class.error]="invalide('nif')" />
                  @if (manque('nif')) { <span class="form-error">Obligatoire.</span> }
                  @if (erreurChamp('nif'); as m) { <span class="form-error">{{ m }}</span> }
                </label>
                <label class="form-group">
                  <span class="form-label">Raison sociale</span>
                  <input class="form-control" type="text" formControlName="raisonSociale" required [class.error]="invalide('raisonSociale')" />
                  @if (manque('raisonSociale')) { <span class="form-error">Obligatoire.</span> }
                  @if (erreurChamp('raisonSociale'); as m) { <span class="form-error">{{ m }}</span> }
                </label>
                <label class="form-group">
                  <span class="form-label">Référence de la décision de l'ARMP</span>
                  <input class="form-control" type="text" formControlName="referenceDecision" required [class.error]="invalide('referenceDecision')" />
                  @if (manque('referenceDecision')) { <span class="form-error">Obligatoire.</span> }
                  @if (erreurChamp('referenceDecision'); as m) { <span class="form-error">{{ m }}</span> }
                </label>
                <label class="form-group">
                  <span class="form-label">Motif</span>
                  <textarea class="form-control" rows="2" formControlName="motif" required [class.error]="invalide('motif')"></textarea>
                  @if (manque('motif')) { <span class="form-error">Obligatoire.</span> }
                  @if (erreurChamp('motif'); as m) { <span class="form-error">{{ m }}</span> }
                </label>
                <div class="ex__dates">
                  <label class="form-group">
                    <span class="form-label">Début</span>
                    <input class="form-control" type="date" formControlName="dateDebut" required [class.error]="invalide('dateDebut')" />
                    @if (manque('dateDebut')) { <span class="form-error">Obligatoire.</span> }
                    @if (erreurChamp('dateDebut'); as m) { <span class="form-error">{{ m }}</span> }
                  </label>
                  <label class="form-group">
                    <span class="form-label">Fin (vide = sans date de fin)</span>
                    <input class="form-control" type="date" formControlName="dateFin" [class.error]="!!erreurChamp('dateFin')" />
                    @if (erreurChamp('dateFin'); as m) { <span class="form-error">{{ m }}</span> }
                  </label>
                </div>
                @if (enCours()) { <p class="text-sm text-muted">Pour lever l'exclusion avant terme, posez une date de fin passée ou d'aujourd'hui. La modification reste au journal.</p> }
              </div>
              <footer class="modal-footer">
                <button type="button" class="btn btn-outline" (click)="fermer()">Annuler</button>
                <button type="submit" class="btn btn-primary" [disabled]="envoi()">{{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}</button>
              </footer>
            </form>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .ex { display: flex; flex-direction: column; gap: 1rem; }
    .ex__table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .ex__table th, .ex__table td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--n-200); vertical-align: top; }
    .ex__table th { color: var(--n-500); font-weight: 600; }
    .ex__journal td { background: var(--n-50); }
    .ex__lignes { margin: 0.25rem 0 0; padding-left: 1.2rem; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 0.2rem; }
    .ex__chg { margin-right: 0.75rem; }
    .ex__modal { max-width: 36rem; }
    .ex__corps { display: flex; flex-direction: column; gap: 0.6rem; }
    .ex__dates { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  `,
})
export class ExclusionsArmpAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ExclusionsArmpService);
  private readonly toast = inject(ToastService);

  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;
  readonly message = messageExclusion;
  readonly libelles = LIBELLES_CHAMPS;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly exclusions = signal<ExclusionArmp[]>([]);
  readonly journalOuvert = signal<number | null>(null);

  readonly ouvert = signal(false);
  readonly fermeture = signal(false);
  /** L'exclusion en cours de modification, `null` pour une création. */
  readonly enCours = signal<ExclusionArmp | null>(null);
  readonly envoi = signal(false);
  readonly erreurForm = signal<string | null>(null);
  readonly erreursChamps = signal<Record<string, string>>({});

  readonly form = this.fb.nonNullable.group({
    nif: ['', Validators.required],
    raisonSociale: ['', Validators.required],
    referenceDecision: ['', Validators.required],
    motif: ['', Validators.required],
    dateDebut: ['', Validators.required],
    dateFin: [''],
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.liste().subscribe({
      next: (l) => {
        this.exclusions.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  basculerJournal(id: number): void {
    this.journalOuvert.update((j) => (j === id ? null : id));
  }

  /** Les champs qui ont changé entre deux états du journal, pour les lire d'un coup d'œil. */
  changements(avant: Partial<ExclusionArmpCorps>, apres: Partial<ExclusionArmpCorps>): { champ: keyof ExclusionArmpCorps; avant: string; apres: string }[] {
    return CHAMPS.filter((c) => (avant[c] ?? null) !== (apres[c] ?? null)).map((c) => ({
      champ: c,
      avant: c.startsWith('date') ? dateFr(avant[c] as string | null) : String(avant[c] ?? ''),
      apres: c.startsWith('date') ? dateFr(apres[c] as string | null) : String(apres[c] ?? ''),
    }));
  }

  ouvrir(x: ExclusionArmp | null): void {
    this.enCours.set(x);
    this.erreurForm.set(null);
    this.erreursChamps.set({});
    this.form.reset({
      nif: x?.nif ?? '',
      raisonSociale: x?.raisonSociale ?? '',
      referenceDecision: x?.referenceDecision ?? '',
      motif: x?.motif ?? '',
      dateDebut: x?.dateDebut ?? '',
      dateFin: x?.dateFin ?? '',
    });
    this.fermeture.set(false);
    this.ouvert.set(true);
  }

  fermer(): void {
    fermerAvecAnimation(this.fermeture, () => this.ouvert.set(false));
  }

  touche(champ: keyof typeof this.form.controls): boolean {
    return this.form.controls[champ].touched;
  }

  manque(champ: keyof typeof this.form.controls): boolean {
    return this.touche(champ) && this.form.controls[champ].hasError('required');
  }

  invalide(champ: keyof typeof this.form.controls): boolean {
    return (this.touche(champ) && this.form.controls[champ].invalid) || !!this.erreursChamps()[champ];
  }

  erreurChamp(champ: string): string | undefined {
    return this.erreursChamps()[champ];
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.envoi.set(true);
    this.erreurForm.set(null);
    this.erreursChamps.set({});
    const v = this.form.getRawValue();
    const corps: ExclusionArmpCorps = {
      nif: v.nif.trim(),
      raisonSociale: v.raisonSociale.trim(),
      referenceDecision: v.referenceDecision.trim(),
      motif: v.motif.trim(),
      dateDebut: v.dateDebut,
      dateFin: v.dateFin || null,
    };
    const existante = this.enCours();
    const appel = existante ? this.service.modifier(existante.id, corps) : this.service.creer(corps);
    appel.subscribe({
      next: (x) => {
        this.envoi.set(false);
        this.exclusions.update((l) => (existante ? l.map((e) => (e.id === x.id ? x : e)) : [x, ...l]));
        this.toast.success(existante ? 'Exclusion modifiée ; le changement est au journal.' : 'Exclusion ajoutée au répertoire.');
        this.fermer();
      },
      error: (e: ApiError) => {
        this.envoi.set(false);
        if (e.status === 400 && e.fieldErrors) this.erreursChamps.set(e.fieldErrors);
        else this.erreurForm.set(e.message || "L'enregistrement n'a pas abouti.");
      },
    });
  }
}
