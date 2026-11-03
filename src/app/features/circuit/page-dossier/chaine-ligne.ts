import { ChangeDetectionStrategy, Component, DestroyRef, Injectable, OnInit, computed, inject, input, signal } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { FiliationDossier, LigneEligible, Marche, NoeudFiliation } from '../../../models';
import { ModePassationService, ReferenceLookupService } from '../../../services';
import { DossierService } from '../../../services/circuit.services';
import { DmcService } from '../../../services/fiche-marche.services';
import { StatutBadge } from '../../../shared/circuit';
import { LIBELLES_LIEN } from '../dossier/historique-dossier';
import { MOTIFS_MARCHE_PAPIER, lotsPapierACreer, lotsSansDossierMarche, proceduresPourMarche } from '../../prmp/dossier-marche-procedures';
import { LienDossier } from './lien-dossier';

/**
 * ⚠️ 03/11 (pilote) — les dossiers d'UNE ligne du plan, lus sur la filiation du plan : la version du plan qui porte la ligne, puis
 * chaque dossier rattaché à la ligne (`ligne.idDetail`) et tout ce qui en découle (marchés des lots, actes de gestion).
 * Le rapprochement se fait sur l'identité de la ligne à travers les versions (`idLigneOrigine`) quand le serveur la sert sur le
 * nœud (demande « chaine-par-ligne », B1), à défaut sur `idDetail` : une procédure lancée sur une version antérieure ne se
 * retrouve alors pas depuis la version suivante.
 */
export function dossiersDeLaLigne(f: FiliationDossier, m: Pick<Marche, 'idDetail' | 'idDossier' | 'idLigneOrigine'>): NoeudFiliation[] {
  const plan: NoeudFiliation[] = [];
  const suites: NoeudFiliation[] = [];
  const deroule = (n: NoeudFiliation): void => {
    suites.push(n);
    n.enfants.forEach(deroule);
  };
  const estLaLigne = (n: NoeudFiliation): boolean => {
    const l = n.ligne as (NoeudFiliation['ligne'] & { idLigneOrigine?: number | null }) | null;
    if (!l) return false;
    return l.idLigneOrigine != null && m.idLigneOrigine != null ? l.idLigneOrigine === m.idLigneOrigine : l.idDetail === m.idDetail;
  };
  const parcourir = (n: NoeudFiliation): void => {
    if (!n.masque && n.idDossier === m.idDossier) plan.push(n);
    for (const e of n.enfants) {
      if (e.lien !== 'VERSION_SUIVANTE' && estLaLigne(e)) deroule(e);
      else parcourir(e);
    }
  };
  parcourir(f.racine);
  return [...plan, ...suites];
}

/** L'étape suivante de la ligne, à créer : son intitulé, le geste et l'écran qui la crée (ou pourquoi elle attend). */
export interface EtapeACreer {
  intitule: string;
  bouton: string | null;
  commandes: (string | number)[];
  params: Params | null;
  note: string | null;
}

const normaliser = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/**
 * ⚠️ 03/11 (pilote) — ce qui reste à créer sur la ligne, pour la PRMP ou l'UGPM. `e` : la ligne dans `GET /api/dmcs/eligibles`
 * (absente = la ligne ne porte pas de fiche DAO) ; `modeLibelle` : le mode du plan ; `noeuds` : les dossiers de la ligne dans la filiation
 * (`dossiersDeLaLigne`, le plan en tête) ; `ligne` : la ligne, transmise à « Créer un dossier » pour y rattacher le dossier (B2, V163).
 * La consultation de prix n'a pas d'étape tant que le pilote n'a pas dit quel dossier elle produit.
 */
