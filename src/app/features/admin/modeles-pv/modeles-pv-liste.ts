import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';

import { ApiError, codeErreur } from '../../../core/errors/api-error';
import { CouvertureSousType, ModeleIntegre, ModelePvResume, NatureModelePv } from '../../../models';
import { ModelePvService, TypeDossierService } from '../../../services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { IntegreDetail } from './integre-detail';
import { BandeauRecommandation } from './liste/bandeau-recommandation';
import { BarreOutilsModeles } from './liste/barre-outils-modeles';
import { CarteCouverture } from './liste/carte-couverture';
import { EnTeteModeles } from './liste/en-tete-modeles';
import { ListeModeles } from './liste/liste-modeles';
import { FiltreEtat, LigneModele, Tri, construireLignes, couvertureSousTypes, filtrer, grouper, recommandation } from './liste/modeles-pv-vue';
import { LIBELLES_NATURE, MOTIF_CODE_MODELE, propositionPourFamille } from './modeles-pv-libelles';

/**
 * ⚠️ 21/10 (cahier du pilote, « Modèles de procès-verbaux ») — la page de l'Administrateur : en-tête, action recommandée, couverture
 * des sous-types, barre d'outils, puis une liste unique regroupée par état (à créer, à déposer, en service), dont chaque ligne déplie
 * son cycle de vie. Tout se calcule des trois routes servies (`/api/modeles-pv`, `/integres`, `/couverture`) — `liste/modeles-pv-vue.ts`.
 * Les modèles archivés sortent de la liste ; ils restent atteignables en pied de page.
 */
@Component({
  selector: 'app-modeles-pv-liste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, ModaleDirective, IntegreDetail, EnTeteModeles, BandeauRecommandation, CarteCouverture, BarreOutilsModeles, ListeModeles],
  template: `
    <div class="mpv">
      <app-en-tete-modeles (nouveau)="ouvrirCreation(null)" />

      @if (loading()) {
        <p class="mpv__etat" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les modèles de PV." (reessayer)="charger()" />
      } @else {
        @if (reco(); as r) { <app-bandeau-recommandation [reco]="r" (commencer)="commencer()" /> }
        <app-carte-couverture [couverture]="couvertureCalculee()" [filtre]="filtre()" (choisir)="filtre.set($event)" />
        <app-barre-outils-modeles [recherche]="recherche()" [filtre]="filtre()" [tri]="tri()"
                                  (rechercheChange)="recherche.set($event)" (filtreChange)="filtre.set($event)" (triChange)="tri.set($event)" />
        <app-liste-modeles [groupes]="groupes()" [ouverte]="ouverte()" (basculer)="basculer($event)" (action)="agir($event)" (fichiers)="voirFichiers($event)" />
        <p class="mpv__aide">Cliquez sur une ligne pour afficher son cycle de vie et tous ses sous-types.</p>

        @if (archives().length) {
          <details class="mpv__archives">
            <summary>Modèles archivés ({{ archives().length }})</summary>
            <ul>
              @for (a of archives(); track a.id) { <li><a [routerLink]="[a.id]">{{ a.libelle }}</a> <span>{{ a.code }}</span></li> }
            </ul>
          </details>
        }
      }
    </div>

    @if (integreConsulte(); as ic) { <app-integre-detail [modele]="ic" (fermer)="integreConsulte.set(null)" /> }

    @if (creation()) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Nouveau modèle de PV" appModale (appModaleFermer)="creation.set(false)">
          <div class="modal-header">
            <h2 class="modal-title">Nouveau modèle</h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="creation.set(false)">✕</button>
          </div>
          <div class="modal-body mpv__form">
            <label class="form-group">
              <span class="form-label">Libellé</span>
              <input class="form-control" [value]="libelle()" (input)="libelle.set($any($event.target).value)" placeholder="PV d’examen du dossier de marché" />
            </label>
            <label class="form-group">
              <span class="form-label">Code</span>
              <input class="form-control" [value]="code()" (input)="code.set($any($event.target).value)" placeholder="PV-MARCHE" />
              <span class="form-hint">Lettres, chiffres, « _ », « . » ou « - », 50 au plus. Il ne change plus.</span>
            </label>
            <fieldset class="form-group mpv__nature">
              <legend class="form-label">Nature</legend>
              @for (n of listeNatures; track n) {
                <label><input type="radio" name="nature" [checked]="nature() === n" (change)="nature.set(n)" /> {{ natures[n] }}</label>
              }
            </fieldset>
            @if (aRattacher().length) {
              <p class="form-hint">Le modèle servira d’emblée : <span class="mpv__mono">{{ aRattacher().join(' · ') }}</span> (modifiable sur la fiche).</p>
            }
            @if (messageCreation(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="creation.set(false)">Annuler</button>
            <button type="button" class="btn btn-primary" [disabled]="enCreation() || !creable()" (click)="creer()">
              {{ enCreation() ? 'Création…' : 'Créer le modèle' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .mpv { display: flex; flex-direction: column; gap: 16px; color: var(--text); }
    .mpv__etat { margin: 0; color: var(--text-muted); }
    .mpv__aide { margin: -6px 0 0; font-size: 12px; color: var(--text-muted); }
    .mpv__archives { font-size: 13px; color: var(--text-muted); }
    .mpv__archives summary { cursor: pointer; }
    .mpv__archives summary:focus-visible, .mpv__archives a:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .mpv__archives ul { margin: 6px 0 0; padding-left: 18px; }
    .mpv__archives a { color: var(--primary); }
    .mpv__form { display: flex; flex-direction: column; gap: 0.75rem; }
    .mpv__nature { border: 0; padding: 0; margin: 0; display: flex; gap: 1.25rem; flex-wrap: wrap; }
    .mpv__nature legend { width: 100%; }
    .mpv__mono { font-family: Consolas, monospace; font-size: 0.8rem; }
  `,
})
export class ModelesPvListe implements OnInit {
  private readonly service = inject(ModelePvService);
  private readonly typesService = inject(TypeDossierService);
  private readonly router = inject(Router);

