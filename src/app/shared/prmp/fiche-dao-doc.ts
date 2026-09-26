import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { QUESTIONS_CADRAGE, blocsASaisir, champsDeRubrique, cleValeur, lotsDuChamp, optionsChoisies, rubriqueOuverte } from '../../features/prmp/fiche-marche/fiche-marche-modele';
import { FicheBesoin } from '../../features/prmp/fiche-marche/fiche-besoin';
import { BlocFiche, Cadrage, ChampFiche, FicheMarche, ReferentielFiche, RubriqueFiche } from '../../models';
import { ChampFicheMarcheService, FicheMarcheService } from '../../services/fiche-marche.services';
import { AUCUN_NUMERO, grouperNumeros, libelleObservations } from './document-officiel';

/** Une information de la fiche DAO cliquée par l'examinateur : de quoi ancrer une observation (contrat V44). */
export interface CelluleFicheCliquee {
  idDmc: number;
  /** La clé de l'information : `B04-VO-01`, ou `B05-GS-03#2` pour celle d'un lot. */
  champFiche: string;
  lot: number | null;
  libelle: string;
  valeur: string;
  element: HTMLElement;
}

/** Une observation déjà posée sur une information de la fiche (pastille numérotée sur la cellule). */
export interface ObservationCelluleFiche {
  champFiche: string;
  numero: number;
}

/**
 * ⚠️ Lot B de l'examen (26/09) — **la fiche DAO comme document de l'examen**, aux côtés du plan, de la fiche de
 * présentation et de l'AGPM : la Commission la lit dans le panneau des documents et, d'un clic sur une
 * information, ouvre la proposition « Observer » de l'examen avec l'ancrage (`idDmc`, `champFiche`) déjà rempli.
 * Même patron que `app-fiche-presentation-doc` : cellules observables au survol, pastilles numérotées, aucune
 * écriture ici — c'est l'examen qui pose la ligne.
 *
 * Le document se charge lui-même (fiche, puis référentiel de sa forme et de sa catégorie) : l'examen n'a que
 * l'`idDmc` du dossier. Une information est une cellule par lot quand le champ varie par lot (`CODE#n`).
 */
