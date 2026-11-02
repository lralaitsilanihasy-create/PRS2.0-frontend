import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { dateFr } from '../../../core/interim/interim-libelles';
import { urlBlobSure } from '../../../core/securite/fichiers-surs';
import { Cao, CoteConformite, DemandeEvaluation, Evaluation, IndicateursPrix, Lecture, OffreEvaluee, PvExamen, Seance, SpecificationOffre } from '../../../models';
import { AttributionService, CaoService, DossierService, EvaluationService, ProceduresEnLigneService, PvExamenService, SeanceService } from '../../../services';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { dateHeureFr } from '../../candidat/libelles-candidat';
import { LIBELLES_ORIGINE } from '../../cao/libelles-cao';
import { LectureSeance } from '../../procedure/lecture-seance';
import { LIBELLES_ANORMALE, LIBELLES_GROUPE_CRITERE, LIBELLES_REGLE, ariary, ecartPourCent } from '../../evaluation/libelles-evaluation';
import { TitulairesProposes } from '../../evaluation/titulaires-proposes';

/**
 * ⚠️ 20/10 (pilote, demande « dossier-marche-donnees », livrée le 20/10 sans migration) — les pièces d'un dossier de MARCHÉ né d'une attribution, lues **en
 * données** par la Commission, comme celles d'un dossier de mise en concurrence produites par sa fiche : la séance d'ouverture, le
 * rapport d'évaluation (et son PV de validation, ses signatures), l'attribution proposée, le PV de la Commission sur le DAO. Lecture
 * seule : aucun geste ; les pièces des offres restent à la CAO (`piecesOuvrables = false`).
 *
 * ⚠️ 27/10 (pilote, « vérifier la cohérence de la grille de contrôle aux éléments du dossier ») — chaque point de la grille du dossier
 * de marché doit se vérifier sur l'onglet qui le porte : la séance dit sa date, ses présents, ses signataires et la validité des
 * offres ; le rapport, la CAO et ses déclarations, le détail de chaque offre (conformité, corrections, critères) et la moralité des
 * prix ; l'attribution, le projet de marché lui-même (document sans données : il s'affiche).
 */

/** Ajoute des jours à une date `AAAA-MM-JJ…` ; nul si illisible. */
export function ajouterJours(iso: string | null | undefined, jours: number | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m || jours == null) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + jours);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** La validité d'une offre : sa durée, la date d'expiration (date limite + durée) et les précisions qui l'ont prorogée. */
export interface ValiditeOffre {
  numero: number | null;
  candidat: string;
  jours: number | null;
  expire: string | null;
  prorogations: { reponduLe: string | null; reponse: string | null }[];
}

