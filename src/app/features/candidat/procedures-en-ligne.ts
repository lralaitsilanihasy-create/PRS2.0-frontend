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
import { FiltreProcedures, compteursProcedures, filtrerProcedures, lignesProcedures } from './procedure-en-ligne-modele';

/**
 * Les procédures ouvertes à la remise électronique (`GET /api/procedures-en-ligne`, public, §B8) — la date limite la
 * plus proche d'abord. Une procédure y figure quand sa fiche DAO est validée en mode électronique, lancée par un avis
 * spécifique, non échue, et en signature Simple (la seule que la plateforme sache faire aujourd'hui). Chaque ligne
 * ouvre son détail ; le retrait du dossier demande un compte.
 *
 * ⚠️ 19/10 (maquette du pilote) — compteurs (ouvertes, à venir, prochaine échéance), recherche et filtres d'état, lignes pleine
 * largeur : liseré d'état, jours restants, avancement de la période de dépôt. Appels d'offres et appels à manifestation d'intérêt
 * sont présentés de la même façon, dans une seule liste.
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
      Les appels d'offres et les appels à manifestation d'intérêt que vous pouvez retirer en ligne, la date limite la plus proche d'abord.
      @if (!connecte()) { Pour retirer un dossier, <a routerLink="/candidat/inscription">créez un compte</a> ou <a routerLink="/login" [queryParams]="{ returnUrl: '/candidat/procedures' }">connectez-vous</a>. }
    </p>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement des procédures…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Les procédures n'ont pas pu être chargées." (reessayer)="charger()" />
    } @else if (!lignes().length) {
      <app-etat-vide-candidat icone="globe" titre="Aucune procédure ouverte en ligne pour le moment" texte="Les appels d’offres et les appels à manifestation d’intérêt paraissent ici dès la publication de leur avis." />
    } @else {
      @let c = compteurs();
      <section class="pel__compteurs" aria-label="En bref">
        <div class="pel__compteur"><span class="pel__compteur-lib">Ouvertes</span><strong class="pel__compteur-val pel__compteur-val--ok">{{ c.ouvertes }}</strong></div>
        <div class="pel__compteur"><span class="pel__compteur-lib">À venir</span><strong class="pel__compteur-val pel__compteur-val--venir">{{ c.aVenir }}</strong></div>
        <div class="pel__compteur"><span class="pel__compteur-lib">Prochaine échéance</span><strong class="pel__compteur-val">{{ c.prochaine == null ? '—' : c.prochaine === 0 ? 'Aujourd’hui' : c.prochaine + ' j' }}</strong></div>
      </section>

      <div class="pel__outils">
        <label class="pel__recherche">
          <app-icone nom="search" [taille]="16" />
          <span class="cnm-sr-only">Rechercher</span>
          <input type="search" class="form-control" placeholder="Référence, objet, autorité…" [value]="texte()" (input)="texte.set($any($event.target).value)" />
        </label>
        <div class="pel__filtres" role="group" aria-label="Filtrer par état">
          @for (f of filtresDispo; track f.cle) {
            <button type="button" class="pel__filtre" [class.pel__filtre--actif]="filtre() === f.cle" [attr.aria-pressed]="filtre() === f.cle" (click)="filtre.set(f.cle)">{{ f.libelle }}</button>
          }
        </div>
      </div>

      @if (!visibles().length) {
        <p class="pel__aucune" role="status">Aucune procédure ne correspond. <button type="button" class="btn btn-sm btn-outline" (click)="texte.set(''); filtre.set('TOUTES')">Tout afficher</button></p>
      }
      <ul class="pel" aria-label="Procédures">
        @for (l of visibles(); track l.cle) {
          <li class="pel__ligne" [attr.data-etat]="l.etat">
            <div class="pel__corps">
              <p class="pel__haut">
                <span class="cnm-mono pel__ref">{{ l.reference }}</span>
                <span class="pel__badge" [attr.data-etat]="l.etat">{{ libelleEtat(l.etat, l.genre) }}</span>
              </p>
              <h2 class="pel__objet"><a [routerLink]="l.lien">{{ l.objet }}</a></h2>
              <p class="pel__meta">
                @if (l.autorite) { <span><app-icone nom="board" [taille]="14" />{{ l.autorite }}</span> }
                @if (l.categorie) { <span><app-icone nom="layers" [taille]="14" />{{ l.categorie }}</span> }
                <span><app-icone nom="columns" [taille]="14" />{{ l.lots }}</span>
              </p>
              @if (l.etat === 'OUVERTE') {
                <div class="pel__echeance">
                  @if (l.avancement != null) {
                    <span class="pel__barre" role="progressbar" aria-label="Période de dépôt écoulée" [attr.aria-valuenow]="l.avancement" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="l.avancement"></span></span>
                  }
                  <span class="pel__cloture">Clôture {{ l.dateLimite ? dateHeure(l.dateLimite) : 'non renseignée' }}</span>
                </div>
              } @else if (l.etat === 'A_VENIR') {
                <p class="pel__cloture"><app-icone nom="clock" [taille]="14" />{{ l.dateOuverture ? 'Ouverture le ' + dateHeure(l.dateOuverture) : 'Ouverture à annoncer' }} · clôture {{ l.dateLimite ? dateHeure(l.dateLimite) : '—' }}</p>
              } @else {
                <p class="pel__cloture">Close depuis le {{ l.dateLimite ? dateHeure(l.dateLimite) : '—' }}</p>
              }
            </div>
            <div class="pel__droite">
              @if (l.joursRestants != null) {
                <p class="pel__jours"><strong>{{ l.joursRestants === 0 ? 'Dernier' : l.joursRestants }}</strong><span>{{ l.joursRestants === 0 ? 'jour' : l.joursRestants > 1 ? 'jours restants' : 'jour restant' }}</span></p>
              }
              <a class="btn btn-sm" [class.btn-primary]="l.etat === 'OUVERTE'" [class.btn-outline]="l.etat !== 'OUVERTE'" [routerLink]="l.lien">
                {{ l.etat === 'OUVERTE' ? 'Consulter' : 'Voir le détail' }}<app-icone nom="chev" [taille]="14" />
              </a>
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .pel__compteurs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.8rem; margin-bottom: 1rem; }
    .pel__compteur { background: var(--carte-fond); border: 1px solid var(--n-200); border-radius: var(--radius-lg); padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.15rem; box-shadow: var(--shadow-sm); }
    .pel__compteur-lib { font-size: var(--text-sm); color: var(--n-500); }
    .pel__compteur-val { font-size: 1.6rem; line-height: 1.1; color: var(--n-800); }
    .pel__compteur-val--ok { color: var(--success-text); }
    .pel__compteur-val--venir { color: var(--warning-text); }

    .pel__outils { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
    .pel__recherche { flex: 1 1 18rem; position: relative; display: flex; align-items: center; margin: 0; }
    .pel__recherche app-icone { position: absolute; left: 0.75rem; color: var(--n-400); pointer-events: none; }
    .pel__recherche input { padding-left: 2.2rem; }
    .pel__filtres { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .pel__filtre { font: inherit; font-size: var(--text-sm); font-weight: 500; padding: 0.45rem 0.95rem; border-radius: var(--radius-md); border: 1px solid var(--n-300); background: var(--carte-fond); color: var(--n-700); cursor: pointer; }
    .pel__filtre:hover { background: var(--n-100); }
    .pel__filtre--actif { background: var(--p-100); border-color: var(--p-400); color: var(--p-800); }
    .pel__aucune { display: flex; gap: 0.6rem; align-items: center; color: var(--n-600); font-size: var(--text-sm); }

    .pel { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
    .pel__ligne { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1rem; align-items: center; padding: 1rem 1.2rem 1rem 1.5rem;
      background: var(--carte-fond); border: 1px solid var(--n-200); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); transition: border-color .15s, box-shadow .15s; }
    .pel__ligne::before { content: ''; position: absolute; left: 0.6rem; top: 0.9rem; bottom: 0.9rem; width: 4px; border-radius: 2px; background: var(--success-text); }
    .pel__ligne[data-etat='A_VENIR']::before { background: var(--or); }
    .pel__ligne[data-etat='CLOSE']::before { background: var(--n-300); }
    .pel__ligne:hover, .pel__ligne:focus-within { border-color: var(--p-300); box-shadow: var(--shadow-md); }
    .pel__corps { display: flex; flex-direction: column; gap: 0.4rem; min-width: 0; }
    .pel__haut { margin: 0; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .pel__ref { font-size: var(--text-sm); color: var(--n-500); }
    .pel__badge { font-size: var(--text-xs); font-weight: 500; padding: 0.1rem 0.6rem; border-radius: var(--radius-full); background: var(--favorable-fond); color: var(--favorable-texte); }
    .pel__badge[data-etat='A_VENIR'] { background: var(--examen-fond); color: var(--examen-texte); }
    .pel__badge[data-etat='CLOSE'] { background: var(--n-100); color: var(--n-600); }
    .pel__objet { margin: 0; font-size: 1.05rem; line-height: 1.35; }
    .pel__objet a { color: var(--n-800); text-decoration: none; }
    .pel__objet a:hover { color: var(--p-700); text-decoration: underline; }
    .pel__meta { margin: 0; display: flex; flex-wrap: wrap; gap: 0.3rem 1.2rem; font-size: var(--text-sm); color: var(--n-500); }
    .pel__meta span, .pel__cloture { display: inline-flex; gap: 0.35rem; align-items: center; }
    .pel__echeance { display: flex; gap: 0.9rem; align-items: center; flex-wrap: wrap; }
    .pel__barre { flex: 1 1 12rem; max-width: 28rem; height: 6px; border-radius: 3px; background: var(--n-100); overflow: hidden; }
    .pel__barre > span { display: block; height: 100%; background: var(--success-text); border-radius: 3px; }
    .pel__cloture { margin: 0; font-size: var(--text-sm); color: var(--n-600); }
    .pel__droite { display: flex; flex-direction: column; align-items: flex-end; gap: 0.6rem; }
    .pel__jours { margin: 0; display: flex; flex-direction: column; align-items: flex-end; line-height: 1.1; }
    .pel__jours strong { font-size: 1.7rem; color: var(--n-800); }
    .pel__jours span { font-size: var(--text-xs); color: var(--n-500); }
    .pel__droite .btn { display: inline-flex; gap: 0.3rem; align-items: center; }

    @media (max-width: 640px) {
      .pel__compteurs { grid-template-columns: 1fr 1fr; }
      .pel__compteur:last-child { grid-column: 1 / -1; }
      .pel__ligne { grid-template-columns: 1fr; }
      .pel__droite { flex-direction: row; justify-content: space-between; align-items: center; }
      .pel__jours { align-items: flex-start; }
    }
  `,
})
export class ProceduresEnLigne implements OnInit {
  private readonly service = inject(ProceduresEnLigneService);
  private readonly amisService = inject(AmisEnLigneService);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  readonly etats = LIBELLES_ETAT_PROCEDURE;
  readonly dateHeure = dateHeureFr;
  readonly connecte = computed(() => this.auth.isAuthenticated() && this.auth.role() === 'CANDIDAT');

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly procedures = signal<ProcedureEnLigne[]>([]);
  readonly amis = signal<AmiPublic[]>([]);

  readonly texte = signal('');
  readonly filtre = signal<FiltreProcedures>('TOUTES');
  readonly filtresDispo: readonly { cle: FiltreProcedures; libelle: string }[] = [
    { cle: 'TOUTES', libelle: 'Toutes' },
    { cle: 'OUVERTE', libelle: 'Ouvertes' },
    { cle: 'A_VENIR', libelle: 'À venir' },
  ];
  readonly lignes = computed(() => lignesProcedures(this.procedures(), this.amis(), LIBELLES_CATEGORIES));
  readonly compteurs = computed(() => compteursProcedures(this.lignes()));
  readonly visibles = computed(() => filtrerProcedures(this.lignes(), this.texte(), this.filtre()));

  libelleEtat(etat: 'OUVERTE' | 'A_VENIR' | 'CLOSE', genre: 'AO' | 'AMI'): string {
    return genre === 'AMI' ? (etat === 'OUVERTE' ? 'Manifestation ouverte' : 'Close') : this.etats[etat];
  }

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
