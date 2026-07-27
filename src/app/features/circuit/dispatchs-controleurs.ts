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
import { DossierConsultation } from './dossier-consultation';

/** Un dossier attribué à un contrôleur par le dernier dispatch (rôle joué : Membre attributaire ou CC). */
interface DossierAttribue {
  dossier: Dossier;
  dateDispatch?: string;
  role: 'Membre' | 'CC';
}
/** Carte de la statistique : un contrôleur et ses dossiers dispatchés. */
interface LigneControleur {
  im: string;
  nom: string;
  profil: string;
  dossiers: DossierAttribue[];
}

/**
 * Section « Dispatchs par contrôleur » — embarquée dans « Mes dossiers » (Président, via
 * `ClassementConfig.statDispatchsControleurs`) : grille de cartes (une par contrôleur, triées par
 * total décroissant) — avatar à initiales, profil, nom, total et répartition par type de dossier —
 * avec le détail des dossiers dépliable sous la grille (« Voir les dossiers »). Seuls les dossiers
 * encore en cours côté commission comptent (DISPATCHE / EXAMINE) : un dossier sort de la statistique
 * dès la signature de son PV définitif (statut PV_SIGNE et au-delà) ; attributions CC/Président
 * visibles seulement si la délégation « profil → Membre » est active (§3.5). Aucun endpoint dédié :
 * dispatchs + réceptions + dossiers joints côté client (mêmes listes que le drill-down, pas de N+1).
 */
