import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { DecisionCritere, Evaluation, LotEvaluation, Qualification } from '../../models';
import { EvaluationService, SeanceService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { DroitsEvaluation, etapeArretee } from './droits-evaluation';
import { LIBELLES_GROUPE_CRITERE, ariary, refusEvaluation } from './libelles-evaluation';

/**
 * La **post-qualification** d'un lot (étape 5 du guide, art. 20, 47-V) : le serveur sert l'offre **dont c'est le tour** (la
 * mieux classée qui n'a pas échoué) et ses critères, dérivés de la fiche (art. 20-II : rien d'autre). La CAO décide chaque
 * critère, puis qualifie l'offre ou non (motif et clause) ; une offre non qualifiée est écartée et le tour passe à la suivante.
 * Les valeurs déclarées se lisent dans les formulaires de l'offre (réservés aux membres de la CAO). Arrêtée, l'étape porte la
 * **proposition d'attribution** du lot, ou l'infructuosité proposée.
 */
@Component({
  selector: 'app-etape-qualification',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lot().proposition; as p) {
      <section class="card eq__proposition" aria-label="Proposition d'attribution">
        @if (p.infructueux) {
          <p><strong>Aucune offre n'est qualifiée : la CAO propose de déclarer le lot infructueux</strong> (décision de la PRMP, lot 2).</p>
        } @else {
          <p><strong>Proposition d'attribution — lot {{ lot().lot }}</strong> : offre n° {{ p.numero }} · {{ p.candidat }}</p>
          <p class="text-sm">Montant {{ ariary(p.montant) }} HT (prix corrigé, rabais déduit) · {{ ariary(p.montantTtc) }} TTC lu · délai d'exécution {{ p.delai ?? '—' }} (acte d'engagement)</p>
        }
      </section>
    }

    @for (o of examinees(); track o.idOffre) {
      <p class="text-sm eq__echec">Offre n° {{ o.numero }} · {{ o.entreprise.raisonSociale }} — <strong>non qualifiée</strong> : {{ o.qualification?.motif }}{{ o.qualification?.clause ? ' (' + o.qualification!.clause + ')' : '' }}</p>
    }

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement de la post-qualification…</p>
    } @else if (qualification(); as q) {
      @if (!q.idOffre) {
        @if (!lot().proposition) { <p class="text-sm">Toutes les offres classées ont échoué : le président arrête l'étape, et l'infructuosité est proposée.</p> }
      } @else {
        <article class="card eq" [attr.aria-label]="'Post-qualification de l’offre n° ' + q.numero">
          <header class="eq__tete">
            <h3 class="eq__titre">Offre n° {{ q.numero }} · {{ candidat(q.idOffre) }}</h3>
            @if (q.decision) {
              <span class="badge" [class.badge-success]="q.decision === 'QUALIFIE'" [class.badge-danger]="q.decision === 'NON_QUALIFIE'">{{ q.decision === 'QUALIFIE' ? 'Qualifiée' : 'Non qualifiée' }}</span>
            } @else { <span class="badge badge-warning">C'est son tour</span> }
            @if (droits().membre) {
              <button type="button" class="btn btn-outline btn-sm" [disabled]="travail()" (click)="formulaire(q.idOffre)">Capacités déclarées (PDF)</button>
            }
          </header>
          @if (q.nom) { <p class="text-sm text-muted eq__auteur">Décision de {{ q.nom }}, le {{ dateHeure(q.le) }}.</p> }
          <div class="cnm-table-wrap">
            <table class="cnm-table" aria-label="Critères de qualification du DAO">
              <thead><tr><th scope="col">Critère</th><th scope="col">Exigence du DAO</th><th scope="col">Constat de séance</th><th scope="col">Décision</th><th scope="col">Motif</th></tr></thead>
              <tbody>
                @for (k of q.criteres; track k.code) {
                  <tr>
                    <th scope="row"><span class="text-sm text-muted">{{ groupes[k.groupe] }}</span><br />{{ k.libelle }}</th>
                    <td class="text-sm">{{ k.exigence || '—' }}</td>
                    <td class="text-sm">{{ k.constat || (k.proposee === false ? 'Alerte de séance' : 'À vérifier sur l’offre') }}</td>
                    <td>
                      <select class="form-control form-control-sm" [attr.aria-label]="'Décision : ' + k.libelle" [disabled]="!modifiable()" (change)="decider(k.code, $any($event.target).value || null)">
                        <option value="" [selected]="!choix()[k.code]">—</option>
                        <option value="SATISFAIT" [selected]="choix()[k.code] === 'SATISFAIT'">Satisfait</option>
                        <option value="NON_SATISFAIT" [selected]="choix()[k.code] === 'NON_SATISFAIT'">Non satisfait</option>
                      </select>
                    </td>
                    <td><input class="form-control form-control-sm" type="text" [attr.aria-label]="'Motif : ' + k.libelle" [disabled]="!modifiable()" [value]="motifs()[k.code] ?? ''" (input)="motiver(k.code, $any($event.target).value)" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (modifiable()) {
            <fieldset class="eq__decision">
              <legend class="form-label">L'offre est-elle qualifiée ?</legend>
              <div class="eq__radios">
                <label><input type="radio" name="eq-dec" [checked]="decision() === 'QUALIFIE'" (change)="decision.set('QUALIFIE')" /> Qualifiée : la CAO la propose à l'attribution</label>
                <label><input type="radio" name="eq-dec" [checked]="decision() === 'NON_QUALIFIE'" (change)="decision.set('NON_QUALIFIE')" /> Non qualifiée : écartée, le tour passe à l'offre suivante</label>
              </div>
              @if (decision() === 'NON_QUALIFIE') {
                <div class="eq__ecart">
                  <label class="form-group"><span class="form-label">Motif</span><input class="form-control" type="text" [value]="motif()" (input)="motif.set($any($event.target).value)" /></label>
                  <label class="form-group"><span class="form-label">Clause du DAO visée</span><input class="form-control" type="text" [value]="clause()" (input)="clause.set($any($event.target).value)" /></label>
                </div>
              }
              <div class="eq__actions"><button type="button" class="btn btn-primary btn-sm" [disabled]="!decision() || travail()" (click)="enregistrer(q)">Enregistrer</button></div>
            </fieldset>
          }
        </article>
      }
    }
    @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.6rem; }
    .eq__proposition { padding: 0.7rem 1rem; border-left: 4px solid var(--p-600); }
    .eq__proposition p { margin: 0; }
    .eq__echec { margin: 0; }
    .eq { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .eq__tete { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .eq__titre { margin: 0; font-size: 1rem; flex: 1 1 auto; }
    .eq__auteur { margin: 0; }
    .eq table { table-layout: fixed; width: 100%; }
    .eq th, .eq td { white-space: normal; vertical-align: top; }
    .eq tbody th[scope='row'] { text-align: left; font-weight: 600; color: var(--n-800); background: transparent; text-transform: none; letter-spacing: normal; font-size: var(--text-sm); }
    .eq__decision { border: 1px solid var(--n-200); border-radius: 6px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .eq__radios { display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--text-sm); }
    .eq__ecart { display: grid; grid-template-columns: 2fr 1fr; gap: 0.5rem; }
    .eq__actions { display: flex; justify-content: flex-end; }
    @media (max-width: 800px) { .eq__ecart { grid-template-columns: 1fr; } }
  `,
})
export class EtapeQualification {
  readonly idDmc = input.required<number>();
  readonly lot = input.required<LotEvaluation>();
  readonly droits = input.required<DroitsEvaluation>();
  readonly maj = output<Evaluation>();

  private readonly service = inject(EvaluationService);
  private readonly seance = inject(SeanceService);
  private readonly toast = inject(ToastService);

  readonly groupes = LIBELLES_GROUPE_CRITERE;
  readonly ariary = ariary;
  readonly dateHeure = dateHeureFr;

  readonly chargement = signal(true);
  readonly qualification = signal<Qualification | null>(null);
  readonly choix = signal<Record<string, DecisionCritere | null>>({});
  readonly motifs = signal<Record<string, string>>({});
  readonly decision = signal<'QUALIFIE' | 'NON_QUALIFIE' | null>(null);
  readonly motif = signal('');
  readonly clause = signal('');
  readonly travail = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly modifiable = computed(() => this.droits().decider && !etapeArretee(this.lot(), 'QUALIFICATION'));
  /** Les offres déjà examinées et non qualifiées (écartées à l'étape 5). */
  readonly examinees = computed(() => this.lot().offres.filter((o) => o.ecartee?.etape === 'QUALIFICATION'));

  constructor() {
    // Le lot change après chaque geste (le tour peut passer à l'offre suivante) : on relit l'offre du tour.
    effect(() => {
      this.lot();
      untracked(() => this.charger());
    });
  }

  charger(): void {
    this.service.qualificationDuLot(this.idDmc(), this.lot().lot).subscribe({
      next: (q) => {
        this.chargement.set(false);
        this.qualification.set(q);
        const choix: Record<string, DecisionCritere | null> = {};
        const motifs: Record<string, string> = {};
        for (const k of q.criteres) {
          // Une alerte de séance propose « non satisfait » ; sinon rien n'est présumé.
          choix[k.code] = k.decision ?? (k.proposee === false ? 'NON_SATISFAIT' : null);
          motifs[k.code] = k.motif ?? (k.proposee === false && k.constat ? k.constat : '');
        }
        this.choix.set(choix);
        this.motifs.set(motifs);
        this.decision.set(q.decision);
        this.motif.set(q.motif ?? '');
        this.clause.set(q.clause ?? '');
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        this.erreur.set(refusEvaluation(e));
      },
    });
  }

  candidat(idOffre: string | null): string {
    return this.lot().offres.find((o) => o.idOffre === idOffre)?.entreprise.raisonSociale ?? '';
  }

  decider(code: string, d: DecisionCritere | null): void {
    this.choix.update((c) => ({ ...c, [code]: d }));
  }

  motiver(code: string, texte: string): void {
    this.motifs.update((m) => ({ ...m, [code]: texte }));
  }

  formulaire(idOffre: string): void {
    this.travail.set(true);
    this.seance.formulairePdf(this.idDmc(), idOffre, 'CAPACITES').subscribe({
      next: (b) => {
        this.travail.set(false);
        ouvrirBlobSur(b);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.erreur.set(e.status === 404 ? 'Cette offre ne porte pas de formulaire des capacités : les valeurs déclarées se lisent dans ses pièces.' : refusEvaluation(e));
      },
    });
  }

  enregistrer(q: Qualification): void {
    const decision = this.decision();
    if (!decision || !q.idOffre) return;
    this.travail.set(true);
    this.erreur.set(null);
    const nonQualifie = decision === 'NON_QUALIFIE';
    this.service
      .qualifier(this.idDmc(), q.idOffre, {
        criteres: q.criteres.map((k) => ({ code: k.code, decision: this.choix()[k.code] as DecisionCritere, motif: this.motifs()[k.code]?.trim() || null })),
        decision,
        motif: nonQualifie ? this.motif().trim() || null : null,
        clause: nonQualifie ? this.clause().trim() || null : null,
      })
      .subscribe({
        next: (ev) => {
          this.travail.set(false);
          this.toast.success(nonQualifie ? 'L’offre n’est pas qualifiée : le tour passe à l’offre suivante.' : 'L’offre est qualifiée ; le président peut arrêter l’étape.');
          this.maj.emit(ev);
        },
        error: (e: ApiError) => {
          this.travail.set(false);
          this.erreur.set(refusEvaluation(e));
        },
      });
  }
}
