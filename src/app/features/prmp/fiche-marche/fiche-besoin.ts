import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { ApiError, erreursParChamp } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { ArticleFiche, TypeMarche } from '../../../models';
import { FicheMarcheService } from '../../../services/fiche-marche.services';

/** Une ligne de la grille — l'article et ses exigences, tels que l'écran les manipule avant d'enregistrer. */
interface LigneBesoin extends ArticleFiche {
  /**
   * ⚠️ Clé **locale** de la ligne, propre à l'écran et jamais envoyée : un article neuf n'a pas encore
   * d'`idArticle`, et une égalité de référence se perd dès qu'une saisie recrée l'objet — la frappe
   * suivante retomberait alors dans le vide. La clé, elle, survit au remplacement.
   */
  cle: number;
  /** Les caractéristiques sont dépliées : on ne montre pas huit exigences sous chaque article par défaut. */
  ouverte?: boolean;
}

/**
 * ⚠️ **Le besoin par lot** (bloc `B12`, livré le 25/09) — la seule partie de la fiche qui ne soit pas faite de
 * champs : un tableau à deux niveaux, *n* articles par lot et *m* exigences par article. Il alimente trois
 * pièces du dossier — le bordereau des prix, le tableau de conformité technique et la liste des fournitures.
 *
 * Le bloc **déclare** ce rendu (`BlocFiche.rendu = 'BESOIN'`) : l'écran ne devine rien à partir d'un code.
 *
 * Deux règles de saisie portées ici, parce qu'elles sont d'écran et non de serveur :
 * - **l'ordre affiché fait foi** — le serveur pose l'`ordre` à partir de la position envoyée, donc monter une
 *   ligne suffit à renuméroter le bordereau ;
 * - **« Dupliquer depuis le lot n »** recopie un lot entier, chaque lot restant modifiable ensuite. Le dossier
 *   réel 2463 le justifie : ses lots 4 et 5 répètent mot pour mot les lots 2 et 3.
 */
