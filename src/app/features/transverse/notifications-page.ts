import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of, skip } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ESPACES_A_FAIRE } from '../../core/navigation/navigation';
import { routePourNotification } from '../../core/notifications/notification-route';
import { NotificationsStore } from '../../core/notifications/notifications.store';
import { Dossier, Notification, Role } from '../../models';
import { DossierService, FicheMarcheService, NotificationService } from '../../services';
import { Icone } from '../../shared/ui/icone';
import { corpsLisible, demandeAction, gesteNotification, iconeNotification, tonNotification } from './notifications-modele';
import { DossierConsultation } from '../circuit/dossier-consultation';
import { maintenantServeur } from '../../core/horloge/heure-serveur';

/** Les sigles d'un code de notification, gardés en capitales dans son libellé. */
const SIGLES: ReadonlySet<string> = new Set(['PV', 'CC', 'PRMP', 'UGPM', 'CAO', 'AMI', 'DAO', 'DMC', 'PPM', 'AGPM', 'SIGMP', 'AE', 'PI', 'CNM', 'ARMP']);
/** Les mots d'un code de notification qui portent un accent en français. */
const ACCENTS: Readonly<Record<string, string>> = {
  A: 'à', ACCEPTE: 'accepté', AJOUTEE: 'ajoutée', ANNULE: 'annulé', APPROUVE: 'approuvé', APRES: 'après', ATTRIBUE: 'attribué',
  CEREMONIE: 'cérémonie', CLES: 'clés', CLOTURE: 'clôture', CREE: 'créé', DECISION: 'décision', DEFINITIF: 'définitif', DELAI: 'délai',
  DEPASSEMENT: 'dépassement', DEPOSEE: 'déposée', DEPOT: 'dépôt', DEPOTS: 'dépôts', DESIGNE: 'désigné', DIFFUSEE: 'diffusée',
  ECHEANCE: 'échéance', ECHU: 'échu', ELIGIBLE: 'éligible', ENREGISTRE: 'enregistré', EVALUATION: 'évaluation', INTERIM: 'intérim',
  NOTIFIE: 'notifié', PIECE: 'pièce', PIECES: 'pièces', POSEE: 'posée', PRECISION: 'précision', PRET: 'prêt', PUBLIE: 'publié',
  PUBLIEES: 'publiées', RECEPTION: 'réception', RECU: 'reçu', RECUE: 'reçue', REFUSE: 'refusé', REPONSE: 'réponse', REPUTE: 'réputé', RETIRE: 'retiré',
  REEXAMINER: 'réexaminer', SEANCE: 'séance', SIGNE: 'signé', VALIDEE: 'validée', VERIFICATION: 'vérification', VERIFIER: 'vérifier',
};

/** Profils disposant d'un écran messagerie (routage des notifications MESSAGE). */
const MESSAGERIE_ROLES: Record<string, string> = {
  CHEF_COMMISSION: 'cc',
  VERIFICATEUR: 'verificateur',
  MEMBRE: 'membre',
  SECRETAIRE: 'secretaire',
};

/** Un groupe d'affichage : libellé de date (Aujourd'hui / Hier / date) + notifications du jour. */
interface GroupeJour {
  libelle: string;
  notifs: Notification[];
}

/**
 * ⚠️ Spec notifications (2026-08-02) — écran dédié « Notifications » (TOUS profils) : liste complète
 * scopée serveur (/mes), récentes en tête, regroupées par jour (Aujourd'hui / Hier / dates), marqueur
 * non-lu, filtres (toutes / non lues, par type d'événement), défilement progressif (« Charger plus »),
 * clic → marquage lu + ouverture de l'élément concerné, marquage manuel lu / non-lu unitaire,
 * « Tout marquer lu ». Le compteur de la cloche (NotificationsStore, serveur + SSE) est resynchronisé
 * à chaque action.
 *
 * ⚠️ Lot L4-F6 (2026-09-16) : le repli « consultation » d'un type non mappé mène à la PAGE du dossier
 * pour les huit profils du circuit. Les deux filtres vivent dans l'URL (`?lu=`, `?type=`) : ils
 * partent dans `returnUrl` et la liste se retrouve telle qu'on l'a quittée.
 *
 * ⚠️ Lot L5-F6 (2026-09-16) : l'Administrateur et le Chargé de publication, qui n'ont pas la page du
 * dossier en v1, ne gardent PLUS la modale de consultation — le serveur leur refusait le dossier et
 * le refus était avalé. Leur notification reste lisible, cesse d'être un bouton et le dit
 * (cf. `sansEcran`). La modale demeure pour un profil qui aurait un dossier consultable sans route
 * dédiée : aucun aujourd'hui.
 *
 * ⚠️ 01/11 (pilote, maquette « Notifications », variante A) — une notification par rangée : icône de son ton (geste à faire, bonne
 * nouvelle, information), titre et pastille « à faire », le MARCHÉ nommé par sa référence de plan et son objet (au lieu de « procédure
 * 5 », lu sur la fiche, sans boîte d'erreur), le texte sur une ligne, l'heure, l'intitulé du geste ; un filtre « Demandent une action ».
 */
