import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

import { ChampModelePv, TypeChampSaisi } from '../../../models';
import { LIBELLES_TYPE_CHAMP, MOTIF_CODE_CHAMP, TYPES_CHAMP } from './modeles-pv-libelles';

interface ChampSaisie {
  code: string;
  libelle: string;
  type: TypeChampSaisi;
  /** Les choix d'une liste, un par ligne. */
  options: string;
  obligatoire: boolean;
  aide: string;
  visibleSi: string;
}

const versSaisie = (c: ChampModelePv): ChampSaisie => ({
  code: c.code,
  libelle: c.libelle,
  type: c.type,
  options: (c.options ?? []).join('\n'),
  obligatoire: !!c.obligatoire,
  aide: c.aide ?? '',
  visibleSi: c.visibleSi ?? '',
});

const options = (c: ChampSaisie): string[] => c.options.split('\n').map((x) => x.trim()).filter(Boolean);

/**
 * ⚠️ Générateur de modèles de PV, G1 (20/10, §B1 `ChampSaisi`) — les champs que le membre remplira à l'examen, lus dans le Word
 * par `{{SAISI:code}}`. Un champ peut n'être visible que si une condition déclarée de la version est vraie. Le `PUT` remplace
 * l'ensemble ; la saisie par le membre est le lot G3.
 */
