import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';

import { ActionDossier, DiffDossier, Dossier, Marche, MarchePrevision, PieceJointeDossier, Ppm, ServiceBeneficiaire, TypeChangementLigne } from '../../models';
import {
  CapmService,
  CompteService,
  DossierService,
  EntiteContractService,
  LocaliteService,
  MarcheService,
  MarchePrevisionService,
  MiseAJourPpmService,
  ModePassationService,
  NatureService,
  PieceJointeDossierService,
  PpmService,
  ReferenceLookupService,
  ServiceBeneficiaireService,
  SoaBeneficiaireService,
  TypeDossierService,
} from '../../services';
import { AuthService } from '../../core/auth/auth.service';
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
  imports: [DatePipe, StatutBadge, PpmMarchesTable],
  template: `
    <div [class.modal-backdrop]="!embedded()" (click)="onOverlayClick()">
      <div
        class="dc"
        [class.dc--embedded]="embedded()"
        [class.dc--large]="estPpm()"
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

          <!-- ⚠️ 2026-08-14 (demande user) — en-tête ÉPURÉ : seuls Entité contractante, Localité,
               Référence PRMP, Exercice, Signataire et Mise à jour restent (Type est déjà en chip,
               la date réf. dans le sous-titre ; PRMP d'attribution/dates de signature retirés). -->
          <div class="dc-meta">
            <div class="dc-meta-row">
              <span class="dc-meta-label">Entité contractante</span>
              <span class="dc-meta-value">{{ entiteLabel() }}</span>
            </div>
            <div class="dc-meta-row">
              <span class="dc-meta-label">Localité</span>
              <span class="dc-meta-value">{{ localiteLabel() }}</span>
            </div>
            @if (ppm(); as p) {
              @if (montrerReferencePpm()) {
                <div class="dc-meta-row">
                  <span class="dc-meta-label">Référence PRMP</span>
                  <span class="dc-meta-value">{{ p.reference || '—' }}</span>
                </div>
              }
              <div class="dc-meta-row">
                <span class="dc-meta-label">Exercice</span>
                <span class="dc-meta-value">{{ p.exercice }}</span>
              </div>
              <div class="dc-meta-row">
                <span class="dc-meta-label">Signataire</span>
                <span class="dc-meta-value">{{ p.signataire || '—' }}</span>
              </div>
              @if (p.numMaj != null) {
                <div class="dc-meta-row">
                  <span class="dc-meta-label">Mise à jour</span>
                  <span class="dc-meta-value">n° {{ p.numMaj }}{{ p.dateMaj ? ' · ' + p.dateMaj : '' }}</span>
                </div>
              }
            }
          </div>
        </div>

        <!-- ── Corps ── (une seule vague : tout est affiché quand TOUT est chargé — pas de sauts) -->
        <div class="dc-body">
          @if (loading()) {
            <div class="spinner-wrap dc-load"><div class="spinner"></div></div>
          } @else {
          @if (estPpm()) {
            <div class="dc-section">
              <app-ppm-marches-table [marches]="marches()" [beneficiaires]="serviceBenefs()" [previsions]="previsions()" [changements]="changements()" [legendeTitre]="legendeChangements()" [detailsChangements]="detailsChangements()" />
            </div>
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

                <!-- ⚠️ 2026-08-03 (demande user) — versions CORRIGÉES (rectification sur observations
                     du PV) : section dédiée, distinctes des originales conservées ci-dessus. -->
                @if (piecesCorrigees().length > 0) {
                  <div class="pieces-group">
                    <div class="pieces-group-hd">
                      <span class="group-pill gp-green">Versions corrigées (rectification)</span>
                      <span class="group-count">{{ piecesCorrigees().length }} fichier(s)</span>
                    </div>
                    @for (p of piecesCorrigees(); track p.idPiece; let i = $index) {
                      <div class="piece-row">
                        <div class="piece-left">
                          <span class="piece-index pi-green">{{ i + 1 }}</span>
                          <span class="piece-name">{{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                          <span class="vc-tag">Corrigée</span>
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
          </div>
          }

          <!-- Journal des actions (spec « Mandats PRMP ») : qui a agi, quand et sous quel mandat.
               L'OPÉRATEUR d'une action peut différer de la PRMP d'attribution (figée) — il est alors marqué. -->
          @if (journal().length) {
            <div class="dc-section">
              <div class="dc-section-head">
                <div class="section-block-title">
                  <div class="section-icon">🕘</div>
                  <span class="section-label">Journal des actions</span>
                  <span class="section-count">{{ journal().length }} action(s)</span>
                </div>
              </div>
              <table class="dc-journal">
                <thead>
                  <tr><th>Date</th><th>Action</th><th>Opérateur</th><th>Détail</th></tr>
                </thead>
                <tbody>
                  @for (a of journal(); track a.idAction) {
                    <tr>
                      <td class="dc-journal__date">{{ a.dateAction | date: 'dd/MM/yyyy HH:mm' }}</td>
                      <td>{{ actionLabel(a.typeAction) }}</td>
                      <td>
                        {{ a.nomOperateur || a.auteur || a.idPrmpOperateur || '—' }}
                        @if (a.idPrmpOperateur && dossier().idPrmp && a.idPrmpOperateur !== dossier().idPrmp) {
                          <span class="badge dc-journal__succ" title="PRMP en fonction à la date de l'action — différente de la PRMP d'attribution (figée)">≠ attribution</span>
                        }
                      </td>
                      <td class="dc-journal__detail">{{ a.detail || '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
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
      /* Jamais plus large que la zone utile du backdrop (100 % = viewport − padding), quel que soit le zoom. */
      max-width: min(96rem, 100%);
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 0 0 0.5px var(--p-200), var(--shadow-xl);
    }
    /* ⚠️ 2026-08-06 (demande user) — un dossier de PLANIFICATION porte le tableau des marchés et ses
       15 colonnes : à 96rem, les en-têtes d'un mot long (« PREVISIONNELLE ») débordaient sur la colonne
       voisine. Le modal prend alors toute la largeur utile. Les autres types de dossier, eux, n'ont
       que des champs : les élargir ne ferait qu'étirer du vide. */
    .dc--large {
      max-width: min(118rem, 100%);
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

    /* Journal des actions (spec « Mandats PRMP »). */
    .dc-journal { width: 100%; border-collapse: collapse; font-size: 12.5px; background: #fff; border: 0.5px solid var(--n-200); border-radius: 10px; overflow: hidden; }
    .dc-journal th { text-align: left; padding: 7px 12px; background: var(--n-50); border-bottom: 0.5px solid var(--n-200); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--n-400); white-space: nowrap; }
    .dc-journal td { padding: 7px 12px; border-bottom: 0.5px solid var(--n-100); vertical-align: top; white-space: normal; }
    .dc-journal tr:last-child td { border-bottom: none; }
    .dc-journal__date { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--n-500); }
    .dc-journal__detail { color: var(--n-500); }
    .dc-journal__succ { background: var(--warning-bg, #fef3c7); color: var(--warning-text, #b45309); margin-left: 6px; font-size: 10px; }

    /* Corps / sections — overscroll contenu : la molette ne « fuit » pas vers la page derrière. */
    .dc-body { overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: var(--p-200) transparent; overscroll-behavior: contain; }
    /* Hauteur réservée pendant le chargement : le contenu remplace le spinner sans saut brutal. */
    .dc-load { min-height: 18rem; }
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
  private readonly miseAJourService = inject(MiseAJourPpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly serviceBenefService = inject(ServiceBeneficiaireService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly dossierService = inject(DossierService);
  private readonly toast = inject(ToastService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly auth = inject(AuthService);

  /** La référence PPM interne (ex. « 00018/MLF/PPM/2026 ») n'est montrée qu'aux profils PRMP, UGPM et Secrétaire. */
  readonly montrerReferencePpm = computed(() => ['PRMP', 'UGPM', 'SECRETAIRE'].includes(this.auth.role() ?? ''));

  readonly ppm = signal<Ppm | null>(null);
  /** Versionnement : idDetail → type de changement vs la version précédente (surlignage du tableau). */
  readonly changements = signal<Map<number, TypeChangementLigne> | null>(null);
  /** Titre de la légende du surlignage (« Mise à jour : » ou « Rectification : » selon la source). */
  readonly legendeChangements = signal('Mise à jour :');
  /** idDetail → détail humain « champ : avant → après ; … » (infobulle des lignes surlignées). */
  readonly detailsChangements = signal<Map<number, string> | null>(null);
  /** Le diff de rectification a été appliqué — il prime sur le diff de versions (course des sondages). */
  private diffRectifApplique = false;

  /** Applique un diff (versions OU rectification) au tableau : types par ligne + infobulles de détail. */
  private appliquerDiff(diff: DiffDossier, legende: string): void {
    const types = new Map<number, TypeChangementLigne>();
    const details = new Map<number, string>();
    for (const l of diff.lignes) {
      if (l.idDetail == null) continue;
      types.set(l.idDetail, l.type);
      if (l.champs?.length) {
        details.set(l.idDetail, l.champs.map((c) => `${c.champ} : ${c.avant ?? '—'} → ${c.apres ?? '—'}`).join(' ; '));
      }
    }
    this.changements.set(types);
    this.detailsChangements.set(details);
    this.legendeChangements.set(legende);
  }
  /** Journal MÉTIER des actions (spec « Mandats PRMP ») — vide si le backend ne le sert pas encore. */
  readonly journal = signal<ActionDossier[]>([]);
  readonly marches = signal<Marche[]>([]);
  readonly pieces = signal<PieceJointeDossier[]>([]);
  /** Une seule vague de rendu : le corps s'affiche quand TOUT est chargé (données + référentiels). */
  readonly loading = signal(true);
  readonly piecesInitiales = computed(() => this.pieces().filter((p) => !p.apresLettreRenvoi && !p.versionCorrigee));
  readonly piecesApresRenvoi = computed(() => this.pieces().filter((p) => p.apresLettreRenvoi));
  /** ⚠️ 2026-08-03 — versions CORRIGÉES déposées pendant la rectification (distinctes des originales). */
  readonly piecesCorrigees = computed(() => this.pieces().filter((p) => !p.apresLettreRenvoi && p.versionCorrigee));
  private readonly modeMap = signal<Map<string, string>>(new Map());
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());
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
  readonly entiteLabel = computed(() => {
    const id = this.dossier().idEntiteContract;
    return id != null ? this.entiteMap().get(String(id)) ?? '#' + id : '—';
  });

  /** Libellé d'une action du journal (code brut si inconnu — le backend reste l'autorité). */
  actionLabel(type: string): string {
    const labels: Record<string, string> = {
      CREATION: 'Création',
      SOUMISSION: 'Soumission',
      RESOUMISSION: 'Resoumission',
      TRANSMISSION_COMPLEMENTS: 'Transmission de compléments',
      TRANSMISSION_COMPLEMENTS_DEPOT: 'Compléments de dépôt',
      SUPPRESSION: 'Suppression',
      MISE_A_JOUR: 'Mise à jour',
    };
    return labels[type] ?? type;
  }

  ngOnInit(): void {
    const id = this.dossier().idDossier;
    // Dossier issu d'une mise à jour → diff vs version précédente pour surligner les lignes changées.
    // Appel SILENCIEUX (hors vague principale) : 403/409 → pas de surlignage, l'affichage reste complet.
    if (this.dossier().idDossierParent != null) {
      this.miseAJourService.diff(id, true).subscribe({
        // Le diff de RECTIFICATION prime (changement le plus récent) : ne pas l'écraser si les deux
        // sondages répondent (ordre d'arrivée non garanti).
        next: (diff) => {
          if (!this.diffRectifApplique) this.appliquerDiff(diff, 'Mise à jour :');
        },
        error: () => {},
      });
    }
    // ⚠️ 2026-08-15 — phase de vérification : diff du DERNIER cycle de RECTIFICATION (état
    // pré-correction figé au premier PUT saisies/ppm → état courant), pour que le vérificateur (et
    // tout profil qui consulte) voie ce que la PRMP a changé. Sondage silencieux (404/409 = jamais
    // rectifié → rien) ; s'il existe, il PRIME sur le diff de versions (changement le plus récent).
    const STATUTS_RECTIFIABLES = ['EN_ATTENTE_DECISION_PRMP', 'EN_VERIFICATION', 'OBSERVATIONS_LEVEES', 'DECISION_TRANSMISE_SIGMP', 'CLOTURE'];
    if (STATUTS_RECTIFIABLES.includes(this.dossier().statut ?? '')) {
      this.miseAJourService.diffRectification(id, true).subscribe({
        next: (diff) => {
          if (diff.lignes.some((l) => l.type !== 'INCHANGEE')) {
            this.diffRectifApplique = true;
            this.appliquerDiff(diff, 'Rectification :');
          }
        },
        error: () => {},
      });
    }
    // Journal des actions (spec « Mandats PRMP ») — progressif et silencieux : un dossier sans journal
    // (ou un backend antérieur à la spec) n'affiche simplement pas la section.
    this.dossierService.journal(id).subscribe({
      next: (rows) => this.journal.set(rows),
      error: () => {},
    });
    // UNE SEULE VAGUE : données + référentiels joints dans un même forkJoin — le corps ne s'affiche
    // qu'une fois complet (pas de spinners successifs, pas de libellés qui « clignotent »). Chaque
    // source de données est tolérante à l'échec (of(...)) : le toast centralisé signale l'erreur,
    // le reste du modal s'affiche quand même. Les lookups (shareReplay) sont mis en cache : les
    // rouvrir — ou le tableau partagé qui les redemande — les résout alors de façon synchrone.
    const commun = {
      typeMap: this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).pipe(catchError(() => of(new Map<string, string>()))),
      localiteMap: this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).pipe(catchError(() => of(new Map<string, string>()))),
      entiteMap: this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).pipe(catchError(() => of(new Map<string, string>()))),
      // Pièces jointes du dossier (tous types) — GET /api/piece-jointe-dossiers?dossier={id}.
      pieces: this.pieceService.getByDossier(id).pipe(catchError(() => of([] as PieceJointeDossier[]))),
    };
    if (!this.estPpm()) {
      forkJoin(commun).subscribe(({ typeMap, localiteMap, entiteMap, pieces }) => {
        this.typeMap.set(typeMap);
        this.localiteMap.set(localiteMap);
        this.entiteMap.set(entiteMap);
        this.pieces.set(pieces);
        this.loading.set(false);
      });
      return;
    }
    forkJoin({
      ...commun,
      modeMap: this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      soaMap: this.lookups.lookup(SoaBeneficiaireService, 'soaCode', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      compteMap: this.lookups.lookup(CompteService, 'numCompte', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      capmMap: this.lookups.lookup(CapmService, 'idCapm', ['libelleProcessus']).pipe(catchError(() => of(new Map<string, string>()))),
      // Natures : utilisées par le tableau partagé — préchargées ici pour que son premier rendu soit complet.
      natureMap: this.lookups.lookup(NatureService, 'idNature', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      ppms: this.ppmService.list().pipe(catchError(() => of([] as Ppm[]))),
      marches: this.marcheService.list().pipe(catchError(() => of([] as Marche[]))),
      benefs: this.serviceBenefService.list().pipe(catchError(() => of([] as ServiceBeneficiaire[]))),
      previsions: this.previsionService.list().pipe(catchError(() => of([] as MarchePrevision[]))),
    }).subscribe(({ typeMap, localiteMap, entiteMap, pieces, modeMap, soaMap, compteMap, capmMap, ppms, marches, benefs, previsions }) => {
      this.typeMap.set(typeMap);
      this.localiteMap.set(localiteMap);
      this.entiteMap.set(entiteMap);
      this.pieces.set(pieces);
      this.modeMap.set(modeMap);
      this.soaMap.set(soaMap);
      this.compteMap.set(compteMap);
      this.capmMap.set(capmMap);
      this.ppm.set(ppms.find((p) => p.idDossier === id) ?? null);
      const mine = marches.filter((m) => m.idDossier === id);
      this.marches.set(mine);
      // Bénéficiaires + dates : ne garder que ceux des marchés du dossier (pas de filtre par dossier côté API).
      const detailIds = new Set(mine.map((m) => m.idDetail));
      this.serviceBenefs.set(benefs.filter((b) => detailIds.has(b.idDetail)));
      this.previsions.set(previsions.filter((p) => detailIds.has(p.idDetail)));
      this.loading.set(false);
    });
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
