import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { ToastService } from '../../core/notifications/toast.service';
import { DossierService } from '../../services';
import {
  Chronometrage,
  ETAPE_CIRCUIT_LABELS,
  ETAPE_CIRCUIT_PORTEURS,
  EtapeCircuit,
} from '../../models';

/**
 * Chronométrage d'un dossier (règle du pilote 2026-09-01, backend `c66db71`) : prise en charge de
 * l'étape courante avec saisie de la prévision, et restitution — date prévisionnelle de fin,
 * compteurs brut / net CNM, occurrences de tâches.
 *
 * Deux présentations :
 * - `compact` (écrans de travail des profils) : l'état de l'étape courante + le geste « Prendre en
 *   charge » — rien d'autre, l'écran reste au métier ;
 * - complet (consultation du dossier) : la même chose PLUS les compteurs et le tableau des tâches.
 *
 * Le bouton n'apparaît qu'au profil PORTEUR de l'étape (`ETAPE_CIRCUIT_PORTEURS`, délégations via
 * `PermissionsService.peutExecuter`) — mais la garde qui tranche reste le serveur (403/409, message
 * en dialogue). Aucun calcul de date côté front : tout vient de `GET /chronometrage`.
 */
@Component({
  selector: 'app-chronometrage-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (chrono(); as c) {
      <div class="chrono" [class.chrono--compact]="compact()">
        <!-- État courant + prise en charge -->
        <div class="chrono__etat">
          @if (c.attentePrmp) {
            <span class="chrono__attente" role="status">
              ⏸ En attente de la PRMP — aucune tâche CNM ne court ; la date prévisionnelle glisse
              tant que la PRMP n'a pas rendu la main.
            </span>
          } @else if (c.etapeCourante; as etape) {
            <span class="chrono__etape">Étape en cours : <strong>{{ etapeLabel(etape) }}</strong></span>
            @if (tacheEnCours(); as t) {
              <span class="chrono__pec">
                Prise en charge par {{ t.nomActeur || t.imActeur }} le
                {{ t.priseEnCharge | date: 'dd/MM/yyyy HH:mm' }} — prévision
                {{ heuresLabel(t.previsionHeures) }}{{ t.previsionStandard ? ' (délai standard)' : '' }},
                {{ t.dureeHeuresOuvrees }} h écoulées.
              </span>
              @if (estMaTache()) {
                <button type="button" class="btn btn-outline btn-sm" [disabled]="saisieOuverte() || saving()" (click)="ouvrirSaisie(t.previsionHeures)">
                  Corriger ma prévision
                </button>
              }
            } @else if (peutPrendreEnCharge()) {
              <!-- ⚠️ Demande pilote (2026-09-04) — bouton TRÈS repérable : c'est le geste qui ouvre
                   toute action du profil (couleur vive, dérogation assumée aux tokens). DÉSACTIVÉ
                   dès que l'action est déclenchée (saisie ouverte / enregistrement en cours) ; une
                   fois la prise en charge enregistrée, il cède la place à l'état « Prise en charge
                   par… ». -->
              <button type="button" class="chrono__cta" [disabled]="saisieOuverte() || saving()" (click)="ouvrirSaisie(null)">
                ⏱ Prendre en charge
              </button>
            } @else {
              <span class="chrono__pec">Pas encore prise en charge.</span>
            }
          } @else if (c.finCompteur) {
            <span class="chrono__pec">Traitement CNM achevé (validation SIGMP le {{ c.finCompteur | date: 'dd/MM/yyyy' }}).</span>
          }
          @if (c.datePrevisionnelleFin) {
            <span class="chrono__prevision">
              Fin de traitement prévue le <strong class="cnm-mono">{{ c.datePrevisionnelleFin | date: 'dd/MM/yyyy' }}</strong>
            </span>
          }
        </div>

        <!-- Saisie de la prévision (ouverte par le bouton) -->
        @if (saisieOuverte()) {
          <div class="chrono__saisie cnm-form">
            <label class="form-group">
              <span class="form-label">Ma prévision pour cette étape (heures ouvrées) *</span>
              <input
                type="number"
                class="form-control chrono__jours"
                min="1"
                step="1"
                [value]="previsionSaisie()"
                (input)="previsionSaisie.set($any($event.target).value)"
              />
              <span class="form-hint">
                Entier ≥ 1 — 8 h ouvrées = 1 jour ouvré. Elle alimente la date prévisionnelle
                annoncée à la PRMP ; corrigeable tant que la tâche est ouverte.
              </span>
            </label>
            @if (erreurSaisie()) { <span class="form-error">{{ erreurSaisie() }}</span> }
            <div class="chrono__saisie-actions">
              <button type="button" class="btn btn-outline btn-sm" (click)="saisieOuverte.set(false)">Annuler</button>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="saving()" (click)="confirmer()">
                {{ saving() ? 'Enregistrement…' : 'Confirmer' }}
              </button>
            </div>
          </div>
        }

        <!-- Restitution complète : compteurs + tâches -->
        @if (!compact()) {
          <dl class="chrono__compteurs">
            <div><dt>Enregistrement</dt><dd class="cnm-mono">{{ c.debutCompteur ? (c.debutCompteur | date: 'dd/MM/yyyy HH:mm') : '—' }}</dd></div>
            <div><dt>Validation SIGMP</dt><dd class="cnm-mono">{{ c.finCompteur ? (c.finCompteur | date: 'dd/MM/yyyy HH:mm') : '—' }}</dd></div>
            <div><dt>Durée brute</dt><dd>{{ heuresLabel(c.dureeBruteHeuresOuvrees) }}</dd></div>
            <div>
              <dt>Durée nette CNM</dt>
              <dd>{{ heuresLabel(c.dureeNetteHeuresOuvrees) }}
                @if (c.attentePrmpHeuresOuvrees > 0) {
                  <span class="chrono__hint">(attentes PRMP décomptées : {{ c.attentePrmpHeuresOuvrees }} h)</span>
                }
              </dd>
            </div>
          </dl>
          @if (c.taches.length) {
            <div class="chrono__table-wrap">
              <table class="chrono__table">
                <thead>
                  <tr>
                    <th scope="col">Étape</th>
                    <th scope="col">Passage</th>
                    <th scope="col">Acteur</th>
                    <th scope="col">Prise en charge</th>
                    <th scope="col">Fin</th>
                    <th scope="col">Prévu</th>
                    <th scope="col">Effectif</th>
                  </tr>
                </thead>
                <tbody>
                  @for (t of c.taches; track t.etape + '-' + t.occurrence) {
                    <tr [class.chrono__row--encours]="t.enCours">
                      <td>{{ etapeLabel(t.etape) }}</td>
                      <td class="cnm-mono">{{ t.occurrence }}</td>
                      <td>{{ t.nomActeur || t.imActeur || '—' }}</td>
                      <td class="cnm-mono">{{ t.priseEnCharge ? (t.priseEnCharge | date: 'dd/MM HH:mm') : '—' }}</td>
                      <td class="cnm-mono">{{ t.fin ? (t.fin | date: 'dd/MM HH:mm') : 'en cours' }}</td>
                      <td>{{ t.previsionHeures != null ? heuresLabel(t.previsionHeures) + (t.previsionStandard ? ' (std)' : '') : '—' }}</td>
                      <td>{{ t.dureeHeuresOuvrees }} h</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="chrono__vide">Aucune tâche chronométrée pour l'instant.</p>
          }
        }
      </div>
    } @else if (chargement()) {
      <p class="chrono__vide" role="status">Chargement du chronométrage…</p>
    }
  `,
  styles: `
    .chrono {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .chrono__etat {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
      font-size: var(--text-sm);
      color: var(--n-500);
    }
    /* « Prendre en charge » (demande pilote 2026-09-04) : couleur vive orange→rouge, facile à
       repérer — même dérogation assumée aux tokens que le fuchsia du dispatch en lot. */
    .chrono__cta {
      appearance: none;
      border: 0;
      cursor: pointer;
      font: inherit;
      font-size: var(--text-sm);
      font-weight: 800;
      color: #fff;
      padding: 0.5rem 1.15rem;
      border-radius: var(--radius-full);
      background: linear-gradient(135deg, #f97316, #dc2626);
      box-shadow: 0 3px 10px rgba(234, 88, 12, 0.45);
      transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out);
    }
    .chrono__cta:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 5px 14px rgba(234, 88, 12, 0.55);
    }
    /* Action déclenchée (saisie ouverte / enregistrement) : bouton inerte, sans relief. */
    .chrono__cta:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      box-shadow: none;
    }
    .chrono__attente {
      color: var(--warning-700, #92400e);
      background: var(--warning-50, #fffbeb);
      border: 1px solid var(--warning-200, #fde68a);
      border-radius: 6px;
      padding: 0.35rem 0.6rem;
    }
    .chrono__prevision {
      margin-left: auto;
      font-weight: 600;
    }
    /* La date — l'information que tout le bloc sert — en couleur vive (demande pilote 02/09). */
    .chrono__prevision strong {
      color: var(--p-600);
      font-size: var(--text-md);
    }
    .chrono--compact .chrono__prevision {
      margin-left: 0;
    }
    .chrono__saisie {
      border: 1px solid var(--n-200);
      border-radius: 8px;
      padding: 0.75rem;
      max-width: 26rem;
    }
    .chrono__jours {
      max-width: 8rem;
    }
    .chrono__saisie-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
    .chrono__compteurs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 2rem;
      margin: 0;
    }
    .chrono__compteurs div {
      display: flex;
      gap: 0.4rem;
      align-items: baseline;
    }
    .chrono__compteurs dt {
      font-size: var(--text-xs);
      color: var(--n-400);
    }
    .chrono__compteurs dd {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--n-500);
    }
    .chrono__hint {
      color: var(--n-400);
      font-size: var(--text-xs);
    }
    .chrono__table-wrap {
      overflow-x: auto;
    }
    .chrono__table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);
    }
    .chrono__table th,
    .chrono__table td {
      text-align: left;
      padding: 0.35rem 0.6rem;
      border-bottom: 1px solid var(--n-200);
      white-space: nowrap;
    }
    /* Neutralise la bande bleue globale (design system : \`thead tr { background: --grad-primary }\`
       + \`th\` en blanc) : ici l'en-tête est discret — sans cela le libellé gris devenait
       illisible sur le dégradé bleu. */
    .chrono__table thead tr {
      background: transparent;
    }
    .chrono__table th {
      font-size: var(--text-xs);
      color: var(--n-400);
      font-weight: 600;
      background: transparent;
      text-transform: none;
      letter-spacing: normal;
    }
    .chrono__row--encours td {
      background: var(--primary-50, #eff6ff);
    }
    .chrono__vide {
      font-size: var(--text-sm);
      color: var(--n-400);
      margin: 0;
    }
  `,
})
export class ChronometrageDossier {
  private readonly dossierService = inject(DossierService);
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionsService);
  private readonly toast = inject(ToastService);

  /** Dossier chronométré. */
  readonly idDossier = input.required<number>();
  /** Présentation réduite (écrans de travail) : état + geste, sans compteurs ni tableau. */
  readonly compact = input(false);
  /**
   * Chronométrage déjà chargé par l'hôte (modale « une seule vague » : le parent l'ajoute à son
   * `forkJoin` et le passe ici). Absent → le composant fait son propre GET.
   */
  readonly donnees = input<Chronometrage | undefined>(undefined);
  /**
   * Attributaire COURANT du dossier (`imCtrlMembre` du dispatch, réattributions comprises).
   * ⚠️ « Seul l'assignataire examine » (backend `d24c115`/`5225529`) : la prise en charge d'EXAMEN
   * lui est réservée — 403 pour tout autre, MÊME par délégation. Quand l'hôte le fournit, le geste
   * n'est montré qu'à lui ; `undefined` = hôte sans cette donnée (règle du porteur nominal seule).
   */
  readonly attributaire = input<string | null | undefined>(undefined);
  /**
   * ⚠️ Demande pilote (2026-09-04) — « aucune action sans prise en charge » : émet `true` quand
   * l'utilisateur peut agir sur le dossier — soit il n'est PAS le porteur de l'étape courante
   * (l'écran ne le concerne pas : édition, consultation), soit SA prise en charge est enregistrée.
   * `false` tant que le chronométrage n'est pas chargé et tant que le porteur n'a pas cliqué
   * « Prendre en charge ». Les écrans d'action verrouillent leurs panneaux sur ce signal.
   */
  readonly actionAutorisee = output<boolean>();

  readonly chrono = signal<Chronometrage | null>(null);
  readonly chargement = signal(false);
  readonly saisieOuverte = signal(false);
  readonly previsionSaisie = signal('');
  readonly erreurSaisie = signal<string | null>(null);
  readonly saving = signal(false);

  /**
   * Tâche en cours DE L'ÉTAPE COURANTE seulement. ⚠️ Constat de recette (03/09) : la transmission
   * directe à SIGMP d'un avis FAV ne clôt pas l'occurrence VERIFICATION — une tâche d'une AUTRE
   * étape restée ouverte ne doit ni s'afficher comme l'état courant, ni bloquer la prise en charge
   * (trou signalé au backend ; elle reste visible dans le tableau des passages).
   */
  readonly tacheEnCours = computed(() => {
    const etape = this.chrono()?.etapeCourante;
    return this.chrono()?.taches.find((t) => t.enCours && t.etape === etape) ?? null;
  });
  readonly estMaTache = computed(() => {
    const t = this.tacheEnCours();
    return !!t && !!t.imActeur && t.imActeur === this.auth.ref();
  });
  /**
   * Montrer le geste au porteur NOMINAL de l'étape (délégations comprises) — jamais grisé : en cas
   * de doute le serveur tranche (403 écrit en dialogue). La PRMP, elle, ne porte aucune étape.
   */
  readonly peutPrendreEnCharge = computed(() => {
    const etape = this.chrono()?.etapeCourante;
    if (!etape || this.chrono()?.attentePrmp) {
      return false;
    }
    // EXAMEN est réservé à l'attributaire (403 serveur même par délégation) : quand il est connu
    // — fourni par l'hôte, sinon servi par le DTO — ne pas offrir un geste voué au refus.
    if (etape === 'EXAMEN') {
      const attributaire = this.attributaire() ?? this.chrono()?.attributaire;
      if (attributaire != null) {
        return attributaire === this.auth.ref();
      }
    }
    const porteur = ETAPE_CIRCUIT_PORTEURS[etape];
    const role = this.auth.role();
    return role === porteur || role === 'ADMINISTRATEUR' || this.permissions.peutExecuter(porteur);
  });

  constructor() {
    // Rechargement piloté par les inputs : l'écran hôte peut changer de dossier sans recréer le
    // composant ; des données fournies par l'hôte (modale) court-circuitent le GET.
    effect(() => {
      const fournies = this.donnees();
      const id = this.idDossier();
      if (fournies) {
        this.chrono.set(fournies);
        return;
      }
      this.chargerChronometrage(id);
    });
    // « Aucune action sans prise en charge » (2026-09-04) — recalculé à chaque (re)chargement.
    effect(() => {
      const c = this.chrono();
      this.actionAutorisee.emit(!!c && (!this.peutPrendreEnCharge() || this.estMaTache()));
    });
  }

  etapeLabel(etape: EtapeCircuit | string): string {
    return ETAPE_CIRCUIT_LABELS[etape as EtapeCircuit] ?? etape;
  }

  /**
   * « 40 h (5 j) » — l'équivalent jours (8 h ouvrées = 1 jour ouvré, backend `c8d987a`) n'est
   * ajouté qu'à partir d'une journée, avec au plus une décimale (12 h → « 12 h (1,5 j) »).
   */
  heuresLabel(heures: number | null | undefined): string {
    if (heures == null) {
      return '—';
    }
    if (heures < 8) {
      return `${heures} h`;
    }
    const jours = Math.round((heures / 8) * 10) / 10;
    return `${heures} h (${String(jours).replace('.', ',')} j)`;
  }

  ouvrirSaisie(previsionActuelle: number | null | undefined): void {
    this.erreurSaisie.set(null);
    this.previsionSaisie.set(previsionActuelle != null ? String(previsionActuelle) : '');
    this.saisieOuverte.set(true);
  }

  confirmer(): void {
    const heures = Number(this.previsionSaisie());
    if (!Number.isInteger(heures) || heures < 1) {
      this.erreurSaisie.set("La prévision est un nombre entier d'heures ouvrées, au moins 1 (8 h = 1 jour ouvré).");
      return;
    }
    this.erreurSaisie.set(null);
    this.saving.set(true);
    this.dossierService.priseEnCharge(this.idDossier(), heures).subscribe({
      next: () => {
        this.saving.set(false);
        this.saisieOuverte.set(false);
        this.toast.success(`Prise en charge enregistrée — prévision ${this.heuresLabel(heures)}.`);
        this.chargerChronometrage(this.idDossier());
      },
      error: () => this.saving.set(false), // 400/403/409 → dialogue centralisé (message backend)
    });
  }

  private chargerChronometrage(id: number): void {
    this.chargement.set(true);
    this.dossierService.chronometrage(id).subscribe({
      next: (c) => {
        this.chrono.set(c);
        this.chargement.set(false);
      },
      error: () => this.chargement.set(false),
    });
  }
}
