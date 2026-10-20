import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Evaluation, OffreEvaluee, PvExamen } from '../../../models';
import { DossierService, EvaluationService, PvExamenService } from '../../../services';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { dateHeureFr } from '../../candidat/libelles-candidat';
import { LectureSeance } from '../../procedure/lecture-seance';
import { LIBELLES_ANORMALE, ariary } from '../../evaluation/libelles-evaluation';
import { TitulairesProposes } from '../../evaluation/titulaires-proposes';

/**
 * ⚠️ 20/10 (pilote, demande « dossier-marche-donnees », livrée le 20/10 sans migration) — les pièces d'un dossier de MARCHÉ né d'une attribution, lues **en
 * données** par la Commission, comme celles d'un dossier de mise en concurrence produites par sa fiche : la séance d'ouverture, le
 * rapport d'évaluation (et son PV de validation, ses signatures), l'attribution proposée, le PV de la Commission sur le DAO. Lecture
 * seule : aucun geste ; les pièces des offres restent à la CAO (`piecesOuvrables = false`).
 */

/** La séance d'ouverture : la lecture des offres, sans ouvrir leurs pièces. */
@Component({
  selector: 'app-seance-marche-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LectureSeance],
  template: `
    <section class="pmd" aria-label="Séance d'ouverture des plis">
      <h3 class="pmd__titre">Séance d'ouverture des plis — lecture des offres</h3>
      <p class="pmd__aide">Ce que la séance a lu, offre par offre. Les pièces des offres restent réservées aux membres de la commission d'appel d'offres.</p>
      <app-lecture-seance [idDmc]="idDmc()" [piecesOuvrables]="false" />
    </section>
  `,
  styleUrl: './procedure-marche-docs.scss',
})
export class SeanceMarcheDoc {
  readonly idDmc = input.required<number>();
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

/** Le rapport d'évaluation : les offres et leurs décisions, la proposition, le rapport signé (qui vaut PV de validation). */
@Component({
  selector: 'app-evaluation-marche-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, TitulairesProposes],
  template: `
    @if (chargement()) {
      <p class="text-muted" role="status">Chargement de l'évaluation…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="L'évaluation n'a pas pu être lue." (reessayer)="charger()" />
    } @else if (lotEval(); as l) {
      <section class="pmd" [attr.aria-label]="vue() === 'attribution' ? 'Attribution proposée' : 'Rapport d’évaluation'">
        @if (vue() === 'rapport') {
        <h3 class="pmd__titre">Rapport d'évaluation — lot {{ l.lot }}</h3>
        <div class="cnm-table-wrap">
          <table class="cnm-table pmd__table" aria-label="Les offres et leurs décisions">
            <thead><tr><th scope="col">Rang</th><th scope="col">Offre</th><th scope="col">Soumissionnaire</th><th scope="col">Examen préliminaire</th><th scope="col" class="pmd__num">Montant évalué HT</th><th scope="col">Offre anormale</th><th scope="col">Post-qualification</th></tr></thead>
            <tbody>
              @for (o of offresTriees(); track o.idOffre) {
                @let s = synthese(o);
                <tr [class.pmd__ecartee]="!!o.ecartee">
                  <td>{{ o.rang ?? '—' }}</td><td>n° {{ o.numero ?? '—' }}</td><td>{{ o.entreprise.raisonSociale }}</td>
                  <td>{{ s.conformite }}</td><td class="pmd__num">{{ ariary(o.evaluation?.montantEvalue) }}</td><td>{{ s.anormale }}</td><td>{{ s.qualification }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        }
        @if (vue() === 'attribution') {
        <h3 class="pmd__titre">Attribution proposée — lot {{ l.lot }}</h3>
        @if (l.proposition?.titulaires?.length) {
          <app-titulaires-proposes [titulaires]="l.proposition!.titulaires" [lot]="l.lot" />
        } @else if (l.proposition; as p) {
          <p class="pmd__ligne"><strong>Proposition d'attribution :</strong> {{ p.infructueux ? 'lot infructueux' : 'offre n° ' + p.numero + ' · ' + p.candidat + ' · ' + ariary(p.montant) + ' HT' }}</p>
        }
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
  /** Le rapport (décisions, signatures : le PV de validation) ou l'attribution (titulaires, proposition). */
  readonly vue = input<'rapport' | 'attribution'>('rapport');
  private readonly service = inject(EvaluationService);
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly ev = signal<Evaluation | null>(null);
  readonly lotEval = computed(() => { const e = this.ev(); return e?.lots.find((l) => l.lot === this.lot()) ?? e?.lots[0] ?? null; });
  readonly offresTriees = computed(() => [...(this.lotEval()?.offres ?? [])].sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99) || (a.numero ?? 0) - (b.numero ?? 0)));
  readonly synthese = syntheseOffre;
  readonly ariary = ariary;
  readonly date = dateHeureFr;

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.lire(this.idDmc()).subscribe({
      next: (e) => { this.ev.set(e); this.chargement.set(false); },
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
