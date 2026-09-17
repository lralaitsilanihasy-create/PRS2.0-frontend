import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuditLog } from '../../models';
import { AuditLogService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { ConnexionsJournal } from './connexions-journal';

/** Filtres serveur du journal (`GET /api/audit-logs?page=`), tous facultatifs. */
interface FiltresAudit {
  table: string;
  acteur: string;
  du: string;
  au: string;
}

const FILTRES_VIDES: FiltresAudit = { table: '', acteur: '', du: '', au: '' };

/** Les deux journaux de l'application. `actions` reste l'onglet d'ouverture. */
type Onglet = 'actions' | 'connexions';

/**
 * **Journal** (ADMINISTRATEUR, lecture seule) — écran DÉDIÉ, deux onglets depuis le lot 6 F5 :
 *
 * - **Actions** — le journal d'audit (`/api/audit-logs`) : qui a écrit quoi, et où. Inchangé ;
 * - **Connexions** — le journal des connexions (`/api/sessions`, besoin backend B4 livré le
 *   2026-09-17) : qui s'est connecté, qui a essayé et échoué, depuis où (`ConnexionsJournal`).
 *
 * Ce sont **deux journaux, pas deux vues d'un même journal** : une ligne d'audit décrit une écriture
 * (table, enregistrement, champ), une session décrit une durée (un début, une fin, un poste, une
 * adresse) — et l'intercepteur d'audit ignore de toute façon toute réponse ≥ 400, c'est-à-dire
 * exactement les tentatives refusées. Ils se lisent au même endroit parce qu'on y vient pour la même
 * raison. Voir `backend/docs/adr/ADR-0006-journal-des-connexions.md`.
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
 * Le serveur impose le tri des deux journaux (du plus récent au plus ancien) : un journal n'a qu'un
 * ordre de lecture sensé.
 *
 * ⚠️ **L'onglet est dans l'URL** (`?journal=connexions`) et l'onglet des connexions accepte
 * `?succes=false` : c'est ce qui permet à l'accueil de renvoyer directement sur les tentatives
 * refusées, et à l'Administrateur de garder le lien.
 */
@Component({
  selector: 'app-audit-logs-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, EtatErreur, ConnexionsJournal],
  template: `
    <section class="al">
      <header class="page-header">
        <h1 class="page-title">Journal</h1>
      </header>

      <!-- ⚠️ Les flèches sont écoutées sur chaque ONGLET, pas sur la barre : un conteneur qui porte
           un gestionnaire de touches sans être focalisable ne reçoit jamais l'événement au clavier
           (et la règle interactive-supports-focus le refuse, à juste titre). -->
      <div class="al__onglets" role="tablist" aria-label="Journaux de l'application">
        <button
          type="button"
          role="tab"
          id="al-onglet-actions"
          class="al__onglet"
          [class.al__onglet--on]="onglet() === 'actions'"
          [attr.aria-selected]="onglet() === 'actions'"
          [attr.tabindex]="onglet() === 'actions' ? 0 : -1"
          aria-controls="al-panneau-actions"
          (click)="ouvrir('actions')"
          (keydown)="clavier($event)"
        >
          Actions
          <span class="al__onglet-a">écritures enregistrées</span>
        </button>
        <button
          type="button"
          role="tab"
          id="al-onglet-connexions"
          class="al__onglet"
          [class.al__onglet--on]="onglet() === 'connexions'"
          [attr.aria-selected]="onglet() === 'connexions'"
          [attr.tabindex]="onglet() === 'connexions' ? 0 : -1"
          aria-controls="al-panneau-connexions"
          (click)="ouvrir('connexions')"
          (keydown)="clavier($event)"
        >
          Connexions
          <span class="al__onglet-a">tentatives, réussies ou refusées</span>
        </button>
      </div>

      @if (onglet() === 'connexions') {
        <div role="tabpanel" id="al-panneau-connexions" aria-labelledby="al-onglet-connexions" tabindex="0">
          <app-connexions-journal [succesInitial]="succesInitial" [acteurInitial]="acteurInitial" />
        </div>
      } @else {
      <!-- ⚠️ Onglet « Actions » : le journal d'audit tel qu'il était avant le lot F5. Son gabarit
           garde volontairement son indentation d'origine sous le panneau qui l'enveloppe — la
           relire décalée de deux espaces n'apprendrait rien et masquerait, à la revue, qu'il n'a
           pas changé. Seul le compte d'entrées descend de l'en-tête (partagé) dans le panneau
           (propre à cet onglet). -->
      <div role="tabpanel" id="al-panneau-actions" aria-labelledby="al-onglet-actions" tabindex="0">
      <p class="al__compte">{{ totalElements() }} entrée(s)</p>

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
      </div>

      }
    </section>
  `,
  styles: `
    .al__compte { font-size: var(--text-sm); color: var(--n-500); font-weight: 600; margin: 0 0 0.6rem; }

    /* ── Onglets ─────────────────────────────────────────────────────────── */
    /* Langage local plutôt que les onglets globaux « onglets-dossier » : ceux-là sont orangés et
       comptés, au service du circuit d'un dossier. Ici deux journaux, pas des pièces d'un dossier. */
    .al__onglets {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--n-200);
      margin-bottom: 14px;
    }
    .al__onglet {
      appearance: none;
      background: none;
      border: 0;
      border-bottom: 3px solid transparent;
      padding: 8px 14px 9px;
      cursor: pointer;
      text-align: left;
      font-size: var(--text-base);
      font-weight: 700;
      /* --n-500 est calibré AA sur le fond de page : un onglet au repos reste LISIBLE, il n'est
         pas estompé — c'est le seul moyen de savoir que l'autre journal existe. */
      color: var(--n-500);
    }
    .al__onglet:hover { color: var(--p-800); background: var(--n-100); }
    .al__onglet:focus-visible { outline: 2px solid var(--p-700); outline-offset: -2px; }
    .al__onglet--on { color: var(--p-800); border-bottom-color: var(--p-700); }
    .al__onglet-a {
      display: block;
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--n-500);
      margin-top: 1px;
    }
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Onglet affiché. Lu une fois dans l'URL ; toute valeur inattendue retombe sur « Actions ». */
  readonly onglet = signal<Onglet>(
    this.route.snapshot.queryParamMap.get('journal') === 'connexions' ? 'connexions' : 'actions',
  );

  /**
   * `?succes=false` de l'URL — l'accueil ouvre l'onglet des connexions déjà filtré sur les
   * tentatives refusées. Lu une seule fois : c'est une valeur de DÉPART, l'utilisateur reste maître
   * du filtre ensuite.
   */
  readonly succesInitial: boolean | null = lireSucces(this.route.snapshot.queryParamMap.get('succes'));

  /**
   * `?acteur=` de l'URL — la fiche d'annuaire ouvre l'onglet sur les connexions d'une personne
   * (« Ses connexions »). Même règle : une valeur de DÉPART, visible dans le formulaire de filtres.
   */
  readonly acteurInitial = this.route.snapshot.queryParamMap.get('acteur') ?? '';

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
    // L'onglet des actions ne se charge que s'il est celui qu'on regarde : arriver par
    // `?journal=connexions` ne doit pas demander au serveur une page que personne n'ouvrira.
    if (this.onglet() === 'actions') {
      this.chargerPage(0);
    }
  }

  /**
   * Change d'onglet, et l'écrit dans l'URL **sans empiler d'entrée d'historique** : « Précédent »
   * doit ramener à l'écran d'où l'on vient, pas faire défiler les onglets un à un.
   */
  ouvrir(onglet: Onglet): void {
    if (this.onglet() === onglet) {
      return;
    }
    this.onglet.set(onglet);
    if (onglet === 'actions' && !this.dejaCharge()) {
      this.chargerPage(0);
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { journal: onglet === 'actions' ? null : onglet, succes: null, acteur: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Flèches gauche/droite entre les onglets, comme l'attend le motif ARIA « tablist » — sans quoi
   * le clavier doit passer par la tabulation, qui ne visite que l'onglet actif (`tabindex="-1"`
   * sur l'autre) et ne permet donc plus d'en changer du tout.
   */
  clavier(evenement: KeyboardEvent): void {
    const suivant =
      evenement.key === 'ArrowRight' || evenement.key === 'ArrowDown'
        ? true
        : evenement.key === 'ArrowLeft' || evenement.key === 'ArrowUp'
          ? false
          : null;
    if (suivant === null) {
      return;
    }
    evenement.preventDefault();
    const cible: Onglet = this.onglet() === 'actions' ? 'connexions' : 'actions';
    this.ouvrir(cible);
    // Le focus suit la sélection : c'est le comportement « automatic activation » du motif.
    const bouton = document.getElementById(`al-onglet-${cible}`);
    bouton?.focus();
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

/**
 * `?succes=` de l'URL : `true`, `false`, ou rien du tout. Une valeur inattendue ne filtre PAS —
 * ouvrir le journal sur un filtre qu'on n'a pas demandé cacherait des lignes sans le dire.
 */
function lireSucces(brut: string | null): boolean | null {
  if (brut === 'true') {
    return true;
  }
  if (brut === 'false') {
    return false;
  }
  return null;
}
