import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ToastService } from '../../core/notifications/toast.service';
import { validerFichier } from '../../core/securite/fichiers-surs';
import { ACTUALITE_STATUT_LABELS, Actualite, StatutActualite } from '../../models/actualite.model';
import { ActualiteService, ParametreActualitesService } from '../../services/actualite.services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { MarkdownVue } from '../../shared/actualites/markdown-vue';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/** Profils destinataires possibles — les neuf profils de l'application. */
const PROFILS: readonly { id: string; label: string }[] = [
  { id: 'PRMP', label: 'PRMP' },
  { id: 'UGPM', label: 'UGPM' },
  { id: 'SECRETAIRE', label: 'Secrétaire' },
  { id: 'PRESIDENT', label: 'Président' },
  { id: 'CHEF_COMMISSION', label: 'Chef de commission' },
  { id: 'MEMBRE', label: 'Membre' },
  { id: 'VERIFICATEUR', label: 'Contrôleur vérificateur' },
  { id: 'ASSISTANT_CONTROLEUR', label: 'Assistant contrôleur' },
  { id: 'PUBLICATION', label: 'Chargé de publication' },
];

/** JPEG uniquement (spec) ; 10 Mo — le serveur redimensionne ensuite pour l'affichage. */
const TYPES_IMAGE = ['image/jpeg'] as const;
const TAILLE_MAX_IMAGE_MO = 10;

/**
 * Administration des actualités affichées à l'ouverture de session (`docs/spec-actualites.md`).
 *
 * Deux onglets : « En cours » (actives et inactives, modifiables) et « Historique » (archivées —
 * retirées ou expirées, en lecture seule : une annonce diffusée ne se réécrit pas après coup).
 * L'interrupteur global coupe la fonctionnalité pour tous sans toucher aux actualités.
 */
