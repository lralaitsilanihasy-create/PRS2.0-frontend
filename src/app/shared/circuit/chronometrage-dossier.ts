import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { AuthService } from '../../core/auth/auth.service';
import { DossierService } from '../../services';
import {
  Chronometrage,
  ETAPE_CIRCUIT_LABELS,
  ETAPE_CIRCUIT_PORTEURS,
  EtapeCircuit,
} from '../../models';
import { tacheChronoVisiblePour } from './circuit-workflow';

/**
 * Chronométrage d'un dossier — RESTITUTION PURE (backend `9648729`, 2026-09-12) : plus de « prise en
 * charge ». Le délai de chaque étape se mesure **automatiquement** (entrée → fin, dérivé des
 * transitions horodatées) ; le widget n'affiche que l'état courant, la date prévisionnelle de fin, les
 * compteurs (brut / net CNM) et le tableau des passages. Aucun geste, aucun calcul de date côté front :
 * tout vient de `GET /chronometrage`.
 *
 * Deux présentations :
 * - `compact` (écrans de travail) : état de l'étape courante + fin prévue seulement ;
 * - complet (consultation) : la même chose PLUS les compteurs et le tableau des passages.
 */
@Component({
  selector: 'app-chronometrage-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (chrono(); as c) {
      <div class="chrono" [class.chrono--compact]="compact()">
        <!-- État de l'étape courante + date prévisionnelle de fin -->
        <div class="chrono__etat">
          @if (c.attentePrmp && !estEtapePorteePrmp()) {
            <span class="chrono__attente" role="status">
              ⏸ En attente de la PRMP — aucune tâche CNM ne court ; la date prévisionnelle glisse
              tant que la PRMP n'a pas rendu la main.
            </span>
          } @else if (c.etapeCourante; as etape) {
            <span class="chrono__etape">Étape en cours : <strong>{{ etapeLabel(etape) }}</strong></span>
          } @else if (c.finCompteur) {
            <span class="chrono__pec">Traitement CNM achevé (validation SIGMP le <span class="cnm-fin-cloture">{{ c.finCompteur | date: 'dd/MM/yyyy HH:mm' }}</span>).</span>
          }
          @if (c.datePrevisionnelleFin) {
            <span class="chrono__prevision">
              Fin de traitement prévue le <strong class="cnm-mono">{{ c.datePrevisionnelleFin | date: 'dd/MM/yyyy' }}</strong>
            </span>
          }
        </div>

        <!-- Restitution complète : compteurs + passages -->
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
          @if (etapesVisibles().length) {
            <div class="chrono__table-wrap">
              <table class="chrono__table">
                <thead>
                  <tr>
                    <th scope="col">Étape</th>
                    <th scope="col">Passage</th>
                    <th scope="col">Acteur</th>
                    <th scope="col">Entrée</th>
                    <th scope="col">Fin</th>
                    <th scope="col">Durée</th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of etapesVisibles(); track e.etape + '-' + e.occurrence) {
                    <tr [class.chrono__row--encours]="e.enCours">
                      <td>{{ etapeLabel(e.etape) }}</td>
                      <td class="cnm-mono">{{ e.occurrence }}</td>
                      <td>{{ e.nomActeur || e.imActeur || '—' }}</td>
                      <td class="cnm-mono">{{ e.entree ? (e.entree | date: 'dd/MM HH:mm') : '—' }}</td>
                      <td class="cnm-mono">{{ e.fin ? (e.fin | date: 'dd/MM HH:mm') : 'en cours' }}</td>
                      <td>{{ e.dureeHeuresOuvrees }} h</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="chrono__vide">Aucun passage chronométré pour l'instant.</p>
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

  /** Dossier chronométré. */
  readonly idDossier = input.required<number>();
  /** Présentation réduite (écrans de travail) : état + fin prévue, sans compteurs ni tableau. */
  readonly compact = input(false);
  /**
   * Chronométrage déjà chargé par l'hôte (modale « une seule vague » : le parent l'ajoute à son
   * `forkJoin` et le passe ici). Absent → le composant fait son propre GET.
   */
  readonly donnees = input<Chronometrage | undefined>(undefined);

  readonly chrono = signal<Chronometrage | null>(null);
  readonly chargement = signal(false);

  /**
   * ⚠️ Demande pilote (2026-09-04) — VISIBILITÉ HIÉRARCHIQUE du tableau des passages : chaque profil
   * voit ses lignes et celles de ses subordonnés, jamais celles de ses supérieurs (PRMP et Admin :
   * tout). Les compteurs globaux et l'état de l'étape courante restent.
   */
  readonly etapesVisibles = computed(() =>
    (this.chrono()?.etapes ?? []).filter((e) => tacheChronoVisiblePour(this.auth.role(), e.etape)),
  );

  /**
   * L'étape courante est-elle PORTÉE par la PRMP (`RECTIFICATION_PRMP`) ? Dans ce cas, la balle est
   * chez la PRMP mais l'étape *est* sa rectification : le template affiche « Étape en cours :
   * Rectification PRMP », pas « ⏸ En attente de la PRMP ».
   */
  readonly estEtapePorteePrmp = computed(() => {
    const etape = this.chrono()?.etapeCourante;
    return !!etape && ETAPE_CIRCUIT_PORTEURS[etape] === 'PRMP';
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
