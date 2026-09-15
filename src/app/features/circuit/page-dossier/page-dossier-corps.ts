import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, UrlTree } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { Dispatch, Dossier } from '../../../models';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { ChronometrageDossier, StatutBadge } from '../../../shared/circuit';
import { jourSemaineDate } from '../../../shared/circuit/frise-delai';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { Icone } from '../../../shared/ui/icone';
import { CompleterPiecesDepotModal } from '../../prmp/completer-pieces-depot-modal';
import { DossiersRefreshStore } from '../../prmp/dossiers-refresh.store';
import { DispatchForm, DispatchItem } from '../dispatch-form';
import { DossierContenuStore } from '../dossier/dossier-contenu.store';
import { DossierDocuments } from '../dossier/dossier-documents';
import { DossierIdentite } from '../dossier/dossier-identite';
import { DossierJournal } from '../dossier/dossier-journal';
import { ModaleGeste, OuvrirGeste } from '../gestes/ouvrir-geste';
import { ReceptionForm } from '../reception-form';
import { BarreCollante } from './barre-collante';
import { FocusNavette } from './etape-pv';
import { EtapeCourante } from './etape-courante';
import { EtatGestes, GesteBouton, VueEtape, ciblePage, famillePage, gesteDemande, montantGestes, vueEtape } from './etape-courante-modele';
import { RetourPage, SuiteGeste, etapesPage, referenceDossier } from './page-dossier-modele';

/** Hauteur de la barre du haut de l'application (fixe, `.topbar`). */
const HAUT_TOPBAR = 48;

/**
 * Corps de la page dossier (lots L4-F2 et F3), une fois le dossier ouvert : fil d'Ariane et outils,
 * identité, frise des sept étapes, étape en cours et ses gestes, documents. Fournit le
 * `DossierContenuStore` — la même vague et les mêmes règles par profil que la modale de consultation.
 *
 * Gestes (lot F3, plan L4 §3.3) : le panneau n'affiche que ce que sert `GET /api/dossiers/{id}/gestes`.
 * Numérotation, dispatch, réattribution et pièces du dépôt s'ouvrent en modale par-dessus la page ; les
 * autres mènent à leur écran de travail, avec `returnUrl` vers la page. Après un geste réussi, la page
 * relit le dossier et ses gestes (`gesteReussi`), les pastilles du menu se recalculent, on reste ici.
 * Lot F4 : la navette du projet de PV se joue dans le panneau (`EtapePv`) ; sa transition suit le même chemin.
 * Lot F5 : la décision de retrait aussi (`DecisionRetrait`) ; la PRMP y lit l'état de sa demande.
 *
 * Règle C2 (audit 2026-09-14) : pour la PRMP et l'UGPM, ni journal ni chronométrage (le store ne les
 * demande pas, les boutons n'existent pas), la frise ne porte que des dates, et le panneau ne dit ni qui
 * porte l'étape à la CNM ni son délai — la pause seule.
 */
