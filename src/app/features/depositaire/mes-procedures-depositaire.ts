import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProcedureDepositaire } from '../../models';
import { DepositaireService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_ETAT_CEREMONIE, LIBELLES_ETAT_PART, classeCeremonie, classePart } from '../cao/libelles-cao';
import { LIBELLES_ETAT_SEANCE } from '../procedure/seance-ecran';

/**
 * ⚠️ V71 — « Mes procédures » du dépositaire (`GET /api/depositaire/procedures`) : les procédures dont il garde la part de
 * secours, avec l'état de sa clé, de la cérémonie et de la séance — et, en tête, ce qui l'attend : une clé à générer, ou une
 * part demandée par la séance.
 */
@Component({
  selector: 'app-mes-procedures-depositaire',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    <header class="page-header">
      <div class="page-subtitle">Dépositaire de la part de secours</div>
      <h1 class="page-title">Mes procédures</h1>
    </header>
    <p class="page-role">
      Pour chaque procédure, vous gardez la part de secours de la clé qui ouvrira les offres. Générez votre clé sur votre poste
      et conservez le pli de sa phrase ; si la séance d'ouverture vous la demande, vous l'apportez depuis cet espace.
    </p>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Vos procédures n'ont pas pu être chargées." (reessayer)="charger()" />
    } @else if (!procedures().length) {
      <div class="empty-state">
        <p class="empty-state-title">Aucune procédure ne vous est confiée pour l'instant.</p>
        <p class="empty-state-text">Une désignation par le responsable d'une procédure vous arrive par courriel.</p>
      </div>
    } @else {
      <ul class="mpd" aria-label="Mes procédures">
        @for (p of procedures(); track p.idDmc) {
          <li>
            <a class="mpd__carte" [routerLink]="['/depositaire', 'procedures', p.idDmc]">
              <span class="cnm-mono mpd__ref">{{ p.reference || ('procédure ' + p.idDmc) }}</span>
              <h2 class="mpd__objet">{{ p.objet || 'Objet non renseigné' }}</h2>
              <p class="mpd__etats">
                <span class="badge" [class]="'badge ' + classePart(p.etatPart)">{{ parts[p.etatPart] }}</span>
                <span class="badge" [class]="'badge ' + classeCeremonie(p.etatCeremonie)">Cérémonie {{ ceremonies[p.etatCeremonie] }}</span>
                @if (p.etatSeance; as s) { <span class="badge badge-neutral">Séance : {{ seances[s] }}</span> }
              </p>
              @if (p.secoursDemande && p.etatSeance === 'OUVERTE') {
                <p class="mpd__alerte">La séance demande votre part de secours.</p>
              } @else if (p.etatPart === 'ABSENTE' || p.cleARemplacer) {
                <p class="mpd__alerte">Votre clé de secours est à générer.</p>
              }
            </a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .mpd { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); gap: 0.9rem; }
    .mpd__carte { display: flex; flex-direction: column; gap: 0.35rem; height: 100%; box-sizing: border-box; padding: 0.9rem 1rem; background: #fff; border: 1px solid var(--n-200); border-radius: var(--radius-lg); text-decoration: none; color: inherit; }
    .mpd__carte:hover, .mpd__carte:focus-visible { border-color: var(--p-400); box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06); }
    .mpd__ref { font-size: var(--text-sm); color: var(--n-500); }
    .mpd__objet { margin: 0; font-size: 1rem; line-height: 1.35; }
    .mpd__etats { margin: 0.2rem 0 0; display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .mpd__alerte { margin: 0.2rem 0 0; font-size: var(--text-sm); font-weight: 700; color: var(--p-800); }
  `,
})
export class MesProceduresDepositaire implements OnInit {
  private readonly service = inject(DepositaireService);
  private readonly document = inject(DOCUMENT);

  readonly parts = LIBELLES_ETAT_PART;
  readonly ceremonies = LIBELLES_ETAT_CEREMONIE;
  readonly seances = LIBELLES_ETAT_SEANCE;
  readonly classePart = classePart;
  readonly classeCeremonie = classeCeremonie;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly procedures = signal<ProcedureDepositaire[]>([]);

  ngOnInit(): void {
    this.document.title = 'Mes procédures — Dépositaire — PRS 2.0';
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.procedures().subscribe({
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
