import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AFaire, AFaireTache, Dispatch, Dossier, GesteAFaire } from '../../models';
import { DispatchService, DossierService, ReceptionService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { Icone } from '../../shared/ui/icone';
import { DispatchForm, DispatchItem } from '../circuit/dispatch-form';
import { DossierConsultation } from '../circuit/dossier-consultation';
import { ReceptionForm } from '../circuit/reception-form';
import { CompleterPiecesDepotModal } from '../prmp/completer-pieces-depot-modal';
import { DossiersRefreshStore } from '../prmp/dossiers-refresh.store';
import { AFaireApercu } from './a-faire/a-faire-apercu';
import { LIBELLES_SECTIONS } from './a-faire/a-faire-libelles';
import {
  GroupeAFaire,
  LigneAFaire,
  VueAFaire,
  atterrissageHistorique,
  cleTache,
  compteursAffiches,
  estAFaireIndisponible,
  grouperTaches,
  phraseAccueil,
  prenomDe,
} from './a-faire/a-faire-modele';
import { cibleGeste } from './a-faire/a-faire-navigation';

/** Modale existante ouverte par-dessus l'accueil (gestes sans lien profond). */
type ModaleOuverte =
  | { type: 'reception'; dossier: Dossier }
  | { type: 'dispatch'; items: DispatchItem[]; reattribution: Dispatch | null }
  | { type: 'pieces-depot'; dossier: Dossier }
  | { type: 'consultation'; dossier: Dossier };

const VUES: readonly { cle: VueAFaire; libelle: string }[] = [
  { cle: 'urgence', libelle: 'Par urgence' },
  { cle: 'etape', libelle: 'Par étape' },
  { cle: 'localite', libelle: 'Par localité' },
];

/**
 * Accueil « À faire » (refonte ergonomique — maquette `Main` validée le 2026-09-14 ; contrat
 * `docs/demande-backend-2026-09-14-accueil-a-faire.md`, arbitrages adoptés le 2026-09-15).
 *
 * Chaque profil du circuit arrive ici : les gestes que le SERVEUR lui attribue, en sections par geste,
 * une action principale par ligne, un délai en heures ouvrées ; à droite l'aperçu du dossier
 * sélectionné. Le regroupement « Par urgence / Par étape / Par localité » est client, l'ordre des lignes
 * reste celui du serveur. Le bloc délégation (lignes réalisables par délégation, intérim, collègue ou
 * suppléance) est replié, hors compteurs, et ses lignes ne sont demandées qu'au dépli.
 *
 * Monté dans l'espace de chaque profil (`/<espace>/a-faire`) : les gestes restent dans cet espace.
 * Chaque geste ouvre l'écran existant qui le porte (`a-faire-navigation.ts`).
 */
@Component({
  selector: 'app-a-faire',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, Icone, EtatErreur, AFaireApercu, ReceptionForm, DispatchForm, CompleterPiecesDepotModal, DossierConsultation],
  template: `
    <section class="af">
      <header class="af__tete">
        <div>
          <h1 class="af__h1">À faire</h1>
          @if (donnees()) {
            <p class="af__lead">Bonjour {{ prenom() }}. {{ phrase() }}</p>
          }
        </div>
        @if (donnees()?.taches?.length) {
          <div class="af-vues" role="group" aria-label="Regrouper les actions">
            @for (v of vues; track v.cle) {
              <button type="button" class="af-vues__b" [attr.aria-pressed]="vue() === v.cle" (click)="changerVue(v.cle)">{{ v.libelle }}</button>
            }
          </div>
        }
      </header>

      @if (chargement()) {
        <p class="af__info" role="status">Chargement de vos actions…</p>
      } @else if (etat() === 'indisponible') {
        <div class="af-vide">
          <p class="af-vide__t">L'accueil « À faire » n'est pas encore servi par le serveur.</p>
          <p class="af__info">Vos dossiers restent accessibles depuis l'écran habituel.</p>
          <a class="btn btn-primary" [routerLink]="atterrissage">Ouvrir mes dossiers</a>
        </div>
      } @else if (etat() === 'erreur') {
        <app-etat-erreur message="Impossible de charger vos actions." (reessayer)="charger()" />
      } @else if (donnees(); as a) {
        <ul class="af-compteurs" aria-label="Répartition de vos actions">
          @for (c of compteurs(); track c.cle) {
            <li class="af-compteurs__c"><i class="af-pt af-pt--{{ c.genre }}" aria-hidden="true"></i><b>{{ c.nombre }}</b> {{ c.libelle }}</li>
          }
        </ul>

        <div class="af__cols" [class.af__cols--seule]="!tacheSelectionnee()">
          <div class="af-liste">
            @for (g of groupes(); track g.cle) {
              <ng-container [ngTemplateOutlet]="groupeTpl" [ngTemplateOutletContext]="{ $implicit: g, delegation: false }" />
            } @empty {
              <div class="af-vide">
                <p class="af-vide__t">Rien ne vous attend pour le moment.</p>
                <p class="af__info">Les nouveaux gestes apparaîtront ici dès que le circuit vous les attribuera.</p>
              </div>
            }

            @if (a.delegations.total > 0) {
              <section class="af-deleg" aria-labelledby="af-deleg-t">
                <div class="af-deleg__tete">
                  <app-icone nom="deleg" [taille]="18" />
                  <p class="af-deleg__txt" id="af-deleg-t">{{ phraseDelegation() }}</p>
                  <button type="button" class="af-deleg__b" aria-controls="af-deleg-corps" [attr.aria-expanded]="delegationsOuvertes()" (click)="basculerDelegations()">
                    {{ delegationsOuvertes() ? 'Masquer' : 'Afficher' }}
                  </button>
                </div>
                @if (delegationsOuvertes()) {
                  <div class="af-deleg__corps" id="af-deleg-corps">
                    @if (delegationsChargement()) {
                      <p class="af__info" role="status">Chargement…</p>
                    } @else if (delegationsErreur()) {
                      <app-etat-erreur message="Impossible de charger les tâches exerçables par délégation." (reessayer)="chargerDelegations()" />
                    } @else {
                      @for (g of groupesDelegation(); track g.cle) {
                        <ng-container [ngTemplateOutlet]="groupeTpl" [ngTemplateOutletContext]="{ $implicit: g, delegation: true }" />
                      }
                    }
                  </div>
                }
              </section>
            }
          </div>

          @if (tacheSelectionnee(); as t) {
            <aside class="af__apercu" aria-label="Aperçu du dossier sélectionné">
              <app-a-faire-apercu [tache]="t" [occupe]="ouverture() !== null" (agir)="agir(t, $event)" (consulter)="agir(t, 'VOIR')" />
            </aside>
          }
        </div>
      }
    </section>

    <ng-template #groupeTpl let-g let-delegation="delegation">
      <section class="af-sec" [attr.aria-labelledby]="'af-sec-' + (delegation ? 'd-' : '') + g.cle">
        <header class="af-sec__tete">
          <h2 class="af-sec__h" [id]="'af-sec-' + (delegation ? 'd-' : '') + g.cle">{{ g.titre }}</h2>
          <span class="af-sec__n">{{ g.lignes.length }}</span>
          <span class="af-sec__std">{{ g.sousTitre }}</span>
          @if (!delegation && dispatchGroupe(g)) {
            <button type="button" class="af-sec__lot" [disabled]="!coches().size || ouverture() !== null" (click)="dispatcherSelection()">
              <app-icone nom="send" [taille]="15" />Dispatcher la sélection@if (coches().size) { ({{ coches().size }}) }
            </button>
          }
        </header>
        <ul class="af-sec__lignes" [class.af-sec__lignes--coche]="!delegation && dispatchGroupe(g)">
          @for (l of g.lignes; track l.cle) {
            <li class="af-l" [class.af-l--sel]="l.cle === cleSelectionnee()" [class.af-l--coche]="!delegation && dispatchGroupe(g)">
              @if (!delegation && dispatchGroupe(g)) {
                <label class="af-l__coche">
                  <input type="checkbox" [checked]="coches().has(l.cle)" [disabled]="!cochable(l)" (change)="basculerCoche(l)" />
                  <span class="cnm-sr-only">Ajouter {{ l.reference }} au dispatch groupé</span>
                </label>
              }
              <button type="button" class="af-l__corps" [attr.aria-pressed]="l.cle === cleSelectionnee()" (click)="selectionner(l)" (keydown)="naviguerLignes($event)">
                <span class="af-l__id">
                  <!-- Les {{ ' ' }} séparent les mots dans le nom accessible du bouton (sinon « DAOAntananarivo »). -->
                  <span class="af-l__ref" [class.af-l__ref--sans]="l.sansReference">{{ l.reference }}</span>{{ ' ' }}
                  <span class="af-l__ent">{{ l.entite }}</span>{{ ' ' }}
                  <span class="af-l__meta">
                    @if (l.type) { <span class="af-l__type">{{ l.type }}</span>{{ ' ' }} }
                    @if (l.localite) { <span>{{ l.localite }}</span>{{ ' ' }} }
                    @if (l.mode) { <span class="af-l__mode">{{ l.mode }}</span>{{ ' ' }} }
                    <span class="af-l__note">· {{ l.note }}</span>
                  </span>
                </span>{{ ' ' }}
                <span class="af-l__delai">
                  <span class="af-l__dt af-l__dt--{{ l.delai.genre }}">{{ l.delai.texte }}</span>{{ ' ' }}
                  <span class="af-barre" aria-hidden="true"><i class="af-barre__r af-barre__r--{{ l.delai.genre }}" [style.width.%]="l.delai.pourcentage"></i></span>
                  <span class="af-l__ds">{{ l.delai.sousTexte }}</span>
                </span>
              </button>
              <button
                type="button"
                class="af-l__act"
                [class.af-l__act--on]="l.cle === cleSelectionnee()"
                [attr.aria-label]="l.action.libelle + ' — ' + l.reference"
                [disabled]="ouverture() !== null"
                (click)="agir(l.tache, l.tache.geste)"
              >
                <app-icone [nom]="l.action.icone" [taille]="16" /><span aria-hidden="true">{{ l.action.libelle }}</span>
              </button>
            </li>
          }
        </ul>
      </section>
    </ng-template>

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
        @case ('consultation') {
          <app-dossier-consultation [dossier]="dossierDe(m)" (closed)="fermerModale()" />
        }
      }
    }
  `,
  styleUrl: './a-faire.scss',
})
export class AFaireEcran {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Espace du profil (« president », « prmp »…) : les gestes y restent. */
  readonly espace = this.router.url.split('?')[0].split('/')[1] || 'membre';
  readonly atterrissage = atterrissageHistorique(this.espace);
  readonly vues = VUES;

