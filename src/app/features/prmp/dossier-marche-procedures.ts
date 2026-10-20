import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { LigneEligible } from '../../models';
import { DmcService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { statutDossierLabel } from '../../shared/circuit/circuit-workflow';
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
            <tr><th scope="col">Objet du marché</th><th scope="col">Dossier de mise en concurrence</th><th scope="col">Mode de passation</th><th scope="col" class="r">Offres</th><th scope="col" class="r">Action</th></tr>
          </thead>
          <tbody>
            @for (l of lignes(); track l.idDetail) {
              <tr>
                <td>{{ l.designationMarche }}</td>
                <td class="cnm-mono">{{ l.dossier?.refeDossier || '—' }}</td>
                <td>{{ l.libelleMode || '—' }}</td>
                <td class="r">{{ l.nbOffres }}</td>
                <td class="r">
                  <!-- ⚠️ 20/10 (B2) — le dossier de marché déjà né du lot : son état et son lien ; sinon, l'attribution. -->
                  @for (dm of l.dossiersMarche ?? []; track dm.idDossier) {
                    <a class="dm__dossier" [routerLink]="['/dossier', dm.idDossier]">Lot {{ dm.lot }} : dossier de marché {{ dm.refeDossier || ('n° ' + dm.idDossier) }} — {{ statut(dm.statut) }}</a>
                  }
                  <!-- Champ non servi (serveur antérieur) : rien n'est présumé, le geste reste neutre. -->
                  @let aCreer = l.dossiersMarche != null && !l.dossiersMarche.length;
                  <a class="btn btn-sm" [class.btn-primary]="aCreer" [class.btn-outline]="!aCreer" [routerLink]="['/procedure', l.idDmc, 'evaluation']">{{ aCreer ? 'Créer le dossier de marché' : 'Ouvrir l’attribution' }}</a>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="dm__vide">
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
    .dm__dossier { display: block; margin-bottom: 0.35rem; font-size: var(--text-sm); font-weight: 600; color: var(--p-700); }
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
  readonly statut = statutDossierLabel;

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
