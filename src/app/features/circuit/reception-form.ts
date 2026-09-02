import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, PieceJointeDossier, Reception, TypePieceJointe, VerificationPieceDepot } from '../../models';
import {
  DossierService,
  LocaliteService,
  PieceJointeDossierService,
  ReceptionService,
  ReferenceLookupService,
  TypePieceJointeService,
  VerificationPieceDepotService,
} from '../../services';
import { ChronometrageDossier, StatutBadge } from '../../shared/circuit';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';

/** Ligne du contrôle de complétude : type attendu + pièce déposée (ou non) + dernière décision. */
interface LigneControle {
  type: TypePieceJointe;
  piece: PieceJointeDossier | null;
  decision: VerificationPieceDepot | null;
}

/**
 * Formulaire de réception initiale (modal) — §3.4, avec ⚠️ CONTRÔLE DE COMPLÉTUDE DES PIÈCES
 * (spec recevabilité 2026-08-02) : AVANT tout enregistrement, le Secrétaire vérifie PIÈCE PAR PIÈCE
 * la liste de référence du type (référentiel `type-piece-jointes`) confrontée aux pièces déposées —
 * décision Conforme / Non conforme / Manquante + observation par pièce, progression x/y,
 * « Enregistrer » BLOQUÉ tant que les obligatoires ne sont pas toutes conformes (garde serveur 409
 * en miroir), « Notifier la PRMP » si défauts (→ EN_ATTENTE_COMPLEMENTS_DEPOT, sans archivage).
 * Les décisions sont historisées (append-only) : à la reprise, les pièces conformes restent acquises.
 */
