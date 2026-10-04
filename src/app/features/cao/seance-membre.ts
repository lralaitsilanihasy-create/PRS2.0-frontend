import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { Seance } from '../../models';
import { SeanceService } from '../../services';
import { ApportParts } from '../procedure/apport-parts';
import { LectureSeance } from '../procedure/lecture-seance';
import { LIBELLES_ETAT_SEANCE } from '../procedure/seance-ecran';
import { dateHeureFr } from '../candidat/libelles-candidat';

/**
 * La séance vue par un **membre de la CAO** (lot 4), dans sa procédure : l'heure d'ouverture et le temps qui reste ; à
 * l'ouverture, **« Apporter mes parts »** ; le quorum qui se remplit (relu toutes les cinq secondes) ; puis la lecture des offres
 * et leurs pièces. Le président de la CAO préside ; le responsable de la procédure conduit depuis son écran.
 */
@Component({
  selector: 'app-seance-membre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ApportParts, LectureSeance],
  template: `
    <section class="card sm" aria-labelledby="sm-titre">
      <h2 id="sm-titre" class="sm__h2">Séance d'ouverture des plis</h2>
      @if (absente()) {
        <p class="text-sm text-muted">La séance n'est pas encore programmée pour cette procédure.</p>
      } @else if (seance(); as s) {
        <p class="sm__etat">
          <span class="badge" [class.badge-success]="s.etat === 'DECHIFFREE' || s.etat === 'CLOSE'" [class.badge-info]="s.etat === 'OUVERTE'" [class.badge-danger]="s.etat === 'ILLISIBLE'" [class.badge-neutral]="s.etat === 'A_VENIR'">{{ etats[s.etat] }}</span>
          @if (s.heureOuverture) { <span class="text-sm">Ouverture : <strong>{{ dateHeure(s.heureOuverture) }}</strong></span> }
          <span class="text-sm">Quorum : {{ apportees() }} / {{ s.quorum }}</span>
        </p>
        @if (s.etat === 'A_VENIR') {
          <p class="text-sm text-muted">Au moment de l'ouverture, vous apporterez ici vos parts avec votre phrase secrète.</p>
        } @else if (s.etat === 'OUVERTE') {
          @if (moi()?.partsApportees) {
            <p class="text-sm">Vos parts sont apportées. Les offres s'ouvriront dès que le quorum sera atteint.</p>
          } @else {
            <app-apport-parts [idDmc]="idDmc()" (apporte)="seance.set($event)" />
          }
        } @else if (s.etat === 'DECHIFFREE' || s.etat === 'CLOSE') {
          <app-lecture-seance [idDmc]="idDmc()" />
        } @else {
          <p class="text-sm">Les offres n'ont pas pu être ouvertes : le constat est consigné au procès-verbal.</p>
        }
      }
    </section>
  `,
  styles: `
    .sm { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .sm__h2 { margin: 0; font-size: 1.05rem; }
    .sm__etat { margin: 0; display: flex; gap: 0.7rem; align-items: center; flex-wrap: wrap; }
  `,
})
export class SeanceMembre implements OnInit, OnDestroy {
  readonly idDmc = input.required<number>();

  private readonly service = inject(SeanceService);
  private readonly auth = inject(AuthService);

  readonly etats = LIBELLES_ETAT_SEANCE;
  readonly dateHeure = dateHeureFr;
  readonly seance = signal<Seance | null>(null);
  readonly absente = signal(false);
  readonly moi = computed(() => this.seance()?.membres.find((m) => m.im === this.auth.ref()) ?? null);
  readonly apportees = computed(() => {
    const s = this.seance();
    return s ? s.membres.filter((m) => m.partsApportees).length + (s.secoursEmploye ? 1 : 0) : 0;
  });
  private sondage: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    this.lire();
    this.sondage = setInterval(() => {
      const e = this.seance()?.etat;
      if (e === 'OUVERTE' || e === 'A_VENIR') this.lire();
    }, 5000);
  }

  ngOnDestroy(): void {
    clearInterval(this.sondage);
  }

  private lire(): void {
    this.service.lire(this.idDmc()).subscribe({
      next: (s) => {
        this.seance.set(s);
        this.absente.set(false);
      },
      error: () => this.absente.set(true),
    });
  }
}
