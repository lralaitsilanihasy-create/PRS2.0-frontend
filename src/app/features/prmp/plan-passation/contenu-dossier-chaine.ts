import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Dossier } from '../../../models';
import { DossierService } from '../../../services/circuit.services';
import { StatutBadge } from '../../../shared/circuit';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { DossierContenuStore } from '../../circuit/dossier/dossier-contenu.store';
import { OngletDossier, documentsDuDossier } from '../../circuit/dossier/documents-du-dossier';
import { referenceNoeud } from '../../circuit/page-dossier/chaine-ligne';
import { LienDossier } from '../../circuit/page-dossier/lien-dossier';

/** Ce qu'une barre demande d'ouvrir en fenêtre : l'élément, et le magasin de contenu du dossier, déjà chargé, prêté à la fenêtre. */
export interface OuvertureElement {
  contenu: DossierContenuStore;
  cle: OngletDossier;
  intitule: string;
  reference: string;
}

/** Le titre de la fenêtre d'un élément — sur tous les éléments du dossier : un renvoi des pièces peut ouvrir un élément masqué de la barre. */
export function libelleElement(contenu: DossierContenuStore, cle: OngletDossier): string {
  return documentsDuDossier(contenu).find((o) => o.cle === cle)?.libelle ?? 'Dossier';
}

/**
 * ⚠️ 04/11 (pilote) — UN dossier de la chaîne d'une ligne, dans le volet du plan : son en-tête (intitulé, référence, statut, lien vers
 * sa page) et la barre de ses éléments (fiche de présentation, informations du DAO, pièces jointes, PV…). Chaque élément s'ouvre en
 * MODALE (`DossierDocuments`, élément imposé — le mécanisme de la page du dossier) : rien ne s'étale sur l'écran, seules les barres des
 * dossiers y restent (pilote, 04/11). La fenêtre n'est PAS rendue ici : le volet de détail est collant, donc un contexte d'empilement,
 * et une fenêtre rendue dedans passait sous le menu principal — la barre émet `ouvrir` avec son magasin, l'écran du plan rend la fenêtre
 * à sa racine (règle du dépôt : centre de notifications, PV définitifs, contrats). Les gestes restent sur la page du dossier. Un store de
 * contenu par dossier : l'hôte remonte le composant à chaque changement.
 */
@Component({
  selector: 'app-contenu-dossier-chaine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DossierContenuStore],
  imports: [RouterLink, StatutBadge, EtatErreur],
  template: `
    <section class="cdc" [attr.aria-label]="intitule() + ' : ' + reference()">
      <div class="cdc__entete">
        <div class="cdc__titre">
          <span class="cdc__k">{{ intitule() }}</span>
          <span class="cdc__r">{{ reference() }}</span>
          @if (dossier(); as d) { <app-statut-badge [statut]="d.statut" /> }
        </div>
        @if (lien.disponible()) {
          <a class="btn btn-outline btn-sm" [routerLink]="lien.commandes(idDossier())" [queryParams]="lien.params()">Ouvrir la page du dossier</a>
        }
      </div>
      @if (erreur()) {
        <app-etat-erreur message="Le dossier n’a pas pu être lu." aide="Vérifiez votre connexion, puis réessayez." [reprise]="true" (reessayer)="lire()" />
      } @else if (!dossier() || contenu.loading()) {
        <p class="cdc__attente" role="status">Chargement des éléments du dossier…</p>
      } @else {
        <div class="onglets-dossier cdc__elements" role="group" [attr.aria-label]="'Éléments du dossier ' + reference()">
          @for (o of documents(); track o.cle) {
            <button type="button" class="onglets-dossier__tab" aria-haspopup="dialog" (click)="ouvrir.emit({ contenu, cle: o.cle, intitule: intitule(), reference: reference() })">
              {{ o.libelle }} @if (o.n !== undefined) {<span class="onglets-dossier__n">{{ o.n }}</span> }
            </button>
          }
        </div>
        <!-- ⚠️ 04/11 (temps 1) — ce que l'hôte loge sous la barre : la rangée « Procédure en ligne » du dossier de mise en concurrence. -->
        <ng-content />
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .cdc { display: grid; gap: 0.6rem; min-width: 0; padding: 0.75rem 0.9rem; border: 1px solid var(--bordure); border-radius: 8px; background: var(--carte-fond); }
    .cdc__entete { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; justify-content: space-between; }
    .cdc__titre { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; min-width: 0; }
    .cdc__k { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-secondaire); }
    .cdc__r { font-weight: 500; overflow-wrap: anywhere; }
    .cdc__attente { margin: 0; font-size: 0.8125rem; color: var(--texte-secondaire); }
    /* Des boutons qui ouvrent une fenêtre, pas des onglets : la barre commune, sans sa marge ni son profil d'onglet. */
    .cdc__elements { margin-bottom: 0; }
    .cdc__elements .onglets-dossier__tab { border-radius: 6px; }
  `,
})
export class ContenuDossierChaine implements OnInit {
  private readonly dossiers = inject(DossierService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly contenu = inject(DossierContenuStore);
  readonly lien = inject(LienDossier);

  readonly idDossier = input.required<number>();
  /** « Mise en concurrence », « Dossier de marché · lot 1 »… : l'intitulé du maillon. */
  readonly intitule = input('Dossier');
  /** ⚠️ 04/11 (pilote, redondances) — les éléments que le plan n'affiche pas pour ce dossier (déjà visibles sur l'écran). */
  readonly ongletsMasques = input<readonly OngletDossier[]>([]);

  /** L'élément à ouvrir en fenêtre, avec le magasin de ce dossier : l'écran hôte rend la fenêtre hors du volet. */
  readonly ouvrir = output<OuvertureElement>();

  readonly dossier = signal<Dossier | null>(null);
  readonly erreur = signal(false);
  readonly reference = computed(() => referenceNoeud(this.dossier()?.refeDossier, this.dossier()?.statut, this.idDossier()));
  /** Les éléments de la barre : ceux du dossier, moins ceux que le plan masque. À lire une fois le store chargé. */
  readonly documents = computed(() => documentsDuDossier(this.contenu).filter((o) => !this.ongletsMasques().includes(o.cle)));
  /** Le dossier non nul pour le store, qui n'est chargé qu'une fois le dossier servi. */
  private readonly dossierCharge = computed<Dossier>(() => this.dossier()!);
  private storeCharge = false;

  ngOnInit(): void {
    this.lire();
  }

  lire(): void {
    this.erreur.set(false);
    const s = this.dossiers.lire(this.idDossier()).subscribe({
      next: (d) => {
        this.dossier.set(d);
        if (!this.storeCharge) {
          this.storeCharge = true;
          this.contenu.charger(this.dossierCharge);
        }
      },
      error: () => this.erreur.set(true),
    });
    this.destroyRef.onDestroy(() => s.unsubscribe());
  }
}
