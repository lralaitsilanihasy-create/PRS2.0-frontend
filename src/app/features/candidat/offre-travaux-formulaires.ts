import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import { NatureDebourse, TotauxOffre } from '../../core/securite/scellement';
import { ArticleBesoin, BesoinEnLigne, LotBesoin, PersonnelExige } from '../../models';
import {
  LigneDebourse,
  NATURES_DEBOURSE,
  PersonneSaisie,
  ReferenceSaisie,
  SaisieTravaux,
  TAUX_K1,
  articlesSousDetail,
  calculerK1,
  deboursesSecs,
  exercices,
  moyenneCa,
  prixSousDetail,
  referencesRetenues,
  seuilLiquidite,
} from './offre-travaux';

/**
 * Les **formulaires des travaux, lot 5b** : coefficient K1 (annexe 2 de l'AE), sous-détail des prix exigés (annexe 3), capacités
 * financières et techniques, personnel et matériel proposés — pré-remplis des exigences de la fiche, contrôlés ici comme le serveur
 * le refera à l'ouverture. Les justificatifs (CV, cartes grises, attestations) restent des pièces jointes.
 */
@Component({
  selector: 'app-offre-travaux-formulaires',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 class="ot__h3">Coefficient de majoration des déboursés K1</h3>
    <p class="text-sm text-muted">K1 = (1 + A1/100) × (1 + A2/100) / (1 − A3/100 × (1 + TVA/100)), arrondi au centième par défaut. A3 est nul pour une entreprise ayant son siège à Madagascar.</p>
    <fieldset class="ot__radios">
      <legend class="form-label">Siège social</legend>
      <label><input type="radio" name="ot-siege" [disabled]="desactive()" [checked]="!saisie().siegeEtranger" (change)="poser({ siegeEtranger: false })" /> à Madagascar</label>
      <label><input type="radio" name="ot-siege" [disabled]="desactive()" [checked]="saisie().siegeEtranger" (change)="poser({ siegeEtranger: true })" /> hors de Madagascar</label>
    </fieldset>
    <div class="cnm-table-wrap">
      <table class="cnm-table">
        <thead><tr><th scope="col">Origine des frais</th><th scope="col">Indice</th><th scope="col">Catégorie</th><th scope="col" class="cnm-num">Taux (%)</th></tr></thead>
        <tbody>
          @for (t of tauxK1; track t.code) {
            <tr>
              <th scope="row">{{ t.libelle }}</th><td>{{ t.code }}</td><td>{{ t.categorie }}</td>
              <td class="cnm-num"><input class="form-control ot__num" type="number" min="0" step="0.01" [disabled]="desactive() || (t.categorie === 'A3' && !saisie().siegeEtranger)"
                [attr.aria-label]="'Taux, ' + t.libelle" [value]="saisie().k1[t.code] ?? ''" (input)="poserTaux(t.code, $any($event.target).valueAsNumber)" /></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="text-sm ot__resultat">A1 = {{ pct(k1().A1) }} · A2 = {{ pct(k1().A2) }} · A3 = {{ pct(k1().A3) }} · <strong>K1 = {{ k1().k1.toFixed(2).replace('.', ',') }}</strong></p>

    @for (a of sousDetail(); track a.idArticle) {
      <h3 class="ot__h3">Sous-détail du prix {{ a.numeroPrix }} — {{ a.designation }}</h3>
      <div class="cnm-table-wrap">
        <table class="cnm-table">
          <thead><tr><th scope="col">Nature</th><th scope="col">Composante</th><th scope="col">Unité</th><th scope="col" class="cnm-num">Quantité</th><th scope="col" class="cnm-num">Prix unitaire (Ar)</th><th scope="col" class="cnm-num">Total (Ar)</th><th scope="col"><span class="sr-only">Retirer</span></th></tr></thead>
          <tbody>
            @for (l of lignes(a); track $index; let i = $index) {
              <tr>
                <td><select class="form-control" [disabled]="desactive()" [attr.aria-label]="'Nature, ligne ' + (i + 1)" (change)="poserLigne(a, i, { nature: $any($event.target).value })">
                  @for (n of natures; track n.code) { <option [value]="n.code" [selected]="l.nature === n.code">{{ n.libelle }}</option> }
                </select></td>
                <td><input class="form-control" type="text" [disabled]="desactive()" [attr.aria-label]="'Composante, ligne ' + (i + 1)" [value]="l.designation" (input)="poserLigne(a, i, { designation: $any($event.target).value })" /></td>
                <td><input class="form-control ot__unite" type="text" [disabled]="desactive()" [attr.aria-label]="'Unité, ligne ' + (i + 1)" [value]="l.unite" (input)="poserLigne(a, i, { unite: $any($event.target).value })" /></td>
                <td class="cnm-num"><input class="form-control ot__num" type="number" min="0" step="0.01" [disabled]="desactive()" [attr.aria-label]="'Quantité, ligne ' + (i + 1)" [value]="l.quantite ?? ''" (input)="poserLigne(a, i, { quantite: nombreOuNul($any($event.target).valueAsNumber) })" /></td>
                <td class="cnm-num"><input class="form-control ot__num" type="number" min="0" step="1" [disabled]="desactive()" [attr.aria-label]="'Prix unitaire, ligne ' + (i + 1)" [value]="l.prixUnitaire ?? ''" (input)="poserLigne(a, i, { prixUnitaire: nombreOuNul($any($event.target).valueAsNumber) })" /></td>
                <td class="cnm-num">{{ nombre(Math.round((l.quantite ?? 0) * (l.prixUnitaire ?? 0))) }}</td>
                <td><button type="button" class="btn btn-sm btn-outline" [disabled]="desactive()" [attr.aria-label]="'Retirer la ligne ' + (i + 1)" (click)="retirerLigne(a, i)">✕</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="ot__ligne-actions">
        <button type="button" class="btn btn-sm btn-secondary" [disabled]="desactive()" (click)="ajouterLigne(a)">Ajouter une composante</button>
        <label class="ot__inline"><span>Rendement « R »</span><input class="form-control ot__num" type="number" min="0" step="0.01" [disabled]="desactive()" [value]="saisie().sousDetails[a.idArticle]?.rendement ?? 1" (input)="poserRendement(a, $any($event.target).valueAsNumber)" /></label>
      </div>
      <p class="text-sm ot__resultat">Déboursés secs D = {{ nombre(debourses(a)) }} Ar · prix = D × K1 / R = <strong>{{ calcule(a) == null ? '—' : nombre(calcule(a)!) + ' Ar' }}</strong> · bordereau : {{ prix()[a.idArticle] ? nombre(prix()[a.idArticle]!) + ' Ar' : '—' }}</p>
    }

    @if (lot().qualification; as q) {
      <h3 class="ot__h3">Capacités financières et techniques</h3>
      @if (q.chiffreAffaires?.montant) {
        <p class="text-sm">Chiffre d’affaires{{ q.chiffreAffaires!.domaine ? ' en ' + q.chiffreAffaires!.domaine : '' }} : moyenne des {{ q.chiffreAffaires!.meilleures || 'toutes les' }} meilleures des {{ annees().length }} dernières années ≥ <strong>{{ nombre(q.chiffreAffaires!.montant!) }} Ar</strong>.</p>
      }
      <div class="ot__grille">
        @for (an of annees(); track an) {
          <label class="form-group"><span class="form-label">Exercice {{ an }} (Ar)</span>
            <input class="form-control" type="number" min="0" step="1" [disabled]="desactive()" [value]="saisie().chiffresAffaires[an] ?? ''" (input)="poserCa(an, $any($event.target).valueAsNumber)" /></label>
        }
      </div>
      <p class="text-sm ot__resultat">Moyenne retenue : <strong>{{ moyenne() == null ? '—' : nombre(moyenne()!) + ' Ar' }}</strong></p>

      <p class="text-sm">Liquidité (attestation bancaire ou ligne de crédit) ≥ <strong>{{ seuil() == null ? '—' : nombre(seuil()!) + ' Ar' }}</strong>{{ q.liquiditePourcentage ? ' (' + q.liquiditePourcentage + ' % du TTC de votre offre)' : '' }}.</p>
      <div class="ot__grille">
        <label class="form-group"><span class="form-label">Montant attesté (Ar)</span><input class="form-control" type="number" min="0" step="1" [disabled]="desactive()" [value]="saisie().liquidite.montant ?? ''" (input)="poserLiquidite({ montant: nombreOuNul($any($event.target).valueAsNumber) })" /></label>
        <label class="form-group"><span class="form-label">Nature</span><input class="form-control" type="text" placeholder="ex. ligne de crédit" [disabled]="desactive()" [value]="saisie().liquidite.nature" (input)="poserLiquidite({ nature: $any($event.target).value })" /></label>
        <label class="form-group"><span class="form-label">Banque émettrice</span><input class="form-control" type="text" [disabled]="desactive()" [value]="saisie().liquidite.emetteur" (input)="poserLiquidite({ emetteur: $any($event.target).value })" /></label>
      </div>

      @if (q.references?.montant) {
        <p class="text-sm">Références : {{ q.references!.cumul ? 'au plus ' + q.references!.nombre + ' marchés similaires, d’un montant cumulé' : 'un marché similaire' }} ≥ <strong>{{ nombre(q.references!.montant!) }} Ar</strong>{{ q.references!.annees ? ', sur les ' + q.references!.annees + ' dernières années' : '' }}.</p>
      }
      @for (r of saisie().references; track $index; let i = $index) {
        <div class="ot__reference">
          <label class="form-group"><span class="form-label">Objet du marché</span><input class="form-control" type="text" [disabled]="desactive()" [value]="r.objet" (input)="poserReference(i, { objet: $any($event.target).value })" /></label>
          <label class="form-group"><span class="form-label">Maître d’ouvrage</span><input class="form-control" type="text" [disabled]="desactive()" [value]="r.maitreOuvrage" (input)="poserReference(i, { maitreOuvrage: $any($event.target).value })" /></label>
          <label class="form-group"><span class="form-label">Année de réception</span><input class="form-control" type="number" min="1990" step="1" [disabled]="desactive()" [value]="r.annee ?? ''" (input)="poserReference(i, { annee: nombreOuNul($any($event.target).valueAsNumber) })" /></label>
          <label class="form-group"><span class="form-label">Montant (Ar)</span><input class="form-control" type="number" min="0" step="1" [disabled]="desactive()" [value]="r.montant ?? ''" (input)="poserReference(i, { montant: nombreOuNul($any($event.target).valueAsNumber) })" /></label>
          <button type="button" class="btn btn-sm btn-outline ot__retirer" [disabled]="desactive()" [attr.aria-label]="'Retirer la référence ' + (i + 1)" (click)="retirerReference(i)">✕</button>
        </div>
      }
      <div class="ot__ligne-actions">
        <button type="button" class="btn btn-sm btn-secondary" [disabled]="desactive()" (click)="ajouterReference()">Ajouter une référence</button>
        <span class="text-sm">Retenu : <strong>{{ nombre(retenues()) }} Ar</strong></span>
      </div>
    }

    @if (besoin().personnel.length) {
      <h3 class="ot__h3">Personnel proposé</h3>
      @for (p of besoin().personnel; track p.idPersonnel) {
        <fieldset class="ot__bloc">
          <legend>{{ p.poste }} — {{ p.nombre ?? 1 }} personne(s)</legend>
          <p class="text-xs text-muted">{{ exigences(p) }}</p>
          @for (x of personnes(p); track $index; let i = $index) {
            <div class="ot__grille">
              <label class="form-group"><span class="form-label">Nom et prénoms</span><input class="form-control" type="text" [disabled]="desactive()" [value]="x.nom" (input)="poserPersonne(p, i, { nom: $any($event.target).value })" /></label>
              <label class="form-group"><span class="form-label">Diplôme</span><input class="form-control" type="text" [disabled]="desactive()" [value]="x.diplome" (input)="poserPersonne(p, i, { diplome: $any($event.target).value })" /></label>
              <label class="form-group"><span class="form-label">Années d’expérience</span><input class="form-control" type="number" min="0" step="1" [disabled]="desactive()" [value]="x.experienceAnnees ?? ''" (input)="poserPersonne(p, i, { experienceAnnees: nombreOuNul($any($event.target).valueAsNumber) })" /></label>
            </div>
          }
        </fieldset>
      }
    }

    @if (besoin().materiel.length) {
      <h3 class="ot__h3">Matériel proposé</h3>
      <div class="cnm-table-wrap">
        <table class="cnm-table">
          <thead><tr><th scope="col">Matériel exigé</th><th scope="col" class="cnm-num">Nombre</th><th scope="col" class="cnm-num">Dont en propre</th><th scope="col">Matériel proposé</th><th scope="col" class="cnm-num">Nombre proposé</th><th scope="col" class="cnm-num">Dont en propre</th></tr></thead>
          <tbody>
            @for (x of besoin().materiel; track x.idMateriel) {
              <tr>
                <th scope="row">{{ x.designation }}{{ x.caracteristique ? ' (' + x.caracteristique + ')' : '' }}</th>
                <td class="cnm-num">{{ x.nombre }}</td>
                <td class="cnm-num">{{ x.minimumEnPropre ?? '—' }}</td>
                <td><input class="form-control" type="text" [disabled]="desactive()" [attr.aria-label]="'Matériel proposé : ' + x.designation" [value]="saisie().materiel[x.idMateriel!]?.designation ?? x.designation" (input)="poserMateriel(x.idMateriel!, { designation: $any($event.target).value })" /></td>
                <td class="cnm-num"><input class="form-control ot__num" type="number" min="0" step="1" [disabled]="desactive()" [attr.aria-label]="'Nombre proposé : ' + x.designation" [value]="saisie().materiel[x.idMateriel!]?.nombre ?? ''" (input)="poserMateriel(x.idMateriel!, { nombre: nombreOuNul($any($event.target).valueAsNumber) })" /></td>
                <td class="cnm-num"><input class="form-control ot__num" type="number" min="0" step="1" [disabled]="desactive()" [attr.aria-label]="'Dont en propre : ' + x.designation" [value]="saisie().materiel[x.idMateriel!]?.enPropre ?? ''" (input)="poserMateriel(x.idMateriel!, { enPropre: nombreOuNul($any($event.target).valueAsNumber) })" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.6rem; }
    .ot__h3 { margin: 0.6rem 0 0; font-size: 0.9rem; color: var(--n-700); }
    /* Les en-têtes de ligne : le th global du design system est blanc, en capitales (prévu pour un thead coloré). */
    tbody th { color: var(--n-700); font-size: var(--text-sm); font-weight: 600; text-transform: none; letter-spacing: normal; white-space: normal; border-bottom: 1px solid var(--cnm-border); }
    .ot__num { width: 8rem; text-align: right; margin-left: auto; }
    .ot__unite { width: 5rem; }
    .ot__radios { border: 0; margin: 0; padding: 0; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); }
    .ot__radios legend { float: left; margin-right: 0.5rem; }
    .ot__resultat { margin: 0; }
    .ot__ligne-actions { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .ot__inline { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); }
    .ot__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: 0.5rem; }
    .ot__reference { display: grid; grid-template-columns: 2fr 1.5fr 9rem 11rem auto; gap: 0.5rem; align-items: end; }
    .ot__retirer { margin-bottom: 0.2rem; }
    .ot__bloc { border: 1px solid var(--n-200); border-radius: var(--radius-md); padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .ot__bloc legend { font-weight: 600; padding: 0 0.3rem; }
    @media (max-width: 700px) { .ot__reference { grid-template-columns: 1fr; } }
  `,
})
export class OffreTravauxFormulaires {
  readonly lot = input.required<LotBesoin>();
  readonly besoin = input.required<BesoinEnLigne>();
  readonly tauxTva = input.required<number>();
  /** Les prix unitaires saisis au bordereau, pour comparer les sous-détails. */
  readonly prix = input.required<Record<number, number | null>>();
  readonly totaux = input.required<TotauxOffre>();
  readonly dateLimite = input<string | null>(null);
  readonly desactive = input(false);
  readonly saisie = model.required<SaisieTravaux>();

  readonly tauxK1 = TAUX_K1;
  readonly natures = NATURES_DEBOURSE;
  readonly Math = Math;

  readonly k1 = computed(() => calculerK1(this.saisie(), this.tauxTva()));
  readonly sousDetail = computed(() => articlesSousDetail(this.lot()));
  readonly annees = computed(() => exercices(this.lot(), this.dateLimite()));
  readonly moyenne = computed(() => moyenneCa(this.lot(), this.saisie(), this.dateLimite()));
  readonly seuil = computed(() => seuilLiquidite(this.lot(), this.totaux().ttc));
  readonly retenues = computed(() => referencesRetenues(this.lot(), this.saisie(), this.dateLimite()));

  nombre(v: number | null | undefined): string {
    return v == null ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
  pct(v: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v)} %`;
  }
  nombreOuNul(v: number): number | null {
    return Number.isFinite(v) && v >= 0 ? v : null;
  }
  exigences(p: PersonnelExige): string {
    return [p.diplome, p.experienceAnnees ? `au moins ${p.experienceAnnees} ans${p.domaineExperience ? ' en ' + p.domaineExperience : ''}` : null, p.justificatifs].filter(Boolean).join(' ; ');
  }

  lignes(a: ArticleBesoin): LigneDebourse[] {
    return this.saisie().sousDetails[a.idArticle]?.lignes ?? [];
  }
  debourses(a: ArticleBesoin): number {
    return deboursesSecs(this.lignes(a));
  }
  calcule(a: ArticleBesoin): number | null {
    return prixSousDetail(this.saisie().sousDetails[a.idArticle], this.k1().k1);
  }
  personnes(p: PersonnelExige): PersonneSaisie[] {
    const n = Math.max(1, p.nombre ?? 1);
    const x = this.saisie().personnel[p.idPersonnel!] ?? [];
    return Array.from({ length: n }, (_, i) => x[i] ?? { nom: '', diplome: '', experienceAnnees: null });
  }

  poser(v: Partial<SaisieTravaux>): void {
    this.saisie.update((s) => ({ ...s, ...v }));
  }
  poserTaux(code: string, v: number): void {
    this.saisie.update((s) => ({ ...s, k1: { ...s.k1, [code]: this.nombreOuNul(v) } }));
  }
  private majSousDetail(a: ArticleBesoin, f: (sd: { rendement: number | null; lignes: LigneDebourse[] }) => { rendement: number | null; lignes: LigneDebourse[] }): void {
    this.saisie.update((s) => ({ ...s, sousDetails: { ...s.sousDetails, [a.idArticle]: f(s.sousDetails[a.idArticle] ?? { rendement: 1, lignes: [] }) } }));
  }
  ajouterLigne(a: ArticleBesoin): void {
    this.majSousDetail(a, (sd) => ({ ...sd, lignes: [...sd.lignes, { nature: 'MAIN_OEUVRE' as NatureDebourse, designation: '', unite: '', quantite: null, prixUnitaire: null }] }));
  }
  retirerLigne(a: ArticleBesoin, i: number): void {
    this.majSousDetail(a, (sd) => ({ ...sd, lignes: sd.lignes.filter((_, j) => j !== i) }));
  }
  poserLigne(a: ArticleBesoin, i: number, v: Partial<LigneDebourse>): void {
    this.majSousDetail(a, (sd) => ({ ...sd, lignes: sd.lignes.map((l, j) => (j === i ? { ...l, ...v } : l)) }));
  }
  poserRendement(a: ArticleBesoin, v: number): void {
    this.majSousDetail(a, (sd) => ({ ...sd, rendement: this.nombreOuNul(v) }));
  }
  poserCa(annee: number, v: number): void {
    this.saisie.update((s) => ({ ...s, chiffresAffaires: { ...s.chiffresAffaires, [annee]: this.nombreOuNul(v) } }));
  }
  poserLiquidite(v: Partial<SaisieTravaux['liquidite']>): void {
    this.saisie.update((s) => ({ ...s, liquidite: { ...s.liquidite, ...v } }));
  }
  ajouterReference(): void {
    this.saisie.update((s) => ({ ...s, references: [...s.references, { objet: '', maitreOuvrage: '', annee: null, montant: null }] }));
  }
  retirerReference(i: number): void {
    this.saisie.update((s) => ({ ...s, references: s.references.filter((_, j) => j !== i) }));
  }
  poserReference(i: number, v: Partial<ReferenceSaisie>): void {
    this.saisie.update((s) => ({ ...s, references: s.references.map((r, j) => (j === i ? { ...r, ...v } : r)) }));
  }
  poserPersonne(p: PersonnelExige, i: number, v: Partial<PersonneSaisie>): void {
    const liste = this.personnes(p).map((x, j) => (j === i ? { ...x, ...v } : x));
    this.saisie.update((s) => ({ ...s, personnel: { ...s.personnel, [p.idPersonnel!]: liste } }));
  }
  poserMateriel(id: number, v: Partial<SaisieTravaux['materiel'][number]>): void {
    this.saisie.update((s) => {
      const x = this.besoin().materiel.find((m) => m.idMateriel === id);
      const actuel = s.materiel[id] ?? { designation: x?.designation ?? '', nombre: null, enPropre: null };
      return { ...s, materiel: { ...s.materiel, [id]: { ...actuel, ...v } } };
    });
  }
}
