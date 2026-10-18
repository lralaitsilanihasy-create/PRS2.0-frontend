import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { RecuDao } from '../../models';
import { FicheMarcheService } from '../../services';
import { EnteteProcedure } from './entete-procedure';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { RecusTable } from './recus-table';

/**
 * Les **reçus des frais de dossier** d'une procédure à retrait payant (V72, voie B du 06/10) : la PRMP **ou l'UGPM** de la fiche
 * valide ou refuse (motif obligatoire) chaque reçu déposé par une entreprise ; tant que le reçu n'est pas validé, l'entreprise ne
 * retire pas le dossier. Une décision ne se reprend pas (409 `RECU_DEJA_DECIDE`) : une erreur se corrige par un nouveau dépôt du
 * candidat. La vérification du versement se fait hors de la plateforme (relevé de l'ARMP, H3).
 *
 * ⚠️ 18/10 (pilote) — le tableau et ses décisions vivent dans `RecusTable`, partagé avec l'écran transverse « Reçus des frais ».
 */
@Component({
  selector: 'app-recus-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, EnteteProcedure, RecusTable],
  template: `
    <section class="rc">
      <header class="page-header">
        <app-entete-procedure [idDmc]="idDmc" />
        <h1 class="page-title">Reçus des frais de dossier</h1>
      </header>
      <p class="page-role">Chaque entreprise dépose le reçu de son versement sur le compte de l’ARMP ; elle retire le dossier dès que vous l’avez validé. Comparez le reçu au relevé de l’ARMP avant de décider : une décision ne se reprend pas. <a routerLink="/prmp/recus">Tous vos reçus à valider</a>.</p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des reçus…</p>
      } @else if (refuse()) {
        <div class="alert alert-info" role="status"><span>Les reçus sont réservés à la PRMP et à l’UGPM de la fiche.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="Les reçus n'ont pas pu être chargés." (reessayer)="charger()" />
      } @else if (!recus().length) {
        <div class="empty-state">
          <p class="empty-state-title">Aucun reçu déposé pour l’instant.</p>
          <p class="empty-state-text">Les reçus apparaissent ici dès qu’une entreprise en dépose un ; vous en êtes notifié.</p>
        </div>
      } @else {
        <p class="text-sm"><strong>{{ enAttente() }}</strong> {{ enAttente() > 1 ? 'reçus attendent' : 'reçu attend' }} votre décision · {{ recus().length }} au total.</p>
        <app-recus-table [idDmc]="idDmc" [recus]="recus()" (decide)="appliquer($event)" (recharger)="charger()" />
      }
    </section>
  `,
  styles: `
    .rc { display: flex; flex-direction: column; gap: 0.75rem; }
  `,
})
export class RecusDao implements OnInit {
  private readonly service = inject(FicheMarcheService);
  private readonly route = inject(ActivatedRoute);

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly refuse = signal(false);
  readonly recus = signal<RecuDao[]>([]);
  readonly enAttente = computed(() => this.recus().filter((r) => r.etat === 'EN_ATTENTE').length);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.refuse.set(false);
    this.service.recus(this.idDmc).subscribe({
      next: (r) => {
        this.recus.set(r);
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 403) this.refuse.set(true);
        else this.erreur.set(true);
      },
    });
  }

  appliquer(maj: RecuDao): void {
    this.recus.update((l) => l.map((x) => (x.idRecu === maj.idRecu ? { ...x, ...maj } : x)));
  }
}