  readonly chargement = signal(true);
  readonly etat = signal<'ok' | 'indisponible' | 'erreur'>('ok');
  readonly donnees = signal<AFaire | null>(null);
  readonly vue = signal<VueAFaire>('urgence');
  /** Ligne sélectionnée (clé `idDossier|section`) ; à défaut, la première affichée. */
  readonly selection = signal<string | null>(null);

  readonly delegationsOuvertes = signal(false);
  readonly delegationsChargement = signal(false);
  readonly delegationsErreur = signal(false);
  private readonly delegationsTaches = signal<AFaireTache[] | null>(null);

  /** Lignes « À dispatcher » cochées pour le dispatch groupé (lot mono-localité, comme « Tous les dossiers »). */
  readonly coches = signal<ReadonlySet<string>>(new Set());
  /** Clé de la ligne dont la modale se prépare (dossier et réception en lecture) ; neutralise les actions. */
  readonly ouverture = signal<string | null>(null);
  readonly modale = signal<ModaleOuverte | null>(null);

  readonly prenom = computed(() => prenomDe(this.auth.nomAffichage() || this.auth.login()));
  readonly phrase = computed(() => {
    const a = this.donnees();
    return a ? phraseAccueil(a.compteurs, this.auth.role()) : '';
  });
  readonly compteurs = computed(() => {
    const a = this.donnees();
    return a ? compteursAffiches(a.compteurs, this.auth.role()) : [];
  });
  readonly groupes = computed<GroupeAFaire[]>(() => {
    const a = this.donnees();
    return a ? grouperTaches(a.taches, this.vue(), a, this.auth.role()) : [];
  });
  readonly groupesDelegation = computed<GroupeAFaire[]>(() =>
    grouperTaches(this.delegationsTaches() ?? [], this.vue() === 'localite' ? 'localite' : 'etape', this.donnees(), this.auth.role()),
  );
  readonly phraseDelegation = computed(() => {
    const d = this.donnees()?.delegations;
    if (!d) return '';
    // « À dispatcher » → « à dispatcher » ; « PV à signer » garde son sigle.
    const minuscule = (t: string): string => (/^\p{Lu}{2}/u.test(t) ? t : t[0].toLowerCase() + t.slice(1));
    const detail = d.parSection.map((s) => `${minuscule(LIBELLES_SECTIONS[s.code].titre)} (${s.total})`).join(', ');
    const tete = d.total > 1 ? `${d.total} tâches peuvent aussi être prises en charge` : '1 tâche peut aussi être prise en charge';
    return `${tete} à un autre titre (délégation, intérim, collègue, suppléance), hors compteurs : ${detail}.`;
  });
  /** Tâche de l'aperçu : la sélection si elle est encore affichée, sinon la première ligne. */
  readonly tacheSelectionnee = computed<AFaireTache | null>(() => {
    const toutes = [...this.groupes().flatMap((g) => g.lignes), ...this.groupesDelegation().flatMap((g) => g.lignes)];
    return (toutes.find((l) => l.cle === this.selection()) ?? this.groupes()[0]?.lignes[0])?.tache ?? null;
  });

