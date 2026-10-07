import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { RabaisOffre } from '../../core/securite/scellement';

export type { RabaisOffre };

/**
 * ⚠️ Rabais structuré (arbitrage du pilote Q4, 07/10 ; `demande-backend-2026-10-07-rabais-structure.md`, livré back 3c76a59).
 *
 * Le contrôle **avant le scellement** — le serveur ne lit l'offre qu'à l'ouverture des plis (ADR-0013) ; il y rejoue les mêmes règles,
 * en alertes de séance de mêmes codes. `null` : rien à redire.
 * - `RABAIS_INVALIDE` : valeur nulle ou négative, pourcentage d'au moins 100, montant supérieur au montant hors taxes de l'acte ;
 * - `RABAIS_LOTS` : condition `LOTS` sans au moins deux lots, sans le lot de l'offre, ou avec un lot que la fiche ne connaît pas.
 * Pour une procédure non allotie, le lot de l'offre est le lot 1 (contrat).
 */
export function controlerRabais(r: RabaisOffre | null, montantHt: number | null | undefined, lotOffre: number | null, lotsFiche: readonly number[]): { code: 'RABAIS_INVALIDE' | 'RABAIS_LOTS'; message: string } | null {
  if (!r) return null;
  if (!(r.valeur > 0)) return { code: 'RABAIS_INVALIDE', message: 'Le rabais doit être supérieur à zéro.' };
  if (r.nature === 'POURCENTAGE' && r.valeur >= 100) return { code: 'RABAIS_INVALIDE', message: 'Un rabais en pourcentage est inférieur à 100 %.' };
  if (r.nature === 'MONTANT' && montantHt != null && r.valeur > montantHt) return { code: 'RABAIS_INVALIDE', message: 'Le rabais dépasse le montant hors taxes de l’offre.' };
  if (r.condition === 'LOTS') {
    const lots = r.lots ?? [];
    const lot = lotOffre ?? 1;
    const connus = lotsFiche.length ? lotsFiche : [1];
    if (lots.length < 2) return { code: 'RABAIS_LOTS', message: 'Un rabais lié à l’attribution de plusieurs lots en cite au moins deux.' };
    if (!lots.includes(lot)) return { code: 'RABAIS_LOTS', message: `Le lot de cette offre (lot ${lot}) doit figurer parmi les lots du rabais.` };
    const inconnus = lots.filter((l) => !connus.includes(l));
    if (inconnus.length) return { code: 'RABAIS_LOTS', message: `Lot(s) inconnu(s) de la procédure : ${inconnus.join(', ')}.` };
  }
  return null;
}

/** La phrase lue, sur le modèle de la lecture du serveur (« 2 % du montant hors taxes », « … si les lots 1, 2 sont attribués »). */
export function phraseRabais(r: RabaisOffre): string {
  const base = r.nature === 'POURCENTAGE' ? `${new Intl.NumberFormat('fr-FR').format(r.valeur)} % du montant hors taxes` : `${new Intl.NumberFormat('fr-FR').format(r.valeur)} Ariary hors taxes`;
  return r.condition === 'LOTS' && r.lots?.length ? `${base}, si les lots ${[...r.lots].sort((a, b) => a - b).join(', ')} sont attribués au candidat` : base;
}

type Choix = 'AUCUN' | 'POURCENTAGE' | 'MONTANT';

/**
 * La saisie du rabais au dépôt : aucun, un pourcentage ou un montant ; sans condition, ou lié à l'attribution de plusieurs lots (cases
 * des lots de la procédure) ; une phrase facultative. Le contrôle s'affiche sous le champ ; le formulaire de dépôt le compte parmi les
 * manques.
 */
