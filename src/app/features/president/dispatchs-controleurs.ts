import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';

import { Controleur, Dossier } from '../../models';
import {
  ControleurService,
  DelegationProfilService,
  DispatchService,
  DossierService,
  EntiteContractService,
  LocaliteService,
  ProfileService,
  ReceptionService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossierConsultation } from '../circuit/dossier-consultation';

/** Un dossier attribué à un contrôleur par le dernier dispatch (rôle joué : Membre attributaire ou CC). */
interface DossierAttribue {
  dossier: Dossier;
  dateDispatch?: string;
  role: 'Membre' | 'CC';
}
/** Ligne de la statistique : un contrôleur et ses dossiers dispatchés. */
interface LigneControleur {
  im: string;
  nom: string;
  profil: string;
  dossiers: DossierAttribue[];
}

/**
 * Statistique « Dispatchs par contrôleur » (Président) : nombre de dossiers dispatchés à chaque
 * Membre attributaire / CC (dernier dispatch de chaque dossier, toutes localités), avec le détail
 * des dossiers dépliable par contrôleur. Seuls les dossiers encore en cours côté commission comptent
 * (DISPATCHE / EXAMINE) : un dossier sort de la statistique dès la signature de son PV définitif
 * (statut PV_SIGNE et au-delà). Aucun endpoint dédié : dispatchs + réceptions + dossiers
 * joints côté client (mêmes listes que le drill-down circuit, pas de N+1).
 */
@Component({
  selector: 'app-dispatchs-controleurs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation, DatePipe],
  template: `
    <section class="dpc">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine Président</div>
          <h1 class="page-title">Dispatchs par contrôleur</h1>
        </div>
      </header>
      <p class="dpc__intro">Répartition des dossiers <strong>dispatchés</strong> entre les Membres attributaires et les CC (dernier dispatch de chaque dossier). Un dossier sort de la statistique dès que son <strong>PV définitif est signé</strong> ; les attributions d'un CC ou d'un Président n'apparaissent que si la <strong>délégation du profil Membre</strong> est active.</p>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else {
        <div class="dpc__kpis">
          <div class="cnm-stat cnm-stat--blue">
            <div class="cnm-stat__icon" aria-hidden="true">📦</div>
            <div class="cnm-stat__body">
              <div class="cnm-stat__value">{{ totalDossiers() }}</div>
              <div class="cnm-stat__label">Dossiers dispatchés</div>
            </div>
          </div>
          <div class="cnm-stat cnm-stat--green">
            <div class="cnm-stat__icon" aria-hidden="true">👥</div>
            <div class="cnm-stat__body">
              <div class="cnm-stat__value">{{ lignes().length }}</div>
              <div class="cnm-stat__label">Contrôleurs concernés</div>
            </div>
          </div>
        </div>

        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th>Contrôleur</th>
                <th>Profil</th>
                <th>Dossiers dispatchés</th>
                <th class="dpc__bar-col" aria-hidden="true"></th>
                <th class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (l of lignes(); track l.im) {
                <tr>
                  <td><strong>{{ l.nom }}</strong><span class="cnm-muted dpc__im">({{ l.im }})</span></td>
                  <td>{{ l.profil }}</td>
                  <td class="dpc__count">{{ l.dossiers.length }}</td>
                  <td class="dpc__bar-col">
                    <div class="dpc__bar" role="img" [attr.aria-label]="l.dossiers.length + ' dossier(s)'">
                      <span class="dpc__bar-fill" [style.width.%]="pct(l)"></span>
                    </div>
                  </td>
                  <td>
                    <div class="td-actions dpc__actions-end">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="basculer(l.im)">
                        {{ ouvert() === l.im ? 'Masquer les dossiers' : 'Voir les dossiers' }}
                      </button>
                    </div>
                  </td>
                </tr>
                @if (ouvert() === l.im) {
                  <tr class="dpc__detail-row">
                    <td colspan="5">
                      <table class="dpc__inner">
                        <thead>
                          <tr>
                            <th>Référence</th>
                            <th>Entité contractante</th>
                            <th>Type</th>
                            <th>Rôle</th>
                            <th>Date dispatch</th>
                            <th>Statut</th>
                            <th>Localité</th>
                            <th class="r">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (a of l.dossiers; track a.dossier.idDossier + a.role) {
                            <tr>
                              <td>{{ a.dossier.refeDossier || '#' + a.dossier.idDossier }}</td>
                              <td>{{ entiteLabel(a.dossier) }}</td>
                              <td>{{ typeLabel(a.dossier) }}</td>
                              <td>{{ a.role }}</td>
                              <td style="white-space:nowrap;">{{ (a.dateDispatch | date: 'dd/MM/yyyy HH:mm') || '—' }}</td>
                              <td>@if (a.dossier.statut) { <app-statut-badge [statut]="a.dossier.statut" /> } @else { — }</td>
                              <td>{{ localiteLabel(a.dossier) }}</td>
                              <td>
                                <div class="td-actions dpc__actions-end">
                                  <button type="button" class="btn btn-secondary btn-sm" (click)="consulte.set(a.dossier)">Voir détails</button>
                                </div>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="5" class="dpc__empty">Aucun dossier dispatché pour le moment.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
  `,
  styles: `
    .dpc { display: flex; flex-direction: column; gap: 1.15rem; }
    .dpc__intro { margin: -0.4rem 0 0; color: var(--n-500); }
    .dpc__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.9rem; }
    .dpc__count { font-weight: 800; font-variant-numeric: tabular-nums; }
    .dpc__im { margin-left: 0.35rem; }
    .dpc__bar-col { width: 30%; }
    .dpc__bar { height: 6px; border-radius: var(--radius-full); background: var(--n-100); overflow: hidden; }
    .dpc__bar-fill { display: block; height: 100%; background: var(--grad-primary); border-radius: var(--radius-full); transition: width 300ms var(--ease-out); }
    .dpc__actions-end { justify-content: flex-end; }
    .dpc__detail-row > td { background: var(--p-50); padding: 0.75rem 1rem; }
    .dpc__inner { width: 100%; }
    .dpc__inner thead th { font-size: var(--text-xs); }
    .dpc__empty { text-align: center; color: var(--n-400); padding: 1.5rem; }
  `,
})
export class DispatchsControleurs {
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly controleurService = inject(ControleurService);
  private readonly profileService = inject(ProfileService);
  private readonly delegationProfilService = inject(DelegationProfilService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly loading = signal(true);
  readonly lignes = signal<LigneControleur[]>([]);
  /** Contrôleur dont la liste des dossiers est dépliée (im), null = tout replié. */
  readonly ouvert = signal<string | null>(null);
  readonly consulte = signal<Dossier | null>(null);

  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());

