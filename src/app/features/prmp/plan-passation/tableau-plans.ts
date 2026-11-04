import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AvancementLignes } from '../../../models';
import { montantOfficiel } from '../../../shared/prmp/document-officiel';

/** Une ligne du tableau : un plan en vigueur, ses chiffres, et l'avancement de ses lignes quand le serveur le sert. */
export interface PlanResume {
  idDossier: number;
  entite: string;
  reference: string;
  exercice: number | null;
  lignes: number;
  montant: number;
  cloture: string | null;
  avancement: AvancementLignes | null;
}

type Tri = 'entite' | 'montant' | 'sansEtape';

/** Texte comparable : minuscules, sans accents. */
const sansAccents = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * ⚠️ 04/11 (pilote, maquette « plusieurs plans », variante B) — l'entrée de « Plans de passation » chez le Président, le CC et le Membre
 * quand la localité compte plusieurs plans en vigueur : une ligne par plan (entité, référence, lignes, montant, clôture, avancement),
 * recherche, exercice et tri ; un clic ouvre le plan. La colonne d'avancement n'apparaît que lorsque le serveur sert
 * `avancementLignes` (demande « avancement-plans », B1) : sans elle, il faudrait lire la filiation de chaque plan.
 */
@Component({
  selector: 'app-tableau-plans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="tp__outils">
      <div class="tp__champ tp__champ--q">
        <label class="tp__champ-l" for="tp-q">Rechercher</label>
        <input id="tp-q" class="form-control" type="search" placeholder="Entité, référence…" [value]="recherche()" (input)="recherche.set($any($event.target).value)" />
      </div>
      @if (exercices().length > 1) {
        <div class="tp__champ">
          <label class="tp__champ-l" for="tp-ex">Exercice</label>
          <select id="tp-ex" class="form-control" [value]="exercice()" (change)="exercice.set($any($event.target).value)">
            <option value="">Tous</option>
            @for (e of exercices(); track e) { <option [value]="e">{{ e }}</option> }
          </select>
        </div>
      }
      <div class="tp__champ">
        <label class="tp__champ-l" for="tp-tri">Trier par</label>
        <select id="tp-tri" class="form-control" [value]="tri()" (change)="tri.set($any($event.target).value)">
          <option value="entite">Entité</option>
          <option value="montant">Montant (le plus élevé d'abord)</option>
          @if (avecAvancement()) { <option value="sansEtape">Lignes sans étape (le plus d'abord)</option> }
        </select>
      </div>
      <p class="tp__resume">{{ resume() }}</p>
    </div>

    @if (avecAvancement()) {
      <p class="tp__legende">
        <span><i class="tp__c tp__c--favorable"></i>lancées ou au marché</span>
        <span><i class="tp__c tp__c--examen"></i>en préparation ou à la Commission</span>
        <span><i class="tp__c tp__c--lancer"></i>à lancer</span>
        <span><i class="tp__c"></i>sans étape</span>
      </p>
    }

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th scope="col">Entité contractante</th>
            <th scope="col">Référence</th>
            <th scope="col" class="r">Lignes</th>
            <th scope="col" class="r">Montant (Ar)</th>
            @if (avecAvancement()) { <th scope="col">Avancement des lignes</th> }
            <th scope="col">Clôturé le</th>
          </tr>
        </thead>
        <tbody>
          @for (p of affiches(); track p.idDossier) {
            <tr class="ligne-clic">
              <td><a class="lien-ligne" [routerLink]="[espace(), 'plan', p.idDossier]">{{ p.entite }}</a></td>
              <td class="tp__nowrap">{{ p.reference }}@if (p.exercice) { · {{ p.exercice }} }</td>
              <td class="r tp__num">{{ p.lignes }}</td>
              <td class="r tp__num">{{ montant(p.montant) }}</td>
              @if (avecAvancement()) {
                <td>
                  @if (p.avancement; as a) {
                    <div class="tp__avanc">
                      <div class="tp__barre" aria-hidden="true">
                        <i class="tp__c--favorable" [style.width.%]="part(a, a.marche + a.lancee)"></i>
                        <i class="tp__c--examen" [style.width.%]="part(a, a.commission + a.preparation)"></i>
                        <i class="tp__c--lancer" [style.width.%]="part(a, a.lancer)"></i>
                      </div>
                      <span class="tp__avanc-t">{{ a.marche + a.lancee }} lancée{{ a.marche + a.lancee > 1 ? 's' : '' }} · {{ a.commission + a.preparation }} en cours · {{ a.lancer }} à lancer · {{ a.aucune }} sans étape</span>
                    </div>
                  } @else { — }
                </td>
              }
              <td class="tp__nowrap tp__num">{{ p.cloture ?? '—' }}</td>
            </tr>
          } @empty {
            <tr><td [attr.colspan]="avecAvancement() ? 6 : 5" class="tp__vide">Aucun plan ne correspond à la recherche.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: grid; gap: 0.75rem; }
    .tp__outils { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; align-items: flex-end; }
    .tp__champ { display: grid; gap: 0.2rem; min-width: 0; }
    .tp__champ--q { flex: 1 1 18rem; max-width: 28rem; }
    .tp__champ-l { font-size: 0.75rem; font-weight: 500; color: var(--texte-secondaire); }
    .tp__resume { margin: 0 0 0.45rem; font-size: 0.8125rem; color: var(--texte-secondaire); font-variant-numeric: tabular-nums; }
    .tp__legende { margin: 0; display: flex; flex-wrap: wrap; gap: 0.35rem 1rem; font-size: 0.75rem; color: var(--texte-secondaire); }
    .tp__legende span { display: inline-flex; align-items: center; gap: 0.3rem; }
    .tp__c { display: inline-block; width: 0.65rem; height: 0.65rem; border-radius: 2px; background: var(--neutre-fond); border: 1px solid var(--bordure); }
    .tp__c--favorable { background: var(--suivi-favorable-fond); }
    .tp__c--examen { background: var(--suivi-examen-fond); }
    .tp__c--lancer { background: var(--suivi-lancer-fond); }
    .r { text-align: right; }
    .tp__nowrap { white-space: nowrap; }
    .tp__num { font-variant-numeric: tabular-nums; }
    .tp__avanc { display: grid; gap: 0.2rem; min-width: 11rem; }
    .tp__barre { display: flex; height: 0.5rem; border-radius: 2px; overflow: hidden; background: var(--neutre-fond); }
    .tp__barre i { display: block; }
    .tp__avanc-t { font-size: 0.75rem; color: var(--texte-secondaire); font-variant-numeric: tabular-nums; }
    .tp__vide { text-align: center; color: var(--texte-secondaire); padding: 1.5rem; }
    /* Ligne cliquable : le lien de l'entité couvre toute la ligne (::after), comme la liste « Dossiers ». */
    tr.ligne-clic { position: relative; cursor: pointer; }
    tr.ligne-clic:hover td { background: var(--ligne-survol); }
    .lien-ligne { color: inherit; text-decoration: none; font-weight: 500; }
    .lien-ligne::after { content: ''; position: absolute; inset: 0; }
    .lien-ligne:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: 2px; }
  `,
})
export class TableauPlans {
  readonly plans = input.required<readonly PlanResume[]>();
  /** L'espace de l'écran (« /president », « /cc », « /membre ») : le plan s'ouvre dans l'espace courant. */
  readonly espace = input.required<string>();

  readonly recherche = signal('');
  readonly exercice = signal('');
  readonly tri = signal<Tri>('entite');

  readonly avecAvancement = computed(() => this.plans().some((p) => p.avancement));
  readonly exercices = computed(() => [...new Set(this.plans().map((p) => p.exercice).filter((e): e is number => e != null))].sort((a, b) => b - a));

  readonly affiches = computed(() => {
    const mots = sansAccents(this.recherche().trim()).split(/\s+/).filter(Boolean);
    const ex = this.exercice();
    const rows = this.plans().filter((p) => {
      if (ex && String(p.exercice) !== ex) return false;
      const texte = sansAccents(`${p.entite} ${p.reference}`);
      return mots.every((m) => texte.includes(m));
    });
    const tri = this.tri();
    const sansEtape = (p: PlanResume): number => (p.avancement && p.avancement.lignes ? p.avancement.aucune / p.avancement.lignes : 0);
    return [...rows].sort((a, b) =>
      tri === 'montant' ? b.montant - a.montant
        : tri === 'sansEtape' ? sansEtape(b) - sansEtape(a) || a.entite.localeCompare(b.entite)
          : a.entite.localeCompare(b.entite) || a.reference.localeCompare(b.reference),
    );
  });

  /** « 8 plans · 418 400 000 000,00 Ar » — sur les plans affichés. */
  readonly resume = computed(() => {
    const rows = this.affiches();
    const total = rows.reduce((t, p) => t + p.montant, 0);
    return `${rows.length} plan${rows.length > 1 ? 's' : ''} · ${this.montant(total)} Ar`;
  });

  montant(n: number): string {
    return montantOfficiel(n);
  }

  /** Part d'une étape dans la barre, en pour cent des lignes du plan. */
  part(a: AvancementLignes, n: number): number {
    return a.lignes ? (n / a.lignes) * 100 : 0;
  }
}