@Component({
  selector: 'app-fiche-besoin',
  standalone: true,
  templateUrl: './fiche-besoin.html',
  styleUrl: './fiche-besoin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FicheBesoin {
  private readonly fiches = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  /** Nombre de lots de la ligne du plan ; `0` ou `1` = pas d'onglets, un seul besoin. */
  readonly nbLots = input<number>(0);
  readonly saisieParLot = input<boolean>(false);
  /** Fiche figée ou lecteur de la Commission : la grille se montre, elle ne se modifie pas. */
  readonly lecture = input<boolean>(false);
  /** Forme du marché : à commande = quantités minimum et maximum ; sinon une quantité unique. */
  readonly typeMarche = input<TypeMarche | null>(null);
  /** Le besoin vient d'être enregistré : la page mère relit son bilan de contrôles. */
  readonly enregistre = output<void>();

  readonly chargement = signal(true);
  readonly saving = signal(false);
  readonly lignes = signal<LigneBesoin[]>([]);
  readonly lotCourant = signal<number | null>(null);
  /** Erreurs servies par le serveur, par chemin (`articles[0].designation`). */
  readonly erreurs = signal<Map<string, string>>(new Map());
  /** Distributeur de clés locales (cf. `LigneBesoin.cle`). */
  private cles = 0;

  readonly lots = computed<number[]>(() => {
    const n = this.nbLots();
    return this.saisieParLot() && n > 1 ? Array.from({ length: n }, (_, i) => i + 1) : [];
  });
  readonly aCommande = computed(() => this.typeMarche() === 'A_COMMANDE');
  /**
   * ⚠️ Le lot **affiché** : celui qu'on a ouvert, ou le premier à défaut. Il est dérivé et non posé au retour
   * du serveur — sinon un chargement en échec laisserait la grille sans lot, et l'article ajouté partirait
   * sous `lot: null` sur une fiche pourtant allotie.
   */
  readonly lotAffiche = computed<number | null>(() => this.lotCourant() ?? this.lots()[0] ?? null);
  /** Les lignes du lot affiché — ou toutes, sur une ligne non allotie. */
  readonly duLot = computed(() => {
    const lot = this.lotAffiche();
    return this.lignes().filter((l) => (lot == null ? true : l.lot === lot));
  });
  /** Ce que porte chaque lot, pour l'onglet : « 2 articles » ou « à compléter ». */
  readonly comptes = computed(() => {
    const m = new Map<number, number>();
    for (const l of this.lignes()) if (l.lot != null) m.set(l.lot, (m.get(l.lot) ?? 0) + 1);
    return m;
  });
  /** Les lots déjà garnis, hors lot courant : les seuls dont la copie ait un sens. */
  readonly lotsCopiables = computed(() => this.lots().filter((n) => n !== this.lotAffiche() && (this.comptes().get(n) ?? 0) > 0));

  constructor() {
    effect(() => {
      const id = this.idDmc();
      this.chargement.set(true);
      this.fiches.articles(id).subscribe({
        next: (a) => {
          this.lignes.set(a.map((x) => this.enLigne(x)));
          this.chargement.set(false);
        },
        error: () => {
          this.lignes.set([]);
          this.chargement.set(false);
        },
      });
    });
  }

  /** Une ligne de grille à partir d'un article du serveur : les exigences sont recopiées, la clé est posée. */
  private enLigne(a: ArticleFiche): LigneBesoin {
    return { ...a, cle: ++this.cles, caracteristiques: [...(a.caracteristiques ?? [])], ouverte: false };
  }

  allerAuLot(lot: number): void {
    this.lotCourant.set(lot);
    this.erreurs.set(new Map());
  }

  // ── Les gestes de la grille ─────────────────────────────────────────────────────────────────

  ajouterArticle(): void {
    const lot = this.lotAffiche();
    this.lignes.update((l) => [
      ...l,
      { cle: ++this.cles, lot, designation: '', unite: 'U', quantiteMin: null, quantiteMax: null, quantite: null, caracteristiques: [], ouverte: true },
    ]);
  }

  supprimerArticle(ligne: LigneBesoin): void {
    this.lignes.update((l) => l.filter((x) => x.cle !== ligne.cle));
  }

  /** Monter ou descendre un article : l'ordre affiché devient le numéro porté au bordereau. */
  deplacer(ligne: LigneBesoin, pas: -1 | 1): void {
    const toutes = [...this.lignes()];
    const duLot = toutes.filter((x) => x.lot === ligne.lot);
    const i = duLot.findIndex((x) => x.cle === ligne.cle);
    const j = i + pas;
    if (i < 0 || j < 0 || j >= duLot.length) return;
    const a = toutes.indexOf(duLot[i]);
    const b = toutes.indexOf(duLot[j]);
    [toutes[a], toutes[b]] = [toutes[b], toutes[a]];
    this.lignes.set(toutes);
  }

  basculerOuverture(ligne: LigneBesoin): void {
    this.lignes.update((l) => l.map((x) => (x.cle === ligne.cle ? { ...x, ouverte: !x.ouverte } : x)));
  }

  ajouterCaracteristique(ligne: LigneBesoin): void {
    this.lignes.update((l) =>
      l.map((x) => (x.cle === ligne.cle ? { ...x, ouverte: true, caracteristiques: [...x.caracteristiques, { libelle: '', exigence: '' }] } : x)),
    );
  }

  supprimerCaracteristique(ligne: LigneBesoin, rang: number): void {
    this.lignes.update((l) =>
      l.map((x) => (x.cle === ligne.cle ? { ...x, caracteristiques: x.caracteristiques.filter((_, i) => i !== rang) } : x)),
    );
  }

  saisir(ligne: LigneBesoin, champ: 'designation' | 'unite', ev: Event): void {
    const valeur = (ev.target as HTMLInputElement).value;
    this.lignes.update((l) => l.map((x) => (x.cle === ligne.cle ? { ...x, [champ]: valeur } : x)));
  }

  saisirNombre(ligne: LigneBesoin, champ: 'quantiteMin' | 'quantiteMax' | 'quantite', ev: Event): void {
    const brut = (ev.target as HTMLInputElement).value;
    const valeur = brut === '' ? null : Number(brut);
    this.lignes.update((l) => l.map((x) => (x.cle === ligne.cle ? { ...x, [champ]: valeur } : x)));
  }

  saisirCaracteristique(ligne: LigneBesoin, rang: number, champ: 'libelle' | 'exigence', ev: Event): void {
    const valeur = (ev.target as HTMLInputElement).value;
    this.lignes.update((l) =>
      l.map((x) =>
        x.cle === ligne.cle ? { ...x, caracteristiques: x.caracteristiques.map((c, i) => (i === rang ? { ...c, [champ]: valeur } : c)) } : x,
      ),
    );
  }

  /**
   * Recopie un lot déjà garni dans le lot courant. Les identifiants ne suivent pas : ce sont de **nouveaux**
   * articles, que le serveur recréera — deux lots identiques restent deux besoins distincts.
   */
  dupliquerDepuis(source: number): void {
    const lot = this.lotAffiche();
    if (lot == null) return;
    const copies = this.lignes()
      .filter((l) => l.lot === source)
      .map((l) => ({
        cle: ++this.cles,
        lot,
        designation: l.designation,
        unite: l.unite,
        quantiteMin: l.quantiteMin,
        quantiteMax: l.quantiteMax,
        quantite: l.quantite,
        caracteristiques: l.caracteristiques.map((c) => ({ libelle: c.libelle, exigence: c.exigence })),
        ouverte: false,
      }));
    if (!copies.length) return;
    this.lignes.update((l) => [...l.filter((x) => x.lot !== lot), ...copies]);
    this.toast.info(`${copies.length} article(s) repris du lot ${source} — à ajuster avant d'enregistrer.`);
  }

  // ── Enregistrement ──────────────────────────────────────────────────────────────────────────

  enregistrer(): void {
    if (this.saving() || this.lecture()) return;
    const lot = this.lotAffiche();
    const charge = this.duLot().map((l) => ({
      lot: l.lot ?? null,
      designation: l.designation,
      unite: l.unite,
      quantiteMin: this.aCommande() ? l.quantiteMin : null,
      quantiteMax: this.aCommande() ? l.quantiteMax : null,
      quantite: this.aCommande() ? null : l.quantite,
      caracteristiques: l.caracteristiques,
    }));
    this.saving.set(true);
    this.erreurs.set(new Map());
    this.fiches.enregistrerBesoin(this.idDmc(), lot, charge).subscribe({
      next: (a) => {
        const autres = this.lignes().filter((l) => (lot == null ? false : l.lot !== lot));
        const relus = a.filter((x) => (lot == null ? true : x.lot === lot)).map((x) => this.enLigne(x));
        this.lignes.set([...autres, ...relus]);
        this.saving.set(false);
        this.toast.success(lot == null ? 'Besoin enregistré.' : `Besoin du lot ${lot} enregistré.`);
        this.enregistre.emit();
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        // ⚠️ Les 400 nominatifs se lisent par le socle : lui seul connaît les deux formes du corps
        // (liste nue, ou `{ erreurs: [...] }`) autant que la forme normalisée par l'intercepteur.
        const m = erreursParChamp(e);
        this.erreurs.set(m);
        if (!m.size) this.toast.error(e?.message ?? "Le besoin n'a pas pu être enregistré.");
      },
    });
  }

  /** L'erreur servie pour un champ d'un article, par sa position dans l'envoi. */
  erreurDe(rang: number, champ: string): string | null {
    return this.erreurs().get(`articles[${rang}].${champ}`) ?? null;
  }
}
