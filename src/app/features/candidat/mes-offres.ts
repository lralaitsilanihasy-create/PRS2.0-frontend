import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { empreinteCourte, formaterEmpreinte } from '../../core/securite/cles-detenteur';
import { telechargerBlob } from '../../core/securite/fichiers-surs';
import { EnveloppeOffre, EtatOffre, Offre, OffreLue } from '../../models';
import { OffresCandidatService, ProceduresEnLigneService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { DemandesOffre } from './demandes-offre';
import { ResultatOffreCandidat } from './resultat-offre';
import { dateHeureFr, tailleLisible } from './libelles-candidat';
import { EtatVideCandidat } from './etat-vide-candidat';
import { PhraseIncorrecte } from '../../core/securite/cles-detenteur';
import { dechiffrerCopie } from '../../core/securite/copie-offre';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { RecapitulatifOffre, RecapitulatifOffreVue, imprimerRecapitulatif } from './recapitulatif-offre';

const LIBELLES_ETAT: Readonly<Record<EtatOffre, string>> = {
  EN_COURS: 'Dépôt inachevé',
  DEPOSEE: 'Déposée',
  REMPLACEE: 'Remplacée',
  RETIREE: 'Retirée',
  ECARTEE: 'Écartée',
};

const LIBELLES_ENVELOPPE: Readonly<Record<EnveloppeOffre, string>> = { TECHNIQUE: 'Enveloppe technique', FINANCIERE: 'Enveloppe financière' };

/**
 * ⚠️ V86 (lot 3 PI, PI-b) — l'enveloppe qui manque à une proposition de prestations intellectuelles déposée à moitié : l'autre
 * enveloppe, si aucune offre déposée de la même procédure et du même lot ne la porte ; `null` pour une offre ordinaire ou complète.
 */
export function enveloppeManquante(o: Offre, toutes: Offre[]): EnveloppeOffre | null {
  if (!o.enveloppe || o.etat !== 'DEPOSEE') return null;
  const autre: EnveloppeOffre = o.enveloppe === 'TECHNIQUE' ? 'FINANCIERE' : 'TECHNIQUE';
  return toutes.some((x) => x.idDmc === o.idDmc && x.lot === o.lot && x.etat === 'DEPOSEE' && x.enveloppe === autre) ? null : autre;
}

/**
 * **Mes offres** (`GET /api/candidat/offres`, lot 3) : toutes les offres du candidat, toutes procédures. Une offre déposée
 * offre son accusé (PDF), son **remplacement** (un nouveau dépôt pour le même lot, qui ne fait tomber l'ancienne qu'à son
 * scellement) et son **retrait** (confirmé en deux temps) — tant que la date limite n'est pas passée et que la procédure
 * l'autorise ; le serveur tranche (409 nommés).
 */
@Component({
  selector: 'app-mes-offres',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, DemandesOffre, ResultatOffreCandidat, EtatVideCandidat, ModaleDirective, RecapitulatifOffreVue],
  template: `
    <header class="page-header">
      <div class="page-subtitle">Espace candidat</div>
      <h1 class="page-title">Mes offres</h1>
    </header>
    <p class="page-role">Vos offres déposées en ligne, avec leur accusé de réception. Tant que la date limite n’est pas passée, vous pouvez remplacer ou retirer une offre, si la procédure l’autorise.</p>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Vos offres n'ont pas pu être chargées." (reessayer)="charger()" />
    } @else if (!offres().length) {
      <app-etat-vide-candidat icone="send" titre="Aucune offre déposée" texte="Choisissez une procédure ouverte, retirez son dossier, puis déposez votre offre : elle est chiffrée sur votre poste et apparaît ici avec son accusé de réception.">
        <a etatVideAction class="btn btn-primary btn-sm" routerLink="/candidat/procedures">Voir les procédures ouvertes</a>
      </app-etat-vide-candidat>
    } @else {
      @if (message(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }
      <ul class="mo" aria-label="Mes offres">
        @for (o of offres(); track o.idOffre) {
          <li class="card mo__offre">
            <div class="mo__haut">
              <span><strong>{{ o.objet || ('Procédure ' + o.idDmc) }}</strong>{{ o.lot ? ' — lot ' + o.lot : '' }}</span>
              <!-- Recette du 09/10 : l'enveloppe à côté de l'état, à droite (dans le titre, elle repoussait l'état à la ligne). -->
              <span class="mo__badges">
                @if (o.enveloppe) { <span class="badge badge-info">{{ enveloppes[o.enveloppe] }}</span> }
                <span class="badge" [class.badge-success]="o.etat === 'DEPOSEE'" [class.badge-neutral]="o.etat === 'REMPLACEE' || o.etat === 'RETIREE' || o.etat === 'EN_COURS'" [class.badge-danger]="o.etat === 'ECARTEE'">{{ etats[o.etat] }}</span>
              </span>
            </div>
            <p class="text-sm text-muted mo__meta">
              <span class="cnm-mono">{{ o.reference }}</span>
              @if (o.dateDepot) { · déposée le {{ dateHeure(o.dateDepot) }}{{ o.numero ? ', n° ' + o.numero : '' }} }
              @if (o.dateRetrait) { · retirée le {{ dateHeure(o.dateRetrait) }} }
              · {{ taille(o.taille) }}
            </p>
            @if (manquante(o); as m) {
              <!-- ⚠️ V86 (PI-b) — une proposition PI se dépose en deux enveloppes : sans la seconde, la séance le signale. -->
              <div class="alert alert-warning mo__manque" role="note">
                <span>{{ enveloppes[m] }} non déposée : votre proposition est incomplète.</span>
                <a class="btn btn-sm btn-primary" [routerLink]="['/candidat', 'procedures', o.idDmc, 'offre']" [queryParams]="{ enveloppe: m, lot: o.lot }">Déposer l’{{ m === 'FINANCIERE' ? 'enveloppe financière' : 'enveloppe technique' }}</a>
              </div>
            }
            @if (o.empreinte) { <p class="text-xs mo__emp">Empreinte <code class="cnm-mono" [title]="formater(o.empreinte)">{{ courte(o.empreinte) }}</code></p> }
            <!-- ⚠️ 19/10 (V136, « copie-offre-candidat ») — la copie chiffrée par le candidat se relit avec sa phrase, jusqu'à la clôture de
                 la séance d'ouverture ; ensuite, l'offre telle que lue en séance, servie par le serveur. -->
            @if (o.copieEffaceeLe) { <p class="text-xs text-muted mo__emp">Copie chiffrée effacée le {{ dateHeure(o.copieEffaceeLe) }} : la séance d’ouverture est close, relisez votre offre telle que lue en séance.</p> }
            @if (o.etat === 'DEPOSEE') {
              <div class="mo__actions">
                <button type="button" class="btn btn-sm btn-outline" [disabled]="enCours() === o.idOffre" (click)="accuse(o)">Accusé (PDF)</button>
                @if (o.copie) { <button type="button" class="btn btn-sm btn-outline" (click)="ouvrirRelecture(o)">Relire mon offre</button> }
                @if (close(o)) { <button type="button" class="btn btn-sm btn-outline" [disabled]="enCours() === o.idOffre" (click)="lireEnSeance(o)">Mon offre lue en séance</button> }
                <!-- ⚠️ 14/10 — remplacer et retirer seulement tant que les dépôts sont ouverts (et si le DAO l'autorise). -->
                @if (modifiable(o)) {
                <a class="btn btn-sm btn-outline" [routerLink]="['/candidat', 'procedures', o.idDmc, 'offre']" [queryParams]="{ remplace: o.idOffre, lot: o.lot, enveloppe: o.enveloppe }">Remplacer</a>
                @if (aRetirer() !== o.idOffre) {
                  <button type="button" class="btn btn-sm btn-outline" (click)="aRetirer.set(o.idOffre)">Retirer…</button>
                } @else {
                  <span class="mo__confirm">{{ o.enveloppe ? 'Retirer cette proposition ? Ses deux enveloppes sont retirées, aucune ne sera ouverte.' : 'Retirer cette offre ? Elle ne sera pas ouverte.' }}
                    <button type="button" class="btn btn-sm btn-danger" [disabled]="enCours() === o.idOffre" (click)="retirer(o)">Confirmer le retrait</button>
                    <button type="button" class="btn btn-sm btn-outline" (click)="aRetirer.set(null)">Annuler</button>
                  </span>
                }
                }
              </div>
            }
            <!-- ⚠️ 07/10 — pendant l'évaluation, les demandes de la commission sur cette offre, et la réponse du candidat. -->
            @if (o.etat === 'DEPOSEE') {
              <app-demandes-offre [idOffre]="o.idOffre" />
              <!-- ⚠️ 07/10 (attribution, tranches 2b, 2c) — le résultat, la lettre, les explications ; attributaire : pièces et marché. -->
              <app-resultat-offre [idOffre]="o.idOffre" />
            }
          </li>
        }
      </ul>
    }

    @if (relecture(); as r) {
      <div class="modal-backdrop">
        <div class="modal mo__modale" role="dialog" aria-modal="true" aria-label="Relire mon offre" appModale (appModaleFermer)="relecture.set(null)">
          <div class="modal-header-plain">
            <span class="modal-title">Relire mon offre — {{ r.offre.objet || r.offre.reference }}</span>
            <button type="button" class="btn-close-plain" aria-label="Fermer" (click)="relecture.set(null)">✕</button>
          </div>
          <div class="modal-body">
            @if (r.recap; as recap) {
              <app-recapitulatif-offre [recap]="recap" />
            } @else {
              <p class="text-sm">Votre copie est chiffrée : elle ne s’ouvre qu’avec la phrase de relecture choisie au dépôt, sur ce poste — le serveur ne la reçoit pas.</p>
              <form (submit)="$event.preventDefault(); relire()" novalidate aria-label="Phrase de relecture">
                <label class="form-group"><span class="form-label">Phrase de relecture</span><input class="form-control" type="password" autocomplete="current-password" [value]="phrase()" (input)="phrase.set($any($event.target).value)" /></label>
                @if (r.erreur) { <div class="alert alert-danger" role="alert"><span>{{ r.erreur }}</span></div> }
                <button type="submit" class="btn btn-primary" [disabled]="r.occupe || !phrase()">{{ r.occupe ? 'Lecture…' : 'Relire' }}</button>
              </form>
            }
          </div>
          <div class="modal-footer">
            @if (r.recap) { <button type="button" class="btn btn-outline" (click)="imprimerRelecture()">Enregistrer en PDF</button> }
            <button type="button" class="btn btn-outline" (click)="relecture.set(null)">Fermer</button>
          </div>
        </div>
      </div>
    }

    @if (lue(); as l) {
      <div class="modal-backdrop">
        <div class="modal mo__modale" role="dialog" aria-modal="true" aria-label="Mon offre lue en séance" appModale (appModaleFermer)="lue.set(null)">
          <div class="modal-header-plain">
            <span class="modal-title">Mon offre lue en séance — {{ l.offre.objet || l.offre.reference }}</span>
            <button type="button" class="btn-close-plain" aria-label="Fermer" (click)="lue.set(null)">✕</button>
          </div>
          <div class="modal-body">
            @if (l.erreur) {
              <div class="alert alert-info" role="status"><span>{{ l.erreur }}</span></div>
            } @else if (l.lecture; as x) {
              <dl class="mo__dl">
                <dt>Numéro d’arrivée</dt><dd>{{ x.numero ?? '—' }}</dd>
                <dt>État</dt><dd>{{ x.etat }}</dd>
                @if (x.acteEngagement; as ae) {
                  <dt>Montant hors taxes</dt><dd>{{ nombre(ae.montantHt) }} Ar</dd>
                  <dt>Montant toutes taxes</dt><dd>{{ nombre(ae.montantTtc) }} Ar</dd>
                  <dt>Délai</dt><dd>{{ ae.delai }} {{ ae.delaiUnite === 'MOIS' ? 'mois' : 'jours' }}</dd>
                  <dt>Validité</dt><dd>{{ ae.validiteJours }} jours</dd>
                }
                @if (x.rabais?.lecture) { <dt>Rabais</dt><dd>{{ x.rabais!.lecture }}</dd> }
                @if (x.totaux; as t) { <dt>Totaux recalculés</dt><dd>HT {{ nombre(t.ht) }} Ar · TVA {{ nombre(t.tva) }} Ar · TTC {{ nombre(t.ttc) }} Ar</dd> }
                @if (x.garantie) { <dt>Garantie</dt><dd>{{ x.garantie.presente ? 'présente' : 'absente' }}{{ x.garantie.montant ? ' · ' + nombre(x.garantie.montant) + ' Ar' : '' }}</dd> }
                <dt>Pièces</dt><dd>@for (p of x.pieces; track p.code) { {{ p.libelle }} : {{ p.presente ? 'présente' : 'absente' }}{{ $last ? '' : ' · ' }} }</dd>
                @if (x.piecesManquantes.length) { <dt>Pièces manquantes</dt><dd>{{ x.piecesManquantes.join(', ') }}</dd> }
              </dl>
            }
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-outline" (click)="lue.set(null)">Fermer</button></div>
        </div>
      </div>
    }
  `,
  styles: `
    .mo { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .mo__offre { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .mo__haut { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .mo__meta, .mo__emp { margin: 0; }
    .mo__actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .mo__haut > span:first-child { flex: 1 1 20rem; min-width: 0; }
    .mo__badges { display: inline-flex; gap: 0.4rem; align-items: center; flex: none; }
    .mo__manque { display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; flex-wrap: wrap; margin: 0; }
    .mo__confirm { display: inline-flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); }
    .mo__modale { width: min(96vw, 60rem); }
    .mo__dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 0.9rem; font-size: var(--text-sm); }
    .mo__dl dt { color: var(--n-500); }
    .mo__dl dd { margin: 0; }
  `,
})
export class MesOffres implements OnInit {
  private readonly service = inject(OffresCandidatService);
  private readonly procedures = inject(ProceduresEnLigneService);
  /** Par procédure : peut-on encore remplacer ou retirer (dépôts ouverts à l'horloge du serveur, remplacement autorisé par le DAO) ? */
  private readonly ouvertes = signal<ReadonlyMap<number, boolean>>(new Map());
  /** Par procédure : la date limite est passée (`etat = CLOSE`) — l'offre peut avoir été lue en séance. */
  private readonly closes = signal<ReadonlySet<number>>(new Set());
  private readonly document = inject(DOCUMENT);
  private readonly toast = inject(ToastService);

