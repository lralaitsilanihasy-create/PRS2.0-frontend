import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { TYPES_PDF, validerFichier } from '../../core/securite/fichiers-surs';
import {
  DiffDossier,
  Dossier,
  EntiteContract,
  FORME_MARCHE_LIBELLES,
  LigneDiff,
  Marche,
  ModePassation,
  Nature,
  PieceJointeDossier,
  Ppm,
  ServiceBeneficiaire,
  TypePieceJointe,
} from '../../models';
import {
  DossierService,
  EntiteContractService,
  MarcheService,
  MiseAJourPpmService,
  ModePassationService,
  NatureService,
  PieceJointeDossierService,
  PpmService,
  ServiceBeneficiaireService,
  TypePieceJointeService,
} from '../../services';
import { DetailPpmModal } from '../../shared/prmp';
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
  imports: [FormsModule, RouterLink, DossierConsultation, DetailPpmModal],
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
   * ⚠️ 2026-08-05 (demande user) — le tableau reprend la STRUCTURE de la grille de saisie : nature, mode,
   * forme et bloc bénéficiaire. Ces libellés viennent des référentiels, chargés dans la même vague.
   */
  readonly benefs = signal<ServiceBeneficiaire[]>([]);
  private readonly natures = signal<Map<number, string>>(new Map());
  private readonly modes = signal<Map<number, string>>(new Map());

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
   * dossier d'origine** : chaque rang montre donc le fichier en place, remplaçable. Un type sans pièce
   * reste proposé au dépôt — c'est le cas d'une pièce optionnelle absente du dossier précédent.
   */
  readonly typesADeposer = computed(() =>
    this.typesPiece()
      .filter((t) => !MiseAJourPpm.TYPES_HISTORIQUE.has(t.idTypePiece))
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
      || this.motif() !== (p.motifMaj ?? ''));
  });

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

  // ------------------------------------------------------------------ en-tête

  enregistrerEntete(): void {
    const p = this.ppm();
    if (!p) {
      return;
    }
    if (!this.motif().trim()) {
      this.toast.error('Le motif de la mise à jour est obligatoire.');
      return;
    }
    this.enregistrement.set(true);
    this.ppmService
      .update(p.idPpm, { ...p, signataire: this.signataire(), dateSignature: this.dateSignature(), motifMaj: this.motif().trim() })
      .subscribe({
        next: (maj) => {
          this.ppm.set(maj);
          this.enregistrement.set(false);
          this.toast.success('En-tête de la mise à jour enregistré.');
        },
        error: (e: ApiError) => {
          this.enregistrement.set(false);
          this.toast.error(e.message || 'Enregistrement impossible.');
        },
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
