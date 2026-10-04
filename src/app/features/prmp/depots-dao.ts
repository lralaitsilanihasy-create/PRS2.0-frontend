import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { empreinteCourte, formaterEmpreinte } from '../../core/securite/cles-detenteur';
import { Depots, EtatOffre } from '../../models';
import { FicheMarcheService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr, tailleLisible } from '../candidat/libelles-candidat';

const LIBELLES_ETAT: Readonly<Record<EtatOffre, string>> = {
  EN_COURS: 'En cours',
  DEPOSEE: 'Déposée',
  REMPLACEE: 'Remplacée',
  RETIREE: 'Retirée',
  ECARTEE: 'Écartée',
};

/**
 * Le **registre des dépôts** d'une procédure en remise électronique (`GET /api/fiches-marche/{idDmc}/depots`, lot 3 §B5) —
 * PRMP et UGPM de la fiche, responsable de la procédure. **Avant la date limite, le nombre seul** : qui a déposé ne se sait
 * pas avant l'échéance, comme on ne lit pas le registre des plis avant l'heure. Après, la liste : numéro d'arrivée,
 * entreprise, lot, horodatage, empreinte — la matière de la séance d'ouverture (lot 4).
 */
@Component({
  selector: 'app-depots-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    <section class="dd">
      <nav class="dd__ariane" aria-label="Fil d'Ariane">
        <a [routerLink]="['/prmp', 'dao', idDmc]">Fiche DAO</a><span aria-hidden="true">›</span><span aria-current="page">Dépôts des offres</span>
      </nav>
      <header class="page-header">
        <div class="page-subtitle">Domaine PRMP · ligne {{ idDmc }} du plan</div>
        <h1 class="page-title">Registre des dépôts</h1>
      </header>
      <p class="page-role">Les offres déposées en ligne. Avant la date limite, seul leur nombre est connu ; leur contenu, lui, ne s'ouvre qu'en séance, au quorum des membres de la commission.</p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (refuse()) {
        <div class="alert alert-info" role="status"><span>Le registre des dépôts est réservé à la PRMP de la fiche et au responsable de la procédure.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="Le registre n'a pas pu être chargé." (reessayer)="charger()" />
      } @else if (registre(); as r) {
        <p class="dd__nombre"><strong>{{ r.nombre }}</strong> {{ r.nombre > 1 ? 'offres déposées' : 'offre déposée' }}{{ r.dateLimite ? (r.clos ? ' — dépôts clos le ' : ' — date limite : ') + dateHeure(r.dateLimite) : '' }}</p>
        @if (!r.clos) {
          <p class="text-sm text-muted">Le détail des dépôts s'affichera à la date limite.</p>
        } @else if (r.depots?.length) {
          <div class="table-card">
            <table class="dd__table">
              <caption class="cnm-sr-only">Les dépôts, par numéro d'arrivée</caption>
              <thead><tr><th scope="col">N°</th><th scope="col">Entreprise</th><th scope="col">NIF</th><th scope="col">Lot</th><th scope="col">Déposée le</th><th scope="col">État</th><th scope="col">Empreinte</th><th scope="col">Taille</th></tr></thead>
              <tbody>
                @for (d of r.depots; track $index) {
                  <tr>
                    <td>{{ d.numero ?? '—' }}</td><td>{{ d.entreprise }}</td><td class="cnm-mono">{{ d.nif }}</td><td>{{ d.lot ?? '—' }}</td>
                    <td class="nowrap">{{ d.dateDepot ? dateHeure(d.dateDepot) : '—' }}{{ d.dateRetrait ? ' (retirée le ' + dateHeure(d.dateRetrait) + ')' : '' }}</td>
                    <td>{{ etats[d.etat] }}</td>
                    <td><code class="cnm-mono" [title]="d.empreinte ? formater(d.empreinte) : ''">{{ d.empreinte ? courte(d.empreinte) : '—' }}</code></td>
                    <td class="nowrap">{{ taille(d.taille) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty-state"><p class="empty-state-title">Aucune offre déposée.</p></div>
        }
      }
    </section>
  `,
  styles: `
    .dd { display: flex; flex-direction: column; gap: 0.75rem; }
    .dd__ariane { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); }
    .dd__ariane a { color: var(--p-700); font-weight: 600; }
    .dd__nombre { margin: 0; font-size: 1rem; }
    .dd__table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .dd__table th, .dd__table td { text-align: left; padding: 0.5rem 0.7rem; border-bottom: 1px solid var(--n-200); }
    .dd__table th { color: var(--n-500); font-weight: 600; }
  `,
})
export class DepotsDao implements OnInit {
  private readonly service = inject(FicheMarcheService);
  private readonly route = inject(ActivatedRoute);

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly etats = LIBELLES_ETAT;
  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;
  readonly formater = formaterEmpreinte;
  readonly courte = empreinteCourte;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly refuse = signal(false);
  readonly registre = signal<Depots | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.refuse.set(false);
    this.service.depots(this.idDmc).subscribe({
      next: (r) => {
        this.registre.set(r);
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 403) this.refuse.set(true);
        else this.erreur.set(true);
      },
    });
  }
}
