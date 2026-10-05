import { ChangeDetectionStrategy, Component, DOCUMENT, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Ceremonie, Detenteur, ProcedureDepositaire } from '../../models';
import { CeremonieService, DepositaireService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_ETAT_CEREMONIE, classeCeremonie } from '../cao/libelles-cao';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { ApportParts } from '../procedure/apport-parts';
import { PartSecours } from '../procedure/part-secours';
import { LIBELLES_ETAT_SEANCE } from '../procedure/seance-ecran';

/**
 * ⚠️ V71 (décision du pilote, 05/10) — une procédure vue par son **dépositaire** : la cérémonie (en lecture), **sa clé de
 * secours** (générée sur son poste : \`app-part-secours\`), puis, si la séance d'ouverture la demande, **« Apporter la part de
 * secours »** — sa phrase déverrouille sa clé ici, et seules les parts déchiffrées partent. Il ne lit ni les offres, ni leurs
 * pièces, ni le PV. La page se relit toutes les cinq secondes tant que la séance est ouverte.
 */
@Component({
  selector: 'app-procedure-depositaire',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, PartSecours, ApportParts],
  template: `
    <nav class="pd__ariane" aria-label="Fil d'Ariane">
      <a routerLink="/depositaire/mes-procedures">Mes procédures</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{{ procedure()?.reference || 'Procédure ' + idDmc }}</span>
    </nav>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="La procédure n'a pas pu être chargée." (reessayer)="charger()" />
    } @else if (!procedure()) {
      <div class="alert alert-info" role="status"><span>Cette procédure ne vous est pas (ou plus) confiée.</span></div>
    } @else if (procedure(); as p) {
      <header class="page-header">
        <div class="page-subtitle">Dépositaire de la part de secours</div>
        <h1 class="page-title">{{ p.objet || 'Procédure ' + p.idDmc }}</h1>
      </header>
      <p class="pd__etats">
        @if (ceremonie(); as c) {
          <span class="badge" [class]="'badge ' + classeCeremonie(c.etat)">Cérémonie {{ ceremonies[c.etat] }}</span>
          <span class="text-sm text-muted">{{ c.n }} parts, quorum {{ c.quorum ?? '—' }}{{ c.dateCloture ? ' · close le ' + dateHeure(c.dateCloture) : c.dateCeremoniePrevue ? ' · prévue le ' + dateHeure(c.dateCeremoniePrevue) : '' }}</span>
        }
        @if (p.etatSeance; as s) { <span class="badge badge-neutral">Séance : {{ seances[s] }}</span> }
      </p>

      @if (p.secoursDemande; as d) {
        <section class="card pd__seance" aria-labelledby="pd-seance">
          <h2 id="pd-seance" class="pd__h2">La séance demande votre part de secours</h2>
          <p class="text-sm">Demandée le {{ dateHeure(d.date) }} — motif : {{ d.motif }}.</p>
          @if (p.etatSeance === 'OUVERTE' && !apportee()) {
            <app-apport-parts [idDmc]="p.idDmc" role="SECOURS" [parDepositaire]="true" (apporte)="apres()" />
          } @else {
            <p class="text-sm">{{ apportee() ? 'Votre part de secours est apportée.' : 'La séance n’attend plus de part.' }}</p>
          }
        </section>
      }

      <app-part-secours [idDmc]="p.idDmc" vue="depositaire" [secours]="secours()" [cleARemplacer]="p.cleARemplacer" (changement)="charger(true)" />
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .pd__ariane { display: flex; gap: 0.4rem; font-size: var(--text-sm); color: var(--n-500); }
    .pd__ariane a { color: var(--p-700); }
    .pd__etats { margin: 0; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .pd__seance { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; border-color: var(--p-300); }
    .pd__h2 { margin: 0; font-size: 1rem; }
  `,
})
export class ProcedureDepositaireEcran implements OnInit, OnDestroy {
  private readonly service = inject(DepositaireService);
  private readonly ceremonies$ = inject(CeremonieService);
  private readonly document = inject(DOCUMENT);

  readonly idDmc = Number(inject(ActivatedRoute).snapshot.paramMap.get('idDmc'));
  readonly ceremonies = LIBELLES_ETAT_CEREMONIE;
  readonly seances = LIBELLES_ETAT_SEANCE;
  readonly classeCeremonie = classeCeremonie;
  readonly dateHeure = dateHeureFr;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly procedure = signal<ProcedureDepositaire | null>(null);
  readonly ceremonie = signal<Ceremonie | null>(null);
  /** La part apportée dans cette visite (la lecture de la séance lui est refusée : on retient la réponse de l'apport). */
  readonly apportee = signal(false);
  readonly secours = computed<Detenteur | null>(() => this.ceremonie()?.detenteurs.find((d) => d.role === 'SECOURS') ?? null);
  private sondage: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    this.document.title = 'Ma part de secours — Dépositaire — PRS 2.0';
    this.charger();
    this.sondage = setInterval(() => {
      if (this.procedure()?.etatSeance === 'OUVERTE' || this.procedure()?.etatSeance === 'A_VENIR') this.charger(true);
    }, 5000);
  }

  ngOnDestroy(): void {
    clearInterval(this.sondage);
  }

  charger(silencieux = false): void {
    if (!silencieux) this.chargement.set(true);
    this.erreur.set(false);
    forkJoin({ procedures: this.service.procedures(), ceremonie: this.ceremonies$.lire(this.idDmc) }).subscribe({
      next: ({ procedures, ceremonie }) => {
        this.procedure.set(procedures.find((p) => p.idDmc === this.idDmc) ?? null);
        this.ceremonie.set(ceremonie);
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        // Un ancien dépositaire (Q2) ne voit plus la procédure : 403 à la cérémonie — on le dit sans erreur.
        if (e.status === 403) this.procedure.set(null);
        else if (!silencieux) this.erreur.set(true);
      },
    });
  }

  apres(): void {
    this.apportee.set(true);
    this.charger(true);
  }
}
