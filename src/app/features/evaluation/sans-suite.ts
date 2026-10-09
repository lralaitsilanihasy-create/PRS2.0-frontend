import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { DemandeSansSuite, EtatSansSuite, SansSuite } from '../../models';
import { AttributionService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';

export const LIBELLES_ETAT_SANS_SUITE: Readonly<Record<EtatSansSuite, string>> = {
  A_SOUMETTRE: 'Dossier à soumettre à la Commission',
  AU_CONTROLE: 'Au contrôle de la Commission',
  FAVORABLE: 'Avis favorable — à déclarer',
  DEFAVORABLE: 'Avis défavorable — la procédure reprend son cours',
  DECLAREE: 'Déclarée sans suite',
};

export function refusSansSuite(e: ApiError): string {
  switch (codeErreur(e)) {
    case 'MOTIFS_OBLIGATOIRES': return 'Les motifs sont obligatoires : ils sont soumis à la Commission puis communiqués aux candidats.';
    case 'MARCHE_SIGNE': return 'Un marché de la procédure est signé : elle ne peut plus être déclarée sans suite.';
    case 'SANS_SUITE_EN_COURS': return 'Une demande attend déjà l’avis de la Commission.';
    case 'SANS_SUITE_DECLAREE': return 'La procédure est déjà déclarée sans suite.';
    case 'SOUS_TYPE_ABSENT': return 'Le sous-type « Déclaration sans suite » (DSS) manque au référentiel : l’Administrateur doit le rétablir.';
    case 'DECISION_OBLIGATOIRE': return 'La référence et la date de votre décision sont obligatoires.';
    case 'DECISION_DATE_INVALIDE': return 'La date de la décision ne peut pas être à venir.';
    case 'AUCUNE_DEMANDE': return 'Aucune demande de déclaration sans suite n’est en cours.';
    case 'AVIS_NON_FAVORABLE': return 'La déclaration attend l’avis favorable de la Commission.';
  }
  if (e.status === 403) return 'Ce geste revient à la PRMP.';
  return e.message || 'Le geste n’a pas abouti.';
}

/**
 * ⚠️ **La déclaration sans suite** (attribution, tranche 2d-3 — V93 ; art. 55). Avant la signature d'un marché de la procédure, la PRMP
 * demande, motifs à l'appui : le serveur crée un **dossier `DSS`** (brouillon, avec la pièce des motifs) qu'elle soumet par le circuit
 * ordinaire ; la Commission rend un avis **favorable ou défavorable** sous cinq jours de la réception. Favorable, la PRMP **déclare** (sa
 * décision) : la procédure est close sans suite, les candidats sont informés, sans indemnité. Défavorable, la procédure reprend son cours.
 */
@Component({
  selector: 'app-sans-suite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (etat(); as s) {
      <section class="card ss" aria-labelledby="ss-titre">
        <h2 id="ss-titre" class="ss__titre">Déclaration sans suite</h2>
        @if (s.declaree) {
          @let d = s.demandes[0];
          <p class="text-sm"><strong>La procédure est déclarée sans suite</strong>{{ d?.declareLe ? ' le ' + jj(d.declareLe) : '' }}{{ d?.decisionReference ? ' — décision ' + d.decisionReference : '' }}. Les candidats en sont informés ; aucun geste d’attribution n’est plus possible.</p>
        }
        @if (s.courante; as c) {
          <div class="ss__demande">
            <p class="ss__ligne">
              <span class="badge" [class.badge-info]="c.etat === 'AU_CONTROLE'" [class.badge-warning]="c.etat === 'A_SOUMETTRE'" [class.badge-success]="c.etat === 'FAVORABLE' || c.etat === 'DECLAREE'" [class.badge-danger]="c.etat === 'DEFAVORABLE'">{{ etats[c.etat] }}</span>
              <span class="text-sm">demandée le {{ jj(c.demandeLe) }}</span>
              @if (c.recuLe) { <span class="text-sm">· reçue le {{ jj(c.recuLe) }}</span> }
              @if (c.echeance && c.etat === 'AU_CONTROLE') { <span class="text-sm" [class.ss__retard]="c.echeanceDepassee">· avis attendu au plus tard le {{ jour(c.echeance) }}{{ c.echeanceDepassee ? ' (dépassé)' : '' }}</span> }
            </p>
            <p class="text-sm ss__motifs">Motifs : {{ c.motifs }}</p>
            <div class="ss__actions">
              @if (c.idDossier && lienDossier()) { <a class="btn btn-outline btn-sm" [routerLink]="['/prmp/dossier', c.idDossier]">{{ c.etat === 'A_SOUMETTRE' ? 'Ouvrir le dossier pour le soumettre' : 'Ouvrir le dossier' }}</a> }
              @if (c.motifsDisponibles) {
                <button type="button" class="btn btn-ghost btn-sm" (click)="motifs(c, 'pdf')">Motifs (PDF)</button>
                <button type="button" class="btn btn-ghost btn-sm" (click)="motifs(c, 'docx')">Word</button>
              }
            </div>
            @if (prmp() && c.etat === 'FAVORABLE') {
              <div class="ss__form">
                <div class="ss__grille">
                  <label class="form-group"><span class="form-label">Référence de votre décision</span><input class="form-control" type="text" [value]="reference()" (input)="reference.set($any($event.target).value)" /></label>
                  <label class="form-group"><span class="form-label">Date de la décision</span><input class="form-control" type="date" [value]="date()" (input)="date.set($any($event.target).value)" /></label>
                </div>
                <div><button type="button" class="btn btn-danger btn-sm" [disabled]="occupe() || !reference().trim() || !date()" (click)="declarer()">Déclarer la procédure sans suite</button></div>
              </div>
            }
          </div>
        } @else if (!s.declaree && prmp()) {
          <details class="ss__nouvelle">
            <summary>Demander une déclaration sans suite…</summary>
            <p class="text-sm text-muted">Possible avant la signature d’un marché de la procédure. Les motifs forment une pièce du dossier soumis à la Commission, qui rend un avis favorable ou défavorable sous cinq jours de la réception.</p>
            <label class="form-group"><span class="form-label">Motifs</span><textarea class="form-control" rows="4" [value]="motifsSaisis()" (input)="motifsSaisis.set($any($event.target).value)"></textarea></label>
            <div><button type="button" class="btn btn-outline btn-sm" [disabled]="occupe() || !motifsSaisis().trim()" (click)="demander()">Créer le dossier de déclaration sans suite</button></div>
          </details>
        } @else if (!s.declaree) {
          <p class="text-sm text-muted">Aucune demande de déclaration sans suite.</p>
        }
        @if (anciennes(s).length) {
          <details>
            <summary class="text-sm">Demandes précédentes ({{ anciennes(s).length }})</summary>
            <ul class="ss__liste">@for (d of anciennes(s); track d.id) { <li>{{ jj(d.demandeLe) }} — {{ etats[d.etat] }} : {{ d.motifs }}</li> }</ul>
          </details>
        }
        @if (erreur(); as e) { <div class="alert alert-danger" role="alert"><span>{{ e }}</span></div> }
      </section>
    }
  `,
  styles: `
    .ss { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .ss__titre { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ss p { margin: 0; }
    .ss__demande { display: flex; flex-direction: column; gap: 0.4rem; }
    .ss__ligne { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
    .ss__retard { color: var(--danger-700, #b42318); font-weight: 600; }
    .ss__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .ss__form { border-top: 1px dashed var(--n-200); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .ss__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: 0.5rem; }
    .ss__nouvelle summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
    .ss__nouvelle { display: flex; flex-direction: column; gap: 0.4rem; }
    .ss__liste { margin: 0.3rem 0 0; padding-left: 1.2rem; font-size: var(--text-sm); }
  `,
})
export class SansSuiteVue implements OnInit {
  readonly idDmc = input.required<number>();
  /** La PRMP seule demande et déclare. */
  readonly prmp = input(false);
  /** La PRMP ou son UGPM : le dossier DSS s'ouvre depuis leur espace. */
  readonly lienDossier = input(false);

  private readonly service = inject(AttributionService);
  private readonly toast = inject(ToastService);

  readonly etats = LIBELLES_ETAT_SANS_SUITE;
  readonly jj = dateHeureFr;
  readonly etat = signal<SansSuite | null>(null);
  readonly motifsSaisis = signal('');
  readonly reference = signal('');
  readonly date = signal('');
  readonly occupe = signal(false);
  readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.service.sansSuite(this.idDmc()).subscribe({ next: (s) => this.etat.set(s), error: () => this.etat.set(null) });
  }

  jour(iso: string): string {
    const [a, m, j] = iso.slice(0, 10).split('-');
    return `${j}/${m}/${a}`;
  }

  anciennes(s: SansSuite): DemandeSansSuite[] {
    return s.demandes.filter((d) => d.id !== s.courante?.id && d.etat !== 'DECLAREE');
  }

  demander(): void {
    this.geste(this.service.demanderSansSuite(this.idDmc(), this.motifsSaisis().trim()), 'Le dossier de déclaration sans suite est créé en brouillon : soumettez-le à la Commission depuis sa page.');
  }

  declarer(): void {
    this.geste(this.service.declarerSansSuite(this.idDmc(), { reference: this.reference().trim(), date: this.date() }), 'La procédure est déclarée sans suite : les candidats sont informés.');
  }

  motifs(d: DemandeSansSuite, format: 'pdf' | 'docx'): void {
    this.service.motifsSansSuite(this.idDmc(), d.id, format).subscribe({
      next: (b) => (format === 'pdf' ? ouvrirBlobSur(b) : telechargerBlob(b, `motifs-sans-suite-${this.idDmc()}.docx`)),
      error: (e: ApiError) => this.erreur.set(refusSansSuite(e)),
    });
  }

  private geste(appel: ReturnType<AttributionService['sansSuite']>, succes: string): void {
    this.occupe.set(true);
    this.erreur.set(null);
    appel.subscribe({
      next: (s) => {
        this.occupe.set(false);
        this.motifsSaisis.set('');
        this.reference.set('');
        this.date.set('');
        this.etat.set(s);
        this.toast.success(succes);
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.erreur.set(refusSansSuite(e));
      },
    });
  }
}
