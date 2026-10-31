import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { QUESTIONS_CADRAGE, blocsASaisir, champsDeRubrique, cleValeur, lotsDuChamp, optionsChoisies, rubriqueOuverte } from '../../features/prmp/fiche-marche/fiche-marche-modele';
import { FicheBesoin } from '../../features/prmp/fiche-marche/fiche-besoin';
import { BlocFiche, Cadrage, ChampFiche, FicheMarche, InformationFicheModifiee, ReferentielFiche, RubriqueFiche } from '../../models';
import { ChampFicheMarcheService, FicheMarcheService } from '../../services/fiche-marche.services';
import { AUCUN_NUMERO, grouperNumeros, libelleObservations } from './document-officiel';

/** « 2170000 » → « 2 170 000 » (espaces simples, comme les documents produits — pas l'espace fine de `Intl`). */
function grouperMilliers(n: number): string {
  const [entier, decimales] = String(n).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decimales ? `${groupe},${decimales}` : groupe;
}

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
        <!-- ⚠️ 18/10 (pilote, lot A) — un en-tête de document : l'objet en titre, les métadonnées en pastilles, l'action de l'hôte
             (le DAO complet en PDF) projetée à droite. -->
        <header class="doc-entete fd-tete">
          <div class="fd-tete__texte">
            <p class="fd-tete__sur">Fiche DAO</p>
            <h2 class="doc-titre fd-tete__titre">{{ fiche()!.designationMarche }}</h2>
            <p class="doc-sous-titre fd-tete__puces">
              <span class="fd-puce">Version {{ fiche()!.version }}</span>
              <span class="fd-puce" [class.fd-puce--ok]="fiche()!.statut === 'VALIDEE'">{{ fiche()!.statut === 'VALIDEE' ? 'Validée' : 'Brouillon' }}</span>
              <!-- C'est la référence du PLAN qui porte la ligne, pas celle du dossier examiné : on le dit. -->
              <span class="fd-puce">Ligne du plan {{ fiche()!.refeDossier }}</span>
              @if (fiche()!.nbLots && fiche()!.nbLots! > 1) { <span class="fd-puce">{{ fiche()!.nbLots }} lots</span> }
              <span class="fd-puce fd-puce--discret">{{ blocs().length }} blocs · {{ nbInformations() }} informations</span>
            </p>
          </div>
          <div class="fd-tete__actions"><ng-content select="[ficheActions]" /></div>
        </header>
        <!-- ⚠️ 18/10 (pilote, lot B) — le sommaire des blocs, collant : un clic amène au bloc ; une pastille compte ses observations. -->
        <nav class="fd-sommaire" aria-label="Sommaire des blocs">
          @for (bloc of blocs(); track bloc.code) {
            <button type="button" class="fd-chip" (click)="allerBloc(bloc.code)" [attr.title]="bloc.libelle">
              <b>{{ bloc.code }}</b>{{ court(bloc.libelle) }}
              @if (bloc.rendu !== 'BESOIN' && obsDuBloc(bloc); as n) { <span class="fd-chip__obs">{{ n }}</span> }
            </button>
          }
        </nav>
        @for (bloc of blocs(); track bloc.code) {
          <section class="doc-bloc fd-carte" [attr.aria-labelledby]="'dao-' + bloc.code" [attr.data-bloc]="bloc.code">
            <h3 class="doc-bloc-titre fd-carte__tete" [id]="'dao-' + bloc.code">
              <span class="doc-bloc-code fd-code">{{ bloc.code }}</span>
              <span class="fd-carte__libelle">{{ bloc.libelle }}</span>
              @if (bloc.rendu !== 'BESOIN') {
                <span class="fd-carte__compte">
                  {{ infosDuBloc(bloc) }} information{{ infosDuBloc(bloc) > 1 ? 's' : '' }}
                  @if (obsDuBloc(bloc); as n) { · <b class="fd-carte__obs">{{ n }} observation{{ n > 1 ? 's' : '' }}</b> }
                </span>
              }
            </h3>
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
                  <!-- ⚠️ 18/10 (pilote) — la police de l'application et des filets légers, comme le besoin (B12) : la fiche est une saisie,
                       pas un document officiel imprimé (le DAO complet en est le rendu officiel). Les rubriques sont des intertitres de la carte. -->
                  <div class="doc-cadre">
                  <table class="doc-table doc-table--fiche">
                    <tbody>
                      @for (c of champs(bloc, r); track c.code) {
                        @for (lot of lotsDe(c); track lot) {
                          @let numeros = observationsDe(cle(c, lot));
                          @let modif = modifieeDe(cle(c, lot));
                          <tr>
                            <!-- L'espace avant le bloc est voulu : sans lui, le nom lu (« Montant de la garantielot 2 ») colle le lot au libellé. -->
                            <th scope="row" class="doc-lib">{{ c.libelle }} @if (lot !== null) {<span class="doc-lot">lot {{ lot }}</span>}</th>
                            <td
                              class="doc-cellule"
                              [class.doc-cellule--observable]="observable()"
                              [class.doc-cellule--observee]="numeros.length > 0"
                              [class.doc-cellule--modifiee]="!!modif"
                              [class.doc-cellule--citee]="citees().has(c.code)"
                              [attr.data-champ]="c.code"
                              [attr.title]="observable() ? 'Observer cette information' : null"
                              (click)="cliquer($event, c, lot)"
                            >
                              @if (valeur(c, lot); as v) { <span class="doc-val">{{ v }}</span> } @else { <span class="doc-val doc-val--vide">non renseigné</span> }
                              @if (modif && annotations()) {
                                <span class="doc-modif">modifiée — avant : « {{ modif.avant || '—' }} »</span>
                              }
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
                  </div>
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
    .doc-titre { margin: 0; font-weight: 500; font-size: 1.02rem; }
    .doc-sous-titre { margin: 0.15rem 0 0; color: var(--n-500); font-size: 0.86rem; }
    .doc-bloc { margin-top: 1rem; }
    .doc-bloc-titre { font-size: 0.92rem; margin: 0 0 0.35rem; }
    .doc-bloc-code { font-family: var(--font-mono, monospace); font-size: 0.78rem; color: var(--n-500); margin-right: 0.4rem; }
    .doc-rub { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-500); margin: 0.6rem 0 0.2rem; }
    /* ⚠️ 18/10 — le style « feuille officielle » (Arial, bordures noires) cède ici au style de l'application, comme B12 ; les règles
       d'observation de _document-officiel (cellule observable, pastilles) restent en vigueur. */
    .doc-cadre { background: var(--carte-fond); }
    /* ⚠️ 18/10 (pilote, lot A) — en-tête de document et blocs en cartes. */
    .fd-tete { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-bottom: 0.9rem; border-bottom: 1px solid var(--n-200); }
    .fd-tete__sur { margin: 0; font-size: 0.72rem; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: var(--texte); }
    .fd-tete__titre { text-transform: none; text-align: left; margin: 0.15rem 0 0; font-size: 1.15rem; font-weight: 500; letter-spacing: -0.01em; color: var(--texte); }
    .fd-tete__puces { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.55rem 0 0; }
    .fd-puce { padding: 0.1rem 0.55rem; border: 1px solid var(--n-300); border-radius: 999px; background: var(--carte-fond); font-size: 0.75rem; font-weight: 500; color: var(--texte); }
    .fd-puce--ok { border-color: var(--favorable-texte); background: var(--favorable-fond); color: var(--favorable-texte); }
    .fd-puce--discret { border-style: dashed; font-weight: 500; color: var(--texte-secondaire); }
    .fd-tete__actions { flex: none; display: flex; gap: 0.5rem; }
    .fd-carte { margin-top: 1rem; border: 1px solid var(--n-200); border-radius: 10px; background: var(--carte-fond); overflow: hidden; }
    .fd-carte__tete { display: flex; align-items: center; gap: 0.6rem; margin: 0; padding: 0.6rem 0.9rem; background: var(--carte-fond); border-bottom: 1px solid var(--n-200); font-size: 0.95rem; color: var(--texte); }
    .fd-code { padding: 0.05rem 0.45rem; border-radius: 6px; background: var(--section-fond); color: var(--texte-menu) !important; font-size: 0.72rem !important; margin-right: 0 !important; }
    .fd-carte__libelle { flex: 1; font-weight: 500; }
    .fd-carte__compte { font-size: 0.75rem; font-weight: 500; color: var(--texte-secondaire); }
    .fd-carte__obs { color: var(--examen-texte); }
    .fd-carte .doc-rub { margin: 0; padding: 0.55rem 0.9rem 0.25rem; }
    .doc-val--vide { color: var(--texte-secondaire); font-style: italic; }
    /* ⚠️ 18/10 (pilote, lot B) — sommaire collant, informations citées par le point ouvert, information visée surlignée. */
    .fd-sommaire { position: sticky; top: 0; z-index: 3; display: flex; gap: 0.3rem; margin: 0.6rem -0.25rem 0; padding: 0.45rem 0.25rem; background: var(--carte-fond); border-bottom: 1px solid var(--n-200); overflow-x: auto; }
    .fd-chip { flex: none; display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0.55rem; border: 1px solid var(--n-300); border-radius: 999px; background: var(--carte-fond); font: 500 0.74rem var(--font-base); color: var(--texte); cursor: pointer; white-space: nowrap; }
    .fd-chip b { font-family: var(--font-mono, monospace); font-size: 0.68rem; color: var(--texte); }
    .fd-chip:hover { border-color: var(--bouton-principal); color: var(--texte); }
    .fd-chip__obs { min-width: 1.05rem; padding: 0 0.3rem; border-radius: 999px; background: var(--examen-texte); color: var(--texte-menu); font-size: 0.64rem; text-align: center; }
    .fd-carte { scroll-margin-top: 3rem; }
    /* ⚠️ 18/10 (pilote) — la ligne citée par le point ouvert, en ORANGE et bien visible : barre épaisse, fond orangé sur toute la
       ligne (libellé compris), libellé en gras. Distincte de l'observation (pastille ambre numérotée). */
    .doc-table--fiche td.doc-cellule--citee { box-shadow:  inset 5px 0 0 var(--or); background: var(--examen-fond); font-weight: 500; }
    .doc-table--fiche tr:has(> td.doc-cellule--citee) > th.doc-lib { background: var(--or); color: var(--examen-texte); font-weight: 500; }
    .doc-table--fiche td.doc-flash, .fd-carte.doc-flash { background: var(--examen-fond) !important; transition: background 0.4s; }
    .doc-table--fiche { font: 0.84rem/1.45 var(--font-base); color: var(--texte); }
    .doc-table--fiche th, .doc-table--fiche td { border: 0; border-top: 1px solid var(--n-100); padding: 0.45rem 0.7rem; font-family: var(--font-base); color: var(--texte); background: var(--carte-fond); }
    .doc-table--fiche tbody tr:last-child > th, .doc-table--fiche tbody tr:last-child > td { border-bottom: 0; }
    .doc-table--fiche th.doc-lib { padding-left: 0.9rem; }
    .doc-table--fiche th.doc-lib { width: 38%; font-weight: 500; font-size: 0.8rem; text-align: left; vertical-align: top; color: var(--texte-secondaire); background: var(--carte-fond); border-right: 1px solid var(--n-200); }
    .doc-rub { color: var(--texte); font-weight: 500; }
    .doc-lot { margin-left: 0.4rem; font-size: 0.74rem; color: var(--n-500); border: 1px solid var(--n-300); border-radius: 999px; padding: 0 0.4rem; }
    .doc-val { white-space: pre-wrap; }
    .doc-cellule--modifiee { background: var(--onglet-actif-fond); box-shadow: inset 3px 0 0 var(--p-600); }
    .doc-modif { display: block; margin-top: 0.15rem; font-size: 0.74rem; color: var(--p-700); }
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
  /**
   * ⚠️ Lot C4 (V49, §B5) — en réexamen, les informations qui ont CHANGÉ entre la version examinée et la version
   * courante (`perimetre.ficheDao.informations`) : la cellule est marquée « modifiée », l'ancienne valeur en note.
   */
  readonly modifiees = input<readonly InformationFicheModifiee[]>([]);
  readonly annotations = input(true);
  /** ⚠️ 18/10 (lot B) — les informations citées par le point ouvert de la grille (code de champ) : liseré bleu. */
  readonly citees = input<ReadonlySet<string>>(new Set());
  /** ⚠️ 18/10 (lot B) — l'information (ou le bloc) à montrer : la fiche y défile et la surligne. Le jeton rejoue un même code. */
  readonly cible = input<{ code: string; jeton: number } | null>(null);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Le premier mot significatif d'un intitulé de bloc, pour le sommaire. */
  court(libelle: string): string {
    return (libelle.split(/[ ,&(]/).find((m) => m.length > 2) ?? libelle).replace(/[.:]$/, '');
  }
  allerBloc(code: string): void {
    this.hote.nativeElement.querySelector(`[data-bloc="${code}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  private readonly annonceCodes = effect(() => {
    const blocs = this.blocs();
    if (!blocs.length) return;
    const codes = new Set<string>(blocs.map((b) => b.code));
    for (const b of blocs) for (const r of this.rubriques(b)) for (const c of this.champs(b, r)) codes.add(c.code);
    this.codesRendus.emit(codes);
  });
  /**
   * ⚠️ 18/10 (pilote) — quand le point ouvert de la grille change, les informations qu'il cite viennent à l'écran d'elles-mêmes :
   * la fiche défile jusqu'à elles si elles n'y sont pas déjà (elles restent marquées du liseré bleu). La fiche peut se charger
   * encore : on attend les cellules, 2 s au plus.
   */
  private readonly suiviCitees = effect(() => {
    const codes = this.citees();
    if (!codes.size) return;
    let essais = 0;
    const amener = (): void => {
      const cellules = Array.from(this.hote.nativeElement.querySelectorAll<HTMLElement>('td.doc-cellule--citee'));
      if (!cellules.length) { if (++essais <= 20) setTimeout(amener, 100); return; }
      const zone = this.zoneDeDefilement(cellules[0]);
      const haut = zone ? zone.getBoundingClientRect().top : 0;
      const bas = zone ? zone.getBoundingClientRect().bottom : window.innerHeight;
      const visible = (el: HTMLElement): boolean => { const r = el.getBoundingClientRect(); return r.top >= haut + 48 && r.bottom <= bas - 8; };
      if (cellules.some(visible)) return;
      cellules[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    setTimeout(amener);
  });
  /** Le premier ancêtre qui défile (la zone document de l'hôte). */
  private zoneDeDefilement(el: HTMLElement): HTMLElement | null {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
  }
  private readonly suiviCible = effect(() => {
    const c = this.cible();
    if (!c) return;
    // La fiche peut se charger encore (onglet rouvert) : on attend l'information, 2 s au plus.
    let essais = 0;
    const chercher = (): void => {
      const racine = this.hote.nativeElement;
      const el = racine.querySelector<HTMLElement>(`td[data-champ="${c.code}"]`) ?? racine.querySelector<HTMLElement>(`[data-bloc="${c.code}"]`);
      if (!el) { if (++essais <= 20) setTimeout(chercher, 100); return; }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('doc-flash');
      setTimeout(() => el.classList.remove('doc-flash'), 1400);
    };
    setTimeout(chercher);
  });
  private readonly parCleModifiee = computed(() => new Map(this.modifiees().map((m) => [m.champFiche.toUpperCase(), m])));
  readonly celluleClick = output<CelluleFicheCliquee>();
  /** ⚠️ 18/10 (lot B) — les codes rendus par cette fiche (champs et blocs), une fois chargée : l'examen ne propose que ceux-là. */
  readonly codesRendus = output<ReadonlySet<string>>();

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
    const cle = this.cle(c, lot);
    const v = f.valeurs?.[cle];
    if (v == null) return '';
    if (c.type === 'LISTE_MULTIPLE') return optionsChoisies(v).join(', ');
    // Un montant se lit comme les documents l'impriment — et comme le serveur fige la valeur observée (V44) :
    // « 2 170 000 Ariary (deux millions cent soixante-dix mille ariary) », les lettres venant de `enLettres`.
    if (c.type === 'MONTANT' && v !== '' && Number.isFinite(Number(v))) {
      const lettres = f.enLettres?.[cle];
      return `${grouperMilliers(Number(v))} Ariary${lettres ? ` (${lettres})` : ''}`;
    }
    return String(v);
  }
  modifieeDe(cle: string): InformationFicheModifiee | null {
    return this.parCleModifiee().get(cle.toUpperCase()) ?? null;
  }
  /** Le nombre d'informations d'un bloc (une par lot quand le champ varie par lot). */
  infosDuBloc(bloc: BlocFiche): number {
    return this.rubriques(bloc).reduce((n, r) => n + this.champs(bloc, r).reduce((m, c) => m + this.lotsDe(c).length, 0), 0);
  }
  /** Le nombre d'informations du bloc qui portent une observation. */
  obsDuBloc(bloc: BlocFiche): number {
    return this.rubriques(bloc).reduce((n, r) => n + this.champs(bloc, r).reduce((m, c) => m + this.lotsDe(c).filter((l) => this.observationsDe(this.cle(c, l)).length > 0).length, 0), 0);
  }
  readonly nbInformations = computed(() => this.blocs().filter((b) => b.rendu !== 'BESOIN').reduce((n, b) => n + this.infosDuBloc(b), 0));
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
