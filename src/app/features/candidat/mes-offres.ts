import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { empreinteCourte, formaterEmpreinte } from '../../core/securite/cles-detenteur';
import { telechargerBlob } from '../../core/securite/fichiers-surs';
import { EnveloppeOffre, EtatOffre, Offre } from '../../models';
import { OffresCandidatService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { DemandesOffre } from './demandes-offre';
import { ResultatOffreCandidat } from './resultat-offre';
import { dateHeureFr, tailleLisible } from './libelles-candidat';

const LIBELLES_ETAT: Readonly<Record<EtatOffre, string>> = {
  EN_COURS: 'Dépôt inachevé',
  DEPOSEE: 'Déposée',
  REMPLACEE: 'Remplacée',
  RETIREE: 'Retirée',
  ECARTEE: 'Écartée',
};

const LIBELLES_ENVELOPPE: Readonly<Record<EnveloppeOffre, string>> = { TECHNIQUE: 'Enveloppe technique', FINANCIERE: 'Enveloppe financière' };

/**
 * ⚠️ V86 (lot 3 PI, PI-b) — l'enveloppe qui manque à une proposition de prestations intellectuelles déposée à moitié : l'autre
 * enveloppe, si aucune offre déposée de la même procédure et du même lot ne la porte ; `null` pour une offre ordinaire ou complète.
 */
export function enveloppeManquante(o: Offre, toutes: Offre[]): EnveloppeOffre | null {
  if (!o.enveloppe || o.etat !== 'DEPOSEE') return null;
  const autre: EnveloppeOffre = o.enveloppe === 'TECHNIQUE' ? 'FINANCIERE' : 'TECHNIQUE';
  return toutes.some((x) => x.idDmc === o.idDmc && x.lot === o.lot && x.etat === 'DEPOSEE' && x.enveloppe === autre) ? null : autre;
}

/**
 * **Mes offres** (`GET /api/candidat/offres`, lot 3) : toutes les offres du candidat, toutes procédures. Une offre déposée
 * offre son accusé (PDF), son **remplacement** (un nouveau dépôt pour le même lot, qui ne fait tomber l'ancienne qu'à son
 * scellement) et son **retrait** (confirmé en deux temps) — tant que la date limite n'est pas passée et que la procédure
 * l'autorise ; le serveur tranche (409 nommés).
 */
@Component({
  selector: 'app-mes-offres',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, DemandesOffre, ResultatOffreCandidat],
  template: `
    <header class="page-header">
      <div class="page-subtitle">Espace candidat</div>
      <h1 class="page-title">Mes offres</h1>
    </header>
    <p class="page-role">Vos offres déposées en ligne, avec leur accusé de réception. Tant que la date limite n’est pas passée, vous pouvez remplacer ou retirer une offre, si la procédure l’autorise.</p>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Vos offres n'ont pas pu être chargées." (reessayer)="charger()" />
    } @else if (!offres().length) {
      <div class="empty-state">
        <p class="empty-state-title">Aucune offre déposée.</p>
        <p class="empty-state-text"><a routerLink="/candidat/procedures">Voir les procédures ouvertes</a>.</p>
      </div>
    } @else {
      @if (message(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }
      <ul class="mo" aria-label="Mes offres">
        @for (o of offres(); track o.idOffre) {
          <li class="card mo__offre">
            <div class="mo__haut">
              <span><strong>{{ o.objet || ('Procédure ' + o.idDmc) }}</strong>{{ o.lot ? ' — lot ' + o.lot : '' }}</span>
              <!-- Recette du 09/10 : l'enveloppe à côté de l'état, à droite (dans le titre, elle repoussait l'état à la ligne). -->
              <span class="mo__badges">
                @if (o.enveloppe) { <span class="badge badge-info">{{ enveloppes[o.enveloppe] }}</span> }
                <span class="badge" [class.badge-success]="o.etat === 'DEPOSEE'" [class.badge-neutral]="o.etat === 'REMPLACEE' || o.etat === 'RETIREE' || o.etat === 'EN_COURS'" [class.badge-danger]="o.etat === 'ECARTEE'">{{ etats[o.etat] }}</span>
              </span>
            </div>
            <p class="text-sm text-muted mo__meta">
              <span class="cnm-mono">{{ o.reference }}</span>
              @if (o.dateDepot) { · déposée le {{ dateHeure(o.dateDepot) }}{{ o.numero ? ', n° ' + o.numero : '' }} }
              @if (o.dateRetrait) { · retirée le {{ dateHeure(o.dateRetrait) }} }
              · {{ taille(o.taille) }}
            </p>
            @if (manquante(o); as m) {
              <!-- ⚠️ V86 (PI-b) — une proposition PI se dépose en deux enveloppes : sans la seconde, la séance le signale. -->
              <div class="alert alert-warning mo__manque" role="note">
                <span>{{ enveloppes[m] }} non déposée : votre proposition est incomplète.</span>
                <a class="btn btn-sm btn-primary" [routerLink]="['/candidat', 'procedures', o.idDmc, 'offre']" [queryParams]="{ enveloppe: m, lot: o.lot }">Déposer l’{{ m === 'FINANCIERE' ? 'enveloppe financière' : 'enveloppe technique' }}</a>
              </div>
            }
            @if (o.empreinte) { <p class="text-xs mo__emp">Empreinte <code class="cnm-mono" [title]="formater(o.empreinte)">{{ courte(o.empreinte) }}</code></p> }
            @if (o.etat === 'DEPOSEE') {
              <div class="mo__actions">
                <button type="button" class="btn btn-sm btn-outline" [disabled]="enCours() === o.idOffre" (click)="accuse(o)">Accusé (PDF)</button>
                <a class="btn btn-sm btn-outline" [routerLink]="['/candidat', 'procedures', o.idDmc, 'offre']" [queryParams]="{ remplace: o.idOffre, lot: o.lot, enveloppe: o.enveloppe }">Remplacer</a>
                @if (aRetirer() !== o.idOffre) {
                  <button type="button" class="btn btn-sm btn-outline" (click)="aRetirer.set(o.idOffre)">Retirer…</button>
                } @else {
                  <span class="mo__confirm">{{ o.enveloppe ? 'Retirer cette proposition ? Ses deux enveloppes sont retirées, aucune ne sera ouverte.' : 'Retirer cette offre ? Elle ne sera pas ouverte.' }}
                    <button type="button" class="btn btn-sm btn-danger" [disabled]="enCours() === o.idOffre" (click)="retirer(o)">Confirmer le retrait</button>
                    <button type="button" class="btn btn-sm btn-outline" (click)="aRetirer.set(null)">Annuler</button>
                  </span>
                }
              </div>
            }
            <!-- ⚠️ 07/10 — pendant l'évaluation, les demandes de la commission sur cette offre, et la réponse du candidat. -->
            @if (o.etat === 'DEPOSEE') {
              <app-demandes-offre [idOffre]="o.idOffre" />
              <!-- ⚠️ 07/10 (attribution, tranches 2b, 2c) — le résultat, la lettre, les explications ; attributaire : pièces et marché. -->
              <app-resultat-offre [idOffre]="o.idOffre" />
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .mo { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .mo__offre { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .mo__haut { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .mo__meta, .mo__emp { margin: 0; }
    .mo__actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .mo__haut > span:first-child { flex: 1 1 20rem; min-width: 0; }
    .mo__badges { display: inline-flex; gap: 0.4rem; align-items: center; flex: none; }
    .mo__manque { display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; flex-wrap: wrap; margin: 0; }
    .mo__confirm { display: inline-flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); }
  `,
})
export class MesOffres implements OnInit {
  private readonly service = inject(OffresCandidatService);
  private readonly toast = inject(ToastService);

