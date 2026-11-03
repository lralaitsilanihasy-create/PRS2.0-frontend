import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, catchError, forkJoin, map, of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { dateFr } from '../../../core/interim/interim-libelles';
import { Dossier, Echeance, Marche, MarchePrevision, Ppm, ServiceBeneficiaire } from '../../../models';
import { CapmService, EcheanceService, EntiteContractService, MarchePrevisionService, MarcheService, PpmService, ReferenceLookupService, ServiceBeneficiaireService } from '../../../services';
import { DossierService } from '../../../services/circuit.services';
import { PpmMarchesTable } from '../../../shared/prmp/ppm-marches-table';
import { DocumentVisionneuse } from '../../../shared/ui/document-visionneuse';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { TitrePage } from '../../../shared/ui/titre-page';
import { ChainesDuPlan, dossiersDeLaLigne } from '../../circuit/page-dossier/chaine-ligne';
import { DetailLigne } from './detail-ligne';
import { ETAPES_LIGNE, EtapeLigne, SuiviLigne, suiviDeLigne } from './suivi-ligne';
import { LienDossier } from '../../circuit/page-dossier/lien-dossier';

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
}

/**
 * ⚠️ 03/11 (pilote, maquette « espace PRMP », lot 1) — le PLAN DE PASSATION comme écran de travail de la PRMP et de l'UGPM : le
 * dernier plan signé (ou celui de l'URL), au format du document officiel ; un clic sur une ligne ouvre sa chaîne et l'étape suivante.
 * Une seule vague de lectures pour tous les plans (listes scopées filtrées ici) : changer de plan ne relit rien.
 */
