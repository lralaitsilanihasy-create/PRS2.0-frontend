import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import { urlBlobSure } from '../../core/securite/fichiers-surs';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { Dispatch, Dossier, Examen, PvExamen, Reception } from '../../models';
import {
  ControleurService,
  DispatchService,
  DossierService,
  EntiteContractService,
  ExamenService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DetailPvModal } from './detail-pv-modal';
import { DeuxVolets } from '../../shared/ui/deux-volets';

/**
 * « PV définitifs » (MEMBRE / PRESIDENT / CHEF_COMMISSION / **PRMP** ⚠️ 2026-08-02) — **LECTURE SEULE**.
 * Liste les PV **signés** via `GET /api/pv-examens/definitifs` (complément de « Projets de PV » qui
 * n'expose plus les signés), triés par date de signature décroissante. Aucune action de workflow.
 * Pour la PRMP : liste scopée serveur à SES dossiers, et **uniquement la version PDF** du PV
 * (document officiel signé — pas de modal de détail interne) ; c'est sa base de rectification
 * selon les observations du PV.
 */
@Component({
  selector: 'app-pv-definitifs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, StatutBadge, DetailPvModal, DeuxVolets],
  template: `
    <section class="pvd">
      <header class="page-header">
        <h1 class="page-title">PV définitifs</h1>
      </header>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (pvs().length) {
        <!-- ⚠️ 31/10 (pilote, Espace de travail, lot 3d) — deux volets : les PV à gauche (référence, entité, date), le PV choisi à
             droite ; le premier est choisi d'office. La PRMP ne reçoit que le document officiel signé (règle du 2026-08-02) :
             son volet porte l'identité du PV et « Afficher le PV » ; les autres profils y lisent le détail complet. -->
        <app-deux-volets [ouvert]="!!selection()" [cle]="selection()?.idPv ?? null" libelleListe="PV définitifs" libelleDetail="Détail du PV"
                         invite="Choisissez un PV : son détail s’affiche ici.">
          <ul liste class="pvd__liste">
            @for (pv of pvs(); track pv.idPv) {
              <li class="pvd__item" [class.pvd__item--on]="selection()?.idPv === pv.idPv">
                <button type="button" class="pvd__ligne" [attr.aria-pressed]="selection()?.idPv === pv.idPv" (click)="choisi.set(pv.idPv)">
                  <span class="pvd__ref">{{ pv.refePv || pv.referencePv || ('PV #' + pv.idPv) }}</span>
                  <span class="pvd__ent">{{ entiteDe(pv) }}</span>
                  <span class="pvd__date">{{ datePvDe(pv) || '—' }}</span>
                </button>
              </li>
            }
          </ul>
          <div detail>
            @for (pv of selectionListe(); track pv.idPv) {
              @if (estPrmp()) {
                <div class="pvd__fiche">
                  <header class="pvd__fiche-tete">
                    <h2 class="pvd__fiche-titre">{{ pv.refePv || pv.referencePv || ('PV #' + pv.idPv) }}</h2>
                    <app-statut-badge [statut]="pv.statutPv" [label]="'Définitif'" />
                  </header>
                  <dl class="pvd__champs">
                    <div><dt>Entité contractante</dt><dd>{{ entiteDe(pv) }}</dd></div>
                    <div><dt>Date du PV</dt><dd>{{ datePvDe(pv) || '—' }}</dd></div>
                    <div><dt>Co-signataires</dt><dd>{{ coSignataires(pv) }}</dd></div>
                  </dl>
                  <div>
                    @if (pv.documentDisponible) {
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="chargementPdf() === pv.idPv" (click)="afficherPdf(pv)">
                        {{ chargementPdf() === pv.idPv ? 'Chargement…' : '📄 Afficher le PV' }}
                      </button>
                    } @else {
                      <!-- ⚠️ 2026-08-19 — « indisponible » et non « inexistant » : le document est produit après la signature. -->
                      <button type="button" class="btn btn-primary btn-sm" disabled
                        title="Document indisponible pour l'instant — s'il vient d'être signé, l'édition est en cours ; rechargez dans un instant.">📄 Afficher le PV</button>
                    }
                  </div>
                </div>
              } @else if (estReferenceComplete(pv.refePv || pv.referencePv)) {
                <app-detail-pv-modal [pv]="pv" [integre]="true" />
              } @else {
                <p class="text-sm text-muted">Référence incomplète : le détail de ce PV n’est pas consultable. Contactez l’administrateur.</p>
              }
            }
          </div>
        </app-deux-volets>
      } @else {
        <p class="text-muted">Aucun PV définitif.</p>
      }
    </section>

    @if (detail(); as pv) {
      <app-detail-pv-modal [pv]="pv" (fermer)="detail.set(null)" />
    }

    <!-- ⚠️ 2026-08-02 (PRMP) — visionneuse du PDF officiel signé, affichée directement au clic. -->
    @if (apercu(); as ap) {
      <div class="modal-backdrop" [class.closing]="closingApercu()">
        <div class="modal modal-lg pvd__viewer" role="dialog" aria-modal="true" aria-label="Visionneuse du PV définitif" appModale (appModaleFermer)="fermerApercuAnime()">
          <div class="modal-header">
            <div>
              <div class="pvd__viewer-top">
                <app-statut-badge [statut]="'SIGNE'" [label]="'Définitif'" />
                <span class="text-muted text-sm">Document officiel signé</span>
              </div>
              <h2 class="modal-title">{{ ap.reference }}</h2>
            </div>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerApercuAnime()">✕</button>
          </div>
          <div class="modal-body pvd__viewer-body">
            <iframe [src]="ap.url" [title]="ap.reference" class="pvd__viewer-frame"></iframe>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    /* ⚠️ 31/10 (Espace de travail, lot 3d) — volet de gauche et fiche de la PRMP. */
    .pvd__liste { list-style: none; margin: 0; padding: 0; }
    .pvd__item { border-bottom: 1px solid var(--bordure); }
    .pvd__item--on { background: var(--onglet-actif-fond); box-shadow: inset 3px 0 0 var(--menu-fond); }
    .pvd__ligne { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: flex; flex-direction: column; gap: 0.15rem; padding: 0.55rem 0.8rem; }
    .pvd__ligne:hover { background: var(--ligne-survol); }
    .pvd__item--on .pvd__ligne:hover { background: transparent; }
    .pvd__ligne:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: -2px; }
    .pvd__ent, .pvd__date { font-size: var(--text-sm); color: var(--texte-secondaire); }
    .pvd__fiche { display: flex; flex-direction: column; gap: 10px; }
    .pvd__fiche-tete { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding-bottom: 8px; border-bottom: 1px solid var(--bordure); }
    .pvd__fiche-titre { margin: 0; font-size: 16px; font-weight: 500; }
    .pvd__champs { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); margin: 0; border: 1px solid var(--bordure); border-radius: 4px; }
    .pvd__champs > div { padding: 6px 10px; }
    .pvd__champs > div + div { border-left: 1px solid var(--bordure); }
    .pvd__champs dt { font-size: 11px; color: var(--texte-secondaire); }
    .pvd__champs dd { margin: 0; font-weight: 500; }
    .pvd__ref { font-weight: 500; color: var(--c-800); margin-right: 0.5rem; }
    .pvd__actions { justify-content: flex-end; }
    .pvd__info { display: flex; flex-direction: column; gap: 0.35rem; margin: 0.5rem 0 0; }
    .pvd__info > div { display: flex; gap: 0.5rem; align-items: baseline; }
    .pvd__info dt { flex: 0 0 11rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--n-400); }
    .pvd__info dd { margin: 0; color: var(--n-700); }
    .pvd__synthese { margin: 0.5rem 0 0; font-size: var(--text-sm); }
    /* Visionneuse PDF (PRMP) : le corps du modal est entièrement occupé par le document. */
    .pvd__viewer-top { display: flex; align-items: center; gap: 0.5rem; }
    .pvd__viewer-body { padding: 0; }
    .pvd__viewer-frame { display: block; width: 100%; height: 75vh; border: 0; }
  `,
})
export class PvDefinitifs {
  /** Animation de sortie du modal (voir `fermerAvecAnimation`). */
  readonly closingApercu = signal(false);
  /** Ferme le modal en jouant l'animation de sortie (voile, Échap, boutons). */
  fermerApercuAnime(): void {
    fermerAvecAnimation(this.closingApercu, () => this.fermerApercu());
  }

