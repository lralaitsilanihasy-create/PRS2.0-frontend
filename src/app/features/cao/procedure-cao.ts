import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { dateFr } from '../../core/interim/interim-libelles';
import { VueProcedureCao } from '../../models';
import { CaoEspaceService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_CATEGORIES } from '../prmp/fiche-marche/fiche-marche-modele';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { LIBELLES_ORIGINE } from './libelles-cao';
import { MaCle } from './ma-cle';

/**
 * La procédure vue par un membre de la CAO (`GET /api/cao/procedures/{idDmc}`, lot 2a §B2) : l'appel d'offres (version
 * courante de la fiche), la commission telle que la PRMP l'a désignée — sans les adresses des autres membres —, puis sa
 * part de clé (lot 2b). 403 s'il n'y siège pas.
 */
@Component({
  selector: 'app-procedure-cao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, MaCle],
  template: `
    <nav class="pc__ariane" aria-label="Fil d'Ariane">
      <a routerLink="/cao/mes-procedures">Mes procédures</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{{ vue()?.procedure?.reference || 'Procédure' }}</span>
    </nav>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (refuse()) {
      <div class="alert alert-info" role="status"><span>Vous ne siégez pas dans la commission de cette procédure.</span></div>
    } @else if (erreur()) {
      <app-etat-erreur message="La procédure n'a pas pu être chargée." (reessayer)="charger()" />
    } @else if (vue(); as v) {
      <header class="page-header">
        <div class="page-subtitle">
          <span class="cnm-mono">{{ v.procedure.reference || ('procédure ' + idDmc) }}</span>
          @if (v.president) { · <span class="badge badge-primary">Vous présidez la commission</span> }
        </div>
        <h1 class="page-title">{{ v.procedure.objet || 'Objet non renseigné' }}</h1>
        <p class="pc__sous">
          @if (v.procedure.autoriteContractante) { <span>{{ v.procedure.autoriteContractante }}</span> }
          @if (v.procedure.categorie) { <span>{{ categories[v.procedure.categorie] }}</span> }
          @if (v.procedure.dateLimite) { <span>Date limite des offres : <strong>{{ dateHeure(v.procedure.dateLimite) }}</strong></span> }
        </p>
      </header>

      <section class="card pc__bloc" aria-labelledby="pc-cao">
        <h2 id="pc-cao" class="pc__h2">La commission d'appel d'offres</h2>
        @if (v.cao.decision.reference) {
          <p class="text-sm">Décision de la PRMP n° <strong>{{ v.cao.decision.reference }}</strong>{{ v.cao.decision.date ? ' du ' + date(v.cao.decision.date) : '' }}.</p>
        }
        <ul class="pc__membres">
          @for (m of v.cao.membres; track m.id) {
            <li class="pc__membre">
              <span><strong>{{ m.nom }} {{ m.prenom }}</strong>{{ m.president ? ' — président' : '' }}</span>
              <span class="text-sm text-muted">{{ m.origine ? origines[m.origine] : 'Origine à préciser' }}{{ m.fonction ? ' · ' + m.fonction : '' }}{{ m.organisme ? ' · ' + m.organisme : '' }}{{ m.service ? ' · ' + m.service : '' }}{{ m.domaine ? ' · ' + m.domaine : '' }}</span>
            </li>
          }
        </ul>
      </section>

      <app-ma-cle [idDmc]="idDmc" />
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .pc__ariane { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); }
    .pc__ariane a { color: var(--p-700); font-weight: 600; }
    .pc__sous { margin: 0.25rem 0 0; display: flex; gap: 0.75rem; flex-wrap: wrap; color: var(--n-500); font-size: var(--text-sm); }
    .pc__bloc { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .pc__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .pc__membres { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    .pc__membre { display: flex; flex-direction: column; font-size: var(--text-sm); }
  `,
})
export class ProcedureCao implements OnInit {
  private readonly service = inject(CaoEspaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly categories = LIBELLES_CATEGORIES;
  readonly origines = LIBELLES_ORIGINE;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;

  readonly chargement = signal(true);
  readonly refuse = signal(false);
  readonly erreur = signal(false);
  readonly vue = signal<VueProcedureCao | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.refuse.set(false);
    this.erreur.set(false);
    this.service.procedure(this.idDmc).subscribe({
      next: (v) => {
        this.vue.set(v);
        this.document.title = `${v.procedure.reference || 'Procédure'} — Commission d’appel d’offres — PRS 2.0`;
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 403 || e.status === 404) this.refuse.set(true);
        else this.erreur.set(true);
      },
    });
  }
}
