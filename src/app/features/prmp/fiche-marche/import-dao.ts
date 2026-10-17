import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError, corpsErreur, erreursParChamp } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { TYPES_DOCX, TYPES_PDF, validerFichier } from '../../../core/securite/fichiers-surs';
import { ArticleFiche, ArticleImport, BlocFiche, CategorieDao, ChampFiche, ConfianceImport, CritereIdentite, EtatCritere, FicheMarche, ImportDaoResult, PassageImport, PropositionImport, ReponseCadrageImport, TypeMarche } from '../../../models';
import { FicheMarcheService } from '../../../services/fiche-marche.services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { Icone } from '../../../shared/ui/icone';
import { QUESTIONS_CADRAGE } from './fiche-marche-modele';

/**
 * Les couples (catégorie, forme) dont le serveur sait lire le DAO : ceux dont le document type est décrit (lot D).
 * Miroir de `ModelesDao.COUVERTURES` ; un couple absent d'ici qui deviendrait lisible le dirait par le 422
 * `MODELE_ABSENT`. Fournitures : contrat-cadre (D1), quantité fixe et à commande (D2, 29/09). Prestations
 * intellectuelles : quantité fixe et à commande (D3, 29/09 — il n'existe pas de contrat-cadre de PI). Travaux : les trois
 * formes (D4, 30/09 — le contrat-cadre de travaux sur le document type du contrat-cadre).
 */
export const IMPORTABLES: Readonly<Partial<Record<CategorieDao, readonly TypeMarche[]>>> = {
  FOURNITURES_SERVICES: ['CONTRAT_CADRE', 'QUANTITE_FIXE', 'A_COMMANDE'],
  PRESTATIONS_INTELLECTUELLES: ['QUANTITE_FIXE', 'A_COMMANDE'],
  // ⚠️ 30/09 (lot D4, T-3) — travaux : marché ordinaire (DPAO-T, AE-T, CCAP-T) et contrat-cadre (DPAC-CC, AE-CC).
  TRAVAUX: ['QUANTITE_FIXE', 'A_COMMANDE', 'CONTRAT_CADRE'],
};

/** Le DAO de cette fiche peut-il être importé ? Sans catégorie, le serveur lit comme des fournitures ; l'écran aussi. */
export function importPossible(typeMarche: TypeMarche | null, categorie: CategorieDao | null): boolean {
  return !!typeMarche && (IMPORTABLES[categorie ?? 'FOURNITURES_SERVICES'] ?? []).includes(typeMarche);
}

/** Types acceptés : le Word (.docx) et, depuis le 29/09 (serveur `LecturePdf`), le PDF « texte ». */
const TYPES_IMPORT: readonly string[] = [...TYPES_DOCX, ...TYPES_PDF];

/** Même valeur ? (le serveur rend les nombres typés, la fiche les garde parfois en texte). */
export function memeValeur(a: unknown, b: unknown): boolean {
  if (a == null || b == null || a === '' || b === '') return false;
  const x = String(a).trim(), y = String(b).trim();
  return x.toLowerCase() === y.toLowerCase() || (x !== '' && !Number.isNaN(Number(x)) && Number(x) === Number(y));
}

/**
 * Cochée d'office ? (plan du 28/09, Q8) — seulement une valeur SÛRE (confiance haute, sans anomalie) qui remplit une
 * case VIDE. Rien de ce qui écraserait une saisie, rien de moyen ou de bas : la PRMP le coche elle-même.
 */
export function cocheeDOffice(p: PropositionImport): boolean {
  return p.confiance === 'haute' && !p.anomalies.length && (p.actuelle == null || p.actuelle === '');
}

type Ligne = PropositionImport & { libelle: string; bloc: string; identique: boolean; bloquee: boolean };

/**
 * ⚠️ 16/10 — les articles lus d'un même lot, tels que la revue les présente : on reprend un lot entier ou rien
 * (`PUT …/articles?lot=k` remplace le besoin du lot). `actuels` : ce que la fiche porte déjà pour ce lot.
 */
export interface LotImport {
  cle: string;
  lot: number | null;
  articles: ArticleImport[];
  actuels: number;
  /** Un article en anomalie (lot hors plan, quantités incompatibles) bloque le lot : rien n'en est repris. */
  motifs: string[];
}

