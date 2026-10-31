import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';

import { AvisApercu, ChampModelePv, ConditionModelePv } from '../../../models';
import { evaluerCondition } from './modeles-pv-libelles';

const AVIS: readonly { code: AvisApercu; libelle: string }[] = [
  { code: 'FAV', libelle: 'favorable' },
  { code: 'FAVR', libelle: 'favorable avec réserves' },
  { code: 'DEF', libelle: 'défavorable' },
  { code: 'NSP', libelle: 'ne se prononce pas' },
];

/**
 * ⚠️ 21/10 (demande du pilote : « créer le PV en remplissant un formulaire conçu à partir du modèle Word ») — l'aperçu du formulaire
 * tel que le membre le remplira à l'examen (la saisie réelle est le lot G3) : les champs `{{SAISI:…}}` de la version, chacun affiché
 * selon sa condition « visible si », évaluée comme le serveur sur l'avis choisi et les valeurs déjà saisies. Rien n'est enregistré.
 */
@Component({
  selector: 'app-formulaire-apercu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="fap" aria-labelledby="fap-titre">
      <div class="fap__tete">
        <h3 id="fap-titre" class="fap__titre">Le formulaire du membre — aperçu</h3>
        <label class="fap__avis">
          <span>Avis donné :</span>
          <select class="form-control" aria-label="Avis donné par le membre" [value]="avis()" (change)="avis.set($any($event.target).value)">
            @for (a of avisPossibles; track a.code) { <option [value]="a.code" [selected]="a.code === avis()">{{ a.libelle }}</option> }
          </select>
        </label>
      </div>
      <p class="fap__aide">Le membre le remplira dans son écran d’examen, avant de soumettre (lot à venir). Changez l’avis pour voir les champs qui apparaissent.</p>

      @if (!champs().length) {
        <p class="fap__vide">Aucun champ : le PV ne demandera rien au membre, tout viendra du dossier.</p>
      } @else {
        <div class="fap__champs">
          @for (c of visibles(); track c.code) {
            <div class="fap__champ">
              <span class="fap__libelle">{{ c.libelle }}@if (c.obligatoire) { <span class="fap__oblig" aria-hidden="true"> *</span><span class="cnm-sr-only"> (obligatoire)</span> }</span>
              @switch (c.type) {
                @case ('TEXTE_LONG') { <textarea class="form-control" rows="3" [attr.aria-label]="c.libelle" (input)="saisir(c.code, $any($event.target).value)"></textarea> }
                @case ('LISTE') {
                  <select class="form-control" [attr.aria-label]="c.libelle" (change)="saisir(c.code, $any($event.target).value)">
                    <option value="">—</option>
                    @for (o of c.options ?? []; track o) { <option [value]="o">{{ o }}</option> }
                  </select>
                }
                @case ('CASE') {
                  <label class="fap__case"><input type="checkbox" (change)="saisir(c.code, $any($event.target).checked ? 'oui' : '')" /> Oui</label>
                }
                @case ('DATE') { <input class="form-control" type="date" [attr.aria-label]="c.libelle" (change)="saisir(c.code, $any($event.target).value)" /> }
                @case ('NOMBRE') { <input class="form-control" type="number" [attr.aria-label]="c.libelle" (input)="saisir(c.code, $any($event.target).value)" /> }
                @case ('PIECE') { <input class="form-control" type="file" [attr.aria-label]="c.libelle" disabled /> }
                @default { <input class="form-control" [attr.aria-label]="c.libelle" (input)="saisir(c.code, $any($event.target).value)" /> }
              }
              @if (c.aide) { <span class="fap__note">{{ c.aide }}</span> }
            </div>
          }
        </div>
        @if (masques().length) {
          <p class="fap__note">Masqués pour cet avis : {{ masques().join(', ') }}.</p>
        }
        <p class="fap__bilan" role="status">
          @if (manquants().length) { Soumission bloquée : {{ manquants().join(', ') }} {{ manquants().length > 1 ? 'sont obligatoires' : 'est obligatoire' }}. }
          @else { Le formulaire peut être soumis. }
        </p>
      }
    </section>
  `,
  styles: `
    .fap { border: 1px solid var(--n-200); border-radius: 10px; padding: 0.9rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; background: var(--n-50); }
    .fap__tete { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .fap__titre { margin: 0; font-size: 0.78rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--p-700); }
    .fap__avis { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--n-700); }
    .fap__avis select { width: auto; }
    .fap__aide, .fap__note { margin: 0; font-size: 0.8rem; color: var(--n-500); }
    .fap__vide { margin: 0; color: var(--n-500); }
    .fap__champs { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 0.75rem; }
    .fap__champ { display: flex; flex-direction: column; gap: 0.3rem; background: var(--carte-fond); border: 1px solid var(--n-200); border-radius: 8px; padding: 0.6rem 0.7rem; }
    .fap__libelle { font-size: 0.88rem; font-weight: 500; color: var(--n-800); }
    .fap__oblig { color: var(--danger-text); }
    .fap__case { display: inline-flex; gap: 0.4rem; align-items: center; font-size: 0.88rem; }
    .fap__bilan { margin: 0; font-size: 0.85rem; color: var(--n-700); }
  `,
})
export class FormulaireApercu {
  readonly champs = input<ChampModelePv[]>([]);
  readonly conditions = input<ConditionModelePv[]>([]);

  readonly avisPossibles = AVIS;
  readonly avis = signal<AvisApercu>('FAV');
  private readonly valeurs = signal<Record<string, string>>({});

  constructor() {
    // Une autre version : les valeurs saisies n'ont plus cours.
    effect(() => {
      this.champs();
      this.valeurs.set({});
    });
  }

  /** Les valeurs que lisent les conditions : l'avis, et chaque champ saisi sous `saisi.<code>`. */
  private readonly contexte = computed<Record<string, string>>(() => {
    const c: Record<string, string> = { avis: this.avis() };
    for (const [k, v] of Object.entries(this.valeurs())) c[`saisi.${k}`] = v;
    return c;
  });

  private visible(c: ChampModelePv): boolean {
    if (!c.visibleSi) return true;
    const cond = this.conditions().find((x) => x.nom === c.visibleSi);
    // Une condition absente ou illisible ne masque rien : le serveur la signale au contrôle.
    return cond ? evaluerCondition(cond.expression, this.contexte()) !== false : true;
  }

  readonly visibles = computed(() => this.champs().filter((c) => this.visible(c)));
  readonly masques = computed(() => this.champs().filter((c) => !this.visible(c)).map((c) => c.libelle));
  readonly manquants = computed(() => this.visibles().filter((c) => c.obligatoire && !(this.valeurs()[c.code] ?? '').trim()).map((c) => c.libelle));

  saisir(code: string, valeur: string): void {
    this.valeurs.update((v) => ({ ...v, [code]: valeur }));
  }
}
