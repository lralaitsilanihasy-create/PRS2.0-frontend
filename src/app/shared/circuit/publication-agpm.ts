import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur, erreursParChamp } from '../../core/errors/api-error';
import { ouvrirBlobSur, TYPES_PDF, validerFichier } from '../../core/securite/fichiers-surs';
import { PublicationAgpm } from '../../models';
import { DossierService } from '../../services';
import { ModaleDirective } from '../a11y/modale.directive';
import { horodatage, jjmmaaaa } from '../prmp/avis-specifique-modele';

type Champ = 'fichier' | 'journal' | 'numero' | 'dateParution' | 'referenceAgpm';

/**
 * ⚠️ V118 (15/10, décision du pilote) — la **publication de l'AGPM** (le journal) se dépose une fois, sur le plan contrôlé, et chaque
 * dossier du plan la reprend d'office ; l'avis spécifique cite son journal.
 *
 * - Sur le plan (`depot`), la PRMP et son UGPM la déposent ou la remplacent (le serveur garde la précédente, et refuse avant le PV signé
 *   favorable : `PLAN_NON_CONTROLE`).
 * - Sur un dossier du plan, elle se lit seulement. Muet quand le dossier ne relève d'aucun plan (404, 403, 409).
 */
@Component({
  selector: 'app-publication-agpm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    @if (visible()) {
      <section class="pa" aria-label="Publication de l’avis général de passation des marchés">
        @if (publication(); as p) {
          <p class="pa__txt">
            <strong>Publication de l’AGPM</strong> : {{ p.journal }}@if (p.numero) { n° {{ p.numero }}} du {{ jj(p.dateParution) }}, AGPM {{ p.referenceAgpm }}
            @if (p.heritee) { <span class="pa__meta">· déposée sur une version précédente du plan</span> }
            @if (p.deposeLe) { <span class="pa__meta">· déposée le {{ quand(p.deposeLe) }}@if (p.deposePar) { par {{ p.deposePar }}}</span> }
          </p>
          <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="ouvrirScan()">Ouvrir le journal (PDF)</button>
        } @else if (depot()) {
          <p class="pa__txt">
            <strong>Publication de l’AGPM</strong> : pas encore déposée. Déposez-la ici une fois le plan contrôlé : chaque dossier du plan la
            reprend d’office, et l’avis spécifique cite son journal.
          </p>
        }
        @if (depot()) {
          <button type="button" class="btn btn-primary btn-sm" (click)="ouvrirDepot()">
            {{ publication() ? 'Remplacer la publication' : 'Déposer la publication de l’AGPM' }}
          </button>
        }
        @if (refusLecture(); as r) { <span class="pa__refus" role="alert">{{ r }}</span> }
      </section>
    }

    <!-- Fermeture par le bouton ou Échap seulement (règle du 13/09). -->
    @if (ouverte()) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Déposer la publication de l’AGPM" appModale (appModaleFermer)="fermer()">
          <div class="modal-header">
            <span class="modal-title">Publication de l’avis général (AGPM)</span>
            <button type="button" class="btn-close" aria-label="Fermer sans déposer" [disabled]="envoi()" (click)="fermer()">✕</button>
          </div>
          <div class="modal-body pa__champs">
            <p class="pa__aide">Le journal où l’avis général du plan a paru. Il se dépose une fois : chaque dossier du plan le reprend d’office.
              @if (publication()) { Le nouveau dépôt remplace la publication en vigueur, qui reste gardée. }</p>
            <label class="form-group">
              <span class="form-label">Scan du journal (PDF)</span>
              <input class="form-control" type="file" accept="application/pdf" (change)="choisir($event)" />
              @if (erreurs().fichier; as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Nom du journal</span>
              <input class="form-control" type="text" [value]="saisie().journal" (input)="poser('journal', $any($event.target).value)" />
              @if (erreurs().journal; as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Numéro du journal <span class="pa__meta">(facultatif)</span></span>
              <input class="form-control" type="text" [value]="saisie().numero" (input)="poser('numero', $any($event.target).value)" />
              @if (erreurs().numero; as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Date de parution</span>
              <input class="form-control" type="date" [max]="aujourdhui" [value]="saisie().dateParution" (input)="poser('dateParution', $any($event.target).value)" />
              @if (erreurs().dateParution; as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Référence de l’AGPM</span>
              <input class="form-control" type="text" [value]="saisie().referenceAgpm" (input)="poser('referenceAgpm', $any($event.target).value)" />
              @if (erreurs().referenceAgpm; as m) { <span class="form-error">{{ m }}</span> }
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
    .pa { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .pa__txt { margin: 0; font-size: var(--text-sm); }
    .pa__meta { color: var(--n-500); font-weight: 400; }
    .pa__refus { color: var(--danger-text); font-size: var(--text-sm); }
    .pa__aide { margin-top: 0; font-size: var(--text-sm); }
    .pa__champs { display: grid; gap: 0.75rem; }
  `,
})
export class PublicationAgpmPanneau implements OnInit {
  private readonly service = inject(DossierService);
  private readonly auth = inject(AuthService);

  readonly idDossier = input.required<number>();
  /** Sur le plan : le dépôt est proposé à la PRMP et à son UGPM (le serveur juge la propriété et le contrôle du plan). */
  readonly plan = input(false);

  readonly publication = signal<PublicationAgpm | null>(null);
  readonly lue = signal(false);
  readonly depot = computed(() => this.plan() && ['PRMP', 'UGPM'].includes(this.auth.role() ?? ''));
  /** Sur un dossier : visible seulement quand le plan porte une publication. Sur le plan : toujours, pour qui peut déposer. */
  readonly visible = computed(() => this.lue() && (this.publication() !== null || this.depot()));
  readonly refusLecture = signal<string | null>(null);
  readonly occupe = signal(false);

  readonly ouverte = signal(false);
  readonly envoi = signal(false);
  readonly fichier = signal<File | null>(null);
  readonly saisie = signal({ journal: '', numero: '', dateParution: '', referenceAgpm: '' });
  readonly erreurs = signal<Partial<Record<Champ, string>>>({});
  readonly refus = signal<string | null>(null);
  readonly complete = computed(() => {
    const s = this.saisie();
    return this.fichier() !== null && !!s.journal.trim() && !!s.dateParution && !!s.referenceAgpm.trim();
  });
  readonly aujourdhui = new Date().toISOString().slice(0, 10);
  readonly jj = jjmmaaaa;
  readonly quand = horodatage;

  ngOnInit(): void {
    this.service.publicationAgpm(this.idDossier()).subscribe({
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
    this.service.publicationAgpmContenu(this.idDossier()).subscribe({
      next: (pdf) => {
        this.occupe.set(false);
        ouvrirBlobSur(pdf);
      },
      error: () => {
        this.occupe.set(false);
        this.refusLecture.set('Le journal n’a pas pu être ouvert. Réessayez.');
      },
    });
  }

  ouvrirDepot(): void {
    const p = this.publication();
    this.saisie.set({ journal: p?.journal ?? '', numero: '', dateParution: '', referenceAgpm: p?.referenceAgpm ?? '' });
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
    fd.append('journal', s.journal.trim());
    if (s.numero.trim()) fd.append('numero', s.numero.trim());
    fd.append('dateParution', s.dateParution);
    fd.append('referenceAgpm', s.referenceAgpm.trim());
    this.envoi.set(true);
    this.refus.set(null);
    this.service.deposerPublicationAgpm(this.idDossier(), fd).subscribe({
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
        this.refus.set(refusDepot(e));
      },
    });
  }
}

/** Le refus du dépôt, nommé. */
export function refusDepot(e: ApiError): string {
  switch (codeErreur(e)) {
    case 'PLAN_NON_CONTROLE':
      return 'Le plan n’est pas encore contrôlé : la publication de l’AGPM se dépose une fois le PV de la Commission signé avec un avis favorable.';
    case 'PAS_UN_PLAN':
      return 'Ce dossier n’est pas un plan de passation : la publication de l’AGPM se dépose sur le plan.';
    default:
      return e.status === 403 ? 'Seuls la PRMP du plan et son UGPM déposent la publication de l’AGPM.' : 'Le dépôt a échoué. Réessayez.';
  }
}
