import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { LIBELLES_ROLES } from '../../core/auth/libelles-profils';
import { Actualite } from '../../models/actualite.model';
import { AuditLog, CompteursAdmin } from '../../models';
import { ActualiteService, ParametreActualitesService } from '../../services/actualite.services';
import { AuditLogService, KpiService, PreControleService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { Icone } from '../../shared/ui/icone';
import { Anciennete, anciennete } from './anciennete';

/** Une file d'attente de la section « À traiter maintenant » — modèle d'affichage, calculé une fois. */
interface FileAttente {
  readonly cle: string;
  readonly titre: string;
  readonly nombre: number;
  readonly attente: Anciennete | null;
  readonly lien: string;
  readonly action: string;
}

/** Nombre de profils de l'application : au complet, l'actualité vise « tous profils ». */
const NB_PROFILS = Object.keys(LIBELLES_ROLES).length;

/**
 * Les réglages suivis par « Derniers changements de paramétrage » — **noms de ressource de l'API**,
 * pas noms de table SQL : `AuditInterceptor` écrit dans `NOM_TABLE` le premier segment du chemin
 * appelé (`PUT /api/delais-standards/3` → `delais-standards`). `t_delai_standard` ne ramènerait rien.
 *
 * ⚠️ **Les chaînes de contrôle n'y sont pas**, alors que le plan les cite. Elles se changent par
 * `PUT /api/controleurs/{im}/rattachement` : la ressource auditée est `controleurs`, la même que
 * toute modification de fiche d'un contrôleur. La suivre noierait les quatre lignes de réglage sous
 * les créations et corrections de fiches, et l'API ne sait pas filtrer sur le geste (`TYPE_ACTION`).
 * Un bloc qui annonce « les changements de paramétrage » et montre autre chose est pire que le
 * manque : les chaînes se lisent dans le journal complet, d'un clic.
 */
const REGLAGES: readonly { readonly ressource: string; readonly libelle: string }[] = [
  { ressource: 'delais-standards', libelle: 'Délais standards' },
  { ressource: 'points-ctrls', libelle: 'Points de contrôle' },
  { ressource: 'regle-alertes', libelle: "Règles d'alerte" },
  { ressource: 'regle-anomalies', libelle: "Règles d'anomalie" },
  // `parametres` porte le seuil AGPM (AMI) et l'interrupteur global des actualités.
  { ressource: 'parametres', libelle: 'Paramètres généraux' },
];

/** Quatre lignes, comme la maquette : au-delà, « À surveiller » sort de l'écran à 1366×768. */
const NB_DERNIERS_CHANGEMENTS = 4;

/** Gestes bruts du journal (`TYPE_ACTION`), en français. Un sous-chemin (`AGPM-SEUIL-MONTANT`) reste tel quel. */
const GESTES: Readonly<Record<string, string>> = {
  CREATE: 'Ajout',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
};

/**
 * **Accueil de l'Administrateur** (lot 6, F2 — maquette `maquettes-design/admin/A-console-par-tache`).
 *
 * `/admin/tableau-de-bord` chargeait jusqu'ici le `KpiDashboard` du **contrôle** (dossiers déposés,
 * taux de conformité, top des points non conformes) : aucune de ces mesures n'est du ressort de
 * l'Administrateur. Cet écran le remplace **pour lui seul** — `KpiDashboard` reste l'accueil du
 * Président et du Chef de commission, et n'est pas modifié.
 *
 * Tout vient de `GET /api/kpis/badges` (un seul appel, `CompteursAdminDto` enrichi par B1), plus la
 * lecture des actualités pour le bloc de droite.
 *
 * ⚠️ **2026-09-17, lot F5 — les quatre tuiles d'accès sont au complet.** « Sessions ouvertes » et
 * « connexions refusées sur 24 h », retirées par le §6 du plan faute de source, sont rallumées avec
 * la leur : le journal des connexions (`/api/sessions`, besoin backend B4). La ligne « tentatives de
 * connexion refusées » du bloc « À surveiller » aussi. **« Sessions ouvertes » se dit avec sa borne
 * de 12 heures** : le serveur ne compte que les connexions réussies non refermées et récentes, parce
 * qu'une session n'est fermée que par une déconnexion explicite — sans cette borne le chiffre ne
 * redescendrait jamais, et sans cette mention il se lirait « personnes connectées en ce moment ».
 *
 * ⚠️ **Ce qui n'est PAS dessiné, et pourquoi** (plan L6, §6 — « un chiffre sans source n'est pas
 * affiché : ni à zéro, ni avec un tiret ; absent ») :
 *
 * - le bloc **« Système »** de la maquette (schéma de base, dernière migration, dernière exécution du
 *   moteur d'alertes, profils actifs) : **aucune** route ne sert ces quatre valeurs — ni version de
 *   schéma, ni journal de migration, ni trace d'exécution du moteur. Le bloc est **retiré**, pas
 *   rempli de valeurs écrites en dur. Ce que le serveur sert vraiment et que rien n'affichait
 *   (`comptes`, `journalAudit`) est repris là où il a du sens : sous les tuiles d'accès et sous le
 *   tableau des changements ;
 * - la colonne **« Valeur » (avant → après)** de « Derniers changements de paramétrage » :
 *   `AuditLogService.enregistrer` ne renseigne ni `champModifie`, ni `ancienneValeur`, ni
 *   `nouvelleValeur` — l'intercepteur journalise la requête, pas le diff. Ces trois champs sont
 *   toujours nuls en exploitation. Le bloc dit donc **quand, qui et quoi**, jamais « 5 j → 4 j ».
 */
@Component({
  selector: 'app-admin-accueil',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, Icone],
  template: `
    <section class="acc">
      <header class="page-header">
        <p class="page-subtitle">Administration</p>
        <h1 class="page-title">Poste d'administration</h1>
        <p class="acc__jour">
          {{ dateDuJour() }}
          @if (doyenne(); as d) {
            ·
            <strong [class.acc__jour--retard]="d.enRetard">
              La plus ancienne demande attend {{ d.libelle }}
            </strong>
          }
        </p>
      </header>

      @if (chargement()) {
        <p class="acc__attente" role="status">Chargement de votre poste d'administration…</p>
      } @else if (erreur()) {
        <app-etat-erreur
          message="Les compteurs d'administration n'ont pas pu être chargés."
          aide="L'accueil reste vide tant que le serveur n'a pas répondu."
          (reessayer)="charger()"
        />
      } @else if (compteurs(); as c) {
        <div class="acc__grille">
          <!-- ─────────── Colonne principale ─────────── -->
          <div class="acc__col">
            <h2 class="acc__h2">À traiter maintenant <em>ce qui bloque quelqu'un d'autre</em></h2>
            <div class="acc__files">
              @for (f of files(); track f.cle) {
                <article class="acc-file" [class.acc-file--retard]="f.attente?.enRetard">
                  <div class="acc-file__tete">
                    <span class="acc-file__n">{{ f.nombre }}</span>
                    @if (f.nombre > 0 && f.attente) {
                      <span class="acc-file__tag" [class.acc-file__tag--retard]="f.attente.enRetard">
                        {{ f.attente.enRetard ? 'en retard' : 'dans les délais' }}
                      </span>
                    }
                  </div>
                  <h3 class="acc-file__titre">{{ f.titre }}</h3>
                  <p class="acc-file__attente">
                    @if (f.nombre === 0) {
                      Aucune demande en attente.
                    } @else if (f.attente) {
                      La plus ancienne attend {{ f.attente.libelle }}.
                    } @else {
                      Ancienneté non communiquée par le serveur.
                    }
                  </p>
                  <a
                    class="btn btn-sm acc-file__go"
                    [class.btn-primary]="f.attente?.enRetard"
                    [class.btn-outline]="!f.attente?.enRetard"
                    [routerLink]="f.lien"
                    >{{ f.action }}</a
                  >
                </article>
              }
            </div>

            <h2 class="acc__h2">Derniers changements de paramétrage <em>qui a changé quoi</em></h2>
            <div class="card">
              @if (reglagesChargement()) {
                <p class="acc-vide" role="status">Chargement des derniers changements…</p>
              } @else if (reglagesErreur()) {
                <div class="acc-encart">
                  <app-etat-erreur
                    message="Les derniers changements de paramétrage n'ont pas pu être lus."
                    aide="Le reste de l'accueil est à jour."
                    (reessayer)="chargerReglages()"
                  />
                </div>
              } @else if (reglages().length) {
                <table class="acc-journal">
                  <thead>
                    <tr>
                      <th scope="col">Quand</th>
                      <th scope="col">Qui</th>
                      <th scope="col">Réglage</th>
                      <th scope="col">Geste</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (l of reglages(); track l.idLog) {
                      <tr>
                        <td class="cnm-mono">{{ quand(l.dateAction) }}</td>
                        <td>{{ l.imActeur || '—' }}</td>
                        <td>{{ libelleReglage(l.nomTable) }}</td>
                        <td>{{ geste(l) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else {
                <p class="acc-vide">Aucun réglage n'a été modifié depuis la mise en service.</p>
              }
            </div>
            <p class="acc-pied">
              <a routerLink="/admin/audit">Tout le journal d'audit</a> ·
              {{ accord(c.journalAudit, 'écriture enregistrée', 'écritures enregistrées') }}
            </p>

            <h2 class="acc__h2">À surveiller</h2>
            <div class="card">
              <!-- ⚠️ Pré-contrôle du PPM (lot 3, étape 7) — la fatigue d'alerte est le seul risque qui
                   tue cette fonctionnalité : une règle écartée presque à chaque fois apprend à tout
                   écarter sans lire. La ligne n'apparaît que s'il y en a, et mène à la mesure. -->
              @if (reglesARevoir() > 0) {
                <div class="acc-veille">
                  <span class="acc-veille__ic" aria-hidden="true"><app-icone nom="filter" [taille]="15" /></span>
                  <div class="acc-veille__corps">
                    <b class="acc-veille__titre">
                      {{
                        accord(
                          reglesARevoir(),
                          'règle du pré-contrôle est écartée',
                          'règles du pré-contrôle sont écartées'
                        )
                      }}
                      presque à chaque fois
                    </b>
                    <span class="acc-veille__aide">
                      Une règle qu'on écarte toujours fatigue la PRMP et le contrôleur, qui finissent par
                      ne plus rien lire. À revoir, ou à éteindre.
                    </span>
                    <a class="acc-veille__lien" routerLink="/admin/pre-controle-regles">
                      Ouvrir les taux d'écartement
                    </a>
                  </div>
                </div>
              }
              @if (c.mandatsExpirantSous30j > 0) {
                <div class="acc-veille">
                  <span class="acc-veille__ic" aria-hidden="true"><app-icone nom="alert" [taille]="15" /></span>
                  <div class="acc-veille__corps">
                    <b class="acc-veille__titre">
                      {{ accord(c.mandatsExpirantSous30j, 'mandat PRMP expire', 'mandats PRMP expirent') }}
                      sous 30 jours
                    </b>
                    <span class="acc-veille__aide">À reconduire ou à abroger avant leur terme.</span>
                    <a class="acc-veille__lien" routerLink="/admin/comptes/mandats">Ouvrir les mandats PRMP</a>
                  </div>
                </div>
              }
              <!-- ⚠️ Lot 6 F5 — la ligne « échecs de connexion » de la maquette A, rallumée avec sa
                   source (B4). Le seuil est ZÉRO et non un « pic » : inventer un seuil au-delà
                   duquel il faudrait s'inquiéter n'appartient pas à l'écran. L'aide dit en revanche
                   ce que le nombre veut dire, pour qu'une faute de frappe ne passe pas pour une
                   attaque. -->
              @if (c.echecsConnexion24h > 0) {
                <div class="acc-veille">
                  <span class="acc-veille__ic acc-veille__ic--risque" aria-hidden="true">
                    <app-icone nom="key" [taille]="15" />
                  </span>
                  <div class="acc-veille__corps">
                    <b class="acc-veille__titre">
                      {{
                        accord(
                          c.echecsConnexion24h,
                          'tentative de connexion refusée',
                          'tentatives de connexion refusées'
                        )
                      }}
                      en 24 h
                    </b>
                    <span class="acc-veille__aide">
                      Un mot de passe mal tapé en produit une ; c'est leur répétition sur un même
                      login, ou depuis une même adresse, qui doit alerter.
                    </span>
                    <a
                      class="acc-veille__lien"
                      routerLink="/admin/audit"
                      [queryParams]="{ journal: 'connexions', succes: 'false' }"
                      >Voir les tentatives refusées</a
                    >
                  </div>
                </div>
              }
              @if (c.mandatsExpirantSous30j === 0 && c.echecsConnexion24h === 0) {
                <p class="acc-vide">
                  Rien à signaler : aucun mandat PRMP n'arrive à terme dans les 30 jours, et aucune
                  tentative de connexion n'a été refusée depuis 24 heures.
                </p>
              }
            </div>
          </div>

          <!-- ─────────── Colonne de côté ─────────── -->
          <div class="acc__col">
            <h2 class="acc__h2">Accès</h2>
            <div class="acc-tuiles">
              <div class="acc-tuile">
                <span class="acc-tuile__n">{{ nombre(c.comptesActifs) }}</span>
                <span class="acc-tuile__l">comptes actifs</span>
              </div>
              <div class="acc-tuile">
                <span class="acc-tuile__n">{{ nombre(c.comptesSuspendus) }}</span>
                <span class="acc-tuile__l">comptes suspendus</span>
              </div>
              <!-- ⚠️ Lot 6 F5 — les deux tuiles que le §6 du plan interdisait d'afficher : leur
                   source (le journal des connexions, B4) existe depuis le 2026-09-17. -->
              <div class="acc-tuile">
                <span class="acc-tuile__n">{{ nombre(c.sessionsOuvertes) }}</span>
                <!-- ⚠️ « depuis moins de 12 h » fait partie de la MESURE, pas de l'habillage : une
                     session n'est fermée que par une déconnexion explicite, et presque personne ne
                     se déconnecte. Sans cette borne le chiffre ne redescendrait jamais — et sans
                     cette mention il se lirait « personnes connectées en ce moment ». -->
                <span class="acc-tuile__l">sessions ouvertes <em>depuis moins de 12 h</em></span>
              </div>
              <div class="acc-tuile" [class.acc-tuile--alerte]="c.echecsConnexion24h > 0">
                <span class="acc-tuile__n">{{ nombre(c.echecsConnexion24h) }}</span>
                <span class="acc-tuile__l">connexions refusées <em>sur 24 h</em></span>
              </div>
            </div>
            <p class="acc-pied">
              sur {{ accord(c.comptes, 'compte enregistré', 'comptes enregistrés') }} ·
              <a routerLink="/admin/comptes">Comptes &amp; personnes</a> ·
              <a routerLink="/admin/comptes/interims">Intérims</a> ·
              <a routerLink="/admin/audit" [queryParams]="{ journal: 'connexions' }">Journal des connexions</a>
            </p>

            <h2 class="acc__h2">Actualité à l'ouverture</h2>
            <div class="card acc-actu">
              @if (actuChargement()) {
                <p class="acc-vide" role="status">Chargement de l'actualité…</p>
              } @else if (actuErreur()) {
                <app-etat-erreur
                  message="Les actualités n'ont pas pu être lues."
                  aide="Le reste de l'accueil est à jour."
                  (reessayer)="chargerActualite()"
                />
              } @else if (actualite(); as a) {
                <p class="acc-actu__etat">
                  <span class="badge badge-success">Affichée</span>
                  <span class="acc-actu__cible">{{ cibles(a) }}</span>
                </p>
                <div class="acc-actu__filet" aria-hidden="true"></div>
                <b class="acc-actu__titre">{{ a.titre }}</b>
                <p class="acc-actu__meta">{{ publieeLe(a) }}</p>
                @if (autresAffichees() > 0) {
                  <p class="acc-actu__meta">
                    {{ accord(autresAffichees(), 'autre actualité est affichée', 'autres actualités sont affichées') }}
                    en même temps.
                  </p>
                }
                <a class="btn btn-sm btn-outline acc-actu__go" routerLink="/admin/actualites">Modifier</a>
              } @else {
                <p class="acc-vide">
                  @if (!actualitesActives()) {
                    Aucune actualité n'est affichée : l'affichage à la connexion est désactivé.
                  } @else {
                    Aucune actualité n'est affichée à l'ouverture de session.
                  }
                </p>
                <a class="btn btn-sm btn-outline acc-actu__go" routerLink="/admin/actualites">Gérer les actualités</a>
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .acc__jour { font-size: var(--text-md); color: var(--n-500); margin: 0; }
    .acc__jour strong { font-weight: 700; color: var(--n-700); }
    .acc__jour strong.acc__jour--retard { color: var(--danger-text); }
    .acc__attente { color: var(--n-500); }

    /* Deux colonnes, la seconde à largeur fixe (maquette A) ; une seule en dessous de 1100 px. */
    .acc__grille { display: grid; grid-template-columns: minmax(0, 1fr) 336px; gap: 16px; align-items: start; }
    @media (max-width: 1100px) { .acc__grille { grid-template-columns: minmax(0, 1fr); } }
    .acc__col { min-width: 0; }

    .acc__h2 {
      font-size: var(--text-md);
      font-weight: 800;
      color: var(--n-800);
      margin: 18px 0 9px;
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    .acc__col > .acc__h2:first-child { margin-top: 0; }
    .acc__h2 em { font-style: normal; font-weight: 500; font-size: var(--text-sm); color: var(--n-400); }

    /* ── Files d'attente ─────────────────────────────────────────────────── */
    .acc__files { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 12px; }
    .acc-file {
      position: relative;
      overflow: hidden;
      background: #fff;
      border: 0.5px solid var(--n-200);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-sm);
      padding: 13px 15px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    /* Liseré de gauche : bleu par défaut, rouge dès que la file dépasse le préavis de 48 h.
       --p-600 et non le --p-500 de la maquette : 4,10:1 sur blanc contre 2,77:1, au-dessus du
       seuil des objets graphiques (WCAG 1.4.11) même si l'information est aussi portée par le texte. */
    .acc-file::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--p-600); }
    .acc-file--retard::before { background: var(--danger-text); }
    .acc-file__tete { display: flex; align-items: baseline; gap: 9px; }
    .acc-file__n { font-size: 30px; font-weight: 800; color: var(--n-800); line-height: 1; }
    /* ⚠️ --p-700 sur --p-50 : 5,57:1. La paire d'origine (--info-text sur --info-bg) tombe à
       3,84:1 — sous le seuil AA d'un texte de 11,5 px, qui n'est pas un « grand texte ». */
    .acc-file__tag {
      font-size: var(--text-xs);
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--p-50);
      color: var(--p-700);
    }
    .acc-file__tag--retard { background: var(--danger-bg); color: var(--danger-text); }
    .acc-file__titre { font-size: var(--text-md); font-weight: 700; color: var(--n-700); margin: 0; }
    .acc-file__attente { font-size: var(--text-sm); color: var(--n-400); margin: 1px 0 0; }
    .acc-file__go { margin-top: 9px; align-self: flex-start; }

    /* ── À surveiller ────────────────────────────────────────────────────── */
    .acc-veille { padding: 11px 14px; display: flex; gap: 11px; align-items: flex-start; }
    /* Deux veilles peuvent coexister : un filet les sépare, sans les enfermer chacune dans une carte. */
    .acc-veille + .acc-veille { border-top: 1px solid var(--n-200); }
    .acc-veille__ic {
      width: 26px; height: 26px; flex: none;
      border-radius: 7px;
      display: grid; place-items: center;
      background: var(--warning-bg); color: var(--warning-text);
    }
    /* --danger-text sur --danger-bg : 5,80:1. Les deux veilles ne se confondent pas d'un coup d'œil
       — et la couleur ne porte rien seule, chaque ligne dit son sujet en toutes lettres. */
    .acc-veille__ic--risque { background: var(--danger-bg); color: var(--danger-text); }
    .acc-veille__corps { display: flex; flex-direction: column; gap: 1px; }
    .acc-veille__titre { font-size: var(--text-base); font-weight: 700; color: var(--n-700); }
    .acc-veille__aide { font-size: var(--text-sm); color: var(--n-500); }
    .acc-veille__lien { font-size: var(--text-sm); font-weight: 700; color: var(--p-700); margin-top: 4px; }

    .acc-vide { font-size: var(--text-base); color: var(--n-500); margin: 0; padding: 12px 14px; }
    /* L'état d'erreur porte son propre fond : il lui faut la marge que la carte ne donne pas. */
    .acc-encart { padding: 12px 14px; }

    /* Tableau de RÉSUMÉ : le style du design system, en plus serré — quatre lignes doivent tenir
       sans repousser « À surveiller » hors de l'écran à 1366×768 (mesuré). */
    .acc-journal th { padding: 0.5rem 1.1rem; }
    .acc-journal td { padding: 0.55rem 1.1rem; }

    /* ── Tuiles d'accès ──────────────────────────────────────────────────── */
    .acc-tuiles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background: var(--n-200);
      border: 1px solid var(--n-200);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .acc-tuile { background: #fff; padding: 11px 13px; }
    .acc-tuile__n { display: block; font-size: var(--text-xl); font-weight: 800; color: var(--n-800); line-height: 1.1; }
    .acc-tuile__l { display: block; font-size: var(--text-sm); color: var(--n-500); margin-top: 2px; line-height: 1.3; }
    /* La précision de la mesure (« depuis moins de 12 h », « sur 24 h ») est écrite SOUS le libellé,
       à la même encre AA : ce n'est pas une note de bas de page, c'est ce que le chiffre compte. */
    .acc-tuile__l em { display: block; font-style: normal; font-size: var(--text-xs); }
    /* Une tuile d'échecs non nulle porte l'encre du danger sur son CHIFFRE — le libellé, lui, dit
       déjà « refusées » : la couleur ne fait que répéter, elle n'informe pas seule. */
    .acc-tuile--alerte .acc-tuile__n { color: var(--danger-text); }

    .acc-pied { font-size: var(--text-sm); color: var(--n-500); margin: 7px 0 0; }
    .acc-pied a { color: var(--p-700); font-weight: 700; }

    /* ── Actualité ───────────────────────────────────────────────────────── */
    .acc-actu { padding: 12px 14px; }
    .acc-actu .acc-vide { padding: 0 0 8px; }
    .acc-actu__etat { display: flex; align-items: center; gap: 7px; margin: 0; }
    /* ⚠️ Encre recalibrée, même geste que les jetons --*-ink du lot 5 : --success-text sur
       --success-bg ne donne que 3,58:1, sous le seuil AA. #047857 y monte à 5,21:1. La forme du
       badge (fond, cerné, arrondi) reste celle du design system — seule l'encre change, et ici
       seulement : le jeton global sert des dizaines d'écrans et ne se retouche pas depuis un lot. */
    .acc-actu__etat .badge-success { color: #047857; }
    .acc-actu__cible { font-size: var(--text-sm); color: var(--n-500); }
    .acc-actu__filet { height: 3px; border-radius: 2px; background: var(--p-200); margin: 9px 0 8px; }
    .acc-actu__titre { font-size: var(--text-base); color: var(--n-700); }
    .acc-actu__meta { font-size: var(--text-sm); color: var(--n-500); margin: 2px 0 0; }
    .acc-actu__go { margin-top: 9px; }
  `,
})
export class AdminAccueil {
  private readonly kpi = inject(KpiService);
  private readonly journal = inject(AuditLogService);
  private readonly actualites = inject(ActualiteService);
  private readonly parametres = inject(ParametreActualitesService);
  private readonly preControle = inject(PreControleService);

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly compteurs = signal<CompteursAdmin | null>(null);

