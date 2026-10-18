import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AmiPublic, ProcedureEnLigne } from '../../models';
import { AmisEnLigneService, ProceduresEnLigneService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_CATEGORIES } from '../prmp/fiche-marche/fiche-marche-modele';
import { LIBELLES_ETAT_PROCEDURE, dateHeureFr } from './libelles-candidat';
import { EtatVideCandidat } from './etat-vide-candidat';
import { Icone } from '../../shared/ui/icone';
import { tempsRestant } from './procedure-en-ligne-modele';

/**
 * Les procédures ouvertes à la remise électronique (`GET /api/procedures-en-ligne`, public, §B8) — la date limite la
 * plus proche d'abord. Une procédure y figure quand sa fiche DAO est validée en mode électronique, lancée par un avis
 * spécifique, non échue, et en signature Simple (la seule que la plateforme sache faire aujourd'hui). Chaque ligne
 * ouvre son détail ; le retrait du dossier demande un compte.
 */
@Component({
  selector: 'app-procedures-en-ligne',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, EtatVideCandidat, Icone],
  template: `
    <header class="page-header">
      <div class="page-subtitle">Espace candidat</div>
      <h1 class="page-title">Procédures ouvertes à la remise électronique</h1>
    </header>
    <p class="page-role">
      Les appels à manifestation d'intérêt et les appels d'offres que vous pouvez retirer en ligne, la date limite la plus proche d'abord.
      @if (!connecte()) { Pour retirer un dossier, <a routerLink="/candidat/inscription">créez un compte</a> ou <a routerLink="/login" [queryParams]="{ returnUrl: '/candidat/procedures' }">connectez-vous</a>. }
    </p>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement des procédures…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Les procédures n'ont pas pu être chargées." (reessayer)="charger()" />
    } @else if (!procedures().length && !amis().length) {
      <app-etat-vide-candidat icone="globe" titre="Aucune procédure ouverte en ligne pour le moment" texte="Les appels d’offres et les appels à manifestation d’intérêt paraissent ici dès la publication de leur avis." />
    } @else {
      <!-- ⚠️ AMI-a (07/10, V82) — les appels à manifestation d'intérêt des prestations intellectuelles : liste servie à part
           (/api/amis-en-ligne), fusionnée ici à l'affichage, en tête : leur date limite précède la consultation. -->
      @if (amis().length) {
        <h2 class="pel__h2">Appels à manifestation d’intérêt</h2>
        <ul class="pel" aria-label="Appels à manifestation d'intérêt ouverts">
          @for (a of amis(); track a.idDmc) {
            <li>
              <a class="pel__carte" [routerLink]="['/candidat', 'amis', a.idDmc]">
                <div class="pel__haut">
                  <span class="cnm-mono pel__ref">{{ a.reference || ('appel ' + a.idDmc) }}</span>
                  <span class="badge badge-success">Ouvert</span>
                </div>
                <h3 class="pel__objet">{{ a.objet || 'Objet non renseigné' }}</h3>
                <p class="pel__meta">
                  @if (a.autoriteContractante) { <span><app-icone nom="board" [taille]="13" />{{ a.autoriteContractante }}</span> }
                  <span><app-icone nom="users" [taille]="13" />Prestations intellectuelles · {{ a.nombreRetenus ?? 6 }} candidats retenus</span>
                </p>
                <p class="pel__pied">
                  <span class="pel__limite"><app-icone nom="clock" [taille]="14" />@if (a.dateLimite) { <span>Date limite <strong>{{ dateHeure(a.dateLimite) }}</strong></span>@if (reste(a.dateLimite); as r) { <span class="pel__reste">{{ r }}</span> } } @else { Date limite non renseignée }</span>
                  <span class="pel__voir">Consulter<app-icone nom="chev" [taille]="14" /></span>
                </p>
              </a>
            </li>
          }
        </ul>
        @if (procedures().length) { <h2 class="pel__h2">Appels d’offres</h2> }
      }
      <ul class="pel" aria-label="Procédures ouvertes">
        @for (p of procedures(); track p.idDmc) {
          <li>
            <a class="pel__carte" [attr.data-etat]="p.etat" [routerLink]="['/candidat', 'procedures', p.idDmc]">
              <div class="pel__haut">
                <span class="cnm-mono pel__ref">{{ p.reference || ('procédure ' + p.idDmc) }}</span>
                <span class="badge" [class.badge-success]="p.etat === 'OUVERTE'" [class.badge-warning]="p.etat === 'A_VENIR'" [class.badge-neutral]="p.etat === 'CLOSE'">{{ etats[p.etat] }}</span>
              </div>
              <h2 class="pel__objet">{{ p.objet || 'Objet non renseigné' }}</h2>
              <p class="pel__meta">
                @if (p.autoriteContractante) { <span><app-icone nom="board" [taille]="13" />{{ p.autoriteContractante }}</span> }
                @if (p.categorie) { <span><app-icone nom="layers" [taille]="13" />{{ categories[p.categorie] }}</span> }
                <span><app-icone nom="columns" [taille]="13" />{{ p.lots.length > 1 ? p.lots.length + ' lots' : 'Lot unique' }}</span>
              </p>
              <!-- ⚠️ 18/10 (pilote) — la date limite en pied de carte, avec le temps qui reste ; « Consulter » dit que la carte s'ouvre. -->
              <p class="pel__pied">
                <span class="pel__limite"><app-icone nom="clock" [taille]="14" />@if (p.dateLimite) { <span>Date limite <strong>{{ dateHeure(p.dateLimite) }}</strong></span>@if (p.etat !== 'CLOSE' && reste(p.dateLimite); as r) { <span class="pel__reste">{{ r }}</span> } } @else { Date limite non renseignée }</span>
                <span class="pel__voir">Consulter<app-icone nom="chev" [taille]="14" /></span>
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
    .pel__carte { display: flex; flex-direction: column; gap: 0.45rem; height: 100%; box-sizing: border-box; padding: 1rem 1.1rem 0.85rem; background: #fff; border: 1px solid var(--n-200);
      border-top: 4px solid var(--success-text); border-radius: var(--radius-lg); text-decoration: none; color: inherit; box-shadow: var(--shadow-sm); transition: border-color .15s, box-shadow .15s; }
    .pel__carte[data-etat='A_VENIR'] { border-top-color: #f59e0b; }
    .pel__carte[data-etat='CLOSE'] { border-top-color: var(--n-300); }
    .pel__carte:hover, .pel__carte:focus-visible { border-color: var(--p-400); box-shadow: var(--shadow-md); }
    .pel__meta span { display: inline-flex; gap: 0.3rem; align-items: center; }
    .pel__pied { margin: auto 0 0; padding-top: 0.65rem; border-top: 1px solid var(--n-200); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .pel__voir { flex: none; }
    .pel__limite { display: inline-flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); color: var(--n-700); }
    .pel__reste { font-size: var(--text-xs); font-weight: 700; padding: 0.05rem 0.5rem; border-radius: var(--radius-full); background: var(--p-100); color: var(--p-800); }
    .pel__voir { display: inline-flex; gap: 0.2rem; align-items: center; font-size: var(--text-sm); font-weight: 700; color: var(--p-700); }
    .pel__haut { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .pel__ref { font-size: var(--text-sm); color: var(--n-500); }
    .pel__objet { margin: 0; font-size: 1rem; line-height: 1.35; }
    .pel__meta { margin: 0; display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; font-size: var(--text-sm); color: var(--n-500); }
    .pel__h2 { margin: 1rem 0 0.6rem; font-size: 1.05rem; }
  `,
})
export class ProceduresEnLigne implements OnInit {
  private readonly service = inject(ProceduresEnLigneService);
  private readonly amisService = inject(AmisEnLigneService);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  readonly etats = LIBELLES_ETAT_PROCEDURE;
  readonly categories = LIBELLES_CATEGORIES;
  readonly dateHeure = dateHeureFr;
  readonly reste = (d: string | null | undefined): string | null => tempsRestant(d);
  readonly connecte = computed(() => this.auth.isAuthenticated() && this.auth.role() === 'CANDIDAT');

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly procedures = signal<ProcedureEnLigne[]>([]);
  readonly amis = signal<AmiPublic[]>([]);

  ngOnInit(): void {
    this.document.title = 'Procédures ouvertes — Espace candidat — PRS 2.0';
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    // Les appels à manifestation d'intérêt ne bloquent jamais la liste : en cas d'échec, ils manquent, sans plus.
    forkJoin({ liste: this.service.liste(), amis: this.amisService.liste().pipe(catchError(() => of([] as AmiPublic[]))) }).subscribe({
      next: ({ liste, amis }) => {
        this.procedures.set(liste);
        this.amis.set(amis);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }
}
