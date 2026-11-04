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

/** Les éléments rangés sous « Archives du circuit » : ce que le circuit a déposé ou figé, pas les données de la procédure. */
const ARCHIVES: ReadonlySet<OngletDossier> = new Set<OngletDossier>(['pieces', 'figes', 'controles']);

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
    <!-- ⚠️ 04/11 (pilote, maquette « volet en couleurs », variante B) — bandeau bleu nuit (couleur du menu) ; corps bleu pâle pour la mise
         en concurrence, vert pour le marché ; les boutons rangés par usage : ce qui se lit, puis la procédure en ligne que l'hôte loge
         ici, puis les archives du circuit. Chaque bouton ouvre sa fenêtre. -->
    <section [class]="'cdc cdc--' + teinte()" [attr.aria-label]="intitule() + ' : ' + reference()">
      <div class="cdc__bandeau">
        <div class="cdc__titre">
          <span class="cdc__k">{{ intitule() }}</span>
          <span class="cdc__r">{{ reference() }}</span>
          @if (dossier(); as d) { <app-statut-badge [statut]="d.statut" /> }
        </div>
        @if (lien.disponible()) {
          <a class="cdc__lien" [routerLink]="lien.commandes(idDossier())" [queryParams]="lien.params()">Ouvrir la page du dossier</a>
        }
      </div>
      <div class="cdc__corps">
        @if (erreur()) {
          <app-etat-erreur message="Le dossier n’a pas pu être lu." aide="Vérifiez votre connexion, puis réessayez." [reprise]="true" (reessayer)="lire()" />
        } @else if (!dossier() || contenu.loading()) {
          <p class="cdc__attente" role="status">Chargement des éléments du dossier…</p>
        } @else {
          @if (aLire().length) {
            <div class="cdc__groupe" role="group" [attr.aria-label]="'À lire — ' + reference()">
              <span class="cdc__g">À lire</span>
              <div class="cdc__elements">
                @for (o of aLire(); track o.cle) {
                  <button type="button" class="onglets-dossier__tab" aria-haspopup="dialog" (click)="ouvrir.emit({ contenu, cle: o.cle, intitule: intitule(), reference: reference() })">
                    {{ o.libelle }} @if (o.n !== undefined) {<span class="onglets-dossier__n">{{ o.n }}</span> }
                  </button>
                }
              </div>
            </div>
          }
          <!-- Ce que l'hôte loge entre les deux groupes : la procédure en ligne du dossier de mise en concurrence. -->
          <ng-content />
          @if (archives().length) {
            <div class="cdc__groupe" role="group" [attr.aria-label]="'Archives du circuit — ' + reference()">
              <span class="cdc__g">Archives du circuit</span>
              <div class="cdc__elements">
                @for (o of archives(); track o.cle) {
                  <button type="button" class="onglets-dossier__tab cdc__petit" aria-haspopup="dialog" (click)="ouvrir.emit({ contenu, cle: o.cle, intitule: intitule(), reference: reference() })">
                    {{ o.libelle }} @if (o.n !== undefined) {<span class="onglets-dossier__n">{{ o.n }}</span> }
                  </button>
                }
              </div>
            </div>
          }
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .cdc { min-width: 0; border: 1px solid var(--menu-fond); border-radius: 8px; overflow: hidden; background: var(--carte-fond); }
    .cdc--dao .cdc__corps { background: var(--onglet-actif-fond); }
    .cdc--marche .cdc__corps { background: var(--favorable-fond); }
    .cdc--autre .cdc__corps { background: var(--neutre-fond); }
    .cdc__bandeau { display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; align-items: center; justify-content: space-between; padding: 0.5rem 0.9rem;
      background: var(--menu-fond); color: var(--texte-menu); }
    .cdc__titre { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; min-width: 0; }
    .cdc__k { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-menu-secondaire); }
    .cdc__r { font-weight: 500; overflow-wrap: anywhere; color: var(--texte-menu); }
    .cdc__lien { color: var(--texte-menu); font-size: 0.8125rem; text-decoration: underline; text-decoration-color: var(--texte-menu-secondaire); text-underline-offset: 3px; }
    .cdc__lien:focus-visible { outline: 2px solid var(--texte-menu); outline-offset: 2px; }
    .cdc__corps { display: grid; gap: 0.7rem; padding: 0.7rem 0.9rem 0.85rem; }
    .cdc__attente { margin: 0; font-size: 0.8125rem; color: var(--texte-secondaire); }
    .cdc__groupe { display: grid; gap: 0.35rem; }
    .cdc__g { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-secondaire); }
    /* Des boutons qui ouvrent une fenêtre, pas des onglets : la barre commune, sans sa marge ni son profil d'onglet. */
    .cdc__elements { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .cdc__elements .onglets-dossier__tab { border-radius: 6px; }
    .cdc__petit { padding: 0.3rem 0.7rem; }
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
  /** ⚠️ 04/11 (variante B) — la teinte du corps : bleu pâle la mise en concurrence, vert le marché, gris le reste. */
  readonly teinte = input<'dao' | 'marche' | 'autre'>('autre');
  /** ⚠️ 04/11 (pilote, redondances) — les éléments que le plan n'affiche pas pour ce dossier (déjà visibles sur l'écran). */
  readonly ongletsMasques = input<readonly OngletDossier[]>([]);

  /** L'élément à ouvrir en fenêtre, avec le magasin de ce dossier : l'écran hôte rend la fenêtre hors du volet. */
  readonly ouvrir = output<OuvertureElement>();

  readonly dossier = signal<Dossier | null>(null);
  readonly erreur = signal(false);
  readonly reference = computed(() => referenceNoeud(this.dossier()?.refeDossier, this.dossier()?.statut, this.idDossier()));
  /** Les éléments de la barre : ceux du dossier, moins ceux que le plan masque. À lire une fois le store chargé. */
  readonly documents = computed(() => documentsDuDossier(this.contenu).filter((o) => !this.ongletsMasques().includes(o.cle)));
  /** ⚠️ 04/11 (variante B) — ce qui se lit (données de la procédure), puis les archives du circuit (pièces, écrans figés, contrôles). */
  readonly archives = computed(() => this.documents().filter((o) => ARCHIVES.has(o.cle)));
  readonly aLire = computed(() => this.documents().filter((o) => !ARCHIVES.has(o.cle)));
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
