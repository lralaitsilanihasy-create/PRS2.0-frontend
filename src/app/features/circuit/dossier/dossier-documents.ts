import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { ToastService } from '../../../core/notifications/toast.service';
import { ouvrirBlobSur } from '../../../core/securite/fichiers-surs';
import { PvExamenService } from '../../../services';

import { CalendrierAnnuel } from '../../../shared/circuit/calendrier-annuel';
import { ControlesDossier } from '../../../shared/circuit/controles-dossier';
import { PublicationAgpmPanneau } from '../../../shared/circuit/publication-agpm';
import { controlesEffectifs } from '../../../shared/circuit/controles-libelles';
import { AgpmDoc } from '../../../shared/prmp/agpm-doc';
import { FicheDaoDoc } from '../../../shared/prmp/fiche-dao-doc';
import { FichePresentationDoc } from '../../../shared/prmp/fiche-presentation-doc';
import { PpmMarchesTable } from '../../../shared/prmp/ppm-marches-table';
import { DocumentVisionneuse } from '../../../shared/ui/document-visionneuse';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierInstantanes } from './dossier-instantanes';
import { DossierPieces } from './dossier-pieces';
import { DossierVersions } from './dossier-versions';
import { FichePresentationDaoDoc } from './fiche-presentation-dao';

/**
 * Documents d'un dossier : barre d'onglets (fiche, plan, AGPM, pièces, historique) et leur contenu dans
 * la visionneuse, avec l'interrupteur d'annotations commun aux onglets. Lit le `DossierContenuStore` de
 * l'hôte, qui ne monte ce bloc qu'une fois la vague chargée.
 */
