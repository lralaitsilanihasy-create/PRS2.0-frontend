import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { ApiError, erreursParChamp } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { CodeMotifRestreint, MotifRestreint } from '../../../models';
import { FicheMarcheService } from '../../../services/fiche-marche.services';

/** Les quatre cas de la loi n° 2016-055, art. 38-IV, dans son ordre et ses mots ; la phrase de la loi seulement quand elle dit plus que le libellé. */
export const CAS_RESTREINT: readonly { code: CodeMotifRestreint; rang: string; libelle: string; texte: string | null }[] = [
  { code: 'URGENCE_AVEREE', rang: '1°', libelle: 'Urgence avérée', texte: null },
  { code: 'CONFIDENTIEL', rang: '2°', libelle: 'Caractère confidentiel', texte: 'Les prestations objet du marché revêtent un caractère confidentiel.' },
  { code: 'PRESTATAIRE_DEFAILLANT', rang: '3°', libelle: 'Défaillance du prestataire', texte: 'Faire exécuter des prestations en lieu et place d’un prestataire défaillant.' },
  { code: 'PETIT_NOMBRE', rang: '4°', libelle: 'Petit nombre de prestataires', texte: 'Seul un petit nombre de prestataires sont susceptibles d’exécuter le marché.' },
];

export const JUSTIFICATION_MAX = 4000;

/**
 * ⚠️ 02/11 (V155, demande « appel-offres-restreint », B2) — **le motif du recours à l'appel d'offres restreint**, à l'étape de
 * cadrage d'une ligne en mode restreint (`FicheMarche.modeRestreint`, PI exclues). L'un des quatre cas de la loi (art. 38-IV) et sa
 * justification ; sans eux, le bilan porte le bloquant `MOTIF_RESTREINT`. Lu avec la fiche (pas d'appel en plus), écrit par sa
 * route propre ; figé à la validation, recopié à la révision. Les pièces justificatives sont une pièce du dossier (`JUSTIFICATIF_AOR`).
 */
