import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiError, codeErreur } from '../../../core/errors/api-error';
import { ModelePvResume, NatureModelePv, SousTypeDossier } from '../../../models';
import { ModelePvService, SousTypeDossierService } from '../../../services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { LIBELLES_NATURE, MOTIF_CODE_MODELE, Ton, etatModele, sousTypesSansModele } from './modeles-pv-libelles';

export const BADGE_TON: Readonly<Record<Ton, string>> = { ok: 'badge-success', at: 'badge-warning', ko: 'badge-danger', n: 'badge-neutral' };

/**
 * ⚠️ Générateur de modèles de PV, lot G1 (V138, 20/10 ; maquette `docs/maquette-2026-10-20-generateur-modeles-pv.html`, écran 1) —
 * la liste des modèles, leur version en vigueur et les sous-types qu'ils servent. Un sous-type sans modèle en vigueur produira
 * un PV sans document : l'écran le nomme. Entrée dans le sommaire des nomenclatures (le menu de l'Administrateur sature).
 */
@Component({
  selector: 'app-modeles-pv-liste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, EtatErreur, ModaleDirective],
  template: `
    <section class="mpl">
      <header class="page-header">
        <div>
          <h1 class="page-title">Modèles de PV</h1>
          <p class="mpl__role">
            Chaque sous-type de dossier a son modèle de PV, rédigé dans Word. Déposez une version, l’application la contrôle ;
            essayez-la sur un dossier réel, puis mettez-la en vigueur : elle servira aux PV à venir, jamais aux PV déjà signés.
          </p>
        </div>
        <div class="mpl__actions">
          <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
          <button type="button" class="btn btn-primary btn-sm" (click)="ouvrirCreation()">+ Nouveau modèle</button>
        </div>
      </header>

      <p class="alert alert-info">
        <span>
          Les modèles ne produisent pas encore les PV : la production par la version en vigueur arrive au lot suivant. D’ici là, les
          PV du plan gardent leurs modèles actuels, et ceux des dossiers de mise en concurrence et de marché restent sans document.
        </span>
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les modèles de PV." (reessayer)="charger()" />
      } @else {
        <div class="mpl__filtres">
          <label class="mpl__recherche">
            
            <input class="form-control" type="search" placeholder="Rechercher un modèle ou un sous-type…" aria-label="Rechercher un modèle ou un sous-type"
                   [value]="recherche()" (input)="recherche.set($any($event.target).value)" />
          </label>
          <label class="mpl__case"><input type="checkbox" [checked]="avecArchives()" (change)="avecArchives.set($any($event.target).checked)" /> Montrer les modèles archivés</label>
        </div>

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
                <tr class="mpl__ligne" [class.mpl__ligne--archive]="m.etat === 'ARCHIVE'">
                  <td>
                    <a class="mpl__lien" [routerLink]="[m.id]">{{ m.libelle }}</a>
                    <span class="mpl__sous">{{ m.code }} · {{ natures[m.nature] }}</span>
                  </td>
                  <td>
                    @for (s of m.sousTypes; track s) { <span class="mpl__st">{{ s }}</span> } @empty { <span class="text-muted">aucun</span> }
                  </td>
                  <td>
                    @if (m.enVigueur; as v) { v{{ v.numero }} · {{ v.enVigueurLe | date: 'dd/MM/yyyy' }} }
                    @else { <span class="text-muted">aucune</span> }
                  </td>
                  <td><span [class]="'badge ' + badges[e.ton]">{{ e.libelle }}</span></td>
                  <td><a class="btn btn-secondary btn-sm" [routerLink]="[m.id]">Ouvrir</a></td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="text-muted">Aucun modèle{{ recherche() ? ' ne correspond à la recherche' : ' pour l’instant : créez le premier' }}.</td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (sansModele().length) {
          <div class="alert alert-warning mpl__sans" role="note">
            <span>
              <strong>{{ sansModele().length }} sous-type(s) sans modèle de PV en vigueur</strong> — leur PV sera produit sans document :
              @for (s of sansModele(); track s.idSousType; let der = $last) {
                <span class="mpl__st" [title]="s.libelleSousType ?? ''">{{ s.idSousType }}</span>{{ der ? '' : ' ' }}
              }
            </span>
          </div>
        }
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
    .mpl__actions { display: flex; gap: 0.5rem; align-items: flex-start; }
    .mpl__filtres { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .mpl__recherche { flex: 1 1 18rem; max-width: 32rem; }
    .mpl__case { display: flex; gap: 0.4rem; align-items: center; color: var(--n-700); }
    .mpl__lien { font-weight: 600; color: var(--n-900); text-decoration: none; } .mpl__lien:hover { text-decoration: underline; }
    .mpl__ligne:hover td { background: var(--p-50); }
    .mpl__ligne--archive td { color: var(--n-500); }
    .mpl__sous { display: block; font-size: 0.8rem; color: var(--n-500); }
    .mpl__st { display: inline-block; margin: 0 0.25rem 0.25rem 0; padding: 0.05rem 0.45rem; border-radius: 6px; background: var(--n-100);
      font-family: Consolas, monospace; font-size: 0.8rem; color: var(--n-700); }
    .mpl__sans .mpl__st { background: #fff; }
    .mpl__form { display: flex; flex-direction: column; gap: 0.75rem; }
    .mpl__nature { border: 0; padding: 0; margin: 0; display: flex; gap: 1.25rem; flex-wrap: wrap; }
    .mpl__nature legend { width: 100%; }
  `,
})
export class ModelesPvListe implements OnInit {
  private readonly service = inject(ModelePvService);
  private readonly sousTypesService = inject(SousTypeDossierService);
  private readonly router = inject(Router);

