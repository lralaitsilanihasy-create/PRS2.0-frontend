import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

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
  template: `
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
  `,
  styleUrl: './procedure-marche-docs.scss',
})
export class SeanceMarcheDoc implements OnInit {
  readonly idDmc = input.required<number>();
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
  template: `
    @if (chargement()) {
      <p class="text-muted" role="status">Chargement de l'évaluation…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="L'évaluation n'a pas pu être lue." (reessayer)="charger()" />
    } @else if (lotEval(); as l) {
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
  `,
  styleUrl: './procedure-marche-docs.scss',
})
export class EvaluationMarcheDoc implements OnInit {
  readonly idDmc = input.required<number>();
  readonly lot = input<number | null>(null);
  /** Le rapport (décisions, signatures : le PV de validation) ou l'attribution (titulaires, proposition, projet de marché). */
  readonly vue = input<'rapport' | 'attribution'>('rapport');
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
    <section class="pmd" aria-label="PV de la Commission sur le dossier de mise en concurrence">
      <h3 class="pmd__titre">PV de la Commission sur le dossier de mise en concurrence</h3>
      @if (erreur()) {
        <app-etat-erreur message="Le PV n'a pas pu être lu." (reessayer)="charger()" />
      } @else if (pv(); as p) {
        <dl class="pmd__faits">
          <div><dt>Référence</dt><dd class="cnm-mono">{{ p.refePv || ('PV n° ' + p.idPv) }}</dd></div>
          <div><dt>Avis</dt><dd><strong>{{ avis(p.idAvis) }}</strong></dd></div>
          <div><dt>Signé le</dt><dd>{{ p.dateSignatureMembre || p.datePv || '—' }}</dd></div>
          <div><dt>Membre</dt><dd>{{ p.nomMembreCoSignataire || p.imCtrlMembre || '—' }}</dd></div>
          <div><dt>Visé par</dt><dd>{{ p.nomDispatcheur || p.imCtrlPresident || '—' }}</dd></div>
        </dl>
        @if (!p.documentDisponible) { <p class="pmd__aide">Ce PV n'a pas de document PDF : aucun modèle officiel n'existe pour le PV d'un dossier de mise en concurrence.</p> }
      }
      @if (idDossierMec()) { <a class="btn btn-outline btn-sm" [routerLink]="['/dossier', idDossierMec()]">Ouvrir le dossier de mise en concurrence{{ refeMec() ? ' ' + refeMec() : '' }}</a> }
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