@Component({
  selector: 'app-fiche-dao-doc',
  standalone: true,
  imports: [FicheBesoin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chargement()) {
      <p class="doc-etat" role="status">Chargement de la fiche DAO…</p>
    } @else if (erreur() || !fiche()) {
      <p class="doc-etat">La fiche DAO de ce dossier n'a pas pu être lue.</p>
    } @else {
      <article class="doc doc-dao">
        <header class="doc-entete">
          <p class="doc-titre">Fiche DAO — {{ fiche()!.designationMarche }}</p>
          <p class="doc-sous-titre">
            {{ fiche()!.refeDossier }} · version {{ fiche()!.version }} · {{ fiche()!.statut === 'VALIDEE' ? 'validée' : 'brouillon' }}
            @if (fiche()!.nbLots && fiche()!.nbLots! > 1) { · {{ fiche()!.nbLots }} lots }
          </p>
        </header>
        @for (bloc of blocs(); track bloc.code) {
          <section class="doc-bloc" [attr.aria-labelledby]="'dao-' + bloc.code">
            <h3 class="doc-bloc-titre" [id]="'dao-' + bloc.code"><span class="doc-bloc-code">{{ bloc.code }}</span> {{ bloc.libelle }}</h3>
            @if (bloc.rendu === 'BESOIN') {
              <!-- Le besoin n'est pas fait de champs : il se lit, il ne s'observe pas cellule par cellule (lot B). -->
              <app-fiche-besoin
                [idDmc]="idDmc()"
                [nbLots]="fiche()!.nbLots ?? 0"
                [saisieParLot]="fiche()!.saisieParLot === true"
                [typeMarche]="fiche()!.typeMarche"
                [lecture]="true"
              />
            } @else {
              @for (r of rubriques(bloc); track r.code) {
                @if (champs(bloc, r).length) {
                  <h4 class="doc-rub">{{ r.libelle }}</h4>
                  <table class="doc-table doc-table--fiche">
                    <tbody>
                      @for (c of champs(bloc, r); track c.code) {
                        @for (lot of lotsDe(c); track lot) {
                          @let numeros = observationsDe(cle(c, lot));
                          <tr>
                            <!-- L'espace avant le bloc est voulu : sans lui, le nom lu (« Montant de la garantielot 2 ») colle le lot au libellé. -->
                            <th scope="row" class="doc-lib">{{ c.libelle }} @if (lot !== null) {<span class="doc-lot">lot {{ lot }}</span>}</th>
                            <td
                              class="doc-cellule"
                              [class.doc-cellule--observable]="observable()"
                              [class.doc-cellule--observee]="numeros.length > 0"
                              [attr.title]="observable() ? 'Observer cette information' : null"
                              (click)="cliquer($event, c, lot)"
                            >
                              <span class="doc-val">{{ valeur(c, lot) || '—' }}</span>
                              @if (numeros.length) {
                                <span class="doc-pastilles" aria-hidden="true">
                                  @for (n of numeros; track n) { <span class="doc-pastille">{{ n }}</span> }
                                </span>
                                <span class="doc-sr">{{ libelleObs(numeros) }}</span>
                              }
                            </td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                }
              }
            }
          </section>
        }
      </article>
    }
  `,
  styles: [`
    .doc-dao { padding: 0.25rem 0 1rem; }
    .doc-entete { margin-bottom: 0.8rem; }
    .doc-titre { margin: 0; font-weight: 700; font-size: 1.02rem; }
    .doc-sous-titre { margin: 0.15rem 0 0; color: var(--n-500); font-size: 0.86rem; }
    .doc-bloc { margin-top: 1rem; }
    .doc-bloc-titre { font-size: 0.92rem; margin: 0 0 0.35rem; }
    .doc-bloc-code { font-family: var(--font-mono, monospace); font-size: 0.78rem; color: var(--n-500); margin-right: 0.4rem; }
    .doc-rub { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-500); margin: 0.6rem 0 0.2rem; }
    .doc-table--fiche th.doc-lib { width: 38%; font-weight: 500; text-align: left; vertical-align: top; color: var(--n-600); }
    .doc-lot { margin-left: 0.4rem; font-size: 0.74rem; color: var(--n-500); border: 1px solid var(--n-300); border-radius: 999px; padding: 0 0.4rem; }
    .doc-val { white-space: pre-wrap; }
    .doc-etat { color: var(--n-500); font-size: 0.9rem; }
    .doc-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
  `],
})
export class FicheDaoDoc {
  private readonly fiches = inject(FicheMarcheService);
  private readonly champsService = inject(ChampFicheMarcheService);

  readonly idDmc = input.required<number>();
  /** Les cellules proposent « Observer » : l'examen le dit quand l'examinateur peut encore écrire une ligne. */
  readonly observable = input(false);
  readonly observations = input<readonly ObservationCelluleFiche[]>([]);
  readonly annotations = input(true);
  readonly celluleClick = output<CelluleFicheCliquee>();

  readonly fiche = signal<FicheMarche | null>(null);
  readonly referentiel = signal<ReferentielFiche | null>(null);
  readonly chargement = signal(true);
  readonly erreur = signal(false);

  readonly blocs = computed<BlocFiche[]>(() => {
    const ref = this.referentiel();
    const f = this.fiche();
    return ref && f ? blocsASaisir(ref, f.typeMarche) : [];
  });
  /** Le cadrage effectif : les réponses, plus la forme et la catégorie de la ligne — comme l'écran de saisie. */
  private readonly cadrage = computed<Cadrage>(() => {
    const f = this.fiche();
    return f ? { ...f.cadrage, typeMarche: f.typeMarche, categorie: f.categorie ?? null } : {};
  });
  private readonly parCle = computed(() =>
    grouperNumeros(this.observations(), (o) => o.champFiche.toUpperCase(), (o) => o.numero),
  );

  constructor() {
    effect(() => {
      const id = this.idDmc();
      this.chargement.set(true);
      this.erreur.set(false);
      this.fiches
        .lire(id)
        .pipe(
          switchMap((f) => this.champsService.referentiel(f.typeMarche ?? undefined, f.categorie ?? null).pipe(map((ref) => ({ f, ref })))),
          catchError(() => of(null)),
        )
        .subscribe((r) => {
          if (r) {
            this.fiche.set(r.f);
            this.referentiel.set(r.ref);
          } else {
            this.erreur.set(true);
          }
          this.chargement.set(false);
        });
    });
  }

  rubriques(bloc: BlocFiche): RubriqueFiche[] {
    const ref = this.referentiel();
    if (!ref) return [];
    return [...bloc.rubriques].sort((a, b) => a.rang - b.rang).filter((r) => rubriqueOuverte(ref.champs, bloc.code, r, this.cadrage()));
  }
  champs(bloc: BlocFiche, r: RubriqueFiche): ChampFiche[] {
    const ref = this.referentiel();
    return ref ? champsDeRubrique(ref.champs, bloc.code, r.code, this.cadrage()).filter((c) => c.type !== 'PIECE') : [];
  }
  lotsDe(c: ChampFiche): (number | null)[] {
    const f = this.fiche();
    return lotsDuChamp(c, f?.saisieParLot === true, f?.nbLots ?? 0);
  }
  cle(c: ChampFiche, lot: number | null): string {
    return cleValeur(c.code, lot);
  }
  /** La valeur telle que l'écran de saisie l'affiche : PPM, cadrage (en clair), ou saisie — une liste multiple en clair aussi. */
  valeur(c: ChampFiche, lot: number | null): string {
    const f = this.fiche();
    if (!f) return '';
    if (c.source === 'PPM') return String(f.valeursPpm?.[c.code] ?? '');
    if (c.source === 'CADRAGE') {
      const v = f.valeursCadrage?.[c.code];
      if (v == null) return '';
      const q = QUESTIONS_CADRAGE.find((x) => x.cle === c.cleCadrage);
      return q?.options.find((o) => o.code === String(v))?.libelle ?? String(v);
    }
    const v = f.valeurs?.[this.cle(c, lot)];
    if (v == null) return '';
    return c.type === 'LISTE_MULTIPLE' ? optionsChoisies(v).join(', ') : String(v);
  }
  observationsDe(cle: string): readonly number[] {
    if (!this.annotations()) return AUCUN_NUMERO;
    return this.parCle().get(cle.toUpperCase()) ?? AUCUN_NUMERO;
  }
  libelleObs(numeros: readonly number[]): string {
    return libelleObservations(numeros);
  }
  cliquer(ev: MouseEvent, c: ChampFiche, lot: number | null): void {
    if (!this.observable()) return;
    this.celluleClick.emit({
      idDmc: this.idDmc(),
      champFiche: this.cle(c, lot),
      lot,
      libelle: c.libelle,
      valeur: this.valeur(c, lot),
      element: ev.currentTarget as HTMLElement,
    });
  }
}
