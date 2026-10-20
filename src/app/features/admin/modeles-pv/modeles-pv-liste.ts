import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';

import { ApiError, codeErreur } from '../../../core/errors/api-error';
import { CouvertureSousType, ModeleIntegre, ModelePvResume, NatureModelePv, TypeDossier } from '../../../models';
import { ModelePvService, TypeDossierService } from '../../../services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import {
  LIBELLES_NATURE,
  MOTIF_CODE_MODELE,
  Ton,
  etatModele,
  propositionPourFamille,
  reprisParModele,
  sansDocument,
} from './modeles-pv-libelles';

export const BADGE_TON: Readonly<Record<Ton, string>> = { ok: 'badge-success', at: 'badge-warning', ko: 'badge-danger', n: 'badge-neutral' };

type FiltreEtat = 'actifs' | 'vigueur' | 'preparer' | 'archives';
const FILTRES: readonly { cle: FiltreEtat; libelle: string }[] = [
  { cle: 'actifs', libelle: 'Tous les états' },
  { cle: 'vigueur', libelle: 'En vigueur' },
  { cle: 'preparer', libelle: 'À préparer (sans version en vigueur)' },
  { cle: 'archives', libelle: 'Archivés' },
];

/** Une famille dont des sous-types n'ont aucun modèle de PV en vigueur : une ligne grisée « Aucun modèle » de la liste. */
interface FamilleSansModele {
  famille: string;
  libelle: string;
  sousTypes: CouvertureSousType[];
}

/**
 * ⚠️ Générateur de modèles de PV, lot G1 (V138, 20/10 ; maquette `docs/maquette-2026-10-20-generateur-modeles-pv.html`, écran 1) —
 * la liste des modèles, leur version en vigueur et les sous-types qu'ils servent. Les sous-types sans modèle en vigueur (leur PV
 * sera sans document) suivent en lignes grisées, une par famille, avec « Créer » : le modèle naît rattaché à ces sous-types.
 * Entrée dans le sommaire des nomenclatures (le menu de l'Administrateur sature).
 */
