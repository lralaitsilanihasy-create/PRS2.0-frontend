import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { ApiError, codeErreur } from '../../../core/errors/api-error';
import { TYPES_DOCX, telechargerBlob, validerFichier } from '../../../core/securite/fichiers-surs';
import { SpecificationsTechniques } from '../../../models';
import { FicheMarcheService } from '../../../services/fiche-marche.services';

/** Le refus du dépôt, nommé (V73, §B2). */
function motif(e: unknown): string {
  const api = e as Partial<ApiError> & { status?: number };
  switch (codeErreur(api as ApiError)) {
    case 'FORMAT_INVALIDE':
      return 'Ce fichier n’est pas un document Word (.docx) sans macros.';
    case 'FICHIER_ABSENT':
      return 'Choisissez le fichier Word des spécifications.';
    case 'FICHE_VALIDEE':
      return 'Cette version de la fiche est validée : ouvrez une révision pour changer les spécifications.';
  }
  if (api.status === 413) return 'Le fichier dépasse 20 Mo.';
  return api.message || 'Les spécifications n’ont pas pu être enregistrées.';
}

/**
 * ⚠️ V73 (06/10) — les **spécifications techniques** de la fiche (devis descriptif, prescriptions techniques, plans) : un **Word**
 * déposé par la PRMP ou l'UGPM, inséré dans le DAO complet entre le CCAP et le CCAG. Figé à la validation, recopié à la révision.
 * Sans fichier, le contrôle avertit (`SPECIFICATIONS_ABSENTES`, non bloquant ; muet en prestations intellectuelles).
 */
@Component({
  selector: 'app-fiche-specifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sp" aria-labelledby="sp-titre">
      <h3 id="sp-titre" class="sp__titre">Spécifications techniques <span class="sp__clause">DAO complet, entre le CCAP et le CCAG</span></h3>
      <p class="sp__aide">Le devis descriptif, les prescriptions techniques, les plans : un document Word (.docx, 20 Mo au plus), inséré tel quel dans le dossier d’appel d’offres complet.</p>
      @if (chargement()) {
        <p class="sp__aide" role="status">Chargement…</p>
      } @else {
        @if (actuel(); as s) {
          <p class="sp__fichier">
            <strong>{{ s.nomFichier }}</strong>
            <span class="sp__meta">{{ poids(s.taille) }}@if (s.deposeLe) { · déposé le {{ date(s.deposeLe) }} }</span>
            <button type="button" class="btn btn-sm btn-outline" [disabled]="occupe()" (click)="telecharger(s)">Enregistrer</button>
          </p>
        } @else {
          <p class="sp__absent" role="status">Aucun fichier : le DAO complet n’aura pas de partie « Spécifications techniques ».</p>
        }
        @if (erreur(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
        @if (!lecture()) {
          <div class="sp__actions">
            <label class="sp__choix">
              <span class="cnm-sr-only">Fichier Word des spécifications techniques</span>
              <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" [disabled]="occupe()" (change)="deposer($event)" />
            </label>
            @if (actuel()) {
              <button type="button" class="btn btn-sm btn-outline sp__retirer" [disabled]="occupe()" (click)="retirer()">Retirer</button>
            }
          </div>
          @if (occupe()) { <p class="sp__aide" role="status">Envoi…</p> }
        }
      }
    </section>
  `,
  styles: `
    .sp { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--n-200); display: flex; flex-direction: column; gap: 0.5rem; }
    .sp__titre { margin: 0; font-size: 1rem; }
    .sp__clause { font-size: 0.78rem; font-weight: 500; color: var(--n-500); margin-left: 0.4rem; }
    .sp__aide { margin: 0; font-size: 0.85rem; color: var(--n-500); }
    .sp__absent { margin: 0; font-size: 0.85rem; color: var(--warning-text); }
    .sp__fichier { margin: 0; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .sp__meta { font-size: 0.8rem; color: var(--n-500); }
    .sp__actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .sp__retirer { color: #b42318; }
  `,
})
export class FicheSpecifications {
  private readonly fiches = inject(FicheMarcheService);

  readonly idDmc = input.required<number>();
  readonly lecture = input(false);

  readonly chargement = signal(true);
  readonly occupe = signal(false);
  readonly actuel = signal<SpecificationsTechniques | null>(null);
  readonly erreur = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.idDmc();
      this.chargement.set(true);
      this.fiches.specifications(id).subscribe({
        next: (s) => {
          this.actuel.set(s);
          this.chargement.set(false);
        },
        error: () => {
          this.actuel.set(null); // 404 : aucun fichier
          this.chargement.set(false);
        },
      });
    });
  }

  deposer(ev: Event): void {
    const champ = ev.target as HTMLInputElement;
    const f = champ.files?.[0];
    if (!f) return;
    const refus = validerFichier(f, TYPES_DOCX, 20);
    if (refus) {
      this.erreur.set(refus);
      champ.value = '';
      return;
    }
    this.erreur.set(null);
    this.occupe.set(true);
    this.fiches.deposerSpecifications(this.idDmc(), f).subscribe({
      next: (s) => {
        this.actuel.set(s);
        this.occupe.set(false);
        champ.value = '';
      },
      error: (e) => {
        this.erreur.set(motif(e));
        this.occupe.set(false);
        champ.value = '';
      },
    });
  }

  retirer(): void {
    this.occupe.set(true);
    this.erreur.set(null);
    this.fiches.supprimerSpecifications(this.idDmc()).subscribe({
      next: () => {
        this.actuel.set(null);
        this.occupe.set(false);
      },
      error: (e) => {
        this.erreur.set(motif(e));
        this.occupe.set(false);
      },
    });
  }

  telecharger(s: SpecificationsTechniques): void {
    this.occupe.set(true);
    this.fiches.specificationsFichier(this.idDmc()).subscribe({
      next: (b) => {
        telechargerBlob(b, s.nomFichier);
        this.occupe.set(false);
      },
      error: () => this.occupe.set(false),
    });
  }

  poids(o: number | null): string {
    if (!o) return '';
    return o >= 1024 * 1024 ? `${(o / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`;
  }

  date(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR');
  }
}
