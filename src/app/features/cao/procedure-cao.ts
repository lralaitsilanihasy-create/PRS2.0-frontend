import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { ContexteRepresentant, VueProcedureCao } from '../../models';
import { CaoEspaceService } from '../../services';

/** ⚠️ R1 — les contextes pour lesquels le président désigne un représentant, en clair. */
const CONTEXTES: Readonly<Record<ContexteRepresentant, string>> = {
  SEANCE: "la séance d'ouverture",
  SEANCE_FINANCIERE: 'la seconde séance',
  RAPPORT: "le rapport d'évaluation",
  AMI: 'la présélection',
};
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_CATEGORIES } from '../prmp/fiche-marche/fiche-marche-modele';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { LIBELLES_ORIGINE } from './libelles-cao';
import { MaCle } from './ma-cle';
import { SeanceMembre } from './seance-membre';

/**
 * La procédure vue par un membre de la CAO (`GET /api/cao/procedures/{idDmc}`, lot 2a §B2) : l'appel d'offres (version
 * courante de la fiche), la commission telle que la PRMP l'a désignée — sans les adresses des autres membres —, puis sa
 * part de clé (lot 2b). 403 s'il n'y siège pas.
 */
@Component({
  selector: 'app-procedure-cao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, MaCle, SeanceMembre],
  template: `
    <nav class="pc__ariane" aria-label="Fil d'Ariane">
      <a routerLink="/cao/mes-procedures">Mes procédures</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{{ vue()?.procedure?.reference || 'Procédure' }}</span>
    </nav>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (refuse()) {
      <div class="alert alert-info" role="status"><span>Vous ne siégez pas dans la commission de cette procédure.</span></div>
    } @else if (erreur()) {
      <app-etat-erreur message="La procédure n'a pas pu être chargée." (reessayer)="charger()" />
    } @else if (vue(); as v) {
      <header class="page-header">
        <div class="page-subtitle">
          <span class="cnm-mono">{{ v.procedure.reference || ('procédure ' + idDmc) }}</span>
          @if (v.president) { · <span class="badge badge-primary">Vous présidez la commission</span> }
        </div>
        <h1 class="page-title">{{ v.procedure.objet || 'Objet non renseigné' }}</h1>
        <p class="pc__sous">
          @if (v.procedure.autoriteContractante) { <span>{{ v.procedure.autoriteContractante }}</span> }
          @if (v.procedure.categorie) { <span>{{ categories[v.procedure.categorie] }}</span> }
          @if (v.procedure.dateLimite) { <span>Date limite des offres : <strong>{{ dateHeure(v.procedure.dateLimite) }}</strong></span> }
        </p>
      </header>

      <section class="card pc__bloc" aria-labelledby="pc-cao">
        <h2 id="pc-cao" class="pc__h2">La commission d'appel d'offres</h2>
        @if (v.cao.decision.reference) {
          <p class="text-sm">Décision de la PRMP n° <strong>{{ v.cao.decision.reference }}</strong>{{ v.cao.decision.date ? ' du ' + date(v.cao.decision.date) : '' }}.</p>
        }
        <ul class="pc__membres">
          @for (m of v.cao.membres; track m.id) {
            <li class="pc__membre">
              <span><strong>{{ m.nom }} {{ m.prenom }}</strong>{{ m.president ? ' — président' : '' }}</span>
              <span class="text-sm text-muted">{{ m.origine ? origines[m.origine] : 'Origine à préciser' }}{{ m.fonction ? ' · ' + m.fonction : '' }}{{ m.organisme ? ' · ' + m.organisme : '' }}{{ m.service ? ' · ' + m.service : '' }}{{ m.domaine ? ' · ' + m.domaine : '' }}</span>
            </li>
          }
        </ul>
        <!-- ⚠️ Manuel révisé, R1 (V101) — le président désigne, par séance, le membre qui le représente pour le quorum. -->
        @if (v.president) {
          <details class="pc__representant">
            <summary>Désigner mon représentant…</summary>
            <p class="text-sm text-muted">Le quorum de la commission exige le président ou son représentant, désigné pour un contexte précis. Sans désignation, vous êtes vous-même requis.</p>
            <div class="pc__representant-form">
              <label class="form-group">
                <span class="form-label">Pour</span>
                <select class="form-control" [value]="contexte()" (change)="contexte.set($any($event.target).value)">
                  <option value="SEANCE">la séance d'ouverture</option>
                  @if (v.procedure.categorie === 'PRESTATIONS_INTELLECTUELLES') { <option value="SEANCE_FINANCIERE">la seconde séance (enveloppes financières)</option> }
                  <option value="RAPPORT">le rapport d'évaluation</option>
                  @if (v.procedure.categorie === 'PRESTATIONS_INTELLECTUELLES') { <option value="AMI">la présélection (AMI)</option> }
                </select>
              </label>
              <label class="form-group">
                <span class="form-label">Membre</span>
                <select class="form-control" [value]="representant()" (change)="representant.set($any($event.target).value)">
                  <option value="">— Personne (je suis requis) —</option>
                  @for (m of membresRepresentables(); track m.im) { <option [value]="m.im">{{ m.nom }}</option> }
                </select>
              </label>
              <button type="button" class="btn btn-outline btn-sm" [disabled]="travailRepresentant()" (click)="designer()">{{ representant() ? 'Désigner' : 'Retirer la désignation' }}</button>
            </div>
            @if (designation(); as d) { <p class="text-sm" role="status">{{ d }}</p> }
            @if (erreurRepresentant(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
          </details>
        }
      </section>

      <!-- ⚠️ Lot 4 (V69) — la séance d'ouverture : apporter ses parts, puis la lecture. -->
      <app-seance-membre [idDmc]="idDmc" />

      <!-- ⚠️ AMI-b (07/10, V83) — prestations intellectuelles : la présélection de l'AMI précède la demande de propositions. -->
      @if (v.procedure.categorie === 'PRESTATIONS_INTELLECTUELLES') {
        <section class="card pc__bloc" aria-labelledby="pc-ami">
          <h2 id="pc-ami" class="pc__h2">Présélection (appel à manifestation d’intérêt)</h2>
          <p class="text-sm">Après la date limite, la commission note les expressions d’intérêt sur les critères publiés, le président arrête la liste restreinte, et tous signent le rapport de présélection.</p>
          <a class="btn btn-primary btn-sm pc__eval" [routerLink]="['/cao/procedures', idDmc, 'ami']">Ouvrir la présélection</a>
        </section>
      }

      <!-- ⚠️ 07/10 — l'évaluation des offres (lot 1) : déclaration préalable, étapes 2 à 5, rapport à signer. -->
      <section class="card pc__bloc" aria-labelledby="pc-eval">
        <h2 id="pc-eval" class="pc__h2">Évaluation des offres</h2>
        <p class="text-sm">Après le PV d'ouverture signé, la commission évalue les offres : examen préliminaire, montant évalué et classement, offres anormales, post-qualification, puis le rapport d'évaluation.</p>
        <a class="btn btn-primary btn-sm pc__eval" [routerLink]="['/cao/procedures', idDmc, 'evaluation']">Ouvrir l'évaluation</a>
      </section>

      <app-ma-cle [idDmc]="idDmc" />
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .pc__ariane { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); }
    .pc__ariane a { color: var(--p-700); font-weight: 600; }
    .pc__sous { margin: 0.25rem 0 0; display: flex; gap: 0.75rem; flex-wrap: wrap; color: var(--n-500); font-size: var(--text-sm); }
    .pc__bloc { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .pc__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .pc__membres { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    .pc__membre { display: flex; flex-direction: column; font-size: var(--text-sm); }
    .pc__eval { align-self: flex-start; }
    .pc__representant summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
    .pc__representant-form { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.6rem; align-items: end; padding-top: 0.4rem; }
    @media (max-width: 700px) { .pc__representant-form { grid-template-columns: 1fr; } }
  `,
})
export class ProcedureCao implements OnInit {
  private readonly service = inject(CaoEspaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  // ── ⚠️ R1 (V101) — le représentant du président, par contexte ──
  readonly contexte = signal<ContexteRepresentant>('SEANCE');
  readonly representant = signal('');
  readonly travailRepresentant = signal(false);
  readonly designation = signal<string | null>(null);
  readonly erreurRepresentant = signal<string | null>(null);
  /** Les membres de la commission ayant un compte, hors le président lui-même. */
  readonly membresRepresentables = computed(() =>
    (this.vue()?.cao.membres ?? [])
      .filter((m) => !m.president && m.compte?.idCompte && m.compte.idCompte !== this.auth.ref())
      .map((m) => ({ im: m.compte!.idCompte!, nom: `${m.nom} ${m.prenom ?? ''}`.trim() })),
  );

  designer(): void {
    if (this.travailRepresentant()) return;
    this.travailRepresentant.set(true);
    this.erreurRepresentant.set(null);
    const im = this.representant() || null;
    this.service.designerRepresentant(this.idDmc, this.contexte(), im).subscribe({
      next: (r) => {
        this.travailRepresentant.set(false);
        const quoi = CONTEXTES[r.contexte] ?? r.contexte;
        this.designation.set(r.im ? `${r.nom} vous représente pour ${quoi} (désigné le ${dateHeureFr(r.designeLe)}).` : `Aucun représentant pour ${quoi} : vous êtes requis.`);
        this.toast.success(r.im ? 'Représentant désigné.' : 'Désignation retirée.');
      },
      error: (e: ApiError) => {
        this.travailRepresentant.set(false);
        const code = codeErreur(e);
        this.erreurRepresentant.set(
          code === 'REPRESENTANT_INVALIDE' ? 'Ce membre ne peut pas vous représenter (hors commission, ou sans compte actif).'
          : code === 'CONTEXTE_INVALIDE' ? 'Ce contexte n’existe pas pour cette procédure.'
          : e.status === 403 ? 'Seul le président désigne son représentant.'
          : e.message || 'La désignation n’a pas abouti.',
        );
      },
    });
  }

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly categories = LIBELLES_CATEGORIES;
  readonly origines = LIBELLES_ORIGINE;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;

  readonly chargement = signal(true);
  readonly refuse = signal(false);
  readonly erreur = signal(false);
  readonly vue = signal<VueProcedureCao | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.refuse.set(false);
    this.erreur.set(false);
    this.service.procedure(this.idDmc).subscribe({
      next: (v) => {
        this.vue.set(v);
        this.document.title = `${v.procedure.reference || 'Procédure'} — Commission d’appel d’offres — PRS 2.0`;
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 403 || e.status === 404) this.refuse.set(true);
        else this.erreur.set(true);
      },
    });
  }
}
