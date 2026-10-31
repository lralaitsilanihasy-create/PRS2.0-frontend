import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { EvenementHistorique, FiliationDossier, NoeudFiliation } from '../../../models';
import { DossierService } from '../../../services/circuit.services';
import { StatutBadge } from '../../../shared/circuit';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { LienDossier } from '../page-dossier/lien-dossier';

/** Libellé du lien d'un dossier avec son parent (B1). Un code inconnu s'affiche tel quel. */
export const LIBELLES_LIEN: Readonly<Record<string, string>> = {
  RACINE: 'Origine',
  VERSION_SUIVANTE: 'Mise à jour du plan',
  MISE_EN_CONCURRENCE: 'Mise en concurrence',
  MARCHE: 'Dossier de marché',
  MODIFICATION: 'Acte de gestion',
};

/** Libellé d'un élément de l'historique (B2). Un code inconnu s'affiche tel quel. */
export const LIBELLES_HISTORIQUE: Readonly<Record<string, string>> = {
  RECEPTION: 'Réception',
  DISPATCH: 'Dispatch',
  EXAMEN: 'Examen',
  PV: 'Procès-verbal',
  LETTRE_RENVOI: 'Lettre de renvoi',
  TRANSMISSION_SIGMP: 'Transmission SIGMP',
  SUSPENSION: 'Suspension',
  RETRAIT: 'Demande de retrait',
  VERSION_ARCHIVEE: 'Rectification (version archivée)',
  ACTE_GESTION: 'Acte de gestion',
  PUBLICATION_AGPM: 'Publication de l’AGPM',
  PUBLICATION_AVIS: 'Publication de l’avis',
  SEANCE: 'Séance',
  EVALUATION: 'Évaluation des offres',
  ATTRIBUTION: 'Attribution',
  CONTRAT: 'Contrat',
  BON_COMMANDE: 'Bon de commande',
  RECEPTION_COMMANDE: 'Réception de commande',
};

/** Les éléments dont l'`id` désigne un DOSSIER (et mène donc à sa page) : l'attribution (dossier de marché), l'acte de gestion. */
const ID_EST_UN_DOSSIER = new Set(['ATTRIBUTION', 'ACTE_GESTION']);

/**
 * « 2026-10-28T11:20:05 » → « 28/10/2026 11:20 » ; une date seule → « 28/10/2026 ». Minuit pile se lit comme une date seule : le
 * serveur date ainsi les éléments sans heure (examen, PV, publication) — « 00:00 » laisserait croire à une heure réelle.
 */
export function dateHistorique(iso: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(iso);
  if (!m) return iso;
  const date = `${m[3]}/${m[2]}/${m[1]}`;
  const minuit = m[4] === '00' && m[5] === '00' && (m[6] ?? '00') === '00';
  return m[4] && !minuit ? `${date} ${m[4]}:${m[5]}` : date;
}

/** Statuts et avis servis en code (B2) : leur libellé. Un code absent se lit par `codeLisible`. */
const LIBELLES_CODES: Readonly<Record<string, string>> = {
  DEFINITIF: 'Définitif',
  PROJET: 'Projet',
  SIGNE: 'Signé',
  COMPLET: 'Complet',
  INCOMPLET: 'Incomplet',
  ENREGISTREE: 'Enregistrée',
  APPROUVE: 'Approuvé',
  REJETE: 'Rejeté',
  ACCEPTEE: 'Acceptée',
  REFUSEE: 'Refusée',
  EN_ATTENTE: 'En attente',
  EN_ATTENTE_DECISION_PRMP: 'En attente de la décision de la PRMP',
  LEVEE: 'Levée',
  INITIAL: 'initial',
  FAV: 'Favorable',
  FAVR: 'Favorable avec réserves',
  DEF: 'Défavorable',
};
/** Sigles qui restent en capitales quand un code inconnu est mis en phrase. */
const SIGLES = new Set(['PRMP', 'UGPM', 'CNM', 'CC', 'SIGMP', 'AGPM', 'PPM', 'DAO', 'PV', 'CAO', 'AMI']);

