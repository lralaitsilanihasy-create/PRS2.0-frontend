import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { ApiError, estConflitVersion } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, TYPES_PDF, validerFichier } from '../../core/securite/fichiers-surs';
import {
  Capm,
  DiffDossier,
  Dossier,
  EntiteContract,
  FORME_MARCHE_LIBELLES,
  LigneDiff,
  Marche,
  MarchePrevision,
  ModePassation,
  Nature,
  PieceJointeDossier,
  Ppm,
  ServiceBeneficiaire,
  TypePieceJointe,
} from '../../models';
import {
  CapmService,
  DossierService,
  EntiteContractService,
  MarcheService,
  MarchePrevisionService,
  MiseAJourPpmService,
  ModePassationService,
  NatureService,
  PieceJointeDossierService,
  PpmService,
  ServiceBeneficiaireService,
  TypePieceJointeService,
} from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { DetailPpmModal } from '../../shared/prmp';
import { calculerFichePresentation } from '../../shared/prmp/fiche-presentation';
import { DossierConsultation } from '../circuit/dossier-consultation';
import { DossiersRefreshStore } from './dossiers-refresh.store';

/** Une ligne du tableau : le marché de la version en cours, enrichi de son statut vis-à-vis du précédent. */
interface LigneAffichee {
  marche: Marche;
  diff?: LigneDiff;
}

/**
 * ⚠️ **Mise à jour d'un PPM (2026-08-05)** — écran de la version n+1 d'un PPM en vigueur.
 *
 * <p>Rien n'est modifié en place : le dossier édité ici est un <strong>nouveau dossier</strong>,
 * copie conforme du précédent, créé par {@code POST /api/saisies/ppm/{id}/mise-a-jour}. Le
 * prédécesseur ne bascule en « Remplacé » qu'à la <strong>soumission</strong> — tant qu'on reste ici,
 * abandonner la mise à jour (supprimer le brouillon) est sans conséquence.</p>
 *
 * <p>Chaque geste est enregistré immédiatement par les endpoints granulaires (`PUT /api/marches/{id}`,
 * `PATCH …/supprimer|restaurer`) plutôt que par l'édition en bloc : le diff affiché reflète donc
 * toujours l'état réel côté serveur, et non un brouillon local.</p>
 */