export function etapeACreer(
  e: LigneEligible | undefined,
  modeLibelle: string | null,
  noeuds: readonly NoeudFiliation[] = [],
  ligne: { idDetail: number; objet?: string | null } | null = null,
): EtapeACreer | null {
  const mec = 'Mise en concurrence';
  const marche = 'Dossier de marché';
  if (e) {
    if (!e.dejaDao) return { intitule: mec, bouton: 'Préparer les informations du DAO', commandes: ['/prmp/dao'], params: { dossier: e.idDossier, ligne: e.idDetail }, note: null };
    if (e.idDmc == null) return null;
    if (!e.dossier) return { intitule: mec, bouton: 'Reprendre les informations du DAO', commandes: ['/prmp/dao', e.idDmc], params: null, note: 'Le dossier naît de la validation des informations du DAO.' };
    if (e.modeRemise === 'PAPIER') {
      if (!lotsPapierACreer(e).length) return null;
      if (!e.marchePapier?.ouvert) return { intitule: marche, bouton: null, commandes: [], params: null, note: (e.marchePapier?.motif && MOTIFS_MARCHE_PAPIER[e.marchePapier.motif]) || 'Le dossier de marché ne peut pas encore être créé.' };
      return { intitule: marche, bouton: 'Créer le dossier de marché', commandes: ['/prmp/dossier-marche'], params: { dmc: e.idDmc }, note: null };
    }
    if (!proceduresPourMarche([e], null).length) {
      return { intitule: marche, bouton: null, commandes: [], params: null, note: 'Il naît de l’attribution du lot, une fois le dossier de mise en concurrence clôturé.' };
    }
    if (lotsSansDossierMarche(e) > 0) return { intitule: marche, bouton: 'Créer le dossier de marché', commandes: ['/procedure', e.idDmc, 'evaluation'], params: null, note: null };
    return null;
  }
  if (modeLibelle && normaliser(modeLibelle).includes('GRE A GRE')) {
    // ⚠️ 03/11 (pilote) — le gré à gré affiche directement son geste. Depuis V163 (« chaine-par-ligne », B2), le dossier créé se
    // rattache à la ligne passée dans l'URL : le rapport, puis le marché, paraissent dans la chaîne et le geste suivant prend la place.
    const lien = ligne ? { ligne: ligne.idDetail, ...(ligne.objet ? { objet: ligne.objet } : {}) } : {};
    if (noeuds.some((n) => n.lien === 'MARCHE')) return null;
    const rapport = noeuds.find((n) => n.lien === 'MISE_EN_CONCURRENCE');
    if (!rapport) return { intitule: '', bouton: 'Créer le rapport justificatif', commandes: ['/prmp/soumettre-dossier'], params: { famille: 'DMC', sousType: 'RJ', ...lien }, note: null };
    if (rapport.masque || rapport.statut !== 'CLOTURE') {
      return { intitule: marche, bouton: null, commandes: [], params: null, note: 'Le marché de gré à gré se crée une fois le rapport justificatif examiné et clôturé.' };
    }
    return { intitule: '', bouton: 'Créer le marché de gré à gré', commandes: ['/prmp/soumettre-dossier'], params: { famille: 'DDM', sousType: 'MGG', ...lien }, note: null };
  }
  return null;
}

/**
 * Lectures communes aux chaînes d'un même tableau : la filiation du plan et, pour la PRMP et l'UGPM, les lignes qui peuvent porter un
 * DAO — chacune UNE fois, à la première ligne ouverte. À fournir par l'écran qui affiche le tableau (`providers`).
 */
