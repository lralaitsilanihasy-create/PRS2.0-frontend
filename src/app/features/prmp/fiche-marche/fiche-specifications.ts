import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { ApiError, codeErreur } from '../../../core/errors/api-error';
import { TYPES_PDF, ouvrirBlobSur, validerFichier } from '../../../core/securite/fichiers-surs';
import { SpecificationsTechniques } from '../../../models';
import { FicheMarcheService } from '../../../services/fiche-marche.services';

/** Le refus du dépôt, nommé (V73, §B2). */
function motif(e: unknown): string {
  const api = e as Partial<ApiError> & { status?: number };
  switch (codeErreur(api as ApiError)) {
    case 'FORMAT_INVALIDE':
      return 'Ce fichier n’est pas un PDF lisible (un Word s’exporte en PDF).';
    case 'FICHIER_ABSENT':
      return 'Choisissez le PDF du devis descriptif et des plans.';
    case 'FICHE_VALIDEE':
      return 'Cette version de la fiche est validée : ouvrez une révision pour changer le devis descriptif et les plans.';
    case 'SPECIFICATIONS_HORS_PERIMETRE':
      return 'Seule une fiche de travaux reçoit un devis descriptif et des plans : en fournitures, les spécifications sont les articles du besoin.';
  }
  if (api.status === 413) return 'Le fichier dépasse 50 Mo.';
  return api.message || 'Les spécifications n’ont pas pu être enregistrées.';
}

/**
 * ⚠️ V73 (06/10), refondu le 17/10 (demande specifications-donnees-et-plans-pdf, B1-B2 ; PRS20 7a399ee, V129) — le **devis descriptif
 * et les plans** d'une fiche de **travaux** : un seul **PDF** (50 Mo au plus ; un Word est refusé, il s'exporte en PDF), déposé par la
 * PRMP ou l'UGPM. À la validation, il devient le document `DESCRIPTIF_PLANS` de la version : à part du DAO complet, qui le cite,
 * remis aux candidats au retrait et joint d'office au dossier. En fournitures, plus de dépôt : les spécifications sont le besoin (B12).
 */
@Component({
  selector: 'app-fiche-specifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sp" aria-labelledby="sp-titre">
      <h3 id="sp-titre" class="sp__titre">Devis descriptif et plans <span class="sp__clause">document annexé au DAO, en PDF</span></h3>
      <p class="sp__aide">Le devis descriptif et les plans, assemblés en un seul PDF (50 Mo au plus). Le DAO complet le cite ; les candidats le reçoivent avec lui, et il est joint d’office au dossier comme « Descriptif technique et plans des travaux ».</p>
      @if (chargement()) {
        <p class="sp__aide" role="status">Chargement…</p>
      } @else {
        <!-- ⚠️ 04/11 (pilote, « rectifier la mise en forme ») — le fichier et ses gestes sur une seule ligne, dans un cadre ; le champ
             de fichier natif (« Choisir un fichier · Aucun fichier choisi ») est caché derrière un bouton à son nom. -->
        <div class="sp__carte" [class.sp__carte--vide]="!actuel()">
          @if (actuel(); as s) {
            <span class="sp__nom">
              <strong>{{ s.nomFichier }}</strong>
              <span class="sp__meta">{{ poids(s.taille) }}@if (s.deposeLe) { · déposé le {{ date(s.deposeLe) }} }</span>
            </span>
          } @else {
            <span class="sp__absent" role="status">Aucun PDF : la pièce « Descriptif technique et plans des travaux » manquera au dossier.</span>
          }
          <span class="sp__actions">
            @if (actuel()) {
              <button type="button" class="btn btn-sm btn-outline" [disabled]="occupe()" (click)="ouvrir()">Ouvrir le PDF</button>
            }
            @if (!lecture()) {
              <label class="btn btn-sm sp__choix" [class.btn-primary]="!actuel()" [class.btn-outline]="!!actuel()" [class.sp__choix--occupe]="occupe()">
                {{ occupe() ? 'Envoi…' : actuel() ? 'Remplacer le PDF' : 'Déposer le PDF' }}
                <input type="file" class="cnm-sr-only" accept=".pdf,application/pdf" [disabled]="occupe()" (change)="deposer($event)" />
              </label>
              @if (actuel()) {
                <button type="button" class="btn btn-sm btn-outline sp__retirer" [disabled]="occupe()" (click)="retirer()">Retirer</button>
              }
            }
          </span>
        </div>
        @if (erreur(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
      }
    </section>
  `,
  styles: `
    .sp { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--n-200); display: flex; flex-direction: column; gap: 0.5rem; }
    .sp__titre { margin: 0; font-size: 1rem; }
    .sp__clause { font-size: 0.78rem; font-weight: 500; color: var(--n-500); margin-left: 0.4rem; }
    .sp__aide { margin: 0; font-size: 0.85rem; color: var(--n-500); }
    .sp__absent { font-size: 0.85rem; color: var(--warning-text); }
    .sp__carte { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem 1rem; padding: 0.6rem 0.8rem; border: 1px solid var(--bordure); border-radius: 6px; background: var(--carte-fond); }
    .sp__carte--vide { border-style: dashed; }
    .sp__nom { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.6rem; min-width: 0; overflow-wrap: anywhere; }
    .sp__meta { font-size: 0.8rem; color: var(--n-500); font-variant-numeric: tabular-nums; }
    .sp__actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .sp__choix { position: relative; cursor: pointer; margin: 0; }
    .sp__choix:focus-within { outline: 2px solid var(--bouton-principal); outline-offset: 2px; }
    .sp__choix--occupe { opacity: 0.6; pointer-events: none; }
    .sp__retirer { color: var(--retard-texte); }
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
    const refus = validerFichier(f, TYPES_PDF, 50);
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

  /** Le PDF s’ouvre dans un onglet, par le socle des fichiers sûrs (jamais un lien blob brut). */
  ouvrir(): void {
    this.occupe.set(true);
    this.fiches.specificationsFichier(this.idDmc()).subscribe({
      next: (b) => {
        ouvrirBlobSur(b);
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
