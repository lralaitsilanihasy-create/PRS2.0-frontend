import { DatePipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';

import { ApiError, codeErreur, corpsErreur } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { telechargerBlob } from '../../../core/securite/fichiers-surs';
import {
  CatalogueModelePv,
  ChampModelePv,
  CategorieMarche,
  CouvertureSousType,
  ConditionModelePv,
  DocumentPage,
  MOTIF_VERSION_DEPART,
  ModelePvFiche,
  PorteeDepart,
  SchemaModelePv,
  SousTypeDossier,
  VersionModelePv,
} from '../../../models';
import { ModelePvService, SousTypeDossierService, TypeDossierService } from '../../../services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { ApercuVersion } from './apercu-version';
import { CatalogueVariables } from './catalogue-variables';
import { ChampsVersion } from './champs-version';
import { ConditionsVersion } from './conditions-version';
import { FormulaireApercu } from './formulaire-apercu';
import { EditeurPage } from './page/editeur-page';
import { EcartsArmp } from './ecarts-armp';
import {
  LIBELLES_ACTION,
  LIBELLES_ETAT_VERSION,
  CATEGORIES_MARCHE,
  LIBELLES_NATURE,
  MOTIF_CODE_MODELE,
  expressionProposee,
  libelleDeCode,
  champsLusPar,
  libelleCategorie,
  modeleSupprimable,
  nonDeclares,
  reprisParModele,
  tailleLisible,
} from './modeles-pv-libelles';
import { RapportControlePv } from './rapport-controle-pv';

type Onglet = 'depot' | 'variables' | 'champs' | 'apercu';
type Modale = 'vigueur' | 'dupliquer' | 'archiver' | 'supprimerVersion' | 'supprimer' | null;

const FAMILLES: Readonly<Record<string, string>> = {
  DDP: 'Plan de passation',
  DMC: 'Dossier de mise en concurrence',
  DDM: 'Dossier de marché',
};
const BADGE_ETAT: Readonly<Record<string, string>> = { BROUILLON: 'badge-warning', EN_VIGUEUR: 'badge-success', REMPLACEE: 'badge-neutral' };

/**
 * ⚠️ Générateur de modèles de PV, lot G1 (V138, 20/10 ; maquette, écrans 2 à 6) — la fiche d'un modèle : ses versions (déposer
 * un `.docx`, lire le rapport de contrôle, déclarer conditions et champs sur un brouillon, essayer sur un dossier réel, mettre en
 * vigueur avec un motif), les sous-types qu'il sert, son historique. Une version en vigueur ou remplacée est figée.
 */
@Component({
  selector: 'app-modele-pv-fiche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LowerCasePipe, RouterLink, EtatErreur, ModaleDirective, RapportControlePv, ConditionsVersion, ChampsVersion, ApercuVersion, CatalogueVariables, FormulaireApercu, EditeurPage, EcartsArmp],
  template: `
    <section class="mpf">
      <a class="mpf__retour" routerLink="/admin/referentiels/modeles-pv" [queryParams]="ongletRetour()">← Tous les modèles de documents</a>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger ce modèle de PV." (reessayer)="charger()" />
      } @else if (fiche(); as f) {
        <header class="mpf__bandeau">
          <small>{{ typesModele[f.nature] }} · {{ f.code }}</small>
          <h1>{{ f.libelle }}</h1>
          <div class="mpf__puces">
            @if (f.nature === 'PROJET_MARCHE') {
              <span class="mpf__puce">{{ (f.categories ?? []).length ? categoriesLisibles(f.categories) : 'aucune catégorie servie' }} · Word et PDF</span>
            } @else if (f.nature === 'DOCUMENT_DAO') {
              <span class="mpf__puce">{{ (f.sigles ?? []).length ? 'Document ' + f.sigles![0] : 'aucun document servi' }} · Word et PDF</span>
            } @else {
              <span class="mpf__puce">{{ f.sousTypes.length ? f.sousTypes.length + ' sous-type(s) · ' + libelleFamille(famille()) : 'aucun sous-type servi' }}</span>
            }
            @if (f.etat === 'ARCHIVE') { <span class="mpf__puce mpf__puce--claire">Archivé le {{ f.archiveLe | date: 'dd/MM/yyyy' }}</span> }
            @else { <span class="mpf__puce mpf__puce--claire">{{ enVigueur() ? 'En vigueur : version ' + enVigueur()!.numero : 'Aucune version en vigueur' }}</span> }
          </div>
          <div class="mpf__archiver">
            @if (supprimable()) {
              <button type="button" class="btn btn-danger btn-sm" (click)="ouvrirModale('supprimer')">Supprimer définitivement</button>
            }
            @if (f.etat === 'ACTIF') {
              <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirModale('archiver')">Archiver</button>
            }
          </div>
        </header>
        @if (repris().length) {
          <p class="alert alert-info">
            <span>
              {{ repris().join(' · ') }} {{ repris().length > 1 ? 'sont encore servis' : 'est encore servi' }} par les <strong>fichiers intégrés</strong> de l’application.
              Ce modèle les remplacera quand le générateur produira les PV, une fois ses rendus comparés à ceux des fichiers actuels sur des
              dossiers réels (« Aperçu sur un dossier »). D’ici là, sa mise en vigueur ne change aucun PV.
            </span>
          </p>
        }
        @if (f.etat === 'ARCHIVE' && f.motifArchivage) { <p class="alert alert-info"><span>Motif de l’archivage : {{ f.motifArchivage }}</span></p> }

        <div class="mpf__grille">
          <div class="card mpf__carte">
            <h2 class="mpf__titre">Versions</h2>
            @if (f.versions.length) {
              <table class="mpf__table">
                <thead><tr><th scope="col">Version</th><th scope="col">État</th><th scope="col">Déposée</th><th scope="col"><span class="cnm-sr-only">Actions</span></th></tr></thead>
                <tbody>
                  @for (v of f.versions; track v.numero) {
                    <tr [class.mpf__choisie]="v.numero === version()?.numero">
                      <td><strong>v{{ v.numero }}</strong></td>
                      <td>
                        <span [class]="'badge ' + badgeEtat[v.etat]">{{ etats[v.etat] }}</span>
                        @if (v.juriste; as j) { <span class="badge badge-info" [title]="'Écarts au document type validés par ' + j.nom + ', ' + j.qualite + ', le ' + j.date">écarts validés</span> }
                        @if (v.bloquant) { <span class="badge badge-danger">bloquant</span> }
                        @if (v.support === 'WORD') { <span class="badge badge-neutral" title="Ancien dépôt Word : consultation seulement">Word</span> }
                      </td>
                      <td>{{ v.deposeeLe | date: 'dd/MM/yyyy' }} par {{ v.deposeePar }}</td>
                      <td class="mpf__actions-ligne">
                        @if (v.numero !== version()?.numero) {
                          <button type="button" class="btn btn-ghost btn-sm" (click)="choisir(v.numero)">Ouvrir</button>
                        } @else if (v.etat === 'BROUILLON' && v.support === 'PAGE' && f.etat === 'ACTIF') {
                          <button type="button" class="btn btn-primary btn-sm" [disabled]="v.bloquant" (click)="mettreEnVigueurVersion(v.numero)"
                                  [attr.title]="v.bloquant ? 'Le rapport de contrôle est bloquant' : null">Mettre en vigueur</button>
                        } @else {
                          <span class="mpf__ouverte">ouverte</span>
                        }
                        @if (v.etat === 'BROUILLON' && f.etat === 'ACTIF') {
                          <button type="button" class="btn btn-ghost btn-sm mpf__supprimer" [attr.aria-label]="'Supprimer la version ' + v.numero"
                                  (click)="supprimerVersion(v.numero)">Supprimer</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="text-muted">Aucune version : partez d’une page vierge, ou laissez l’application préparer un modèle de départ.</p>
            }
            @if (!aUnePage()) {
              @if (f.etat === 'ACTIF') {
                <div class="mpf__depart">
                  <p class="mpf__depart-titre">Modèle de départ</p>
                  <p class="mpf__note">
                    @if (f.nature === 'PV') {
                      L’application assemble le PV officiel et les phrases de la famille servie, avec ses règles et ses champs déjà déclarés.
                    } @else if (f.nature === 'DOCUMENT_DAO') {
                      L’application convertit le document type de l’ARMP intégré pour ce document ({{ f.sigles?.[0] ?? '—' }}) en page modifiable,
                      avec ses règles, ses passages et les données de la fiche DAO. Le départ est la référence des écarts au document type.
                    } @else if (f.nature === 'PROJET_MARCHE') {
                      L’application recopie mot pour mot le projet de marché qu’elle produit aujourd’hui pour la catégorie choisie (marché simple et
                      contrat-cadre), avec ses variables, ses règles et ses articles numérotés.
                    } @else {
                      L’application reprend la lettre de renvoi actuelle (centrale et régionale), avec ses variables et ses règles déjà déclarées.
                      Une seule lettre sert tous les sous-types.
                    }
                    Il arrive en brouillon : faites-en valider le texte par la CNM, puis corrigez-le dans l’onglet « Texte et mise en page ».
                  </p>
                  @if (f.nature === 'DOCUMENT_DAO') {
                    @if ((f.sigles ?? []).length) {
                      <div class="mpf__depart-ligne">
                        <button type="button" class="btn btn-primary btn-sm" [disabled]="generation()" (click)="genererDepart()">
                          {{ generation() ? 'Conversion…' : 'Générer un modèle de départ' }}
                        </button>
                      </div>
                    } @else {
                      <p class="mpf__note"><strong>Ce modèle ne sert aucun document du DAO</strong> : créez-le depuis l’onglet « Dossier de mise en concurrence ».</p>
                    }
                  } @else if (f.nature === 'PROJET_MARCHE') {
                    <div class="mpf__depart-ligne">
                      <label class="mpf__depart-portee">
                        <span>Catégorie</span>
                        <select class="form-control" aria-label="Catégorie du modèle de départ" (change)="categorieDepart.set($any($event.target).value)">
                          @for (c of categoriesMarche; track c.code) { <option [value]="c.code" [selected]="c.code === categorieDepartEffective()">{{ c.libelle }}</option> }
                        </select>
                      </label>
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="generation()" (click)="genererDepart()">
                        {{ generation() ? 'Assemblage…' : 'Générer un modèle de départ' }}
                      </button>
                    </div>
                  } @else if (f.nature === 'PV' && !f.sousTypes.length) {
                    <p class="mpf__note"><strong>Cochez d’abord les sous-types servis</strong> : ils disent quelle famille assembler.</p>
                  } @else {
                    <div class="mpf__depart-ligne">
                      <label class="mpf__depart-portee">
                        <span>Commissions</span>
                        <select class="form-control" aria-label="Commissions couvertes par le modèle de départ" [value]="portee()" (change)="portee.set($any($event.target).value)">
                          @for (o of portees; track o.cle) { <option [value]="o.cle" [selected]="o.cle === portee()">{{ o.libelle }}</option> }
                        </select>
                      </label>
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="generation()" (click)="genererDepart()">
                        {{ generation() ? 'Assemblage…' : 'Générer un modèle de départ' }}
                      </button>
                    </div>
                  }
                  @if (messageDepart(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
                </div>
              }
            }
            @if (messageDepot(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
            <div class="mpf__boutons">
              @if (f.etat === 'ACTIF') {
                <button type="button" class="btn btn-secondary btn-sm" [disabled]="ecriture()" (click)="pageVierge()">Nouvelle page vierge</button>
              }
              @if (version(); as v) {
                @if (v.support === 'WORD') { <button type="button" class="btn btn-secondary btn-sm" (click)="telecharger(v)">Télécharger le .docx</button> }
              }
              @if (f.etat === 'ACTIF' && f.versions.length) { <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirModale('dupliquer')">Dupliquer le modèle</button> }
            </div>
          </div>

          <div class="card mpf__carte">
            @if (f.nature === 'DOCUMENT_DAO') {
            <h2 class="mpf__titre">Document du DAO servi</h2>
            <p class="mpf__resume">{{ (f.sigles ?? []).length ? f.sigles!.join(' · ') : 'Aucun.' }}</p>
            <p class="mpf__note">
              Un modèle sert un seul document, pour toutes les formes de marché qui le choisissent. Sans version en vigueur, le document reste produit
              par son document type intégré.
            </p>
            } @else if (f.nature === 'PROJET_MARCHE') {
            <h2 class="mpf__titre">Catégories servies</h2>
            <div class="mpf__sts">
              @for (c of categoriesMarche; track c.code) {
                <label class="mpf__st">
                  <input type="checkbox" [checked]="categoriesCochees().includes(c.code)" [disabled]="f.etat === 'ARCHIVE'"
                         (change)="basculerCategorie(c.code, $any($event.target).checked)" />
                  <span>{{ c.libelle }}</span>
                </label>
              }
            </div>
            <p class="mpf__note">Une catégorie n’a qu’un modèle. Sans modèle en vigueur, le projet de marché de la catégorie reste produit par le texte de l’application.</p>
            @if (messageRattachement(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
            @if (f.etat === 'ACTIF' && categoriesModifiees()) {
              <div class="mpf__boutons">
                <button type="button" class="btn btn-primary btn-sm" [disabled]="ecriture()" (click)="enregistrerCategories()">Enregistrer les catégories</button>
                <button type="button" class="btn btn-secondary btn-sm" (click)="categoriesCochees.set(f.categories ?? [])">Annuler</button>
              </div>
            }
            } @else {
            <div class="mpf__titre-ligne">
              <h2 class="mpf__titre">Sous-types servis</h2>
              @if (f.etat === 'ACTIF' && !editionSousTypes()) {
                <button type="button" class="btn btn-ghost btn-sm" (click)="editionSousTypes.set(true)">Modifier</button>
              }
              @if (editionSousTypes() && famillesSousTypes().length > 1) {
                <select class="form-control mpf__famille-choix" aria-label="Famille de dossiers" [value]="famille()" (change)="famille.set($any($event.target).value)">
                  @for (g of famillesSousTypes(); track g.famille) { <option [value]="g.famille" [selected]="g.famille === famille()">{{ g.libelle }}</option> }
                </select>
              }
            </div>
            @if (!editionSousTypes()) {
              <p class="mpf__resume">{{ f.sousTypes.length ? codesSousTypes().join(' · ') : 'Aucun : cochez les sous-types que ce modèle sert.' }}</p>
            } @else {
            <div class="mpf__sts">
              @for (s of sousTypesDeLaFamille(); track s.idSousType) {
                <label class="mpf__st">
                  <input type="checkbox" [checked]="rattaches().includes(s.idSousType)" [disabled]="f.etat === 'ARCHIVE'"
                         (change)="basculerSousType(s.idSousType, $any($event.target).checked)" />
                  <span>{{ s.idSousType }} — {{ s.libelleSousType }}</span>
                </label>
              }
            </div>
            @if (autresRattaches().length) { <p class="mpf__note">Aussi servis, dans une autre famille : {{ autresRattaches().join(' · ') }}.</p> }
            <p class="mpf__note">Un sous-type n’a qu’un modèle en vigueur à la fois.</p>
            @if (messageRattachement(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
            <div class="mpf__boutons">
              <button type="button" class="btn btn-primary btn-sm" [disabled]="ecriture() || !rattachementsModifies()" (click)="enregistrerRattachements()">Enregistrer les sous-types</button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="annulerSousTypes()">Fermer</button>
            </div>
            }
            }

            <h2 class="mpf__titre mpf__titre--histo">Historique</h2>
            <ul class="mpf__histo">
              @for (h of historiqueAffiche(); track $index) {
                <li>
                  {{ h.le | date: 'dd/MM HH:mm' }} — {{ actions[h.action] ?? h.action }}@if (h.numeroVersion) { v{{ h.numeroVersion }}} par {{ h.par }}@if (detailLisible(h.detail); as d) {, {{ d }}}
                </li>
              } @empty { <li class="text-muted">Rien encore.</li> }
            </ul>
            @if (f.historique.length > 3) {
              <button type="button" class="mpf__lien" (click)="toutHistorique.set(!toutHistorique())">
                {{ toutHistorique() ? 'Les 3 derniers seulement' : 'Tout l’historique (' + f.historique.length + ')' }}
              </button>
            }
          </div>
        </div>

        @if (version(); as v) {
          <div class="card mpf__carte">
            <div class="mpf__titre-ligne">
              <h2 class="mpf__titre">Version {{ v.numero }} — {{ etats[v.etat] | lowercase }} · {{ v.support === 'PAGE' ? 'page' : v.nomFichier + ' (' + taille(v.taille) + ')' }}</h2>
              @if (v.etat !== 'BROUILLON') {
                <span class="mpf__note">Figée@if (v.enVigueurLe) {, en vigueur le {{ v.enVigueurLe | date: 'dd/MM/yyyy' }} par {{ v.enVigueurPar }}}@if (v.remplaceeLe) {, remplacée le {{ v.remplaceeLe | date: 'dd/MM/yyyy' }}}@if (v.motif) { — « {{ v.motif }} »}</span>
              }
            </div>
            <div class="mpf__onglets" role="tablist" aria-label="Contenu de la version">
              @for (o of onglets; track o.cle; let i = $index) {
                <button type="button" role="tab" class="mpf__onglet" [class.mpf__onglet--on]="onglet() === o.cle" [attr.aria-selected]="onglet() === o.cle"
                        (click)="onglet.set(o.cle)">
                  {{ i + 1 }}. {{ o.libelle }}
                  @if (o.cle === 'depot' && onglet() !== 'depot' && v.rapport?.nbBloquants) { <span class="badge badge-danger">{{ v.rapport!.nbBloquants }}</span> }
                </button>
              }
            </div>
            <div role="tabpanel" class="mpf__panneau">
              @switch (onglet()) {
                @case ('depot') {
                  @if (v.support === 'PAGE') {
                    @if (estDepart(v)) {
                      <p class="alert alert-warning mpf__a-valider" role="note">
                        <span><strong>Texte proposé par l’application — à faire valider par la CNM avant mise en vigueur.</strong>
                          Corrigez-le ci-dessous.
                          @if (fiche()?.nature === 'PROJET_MARCHE') {
                            Les « …… » restent dans le Word produit, pour que la PRMP les complète avant la signature.
                          } @else {
                            À compléter au besoin : la qualité du viseur et la mention « par intérim », et les lignes des présents sans nom.
                          }</span>
                      </p>
                    }
                    @if (detail(); as d) {
                      <app-editeur-page [documentInitial]="d.document ?? null" [catalogue]="catalogue()" [schema]="schema()" [conditions]="v.conditions"
                                        [champs]="v.champs" [figee]="figee()" [enregistrement]="ecriture()" [nbBloquants]="v.rapport?.nbBloquants ?? 0" (voirRapport)="voirRapport()"
                                        (enregistrer)="enregistrerBrouillon($event)" (nouvelleVersion)="enregistrerNouvelleVersion($event)" />
                    } @else {
                      <p class="text-muted" role="status">Chargement de la page…</p>
                    }
                    @if (messagePage(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
                  } @else {
                    <p class="alert alert-info"><span><strong>Version Word, en consultation.</strong> Les modèles se rédigent désormais dans l’application :
                      générez un modèle de départ en page, ou partez d’une page vierge. Cette version ne peut plus être mise en vigueur.</span></p>
                    <div class="mpf__boutons"><button type="button" class="btn btn-secondary btn-sm" (click)="telecharger(v)">Télécharger le .docx</button></div>
                  }
                  @let nd = aDeclarer();
                  @if (!figee() && (nd.conditions.length || nd.champs.length)) {
                    <div class="mpf__declarer" role="note">
                      <p class="mpf__declarer-titre">La page utilise des éléments pas encore déclarés</p>
                      <ul class="mpf__declarer-liste">
                        @for (c of nd.conditions; track c) {
                          <li>Passage « {{ c }} » —
                            @if (proposition(c); as e) { règle proposée : <code>{{ e }}</code> } @else { <em>règle à écrire dans « Variables et conditions »</em> }
                          </li>
                        }
                        @for (c of nd.champs; track c) { <li>Champ « {{ libelleDe(c) }} » (<code>{{ c }}</code>) — texte long, facultatif (à préciser dans « Champs saisis »)</li> }
                      </ul>
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="ecriture()" (click)="declarerCeQueLeWordUtilise()">
                        {{ ecriture() ? 'Déclaration…' : 'Déclarer ce que la page utilise' }}
                      </button>
                      @if (messageDeclaration(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
                    </div>
                  }
                  <h3 class="mpf__titre" id="rapport-controle" tabindex="-1">Rapport de contrôle</h3>
                  <app-rapport-controle-pv [rapport]="v.rapport" [page]="v.support === 'PAGE'" (aller)="allerA($event)" (inserer)="insererManquante($event)"
                                           [declarable]="!figee() && !ecriture()" (declarer)="declarerCeQueLeWordUtilise()" />
                  @if (f.nature === 'DOCUMENT_DAO' && v.support === 'PAGE') {
                    <app-ecarts-armp [idModele]="f.id" [numero]="v.numero" [empreinte]="v.empreinte" (aller)="allerAuPassage($event)" />
                  }
                }
                @case ('variables') {
                  @if (v.support === 'PAGE') {
                    <h3 class="mpf__titre">Les règles des passages conditionnels</h3>
                    <app-conditions-version [conditions]="v.conditions" [catalogue]="catalogue()" [champs]="codesChamps()"
                                            [utilisees]="v.rapport?.conditionsUtilisees ?? []" [figee]="figee()"
                                            [enregistrement]="ecriture()" [erreurs]="messageConditions()" (enregistrer)="enregistrerConditions($event)" />
                  } @else {
                    <div class="mpf__deux">
                      <div>
                        <h3 class="mpf__titre">Catalogue des variables@if (catalogue()?.famille; as fam) { — {{ libelleFamille(fam) }}}</h3>
                        <app-catalogue-variables [catalogue]="catalogue()" />
                      </div>
                      <div>
                        <h3 class="mpf__titre">Les règles des passages conditionnels</h3>
                        <app-conditions-version [conditions]="v.conditions" [catalogue]="catalogue()" [champs]="codesChamps()"
                                                [utilisees]="v.rapport?.conditionsUtilisees ?? []" [figee]="figee()"
                                                [enregistrement]="ecriture()" [erreurs]="messageConditions()" (enregistrer)="enregistrerConditions($event)" />
                      </div>
                    </div>
                  }
                }
                @case ('champs') {
                  <h3 class="mpf__titre">Les champs que le membre remplit à l’examen</h3>
                  <app-champs-version [champs]="v.champs" [conditions]="nomsConditions()" [utilises]="v.rapport?.champsUtilises ?? []"
                                      [figee]="figee()" [enregistrement]="ecriture()" [erreurs]="messageChamps()" (enregistrer)="enregistrerChamps($event)" />
                  <app-formulaire-apercu [champs]="v.champs" [conditions]="v.conditions" />
                }
                @case ('apercu') {
                  <app-apercu-version [idModele]="f.id" [numero]="v.numero" [champs]="v.champs" [codeModele]="f.code" [avecWord]="v.support !== 'PAGE' || documentMarche()" [avecAvis]="f.nature === 'PV'"
                                      [surProcedure]="documentMarche()"
                                      [sousTypesServis]="codesSousTypes()" />
                }
              }
            </div>
          </div>
        }
      }
    </section>

    @if (modale(); as m) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="titreModale()" appModale (appModaleFermer)="fermerModale()">
          <div class="modal-header">
            <h2 class="modal-title">{{ titreModale() }}</h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerModale()">✕</button>
          </div>
          <div class="modal-body mpf__form">
            @switch (m) {
              @case ('vigueur') {
                <p>
                  @if (documentMarche()) {
                    La version {{ version()?.numero }} produira ce document à la place du texte actuel.
                    @if (enVigueur(); as ev) { La version {{ ev.numero }} passera « remplacée ». } Les documents déjà produits ne changent pas.
                  } @else {
                    La version {{ version()?.numero }} servira aux PV à venir des sous-types de ce modèle.
                    @if (enVigueur(); as ev) { La version {{ ev.numero }} passera « remplacée ». } Les PV déjà signés gardent la version qui les a produits.
                  }
                </p>
                @if (nbEcartsArmp() > 0) {
                  <p class="alert alert-warning"><span>Cette version s’écarte du document type de l’ARMP ({{ nbEcartsArmp() }} écart{{ nbEcartsArmp() > 1 ? 's' : '' }}) :
                    sa mise en vigueur demande la validation du juriste.</span></p>
                  <label class="form-group">
                    <span class="form-label">Juriste qui a validé (nom)</span>
                    <input class="form-control" [value]="juristeNom()" (input)="juristeNom.set($any($event.target).value)" />
                  </label>
                  <label class="form-group">
                    <span class="form-label">Qualité</span>
                    <input class="form-control" [value]="juristeQualite()" (input)="juristeQualite.set($any($event.target).value)" />
                  </label>
                  <label class="form-group">
                    <span class="form-label">Date de la validation</span>
                    <input class="form-control" type="date" [value]="juristeDate()" (input)="juristeDate.set($any($event.target).value)" />
                  </label>
                }
                <label class="form-group">
                  <span class="form-label">Motif (obligatoire)</span>
                  <textarea class="form-control" rows="3" [value]="motif()" (input)="motif.set($any($event.target).value)"></textarea>
                </label>
              }
              @case ('dupliquer') {
                <p>La copie reprend la version en vigueur (à défaut la dernière), ses conditions et ses champs, en brouillon v1, sans sous-type servi.</p>
                <label class="form-group">
                  <span class="form-label">Code de la copie</span>
                  <input class="form-control" [value]="codeCopie()" (input)="codeCopie.set($any($event.target).value)" />
                </label>
                <label class="form-group">
                  <span class="form-label">Libellé de la copie</span>
                  <input class="form-control" [value]="libelleCopie()" (input)="libelleCopie.set($any($event.target).value)" />
                </label>
              }
              @case ('archiver') {
                <p>Un modèle archivé est détaché de ses sous-types et ne reçoit plus de version.
                  @if (enService()) { <strong>Il sert aujourd’hui {{ fiche()?.sousTypes?.length }} sous-type(s) : leurs PV n’auront plus de modèle.</strong> }
                </p>
                <label class="form-group">
                  <span class="form-label">Motif{{ enService() ? ' (obligatoire)' : ' (facultatif)' }}</span>
                  <textarea class="form-control" rows="3" [value]="motif()" (input)="motif.set($any($event.target).value)"></textarea>
                </label>
              }
              @case ('supprimerVersion') {
                @if (versionASupprimer(); as v) {
                  <p>
                    La version {{ v.numero }} ({{ v.support === 'WORD' ? 'Word' : 'page' }}, du {{ v.deposeeLe | date: 'dd/MM/yyyy' }}) sera supprimée,
                    avec ses règles et ses champs. Elle n’a jamais été en vigueur : aucun PV n’en dépend.
                  </p>
                  <p class="text-muted">Son numéro ne sera pas repris : la prochaine version portera le numéro suivant. Le journal du modèle garde la trace.</p>
                }
              }
              @case ('supprimer') {
                <p>
                  Le modèle <strong>{{ fiche()?.libelle }}</strong> ({{ fiche()?.code }}) et ses {{ fiche()?.versions?.length }} version(s) seront supprimés.
                  Il n’a jamais été en vigueur : aucun PV n’en dépend.
                </p>
                <p class="text-muted">La suppression est définitive. Elle reste tracée au journal de l’application.</p>
              }
            }
            @if (messageModale(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="fermerModale()">Annuler</button>
            <button type="button" class="btn" [class.btn-primary]="m === 'vigueur' || m === 'dupliquer'" [class.btn-danger]="m !== 'vigueur' && m !== 'dupliquer'"
                    [disabled]="ecriture() || !modaleValide()" (click)="validerModale()">
              {{ ecriture() ? 'Enregistrement…' : boutonModale[m] }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .mpf { display: flex; flex-direction: column; gap: 1rem; }
    .mpf__retour { align-self: flex-start; font-size: 0.85rem; font-weight: 600; color: var(--p-700); text-decoration: none; }
    .mpf__retour:hover { text-decoration: underline; }
    .mpf__bandeau { position: relative; background: linear-gradient(120deg, #075985, var(--p-600)); color: #fff; border-radius: 14px; padding: 1rem 1.25rem; }
    .mpf__bandeau small { opacity: 0.9; font-weight: 700; letter-spacing: 0.06em; }
    .mpf__bandeau h1 { margin: 0.25rem 0 0.5rem; font-size: 1.3rem; color: #fff; }
    .mpf__puces { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .mpf__puce { padding: 0.1rem 0.6rem; border-radius: 999px; background: rgba(255, 255, 255, 0.18); font-size: 0.8rem; }
    .mpf__puce--claire { background: #fff; color: var(--p-700); font-weight: 600; }
    .mpf__archiver { position: absolute; top: 1rem; right: 1.25rem; display: flex; gap: 0.4rem; }
    .mpf__supprimer { color: var(--danger-text, #991b1b); }
    .mpf__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr)); gap: 1rem; align-items: start; }
    /* « overflow: visible » : la carte de l'application coupe ce qui déborde, ce qui empêcherait la barre de l'éditeur de rester visible. */
    .mpf__carte { overflow: visible; padding: 1rem 1.15rem; display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
    .mpf__titre-ligne { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .mpf__titre { margin: 0; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--p-700); }
    .mpf__titre--histo { margin-top: 0.6rem; }
    .mpf__table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .mpf__table th { text-align: left; background: var(--p-50); color: var(--p-700); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.5rem 0.6rem; }
    .mpf__table td { padding: 0.55rem 0.6rem; border-top: 1px solid var(--n-100); vertical-align: middle; }
    .mpf__choisie td { background: var(--p-50); }
    .mpf__actions-ligne { text-align: right; white-space: nowrap; width: 1%; }
    .mpf__ouverte { font-size: 0.78rem; color: var(--n-500); }
    .mpf__resume { margin: 0; font-family: Consolas, monospace; font-size: 0.85rem; color: var(--n-700); line-height: 1.6; }
    .mpf__lien { align-self: flex-start; border: 0; background: none; padding: 0; color: var(--p-700); text-decoration: underline; cursor: pointer; font: inherit; font-size: 0.85rem; }
    .mpf__actions-ligne .btn + .btn { margin-left: 0.3rem; }
    .mpf__note { margin: 0; font-size: 0.8rem; color: var(--n-500); }
    .mpf__boutons { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .mpf__famille-choix { width: auto; max-width: 16rem; font-size: 0.85rem; }
    .mpf__sts { display: flex; flex-direction: column; gap: 0.3rem; }
    .mpf__st { display: flex; gap: 0.45rem; align-items: flex-start; font-size: 0.88rem; color: var(--n-700); }
    .mpf__st input { margin-top: 0.22rem; }
    .mpf__enreg { align-self: flex-start; }
    .mpf__histo { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; color: var(--n-700); max-height: 16rem; overflow: auto; }
    .mpf__onglets { display: flex; gap: 0.45rem; flex-wrap: wrap; border-bottom: 1px solid var(--n-200); padding-bottom: 0.7rem; }
    .mpf__onglet { font: inherit; font-size: 0.88rem; font-weight: 600; padding: 0.35rem 0.9rem; border: 1.5px solid #152033; border-radius: 999px;
      background: #fff; color: #152033; cursor: pointer; display: inline-flex; gap: 0.35rem; align-items: center; }
    .mpf__onglet--on { background: #152033; color: #fff; }
    .mpf__panneau { padding-top: 0.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .mpf__depart { border: 1px dashed var(--p-300, #7dd3fc); background: var(--p-50); border-radius: 10px; padding: 0.7rem 0.9rem;
      display: flex; flex-direction: column; gap: 0.4rem; }
    .mpf__depart-titre { margin: 0; font-weight: 600; color: var(--p-700); font-size: 0.9rem; }
    .mpf__depart-ligne { display: flex; gap: 0.6rem; align-items: flex-end; flex-wrap: wrap; }
    .mpf__depart-portee { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.8rem; color: var(--n-700); }
    .mpf__depart-portee select { width: auto; min-width: 16rem; }
    .mpf__a-valider { margin: 0; }
    .mpf__declarer { border: 1px solid var(--warning-bdr); background: var(--warning-bg); border-radius: 10px; padding: 0.7rem 0.9rem;
      display: flex; flex-direction: column; gap: 0.45rem; align-items: flex-start; }
    .mpf__declarer-titre { margin: 0; font-weight: 600; color: #854D0E; font-size: 0.9rem; }
    .mpf__declarer-liste { margin: 0; padding-left: 1.1rem; font-size: 0.85rem; color: var(--n-800); display: flex; flex-direction: column; gap: 0.2rem; }
    .mpf__aide { background: var(--p-50); border-left: 3px solid var(--p-600); padding: 0.6rem 0.75rem; border-radius: 6px; font-size: 0.85rem; color: var(--n-700); }
    .mpf__deux { display: grid; grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr)); gap: 1.25rem; align-items: start; }
    .mpf__deux > div { display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
    .mpf__form { display: flex; flex-direction: column; gap: 0.75rem; }
    code { font-family: Consolas, monospace; font-size: 0.85em; }
    @media (max-width: 760px) { .mpf__archiver { position: static; margin-top: 0.6rem; } }
  `,
})
export class ModelePvFicheEcran implements OnInit {
  private readonly service = inject(ModelePvService);
  private readonly sousTypesService = inject(SousTypeDossierService);
  private readonly typesService = inject(TypeDossierService);
  private readonly libellesFamilles = signal<Record<string, string>>({});
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly route = inject(ActivatedRoute);
  /** Paramètre de route `:id` (une duplication rouvre la page sur la copie). */
  private readonly idCourant = signal(0);

  readonly natures = LIBELLES_NATURE;
  readonly etats = LIBELLES_ETAT_VERSION;
  readonly actions = LIBELLES_ACTION;
  readonly badgeEtat = BADGE_ETAT;
  readonly taille = tailleLisible;
  readonly onglets: readonly { cle: Onglet; libelle: string }[] = [
    { cle: 'depot', libelle: 'Texte et mise en page' },
    { cle: 'variables', libelle: 'Règles' },
    { cle: 'champs', libelle: 'Champs du formulaire' },
    { cle: 'apercu', libelle: 'Aperçu' },
  ];
  readonly o = '{{';
  readonly f2 = '}}';

  readonly loading = signal(true);
  readonly erreur = signal(false);
  readonly fiche = signal<ModelePvFiche | null>(null);
  readonly catalogue = signal<CatalogueModelePv | null>(null);
  readonly sousTypes = signal<SousTypeDossier[]>([]);
  readonly numeroChoisi = signal<number | null>(null);
  readonly onglet = signal<Onglet>('depot');
  /** La famille dont la carte « Sous-types servis » montre les sous-types (par défaut, celle des sous-types servis). */
  readonly famille = signal<string>('');

  readonly messageDepot = signal<string | null>(null);
  readonly ecriture = signal(false);
  readonly messageConditions = signal<string | null>(null);
  readonly messageChamps = signal<string | null>(null);
  readonly rattaches = signal<string[]>([]);
  readonly messageRattachement = signal<string | null>(null);

  readonly modale = signal<Modale>(null);
  readonly motif = signal('');
  readonly codeCopie = signal('');
  readonly libelleCopie = signal('');
  readonly messageModale = signal<string | null>(null);

  readonly version = computed<VersionModelePv | null>(() => {
    const vs = this.fiche()?.versions ?? [];
    return vs.find((v) => v.numero === this.numeroChoisi()) ?? vs[0] ?? null;
  });
  readonly enVigueur = computed(() => this.fiche()?.versions.find((v) => v.etat === 'EN_VIGUEUR') ?? null);
  readonly figee = computed(() => this.version()?.etat !== 'BROUILLON' || this.fiche()?.etat === 'ARCHIVE');
  readonly codesChamps = computed(() => (this.version()?.champs ?? []).map((c) => c.code));
  readonly nomsConditions = computed(() => (this.version()?.conditions ?? []).map((c) => c.nom));
  readonly codesSousTypes = computed(() => (this.fiche()?.sousTypes ?? []).map((s) => s.id));
  /** Les sous-types servis encore produits par des fichiers intégrés (le plan, la lettre de renvoi). */
  /** Les blocs et champs que le Word de la version utilise sans les avoir déclarés. */
  readonly aDeclarer = computed(() => {
    const v = this.version();
    return v ? nonDeclares(v.rapport, v.conditions, v.champs) : { conditions: [], champs: [] };
  });
  readonly messageDeclaration = signal<string | null>(null);
  /** La liste à cocher des sous-types n'est dépliée que pour les modifier. */
  readonly editionSousTypes = signal(false);
  readonly toutHistorique = signal(false);
  readonly historiqueAffiche = computed(() => {
    const h = this.fiche()?.historique ?? [];
    return this.toutHistorique() ? h : h.slice(0, 3);
  });

  // ——— ⚠️ 21/10 (option C') — la page éditée ———
  private readonly editeur = viewChild(EditeurPage);
  /** La version affichée, avec son document (la fiche ne sert pas les documents). */
  readonly detail = signal<VersionModelePv | null>(null);
  readonly schema = signal<SchemaModelePv | null>(null);
  readonly messagePage = signal<string | null>(null);
  /** Le modèle a-t-il déjà une version en page ? Sinon, le modèle de départ reste proposé. */
  readonly aUnePage = computed(() => (this.fiche()?.versions ?? []).some((v) => v.support === 'PAGE'));

  readonly portees: readonly { cle: PorteeDepart; libelle: string }[] = [
    { cle: 'les-deux', libelle: 'Centrale et régionale (un bloc chacune)' },
    { cle: 'centrale', libelle: 'Commission centrale seule' },
    { cle: 'regionale', libelle: 'Commission régionale seule' },
  ];
  readonly portee = signal<PorteeDepart>('les-deux');

  // ——— ⚠️ 22/10 (M1 « modeles-documents-marche ») — le projet de marché : un modèle par catégorie, en Word et en PDF ———
  readonly typesModele: Readonly<Record<string, string>> = {
    PV: 'MODÈLE DE PV',
    LETTRE_RENVOI: 'MODÈLE DE LETTRE DE RENVOI',
    PROJET_MARCHE: 'MODÈLE DE PROJET DE MARCHÉ',
    DOCUMENT_DAO: 'MODÈLE DE DOCUMENT DU DAO',
  };
  /** Un projet de marché ou un document du DAO : Word et PDF, essayé sur une procédure et un lot. */
  readonly ongletRetour = computed(() => ({ PROJET_MARCHE: { onglet: 'marche' }, DOCUMENT_DAO: { onglet: 'dao' } } as Record<string, Record<string, string>>)[this.fiche()?.nature ?? ''] ?? {});
  readonly documentMarche = computed(() => ['PROJET_MARCHE', 'DOCUMENT_DAO'].includes(this.fiche()?.nature ?? ''));

  // ——— ⚠️ 22/10 (D-ARMP) — la validation du juriste, exigée à la mise en vigueur d'une version qui s'écarte du document type ———
  /** Le nombre d'écarts de la version choisie, lu sur son rapport (un point `ECART_ARMP` par écart). */
  readonly nbEcartsArmp = computed(() => (this.version()?.rapport?.points ?? []).filter((p) => p.code === 'ECART_ARMP').length);
  readonly juristeNom = signal('');
  readonly juristeQualite = signal('');
  readonly juristeDate = signal(new Date().toISOString().slice(0, 10));
  readonly categoriesMarche = CATEGORIES_MARCHE;
  readonly categoriesCochees = signal<CategorieMarche[]>([]);
  readonly categoriesModifiees = computed(() => [...this.categoriesCochees()].sort().join() !== [...(this.fiche()?.categories ?? [])].sort().join());
  /** La catégorie du départ : celle choisie, à défaut la première servie, à défaut la première de la liste. */
  readonly categorieDepart = signal<CategorieMarche | null>(null);
  readonly categorieDepartEffective = computed(() => this.categorieDepart() ?? this.fiche()?.categories?.[0] ?? CATEGORIES_MARCHE[0].code);

  categoriesLisibles(c: readonly string[] | undefined): string {
    return (c ?? []).map(libelleCategorie).join(' · ');
  }

  basculerCategorie(code: CategorieMarche, coche: boolean): void {
    this.messageRattachement.set(null);
    this.categoriesCochees.update((l) => (coche ? [...new Set([...l, code])] : l.filter((x) => x !== code)));
  }

  enregistrerCategories(): void {
    if (this.ecriture()) return;
    this.ecriture.set(true);
    this.messageRattachement.set(null);
    this.service.rattacherCategories(this.idModele, this.categoriesCochees()).subscribe({
      next: (f) => {
        this.ecriture.set(false);
        this.toast.success('Catégories servies enregistrées.');
        this.appliquer(f);
      },
      error: (e: ApiError) => {
        this.ecriture.set(false);
        this.messageRattachement.set(
          codeErreur(e) === 'CATEGORIE_DEJA_SERVIE' ? e.message || 'Cette catégorie est déjà servie par un autre modèle : retirez-la de celui-ci d’abord.'
          : this.messageAvecDetails(e, 'Les catégories n’ont pas été enregistrées.'),
        );
      },
    });
  }
  readonly generation = signal(false);
  readonly messageDepart = signal<string | null>(null);

  /** Une version assemblée par l'application (motif posé par le serveur) : son texte reste à faire valider par la CNM. */
  estDepart(v: VersionModelePv): boolean {
    return (v.motif ?? '').startsWith(MOTIF_VERSION_DEPART);
  }
  readonly proposition = expressionProposee;
  readonly libelleDe = libelleDeCode;

  readonly repris = computed(() => (this.fiche()?.etat === 'ACTIF' ? reprisParModele(this.couverture(), this.idModele) : []));
  /** La couverture servie (`/couverture`), relue à chaque application de la fiche (les rattachements la changent). */
  private readonly couverture = signal<CouvertureSousType[]>([]);
  readonly enService = computed(() => !!this.enVigueur() && !!this.fiche()?.sousTypes.length);

  readonly famillesSousTypes = computed(() => {
    const parFamille = new Map<string, SousTypeDossier[]>();
    for (const s of this.sousTypes()) parFamille.set(s.idTypeDossier, [...(parFamille.get(s.idTypeDossier) ?? []), s]);
    return [...parFamille.entries()].map(([famille, sousTypes]) => ({ famille, libelle: this.libellesFamilles()[famille] ?? FAMILLES[famille] ?? famille, sousTypes }));
  });

  readonly sousTypesDeLaFamille = computed(() => this.famillesSousTypes().find((g) => g.famille === this.famille())?.sousTypes ?? []);

  /** Sous-types cochés hors de la famille affichée : rappelés pour qu'aucun rattachement ne soit invisible. */
  readonly autresRattaches = computed(() => {
    const ici = new Set(this.sousTypesDeLaFamille().map((s) => s.idSousType));
    return this.rattaches().filter((s) => !ici.has(s));
  });

  readonly rattachementsModifies = computed(() => [...this.rattaches()].sort().join() !== [...this.codesSousTypes()].sort().join());

  // ——— ⚠️ 21/10 — supprimer un brouillon, ou un modèle qui n'a jamais servi ———
  readonly supprimable = computed(() => {
    const f = this.fiche();
    return !!f && modeleSupprimable(f);
  });
  private readonly numeroASupprimer = signal<number | null>(null);
  readonly versionASupprimer = computed(() => this.fiche()?.versions.find((v) => v.numero === this.numeroASupprimer()) ?? null);

  readonly boutonModale: Readonly<Record<Exclude<Modale, null>, string>> = {
    vigueur: 'Mettre en vigueur',
    dupliquer: 'Dupliquer',
    archiver: 'Archiver',
    supprimerVersion: 'Supprimer la version',
    supprimer: 'Supprimer définitivement',
  };

  readonly titreModale = computed(() => {
    switch (this.modale()) {
      case 'vigueur':
        return `Mettre en vigueur la version ${this.version()?.numero}`;
      case 'dupliquer':
        return 'Dupliquer le modèle';
      case 'supprimerVersion':
        return `Supprimer la version ${this.numeroASupprimer()}`;
      case 'supprimer':
        return 'Supprimer le modèle';
      default:
        return 'Archiver le modèle';
    }
  });
  readonly modaleValide = computed(() => {
    switch (this.modale()) {
      case 'vigueur':
        return !!this.motif().trim() && (this.nbEcartsArmp() === 0 || (!!this.juristeNom().trim() && !!this.juristeQualite().trim() && !!this.juristeDate()));
      case 'dupliquer':
        return MOTIF_CODE_MODELE.test(this.codeCopie().trim()) && !!this.libelleCopie().trim();
      case 'archiver':
        return !this.enService() || !!this.motif().trim();
      case 'supprimerVersion':
        return !!this.versionASupprimer();
      case 'supprimer':
        return this.supprimable();
      default:
        return false;
    }
  });

  constructor() {
    // La version affichée change : on lit son document (une page) ; une version Word n'en a pas.
    effect(() => {
      const v = this.version();
      this.detail.set(null);
      this.messagePage.set(null);
      if (!v || v.support !== 'PAGE') return;
      this.service
        .version(this.idModele, v.numero)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (d) => this.detail.set(d), error: (e: ApiError) => this.messagePage.set(e.message || 'La page n’a pas pu être lue.') });
    });
  }

  ngOnInit(): void {
    this.service
      .schema()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (s) => this.schema.set(s), error: () => this.schema.set(null) });
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((pm) => {
      this.idCourant.set(Number(pm.get('id')));
      this.numeroChoisi.set(null);
      this.catalogue.set(null);
      this.fiche.set(null);
      this.charger();
    });
  }

  private get idModele(): number {
    return this.idCourant();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    forkJoin({ fiche: this.service.fiche(this.idModele), sousTypes: this.sousTypesService.listeSilencieuse(), familles: this.typesService.listeSilencieuse() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ fiche, sousTypes, familles }) => {
          this.sousTypes.set(sousTypes);
          this.libellesFamilles.set(Object.fromEntries(familles.map((t) => [t.idTypeDossier, t.libelleType ?? t.idTypeDossier])));
          this.appliquer(fiche);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.erreur.set(true);
        },
      });
  }

  /** Recharge la fiche après une écriture, en gardant la version affichée. */
  private recharger(numero?: number): void {
    this.service
      .fiche(this.idModele)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (f) => {
          if (numero != null) this.numeroChoisi.set(numero);
          this.appliquer(f);
        },
        error: () => this.erreur.set(true),
      });
  }

  private appliquer(f: ModelePvFiche): void {
    const avant = this.fiche()?.sousTypes.map((s) => s.id).join();
    this.fiche.set(f);
    this.service
      .couverture()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.couverture.set(c), error: () => this.couverture.set([]) });
    this.rattaches.set(f.sousTypes.map((s) => s.id));
    this.categoriesCochees.set([...(f.categories ?? [])]);
    const familleServie = f.sousTypes.find((s) => s.famille)?.famille;
    if (familleServie) this.famille.set(familleServie);
    else if (!this.famille()) this.famille.set(this.sousTypes()[0]?.idTypeDossier ?? '');
    // Le catalogue suit la famille du premier sous-type servi ; sans sous-type, tout le catalogue. Une lettre : celui de sa nature
    // (⚠️ 22/10, L1) — une variable hors de sa nature serait bloquante au contrôle.
    if (this.catalogue() === null || avant !== f.sousTypes.map((s) => s.id).join()) {
      const lettre = f.nature !== 'PV';
      const sigle = f.nature === 'DOCUMENT_DAO' ? (f.sigles?.[0] ?? null) : null;
      this.service
        .variables(lettre ? null : (f.sousTypes[0]?.id ?? null), lettre ? f.nature : null, sigle)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (c) => this.catalogue.set(c), error: () => this.catalogue.set(null) });
    }
  }

  libelleFamille(code: string): string {
    return this.libellesFamilles()[code] ?? FAMILLES[code] ?? code;
  }

  /** « Essayer » : la version choisie, ouverte sur son aperçu. */
  essayer(numero: number): void {
    this.choisir(numero);
    this.onglet.set('apercu');
  }

  supprimerVersion(numero: number): void {
    this.numeroASupprimer.set(numero);
    this.ouvrirModale('supprimerVersion');
  }

  mettreEnVigueurVersion(numero: number): void {
    this.choisir(numero);
    this.ouvrirModale('vigueur');
  }

  choisir(numero: number): void {
    this.numeroChoisi.set(numero);
    this.messageConditions.set(null);
    this.messageChamps.set(null);
  }

  /** Le modèle de départ : une version en brouillon, assemblée par le serveur, ouverte sur son rapport. */
  genererDepart(): void {
    if (this.generation()) return;
    this.generation.set(true);
    this.messageDepart.set(null);
    const categorie = this.fiche()?.nature === 'PROJET_MARCHE' ? this.categorieDepartEffective() : null;
    this.service.genererDepart(this.idModele, this.portee(), categorie, this.fiche()?.nature === 'DOCUMENT_DAO').subscribe({
      next: (v) => {
        this.generation.set(false);
        this.onglet.set('depot');
        this.recharger(v.numero);
      },
      error: (e: ApiError) => {
        this.generation.set(false);
        const code = codeErreur(e);
        this.messageDepart.set(
          code === 'SANS_SOUS_TYPE' ? 'Cochez d’abord les sous-types servis : ils disent quelle famille assembler.'
          : code === 'FAMILLES_MULTIPLES' ? `Les sous-types servis relèvent de plusieurs familles (${this.detailsEnClair(e, (fam, sts) => `${fam} : ${sts}`)}) : gardez ceux d’une seule famille.`
          : code === 'FAMILLE_SANS_DEPART' ? 'Le plan de passation n’a pas de modèle de départ : il garde ses fichiers intégrés, repris plus tard.'
          : code === 'NATURE_SANS_DEPART' ? 'Le modèle de départ n’existe que pour un procès-verbal.'
          : code === 'CATEGORIE_REQUISE' ? 'Choisissez la catégorie du projet de marché.'
          : code === 'MODELE_ARCHIVE' ? 'Ce modèle est archivé.'
          : e.message || 'Le modèle de départ n’a pas pu être généré.',
        );
      },
    });
  }


  /** Une page vierge : une nouvelle version en brouillon, à remplir dans l'éditeur. */
  pageVierge(): void {
    this.enregistrerNouvelleVersion({ page: { format: 'A4' }, corps: { type: 'doc', content: [{ type: 'paragraph' }] } });
  }

  /** Enregistre le brouillon affiché (`PUT …/document`) : le rapport est recalculé. */
  enregistrerBrouillon(document: DocumentPage): void {
    const v = this.version();
    if (!v || this.ecriture()) return;
    this.ecriture.set(true);
    this.messagePage.set(null);
    this.service.modifierDocument(this.idModele, v.numero, document).subscribe({
      next: (d) => {
        this.ecriture.set(false);
        this.editeur()?.marquerEnregistre();
        this.detail.set(d);
        this.recharger(v.numero);
      },
      error: (e: ApiError) => {
        this.ecriture.set(false);
        this.messagePage.set(this.messageAvecDetails(e, 'La page n’a pas été enregistrée.'));
      },
    });
  }

  /** Enregistre comme nouvelle version (`POST …/versions`), en brouillon. */
  enregistrerNouvelleVersion(document: DocumentPage): void {
    if (this.ecriture()) return;
    this.ecriture.set(true);
    this.messagePage.set(null);
    this.messageDepot.set(null);
    this.service.enregistrerPage(this.idModele, document).subscribe({
      next: (v) => {
        this.ecriture.set(false);
        this.onglet.set('depot');
        this.recharger(v.numero);
      },
      error: (e: ApiError) => {
        this.ecriture.set(false);
        const m = this.messageAvecDetails(e, 'La version n’a pas été enregistrée.');
        this.messagePage.set(m);
        this.messageDepot.set(m);
      },
    });
  }

  /** Depuis le rapport : amène le curseur de l'éditeur sur le nœud fautif. */
  /** Depuis la barre de l'éditeur : descend au rapport de contrôle. */
  voirRapport(): void {
    const t = document.getElementById('rapport-controle');
    t?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    t?.focus({ preventScroll: true });
  }

  /** Depuis le rapport : insère, au curseur de l'éditeur, la variable d'une section absente — à enregistrer ensuite. */
  insererManquante(code: string): void {
    this.editeur()?.insererVariable(code);
  }

  allerA(chemin: string): void {
    this.editeur()?.allerA(chemin);
  }

  /** Depuis le panneau des écarts : le passage modifié, sélectionné dans l'éditeur. */
  allerAuPassage(passages: string[]): void {
    if (!this.editeur()?.chercher(passages)) this.toast.info('Ce passage n’a pas été trouvé tel quel dans la page : il est peut-être coupé par une donnée de la fiche.');
  }

  telecharger(v: VersionModelePv): void {
    this.service.fichier(this.idModele, v.numero).subscribe({
      next: (blob) => telechargerBlob(blob, v.nomFichier || `${this.fiche()?.code}-v${v.numero}.docx`),
      error: (e: ApiError) => this.toast.error(e.message || 'Le fichier n’a pas pu être téléchargé.'),
    });
  }

  enregistrerConditions(conditions: ConditionModelePv[]): void {
    const v = this.version();
    if (!v || this.ecriture()) return;
    this.ecriture.set(true);
    this.messageConditions.set(null);
    this.service.definirConditions(this.idModele, v.numero, conditions).subscribe({
      next: () => {
        this.ecriture.set(false);
        this.toast.success('Conditions enregistrées ; le rapport de contrôle est recalculé.');
        this.recharger(v.numero);
      },
      error: (e: ApiError) => {
        this.ecriture.set(false);
        this.messageConditions.set(this.messageAvecDetails(e, 'Les conditions n’ont pas été enregistrées.'));
      },
    });
  }

  enregistrerChamps(champs: ChampModelePv[]): void {
    const v = this.version();
    if (!v || this.ecriture()) return;
    this.ecriture.set(true);
    this.messageChamps.set(null);
    this.service.definirChamps(this.idModele, v.numero, champs).subscribe({
      next: () => {
        this.ecriture.set(false);
        this.toast.success('Champs enregistrés ; le rapport de contrôle est recalculé.');
        this.recharger(v.numero);
      },
      error: (e: ApiError) => {
        this.ecriture.set(false);
        this.messageChamps.set(this.messageAvecDetails(e, 'Les champs n’ont pas été enregistrés.'));
      },
    });
  }

  /**
   * Déclare d'un clic ce que le Word utilise : les conditions aux noms usuels (avis, portée, AGPM, forme) avec leur expression, puis
   * les champs saisis (texte long, facultatifs, à préciser ensuite). Les conditions sans expression proposée restent à écrire.
   */
  declarerCeQueLeWordUtilise(): void {
    const v = this.version();
    if (!v || this.ecriture()) return;
    const nd = this.aDeclarer();
    const conditions = [
      ...v.conditions,
      ...nd.conditions.filter((n) => expressionProposee(n)).map((n) => ({ nom: n, expression: expressionProposee(n), libelle: null })),
    ];
    // Les champs d'abord : ceux de la page, et ceux que lisent les règles proposées (`saisi.observation_generale`).
    const aAjouter = new Set([...nd.champs, ...conditions.slice(v.conditions.length).flatMap((c) => champsLusPar(c.expression))]);
    for (const c of v.champs) aAjouter.delete(c.code);
    const champs: ChampModelePv[] = [
      ...v.champs,
      ...[...aAjouter].map((c) => ({ code: c, libelle: libelleDeCode(c), type: 'TEXTE_LONG' as const, options: [], obligatoire: false, aide: null, visibleSi: null })),
    ];
    const restent = nd.conditions.filter((n) => !expressionProposee(n));
    this.ecriture.set(true);
    this.messageDeclaration.set(null);
    const champs$ = champs.length > v.champs.length ? this.service.definirChamps(this.idModele, v.numero, champs) : of(v);
    champs$
      .pipe(switchMap(() => (conditions.length > v.conditions.length ? this.service.definirConditions(this.idModele, v.numero, conditions) : of(v))))
      .subscribe({
        next: () => {
          this.ecriture.set(false);
          this.toast.success(
            restent.length
              ? `Déclaré. Reste à écrire la condition de : ${restent.join(', ')} (onglet « Variables et conditions »).`
              : 'Déclaré ; vérifiez les libellés et types des champs (onglet « Champs saisis »).',
          );
          this.recharger(v.numero);
        },
        error: (e: ApiError) => {
          this.ecriture.set(false);
          this.messageDeclaration.set(this.messageAvecDetails(e, 'La déclaration a échoué.'));
          this.recharger(v.numero);
        },
      });
  }

  /** Le détail d'un événement, sans ses mentions techniques (taille en octets, fichiers de base). */
  detailLisible(detail: string | null): string {
    return (detail ?? '')
      .replace(/,?\s*page de \d+ octets/g, '')
      .replace(/,?\s*(page reconstruite d’après|page reconstruite d'après|base) [^,]*\.docx( \+ [^,]*\.docx)?/g, '')
      .replace(/^,\s*/, '')
      .trim();
  }

  /** Referme la liste des sous-types sans rien enregistrer. */
  annulerSousTypes(): void {
    this.rattaches.set(this.codesSousTypes());
    this.messageRattachement.set(null);
    this.editionSousTypes.set(false);
  }

  basculerSousType(id: string, coche: boolean): void {
    this.rattaches.update((l) => (coche ? [...new Set([...l, id])] : l.filter((x) => x !== id)));
    this.messageRattachement.set(null);
  }

  enregistrerRattachements(): void {
    if (this.ecriture()) return;
    this.ecriture.set(true);
    this.service.rattacher(this.idModele, this.rattaches()).subscribe({
      next: (f) => {
        this.ecriture.set(false);
        this.toast.success('Sous-types servis enregistrés.');
        this.appliquer(f);
      },
      error: (e: ApiError) => {
        this.ecriture.set(false);
        this.messageRattachement.set(
          codeErreur(e) === 'SOUS_TYPE_DEJA_SERVI'
            ? `${this.detailsEnClair(e, (st, code) => `${st} est servi par ${code}`)} : détachez-le d’abord de ce modèle.`
            : this.messageAvecDetails(e, 'Les sous-types n’ont pas été enregistrés.'),
        );
      },
    });
  }

  ouvrirModale(m: Exclude<Modale, null>): void {
    const f = this.fiche();
    this.motif.set('');
    this.codeCopie.set(f ? `${f.code}-COPIE` : '');
    this.libelleCopie.set(f ? `${f.libelle} (copie)` : '');
    this.messageModale.set(null);
    this.modale.set(m);
  }

  fermerModale(): void {
    this.modale.set(null);
  }

  validerModale(): void {
    const m = this.modale();
    if (!m || this.ecriture() || !this.modaleValide()) return;
    this.ecriture.set(true);
    this.messageModale.set(null);
    const fin = () => this.ecriture.set(false);
    const echec = (e: ApiError, defaut: string) => {
      fin();
      this.messageModale.set(this.messageAvecDetails(e, defaut));
    };
    if (m === 'vigueur') {
      const v = this.version()!;
      const juriste = this.nbEcartsArmp() > 0 ? { nom: this.juristeNom().trim(), qualite: this.juristeQualite().trim(), date: this.juristeDate() } : null;
      this.service.mettreEnVigueur(this.idModele, v.numero, this.motif().trim(), juriste).subscribe({
        next: () => {
          fin();
          this.modale.set(null);
          this.toast.success(`Version ${v.numero} en vigueur.`);
          this.recharger(v.numero);
        },
        error: (e: ApiError) =>
          codeErreur(e) === 'RAPPORT_BLOQUANT' ? echec(e, 'Le rapport de contrôle est bloquant : corrigez la version d’abord.')
          : codeErreur(e) === 'VALIDATION_JURISTE_REQUISE' ? echec(e, 'La validation du juriste est requise.')
          : echec(e, 'La mise en vigueur a échoué.'),
      });
    } else if (m === 'dupliquer') {
      this.service.dupliquer(this.idModele, { code: this.codeCopie().trim(), libelle: this.libelleCopie().trim() }).subscribe({
        next: (copie) => {
          fin();
          this.modale.set(null);
          this.toast.success(`Modèle dupliqué : ${copie.code}.`);
          void this.router.navigate(['/admin/referentiels/modeles-pv', copie.id]);
        },
        error: (e: ApiError) => echec(e, codeErreur(e) === 'CODE_DEJA_PRIS' ? 'Ce code est déjà pris.' : 'La duplication a échoué.'),
      });
    } else if (m === 'supprimerVersion') {
      const numero = this.numeroASupprimer()!;
      const etaitOuverte = this.version()?.numero === numero;
      this.service.supprimerVersion(this.idModele, numero).subscribe({
        next: (f) => {
          fin();
          this.modale.set(null);
          this.toast.success(`Version ${numero} supprimée.`);
          // La version ouverte disparaît : la fiche se rouvre sur la plus récente.
          if (etaitOuverte) this.numeroChoisi.set(f.versions[0]?.numero ?? null);
          this.appliquer(f);
        },
        error: (e: ApiError) =>
          echec(e, codeErreur(e) === 'VERSION_NON_SUPPRIMABLE' ? 'Une version qui a été en vigueur ne se supprime pas.'
            : codeErreur(e) === 'MODELE_ARCHIVE' ? 'Ce modèle est archivé : ses versions ne se suppriment plus.' : 'La suppression a échoué.'),
      });
    } else if (m === 'supprimer') {
      const code = this.fiche()?.code;
      this.service.supprimer(this.idModele).subscribe({
        next: () => {
          fin();
          this.modale.set(null);
          this.toast.success(`Modèle ${code} supprimé.`);
          void this.router.navigate(['/admin/referentiels/modeles-pv']);
        },
        error: (e: ApiError) => {
          fin();
          const d = corpsErreur<{ details?: { raison?: string; sousTypes?: string[] } | null }>(e)?.details;
          this.messageModale.set(
            d?.raison === 'A_ETE_EN_VIGUEUR' ? 'Ce modèle a été en vigueur : il se garde, pour la traçabilité.'
            : d?.raison === 'SERT_DES_SOUS_TYPES' ? `Ce modèle sert encore ${(d.sousTypes ?? []).join(' · ') || 'des sous-types'} : détachez-les ou archivez le modèle.`
            : e.message || 'La suppression a échoué.',
          );
        },
      });
    } else {
      this.service.archiver(this.idModele, this.motif().trim() || null).subscribe({
        next: (f) => {
          fin();
          this.modale.set(null);
          this.toast.success('Modèle archivé.');
          this.appliquer(f);
        },
        error: (e: ApiError) => echec(e, codeErreur(e) === 'MODELE_EN_SERVICE' ? 'Ce modèle est en service : un motif est exigé.' : 'L’archivage a échoué.'),
      });
    }
  }

  /** Le message du serveur, suivi de ses `details` (par nom de condition, de champ ou de sous-type). */
  private messageAvecDetails(e: ApiError, defaut: string): string {
    const details = this.detailsEnClair(e, (cle, val) => `${cle} : ${val}`);
    const base = e.message || defaut;
    return details ? `${base} (${details})` : base;
  }

  private detailsEnClair(e: ApiError, f: (cle: string, valeur: string) => string): string {
    const d = corpsErreur<{ details?: Record<string, unknown> | null }>(e)?.details;
    return d && typeof d === 'object' ? Object.entries(d).map(([k, v]) => f(k, String(v))).join(' ; ') : '';
  }
}
