import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';

import { MotifType, NatureMotif } from '../../models';
import { DossierService } from '../../services';

/**
 * Insère `texte` dans `valeur` à la sélection [`debut`, `fin`] (le curseur si elles sont égales) : sur une ligne à lui quand le
 * texte saisi autour n'en finit pas une. Rend la nouvelle valeur et la position du curseur, juste après le texte inséré.
 */
export function insererTexte(valeur: string, texte: string, debut = valeur.length, fin = debut): { valeur: string; curseur: number } {
  const avant = valeur.slice(0, debut);
  const apres = valeur.slice(fin);
  const prefixe = avant && !avant.endsWith('\n') ? '\n' : '';
  const suffixe = apres && !apres.startsWith('\n') ? '\n' : '';
  const insere = prefixe + texte + suffixe;
  return { valeur: avant + insere + apres, curseur: avant.length + prefixe.length + texte.length };
}

/**
 * ⚠️ **Motifs-types de la conclusion** (manuel de contrôle, M4 — V97). Un bouton « Insérer un motif… » qui déplie les motifs du
 * dossier (`GET /api/dossiers/{id}/motifs-types?nature=`, lus à la première ouverture) ; un clic émet le **texte** du motif, que
 * l'hôte colle au curseur de son champ. Le manuel y laisse « … » là où le contrôleur précise. Rien n'est écrit côté serveur.
 */
@Component({
  selector: 'app-motifs-types',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details #volet class="mt" (toggle)="basculer(volet.open)">
      <summary class="btn btn-outline btn-sm mt__ouvrir">{{ titre() }}</summary>
      <div class="mt__volet" role="group" [attr.aria-label]="titre()">
        @if (chargement()) {
          <p class="text-sm text-muted" role="status">Chargement des motifs…</p>
        } @else if (erreur()) {
          <p class="text-sm" role="alert">Les motifs-types n’ont pas pu être chargés.</p>
        } @else if (!motifs().length) {
          <p class="text-sm text-muted">Aucun motif-type pour ce dossier.</p>
        } @else {
          <ul class="mt__liste">
            @for (m of motifs(); track m.idMotif) {
              <li>
                <button type="button" class="mt__motif" [disabled]="desactive()" (click)="choisir(m)">
                  <strong>{{ m.libelle }}</strong>
                  <span class="mt__apercu">{{ m.texte }}</span>
                </button>
              </li>
            }
          </ul>
          <p class="text-xs text-muted mt__aide">Le texte s’insère au curseur : complétez les « … ».</p>
        }
      </div>
    </details>
  `,
  styles: `
    :host { display: block; }
    .mt__ouvrir { list-style: none; display: inline-flex; cursor: pointer; }
    .mt__ouvrir::-webkit-details-marker { display: none; }
    .mt__volet { margin-top: 0.4rem; border: 1px solid var(--n-200); border-radius: var(--radius-md, 6px); padding: 0.5rem; max-height: 18rem; overflow-y: auto; background: var(--n-0, #fff); }
    .mt__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
    .mt__motif { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 0.15rem; padding: 0.4rem 0.55rem; border: 1px solid transparent; border-radius: 4px; background: none; cursor: pointer; font: inherit; }
    .mt__motif:hover, .mt__motif:focus-visible { border-color: var(--p-300, #93c5fd); background: var(--p-50, #eff6ff); }
    .mt__apercu { font-size: var(--text-xs, 0.75rem); color: var(--n-500); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .mt__aide { margin: 0.4rem 0 0; }
  `,
})
export class MotifsTypes {
  private readonly dossiers = inject(DossierService);

  readonly idDossier = input.required<number>();
  readonly nature = input.required<NatureMotif>();
  readonly desactive = input(false);
  /** Le texte du motif choisi. */
  readonly inserer = output<string>();

  readonly chargement = signal(false);
  readonly erreur = signal(false);
  readonly motifs = signal<MotifType[]>([]);
  private charge = false;
  private readonly volet = viewChild<ElementRef<HTMLDetailsElement>>('volet');

  titre(): string {
    return this.nature() === 'RENVOI' ? 'Insérer un motif de renvoi' : 'Insérer un motif d’avis défavorable';
  }

  basculer(ouvert: boolean): void {
    if (!ouvert || this.charge) return;
    this.charge = true;
    this.erreur.set(false);
    this.chargement.set(true);
    this.dossiers.motifsTypes(this.idDossier(), this.nature()).subscribe({
      next: (l) => {
        this.motifs.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.charge = false;
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  choisir(m: MotifType): void {
    this.inserer.emit(m.texte);
    const v = this.volet()?.nativeElement;
    if (v) v.open = false;
  }
}
