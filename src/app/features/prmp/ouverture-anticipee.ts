import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';

import { ApiError, codeErreur, corpsErreur, erreursParChamp } from '../../core/errors/api-error';
import { jourIso, maintenantServeur } from '../../core/horloge/heure-serveur';
import { OuvertureAnticipee } from '../../models';
import { FicheMarcheService } from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { dateHeureFr } from '../candidat/libelles-candidat';

/**
 * ⚠️ 03/11 (V160, « appel-offres-restreint », §B7 ; arbitrage Q4 du pilote ; loi n° 2016-055, art. 38-VI) — l'**ouverture anticipée
 * des plis** d'un appel d'offres restreint, sur le registre des dépôts : quand chaque invité a déposé, la PRMP sollicite leur
 * consentement écrit ; si tous consentent, elle fixe une heure d'ouverture avant la date limite. Un seul refus clôt la demande.
 *
 * Les offres sont **figées dès la demande** (le serveur refuse dépôt, remplacement et retrait) : la demande se confirme dans une modale.
 * Muet hors appel d'offres restreint et une fois les dépôts clos sans demande.
 */
@Component({
  selector: 'app-ouverture-anticipee',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    @if (visible()) {
      <section class="card oa" aria-labelledby="oa-titre">
        <h2 id="oa-titre" class="oa__h2">Ouverture anticipée des plis</h2>
        @if (demande(); as d) {
          <p class="oa__etat">
            @switch (d.etat) {
              @case ('DEMANDEE') { Consentements demandés le {{ dh(d.demandeeLe) }} : les offres sont figées en attendant les réponses. }
              @case ('ACCORDEE') { Tous les invités ont consenti par écrit. Fixez la nouvelle heure d’ouverture. }
              @case ('FIXEE') { Les plis s’ouvriront le <strong>{{ dh(d.nouvelleOuverture) }}</strong> au lieu du {{ dh(d.ouvertureInitiale) }}. }
              @case ('REFUSEE') { Un invité a refusé : l’ouverture reste fixée au {{ dh(d.ouvertureInitiale) }}, et les offres redeviennent libres. }
            }
          </p>
          <ul class="oa__liste" aria-label="Consentements des invités">
            @for (c of d.consentements; track c.idCandidat) {
              <li class="oa__ligne">
                <span>{{ c.nom }}</span>
                <span class="oa__rep" [attr.data-accord]="c.accord === null ? 'attente' : c.accord ? 'oui' : 'non'">
                  {{ c.accord === null ? 'en attente' : (c.accord ? 'a consenti' : 'a refusé') + (c.reponduLe ? ' le ' + dh(c.reponduLe) : '') }}
                </span>
              </li>
            }
          </ul>
          @if (prmp() && (d.etat === 'ACCORDEE' || d.etat === 'FIXEE')) {
            <div class="oa__fixer">
              <label class="form-group">
                <span class="form-label">{{ d.etat === 'FIXEE' ? 'Changer l’heure d’ouverture' : 'Nouvelle heure d’ouverture' }}</span>
                <input class="form-control" type="datetime-local" [min]="minimum()" [max]="maximum()" [value]="saisie()" (input)="poser($any($event.target).value)" />
                <span class="form-hint">Après maintenant, et avant l’ouverture prévue ({{ dh(d.ouvertureInitiale) }}). Les invités et la Commission sont prévenus.</span>
                @if (erreurDate(); as m) { <span class="form-error">{{ m }}</span> }
              </label>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="occupe() || !saisie()" (click)="fixer()">{{ occupe() ? 'Enregistrement…' : 'Fixer l’heure' }}</button>
            </div>
          }
        } @else {
          <p class="oa__txt">
            Quand chaque invité a déposé son offre, les plis peuvent s’ouvrir avant la date limite, avec le consentement écrit de
            <strong>tous</strong> les invités (loi n° 2016-055, art. 38-VI). Dès la demande, les offres sont figées : plus de dépôt, de
            remplacement ni de retrait. Un seul refus clôt la demande, sans nouvelle demande possible.
          </p>
          @if (prmp()) {
            <button type="button" class="btn btn-outline btn-sm" (click)="confirmation.set(true)">Demander l’ouverture anticipée</button>
          }
        }
        @if (refus(); as r) { <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div> }
      </section>
    }

    <!-- Fermeture par le bouton ou Échap seulement (règle du 13/09). -->
    @if (confirmation()) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Demander l’ouverture anticipée des plis" appModale (appModaleFermer)="fermer()">
          <div class="modal-header">
            <span class="modal-title">Demander l’ouverture anticipée</span>
            <button type="button" class="btn-close" aria-label="Fermer sans demander" [disabled]="occupe()" (click)="fermer()">✕</button>
          </div>
          <div class="modal-body">
            <p>Chaque invité sera sollicité pour donner son consentement écrit. <strong>Dès maintenant, les offres sont figées</strong> : aucun
              invité ne pourra plus déposer, remplacer ni retirer la sienne, sauf si l’un d’eux refuse.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" [disabled]="occupe()" (click)="fermer()">Annuler</button>
            <button type="button" class="btn btn-primary" [disabled]="occupe()" (click)="demander()">{{ occupe() ? 'Envoi…' : 'Demander les consentements' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .oa { display: flex; flex-direction: column; gap: 0.6rem; padding: 1rem; }
    .oa__h2 { margin: 0; font-size: 1rem; }
    .oa__txt, .oa__etat { margin: 0; font-size: var(--text-sm); }
    .oa__liste { list-style: none; margin: 0; padding: 0; font-size: var(--text-sm); }
    .oa__ligne { display: flex; justify-content: space-between; gap: 1rem; padding: 0.35rem 0; border-bottom: 1px solid var(--bordure); }
    .oa__rep { color: var(--n-500); }
    .oa__rep[data-accord='non'] { color: var(--danger-text); }
    .oa__fixer { display: flex; align-items: flex-end; gap: 0.75rem; flex-wrap: wrap; }
  `,
})
export class OuvertureAnticipeePanneau implements OnInit {
  private readonly service = inject(FicheMarcheService);

  readonly idDmc = input.required<number>();
  /** La fiche est en mode restreint (lue par l'en-tête de la procédure). */
  readonly restreint = input(false);
  /** Dépôts clos : sans demande, il n'y a plus rien à proposer. */
  readonly clos = input(false);
  /** La PRMP de la fiche demande et fixe ; les autres lecteurs suivent. */
  readonly prmp = input(false);

  readonly demande = signal<OuvertureAnticipee | null>(null);
  readonly lue = signal(false);
  readonly visible = computed(() => this.lue() && (this.demande() !== null || (this.restreint() && !this.clos())));
  readonly confirmation = signal(false);
  readonly occupe = signal(false);
  readonly refus = signal<string | null>(null);
  readonly saisie = signal('');
  readonly erreurDate = signal<string | null>(null);
  readonly minimum = signal(heureLocale(maintenantServeur()));
  readonly maximum = computed(() => (this.demande()?.ouvertureInitiale ?? '').slice(0, 16));
  readonly dh = dateHeureFr;

  ngOnInit(): void {
    this.service.ouvertureAnticipee(this.idDmc()).subscribe({
      next: (d) => this.recevoir(d ?? null),
      error: () => this.lue.set(true),
    });
  }

  fermer(): void {
    if (!this.occupe()) this.confirmation.set(false);
  }

  demander(): void {
    this.occupe.set(true);
    this.refus.set(null);
    this.service.demanderOuvertureAnticipee(this.idDmc()).subscribe({
      next: (d) => {
        this.occupe.set(false);
        this.confirmation.set(false);
        this.recevoir(d);
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.confirmation.set(false);
        this.refus.set(refusAnticipation(e));
      },
    });
  }

  poser(valeur: string): void {
    this.saisie.set(valeur);
    this.erreurDate.set(null);
  }

  fixer(): void {
    if (!this.saisie() || this.occupe()) return;
    this.occupe.set(true);
    this.refus.set(null);
    this.service.fixerOuvertureAnticipee(this.idDmc(), this.saisie()).subscribe({
      next: (d) => {
        this.occupe.set(false);
        this.recevoir(d);
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        const champ = erreursParChamp(e).get('nouvelleOuverture');
        if (e.status === 400 && champ) this.erreurDate.set(champ);
        else this.refus.set(refusAnticipation(e));
      },
    });
  }

  private recevoir(d: OuvertureAnticipee | null): void {
    this.demande.set(d);
    this.saisie.set((d?.nouvelleOuverture ?? '').slice(0, 16));
    this.minimum.set(heureLocale(maintenantServeur()));
    this.lue.set(true);
  }
}

/** « AAAA-MM-JJTHH:MM » à l'heure locale du poste calé sur le serveur (borne d'un champ `datetime-local`). */
function heureLocale(d: Date): string {
  const z = (n: number): string => String(n).padStart(2, '0');
  return `${jourIso(d)}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

/** Le refus de la demande ou de la fixation, nommé. */
export function refusAnticipation(e: ApiError): string {
  switch (codeErreur(e)) {
    case 'HORS_RESTREINT':
      return 'L’ouverture anticipée ne vaut que pour un appel d’offres restreint en ligne (hors prestations intellectuelles).';
    case 'DEPOTS_CLOS':
      return 'La date limite est passée : les plis s’ouvrent à l’heure prévue.';
    case 'SEANCE_DEJA_OUVERTE':
      return 'La séance d’ouverture a déjà eu lieu.';
    case 'DEJA_DEMANDEE':
      return 'Une demande existe déjà pour cette procédure : rechargez la page.';
    case 'DEPOTS_INCOMPLETS': {
      const manquants = corpsErreur<{ details?: { manquants?: string[] } }>(e)?.details?.manquants ?? [];
      return manquants.length
        ? `Tous les invités n’ont pas encore déposé leur offre : ${manquants.join(', ')}.`
        : 'Tous les invités n’ont pas encore déposé leur offre.';
    }
    case 'CONSENTEMENTS_INCOMPLETS':
      return 'Tous les invités n’ont pas encore consenti par écrit.';
    case 'ANTICIPATION_REFUSEE':
      return 'Un invité a refusé : l’ouverture reste à l’heure prévue.';
    default:
      return e.status === 403 ? 'Seule la PRMP de la fiche demande l’ouverture anticipée.' : 'L’opération n’a pas abouti. Réessayez.';
  }
}
