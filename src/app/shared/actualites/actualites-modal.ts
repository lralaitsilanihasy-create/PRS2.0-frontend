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
      <!-- Mise en page « lettre d'information » (modèle fourni par l'utilisateur, 2026-08-19) :
           visuel à gauche, annonce à droite. Sans image, la colonne disparaît et le texte occupe
           toute la largeur — le modal ne montre jamais un cadre vide. -->
      <div
        class="act"
        [class.act--illustre]="visuel()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Actualités — ' + courante().titre"
        appModale
        (appModaleFermer)="fermer()"
        (click)="$event.stopPropagation()"
      >
        <button type="button" class="act__x" aria-label="Fermer les actualités" (click)="fermer()">✕</button>

        @if (visuel(); as img) {
          <!-- urlBlobSure : le type MIME est forcé, un fichier piégé ne s'exécute pas dans l'origine. -->
          <div class="act__visuel"><img [src]="img.url" [alt]="img.alt" /></div>
        }

        <div class="act__contenu">
          <p class="act__kicker">Actualités</p>
          <h2 class="act__titre">{{ courante().titre }}</h2>
          @if (courante().datePublication) {
            <p class="act__date">Publiée le {{ courante().datePublication }}</p>
          }

          <div class="act__corps">
            <app-markdown-vue [markdown]="courante().contenuMd" />

            <!-- Les images au-delà de la première restent dans le corps de l'annonce. -->
            @for (img of imagesSecondaires(); track img.id) {
              <figure class="act__figure"><img [src]="img.url" [alt]="img.alt" /></figure>
            }
          </div>

          @if (actualites().length > 1) {
            <div class="act__nav">
              <button type="button" class="act__fleche" [disabled]="index() === 0" aria-label="Actualité précédente" (click)="precedente()">‹</button>
              <span class="act__compteur" role="status">{{ index() + 1 }} / {{ actualites().length }}</span>
              <button
                type="button"
                class="act__fleche"
                [disabled]="index() === actualites().length - 1"
                aria-label="Actualité suivante"
                (click)="suivante()"
              >›</button>
            </div>
          }

        </div>
      </div>
    </div>
  `,
  styles: `
    /* Panneau : deux colonnes quand une image accompagne l'annonce, une seule sinon. Angles francs
       et fond blanc plein, conformément au modèle — pas d'en-tête coloré. */
    .act {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      width: min(72rem, 95vw);
      /* Hauteur plancher : une annonce courte ne doit pas réduire le panneau à un bandeau — le
         visuel manquerait d'ampleur. Bornée par la fenêtre pour rester ouvrable sur petit écran. */
      min-height: min(32rem, 78vh);
      max-height: 90vh;
      background: #fff;
      /* Ombre en deux couches : un halo large qui détache le panneau du fond, et un liseré
         rapproché qui en dessine le bord — sans bordure, donc sans trait de couleur. */
      box-shadow: 0 2px 8px rgb(15 23 42 / 12%), 0 32px 80px rgb(15 23 42 / 38%);
      overflow: hidden;
    }
    /* Colonnes déséquilibrées au profit du texte : l'annonce a plus à dire que l'image à montrer. */
    .act--illustre { grid-template-columns: 0.85fr 1.15fr; }

    .act__x {
      position: absolute;
      top: 0.9rem;
      right: 1rem;
      z-index: 2;
      appearance: none;
      border: 0;
      background: transparent;
      font-size: 1.4rem;
      line-height: 1;
      color: var(--n-500);
      cursor: pointer;
      padding: 0.3rem;

      &:hover { color: var(--n-800); }
      &:focus-visible { outline: 2px solid var(--n-800); outline-offset: 2px; }
    }

    /* L'image respire au lieu de toucher les bords du panneau (demande user). Le fond reste blanc :
       la marge appartient au modal, pas à une bande colorée derrière la photo. */
    .act__visuel {
      display: flex;
      padding: 1.5rem;
      background: #fff;
      overflow: hidden;
    }
    .act__visuel img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 2px; }

    .act__contenu {
      display: flex;
      flex-direction: column;
      padding: 3rem 2.6rem 2.4rem;
      overflow-y: auto;
      text-align: center;
    }

    .act__kicker { margin: 0 0 0.4rem; font-size: var(--text-xs); font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--n-500); }

    /* ⚠️ Serif SYSTÈME et non une fonte web : le projet auto-héberge ses polices (Plus Jakarta Sans,
       DM Mono) et n'en compte aucune à empattements. En ajouter une alourdirait le chargement de
       toute l'application pour un seul écran ; Georgia est présente partout, avec repli. */
    .act__titre {
      margin: 0;
      font-family: Georgia, 'Times New Roman', 'Liberation Serif', serif;
      font-size: clamp(1.9rem, 3.4vw, 2.5rem);
      line-height: 1.15;
      font-weight: 700;
      color: var(--n-900);
    }

    .act__date { margin: 0.6rem 0 0; font-size: var(--text-sm); color: var(--n-500); }

    /* Le corps reprend l'alignement à gauche : listes et paragraphes se lisent mal centrés. */
    .act__corps { margin-top: 1.6rem; text-align: left; }

    .act__figure { margin: 1rem 0 0; }
    .act__figure img { display: block; max-width: 100%; height: auto; margin: 0 auto; }

    .act__nav { display: flex; align-items: center; justify-content: center; gap: 0.9rem; margin-top: 1.6rem; }
    .act__fleche {
      appearance: none;
      border: 1px solid var(--n-300);
      background: #fff;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      font-size: 1.1rem;
      line-height: 1;
      color: var(--n-700);
      cursor: pointer;

      &:disabled { opacity: .35; cursor: default; }
      &:not(:disabled):hover { background: var(--n-100); }
      &:focus-visible { outline: 2px solid var(--n-800); outline-offset: 2px; }
    }
    .act__compteur { font-size: var(--text-sm); color: var(--n-500); font-variant-numeric: tabular-nums; }

    /* Sous 52rem, l'image passe au-dessus du texte plutôt que de comprimer les deux colonnes. */
    @media (max-width: 52rem) {
      .act--illustre { grid-template-columns: 1fr; }
      .act__visuel { max-height: 15rem; padding: 1.25rem 1.25rem 0; }
      .act__contenu { padding: 2.2rem 1.5rem 1.8rem; }
    }
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
  /** Première image : elle occupe la colonne de gauche et donne sa mise en page au modal. */
  readonly visuel = computed(() => this.imagesCourantes()[0] ?? null);
  /** Les suivantes accompagnent le texte, dans le corps de l'annonce. */
  readonly imagesSecondaires = computed(() => this.imagesCourantes().slice(1));

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
