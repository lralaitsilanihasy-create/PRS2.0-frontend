import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PermissionsService } from '../../core/auth/permissions.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { DemandeRetrait, Dossier } from '../../models';
import { DemandeRetraitService, DossierService, ReferenceLookupService } from '../../services';
import { StatutBadge, statutDemandeRetraitLabel } from '../../shared/circuit';
import { DossierConsultation } from './dossier-consultation';

/**
 * Validation des demandes de retrait (CC / Président) — worklist « À valider »
 * (/a-valider) + « Historique » (/historique), avec détail dossier en lecture seule.
 * Reflet du back : accepter → dossier renvoyé en brouillon (décidé serveur) ; on
 * affiche le résultat et on rafraîchit. 403/409 via l'intercepteur.
 */
@Component({
  selector: 'app-retraits-validation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation, RouterLink],
  template: `
    <section class="rv">
      <!-- ⚠️ 2026-08-07 — deux usages : écran à part entière (route « …/retraits ») ou panneau DÉPLIÉ sous
           les cartes de « Mes dossiers ». Encastré, le titre est un simple bandeau : la carte cliquée
           dit déjà de quel type il s'agit, et le filtre n'est pas à défaire ici (re-clic sur la ligne). -->
      @if (embedded()) {
        <div class="rv__embed-head">Demandes de retrait — {{ typeFiltre() }}</div>
      } @else {
        <header class="page-header">
          <h1 class="page-title">Demandes de retrait</h1>
        </header>

        <!-- Filtre venu d'un lien profond (« ?type= ») — toujours réversible d'un clic. -->
        @if (typeFiltre(); as t) {
          <p class="rv__filtre">
            Demandes portant sur les dossiers de type <strong>{{ t }}</strong>.
            <a [routerLink]="[]" [queryParams]="{ type: null }" queryParamsHandling="merge">Voir tous les types</a>
          </p>
        }
      }

      <div class="rv__tabs">
        <button type="button" class="cnm-tab" [class.cnm-tab--active]="onglet() === 'a-valider'" (click)="setOnglet('a-valider')">
          À valider
        </button>
        <button type="button" class="cnm-tab" [class.cnm-tab--active]="onglet() === 'historique'" (click)="setOnglet('historique')">
          Historique
        </button>
      </div>

      <!-- ⚠️ 2026-08-17 (demande user) — sans cette explication, l'écran est MUET : la liste
           s'affiche mais la colonne d'actions reste vide, sans que rien n'indique pourquoi.
           Cas courant : un Président qui n'a pas activé la délégation « Chef de commission ». -->
      @if (onglet() === 'a-valider' && !canDecide() && liste().length) {
        <div class="alert alert-info rv__info" role="status">
          @if (peutParDelegation()) {
            <strong>Décision indisponible pour le moment.</strong>
            Accepter ou refuser un retrait relève du <strong>Chef de commission</strong> : activez
            <strong>« Chef de commission »</strong> dans le panneau <strong>Délégations ⤴</strong>, en bas
            de la barre latérale, et les boutons apparaîtront sur chaque ligne.
          } @else {
            <strong>Consultation seule.</strong>
            La décision sur une demande de retrait est réservée au <strong>Chef de commission</strong>
            (ou au Président exerçant cette délégation).
          }
        </div>
      }

      <div class="rv__grid">
        <div class="rv__main">
          @if (loadingDetail()) {
            <p class="text-muted" role="status">Ouverture du dossier…</p>
          }
          @if (loading()) {
            <p class="text-muted" role="status">Chargement…</p>
          } @else if (onglet() === 'a-valider') {
            <div class="table-card">
            <table>
              <thead><tr><th scope="col">Dossier</th><th scope="col">PRMP</th><th scope="col">Motif</th><th scope="col">Lettre</th><th scope="col">Date</th><th scope="col"></th></tr></thead>
              <tbody>
                @for (r of liste(); track r.idDemandeRetrait) {
                  <tr>
                    <td><button type="button" class="rv__link" (click)="voirDetail(r.idDossier)">{{ dossierRef(r.idDossier) }}</button></td>
                    <td>{{ r.idPrmp || '—' }}</td>
                    <td class="rv__motif">{{ r.motifRetrait }}</td>
                    <!-- Lettre signée : à consulter AVANT de trancher (règle 2026-08-17).
                         « — » sur les demandes antérieures, qui n'en portent pas. -->
                    <td>
                      @if (r.nomFichier) {
                        <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirLettre(r)">Ouvrir</button>
                      } @else {
                        <span class="text-muted">—</span>
                      }
                    </td>
                    <td class="cnm-mono">{{ r.dateDemande || '—' }}</td>
                    <td>
                      @if (canDecide()) {
                        @if (refusOpen() === r.idDemandeRetrait) {
                          <div class="rv__refus">
                            <textarea
                              class="form-control"
                              rows="2"
                              placeholder="Motif du refus (obligatoire)"
                              [value]="refusMotif()"
                              (input)="refusMotif.set($any($event.target).value)"
                            ></textarea>
                            <div class="rv__refus-actions">
                              <button type="button" class="btn btn-secondary btn-sm" (click)="annulerRefus()">Annuler</button>
                              <button type="button" class="btn btn-danger btn-sm" [disabled]="deciding() || !refusMotif().trim()" (click)="confirmerRefus(r)">
                                Confirmer le refus
                              </button>
                            </div>
                          </div>
                        } @else {
                          <div class="rv__actions">
                            <button type="button" class="btn btn-success btn-sm" [disabled]="deciding()" (click)="accepter(r)">Accepter</button>
                            <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirRefus(r.idDemandeRetrait!)">Refuser</button>
                          </div>
                        }
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="text-muted">Aucune demande à valider.</td></tr>
                }
              </tbody>
            </table>
            </div>
          } @else {
            <div class="table-card">
            <table>
              <thead><tr><th scope="col">Dossier</th><th scope="col">PRMP</th><th scope="col">Motif</th><th scope="col">Lettre</th><th scope="col">Statut</th><th scope="col">Date décision</th><th scope="col">Motif du refus</th></tr></thead>
              <tbody>
                @for (r of liste(); track r.idDemandeRetrait) {
                  <tr>
                    <td><button type="button" class="rv__link" (click)="voirDetail(r.idDossier)">{{ dossierRef(r.idDossier) }}</button></td>
                    <td>{{ r.idPrmp || '—' }}</td>
                    <td class="rv__motif">{{ r.motifRetrait }}</td>
                    <td>
                      @if (r.nomFichier) {
                        <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirLettre(r)">Ouvrir</button>
                      } @else {
                        <span class="text-muted">—</span>
                      }
                    </td>
                    <td><app-statut-badge [statut]="r.statut" [label]="statutLabel(r.statut)" /></td>
                    <td class="cnm-mono">{{ r.dateDecision || '—' }}</td>
                    <td class="rv__motif">{{ r.statut === 'REFUSEE' ? (r.obsDecision || '—') : '—' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="text-muted">Aucune demande décidée.</td></tr>
                }
              </tbody>
            </table>
            </div>
          }
        </div>

      </div>
    </section>

    <!-- ⚠️ 2026-08-17 (demande user) — le détail s'ouvre en MODALE, plus dans une colonne latérale :
         le dossier porte le tableau des marchés (13 colonnes), illisible dans une colonne étroite
         où les en-têtes se repliaient lettre par lettre. La liste reprend toute la largeur. -->
    @if (selectedDossier(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="fermerDetail()" />
    }
  `,
  styles: `
    .rv__tabs { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
    /* Le détail s'ouvre en modale : la liste occupe toute la largeur (une seule colonne). */
    .rv__grid { display: grid; grid-template-columns: 1fr; gap: 0.75rem; align-items: start; }
    .rv__actions, .rv__refus-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
    .rv__refus { display: flex; flex-direction: column; gap: 0.5rem; min-width: 14rem; }
    .rv__embed-head { font-weight: 700; color: var(--n-700); margin-bottom: 0.25rem; }
    .rv__info { margin-bottom: 0.75rem; }
    .rv__filtre { margin: -0.4rem 0 0; color: var(--n-500); font-size: var(--text-sm); }
    .rv__filtre a { margin-left: 0.4rem; color: var(--p-600); font-weight: 600; }
    .rv__link { background: transparent; border: 0; padding: 0; cursor: pointer; color: var(--c-600); font: inherit; text-decoration: underline; }
    /* Le motif est du texte libre : sans cela, le « white-space: nowrap » global des cellules
       étire la ligne et pousse la colonne de décision hors de l'écran. */
    .rv__motif { white-space: normal; max-width: 42rem; }
    @media (max-width: 60rem) { .rv__grid { grid-template-columns: 1fr; } }
  `,
})
export class RetraitsValidation {
  private readonly service = inject(DemandeRetraitService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionsService);
  private readonly route = inject(ActivatedRoute);

