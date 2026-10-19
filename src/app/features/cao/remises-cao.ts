import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { Remise } from '../../models';
import { RemisesService } from '../../services';
import { BandeauEspace, PuceBandeau } from '../../shared/ui/bandeau-espace';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { RemiseDetail } from '../remises/remise-detail';

/**
 * ⚠️ Lot MS-2 (V125, 16/10) — **les remises en concurrence** des contrats-cadres dont le membre est de la commission : la CAO du
 * contrat-cadre évalue en **collège restreint** (décret n° 2019-1064, art. 28 et 33). ⚠️ H1, à confirmer par le juriste : son
 * **président** arrête l'évaluation et signe le rapport simplifié ; le serveur refuse (403) aux autres membres, qui lisent.
 * Celles qui attendent l'évaluation (échéance passée) viennent en tête.
 */
@Component({
  selector: 'app-remises-cao',
  imports: [EtatErreur, RemiseDetail, BandeauEspace],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rc">
      <app-bandeau-espace surtitre="Commission d'appel d'offres" titre="Remises en concurrence" [puces]="puces()" />
      <p class="page-role rc__intro">Les marchés subséquents des contrats-cadres dont vous êtes membre de la commission. Après l’échéance, le président de la commission évalue les réponses en collège restreint et produit le rapport simplifié ; la PRMP décide ensuite.</p>
      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des remises…</p>
      } @else if (erreur(); as m) {
        <app-etat-erreur [message]="m" aide="La liste n’a pas pu être lue." (reessayer)="charger()" />
      } @else {
        @for (r of triees(); track r.id) {
          <app-remise-detail [remise]="r" profil="CAO" (maj)="aJour($event)" />
        } @empty { <p class="text-muted">Aucune remise en concurrence pour vos procédures.</p> }
      }
    </section>
  `,
  styles: `
    .rc { display: flex; flex-direction: column; gap: 1rem; }
    .rc__intro { margin: 0; }
  `,
})
export class RemisesCao implements OnInit {
  private readonly service = inject(RemisesService);

  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly remises = signal<Remise[]>([]);
  /** À évaluer d'abord (en cours, échéance passée), puis l'ordre du serveur (échéance décroissante). */
  readonly triees = computed(() => {
    const aEvaluer = (r: Remise): number => Number(r.etat === 'EN_COURS' && r.echeancePassee);
    return [...this.remises()].sort((a, b) => aEvaluer(b) - aEvaluer(a));
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service.lister().subscribe({
      next: (l) => {
        this.remises.set(l);
        this.chargement.set(false);
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        this.erreur.set(e.status === 403 ? 'Les remises en concurrence ne sont pas ouvertes à votre profil.' : 'Les remises en concurrence n’ont pas pu être chargées.');
      },
    });
  }

  /** ⚠️ 19/10 — le bandeau compte les remises, et celles qui attendent l'évaluation (échéance passée). */
  readonly puces = computed<PuceBandeau[]>(() => {
    const l = this.remises();
    if (!l.length) return [];
    const aEvaluer = l.filter((r) => r.etat === 'EN_COURS' && r.echeancePassee).length;
    return [{ texte: l.length > 1 ? 'remises' : 'remise', fort: l.length }, ...(aEvaluer ? [{ texte: 'à évaluer', fort: aEvaluer, accent: true }] : [])];
  });

  aJour(r: Remise): void {
    this.remises.update((l) => l.map((x) => (x.id === r.id ? r : x)));
  }
}
