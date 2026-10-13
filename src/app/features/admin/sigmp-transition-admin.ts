import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiError, erreursParChamp } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { SigmpTransitionStore } from '../../core/sigmp/sigmp-transition.store';
import { ParametreSigmpTransition } from '../../models';
import { ParametreSigmpTransitionService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

type Cle = 'finTransition' | 'decisionReference' | 'decisionDate';

/**
 * Écran Administrateur — « Transition SIGMP » (manuel révisé, R3a, 13/10 ; arbitrage Q3 du pilote du 10/10). Les avis spécifiques,
 * les lettres d'invitation et l'AGPM produits par l'application remplacent les imprimés du SIGMP/EGP, à trois conditions :
 * mentions complètes (vérifiées gabarit par gabarit), **décision formelle d'équivalence** (sa référence et sa date, portées au pied
 * de chaque document), et **double mode transitoire** (jusqu'à la date de fin, la pièce « imprimé SIGMP » reste acceptée mais
 * facultative ; après, elle disparaît des listes des procédures en ligne). Contrat `GET`/`PUT /api/parametres/sigmp-transition`.
 */
@Component({
  selector: 'app-sigmp-transition-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <section class="sta">
      <header class="page-header">
        <h1 class="page-title">Transition SIGMP — documents générés par l’application</h1>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>

      <p class="alert alert-info">
        <span>
          L’avis spécifique, la lettre d’invitation et l’avis général produits par l’application tiennent lieu d’<strong>imprimés du
          SIGMP/EGP</strong>. Jusqu’à la <strong>date de fin de transition</strong>, la pièce « imprimé du SIGMP » reste acceptée mais
          facultative pour les procédures conduites en ligne ; à partir de cette date, elle n’est plus demandée. La <strong>décision
          d’équivalence</strong> (référence et date) est imprimée au pied de chaque document généré.
        </span>
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les paramètres de la transition SIGMP." (reessayer)="charger()" />
      } @else {
        <div class="card sta__card">
          @if (actuel(); as a) {
            <p class="sta__etat" role="status">
              @if (a.transitionEnCours) {
                <span class="badge badge-warning">Transition en cours</span>
                <span>{{ a.finTransition ? 'jusqu’au ' + dateFr(a.finTransition) + ' (veille comprise)' : 'sans date de fin : l’imprimé SIGMP reste facultatif' }}</span>
              } @else {
                <span class="badge badge-success">Transition terminée</span>
                <span>depuis le {{ dateFr(a.finTransition) }} : l’imprimé du SIGMP n’est plus demandé en ligne</span>
              }
            </p>
          }
          <label class="form-group">
            <span class="form-label">Date de fin de la transition</span>
            <input class="form-control sta__date" type="date" [value]="saisie().finTransition" (input)="poser('finTransition', $any($event.target).value)" />
            <span class="form-hint">Vide : la transition dure sans terme. La transition est en cours jusqu’à la veille de cette date.</span>
            @if (erreurs().finTransition; as m) { <span class="form-error">{{ m }}</span> }
          </label>
          <fieldset class="form-group sta__decision">
            <legend class="form-label">Décision formelle d’équivalence</legend>
            <div class="cnm-form-grid">
              <label class="form-group">
                <span class="form-label">Référence</span>
                <input class="form-control" type="text" maxlength="200" [value]="saisie().decisionReference" (input)="poser('decisionReference', $any($event.target).value)" />
                @if (erreurs().decisionReference; as m) { <span class="form-error">{{ m }}</span> }
              </label>
              <label class="form-group">
                <span class="form-label">Date</span>
                <input class="form-control sta__date" type="date" [value]="saisie().decisionDate" (input)="poser('decisionDate', $any($event.target).value)" />
                @if (erreurs().decisionDate; as m) { <span class="form-error">{{ m }}</span> }
              </label>
            </div>
            <span class="form-hint">La référence et la date vont ensemble ; les deux vides effacent la décision.</span>
          </fieldset>
          <p class="sta__apercu"><span class="form-label">Pied imprimé sur les documents</span> {{ apercu() }}</p>
          <div class="sta__actions">
            <button type="button" class="btn btn-primary" [disabled]="saving() || !modifie()" (click)="enregistrer()">
              {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .sta { display: flex; flex-direction: column; gap: 1rem; }
    .sta__card { display: flex; flex-direction: column; gap: 0.9rem; padding: 1.25rem; max-width: 44rem; }
    .sta__etat { margin: 0; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; color: var(--n-700); }
    .sta__date { max-width: 14rem; }
    .sta__decision { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .sta__apercu { margin: 0; display: flex; flex-direction: column; gap: 0.2rem; color: var(--n-700); }
    .sta__actions { display: flex; justify-content: flex-end; }
  `,
})
export class SigmpTransitionAdmin implements OnInit {
  private readonly service = inject(ParametreSigmpTransitionService);
  private readonly store = inject(SigmpTransitionStore);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly erreur = signal(false);
  readonly saving = signal(false);
  readonly actuel = signal<ParametreSigmpTransition | null>(null);
  readonly saisie = signal<Record<Cle, string>>({ finTransition: '', decisionReference: '', decisionDate: '' });
  readonly erreurs = signal<Partial<Record<Cle, string>>>({});

  readonly modifie = computed(() => {
    const a = this.actuel();
    const s = this.saisie();
    return !a || (a.finTransition ?? '') !== s.finTransition || (a.decisionReference ?? '') !== s.decisionReference.trim() || (a.decisionDate ?? '') !== s.decisionDate;
  });
  /** Le pied tel que le serveur l'imprimera après enregistrement (même règle que `pied`). */
  readonly apercu = computed(() => {
    const s = this.saisie();
    return s.decisionReference.trim() && s.decisionDate
      ? `Document produit par la plateforme PRS 2.0 en application de la décision n° ${s.decisionReference.trim()} du ${this.dateFr(s.decisionDate)}`
      : 'Projet — équivalence SIGMP en attente';
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.service.lire().subscribe({
      next: (p) => {
        this.poser_(p);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  poser(cle: Cle, valeur: string): void {
    this.saisie.update((s) => ({ ...s, [cle]: valeur }));
    if (this.erreurs()[cle]) this.erreurs.update((e) => ({ ...e, [cle]: undefined }));
  }

  enregistrer(): void {
    if (this.saving() || !this.modifie()) return;
    this.saving.set(true);
    const s = this.saisie();
    this.service.definir({ finTransition: s.finTransition || null, decisionReference: s.decisionReference.trim() || null, decisionDate: s.decisionDate || null }).subscribe({
      next: (p) => {
        this.saving.set(false);
        this.poser_(p);
        this.store.poser(p);
        this.toast.success(p.transitionEnCours ? 'Transition SIGMP enregistrée.' : 'Transition SIGMP terminée : l’imprimé du SIGMP n’est plus demandé en ligne.');
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.saving.set(false);
        const parChamp = erreursParChamp(e);
        if (parChamp.size) this.erreurs.set(Object.fromEntries(parChamp) as Partial<Record<Cle, string>>);
        else this.toast.error('Les paramètres n’ont pas été enregistrés. Réessayez.');
      },
    });
  }

  dateFr(iso: string | null | undefined): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
  }

  private poser_(p: ParametreSigmpTransition): void {
    this.actuel.set(p);
    this.saisie.set({ finTransition: p.finTransition ?? '', decisionReference: p.decisionReference ?? '', decisionDate: p.decisionDate ?? '' });
    this.erreurs.set({});
  }
}
