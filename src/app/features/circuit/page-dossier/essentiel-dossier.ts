import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';

import { dateFr } from '../../../core/interim/interim-libelles';
import { EssentielDossier } from '../../../models';
import { DossierService } from '../../../services/circuit.services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { DossierContenuStore } from '../dossier/dossier-contenu.store';
import { DossierDocuments } from '../dossier/dossier-documents';
import { OngletDossier, documentsDuDossier } from '../dossier/documents-du-dossier';

/** Une case de la bande : son intitulé, ses lignes, et l'élément qui la justifie (absent : la case ne s'ouvre pas). */
export interface CaseEssentiel {
  cle: 'avis' | 'attribution' | 'contrat' | 'suites';
  titre: string;
  lignes: string[];
  ton?: 'favorable' | 'examen' | 'retard';
  cible: OngletDossier | 'historique' | null;
}

const MONTANT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

type Attribution = NonNullable<EssentielDossier['attributions']>[number];
const detailOffre = (a: Attribution) =>
  [a.numeroOffre != null ? `offre n° ${a.numeroOffre}` : '', a.montant != null ? `${MONTANT.format(a.montant)} Ar` : ''].filter(Boolean);

/** FAV vert, FAVR (réserves) ocre, DEF rouge — comme le badge d'avis. */
function tonAvis(code: string): CaseEssentiel['ton'] {
  if (code.startsWith('DEF')) return 'retard';
  if (code === 'FAVR' || code.startsWith('FAVR')) return 'examen';
  return code.startsWith('FAV') ? 'favorable' : undefined;
}

/**
 * Les cases de « L'essentiel », une par bloc servi. `disponibles` = les éléments du dossier ouvrables sur la page : l'avis mène au PV,
 * l'attributaire et le contrat à l'« Attribution », les suites à l'historique.
 */
export function casesEssentiel(e: EssentielDossier, disponibles: ReadonlySet<OngletDossier>): CaseEssentiel[] {
  const cases: CaseEssentiel[] = [];
  const vers = (o: OngletDossier) => (disponibles.has(o) ? o : null);
  if (e.avis) {
    const pv = [e.avis.refePv ? `PV ${e.avis.refePv}` : 'PV', e.avis.definitif ? 'définitif' : 'projet'].join(', ');
    cases.push({ cle: 'avis', titre: 'Avis de la CNM', lignes: [e.avis.libelle || e.avis.code, pv], ton: tonAvis(e.avis.code), cible: vers('pv-cnm') });
  }
  const attributions = e.attributions ?? [];
  if (attributions.length) {
    const plusieurs = attributions.length > 1;
    cases.push({
      cle: 'attribution',
      titre: plusieurs ? 'Attributaires, par lot' : 'Attributaire',
      // Un seul lot : le nom, puis l'offre et le montant dessous ; plusieurs lots : une ligne par lot.
      lignes: plusieurs
        ? attributions.map((a) => [`Lot ${a.lot ?? '—'} : ${a.attributaire ?? '—'}`, ...detailOffre(a)].join(' · '))
        : [attributions[0].attributaire ?? '—', ...(detailOffre(attributions[0]).length ? [detailOffre(attributions[0]).join(' · ')] : [])],
      cible: vers('attribution'),
    });
  }
  if (e.contrat) {
    const c = e.contrat;
    const ligne = [c.signeLe ? `signé le ${dateFr(c.signeLe)}` : '', c.finLe ? `jusqu’au ${dateFr(c.finLe)}` : ''].filter(Boolean).join(' · ');
    cases.push({ cle: 'contrat', titre: 'Contrat', lignes: [c.libelleForme || c.forme || 'Marché', ...(ligne ? [ligne] : [])], cible: vers('attribution') });
  }
  if (e.suites) {
    const s = e.suites;
    const lignes: string[] = [];
    if (s.bonsCommande) {
      const d = s.dernierBon;
      lignes.push(pluriel(s.bonsCommande, 'bon de commande', 'bons de commande'));
      if (d) lignes.push(`dernier${d.numero != null ? ` n° ${d.numero}` : ''}${d.date ? ` du ${dateFr(d.date)}` : ''}`);
    }
    if (s.actesGestion) lignes.push(pluriel(s.actesGestion, 'acte de gestion', 'actes de gestion'));
    if (lignes.length) cases.push({ cle: 'suites', titre: 'Suites', lignes, cible: 'historique' });
  }
  return cases;
}

/**
 * ⚠️ 01/11 (pilote, maquette « page du dossier », variante A, lot 2 — demande « essentiel-dossier », B1) — la bande « L'essentiel »,
 * sous l'en-tête : ce qu'est devenu le dossier d'un coup d'œil (avis, attributaire, contrat, suites). Chaque case mène à l'élément qui
 * la justifie. Sans réponse (route absente, échec) ou sans aucun bloc, la bande ne paraît pas.
 */
