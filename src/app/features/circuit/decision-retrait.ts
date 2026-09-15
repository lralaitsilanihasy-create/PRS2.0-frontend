import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, concat, map, of, switchMap } from 'rxjs';

import { isApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { DemandeRetrait } from '../../models';
import { DemandeRetraitService } from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { Icone } from '../../shared/ui/icone';
import { jourMoisHeure } from '../home/a-faire/a-faire-modele';

/** Longueur maximale du motif de refus (`DemandeRetraitDecisionRequest.motif`, `@Size(max = 500)`). */
export const MOTIF_REFUS_MAX = 500;

/**
 * Motif de refus : obligatoire (la PRMP le reçoit), 500 caractères au plus. Rendu `null` s'il est
 * valable, sinon le message affiché sous le champ. Vérifié AVANT toute requête : sans motif, ni
 * confirmation ni appel.
 *
 * Le serveur accepte un refus sans motif ; l'obligation est une règle de l'interface, reprise de la liste
 * des demandes (`retraits-validation`), où « Confirmer le refus » reste inactif tant que le motif est vide.
 */
export function erreurMotifRefus(motif: string | null | undefined): string | null {
  const texte = (motif ?? '').trim();
  if (!texte) return 'Indiquez le motif du refus : il est communiqué à la PRMP.';
  if (texte.length > MOTIF_REFUS_MAX) return `Le motif du refus ne peut dépasser ${MOTIF_REFUS_MAX} caractères (${texte.length} saisis).`;
  return null;
}

/** Demande de retrait à décider, telle que la page la connaît par ses gestes (sans lecture). */
export interface DemandeADecider {
  idDemandeRetrait: number | null;
  /** Motif de la PRMP. */
  motif: string | null;
  /** Date de la demande. */
  demandeeLe: string | null;
}

type LectureDemande = { etat: 'chargement' } | { etat: 'pret'; demande: DemandeRetrait } | { etat: 'echec' };

/**
 * Décision sur une demande de retrait, DANS le panneau de l'étape (page dossier, lot L4-F5) : le motif
 * de la PRMP et sa lettre signée, puis « Accepter le retrait » ou « Refuser » avec un motif obligatoire,
 * confirmé en modale (plan L4 §4). Monté par `EtapeCourante` seulement si le serveur sert
 * DECIDER_RETRAIT — au Président, ou au Chef de commission de la localité du dossier.
 *
 * Mêmes appels et mêmes messages que la liste des demandes (`retraits-validation`, non modifiée) :
 * `DemandeRetraitService.accepter` et `refuser`, refus et conflits présentés par l'intercepteur.
 *
 * L'hôte est `display: contents` : le formulaire se range sous le titre du panneau, le volet « La demande
 * de la PRMP » dans sa colonne de droite. `suite` : un autre geste passe avant (navette du PV, dispatch…),
 * la décision prend alors sa propre rangée, sous un intertitre.
 *
 * ⚠️ Transition : une décision enregistrée ne réaffiche pas le formulaire en attendant que la page ait
 * relu les gestes — sinon un second clic partirait sur une demande déjà traitée (409).
 */
@Component({
  selector: 'app-decision-retrait',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, ModaleDirective],
  host: { '[class.dr-hote--suite]': 'suite()' },
  template: `
    <div class="dr" role="group" tabindex="-1" #zone [attr.aria-labelledby]="suite() ? 'dr-titre' : 'ec-titre'">
      @if (suite()) {
        <h3 class="dr__titre" id="dr-titre">Demande de retrait de la PRMP</h3>
      }
      <p class="dr__aide">
        <b>Accepter</b> : le dossier revient en brouillon chez la PRMP et son circuit à la CNM est effacé.
        <b>Refuser</b> : le circuit se poursuit.
      </p>

      @if (demande().idDemandeRetrait == null) {
        <p class="dr__erreur" role="alert">Cette demande de retrait n'est pas référencée : rechargez la page.</p>
      } @else if (transition()) {
        <p class="dr__attente" role="status"><span class="spinner" aria-hidden="true"></span>Décision enregistrée, mise à jour du dossier…</p>
      } @else if (!refusOuvert()) {
        <div class="dr__actions" [attr.aria-busy]="enCours() !== null">
          <!-- En suite d'un autre geste, le bouton principal reste celui de ce geste : pas deux boutons pleins. -->
          <button type="button" class="btn dr__accepter" [class.btn-primary]="!suite()" [class.btn-outline]="suite()" data-geste="DECIDER_RETRAIT" [disabled]="bloque()" (click)="accepter()">
            <app-icone nom="check" [taille]="16" />{{ enCours() === 'accepter' ? 'Acceptation…' : 'Accepter le retrait' }}
          </button>
          <button type="button" class="btn btn-outline dr__refuser" #refuserBouton [disabled]="bloque()" (click)="ouvrirRefus()">
            <app-icone nom="x" [taille]="16" />Refuser…
          </button>
        </div>
      } @else {
        <div class="dr__refus">
          <label class="dr__label" for="dr-motif">Motif du refus <span class="dr__label-aide">(obligatoire, communiqué à la PRMP)</span></label>
          <textarea
            id="dr-motif"
            class="form-control dr__motif"
            rows="3"
            #motifChamp
            [attr.maxlength]="max"
            [value]="motif()"
            [attr.aria-invalid]="erreur() ? true : null"
            [attr.aria-describedby]="erreur() ? 'dr-motif-erreur' : null"
            (input)="saisir($event)"
          ></textarea>
          @if (erreur(); as e) {
            <p class="dr__erreur" id="dr-motif-erreur" role="alert"><app-icone nom="alert" [taille]="15" />{{ e }}</p>
          }
          <div class="dr__actions">
            <button type="button" class="btn btn-danger" data-geste="DECIDER_RETRAIT" [disabled]="bloque()" (click)="demanderRefus()">
              <app-icone nom="x" [taille]="16" />Refuser la demande
            </button>
            <button type="button" class="btn btn-outline" [disabled]="bloque()" (click)="annulerRefus()">Annuler</button>
          </div>
        </div>
      }
    </div>

    <section class="dr-volet" aria-labelledby="dr-volet-titre">
      <h3 class="dr-volet__titre" id="dr-volet-titre">La demande de la PRMP</h3>
      <dl class="dr-volet__faits">
        <div class="dr-volet__fait dr-volet__fait--motif">
          <dt>Motif</dt>
          <dd>{{ motifPrmp() ? '« ' + motifPrmp() + ' »' : 'Non renseigné' }}</dd>
        </div>
        @if (demandeeLe()) {
          <div class="dr-volet__fait"><dt>Demandée le</dt><dd>{{ demandeeLe() }}</dd></div>
        }
        <div class="dr-volet__fait">
          <dt>Lettre signée</dt>
          <dd>
            @switch (lecture().etat) {
              @case ('chargement') {
                <span class="dr-volet__discret" role="status">Lecture…</span>
              }
              @case ('echec') {
                <span class="dr-volet__discret">Indisponible</span>
                <button type="button" class="dr-volet__lien" (click)="relire()">Réessayer</button>
              }
              @case ('pret') {
                @if (lettre()) {
                  <button type="button" class="btn btn-outline btn-sm dr-volet__lettre" (click)="ouvrirLettre()">
                    <app-icone nom="file" [taille]="15" />Ouvrir la lettre
                  </button>
                } @else {
                  <span class="dr-volet__discret">Aucune (demande antérieure au 17/08/2026)</span>
                }
              }
            }
          </dd>
        </div>
      </dl>
    </section>

    @if (confirmation()) {
      <div class="modal-backdrop">
        <div
          class="modal dr-conf"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirmer le refus de la demande de retrait"
          aria-describedby="dr-conf-texte"
          appModale
          (appModaleFermer)="fermerConfirmation()"
        >
          <div class="modal-header">
            <h2 class="modal-title">Refuser la demande de retrait ?</h2>
            <button type="button" class="btn-close" aria-label="Fermer" [disabled]="enCours() !== null" (click)="fermerConfirmation()">✕</button>
          </div>
          <div class="modal-body">
            <p class="dr-conf__texte" id="dr-conf-texte">Le dossier poursuit son circuit. La PRMP recevra ce motif :</p>
            <blockquote class="dr-conf__motif">« {{ motif().trim() }} »</blockquote>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" [disabled]="enCours() !== null" (click)="fermerConfirmation()">Annuler</button>
            <button type="button" class="btn btn-danger dr-conf__confirmer" [disabled]="enCours() !== null" (click)="refuser()">
              {{ enCours() === 'refuser' ? 'Refus…' : 'Confirmer le refus' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './decision-retrait.scss',
})
export class DecisionRetrait {
  readonly demande = input.required<DemandeADecider>();
  /** Un autre geste passe avant : la décision prend sa rangée, sous un intertitre. */
  readonly suite = input(false);
  /** La page prépare un geste ou relit le dossier : les boutons attendent. */
  readonly occupe = input(false);
  /**
   * La demande a été décidée — ou a changé ailleurs (404, 409) : la page relit le dossier et ses gestes.
   */
  readonly changed = output<void>();

  private readonly service = inject(DemandeRetraitService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly max = MOTIF_REFUS_MAX;
  readonly lecture = signal<LectureDemande>({ etat: 'chargement' });
  readonly refusOuvert = signal(false);
  readonly motif = signal('');
  readonly erreur = signal<string | null>(null);
  readonly confirmation = signal(false);
  readonly enCours = signal<'accepter' | 'refuser' | null>(null);
  /** Décision enregistrée, gestes pas encore relus par la page. */
  readonly transition = signal(false);
  readonly bloque = computed(() => this.occupe() || this.enCours() !== null || this.transition());

  private readonly lu = computed(() => {
    const l = this.lecture();
    return l.etat === 'pret' ? l.demande : null;
  });
  /** Le motif servi avec les gestes ; celui de la demande lue, à défaut. */
  readonly motifPrmp = computed(() => this.demande().motif ?? this.lu()?.motifRetrait ?? null);
  readonly demandeeLe = computed(() => jourMoisHeure(this.demande().demandeeLe ?? this.lu()?.dateDemande));
  readonly lettre = computed(() => !!this.lu()?.nomFichier);

  private readonly zoneEl = viewChild.required<ElementRef<HTMLElement>>('zone');
  private readonly champMotif = viewChild<ElementRef<HTMLTextAreaElement>>('motifChamp');
  private readonly refuserBouton = viewChild<ElementRef<HTMLButtonElement>>('refuserBouton');
  private readonly idDemande = computed(() => this.demande().idDemandeRetrait);
  private readonly lecture$ = new Subject<number | null>();

  constructor() {
    this.lecture$
      .pipe(
        switchMap((id) =>
          id == null
            ? of<LectureDemande>({ etat: 'echec' })
            : concat(
                of<LectureDemande>({ etat: 'chargement' }),
                this.service.lire(id).pipe(
                  map((demande): LectureDemande => ({ etat: 'pret', demande })),
                  catchError(() => of<LectureDemande>({ etat: 'echec' })),
                ),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((l) => this.lecture.set(l));

    effect(() => {
      const id = this.idDemande();
      untracked(() => this.lecture$.next(id));
    });
    // Gestes relus (nouvelle demande servie) : le formulaire reprend.
    effect(() => {
      this.demande();
      untracked(() => this.transition.set(false));
    });
  }

  /** Le formulaire (focus à l'arrivée par `?geste=DECIDER_RETRAIT`, sans armer un bouton irréversible). */
  zone(): HTMLElement {
    return this.zoneEl().nativeElement;
  }

  relire(): void {
    this.lecture$.next(this.idDemande());
  }

  ouvrirLettre(): void {
    const id = this.idDemande();
    if (id == null) return;
    this.service
      .document(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => ouvrirBlobSur(blob),
        error: () => this.toast.error("La lettre n'est pas disponible pour cette demande."),
      });
  }

  accepter(): void {
    const id = this.idDemande();
    if (id == null || this.bloque()) return;
    this.enCours.set('accepter');
    this.service
      .accepter(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Demande acceptée — dossier renvoyé en brouillon.');
          this.apresDecision();
        },
        error: (err: unknown) => this.echec(err),
      });
  }

  ouvrirRefus(): void {
    if (this.bloque()) return;
    this.refusOuvert.set(true);
    this.erreur.set(null);
    setTimeout(() => this.champMotif()?.nativeElement.focus());
  }

  annulerRefus(): void {
    this.refusOuvert.set(false);
    this.motif.set('');
    this.erreur.set(null);
    setTimeout(() => this.refuserBouton()?.nativeElement.focus());
  }

  saisir(ev: Event): void {
    const valeur = (ev.target as HTMLTextAreaElement).value;
    this.motif.set(valeur);
    // Le message suit la saisie une fois affiché ; il n'apparaît pas avant la première tentative.
    if (this.erreur()) this.erreur.set(erreurMotifRefus(valeur));
  }

  /** « Refuser la demande » : le motif d'abord — sans lui, ni confirmation ni requête. */
  demanderRefus(): void {
    if (this.bloque()) return;
    const e = erreurMotifRefus(this.motif());
    this.erreur.set(e);
    if (e) {
      this.champMotif()?.nativeElement.focus();
      return;
    }
    this.confirmation.set(true);
  }

  fermerConfirmation(): void {
    if (this.enCours() !== null) return;
    this.confirmation.set(false);
  }

  refuser(): void {
    const id = this.idDemande();
    const motif = this.motif().trim();
    // Seconde garde : la confirmation n'existe qu'avec un motif valable, l'appel non plus.
    if (id == null || this.enCours() !== null || erreurMotifRefus(motif)) return;
    this.enCours.set('refuser');
    this.service
      .refuser(id, motif)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.confirmation.set(false);
          this.toast.success('Demande refusée.');
          this.apresDecision();
        },
        error: (err: unknown) => {
          this.enCours.set(null);
          this.confirmation.set(false);
          this.echec(err);
        },
      });
  }

  private apresDecision(): void {
    this.enCours.set(null);
    this.refusOuvert.set(false);
    this.transition.set(true);
    this.changed.emit();
  }

  /** Refus et conflits : l'intercepteur les présente. 404 ou 409 : la demande a changé ailleurs, la page relit. */
  private echec(err: unknown): void {
    this.enCours.set(null);
    if (isApiError(err) && [404, 409].includes(err.status)) this.changed.emit();
  }
}
