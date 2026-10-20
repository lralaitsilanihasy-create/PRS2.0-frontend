import { DatePipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiError, codeErreur, corpsErreur } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { TYPES_DOCX, telechargerBlob, validerFichier } from '../../../core/securite/fichiers-surs';
import { CatalogueModelePv, ChampModelePv, CouvertureSousType, ConditionModelePv, ModelePvFiche, SousTypeDossier, VersionModelePv } from '../../../models';
import { ModelePvService, SousTypeDossierService, TypeDossierService } from '../../../services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { ApercuVersion } from './apercu-version';
import { CatalogueVariables } from './catalogue-variables';
import { ChampsVersion } from './champs-version';
import { ConditionsVersion } from './conditions-version';
import { LIBELLES_ACTION, LIBELLES_ETAT_VERSION, LIBELLES_NATURE, MOTIF_CODE_MODELE, reprisParModele, tailleLisible } from './modeles-pv-libelles';
import { RapportControlePv } from './rapport-controle-pv';

type Onglet = 'depot' | 'variables' | 'champs' | 'apercu';
type Modale = 'vigueur' | 'dupliquer' | 'archiver' | null;

const FAMILLES: Readonly<Record<string, string>> = {
  DDP: 'Plan de passation',
  DMC: 'Dossier de mise en concurrence',
  DDM: 'Dossier de marché',
};
const BADGE_ETAT: Readonly<Record<string, string>> = { BROUILLON: 'badge-warning', EN_VIGUEUR: 'badge-success', REMPLACEE: 'badge-neutral' };
const TAILLE_MAX_MO = 10;

/**
 * ⚠️ Générateur de modèles de PV, lot G1 (V138, 20/10 ; maquette, écrans 2 à 6) — la fiche d'un modèle : ses versions (déposer
 * un `.docx`, lire le rapport de contrôle, déclarer conditions et champs sur un brouillon, essayer sur un dossier réel, mettre en
 * vigueur avec un motif), les sous-types qu'il sert, son historique. Une version en vigueur ou remplacée est figée.
 */