/** « EN_ATTENTE_DECISION_PRMP » → son libellé ; un code inconnu → « Code mis en phrase » ; un texte ordinaire passe tel quel. */
export function codeLisible(code: string | null): string {
  if (!code) return '';
  if (LIBELLES_CODES[code]) return LIBELLES_CODES[code];
  if (!/^[A-Z0-9_]+$/.test(code)) return code;
  const phrase = code
    .split('_')
    .map((m) => (SIGLES.has(m) ? m : m.toLowerCase()))
    .join(' ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** Le détail servi peut porter des dates techniques (« levée le 2026-10-28T14:16:09.39 ») et des codes : on les rend lisibles. */
export function detailLisible(detail: string | null): string {
  if (!detail) return '';
  return detail
    .replace(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?/g, (d) => dateHistorique(d))
    .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b(?:APPROUVE|REJETE|INITIAL|COMPLET|INCOMPLET|SIGNE|DEFINITIF|LEVEE)\b/g, (c) => codeLisible(c));
}

/** Nombre de dossiers visibles de l'arbre (les nœuds masqués ne comptent pas). */
export function compterDossiers(n: NoeudFiliation): number {
  return (n.masque ? 0 : 1) + n.enfants.reduce((t, e) => t + compterDossiers(e), 0);
}

type EtatHistorique = { etat: 'chargement' } | { etat: 'erreur' } | { etat: 'pret'; evenements: EvenementHistorique[] };

/**
 * « Historique du dossier » (pilote, 31/10/2026 — demande `docs/demande-backend-2026-10-31-filiation-dossier.md`).
 *
 * À gauche, l'ARBRE des dossiers qui s'attachent à celui-ci (B1 : versions du plan, mise en concurrence d'une ligne, dossiers de marché
 * par lot, actes de gestion), le dossier courant en évidence ; à droite, tout ce qui s'est passé sur le dossier CHOISI (B2 : réception,
 * PV, lettres de renvoi, attribution…), du plus ancien au plus récent. L'historique d'un dossier n'est demandé qu'à son choix, une fois.
 */
@Component({
  selector: 'app-historique-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, StatutBadge, EtatErreur],
  template: `
    @if (etat() !== 'indisponible') {
    <section class="hd" aria-labelledby="hd-titre">
      <h2 id="hd-titre" class="hd__titre">Historique du dossier</h2>
      @if (etat() === 'chargement') {
        <p class="hd__info" role="status">Chargement de l’historique…</p>
      } @else if (etat() === 'erreur') {
        <app-etat-erreur message="L’historique du dossier n’a pas pu être chargé." (reessayer)="charger(idDossier())" />
      } @else if (filiation(); as f) {
        <div class="hd__grille">
          <div class="hd__arbre-zone">
            <p class="hd__info">{{ nbDossiers() }} dossier{{ nbDossiers() > 1 ? 's' : '' }} lié{{ nbDossiers() > 1 ? 's' : '' }} — choisissez-en un pour voir son historique.</p>
            <ul class="hd__arbre" aria-label="Dossiers liés">
              <ng-container [ngTemplateOutlet]="noeudTpl" [ngTemplateOutletContext]="{ $implicit: f.racine }" />
            </ul>
          </div>
          <div class="hd__evts" aria-live="polite">
            @if (noeudChoisi(); as n) {
              <h3 class="hd__evts-titre">{{ n.refeDossier || 'Dossier #' + n.idDossier }}</h3>
            }
            @switch (historiqueChoisi()?.etat) {
              @case ('chargement') { <p class="hd__info" role="status">Chargement…</p> }
              @case ('erreur') {
                <app-etat-erreur message="L’historique de ce dossier n’a pas pu être chargé." (reessayer)="rechargerChoisi()" />
              }
              @case ('pret') {
                @if (evenementsChoisis().length) {
                  <ol class="hd__liste">
                    @for (e of evenementsChoisis(); track $index) {
                      <li class="hd__evt">
                        <span class="hd__date">{{ date(e.date) }}</span>
                        <span class="hd__corps">
                          <span class="hd__type">{{ libelleType(e.type) }}@if (e.lot != null) { · lot {{ e.lot }} }@if (e.numero != null) { · version {{ e.numero }} }</span>
                          @if (e.reference) {
                            @if (e.id != null && idEstUnDossier(e.type)) {
                              <a class="hd__ref" [routerLink]="lien.commandes(e.id)" [queryParams]="lien.params()">{{ e.reference }}</a>
                            } @else {
                              <span class="hd__ref">{{ e.reference }}</span>
                            }
                          }
                          @if (e.statut || e.avis) {
                            <span class="hd__meta">@if (e.statut) { {{ code(e.statut) }} }@if (e.statut && e.avis) { · }@if (e.avis) { avis {{ code(e.avis).toLowerCase() }} }</span>
                          }
                          @if (e.acteur || e.detail) {
                            <span class="hd__meta">@if (e.acteur) { {{ e.acteur }} }@if (e.acteur && e.detail) { — }{{ detail(e.detail) }}</span>
                          }
                        </span>
                      </li>
                    }
                  </ol>
                } @else {
                  <p class="hd__info">Rien n’est encore enregistré sur ce dossier.</p>
                }
              }
            }
          </div>
        </div>
      }
    </section>
    }

    <ng-template #noeudTpl let-n>
      <li class="hd__noeud">
        @if (n.masque) {
          <span class="hd__masque">{{ libelleLien(n.lien) }} — dossier hors de votre périmètre</span>
        } @else {
          <div class="hd__ligne-noeud">
            <button type="button" class="hd__choix" [class.hd__choix--on]="choisi() === n.idDossier" [attr.aria-pressed]="choisi() === n.idDossier"
                    (click)="choisir(n.idDossier)">
              <span class="hd__lien">{{ libelleLien(n.lien) }}@if (n.lot != null) { · lot {{ n.lot }} }</span>
              <span class="hd__num">{{ n.refeDossier || 'Brouillon #' + n.idDossier }}</span>
              @if (n.ligne) { <span class="hd__ligne">ligne {{ n.ligne.idDetail }}@if (n.ligne.objet) { — {{ n.ligne.objet }} }</span> }
            </button>
            <span class="hd__etat">
              <app-statut-badge [statut]="n.statut" />
              @if (n.idDossier === demande()) {
                <span class="hd__courant">ce dossier</span>
              } @else if (lien.disponible()) {
                <a class="hd__ouvrir" [routerLink]="lien.commandes(n.idDossier)" [queryParams]="lien.params()" [attr.aria-label]="'Ouvrir la page du dossier ' + (n.refeDossier || n.idDossier)">Ouvrir</a>
              }
            </span>
          </div>
        }
        @if (n.enfants.length) {
          <ul class="hd__enfants">
            @for (e of n.enfants; track $index) {
              <ng-container [ngTemplateOutlet]="noeudTpl" [ngTemplateOutletContext]="{ $implicit: e }" />
            }
          </ul>
        }
      </li>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .hd { background: var(--carte-fond); border: 1px solid var(--bordure); border-radius: 4px; padding: 12px 14px; }
    .hd__titre { margin: 0 0 8px; font-size: 14px; font-weight: 500; }
    .hd__info { margin: 0 0 8px; font-size: var(--text-sm); color: var(--texte-secondaire); }
    .hd__grille { display: grid; grid-template-columns: minmax(16rem, 26rem) minmax(0, 1fr); gap: 16px; align-items: start; }
    .hd__arbre, .hd__enfants { list-style: none; margin: 0; padding: 0; }
    .hd__enfants { margin-left: 14px; padding-left: 10px; border-left: 1px solid var(--bordure); }
    .hd__noeud { margin: 0 0 4px; }
    .hd__ligne-noeud { display: flex; align-items: flex-start; gap: 8px; }
    .hd__choix {
      all: unset; box-sizing: border-box; flex: 1; min-width: 0; cursor: pointer;
      display: flex; flex-direction: column; gap: 1px; padding: 5px 8px; border-radius: 4px; border: 1px solid transparent;
    }
    .hd__choix:hover { background: var(--ligne-survol); }
    .hd__choix--on { background: var(--onglet-actif-fond); border-color: var(--bordure); }
    .hd__choix:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: 1px; }
    .hd__lien, .hd__ligne { font-size: 11px; color: var(--texte-secondaire); }
    .hd__num { font-weight: 500; overflow-wrap: anywhere; }
    .hd__etat { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; padding-top: 5px; flex: none; }
    .hd__courant { font-size: 11px; color: var(--texte-secondaire); }
    .hd__ouvrir { font-size: 12px; color: var(--texte); }
    .hd__masque { display: block; padding: 5px 8px; font-size: 12px; font-style: italic; color: var(--texte-secondaire); }
    .hd__evts { min-width: 0; border-left: 1px solid var(--bordure); padding-left: 16px; }
    .hd__evts-titre { margin: 0 0 8px; font-size: 13px; font-weight: 500; }
    .hd__liste { list-style: none; margin: 0; padding: 0; }
    .hd__evt { display: grid; grid-template-columns: 8.5rem minmax(0, 1fr); gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--bordure); }
    .hd__evt:last-child { border-bottom: 0; }
    .hd__date { font-size: 12px; color: var(--texte-secondaire); white-space: nowrap; }
    .hd__corps { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .hd__type { font-weight: 500; }
    .hd__ref { overflow-wrap: anywhere; color: var(--texte); }
    .hd__meta { font-size: 12px; color: var(--texte-secondaire); overflow-wrap: anywhere; }
    @media (max-width: 64rem) {
      .hd__grille { grid-template-columns: minmax(0, 1fr); }
      .hd__evts { border-left: 0; padding-left: 0; border-top: 1px solid var(--bordure); padding-top: 10px; }
    }
  `,
})
export class HistoriqueDossier {
  private readonly service = inject(DossierService);
  readonly lien = inject(LienDossier);

  /** Le dossier de la page (ou du volet) : l'arbre est celui auquel il appartient. */
  readonly idDossier = input.required<number>();

  /** `indisponible` : la route n'est pas servie par ce serveur (404) — le bloc ne s'affiche pas, plutôt qu'une erreur sur chaque page. */
  readonly etat = signal<'chargement' | 'erreur' | 'pret' | 'indisponible'>('chargement');
  readonly filiation = signal<FiliationDossier | null>(null);
  /** Le dossier dont l'historique est affiché (le dossier courant d'abord). */
  readonly choisi = signal<number | null>(null);
  private readonly historiques = signal<ReadonlyMap<number, EtatHistorique>>(new Map());

  readonly demande = computed(() => this.filiation()?.idDossierDemande ?? null);
  readonly nbDossiers = computed(() => {
    const f = this.filiation();
    return f ? compterDossiers(f.racine) : 0;
  });
  readonly noeudChoisi = computed(() => {
    const f = this.filiation();
    const id = this.choisi();
    if (!f || id == null) return null;
    const chercher = (n: NoeudFiliation): NoeudFiliation | null => (n.idDossier === id ? n : n.enfants.map(chercher).find((x) => x) ?? null);
    return chercher(f.racine);
  });
  readonly historiqueChoisi = computed(() => {
    const id = this.choisi();
    return id == null ? null : (this.historiques().get(id) ?? null);
  });
  readonly evenementsChoisis = computed(() => {
    const h = this.historiqueChoisi();
    return h?.etat === 'pret' ? h.evenements : [];
  });

  private abonnements = new Subscription();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abonnements.unsubscribe());
    effect(() => {
      const id = this.idDossier();
      untracked(() => this.charger(id));
    });
  }

  charger(id: number): void {
    this.abonnements.unsubscribe();
    this.abonnements = new Subscription();
    this.etat.set('chargement');
    this.historiques.set(new Map());
    this.abonnements.add(
      this.service.filiation(id).subscribe({
        next: (f) => {
          // Une réponse sans arbre (serveur antérieur, doublure) : rien à montrer.
          if (!f?.racine) {
            this.etat.set('indisponible');
            return;
          }
          this.filiation.set(f);
          this.etat.set('pret');
          this.choisir(f.idDossierDemande);
        },
        error: (e: unknown) => this.etat.set(e instanceof HttpErrorResponse && e.status === 404 ? 'indisponible' : 'erreur'),
      }),
    );
  }

  /** Affiche l'historique d'un dossier de l'arbre ; il n'est demandé au serveur qu'une fois. */
  choisir(id: number | null): void {
    if (id == null) return;
    this.choisi.set(id);
    const deja = this.historiques().get(id);
    if (deja && deja.etat !== 'erreur') return;
    this.poser(id, { etat: 'chargement' });
    this.abonnements.add(
      this.service.historique(id).subscribe({
        next: (evenements) => this.poser(id, { etat: 'pret', evenements: Array.isArray(evenements) ? evenements : [] }),
        error: () => this.poser(id, { etat: 'erreur' }),
      }),
    );
  }

  rechargerChoisi(): void {
    const id = this.choisi();
    if (id == null) return;
    this.poser(id, { etat: 'erreur' });
    this.choisir(id);
  }

  libelleLien(code: string): string {
    return LIBELLES_LIEN[code] ?? code;
  }
  libelleType(code: string): string {
    return LIBELLES_HISTORIQUE[code] ?? code;
  }
  idEstUnDossier(type: string): boolean {
    return ID_EST_UN_DOSSIER.has(type);
  }
  date(iso: string | null): string {
    return dateHistorique(iso);
  }
  code(c: string | null): string {
    return codeLisible(c);
  }
  detail(d: string | null): string {
    return detailLisible(d);
  }

  private poser(id: number, e: EtatHistorique): void {
    const m = new Map(this.historiques());
    m.set(id, e);
    this.historiques.set(m);
  }
}
