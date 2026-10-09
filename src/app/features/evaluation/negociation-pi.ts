import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { telechargerBlob, validerFichier } from '../../core/securite/fichiers-surs';
import { LotNegociation, Negociation, Negociations } from '../../models';
import { EvaluationPiService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { refusPi } from './libelles-pi';

const LIBELLES_ETAT: Readonly<Record<Negociation['etat'], string>> = { EN_COURS: 'En cours', REUSSIE: 'Réussie', ECHOUEE: 'Échouée' };

/** Ce qui manque à une conclusion, avant l'envoi (le serveur redit `DATE_OBLIGATOIRE`, `PV_OBLIGATOIRE`, `MOTIF_OBLIGATOIRE`). */
export function manquesConclusion(c: { resultat: 'REUSSIE' | 'ECHOUEE' | null; date: string; texte: string; motif: string }): string[] {
  const m: string[] = [];
  if (!c.resultat) m.push('Le résultat de la négociation.');
  if (!c.date) m.push('La date de la négociation.');
  if (!c.texte.trim()) m.push('Le texte du procès-verbal.');
  if (c.resultat === 'ECHOUEE' && !c.motif.trim()) m.push('Le motif de l’échec.');
  return m;
}

/**
 * ⚠️ **La négociation** (lot 3 PI, PI-d2a — V89 ; art. 42-IV). Conduite par la **PRMP** ou son **UGPM** (arbitrage du 08/10), lot par lot,
 * avec le premier classé une fois le classement arrêté : l'ouvrir (date prévue, lieu — celui de la fiche par défaut), joindre la pièce
 * (compte rendu signé…), puis la conclure — **réussie** (elle porte la proposition d'attribution) ou **échouée**, motivée : le classé suivant
 * vient alors, après une séance complémentaire si son enveloppe financière n'est pas ouverte. Le PV de négociation est produit en PDF et en
 * Word. Le serveur ne contrôle pas que la négociation reste non substantielle : l'écran le rappelle.
 */
@Component({
  selector: 'app-negociation-pi',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lotN(); as l) {
      <section class="card ng" aria-labelledby="ng-titre">
        <h2 id="ng-titre" class="ng__titre">Négociation{{ multiLots() ? ' — lot ' + l.lot : '' }}</h2>
        @if (!l.classementArrete) {
          <p class="text-sm">La négociation s’ouvre quand le président a arrêté le classement du lot.</p>
        } @else {
          <p class="text-sm text-muted ng__aide">Elle ne porte que sur des points non substantiels (art. 42-IV) : ni les termes de référence, ni le personnel clé, ni les conditions du marché ne changent.</p>
          @if (message(); as m) { <div class="alert alert-danger" role="alert"><span>{{ m }}</span></div> }

          @for (n of l.negociations; track n.id) {
            <article class="ng__item" [attr.aria-label]="'Négociation avec la proposition n° ' + (n.numero ?? '?')">
              <p class="ng__tete">
                <strong>Proposition n° {{ n.numero ?? '—' }} · {{ n.raisonSociale || '—' }}</strong> (rang {{ n.rang ?? '—' }})
                <span class="badge" [class.badge-info]="n.etat === 'EN_COURS'" [class.badge-success]="n.etat === 'REUSSIE'" [class.badge-danger]="n.etat === 'ECHOUEE'">{{ etats[n.etat] }}</span>
              </p>
              <p class="text-sm ng__ligne">
                @if (n.prevueLe) { <span>Prévue le {{ jj(n.prevueLe) }}</span> }
                @if (n.lieu) { <span>· {{ n.lieu }}</span> }
                @if (n.dateNegociation) { <span>· tenue le {{ jour(n.dateNegociation) }}</span> }
                @if (n.motifEchec) { <span class="ng__echec">· échec : {{ n.motifEchec }}</span> }
              </p>
              <div class="ng__actions">
                @if (n.pieceNom) { <button type="button" class="btn btn-outline btn-sm" [disabled]="travail()" (click)="piece(n)">Pièce : {{ n.pieceNom }}</button> }
                @if (n.pvDisponible) {
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="travail()" (click)="pv(n, 'pdf')">PV de négociation (PDF)</button>
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="travail()" (click)="pv(n, 'docx')">PV (Word)</button>
                }
              </div>
              @if (n.etat === 'EN_COURS' && conduite()) {
                <div class="ng__bloc">
                  <label class="form-group"><span class="form-label">Joindre une pièce (compte rendu, offre révisée…)</span>
                    <input type="file" accept=".pdf,.jpeg,.jpg,.png" [disabled]="travail()" (change)="joindre(n, $event)" />
                  </label>
                  <fieldset class="ng__conclure">
                    <legend class="form-label">Conclure la négociation</legend>
                    <div class="ng__radios">
                      <label><input type="radio" name="ng-resultat" [checked]="resultat() === 'REUSSIE'" (change)="resultat.set('REUSSIE')" /> Réussie</label>
                      <label><input type="radio" name="ng-resultat" [checked]="resultat() === 'ECHOUEE'" (change)="resultat.set('ECHOUEE')" /> Échouée</label>
                    </div>
                    <div class="ng__grille">
                      <label class="form-group"><span class="form-label">Date de la négociation</span><input class="form-control" type="date" [value]="date()" (input)="date.set($any($event.target).value)" /></label>
                      <label class="form-group"><span class="form-label">Lieu</span><input class="form-control" type="text" [value]="lieuConclusion()" (input)="lieuConclusion.set($any($event.target).value)" /></label>
                    </div>
                    <label class="form-group"><span class="form-label">Procès-verbal : ce qui a été négocié et convenu</span><textarea class="form-control" rows="5" [value]="texte()" (input)="texte.set($any($event.target).value)"></textarea></label>
                    @if (resultat() === 'ECHOUEE') {
                      <label class="form-group"><span class="form-label">Motif de l’échec</span><input class="form-control" type="text" [value]="motif()" (input)="motif.set($any($event.target).value)" /></label>
                    }
                    @if (manques().length) { <ul class="ng__manques">@for (x of manques(); track x) { <li>{{ x }}</li> }</ul> }
                    <div><button type="button" class="btn btn-primary btn-sm" [disabled]="travail() || manques().length > 0" (click)="conclure(n)">Conclure</button></div>
                  </fieldset>
                </div>
              }
            </article>
          }

          @if (l.conclue) {
            <p class="text-sm" role="status">La négociation du lot est réussie : la proposition d’attribution en découle (rapport d’évaluation).</p>
          } @else if (l.prochain; as p) {
            <div class="ng__bloc">
              <p class="text-sm">Prochain candidat à négocier : <strong>proposition n° {{ p.numero ?? '—' }} · {{ p.raisonSociale || '—' }}</strong> (rang {{ p.rang ?? '—' }}).</p>
              @if (!p.financiereOuverte) {
                <p class="text-sm ng__echec">Son enveloppe financière n’est pas ouverte : le responsable de la procédure ouvre d’abord une séance complémentaire.</p>
              }
              @if (conduite()) {
                <div class="ng__grille">
                  <label class="form-group"><span class="form-label">Prévue le (facultatif)</span><input class="form-control" type="datetime-local" [value]="prevueLe()" (input)="prevueLe.set($any($event.target).value)" /></label>
                  <label class="form-group"><span class="form-label">Lieu (celui de la fiche à défaut)</span><input class="form-control" type="text" [value]="lieu()" (input)="lieu.set($any($event.target).value)" /></label>
                </div>
                <div><button type="button" class="btn btn-primary btn-sm" [disabled]="travail()" (click)="ouvrir(l)">Ouvrir la négociation</button></div>
              }
            </div>
          } @else if (!enCours(l)) {
            <p class="text-sm">Aucun candidat ne reste à négocier : le lot va à l’infructuosité.</p>
          }
        }
      </section>
    }
  `,
  styles: `
    .ng { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .ng__titre { margin: 0; font-size: 1.05rem; }
    .ng__aide { margin: 0; }
    .ng__item { border: 1px solid var(--n-200); border-radius: 8px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .ng__tete, .ng__ligne { margin: 0; display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
    .ng__echec { color: var(--danger-700, #b42318); }
    .ng__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .ng__bloc { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px dashed var(--n-200); padding-top: 0.5rem; }
    .ng__conclure { border: 1px solid var(--n-200); border-radius: 8px; padding: 0.6rem 0.8rem; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .ng__radios { display: flex; gap: 1rem; font-size: var(--text-sm); }
    .ng__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: 0.5rem; }
    .ng__manques { margin: 0; padding-left: 1.2rem; font-size: var(--text-sm); color: var(--warning-text); }
  `,
})
export class NegociationPi {
  private readonly service = inject(EvaluationPiService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  readonly negociations = input.required<Negociations>();
  readonly lot = input.required<number>();
  /** La PRMP ou son UGPM, dans la coquille interne : elles conduisent. */
  readonly conduite = input(false);
  readonly maj = output<Negociations>();

  readonly etats = LIBELLES_ETAT;
  readonly jj = dateHeureFr;

  readonly lotN = computed<LotNegociation | null>(() => this.negociations().lots.find((l) => l.lot === this.lot()) ?? this.negociations().lots[0] ?? null);
  readonly multiLots = computed(() => this.negociations().lots.length > 1);
  readonly prevueLe = signal('');
  readonly lieu = signal('');
  readonly resultat = signal<'REUSSIE' | 'ECHOUEE' | null>(null);
  readonly date = signal('');
  readonly lieuConclusion = signal('');
  readonly texte = signal('');
  readonly motif = signal('');
  readonly travail = signal(false);
  readonly message = signal<string | null>(null);
  readonly manques = computed(() => manquesConclusion({ resultat: this.resultat(), date: this.date(), texte: this.texte(), motif: this.motif() }));

  jour(iso: string): string {
    const [a, m, j] = iso.slice(0, 10).split('-');
    return `${j}/${m}/${a}`;
  }

  enCours(l: LotNegociation): boolean {
    return l.negociations.some((n) => n.etat === 'EN_COURS');
  }

  ouvrir(l: LotNegociation): void {
    this.geste(this.service.ouvrirNegociation(this.idDmc(), l.lot, this.prevueLe() || null, this.lieu().trim() || null), 'Négociation ouverte : le candidat est notifié.', () => {
      this.prevueLe.set('');
      this.lieu.set('');
    });
  }

  joindre(n: Negociation, ev: Event): void {
    const champ = ev.target as HTMLInputElement;
    const f = champ.files?.[0];
    if (!f) return;
    const erreur = validerFichier(f);
    if (erreur) {
      this.message.set(erreur);
      champ.value = '';
      return;
    }
    this.geste(this.service.deposerPieceNegociation(this.idDmc(), n.id, f), 'Pièce jointe à la négociation.', () => (champ.value = ''));
  }

  conclure(n: Negociation): void {
    const resultat = this.resultat();
    if (!resultat || this.manques().length) return;
    this.geste(
      this.service.conclureNegociation(this.idDmc(), n.id, {
        resultat,
        dateNegociation: this.date(),
        lieu: this.lieuConclusion().trim() || null,
        texte: this.texte().trim(),
        motif: resultat === 'ECHOUEE' ? this.motif().trim() : null,
      }),
      resultat === 'REUSSIE' ? 'Négociation réussie : le PV est produit.' : 'Négociation échouée : le classé suivant peut être négocié.',
      () => {
        this.resultat.set(null);
        this.date.set('');
        this.lieuConclusion.set('');
        this.texte.set('');
        this.motif.set('');
      },
    );
  }

  piece(n: Negociation): void {
    this.telecharger(this.service.pieceNegociation(this.idDmc(), n.id), n.pieceNom || 'piece-negociation');
  }

  pv(n: Negociation, format: 'pdf' | 'docx'): void {
    this.telecharger(this.service.pvNegociation(this.idDmc(), n.id, format), `pv-negociation-${this.idDmc()}-${n.numero ?? n.id}.${format}`);
  }

  private telecharger(appel: ReturnType<EvaluationPiService['pvNegociation']>, nom: string): void {
    this.travail.set(true);
    appel.subscribe({
      next: (b) => {
        this.travail.set(false);
        telechargerBlob(b, nom);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.message.set(refusPi(e));
      },
    });
  }

  private geste(appel: ReturnType<EvaluationPiService['negociations']>, succes: string, apres: () => void): void {
    this.travail.set(true);
    this.message.set(null);
    appel.subscribe({
      next: (n) => {
        this.travail.set(false);
        apres();
        this.toast.success(succes);
        this.maj.emit(n);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.message.set(refusPi(e));
      },
    });
  }
}
