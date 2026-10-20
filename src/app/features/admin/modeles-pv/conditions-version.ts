import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

import { CatalogueModelePv, ConditionModelePv } from '../../../models';
import { MOTIF_NOM_CONDITION, OPERATEURS, Operateur, Terme, ecrireExpression, expressionEnClair, lireExpression, sansValeur } from './modeles-pv-libelles';

interface ConditionSaisie {
  nom: string;
  libelle: string;
  /** Termes composés à la souris ; `null` : expression illisible par le compositeur, saisie libre. */
  termes: Terme[] | null;
  libre: string;
}

const versSaisie = (c: ConditionModelePv): ConditionSaisie => ({
  nom: c.nom,
  libelle: c.libelle ?? '',
  termes: lireExpression(c.expression),
  libre: c.expression,
});

const termeVide = (): Terme => ({ lien: 'et', cle: 'avis', op: '=', valeur: '' });

/**
 * ⚠️ Générateur de modèles de PV, G1 (20/10, Q1 : les conditions se déclarent dans l'écran, pas dans le Word) — les conditions
 * d'une version : un nom (celui des blocs `{{SI:NOM}}` du Word) et une expression composée à la souris (clé, opérateur,
 * valeur), écrite dans la grammaire de `ConditionsModele`. Le `PUT` remplace l'ensemble ; une version figée se lit seulement.
 */