@Component({
  selector: 'app-mise-a-jour-ppm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DossierConsultation, DetailPpmModal, ModaleDirective],
  templateUrl: './mise-a-jour-ppm.html',
  styleUrl: './mise-a-jour-ppm.scss',
})
export class MiseAJourPpm {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dossierService = inject(DossierService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly majService = inject(MiseAJourPpmService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly typePieceService = inject(TypePieceJointeService);
  private readonly entiteService = inject(EntiteContractService);
  private readonly benefService = inject(ServiceBeneficiaireService);
  private readonly natureService = inject(NatureService);
  private readonly modeService = inject(ModePassationService);
  private readonly capmService = inject(CapmService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);

  readonly idDossier = Number(this.route.snapshot.paramMap.get('idDossier'));

  readonly chargement = signal(true);
  readonly enregistrement = signal(false);
  readonly dossier = signal<Dossier | null>(null);
  readonly ppm = signal<Ppm | null>(null);
  readonly precedent = signal<Dossier | null>(null);
  readonly diff = signal<DiffDossier | null>(null);
  readonly marches = signal<Marche[]>([]);
  readonly pieces = signal<PieceJointeDossier[]>([]);
  readonly libellesPiece = signal<Map<number, string>>(new Map());
  /** Types de pièce attendus pour la famille du dossier (référentiel), source du bloc de dépôt. */
  private readonly typesPiece = signal<TypePieceJointe[]>([]);
  readonly libelleEntite = signal('');

  /** Champs modifiables de l'en-tête (les hérités — entité, exercice — ne sont pas éditables). */
  readonly signataire = signal('');
  readonly dateSignature = signal('');
  readonly motif = signal('');

  /** Panneaux : aperçu du diff complet, consultation du dossier d'origine (la modale prend le dossier). */
  readonly apercuOuvert = signal(false);
  readonly origineConsultee = signal<Dossier | null>(null);
  /** Détail complet du PPM en édition (bénéficiaires, lots, dates prévisionnelles). */
  readonly detailOuvert = signal(false);
  /**
   * ⚠️ Parité avec la création (demande pilote 2026-09-08) — APERÇU du dossier composé : onglets
   * Fiche de présentation / Plan de passation / Projet d'AGPM / Pièces jointes, dérivés du plan de
   * cette version. On réutilise `DetailPpmModal` en LECTURE SEULE (`modeEdition=false`) : il monte déjà
   * ces 4 onglets à partir du même calcul partagé — rien à redériver ici.
   */
  readonly apercuDossierOuvert = signal(false);

  /**
   * ⚠️ 2026-08-05 (demande user) — le tableau reprend la STRUCTURE de la grille de saisie : nature, mode,
   * forme et bloc bénéficiaire. Ces libellés viennent des référentiels, chargés dans la même vague.
   */
  readonly benefs = signal<ServiceBeneficiaire[]>([]);
  private readonly natures = signal<Map<number, string>>(new Map());
  private readonly modes = signal<Map<number, string>>(new Map());
  /** Référentiel complet des modes — pour le drapeau `declencheAgpm` (filtre des pièces). */
  private readonly modesRef = signal<ModePassation[]>([]);
  /** ⚠️ Parité création (2026-09-08) — CAPM + prévisions : nécessaires pour DÉRIVER la fiche de
   *  présentation (marchés dérogatoires / à délai aménagé / contrats-cadres) du plan de cette version. */
  private readonly capms = signal<Capm[]>([]);
  private readonly previsions = signal<MarchePrevision[]>([]);
  /** Justification GLOBALE de la fiche de présentation (bas de fiche) — saisie ICI, saisissable comme à
   *  la création ; persistée avec l'en-tête (`PUT /api/ppms`). Initialisée de l'existante. */
  readonly justifFiche = signal('');
  /**
   * Fiche de présentation DÉRIVÉE du plan de cette version (mêmes fonctions pures que la création /
   * le détail PPM) : listes des marchés dérogatoires, à délai aménagé, contrats-cadres — celles qui
   * exigent une justification. Recalculée à chaque import / édition de ligne.
   */
  readonly fiche = computed(() =>
    calculerFichePresentation(this.marches(), this.previsions(), this.modesRef(), this.capms()),
  );
  /**
   * ⚠️ Parité création (2026-09-08) — justifications MANQUANTES, en miroir de la garde serveur (400 à
   * la soumission) : chaque marché dérogatoire sans `justifModeDerogatoire`, chaque marché à délai
   * aménagé sans `justifDelaiAmenage`, et la justification globale si au moins un marché figure dans
   * l'une des trois listes. Bloque « Créer la mise à jour » et alimente l'avertissement.
   */
  readonly justificationsManquantes = computed<string[]>(() => {
    const f = this.fiche();
    const manques: string[] = [];
    for (const l of f.derogatoires) {
      if (!l.justifModeDerogatoire) manques.push(`Ligne « ${l.objet} » — justification du mode dérogatoire`);
    }
    for (const l of f.delaisAmenages) {
      if (!l.justifDelaiAmenage) manques.push(`Ligne « ${l.objet} » — justification du délai aménagé`);
    }
    if (f.nbMarchesConcernes > 0 && !this.justifFiche().trim()) {
      manques.push('Justification globale de la fiche de présentation (bas du formulaire)');
    }
    return manques;
  });

  /**
   * ⚠️ Parité création (pilote 2026-09-08) — ÉDITION INLINE des justifications PAR LIGNE (mode dérogatoire /
   * délai aménagé), pour retoucher un héritage sans re-importer le PPM. Brouillon par clé `idDetail:mode|delai` ;
   * la valeur affichée est le brouillon s'il existe, sinon celle du marché. L'écriture est portée par le bouton
   * unique `enregistrerTout()` (pilote 2026-09-08) : plus de bouton par ligne.
   */
  private readonly justifLigneDrafts = signal<Map<string, string>>(new Map());

  private cleJustif(idDetail: number, type: 'mode' | 'delai'): string {
    return `${idDetail}:${type}`;
  }
  justifLigneValeur(idDetail: number, type: 'mode' | 'delai'): string {
    const brouillon = this.justifLigneDrafts().get(this.cleJustif(idDetail, type));
    if (brouillon !== undefined) {
      return brouillon;
    }
    const m = this.marches().find((x) => x.idDetail === idDetail);
    return (type === 'mode' ? m?.justifModeDerogatoire : m?.justifDelaiAmenage) ?? '';
  }
  majJustifLigne(idDetail: number, type: 'mode' | 'delai', valeur: string): void {
    this.justifLigneDrafts.update((map) => {
      const copie = new Map(map);
      copie.set(this.cleJustif(idDetail, type), valeur);
      return copie;
    });
  }
  /** Le brouillon diffère-t-il de la valeur persistée du marché ? (surligne la ligne + alimente le save unique). */
  justifLigneModifiee(idDetail: number, type: 'mode' | 'delai'): boolean {
    const cle = this.cleJustif(idDetail, type);
    if (!this.justifLigneDrafts().has(cle)) {
      return false;
    }
    const m = this.marches().find((x) => x.idDetail === idDetail);
    const actuel = (type === 'mode' ? m?.justifModeDerogatoire : m?.justifDelaiAmenage) ?? '';
    return (this.justifLigneDrafts().get(cle) ?? '').trim() !== actuel.trim();
  }

  /**
   * ⚠️ Bouton unique (pilote 2026-09-08) — remplace « Enregistrer l'en-tête » et les « Enregistrer » par ligne :
   * un seul geste persiste l'en-tête (si modifié) ET toutes les justifs de ligne éditées, en une salve
   * `forkJoin`. Chaque tâche repose sa réponse serveur dans l'état (verrou de version) ; une erreur (dont 409)
   * recharge tout pour repartir de la vérité serveur.
   */
  enregistrerTout(): void {
    const p = this.ppm();
    if (!p) {
      return;
    }
    if (this.enteteModifiee() && !this.motif().trim()) {
      this.toast.error('Le motif de la mise à jour est obligatoire.');
      return;
    }
    const taches: Observable<Ppm | Marche>[] = [];
    if (this.enteteModifiee()) {
      // `p` porte la version COURANTE (verrou optimiste) : le spread l'embarque.
      taches.push(
        this.ppmService
          .update(p.idPpm, {
            ...p,
            signataire: this.signataire(),
            dateSignature: this.dateSignature(),
            motifMaj: this.motif().trim(),
            justificationFiche: this.justifFiche().trim() || undefined,
          })
          .pipe(
            tap((maj) => {
              this.ppm.set(maj);
              this.justifFiche.set(maj.justificationFiche ?? '');
            }),
          ),
      );
    }
    for (const { idDetail, type } of this.lignesJustifModifiees()) {
      const m = this.marches().find((x) => x.idDetail === idDetail);
      if (!m) {
        continue;
      }
      const valeur = this.justifLigneValeur(idDetail, type).trim() || undefined;
      const corps: Marche = {
        ...m,
        justifModeDerogatoire: type === 'mode' ? valeur : m.justifModeDerogatoire,
        justifDelaiAmenage: type === 'delai' ? valeur : m.justifDelaiAmenage,
      };
      const cle = this.cleJustif(idDetail, type);
      taches.push(
        this.marcheService.update(idDetail, corps).pipe(
          tap((maj) => {
            this.marches.update((arr) => arr.map((x) => (x.idDetail === idDetail ? maj : x)));
            this.justifLigneDrafts.update((map) => {
              const copie = new Map(map);
              copie.delete(cle);
              return copie;
            });
          }),
        ),
      );
    }
    if (!taches.length) {
      return;
    }
    this.enregistrement.set(true);
    forkJoin(taches).subscribe({
      next: () => {
        this.enregistrement.set(false);
        this.toast.success('Modifications enregistrées.');
      },
      error: (e: ApiError) => {
        this.enregistrement.set(false);
        if (estConflitVersion(e)) {
          this.charger(); // Toast centralisé « Donnée modifiée entre-temps » ; on repart de l'état serveur.
          return;
        }
        this.toast.error(e.message || 'Enregistrement impossible.');
      },
    });
  }

  /** Marchés + statut de changement, lignes supprimées rejetées en fin de tableau. */
  readonly lignes = computed<LigneAffichee[]>(() => {
    const parOrigine = new Map<number, LigneDiff>();
    for (const l of this.diff()?.lignes ?? []) {
      parOrigine.set(l.idLigneOrigine, l);
    }
    return [...this.marches()]
      .map((m) => ({ marche: m, diff: m.idLigneOrigine != null ? parOrigine.get(m.idLigneOrigine) : undefined }))
      .sort((a, b) => Number(a.marche.supprimee ?? false) - Number(b.marche.supprimee ?? false));
  });

  /**
   * ⚠️ 2026-08-05 — types du référentiel constituant le DOSSIER HISTORIQUE d'une version : PV du
   * dossier précédent (22) et PPM daté et signé d'une version antérieure (23). Joints par le serveur,
   * ils sont présentés à part et NON remplaçables : la PRMP n'a rien à y redéposer.
   */
  private static readonly TYPES_HISTORIQUE = new Set([22, 23]);
  readonly piecesHistorique = computed(() => this.pieces().filter((p) => MiseAJourPpm.TYPES_HISTORIQUE.has(p.idTypePiece)));

  /**
   * Types de pièce attendus (hors historique, joint par le serveur). Les pièces sont **reprises du
   * dossier d'origine** : chaque rang montre donc le fichier en place, remplaçable.
   * ⚠️ Demande user (2026-09-01, allégée 03/09) — mêmes règles qu'à la création : seules les
   * OBLIGATOIRES sont listées. La pièce AGPM n'est plus requise (backend `4473fe7` — le projet
   * d'AGPM dérivé tient ce rôle) et redevient une optionnelle : ni proposée ni affichée ; une
   * optionnelle reprise du dossier précédent reste attachée, simplement sans rang ici.
   */
  readonly typesADeposer = computed(() =>
    this.typesPiece()
      .filter((t) => !MiseAJourPpm.TYPES_HISTORIQUE.has(t.idTypePiece))
      .filter((t) => t.obligatoire)
      // Même ordre qu'à la saisie : le référentiel porte un `ordre` d'affichage.
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)));
  /** Pièce en place pour ce type (reprise du dossier précédent, ou déposée ici), s'il y en a une. */
  pieceDe(idTypePiece: number): PieceJointeDossier | undefined {
    return this.pieces().find((p) => p.idTypePiece === idTypePiece);
  }

