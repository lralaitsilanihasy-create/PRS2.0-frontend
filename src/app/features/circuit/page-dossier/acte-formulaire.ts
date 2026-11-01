import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import { CategorieMarche, DemandeActe, SousTypeActe } from '../../../models';
import { LIBELLES_ACTE, LIBELLES_CATEGORIE_MARCHE, SOUS_TYPES_ACTE, ariary } from './actes-gestion-modele';

/**
 * ⚠️ Manuel de contrôle, M5a (V98) — les déclarations d'un acte de gestion, au dépôt comme à la modification d'un brouillon. Le montant
 * initial et la catégorie ne se demandent que si le serveur ne les connaît pas ; réceptions et solde sont les faits qui gardent
 * l'avenant (refusé après la réception ou le solde).
 */
@Component({
  selector: 'app-acte-formulaire',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="af">
      <label class="form-group">
        <span class="form-label">Acte de gestion</span>
        <select class="form-control" [disabled]="sousTypeFige() || desactive()" (change)="poser('sousType', $any($event.target).value)">
          @for (s of sousTypes; track s) { <option [value]="s" [selected]="demande().sousType === s">{{ libelles[s] }}</option> }
        </select>
      </label>
      @if (demande().sousType === 'AVN') {
        <!-- ⚠️ 01/11 (pilote, « améliorer ») — l'unité dans le champ, et le montant relu en clair dessous (hausse ou baisse). -->
        <label class="form-group">
          <span class="form-label">Montant de l’avenant, hors taxes</span>
          <span class="af__montant">
            <input class="form-control" type="number" step="1" [disabled]="desactive()" [value]="demande().montantHt ?? ''" (input)="poserNombre('montantHt', $event)"
              aria-describedby="af-montant-aide" />
            <span class="af__unite" aria-hidden="true">Ar HT</span>
          </span>
          @if (lecture(); as l) {
            <span class="af__lecture" [class.af__lecture--baisse]="l.baisse" role="status">{{ l.texte }}</span>
          } @else {
            <span class="form-hint" id="af-montant-aide">Positif pour une hausse, négatif pour une baisse.</span>
          }
        </label>
      }
      @if (!montantInitialConnu()) {
        <label class="form-group">
          <span class="form-label">Montant initial du marché, hors taxes (Ariary)</span>
          <input class="form-control" type="number" min="1" step="1" [disabled]="desactive()" [value]="demande().montantInitialHt ?? ''" (input)="poserNombre('montantInitialHt', $event)" />
          <span class="form-hint">Non connu de l’application : il fonde le plafond des avenants (le tiers) et vaudra pour les actes suivants.</span>
        </label>
      }
      @if (!categorieConnue()) {
        <label class="form-group">
          <span class="form-label">Catégorie du marché</span>
          <select class="form-control" [disabled]="desactive()" (change)="poser('categorie', $any($event.target).value || null)">
            <option value="" [selected]="!demande().categorie">— Choisir —</option>
            @for (c of categories; track c) { <option [value]="c" [selected]="demande().categorie === c">{{ libellesCategorie[c] }}</option> }
          </select>
        </label>
      }
      <!-- ⚠️ 01/11 (pilote, « améliorer ») — des dates facultatives : repliées, sauf si l'une est déjà connue. -->
      <details class="af__faits" [open]="faitsConnus()">
        <summary class="af__faits-t">Dates du marché déjà survenues <span class="af__facultatif">facultatif</span></summary>
        @if (demande().sousType === 'AVN') { <p class="form-hint af__faits-aide">Un avenant n’est plus possible après la réception ou le solde du marché.</p> }
        <div class="af__faits-grille">
        <label class="form-group">
          <span class="form-label">Réception provisoire</span>
          <input class="form-control" type="date" [disabled]="desactive()" [value]="demande().dateReceptionProvisoire ?? ''" (input)="poser('dateReceptionProvisoire', $any($event.target).value || null)" />
        </label>
        <label class="form-group">
          <span class="form-label">Réception définitive</span>
          <input class="form-control" type="date" [disabled]="desactive()" [value]="demande().dateReceptionDefinitive ?? ''" (input)="poser('dateReceptionDefinitive', $any($event.target).value || null)" />
        </label>
        <label class="form-group">
          <span class="form-label">Solde réglé le</span>
          <input class="form-control" type="date" [disabled]="desactive()" [value]="demande().dateSolde ?? ''" (input)="poser('dateSolde', $any($event.target).value || null)" />
        </label>
        </div>
      </details>
    </div>
  `,
  styles: `
    .af { display: flex; flex-direction: column; gap: 0.7rem; }
    .af__montant { position: relative; display: block; }
    .af__montant .form-control { padding-right: 4.5rem; font-variant-numeric: tabular-nums; appearance: textfield; -moz-appearance: textfield; }
    .af__montant .form-control::-webkit-inner-spin-button, .af__montant .form-control::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .af__unite { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.85rem; color: var(--texte-secondaire); pointer-events: none; }
    .af__lecture { font-size: 0.85rem; font-weight: 500; color: var(--favorable-texte); }
    .af__lecture--baisse { color: var(--examen-texte); }
    .af__faits { border: 1px solid var(--bordure); border-radius: 6px; padding: 0.4rem 0.75rem; }
    .af__faits[open] { padding-bottom: 0.75rem; }
    .af__faits-t { cursor: pointer; font-size: 0.9rem; font-weight: 500; padding: 0.2rem 0; }
    .af__facultatif { margin-left: 0.4rem; padding: 0 0.45rem; border-radius: 999px; background: var(--neutre-fond); color: var(--neutre-texte); font-size: 0.72rem; font-weight: 500; }
    .af__faits-aide { margin: 0.25rem 0 0.5rem; }
    .af__faits-grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr)); gap: 0.5rem; }
  `,
})
export class ActeFormulaire {
  readonly demande = model.required<DemandeActe>();
  /** Le serveur connaît déjà le montant initial (attribution en ligne ou déclaration précédente) : il ne se redemande pas. */
  readonly montantInitialConnu = input(false);
  readonly categorieConnue = input(false);
  /** À la modification, le sous-type ne change pas (le serveur l'ignore). */
  readonly sousTypeFige = input(false);
  readonly desactive = input(false);

  readonly sousTypes = SOUS_TYPES_ACTE;
  readonly libelles = LIBELLES_ACTE;
  readonly categories = Object.keys(LIBELLES_CATEGORIE_MARCHE) as CategorieMarche[];
  readonly libellesCategorie = LIBELLES_CATEGORIE_MARCHE;

  /** ⚠️ 01/11 — le montant de l'avenant relu en clair : « Hausse de 25 000 000 Ar HT », « Baisse de … ». */
  readonly lecture = computed(() => {
    const v = this.demande().montantHt;
    if (v == null || v === 0) return null;
    return { texte: `${v > 0 ? 'Hausse' : 'Baisse'} de ${ariary(Math.abs(v))} HT`, baisse: v < 0 };
  });
  /** Une date du marché est déjà connue : le bloc des dates s'ouvre. */
  readonly faitsConnus = computed(() => {
    const d = this.demande();
    return !!(d.dateReceptionProvisoire || d.dateReceptionDefinitive || d.dateSolde);
  });

  poser<K extends keyof DemandeActe>(cle: K, valeur: DemandeActe[K]): void {
    this.demande.update((d) => ({ ...d, [cle]: valeur, ...(cle === 'sousType' && valeur !== 'AVN' ? { montantHt: null } : {}) }));
  }

  poserNombre(cle: 'montantHt' | 'montantInitialHt', ev: Event): void {
    const v = (ev.target as HTMLInputElement).valueAsNumber;
    this.poser(cle, Number.isFinite(v) ? v : null);
  }
}

/** Une demande vierge (ou reprise d'un acte), pour un sous-type donné. */
export function demandeVide(sousType: SousTypeActe = 'AVN'): DemandeActe {
  return { sousType, montantHt: null, montantInitialHt: null, categorie: null, dateReceptionProvisoire: null, dateReceptionDefinitive: null, dateSolde: null };
}
