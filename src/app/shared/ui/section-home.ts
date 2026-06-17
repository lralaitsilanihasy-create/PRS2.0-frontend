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
      <h1 class="section__title">{{ title }}</h1>
      <div class="section__grid">
        @for (link of links; track link.path) {
          <a class="section__card" [routerLink]="link.path">{{ link.label }}</a>
        }
      </div>
    </section>
  `,
  styles: `
    .section__title {
      margin: 0 0 var(--cnm-space-4);
      font-size: var(--cnm-fs-lg);
    }
    .section__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
      gap: var(--cnm-space-3);
    }
    .section__card {
      display: block;
      padding: var(--cnm-space-4);
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: var(--cnm-radius);
      text-decoration: none;
      color: var(--cnm-text);
      font-weight: var(--cnm-fw-medium);
    }
    .section__card:hover {
      border-color: var(--cnm-brand);
      text-decoration: none;
    }
  `,
})
export class SectionHome {
  private readonly route = inject(ActivatedRoute);
  protected readonly title = this.route.snapshot.data['title'] as string;
  protected readonly links = this.route.snapshot.data['links'] as SectionLink[];
}
