import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { RetraitDao } from '../../models';
import { FicheMarcheService } from '../../services';
import { EnteteProcedure } from './entete-procedure';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr } from '../candidat/libelles-candidat';

/**
 * Le registre des retraits du DAO (`GET /api/fiches-marche/{idDmc}/retraits`, soumission en ligne §B8, V65) — qui a
 * téléchargé quoi, quand, depuis la fiche validée. **PRMP de la fiche seule** : 403 à l'UGPM et à l'Administrateur,
 * que l'écran nomme sans alarmer. Chaque téléchargement fait une ligne : un même document retiré deux fois en fait
 * deux, et c'est voulu — c'est un registre, pas une liste de candidats.
 */
@Component({
  selector: 'app-retraits-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, EnteteProcedure],
  template: `
    <section class="rd">
      <header class="page-header">
        <app-entete-procedure [idDmc]="idDmc" />
        <h1 class="page-title">Registre des retraits du DAO</h1>
      </header>
      <p class="page-role">Les candidats qui ont retiré le dossier en ligne, du plus ancien au plus récent. Une entreprise absente signifie qu'elle n'était pas encore déclarée au moment du retrait.</p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement du registre…</p>
      } @else if (refuse()) {
        <div class="alert alert-info" role="status"><span>Le registre des retraits est réservé à la PRMP de la fiche.</span></div>
      } @else if (inconnue()) {
        <div class="alert alert-info" role="status"><span>Aucune fiche DAO pour cette ligne du plan.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="Le registre n'a pas pu être chargé." (reessayer)="charger()" />
      } @else if (!retraits().length) {
        <div class="empty-state">
          <p class="empty-state-title">Aucun retrait pour l'instant.</p>
          <p class="empty-state-text">Les retraits s'inscrivent ici dès qu'un candidat télécharge un document du dossier.</p>
        </div>
      } @else {
        <div class="table-card">
          <table class="rd__table">
            <caption class="cnm-sr-only">Retraits du DAO, du plus ancien au plus récent</caption>
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Compte</th><th scope="col">Entreprise</th><th scope="col">NIF</th><th scope="col">Document</th><th scope="col">Version</th><th scope="col">Reçu des frais</th></tr>
            </thead>
            <tbody>
              @for (r of retraits(); track $index) {
                <tr>
                  <td class="nowrap">{{ dateHeure(r.date) }}</td>
                  <td>{{ r.compte }}</td>
                  <td>{{ r.entreprise || '—' }}</td>
                  <td class="cnm-mono">{{ r.nif || '—' }}</td>
                  <td>{{ r.document }}</td>
                  <td class="cnm-mono">v{{ r.version }}</td>
                  <td>{{ r.recu ? (r.recu.etat === 'VALIDE' ? 'validé' : r.recu.etat === 'REFUSE' ? 'refusé' : 'en attente') + ' · ' + r.recu.referencePaiement : 'retrait libre' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="text-sm text-muted">{{ retraits().length }} {{ retraits().length > 1 ? 'retraits' : 'retrait' }}.</p>
      }
    </section>
  `,
  styles: `
    .rd { display: flex; flex-direction: column; gap: 0.75rem; }
    .rd__table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .rd__table th, .rd__table td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--n-200); }
    /* 06/10 — pas de couleur ici : l’en-tête global est bleu à texte blanc (gris sur bleu < AA). */
    .rd__table th { font-weight: 600; }
  `,
})
export class RetraitsDao implements OnInit {
  private readonly service = inject(FicheMarcheService);
  private readonly route = inject(ActivatedRoute);

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly dateHeure = dateHeureFr;
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly refuse = signal(false);
  /** 404 : la ligne du plan n'a pas de fiche (ou plus — la base de recette a été vidée le 25/09). */
  readonly inconnue = signal(false);
  readonly retraits = signal<RetraitDao[]>([]);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.refuse.set(false);
    this.inconnue.set(false);
    this.service.retraits(this.idDmc).subscribe({
      next: (r) => {
        this.retraits.set(r);
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 403) this.refuse.set(true);
        else if (e.status === 404) this.inconnue.set(true);
        else this.erreur.set(true);
      },
    });
  }
}