/** La séance d'ouverture : ses faits, ses présents et signataires, la lecture des offres, la validité des offres. */
@Component({
  selector: 'app-seance-marche-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LectureSeance],
  host: { '(window:resize)': 'ajuster()' },
  template: `
    @if (vue() === 'onglets') {
      <!-- ⚠️ 31/10 (pilote, maquette « Séance d'ouverture », variante B) — la fenêtre de la page du dossier, sans défilement : le déroulé
           de la séance en frise, puis à gauche les présents, les plis hors délai et la synthèse, à droite une offre par onglet (la
           validité y porte sa date d'expiration). -->
      <section class="pmd pmd--onglets" aria-label="Séance d'ouverture des plis" [style.zoom]="zoom() < 1 ? zoom() : null">
        <h3 class="pmd__cache">Séance d'ouverture des plis</h3>
        @if (seance(); as s) {
          <dl class="pmd-frise">
            <div class="pmd-jalon"><dt>Date limite de remise</dt><dd>{{ dateLimite() ? date(dateLimite()) : '—' }}</dd></div>
            <div class="pmd-jalon"><dt>Séance ouverte</dt><dd>{{ date(s.ouverteLe) || '—' }}</dd></div>
            <div class="pmd-jalon"><dt>Offres déchiffrées</dt><dd>{{ date(s.dechiffreeLe) || '—' }}</dd></div>
            <div class="pmd-jalon"><dt>PV d'ouverture</dt><dd>{{ s.pv?.signe ? 'signé' + (signeLe() ? ' le ' + date(signeLe()) : '') : s.pv?.produit ? 'produit, signatures en cours' : 'non produit' }}</dd></div>
            <div class="pmd-jalon pmd-jalon--etat"><dt>Publication du PV</dt><dd><span class="pmd-pill" [class.pmd-pill--ok]="s.pv?.publie">{{ s.pv?.publie ? 'publié' : 'non publié' }}</span></dd></div>
            <div class="pmd-jalon pmd-jalon--etat"><dt>Quorum</dt><dd>
              @if (s.pv?.quorum; as q) {
                <span class="pmd-pill" [class.pmd-pill--ok]="q.atteint" [class.pmd-pill--ko]="!q.atteint">{{ q.obtenus }} signataire(s) sur {{ q.requis }} — {{ q.atteint ? 'atteint' : 'non atteint' }}</span>
              } @else { {{ s.quorum }} requis }
            </dd></div>
          </dl>
        }
        <app-lecture-seance [idDmc]="idDmc()" [piecesOuvrables]="false" [onglets]="true" [validites]="validites()">
          @if (seance(); as s) {
            <div gauche class="pmd-gauche">
              <div class="pmd-encart">
                <h4 class="pmd-encart__titre">Présents et signataires</h4>
                <ul class="pmd-encart__liste">
                  @for (m of s.membres; track m.im) {
                    @let sig = signature(m.im);
                    <li><strong>{{ m.nom }}</strong><span>&nbsp;— {{ m.president ? 'président · ' : '' }}{{ m.present ? 'présent' : 'absent' }}
                      · {{ sig ? (sig.empechement ? 'empêché' + (sig.motif ? ' (' + sig.motif + ')' : '') : 'a signé le PV le ' + date(sig.date)) : 'n’a pas signé le PV' }}</span></li>
                  }
                  @for (a of s.autres; track $index) { <li><strong>{{ a.nom }}</strong><span>&nbsp;— {{ a.qualite ? a.qualite + ' · ' : '' }}présent</span></li> }
                </ul>
              </div>
              <div class="pmd-encart pmd-encart--ligne">
                <h4 class="pmd-encart__titre">Plis hors délai</h4>
                @if (s.pv?.tentativesRefusees; as tr) {
                  @if (tr.length) {
                    <ul class="pmd-encart__liste">
                      @for (t of tr; track $index) {
                        <li class="pmd__attendue">{{ date(t.horodatage) }} · {{ t.entreprise || 'entreprise non déclarée' }}{{ t.nif ? ' (NIF ' + t.nif + ')' : '' }}{{ t.lot ? ' · lot ' + t.lot : '' }} — {{ geste(t.geste) }} refusé{{ t.motif ? ' : ' + t.motif : '' }}</li>
                      }
                    </ul>
                  } @else {
                    <span class="pmd-pill pmd-pill--ok">aucun</span><span class="pmd__aide">aucune tentative de dépôt refusée après la date limite</span>
                  }
                } @else {
                  <span class="pmd__aide">se lisent une fois la séance ouverte</span>
                }
              </div>
              <p class="pmd__aide">Les pièces des offres restent réservées aux membres de la commission d'appel d'offres. Expiration = date limite de remise + validité déclarée à l’acte d’engagement, avant toute prorogation.</p>
            </div>
          }
        </app-lecture-seance>
      </section>
    } @else {
    <section class="pmd" aria-label="Séance d'ouverture des plis">
      <h3 class="pmd__titre">Séance d'ouverture des plis</h3>
      @if (seance(); as s) {
        <dl class="pmd__faits">
          <div><dt>Date et heure limites de remise</dt><dd>{{ dateLimite() ? date(dateLimite()) : '—' }}</dd></div>
          <div><dt>Séance ouverte le</dt><dd>{{ date(s.ouverteLe) || '—' }}</dd></div>
          <div><dt>Offres déchiffrées le</dt><dd>{{ date(s.dechiffreeLe) || '—' }}</dd></div>
          <div><dt>PV d'ouverture</dt><dd>{{ s.pv?.signe ? 'signé' + (signeLe() ? ' le ' + date(signeLe()) : '') : s.pv?.produit ? 'produit, signatures en cours' : 'non produit' }}</dd></div>
          <div><dt>Publication du PV</dt><dd>{{ s.pv?.publie ? 'publié' : 'non publié' }}</dd></div>
          <div><dt>Quorum</dt><dd>{{ s.pv?.quorum ? s.pv!.quorum!.obtenus + ' signataire(s) sur ' + s.pv!.quorum!.requis + ' requis — ' + (s.pv!.quorum!.atteint ? 'atteint' : 'non atteint') : s.quorum + ' requis' }}</dd></div>
        </dl>
        <h4 class="pmd__sous-titre">Présents et signataires</h4>
        <ul class="pmd__signatures">
          @for (m of s.membres; track m.im) {
            @let sig = signature(m.im);
            <li><strong>{{ m.nom }}</strong>{{ m.president ? ' — président' : '' }} · {{ m.present ? 'présent' : 'absent' }}
              · {{ sig ? (sig.empechement ? 'empêché' + (sig.motif ? ' (' + sig.motif + ')' : '') : 'a signé le PV le ' + date(sig.date)) : 'n’a pas signé le PV' }}</li>
          }
          @for (a of s.autres; track $index) { <li>{{ a.nom }}{{ a.qualite ? ' — ' + a.qualite : '' }} · présent</li> }
        </ul>
        <h4 class="pmd__sous-titre">Plis hors délai</h4>
        @if (s.pv?.tentativesRefusees; as tr) {
          @if (tr.length) {
            <ul class="pmd__signatures">
              @for (t of tr; track $index) {
                <li class="pmd__attendue">{{ date(t.horodatage) }} · {{ t.entreprise || 'entreprise non déclarée' }}{{ t.nif ? ' (NIF ' + t.nif + ')' : '' }}{{ t.lot ? ' · lot ' + t.lot : '' }} — {{ geste(t.geste) }} refusé{{ t.motif ? ' : ' + t.motif : '' }}</li>
              }
            </ul>
            <p class="pmd__aide">Ces tentatives ont été refusées par la plateforme après la date limite : aucun pli n’a été reçu ni ouvert.</p>
          } @else {
            <p class="pmd__ligne">Aucune tentative de dépôt refusée après la date limite.</p>
          }
        } @else {
          <p class="pmd__aide">Les tentatives refusées se lisent une fois la séance ouverte.</p>
        }
      }
      <h4 class="pmd__sous-titre">Lecture des offres</h4>
      <p class="pmd__aide">Ce que la séance a lu, offre par offre. Les pièces des offres restent réservées aux membres de la commission d'appel d'offres.</p>
      <app-lecture-seance [idDmc]="idDmc()" [piecesOuvrables]="false" />
      @if (validites().length) {
        <h4 class="pmd__sous-titre">Validité des offres</h4>
        <div class="cnm-table-wrap">
          <table class="cnm-table pmd__table" aria-label="Validité des offres">
            <thead><tr><th scope="col">Offre</th><th scope="col">Candidat</th><th scope="col" class="pmd__num">Validité</th><th scope="col">Expire le</th><th scope="col">Prorogation</th></tr></thead>
            <tbody>
              @for (v of validites(); track v.numero) {
                <tr>
                  <td>n° {{ v.numero ?? '—' }}</td><td>{{ v.candidat }}</td>
                  <td class="pmd__num">{{ v.jours != null ? v.jours + ' jours' : '—' }}</td>
                  <td>{{ v.expire ?? '—' }}</td>
                  <td>
                    @for (p of v.prorogations; track $index) { <span class="pmd__note">précision répondue le {{ date(p.reponduLe) }} : « {{ p.reponse }} »</span> }
                    @empty { — }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="pmd__aide">Expiration = date limite de remise + validité déclarée à l’acte d’engagement, avant toute prorogation.</p>
      }
    </section>
    }
  `,
  styleUrl: './procedure-marche-docs.scss',
})
export class SeanceMarcheDoc implements OnInit {
  readonly idDmc = input.required<number>();
  /** ⚠️ 31/10 (pilote, variante B) — `onglets` : la fenêtre de la page du dossier (frise, synthèse, une offre par onglet). */
  readonly vue = input<'document' | 'onglets'>('document');
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Réduction légère quand la séance dépasse un peu la fenêtre (80 % au plus). */
  readonly zoom = signal(1);
  private readonly suiviZoom = effect(() => {
    if (this.vue() !== 'onglets') return;
    this.seance();
    this.validites();
    setTimeout(() => this.ajuster(), 300);
    setTimeout(() => this.ajuster(), 900);
  });

  /** Mesure la séance à sa taille naturelle et la réduit juste assez pour tenir dans le corps de la fenêtre. */
  ajuster(): void {
    if (this.vue() !== 'onglets') return;
    const corps = this.hote.nativeElement.closest('.modal-body');
    const section = this.hote.nativeElement.querySelector<HTMLElement>('.pmd--onglets');
    if (!corps || !section) return;
    section.style.zoom = '';
    const tient = (): boolean => corps.scrollHeight <= corps.clientHeight + 1;
    let z = 1;
    if (!tient()) {
      const surplus = corps.scrollHeight - corps.clientHeight;
      z = Math.max(0.8, Math.floor(((section.offsetHeight - surplus) / section.offsetHeight) * 100) / 100);
      section.style.zoom = String(z);
      while (z < 1 && tient()) {
        const essai = Math.round((z + 0.01) * 100) / 100;
        section.style.zoom = String(essai);
        if (!tient()) break;
        z = essai;
      }
    }
    this.zoom.set(z);
    section.style.zoom = z < 1 ? String(z) : '';
  }
  private readonly seances = inject(SeanceService);
  private readonly procedures = inject(ProceduresEnLigneService);
  private readonly evaluations = inject(EvaluationService);
  readonly seance = signal<Seance | null>(null);
  readonly dateLimite = signal<string | null>(null);
  readonly validites = signal<ValiditeOffre[]>([]);
  readonly signeLe = computed(() => {
    const pv = this.seance()?.pv;
    if (!pv) return null;
    return pv.signeLe ?? [...(pv.signatures ?? [])].map((x) => x.date).sort().at(-1) ?? null;
  });
  readonly date = dateHeureFr;
  geste(g: string): string { return g === 'CREATION' ? 'dépôt' : g === 'MORCEAU' ? 'envoi d’un morceau' : g === 'SCELLEMENT' ? 'scellement' : g; }
  signature(im: string) { return this.seance()?.pv?.signatures?.find((x) => x.im === im) ?? null; }

