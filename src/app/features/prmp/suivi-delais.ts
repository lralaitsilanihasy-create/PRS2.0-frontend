import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { VacanceStore } from '../../core/vacance/vacance.store';
import { Dossier, Reception } from '../../models';
import { DossierService, EntiteContractService, LocaliteService, ReceptionService, ReferenceLookupService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { StatutBadge } from '../../shared/circuit';
import { DossierConsultation } from '../circuit/dossier-consultation';
import { CompleterPiecesDepotModal } from './completer-pieces-depot-modal';
import { DossiersRefreshStore } from './dossiers-refresh.store';

/**
 * ⚠️ Demande pilote (2026-09-06) — le « Tableau de bord » PRMP devient « SUIVI DES DOSSIERS CNM » :
 * un tableau par dossier déposé — référence, date d'ENREGISTREMENT CNM (la réception par le
 * Secrétaire, premier passage) et FIN DE TRAITEMENT prévue (chronométrage serveur,
 * `datePrevisionnelleFin` ; ⏸ quand la balle est chez la PRMP et que la date glisse).
 * ⚠️ 2026-09-13 : colonne Statut RÉINTRODUITE (le pilote revient sur le choix du 2026-09-06 de n'y
 * mettre que des dates) ; colonne Actions RÉTABLIE avec des actions contextuelles (Rectifier / Soumettre) ;
 * le tableau porte désormais TOUS les dossiers de la PRMP, brouillons et à-rectifier compris.
 */
@Component({
  selector: 'app-suivi-delais',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, EtatErreur, StatutBadge, DossierConsultation, CompleterPiecesDepotModal],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">{{ domaine() }}</div>
          <!-- ⚠️ Demande pilote (2026-09-13) — titre « Tous les dossiers » pour l'UGPM (aligné sur les autres
               profils) ; la PRMP garde « Suivi des dossiers CNM » (nom choisi le 2026-09-06, cadrage délais). -->
          <h1 class="page-title">{{ estPrmp() ? 'Suivi des dossiers CNM' : 'Tous les dossiers' }}</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger le suivi des délais." (reessayer)="charger()" />
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <!-- ⚠️ 2026-09-13 (demande pilote) — colonne Statut AJOUTÉE : elle avait été écartée le
                   2026-09-06 (« l'écran suit les dates »), le pilote la réintroduit. Même badge partagé
                   que le reste de l'app (libellés Initial/Numéroté/… via statutDossierLabel). -->
              <tr>
                <th scope="col">Référence</th>
                <th scope="col">Type</th>
                <th scope="col">Entité contractante</th>
                <th scope="col">Localité</th>
                <th scope="col">Dépôt du dossier</th>
                <th scope="col">Fin traitement CNM</th>
                <th scope="col">Statut</th>
                <th scope="col" class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of dossiers(); track d.idDossier) {
                <tr class="ligne-clic" [class.cnm-row-cloture]="d.datesEtapes?.['CLOTURE']">
                  <!-- Ligne cliquable : la référence est un vrai bouton (nom accessible + clavier) dont
                       la zone cliquable est étendue à la ligne (overlay ::after) — pas de (click) sur <tr>. -->
                  <td><button type="button" class="lien-ligne" (click)="consulte.set(d)">{{ d.refeDossier || ('Dossier #' + d.idDossier) }}</button></td>
                  <!-- Type de dossier en CODE concis (sous-type de la référence, ex. PPM-AGPM ; repli famille). -->
                  <td>{{ typeDossierLabel(d) }}</td>
                  <td>{{ entiteLabel(d) }}</td>
                  <td>{{ localiteLabel(d) }}</td>
                  <!-- ⚠️ Terme métier (pilote 2026-09-06) : la date de SOUMISSION est la date de
                       DÉPÔT du dossier — même donnée (champ demandé au backend, « — » sinon). -->
                  <td class="cnm-mono">{{ d.dateSoumission ? (d.dateSoumission | date: 'dd/MM/yyyy') : '—' }}</td>
                  <!-- ⚠️ Demande pilote (2026-09-13) — colonne « Enregistrement CNM » retirée ; la méthode
                       enregistrement() reste utilisée pour DÉCIDER l'affichage de la fin (compteur = enregistrement).
                       ⚠️ Demande pilote (2026-09-07) : la « Fin traitement CNM » est une PROJECTION serveur
                       (aujourd'hui + durée standard restante) présente dès la soumission. On la MASQUE tant que
                       le dossier n'est pas ENREGISTRÉ : le traitement CNM n'a pas encore commencé (le compteur
                       démarre à l'enregistrement = debutCompteur), afficher une fin avant serait trompeur. -->
                  <td class="cnm-mono">
                    @if (enregistrement(d)) {
                      @if (d.datesEtapes?.['CLOTURE']; as clot) {
                        <span class="cnm-fin-cloture">{{ clot | date: 'dd/MM/yyyy HH:mm' }}</span>
                      } @else if (d.datePrevisionnelleFin) {
                        {{ d.datePrevisionnelleFin | date: 'dd/MM/yyyy' }}
                      } @else { — }
                      @if (d.attentePrmp) {
                        <span class="sdl-attente" title="En attente de votre action (compléments, pièces ou rectification) — la date prévisionnelle glisse tant que le dossier ne revient pas à la CNM.">⏸ à vous</span>
                      }
                    } @else {
                      —
                    }
                  </td>
                  <td><app-statut-badge [statut]="d.statut" /></td>
                  <!-- Actions contextuelles (le clic-ligne reste pour le détail) : Rectifier, Soumettre un
                       brouillon, Compléter les pièces d'un dépôt — chacune affichée seulement si elle s'applique. -->
                  <td>
                    <div class="td-actions actions-end">
                      @if (estPrmp() && d.statut === 'EN_ATTENTE_DECISION_PRMP') {
                        <a class="btn btn-primary btn-sm" [routerLink]="['/prmp/rectifier', d.idDossier]" [queryParams]="{ returnUrl: '/prmp/tableau-de-bord' }">Rectifier</a>
                      }
                      @if (estPrmp() && d.statut === 'BROUILLON') {
                        <button
                          type="button"
                          class="btn btn-success btn-sm"
                          [disabled]="submittingId() === d.idDossier || vacance()"
                          [title]="vacance() ? 'Poste PRMP vacant — soumission suspendue en attente de nomination.' : ''"
                          (click)="soumettre(d)"
                        >Soumettre</button>
                      }
                      @if (estPrmp() && d.statut === 'EN_ATTENTE_COMPLEMENTS_DEPOT') {
                        <button type="button" class="btn btn-warning btn-sm" (click)="completer.set(d)">Compléter les pièces</button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="empty-cell">Aucun dossier à la CNM.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
    @if (completer(); as d) {
      <app-completer-pieces-depot-modal [dossier]="d" (transmis)="onComplementsTransmis()" (fermer)="completer.set(null)" />
    }
  `,
  styles: `
    .sdl-attente { display: inline-block; margin-left: 0.35rem; padding: 0.05rem 0.4rem; border-radius: var(--radius-full); background: var(--warning-bg, #fffbeb); border: 1px solid var(--warning-bdr, #fde68a); color: var(--warning-text, #92400e); font-size: var(--text-xs); white-space: nowrap; }
    /* Ligne cliquable : la référence est un vrai bouton (nom accessible + clavier) dont la zone
       cliquable est ÉTENDUE à toute la ligne via un overlay ::after ; pas de (click) sur <tr>. */
    .table-card table tr.ligne-clic { position: relative; cursor: pointer; }
    .table-card table tr.ligne-clic:hover td { background: var(--n-50); }
    .lien-ligne { background: none; border: 0; padding: 0; margin: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
    .lien-ligne::after { content: ''; position: absolute; inset: 0; }
    /* Les boutons d'action passent AU-DESSUS de l'overlay → cliquables indépendamment du clic-ligne. */
    .table-card table tr.ligne-clic .btn { position: relative; z-index: 1; }
  `,
})
export class SuiviDelais {
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly toast = inject(ToastService);
  private readonly vacanceStore = inject(VacanceStore);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(ReferenceLookupService);
  /** Libellés d'entité contractante / localité (cache partagé) — colonnes du tableau, sans appel par ligne. */
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  /** Libellé de section : « Domaine UGPM » pour un compte UGPM, « Domaine PRMP » sinon (écran partagé). */
  protected readonly domaine = this.auth.domainePrmpLabel;
  /**
   * Actions de la colonne Actions RÉSERVÉES à la PRMP : l'UGPM partage cet écran (vue seule) mais ne
   * soumet/rectifie/complète pas (backend 403). `estPrmp` masque ces boutons pour un compte UGPM.
   */
  protected readonly estPrmp = computed(() => this.auth.role() === 'PRMP');
  /** Vacance du poste PRMP (spec « Mandats PRMP ») — soumission suspendue. */
  readonly vacance = this.vacanceStore.vacance;
  /** idDossier en cours de soumission (bouton désactivé + anti double-clic). */
  readonly submittingId = signal<number | null>(null);

  readonly loading = signal(true);
  readonly erreur = signal(false);
  private readonly tous = signal<Dossier[]>([]);
  /** Réception INITIALE par dossier (premier passage du Secrétaire). */
  private readonly receptions = signal<Map<number, Reception>>(new Map());
  /** Dossier ouvert en consultation lecture seule (null = fermé). */
  readonly consulte = signal<Dossier | null>(null);
  /** Dossier ouvert dans le modal « Compléter les pièces » (EN_ATTENTE_COMPLEMENTS_DEPOT ; null = fermé). */
  readonly completer = signal<Dossier | null>(null);

  /**
   * Tous les dossiers de la PRMP, plus récents d'abord. ⚠️ 2026-09-13 (demande pilote) : les BROUILLONS
   * sont désormais AFFICHÉS (avec un bouton « Soumettre ») — ils n'ont ni enregistrement ni délai CNM,
   * leurs colonnes de dates restent à « — ». Copie avant tri (ne jamais muter la valeur du signal).
   */
  readonly dossiers = computed(() =>
    [...this.tous()].sort((a, b) => b.idDossier - a.idDossier),
  );

  constructor() {
    this.charger();
    // Libellés d'entité / localité (cache partagé) — colonnes « Entité contractante » / « Localité ».
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    forkJoin({
      dossiers: this.dossierService.list(),
      // ⚠️ 2026-09-13 (demande pilote) — la liste scopée exclut brouillons et à-rectifier ; on les fusionne
      // explicitement (dédoublonnage par idDossier ci-dessous) pour que le tableau porte TOUS les dossiers.
      aRectifier: this.dossierService.list('EN_ATTENTE_DECISION_PRMP').pipe(catchError(() => of([] as Dossier[]))),
      brouillons: this.dossierService.list('BROUILLON').pipe(catchError(() => of([] as Dossier[]))),
      aCompleter: this.dossierService.list('EN_ATTENTE_COMPLEMENTS_DEPOT').pipe(catchError(() => of([] as Dossier[]))),
      receptions: this.receptionService.list().pipe(catchError(() => of([] as Reception[]))),
    }).subscribe({
      next: ({ dossiers, aRectifier, brouillons, aCompleter, receptions }) => {
        const parId = new Map<number, Dossier>();
        for (const d of [...dossiers, ...aRectifier, ...brouillons, ...aCompleter]) parId.set(d.idDossier, d);
        this.tous.set([...parId.values()]);
        const parDossier = new Map<number, Reception>();
        for (const r of receptions) {
          const connue = parDossier.get(r.idDossier);
          if (!connue || (r.numPassage ?? 99) < (connue.numPassage ?? 99)) {
            parDossier.set(r.idDossier, r);
          }
        }
        this.receptions.set(parDossier);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  /**
   * Date d'enregistrement CNM : le champ du DTO dossier dès que le backend le sert
   * (demande 2026-09-06), en repli la réception du premier passage quand elle est lisible.
   */
  enregistrement(d: Dossier): string | null {
    return d.dateEnregistrement ?? this.receptions().get(d.idDossier)?.dateReception ?? null;
  }

  /** Type de dossier en CODE concis (`idSousType`, ex. « PPM-AGPM » ; repli famille `idTypeDossier`). */
  typeDossierLabel(d: Dossier): string {
    return d.idSousType ?? d.idTypeDossier ?? '—';
  }

  /** Libellé de l'entité contractante du dossier (cache, sans appel par ligne ; repli sur l'id). */
  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract : '—';
  }

  /** Libellé de la localité du dossier (cache ; repli sur le code). */
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }

  /** Compléments transmis (dossier revenu SOUMIS) : ferme le modal, recharge, propage aux autres écrans. */
  onComplementsTransmis(): void {
    this.completer.set(null);
    this.charger();
    this.dossiersRefresh.notifierChangement();
  }

  /**
   * « Soumettre » un brouillon (PRMP) — même geste que « Mes dossiers » : `POST /dossiers/{id}/soumettre`,
   * puis rechargement local + propagation aux autres écrans. Le backend tranche la validité (400 explicite,
   * ex. PPM manquant) ; on affiche le détail des `fieldErrors` que l'intercepteur laisse passer.
   */
  soumettre(d: Dossier): void {
    this.submittingId.set(d.idDossier);
    this.dossierService.soumettre(d.idDossier).subscribe({
      next: (res) => {
        this.toast.success(`Dossier soumis${res.refeDossier ? ' · réf. ' + res.refeDossier : ''}.`);
        this.submittingId.set(null);
        this.dossiersRefresh.notifierChangement();
        this.charger();
      },
      error: (e: ApiError) => {
        this.submittingId.set(null);
        const detail = e.fieldErrors ? Object.values(e.fieldErrors).join(' ') : '';
        this.toast.error(detail || e.message || 'Échec de la soumission.', 'Soumission impossible');
      },
    });
  }
}