  private readonly service = inject(PvExamenService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly examenService = inject(ExamenService);
  private readonly dispatchService = inject(DispatchService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly loading = signal(true);
  readonly pvs = signal<PvExamen[]>([]);
  // — Jointures pour les colonnes du tableau (entité du dossier, noms des co-signataires) —
  private readonly examens = signal<Examen[]>([]);
  private readonly dispatchs = signal<Dispatch[]>([]);
  private readonly receptions = signal<Reception[]>([]);
  private readonly dossiers = signal<Dossier[]>([]);
  /** idEntiteContract → libellé et imControleur → nom (repli identifiant si non chargé). */
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly controleurMap = signal<Map<string, string>>(new Map());
  /** idExamen → dossier rattaché (chaîne examen → dispatch → réception → dossier, comme pv-page). */
  private readonly dossierByExamen = computed(() => {
    const recById = new Map(this.receptions().map((r) => [r.idReception, r]));
    const dispById = new Map(this.dispatchs().map((d) => [d.idDispatch, d]));
    const dosById = new Map(this.dossiers().map((d) => [d.idDossier, d]));
    const map = new Map<number, Dossier>();
    for (const e of this.examens()) {
      const disp = e.idDispatch != null ? dispById.get(e.idDispatch) : undefined;
      const rec = disp ? recById.get(disp.idReception) : undefined;
      const dos = rec ? dosById.get(rec.idDossier) : undefined;
      if (dos) map.set(e.idExamen, dos);
    }
    return map;
  });
  /** PV ouvert dans le modal de détail (null = fermé). */
  readonly detail = signal<PvExamen | null>(null);
  /** ⚠️ 31/10 (deux volets) — le PV choisi (le premier tant que rien n'est choisi). */
  readonly choisi = signal<number | null>(null);
  readonly selection = computed(() => this.pvs().find((p) => p.idPv === this.choisi()) ?? this.pvs()[0] ?? null);
  /** Le PV choisi en liste d'un élément : le détail est recréé (et relu) quand il change. */
  readonly selectionListe = computed(() => {
    const p = this.selection();
    return p ? [p] : [];
  });
  /**
   * ⚠️ 2026-08-02 (demande user) — la PRMP (et l'UGPM sous tutelle) ne reçoit que la VERSION PDF du
   * PV signé (document officiel), AFFICHÉE directement : pas de modal de détail (reconstruction interne).
   */
  readonly estPrmp = computed(() => this.auth.role() === 'PRMP' || this.auth.role() === 'UGPM');
  /** idPv dont le PDF est en cours de chargement (bouton désactivé), null sinon. */
  readonly chargementPdf = signal<number | null>(null);
  /** Visionneuse PDF ouverte (PRMP) : référence affichée + URL blob « de confiance » (null = fermée). */
  readonly apercu = signal<{ reference: string; url: SafeResourceUrl; brute: string } | null>(null);

  constructor() {
    // UNE vague : PV + chaîne de jointure (chaque liste dégrade en silence si un profil n'y a pas accès).
    forkJoin({
      pvs: this.service.definitifs(),
      examens: this.examenService.list().pipe(catchError(() => of([] as Examen[]))),
      dispatchs: this.dispatchService.list().pipe(catchError(() => of([] as Dispatch[]))),
      receptions: this.receptionService.list().pipe(catchError(() => of([] as Reception[]))),
      dossiers: this.dossierService.list().pipe(catchError(() => of([] as Dossier[]))),
    }).subscribe({
      next: ({ pvs, examens, dispatchs, receptions, dossiers }) => {
        this.examens.set(examens);
        this.dispatchs.set(dispatchs);
        this.receptions.set(receptions);
        this.dossiers.set(dossiers);
        // Tri par date de signature décroissante (PV le plus récemment signé en tête).
        this.pvs.set([...pvs].sort((a, b) => this.dateSignature(b).localeCompare(this.dateSignature(a))));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(ControleurService, 'imControleur', ['nomCont', 'prenomsCont']).subscribe((m) => this.controleurMap.set(m));
  }

  /**
   * Dossier du PV : chaîne de jointure, avec REPLI par référence pour les profils dont la chaîne
   * est servie vide (ex. PRMP) — `refePv` = `refeDossier` avec « /PV » avant l'année (contrat).
   */
  private dossierDuPv(pv: PvExamen): Dossier | undefined {
    const parChaine = this.dossierByExamen().get(pv.idExamen);
    if (parChaine) return parChaine;
    const ref = (pv.refePv || '').replace('/PV/', '/');
    return ref ? this.dossiers().find((d) => d.refeDossier === ref) : undefined;
  }

  /** Entité contractante du dossier du PV (« — » si indisponible). */
  entiteDe(pv: PvExamen): string {
    const d = this.dossierDuPv(pv);
    return d?.idEntiteContract != null ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract : '—';
  }

  /** Date du PV (repli : dernière signature si datePv absent). */
  datePvDe(pv: PvExamen): string {
    return pv.datePv || this.dateSignature(pv);
  }

  /**
   * Co-signataires du PV : chaque part effectivement signée (Membre, Chef de commission, Président),
   * nom résolu depuis la fiche contrôleur (repli matricule).
   */
  coSignataires(pv: PvExamen): string {
    const nom = (im?: string) => (im ? this.controleurMap().get(im) ?? im : '');
    const parts: string[] = [];
    if (pv.dateSignatureMembre && pv.imCtrlMembre) parts.push(`${nom(pv.imCtrlMembre)} (Membre)`);
    if (pv.dateSignatureCc && pv.imCtrlCc) parts.push(`${nom(pv.imCtrlCc)} (Chef de commission)`);
    if (pv.dateSignaturePresident && pv.imCtrlPresident) parts.push(`${nom(pv.imCtrlPresident)} (Président)`);
    return parts.length ? parts.join(' · ') : '—';
  }

  /** Date de signature du PV : la plus récente parmi les signatures (repli sur la date du PV). */
  dateSignature(pv: PvExamen): string {
    const dates = [pv.dateSignatureMembre, pv.dateSignatureCc, pv.dateSignaturePresident, pv.datePv].filter(
      (d): d is string => !!d,
    );
    return dates.length ? dates.sort()[dates.length - 1] : '';
  }

  ouvrirDetailPv(pv: PvExamen): void {
    this.detail.set(pv);
  }

  /**
   * Affiche le PDF du PV (PRMP) DIRECTEMENT dans une visionneuse (iframe) — pas de téléchargement
   * (le lecteur du navigateur offre de toute façon impression / enregistrement). L'URL blob est
   * révoquée à la fermeture de la visionneuse.
   */
  afficherPdf(pv: PvExamen): void {
    this.chargementPdf.set(pv.idPv);
    this.service.document(pv.idPv).subscribe({
      next: (blob) => {
        this.chargementPdf.set(null);
        const brute = urlBlobSure(blob);
        this.apercu.set({
          reference: pv.refePv || pv.referencePv || 'PV #' + pv.idPv,
          url: this.sanitizer.bypassSecurityTrustResourceUrl(brute),
          brute,
        });
      },
      error: () => {
        this.chargementPdf.set(null);
        this.toast.error('Document du PV indisponible.');
      },
    });
  }

  /** Ferme la visionneuse et libère l'URL blob (l'iframe est détruite en même temps). */
  fermerApercu(): void {
    const ap = this.apercu();
    this.apercu.set(null);
    if (ap) {
      URL.revokeObjectURL(ap.brute);
    }
  }

  /** Référence complète = au moins 2 « / » (ex. 00006/PPM/CRM-ANT/PV/2026), pas « PV #N ». */
  estReferenceComplete(ref?: string): boolean {
    return !!ref && (ref.match(/\//g) || []).length >= 2;
  }
}