  /**
   * ⚠️ 2026-08-06 (demande user) — pièce dont la mise à jour attend NÉCESSAIREMENT une nouvelle version :
   * le plan de passation daté et signé est l'objet même de la mise à jour, le reprendre tel quel n'aurait
   * pas de sens. Signalé pour que la reprise ne soit pas prise pour un acquis.
   */
  aRenouveler(t: TypePieceJointe): boolean {
    return t.idTypePiece === MiseAJourPpm.TYPE_PLAN_SIGNE;
  }
  private static readonly TYPE_PLAN_SIGNE = 1;
  readonly piecesManquantes = computed(() =>
    this.typesADeposer().filter((t) => t.obligatoire && !this.pieces().some((p) => p.idTypePiece === t.idTypePiece)));

  readonly recap = computed(() => this.diff()?.recap ?? null);
  /** Une mise à jour n'a d'intérêt que si elle change quelque chose. */
  readonly sansChangement = computed(() => {
    const r = this.recap();
    return !!r && r.modifiees === 0 && r.nouvelles === 0 && r.supprimees === 0 && r.restaurees === 0;
  });
  readonly enteteModifiee = computed(() => {
    const p = this.ppm();
    return !!p && (this.signataire() !== (p.signataire ?? '')
      || this.dateSignature() !== (p.dateSignature ?? '')
      || this.motif() !== (p.motifMaj ?? '')
      || this.justifFiche() !== (p.justificationFiche ?? ''));
  });
  /** Justifs de ligne dont le brouillon diffère du marché (à écrire au prochain « Enregistrer »). */
  readonly lignesJustifModifiees = computed<{ idDetail: number; type: 'mode' | 'delai' }[]>(() => {
    const out: { idDetail: number; type: 'mode' | 'delai' }[] = [];
    for (const cle of this.justifLigneDrafts().keys()) {
      const [idStr, type] = cle.split(':') as [string, 'mode' | 'delai'];
      const idDetail = Number(idStr);
      if (this.justifLigneModifiee(idDetail, type)) {
        out.push({ idDetail, type });
      }
    }
    return out;
  });
  /** Y a-t-il quelque chose à enregistrer ? (en-tête OU au moins une justif de ligne) — pilote le bouton unique. */
  readonly aDesModifications = computed(() => this.enteteModifiee() || this.lignesJustifModifiees().length > 0);

