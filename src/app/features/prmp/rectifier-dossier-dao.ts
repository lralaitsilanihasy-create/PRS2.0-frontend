import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { validerFichier } from '../../core/securite/fichiers-surs';
import { Dossier, FicheMarche, ObservationPv, PieceJointeDossier, TypePieceJointe, VersionFiche } from '../../models';
import { DossierService, ObservationPvService, PieceJointeDossierService, TypePieceJointeService } from '../../services';
import { FicheMarcheService } from '../../services/fiche-marche.services';
import { ChronometrageDossier, ObservationPvCard } from '../../shared/circuit';

/** Ce que la révision de la fiche est devenue, vue depuis le dossier à rectifier. */
type EtatRevision = 'a-ouvrir' | 'en-cours' | 'validee';

/**
 * ⚠️ Lot C1 (26/09, plan-2026-09-26-lot-c-rectification-dossier-dao) — « Rectifier un dossier DAO » (PRMP, statut
 * `EN_ATTENTE_DECISION_PRMP`). Un dossier d'appel d'offres ne se rectifie **pas** par le ré-import d'un plan : sa
 * correction est une **révision validée de la fiche** (piste 2). Trois étapes, un geste final :
 *  1. les observations du PV, chacune menant à l'information visée (« Corriger dans la fiche », lot B) ;
 *  2. l'état de la révision — à ouvrir, en cours, validée (version, date, informations changées, documents) ;
 *  3. les pièces déposées à part par la PRMP, à remplacer si une observation les vise ;
 *  puis « Décrire et resoumettre le dossier » (`POST /resoumettre`), ouvert seulement quand la révision est validée.
 * Le serveur rendra la même garde (demande du 26/09, B3 : 409 `FICHE_NON_REVISEE`) ; en attendant, l'écran la tient
 * d'après `ficheMarche.versionSoumise` (B1) ou, à défaut, la version que le dossier résume.
 */
