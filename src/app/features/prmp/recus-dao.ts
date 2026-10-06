import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { RecuDao } from '../../models';
import { FicheMarcheService } from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { EnteteProcedure } from './entete-procedure';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr } from '../candidat/libelles-candidat';

const LIBELLES_ETAT: Readonly<Record<RecuDao['etat'], string>> = {
  EN_ATTENTE: 'En attente',
  VALIDE: 'Validé',
  REFUSE: 'Refusé',
};

/**
 * Les **reçus des frais de dossier** d'une procédure à retrait payant (V72, voie B du 06/10) : la PRMP **ou l'UGPM** de la fiche
 * valide ou refuse (motif obligatoire) chaque reçu déposé par une entreprise ; tant que le reçu n'est pas validé, l'entreprise ne
 * retire pas le dossier. Une décision ne se reprend pas (409 `RECU_DEJA_DECIDE`) : une erreur se corrige par un nouveau dépôt du
 * candidat. La vérification du versement se fait hors de la plateforme (relevé de l'ARMP, H3).
 */
@Component({
  selector: 'app-recus-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, ModaleDirective, EnteteProcedure],
  template: `
    <section class="rc">
      <header class="page-header">
        <app-entete-procedure [idDmc]="idDmc" />
        <h1 class="page-title">Reçus des frais de dossier</h1>
      </header>
      <p class="page-role">Chaque entreprise dépose le reçu de son versement sur le compte de l’ARMP ; elle retire le dossier dès que vous l’avez validé. Comparez le reçu au relevé de l’ARMP avant de décider : une décision ne se reprend pas.</p>

      @if (message(); as m) { <div class="alert" [class.alert-success]="m.ok" [class.alert-danger]="!m.ok" role="status"><span>{{ m.texte }}</span></div> }

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des reçus…</p>
      } @else if (refuse()) {
        <div class="alert alert-info" role="status"><span>Les reçus sont réservés à la PRMP et à l’UGPM de la fiche.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="Les reçus n'ont pas pu être chargés." (reessayer)="charger()" />
      } @else if (!recus().length) {
        <div class="empty-state">
          <p class="empty-state-title">Aucun reçu déposé pour l’instant.</p>
          <p class="empty-state-text">Les reçus apparaissent ici dès qu’une entreprise en dépose un ; vous en êtes notifié.</p>
        </div>
      } @else {
        <p class="text-sm"><strong>{{ enAttente() }}</strong> {{ enAttente() > 1 ? 'reçus attendent' : 'reçu attend' }} votre décision · {{ recus().length }} au total.</p>
        <div class="cnm-table-wrap">
          <table class="cnm-table rc__table">
            <caption class="cnm-sr-only">Reçus des frais de dossier, ceux en attente d'abord</caption>
            <thead>
              <tr><th scope="col">Entreprise</th><th scope="col">Versement</th><th scope="col" class="cnm-num">Montant</th><th scope="col">Lots</th><th scope="col">Déposé</th><th scope="col">État</th><th scope="col"><span class="cnm-sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              @for (r of recus(); track r.idRecu) {
                <tr [class.rc__attente]="r.etat === 'EN_ATTENTE'">
                  <td>
                    <strong>{{ r.entreprise?.raisonSociale || '—' }}</strong>
                    <div class="text-xs text-muted">NIF <span class="cnm-mono">{{ r.entreprise?.nif || '—' }}</span>{{ r.compte ? ' · ' + r.compte : '' }}</div>
                  </td>
                  <td>
                    <span class="cnm-mono">{{ r.referencePaiement }}</span>
                    <div class="text-xs text-muted">du {{ dateCourte(r.datePaiement) }}{{ r.banque ? ' · ' + r.banque : '' }}</div>
                  </td>
                  <td class="cnm-num">
                    {{ nombre(r.montant) }} Ar
                    @if (r.montantInsuffisant) { <div class="text-xs rc__bas">inférieur aux {{ nombre(r.fraisAttendus) }} Ar attendus</div> }
                  </td>
                  <td>{{ r.lots?.length ? r.lots!.join(', ') : 'tout le dossier' }}</td>
                  <td class="nowrap">{{ dateHeure(r.dateDepot) }}</td>
                  <td>
                    <span class="badge" [class.badge-warning]="r.etat === 'EN_ATTENTE'" [class.badge-success]="r.etat === 'VALIDE'" [class.badge-danger]="r.etat === 'REFUSE'">{{ etats[r.etat] }}</span>
                    @if (r.etat !== 'EN_ATTENTE' && r.dateDecision) { <div class="text-xs text-muted">{{ r.decidePar }} · {{ dateHeure(r.dateDecision) }}</div> }
                    @if (r.motifRefus) { <div class="text-xs rc__bas">{{ r.motifRefus }}</div> }
                  </td>
                  <td class="rc__actions">
                    <button type="button" class="btn btn-sm btn-outline" [disabled]="occupe() === r.idRecu" (click)="voir(r)">Voir le reçu</button>
                    @if (r.etat === 'EN_ATTENTE') {
                      <button type="button" class="btn btn-sm btn-primary" [disabled]="occupe() === r.idRecu" (click)="valider(r)">Valider</button>
                      <button type="button" class="btn btn-sm btn-danger" [disabled]="occupe() === r.idRecu" (click)="ouvrirRefus(r)">Refuser…</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (aRefuser(); as r) {
      <div class="modal-backdrop">
        <div class="modal confirm-modal" role="dialog" aria-modal="true" aria-label="Refuser le reçu" appModale (appModaleFermer)="aRefuser.set(null)">
          <div class="modal-header-plain">
            <span class="modal-title">Refuser le reçu {{ r.referencePaiement }}</span>
            <button type="button" class="btn-close-plain" aria-label="Fermer" [disabled]="occupe() !== null" (click)="aRefuser.set(null)">✕</button>
          </div>
          <div class="modal-body">
            <p class="text-sm">{{ r.entreprise?.raisonSociale }} recevra ce motif par courriel et pourra déposer un nouveau reçu.</p>
            <label class="form-group"><span class="form-label">Motif du refus</span>
              <textarea class="form-control" rows="3" [value]="motif()" (input)="motif.set($any($event.target).value)"></textarea></label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" [disabled]="occupe() !== null" (click)="aRefuser.set(null)">Annuler</button>
            <button type="button" class="btn btn-danger" [disabled]="occupe() !== null || !motif().trim()" (click)="refuser(r)">{{ occupe() !== null ? 'Refus…' : 'Refuser le reçu' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .rc { display: flex; flex-direction: column; gap: 0.75rem; }
    /* Le td global du design system ne replie pas : un motif de refus pousserait les actions hors de l'écran. */
    .rc__table td { white-space: normal; vertical-align: top; }
    .rc__table td.nowrap, .rc__table td > .cnm-mono { white-space: nowrap; }
    .rc__attente td { background: var(--warning-bg, #fff8e6); }
    .rc__bas { color: var(--danger-text); }
    .rc__actions { display: flex; gap: 0.35rem; flex-wrap: wrap; justify-content: flex-end; }
  `,
})
export class RecusDao implements OnInit {
  private readonly service = inject(FicheMarcheService);
  private readonly route = inject(ActivatedRoute);

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly etats = LIBELLES_ETAT;
  readonly dateHeure = dateHeureFr;
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly refuse = signal(false);
  readonly recus = signal<RecuDao[]>([]);
  readonly occupe = signal<number | null>(null);
  readonly aRefuser = signal<RecuDao | null>(null);
  readonly motif = signal('');
  readonly message = signal<{ ok: boolean; texte: string } | null>(null);
  readonly enAttente = computed(() => this.recus().filter((r) => r.etat === 'EN_ATTENTE').length);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.refuse.set(false);
    this.service.recus(this.idDmc).subscribe({
      next: (r) => {
        this.recus.set(r);
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 403) this.refuse.set(true);
        else this.erreur.set(true);
      },
    });
  }

  voir(r: RecuDao): void {
    this.occupe.set(r.idRecu);
    this.service.recuFichier(this.idDmc, r.idRecu).subscribe({
      next: (b) => {
        this.occupe.set(null);
        ouvrirBlobSur(b);
      },
      error: (e: { status?: number }) => {
        this.occupe.set(null);
        this.message.set({ ok: false, texte: e.status === 404 ? 'Ce fichier n’est plus conservé.' : 'Le reçu n’a pas pu être ouvert.' });
      },
    });
  }

  valider(r: RecuDao): void {
    this.decider(r, this.service.validerRecu(this.idDmc, r.idRecu), `Reçu ${r.referencePaiement} validé : ${r.entreprise?.raisonSociale ?? 'l’entreprise'} peut retirer le dossier.`);
  }

  ouvrirRefus(r: RecuDao): void {
    this.motif.set('');
    this.aRefuser.set(r);
  }

  refuser(r: RecuDao): void {
    this.decider(r, this.service.refuserRecu(this.idDmc, r.idRecu, this.motif().trim()), `Reçu ${r.referencePaiement} refusé : l’entreprise en est avertie par courriel.`);
  }

  private decider(r: RecuDao, appel: ReturnType<FicheMarcheService['validerRecu']>, succes: string): void {
    this.occupe.set(r.idRecu);
    this.message.set(null);
    appel.subscribe({
      next: (maj) => {
        this.occupe.set(null);
        this.aRefuser.set(null);
        this.recus.update((l) => l.map((x) => (x.idRecu === maj.idRecu ? { ...x, ...maj } : x)));
        this.message.set({ ok: true, texte: succes });
      },
      error: (e) => {
        this.occupe.set(null);
        this.aRefuser.set(null);
        const code = codeErreur(e as ApiError);
        this.message.set({ ok: false, texte: code === 'RECU_DEJA_DECIDE' ? 'Ce reçu a déjà été décidé (par vous ou par l’UGPM) : la liste est rechargée.' : (e as ApiError)?.message || 'La décision n’a pas pu être enregistrée.' });
        if (code === 'RECU_DEJA_DECIDE') this.charger();
      },
    });
  }

  nombre(v: number | null | undefined): string {
    return v == null ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
  dateCourte(iso: string): string {
    return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('fr-FR');
  }
}
