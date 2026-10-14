import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, validerFichier } from '../../core/securite/fichiers-surs';
import { QuestionCandidat, QuestionsProcedure } from '../../models';
import { QuestionsFicheService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr, tailleLisible } from '../candidat/libelles-candidat';
import { EnteteProcedure } from './entete-procedure';

/** `AAAA-MM-JJ…` → `JJ/MM/AAAA`. */
function jour(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Le refus d'une réponse, nommé (contrat R7). */
function refusReponse(e: ApiError): string {
  switch (codeErreur(e)) {
    case 'TEXTE_OBLIGATOIRE': return 'Écrivez la réponse.';
    case 'FORMAT_INVALIDE': return 'Le fichier joint doit être un PDF, un JPEG ou un PNG.';
    case 'DEJA_REPONDUE': return 'Cette question a déjà sa réponse : elle est définitive.';
  }
  if (e.status === 413) return 'Le fichier dépasse la taille admise.';
  if (e.status === 403) return 'Seule la PRMP de la fiche répond aux questions.';
  return e.message || 'La réponse n’a pas pu être enregistrée.';
}

/**
 * ⚠️ R7 (V109, 13/10 ; art. 35-II) — les **questions des candidats** d'une procédure, côté PRMP : toutes, avec leur auteur. Répondre
 * **diffuse** la réponse (définitive) : elle paraît, anonymisée, sur la page publique de la procédure, et chaque candidat ayant retiré
 * le dossier la reçoit. Les questions répondues sont jointes d'office au dossier de marché (pièce `QUESTIONS_REPONSES`).
 */
@Component({
  selector: 'app-questions-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, EnteteProcedure],
  template: `
    <section class="qd">
      <header class="page-header">
        <app-entete-procedure [idDmc]="idDmc" />
        <h1 class="page-title">Questions des candidats</h1>
      </header>
      <p class="page-role">Les candidats ayant retiré le dossier posent leurs questions jusqu’à dix jours avant la date limite. Votre réponse est <strong>diffusée</strong> dès son enregistrement : sur la page publique de la procédure, sans le nom de l’auteur, et à chaque candidat ayant retiré le dossier.</p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (refuse()) {
        <div class="alert alert-info" role="status"><span>Les questions sont réservées à la PRMP et aux lecteurs de la fiche.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="Les questions n'ont pas pu être chargées." (reessayer)="charger()" />
      } @else if (bloc(); as b) {
        <div class="qd__barre">
          <p class="text-sm" role="status">
            @if (!b.clotureLe) { Date limite non fixée : les questions ne sont pas ouvertes. }
            @else if (b.closes) { Questions closes depuis le lendemain du {{ jour(b.clotureLe) }} ({{ b.joursAvantLimite }} jours avant la date limite). }
            @else { Questions recevables jusqu’au <strong>{{ jour(b.clotureLe) }}</strong> inclus. }
            {{ enAttente() }} en attente de réponse.
          </p>
          @if (b.questions.length) { <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="pdf()">Questions et réponses (PDF)</button> }
        </div>

        @for (q of b.questions; track q.id) {
          <article class="card qd__q" [attr.aria-label]="'Question n° ' + q.id">
            <p class="qd__meta text-sm">
              <strong>{{ q.auteur ?? 'Candidat' }}</strong>{{ q.auteurCompte && q.auteurCompte !== q.auteur ? ' (' + q.auteurCompte + ')' : '' }} · posée le {{ dateHeure(q.poseeLe) }}
              @if (q.etat === 'REPONDUE') { <span class="badge badge-success">Répondue et diffusée le {{ dateHeure(q.publieeLe) }}</span> } @else { <span class="badge badge-warning">En attente</span> }
            </p>
            <p class="qd__texte">{{ q.question }}</p>
            @if (q.etat === 'REPONDUE') {
              <p class="qd__texte"><strong>Réponse :</strong> {{ q.reponse }}</p>
              @if (q.reponseNom) { <button type="button" class="btn btn-ghost btn-sm qd__btn" (click)="ouvrir(q)">{{ q.reponseNom }}{{ q.reponseTaille != null ? ' (' + taille(q.reponseTaille) + ')' : '' }}</button> }
            } @else if (prmp()) {
              <label class="form-group">
                <span class="form-label">Réponse (diffusée à tous, définitive)</span>
                <textarea class="form-control" rows="3" [value]="reponses()[q.id] ?? ''" (input)="poser(q.id, $any($event.target).value)"></textarea>
              </label>
              <label class="form-group">
                <span class="form-label">Pièce jointe (facultative : PDF, JPEG, PNG)</span>
                <input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisir(q.id, $any($event.target))" />
              </label>
              <button type="button" class="btn btn-primary btn-sm qd__btn" [disabled]="!(reponses()[q.id] ?? '').trim() || occupe()" (click)="repondre(q)">Répondre et diffuser</button>
            }
          </article>
        } @empty {
          <div class="empty-state"><p class="empty-state-title">Aucune question posée.</p></div>
        }
        @if (message(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
      }
    </section>
  `,
  styles: `
    .qd { display: flex; flex-direction: column; gap: 0.75rem; }
    .qd__barre { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .qd__barre p { margin: 0; }
    .qd__q { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.45rem; }
    .qd__meta { margin: 0; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .qd__texte { margin: 0; white-space: pre-line; }
    .qd__btn { align-self: flex-start; }
  `,
})
export class QuestionsDao implements OnInit {
  private readonly service = inject(QuestionsFicheService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly jour = jour;
  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly refuse = signal(false);
  readonly occupe = signal(false);
  readonly message = signal<string | null>(null);
  readonly bloc = signal<QuestionsProcedure | null>(null);
  readonly reponses = signal<Record<number, string>>({});
  private readonly fichiers = new Map<number, File>();

  /** La PRMP répond ; l'UGPM et les autres lecteurs lisent (le serveur reste la garde : 403). */
  readonly prmp = computed(() => this.auth.role() === 'PRMP');
  readonly enAttente = computed(() => {
    const n = (this.bloc()?.questions ?? []).filter((q) => q.etat === 'EN_ATTENTE').length;
    return n ? `${n} question${n > 1 ? 's' : ''}` : 'Aucune question';
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.refuse.set(false);
    this.service.lire(this.idDmc).subscribe({
      next: (b) => {
        this.bloc.set(b);
        this.chargement.set(false);
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        if (e.status === 403) this.refuse.set(true);
        else this.erreur.set(true);
      },
    });
  }

  poser(id: number, texte: string): void {
    this.reponses.update((r) => ({ ...r, [id]: texte }));
  }

  choisir(id: number, champ: HTMLInputElement): void {
    const f = champ.files?.[0] ?? null;
    const erreur = f ? validerFichier(f) : null;
    this.message.set(erreur);
    if (erreur || !f) {
      champ.value = '';
      this.fichiers.delete(id);
    } else this.fichiers.set(id, f);
  }

  repondre(q: QuestionCandidat): void {
    const texte = (this.reponses()[q.id] ?? '').trim();
    if (!texte || this.occupe()) return;
    this.occupe.set(true);
    this.message.set(null);
    this.service.repondre(this.idDmc, q.id, texte, this.fichiers.get(q.id) ?? null).subscribe({
      next: (r) => {
        this.occupe.set(false);
        this.fichiers.delete(q.id);
        this.bloc.update((b) => (b ? { ...b, questions: b.questions.map((x) => (x.id === r.id ? r : x)) } : b));
        this.toast.success('La réponse est diffusée : sur la page publique de la procédure et à chaque candidat ayant retiré le dossier.');
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.message.set(refusReponse(e));
        if (codeErreur(e) === 'DEJA_REPONDUE') this.charger();
      },
    });
  }

  pdf(): void {
    this.occupe.set(true);
    this.service.pdf(this.idDmc).subscribe({
      next: (b) => {
        this.occupe.set(false);
        ouvrirBlobSur(b);
      },
      error: () => {
        this.occupe.set(false);
        this.message.set('Le PDF des questions n’a pas pu être produit.');
      },
    });
  }

  ouvrir(q: QuestionCandidat): void {
    this.service.fichier(this.idDmc, q.id).subscribe({ next: (b) => ouvrirBlobSur(b), error: () => this.message.set('Le fichier n’a pas pu être ouvert.') });
  }
}
