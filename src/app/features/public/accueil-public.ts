import { ChangeDetectionStrategy, Component, DOCUMENT, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';

import { Icone } from '../../shared/ui/icone';
import { AUDIENCES, AudiencePublique, CONTENU_PUBLIC, Fragment, audienceDepuis } from './accueil-public-libelles';

/**
 * ENTRÉE PUBLIQUE de PRS 2.0 (`/accueil/:audience`) — proposition du 2026-09-22, arbitrée : la racine hors session y
 * mène (`authGuard`), un connecté en est renvoyé vers son « À faire » (`accueilPublicGuard`). Hors coquille : pas
 * de barre latérale, pas de session, aucune requête. Adaptée du modèle « portail » (e-marchespublics) : barre du
 * haut avec deux onglets d'audience et le bouton Connexion, barre secondaire « ce que vous pouvez faire », bannière
 * en dégradé (pas de photo) portant le titre, la promesse, les actions et trois repères fixes, puis un titre de
 * section et trois cartes dont les mots-clés sont des liens. `/login` et `/inscription` sont inchangés.
 */
@Component({
  selector: 'app-accueil-public',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icone],
  templateUrl: './accueil-public.html',
  styleUrl: './accueil-public.scss',
})
export class AccueilPublic {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  readonly audiences = AUDIENCES;
  /** Audience de l'URL ; une valeur inconnue est ramenée à `prmp` (et l'URL corrigée). */
  readonly audience = toSignal(this.route.paramMap.pipe(map((p) => audienceDepuis(p.get('audience')))), { initialValue: 'prmp' as AudiencePublique });
  readonly contenu = computed(() => CONTENU_PUBLIC[this.audience()]);

  constructor() {
    effect(() => {
      const brut = this.route.snapshot.paramMap.get('audience');
      if (brut && brut !== this.audience()) void this.router.navigate(['/accueil', this.audience()], { replaceUrl: true });
      this.document.title = `${this.contenu().onglet} — PRS 2.0`;
    });
  }

  onglet(a: AudiencePublique): string {
    return CONTENU_PUBLIC[a].onglet;
  }

  /** Une ancre (« #circuit ») fait défiler la page ; le routeur n'est pas concerné. */
  estAncre(lien: string): boolean {
    return lien.startsWith('#');
  }

  versAncre(lien: string, ev: Event): void {
    ev.preventDefault();
    this.document.getElementById(lien.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  estMot(f: Fragment): f is { mot: string; lien?: string } {
    return typeof f !== 'string';
  }
}
