import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { Dossier, Marche, MarchePrevision, PieceJointeDossier, Ppm, ServiceBeneficiaire } from '../../models';
import {
  CapmService,
  CompteService,
  LocaliteService,
  MarcheService,
  MarchePrevisionService,
  ModePassationService,
  PieceJointeDossierService,
  PpmService,
  ReferenceLookupService,
  ServiceBeneficiaireService,
  SoaBeneficiaireService,
  TypeDossierService,
} from '../../services';
import { ToastService } from '../../core/notifications/toast.service';
import { StatutBadge } from '../../shared/circuit';
import { PpmMarchesTable } from '../../shared/prmp/ppm-marches-table';

/**
 * Consultation d'un dossier en LECTURE SEULE (modale réutilisable).
 * - PPM : en-tête du PPM + lignes de marché (mode en libellé).
 * - DAO/MAOO : infos du dossier.
 * Contenu reconstruit via les listes scopées (GET /api/ppms, /api/marches) filtrées par
 * idDossier (1 appel chacun, pas de N+1) ; libellés via référentiels en cache. Aucune action.
 * Mise en forme alignée sur le modal « Détail PPM » (DetailPpmModal).
 */
@Component({
  selector: 'app-dossier-consultation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, PpmMarchesTable],
  template: `
    <div [class.modal-backdrop]="!embedded()" (click)="onOverlayClick()">
      <div
        class="dc"
        [class.dc--embedded]="embedded()"
        (click)="$event.stopPropagation()"
        [attr.role]="embedded() ? null : 'dialog'"
        [attr.aria-modal]="embedded() ? null : 'true'"
      >
        <!-- ── En-tête ── -->
        <div class="dc-header">
          <div class="dc-header-top">
            <div class="dc-chips">
              <span class="dc-chip dc-chip-type">{{ typeLabel() }}</span>
              <app-statut-badge [statut]="dossier().statut" />
            </div>
            @if (!embedded()) {
              <button type="button" class="dc-close" aria-label="Fermer" (click)="closed.emit()">✕</button>
            }
          </div>

          <div class="dc-title">{{ dossier().refeDossier || ('Dossier #' + dossier().idDossier) }}</div>

          <div class="dc-subtitle">
            <i aria-hidden="true">📍</i>
            <span>{{ localiteLabel() }}</span>
            <span class="dc-sep">·</span>
            <i aria-hidden="true">📅</i>
            <span>{{ dossier().dateRef || '—' }}</span>
          </div>

          <div class="dc-meta">
            <div class="dc-meta-row">
              <span class="dc-meta-label">Type</span>
              <span class="dc-meta-value">{{ typeLabel() }}</span>
            </div>
            <div class="dc-meta-row">
              <span class="dc-meta-label">Localité</span>
              <span class="dc-meta-value">{{ localiteLabel() }}</span>
            </div>
            <div class="dc-meta-row">
              <span class="dc-meta-label">Date réf.</span>
              <span class="dc-meta-value">{{ dossier().dateRef || '—' }}</span>
            </div>
            @if (ppm(); as p) {
              <div class="dc-meta-row">
                <span class="dc-meta-label">Référence</span>
                <span class="dc-meta-value">{{ p.reference || '—' }}</span>
              </div>
              <div class="dc-meta-row">
                <span class="dc-meta-label">Exercice</span>
                <span class="dc-meta-value">{{ p.exercice }}</span>
              </div>
              <div class="dc-meta-row">
                <span class="dc-meta-label">Signataire</span>
                <span class="dc-meta-value">{{ p.signataire || '—' }}</span>
              </div>
              <div class="dc-meta-row">
                <span class="dc-meta-label">Date signature</span>
                <span class="dc-meta-value">{{ p.dateSignature || '—' }}</span>
              </div>
              <div class="dc-meta-row">
                <span class="dc-meta-label">Libellé</span>
                <span class="dc-meta-value" [class.dc-meta-empty]="!p.libelle">{{ p.libelle || 'Non renseigné' }}</span>
              </div>
              @if (p.datePpmInit) {
                <div class="dc-meta-row">
                  <span class="dc-meta-label">Établi le</span>
                  <span class="dc-meta-value">{{ p.datePpmInit }}</span>
                </div>
              }
              @if (p.numMaj != null) {
                <div class="dc-meta-row">
                  <span class="dc-meta-label">Mise à jour</span>
                  <span class="dc-meta-value">n° {{ p.numMaj }}{{ p.dateMaj ? ' · ' + p.dateMaj : '' }}</span>
                </div>
              }
            }
          </div>
        </div>

        <!-- ── Corps ── -->
        <div class="dc-body">
          @if (estPpm()) {
            @if (loadingContenu()) {
              <div class="spinner-wrap"><div class="spinner"></div></div>
            } @else {
              <div class="dc-section">
                <div class="dc-section-head">
                  <div class="section-block-title">
                    <div class="section-icon">🏛</div>
                    <span class="section-label">Lignes de marché</span>
                    <span class="section-count">{{ marches().length }} marché(s)</span>
                  </div>
                </div>

                <app-ppm-marches-table [marches]="marches()" [beneficiaires]="serviceBenefs()" [previsions]="previsions()" />
              </div>
            }
          }

          <!-- Pièces jointes (tous dossiers) -->
          <div class="dc-section">
            <div class="dc-section-head">
              <div class="section-block-title">
                <div class="section-icon">📎</div>
                <span class="section-label">Pièces jointes</span>
                <span class="section-count">{{ pieces().length }} pièce(s)</span>
              </div>
            </div>

            @if (loadingPieces()) {
              <div class="spinner-wrap"><div class="spinner"></div></div>
            } @else {
              <div class="pieces-card">
                @if (piecesInitiales().length > 0) {
                  <div class="pieces-group">
                    <div class="pieces-group-hd">
                      <span class="group-pill gp-blue">Pièces initiales</span>
                      <span class="group-count">{{ piecesInitiales().length }} fichier(s)</span>
                    </div>
                    @for (p of piecesInitiales(); track p.idPiece; let i = $index) {
                      <div class="piece-row">
                        <div class="piece-left">
                          <span class="piece-index pi-blue">{{ i + 1 }}</span>
                          <span class="piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                        </div>
                        <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">Ouvrir <span class="arrow">↗</span></button>
                      </div>
                    }
                  </div>
                }

                @if (piecesApresRenvoi().length > 0) {
                  <div class="pieces-group">
                    <div class="pieces-group-hd">
                      <span class="group-pill gp-orange">Après lettre de renvoi</span>
                      <span class="group-count">{{ piecesApresRenvoi().length }} fichier(s)</span>
                    </div>
                    @for (p of piecesApresRenvoi(); track p.idPiece; let i = $index) {
                      <div class="piece-row">
                        <div class="piece-left">
                          <span class="piece-index pi-orange">{{ i + 1 }}</span>
                          <span class="piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                          <span class="lr-tag">LR</span>
                        </div>
                        <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">Ouvrir <span class="arrow">↗</span></button>
                      </div>
                    }
                  </div>
                }

                @if (pieces().length === 0) {
                  <div class="empty-state">
                    <span class="empty-state-icon" aria-hidden="true">📭</span>
                    <span class="empty-state-text">Aucune pièce jointe.</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- ── Pied ── -->
        @if (!embedded()) {
          <footer class="dc-foot">
            <div class="dc-foot-info">
              @if (estPpm()) { <strong>{{ marches().length }}</strong> marché(s) · }
              <strong>{{ pieces().length }}</strong> pièce(s) jointe(s)
            </div>
            <button type="button" class="btn btn-ghost" (click)="closed.emit()">Fermer</button>
          </footer>
        }
      </div>
    </div>
  `,
  styles: `
    .dc {
      width: 100%;
      max-width: min(96rem, 98vw);
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 0 0 0.5px var(--p-200), var(--shadow-xl);
    }
    .dc--embedded {
      max-width: none;
      max-height: none;
      overflow: visible;
      box-shadow: none;
      border-radius: 0;
    }

    /* En-tête */
    .dc-header { padding: 18px 24px 16px; border-bottom: 0.5px solid var(--n-200); flex-shrink: 0; }
    .dc-header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 0.75rem; }
    .dc-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .dc-chip { font-size: 9.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 2px 9px; border-radius: var(--radius-full); }
    .dc-chip-type { background: var(--p-50); color: var(--p-600); }
    .dc-close {
      width: 28px; height: 28px; border-radius: 7px;
      background: var(--n-100); border: 0.5px solid var(--n-200); color: var(--n-400);
      font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-family: var(--font-base); transition: var(--transition); flex-shrink: 0;
    }
    .dc-close:hover { background: var(--n-200); color: var(--n-800); }
    .dc-title { font-size: 20px; font-weight: 700; color: var(--n-800); letter-spacing: -.025em; line-height: 1.1; margin-bottom: 6px; }
    .dc-subtitle { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--n-400); margin-bottom: 14px; }
    .dc-subtitle i { font-size: 12px; font-style: normal; }
    .dc-sep { opacity: .4; }
    .dc-meta { background: var(--n-50); border: 0.5px solid var(--n-200); border-radius: 10px; overflow: hidden; }
    .dc-meta-row { display: flex; align-items: center; gap: 10px; padding: 7px 14px; border-bottom: 0.5px solid var(--n-200); }
    .dc-meta-row:last-child { border-bottom: none; }
    .dc-meta-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--n-400); width: 110px; flex-shrink: 0; }
    .dc-meta-value { font-size: 12.5px; font-weight: 600; color: var(--n-800); }
    .dc-meta-empty { color: var(--n-300); font-style: italic; font-weight: 400; }

    /* Corps / sections */
    .dc-body { overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: var(--p-200) transparent; }
    .dc-section { padding: 16px 24px; }
    .dc-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 1rem; }
    .dc-empty { margin: 0; }

    /* Badges statut (alignés sur le modal PPM) */
    .badge.badge-prevu { background: var(--info-bg); color: var(--info-text); }
    .badge.badge-cours { background: var(--success-bg); color: var(--success-text); }
    .badge.badge-cloture { background: var(--n-100); color: var(--n-500); }

    /* Pied */
    .dc-foot { border-top: 0.5px solid var(--n-200); padding: 11px 24px; display: flex; align-items: center; justify-content: space-between; background: var(--p-50); flex-shrink: 0; }
    .dc-foot-info { font-size: 11.5px; color: var(--n-400); }
    .dc-foot-info strong { color: var(--p-600); font-weight: 600; }

    .table-card td { white-space: normal; }

    /* Services bénéficiaires (sous-ligne lecture seule d'un marché) */
    .dc-benef-row td { background: var(--n-50); padding: 8px 14px 10px; }
    .dc-benef-title { display: block; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--n-400); margin-bottom: 4px; }
    .dc-benef-line { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--n-600); padding: 2px 0; }
    .dc-benef-soa { font-weight: 600; color: var(--n-800); }
    .dc-benef-cell { color: var(--n-500); }
  `,
})
export class DossierConsultation implements OnInit {
  readonly dossier = input.required<Dossier>();
  /** En mode embarqué : rendu inline (sans overlay, bouton fermer, ni pied) pour insertion dans une colonne. */
  readonly embedded = input(false);
  readonly closed = output<void>();

