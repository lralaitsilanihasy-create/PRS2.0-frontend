import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { LigneEligible } from '../../../models';
import { LIBELLES_ETAT_ATTRIBUTION } from '../../circuit/dossier/instantanes-vues';
import { EcranProcedure, OuvertureEcran } from './ecrans-procedure';

/** Un écran de la procédure en ligne d'une ligne du plan : son nom, sa route, et ce qu'il y a à y voir (un compte, un état). */
export interface LienProcedure {
  libelle: string;
  commandes: (string | number)[];
  n: string | null;
  /** ⚠️ 04/11 (pilote) — l'écran qui s'ouvre en fenêtre ; absent : une page (la fiche DAO, son parcours de saisie). */
  ecran?: EcranProcedure;
}

/** Statuts d'un dossier de mise en concurrence sorti du circuit avec un avis : la procédure est lancée. */
const CLOS: ReadonlySet<string> = new Set(['CLOTURE', 'DECISION_TRANSMISE_SIGMP']);

/**
 * ⚠️ 04/11 (pilote, maquette « menu PRMP recentré », temps 1) — les écrans de la procédure en ligne d'une ligne du plan, pour que
 * « Appels d'offres en cours » n'offre plus rien que le plan n'offre. Les règles sont celles des liens de la fiche (`fiche-marche.ts`,
 * `lienCao`, `lienDepots`…) : remise électronique, au moins une version validée (`modeRemise` n'est servi qu'alors), dépôts et retraits
 * à la PRMP seule, commission dès la fiche (hors remise papier), séance une fois le dossier clôturé, évaluation dès qu'elle est ouverte.
 * La fiche elle-même n'y figure qu'avec son dossier : avant, c'est le bouton « Reprendre les informations du DAO » de la ligne.
 * ⚠️ 04/11 (pilote, redondances) — la rangée ne répète pas les barres : la fiche sort une fois le dossier clôturé (figée, elle se lit dans
 * « Informations du DAO » de sa barre) ; la séance et l'évaluation sortent quand chaque lot attribué a son dossier de marché, dont la barre
 * porte « Séance d'ouverture » et « Rapport d'évaluation ». Tant que le dossier de marché manque, l'évaluation reste : c'est là qu'il se crée.
 */
export function liensProcedure(e: LigneEligible, role: string | null): LienProcedure[] {
  if (!e.dejaDao || e.idDmc == null) return [];
  const id = e.idDmc;
  const dao = (...suite: string[]): (string | number)[] => ['/prmp', 'dao', id, ...suite];
  const prmp = role === 'PRMP';
  const electronique = e.modeRemise === 'ELECTRONIQUE';
  const publiable = e.modeRemise != null;
  const l: LienProcedure[] = [];
  const clos = !!e.dossier && CLOS.has(e.dossier.statut);
  const dm = e.dossiersMarche ?? [];
  const marchesCrees = !!e.attributions?.length && e.attributions.every((a) => dm.some((d) => d.lot === a.lot));
  if (e.dossier && !clos) l.push({ libelle: 'Ouvrir la fiche DAO', commandes: dao(), n: null });
  if (e.modeRemise !== 'PAPIER') l.push({ libelle: 'Commission d’appel d’offres', commandes: dao('cao'), n: null, ecran: 'cao' });
  if (e.categorie === 'PRESTATIONS_INTELLECTUELLES') l.push({ libelle: 'Appel à manifestation d’intérêt', commandes: dao('ami'), n: null, ecran: 'ami' });
  if (!electronique || !publiable) return l;
  // ⚠️ 04/11 (pilote) — dans l'ordre du processus : le candidat paie les frais (reçu validé), retire le DAO, pose ses questions
  // (jusqu'à J−10), dépose son offre ; puis la séance d'ouverture et l'évaluation.
  const recus = e.recusEnAttente ?? 0;
  l.push({ libelle: 'Reçus des frais', commandes: dao('recus'), n: recus ? `${recus} à valider` : null, ecran: 'recus' });
  if (prmp) l.push({ libelle: 'Retraits du DAO', commandes: dao('retraits'), n: null, ecran: 'retraits' });
  l.push({ libelle: 'Questions des candidats', commandes: dao('questions'), n: null, ecran: 'questions' });
  if (prmp) {
    const n = e.nbOffres ?? 0;
    l.push({ libelle: 'Dépôts des offres', commandes: dao('depots'), n: n ? `${n} offre${n > 1 ? 's' : ''}` : null, ecran: 'depots' });
  }
  if (marchesCrees) return l;
  if (clos) l.push({ libelle: 'Séance d’ouverture', commandes: ['/procedure', id, 'seance'], n: null, ecran: 'seance' });
  const a = e.attributions?.[0];
  if (a) l.push({ libelle: 'Évaluation des offres', commandes: ['/procedure', id, 'evaluation'], n: LIBELLES_ETAT_ATTRIBUTION[a.etat] ?? a.etat, ecran: 'evaluation' });
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
        <!-- ⚠️ 04/11 (pilote) — chaque écran s'ouvre en FENÊTRE, rendue par l'écran du plan (hors du volet collant) ; la fiche DAO reste une page. -->
        @for (l of liens(); track l.libelle) {
          @if (l.ecran; as ecran) {
            <button type="button" class="btn btn-outline btn-sm" aria-haspopup="dialog" (click)="demander(ecran, l.libelle)">{{ l.libelle }}@if (l.n) { <span class="pl__n">{{ l.n }}</span> }</button>
          } @else {
            <a class="btn btn-outline btn-sm" [routerLink]="l.commandes">{{ l.libelle }}@if (l.n) { <span class="pl__n">{{ l.n }}</span> }</a>
          }
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
  /** Un écran de la procédure à ouvrir en fenêtre. */
  readonly ouvrir = output<OuvertureEcran>();
  readonly liens = computed(() => liensProcedure(this.ligne(), this.auth.role()));

  demander(cle: EcranProcedure, libelle: string): void {
    const e = this.ligne();
    const n = this.numero();
    this.ouvrir.emit({ cle, idDmc: e.idDmc!, libelle, sousTitre: n ? `Procédure ${n}` : e.designationMarche });
  }
  readonly numero = computed(() => numeroProcedure(this.ligne()));
  /** « remise électronique · fiche validée v1 » : ce que la ligne sait de sa procédure. */
  readonly etat = computed(() => {
    const e = this.ligne();
    const remise = e.modeRemise === 'ELECTRONIQUE' ? 'remise électronique' : e.modeRemise === 'PAPIER' ? 'remise papier' : null;
    const fiche = e.fiche ? (e.fiche.statut === 'VALIDEE' ? `fiche validée v${e.fiche.version}` : `fiche en brouillon v${e.fiche.version}`) : null;
    return [remise, fiche].filter(Boolean).join(' · ');
  });
}
