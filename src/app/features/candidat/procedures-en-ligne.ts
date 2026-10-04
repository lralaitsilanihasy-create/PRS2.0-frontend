import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ProcedureEnLigne } from '../../models';
import { ProceduresEnLigneService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_CATEGORIES } from '../prmp/fiche-marche/fiche-marche-modele';
import { LIBELLES_ETAT_PROCEDURE, dateHeureFr } from './libelles-candidat';

/**
 * Les procédures ouvertes à la remise électronique (`GET /api/procedures-en-ligne`, public, §B8) — la date limite la
 * plus proche d'abord. Une procédure y figure quand sa fiche DAO est validée en mode électronique, lancée par un avis
 * spécifique, non échue, et en signature Simple (la seule que la plateforme sache faire aujourd'hui). Chaque ligne
 * ouvre son détail ; le retrait du dossier demande un compte.
 */
@Component({
  selector: 'app-procedures-en-ligne',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    <header class="page-header">
      <div class="page-subtitle">Espace candidat</div>
      <h1 class="page-title">Procédures ouvertes à la remise électronique</h1>
    </header>
    <p class="page-role">
      Les appels d'offres que vous pouvez retirer en ligne, la date limite la plus proche d'abord.
      @if (!connecte()) { Pour retirer un dossier, <a routerLink="/candidat/inscription">créez un compte</a> ou <a routerLink="/login" [queryParams]="{ returnUrl: '/candidat/procedures' }">connectez-vous</a>. }
    </p>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement des procédures…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Les procédures n'ont pas pu être chargées." (reessayer)="charger()" />
    } @else if (!procedures().length) {
      <div class="empty-state">
        <p class="empty-state-title">Aucune procédure ouverte en ligne pour le moment.</p>
        <p class="empty-state-text">Les appels d'offres paraissent ici dès la publication de leur avis.</p>
      </div>
    } @else {
      <ul class="pel" aria-label="Procédures ouvertes">
        @for (p of procedures(); track p.idDmc) {
          <li>
            <a class="pel__carte" [routerLink]="['/candidat', 'procedures', p.idDmc]">
              <div class="pel__haut">
                <span class="cnm-mono pel__ref">{{ p.reference || ('procédure ' + p.idDmc) }}</span>
                <span class="badge" [class.badge-success]="p.etat === 'OUVERTE'" [class.badge-warning]="p.etat === 'A_VENIR'" [class.badge-neutral]="p.etat === 'CLOSE'">{{ etats[p.etat] }}</span>
              </div>
              <h2 class="pel__objet">{{ p.objet || 'Objet non renseigné' }}</h2>
              <p class="pel__meta">
                @if (p.autoriteContractante) { <span>{{ p.autoriteContractante }}</span> }
                @if (p.categorie) { <span>{{ categories[p.categorie] }}</span> }
                <span>{{ p.lots.length ? p.lots.length + (p.lots.length > 1 ? ' lots' : ' lot') : 'non alloti' }}</span>
              </p>
              <p class="pel__limite">
                @if (p.dateLimite) { Date limite : <strong>{{ dateHeure(p.dateLimite) }}</strong> } @else { Date limite non renseignée }
              </p>
            </a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .pel { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); gap: 0.9rem; }
    .pel__carte { display: flex; flex-direction: column; gap: 0.35rem; height: 100%; box-sizing: border-box; padding: 0.9rem 1rem; background: #fff; border: 1px solid var(--n-200); border-radius: var(--radius-lg); text-decoration: none; color: inherit; }
    .pel__carte:hover, .pel__carte:focus-visible { border-color: var(--p-400); box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06); }
    .pel__haut { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .pel__ref { font-size: var(--text-sm); color: var(--n-500); }
    .pel__objet { margin: 0; font-size: 1rem; line-height: 1.35; }
    .pel__meta { margin: 0; display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; font-size: var(--text-sm); color: var(--n-500); }
    .pel__limite { margin: 0.2rem 0 0; font-size: var(--text-sm); }
  `,
})
export class ProceduresEnLigne implements OnInit {
  private readonly service = inject(ProceduresEnLigneService);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  readonly etats = LIBELLES_ETAT_PROCEDURE;
  readonly categories = LIBELLES_CATEGORIES;
  readonly dateHeure = dateHeureFr;
  readonly connecte = computed(() => this.auth.isAuthenticated() && this.auth.role() === 'CANDIDAT');

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly procedures = signal<ProcedureEnLigne[]>([]);

  ngOnInit(): void {
    this.document.title = 'Procédures ouvertes — Espace candidat — PRS 2.0';
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.liste().subscribe({
      next: (liste) => {
        this.procedures.set(liste);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }
}