  readonly onglet = signal<'a-valider' | 'historique'>('a-valider');
  /** Toutes les demandes de l'onglet courant, avant filtrage par type. */
  private readonly toutes = signal<DemandeRetrait[]>([]);
  /** Type imposé par l'appelant quand le composant est déplié sous les cartes de « Mes dossiers ». */
  readonly type = input<string | null>(null);
  /** `true` = panneau encastré dans un autre écran (titre allégé, pas de bandeau de filtre). */
  readonly embedded = input(false);
  /** Type lu dans l'URL (`?type=DDP`) pour l'usage en écran à part entière. */
  private readonly typeUrl = signal<string | null>(null);
  /**
   * ⚠️ 2026-08-07 (demande user) — l'écran s'atteint depuis la carte d'un type de dossier
   * (« Mes dossiers »). Le type vient soit de l'entrée (panneau déplié), soit de l'URL (lien
   * profond). Filtre facultatif : sans lui, tout s'affiche.
   */
  readonly typeFiltre = computed(() => this.type() ?? this.typeUrl());
  readonly liste = computed(() => {
    const type = this.typeFiltre();
    if (!type) {
      return this.toutes();
    }
    return this.toutes().filter((r) => this.typeParDossier().get(r.idDossier) === type);
  });
  /** idDossier → idTypeDossier, pour rattacher une demande au type de son dossier. */
  private readonly typeParDossier = signal<Map<number, string>>(new Map());
  readonly loading = signal(true);
  readonly deciding = signal(false);
  readonly refusOpen = signal<number | null>(null);
  readonly refusMotif = signal('');
  readonly selectedDossier = signal<Dossier | null>(null);
  readonly loadingDetail = signal(false);
  private readonly dossierMap = signal<Map<string, string>>(new Map());