@Component({
  selector: 'app-rectifier-dossier-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, ObservationPvCard, ChronometrageDossier],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Rectifier le dossier d'appel d'offres</h1>
          @if (dossier(); as d) {
            <p class="rd-ref"><span class="cnm-mono fw-semibold">{{ d.refeDossier || '#' + d.idDossier }}</span>@if (fiche(); as f) { <span class="rd-ref__sep">·</span> {{ f.designationMarche }} }</p>
          }
        </div>
        <div class="page-header--actions">
          <button type="button" class="btn btn-outline" (click)="retour()">← Dossiers à rectifier</button>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (!dossier()) {
        <p class="alert alert-danger">Ce dossier n'a pas pu être lu.</p>
      } @else {
        <div class="alert alert-info">
          <span>Un dossier d'appel d'offres se corrige par une <strong>révision de sa fiche</strong> : ouvrez-la sur chaque
          information observée, corrigez, validez la nouvelle version — ses documents remplacent ceux du dossier — puis
          <strong>décrivez vos corrections et resoumettez</strong>.</span>
        </div>

        <app-chronometrage-dossier [idDossier]="idDossier" [compact]="true" />

        <!-- 1. Les observations du PV, périmètre figé : chacune mène à l'information qu'elle vise. -->
        <div class="card rd-form">
          <h2 class="rd-section">
            <span class="rd-step">1</span> Observations du PV — rectifications demandées
            @if (aSatisfaire().length; as n) { <span class="rd-chip rd-chip--warn">{{ n }} à satisfaire</span> } @else { <span class="rd-chip rd-chip--ok">toutes levées</span> }
          </h2>
          @if (!observations().length) {
            <p class="text-muted">Aucune observation du PV n'est rattachée à ce dossier.</p>
          }
          <div class="rd-obs">
            @for (o of observations(); track o.idObservationPv; let i = $index) {
              <app-observation-pv-card [obs]="o" [numero]="i + 1">
                @if (o.champFiche && idDmc() != null && o.statut !== 'LEVEE') {
                  <a class="btn btn-secondary btn-sm rd-corriger" [routerLink]="['/prmp/dao', idDmc()]" [queryParams]="{ champ: o.champFiche, reviser: 1 }">
                    Corriger dans la fiche →
                  </a>
                }
              </app-observation-pv-card>
            }
          </div>
        </div>

        <!-- 2. La révision de la fiche : c'est elle qui porte la correction. -->
        <div class="card rd-form">
          <h2 class="rd-section"><span class="rd-step">2</span> La fiche révisée</h2>
          @if (fiche(); as f) {
            @switch (etatRevision()) {
              @case ('a-ouvrir') {
                <p>La version <strong>{{ versionSoumise() }}</strong> de la fiche est celle que la Commission a examinée. Ouvrez une nouvelle version pour la corriger.</p>
                <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="ouvrirRevision()">{{ saving() ? 'Ouverture…' : 'Ouvrir la révision' }}</button>
              }
              @case ('en-cours') {
                <p>Révision <strong>version {{ f.version }}</strong> en cours (brouillon) — la resoumission attend sa validation.</p>
                <a class="btn btn-primary" [routerLink]="['/prmp/dao', f.idDmc]">Reprendre la révision →</a>
              }
              @case ('validee') {
                <p class="rd-ok">✓ Révision <strong>version {{ f.version }}</strong> validée le {{ f.dateValidation | date: 'dd/MM/yyyy' }} — elle remplace la version {{ versionSoumise() }} examinée.</p>
                @if (changees().length) {
                  <details class="rd-diff" open>
                    <summary>{{ changees().length }} information(s) modifiée(s)</summary>
                    <table class="cnm-table rd-diff__t">
                      <thead><tr><th>Information</th><th>Avant</th><th>Après</th></tr></thead>
                      <tbody>
                        @for (c of changees(); track c.cle) {
                          <tr><td class="cnm-mono">{{ c.cle }}</td><td class="rd-diff__avant">{{ c.avant || '—' }}</td><td class="rd-diff__apres">{{ c.apres || '—' }}</td></tr>
                        }
                      </tbody>
                    </table>
                  </details>
                } @else if (precedente()) {
                  <p class="text-muted">Aucune information ne diffère de la version examinée.</p>
                }
                <a class="btn btn-outline btn-sm" [routerLink]="['/prmp/dao', f.idDmc]">Voir la fiche et ses documents →</a>
              }
            }
          } @else {
            <p class="text-muted">La fiche de ce dossier n'a pas pu être lue.</p>
          }
        </div>

        <!-- 3. Les pièces déposées à part (elles ne viennent pas de la fiche) : versions corrigées. -->
        @if (piecesDeposees().length) {
          <div class="card rd-form">
            <h2 class="rd-section"><span class="rd-step">3</span> Pièces déposées à part — versions corrigées</h2>
            <table class="cnm-table">
              <thead><tr><th>Pièce</th><th>Fichier</th><th>Déposée le</th><th></th></tr></thead>
              <tbody>
                @for (p of piecesDeposees(); track p.idPiece) {
                  <tr>
                    <td>{{ libelleType(p.idTypePiece) }}@if (p.versionCorrigee) { <span class="rd-chip rd-chip--ok">corrigée</span> }</td>
                    <td class="text-muted">{{ p.nomFichier || '—' }}</td>
                    <td>{{ p.dateUpload | date: 'dd/MM/yyyy' }}</td>
                    <td>
                      <label class="btn btn-outline btn-sm">
                        {{ upload() === p.idPiece ? 'Envoi…' : 'Remplacer' }}
                        <input type="file" class="visually-hidden" accept="application/pdf,image/jpeg,image/png" [disabled]="upload() !== null" (change)="remplacer(p, $event)" />
                      </label>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- Le geste unique : décrire, resoumettre. -->
        <div class="card rd-form">
          <label class="form-group">
            <span class="form-label">Vos corrections, en quelques mots *</span>
            <textarea class="form-control" rows="3" [value]="motif()" (input)="motif.set($any($event.target).value)" placeholder="Garantie de soumission du lot 2 ramenée à 2 % du maximum ; mention des plis et objet du DPAO corrigés."></textarea>
          </label>
          @if (!revisionValidee()) {
            <p class="rd-garde">La resoumission s'ouvrira quand la révision de la fiche sera validée.</p>
          }
          <button type="button" class="btn btn-primary" [disabled]="!revisionValidee() || !motif().trim() || saving()" (click)="resoumettre()">
            {{ saving() ? 'Resoumission…' : '💾 Décrire et resoumettre le dossier' }}
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .rd-ref { margin: 0.25rem 0 0; color: var(--n-500); font-size: var(--text-sm); }
    .rd-ref__sep { margin: 0 0.4rem; }
    .rd-form { padding: 1rem 1.25rem; margin-top: 1rem; }
    .rd-section { display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.75rem; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .rd-step { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 1.6rem; height: 1.6rem; border-radius: 999px; background: var(--c-600); color: #fff; font-size: var(--text-sm); font-weight: 800; }
    .rd-chip { margin-left: 0.4rem; padding: 0.1rem 0.55rem; border-radius: 999px; font-size: var(--text-xs); font-weight: 700; }
    .rd-chip--warn { background: var(--warning-bg); color: var(--warning-text); }
    .rd-chip--ok { background: #dcfce7; color: #15803d; }
    .rd-obs { display: flex; flex-direction: column; gap: 0.6rem; }
    .rd-corriger { margin-top: 0.4rem; align-self: flex-start; }
    .rd-ok { color: #15803d; }
    .rd-diff { margin: 0.5rem 0; }
    .rd-diff__t td { vertical-align: top; overflow-wrap: anywhere; }
    .rd-diff__avant { color: #b91c1c; text-decoration: line-through; }
    .rd-diff__apres { color: #15803d; font-weight: 600; }
    .rd-garde { margin: 0.25rem 0 0.6rem; color: var(--n-500); font-size: var(--text-sm); }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
  `,
})
export class RectifierDossierDao {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dossierService = inject(DossierService);
  private readonly obsService = inject(ObservationPvService);
  private readonly ficheService = inject(FicheMarcheService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly typePieceService = inject(TypePieceJointeService);

  readonly idDossier = Number(this.route.snapshot.paramMap.get('idDossier'));
  /** La version de la fiche dont le dossier porte les documents produits — le repli pour la version examinée. */
  readonly versionParPieces = signal<number | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly upload = signal<number | null>(null);
  readonly dossier = signal<Dossier | null>(null);
  readonly observations = signal<ObservationPv[]>([]);
  readonly fiche = signal<FicheMarche | null>(null);
  readonly versions = signal<VersionFiche[]>([]);
  /** La version examinée, relue pour dire ce qui a changé. */
  readonly precedente = signal<FicheMarche | null>(null);
  readonly pieces = signal<PieceJointeDossier[]>([]);
  readonly types = signal<TypePieceJointe[]>([]);
  readonly motif = signal('');

  readonly idDmc = computed(() => this.dossier()?.idDmc ?? null);
  readonly aSatisfaire = computed(() => this.observations().filter((o) => o.statut !== 'LEVEE'));
  /**
   * La version que la Commission a examinée : servie par B1 (`versionSoumise`). ⚠️ En attendant, le résumé du dossier
   * suit la DERNIÈRE version (il dirait « v2 examinée » sitôt la révision validée) : le repli est la version dont le
   * dossier porte les DOCUMENTS PRODUITS (`idDocumentFiche` des pièces) — c'est celle qui a été soumise et examinée,
   * tant que B2 ne remplace pas les pièces à la revalidation. Sans pièce produite, la version que le dossier résume.
   */
  readonly versionSoumise = computed(() => {
    const r = this.dossier()?.ficheMarche as (Dossier['ficheMarche'] & { versionSoumise?: number | null }) | null | undefined;
    return r?.versionSoumise ?? this.versionParPieces() ?? r?.version ?? 0;
  });
  readonly etatRevision = computed<EtatRevision>(() => {
    const f = this.fiche();
    if (!f) return 'a-ouvrir';
    if (f.statut === 'BROUILLON') return 'en-cours';
    return f.version > this.versionSoumise() ? 'validee' : 'a-ouvrir';
  });
  readonly revisionValidee = computed(() => this.etatRevision() === 'validee');
  /** Les informations dont la valeur diffère entre la version examinée et la révision validée. */
  readonly changees = computed(() => {
    const f = this.fiche();
    const p = this.precedente();
    if (!f || !p) return [] as { cle: string; avant: string; apres: string }[];
    const cles = new Set([...Object.keys(f.valeurs ?? {}), ...Object.keys(p.valeurs ?? {})]);
    const s = (v: unknown) => (v == null ? '' : String(v));
    return [...cles]
      .filter((k) => s(f.valeurs?.[k]) !== s(p.valeurs?.[k]))
      .sort()
      .map((k) => ({ cle: k, avant: s(p.valeurs?.[k]), apres: s(f.valeurs?.[k]) }));
  });
  /** Les pièces que la PRMP a déposées elle-même (pas celles produites par la fiche). */
  readonly piecesDeposees = computed(() => this.pieces().filter((p) => p.idDocumentFiche == null));

  constructor() {
    this.charger();
  }

  private charger(): void {
    this.loading.set(true);
    forkJoin({
      dossier: this.dossierService.getById(this.idDossier).pipe(catchError(() => of(null))),
      obs: this.obsService.parDossier(this.idDossier).pipe(catchError(() => of([] as ObservationPv[]))),
      pieces: this.pieceService.getByDossier(this.idDossier).pipe(catchError(() => of([] as PieceJointeDossier[]))),
      types: this.typePieceService.getByTypeDossier('DMC').pipe(catchError(() => of([] as TypePieceJointe[]))),
    })
      .pipe(
        switchMap((r) => {
          const idDmc = r.dossier?.idDmc;
          if (idDmc == null) return of({ ...r, fiche: null as FicheMarche | null, versions: [] as VersionFiche[] });
          return forkJoin({
            fiche: this.ficheService.lire(idDmc).pipe(catchError(() => of(null))),
            versions: this.ficheService.versions(idDmc).pipe(catchError(() => of([] as VersionFiche[]))),
          }).pipe(switchMap((s) => of({ ...r, ...s })));
        }),
      )
      .subscribe((r) => {
        this.dossier.set(r.dossier);
        this.observations.set(r.obs);
        this.pieces.set(r.pieces);
        this.types.set(r.types);
        this.fiche.set(r.fiche);
        this.versions.set(r.versions);
        this.loading.set(false);
        this.reconnaitreVersionSoumise(r.fiche, r.versions, r.pieces);
      });
  }

  /** Quelle version validée a produit les documents que le dossier porte ? Une lecture par version validée, rien de plus. */
  private reconnaitreVersionSoumise(fiche: FicheMarche | null, versions: VersionFiche[], pieces: PieceJointeDossier[]): void {
    const ids = new Set(pieces.map((p) => p.idDocumentFiche).filter((id): id is number => id != null));
    const validees = versions.filter((v) => v.statut === 'VALIDEE');
    if (!fiche || !ids.size || !validees.length) { this.chargerPrecedente(); return; }
    forkJoin(validees.map((v) => this.ficheService.documents(fiche.idDmc, v.version).pipe(catchError(() => of([] as { idDocument: number }[])))))
      .subscribe((docs) => {
        const i = docs.findIndex((d) => d.some((x) => ids.has(x.idDocument)));
        this.versionParPieces.set(i >= 0 ? validees[i].version : null);
        this.chargerPrecedente();
      });
  }

  /** Relit la version examinée quand une révision validée existe, pour montrer avant → après. */
  private chargerPrecedente(): void {
    const f = this.fiche();
    const n = this.versionSoumise();
    if (!f || f.statut !== 'VALIDEE' || f.version <= n || n <= 0) { this.precedente.set(null); return; }
    this.ficheService.version(f.idDmc, n).pipe(catchError(() => of(null))).subscribe((p) => this.precedente.set(p));
  }

  libelleType(idTypePiece: number): string {
    return this.types().find((t) => t.idTypePiece === idTypePiece)?.libellePiece ?? `Pièce ${idTypePiece}`;
  }

  ouvrirRevision(): void {
    const id = this.idDmc();
    if (id == null || this.saving()) return;
    this.saving.set(true);
    this.ficheService.reviser(id).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/prmp/dao', id]);
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        const code = codeErreur(e);
        this.toast.error(code === 'BROUILLON_EN_COURS' ? 'Une révision est déjà ouverte : reprenez-la.' : code === 'DOSSIER_EN_EXAMEN' ? 'La Commission tient encore la version examinée : la révision s’ouvrira au retour du dossier.' : e.message || 'La révision n’a pas pu être ouverte.', 'Révision');
      },
    });
  }

  remplacer(p: PieceJointeDossier, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || p.idPiece == null) return;
    const erreur = validerFichier(file);
    if (erreur) { this.toast.error(erreur); return; }
    this.upload.set(p.idPiece);
    const fd = new FormData();
    fd.append('data', new Blob([JSON.stringify({ idDossier: this.idDossier, idTypePiece: p.idTypePiece })], { type: 'application/json' }));
    fd.append('fichier', file, file.name);
    this.pieceService.upload(fd).subscribe({
      next: () => {
        this.upload.set(null);
        this.toast.success(`Version corrigée de « ${this.libelleType(p.idTypePiece)} » déposée.`);
        this.pieceService.getByDossier(this.idDossier).subscribe((rows) => this.pieces.set(rows));
      },
      error: (e: ApiError) => { this.upload.set(null); this.toast.error(e.message || 'Dépôt impossible.'); },
    });
  }

  resoumettre(): void {
    const motif = this.motif().trim();
    if (!this.revisionValidee() || !motif || this.saving()) return;
    this.saving.set(true);
    this.dossierService.resoumettre(this.idDossier, { motifRectification: motif }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Dossier resoumis : il repart vers le Vérificateur avec la fiche révisée.', 'Rectification');
        this.retour();
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        const code = codeErreur(e);
        this.toast.error(code === 'FICHE_NON_REVISEE' ? 'La fiche n’a pas de version validée postérieure à celle examinée.' : e.message || 'Resoumission impossible.', 'Rectification');
      },
    });
  }

  retour(): void {
    void this.router.navigate(['/prmp/a-rectifier']);
  }
}
