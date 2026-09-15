import { ChangeDetectionStrategy, Component, OnInit, TemplateRef, computed, contentChild, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Marche, MarchePrevision, ServiceBeneficiaire, TypeChangementLigne } from '../../models';
import {
  CapmService,
  ModePassationService,
  NatureService,
  ReferenceLookupService,
  StatutMarcheService,
} from '../../services';
import { DocumentVisionneuse } from '../ui/document-visionneuse';
import { TexteCesure } from '../ui/texte-cesure';
import {
  AUCUN_NUMERO,
  BeneficiairePpmOfficiel,
  CHAMPS_PPM_BENEFICIAIRE,
  COLONNES_PPM_OFFICIEL,
  CelluleCliquee,
  ChampPpmOfficiel,
  GROUPE_BENEFICIAIRE_PPM,
  LIBELLES_ETAT_EXAMEN,
  LignePpmOfficielle,
  MARQUEUR_ETAT_EXAMEN,
  ObservationCellule,
  RowExamState,
  cleCellule,
  dateOfficielle,
  grouperNumeros,
  libelleObservations,
  montantOfficiel,
} from './document-officiel';

export type { RowExamState } from './document-officiel';

/** Ligne affichée : la ligne officielle + le marché d'origine quand il existe (contexte des actions). */
interface LigneAffichee extends LignePpmOfficielle {
  source: Marche | null;
}

/** Classe d'alignement de chaque colonne officielle (règles de l'aperçu officiel). */
const CLASSE_COLONNE: Readonly<Record<ChampPpmOfficiel, string>> = {
  nature: 'doc-ancre-g',
  objet: '',
  montEstim: 'doc-num',
  nouvMontEstim: 'doc-num',
  mode: '',
  financement: '',
  soa: '',
  compte: '',
  montBenef: 'doc-num',
  nouvMontBenef: 'doc-num',
  lancement: 'doc-date',
  ouverture: 'doc-date',
  attribution: 'doc-date doc-ancre-d',
};

/**
 * Plan de passation au FORMAT DU PDF OFFICIEL (lecture seule) : les 13 colonnes du PDF, dans son
 * ordre et à ses largeurs, bordures noires, en-têtes gris clair. Réutilisable dans tous les écrans
 * et profils ; à envelopper dans `<app-document-visionneuse>` pour la présentation en feuille.
 *
 * Deux formes d'entrée : les données chargées (`marches`, `beneficiaires`, `previsions` — le
 * tableau résout lui-même nature / mode / CAPM / statut via le cache `ReferenceLookupService`), ou
 * des lignes déjà mises en forme (`lignes`, aperçu d'une saisie non enregistrée).
 *
 * ⚠️ 2026-09-14 (décision des chefs, refonte ergonomique lot 1) — ce que l'application ajoute au
 * document est une ANNOTATION, jamais une colonne, masquable d'un coup (`annotations`, ou
 * l'interrupteur de la visionneuse) :
 * - état d'examen (`rowStateFn`) → marqueur dans la marge gauche de la ligne ;
 * - statut du marché → étiquette dans la marge droite ;
 * - versionnement (`changements`) → surlignage de la ligne, légende, infobulle avant → après ;
 * - observations (`observations`) → cellule encadrée + pastille numérotée.
 */
