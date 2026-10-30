import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ProceduresEnLigneStore } from '../../core/procedures/procedures-en-ligne.store';
import { ProcedureInterne } from '../../models';
import { FicheMarcheService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_ETAT_CAO, LIBELLES_ETAT_CEREMONIE } from '../cao/libelles-cao';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { etapesProcedure, prochaineEtape } from './procedure-etapes';

const LIBELLES_ETAT: Readonly<Record<ProcedureInterne['etat'], string>> = {
  NON_LANCEE: 'Non lancée',
  A_VENIR: 'Dépôts à venir',
  OUVERTE: 'Dépôts ouverts',
  CLOSE: 'Dépôts clos',
};
const LIBELLES_FICHE: Readonly<Record<ProcedureInterne['statutFiche'], string>> = {
  BROUILLON: 'fiche en brouillon',
  VALIDEE: 'fiche validée',
  REVISION: 'fiche en révision',
};
const LIBELLES_SEANCE: Readonly<Record<string, string>> = {
  A_VENIR: 'à ouvrir',
  OUVERTE: 'ouverte',
  DECHIFFREE: 'offres ouvertes',
  PV_A_SIGNER: 'PV à signer',
  ILLISIBLE: 'quorum impossible',
  CLOSE: 'close',
};

/**
 * ⚠️ 06/10 — **Mes procédures en ligne** (`GET /api/fiches-marche/en-ligne`) : pour le **responsable** de la procédure, celles
 * qu'il conduit — paramètres internes et cérémonie des clés, puis séance d'ouverture ; pour l'**Administrateur**, toutes les
 * procédures en remise électronique, et celles qui attendent un responsable. L'intérimaire d'un titulaire voit sa procédure mais
 * ne la conduit pas (le serveur réserve ces gestes au titulaire) : l'écran le dit, sans lien d'action.
 */