@Component({
  selector: 'app-conditions-version',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cv">
      @if (figee()) {
        <p class="text-sm text-muted">Version figée : ses conditions se lisent seulement. Déposez une nouvelle version pour les changer.</p>
      } @else {
        <p class="text-sm text-muted">Le nom est celui qu’on écrit dans Word : <code>{{ o }}SI:NOM{{ f }}</code> … <code>{{ o }}FINSI:NOM{{ f }}</code>. Le passage n’apparaît que si la condition est vraie.</p>
      }

      @for (c of saisies(); track $index; let i = $index) {
        <div class="cv__cond">
          <div class="cv__tete">
            <label class="cv__nom">
              <span class="form-label">Nom</span>
              <input class="form-control cv__mono" [value]="c.nom" [disabled]="figee()" (input)="maj(i, { nom: $any($event.target).value.toUpperCase() })"
                     [attr.aria-invalid]="!nomValide(c.nom)" />
            </label>
            <label class="cv__lib">
              <span class="form-label">Libellé (facultatif)</span>
              <input class="form-control" [value]="c.libelle" [disabled]="figee()" (input)="maj(i, { libelle: $any($event.target).value })" />
            </label>
            @if (!figee()) {
              <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer la condition ' + (c.nom || (i + 1))" (click)="retirer(i)">✕</button>
            }
          </div>
          @if (utilisees().length && c.nom && !utilisees().includes(c.nom)) {
            <p class="text-sm cv__alerte">Aucun bloc <code>{{ o }}SI:{{ c.nom }}{{ f }}</code> dans le Word de cette version.</p>
          }

          @if (c.termes; as termes) {
            @for (t of termes; track $index; let j = $index) {
              <div class="cv__terme">
                @if (j === 0) { <span class="cv__lien">Vraie si</span> }
                @else {
                  <select class="form-control cv__lien" [value]="t.lien" [disabled]="figee()" aria-label="Lien avec le terme précédent"
                          (change)="majTerme(i, j, { lien: $any($event.target).value })">
                    <option value="et">et</option><option value="ou">ou</option>
                  </select>
                }
                <select class="form-control" [value]="t.cle" [disabled]="figee()" aria-label="Critère" (change)="majTerme(i, j, { cle: $any($event.target).value, valeur: '' })">
                  @for (k of cles(); track k.cle) { <option [value]="k.cle">{{ k.libelle }}</option> }
                  @if (!connue(t.cle)) { <option [value]="t.cle">{{ t.cle }}</option> }
                </select>
                <select class="form-control" [value]="t.op" [disabled]="figee()" aria-label="Opérateur" (change)="majTerme(i, j, { op: $any($event.target).value })">
                  @for (o of operateurs; track o.op) { <option [value]="o.op">{{ o.libelle }}</option> }
                </select>
                @if (!sansValeur(t.op)) {
                  @let vals = valeursDe(t.cle);
                  @if (vals.length && t.op !== 'contient') {
                    <select class="form-control" [value]="t.valeur" [disabled]="figee()" aria-label="Valeur" (change)="majTerme(i, j, { valeur: $any($event.target).value })">
                      <option value="">— choisir —</option>
                      @for (v of vals; track v) { <option [value]="v">{{ v }}</option> }
                    </select>
                  } @else {
                    <input class="form-control" [value]="t.valeur" [disabled]="figee()" aria-label="Valeur" (input)="majTerme(i, j, { valeur: $any($event.target).value })" />
                  }
                } @else { <span></span> }
                @if (!figee() && termes.length > 1) {
                  <button type="button" class="btn btn-ghost btn-sm" aria-label="Retirer ce critère" (click)="retirerTerme(i, j)">✕</button>
                }
              </div>
            }
            @if (!figee()) { <button type="button" class="btn btn-ghost btn-sm cv__ajout" (click)="ajouterTerme(i)">+ critère</button> }
            <p class="text-sm cv__clair">{{ enClair(c) || 'Expression incomplète.' }} <code class="cv__expr">{{ expression(c) }}</code></p>
          } @else {
            <label>
              <span class="form-label">Expression (saisie libre — elle ne se compose pas à la souris)</span>
              <input class="form-control cv__mono" [value]="c.libre" [disabled]="figee()" (input)="maj(i, { libre: $any($event.target).value })" />
            </label>
          }
        </div>
      } @empty {
        <p class="text-muted">Aucune condition déclarée.</p>
      }

      @if (!figee()) {
        <div class="cv__actions">
          <button type="button" class="btn btn-secondary btn-sm" (click)="ajouter()">+ Ajouter une condition</button>
          <span class="cv__espace"></span>
          @if (erreurs(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
          <button type="button" class="btn btn-primary btn-sm" [disabled]="enregistrement() || !!problemeLocal()" (click)="envoyer()">
            {{ enregistrement() ? 'Enregistrement…' : 'Enregistrer les conditions' }}
          </button>
        </div>
        @if (problemeLocal(); as p) { <p class="text-sm cv__alerte">{{ p }}</p> }
      }
    </div>
  `,
  styles: `
    .cv { display: flex; flex-direction: column; gap: 0.75rem; }
    .cv__cond { border: 1px solid var(--n-200); border-radius: 10px; padding: 0.75rem 0.9rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .cv__tete { display: grid; grid-template-columns: minmax(10rem, 14rem) 1fr auto; gap: 0.6rem; align-items: end; }
    .cv__terme { display: grid; grid-template-columns: 5.5rem minmax(10rem, 1.2fr) minmax(8rem, 0.8fr) minmax(8rem, 1fr) 2rem; gap: 0.5rem; align-items: center; }
    .cv__lien { font-size: 0.85rem; color: var(--n-500); }
    .cv__ajout { align-self: flex-start; }
    .cv__clair { margin: 0; color: var(--n-700); }
    .cv__expr { display: block; color: var(--n-500); }
    .cv__mono, code { font-family: Consolas, monospace; font-size: 0.85em; }
    .cv__alerte { margin: 0; color: var(--warning-text); }
    .cv__actions { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .cv__espace { flex: 1; }
    @media (max-width: 760px) { .cv__terme, .cv__tete { grid-template-columns: 1fr; } }
  `,
})
export class ConditionsVersion {
  readonly conditions = input.required<ConditionModelePv[]>();
  readonly catalogue = input<CatalogueModelePv | null>(null);
  /** Codes des champs saisis de la version : chacun ouvre la clé `saisi.<code>`. */
  readonly champs = input<string[]>([]);
  /** Noms des blocs `{{SI:…}}` relevés dans le Word (rapport). */
  readonly utilisees = input<string[]>([]);
  readonly figee = input(false);
  readonly enregistrement = input(false);
  readonly erreurs = input<string | null>(null);
  readonly enregistrer = output<ConditionModelePv[]>();

  readonly o = '{{';
  readonly f = '}}';
  readonly operateurs = OPERATEURS;
  readonly sansValeur = sansValeur;
  readonly saisies = signal<ConditionSaisie[]>([]);

  constructor() {
    effect(() => this.saisies.set(this.conditions().map(versSaisie)));
  }

  readonly cles = computed(() => [
    ...(this.catalogue()?.cles ?? []),
    ...this.champs().map((c) => ({ cle: `saisi.${c}`, libelle: `Champ saisi « ${c} »`, valeurs: null as string[] | null })),
  ]);
  private readonly libellesCles = computed(() => Object.fromEntries(this.cles().map((k) => [k.cle, k.libelle])));

  readonly problemeLocal = computed(() => {
    const noms = this.saisies().map((c) => c.nom.trim());
    if (noms.some((n) => !this.nomValide(n))) return 'Un nom est vide ou invalide (lettres, chiffres, « _ » ou « - »).';
    if (new Set(noms).size !== noms.length) return 'Deux conditions portent le même nom.';
    if (this.saisies().some((c) => !this.expression(c))) return 'Une condition n’a pas d’expression complète.';
    return null;
  });

  nomValide(n: string): boolean {
    return MOTIF_NOM_CONDITION.test(n.trim());
  }

  connue(cle: string): boolean {
    return this.cles().some((k) => k.cle === cle);
  }

  valeursDe(cle: string): string[] {
    return this.cles().find((k) => k.cle === cle)?.valeurs ?? [];
  }

  expression(c: ConditionSaisie): string {
    return c.termes ? ecrireExpression(c.termes) : c.libre.trim();
  }

  enClair(c: ConditionSaisie): string {
    const e = this.expression(c);
    return e ? expressionEnClair(e, this.libellesCles()) : '';
  }

  maj(i: number, champ: Partial<ConditionSaisie>): void {
    this.saisies.update((l) => l.map((c, k) => (k === i ? { ...c, ...champ } : c)));
  }

  majTerme(i: number, j: number, champ: Partial<Terme>): void {
    this.saisies.update((l) =>
      l.map((c, k) => (k === i && c.termes ? { ...c, termes: c.termes.map((t, m) => (m === j ? { ...t, ...champ, op: (champ.op ?? t.op) as Operateur } : t)) } : c)),
    );
  }

  ajouter(): void {
    this.saisies.update((l) => [...l, { nom: '', libelle: '', termes: [termeVide()], libre: '' }]);
  }

  retirer(i: number): void {
    this.saisies.update((l) => l.filter((_, k) => k !== i));
  }

  ajouterTerme(i: number): void {
    this.saisies.update((l) => l.map((c, k) => (k === i && c.termes ? { ...c, termes: [...c.termes, termeVide()] } : c)));
  }

  retirerTerme(i: number, j: number): void {
    this.saisies.update((l) => l.map((c, k) => (k === i && c.termes ? { ...c, termes: c.termes.filter((_, m) => m !== j) } : c)));
  }

  envoyer(): void {
    if (this.problemeLocal()) return;
    this.enregistrer.emit(this.saisies().map((c) => ({ nom: c.nom.trim(), expression: this.expression(c), libelle: c.libelle.trim() || null })));
  }
}
