import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';

import { ApiError, getFieldError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { TYPES_PDF, urlBlobSure, validerFichier } from '../../core/securite/fichiers-surs';
import { VacanceStore } from '../../core/vacance/vacance.store';
import { DemandeRetrait, Dossier } from '../../models';
import { DemandeRetraitService, DossierService, LocaliteService, ReferenceLookupService } from '../../services';
import { StatutBadge, statutDemandeRetraitLabel } from '../../shared/circuit';
import { DossierConsultation } from '../circuit/dossier-consultation';
import { DossiersRefreshStore } from './dossiers-refresh.store';

/**
 * Demande de retrait (PRMP) — deux colonnes : formulaire motivé (gauche) + détail
 * lecture seule du dossier sélectionné (droite) ; suivi des demandes en dessous.
 * Reflet du back : identité/date/statut posés serveur (non envoyés) ; on n'envoie
 * que `{ idDossier, motifRetrait }`. 403/409 via l'intercepteur.
 */
@Component({
  selector: 'app-prmp-retraits',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, StatutBadge, DossierConsultation],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Demande de retrait</h1>
        </div>
      </header>

      <div class="rt-grid">
        <div class="card">
          <div class="card-header"><span class="card-title">Nouvelle demande</span></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label required" for="ret-dossier">Dossier à retirer</label>
              <select id="ret-dossier" class="form-control" [value]="selectedId() ?? ''" (change)="onSelect($any($event.target).value)">
                <option value="" disabled>— Choisir un dossier —</option>
                @for (d of retirables(); track d.idDossier) {
                  <option [value]="d.idDossier">{{ d.refeDossier || ('Dossier #' + d.idDossier) }}</option>
                }
              </select>
              @if (!retirables().length && !loading()) {
                <span class="form-hint">
                  Aucun dossier éligible au retrait. Un dossier peut être retiré à toute étape du circuit
                  tant que son PV n'est pas signé.
                </span>
              }
              @if (fieldErr('idDossier')) { <span class="form-error">{{ fieldErr('idDossier') }}</span> }
            </div>

            <!-- ⚠️ Confirmation VISIBLE dès la sélection : on retire un dossier, l'erreur de cible
                 serait coûteuse. Un résumé suffit ici (aucun appel réseau : tout vient de la liste
                 des retirables déjà chargée) ; le détail complet reste à un clic, en modale. -->
            @if (selectedDossier(); as d) {
              <div class="rt-choisi">
                <div class="rt-choisi__tete">
                  <span class="rt-choisi__ref">{{ d.refeDossier || ('Dossier #' + d.idDossier) }}</span>
                  @if (d.statut) { <app-statut-badge [statut]="d.statut" /> }
                </div>
                <dl class="rt-choisi__faits">
                  <div><dt>Localité</dt><dd>{{ localiteLabel(d) }}</dd></div>
                  <div><dt>Type</dt><dd>{{ d.idSousType || d.idTypeDossier || '—' }}</dd></div>
                  <div><dt>Date de référence</dt><dd>{{ d.dateRef || '—' }}</dd></div>
                </dl>
                <button type="button" class="rt-choisi__lien" (click)="ouvrirDetail(d)">
                  Voir le détail complet du dossier ›
                </button>
              </div>
            }

            <div class="form-group">
              <label class="form-label required" for="ret-motif">Motif du retrait</label>
              <textarea
                id="ret-motif"
                class="form-control"
                rows="4"
                [value]="motif()"
                (input)="motif.set($any($event.target).value)"
              ></textarea>
              @if (fieldErr('motifRetrait')) { <span class="form-error">{{ fieldErr('motifRetrait') }}</span> }
            </div>

            <!-- ⚠️ Règle 2026-08-17 — la lettre datée et signée accompagne OBLIGATOIREMENT la
                 demande : sans elle le serveur refuse (400) et la demande n'est pas créée. -->
            <div class="form-group">
              <span class="form-label required">Lettre de demande de retrait (PDF daté et signé)</span>
              <!-- Le sélecteur natif du navigateur n'est pas stylable : on masque le champ et on
                   déclenche la sélection par un libellé — le clic sur un <label> ouvre l'input. -->
              @if (lettre(); as f) {
                <div class="rt-fichier rt-fichier--ok">
                  <span class="rt-fichier__icone" aria-hidden="true">📄</span>
                  <span class="rt-fichier__nom">{{ f.name }}</span>
                  <span class="rt-fichier__taille">{{ f.size / 1024 | number: '1.0-0' }} Ko</span>
                  <label class="btn btn-secondary btn-sm rt-fichier__remplacer">
                    Remplacer
                    <input type="file" accept="application/pdf,.pdf" hidden (change)="onLettre($event)" />
                  </label>
                  <button type="button" class="btn btn-danger btn-sm" aria-label="Retirer la lettre" (click)="retirerLettre()">✕</button>
                </div>
              } @else {
                <label class="rt-fichier rt-fichier--vide">
                  <span class="rt-fichier__cta">
                    <span aria-hidden="true">📎</span>
                    Choisir le fichier PDF
                  </span>
                  <span class="rt-fichier__aide">Obligatoire — PDF de 10 Mo au maximum, daté et signé par la PRMP.</span>
                  <input type="file" accept="application/pdf,.pdf" hidden (change)="onLettre($event)" />
                </label>
              }
            </div>

            <div class="rt-foot">
              <!-- ⚠️ 2026-08-17 (demande user) — le détail s'ouvre à la DEMANDE, en modale : le bloc
                   permanent occupait la page en affichant « sélectionnez un dossier », et le tableau
                   des marchés y était à l'étroit. Pas d'ouverture automatique à la sélection : on
                   choisit d'abord, on vérifie si on le souhaite. -->
              <button
                type="button"
                class="btn btn-primary"
                [disabled]="saving() || vacance() || !retirables().length || selectedId() == null || !motif().trim() || !lettre()"
                (click)="soumettre()"
              >
                {{ saving() ? 'Envoi…' : 'Soumettre la demande' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <h2 class="rt-sub">Mes demandes</h2>
      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr><th scope="col">Dossier</th><th scope="col">Motif</th><th scope="col">Lettre</th><th scope="col">Statut</th><th scope="col">Date</th><th scope="col">Motif du refus</th></tr>
            </thead>
            <tbody>
              @for (r of demandes(); track r.idDemandeRetrait) {
                <tr>
                  <!-- Référence cliquable : le dossier s'ouvre sur place, sans quitter le suivi. -->
                  <td><button type="button" class="rt-link" (click)="voirDossier(r.idDossier)">{{ dossierRef(r.idDossier) }}</button></td>
                  <td class="rt-motif">{{ r.motifRetrait }}</td>
                  <!-- Demandes antérieures à la règle du 2026-08-17 : aucune lettre (document → 404). -->
                  <td>
                    @if (r.nomFichier) {
                      <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirLettre(r)">Ouvrir</button>
                    } @else {
                      <span class="text-muted">—</span>
                    }
                  </td>
                  <td><app-statut-badge [statut]="r.statut" [label]="statutLabel(r.statut)" /></td>
                  <td>{{ r.dateDemande || '—' }}</td>
                  <td class="rt-motif">{{ r.statut === 'REFUSEE' ? (r.obsDecision || '—') : '—' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="empty-cell">Aucune demande.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <!-- Consultation du dossier en modale : depuis le formulaire (bouton) ou depuis une ligne
         du suivi (référence cliquable) — même composant, pleine largeur. -->
    @if (dossierConsulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="dossierConsulte.set(null)" />
    }
  `,
  styles: `
    .rt-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; align-items: start; }
    .rt-foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .rt-link { background: transparent; border: 0; padding: 0; cursor: pointer; color: var(--c-600); font: inherit; text-decoration: underline; }
    /* Le motif est du texte libre : sans cela, le « white-space: nowrap » global des cellules
       étire la ligne et pousse les dernières colonnes hors de l'écran. */
    .rt-motif { white-space: normal; max-width: 34rem; }

    /* Dépôt de la lettre : zone cliquable en entier (le libellé enveloppe le champ masqué). */
    .rt-fichier {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-radius: var(--radius-lg);
      transition: var(--transition);
    }
    .rt-fichier--vide {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.35rem;
      border: 1.5px dashed var(--p-300);
      background: var(--p-50);
      cursor: pointer;
    }
    .rt-fichier--vide:hover { border-color: var(--p-500); background: var(--p-100); }
    /* Le champ étant masqué, c'est le libellé qui reçoit le focus clavier : il doit le montrer. */
    .rt-fichier--vide:focus-within { outline: 2px solid var(--p-400); outline-offset: 2px; }
    .rt-fichier__cta {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-md);
      background: var(--grad-primary);
      color: #fff;
      font-weight: 700;
      box-shadow: var(--shadow-sm);
    }
    .rt-fichier__aide { color: var(--n-500); font-size: var(--text-sm); }
    /* Fichier choisi : bandeau vert, le nom du document au premier plan. */
    .rt-fichier--ok { border: 1px solid var(--success-bdr); background: var(--success-bg); flex-wrap: wrap; }
    .rt-fichier__icone { font-size: 1.15rem; }
    .rt-fichier__nom { font-weight: 700; color: var(--n-800); flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
    .rt-fichier__taille { color: var(--success-text); font-weight: 600; font-size: var(--text-sm); white-space: nowrap; }
    .rt-fichier__remplacer { cursor: pointer; }
    /* Confirmation du dossier choisi : compacte, informative, sans bloquer la saisie. */
    .rt-choisi { margin: 0 0 1rem; padding: 0.85rem 1rem; border: 1px solid var(--info-bdr); background: var(--info-bg); border-radius: var(--radius-lg); }
    .rt-choisi__tete { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    .rt-choisi__ref { font-weight: 700; color: var(--n-800); font-size: var(--text-md); }
    .rt-choisi__faits { display: flex; flex-wrap: wrap; gap: 0.35rem 1.75rem; margin: 0; }
    .rt-choisi__faits dt { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .07em; color: var(--n-400); }
    .rt-choisi__faits dd { margin: 0; font-weight: 600; color: var(--n-700); }
    .rt-choisi__lien { margin-top: 0.6rem; background: transparent; border: 0; padding: 0; cursor: pointer; color: var(--p-600); font: inherit; font-weight: 700; }
    .rt-choisi__lien:hover { text-decoration: underline; }
    .rt-sub { margin: 1.75rem 0 0.75rem; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .table-card td { white-space: normal; }
  `,
})
export class PrmpRetraits {
  private readonly service = inject(DemandeRetraitService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly toast = inject(ToastService);
  private readonly vacanceStore = inject(VacanceStore);
  /** Vacance du poste PRMP (spec « Mandats PRMP ») — demande de retrait suspendue. */
  readonly vacance = this.vacanceStore.vacance;
  private readonly dossiersRefresh = inject(DossiersRefreshStore);

  readonly retirables = signal<Dossier[]>([]);
  readonly demandes = signal<DemandeRetrait[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly selectedId = signal<number | null>(null);
  readonly motif = signal('');
  readonly formError = signal<ApiError | null>(null);
  private readonly dossierMap = signal<Map<string, string>>(new Map());
  /** Libellés de localité (cache partagé) — pour le résumé du dossier choisi. */
  private readonly localiteMap = signal<Map<string, string>>(new Map());

  /** Libellé de la localité d'un dossier (code brut tant que le référentiel n'est pas arrivé). */
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? (this.localiteMap().get(d.idLocalite) ?? d.idLocalite) : '—';
  }

  readonly selectedDossier = computed(() => {
    const id = this.selectedId();
    return id == null ? null : this.retirables().find((d) => d.idDossier === id) ?? null;
  });

  /** Dossier affiché dans la modale de consultation (null = fermée). */
  readonly dossierConsulte = signal<Dossier | null>(null);

  /**
   * Lettre de demande de retrait (PDF daté et signé) — **obligatoire** depuis la règle du
   * 2026-08-17 : sans elle, le serveur refuse la demande en 400 et ne la crée pas.
   */
  readonly lettre = signal<File | null>(null);

  /** Sélection de la lettre : type et taille contrôlés ici, magic-bytes revérifiés par le serveur. */
  onLettre(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f) {
      const erreur = validerFichier(f, TYPES_PDF, 10);
      if (erreur) {
        this.toast.error(erreur);
        input.value = '';
        this.lettre.set(null);
        return;
      }
    }
    this.lettre.set(f);
  }

  /** Retire la lettre choisie (le dépôt redevient vide). */
  retirerLettre(): void {
    this.lettre.set(null);
  }

  /** Ouvre la lettre signée d'une demande (PDF). 404 = demande antérieure à la règle. */
  ouvrirLettre(r: DemandeRetrait): void {
    if (r.idDemandeRetrait == null) {
      return;
    }
    this.service.document(r.idDemandeRetrait).subscribe({
      next: (blob) => window.open(urlBlobSure(blob), '_blank'),
      error: () => this.toast.error("La lettre n'est pas disponible pour cette demande."),
    });
  }

  /** Ouvre la consultation du dossier choisi dans le formulaire. */
  ouvrirDetail(d: Dossier | null): void {
    if (d) {
      this.dossierConsulte.set(d);
    }
  }

  /**
   * Ouvre le dossier d'une demande du suivi. Une demande peut porter sur un dossier déjà retiré
   * (donc absent de la liste des retirables) : on le charge alors à la demande.
   */
  voirDossier(idDossier: number): void {
    const connu = this.retirables().find((d) => d.idDossier === idDossier);
    if (connu) {
      this.dossierConsulte.set(connu);
      return;
    }
    this.dossierService.getById(idDossier).subscribe({
      next: (d) => this.dossierConsulte.set(d),
      error: () => {},
    });
  }

  constructor() {
    this.lookups.lookup(DossierService, 'idDossier', ['refeDossier']).subscribe((m) => this.dossierMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.charger();
  }

  fieldErr(champ: string): string | undefined {
    return getFieldError(this.formError(), champ);
  }
  statutLabel(s?: string): string {
    return statutDemandeRetraitLabel(s);
  }
  dossierRef(id: number): string {
    return this.dossierMap().get(String(id)) ?? '#' + id;
  }

  onSelect(value: string): void {
    this.selectedId.set(value ? Number(value) : null);
  }

  private charger(): void {
    this.loading.set(true);
    // `mes-demandes` marque l'écran consulté côté serveur (remet à zéro le compteur du menu).
    forkJoin({ retirables: this.dossierService.retirables(), demandes: this.service.getMesDemandes() }).subscribe({
      next: (r) => {
        this.retirables.set(r.retirables);
        this.demandes.set(r.demandes);
        this.loading.set(false);
        // Le compteur « demandes de retrait nouvelles » a été remis à zéro serveur → rafraîchir le menu.
        this.dossiersRefresh.notifierChangement();
      },
      error: () => this.loading.set(false),
    });
  }

  soumettre(): void {
    const idDossier = this.selectedId();
    const motif = this.motif().trim();
    const lettre = this.lettre();
    if (idDossier == null || !motif || !lettre) {
      return;
    }
    this.formError.set(null);
    this.saving.set(true);
    // ⚠️ Multipart depuis la règle du 2026-08-17 : la lettre signée accompagne la demande.
    // On n'envoie que idDossier + motif ; idPrmp/date/statut sont posés serveur.
    this.service.creerAvecLettre({ idDossier, motifRetrait: motif } as DemandeRetrait, lettre).subscribe({
      next: () => {
        this.toast.success('Demande de retrait soumise.');
        this.selectedId.set(null);
        this.motif.set('');
        this.lettre.set(null);
        this.saving.set(false);
        this.charger();
      },
      error: (err: ApiError) => {
        this.formError.set(err); // 400 → messages sous les champs (fieldErr)
        this.saving.set(false);
        if (err.status === 409) {
          // Deux causes possibles (PV déjà signé, ou demande déjà EN_ATTENTE) : afficher le message backend.
          this.toast.error(
            err.message ||
              "Ce dossier ne peut plus faire l'objet d'une demande de retrait (PV déjà signé, ou demande déjà en attente).",
          );
        } else if (err.status === 403) {
          this.toast.error("Vous n'êtes pas autorisé à demander le retrait de ce dossier.");
        } else if (err.status !== 400) {
          this.toast.error(err.message || 'Erreur lors de la demande de retrait.');
        }
      },
    });
  }
}
