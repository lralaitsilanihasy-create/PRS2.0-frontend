import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { telechargerBlob } from '../../core/securite/fichiers-surs';
import { EnveloppeFinanciere, SeanceFinanciere } from '../../models';
import { EvaluationPiService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { ApportParts } from '../procedure/apport-parts';
import { DroitsEvaluation, EspaceEvaluation } from './droits-evaluation';
import { ariary } from './libelles-evaluation';

const LIBELLES_ETAT: Readonly<Record<SeanceFinanciere['etat'], string>> = {
  OUVERTE: 'Ouverte — les parts arrivent',
  DECHIFFREE: 'Enveloppes ouvertes',
  CLOSE: 'Close — PV produit',
};

/** Un membre de la commission, tel que l'évaluation le sert (ses déclarations). */
export interface MembreSeance {
  membre: string;
  nom: string | null;
  president: boolean;
}

/** Un montant lu dans l'acte d'engagement d'une enveloppe (`montantHt`, `montantTtc`) ; `null` s'il n'y est pas. */
export function montantLu(e: EnveloppeFinanciere, cle: 'montantHt' | 'montantTtc'): number | null {
  const v = e.acteEngagement?.[cle];
  return typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
}

/** La phrase d'un refus de la seconde séance. */
export function refusSeanceFinanciere(e: ApiError): string {
  const corps = corpsErreur<{ details?: { lots?: unknown } }>(e);
  const lots = Array.isArray(corps?.details?.lots) ? (corps.details.lots as unknown[]).join(', ') : '';
  switch (codeErreur(e)) {
    case 'SEANCE_TECHNIQUE_NON_CLOSE': return 'La première séance (enveloppes techniques) n’est pas close.';
    case 'TECHNIQUE_NON_ARRETEE': return `L’évaluation technique n’est pas arrêtée${lots ? ' (lot(s) ' + lots + ')' : ''} : la seconde séance l’attend.`;
    case 'AUCUNE_FINANCIERE_A_OUVRIR': return 'Aucune enveloppe financière n’est à ouvrir : aucune proposition n’est qualifiée techniquement.';
    case 'SEANCE_FINANCIERE_OUVERTE': return 'La seconde séance est déjà ouverte.';
    case 'SEANCE_NON_DECHIFFREE': return 'Les enveloppes ne sont pas encore ouvertes : le quorum des parts n’est pas atteint.';
    case 'SEANCE_CLOSE': return 'La séance est close.';
    case 'MEMBRE_INCONNU': return 'Un présent coché n’est pas membre de la commission.';
    case 'CATEGORIE_SANS_NOTATION_TECHNIQUE': return 'La seconde séance ne concerne que les prestations intellectuelles.';
    case 'SEANCE_FINANCIERE_EN_COURS': return 'Une séance financière est déjà en cours : close-la d’abord.';
    case 'COMPLEMENTAIRE_SANS_OBJET': return 'Aucune enveloppe n’attend une séance complémentaire : elle suit l’échec d’une négociation.';
    case 'LOT_OBLIGATOIRE': return 'Précisez le lot de la séance complémentaire.';
    case 'MOTIF_OBLIGATOIRE': return 'Le motif est obligatoire.';
  }
  if (e.status === 403) return 'Ce geste revient au responsable de la procédure.';
  return e.message || 'Le geste n’a pas abouti.';
}

/**
 * ⚠️ **La seconde séance d'ouverture** (lot 3 PI, tranche PI-d1 — V88). Après l'arrêt de l'évaluation technique de chaque lot, elle
 * n'ouvre que les **enveloppes financières des propositions qualifiées** (en « qualité technique exclusivement » ou « qualification du
 * consultant », la seule du premier rang) ; les autres ne s'ouvrent jamais, et le disent. Le **responsable** l'ouvre, peut employer la part
 * de secours, puis la clôt (présents, observations) ; les **membres** apportent leurs parts, avec les mêmes clés que la première séance ;
 * le PV lit les notes techniques et les montants.
 */
@Component({
  selector: 'app-seance-financiere',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ApportParts],
  template: `
    <section class="card sf" aria-labelledby="sf-titre">
      <h2 id="sf-titre" class="sf__titre">Seconde séance d’ouverture — enveloppes financières</h2>
      @if (chargement()) {
        <p class="text-sm text-muted" role="status">Chargement de la séance…</p>
      } @else if (!seance()) {
        <p class="text-sm">Elle s’ouvre quand l’évaluation technique de chaque lot est arrêtée. Seules s’y ouvrent les enveloppes financières des propositions qualifiées ; les autres restent scellées.</p>
        @if (conduite()) {
          <div><button type="button" class="btn btn-primary btn-sm" [disabled]="travail()" (click)="ouvrir()">Ouvrir la seconde séance</button></div>
        }
      } @else if (seance(); as s) {
        <p class="sf__etat">
          <span class="badge" [class.badge-info]="s.etat === 'OUVERTE'" [class.badge-success]="s.etat !== 'OUVERTE'">{{ etats[s.etat] }}</span>
          @if (s.quorum) { <span class="text-sm">Quorum : <strong>{{ s.quorum }}</strong> détenteurs{{ s.secoursEmploye ? ' (part de secours employée)' : '' }}</span> }
          @if (s.methode) { <span class="text-sm text-muted">Méthode : {{ s.methode }}</span> }
          @if (s.ouverteLe) { <span class="text-sm text-muted">ouverte le {{ jj(s.ouverteLe) }}</span> }
        </p>

        <div class="table-card">
          <table class="sf__table">
            <caption class="cnm-sr-only">Les enveloppes financières à ouvrir</caption>
            <thead>
              <tr>
                <th scope="col">N°</th><th scope="col">Candidat</th><th scope="col">Lot</th><th scope="col">Note technique</th><th scope="col">Rang</th>
                @if (s.etat === 'OUVERTE') { <th scope="col">Parts reçues</th> } @else { <th scope="col">Intégrité</th><th scope="col">Montant HT lu</th><th scope="col">Montant TTC lu</th> }
              </tr>
            </thead>
            <tbody>
              @for (e of s.aOuvrir; track e.idOffre) {
                <tr>
                  <td>{{ e.numero ?? '—' }}</td><td>{{ e.raisonSociale || '—' }}</td><td>{{ e.lot ?? '—' }}</td>
                  <td>{{ e.noteTechnique ?? '—' }}</td><td>{{ e.rangTechnique ?? '—' }}</td>
                  @if (s.etat === 'OUVERTE') { <td>{{ e.partsRecues }}{{ s.quorum ? ' / ' + s.quorum : '' }}</td> }
                  @else { <td>{{ e.integrite || '—' }}</td><td>{{ ariary(montant(e, 'montantHt')) }}</td><td>{{ ariary(montant(e, 'montantTtc')) }}</td> }
                </tr>
              } @empty {
                <tr><td [attr.colspan]="s.etat === 'OUVERTE' ? 6 : 8" class="text-muted">Aucune enveloppe à ouvrir.</td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (s.nonOuvertes.length) {
          <div class="sf__non">
            <h3 class="sf__h3">Enveloppes qui ne s’ouvrent pas</h3>
            <ul>@for (n of s.nonOuvertes; track $index) { <li>N° {{ n.numero ?? '—' }} · {{ n.raisonSociale || '—' }}{{ n.lot ? ' (lot ' + n.lot + ')' : '' }} — {{ n.motif }}</li> }</ul>
          </div>
        }

        @if (message(); as m) { <div class="alert alert-danger" role="alert"><span>{{ m }}</span></div> }

        @if (s.etat === 'OUVERTE') {
          @if (detenteur()) {
            @if (apporte()) {
              <p class="text-sm" role="status">Vos parts sont apportées. Les enveloppes s’ouvriront dès que le quorum sera atteint.</p>
            } @else {
              <app-apport-parts [idDmc]="idDmc()" [financiere]="true" (apporteFinanciere)="apresApport($event)" />
            }
          }
          @if (conduite()) {
            <details class="sf__secours">
              <summary>Part de secours…</summary>
              <app-apport-parts [idDmc]="idDmc()" role="SECOURS" [financiere]="true" (apporteFinanciere)="apresApport($event, 'La part de secours est apportée.')" />
            </details>
          }
        }

        @if (s.etat === 'DECHIFFREE' && conduite()) {
          <fieldset class="sf__cloture">
            <legend class="form-label">Clore la séance et produire le procès-verbal</legend>
            @for (m of membres(); track m.membre) {
              <label class="sf__case"><input type="checkbox" [checked]="presents().has(m.membre)" (change)="basculer(m.membre, $any($event.target).checked)" /> {{ m.nom || m.membre }}{{ m.president ? ' — président' : '' }}</label>
            }
            <div class="sf__autre">
              <input class="form-control" type="text" placeholder="Nom d’un autre présent" aria-label="Nom d’un autre présent" [value]="autreNom()" (input)="autreNom.set($any($event.target).value)" />
              <input class="form-control" type="text" placeholder="Qualité (ex. représentant d’un candidat)" aria-label="Qualité de l’autre présent" [value]="autreQualite()" (input)="autreQualite.set($any($event.target).value)" />
              <button type="button" class="btn btn-sm btn-secondary" [disabled]="!autreNom().trim()" (click)="ajouterAutre()">Ajouter</button>
            </div>
            @if (autres().length) { <p class="text-sm">Autres présents : {{ autresTexte() }}</p> }
            <label class="form-group"><span class="form-label">Observations</span><textarea class="form-control" rows="3" [value]="observations()" (input)="observations.set($any($event.target).value)"></textarea></label>
            <div><button type="button" class="btn btn-primary btn-sm" [disabled]="travail() || !presents().size" (click)="cloturer()">Clore la séance</button></div>
          </fieldset>
        }

        @if (s.rondes.length > 1) {
          <!-- ⚠️ PI-d2a (V89) — une ronde par séance : la seconde, puis les complémentaires (négociation échouée). -->
          <ul class="sf__rondes">
            @for (r of s.rondes; track r.ronde) {
              <li>
                <span>{{ r.ronde === 1 ? 'Seconde séance' : 'Séance complémentaire n° ' + (r.ronde - 1) }} — {{ etats[r.etat] }}{{ r.motif ? ' · ' + r.motif : '' }}</span>
                @if (r.pvDisponible) { <button type="button" class="btn btn-ghost btn-sm" [disabled]="travail()" (click)="pv('pdf', r.ronde)">PV (PDF)</button> }
              </li>
            }
          </ul>
        } @else if (s.pvDisponible) {
          <div class="sf__pv">
            <button type="button" class="btn btn-outline btn-sm" [disabled]="travail()" (click)="pv('pdf')">PV de la seconde séance (PDF)</button>
            <button type="button" class="btn btn-outline btn-sm" [disabled]="travail()" (click)="pv('docx')">PV (Word)</button>
          </div>
        }

        @if (s.etat === 'CLOSE' && conduite()) {
          <details class="sf__secours">
            <summary>Séance complémentaire…</summary>
            <div class="sf__complementaire">
              <p class="text-sm text-muted">Après l’échec d’une négociation (qualité technique exclusivement, qualification du consultant), elle ouvre la seule enveloppe financière du classé suivant, avec les mêmes clés et le même quorum.</p>
              <label class="form-group"><span class="form-label">Lot (si le marché est alloti)</span><input class="form-control sf__lot" type="number" min="1" [value]="lotComplementaire() ?? ''" (input)="lotComplementaire.set(+$any($event.target).value || null)" /></label>
              <label class="form-group"><span class="form-label">Motif (imprimé au PV)</span><input class="form-control" type="text" [value]="motifComplementaire()" (input)="motifComplementaire.set($any($event.target).value)" /></label>
              <div><button type="button" class="btn btn-primary btn-sm" [disabled]="!motifComplementaire().trim() || travail()" (click)="complementaire()">Ouvrir la séance complémentaire</button></div>
            </div>
          </details>
        }
      }
    </section>
  `,
  styles: `
    .sf { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .sf__titre { margin: 0; font-size: 1.05rem; }
    .sf__h3 { margin: 0 0 0.3rem; font-size: 0.9rem; }
    .sf__etat { margin: 0; display: flex; gap: 0.7rem; align-items: center; flex-wrap: wrap; }
    .sf__table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .sf__table th, .sf__table td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--n-200); }
    .sf__non ul { margin: 0; padding-left: 1.2rem; font-size: var(--text-sm); }
    .sf__cloture { border: 1px solid var(--n-200); border-radius: 8px; padding: 0.6rem 0.8rem; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .sf__case { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); }
    .sf__autre { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .sf__autre .form-control { flex: 1 1 12rem; }
    .sf__secours summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
    .sf__pv { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .sf__rondes { margin: 0; padding-left: 1.2rem; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 0.2rem; }
    .sf__complementaire { display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.4rem; }
    .sf__lot { max-width: 8rem; }
  `,
})
export class SeanceFinanciereVue implements OnInit, OnDestroy {
  private readonly service = inject(EvaluationPiService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  readonly droits = input.required<DroitsEvaluation>();
  readonly espace = input.required<EspaceEvaluation>();
  readonly membres = input<MembreSeance[]>([]);
  /** L'état de la séance a changé (ouverte, déchiffrée, close, nouvelle ronde) : l'écran relit l'évaluation financière. */
  readonly etatChange = output<SeanceFinanciere>();

  readonly etats = LIBELLES_ETAT;
  readonly jj = dateHeureFr;
  readonly ariary = ariary;
  readonly montant = montantLu;

  readonly chargement = signal(true);
  readonly seance = signal<SeanceFinanciere | null>(null);
  readonly message = signal<string | null>(null);
  readonly travail = signal(false);
  readonly apporte = signal(false);
  readonly presents = signal<Set<string>>(new Set());
  readonly autres = signal<{ nom: string; qualite: string | null }[]>([]);
  readonly autreNom = signal('');
  readonly autreQualite = signal('');
  readonly observations = signal('');
  readonly lotComplementaire = signal<number | null>(null);
  readonly motifComplementaire = signal('');

  /** Le responsable conduit (coquille interne) ; un membre de la commission détient une part (espace CAO). */
  readonly conduite = computed(() => this.espace() === 'interne' && this.droits().responsable);
  readonly detenteur = computed(() => this.espace() === 'cao' && this.droits().membre);
  readonly autresTexte = computed(() => this.autres().map((a) => a.nom + (a.qualite ? ' (' + a.qualite + ')' : '')).join(', '));
  private sondage: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    this.lire();
    // Tant que les parts arrivent, l'état se relit toutes les cinq secondes (comme la première séance).
    this.sondage = setInterval(() => {
      if (this.seance()?.etat === 'OUVERTE') this.lire();
    }, 5000);
  }