  readonly cleSelectionnee = computed(() => {
    const t = this.tacheSelectionnee();
    return t ? cleTache(t) : null;
  });

  constructor() {
    // L'accueil vient de sonder l'endpoint pour décider de l'atterrissage : sa réponse est reprise
    // telle quelle (état de navigation) plutôt que redemandée à la milliseconde près.
    const transmis = this.router.currentNavigation()?.extras.state?.['aFaire'] as AFaire | undefined;
    if (transmis && Array.isArray(transmis.taches)) {
      this.afficher(transmis);
    } else {
      this.charger();
    }
  }

  charger(): void {
    this.chargement.set(true);
    this.dossierService.aFaire(false).subscribe({
      next: (a) => this.afficher(a),
      error: (e: unknown) => {
        this.etat.set(estAFaireIndisponible(e) ? 'indisponible' : 'erreur');
        this.chargement.set(false);
      },
    });
  }

  private afficher(a: AFaire): void {
    this.donnees.set(a);
    this.etat.set('ok');
    this.chargement.set(false);
    // Une ligne cochée qui a quitté la liste (dispatchée entre-temps) sort de la sélection.
    const cles = new Set(a.taches.map(cleTache));
    this.coches.update((s) => new Set([...s].filter((c) => cles.has(c))));
    if (this.delegationsOuvertes()) this.chargerDelegations();
  }

