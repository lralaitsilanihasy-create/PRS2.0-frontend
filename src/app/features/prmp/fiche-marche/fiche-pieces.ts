import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { ApiError, erreursParChamp } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { PieceExigee, RubriquePiece } from '../../../models';
import { FicheMarcheService } from '../../../services/fiche-marche.services';
import { CollageListe } from './collage-liste';
import { FicheSpecifications } from './fiche-specifications';
import { lirePieces } from './collage-listes';
import { empreinte, ListeASauver } from './liste-a-sauver';
import { lignePiece, PIECES_ADMINISTRATIVES_DOCUMENT_TYPE } from './pieces';

/** Une pièce à l'écran, avec sa clé locale, qui survit au remplacement de l'objet à chaque frappe. */
type LignePiece = PieceExigee & { cle: number };

/** Les deux rubriques de la clause 6.2 du DPAO, dans l'ordre où l'écran les montre. */
export const RUBRIQUES_PIECES: { code: RubriquePiece; titre: string; clause: string }[] = [
  { code: 'ADMINISTRATIVE', titre: 'Pièces administratives', clause: 'clause 6.2, 2°' },
  { code: 'OFFRE', titre: 'Autres pièces de l’offre', clause: 'clause 6.2, 1°' },
];

/**
 * ⚠️ **Pièces de l'offre exigées** des travaux (lot 4 du chantier b — livré le 03/10, V61, bloc `B14`,
 * `demande-backend-2026-10-03-pieces-offre-travaux`). Une liste de la fiche (`PUT` la remplace en entier), montrée en
 * deux rubriques : les pièces administratives (2° de la clause 6.2) et les autres pièces de l'offre (1°). Chaque pièce
 * montre la ligne que le DPAO imprimera.
 *
 * Les textes `B03-CQ-01` (pièces administratives, dont la valeur par défaut est la liste du document type) et `B04-PI-01`
 * restent en complément (Q4 du plan) : l'écran prévient quand le premier ferait double emploi avec la liste.
 */
@Component({
  selector: 'app-fiche-pieces',
  standalone: true,
  templateUrl: './fiche-pieces.html',
  styleUrl: './fiche-pieces.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollageListe, FicheSpecifications],
})
export class FichePieces implements ListeASauver {
  private readonly fiches = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  readonly lecture = input<boolean>(false);
  /** Le texte de `B03-CQ-01` tel que saisi au bloc B03 : s'il est rempli avec la liste, il s'imprime en plus. */
  readonly texteAdministratif = input<string | null>(null);
  /**
   * ⚠️ 06/10 (`SE_PIECES_LISTEES`) — le texte « Documents et pièces constituant l'offre » (`B04-CO-01` aux fournitures,
   * `B04-PI-01` aux travaux). En remise électronique la liste est exigée : l'écran propose de la tirer de ce texte.
   */
  readonly texteOffre = input<string | null>(null);
  readonly enregistre = output<void>();

  readonly rubriques = RUBRIQUES_PIECES;
  readonly chargement = signal(true);
  readonly saving = signal(false);
  readonly pieces = signal<LignePiece[]>([]);
  /** Erreurs servies par le serveur, par chemin (`pieces[3].libelle`) : le rang est celui de toute la liste. */
  readonly erreurs = signal<Map<string, string>>(new Map());
  private cles = 0;

  readonly parRubrique = computed(() => {
    const m = new Map<RubriquePiece, LignePiece[]>(RUBRIQUES_PIECES.map((r) => [r.code, []]));
    for (const p of this.pieces()) m.get(p.rubrique)?.push(p);
    return m;
  });
  /** ⚠️ 03/10 — l'empreinte de la liste telle que servie ou enregistrée : la page la compare avant de quitter le bloc. */
  private readonly reference = signal('[]');
  readonly modifie = computed(() => empreinte(this.charge()) !== this.reference());
  /**
   * ⚠️ 03/10 — « Coller une liste » : la rubrique où la PRMP colle. C'est elle qui décide de la rubrique, l'écran ne
   * devine pas (le MEN range ses pièces administratives au 1° de sa clause 6.2).
   */
  readonly collage = signal<RubriquePiece | null>(null);
  /** Le texte qui pré-remplit le collage : celui de la fiche, quand la PRMP part de lui ; vide sinon. */
  readonly texteCollage = signal('');

  /** « Proposer la liste à partir du texte » : le collage de la rubrique, pré-rempli du texte de la fiche. */
  proposerDepuisTexte(rubrique: RubriquePiece): void {
    this.texteCollage.set(this.texteOffre() ?? '');
    this.collage.set(rubrique);
  }

  collerListe(rubrique: RubriquePiece): void {
    this.texteCollage.set('');
    this.collage.set(rubrique);
  }
  readonly lirePiecesCollees = computed(() => {
    const rubrique = this.collage() ?? 'OFFRE';
    return (texte: string) => lirePieces(texte, rubrique);
  });
  readonly lignePiece = lignePiece;
  readonly titreCollage = computed(() => `Coller la liste — ${RUBRIQUES_PIECES.find((r) => r.code === this.collage())?.titre ?? ''}`);

  ajouterCollees(entrees: PieceExigee[]): void {
    this.pieces.update((l) => [...l, ...entrees.map((p) => this.avecCle(p))]);
    this.collage.set(null);
    this.toast.info(`${entrees.length} pièce(s) ajoutée(s) — à vérifier avant d’enregistrer.`);
  }

  readonly doubleEmploi = computed(() => !!this.texteAdministratif()?.trim() && (this.parRubrique().get('ADMINISTRATIVE')?.length ?? 0) > 0);