  readonly etats = LIBELLES_ETAT;
  readonly enveloppes = LIBELLES_ENVELOPPE;
  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;
  readonly formater = formaterEmpreinte;
  readonly courte = empreinteCourte;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly offres = signal<Offre[]>([]);
  readonly aRetirer = signal<string | null>(null);
  readonly enCours = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  // ⚠️ 19/10 (V136) — la relecture de la copie chiffrée (phrase saisie ici, déchiffrement sur le poste) et l'offre lue en séance.
  readonly relecture = signal<{ offre: Offre; recap: RecapitulatifOffre | null; erreur: string | null; occupe: boolean } | null>(null);
  readonly phrase = signal('');
  readonly lue = signal<{ offre: Offre; lecture: OffreLue | null; erreur: string | null } | null>(null);

  constructor() {
    this.document.title = 'Mes offres — Espace candidat — PRS 2.0';
  }

  close(o: Offre): boolean {
    return this.closes().has(o.idDmc);
  }

  nombre(v: number | null | undefined): string {
    return v == null ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }

  ouvrirRelecture(o: Offre): void {
    this.phrase.set('');
    this.relecture.set({ offre: o, recap: null, erreur: null, occupe: false });
  }

  relire(): void {
    const r = this.relecture();
    const phrase = this.phrase();
    if (!r || r.occupe || !phrase) return;
    this.relecture.set({ ...r, occupe: true, erreur: null });
    this.service.lireCopie(r.offre.idOffre).subscribe({
      next: async (copie) => {
        try {
          const recap = await dechiffrerCopie<RecapitulatifOffre>(copie, phrase);
          this.phrase.set('');
          this.relecture.set({ ...r, recap, occupe: false, erreur: null });
        } catch (e) {
          this.relecture.set({ ...r, occupe: false, erreur: e instanceof PhraseIncorrecte ? 'Cette phrase ne déverrouille pas la copie. Elle est celle choisie au dépôt ; sans elle, la copie ne se relit pas.' : 'La copie n’a pas pu être lue.' });
        }
      },
      error: (e: ApiError) => {
        const code = codeErreur(e);
        this.relecture.set({ ...r, occupe: false, erreur: code === 'COPIE_EFFACEE' ? 'La copie a été effacée à la clôture de la séance d’ouverture : relisez votre offre telle que lue en séance.' : code === 'COPIE_ABSENTE' ? 'Aucune copie n’a été gardée pour cette offre.' : e.message || 'La copie n’a pas pu être lue.' });
      },
    });
  }