@Component({
  selector: 'app-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DossierConsultation, Icone, NgTemplateOutlet],
  template: `
    <section class="np">
      <header class="page-header page-header--actions">
        <h1 class="page-title">Notifications</h1>
        <button type="button" class="btn btn-outline" (click)="toutLu()" [disabled]="!nbNonLues()">
          Tout marquer lu @if (nbNonLues()) { ({{ nbNonLues() }}) }
        </button>
      </header>
      <!-- Phrase de rôle (proposition 2026-09-22, lot B) : à quoi sert l'écran, pour qui. -->
      <p class="page-role">Ce que le circuit vous a signalé, du plus récent au plus ancien. Une notification non lue est surlignée jusqu'à ce que vous l'ouvriez ; la pastille « à faire » signale un geste attendu.</p>

      <div class="np__filtres">
        <div class="np__seg" role="group" aria-label="Notifications affichées">
          <button type="button" [attr.aria-pressed]="filtreLu() === 'toutes'" (click)="changerFiltreLu('toutes')">Toutes <span class="np__n">{{ notifs().length }}</span></button>
          <button type="button" [attr.aria-pressed]="filtreLu() === 'non-lues'" (click)="changerFiltreLu('non-lues')">Non lues <span class="np__n">{{ nbNonLues() }}</span></button>
          <button type="button" [attr.aria-pressed]="filtreLu() === 'action'" (click)="changerFiltreLu('action')"><span class="np__puce" aria-hidden="true"></span>Demandent une action <span class="np__n">{{ nbAction() }}</span></button>
        </div>
        <label class="cnm-sr-only" for="np-type">Filtrer par type d'événement</label>
        <select id="np-type" class="form-control np__type" [value]="filtreType() ?? ''" (change)="changerFiltreType($any($event.target).value || null)">
          <option value="">Tous les types ({{ typesPresents().length }})</option>
          @for (t of typesPresents(); track t) { <option [value]="t">{{ libelleType(t) }} ({{ nbParType().get(t) ?? 0 }})</option> }
        </select>
      </div>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        @for (g of groupesAffiches(); track g.libelle) {
          <h2 class="np__jour">{{ g.libelle }} · {{ g.notifs.length }}</h2>
          <ul class="np__liste">
            @for (n of g.notifs; track n.idNotification) {
              @let ton = tonDe(n);
              <li class="np__item" [class.np__item--nonlu]="!n.lu">
                @if (sansEcran(n)) {
                  <!-- ⚠️ Lot 5, F6 (2026-09-16) — aucune destination pour ce profil : ni bouton, ni requête ; la ligne le dit. -->
                  <div class="np__corps np__corps--inerte">
                    <ng-container [ngTemplateOutlet]="contenu" [ngTemplateOutletContext]="{ $implicit: n, ton: ton }" />
                    <span class="np__note">{{ mentionSansEcran(n) }}</span>
                  </div>
                } @else {
                  <button type="button" class="np__corps" (click)="ouvrir(n)" [attr.aria-label]="(n.titre || n.typeNotif) + ' — ' + geste(n)">
                    <ng-container [ngTemplateOutlet]="contenu" [ngTemplateOutletContext]="{ $implicit: n, ton: ton }" />
                    <span class="np__geste">{{ geste(n) }} ›</span>
                  </button>
                }
                <span class="np__heure">{{ heureSeule(n.dateEnvoi) }}</span>
                <button type="button" class="np__lu" (click)="basculerLu(n, !n.lu)" [attr.aria-label]="n.lu ? 'Marquer non lue' : 'Marquer lue'"
                  [title]="n.lu ? 'Marquer non lue' : 'Marquer lue'">{{ n.lu ? '● non lue' : '✓ lue' }}</button>
              </li>
            }
          </ul>
        } @empty {
          <div class="empty-state">
            <span class="empty-state-icon" aria-hidden="true">🔔</span>
            <div class="empty-state-title">Aucune notification</div>
            <div class="empty-state-text">{{ filtreLu() === 'non-lues' ? 'Aucune notification non lue.' : filtreLu() === 'action' ? 'Aucune notification ne demande d’action.' : 'Vous n’avez reçu aucune notification.' }}</div>
          </div>
        }

        @if (resteACharger() > 0) {
          <div class="np__plus">
            <button type="button" class="btn btn-secondary" (click)="chargerPlus()">
              Charger plus ({{ resteACharger() }} restante(s))
            </button>
          </div>
        }
      }
    </section>

    <!-- Le contenu d'une rangée : icône, titre et pastille, marché, texte (une ligne, entier en infobulle). -->
    <ng-template #contenu let-n let-ton="ton">
      <span class="np__ic np__ic--{{ ton }}" aria-hidden="true"><app-icone [nom]="icone(ton)" [taille]="14" /></span>
      <span class="np__textes">
        <span class="np__titre">{{ n.titre || n.typeNotif }}@if (ton === 'action') { <span class="np__afaire">à faire</span> }</span>
        @if (marcheDe(n); as m) { <span class="np__marche"><span class="np__ref">{{ m.plan }}</span> · {{ m.objet }}</span> }
        @if (n.corps) { <span class="np__texte" [title]="corps(n)">{{ corps(n) }}</span> }
      </span>
    </ng-template>

    @if (dossierConsulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="dossierConsulte.set(null)" />
    }
  `,
  styles: `
    .np { display: flex; flex-direction: column; gap: 0.5rem; }
    .np__filtres { display: flex; align-items: center; gap: 0.6rem 0.75rem; flex-wrap: wrap; margin-bottom: 0.25rem; padding: 0.5rem 0.75rem;
      background: var(--carte-fond); border: 1px solid var(--bordure); border-radius: 6px; }
    .np__seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--bordure); border-radius: 6px; overflow: hidden; }
    .np__seg button { display: inline-flex; align-items: center; gap: 0.35rem; border: 0; border-left: 1px solid var(--bordure); background: var(--carte-fond);
      padding: 0.3rem 0.8rem; font: inherit; font-size: 0.85rem; color: var(--texte); cursor: pointer; }
    .np__seg button:first-child { border-left: 0; }
    .np__seg button[aria-pressed="true"] { background: var(--section-fond); color: var(--texte-menu); font-weight: 500; }
    .np__seg button:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: -2px; }
    .np__n { font-size: 0.75rem; opacity: 0.85; }
    .np__puce { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--or); }
    .np__type { width: auto; min-width: 16rem; margin-left: auto; }
    .np__jour { margin: 0.6rem 0 0.2rem; font-size: 0.75rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--texte-secondaire); }
    .np__liste { list-style: none; margin: 0; padding: 0; background: var(--carte-fond); border: 1px solid var(--bordure); border-radius: 6px; overflow: hidden; }
    /* Une rangée : le contenu cliquable, l'heure, le marquage lu / non lue. */
    .np__item { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 0.75rem; padding-right: 0.75rem;
      border-top: 1px solid var(--bordure); }
    .np__item:first-child { border-top: 0; }
    .np__item:hover { background: var(--ligne-survol); }
    .np__item--nonlu { background: var(--onglet-actif-fond); }
    .np__item--nonlu::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--section-fond); }
    .np__item--nonlu .np__titre { font-weight: 600; }
    .np__corps { display: grid; grid-template-columns: 1.9rem minmax(0, 1fr) auto; align-items: center; gap: 0.2rem 0.75rem; min-width: 0; padding: 0.5rem 0 0.5rem 0.9rem;
      border: 0; background: transparent; font: inherit; color: inherit; text-align: left; cursor: pointer; }
    .np__corps:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: -2px; }
    /* Ligne sans destination : même gabarit, mais rien n'y invite au clic (lot L5-F6). */
    .np__corps--inerte { cursor: default; }
    .np__ic { display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 50%; background: var(--neutre-fond); color: var(--neutre-texte); }
    .np__ic--action { background: var(--examen-fond); color: var(--examen-texte); }
    .np__ic--positif { background: var(--favorable-fond); color: var(--favorable-texte); }
    .np__textes { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .np__titre { font-weight: 500; color: var(--texte); display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.5rem; }
    .np__afaire { padding: 0 0.45rem; border-radius: 999px; background: var(--examen-fond); color: var(--examen-texte); font-size: 0.72rem; font-weight: 500; }
    .np__marche, .np__texte { font-size: 0.82rem; color: var(--texte-secondaire); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .np__ref { color: var(--texte); }
    .np__geste { font-size: 0.82rem; color: var(--texte); text-decoration: underline; text-decoration-color: var(--lien-soulignement); white-space: nowrap; }
    .np__note { grid-column: 2 / -1; color: var(--texte-secondaire); font-size: 0.8rem; font-style: italic; }
    .np__heure { font-size: 0.8rem; color: var(--texte-secondaire); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .np__lu { border: 1px solid transparent; background: none; border-radius: 4px; padding: 0.15rem 0.4rem; font: inherit; font-size: 0.75rem;
      color: var(--texte-secondaire); cursor: pointer; white-space: nowrap; }
    .np__lu:hover { border-color: var(--bordure); background: var(--carte-fond); }
    .np__lu:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: 1px; }
    .np__plus { display: flex; justify-content: center; margin-top: 0.75rem; }
    @media (max-width: 40rem) {
      .np__item { grid-template-columns: minmax(0, 1fr) auto; }
      .np__heure { display: none; }
      .np__corps { grid-template-columns: 1.9rem minmax(0, 1fr); }
      .np__geste { grid-column: 2; }
      .np__type { margin-left: 0; min-width: 0; width: 100%; }
    }
  `,
})
export class NotificationsPage {
  private readonly service = inject(NotificationService);
  private readonly dossierService = inject(DossierService);
  private readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly notifs = signal<Notification[]>([]);
  readonly filtreLu = signal<'toutes' | 'non-lues' | 'action'>('toutes');
  readonly filtreType = signal<string | null>(null);
  /** Fenêtre d'affichage (défilement progressif — « Charger plus » par pas de 20). */
  readonly fenetre = signal(20);
  readonly dossierConsulte = signal<Dossier | null>(null);

