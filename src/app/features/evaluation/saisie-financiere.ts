import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Correction, Financiere, PropositionFinanciere, RegleCorrection } from '../../models';
import { EvaluationPiService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { LIBELLES_REGLE, ariary } from './libelles-evaluation';
import { LIBELLES_STATUT_FINANCIER, refusPi } from './libelles-pi';

interface CorrectionEditee extends Correction {
  cle: number;
  proposee: boolean;
}

/** Le montant comparé, tel que le serveur le calculera : prix corrigé − dépenses remboursables (indicatif, l'écran ne décide rien). */
export function montantCompareIndicatif(prixCorrige: number | null, remboursables: number | null): number | null {
  return prixCorrige == null ? null : prixCorrige - (remboursables ?? 0);
}

/**
 * ⚠️ **L'évaluation d'une enveloppe financière** (lot 3 PI, PI-d2a — V89 ; DPIC-PI §9.4-9.5). Les règles de correction sont celles
 * des offres (le prix unitaire prévaut, les lettres sur les chiffres) ; s'y ajoutent les **dépenses remboursables**, saisies par la
 * commission (arbitrage du 08/10), retirées du prix corrigé pour former le **montant comparé**. Le refus d'une correction par le
 * candidat écarte la proposition. Le serveur calcule et classe.
 */
@Component({
  selector: 'app-saisie-financiere',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = proposition();
    @let s = p.saisie;
    <article class="card sfi" [attr.aria-label]="'Proposition n° ' + (p.numero ?? '?')">
      <header class="sfi__tete">
        <h3 class="sfi__titre">Proposition n° {{ p.numero ?? '—' }} · {{ p.raisonSociale || p.nif }}</h3>
        <span class="badge" [class.badge-success]="p.statut === 'EVALUEE'" [class.badge-danger]="p.statut === 'ECARTEE' || p.statut === 'HORS_BUDGET'" [class.badge-warning]="p.statut === 'A_EVALUER'" [class.badge-neutral]="p.statut === 'NON_OUVERTE'">{{ statuts[p.statut] }}</span>
        @if (p.rang) { <span class="badge badge-primary">Rang {{ p.rang }}{{ p.egalite ? ' (ex aequo)' : '' }}</span> }
      </header>
      @if (p.motif) { <p class="text-sm sfi__motif">{{ p.motif }}</p> }
      @if (s) {
        <dl class="sfi__resultat">
          <dt>Prix lu (HT)</dt><dd>{{ ariary(s.prixLu) }}</dd>
          <dt>Prix corrigé (HT)</dt><dd>{{ ariary(s.prixCorrige) }}</dd>
          <dt>Dépenses remboursables</dt><dd>{{ ariary(s.remboursables ?? 0) }}</dd>
          <dt>Montant comparé</dt><dd><strong>{{ ariary(p.montantCompare) }}</strong></dd>
        </dl>
        @if (s.nom) { <p class="text-sm text-muted sfi__auteur">Saisi par {{ s.nom }}, le {{ dateHeure(s.le) }}.</p> }
      }
      @if (!p.financiereOuverte) {
        <p class="text-sm text-muted">Son enveloppe financière n’est pas ouverte.</p>
      } @else {
        <details class="sfi__saisie" [open]="modifiable() && !s" (toggle)="ouvert($any($event.target).open)">
          <summary>{{ modifiable() ? 'Corrections et dépenses remboursables' : 'Le détail' }}</summary>
          <div class="sfi__corps">
            <h4 class="sfi__h4">Corrections arithmétiques</h4>
            @if (corrections().length) {
              <div class="cnm-table-wrap">
                <table class="cnm-table" aria-label="Corrections arithmétiques">
                  <thead><tr><th scope="col">Retenue</th><th scope="col">Règle</th><th scope="col">Libellé</th><th scope="col">Avant</th><th scope="col">Après</th><th scope="col"><span class="sr-only">Retirer</span></th></tr></thead>
                  <tbody>
                    @for (k of corrections(); track k.cle) {
                      <tr>
                        <td><input type="checkbox" [attr.aria-label]="'Retenir : ' + k.libelle" [checked]="k.retenue" [disabled]="!modifiable()" (change)="retenir(k.cle, $any($event.target).checked)" /></td>
                        <td class="text-sm">{{ regles[k.regle] }}{{ k.proposee ? ' (proposée)' : '' }}</td>
                        <td>{{ k.libelle }}</td>
                        <td class="sfi__num">{{ ariary(k.avant) }}</td>
                        <td class="sfi__num">{{ ariary(k.apres) }}</td>
                        <td>@if (!k.proposee && modifiable()) { <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer la correction ' + k.libelle" (click)="retirer(k.cle)">✕</button> }</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else if (correctionsChargees()) {
              <p class="text-sm text-muted">Aucune correction proposée.</p>
            }
            @if (modifiable()) {
              <div class="sfi__ajout">
                <label class="form-group"><span class="form-label">Règle</span>
                  <select class="form-control form-control-sm" (change)="regleAjout.set($any($event.target).value)">
                    <option value="REPORT" [selected]="regleAjout() === 'REPORT'">{{ regles.REPORT }}</option>
                    <option value="AUTRE" [selected]="regleAjout() === 'AUTRE'">{{ regles.AUTRE }}</option>
                  </select>
                </label>
                <label class="form-group"><span class="form-label">Libellé</span><input class="form-control form-control-sm" type="text" [value]="libelleAjout()" (input)="libelleAjout.set($any($event.target).value)" /></label>
                <label class="form-group"><span class="form-label">Avant (Ar HT)</span><input class="form-control form-control-sm" type="number" [value]="avantAjout() ?? ''" (input)="avantAjout.set(nombre($any($event.target).value))" /></label>
                <label class="form-group"><span class="form-label">Après (Ar HT)</span><input class="form-control form-control-sm" type="number" [value]="apresAjout() ?? ''" (input)="apresAjout.set(nombre($any($event.target).value))" /></label>
                <button type="button" class="btn btn-outline btn-sm" [disabled]="!libelleAjout().trim() || avantAjout() == null || apresAjout() == null" (click)="ajouter()">Ajouter la correction</button>
              </div>
            }
            @if (prixLuDemande() || (s && s.prixLu == null)) {
              <label class="form-group"><span class="form-label">Prix lu hors taxes (l’acte d’engagement n’en porte pas)</span>
                <input class="form-control" type="number" [value]="prixLu() ?? ''" [disabled]="!modifiable()" (input)="prixLu.set(nombre($any($event.target).value))" />
              </label>
            }
            <fieldset class="sfi__bloc">
              <legend class="form-label">Dépenses remboursables (Ar HT)</legend>
              <p class="text-sm text-muted sfi__aide">Saisies par la commission : elles sont retirées du prix corrigé pour comparer les propositions, sans changer le prix du marché.</p>
              <div class="sfi__ligne">
                <input class="form-control" type="number" min="0" aria-label="Dépenses remboursables" [value]="remboursables() ?? ''" [disabled]="!modifiable()" (input)="remboursables.set(nombre($any($event.target).value))" />
                <input class="form-control" type="text" aria-label="Justification des dépenses remboursables" placeholder="Justification (facultative)" [value]="motifRemboursables()" [disabled]="!modifiable()" (input)="motifRemboursables.set($any($event.target).value)" />
              </div>
              @if (s?.prixCorrige != null) { <p class="text-sm sfi__aide">Montant comparé (indicatif) : {{ ariary(indicatif()) }}</p> }
            </fieldset>
            <fieldset class="sfi__bloc">
              <legend class="form-label">Refus de la correction par le candidat</legend>
              <label class="sfi__case"><input type="checkbox" [checked]="refus()" [disabled]="!modifiable()" (change)="refus.set($any($event.target).checked)" /> Le candidat refuse la correction : sa proposition est écartée</label>
              @if (refus()) {
                <div class="sfi__ligne">
                  <input class="form-control form-control-sm" type="text" aria-label="Motif du refus" placeholder="Motif" [value]="motifRefus()" [disabled]="!modifiable()" (input)="motifRefus.set($any($event.target).value)" />
                  <input class="form-control form-control-sm" type="text" aria-label="Clause de la demande de propositions" placeholder="Clause" [value]="clauseRefus()" [disabled]="!modifiable()" (input)="clauseRefus.set($any($event.target).value)" />
                </div>
              }
            </fieldset>
            @if (modifiable()) {
              <div class="sfi__actions"><button type="button" class="btn btn-primary btn-sm" [disabled]="travail()" (click)="enregistrer()">{{ refus() ? 'Écarter la proposition' : 'Enregistrer et classer' }}</button></div>
            }
          </div>
        </details>
      }
      @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
    </article>
  `,
  styles: `
    .sfi { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .sfi__tete { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .sfi__titre { margin: 0; font-size: 1rem; flex: 1 1 auto; }
    .sfi__motif { margin: 0; color: var(--danger-700, #b42318); }
    .sfi__resultat { display: grid; grid-template-columns: repeat(4, auto); gap: 0.15rem 0.8rem; margin: 0; font-size: var(--text-sm); }
    .sfi__resultat dt { color: var(--n-500); }
    .sfi__resultat dd { margin: 0; }
    .sfi__auteur, .sfi__aide { margin: 0; }
    .sfi__saisie summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
    .sfi__corps { display: flex; flex-direction: column; gap: 0.6rem; padding-top: 0.5rem; }
    .sfi__h4 { margin: 0; font-size: 0.9rem; }
    .sfi__num { text-align: right; white-space: nowrap; }
    .sfi__ajout { display: grid; grid-template-columns: 1fr 2fr 1fr 1fr auto; gap: 0.4rem; align-items: end; }
    .sfi__bloc { border: 1px solid var(--n-200); border-radius: 6px; padding: 0.5rem 0.7rem; display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
    .sfi__ligne { display: grid; grid-template-columns: 1fr 2fr; gap: 0.4rem; }
    .sfi__case { display: inline-flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); }
    .sfi__actions { display: flex; justify-content: flex-end; }
    @media (max-width: 900px) { .sfi__ajout, .sfi__ligne { grid-template-columns: 1fr; } .sfi__resultat { grid-template-columns: repeat(2, auto); } }
  `,
})
export class SaisieFinanciereVue implements OnInit {
  readonly idDmc = input.required<number>();
  readonly proposition = input.required<PropositionFinanciere>();
  /** Le membre décide (déclaré sans conflit) ; le classement du lot n'est pas arrêté. */
  readonly modifiable = input(false);
  readonly maj = output<Financiere>();

  private readonly service = inject(EvaluationPiService);
  private readonly toast = inject(ToastService);

  readonly regles = LIBELLES_REGLE;
  readonly statuts = LIBELLES_STATUT_FINANCIER;
  readonly ariary = ariary;
  readonly dateHeure = dateHeureFr;

  private cle = 0;
  readonly corrections = signal<CorrectionEditee[]>([]);
  readonly correctionsChargees = signal(false);
  readonly regleAjout = signal<RegleCorrection>('REPORT');
  readonly libelleAjout = signal('');
  readonly avantAjout = signal<number | null>(null);
  readonly apresAjout = signal<number | null>(null);
  readonly prixLu = signal<number | null>(null);
  readonly prixLuDemande = signal(false);
  readonly remboursables = signal<number | null>(0);
  readonly motifRemboursables = signal('');
  readonly refus = signal(false);
  readonly motifRefus = signal('');
  readonly clauseRefus = signal('');
  readonly travail = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly indicatif = computed(() => montantCompareIndicatif(this.proposition().saisie?.prixCorrige ?? null, this.remboursables()));

  ngOnInit(): void {
    const s = this.proposition().saisie;
    if (!s) return;
    // Une saisie existe : elle fait foi (corrections comprises) ; les propositions ne se rechargent pas par-dessus.
    this.corrections.set(s.corrections.map((k) => ({ ...k, retenue: k.retenue ?? true, cle: ++this.cle, proposee: k.regle === 'PU_PREVAUT' || k.regle === 'LETTRES_PREVALENT' })));
    this.correctionsChargees.set(true);
    this.prixLu.set(s.prixLu);
    this.remboursables.set(s.remboursables ?? 0);
    this.motifRemboursables.set(s.motifRemboursables ?? '');
    this.refus.set(!!s.refus);
    this.motifRefus.set(s.refus?.motif ?? '');
    this.clauseRefus.set(s.refus?.clause ?? '');
  }

  ouvert(o: boolean): void {
    const id = this.proposition().idFinanciere;
    if (!o || this.correctionsChargees() || !id) return;
    this.service.correctionsFinancieres(this.idDmc(), id).subscribe({
      next: (l) => {
        this.corrections.set(l.map((k) => ({ ...k, retenue: true, cle: ++this.cle, proposee: true })));
        this.correctionsChargees.set(true);
      },
      error: (e: ApiError) => {
        this.correctionsChargees.set(true);
        this.erreur.set(refusPi(e));
      },
    });
  }

  nombre(v: string): number | null {
    return v === '' || v == null || isNaN(+v) ? null : +v;
  }

  retenir(cle: number, retenue: boolean): void {
    this.corrections.update((l) => l.map((k) => (k.cle === cle ? { ...k, retenue } : k)));
  }

  retirer(cle: number): void {
    this.corrections.update((l) => l.filter((k) => k.cle !== cle));
  }

  ajouter(): void {
    this.corrections.update((l) => [...l, { cle: ++this.cle, proposee: false, ligne: null, libelle: this.libelleAjout().trim(), avant: this.avantAjout()!, apres: this.apresAjout()!, regle: this.regleAjout(), retenue: true }]);
    this.libelleAjout.set('');
    this.avantAjout.set(null);
    this.apresAjout.set(null);
  }

  enregistrer(): void {
    const id = this.proposition().idFinanciere;
    if (!id) return;
    const refus = this.refus();
    this.travail.set(true);
    this.erreur.set(null);
    this.service
      .saisirFinanciere(this.idDmc(), id, {
        prixLu: this.prixLu(),
        corrections: this.corrections().map(({ ligne, libelle, avant, apres, regle, retenue }) => ({ ligne, libelle, avant, apres, regle, retenue })),
        remboursables: this.remboursables() ?? 0,
        motifRemboursables: this.motifRemboursables().trim() || null,
        refusCandidat: refus ? { motif: this.motifRefus().trim(), clause: this.clauseRefus().trim() } : null,
      })
      .subscribe({
        next: (f) => {
          this.travail.set(false);
          this.toast.success(refus ? 'La proposition est écartée : le refus est porté au rapport.' : 'Le montant comparé est calculé ; le classement est à jour.');
          this.maj.emit(f);
        },
        error: (e: ApiError) => {
          this.travail.set(false);
          if (codeErreur(e) === 'PRIX_LU_OBLIGATOIRE') this.prixLuDemande.set(true);
          this.erreur.set(refusPi(e));
        },
      });
  }
}
