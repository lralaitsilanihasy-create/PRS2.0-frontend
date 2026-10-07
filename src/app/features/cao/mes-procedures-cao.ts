import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MaProcedureCao } from '../../models';
import { CaoEspaceService, KpiService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { LIBELLES_ETAT_CEREMONIE, LIBELLES_ETAT_PART, classeCeremonie, classePart } from './libelles-cao';

/**
 * « Mes procédures » (`GET /api/cao/mes-procedures`, lot 2a §B2) : les appels d'offres où le membre connecté siège, avec
 * l'état de la cérémonie et celui de sa part — ce qui lui dit, d'un coup d'œil, s'il a une clé à publier ou à vérifier.
 */
@Component({
  selector: 'app-mes-procedures-cao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    <header class="page-header">
      <div class="page-subtitle">Commission d'appel d'offres</div>
      <h1 class="page-title">Mes procédures</h1>
    </header>
    <p class="page-role">
      Les appels d'offres où vous siégez. Pour chacun, vous détenez une part de la clé qui ouvrira les offres : publiez
      votre clé avant la cérémonie, vérifiez votre part avant la date limite.
    </p>

    <!-- ⚠️ 07/10 — les compteurs de l'évaluation des offres (V78, GET /api/kpis/badges, ouvert au membre de la CAO). -->
    @if (evaluationsEnCours() || rapportsASigner()) {
      <div class="alert alert-info mp__compteurs" role="status">
        <span>
          @if (evaluationsEnCours()) { <strong>{{ evaluationsEnCours() }}</strong> évaluation(s) des offres en cours. }
          @if (rapportsASigner()) { <strong>{{ rapportsASigner() }}</strong> rapport(s) d'évaluation à signer. }
          Ouvrez la procédure, puis « Ouvrir l'évaluation ».
        </span>
      </div>
    }

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Vos procédures n'ont pas pu être chargées." (reessayer)="charger()" />
    } @else if (!procedures().length) {
      <div class="empty-state">
        <p class="empty-state-title">Vous ne siégez dans aucune commission pour l'instant.</p>
        <p class="empty-state-text">Une désignation par la PRMP vous arrive par courriel.</p>
      </div>
    } @else {
      <ul class="mp" aria-label="Mes procédures">
        @for (p of procedures(); track p.idDmc) {
          <li>
            <a class="mp__carte" [routerLink]="['/cao', 'procedures', p.idDmc]">
              <div class="mp__haut">
                <span class="cnm-mono mp__ref">{{ p.reference || ('procédure ' + p.idDmc) }}</span>
                @if (p.president) { <span class="badge badge-primary">Président</span> }
              </div>
              <h2 class="mp__objet">{{ p.objet || 'Objet non renseigné' }}</h2>
              @if (p.autoriteContractante) { <p class="mp__meta">{{ p.autoriteContractante }}</p> }
              <p class="mp__etats">
                <span class="badge" [class]="'badge ' + classePart(p.etatPart)">{{ parts[p.etatPart] }}</span>
                @if (p.etatCeremonie; as c) { <span class="badge" [class]="'badge ' + classeCeremonie(c)">Cérémonie {{ ceremonies[c] }}</span> }
              </p>
              @if (p.dateLimite) { <p class="mp__limite">Date limite des offres : <strong>{{ dateHeure(p.dateLimite) }}</strong></p> }
            </a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .mp { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); gap: 0.9rem; }
    .mp__carte { display: flex; flex-direction: column; gap: 0.35rem; height: 100%; box-sizing: border-box; padding: 0.9rem 1rem; background: #fff; border: 1px solid var(--n-200); border-radius: var(--radius-lg); text-decoration: none; color: inherit; }
    .mp__carte:hover, .mp__carte:focus-visible { border-color: var(--p-400); box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06); }
    .mp__haut { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .mp__ref { font-size: var(--text-sm); color: var(--n-500); }
    .mp__objet { margin: 0; font-size: 1rem; line-height: 1.35; }
    .mp__meta { margin: 0; font-size: var(--text-sm); color: var(--n-500); }
    .mp__etats { margin: 0.2rem 0 0; display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .mp__limite { margin: 0.2rem 0 0; font-size: var(--text-sm); }
  `,
})
export class MesProceduresCao implements OnInit {
  private readonly service = inject(CaoEspaceService);
  private readonly document = inject(DOCUMENT);
  private readonly kpi = inject(KpiService);

  readonly parts = LIBELLES_ETAT_PART;
  readonly ceremonies = LIBELLES_ETAT_CEREMONIE;
  readonly classePart = classePart;
  readonly classeCeremonie = classeCeremonie;
  readonly dateHeure = dateHeureFr;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly procedures = signal<MaProcedureCao[]>([]);
  readonly evaluationsEnCours = signal(0);
  readonly rapportsASigner = signal(0);

  ngOnInit(): void {
    this.document.title = 'Mes procédures — Commission d’appel d’offres — PRS 2.0';
    this.charger();
    // Silencieux : sans compteur, rien ne s'affiche.
    this.kpi.badges().subscribe({
      next: ({ compteurs }) => {
        this.evaluationsEnCours.set(compteurs['evaluationsEnCours'] ?? 0);
        this.rapportsASigner.set(compteurs['rapportsASigner'] ?? 0);
      },
      error: () => undefined,
    });
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.mesProcedures().subscribe({
      next: (l) => {
        this.procedures.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }
}
