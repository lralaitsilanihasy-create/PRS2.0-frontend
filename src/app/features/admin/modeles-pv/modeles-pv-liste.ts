import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { ApiError, codeErreur } from '../../../core/errors/api-error';
import { CouvertureSousType, DocumentDaoIntegre, ModeleIntegre, ModelePvResume, NatureModelePv } from '../../../models';
import { ModelePvService, TypeDossierService } from '../../../services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { IntegreDetail } from './integre-detail';
import { BandeauRecommandation } from './liste/bandeau-recommandation';
import { BarreOutilsModeles } from './liste/barre-outils-modeles';
import { CarteCouverture } from './liste/carte-couverture';
import { EnTeteModeles } from './liste/en-tete-modeles';
import { ListeModeles } from './liste/liste-modeles';
import { ModelesMarche } from './liste/modeles-marche';
import { ModelesDao } from './liste/modeles-dao';
import { ouvrirBlobSur } from '../../../core/securite/fichiers-surs';
import { FiltreEtat, LigneModele, Tri, LigneDao, LigneMarche, construireLignes, groupesDao, couvertureLettres, lignesMarche, couvertureSousTypes, filtrer, grouper, recommandation } from './liste/modeles-pv-vue';
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
  imports: [RouterLink, EtatErreur, ModaleDirective, IntegreDetail, EnTeteModeles, BandeauRecommandation, CarteCouverture, BarreOutilsModeles, ListeModeles, ModelesMarche, ModelesDao],
  template: `
    <div class="mpv">
      <app-en-tete-modeles [avecNouveau]="onglet() === 'pv'" (nouveau)="ouvrirCreation(null)" />

      @if (loading()) {
        <p class="mpv__etat" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les modèles de PV." (reessayer)="charger()" />
      } @else {
        <div class="mpv__onglets" role="tablist" aria-label="Familles de documents">
          @for (o of onglets; track o.cle) {
            <button type="button" role="tab" class="mpv__onglet" [attr.aria-selected]="onglet() === o.cle" (click)="onglet.set(o.cle)">
              {{ o.libelle }} <span>{{ o.detail }}</span>
            </button>
          }
        </div>
        @if (onglet() === 'marche') {
          <app-modeles-marche [lignes]="lignesMarcheCalculees()" [occupe]="creationMarche()" (agir)="agirMarche($event)" />
          @if (messageMarche(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
        } @else if (onglet() === 'dao') {
          <app-modeles-dao [groupes]="groupesDaoCalcules()" [ecarts]="ecartsDao()" [occupe]="occupeDao()" (agir)="agirDao($event)" (texte)="texteIntegreDao($event)" />
          @if (messageDao(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
        } @else {
        @if (reco(); as r) { <app-bandeau-recommandation [reco]="r" (commencer)="commencer()" /> }
        <app-carte-couverture [couverture]="couvertureCalculee()" [filtre]="filtre()" (choisir)="filtre.set($event)"
                             [lettres]="lettresCalculees()" (voirLettre)="voirIntegre($event)" />
        <app-barre-outils-modeles [recherche]="recherche()" [filtre]="filtre()" [tri]="tri()"
                                  (rechercheChange)="recherche.set($event)" (filtreChange)="filtre.set($event)" (triChange)="tri.set($event)" />
        <app-liste-modeles [groupes]="groupes()" [ouverte]="ouverte()" (basculer)="basculer($event)" (action)="agir($event)" (fichiers)="voirFichiers($event)" />

        @if (archives().length) {
          <details class="mpv__archives">
            <summary>Modèles archivés ({{ archives().length }})</summary>
            <ul>
              @for (a of archives(); track a.id) { <li><a [routerLink]="[a.id]">{{ a.libelle }}</a><span class="mpv__code"> · {{ a.code }}</span></li> }
            </ul>
          </details>
        }
        @if (remplaces().length) {
          <details class="mpv__archives">
            <summary>Modèles intégrés remplacés ({{ remplaces().length }})</summary>
            <ul>
              @for (i of remplaces(); track i.code) {
                <li><button type="button" class="mpv__lien" (click)="integreConsulte.set(i)">{{ i.libelle }}</button><span class="mpv__code"> · {{ i.code }} · {{ i.fichiers.length }} fichier(s) Word, en consultation</span></li>
              }
            </ul>
          </details>
        }
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
    .mpv__onglets { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid var(--border); }
    .mpv__onglet { border: 1px solid var(--border); border-bottom: 0; background: var(--page-bg); color: var(--text-muted); padding: 8px 14px;
      border-radius: 8px 8px 0 0; font: inherit; font-weight: 500; cursor: pointer; }
    .mpv__onglet span { font-weight: 400; font-size: 12px; }
    .mpv__onglet[aria-selected='true'] { background: var(--card-bg); color: var(--texte); position: relative; top: 1px; }
    .mpv__onglet:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .mpv__archives { font-size: 13px; color: var(--text-muted); }
    .mpv__archives summary { cursor: pointer; }
    .mpv__archives summary:focus-visible, .mpv__archives a:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .mpv__archives ul { margin: 6px 0 0; padding-left: 18px; columns: 2 22rem; column-gap: 2rem; }
    .mpv__archives li { break-inside: avoid; margin: 2px 0; }
    .mpv__code { font-family: var(--police-texte); font-size: 12px; color: var(--text-muted); }
    .mpv__archives a { color: var(--texte); }
    .mpv__lien { border: 0; background: none; padding: 0; font: inherit; color: var(--texte); text-decoration: underline; cursor: pointer; }
    .mpv__lien:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .mpv__form { display: flex; flex-direction: column; gap: 0.75rem; }
    .mpv__nature { border: 0; padding: 0; margin: 0; display: flex; gap: 1.25rem; flex-wrap: wrap; }
    .mpv__nature legend { width: 100%; }
    .mpv__mono { font-family: var(--police-texte); font-size: 0.8rem; }
  `,
})
export class ModelesPvListe implements OnInit {
  private readonly service = inject(ModelePvService);
  private readonly typesService = inject(TypeDossierService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

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
  readonly lettresCalculees = computed(() => couvertureLettres(this.couverture()));
  readonly reco = computed(() => recommandation(this.lignes()));
  readonly groupes = computed(() => grouper(filtrer(this.lignes(), this.recherche(), this.filtre()), this.tri()));
  readonly archives = computed(() => this.modeles().filter((m) => m.etat === 'ARCHIVE'));

  // ——— ⚠️ 22/10 (M1 « modeles-documents-marche ») — trois onglets : PV d'examen, dossier de mise en concurrence, dossier de marché ———
  readonly onglets: readonly { cle: 'pv' | 'dao' | 'marche'; libelle: string; detail: string }[] = [
    { cle: 'pv', libelle: 'PV d’examen', detail: '· et lettres de renvoi' },
    { cle: 'dao', libelle: 'Dossier de mise en concurrence', detail: '· documents du DAO' },
    { cle: 'marche', libelle: 'Dossier de marché', detail: '· projet de marché' },
  ];
  readonly onglet = signal<'pv' | 'dao' | 'marche'>('pv');
  readonly lignesMarcheCalculees = computed(() => lignesMarche(this.modeles()));
  readonly creationMarche = signal<string | null>(null);

  // ——— ⚠️ 22/10 (D0-D3 « modeles-dao ») — l'onglet « Dossier de mise en concurrence » ———
  private readonly integresDao = signal<DocumentDaoIntegre[]>([]);
  readonly groupesDaoCalcules = computed(() => groupesDao(this.integresDao(), this.modeles()));
  /** Le nombre d'écarts au document type de la dernière version de chaque modèle du DAO, par sigle (lu après la liste). */
  readonly ecartsDao = signal<Record<string, { fond: number; forme: number }>>({});

  private chargerEcartsDao(modeles: ModelePvResume[]): void {
    const dao = modeles.filter((m) => m.nature === 'DOCUMENT_DAO' && m.etat === 'ACTIF' && m.derniere && (m.sigles ?? []).length);
    if (!dao.length) return;
    forkJoin(dao.map((m) => this.service.ecarts(m.id, m.derniere!.numero).pipe(catchError(() => of(null)))))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((l) =>
        this.ecartsDao.set(
          Object.fromEntries(dao.flatMap((m, i) => (l[i] ? [[m.sigles![0], { fond: l[i]!.filter((e) => e.nature !== 'FORME').length, forme: l[i]!.filter((e) => e.nature === 'FORME').length }]] : []))),
        ),
      );
  }
  readonly occupeDao = signal<string | null>(null);
  readonly messageDao = signal<string | null>(null);

  /** « Créer » : le modèle du sigle, rattaché, puis sa fiche ; sinon la fiche du modèle existant. */
  agirDao(l: LigneDao): void {
    if (l.modele) {
      void this.router.navigate(['/admin/referentiels/modeles-pv', l.modele.id]);
      return;
    }
    if (this.occupeDao()) return;
    this.occupeDao.set(l.sigle);
    this.messageDao.set(null);
    this.service
      .creer({ code: `DAO-${l.sigle}`, libelle: l.libelle, nature: 'DOCUMENT_DAO' })
      .pipe(switchMap((f) => this.service.rattacherSigles(f.id, [l.sigle])))
      .subscribe({
        next: (f) => {
          this.occupeDao.set(null);
          void this.router.navigate(['/admin/referentiels/modeles-pv', f.id]);
        },
        error: (e: ApiError) => {
          this.occupeDao.set(null);
          this.messageDao.set(e.message || 'Le modèle n’a pas pu être créé.');
          this.charger();
        },
      });
  }

  /** Le rendu brut du document type intégré (jetons visibles), dans un nouvel onglet. */
  texteIntegreDao(sigle: string): void {
    if (this.occupeDao()) return;
    this.occupeDao.set('texte-' + sigle);
    this.service.fichierIntegreDao(sigle, 'pdf').subscribe({
      next: (b) => {
        this.occupeDao.set(null);
        ouvrirBlobSur(b);
      },
      error: (e: ApiError) => {
        this.occupeDao.set(null);
        this.messageDao.set(e.message || 'Le texte intégré n’a pas pu être ouvert.');
      },
    });
  }
  readonly messageMarche = signal<string | null>(null);

  /** « Créer » : le modèle de la catégorie, rattaché, puis sa fiche ; sinon la fiche du modèle existant. */
  agirMarche(l: LigneMarche): void {
    if (l.modele) {
      void this.router.navigate(['/admin/referentiels/modeles-pv', l.modele.id]);
      return;
    }
    if (this.creationMarche()) return;
    this.creationMarche.set(l.categorie);
    this.messageMarche.set(null);
    this.service
      .creer({ code: l.codeModele, libelle: `Projet de marché — ${l.libelle.toLowerCase()}`, nature: 'PROJET_MARCHE' })
      .pipe(switchMap((f) => this.service.rattacherCategories(f.id, [l.categorie])))
      .subscribe({
        next: (f) => {
          this.creationMarche.set(null);
          void this.router.navigate(['/admin/referentiels/modeles-pv', f.id]);
        },
        error: (e: ApiError) => {
          this.creationMarche.set(null);
          this.messageMarche.set(e.message || 'Le modèle n’a pas pu être créé.');
          this.charger();
        },
      });
  }
  /** ⚠️ 22/10 — les intégrés relevés par un modèle de l'application : ils ne produisent plus, ils se consultent encore. */
  readonly remplaces = computed(() => this.integres().filter((i) => !i.enService));

  readonly creation = signal(false);
  readonly libelle = signal('');
  readonly code = signal('');
  readonly nature = signal<NatureModelePv>('PV');
  readonly aRattacher = signal<string[]>([]);
  readonly enCreation = signal(false);
  readonly messageCreation = signal<string | null>(null);
  readonly creable = computed(() => !!this.libelle().trim() && MOTIF_CODE_MODELE.test(this.code().trim()));

  ngOnInit(): void {
    // Le retour d'une fiche de projet de marché rouvre son onglet (`?onglet=marche`).
    const o = this.route.snapshot.queryParamMap.get('onglet');
    if (o === 'marche' || o === 'dao') this.onglet.set(o);
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    forkJoin({
      modeles: this.service.lister(),
      couverture: this.service.couverture(),
      integres: this.service.integres(),
      // ⚠️ 22/10 (D0) — les documents du DAO ; un échec ne vide pas la page (l'onglet le dira).
      integresDao: this.service.integresDao().pipe(catchError(() => of(null))),
      familles: this.typesService.listeSilencieuse(),
    }).subscribe({
      next: ({ modeles, couverture, integres, integresDao, familles }) => {
        this.modeles.set(modeles);
        this.couverture.set(couverture);
        this.integres.set(integres);
        this.integresDao.set(integresDao ?? []);
        this.chargerEcartsDao(modeles);
        this.messageDao.set(integresDao ? null : 'Les documents du DAO n’ont pas pu être lus.');
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

  /** « Voir le modèle » de la ligne des lettres de renvoi : la consultation du modèle intégré. */
  voirIntegre(code: string): void {
    this.integreConsulte.set(this.integres().find((i) => i.code === code) ?? null);
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
