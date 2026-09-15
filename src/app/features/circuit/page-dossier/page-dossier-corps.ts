import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink, UrlTree } from '@angular/router';

import { Dossier } from '../../../models';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { ChronometrageDossier, StatutBadge } from '../../../shared/circuit';
import { jourSemaineDate } from '../../../shared/circuit/frise-delai';
import { Icone } from '../../../shared/ui/icone';
import { DossierContenuStore } from '../dossier/dossier-contenu.store';
import { DossierDocuments } from '../dossier/dossier-documents';
import { DossierIdentite } from '../dossier/dossier-identite';
import { DossierJournal } from '../dossier/dossier-journal';
import { RetourPage, etapesPage, referenceDossier } from './page-dossier-modele';

/**
 * Corps de la page dossier (lot L4-F2), une fois le dossier ouvert : fil d'Ariane et outils, identité,
 * frise des sept étapes, fin de traitement prévue, documents. Fournit le `DossierContenuStore` — la
 * même vague et les mêmes règles par profil que la modale de consultation — et assemble ses blocs.
 *
 * Règle C2 (audit 2026-09-14) : pour la PRMP et l'UGPM, ni journal ni chronométrage (le store ne les
 * demande pas, les boutons n'existent pas), et la frise ne porte que des dates.
 *
 * Lot F3 : le panneau de l'étape en cours se place entre la frise et les documents.
 */