@Component({
  selector: 'app-motif-restreint',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mr" id="fm-motif-restreint" aria-labelledby="mr-t" [class.mr--manque]="!motif() && !lecture()">
      <div class="mr__tete">
        <h3 id="mr-t" class="mr__t">Motif du recours à l’appel d’offres restreint</h3>
        @if (!motif() && !lecture()) { <span class="mr__manque">à saisir avant de valider</span> }
        <span class="mr__ref">Loi n° 2016-055, art. 38-IV — accord préalable de la Commission</span>
      </div>
      @if (lecture()) {
        @if (motif(); as m) {
          <p class="mr__lecture"><b>{{ m.libelle || libelleDe(m.motif) }}</b></p>
          <p class="mr__lecture mr__lecture--texte">{{ m.justification }}</p>
        } @else {
          <p class="mr__lecture">Aucun motif saisi.</p>
        }
      } @else {
        <div class="mr__opts" role="radiogroup" aria-label="Cas de recours à l’appel d’offres restreint">
          @for (c of cas; track c.code) {
            <label class="mr__opt" [class.mr__opt--on]="choix() === c.code">
              <input type="radio" name="motif-restreint" [value]="c.code" [checked]="choix() === c.code" (change)="choix.set(c.code)" />
              <span class="mr__opt-l"><span class="mr__rang">{{ c.rang }}</span> {{ c.libelle }}</span>
              @if (c.texte) { <span class="mr__opt-t">{{ c.texte }}</span> }
            </label>
          }
        </div>
        @if (erreurs().get('motif'); as e) { <span class="form-error">{{ e }}</span> }
        <label class="mr__champ">
          <span class="mr__champ-l">Justification</span>
          <span class="mr__aide">Les faits qui fondent ce cas : la fiche de présentation la reprend à la ligne « Justification (si DAOR) ». Les pièces qui l’établissent se joignent au dossier (pièce facultative « Pièces justificatives du recours à l’appel d’offres restreint »).</span>
          <textarea class="form-control" rows="4" [maxLength]="max" [value]="justification()" (input)="justification.set($any($event.target).value)"></textarea>
          <span class="mr__compte">{{ justification().length }} / {{ max }}</span>
        </label>
        @if (erreurs().get('justification'); as e) { <span class="form-error">{{ e }}</span> }
        <div class="mr__pied">
          <button type="button" class="btn btn-primary btn-sm" [disabled]="!pret() || !modifie() || saving()" (click)="enregistrer()">
            {{ saving() ? 'Enregistrement…' : 'Enregistrer le motif' }}
          </button>
          @if (motif()?.saisiLe; as le) { <span class="mr__aide">enregistré le {{ dateFr(le) }}</span> }
        </div>
      }
    </section>
  `,
  styles: `
    .mr { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.8rem 1rem; margin-bottom: 0.9rem; border: 1px solid var(--bordure); border-radius: 10px; background: var(--carte-fond); }
    .mr--manque { border-left: 3px solid var(--examen-texte); }
    .mr__tete { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem 0.75rem; }
    .mr__t { margin: 0; font-size: 0.95rem; font-weight: 500; }
    .mr__manque { color: var(--examen-texte); font-weight: 500; font-size: 0.72rem; text-transform: uppercase; }
    .mr__ref { margin-left: auto; font-size: 0.76rem; color: var(--texte-secondaire); }
    .mr__opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.5rem; }
    .mr__opt { position: relative; display: flex; flex-direction: column; gap: 0.15rem; padding: 0.5rem 0.7rem; border: 1px solid var(--n-300); border-radius: 9px; background: var(--carte-fond); cursor: pointer; }
    .mr__opt input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .mr__opt--on { border-color: var(--menu-fond); background: var(--p-50); }
    .mr__opt:has(input:focus-visible) { outline: 2px solid var(--p-600); outline-offset: 2px; }
    .mr__opt-l { font-weight: 500; font-size: 0.86rem; }
    .mr__rang { color: var(--texte-secondaire); font-variant-numeric: tabular-nums; }
    .mr__opt-t { font-size: 0.78rem; color: var(--texte-secondaire); line-height: 1.4; }
    .mr__champ { display: flex; flex-direction: column; gap: 0.25rem; }
    .mr__champ-l { font-weight: 500; font-size: 0.86rem; }
    .mr__aide, .mr__compte { font-size: 0.76rem; color: var(--texte-secondaire); }
    .mr__compte { align-self: flex-end; font-variant-numeric: tabular-nums; }
    .mr__pied { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .mr__lecture { margin: 0; font-size: 0.86rem; line-height: 1.5; }
    .mr__lecture--texte { white-space: pre-wrap; padding: 0.45rem 0.6rem; border-radius: 8px; background: var(--n-100); }
  `,
})
export class MotifRestreintFiche {
  private readonly fiches = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  /** Le motif servi avec la fiche (`FicheMarche.motifRestreint`), nul tant qu'il n'est pas saisi. */
  readonly motif = input<MotifRestreint | null>(null);
  /** Fiche figée ou lecteur de la Commission : le motif se lit. */
  readonly lecture = input(false);
  /** Le motif vient d'être enregistré : la page le reporte sur la fiche et relit son bilan. */
  readonly enregistre = output<MotifRestreint>();

  readonly cas = CAS_RESTREINT;
  readonly max = JUSTIFICATION_MAX;
  readonly choix = signal<CodeMotifRestreint | null>(null);
  readonly justification = signal('');
  readonly saving = signal(false);
  readonly erreurs = signal<Map<string, string>>(new Map());

  readonly pret = computed(() => !!this.choix() && !!this.justification().trim());
  readonly modifie = computed(() => {
    const m = this.motif();
    return this.choix() !== (m?.motif ?? null) || this.justification().trim() !== (m?.justification ?? '').trim();
  });

  constructor() {
    effect(() => {
      const m = this.motif();
      this.choix.set(m?.motif ?? null);
      this.justification.set(m?.justification ?? '');
    });
  }

  libelleDe(code: string): string {
    return CAS_RESTREINT.find((c) => c.code === code)?.libelle ?? code;
  }

  dateFr(iso: string): string {
    const [d, h] = iso.split('T');
    const [a, m, j] = d.split('-');
    return `${j}/${m}/${a}${h ? ' à ' + h.slice(0, 5) : ''}`;
  }

  enregistrer(): void {
    const motif = this.choix();
    if (!motif || this.saving() || this.lecture()) return;
    this.saving.set(true);
    this.fiches.enregistrerMotifRestreint(this.idDmc(), { motif, justification: this.justification().trim() }).subscribe({
      next: (m) => {
        this.saving.set(false);
        this.erreurs.set(new Map());
        this.toast.success('Motif du recours enregistré.');
        this.enregistre.emit(m);
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        const parChamp = erreursParChamp(e);
        this.erreurs.set(parChamp);
        if (!parChamp.size) this.toast.error(e?.message ?? 'Le motif n’a pas pu être enregistré.');
      },
    });
  }
}