  readonly etats = LIBELLES_ETAT;
  readonly enveloppes = LIBELLES_ENVELOPPE;
  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;
  readonly formater = formaterEmpreinte;
  readonly courte = empreinteCourte;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly offres = signal<Offre[]>([]);
  readonly aRetirer = signal<string | null>(null);
  readonly enCours = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  constructor() {
    inject(DOCUMENT).title = 'Mes offres — Espace candidat — PRS 2.0';
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.liste().subscribe({
      next: (l) => {
        // Les dépôts inachevés se purgent seuls : on ne les montre pas.
        this.offres.set(l.filter((o) => o.etat !== 'EN_COURS'));
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  manquante(o: Offre): EnveloppeOffre | null {
    return enveloppeManquante(o, this.offres());
  }

  accuse(o: Offre): void {
    this.enCours.set(o.idOffre);
    this.service.accuse(o.idOffre).subscribe({
      next: (b) => {
        this.enCours.set(null);
        telechargerBlob(b, `accuse-depot-${o.idDmc}-${o.idOffre.slice(0, 8)}.pdf`);
      },
      error: () => this.enCours.set(null),
    });
  }

  retirer(o: Offre): void {
    this.enCours.set(o.idOffre);
    this.message.set(null);
    this.service.retirer(o.idOffre).subscribe({
      next: () => {
        this.enCours.set(null);
        this.aRetirer.set(null);
        this.toast.success(o.enveloppe ? 'Votre proposition est retirée, ses deux enveloppes : aucune ne sera ouverte.' : 'Votre offre est retirée : elle ne sera pas ouverte.', 'C’est fait');
        this.charger();
      },
      error: (e: ApiError) => {
        this.enCours.set(null);
        const code = codeErreur(e);
        this.message.set(code === 'DELAI_DEPASSE' ? 'La date limite est passée : l’offre ne peut plus être retirée.' : code === 'REMPLACEMENT_INTERDIT' ? 'Cette procédure n’autorise pas le retrait d’une offre déposée.' : e.message || 'Le retrait n’a pas abouti.');
      },
    });
  }
}
