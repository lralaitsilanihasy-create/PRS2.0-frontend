import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { Evaluation, RapportRetire } from '../../models';
import { EvaluationService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { QuorumCaoVue, suffixeQualite } from '../procedure/quorum-cao';
import { DroitsEvaluation } from './droits-evaluation';
import { refusEvaluation } from './libelles-evaluation';

/**
 * Le **rapport d'évaluation** (V78) : produit par le responsable quand toutes les étapes de tous les lots sont arrêtées, sur le
 * plan du guide ; signé par les membres de la CAO (hors ceux qui ont déclaré un conflit), chacun pouvant y joindre une
 * **observation** de désaccord ; un empêchement est constaté par le président (à défaut, le responsable). À la dernière
 * signature, l'évaluation est close et la PRMP notifiée. Le rapport n'est pas public.
 *
 * ⚠️ V120 (15/10, guide de la CAO, §B5 ; décision du pilote) — la troisième issue du PV de validation du guide : avant la dernière
 * signature, le président (ou son représentant désigné pour le rapport) **retire** le rapport, motif obligatoire, pour faire reprendre
 * l'évaluation. Les signatures tombent ; le rapport retiré reste lisible ; la commission rouvre l'étape de son choix.
 */
@Component({
  selector: 'app-rapport-evaluation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QuorumCaoVue, ModaleDirective],
  template: `
    @let ev = evaluation();
    <section class="card re" aria-labelledby="re-titre">
      <h2 id="re-titre" class="re__h2">Rapport d'évaluation</h2>
      @if (!ev.rapport) {
        @if (toutArrete()) {
          <p class="text-sm">{{ pi() ? 'Chaque lot est prêt' : 'Toutes les étapes sont arrêtées' }} : le responsable de la procédure produit le rapport, qui part à la signature des membres.</p>
          @if (droits().responsable) {
            <label class="form-group"><span class="form-label">Observations du responsable (facultatives, portées au rapport)</span>
              <textarea class="form-control" rows="2" [value]="observations()" (input)="observations.set($any($event.target).value)"></textarea>
            </label>
            <button type="button" class="btn btn-primary btn-sm re__btn" [disabled]="travail()" (click)="produire()">Produire le rapport d'évaluation</button>
          }
        } @else {
          <p class="text-sm text-muted">{{ pi() ? 'Le rapport se produit quand chaque lot est prêt : négociation réussie, ou infructuosité constatée.' : 'Le rapport se produit quand toutes les étapes de tous les lots sont arrêtées par le président.' }}</p>
        }
      } @else {
        @let r = ev.rapport;
        <p class="re__etat">
          <span class="badge" [class.badge-success]="r.signe" [class.badge-warning]="!r.signe">{{ r.signe ? 'Signé de tous' : 'À signer — ' + r.signaturesAttendues.length + ' signature(s) attendue(s)' }}</span>
          <span class="text-sm text-muted">Produit le {{ dateHeure(r.produitLe) }}{{ r.signeLe ? ' · signé le ' + dateHeure(r.signeLe) : '' }}</span>
        </p>
        <div class="re__actions">
          <button type="button" class="btn btn-outline btn-sm" [disabled]="travail()" (click)="ouvrir()">Lire le rapport (PDF)</button>
          <button type="button" class="btn btn-ghost btn-sm" [disabled]="travail()" (click)="word()">Enregistrer en Word</button>
        </div>
        @if (r.signatures.length) {
          <ul class="re__liste" aria-label="Signatures posées">
            @for (g of r.signatures; track g.im) {
              <li>
                <strong>{{ g.nom }}</strong>{{ g.president ? ' — président' : '' }}
                @if (g.empechement) {
                  <span class="text-sm"> · empêché : {{ g.motif }} (constaté par {{ g.constatePar }}, le {{ dateHeure(g.date) }})</span>
                } @else {
                  <span class="text-sm text-muted"> · signé le {{ dateHeure(g.date) }}</span>
                  @if (g.observation) { <span class="text-sm"> — observation : « {{ g.observation }} »</span> }
                }
              </li>
            }
          </ul>
        }
        @if (r.signaturesAttendues.length) { <p class="text-sm re__attendues">En attente : {{ nomsAttendus() }}</p> }
        <!-- ⚠️ R1 (V101) — le rapport signé vaut PV de validation (Q4) : le quorum de la commission y est servi. -->
        <app-quorum-cao [quorum]="r.quorum" />

        @if (jeDoisSigner()) {
          <div class="re__signer">
            <p class="text-sm">Relisez le rapport, puis signez. Si vous êtes en désaccord, votre observation est portée au rapport.</p>
            <label class="form-group"><span class="form-label">Observation (facultative)</span>
              <textarea class="form-control" rows="2" [value]="observation()" (input)="observation.set($any($event.target).value)"></textarea>
            </label>
            <label class="re__case"><input type="checkbox" [checked]="lu()" (change)="lu.set($any($event.target).checked)" /> J'ai relu le rapport et je le signe</label>
            <button type="button" class="btn btn-primary btn-sm re__btn" [disabled]="!lu() || travail()" (click)="signer()">Signer le rapport d'évaluation</button>
          </div>
        }

        @if (peutRetirer()) {
          <div class="re__retrait">
            <p class="text-sm">La commission ne valide pas ce rapport ? Retirez-le avec son motif : les signatures posées tombent et l’évaluation reprend.</p>
            <button type="button" class="btn btn-outline btn-sm re__btn" [disabled]="travail()" (click)="ouvrirRetrait()">Retirer le rapport</button>
          </div>
        }

        @if (peutConstater()) {
          <details class="re__empechement">
            <summary>Constater l'empêchement d'un signataire…</summary>
            <div class="re__form">
              <label class="form-group"><span class="form-label">Signataire empêché</span>
                <select class="form-control" (change)="empeche.set($any($event.target).value)">
                  <option value="" [selected]="!empeche()">— Choisir —</option>
                  @for (a of attenduesSaufMoi(); track a.im) { <option [value]="a.im" [selected]="empeche() === a.im">{{ a.nom }}</option> }
                </select>
              </label>
              <label class="form-group"><span class="form-label">Motif (porté au rapport)</span>
                <input class="form-control" type="text" [value]="motif()" (input)="motif.set($any($event.target).value)" />
              </label>
              <button type="button" class="btn btn-outline btn-sm" [disabled]="!empeche() || !motif().trim() || travail()" (click)="constater()">Constater l'empêchement</button>
            </div>
          </details>
        }
      }
      @if (retires().length) {
        <div class="re__retires">
          <h3 class="re__h3">Rapports retirés</h3>
          <ul class="re__liste">
            @for (x of retires(); track x.id) {
              <li>
                Produit le {{ dateHeure(x.produitLe) }}, retiré le {{ dateHeure(x.retireLe) }}{{ x.nom ? ' par ' + x.nom : '' }} — motif : « {{ x.motif }} »
                @if (x.signatures) { <span class="text-sm text-muted"> · {{ x.signatures }}</span> }
                <button type="button" class="btn btn-ghost btn-sm" [disabled]="travail()" [attr.aria-label]="'Lire le rapport retiré le ' + dateHeure(x.retireLe)" (click)="lireRetire(x)">Lire (PDF)</button>
              </li>
            }
          </ul>
        </div>
      }
      @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
    </section>

    <!-- Fermeture par le bouton ou Échap seulement (règle du 13/09). -->
    @if (retrait()) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Retirer le rapport d’évaluation" appModale (appModaleFermer)="fermerRetrait()">
          <div class="modal-header">
            <span class="modal-title">Retirer le rapport d’évaluation</span>
            <button type="button" class="btn-close" aria-label="Fermer sans retirer" [disabled]="travail()" (click)="fermerRetrait()">✕</button>
          </div>
          <div class="modal-body">
            <p class="text-sm">Les {{ nbSignees() }} signature(s) déjà posée(s) tombent, chaque membre de la commission est averti et l’évaluation reprend : la commission rouvre l’étape à revoir, puis le responsable produit un nouveau rapport, qui citera ce retrait.</p>
            <label class="form-group"><span class="form-label">Motif (porté au rapport suivant)</span>
              <textarea class="form-control" rows="3" [value]="motifRetrait()" (input)="motifRetrait.set($any($event.target).value)"></textarea>
              <span class="form-hint">Par exemple : demande d’éclaircissement à un candidat, recadrage de l’évaluation d’un lot.</span>
            </label>
            @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="fermerRetrait()">Annuler</button>
            <button type="button" class="btn btn-danger" [disabled]="!motifRetrait().trim() || travail()" (click)="retirer()">{{ travail() ? 'Retrait…' : 'Retirer le rapport' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .re { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .re__h2 { margin: 0; font-size: 1.05rem; }
    .re__etat { margin: 0; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .re__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .re__liste { margin: 0; padding-left: 1.1rem; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 0.25rem; }
    .re__attendues { margin: 0; }
    .re__signer { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.6rem 0.8rem; border: 1px solid var(--n-200); border-radius: 6px; }
    .re__case { display: inline-flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); }
    .re__btn { align-self: flex-start; }
    .re__empechement summary { cursor: pointer; font-size: var(--text-sm); }
    .re__retrait { display: flex; flex-direction: column; gap: 0.4rem; }
    .re__retrait p { margin: 0; }
    .re__h3 { margin: 0.5rem 0 0.25rem; font-size: 0.95rem; }
    .re__form { display: grid; grid-template-columns: 1fr 2fr auto; gap: 0.5rem; align-items: end; padding-top: 0.5rem; }
    @media (max-width: 700px) { .re__form { grid-template-columns: 1fr; } }
  `,
})
export class RapportEvaluationVue {
  readonly idDmc = input.required<number>();
  readonly evaluation = input.required<Evaluation>();
  readonly droits = input.required<DroitsEvaluation>();
  /** ⚠️ Lot 3 PI, PI-d2b (V90) — une fiche de prestations intellectuelles : le rapport attend que chaque lot soit **prêt** (proposition servie). */
  readonly pi = input(false);
  /** Identifiant du connecté (`K…` pour un membre de la CAO). */
  readonly moi = input<string | null>(null);
  readonly maj = output<Evaluation>();

  private readonly service = inject(EvaluationService);
  private readonly toast = inject(ToastService);
  readonly dateHeure = dateHeureFr;

  readonly observations = signal('');
  readonly observation = signal('');
  readonly lu = signal(false);
  readonly empeche = signal('');
  readonly motif = signal('');
  readonly travail = signal(false);
  readonly erreur = signal<string | null>(null);

  /** ⚠️ V120 (§B5) */
  readonly retrait = signal(false);
  readonly motifRetrait = signal('');
  readonly retires = computed<RapportRetire[]>(() => this.evaluation().rapportsRetires ?? []);
  readonly nbSignees = computed(() => (this.evaluation().rapport?.signatures ?? []).filter((g) => !g.empechement).length);
  /** Le président, ou le représentant désigné pour le rapport (qualité servie parmi les signataires attendus) ; le serveur tranche (403). */
  readonly peutRetirer = computed(() => {
    const ev = this.evaluation();
    if (!ev.rapport || ev.rapport.signe || !this.droits().membre) return false;
    const moi = this.moi();
    const president = ev.declarations.some((d) => d.membre === moi && d.president);
    const representant = ev.rapport.signaturesAttendues.some((a) => a.im === moi && a.qualite === 'REPRESENTANT');
    return president || representant;
  });

  readonly toutArrete = computed(() =>
    this.pi() ? this.evaluation().lots.every((l) => l.proposition != null) : this.evaluation().lots.every((l) => l.etape === 'RAPPORT'),
  );
  readonly attendues = computed(() => this.evaluation().rapport?.signaturesAttendues ?? []);
  readonly nomsAttendus = computed(() => this.attendues().map((a) => a.nom + suffixeQualite(a.qualite)).join(', '));
  readonly jeDoisSigner = computed(() => this.droits().membre && this.attendues().some((a) => a.im === this.moi()));
  readonly attenduesSaufMoi = computed(() => this.attendues().filter((a) => a.im !== this.moi()));
  /** Le président constate ; le responsable aussi (« à défaut » : le serveur tranche, comme pour le PV d'ouverture). */
  readonly peutConstater = computed(() => {
    const ev = this.evaluation();
    if (!ev.rapport || ev.rapport.signe || !this.attenduesSaufMoi().length) return false;
    const moiPresident = ev.declarations.some((d) => d.membre === this.moi() && d.president);
    return (this.droits().membre && moiPresident) || this.droits().responsable;
  });

  produire(): void {
    this.geste(this.service.produireRapport(this.idDmc(), this.observations().trim() || null), 'Le rapport est produit : chaque membre est appelé à le signer.');
  }

  signer(): void {
    this.geste(this.service.signerRapport(this.idDmc(), this.observation().trim() || null), 'Votre signature est posée sur le rapport.', () => {
      this.lu.set(false);
      this.observation.set('');
    });
  }

  constater(): void {
    this.geste(this.service.constaterEmpechement(this.idDmc(), this.empeche(), this.motif().trim()), 'L’empêchement est constaté ; il est porté au rapport.', () => {
      this.empeche.set('');
      this.motif.set('');
    });
  }

  ouvrirRetrait(): void {
    this.motifRetrait.set('');
    this.erreur.set(null);
    this.retrait.set(true);
  }

  fermerRetrait(): void {
    if (!this.travail()) this.retrait.set(false);
  }

  retirer(): void {
    this.geste(this.service.retirerRapport(this.idDmc(), this.motifRetrait().trim()), 'Le rapport est retiré : la commission rouvre l’étape à revoir.', () => this.retrait.set(false));
  }

  lireRetire(x: RapportRetire): void {
    this.travail.set(true);
    this.service.rapportRetire(this.idDmc(), x.id).subscribe({
      next: (b) => {
        this.travail.set(false);
        ouvrirBlobSur(b);
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  ouvrir(): void {
    this.travail.set(true);
    this.service.rapport(this.idDmc()).subscribe({
      next: (b) => {
        this.travail.set(false);
        ouvrirBlobSur(b);
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  word(): void {
    this.travail.set(true);
    this.service.rapport(this.idDmc(), 'docx').subscribe({
      next: (b) => {
        this.travail.set(false);
        telechargerBlob(b, `rapport-evaluation-${this.idDmc()}.docx`);
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  private geste(appel: Observable<Evaluation>, succes: string, apres?: () => void): void {
    this.travail.set(true);
    this.erreur.set(null);
    appel.subscribe({
      next: (ev) => {
        this.travail.set(false);
        apres?.();
        this.toast.success(ev.etat === 'CLOSE' ? 'Le rapport est signé de tous : l’évaluation est close, la PRMP est notifiée.' : succes);
        this.maj.emit(ev);
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  private echec(e: ApiError): void {
    this.travail.set(false);
    this.erreur.set(refusEvaluation(e));
  }
}