@Component({
  selector: 'app-page-dossier-corps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icone, StatutBadge, ModaleDirective, ChronometrageDossier, DossierIdentite, DossierDocuments, DossierJournal],
  providers: [DossierContenuStore],
  template: `
    <div class="pd">
      <div class="pd-fil">
        <nav class="pd-ariane" aria-label="Fil d'Ariane">
          <a class="pd-ariane__retour" [routerLink]="retourLien()"><app-icone nom="chevl" [taille]="15" />{{ retour().libelle }}</a>
          <app-icone class="pd-ariane__sep" nom="chev" [taille]="13" />
          <span class="pd-ariane__ici" aria-current="page">{{ reference() }}</span>
        </nav>
        <!-- Restitutions INTERNES CNM (demande pilote du 06/09) : jamais pour la PRMP ni l'UGPM. -->
        @if (contenu.restitutionsVisibles() && !contenu.loading()) {
          <div class="pd-outils">
            @if (contenu.journalVisible().length) {
              <button type="button" class="btn btn-outline btn-sm pd-outil" (click)="journalOuvert.set(true)">
                <app-icone nom="history" [taille]="16" />Journal
                <span class="pd-outil__n">{{ contenu.journalVisible().length }}<span class="cnm-sr-only"> actions</span></span>
              </button>
            }
            @if (contenu.chronoDispo()) {
              <button type="button" class="btn btn-outline btn-sm pd-outil" (click)="chronoOuvert.set(true)">
                <app-icone nom="clock" [taille]="16" />Délais
              </button>
            }
          </div>
        }
      </div>

      <header class="pd-tete">
        <div class="pd-id">
          <h1 class="pd-ref" [class.pd-ref--sans]="!dossier().refeDossier">{{ reference() }}</h1>
          <p class="pd-ent">
            @if (!contenu.loading()) {
              {{ ligneEntite() }}
            }
          </p>
          <div class="pd-puces">
            <app-statut-badge [statut]="dossier().statut" />
            @if (sousType()) {
              <span class="pd-puce">{{ sousType() }}</span>
            }
            @if (!contenu.loading()) {
              <span class="pd-puce">{{ contenu.localiteLabel() }}</span>
              @if (contenu.estPpm()) {
                <span class="pd-puce">{{ contenu.marches().length }} {{ contenu.marches().length > 1 ? 'lignes' : 'ligne' }}</span>
              }
              @if (contenu.montrerReferencePpm() && contenu.ppm()?.reference) {
                <span class="pd-puce" title="Référence du plan chez la PRMP">Réf. PRMP {{ contenu.ppm()?.reference }}</span>
              }
              <button type="button" class="pd-deplier" [attr.aria-expanded]="identiteOuverte()" (click)="identiteOuverte.set(!identiteOuverte())">
                Identité du dossier<app-icone [nom]="identiteOuverte() ? 'chevd' : 'chev'" [taille]="14" />
              </button>
            }
          </div>
        </div>
        @if (finPrevue()) {
          <p class="pd-fin">Fin de traitement prévue<b>{{ finPrevue() }}</b></p>
        }
      </header>

      @if (identiteOuverte() && !contenu.loading()) {
        <app-dossier-identite class="pd-identite" />
      }

      <ol class="pd-frise" aria-label="Étapes du circuit">
        @for (e of etapes(); track e.cle) {
          <li class="pd-etape pd-etape--{{ e.etat }}" [attr.title]="e.infobulle">
            <span class="pd-etape__pt" aria-hidden="true">
              @if (e.etat === 'faite') {
                <app-icone nom="check" [taille]="15" />
              } @else {
                {{ e.numero }}
              }
            </span>
            <span class="pd-etape__l">{{ e.libelle }}</span>
            <span class="pd-etape__d" aria-hidden="true">{{ e.date }}</span>
            <span class="cnm-sr-only">{{ e.lu }}</span>
          </li>
        }
      </ol>

      <section class="pd-documents" aria-label="Documents du dossier">
        @if (contenu.loading()) {
          <div class="pd-attente" role="status">
            <div class="spinner" aria-hidden="true"></div>
            <span class="cnm-sr-only">Chargement des documents du dossier…</span>
          </div>
        } @else {
          <app-dossier-documents />
        }
      </section>
    </div>

    <!-- Sous-dialogues des restitutions (demande pilote du 06/09) : mêmes blocs que la modale. -->
    @if (chronoOuvert()) {
      <div class="modal-backdrop">
        <div class="modal modal-lg pd-sousmodal" role="dialog" aria-modal="true"
          [attr.aria-label]="'Chronométrage et délais — ' + reference()"
          appModale appModaleClicExterieur (appModaleFermer)="chronoOuvert.set(false)">
          <div class="modal-header">
            <h2 class="modal-title"><app-icone nom="clock" [taille]="18" />Chronométrage et délais</h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="chronoOuvert.set(false)">✕</button>
          </div>
          <div class="modal-body pd-sousmodal__corps">
            @if (contenu.chronoDossier(); as chrono) {
              <app-chronometrage-dossier [idDossier]="dossier().idDossier" [donnees]="chrono" />
            }
          </div>
        </div>
      </div>
    }
    @if (journalOuvert()) {
      <div class="modal-backdrop">
        <div class="modal modal-lg pd-sousmodal" role="dialog" aria-modal="true"
          [attr.aria-label]="'Journal des actions — ' + reference()"
          appModale appModaleClicExterieur (appModaleFermer)="journalOuvert.set(false)">
          <div class="modal-header">
            <h2 class="modal-title"><app-icone nom="history" [taille]="18" />Journal des actions
              <span class="section-count">{{ contenu.journalVisible().length }} action(s)</span></h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="journalOuvert.set(false)">✕</button>
          </div>
          <div class="modal-body pd-sousmodal__corps">
            <app-dossier-journal />
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './page-dossier.scss',
})
export class PageDossierCorps implements OnInit {
  readonly dossier = input.required<Dossier>();
  readonly retour = input.required<RetourPage>();
  readonly retourLien = input.required<UrlTree>();

  protected readonly contenu = inject(DossierContenuStore);

  /** Bloc d'identité détaillé (exercice, signataire, mise à jour) : replié à l'ouverture, comme la modale. */
  readonly identiteOuverte = signal(false);
  readonly journalOuvert = signal(false);
  readonly chronoOuvert = signal(false);

  readonly reference = computed(() => referenceDossier(this.dossier()));
  readonly sousType = computed(() => this.dossier().idSousType ?? this.dossier().idTypeDossier ?? '');
  /** « Ministère … · Dossier de planification 2026 » — libellés résolus par la vague du store. */
  readonly ligneEntite = computed(() => {
    const exercice = this.contenu.ppm()?.exercice;
    return [this.contenu.entiteLabel(), `${this.contenu.typeLabel()}${exercice ? ' ' + exercice : ''}`].filter((x) => x && x !== '—').join(' · ');
  });
  /** Frise : acteurs au survol pour la CNM, date seule pour la PRMP et l'UGPM. */
  readonly etapes = computed(() => etapesPage(this.dossier(), this.contenu.restitutionsVisibles()));
  readonly finPrevue = computed(() => jourSemaineDate(this.dossier().datePrevisionnelleFin));

  ngOnInit(): void {
    this.contenu.charger(this.dossier);
  }
}
