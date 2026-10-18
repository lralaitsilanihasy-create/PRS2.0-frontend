import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { ToastService } from '../../../core/notifications/toast.service';
import { ouvrirBlobSur } from '../../../core/securite/fichiers-surs';
import { PieceJointeDossier } from '../../../models';
import { PieceJointeDossierService, PvExamenService } from '../../../services';

import { CalendrierAnnuel } from '../../../shared/circuit/calendrier-annuel';
import { ControlesDossier } from '../../../shared/circuit/controles-dossier';
import { PublicationAgpmPanneau } from '../../../shared/circuit/publication-agpm';
import { AgpmDoc } from '../../../shared/prmp/agpm-doc';
import { FicheDaoDoc } from '../../../shared/prmp/fiche-dao-doc';
import { FichePresentationDoc } from '../../../shared/prmp/fiche-presentation-doc';
import { PpmMarchesTable } from '../../../shared/prmp/ppm-marches-table';
import { DocumentVisionneuse } from '../../../shared/ui/document-visionneuse';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierInstantanes } from './dossier-instantanes';
import { DocumentDuDossier, OngletDossier, documentsDuDossier, fichiersDeLOnglet } from './documents-du-dossier';
import { DossierPieces } from './dossier-pieces';
import { AvisSpecifiqueDoc } from './avis-specifique-doc';
import { BordereauEstimatifDoc } from './bordereau-estimatif-doc';
import { CanevasRapportDoc } from './canevas-rapport-doc';
import { DossierVersions } from './dossier-versions';
import { FichePresentationDaoDoc } from './fiche-presentation-dao';
import { PlanDuDossierDao } from './plan-du-dossier-dao';
import { FicheMarcheDossier } from '../page-dossier/fiche-marche-dossier';

/**
 * Documents d'un dossier : barre d'onglets (fiche, plan, AGPM, pièces, historique) et leur contenu dans
 * la visionneuse, avec l'interrupteur d'annotations commun aux onglets. Lit le `DossierContenuStore` de
 * l'hôte, qui ne monte ce bloc qu'une fois la vague chargée.
 */
