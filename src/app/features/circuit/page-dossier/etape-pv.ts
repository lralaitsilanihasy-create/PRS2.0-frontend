import { ChangeDetectionStrategy, Component, ElementRef, afterEveryRender, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, concat, forkJoin, map, of, switchMap } from 'rxjs';

import { isApiError } from '../../../core/errors/api-error';
import { GesteAFaire, PvExamen } from '../../../models';
import { ExamenDetailService, ExamenPieceService, PvExamenService } from '../../../services';
import { PvWorkflow } from '../../../shared/circuit/pv-workflow';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { Icone } from '../../../shared/ui/icone';
import { LIBELLES_GESTES } from '../../home/a-faire/a-faire-libelles';
import { CibleGeste } from '../../home/a-faire/a-faire-navigation';
import { DetailPvModal } from '../detail-pv-modal';
import { NavettePv, voletPv } from './etape-courante-modele';

/**
 * Libellés des boutons de `PvWorkflow`, geste par geste. `PvWorkflow` n'est pas modifié (plan L4 §7 :
 * 12 commits du patron) et ses boutons ne portent ni attribut ni classe propre à un geste : seul leur
 * libellé les distingue. Un libellé changé en amont fait échouer `etape-pv.spec.ts`, qui monte le VRAI
 * `PvWorkflow` pour chaque geste — la dérive ne passe pas en silence.
 */
const LIBELLES_WORKFLOW: readonly (readonly [GesteAFaire, RegExp])[] = [
  ['SOUMETTRE_PV', /^Soumettre le projet/],
  ['ACCEPTER', /^(Accepter et transmettre|Transmission…)/],
  ['VISER', /^(Viser|Compléter le visa)/],
  ['RETOURNER', /^Retourner/],
  ['SIGNER', /^(Signer|Signé|Signature…)/],
];

/**
 * Boutons que `PvWorkflow` OFFRE réellement, par geste de navette — lus sur son rendu, qui applique ses
 * propres règles (statut du PV, identité du dispatcheur ou du désigné, niveau de navette) et `*appCan`.
 * Un bouton désactivé hors requête en cours (« Signé ✓ », part Membre pas encore ouverte, autre Membre
 * désigné) n'offre pas le geste ; « Signature… » ou « Transmission… » est une requête en cours.
 */
export function boutonsWorkflow(racine: ParentNode): Partial<Record<GesteAFaire, HTMLButtonElement>> {
  const offerts: Partial<Record<GesteAFaire, HTMLButtonElement>> = {};
  for (const bouton of Array.from(racine.querySelectorAll<HTMLButtonElement>('.pv-workflow__actions > button'))) {
    const texte = (bouton.textContent ?? '').replace(/\s+/g, ' ').trim();
    const geste = LIBELLES_WORKFLOW.find(([, motif]) => motif.test(texte))?.[0];
    if (geste && !offerts[geste] && (!bouton.disabled || texte.endsWith('…'))) offerts[geste] = bouton;
  }
  return offerts;
}

type LecturePv =
  | { etat: 'chargement' }
  | { etat: 'pret'; pv: PvExamen }
  | { etat: 'echec'; message: string; aide: string; reprise: boolean };

/** Demande de focus sur un geste de navette (`?geste=` à l'arrivée) : un objet neuf par demande. */
export interface FocusNavette {
  geste: GesteAFaire;
}

/**
 * Navette du projet de PV DANS le panneau de l'étape (page dossier, lot L4-F4) : `PvWorkflow` monté TEL
 * QUEL — la page ne réécrit aucune règle de la navette — et, dans la colonne de droite, le volet « Ce que
 * dit le projet de PV ». Monté par `EtapeCourante` seulement si le serveur sert SOUMETTRE_PV, ACCEPTER,
 * VISER, RETOURNER ou SIGNER ; jamais pour la PRMP ni l'UGPM (règle C2 : aucune requête de PV).
 *
 * L'hôte est `display: contents` : ses deux blocs se rangent dans la grille du panneau (`.ec`), la
 * navette sous le titre, le volet à droite. `PvWorkflow` n'est mis en page que par son conteneur.
 *
 * ⚠️ Divergence possible (plan L4 §8.2) : `PvWorkflow` filtre encore par statut, identité et `*appCan`.
 * Si le serveur sert un geste que son rendu n'offre pas, le panneau l'écrit (« geste indisponible sur
 * cet écran ») avec un lien vers la gestion du projet de PV, au lieu de rester muet.
 */