  readonly natures = LIBELLES_NATURE;
  readonly listeNatures: readonly NatureModelePv[] = ['PV', 'LETTRE_RENVOI'];
  readonly badges = BADGE_TON;
  readonly etat = etatModele;

  readonly loading = signal(true);
  readonly erreur = signal(false);
  readonly modeles = signal<ModelePvResume[]>([]);
  readonly sousTypes = signal<SousTypeDossier[]>([]);
  readonly recherche = signal('');
  readonly avecArchives = signal(false);

  readonly creation = signal(false);
  readonly libelle = signal('');
  readonly code = signal('');
  readonly nature = signal<NatureModelePv>('PV');
  readonly enCreation = signal(false);
  readonly messageCreation = signal<string | null>(null);

  readonly affiches = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.modeles()
      .filter((m) => this.avecArchives() || m.etat !== 'ARCHIVE')
      .filter((m) => !q || [m.libelle, m.code, ...m.sousTypes].some((x) => x.toLowerCase().includes(q)));
  });

  readonly sansModele = computed(() => {
    const ids = sousTypesSansModele(this.sousTypes().map((s) => s.idSousType), this.modeles());
    return this.sousTypes().filter((s) => ids.includes(s.idSousType));
  });

  readonly creable = computed(() => !!this.libelle().trim() && MOTIF_CODE_MODELE.test(this.code().trim()));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    forkJoin({ modeles: this.service.lister(), sousTypes: this.sousTypesService.listeSilencieuse() }).subscribe({
      next: ({ modeles, sousTypes }) => {
        this.modeles.set(modeles);
        this.sousTypes.set(sousTypes);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  ouvrirCreation(): void {
    this.libelle.set('');
    this.code.set('');
    this.nature.set('PV');
    this.messageCreation.set(null);
    this.creation.set(true);
  }

  creer(): void {
    if (this.enCreation() || !this.creable()) return;
    this.enCreation.set(true);
    this.service.creer({ code: this.code().trim(), libelle: this.libelle().trim(), nature: this.nature() }).subscribe({
      next: (f) => {
        this.enCreation.set(false);
        this.creation.set(false);
        void this.router.navigate(['/admin/referentiels/modeles-pv', f.id]);
      },
      error: (e: ApiError) => {
        this.enCreation.set(false);
        this.messageCreation.set(codeErreur(e) === 'CODE_DEJA_PRIS' ? 'Ce code est déjà pris par un autre modèle.' : e.message || 'Le modèle n’a pas été créé.');
      },
    });
  }
}