  readonly nbNonLues = computed(() => this.notifs().filter((n) => !n.lu).length);
  /** ⚠️ 01/11 — les notifications qui demandent un geste (filtre « Demandent une action »). */
  readonly nbAction = computed(() => this.notifs().filter((n) => demandeAction(n.typeNotif)).length);
  readonly nbParType = computed(() => {
    const m = new Map<string, number>();
    for (const n of this.notifs()) if (n.typeNotif) m.set(n.typeNotif, (m.get(n.typeNotif) ?? 0) + 1);
    return m;
  });
  /** ⚠️ 01/11 — le marché de chaque procédure citée (fiche lue une fois, silencieusement) : référence du plan et objet. */
  private readonly fiches = inject(FicheMarcheService);
  readonly marches = signal<ReadonlyMap<number, { plan: string; objet: string }>>(new Map());
  readonly typesPresents = computed(() =>
    [...new Set(this.notifs().map((n) => n.typeNotif).filter((t): t is string => !!t))].sort(),
  );
  /** Notifications filtrées (récentes en tête). */
  private readonly filtrees = computed(() => {
    const type = this.filtreType();
    return this.notifs()
      .filter((n) => (this.filtreLu() === 'non-lues' ? !n.lu : this.filtreLu() === 'action' ? demandeAction(n.typeNotif) : true))
      .filter((n) => (type ? n.typeNotif === type : true));
  });
  readonly resteACharger = computed(() => Math.max(0, this.filtrees().length - this.fenetre()));
  /** Groupes par jour (Aujourd'hui / Hier / date), sur la fenêtre affichée. */
  readonly groupesAffiches = computed<GroupeJour[]>(() => {
    const groupes: GroupeJour[] = [];
    for (const n of this.filtrees().slice(0, this.fenetre())) {
      const libelle = this.libelleJour(n.dateEnvoi);
      const dernier = groupes[groupes.length - 1];
      if (dernier && dernier.libelle === libelle) {
        dernier.notifs.push(n);
      } else {
        groupes.push({ libelle, notifs: [n] });
      }
    }
    return groupes;
  });

