import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';

import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { Lecture, OffreLue } from '../../models';
import { SeanceService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

const LIBELLES_INTEGRITE: Readonly<Record<string, string>> = {
  INTACTE: 'Intacte',
  ALTEREE: 'Altérée',
  LECTURE_IMPOSSIBLE: 'Lecture impossible',
};

/**
 * La **lecture en séance** (lot 4, `GET …/seance/lecture`) : offre par offre, dans l'ordre d'arrivée, ce que la séance lit à
 * haute voix — soumissionnaire et groupement, lot, montants, délai, validité, rabais, garantie, pièces manquantes, intégrité,
 * vérification du NIF, alertes (rapprochements, exclusion) — puis les offres non ouvertes et pourquoi. Les pièces s'ouvrent par
 * `ouvrirBlobSur` (`piecesOuvrables` : la CAO, le responsable et la PRMP ; l'UGPM lit sans ouvrir). `projection` grossit le texte.
 */
@Component({
  selector: 'app-lecture-seance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    @if (chargement()) {
      <p class="text-muted" role="status">Chargement de la lecture…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="La lecture n'a pas pu être chargée." (reessayer)="charger()" />
    } @else if (lecture(); as l) {
      <div class="ls" [class.ls--projection]="projection()">
        @if (!l.offres.length && !l.nonOuvertes.length) { <p class="empty-state-title">Aucune offre n'a été déposée.</p> }
        @for (o of l.offres; track o.idOffre) {
          <article class="card ls__offre" [attr.aria-label]="'Offre n° ' + (o.numero ?? '?')">
            <header class="ls__tete">
              <h3 class="ls__titre">Offre n° {{ o.numero ?? '—' }}{{ o.lot ? ' — lot ' + o.lot : '' }} · {{ o.entreprise.raisonSociale }}</h3>
              <span class="badge" [class.badge-success]="o.integrite === 'INTACTE'" [class.badge-danger]="o.integrite !== 'INTACTE'">{{ integrites[o.integrite] ?? o.integrite }}</span>
            </header>
            @if (o.motif) { <p class="text-sm ls__motif">{{ o.motif }}</p> }
            <p class="text-sm">NIF <span class="cnm-mono">{{ o.entreprise.nif }}</span>@if (o.entreprise.verification; as v) { · vérification : {{ v.statut }} }</p>
            @if (o.groupement?.length) { <p class="text-sm">Groupement : {{ membres(o) }}</p> }
            @if (o.acteEngagement; as a) {
              <dl class="ls__ae">
                <dt>Montant HT</dt><dd>{{ montant(a.montantHt) }}</dd>
                <dt>Montant TTC</dt><dd><strong>{{ montant(a.montantTtc) }}</strong></dd>
                <dt>Délai</dt><dd>{{ a.delai }} {{ a.delaiUnite === 'MOIS' ? 'mois' : 'jours' }}</dd>
                <dt>Validité</dt><dd>{{ a.validiteJours }} jours</dd>
                <dt>Rabais</dt><dd>{{ a.rabais || '—' }}</dd>
                <dt>Garantie</dt><dd>{{ o.garantie ? (o.garantie.presente ? 'jointe' : 'absente') + ' · code ' + o.garantie.codeVerification : '—' }}</dd>
              </dl>
            }
            @if (o.piecesManquantes.length) { <p class="text-sm ls__manque">Pièces manquantes : {{ o.piecesManquantes.join(' ; ') }}</p> }
            @for (a of o.alertes; track $index) { <p class="alert alert-warning ls__alerte" role="note"><span>{{ a.type === 'EXCLUSION' ? 'Exclusion' : 'Rapprochement' }} : {{ a.message }}</span></p> }
            @if (piecesOuvrables() && o.pieces.length) {
              <ul class="ls__pieces">
                @for (p of o.pieces; track p.code) {
                  <li>
                    @if (p.presente && p.nomFichier) {
                      <button type="button" class="btn btn-sm btn-outline" [disabled]="ouverture() === o.idOffre + p.nomFichier" (click)="ouvrir(o.idOffre, p.nomFichier!)">{{ p.libelle }}</button>
                      @if (p.empreinteConforme === false) { <span class="badge badge-danger">empreinte non conforme</span> }
                    } @else { <span class="text-sm text-muted">{{ p.libelle }} — absente</span> }
                  </li>
                }
              </ul>
            }
          </article>
        }
        @if (l.nonOuvertes.length) {
          <h3 class="ls__h3">Offres non ouvertes</h3>
          <ul class="ls__non">
            @for (n of l.nonOuvertes; track $index) { <li>N° {{ n.numero ?? '—' }} · {{ n.entreprise }} — {{ n.etat }}{{ n.motif ? ' : ' + n.motif : '' }}</li> }
          </ul>
        }
      </div>
    }
  `,
  styles: `
    .ls { display: flex; flex-direction: column; gap: 0.75rem; }
    .ls__offre { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .ls__tete { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .ls__titre { margin: 0; font-size: 1rem; }
    .ls__motif, .ls__manque { margin: 0; color: var(--danger-text); }
    .ls__ae { margin: 0; display: grid; grid-template-columns: max-content 1fr max-content 1fr; gap: 0.25rem 1rem; font-size: var(--text-sm); }
    .ls__ae dt { color: var(--n-500); }
    .ls__ae dd { margin: 0; }
    .ls__alerte { margin: 0; }
    .ls__pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .ls__h3 { margin: 0.5rem 0 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ls__non { margin: 0; padding-left: 1.2rem; font-size: var(--text-sm); }
    .ls--projection { font-size: 1.25rem; }
    .ls--projection .ls__titre { font-size: 1.5rem; }
    .ls--projection .ls__ae { font-size: 1.2rem; }
    @media (max-width: 700px) { .ls__ae { grid-template-columns: max-content 1fr; } }
  `,
})
export class LectureSeance implements OnInit {
  readonly idDmc = input.required<number>();
  readonly piecesOuvrables = input(true);
  readonly projection = input(false);

  private readonly service = inject(SeanceService);

  readonly integrites = LIBELLES_INTEGRITE;
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly lecture = signal<Lecture | null>(null);
  readonly ouverture = signal<string | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.lecture(this.idDmc()).subscribe({
      next: (l) => {
        this.lecture.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  membres(o: OffreLue): string {
    return (o.groupement ?? []).map((g) => `${g.raisonSociale} (${g.nif})${g.mandataire ? ', mandataire' : ''}`).join(' ; ');
  }

  montant(v: number | null | undefined): string {
    return v == null ? '—' : `${new Intl.NumberFormat('fr-FR').format(v)} Ar`;
  }

  ouvrir(idOffre: string, nom: string): void {
    this.ouverture.set(idOffre + nom);
    this.service.piece(this.idDmc(), idOffre, nom).subscribe({
      next: (b) => {
        this.ouverture.set(null);
        ouvrirBlobSur(b);
      },
      error: () => this.ouverture.set(null),
    });
  }
}