export function cleLot(lot: number | null): string { return lot == null ? 'unique' : String(lot); }

/** ⚠️ 17/10 — un avertissement « DAO périmé » (`DAO_PERIME : …`) se place sous le verdict d'identité, pas parmi les autres. */
export const PREFIXE_PERIME = /^DAO_PERIME\s*:\s*/;

export const LIBELLES_CRITERE: Readonly<Record<CritereIdentite, string>> = {
  OBJET: 'Objet', AUTORITE: 'Autorité contractante', MODE: 'Mode de passation', FORME: 'Forme du marché', LOTS: 'Lots',
};
export const LIBELLES_ETAT: Readonly<Record<EtatCritere, string>> = { RETROUVE: 'retrouvé', CONTREDIT: 'contredit', INTROUVABLE: 'introuvable' };

/**
 * ⚠️ 17/10 (pilote) — un complément retenu sans sa question : le DAO dit le taux de l'avance (`tauxAvance`) sans que la
 * réponse « avance : oui » soit lue. Le complément n'a de sens que sous cette réponse : on la pose avec lui (la réécrire quand
 * la fiche la porte déjà est sans effet). Sans cela, le cadrage reste incomplet et l'étape ne se valide pas.
 */
export function completerParents(cadrage: Record<string, string | number>): void {
  for (const q of QUESTIONS_CADRAGE) {
    if (q.complement && q.complement.cle in cadrage && !(q.cle in cadrage)) cadrage[q.cle] = q.complement.si;
  }
}

/**
 * ⚠️ 17/10 — peut-on appliquer, au vu du verdict d'identité ? Un DAO étranger jamais ; un DAO non prouvé seulement attesté,
 * et seulement par la PRMP (le serveur refuse l'attestation d'une UGPM). Sans verdict (serveur antérieur) : comme avant.
 */
export function identiteAutorise(verdict: string | null | undefined, attestee: boolean, estPrmp: boolean): boolean {
  if (verdict === 'ETRANGER') return false;
  if (verdict === 'NON_PROUVE') return attestee && estPrmp;
  return true;
}

/** Les articles lus, regroupés par lot dans l'ordre du document, face au besoin déjà saisi. */
export function lotsImport(lus: readonly ArticleImport[], actuels: readonly ArticleFiche[]): LotImport[] {
  const lots = new Map<string, LotImport>();
  for (const a of lus) {
    const cle = cleLot(a.lot);
    if (!lots.has(cle)) lots.set(cle, { cle, lot: a.lot, articles: [], actuels: actuels.filter((x) => cleLot(x.lot ?? null) === cle).length, motifs: [] });
    const l = lots.get(cle)!;
    l.articles.push(a);
    for (const m of a.anomalies) if (!l.motifs.includes(m)) l.motifs.push(m);
  }
  return [...lots.values()];
}

/** Coché d'office : un lot sans anomalie qui remplit un besoin VIDE — jamais ce qui remplacerait une saisie. */
export function lotCocheDOffice(l: LotImport): boolean { return !l.motifs.length && l.actuels === 0; }

/** Un article lu, en article de la fiche. Le serveur pose l'ordre ; `numeroPrix` et la série ne valent qu'en travaux. */
export function versArticleFiche(a: ArticleImport): ArticleFiche {
  return {
    lot: a.lot,
    designation: a.designation,
    unite: a.unite ?? '',
    quantite: a.quantite,
    quantiteMin: a.quantiteMin,
    quantiteMax: a.quantiteMax,
    numeroPrix: a.numero,
    serie: a.serie,
    serieLibelle: a.serieLibelle,
    caracteristiques: a.caracteristiques.map((c) => ({ libelle: c.libelle, exigence: c.exigence })),
  };
}

/**
 * ⚠️ **Import du DAO** (demande du pilote du 28/09 ; plan `docs/plan-2026-09-28-import-dao.md`, contrat
 * `docs/demande-backend-2026-09-28-import-dao.md`) — la fiche reste le formulaire : le serveur LIT le document
 * (`POST …/import`, rien n'est écrit), cet écran montre ce qu'il a lu, avec l'extrait et la confiance, et la PRMP
 * retient ligne par ligne ; seul « Appliquer » écrit, d'un seul coup (`PUT …/import/appliquer`, fusion : ce qui n'est
 * pas retenu reste tel quel). Sans document, rien ne change : on saisit.
 */
