import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { AuditLog } from '../../models';
import { AuditLogService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/** Filtres serveur du journal (`GET /api/audit-logs?page=`), tous facultatifs. */
interface FiltresAudit {
  table: string;
  acteur: string;
  du: string;
  au: string;
}

const FILTRES_VIDES: FiltresAudit = { table: '', acteur: '', du: '', au: '' };

/**
 * Journal d'audit (ADMINISTRATEUR, lecture seule) — écran DÉDIÉ.
 *
 * ⚠️ Audit 2026-08-27 (C-1). L'écran passait par le CRUD générique, qui demande la ressource
 * ENTIÈRE : `t_audit_log` reçoit une ligne à chaque écriture de l'application et ne cesse jamais de
 * grossir — on téléchargeait des années de journal pour en lire les vingt dernières lignes.
 *
 * Pourquoi un composant dédié plutôt qu'une pagination portée par `CrudPage` : cette ressource est
 * la seule en `readOnly` à avoir des filtres qui lui sont propres (table, acteur, période). Les
 * porter dans `CrudResourceConfig` aurait imposé des notions d'audit à la vingtaine d'autres
 * ressources d'administration, dont aucune n'a d'endpoint paginé ni ces filtres — alors que rien de
 * la machinerie de `CrudPage` (formulaire, création, modification, suppression, résolution de clés
 * étrangères) ne sert ici. L'écran dédié ne coûte que son propre gabarit et ne touche à rien.
 *
 * Le serveur impose le tri (`dateAction` décroissant) : le journal n'a qu'un ordre de lecture sensé.
 */
@Component({
  selector: 'app-audit-logs-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, EtatErreur],
  template: `
    <section class="al">
      <header class="page-header">
        <h1 class="page-title">Journal d'audit</h1>
        <span class="al__compte">{{ totalElements() }} entrée(s)</span>
      </header>

      <form class="al__filtres" [formGroup]="form" (ngSubmit)="appliquer()" novalidate>
        <label class="form-group al__filtre">
          <span class="form-label">Table auditée</span>
          <input class="form-control" type="text" formControlName="table" list="al-tables" autocomplete="off" />
          <datalist id="al-tables">
            @for (t of tablesVues(); track t) { <option [value]="t"></option> }
          </datalist>
        </label>
        <label class="form-group al__filtre">
          <span class="form-label">Acteur (matricule)</span>
          <input class="form-control" type="text" formControlName="acteur" autocomplete="off" />
        </label>
        <label class="form-group al__filtre">
          <span class="form-label">Du</span>
          <input class="form-control" type="date" formControlName="du" />
        </label>
        <label class="form-group al__filtre">
          <span class="form-label">Au</span>
          <input class="form-control" type="date" formControlName="au" />
        </label>
        <div class="al__filtres-actions">
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="chargement()">Filtrer</button>
          <button type="button" class="btn btn-outline btn-sm" [disabled]="chargement()" (click)="reinitialiser()">
            Réinitialiser
          </button>
        </div>
      </form>
      <p class="al__aide">
        Table et acteur sont comparés à l'identique ; les deux dates sont incluses. Les entrées vont
        de la plus récente à la plus ancienne.
      </p>

      @if (premierChargement()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger le journal d'audit." (reessayer)="recharger()" />
      } @else {
        <!-- Hauteur réservée : le message n'apparaît pas « en poussant » le tableau vers le bas. -->
        <p class="al__etat" role="status">@if (chargement()) { Chargement de la page… }</p>
        <div class="table-card" [attr.aria-busy]="chargement()">
          <table>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Date</th>
                <th scope="col">Acteur</th>
                <th scope="col">Table</th>
                <th scope="col">Enregistrement</th>
                <th scope="col">Action</th>
                <th scope="col">Champ</th>
              </tr>
            </thead>
            <tbody>
              @for (l of lignes(); track l.idLog) {
                <tr>
                  <td>{{ l.idLog }}</td>
                  <td>{{ l.dateAction }}</td>
                  <td>{{ l.imActeur || '—' }}</td>
                  <td>{{ l.nomTable || '—' }}</td>
                  <td>{{ l.idEnregistrement || '—' }}</td>
                  <td>{{ l.typeAction || '—' }}</td>
                  <td>{{ l.champModifie || '—' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="al__vide">Aucune entrée pour ces critères.</td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (totalPages() > 1) {
          <nav class="al__pager" aria-label="Pages du journal">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              [disabled]="pageIndex() === 0 || chargement()"
              (click)="pagePrecedente()"
            >
              Précédent
            </button>
            <span class="al__pager-info">Page {{ pageIndex() + 1 }} / {{ totalPages() }}</span>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              [disabled]="pageIndex() + 1 >= totalPages() || chargement()"
              (click)="pageSuivante()"
            >
              Suivant
            </button>
          </nav>
        }
      }
    </section>
  `,
  styles: `
    .al__compte { font-size: var(--text-sm); color: var(--n-500); font-weight: 600; }
    .al__filtres {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
      margin-bottom: 0.4rem;
    }
    .al__filtre { margin: 0; flex: 1 1 11rem; min-width: 9rem; }
    .al__filtres-actions { display: flex; gap: 0.5rem; }
    .al__aide { margin: 0 0 1rem; font-size: var(--text-sm); color: var(--n-500); }
    /* Changement de page : le tableau reste en place ET lisible — l'estomper aurait fait passer son
       texte sous le contraste AA ; l'attente est dite par une ligne de statut à hauteur réservée. */
    .al__etat {
      margin: 0 0 0.35rem;
      min-height: 1.15rem;
      font-size: var(--text-sm);
      color: var(--n-500);
    }
    .al__vide { text-align: center; color: var(--n-400); padding: 1.5rem; }
    .al__pager {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 1rem;
    }
    .al__pager-info { font-size: var(--text-sm); color: var(--n-500); font-weight: 600; }
  `,
})
export class AuditLogsAdmin {
  private readonly service = inject(AuditLogService);
  private readonly fb = inject(FormBuilder);

  /** Saisie en cours des filtres — appliquée seulement à la validation du formulaire. */
  readonly form = this.fb.nonNullable.group({ ...FILTRES_VIDES });
  /** Filtres réellement en vigueur : conservés d'une page à l'autre. */
  private readonly filtresActifs = signal<FiltresAudit>({ ...FILTRES_VIDES });

  readonly lignes = signal<AuditLog[]>([]);
  readonly chargement = signal(false);
  private readonly dejaCharge = signal(false);
  /** Premier chargement : le tableau n'existe pas encore, on affiche « Chargement… ». */
  readonly premierChargement = computed(() => this.chargement() && !this.dejaCharge());
  readonly erreur = signal(false);

  readonly pageIndex = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  private readonly pageSize = 25;

  /** Tables rencontrées sur la page affichée — simple aide de saisie du filtre (pas une contrainte). */
  readonly tablesVues = computed(() =>
    [...new Set(this.lignes().map((l) => l.nomTable).filter((t): t is string => !!t))].sort(),
  );

  constructor() {
    this.chargerPage(0);
  }

  appliquer(): void {
    this.filtresActifs.set(this.form.getRawValue());
    this.chargerPage(0);
  }

  reinitialiser(): void {
    this.form.reset({ ...FILTRES_VIDES });
    this.filtresActifs.set({ ...FILTRES_VIDES });
    this.chargerPage(0);
  }

  /** Rejoué par « Réessayer » : recharge la page demandée avec les filtres en vigueur (AUDIT.md P9). */
  recharger(): void {
    this.chargerPage(this.pageIndex());
  }

  pagePrecedente(): void {
    if (this.pageIndex() > 0) {
      this.chargerPage(this.pageIndex() - 1);
    }
  }
  pageSuivante(): void {
    if (this.pageIndex() + 1 < this.totalPages()) {
      this.chargerPage(this.pageIndex() + 1);
    }
  }

  private chargerPage(page: number): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.listePage(page, this.pageSize, this.parametres()).subscribe({
      next: (p) => {
        this.lignes.set(p.content);
        this.pageIndex.set(p.number);
        this.totalPages.set(p.totalPages);
        this.totalElements.set(p.totalElements);
        this.chargement.set(false);
        this.dejaCharge.set(true);
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  /**
   * Filtres non vides seulement. Une date vide DOIT être omise : le serveur attend `AAAA-MM-JJ`
   * et refuserait (400) une chaîne vide, là où l'absence du paramètre vaut « pas de borne ».
   */
  private parametres(): Record<string, string> {
    const actifs = this.filtresActifs();
    const params: Record<string, string> = {};
    for (const [cle, valeur] of Object.entries(actifs)) {
      const v = valeur.trim();
      if (v) {
        params[cle] = v;
      }
    }
    return params;
  }
}