@Component({
  selector: 'app-modele-pv-fiche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LowerCasePipe, RouterLink, EtatErreur, ModaleDirective, RapportControlePv, ConditionsVersion, ChampsVersion, ApercuVersion, CatalogueVariables],
  template: `
    <section class="mpf">
      <a class="mpf__retour" routerLink="/admin/referentiels/modeles-pv">← Tous les modèles de PV</a>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger ce modèle de PV." (reessayer)="charger()" />
      } @else if (fiche(); as f) {
        <header class="mpf__bandeau">
          <small>{{ f.nature === 'PV' ? 'MODÈLE DE PV' : 'MODÈLE DE LETTRE DE RENVOI' }} · {{ f.code }}</small>
          <h1>{{ f.libelle }}</h1>
          <div class="mpf__puces">
            @for (s of f.sousTypes; track s.id) { <span class="mpf__puce">{{ s.id }}</span> }
            @if (!f.sousTypes.length) { <span class="mpf__puce">aucun sous-type servi</span> }
            <span class="mpf__puce mpf__puce--claire">Version en vigueur : {{ enVigueur() ? 'v' + enVigueur()!.numero : 'aucune' }}</span>
            @if (f.etat === 'ARCHIVE') { <span class="mpf__puce mpf__puce--claire">Archivé le {{ f.archiveLe | date: 'dd/MM/yyyy' }}</span> }
          </div>
          @if (f.etat === 'ACTIF') {
            <button type="button" class="btn btn-secondary btn-sm mpf__archiver" (click)="ouvrirModale('archiver')">Archiver</button>
          }
        </header>
        @if (repris().length) {
          <p class="alert alert-info">
            <span>
              {{ repris().join(' · ') }} {{ repris().length > 1 ? 'sont encore servis' : 'est encore servi' }} par les <strong>fichiers intégrés</strong> de l’application.
              Ce modèle les remplacera quand le générateur produira les PV, une fois ses rendus comparés à ceux des fichiers actuels sur des
              dossiers réels (« Aperçu sur un dossier »). D’ici là, sa mise en vigueur ne change aucun PV.
            </span>
          </p>
        }
        @if (f.etat === 'ARCHIVE' && f.motifArchivage) { <p class="alert alert-info"><span>Motif de l’archivage : {{ f.motifArchivage }}</span></p> }

        <div class="mpf__grille">
          <div class="card mpf__carte">
            <h2 class="mpf__titre">Versions</h2>
            @if (f.versions.length) {
              <table class="mpf__table">
                <thead><tr><th scope="col">Version</th><th scope="col">État</th><th scope="col">Déposée</th><th scope="col"><span class="cnm-sr-only">Actions</span></th></tr></thead>
                <tbody>
                  @for (v of f.versions; track v.numero) {
                    <tr [class.mpf__choisie]="v.numero === version()?.numero">
                      <td><strong>v{{ v.numero }}</strong></td>
                      <td>
                        <span [class]="'badge ' + badgeEtat[v.etat]">{{ etats[v.etat] }}</span>
                        @if (v.bloquant) { <span class="badge badge-danger">bloquant</span> }
                      </td>
                      <td>{{ v.deposeeLe | date: 'dd/MM/yyyy' }} par {{ v.deposeePar }}</td>
                      <td class="mpf__actions-ligne">
                        <button type="button" class="btn btn-secondary btn-sm" (click)="essayer(v.numero)">Essayer</button>
                        @if (v.etat === 'BROUILLON' && f.etat === 'ACTIF') {
                          <button type="button" class="btn btn-primary btn-sm" [disabled]="v.bloquant" (click)="mettreEnVigueurVersion(v.numero)"
                                  [attr.title]="v.bloquant ? 'Le rapport de contrôle est bloquant' : null">Mettre en vigueur</button>
                        } @else if (v.numero !== version()?.numero) {
                          <button type="button" class="btn btn-ghost btn-sm" (click)="choisir(v.numero)">Voir</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="text-muted">Aucune version : rédigez le PV dans Word avec les variables du catalogue, puis déposez-le.</p>
            }
            <p class="mpf__note">Une version en vigueur ne se modifie pas : on en dépose une nouvelle, avec un motif. Les PV signés gardent la version qui les a produits.</p>
            @if (messageDepot(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
            <div class="mpf__boutons">
              @if (f.etat === 'ACTIF') {
                <label class="btn btn-secondary btn-sm mpf__depot" [class.mpf__depot--off]="depot()">
                  {{ depot() ? 'Dépôt et contrôle…' : f.versions.length ? 'Déposer une nouvelle version (.docx)' : 'Déposer la première version (.docx)' }}
                  <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="cnm-sr-only"
                         [disabled]="depot()" (change)="deposer($event)" />
                </label>
              }
              @if (version(); as v) { <button type="button" class="btn btn-secondary btn-sm" (click)="telecharger(v)">Télécharger le .docx</button> }
              @if (f.etat === 'ACTIF' && f.versions.length) { <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirModale('dupliquer')">Dupliquer le modèle</button> }
            </div>
          </div>

          <div class="card mpf__carte">
            <div class="mpf__titre-ligne">
              <h2 class="mpf__titre">Sous-types servis</h2>
              @if (famillesSousTypes().length > 1) {
                <select class="form-control mpf__famille-choix" aria-label="Famille de dossiers" [value]="famille()" (change)="famille.set($any($event.target).value)">
                  @for (g of famillesSousTypes(); track g.famille) { <option [value]="g.famille" [selected]="g.famille === famille()">{{ g.libelle }}</option> }
                </select>
              }
            </div>
            <div class="mpf__sts">
              @for (s of sousTypesDeLaFamille(); track s.idSousType) {
                <label class="mpf__st">
                  <input type="checkbox" [checked]="rattaches().includes(s.idSousType)" [disabled]="f.etat === 'ARCHIVE'"
                         (change)="basculerSousType(s.idSousType, $any($event.target).checked)" />
                  <span>{{ s.idSousType }} — {{ s.libelleSousType }}</span>
                </label>
              }
            </div>
            @if (autresRattaches().length) { <p class="mpf__note">Aussi servis, dans une autre famille : {{ autresRattaches().join(' · ') }}.</p> }
            <p class="mpf__note">Un sous-type n’a qu’un modèle en vigueur à la fois.</p>
            @if (messageRattachement(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
            @if (f.etat === 'ACTIF' && rattachementsModifies()) {
              <button type="button" class="btn btn-primary btn-sm mpf__enreg" [disabled]="ecriture()" (click)="enregistrerRattachements()">Enregistrer les sous-types</button>
            }

            <h2 class="mpf__titre mpf__titre--histo">Historique</h2>
            <ul class="mpf__histo">
              @for (h of f.historique; track $index) {
                <li>
                  {{ h.le | date: 'dd/MM HH:mm' }} — {{ actions[h.action] ?? h.action }}@if (h.numeroVersion) { v{{ h.numeroVersion }}} par {{ h.par }}@if (h.detail) {, {{ h.detail }}}
                </li>
              } @empty { <li class="text-muted">Rien encore.</li> }
            </ul>
          </div>
        </div>

        @if (version(); as v) {
          <div class="card mpf__carte">
            <div class="mpf__titre-ligne">
              <h2 class="mpf__titre">Version {{ v.numero }} — {{ etats[v.etat] | lowercase }} · {{ v.nomFichier }} ({{ taille(v.taille) }})</h2>
              @if (v.etat !== 'BROUILLON') {
                <span class="mpf__note">Figée@if (v.enVigueurLe) {, en vigueur le {{ v.enVigueurLe | date: 'dd/MM/yyyy' }} par {{ v.enVigueurPar }}}@if (v.remplaceeLe) {, remplacée le {{ v.remplaceeLe | date: 'dd/MM/yyyy' }}}@if (v.motif) { — « {{ v.motif }} »}</span>
              }
            </div>
            <div class="mpf__onglets" role="tablist" aria-label="Contenu de la version">
              @for (o of onglets; track o.cle; let i = $index) {
                <button type="button" role="tab" class="mpf__onglet" [class.mpf__onglet--on]="onglet() === o.cle" [attr.aria-selected]="onglet() === o.cle"
                        (click)="onglet.set(o.cle)">
                  {{ i + 1 }}. {{ o.libelle }}
                  @if (o.cle === 'depot' && v.rapport?.nbBloquants) { <span class="badge badge-danger">{{ v.rapport!.nbBloquants }}</span> }
                </button>
              }
            </div>
            <div role="tabpanel" class="mpf__panneau">
              @switch (onglet()) {
                @case ('depot') {
                  <div class="mpf__aide">
                    Rédigez le PV dans Word, avec ses variables (<code>{{ o }}PV.REFERENCE{{ f2 }}</code>), ses blocs conditionnels
                    (<code>{{ o }}SI:AVEC_RESERVES{{ f2 }} … {{ o }}FINSI:AVEC_RESERVES{{ f2 }}</code>) et ses lignes répétées
                    (<code>{{ o }}POUR:TITULAIRES{{ f2 }}</code>). Les anciens marqueurs du métier (<code>&lt;REFERENCE PV&gt;</code>,
                    <code>&lt;CHEF LIEU&gt;</code>…) restent acceptés. L’emblème et les images s’insèrent directement dans le Word.
                  </div>
                  <h3 class="mpf__titre">Rapport de contrôle — {{ v.nomFichier }}</h3>
                  <app-rapport-controle-pv [rapport]="v.rapport" />
                }
                @case ('variables') {
                  <div class="mpf__deux">
                    <div>
                      <h3 class="mpf__titre">Catalogue des variables@if (catalogue()?.famille; as fam) { — {{ libelleFamille(fam) }}}</h3>
                      <app-catalogue-variables [catalogue]="catalogue()" />
                    </div>
                    <div>
                      <h3 class="mpf__titre">Conditions de la version</h3>
                      <app-conditions-version [conditions]="v.conditions" [catalogue]="catalogue()" [champs]="codesChamps()"
                                              [utilisees]="v.rapport?.conditionsUtilisees ?? []" [figee]="figee()"
                                              [enregistrement]="ecriture()" [erreurs]="messageConditions()" (enregistrer)="enregistrerConditions($event)" />
                    </div>
                  </div>
                }
                @case ('champs') {
                  <h3 class="mpf__titre">Champs saisis par le membre à l’examen</h3>
                  <app-champs-version [champs]="v.champs" [conditions]="nomsConditions()" [utilises]="v.rapport?.champsUtilises ?? []"
                                      [figee]="figee()" [enregistrement]="ecriture()" [erreurs]="messageChamps()" (enregistrer)="enregistrerChamps($event)" />
                }
                @case ('apercu') {
                  <app-apercu-version [idModele]="f.id" [numero]="v.numero" [champs]="v.champs" [codeModele]="f.code"
                                      [sousTypesServis]="codesSousTypes()" />
                }
              }
            </div>
          </div>
        }
      }
    </section>

    @if (modale(); as m) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="titreModale()" appModale (appModaleFermer)="fermerModale()">
          <div class="modal-header">
            <h2 class="modal-title">{{ titreModale() }}</h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerModale()">✕</button>
          </div>
          <div class="modal-body mpf__form">
            @switch (m) {
              @case ('vigueur') {
                <p>
                  La version {{ version()?.numero }} servira aux PV à venir des sous-types de ce modèle.
                  @if (enVigueur(); as ev) { La version {{ ev.numero }} passera « remplacée ». } Les PV déjà signés gardent la version qui les a produits.
                </p>
                <label class="form-group">
                  <span class="form-label">Motif (obligatoire)</span>
                  <textarea class="form-control" rows="3" [value]="motif()" (input)="motif.set($any($event.target).value)"></textarea>
                </label>
              }
              @case ('dupliquer') {
                <p>La copie reprend la version en vigueur (à défaut la dernière), ses conditions et ses champs, en brouillon v1, sans sous-type servi.</p>
                <label class="form-group">
                  <span class="form-label">Code de la copie</span>
                  <input class="form-control" [value]="codeCopie()" (input)="codeCopie.set($any($event.target).value)" />
                </label>
                <label class="form-group">
                  <span class="form-label">Libellé de la copie</span>
                  <input class="form-control" [value]="libelleCopie()" (input)="libelleCopie.set($any($event.target).value)" />
                </label>
              }
              @case ('archiver') {
                <p>Un modèle archivé est détaché de ses sous-types et ne reçoit plus de version.
                  @if (enService()) { <strong>Il sert aujourd’hui {{ fiche()?.sousTypes?.length }} sous-type(s) : leurs PV n’auront plus de modèle.</strong> }
                </p>
                <label class="form-group">
                  <span class="form-label">Motif{{ enService() ? ' (obligatoire)' : ' (facultatif)' }}</span>
                  <textarea class="form-control" rows="3" [value]="motif()" (input)="motif.set($any($event.target).value)"></textarea>
                </label>
              }
            }
            @if (messageModale(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="fermerModale()">Annuler</button>
            <button type="button" class="btn" [class.btn-primary]="m !== 'archiver'" [class.btn-danger]="m === 'archiver'"
                    [disabled]="ecriture() || !modaleValide()" (click)="validerModale()">
              {{ ecriture() ? 'Enregistrement…' : m === 'vigueur' ? 'Mettre en vigueur' : m === 'dupliquer' ? 'Dupliquer' : 'Archiver' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .mpf { display: flex; flex-direction: column; gap: 1rem; }
    .mpf__retour { align-self: flex-start; font-size: 0.85rem; font-weight: 600; color: var(--p-700); text-decoration: none; }
    .mpf__retour:hover { text-decoration: underline; }
    .mpf__bandeau { position: relative; background: linear-gradient(120deg, #075985, var(--p-600)); color: #fff; border-radius: 14px; padding: 1rem 1.25rem; }
    .mpf__bandeau small { opacity: 0.9; font-weight: 700; letter-spacing: 0.06em; }
    .mpf__bandeau h1 { margin: 0.25rem 0 0.5rem; font-size: 1.3rem; color: #fff; }
    .mpf__puces { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .mpf__puce { padding: 0.1rem 0.6rem; border-radius: 999px; background: rgba(255, 255, 255, 0.18); font-size: 0.8rem; }
    .mpf__puce--claire { background: #fff; color: var(--p-700); font-weight: 600; }
    .mpf__archiver { position: absolute; top: 1rem; right: 1.25rem; }
    .mpf__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr)); gap: 1rem; align-items: start; }
    .mpf__carte { padding: 1rem 1.15rem; display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
    .mpf__titre-ligne { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .mpf__titre { margin: 0; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--p-700); }
    .mpf__titre--histo { margin-top: 0.6rem; }
    .mpf__table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .mpf__table th { text-align: left; background: var(--p-50); color: var(--p-700); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.5rem 0.6rem; }
    .mpf__table td { padding: 0.55rem 0.6rem; border-top: 1px solid var(--n-100); vertical-align: middle; }
    .mpf__choisie td { background: var(--p-50); }
    .mpf__actions-ligne { text-align: right; white-space: nowrap; }
    .mpf__actions-ligne .btn + .btn { margin-left: 0.3rem; }
    .mpf__note { margin: 0; font-size: 0.8rem; color: var(--n-500); }
    .mpf__boutons { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .mpf__depot { cursor: pointer; }
    .mpf__depot--off { opacity: 0.6; pointer-events: none; }
    .mpf__depot:focus-within { outline: 2px solid var(--p-600); outline-offset: 2px; }
    .mpf__famille-choix { width: auto; max-width: 16rem; font-size: 0.85rem; }
    .mpf__sts { display: flex; flex-direction: column; gap: 0.3rem; }
    .mpf__st { display: flex; gap: 0.45rem; align-items: flex-start; font-size: 0.88rem; color: var(--n-700); }
    .mpf__st input { margin-top: 0.22rem; }
    .mpf__enreg { align-self: flex-start; }
    .mpf__histo { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; color: var(--n-700); max-height: 16rem; overflow: auto; }
    .mpf__onglets { display: flex; gap: 0.45rem; flex-wrap: wrap; border-bottom: 1px solid var(--n-200); padding-bottom: 0.7rem; }
    .mpf__onglet { font: inherit; font-size: 0.88rem; font-weight: 600; padding: 0.35rem 0.9rem; border: 1.5px solid #152033; border-radius: 999px;
      background: #fff; color: #152033; cursor: pointer; display: inline-flex; gap: 0.35rem; align-items: center; }
    .mpf__onglet--on { background: #152033; color: #fff; }
    .mpf__panneau { padding-top: 0.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .mpf__aide { background: var(--p-50); border-left: 3px solid var(--p-600); padding: 0.6rem 0.75rem; border-radius: 6px; font-size: 0.85rem; color: var(--n-700); }
    .mpf__deux { display: grid; grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr)); gap: 1.25rem; align-items: start; }
    .mpf__deux > div { display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
    .mpf__form { display: flex; flex-direction: column; gap: 0.75rem; }
    code { font-family: Consolas, monospace; font-size: 0.85em; }
    @media (max-width: 760px) { .mpf__archiver { position: static; margin-top: 0.6rem; } }
  `,
})
export class ModelePvFicheEcran implements OnInit {
  private readonly service = inject(ModelePvService);
  private readonly sousTypesService = inject(SousTypeDossierService);
  private readonly typesService = inject(TypeDossierService);
  private readonly libellesFamilles = signal<Record<string, string>>({});
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly route = inject(ActivatedRoute);
  /** Paramètre de route `:id` (une duplication rouvre la page sur la copie). */
  private readonly idCourant = signal(0);

