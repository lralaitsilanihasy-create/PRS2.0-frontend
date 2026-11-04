import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, OnInit, Type, afterRenderEffect, computed, effect, inject, linkedSignal, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, catchError, forkJoin, map, of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { dateFr } from '../../../core/interim/interim-libelles';
import { Capm, Dossier, Echeance, JalonReel, Marche, ModePassation, MarchePrevision, Ppm, ServiceBeneficiaire } from '../../../models';
import { CapmService, EcheanceService, EntiteContractService, ModePassationService, NatureService, MarchePrevisionService, MarcheService, PpmService, ReferenceLookupService, ServiceBeneficiaireService } from '../../../services';
import { DossierService } from '../../../services/circuit.services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { PpmMarchesTable } from '../../../shared/prmp/ppm-marches-table';
import { DocumentVisionneuse } from '../../../shared/ui/document-visionneuse';
import { DeuxVolets } from '../../../shared/ui/deux-volets';
import { montantOfficiel } from '../../../shared/prmp/document-officiel';
import { AgpmDoc } from '../../../shared/prmp/agpm-doc';
import { calculerAgpm } from '../../../shared/prmp/agpm';
import { FichePresentationDoc } from '../../../shared/prmp/fiche-presentation-doc';
import { calculerFichePresentation } from '../../../shared/prmp/fiche-presentation';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { StatutBadge } from '../../../shared/circuit';
import { TitrePage } from '../../../shared/ui/titre-page';
import { ChainesDuPlan, dossiersDeLaLigne } from '../../circuit/page-dossier/chaine-ligne';
import { DossierContenuStore } from '../../circuit/dossier/dossier-contenu.store';
import { DossierDocuments } from '../../circuit/dossier/dossier-documents';
import { OngletDossier } from '../../circuit/dossier/documents-du-dossier';
import { OuvertureElement, libelleElement } from './contenu-dossier-chaine';
import { DetailLigne } from './detail-ligne';
import { JalonsLigne, jalonsDuJour } from './jalons-ligne';
import { CibleDossier, cibleDuDossier } from './cible-dossier';
import { LienDossier } from '../../circuit/page-dossier/lien-dossier';
import { CHARGEURS_ECRAN, OuvertureEcran, routeDeProcedure } from './ecrans-procedure';
import { ETAPES_LIGNE, EtapeLigne, SuiviLigne, TEINTE_ETAPE, TeinteLigne, suiviDeLigne } from './suivi-ligne';
import { PlanResume, TableauPlans } from './tableau-plans';