  imprimerRelecture(): void {
    const r = this.relecture()?.recap;
    if (r) imprimerRecapitulatif(this.document, r);
  }

  lireEnSeance(o: Offre): void {
    this.enCours.set(o.idOffre);
    this.service.lecture(o.idOffre).subscribe({
      next: (lecture) => {
        this.enCours.set(null);
        this.lue.set({ offre: o, lecture, erreur: null });
      },
      error: (e: ApiError) => {
        this.enCours.set(null);
        const code = codeErreur(e);
        this.lue.set({ offre: o, lecture: null, erreur: code === 'SEANCE_NON_DECHIFFREE' ? 'La séance d’ouverture n’a pas encore lu les offres : votre offre reste scellée jusque-là.' : code === 'OFFRE_NON_OUVERTE' ? 'Cette offre n’a pas été ouverte en séance (remplacée, retirée ou écartée).' : code === 'ENVELOPPE_FINANCIERE' ? 'L’enveloppe financière n’est pas servie ici.' : e.message || 'La lecture n’a pas pu être faite.' });
      },
    });
  }

  ngOnInit(): void {
    this.charger();
  }

  /**
   * ⚠️ 14/10 — « Remplacer » et « Retirer… » restaient proposés après la date limite : la fiche publique de chaque procédure dit si
   * les dépôts sont ouverts. Une fiche illisible ne masque rien (le serveur refuse de toute façon après l'échéance).
   */
  modifiable(o: Offre): boolean {
    return this.ouvertes().get(o.idDmc) !== false;
  }

