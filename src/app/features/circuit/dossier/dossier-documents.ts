import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';

import { AgpmDoc } from '../../../shared/prmp/agpm-doc';
import { FichePresentationDoc } from '../../../shared/prmp/fiche-presentation-doc';
import { PpmMarchesTable } from '../../../shared/prmp/ppm-marches-table';
import { DocumentVisionneuse } from '../../../shared/ui/document-visionneuse';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierPieces } from './dossier-pieces';
import { DossierVersions } from './dossier-versions';

/**
 * Documents d'un dossier : barre d'onglets (fiche, plan, AGPM, pièces, historique) et leur contenu dans
 * la visionneuse, avec l'interrupteur d'annotations commun aux onglets. Lit le `DossierContenuStore` de
 * l'hôte, qui ne monte ce bloc qu'une fois la vague chargée.
 */
@Component({
  selector: 'app-dossier-documents',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PpmMarchesTable, FichePresentationDoc, AgpmDoc, DocumentVisionneuse, DossierPieces, DossierVersions],
  host: { '[class.dc-documents--embedded]': 'embedded()' },
  template: `
    @if (contenu.estPpm()) {
      <!-- ⚠️ Demande pilote (2026-09-03) — chaque élément du dossier EN ONGLET : fiche de
           présentation / plan / projet d'AGPM (si lignes) / pièces jointes — même langage
           (classes GLOBALES onglets-dossier) que le détail PPM, l'examen et l'aperçu. -->
      <div class="onglets-dossier" role="tablist" aria-label="Éléments du dossier">
        <!-- ⚠️ Demande pilote (2026-09-06) : chaque onglet à la COULEUR des bandes de son
             contenu — fiche verte, plan bleu, AGPM orange, historique gris. -->
        <button type="button" class="onglets-dossier__tab onglets-dossier__tab--vert" role="tab" [class.onglets-dossier__tab--on]="ongletDossier() === 'fiche'"
          [attr.aria-selected]="ongletDossier() === 'fiche'" (click)="ongletDossier.set('fiche')">
          Fiche de présentation <span class="onglets-dossier__n">{{ contenu.ficheDoc().nbMarchesConcernes }}</span>
        </button>
        <button type="button" class="onglets-dossier__tab onglets-dossier__tab--bleu" role="tab" [class.onglets-dossier__tab--on]="ongletDossier() === 'ppm'"
          [attr.aria-selected]="ongletDossier() === 'ppm'" (click)="ongletDossier.set('ppm')">
          Plan de passation <span class="onglets-dossier__n">{{ contenu.marches().length }}</span>
        </button>
        @if (contenu.agpmDoc().length) {
          <button type="button" class="onglets-dossier__tab" role="tab" [class.onglets-dossier__tab--on]="ongletDossier() === 'agpm'"
            [attr.aria-selected]="ongletDossier() === 'agpm'" (click)="ongletDossier.set('agpm')">
            Projet d'AGPM <span class="onglets-dossier__n">{{ contenu.agpmDoc().length }}</span>
          </button>
        }
        <button type="button" class="onglets-dossier__tab" role="tab" [class.onglets-dossier__tab--on]="ongletDossier() === 'pieces'"
          [attr.aria-selected]="ongletDossier() === 'pieces'" (click)="ongletDossier.set('pieces')">
          Pièces jointes <span class="onglets-dossier__n">{{ contenu.pieces().length }}</span>
        </button>
        <!-- ⚠️ Demande pilote (2026-09-06, backend 6d9ba29) — HISTORIQUE DES VERSIONS : chaque
             rectification archive la version qu'elle remplace ; l'onglet n'apparaît que s'il
             existe au moins une version archivée (un « Historique (0) » serait du bruit).
             Compteur = versions archivées + la courante. -->
        @if (contenu.historiqueVersionsVisible()) {
          <button type="button" class="onglets-dossier__tab onglets-dossier__tab--gris" role="tab" [class.onglets-dossier__tab--on]="ongletDossier() === 'historique'"
            [attr.aria-selected]="ongletDossier() === 'historique'" (click)="ongletDossier.set('historique')">
            Historique des versions <span class="onglets-dossier__n">{{ contenu.versionsArchivees().length + 1 }}</span>
          </button>
        }
      </div>

      @if (ongletDossier() === 'ppm') {
        <!-- ⚠️ 2026-09-14 (décision des chefs) — documents officiels dans leur feuille ; statut et
             versionnement en annotations, masquables (interrupteur commun aux onglets).
             Embarquée (vérification), l'en-tête du plan reste collant dans le panneau hôte qui défile. -->
        <div class="dc-section">
          <app-document-visionneuse [interrupteur]="true" [(annotations)]="annotationsDoc" [class.doc-entete-collante]="embedded()">
            <app-ppm-marches-table [marches]="contenu.marches()" [beneficiaires]="contenu.serviceBenefs()" [previsions]="contenu.previsions()" [changements]="contenu.changements()" [legendeTitre]="contenu.legendeChangements()" [detailsChangements]="contenu.detailsChangements()" />
          </app-document-visionneuse>
        </div>
      }
      @if (ongletDossier() === 'historique' && contenu.historiqueVersionsVisible()) {
        <div class="dc-section">
          <app-dossier-versions [(annotations)]="annotationsDoc" />
        </div>
      }
      @if (ongletDossier() === 'fiche') {
        <div class="dc-section">
          <app-document-visionneuse>
            <app-fiche-presentation-doc
              [fiche]="contenu.ficheDoc()"
              [exercice]="contenu.ppm()?.exercice"
              [libelleVersion]="contenu.libelleVersionFiche()"
              [justificationFiche]="contenu.ppm()?.justificationFiche"
              [motifMaj]="contenu.ppm()?.motifMaj"
            />
          </app-document-visionneuse>
        </div>
      }
      @if (ongletDossier() === 'agpm') {
        <div class="dc-section">
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
        </div>
      }
    }

    <!-- Pièces jointes (onglet pour un PPM ; section directe pour les autres familles) -->
    @if (!contenu.estPpm() || ongletDossier() === 'pieces') {
      <div class="dc-section">
        <app-dossier-pieces />
      </div>
    }
  `,
  styles: `
    /* Sans boîte propre : la barre d'onglets et les sections restent les enfants directs du corps de
       l'hôte (défilement, en-tête collant du plan en mode embarqué). */
    :host { display: contents; }
    .dc-section { padding: 16px 24px; }
    /* Marges resserrées en mode embarqué (2026-09-15), comme l'en-tête de la coquille : la largeur va au document. */
    :host(.dc-documents--embedded) .dc-section { padding: 12px 16px; }
    .dc-empty { margin: 0; }

    /* Badges statut (alignés sur le modal PPM) */
    .badge.badge-prevu { background: var(--info-bg); color: var(--info-text); }
    .badge.badge-cours { background: var(--success-bg); color: var(--success-text); }
    .badge.badge-cloture { background: var(--n-100); color: var(--n-500); }

    .table-card td { white-space: normal; }

    /* Services bénéficiaires (sous-ligne lecture seule d'un marché) */
    .dc-benef-row td { background: var(--n-50); padding: 8px 14px 10px; }
    .dc-benef-title { display: block; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--n-400); margin-bottom: 4px; }
    .dc-benef-line { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--n-600); padding: 2px 0; }
    .dc-benef-soa { font-weight: 600; color: var(--n-800); }
    .dc-benef-cell { color: var(--n-500); }
  `,
})
export class DossierDocuments {
  protected readonly contenu = inject(DossierContenuStore);
  /** Embarqué dans un panneau hôte qui défile (vérification) : en-tête du plan collant, marges resserrées. */
  readonly embedded = input(false);

  // ── Onglets du dossier (2026-09-03) : fiche / plan / AGPM / pièces / historique (2026-09-06) ──
  /** Onglet actif — ouverture sur le plan, comme le détail PPM. */
  readonly ongletDossier = signal<'ppm' | 'fiche' | 'agpm' | 'pieces' | 'historique'>('ppm');
  /**
   * ⚠️ 2026-09-14 (décision des chefs) — annotations des documents officiels visibles (statut du
   * marché, versionnement, état d'examen…) : un seul interrupteur pour tous les onglets de l'écran.
   */
  readonly annotationsDoc = signal(true);
}