@Component({
  selector: 'app-dossier-documents',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PpmMarchesTable, FichePresentationDoc, AgpmDoc, DocumentVisionneuse, DossierPieces, DossierVersions, DossierInstantanes, ControlesDossier, CalendrierAnnuel, PublicationAgpmPanneau, FicheDaoDoc, FichePresentationDaoDoc],
  host: { '[class.dc-documents--borne]': 'panneauBorne()' },
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
             Dans un panneau hôte borné (vérification), l'en-tête du plan y reste collant. -->
        <div class="dc-section">
          <!-- ⚠️ Q-pièce (14/10, backend V115) — le calendrier annuel produit par l'application, à la place de la pièce signée. -->
          <app-calendrier-annuel [idDossier]="contenu.dossier().idDossier" />
          <!-- ⚠️ V118 (15/10) — la publication de l'AGPM se dépose une fois sur le plan contrôlé ; chaque dossier du plan la reprend. -->
          <app-publication-agpm [idDossier]="contenu.dossier().idDossier" [plan]="true" />
          <app-document-visionneuse [interrupteur]="true" [(annotations)]="annotationsDoc" [class.doc-entete-collante]="panneauBorne() || enteteCollante()">
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
    @if (contenu.estPpm()) {
      @if (ongletDossier() === 'pieces') {
        <div class="dc-section">
          <app-dossier-pieces />
        </div>
      }
    } @else {
      <!-- ⚠️ Manuel révisé, R4 (V104, 13/10) — pour un dossier de procédure (DMC, DDM, DGC, DSS), les ÉCRANS FIGÉS à la soumission
           prennent place à côté des pièces jointes, en onglets ; sans instantané (dossier soumis avant V104, ou non soumis), la
           section des pièces reste seule, comme avant. -->
      @if (ongletsProcedure()) {
        <div class="onglets-dossier" role="tablist" aria-label="Éléments du dossier">
          <!-- ⚠️ 17/10 (demande « pieces-dmc-par-les-donnees », pilote) — un dossier né d'une fiche se présente comme le dossier de
               planification : ses éléments sont des DONNÉES de l'application (fiche de présentation, fiche DAO, plan contrôlé), en
               onglets, avant les pièces jointes. -->
          @if (contenu.dossier().idDmc) {
            <button type="button" class="onglets-dossier__tab onglets-dossier__tab--vert" role="tab" [class.onglets-dossier__tab--on]="ongletProcedure() === 'presentation'"
              [attr.aria-selected]="ongletProcedure() === 'presentation'" (click)="ongletChoisi.set('presentation')">Fiche de présentation</button>
            <button type="button" class="onglets-dossier__tab" role="tab" [class.onglets-dossier__tab--on]="ongletProcedure() === 'fiche-dao'"
              [attr.aria-selected]="ongletProcedure() === 'fiche-dao'" (click)="ongletChoisi.set('fiche-dao')">Fiche DAO</button>
            <button type="button" class="onglets-dossier__tab onglets-dossier__tab--bleu" role="tab" [class.onglets-dossier__tab--on]="ongletProcedure() === 'plan'"
              [attr.aria-selected]="ongletProcedure() === 'plan'" (click)="ongletChoisi.set('plan')">Plan de passation</button>
          }
          <button type="button" class="onglets-dossier__tab" role="tab" [class.onglets-dossier__tab--on]="ongletProcedure() === 'pieces'"
            [attr.aria-selected]="ongletProcedure() === 'pieces'" (click)="ongletChoisi.set('pieces')">
            Pièces jointes <span class="onglets-dossier__n">{{ contenu.pieces().length }}</span>
          </button>
          @if (contenu.instantanesVisible()) {
            <button type="button" class="onglets-dossier__tab onglets-dossier__tab--gris" role="tab" [class.onglets-dossier__tab--on]="ongletProcedure() === 'figes'"
              [attr.aria-selected]="ongletProcedure() === 'figes'" (click)="ongletChoisi.set('figes')">
              Écrans figés <span class="onglets-dossier__n">{{ contenu.instantanes().length }}</span>
            </button>
          }
          <!-- ⚠️ R5 (V105, 13/10) — les contrôles du dossier (automatiques à la soumission, B du Membre), en lecture pour tous ceux qui lisent le dossier. -->
          @if (contenu.controlesVisible()) {
            <button type="button" class="onglets-dossier__tab onglets-dossier__tab--vert" role="tab" [class.onglets-dossier__tab--on]="ongletProcedure() === 'controles'"
              [attr.aria-selected]="ongletProcedure() === 'controles'" (click)="ongletChoisi.set('controles')">
              Contrôles <span class="onglets-dossier__n">{{ nbControles() }}</span>
            </button>
          }
        </div>
      }
      @if (contenu.dossier().idDmc && ongletProcedure() === 'presentation') {
        <div class="dc-section">
          <app-document-visionneuse>
            <app-fiche-presentation-dao [idDossier]="contenu.dossier().idDossier" />
          </app-document-visionneuse>
        </div>
      }
      @if (contenu.dossier().idDmc && ongletProcedure() === 'fiche-dao') {
        <div class="dc-section">
          <!-- La fiche DAO telle que la Commission l'examine : les données, jamais un fichier. -->
          <app-document-visionneuse>
            <app-fiche-dao-doc [idDmc]="contenu.dossier().idDmc!" />
          </app-document-visionneuse>
        </div>
      }
      @if (contenu.dossier().idDmc && ongletProcedure() === 'plan') {
        <div class="dc-section dc-plan">
          <!-- Le plan contrôlé qui porte la ligne : il tient lieu de la pièce « AGPM (ou PPM) signé et contrôlé, avec le PV ». -->
          @if (contenu.dossier().idDossierPlan) {
            <p class="dc-plan__texte">La ligne de ce dossier appartient au plan de passation n° <b>{{ contenu.dossier().idDossierPlan }}</b>, examiné dans l’application.
              @if (contenu.dossier().idPvPlan) { Son PV d’examen (n° {{ contenu.dossier().idPvPlan }}) est signé. } @else { Son PV d’examen n’est pas encore signé. }</p>
            <div class="dc-plan__actions">
              @if (contenu.dossier().idPvPlan) {
                <button type="button" class="btn btn-outline btn-sm" [disabled]="ouverturePv()" (click)="ouvrirPv(contenu.dossier().idPvPlan!)">{{ ouverturePv() ? 'Production…' : 'PV de la Commission (PDF)' }}</button>
              }
              <app-calendrier-annuel [idDossier]="contenu.dossier().idDossier" />
            </div>
          } @else {
            <p class="dc-plan__texte">Le plan de la ligne n’est pas dans l’application : la pièce « AGPM (ou PPM) signé et contrôlé » se joint au dossier.</p>
          }
          <app-publication-agpm [idDossier]="contenu.dossier().idDossier" />
        </div>
      }
      @if (!ongletsProcedure() || ongletProcedure() === 'pieces') {
        <div class="dc-section">
          <!-- ⚠️ Q-pièce (14/10) — un dossier né d'une fiche DAO lit le calendrier annuel du plan de sa ligne. -->
          <!-- ⚠️ 17/10 — pour un dossier né d'une fiche, le calendrier et la publication de l'AGPM vivent à l'onglet « Plan de passation ». -->
          @if (!contenu.dossier().idDmc) {
            <!-- ⚠️ V118 (15/10) — la publication de l'AGPM du plan, reprise d'office (muette sans plan ni publication). -->
            <app-publication-agpm [idDossier]="contenu.dossier().idDossier" />
          }
          <app-dossier-pieces />
        </div>
      }
      @if (contenu.instantanesVisible() && ongletProcedure() === 'figes') {
        <div class="dc-section">
          <app-dossier-instantanes />
        </div>
      }
      @if (contenu.controlesVisible() && ongletProcedure() === 'controles') {
        <div class="dc-section">
          <app-controles-dossier [idDossier]="contenu.dossier().idDossier" [controles]="contenu.controles()" />
        </div>
      }
    }
  `,
  styles: `
    /* Sans boîte propre : la barre d'onglets et les sections restent les enfants directs du corps de
       l'hôte (défilement, en-tête collant du plan dans un panneau borné). */
    :host { display: contents; }
    .dc-section { padding: 16px 24px; }
    /* Marges resserrées dans un panneau borné (2026-09-15) : la largeur va au document. */
    :host(.dc-documents--borne) .dc-section { padding: 12px 16px; }
    .dc-plan { display: flex; flex-direction: column; gap: 0.75rem; }
    .dc-plan__texte { margin: 0; }
    .dc-plan__actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
  `,
})
export class DossierDocuments {
  protected readonly contenu = inject(DossierContenuStore);
  /**
   * Monté dans un panneau hôte BORNÉ qui porte l'ascenseur (écran de vérification) : marges resserrées,
   * et en-tête du plan collant — il s'accroche alors au panneau, pas à la fenêtre.
   */
  readonly panneauBorne = input(false);
  /**
   * En-tête du plan collant pendant le défilement de la FENÊTRE (page dossier, lot L4-F3) : il se loge sous
   * la barre du haut et sous la barre collante de la page (`--doc-entete-top`, posé par la page).
   */
  readonly enteteCollante = input(false);

  // ── Onglets du dossier (2026-09-03) : fiche / plan / AGPM / pièces / historique (2026-09-06) ──
  /** Onglet actif — ouverture sur le plan, comme le détail PPM. */
  readonly ongletDossier = signal<'ppm' | 'fiche' | 'agpm' | 'pieces' | 'historique'>('ppm');
  /** ⚠️ R4 / R5 (13/10) — dossier de procédure : pièces jointes (ouverture), écrans figés à la soumission, contrôles. */
  readonly ongletChoisi = signal<'presentation' | 'fiche-dao' | 'plan' | 'pieces' | 'figes' | 'controles' | null>(null);
  /** ⚠️ 17/10 — un dossier né d'une fiche s'ouvre sur sa fiche de présentation, comme le dossier de planification sur son plan. */
  readonly ongletProcedure = computed(() => this.ongletChoisi() ?? (this.contenu.dossier().idDmc ? 'presentation' : 'pieces'));
  readonly ongletsProcedure = computed(() => !!this.contenu.dossier().idDmc || this.contenu.instantanesVisible() || this.contenu.controlesVisible());
  private readonly pvService = inject(PvExamenService);
  private readonly toast = inject(ToastService);
  readonly ouverturePv = signal(false);
  /** Le PV signé de l'examen du plan, en PDF (il tient lieu de l'AGPM contrôlé). */
  ouvrirPv(idPv: number): void {
    this.ouverturePv.set(true);
    this.pvService.document(idPv).subscribe({
      next: (b) => { this.ouverturePv.set(false); ouvrirBlobSur(b); },
      error: () => { this.ouverturePv.set(false); this.toast.error('Le PV n’a pas pu être ouvert.'); },
    });
  }
  /** Les contrôles tels qu'ils comptent (par règle, le dernier résultat posé) — l'historique complet reste dans l'onglet. */
  readonly nbControles = computed(() => controlesEffectifs(this.contenu.controles()).length);
  /**
   * ⚠️ 2026-09-14 (décision des chefs) — annotations des documents officiels visibles (statut du
   * marché, versionnement, état d'examen…) : un seul interrupteur pour tous les onglets de l'écran.
   */
  readonly annotationsDoc = signal(true);
}
