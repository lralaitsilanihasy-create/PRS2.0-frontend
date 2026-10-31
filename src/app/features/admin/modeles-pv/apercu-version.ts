import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { ApiError, codeErreur } from '../../../core/errors/api-error';
import { ouvrirBlobSur, telechargerBlob, urlBlobSure } from '../../../core/securite/fichiers-surs';
import { AvisApercu, ChampModelePv, Dossier } from '../../../models';
import { DossierService, ModelePvService } from '../../../services';
import { dossiersExemples } from './modeles-pv-libelles';

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
      <div class="apv__barre">
        @if (codeIntegre()) {
          <strong class="apv__invite">Essayer sur un dossier réel :</strong>
        } @else {
          <strong class="apv__invite">Essayer la v{{ numero() }} sur :</strong>
          <button type="button" class="apv__exemple" [class.apv__exemple--on]="surExemple()" [attr.aria-pressed]="surExemple()" [disabled]="!!enCours()"
                  title="Valeurs d’exemple du catalogue ; le PDF porte « EXEMPLE — valeurs fictives »" (click)="prendreExemple()">
            Dossier d’exemple <span>· valeurs fictives</span>
          </button>
          <span class="apv__ou">ou</span>
        }
        @if (surProcedure()) {
          <input class="form-control apv__procedure" type="number" min="1" placeholder="N° de procédure" aria-label="N° de la procédure (fiche DAO)"
                 [value]="procedure()?.idDmc ?? ''" (change)="choisirProcedure($any($event.target).value, lot())" />
          <input class="form-control apv__lot" type="number" min="1" aria-label="N° du lot" title="N° du lot" [value]="lot()"
                 (change)="choisirProcedure(procedure()?.idDmc ?? '', $any($event.target).value)" />
        } @else {
          <input class="form-control apv__dossier" type="number" min="1" placeholder="N° d’un dossier réel" aria-label="N° interne d’un dossier réel"
                 [value]="idDossier() ?? ''" (change)="choisirDossier($any($event.target).value)" />
        }
        @if (avecAvis()) {
          <select class="form-control apv__avis" aria-label="Avis" [value]="avis()" (change)="avis.set($any($event.target).value)">
            @for (a of avisPossibles; track a.code) { <option [value]="a.code" [selected]="a.code === avis()">Avis : {{ a.code === '' && surExemple() ? 'celui de l’exemple' : a.libelle }}</option> }
          </select>
        }
        <button type="button" class="btn btn-primary btn-sm" [disabled]="!pret() || !!enCours()" (click)="produire('pdf')">
          {{ enCours() === 'pdf' ? 'Production…' : 'Produire l’aperçu' }}
        </button>
        @if (avecWord()) {
          <button type="button" class="btn btn-secondary btn-sm" [disabled]="!pret() || !!enCours()" (click)="produire('docx')">
          {{ enCours() === 'docx' ? 'Production…' : 'Word' }}
        </button>
        }
        <button type="button" class="btn btn-secondary btn-sm" [disabled]="!pdf()" (click)="ouvrirPdf()">PDF ↗</button>
      </div>
      <p class="text-sm text-muted apv__rien">Rien n’est enregistré au dossier. @if (avecWord()) { « Word » télécharge le document rempli ; } « PDF ↗ » ouvre l’aperçu dans un nouvel onglet.</p>
      @if (codeIntegre() && exemples().length) {
        <div class="apv__exemples" role="group" aria-label="Dossier proposé">
          <span class="apv__exemples-titre">Dossier proposé :</span>
          @for (e of exemples(); track e.idDossier) {
            <button type="button" class="apv__exemple" [class.apv__exemple--on]="e.idDossier === idDossier()" [disabled]="!!enCours()"
                    [attr.aria-pressed]="e.idDossier === idDossier()" [title]="'Produire l’aperçu sur le dossier ' + e.idDossier"
                    (click)="essayerExemple(e.idDossier)">
              {{ e.refeDossier || 'n° ' + e.idDossier }} <span>· {{ e.idSousType }}</span>
            </button>
          }
        </div>
      } @else if (codeIntegre() && exemplesCharges() && sousTypesServis().length) {
        <p class="text-sm text-muted apv__rien">Aucun dossier examiné des sous-types de ce modèle : saisissez un numéro de dossier.</p>
      }
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

      @if (message(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
      @if (fichierUtilise(); as fu) { <p class="apv__fichier" role="status">Fichier qui a servi : <code>{{ fu }}</code></p> }
      @if (urlPdf(); as u) {
        <iframe class="apv__cadre" [src]="u" [title]="'Aperçu sur le dossier ' + idDossier()"></iframe>
      } @else if (!message()) {
        <div class="apv__vide">L’aperçu PDF s’affichera ici, tel que le PV sera produit.</div>
      }
    </div>
  `,
  styles: `
    .apv { display: flex; flex-direction: column; gap: 0.75rem; }
    .apv__barre { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .apv__invite { color: var(--n-900); }
    .apv__dossier { width: 13rem; }
    .apv__avis { width: auto; max-width: 20rem; }
    .apv__rien { margin: 0; }
    .apv__cadre { width: 100%; height: 75vh; min-height: 32rem; border: 1px solid var(--n-300); border-radius: 8px; background: var(--carte-fond); }
    .apv__vide { border: 1px dashed var(--n-300); border-radius: 8px; padding: 2.5rem 1rem; text-align: center; color: var(--n-500); background: var(--carte-fond); }
    .apv__dossier-lu { margin: 0; color: var(--n-700); }
    .apv__procedure { width: 10rem; }
    .apv__lot { width: 5rem; }
    .apv__ou { font-size: 0.8rem; color: var(--text-muted); }
    .apv__exemples { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
    .apv__exemples-titre { font-size: 0.8rem; font-weight: 500; color: var(--text-muted); }
    .apv__exemple { border: 1px solid var(--border); background: var(--card-bg); color: var(--texte); border-radius: 999px; padding: 0.15rem 0.7rem;
      font: inherit; font-size: 0.8rem; font-weight: 500; cursor: pointer; }
    .apv__exemple span { color: var(--text-muted); font-weight: 400; }
    .apv__exemple:hover:not(:disabled) { background: var(--reco-bg); }
    .apv__exemple--on { background: var(--reco-bg); border-color: var(--primary); }
    .apv__exemple:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .apv__fichier { margin: 0; font-size: 0.85rem; color: var(--n-700); }
    .apv__fichier code { font-family: Consolas, monospace; }
    .apv__alerte { display: block; color: var(--warning-text); font-size: 0.85rem; }
    .apv__saisis { border: 1px solid var(--n-200); border-radius: 10px; padding: 0.75rem 0.9rem; margin: 0;
      display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 0.6rem; }

  `,
})
export class ApercuVersion implements OnInit {
  private readonly service = inject(ModelePvService);
  private readonly dossiers = inject(DossierService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  /** L'URL d'objet du PDF affiché, révoquée au remplacement et à la destruction. */
  private urlCourante: string | null = null;

  /** Une version d'un modèle de l'écran… */
  readonly idModele = input<number | null>(null);
  readonly numero = input<number | null>(null);
  /** … ou un modèle intégré au backend (`code` de `/integres`), dont le serveur choisit le fichier. */
  readonly codeIntegre = input<string | null>(null);
  /** Une page ne se produit qu'en PDF (`FORMAT_INDISPONIBLE` pour le Word). */
  readonly avecWord = input(true);
  /** L'avis ne choisit rien pour une lettre de renvoi. */
  readonly avecAvis = input(true);
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
  readonly pdf = signal<Blob | null>(null);
  readonly urlPdf = signal<SafeResourceUrl | null>(null);
  readonly fichierUtilise = signal<string | null>(null);
  /** ⚠️ 22/10 — un dossier examiné des sous-types servis, proposé et prérempli pour l'aperçu (un seul suffit, demande du pilote). */
  readonly exemples = signal<Dossier[]>([]);
  readonly exemplesCharges = signal(false);
  /**
   * ⚠️ 22/10 (« apercu-exemple », back 140872e) — une version de l'écran s'essaie d'abord sur le dossier d'exemple fictif du serveur
   * (valeurs d'exemple du catalogue, pied « EXEMPLE — valeurs fictives ») ; un modèle intégré, qui ne le connaît pas, sur un dossier réel.
   */
  readonly surExemple = signal(false);
  /** ⚠️ 22/10 (M1) — un projet de marché s'essaie sur une procédure (`idDmc` de la fiche DAO) et un lot, pas sur un dossier. */
  readonly surProcedure = input(false);
  readonly procedure = signal<{ idDmc: number; lot: number } | null>(null);
  readonly lot = signal(1);

  choisirProcedure(idDmc: string | number, lot: string | number): void {
    const id = Number(idDmc);
    const l = Math.max(1, Number(lot) || 1);
    this.lot.set(l);
    this.afficher(null);
    this.message.set(null);
    if (!Number.isInteger(id) || id <= 0) {
      this.procedure.set(null);
      return;
    }
    this.surExemple.set(false);
    this.procedure.set({ idDmc: id, lot: l });
  }
  readonly pret = computed(() => !!this.idDossier() || !!this.procedure() || (this.surExemple() && !this.codeIntegre()));

  ngOnInit(): void {
    if (!this.codeIntegre()) {
      this.prendreExemple();
      return;
    }
    const sousTypes = this.sousTypesServis();
    if (!sousTypes.length) return;
    this.dossiers
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (l) => {
          const e = dossiersExemples(l, sousTypes, 1);
          this.exemples.set(e);
          this.exemplesCharges.set(true);
          if (e.length && this.idDossier() === null) this.choisirDossier(String(e[0].idDossier));
        },
        error: () => this.exemplesCharges.set(true),
      });
  }

  /** Le dossier d'exemple fictif : l'aperçu est produit d'un coup. */
  prendreExemple(): void {
    this.idDossier.set(null);
    this.procedure.set(null);
    this.dossier.set(null);
    this.dossierIntrouvable.set(false);
    this.surExemple.set(true);
    this.produire('pdf');
  }

  /** Un dossier réel proposé : choisi, et son aperçu produit d'un coup. */
  essayerExemple(id: number): void {
    this.choisirDossier(String(id));
    this.produire('pdf');
  }

  constructor() {
    // Une autre version choisie : les valeurs saisies pour l'ancienne n'ont plus de sens.
    effect(() => {
      this.numero();
      this.saisis.set({});
      this.message.set(null);
      this.afficher(null);
    });
    this.destroyRef.onDestroy(() => this.afficher(null));
  }

  /** Affiche un PDF dans le cadre (assaini par `urlBlobSure`), ou vide le cadre. */
  private afficher(blob: Blob | null): void {
    if (this.urlCourante) URL.revokeObjectURL(this.urlCourante);
    this.urlCourante = null;
    this.pdf.set(blob);
    if (!blob) {
      this.urlPdf.set(null);
      return;
    }
    this.urlCourante = urlBlobSure(blob);
    this.urlPdf.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.urlCourante));
  }

  ouvrirPdf(): void {
    const b = this.pdf();
    if (b) ouvrirBlobSur(b);
  }

  choisirDossier(valeur: string): void {
    const id = Number(valeur);
    this.dossier.set(null);
    this.dossierIntrouvable.set(false);
    this.afficher(null);
    this.message.set(null);
    this.fichierUtilise.set(null);
    if (!Number.isInteger(id) || id <= 0) {
      this.idDossier.set(null);
      return;
    }
    this.surExemple.set(false);
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
    const exemple = this.surExemple() && !this.codeIntegre();
    const procedure = this.surProcedure() && !exemple ? this.procedure() : null;
    if ((!dossier && !exemple && !procedure) || this.enCours()) return;
    this.enCours.set(format);
    this.message.set(null);
    this.fichierUtilise.set(null);
    const saisis = Object.fromEntries(Object.entries(this.saisis()).filter(([, v]) => v !== ''));
    const avis = this.avecAvis() ? this.avis() || null : null;
    const code = this.codeIntegre();
    const source = code
      ? this.service.apercuIntegre(code, { dossier: dossier ?? 0, avis, format })
      : this.service.apercu(this.idModele() ?? 0, this.numero() ?? 0, { dossier, procedure, exemple, avis, format, saisis }).pipe(map((blob) => ({ blob, fichier: null as string | null })));
    source
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, fichier }) => {
          this.enCours.set(null);
          this.fichierUtilise.set(fichier);
          if (format === 'pdf') this.afficher(blob);
          else telechargerBlob(blob, `apercu-${this.codeModele()}${code ? '' : '-v' + this.numero()}-${exemple ? 'exemple' : procedure ? 'procedure-' + procedure.idDmc + '-lot-' + procedure.lot : 'dossier-' + dossier}.docx`);
        },
        error: (e: ApiError) => {
          this.enCours.set(null);
          const code = codeErreur(e);
          this.message.set(
            code === 'CONVERSION_INDISPONIBLE' ? 'Le serveur ne peut pas produire de PDF (Word absent) : demandez l’aperçu Word.'
            : code === 'LETTRE_ABSENTE' ? 'Ce dossier n’a pas de lettre de renvoi : essayez un dossier renvoyé.'
            : e.status === 404 ? (procedure ? e.message || 'Cette procédure ou ce lot est introuvable.' : 'Ce dossier est introuvable.')
            : e.message || 'L’aperçu n’a pas pu être produit.',
          );
        },
      });
  }
}
