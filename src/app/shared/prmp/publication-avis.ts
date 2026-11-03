import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur, erreursParChamp } from '../../core/errors/api-error';
import { aujourdhuiServeur } from '../../core/horloge/heure-serveur';
import { ouvrirBlobSur, TYPES_PDF, validerFichier } from '../../core/securite/fichiers-surs';
import { PublicationAvisDeposee } from '../../models';
import { FicheMarcheService } from '../../services/fiche-marche.services';
import { ModaleDirective } from '../a11y/modale.directive';
import { horodatage, jjmmaaaa } from './avis-specifique-modele';

type Champ = 'fichier' | 'journal' | 'numero' | 'dateParution';

/**
 * ⚠️ 30/10 (V154, « pieces-ddm-donnees », §B2 ; décision du pilote sur Q1) — la **preuve de publication** se dépose une fois, sur la
 * procédure, après l'impression : le dossier de marché la reprend d'office (pièce `PUBLICATION_AVIS`, fournie).
 * ⚠️ 02/11 (V158, « appel-offres-restreint », §B5 ; manuel, § III.6) — pour des **lettres d'invitation** (prestations intellectuelles,
 * appel d'offres restreint), c'est la copie des lettres avec accusé de réception, sans journal : elle fournit `LETTRES_ACCUSE`.
 *
 * Posé sous les avis (ou lettres) imprimés. La PRMP et son UGPM déposent ou remplacent ; les autres lecteurs de la fiche la consultent.
 * Muet quand rien n'est déposé et que le dépôt n'est pas proposé.
 */
