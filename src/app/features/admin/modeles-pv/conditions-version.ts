import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

import { CatalogueModelePv, ConditionModelePv } from '../../../models';
import { MOTIF_NOM_CONDITION, OPERATEURS, Operateur, Terme, ecrireExpression, lireExpression, sansValeur } from './modeles-pv-libelles';

interface ConditionSaisie {
  nom: string;
  libelle: string;
  /** Termes composés à la souris ; `null` : expression illisible par le compositeur, saisie libre. */
  termes: Terme[] | null;
  libre: string;
}

/** L'état d'une règle, dit par la pastille et le liseré de sa ligne. */
type EtatRegle = 'ok' | 'inutile' | 'incomplete';

const versSaisie = (c: ConditionModelePv): ConditionSaisie => ({
  nom: c.nom,
  libelle: c.libelle ?? '',
  termes: lireExpression(c.expression),
  libre: c.expression,
});

const termeVide = (): Terme => ({ lien: 'et', cle: 'avis', op: '=', valeur: '' });

/** Les valeurs codées du catalogue, dites en clair (le code reste ce qui s'enregistre). */
const VALEURS_LISIBLES: Readonly<Record<string, string>> = {
  FAV: 'favorable',
  FAVR: 'favorable avec réserves',
  DEF: 'défavorable',
  NSP: 'sans avis',
  centrale: 'centrale',
  regionale: 'régionale',
  oui: 'oui',
  non: 'non',
  CONTRAT_CADRE: 'contrat-cadre',
};

/**
 * ⚠️ Générateur de modèles de PV, G1 (20/10, Q1 : les conditions se déclarent dans l'écran) — les règles des passages conditionnels
 * d'une version : un nom (celui du cadre posé dans la page) et une expression composée à la souris (critère, opérateur, valeur), écrite
 * dans la grammaire de `ConditionsModele`. Le `PUT` remplace l'ensemble ; une version figée se lit seulement.
 *
 * ⚠️ 21/10 (refonte, demande du pilote) — une ligne par règle, lue comme une phrase (« Imprimé si l'avis vaut favorable ») avec son
 * état (utilisée dans la page, inutilisée, incomplète) ; on la déplie pour la modifier. Les changements non enregistrés se signalent
 * dans la barre du bas, qui reste visible.
 */