@Component({
  selector: 'app-actualites-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ModaleDirective, MarkdownVue, EtatErreur],
  template: `
    <section class="page">
      <header class="page-header">
        <p class="page-header__kicker">Espace administration</p>
        <h1 class="page-header__title">Actualités</h1>
      </header>

      <!-- Interrupteur global : coupe l'affichage pour tous, sans modifier les actualités. -->
      <div class="card act-global">
        <div>
          <strong>Affichage des actualités à la connexion</strong>
          <p class="act-global__aide">
            À l'arrêt, aucun modal ne s'ouvre pour personne — les actualités et leur historique sont
            conservés.
          </p>
        </div>
        <label class="act-switch">
          <input
            type="checkbox"
            [checked]="globalActif()"
            [disabled]="majGlobal()"
            (change)="basculerGlobal($event)"
            aria-label="Activer l'affichage des actualités à la connexion"
          />
          <span class="act-switch__etat">{{ globalActif() ? 'Activé' : 'Désactivé' }}</span>
        </label>
      </div>

      <div class="act-tabs">
        <button type="button" class="btn" [class.btn-primary]="onglet() === 'cours'" [class.btn-secondary]="onglet() !== 'cours'" (click)="onglet.set('cours')">
          En cours ({{ enCours().length }})
        </button>
        <button type="button" class="btn" [class.btn-primary]="onglet() === 'historique'" [class.btn-secondary]="onglet() !== 'historique'" (click)="onglet.set('historique')">
          Historique ({{ archivees().length }})
        </button>
        @if (onglet() === 'cours') {
          <button type="button" class="btn btn-primary act-tabs__new" (click)="nouvelle()">+ Nouvelle actualité</button>
        }
      </div>

      <div class="card">
        @if (chargement()) {
          <p role="status">Chargement…</p>
        } @else if (erreur()) {
          <app-etat-erreur [message]="erreur()!" (reessayer)="charger()" />
        } @else {
          <table>
            <thead>
              <tr>
                <th scope="col">Titre</th>
                <th scope="col">Profils ciblés</th>
                <th scope="col">Publication</th>
                <th scope="col">Expiration</th>
                <th scope="col">Statut</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              @for (a of liste(); track a.idActualite) {
                <tr>
                  <td class="act-titre">{{ a.titre }}</td>
                  <td class="act-profils">{{ libelleProfils(a) }}</td>
                  <td>{{ a.datePublication || 'Dès activation' }}</td>
                  <td>{{ a.dateExpiration || 'Sans terme' }}</td>
                  <td><span class="badge" [class]="classeStatut(a.statut)">{{ statutLabel(a.statut) }}</span></td>
                  <td>
                    <div class="act-actions">
                      @if (a.statut === 'ARCHIVE') {
                        <button type="button" class="btn btn-secondary btn-sm" (click)="consulter(a)">Consulter</button>
                      } @else {
                        <button type="button" class="btn btn-secondary btn-sm" (click)="editer(a)">Modifier</button>
                        <button type="button" class="btn btn-secondary btn-sm" (click)="basculerStatut(a)">
                          {{ a.statut === 'ACTIF' ? 'Désactiver' : 'Activer' }}
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" (click)="demanderArchivage(a)">Archiver</button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="text-muted">{{ onglet() === 'cours' ? 'Aucune actualité.' : 'Aucune actualité archivée.' }}</td></tr>
              }
            </tbody>
          </table>
        }
      </div>
    </section>

    <!-- Formulaire de création / modification -->
    @if (edition(); as a) {
      <div class="modal-backdrop" [class.closing]="closingEdition()" (click)="fermerEdition()">
        <div class="modal modal-lg" role="dialog" aria-modal="true" [attr.aria-label]="a.idActualite ? 'Modifier l\\'actualité' : 'Nouvelle actualité'"
             appModale (appModaleFermer)="fermerEdition()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 class="modal-title">{{ a.idActualite ? 'Modifier l\\'actualité' : 'Nouvelle actualité' }}</h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerEdition()">✕</button>
          </div>

          <div class="modal-body">
            <label class="form-group">
              <span class="form-label">Titre *</span>
              <input id="act-titre" class="form-input" [(ngModel)]="a.titre" maxlength="180" />
            </label>

            <div class="act-grid2">
              <div>
                <label class="form-group">
                  <span class="form-label">Date de publication</span>
                  <input id="act-pub" type="date" class="form-input" [(ngModel)]="a.datePublication" />
                </label>
                <p class="form-hint">Vide : visible dès l'activation.</p>
              </div>
              <div>
                <label class="form-group">
                  <span class="form-label">Date d'expiration</span>
                  <input id="act-exp" type="date" class="form-input" [(ngModel)]="a.dateExpiration" />
                </label>
                <p class="form-hint">Vide : sans terme. Passée cette date, l'actualité s'archive.</p>
              </div>
            </div>

            <fieldset class="act-profils-champ">
              <legend class="form-label">Profils destinataires *</legend>
              <p class="form-hint">Sans profil coché, l'actualité n'est visible de personne.</p>
              <div class="act-profils-liste">
                @for (p of profils; track p.id) {
                  <label class="act-profil">
                    <input type="checkbox" [checked]="a.profilsCibles.includes(p.id)" (change)="basculerProfil(a, p.id)" />
                    <span>{{ p.label }}</span>
                  </label>
                }
              </div>
            </fieldset>

            <label class="form-group">
              <span class="form-label">Contenu (markdown) *</span>
              <textarea id="act-md" class="form-input act-md" rows="10" [(ngModel)]="a.contenuMd"></textarea>
            </label>
            <p class="form-hint">
              <code>**gras**</code> · <code>*italique*</code> · <code># Titre</code> ·
              <code>- liste</code> · <code>[texte](https://…)</code>
            </p>

            <div class="act-apercu">
              <span class="act-apercu__lbl">Aperçu</span>
              <app-markdown-vue [markdown]="a.contenuMd" />
            </div>

            @if (a.idActualite) {
              <div class="act-images-champ">
                <span class="form-label">Images (JPEG, {{ tailleMax }} Mo au plus)</span>
                @for (img of a.images ?? []; track img.idImage) {
                  <div class="act-image-ligne">
                    <span>🖼 {{ img.nomFichier }}</span>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="supprimerImage(a, img.idImage)">Retirer</button>
                  </div>
                } @empty {
                  <p class="form-hint">Aucune image.</p>
                }
                <input type="file" accept="image/jpeg" (change)="ajouterImage(a, $event)" aria-label="Ajouter une image JPEG" />
              </div>
            } @else {
              <p class="form-hint act-images-apres">Les images pourront être ajoutées après l'enregistrement.</p>
            }
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="fermerEdition()">Annuler</button>
            <button type="button" class="btn btn-primary" [disabled]="!valide(a) || enregistrement()" (click)="enregistrer(a)">
              {{ enregistrement() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Consultation d'une actualité archivée (lecture seule) -->
    @if (consultation(); as a) {
      <div class="modal-backdrop" [class.closing]="closingConsult()" (click)="fermerConsultation()">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Actualité archivée"
             appModale (appModaleFermer)="fermerConsultation()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 class="modal-title">{{ a.titre }}</h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerConsultation()">✕</button>
          </div>
          <div class="modal-body">
            <p class="form-hint">Archivée le {{ a.dateArchivage || '—' }} · destinataires : {{ libelleProfils(a) }}</p>
            <app-markdown-vue [markdown]="a.contenuMd" />
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" (click)="fermerConsultation()">Fermer</button>
          </div>
        </div>
      </div>
    }

    <!-- Confirmation d'archivage -->
    @if (aArchiver(); as a) {
      <div class="modal-backdrop" [class.closing]="closingArchive()" (click)="annulerArchivage()">
        <div class="modal modal-sm" role="dialog" aria-modal="true" aria-label="Confirmer l'archivage"
             appModale (appModaleFermer)="annulerArchivage()" (click)="$event.stopPropagation()">
          <div class="modal-body">
            <p>Archiver l'actualité <strong>{{ a.titre }}</strong> ?</p>
            <p class="form-hint">
              Elle cesse d'être affichée et rejoint l'historique. Rien n'est supprimé : elle restera
              consultable.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="annulerArchivage()">Annuler</button>
            <button type="button" class="btn btn-danger" (click)="archiver(a)">Archiver</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .act-global { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1rem; padding: 1rem 1.2rem; }
    .act-global__aide { margin: 0.25rem 0 0; font-size: var(--text-sm); color: var(--n-500); }
    .act-switch { display: flex; align-items: center; gap: 0.6rem; font-weight: 600; }
    .act-switch input { width: 1.2rem; height: 1.2rem; }
    .act-switch__etat { font-size: var(--text-sm); color: var(--n-600); }
    .act-tabs { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center; }
    .act-tabs__new { margin-left: auto; }
    .act-titre { white-space: normal; max-width: 26rem; font-weight: 600; color: var(--n-800); }
    .act-profils { white-space: normal; max-width: 22rem; font-size: var(--text-sm); color: var(--n-600); }
    .act-actions { display: flex; gap: 0.4rem; justify-content: flex-end; }
    .act-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem; }
    .act-profils-champ { margin: 1rem 0 0; padding: 0.75rem; border: 1px solid var(--n-200); border-radius: var(--radius-md); }
    .act-profils-liste { display: flex; flex-wrap: wrap; gap: 0.5rem 1.2rem; margin-top: 0.5rem; }
    .act-profil { display: flex; align-items: center; gap: 0.4rem; font-size: var(--text-sm); }
    .act-md { font-family: var(--font-mono, monospace); min-height: 12rem; }
    .act-apercu { margin-top: 0.75rem; padding: 0.9rem; border: 1px dashed var(--n-300); border-radius: var(--radius-md); background: var(--n-50); }
    .act-apercu__lbl { display: block; margin-bottom: 0.5rem; font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--n-500); }
    .act-images-champ { margin-top: 1rem; }
    .act-image-ligne { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.4rem 0; border-bottom: 1px solid var(--n-100); font-size: var(--text-sm); }
    .act-images-apres { margin-top: 1rem; }
    @media (max-width: 48rem) { .act-grid2 { grid-template-columns: 1fr; } }
  `,
})
export class ActualitesAdmin {
  private readonly service = inject(ActualiteService);
  private readonly parametre = inject(ParametreActualitesService);
  private readonly toast = inject(ToastService);

