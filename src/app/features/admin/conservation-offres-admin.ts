import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ConservationOffres, ProcedureEchue } from '../../models';
import { ConservationOffresService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr } from '../candidat/libelles-candidat';

/**
 * ⚠️ V70 (arbitrage du pilote, 04/10) — la **conservation des offres**, sous les paramètres des candidats : les procédures dont la
 * durée est échue et qui gardent des offres sur disque, la plus ancienne d'abord, et la **purge** — un geste de l'Administrateur,
 * confirmé, journalisé, jamais automatique. Restent la ligne de chaque offre, son empreinte, sa lecture, l'accusé, le journal et le PV.
 */
@Component({
  selector: 'app-conservation-offres',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <section class="card co" aria-labelledby="co-titre">
      <h2 id="co-titre" class="co__h2">Offres à purger</h2>
      @if (chargement()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (absent()) {
        <p class="text-sm text-muted">La conservation des offres n'est pas encore servie par le serveur.</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les offres à purger." (reessayer)="charger()" />
      } @else if (donnees(); as d) {
        @if (d.annees == null) {
          <p class="text-sm">Aucune durée n'est fixée : les offres sont conservées sans limite, rien n'est à purger.</p>
        } @else if (!d.echues.length) {
          <p class="text-sm">Conservation fixée à {{ d.annees }} an(s) : aucune procédure n'est échue.</p>
        } @else {
          <p class="text-sm">Conservation fixée à {{ d.annees }} an(s) — {{ d.echues.length }} procédure(s) échue(s), la plus ancienne d'abord.</p>
          <div class="table-responsive">
            <table class="cnm-table">
              <thead><tr><th scope="col">Procédure</th><th scope="col">Séance close le</th><th scope="col">Échéance</th><th scope="col">Offres</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
              <tbody>
                @for (p of d.echues; track p.idDmc) {
                  <tr>
                    <td><span class="cnm-mono">{{ p.reference }}</span><br /><span class="text-sm text-muted">{{ p.objet }}</span></td>
                    <td>{{ dateHeure(p.closeLe) }}</td>
                    <td>{{ dateHeure(p.echeance) }}</td>
                    <td>{{ p.offresAPurger }}</td>
                    <td>
                      @if (aConfirmer() === p.idDmc) {
                        <span class="co__confirm">Purger {{ p.offresAPurger }} offre(s) ? C'est définitif.
                          <button type="button" class="btn btn-sm btn-danger" [disabled]="enCours()" (click)="purger(p)">Confirmer la purge</button>
                          <button type="button" class="btn btn-sm btn-outline" (click)="aConfirmer.set(null)">Annuler</button>
                        </span>
                      } @else {
                        <button type="button" class="btn btn-sm btn-outline" (click)="aConfirmer.set(p.idDmc)">Purger…</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .co { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .co__h2 { margin: 0; font-size: 1rem; }
    .co__confirm { display: inline-flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); }
  `,
})
export class ConservationOffresAdmin {
  /** La durée enregistrée : quand elle change, la liste des procédures échues se relit. */
  readonly annees = input<number | null>(null);

  private readonly service = inject(ConservationOffresService);
  private readonly toast = inject(ToastService);

  readonly dateHeure = dateHeureFr;
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly absent = signal(false);
  readonly donnees = signal<ConservationOffres | null>(null);
  readonly aConfirmer = signal<number | null>(null);
  readonly enCours = signal(false);

  constructor() {
    // Une première lecture, puis une à chaque durée enregistrée.
    effect(() => {
      this.annees();
      untracked(() => this.charger());
    });
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.absent.set(false);
    this.service.lire().subscribe({
      next: (d) => {
        this.donnees.set(d);
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 404) this.absent.set(true);
        else this.erreur.set(true);
      },
    });
  }

  purger(p: ProcedureEchue): void {
    this.enCours.set(true);
    this.service.purger(p.idDmc).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.aConfirmer.set(null);
        this.toast.success(`${r.offresPurgees} offre(s) purgée(s) pour ${p.reference}.`);
        this.charger();
      },
      error: (e: ApiError) => {
        this.enCours.set(false);
        const details = (e.raw?.error as { details?: Record<string, unknown> } | null)?.details ?? {};
        switch (codeErreur(e)) {
          case 'CONSERVATION_NON_FIXEE':
            this.toast.error("Aucune durée de conservation n'est fixée : rien ne peut être purgé.", 'Purge impossible');
            break;
          case 'CONSERVATION_EN_COURS':
            this.toast.error(`La durée de conservation n'est pas échue${details['echeance'] ? ' : échéance le ' + dateHeureFr(String(details['echeance'])) : ''}.`, 'Purge impossible');
            break;
          default:
            this.toast.error(e.message || "La purge n'a pas abouti.", 'Purge impossible');
        }
        this.charger();
      },
    });
  }
}
