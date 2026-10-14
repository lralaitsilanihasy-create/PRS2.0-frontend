import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { QuestionCandidat, QuestionsProcedure } from '../../models';
import { QuestionsProcedureService } from '../../services';
import { dateHeureFr, tailleLisible } from './libelles-candidat';

const LONGUEUR_MAX = 4000;

/** `AAAA-MM-JJ…` → `JJ/MM/AAAA`. */
function jour(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Le refus d'une question, nommé (contrat R7). */
export function refusQuestion(e: ApiError): string {
  switch (codeErreur(e)) {
    case 'DOSSIER_NON_RETIRE':
      return 'Seul un candidat ayant retiré le dossier d’appel d’offres pose une question : retirez d’abord un document du dossier (section « Dossier d’appel d’offres »).';
    case 'QUESTIONS_CLOSES': {
      const d = corpsErreur<{ details?: { clotureLe?: string; joursAvantLimite?: number } }>(e)?.details ?? {};
      return `Les questions sont closes : elles étaient recevables jusqu’au ${jour(d.clotureLe) || '?'}, ${d.joursAvantLimite ?? 10} jours avant la date limite (art. 35-II).`;
    }
    case 'DATE_LIMITE_INCONNUE':
      return 'La date limite de remise n’est pas encore fixée : les questions ne sont pas ouvertes.';
    case 'QUESTION_OBLIGATOIRE':
      return 'Écrivez votre question.';
    case 'QUESTION_TROP_LONGUE':
      return `La question dépasse ${LONGUEUR_MAX.toLocaleString('fr-FR')} caractères.`;
  }
  return e.message || 'La question n’a pas pu être envoyée.';
}

/**
 * ⚠️ R7 (V109, 13/10 ; art. 35-II) — les **questions des candidats** sur la page de la procédure en ligne. Tout visiteur lit les
 * questions répondues, anonymisées ; le candidat connecté retrouve les siennes et en pose une, jusqu'à dix jours avant la date limite,
 * s'il a retiré le dossier (le serveur le vérifie : `DOSSIER_NON_RETIRE`).
 */
@Component({
  selector: 'app-questions-procedure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (bloc(); as b) {
      <section class="card qp" aria-labelledby="qp-titre">
        <h2 id="qp-titre" class="qp__h2">Questions des candidats</h2>
        @if (b.clotureLe) {
          <p class="text-sm" role="status">
            @if (b.closes) { Les questions sont <strong>closes</strong> depuis le lendemain du {{ jour(b.clotureLe) }} ({{ b.joursAvantLimite }} jours avant la date limite). }
            @else { Questions recevables jusqu’au <strong>{{ jour(b.clotureLe) }}</strong> inclus, {{ b.joursAvantLimite }} jours avant la date limite. Chaque réponse est diffusée ici, sans le nom de l’auteur, et adressée à tous les candidats ayant retiré le dossier. }
          </p>
        } @else {
          <p class="text-sm text-muted">La date limite n’est pas encore fixée : les questions ne sont pas ouvertes.</p>
        }

        @if (connecte()) {
          @if (miennes().length) {
            <h3 class="qp__h3">Vos questions</h3>
            <ul class="qp__liste">
              @for (q of miennes(); track q.id) {
                <li class="qp__q">
                  <p class="qp__texte">{{ q.question }}</p>
                  <p class="text-xs text-muted">Posée le {{ dateHeure(q.poseeLe) }} · @if (q.etat === 'REPONDUE') { <span class="badge badge-success">répondue le {{ dateHeure(q.repondueLe) }}</span> } @else { <span class="badge badge-warning">en attente de réponse</span> }</p>
                </li>
              }
            </ul>
          }
          @if (b.clotureLe && !b.closes) {
            <label class="form-group">
              <span class="form-label">Votre question</span>
              <textarea class="form-control" rows="3" [attr.maxlength]="max" [value]="texte()" (input)="texte.set($any($event.target).value)"></textarea>
              <span class="form-hint">{{ texte().length }} / {{ max }} caractères. Réservé aux candidats ayant retiré le dossier.</span>
            </label>
            <button type="button" class="btn btn-primary btn-sm qp__btn" [disabled]="!texte().trim() || envoi()" (click)="poser()">{{ envoi() ? 'Envoi…' : 'Poser la question' }}</button>
          }
          @if (refus(); as r) { <p class="form-error" role="alert">{{ r }}</p> }
        } @else if (b.clotureLe && !b.closes) {
          <p class="text-sm">Pour poser une question, <a routerLink="/login" [queryParams]="{ returnUrl: lienRetour() }">connectez-vous</a> avec le compte qui a retiré le dossier.</p>
        }

        <h3 class="qp__h3">Questions et réponses diffusées</h3>
        @for (q of b.questions; track q.id) {
          <article class="qp__q">
            <p class="qp__texte"><strong>Question :</strong> {{ q.question }}</p>
            <p class="qp__texte"><strong>Réponse</strong> <span class="text-xs text-muted">(diffusée le {{ dateHeure(q.publieeLe) }})</span> : {{ q.reponse }}</p>
            @if (q.reponseNom) {
              <button type="button" class="btn btn-ghost btn-sm qp__btn" (click)="ouvrir(q)">{{ q.reponseNom }}{{ q.reponseTaille != null ? ' (' + taille(q.reponseTaille) + ')' : '' }}</button>
            }
          </article>
        } @empty { <p class="text-sm text-muted">Aucune réponse diffusée pour l’instant.</p> }
      </section>
    }
  `,
  styles: `
    .qp { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; grid-column: 1 / -1; }
    .qp__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .qp__h3 { margin: 0.4rem 0 0; font-size: 0.9rem; }
    .qp__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .qp__q { padding: 0.5rem 0.75rem; border: 1px solid var(--n-200); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 0.25rem; }
    .qp__texte { margin: 0; font-size: var(--text-sm); white-space: pre-line; }
    .qp__btn { align-self: flex-start; }
  `,
})
export class QuestionsProcedureVue implements OnInit {
  private readonly service = inject(QuestionsProcedureService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  /** Un candidat connecté : il voit ses questions et en pose. */
  readonly connecte = input(false);
  readonly lienRetour = input('');

  readonly max = LONGUEUR_MAX;
  readonly jour = jour;
  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;

  /** Nul : procédure hors ligne (404) ou lecture impossible — la section ne s'affiche pas. */
  readonly bloc = signal<QuestionsProcedure | null>(null);
  readonly miennes = signal<QuestionCandidat[]>([]);
  readonly texte = signal('');
  readonly envoi = signal(false);
  readonly refus = signal<string | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.service.publiques(this.idDmc()).subscribe({ next: (b) => this.bloc.set(b), error: () => this.bloc.set(null) });
    if (this.connecte()) this.service.miennes(this.idDmc()).subscribe({ next: (l) => this.miennes.set(l), error: () => this.miennes.set([]) });
  }

  poser(): void {
    const q = this.texte().trim();
    if (!q || this.envoi()) return;
    this.envoi.set(true);
    this.refus.set(null);
    this.service.poser(this.idDmc(), q).subscribe({
      next: (posee) => {
        this.envoi.set(false);
        this.texte.set('');
        this.miennes.update((l) => [...l, posee]);
        this.toast.success('Votre question est transmise à la personne responsable des marchés ; sa réponse sera diffusée à tous les candidats.');
      },
      error: (e: ApiError) => {
        this.envoi.set(false);
        this.refus.set(refusQuestion(e));
        if (codeErreur(e) === 'QUESTIONS_CLOSES') this.charger();
      },
    });
  }

  ouvrir(q: QuestionCandidat): void {
    this.service.fichier(this.idDmc(), q.id).subscribe({ next: (b) => ouvrirBlobSur(b), error: () => this.toast.error('Le fichier n’a pas pu être ouvert.') });
  }
}