@Component({
  selector: 'app-etape-pv',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icone, EtatErreur, PvWorkflow, DetailPvModal],
  template: `
    <div class="ep" #zone>
      @switch (lecture().etat) {
        @case ('chargement') {
          <p class="ep__attente" role="status"><span class="spinner" aria-hidden="true"></span>Chargement du projet de PV…</p>
        }
        @case ('pret') {
          @if (pv(); as p) {
            <app-pv-workflow class="ep__workflow" [pv]="p" [idLocalite]="idLocalite()" [nbObservationsExamen]="nbObservations()" (changed)="apresTransition($event)" />
          }
        }
        @case ('echec') {
          @if (echec(); as e) {
            <app-etat-erreur class="ep__erreur" [message]="e.message" [aide]="e.aide" [reprise]="e.reprise" (reessayer)="relire()" />
          }
        }
      }
      @if (indisponibles().length) {
        <p class="ep__indispo">
          <app-icone nom="alert" [taille]="16" />
          <span>
            <b>{{ libellesIndisponibles() }}</b> : geste indisponible sur cet écran.
            @if (lienPv(); as lien) {
              @if (lien.type === 'route') {
                <a class="ep__lien" [routerLink]="lien.commandes" [queryParams]="lien.queryParams">Ouvrir la gestion du projet de PV</a>
              }
            }
          </span>
        </p>
      }
    </div>

    <section class="ep-volet" aria-labelledby="ep-volet-titre">
      <h3 class="ep-volet__titre" id="ep-volet-titre">Ce que dit le projet de PV</h3>
      @if (volet().length) {
        <dl class="ep-volet__faits">
          @for (f of volet(); track f.libelle) {
            <div class="ep-volet__fait"><dt>{{ f.libelle }}</dt><dd>{{ f.valeur }}</dd></div>
          }
        </dl>
      }
      <button type="button" class="btn btn-outline btn-sm ep-volet__voir" [disabled]="!pv()" (click)="detailOuvert.set(true)">
        <app-icone nom="eye" [taille]="15" />Voir le projet de PV
      </button>
    </section>

    @if (detailOuvert()) {
      @if (pv(); as p) {
        <app-detail-pv-modal [pv]="p" (fermer)="detailOuvert.set(false)" />
      }
    }
  `,
  styleUrl: './etape-pv.scss',
})
export class EtapePv {
  readonly navette = input.required<NavettePv>();
  /** Localité du dossier : périmètre de l'intérim et Membres co-signataires du visa. */
  readonly idLocalite = input<string | null>(null);
  /** Gestion du projet de PV (`?gerer=<idPv>`) : repli d'un geste indisponible. */
  readonly lienPv = input<CibleGeste | null>(null);
  /** `?geste=` servi à l'arrivée : son bouton reçoit le focus dès que `PvWorkflow` l'offre. */
  readonly gesteFocus = input<FocusNavette | null>(null);
  /** Transition réussie : la page relit le dossier et ses gestes. */
  readonly changed = output<void>();

  private readonly pvs = inject(PvExamenService);
  private readonly details = inject(ExamenDetailService);
  private readonly pieces = inject(ExamenPieceService);

  readonly lecture = signal<LecturePv>({ etat: 'chargement' });
  readonly pv = computed(() => {
    const l = this.lecture();
    return l.etat === 'pret' ? l.pv : null;
  });
  readonly echec = computed(() => {
    const l = this.lecture();
    return l.etat === 'echec' ? l : null;
  });
  /** Observations de l'EXAMEN (points et pièces non conformes) : la suggestion d'avis du visa et le volet. */
  readonly nbObservations = signal<number | null>(null);
  readonly volet = computed(() => voletPv(this.navette().tache, this.nbObservations()));
  readonly detailOuvert = signal(false);

  /** Gestes servis que `PvWorkflow` n'offre pas (relevé après chaque rendu). */
  readonly indisponibles = signal<readonly GesteAFaire[]>([]);
  readonly libellesIndisponibles = computed(() => this.indisponibles().map((g) => LIBELLES_GESTES[g].long).join(', '));

  private readonly zone = viewChild.required<ElementRef<HTMLElement>>('zone');
  private readonly idPv = computed(() => this.navette().idPv);
  private readonly idExamen = computed(() => this.pv()?.idExamen ?? null);
  private readonly lecture$ = new Subject<number | null>();
  private readonly comptage$ = new Subject<number | null>();
  private focusServi: FocusNavette | null = null;

