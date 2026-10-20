import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiError, codeErreur } from '../../../core/errors/api-error';
import { ouvrirBlobSur, telechargerBlob } from '../../../core/securite/fichiers-surs';
import { AvisApercu, ChampModelePv, Dossier } from '../../../models';
import { DossierService, ModelePvService } from '../../../services';

const AVIS: readonly { code: AvisApercu | ''; libelle: string }[] = [
  { code: '', libelle: 'l’avis du dernier PV du dossier' },
  { code: 'FAV', libelle: 'favorable' },
  { code: 'FAVR', libelle: 'favorable avec réserves' },
  { code: 'DEF', libelle: 'défavorable' },
  { code: 'NSP', libelle: 'sans objet (NSP)' },
];

/**
 * ⚠️ Générateur de modèles de PV, G1 (20/10, §B4 « aperçu ») — essayer une version, brouillon compris, sur un dossier réel :
 * **rien n'est enregistré**. L'avis peut être forcé pour voir chaque bloc ; les champs saisis se remplissent comme le fera le
 * membre. Sans Word sur le serveur, le PDF répond `CONVERSION_INDISPONIBLE` : l'écran propose le Word.
 */
@Component({
  selector: 'app-apercu-version',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="apv">
      <p class="text-sm text-muted">Rien n’est enregistré au dossier : l’aperçu se télécharge (Word) ou s’ouvre dans un nouvel onglet (PDF).</p>
      <div class="apv__ligne">
        <label class="apv__dossier">
          <span class="form-label">N° interne du dossier</span>
          <input class="form-control" type="number" min="1" [value]="idDossier() ?? ''" (change)="choisirDossier($any($event.target).value)" />
        </label>
        <label>
          <span class="form-label">Avis</span>
          <select class="form-control" [value]="avis()" (change)="avis.set($any($event.target).value)">
            @for (a of avisPossibles; track a.code) { <option [value]="a.code">{{ a.libelle }}</option> }
          </select>
        </label>
      </div>
      @if (dossier(); as d) {
        <p class="apv__dossier-lu" role="status">
          <strong>{{ d.refeDossier || 'Dossier sans référence' }}</strong>
          @if (d.procedure?.designationMarche; as objet) { — {{ objet }} }
          <span class="text-muted"> · {{ d.idSousType }} · {{ d.statut }}</span>
          @if (sousTypesServis().length && d.idSousType && !sousTypesServis().includes(d.idSousType)) {
            <span class="apv__alerte">Ce modèle ne sert pas le sous-type {{ d.idSousType }} : l’essai reste possible.</span>
          }
        </p>
      } @else if (dossierIntrouvable()) {
        <p class="form-error" role="alert">Aucun dossier ne porte ce numéro.</p>
      }

      @if (champs().length) {
        <fieldset class="apv__saisis">
          <legend class="form-label">Champs saisis (comme les remplira le membre)</legend>
          @for (c of champs(); track c.code) {
            <div>
              <span class="form-label">{{ c.libelle }} @if (c.visibleSi) { <span class="text-muted">(si {{ c.visibleSi }})</span> }</span>
              @switch (c.type) {
                @case ('TEXTE_LONG') { <textarea class="form-control" [attr.aria-label]="c.libelle" rows="2" (input)="saisir(c.code, $any($event.target).value)"></textarea> }
                @case ('LISTE') {
                  <select class="form-control" [attr.aria-label]="c.libelle" (change)="saisir(c.code, $any($event.target).value)">
                    <option value="">—</option>
                    @for (o of c.options ?? []; track o) { <option [value]="o">{{ o }}</option> }
                  </select>
                }
                @case ('CASE') {
                  <select class="form-control" [attr.aria-label]="c.libelle" (change)="saisir(c.code, $any($event.target).value)">
                    <option value="">—</option><option value="oui">oui</option><option value="non">non</option>
                  </select>
                }
                @case ('DATE') { <input class="form-control" [attr.aria-label]="c.libelle" type="date" (change)="saisir(c.code, $any($event.target).value)" /> }
                @case ('NOMBRE') { <input class="form-control" [attr.aria-label]="c.libelle" type="number" (input)="saisir(c.code, $any($event.target).value)" /> }
                @default { <input class="form-control" [attr.aria-label]="c.libelle" (input)="saisir(c.code, $any($event.target).value)" /> }
              }
            </div>
          }
        </fieldset>
      }

      <div class="apv__actions">
        <button type="button" class="btn btn-primary btn-sm" [disabled]="!idDossier() || enCours()" (click)="produire('pdf')">
          {{ enCours() === 'pdf' ? 'Production…' : 'Aperçu PDF' }}
        </button>
        <button type="button" class="btn btn-secondary btn-sm" [disabled]="!idDossier() || enCours()" (click)="produire('docx')">
          {{ enCours() === 'docx' ? 'Production…' : 'Aperçu Word' }}
        </button>
      </div>
      @if (message(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
    </div>
  `,
  styles: `
    .apv { display: flex; flex-direction: column; gap: 0.75rem; }
    .apv__ligne { display: grid; grid-template-columns: minmax(10rem, 14rem) minmax(14rem, 22rem); gap: 0.75rem; }
    .apv__dossier-lu { margin: 0; color: var(--n-700); }
    .apv__alerte { display: block; color: var(--warning-text); font-size: 0.85rem; }
    .apv__saisis { border: 1px solid var(--n-200); border-radius: 10px; padding: 0.75rem 0.9rem; margin: 0;
      display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 0.6rem; }
    .apv__actions { display: flex; gap: 0.5rem; }
    @media (max-width: 640px) { .apv__ligne { grid-template-columns: 1fr; } }
  `,
})
export class ApercuVersion {
  private readonly service = inject(ModelePvService);
  private readonly dossiers = inject(DossierService);
  private readonly destroyRef = inject(DestroyRef);

  readonly idModele = input.required<number>();
  readonly numero = input.required<number>();
  readonly champs = input<ChampModelePv[]>([]);
  readonly sousTypesServis = input<string[]>([]);
  readonly codeModele = input('modele');

  readonly avisPossibles = AVIS;
  readonly idDossier = signal<number | null>(null);
  readonly dossier = signal<Dossier | null>(null);
  readonly dossierIntrouvable = signal(false);
  readonly avis = signal<AvisApercu | ''>('');
  readonly saisis = signal<Record<string, string>>({});
  readonly enCours = signal<'pdf' | 'docx' | null>(null);
  readonly message = signal<string | null>(null);

  constructor() {
    // Une autre version choisie : les valeurs saisies pour l'ancienne n'ont plus de sens.
    effect(() => {
      this.numero();
      this.saisis.set({});
      this.message.set(null);
    });
  }

  choisirDossier(valeur: string): void {
    const id = Number(valeur);
    this.dossier.set(null);
    this.dossierIntrouvable.set(false);
    this.message.set(null);
    if (!Number.isInteger(id) || id <= 0) {
      this.idDossier.set(null);
      return;
    }
    this.idDossier.set(id);
    this.dossiers
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => this.dossier.set(d),
        error: () => this.dossierIntrouvable.set(true),
      });
  }

  saisir(code: string, valeur: string): void {
    this.saisis.update((s) => ({ ...s, [code]: valeur }));
  }

  produire(format: 'pdf' | 'docx'): void {
    const dossier = this.idDossier();
    if (!dossier || this.enCours()) return;
    this.enCours.set(format);
    this.message.set(null);
    const saisis = Object.fromEntries(Object.entries(this.saisis()).filter(([, v]) => v !== ''));
    this.service
      .apercu(this.idModele(), this.numero(), { dossier, avis: this.avis() || null, format, saisis })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.enCours.set(null);
          if (format === 'pdf') ouvrirBlobSur(blob);
          else telechargerBlob(blob, `apercu-${this.codeModele()}-v${this.numero()}-dossier-${dossier}.docx`);
        },
        error: (e: ApiError) => {
          this.enCours.set(null);
          const code = codeErreur(e);
          this.message.set(
            code === 'CONVERSION_INDISPONIBLE' ? 'Le serveur ne peut pas produire de PDF (Word absent) : demandez l’aperçu Word.'
            : e.status === 404 ? 'Ce dossier est introuvable.'
            : e.message || 'L’aperçu n’a pas pu être produit.',
          );
        },
      });
  }
}