  ngOnDestroy(): void {
    clearInterval(this.sondage);
  }

  lire(): void {
    this.service.seanceFinanciere(this.idDmc()).subscribe({
      next: (s) => this.recevoir(s),
      error: () => {
        this.seance.set(null);
        this.chargement.set(false);
      },
    });
  }

  private recevoir(s: SeanceFinanciere): void {
    const avant = this.seance();
    const premiere = !avant;
    this.seance.set(s);
    if (avant && (avant.etat !== s.etat || avant.ronde !== s.ronde)) this.etatChange.emit(s);
    this.chargement.set(false);
    if (premiere && s.presents.length) this.presents.set(new Set(s.presents));
  }

  ouvrir(): void {
    this.geste(this.service.ouvrirSeanceFinanciere(this.idDmc()), 'Seconde séance ouverte : les détenteurs apportent leurs parts.');
  }

  apresApport(s: SeanceFinanciere, texte = 'Vos parts sont apportées.'): void {
    this.apporte.set(true);
    this.recevoir(s);
    this.toast.success(texte);
  }

  basculer(im: string, present: boolean): void {
    this.presents.update((p) => {
      const n = new Set(p);
      if (present) n.add(im);
      else n.delete(im);
      return n;
    });
  }

  ajouterAutre(): void {
    this.autres.update((l) => [...l, { nom: this.autreNom().trim(), qualite: this.autreQualite().trim() || null }]);
    this.autreNom.set('');
    this.autreQualite.set('');
  }