@Component({
  selector: 'app-page-dossier-corps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Icone,
    EtatErreur,
    StatutBadge,
    ModaleDirective,
    ChronometrageDossier,
    DossierIdentite,
    DossierDocuments,
    DossierJournal,
    EtapeCourante,
    BarreCollante,
    ReceptionForm,
    DispatchForm,
    CompleterPiecesDepotModal,
  ],
  providers: [DossierContenuStore],
  host: { '[class.pd--barre]': 'barreVisible()' },
  template: `
    <div class="pd">
      @if (vue(); as v) {
        <app-barre-collante [reference]="reference()" [vue]="v" [visible]="barreVisible()" [occupe]="occupe()" (agir)="agir($event)" />
      }
      <div class="pd-fil">
        <nav class="pd-ariane" aria-label="Fil d'Ariane">
          <a class="pd-ariane__retour" [routerLink]="retourLien()"><app-icone nom="chevl" [taille]="15" />{{ retour().libelle }}</a>
          <app-icone class="pd-ariane__sep" nom="chev" [taille]="13" />
          <span class="pd-ariane__ici" aria-current="page">{{ reference() }}</span>
        </nav>
        <!-- Restitutions INTERNES CNM (demande pilote du 06/09) : jamais pour la PRMP ni l'UGPM. -->
        @if (contenu.restitutionsVisibles() && !contenu.loading()) {
          <div class="pd-outils">
            @if (contenu.journalVisible().length) {
              <button type="button" class="btn btn-outline btn-sm pd-outil" (click)="journalOuvert.set(true)">
                <app-icone nom="history" [taille]="16" />Journal
                <span class="pd-outil__n">{{ contenu.journalVisible().length }}<span class="cnm-sr-only"> actions</span></span>
              </button>
            }
            @if (contenu.chronoDispo()) {
              <button type="button" class="btn btn-outline btn-sm pd-outil" (click)="chronoOuvert.set(true)">
                <app-icone nom="clock" [taille]="16" />Délais
              </button>
            }
          </div>
        }
      </div>

      <header class="pd-tete">
        <div class="pd-id">
          <!-- Point de reprise du focus (recette L4-Q2, défaut (e)) : le titre de l'étape quand il existe,
               sinon celui de la page — un seul data-focus-repli à l'écran, cf. ModaleDirective. -->
          <h1 class="pd-ref" tabindex="-1" [attr.data-focus-repli]="vue() ? null : ''" [class.pd-ref--sans]="!dossier().refeDossier">{{ reference() }}</h1>
          <p class="pd-ent">
            @if (!contenu.loading()) {
              {{ ligneEntite() }}
            }
          </p>
          <div class="pd-puces">
            <app-statut-badge [statut]="dossier().statut" />
            @if (sousType()) {
              <span class="pd-puce">{{ sousType() }}</span>
            }
            @if (!contenu.loading()) {
              <span class="pd-puce">{{ contenu.localiteLabel() }}</span>
              @if (contenu.estPpm()) {
                <span class="pd-puce">{{ contenu.marches().length }} {{ contenu.marches().length > 1 ? 'lignes' : 'ligne' }}@if (montant()) { · {{ montant() }}}</span>
              }
              @if (contenu.montrerReferencePpm() && contenu.ppm()?.reference) {
                <span class="pd-puce" title="Référence du plan chez la PRMP">Réf. PRMP {{ contenu.ppm()?.reference }}</span>
              }
              <button type="button" class="pd-deplier" [attr.aria-expanded]="identiteOuverte()" (click)="identiteOuverte.set(!identiteOuverte())">
                Identité du dossier<app-icone [nom]="identiteOuverte() ? 'chevd' : 'chev'" [taille]="14" />
              </button>
            }
          </div>
        </div>
        @if (finPrevue()) {
          <p class="pd-fin">Fin de traitement prévue<b>{{ finPrevue() }}</b></p>
        }
      </header>

      @if (identiteOuverte() && !contenu.loading()) {
        <app-dossier-identite class="pd-identite" />
      }

      <ol class="pd-frise" aria-label="Étapes du circuit">
        @for (e of etapes(); track e.cle) {
          <li class="pd-etape pd-etape--{{ e.etat }}" [attr.title]="e.infobulle">
            <span class="pd-etape__pt" aria-hidden="true">
              @if (e.etat === 'faite') {
                <app-icone nom="check" [taille]="15" />
              } @else {
                {{ e.numero }}
              }
            </span>
            <span class="pd-etape__l">{{ e.libelle }}</span>
            <span class="pd-etape__d" aria-hidden="true">{{ e.date }}</span>
            <span class="cnm-sr-only">{{ e.lu }}</span>
          </li>
        }
      </ol>

      <!-- Lot F3 : l'étape en cours et les gestes servis par GET /api/dossiers/{id}/gestes. -->
      @switch (gestes().etat) {
        @case ('chargement') {
          <div class="pd-etape-attente" role="status">
            <div class="spinner" aria-hidden="true"></div>
            <span>Chargement de l'étape en cours…</span>
          </div>
        }
        @case ('indisponible') {
          <p class="pd-lecture-seule">
            <app-icone nom="eye" [taille]="16" />Lecture seule : les gestes de ce dossier ne sont pas servis ici. Ils restent accessibles depuis vos écrans habituels.
          </p>
        }
        @case ('echec') {
          <app-etat-erreur class="pd-etape-erreur" message="L'étape en cours n'a pas pu être chargée." aide="Le dossier reste consultable ci-dessous." (reessayer)="relancerGestes.emit()" />
        }
        @case ('pret') {
          @if (vue(); as v) {
            <app-etape-courante #panneau [vue]="v" [occupe]="occupe()" [idLocalite]="dossier().idLocalite ?? null" [lienPv]="lienPv()"
              [gesteFocus]="focusNavette()" [suiviRetrait]="suiviRetrait()" (agir)="agir($event)" (navetteChangee)="apresGeste()"
              (retraitDecide)="apresGeste($event === 'acceptee' ? 'retrait-accepte' : null)" />
          }
        }
      }

      <section class="pd-documents" aria-label="Documents du dossier">
        @if (contenu.loading()) {
          <div class="pd-attente" role="status">
            <div class="spinner" aria-hidden="true"></div>
            <span class="cnm-sr-only">Chargement des documents du dossier…</span>
          </div>
        } @else {
          <app-dossier-documents [enteteCollante]="true" />
        }
      </section>
    </div>

    <!-- Gestes en modale par-dessus la page (plan L4 §4) : mêmes composants que l'accueil « À faire ». -->
    @if (modale(); as m) {
      @switch (m.type) {
        @case ('reception') {
          <app-reception-form [dossier]="dossierDe(m)" (closed)="fermerModale()" (saved)="apresGeste()" />
        }
        @case ('dispatch') {
          <app-dispatch-form [items]="itemsDe(m)" [reattribution]="reattributionDe(m)" (closed)="fermerModale()" (saved)="apresGeste()" />
        }
        @case ('pieces-depot') {
          <app-completer-pieces-depot-modal [dossier]="dossierDe(m)" (fermer)="fermerModale()" (transmis)="apresGeste()" />
        }
      }
    }

    <!-- Sous-dialogues des restitutions (demande pilote du 06/09) : mêmes blocs que la modale. -->
    @if (chronoOuvert()) {
      <div class="modal-backdrop">
        <div class="modal modal-lg pd-sousmodal" role="dialog" aria-modal="true"
          [attr.aria-label]="'Chronométrage et délais — ' + reference()"
          appModale appModaleClicExterieur (appModaleFermer)="chronoOuvert.set(false)">
          <div class="modal-header">
            <h2 class="modal-title"><app-icone nom="clock" [taille]="18" />Chronométrage et délais</h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="chronoOuvert.set(false)">✕</button>
          </div>
          <div class="modal-body pd-sousmodal__corps">
            @if (contenu.chronoDossier(); as chrono) {
              <app-chronometrage-dossier [idDossier]="dossier().idDossier" [donnees]="chrono" />
            }
          </div>
        </div>
      </div>
    }
    @if (journalOuvert()) {
      <div class="modal-backdrop">
        <div class="modal modal-lg pd-sousmodal" role="dialog" aria-modal="true"
          [attr.aria-label]="'Journal des actions — ' + reference()"
          appModale appModaleClicExterieur (appModaleFermer)="journalOuvert.set(false)">
          <div class="modal-header">
            <h2 class="modal-title"><app-icone nom="history" [taille]="18" />Journal des actions
              <span class="section-count">{{ contenu.journalVisible().length }} action(s)</span></h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="journalOuvert.set(false)">✕</button>
          </div>
          <div class="modal-body pd-sousmodal__corps">
            <app-dossier-journal />
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './page-dossier.scss',
})
export class PageDossierCorps implements OnInit {
  readonly dossier = input.required<Dossier>();
  readonly retour = input.required<RetourPage>();
  readonly retourLien = input.required<UrlTree>();
  /** Lecture de `GET /api/dossiers/{id}/gestes`, conduite par la page. */
  readonly gestes = input<EtatGestes>({ etat: 'chargement' });
  /** La page relit le dossier et ses gestes après un geste : les boutons attendent. */
  readonly relecture = input(false);
  /** `?geste=` de l'URL : déclenché à l'arrivée seulement si le serveur le sert. */
  readonly gesteDemande = input<string | null>(null);

  /** Un geste a réussi : relire le dossier et ses gestes (relecture légère, sans recréer la page). */
  readonly gesteReussi = output<SuiteGeste>();
  readonly relancerGestes = output<void>();
  /** `?geste=` a été lu (servi ou non) : la page le retire de l'URL. */
  readonly gesteTraite = output<void>();

  protected readonly contenu = inject(DossierContenuStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ouvrirGeste = inject(OuvrirGeste);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly destroyRef = inject(DestroyRef);

  /** Bloc d'identité détaillé (exercice, signataire, mise à jour) : replié à l'ouverture, comme la modale. */
  readonly identiteOuverte = signal(false);
  readonly journalOuvert = signal(false);
  readonly chronoOuvert = signal(false);

  /** Espace du profil (« president », « prmp »…) : les gestes y restent. */
  private readonly espace = this.router.url.split(/[?#]/)[0].split('/')[1] || '';

  readonly reference = computed(() => referenceDossier(this.dossier()));
  readonly sousType = computed(() => this.dossier().idSousType ?? this.dossier().idTypeDossier ?? '');
  /** « Ministère … · Dossier de planification 2026 » — libellés résolus par la vague du store. */
  readonly ligneEntite = computed(() => {
    const exercice = this.contenu.ppm()?.exercice;
    return [this.contenu.entiteLabel(), `${this.contenu.typeLabel()}${exercice ? ' ' + exercice : ''}`].filter((x) => x && x !== '—').join(' · ');
  });
  /** Frise : acteurs au survol pour la CNM, date seule pour la PRMP et l'UGPM. */
  readonly etapes = computed(() => etapesPage(this.dossier(), this.contenu.restitutionsVisibles()));
  readonly finPrevue = computed(() => jourSemaineDate(this.dossier().datePrevisionnelleFin));

  // ── Étape en cours et gestes (lot F3) ────────────────────────────────────────────────────────
  readonly vue = computed<VueEtape | null>(() => {
    const g = this.gestes();
    return g.etat === 'pret' ? vueEtape(this.dossier(), g.gestes, this.auth.role()) : null;
  });
  readonly montant = computed(() => {
    const g = this.gestes();
    return g.etat === 'pret' ? montantGestes(g.gestes) : '';
  });
  /** Clé du geste dont la modale se prépare (lectures en cours). */
  readonly ouverture = signal<string | null>(null);
  readonly modale = signal<ModaleGeste | null>(null);
  readonly occupe = computed(() => this.ouverture() !== null || this.relecture());
  /** Lot F4 — gestion du projet de PV : lien de repli d'un geste de navette que `PvWorkflow` n'offre pas. */
  readonly lienPv = computed(() => {
    const n = this.vue()?.navette;
    return n ? ciblePage(n.gestes[0], n.tache, this.espace, this.urlPage()) : null;
  });
  /** Lot F4 — `?geste=` de navette servi : focus sur son bouton dans `PvWorkflow`. */
  readonly focusNavette = signal<FocusNavette | null>(null);
  /** Lot F5 — la PRMP suit sa demande de retrait sur la page ; l'UGPM n'a pas l'écran des demandes. */
  readonly suiviRetrait = computed(() => (this.auth.role() === 'PRMP' ? this.dossier() : null));

  private readonly panneau = viewChild('panneau', { read: EtapeCourante });
  private readonly panneauEl = viewChild('panneau', { read: ElementRef });
  private readonly barre = viewChild(BarreCollante);
  /** Le panneau est sorti de l'écran par le haut : la barre collante prend le relais. */
  readonly barreVisible = signal(false);
  private gesteDemandeLu = false;
  private titreApresGeste = false;

  constructor() {
    // Barre collante : visible quand le panneau a entièrement quitté l'écran PAR LE HAUT (sous la barre
    // du haut). Sans IntersectionObserver (tests, vieux navigateur), la barre reste repliée.
    effect((nettoyer) => {
      const el = this.panneauEl()?.nativeElement as HTMLElement | undefined;
      if (!el || typeof IntersectionObserver === 'undefined') {
        untracked(() => this.barreVisible.set(false));
        return;
      }
      const observateur = new IntersectionObserver(
        ([entree]) => {
          const visible = !entree.isIntersecting && entree.boundingClientRect.bottom <= HAUT_TOPBAR;
          // Le focus était dans la barre qui se replie : il revient au panneau, rien ne se perd.
          if (!visible && this.barre()?.contientFocus()) this.panneau()?.bouton()?.focus();
          this.barreVisible.set(visible);
        },
        { rootMargin: `-${HAUT_TOPBAR}px 0px 0px 0px`, threshold: 0 },
      );
      observateur.observe(el);
      nettoyer(() => observateur.disconnect());
    });

    // `?geste=` : lu une fois, dès que la réponse du serveur est connue. Seul un geste SERVI compte.
    effect(() => {
      const etat = this.gestes().etat;
      const brut = this.gesteDemande();
      const vue = this.vue();
      if (this.gesteDemandeLu || etat === 'chargement' || !brut) return;
      this.gesteDemandeLu = true;
      untracked(() => {
        this.gesteTraite.emit();
        const bouton = vue ? gesteDemande(brut, [vue.principal, ...vue.secondaires].filter((b): b is GesteBouton => b !== null)) : null;
        if (!bouton) return;
        // Geste court : sa modale s'ouvre. Écran de travail : le bouton reçoit le focus, sans quitter la page.
        // Navette du PV : le bouton de `PvWorkflow`, dès que le projet de PV est lu — rien ne se déclenche
        // (soumettre, accepter et signer partent sans confirmation). Décision de retrait : le formulaire, pas
        // « Accepter le retrait » — une touche Entrée ne doit pas renvoyer un dossier en brouillon.
        const famille = famillePage(bouton.geste);
        if (famille === 'modale') this.agir(bouton);
        else if (famille === 'navette') this.focusNavette.set({ geste: bouton.geste });
        else if (famille === 'retrait') setTimeout(() => this.panneau()?.zoneRetrait()?.focus());
        else setTimeout(() => this.panneau()?.bouton(bouton.geste)?.focus());
      });
    });

    // Après un geste : le titre de l'étape reçoit le focus quand la relecture a rendu le panneau à jour.
    effect(() => {
      const pret = this.gestes().etat === 'pret' && !this.relecture();
      if (!pret || !this.titreApresGeste) return;
      this.titreApresGeste = false;
      setTimeout(() => this.panneauEl()?.nativeElement.querySelector('.ec__titre')?.focus());
    });
  }

  ngOnInit(): void {
    this.contenu.charger(this.dossier);
  }

  /** Exécute un geste servi : sa modale par-dessus la page, ou son écran de travail. */
  agir(b: GesteBouton): void {
    if (this.occupe() || this.modale()) return;
    // Navette du PV (lot F4) et décision de retrait (lot F5) : elles se jouent dans le panneau — la barre
    // collante y ramène le focus.
    if (['navette', 'retrait'].includes(famillePage(b.geste))) {
      this.panneau()?.bouton(b.geste)?.focus();
      return;
    }
    const cible = ciblePage(b.geste, b.tache, this.espace, this.urlPage());
    if (!cible) return;
    if (cible.type === 'route') {
      void this.router.navigate(cible.commandes, cible.queryParams ? { queryParams: cible.queryParams } : {});
      return;
    }
    this.ouverture.set(b.cle);
    this.ouvrirGeste
      .preparer(cible.modale, b.tache)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (m) => {
          this.ouverture.set(null);
          this.modale.set(m);
        },
        error: () => this.ouverture.set(null),
      });
  }

  fermerModale(): void {
    this.modale.set(null);
  }

  /** Geste accompli dans une modale : on reste sur la page, qui relit le dossier et ses gestes. */
  apresGeste(suite: SuiteGeste = null): void {
    this.modale.set(null);
    this.titreApresGeste = true;
    // Recette L4-Q2, défaut (m) : le geste vient d'écrire au journal et de clore un passage du
    // chronométrage — les deux restitutions se relisent, le reste de la vague reste en place.
    this.contenu.rafraichirRestitutions();
    this.dossiersRefresh.notifierChangement();
    this.gesteReussi.emit(suite);
  }

  /** URL de la page, `?geste=` retiré : le retour des écrans de travail. */
  private urlPage(): string {
    const arbre = this.router.parseUrl(this.router.url);
    const parametres = { ...arbre.queryParams };
    delete parametres['geste'];
    return this.router.serializeUrl(new UrlTree(arbre.root, parametres, arbre.fragment));
  }

  dossierDe(m: ModaleGeste): Dossier {
    return 'dossier' in m ? m.dossier : m.items[0].dossier;
  }
  itemsDe(m: ModaleGeste): DispatchItem[] {
    return m.type === 'dispatch' ? m.items : [];
  }
  reattributionDe(m: ModaleGeste): Dispatch | null {
    return m.type === 'dispatch' ? m.reattribution : null;
  }
}
