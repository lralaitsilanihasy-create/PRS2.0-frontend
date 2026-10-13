import { Injectable, inject, signal } from '@angular/core';

import { ParametreSigmpTransition } from '../../models';
import { ParametreSigmpTransitionService } from '../../services';

/**
 * ⚠️ Manuel révisé, R3a (13/10) — le pied d'équivalence SIGMP, lu une fois pour toute la session et partagé par les documents que le
 * front imprime lui-même (l'AGPM dérivé) : « Document produit par la plateforme PRS 2.0 en application de la décision n° … du … »,
 * ou « Projet — équivalence SIGMP en attente ». Les avis et lettres le reçoivent du serveur, à l'impression.
 */
@Injectable({ providedIn: 'root' })
export class SigmpTransitionStore {
  private readonly service = inject(ParametreSigmpTransitionService);
  private demande = false;

  readonly parametres = signal<ParametreSigmpTransition | null>(null);

  /** Le pied à imprimer (`null` tant qu'il n'est pas lu, ou si la lecture a échoué : le document se passe alors de pied). */
  pied(): string | null {
    this.charger();
    return this.parametres()?.pied ?? null;
  }

  /** Lecture paresseuse, une seule fois ; un échec reste silencieux (le pied n'est qu'une mention). */
  charger(): void {
    if (this.demande) return;
    this.demande = true;
    this.service.lire().subscribe({ next: (p) => this.parametres.set(p), error: () => this.parametres.set(null) });
  }

  /** L'écran d'administration vient de régler les paramètres : la session voit la nouvelle valeur sans relire. */
  poser(p: ParametreSigmpTransition): void {
    this.demande = true;
    this.parametres.set(p);
  }
}
