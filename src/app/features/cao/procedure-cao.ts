import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { ContexteRepresentant, DossierSoumis, EtatSeance, VueProcedureCao } from '../../models';
import { AttributionService, CaoEspaceService } from '../../services';

/** ⚠️ R1 — les contextes pour lesquels le président désigne un représentant, en clair. */
const CONTEXTES: Readonly<Record<ContexteRepresentant, string>> = {
  SEANCE: "la séance d'ouverture",
  SEANCE_FINANCIERE: 'la seconde séance',
  RAPPORT: "le rapport d'évaluation",
  AMI: 'la présélection',
};
import { BandeauEspace, PuceBandeau } from '../../shared/ui/bandeau-espace';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_CATEGORIES } from '../prmp/fiche-marche/fiche-marche-modele';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { LIBELLES_ORIGINE } from './libelles-cao';
import { MaCle } from './ma-cle';
import { SeanceMembre } from './seance-membre';

/** Une étape du parcours du membre de la CAO. */
export interface EtapeParcoursCao {
  cle: 'OUVERTURE' | 'PV' | 'EVALUATION';
  titre: string;
  detail: string;
  etat: 'avenir' | 'cours' | 'fait' | 'ko';
}

/**
 * ⚠️ 19/10 (pilote) — le parcours du membre, de l'ouverture des plis à l'évaluation, selon l'état servi de la séance.
 * `dossierSoumis` : le dossier de marché est à la Commission — tout ce qui revient à la CAO est derrière elle.
 */
export function etapesParcoursCao(etat: EtatSeance | null, dossierSoumis = false): EtapeParcoursCao[] {
  const ouverture: EtapeParcoursCao = { cle: 'OUVERTURE', titre: 'Ouverture des plis', detail: 'Apporter mes parts', etat: 'avenir' };
  const pv: EtapeParcoursCao = { cle: 'PV', titre: "PV d'ouverture", detail: 'Relire et signer', etat: 'avenir' };
  const evaluation: EtapeParcoursCao = { cle: 'EVALUATION', titre: 'Évaluation des offres', detail: 'Décider, puis signer le rapport', etat: 'avenir' };
  if (dossierSoumis) return [{ ...ouverture, etat: 'fait' }, { ...pv, etat: 'fait' }, { ...evaluation, etat: 'fait', detail: 'Dossier de marché soumis' }];
  switch (etat) {
    case 'OUVERTE':
      return [{ ...ouverture, etat: 'cours', detail: 'Les parts arrivent' }, pv, evaluation];
    case 'DECHIFFREE':
      return [{ ...ouverture, etat: 'fait', detail: 'Offres ouvertes' }, { ...pv, etat: 'cours', detail: 'PV en préparation' }, evaluation];
    case 'PV_A_SIGNER':
      return [{ ...ouverture, etat: 'fait', detail: 'Offres ouvertes' }, { ...pv, etat: 'cours', detail: 'À signer par les présents' }, evaluation];
    case 'ILLISIBLE':
      return [{ ...ouverture, etat: 'ko', detail: 'Offres illisibles (constat)' }, pv, evaluation];
    case 'CLOSE':
      return [{ ...ouverture, etat: 'fait', detail: 'Offres ouvertes' }, { ...pv, etat: 'fait', detail: 'Signé' }, { ...evaluation, etat: 'cours' }];
    default:
      return [{ ...ouverture, detail: etat === 'A_VENIR' ? 'À la date limite' : 'Séance non programmée' }, pv, evaluation];
  }
}

/**
 * La procédure vue par un membre de la CAO (`GET /api/cao/procedures/{idDmc}`, lot 2a §B2) : l'appel d'offres (version
 * courante de la fiche), la commission telle que la PRMP l'a désignée — sans les adresses des autres membres —, puis sa
 * part de clé (lot 2b). 403 s'il n'y siège pas.
 */