  ngOnInit(): void {
    const id = this.idDmc();
    // Tout est facultatif : un échec retire la section, jamais l'onglet.
    forkJoin({
      seance: this.seances.lire(id).pipe(catchError(() => of(null))),
      procedure: this.procedures.detail(id).pipe(catchError(() => of(null))),
      lecture: this.seances.lecture(id).pipe(catchError(() => of(null as Lecture | null))),
      evaluation: this.evaluations.lire(id).pipe(catchError(() => of(null as Evaluation | null))),
    }).subscribe(({ seance, procedure, lecture, evaluation }) => {
      this.seance.set(seance);
      const limite = procedure?.dateLimite ?? null;
      this.dateLimite.set(limite);
      const offres = lecture?.offres ?? [];
      const idsEvalues = new Map((evaluation?.lots ?? []).flatMap((l) => l.offres).map((o) => [o.numero, o.idOffre] as const));
      // Les précisions de chaque offre évaluée (prorogation de validité, art. 35-VI).
      const demandes = offres.map((o) => {
        const idOffre = idsEvalues.get(o.numero) ?? null;
        return idOffre ? this.evaluations.precisions(id, idOffre).pipe(catchError(() => of([] as DemandeEvaluation[]))) : of([] as DemandeEvaluation[]);
      });
      (demandes.length ? forkJoin(demandes) : of([] as DemandeEvaluation[][])).pipe(
        map((parOffre) => offres.map((o, i): ValiditeOffre => ({
          numero: o.numero,
          candidat: o.entreprise.raisonSociale,
          jours: o.acteEngagement?.validiteJours ?? null,
          expire: ajouterJours(limite, o.acteEngagement?.validiteJours),
          prorogations: (parOffre[i] ?? []).filter((d) => d.etat === 'REPONDUE' && /validit|prorog/i.test(d.question)).map((d) => ({ reponduLe: d.reponduLe, reponse: d.reponse })),
        }))),
      ).subscribe((v) => this.validites.set(v));
    });
  }
}

/** Les décisions d'une offre à chaque étape, en clair. */
export function syntheseOffre(o: OffreEvaluee): { conformite: string; anormale: string; qualification: string } {
  const c = o.conformite?.decision;
  const a = o.anormale?.decision;
  const q = o.qualification?.decision;
  return {
    conformite: c === 'CONFORME' ? 'Conforme' : c === 'ECARTEE' ? 'Écartée' : '—',
    anormale: a ? LIBELLES_ANORMALE[a] : '—',
    qualification: q === 'QUALIFIE' ? 'Qualifiée' : q === 'NON_QUALIFIE' ? 'Non qualifiée' : '—',
  };
}

const LIBELLES_COTE: Readonly<Record<CoteConformite, string>> = { C: 'Conforme', SC: 'Substantiellement conforme', NC: 'Non conforme', SO: 'Sans objet' };