@Component({
  selector: 'app-import-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, Icone],
  templateUrl: './import-dao.html',
  styleUrl: './import-dao.scss',
})
export class ImportDao {
  private readonly ficheService = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly idDmc = input.required<number>();
  /** ⚠️ 17/10 — la ligne du plan de la fiche, nommée dans l'attestation (« … celui de la ligne 303339 »). */
  readonly ligne = input<number | null>(null);
  readonly champs = input<ChampFiche[]>([]);
  /** ⚠️ 17/10 (demande pilote) — les blocs du référentiel, pour titrer chaque tableau par son nom (« Bloc B10 — Modifications… »). */
  readonly blocsReferentiel = input<BlocFiche[]>([]);
  readonly typeMarche = input<TypeMarche | null>(null);
  readonly categorie = input<CategorieDao | null>(null);
  /** Fiche encore vierge : l'import est proposé en tête du cadrage ; sinon, un simple bouton « Réimporter ». */
  readonly vierge = input(false);
  readonly applique = output<FicheMarche>();
  /** ⚠️ 16/10 — des lots d'articles ont été repris : le bloc besoin doit se recharger. */
  readonly besoinImporte = output<void>();

  readonly importable = computed(() => importPossible(this.typeMarche(), this.categorie()));
  readonly lecture = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly resultat = signal<ImportDaoResult | null>(null);
  readonly cochees = signal<ReadonlySet<string>>(new Set());
  readonly cadrageCoche = signal<ReadonlySet<string>>(new Set());
  readonly envoi = signal(false);
  readonly refus = signal<ReadonlyMap<string, string>>(new Map());
  readonly refusGeneral = signal<string | null>(null);

  private readonly parCode = computed(() => new Map(this.champs().map((c) => [c.code, c])));

  /** Les lignes, dans l'ordre du référentiel (bloc, rang), avec ce qui décide de la case. */
  readonly lignes = computed<Ligne[]>(() => {
    const r = this.resultat();
    if (!r) return [];
    const ordre = new Map(this.champs().map((c, i) => [c.code, i]));
    return r.propositions
      .map((p) => {
        const c = this.parCode().get(p.code);
        return { ...p, libelle: c?.libelle ?? p.code, bloc: c?.bloc ?? p.code.slice(0, 3), identique: memeValeur(p.valeur, p.actuelle), bloquee: p.anomalies.length > 0 };
      })
      .sort((a, b) => (ordre.get(a.code) ?? 9999) - (ordre.get(b.code) ?? 9999));
  });
  readonly blocs = computed(() => [...new Set(this.lignes().map((l) => l.bloc))]);
  lignesDuBloc(bloc: string): Ligne[] { return this.lignes().filter((l) => l.bloc === bloc); }
  /** Le nom du bloc tel que la fiche le montre ; à défaut, son code seul. */
  nomBloc(bloc: string): string | null { return this.blocsReferentiel().find((b) => b.code === bloc)?.libelle ?? null; }

