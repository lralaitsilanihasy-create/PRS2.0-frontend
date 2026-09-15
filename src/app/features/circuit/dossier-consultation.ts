import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';

import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { Dossier } from '../../models';
import { ChronometrageDossier, StatutBadge } from '../../shared/circuit';
import { DossierContenuStore } from './dossier/dossier-contenu.store';
import { DossierDocuments } from './dossier/dossier-documents';
import { DossierIdentite } from './dossier/dossier-identite';
import { DossierJournal } from './dossier/dossier-journal';

/**
 * Consultation d'un dossier en LECTURE SEULE (modale réutilisable).
 * - PPM : en-tête du PPM + lignes de marché (mode en libellé).
 * - DAO/MAOO : infos du dossier.
 * Mise en forme alignée sur le modal « Détail PPM » (DetailPpmModal).
 *
 * Coquille depuis le lot L4-F1 : voile, en-tête, sous-dialogues et pied. Le contenu vient du
 * `DossierContenuStore` qu'elle fournit, et s'affiche par les blocs partagés de `./dossier/`
 * (identité, documents, pièces, versions, journal) — les mêmes que la page dossier.
 */
@Component({
  selector: 'app-dossier-consultation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, ModaleDirective, ChronometrageDossier, DossierIdentite, DossierDocuments, DossierJournal],
  providers: [DossierContenuStore],
  template: `
    <div [class.modal-backdrop]="!embedded()" [class.modal-backdrop--sans-flou]="!embedded()" [class.closing]="closing()">
      <!-- ⚠️ En modale, le corps n'est monté qu'une fois les données là : sinon le panneau
           s'ouvrait à la taille de son seul en-tête puis grandissait par à-coups (552 → 724 →
           964 px mesurés) PENDANT son animation d'entrée — d'où une ouverture « brusque ».
           Le voile porte donc d'abord le seul indicateur d'attente. En mode embarqué (pas de
           voile), le rendu progressif reste préférable : le bloc est déjà dans la page. -->
      @if (contenu.loading() && !embedded()) {
        <div class="dc-attente" role="status"><div class="spinner"></div></div>
      } @else {
      <div
        class="dc"
        [class.dc--embedded]="embedded()"
        [class.dc--large]="contenu.estPpm()"
        [attr.role]="embedded() ? null : 'dialog'"
        [attr.aria-modal]="embedded() ? null : 'true'"
        [attr.aria-label]="embedded() ? null : 'Consultation — ' + contenu.typeLabel()"
        [appModale]="!embedded()"
        appModaleClicExterieur
        (appModaleFermer)="fermer()"
      >
        <!-- ── En-tête ── -->
        <div class="dc-header">
          <div class="dc-header-top">
            <div class="dc-chips">
              <span class="dc-chip dc-chip-type">{{ contenu.typeLabel() }}</span>
              <app-statut-badge [statut]="dossier().statut" />
            </div>
            @if (!embedded()) {
              <button type="button" class="dc-close" aria-label="Fermer" (click)="fermer()">✕</button>
            }
          </div>

          <div class="dc-title">{{ dossier().refeDossier || ('Dossier #' + dossier().idDossier) }}</div>

          <div class="dc-subtitle">
            <i aria-hidden="true">📍</i>
            <span>{{ contenu.localiteLabel() }}</span>
            <span class="dc-sep">·</span>
            <i aria-hidden="true">📅</i>
            <span>{{ dossier().dateRef || '—' }}</span>
            <!-- ⚠️ Demande pilote (2026-09-02, précisée) — l'en-tête d'identité est MASQUÉ à
                 CHAQUE ouverture ; le bouton le déplie à la demande (état local au modal). -->
            <button type="button" class="btn btn-ghost btn-sm dc-toggle-entete"
              [attr.aria-expanded]="!enteteReplie()" (click)="enteteReplie.set(!enteteReplie())">
              {{ enteteReplie() ? "▸ Afficher l'en-tête" : "▾ Masquer l'en-tête" }}
            </button>
          </div>

          <!-- ⚠️ Demande pilote (2026-09-02, précisée 2×) — l'identité et le chronométrage se
               partagent la MÊME rangée, sous la ligne de titre : le bloc « Chronométrage & délais »
               est AU MÊME NIVEAU que l'en-tête d'identité (qui reste repliable). -->
          <div class="dc-header-corps">
          @if (!enteteReplie()) {
            <app-dossier-identite class="dc-header-gauche" />
          }

          <!-- Chronométrage & délais (2026-09-01, dans l'en-tête depuis le 02/09) : chargé DANS
               la vague unique (donnees) ; zone absente pour un dossier hors circuit. Depuis la refonte
               2026-09-12 (backend 9648729), le widget est une pure RESTITUTION (plus de « prise en
               charge ») — rien à masquer. -->
          <!-- ⚠️ Demande pilote (2026-09-06, précisée 2×) — les DEUX boutons de restitution côte à
               côte dans la même bande ; chacun ouvre sa FENÊTRE MODALE (sous-dialogue).
               Précision du 06/09 au soir : PAS de restitution pour la PRMP ni son UGPM — le
               chronométrage et le journal sont des vues INTERNES CNM ; le client suit ses dates
               sur « Suivi des dossiers CNM ». -->
          @if (contenu.restitutionsVisibles() && (contenu.chronoDispo() || contenu.journalVisible().length)) {
            <div class="dc-header-droite dc-restitutions">
              @if (contenu.chronoDispo()) {
                <button type="button" class="dc-toggle-bloc dc-chrono-titre dc-btn-chrono" (click)="chronoOuvert.set(true)">
                  <span aria-hidden="true">⏱</span> Chronométrage &amp; délais…
                </button>
              }
              @if (contenu.journalVisible().length) {
                <button type="button" class="dc-toggle-bloc dc-chrono-titre dc-btn-journal" (click)="journalOuvert.set(true)">
                  <span aria-hidden="true">🕘</span> Journal des actions… ({{ contenu.journalVisible().length }})
                </button>
              }
            </div>
          }
          </div>
        </div>

        <!-- ── Corps ── (une seule vague : tout est affiché quand TOUT est chargé — pas de sauts) -->
        <div class="dc-body">
          @if (contenu.loading()) {
            <div class="spinner-wrap dc-load"><div class="spinner"></div></div>
          } @else {
            <app-dossier-documents [embedded]="embedded()" />
          }
        </div>

        <!-- ── Pied ── -->
        @if (!embedded()) {
          <footer class="dc-foot">
            <div class="dc-foot-info">
              @if (contenu.estPpm()) { <strong>{{ contenu.marches().length }}</strong> marché(s) · }
              <strong>{{ contenu.pieces().length }}</strong> pièce(s) jointe(s)
            </div>
            <button type="button" class="btn btn-ghost" (click)="fermer()">Fermer</button>
          </footer>
        }
      </div>
      }

      <!-- ⚠️ Demande pilote (2026-09-06, précisée) — restitutions en SOUS-DIALOGUES : le bouton
           ouvre une fenêtre modale par-dessus la consultation (Échap, clic voile, ✕). -->
      @if (chronoOuvert()) {
        <div class="modal-backdrop">
          <div class="modal modal-lg dc-sousmodal" role="dialog" aria-modal="true"
            [attr.aria-label]="'Chronométrage et délais — ' + (dossier().refeDossier || dossier().idDossier)"
            appModale appModaleClicExterieur (appModaleFermer)="chronoOuvert.set(false)">
            <div class="modal-header">
              <h2 class="modal-title"><span aria-hidden="true">⏱</span> Chronométrage &amp; délais</h2>
              <button type="button" class="btn-close" aria-label="Fermer" (click)="chronoOuvert.set(false)">✕</button>
            </div>
            <div class="modal-body dc-sousmodal__corps">
              @if (contenu.chronoDossier(); as chrono) {
                <app-chronometrage-dossier [idDossier]="dossier().idDossier" [donnees]="chrono" />
              }
            </div>
          </div>
        </div>
      }
      @if (journalOuvert()) {
        <div class="modal-backdrop">
          <div class="modal modal-lg dc-sousmodal" role="dialog" aria-modal="true"
            [attr.aria-label]="'Journal des actions — ' + (dossier().refeDossier || dossier().idDossier)"
            appModale appModaleClicExterieur (appModaleFermer)="journalOuvert.set(false)">
            <div class="modal-header">
              <h2 class="modal-title"><span aria-hidden="true">🕘</span> Journal des actions
                <span class="section-count">{{ contenu.journalVisible().length }} action(s)</span></h2>
              <button type="button" class="btn-close" aria-label="Fermer" (click)="journalOuvert.set(false)">✕</button>
            </div>
            <div class="modal-body dc-sousmodal__corps">
              <app-dossier-journal />
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './dossier-consultation.scss',
})
export class DossierConsultation implements OnInit {
  readonly dossier = input.required<Dossier>();
  /** En mode embarqué : rendu inline (sans overlay, bouton fermer, ni pied) pour insertion dans une colonne. */
  readonly embedded = input(false);
  readonly closed = output<void>();

  /** Animation de sortie en cours (pose `.closing` sur le voile) — voir `fermerAvecAnimation`. */
  readonly closing = signal(false);

  /**
   * Fermeture unique de tous les chemins (voile, ✕, bouton Fermer, Échap) : joue l'animation de
   * sortie avant de retirer le modal. En mode embarqué il n'y a pas de voile — sortie immédiate.
   */
  fermer(): void {
    if (this.embedded()) {
      return;
    }
    fermerAvecAnimation(this.closing, () => this.closed.emit());
  }

  /*
   * Échap et clic sur le voile sont portés par la directive `appModale`, liée à `!embedded()` :
   * le même conteneur est aussi rendu **embarqué** (sans voile, dans une colonne), où un piège
   * de focus serait nuisible — d'où l'entrée qui neutralise la directive dans ce mode. Elle
   * remplace l'écouteur `document:keydown.escape` et le `(click)` de l'overlay qui vivaient ici :
   * ce dernier annonçait un `<div>` non focalisable comme cliquable (ESLint a11y).
   */

  /** Contenu du dossier (vague unique, règles de visibilité par profil), partagé avec les blocs. */
  protected readonly contenu = inject(DossierContenuStore);
  /** En-tête d'identité replié — MASQUÉ par défaut à chaque ouverture (demande pilote 02/09). */
  readonly enteteReplie = signal(true);
  /**
   * ⚠️ Demande pilote (2026-09-06, précisée le jour même) — les restitutions « Chronométrage &
   * délais » et « Journal des actions » ne s'affichent qu'à la demande : un BOUTON dans la
   * consultation, le contenu en FENÊTRE MODALE par-dessus (sous-dialogue appModale).
   */
  readonly chronoOuvert = signal(false);
  readonly journalOuvert = signal(false);

  ngOnInit(): void {
    this.contenu.charger(this.dossier);
  }
}
