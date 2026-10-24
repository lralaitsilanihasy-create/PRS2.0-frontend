import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EcartArmp } from '../../../models';
import { ModelePvService } from '../../../services';
import { SegmentEcart, diffMots, nettoyer, passagesARechercher, resserrer } from './ecarts-diff';

const LIBELLE: Readonly<Record<EcartArmp['type'], string>> = { MODIFIE: 'Modifié', AJOUTE: 'Ajouté', RETIRE: 'Retiré' };

/**
 * ⚠️ 22/10 (D-ARMP, « modeles-dao ») — les écarts d'une version d'un document du DAO avec son document type de l'ARMP (le départ),
 * ligne à ligne sur le fichier de commande reconstruit (`GET …/versions/{n}/ecarts`). Un écart ne bloque rien ; la mise en vigueur
 * d'une version qui s'écarte demande la validation du juriste.
 */
@Component({
  selector: 'app-ecarts-armp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ear" aria-labelledby="ear-titre">
      <h3 id="ear-titre" class="ear__titre">Écarts avec le document type de l’ARMP</h3>
      @if (erreur(); as e) {
        <p class="form-error" role="alert">{{ e }}</p>
      } @else if (ecarts(); as l) {
        @if (!l.length) {
          <p class="ear__conforme"><span class="badge badge-success">Conforme ARMP</span> Le texte est celui du document type intégré à l’application.</p>
        } @else {
          @let fond = nbFond(l);
          <div class="ear__resume">
            <span class="ear__compte ear__compte--forme">{{ l.length - fond }} de forme</span>
            <span class="ear__compte ear__compte--fond">{{ fond }} de fond</span>
            <span>
              @if (fond) { La mise en vigueur demandera la validation du juriste, pour le fond. }
              @else { Corrections de forme seulement : la mise en vigueur ne demande pas le juriste. }
            </span>
            @if (fond && fond < l.length) {
              <label class="ear__filtre"><input type="checkbox" [checked]="fondSeul()" (change)="fondSeul.set($any($event.target).checked)" /> Le fond seulement</label>
            }
          </div>
          <ul class="ear__liste">
            @for (e of affiches(l); track $index) {
              <li [class]="'ear__ecart ear__ecart--' + e.type + ' ear__ecart--' + (e.nature ?? 'FOND')">
                <span class="ear__type"><span [class]="'ear__nature ear__nature--' + (e.nature ?? 'FOND')">{{ e.nature === 'FORME' ? 'forme' : 'fond' }}</span>
                  {{ libelle[e.type] }} <small>· ligne {{ e.rang }}</small>
                  @if (e.type !== 'RETIRE') {
                    <button type="button" class="ear__aller" (click)="aller.emit(passages(e))">Aller à l’endroit</button>
                  }
                </span>
                @if (e.type === 'MODIFIE') {
                  <p class="ear__texte">
                    @for (s of segments(e); track $index) {
                      @switch (s.type) {
                        @case ('retire') { <del>{{ s.texte }}</del> }
                        @case ('ajoute') { <ins>{{ s.texte }}</ins> }
                        @case ('coupure') { <span class="ear__coupure">{{ s.texte }}</span> }
                        @default { <span>{{ s.texte }}</span> }
                      }
                    }
                  </p>
                } @else if (e.type === 'AJOUTE') {
                  <p class="ear__texte"><ins>{{ propre(e.apres) }}</ins></p>
                } @else {
                  <p class="ear__texte"><del>{{ propre(e.avant) }}</del></p>
                }
              </li>
            }
          </ul>
        }
      } @else {
        <p class="text-muted" role="status">Comparaison avec le document type…</p>
      }
    </section>
  `,
  styles: `
    .ear { display: flex; flex-direction: column; gap: 0.5rem; }
    .ear__titre { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--p-700); text-transform: uppercase; letter-spacing: 0.04em; }
    .ear__conforme, .ear__resume { margin: 0; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; color: var(--n-700); font-size: 0.9rem; }
    .ear__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .ear__ecart { background: var(--card-bg, #fff); border: 1px solid var(--n-200, #e2e8f0); border-left: 3px solid var(--prep-accent, #ca8a04); border-radius: 0 8px 8px 0; padding: 0.4rem 0.6rem;
      display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.85rem; }
    .ear__ecart--AJOUTE { border-left-color: var(--ok-accent, #059669); }
    .ear__ecart--RETIRE { border-left-color: var(--miss-accent, #dc2626); }
    /* ⚠️ 23/10 — la forme en gris, le fond en ambre : seul le fond demande le juriste. */
    .ear__ecart--FORME { border-left-color: var(--n-300, #cbd5e1); }
    .ear__ecart--FOND { border-left-color: var(--prep-accent, #ca8a04); }
    .ear__nature { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 999px; padding: 0 7px; margin-right: 4px; border: 1px solid; }
    .ear__nature--FORME { color: var(--n-600, #475569); background: var(--n-50, #f8fafc); border-color: var(--n-200, #e2e8f0); }
    .ear__nature--FOND { color: var(--prep-text, #854d0e); background: var(--prep-bg, #fef9c3); border-color: var(--prep-border, #fde047); }
    .ear__compte { font-size: 12px; font-weight: 700; border-radius: 999px; padding: 1px 9px; border: 1px solid; }
    .ear__compte--forme { color: var(--n-600, #475569); background: var(--n-50, #f8fafc); border-color: var(--n-200, #e2e8f0); }
    .ear__compte--fond { color: var(--prep-text, #854d0e); background: var(--prep-bg, #fef9c3); border-color: var(--prep-border, #fde047); }
    .ear__filtre { display: inline-flex; gap: 5px; align-items: center; font-size: 12.5px; color: var(--n-700); margin-left: auto; cursor: pointer; }
    .ear__type { font-weight: 700; color: var(--n-800); }
    .ear__type small { font-weight: 400; color: var(--n-500); }
    .ear__texte { margin: 0; color: var(--n-700); line-height: 1.5; white-space: pre-wrap; }
    del { color: var(--miss-text, #991b1b); background: #fee2e2; border-radius: 3px; padding: 0 2px; }
    ins { color: var(--ok-text, #065f46); background: #d1fae5; text-decoration: none; font-weight: 600; border-radius: 3px; padding: 0 2px; }
    .ear__coupure { color: var(--n-500); }
    .ear__aller { margin-left: 0.5rem; border: 0; background: none; padding: 0; color: var(--p-700); text-decoration: underline; cursor: pointer; font: inherit; font-size: 0.85em; font-weight: 400; }
    .ear__aller:focus-visible { outline: 2px solid var(--p-700); outline-offset: 2px; }
  `,
})
export class EcartsArmp {
  private readonly service = inject(ModelePvService);
  private readonly destroyRef = inject(DestroyRef);

  readonly idModele = input.required<number>();
  readonly numero = input.required<number>();
  /** Change à chaque enregistrement de la version (son empreinte) : les écarts sont relus. */
  readonly empreinte = input<string | null>(null);

  readonly libelle = LIBELLE;
  /** « Le fond seulement » : n'affiche que les écarts que le juriste aura à valider. */
  readonly fondSeul = signal(false);

  nbFond(l: readonly EcartArmp[]): number {
    return l.filter((e) => e.nature !== 'FORME').length;
  }

  affiches(l: readonly EcartArmp[]): readonly EcartArmp[] {
    return this.fondSeul() ? l.filter((e) => e.nature !== 'FORME') : l;
  }
  /** « Aller à l'endroit » : les passages à chercher dans la page, du plus précis au plus large. */
  readonly aller = output<string[]>();

  segments(e: EcartArmp): SegmentEcart[] {
    return resserrer(diffMots(nettoyer(e.avant), nettoyer(e.apres)));
  }

  propre(s: string | null): string {
    return nettoyer(s);
  }

  passages(e: EcartArmp): string[] {
    return e.type === 'AJOUTE' ? [nettoyer(e.apres).slice(0, 60)] : passagesARechercher(e.avant ?? '', e.apres ?? '');
  }
  readonly ecarts = signal<EcartArmp[] | null>(null);
  readonly erreur = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.idModele();
      const n = this.numero();
      this.empreinte();
      this.ecarts.set(null);
      this.erreur.set(null);
      this.service
        .ecarts(id, n)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (l) => this.ecarts.set(l), error: (e: { message?: string }) => this.erreur.set(e.message || 'Les écarts n’ont pas pu être lus.') });
    });
  }
}
