import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { ToastService } from '../../core/notifications/toast.service';
import { urlBlobSure } from '../../core/securite/fichiers-surs';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { ExamenDetail, ExamenPiece, Marche, ObservationControle, PieceJointeDossier, PvExamen } from '../../models';
import {
  AvisService,
  ControleurService,
  ExamenDetailService,
  ExamenPieceService,
  MarcheService,
  PieceJointeDossierService,
  PointsCtrlService,
  PvExamenService,
  ReferenceLookupService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Modal « Détail PV » réutilisable (lecture seule) — MÊME MODÈLE que l'écran « Projets de PV » :
 * en-tête en tuiles (avis en badge coloré), synthèse encadrée, grille de contrôle GROUPÉE par ligne
 * de marché avec bascule « observations seulement / tout afficher », section « Pièces jointes »
 * (résultats t_examen_piece, même bascule), signataires, téléchargement du PDF officiel.
 *
 * Reçoit le `PvExamen` déjà chargé (DTO complet de la liste) et charge en UNE vague la grille, les
 * pièces examinées et les marchés (libellés via référentiels en cache). Émet `(fermer)`.
 */
@Component({
  selector: 'app-detail-pv-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, StatutBadge],
  template: `
    <div class="modal-backdrop" (click)="fermer.emit()">
      <div class="modal modal-lg" role="dialog" aria-modal="true" aria-label="Détail du PV" appModale (appModaleFermer)="fermer.emit()" (click)="$event.stopPropagation()">
        <!-- En-tête -->
        <div class="modal-header">
          <div>
            <div class="dpv-head-top">
              <app-statut-badge [statut]="pv().statutPv" [label]="'Définitif'" />
              <span class="text-muted text-sm">{{ pv().datePv || '—' }}</span>
            </div>
            <h2 class="modal-title">{{ pv().refePv || pv().referencePv || ('PV #' + pv().idPv) }}</h2>
          </div>
          <button type="button" class="btn-close" aria-label="Fermer" (click)="fermer.emit()">✕</button>
        </div>

        <div class="modal-body">
          <!-- Métadonnées en tuiles (même modèle que l'en-tête des Projets de PV). -->
          <div class="section-block">
            <div class="dpv-tuiles">
              <div class="dpv-tuile">
                <span class="dpv-tuile__lbl">Avis global</span>
                <span class="dpv-tuile__val">
                  @if (pv().idAvis) {
                    <span [class]="avisClasse(pv().idAvis)">{{ avisLabel(pv().idAvis) }}</span>
                  } @else {
                    <span class="dpv-attente">En attente de clôture de navette</span>
                  }
                </span>
              </div>
              <div class="dpv-tuile">
                <span class="dpv-tuile__lbl">Navettes</span>
                <span class="dpv-tuile__val">{{ pv().nbNavettes }}</span>
              </div>
              @if (pv().dateSoumissionInitiale) {
                <div class="dpv-tuile">
                  <span class="dpv-tuile__lbl">Soumis le</span>
                  <span class="dpv-tuile__val cnm-mono">{{ pv().dateSoumissionInitiale }}</span>
                </div>
              }
              @if (pv().dateAcceptation) {
                <div class="dpv-tuile">
                  <span class="dpv-tuile__lbl">Accepté le</span>
                  <span class="dpv-tuile__val cnm-mono">{{ pv().dateAcceptation }}</span>
                </div>
              }
              @if (pv().datePv) {
                <div class="dpv-tuile">
                  <span class="dpv-tuile__lbl">Date PV</span>
                  <span class="dpv-tuile__val cnm-mono">{{ pv().datePv }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Synthèse du Membre (panneau à liseré, même modèle). -->
          @if (pv().syntheseObservations) {
            <div class="section-block">
              <div class="dpv-synthese-box">
                <span class="dpv-synthese-box__lbl">Synthèse des observations du Membre</span>
                <p class="dpv-synthese-box__texte">{{ pv().syntheseObservations }}</p>
              </div>
            </div>
          }

          <!-- Signataires -->
          <div class="section-block">
            <h3 class="dpv-sub">Signataires</h3>
            <table class="dpv-detail-table">
              <tbody>
                <tr><td>Membre</td><td>{{ signataire(pv().imCtrlMembre, pv().dateSignatureMembre) }}</td></tr>
                <tr><td>Chef de commission</td><td>{{ signataire(pv().imCtrlCc, pv().dateSignatureCc) }}</td></tr>
                <tr><td>Président</td><td>{{ signataire(pv().imCtrlPresident, pv().dateSignaturePresident) }}</td></tr>
                <tr><td>Secrétaire de séance</td><td>{{ pv().nomSecretaireSeance || '—' }}</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Grille de contrôle : groupée par ligne de marché, observations seulement par défaut. -->
          <div class="section-block">
            <div class="dpv-grille-head">
              <h3 class="dpv-sub">Grille de contrôle</h3>
              @if (!loadingGrille() && details().length) {
                <button type="button" class="btn btn-secondary btn-sm" (click)="grilleComplete.set(!grilleComplete())">
                  {{ grilleComplete() ? 'Observations seulement (' + nbObservations() + ')' : 'Tout afficher (' + details().length + ')' }}
                </button>
              }
            </div>
            @if (loadingGrille()) {
              <div class="spinner-wrap"><div class="spinner"></div></div>
            } @else if (details().length && !groupesAffiches().length) {
              <p class="dpv-ok">✓ Tous les points de contrôle sont conformes — aucune observation.</p>
            } @else if (details().length && groupesAffiches().length) {
              <table class="dpv-grille-table">
                <thead>
                  <tr><th>Point de contrôle</th><th>Résultat</th><th>Observation</th></tr>
                </thead>
                <tbody>
                  @for (g of groupesAffiches(); track g.cle) {
                    <tr class="dpv-grp"><td colspan="3">{{ g.titre }}</td></tr>
                    @for (d of g.rows; track d.idDetailExamen) {
                      <tr>
                        <td>{{ pointLabel(d.idPtControle) }}</td>
                        <td [class.text-danger]="!d.conforme">{{ d.conforme ? 'Conforme' : 'Non conforme' }}</td>
                        <td>
                          @if (!d.conforme && observationsTriees(d).length) {
                            <div class="dpv-obs-box">
                              @for (o of observationsTriees(d); track o.idObservation ?? $index) {
                                <div><strong>Au lieu de :</strong> {{ o.auLieuDe || '—' }}<br /><strong>Lire :</strong> {{ o.lire || '—' }}</div>
                              }
                            </div>
                          } @else {
                            <span class="text-muted">—</span>
                          }
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            } @else {
              <p class="text-muted">Aucun détail d'examen pour ce PV.</p>
            }
          </div>

          <!-- Pièces jointes : mêmes règles (observations seulement par défaut). -->
          <div class="section-block">
            <div class="dpv-grille-head">
              <h3 class="dpv-sub">Pièces jointes</h3>
              @if (!loadingGrille() && examenPieces().length) {
                <button type="button" class="btn btn-secondary btn-sm" (click)="piecesCompletes.set(!piecesCompletes())">
                  {{ piecesCompletes() ? 'Observations seulement (' + nbObservationsPieces() + ')' : 'Tout afficher (' + examenPieces().length + ')' }}
                </button>
              }
            </div>
            @if (!loadingGrille()) {
              @if (examenPieces().length && !piecesAffichees().length) {
                <p class="dpv-ok">✓ Toutes les pièces jointes sont conformes — aucune observation.</p>
              } @else if (examenPieces().length && piecesAffichees().length) {
                <table class="dpv-grille-table">
                  <thead><tr><th>Pièce</th><th>Résultat</th><th>Observation</th></tr></thead>
                  <tbody>
                    @for (ep of piecesAffichees(); track ep.idExamenPiece) {
                      <tr>
                        <td>{{ pieceLabel(ep.idPiece) }}</td>
                        <td [class.text-danger]="!ep.conforme">{{ ep.conforme ? 'Conforme' : 'Non conforme' }}</td>
                        <td>{{ ep.observation || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else {
                <p class="text-muted">Aucun examen de pièce pour ce PV.</p>
              }
            }
          </div>
        </div>

        <!-- Pied -->
        <div class="modal-footer modal-footer-spaced">
          @if (pv().documentDisponible === false) {
            <span class="text-muted text-sm">Aucun PDF officiel : ce PV n'est pas éligible à la génération de document.</span>
          } @else {
            <span class="text-muted text-sm">Document officiel signé</span>
            <button type="button" class="btn btn-secondary" [disabled]="chargementPdf()" (click)="afficherPdf()">
              {{ chargementPdf() ? 'Chargement…' : '📄 Afficher' }}
            </button>
          }
        </div>
      </div>
    </div>

    <!-- Visionneuse du PDF officiel signé (même modèle que « PV définitifs » PRMP) : le lecteur du
         navigateur offre déjà impression / enregistrement. -->
    @if (apercu(); as ap) {
      <div class="modal-backdrop" (click)="fermerApercu()">
        <div class="modal modal-lg dpv-viewer" role="dialog" aria-modal="true" aria-label="Visionneuse du PV" appModale (appModaleFermer)="fermerApercu()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="dpv-head-top">
                <app-statut-badge [statut]="pv().statutPv" [label]="'Définitif'" />
                <span class="text-muted text-sm">Document officiel signé</span>
              </div>
              <h2 class="modal-title">{{ ap.reference }}</h2>
            </div>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerApercu()">✕</button>
          </div>
          <div class="modal-body dpv-viewer-body">
            <iframe [src]="ap.url" [title]="ap.reference" class="dpv-viewer-frame"></iframe>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .dpv-head-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .dpv-sub { margin: 0 0 8px; font-size: var(--text-md); font-weight: 700; color: var(--n-800); }
    /* Tuiles de métadonnées (même langage que l'en-tête des Projets de PV). */
    .dpv-tuiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem 1rem; background: var(--c-50); border: 1px solid var(--c-100); border-radius: var(--radius-lg); padding: 0.875rem 1rem; }
    .dpv-tuile { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
    .dpv-tuile__lbl { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--n-400); }
    .dpv-tuile__val { font-weight: 600; color: var(--n-700); overflow-wrap: anywhere; }
    .dpv-tuile__val .badge { font-weight: 700; }
    .dpv-attente { font-weight: 500; font-style: italic; color: var(--n-400); }
    /* Synthèse : panneau à liseré accent. */
    .dpv-synthese-box { display: flex; flex-direction: column; gap: 0.3rem; background: var(--c-50); border: 1px solid var(--c-100); border-left: 3px solid var(--c-500, #4f46e5); border-radius: var(--radius-md); padding: 0.75rem 1rem; }
    .dpv-synthese-box__lbl { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: var(--c-800); }
    .dpv-synthese-box__texte { margin: 0; font-size: var(--text-sm); color: var(--n-700); white-space: pre-wrap; }
    /* Titre + bascule ; constat « tout conforme ». */
    .dpv-grille-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 8px; }
    .dpv-grille-head .dpv-sub { margin: 0; }
    .dpv-ok { margin: 0; padding: 0.5rem 0.75rem; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-md); color: #15803D; font-size: var(--text-sm); font-weight: 600; }
    .dpv-detail-table { width: 100%; font-size: var(--text-base); border-collapse: collapse; }
    .dpv-detail-table td { padding: 5px 0; vertical-align: top; }
    .dpv-detail-table td:first-child { color: var(--n-400); width: 160px; }
    /* Modal élargi : la grille (point / résultat / observation) chevauchait ses colonnes à 860px. */
    .modal.modal-lg { max-width: 1100px; }
    /* Visionneuse PDF : le corps du modal est entièrement occupé par le document. */
    .dpv-viewer-body { padding: 0; }
    .dpv-viewer-frame { display: block; width: 100%; height: 75vh; border: 0; }
    .dpv-grille-table { width: 100%; font-size: var(--text-sm); border-collapse: collapse; table-layout: fixed; }
    /* Répartition : le libellé (point / pièce) et l'observation portent les textes longs, le résultat est court. */
    .dpv-grille-table th:nth-child(1) { width: 45%; }
    .dpv-grille-table th:nth-child(2) { width: 15%; }
    .dpv-grille-table th:nth-child(3) { width: 40%; }
    .dpv-grille-table th { text-align: left; padding: 8px 10px; background: var(--n-50); border-bottom: 0.5px solid var(--n-200); font-weight: 600; color: var(--n-500); }
    /* white-space normal : le design system pose nowrap sur les td/th nus — sans lui, un libellé
       long ne se coupe jamais et déborde sur la colonne voisine. */
    .dpv-grille-table th, .dpv-grille-table td { white-space: normal; }
    .dpv-grille-table td { padding: 8px 10px; border-bottom: 0.5px solid var(--n-100); vertical-align: top; word-wrap: break-word; }
    /* Rangée d'en-tête de groupe (ligne de marché / dossier). */
    .dpv-grp td { background: var(--c-50); color: var(--c-800); font-weight: 700; font-size: var(--text-sm); border-top: 2px solid var(--c-100); }
    .dpv-obs-box { background: var(--n-50); border-radius: var(--radius-md); padding: 8px 10px; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 6px; }
  `,
})
export class DetailPvModal implements OnInit {
  /** PV à détailler (DTO complet issu de la liste). */
  readonly pv = input.required<PvExamen>();
  /** Fermeture demandée (× / backdrop). */
  readonly fermer = output<void>();

  private readonly pvService = inject(PvExamenService);
  private readonly detailService = inject(ExamenDetailService);
  private readonly examenPieceService = inject(ExamenPieceService);
  private readonly marcheService = inject(MarcheService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly details = signal<ExamenDetail[]>([]);
  readonly loadingGrille = signal(true);
  /** Résultats d'examen des pièces jointes du PV (t_examen_piece) + libellés des pièces. */
  readonly examenPieces = signal<ExamenPiece[]>([]);
  private readonly piecesDossier = signal<PieceJointeDossier[]>([]);
  /** Marchés du dossier du PV (ordre de l'examen), résolus via l'idDetail des résultats. */
  private readonly marchesDossier = signal<Marche[]>([]);
  private readonly avisMap = signal<Map<string, string>>(new Map());
  private readonly pointsMap = signal<Map<string, string>>(new Map());
  private readonly controleurMap = signal<Map<string, string>>(new Map());

  /** Bascules « observations seulement (défaut) ↔ tout afficher » — même modèle que Projets de PV. */
  readonly grilleComplete = signal(false);
  readonly piecesCompletes = signal(false);
  readonly nbObservations = computed(() => this.details().filter((d) => !d.conforme).length);
  readonly nbObservationsPieces = computed(() => this.examenPieces().filter((p) => !p.conforme).length);
  readonly piecesAffichees = computed(() =>
    this.piecesCompletes() ? this.examenPieces() : this.examenPieces().filter((p) => !p.conforme),
  );

  /** Grille groupée : « Ligne N — désignation » puis « Dossier — points inter-lignes » (repli « Marché #id »). */
  readonly groupesGrille = computed(() => {
    const parCle = new Map<number | 'D', ExamenDetail[]>();
    for (const d of this.details()) {
      const k = d.idDetail ?? 'D';
      const arr = parCle.get(k) ?? [];
      arr.push(d);
      parCle.set(k, arr);
    }
    const groupes: { cle: string; titre: string; rows: ExamenDetail[] }[] = [];
    this.marchesDossier().forEach((m, i) => {
      const rows = parCle.get(m.idDetail);
      if (rows?.length) {
        groupes.push({ cle: 'M' + m.idDetail, titre: `Ligne ${i + 1} — ${m.designationMarche || 'Marché #' + m.idDetail}`, rows });
        parCle.delete(m.idDetail);
      }
    });
    for (const [k, rows] of parCle) {
      if (k !== 'D') {
        groupes.push({ cle: 'M' + k, titre: `Marché #${k}`, rows });
      }
    }
    const dossierRows = parCle.get('D');
    if (dossierRows?.length) {
      groupes.push({ cle: 'D', titre: 'Dossier — points inter-lignes', rows: dossierRows });
    }
    return groupes;
  });
  readonly groupesAffiches = computed(() => {
    if (this.grilleComplete()) {
      return this.groupesGrille();
    }
    return this.groupesGrille()
      .map((g) => ({ ...g, rows: g.rows.filter((d) => !d.conforme) }))
      .filter((g) => g.rows.length > 0);
  });

  ngOnInit(): void {
    this.lookups.lookup(AvisService, 'idAvis', ['libelleAvis']).subscribe((m) => this.avisMap.set(m));
    this.lookups.lookup(PointsCtrlService, 'idPointCtrl', ['libelPointCtrl']).subscribe((m) => this.pointsMap.set(m));
    this.lookups
      .lookup(ControleurService, 'imControleur', ['nomCont', 'prenomsCont'])
      .subscribe((m) => this.controleurMap.set(m));
    // UNE vague : grille + pièces examinées + marchés, puis pièces du dossier (libellés) via l'idDossier
    // résolu depuis les marchés des résultats — cf. [[modals-une-seule-vague]].
    const idExamen = this.pv().idExamen;
    forkJoin({
      details: this.detailService.list(),
      examenPieces: this.examenPieceService.list().pipe(catchError(() => of([] as ExamenPiece[]))),
      marches: this.marcheService.list().pipe(catchError(() => of([] as Marche[]))),
    })
      .pipe(
        switchMap(({ details, examenPieces, marches }) => {
          const miens = details.filter((d) => d.idExamen === idExamen);
          const idsDetails = new Set(miens.map((d) => d.idDetail).filter((x): x is number => x != null));
          const idDossier = marches.find((m) => idsDetails.has(m.idDetail))?.idDossier ?? null;
          const marchesDossier = idDossier != null ? marches.filter((m) => m.idDossier === idDossier) : [];
          const pieces$ =
            idDossier != null
              ? this.pieceService.getByDossier(idDossier).pipe(catchError(() => of([] as PieceJointeDossier[])))
              : of([] as PieceJointeDossier[]);
          return pieces$.pipe(map((pieces) => ({ miens, examenPieces, marchesDossier, pieces })));
        }),
      )
      .subscribe({
        next: ({ miens, examenPieces, marchesDossier, pieces }) => {
          this.details.set(miens);
          this.marchesDossier.set(marchesDossier);
          this.piecesDossier.set(pieces);
          const ordre = new Map(pieces.map((p, i) => [p.idPiece, i]));
          this.examenPieces.set(
            examenPieces
              .filter((x) => x.idExamen === idExamen)
              .sort((a, b) => (ordre.get(a.idPiece) ?? 999) - (ordre.get(b.idPiece) ?? 999)),
          );
          this.loadingGrille.set(false);
        },
        error: () => this.loadingGrille.set(false),
      });
  }

  /** Libellé de l'avis — « — » tant qu'il n'est pas posé (clôture de navette, Président/CC). */
  avisLabel(id?: string): string {
    return id ? this.avisMap().get(id) ?? id : '—';
  }
  /** Couleur du badge d'avis : FAVR orange, FAV vert, DEF rouge, autres neutre. */
  avisClasse(id?: string): string {
    const code = (id || '').toUpperCase();
    if (code.startsWith('FAVR')) {
      return 'badge badge-warning';
    }
    if (code.startsWith('FAV')) {
      return 'badge badge-success';
    }
    if (code.startsWith('DEF')) {
      return 'badge badge-danger';
    }
    return 'badge badge-neutral';
  }
  pointLabel(id: number): string {
    return this.pointsMap().get(String(id)) ?? `#${id}`;
  }
  /** Libellé d'une pièce jointe examinée (repli nom de fichier puis #id). */
  pieceLabel(idPiece: number): string {
    const p = this.piecesDossier().find((x) => x.idPiece === idPiece);
    return p?.libellePiece || p?.nomFichier || 'Pièce #' + idPiece;
  }
  /** Signataire : nom du contrôleur (+ date si présente), ou « — ». */
  signataire(im?: string, date?: string): string {
    if (!im) {
      return '—';
    }
    const nom = this.controleurMap().get(im) ?? im;
    return date ? `${nom} · signé le ${date}` : nom;
  }
  /** Lignes « AU LIEU DE / LIRE » du point, triées par `ordre` ASC. */
  observationsTriees(d: ExamenDetail): ObservationControle[] {
    return [...(d.observations ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  }

  /** Visionneuse PDF ouverte : référence + URL blob « de confiance » (null = fermée). */
  readonly apercu = signal<{ reference: string; url: SafeResourceUrl; brute: string } | null>(null);
  readonly chargementPdf = signal(false);

  /**
   * AFFICHE le PDF officiel du PV (`GET /api/pv-examens/{id}/document`) dans une visionneuse (iframe),
   * comme « PV définitifs » côté PRMP — pas de téléchargement forcé, le lecteur du navigateur offre
   * déjà impression / enregistrement. L'URL blob est révoquée à la fermeture.
   */
  afficherPdf(): void {
    this.chargementPdf.set(true);
    this.pvService.document(this.pv().idPv).subscribe({
      next: (blob) => {
        this.chargementPdf.set(false);
        const ref = this.pv().refePv || this.pv().referencePv || 'PV-' + this.pv().idPv;
        const brute = urlBlobSure(blob);
        this.apercu.set({ reference: ref, url: this.sanitizer.bypassSecurityTrustResourceUrl(brute), brute });
      },
      error: (err: HttpErrorResponse) => {
        this.chargementPdf.set(false);
        if (err.status === 404) {
          // Comportement attendu : un PDF n'est généré que pour un avis « Favorable sous réserve » (FAVR),
          // un dossier de localité centrale (ANT) et des marchés tous en appel d'offres ouvert.
          this.toast.info(
            "Ce PV n'a pas de document PDF officiel : il n'est généré que pour un avis « Favorable sous réserve », un dossier de la localité centrale et des marchés tous en appel d'offres ouvert.",
          );
        } else {
          this.toast.error("Impossible d'afficher le document.");
        }
      },
    });
  }
  /** Ferme la visionneuse et libère l'URL blob (l'iframe est détruite en même temps). */
  fermerApercu(): void {
    const ap = this.apercu();
    if (ap) URL.revokeObjectURL(ap.brute);
    this.apercu.set(null);
  }
}
