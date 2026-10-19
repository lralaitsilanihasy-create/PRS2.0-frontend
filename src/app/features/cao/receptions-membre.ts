import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { ReceptionAMoi } from '../../models';
import { ReceptionsCommandesService } from '../../services';
import { BandeauEspace, PuceBandeau } from '../../shared/ui/bandeau-espace';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { ReceptionsBonVue } from '../receptions/receptions-bon';

/**
 * ⚠️ Lot MS-4 (V127, 16/10) — **les réceptions à traiter** par un membre d'une commission de réception (compte K…, même espace que
 * les membres de CAO) : le président établit le procès-verbal (et ouvre la réception définitive au terme de la garantie), chaque
 * membre le signe. Les gestes en attente viennent en tête.
 */
@Component({
  selector: 'app-receptions-membre',
  imports: [EtatErreur, ReceptionsBonVue, BandeauEspace],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rm">
      <app-bandeau-espace surtitre="Commission de réception" titre="Réceptions des commandes" [puces]="puces()" />
      <p class="page-role rm__intro">Les livraisons des contrats dont vous êtes membre de la commission de réception (loi n° 2016-055, art. 13). Le président établit le procès-verbal ; chaque membre le signe.</p>
      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des réceptions…</p>
      } @else if (erreur(); as m) {
        <app-etat-erreur [message]="m" aide="La liste n’a pas pu être lue." (reessayer)="charger()" />
      } @else {
        @for (m of liste(); track m.reception.id) {
          <article class="card rm__carte" [class.rm__carte--action]="m.aEtablir || m.aSigner" [attr.aria-label]="'Bon de commande n° ' + m.reception.numeroBon">
            <header class="rm__tete">
              <h2 class="rm__h2">Bon n° {{ m.reception.numeroBon }}{{ m.objetBon ? ' — ' + m.objetBon : '' }}</h2>
              @if (m.aEtablir) { <span class="badge badge-warning">PV à établir</span> }
              @if (m.aSigner) { <span class="badge badge-warning">À signer</span> }
              @if (m.president) { <span class="badge badge-info">Vous présidez</span> }
            </header>
            <p class="text-sm rm__meta">Titulaire : {{ m.titulaire || '—' }}</p>
            <app-receptions-bon [idBon]="m.reception.idBon" [president]="m.president" [signerSansIdentifiant]="m.aSigner" />
          </article>
        } @empty { <p class="text-muted">Aucune réception à traiter.</p> }
      }
    </section>
  `,
  styles: `
    .rm { display: flex; flex-direction: column; gap: 1rem; }
    .rm__intro, .rm__meta { margin: 0; }
    .rm__carte { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; border-left: 4px solid var(--n-300); }
    .rm__carte--action { border-left-color: var(--warning-text); }
    .rm__tete { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .rm__h2 { margin: 0; font-size: 1rem; flex: 1 1 auto; }
  `,
})
export class ReceptionsMembre implements OnInit {
  private readonly service = inject(ReceptionsCommandesService);

  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly liste = signal<ReceptionAMoi[]>([]);
  /** ⚠️ 19/10 — le bandeau compte les réceptions, et celles qui attendent un geste du membre. */
  readonly puces = computed<PuceBandeau[]>(() => {
    const l = this.liste();
    if (!l.length) return [];
    const aFaire = l.filter((m) => m.aEtablir || m.aSigner).length;
    return [{ texte: l.length > 1 ? 'réceptions' : 'réception', fort: l.length }, ...(aFaire ? [{ texte: 'à établir ou signer', fort: aFaire, accent: true }] : [])];
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service.miennes().subscribe({
      next: (l) => {
        this.liste.set([...l].sort((a, b) => Number(b.aEtablir || b.aSigner) - Number(a.aEtablir || a.aSigner)));
        this.chargement.set(false);
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        this.erreur.set(e.status === 403 ? 'Vous n’êtes membre d’aucune commission de réception.' : 'Les réceptions n’ont pas pu être chargées.');
      },
    });
  }
}
