import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { FiliationDossier, NoeudFiliation } from '../../../models';
import { DossierService } from '../../../services/circuit.services';
import { StatutBadge } from '../../../shared/circuit';
import { LIBELLES_LIEN } from '../dossier/historique-dossier';
import { LienDossier } from './lien-dossier';

/** Le chemin de la racine au dossier demandé, puis les dossiers qui en découlent directement (marchés d'un DAO, actes d'un marché). */
export function cheminDeFiliation(f: FiliationDossier): { chemin: NoeudFiliation[]; suites: NoeudFiliation[] } {
  const chercher = (n: NoeudFiliation, trace: NoeudFiliation[]): NoeudFiliation[] | null => {
    const ici = [...trace, n];
    if (!n.masque && n.idDossier === f.idDossierDemande) return ici;
    for (const e of n.enfants) {
      const r = chercher(e, ici);
      if (r) return r;
    }
    return null;
  };
  const chemin = chercher(f.racine, []) ?? [];
  const courant = chemin.at(-1);
  return { chemin, suites: courant ? courant.enfants : [] };
}

/**
 * ⚠️ 01/11 (pilote, maquette « page du dossier », variante A) — la CHAÎNE de la procédure : le plan, sa mise en concurrence, le dossier
 * de marché, ses actes de gestion — du plus ancien au plus récent, « Vous êtes ici » sur le dossier de la page. Lue sur la filiation (B1 de « filiation-dossier ») ; remplace le bloc « Procédure du marché » et l'arbre de
 * l'historique. Un dossier seul (sans lien) ne montre pas de chaîne ; la route absente (404) non plus.
 */
@Component({
  selector: 'app-chaine-procedure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatutBadge],
  template: `
    @if (maillons().length > 1) {
      <section class="cp" aria-labelledby="cp-titre">
        <h2 class="cp__titre" id="cp-titre">Chaîne de la procédure</h2>
        <ol class="cp__chaine">
          @for (m of maillons(); track $index; let dernier = $last) {
            <li class="cp__pas">
              @if (m.noeud.masque) {
                <span class="cp__maillon cp__maillon--masque">
                  <span class="cp__k">{{ libelleLien(m.noeud.lien) }}</span>
                  <span class="cp__r">hors de votre périmètre</span>
                </span>
              } @else if (m.ici) {
                <span class="cp__maillon cp__maillon--ici" aria-current="page">
                  <span class="cp__ici">Vous êtes ici</span>
                  <span class="cp__k">{{ intitule(m.noeud) }}</span>
                  <span class="cp__r">{{ m.noeud.refeDossier || 'Brouillon #' + m.noeud.idDossier }}</span>
                  <app-statut-badge [statut]="m.noeud.statut" />
                </span>
              } @else if (lien.disponible() && m.noeud.idDossier != null) {
                <a class="cp__maillon" [routerLink]="lien.commandes(m.noeud.idDossier)" [queryParams]="lien.params()"
                  [attr.aria-label]="intitule(m.noeud) + ' — ouvrir le dossier ' + (m.noeud.refeDossier || m.noeud.idDossier)">
                  <span class="cp__k">{{ intitule(m.noeud) }}</span>
                  <span class="cp__r">{{ m.noeud.refeDossier || 'Brouillon #' + m.noeud.idDossier }}</span>
                  <app-statut-badge [statut]="m.noeud.statut" />
                </a>
              } @else {
                <span class="cp__maillon">
                  <span class="cp__k">{{ intitule(m.noeud) }}</span>
                  <span class="cp__r">{{ m.noeud.refeDossier || 'Brouillon #' + m.noeud.idDossier }}</span>
                  <app-statut-badge [statut]="m.noeud.statut" />
                </span>
              }
              @if (!dernier) { <span class="cp__fleche" aria-hidden="true">→</span> }
            </li>
          }
        </ol>
        @if (objet(); as o) { <p class="cp__objet">{{ o }}</p> }
        <ng-content />
      </section>
    }
  `,
  styles: `
    :host { display: block; }
    .cp { padding: 0.85rem 1.1rem; border: 1px solid var(--bordure); border-radius: 8px; background: var(--carte-fond); }
    .cp__titre { margin: 0 0 0.6rem; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-secondaire); }
    .cp__chaine { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
    .cp__pas { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
    .cp__maillon {
      display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; min-width: 0; height: 100%;
      padding: 0.45rem 0.75rem; border-radius: 6px; border: 1px solid var(--bordure); background: var(--ligne-survol);
      color: var(--texte); text-decoration: none;
    }
    a.cp__maillon:hover { border-color: var(--bordure-champ); background: var(--carte-fond); }
    a.cp__maillon:focus-visible { outline: 3px solid var(--bouton-principal); outline-offset: 2px; }
    .cp__maillon--ici { border: 2px solid var(--section-fond); background: var(--onglet-actif-fond); }
    .cp__maillon--masque { font-style: italic; }
    .cp__ici { font-size: 0.68rem; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; }
    .cp__k { font-size: 0.75rem; color: var(--texte-secondaire); }
    .cp__r { font-weight: 500; overflow-wrap: anywhere; }
    .cp__fleche { color: var(--texte-secondaire); }
    .cp__objet { margin: 0.55rem 0 0; font-size: 0.8125rem; color: var(--texte-secondaire); }
  `,
})
export class ChaineProcedure {
  private readonly service = inject(DossierService);
  readonly lien = inject(LienDossier);

  readonly idDossier = input.required<number>();

  private readonly filiation = signal<FiliationDossier | null>(null);
  readonly maillons = computed(() => {
    const f = this.filiation();
    if (!f) return [];
    const { chemin, suites } = cheminDeFiliation(f);
    return [...chemin, ...suites].map((noeud) => ({ noeud, ici: !noeud.masque && noeud.idDossier === f.idDossierDemande }));
  });
  /** L'objet de la ligne du plan, lu sur le premier maillon qui la porte (mise en concurrence, marché sans DAO). */
  readonly objet = computed(() => {
    const l = this.maillons().map((m) => m.noeud.ligne).find((x) => !!x);
    return l ? `Ligne ${l.idDetail}${l.objet ? ' — ' + l.objet : ''}` : null;
  });

  private abonnement = new Subscription();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abonnement.unsubscribe());
    effect(() => {
      const id = this.idDossier();
      untracked(() => {
        this.abonnement.unsubscribe();
        this.filiation.set(null);
        // Silencieuse : sans filiation (route absente, échec), la page n'affiche simplement pas de chaîne.
        this.abonnement = this.service.filiation(id).subscribe({ next: (f) => this.filiation.set(f?.racine ? f : null), error: () => this.filiation.set(null) });
      });
    });
  }

  libelleLien(code: string): string {
    return LIBELLES_LIEN[code] ?? code;
  }

  /** « Plan », « Mise à jour du plan », « Mise en concurrence », « Dossier de marché · lot 1 », « Acte de gestion ». */
  intitule(n: NoeudFiliation): string {
    const base = n.lien === 'RACINE' ? 'Plan' : this.libelleLien(n.lien);
    return n.lot != null ? `${base} · lot ${n.lot}` : base;
  }
}