@Component({
  selector: 'app-reception-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, ReactiveFormsModule, SlicePipe, StatutBadge, ChronometrageDossier],
  template: `
    <div class="modal-backdrop" [class.closing]="closingD()">
      <form
        class="modal cnm-form rf-modal"
        [formGroup]="form"
        (ngSubmit)="enregistrer()"
        role="dialog"
        aria-modal="true"
        aria-label="Réception du dossier"
        appModale
        appModaleClicExterieur
        (appModaleFermer)="fermerDAnime()"
        novalidate
      >
        <header class="modal-header-plain rf-header">
          <div class="rf-header__titles">
            <span class="modal-title">Réception initiale</span>
            <span class="rf-header__ref cnm-mono">{{ dossier().refeDossier || 'Dossier #' + dossier().idDossier }}</span>
          </div>
          <button type="button" class="btn-close-plain" aria-label="Fermer" (click)="fermerDAnime()">✕</button>
        </header>

        <div class="modal-body">
          <!-- Chronométrage (2026-09-01) : prise en charge de l'étape RECEPTION + prévision. -->
          <app-chronometrage-dossier [idDossier]="dossier().idDossier" [compact]="true" />

          <!-- Bandeau d'identification (tuiles, même langage que l'en-tête des PV). -->
          <div class="rf-bandeau">
            <div class="rf-tuile">
              <span class="rf-tuile__lbl">Type</span>
              <span class="rf-tuile__val">{{ dossier().idTypeDossier || '—' }}</span>
            </div>
            <div class="rf-tuile">
              <span class="rf-tuile__lbl">Localité</span>
              <span class="rf-tuile__val">{{ loc(dossier().idLocalite) }}</span>
            </div>
            <div class="rf-tuile">
              <span class="rf-tuile__lbl">Statut</span>
              <span class="rf-tuile__val"><app-statut-badge [statut]="dossier().statut" /></span>
            </div>
            <div class="rf-tuile">
              <span class="rf-tuile__lbl">Date de réception</span>
              <input class="form-control rf-tuile__date" type="date" formControlName="dateReception" />
            </div>
          </div>

          <!-- ⚠️ Contrôle de complétude pièce par pièce (référentiel du type ↔ pièces déposées). -->
          <div class="rf-ctrl">
            <div class="rf-ctrl__head">
              <h3 class="rf-ctrl__title">Contrôle de complétude des pièces</h3>
              <span class="rf-ctrl__progress" [class.rf-ctrl__progress--done]="nbVerifiees() === lignes().length && lignes().length > 0">
                {{ nbVerifiees() }}/{{ lignes().length }} vérifiée(s)
              </span>
            </div>
            @if (chargementCtrl()) {
              <p class="text-muted" role="status">Chargement des pièces…</p>
            } @else {
              @for (l of lignes(); track l.type.idTypePiece) {
                <div class="rf-piece"
                     [class.rf-piece--ok]="l.decision?.decision === 'CONFORME'"
                     [class.rf-piece--ko]="l.decision && l.decision.decision !== 'CONFORME'"
                     [class.rf-piece--absente]="!l.piece && !l.decision && !l.type.obligatoire">
                  <span class="rf-piece__ic" aria-hidden="true">
                    {{ l.decision?.decision === 'CONFORME' ? '✓' : l.decision ? '✗' : '•' }}
                  </span>
                  <div class="rf-piece__corps">
                    <div class="rf-piece__head">
                      <span class="rf-piece__lbl">{{ l.type.libellePiece }}</span>
                      <span class="rf-piece__oblig" [class.rf-piece__oblig--req]="l.type.obligatoire">
                        {{ l.type.obligatoire ? 'obligatoire' : 'facultative' }}
                      </span>
                      @if (!l.piece) { <span class="badge badge-warning">Non déposée</span> }
                      @if (l.decision; as d) {
                        <span class="rf-piece__etat rf-piece__etat--{{ d.decision === 'CONFORME' ? 'ok' : 'ko' }}">
                          {{ d.decision === 'CONFORME' ? 'Conforme' : d.decision === 'MANQUANTE' ? 'Manquante' : 'Non conforme' }}
                          <span class="rf-piece__meta cnm-mono">{{ d.dateVerif | slice: 0 : 10 }}</span>
                        </span>
                      }
                    </div>
                    <div class="rf-piece__actions">
                      @if (l.piece) {
                        <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrir(l.piece!)">👁 Ouvrir</button>
                      }
                      <input class="form-control rf-piece__obs" type="text" maxlength="500"
                        placeholder="Observation (motif du rejet / nature du manque)…"
                        [value]="obs(l.type.idTypePiece)"
                        (input)="setObs(l.type.idTypePiece, $any($event.target).value)" />
                      @if (l.piece) {
                        <button type="button" class="rf-chip rf-chip--ok" [class.rf-chip--active-ok]="l.decision?.decision === 'CONFORME'"
                          [disabled]="decisionEnCours()" (click)="decider(l, 'CONFORME')">✓ Conforme</button>
                        <button type="button" class="rf-chip rf-chip--ko" [class.rf-chip--active-ko]="l.decision?.decision === 'NON_CONFORME'"
                          [disabled]="decisionEnCours()" (click)="decider(l, 'NON_CONFORME')">✗ Non conforme</button>
                      } @else {
                        <button type="button" class="rf-chip rf-chip--ko" [class.rf-chip--active-ko]="l.decision?.decision === 'MANQUANTE'"
                          [disabled]="decisionEnCours()" (click)="decider(l, 'MANQUANTE')">✗ Manquante</button>
                      }
                    </div>
                  </div>
                </div>
              } @empty {
                <p class="text-muted">Aucune pièce attendue pour ce type de dossier.</p>
              }

              @if (bloquantes().length) {
                <p class="rf-ctrl__blocage">
                  ⚠ Enregistrement bloqué — pièces obligatoires non déclarées conformes :
                  <strong>{{ bloquantes().join(' ; ') }}</strong>.
                </p>
              } @else if (lignes().length) {
                <p class="rf-ctrl__ok">✓ Toutes les pièces obligatoires sont vérifiées et conformes — enregistrement possible.</p>
              }
            }
          </div>

          <label class="form-group rf-obs-generale">
            <span class="form-label">Observation générale (réception)</span>
            <textarea class="form-control" rows="2" formControlName="observation"></textarea>
          </label>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn btn-outline" (click)="fermerDAnime()">Annuler</button>
          @if (defauts()) {
            <button type="button" class="btn btn-warning" [disabled]="signalement()" (click)="notifierPrmp()">
              {{ signalement() ? 'Notification…' : 'Notifier la PRMP (pièces manquantes)' }}
            </button>
          }
          <button type="submit" class="btn btn-primary" [disabled]="submitting() || bloquantes().length > 0"
            [title]="bloquantes().length ? 'Vérifiez et déclarez conformes toutes les pièces obligatoires.' : ''">
            {{ submitting() ? 'Enregistrement…' : 'Enregistrer la réception' }}
          </button>
        </footer>
      </form>
    </div>
  `,
  styles: `
    .rf-modal { max-width: 48rem; }
    /* En-tête : titre + référence, ✕ calé à droite. */
    /* Titre décalé un peu vers le bas et la droite (demande pilote 02/09) : il collait au coin du modal. */
    .rf-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 0.9rem 0 0 1.1rem; }
    .rf-header__titles { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .rf-header__ref { font-size: var(--text-sm); color: var(--n-400); }
    /* Bandeau d'identification en tuiles. */
    .rf-bandeau { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.6rem 1rem; background: var(--c-50); border: 1px solid var(--c-100); border-radius: var(--radius-lg); padding: 0.75rem 0.9rem; margin-bottom: 0.9rem; }
    .rf-tuile { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
    .rf-tuile__lbl { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--n-400); }
    .rf-tuile__val { font-weight: 600; color: var(--n-700); }
    .rf-tuile__date { height: 2rem; padding: 0.2rem 0.5rem; font-size: var(--text-sm); }
    /* Contrôle de complétude. */
    .rf-ctrl { display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 0.9rem; }
    .rf-ctrl__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .rf-ctrl__title { margin: 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .rf-ctrl__progress { font-size: var(--text-sm); font-weight: 700; color: var(--n-500); background: var(--n-100); padding: 0.15rem 0.7rem; border-radius: 999px; white-space: nowrap; }
    .rf-ctrl__progress--done { background: #F0FDF4; color: #15803D; }
    /* Ligne de pièce : pastille d'état + corps (en-tête compact / actions sur une ligne repliable). */
    .rf-piece { display: flex; gap: 0.6rem; padding: 0.55rem 0.7rem; background: #fff; border: 1px solid var(--n-200); border-left: 4px solid #D1D5DB; border-radius: var(--radius-md); }
    .rf-piece--ok { background: #F6FDF8; border-color: #DCFCE7; border-left-color: #22C55E; }
    .rf-piece--ko { background: #FEF5F5; border-color: #FEE2E2; border-left-color: #DC2626; }
    .rf-piece--absente { opacity: 0.85; }
    .rf-piece__ic { flex: none; width: 1.6rem; height: 1.6rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: var(--n-100); color: var(--n-400); font-weight: 800; margin-top: 2px; }
    .rf-piece--ok .rf-piece__ic { background: #DCFCE7; color: #15803D; }
    .rf-piece--ko .rf-piece__ic { background: #FEE2E2; color: #B91C1C; }
    .rf-piece__corps { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .rf-piece__head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .rf-piece__lbl { font-weight: 600; color: var(--n-800); }
    .rf-piece__oblig { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.1rem 0.45rem; border-radius: 999px; background: var(--n-100); color: var(--n-500); }
    .rf-piece__oblig--req { background: #FEF2F2; color: #B91C1C; }
    .rf-piece__etat { margin-left: auto; font-weight: 700; font-size: var(--text-sm); display: inline-flex; align-items: baseline; gap: 0.4rem; }
    .rf-piece__etat--ok { color: #15803D; }
    .rf-piece__etat--ko { color: #B91C1C; }
    .rf-piece__meta { font-weight: 400; color: var(--n-400); font-size: var(--text-xs); }
    .rf-piece__actions { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
    .rf-piece__obs { flex: 1 1 12rem; height: 2rem; padding: 0.2rem 0.6rem; font-size: var(--text-sm); background: rgba(255, 255, 255, 0.7); }
    /* Décisions en « chips » : l'état ACTIF est rempli, l'inactif reste en contour — re-cliquable. */
    .rf-chip { border-radius: 999px; padding: 0.3rem 0.8rem; font-size: var(--text-sm); font-weight: 700; cursor: pointer; background: #fff; transition: var(--transition); white-space: nowrap; }
    .rf-chip:disabled { opacity: 0.6; cursor: wait; }
    .rf-chip--ok { border: 1.5px solid #22C55E; color: #15803D; }
    .rf-chip--ok:hover:not(:disabled) { background: #F0FDF4; }
    .rf-chip--active-ok { background: #16A34A; border-color: #16A34A; color: #fff; }
    .rf-chip--active-ok:hover:not(:disabled) { background: #15803D; }
    .rf-chip--ko { border: 1.5px solid #DC2626; color: #B91C1C; }
    .rf-chip--ko:hover:not(:disabled) { background: #FEF2F2; }
    .rf-chip--active-ko { background: #DC2626; border-color: #DC2626; color: #fff; }
    .rf-chip--active-ko:hover:not(:disabled) { background: #B91C1C; }
    .rf-ctrl__blocage { margin: 0; padding: 0.5rem 0.75rem; background: var(--warning-bg); color: var(--warning-text); border-radius: var(--radius-md); font-size: var(--text-sm); }
    .rf-ctrl__ok { margin: 0; padding: 0.5rem 0.75rem; background: #F0FDF4; border: 1px solid #BBF7D0; color: #15803D; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 600; }
    .rf-obs-generale { margin-bottom: 0; }
  `,
})
export class ReceptionForm implements OnInit {
  /** Animation de sortie du modal (voir `fermerAvecAnimation`). */
  readonly closingD = signal(false);
  /** Ferme le modal en jouant l'animation de sortie (voile, Échap, boutons). */
  fermerDAnime(): void {
    fermerAvecAnimation(this.closingD, () => this.closed.emit());
  }
  readonly dossier = input.required<Dossier>();
  /** Réception créée — ou `null` si l'état du dossier a changé (signalement PRMP, déjà réceptionné…). */
  readonly saved = output<Reception | null>();
  readonly closed = output<void>();

  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dossierService = inject(DossierService);
  private readonly typePieceService = inject(TypePieceJointeService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly verifService = inject(VerificationPieceDepotService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly submitting = signal(false);
  readonly signalement = signal(false);
  readonly decisionEnCours = signal(false);
  readonly chargementCtrl = signal(true);
  private readonly localiteMap = signal<Map<string, string>>(new Map());

  /** Référentiel du type + pièces déposées + dernières décisions (état courant par type). */
  private readonly typesAttendus = signal<TypePieceJointe[]>([]);
  private readonly pieces = signal<PieceJointeDossier[]>([]);
  private readonly decisions = signal<Map<number, VerificationPieceDepot>>(new Map());
  /** Saisie locale d'observation par type de pièce (envoyée avec la décision cliquée). */
  private readonly observations = signal<Map<number, string>>(new Map());

  /**
   * Lignes du contrôle : chaque type attendu confronté au dépôt + sa dernière décision.
   * ⚠️ Demande pilote (2026-09-02) — seules les OBLIGATOIRES s'affichent, plus les facultatives
   * réellement DÉPOSÉES (le Secrétaire doit pouvoir les contrôler) : les lignes « facultative non
   * déposée / Manquante » n'étaient que du bruit, comme aux écrans de création et de mise à jour.
   */
  readonly lignes = computed<LigneControle[]>(() => {
    const parType = new Map<number, PieceJointeDossier>();
    for (const p of this.pieces()) {
      if (p.idTypePiece != null && !parType.has(p.idTypePiece)) parType.set(p.idTypePiece, p);
    }
    return this.typesAttendus()
      .map((t) => ({
        type: t,
        piece: parType.get(t.idTypePiece) ?? null,
        decision: this.decisions().get(t.idTypePiece) ?? null,
      }))
      .filter((l) => l.type.obligatoire || l.piece !== null);
  });
  readonly nbVerifiees = computed(() => this.lignes().filter((l) => l.decision !== null).length);
  /** Pièces OBLIGATOIRES non encore déclarées conformes (miroir client de la garde serveur). */
  readonly bloquantes = computed(() =>
    this.lignes()
      .filter((l) => l.type.obligatoire && l.decision?.decision !== 'CONFORME')
      .map((l) => l.type.libellePiece),
  );
  /** ≥ 1 défaut constaté (non conforme / manquante décidée, ou obligatoire non déposée) → signalement PRMP possible. */
  readonly defauts = computed(() =>
    this.lignes().some(
      (l) =>
        (l.decision && l.decision.decision !== 'CONFORME') ||
        (!l.piece && l.type.obligatoire),
    ),
  );

  readonly form = this.fb.nonNullable.group({
    dateReception: [new Date().toISOString().slice(0, 10)],
    observation: [''],
  });

  constructor() {
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
  }

  ngOnInit(): void {
    // UNE vague : référentiel du type + pièces déposées + historique des vérifications.
    forkJoin({
      types: this.typePieceService.list().pipe(catchError(() => of([] as TypePieceJointe[]))),
      pieces: this.pieceService.getByDossier(this.dossier().idDossier).pipe(catchError(() => of([] as PieceJointeDossier[]))),
      verifs: this.verifService.parDossier(this.dossier().idDossier).pipe(catchError(() => of([] as VerificationPieceDepot[]))),
    }).subscribe(({ types, pieces, verifs }) => {
      this.typesAttendus.set(
        types
          .filter((t) => t.idTypeDossier === this.dossier().idTypeDossier)
          .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)),
      );
      this.pieces.set(pieces);
      // État courant = dernière décision par type (historique ASC).
      const etat = new Map<number, VerificationPieceDepot>();
      for (const v of verifs) etat.set(v.idTypePiece, v);
      this.decisions.set(etat);
      const obs = new Map<number, string>();
      for (const [k, v] of etat) if (v.observation) obs.set(k, v.observation);
      this.observations.set(obs);
      this.chargementCtrl.set(false);
    });
  }