  private lireProcedures(ids: number[]): void {
    if (!ids.length) return;
    forkJoin(ids.map((id) => this.procedures.detail(id).pipe(
      map((p) => [id, p.depotsOuverts === true && p.remplacementAutorise !== false, p.etat === 'CLOSE'] as const),
      catchError(() => of(null)),
    ))).subscribe((liste) => {
      const lues = liste.filter((x) => x !== null);
      this.ouvertes.set(new Map(lues.map(([id, ouverte]) => [id, ouverte])));
      this.closes.set(new Set(lues.filter(([, , close]) => close).map(([id]) => id)));
    });
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.liste().subscribe({
      next: (l) => {
        // Les dépôts inachevés se purgent seuls : on ne les montre pas.
        this.offres.set(l.filter((o) => o.etat !== 'EN_COURS'));
        this.chargement.set(false);
        this.lireProcedures([...new Set(l.map((o) => o.idDmc))]);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  manquante(o: Offre): EnveloppeOffre | null {
    return enveloppeManquante(o, this.offres());
  }

  accuse(o: Offre): void {
    this.enCours.set(o.idOffre);
    this.service.accuse(o.idOffre).subscribe({
      next: (b) => {
        this.enCours.set(null);
        telechargerBlob(b, `accuse-depot-${o.idDmc}-${o.idOffre.slice(0, 8)}.pdf`);
      },
      error: () => this.enCours.set(null),
    });
  }

  retirer(o: Offre): void {
    this.enCours.set(o.idOffre);
    this.message.set(null);
    this.service.retirer(o.idOffre).subscribe({
      next: () => {
        this.enCours.set(null);
        this.aRetirer.set(null);
        this.toast.success(o.enveloppe ? 'Votre proposition est retirée, ses deux enveloppes : aucune ne sera ouverte.' : 'Votre offre est retirée : elle ne sera pas ouverte.', 'C’est fait');
        this.charger();
      },
      error: (e: ApiError) => {
        this.enCours.set(null);
        const code = codeErreur(e);
        this.message.set(code === 'DELAI_DEPASSE' ? 'La date limite est passée : l’offre ne peut plus être retirée.' : code === 'REMPLACEMENT_INTERDIT' ? 'Cette procédure n’autorise pas le retrait d’une offre déposée.' : e.message || 'Le retrait n’a pas abouti.');
      },
    });
  }
}