@Component({
  selector: 'app-plan-passation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TitrePage, EtatErreur, DocumentVisionneuse, PpmMarchesTable, DetailLigne],
  providers: [ChainesDuPlan],
  template: `
    <app-titre-page titre="Plan de passation"
      sousTitre="Le plan signé tel qu’il a été contrôlé ; choisissez une ligne pour voir ses dossiers et l’étape suivante." />

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement du plan de passation…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Le plan de passation n’a pas pu être lu." (reessayer)="charger()" />
    } @else if (!plan()) {
      <section class="pp__vide card" aria-labelledby="pp-vide-t">
        <h2 id="pp-vide-t" class="pp__vide-t">Aucun plan signé</h2>
        <p>Un plan paraît ici une fois contrôlé et clôturé par la Commission. Saisissez-le, puis soumettez-le.</p>
        @if (estPrmp()) {
          <a class="btn btn-primary btn-sm" routerLink="/prmp/soumettre-dossier" [queryParams]="{ famille: 'DDP' }">Saisir un plan de passation</a>
        }
      </section>
    } @else {
      @let p = plan()!;
      <section class="pp__entete" aria-labelledby="pp-ref">
        <div class="pp__ident">
          <h2 class="pp__ref" id="pp-ref">{{ titrePlan() }}</h2>
          <p class="pp__meta">{{ metaPlan() }}</p>
        </div>
        @if (plans().length > 1) {
          <div class="pp__plans" role="group" aria-label="Plan affiché">
            @for (x of plans(); track x.idDossier) {
              <a class="btn btn-sm" [class.btn-primary]="x.idDossier === p.idDossier" [class.btn-outline]="x.idDossier !== p.idDossier"
                [routerLink]="['/prmp/plan', x.idDossier]" [attr.aria-current]="x.idDossier === p.idDossier ? 'page' : null">
                {{ libellePlanCourt(x) }}
              </a>
            }
          </div>
        }
        <div class="pp__gestes">
          @if (estPrmp()) {
            <a class="btn btn-outline btn-sm" routerLink="/prmp/dossiers-verifies" [queryParams]="{ maj: 1 }">Mettre à jour le plan</a>
          }
          <a class="btn btn-outline btn-sm" routerLink="/prmp/calendrier">Calendrier des jalons</a>
          @if (lien.disponible()) {
            <a class="btn btn-outline btn-sm" [routerLink]="lien.commandes(p.idDossier)" [queryParams]="lien.params()">Fiche de présentation et projet d’AGPM</a>
          }
        </div>
      </section>

      <!-- ⚠️ 03/11 (lot 2) — combien de lignes à chaque étape ; un compteur filtre le plan sur son étape. -->
      <div class="pp__etapes" role="group" aria-label="Filtrer les lignes par étape">
        <button type="button" class="pp__etape" [attr.aria-pressed]="filtre() === null" (click)="filtre.set(null)">
          <span class="pp__n">{{ marchesDuPlan().length }}</span><span class="pp__l">Toutes les lignes</span>
        </button>
        @for (e of compteurs(); track e.cle) {
          <button type="button" class="pp__etape" [attr.aria-pressed]="filtre() === e.cle" [disabled]="!e.n" (click)="filtre.set(filtre() === e.cle ? null : e.cle)">
            <span class="pp__n">{{ e.n }}</span><span class="pp__l">{{ e.libelle }}</span>
          </button>
        }
      </div>
      @if (!source.filiation() && source.chargement()) { <p class="text-muted pp__suivi-attente" role="status">Lecture du suivi des lignes…</p> }

      <app-document-visionneuse [interrupteur]="true">
        <app-ppm-marches-table [suiviFn]="suiviFn" [marches]="lignesAffichees()" [beneficiaires]="benefsDuPlan()" [previsions]="previsionsDuPlan()"
          [messageVide]="filtre() ? 'Aucune ligne du plan à cette étape.' : 'Ce plan ne porte aucune ligne.'">
          <ng-template #detailLigne let-m>
            <app-detail-ligne [marche]="m" [previsions]="previsionsDe(m)" [echeances]="echeancesDe(m)" [capms]="capms()" />
          </ng-template>
        </app-ppm-marches-table>
      </app-document-visionneuse>
    }
  `,
  styles: `
    :host { display: grid; gap: 1rem; }
    .pp__entete { display: grid; gap: 0.6rem; }
    .pp__ident { display: grid; gap: 0.15rem; }
    .pp__ref { margin: 0; font-size: 1.05rem; font-weight: 500; color: var(--texte); }
    .pp__meta { margin: 0; font-size: 0.8125rem; color: var(--texte-secondaire); }
    .pp__plans, .pp__gestes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .pp__etapes { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); border: 1px solid var(--bordure); border-radius: 8px; overflow: hidden; background: var(--carte-fond); }
    .pp__etape { display: grid; gap: 0.1rem; justify-items: start; text-align: left; padding: 0.55rem 0.8rem; border: 0; border-right: 1px solid var(--bordure); background: var(--carte-fond); color: var(--texte); font: inherit; cursor: pointer; }
    .pp__etape:last-child { border-right: 0; }
    .pp__etape:hover:not(:disabled) { background: var(--ligne-survol); }
    .pp__etape[aria-pressed='true'] { background: var(--onglet-actif-fond); box-shadow: inset 0 -3px 0 var(--menu-fond); }
    .pp__etape:disabled { cursor: default; }
    .pp__etape:disabled .pp__n, .pp__etape:disabled .pp__l { color: var(--texte-secondaire); }
    .pp__etape:focus-visible { outline: 3px solid var(--bouton-principal); outline-offset: -3px; }
    .pp__n { font-size: 1.05rem; font-weight: 500; }
    .pp__l { font-size: 0.75rem; color: var(--texte-secondaire); }
    .pp__suivi-attente { margin: 0; font-size: 0.8125rem; }
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
  private readonly lookups = inject(ReferenceLookupService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly lien = inject(LienDossier);
  readonly source = inject(ChainesDuPlan);

  readonly estPrmp = computed(() => this.auth.role() === 'PRMP');
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  private readonly contenu = signal<ContenuPlans | null>(null);
  private readonly entites = signal<Map<string, string>>(new Map());
  /** Processus CAPM : identifiant → libellé (jalons du détail d'une ligne). */
  readonly capms = signal<Map<string, string>>(new Map());
  private readonly idDemande = toSignal(this.route.paramMap.pipe(map((p) => (p.get('idDossier') ? Number(p.get('idDossier')) : null))), { initialValue: null });

  readonly plans = computed(() => this.contenu()?.plans ?? []);
  /** Le plan de l'URL s'il est en vigueur, sinon le plus récent. */
  readonly plan = computed(() => {
    const plans = this.plans();
    const id = this.idDemande();
    return plans.find((p) => p.idDossier === id) ?? plans[0] ?? null;
  });
  private readonly ppmDuPlan = computed(() => {
    const p = this.plan();
    return p ? this.contenu()?.ppms.find((x) => x.idDossier === p.idDossier) ?? null : null;
  });
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
  readonly suiviFn = (m: Marche): SuiviLigne | null => (this.source.filiation() ? this.suivis().get(m.idDetail) ?? null : null);
  readonly filtre = signal<EtapeLigne | null>(null);
  readonly compteurs = computed(() => {
    const n = new Map<EtapeLigne, number>();
    for (const s of this.suivis().values()) n.set(s.etape, (n.get(s.etape) ?? 0) + 1);
    return ETAPES_LIGNE.map((e) => ({ ...e, n: this.source.filiation() ? n.get(e.cle) ?? 0 : 0 }));
  });
  readonly lignesAffichees = computed(() => {
    const f = this.filtre();
    return f ? this.marchesDuPlan().filter((m) => this.suivis().get(m.idDetail)?.etape === f) : this.marchesDuPlan();
  });
  readonly benefsDuPlan = computed(() => (this.contenu()?.benefs ?? []).filter((b) => this.idsLignes().has(b.idDetail)));
  readonly previsionsDuPlan = computed(() => (this.contenu()?.previsions ?? []).filter((x) => this.idsLignes().has(x.idDetail)));

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
    inject(DestroyRef).onDestroy(() => this.abonnement.unsubscribe());
    // Le suivi des lignes se lit dès l'affichage d'un plan (filiation + lignes éligibles), une fois par plan ; le filtre repart à zéro.
    effect(() => {
      const p = this.plan();
      untracked(() => {
        this.filtre.set(null);
        if (p) this.source.charger(p.idDossier);
      });
    });
  }

  ngOnInit(): void {
    this.charger();
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entites.set(m));
    this.lookups.lookup(CapmService, 'idCapm', ['libelleProcessus']).subscribe((m) => this.capms.set(m));
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
    }).subscribe({
      next: (r) => {
        this.contenu.set({ plans: plansEnVigueur(r.dossiers, r.ppms), ppms: r.ppms, marches: r.marches, benefs: r.benefs, previsions: r.previsions, echeances: r.echeances });
        this.chargement.set(false);
        // Un identifiant d'URL qui n'est pas un plan en vigueur : on montre le plus récent, à sa propre adresse.
        const id = this.idDemande();
        if (id != null && !this.plans().some((p) => p.idDossier === id) && this.plans().length) {
          void this.router.navigate(['/prmp/plan'], { replaceUrl: true });
        }
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  previsionsDe(m: Marche): MarchePrevision[] {
    return this.previsionsDuPlan().filter((p) => p.idDetail === m.idDetail);
  }

  echeancesDe(m: Marche): Echeance[] {
    return (this.contenu()?.echeances ?? []).filter((e) => e.idDetail === m.idDetail);
  }

  /** « 00001/PPM-AGPM · 2026 » : le numéro du plan et son exercice. */
  libellePlanCourt(d: Dossier): string {
    const exercice = this.contenu()?.ppms.find((x) => x.idDossier === d.idDossier)?.exercice;
    const ref = (d.refeDossier ?? `Dossier ${d.idDossier}`).split('/CNM/')[0];
    return exercice ? `${ref} · ${exercice}` : ref;
  }
}