  constructor() {
    // Filtres repris de l'URL (lot L4-F6) : c'est eux que `returnUrl` ramène au retour de la page.
    const q = this.route.snapshot.queryParamMap;
    if (q.get('lu') === 'non-lues' || q.get('lu') === 'action') this.filtreLu.set(q.get('lu') as 'non-lues' | 'action');
    this.filtreType.set(q.get('type'));

    this.charger();
    // Temps réel : toute révision du store (SSE / autre onglet / action locale) recharge la liste.
    // skip(1) : le chargement initial est déjà déclenché ci-dessus — un effect s'exécutant aussi au
    // premier cycle, chaque montage lançait `GET /notifications/mes` deux fois (motif dossiers-liste).
    toObservable(this.store.revision)
      .pipe(skip(1), takeUntilDestroyed())
      .subscribe(() => this.charger(false));
    // Les procédures citées : leur fiche, lue une fois chacune, pour nommer le marché.
    effect(() => {
      const deja = untracked(() => this.marches());
      const ids = [...new Set(this.notifs().filter((n) => n.typeObjet === 'PROCEDURE' && n.idObjet != null).map((n) => n.idObjet as number))]
        .filter((id) => !deja.has(id));
      if (!ids.length) return;
      untracked(() => forkJoin(ids.map((id) => this.fiches.lireSilencieuse(id).pipe(catchError(() => of(null))))).subscribe((fs) => {
        const m = new Map(this.marches());
        fs.forEach((f, i) => { if (f?.designationMarche) m.set(ids[i], { plan: f.refeDossier ? 'plan ' + f.refeDossier : 'procédure', objet: f.designationMarche }); });
        this.marches.set(m);
      }));
    });
  }