  constructor() {
    effect(() => {
      const id = this.idDmc();
      this.chargement.set(true);
      // Une route pas encore servie (contrat demandé) laisse la liste vide, pas un écran en erreur.
      this.fiches.pieces(id).subscribe({
        next: (l) => (this.pieces.set(l.map((p) => this.avecCle(p))), this.reference.set(empreinte(this.charge())), this.chargement.set(false)),
        error: () => (this.pieces.set([]), this.reference.set('[]'), this.chargement.set(false)),
      });
    });
  }

  private avecCle(p: PieceExigee): LignePiece {
    return { ...p, cle: ++this.cles };
  }

  ligne(p: PieceExigee): string {
    return lignePiece(p);
  }

  /** Le rang de la pièce dans toute la liste : celui des erreurs servies (`pieces[i]`). */
  rangDe(p: LignePiece): number {
    return this.pieces().findIndex((x) => x.cle === p.cle);
  }

  erreurDe(p: LignePiece, champ: string): string | null {
    return this.erreurs().get(`pieces[${this.rangDe(p)}].${champ}`) ?? null;
  }

  ajouter(rubrique: RubriquePiece): void {
    this.pieces.update((l) => [...l, this.avecCle({ rubrique, numero: null, libelle: '', forme: null, ancienneteMaxMois: null, parLot: false, modele: null })]);
  }

  /** Les six pièces administratives du document type, d'un clic, à ajuster ensuite. */
  reprendreDocumentType(): void {
    this.pieces.update((l) => [...l, ...PIECES_ADMINISTRATIVES_DOCUMENT_TYPE.map((p) => this.avecCle({ ...p, numero: null, parLot: false, modele: null }))]);
    this.toast.info('Les six pièces administratives du document type sont ajoutées — à ajuster avant d’enregistrer.');
  }

  supprimer(cle: number): void {
    this.pieces.update((l) => l.filter((x) => x.cle !== cle));
  }

  /** Monter ou descendre une pièce DANS SA RUBRIQUE : l'ordre affiché est l'ordre imprimé. */
  deplacer(p: LignePiece, pas: -1 | 1): void {
    const toutes = [...this.pieces()];
    const memes = toutes.filter((x) => x.rubrique === p.rubrique);
    const i = memes.findIndex((x) => x.cle === p.cle);
    const j = i + pas;
    if (i < 0 || j < 0 || j >= memes.length) return;
    const a = toutes.indexOf(memes[i]);
    const b = toutes.indexOf(memes[j]);
    [toutes[a], toutes[b]] = [toutes[b], toutes[a]];
    this.pieces.set(toutes);
  }

  saisirTexte(cle: number, champ: 'numero' | 'libelle' | 'forme' | 'modele', ev: Event): void {
    const valeur = (ev.target as HTMLInputElement).value;
    this.pieces.update((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: valeur } : x)));
  }

  saisirAnciennete(cle: number, ev: Event): void {
    const brut = (ev.target as HTMLInputElement).value;
    this.pieces.update((l) => l.map((x) => (x.cle === cle ? { ...x, ancienneteMaxMois: brut === '' ? null : Number(brut) } : x)));
  }

  basculerParLot(cle: number, ev: Event): void {
    const coche = (ev.target as HTMLInputElement).checked;
    this.pieces.update((l) => l.map((x) => (x.cle === cle ? { ...x, parLot: coche } : x)));
  }

  /** Ce que le `PUT` envoie : rubrique par rubrique, dans l'ordre affiché, sans les clés d'écran. */
  private charge(): PieceExigee[] {
    return RUBRIQUES_PIECES.flatMap((r) => this.parRubrique().get(r.code) ?? []).map((p) => ({
      rubrique: p.rubrique,
      numero: p.numero?.trim() || null,
      libelle: p.libelle.trim(),
      forme: p.forme?.trim() || null,
      ancienneteMaxMois: p.ancienneteMaxMois ?? null,
      parLot: !!p.parLot,
      modele: p.modele?.trim() || null,
    }));
  }

  enregistrer(): void {
    if (this.saving() || this.lecture()) return;
    void this.envoyer(true);
  }

  /** ⚠️ 03/10 — tout enregistrer avant de quitter le bloc (`ListeASauver`). */
  async sauver(): Promise<boolean> {
    if (this.lecture() || !this.modifie()) return true;
    return this.envoyer(false);
  }

  /** Le `PUT` ; l'abonnement met l'écran à jour à la réponse même, la promesse dit l'issue. */
  private envoyer(annoncer: boolean): Promise<boolean> {
    const charge = this.charge();
    // L'ordre envoyé devient l'ordre de la liste : les rangs des erreurs servies le suivront.
    this.pieces.set(RUBRIQUES_PIECES.flatMap((r) => this.parRubrique().get(r.code) ?? []));
    this.saving.set(true);
    this.erreurs.set(new Map());
    return new Promise((resoudre) =>
      this.fiches.enregistrerPieces(this.idDmc(), charge).subscribe({
        next: (l) => {
          this.pieces.set(l.map((p) => this.avecCle(p)));
          this.reference.set(empreinte(this.charge()));
          this.saving.set(false);
          if (annoncer) this.toast.success('Pièces de l’offre enregistrées.');
          this.enregistre.emit();
          resoudre(true);
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          const m = erreursParChamp(e);
          this.erreurs.set(m);
          if (!m.size) this.toast.error(e?.message ?? "Les pièces n'ont pas pu être enregistrées.");
          resoudre(false);
        },
      }),
    );
  }
}
