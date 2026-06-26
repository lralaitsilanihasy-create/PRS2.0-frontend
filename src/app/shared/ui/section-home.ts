import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

/** Lien affiché dans un hub de section. */
export interface SectionLink {
  label: string;
  path: string;
}

/**
 * Hub de section générique : titre + grille de liens vers des sous-écrans.
 * Le titre et les liens sont fournis via `route.data` (`title`, `links`).
 */
@Component({
  selector: 'app-section-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="section">
      <header class="page-header">
        <h1 class="page-title">{{ title }}</h1>
      </header>
      <div class="section__grid">
        @for (link of links; track link.path) {
          <a class="section__card" [routerLink]="link.path">{{ link.label }}</a>
        }
      </div>
    </section>
  `,
  styles: `
    .section__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
      gap: 1rem;
    }
    .section__card {
      display: block;
      padding: 1.25rem;
      background: #fff;
      border: 1px solid var(--c-100);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-md);
      text-decoration: none;
      color: var(--c-800);
      font-weight: 600;
      transition: var(--transition);
    }
    .section__card:hover {
      border-color: var(--c-400);
      box-shadow: var(--shadow-lg);
      transform: translateY(-1px);
      text-decoration: none;
    }
  `,
})
export class SectionHome {
  private readonly route = inject(ActivatedRoute);
  protected readonly title = this.route.snapshot.data['title'] as string;
  protected readonly links = this.route.snapshot.data['links'] as SectionLink[];
}