  readonly profils = PROFILS;
  readonly tailleMax = TAILLE_MAX_IMAGE_MO;

  readonly toutes = signal<Actualite[]>([]);
  readonly chargement = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly onglet = signal<'cours' | 'historique'>('cours');
  readonly globalActif = signal(false);
  readonly majGlobal = signal(false);
  readonly enregistrement = signal(false);

  readonly edition = signal<Actualite | null>(null);
  readonly consultation = signal<Actualite | null>(null);
  readonly aArchiver = signal<Actualite | null>(null);
  readonly closingEdition = signal(false);
  readonly closingConsult = signal(false);
  readonly closingArchive = signal(false);

  readonly enCours = computed(() => this.toutes().filter((a) => a.statut !== 'ARCHIVE'));
  readonly archivees = computed(() => this.toutes().filter((a) => a.statut === 'ARCHIVE'));
  readonly liste = computed(() => (this.onglet() === 'cours' ? this.enCours() : this.archivees()));

  constructor() {
    this.charger();
    this.parametre.lire().subscribe({
      next: (p) => this.globalActif.set(!!p?.actif),
      error: () => this.globalActif.set(false),
    });
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service.list().subscribe({
      next: (rows) => {
        this.toutes.set(rows ?? []);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set('Impossible de charger les actualités.');
        this.chargement.set(false);
      },
    });
  }

  statutLabel(s: StatutActualite): string {
    return ACTUALITE_STATUT_LABELS[s] ?? s;
  }

