import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { Dossier } from '../../../models';
import { DossierService } from '../../../services';
import { AgpmDoc } from '../../../shared/prmp/agpm-doc';
import { RowExamState } from '../../../shared/prmp/document-officiel';
import { DocumentVisionneuse } from '../../../shared/ui/document-visionneuse';
import { PpmMarchesTable } from '../../../shared/prmp/ppm-marches-table';
import { DossierContenuStore } from './dossier-contenu.store';

/**
 * ⚠️ 17/10 (pilote) — le **vrai** plan de passation d'un dossier né d'une fiche : le plan contrôlé qui porte sa ligne
 * (`idDossierPlan`), présenté exactement comme dans le dossier de planification — tableau du plan et projet d'AGPM —, la ligne
 * du dossier mise en évidence. Le composant fournit sa propre instance du magasin, chargée sur le dossier du PLAN : le magasin
 * de l'hôte (le dossier DAO) ne lit pas les données d'un plan.
 */
@Component({
  selector: 'app-plan-du-dossier-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgpmDoc, DocumentVisionneuse, PpmMarchesTable],
  providers: [DossierContenuStore],
  template: `
    @if (chargement()) {
      <p class="pd__aide" role="status">Chargement du plan de passation…</p>
    } @else if (refus(); as r) {
      <p class="pd__refus" role="alert">{{ r }}</p>
    } @else if (plan()) {
      <div class="pd__barre">
        <div class="pd__vues" role="group" aria-label="Document du plan">
          <button type="button" class="pd__vue" [class.pd__vue--on]="vue() === 'plan'" [attr.aria-pressed]="vue() === 'plan'" (click)="vue.set('plan')">Tableau du plan</button>
          <button type="button" class="pd__vue" [class.pd__vue--on]="vue() === 'agpm'" [attr.aria-pressed]="vue() === 'agpm'" (click)="vue.set('agpm')">Projet d’AGPM</button>
        </div>
        @if (vue() === 'plan' && idDetail()) { <p class="pd__aide">La ligne de ce dossier est surlignée.</p> }
      </div>
      @if (vue() === 'plan') {
        <app-document-visionneuse [interrupteur]="true" [(annotations)]="annotations">
          <app-ppm-marches-table [marches]="contenu.marches()" [beneficiaires]="contenu.serviceBenefs()" [previsions]="contenu.previsions()"
            [changements]="contenu.changements()" [legendeTitre]="contenu.legendeChangements()" [detailsChangements]="contenu.detailsChangements()"
            [rowStateFn]="etatLigne" />
        </app-document-visionneuse>
      } @else {
        <app-document-visionneuse>
          <app-agpm-doc
            [lignes]="contenu.agpmDoc()"
            [exercice]="contenu.ppm()?.exercice"
            [entite]="contenu.entiteLabel()"
            [signataire]="contenu.ppm()?.signataire"
            [dateInitiale]="contenu.ppm()?.datePpmInit || contenu.ppm()?.dateSignature"
            [numMajPrec]="contenu.ppm()?.numMajPrec"
            [dateMajPrec]="contenu.ppm()?.dateMajPrec"
            [numMaj]="contenu.ppm()?.numMaj"
          />
        </app-document-visionneuse>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.75rem; }
    .pd__barre { display: flex; align-items: center; gap: 0.5rem 1rem; flex-wrap: wrap; }
    .pd__vues { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .pd__vue { border: 1px solid var(--n-300); background: #fff; border-radius: 999px; padding: 0.3rem 0.9rem; font-size: 0.85rem; cursor: pointer; color: var(--n-700); }
    .pd__vue--on { background: var(--primary-600, #1d4ed8); border-color: var(--primary-600, #1d4ed8); color: #fff; }
    .pd__aide { margin: 0; font-size: 0.8rem; color: var(--n-500); }
    .pd__refus { margin: 0; color: var(--danger-text); }
  `,
})
export class PlanDuDossierDao {
  private readonly dossiers = inject(DossierService);
  readonly contenu = inject(DossierContenuStore);

  /** Le plan contrôlé qui porte la ligne. */
  readonly idDossierPlan = input.required<number>();
  /** La ligne du dossier DAO, surlignée dans le plan (absente : rien n'est surligné). */
  readonly idDetail = input<number | null | undefined>(null);

  readonly plan = signal<Dossier | null>(null);
  readonly chargement = signal(true);
  readonly refus = signal<string | null>(null);
  readonly vue = signal<'plan' | 'agpm'>('plan');
  readonly annotations = signal(true);

  readonly etatLigne = (idDetail: number): RowExamState | null => (idDetail === this.idDetail() ? 'current' : null);

  constructor() {
    // Une seule lecture : le magasin ne se recharge pas (charger() lance sa vague une fois).
    effect((nettoyer) => {
      const id = this.idDossierPlan();
      if (this.plan()) return;
      const abonnement = this.dossiers.getById(id).subscribe({
        next: (d) => {
          this.contenu.charger(signal(d).asReadonly());
          this.plan.set(d);
          this.chargement.set(false);
        },
        error: () => { this.chargement.set(false); this.refus.set('Le plan de passation n’a pas pu être lu.'); },
      });
      nettoyer(() => abonnement.unsubscribe());
    });
  }
}