@Component({
  selector: 'app-champs-version',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chv">
      <p class="text-sm text-muted">
        Le membre remplira ces champs dans son écran d’examen, avant de soumettre ; un champ obligatoire vide bloquera la soumission.
        @if (figee()) { Version figée : ses champs se lisent seulement. }
      </p>

      @if (saisies().length) {
        <div class="chv__ligne chv__ligne--tete" aria-hidden="true"><span>Libellé et variable</span><span>Type</span><span>Obligatoire</span><span>Visible si</span><span></span></div>
      }
      @for (c of saisies(); track $index; let i = $index) {
        <div class="chv__ligne">
          <span><strong>{{ c.libelle || 'Nouveau champ' }}</strong><code class="chv__var">{{ o }}SAISI:{{ c.code || '…' }}{{ f }}</code></span>
          <span>{{ libellesType[c.type] }}@if (c.type === 'LISTE') { ({{ nbOptions(c) }} choix) }</span>
          <span>{{ c.obligatoire ? 'Oui' : 'Non' }}</span>
          <span>@if (c.visibleSi) { <code>{{ c.visibleSi }}</code> } @else { toujours }</span>
          @if (!figee()) {
            <button type="button" class="btn btn-secondary btn-sm" [attr.aria-expanded]="ouvert() === i" (click)="ouvert.set(ouvert() === i ? null : i)">
              {{ ouvert() === i ? 'Fermer' : 'Modifier' }}
            </button>
          } @else { <span></span> }
        </div>
        @if (ouvert() === i && !figee()) {
        <div class="chv__champ">
          <label>
            <span class="form-label">Libellé</span>
            <input class="form-control" [value]="c.libelle" [disabled]="figee()" (input)="maj(i, { libelle: $any($event.target).value })" />
          </label>
          <label>
            <span class="form-label">Code</span>
            <input class="form-control chv__mono" [value]="c.code" [disabled]="figee()" (input)="maj(i, { code: $any($event.target).value })"
                   [attr.aria-invalid]="!codeValide(c.code)" />
          </label>
          <label>
            <span class="form-label">Type</span>
            <select class="form-control" [value]="c.type" [disabled]="figee()" (change)="maj(i, { type: $any($event.target).value })">
              @for (t of types; track t) { <option [value]="t" [selected]="t === c.type">{{ libellesType[t] }}</option> }
            </select>
          </label>
          <label>
            <span class="form-label">Visible si</span>
            <select class="form-control" [value]="c.visibleSi" [disabled]="figee()" (change)="maj(i, { visibleSi: $any($event.target).value })">
              <option value="">toujours</option>
              @for (n of conditions(); track n) { <option [value]="n" [selected]="n === c.visibleSi">{{ n }}</option> }
              @if (c.visibleSi && !conditions().includes(c.visibleSi)) { <option [value]="c.visibleSi" selected>{{ c.visibleSi }} (non déclarée)</option> }
            </select>
          </label>
          <label class="chv__case">
            <input type="checkbox" [checked]="c.obligatoire" [disabled]="figee()" (change)="maj(i, { obligatoire: $any($event.target).checked })" /> Obligatoire
          </label>
          @if (!figee()) {
            <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer le champ ' + (c.libelle || c.code || (i + 1))" (click)="retirer(i)">✕</button>
          }
          @if (c.type === 'LISTE') {
            <label class="chv__large">
              <span class="form-label">Choix de la liste (un par ligne)</span>
              <textarea class="form-control" rows="3" [value]="c.options" [disabled]="figee()" (input)="maj(i, { options: $any($event.target).value })"></textarea>
            </label>
          }
          <label class="chv__large">
            <span class="form-label">Aide affichée au membre (facultatif)</span>
            <input class="form-control" [value]="c.aide" [disabled]="figee()" (input)="maj(i, { aide: $any($event.target).value })" />
          </label>
          @if (utilises().length && c.code && !utilises().includes(c.code)) {
            <p class="text-sm chv__alerte chv__large">Le modèle n’utilise pas ce champ : insérez-le dans la page (onglet 1).</p>
          }
        </div>
        }
      } @empty {
        <p class="text-muted">Aucun champ saisi.</p>
      }

      @if (!figee()) {
        <div class="chv__actions">
          <button type="button" class="btn btn-secondary btn-sm" (click)="ajouter()">+ Ajouter un champ</button>
          <span class="chv__espace"></span>
          @if (erreurs(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
          <button type="button" class="btn btn-primary btn-sm" [disabled]="enregistrement() || !!problemeLocal()" (click)="envoyer()">
            {{ enregistrement() ? 'Enregistrement…' : 'Enregistrer les champs' }}
          </button>
        </div>
        @if (problemeLocal(); as p) { <p class="text-sm chv__alerte">{{ p }}</p> }
      }
    </div>
  `,
  styles: `
    .chv { display: flex; flex-direction: column; gap: 0.75rem; }
    .chv__ligne { display: grid; grid-template-columns: 1.6fr 1fr 0.7fr 0.8fr 6rem; gap: 0.6rem; align-items: center; padding: 0.5rem 0;
      border-top: 1px solid var(--n-100); font-size: 0.88rem; color: var(--n-700); }
    .chv__ligne--tete { font-size: 0.75rem; font-weight: 700; color: var(--n-500); border-top: 0; padding-bottom: 0.2rem; }
    .chv__var { display: block; color: var(--n-500); }
    .chv__champ { border: 1px solid var(--n-200); border-radius: 10px; padding: 0.75rem 0.9rem;
      display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr auto auto; gap: 0.6rem; align-items: end; }
    .chv__large { grid-column: 1 / -1; }
    .chv__case { display: flex; gap: 0.35rem; align-items: center; padding-bottom: 0.5rem; color: var(--n-700); white-space: nowrap; }
    .chv__mono, code { font-family: Consolas, monospace; font-size: 0.85em; }
    .chv__alerte { margin: 0; color: var(--warning-text); }
    .chv__actions { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .chv__espace { flex: 1; }
    @media (max-width: 900px) { .chv__champ { grid-template-columns: 1fr 1fr; } .chv__ligne { grid-template-columns: 1fr 1fr; } .chv__ligne--tete { display: none; } }
  `,
})
export class ChampsVersion {
  readonly champs = input.required<ChampModelePv[]>();
  /** Noms des conditions déclarées de la version (pour « visible si »). */
  readonly conditions = input<string[]>([]);
  /** Codes `{{SAISI:…}}` relevés dans le Word (rapport). */
  readonly utilises = input<string[]>([]);
  readonly figee = input(false);
  readonly enregistrement = input(false);
  readonly erreurs = input<string | null>(null);
  readonly enregistrer = output<ChampModelePv[]>();

  readonly o = '{{';
  readonly f = '}}';
  readonly types = TYPES_CHAMP;
  readonly libellesType = LIBELLES_TYPE_CHAMP;
  readonly saisies = signal<ChampSaisie[]>([]);
  /** Le champ dont l'éditeur est déplié (un seul à la fois). */
  readonly ouvert = signal<number | null>(null);

  constructor() {
    effect(() => {
      this.saisies.set(this.champs().map(versSaisie));
      this.ouvert.set(null);
    });
  }

  readonly problemeLocal = computed(() => {
    const l = this.saisies();
    if (l.some((c) => !c.libelle.trim())) return 'Un champ n’a pas de libellé.';
    if (l.some((c) => !this.codeValide(c.code))) return 'Un code est vide ou invalide (lettres, chiffres ou « _ »).';
    if (new Set(l.map((c) => c.code.trim())).size !== l.length) return 'Deux champs portent le même code.';
    if (l.some((c) => c.type === 'LISTE' && !options(c).length)) return 'Une liste de choix n’a aucun choix.';
    return null;
  });

  codeValide(code: string): boolean {
    return MOTIF_CODE_CHAMP.test(code.trim());
  }

  maj(i: number, champ: Partial<ChampSaisie>): void {
    this.saisies.update((l) => l.map((c, k) => (k === i ? { ...c, ...champ } : c)));
  }

  nbOptions(c: ChampSaisie): number {
    return options(c).length;
  }

  ajouter(): void {
    this.saisies.update((l) => [...l, { code: '', libelle: '', type: 'TEXTE', options: '', obligatoire: false, aide: '', visibleSi: '' }]);
    this.ouvert.set(this.saisies().length - 1);
  }

  retirer(i: number): void {
    this.saisies.update((l) => l.filter((_, k) => k !== i));
    this.ouvert.set(null);
  }

  envoyer(): void {
    if (this.problemeLocal()) return;
    this.enregistrer.emit(
      this.saisies().map((c) => ({
        code: c.code.trim(),
        libelle: c.libelle.trim(),
        type: c.type,
        options: c.type === 'LISTE' ? options(c) : [],
        obligatoire: c.obligatoire,
        aide: c.aide.trim() || null,
        visibleSi: c.visibleSi || null,
      })),
    );
  }
}