@Component({
  selector: 'app-publication-avis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    @if (visible()) {
      <section class="pav" [attr.aria-label]="titre()">
        @if (publication(); as p) {
          <p class="pav__txt">
            <strong>{{ titre() }}</strong> :
            @if (p.nature === 'LETTRES_INVITATION') { envoyées le {{ jj(p.dateParution) }}@if (p.journal) { · {{ p.journal }}@if (p.numero) { n° {{ p.numero }}}} }
            @else { {{ p.journal }}@if (p.numero) { n° {{ p.numero }}} du {{ jj(p.dateParution) }} }
            @if (p.deposeLe) { <span class="pav__meta">· déposée le {{ quand(p.deposeLe) }}@if (p.deposePar) { par {{ p.deposePar }}}</span> }
          </p>
          <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="ouvrirScan()">{{ lettres() ? 'Ouvrir les lettres (PDF)' : 'Ouvrir le journal (PDF)' }}</button>
        } @else if (depot()) {
          <p class="pav__txt">
            <strong>{{ titre() }}</strong> : pas encore déposée. Déposez-la une fois, ici : le dossier de marché la reprend d’office.
          </p>
        }
        @if (depot()) {
          <button type="button" class="btn btn-primary btn-sm" (click)="ouvrirDepot()">
            {{ publication() ? 'Remplacer' : (lettres() ? 'Déposer les lettres avec accusé' : 'Déposer la publication de l’avis') }}
          </button>
        }
        @if (refusLecture(); as r) { <span class="pav__refus" role="alert">{{ r }}</span> }
      </section>
    }

    <!-- Fermeture par le bouton ou Échap seulement (règle du 13/09). -->
    @if (ouverte()) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="titre()" appModale (appModaleFermer)="fermer()">
          <div class="modal-header">
            <span class="modal-title">{{ titre() }}</span>
            <button type="button" class="btn-close" aria-label="Fermer sans déposer" [disabled]="envoi()" (click)="fermer()">✕</button>
          </div>
          <div class="modal-body pav__champs">
            <p class="pav__aide">
              @if (lettres()) {
                La copie des lettres d’invitation envoyées, avec l’accusé de réception de chaque candidat, en un seul PDF. Elle tient lieu de
                publication de l’avis : le dossier de marché la reprend d’office.
              } @else {
                Le journal où l’avis spécifique a paru. Il se dépose une fois : le dossier de marché le reprend d’office.
              }
              @if (publication()) { Le nouveau dépôt remplace celui en vigueur. }
            </p>
            <label class="form-group">
              <span class="form-label">{{ lettres() ? 'Scan des lettres avec accusé (PDF)' : 'Scan du journal (PDF)' }}</span>
              <input class="form-control" type="file" accept="application/pdf" (change)="choisir($event)" />
              @if (erreurs().fichier; as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">{{ lettres() ? 'Date d’envoi des lettres' : 'Date de parution' }}</span>
              <input class="form-control" type="date" [max]="aujourdhui" [value]="saisie().dateParution" (input)="poser('dateParution', $any($event.target).value)" />
              @if (erreurs().dateParution; as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Nom du journal @if (lettres()) { <span class="pav__meta">(facultatif)</span> }</span>
              <input class="form-control" type="text" [value]="saisie().journal" (input)="poser('journal', $any($event.target).value)" />
              @if (erreurs().journal; as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Numéro du journal <span class="pav__meta">(facultatif)</span></span>
              <input class="form-control" type="text" [value]="saisie().numero" (input)="poser('numero', $any($event.target).value)" />
              @if (erreurs().numero; as m) { <span class="form-error">{{ m }}</span> }
            </label>
            @if (refus(); as r) { <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div> }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" [disabled]="envoi()" (click)="fermer()">Annuler</button>
            <button type="button" class="btn btn-primary" [disabled]="envoi() || !complete()" (click)="deposer()">{{ envoi() ? 'Dépôt…' : 'Déposer' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .pav { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.75rem; }
    .pav__txt { margin: 0; font-size: var(--text-sm); }
    .pav__meta { color: var(--n-500); font-weight: 400; }
    .pav__refus { color: var(--danger-text); font-size: var(--text-sm); }
    .pav__aide { margin-top: 0; font-size: var(--text-sm); }
    .pav__champs { display: grid; gap: 0.75rem; }
  `,
})
export class PublicationAvisPanneau implements OnInit {
  private readonly service = inject(FicheMarcheService);
  private readonly auth = inject(AuthService);

  readonly idDmc = input.required<number>();
  /** Lettres d'invitation (prestations intellectuelles, appel d'offres restreint) plutôt qu'un avis publié dans un journal. */
  readonly lettres = input(false);
  /** Lecture seule (fiche consultée par un autre profil) : la preuve se lit, le dépôt disparaît. */
  readonly lecture = input(false);

  readonly publication = signal<PublicationAvisDeposee | null>(null);
  readonly lue = signal(false);
  readonly depot = computed(() => !this.lecture() && ['PRMP', 'UGPM'].includes(this.auth.role() ?? ''));
  readonly visible = computed(() => this.lue() && (this.publication() !== null || this.depot()));
  readonly titre = computed(() => (this.lettres() ? 'Lettres d’invitation avec accusé' : 'Publication de l’avis'));
  readonly refusLecture = signal<string | null>(null);
  readonly occupe = signal(false);

  readonly ouverte = signal(false);
  readonly envoi = signal(false);
  readonly fichier = signal<File | null>(null);
  readonly saisie = signal({ journal: '', numero: '', dateParution: '' });
  readonly erreurs = signal<Partial<Record<Champ, string>>>({});
  readonly refus = signal<string | null>(null);
  readonly complete = computed(() => {
    const s = this.saisie();
    return this.fichier() !== null && !!s.dateParution && (this.lettres() || !!s.journal.trim());
  });
  readonly aujourdhui = aujourdhuiServeur();
  readonly jj = jjmmaaaa;
  readonly quand = horodatage;

  ngOnInit(): void {
    this.service.publicationAvis(this.idDmc()).subscribe({
      next: (p) => {
        this.publication.set(p);
        this.lue.set(true);
      },
      error: () => this.lue.set(true),
    });
  }

  ouvrirScan(): void {
    this.occupe.set(true);
    this.refusLecture.set(null);
    this.service.publicationAvisContenu(this.idDmc()).subscribe({
      next: (pdf) => {
        this.occupe.set(false);
        ouvrirBlobSur(pdf);
      },
      error: () => {
        this.occupe.set(false);
        this.refusLecture.set('Le document n’a pas pu être ouvert. Réessayez.');
      },
    });
  }

  ouvrirDepot(): void {
    const p = this.publication();
    this.saisie.set({ journal: p?.journal ?? '', numero: '', dateParution: '' });
    this.fichier.set(null);
    this.erreurs.set({});
    this.refus.set(null);
    this.ouverte.set(true);
  }

  fermer(): void {
    if (!this.envoi()) this.ouverte.set(false);
  }

  choisir(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    const erreur = f ? validerFichier(f, TYPES_PDF) : null;
    this.fichier.set(erreur ? null : f);
    this.erreurs.update((e) => ({ ...e, fichier: erreur ?? undefined }));
  }

  poser(cle: Exclude<Champ, 'fichier'>, valeur: string): void {
    this.saisie.update((s) => ({ ...s, [cle]: valeur }));
    if (this.erreurs()[cle]) this.erreurs.update((e) => ({ ...e, [cle]: undefined }));
  }

  deposer(): void {
    const f = this.fichier();
    if (this.envoi() || !this.complete() || !f) return;
    const s = this.saisie();
    const fd = new FormData();
    fd.append('fichier', f);
    if (s.journal.trim()) fd.append('journal', s.journal.trim());
    if (s.numero.trim()) fd.append('numero', s.numero.trim());
    fd.append('dateParution', s.dateParution);
    this.envoi.set(true);
    this.refus.set(null);
    this.service.deposerPublicationAvis(this.idDmc(), fd).subscribe({
      next: (p) => {
        this.envoi.set(false);
        this.ouverte.set(false);
        this.publication.set(p);
      },
      error: (e: ApiError) => {
        this.envoi.set(false);
        const parChamp = erreursParChamp(e);
        if (e.status === 400 && parChamp.size) {
          this.erreurs.set(Object.fromEntries(parChamp) as Partial<Record<Champ, string>>);
          return;
        }
        this.refus.set(refusDepotAvis(e, this.lettres()));
      },
    });
  }
}

/** Le refus du dépôt, nommé. */
export function refusDepotAvis(e: ApiError, lettres: boolean): string {
  switch (codeErreur(e)) {
    case 'AVIS_NON_PUBLIE':
      return lettres ? 'Les lettres d’invitation ne sont pas encore imprimées : leur copie avec accusé se dépose après.'
        : 'L’avis spécifique n’est pas encore imprimé : sa publication se dépose après.';
    case 'FICHE_NON_VALIDEE':
      return 'La fiche n’a pas de version validée.';
    default:
      return e.status === 403 ? 'Seuls la PRMP de la fiche et son UGPM déposent ce document.' : 'Le dépôt a échoué. Réessayez.';
  }
}
