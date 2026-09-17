import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { FiltresSessions, SessionConnexion } from '../../models';
import { JournalConnexionService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { Icone } from '../../shared/ui/icone';

/** Saisie des filtres. `succes` est une CHAÎNE : un `<select>` ne rend pas de booléen. */
interface SaisieFiltres {
  acteur: string;
  succes: '' | 'true' | 'false';
  du: string;
  au: string;
}

const FILTRES_VIDES: SaisieFiltres = { acteur: '', succes: '', du: '', au: '' };

/**
 * Navigateurs reconnus dans l'en-tête `User-Agent`, **dans cet ordre** : Edge et Opera se déclarent
 * aussi « Chrome », et Chrome se déclare aussi « Safari ». Tester Chrome en premier les nommerait
 * tous Chrome.
 */
const NAVIGATEURS: readonly (readonly [string, string])[] = [
  ['Edg/', 'Edge'],
  ['OPR/', 'Opera'],
  ['Firefox/', 'Firefox'],
  ['Chrome/', 'Chrome'],
  ['Safari/', 'Safari'],
  ['curl/', 'curl'],
  ['PostmanRuntime', 'Postman'],
];

/** Systèmes reconnus, du plus précis au plus général (un iPhone dit aussi « Mac OS X »). */
const SYSTEMES: readonly (readonly [string, string])[] = [
  ['iPhone', 'iPhone'],
  ['iPad', 'iPad'],
  ['Android', 'Android'],
  ['Windows', 'Windows'],
  ['Mac OS X', 'macOS'],
  ['Linux', 'Linux'],
];

/**
 * **Journal des connexions** — onglet « Connexions » du Journal (lot 6, F5).
 *
 * Une ligne par tentative de connexion **examinée**, réussie ou refusée, plus la date de fermeture
 * quand la personne s'est déconnectée. Tout vient de `GET /api/sessions` (besoin backend B4, livré
 * le 2026-09-17), **en lecture seule** : il n'existe ni POST, ni PUT, ni DELETE. C'est le fond du
 * besoin — le CRUD `/api/session-utilisateurs` qu'il remplace laissait l'Administrateur forger une
 * trace de connexion ou effacer la sienne, et un journal de preuve modifiable est pire qu'absent.
 *
 * ⚠️ **Les filtres et la pagination partent au SERVEUR.** Filtrer la seule page affichée est le
 * défaut M15 de l'audit : l'utilisateur croit chercher dans le journal et ne cherche que dans vingt
 * lignes. Le serveur impose aussi le tri, du plus récent au plus ancien.
 *
 * ⚠️ **Distinguer un échec d'une connexion réussie est la raison d'être de cet écran** : la
 * différence est portée par trois choses à la fois, jamais par la couleur seule — le mot
 * (« Refusée »), le liseré rouge en tête de ligne, et le fond de la ligne.
 *
 * ⚠️ **Le « poste » est DÉDUIT** de l'en-tête `User-Agent` : c'est une commodité de lecture, pas une
 * donnée du serveur. Le texte exact reçu reste sous la main (attribut `title` de la cellule), et un
 * en-tête que l'on ne reconnaît pas est affiché **tel quel** plutôt que rangé dans une catégorie
 * fausse.
 */
@Component({
  selector: 'app-connexions-journal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, EtatErreur, Icone],
  template: `
    <div class="cx">
      <form class="cx__filtres" [formGroup]="form" (ngSubmit)="appliquer()" novalidate>
        <label class="form-group cx__filtre">
          <span class="form-label">Matricule ou login</span>
          <input class="form-control" type="text" formControlName="acteur" autocomplete="off" />
        </label>
        <label class="form-group cx__filtre">
          <span class="form-label">Résultat</span>
          <select class="form-control" formControlName="succes">
            <option value="">Toutes les tentatives</option>
            <option value="true">Connexions acceptées</option>
            <option value="false">Tentatives refusées</option>
          </select>
        </label>
        <label class="form-group cx__filtre">
          <span class="form-label">Du</span>
          <input class="form-control" type="date" formControlName="du" />
        </label>
        <label class="form-group cx__filtre">
          <span class="form-label">Au</span>
          <input class="form-control" type="date" formControlName="au" />
        </label>
        <div class="cx__filtres-actions">
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="chargement()">Filtrer</button>
          <button type="button" class="btn btn-outline btn-sm" [disabled]="chargement()" (click)="reinitialiser()">
            Réinitialiser
          </button>
        </div>
      </form>
      <p class="cx__aide">
        Le matricule est vide quand le login tenté n'existe pas — c'est alors le login qui est
        journalisé, et c'est souvent la ligne qu'on vient regarder. Les deux dates sont incluses ; les
        entrées vont de la plus récente à la plus ancienne.
      </p>

      @if (premierChargement()) {
        <p class="cx__etat" role="status">Chargement du journal des connexions…</p>
      } @else if (erreur()) {
        <app-etat-erreur
          message="Impossible de charger le journal des connexions."
          (reessayer)="recharger()"
        />
      } @else {
        <p class="cx__compte">
          {{ accord(totalElements(), 'connexion journalisée', 'connexions journalisées') }}
          <!-- Hauteur réservée : le message d'attente ne pousse pas le tableau vers le bas. -->
          <span class="cx__etat-en-ligne" role="status">@if (chargement()) { · chargement de la page… }</span>
        </p>

        @if (lignes().length) {
          <div class="table-card" [attr.aria-busy]="chargement()">
            <table class="cx__table">
              <thead>
                <tr>
                  <th scope="col">Résultat</th>
                  <th scope="col">Qui</th>
                  <th scope="col">Connexion</th>
                  <th scope="col">Déconnexion</th>
                  <th scope="col">Durée</th>
                  <th scope="col">Adresse IP</th>
                  <th scope="col">Poste</th>
                </tr>
              </thead>
              <tbody>
                <!-- idSession n'est pas exposé (c'est une empreinte de jeton) : la page est
                     remplacée d'un bloc à chaque lecture, l'index est donc une clé de suivi sûre. -->
                @for (l of lignes(); track $index) {
                  <tr [class.cx__ligne--echec]="!l.succes">
                    <td>
                      <span class="cx__res" [class.cx__res--echec]="!l.succes">
                        {{ l.succes ? 'Acceptée' : 'Refusée' }}
                      </span>
                    </td>
                    <td>
                      @if (l.acteur) {
                        <span class="cnm-mono">{{ l.acteur }}</span>
                        <span class="cx__sous">{{ l.login }}</span>
                      } @else {
                        <span class="cnm-mono">{{ l.login }}</span>
                        <span class="cx__sous cx__sous--alerte">login inconnu</span>
                      }
                    </td>
                    <td class="cnm-mono">{{ instant(l.dateConnexion) }}</td>
                    <td>
                      @if (l.dateDeconnexion) {
                        <span class="cnm-mono">{{ instant(l.dateDeconnexion) }}</span>
                      } @else if (l.succes) {
                        <span class="cx__rien">non fermée</span>
                      } @else {
                        <span class="cx__rien">—</span>
                      }
                    </td>
                    <td>
                      @if (l.dureeSecondes !== null) {
                        {{ duree(l.dureeSecondes) }}
                      } @else {
                        <span class="cx__rien">—</span>
                      }
                    </td>
                    <td class="cnm-mono">{{ l.ipAdresse || '—' }}</td>
                    <td class="cx__poste" [title]="l.userAgent || ''">{{ poste(l.userAgent) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (filtree()) {
          <div class="card cx__vide">
            <span class="cx__vide-ic" aria-hidden="true"><app-icone nom="search" [taille]="20" /></span>
            <b class="cx__vide-t">Aucune connexion ne correspond à ces critères.</b>
            <p class="cx__vide-a">
              Le matricule et le login sont comparés à l'identique ; une période trop étroite masque
              vite tout le journal.
            </p>
            <button type="button" class="btn btn-sm btn-outline" (click)="reinitialiser()">
              Retirer les filtres
            </button>
          </div>
        } @else {
          <div class="card cx__vide">
            <span class="cx__vide-ic" aria-hidden="true"><app-icone nom="key" [taille]="20" /></span>
            <b class="cx__vide-t">Le journal des connexions est vide.</b>
            <p class="cx__vide-a">
              Il se remplit tout seul : chaque tentative de connexion, acceptée ou refusée, y laisse
              une ligne, et chaque déconnexion y inscrit sa date.
            </p>
            <p class="cx__vide-a">
              ⚠️ Il ne contient <b>que</b> les connexions postérieures à sa mise en service — celles
              d'avant n'ont jamais été tracées nulle part, et rien ne permet de les reconstituer.
            </p>
          </div>
        }

        @if (totalPages() > 1) {
          <nav class="cx__pager" aria-label="Pages du journal des connexions">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              [disabled]="pageIndex() === 0 || chargement()"
              (click)="pagePrecedente()"
            >
              Précédent
            </button>
            <span class="cx__pager-info">Page {{ pageIndex() + 1 }} / {{ totalPages() }}</span>
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
  `,
  styles: `
    .cx__filtres {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
      margin-bottom: 0.4rem;
    }
    .cx__filtre { margin: 0; flex: 1 1 11rem; min-width: 9rem; }
    /* ⚠️ Contraste recalibré localement, même geste que F2 et F3. .form-label (global) est en
       --n-400, calibré 4,51:1 SUR BLANC — mais ces libellés-ci sont posés sur le fond de page
       (#f2f5fa), où la même encre tombe à **4,22:1**, sous le seuil AA d'un texte de 10 px. --n-500
       y remonte à 5,17:1. Le jeton global n'est pas touché : il coiffe tous les formulaires de
       l'application, et ce défaut-là déborde largement ce lot — il est SIGNALÉ, pas corrigé ici. */
    .cx__filtre .form-label { color: var(--n-500); }
    .cx__filtres-actions { display: flex; gap: 0.5rem; }
    .cx__aide { margin: 0 0 1rem; font-size: var(--text-sm); color: var(--n-500); }

    .cx__etat { color: var(--n-500); }
    .cx__compte { margin: 0 0 0.35rem; font-size: var(--text-sm); color: var(--n-500); font-weight: 600; }
    /* Hauteur réservée : le tableau ne bouge pas quand l'attente s'affiche puis disparaît. */
    .cx__etat-en-ligne { display: inline-block; min-width: 11rem; font-weight: 400; }

    /* ── Lignes ──────────────────────────────────────────────────────────── */
    /* ⚠️ --grad-primary (p-500 → p-600), fond d'en-tête de tableau du design system, ne donne que
       2,77:1 à 4,10:1 sous du blanc — sous AA pour ces 10 px. Repris ici deux crans plus bas
       (p-700 → p-800) : 5,93:1 à 7,56:1, même identité, contraste tenu. Même geste que F3 sur
       l'annuaire. Le jeton global n'est pas touché (il sert tous les tableaux de l'application) ;
       le défaut reste signalé, et l'onglet « Actions » le porte encore. */
    .cx__table thead tr { background: linear-gradient(to right, var(--p-700), var(--p-800)); }
    .cx__table td { vertical-align: top; }
    /* Un échec se voit sans lire : fond teinté ET liseré rouge en tête de ligne. Ni l'un ni l'autre
       ne portent seuls l'information — le mot « Refusée » est dans la première cellule. */
    .cx__ligne--echec { background: #fef6f6; }
    .cx__ligne--echec td:first-child { box-shadow: inset 3px 0 0 0 var(--danger-text); }

    .cx__res {
      display: inline-block;
      font-size: var(--text-xs);
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      white-space: nowrap;
      background: var(--success-bg);
      /* ⚠️ Encre recalibrée localement, même geste que F2 : --success-text (#059669) sur
         --success-bg ne donne que 3,58:1, sous le seuil AA d'un texte de 11 px. #047857 y monte à
         5,21:1. Le jeton global sert des dizaines d'écrans et ne se retouche pas depuis un lot. */
      color: #047857;
    }
    /* --danger-text sur --danger-bg : 5,80:1, au-dessus du seuil — la paire globale convient ici. */
    .cx__res--echec { background: var(--danger-bg); color: var(--danger-text); }

    .cx__sous { display: block; font-size: var(--text-xs); color: var(--n-500); margin-top: 1px; }
    .cx__sous--alerte { color: var(--danger-text); font-weight: 600; }
    .cx__rien { color: var(--n-500); font-style: italic; }
    .cx__poste { max-width: 14rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* ── État vide ───────────────────────────────────────────────────────── */
    /* Au démarrage c'est le cas COURANT, pas une exception : il a droit à sa carte, pas à une
       ligne grise au milieu d'un tableau à sept colonnes vides. */
    .cx__vide { padding: 26px 22px; text-align: center; }
    .cx__vide-ic {
      display: inline-grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-full);
      background: var(--p-50);
      color: var(--p-700);
      margin-bottom: 9px;
    }
    .cx__vide-t { display: block; font-size: var(--text-md); color: var(--n-800); }
    .cx__vide-a { font-size: var(--text-sm); color: var(--n-500); margin: 6px auto 0; max-width: 42rem; }
    .cx__vide .btn { margin-top: 12px; }

    .cx__pager {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 1rem;
    }
    .cx__pager-info { font-size: var(--text-sm); color: var(--n-500); font-weight: 600; }
  `,
})
export class ConnexionsJournal implements OnInit {
  private readonly service = inject(JournalConnexionService);
  private readonly fb = inject(FormBuilder);

  /**
   * Résultat sur lequel ouvrir l'onglet — l'accueil y renvoie déjà filtré sur les échecs
   * (« N tentatives de connexion refusées en 24 h »). `null` = pas de filtre.
   */
  readonly succesInitial = input<boolean | null>(null);

  /**
   * Personne sur laquelle ouvrir l'onglet — la fiche d'annuaire y renvoie par « Ses connexions ».
   * Chaîne vide = pas de filtre.
   */
  readonly acteurInitial = input('');

  readonly form = this.fb.nonNullable.group({ ...FILTRES_VIDES });
  /** Filtres réellement en vigueur : conservés d'une page à l'autre. */
  private readonly filtresActifs = signal<SaisieFiltres>({ ...FILTRES_VIDES });

  readonly lignes = signal<SessionConnexion[]>([]);
  readonly chargement = signal(false);
  private readonly dejaCharge = signal(false);
  /** Premier chargement : le tableau n'existe pas encore, on annonce l'attente en clair. */
  readonly premierChargement = computed(() => this.chargement() && !this.dejaCharge());
  readonly erreur = signal(false);

  readonly pageIndex = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  private readonly pageSize = 25;

  /** Vrai si au moins un filtre est en vigueur : « aucun résultat » ne se dit pas comme « vide ». */
  readonly filtree = computed(() => Object.values(this.filtresActifs()).some((v) => v !== ''));

  ngOnInit(): void {
    const succes = this.succesInitial();
    const acteur = this.acteurInitial().trim();
    if (succes !== null || acteur) {
      // Le filtre de départ est VISIBLE dans le formulaire : on n'ouvre pas un journal amputé sans
      // que l'utilisateur voie ce qui l'ampute, ni comment le retirer.
      const depart: SaisieFiltres = {
        ...FILTRES_VIDES,
        acteur,
        succes: succes === null ? '' : succes ? 'true' : 'false',
      };
      this.form.setValue(depart);
      this.filtresActifs.set(depart);
    }
    this.chargerPage(0);
  }

  appliquer(): void {
    this.filtresActifs.set(this.form.getRawValue());
    this.chargerPage(0);
  }

  reinitialiser(): void {
    this.form.reset({ ...FILTRES_VIDES });
    this.filtresActifs.set({ ...FILTRES_VIDES });
    this.chargerPage(0);
  }

  /** Rejoué par « Réessayer » : la page demandée, avec les filtres en vigueur (AUDIT.md P9). */
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

  private chargerPage(page: number): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.page(page, this.pageSize, this.parametres()).subscribe({
      next: (p) => {
        this.lignes.set(p.content);
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

  /** Filtres non vides seulement — une chaîne vide partirait en 400 sur les dates. */
  private parametres(): FiltresSessions {
    const a = this.filtresActifs();
    return {
      acteur: a.acteur.trim() || undefined,
      succes: a.succes === '' ? undefined : a.succes === 'true',
      du: a.du || undefined,
      au: a.au || undefined,
    };
  }

  /** « 17/09/2026 08:32 » — le journal porte des instants, l'année comprise. */
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

  /** Durée lisible : « 42 s », « 18 min », « 2 h 05 ». Le serveur la calcule à la lecture. */
  duree(secondes: number): string {
    if (secondes < 60) {
      return `${Math.max(0, Math.round(secondes))} s`;
    }
    const minutes = Math.floor(secondes / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const heures = Math.floor(minutes / 60);
    const reste = minutes % 60;
    return reste ? `${heures} h ${String(reste).padStart(2, '0')}` : `${heures} h`;
  }

  /**
   * Le « poste » de la maquette, **déduit** de l'en-tête `User-Agent` — « Chrome · Windows ».
   * Un en-tête non reconnu est rendu **tel quel** : mieux vaut un texte technique exact qu'une
   * catégorie inventée, sur un journal qui sert de preuve. La cellule porte toujours le texte reçu
   * dans son `title`.
   */
  poste(userAgent: string | null): string {
    if (!userAgent) {
      return '—';
    }
    const navigateur = NAVIGATEURS.find(([marqueur]) => userAgent.includes(marqueur))?.[1];
    const systeme = SYSTEMES.find(([marqueur]) => userAgent.includes(marqueur))?.[1];
    if (navigateur && systeme) {
      return `${navigateur} · ${systeme}`;
    }
    return navigateur ?? systeme ?? userAgent;
  }

  /** Accord français : 0 et 1 au singulier, le pluriel commence à 2. */
  accord(n: number, singulier: string, pluriel: string): string {
    return `${new Intl.NumberFormat('fr-FR').format(n)} ${n > 1 ? pluriel : singulier}`;
  }
}
