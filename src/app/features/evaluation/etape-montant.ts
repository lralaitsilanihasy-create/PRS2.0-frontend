import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Correction, CritereMonetise, Evaluation, LigneTableau, LotEvaluation, OffreEvaluee, RegleCorrection } from '../../models';
import { EvaluationService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { DroitsEvaluation } from './droits-evaluation';
import { LIBELLES_REGLE, ariary, refusEvaluation } from './libelles-evaluation';

/** Une correction à l'écran : la proposée du serveur, ou une saisie de la CAO (règle `REPORT` ou `AUTRE`). */
interface CorrectionEditee extends Correction {
  cle: number;
  proposee: boolean;
}

/**
 * Le **montant évalué** d'une offre (étape 3 du guide, art. 47-II) : les corrections arithmétiques proposées par le serveur
 * depuis le bordereau scellé (retenues ou non), celles que la CAO saisit, le refus éventuel du candidat (Q2 : constaté par la
 * CAO), le rabais en valeur hors taxes (Q4), l'éligibilité à la préférence (Q8) et les critères additionnels du DAO. Le serveur
 * calcule le prix corrigé et le montant évalué (hors taxes, Q3) : l'écran ne refait aucun calcul.
 */
@Component({
  selector: 'app-montant-offre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let o = offre();
    @let ev = o.evaluation;
    <article class="card mo" [attr.aria-label]="'Offre n° ' + (o.numero ?? '?')">
      <header class="mo__tete">
        <h3 class="mo__titre">Offre n° {{ o.numero ?? '—' }} · {{ o.entreprise.raisonSociale }}</h3>
        @if (o.rang) { <span class="badge badge-primary">Rang {{ o.rang }}{{ o.exAequo ? ' (ex aequo)' : '' }}</span> }
        @if (o.ecartee?.etape === 'EVALUATION') { <span class="badge badge-danger">Écartée : refus de la correction</span> }
        @else if (!ev) { <span class="badge badge-warning">Montant à évaluer</span> }
      </header>
      @if (ev) {
        <dl class="mo__resultat">
          <dt>Prix lu (HT)</dt><dd>{{ ariary(ev.prixLu) }}</dd>
          <dt>Prix lu (TTC)</dt><dd>{{ ariary(ev.prixLuTtc) }}</dd>
          <dt>Prix corrigé (HT)</dt><dd>{{ ariary(ev.prixCorrige) }}</dd>
          <dt>Rabais</dt><dd>{{ ariary(ev.rabais?.montant ?? 0) }}</dd>
          <dt>Préférence</dt><dd>{{ ev.preference ? (ev.preference.eligible ? 'éligible' : 'ajustement ' + ariary(ev.preference.ajustement ?? 0)) : '—' }}</dd>
          <dt>Montant évalué</dt><dd><strong>{{ ariary(ev.montantEvalue) }}</strong></dd>
        </dl>
        @if (ev.nom) { <p class="text-sm text-muted mo__auteur">Saisi par {{ ev.nom }}, le {{ dateHeure(ev.le) }}.</p> }
      }

      <details class="mo__saisie" [open]="modifiable() && !ev" (toggle)="ouvert($any($event.target).open)">
        <summary>{{ modifiable() ? 'Corrections, rabais, préférence, critères' : 'Le détail' }}</summary>
        <div class="mo__corps">
          <h4 class="mo__h4">Corrections arithmétiques</h4>
          <p class="text-sm text-muted mo__aide">Les règles sont celles des Instructions aux candidats : le prix unitaire prévaut sur le total, les lettres sur les chiffres. Montants hors taxes.</p>
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
                      <td class="mo__num">{{ ariary(k.avant) }}</td>
                      <td class="mo__num">{{ ariary(k.apres) }}</td>
                      <td>@if (!k.proposee && modifiable()) { <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer la correction ' + k.libelle" (click)="retirer(k.cle)">✕</button> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else if (correctionsChargees()) {
            <p class="text-sm text-muted">Aucune correction proposée (offre sans écart relevé, ou déposée sans bordereau en ligne).</p>
          }
          @if (modifiable()) {
            <div class="mo__ajout">
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

          @if (prixLuDemande() || ev?.prixLu == null && modifiable() && ev) {
            <label class="form-group mo__prixlu"><span class="form-label">Prix lu hors taxes (l'acte d'engagement n'en porte pas)</span>
              <input class="form-control" type="number" [value]="prixLu() ?? ''" (input)="prixLu.set(nombre($any($event.target).value))" [disabled]="!modifiable()" />
            </label>
          }

          <div class="mo__grille">
            <fieldset class="mo__bloc">
              <legend class="form-label">Rabais</legend>
              @if (declare(); as d) { <p class="text-sm mo__aide">Déclaré par le candidat : « {{ d.lecture || d.libelle }} »</p> }
              @if (conditionnel()) {
                <!-- 07/10 (Q2, au juriste) — un rabais lié à plusieurs lots n'est jamais appliqué à l'évaluation lot par lot. -->
                <p class="text-sm">Rabais lié à l'attribution de plusieurs lots : <strong>non appliqué</strong> à l'évaluation lot par lot ; il est repris au rapport.</p>
              } @else {
                <label class="form-group"><span class="form-label">Montant retenu (Ar HT){{ propose() != null ? ' — proposé : ' + ariary(propose()) : '' }}</span><input class="form-control" type="number" min="0" [value]="rabais() ?? ''" [disabled]="!modifiable()" (input)="rabais.set(nombre($any($event.target).value))" /></label>
                @if (corrige()) {
                  <label class="form-group"><span class="form-label">Motif de la correction du rabais proposé</span><input class="form-control" type="text" [value]="motifRabais()" [disabled]="!modifiable()" (input)="motifRabais.set($any($event.target).value)" /></label>
                }
                @if (!structure()) {
                  <label class="form-group"><span class="form-label">Lecture du rabais offert</span><input class="form-control" type="text" [value]="lectureRabais()" [disabled]="!modifiable()" (input)="lectureRabais.set($any($event.target).value)" /></label>
                }
              }
            </fieldset>
            <fieldset class="mo__bloc">
              <legend class="form-label">Marge de préférence (si le DAO la prévoit)</legend>
              <label class="mo__case"><input type="checkbox" [checked]="eligible()" [disabled]="!modifiable()" (change)="eligible.set($any($event.target).checked)" /> Offre éligible à la préférence</label>
              @if (eligible()) {
                <label class="form-group"><span class="form-label">Motif de l'éligibilité</span><input class="form-control" type="text" [value]="motifPreference()" [disabled]="!modifiable()" (input)="motifPreference.set($any($event.target).value)" /></label>
              }
              <p class="text-sm text-muted mo__aide">La préférence sert à comparer : le serveur ajoute l'ajustement aux offres non éligibles. Elle ne change jamais le prix du marché.</p>
            </fieldset>
          </div>

          <fieldset class="mo__bloc">
            <legend class="form-label">Critères additionnels monétisés (seulement ceux du DAO)</legend>
            @for (k of criteres(); track $index) {
              <div class="mo__critere">
                <input class="form-control form-control-sm" type="text" aria-label="Critère" placeholder="Critère du DAO" [value]="k.libelle" [disabled]="!modifiable()" (input)="critere($index, 'libelle', $any($event.target).value)" />
                <input class="form-control form-control-sm" type="number" aria-label="Montant du critère (Ar HT)" placeholder="Montant (Ar HT)" [value]="k.montant" [disabled]="!modifiable()" (input)="critere($index, 'montant', $any($event.target).value)" />
                <input class="form-control form-control-sm" type="text" aria-label="Justification" placeholder="Justification" [value]="k.justification" [disabled]="!modifiable()" (input)="critere($index, 'justification', $any($event.target).value)" />
                @if (modifiable()) { <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer le critère ' + ($index + 1)" (click)="retirerCritere($index)">✕</button> }
              </div>
            }
            @if (modifiable()) { <button type="button" class="btn btn-ghost btn-sm mo__plus" (click)="ajouterCritere()">+ Critère</button> }
          </fieldset>

          <fieldset class="mo__bloc">
            <legend class="form-label">Refus de la correction par le candidat (Q2 : constaté par la CAO)</legend>
            <label class="mo__case"><input type="checkbox" [checked]="refus()" [disabled]="!modifiable()" (change)="refus.set($any($event.target).checked)" /> Le candidat refuse la correction : son offre est écartée si les IC le prévoient</label>
            @if (refus()) {
              <div class="mo__critere mo__refus">
                <input class="form-control form-control-sm" type="text" aria-label="Motif du refus" placeholder="Motif" [value]="motifRefus()" [disabled]="!modifiable()" (input)="motifRefus.set($any($event.target).value)" />
                <input class="form-control form-control-sm" type="text" aria-label="Clause des IC" placeholder="Clause des IC" [value]="clauseRefus()" [disabled]="!modifiable()" (input)="clauseRefus.set($any($event.target).value)" />
              </div>
            }
          </fieldset>

          @if (modifiable()) {
            <div class="mo__actions"><button type="button" class="btn btn-primary btn-sm" [disabled]="travail()" (click)="enregistrer()">{{ refus() ? 'Écarter l’offre' : 'Enregistrer et calculer le montant évalué' }}</button></div>
          }
        </div>
      </details>
      @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
    </article>
  `,
  styles: `
    .mo { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .mo__tete { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .mo__titre { margin: 0; font-size: 1rem; flex: 1 1 auto; }
    .mo__resultat { display: grid; grid-template-columns: repeat(6, auto); gap: 0.15rem 0.8rem; margin: 0; font-size: var(--text-sm); }
    .mo__resultat dt { color: var(--n-500); }
    .mo__resultat dd { margin: 0; }
    .mo__auteur, .mo__aide { margin: 0; }
    .mo__saisie summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
    .mo__corps { display: flex; flex-direction: column; gap: 0.6rem; padding-top: 0.5rem; }
    .mo__h4 { margin: 0; font-size: 0.9rem; }
    .mo__num { text-align: right; white-space: nowrap; }
    .mo__ajout { display: grid; grid-template-columns: 1fr 2fr 1fr 1fr auto; gap: 0.4rem; align-items: end; }
    .mo__grille { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
    .mo__bloc { border: 1px solid var(--n-200); border-radius: 6px; padding: 0.5rem 0.7rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .mo__case { display: inline-flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); }
    .mo__critere { display: grid; grid-template-columns: 2fr 1fr 2fr auto; gap: 0.4rem; }
    .mo__refus { grid-template-columns: 2fr 1fr; }
    .mo__plus { align-self: flex-start; }
    .mo__actions { display: flex; justify-content: flex-end; }
    @media (max-width: 900px) { .mo__ajout, .mo__grille, .mo__critere { grid-template-columns: 1fr; } .mo__resultat { grid-template-columns: repeat(2, auto); } }
  `,
})
export class MontantOffre implements OnInit {
  readonly idDmc = input.required<number>();
  readonly offre = input.required<OffreEvaluee>();
  readonly droits = input.required<DroitsEvaluation>();
  readonly figee = input(false);
  readonly maj = output<Evaluation>();

  private readonly service = inject(EvaluationService);
  private readonly toast = inject(ToastService);

  readonly regles = LIBELLES_REGLE;
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
  readonly rabais = signal<number | null>(null);
  readonly lectureRabais = signal('');
  readonly eligible = signal(false);
  readonly motifPreference = signal('');
  readonly criteres = signal<CritereMonetise[]>([]);
  readonly refus = signal(false);
  readonly motifRefus = signal('');
  readonly clauseRefus = signal('');
  readonly travail = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly modifiable = computed(() => this.droits().decider && !this.figee() && this.offre().ecartee?.etape !== 'CONFORMITE');
  readonly motifRabais = signal('');
  /** ⚠️ 07/10 — le rabais déclaré (structuré, ou texte des offres plus anciennes), lu en séance. */
  readonly declare = computed(() => this.offre().rabaisDeclare ?? null);
  /** Le rabais déclaré est-il structuré (pourcentage ou montant) ? Sinon, la CAO le saisit comme avant. */
  readonly structure = computed(() => !!(this.offre().evaluation?.rabais?.nature ?? this.declare()?.nature));
  readonly conditionnel = computed(() => (this.offre().evaluation?.rabais?.condition ?? this.declare()?.condition) === 'LOTS');
  /** La proposition : celle du serveur après une saisie (sur le prix corrigé), sinon celle de la séance (sur le HT lu). */
  readonly propose = computed(() => (this.structure() ? this.offre().evaluation?.rabais?.propose ?? this.declare()?.montant ?? null : null));
  readonly corrige = computed(() => this.structure() && this.propose() != null && this.rabais() != null && this.rabais() !== this.propose());

  ngOnInit(): void {
    const ev = this.offre().evaluation;
    // Avant toute saisie, le rabais structuré déclaré pré-remplit le montant (le serveur le recalcule sur le prix corrigé).
    if (!ev) {
      const d = this.offre().rabaisDeclare;
      if (d?.nature && d.condition !== 'LOTS' && d.montant != null) this.rabais.set(d.montant);
      return;
    }
    // Une saisie existe : elle fait foi (corrections comprises) ; les propositions ne se rechargent pas par-dessus.
    this.corrections.set(ev.corrections.map((k) => ({ ...k, retenue: k.retenue ?? true, cle: ++this.cle, proposee: k.regle === 'PU_PREVAUT' || k.regle === 'LETTRES_PREVALENT' })));
    this.correctionsChargees.set(true);
    this.prixLu.set(ev.prixLu);
    this.rabais.set(ev.rabais?.montant ?? null);
    this.motifRabais.set(ev.rabais?.motif ?? '');
    this.lectureRabais.set(ev.rabais?.lecture ?? '');
    this.eligible.set(!!ev.preference?.eligible);
    this.motifPreference.set(ev.preference?.motif ?? '');
    this.criteres.set(ev.criteres.map((k) => ({ ...k })));
    this.refus.set(!!ev.refusCandidat);
    this.motifRefus.set(ev.refusCandidat?.motif ?? '');
    this.clauseRefus.set(ev.refusCandidat?.clause ?? '');
  }

  ouvert(o: boolean): void {
    if (o && !this.correctionsChargees()) {
      this.service.correctionsProposees(this.idDmc(), this.offre().idOffre).subscribe({
        next: (l) => {
          this.corrections.set(l.map((k) => ({ ...k, retenue: true, cle: ++this.cle, proposee: true })));
          this.correctionsChargees.set(true);
        },
        error: (e: ApiError) => {
          this.correctionsChargees.set(true);
          this.erreur.set(refusEvaluation(e));
        },
      });
    }
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

  critere(i: number, champ: keyof CritereMonetise, valeur: string): void {
    this.criteres.update((l) => l.map((k, j) => (j === i ? { ...k, [champ]: champ === 'montant' ? +valeur || 0 : valeur } : k)));
  }

  ajouterCritere(): void {
    this.criteres.update((l) => [...l, { libelle: '', montant: 0, justification: '' }]);
  }

  retirerCritere(i: number): void {
    this.criteres.update((l) => l.filter((_, j) => j !== i));
  }

  enregistrer(): void {
    this.travail.set(true);
    this.erreur.set(null);
    const refus = this.refus();
    this.service
      .montant(this.idDmc(), this.offre().idOffre, {
        prixLu: this.prixLu(),
        corrections: this.corrections().map(({ ligne, libelle, avant, apres, regle, retenue }) => ({ ligne, libelle, avant, apres, regle, retenue })),
        refusCandidat: refus ? { motif: this.motifRefus().trim(), clause: this.clauseRefus().trim() } : null,
        // Un rabais conditionnel ne se saisit pas (400 RABAIS_CONDITIONNEL) ; un montant égal à la proposition se passe de motif.
        rabais: this.conditionnel() || this.rabais() == null ? null : { montant: this.rabais()!, lecture: this.lectureRabais().trim() || null, motif: this.corrige() ? this.motifRabais().trim() || null : null },
        preference: this.eligible() ? { eligible: true, motif: this.motifPreference().trim() || null } : null,
        criteres: this.criteres().length ? this.criteres() : undefined,
      })
      .subscribe({
        next: (ev) => {
          this.travail.set(false);
          this.toast.success(refus ? 'L’offre est écartée : le refus est porté au rapport.' : 'Le montant évalué est calculé ; le classement est à jour.');
          this.maj.emit(ev);
        },
        error: (e: ApiError) => {
          this.travail.set(false);
          if (codeErreur(e) === 'PRIX_LU_OBLIGATOIRE') this.prixLuDemande.set(true);
          this.erreur.set(refusEvaluation(e));
        },
      });
  }
}

/**
 * Le **tableau d'évaluation** du guide (p. 9) pour un lot, et le **départage** des ex aequo (Q5 : la CAO les ordonne, avec un
 * motif). Le serveur classe ; l'écran affiche.
 */
@Component({
  selector: 'app-tableau-evaluation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="te" aria-labelledby="te-titre">
      <h3 id="te-titre" class="te__h3">Tableau d'évaluation — lot {{ lot().lot }}</h3>
      @if (lignes().length) {
        <div class="cnm-table-wrap">
          <table class="cnm-table te__table" aria-labelledby="te-titre">
            <thead><tr>
              <th scope="col">N°</th><th scope="col">Candidat</th><th scope="col">Prix lu HT</th><th scope="col">Garantie</th><th scope="col">Conforme</th><th scope="col">Motif de rejet</th>
              <th scope="col">Prix corrigé</th><th scope="col">Rabais</th><th scope="col">Ajust.</th><th scope="col">Montant évalué</th><th scope="col">Rang</th><th scope="col">Qualifié</th>
            </tr></thead>
            <tbody>
              @for (l of lignes(); track l.idOffre) {
                <tr [class.te__ecartee]="!!l.motifRejet">
                  <td>{{ l.numero ?? '—' }}</td><td>{{ l.candidat }}</td>
                  <td class="te__num">{{ ariary(l.prixLu) }}</td><td>{{ l.garantie || '—' }}</td>
                  <td>{{ l.conforme === true ? 'Oui' : l.conforme === false ? 'Non' : '—' }}</td><td class="text-sm">{{ l.motifRejet || '' }}</td>
                  <td class="te__num">{{ ariary(l.prixCorrige) }}</td><td class="te__num">{{ ariary(l.rabais) }}</td><td class="te__num">{{ ariary(l.ajustements) }}</td>
                  <td class="te__num"><strong>{{ ariary(l.montantEvalue) }}</strong></td>
                  <td>{{ l.rang ?? '—' }}{{ l.exAequo ? ' ex aequo' : '' }}</td>
                  <td>{{ l.qualifie === true ? 'Oui' : l.qualifie === false ? 'Non' : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="text-sm text-muted te__note">Montants en ariary, hors taxes (arbitrage du 07/10). « Ajust. » : ajustement de préférence et critères additionnels.</p>
      } @else if (charge()) {
        <p class="text-sm text-muted">Aucune offre évaluée pour l'instant.</p>
      }

      @if (exAequo().length >= 2 && droits().decider) {
        <div class="te__departage">
          <p class="text-sm"><strong>Égalité de montant évalué</strong> : la CAO ordonne les offres ex aequo, avec un motif (Q5).</p>
          <ol class="te__ordre">
            @for (id of ordre(); track id; let i = $index) {
              <li>
                <span>Offre n° {{ numero(id) }} · {{ candidat(id) }}</span>
                <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Monter l’offre n° ' + numero(id)" [disabled]="i === 0" (click)="monter(i)">↑</button>
              </li>
            }
          </ol>
          <label class="form-group"><span class="form-label">Motif du départage</span><input class="form-control" type="text" [value]="motif()" (input)="motif.set($any($event.target).value)" /></label>
          <button type="button" class="btn btn-outline btn-sm" [disabled]="!motif().trim() || travail()" (click)="departager()">Départager</button>
        </div>
      }
      @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
    </section>
  `,
  styles: `
    .te { display: flex; flex-direction: column; gap: 0.5rem; }
    .te__h3 { margin: 0; font-size: 0.95rem; }
    .te__num { text-align: right; white-space: nowrap; }
    .te__ecartee td { color: var(--n-500); }
    .te__note { margin: 0; }
    .te__departage { border: 1px solid var(--n-200); border-radius: 6px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .te__ordre { margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.2rem; font-size: var(--text-sm); }
    .te__ordre li > span { margin-right: 0.4rem; }
    .te__departage .btn-outline { align-self: flex-start; }
  `,
})
export class TableauEvaluation {
  readonly idDmc = input.required<number>();
  readonly lot = input.required<LotEvaluation>();
  readonly droits = input.required<DroitsEvaluation>();
  readonly maj = output<Evaluation>();

  private readonly service = inject(EvaluationService);
  private readonly toast = inject(ToastService);
  readonly ariary = ariary;

  readonly lignes = signal<LigneTableau[]>([]);
  readonly charge = signal(false);
  readonly motif = signal('');
  readonly ordre = signal<string[]>([]);
  readonly travail = signal(false);
  readonly erreur = signal<string | null>(null);

  /** Les offres classées ex aequo au premier rang partagé (le serveur pose `exAequo`). */
  readonly exAequo = computed(() => this.lot().offres.filter((o) => o.exAequo && o.rang != null));

  constructor() {
    // Chaque geste rend une évaluation neuve : le tableau et l'ordre des ex aequo se relisent.
    effect(() => {
      this.lot();
      untracked(() => {
        this.charger();
        this.ordre.set(this.exAequo().map((o) => o.idOffre));
      });
    });
  }

  charger(): void {
    this.service.tableau(this.idDmc(), this.lot().lot).subscribe({
      next: (l) => {
        this.lignes.set(l);
        this.charge.set(true);
      },
      error: (e: ApiError) => {
        this.charge.set(true);
        this.erreur.set(refusEvaluation(e));
      },
    });
  }

  numero(id: string): number | string {
    return this.lot().offres.find((o) => o.idOffre === id)?.numero ?? '?';
  }

  candidat(id: string): string {
    return this.lot().offres.find((o) => o.idOffre === id)?.entreprise.raisonSociale ?? '';
  }

  monter(i: number): void {
    this.ordre.update((l) => {
      const c = [...l];
      [c[i - 1], c[i]] = [c[i], c[i - 1]];
      return c;
    });
  }

  departager(): void {
    this.travail.set(true);
    this.erreur.set(null);
    this.service.departager(this.idDmc(), this.lot().lot, this.ordre(), this.motif().trim()).subscribe({
      next: (ev) => {
        this.travail.set(false);
        this.toast.success('Le départage est enregistré ; le classement est à jour.');
        this.maj.emit(ev);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.erreur.set(refusEvaluation(e));
      },
    });
  }
}
