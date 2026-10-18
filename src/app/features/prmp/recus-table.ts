import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { RecuDao } from '../../models';
import { FicheMarcheService } from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { dateHeureFr } from '../candidat/libelles-candidat';

export const LIBELLES_ETAT_RECU: Readonly<Record<RecuDao['etat'], string>> = {
  EN_ATTENTE: 'En attente',
  VALIDE: 'Validé',
  REFUSE: 'Refusé',
};

/**
 * ⚠️ 18/10 (pilote) — le tableau des reçus des frais de dossier d'UNE fiche, avec ses décisions (voir, valider, refuser avec
 * motif), sorti de l'écran de la fiche pour servir aussi l'écran transverse « Reçus des frais » (`/prmp/recus`). Le parent possède
 * la liste : il reçoit chaque décision (`decide`) et la demande de rechargement (`recharger`, après un 409 `RECU_DEJA_DECIDE`).
 */
@Component({
  selector: 'app-recus-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    @if (message(); as m) { <div class="alert" [class.alert-success]="m.ok" [class.alert-danger]="!m.ok" role="status"><span>{{ m.texte }}</span></div> }
    <div class="cnm-table-wrap">
      <table class="cnm-table rc__table">
        <caption class="cnm-sr-only">{{ legende() }}</caption>
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
              <!-- Une cellule en flex perd la hauteur de sa rangée (liseré blanc sous les boutons) : le flex est sur un conteneur. -->
              <td class="rc__actions">
                <div class="rc__boutons">
                  <button type="button" class="btn btn-sm btn-outline" [disabled]="occupe() === r.idRecu" (click)="voir(r)">Voir le reçu</button>
                  @if (r.etat === 'EN_ATTENTE') {
                    <button type="button" class="btn btn-sm btn-primary" [disabled]="occupe() === r.idRecu" (click)="valider(r)">Valider</button>
                    <button type="button" class="btn btn-sm btn-danger" [disabled]="occupe() === r.idRecu" (click)="ouvrirRefus(r)">Refuser…</button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

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
    :host { display: block; }
    /* Le td global du design system ne replie pas : un motif de refus pousserait les actions hors de l'écran. */
    .rc__table td { white-space: normal; vertical-align: top; }
    .rc__table td.nowrap, .rc__table td > .cnm-mono { white-space: nowrap; }
    .rc__attente td { background: var(--warning-bg, #fff8e6); }
    .rc__bas { color: var(--danger-text); }
    .rc__actions { text-align: right; }
    .rc__boutons { display: flex; gap: 0.35rem; flex-wrap: wrap; justify-content: flex-end; }
  `,
})
export class RecusTable {
  private readonly service = inject(FicheMarcheService);

  readonly idDmc = input.required<number>();
  readonly recus = input.required<RecuDao[]>();
  readonly legende = input('Reçus des frais de dossier, ceux en attente d’abord');
  /** Un reçu décidé (validé ou refusé), tel que le serveur le renvoie : le parent remplace le sien. */
  readonly decide = output<RecuDao>();
  /** Le reçu avait déjà été décidé (par l'UGPM, ou la PRMP) : le parent relit sa liste. */
  readonly recharger = output<void>();

  readonly etats = LIBELLES_ETAT_RECU;
  readonly dateHeure = dateHeureFr;
  readonly occupe = signal<number | null>(null);
  readonly aRefuser = signal<RecuDao | null>(null);
  readonly motif = signal('');
  readonly message = signal<{ ok: boolean; texte: string } | null>(null);

  voir(r: RecuDao): void {
    this.occupe.set(r.idRecu);
    this.service.recuFichier(this.idDmc(), r.idRecu).subscribe({
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
    this.decider(r, this.service.validerRecu(this.idDmc(), r.idRecu), `Reçu ${r.referencePaiement} validé : ${r.entreprise?.raisonSociale ?? 'l’entreprise'} peut retirer le dossier.`);
  }

  ouvrirRefus(r: RecuDao): void {
    this.motif.set('');
    this.aRefuser.set(r);
  }

  refuser(r: RecuDao): void {
    this.decider(r, this.service.refuserRecu(this.idDmc(), r.idRecu, this.motif().trim()), `Reçu ${r.referencePaiement} refusé : l’entreprise en est avertie par courriel.`);
  }

  private decider(r: RecuDao, appel: ReturnType<FicheMarcheService['validerRecu']>, succes: string): void {
    this.occupe.set(r.idRecu);
    this.message.set(null);
    appel.subscribe({
      next: (maj) => {
        this.occupe.set(null);
        this.aRefuser.set(null);
        this.decide.emit(maj);
        this.message.set({ ok: true, texte: succes });
      },
      error: (e) => {
        this.occupe.set(null);
        this.aRefuser.set(null);
        const code = codeErreur(e as ApiError);
        this.message.set({ ok: false, texte: code === 'RECU_DEJA_DECIDE' ? 'Ce reçu a déjà été décidé (par vous ou par l’UGPM) : la liste est rechargée.' : (e as ApiError)?.message || 'La décision n’a pas pu être enregistrée.' });
        if (code === 'RECU_DEJA_DECIDE') this.recharger.emit();
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
