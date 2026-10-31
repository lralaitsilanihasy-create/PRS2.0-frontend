import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { CatalogueModelePv } from '../../../models';

/**
 * ⚠️ Générateur de modèles de PV, G1 (20/10, §B3) — le catalogue des variables, filtré par la famille du sous-type : un clic
 * copie le marqueur, à coller dans Word. Les listes répétées (`{{POUR:…}}`), les formats et les anciens marqueurs (chevrons)
 * suivent.
 */
@Component({
  selector: 'app-catalogue-variables',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (catalogue(); as c) {
      <div class="cat">
        <label>
          <input class="form-control" type="search" placeholder="Filtrer les variables…" aria-label="Filtrer les variables"
                 [value]="filtre()" (input)="filtre.set($any($event.target).value)" />
        </label>
        <p class="cat__copie" role="status">{{ copie() ? 'Copié : ' + copie() : 'Cliquez une variable pour la copier.' }}</p>

        @for (g of groupes(); track g.nom) {
          <details class="cat__groupe" [open]="!!filtre() || $first">
            <summary>{{ g.nom }} <span class="text-muted">({{ g.variables.length }})</span></summary>
            <table>
              <tbody>
                @for (v of g.variables; track v.code) {
                  <tr>
                    <td>
                      <button type="button" class="cat__var" [attr.aria-label]="'Copier ' + marqueur(v.code)" (click)="copier(marqueur(v.code))">
                        {{ marqueur(v.code) }}
                      </button>
                      <span class="cat__lib">{{ v.libelle }}@if (v.liste) { — dans une ligne <code>{{ o }}POUR:{{ v.liste }}{{ f }}</code> }</span>
                    </td>
                    <td class="cat__ex">{{ v.exemple }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </details>
        }

        @if (c.listes.length) {
          <details class="cat__groupe">
            <summary>Lignes répétées</summary>
            <ul>
              @for (l of c.listes; track l.nom) {
                <li>
                  <button type="button" class="cat__var" (click)="copier(o + 'POUR:' + l.nom + f)">{{ o }}POUR:{{ l.nom }}{{ f }}</button>
                  {{ l.libelle }} — dans la première cellule de la ligne de tableau à répéter ; ses variables commencent par <code>{{ l.prefixe }}.</code>
                </li>
              }
            </ul>
          </details>
        }
        <details class="cat__groupe">
          <summary>Formats et anciens marqueurs</summary>
          <p class="text-sm">Formats : @for (fm of c.formats; track fm; let der = $last) { <code>|{{ fm }}</code>{{ der ? '' : ', ' }} } — par exemple <code>{{ o }}PV.DATE_EXAMEN|lettres{{ f }}</code>.</p>
          <table>
            <tbody>
              @for (a of alias(); track a[0]) { <tr><td><code>{{ a[0] }}</code></td><td>lu comme <code>{{ o }}{{ a[1] }}{{ f }}</code></td></tr> }
            </tbody>
          </table>
        </details>
      </div>
    } @else {
      <p class="text-muted" role="status">Chargement du catalogue…</p>
    }
  `,
  styles: `
    .cat { display: flex; flex-direction: column; gap: 0.5rem; }
    .cat__copie { margin: 0; font-size: 0.8rem; color: var(--n-500); min-height: 1.2em; }
    .cat__groupe { border: 1px solid var(--n-200); border-radius: 10px; padding: 0.4rem 0.75rem; }
    .cat__groupe summary { cursor: pointer; font-weight: 500; color: var(--p-700); padding: 0.25rem 0; }
    .cat__groupe table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .cat__groupe td { padding: 0.35rem 0.25rem; border-top: 1px solid var(--n-100); vertical-align: top; }
    .cat__groupe ul { margin: 0.25rem 0; padding-left: 1rem; font-size: 0.85rem; }
    .cat__var { border: 0; background: var(--p-50); color: var(--p-700); border-radius: 6px; padding: 0.05rem 0.4rem; cursor: pointer;
      font-family: Consolas, monospace; font-size: 0.8rem; }
    .cat__var:hover, .cat__var:focus-visible { background: var(--p-100); }
    .cat__lib { display: block; color: var(--n-700); }
    .cat__ex { color: var(--n-500); width: 40%; }
    code { font-family: Consolas, monospace; font-size: 0.85em; }
  `,
})
export class CatalogueVariables {
  readonly catalogue = input<CatalogueModelePv | null>(null);

  readonly o = '{{';
  readonly f = '}}';
  readonly filtre = signal('');
  readonly copie = signal<string | null>(null);

  readonly groupes = computed(() => {
    const q = this.filtre().trim().toLowerCase();
    const gs = this.catalogue()?.groupes ?? [];
    if (!q) return gs;
    return gs
      .map((g) => ({ ...g, variables: g.variables.filter((v) => `${v.code} ${v.libelle} ${v.exemple ?? ''}`.toLowerCase().includes(q)) }))
      .filter((g) => g.variables.length);
  });

  readonly alias = computed(() => Object.entries(this.catalogue()?.alias ?? {}));

  marqueur(code: string): string {
    return `${this.o}${code}${this.f}`;
  }

  copier(texte: string): void {
    void navigator.clipboard?.writeText(texte).then(
      () => this.copie.set(texte),
      () => this.copie.set(null),
    );
  }
}