  changerVue(v: VueAFaire): void {
    this.vue.set(v);
  }

  selectionner(l: LigneAFaire): void {
    this.selection.set(l.cle);
  }

  /** Liste au clavier : flèches haut/bas, Début, Fin — le focus suit et sélectionne. */
  naviguerLignes(ev: KeyboardEvent): void {
    const cibles = Array.from(this.hote.nativeElement.querySelectorAll<HTMLButtonElement>('.af-l__corps'));
    const i = cibles.indexOf(ev.currentTarget as HTMLButtonElement);
    const sauts: Record<string, number> = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: cibles.length - 1 };
    const j = sauts[ev.key];
    if (i < 0 || j === undefined || j < 0 || j >= cibles.length) return;
    ev.preventDefault();
    cibles[j].focus();
    cibles[j].click();
  }

  // ── Dispatch groupé ─────────────────────────────────────────────────────────────────────────
  dispatchGroupe(g: GroupeAFaire): boolean {
    return g.section === 'A_DISPATCHER' && g.lignes.length > 1;
  }
  private localiteCochee(): string | null {
    const premiere = this.donnees()?.taches.find((t) => this.coches().has(cleTache(t)));
    return premiere ? premiere.dossier.idLocalite : null;
  }
  cochable(l: LigneAFaire): boolean {
    return !this.coches().size || this.coches().has(l.cle) || l.tache.dossier.idLocalite === this.localiteCochee();
  }
  basculerCoche(l: LigneAFaire): void {
    this.coches.update((s) => {
      const n = new Set(s);
      if (n.has(l.cle)) n.delete(l.cle);
      else n.add(l.cle);
      return n;
    });
  }
  dispatcherSelection(): void {
    const taches = (this.donnees()?.taches ?? []).filter((t) => this.coches().has(cleTache(t)) && t.refs.idReception != null);
    if (!taches.length) return;
    this.ouverture.set('lot');
    forkJoin(taches.map((t) => forkJoin({ dossier: this.dossierService.getById(t.dossier.idDossier), reception: this.receptionService.getById(t.refs.idReception as number) }))).subscribe({
      next: (items) => this.ouvrirModale({ type: 'dispatch', items, reattribution: null }),
      error: () => this.ouverture.set(null),
    });
  }

  // ── Gestes ──────────────────────────────────────────────────────────────────────────────────
  /** Exécute un geste : l'écran existant par son URL, ou sa modale par-dessus l'accueil. */
  agir(t: AFaireTache, geste: GesteAFaire): void {
    if (this.ouverture() !== null) return;
    this.selection.set(cleTache(t));
    const cible = cibleGeste(geste, t, this.espace);
    if (cible.type === 'route') {
      void this.router.navigate(cible.commandes, cible.queryParams ? { queryParams: cible.queryParams } : {});
      return;
    }
    this.ouverture.set(cleTache(t));
    const dossier$ = this.dossierService.getById(t.dossier.idDossier);
    const fin = { error: () => this.ouverture.set(null) };
    switch (cible.modale) {
      case 'reception':
        dossier$.subscribe({ ...fin, next: (dossier) => this.ouvrirModale({ type: 'reception', dossier }) });
        break;
      case 'pieces-depot':
        dossier$.subscribe({ ...fin, next: (dossier) => this.ouvrirModale({ type: 'pieces-depot', dossier }) });
        break;
      case 'consultation':
        dossier$.subscribe({ ...fin, next: (dossier) => this.ouvrirModale({ type: 'consultation', dossier }) });
        break;
      case 'dispatch':
      case 'reattribution':
        forkJoin({
          dossier: dossier$,
          reception: this.receptionService.getById(t.refs.idReception as number),
          dispatch: cible.modale === 'reattribution' ? this.dispatchService.getById(t.refs.idDispatch as number) : of(null),
        }).subscribe({
          ...fin,
          next: ({ dossier, reception, dispatch }) => this.ouvrirModale({ type: 'dispatch', items: [{ dossier, reception }], reattribution: dispatch }),
        });
        break;
    }
  }

  private ouvrirModale(m: ModaleOuverte): void {
    this.ouverture.set(null);
    this.modale.set(m);
  }
  fermerModale(): void {
    this.modale.set(null);
  }
  /** Geste accompli dans une modale : la liste se recalcule (serveur), les pastilles du menu aussi. */
  apresGeste(): void {
    this.modale.set(null);
    this.coches.set(new Set());
    this.dossiersRefresh.notifierChangement();
    this.charger();
  }

  dossierDe(m: ModaleOuverte): Dossier {
    return 'dossier' in m ? m.dossier : m.items[0].dossier;
  }
  itemsDe(m: ModaleOuverte): DispatchItem[] {
    return m.type === 'dispatch' ? m.items : [];
  }
  reattributionDe(m: ModaleOuverte): Dispatch | null {
    return m.type === 'dispatch' ? m.reattribution : null;
  }

  // ── Bloc délégation ─────────────────────────────────────────────────────────────────────────
  basculerDelegations(): void {
    const ouvrir = !this.delegationsOuvertes();
    this.delegationsOuvertes.set(ouvrir);
    if (ouvrir && this.delegationsTaches() === null) this.chargerDelegations();
  }
  chargerDelegations(): void {
    this.delegationsChargement.set(true);
    this.delegationsErreur.set(false);
    this.dossierService.aFaire(true).subscribe({
      next: (a) => {
        this.delegationsTaches.set(a.delegations.taches);
        this.delegationsChargement.set(false);
      },
      error: () => {
        this.delegationsErreur.set(true);
        this.delegationsChargement.set(false);
      },
    });
  }
}