/** Texte comparable : minuscules, sans accents. */
const sansAccents = (s: string | null | undefined): string => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Présentation du plan retenue sur le poste (préférence d'affichage, pas une donnée). */
// ⚠️ 04/11 (pilote) — l'onglet « Calendrier des jalons » est RETIRÉ : les jalons d'une ligne s'ouvrent en fenêtre depuis son bandeau.
// Une présentation « calendrier » encore mémorisée retombe sur le document. La route /prmp/calendrier est retirée aussi (04/11).
type Presentation = 'document' | 'volets' | 'fiche' | 'agpm';
const PRESENTATIONS: readonly Presentation[] = ['document', 'volets', 'fiche', 'agpm'];
const CLE_PRESENTATION = 'prs.plan.presentation';

/** Statuts d'un plan signé, en vigueur tant qu'aucune mise à jour soumise ne le remplace (même règle que « Mettre à jour un PPM »). */
const STATUTS_PLAN_SIGNE = new Set(['CLOTURE', 'DECISION_TRANSMISE_SIGMP']);

/**
 * Les plans en vigueur de la PRMP : famille DDP, signés, sans successeur soumis (un brouillon de mise à jour ne compte pas). Du plus
 * récent au plus ancien : exercice décroissant, puis dossier décroissant.
 */
export function plansEnVigueur(dossiers: readonly Dossier[], ppms: readonly Ppm[]): Dossier[] {
  const remplaces = new Set(dossiers.filter((d) => d.idDossierParent != null && d.statut !== 'BROUILLON').map((d) => d.idDossierParent as number));
  const exercice = new Map(ppms.map((p) => [p.idDossier, p.exercice ?? 0]));
  return dossiers
    .filter((d) => d.idTypeDossier === 'DDP' && STATUTS_PLAN_SIGNE.has(d.statut ?? '') && !remplaces.has(d.idDossier))
    .sort((a, b) => (exercice.get(b.idDossier) ?? 0) - (exercice.get(a.idDossier) ?? 0) || b.idDossier - a.idDossier);
}

interface ContenuPlans {
  plans: Dossier[];
  ppms: Ppm[];
  marches: Marche[];
  benefs: ServiceBeneficiaire[];
  previsions: MarchePrevision[];
  echeances: Echeance[];
  modes: ModePassation[];
  capmsRef: Capm[];
}

/**
 * ⚠️ 03/11 (pilote, maquette « espace PRMP », lot 1) — le PLAN DE PASSATION comme écran de travail de la PRMP et de l'UGPM : le
 * dernier plan signé (ou celui de l'URL), au format du document officiel ; un clic sur une ligne ouvre sa chaîne et l'étape suivante.
 * Une seule vague de lectures pour tous les plans (listes scopées filtrées ici) : changer de plan ne relit rien.
 */
@Component({
  selector: 'app-plan-passation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, NgComponentOutlet, RouterLink, TitrePage, StatutBadge, EtatErreur, DocumentVisionneuse, PpmMarchesTable, DetailLigne, DeuxVolets, FichePresentationDoc, AgpmDoc, ModaleDirective, DossierDocuments, JalonsLigne, TableauPlans],
  providers: [ChainesDuPlan],
  template: `
    <!-- ⚠️ 03/11 (pilote, ergonomie) — un seul titre : le plan affiché, sa référence et son état dessous. -->
    <app-titre-page [titre]="titrePage()" [sousTitre]="sousTitrePage()">
      @if (plan(); as pt) { <app-statut-badge statut [statut]="pt.statut" /> }
      @if (plan() && estPrmp()) {
        <a class="btn btn-outline btn-sm" routerLink="/prmp/dossiers-verifies" [queryParams]="{ maj: 1 }">Mettre à jour le plan</a>
      }
    </app-titre-page>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement du plan de passation…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Le plan de passation n’a pas pu être lu." (reessayer)="charger()" />
    } @else if (modeListe()) {
      <!-- ⚠️ 04/11 (pilote, maquette « plusieurs plans », variante B) — plusieurs plans en vigueur chez le Président, le CC ou le Membre :
           l'écran s'ouvre sur le tableau des plans ; un clic ouvre le plan. -->
      <app-tableau-plans [plans]="resumesPlans()" [espace]="espace" />
    } @else if (!plan()) {
      <section class="pp__vide card" aria-labelledby="pp-vide-t">
        <h2 id="pp-vide-t" class="pp__vide-t">Aucun plan signé</h2>
        <p>Un plan paraît ici une fois contrôlé et clôturé par la Commission.@if (estPrmp()) { Saisissez-le, puis soumettez-le. }</p>
        @if (estPrmp()) {
          <a class="btn btn-primary btn-sm" routerLink="/prmp/soumettre-dossier" [queryParams]="{ famille: 'DDP' }">Saisir un plan de passation</a>
        }
      </section>
    } @else {
      @let p = plan()!;
      <!-- ⚠️ 04/11 (pilote) — plusieurs plans en vigueur : chez le Président, le CC et le Membre, le retour au tableau des plans (variante B) ;
           chez la PRMP (ses plans de plusieurs exercices), la liste déroulante. -->
      @if (plans().length > 1 && !estPrmp()) {
        <p class="pp__retour"><a class="pp__retour-l" [routerLink]="[espace, 'plan']">← Tous les plans ({{ plans().length }})</a></p>
      } @else if (plans().length > 1) {
        <div class="pp__entete">
          <label class="pp__champ pp__champ--plan">
            <span class="pp__champ-l">Plan affiché</span>
            <select class="form-control pp__select" [value]="p.idDossier" (change)="choisirPlan($any($event.target).value)">
              @for (x of plansTries(); track x.idDossier) {
                <option [value]="x.idDossier" [selected]="x.idDossier === p.idDossier">{{ libellePlanLong(x) }}</option>
              }
            </select>
          </label>
        </div>
      }

      <!-- ⚠️ 03/11 (pilote) — cinq onglets, chacun à sa couleur (palette) et avec son nombre ; le panneau prend la couleur de l'onglet ouvert.
           Le choix est retenu sur le poste ; la ligne choisie et le filtre passent du document aux deux volets. -->
      <div class="pp__onglets" role="tablist" aria-label="Affichage du plan">
        @for (o of onglets(); track o.cle) {
          <button type="button" role="tab" class="pp__onglet" [class]="'pp__onglet--' + o.teinte" [id]="'pp-onglet-' + o.cle"
            [attr.aria-selected]="presentation() === o.cle" aria-controls="pp-panneau" (click)="choisirPresentation(o.cle)">
            <span class="pp__pastille" aria-hidden="true"></span>{{ o.libelle }}@if (o.n !== null) {<span class="pp__onglet-n">{{ o.n }}</span>}
          </button>
        }
      </div>
      <div class="pp__panneau" [class]="'pp__panneau--' + ongletActif().teinte" role="tabpanel" id="pp-panneau" [attr.aria-labelledby]="'pp-onglet-' + presentation()">

      @if (presentation() === 'document' || presentation() === 'volets') {
        <!-- ⚠️ 03/11 (pilote) — le filtre par étape en liste déroulante (chaque étape avec son nombre de lignes) et une recherche par mot clé. -->
        <div class="pp__outils">
          <div class="pp__champ">
            <label class="pp__champ-l" for="pp-etape">Étape</label>
            <select id="pp-etape" class="form-control pp__select" (change)="choisirEtape($any($event.target).value)">
              <option value="" [selected]="filtre() === null">Toutes les lignes ({{ marchesDuPlan().length }})</option>
              @for (e of compteurs(); track e.cle) {
                <option [value]="e.cle" [selected]="filtre() === e.cle" [disabled]="!e.n">{{ e.libelle }} ({{ e.n }})</option>
              }
            </select>
          </div>
          <div class="pp__champ pp__champ--recherche">
            <label class="pp__champ-l" for="pp-recherche">Rechercher</label>
            <input id="pp-recherche" class="form-control" type="search" placeholder="Objet, mode, nature, compte, service bénéficiaire…"
              [value]="recherche()" (input)="recherche.set($any($event.target).value)" />
          </div>
          <p class="pp__resultat" role="status">{{ lignesAffichees().length }} ligne{{ lignesAffichees().length > 1 ? 's' : '' }} sur {{ marchesDuPlan().length }}</p>
          @if (filtre() || recherche().trim()) {
            <button type="button" class="btn btn-outline btn-sm" (click)="effacerFiltres()">Effacer les filtres</button>
          }
        </div>
        <!-- La couleur des lignes : la légende que portaient les compteurs. -->
        <p class="pp__legende"><span class="pp__legende-l">Couleur des lignes :</span>
          <span><span class="pp__sw pp__sw--lancer" aria-hidden="true"></span>à lancer</span>
          <span><span class="pp__sw pp__sw--examen" aria-hidden="true"></span>en préparation ou à la Commission</span>
          <span><span class="pp__sw pp__sw--favorable" aria-hidden="true"></span>lancée ou au marché</span>
          <span><span class="pp__sw" aria-hidden="true"></span>sans étape définie</span>
        </p>
        @if (!source.filiation() && source.chargement()) { <p class="text-muted pp__suivi-attente" role="status">Lecture du suivi des lignes…</p> }
      }


      @if (presentation() === 'document') {
        <!-- ⚠️ 03/11 (pilote) — le document se CONSULTE : ni ligne ni annotation cliquable ; le détail d'une ligne se lit en deux volets. -->
        <p class="pp__aide">Le plan se consulte tel qu’il a été signé. Pour lire les dossiers, la procédure et les jalons d’une ligne, passez en « Deux volets ».</p>
        <app-document-visionneuse [interrupteur]="true">
          <app-ppm-marches-table [suiviFn]="suiviFn" [marches]="lignesAffichees()" [beneficiaires]="benefsDuPlan()" [previsions]="previsionsDuPlan()"
            [messageVide]="filtre() || recherche().trim() ? 'Aucune ligne ne correspond à ces filtres.' : 'Ce plan ne porte aucune ligne.'" />
        </app-document-visionneuse>
      } @else if (presentation() === 'volets') {
        @if (cibleSansLigne(); as id) {
          <p class="pp__aide" role="status">Ce dossier n’est rattaché à aucune ligne de ce plan.
            @if (lienDossier.disponible()) { <a [routerLink]="lienDossier.commandes(id)">Ouvrir la page du dossier</a> }</p>
        }
        @let choisie = ligneVolets();
        <app-deux-volets [style.--dv-hauteur-detail.px]="hauteurDetail()" [ouvert]="!!choisie" [cle]="choisie?.idDetail" libelleListe="Lignes du plan" libelleDetail="Ligne choisie"
          invite="Aucune ligne ne correspond à ces filtres.">
          <!-- ⚠️ 04/11 (pilote) — la liste des lignes est PAGINÉE (10 par page) ; la page suit la ligne choisie (choix, ?dossier=). -->
          <div liste>
          <ul class="pp__liste" #listeLignes>
            @for (m of lignesDeLaPage(); track m.idDetail) {
              @let s = suivis().get(m.idDetail);
              <li>
                <button type="button" class="pp__ligne" [attr.aria-pressed]="choisie?.idDetail === m.idDetail" (click)="ligne.set(m.idDetail)">
                  <span class="pp__obj">{{ m.designationMarche }}</span>
                  <span class="pp__mt">{{ montant(m) }}</span>
                  <span class="pp__mode">{{ libelleMode(m) }}</span>
                  @if (s) { <span class="pp__pill" [class]="'pp__pill--' + s.famille">{{ s.libelle }}</span> }
                </button>
              </li>
            }
          </ul>
          @if (nbPages() > 1) {
            <nav class="pp__pager" aria-label="Pages de la liste des lignes">
              <button type="button" class="btn btn-secondary btn-sm" [disabled]="page() === 0" (click)="page.set(page() - 1)">Précédent</button>
              <span class="pp__pager-info">Page {{ page() + 1 }} / {{ nbPages() }} · lignes {{ page() * parPage() + 1 }}–{{ min((page() + 1) * parPage(), lignesAffichees().length) }} sur {{ lignesAffichees().length }}</span>
              <button type="button" class="btn btn-secondary btn-sm" [disabled]="page() + 1 >= nbPages()" (click)="page.set(page() + 1)">Suivant</button>
            </nav>
          }
          </div>
          <div detail>
            @if (choisie; as m) {
              <article class="pp__volet" aria-labelledby="pp-volet-t">
                <!-- ⚠️ 03/11 (pilote) — l'en-tête : l'objet et son montant, l'étape, puis la fiche officielle en UNE ligne (nature · mode ·
                     financement · imputations) — ⚠️ 04/11 (redondances) : plus de carte « Fiche officielle », le montant n'y est plus répété. -->
                <header class="pp__volet-entete">
                  <h3 id="pp-volet-t" class="pp__volet-t">{{ m.designationMarche }}</h3>
                  <span class="pp__volet-mt">{{ montantNouveau(m) !== '' && m.nouvMontEstim ? montantNouveau(m) : montant(m) }} <small>Ar</small></span>
                  @if (suivis().get(m.idDetail); as s) {
                    <span class="pp__pill" [class]="'pp__pill--' + s.famille">{{ s.libelle }}{{ s.precision ? ' · ' + s.precision : '' }}</span>
                  }
                  <p class="pp__volet-fiche" aria-label="Fiche officielle">{{ ficheEnLigne(m) }}</p>
                  <!-- ⚠️ 04/11 (pilote) — les jalons de la ligne s'ouvrent en fenêtre ; le bouton dit où on en est. -->
                  <button type="button" class="pp__btn-jalons" aria-haspopup="dialog" (click)="jalonsOuverts.set(true)">
                    Jalons @if (resumeJalons(); as r) { <span class="pp__btn-n">{{ r.realises }} / {{ r.total }}</span> }
                  </button>
                </header>
                <app-detail-ligne [marche]="m"
                  (ouvrir)="ouvrirElement($event)" (ouvrirEcran)="ouvrirEcran($event)" />
              </article>
            }
          </div>
        </app-deux-volets>
        <!-- ⚠️ 04/11 (pilote) — l'élément d'un dossier (fiche, pièces, PV…) choisi dans une barre du volet s'ouvre ICI, hors de
             « app-deux-volets » : le volet de détail est collant (« position: sticky »), donc un contexte d'empilement, et une fenêtre rendue
             dedans passait SOUS le menu principal (z-index 99) — la règle du dépôt (centre de notifications, PV définitifs, contrats).
             Le magasin de contenu est celui de la barre, prêté à la fenêtre par son injecteur : rien n'est relu. -->
        @if (modale(); as md) {
          <div class="modal-backdrop">
            <div class="modal pp__modale" role="dialog" aria-modal="true" [attr.aria-label]="libelleModale() + ' — ' + md.intitule + ' ' + md.reference"
              appModale (appModaleFermer)="fermerModale()">
              <div class="modal-header">
                <h2 class="modal-title">{{ libelleModale() }} <span class="pp__modale-ref">· {{ md.intitule }} {{ md.reference }}</span></h2>
                <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerModale()">✕</button>
              </div>
              <div class="modal-body pp__modale-corps">
                <ng-container *ngTemplateOutlet="elementTpl; injector: injecteurModale()" />
              </div>
            </div>
          </div>
        }
        <!-- ⚠️ 04/11 (pilote) — un écran de la procédure en ligne (commission, reçus, retraits, questions, dépôts, séance, évaluation), en
             fenêtre : le composant de sa page, chargé à la demande, avec la route de sa procédure (« routeDeProcedure »). -->
        @if (ecran(); as ec) {
          <div class="modal-backdrop">
            <div class="modal pp__modale" role="dialog" aria-modal="true" [attr.aria-label]="ec.libelle + ' — ' + ec.sousTitre"
              appModale (appModaleFermer)="fermerEcran()">
              <div class="modal-header">
                <h2 class="modal-title">{{ ec.libelle }} <span class="pp__modale-ref">· {{ ec.sousTitre }}</span></h2>
                <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerEcran()">✕</button>
              </div>
              <div class="modal-body pp__modale-corps pp__ecran">
                @if (composantEcran(); as c) {
                  <ng-container *ngComponentOutlet="c; injector: injecteurEcran()" />
                } @else if (ecranEnErreur()) {
                  <app-etat-erreur message="L’écran n’a pas pu être chargé." aide="Vérifiez votre connexion, puis réessayez." [reprise]="true" (reessayer)="ouvrirEcran(ec)" />
                } @else {
                  <p class="text-muted" role="status">Chargement…</p>
                }
              </div>
            </div>
          </div>
        }
        <!-- ⚠️ 04/11 (pilote) — les jalons de la ligne, en fenêtre (hors du volet collant, comme les autres). -->
        @if (jalonsOuverts() && choisie; as m) {
          <div class="modal-backdrop">
            <div class="modal modal-xl" role="dialog" aria-modal="true" [attr.aria-label]="'Jalons — ' + m.designationMarche" appModale (appModaleFermer)="jalonsOuverts.set(false)">
              <div class="modal-header">
                <h2 class="modal-title">Jalons <span class="pp__modale-ref">· {{ m.designationMarche }}</span></h2>
                <button type="button" class="btn-close" aria-label="Fermer" (click)="jalonsOuverts.set(false)">✕</button>
              </div>
              <div class="modal-body">
                <app-jalons-ligne [previsions]="previsionsDe(m)" [echeances]="echeancesDe(m)" [capms]="capms()" [reels]="reelsDe(m)" />
              </div>
            </div>
          </div>
        }
        <ng-template #elementTpl>
          <!-- Un renvoi de la liste des pièces (« fournies par l'application, dans leurs onglets ») change l'élément ouvert. -->
          <app-dossier-documents [ongletImpose]="elementModale()" (ongletDemande)="elementModale.set($event)" />
        </ng-template>
      } @else if (presentation() === 'fiche') {
        <app-document-visionneuse>
          <app-fiche-presentation-doc [fiche]="fiche()" [exercice]="ppmDuPlan()?.exercice" [libelleVersion]="libelleVersionFiche()"
            [justificationFiche]="ppmDuPlan()?.justificationFiche" [motifMaj]="ppmDuPlan()?.motifMaj" />
        </app-document-visionneuse>
      } @else {
        <app-document-visionneuse>
          <app-agpm-doc [lignes]="agpm()" [exercice]="ppmDuPlan()?.exercice" [entite]="entiteDuPlan()" [signataire]="ppmDuPlan()?.signataire"
            [dateInitiale]="ppmDuPlan()?.datePpmInit || ppmDuPlan()?.dateSignature" [numMajPrec]="ppmDuPlan()?.numMajPrec"
            [dateMajPrec]="ppmDuPlan()?.dateMajPrec" [numMaj]="ppmDuPlan()?.numMaj" />
        </app-document-visionneuse>
      }
      </div>
    }
  `,
  styles: `
    :host { display: grid; gap: 1rem; }
    .pp__entete { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    /* Modèle M3 (pilote, 03/11) : un sélecteur segmenté ; l'onglet ouvert en bleu nuit ; une pastille de sa couleur devant chaque libellé. */
    .pp__onglets { display: flex; flex-wrap: wrap; width: fit-content; max-width: 100%; border: 1px solid var(--bordure-champ); border-radius: 6px; overflow: hidden; background: var(--carte-fond); }
    .pp__onglet { --pp-c: var(--menu-fond); appearance: none; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.5rem 0.95rem;
      border: 0; border-right: 1px solid var(--bordure); background: var(--carte-fond); color: var(--texte); font: inherit; font-size: 0.8125rem; cursor: pointer; }
    .pp__onglet:last-child { border-right: 0; }
    .pp__onglet:hover { background: var(--ligne-survol); }
    .pp__onglet:focus-visible { outline: 3px solid var(--bouton-principal); outline-offset: -3px; }
    .pp__onglet[aria-selected='true'], .pp__onglet[aria-selected='true']:hover { background: var(--menu-fond); color: var(--texte-menu); font-weight: 500; }
    .pp__pastille { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--pp-c); box-shadow: 0 0 0 1px var(--carte-fond); }
    .pp__onglet[aria-selected='true'] .pp__pastille { box-shadow: 0 0 0 2px var(--texte-menu); }
    .pp__onglet[aria-selected='true'] .pp__onglet-n { background: transparent; color: var(--texte-menu); border-color: var(--texte-menu-secondaire); }
    .pp__onglet-n { padding: 0 0.45rem; border-radius: 999px; background: var(--carte-fond); border: 1px solid var(--bordure); font-size: 0.72rem; font-weight: 500; }
    .pp__onglet--nuit, .pp__panneau--nuit { --pp-c: var(--menu-fond); --pp-f: var(--onglet-actif-fond); }
    .pp__onglet--bleu, .pp__panneau--bleu { --pp-c: var(--bouton-principal); --pp-f: var(--onglet-actif-fond); }
    .pp__onglet--vert, .pp__panneau--vert { --pp-c: var(--favorable-texte); --pp-f: var(--favorable-fond); }
    .pp__onglet--or, .pp__panneau--or { --pp-c: var(--or); --pp-f: var(--examen-fond); }
    .pp__panneau { display: grid; gap: 0.85rem; }
    .pp__plans, .pp__gestes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    /* ⚠️ 03/11 (pilote) — la barre d'outils du plan : étape (liste déroulante), recherche, nombre de lignes. */
    .pp__outils { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; align-items: flex-end; }
    .pp__champ { display: grid; gap: 0.2rem; min-width: 0; }
    .pp__champ-l { font-size: 0.75rem; font-weight: 500; color: var(--texte-secondaire); }
    .pp__champ--plan { flex: 1 1 24rem; max-width: 40rem; }
    .pp__retour { margin: 0 0 0.5rem; }
    .pp__retour-l { color: var(--texte); text-decoration: underline; text-decoration-color: var(--lien-soulignement); }
    .pp__select { min-width: 15rem; }
    .pp__champ--recherche { flex: 1 1 18rem; max-width: 30rem; }
    .pp__resultat { margin: 0 0 0.45rem; font-size: 0.8125rem; color: var(--texte-secondaire); }
    .pp__legende { margin: 0; display: flex; flex-wrap: wrap; gap: 0.35rem 1rem; align-items: center; font-size: 0.75rem; color: var(--texte-secondaire); }
    .pp__legende > span { display: inline-flex; align-items: center; gap: 0.3rem; }
    .pp__legende-l { font-weight: 500; }
    .pp__sw { display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 2px; border: 1px solid var(--bordure-champ); }
    .pp__sw--lancer { background: var(--onglet-actif-fond); border-color: var(--menu-fond); }
    .pp__sw--examen { background: var(--examen-fond); border-color: var(--examen-texte); }
    .pp__sw--favorable { background: var(--favorable-fond); border-color: var(--favorable-texte); }
    .pp__suivi-attente { margin: 0; font-size: 0.8125rem; }
    .pp__aide { margin: 0; font-size: 0.8125rem; color: var(--texte-secondaire); }
    .pp__liste { list-style: none; margin: 0; padding: 0; }
    .pp__pager { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; justify-content: space-between; padding: 0.6rem 0.75rem; border-top: 1px solid var(--bordure); }
    .pp__pager-info { font-size: 0.75rem; color: var(--texte-secondaire); font-variant-numeric: tabular-nums; text-align: center; }
    .pp__ligne { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.15rem 0.75rem; text-align: left; padding: 0.55rem 0.75rem;
      border: 0; border-bottom: 1px solid var(--bordure); background: var(--carte-fond); color: var(--texte); font: inherit; font-size: 0.8125rem; cursor: pointer; }
    .pp__ligne:hover { background: var(--ligne-survol); }
    .pp__ligne[aria-pressed='true'] { background: var(--onglet-actif-fond); box-shadow: inset 3px 0 0 var(--menu-fond); }
    .pp__ligne:focus-visible { outline: 3px solid var(--bouton-principal); outline-offset: -3px; }
    .pp__obj { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
    .pp__mt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .pp__mode { font-size: 0.75rem; color: var(--texte-secondaire); }
    .pp__pill { justify-self: end; width: fit-content; padding: 0 0.5rem; border-radius: 999px; font-size: 0.72rem; font-weight: 500; white-space: nowrap; }
    .pp__pill--neutre { background: var(--neutre-fond); color: var(--neutre-texte); }
    .pp__pill--examen { background: var(--examen-fond); color: var(--examen-texte); }
    .pp__pill--favorable { background: var(--favorable-fond); color: var(--favorable-texte); }
    .pp__volet { display: grid; gap: 0.6rem; }
    .pp__volet .pp__pill { justify-self: start; }
    /* ⚠️ 04/11 (pilote, variante B) — l'en-tête de la ligne sur le bleu nuit du menu. */
    .pp__volet-entete { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.35rem 1rem; align-items: start; padding: 0.75rem 1rem; border-radius: 8px;
      background: var(--menu-fond); color: var(--texte-menu); }
    .pp__volet-t { margin: 0; font-size: 1.05rem; font-weight: 500; line-height: 1.35; color: var(--texte-menu); }
    .pp__volet-mt { font-size: 1.05rem; font-weight: 500; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .pp__volet-mt small { font-size: 0.75rem; color: var(--texte-menu-secondaire); }
    .pp__volet-entete .pp__pill { grid-column: 1; }
    /* La fenêtre d'un élément de dossier : celle de la page du dossier (« pd-docmodal »), presque plein écran, le corps seul défile. */
    .pp__modale { width: 96vw; max-width: 96vw; height: min(94vh, calc(100vh - 3rem)); max-height: min(94vh, calc(100vh - 3rem)); display: flex; flex-direction: column; }
    .pp__modale-ref { font-weight: 400; color: var(--texte-secondaire); font-size: 0.9rem; }
    .pp__modale-corps { flex: 1; overflow: auto; padding: 0; }
    /* Un écran de page dans la fenêtre : ses marges, et pas son titre (la fenêtre le porte). */
    .pp__ecran { padding: 1rem 1.25rem; }
    .pp__ecran ::ng-deep .page-title { display: none; }
    .pp__volet-fiche { grid-column: 1; margin: 0; font-size: 0.8125rem; overflow-wrap: anywhere; color: var(--texte-menu-secondaire); }
    /* Le bouton « Jalons » du bandeau : clair sur le bleu nuit, en bas à droite. */
    .pp__btn-jalons { grid-column: 2; grid-row: 2 / span 2; align-self: end; justify-self: end; display: inline-flex; gap: 0.45rem; align-items: center;
      padding: 0.3rem 0.75rem; border: 1px solid var(--texte-menu-secondaire); border-radius: 6px; background: transparent; color: var(--texte-menu);
      font: inherit; font-size: 0.8125rem; font-weight: 500; cursor: pointer; white-space: nowrap; }
    .pp__btn-jalons:hover { background: var(--menu-survol); }
    .pp__btn-jalons:focus-visible { outline: 2px solid var(--texte-menu); outline-offset: 2px; }
    .pp__btn-n { padding: 0 0.45rem; border-radius: 20px; background: var(--carte-fond); color: var(--texte); font-size: 0.72rem; font-variant-numeric: tabular-nums; }
    .pp__fiche { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
    .pp__fiche th, .pp__fiche td { border: 1px solid var(--bordure); padding: 0.25rem 0.5rem; text-align: left; vertical-align: top; font-variant-numeric: tabular-nums; }
    .pp__fiche th { width: 40%; background: var(--tableau-entete); font-weight: 500; }
    .pp__vide { padding: 1rem 1.25rem; display: grid; gap: 0.6rem; justify-items: start; }
    .pp__vide-t { margin: 0; font-size: 1rem; font-weight: 500; }
    .pp__vide p { margin: 0; color: var(--texte-secondaire); }
  `,
})
export class PlanPassation implements OnInit {
  private readonly dossiers = inject(DossierService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly benefService = inject(ServiceBeneficiaireService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly echeanceService = inject(EcheanceService);
  private readonly modeService = inject(ModePassationService);
  private readonly capmService = inject(CapmService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly source = inject(ChainesDuPlan);

  readonly estPrmp = computed(() => this.auth.role() === 'PRMP');
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  private readonly contenu = signal<ContenuPlans | null>(null);
  private readonly entites = signal<Map<string, string>>(new Map());
  /** Processus CAPM : identifiant → libellé (jalons du détail d'une ligne). */
  readonly capms = signal<Map<string, string>>(new Map());
  /** ⚠️ 03/11 (« jalons-reels ») — dates réelles du plan affiché, par ligne ; `null` tant qu'elles ne sont pas lues (ou si la route manque). */
  private readonly reels = signal<Map<number, JalonReel[]> | null>(null);
  private abonnementReels = new Subscription();
  private readonly idDemande = toSignal(this.route.paramMap.pipe(map((p) => (p.get('idDossier') ? Number(p.get('idDossier')) : null))), { initialValue: null });

  readonly plans = computed(() => this.contenu()?.plans ?? []);
  /**
   * ⚠️ 04/11 (pilote, variante B) — le tableau des plans : chez le Président, le CC et le Membre, quand la localité a plusieurs plans en
   * vigueur et que l'URL n'en désigne aucun (ni plan, ni `?dossier=`).
   */
  readonly modeListe = computed(() => !this.estPrmp() && this.plans().length > 1 && this.idDemande() == null && this.dossierDemande == null);
  /** Une ligne par plan : entité, référence, exercice, lignes non retirées, montant, clôture, et l'avancement servi par le serveur. */
  readonly resumesPlans = computed<PlanResume[]>(() => {
    const c = this.contenu();
    if (!c) return [];
    const parPlan = new Map<number, { n: number; montant: number }>();
    for (const m of c.marches) {
      if (m.supprimee || m.idDossier == null) continue;
      const t = parPlan.get(m.idDossier) ?? { n: 0, montant: 0 };
      parPlan.set(m.idDossier, { n: t.n + 1, montant: t.montant + (m.montEstim ?? 0) });
    }
    return this.plans().map((d) => {
      const cloture = d.datesEtapes?.['CLOTURE'];
      return {
        idDossier: d.idDossier,
        entite: (d.idEntiteContract != null ? this.entites().get(String(d.idEntiteContract))?.trim() : null) || '—',
        reference: (d.refeDossier ?? `Dossier ${d.idDossier}`).split('/CNM/')[0],
        exercice: c.ppms.find((x) => x.idDossier === d.idDossier)?.exercice ?? null,
        lignes: parPlan.get(d.idDossier)?.n ?? 0,
        montant: parPlan.get(d.idDossier)?.montant ?? 0,
        cloture: cloture ? dateFr(cloture) : null,
        avancement: d.avancementLignes ?? null,
      };
    });
  });
  /** Le plan de l'URL s'il est en vigueur, sinon le plus récent ; aucun tant que le tableau des plans est affiché. */
  readonly plan = computed(() => {
    if (this.modeListe()) return null;
    const plans = this.plans();
    const id = this.idDemande();
    const cible = this.planCible();
    return plans.find((p) => p.idDossier === id) ?? plans.find((p) => cible.includes(p.idDossier)) ?? plans[0] ?? null;
  });
  /**
   * ⚠️ 04/11 (pilote) — `?dossier=` depuis « Tous mes dossiers » : le plan s'ouvre en deux volets sur la ligne du dossier, retrouvée par
   * sa filiation (`cibleDuDossier`) ; `planCible` = les versions du plan de cette filiation, `cible` = la ligne, consommée une fois choisie.
   */
  private readonly dossierDemande = Number(this.route.snapshot.queryParamMap.get('dossier')) || null;
  private readonly planCible = signal<number[]>([]);
  private readonly cible = signal<CibleDossier | null>(null);
  /** Le dossier demandé n'a pas de ligne dans ce plan : l'écran le dit et mène à sa page. */
  readonly cibleSansLigne = signal<number | null>(null);
  protected readonly lienDossier = inject(LienDossier);
  readonly ppmDuPlan = computed(() => {
    const p = this.plan();
    return p ? this.contenu()?.ppms.find((x) => x.idDossier === p.idDossier) ?? null : null;
  });
  /** L'entité contractante du plan, en clair (en-tête de l'AGPM). */
  readonly entiteDuPlan = computed(() => {
    const p = this.plan();
    return p?.idEntiteContract != null ? this.entites().get(String(p.idEntiteContract))?.trim() ?? null : null;
  });
  /** ⚠️ 03/11 (pilote) — la fiche de présentation du plan : même calcul que l'onglet du dossier (`calculerFichePresentation`). */
  readonly fiche = computed(() =>
    calculerFichePresentation(this.marchesDuPlan(), this.previsionsDuPlan(), this.contenu()?.modes ?? [], this.contenu()?.capmsRef ?? []),
  );
  readonly libelleVersionFiche = computed(() => {
    const n = this.ppmDuPlan()?.numMaj ?? 0;
    return n > 0 ? `Mise à jour n° ${n}` : 'Initial';
  });
  /** ⚠️ 03/11 (pilote) — le projet d'AGPM du plan : même calcul que l'onglet du dossier (`calculerAgpm`), sur les lignes du plan. */
  readonly agpm = computed(() =>
    calculerAgpm(this.marchesDuPlan(), this.previsionsDuPlan(), this.contenu()?.modes ?? [], this.contenu()?.capmsRef ?? [],
      new Map([...this.natures()].map(([k, v]) => [Number(k), v]))),
  );
  readonly marchesDuPlan = computed(() => {
    const p = this.plan();
    return p ? (this.contenu()?.marches ?? []).filter((m) => m.idDossier === p.idDossier && !m.supprimee) : [];
  });
  private readonly idsLignes = computed(() => new Set(this.marchesDuPlan().map((m) => m.idDetail)));
  /** ⚠️ 03/11 (lot 2) — le suivi de chaque ligne (idDetail), lu sur la filiation du plan et les lignes éligibles. */
  readonly suivis = computed(() => {
    const f = this.source.filiation();
    const eligibles = new Map(this.source.eligibles().map((e) => [e.idDetail, e]));
    const modes = this.source.modes();
    const r = new Map<number, SuiviLigne>();
    for (const m of this.marchesDuPlan()) {
      const noeuds = f ? dossiersDeLaLigne(f, m).filter((n) => n.lien !== 'RACINE' && n.lien !== 'VERSION_SUIVANTE') : [];
      r.set(m.idDetail, suiviDeLigne(eligibles.get(m.idDetail), noeuds, m.idMode != null ? modes.get(String(m.idMode)) ?? null : null));
    }
    return r;
  });
  /** Tant que le suivi n'est pas lu, l'étiquette garde le statut du marché. */
  readonly suiviFn = (m: Marche): (SuiviLigne & { teinte: TeinteLigne | null }) | null => {
    const s = this.source.filiation() ? this.suivis().get(m.idDetail) : undefined;
    return s ? { ...s, teinte: TEINTE_ETAPE[s.etape] } : null;
  };
  readonly teinte = TEINTE_ETAPE;
  // ⚠️ 04/11 (pilote, temps 2) — `?etape=lancee` ouvre le plan sur cette étape : c'est ce que faisait « Appels d'offres en cours ».
  // Consommée au premier plan affiché : l'effet qui charge un plan remet le filtre à zéro à chaque changement de plan.
  private etapeDemandee: EtapeLigne | null = ETAPES_LIGNE.find((e) => e.cle === this.route.snapshot.queryParamMap.get('etape'))?.cle ?? null;
  readonly filtre = signal<EtapeLigne | null>(null);
  /** ⚠️ 03/11 (lot 4) — la ligne choisie, commune aux deux présentations (`null` : aucune ligne ouverte dans le document). */
  readonly ligne = signal<number | null>(null);
  readonly presentation = signal<Presentation>(this.route.snapshot.queryParamMap.get('dossier') ? 'volets' : PlanPassation.lirePresentation());
  private readonly injector = inject(Injector);
  /** ⚠️ 04/11 (pilote) — la fenêtre d'un élément de dossier, ouverte depuis une barre du volet ; refermée quand la ligne change. */
  readonly modale = linkedSignal<Marche | null, OuvertureElement | null>({ source: () => this.ligneVolets(), computation: () => null });
  /** L'élément affiché dans la fenêtre ; un renvoi des pièces le change sans rouvrir la fenêtre. */
  readonly elementModale = signal<OngletDossier | null>(null);
  /** Le magasin de contenu de la barre, prêté aux composants de la fenêtre (`DossierDocuments` et ses blocs l'injectent). */
  readonly injecteurModale = computed(() => {
    const md = this.modale();
    return md ? Injector.create({ providers: [{ provide: DossierContenuStore, useValue: md.contenu }], parent: this.injector }) : this.injector;
  });
  /** En deux volets, une ligne est toujours choisie : celle de l'écran si elle est affichée, sinon la première. */
  readonly ligneVolets = computed(() => {
    const lignes = this.lignesAffichees();
    return lignes.find((m) => m.idDetail === this.ligne()) ?? lignes[0] ?? null;
  });
  private readonly natures = signal<Map<string, string>>(new Map());
  private readonly modes = signal<Map<string, string>>(new Map());
  readonly compteurs = computed(() => {
    const n = new Map<EtapeLigne, number>();
    for (const s of this.suivis().values()) n.set(s.etape, (n.get(s.etape) ?? 0) + 1);
    return ETAPES_LIGNE.map((e) => ({ ...e, n: this.source.filiation() ? n.get(e.cle) ?? 0 : 0 }));
  });
  /** ⚠️ 03/11 (pilote) — la recherche par mot clé : objet, mode, nature, financement, service bénéficiaire et compte de la ligne. */
  readonly recherche = signal('');
  /** Le texte cherchable de chaque ligne, sans accents ni casse. */
  private readonly texteDesLignes = computed(() => {
    const benefs = new Map<number, ServiceBeneficiaire[]>();
    for (const b of this.benefsDuPlan()) benefs.set(b.idDetail, [...(benefs.get(b.idDetail) ?? []), b]);
    return new Map(this.marchesDuPlan().map((m) => [m.idDetail, sansAccents([
      m.designationMarche, this.libelleMode(m), this.libelleNature(m), m.financement,
      ...(benefs.get(m.idDetail) ?? []).flatMap((b) => [b.soaCode, b.numCompte]),
    ].filter(Boolean).join(' '))]));
  });
  /** ⚠️ 04/11 (pilote) — la pagination de la liste des lignes (deux volets). */
  /**
   * ⚠️ 04/11 (pilote) — autant de lignes par page qu'il en tient dans la fenêtre, sous l'en-tête et les filtres, au-dessus de la
   * pagination et du pied de page : la page ne défile pas. Mesuré après rendu et à chaque redimensionnement (`ajusterParPage`).
   */
  readonly parPage = signal(10);
  /** La hauteur du volet de détail : la place sous le haut de la liste, au-dessus du pied de page (il défile seul au-delà). */
  readonly hauteurDetail = signal<number | null>(null);
  private readonly listeLignes = viewChild<ElementRef<HTMLElement>>('listeLignes');
  protected readonly min = Math.min;
  readonly nbPages = computed(() => Math.max(1, Math.ceil(this.lignesAffichees().length / this.parPage())));
  /** La page : celle de la ligne choisie quand elle est dans la liste (choix, `?dossier=`), sinon la première ; filtres et recherche y ramènent. */
  readonly page = linkedSignal<{ lignes: Marche[]; choisie: number | null; parPage: number }, number>({
    source: () => ({ lignes: this.lignesAffichees(), choisie: this.ligne(), parPage: this.parPage() }),
    computation: ({ lignes, choisie, parPage }) => {
      const i = choisie == null ? -1 : lignes.findIndex((m) => m.idDetail === choisie);
      return i < 0 ? 0 : Math.floor(i / parPage);
    },
  });
  readonly lignesDeLaPage = computed(() => this.lignesAffichees().slice(this.page() * this.parPage(), (this.page() + 1) * this.parPage()));

  /** La place sous le haut de la liste, moins la pagination et le pied de page, divisée par la hauteur d'une ligne (au moins 3). */
  private ajusterParPage(): void {
    const ul = this.listeLignes()?.nativeElement;
    if (!ul) return;
    const ligne = ul.querySelector('li') as HTMLElement | null;
    const hauteurLigne = ligne?.offsetHeight || 78;
    const haut = ul.getBoundingClientRect().top + window.scrollY;
    const pied = (document.querySelector('.pied-page') as HTMLElement | null)?.offsetHeight ?? 24;
    const pager = 48;
    const disponible = window.innerHeight - haut - pied - pager - 10;
    const n = Math.max(3, Math.floor(disponible / hauteurLigne));
    const detail = Math.max(320, Math.floor(window.innerHeight - haut - pied - 20));
    if (detail !== this.hauteurDetail()) this.hauteurDetail.set(detail);
    if (n !== this.parPage()) this.parPage.set(n);
  }

  readonly lignesAffichees = computed(() => {
    const f = this.filtre();
    const mots = sansAccents(this.recherche()).split(/\s+/).filter(Boolean);
    const textes = this.texteDesLignes();
    return this.marchesDuPlan().filter((m) => (!f || this.suivis().get(m.idDetail)?.etape === f)
      && mots.every((mot) => (textes.get(m.idDetail) ?? '').includes(mot)));
  });

  choisirEtape(valeur: string): void {
    this.filtre.set(ETAPES_LIGNE.find((e) => e.cle === valeur)?.cle ?? null);
  }

  effacerFiltres(): void {
    this.filtre.set(null);
    this.recherche.set('');
  }
  readonly benefsDuPlan = computed(() => (this.contenu()?.benefs ?? []).filter((b) => this.idsLignes().has(b.idDetail)));
  readonly previsionsDuPlan = computed(() => (this.contenu()?.previsions ?? []).filter((x) => this.idsLignes().has(x.idDetail)));

  /** Le titre de la page : « Plan de passation 2026 » une fois le plan lu. */
  readonly titrePage = computed(() => {
    const exercice = this.ppmDuPlan()?.exercice;
    if (this.modeListe()) return 'Plans de passation';
    return this.plan() && exercice ? `Plan de passation ${exercice}` : 'Plan de passation';
  });
  /** Sous le titre : la référence du plan, son entité, sa clôture et son nombre de lignes. */
  readonly sousTitrePage = computed(() => {
    const p = this.plan();
    if (this.modeListe()) return 'Les plans en vigueur de votre périmètre : un clic ouvre le plan.';
    return p ? [p.refeDossier, this.metaPlan()].filter(Boolean).join(' · ') : 'Le plan signé tel qu’il a été contrôlé, et où en est chacune de ses lignes.';
  });
  /** ⚠️ 03/11 (pilote) — les cinq onglets, leur couleur (palette) et leur nombre (`null` : pas de nombre). */
  readonly onglets = computed<{ cle: Presentation; libelle: string; teinte: string; n: number | null }[]>(() => [
    { cle: 'document', libelle: 'Document officiel', teinte: 'nuit', n: this.marchesDuPlan().length },
    { cle: 'volets', libelle: 'Deux volets', teinte: 'bleu', n: this.marchesDuPlan().length },
    { cle: 'fiche', libelle: 'Fiche de présentation', teinte: 'vert', n: this.fiche().nbMarchesConcernes },
    { cle: 'agpm', libelle: 'Projet d’AGPM', teinte: 'or', n: this.agpm().length },
  ]);
  readonly ongletActif = computed(() => this.onglets().find((o) => o.cle === this.presentation()) ?? this.onglets()[0]);
  readonly titrePlan = computed(() => {
    const p = this.plan();
    const exercice = this.ppmDuPlan()?.exercice;
    return p ? `Plan de passation${exercice ? ' ' + exercice : ''} · ${p.refeDossier ?? 'Dossier ' + p.idDossier}` : '';
  });
  readonly metaPlan = computed(() => {
    const p = this.plan();
    if (!p) return '';
    const entite = p.idEntiteContract != null ? this.entites().get(String(p.idEntiteContract)) : null;
    const cloture = p.datesEtapes?.['CLOTURE'];
    const n = this.marchesDuPlan().length;
    return [entite?.trim(), cloture ? `clôturé le ${dateFr(cloture)}` : null, `${n} ligne${n > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
  });

  private abonnement = new Subscription();

  constructor() {
    // Le nombre de lignes par page suit la place disponible : après chaque rendu de la liste, et quand la fenêtre change de taille.
    // Relu aussi quand ce qui précède la liste change (message de chargement du suivi, avis « sans ligne », lignes filtrées) : la
    // liste remonte ou descend, et le nombre de lignes avec elle.
    afterRenderEffect(() => {
      this.source.chargement();
      this.source.filiation();
      this.cibleSansLigne();
      this.lignesAffichees();
      if (this.listeLignes()) this.ajusterParPage();
    });
    const surRedimension = (): void => this.ajusterParPage();
    window.addEventListener('resize', surRedimension);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('resize', surRedimension));
    if (this.dossierDemande) this.chercherCible(this.dossierDemande);
    effect(() => {
      const c = this.cible();
      const p = this.plan();
      const lignes = this.marchesDuPlan();
      if (!c || !p || !c.plans.includes(p.idDossier) || !lignes.length) return;
      untracked(() => {
        this.cible.set(null);
        const m = lignes.find((x) => x.idDetail === c.idDetail || (c.idLigneOrigine != null && x.idLigneOrigine === c.idLigneOrigine));
        if (!m) { this.cibleSansLigne.set(this.dossierDemande); return; }
        // Après l'effet du changement de plan, qui remet la ligne à zéro ; puis la ligne choisie vient à l'écran dans la liste.
        setTimeout(() => {
          this.ligne.set(m.idDetail);
          setTimeout(() => document.querySelector('.pp__ligne[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' }));
        });
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.abonnement.unsubscribe();
      this.abonnementReels.unsubscribe();
    });
    // Le suivi des lignes se lit dès l'affichage d'un plan (filiation + lignes éligibles), une fois par plan ; le filtre repart à zéro.
    effect(() => {
      const p = this.plan();
      untracked(() => {
        this.filtre.set(p ? this.etapeDemandee : null);
        if (p) this.etapeDemandee = null;
        this.recherche.set('');
        this.ligne.set(null);
        if (p) this.source.charger(p.idDossier);
        this.chargerReels(p?.idDossier ?? null);
      });
    });
  }

  ngOnInit(): void {
    this.charger();
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entites.set(m));
    this.lookups.lookup(CapmService, 'idCapm', ['libelleProcessus']).subscribe((m) => this.capms.set(m));
    this.lookups.lookup(NatureService, 'idNature', ['libelle']).subscribe((m) => this.natures.set(m));
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modes.set(m));
  }

  charger(): void {
    this.abonnement.unsubscribe();
    this.chargement.set(true);
    this.erreur.set(false);
    this.abonnement = forkJoin({
      dossiers: this.dossiers.list(),
      ppms: this.ppmService.list(),
      marches: this.marcheService.list(),
      benefs: this.benefService.list().pipe(catchError(() => of([] as ServiceBeneficiaire[]))),
      previsions: this.previsionService.list().pipe(catchError(() => of([] as MarchePrevision[]))),
      // Dates réelles des jalons : silencieuses, le détail montre alors les seules dates prévues.
      echeances: this.echeanceService.list().pipe(catchError(() => of([] as Echeance[]))),
      // Référentiels complets du projet d'AGPM (modes, processus CAPM).
      modes: this.modeService.list().pipe(catchError(() => of([] as ModePassation[]))),
      capmsRef: this.capmService.list().pipe(catchError(() => of([] as Capm[]))),
    }).subscribe({
      next: (r) => {
        this.contenu.set({ plans: plansEnVigueur(r.dossiers, r.ppms), ppms: r.ppms, marches: r.marches, benefs: r.benefs, previsions: r.previsions, echeances: r.echeances, modes: r.modes, capmsRef: r.capmsRef });
        this.chargement.set(false);
        // Un identifiant d'URL qui n'est pas un plan en vigueur : on montre le plus récent, à sa propre adresse.
        const id = this.idDemande();
        if (id != null && !this.plans().some((p) => p.idDossier === id) && this.plans().length) {
          void this.router.navigate([this.espace, 'plan'], { replaceUrl: true });
        }
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  choisirPresentation(p: Presentation): void {
    this.presentation.set(p);
    try {
      localStorage.setItem(CLE_PRESENTATION, p);
    } catch {
      // Stockage indisponible (mode privé, quota) : le choix vaut pour la session.
    }
  }

  private static lirePresentation(): Presentation {
    try {
      const p = localStorage.getItem(CLE_PRESENTATION) as Presentation | null;
      return p && PRESENTATIONS.includes(p) ? p : 'document';
    } catch {
      return 'document';
    }
  }

  libelleMode(m: Marche): string {
    return m.idMode != null ? this.modes().get(String(m.idMode)) ?? '—' : '—';
  }

  libelleNature(m: Marche): string {
    return m.idNature != null ? this.natures().get(String(m.idNature)) ?? '—' : '—';
  }

  montant(m: Marche): string {
    return montantOfficiel(m.montEstim);
  }

  /**
   * ⚠️ 04/11 (pilote, redondances) — la fiche officielle de la ligne en une ligne : nature · mode · financement · imputations (service
   * bénéficiaire, compte ; sa part quand il y en a plusieurs). Le montant est dans l'en-tête ; l'initial n'y revient que s'il a changé.
   */
  ficheEnLigne(m: Marche): string {
    const benefs = this.benefsDe(m);
    const imputations = benefs.map((b) => `${b.soaCode || '—'}, compte ${b.numCompte || '—'}${benefs.length > 1 ? ' : ' + this.montantBenef(b) + ' Ar' : ''}`);
    return [this.libelleNature(m), this.libelleMode(m), m.financement || null, ...imputations, m.nouvMontEstim ? `montant initial ${this.montant(m)} Ar` : null]
      .filter(Boolean).join(' · ');
  }

  /** ⚠️ 04/11 (pilote) — l'écran de procédure ouvert en fenêtre ; refermé quand la ligne change. */
  readonly ecran = linkedSignal<Marche | null, OuvertureEcran | null>({ source: () => this.ligneVolets(), computation: () => null });
  readonly composantEcran = signal<Type<unknown> | null>(null);
  readonly ecranEnErreur = signal(false);
  readonly injecteurEcran = computed(() => {
    const ec = this.ecran();
    return ec ? Injector.create({ providers: [{ provide: ActivatedRoute, useValue: routeDeProcedure(ec.idDmc) }], parent: this.injector }) : this.injector;
  });

  /** Lit la filiation du dossier demandé (`?dossier=`), puis choisit son plan et sa ligne. */
  private chercherCible(id: number): void {
    this.dossiers.filiation(id).subscribe({
      next: (f) => {
        if (!f?.racine) { this.cibleSansLigne.set(id); return; }
        const c = cibleDuDossier(f, id);
        this.planCible.set(c.plans);
        if (c.idDetail == null) this.cibleSansLigne.set(id);
        else this.cible.set(c);
      },
      error: () => this.cibleSansLigne.set(id),
    });
  }

  ouvrirEcran(e: OuvertureEcran): void {
    this.composantEcran.set(null);
    this.ecranEnErreur.set(false);
    this.ecran.set(e);
    CHARGEURS_ECRAN[e.cle]().then(
      (c) => { if (this.ecran() === e) this.composantEcran.set(c); },
      () => { if (this.ecran() === e) this.ecranEnErreur.set(true); },
    );
  }

  fermerEcran(): void {
    this.ecran.set(null);
    this.composantEcran.set(null);
  }

  /** ⚠️ 04/11 (pilote) — la fenêtre des jalons de la ligne choisie ; refermée quand la ligne change. */
  readonly jalonsOuverts = linkedSignal<Marche | null, boolean>({ source: () => this.ligneVolets(), computation: () => false });
  /** « 10 / 28 » sur le bouton : jalons réalisés sur le total de la ligne choisie. */
  readonly resumeJalons = computed(() => {
    const m = this.ligneVolets();
    if (!m) return null;
    const j = jalonsDuJour(this.previsionsDe(m), this.capms(), this.echeancesDe(m), this.reelsDe(m));
    return j.length ? { realises: j.filter((x) => !!x.reel).length, total: j.length } : null;
  });

  ouvrirElement(e: OuvertureElement): void {
    this.elementModale.set(e.cle);
    this.modale.set(e);
  }

  fermerModale(): void {
    this.modale.set(null);
    this.elementModale.set(null);
  }

  libelleModale(): string {
    const md = this.modale();
    const cle = this.elementModale();
    return md && cle ? libelleElement(md.contenu, cle) : 'Dossier';
  }

  montantNouveau(m: Marche): string {
    return montantOfficiel(m.nouvMontEstim);
  }

  montantBenef(b: ServiceBeneficiaire): string {
    return montantOfficiel(b.nouvMontBenef ?? b.ancMontBenef);
  }

  benefsDe(m: Marche): ServiceBeneficiaire[] {
    return this.benefsDuPlan().filter((b) => b.idDetail === m.idDetail);
  }

  previsionsDe(m: Marche): MarchePrevision[] {
    return this.previsionsDuPlan().filter((p) => p.idDetail === m.idDetail);
  }

  reelsDe(m: Marche): JalonReel[] | null {
    const r = this.reels();
    return r ? r.get(m.idDetail) ?? [] : null;
  }

  private chargerReels(idPlan: number | null): void {
    this.abonnementReels.unsubscribe();
    this.reels.set(null);
    if (idPlan == null) return;
    this.abonnementReels = this.dossiers.jalonsReels(idPlan).subscribe({
      next: (rows) => {
        const m = new Map<number, JalonReel[]>();
        for (const r of rows ?? []) m.set(r.idDetail, [...(m.get(r.idDetail) ?? []), r]);
        this.reels.set(m);
      },
      // Route absente (serveur pas encore à jour) ou refus : le détail garde les dates des échéances, sans erreur affichée.
      error: () => this.reels.set(null),
    });
  }

  echeancesDe(m: Marche): Echeance[] {
    return (this.contenu()?.echeances ?? []).filter((e) => e.idDetail === m.idDetail);
  }

  /** « 00001/PPM-AGPM · 2026 » : le numéro du plan et son exercice. */
  /** ⚠️ 04/11 — l'espace de l'écran (« /prmp », « /president », « /cc », « /membre ») : ses liens restent dans l'espace d'où l'on vient. */
  protected readonly espace = '/' + (this.router.url.split(/[/?#]/)[1] || 'prmp');

  choisirPlan(id: string): void {
    void this.router.navigate([this.espace, 'plan', Number(id)]);
  }

  /** Les plans, rangés par entité puis par référence. */
  readonly plansTries = computed(() => [...this.plans()].sort((a, b) => this.libellePlanLong(a).localeCompare(this.libellePlanLong(b))));

  /** « MINISTERE DES TRAVAUX PUBLICS — 00001/PPM-AGPM · 2026 » : l'entité d'abord, pour qui voit les plans de toute une localité. */
  libellePlanLong(d: Dossier): string {
    const entite = d.idEntiteContract != null ? this.entites().get(String(d.idEntiteContract))?.trim() : null;
    return entite ? `${entite} — ${this.libellePlanCourt(d)}` : this.libellePlanCourt(d);
  }

  libellePlanCourt(d: Dossier): string {
    const exercice = this.contenu()?.ppms.find((x) => x.idDossier === d.idDossier)?.exercice;
    const ref = (d.refeDossier ?? `Dossier ${d.idDossier}`).split('/CNM/')[0];
    return exercice ? `${ref} · ${exercice}` : ref;
  }
}