  loc(id?: string): string {
    return id ? this.localiteMap().get(id) ?? id : '—';
  }
  obs(idTypePiece: number): string {
    return this.observations().get(idTypePiece) ?? '';
  }
  setObs(idTypePiece: number, v: string): void {
    this.observations.update((m) => {
      const next = new Map(m);
      next.set(idTypePiece, v);
      return next;
    });
  }

  /** Consulte la pièce déposée avant de se prononcer (blob, nouvel onglet). */
  ouvrir(p: PieceJointeDossier): void {
    if (p.idPiece == null) return;
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (blob) => ouvrirBlobSur(blob),
      error: () => this.toast.error("Impossible d'ouvrir la pièce."),
    });
  }

  /** Enregistre une décision (append-only serveur — l'historique conserve chaque passage). */
  decider(l: LigneControle, decision: 'CONFORME' | 'NON_CONFORME' | 'MANQUANTE'): void {
    const observation = this.obs(l.type.idTypePiece).trim() || undefined;
    if (decision !== 'CONFORME' && !observation) {
      this.toast.error("Renseignez l'observation (motif du rejet / nature du manque) avant de décider.");
      return;
    }
    this.decisionEnCours.set(true);
    this.verifService
      .decider({
        idDossier: this.dossier().idDossier,
        idTypePiece: l.type.idTypePiece,
        idPiece: l.piece?.idPiece,
        decision,
        observation,
      })
      .subscribe({
        next: (v) => {
          this.decisionEnCours.set(false);
          this.decisions.update((m) => {
            const next = new Map(m);
            next.set(v.idTypePiece, v);
            return next;
          });
        },
        error: (e: ApiError) => {
          this.decisionEnCours.set(false);
          this.toast.error(e.message || "Enregistrement de la décision impossible.");
        },
      });
  }

  /** Signale les pièces manquantes / non conformes à la PRMP → EN_ATTENTE_COMPLEMENTS_DEPOT. */
  notifierPrmp(): void {
    this.signalement.set(true);
    this.dossierService.signalerPiecesManquantes(this.dossier().idDossier).subscribe({
      next: () => {
        this.signalement.set(false);
        this.toast.success('PRMP notifiée — le dossier passe « En attente de pièces complémentaires ».');
        this.saved.emit(null); // la worklist se rafraîchit (statut changé)
      },
      error: (e: ApiError) => {
        this.signalement.set(false);
        this.toast.error(e.message || 'Signalement impossible.');
      },
    });
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.bloquantes().length) {
      this.toast.error('Pièces obligatoires non conformes : ' + this.bloquantes().join(' ; ') + '.');
      return;
    }
    this.submitting.set(true);
    // Vérif. unitaire « déjà réceptionné ? » avant d'enregistrer (test léger, pas par ligne).
    this.receptionService.existePourDossier(this.dossier().idDossier).subscribe({
      next: (res) => {
        if (res.recu) {
          this.submitting.set(false);
          this.toast.error('Ce dossier a déjà été réceptionné.');
          this.saved.emit(null);
          return;
        }
        this.creerReception();
      },
      error: () => this.submitting.set(false), // 403/… → toast centralisé
    });
  }

  private creerReception(): void {
    const v = this.form.getRawValue();
    // idReception non envoyé : alloué par le serveur. « complet » est DÉRIVÉ du contrôle de complétude
    // (toutes les obligatoires conformes — garde serveur en miroir) : plus de case à cocher manuelle.
    const body = {
      idDossier: this.dossier().idDossier,
      numPassage: 1,
      typePassage: 'INITIAL',
      imCtrlRecept: this.auth.ref() ?? undefined,
      dateReception: v.dateReception || undefined,
      observation: v.observation || undefined,
      complet: true,
    } as Reception;
    this.receptionService.create(body).subscribe({
      next: (created) => {
        this.toast.success('Réception enregistrée.');
        this.submitting.set(false);
        this.saved.emit(created);
      },
      error: (_e: ApiError) => this.submitting.set(false), // 400/403/409 → toast centralisé
    });
  }
}