  /** Le marché d'une notification de procédure, une fois sa fiche lue. */
  marcheDe(n: Notification): { plan: string; objet: string } | null {
    return n.typeObjet === 'PROCEDURE' && n.idObjet != null ? (this.marches().get(n.idObjet) ?? null) : null;
  }
  /** Le texte servi, le numéro interne retiré quand le marché est nommé à part. */
  corps(n: Notification): string {
    return corpsLisible(n.corps, !!this.marcheDe(n));
  }
  tonDe(n: Notification) { return tonNotification(n.typeNotif); }
  readonly icone = iconeNotification;
  geste(n: Notification): string { return gesteNotification(n.typeNotif); }

  private charger(avecSpinner = true): void {
    if (avecSpinner) this.loading.set(true);
    this.service.mes().subscribe({
      next: (rows) => {
        this.notifs.set([...rows].sort((a, b) => (b.dateEnvoi ?? '').localeCompare(a.dateEnvoi ?? '')));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  chargerPlus(): void {
    this.fenetre.update((f) => f + 20);
  }

  changerFiltreLu(v: 'toutes' | 'non-lues' | 'action'): void {
    this.filtreLu.set(v);
    this.ecrireFiltres();
  }

  changerFiltreType(t: string | null): void {
    this.filtreType.set(t);
    this.ecrireFiltres();
  }

  /** Les filtres dans l'URL, sans nouvelle entrée d'historique : filtrer n'est pas naviguer. */
  private ecrireFiltres(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { lu: this.filtreLu() === 'toutes' ? null : this.filtreLu(), type: this.filtreType() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** URL de la liste, filtres compris : `returnUrl` du lien vers la page d'un dossier. */
  private retour(): string {
    const parametres = [this.filtreLu() !== 'toutes' ? 'lu=' + this.filtreLu() : '', this.filtreType() ? `type=${encodeURIComponent(this.filtreType() as string)}` : ''].filter(Boolean);
    return `/notifications${parametres.length ? `?${parametres.join('&')}` : ''}`;
  }

  /**
   * Notification SANS écran d'action pour le profil connecté (lot L5-F6, 2026-09-16) : aucune route
   * dédiée, et aucune page du dossier où se replier. C'est le cas du Chargé de publication et de
   * l'Administrateur — absents d'`ESPACES_A_FAIRE`, ils n'ont pas la page en v1 — et celui d'une
   * notification sans objet, pour n'importe quel profil.
   *
   * Jusqu'ici la ligne était un bouton : le clic lançait `GET /api/dossiers/{id}`, le serveur
   * refusait, `error: () => {}` avalait le refus. Rien ne s'ouvrait et rien ne le disait — le
   * « 403 silencieux » du §6b du plan. Désormais la ligne n'est plus un bouton et n'appelle rien ;
   * elle porte la mention. Pour les huit profils du circuit, rien ne change : le repli du lot L4-F6
   * (la page du dossier) répond toujours, donc `routePourNotification` rend une cible.
   */
  sansEcran(n: Notification): boolean {
    const sansPageDossier = !ESPACES_A_FAIRE[(this.auth.role() ?? '') as Role];
    return (
      routePourNotification(n, this.auth.role()) === null && (n.idDossier == null || sansPageDossier)
    );
  }

  /** Mention affichée à la place de l'action ; elle nomme le dossier quand il y en a un. */
  mentionSansEcran(n: Notification): string {
    return n.idDossier != null
      ? 'Aucun écran dédié à votre profil pour ce dossier.'
      : 'Aucun écran dédié à votre profil.';
  }

  /**
   * Clic sur la notification : marquage lu automatique + navigation vers l'ÉCRAN D'ACTION correspondant
   * (mapping partagé `routePourNotification`, demande user 2026-08-11). Type non mappé → repli : la
   * PAGE du dossier (lot L4-F6), sa modale pour qui n'a pas la page, ou la messagerie.
   */
  ouvrir(n: Notification): void {
    if (!n.lu) {
      this.basculerLu(n, true);
    }
    const cible = routePourNotification(n, this.auth.role());
    if (cible) {
      if (cible.genre === 'route-type-dossier' && n.idDossier != null) {
        // Le drill-down « Mes dossiers » exige le type du dossier — résolu à la volée, repli sur le hub.
        this.dossierService.getById(n.idDossier).subscribe({
          next: (d) =>
            void this.router.navigate(d.idTypeDossier ? cible.versCommands(d.idTypeDossier) : cible.repli),
          error: () => void this.router.navigate(cible.repli),
        });
      } else if (cible.genre === 'page-dossier') {
        void this.router.navigate(cible.commands, { queryParams: { ...cible.queryParams, returnUrl: this.retour() } });
      } else if (cible.genre === 'route') {
        void this.router.navigate(cible.commands, cible.queryParams ? { queryParams: cible.queryParams } : undefined);
      } else {
        void this.router.navigate(cible.repli);
      }
      return;
    }
    if (n.idDossier != null) {
      this.dossierService.getById(n.idDossier).subscribe({
        next: (d) => this.dossierConsulte.set(d),
        error: () => {},
      });
    } else if (n.typeObjet === 'MESSAGE') {
      const base = MESSAGERIE_ROLES[this.auth.role() ?? ''];
      if (base) {
        void this.router.navigate([`/${base}/messagerie`]);
      }
    }
  }

  /** Marquage manuel unitaire lu / non-lu (le badge de la cloche suit via le store). */
  basculerLu(n: Notification, lu: boolean): void {
    const call = lu ? this.service.marquerLu(n.idNotification) : this.service.marquerNonLu(n.idNotification);
    call.subscribe({
      next: (maj) => {
        this.notifs.update((l) => l.map((x) => (x.idNotification === maj.idNotification ? maj : x)));
        this.store.actionLocale();
      },
      error: () => {},
    });
  }

  toutLu(): void {
    this.service.lireTout().subscribe({
      next: () => {
        this.notifs.update((l) => l.map((x) => ({ ...x, lu: true })));
        this.store.actionLocale();
      },
      error: () => {},
    });
  }

  /** Libellé du groupe : Aujourd'hui / Hier / « lundi 3 août 2026 ». */
  private libelleJour(iso?: string): string {
    if (!iso) return 'Sans date';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Sans date';
    const jour = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const auj = maintenantServeur();
    const aujJour = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate());
    const diff = Math.round((aujJour.getTime() - jour.getTime()) / 86_400_000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Hier';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(d);
  }

  /** ⚠️ 01/11 — l'heure seule : la journée est en intertitre. */
  heureSeule(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(d);
  }

  heure(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  }

  /**
   * Libellé lisible d'un type d'événement, tiré du code. ⚠️ 14/10 (refonte des présentations) — le filtre affichait « Cles publiees »,
   * « Recu a valider » : les mots du code retrouvent leurs accents, et les sigles restent en capitales.
   */
  libelleType(t: string): string {
    const mots = t.split('_').map((m) => SIGLES.has(m) ? m : (ACCENTS[m] ?? m.toLowerCase()));
    const texte = mots.join(' ');
    return texte.charAt(0).toUpperCase() + texte.slice(1);
  }
}
