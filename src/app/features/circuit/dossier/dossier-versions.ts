import { ChangeDetectionStrategy, Component, inject, model } from '@angular/core';
import { DatePipe } from '@angular/common';

import { AgpmDoc } from '../../../shared/prmp/agpm-doc';
import { FichePresentationDoc } from '../../../shared/prmp/fiche-presentation-doc';
import { PpmMarchesTable } from '../../../shared/prmp/ppm-marches-table';
import { DocumentVisionneuse } from '../../../shared/ui/document-visionneuse';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { DossierContenuStore } from './dossier-contenu.store';

/**
 * Historique des versions d'un dossier : sélecteur, bandeau de la version choisie et sa vue en lecture
 * seule (plan, fiche, AGPM en sous-onglets). La sélection est tenue par le `DossierContenuStore` de
 * l'hôte ; l'hôte ne monte ce bloc que si `historiqueVersionsVisible()`.
 */
@Component({
  selector: 'app-dossier-versions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, PpmMarchesTable, FichePresentationDoc, AgpmDoc, EtatErreur, DocumentVisionneuse],
  template: `
    <div class="dc-section-head">
      <div class="section-block-title">
        <div class="section-icon">🗂</div>
        <span class="section-label">Historique des versions</span>
        <span class="section-count">{{ contenu.versionsArchivees().length }} version(s) archivée(s)</span>
      </div>
    </div>
    <p class="dc-hist-intro">
      Chaque rectification archive la version qu'elle remplace, telle qu'elle était. La version
      courante est celle du dossier. Sélectionnez une version pour l'afficher en lecture seule.
    </p>
    <!-- Sélecteur de version (demande pilote 2026-09-12) : la plus récente en tête, la
         courante d'abord ; les métadonnées de la version choisie sont reprises dans le
         bandeau ci-dessous. -->
    <div class="dc-hist__select">
      <label for="dc-hist-version">Version à afficher</label>
      <select id="dc-hist-version" class="form-control" (change)="contenu.choisirVersion($any($event.target).value)">
        <option value="courante" [selected]="contenu.versionAffichee() === null">
          En vigueur (n° {{ contenu.versionsArchivees().length + 1 }}) — {{ contenu.marches().length }} ligne(s)@if (contenu.derniereRectification()?.dateVersion) {, {{ contenu.derniereRectification()!.dateVersion | date: 'dd/MM/yyyy HH:mm' }}}
        </option>
        @for (v of contenu.versionsArchiveesRecentesDAbord(); track v.numero) {
          <option [value]="v.numero" [selected]="contenu.versionAffichee() === v.numero">
            {{ origineLabel(v.origine) }} n° {{ v.numero }}@if (v.cycle != null) {, cycle {{ v.cycle }}} · {{ v.dateVersion | date: 'dd/MM/yyyy HH:mm' }} · {{ v.nbLignes }} ligne(s)
          </option>
        }
      </select>
    </div>

    <!-- La version sélectionnée, dans le MÊME tableau partagé que le plan courant (lecture seule,
         sans surlignage : une version archivée n'est comparée à rien). -->
    <div class="dc-hist-vue">
      @if (contenu.versionAffichee() === null) {
        <div class="dc-hist-bandeau">
          <span class="badge dc-hist__courante">En vigueur</span>
          <span>{{ contenu.marches().length }} marché(s) · état actuel du dossier</span>
        </div>
        <app-document-visionneuse [interrupteur]="true" [(annotations)]="annotations">
          <app-ppm-marches-table [marches]="contenu.marches()" [beneficiaires]="contenu.serviceBenefs()" [previsions]="contenu.previsions()" />
        </app-document-visionneuse>
      } @else if (contenu.versionChargement()) {
        <div class="spinner-wrap dc-load" role="status" aria-label="Chargement de la version"><div class="spinner"></div></div>
      } @else if (contenu.versionErreur()) {
        <app-etat-erreur [message]="'Chargement impossible de la version n° ' + contenu.versionAffichee() + '.'" (reessayer)="contenu.reessayerVersion()" />
      } @else if (contenu.versionVue(); as vue) {
        <div class="dc-hist-bandeau">
          <span class="badge dc-hist__archivee">{{ origineLabel(vue.detail.version.origine) }} n° {{ vue.detail.version.numero }}</span>
          <span>
            archivée le {{ vue.detail.version.dateVersion | date: 'dd/MM/yyyy à HH:mm' }}
            par {{ vue.detail.version.nomAuteur || vue.detail.version.auteur || vue.detail.version.idPrmpAuteur || '—' }}@if (vue.detail.version.cycle != null) { · cycle {{ vue.detail.version.cycle }} }
            @if (vue.detail.version.reference) { · réf. {{ vue.detail.version.reference }} }
            @if (vue.detail.version.dateSignature) { · signé le {{ vue.detail.version.dateSignature | date: 'dd/MM/yyyy' }} }
          </span>
        </div>
        <!-- ⚠️ Demande pilote (2026-09-06) — les COMPOSANTES de la version archivée :
             fiche de présentation et AGPM DÉRIVÉS des lignes figées, par les MÊMES
             fonctions pures que le dossier courant. (Les pièces jointes ne se versionnent
             pas : l'onglet Pièces garde originaux ET versions corrigées, rien ne s'y perd.) -->
        <div class="onglets-dossier dc-hist-sousonglets" role="tablist" aria-label="Composantes de la version affichée">
          <button type="button" class="onglets-dossier__tab onglets-dossier__tab--bleu" role="tab" [class.onglets-dossier__tab--on]="contenu.ongletVersion() === 'plan'"
            [attr.aria-selected]="contenu.ongletVersion() === 'plan'" (click)="contenu.ongletVersion.set('plan')">
            Plan de passation <span class="onglets-dossier__n">{{ vue.marches.length }}</span>
          </button>
          <button type="button" class="onglets-dossier__tab onglets-dossier__tab--vert" role="tab" [class.onglets-dossier__tab--on]="contenu.ongletVersion() === 'fiche'"
            [attr.aria-selected]="contenu.ongletVersion() === 'fiche'" (click)="contenu.ongletVersion.set('fiche')">
            Fiche de présentation <span class="onglets-dossier__n">{{ contenu.ficheVersion()?.nbMarchesConcernes ?? 0 }}</span>
          </button>
          @if (contenu.agpmVersion().length) {
            <button type="button" class="onglets-dossier__tab" role="tab" [class.onglets-dossier__tab--on]="contenu.ongletVersion() === 'agpm'"
              [attr.aria-selected]="contenu.ongletVersion() === 'agpm'" (click)="contenu.ongletVersion.set('agpm')">
              Projet d'AGPM <span class="onglets-dossier__n">{{ contenu.agpmVersion().length }}</span>
            </button>
          }
        </div>
        @if (contenu.ongletVersion() === 'plan') {
          <app-document-visionneuse [interrupteur]="true" [(annotations)]="annotations">
            <app-ppm-marches-table [marches]="vue.marches" [beneficiaires]="vue.beneficiaires" [previsions]="vue.previsions" />
          </app-document-visionneuse>
        }
        @if (contenu.ongletVersion() === 'fiche') {
          @if (contenu.ficheVersion(); as fiche) {
            <app-document-visionneuse>
              <app-fiche-presentation-doc
                [fiche]="fiche"
                [exercice]="vue.detail.version.exercice ?? contenu.ppm()?.exercice"
                [libelleVersion]="'Version n° ' + vue.detail.version.numero + ' (archivée)'"
              />
            </app-document-visionneuse>
          }
        }
        @if (contenu.ongletVersion() === 'agpm') {
          <app-document-visionneuse>
            <app-agpm-doc
              [lignes]="contenu.agpmVersion()"
              [exercice]="vue.detail.version.exercice ?? contenu.ppm()?.exercice"
              [entite]="contenu.entiteLabel()"
              [signataire]="vue.detail.version.signataire ?? contenu.ppm()?.signataire"
              [dateInitiale]="vue.detail.version.dateSignature ?? contenu.ppm()?.dateSignature"
            />
          </app-document-visionneuse>
        }
      }
    </div>
  `,
  styles: `
    /* Sans boîte propre : ses éléments restent les enfants directs de la section de l'hôte. */
    :host { display: contents; }
    .dc-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 1rem; }
    /* Hauteur réservée pendant le chargement : le contenu remplace le spinner sans saut brutal. */
    .dc-load { min-height: 18rem; }
    /* Historique des versions (2026-09-06) : liste au langage du journal, version affichée marquée,
       bandeau d'identité au-dessus du tableau partagé. Tokens du design system uniquement. */
    .dc-hist-intro { margin: 0 0 12px; font-size: 12.5px; color: var(--n-500); }
    .dc-hist__select { display: flex; align-items: center; gap: 0.6rem; margin: 0 0 16px; flex-wrap: wrap; }
    .dc-hist__select label { font-weight: 600; color: var(--n-700); }
    .dc-hist__select select { max-width: 44rem; }
    .dc-hist { margin-bottom: 14px; }
    .dc-hist th.dc-hist__num, .dc-hist td.dc-hist__num { text-align: right; font-variant-numeric: tabular-nums; }
    .dc-hist th.dc-hist__action, .dc-hist td.dc-hist__action { text-align: right; white-space: nowrap; }
    .dc-hist tbody tr.dc-hist__on td { background: var(--info-bg); }
    .dc-hist__affichee { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--info-text); }
    .dc-hist__courante { background: var(--success-bg); color: var(--success-text); }
    .dc-hist__archivee { background: var(--n-100); color: var(--n-500); }
    .dc-hist-bandeau { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; font-size: 12.5px; color: var(--n-500); }
    /* Sous-onglets des composantes d'une version archivée (2026-09-06) : mêmes classes partagées,
       en plus discret que la barre principale du dossier. */
    .dc-hist-sousonglets { margin: 0 0 10px; }
  `,
})
export class DossierVersions {
  protected readonly contenu = inject(DossierContenuStore);
  /** Interrupteur « Annotations » partagé avec les autres onglets de l'hôte (liaison à double sens). */
  readonly annotations = model(true);

  /** Libellé de l'origine d'une version (code brut si inconnu — le backend reste l'autorité). */
  origineLabel(origine: string): string {
    switch (origine) {
      case 'RECTIFICATION': return 'Rectification';
      case 'MISE_A_JOUR': return 'Mise à jour';
      default: return origine;
    }
  }
}