  constructor() {
    this.charger();
  }

  private charger(): void {
    this.chargement.set(true);
    // Une seule vague : dossier, versions, marchés, pièces et référentiels des libellés.
    forkJoin({
      dossier: this.dossierService.getById(this.idDossier),
      versions: this.majService.versions(this.idDossier).pipe(catchError(() => of([] as Dossier[]))),
      diff: this.majService.diff(this.idDossier).pipe(catchError(() => of(null))),
      marches: this.marcheService.list(),
      pieces: this.pieceService.getByDossier(this.idDossier),
      typesPiece: this.typePieceService.list().pipe(catchError(() => of([] as TypePieceJointe[]))),
      entites: this.entiteService.list().pipe(catchError(() => of([] as EntiteContract[]))),
      // Référentiels d'affichage du tableau (mêmes colonnes que la grille de saisie).
      benefs: this.benefService.list().pipe(catchError(() => of([] as ServiceBeneficiaire[]))),
      natures: this.natureService.list().pipe(catchError(() => of([] as Nature[]))),
      modes: this.modeService.list().pipe(catchError(() => of([] as ModePassation[]))),
      // ⚠️ Parité création (2026-09-08) — pour DÉRIVER la fiche de présentation (dérogatoires / délais /
      // contrats-cadres) et donc valider les justifications, comme à la création / au détail PPM.
      capms: this.capmService.getAll().pipe(catchError(() => of([] as Capm[]))),
      previsions: this.previsionService.list().pipe(catchError(() => of([] as MarchePrevision[]))),
    }).subscribe({
      next: (r) => {
        this.dossier.set(r.dossier);
        this.precedent.set(r.versions.find((v) => v.idDossier === r.dossier.idDossierParent) ?? null);
        this.diff.set(r.diff);
        const miennes = r.marches.filter((m) => m.idDossier === this.idDossier);
        this.marches.set(miennes);
        this.pieces.set(r.pieces);
        this.libellesPiece.set(new Map(r.typesPiece.map((t) => [t.idTypePiece, t.libellePiece ?? ''])));
        // Types attendus pour la famille du dossier (le référentiel est global : on filtre).
        this.typesPiece.set(r.typesPiece.filter((t) => t.idTypeDossier === r.dossier.idTypeDossier));
        this.libelleEntite.set(
          r.entites.find((e) => e.idEntiteContract === r.dossier.idEntiteContract)?.libelleEntite ?? '',
        );
        this.benefs.set(r.benefs);
        this.natures.set(new Map(r.natures.map((n) => [n.idNature, n.libelle ?? ''])));
        this.modes.set(new Map(r.modes.map((m) => [m.idMode, m.libelle ?? ''])));
        this.modesRef.set(r.modes);
        // ⚠️ Parité création (2026-09-08) — CAPM + prévisions des lignes de cette version, pour dériver la fiche.
        this.capms.set(r.capms);
        const idsDetail = new Set(miennes.map((m) => m.idDetail));
        this.previsions.set(r.previsions.filter((p) => idsDetail.has(p.idDetail)));
        // En-tête du PPM : GET /api/ppms exclut les brouillons → lecture à l'unité via une ligne.
        const idPpm = miennes[0]?.idPpm;
        if (idPpm == null) {
          this.chargement.set(false);
          return;
        }
        this.ppmService.getById(idPpm).subscribe({
          next: (p) => {
            this.ppm.set(p);
            this.signataire.set(p.signataire ?? '');
            this.dateSignature.set(p.dateSignature ?? '');
            this.motif.set(p.motifMaj ?? '');
            this.justifFiche.set(p.justificationFiche ?? '');
            this.chargement.set(false);
          },
          error: () => this.chargement.set(false),
        });
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        this.toast.error(e.message || 'Mise à jour introuvable.');
      },
    });
  }

