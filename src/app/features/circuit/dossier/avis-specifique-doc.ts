import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { ApiError, corpsErreur } from '../../../core/errors/api-error';
import { AvisSpecifiqueDonnees, MentionAvis } from '../../../models';
import { DossierService } from '../../../services';

/**
 * ⚠️ 18/10 (demande « avis-specifique-en-donnees », B1 ; PRS20 f1b696c) — le **projet d'avis spécifique** (la lettre d'invitation en
 * prestations intellectuelles) d'un dossier né d'une fiche, en données : les mentions du modèle type dans l'ordre du manuel, avec la
 * valeur que l'avis imprime, sur la version du PDF joint (la version soumise, à défaut la dernière validée). Le PDF reste la pièce.
 */
@Component({
  selector: 'app-avis-specifique-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="as" aria-labelledby="as-titre">
      @if (chargement()) {
        <p class="as__aide" role="status">Chargement…</p>
      } @else if (refus(); as r) {
        <p class="as__refus" role="alert">{{ r }}</p>
      } @else if (avis(); as a) {
        <div class="as__tete">
          <h3 id="as-titre" class="as__titre">{{ a.lettre ? 'Projet de lettre d’invitation' : 'Projet d’avis spécifique d’appel d’offres' }}</h3>
          <span class="as__version">fiche DAO, version {{ a.versionFiche }}</span>
          @if (!a.documentComplet) { <span class="as__incomplet">mention(s) à compléter</span> }
        </div>
        <dl class="as__lignes">
          <div class="as__ligne"><dt>Autorité contractante</dt><dd>{{ a.autoriteContractante || '—' }}</dd></div>
          @if (a.numero) { <div class="as__ligne"><dt>Numéro</dt><dd>{{ a.numero }}</dd></div> }
        </dl>
        <dl class="as__lignes as__mentions">
          @for (m of a.mentions; track m.code) {
            <div class="as__ligne" [class.as__ligne--manque]="manque(m)" [attr.data-code]="m.code">
              <dt>{{ m.libelle }}</dt>
              <dd>
                @if (m.valeur) { {{ m.valeur }} }
                @else if (m.sansObjet) { <span class="as__so">sans objet</span> }
                @else { <span class="as__manque">{{ m.code === 'COMPTE_PAIEMENT' ? 'à renseigner par l’Administrateur (compte bancaire de l’ARMP)' : 'à compléter dans la fiche' }}</span> }
              </dd>
            </div>
          }
        </dl>
        <p class="as__aide">Produit par l’application à partir de la fiche DAO : il tient lieu de l’imprimé du SIGMP. Sans information de publication : celle-ci s’imprime avec l’avis, après le PV favorable.</p>
      }
    </section>
  `,
  styles: `
    .as { display: flex; flex-direction: column; gap: 0.75rem; }
    .as__tete { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; }
    .as__titre { margin: 0; font-size: 1.05rem; }
    .as__version { font-size: 0.8rem; color: var(--n-500); }
    .as__incomplet { font-size: 0.75rem; font-weight: 600; color: var(--danger-text); }
    .as__lignes { margin: 0; border: 1px solid var(--n-200); border-radius: var(--radius-lg, 10px); overflow: hidden; }
    .as__ligne { display: grid; grid-template-columns: minmax(12rem, 38%) 1fr; gap: 1rem; padding: 0.5rem 0.9rem; border-top: 1px solid var(--n-100); }
    .as__ligne:first-child { border-top: none; }
    .as__ligne dt { color: var(--n-500); font-size: 0.85rem; }
    .as__ligne dd { margin: 0; color: var(--n-800); font-size: 0.9rem; overflow-wrap: anywhere; }
    .as__ligne--manque { border-left: 4px solid var(--danger-text); }
    .as__manque { color: var(--danger-text); font-weight: 600; }
    .as__so { color: var(--n-500); font-style: italic; }
    .as__aide { margin: 0; font-size: 0.8rem; color: var(--n-500); }
    .as__refus { margin: 0; color: var(--danger-text); }
  `,
})
export class AvisSpecifiqueDoc {
  private readonly dossiers = inject(DossierService);

  readonly idDossier = input.required<number>();
  readonly avis = signal<AvisSpecifiqueDonnees | null>(null);
  readonly chargement = signal(true);
  readonly refus = signal<string | null>(null);

  constructor() {
    effect((nettoyer) => {
      const id = this.idDossier();
      this.chargement.set(true);
      this.refus.set(null);
      const abonnement = this.dossiers.avisSpecifique(id).subscribe({
        next: (a) => { this.avis.set(a); this.chargement.set(false); },
        error: (e: ApiError) => {
          this.avis.set(null);
          this.chargement.set(false);
          this.refus.set(corpsErreur<{ message?: string }>(e)?.message ?? 'Le projet d’avis n’est pas disponible : la fiche DAO doit être validée.');
        },
      });
      nettoyer(() => abonnement.unsubscribe());
    });
  }

  /** Une mention en pointillés : ni valeur, ni sans objet (Q2 du 18/10). */
  manque(m: MentionAvis): boolean { return !m.valeur && !m.sansObjet; }
}