  readonly natures = LIBELLES_NATURE;
  readonly listeNatures: readonly NatureModelePv[] = ['PV', 'LETTRE_RENVOI'];

  readonly loading = signal(true);
  readonly erreur = signal(false);
  private readonly modeles = signal<ModelePvResume[]>([]);
  private readonly couverture = signal<CouvertureSousType[]>([]);
  private readonly integres = signal<ModeleIntegre[]>([]);
  private readonly libellesFamilles = signal<Record<string, string>>({});

  readonly recherche = signal('');
  readonly filtre = signal<FiltreEtat>('tous');
  readonly tri = signal<Tri>('priorite');
  /** La ligne dont le détail est déplié (une seule à la fois). */
  readonly ouverte = signal<string | null>(null);
  /** Le modèle intégré consulté dans la modale. */
  readonly integreConsulte = signal<ModeleIntegre | null>(null);

  readonly lignes = computed(() => construireLignes(this.modeles(), this.integres(), this.couverture(), this.libellesFamilles()));
  readonly couvertureCalculee = computed(() => couvertureSousTypes(this.couverture()));
  readonly reco = computed(() => recommandation(this.lignes()));
  readonly groupes = computed(() => grouper(filtrer(this.lignes(), this.recherche(), this.filtre()), this.tri()));
  readonly archives = computed(() => this.modeles().filter((m) => m.etat === 'ARCHIVE'));

  readonly creation = signal(false);
  readonly libelle = signal('');
  readonly code = signal('');
  readonly nature = signal<NatureModelePv>('PV');
  readonly aRattacher = signal<string[]>([]);
  readonly enCreation = signal(false);
  readonly messageCreation = signal<string | null>(null);
  readonly creable = computed(() => !!this.libelle().trim() && MOTIF_CODE_MODELE.test(this.code().trim()));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    forkJoin({
      modeles: this.service.lister(),
      couverture: this.service.couverture(),
      integres: this.service.integres(),
      familles: this.typesService.listeSilencieuse(),
    }).subscribe({
      next: ({ modeles, couverture, integres, familles }) => {
        this.modeles.set(modeles);
        this.couverture.set(couverture);
        this.integres.set(integres);
        this.libellesFamilles.set(Object.fromEntries(familles.map((f) => [f.idTypeDossier, f.libelleType ?? f.idTypeDossier])));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  basculer(id: string): void {
    this.ouverte.update((o) => (o === id ? null : id));
  }

  /** « Commencer » : le filtre « À créer », la recherche vidée, le détail du modèle recommandé ouvert. */
  commencer(): void {
    const r = this.reco();
    if (!r) return;
    this.filtre.set('miss');
    this.recherche.set('');
    this.ouverte.set(r.ligne.id);
  }

  /** Le bouton d'action : créer (famille sans modèle), déposer ou valider (fiche du modèle), voir (fiche, ou fichiers intégrés). */
  agir(l: LigneModele): void {
    const s = l.source;
    if (s.type === 'famille') this.ouvrirCreation(l);
    else this.voirFichiers(l);
  }

  voirFichiers(l: LigneModele): void {
    const s = l.source;
    if (s.type === 'gere') void this.router.navigate(['/admin/referentiels/modeles-pv', s.id]);
    else if (s.type === 'integre') this.integreConsulte.set(this.integres().find((i) => i.code === s.code) ?? null);
  }

  /** Depuis une famille sans modèle : libellé et code proposés, ses sous-types rattachés à la création. */
  ouvrirCreation(l: LigneModele | null): void {
    const s = l?.source;
    const p = s?.type === 'famille' ? propositionPourFamille(s.famille, s.libelleFamille) : null;
    this.libelle.set(p?.libelle ?? '');
    this.code.set(p?.code ?? '');
    this.nature.set('PV');
    this.aRattacher.set(p && l ? [...l.sousTypes] : []);
    this.messageCreation.set(null);
    this.creation.set(true);
  }

  creer(): void {
    if (this.enCreation() || !this.creable()) return;
    this.enCreation.set(true);
    const sousTypes = this.aRattacher();
    this.service
      .creer({ code: this.code().trim(), libelle: this.libelle().trim(), nature: this.nature() })
      .pipe(switchMap((f) => (sousTypes.length ? this.service.rattacher(f.id, sousTypes) : of(f))))
      .subscribe({
        next: (f) => {
          this.enCreation.set(false);
          this.creation.set(false);
          void this.router.navigate(['/admin/referentiels/modeles-pv', f.id]);
        },
        error: (e: ApiError) => {
          this.enCreation.set(false);
          this.messageCreation.set(codeErreur(e) === 'CODE_DEJA_PRIS' ? 'Ce code est déjà pris par un autre modèle.' : e.message || 'Le modèle n’a pas été créé.');
          this.charger();
        },
      });
  }
}