@Component({
  selector: 'app-dispatchs-controleurs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation, DatePipe],
  template: `
    <section class="dpc">
      <h2 class="dpc__titre"><span aria-hidden="true">📊</span> Dispatchs par contrôleur</h2>
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

        <div class="dpc__grid">
          @for (l of lignes(); track l.im; let i = $index) {
            <article class="dpc__card">
              <span class="dpc__rank">#{{ i + 1 }}</span>
              <div class="dpc__avatar dpc__avatar--{{ i % 4 }}">
                <span class="dpc__initiales" aria-hidden="true">{{ initiales(l.nom) }}</span>
              </div>
              <div class="dpc__role">{{ l.profil }}</div>
              <h3 class="dpc__nom">{{ l.nom }}</h3>
              <div class="dpc__total">
                <span class="dpc__total-nb">{{ l.dossiers.length }}</span>
                <span class="dpc__total-lbl">dossier{{ l.dossiers.length > 1 ? 's' : '' }} au total</span>
              </div>
              <ul class="dpc__types">
                @for (t of typesDe(l); track t.libelle; let j = $index) {
                  <li class="dpc__type">
                    <div class="dpc__type-head">
                      <span>{{ t.libelle }}</span>
                      <span class="dpc__type-nb">{{ t.count }}</span>
                    </div>
                    <div class="dpc__tbar"><span class="dpc__tbar-fill dpc__tbar--{{ j % 5 }}" [style.width.%]="t.pct"></span></div>
                  </li>
                }
              </ul>
              <button type="button" class="dpc__voir" (click)="basculer(l.im)">
                {{ ouvert() === l.im ? 'Masquer les dossiers' : 'Voir les dossiers' }}
              </button>
            </article>
          } @empty {
            <div class="dpc__empty">Aucun dossier dispatché pour le moment.</div>
          }
        </div>

        @if (ligneOuverte(); as l) {
          <div class="table-card">
            <div class="dpc__detail-titre">Dossiers dispatchés à {{ l.nom }}</div>
            <table>
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
          </div>
        }
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
  `,
  styles: `
    /* Accent corail de la maquette (nom, bouton) — barres de types en palette assortie. */
    .dpc { --dpc-accent: #e8687e; display: flex; flex-direction: column; gap: 1.15rem; margin-top: 1rem; padding-top: 1.25rem; border-top: 1px solid var(--n-200); }
    .dpc__titre { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--n-800); }
    .dpc__intro { margin: -0.4rem 0 0; color: var(--n-500); }
    .dpc__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.9rem; }

    /* Grille responsive : 4 / 2 / 1 cartes par ligne. */
    .dpc__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.15rem; }
    @media (max-width: 68rem) { .dpc__grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 40rem) { .dpc__grid { grid-template-columns: 1fr; } }

    .dpc__card { position: relative; display: flex; flex-direction: column; gap: 0.45rem; background: #fff; border: 1px solid var(--n-100); border-radius: 16px; box-shadow: 0 10px 28px rgba(30, 41, 59, 0.08); padding: 1.1rem 1.1rem 1.25rem; transition: var(--transition); }
    .dpc__card:hover { transform: translateY(-3px); box-shadow: 0 14px 34px rgba(30, 41, 59, 0.12); }

    /* Photo du membre : cercle à anneau (couleur de la palette), centré — carte compacte. */
    .dpc__avatar { width: 8.5rem; aspect-ratio: 1 / 1; margin: 0.85rem auto 0.35rem; border-radius: 50%; border: 4px solid #fff; display: flex; align-items: center; justify-content: center; color: #fff; }
    .dpc__avatar--0 { background: linear-gradient(160deg, #e8687e, #f29cab); box-shadow: 0 0 0 5px #e8687e, 0 8px 18px rgba(30, 41, 59, 0.14); }
    .dpc__avatar--1 { background: linear-gradient(160deg, #f0a05a, #f6c489); box-shadow: 0 0 0 5px #f0a05a, 0 8px 18px rgba(30, 41, 59, 0.14); }
    .dpc__avatar--2 { background: linear-gradient(160deg, #7b85d4, #a3abe8); box-shadow: 0 0 0 5px #7b85d4, 0 8px 18px rgba(30, 41, 59, 0.14); }
    .dpc__avatar--3 { background: linear-gradient(160deg, #38b2a0, #7bd4c6); box-shadow: 0 0 0 5px #38b2a0, 0 8px 18px rgba(30, 41, 59, 0.14); }
    .dpc__initiales { font-size: 2.4rem; font-weight: 800; letter-spacing: 0.04em; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.14); }
    .dpc__rank { position: absolute; top: 0.75rem; left: 0.75rem; z-index: 1; background: #fff; color: var(--n-700); font-size: 0.72rem; font-weight: 800; padding: 0.16rem 0.55rem; border-radius: var(--radius-full); border: 1px solid var(--n-100); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12); }

    .dpc__role { margin-top: 0.4rem; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--n-400); text-align: center; }
    .dpc__nom { margin: 0; font-size: 1.3rem; font-weight: 800; line-height: 1.15; color: var(--dpc-accent); text-align: center; }
    .dpc__total { display: flex; align-items: baseline; justify-content: center; gap: 0.4rem; }
    .dpc__total-nb { font-size: 1.9rem; font-weight: 800; color: var(--n-800); font-variant-numeric: tabular-nums; }
    .dpc__total-lbl { font-size: var(--text-sm); color: var(--n-400); }

    .dpc__types { list-style: none; margin: 0.15rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .dpc__type-head { display: flex; justify-content: space-between; gap: 0.5rem; font-size: var(--text-sm); color: var(--n-700); }
    .dpc__type-nb { font-weight: 800; font-variant-numeric: tabular-nums; }
    .dpc__tbar { margin-top: 0.28rem; height: 5px; border-radius: var(--radius-full); background: var(--n-100); overflow: hidden; }
    .dpc__tbar-fill { display: block; height: 100%; border-radius: var(--radius-full); transition: width 300ms var(--ease-out); }
    .dpc__tbar--0 { background: #e8687e; }
    .dpc__tbar--1 { background: #f0a05a; }
    .dpc__tbar--2 { background: #7b85d4; }
    .dpc__tbar--3 { background: #38b2a0; }
    .dpc__tbar--4 { background: #b187c9; }

    .dpc__voir { margin-top: 0.6rem; padding: 0.5rem 0.75rem; border-radius: var(--radius-full); border: 1.5px solid var(--dpc-accent); background: #fff; color: var(--dpc-accent); font-weight: 700; cursor: pointer; transition: var(--transition); }
    .dpc__voir:hover { background: var(--dpc-accent); color: #fff; }

    .dpc__detail-titre { padding: 0.85rem 1rem 0; font-weight: 700; color: var(--n-800); }
    .dpc__actions-end { justify-content: flex-end; }
    .dpc__empty { grid-column: 1 / -1; text-align: center; color: var(--n-400); padding: 1.5rem; background: #fff; border: 1px dashed var(--n-200); border-radius: 16px; }
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
  /** Carte du contrôleur déplié (détail affiché sous la grille). */
  readonly ligneOuverte = computed(() => this.lignes().find((l) => l.im === this.ouvert()) ?? null);

  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());

  /** Dossiers distincts dispatchés (un dossier compté une fois, même partagé Membre + CC). */
  readonly totalDossiers = computed(() => {
    const ids = new Set<number>();
    for (const l of this.lignes()) for (const a of l.dossiers) ids.add(a.dossier.idDossier);
    return ids.size;
  });

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
        // Tri par nombre total de dossiers, décroissant (rang #1, #2, …).
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
  /** Initiales de l'avatar (deux premiers mots du nom). */
  initiales(nom: string): string {
    return nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((m) => m[0].toUpperCase())
      .join('');
  }
  /** Répartition des dossiers du contrôleur par type (libellé + compte + % du total), décroissante. */
  typesDe(l: LigneControleur): { libelle: string; count: number; pct: number }[] {
    const compte = new Map<string, number>();
    for (const a of l.dossiers) {
      const lib = this.typeLabel(a.dossier);
      compte.set(lib, (compte.get(lib) ?? 0) + 1);
    }
    return [...compte.entries()]
      .map(([libelle, count]) => ({ libelle, count, pct: (count / l.dossiers.length) * 100 }))
      .sort((a, b) => b.count - a.count);
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
