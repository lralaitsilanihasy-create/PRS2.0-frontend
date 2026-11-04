import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { LigneEligible } from '../../../models';
import { LIBELLES_ETAT_ATTRIBUTION } from '../../circuit/dossier/instantanes-vues';

/** Un écran de la procédure en ligne d'une ligne du plan : son nom, sa route, et ce qu'il y a à y voir (un compte, un état). */
export interface LienProcedure {
  libelle: string;
  commandes: (string | number)[];
  n: string | null;
}

/** Statuts d'un dossier de mise en concurrence sorti du circuit avec un avis : la procédure est lancée. */
const CLOS: ReadonlySet<string> = new Set(['CLOTURE', 'DECISION_TRANSMISE_SIGMP']);

/**
 * ⚠️ 04/11 (pilote, maquette « menu PRMP recentré », temps 1) — les écrans de la procédure en ligne d'une ligne du plan, pour que
 * « Appels d'offres en cours » n'offre plus rien que le plan n'offre. Les règles sont celles des liens de la fiche (`fiche-marche.ts`,
 * `lienCao`, `lienDepots`…) : remise électronique, au moins une version validée (`modeRemise` n'est servi qu'alors), dépôts et retraits
 * à la PRMP seule, commission dès la fiche (hors remise papier), séance une fois le dossier clôturé, évaluation dès qu'elle est ouverte.
 * La fiche elle-même n'y figure qu'avec son dossier : avant, c'est le bouton « Reprendre les informations du DAO » de la ligne.
 */
export function liensProcedure(e: LigneEligible, role: string | null): LienProcedure[] {
  if (!e.dejaDao || e.idDmc == null) return [];
  const id = e.idDmc;
  const dao = (...suite: string[]): (string | number)[] => ['/prmp', 'dao', id, ...suite];
  const prmp = role === 'PRMP';
  const electronique = e.modeRemise === 'ELECTRONIQUE';
  const publiable = e.modeRemise != null;
  const l: LienProcedure[] = [];
  if (e.dossier) l.push({ libelle: 'Ouvrir la fiche DAO', commandes: dao(), n: null });
  if (e.modeRemise !== 'PAPIER') l.push({ libelle: 'Commission d’appel d’offres', commandes: dao('cao'), n: null });
  if (e.categorie === 'PRESTATIONS_INTELLECTUELLES') l.push({ libelle: 'Appel à manifestation d’intérêt', commandes: dao('ami'), n: null });
  if (!electronique || !publiable) return l;
  if (prmp) {
    const n = e.nbOffres ?? 0;
    l.push({ libelle: 'Dépôts des offres', commandes: dao('depots'), n: n ? `${n} offre${n > 1 ? 's' : ''}` : null });
    l.push({ libelle: 'Retraits du DAO', commandes: dao('retraits'), n: null });
  }
  l.push({ libelle: 'Questions des candidats', commandes: dao('questions'), n: null });
  const recus = e.recusEnAttente ?? 0;
  l.push({ libelle: 'Reçus des frais', commandes: dao('recus'), n: recus ? `${recus} à valider` : null });
  if (e.dossier && CLOS.has(e.dossier.statut)) l.push({ libelle: 'Séance d’ouverture', commandes: ['/procedure', id, 'seance'], n: null });
  const a = e.attributions?.[0];
  if (a) l.push({ libelle: 'Évaluation des offres', commandes: ['/procedure', id, 'evaluation'], n: LIBELLES_ETAT_ATTRIBUTION[a.etat] ?? a.etat });
  return l;
}

/**
 * Le numéro de la procédure, une fois une version validée : avant, le serveur sert la référence du plan (règle de l'en-tête), qui
 * n'est pas un numéro de procédure.
 */
export function numeroProcedure(e: Pick<LigneEligible, 'numeroProcedure' | 'modeRemise'>): string | null {
  return e.modeRemise != null ? e.numeroProcedure ?? null : null;
}

/**
 * ⚠️ 04/11 (pilote, temps 1) — la rangée « Procédure en ligne » d'une ligne du plan : le numéro de la procédure, son état, et les
 * écrans où elle se conduit. Sous la barre du dossier de mise en concurrence quand il existe ; seule, en carte, avant.
 */
@Component({
  selector: 'app-procedure-ligne',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="pl" role="group" [attr.aria-label]="'Procédure en ligne' + (numero() ? ' ' + numero() : '')">
      <div class="pl__tete">
        <span class="pl__k">Procédure en ligne</span>
        @if (numero(); as n) { <span class="pl__r">{{ n }}</span> }
        @if (etat()) { <span class="pl__etat">{{ etat() }}</span> }
      </div>
      <div class="pl__liens">
        @for (l of liens(); track l.libelle) {
          <a class="btn btn-outline btn-sm" [routerLink]="l.commandes">{{ l.libelle }}@if (l.n) { <span class="pl__n">{{ l.n }}</span> }</a>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .pl { display: grid; gap: 0.5rem; padding-top: 0.6rem; border-top: 1px solid var(--bordure); }
    /* Seule, en carte (fiche sans dossier) : la carte de l'hôte fait le cadre. */
    :host(.dl__carte) .pl { padding-top: 0; border-top: 0; }
    .pl__tete { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; }
    .pl__k { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-secondaire); }
    .pl__r { font-weight: 500; }
    .pl__etat { font-size: 0.8125rem; color: var(--texte-secondaire); }
    .pl__liens { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .pl__n { display: inline-block; margin-left: 0.45rem; padding: 0.05rem 0.45rem; border-radius: 20px; background: var(--neutre-fond); color: var(--neutre-texte); font-size: 0.7rem; }
  `,
})
export class ProcedureLigne {
  private readonly auth = inject(AuthService);

  readonly ligne = input.required<LigneEligible>();
  readonly liens = computed(() => liensProcedure(this.ligne(), this.auth.role()));
  readonly numero = computed(() => numeroProcedure(this.ligne()));
  /** « remise électronique · fiche validée v1 » : ce que la ligne sait de sa procédure. */
  readonly etat = computed(() => {
    const e = this.ligne();
    const remise = e.modeRemise === 'ELECTRONIQUE' ? 'remise électronique' : e.modeRemise === 'PAPIER' ? 'remise papier' : null;
    const fiche = e.fiche ? (e.fiche.statut === 'VALIDEE' ? `fiche validée v${e.fiche.version}` : `fiche en brouillon v${e.fiche.version}`) : null;
    return [remise, fiche].filter(Boolean).join(' · ');
  });
}
