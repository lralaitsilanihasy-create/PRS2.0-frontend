import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { validerFichier } from '../../core/securite/fichiers-surs';
import { DemandeEvaluation } from '../../models';
import { CandidatDemandesService } from '../../services';
import { dateHeureFr } from './libelles-candidat';

/**
 * ⚠️ Évaluation des offres, lot 1 (07/10) — les **demandes** que la PRMP adresse au candidat sur une de ses offres pendant
 * l'évaluation : précision (art. 35-VI) ou justification d'un prix jugé anormal (art. 48). Le candidat répond une fois, dans le
 * délai, par un texte et, s'il le veut, une pièce (PDF, JPEG ou PNG). Rien ne s'affiche tant qu'aucune demande n'existe.
 * Rappel du guide (§2.4) : une précision ne change ni le prix ni la substance de l'offre.
 */
@Component({
  selector: 'app-demandes-offre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demandes().length) {
      <section class="do" aria-label="Demandes de la commission">
        <h3 class="do__h3">Demandes reçues pendant l'évaluation</h3>
        @for (d of demandes(); track d.type + d.idDemande) {
          <div class="do__demande" [class.do__demande--attente]="d.etat === 'EN_ATTENTE'">
            <p class="text-sm"><strong>{{ d.type === 'JUSTIFICATION' ? 'Justification de votre prix demandée' : 'Précision demandée' }}</strong> le {{ dateHeure(d.demandeeLe) }}@if (d.echeance) { — réponse attendue avant le <strong>{{ dateHeure(d.echeance) }}</strong> }</p>
            <p class="do__q">{{ d.question }}</p>
            @if (d.etat === 'REPONDUE') {
              <p class="text-sm">Votre réponse ({{ dateHeure(d.reponduLe) }}) : {{ d.reponse }}{{ d.fichier ? ' · pièce : ' + d.fichier : '' }}</p>
            } @else if (d.etat === 'EXPIREE') {
              <p class="text-sm text-muted">Le délai de réponse est passé.</p>
            } @else {
              <label class="form-group"><span class="form-label">Votre réponse</span>
                <textarea class="form-control" rows="3" [value]="textes()[cle(d)] ?? ''" (input)="saisir(d, $any($event.target).value)"></textarea>
              </label>
              <label class="form-group"><span class="form-label">Pièce jointe (facultative : PDF, JPEG ou PNG)</span>
                <input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisir(d, $any($event.target))" />
              </label>
              @if (erreurs()[cle(d)]; as e) { <p class="form-error" role="alert">{{ e }}</p> }
              <p class="text-sm text-muted do__regle">Une précision ne change ni le prix ni le contenu de votre offre : elle l'explique. Une seule réponse est possible.</p>
              <button type="button" class="btn btn-primary btn-sm do__btn" [disabled]="!(textes()[cle(d)] ?? '').trim() || travail() === cle(d)" (click)="repondre(d)">Envoyer ma réponse</button>
            }
          </div>
        }
      </section>
    }
  `,
  styles: `
    .do { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--n-200); padding-top: 0.5rem; }
    .do__h3 { margin: 0; font-size: 0.9rem; }
    .do__demande { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.5rem 0.7rem; border-left: 3px solid var(--n-300); background: var(--n-100); }
    .do__demande--attente { border-left-color: var(--warning-text); }
    .do__demande p { margin: 0; }
    .do__q { font-size: var(--text-sm); white-space: pre-line; }
    .do__btn { align-self: flex-start; }
  `,
})
export class DemandesOffre implements OnInit {
  readonly idOffre = input.required<string>();

  private readonly service = inject(CandidatDemandesService);
  private readonly toast = inject(ToastService);
  readonly dateHeure = dateHeureFr;

  readonly demandes = signal<DemandeEvaluation[]>([]);
  readonly textes = signal<Record<string, string>>({});
  readonly fichiers = signal<Record<string, File | null>>({});
  readonly erreurs = signal<Record<string, string | null>>({});
  readonly travail = signal<string | null>(null);
  readonly enAttente = computed(() => this.demandes().filter((d) => d.etat === 'EN_ATTENTE').length);

  ngOnInit(): void {
    // Sans évaluation, ou sans demande : [] ou 404 — rien à montrer, rien à signaler.
    forkJoin([
      this.service.precisions(this.idOffre()).pipe(catchError(() => of([] as DemandeEvaluation[]))),
      this.service.justifications(this.idOffre()).pipe(catchError(() => of([] as DemandeEvaluation[]))),
    ]).subscribe(([p, j]) => this.demandes.set([...p, ...j].sort((a, b) => a.demandeeLe.localeCompare(b.demandeeLe))));
  }

  cle(d: DemandeEvaluation): string {
    return `${d.type}-${d.idDemande}`;
  }

  saisir(d: DemandeEvaluation, texte: string): void {
    this.textes.update((t) => ({ ...t, [this.cle(d)]: texte }));
  }

  choisir(d: DemandeEvaluation, champ: HTMLInputElement): void {
    const f = champ.files?.[0] ?? null;
    const erreur = f ? validerFichier(f) : null;
    if (erreur) champ.value = '';
    this.fichiers.update((x) => ({ ...x, [this.cle(d)]: erreur ? null : f }));
    this.erreurs.update((x) => ({ ...x, [this.cle(d)]: erreur }));
  }

  repondre(d: DemandeEvaluation): void {
    const k = this.cle(d);
    this.travail.set(k);
    this.erreurs.update((x) => ({ ...x, [k]: null }));
    this.service.repondre(this.idOffre(), d, (this.textes()[k] ?? '').trim(), this.fichiers()[k] ?? null).subscribe({
      next: (rep) => {
        this.travail.set(null);
        this.demandes.update((l) => l.map((x) => (this.cle(x) === k ? rep : x)));
        this.toast.success('Votre réponse est transmise à la commission.');
      },
      error: (e: ApiError) => {
        this.travail.set(null);
        const message =
          codeErreur(e) === 'DELAI_DEPASSE' ? 'Le délai de réponse est passé.'
          : codeErreur(e) === 'DEJA_REPONDU' ? 'Vous avez déjà répondu à cette demande.'
          : codeErreur(e) === 'FORMAT_INVALIDE' ? 'La pièce doit être un PDF, une image JPEG ou PNG.'
          : codeErreur(e) === 'TEXTE_OBLIGATOIRE' ? 'Votre réponse est obligatoire.'
          : e.status === 413 ? 'La pièce dépasse la taille admise.'
          : e.message || 'La réponse n’a pas pu être envoyée.';
        this.erreurs.update((x) => ({ ...x, [k]: message }));
      },
    });
  }
}
