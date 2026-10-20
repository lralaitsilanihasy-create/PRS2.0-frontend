import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { LigneEligible } from '../../models';
import { DmcService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { statutDossierLabel } from '../../shared/circuit/circuit-workflow';
import { LIBELLES_ETAT_ATTRIBUTION } from '../circuit/dossier/instantanes-vues';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { LIBELLES_CATEGORIES, LIBELLES_TYPES_MARCHE } from './fiche-marche/fiche-marche-modele';
import { Icone } from '../../shared/ui/icone';

/**
 * ⚠️ 19/10 (pilote, demande « dossier-marche-contrat-cadre ») — le sous-type du dossier de mise en concurrence dont procède un
 * sous-type de marché : `MAOO-CC` ← `DAOO-CC`, `MPI` ← `DC`… (V137 : le sous-type du marché se lit sur ce dossier).
 */
export const SOUS_TYPE_MEC_DU_MARCHE: Readonly<Record<string, string>> = {
  MAOO: 'DAOO',
  'MAOO-CC': 'DAOO-CC',
  MAOOI: 'DAOOI',
  MAOOPREQUAL: 'DAOOPREQUAL',
  MAOR: 'DAOR',
  MAORI: 'DAORI',
  MPI: 'DC',
};

/**
 * ⚠️ 20/10 (B2) — le nombre de lots dont le dossier de marché reste à créer : proposés par le rapport (`PROPOSE`), sans dossier.
 * Sans état servi (serveur antérieur) : on se replie sur « aucun dossier de marché », et rien si cela non plus n'est pas servi.
 */
export function lotsSansDossierMarche(l: Pick<LigneEligible, 'attributions' | 'dossiersMarche'>): number {
  const dossiers = l.dossiersMarche ?? [];
  if (l.attributions != null) return l.attributions.filter((a) => a.etat === 'PROPOSE' && !dossiers.some((d) => d.lot === a.lot)).length;
  return l.dossiersMarche != null && !l.dossiersMarche.length ? 1 : 0;
}

/**
 * Les procédures qui peuvent produire un dossier de marché : menées dans l'application (des offres déposées en ligne), dont le
 * dossier de mise en concurrence est clôturé ; `sousTypeMarche` restreint au sous-type de mise en concurrence correspondant.
 */
export function proceduresPourMarche(lignes: readonly LigneEligible[], sousTypeMarche: string | null): LigneEligible[] {
  const mec = sousTypeMarche ? SOUS_TYPE_MEC_DU_MARCHE[sousTypeMarche] ?? null : null;
  return lignes.filter((l) => l.idDmc != null && (l.nbOffres ?? 0) > 0 && l.dossier?.statut === 'CLOTURE' && (mec == null || l.sousType === mec));
}

/**
 * ⚠️ 19/10 (pilote) — **« Dossier de marché — choisir la procédure »**, l'analogue, pour le marché, de la liste des fiches DAO :
 * « Créer dossier », famille « marché », y renvoie. Le dossier de marché d'une procédure menée dans l'application naît de
 * l'attribution du lot (« Créer le dossier de marché ») : chaque ligne y mène. Lignes lues sur `GET /api/dmcs/eligibles`, sans
 * appel de plus ; l'état de l'attribution se lit sur l'écran du lot.
 */
@Component({
  selector: 'app-dossier-marche-procedures',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, Icone],
  template: `
    <nav class="dm__fil" aria-label="Fil d'Ariane">
      <a routerLink="/prmp/soumettre-dossier" [queryParams]="{ famille: 'DDM' }"><app-icone nom="chevl" [taille]="14" />Créer dossier</a>
      <app-icone nom="chev" [taille]="12" />
      <span>Dossier de marché</span>
    </nav>
    <header class="page-header">
      <div class="page-subtitle">Domaine PRMP</div>
      <h1 class="page-title">Dossier de marché — choisir la procédure</h1>
    </header>
    <p class="page-role">
      Le dossier de marché d'une procédure menée dans l'application naît de l'attribution du lot : ouvrez la procédure, puis
      « Créer le dossier de marché ». Il reprend d'office le projet de marché, le PV d'ouverture, le rapport d'évaluation signé et le
      bordereau estimatif. Seules figurent ici les procédures dont le dossier de mise en concurrence est clôturé et qui ont reçu des
      offres en ligne.
    </p>
    @if (sousType(); as st) {
      <p class="dm__filtre" data-testid="dm-filtre">
        Procédures dont le dossier de mise en concurrence est en <strong class="cnm-mono">{{ mec(st) }}</strong>, pour un marché en
        <strong class="cnm-mono">{{ st }}</strong>.
        <a routerLink="/prmp/dossier-marche">Voir toutes les procédures</a>
      </p>
    }

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Les procédures n'ont pas pu être chargées." (reessayer)="charger()" />
    } @else {
      <div class="table-card">
        <table class="dm__table">
          <thead>
            <!-- ⚠️ 20/10 (pilote, « revoir les informations nécessaires ») — ce qu'il faut pour choisir : le marché (forme, catégorie, ligne du
                 plan), son estimation, la mise en concurrence (dossier contrôlé, offres reçues), le dossier de marché et le geste. Le mode
                 de passation est retiré : la liste ne compte que des appels d'offres, filtrés par le sous-type. -->
            <tr><th scope="col">Marché</th><th scope="col" class="r">Estimation</th><th scope="col">Mise en concurrence</th><th scope="col">Attribution</th><th scope="col">Dossier de marché</th><th scope="col" class="r">Action</th></tr>
          </thead>
          <tbody>
            @for (l of lignes(); track l.idDetail) {
              <tr>
                <td>
                  @if (l.numeroProcedure) { <span class="dm__num cnm-mono">{{ l.numeroProcedure }}</span> }
                  <span class="dm__objet">{{ l.designationMarche }}</span>
                  <span class="dm__sous">{{ caracteristiques(l) }}</span>
                </td>
                <td class="r dm__mt">{{ montant(l.montEstim) }}</td>
                <td>
                  @if (l.dossier; as d) { <a class="dm__dossier cnm-mono" [routerLink]="['/dossier', d.idDossier]">{{ d.refeDossier || ('Dossier n° ' + d.idDossier) }}</a> }
                  <span class="dm__etat">{{ l.dossier ? statutLibelle(l.dossier.statut) + ' · ' : '' }}{{ l.nbOffres }} offre{{ (l.nbOffres ?? 0) > 1 ? 's' : '' }} reçue{{ (l.nbOffres ?? 0) > 1 ? 's' : '' }}</span>
                </td>
                <!-- ⚠️ 20/10 (« liste-dossier-marche », B2) — par lot : l'état, le rapport signé, l'offre classée 1re. -->
                <td>
                  @for (a of l.attributions ?? []; track a.lot) {
                    <span class="dm__dossier dm__dossier--texte">{{ (l.attributions?.length ?? 0) > 1 ? 'Lot ' + a.lot + ' · ' : '' }}{{ etatAttribution(a.etat) }}</span>
                    @if (a.propose; as p) { <span class="dm__etat">{{ p.candidat }} — {{ montant(p.montant) }} HT{{ p.nbTitulaires > 1 ? ' (+ ' + (p.nbTitulaires - 1) + ' titulaire' + (p.nbTitulaires > 2 ? 's' : '') + ')' : '' }}</span> }
                    @if (a.rapportSigneLe) { <span class="dm__etat">Rapport signé le {{ date(a.rapportSigneLe) }}</span> }
                  } @empty {
                    <span class="dm__etat">{{ l.attributions == null ? '—' : 'Évaluation non ouverte' }}</span>
                  }
                </td>
                <!-- ⚠️ 20/10 (pilote, « est-ce vraiment le dossier de marché ? ») — le dossier de marché dans sa propre colonne, son état en clair. -->
                <td>
                  @for (dm of l.dossiersMarche ?? []; track dm.idDossier) {
                    <a class="dm__dossier" [routerLink]="['/dossier', dm.idDossier]">{{ dm.refeDossier || ('Dossier n° ' + dm.idDossier) }}{{ (l.dossiersMarche?.length ?? 0) > 1 ? ' · lot ' + dm.lot : '' }}</a>
                    <span class="dm__etat">{{ etatDossierMarche(dm.statut) }}</span>
                  } @empty {
                    <span class="dm__etat">{{ l.dossiersMarche == null ? '—' : 'À créer depuis l’attribution' }}</span>
                  }
                </td>
                <td class="r">
                  <!-- Champ non servi (serveur antérieur) : rien n'est présumé, le geste reste neutre. -->
                  @let aCreer = lotsACreer(l) > 0;
                  <a class="btn btn-sm" [class.btn-primary]="aCreer" [class.btn-outline]="!aCreer" [routerLink]="['/procedure', l.idDmc, 'evaluation']">{{ aCreer ? 'Créer le dossier de marché' : 'Ouvrir l’attribution' }}</a>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="dm__vide">
                Aucune procédure prête : il faut une procédure menée dans l'application, dont le dossier de mise en concurrence est
                clôturé. Pour une procédure à remise papier, créez le dossier de marché depuis « Créer dossier ».
              </td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .dm__fil { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); }
    .dm__fil a { display: inline-flex; gap: 0.2rem; align-items: center; color: var(--p-700); font-weight: 600; }
    .dm__filtre { margin: 0; font-size: var(--text-sm); display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: baseline; }
    .dm__table { width: 100%; border-collapse: collapse; }
    .dm__table .r { text-align: right; }
    .dm__dossier { display: block; font-size: var(--text-sm); font-weight: 600; color: var(--p-700); }
    .dm__etat { display: block; font-size: 0.8rem; color: var(--n-500); }
    .dm__objet { display: block; font-weight: 600; color: var(--n-800); }
    .dm__sous { display: block; font-size: 0.8rem; color: var(--n-500); }
    .dm__mt { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .dm__table td { vertical-align: top; }
    /* 20/10 — largeurs fixées : l'objet prend la place qui reste, rien ne déborde de la carte. */
    .dm__table { table-layout: fixed; }
    .dm__table th:nth-child(2), .dm__table td:nth-child(2) { width: 9rem; }
    .dm__table th:nth-child(3), .dm__table td:nth-child(3) { width: 12.5rem; }
    .dm__table th:nth-child(4), .dm__table td:nth-child(4) { width: 15rem; }
    .dm__table th:nth-child(5), .dm__table td:nth-child(5) { width: 14rem; }
    .dm__table th:nth-child(6), .dm__table td:nth-child(6) { width: 12rem; }
    .dm__num { display: block; font-size: 0.78rem; font-weight: 700; color: var(--p-700); }
    .dm__dossier--texte { color: var(--n-800); }
    .dm__table td { overflow-wrap: anywhere; white-space: normal; }
    .dm__vide { padding: 1rem; color: var(--n-500); font-size: var(--text-sm); }
  `,
})
export class DossierMarcheProcedures implements OnInit {
  private readonly service = inject(DmcService);
  private readonly route = inject(ActivatedRoute);