  /** Dossiers distincts dispatchés (un dossier compté une fois, même partagé Membre + CC). */
  readonly totalDossiers = computed(() => {
    const ids = new Set<number>();
    for (const l of this.lignes()) for (const a of l.dossiers) ids.add(a.dossier.idDossier);
    return ids.size;
  });
  private readonly maxDossiers = computed(() => Math.max(1, ...this.lignes().map((l) => l.dossiers.length)));

  constructor() {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    forkJoin({
      dossiers: this.dossierService.list(),
      receptions: this.receptionService.list(),
      dispatchs: this.dispatchService.list(),
      controleurs: this.controleurService.list(),
      profiles: this.profileService.list(),
      delegations: this.delegationProfilService.list(),
    }).subscribe({
      next: ({ dossiers, receptions, dispatchs, controleurs, profiles, delegations }) => {
        const dossierById = new Map(dossiers.map((d) => [d.idDossier, d]));
        const recDossier = new Map(receptions.map((r) => [r.idReception, r.idDossier]));
        // Dernier dispatch par dossier (attribution courante — même règle que le drill-down circuit).
        const dernier = new Map<number, (typeof dispatchs)[number]>();
        for (const disp of dispatchs) {
          const idDossier = recDossier.get(disp.idReception);
          if (idDossier == null) continue;
          const prec = dernier.get(idDossier);
          if (!prec || (disp.dateDispatch ?? '') >= (prec.dateDispatch ?? '')) dernier.set(idDossier, disp);
        }
        const profilLib = new Map(profiles.map((p) => [p.idProfile, p.profile ?? '']));
        const ctrlById = new Map<string, Controleur>(controleurs.map((c) => [c.imControleur, c]));
        const parControleur = new Map<string, DossierAttribue[]>();
        // Un dossier sort de la statistique dès la signature de son PV définitif (PV_SIGNE et au-delà) :
        // seuls les dossiers encore en cours côté commission comptent (DISPATCHE / EXAMINE).
        const STATUTS_EN_COURS = new Set(['DISPATCHE', 'EXAMINE']);
        // §3.5 — un CC / Président n'exerce la tâche du Membre que par DÉLÉGATION DE PROFIL active :
        // sans délégation « son profil → Membre » active, ses attributions ne sont pas affichées.
        const idProfileMembre = profiles.find((p) => /membre/i.test(p.profile ?? ''))?.idProfile;
        const delegantsMembre = new Set(
          delegations.filter((d) => d.actif && d.idProfileDelegue === idProfileMembre).map((d) => d.idProfileDelegant),
        );
        const estAffichable = (im: string): boolean => {
          const idProfile = ctrlById.get(im)?.idProfile;
          if (idProfile == null) return false;
          return idProfile === idProfileMembre || delegantsMembre.has(idProfile);
        };
        const ajouter = (im: string | undefined, idDossier: number, dateDispatch: string | undefined, role: 'Membre' | 'CC') => {
          const dossier = im ? dossierById.get(idDossier) : undefined;
          if (!im || !dossier || !estAffichable(im) || !STATUTS_EN_COURS.has(dossier.statut ?? '')) return;
          const liste = parControleur.get(im) ?? [];
          liste.push({ dossier, dateDispatch, role });
          parControleur.set(im, liste);
        };
        for (const [idDossier, disp] of dernier) {
          ajouter(disp.imCtrlMembre, idDossier, disp.dateDispatch, 'Membre');
          ajouter(disp.imCtrlCc, idDossier, disp.dateDispatch, 'CC');
        }
        const lignes: LigneControleur[] = [...parControleur.entries()].map(([im, liste]) => {
          const c = ctrlById.get(im);
          return {
            im,
            nom: c ? [c.nomCont, c.prenomsCont].filter(Boolean).join(' ') || im : im,
            profil: c?.idProfile != null ? profilLib.get(c.idProfile) ?? '—' : '—',
            dossiers: [...liste].sort((a, b) => (b.dateDispatch ?? '').localeCompare(a.dateDispatch ?? '')),
          };
        });
        lignes.sort((a, b) => b.dossiers.length - a.dossiers.length || a.nom.localeCompare(b.nom));
        this.lignes.set(lignes);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  basculer(im: string): void {
    this.ouvert.set(this.ouvert() === im ? null : im);
  }
  pct(l: LigneControleur): number {
    return (l.dossiers.length / this.maxDossiers()) * 100;
  }
  typeLabel(d: Dossier): string {
    return d.idTypeDossier ? this.typeMap().get(d.idTypeDossier) ?? d.idTypeDossier : '—';
  }
  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract : '—';
  }
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }
}
