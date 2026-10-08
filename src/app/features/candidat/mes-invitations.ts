import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { EtatProcedureEnLigne, InvitationCandidat } from '../../models';
import { InvitationsCandidatService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr } from './libelles-candidat';

const LIBELLES_ETAT: Readonly<Record<EtatProcedureEnLigne, string>> = {
  A_VENIR: 'Dépôts pas encore ouverts',
  OUVERTE: 'Dépôts ouverts',
  CLOSE: 'Dépôts clos',
};

/**
 * ⚠️ **Mes invitations** (lot 3 PI, tranche PI-a — V84) : les consultations restreintes des prestations intellectuelles où
 * le candidat est invité. Une telle procédure n'a pas d'avis et n'apparaît pas dans les procédures ouvertes : il la trouve
 * ici, lit sa lettre d'invitation (PDF, ouvert dans un nouvel onglet) et va déposer sa proposition depuis sa page.
 */
@Component({
  selector: 'app-mes-invitations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    <header class="page-header">
      <div class="page-subtitle">Espace candidat</div>
      <h1 class="page-title">Mes invitations</h1>
    </header>
    <p class="page-role">Les consultations restreintes auxquelles vous êtes invité. Elles ne sont pas publiées : seule votre lettre d’invitation vous y donne accès.</p>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Vos invitations n'ont pas pu être chargées." (reessayer)="charger()" />
    } @else if (!invitations().length) {
      <div class="empty-state">
        <p class="empty-state-title">Aucune invitation.</p>
        <p class="empty-state-text">
          Si une lettre d’invitation vous a été adressée par courriel, créez votre compte avec cette même adresse : l’invitation s’y rattache.
        </p>
      </div>
    } @else {
      @if (message(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }
      <ul class="mi" aria-label="Mes invitations">
        @for (i of invitations(); track i.idDmc) {
          <li class="card mi__inv">
            <div class="mi__haut">
              <strong>{{ i.objet || ('Procédure ' + i.idDmc) }}</strong>
              @if (i.etatProcedure; as e) {
                <span class="badge" [class.badge-success]="e === 'OUVERTE'" [class.badge-neutral]="e !== 'OUVERTE'">{{ etats[e] }}</span>
              } @else {
                <span class="badge badge-neutral">Procédure en préparation</span>
              }
            </div>
            <p class="text-sm text-muted mi__meta">
              @if (i.reference) { <span class="cnm-mono">{{ i.reference }}</span> · }
              {{ i.autoriteContractante || 'Autorité contractante non précisée' }}
            </p>
            <p class="text-sm mi__meta">
              {{ i.source === 'AMI' ? 'Retenu sur la liste restreinte de l’appel à manifestation d’intérêt' : 'Inscrit sur la liste restreinte' }}@if (i.rang) { (rang {{ i.rang }}) }@if (i.inviteLe) { · invité le {{ dateHeure(i.inviteLe) }} }
              @if (i.dateLimite) { · <strong>date limite : {{ dateHeure(i.dateLimite) }}</strong> }
            </p>
            <div class="mi__actions">
              @if (i.lettreDisponible) {
                <button type="button" class="btn btn-sm btn-outline" [disabled]="enCours() === i.idDmc" (click)="lettre(i)">
                  {{ enCours() === i.idDmc ? 'Ouverture…' : 'Lettre d’invitation (PDF)' }}
                </button>
              }
              @if (i.etatProcedure) {
                <a class="btn btn-sm btn-primary" [routerLink]="['/candidat', 'procedures', i.idDmc]">Voir la procédure</a>
              }
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .mi { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .mi__inv { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .mi__haut { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .mi__meta { margin: 0; }
    .mi__actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  `,
})
export class MesInvitations implements OnInit {
  private readonly service = inject(InvitationsCandidatService);

  readonly etats = LIBELLES_ETAT;
  readonly dateHeure = dateHeureFr;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly invitations = signal<InvitationCandidat[]>([]);
  readonly enCours = signal<number | null>(null);
  readonly message = signal<string | null>(null);

  constructor() {
    inject(DOCUMENT).title = 'Mes invitations — Espace candidat — PRS 2.0';
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.liste().subscribe({
      next: (l) => {
        this.invitations.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  lettre(i: InvitationCandidat): void {
    this.enCours.set(i.idDmc);
    this.message.set(null);
    this.service.lettre(i.idDmc).subscribe({
      next: (b) => {
        this.enCours.set(null);
        ouvrirBlobSur(b);
      },
      error: () => {
        this.enCours.set(null);
        this.message.set('La lettre d’invitation n’a pas pu être ouverte. Réessayez plus tard.');
      },
    });
  }
}