@Component({
  selector: 'app-dossier-documents',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PpmMarchesTable, FichePresentationDoc, AgpmDoc, DocumentVisionneuse, DossierPieces, DossierVersions, DossierInstantanes, ControlesDossier, CalendrierAnnuel, PublicationAgpmPanneau, FicheDaoDoc, FichePresentationDaoDoc, PlanDuDossierDao, CanevasRapportDoc, BordereauEstimatifDoc, AvisSpecifiqueDoc, FicheMarcheDossier],
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
          <app-dossier-pieces [sansEntete]="!!ongletImpose()" (voir)="voirOnglet($event)" />
        </div>
      }
    } @else {
      <!-- ⚠️ Manuel révisé, R4 (V104, 13/10) — pour un dossier de procédure (DMC, DDM, DGC, DSS), les ÉCRANS FIGÉS à la soumission
           prennent place à côté des pièces jointes, en onglets ; sans instantané (dossier soumis avant V104, ou non soumis), la
           section des pièces reste seule, comme avant. -->
      @if (ongletsProcedure()) {
        <!-- ⚠️ 18/10 — les éléments viennent de la liste commune (documentsDuDossier) : la page du dossier né d'une fiche les sert en
             boutons de son panneau d'étape, qui ouvrent ce même composant en modale (onglet imposé, sans barre). -->
        <div class="onglets-dossier" role="tablist" aria-label="Éléments du dossier">
          @for (o of documents(); track o.cle) {
            <button type="button" class="onglets-dossier__tab" role="tab" [class.onglets-dossier__tab--vert]="o.teinte === 'vert'"
              [class.onglets-dossier__tab--bleu]="o.teinte === 'bleu'" [class.onglets-dossier__tab--gris]="o.teinte === 'gris'"
              [class.onglets-dossier__tab--on]="ongletProcedure() === o.cle" [attr.aria-selected]="ongletProcedure() === o.cle" (click)="ongletChoisi.set(o.cle)">
              {{ o.libelle }} @if (o.n !== undefined) {<span class="onglets-dossier__n">{{ o.n }}</span> }
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
          <!-- ⚠️ 18/10 (pilote) — dans la modale de la page, l'état de la fiche et ses gestes (ouvrir, détacher) remplacent l'ancien encart. -->
          @if (ongletImpose()) {
            <app-fiche-marche-dossier [dossier]="contenu.dossier()" [enModale]="true" (liaisonChangee)="liaisonChangee.emit()" />
          }
          <!-- ⚠️ 18/10 — le DAO complet en est le rendu dans le modèle type : son PDF reste à portée, pour le texte type (IC, CCAG, modèles). -->
          <app-document-visionneuse>
            <app-fiche-dao-doc [idDmc]="contenu.dossier().idDmc!">
              @for (p of fichiersOnglet('fiche-dao'); track p.idPiece) {
                <button ficheActions type="button" class="btn btn-outline btn-sm" title="Le rendu de cette fiche dans le modèle type (texte type : IC, CCAG, modèles)" (click)="ouvrirPiece(p)">DAO complet (PDF) ↗</button>
              }
            </app-fiche-dao-doc>
          </app-document-visionneuse>
        </div>
      }
      @if (contenu.dossier().idDmc && ongletProcedure() === 'avis') {
        <div class="dc-section">
          <div class="dc-fichiers">
            <span>La pièce jointe d’office :</span>
            @for (p of fichiersOnglet('avis'); track p.idPiece) {
              <button type="button" class="btn btn-outline btn-sm" (click)="ouvrirPiece(p)">{{ p.nomFichier }} ↗</button>
            }
          </div>
          <app-document-visionneuse>
            <app-avis-specifique-doc [idDossier]="contenu.dossier().idDossier" />
          </app-document-visionneuse>
        </div>
      }
      @if (contenu.dossier().idDmc && ongletProcedure() === 'bordereau') {
        <div class="dc-section">
          @if (fichiersOnglet('bordereau').length) {
            <div class="dc-fichiers">
              <span>La pièce jointe d’office :</span>
              @for (p of fichiersOnglet('bordereau'); track p.idPiece) {
                <button type="button" class="btn btn-outline btn-sm" (click)="ouvrirPiece(p)">{{ p.nomFichier }} ↗</button>
              }
            </div>
          }
          <app-document-visionneuse>
            <app-bordereau-estimatif-doc [idDmc]="contenu.dossier().idDmc!" [versionSoumise]="contenu.dossier().ficheMarche?.versionSoumise" />
          </app-document-visionneuse>
        </div>
      }
      @if (avecCanevas() && ongletProcedure() === 'canevas') {
        <div class="dc-section">
          <app-document-visionneuse>
            <app-canevas-rapport-doc [idDossier]="contenu.dossier().idDossier" />
          </app-document-visionneuse>
        </div>
      }
      @if (contenu.dossier().idDmc && ongletProcedure() === 'plan') {
        <div class="dc-section dc-plan">
          <!-- Le plan contrôlé qui porte la ligne : il tient lieu de la pièce « AGPM (ou PPM) signé et contrôlé, avec le PV ». -->
          @if (contenu.dossier().idDossierPlan) {
            <!-- ⚠️ 18/10 (pilote, « supprimer la redondance ») — un seul bandeau : le plan, son PV, et leurs deux PDF. -->
            <div class="dc-plan__bandeau">
              <p class="dc-plan__texte">Plan de passation n° <b>{{ contenu.dossier().idDossierPlan }}</b> ·
                @if (contenu.dossier().idPvPlan) { PV d’examen n° {{ contenu.dossier().idPvPlan }}, signé } @else { PV d’examen non signé }</p>
              <div class="dc-plan__actions">
                @if (contenu.dossier().idPvPlan) {
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="ouverturePv()" (click)="ouvrirPv(contenu.dossier().idPvPlan!)">{{ ouverturePv() ? 'Production…' : 'PV de la Commission (PDF)' }}</button>
                }
                <app-calendrier-annuel [idDossier]="contenu.dossier().idDossier" [enLigne]="true" />
              </div>
            </div>
            <!-- ⚠️ 17/10 (pilote) — le plan lui-même, présenté comme dans le dossier de planification, la ligne du dossier surlignée. -->
            <app-plan-du-dossier-dao [idDossierPlan]="contenu.dossier().idDossierPlan!" [idDetail]="contenu.dossier().ficheMarche?.idDetail" />
          } @else {
            <p class="dc-plan__texte">Le plan de la ligne n’est pas dans l’application : la pièce « AGPM (ou PPM) signé et contrôlé » se joint au dossier.</p>
          }
          <app-publication-agpm [idDossier]="contenu.dossier().idDossier" />
        </div>
      }
      <!-- ⚠️ 18/10 (pilote) — en modale (onglet imposé), les pièces ne s'affichent que dans la modale « Pièces jointes ». -->
      @if ((!ongletsProcedure() && !ongletImpose()) || ongletProcedure() === 'pieces') {
        <div class="dc-section">
          <!-- ⚠️ Q-pièce (14/10) — un dossier né d'une fiche DAO lit le calendrier annuel du plan de sa ligne. -->
          <!-- ⚠️ 17/10 — pour un dossier né d'une fiche, le calendrier et la publication de l'AGPM vivent à l'onglet « Plan de passation ». -->
          @if (!contenu.dossier().idDmc) {
            <!-- ⚠️ V118 (15/10) — la publication de l'AGPM du plan, reprise d'office (muette sans plan ni publication). -->
            <app-publication-agpm [idDossier]="contenu.dossier().idDossier" />
          }
          <app-dossier-pieces [sansEntete]="!!ongletImpose()" (voir)="voirOnglet($event)" />
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
    .dc-fichiers { display: flex; align-items: center; gap: 0.5rem 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem; font-size: 0.85rem; color: var(--n-700); }
    .dc-plan__bandeau { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem 1.5rem; flex-wrap: wrap;
      padding: 0.6rem 0.9rem; border: 1px solid var(--n-200); border-radius: var(--radius-lg, 10px); background: #fff; }
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
  readonly ongletChoisi = signal<OngletDossier | null>(null);
  /** ⚠️ 18/10 (pilote) — sur la page du dossier né d'une fiche, la modale impose l'élément ouvert : pas de barre d'onglets. */
  readonly ongletImpose = input<OngletDossier | null>(null);
  /** Un renvoi de la liste des pièces, en mode imposé : l'hôte change l'élément de sa modale. */
  readonly ongletDemande = output<OngletDossier>();
  /** La fiche a été détachée depuis la modale : l'hôte relit le dossier. */
  readonly liaisonChangee = output<void>();
  readonly documents = computed<DocumentDuDossier[]>(() => documentsDuDossier(this.contenu));
  voirOnglet(o: OngletDossier): void {
    if (this.ongletImpose()) this.ongletDemande.emit(o);
    else this.ongletChoisi.set(o);
  }
  /** ⚠️ 17/10 (« canevas-rapport-evaluation ») — le canevas de rapport d'évaluation : dossier né d'une fiche, hors contrat-cadre. */
  readonly avecCanevas = computed(() => !!this.contenu.dossier().idDmc && this.contenu.dossier().ficheMarche?.typeMarche !== 'CONTRAT_CADRE');
  /** ⚠️ 17/10 — un dossier né d'une fiche s'ouvre sur sa fiche de présentation, comme le dossier de planification sur son plan. */
  readonly ongletProcedure = computed(() => this.ongletImpose() ?? this.ongletChoisi() ?? (this.contenu.dossier().idDmc ? 'presentation' : 'pieces'));
  readonly ongletsProcedure = computed(() => !this.ongletImpose()
    && (!!this.contenu.dossier().idDmc || this.contenu.instantanesVisible() || this.contenu.controlesVisible()));
  private readonly pvService = inject(PvExamenService);
  private readonly toast = inject(ToastService);
  private readonly pieceService = inject(PieceJointeDossierService);

  /** ⚠️ 18/10 — les fichiers produits par la fiche que montre un onglet (hors pièces d'après lettre de renvoi). */
  fichiersOnglet(onglet: 'fiche-dao' | 'avis' | 'bordereau'): PieceJointeDossier[] {
    return fichiersDeLOnglet(this.contenu.pieces(), onglet);
  }

  ouvrirPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) return;
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (b) => ouvrirBlobSur(b),
      error: () => this.toast.error('Impossible d’ouvrir la pièce.'),
    });
  }
  readonly ouverturePv = signal(false);
  /** Le PV signé de l'examen du plan, en PDF (il tient lieu de l'AGPM contrôlé). */
  ouvrirPv(idPv: number): void {
    this.ouverturePv.set(true);
    this.pvService.document(idPv).subscribe({
      next: (b) => { this.ouverturePv.set(false); ouvrirBlobSur(b); },
      error: () => { this.ouverturePv.set(false); this.toast.error('Le PV n’a pas pu être ouvert.'); },
    });
  }
  /**
   * ⚠️ 2026-09-14 (décision des chefs) — annotations des documents officiels visibles (statut du
   * marché, versionnement, état d'examen…) : un seul interrupteur pour tous les onglets de l'écran.
   */
  readonly annotationsDoc = signal(true);
}