  // ── Articles du besoin (16/10) ────────────────────────────────────────────────────────────
  /** Le besoin déjà saisi, lu à l'arrivée du résultat ; `null` tant qu'il n'est pas connu (rien n'est coché d'office). */
  readonly actuels = signal<ArticleFiche[] | null>(null);
  readonly lotsCoches = signal<ReadonlySet<string>>(new Set());
  readonly lotsLus = computed(() => lotsImport(this.resultat()?.articles ?? [], this.actuels() ?? []));
  basculerLot(cle: string): void {
    this.lotsCoches.update((s) => { const n = new Set(s); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  }
  libelleLot(l: { lot: number | null }): string { return l.lot == null ? 'le besoin' : `le lot ${l.lot}`; }
  quantites(a: ArticleImport): string {
    if (a.quantiteMin != null || a.quantiteMax != null) return `${this.nombre(a.quantiteMin)} à ${this.nombre(a.quantiteMax)}`;
    return this.nombre(a.quantite);
  }

  /** Une quantité lisible : milliers séparés (« 1 500 »), décimales à la française. */
  private nombre(n: number | null): string {
    return n == null ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  }

  // ── Identité du DAO (17/10) ──────────────────────────────────────────────────────────────
  readonly identite = computed(() => this.resultat()?.identite ?? null);
  readonly etranger = computed(() => this.identite()?.verdict === 'ETRANGER');
  readonly nonProuve = computed(() => this.identite()?.verdict === 'NON_PROUVE');
  readonly estPrmp = computed(() => this.auth.role() === 'PRMP');
  readonly attestee = signal(false);
  readonly autorise = computed(() => identiteAutorise(this.identite()?.verdict, this.attestee(), this.estPrmp()));
  /** Les avertissements « DAO périmé », sans leur code, placés sous le verdict ; les autres restent où ils étaient. */
  readonly perimes = computed(() => (this.resultat()?.avertissements ?? []).filter((a) => PREFIXE_PERIME.test(a)).map((a) => a.replace(PREFIXE_PERIME, '')));
  readonly autresAvertissements = computed(() => (this.resultat()?.avertissements ?? []).filter((a) => !PREFIXE_PERIME.test(a)));
  libelleCritere(c: CritereIdentite): string { return LIBELLES_CRITERE[c] ?? c; }
  libelleEtat(e: EtatCritere): string { return LIBELLES_ETAT[e] ?? e; }

  // ── Tout sélectionner (17/10, demande pilote) ───────────────────────────────────────────────
  // Seules les lignes retenables : jamais une valeur déjà à l'identique, en anomalie, un lot bloqué, ni rien d'un DAO étranger.
  readonly cadrageRetenable = computed(() => this.etranger() ? [] : (this.resultat()?.cadrage ?? []).filter((c) => !this.cadrageIdentique(c)).map((c) => c.cle));
  lignesRetenables(bloc?: string): string[] {
    if (this.etranger()) return [];
    return this.lignes().filter((l) => !l.bloquee && !l.identique && (bloc == null || l.bloc === bloc)).map((l) => l.code);
  }
  // Un lot dont la fiche porte déjà des articles (ou dont le besoin n'est pas encore lu) n'entre pas dans « tout » : le cocher
  // remplacerait une saisie. Il reste cochable à la main, comme avant.
  readonly lotsRetenables = computed(() => this.etranger() || this.actuels() === null ? []
    : this.lotsLus().filter((l) => !l.motifs.length && l.actuels === 0).map((l) => l.cle));
  readonly nbRetenables = computed(() => this.cadrageRetenable().length + this.lignesRetenables().length + this.lotsRetenables().length);
  /** Tout le retenable est coché (un lot coché à la main en plus n'y change rien). */
  readonly toutRetenu = computed(() => this.nbRetenables() > 0
    && this.cadrageRetenable().every((k) => this.cadrageCoche().has(k))
    && this.lignesRetenables().every((k) => this.cochees().has(k))
    && this.lotsRetenables().every((k) => this.lotsCoches().has(k)));

  /** « tout », « partiel » ou « rien » : l'état de la case d'en-tête d'un tableau. */
  etat(retenables: readonly string[], coches: ReadonlySet<string>): 'tout' | 'partiel' | 'rien' {
    const n = retenables.filter((k) => coches.has(k)).length;
    return n === 0 ? 'rien' : n === retenables.length ? 'tout' : 'partiel';
  }
  etatCadrage(): 'tout' | 'partiel' | 'rien' { return this.etat(this.cadrageRetenable(), this.cadrageCoche()); }
  etatBloc(bloc: string): 'tout' | 'partiel' | 'rien' { return this.etat(this.lignesRetenables(bloc), this.cochees()); }

  /** La case d'en-tête : tout coché → tout décoché ; sinon tout coché. */
  basculerToutCadrage(): void {
    const tout = this.etatCadrage() === 'tout';
    this.cadrageCoche.set(tout ? new Set() : new Set(this.cadrageRetenable()));
  }
  basculerToutBloc(bloc: string): void {
    const codes = this.lignesRetenables(bloc);
    const tout = this.etatBloc(bloc) === 'tout';
    this.cochees.update((s) => { const n = new Set(s); for (const c of codes) { if (tout) n.delete(c); else n.add(c); } return n; });
  }
  /** Le bouton général : tout ce qui est retenable, valeurs, cadrage et lots d'articles ; ou plus rien. */
  basculerTout(): void {
    const tout = this.toutRetenu();
    this.cadrageCoche.set(tout ? new Set() : new Set(this.cadrageRetenable()));
    this.cochees.set(tout ? new Set() : new Set(this.lignesRetenables()));
    this.lotsCoches.set(tout ? new Set() : new Set(this.lotsRetenables()));
  }

  readonly nbRetenues = computed(() => this.cochees().size + this.cadrageCoche().size + this.lotsCoches().size);
  readonly nbAVerifier = computed(() => this.lignes().filter((l) => l.confiance !== 'haute' && !l.identique && !l.bloquee).length);

  // ── Lecture ───────────────────────────────────────────────────────────────────────────────
  choisir(ev: Event): void {
    const champ = ev.target as HTMLInputElement;
    const brut = champ.files?.[0];
    champ.value = '';   // le même fichier doit pouvoir être relu
    if (!brut) return;
    // Certains postes ne donnent pas de type à un .docx : le nom suffit alors, le serveur vérifie le contenu.
    const fichier = !brut.type && /\.docx$/i.test(brut.name) ? new File([brut], brut.name, { type: TYPES_DOCX[0] }) : brut;
    // Le message de format de `validerFichier` ne connaît pas ce couple : on le dit ici ; la taille, elle, reste la sienne.
    if (!TYPES_IMPORT.includes(fichier.type)) { this.erreur.set('Format de fichier non accepté : document Word (.docx) ou PDF attendu.'); return; }
    const refus = validerFichier(fichier, TYPES_IMPORT);
    if (refus) { this.erreur.set(refus); return; }
    this.erreur.set(null);
    this.lecture.set(true);
    this.ficheService.importerDao(this.idDmc(), fichier).subscribe({
      next: (r) => {
        this.lecture.set(false);
        this.refus.set(new Map());
        this.refusGeneral.set(null);
        this.attestee.set(false);
        // ⚠️ 17/10 — un DAO étranger : rien n'est coché, rien ne peut l'être (le serveur refuserait de toute façon).
        const etranger = r.identite?.verdict === 'ETRANGER';
        this.cochees.set(etranger ? new Set() : new Set(r.propositions.filter(cocheeDOffice).map((p) => p.code)));
        // Une réponse n'est retenue d'office que si la question est vraiment sans réponse (défaut compris).
        // ⚠️ 17/10 — une réponse lue par clause n'est jamais sûre : jamais cochée d'office (demande cadrage-depuis-dao, B1.1).
        this.cadrageCoche.set(etranger ? new Set() : new Set(r.cadrage.filter((c) => { const v = this.actuelleCadrage(c); return c.source !== 'clause' && (v == null || v === ''); }).map((c) => c.cle)));
        this.actuels.set(null);
        this.lotsCoches.set(new Set());
        this.resultat.set(r);
        // ⚠️ 16/10 — des articles lus : ce que la fiche porte déjà décide de ce qui est coché d'office (un lot vide).
        if (r.articles?.length && !etranger) {
          this.ficheService.articles(this.idDmc()).subscribe({
            next: (a) => {
              this.actuels.set(a);
              this.lotsCoches.set(new Set(lotsImport(r.articles ?? [], a).filter(lotCocheDOffice).map((l) => l.cle)));
            },
            error: () => this.actuels.set(null),
          });
        }
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.lecture.set(false);
        this.erreur.set(corpsErreur<{ message?: string }>(e)?.message ?? (e as ApiError).message ?? 'Le document n’a pas pu être lu.');
      },
    });
  }

  // ── Revue ─────────────────────────────────────────────────────────────────────────────────
  basculer(code: string): void {
    this.cochees.update((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  }
  basculerCadrage(cle: string): void {
    this.cadrageCoche.update((s) => { const n = new Set(s); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  }
  /** ⚠️ 03/10 — où coller chaque passage de liste repéré (lecture par clause). */
  libellePassage(liste: PassageImport['liste']): string {
    return { MATERIEL: 'Matériel exigé — bloc B13', PERSONNEL: 'Personnel clé — bloc B13', PIECES: 'Pièces de l’offre — bloc B14' }[liste];
  }

  /**
   * Copie le passage : la PRMP l'ouvre dans « Coller une liste » du bloc indiqué, où l'aperçu se vérifie. Rien ne
   * s'applique d'ici — la lecture repère le passage, elle ne le découpe pas (note de décision du 03/10).
   */
  copierPassage(p: PassageImport): void {
    const fait = () => this.toast.info(`Passage copié. Ouvrez « ${this.libellePassage(p.liste)} », puis « Coller une liste ».`);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(p.texte).then(fait, () => this.toast.error('La copie a été refusée par le navigateur : sélectionnez le passage et copiez-le.'));
    else this.toast.error('La copie n’est pas disponible ici : sélectionnez le passage et copiez-le.');
  }

  libelleConfiance(c: ConfianceImport): string {
    return c === 'haute' ? 'sûre' : c === 'moyenne' ? 'à vérifier' : 'incertaine';
  }
  libelleChamp(code: string): string { return this.parCode().get(code)?.libelle ?? code; }
  /** La question de cadrage en toutes lettres (« Contrat-cadre : mono ou multi-attributaire ? »). */
  libelleQuestion(cle: string): string {
    const q = QUESTIONS_CADRAGE.find((x) => x.cle === cle);
    if (q) return q.libelle;
    // Un complément (« tauxAvance », « nbLots ») se nomme par son libellé, rattaché à sa question.
    return QUESTIONS_CADRAGE.find((x) => x.complement?.cle === cle)?.complement?.libelle ?? cle;
  }
  /** Ce que la fiche porte, réponse par défaut comprise (`modeRemise` absent = « Papier », comme le serveur le lit). */
  actuelleCadrage(c: ReponseCadrageImport): string | number | null {
    return c.actuelle ?? QUESTIONS_CADRAGE.find((q) => q.cle === c.cle)?.defaut ?? null;
  }
  /** Réponse déjà à l'identique : rien à écrire, la case est grisée comme pour une valeur. */
  cadrageIdentique(c: ReponseCadrageImport): boolean { return memeValeur(c.valeur, this.actuelleCadrage(c)); }
  /** La réponse telle que la question la propose (« Multi-attributaire »), sinon la valeur brute (un taux). */
  libelleReponse(cle: string, v: unknown): string {
    if (v == null || v === '') return '—';
    return QUESTIONS_CADRAGE.find((q) => q.cle === cle)?.options.find((o) => o.code === String(v))?.libelle ?? String(v);
  }
  valeurCadrage(r: ReponseCadrageImport): string { return this.libelleReponse(r.cle, r.valeur); }
  affiche(v: unknown): string { return v == null || v === '' ? '—' : String(v); }

  /** Une valeur lue ou saisie, pour la lecture seule : une date ISO s'écrit « 04/03/2027 à 09 h 00 » (la valeur appliquée ne change pas). */
  afficheValeur(v: unknown): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(v ?? ''));
    if (!m) return this.affiche(v);
    return `${m[3]}/${m[2]}/${m[1]}` + (m[4] ? ` à ${m[4]} h ${m[5]}` : '');
  }

  fermer(): void {
    if (this.envoi()) return;
    this.resultat.set(null);
  }

  // ── Application ───────────────────────────────────────────────────────────────────────────
  appliquer(): void {
    const r = this.resultat();
    if (!r || !this.nbRetenues() || !this.autorise()) return;
    // ⚠️ 17/10 — l'attestation n'est envoyée que pour un DAO non prouvé, cochée par la PRMP.
    const attestation = this.nonProuve() && this.attestee() ? true : undefined;
    const valeurs: Record<string, string | number> = {};
    for (const p of r.propositions) if (this.cochees().has(p.code) && p.valeur != null) valeurs[p.code] = p.valeur;
    const cadrage: Record<string, string | number> = {};
    for (const c of r.cadrage) if (this.cadrageCoche().has(c.cle)) cadrage[c.cle] = c.valeur;
    completerParents(cadrage);
    const lots = this.lotsLus().filter((l) => this.lotsCoches().has(l.cle) && !l.motifs.length);
    const n = Object.keys(valeurs).length, m = Object.keys(cadrage).length;
    this.envoi.set(true);
    this.refus.set(new Map());
    this.refusGeneral.set(null);
    // ⚠️ 16/10 — deux écritures : les champs (atomique, comme avant), puis le besoin lot par lot. Sans champ retenu,
    // seuls les lots s'écrivent.
    if (!n && !m) { this.ecrireLots(r, lots, 0, false, '', attestation); return; }
    this.ficheService.appliquerImport(this.idDmc(), { cadrage, valeurs, fichier: r.fichier, empreinte: r.empreinte, attestation }).subscribe({
      next: (f) => {
        this.applique.emit(f);
        // Les champs sont écrits : ils ne doivent pas repartir si un lot est refusé et que la PRMP réapplique.
        this.cochees.set(new Set());
        this.cadrageCoche.set(new Set());
        this.ecrireLots(r, lots, 0, true, `${n} valeur${n > 1 ? 's' : ''}, ${m} réponse${m > 1 ? 's' : ''} de cadrage`, attestation);
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.envoi.set(false);
        const parChamp = erreursParChamp(e);
        this.refus.set(parChamp);
        // Rien n'a été écrit (atomique) : la liste le dit ligne par ligne, et la PRMP décoche ce qui est refusé.
        this.refusGeneral.set(parChamp.size
          ? `Rien n’a été écrit : ${parChamp.size} ligne${parChamp.size > 1 ? 's' : ''} refusée${parChamp.size > 1 ? 's' : ''} (en rouge ci-dessous).`
          : corpsErreur<{ message?: string }>(e)?.message ?? 'L’application a échoué : rien n’a été écrit.');
      },
    });
  }

  /**
   * ⚠️ 16/10 — le besoin des lots cochés, un lot après l'autre (`PUT …/articles?lot=k` remplace le besoin du lot), avec
   * la trace de l'import pour le journal du dossier. Au premier refus, on s'arrête et on dit exactement ce qui est écrit.
   */
  private ecrireLots(r: ImportDaoResult, lots: LotImport[], i: number, champsEcrits: boolean, bilanChamps = '', attestation?: boolean): void {
    if (i === lots.length) {
      this.envoi.set(false);
      this.resultat.set(null);
      const nbArticles = lots.reduce((s, l) => s + l.articles.length, 0);
      const bilanLots = lots.length ? `${nbArticles} article${nbArticles > 1 ? 's' : ''} du besoin (${lots.length} lot${lots.length > 1 ? 's' : ''})` : '';
      this.toast.success(`Fiche pré-remplie depuis ${r.fichier} : ${[bilanChamps, bilanLots].filter(Boolean).join(', ')}. Relisez-la bloc par bloc.`);
      if (lots.length) this.besoinImporte.emit();
      return;
    }
    const l = lots[i];
    this.ficheService.enregistrerBesoin(this.idDmc(), l.lot, l.articles.map(versArticleFiche), { importFichier: r.fichier, importEmpreinte: r.empreinte, attestation }).subscribe({
      next: () => {
        // Repris : il ne doit pas repartir si la suite est refusée et que la PRMP réapplique.
        this.lotsCoches.update((s) => { const x = new Set(s); x.delete(l.cle); return x; });
        this.ecrireLots(r, lots, i + 1, champsEcrits, bilanChamps, attestation);
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.envoi.set(false);
        // Les champs, s'il y en avait, sont déjà rendus au parent ; les lots écrits avant le refus doivent se voir.
        if (i > 0) this.besoinImporte.emit();
        const parChamp = erreursParChamp(e);
        const motif = parChamp.size ? [...parChamp.values()].slice(0, 3).join(' ; ') : corpsErreur<{ message?: string }>(e)?.message ?? 'refus du serveur';
        const deja = [champsEcrits ? 'les valeurs de la fiche' : '', ...lots.slice(0, i).map((x) => this.libelleLot(x))].filter(Boolean);
        this.refusGeneral.set(`${deja.length ? `Écrit : ${deja.join(', ')}. ` : ''}Refusé : ${this.libelleLot(l)} — ${motif}. Rien n’a été écrit pour ce lot ni pour les suivants.`);
      },
    });
  }
}