/** Le projet de marché du lot : un document produit par l'application, sans données propres — il s'affiche dans l'onglet. */
@Component({
  selector: 'app-projet-marche-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 class="pmd__titre">Projet de marché — lot {{ lot() }}</h3>
    @if (url(); as u) {
      <iframe class="pmd__cadre" [src]="u" [title]="'Projet de marché, lot ' + lot()"></iframe>
    } @else if (absent()) {
      <p class="pmd__aide">Le projet de marché n’est pas encore produit.</p>
    } @else {
      <p class="pmd__aide" role="status">Chargement du projet de marché…</p>
    }
  `,
  styleUrl: './procedure-marche-docs.scss',
})
export class ProjetMarcheDoc implements OnInit {
  readonly idDmc = input.required<number>();
  readonly lot = input<number>(1);
  private readonly attributions = inject(AttributionService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroy = inject(DestroyRef);
  readonly url = signal<SafeResourceUrl | null>(null);
  readonly absent = signal(false);

  ngOnInit(): void {
    this.attributions.projet(this.idDmc(), this.lot()).subscribe({
      next: (b) => {
        const u = urlBlobSure(b);
        this.destroy.onDestroy(() => URL.revokeObjectURL(u));
        this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(u));
      },
      error: () => this.absent.set(true),
    });
  }
}

/** Le rapport d'évaluation : la CAO, les offres et leurs décisions détaillées, la moralité des prix, le rapport signé (PV de validation). */
@Component({
  selector: 'app-evaluation-marche-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, TitulairesProposes, ProjetMarcheDoc],
  host: { '(window:resize)': 'ajuster()' },
  template: `
    @if (chargement()) {
      <p class="text-muted" role="status">Chargement de l'évaluation…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="L'évaluation n'a pas pu être lue." (reessayer)="charger()" />
    } @else if (lotEval(); as l) {
      @if (parties() && vue() === 'rapport') {
        <!-- ⚠️ 01/11 (pilote, maquette « Rapport d'évaluation », variante B) — la fenêtre de la page du dossier, sans défilement : le
             rapport se lit partie par partie, un onglet chacune (synthèse, une offre par onglet, commission et signatures). -->
        <section class="pmd pmd--onglets" aria-label="Rapport d’évaluation" [style.zoom]="zoom() < 1 ? zoom() : null">
          <h3 class="pmd__cache">Rapport d'évaluation — lot {{ l.lot }}</h3>
          <div class="pme-onglets" role="tablist" aria-label="Parties du rapport">
            <button type="button" class="pme-onglet pme-onglet--synthese" role="tab" [attr.aria-selected]="partie() === 'synthese'" (click)="partie.set('synthese')">Synthèse et classement</button>
            @for (o of offresTriees(); track o.idOffre) {
              <button type="button" class="pme-onglet pme-onglet--offre" [class.pme-onglet--ecartee]="!!o.ecartee" role="tab" [attr.aria-selected]="partie() === o.idOffre" (click)="partie.set(o.idOffre)">Offre n° {{ o.numero ?? '—' }}</button>
            }
            @if (offresQualifiees().length) {
              <button type="button" class="pme-onglet pme-onglet--qualif" role="tab" [attr.aria-selected]="partie() === 'qualification'" (click)="partie.set('qualification')">Post-qualification</button>
            }
            @if (cao() || ev()?.declarations?.length || ev()?.rapport) {
              <button type="button" class="pme-onglet pme-onglet--commission" role="tab" [attr.aria-selected]="partie() === 'commission'" (click)="partie.set('commission')">Commission et signatures</button>
            }
          </div>
          @if (partie() === 'synthese' || partie() === 'commission') {
            <dl class="pmd-frise pmd-frise--cinq">
              <div class="pmd-jalon"><dt>Commission désignée</dt><dd>{{ cao()?.decision?.reference || '—' }}</dd></div>
              <div class="pmd-jalon pmd-jalon--etat"><dt>Conflits d'intérêts</dt><dd>
                @if (ev()?.declarations?.length) {
                  <span class="pmd-pill" [class.pmd-pill--ok]="!declarationsEnDefaut()" [class.pmd-pill--ko]="declarationsEnDefaut()">{{ declarationsSignees() }} déclaration(s) sur {{ ev()!.declarations.length }}{{ declarationsEnDefaut() ? '' : ' — absence' }}</span>
                } @else { — }
              </dd></div>
              <div class="pmd-jalon"><dt>Rapport produit</dt><dd>{{ ev()?.rapport ? date(ev()!.rapport!.produitLe) : 'non produit' }}</dd></div>
              <div class="pmd-jalon"><dt>Rapport validé</dt><dd>{{ ev()?.rapport?.signe ? date(ev()!.rapport!.signeLe) : ev()?.rapport ? 'signatures en cours' : '—' }}</dd></div>
              <div class="pmd-jalon pmd-jalon--etat"><dt>Quorum</dt><dd>
                @if (ev()?.rapport?.quorum; as q) {
                  <span class="pmd-pill" [class.pmd-pill--ok]="q.atteint" [class.pmd-pill--ko]="!q.atteint">{{ q.atteint ? 'atteint' : 'non atteint' }}</span>
                } @else { — }
              </dd></div>
            </dl>
          }
          @if (partie() === 'synthese') {
            <table class="cnm-table pmd__table pme-table" aria-label="Classement des offres et moralité des prix">
              <thead><tr><th scope="col">Rang</th><th scope="col">Offre</th><th scope="col">Soumissionnaire</th><th scope="col">Examen préliminaire</th><th scope="col" class="pmd__num">Montant évalué HT</th><th scope="col" class="pmd__num">Écart à l’estimation</th><th scope="col" class="pmd__num">Écart à la moyenne</th><th scope="col">Offre anormale</th><th scope="col">Post-qualification</th></tr></thead>
              <tbody>
                @for (o of offresTriees(); track o.idOffre) {
                  @let s = synthese(o);
                  @let ix = indicateurDe(o.idOffre);
                  <tr [class.pmd__ecartee]="!!o.ecartee" [class.pme-premier]="o.rang === 1">
                    <td>{{ o.rang ?? '—' }}</td>
                    <td><button type="button" class="pme-lien" (click)="partie.set(o.idOffre)">n° {{ o.numero ?? '—' }}</button></td>
                    <td>{{ o.entreprise.raisonSociale }}</td>
                    <td>{{ s.conformite }}{{ o.ecartee?.motif ? ' — ' + o.ecartee!.motif : '' }}</td>
                    <td class="pmd__num pme-fort">{{ ariary(o.evaluation?.montantEvalue) }}</td>
                    <td class="pmd__num">{{ ecart(ix?.ecartEstimation) }}</td><td class="pmd__num">{{ ecart(ix?.ecartMoyenne) }}</td>
                    <td>{{ s.anormale }}{{ ix?.alertes?.length ? ' — ' + ix!.alertes.join(' ; ') : '' }}</td><td>{{ s.qualification }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <div class="pme-deux">
              @if (indicateurs(); as ip) {
                <div class="pmd-encart">
                  <h4 class="pmd-encart__titre">Moralité des prix</h4>
                  <p class="pmd__ligne">Estimation de la fiche <strong class="pme-fort">{{ ariary(ip.estimation) }}</strong> HT · moyenne des offres <strong class="pme-fort">{{ ariary(ip.moyenne) }}</strong> HT</p>
                  @if (ip.methodeDao) { <p class="pmd__aide">Méthode du DAO : {{ ip.methodeDao }}</p> }
                </div>
              }
              @if (ev()?.rapport?.observations) {
                <div class="pmd-encart">
                  <h4 class="pmd-encart__titre">Observations du rapport</h4>
                  <p class="pmd__ligne">« {{ ev()!.rapport!.observations }} »</p>
                </div>
              }
            </div>
          } @else if (partie() === 'commission') {
            <div class="pme-deux">
              @if (cao(); as c) {
                <div class="pmd-encart">
                  <h4 class="pmd-encart__titre">Commission d'appel d'offres</h4>
                  <p class="pmd__ligne"><strong>Décision de désignation :</strong> {{ c.decision.reference || '—' }}{{ c.decision.date && !(c.decision.reference ?? '').includes(jour(c.decision.date)) ? ' du ' + jour(c.decision.date) : '' }}{{ c.decision.fichier ? '' : ' (décision signée non jointe)' }}</p>
                  <ul class="pmd-encart__liste">
                    @for (m of c.membres; track m.id) { <li><strong>{{ m.nom }} {{ m.prenom }}</strong><span>&nbsp;— {{ m.president ? 'président · ' : '' }}{{ origine(m.origine) }}{{ m.fonction ? ' · ' + m.fonction : '' }}</span></li> }
                  </ul>
                </div>
              }
              @if (ev()?.declarations?.length) {
                <div class="pmd-encart">
                  <h4 class="pmd-encart__titre">Déclarations d'absence de conflit d'intérêts</h4>
                  <ul class="pmd-encart__liste">
                    @for (d of ev()!.declarations; track d.membre) {
                      <li [class.pmd__attendue]="!d.signeeLe || d.conflit"><strong>{{ d.nom }}</strong><span>&nbsp;— {{ d.president ? 'président · ' : '' }}{{ !d.signeeLe ? 'déclaration non signée' : d.conflit ? 'conflit déclaré' + (d.precision ? ' — ' + d.precision : '') : 'absence de conflit, signée le ' + date(d.signeeLe) }}</span></li>
                    }
                  </ul>
                </div>
              }
            </div>
            @if (ev()?.rapport; as r) {
              <div class="pmd-encart">
                <h4 class="pmd-encart__titre">PV de validation — le rapport signé</h4>
                <p class="pmd__ligne">Rapport produit le {{ date(r.produitLe) }}{{ r.signe ? ', validé le ' + date(r.signeLe) + ' (dernière signature)' : ', signatures en cours' }}.</p>
                @if (r.observations) { <p class="pmd__aide">« {{ r.observations }} »</p> }
                <ul class="pmd-encart__liste">
                  @for (g of r.signatures; track $index) { <li><strong>{{ g.nom }}</strong><span>&nbsp;— {{ g.president ? 'président · ' : '' }}signé le {{ date(g.date) }}{{ g.observation ? ' — ' + g.observation : '' }}</span></li> }
                  @for (g of r.signaturesAttendues; track $index) { <li class="pmd__attendue">{{ g.nom }} — signature attendue</li> }
                </ul>
              </div>
            }
          } @else if (offreChoisie(); as o) {
            <p class="pmd__ligne pme-titre"><strong>Offre n° {{ o.numero ?? '—' }} · {{ o.entreprise.raisonSociale }}</strong>
              <span>&nbsp;NIF {{ o.entreprise.nif }} · rang {{ o.rang ?? '—' }}{{ o.evaluation ? ' · ' + ariary(o.evaluation.montantEvalue) + ' HT' : '' }}{{ o.ecartee ? ' · écartée' + (o.ecartee.motif ? ' : ' + o.ecartee.motif : '') : '' }}</span></p>
            <div class="pme-offre">
              <div class="pme-col">
                @if (o.conformite?.verifications?.length) {
                  <table class="cnm-table pmd__table pme-table" [attr.aria-label]="'Examen préliminaire de l’offre n° ' + o.numero">
                    <thead><tr><th scope="col" colspan="3">Examen préliminaire{{ o.conformite?.clause ? ' · clause ' + o.conformite!.clause : '' }}</th></tr></thead>
                    <tbody>
                      @for (v of o.conformite!.verifications; track v.code) {
                        @let c = v.cote ?? v.coteProposee;
                        <tr><td><span class="pmd-pill" [class.pmd-pill--ok]="c === 'C' || c === 'SC'" [class.pmd-pill--ko]="c === 'NC'" [class.pmd-pill--att]="!c">{{ cote(c) }}</span></td>
                          <td>{{ v.libelle }}</td><td class="pme-constat">{{ v.observation || v.constat || '—' }}</td></tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <p class="pmd__aide">Examen préliminaire non renseigné.</p>
                }
              </div>
              <div class="pme-col">
                @if (o.evaluation; as e) {
                  <div class="pmd-encart">
                    <p class="pmd__ligne"><span class="pmd-encart__titre">Montant</span> · prix lu <strong class="pme-fort">{{ ariary(e.prixLu) }}</strong> HT · corrigé <strong class="pme-fort">{{ ariary(e.prixCorrige) }}</strong> · évalué <strong class="pme-fort">{{ ariary(e.montantEvalue) }}</strong></p>
                    @if (e.corrections.length) {
                      <ul class="pmd-encart__liste">
                        @for (k of e.corrections; track $index) { <li>{{ k.libelle }} : {{ ariary(k.avant) }} → {{ ariary(k.apres) }} ({{ regle(k.regle) }}){{ k.motif ? ' — ' + k.motif : '' }}</li> }
                      </ul>
                    }
                    <p class="pmd__aide">{{ e.corrections.length ? '' : 'Aucune correction arithmétique · ' }}rabais : {{ e.rabais?.montant ? ariary(e.rabais!.montant) : 'aucun' }} · marge de préférence : {{ e.preference?.eligible ? 'appliquée' + (e.preference?.taux ? ' (' + e.preference!.taux + ' %)' : '') : 'non' }}{{ e.criteres.length ? ' · critères monétisés : ' + e.criteres.length : '' }}</p>
                  </div>
                }
                @if (specs()[o.idOffre]; as sp) {
                  @if (sp.length) {
                    <table class="cnm-table pmd__table pme-table" [attr.aria-label]="'Spécifications de l’offre n° ' + o.numero">
                      <thead><tr><th scope="col">Spécification</th><th scope="col">Exigé</th><th scope="col">Proposé</th><th scope="col">Cote</th></tr></thead>
                      <tbody>
                        @for (x of sp; track x.idArticle + '-' + x.idCaracteristique) {
                          <tr [class.pmd__ko]="(x.cote ?? x.coteProposee) === 'NC'">
                            <td>{{ x.article }}{{ x.marque ? ' · ' + x.marque : '' }}{{ x.modele ? ' ' + x.modele : '' }} · {{ x.caracteristique }}</td><td>{{ x.exigee || '—' }}</td>
                            <td>{{ x.proposee || '—' }}{{ x.declareeConforme === false ? ' (déclarée non conforme)' : '' }}</td>
                            <td>{{ cote(x.cote ?? x.coteProposee) }}{{ x.observation ? ' — ' + x.observation : '' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  } @else {
                    <p class="pmd__aide">Offre déposée par pièces : pas de tableau de spécifications (la conformité se lit dans l’examen préliminaire).</p>
                  }
                }
                <div class="pmd-encart pmd-encart--ligne">
                  <span class="pmd-encart__titre">Post-qualification</span>
                  @if (o.qualification?.criteres?.length) {
                    @let q = synthese(o).qualification;
                    <span class="pmd-pill" [class.pmd-pill--ok]="q === 'Qualifiée'" [class.pmd-pill--ko]="q === 'Non qualifiée'">{{ q === '—' ? 'en cours' : q }}</span>
                    <button type="button" class="pme-lien" (click)="partie.set('qualification')">le détail des critères</button>
                  } @else {
                    <span class="pmd__aide">{{ o.rang === 1 ? 'non encore conduite.' : 'elle ne porte que sur l’offre classée première ; cette offre n’a pas été examinée à ce stade.' }}</span>
                  }
                </div>
              </div>
            </div>
          } @else if (partie() === 'qualification') {
            @for (o of offresQualifiees(); track o.idOffre) {
              @let commun = motifCommun(o.qualification!.criteres);
              <p class="pmd__ligne pme-titre"><strong>Offre n° {{ o.numero ?? '—' }} · {{ o.entreprise.raisonSociale }}</strong><span>&nbsp;— {{ synthese(o).qualification === '—' ? 'post-qualification en cours' : synthese(o).qualification }}</span></p>
              <table class="cnm-table pmd__table pme-table" [attr.aria-label]="'Post-qualification de l’offre n° ' + o.numero">
                <colgroup><col class="pme-c30" /><col class="pme-c42" /><col /></colgroup>
                <thead><tr><th scope="col">Critère</th><th scope="col">Exigence du DAO</th><th scope="col">Décision</th></tr></thead>
                <tbody>
                  @for (k of o.qualification!.criteres; track k.code; let i = $index) {
                    @if (i === 0 || o.qualification!.criteres[i - 1].groupe !== k.groupe) {
                      <tr class="pme-groupe"><th scope="rowgroup" colspan="3">{{ groupe(k.groupe) }}</th></tr>
                    }
                    <tr><td><strong>{{ k.libelle }}</strong></td><td>{{ exigenceLisible(k.exigence) }}</td>
                      <td><span class="pmd-pill" [class.pmd-pill--ok]="k.decision === 'SATISFAIT'" [class.pmd-pill--ko]="k.decision === 'NON_SATISFAIT'">{{ k.decision === 'SATISFAIT' ? 'Satisfait' : k.decision === 'NON_SATISFAIT' ? 'Non satisfait' : 'à décider' }}</span>
                        @if (motifCourt(k); as m) { @if (m !== commun) { <span class="pme-constat">&nbsp;{{ m }}</span> } }</td></tr>
                  }
                </tbody>
              </table>
              @if (commun) { <p class="pmd__aide">Motif, sauf mention dans la ligne : {{ commun }}</p> }
            }
          }
        </section>
      } @else {
      <section class="pmd" [attr.aria-label]="vue() === 'attribution' ? 'Attribution proposée' : 'Rapport d’évaluation'">
        @if (vue() === 'rapport') {
          @if (cao(); as c) {
            <h3 class="pmd__titre">Commission d'appel d'offres</h3>
            <p class="pmd__ligne"><strong>Décision de désignation :</strong> {{ c.decision.reference || '—' }}{{ c.decision.date && !(c.decision.reference ?? '').includes(jour(c.decision.date)) ? ' du ' + jour(c.decision.date) : '' }}{{ c.decision.fichier ? '' : ' (décision signée non jointe)' }}</p>
            <ul class="pmd__signatures">
              @for (m of c.membres; track m.id) { <li><strong>{{ m.nom }} {{ m.prenom }}</strong>{{ m.president ? ' — président' : '' }} · {{ origine(m.origine) }}{{ m.fonction ? ' · ' + m.fonction : '' }}</li> }
            </ul>
          }
          @if (ev()?.declarations?.length) {
            <h4 class="pmd__sous-titre">Déclarations d'absence de conflit d'intérêts</h4>
            <ul class="pmd__signatures">
              @for (d of ev()!.declarations; track d.membre) {
                <li [class.pmd__attendue]="!d.signeeLe || d.conflit"><strong>{{ d.nom }}</strong>{{ d.president ? ' — président' : '' }} ·
                  {{ !d.signeeLe ? 'déclaration non signée' : d.conflit ? 'conflit déclaré' + (d.precision ? ' — ' + d.precision : '') : 'absence de conflit, signée le ' + date(d.signeeLe) }}</li>
              }
            </ul>
          }
          <h3 class="pmd__titre">Rapport d'évaluation — lot {{ l.lot }}</h3>
          <div class="cnm-table-wrap">
            <table class="cnm-table pmd__table" aria-label="Les offres et leurs décisions">
              <thead><tr><th scope="col">Rang</th><th scope="col">Offre</th><th scope="col">Soumissionnaire</th><th scope="col">Examen préliminaire</th><th scope="col" class="pmd__num">Montant évalué HT</th><th scope="col">Offre anormale</th><th scope="col">Post-qualification</th></tr></thead>
              <tbody>
                @for (o of offresTriees(); track o.idOffre) {
                  @let s = synthese(o);
                  <tr [class.pmd__ecartee]="!!o.ecartee">
                    <td>{{ o.rang ?? '—' }}</td><td>n° {{ o.numero ?? '—' }}</td><td>{{ o.entreprise.raisonSociale }}</td>
                    <td>{{ s.conformite }}{{ o.ecartee?.motif ? ' — ' + o.ecartee!.motif : '' }}</td><td class="pmd__num">{{ ariary(o.evaluation?.montantEvalue) }}</td><td>{{ s.anormale }}</td><td>{{ s.qualification }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <h4 class="pmd__sous-titre">Détail par offre</h4>
          @for (o of offresTriees(); track o.idOffre) {
            <details class="pmd__detail">
              <summary>Offre n° {{ o.numero ?? '—' }} · {{ o.entreprise.raisonSociale }} (NIF {{ o.entreprise.nif }})</summary>
              @if (o.conformite?.verifications?.length) {
                <p class="pmd__etiquette">Examen préliminaire{{ o.conformite?.clause ? ' · clause ' + o.conformite!.clause : '' }}</p>
                <table class="cnm-table pmd__table" [attr.aria-label]="'Conformité de l’offre n° ' + o.numero">
                  <thead><tr><th scope="col">Vérification</th><th scope="col">Cote</th><th scope="col">Constat ou observation</th></tr></thead>
                  <tbody>
                    @for (v of o.conformite!.verifications; track v.code) {
                      <tr><td>{{ v.libelle }}</td><td>{{ cote(v.cote ?? v.coteProposee) }}</td><td>{{ v.observation || v.constat || '—' }}</td></tr>
                    }
                  </tbody>
                </table>
              }
              @if (specs()[o.idOffre]; as sp) {
                <p class="pmd__etiquette">Spécifications techniques</p>
                @if (sp.length) {
                  <table class="cnm-table pmd__table" [attr.aria-label]="'Spécifications de l’offre n° ' + o.numero">
                    <thead><tr><th scope="col">Article</th><th scope="col">Caractéristique</th><th scope="col">Exigé</th><th scope="col">Proposé</th><th scope="col">Cote</th><th scope="col">Observation</th></tr></thead>
                    <tbody>
                      @for (x of sp; track x.idArticle + '-' + x.idCaracteristique) {
                        <tr [class.pmd__ko]="(x.cote ?? x.coteProposee) === 'NC'">
                          <td>{{ x.article }}{{ x.marque ? ' · ' + x.marque : '' }}{{ x.modele ? ' ' + x.modele : '' }}</td>
                          <td>{{ x.caracteristique }}</td><td>{{ x.exigee || '—' }}</td><td>{{ x.proposee || '—' }}{{ x.declareeConforme === false ? ' (déclarée non conforme)' : '' }}</td>
                          <td>{{ cote(x.cote ?? x.coteProposee) }}</td><td>{{ x.observation || '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <p class="pmd__aide">Offre déposée par pièces : pas de tableau de spécifications (la conformité se lit dans l’examen préliminaire).</p>
                }
              }
              @if (o.evaluation; as e) {
                <p class="pmd__etiquette">Montant</p>
                <p class="pmd__ligne">Prix lu {{ ariary(e.prixLu) }} HT · prix corrigé {{ ariary(e.prixCorrige) }} · montant évalué {{ ariary(e.montantEvalue) }}</p>
                @if (e.corrections.length) {
                  <ul class="pmd__signatures">
                    @for (k of e.corrections; track $index) { <li>{{ k.libelle }} : {{ ariary(k.avant) }} → {{ ariary(k.apres) }} ({{ regle(k.regle) }}){{ k.motif ? ' — ' + k.motif : '' }}</li> }
                  </ul>
                } @else { <p class="pmd__aide">Aucune correction arithmétique.</p> }
                <p class="pmd__aide">Rabais : {{ e.rabais?.montant ? ariary(e.rabais!.montant) : 'aucun' }} · marge de préférence : {{ e.preference?.eligible ? 'appliquée' + (e.preference?.taux ? ' (' + e.preference!.taux + ' %)' : '') : 'non' }}{{ e.criteres.length ? ' · critères monétisés : ' + e.criteres.length : '' }}</p>
              }
              @if (o.qualification?.criteres?.length) {
                <p class="pmd__etiquette">Post-qualification</p>
                <table class="cnm-table pmd__table" [attr.aria-label]="'Qualification de l’offre n° ' + o.numero">
                  <thead><tr><th scope="col">Critère</th><th scope="col">Exigence du DAO</th><th scope="col">Décision</th><th scope="col">Motif</th></tr></thead>
                  <tbody>
                    @for (k of o.qualification!.criteres; track k.code) {
                      <tr><td>{{ groupe(k.groupe) }} · {{ k.libelle }}</td><td>{{ k.exigence || '—' }}</td><td>{{ k.decision === 'SATISFAIT' ? 'Satisfait' : k.decision === 'NON_SATISFAIT' ? 'Non satisfait' : '—' }}</td><td>{{ k.motif || k.constat || '—' }}</td></tr>
                    }
                  </tbody>
                </table>
              }
            </details>
          }
          @if (indicateurs(); as ip) {
            <h4 class="pmd__sous-titre">Moralité des prix</h4>
            <p class="pmd__ligne">Estimation de la fiche : {{ ariary(ip.estimation) }} HT · moyenne des offres : {{ ariary(ip.moyenne) }} HT{{ ip.methodeDao ? ' · méthode du DAO : ' + ip.methodeDao : '' }}</p>
            <div class="cnm-table-wrap">
              <table class="cnm-table pmd__table" aria-label="Indicateurs de prix">
                <thead><tr><th scope="col">Offre</th><th scope="col" class="pmd__num">Montant HT</th><th scope="col" class="pmd__num">Écart à l’estimation</th><th scope="col" class="pmd__num">Écart à la moyenne</th><th scope="col">Alertes</th></tr></thead>
                <tbody>
                  @for (x of ip.offres; track x.idOffre) {
                    <tr><td>n° {{ x.numero ?? '—' }}</td><td class="pmd__num">{{ ariary(x.montant) }}</td><td class="pmd__num">{{ ecart(x.ecartEstimation) }}</td><td class="pmd__num">{{ ecart(x.ecartMoyenne) }}</td><td>{{ x.alertes.length ? x.alertes.join(' ; ') : '—' }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
        @if (vue() === 'attribution') {
          <h3 class="pmd__titre">Attribution proposée — lot {{ l.lot }}</h3>
          @if (l.proposition?.titulaires?.length) {
            <app-titulaires-proposes [titulaires]="l.proposition!.titulaires" [lot]="l.lot" />
          } @else if (l.proposition; as p) {
            <p class="pmd__ligne"><strong>Proposition d'attribution :</strong> {{ p.infructueux ? 'lot infructueux' : 'offre n° ' + p.numero + ' · ' + p.candidat + ' · ' + ariary(p.montant) + ' HT' }}</p>
          }
          <app-projet-marche-doc [idDmc]="idDmc()" [lot]="l.lot" />
        }
        @if (vue() === 'rapport' && ev()?.rapport; as r) {
          <h3 class="pmd__titre">PV de validation — le rapport signé</h3>
          <p class="pmd__ligne">Rapport produit le {{ date(r.produitLe) }}{{ r.signe ? ', validé le ' + date(r.signeLe) + ' (dernière signature)' : ', signatures en cours' }}{{ r.quorum ? ' · quorum ' + (r.quorum.atteint ? 'atteint' : 'non atteint') : '' }}.</p>
          @if (r.observations) { <p class="pmd__aide">« {{ r.observations }} »</p> }
          <ul class="pmd__signatures">
            @for (g of r.signatures; track $index) { <li><strong>{{ g.nom }}</strong>{{ g.president ? ' — président' : '' }} · signé le {{ date(g.date) }}{{ g.observation ? ' — ' + g.observation : '' }}</li> }
            @for (g of r.signaturesAttendues; track $index) { <li class="pmd__attendue">{{ g.nom }} — signature attendue</li> }
          </ul>
        }
      </section>
      }
    }
  `,
  styleUrl: './procedure-marche-docs.scss',
})
export class EvaluationMarcheDoc implements OnInit {
  readonly idDmc = input.required<number>();
  readonly lot = input<number | null>(null);
  /** Le rapport (décisions, signatures : le PV de validation) ou l'attribution (titulaires, proposition, projet de marché). */
  readonly vue = input<'rapport' | 'attribution'>('rapport');
  /** ⚠️ 01/11 (pilote, variante B) — la fenêtre de la page du dossier : le rapport partie par partie, un onglet chacune. */
  readonly parties = input(false);
  /** L'onglet ouvert : `synthese`, `qualification`, `commission` ou l'identifiant d'une offre. */
  readonly partie = signal<string>('synthese');
  readonly offreChoisie = computed(() => this.offresTriees().find((o) => o.idOffre === this.partie()) ?? null);
  /** Les offres post-qualifiées (en principe la seule classée première) : leurs critères ont leur onglet. */
  readonly offresQualifiees = computed(() => this.offresTriees().filter((o) => !!o.qualification?.criteres?.length));
  readonly declarationsSignees = computed(() => (this.ev()?.declarations ?? []).filter((d) => !!d.signeeLe).length);
  readonly declarationsEnDefaut = computed(() => (this.ev()?.declarations ?? []).some((d) => !d.signeeLe || d.conflit));
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Réduction légère quand la partie ouverte dépasse un peu la fenêtre (80 % au plus). */
  readonly zoom = signal(1);
  private readonly suiviZoom = effect(() => {
    if (!this.parties()) return;
    this.partie();
    this.ev();
    this.cao();
    this.indicateurs();
    this.specs();
    setTimeout(() => this.ajuster(), 300);
    setTimeout(() => this.ajuster(), 900);
  });

  /** Mesure la partie ouverte à sa taille naturelle et la réduit juste assez pour tenir dans le corps de la fenêtre. */
  ajuster(): void {
    if (!this.parties()) return;
    const corps = this.hote.nativeElement.closest('.modal-body');
    const section = this.hote.nativeElement.querySelector<HTMLElement>('.pmd--onglets');
    if (!corps || !section) return;
    section.style.zoom = '';
    const tient = (): boolean => corps.scrollHeight <= corps.clientHeight + 1;
    let z = 1;
    if (!tient()) {
      const surplus = corps.scrollHeight - corps.clientHeight;
      z = Math.max(0.8, Math.floor(((section.offsetHeight - surplus) / section.offsetHeight) * 100) / 100);
      section.style.zoom = String(z);
      while (z < 1 && tient()) {
        const essai = Math.round((z + 0.01) * 100) / 100;
        section.style.zoom = String(essai);
        if (!tient()) break;
        z = essai;
      }
    }
    this.zoom.set(z);
    section.style.zoom = z < 1 ? String(z) : '';
  }

  /** Le motif porté par au moins trois critères : écrit une fois sous le tableau plutôt que répété à chaque ligne. */
  motifCommun(criteres: readonly { exigence?: string | null; motif?: string | null; constat?: string | null }[]): string | null {
    const compte = new Map<string, number>();
    for (const k of criteres) { const m = this.motifCourt(k); if (m) compte.set(m, (compte.get(m) ?? 0) + 1); }
    const [motif, n] = [...compte.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    return n >= 3 ? motif : null;
  }

  /** Une exigence purement chiffrée (« 25000000000 ») se lit groupée par milliers ; le reste tel que le DAO l'écrit. */
  exigenceLisible(e: string | null | undefined): string {
    if (!e) return '—';
    return /^\d{4,}$/.test(e.trim()) ? e.trim().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') : e;
  }

  indicateurDe(idOffre: string): IndicateursPrix['offres'][number] | null {
    return this.indicateurs()?.offres.find((x) => x.idOffre === idOffre) ?? null;
  }

  /** Le motif d'un critère, sans répéter l'exigence déjà affichée dans sa colonne (« Exigence « … » satisfaite au vu… »). */
  motifCourt(k: { exigence?: string | null; motif?: string | null; constat?: string | null }): string {
    const m = k.motif || k.constat || '';
    const prefixe = k.exigence ? `Exigence « ${k.exigence} » ` : null;
    if (prefixe && m.startsWith(prefixe)) {
      const reste = m.slice(prefixe.length);
      return reste.charAt(0).toUpperCase() + reste.slice(1);
    }
    return m;
  }
  private readonly service = inject(EvaluationService);
  private readonly caoService = inject(CaoService);
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly ev = signal<Evaluation | null>(null);
  readonly cao = signal<Cao | null>(null);
  readonly indicateurs = signal<IndicateursPrix | null>(null);
  /** ⚠️ 27/10 (L2) — le tableau de conformité de chaque offre, lu par la Commission une fois le rapport signé. */
  readonly specs = signal<Record<string, SpecificationOffre[]>>({});
  readonly lotEval = computed(() => { const e = this.ev(); return e?.lots.find((l) => l.lot === this.lot()) ?? e?.lots[0] ?? null; });
  readonly offresTriees = computed(() => [...(this.lotEval()?.offres ?? [])].sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99) || (a.numero ?? 0) - (b.numero ?? 0)));
  readonly synthese = syntheseOffre;
  readonly ariary = ariary;
  readonly date = dateHeureFr;
  ecart(v: number | null | undefined): string { return v == null ? '—' : ecartPourCent(v); }
  cote(c: CoteConformite | null | undefined): string { return c ? LIBELLES_COTE[c] : 'à examiner'; }
  regle(r: keyof typeof LIBELLES_REGLE): string { return LIBELLES_REGLE[r]; }
  groupe(g: keyof typeof LIBELLES_GROUPE_CRITERE): string { return LIBELLES_GROUPE_CRITERE[g]; }
  origine(o: string): string { return (LIBELLES_ORIGINE as Record<string, string>)[o] ?? o; }
  jour(iso: string): string { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; }

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.lire(this.idDmc()).subscribe({
      next: (e) => {
        this.ev.set(e);
        this.chargement.set(false);
        if (this.vue() === 'rapport') {
          // Facultatifs : la CAO et les indicateurs de prix ; un échec retire leur section.
          this.caoService.lire(this.idDmc()).subscribe({ next: (c) => this.cao.set(c), error: () => {} });
          const lot = this.lotEval()?.lot ?? 1;
          this.service.indicateursPrix(this.idDmc(), lot).subscribe({ next: (i) => this.indicateurs.set(i), error: () => {} });
          // Avant la signature du rapport, la Commission reçoit un 403 : la section reste absente.
          for (const o of this.lotEval()?.offres ?? []) {
            this.service.specifications(this.idDmc(), o.idOffre).subscribe({
              next: (l) => this.specs.update((m) => ({ ...m, [o.idOffre]: l })),
              error: () => {},
            });
          }
        }
      },
      error: () => { this.erreur.set(true); this.chargement.set(false); },
    });
  }
}

const LIBELLES_AVIS: Readonly<Record<string, string>> = { FAV: 'favorable', FAVR: 'favorable avec réserves', DEF: 'défavorable' };

/** Le PV de la Commission sur le dossier de mise en concurrence, lu en données (il n'a pas de PDF : aucun modèle officiel). */
@Component({
  selector: 'app-pv-cnm-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    <!-- ⚠️ 02/11 (pilote) — le PV lu comme un document : l'avis en tête (pastille de couleur), la frise de son circuit avec ses dates,
         les signataires et la synthèse des observations ; le dossier de mise en concurrence en lien discret. -->
    <section class="pmd pvc" aria-label="PV de la Commission sur le dossier de mise en concurrence">
      @if (erreur()) {
        <app-etat-erreur message="Le PV n'a pas pu être lu." (reessayer)="charger()" />
      } @else if (pv(); as p) {
        <header class="pvc-tete">
          <div class="pvc-tete__g">
            <span class="pvc-sur">PV de la CNM sur le dossier de mise en concurrence</span>
            <h3 class="pvc-ref">{{ p.refePv || ('PV n° ' + p.idPv) }}</h3>
            @if (refeMec()) { <span class="pvc-sous">Dossier {{ refeMec() }}</span> }
          </div>
          <div class="pvc-avis" [attr.data-avis]="p.idAvis || null">
            <span class="pvc-avis__k">Avis</span>
            <span class="pvc-avis__v">{{ avis(p.idAvis) }}</span>
          </div>
        </header>

        <ol class="pvc-frise" aria-label="Circuit du PV">
          @for (e of etapes(); track e.libelle) {
            <li class="pvc-pas" [class.pvc-pas--fait]="!!e.date">
              <span class="pvc-pas__pt" aria-hidden="true"></span>
              <span class="pvc-pas__l">{{ e.libelle }}</span>
              <span class="pvc-pas__d">{{ e.date ? date(e.date) : '—' }}</span>
              @if (e.qui) { <span class="pvc-pas__q">{{ e.qui }}</span> }
            </li>
          }
        </ol>

        <div class="pvc-corps">
          <section class="pvc-bloc" aria-labelledby="pvc-sig">
            <h4 class="pvc-bloc__t" id="pvc-sig">Signataires</h4>
            @if (signataires().length) {
              <dl class="pvc-liste">
                @for (s of signataires(); track s.role) { <div><dt>{{ s.role }}</dt><dd>{{ s.nom }}</dd></div> }
              </dl>
            } @else {
              <p class="pvc-aide">Les noms des contrôleurs ne sont pas communiqués à votre profil.</p>
            }
            @if (p.nbNavettes) { <p class="pvc-aide">{{ p.nbNavettes }} navette{{ p.nbNavettes > 1 ? 's' : '' }} avant le visa.</p> }
          </section>
          <section class="pvc-bloc" aria-labelledby="pvc-obs">
            <h4 class="pvc-bloc__t" id="pvc-obs">Synthèse des observations</h4>
            @if (p.syntheseObservations?.trim()) {
              <p class="pvc-texte">{{ p.syntheseObservations }}</p>
            } @else {
              <p class="pvc-aide">{{ p.idAvis === 'FAV' ? 'Aucune observation : l’avis est favorable sans réserve.' : 'Aucune synthèse saisie.' }}</p>
            }
          </section>
        </div>

        <footer class="pvc-pied">
          @if (!p.documentDisponible) { <span class="pvc-aide">Pas de document PDF : aucun modèle officiel n’existe pour le PV d’un dossier de mise en concurrence.</span> }
          @if (idDossierMec()) { <a class="btn btn-outline btn-sm" [routerLink]="['/dossier', idDossierMec()]">Ouvrir le dossier de mise en concurrence</a> }
        </footer>
      } @else {
        <p class="pvc-aide" role="status">Chargement du PV…</p>
      }
    </section>
  `,
  styleUrl: './procedure-marche-docs.scss',
})
export class PvCnmDoc implements OnInit {
  /** Le dossier de marché : le PV se trouve par sa pièce `PV_CNM_DMC` (`idPv`, V137). */
  readonly idDossier = input.required<number>();
  readonly idDossierMec = input<number | null>(null);
  readonly refeMec = input<string | null>(null);
  private readonly service = inject(PvExamenService);
  private readonly dossiers = inject(DossierService);
  readonly pv = signal<PvExamen | null>(null);
  readonly erreur = signal(false);
  avis(c: string | null | undefined): string { return c ? LIBELLES_AVIS[c] ?? c : '—'; }
  readonly date = dateFr;

  /** La frise du circuit du PV : chaque étape et sa date (absente : pas encore franchie, ou non tracée). */
  readonly etapes = computed(() => {
    const p = this.pv();
    if (!p) return [];
    const vise = p.nomDispatcheur ? p.nomDispatcheur + (p.viseParInterim && p.interimDe ? ' (par intérim de ' + p.interimDe + ')' : '') : null;
    return [
      { libelle: 'Projet soumis', date: p.dateSoumissionInitiale ?? null, qui: null },
      { libelle: 'Visé', date: p.dateAcceptation ?? null, qui: vise },
      { libelle: 'Signé par le Membre', date: p.dateSignatureMembre ?? null, qui: p.nomMembreCoSignataire ?? null },
      { libelle: p.dateSignatureCc && !p.dateSignaturePresident ? 'Signé par le Chef de commission' : 'Signé par le Président', date: p.dateSignaturePresident ?? p.dateSignatureCc ?? null, qui: null },
      { libelle: 'Archivé', date: p.dateArchivage ?? null, qui: null },
    ];
  });

  /** Les signataires dont le nom est servi (la PRMP et l'UGPM n'en reçoivent aucun). */
  readonly signataires = computed(() => {
    const p = this.pv();
    if (!p) return [];
    return [
      { role: 'Membre co-signataire', nom: p.nomMembreCoSignataire ?? null },
      { role: 'Chef de commission co-signataire', nom: p.nomCcCoSignataire ?? null },
      { role: 'Visa', nom: p.nomDispatcheur ? p.nomDispatcheur + (p.viseParInterim && p.interimDe ? ' — par intérim de ' + p.interimDe : '') : null },
    ].filter((s): s is { role: string; nom: string } => !!s.nom);
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.erreur.set(false);
    this.dossiers.piecesExigees(this.idDossier()).subscribe({
      next: (l) => {
        const id = l.find((t) => t.code === 'PV_CNM_DMC')?.idPv;
        if (id != null) this.service.getById(id).subscribe({ next: (p) => this.pv.set(p), error: () => this.erreur.set(true) });
      },
      error: () => this.erreur.set(true),
    });
  }
}