  readonly natures = LIBELLES_NATURE;
  readonly etats = LIBELLES_ETAT_VERSION;
  readonly actions = LIBELLES_ACTION;
  readonly badgeEtat = BADGE_ETAT;
  readonly taille = tailleLisible;
  readonly onglets: readonly { cle: Onglet; libelle: string }[] = [
    { cle: 'depot', libelle: 'Dépôt et contrôle' },
    { cle: 'variables', libelle: 'Variables et conditions' },
    { cle: 'champs', libelle: 'Champs saisis au contrôle' },
    { cle: 'apercu', libelle: 'Aperçu sur un dossier' },
  ];
  readonly o = '{{';
  readonly f2 = '}}';

  readonly loading = signal(true);
  readonly erreur = signal(false);
  readonly fiche = signal<ModelePvFiche | null>(null);
  readonly catalogue = signal<CatalogueModelePv | null>(null);
  readonly sousTypes = signal<SousTypeDossier[]>([]);
  readonly numeroChoisi = signal<number | null>(null);
  readonly onglet = signal<Onglet>('depot');
  /** La famille dont la carte « Sous-types servis » montre les sous-types (par défaut, celle des sous-types servis). */
  readonly famille = signal<string>('');

  readonly depot = signal(false);
  readonly messageDepot = signal<string | null>(null);
  readonly ecriture = signal(false);
  readonly messageConditions = signal<string | null>(null);
  readonly messageChamps = signal<string | null>(null);
  readonly rattaches = signal<string[]>([]);
  readonly messageRattachement = signal<string | null>(null);

