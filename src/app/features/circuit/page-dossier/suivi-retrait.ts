import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap } from 'rxjs';

import { DemandeRetrait, Dossier } from '../../../models';
import { DemandeRetraitService } from '../../../services';
import { StatutBadge, statutDemandeRetraitLabel } from '../../../shared/circuit';
import { jourMois } from '../../../shared/circuit/frise-delai';
import { Icone } from '../../../shared/ui/icone';

/** Ce que la PRMP lit de sa demande de retrait sur la page du dossier. */
export interface SuiviRetraitVue {
  statut: 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE';
  /** Libellé du statut, celui de « Mes demandes » (`statutDemandeRetraitLabel`). */
  libelle: string;
  /** Phrase d'état : jamais le nom ni le matricule du décideur (règle C2). */
  texte: string;
  /** Motif du refus, tel que la PRMP le lit déjà dans « Mes demandes ». */
  motifRefus: string | null;
}

const CNM = 'la Commission nationale des marchés';

/**
 * État de la DERNIÈRE demande de retrait de ce dossier, pour la PRMP (lot L4-F5). Règles PURES :
 * - en attente : « déposée le … », décision attendue de la CNM ;
 * - refusée : la date et le motif du refus — le circuit s'est poursuivi ;
 * - acceptée : seulement tant que le dossier est resté en brouillon. Resoumis, il a repris un circuit
 *   neuf : l'acceptation n'est plus son état.
 *
 * ⚠️ Règle C2 : `imCtrlCc` (matricule du décideur) arrive dans la réponse et n'est JAMAIS lu ici — la
 * décision est celle de « la Commission nationale des marchés ».
 */
export function suiviRetrait(demandes: readonly DemandeRetrait[], dossier: Dossier): SuiviRetraitVue | null {
  const derniere = demandes.filter((r) => r.idDossier === dossier.idDossier).sort((a, b) => (b.idDemandeRetrait ?? 0) - (a.idDemandeRetrait ?? 0))[0];
  if (!derniere) return null;
  const le = (date: string | null | undefined): string => (jourMois(date) ? ` le ${jourMois(date)}` : '');
  switch (derniere.statut) {
    case 'EN_ATTENTE':
      return { statut: 'EN_ATTENTE', libelle: statutDemandeRetraitLabel('EN_ATTENTE'), texte: `Demande de retrait déposée${le(derniere.dateDemande)}, en attente de la décision de ${CNM}.`, motifRefus: null };
    case 'REFUSEE':
      return { statut: 'REFUSEE', libelle: statutDemandeRetraitLabel('REFUSEE'), texte: `Demande de retrait refusée${le(derniere.dateDecision)} par ${CNM} : le dossier poursuit son circuit.`, motifRefus: derniere.obsDecision?.trim() || null };
    case 'ACCEPTEE':
      return dossier.statut === 'BROUILLON'
        ? { statut: 'ACCEPTEE', libelle: statutDemandeRetraitLabel('ACCEPTEE'), texte: `Demande de retrait acceptée${le(derniere.dateDecision)} par ${CNM} : le dossier est revenu en brouillon.`, motifRefus: null }
        : null;
    default:
      return null;
  }
}

/**
 * Suivi de sa demande de retrait par la PRMP, dans le panneau de l'étape (page dossier, lot L4-F5).
 * Lecture silencieuse de `GET /api/demande-retraits` (ses demandes, filtrées par le serveur) — pas de
 * `mes-demandes`, qui marquerait l'écran « Demandes de retrait » consulté et remettrait son compteur à zéro.
 * Rien ne s'affiche sans demande sur ce dossier, ni si la lecture échoue (enrichissement).
 *
 * Monté pour la PRMP seulement : l'UGPM n'a pas l'écran des demandes de retrait, la page n'en demande rien.
 */
@Component({
  selector: 'app-suivi-retrait',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, StatutBadge],
  template: `
    @if (vue(); as v) {
      <div class="sr sr--{{ v.statut }}">
        <p class="sr__ligne">
          <app-icone nom="undo" [taille]="16" />
          <app-statut-badge [statut]="v.statut" [label]="v.libelle" />
          <span>{{ v.texte }}</span>
        </p>
        @if (v.motifRefus) {
          <p class="sr__motif"><span class="sr__motif-l">Motif du refus</span> « {{ v.motifRefus }} »</p>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .sr { display: grid; gap: 0.3rem; margin-top: 0.2rem; padding: 0.5rem 0.75rem; border: 1px solid #dbe3ee; border-radius: 10px; background: #f8fafc; font-size: 0.875rem; color: #34405a; }
    .sr--ACCEPTEE { border-color: #a7f3d0; background: #f0fdf7; }
    .sr--REFUSEE { border-color: #fecaca; background: #fff7f7; }
    .sr__ligne { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.5rem; margin: 0; line-height: 1.4; }
    .sr__ligne app-icone { color: #0369a1; }
    .sr__motif { margin: 0; color: #152033; overflow-wrap: anywhere; white-space: pre-line; }
    .sr__motif-l { margin-right: 0.35rem; font-weight: 700; color: #5b6784; }
  `,
})
export class SuiviRetrait {
  readonly dossier = input.required<Dossier>();

  private readonly service = inject(DemandeRetraitService);
  private readonly demandes = signal<readonly DemandeRetrait[]>([]);
  private readonly lecture$ = new Subject<void>();

  readonly vue = computed(() => suiviRetrait(this.demandes(), this.dossier()));

  constructor() {
    this.lecture$
      .pipe(
        switchMap(() => this.service.listeSilencieuse().pipe(catchError(() => of<DemandeRetrait[]>([])))),
        map((liste) => liste ?? []),
        takeUntilDestroyed(),
      )
      .subscribe((liste) => this.demandes.set(liste));
    // Dossier relu (après un geste, ou un autre dossier) : ses demandes aussi.
    effect(() => {
      this.dossier();
      untracked(() => this.lecture$.next());
    });
  }
}