@Component({
  selector: 'app-conditions-version',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cv">
      <div class="cv__entete">
        <p class="cv__intro">
          Un passage encadré dans la page porte le nom d’une règle : il ne s’imprime que si la règle est vraie pour le dossier.
          @if (figee()) { <strong>Version figée : les règles se lisent seulement.</strong> }
        </p>
        @if (saisies().length) {
          <p class="cv__compte">
            <strong>{{ saisies().length }}</strong> règle{{ saisies().length > 1 ? 's' : '' }}
            @if (nbInutiles()) { · <span class="cv__compte-alerte">{{ nbInutiles() }} sans passage dans la page</span> }
          </p>
        }
      </div>

      <ul class="cv__liste">
        @for (c of saisies(); track $index; let i = $index) {
          @let etat = etatDe(c);
          @let ouverte = ouvertes().has(i);
          <li [class]="'cv__regle cv__regle--' + etat" [class.cv__regle--ouverte]="ouverte">
            <div class="cv__ligne">
              <span class="cv__nom-puce" [attr.title]="'Nom de la règle, porté par le cadre dans la page'">{{ c.nom || 'SANS NOM' }}</span>
              <div class="cv__resume">
                @if (c.libelle) { <span class="cv__libelle">{{ c.libelle }}</span> }
                <span class="cv__phrase">{{ phrase(c) }}</span>
              </div>
              <span [class]="'cv__etat cv__etat--' + etat">{{ libellesEtat[etat] }}</span>
              @if (!figee()) {
                <button type="button" class="cv__btn" [attr.aria-expanded]="ouverte" [attr.aria-label]="(ouverte ? 'Replier' : 'Modifier') + ' la règle ' + (c.nom || i + 1)"
                        (click)="basculer(i)">{{ ouverte ? 'Replier' : 'Modifier' }}</button>
                <button type="button" class="cv__btn cv__btn--retirer" [attr.aria-label]="'Retirer la règle ' + (c.nom || i + 1)" (click)="retirer(i)">✕</button>
              }
            </div>

            @if (ouverte && !figee()) {
              <div class="cv__edition">
                <div class="cv__ident">
                  <label class="cv__champ cv__champ--nom">
                    <span>Nom</span>
                    <input class="form-control cv__mono" [value]="c.nom" (input)="maj(i, { nom: $any($event.target).value.toUpperCase() })"
                           [attr.aria-invalid]="!nomValide(c.nom)" placeholder="EX. FAVORABLE" />
                  </label>
                  <label class="cv__champ">
                    <span>Libellé <em>(facultatif)</em></span>
                    <input class="form-control" [value]="c.libelle" (input)="maj(i, { libelle: $any($event.target).value })" placeholder="Ex. Avis favorable" />
                  </label>
                </div>

                @if (c.termes; as termes) {
                  <div class="cv__criteres" role="group" [attr.aria-label]="'Critères de la règle ' + (c.nom || i + 1)">
                    @for (t of termes; track $index; let j = $index) {
                      <div class="cv__terme">
                        @if (j === 0) { <span class="cv__si">Imprimé si</span> }
                        @else {
                          <select class="form-control cv__lien" aria-label="Lien avec le critère précédent" (change)="majTerme(i, j, { lien: $any($event.target).value })">
                            <option value="et" [selected]="t.lien === 'et'">et</option><option value="ou" [selected]="t.lien === 'ou'">ou</option>
                          </select>
                        }
                        <select class="form-control" aria-label="Critère" (change)="majTerme(i, j, { cle: $any($event.target).value, valeur: '' })">
                          @for (k of cles(); track k.cle) { <option [value]="k.cle" [selected]="k.cle === t.cle">{{ k.libelle }}</option> }
                          @if (!connue(t.cle)) { <option [value]="t.cle" selected>{{ t.cle }}</option> }
                        </select>
                        <select class="form-control" aria-label="Opérateur" (change)="majTerme(i, j, { op: $any($event.target).value })">
                          @for (o of operateurs; track o.op) { <option [value]="o.op" [selected]="o.op === t.op">{{ o.libelle }}</option> }
                        </select>
                        @if (!sansValeur(t.op)) {
                          @let vals = valeursDe(t.cle);
                          @if (vals.length && t.op !== 'contient') {
                            <select class="form-control" aria-label="Valeur" [attr.aria-invalid]="!t.valeur" (change)="majTerme(i, j, { valeur: $any($event.target).value })">
                              <option value="" [selected]="!t.valeur">— choisir —</option>
                              @for (v of vals; track v) { <option [value]="v" [selected]="v === t.valeur">{{ lisible(v) }}</option> }
                            </select>
                          } @else {
                            <input class="form-control" [value]="t.valeur" aria-label="Valeur" [attr.aria-invalid]="!t.valeur" (input)="majTerme(i, j, { valeur: $any($event.target).value })" />
                          }
                        } @else { <span></span> }
                        @if (termes.length > 1) {
                          <button type="button" class="cv__btn cv__btn--retirer" aria-label="Retirer ce critère" (click)="retirerTerme(i, j)">✕</button>
                        } @else { <span></span> }
                      </div>
                    }
                    <button type="button" class="cv__ajout-critere" (click)="ajouterTerme(i)">+ Ajouter un critère (et / ou)</button>
                  </div>
                  <p class="cv__code">Écrit pour le générateur : <code>{{ expression(c) || '—' }}</code></p>
                } @else {
                  <label class="cv__champ">
                    <span>Expression (saisie libre — elle ne se compose pas à la souris)</span>
                    <input class="form-control cv__mono" [value]="c.libre" (input)="maj(i, { libre: $any($event.target).value })" />
                  </label>
                }
                @if (probleme(c); as p) { <p class="cv__probleme" [class.cv__probleme--info]="etat === 'inutile'">{{ p }}</p> }
              </div>
            }
          </li>
        } @empty {
          <li class="cv__vide">Aucune règle. Encadrez un passage dans la page, puis déclarez sa règle ici.</li>
        }
      </ul>

      @if (!figee()) {
        <div class="cv__barre" [class.cv__barre--modifiee]="modifiee()">
          <button type="button" class="btn btn-secondary btn-sm" (click)="ajouter()">+ Nouvelle règle</button>
          <span class="cv__espace"></span>
          @if (problemeLocal(); as p) { <span class="cv__barre-alerte">{{ p }}</span> }
          @else if (modifiee()) { <span class="cv__barre-etat">Modifications non enregistrées</span> }
          @if (modifiee()) { <button type="button" class="btn btn-ghost btn-sm" (click)="annuler()">Annuler</button> }
          <button type="button" class="btn btn-primary btn-sm" [disabled]="enregistrement() || !modifiee() || !!problemeLocal()" (click)="envoyer()">
            {{ enregistrement() ? 'Enregistrement…' : 'Enregistrer les règles' }}
          </button>
        </div>
        @if (erreurs(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
      }
    </div>
  `,
  styles: `
    .cv { display: flex; flex-direction: column; gap: 0.75rem; }
    .cv__entete { display: flex; gap: 1rem; align-items: baseline; justify-content: space-between; flex-wrap: wrap; }
    .cv__intro { margin: 0; font-size: 0.85rem; color: var(--text-muted); max-width: 46rem; }
    .cv__compte { margin: 0; font-size: 0.85rem; color: var(--text); }
    .cv__compte-alerte { color: var(--prep-text); font-weight: 500; }

    .cv__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .cv__regle { border: 1px solid var(--border); border-left: 4px solid var(--ok-accent); border-radius: 10px; background: var(--card-bg); }
    .cv__regle--inutile { border-left-color: var(--prep-accent); }
    .cv__regle--incomplete { border-left-color: var(--miss-accent); }
    .cv__regle--ouverte { box-shadow: none; border-color: var(--reco-border); }

    .cv__ligne { display: grid; grid-template-columns: 9.5rem 1fr auto auto auto; gap: 0.75rem; align-items: center; padding: 0.6rem 0.75rem; }
    .cv__nom-puce { font-family: var(--police-texte); font-size: 0.78rem; font-weight: 500; letter-spacing: 0.02em; color: var(--texte);
      background: var(--reco-bg); border: 1px solid var(--reco-border); border-radius: 6px; padding: 0.15rem 0.5rem; white-space: nowrap;
      justify-self: start; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
    .cv__resume { display: flex; flex-direction: column; min-width: 0; }
    .cv__libelle { font-weight: 500; color: var(--text); font-size: 0.9rem; }
    .cv__phrase { color: var(--text); font-size: 0.9rem; }
    .cv__libelle + .cv__phrase { color: var(--text-muted); font-size: 0.82rem; }
    .cv__etat { font-size: 0.75rem; font-weight: 500; border-radius: 999px; padding: 0.1rem 0.6rem; white-space: nowrap; border: 1px solid; }
    .cv__etat--ok { color: var(--ok-text); background: var(--ok-bg); border-color: var(--ok-border); }
    .cv__etat--inutile { color: var(--prep-text); background: var(--prep-bg); border-color: var(--prep-border); }
    .cv__etat--incomplete { color: var(--miss-text); background: var(--miss-bg); border-color: var(--miss-border); }
    .cv__btn { border: 1px solid var(--border); background: var(--card-bg); color: var(--texte); border-radius: 6px; padding: 0.2rem 0.65rem;
      font: inherit; font-size: 0.8rem; font-weight: 500; cursor: pointer; }
    .cv__btn:hover { background: var(--reco-bg); }
    .cv__btn--retirer { color: var(--text-muted); padding: 0.2rem 0.5rem; }
    .cv__btn--retirer:hover { color: var(--miss-text); background: var(--miss-bg); }
    .cv__btn:focus-visible, .cv__ajout-critere:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

    .cv__edition { border-top: 1px dashed var(--border); padding: 0.75rem; display: flex; flex-direction: column; gap: 0.7rem; background: var(--page-bg); border-radius: 0 0 10px 10px; }
    .cv__ident { display: grid; grid-template-columns: minmax(10rem, 16rem) 1fr; gap: 0.6rem; }
    .cv__champ { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.78rem; font-weight: 500; color: var(--text-muted); }
    .cv__champ em { font-weight: 400; }
    .cv__criteres { display: flex; flex-direction: column; gap: 0.45rem; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem; }
    .cv__terme { display: grid; grid-template-columns: 6rem minmax(10rem, 1.3fr) minmax(8rem, 0.7fr) minmax(9rem, 1fr) 2rem; gap: 0.5rem; align-items: center; }
    .cv__si { font-size: 0.85rem; font-weight: 500; color: var(--texte); }
    .cv__lien { font-size: 0.85rem; }
    .cv__ajout-critere { align-self: flex-start; border: 0; background: none; color: var(--texte); font: inherit; font-size: 0.82rem; font-weight: 500; cursor: pointer; padding: 0.2rem 0; }
    .cv__ajout-critere:hover { text-decoration: underline; }
    .cv__code { margin: 0; font-size: 0.75rem; color: var(--text-muted); }
    .cv__mono, code { font-family: var(--police-texte); font-size: 0.85em; }
    .cv__probleme { margin: 0; font-size: 0.82rem; color: var(--miss-text); font-weight: 500; }
    .cv__probleme--info { color: var(--prep-text); font-weight: 500; }
    .cv__vide { padding: 1rem; border: 1px dashed var(--border); border-radius: 10px; color: var(--text-muted); font-size: 0.9rem; text-align: center; }

    .cv__barre { position: sticky; bottom: 0; z-index: 2; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;
      padding: 0.6rem 0.75rem; border: 1px solid var(--border); border-radius: 10px; background: var(--card-bg); }
    .cv__barre--modifiee { border-color: var(--prep-border); background: var(--prep-bg); }
    .cv__barre-etat { font-size: 0.82rem; font-weight: 500; color: var(--prep-text); }
    .cv__barre-alerte { font-size: 0.82rem; font-weight: 500; color: var(--miss-text); }
    .cv__espace { flex: 1; }
    @media (max-width: 760px) {
      .cv__ligne { grid-template-columns: 1fr auto; }
      .cv__resume { grid-column: 1 / -1; order: 3; }
      .cv__terme, .cv__ident { grid-template-columns: 1fr; }
    }
  `,
})
export class ConditionsVersion {
  readonly conditions = input.required<ConditionModelePv[]>();
  readonly catalogue = input<CatalogueModelePv | null>(null);
  /** Codes des champs saisis de la version : chacun ouvre la clé `saisi.<code>`. */
  readonly champs = input<string[]>([]);
  /** Noms des passages encadrés relevés dans la page (rapport). */
  readonly utilisees = input<string[]>([]);
  readonly figee = input(false);
  readonly enregistrement = input(false);
  readonly erreurs = input<string | null>(null);
  readonly enregistrer = output<ConditionModelePv[]>();

  readonly operateurs = OPERATEURS;
  readonly sansValeur = sansValeur;
  readonly libellesEtat: Readonly<Record<EtatRegle, string>> = { ok: 'Utilisée dans la page', inutile: 'Aucun passage', incomplete: 'Incomplète' };
  readonly saisies = signal<ConditionSaisie[]>([]);
  /** Les règles dépliées pour être modifiées (une règle neuve s'ouvre d'elle-même). */
  readonly ouvertes = signal<ReadonlySet<number>>(new Set());

  constructor() {
    effect(() => {
      this.saisies.set(this.conditions().map(versSaisie));
      this.ouvertes.set(new Set());
    });
  }

  readonly cles = computed(() => [
    ...(this.catalogue()?.cles ?? []),
    ...this.champs().map((c) => ({ cle: `saisi.${c}`, libelle: `Champ saisi « ${c} »`, valeurs: null as string[] | null })),
  ]);
  private readonly libellesCles = computed(() => Object.fromEntries(this.cles().map((k) => [k.cle, k.libelle])));

  readonly modifiee = computed(() => {
    const avant = this.conditions().map((c) => [c.nom, c.libelle ?? '', c.expression]);
    const apres = this.saisies().map((c) => [c.nom.trim(), c.libelle.trim(), this.expression(c)]);
    return JSON.stringify(avant) !== JSON.stringify(apres);
  });

  readonly nbInutiles = computed(() => this.saisies().filter((c) => this.etatDe(c) === 'inutile').length);

  readonly problemeLocal = computed(() => {
    const noms = this.saisies().map((c) => c.nom.trim());
    if (noms.some((n) => !this.nomValide(n))) return 'Un nom est vide ou invalide (lettres, chiffres, « _ » ou « - »).';
    if (new Set(noms).size !== noms.length) return 'Deux règles portent le même nom.';
    if (this.saisies().some((c) => !this.expression(c))) return 'Une règle n’a pas de critère complet.';
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

  lisible(valeur: string): string {
    return VALEURS_LISIBLES[valeur] ?? valeur;
  }

  expression(c: ConditionSaisie): string {
    return c.termes ? ecrireExpression(c.termes) : c.libre.trim();
  }

  etatDe(c: ConditionSaisie): EtatRegle {
    if (!this.nomValide(c.nom) || !this.expression(c)) return 'incomplete';
    return this.utilisees().includes(c.nom.trim()) ? 'ok' : 'inutile';
  }

  probleme(c: ConditionSaisie): string | null {
    if (!this.nomValide(c.nom)) return 'Donnez un nom : lettres majuscules, chiffres, « _ » ou « - ».';
    if (!this.expression(c)) return 'Choisissez une valeur pour chaque critère.';
    if (!this.utilisees().includes(c.nom.trim())) return `Aucun passage de la page n’est encadré avec « ${c.nom.trim()} » : la règle ne sert pas encore.`;
    return null;
  }

  /** La règle dite en phrase : « Imprimé si l'avis du PV vaut « favorable » et … ». */
  phrase(c: ConditionSaisie): string {
    const e = this.expression(c);
    if (!e) return 'Critère à compléter.';
    const termes = lireExpression(e);
    if (!termes) return `Imprimé si ${e}`;
    const morceaux = termes.map((t, i) => {
      const op = OPERATEURS.find((o) => o.op === t.op)?.libelle ?? t.op;
      const cle = this.libellesCles()[t.cle] ?? t.cle;
      const terme = `${i === 0 ? cle : cle.charAt(0).toLowerCase() + cle.slice(1)} ${op}${sansValeur(t.op) ? '' : ` « ${this.lisible(t.valeur)} »`}`;
      return i === 0 ? terme : `${t.lien} ${terme}`;
    });
    const tout = morceaux.join(' ');
    return `Imprimé si ${tout.charAt(0).toLowerCase()}${tout.slice(1)}`;
  }

  basculer(i: number): void {
    this.ouvertes.update((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
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
    const i = this.saisies().length;
    this.saisies.update((l) => [...l, { nom: '', libelle: '', termes: [termeVide()], libre: '' }]);
    this.ouvertes.update((s) => new Set([...s, i]));
  }

  retirer(i: number): void {
    this.saisies.update((l) => l.filter((_, k) => k !== i));
    // Les indices des règles dépliées après celle-ci reculent d'un cran.
    this.ouvertes.update((s) => new Set([...s].filter((k) => k !== i).map((k) => (k > i ? k - 1 : k))));
  }

  ajouterTerme(i: number): void {
    this.saisies.update((l) => l.map((c, k) => (k === i && c.termes ? { ...c, termes: [...c.termes, termeVide()] } : c)));
  }

  retirerTerme(i: number, j: number): void {
    this.saisies.update((l) => l.map((c, k) => (k === i && c.termes ? { ...c, termes: c.termes.filter((_, m) => m !== j) } : c)));
  }

  annuler(): void {
    this.saisies.set(this.conditions().map(versSaisie));
    this.ouvertes.set(new Set());
  }

  envoyer(): void {
    if (this.problemeLocal()) return;
    this.enregistrer.emit(this.saisies().map((c) => ({ nom: c.nom.trim(), expression: this.expression(c), libelle: c.libelle.trim() || null })));
  }
}