  /** Recharge marchés + diff après une mutation (le diff est recalculé serveur tant que brouillon). */
  private rafraichir(): void {
    forkJoin({
      marches: this.marcheService.list(),
      diff: this.majService.diff(this.idDossier).pipe(catchError(() => of(null))),
    }).subscribe(({ marches, diff }) => {
      this.marches.set(marches.filter((m) => m.idDossier === this.idDossier));
      this.diff.set(diff);
    });
  }

  // ------------------------------------------------------------------ lignes

  /** Bénéficiaires d'une ligne ; au moins une entrée pour que la ligne s'affiche même sans bénéficiaire. */
  benefsDe(m: Marche): (ServiceBeneficiaire | null)[] {
    const l = this.benefs().filter((b) => b.idDetail === m.idDetail);
    return l.length ? l : [null];
  }
  libelleNature(m: Marche): string {
    return m.idNature == null ? '—' : (this.natures().get(m.idNature) ?? '—');
  }
  libelleMode(m: Marche): string {
    return m.idMode == null ? '—' : (this.modes().get(m.idMode) ?? '—');
  }
  libelleForme(m: Marche): string {
    return m.formeMarche ? FORME_MARCHE_LIBELLES[m.formeMarche] ?? m.formeMarche : '—';
  }
  /** Montant au format français, comme la grille de saisie (espaces fines, 2 décimales). */
  montant(v?: number | null): string {
    return v == null ? '—' : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  supprimerLigne(m: Marche): void {
    this.majService.supprimerLigne(m.idDetail).subscribe({
      next: () => this.rafraichir(),
      error: (e: ApiError) => this.toast.error(e.message || 'Suppression impossible.'),
    });
  }

  restaurerLigne(m: Marche): void {
    this.majService.restaurerLigne(m.idDetail).subscribe({
      next: () => this.rafraichir(),
      error: (e: ApiError) => this.toast.error(e.message || 'Restauration impossible.'),
    });
  }

  ajouterLigne(): void {
    const p = this.ppm();
    if (!p) {
      return;
    }
    this.enregistrement.set(true);
    this.marcheService
      // `idDetail` est alloué par le serveur (séquence) : la valeur envoyée est ignorée.
      .create({ idDetail: 0, idDossier: this.idDossier, idPpm: p.idPpm, designationMarche: 'Nouvelle ligne', statut: 'PREVU' })
      .subscribe({
        next: () => {
          this.enregistrement.set(false);
          this.rafraichir();
          // La ligne créée est vierge : son contenu se saisit dans le détail PPM partagé, la même
          // grille qu'à la saisie initiale (nature, mode, bénéficiaires, lots, dates).
          this.toast.info('Ligne ajoutée — complétez-la dans « Modifier le détail ».');
        },
        error: (e: ApiError) => {
          this.enregistrement.set(false);
          this.toast.error(e.message || 'Ajout impossible.');
        },
      });
  }

  /**
   * ⚠️ Voie NORMALE d'une mise à jour (demande user 2026-08-05) : la PRMP importe le PPM modifié, comme
   * à la création. Le serveur parse le PDF, rapproche ses lignes de celles de la version et renvoie le
   * diff — rien n'est définitif tant que la mise à jour n'est pas créée.
   */
  importerPpm(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (!fichier) {
      return;
    }
    const erreurFichier = validerFichier(fichier, TYPES_PDF);
    if (erreurFichier) {
      this.toast.error(erreurFichier);
      return;
    }
    this.enregistrement.set(true);
    this.majService.importerMiseAJour(this.idDossier, fichier).subscribe({
      next: (diff) => {
        this.enregistrement.set(false);
        this.diff.set(diff);
        // Les lignes ont changé côté serveur : on relit tout pour que le tableau suive.
        this.charger();
        const r = diff.recap;
        this.toast.success(
          `PPM importé — ${r.modifiees} modifiée(s), ${r.nouvelles} nouvelle(s), ${r.supprimees} supprimée(s). Vérifiez avant de créer la mise à jour.`,
        );
      },
      // ⚠️ Pas de toast ici : l'intercepteur d'erreurs affiche déjà le message du serveur (sinon il
      // paraît en double — très voyant sur le refus de changement d'entité, qui est long).
      error: () => this.enregistrement.set(false),
    });
    input.value = '';
  }

  /**
   * Ouvre le détail PPM partagé en ÉDITION : c'est lui qui porte déjà la saisie fine (bénéficiaires,
   * lots, dates prévisionnelles) sur un brouillon. Inutile d'en refaire une ici — et l'expérience reste
   * identique à celle de la saisie initiale.
   */
  ouvrirDetailComplet(): void {
    this.detailOuvert.set(true);
  }

  /** À la fermeture, on recharge tout : le détail a pu toucher les lignes comme l'en-tête. */
  fermerDetailComplet(): void {
    this.detailOuvert.set(false);
    this.charger();
  }

  // ------------------------------------------------------------------ pièces jointes

  /**
   * Dépose (ou remplace) la pièce d'un type. Le remplacement suit le même ordre prudent qu'ailleurs :
   * la nouvelle est déposée d'abord, l'ancienne retirée seulement après — jamais de trou.
   */
  deposerPiece(idTypePiece: number, evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const fichier = input.files?.[0];
    if (!fichier) {
      return;
    }
    const erreurFichier = validerFichier(fichier);
    if (erreurFichier) {
      this.toast.error(erreurFichier);
      input.value = '';
      return;
    }
    const ancienne = this.pieceDe(idTypePiece);
    const fd = new FormData();
    fd.append('data', new Blob([JSON.stringify({ idDossier: this.idDossier, idTypePiece })],
      { type: 'application/json' }));
    fd.append('fichier', fichier);
    this.enregistrement.set(true);
    const recharger = () => this.pieceService.getByDossier(this.idDossier).subscribe((p) => this.pieces.set(p));
    this.pieceService.upload(fd).subscribe({
      next: () => {
        if (!ancienne?.idPiece) {
          this.enregistrement.set(false);
          recharger();
          this.toast.success('Pièce déposée.');
          return;
        }
        this.pieceService.delete(ancienne.idPiece).subscribe({
          next: () => {
            this.enregistrement.set(false);
            recharger();
            this.toast.success('Pièce remplacée.');
          },
          error: () => {
            this.enregistrement.set(false);
            recharger();
          },
        });
      },
      error: (e: ApiError) => {
        this.enregistrement.set(false);
        this.toast.error(e.message || 'Dépôt impossible.');
      },
    });
    input.value = '';
  }

  libellePiece(p: PieceJointeDossier): string {
    return this.libellesPiece().get(p.idTypePiece) || ('Pièce n°' + p.idTypePiece);
  }

  /** idPiece dont on télécharge le contenu (désactive/anime le bouton « Voir » le temps du transfert). */
  readonly pieceEnOuverture = signal<number | null>(null);

  /**
   * ⚠️ Demande pilote (2026-09-08) — visualiser une pièce jointe (PV du dossier précédent, PPM antérieurs)
   * dans un nouvel onglet. Contenu binaire via `telecharger()`, ouvert par `ouvrirBlobSur()` : type MIME
   * assaini + révocation différée (cf. AUDIT — jamais `URL.createObjectURL` brut). Le PDF s'affiche inline.
   */
  voirPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) {
      return;
    }
    this.pieceEnOuverture.set(p.idPiece);
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (blob) => {
        this.pieceEnOuverture.set(null);
        ouvrirBlobSur(blob);
      },
      error: (e: ApiError) => {
        this.pieceEnOuverture.set(null);
        this.toast.error(e.message || 'Ouverture de la pièce impossible.');
      },
    });
  }

  // ------------------------------------------------------------------ actions finales

  ouvrirApercu(): void {
    // Le diff est recalculé serveur : on le rafraîchit à l'ouverture pour ne jamais montrer un état périmé.
    this.majService.diff(this.idDossier).subscribe({
      next: (d) => {
        this.diff.set(d);
        this.apercuOuvert.set(true);
      },
      error: (e: ApiError) => this.toast.error(e.message || 'Aperçu indisponible.'),
    });
  }

  creerLaMiseAJour(): void {
    if (!this.motif().trim()) {
      this.toast.error('Le motif de la mise à jour est obligatoire avant de soumettre.');
      return;
    }
    // ⚠️ Parité création (2026-09-08) — miroir de la garde serveur : pas de mise à jour tant qu'un
    // marché dérogatoire / à délai aménagé n'est pas justifié, ni sans la justification globale.
    const manques = this.justificationsManquantes();
    if (manques.length) {
      this.toast.error('Justifications de la fiche de présentation manquantes : ' + manques.join(' ; ') + '.');
      return;
    }
    // Des saisies non enregistrées (en-tête ou justif de ligne) ne sont pas encore côté serveur : il
    // refuserait la soumission — on demande d'enregistrer d'abord avec le bouton « Enregistrer ».
    if (this.aDesModifications()) {
      this.toast.error('Des modifications ne sont pas enregistrées : cliquez « Enregistrer » avant de créer la mise à jour.');
      return;
    }
    this.enregistrement.set(true);
    this.dossierService.soumettre(this.idDossier).subscribe({
      next: (res) => {
        this.enregistrement.set(false);
        this.dossiersRefresh.notifierChangement();
        this.toast.success(
          `Mise à jour créée${res.refeDossier ? ' · réf. ' + res.refeDossier : ''} — la version précédente est désormais « Remplacé ».`,
        );
        void this.router.navigate(['/prmp/dossiers']);
      },
      error: (e: ApiError) => {
        this.enregistrement.set(false);
        this.toast.error(e.message || 'Soumission impossible.');
      },
    });
  }

  abandonner(): void {
    this.enregistrement.set(true);
    this.dossierService.delete(this.idDossier).subscribe({
      next: () => {
        this.enregistrement.set(false);
        this.dossiersRefresh.notifierChangement();
        this.toast.success('Mise à jour abandonnée — le PPM en vigueur est inchangé.');
        void this.router.navigate(['/prmp/dossiers']);
      },
      error: (e: ApiError) => {
        this.enregistrement.set(false);
        this.toast.error(e.message || 'Abandon impossible.');
      },
    });
  }

  // ------------------------------------------------------------------ rendu

  libelleStatut(l: LigneAffichee): string {
    switch (l.diff?.type) {
      case 'MODIFIEE': return 'Modifiée';
      case 'NOUVELLE': return 'Nouvelle';
      case 'SUPPRIMEE': return 'Supprimée';
      case 'RESTAUREE': return 'Restaurée';
      case 'INCHANGEE': return 'Inchangée';
      default: return '—';
    }
  }
  classeStatut(l: LigneAffichee): string {
    return 'maj__ligne--' + (l.diff?.type ?? 'INCONNU').toLowerCase();
  }
  /** Libellé lisible d'un champ technique du diff. */
  libelleChamp(champ: string): string {
    return CHAMPS_LISIBLES[champ] ?? champ;
  }
  valeurOuTiret(v?: string): string {
    return v === null || v === undefined || v === '' ? '—' : v;
  }
}

/** Traduction des champs comparés par le serveur, pour un diff lisible par le métier. */
const CHAMPS_LISIBLES: Record<string, string> = {
  designationMarche: 'Objet',
  montEstim: 'Montant estimatif',
  nouvMontEstim: 'Nouveau montant estimatif',
  numCompte: 'Compte',
  financement: 'Financement',
  statut: 'Statut',
  idNature: 'Nature',
  idMode: 'Mode de passation',
  formeMarche: 'Forme du marché',
  beneficiaires: 'Services bénéficiaires',
  lots: 'Lots',
  processus: 'Dates prévisionnelles',
};