  readonly reglagesChargement = signal(true);
  readonly reglagesErreur = signal(false);
  /** Dernières écritures sur les réglages, la plus récente d'abord (tri imposé par le serveur). */
  readonly reglages = signal<AuditLog[]>([]);

  /**
   * ⚠️ Pré-contrôle du PPM (2026-09-20, assistant IA lot 3, étape 7) — nombre de règles **actives**
   * écartées au-delà du seuil d'alerte. C'est la seule chose que l'accueil a besoin de savoir : le détail
   * se lit sur l'écran dédié, que la ligne « À surveiller » ouvre.
   *
   * <p>Un appel de plus, et non un champ ajouté aux badges : ce compteur ne concerne que le pré-contrôle,
   * et son absence (assistant jamais utilisé, endpoint indisponible) ne doit rien casser — la ligne
   * disparaît, l'accueil reste entier.</p>
   */
  readonly reglesARevoir = signal(0);

  readonly actuChargement = signal(true);
  readonly actuErreur = signal(false);
  /** Interrupteur global : à l'arrêt, aucune actualité n'est montrée à personne, quel que soit son statut. */
  readonly actualitesActives = signal(true);
  /** Les actualités réellement affichées à l'ouverture, la plus récente d'abord. */
  private readonly affichees = signal<Actualite[]>([]);

