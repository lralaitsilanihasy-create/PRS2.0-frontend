import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, forkJoin, of } from 'rxjs';

import { LettreRenvoiService, PvExamenService } from '../../services';

/** Une carte du hub : ce qu'elle ouvre, ce qu'elle contient. */
interface CarteResultat {
  cle: 'projets' | 'definitifs' | 'lettres';
  icone: string;
  titre: string;
  /** Ce que l'utilisateur y trouve — une phrase, pas un libellé de menu répété. */
  description: string;
  /** Segment de la route ENFANT : la liste s'ouvre sous les cartes, sans quitter le hub. */
  suffixe: string;
  /** Libellé de l'unité comptée (accord au pluriel géré à l'affichage). */
  unite: string;
  /** `true` si le contenu appelle une action (mise en avant), `false` si c'est un fonds documentaire. */
  aTraiter: boolean;
}

const CARTES: CarteResultat[] = [
  {
    cle: 'projets',
    icone: '📝',
    titre: 'Projets de PV',
    description: "PV d'examen en cours de navette : à relire, à amender et à signer.",
    suffixe: 'pv',
    unite: 'projet',
    aTraiter: true,
  },
  {
    cle: 'definitifs',
    icone: '✅',
    titre: 'PV définitifs',
    description: 'PV signés par la Commission — consultables et téléchargeables.',
    suffixe: 'pv-definitifs',
    unite: 'PV',
    aTraiter: false,
  },
  {
    cle: 'lettres',
    icone: '✉',
    titre: 'Lettres de renvoi',
    description: 'Lettres adressées aux PRMP à l’issue de l’examen, et leur suivi.',
    suffixe: 'lettre-renvois',
    unite: 'lettre',
    aTraiter: false,
  },
];

/** Variante PRMP (demande user 2026-08-12) : SES PV définitifs et SES lettres de renvoi — pas de projets. */
const CARTES_PRMP: CarteResultat[] = [
  {
    cle: 'definitifs',
    icone: '📋',
    titre: 'PV définitifs',
    description: 'PV signés de vos dossiers — base de la rectification selon les observations.',
    suffixe: 'pv-definitifs',
    unite: 'PV',
    aTraiter: false,
  },
  {
    cle: 'lettres',
    icone: '✉',
    titre: 'Mes lettres de renvoi',
    description: 'Lettres qui vous sont adressées à l’issue de l’examen — pièces complémentaires à transmettre.',
    suffixe: 'lettre-renvois',
    unite: 'lettre',
    aTraiter: true,
  },
];

/**
 * **Résultat de l'examen** — écran de regroupement (demande user 2026-08-06 : « mettre dans un écran
 * appelé résultat examen, en card : Projets de PV, PV définitifs, Lettres de renvoi »).
 *
 * Les trois écrans existent déjà et ne changent pas : ce hub remplace trois entrées de menu par une
 * seule, et donne à chacune une carte qui dit ce qu'elle contient et combien. Même langage visuel que
 * « Mes dossiers » (cartes à liseré, compteur en pastille).
 *
 * Servi tel quel au **Président** et au **Chef de commission** : mêmes écrans, périmètre scopé par le
 * backend. La base de route est dérivée de l'URL courante — aucune duplication de composant.
 */