@Component({
  selector: 'app-ppm-marches-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, TexteCesure],
  template: `
    <div
      class="doc-ppm"
      [class.doc-gouttiere-g]="avecMarqueurs()"
      [class.doc-gouttiere-d]="avecStatutsEnMarge()"
      [class.doc-annotations-masquees]="!annot()"
    >
      <!-- Légende du versionnement (annotation) : seulement si au moins une ligne diffère de la
           version précédente — le surlignage doit rester lisible dans TOUS les profils. -->
      @if (annot() && typesPresents().length) {
        <div class="doc-annot doc-legende">
          <span class="doc-legende__titre">{{ legendeTitre() }}</span>
          @for (t of typesPresents(); track t) {
            <span class="doc-legende__puce" [class]="'doc-chg--' + t.toLowerCase()">{{ chgLabel(t) }}</span>
          }
        </div>
      }
      <table class="doc-table doc-table--ppm">
        <colgroup>
          @for (c of colonnes; track c.champ) {
            <col [style.width.%]="c.largeur" />
          }
          <!-- Colonne d'outils des écrans d'édition : hors du document (la somme dépasse 100 %,
               le navigateur réduit les colonnes officielles en gardant leurs proportions). -->
          @if (actionsTpl()) { <col style="width: 9%" /> }
        </colgroup>
        <thead>
          <tr>
            @for (c of colonnes; track c.champ) {
              @if (!c.beneficiaire) {
                <th scope="col" rowspan="2" [appTexteCesure]="c.libelle"></th>
              } @else if (c.champ === premiereColonneBenef) {
                <th scope="col" [attr.colspan]="colonnesBenef.length" [appTexteCesure]="groupeBenef"></th>
              }
            }
            @if (actionsTpl()) { <th scope="col" rowspan="2" class="doc-hors-feuille">ACTIONS</th> }
          </tr>
          <tr>
            @for (c of colonnesBenef; track c.champ) {
              <th scope="col" [appTexteCesure]="c.libelle"></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (m of rows(); track m.idDetail) {
            @let etatLigne = etatDe(m);
            @for (b of m.beneficiaires; track $index; let first = $first) {
              <tr
                [class]="classeLigne(m)"
                [class.doc-ligne--cliquable]="!!rowStateFn() && etatLigne !== 'hors'"
                [attr.title]="annot() ? detailDe(m) : null"
                (click)="onRowClick(m)"
              >
                <!-- Une cellule par colonne officielle, dans l'ordre du PDF : les colonnes du marché
                     n'existent qu'à la première rangée (rowspan), celles du bénéficiaire à chacune. -->
                @for (c of colonnes; track c.champ) {
                  @if (first || c.beneficiaire) {
                    @let cel = celluleAnnotee(m, c.champ, b, first);
                    @let obs = cel.pastilles;
                    <!-- Clic de cellule : geste « Observer cette cellule » de l'examen (sans écouteur,
                         sans effet). Le clic de LIGNE, sur la rangée, reste émis ensuite. -->
                    <td
                      [attr.rowspan]="c.beneficiaire ? null : m.beneficiaires.length"
                      [attr.data-champ]="c.champ"
                      [class]="classeColonne[c.champ]"
                      [class.doc-cellule--observee]="cel.encadree"
                      [class.doc-cellule--observable]="estObservable(m)"
                      (click)="cliquerCellule($event, m, b, c.champ)"
                    >
                      @if (c.champ === 'nature' && annot() && etatLigne) {
                        <span
                          class="doc-annot doc-marqueur"
                          [class]="'doc-marqueur--' + marqueurEtat[etatLigne]"
                          role="img"
                          [attr.aria-label]="libelleEtat[etatLigne]"
                          [attr.title]="libelleEtat[etatLigne]"
                        ></span>
                      }
                      @if (obs.length) {
                        <span class="doc-annot doc-pastilles" role="img" [attr.aria-label]="libelleObs(obs)">
                          @for (n of obs; track n) { <span class="doc-pastille" aria-hidden="true">{{ n }}</span> }
                        </span>
                      }
                      <!-- Textes : écrits mot à mot (TexteCesure) — un mot ne se coupe que s'il est plus
                           large que sa colonne, à une syllabe, avec un trait d'union. L'objet garde les
                           retours à la ligne de la saisie. Montants et dates ont leurs propres coupures. -->
                      @if (c.champ === 'objet') {
                        <span class="doc-objet" [appTexteCesure]="m.objet"></span>
                      } @else if (estColonneDate(c.champ)) {
                        <!-- Date « jj/mm/ » + « aaaa » : dans une colonne étroite (examen à 1366 px, grille
                             ouverte), elle revient à la ligne après le mois au lieu de déborder. -->
                        @let d = valeur(m, b, c.champ);
                        {{ d.slice(0, 6) }}<wbr />{{ d.slice(6) }}
                      } @else if (classeColonne[c.champ] === 'doc-num') {
                        {{ valeur(m, b, c.champ) }}
                      } @else {
                        <span class="doc-texte" [appTexteCesure]="valeur(m, b, c.champ)"></span>
                      }
                      @if (c.champ === 'attribution' && avecStatutsEnMarge() && m.statut) {
                        <span class="doc-annot doc-statut" [attr.title]="'Statut du marché : ' + m.statut"><span class="cnm-sr-only">Statut du marché : </span><span [appTexteCesure]="m.statut"></span></span>
                      }
                    </td>
                  }
                }
                @if (first && actionsTpl(); as tpl) {
                  <td [attr.rowspan]="m.beneficiaires.length" class="doc-hors-feuille">
                    @if (annot() && m.statut) {
                      <span class="doc-annot doc-statut" [attr.title]="'Statut du marché : ' + m.statut"><span class="cnm-sr-only">Statut du marché : </span>{{ m.statut }}</span>
                    }
                    @if (m.source) {
                      <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: m.source }" />
                    }
                  </td>
                }
              </tr>
            }
          } @empty {
            <tr><td class="doc-vide" [attr.colspan]="colonnes.length + (actionsTpl() ? 1 : 0)">{{ messageVide() }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  // Présentation : styles/_document-officiel.scss (globale, partagée avec la fiche, l'AGPM et
  // l'aperçu de la saisie). Rien de propre ici, pour que le document ait un seul rendu.
})
export class PpmMarchesTable implements OnInit {
  /** Marchés à afficher (déjà chargés par l'écran appelant). */
  readonly marches = input<Marche[]>([]);
  /** Services bénéficiaires de ces marchés (tous marchés confondus ; regroupés par idDetail en interne). */
  readonly beneficiaires = input<ServiceBeneficiaire[]>([]);
  /** Dates prévisionnelles de ces marchés (regroupées par idDetail en interne). */
  readonly previsions = input<MarchePrevision[]>([]);
  /**
   * Lignes DÉJÀ mises en forme (libellés résolus) — remplacent `marches`/`beneficiaires`/`previsions`
   * quand elles sont fournies. Sert à l'aperçu d'une saisie non enregistrée (pas de `Marche`, donc ni
   * actions ni clic de ligne).
   */
  readonly lignes = input<LignePpmOfficielle[] | null>(null);
  /** Colonne d'outils optionnelle, HORS document : template projeté `#rowActions` (contexte = le `Marche`). */
  readonly actionsTpl = contentChild<TemplateRef<unknown>>('rowActions');
  /**
   * État d'examen optionnel d'une ligne (examen séquentiel) → marqueur dans la marge gauche :
   * `current` (en cours), `done-ras`, `done-obs`, `pending` (à examiner), `hors` (hors examen).
   */
  readonly rowStateFn = input<((idDetail: number) => RowExamState | null) | null>(null);
  /** ⚠️ 2026-09-10 — inclure les lignes SUPPRIMÉES (examen d'une mise à jour : constat de retrait). Défaut : masquées. */
  readonly inclureSupprimees = input(false);
  /** Émis au clic sur une ligne (le `Marche` cliqué) — sert à rouvrir une ligne déjà examinée. Actif seulement si `rowStateFn` est fourni. */
  readonly rowClick = output<Marche>();
  /**
   * Versionnement (optionnel) : idDetail → type de changement vs la version précédente
   * (`GET /api/dossiers/{id}/diff`). Les lignes MODIFIEE / NOUVELLE / RESTAUREE sont surlignées et
   * légendées ; INCHANGEE reste neutre (les SUPPRIMEE ne figurent pas dans ce tableau).
   */
  readonly changements = input<Map<number, TypeChangementLigne> | null>(null);
  /** Titre de la légende du surlignage (« Mise à jour : » par défaut ; « Rectification : » au diff de rectification). */
  readonly legendeTitre = input('Mise à jour :');
  /**
   * Détail humain des champs changés par ligne (idDetail → « champ : avant → après ; … ») — affiché
   * en infobulle sur la ligne surlignée (2026-08-15, visibilité de la rectification au vérificateur).
   */
  readonly detailsChangements = input<Map<number, string> | null>(null);
  /** Annotations visibles (défaut). `false` = le document seul, tel que le PDF. */
  readonly annotations = input(true);
  /**
   * Observations posées sur des cellules (encadré ambre + pastille numérotée) — fournies par l'examen
   * (refonte, lot 2) depuis la cible des observations (`champ`, `idMarcheCible`, `idBenefCible`).
   */
  readonly observations = input<readonly ObservationCellule[]>([]);
  /**
   * Lignes dont les cellules proposent « Observer cette cellule » (survol + clic émis) — l'examen :
   * la ligne en cours, ou toutes à l'étape des contrôles du dossier. `null` = aucune.
   */
  readonly celluleObservableFn = input<((idDetail: number) => boolean) | null>(null);
  /** Clic sur une cellule d'une ligne enregistrée (`Marche`) : code, bénéficiaire, valeur affichée. */
  readonly celluleClick = output<CelluleCliquee>();
  /** Texte de la rangée affichée quand il n'y a aucune ligne. */
  readonly messageVide = input('Aucune ligne de marché.');

  /** Colonnes officielles (intitulés écrits mot à mot, césures syllabiques comprises : `TexteCesure`). */
  readonly colonnes = COLONNES_PPM_OFFICIEL;
  readonly colonnesBenef = this.colonnes.filter((c) => c.beneficiaire);
  readonly premiereColonneBenef = this.colonnesBenef[0]?.champ;
  readonly groupeBenef = GROUPE_BENEFICIAIRE_PPM;
  readonly classeColonne = CLASSE_COLONNE;
  readonly marqueurEtat = MARQUEUR_ETAT_EXAMEN;
  readonly libelleEtat = LIBELLES_ETAT_EXAMEN;

  private readonly lookups = inject(ReferenceLookupService);
  /** Visionneuse englobante éventuelle : son interrupteur « Annotations » s'applique à ce tableau. */
  private readonly visionneuse = inject(DocumentVisionneuse, { optional: true });
  private readonly natureMap = signal<Map<string, string>>(new Map());
  private readonly modeMap = signal<Map<string, string>>(new Map());
  private readonly capmMap = signal<Map<string, string>>(new Map());
  /** Statut de marché : code → libellé (référentiel administrable — pilote 2026-09-09). */
  private readonly statutMap = signal<Map<string, string>>(new Map());

  /** Annotations effectivement visibles : l'entrée du tableau ET l'interrupteur de la visionneuse. */
  readonly annot = computed(() => this.annotations() && (this.visionneuse?.annotations() ?? true));

  // ⚠️ Demande pilote (2026-09-03) — la colonne Mode n'affiche plus QUE le libellé : la dérivation
  // type DMC / catégorie / forme (badges) et son chargement (modes + types-dmc) ont été retirés.
  ngOnInit(): void {
    // Lignes déjà mises en forme (aperçu) : rien à résoudre, aucun référentiel à charger.
    if (this.lignes()) return;
    this.lookups.lookup(NatureService, 'idNature', ['libelle']).subscribe((m) => this.natureMap.set(m));
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.lookups.lookup(CapmService, 'idCapm', ['libelleProcessus']).subscribe((m) => this.capmMap.set(m));
    // ⚠️ Statut de marché (pilote 2026-09-09) : visible dans TOUT affichage du PPM, tous profils — en
    // annotation de marge depuis le 2026-09-14. Code → libellé résolu comme nature/mode.
    this.lookups.lookup(StatutMarcheService, 'code', ['libelle']).subscribe((m) => this.statutMap.set(m));
  }

  /** Lignes mises en forme (libellés résolus, bénéficiaires et dates regroupés par marché). */
  readonly rows = computed<LigneAffichee[]>(() => {
    const fournies = this.lignes();
    const lignes: LigneAffichee[] = fournies
      ? fournies.map((l) => ({ ...l, source: null }))
      : this.lignesDepuisMarches();
    return lignes.map((l) => (l.beneficiaires.length ? l : { ...l, beneficiaires: [{} as BeneficiairePpmOfficiel] }));
  });

  private lignesDepuisMarches(): LigneAffichee[] {
    const benefByDetail = new Map<number, ServiceBeneficiaire[]>();
    for (const b of this.beneficiaires()) {
      const l = benefByDetail.get(b.idDetail) ?? [];
      l.push(b);
      benefByDetail.set(b.idDetail, l);
    }
    const prevByDetail = new Map<number, MarchePrevision[]>();
    for (const p of this.previsions()) {
      const l = prevByDetail.get(p.idDetail) ?? [];
      l.push(p);
      prevByDetail.set(p.idDetail, l);
    }
    const capm = this.capmMap();
    // ⚠️ 2026-08-05 (versionnement des PPM) — une ligne SUPPRIMÉE d'une version est conservée en base
    // (restaurable, jamais effacée) mais ne fait plus partie du plan : elle est donc absente de toute
    // vue « officielle » du PPM (consultation, détail, dates prévisionnelles).
    // ⚠️ 2026-09-10 — sauf `inclureSupprimees` (examen d'une mise à jour) : les supprimées y sont montrées
    // pour le CONSTAT de retrait — c'est une annotation : annotations masquées, elles disparaissent.
    const avecSupprimees = this.inclureSupprimees() && this.annot();
    return this.marches()
      .filter((m) => avecSupprimees || !m.supprimee)
      .map((m) => {
        const prevs = prevByDetail.get(m.idDetail) ?? [];
        const dateDe = (kw: string): string => {
          const p = prevs.find((x) => (capm.get(String(x.idCapm)) ?? '').toUpperCase().includes(kw));
          return p ? dateOfficielle(p.dateDebut) : '';
        };
        return {
          source: m,
          idDetail: m.idDetail,
          nature: this.lbl(this.natureMap(), m.idNature),
          objet: m.designationMarche ?? '',
          montEstim: m.montEstim,
          nouvMontEstim: m.nouvMontEstim,
          mode: this.lbl(this.modeMap(), m.idMode),
          financement: m.financement ?? '',
          // Libellé du statut ; à défaut le code brut (statut désactivé/inconnu) ; vide si non renseigné.
          statut: m.statut ? this.statutMap().get(m.statut) ?? m.statut : '',
          beneficiaires: (benefByDetail.get(m.idDetail) ?? []).map((b) => ({
            idBenef: b.idBenef,
            soaCode: b.soaCode,
            numCompte: b.numCompte,
            ancMontBenef: b.ancMontBenef,
            nouvMontBenef: b.nouvMontBenef,
          })),
          dateLancement: dateDe('LANCEMENT'),
          dateOuverture: dateDe('OUVERTURE'),
          dateAttribution: dateDe('ATTRIBUTION'),
        };
      });
  }

  /** Marqueurs d'état présents → la gouttière gauche est réservée. */
  readonly avecMarqueurs = computed(() => this.annot() && !!this.rowStateFn() && this.rows().length > 0);
  /**
   * Statuts à poser en marge droite. Dans un écran d'édition, la colonne d'outils occupe cette marge :
   * le statut s'y range, et la gouttière n'est pas réservée.
   */
  readonly avecStatutsEnMarge = computed(() => this.annot() && !this.actionsTpl() && this.rows().some((r) => !!r.statut));

  /**
   * Observations indexées par cellule (`idDetail|champ|idBenef` → numéros triés). Le bénéficiaire
   * n'entre dans la clé que pour une colonne par bénéficiaire ; ailleurs, et sans cible, il vaut `*`.
   */
  private readonly observationsParCellule = computed(() =>
    grouperNumeros(
      this.observations(),
      (o) => cleCellule(o.idDetail, o.champ, CHAMPS_PPM_BENEFICIAIRE.includes(o.champ) ? o.idBenef : null),
      (o) => o.numero,
    ),
  );

  /** Numéros des observations d'une cellule (tableau partagé vide si aucune ou annotations masquées). */
  observationsDe(m: LignePpmOfficielle, champ: ChampPpmOfficiel): readonly number[] {
    if (!this.annot()) return AUCUN_NUMERO;
    return this.observationsParCellule().get(cleCellule(m.idDetail, champ)) ?? AUCUN_NUMERO;
  }

  /**
   * Annotation d'une cellule rendue. Colonne par bénéficiaire : la rangée d'un bénéficiaire est
   * encadrée par les observations qui le visent et par celles sans bénéficiaire ; ces dernières ne
   * posent leur pastille qu'une fois, sur la première rangée.
   */
  celluleAnnotee(m: LignePpmOfficielle, champ: ChampPpmOfficiel, b: BeneficiairePpmOfficiel, first: boolean): { encadree: boolean; pastilles: readonly number[] } {
    const communes = this.observationsDe(m, champ);
    if (!CHAMPS_PPM_BENEFICIAIRE.includes(champ) || b.idBenef == null || !this.annot()) {
      return { encadree: communes.length > 0, pastilles: first ? communes : AUCUN_NUMERO };
    }
    const propres = this.observationsParCellule().get(cleCellule(m.idDetail, champ, b.idBenef)) ?? AUCUN_NUMERO;
    const pastilles = first && communes.length ? [...new Set([...communes, ...propres])].sort((x, y) => x - y) : propres;
    return { encadree: communes.length > 0 || propres.length > 0, pastilles };
  }

  estColonneDate(champ: ChampPpmOfficiel): boolean {
    return champ === 'lancement' || champ === 'ouverture' || champ === 'attribution';
  }

  /** La ligne propose-t-elle « Observer cette cellule » ? */
  estObservable(m: LigneAffichee): boolean {
    const fn = this.celluleObservableFn();
    return !!fn && !!m.source && fn(m.idDetail);
  }

  /** Clic sur une cellule : émis pour une ligne enregistrée, avec la valeur telle qu'affichée. */
  cliquerCellule(ev: MouseEvent, m: LigneAffichee, b: BeneficiairePpmOfficiel, champ: ChampPpmOfficiel): void {
    if (!m.source) return;
    this.celluleClick.emit({
      idDetail: m.idDetail,
      champ,
      idBenef: CHAMPS_PPM_BENEFICIAIRE.includes(champ) ? b.idBenef ?? null : null,
      valeur: this.valeur(m, b, champ),
      element: ev.currentTarget as HTMLElement,
    });
  }

  libelleObs(numeros: readonly number[]): string {
    return libelleObservations(numeros);
  }

  /** Valeur affichée d'une cellule, au format du document officiel. */
  valeur(m: LignePpmOfficielle, b: BeneficiairePpmOfficiel, champ: ChampPpmOfficiel): string {
    switch (champ) {
      case 'nature': return m.nature;
      case 'objet': return m.objet;
      case 'montEstim': return montantOfficiel(m.montEstim);
      case 'nouvMontEstim': return montantOfficiel(m.nouvMontEstim);
      case 'mode': return m.mode;
      case 'financement': return m.financement;
      case 'soa': return b.soaCode ?? '';
      case 'compte': return b.numCompte ?? '';
      case 'montBenef': return montantOfficiel(b.ancMontBenef);
      case 'nouvMontBenef': return montantOfficiel(b.nouvMontBenef);
      case 'lancement': return m.dateLancement;
      case 'ouverture': return m.dateOuverture;
      case 'attribution': return m.dateAttribution;
    }
  }

  /** Infobulle de la ligne : détail des champs changés, seulement si la ligne est surlignée. */
  detailDe(m: LignePpmOfficielle): string | null {
    return this.chg(m) ? this.detailsChangements()?.get(m.idDetail) ?? null : null;
  }

  /** État d'examen d'une ligne (délègue au `rowStateFn` fourni ; `null` si aucun). */
  etatDe(m: LignePpmOfficielle): RowExamState | null {
    const fn = this.rowStateFn();
    return fn ? fn(m.idDetail) : null;
  }
  /** Type de changement d'une ligne (hors INCHANGEE) — `null` si pas de diff fourni. */
  private chg(m: LignePpmOfficielle): TypeChangementLigne | null {
    const t = this.changements()?.get(m.idDetail);
    return t && t !== 'INCHANGEE' ? t : null;
  }
  /** Classes d'annotation de la ligne : en cours d'examen, changement de version, supprimée. */
  classeLigne(m: LigneAffichee): string {
    if (!this.annot()) return '';
    const chg = this.chg(m);
    return [
      this.etatDe(m) === 'current' ? 'doc-ligne--courante' : '',
      chg ? 'doc-chg--' + chg.toLowerCase() : '',
      m.source?.supprimee ? 'doc-ligne--supprimee' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }
  /** Types de changement présents parmi les lignes affichées (pilote la légende, dans un ordre stable). */
  readonly typesPresents = computed<TypeChangementLigne[]>(() => {
    const ch = this.changements();
    if (!ch) return [];
    const presents = new Set<TypeChangementLigne>();
    for (const m of this.rows()) {
      if (m.source?.supprimee) continue;
      const t = ch.get(m.idDetail);
      if (t && t !== 'INCHANGEE') presents.add(t);
    }
    return (['MODIFIEE', 'NOUVELLE', 'RESTAUREE'] as TypeChangementLigne[]).filter((t) => presents.has(t));
  });
  chgLabel(t: TypeChangementLigne): string {
    switch (t) {
      case 'MODIFIEE': return 'Modifiée';
      case 'NOUVELLE': return 'Nouvelle';
      case 'RESTAUREE': return 'Restaurée';
      default: return t;
    }
  }
  /** Clic sur une ligne : ne réémet que si un état séquentiel est actif ET la ligne n'est pas hors examen. */
  onRowClick(m: LigneAffichee): void {
    if (m.source && this.rowStateFn() && this.etatDe(m) !== 'hors') this.rowClick.emit(m.source);
  }

  private lbl(map: Map<string, string>, id?: number): string {
    return id === null || id === undefined ? '' : map.get(String(id)) ?? `#${id}`;
  }
  /** Montant au format du document officiel (conservé pour les appelants existants). */
  montantFmt(v?: number | null): string {
    return montantOfficiel(v);
  }
}