  cloturer(): void {
    this.geste(
      this.service.cloturerSeanceFinanciere(this.idDmc(), [...this.presents()], this.autres(), this.observations().trim() || null),
      'Séance close : le procès-verbal est produit.',
    );
  }

  /** ⚠️ PI-d2a — la séance complémentaire : une nouvelle ronde pour l'enveloppe du classé suivant. */
  complementaire(): void {
    this.apporte.set(false);
    this.geste(this.service.seanceComplementaire(this.idDmc(), this.lotComplementaire(), this.motifComplementaire().trim()), 'Séance complémentaire ouverte : les détenteurs apportent leurs parts.');
    this.motifComplementaire.set('');
  }

  pv(format: 'pdf' | 'docx', ronde?: number): void {
    this.travail.set(true);
    this.service.pvSeanceFinanciere(this.idDmc(), format, ronde).subscribe({
      next: (b) => {
        this.travail.set(false);
        telechargerBlob(b, `pv-ouverture-financiere-${this.idDmc()}${ronde && ronde > 1 ? '-complementaire-' + (ronde - 1) : ''}.${format}`);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.message.set(refusSeanceFinanciere(e));
      },
    });
  }

  private geste(appel: ReturnType<EvaluationPiService['ouvrirSeanceFinanciere']>, succes: string): void {
    this.travail.set(true);
    this.message.set(null);
    appel.subscribe({
      next: (s) => {
        this.travail.set(false);
        this.recevoir(s);
        this.toast.success(succes);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.message.set(refusSeanceFinanciere(e));
      },
    });
  }
}