  constructor() {
    this.lecture$
      .pipe(
        switchMap((id) => (id == null ? of<LecturePv>(ECHEC_SANS_REFERENCE) : concat(of<LecturePv>({ etat: 'chargement' }), this.lirePv(id)))),
        takeUntilDestroyed(),
      )
      .subscribe((l) => this.lecture.set(l));

    this.comptage$
      .pipe(
        switchMap((idExamen) => (idExamen == null ? of(null) : this.compterObservations(idExamen))),
        takeUntilDestroyed(),
      )
      .subscribe((n) => this.nbObservations.set(n));

    // Un autre PV (relecture après un geste) : relu. Le même : on garde celui que `PvWorkflow` a rendu.
    effect(() => {
      const id = this.idPv();
      untracked(() => this.lecture$.next(id));
    });
    effect(() => {
      const idExamen = this.idExamen();
      untracked(() => this.comptage$.next(idExamen));
    });

    // Après chaque rendu : ce que `PvWorkflow` offre vraiment (ses boutons apparaissent par `*appCan`,
    // dans un effet), puis le focus demandé par `?geste=`.
    afterEveryRender({
      read: () => {
        const l = this.lecture();
        const servis = this.navette().gestes;
        let manquants: readonly GesteAFaire[] = [];
        if (l.etat === 'echec') manquants = servis;
        else if (l.etat === 'pret') {
          const zone = this.zone().nativeElement;
          const offerts = boutonsWorkflow(zone);
          manquants = servis.filter((g) => !offerts[g]);
          // Même marque que les autres boutons du panneau (`data-geste`) : la barre collante, `?geste=` et la
          // recette retrouvent un geste de navette comme les autres. Posée sur le rendu, jamais dans `PvWorkflow`.
          for (const b of Array.from(zone.querySelectorAll('.pv-workflow__actions > button[data-geste]'))) b.removeAttribute('data-geste');
          for (const [geste, b] of Object.entries(offerts)) b?.setAttribute('data-geste', geste);
          const focus = this.gesteFocus();
          if (focus && focus !== this.focusServi && offerts[focus.geste]) {
            this.focusServi = focus;
            offerts[focus.geste]?.focus();
          }
        }
        if (manquants.join() !== this.indisponibles().join()) this.indisponibles.set(manquants);
      },
    });
  }

  /** Bouton de `PvWorkflow` qui porte ce geste, s'il l'offre (focus depuis la barre collante). */
  bouton(geste: GesteAFaire): HTMLButtonElement | null {
    return boutonsWorkflow(this.zone().nativeElement)[geste] ?? null;
  }

  relire(): void {
    this.lecture$.next(this.idPv());
  }

  /** `PvWorkflow` a fait sa transition et rend le PV à jour : il s'affiche aussitôt, la page relit le reste. */
  apresTransition(pv: PvExamen): void {
    this.lecture.set({ etat: 'pret', pv });
    this.changed.emit();
  }

  private lirePv(id: number): Observable<LecturePv> {
    return this.pvs.lire(id).pipe(
      map((pv): LecturePv => ({ etat: 'pret', pv })),
      catchError((err: unknown) => {
        const status = isApiError(err) ? err.status : 0;
        if (status === 403) return of<LecturePv>({ etat: 'echec', message: "Le projet de PV n'est pas accessible avec votre profil.", aide: 'Les gestes de la navette restent sur leur écran.', reprise: false });
        if (status === 404) return of<LecturePv>({ etat: 'echec', message: "Le projet de PV de ce dossier n'existe plus.", aide: 'Il a peut-être été remplacé : rechargez la page.', reprise: true });
        return of<LecturePv>({ etat: 'echec', message: "Le projet de PV n'a pas pu être chargé.", aide: 'Vérifiez votre connexion, puis réessayez.', reprise: true });
      }),
    );
  }

  /** Même compte que la garde du visa (`validerCoherenceAvis`) et que « Projets de PV » : points et pièces non conformes. */
  private compterObservations(idExamen: number): Observable<number | null> {
    return forkJoin({ details: this.details.listeSilencieuse(), pieces: this.pieces.byExamen(idExamen, true) }).pipe(
      map(({ details, pieces }) => details.filter((d) => d.idExamen === idExamen && !d.conforme).length + pieces.filter((p) => p.idExamen === idExamen && !p.conforme).length),
      catchError(() => of(null)),
    );
  }
}

const ECHEC_SANS_REFERENCE: LecturePv = {
  etat: 'echec',
  message: "Le projet de PV de ce dossier n'est pas référencé.",
  aide: 'Ses gestes restent accessibles depuis la gestion des projets de PV.',
  reprise: false,
};