  /**
   * Instant de référence des ancienneté, figé au chargement : sans lui, deux lectures du même signal
   * à quelques millisecondes d'écart donneraient deux libellés, et les tests n'auraient pas de prise.
   */
  private readonly maintenant = signal(new Date());

  constructor() {
    this.charger();
    this.chargerReglages();
    this.chargerActualite();
    this.chargerReglesARevoir();
  }

  /**
   * Règles du pré-contrôle à revoir. En cas d'échec, on n'affiche rien : un compteur indisponible ne doit
   * pas faire clignoter une alerte, et l'accueil ne porte pas d'état d'erreur pour cette ligne.
   */
  chargerReglesARevoir(): void {
    this.preControle.statistiques().subscribe({
      next: (s) => this.reglesARevoir.set(s.regles.filter((r) => r.suspecte && r.actif).length),
      error: () => this.reglesARevoir.set(0),
    });
  }

  /** Compteurs de l'Administrateur — un seul appel (`GET /api/kpis/badges`). */
  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.kpi.badgesAdmin().subscribe({
      next: (b) => {
        this.maintenant.set(new Date());
        this.compteurs.set(b.compteurs);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  /**
   * Bloc « Derniers changements de paramétrage » — **un seul** appel pour les cinq réglages suivis
   * (livraison backend B5 : `table` accepte une liste). Six appels parallèles pour afficher cinq
   * lignes sont exactement ce que ce besoin serveur existait pour éviter.
   */
  chargerReglages(): void {
    this.reglagesChargement.set(true);
    this.reglagesErreur.set(false);
    this.journal.dernieresEcritures(
      REGLAGES.map((r) => r.ressource),
      NB_DERNIERS_CHANGEMENTS,
    ).subscribe({
      next: (page) => {
        this.reglages.set(page.content);
        this.reglagesChargement.set(false);
      },
      error: () => {
        this.reglagesErreur.set(true);
        this.reglagesChargement.set(false);
      },
    });
  }

  /**
   * Bloc « Actualité à l'ouverture ». Deux lectures : les actualités (vue Administrateur, toutes) et
   * l'interrupteur global. Le filtre reproduit la règle de visibilité du serveur — statut ACTIF et
   * fenêtre de dates — **sans** le ciblage par profil : l'Administrateur veut voir ce qui s'affiche
   * pour tout le monde, pas seulement ce qui le vise lui.
   */
  chargerActualite(): void {
    this.actuChargement.set(true);
    this.actuErreur.set(false);
    forkJoin({ toutes: this.actualites.list(), parametre: this.parametres.lire() }).subscribe({
      next: ({ toutes, parametre }) => {
        this.actualitesActives.set(parametre.actif);
        this.affichees.set(parametre.actif ? trierAffichees(toutes, new Date()) : []);
        this.actuChargement.set(false);
      },
      error: () => {
        this.actuErreur.set(true);
        this.actuChargement.set(false);
      },
    });
  }

  /** Date du jour en toutes lettres, comme la maquette (« 17 septembre 2026 »). */
  readonly dateDuJour = computed(() =>
    new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(this.maintenant()),
  );

  /** Les deux files de la section « À traiter maintenant », dans l'ordre de la maquette. */
  readonly files = computed<FileAttente[]>(() => {
    const c = this.compteurs();
    if (!c) {
      return [];
    }
    const t = this.maintenant();
    return [
      {
        cle: 'inscriptions',
        // ⚠️ Le titre dit PRMP **et** UGPM : depuis le 2026-09-17 le compteur porte les deux files,
        // comme l'écran qu'il annonce. « Inscriptions PRMP » (maquette) annoncerait un nombre faux.
        titre: 'Inscriptions PRMP et UGPM',
        nombre: c.inscriptionsEnAttente,
        attente: anciennete(c.inscriptionDoyenneLe, t, 'heure'),
        lien: '/admin/inscriptions',
        action: 'Traiter les inscriptions',
      },
      {
        cle: 'rattachements',
        titre: 'Rattachements PRMP ⇄ entité',
        nombre: c.rattachementsEnAttente,
        // 'jour' : `DATE_DECLARATION` est une date ramenée à minuit — cf. `anciennete.ts`.
        attente: anciennete(c.rattachementDoyenLe, t, 'jour'),
        lien: '/admin/rattachements',
        action: 'Traiter les rattachements',
      },
    ];
  });

  /** La plus ancienne des deux files — sous-titre de l'en-tête ; absente si les deux sont vides. */
  readonly doyenne = computed<Anciennete | null>(() =>
    this.files()
      .filter((f) => f.nombre > 0 && f.attente)
      .map((f) => f.attente as Anciennete)
      .reduce<Anciennete | null>((pire, a) => (pire && pire.ecouleMs >= a.ecouleMs ? pire : a), null),
  );

  /** L'actualité mise en avant : la plus récemment publiée parmi celles qui sont affichées. */
  readonly actualite = computed<Actualite | null>(() => this.affichees()[0] ?? null);
  /** Les autres actualités affichées en même temps (le modal en présente plusieurs). */
  readonly autresAffichees = computed(() => Math.max(0, this.affichees().length - 1));

  /** Profils visés par l'actualité — « tous profils » quand les dix le sont. */
  cibles(a: Actualite): string {
    const n = a.profilsCibles?.length ?? 0;
    if (n >= NB_PROFILS) return 'tous profils';
    if (n === 0) return 'aucun profil ciblé';
    if (n === 1) return LIBELLES_ROLES[a.profilsCibles[0]];
    return `${n} profils ciblés`;
  }

  /** « Publiée le 15/09/2026 par ADMIN01 » — la date de création fait foi à défaut de publication. */
  publieeLe(a: Actualite): string {
    const brut = a.datePublication ?? a.dateCreation;
    const quand = brut ? new Date(brut) : null;
    const date = quand && !isNaN(quand.getTime()) ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(quand) : null;
    const auteur = a.imAuteur ? ` par ${a.imAuteur}` : '';
    return date ? `Publiée le ${date}${auteur}` : `Publiée${auteur}`.trim();
  }

  /** « 16/09 14:32 » — le jour et l'heure suffisent sur un accueil ; l'année vit dans le journal. */
  quand(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return iso;
    }
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
  }

  /** Nom du réglage touché ; un nom de ressource inattendu reste lisible tel quel plutôt que masqué. */
  libelleReglage(nomTable: string | undefined): string {
    return REGLAGES.find((r) => r.ressource === nomTable)?.libelle ?? nomTable ?? '—';
  }

  /**
   * Le geste journalisé. `TYPE_ACTION` vaut CREATE / UPDATE / DELETE, ou le **sous-chemin** appelé
   * quand il y en a un (`PUT /api/parametres/agpm-seuil-montant` → `AGPM-SEUIL-MONTANT`) : c'est la
   * seule chose qui distingue deux réglages d'une même ressource, on la garde telle quelle.
   */
  geste(l: AuditLog): string {
    const type = l.typeAction ?? '';
    const connu: string | undefined = GESTES[type];
    // Un sous-chemin est un code technique : le laisser tel quel (AGPM-SEUIL-MONTANT) est plus
    // honnête que de le franciser à moitié — c'est exactement la valeur du journal.
    const libelle = connu ?? type;
    const numero = l.idEnregistrement ? ` n° ${l.idEnregistrement}` : '';
    return `${libelle}${numero}`.trim() || '—';
  }

  /** Séparateur de milliers français — les comptes de l'application se lisent à quatre chiffres. */
  nombre(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n);
  }

  /** Accord français : 0 et 1 restent au singulier, le pluriel commence à 2 (« 1 compte », « 0 écriture »). */
  accord(n: number, singulier: string, pluriel: string): string {
    return `${this.nombre(n)} ${n > 1 ? pluriel : singulier}`;
  }
}

/**
 * Actualités réellement affichées à l'ouverture, la plus récemment publiée d'abord.
 *
 * Même règle que `ActualiteRepository.visiblesPourProfil` côté serveur : statut `ACTIF`, publication
 * passée ou absente, expiration non atteinte (jour J compris). Le **ciblage par profil** en est
 * volontairement écarté (cf. `chargerActualite`).
 */
function trierAffichees(toutes: Actualite[], maintenant: Date): Actualite[] {
  const jour = maintenant.toISOString().slice(0, 10);
  return toutes
    .filter(
      (a) =>
        a.statut === 'ACTIF' &&
        (!a.datePublication || a.datePublication <= jour) &&
        (!a.dateExpiration || a.dateExpiration > jour),
    )
    .sort((x, y) => cleTri(y).localeCompare(cleTri(x)));
}

/** Date de publication effective (publication, sinon création) — clé de tri décroissant. */
function cleTri(a: Actualite): string {
  return a.datePublication ?? a.dateCreation ?? '';
}
