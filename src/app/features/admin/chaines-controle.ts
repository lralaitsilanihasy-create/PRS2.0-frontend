import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ToastService } from '../../core/notifications/toast.service';
import { Controleur, RattachementDto } from '../../models';
import { ControleurService, ProfileService } from '../../services';

/**
 * ⚠️ Rattachements (2026-09-01) — écran « Chaînes de contrôle » : chaque Membre a SON Vérificateur,
 * chaque Vérificateur a SON Assistant. Ces chaînes ROUTENT la boucle FAVR post-visa (files ciblées,
 * notifications) sans la fermer : un collègue de la localité peut toujours agir — le ciblage n'est
 * pas une garde. Ouvert à Admin (tout), Président (tout) et CC (sa localité — le serveur scope le
 * GET et refuse le PUT hors localité). Une chaîne incomplète est un état NORMAL (repli localité) ;
 * l'écran la signale pour inciter à compléter, comme le mapping DMC.
 *
 * Route « chaines-controle » — PAS « rattachements », déjà pris par les rattachements PRMP↔entité.
 */
@Component({
  selector: 'app-chaines-controle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="chc">
      <header class="page-header">
        <h1 class="page-title">Chaînes de contrôle</h1>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>
      <!-- Un seul <span> : .alert est en flex, des <strong> nus deviendraient des colonnes. -->
      <p class="alert alert-info">
        <span>
          Chaque <strong>Membre</strong> a son Vérificateur rattaché, chaque <strong>Vérificateur</strong> son
          Assistant : la vérification des documents témoins rectifiés (observations du PV Favorable avec
          réserves) et l'archivage sont <strong>ciblés</strong> sur ces chaînes. Une chaîne incomplète n'est
          pas bloquante — tout Vérificateur ou Assistant de la localité reste compétent (repli).
        </span>
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        @for (section of sections(); track section.profilAttendu) {
          <h2 class="chc__sub">
            {{ section.titre }}
            @if (section.sansRattache > 0) {
              <span class="badge badge-warning">{{ section.sansRattache }} sans rattaché</span>
            }
          </h2>
          <div class="table-responsive">
            <table class="cnm-table">
              <thead><tr><th scope="col">{{ section.colPorteur }}</th><th scope="col">Localité</th><th scope="col">{{ section.colRattache }}</th><th scope="col">État</th></tr></thead>
              <tbody>
                @for (r of section.lignes; track r.imControleur) {
                  <tr>
                    <td>{{ r.nomControleur || r.imControleur }} <span class="cnm-mono chc__im">{{ r.imControleur }}</span></td>
                    <td>{{ r.idLocalite ?? '—' }}</td>
                    <td>
                      <select class="form-control chc__select" [value]="r.imRattache ?? ''"
                        [disabled]="saving() === r.imControleur"
                        [attr.aria-label]="section.colRattache + ' de ' + (r.nomControleur || r.imControleur)"
                        (change)="rattacher(r, $any($event.target).value || null)">
                        <option value="" [selected]="!r.imRattache">— Aucun (repli localité) —</option>
                        @for (c of candidats(r); track c.imControleur) {
                          <option [value]="c.imControleur" [selected]="c.imControleur === r.imRattache">{{ nomDe(c) }}</option>
                        }
                      </select>
                    </td>
                    <td>
                      @if (r.imRattache) {
                        <span class="badge">{{ r.nomRattache || r.imRattache }}</span>
                      } @else {
                        <span class="badge badge-warning">Repli localité</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="cnm-muted">Aucun contrôleur de ce profil.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .chc { display: flex; flex-direction: column; gap: 1rem; }
    .chc__sub { display: flex; align-items: center; gap: 0.5rem; font-size: var(--text-lg); margin: 0.5rem 0 0; }
    .chc__select { min-width: 16rem; max-width: 28rem; }
    .chc__im { font-size: var(--text-sm); color: var(--n-500); margin-left: 0.35rem; }
  `,
})
export class ChainesControle implements OnInit {
  private readonly controleurService = inject(ControleurService);
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(ToastService);

  readonly rattachements = signal<RattachementDto[]>([]);
  private readonly controleurs = signal<Controleur[]>([]);
  private readonly profileLib = signal<Map<number, string>>(new Map());
  readonly loading = signal(false);
  /** Matricule du porteur en cours d'enregistrement (désactive son select). */
  readonly saving = signal<string | null>(null);

  /** Les deux sections de l'écran, dérivées du GET (le serveur scope déjà le CC à sa localité). */
  readonly sections = computed(() => {
    const rows = this.rattachements();
    const faire = (profilAttendu: string, titre: string, colPorteur: string, colRattache: string) => {
      const lignes = rows.filter((r) => r.profilAttendu === profilAttendu);
      return { profilAttendu, titre, colPorteur, colRattache, lignes, sansRattache: lignes.filter((r) => !r.imRattache).length };
    };
    return [
      faire('VERIFICATEUR', 'Membres → Vérificateur rattaché', 'Membre', 'Vérificateur rattaché'),
      faire('ASSISTANT_CONTROLEUR', 'Vérificateurs → Assistant rattaché', 'Vérificateur', 'Assistant rattaché'),
    ];
  });

  /** Regex de profil par `profilAttendu` — le serveur a déjà résolu la règle, on ne fait que peupler la liste. */
  private static readonly PROFILS: Record<string, RegExp> = {
    VERIFICATEUR: /v[ée]rificateur/i,
    ASSISTANT_CONTROLEUR: /assistant/i,
  };

  /** Candidats d'une ligne : profil attendu + MÊME localité (409 serveur sinon), soi-même exclu (409 auto-rattachement). */
  candidats(r: RattachementDto): Controleur[] {
    const regex = ChainesControle.PROFILS[r.profilAttendu];
    if (!regex) return [];
    const libs = this.profileLib();
    return this.controleurs().filter(
      (c) =>
        c.imControleur !== r.imControleur &&
        c.idProfile != null &&
        regex.test(libs.get(c.idProfile) ?? '') &&
        c.idLocalite === r.idLocalite,
    );
  }

  nomDe(c: Controleur): string {
    return [c.nomCont, c.prenomsCont].filter(Boolean).join(' ') || c.imControleur;
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    forkJoin({
      rattachements: this.controleurService.rattachements(),
      controleurs: this.controleurService.list(),
      profiles: this.profileService.list(),
    }).subscribe({
      next: ({ rattachements, controleurs, profiles }) => {
        this.rattachements.set(rattachements);
        this.controleurs.set(controleurs);
        this.profileLib.set(new Map(profiles.map((p) => [p.idProfile, p.profile ?? ''])));
        this.loading.set(false);
      },
      error: () => this.loading.set(false), // 403 → toast centralisé
    });
  }

  /** Pose ou retire (« — Aucun — » → null) le rattaché ; la ligne est remplacée par la réponse serveur. */
  rattacher(r: RattachementDto, imRattache: string | null): void {
    this.saving.set(r.imControleur);
    this.controleurService.majRattachement(r.imControleur, imRattache).subscribe({
      next: (maj) => {
        this.saving.set(null);
        this.rattachements.update((rows) => rows.map((x) => (x.imControleur === maj.imControleur ? maj : x)));
        this.toast.success(
          maj.imRattache
            ? `${maj.nomControleur || maj.imControleur} → ${maj.nomRattache || maj.imRattache}.`
            : `${maj.nomControleur || maj.imControleur} détaché — repli localité.`,
        );
      },
      error: () => {
        this.saving.set(null);
        this.charger(); // 403/409 → toast centralisé ; on recharge pour rétablir le select
      },
    });
  }
}
