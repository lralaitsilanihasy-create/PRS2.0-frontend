import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { CategorieMarche, DemandeActe, SousTypeActe } from '../../../models';
import { LIBELLES_ACTE, LIBELLES_CATEGORIE_MARCHE, SOUS_TYPES_ACTE } from './actes-gestion-modele';

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
        <label class="form-group">
          <span class="form-label">Montant de l’avenant, hors taxes (Ariary)</span>
          <input class="form-control" type="number" step="1" [disabled]="desactive()" [value]="demande().montantHt ?? ''" (input)="poserNombre('montantHt', $event)" />
          <span class="form-hint">Positif pour une hausse, négatif pour une baisse.</span>
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
      <fieldset class="af__faits">
        <legend class="form-label">Faits du marché, s’ils sont survenus</legend>
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
      </fieldset>
    </div>
  `,
  styles: `
    .af { display: flex; flex-direction: column; gap: 0.6rem; }
    .af__faits { border: 1px solid var(--n-200); border-radius: 8px; padding: 0.5rem 0.75rem; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr)); gap: 0.5rem; }
    .af__faits legend { padding: 0 0.3rem; }
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