  readonly canDecide = computed(() => this.permissions.can('DEMANDE_RETRAIT_DECISION'));

  /**
   * Vrai si l'utilisateur POURRAIT décider en activant la délégation « Chef de commission »
   * (paire active en base, mais interrupteur éteint) : cas du Président. Sert à afficher le
   * mode d'emploi plutôt qu'un simple « non autorisé ».
   */
  readonly peutParDelegation = computed(
    () => !this.canDecide() && this.permissions.delegationsDisponibles().includes('CHEF_COMMISSION'),
  );

  constructor() {
    this.lookups.lookup(DossierService, 'idDossier', ['refeDossier']).subscribe((m) => this.dossierMap.set(m));
    // ⚠️ Le type ne peut PAS venir d'un second `lookup(DossierService, …)` : le cache de
    // `ReferenceLookupService` est indexé par SERVICE, pas par champs — il renverrait la table des
    // références. Un appel de liste dédié, une fois, et l'on en tire la correspondance de type.
    this.dossierService.list().subscribe({
      next: (rows) => {
        const m = new Map<number, string>();
        for (const d of rows) {
          if (d.idDossier != null && d.idTypeDossier) {
            m.set(d.idDossier, d.idTypeDossier);
          }
        }
        this.typeParDossier.set(m);
      },
      error: () => {},
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      const t = p.get('type');
      this.typeUrl.set(t && t.trim() ? t.trim() : null);
    });
    this.charger();
  }

  /** Libellé du type filtré, pour le bandeau (le code suffit : DDP / DMC / DDM). */
  readonly libelleFiltre = computed(() => this.typeFiltre() ?? '');

  statutLabel(s?: string): string {
    return statutDemandeRetraitLabel(s);
  }
  dossierRef(id: number): string {
    return this.dossierMap().get(String(id)) ?? '#' + id;
  }

  setOnglet(o: 'a-valider' | 'historique'): void {
    if (this.onglet() === o) {
      return;
    }
    this.onglet.set(o);
    this.annulerRefus();
    this.charger();
  }

  private charger(): void {
    this.loading.set(true);
    const call = this.onglet() === 'historique' ? this.service.historique() : this.service.aValider();
    call.subscribe({
      next: (rows) => {
        this.toutes.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  voirDetail(idDossier: number): void {
    this.loadingDetail.set(true);
    this.selectedDossier.set(null);
    this.dossierService.getById(idDossier).subscribe({
      next: (d) => {
        this.selectedDossier.set(d);
        this.loadingDetail.set(false);
      },
      error: () => this.loadingDetail.set(false),
    });
  }

  /** Ouvre la lettre de demande de retrait (PDF signé). 404 = demande antérieure à la règle. */
  ouvrirLettre(r: DemandeRetrait): void {
    if (r.idDemandeRetrait == null) return;
    this.service.document(r.idDemandeRetrait).subscribe({
      next: (blob) => ouvrirBlobSur(blob),
      error: () => this.toast.error("La lettre n'est pas disponible pour cette demande."),
    });
  }

  /** Referme la modale de détail. */
  fermerDetail(): void {
    this.selectedDossier.set(null);
  }

  accepter(r: DemandeRetrait): void {
    if (r.idDemandeRetrait == null) {
      return;
    }
    this.deciding.set(true);
    this.service.accepter(r.idDemandeRetrait).subscribe({
      next: () => {
        this.toast.success('Demande acceptée — dossier renvoyé en brouillon.');
        this.deciding.set(false);
        this.charger();
      },
      error: (_e: ApiError) => this.deciding.set(false), // 403/409 → toast centralisé
    });
  }

  ouvrirRefus(id: number): void {
    this.refusOpen.set(id);
    this.refusMotif.set('');
  }
  annulerRefus(): void {
    this.refusOpen.set(null);
    this.refusMotif.set('');
  }
  confirmerRefus(r: DemandeRetrait): void {
    const motif = this.refusMotif().trim();
    if (r.idDemandeRetrait == null || !motif) {
      return;
    }
    this.deciding.set(true);
    this.service.refuser(r.idDemandeRetrait, motif).subscribe({
      next: () => {
        this.toast.success('Demande refusée.');
        this.deciding.set(false);
        this.annulerRefus();
        this.charger();
      },
      error: (_e: ApiError) => this.deciding.set(false),
    });
  }
}
