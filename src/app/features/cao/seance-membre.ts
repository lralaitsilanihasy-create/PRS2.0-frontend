import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { EtatSeance, Seance } from '../../models';
import { SeanceService } from '../../services';
import { ApportParts } from '../procedure/apport-parts';
import { LectureSeance } from '../procedure/lecture-seance';
import { LIBELLES_ETAT_SEANCE, offresOuvertes, quorumLibelle } from '../procedure/seance-ecran';
import { SignaturesPv } from '../procedure/signatures-pv';
import { dateHeureFr } from '../candidat/libelles-candidat';

/**
 * La séance vue par un **membre de la CAO** (lot 4), dans sa procédure : l'heure d'ouverture et le temps qui reste ; à
 * l'ouverture, **« Apporter mes parts »** ; le quorum qui se remplit (relu toutes les cinq secondes) ; puis la lecture des offres
 * et leurs pièces. Le président de la CAO préside ; le responsable de la procédure conduit depuis son écran.
 * ⚠️ V70 : une fois le PV produit, le membre présent le **signe** ici (le président constate un empêchement).
 */
@Component({
  selector: 'app-seance-membre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ApportParts, LectureSeance, SignaturesPv],
  template: `
    <section class="card sm" id="seance" aria-labelledby="sm-titre">
      <header class="sm__tete">
        <h2 id="sm-titre" class="sm__h2">Séance d'ouverture des plis</h2>
        @if (seance(); as s) {
          <span class="badge" [class.badge-success]="s.etat === 'DECHIFFREE' || s.etat === 'CLOSE'" [class.badge-info]="s.etat === 'OUVERTE' || s.etat === 'PV_A_SIGNER'" [class.badge-danger]="s.etat === 'ILLISIBLE'" [class.badge-neutral]="s.etat === 'A_VENIR'">{{ etats[s.etat] }}</span>
        }
      </header>
      @if (absente()) {
        <p class="text-sm text-muted">La séance n'est pas encore programmée pour cette procédure.</p>
      } @else if (seance(); as s) {
        <div class="sm__faits">
          @if (s.heureOuverture) { <span><span class="sm__lib">Ouverture</span><strong>{{ dateHeure(s.heureOuverture) }}</strong></span> }
          <span><span class="sm__lib">Quorum</span><strong>{{ quorum() }}</strong></span>
        </div>
        @if (s.etat === 'A_VENIR') {
          <p class="sm__attente">Au moment de l'ouverture, vous apporterez ici vos parts avec votre phrase secrète.</p>
        } @else if (s.etat === 'OUVERTE') {
          @if (moi()?.partsApportees) {
            <p class="sm__attente">Vos parts sont apportées. Les offres s'ouvriront dès que le quorum sera atteint.</p>
          } @else {
            <div class="sm__action"><app-apport-parts [idDmc]="idDmc()" (apporte)="poser($event)" /></div>
          }
        }
        <!-- ⚠️ V70 (§B2) : chaque membre présent signe le PV ici ; le président constate un empêchement.
             ⚠️ 19/10 (pilote) — avant la lecture : le geste attendu ne se cherche plus sous la liste des offres. -->
        @if (s.pv?.produit) {
          <div class="sm__action" [class.sm__action--fait]="s.pv?.signe">
            <app-signatures-pv [idDmc]="idDmc()" [pv]="s.pv" [membres]="s.membres" vue="membre" [moi]="auth.ref()" (geste)="poser($event)" />
          </div>
        }
        @if (s.etat !== 'A_VENIR' && s.etat !== 'OUVERTE') {
          @if (offresOuvertes(s)) {
            <h3 class="sm__h3">Lecture des offres</h3>
            <app-lecture-seance [idDmc]="idDmc()" />
          } @else {
            <p class="text-sm">Les offres n'ont pas pu être ouvertes : le constat est consigné au procès-verbal.</p>
          }
        }
      }
    </section>
  `,
  styles: `
    .sm { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; }
    .sm__tete { display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; flex-wrap: wrap; }
    .sm__h2 { margin: 0; font-size: 1.1rem; }
    .sm__h3 { margin: 0.3rem 0 0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-500); }
    .sm__faits { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    .sm__faits > span { display: inline-flex; gap: 0.45rem; align-items: baseline; padding: 0.35rem 0.7rem; border-radius: 999px; background: var(--n-100); font-size: var(--text-sm); }
    .sm__lib { color: var(--n-500); }
    .sm__attente { margin: 0; padding: 0.7rem 0.9rem; border-radius: 8px; background: var(--info-bg); color: var(--info-text); font-size: var(--text-sm); }
    .sm__action { padding: 0.9rem 1rem; border-radius: 10px; border: 1px solid var(--warning-bdr); background: var(--warning-bg); }
    .sm__action--fait { border-color: var(--success-bdr); background: var(--success-bg); }
  `,
})
export class SeanceMembre implements OnInit, OnDestroy {
  readonly idDmc = input.required<number>();
  readonly etat = output<EtatSeance>();

  private readonly service = inject(SeanceService);
  protected readonly auth = inject(AuthService);

  readonly etats = LIBELLES_ETAT_SEANCE;
  readonly dateHeure = dateHeureFr;
  readonly seance = signal<Seance | null>(null);
  readonly absente = signal(false);
  readonly moi = computed(() => this.seance()?.membres.find((m) => m.im === this.auth.ref()) ?? null);
  readonly offresOuvertes = offresOuvertes;
  readonly quorum = computed(() => {
    const s = this.seance();
    return s ? quorumLibelle(s) : '';
  });
  private sondage: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    this.lire();
    this.sondage = setInterval(() => {
      const e = this.seance()?.etat;
      if (e === 'OUVERTE' || e === 'A_VENIR' || e === 'PV_A_SIGNER') this.lire();
    }, 5000);
  }

  ngOnDestroy(): void {
    clearInterval(this.sondage);
  }

  /** ⚠️ 19/10 — l'état de la séance remonte à la page, qui en tire le parcours du membre. */
  poser(s: Seance): void {
    this.seance.set(s);
    this.etat.emit(s.etat);
  }

  private lire(): void {
    this.service.lire(this.idDmc()).subscribe({
      next: (s) => {
        this.poser(s);
        this.absente.set(false);
      },
      error: () => this.absente.set(true),
    });
  }
}
