import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, output, signal } from '@angular/core';

import { urlBlobSure } from '../../core/securite/fichiers-surs';
import { Actualite } from '../../models/actualite.model';
import { ActualiteService } from '../../services/actualite.services';
import { fermerAvecAnimation } from '../a11y/fermeture-animee';
import { ModaleDirective } from '../a11y/modale.directive';
import { MarkdownVue } from './markdown-vue';

/**
 * Modal d'actualités affiché à l'ouverture de session (`docs/spec-actualites.md`).
 *
 * En surimpression (jamais plein écran), fermable par ✕, par Échap (directive `appModale`) ou par
 * un clic hors du panneau. Les actualités reçues sont **déjà filtrées par le serveur** (profil,
 * statut, fenêtre de dates, interrupteur global) : ce composant ne décide de rien, il affiche.
 *
 * Plusieurs actualités ⇒ navigation « Précédente / Suivante » plutôt qu'un empilement : le modal
 * garde une hauteur stable et l'utilisateur voit d'emblée combien d'annonces l'attendent.
 */
@Component({
  selector: 'app-actualites-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, MarkdownVue],
  template: `
    <div class="modal-backdrop" [class.closing]="closing()" (click)="fermer()">
      <div
        class="modal modal-lg act"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Actualités — ' + courante().titre"
        appModale
        (appModaleFermer)="fermer()"
        (click)="$event.stopPropagation()"
      >
        <div class="modal-header act__head">
          <div>
            <span class="act__kicker">📣 Actualités</span>
            <h2 class="modal-title">{{ courante().titre }}</h2>
            @if (courante().datePublication) {
              <span class="act__date">Publiée le {{ courante().datePublication }}</span>
            }
          </div>
          <button type="button" class="btn-close" aria-label="Fermer les actualités" (click)="fermer()">✕</button>
        </div>

        <div class="modal-body act__body">
          <app-markdown-vue [markdown]="courante().contenuMd" />

          @if (imagesCourantes().length) {
            <div class="act__images">
              @for (img of imagesCourantes(); track img.id) {
                <figure class="act__figure">
                  <!-- urlBlobSure : le type MIME est forcé, un fichier piégé ne s'exécute pas dans l'origine. -->
                  <img [src]="img.url" [alt]="img.alt" class="act__img" />
                </figure>
              }
            </div>
          }
        </div>

        <div class="modal-footer act__foot">
          @if (actualites().length > 1) {
            <div class="act__nav">
              <button type="button" class="btn btn-secondary btn-sm" [disabled]="index() === 0" (click)="precedente()">
                ‹ Précédente
              </button>
              <span class="act__compteur" role="status">{{ index() + 1 }} / {{ actualites().length }}</span>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                [disabled]="index() === actualites().length - 1"
                (click)="suivante()"
              >
                Suivante ›
              </button>
            </div>
          }
          <button type="button" class="btn btn-primary" (click)="fermer()">Fermer</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .act__kicker { display: block; font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--c-600); }
    .act__date { font-size: var(--text-sm); color: var(--n-500); }
    .act__body { max-height: 60vh; overflow-y: auto; }
    .act__images { display: flex; flex-direction: column; gap: 0.9rem; margin-top: 1rem; }
    .act__figure { margin: 0; }
    /* max-width sans width : une petite image garde sa taille au lieu d'être étirée et floue. */
    .act__img { display: block; max-width: 100%; max-height: 22rem; height: auto; margin: 0 auto; object-fit: contain; border-radius: var(--radius-md); border: 1px solid var(--n-200); }
    .act__foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .act__nav { display: flex; align-items: center; gap: 0.6rem; }
    .act__compteur { font-size: var(--text-sm); color: var(--n-500); font-variant-numeric: tabular-nums; }
  `,
})
export class ActualitesModal implements OnDestroy {
  private readonly service = inject(ActualiteService);

  /** Actualités à présenter — déjà filtrées par le serveur. */
  readonly actualites = input.required<Actualite[]>();
  readonly ferme = output<void>();

  readonly index = signal(0);
  readonly closing = signal(false);
  readonly courante = computed<Actualite>(() => this.actualites()[this.index()] ?? ({ titre: '', contenuMd: '' } as Actualite));

  /** URLs d'objet créées pour les images, à révoquer à la fermeture (sinon fuite mémoire). */
  private readonly urls = signal<Map<number, string>>(new Map());
  private readonly chargees = new Set<number>();

  readonly imagesCourantes = computed(() => {
    const urls = this.urls();
    return (this.courante().images ?? [])
      .filter((i) => urls.has(i.idImage))
      .map((i) => ({ id: i.idImage, url: urls.get(i.idImage) as string, alt: i.nomFichier || 'Illustration' }));
  });

  constructor() {
    // Les images de la première actualité sont demandées d'emblée ; les suivantes à la navigation.
    queueMicrotask(() => this.chargerImages());
  }

  precedente(): void {
    if (this.index() > 0) {
      this.index.update((i) => i - 1);
      this.chargerImages();
    }
  }

  suivante(): void {
    if (this.index() < this.actualites().length - 1) {
      this.index.update((i) => i + 1);
      this.chargerImages();
    }
  }

  fermer(): void {
    fermerAvecAnimation(this.closing, () => this.ferme.emit());
  }

  /** Charge les images non encore récupérées de l'actualité affichée. */
  private chargerImages(): void {
    const act = this.courante();
    for (const img of act.images ?? []) {
      if (this.chargees.has(img.idImage)) {
        continue;
      }
      this.chargees.add(img.idImage);
      this.service.image(act.idActualite, img.idImage).subscribe({
        next: (blob) => {
          const url = urlBlobSure(blob);
          this.urls.update((m) => new Map(m).set(img.idImage, url));
        },
        // Une image manquante ne doit pas priver l'utilisateur du texte de l'annonce.
        error: () => this.chargees.delete(img.idImage),
      });
    }
  }

  ngOnDestroy(): void {
    for (const url of this.urls().values()) {
      URL.revokeObjectURL(url);
    }
  }
}
