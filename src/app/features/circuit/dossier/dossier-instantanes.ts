import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';

import { ToastService } from '../../../core/notifications/toast.service';
import { telechargerBlob } from '../../../core/securite/fichiers-surs';
import { Instantane } from '../../../models';
import { InstantaneService } from '../../../services';
import { horodatage } from '../../../shared/prmp/avis-specifique-modele';
import { DonneesFigees } from '../../../shared/ui/donnees-figees';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { DossierContenuStore } from './dossier-contenu.store';
import { InstantaneAttributionVue, InstantaneEvaluationVue, InstantaneSeanceVue } from './instantanes-vues';

/** L'ordre de lecture des écrans d'une soumission : la procédure, puis ses séances, puis ses suites. */
const ORDRE_ECRANS: readonly string[] = ['PLAN', 'AVIS', 'AMI', 'CAO', 'SEANCE', 'EVALUATION', 'ATTRIBUTION', 'ACTE', 'DSS'];

const LIBELLES_ECRAN: Readonly<Record<string, string>> = {
  PLAN: 'Ligne du plan',
  AVIS: 'Avis et lettres',
  AMI: 'AMI et présélection',
  CAO: 'Commission (CAO)',
  SEANCE: "Séance d'ouverture",
  EVALUATION: 'Évaluation',
  ATTRIBUTION: 'Attribution',
  ACTE: 'Acte de gestion',
  DSS: 'Sans suite',
};

export function libelleEcranInstantane(ecran: string): string {
  return LIBELLES_ECRAN[ecran] ?? ecran;
}

/** Les écrans qui ont une vue dédiée ; les autres passent par le rendu générique. */
const VUES_DEDIEES: readonly string[] = ['SEANCE', 'EVALUATION', 'ATTRIBUTION'];

/**
 * ⚠️ Manuel révisé, R4 (V104, 13/10) — l'onglet « Écrans figés » d'un dossier de procédure : la liste des instantanés (par soumission,
 * puis par écran), l'écran choisi rendu en **lecture seule** depuis son JSON figé, le bandeau « Figé à la soumission n° … du … » et
 * l'export PDF. Les profils CNM lisent ici ce que les pièces retirées (R2) portaient ; la liste est chargée par le store de l'hôte
 * dans sa vague, l'écran choisi à la demande. Un écran figé ne propose aucun geste : rien n'y modifie la procédure vivante.
 */
@Component({
  selector: 'app-dossier-instantanes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, DonneesFigees, InstantaneSeanceVue, InstantaneEvaluationVue, InstantaneAttributionVue],
  template: `
    <div class="dc-section-head">
      <div class="section-block-title">
        <div class="section-icon">🔒</div>
        <span class="section-label">Écrans figés à la soumission</span>
        <span class="section-count">{{ contenu.instantanes().length }} écran(s) · {{ soumissions().length }} soumission(s)</span>
      </div>
    </div>
    <p class="di__intro">
      À chaque soumission du dossier, le serveur fige les écrans de la procédure tels qu'ils étaient à cet instant (immuables, empreinte
      SHA-256). La Commission les lit ici, en lecture seule, à la place des pièces qui ne sont plus jointes au dossier.
    </p>

    @if (soumissions().length > 1) {
      <div class="di__select">
        <label for="di-soumission">Soumission à afficher</label>
        <select id="di-soumission" class="form-control" (change)="choisirSoumission($any($event.target).value)">
          @for (n of soumissions(); track n) {
            <option [value]="n" [selected]="soumissionEffective() === n">Soumission n° {{ n }} — {{ horodatage(dateDe(n)) }}</option>
          }
        </select>
      </div>
    }

    <div class="di__ecrans" role="tablist" aria-label="Écrans figés de la soumission">
      @for (i of ecransDeLaSoumission(); track i.idInstantane) {
        <button type="button" role="tab" class="di__onglet" [class.di__onglet--on]="courant()?.idInstantane === i.idInstantane"
          [attr.aria-selected]="courant()?.idInstantane === i.idInstantane" (click)="choisirEcran(i.ecran)">{{ libelle(i.ecran) }}</button>
      }
    </div>

    @if (courant(); as i) {
      <div class="di__bandeau">
        <span class="badge di__badge">Figé</span>
        <span class="di__quand">
          Figé à la soumission n° {{ i.numeroSoumission }} du {{ horodatage(i.figeLe) }}@if (i.figePar) { par {{ i.figePar }}}
          · empreinte <span class="cnm-mono di__empreinte" [title]="i.empreinte">{{ i.empreinte.slice(0, 12) }}…</span>
        </span>
        <button type="button" class="btn btn-sm btn-outline" [disabled]="pdfEnCours()" (click)="exporterPdf(i)">{{ pdfEnCours() ? 'Export…' : 'Exporter en PDF' }}</button>
      </div>
      @if (chargement()) {
        <p class="text-muted" role="status">Chargement de l'écran figé…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="L'écran figé n'a pas pu être lu." (reessayer)="relance.set(relance() + 1)" />
      } @else if (donnees() !== undefined) {
        <div class="di__vue">
          @switch (i.ecran) {
            @case ('SEANCE') { <app-instantane-seance [seance]="$any(donnees())" /> }
            @case ('EVALUATION') { <app-instantane-evaluation [evaluation]="$any(donnees())" /> }
            @case ('ATTRIBUTION') { <app-instantane-attribution [attribution]="$any(donnees())" /> }
            @default { <app-donnees-figees [valeur]="donnees()" /> }
          }
        </div>
        @if (vueDediee(i.ecran)) {
          <details class="di__complet">
            <summary>Données complètes de l'instantané</summary>
            <app-donnees-figees [valeur]="donnees()" />
          </details>
        }
      }
    } @else {
      <p class="text-muted">Aucun écran figé pour cette soumission.</p>
    }
  `,
  styles: `
    :host { display: block; }
    .di__intro { margin: 0 0 0.8rem; font-size: var(--text-sm); color: var(--n-500); }
    .di__select { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem; font-size: var(--text-sm); }
    .di__select .form-control { width: auto; }
    .di__ecrans { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.7rem; }
    .di__onglet { border: 1px solid var(--n-300); background: #fff; color: var(--n-700, #334155); border-radius: 999px; padding: 0.25rem 0.75rem; font-size: var(--text-sm); cursor: pointer; }
    .di__onglet:hover { background: var(--n-50, #f8fafc); }
    .di__onglet--on { background: var(--n-800, #1e293b); border-color: var(--n-800, #1e293b); color: #fff; }
    .di__bandeau { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; padding: 0.5rem 0.75rem; margin-bottom: 0.7rem; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; font-size: var(--text-sm); }
    .di__badge { background: #b45309; color: #fff; }
    .di__quand { flex: 1; }
    .di__empreinte { font-size: var(--text-xs); }
    .di__vue { padding: 0.25rem 0; }
    .di__complet { margin-top: 0.9rem; font-size: var(--text-sm); }
    .di__complet summary { cursor: pointer; color: var(--n-500); }
  `,
})
export class DossierInstantanes {
  protected readonly contenu = inject(DossierContenuStore);
  private readonly service = inject(InstantaneService);
  private readonly toast = inject(ToastService);

