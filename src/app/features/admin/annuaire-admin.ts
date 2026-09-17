import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, merge } from 'rxjs';

import { libelleRole } from '../../core/auth/libelles-profils';
import {
  AnnuaireDelegation,
  AnnuaireFiche,
  AnnuairePersonne,
  Localite,
  StatutCompteAnnuaire,
  TypeActeur,
} from '../../models';
import { AnnuaireService, LocaliteService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { Icone } from '../../shared/ui/icone';
import { ActionsCompte } from './actions-compte';

/** Populations, dans l'ordre du filtre. `type` est le seul critère qui isole PRMP et UGPM. */
const TYPES: readonly { readonly valeur: TypeActeur; readonly libelle: string }[] = [
  { valeur: 'CONTROLEUR', libelle: 'Contrôleur' },
  { valeur: 'PRMP', libelle: 'PRMP' },
  { valeur: 'UGPM', libelle: 'UGPM' },
];

/**
 * Profils du filtre : ceux que porte un **contrôleur**. `PRMP` et `UGPM` n'en sont pas — leur type
 * tient lieu de rôle, et le serveur sert `profil: null` pour elles. Les proposer ici promettrait un
 * croisement qui n'existe pas (`?profil=PRMP` ne ramènerait jamais rien).
 */
const PROFILS: readonly string[] = [
  'PRESIDENT',
  'CHEF_COMMISSION',
  'SECRETAIRE',
  'MEMBRE',
  'VERIFICATEUR',
  'ASSISTANT_CONTROLEUR',
  'CHARGE_PUBLICATION',
  'ADMINISTRATEUR',
];

/** Les cinq états d'accès servis par l'annuaire, et ce qu'ils disent en français. */
const STATUTS: readonly { readonly valeur: StatutCompteAnnuaire; readonly libelle: string }[] = [
  { valeur: 'ACTIF', libelle: 'Actif' },
  { valeur: 'SUSPENDU', libelle: 'Suspendu' },
  { valeur: 'EN_ATTENTE', libelle: 'Inscription en attente' },
  { valeur: 'REFUSE', libelle: 'Inscription refusée' },
  { valeur: 'SANS_COMPTE', libelle: 'Sans compte' },
];

const LIBELLES_STATUTS: Readonly<Record<StatutCompteAnnuaire, string>> = {
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
  EN_ATTENTE: 'Inscription en attente',
  REFUSE: 'Inscription refusée',
  SANS_COMPTE: 'Sans compte',
};

/**
 * Les **huit écrans** que le sommaire `/admin/comptes` était le SEUL à donner — aucun n'a d'entrée
 * de menu (défaut §1.2 du plan L6). L'annuaire prend la place de ce sommaire : il doit donc porter
 * leur chemin, faute de quoi ce lot les rendrait injoignables au lieu de les mettre en valeur.
 *
 * La fiche d'une personne en atteint la plupart **en contexte** (« Modifier la fiche », « Pièces »,
 * « Ses entités », « Mandats PRMP »…). Cette liste est le filet : elle les tient tous, y compris
 * ceux qu'aucune personne ne désigne (organigrammes) et ceux qu'on ne peut pas atteindre quand la
 * population est vide (créer la première UGPM).
 */
const ECRANS_COMPTES: readonly { readonly libelle: string; readonly chemin: string; readonly aide: string }[] = [
  { libelle: 'Contrôleurs', chemin: '/admin/comptes/controleurs', aide: 'fiches, photo, profil, rattachement' },
  { libelle: 'PRMP', chemin: '/admin/comptes/prmps', aide: 'fiches et arrêtés de nomination' },
  { libelle: 'UGPM', chemin: '/admin/comptes/ugpms', aide: 'unités de gestion — création et compte' },
  { libelle: 'Organigrammes', chemin: '/admin/comptes/organigrammes', aide: "versions d'organigramme par ministère" },
  { libelle: 'Affectations PRMP ⇄ Entité', chemin: '/admin/comptes/prmp-entites', aide: 'qui pilote quelle entité' },
  { libelle: 'Mandats PRMP', chemin: '/admin/comptes/mandats', aide: 'nomination, reconduction, abrogation' },
  { libelle: 'Pièces jointes des PRMP', chemin: '/admin/comptes/prmp-pieces', aide: "arrêté, CIN, justificatifs" },
  { libelle: 'Pièces jointes des UGPM', chemin: '/admin/comptes/ugpm-pieces', aide: 'justificatifs déposés' },
];

/** Quinze lignes : la page tient à 1366×768 sans que la fiche, collée à droite, ne perde son ancrage. */
const TAILLE_PAGE = 15;

/** Un écran que la fiche ouverte concerne, avec son contexte quand la destination l'accepte. */
interface LienEcran {
  readonly libelle: string;
  readonly chemin: string;
  readonly parametres: Record<string, string>;
}

/**
 * **Annuaire des personnes** (lot 6, F3 — maquette `maquettes-design/admin/C-annuaire-au-centre`).
 *
 * `/admin/comptes` était un **sommaire de huit écrans** — la seule façon de les atteindre, puisque
 * aucun n'a d'entrée de menu. Cet écran le remplace par ce que l'administrateur cherche vraiment :
 * une **personne**, quelle que soit sa population (contrôleur, PRMP, UGPM), avec son accès, sa place
 * dans l'organisation et les gestes qui la concernent. Les huit écrans restent joignables — depuis
 * la fiche pour la plupart, et tous depuis le dépliant de pied de page (`ECRANS_COMPTES`).
 *
 * Tout vient de la ressource `/api/annuaire` (besoins backend B2 et B3), plus le référentiel des
 * localités : le serveur ne sert que le **code** (`ANT`), l'écran compose « ANT — Centrale ».
 *
 * ⚠️ **La recherche part au SERVEUR.** `q`, les quatre filtres et la pagination sont des paramètres
 * de requête. Filtrer la seule page affichée est le défaut M15 de l'audit (`dossiers-pipeline`) :
 * l'utilisateur croit chercher dans l'annuaire et ne cherche que dans quinze lignes.
 *
 * ⚠️ **2026-09-17, lot F5 — le bloc « Accès » est complet.** Les lignes **« Dernière connexion »** et
 * **« Échecs (30 j) »** de la maquette C sont rallumées : le journal des connexions (besoin backend
 * B4) existe, et le serveur ne sert plus ces deux champs nuls par construction. Mais la règle du §6
 * tient toujours là où la donnée manque **encore** :
 *
 * - **`derniereConnexion` nulle ⇒ ligne absente**, jamais « jamais connecté ». Elle est nulle pour
 *   qui ne s'est pas connecté **depuis que le journal existe** — au début, presque tout le monde.
 *   Écrire « jamais connecté » affirmerait quelque chose que personne ne sait ;
 * - `echecs30j` vaut `0`, plus `null` : la ligne s'écrit toujours, et « aucune tentative refusée »
 *   est une mesure, pas un trou.
 *
 * ⚠️ **Ce qui n'est PAS affiché, et pourquoi** (plan L6 §6 — « une mesure fausse sur un écran de
 * sécurité est pire qu'une mesure absente ») :
 *
 * - la colonne **« Connexion »** de la liste et le filtre **« Connexion »** de la maquette C :
 *   `GET /api/annuaire` (la LISTE) ne sert aucune date de connexion — seule la fiche en porte une.
 *   La colonne obligerait à une lecture par ligne, le filtre à un critère que le serveur n'accepte
 *   pas ; le quatrième filtre reste **« Type »** (contrôleur · PRMP · UGPM) ;
 * - la ligne **« Dossiers en cours — 4 dont 1 en retard »** du bloc « Activité » de la maquette :
 *   `AnnuaireFicheDto` ne la sert pas, et aucune route ne donne la charge d'une personne toutes
 *   populations confondues. Le bloc garde ce que le serveur mesure vraiment : les écritures portées
 *   à son nom au journal d'audit sur 30 jours glissants.
 *
 * ⚠️ **`dateActivation` est nulle pour une inscription REFUSÉE** : `t_compte_auth.DATE_DECISION` est
 * écrite aussi bien au refus qu'à la validation, et le serveur la tait dans ce cas plutôt que de
 * présenter une date de refus comme une date d'ouverture. L'écran ne dit donc « actif depuis le … »
 * que lorsqu'elle est là.
 */
@Component({
  selector: 'app-annuaire-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, EtatErreur, Icone, ActionsCompte],
  template: `
    <section class="ann">
      <header class="page-header ann__tete">
        <div class="ann__titres">
          <p class="page-subtitle">Annuaire</p>
          <h1 class="page-title">Qui est qui, et qui peut quoi</h1>
        </div>
        <div class="ann__chercher" [formGroup]="filtres">
          <label class="cnm-sr-only" for="ann-q">
            Rechercher une personne, un matricule, un login ou une entité
          </label>
          <span class="ann__chercher-ic" aria-hidden="true"><app-icone nom="search" [taille]="16" /></span>
          <input
            id="ann-q"
            class="ann__chercher-champ"
            type="search"
            formControlName="q"
            autocomplete="off"
            placeholder="Rechercher une personne, un matricule, un login, une entité…"
          />
        </div>
      </header>

      <form class="ann__filtres" [formGroup]="filtres" (ngSubmit)="$event.preventDefault()" novalidate>
        <label class="ann-f">
          <span class="ann-f__l">Type</span>
          <select class="ann-f__s" formControlName="type">
            <option value="">tous</option>
            @for (t of types; track t.valeur) { <option [value]="t.valeur">{{ t.libelle }}</option> }
          </select>
        </label>

        @if (filtresDeControleur()) {
          <label class="ann-f">
            <span class="ann-f__l">Profil</span>
            <select class="ann-f__s" formControlName="profil">
              <option value="">tous</option>
              @for (p of profils; track p) { <option [value]="p">{{ libelleProfil(p) }}</option> }
            </select>
          </label>

          <label class="ann-f">
            <span class="ann-f__l">Localité</span>
            <select class="ann-f__s" formControlName="localite">
              <option value="">toutes</option>
              @for (l of localites(); track l.idLocalite) {
                <option [value]="l.idLocalite">{{ nomLocalite(l.idLocalite) }}</option>
              }
            </select>
          </label>
        }

        <label class="ann-f">
          <span class="ann-f__l">Statut du compte</span>
          <select class="ann-f__s" formControlName="statut">
            <option value="">tous</option>
            @for (s of statuts; track s.valeur) { <option [value]="s.valeur">{{ s.libelle }}</option> }
          </select>
        </label>

        @if (filtreActif()) {
          <button type="button" class="btn btn-outline btn-sm ann__raz" (click)="reinitialiser()">
            Tout afficher
          </button>
        }

        <p class="ann__compte" role="status">{{ etatListe() }}</p>
      </form>

      @if (filtresDeControleur() && (filtres.value.profil || filtres.value.localite)) {
        <p class="ann__note">
          Profil et localité ne sont portés que par les contrôleurs : ces deux critères écartent les
          PRMP et les UGPM.
        </p>
      }

      <div class="ann__split">
        <!-- ─────────────────────────── Liste ─────────────────────────── -->
        <div class="card ann__liste">
          @if (premierChargement()) {
            <p class="ann__vide" role="status">Chargement de l'annuaire…</p>
          } @else if (erreur()) {
            <div class="ann__encart">
              <app-etat-erreur
                message="L'annuaire n'a pas pu être chargé."
                aide="Aucune personne ne peut être affichée tant que le serveur n'a pas répondu."
                (reessayer)="recharger()"
              />
            </div>
          } @else if (personnes().length === 0) {
            <p class="ann__vide">
              @if (filtreActif()) {
                Aucune personne ne correspond à cette recherche. Élargissez les critères, ou
                <button type="button" class="ann__vide-lien" (click)="reinitialiser()">affichez tout l'annuaire</button>.
              } @else {
                L'annuaire est vide : aucun contrôleur, aucune PRMP ni aucune UGPM n'est enregistré.
              }
            </p>
          } @else {
            <div class="ann-tab" [attr.aria-busy]="chargement()">
              <div class="ann-tab__entete" aria-hidden="true">
                <span>Personne</span><span>Profil</span><span>Rattachement</span><span>Compte</span>
              </div>
              <ul class="ann-tab__corps">
                @for (p of personnes(); track p.type + '/' + p.ref) {
                  <li>
                    <button
                      type="button"
                      class="ann-ligne"
                      [class.ann-ligne--sel]="estSelectionnee(p)"
                      [attr.aria-current]="estSelectionnee(p) ? 'true' : null"
                      (click)="selectionner(p)"
                    >
                      <span class="ann-ligne__ini" aria-hidden="true">{{ initiales(p) }}</span>
                      <span class="ann-ligne__qui">
                        <b>{{ p.nom }} {{ p.prenoms }}</b>
                        <span class="ann-ligne__ref">{{ p.ref }}</span>
                      </span>
                      <span class="ann-ligne__profil">{{ roleOuType(p) }}</span>
                      <span class="ann-ligne__rat">{{ rattachement(p) || '—' }}</span>
                      <span class="ann-ligne__compte">
                        <span class="ann-st" [class]="'ann-st ann-st--' + p.statutCompte">
                          <span class="cnm-sr-only">Compte : </span>{{ libelleStatut(p.statutCompte) }}
                        </span>
                        @if (p.login) { <span class="ann-ligne__login">{{ p.login }}</span> }
                      </span>
                    </button>
                  </li>
                }
              </ul>
            </div>

            @if (totalPages() > 1) {
              <nav class="ann__pager" aria-label="Pages de l'annuaire">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  [disabled]="pageIndex() === 0 || chargement()"
                  (click)="pagePrecedente()"
                >
                  Précédent
                </button>
                <span class="ann__pager-i">Page {{ pageIndex() + 1 }} / {{ totalPages() }}</span>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  [disabled]="pageIndex() + 1 >= totalPages() || chargement()"
                  (click)="pageSuivante()"
                >
                  Suivant
                </button>
              </nav>
            }
          }
        </div>

        <!-- ─────────────────────────── Fiche ─────────────────────────── -->
        <div class="card ann__fiche">
          @if (!selection()) {
            <p class="ann__vide ann__vide--fiche">
              Choisissez une personne dans la liste : sa fiche réunit son accès, sa place dans
              l'organisation et les gestes qui la concernent.
            </p>
          } @else if (ficheChargement()) {
            <p class="ann__vide" role="status">Chargement de la fiche…</p>
          } @else if (ficheErreur()) {
            <div class="ann__encart">
              <app-etat-erreur
                [message]="messageErreurFiche()"
                [aide]="aideErreurFiche()"
                [reprise]="!ficheIntrouvable()"
                (reessayer)="rechargerFiche()"
              />
            </div>
          } @else if (fiche(); as f) {
            <div class="ann-fh__hd">
              <span class="ann-fh__ini" aria-hidden="true">{{ initiales(f) }}</span>
              <div class="ann-fh__id">
                <b>{{ f.nom }} {{ f.prenoms }}</b>
                <span>{{ sousTitre(f) }}</span>
              </div>
            </div>

            <div class="ann-blk">
              <h2 class="ann-blk__h">Accès</h2>
              <dl class="ann-kv">
                <div class="ann-kv__l">
                  <dt>Login</dt>
                  <dd>
                    @if (f.login) { {{ f.login }} } @else {
                      <span class="ann-kv__rien">aucun compte de connexion</span>
                    }
                  </dd>
                </div>
                <div class="ann-kv__l">
                  <dt>Statut</dt>
                  <dd>
                    <span class="ann-st" [class]="'ann-st ann-st--' + f.statutCompte">
                      {{ libelleStatut(f.statutCompte) }}
                    </span>
                    @if (f.dateActivation) { <span class="ann-kv__note">ouvert le {{ jour(f.dateActivation) }}</span> }
                  </dd>
                </div>
                <!-- ⚠️ Lot 6 F5 — les deux lignes que le §6 du plan retirait faute de source. Le
                     journal des connexions (B4) existe depuis le 2026-09-17.
                     « Dernière connexion » reste ABSENTE quand le serveur ne la sert pas : elle est
                     nulle pour qui ne s'est pas connecté DEPUIS QUE LE JOURNAL EXISTE — au début,
                     presque tout le monde. Écrire « jamais connecté » serait faux. -->
                @if (f.derniereConnexion) {
                  <div class="ann-kv__l">
                    <dt>Dernière connexion</dt>
                    <dd>
                      {{ instant(f.derniereConnexion) }}
                      <span class="ann-kv__note">connexion acceptée la plus récente</span>
                    </dd>
                  </div>
                }
                <div class="ann-kv__l">
                  <dt>Échecs (30 j)</dt>
                  <dd>
                    @if ((f.echecs30j ?? 0) > 0) {
                      <b class="ann-echecs">
                        {{ accord(f.echecs30j ?? 0, 'tentative refusée', 'tentatives refusées') }}
                      </b>
                    } @else {
                      <span class="ann-kv__rien">aucune tentative refusée</span>
                    }
                    <span class="ann-kv__note">sur 30 jours glissants</span>
                  </dd>
                </div>
              </dl>
              <p class="ann-blk__aide">
                {{ aideStatut(f.statutCompte) }}
                <!-- ⚠️ Une tentative sur un login INCONNU n'est attribuable à personne : elle ne
                     figure dans aucune fiche, et ne se lit que dans le journal. Le dire ici, à
                     côté du chiffre, évite de lire « 0 échec » comme « personne n'a essayé ». -->
                Une tentative sur un login inconnu n'est attribuable à personne : elle ne se lit que
                dans le journal. ·
                <a routerLink="/admin/audit" [queryParams]="{ journal: 'connexions', acteur: f.ref }">
                  Ses connexions
                </a>
              </p>
            </div>

            @if (f.type === 'CONTROLEUR') {
              <div class="ann-blk">
                <h2 class="ann-blk__h">Place dans l'organisation</h2>
                <dl class="ann-kv">
                  <div class="ann-kv__l">
                    <dt>Supérieur</dt>
                    <dd>
                      @if (f.superieur; as s) {
                        {{ s.nom }} {{ s.prenoms }}
                        <span class="ann-kv__note">{{ qualite(s.profil, s.localite) }}</span>
                      } @else {
                        <span class="ann-kv__rien">aucun supérieur déclaré</span>
                      }
                    </dd>
                  </div>
                  <div class="ann-kv__l">
                    <dt>Transversal</dt>
                    <dd>{{ f.transversal ? 'Oui — agit sur toutes les localités' : 'Non' }}</dd>
                  </div>
                  <div class="ann-kv__l">
                    <dt>Délégation</dt>
                    <dd>
                      @if (f.delegations.length) {
                        <ul class="ann-deleg">
                          @for (d of f.delegations; track d.sens + d.profil) { <li>{{ phraseDelegation(d) }}</li> }
                        </ul>
                      } @else {
                        <span class="ann-kv__rien">aucune en cours</span>
                      }
                    </dd>
                  </div>
                </dl>

                <p class="ann-blk__st">Chaîne de contrôle</p>
                @if (f.chaineControle.length > 1) {
                  <ol class="ann-chaine">
                    @for (m of f.chaineControle; track m.ref) {
                      <li>
                        <span class="ann-chaine__m" [class.ann-chaine__m--lui]="m.lui">
                          {{ libelleProfil(m.profil) }}@if (m.lui) { — lui } @else { · {{ m.nom }} }
                        </span>
                      </li>
                    }
                  </ol>
                } @else {
                  <p class="ann-blk__aide">
                    Chaîne incomplète : personne ne lui est rattaché. Les dossiers suivent alors le
                    repli par localité.
                  </p>
                }
              </div>
            } @else {
              <div class="ann-blk">
                <h2 class="ann-blk__h">Place dans l'organisation</h2>
                <dl class="ann-kv">
                  <div class="ann-kv__l">
                    <dt>{{ f.type === 'UGPM' ? 'Entité de tutelle' : 'Entité(s)' }}</dt>
                    <dd>
                      @if (f.entite) { {{ f.entite }} } @else {
                        <span class="ann-kv__rien">aucune entité active rattachée</span>
                      }
                    </dd>
                  </div>
                  @if (f.type === 'PRMP') {
                    <div class="ann-kv__l">
                      <dt>Mandat</dt>
                      <dd>
                        @if (f.mandat; as m) {
                          {{ jour(m.dateDebut) }} → {{ jour(m.dateFin) }}
                          <span class="ann-kv__note">{{ precisionMandat(f) }}</span>
                        } @else {
                          <span class="ann-kv__rien">aucun mandat en cours</span>
                        }
                      </dd>
                    </div>
                  }
                </dl>
                @if (f.type === 'UGPM') {
                  <p class="ann-blk__aide">
                    Une UGPM travaille sous le mandat de sa PRMP de tutelle : la fiche ne lui en
                    attribue aucun.
                  </p>
                }
              </div>
            }

            <div class="ann-blk">
              <h2 class="ann-blk__h">Activité</h2>
              <dl class="ann-kv">
                <div class="ann-kv__l">
                  <dt>Journal (30 j)</dt>
                  <dd>
                    {{ accord(f.actionsJournal30j, 'écriture portée à son nom', 'écritures portées à son nom') }}
                  </dd>
                </div>
              </dl>
              <p class="ann-blk__aide"><a routerLink="/admin/audit">Ouvrir le journal d'audit</a></p>
            </div>

            <div class="ann-acts">
              @if (gestesDeCompte()) {
                <button type="button" class="btn btn-sm btn-outline" (click)="ouvrirCompte()">
                  Réinitialiser le mot de passe
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.btn-danger]="f.statutCompte === 'ACTIF'"
                  [class.btn-outline]="f.statutCompte !== 'ACTIF'"
                  (click)="ouvrirCompte()"
                >
                  {{ f.statutCompte === 'ACTIF' ? 'Suspendre le compte' : 'Réactiver le compte' }}
                </button>
              }
              <a class="btn btn-sm btn-outline" [routerLink]="cheminFiche(f.type)">Modifier la fiche</a>
              @for (l of liensContexte(); track l.chemin) {
                <a class="btn btn-sm btn-outline" [routerLink]="l.chemin" [queryParams]="l.parametres">{{ l.libelle }}</a>
              }
            </div>

            @if (!gestesDeCompte()) {
              <p class="ann-acts__note">{{ pourquoiPasDeGeste(f.statutCompte) }}</p>
            }
          }
        </div>
      </div>

      <details class="ann-ecrans">
        <summary class="ann-ecrans__t">Les écrans d'administration des comptes ({{ ecrans.length }})</summary>
        <p class="ann-ecrans__aide">
          Aucun n'a d'entrée de menu : l'annuaire est leur chemin. La fiche d'une personne mène
          directement à ceux qui la concernent.
        </p>
        <ul class="ann-ecrans__l">
          @for (e of ecrans; track e.chemin) {
            <li>
              <a [routerLink]="e.chemin">{{ e.libelle }}</a>
              <span>{{ e.aide }}</span>
            </li>
          }
        </ul>
      </details>
    </section>

    @if (compteOuvert() && fiche(); as f) {
      <app-actions-compte
        [type]="f.type"
        [ref]="f.ref"
        [nom]="f.nom + ' ' + f.prenoms"
        [login]="f.login"
        (fermer)="fermerCompte()"
      />
    }
  `,
  styles: `
    .ann { display: flex; flex-direction: column; }

    /* ⚠️ Le sur-titre global .page-subtitle est en --p-600 : mesuré 3,65:1 sur le fond de page
       (#f2f5fa) à 10 px — sous le seuil AA. Recalibré ICI en --p-700 (5,43:1), même geste que les
       encres de badge de F2 : le style global sert des dizaines d'écrans et ne se retouche pas
       depuis un lot. Le défaut reste ouvert ailleurs, il est signalé. */
    .page-subtitle { color: var(--p-700); }

    /* ── En-tête et recherche ─────────────────────────────────────────────── */
    .ann__tete { display: flex; align-items: flex-end; justify-content: space-between; gap: 22px; flex-wrap: wrap; margin-bottom: 12px; }
    .ann__titres { min-width: 0; }
    .ann__chercher {
      flex: 1 1 22rem;
      max-width: 34rem;
      display: flex;
      align-items: center;
      gap: 9px;
      height: 36px;
      padding: 0 13px;
      background: #fff;
      border: 1px solid var(--n-300);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }
    .ann__chercher-ic { color: var(--n-500); display: grid; place-items: center; flex: none; }
    .ann__chercher-champ {
      flex: 1;
      min-width: 0;
      border: 0;
      outline-offset: 2px;
      background: transparent;
      font-family: var(--font-base);
      font-size: var(--text-md);
      color: var(--n-800);
    }
    .ann__chercher-champ::placeholder { color: var(--n-400); }

    /* ── Filtres ──────────────────────────────────────────────────────────── */
    .ann__filtres { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .ann-f {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 5px 3px 11px;
      background: #fff;
      border: 1px solid var(--n-300);
      border-radius: var(--radius-full);
    }
    .ann-f__l { font-size: var(--text-sm); font-weight: 600; color: var(--n-500); }
    .ann-f__s {
      border: 0;
      background: transparent;
      font-family: var(--font-base);
      font-size: var(--text-sm);
      font-weight: 800;
      color: var(--n-800);
      padding: 2px 4px;
      max-width: 12rem;
    }
    .ann__raz { margin-left: 2px; }
    .ann__compte { margin: 0 0 0 auto; font-size: var(--text-sm); color: var(--n-500); font-weight: 600; }
    .ann__note { margin: 7px 0 0; font-size: var(--text-sm); color: var(--n-500); }

    /* ── Deux panneaux ────────────────────────────────────────────────────── */
    .ann__split { display: grid; grid-template-columns: minmax(0, 1fr) 384px; gap: 16px; align-items: start; margin-top: 12px; }
    @media (max-width: 1160px) { .ann__split { grid-template-columns: minmax(0, 1fr); } }
    .ann__liste { min-width: 0; }
    /* La fiche reste sous les yeux pendant qu'on parcourt la liste : collée sous la barre du haut,
       qui est fixe et haute de 48 px. La hauteur maximale est calée sur cette position collée
       (60 + 72 < 100vh) pour que la fiche tienne ENTIÈRE une fois accrochée, actions comprises ;
       plus haute qu'un écran, elle défile à l'intérieur plutôt que de sortir par le bas. */
    .ann__fiche { position: sticky; top: 60px; max-height: calc(100vh - 72px); overflow-y: auto; display: flex; flex-direction: column; }
    @media (max-width: 1160px) { .ann__fiche { position: static; max-height: none; } }

    .ann__vide { margin: 0; padding: 22px 18px; font-size: var(--text-base); color: var(--n-500); line-height: 1.6; }
    .ann__vide--fiche { text-align: center; }
    .ann__vide-lien {
      border: 0; background: none; padding: 0;
      font: inherit; color: var(--p-700); font-weight: 700; text-decoration: underline; cursor: pointer;
    }
    /* L'état d'erreur porte son propre fond : il lui faut la marge que la carte ne donne pas. */
    .ann__encart { padding: 14px; }

    /* ── Liste : des BOUTONS, pas un tableau cliquable ────────────────────── */
    .ann-tab__entete,
    .ann-ligne {
      display: grid;
      grid-template-columns: minmax(0, 2.1fr) minmax(0, 1.1fr) minmax(0, 1.4fr) minmax(0, 1.1fr);
      gap: 10px;
      align-items: center;
    }
    /* ⚠️ --grad-primary (p-500 → p-600), le fond d'en-tête de tableau du design system, ne donne
       que 2,77:1 à 4,10:1 sous du blanc — sous AA pour ces 10 px. Le dégradé est repris ici deux
       crans plus bas (p-700 → p-800) : 5,93:1 à 7,56:1, même identité, contraste tenu. Le jeton
       global n'est pas touché (il sert tous les tableaux de l'application) ; le défaut est signalé. */
    .ann-tab__entete {
      padding: 8px 15px;
      background: linear-gradient(to right, var(--p-700), var(--p-800));
      color: #fff;
      font-size: var(--text-xs);
      font-weight: 700;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    .ann-tab__corps { list-style: none; margin: 0; padding: 0; }
    .ann-ligne {
      position: relative;
      width: 100%;
      text-align: left;
      padding: 8px 15px;
      border: 0;
      border-top: 1px solid var(--n-100);
      background: #fff;
      font-family: var(--font-base);
      cursor: pointer;
    }
    .ann-tab__corps li:first-child .ann-ligne { border-top: 0; }
    .ann-ligne:hover { background: var(--n-50); }
    .ann-ligne--sel,
    .ann-ligne--sel:hover { background: var(--p-50); }
    .ann-ligne--sel::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--p-600); }
    .ann-ligne__ini {
      position: absolute;
      left: 15px; top: 50%; transform: translateY(-50%);
      width: 27px; height: 27px;
      border-radius: 50%;
      background: var(--n-100); color: var(--n-600);
      display: grid; place-items: center;
      font-size: var(--text-sm); font-weight: 800;
    }
    .ann-ligne__qui { min-width: 0; padding-left: 35px; }
    .ann-ligne__qui b { display: block; font-size: var(--text-base); font-weight: 700; color: var(--n-700); }
    /* --n-500 et non --n-400 : sur la ligne SÉLECTIONNÉE (fond --p-50) n-400 tombe à 4,44:1,
       juste sous le seuil AA. n-500 y tient 5,44:1 et 5,80:1 sur blanc. */
    .ann-ligne__ref { display: block; font-size: var(--text-xs); color: var(--n-500); }
    .ann-ligne__profil,
    .ann-ligne__rat { font-size: var(--text-sm); color: var(--n-500); min-width: 0; overflow-wrap: anywhere; }
    .ann-ligne__compte { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; }
    .ann-ligne__login { font-size: var(--text-xs); color: var(--n-500); overflow-wrap: anywhere; }

    /* ── Pastille de statut ───────────────────────────────────────────────────
       Contrastes mesurés sur le fond de la pastille (méthode du lot 5) :
       ACTIF #047857/--success-bg 5,21:1 · SUSPENDU 5,30:1 · EN_ATTENTE 4,58:1 · REFUSE et
       SANS_COMPTE --n-600/--n-100 6,56:1. ⚠️ Le jeton GLOBAL --success-text sur --success-bg ne
       donne que 3,58:1 : l'encre est recalibrée ICI, comme l'accueil de F2 l'a fait — le jeton sert
       des dizaines d'écrans et ne se retouche pas depuis un lot. */
    .ann-st {
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      border: 1px solid transparent;
      font-size: var(--text-xs);
      font-weight: 700;
      white-space: nowrap;
    }
    .ann-st--ACTIF { background: var(--success-bg); color: #047857; border-color: var(--success-bdr); }
    .ann-st--SUSPENDU { background: var(--danger-bg); color: var(--danger-text); border-color: var(--danger-bdr); }
    .ann-st--EN_ATTENTE { background: var(--warning-bg); color: var(--warning-text); border-color: var(--warning-bdr); }
    .ann-st--REFUSE,
    .ann-st--SANS_COMPTE { background: var(--n-100); color: var(--n-600); border-color: var(--n-200); }

    .ann__pager { display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 11px; border-top: 1px solid var(--n-100); }
    .ann__pager-i { font-size: var(--text-sm); color: var(--n-500); font-weight: 600; }

    /* ── Fiche ────────────────────────────────────────────────────────────── */
    .ann-fh__hd { display: flex; align-items: center; gap: 12px; padding: 14px 15px; background: var(--p-50); border-bottom: 1px solid var(--n-200); }
    .ann-fh__ini {
      width: 44px; height: 44px; flex: none;
      border-radius: 50%;
      background: var(--p-600); color: #fff;
      display: grid; place-items: center;
      font-size: var(--text-lg); font-weight: 800;
    }
    .ann-fh__id { min-width: 0; }
    .ann-fh__id b { display: block; font-size: var(--text-lg); font-weight: 800; color: var(--n-800); line-height: 1.2; }
    .ann-fh__id span { font-size: var(--text-sm); color: var(--n-500); }

    .ann-blk { padding: 10px 15px; border-bottom: 1px solid var(--n-100); }
    .ann-blk__h { font-size: var(--text-xs); font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; color: var(--n-500); margin: 0 0 6px; }
    .ann-blk__st { font-size: var(--text-xs); color: var(--n-500); margin: 8px 0 5px; }
    .ann-blk__aide { margin: 6px 0 0; font-size: var(--text-sm); color: var(--n-500); line-height: 1.5; }
    .ann-blk__aide a { color: var(--p-700); font-weight: 700; }

    .ann-kv { margin: 0; }
    .ann-kv__l { display: flex; gap: 10px; padding: 3px 0; font-size: var(--text-base); }
    .ann-kv__l dt { flex: none; width: 7.6rem; color: var(--n-500); }
    .ann-kv__l dd { margin: 0; min-width: 0; color: var(--n-700); font-weight: 600; overflow-wrap: anywhere; }
    .ann-kv__note { font-weight: 400; color: var(--n-500); margin-left: 5px; }
    .ann-kv__rien { font-weight: 400; color: var(--n-500); font-style: italic; }
    /* --danger-text sur le fond blanc de la fiche : 7,22:1. La couleur ne porte rien seule — le
       texte dit « tentatives refusées », et zéro échec s'écrit en toutes lettres. */
    .ann-echecs { color: var(--danger-text); }
    .ann-deleg { margin: 0; padding-left: 1.05rem; font-weight: 400; color: var(--n-700); }

    .ann-chaine { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; counter-reset: maillon; }
    .ann-chaine li { display: flex; align-items: center; gap: 6px; }
    .ann-chaine li + li::before { content: '→'; color: var(--n-400); font-weight: 800; }
    .ann-chaine__m { background: var(--n-100); color: var(--n-600); border-radius: var(--radius-sm); padding: 3px 8px; font-size: var(--text-sm); font-weight: 700; }
    .ann-chaine__m--lui { background: var(--p-100); color: var(--p-800); }

    .ann-acts { margin-top: auto; padding: 12px 15px; border-top: 1px solid var(--n-200); display: flex; flex-wrap: wrap; gap: 8px; }
    .ann-acts .btn { flex: 1 1 9.5rem; justify-content: center; }
    .ann-acts__note { margin: 0; padding: 0 15px 12px; font-size: var(--text-sm); color: var(--n-500); line-height: 1.5; }

    /* ── Les huit écrans que le sommaire portait ──────────────────────────── */
    .ann-ecrans { margin-top: 14px; padding: 10px 14px; background: #fff; border: 0.5px solid var(--n-200); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); }
    .ann-ecrans__t { font-size: var(--text-sm); font-weight: 700; color: var(--n-600); cursor: pointer; }
    .ann-ecrans__aide { margin: 8px 0 0; font-size: var(--text-sm); color: var(--n-500); }
    .ann-ecrans__l { list-style: none; margin: 8px 0 2px; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 6px 16px; }
    .ann-ecrans__l li { display: flex; flex-direction: column; padding: 4px 0; }
    .ann-ecrans__l a { font-size: var(--text-base); font-weight: 700; color: var(--p-700); }
    .ann-ecrans__l span { font-size: var(--text-xs); color: var(--n-500); }
  `,
})
export class AnnuaireAdmin {
  private readonly annuaire = inject(AnnuaireService);
  private readonly referentielLocalites = inject(LocaliteService);
  private readonly fb = inject(FormBuilder);

  protected readonly types = TYPES;
  protected readonly profils = PROFILS;
  protected readonly statuts = STATUTS;
  protected readonly ecrans = ECRANS_COMPTES;

  /** `q` et les quatre critères — TOUS envoyés au serveur (audit M15 : ne jamais filtrer la page). */
  readonly filtres = this.fb.nonNullable.group({ q: '', type: '', profil: '', localite: '', statut: '' });
  private readonly valeurs = toSignal(this.filtres.valueChanges, { initialValue: this.filtres.getRawValue() });

  readonly personnes = signal<AnnuairePersonne[]>([]);
  readonly chargement = signal(true);
  private readonly dejaCharge = signal(false);
  readonly erreur = signal(false);
  readonly pageIndex = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);

  /** La personne dont la fiche est ouverte — `type` **et** `ref` : les références se croisent entre populations. */
  readonly selection = signal<{ type: TypeActeur; ref: string } | null>(null);
  readonly fiche = signal<AnnuaireFiche | null>(null);
  readonly ficheChargement = signal(false);
  readonly ficheErreur = signal(false);
  /** 404 : la personne n'existe pas (ou plus). Réessayer n'y changerait rien — pas de bouton de reprise. */
  readonly ficheIntrouvable = signal(false);

  readonly localites = signal<Localite[]>([]);
  readonly compteOuvert = signal(false);

  /** Premier chargement : la liste n'existe pas encore, on dit « Chargement » au lieu de « Aucune personne ». */
  readonly premierChargement = computed(() => this.chargement() && !this.dejaCharge());
  readonly filtreActif = computed(() => Object.values(this.valeurs()).some((v) => !!v));
  /**
   * Profil et localité ne sont portés que par les contrôleurs : les proposer sur une recherche
   * limitée aux PRMP ou aux UGPM promettrait un croisement qui ne rend jamais rien.
   */
  readonly filtresDeControleur = computed(() => {
    const t = this.valeurs().type;
    return t === '' || t === 'CONTROLEUR';
  });

  /** Une seule zone vivante pour la liste : « Chargement… », puis le nombre de personnes trouvées. */
  readonly etatListe = computed(() => {
    if (this.chargement()) {
      return 'Chargement…';
    }
    if (this.erreur()) {
      return 'Annuaire indisponible';
    }
    return this.accord(this.totalElements(), 'personne', 'personnes');
  });

  private readonly codesLocalites = computed(
    () => new Map(this.localites().map((l) => [l.idLocalite, l.libelleLocalite])),
  );

  constructor() {
    // Un changement de population EFFACE profil et localité : les garder laisserait des critères
    // invisibles (leurs listes disparaissent) mais actifs, et une liste vide sans explication.
    this.filtres.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe((t) => {
      if (t && t !== 'CONTROLEUR') {
        this.filtres.patchValue({ profil: '', localite: '' }, { emitEvent: false });
      }
    });
    // La frappe est temporisée (une requête par mot, pas par lettre) ; un choix de filtre part tout
    // de suite. Pas de `distinctUntilChanged` : la seule remise à zéro programmée du champ se fait
    // sans événement (cf. `reinitialiser`), et il ferait taire une recherche relancée à l'identique.
    this.filtres.controls.q.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => this.chargerPage(0));
    merge(
      this.filtres.controls.type.valueChanges,
      this.filtres.controls.profil.valueChanges,
      this.filtres.controls.localite.valueChanges,
      this.filtres.controls.statut.valueChanges,
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.chargerPage(0));

    this.chargerPage(0);
    // Référentiel des localités : le serveur ne sert que le CODE (`ANT`). Son échec n'empêche rien —
    // les codes restent lisibles seuls et le filtre reste utilisable par la liste déjà chargée.
    this.referentielLocalites.listeSilencieuse().subscribe({
      next: (l) => this.localites.set([...l].sort((a, b) => a.idLocalite.localeCompare(b.idLocalite))),
      error: () => this.localites.set([]),
    });
  }

  // ─────────────────────────────── Liste ───────────────────────────────

  private chargerPage(page: number): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.annuaire.listePage(page, TAILLE_PAGE, this.parametres()).subscribe({
      next: (p) => {
        this.personnes.set(p.content);
        this.pageIndex.set(p.number);
        this.totalPages.set(p.totalPages);
        this.totalElements.set(p.totalElements);
        this.chargement.set(false);
        this.dejaCharge.set(true);
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  /** Critères non vides seulement : un paramètre vide partirait au serveur et finirait en 400 sur un énuméré. */
  private parametres(): Record<string, string> {
    const params: Record<string, string> = {};
    for (const [cle, valeur] of Object.entries(this.filtres.getRawValue())) {
      const v = valeur.trim();
      if (v) {
        params[cle] = v;
      }
    }
    return params;
  }

  recharger(): void {
    this.chargerPage(this.pageIndex());
  }
  pagePrecedente(): void {
    if (this.pageIndex() > 0) {
      this.chargerPage(this.pageIndex() - 1);
    }
  }
  pageSuivante(): void {
    if (this.pageIndex() + 1 < this.totalPages()) {
      this.chargerPage(this.pageIndex() + 1);
    }
  }
  reinitialiser(): void {
    // Remise à zéro SANS événement, puis une seule lecture : laissée bruyante, elle partirait en
    // cinq requêtes — une par critère effacé — pour afficher une seule liste.
    this.filtres.reset({ q: '', type: '', profil: '', localite: '', statut: '' }, { emitEvent: false });
    this.chargerPage(0);
  }

  // ─────────────────────────────── Fiche ───────────────────────────────

  estSelectionnee(p: AnnuairePersonne): boolean {
    const s = this.selection();
    return !!s && s.type === p.type && s.ref === p.ref;
  }

  selectionner(p: AnnuairePersonne): void {
    this.selection.set({ type: p.type, ref: p.ref });
    this.chargerFiche();
  }

  rechargerFiche(): void {
    this.chargerFiche();
  }

  private chargerFiche(): void {
    const s = this.selection();
    if (!s) {
      return;
    }
    this.ficheChargement.set(true);
    this.ficheErreur.set(false);
    this.ficheIntrouvable.set(false);
    this.fiche.set(null);
    this.annuaire.fiche(s.type, s.ref).subscribe({
      next: (f) => {
        this.fiche.set(f);
        this.ficheChargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.ficheIntrouvable.set(e?.status === 404);
        this.ficheErreur.set(true);
        this.ficheChargement.set(false);
      },
    });
  }

  messageErreurFiche(): string {
    return this.ficheIntrouvable()
      ? "Cette personne n'existe plus dans l'annuaire."
      : "La fiche n'a pas pu être chargée.";
  }
  aideErreurFiche(): string {
    return this.ficheIntrouvable()
      ? 'Elle a pu être supprimée depuis le chargement de la liste. Relancez la recherche.'
      : 'La liste reste utilisable ; la fiche peut être redemandée.';
  }

  // ─────────────────────────── Gestes de compte ───────────────────────────

  /**
   * Les gestes de compte n'ont de sens que sur un compte **ouvert** : actif (à suspendre) ou
   * suspendu (à rouvrir).
   *
   * ⚠️ Ils sont refusés sur une inscription `EN_ATTENTE` ou `REFUSE`, bien qu'un login existe :
   * « réactiver » y poserait `ACTIF = true` et ouvrirait l'accès à quelqu'un dont la demande n'a
   * jamais été acceptée — la validation d'une inscription se fait dans son écran, avec son
   * instruction et son motif.
   */
  readonly gestesDeCompte = computed(() => {
    const f = this.fiche();
    return !!f?.login && (f.statutCompte === 'ACTIF' || f.statutCompte === 'SUSPENDU');
  });

  ouvrirCompte(): void {
    this.compteOuvert.set(true);
  }

  /** La modale a pu suspendre, réactiver ou réinitialiser : liste et fiche sont relues. */
  fermerCompte(): void {
    this.compteOuvert.set(false);
    this.chargerPage(this.pageIndex());
    this.chargerFiche();
  }

  pourquoiPasDeGeste(statut: StatutCompteAnnuaire): string {
    switch (statut) {
      case 'EN_ATTENTE':
        return "L'inscription n'a pas encore été instruite : elle se valide ou se refuse depuis « Demandes d'accès ».";
      case 'REFUSE':
        return "L'inscription a été refusée : aucun compte n'a jamais été ouvert pour cette personne.";
      default:
        return "Cette personne n'a aucun compte de connexion : rien à suspendre ni à réinitialiser.";
    }
  }

  // ─────────────────────────── Chemins vers les écrans ───────────────────────────

  /** « Modifier la fiche » — l'écran d'origine de la population, qui porte le formulaire complet. */
  cheminFiche(type: TypeActeur): string {
    return { CONTROLEUR: '/admin/comptes/controleurs', PRMP: '/admin/comptes/prmps', UGPM: '/admin/comptes/ugpms' }[type];
  }

  /**
   * Les autres écrans que cette personne-là concerne, avec leur contexte quand ils l'acceptent
   * (`?prmp=`, `?ugpm=`) — la liste s'ouvre alors déjà filtrée sur elle.
   */
  readonly liensContexte = computed<LienEcran[]>(() => {
    const f = this.fiche();
    if (!f) {
      return [];
    }
    if (f.type === 'CONTROLEUR') {
      return [{ libelle: 'Changer de chaîne', chemin: '/admin/chaines-controle', parametres: {} }];
    }
    if (f.type === 'PRMP') {
      const prmp: Record<string, string> = { prmp: f.ref };
      return [
        { libelle: 'Ses entités', chemin: '/admin/comptes/prmp-entites', parametres: prmp },
        { libelle: 'Ses mandats', chemin: '/admin/comptes/mandats', parametres: {} },
        { libelle: 'Ses pièces', chemin: '/admin/comptes/prmp-pieces', parametres: prmp },
      ];
    }
    return [{ libelle: 'Ses pièces', chemin: '/admin/comptes/ugpm-pieces', parametres: { ugpm: f.ref } }];
  });

  // ─────────────────────────────── Affichage ───────────────────────────────

  initiales(p: AnnuairePersonne): string {
    return `${p.nom?.[0] ?? ''}${p.prenoms?.[0] ?? ''}`.toUpperCase();
  }

  libelleProfil(profil: string | null): string {
    return libelleRole(profil) || '—';
  }

  libelleStatut(statut: StatutCompteAnnuaire): string {
    return LIBELLES_STATUTS[statut] ?? statut;
  }

  aideStatut(statut: StatutCompteAnnuaire): string {
    switch (statut) {
      case 'ACTIF':
        return 'La connexion est possible.';
      case 'SUSPENDU':
        return 'Compte fermé par un administrateur : la connexion est bloquée, les données sont intactes.';
      case 'EN_ATTENTE':
        return "Inscription déposée, pas encore instruite : le compte n'est pas ouvert.";
      case 'REFUSE':
        return "Inscription refusée : le compte n'a jamais été ouvert.";
      default:
        return "Cette personne figure au référentiel sans compte de connexion.";
    }
  }

  /** Profil pour un contrôleur ; le type pour une PRMP ou une UGPM, qui n'en portent pas. */
  roleOuType(p: AnnuairePersonne): string {
    return p.profil ? libelleRole(p.profil) : p.type;
  }

  /** « ANT — Centrale » pour un contrôleur ; l'entité (ou celle de la tutelle) sinon. */
  rattachement(p: AnnuairePersonne): string {
    return p.localite ? this.nomLocalite(p.localite) : (p.entite ?? '');
  }

  /** Le serveur ne sert que le CODE : le libellé vient du référentiel, et le code seul si on ne l'a pas. */
  nomLocalite(code: string): string {
    const libelle = this.codesLocalites().get(code);
    return libelle ? `${code} — ${libelle}` : code;
  }

  /** « CTR0142 · Membre · ANT — Centrale » — la ligne d'identité sous le nom, dans la fiche. */
  sousTitre(f: AnnuaireFiche): string {
    return [f.ref, f.profil ? libelleRole(f.profil) : f.type, this.rattachement(f)].filter(Boolean).join(' · ');
  }

  /** « (Chef de commission, ANT) » — la qualité d'une personne citée, entre parenthèses. */
  qualite(profil: string | null, localite: string | null): string {
    const parts = [profil ? libelleRole(profil) : null, localite].filter(Boolean);
    return parts.length ? `(${parts.join(', ')})` : '';
  }

  /**
   * Une délégation se lit dans son sens. Convention de `t_delegation_profil`, celle de
   * `PermissionService` : le **délégant** exerce, le **délégué** est celui dont la tâche est exercée.
   */
  phraseDelegation(d: AnnuaireDelegation): string {
    return d.sens === 'EXERCE'
      ? `Exerce les tâches du profil ${libelleRole(d.profil)}`
      : `Ses tâches peuvent être exercées par ${libelleRole(d.profil)}`;
  }

  /** « n° 1 » / « reconstitué de la nomination » — un mandat implicite n'a pas d'arrêté déclaré. */
  precisionMandat(f: AnnuaireFiche): string {
    const m = f.mandat;
    if (!m) {
      return '';
    }
    if (m.implicite) {
      return 'reconstitué depuis la date de nomination, aucun arrêté déclaré';
    }
    return m.refArrete ? `arrêté ${m.refArrete}` : '';
  }

  /** « 14/03/2026 » — une date, pas un horodatage : la fiche ne prétend pas à la minute. */
  jour(iso: string | null): string {
    if (!iso) {
      return '';
    }
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(d);
  }

  /**
   * « 17/09/2026 08:32 » — une connexion est un INSTANT, contrairement aux dates de la fiche : à la
   * journée près, « dernière connexion le 17/09 » ne distingue plus ce matin de cette nuit, et c'est
   * exactement la distinction qu'on vient chercher sur une fiche d'accès.
   */
  instant(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return iso;
    }
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  /** Accord français : 0 et 1 restent au singulier, le pluriel commence à 2. */
  accord(n: number, singulier: string, pluriel: string): string {
    return `${new Intl.NumberFormat('fr-FR').format(n)} ${n > 1 ? pluriel : singulier}`;
  }
}