  /** Clic sur l'overlay : ferme la modale (sans effet en mode embarqué). */
  onOverlayClick(): void {
    if (!this.embedded()) {
      this.closed.emit();
    }
  }

  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly serviceBenefService = inject(ServiceBeneficiaireService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly toast = inject(ToastService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly ppm = signal<Ppm | null>(null);
  readonly marches = signal<Marche[]>([]);
  readonly pieces = signal<PieceJointeDossier[]>([]);
  readonly loadingContenu = signal(false);
  readonly loadingPieces = signal(false);
  readonly piecesInitiales = computed(() => this.pieces().filter((p) => !p.apresLettreRenvoi));
  readonly piecesApresRenvoi = computed(() => this.pieces().filter((p) => p.apresLettreRenvoi));
  private readonly modeMap = signal<Map<string, string>>(new Map());
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  /** Services bénéficiaires des marchés du dossier (lecture seule), passés au tableau partagé. */
  readonly serviceBenefs = signal<ServiceBeneficiaire[]>([]);
  private readonly soaMap = signal<Map<string, string>>(new Map());
  private readonly compteMap = signal<Map<string, string>>(new Map());
  /** idDetail → ses services bénéficiaires. */
  private readonly benefParDetail = computed(() => {
    const map = new Map<number, ServiceBeneficiaire[]>();
    for (const b of this.serviceBenefs()) {
      const list = map.get(b.idDetail) ?? [];
      list.push(b);
      map.set(b.idDetail, list);
    }
    return map;
  });
  /** Dates prévisionnelles des marchés du dossier (lecture seule), passées au tableau partagé. */
  readonly previsions = signal<MarchePrevision[]>([]);
  private readonly capmMap = signal<Map<string, string>>(new Map());
  /** idDetail → ses dates prévisionnelles (triées par ordre CAPM). */
  private readonly prevParDetail = computed(() => {
    const map = new Map<number, MarchePrevision[]>();
    for (const p of this.previsions()) {
      const list = map.get(p.idDetail) ?? [];
      list.push(p);
      map.set(p.idDetail, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
    }
    return map;
  });

  readonly estPpm = computed(() => this.dossier().idTypeDossier === 'DDP');
  readonly typeLabel = computed(() => {
    const id = this.dossier().idTypeDossier;
    return id ? this.typeMap().get(id) ?? id : '—';
  });
  readonly localiteLabel = computed(() => {
    const id = this.dossier().idLocalite;
    return id ? this.localiteMap().get(id) ?? id : '—';
  });

  ngOnInit(): void {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    // Pièces jointes du dossier (tous types) — GET /api/piece-jointe-dossiers?dossier={id}.
    this.loadingPieces.set(true);
    this.pieceService.getByDossier(this.dossier().idDossier).subscribe({
      next: (rows) => {
        this.pieces.set(rows);
        this.loadingPieces.set(false);
      },
      error: () => this.loadingPieces.set(false),
    });
    if (this.estPpm()) {
      const id = this.dossier().idDossier;
      this.loadingContenu.set(true);
      this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
      this.lookups.lookup(SoaBeneficiaireService, 'soaCode', ['libelle']).subscribe((m) => this.soaMap.set(m));
      this.lookups.lookup(CompteService, 'numCompte', ['libelle']).subscribe((m) => this.compteMap.set(m));
      this.lookups.lookup(CapmService, 'idCapm', ['libelleProcessus']).subscribe((m) => this.capmMap.set(m));
      forkJoin({
        ppms: this.ppmService.list(),
        marches: this.marcheService.list(),
        benefs: this.serviceBenefService.list(),
        previsions: this.previsionService.list(),
      }).subscribe({
        next: ({ ppms, marches, benefs, previsions }) => {
          this.ppm.set(ppms.find((p) => p.idDossier === id) ?? null);
          const mine = marches.filter((m) => m.idDossier === id);
          this.marches.set(mine);
          // Bénéficiaires + dates : ne garder que ceux des marchés du dossier (pas de filtre par dossier côté API).
          const detailIds = new Set(mine.map((m) => m.idDetail));
          this.serviceBenefs.set(benefs.filter((b) => detailIds.has(b.idDetail)));
          this.previsions.set(previsions.filter((p) => detailIds.has(p.idDetail)));
          this.loadingContenu.set(false);
        },
        error: () => this.loadingContenu.set(false),
      });
    }
  }

  /** Télécharge et ouvre une pièce jointe dans un nouvel onglet (lecture seule). */
  ouvrirPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) {
      return;
    }
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (blob) => window.open(URL.createObjectURL(blob), '_blank'),
      error: () => this.toast.error("Impossible d'ouvrir la pièce."),
    });
  }

  modeLabel(id?: number): string {
    return id === null || id === undefined ? '—' : this.modeMap().get(String(id)) ?? `#${id}`;
  }
  montant(v?: number): string {
    return v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
  /** Services bénéficiaires d'un marché (lecture seule). */
  benefsDe(idDetail: number): ServiceBeneficiaire[] {
    return this.benefParDetail().get(idDetail) ?? [];
  }
  /** Libellé du service bénéficiaire (code SOA + libellé si connu). */
  soaLabel(code?: string): string {
    if (!code) return '—';
    const lib = this.soaMap().get(code);
    return lib ? `${code} · ${lib}` : code;
  }
  /** Libellé du compte budgétaire (numéro + libellé si connu). */
  compteLabel(num?: string): string {
    if (!num) return '—';
    const lib = this.compteMap().get(num);
    return lib ? `${num} · ${lib}` : num;
  }
  /** Dates prévisionnelles d'un marché (triées par ordre CAPM). */
  datesDe(idDetail: number): MarchePrevision[] {
    return this.prevParDetail().get(idDetail) ?? [];
  }
  /** Libellé du processus CAPM (LANCEMENT / OUVERTURE / ATTRIBUTION…). */
  capmLabel(id?: number): string {
    return id === null || id === undefined ? '—' : this.capmMap().get(String(id)) ?? `#${id}`;
  }
}
