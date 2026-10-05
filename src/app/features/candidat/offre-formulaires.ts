import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import { ArticleBesoin, CategorieDao, LotBesoin } from '../../models';
import { ConformiteSaisie, SaisieOffre, aCommande, calculerTotaux, enLettres, estTravaux, montantLigne } from './offre-financiere';

/**
 * Les **formulaires de l'offre financière** (lot 5a) pour un lot : pré-remplis depuis la fiche (articles, unités, quantités,
 * caractéristiques exigées), le candidat y saisit ses prix, et en fournitures ses dates de livraison et sa conformité. Les totaux
 * se calculent ici ; le dépôt en dérive les montants de l'acte d'engagement. Aux travaux, chaque prix s'écrit en lettres sous la
 * désignation, comme au cadre du bordereau : **ce sont les lettres qui font foi**.
 */
@Component({
  selector: 'app-offre-formulaires',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let l = lot();
    <p class="text-sm of__cadre">
      @if (l.lieuLivraison) { <span>Lieu de livraison : <strong>{{ l.lieuLivraison }}</strong></span> }
      @if (l.delaiExecution; as d) { <span>Délai fixé par le dossier : <strong>{{ d.texte || (d.valeur + ' ' + (d.unite || 'jours')) }}</strong></span> }
      <span>TVA : <strong>{{ tauxTva() }} %</strong></span>
      @if (commande()) { <span class="badge badge-info">Marché à commande : montants au minimum et au maximum des quantités</span> }
    </p>

    <h3 class="of__h3">{{ travaux() ? 'Bordereau des prix unitaires et détail quantitatif et estimatif' : 'Bordereau des prix et calendrier de livraison' }}</h3>
    <div class="cnm-table-wrap">
      <table class="cnm-table of__table">
        <thead>
          <tr>
            <th scope="col">{{ travaux() ? 'N° prix' : 'N°' }}</th>
            <th scope="col">Désignation</th>
            <th scope="col">Unité</th>
            <th scope="col" class="cnm-num">{{ commande() ? 'Quantité min – max' : 'Quantité' }}</th>
            <th scope="col" class="cnm-num">Prix unitaire HT (Ar)</th>
            <th scope="col" class="cnm-num">{{ commande() ? 'Montant au max. (Ar)' : 'Montant HT (Ar)' }}</th>
            @if (!travaux()) { <th scope="col">Date de livraison</th> }
          </tr>
        </thead>
        <tbody>
          @for (g of groupes(); track g.serie) {
            @if (travaux() && g.serie) {
              <tr class="of__serie"><th scope="rowgroup" colspan="6">Série {{ g.serie }}{{ g.libelle ? ' — ' + g.libelle : '' }}</th></tr>
            }
            @for (a of g.articles; track a.idArticle; let i = $index) {
              <tr>
                <td class="cnm-mono">{{ a.numeroPrix || a.ordre || i + 1 }}</td>
                <td>
                  {{ a.designation }}
                  @if (travaux()) {
                    <div class="text-xs of__lettres">{{ a.libelleBordereau || 'L’unité' }} à :
                      @if (prix(a); as pu) { <strong>{{ lettres(pu) }} Ariary</strong> } @else { …… }
                    </div>
                  }
                </td>
                <td>{{ a.unite }}</td>
                <td class="cnm-num">{{ a.quantiteMax != null ? nombre(a.quantiteMin) + ' – ' + nombre(a.quantiteMax) : nombre(a.quantite) }}</td>
                <td class="cnm-num">
                  <input class="form-control of__pu" type="number" min="0" step="1" inputmode="numeric" [disabled]="desactive()"
                         [attr.aria-label]="'Prix unitaire hors taxes : ' + a.designation" [value]="prix(a) ?? ''"
                         (input)="poserPrix(a, $any($event.target).valueAsNumber)" />
                </td>
                <td class="cnm-num">{{ nombre(ligne(a)) }}</td>
                @if (!travaux()) {
                  <td><input class="form-control" type="date" [disabled]="desactive()" [attr.aria-label]="'Date de livraison : ' + a.designation"
                             [value]="saisie().dates[a.idArticle] ?? ''" (input)="poserDate(a, $any($event.target).value)" /></td>
                }
              </tr>
            }
            @if (travaux() && g.serie && groupes().length > 1) {
              <tr class="of__sous-total"><td colspan="5">Sous-total série {{ g.serie }}</td><td class="cnm-num">{{ nombre(sousTotal(g.serie)) }}</td></tr>
            }
          }
        </tbody>
      </table>
    </div>

    <dl class="of__totaux" aria-label="Totaux de l'offre">
      @if (commande()) {
        <dt>Total HT au minimum</dt><dd>{{ nombre(totaux().htMin) }} Ar</dd>
        <dt>Total TTC au minimum</dt><dd>{{ nombre(totaux().ttcMin) }} Ar</dd>
      }
      <dt>Total HT{{ commande() ? ' au maximum' : '' }}</dt><dd>{{ nombre(totaux().ht) }} Ar</dd>
      <dt>TVA {{ tauxTva() }} %</dt><dd>{{ nombre(totaux().tva) }} Ar</dd>
      <dt>Total TTC{{ commande() ? ' au maximum' : '' }}</dt><dd><strong>{{ nombre(totaux().ttc) }} Ar</strong></dd>
    </dl>
    @if (travaux() && totaux().ttc) {
      <p class="text-sm">Arrêté le montant du marché à la somme de <strong>{{ lettresMajuscule(totaux().ttc) }} Ariary</strong> ({{ nombre(totaux().ttc) }} Ar) toutes taxes comprises.</p>
    }

    @if (!travaux()) {
      <h3 class="of__h3">Conformité technique</h3>
      <p class="text-sm text-muted">Pour chaque article, la marque et le modèle proposés ; pour chaque caractéristique exigée, ce que vous proposez et si c’est conforme.</p>
      @for (a of l.articles; track a.idArticle; let i = $index) {
        <fieldset class="of__article">
          <legend>{{ a.ordre || i + 1 }}. {{ a.designation }}</legend>
          <div class="of__mm">
            <label class="form-group"><span class="form-label">Marque</span>
              <input class="form-control" type="text" [disabled]="desactive()" [value]="conf(a).marque" (input)="poserConf(a, 'marque', $any($event.target).value)" /></label>
            <label class="form-group"><span class="form-label">Modèle</span>
              <input class="form-control" type="text" [disabled]="desactive()" [value]="conf(a).modele" (input)="poserConf(a, 'modele', $any($event.target).value)" /></label>
          </div>
          @if (a.caracteristiques.length) {
            <div class="cnm-table-wrap">
              <table class="cnm-table">
                <thead><tr><th scope="col">Caractéristique</th><th scope="col">Exigé</th><th scope="col">Proposé</th><th scope="col">Conforme</th></tr></thead>
                <tbody>
                  @for (k of a.caracteristiques; track k.idCaracteristique) {
                    <tr>
                      <th scope="row">{{ k.libelle }}</th>
                      <td>{{ k.exigence }}</td>
                      <td><input class="form-control" type="text" [disabled]="desactive()" [attr.aria-label]="'Proposé : ' + k.libelle + ', ' + a.designation"
                                 [value]="carac(a, k.idCaracteristique!).proposee" (input)="poserCarac(a, k.idCaracteristique!, { proposee: $any($event.target).value })" /></td>
                      <td>
                        <select class="form-control" [disabled]="desactive()" [attr.aria-label]="'Conforme : ' + k.libelle + ', ' + a.designation"
                                (change)="poserCarac(a, k.idCaracteristique!, { conforme: $any($event.target).value === '' ? null : $any($event.target).value === 'OUI' })">
                          <option value="" [selected]="carac(a, k.idCaracteristique!).conforme === null">—</option>
                          <option value="OUI" [selected]="carac(a, k.idCaracteristique!).conforme === true">Oui</option>
                          <option value="NON" [selected]="carac(a, k.idCaracteristique!).conforme === false">Non</option>
                        </select>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </fieldset>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.6rem; }
    .of__cadre { margin: 0; display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; align-items: center; }
    .of__h3 { margin: 0.4rem 0 0; font-size: 0.9rem; color: var(--n-700); }
    .of__table td { vertical-align: top; }
    .of__pu { width: 9rem; text-align: right; margin-left: auto; }
    .of__lettres { color: var(--n-500); margin-top: 0.2rem; }
    /* Les en-têtes de ligne : le th global du design system est blanc, en capitales (prévu pour un thead coloré). */
    tbody th { color: var(--n-700); font-size: var(--text-sm); font-weight: 600; text-transform: none; letter-spacing: normal; white-space: normal; border-bottom: 1px solid var(--cnm-border); }
    .of__serie th { background: var(--n-50); text-align: left; font-weight: 700; }
    .of__sous-total td { font-weight: 600; }
    .of__totaux { margin: 0; display: grid; grid-template-columns: max-content max-content; gap: 0.2rem 1.25rem; justify-content: end; font-size: var(--text-sm); }
    .of__totaux dt { color: var(--n-500); }
    .of__totaux dd { margin: 0; text-align: right; }
    .of__article { border: 1px solid var(--n-200); border-radius: var(--radius-md); padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .of__article legend { font-weight: 600; padding: 0 0.3rem; }
    .of__mm { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: 0.5rem; }
  `,
})
export class OffreFormulaires {
  readonly lot = input.required<LotBesoin>();
  readonly categorie = input.required<CategorieDao | null>();
  readonly tauxTva = input.required<number>();
  readonly desactive = input(false);
  readonly saisie = model.required<SaisieOffre>();

  readonly travaux = computed(() => estTravaux(this.categorie()));
  readonly commande = computed(() => aCommande(this.lot()));
  readonly totaux = computed(() => calculerTotaux(this.lot(), this.saisie(), this.tauxTva(), this.travaux()));
  /** Aux travaux, les articles par série, dans l'ordre du DQE ; en fournitures, un seul groupe. */
  readonly groupes = computed(() => {
    const g: { serie: string; libelle: string | null; articles: ArticleBesoin[] }[] = [];
    for (const a of this.lot().articles) {
      const serie = this.travaux() ? (a.serie ?? '') : '';
      const dernier = g[g.length - 1];
      if (dernier && dernier.serie === serie) dernier.articles.push(a);
      else g.push({ serie, libelle: a.serieLibelle ?? null, articles: [a] });
    }
    return g;
  });

  readonly lettres = enLettres;

  prix(a: ArticleBesoin): number | null {
    return this.saisie().prix[a.idArticle] ?? null;
  }
  ligne(a: ArticleBesoin): number | null {
    return montantLigne(a, this.prix(a));
  }
  sousTotal(serie: string): number {
    return this.totaux().parSerie?.find((s) => s.serie === serie)?.ht ?? 0;
  }
  nombre(v: number | null | undefined): string {
    return v == null ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
  lettresMajuscule(v: number): string {
    const t = enLettres(v);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  conf(a: ArticleBesoin): ConformiteSaisie {
    return this.saisie().conformite[a.idArticle] ?? { marque: '', modele: '', caracteristiques: {} };
  }
  carac(a: ArticleBesoin, id: number): { proposee: string; conforme: boolean | null } {
    return this.conf(a).caracteristiques[id] ?? { proposee: '', conforme: null };
  }

  poserPrix(a: ArticleBesoin, v: number): void {
    this.saisie.update((s) => ({ ...s, prix: { ...s.prix, [a.idArticle]: Number.isFinite(v) && v >= 0 ? Math.round(v) : null } }));
  }
  poserDate(a: ArticleBesoin, v: string): void {
    this.saisie.update((s) => ({ ...s, dates: { ...s.dates, [a.idArticle]: v } }));
  }
  poserConf(a: ArticleBesoin, cle: 'marque' | 'modele', v: string): void {
    this.saisie.update((s) => ({ ...s, conformite: { ...s.conformite, [a.idArticle]: { ...this.conf(a), [cle]: v } } }));
  }
  poserCarac(a: ArticleBesoin, id: number, v: Partial<{ proposee: string; conforme: boolean | null }>): void {
    const c = this.conf(a);
    this.saisie.update((s) => ({
      ...s,
      conformite: { ...s.conformite, [a.idArticle]: { ...c, caracteristiques: { ...c.caracteristiques, [id]: { ...this.carac(a, id), ...v } } } },
    }));
  }
}