  classeStatut(s: StatutActualite): string {
    return s === 'ACTIF' ? 'badge-success' : s === 'ARCHIVE' ? 'badge-neutral' : 'badge-warning';
  }

  libelleProfils(a: Actualite): string {
    if (!a.profilsCibles?.length) {
      return 'Aucun — invisible';
    }
    return a.profilsCibles.map((id) => PROFILS.find((p) => p.id === id)?.label ?? id).join(', ');
  }

  basculerGlobal(ev: Event): void {
    const actif = (ev.target as HTMLInputElement).checked;
    this.majGlobal.set(true);
    this.parametre.definir(actif).subscribe({
      next: (p) => {
        this.globalActif.set(!!p?.actif);
        this.majGlobal.set(false);
        this.toast.success(actif ? 'Actualités activées.' : 'Actualités désactivées.');
      },
      error: () => {
        this.majGlobal.set(false);
        (ev.target as HTMLInputElement).checked = this.globalActif();
      },
    });
  }

  nouvelle(): void {
    this.edition.set({
      idActualite: 0,
      titre: '',
      contenuMd: '',
      profilsCibles: [],
      statut: 'INACTIF',
      datePublication: null,
      dateExpiration: null,
      images: [],
    });
  }

  editer(a: Actualite): void {
    // Copie de travail : annuler ne doit rien laisser dans la liste.
    this.edition.set({ ...a, profilsCibles: [...(a.profilsCibles ?? [])], images: [...(a.images ?? [])] });
  }

  consulter(a: Actualite): void {
    this.consultation.set(a);
  }

  basculerProfil(a: Actualite, id: string): void {
    a.profilsCibles = a.profilsCibles.includes(id)
      ? a.profilsCibles.filter((p) => p !== id)
      : [...a.profilsCibles, id];
  }

  valide(a: Actualite): boolean {
    return !!a.titre?.trim() && !!a.contenuMd?.trim() && a.profilsCibles.length > 0;
  }

  enregistrer(a: Actualite): void {
    this.enregistrement.set(true);
    // À la création, l'identifiant et les images sont l'affaire du serveur : ne pas les envoyer
    // plutôt que de poster un « idActualite: 0 » que le contrat ignore de toute façon.
    const { idActualite: _id, images: _img, ...nouvelle } = a;
    const requete = a.idActualite ? this.service.update(a.idActualite, a) : this.service.create(nouvelle as Actualite);
    requete.subscribe({
      next: () => {
        this.enregistrement.set(false);
        this.toast.success(a.idActualite ? 'Actualité modifiée.' : 'Actualité créée.');
        this.fermerEdition();
        this.charger();
      },
      error: () => this.enregistrement.set(false),
    });
  }

  basculerStatut(a: Actualite): void {
    const statut: StatutActualite = a.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF';
    this.service.update(a.idActualite, { ...a, statut }).subscribe({
      next: () => {
        this.toast.success(statut === 'ACTIF' ? 'Actualité activée.' : 'Actualité désactivée.');
        this.charger();
      },
    });
  }

  demanderArchivage(a: Actualite): void {
    this.aArchiver.set(a);
  }

  archiver(a: Actualite): void {
    // DELETE = archivage logique côté serveur : l'actualité rejoint l'historique, rien n'est perdu.
    this.service.delete(a.idActualite).subscribe({
      next: () => {
        this.annulerArchivage();
        this.toast.success('Actualité archivée.');
        this.charger();
      },
    });
  }

  ajouterImage(a: Actualite, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const fichier = input.files?.[0];
    if (!fichier) {
      return;
    }
    const message = validerFichier(fichier, TYPES_IMAGE, TAILLE_MAX_IMAGE_MO);
    if (message) {
      this.toast.error(message);
      input.value = '';
      return;
    }
    this.service.ajouterImage(a.idActualite, fichier).subscribe({
      next: (img) => {
        a.images = [...(a.images ?? []), img];
        input.value = '';
        this.toast.success('Image ajoutée.');
        this.charger();
      },
      error: () => (input.value = ''),
    });
  }

  supprimerImage(a: Actualite, idImage: number): void {
    this.service.supprimerImage(a.idActualite, idImage).subscribe({
      next: () => {
        a.images = (a.images ?? []).filter((i) => i.idImage !== idImage);
        this.charger();
      },
    });
  }

  fermerEdition(): void {
    fermerAvecAnimation(this.closingEdition, () => this.edition.set(null));
  }

  fermerConsultation(): void {
    fermerAvecAnimation(this.closingConsult, () => this.consultation.set(null));
  }

  annulerArchivage(): void {
    fermerAvecAnimation(this.closingArchive, () => this.aArchiver.set(null));
  }
}