@Component({
  selector: 'app-procedure-cao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, MaCle, SeanceMembre, BandeauEspace],
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
      <app-bandeau-espace [surtitre]="v.procedure.reference || 'Procédure'" [mono]="true" [titre]="v.procedure.objet || 'Objet non renseigné'" [puces]="puces()">
        @if (v.president) { <span bandeau-badge class="badge badge-primary">Vous présidez la commission</span> }
      </app-bandeau-espace>

      <!-- ⚠️ 19/10 (pilote) — le parcours du membre, tiré de l'état de la séance : où en est la commission, et ce qui vient. -->
      <ol class="pc__parcours" aria-label="Parcours de la commission">
        @for (e of parcours(); track e.cle; let i = $index) {
          <li class="pc__etape" [class.pc__etape--fait]="e.etat === 'fait'" [class.pc__etape--cours]="e.etat === 'cours'" [class.pc__etape--ko]="e.etat === 'ko'" [attr.aria-current]="e.etat === 'cours' ? 'step' : null">
            <span class="pc__pastille" aria-hidden="true">{{ e.etat === 'fait' ? '✓' : e.etat === 'ko' ? '!' : i + 1 }}</span>
            <span class="pc__etape-texte"><strong>{{ e.titre }}</strong><span>{{ e.detail }}</span></span>
          </li>
        }
      </ol>

      <div class="pc__grille">
        <div class="pc__principal">
          <!-- ⚠️ Lot 4 (V69) — la séance d'ouverture : apporter ses parts, signer le PV, puis la lecture. -->
          <app-seance-membre [idDmc]="idDmc" (etat)="etatSeance.set($event)" />
        </div>

        <aside class="pc__cote" aria-label="La commission et la suite">
          <!-- ⚠️ 07/10 — l'évaluation des offres (lot 1) : déclaration préalable, étapes 2 à 5, rapport à signer. -->
          <section class="card pc__bloc pc__bloc--eval" [class.pc__bloc--actif]="evaluationOuverte()" aria-labelledby="pc-eval">
            <h2 id="pc-eval" class="pc__h2">Évaluation des offres</h2>
            <p class="text-sm">Examen préliminaire, montant évalué et classement, offres anormales, post-qualification, puis le rapport d'évaluation que tous signent.</p>
            @if (!evaluationOuverte()) { <p class="text-xs text-muted">Elle s'ouvre après la signature du PV d'ouverture.</p> }
            <a class="btn btn-sm pc__eval" [class.btn-primary]="evaluationOuverte()" [class.btn-outline]="!evaluationOuverte()" [routerLink]="['/cao/procedures', idDmc, 'evaluation']">Ouvrir l'évaluation</a>
          </section>

          <!-- ⚠️ AMI-b (07/10, V83) — prestations intellectuelles : la présélection de l'AMI précède la demande de propositions. -->
          @if (v.procedure.categorie === 'PRESTATIONS_INTELLECTUELLES') {
            <section class="card pc__bloc" aria-labelledby="pc-ami">
              <h2 id="pc-ami" class="pc__h2">Présélection (AMI)</h2>
              <p class="text-sm">Après la date limite, la commission note les expressions d’intérêt sur les critères publiés, le président arrête la liste restreinte, et tous signent le rapport de présélection.</p>
              <a class="btn btn-primary btn-sm pc__eval" [routerLink]="['/cao/procedures', idDmc, 'ami']">Ouvrir la présélection</a>
            </section>
          }

          <section class="card pc__bloc" aria-labelledby="pc-cao">
            <h2 id="pc-cao" class="pc__h2">La commission</h2>
            @if (v.cao.decision.reference) {
              <p class="text-xs text-muted pc__decision">{{ libelleDecision(v.cao.decision.reference, v.cao.decision.date) }}</p>
            }
            <ul class="pc__membres">
              @for (m of v.cao.membres; track m.id) {
                <li class="pc__membre">
                  <span class="pc__avatar" [class.pc__avatar--president]="m.president" aria-hidden="true">{{ initiales(m) }}</span>
                  <span class="pc__membre-texte">
                    <strong>{{ m.nom }} {{ m.prenom }}</strong>
                    @if (m.president) { <span class="badge badge-info pc__badge">Président</span> }
                    <span class="text-xs text-muted">{{ m.origine ? origines[m.origine] : 'Origine à préciser' }}{{ m.fonction ? ' · ' + m.fonction : '' }}{{ m.organisme ? ' · ' + m.organisme : '' }}{{ m.service ? ' · ' + m.service : '' }}{{ m.domaine ? ' · ' + m.domaine : '' }}</span>
                  </span>
                </li>
              }
            </ul>
            <!-- ⚠️ Manuel révisé, R1 (V101) — le président désigne, par séance, le membre qui le représente pour le quorum.
                 ⚠️ R9c (14/10) — plus de désignation une fois un dossier de marché soumis : les séances sont closes. -->
            @if (v.president && etapeClose(); as d) {
              <p class="text-xs text-muted">La désignation d’un représentant est close : le dossier de marché n° {{ d.idDossier }} (lot {{ d.lot }}) est soumis à la Commission.</p>
            } @else if (v.president) {
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
        </aside>
      </div>

      <!-- ⚠️ 19/10 (pilote) — la clé sert à la cérémonie puis à la séance : repliée une fois la séance commencée. -->
      <details class="card pc__cle" [open]="cleDepliee()">
        <summary class="pc__cle-titre"><span>Ma part de clé</span><span class="text-sm text-muted">vérifier ma part, enregistrer ma copie, remplacer ma clé</span></summary>
        <app-ma-cle [idDmc]="idDmc" [titreVisible]="false" />
      </details>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 1.1rem; }
    .pc__ariane { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); }
    .pc__ariane a { color: var(--p-700); font-weight: 600; }
    .pc__parcours { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.6rem; }
    .pc__etape { display: flex; gap: 0.6rem; align-items: center; padding: 0.65rem 0.8rem; border-radius: 10px; background: #fff; border: 1px solid var(--n-200); }
    .pc__pastille { flex: none; width: 1.9rem; height: 1.9rem; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 0.85rem; background: var(--n-100); color: var(--n-500); }
    .pc__etape-texte { display: flex; flex-direction: column; min-width: 0; font-size: var(--text-sm); }
    .pc__etape-texte span { color: var(--n-500); font-size: 0.78rem; }
    .pc__etape--fait { background: var(--success-bg); border-color: var(--success-bdr); }
    .pc__etape--fait .pc__pastille { background: var(--success-text); color: #fff; }
    .pc__etape--cours { border-color: var(--p-500); box-shadow: 0 0 0 3px var(--p-100); }
    .pc__etape--cours .pc__pastille { background: var(--bouton-principal); color: #fff; }
    .pc__etape--ko { background: var(--danger-bg); border-color: var(--danger-bdr); }
    .pc__etape--ko .pc__pastille { background: var(--danger-text); color: #fff; }
    .pc__grille { display: grid; grid-template-columns: minmax(0, 1fr) 21rem; gap: 1.1rem; align-items: start; }
    .pc__principal, .pc__cote { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    .pc__cote { position: sticky; top: 1rem; }
    .pc__bloc { padding: 0.95rem 1.1rem; display: flex; flex-direction: column; gap: 0.55rem; }
    .pc__bloc--eval { border-top: 3px solid var(--n-300); }
    .pc__bloc--actif { border-top-color: var(--p-600); }
    .pc__h2 { margin: 0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-600); }
    .pc__decision { margin: 0; }
    .pc__membres { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .pc__membre { display: flex; gap: 0.6rem; align-items: flex-start; }
    .pc__avatar { flex: none; width: 2.1rem; height: 2.1rem; border-radius: 50%; display: grid; place-items: center; background: var(--n-100); color: var(--n-700); font-weight: 700; font-size: 0.78rem; }
    .pc__avatar--president { background: var(--bouton-principal); color: #fff; }
    .pc__membre-texte { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; font-size: var(--text-sm); }
    .pc__badge { align-self: flex-start; }
    .pc__eval { align-self: flex-start; }
    .pc__representant summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; color: var(--p-700); }
    .pc__representant-form { display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.4rem; }
    .pc__representant-form .btn { align-self: flex-start; }
    .pc__cle { padding: 0; }
    .pc__cle-titre { cursor: pointer; display: flex; gap: 0.75rem; align-items: baseline; flex-wrap: wrap; padding: 0.9rem 1.1rem; font-weight: 700; }
    .pc__cle[open] .pc__cle-titre { border-bottom: 1px solid var(--n-200); }
    .pc__cle app-ma-cle { display: block; padding: 0.4rem 1.1rem 1rem; }
    @media (max-width: 1100px) { .pc__grille { grid-template-columns: 1fr; } .pc__cote { position: static; } }
  `,
})
export class ProcedureCao implements OnInit {
  private readonly service = inject(CaoEspaceService);
  private readonly attribution = inject(AttributionService);
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
  /** ⚠️ R9c (14/10) — le dossier de marché soumis qui ferme la séance, l'évaluation et l'AMI (et la désignation du représentant). */
  readonly etapeClose = signal<DossierSoumis | null>(null);

  // ── ⚠️ 19/10 (pilote) — le parcours du membre, tiré de l'état de la séance ──
  readonly etatSeance = signal<EtatSeance | null>(null);
  readonly parcours = computed(() => etapesParcoursCao(this.etatSeance(), !!this.etapeClose()));
  readonly evaluationOuverte = computed(() => this.etatSeance() === 'CLOSE');
  readonly puces = computed<PuceBandeau[]>(() => {
    const p = this.vue()?.procedure;
    if (!p) return [];
    return [
      ...(p.autoriteContractante ? [{ texte: p.autoriteContractante }] : []),
      ...(p.categorie ? [{ texte: this.categories[p.categorie] }] : []),
      ...(p.dateLimite ? [{ texte: 'Date limite des offres :', fort: this.dateHeure(p.dateLimite), accent: true }] : []),
    ];
  });
  /** La clé se lit dépliée tant que la séance n'a pas commencé (cérémonie, vérification de la part). */
  readonly cleDepliee = computed(() => this.etatSeance() === null || this.etatSeance() === 'A_VENIR');

  /** La référence saisie porte souvent déjà « Décision n° … du … » : ne pas le redire. */
  libelleDecision(reference: string, dateDecision: string | null | undefined): string {
    const ref = reference.trim();
    const tete = /^d[ée]cision/i.test(ref) ? ref : `Décision de la PRMP n° ${ref}`;
    const jour = dateDecision ? this.date(dateDecision) : '';
    return jour && !ref.includes(jour) ? `${tete} du ${jour}` : tete;
  }

  initiales(m: { nom: string; prenom?: string | null }): string {
    return (((m.prenom ?? '').trim()[0] ?? '') + (m.nom.trim()[0] ?? '')).toUpperCase() || '?';
  }

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
        this.attribution.dossierSoumis(this.idDmc).subscribe((d) => this.etapeClose.set(d));
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