  readonly horodatage = horodatage;
  readonly libelle = libelleEcranInstantane;

  /** Les numéros de soumission, la plus récente en tête. */
  readonly soumissions = computed(() => [...new Set(this.contenu.instantanes().map((i) => i.numeroSoumission))].sort((a, b) => b - a));
  private readonly soumission = signal<number | null>(null);
  readonly soumissionEffective = computed(() => {
    const choix = this.soumission();
    return choix != null && this.soumissions().includes(choix) ? choix : (this.soumissions()[0] ?? null);
  });
  readonly ecransDeLaSoumission = computed(() =>
    this.contenu
      .instantanes()
      .filter((i) => i.numeroSoumission === this.soumissionEffective())
      .sort((a, b) => ORDRE_ECRANS.indexOf(a.ecran) - ORDRE_ECRANS.indexOf(b.ecran)),
  );
  private readonly ecran = signal<string | null>(null);
  /** L'instantané affiché : l'écran choisi s'il existe pour cette soumission, sinon le premier. */
  readonly courant = computed<Instantane | null>(() => this.ecransDeLaSoumission().find((i) => i.ecran === this.ecran()) ?? this.ecransDeLaSoumission()[0] ?? null);

  readonly donnees = signal<unknown>(undefined);
  readonly chargement = signal(false);
  readonly erreur = signal(false);
  readonly relance = signal(0);
  readonly pdfEnCours = signal(false);

  constructor() {
    effect((nettoyer) => {
      const c = this.courant();
      const id = this.contenu.dossier().idDossier;
      this.relance();
      const abonnement = untracked(() => this.lire(id, c));
      nettoyer(() => abonnement?.unsubscribe());
    });
  }

  choisirSoumission(valeur: string): void {
    this.soumission.set(Number(valeur));
  }

  choisirEcran(ecran: string): void {
    this.ecran.set(ecran);
  }

  vueDediee(ecran: string): boolean {
    return VUES_DEDIEES.includes(ecran);
  }

  dateDe(soumission: number): string | null {
    return this.contenu.instantanes().find((i) => i.numeroSoumission === soumission)?.figeLe ?? null;
  }

  private lire(idDossier: number, c: Instantane | null): Subscription | null {
    this.donnees.set(undefined);
    this.erreur.set(false);
    if (!c) {
      this.chargement.set(false);
      return null;
    }
    this.chargement.set(true);
    return this.service.lire(idDossier, c.ecran, c.numeroSoumission).subscribe({
      next: (d) => {
        this.donnees.set(d);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  exporterPdf(i: Instantane): void {
    const id = this.contenu.dossier().idDossier;
    this.pdfEnCours.set(true);
    this.service.pdf(id, i.ecran, i.numeroSoumission).subscribe({
      next: (blob) => {
        this.pdfEnCours.set(false);
        telechargerBlob(blob, `INSTANTANE_${i.ecran}_${id}_s${i.numeroSoumission}.pdf`);
      },
      error: () => {
        this.pdfEnCours.set(false);
        this.toast.error("L'export PDF de l'écran figé a échoué.");
      },
    });
  }
}
