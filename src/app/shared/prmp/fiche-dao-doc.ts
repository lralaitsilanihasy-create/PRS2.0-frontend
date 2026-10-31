import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
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

/** Vue « volets » (31/10) : une information de la fiche, telle qu'elle s'affiche (une par lot quand le champ varie par lot). */
interface InfoVolet {
  c: ChampFiche;
  lot: number | null;
  cle: string;
  valeur: string;
}
interface RubriqueVolet {
  r: RubriqueFiche;
  infos: InfoVolet[];
}
interface BlocVolet {
  bloc: BlocFiche;
  rubriques: RubriqueVolet[];
  total: number;
  remplis: number;
}
/** Écart entre les deux colonnes de la vue « volets » (px) : la navigation de page en dépend. */
const ECART_COLONNES = 18;
/** Comparaison de recherche : casse et accents ignorés. */
function pourChercher(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
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
  host: { '(window:resize)': 'mesurer()', '(keydown)': 'clavier($event)' },
  template: `
    @if (chargement()) {
      <p class="doc-etat" role="status">Chargement de la fiche DAO…</p>
    } @else if (erreur() || !fiche()) {
      <p class="doc-etat">La fiche DAO de ce dossier n'a pas pu être lue.</p>
    } @else if (vue() === 'volets') {
      <!-- ⚠️ 31/10 (pilote, maquette « Fiche DAO sans défilement », variante B) — la fenêtre de la page du dossier : le sommaire des blocs
           (noms complets) à gauche, UN bloc à droite en deux colonnes ; un bloc qui ne tient pas passe sur une page suivante plutôt
           qu'en défilement. Recherche dans toute la fiche, filtre « Non renseignées », « Copier », flèches du clavier. -->
      <div #volets class="fv" [style.height.px]="hauteur()">
        <div class="fv-outils">
          <label class="fv-recherche">
            <span aria-hidden="true">⌕</span>
            <input #champRecherche type="search" [value]="recherche()" (input)="recherche.set($any($event.target).value)"
                   placeholder="Chercher une information dans toute la fiche…" aria-label="Chercher une information dans toute la fiche" />
          </label>
          <div class="fv-filtres" role="group" aria-label="Informations affichées">
            <button type="button" class="fv-filtre" [attr.aria-pressed]="!seulementVides()" (click)="poserFiltre(false)">Toutes</button>
            <button type="button" class="fv-filtre" [attr.aria-pressed]="seulementVides()" (click)="poserFiltre(true)">Non renseignées</button>
          </div>
          <span class="fv-legende"><span><i class="fv-puce fv-puce--ok"></i>renseignée</span><span><i class="fv-puce fv-puce--vide"></i>à compléter</span></span>
        </div>
        <div class="fv-corps">
          <nav class="fv-rail" aria-label="Blocs de la fiche">
            <span class="fv-rail__titre">Blocs de la fiche</span>
            @for (v of vueBlocs(); track v.bloc.code; let k = $index) {
              <button type="button" class="fv-rail__nom" [attr.aria-current]="k === blocIndex() && !recherche().trim() ? 'true' : null"
                      [attr.title]="v.bloc.rendu === 'BESOIN' ? 'Expression du besoin' : v.total - v.remplis ? (v.total - v.remplis) + ' information(s) à saisir' : 'Bloc complet'"
                      (click)="choisirBloc(k)">{{ v.bloc.libelle }}</button>
            }
            <span class="fv-rail__aide"><kbd>↑</kbd> <kbd>↓</kbd> changer de bloc · <kbd>/</kbd> chercher</span>
          </nav>
          <section class="fv-bloc" aria-live="polite">
            @if (recherche().trim()) {
              <div class="fv-bloc__tete">
                <h3 class="fv-bloc__titre">Recherche « {{ recherche().trim() }} »</h3>
                <span class="fv-pill fv-pill--neutre">{{ resultats().length }} résultat{{ resultats().length > 1 ? 's' : '' }}</span>
              </div>
              <div class="fv-resultats">
                @for (r of resultats().slice(0, 12); track r.info.cle) {
                  <button type="button" class="fv-resultat" (click)="ouvrirResultat(r.k)">
                    <span class="fv-resultat__code">{{ r.code }}</span>
                    <span class="fv-resultat__texte">
                      <span class="fv-resultat__lib">{{ r.rubrique }} · {{ r.info.c.libelle }}@if (r.info.lot !== null) { — lot {{ r.info.lot }} }</span>
                      @if (r.info.valeur) { <span>{{ r.info.valeur }}</span> } @else { <span class="fv-vide">Non renseignée</span> }
                    </span>
                  </button>
                } @empty {
                  <p class="fv-etat">Aucune information ne contient ce texte.</p>
                }
                @if (resultats().length > 12) { <p class="fv-etat">… et {{ resultats().length - 12 }} autres : précisez la recherche.</p> }
              </div>
            } @else if (blocCourant(); as v) {
              <div class="fv-bloc__tete">
                <span class="fv-code">{{ v.bloc.code }}</span>
                <h3 class="fv-bloc__titre">{{ v.bloc.libelle }}</h3>
                @if (nbPages() > 1) { <span class="fv-pill fv-pill--neutre">page {{ page() + 1 }} / {{ nbPages() }}</span> }
                @if (v.bloc.rendu !== 'BESOIN') {
                  <span class="fv-pill" [class.fv-pill--ok]="v.remplis === v.total" [class.fv-pill--vide]="v.remplis < v.total">{{ v.remplis }} / {{ v.total }} renseignées</span>
                }
              </div>
              @if (v.bloc.rendu === 'BESOIN') {
                <!-- Le besoin est un tableau à lui seul (articles, quantités) : il garde son propre défilement. -->
                <div class="fv-besoin">
                  <app-fiche-besoin [idDmc]="idDmc()" [nbLots]="fiche()!.nbLots ?? 0" [saisieParLot]="fiche()!.saisieParLot === true"
                                    [typeMarche]="fiche()!.typeMarche" [lecture]="true" />
                </div>
              } @else if (rubriquesAffichees().length) {
                <div class="fv-cadre"><div #grille class="fv-grille">
                  @for (r of rubriquesAffichees(); track r.r.code) {
                    <section class="fv-rub">
                      <h4 class="fv-rub__titre"><span>{{ r.r.libelle }}</span><span>{{ r.infos.length }}</span></h4>
                      <dl class="fv-rub__liste">
                        @for (i of r.infos; track i.cle) {
                          @let numeros = observationsDe(i.cle);
                          <div class="fv-info" [class.fv-info--vide]="!i.valeur" [class.fv-info--citee]="citees().has(i.c.code)" [attr.data-champ]="i.c.code">
                            <dt>{{ i.c.libelle }}@if (i.lot !== null) { <span class="doc-lot">lot {{ i.lot }}</span> }</dt>
                            <dd [class.fv-long]="i.valeur.length > 260 && !deplies().has(i.cle)">{{ i.valeur || 'Non renseignée' }}</dd>
                            @if (i.valeur.length > 260 && !deplies().has(i.cle)) {
                              <button type="button" class="fv-suite" (click)="deplier(i.cle)">Lire la suite</button>
                            }
                            @if (numeros.length) { <span class="fv-obs">{{ libelleObs(numeros) }}</span> }
                            @if (i.valeur) {
                              <button type="button" class="fv-copier" [attr.aria-label]="'Copier « ' + i.c.libelle + ' »'" (click)="copier(i.cle, i.valeur)">
                                {{ copie() === i.cle ? 'Copié' : 'Copier' }}
                              </button>
                            }
                          </div>
                        }
                      </dl>
                    </section>
                  }
                </div></div>
              } @else {
                <p class="fv-etat">Toutes les informations de ce bloc sont renseignées.</p>
              }
              <div class="fv-nav">
                <button type="button" class="btn btn-outline btn-sm" [disabled]="!aPrecedent()" (click)="precedent()">‹ {{ libellePrecedent() }}</button>
                <span class="fv-nav__ou">Bloc {{ blocIndex() + 1 }} sur {{ vueBlocs().length }}@if (nbPages() > 1) { · page {{ page() + 1 }} / {{ nbPages() }} }</span>
                <button type="button" class="btn btn-primary btn-sm" [disabled]="!aSuivant()" (click)="suivant()">{{ libelleSuivant() }} ›</button>
              </div>
            }
          </section>
        </div>
      </div>
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
    .doc-bloc-code { font-family: var(--police-texte); font-size: 0.78rem; color: var(--n-500); margin-right: 0.4rem; }
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
    .fd-chip b { font-family: var(--police-texte); font-size: 0.68rem; color: var(--texte); }
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

    /* ⚠️ 31/10 (pilote) — vue « volets » de la fenêtre du dossier : rien ne défile, la hauteur est celle qui reste dans la fenêtre. */
    .fv { display: flex; flex-direction: column; min-height: 22rem; border: 1px solid var(--bordure); border-radius: 4px; overflow: hidden; background: var(--carte-fond); }
    .fv-outils { flex: none; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 7px 12px; background: var(--tableau-entete); border-bottom: 1px solid var(--bordure); }
    .fv-recherche { display: flex; align-items: center; gap: 6px; flex: 1 1 16rem; max-width: 26rem; height: 28px; padding: 0 9px; background: var(--carte-fond); border: 1px solid var(--bordure-champ); border-radius: 4px; color: var(--texte-secondaire); }
    .fv-recherche:focus-within { outline: 2px solid var(--bouton-principal); outline-offset: 1px; }
    .fv-recherche input { flex: 1; min-width: 0; border: 0; outline: none; font: inherit; background: transparent; color: var(--texte); }
    .fv-filtres { display: flex; gap: 4px; }
    .fv-filtre { padding: 3px 10px; border: 1px solid var(--bordure); border-radius: 14px; background: var(--carte-fond); color: var(--texte); font: inherit; font-size: 12px; cursor: pointer; }
    .fv-filtre[aria-pressed="true"] { background: var(--menu-fond); border-color: var(--menu-fond); color: var(--texte-menu); }
    .fv-filtre:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: 2px; }
    .fv-legende { margin-left: auto; display: flex; gap: 10px; font-size: 11px; color: var(--texte-secondaire); }
    .fv-legende > span { display: inline-flex; align-items: center; gap: 4px; }
    .fv-puce { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .fv-puce--ok { background: var(--favorable-texte); }
    .fv-puce--vide { background: var(--or); }
    .fv-corps { flex: 1; min-height: 0; display: grid; grid-template-columns: 18.5rem minmax(0, 1fr); }
    .fv-rail { display: flex; flex-direction: column; gap: 1px; padding: 8px 6px; background: var(--menu-fond); color: var(--texte-menu); min-height: 0; }
    .fv-rail__titre { padding: 2px 8px 6px; font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--texte-menu-secondaire); }
    .fv-rail__nom { display: block; padding: 5px 12px; border: 0; border-radius: 4px; background: transparent; color: var(--texte-menu); font: inherit; font-size: 12.5px; line-height: 1.3; text-align: left; cursor: pointer; }
    .fv-rail__nom:hover { background: var(--menu-survol); }
    .fv-rail__nom[aria-current="true"] { background: var(--onglet-actif-fond); color: var(--texte); font-weight: 500; box-shadow: inset 3px 0 0 var(--or); }
    .fv-rail__nom:focus-visible { outline: 2px solid var(--or); outline-offset: -2px; }
    .fv-rail__aide { margin-top: auto; padding: 6px 8px 2px; font-size: 11px; color: var(--texte-menu-secondaire); }
    .fv-rail__aide kbd, .fv kbd { font: inherit; font-size: 10.5px; padding: 0 4px; border: 1px solid var(--texte-menu-secondaire); border-radius: 3px; }
    .fv-bloc { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
    .fv-bloc__tete { flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--bordure); }
    .fv-code { padding: 2px 7px; border-radius: 3px; background: var(--section-fond); color: var(--texte-menu); font-size: 11px; font-weight: 500; }
    .fv-bloc__titre { margin: 0; flex: 1; min-width: 0; font-size: 15px; font-weight: 500; }
    .fv-pill { flex: none; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; white-space: nowrap; }
    .fv-pill--ok { background: var(--favorable-fond); color: var(--favorable-texte); }
    .fv-pill--vide { background: var(--examen-fond); color: var(--examen-texte); }
    .fv-pill--neutre { background: var(--neutre-fond); color: var(--neutre-texte); }
    /* Les rubriques coulent dans deux colonnes ; au-delà, des colonnes « de page suivante », amenées par la navigation (scrollLeft). */
    .fv-cadre { flex: 1; min-height: 0; margin: 10px 14px 0; overflow: hidden; }
    .fv-grille { height: 100%; columns: 2; column-gap: 18px; column-fill: auto; }
    .fv-rub { margin: 0 0 12px; border: 1px solid var(--bordure); border-radius: 4px; overflow: hidden; }
    .fv-rub__titre { display: flex; justify-content: space-between; gap: 8px; margin: 0; padding: 4px 10px; background: var(--tableau-entete); color: var(--neutre-texte); font-size: 10.5px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; break-after: avoid; }
    .fv-rub__liste { margin: 0; }
    .fv-info { position: relative; break-inside: avoid; padding: 5px 10px 6px 13px; border-top: 1px solid var(--bordure); }
    .fv-info:first-child { border-top: 0; }
    .fv-info::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--favorable-fond); }
    .fv-info:hover { background: var(--ligne-survol); }
    .fv-info dt { padding-right: 56px; font-size: 11px; color: var(--texte-secondaire); }
    .fv-info dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--texte); }
    .fv-info--vide::before { background: var(--or); }
    .fv-info--vide dd { color: var(--examen-texte); font-style: italic; }
    .fv-info--citee { background: var(--examen-fond); }
    .fv-long { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .fv-suite { padding: 0; border: 0; background: none; color: var(--texte); font: inherit; font-size: 11.5px; text-decoration: underline; text-decoration-color: var(--lien-soulignement); cursor: pointer; }
    .fv-obs { display: block; font-size: 11px; color: var(--examen-texte); }
    .fv-copier { position: absolute; right: 8px; top: 5px; padding: 0 6px; border: 1px solid var(--bordure); border-radius: 3px; background: var(--carte-fond); color: var(--texte); font: inherit; font-size: 11px; cursor: pointer; opacity: 0; }
    .fv-info:hover .fv-copier, .fv-copier:focus-visible { opacity: 1; }
    .fv-besoin { flex: 1; min-height: 0; overflow: auto; padding: 10px 14px; }
    .fv-resultats { flex: 1; min-height: 0; overflow: hidden; display: grid; gap: 6px; align-content: start; padding: 10px 14px; }
    .fv-resultat { display: grid; grid-template-columns: 3rem minmax(0, 1fr); gap: 8px; padding: 6px 10px; border: 1px solid var(--bordure); border-radius: 4px; background: var(--carte-fond); color: var(--texte); font: inherit; text-align: left; cursor: pointer; }
    .fv-resultat:hover { background: var(--ligne-survol); }
    .fv-resultat__code { font-weight: 500; }
    .fv-resultat__texte { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
    .fv-resultat__lib { font-size: 11px; color: var(--texte-secondaire); }
    .fv-vide { color: var(--examen-texte); font-style: italic; }
    .fv-etat { margin: 0; padding: 24px 14px; color: var(--texte-secondaire); }
    .fv-nav { flex: none; display: flex; align-items: center; gap: 10px; margin-top: auto; padding: 7px 14px; border-top: 1px solid var(--bordure); background: var(--tableau-entete); }
    .fv-nav__ou { margin: 0 auto; font-size: 12px; color: var(--texte-secondaire); }
    @media (max-width: 52rem) {
      .fv { height: auto !important; }
      .fv-corps { grid-template-columns: minmax(0, 1fr); }
      .fv-rail { flex-direction: row; overflow-x: auto; }
      .fv-rail__nom { white-space: nowrap; }
      .fv-rail__titre, .fv-rail__aide, .fv-legende { display: none; }
      .fv-cadre { overflow: visible; }
      .fv-grille { height: auto; columns: 1; transform: none !important; }
    }
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

  // ── ⚠️ 31/10 (pilote) — vue « volets » de la fenêtre du dossier ──────────────────────────────────────────────────────────
  /** `volets` : la fenêtre « Fiche DAO » de la page du dossier (sommaire + un bloc, sans défilement) ; `document` ailleurs (examen). */
  readonly vue = input<'document' | 'volets'>('document');
  private readonly voletsRef = viewChild<ElementRef<HTMLElement>>('volets');
  private readonly grilleRef = viewChild<ElementRef<HTMLElement>>('grille');
  private readonly rechercheRef = viewChild<ElementRef<HTMLInputElement>>('champRecherche');
  /** La hauteur qui reste dans la fenêtre sous l'en-tête de la fiche (px) ; nulle avant la première mesure. */
  readonly hauteur = signal<number | null>(null);
  readonly blocIndex = signal(0);
  readonly page = signal(0);
  readonly nbPages = signal(1);
  readonly recherche = signal('');
  readonly seulementVides = signal(false);
  readonly deplies = signal<ReadonlySet<string>>(new Set());
  readonly copie = signal<string | null>(null);

  readonly vueBlocs = computed<BlocVolet[]>(() => {
    if (this.vue() !== 'volets') return [];
    return this.blocs().map((bloc) => {
      const rubriques =
        bloc.rendu === 'BESOIN'
          ? []
          : this.rubriques(bloc)
              .map((r) => ({ r, infos: this.champs(bloc, r).flatMap((c) => this.lotsDe(c).map((lot) => ({ c, lot, cle: this.cle(c, lot), valeur: this.valeur(c, lot) }))) }))
              .filter((x) => x.infos.length);
      const infos = rubriques.flatMap((x) => x.infos);
      return { bloc, rubriques, total: infos.length, remplis: infos.filter((i) => !!i.valeur).length };
    });
  });
  readonly blocCourant = computed(() => this.vueBlocs()[this.blocIndex()] ?? null);
  readonly rubriquesAffichees = computed<RubriqueVolet[]>(() => {
    const v = this.blocCourant();
    if (!v) return [];
    if (!this.seulementVides()) return v.rubriques;
    return v.rubriques.map((x) => ({ r: x.r, infos: x.infos.filter((i) => !i.valeur) })).filter((x) => x.infos.length);
  });
  readonly resultats = computed(() => {
    const q = pourChercher(this.recherche().trim());
    if (!q) return [];
    return this.vueBlocs().flatMap((v, k) =>
      v.rubriques.flatMap((x) =>
        x.infos
          .filter((i) => pourChercher(i.c.libelle).includes(q) || pourChercher(i.valeur).includes(q))
          .map((info) => ({ k, code: v.bloc.code, rubrique: x.r.libelle, info })),
      ),
    );
  });
  readonly aPrecedent = computed(() => this.page() > 0 || this.blocIndex() > 0);
  readonly aSuivant = computed(() => this.page() < this.nbPages() - 1 || this.blocIndex() < this.vueBlocs().length - 1);
  readonly libellePrecedent = computed(() => {
    if (this.page() > 0) return `Page ${this.page()} du bloc`;
    const p = this.vueBlocs()[this.blocIndex() - 1];
    return p ? `${p.bloc.code} ${this.court(p.bloc.libelle)}` : 'Début';
  });
  readonly libelleSuivant = computed(() => {
    if (this.page() < this.nbPages() - 1) return `Suite du bloc (page ${this.page() + 2})`;
    const s = this.vueBlocs()[this.blocIndex() + 1];
    return s ? `${s.bloc.code} ${this.court(s.bloc.libelle)}` : 'Fin';
  });

  /** La fenêtre s'ouvre : on mesure la place qui reste (après l'animation d'ouverture aussi). */
  private readonly suiviHauteur = effect(() => {
    if (this.vue() !== 'volets' || this.chargement() || !this.fiche()) return;
    setTimeout(() => this.mesurer());
    setTimeout(() => this.mesurer(), 400);
  });
  /** Bloc, filtre, hauteur ou page changés : on recompte les pages et on amène la page courante. */
  private readonly suiviPages = effect(() => {
    this.rubriquesAffichees();
    this.hauteur();
    this.deplies();
    this.page();
    this.recherche();
    setTimeout(() => this.paginer());
  });

  mesurer(): void {
    if (this.vue() !== 'volets') return;
    const el = this.voletsRef()?.nativeElement;
    if (!el) return;
    const corps = el.closest('.modal-body');
    const bas = corps ? corps.getBoundingClientRect().bottom : window.innerHeight;
    // 18 px : la marge basse de la section qui accueille la fiche, et une marge de sûreté contre un défilement d'un pixel.
    this.hauteur.set(Math.max(352, Math.floor(bas - el.getBoundingClientRect().top - 18)));
  }
  /**
   * Les rubriques coulent dans deux colonnes ; ce qui ne tient pas forme des colonnes au-delà, que le cadre masque. Une « page » = deux
   * colonnes : on les compte, et on amène la page courante en TRANSLATANT la grille — pas par scrollLeft, que le navigateur borne quand
   * la dernière page n'a qu'une colonne (elle reprenait alors une colonne de la page précédente). Aucune barre de défilement.
   */
  private paginer(): void {
    const g = this.grilleRef()?.nativeElement;
    if (!g) {
      if (this.nbPages() !== 1) this.nbPages.set(1);
      return;
    }
    const pas = g.clientWidth + ECART_COLONNES;
    const n = Math.max(1, Math.ceil((g.scrollWidth + ECART_COLONNES) / pas - 0.01));
    if (n !== this.nbPages()) this.nbPages.set(n);
    if (this.page() >= n) {
      this.page.set(n - 1);
      return;
    }
    g.style.transform = this.page() ? `translateX(-${this.page() * pas}px)` : '';
  }
  choisirBloc(k: number): void {
    this.blocIndex.set(k);
    this.page.set(0);
    this.recherche.set('');
  }
  poserFiltre(vides: boolean): void {
    this.seulementVides.set(vides);
    this.page.set(0);
  }
  suivant(): void {
    if (this.page() < this.nbPages() - 1) this.page.update((p) => p + 1);
    else if (this.blocIndex() < this.vueBlocs().length - 1) this.choisirBloc(this.blocIndex() + 1);
  }
  precedent(): void {
    if (this.page() > 0) this.page.update((p) => p - 1);
    else if (this.blocIndex() > 0) this.choisirBloc(this.blocIndex() - 1);
  }
  ouvrirResultat(k: number): void {
    this.choisirBloc(k);
  }
  deplier(cle: string): void {
    this.deplies.update((s) => new Set(s).add(cle));
  }
  copier(cle: string, valeur: string): void {
    void navigator.clipboard?.writeText(valeur).then(
      () => this.copie.set(cle),
      () => this.copie.set(null),
    );
  }
  /** Flèches : bloc ou page suivant/précédent ; « / » : la recherche ; Échap dans la recherche la vide (puis la fenêtre se ferme). */
  clavier(e: KeyboardEvent): void {
    if (this.vue() !== 'volets') return;
    const cible = e.target as HTMLElement | null;
    if (cible?.tagName === 'INPUT') {
      if (e.key === 'Escape' && this.recherche()) {
        this.recherche.set('');
        e.stopPropagation();
      }
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      this.rechercheRef()?.nativeElement.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      this.suivant();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this.precedent();
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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