@Component({
  selector: 'app-modeles-pv-liste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, EtatErreur, ModaleDirective],
  template: `
    <section class="mpl">
      <header>
        <h1 class="page-title">Modèles de PV</h1>
        <p class="mpl__role">
          Chaque sous-type de dossier a son modèle de PV, rédigé dans Word. Déposez une version, l’application la contrôle ;
          essayez-la sur un dossier réel, puis mettez-la en vigueur : elle servira aux PV à venir, jamais aux PV déjà signés.
        </p>
      </header>

      <div class="card mpl__outils">
        <input class="form-control mpl__recherche" type="search" placeholder="Rechercher un modèle ou un sous-type…" aria-label="Rechercher un modèle ou un sous-type"
               [value]="recherche()" (input)="recherche.set($any($event.target).value)" />
        <select class="form-control mpl__filtre" aria-label="Filtrer par état" [value]="filtre()" (change)="filtre.set($any($event.target).value)">
          @for (f of filtres; track f.cle) { <option [value]="f.cle" [selected]="f.cle === filtre()">{{ f.libelle }}</option> }
        </select>
        <button type="button" class="btn btn-primary" (click)="ouvrirCreation()">+ Nouveau modèle</button>
      </div>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les modèles de PV." (reessayer)="charger()" />
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th scope="col">Modèle</th>
                <th scope="col">Sous-types servis</th>
                <th scope="col">Version en vigueur</th>
                <th scope="col">État</th>
                <th scope="col"><span class="cnm-sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              @for (m of affiches(); track m.id) {
                @let e = etat(m);
                <tr [class.mpl__ligne--grise]="m.etat === 'ARCHIVE'">
                  <td>
                    <a class="mpl__lien" [routerLink]="[m.id]">{{ m.libelle }}</a>
                    <span class="mpl__sous">{{ m.code }} · {{ natures[m.nature] }}</span>
                    @let remplace = remplaceIntegre(m);
                    @if (remplace.length) { <span class="mpl__sous mpl__reprise">Reprise des fichiers intégrés pour {{ remplace.join(' · ') }}</span> }
                  </td>
                  <td class="mpl__mono">{{ m.sousTypes.length ? m.sousTypes.join(' · ') : '—' }}</td>
                  <td>
                    @if (m.enVigueur; as v) { v{{ v.numero }} · {{ v.enVigueurLe | date: 'dd/MM/yyyy' }} }
                    @else if (m.derniere; as d) { <span class="badge badge-neutral">brouillon v{{ d.numero }}</span> }
                    @else { — }
                  </td>
                  <td><span [class]="'badge ' + badges[e.ton]">{{ e.libelle }}</span></td>
                  <td class="mpl__action"><a class="btn btn-secondary btn-sm" [routerLink]="[m.id]">Ouvrir</a></td>
                </tr>
              }
              @if (filtre() === 'actifs' || filtre() === 'vigueur') {
                @for (i of integres(); track i.code) {
                  <tr class="mpl__ligne--integre">
                    <td>
                      {{ i.libelle }}
                      <span class="mpl__sous">Intégré à l’application · {{ i.fichiers.length }} fichiers Word · {{ natures[i.nature] }}</span>
                    </td>
                    <td class="mpl__mono">{{ i.sousTypes ? i.sousTypes.join(' · ') : 'tous les sous-types' }}</td>
                    <td>fichiers actuels</td>
                    <td>@if (i.enService) { <span class="badge badge-success">En service</span> } @else { <span class="badge badge-neutral">Remplacé</span> }</td>
                    <td class="mpl__action">
                      <button type="button" class="btn btn-ghost btn-sm" [attr.aria-expanded]="integreOuvert() === i.code"
                              (click)="integreOuvert.set(integreOuvert() === i.code ? null : i.code)">{{ integreOuvert() === i.code ? 'Masquer' : 'Détail' }}</button>
                    </td>
                  </tr>
                  @if (integreOuvert() === i.code) {
                    <tr class="mpl__ligne--integre">
                      <td colspan="5">
                        <p class="mpl__detail">{{ i.regle }} Ces fichiers sont livrés avec le serveur : ils ne se déposent ni ne se modifient ici, et servent tant qu’aucun
                          modèle de cet écran ne produit les PV (lot suivant).</p>
                        <p class="mpl__mono">{{ i.fichiers.join(' · ') }}</p>
                      </td>
                    </tr>
                  }
                }
              }
              @if (filtre() !== 'archives' && filtre() !== 'vigueur') {
                @for (g of famillesSansModele(); track g.famille) {
                  <tr class="mpl__ligne--grise">
                    <td>
                      {{ propositionDe(g).libelle }}
                      <span class="mpl__sous">{{ g.libelle }} · {{ g.sousTypes.length }} sous-type(s) sans modèle</span>
                    </td>
                    <td class="mpl__mono">
                      @for (s of g.sousTypes; track s.sousType; let der = $last) { <span [title]="s.libelle ?? ''">{{ s.sousType }}</span>{{ der ? '' : ' · ' }} }
                    </td>
                    <td>—</td>
                    <td><span class="badge badge-danger">Sans document</span></td>
                    <td class="mpl__action"><button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirCreation(g)">Créer</button></td>
                  </tr>
                }
              }
              @if (!affiches().length && !(famillesSansModele().length && filtre() !== 'archives' && filtre() !== 'vigueur')) {
                <tr><td colspan="5" class="text-muted">Aucun modèle{{ recherche() ? ' ne correspond à la recherche' : '' }}.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <p class="mpl__note">
          Aujourd’hui, seuls les modèles <strong>intégrés</strong> produisent des documents : le PV du plan et la lettre de renvoi. Les familles en
          rouge n’ont aucun modèle : leur PV est signé <strong>sans document</strong>. Les modèles de cet écran produiront les PV au lot suivant ;
          celui du plan remplacera alors ses fichiers intégrés, une fois les rendus comparés sur des dossiers réels.
        </p>
      }
    </section>

    @if (creation()) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Nouveau modèle de PV" appModale (appModaleFermer)="creation.set(false)">
          <div class="modal-header">
            <h2 class="modal-title">Nouveau modèle</h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="creation.set(false)">✕</button>
          </div>
          <div class="modal-body mpl__form">
            <label class="form-group">
              <span class="form-label">Libellé</span>
              <input class="form-control" [value]="libelle()" (input)="libelle.set($any($event.target).value)" placeholder="PV d’examen du dossier de marché" />
            </label>
            <label class="form-group">
              <span class="form-label">Code</span>
              <input class="form-control" [value]="code()" (input)="code.set($any($event.target).value)" placeholder="PV-MARCHE" />
              <span class="form-hint">Lettres, chiffres, « _ », « . » ou « - », 50 au plus. Il ne change plus.</span>
            </label>
            <fieldset class="form-group mpl__nature">
              <legend class="form-label">Nature</legend>
              @for (n of listeNatures; track n) {
                <label><input type="radio" name="nature" [checked]="nature() === n" (change)="nature.set(n)" /> {{ natures[n] }}</label>
              }
            </fieldset>
            @if (aRattacher().length) {
              <p class="form-hint">Le modèle servira d’emblée : <span class="mpl__mono">{{ aRattacher().join(' · ') }}</span> (modifiable sur la fiche).</p>
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
    .mpl { display: flex; flex-direction: column; gap: 1rem; }
    .mpl__role { margin: 0.25rem 0 0; color: var(--n-500); max-width: 75ch; }
    .mpl__outils { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; padding: 0.9rem 1rem; }
    .mpl__recherche { flex: 1 1 18rem; }
    .mpl__filtre { flex: 0 1 16rem; }
    .mpl__lien { font-weight: 600; color: var(--n-900); text-decoration: none; }
    .mpl__lien:hover { text-decoration: underline; }
    .mpl__sous { display: block; font-size: 0.8rem; color: var(--n-500); }
    .mpl__mono { font-family: Consolas, monospace; font-size: 0.8rem; color: var(--n-700); }
    .mpl__ligne--grise td { color: var(--n-500); }
    .mpl__ligne--integre td { background: #f6fbf8; color: var(--n-700); }
    .mpl__reprise { color: var(--p-700); }
    .mpl__detail { margin: 0 0 0.3rem; font-size: 0.85rem; }
    /* Le style global des tableaux interdit le retour à la ligne : ici, les sous-types d'une famille sont nombreux. */
    .mpl td { white-space: normal; }
    .mpl table { table-layout: fixed; width: 100%; }
    .mpl th:nth-child(1) { width: 30%; } .mpl th:nth-child(2) { width: 34%; } .mpl th:nth-child(3) { width: 13%; }
    .mpl th:nth-child(4) { width: 14%; } .mpl th:nth-child(5) { width: 9%; }
    .mpl td.mpl__action { text-align: right; white-space: nowrap; }
    .mpl__note { margin: 0; font-size: 0.85rem; color: var(--n-500); }
    .mpl__form { display: flex; flex-direction: column; gap: 0.75rem; }
    .mpl__nature { border: 0; padding: 0; margin: 0; display: flex; gap: 1.25rem; flex-wrap: wrap; }
    .mpl__nature legend { width: 100%; }
  `,
})
export class ModelesPvListe implements OnInit {
  private readonly service = inject(ModelePvService);
  private readonly typesService = inject(TypeDossierService);
  private readonly router = inject(Router);