  readonly sousType = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('sousType')?.toUpperCase() || null)), { initialValue: null });
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  private readonly eligibles = signal<LigneEligible[]>([]);
  readonly lignes = computed(() => proceduresPourMarche(this.eligibles(), this.sousType()));
  readonly mec = (st: string): string => SOUS_TYPE_MEC_DU_MARCHE[st] ?? '—';
  readonly statutLibelle = statutDossierLabel;
  readonly date = dateHeureFr;
  readonly etatAttribution = (e: string): string => LIBELLES_ETAT_ATTRIBUTION[e] ?? e;
  readonly lotsACreer = lotsSansDossierMarche;
  readonly montant = (v: number | null | undefined): string => (v == null ? '—' : `${new Intl.NumberFormat('fr-FR').format(v)} Ar`);
  /** Forme, catégorie et ligne du plan, sous l'objet. */
  caracteristiques(l: LigneEligible): string {
    return [l.formeMarche ? LIBELLES_TYPES_MARCHE[l.formeMarche] : null, l.categorie ? LIBELLES_CATEGORIES[l.categorie] : l.libelleNature,
      `ligne ${l.idDetail} du plan ${l.refeDossier || 'n° ' + l.idDossier}`].filter(Boolean).join(' · ');
  }

  /** L'état du dossier de marché, en clair hors de la frise : « Initial » (12/09) ne se comprend que dans le circuit. */
  etatDossierMarche(statut: string): string {
    if (statut === 'BROUILLON') return 'Brouillon — à compléter et soumettre';
    if (statut === 'SOUMIS') return 'Soumis à la Commission — en attente de réception';
    return statutDossierLabel(statut);
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.eligibles().subscribe({
      next: (l) => {
        this.eligibles.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }
}