  readonly modale = signal<Modale>(null);
  readonly motif = signal('');
  readonly codeCopie = signal('');
  readonly libelleCopie = signal('');
  readonly messageModale = signal<string | null>(null);

  readonly version = computed<VersionModelePv | null>(() => {
    const vs = this.fiche()?.versions ?? [];
    return vs.find((v) => v.numero === this.numeroChoisi()) ?? vs[0] ?? null;
  });
  readonly enVigueur = computed(() => this.fiche()?.versions.find((v) => v.etat === 'EN_VIGUEUR') ?? null);
  readonly figee = computed(() => this.version()?.etat !== 'BROUILLON' || this.fiche()?.etat === 'ARCHIVE');
  readonly codesChamps = computed(() => (this.version()?.champs ?? []).map((c) => c.code));
  readonly nomsConditions = computed(() => (this.version()?.conditions ?? []).map((c) => c.nom));
  readonly codesSousTypes = computed(() => (this.fiche()?.sousTypes ?? []).map((s) => s.id));
  /** Les sous-types servis encore produits par des fichiers intégrés (le plan, la lettre de renvoi). */
  readonly repris = computed(() => (this.fiche()?.etat === 'ACTIF' ? reprisParModele(this.couverture(), this.idModele) : []));
  /** La couverture servie (`/couverture`), relue à chaque application de la fiche (les rattachements la changent). */
  private readonly couverture = signal<CouvertureSousType[]>([]);
  readonly enService = computed(() => !!this.enVigueur() && !!this.fiche()?.sousTypes.length);