  readonly natures = LIBELLES_NATURE;
  readonly listeNatures: readonly NatureModelePv[] = ['PV', 'LETTRE_RENVOI'];
  readonly badges = BADGE_TON;
  readonly filtres = FILTRES;
  readonly etat = etatModele;

  readonly loading = signal(true);
  readonly erreur = signal(false);
  readonly modeles = signal<ModelePvResume[]>([]);
  readonly couverture = signal<CouvertureSousType[]>([]);
  private readonly integresServis = signal<ModeleIntegre[]>([]);
  readonly familles = signal<TypeDossier[]>([]);
  readonly recherche = signal('');
  readonly filtre = signal<FiltreEtat>('actifs');
  readonly integreOuvert = signal<string | null>(null);

  /** Les modèles intégrés, filtrés par la recherche. */
  readonly integres = computed(() => {
    const q = this.q();
    return this.integresServis().filter((i) => !q || [i.libelle, ...(i.sousTypes ?? []), ...i.fichiers].some((x) => x.toLowerCase().includes(q)));
  });

  readonly creation = signal(false);
  readonly libelle = signal('');
  readonly code = signal('');
  readonly nature = signal<NatureModelePv>('PV');
  readonly aRattacher = signal<string[]>([]);
  readonly enCreation = signal(false);
  readonly messageCreation = signal<string | null>(null);

  private readonly q = computed(() => this.recherche().trim().toLowerCase());

  readonly affiches = computed(() => {
    const q = this.q();
    return this.modeles()
      .filter((m) => {
        switch (this.filtre()) {
          case 'archives':
            return m.etat === 'ARCHIVE';
          case 'vigueur':
            return m.etat === 'ACTIF' && !!m.enVigueur;
          case 'preparer':
            return m.etat === 'ACTIF' && !m.enVigueur;
          default:
            return m.etat === 'ACTIF';
        }
      })
      .filter((m) => !q || [m.libelle, m.code, ...m.sousTypes].some((x) => x.toLowerCase().includes(q)));
  });

  readonly famillesSansModele = computed<FamilleSansModele[]>(() => {
    const q = this.q();
    const parFamille = new Map<string, CouvertureSousType[]>();
    for (const c of sansDocument(this.couverture())) {
      if (q && ![c.sousType, c.libelle ?? ''].some((x) => x.toLowerCase().includes(q))) continue;
      const f = c.famille ?? '—';
      parFamille.set(f, [...(parFamille.get(f) ?? []), c]);
    }
    const libelles = new Map(this.familles().map((f) => [f.idTypeDossier, f.libelleType ?? f.idTypeDossier]));
    return [...parFamille.entries()].map(([famille, sousTypes]) => ({ famille, libelle: libelles.get(famille) ?? famille, sousTypes }));
  });

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
        this.integresServis.set(integres);
        this.familles.set(familles);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  /** Les sous-types d'un modèle encore servis par des fichiers intégrés : il les reprendra (lot G4). */
  remplaceIntegre(m: ModelePvResume): string[] {
    return m.etat === 'ACTIF' ? reprisParModele(this.couverture(), m.id) : [];
  }

  propositionDe(g: FamilleSansModele): { libelle: string; code: string } {
    return propositionPourFamille(g.famille, g.libelle);
  }

  /** Depuis une ligne « Aucun modèle » : libellé et code proposés, et les sous-types de la ligne rattachés à la création. */
  ouvrirCreation(g?: FamilleSansModele): void {
    const p = g ? this.propositionDe(g) : null;
    this.libelle.set(p?.libelle ?? '');
    this.code.set(p?.code ?? '');
    this.nature.set('PV');
    this.aRattacher.set(g ? g.sousTypes.map((s) => s.sousType) : []);
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