@Component({
  selector: 'app-resultat-examen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <section class="re">
      <header class="page-header">
        <div>
          <div class="page-subtitle">{{ sousTitre() }}</div>
          <h1 class="page-title">Examen de dossiers</h1>
        </div>
      </header>
      @if (estPrmp()) {
        <p class="re__intro">
          Ce que produit l'examen de vos dossiers : le <strong>PV définitif</strong> signé par la
          Commission, et la <strong>lettre de renvoi</strong> qui vous est adressée.
        </p>
      } @else {
        <p class="re__intro">
          Tout ce que produit l'examen d'un dossier : le <strong>projet de PV</strong> tant qu'il circule,
          le <strong>PV définitif</strong> une fois signé, et la <strong>lettre de renvoi</strong> adressée
          à la PRMP.
        </p>
      }

      <div class="re__grid">
        @for (c of cartes(); track c.cle) {
          <a
            class="re__card"
            [class.re__card--action]="c.aTraiter"
            [routerLink]="base() + '/resultat-examen/' + c.suffixe"
            routerLinkActive="re__card--ouverte"
          >
            <div class="re__head">
              <span class="re__chip" aria-hidden="true">{{ c.icone }}</span>
              <div class="re__titles">
                <h2 class="re__title">{{ c.titre }}</h2>
                <span class="re__count">
                  @if (chargement()) {
                    <span class="skeleton re__sk"></span>
                  } @else {
                    {{ libelleCompteur(c) }}
                  }
                </span>
              </div>
            </div>
            <p class="re__desc">{{ c.description }}</p>
            <span class="re__go">{{ estOuverte(c) ? 'Affiché ci-dessous ↓' : 'Ouvrir →' }}</span>
          </a>
        }
      </div>

      <!-- ⚠️ 2026-08-07 (demande user) — la liste s'affiche JUSTE SOUS les cartes : chaque carte est une
           route ENFANT, dont l'écran se rend ici. Les cartes restent visibles, on passe de l'une à
           l'autre sans revenir en arrière. -->
      <div class="re__liste">
        <router-outlet />
      </div>
    </section>
  `,
  styles: `
    .re { display: flex; flex-direction: column; gap: 1.15rem; }
    .re__intro { margin: -0.4rem 0 0; color: var(--n-500); max-width: 60rem; }
    /* Cartes centrées, comme les cartes de types de « Mes dossiers » (même convention UX). */
    .re__grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(18.5rem, 22rem));
      gap: 1.1rem; justify-content: center;
    }

    /* Même carte que « Mes dossiers » : liseré dégradé, élévation au survol. */
    .re__card {
      position: relative; display: flex; flex-direction: column; gap: 0.7rem;
      padding: 1.15rem 1.1rem 0.95rem; background: #fff; border: 1px solid var(--n-200);
      border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); overflow: hidden;
      text-decoration: none; color: inherit; transition: var(--transition);
    }
    .re__card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--n-200);
    }
    /* Seul ce qui appelle une action porte le liseré de marque : le reste est documentaire. */
    .re__card--action::before { background: var(--grad-primary); }
    .re__card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: var(--p-200); }

    /* Carte dont la liste est ouverte ci-dessous : elle reste désignée, sans élévation trompeuse. */
    .re__card--ouverte { border-color: var(--p-400); box-shadow: 0 0 0 2px var(--p-100), var(--shadow-md); }
    .re__card--ouverte::before { background: var(--grad-primary); }
    .re__head { display: flex; align-items: center; gap: 0.75rem; }
    .re__chip {
      flex-shrink: 0; width: 2.6rem; height: 2.6rem; display: inline-flex; align-items: center;
      justify-content: center; background: var(--p-50); color: var(--p-600); font-size: 1.15rem;
      border-radius: var(--radius-md); border: 1px solid var(--p-200);
    }
    .re__card--action .re__chip {
      background: var(--grad-primary); color: #fff; border-color: transparent;
      box-shadow: 0 3px 10px rgba(102, 126, 234, 0.35);
    }
    .re__titles { min-width: 0; flex: 1; display: flex; flex-direction: column; }
    .re__title { margin: 0; font-size: var(--text-md); font-weight: 700; color: var(--n-800); }
    .re__count { font-size: var(--text-sm); color: var(--n-500); font-variant-numeric: tabular-nums; }
    .re__desc { margin: 0; font-size: var(--text-sm); color: var(--n-500); line-height: 1.45; flex: 1; }
    .re__go { font-size: var(--text-sm); font-weight: 700; color: var(--p-600); }
    .re__sk { display: inline-block; width: 5rem; height: 0.8rem; border-radius: var(--radius-full); }
  `,
})
export class ResultatExamen implements OnInit {
  private readonly router = inject(Router);
  private readonly pvService = inject(PvExamenService);
  private readonly lettreService = inject(LettreRenvoiService);

  protected readonly chargement = signal(true);
  private readonly compteurs = signal<Record<CarteResultat['cle'], number>>({
    projets: 0,
    definitifs: 0,
    lettres: 0,
  });

  /** URL courante, suivie pour savoir quelle carte est ouverte (le hub reste monté pendant la navigation). */
  private readonly urlCourante = signal(this.router.url);

  /** `/president`, `/cc` ou `/prmp` selon le profil connecté — les suffixes de route sont identiques. */
  protected readonly base = computed(() => {
    const url = this.urlCourante();
    if (url.startsWith('/prmp')) return '/prmp';
    return url.startsWith('/cc') ? '/cc' : '/president';
  });
  /** Variante PRMP : deux cartes (SES PV définitifs, SES lettres), pas de projets de PV. */
  protected readonly estPrmp = computed(() => this.base() === '/prmp');
  protected readonly cartes = computed(() => (this.estPrmp() ? CARTES_PRMP : CARTES));
  protected readonly sousTitre = computed(() => {
    if (this.estPrmp()) return 'Domaine PRMP';
    return this.base() === '/cc' ? 'Domaine Chef de Commission' : 'Domaine Président';
  });

  constructor() {
    // Le hub ne se démonte pas quand on passe d'une carte à l'autre : c'est l'URL qui dit laquelle
    // est ouverte. On compare le DERNIER segment — « pv » est un préfixe de « pv-definitifs ».
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.urlCourante.set(this.router.url));
  }

  protected estOuverte(c: CarteResultat): boolean {
    const chemin = this.urlCourante().split('?')[0].split('#')[0];
    return chemin.split('/').filter(Boolean).pop() === c.suffixe;
  }

  ngOnInit(): void {
    // ⚠️ Une seule vague : les listes en parallèle, pas de spinners successifs. PRMP : ses PV définitifs
    // et SES lettres (`/mes-lettres`, réservé PRMP) — pas de projets de PV.
    const sources = this.estPrmp()
      ? { projets: of([]), definitifs: this.pvService.definitifs(), lettres: this.lettreService.getMesLettres() }
      : { projets: this.pvService.list(), definitifs: this.pvService.definitifs(), lettres: this.lettreService.getAll() };
    forkJoin(sources).subscribe({
      next: ({ projets, definitifs, lettres }) => {
        this.compteurs.set({
          projets: projets.length,
          definitifs: definitifs.length,
          lettres: lettres.length,
        });
        this.chargement.set(false);
      },
      // Le hub reste utilisable même si un décompte échoue : les cartes ouvrent leurs écrans.
      error: () => this.chargement.set(false),
    });
  }

  protected libelleCompteur(c: CarteResultat): string {
    const n = this.compteurs()[c.cle];
    if (!n) {
      return 'aucun élément';
    }
    return `${n} ${c.unite}${n > 1 && c.unite !== 'PV' ? 's' : ''}`;
  }
}