  readonly famillesSousTypes = computed(() => {
    const parFamille = new Map<string, SousTypeDossier[]>();
    for (const s of this.sousTypes()) parFamille.set(s.idTypeDossier, [...(parFamille.get(s.idTypeDossier) ?? []), s]);
    return [...parFamille.entries()].map(([famille, sousTypes]) => ({ famille, libelle: this.libellesFamilles()[famille] ?? FAMILLES[famille] ?? famille, sousTypes }));
  });

  readonly sousTypesDeLaFamille = computed(() => this.famillesSousTypes().find((g) => g.famille === this.famille())?.sousTypes ?? []);

  /** Sous-types cochés hors de la famille affichée : rappelés pour qu'aucun rattachement ne soit invisible. */
  readonly autresRattaches = computed(() => {
    const ici = new Set(this.sousTypesDeLaFamille().map((s) => s.idSousType));
    return this.rattaches().filter((s) => !ici.has(s));
  });

  readonly rattachementsModifies = computed(() => [...this.rattaches()].sort().join() !== [...this.codesSousTypes()].sort().join());

  readonly titreModale = computed(() =>
    this.modale() === 'vigueur' ? `Mettre en vigueur la version ${this.version()?.numero}` : this.modale() === 'dupliquer' ? 'Dupliquer le modèle' : 'Archiver le modèle',
  );
  readonly modaleValide = computed(() => {
    switch (this.modale()) {
      case 'vigueur':
        return !!this.motif().trim();
      case 'dupliquer':
        return MOTIF_CODE_MODELE.test(this.codeCopie().trim()) && !!this.libelleCopie().trim();
      case 'archiver':
        return !this.enService() || !!this.motif().trim();
      default:
        return false;
    }
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((pm) => {
      this.idCourant.set(Number(pm.get('id')));
      this.numeroChoisi.set(null);
      this.catalogue.set(null);
      this.fiche.set(null);
      this.charger();
    });
  }

  private get idModele(): number {
    return this.idCourant();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    forkJoin({ fiche: this.service.fiche(this.idModele), sousTypes: this.sousTypesService.listeSilencieuse(), familles: this.typesService.listeSilencieuse() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ fiche, sousTypes, familles }) => {
          this.sousTypes.set(sousTypes);
          this.libellesFamilles.set(Object.fromEntries(familles.map((t) => [t.idTypeDossier, t.libelleType ?? t.idTypeDossier])));
          this.appliquer(fiche);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.erreur.set(true);
        },
      });
  }

  /** Recharge la fiche après une écriture, en gardant la version affichée. */
  private recharger(numero?: number): void {
    this.service
      .fiche(this.idModele)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (f) => {
          if (numero != null) this.numeroChoisi.set(numero);
          this.appliquer(f);
        },
        error: () => this.erreur.set(true),
      });
  }

  private appliquer(f: ModelePvFiche): void {
    const avant = this.fiche()?.sousTypes.map((s) => s.id).join();
    this.fiche.set(f);
    this.service
      .couverture()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.couverture.set(c), error: () => this.couverture.set([]) });
    this.rattaches.set(f.sousTypes.map((s) => s.id));
    const familleServie = f.sousTypes.find((s) => s.famille)?.famille;
    if (familleServie) this.famille.set(familleServie);
    else if (!this.famille()) this.famille.set(this.sousTypes()[0]?.idTypeDossier ?? '');
    // Le catalogue suit la famille du premier sous-type servi ; sans sous-type, tout le catalogue.
    if (this.catalogue() === null || avant !== f.sousTypes.map((s) => s.id).join()) {
      this.service
        .variables(f.sousTypes[0]?.id ?? null)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (c) => this.catalogue.set(c), error: () => this.catalogue.set(null) });
    }
  }

  libelleFamille(code: string): string {
    return this.libellesFamilles()[code] ?? FAMILLES[code] ?? code;
  }

  /** « Essayer » : la version choisie, ouverte sur son aperçu. */
  essayer(numero: number): void {
    this.choisir(numero);
    this.onglet.set('apercu');
  }

  mettreEnVigueurVersion(numero: number): void {
    this.choisir(numero);
    this.ouvrirModale('vigueur');
  }

  choisir(numero: number): void {
    this.numeroChoisi.set(numero);
    this.messageConditions.set(null);
    this.messageChamps.set(null);
  }

  deposer(ev: Event): void {
    const champ = ev.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (!fichier) return;
    const refus = validerFichier(fichier, TYPES_DOCX, TAILLE_MAX_MO);
    if (refus) {
      this.messageDepot.set(refus);
      return;
    }
    this.depot.set(true);
    this.messageDepot.set(null);
    this.service.deposer(this.idModele, fichier).subscribe({
      next: (v) => {
        this.depot.set(false);
        // Pas de boîte de confirmation : elle masquerait le rapport de contrôle, qui dit déjà le résultat du dépôt.
        this.onglet.set('depot');
        this.recharger(v.numero);
      },
      error: (e: ApiError) => {
        this.depot.set(false);
        const code = codeErreur(e);
        this.messageDepot.set(
          code === 'FICHIER_INVALIDE' ? e.message || 'Le fichier n’est pas un document Word (.docx) lisible.'
          : code === 'MODELE_ARCHIVE' ? 'Ce modèle est archivé : il ne reçoit plus de version.'
          : e.message || 'Le dépôt a échoué.',
        );
      },
    });
  }

  telecharger(v: VersionModelePv): void {
    this.service.fichier(this.idModele, v.numero).subscribe({
      next: (blob) => telechargerBlob(blob, v.nomFichier || `${this.fiche()?.code}-v${v.numero}.docx`),
      error: (e: ApiError) => this.toast.error(e.message || 'Le fichier n’a pas pu être téléchargé.'),
    });
  }

  enregistrerConditions(conditions: ConditionModelePv[]): void {
    const v = this.version();
    if (!v || this.ecriture()) return;
    this.ecriture.set(true);
    this.messageConditions.set(null);
    this.service.definirConditions(this.idModele, v.numero, conditions).subscribe({
      next: () => {
        this.ecriture.set(false);
        this.toast.success('Conditions enregistrées ; le rapport de contrôle est recalculé.');
        this.recharger(v.numero);
      },
      error: (e: ApiError) => {
        this.ecriture.set(false);
        this.messageConditions.set(this.messageAvecDetails(e, 'Les conditions n’ont pas été enregistrées.'));
      },
    });
  }

  enregistrerChamps(champs: ChampModelePv[]): void {
    const v = this.version();
    if (!v || this.ecriture()) return;
    this.ecriture.set(true);
    this.messageChamps.set(null);
    this.service.definirChamps(this.idModele, v.numero, champs).subscribe({
      next: () => {
        this.ecriture.set(false);
        this.toast.success('Champs enregistrés ; le rapport de contrôle est recalculé.');
        this.recharger(v.numero);
      },
      error: (e: ApiError) => {
        this.ecriture.set(false);
        this.messageChamps.set(this.messageAvecDetails(e, 'Les champs n’ont pas été enregistrés.'));
      },
    });
  }

  basculerSousType(id: string, coche: boolean): void {
    this.rattaches.update((l) => (coche ? [...new Set([...l, id])] : l.filter((x) => x !== id)));
    this.messageRattachement.set(null);
  }

  enregistrerRattachements(): void {
    if (this.ecriture()) return;
    this.ecriture.set(true);
    this.service.rattacher(this.idModele, this.rattaches()).subscribe({
      next: (f) => {
        this.ecriture.set(false);
        this.toast.success('Sous-types servis enregistrés.');
        this.appliquer(f);
      },
      error: (e: ApiError) => {
        this.ecriture.set(false);
        this.messageRattachement.set(
          codeErreur(e) === 'SOUS_TYPE_DEJA_SERVI'
            ? `${this.detailsEnClair(e, (st, code) => `${st} est servi par ${code}`)} : détachez-le d’abord de ce modèle.`
            : this.messageAvecDetails(e, 'Les sous-types n’ont pas été enregistrés.'),
        );
      },
    });
  }

  ouvrirModale(m: Exclude<Modale, null>): void {
    const f = this.fiche();
    this.motif.set('');
    this.codeCopie.set(f ? `${f.code}-COPIE` : '');
    this.libelleCopie.set(f ? `${f.libelle} (copie)` : '');
    this.messageModale.set(null);
    this.modale.set(m);
  }

  fermerModale(): void {
    this.modale.set(null);
  }

  validerModale(): void {
    const m = this.modale();
    if (!m || this.ecriture() || !this.modaleValide()) return;
    this.ecriture.set(true);
    this.messageModale.set(null);
    const fin = () => this.ecriture.set(false);
    const echec = (e: ApiError, defaut: string) => {
      fin();
      this.messageModale.set(this.messageAvecDetails(e, defaut));
    };
    if (m === 'vigueur') {
      const v = this.version()!;
      this.service.mettreEnVigueur(this.idModele, v.numero, this.motif().trim()).subscribe({
        next: () => {
          fin();
          this.modale.set(null);
          this.toast.success(`Version ${v.numero} en vigueur.`);
          this.recharger(v.numero);
        },
        error: (e: ApiError) =>
          codeErreur(e) === 'RAPPORT_BLOQUANT' ? echec(e, 'Le rapport de contrôle est bloquant : corrigez la version d’abord.') : echec(e, 'La mise en vigueur a échoué.'),
      });
    } else if (m === 'dupliquer') {
      this.service.dupliquer(this.idModele, { code: this.codeCopie().trim(), libelle: this.libelleCopie().trim() }).subscribe({
        next: (copie) => {
          fin();
          this.modale.set(null);
          this.toast.success(`Modèle dupliqué : ${copie.code}.`);
          void this.router.navigate(['/admin/referentiels/modeles-pv', copie.id]);
        },
        error: (e: ApiError) => echec(e, codeErreur(e) === 'CODE_DEJA_PRIS' ? 'Ce code est déjà pris.' : 'La duplication a échoué.'),
      });
    } else {
      this.service.archiver(this.idModele, this.motif().trim() || null).subscribe({
        next: (f) => {
          fin();
          this.modale.set(null);
          this.toast.success('Modèle archivé.');
          this.appliquer(f);
        },
        error: (e: ApiError) => echec(e, codeErreur(e) === 'MODELE_EN_SERVICE' ? 'Ce modèle est en service : un motif est exigé.' : 'L’archivage a échoué.'),
      });
    }
  }

  /** Le message du serveur, suivi de ses `details` (par nom de condition, de champ ou de sous-type). */
  private messageAvecDetails(e: ApiError, defaut: string): string {
    const details = this.detailsEnClair(e, (cle, val) => `${cle} : ${val}`);
    const base = e.message || defaut;
    return details ? `${base} (${details})` : base;
  }

  private detailsEnClair(e: ApiError, f: (cle: string, valeur: string) => string): string {
    const d = corpsErreur<{ details?: Record<string, unknown> | null }>(e)?.details;
    return d && typeof d === 'object' ? Object.entries(d).map(([k, v]) => f(k, String(v))).join(' ; ') : '';
  }
}