@Component({
  selector: 'app-essentiel-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ModaleDirective, DossierDocuments],
  template: `
    @if (cases().length) {
      <section class="es" aria-labelledby="es-titre">
        <h2 class="es__titre" id="es-titre">L’essentiel</h2>
        <ul class="es__cases">
          @for (c of cases(); track c.cle) {
            <li [class]="'es__case' + (c.ton ? ' es__case--' + c.ton : '')">
              @if (c.cible) {
                <button type="button" class="es__corps" (click)="ouvrir(c.cible)" [attr.aria-label]="c.titre + ' : ' + c.lignes.join(', ') + ' — ouvrir ' + nomCible(c.cible)">
                  <ng-container *ngTemplateOutlet="contenu; context: { $implicit: c }" />
                  <span class="es__chevron" aria-hidden="true">›</span>
                </button>
              } @else {
                <div class="es__corps"><ng-container *ngTemplateOutlet="contenu; context: { $implicit: c }" /></div>
              }
            </li>
          }
        </ul>
      </section>
    }
    <ng-template #contenu let-c>
      <span class="es__texte">
        <span class="es__k">{{ c.titre }}</span>
        @for (l of c.lignes; track $index; let premiere = $first) {
          <span [class]="premiere ? 'es__v' : 'es__d'">{{ l }}</span>
        }
      </span>
    </ng-template>
    @if (ouvert(); as cle) {
      <div class="modal-backdrop">
        <div class="modal es__modale" role="dialog" aria-modal="true" [attr.aria-label]="nomCible(cle) + ' — ' + reference()"
          appModale (appModaleFermer)="ouvert.set(null)">
          <div class="modal-header">
            <h2 class="modal-title">{{ nomCible(cle) }} <span class="es__ref">· {{ reference() }}</span></h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="ouvert.set(null)">✕</button>
          </div>
          <div class="modal-body es__modale-corps">
            <app-dossier-documents [ongletImpose]="cle" (ongletDemande)="ouvert.set($event)" />
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .es { padding: 0.75rem 1.1rem; border: 1px solid var(--bordure); border-radius: 8px; background: var(--carte-fond); }
    .es__titre { margin: 0 0 0.55rem; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-secondaire); }
    .es__cases { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
    .es__case { display: flex; min-width: 0; border: 1px solid var(--bordure); border-left: 4px solid var(--bordure-champ); border-radius: 6px; background: var(--ligne-survol); }
    .es__case--favorable { border-left-color: var(--favorable-texte); }
    .es__case--examen { border-left-color: var(--examen-texte); }
    .es__case--retard { border-left-color: var(--retard-texte); }
    .es__corps {
      display: flex; align-items: center; gap: 0.5rem; width: 100%; min-width: 0; padding: 0.5rem 0.75rem;
      border: 0; background: transparent; color: var(--texte); font: inherit; text-align: left;
    }
    button.es__corps { cursor: pointer; }
    button.es__corps:hover { background: var(--carte-fond); }
    button.es__corps:focus-visible { outline: 3px solid var(--bouton-principal); outline-offset: 2px; }
    .es__texte { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; min-width: 0; }
    .es__k { font-size: 0.75rem; color: var(--texte-secondaire); }
    .es__v { font-weight: 500; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
    .es__d { font-size: 0.8125rem; color: var(--texte-secondaire); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
    .es__chevron { color: var(--texte-secondaire); font-size: 1.1rem; }
    .es__modale { width: 96vw; max-width: 96vw; height: min(94vh, calc(100vh - 3rem)); max-height: min(94vh, calc(100vh - 3rem)); display: flex; flex-direction: column; }
    .es__modale-corps { flex: 1; overflow: auto; padding: 0; }
    .es__ref { font-weight: 400; color: var(--texte-secondaire); font-size: 0.9rem; }
  `,
})
export class EssentielDossierBande {
  private readonly service = inject(DossierService);
  private readonly contenu = inject(DossierContenuStore);

  readonly idDossier = input.required<number>();
  /** La référence affichée dans le titre de la fenêtre. */
  readonly reference = input.required<string>();
  /** La case « Suites » : la page ouvre l'historique. */
  readonly historique = output<void>();

  private readonly essentiel = signal<EssentielDossier | null>(null);
  private readonly documents = computed(() => (this.contenu.loading() ? [] : documentsDuDossier(this.contenu)));
  readonly cases = computed(() => {
    const e = this.essentiel();
    return e ? casesEssentiel(e, new Set(this.documents().map((d) => d.cle))) : [];
  });
  readonly ouvert = signal<OngletDossier | null>(null);

  private abonnement = new Subscription();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abonnement.unsubscribe());
    effect(() => {
      const id = this.idDossier();
      untracked(() => {
        this.abonnement.unsubscribe();
        this.essentiel.set(null);
        this.abonnement = this.service.essentiel(id).subscribe({ next: (e) => this.essentiel.set(e ?? null), error: () => this.essentiel.set(null) });
      });
    });
  }

  nomCible(cible: OngletDossier | 'historique'): string {
    if (cible === 'historique') return 'l’historique';
    return this.documents().find((d) => d.cle === cible)?.libelle ?? 'l’élément';
  }

  ouvrir(cible: OngletDossier | 'historique'): void {
    if (cible === 'historique') this.historique.emit();
    else this.ouvert.set(cible);
  }
}
