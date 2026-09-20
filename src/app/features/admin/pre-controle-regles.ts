import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LigneStatistiqueRegle, StatistiquesRegles } from '../../models';
import { PreControleService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/**
 * **Taux d'écartement des règles du pré-contrôle** (Administrateur, Président — assistant IA, lot 3,
 * étape 7 ; `backend/docs/plan-assistant-ia.md` §4, lot 3, 3.e).
 *
 * <p>Cet écran n'est pas un tableau de bord de plus : il répond au seul risque qui tue ce genre de
 * fonctionnalité. **Si l'outil signale trop, tout le monde écarte tout sans lire, et il meurt en six
 * semaines.** Le taux d'écartement est la mesure qui le dit — une règle écartée dans 80 % des cas est une
 * mauvaise règle, et on l'éteint depuis « Règles d'anomalie », sans redéploiement.</p>
 *
 * <p>Deux distinctions que l'écran doit rendre évidentes, parce que les confondre conduirait à éteindre
 * les règles qui marchent :</p>
 * <ul>
 *   <li>un signalement **levé** est un **succès** : la PRMP a corrigé son plan. Il ne compte pas dans le
 *       taux ;</li>
 *   <li>une **piste de l'assistant** ne se juge pas comme une **règle** : une piste écartée reste une
 *       piste, une règle écartée est un défaut.</li>
 * </ul>
 *
 * <p>Il ne lit que des **compteurs** : aucun plan, aucun marché, aucun acteur. C'est ce qui permet de
 * l'ouvrir à l'Administrateur, dont le rôle est technique.</p>
 */
@Component({
  selector: 'app-pre-controle-regles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Administration</div>
          <h1 class="page-title">Taux d'écartement des règles du pré-contrôle</h1>
        </div>
        <a class="btn btn-secondary btn-sm" routerLink="/admin/referentiels/regle-anomalies">
          Ouvrir les règles d'anomalie
        </a>
      </header>

      <p class="text-muted">
        Une règle écartée presque à chaque fois est une mauvaise règle : elle fatigue la PRMP et le
        contrôleur, qui finissent par tout écarter sans lire. Elle s'éteint depuis « Règles d'anomalie »
        — sans redéploiement, et sans rien perdre : les signalements déjà écartés gardent leur motif.
      </p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des compteurs…</p>
      } @else if (erreur()) {
        <app-etat-erreur
          message="Les compteurs du pré-contrôle n'ont pas pu être chargés."
          (reessayer)="charger()"
        />
      } @else if (stats(); as s) {
        <div class="pcr-total">
          <span
            >{{ s.total }} signalement{{ s.total > 1 ? 's' : '' }} observé{{ s.total > 1 ? 's' : '' }}</span
          >
          <span>·</span>
          <span>{{ s.ecartes }} écarté{{ s.ecartes > 1 ? 's' : '' }}</span>
          <span>·</span>
          <span>taux global {{ pourcent(s.tauxGlobal) }}</span>
        </div>

        <div class="table-card">
          <table>
            <thead>
              <tr>
                <!-- ⚠️ En-têtes courts : mesuré en recette à 1366×768, « Taux d'écartement » et « État »
                     sortaient de l'écran. Le sens des colonnes est expliqué sous le tableau. -->
                <th scope="col">Règle</th>
                <th scope="col">Source</th>
                <th scope="col" class="r">Total</th>
                <th scope="col" class="r">Ouverts</th>
                <th scope="col" class="r">Écartés</th>
                <th scope="col" class="r">Levés</th>
                <th scope="col" class="r">Taux</th>
                <th scope="col">État</th>
              </tr>
            </thead>
            <tbody>
              @for (r of s.regles; track r.code) {
                <tr [class.pcr-suspecte]="r.suspecte">
                  <td>
                    <b>{{ r.libelle || r.code }}</b>
                    <span class="pcr-code">{{ r.code }}</span>
                  </td>
                  <td>
                    <span class="badge" [class.badge-neutral]="r.source === 'REGLE'" [class.badge-info]="r.source === 'IA'">
                      {{ r.source === 'IA' ? 'Piste' : 'Règle' }}
                    </span>
                  </td>
                  <td class="r">{{ r.total }}</td>
                  <td class="r">{{ r.ouverts }}</td>
                  <td class="r">{{ r.ecartes }}</td>
                  <td class="r">{{ r.leves }}</td>
                  <td class="r">{{ r.total ? pourcent(r.taux) : '—' }}</td>
                  <td>
                    @if (!r.actif) {
                      <span class="badge badge-neutral">Éteinte</span>
                    } @else if (r.suspecte) {
                      <span class="badge badge-danger">À revoir</span>
                    } @else {
                      <span class="badge badge-success">Active</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="empty-cell">Aucune règle enregistrée.</td></tr>
              }
            </tbody>
          </table>
        </div>

        <p class="text-muted pcr-lecture">
          <b>Comment se lit ce tableau.</b> « Levés » compte les signalements qui ont disparu parce que le
          plan a été corrigé : c'est la réussite de la règle, et cela ne compte pas dans son taux.
          « Écartés » compte les désaccords motivés. Une <b>piste</b> de l'assistant écartée souvent reste
          une piste — c'est une suggestion ; une <b>règle</b> écartée souvent est un défaut à corriger.
          Le taux n'est signalé qu'à partir de {{ minimumSignificatif }} signalements : trois signalements
          dont deux écartés ne disent rien.
        </p>
      }
    </section>
  `,
  styles: `
    .pcr-total {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 10px;
      font-size: var(--text-sm);
      color: var(--n-500);
    }
    .pcr-code {
      display: block;
      font-family: var(--cnm-mono);
      font-size: var(--text-xs);
      color: var(--n-500);
    }
    /* Une règle à revoir se voit à la ligne, pas seulement à sa pastille. */
    .pcr-suspecte {
      background: var(--danger-bg);
    }
    .pcr-lecture {
      margin-top: 12px;
      max-width: 70ch;
      line-height: 1.5;
    }
  `,
})
export class PreControleRegles {
  private readonly service = inject(PreControleService);

  /** Seuil d'alerte du serveur, redit ici pour que l'écran l'explique sans le recalculer. */
  readonly minimumSignificatif = 5;

  readonly stats = signal<StatistiquesRegles | null>(null);
  readonly chargement = signal(false);
  readonly erreur = signal(false);

  /** Les règles à revoir — ce que l'accueil de l'Administrateur annonce en « À surveiller ». */
  readonly suspectes = computed<LigneStatistiqueRegle[]>(
    () => this.stats()?.regles.filter((r) => r.suspecte && r.actif) ?? [],
  );

  constructor() {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.statistiques().subscribe({
      next: (s) => {
        this.stats.set(s);
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  pourcent(taux: number): string {
    return `${Math.round(taux * 100)} %`;
  }
}