@Component({
  selector: 'app-rabais-offre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="ro" [disabled]="desactive()">
      <legend class="form-label">Rabais (facultatif)</legend>
      <div class="ro__choix">
        <label><input type="radio" name="ro-nature" [checked]="choix() === 'AUCUN'" (change)="nature('AUCUN')" /> Aucun rabais</label>
        <label><input type="radio" name="ro-nature" [checked]="choix() === 'POURCENTAGE'" (change)="nature('POURCENTAGE')" /> Un pourcentage</label>
        <label><input type="radio" name="ro-nature" [checked]="choix() === 'MONTANT'" (change)="nature('MONTANT')" /> Un montant hors taxes</label>
      </div>
      @if (rabais(); as r) {
        <div class="ro__ligne">
          <label class="form-group ro__valeur">
            <span class="form-label">{{ r.nature === 'POURCENTAGE' ? 'Pourcentage (%)' : 'Montant (Ariary, hors taxes)' }}</span>
            <input class="form-control" type="number" min="0" [step]="r.nature === 'POURCENTAGE' ? 0.01 : 1" [value]="r.valeur || ''" (input)="poser({ valeur: +$any($event.target).value || 0 })" />
          </label>
          <label class="form-group ro__phrase">
            <span class="form-label">Votre formulation (facultative)</span>
            <input class="form-control" type="text" [value]="r.libelle ?? ''" (input)="poser({ libelle: $any($event.target).value || null })" />
          </label>
        </div>
        @if (lots().length > 1) {
          <div class="ro__choix">
            <label><input type="radio" name="ro-cond" [checked]="r.condition === 'AUCUNE'" (change)="poser({ condition: 'AUCUNE', lots: null })" /> Sans condition</label>
            <label><input type="radio" name="ro-cond" [checked]="r.condition === 'LOTS'" (change)="poser({ condition: 'LOTS', lots: lotOffre() != null ? [lotOffre()!] : [] })" /> Seulement si plusieurs lots me sont attribués</label>
          </div>
          @if (r.condition === 'LOTS') {
            <div class="ro__lots" role="group" aria-label="Lots dont l'attribution déclenche le rabais">
              @for (l of lots(); track l) {
                <label><input type="checkbox" [checked]="r.lots?.includes(l)" (change)="basculer(l, $any($event.target).checked)" /> Lot {{ l }}</label>
              }
            </div>
          }
        }
        <p class="text-sm ro__lecture">Lu en séance : « {{ phrase(r) }} ».</p>
        @if (erreur(); as e) { <p class="form-error" role="alert">{{ e.message }}</p> }
      }
    </fieldset>
  `,
  styles: `
    .ro { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .ro__choix, .ro__lots { display: flex; gap: 1rem; flex-wrap: wrap; font-size: var(--text-sm); }
    .ro__ligne { display: grid; grid-template-columns: 1fr 2fr; gap: 0.5rem; }
    .ro__lecture { margin: 0; color: var(--n-500); }
    @media (max-width: 700px) { .ro__ligne { grid-template-columns: 1fr; } }
  `,
})
export class RabaisOffreSaisie {
  readonly rabais = input<RabaisOffre | null>(null);
  /** Les lots de la procédure ; un seul : pas de condition de lots. */
  readonly lots = input<readonly number[]>([]);
  readonly lotOffre = input<number | null>(null);
  readonly montantHt = input<number | null | undefined>(null);
  readonly desactive = input(false);
  readonly modifie = output<RabaisOffre | null>();

  readonly phrase = phraseRabais;
  readonly choix = computed<Choix>(() => this.rabais()?.nature ?? 'AUCUN');
  readonly erreur = computed(() => controlerRabais(this.rabais(), this.montantHt(), this.lotOffre(), this.lots()));

  nature(c: Choix): void {
    if (c === 'AUCUN') {
      this.modifie.emit(null);
      return;
    }
    const r = this.rabais();
    this.modifie.emit({ nature: c, valeur: r?.nature === c ? r.valeur : 0, condition: r?.condition ?? 'AUCUNE', lots: r?.lots ?? null, libelle: r?.libelle ?? null });
  }

  poser(p: Partial<RabaisOffre>): void {
    const r = this.rabais();
    if (r) this.modifie.emit({ ...r, ...p });
  }

  basculer(lot: number, coche: boolean): void {
    const r = this.rabais();
    if (!r) return;
    const lots = new Set(r.lots ?? []);
    if (coche) lots.add(lot);
    else lots.delete(lot);
    this.modifie.emit({ ...r, lots: [...lots].sort((a, b) => a - b) });
  }
}