@Injectable()
export class ChainesDuPlan {
  private readonly dossiers = inject(DossierService);
  private readonly dmcs = inject(DmcService);
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly creation = computed(() => this.auth.role() === 'PRMP' || this.auth.role() === 'UGPM');
  readonly filiation = signal<FiliationDossier | null>(null);
  readonly eligibles = signal<LigneEligible[]>([]);
  readonly modes = signal<Map<string, string>>(new Map());
  readonly chargement = signal(false);
  readonly erreur = signal(false);
  private idCharge: number | null = null;
  private abonnement = new Subscription();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abonnement.unsubscribe());
  }

  charger(idDossier: number, recharger = false): void {
    if (this.idCharge === idDossier && !recharger) return;
    this.idCharge = idDossier;
    this.abonnement.unsubscribe();
    this.chargement.set(true);
    this.erreur.set(false);
    const creation = this.creation();
    this.abonnement = forkJoin({
      filiation: this.dossiers.filiation(idDossier),
      eligibles: creation ? this.dmcs.eligibles().pipe(catchError(() => of([] as LigneEligible[]))) : of([] as LigneEligible[]),
      modes: creation ? this.lookups.lookup(ModePassationService, 'idMode', ['libelle']) : of(new Map<string, string>()),
    }).subscribe({
      next: (r) => {
        this.filiation.set(r.filiation?.racine ? r.filiation : null);
        this.eligibles.set(r.eligibles);
        this.modes.set(r.modes);
        this.chargement.set(false);
      },
      error: () => {
        this.idCharge = null;
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }
}

/**
 * ⚠️ 03/11 (pilote) — la chaîne d'UNE ligne du plan, ouverte sous la ligne : le plan, la mise en concurrence, les dossiers de marché,
 * les actes de gestion ; chaque dossier s'ouvre. Pour la PRMP et l'UGPM, l'étape suivante « à créer » mène à l'écran qui la crée.
 */
@Component({
  selector: 'app-chaine-ligne',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatutBadge],
  template: `
    <div class="cl">
      @if (source.chargement()) {
        <p class="cl__info" role="status">Chargement de la chaîne de la ligne…</p>
      } @else if (source.erreur()) {
        <p class="cl__info">La chaîne de la ligne n’a pas pu être lue.
          <button type="button" class="btn btn-outline btn-sm" (click)="reessayer()">Réessayer</button></p>
      } @else {
        <ol class="cl__chaine" [attr.aria-label]="'Chaîne de la ligne : ' + (marche().designationMarche ?? '')">
          @for (n of noeuds(); track $index) {
            <li class="cl__pas">
              @if (n.masque) {
                <span class="cl__maillon cl__maillon--masque">
                  <span class="cl__k">{{ intitule(n) }}</span>
                  <span class="cl__r">hors de votre périmètre</span>
                </span>
              } @else if (lien.disponible() && n.idDossier != null) {
                <a class="cl__maillon" [routerLink]="lien.commandes(n.idDossier)" [queryParams]="lien.params()"
                  [attr.aria-label]="intitule(n) + ' — ouvrir le dossier ' + (n.refeDossier || n.idDossier)">
                  <span class="cl__k">{{ intitule(n) }}</span>
                  <span class="cl__r">{{ n.refeDossier || 'Brouillon #' + n.idDossier }}</span>
                  <app-statut-badge [statut]="n.statut" />
                </a>
              } @else {
                <span class="cl__maillon">
                  <span class="cl__k">{{ intitule(n) }}</span>
                  <span class="cl__r">{{ n.refeDossier || 'Brouillon #' + n.idDossier }}</span>
                  <app-statut-badge [statut]="n.statut" />
                </span>
              }
              <span class="cl__fleche" aria-hidden="true">→</span>
            </li>
          }
          @if (etape(); as e) {
            <li class="cl__pas">
              <span class="cl__maillon cl__maillon--a-creer">
                @if (e.intitule) { <span class="cl__k">{{ e.intitule }} · à créer</span> }
                @if (e.note) { <span class="cl__note">{{ e.note }}</span> }
                @if (e.bouton) {
                  <a class="btn btn-primary btn-sm" [routerLink]="e.commandes" [queryParams]="e.params">{{ e.bouton }}</a>
                }
              </span>
            </li>
          } @else if (noeuds().length <= 1) {
            <li class="cl__pas"><span class="cl__info">Aucune procédure lancée sur cette ligne.</span></li>
          }
        </ol>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .cl { padding: 0.6rem 0.75rem; background: var(--carte-fond); }
    .cl__chaine { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
    .cl__pas { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
    .cl__pas:last-child .cl__fleche { display: none; }
    .cl__maillon {
      display: flex; flex-direction: column; align-items: flex-start; gap: 0.2rem; min-width: 0; height: 100%; max-width: 22rem;
      padding: 0.45rem 0.75rem; border-radius: 6px; border: 1px solid var(--bordure); background: var(--ligne-survol);
      color: var(--texte); text-decoration: none;
    }
    a.cl__maillon:hover { border-color: var(--bordure-champ); background: var(--carte-fond); }
    a.cl__maillon:focus-visible { outline: 3px solid var(--bouton-principal); outline-offset: 2px; }
    .cl__maillon--masque { font-style: italic; }
    .cl__maillon--a-creer { border-style: dashed; background: var(--carte-fond); }
    .cl__k { font-size: 0.75rem; color: var(--texte-secondaire); }
    .cl__r { font-weight: 500; overflow-wrap: anywhere; }
    .cl__note { font-size: 0.75rem; color: var(--texte-secondaire); }
    .cl__fleche { color: var(--texte-secondaire); }
    .cl__info { margin: 0; font-size: 0.8125rem; color: var(--texte-secondaire); align-self: center; }
  `,
})
export class ChaineLigne implements OnInit {
  readonly source = inject(ChainesDuPlan);
  readonly lien = inject(LienDossier);

  readonly marche = input.required<Marche>();

  readonly noeuds = computed(() => {
    const f = this.source.filiation();
    return f ? dossiersDeLaLigne(f, this.marche()) : [];
  });
  readonly etape = computed(() => {
    if (!this.source.creation()) return null;
    const m = this.marche();
    const e = this.source.eligibles().find((x) => x.idDetail === m.idDetail);
    const mode = m.idMode != null ? this.source.modes().get(String(m.idMode)) ?? null : null;
    return etapeACreer(e, mode, this.noeuds().slice(1), { idDetail: m.idDetail, objet: m.designationMarche ?? null });
  });

  ngOnInit(): void {
    this.source.charger(this.marche().idDossier);
  }

  reessayer(): void {
    this.source.charger(this.marche().idDossier, true);
  }

  /** « Plan », « Mise en concurrence », « Dossier de marché · lot 1 », « Acte de gestion ». */
  intitule(n: NoeudFiliation): string {
    const base = n.lien === 'RACINE' || n.lien === 'VERSION_SUIVANTE' ? 'Plan' : LIBELLES_LIEN[n.lien] ?? n.lien;
    return n.lot != null ? `${base} · lot ${n.lot}` : base;
  }
}