@Component({
  selector: 'app-procedures-en-ligne',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    <section class="pl">
      <header class="page-header">
        <div class="page-subtitle">Soumission électronique</div>
        <h1 class="page-title">{{ admin() ? 'Procédures en ligne' : 'Mes procédures en ligne' }}</h1>
      </header>
      <p class="page-role">
        @if (admin()) {
          Toutes les procédures en remise électronique : désignez le responsable de celles qui n’en ont pas (depuis la fiche), suivez la cérémonie des clés et les séances.
        } @else {
          Les procédures dont vous êtes le responsable : réglez les paramètres internes et conduisez la cérémonie des clés, puis la séance d’ouverture des plis.
        }
      </p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des procédures…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="La liste des procédures n'a pas pu être chargée." (reessayer)="charger()" />
      } @else if (!procedures().length) {
        <div class="empty-state">
          <p class="empty-state-title">Aucune procédure en ligne.</p>
          <p class="empty-state-text">{{ admin() ? 'Aucune fiche n’est en remise électronique.' : 'Vous n’êtes le responsable d’aucune procédure en remise électronique.' }}</p>
        </div>
      } @else {
        <p class="text-sm"><strong>{{ aTraiter() }}</strong> à traiter · {{ procedures().length }} au total@if (admin() && sansResponsable()) { · <strong>{{ sansResponsable() }}</strong> sans responsable }</p>
        @if (!admin()) {
          <!-- ⚠️ 28/10 (pilote : « améliorer la présentation ») — le responsable lit une carte par procédure : où en est-elle (frise),
               qui doit agir maintenant, et le geste utile en bouton principal. L'Administrateur garde le tableau, fait pour comparer. -->
          <ul class="pc">
            @for (p of procedures(); track p.idDmc) {
              @let suite = prochaine(p);
              <li class="pc__carte" [class.pc__carte--a-traiter]="p.aTraiter">
                <div class="pc__tete">
                  <div class="pc__id">
                    <h2 class="pc__objet">{{ p.objet || 'Procédure ' + p.idDmc }}</h2>
                    <p class="pc__ref"><span class="cnm-mono">{{ p.reference || 'n° ' + p.idDmc }}</span> · {{ p.autoriteContractante }}</p>
                  </div>
                  <div class="pc__badges">
                    <span class="badge" [class.badge-success]="p.etat === 'OUVERTE'" [class.badge-neutral]="p.etat !== 'OUVERTE'">{{ etats[p.etat] }}</span>
                    @if (p.aTraiter) { <span class="badge badge-warning">à traiter</span> }
                    @if (p.parInterim) { <span class="badge badge-info">par intérim — lecture seule</span> }
                  </div>
                </div>
                <ol class="pc__frise" aria-label="Étapes de la procédure">
                  @for (e of etapes(p); track e.libelle) {
                    <li class="pc__etape" [class.pc__etape--fait]="e.etat === 'fait'" [class.pc__etape--encours]="e.etat === 'encours'"
                      [attr.aria-current]="e.etat === 'encours' ? 'step' : null">
                      <span class="pc__pt" aria-hidden="true"></span>
                      <span class="pc__etape-l">{{ e.libelle }}</span>
                      <span class="pc__etape-d">{{ e.detail }}</span>
                    </li>
                  }
                </ol>
                <div class="pc__pied">
                  <p class="pc__suite"><span class="pc__qui">Prochaine étape · {{ suite.qui }}</span>{{ suite.texte }}</p>
                  @if (!p.parInterim) {
                    <div class="pc__gestes">
                      <a class="btn btn-sm" [class.btn-primary]="suite.geste === 'parametres'" [class.btn-outline]="suite.geste !== 'parametres'"
                        [routerLink]="['/procedure', p.idDmc, 'parametres-internes']">Paramètres et cérémonie</a>
                      @if (p.etatSeance || p.etat === 'CLOSE') {
                        <a class="btn btn-sm" [class.btn-primary]="suite.geste === 'seance'" [class.btn-outline]="suite.geste !== 'seance'"
                          [routerLink]="['/procedure', p.idDmc, 'seance']">Séance d’ouverture</a>
                      }
                    </div>
                  }
                </div>
              </li>
            }
          </ul>
        } @else {
        <div class="cnm-table-wrap">
          <table class="cnm-table pl__table">
            <caption class="cnm-sr-only">Procédures en remise électronique, à traiter d'abord</caption>
            <thead>
              <tr>
                <th scope="col">Procédure</th>
                <th scope="col">État</th>
                <th scope="col">Calendrier</th>
                <th scope="col">Commission · cérémonie</th>
                <th scope="col">Séance</th>
                @if (admin()) { <th scope="col">Responsable</th> }
                <th scope="col"><span class="cnm-sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (p of procedures(); track p.idDmc) {
                <tr [class.pl__a-traiter]="p.aTraiter">
                  <td>
                    <span class="cnm-mono pl__ref">{{ p.reference || 'Procédure ' + p.idDmc }}</span>
                    <div>{{ p.objet || '—' }}</div>
                    <div class="text-xs text-muted">{{ p.autoriteContractante }}</div>
                    @if (p.aTraiter) { <span class="badge badge-warning">à traiter</span> }
                    @if (p.parInterim) { <span class="badge badge-info">par intérim — lecture seule</span> }
                  </td>
                  <td>
                    <span class="badge" [class.badge-success]="p.etat === 'OUVERTE'" [class.badge-neutral]="p.etat !== 'OUVERTE'">{{ etats[p.etat] }}</span>
                    <div class="text-xs text-muted">{{ fiches[p.statutFiche] }}</div>
                    @if (p.etat !== 'NON_LANCEE') { <div class="text-xs">{{ p.nbOffres }} {{ p.nbOffres > 1 ? 'offres' : 'offre' }}</div> }
                  </td>
                  <td class="text-sm">
                    @if (p.datePublication) { <div>Avis : {{ date(p.datePublication) }}</div> }
                    @if (p.dateLimite) { <div>Date limite : <strong>{{ dateHeure(p.dateLimite) }}</strong></div> }
                    @if (p.dateOuverturePlis) { <div>Ouverture : {{ dateHeure(p.dateOuverturePlis) }}</div> }
                  </td>
                  <td class="text-sm">
                    <div>Commission : {{ p.etatCao ? (caos[p.etatCao] ?? p.etatCao) : '—' }}</div>
                    <div>Cérémonie : {{ p.etatCeremonie ? (ceremonies[p.etatCeremonie] ?? p.etatCeremonie) : '—' }}</div>
                  </td>
                  <td class="text-sm">{{ p.etatSeance ? (seances[p.etatSeance] ?? p.etatSeance) : '—' }}</td>
                  @if (admin()) {
                    <td class="text-sm">@if (p.responsable; as r) { {{ r.nom }} } @else { <strong class="pl__manque">à désigner</strong> }</td>
                  }
                  <td><div class="pl__actions">
                    @if (!p.parInterim && !admin()) {
                      <a class="btn btn-sm btn-outline" [routerLink]="['/procedure', p.idDmc, 'parametres-internes']">Paramètres et cérémonie</a>
                      @if (p.etatSeance || p.etat === 'CLOSE') {
                        <a class="btn btn-sm btn-primary" [routerLink]="['/procedure', p.idDmc, 'seance']">Séance</a>
                      }
                    }
                    @if (admin()) {
                      <a class="btn btn-sm" [class.btn-primary]="!p.responsable" [class.btn-outline]="!!p.responsable" [routerLink]="['/admin', 'dao', p.idDmc]">{{ p.responsable ? 'Ouvrir la fiche' : 'Désigner le responsable' }}</a>
                      @if (p.responsable?.im === monMatricule()) {
                        <a class="btn btn-sm btn-outline" [routerLink]="['/procedure', p.idDmc, 'parametres-internes']">Paramètres et cérémonie</a>
                        @if (p.etatSeance || p.etat === 'CLOSE') { <a class="btn btn-sm btn-outline" [routerLink]="['/procedure', p.idDmc, 'seance']">Séance</a> }
                      }
                    }
                  </div></td>
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
    .pl { display: flex; flex-direction: column; gap: 0.75rem; }
    .pl__table td { white-space: normal; vertical-align: top; }
    .pl__ref { font-size: var(--text-xs); color: var(--p-700); }
    .pl__a-traiter td { background: var(--warning-bg, #fff8e6); }
    .pl__manque { color: var(--danger-text); }
    .pl__actions { display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-end; }
    .pl__actions .btn { white-space: nowrap; }
    /* ⚠️ 28/10 — la carte du responsable. */
    .pc { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.9rem; }
    .pc__carte { background: #fff; border: 1px solid var(--n-200); border-radius: 12px; padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 1rem; }
    .pc__carte--a-traiter { border-left: 4px solid var(--warning-text); }
    .pc__tete { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: flex-start; }
    .pc__id { min-width: 0; flex: 1 1 28rem; }
    .pc__objet { margin: 0; font-size: var(--text-base, 1rem); font-weight: 700; color: var(--n-800); line-height: 1.35; }
    .pc__ref { margin: 0.25rem 0 0; font-size: var(--text-sm); color: var(--n-500); }
    .pc__ref .cnm-mono { color: var(--p-700); }
    .pc__badges { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .pc__frise { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.5rem; }
    .pc__etape { position: relative; display: flex; flex-direction: column; gap: 0.15rem; padding-top: 1.1rem; font-size: var(--text-sm); color: var(--n-500); }
    .pc__etape::before { content: ''; position: absolute; top: 5px; left: 14px; right: -0.5rem; height: 2px; background: var(--n-200); }
    .pc__etape:last-child::before { display: none; }
    .pc__etape--fait::before { background: var(--success-text, #059669); }
    .pc__pt { position: absolute; top: 0; left: 0; width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--n-300); background: #fff; z-index: 1; }
    .pc__etape--fait .pc__pt { background: var(--success-text, #059669); border-color: var(--success-text, #059669); }
    .pc__etape--encours .pc__pt { background: var(--bouton-principal); border-color: var(--bouton-principal); box-shadow: 0 0 0 4px var(--p-100); }
    .pc__etape-l { font-weight: 600; color: var(--n-700); }
    .pc__etape--encours .pc__etape-l { color: var(--p-700); }
    .pc__etape-d { font-size: var(--text-xs); color: var(--n-500); }
    .pc__pied { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem 1rem; flex-wrap: wrap; border-top: 1px solid var(--n-100); padding-top: 0.8rem; }
    .pc__suite { margin: 0; flex: 1 1 22rem; color: var(--n-700); font-size: var(--text-sm); }
    .pc__qui { display: block; font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--n-500); margin-bottom: 0.15rem; }
    .pc__gestes { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    @media (max-width: 48rem) {
      .pc__frise { grid-template-columns: 1fr; }
      .pc__etape { padding: 0 0 0 1.4rem; }
      .pc__etape::before { top: 14px; left: 5px; right: auto; width: 2px; height: calc(100% + 0.5rem); }
    }
  `,
})
export class ProceduresEnLigne implements OnInit {
  private readonly service = inject(FicheMarcheService);
  private readonly store = inject(ProceduresEnLigneStore);
  private readonly auth = inject(AuthService);

  readonly etats = LIBELLES_ETAT;
  readonly fiches = LIBELLES_FICHE;
  readonly seances = LIBELLES_SEANCE;
  readonly caos: Readonly<Record<string, string>> = LIBELLES_ETAT_CAO;
  readonly ceremonies: Readonly<Record<string, string>> = LIBELLES_ETAT_CEREMONIE;
  readonly dateHeure = dateHeureFr;
  readonly etapes = etapesProcedure;
  readonly prochaine = prochaineEtape;

  readonly admin = computed(() => this.auth.role() === 'ADMINISTRATEUR');
  readonly monMatricule = this.auth.ref;
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly procedures = signal<ProcedureInterne[]>([]);
  readonly aTraiter = computed(() => this.procedures().filter((p) => p.aTraiter).length);
  readonly sansResponsable = computed(() => this.procedures().filter((p) => !p.responsable).length);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.enLigne().subscribe({
      next: (l) => {
        this.procedures.set(l);
        this.store.liste.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  date(iso: string): string {
    return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('fr-FR');
  }
}
