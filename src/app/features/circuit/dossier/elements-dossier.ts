import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { Dossier } from '../../../models';
import { DossierService } from '../../../services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { Icone, NomIcone } from '../../../shared/ui/icone';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierDocuments } from './dossier-documents';
import { OngletDossier, documentsDuDossier } from './documents-du-dossier';

const ICONES: Record<OngletDossier, NomIcone> = {
  presentation: 'file', 'fiche-dao': 'edit', avis: 'send', plan: 'calendar', canevas: 'columns', bordereau: 'table',
  pieces: 'clip', figes: 'layers', controles: 'shield',
};

/**
 * ⚠️ 18/10 (pilote) — les éléments d'un dossier né d'une fiche, en cartes (fond pastel, icône cerclée, titre, résumé) ; chacune
 * s'ouvre en modale (`DossierDocuments`, élément imposé). Lit le `DossierContenuStore` de l'hôte : la page du dossier, ou
 * `ElementsDossierAutonome` ailleurs (écran de demande de retrait).
 */
@Component({
  selector: 'app-elements-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, ModaleDirective, DossierDocuments],
  styleUrl: './elements-dossier.scss',
  template: `
    <div class="pd-docs" role="group" aria-labelledby="pd-docs-titre">
      <span class="pd-docs__titre" id="pd-docs-titre">{{ titre() }}</span>
      <div class="pd-docs__cartes">
        @for (o of documents(); track o.cle) {
          <button type="button" class="pd-carte pd-carte--{{ o.cle }}" [class.pd-carte--alerte]="o.cle === 'pieces' && manquantes() > 0"
            (click)="ouvert.set(o.cle)">
            <span class="pd-carte__icone"><app-icone [nom]="icone(o.cle)" [taille]="22" /></span>
            <span class="pd-carte__texte">
              <span class="pd-carte__tete">
                <span class="pd-carte__nom">{{ o.libelle }}</span>
                @if (o.n !== undefined) { <span class="pd-carte__n">{{ o.n }}</span> }
              </span>
              @if (o.resume) { <span class="pd-carte__resume">{{ o.resume }}</span> }
            </span>
          </button>
        }
      </div>
    </div>
    @if (ouvert(); as cle) {
      <div class="modal-backdrop">
        <div class="modal pd-docmodal" role="dialog" aria-modal="true" [attr.aria-label]="libelle(cle) + ' — ' + reference()"
          appModale (appModaleFermer)="fermer()">
          <div class="modal-header">
            <h2 class="modal-title">{{ libelle(cle) }} <span class="pd-docmodal__ref">· {{ reference() }}</span></h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermer()">✕</button>
          </div>
          <div class="modal-body pd-docmodal__corps">
            <app-dossier-documents [ongletImpose]="cle" (ongletDemande)="ouvert.set($event)" (liaisonChangee)="fermer(); liaisonChangee.emit()" />
          </div>
        </div>
      </div>
    }
  `,
})
export class ElementsDossier {
  private readonly contenu = inject(DossierContenuStore);

  /** La référence affichée dans le titre des modales (« Dossier n° 100380 »). */
  readonly reference = input.required<string>();
  readonly titre = input('Le dossier');
  /** Le nombre de pièces obligatoires manquantes (brouillon) : la carte « Pièces jointes » passe en alerte. */
  readonly manquantes = input(0);
  /** La fiche a été détachée depuis la modale « Fiche DAO ». */
  readonly liaisonChangee = output<void>();
  /** Une modale vient de se fermer (un dépôt a pu s'y faire). */
  readonly modaleFermee = output<void>();

  readonly ouvert = signal<OngletDossier | null>(null);
  readonly documents = computed(() => documentsDuDossier(this.contenu, this.manquantes()));

  icone(cle: OngletDossier): NomIcone { return ICONES[cle]; }
  libelle(cle: OngletDossier): string { return this.documents().find((o) => o.cle === cle)?.libelle ?? 'Dossier'; }
  fermer(): void {
    this.ouvert.set(null);
    this.modaleFermee.emit();
  }
}

/**
 * ⚠️ 18/10 (pilote) — les cartes du dossier hors de sa page (écran de demande de retrait) : relit le dossier par sa lecture unitaire
 * (les listes ne portent ni la fiche ni le plan), charge son propre magasin, puis montre les cartes.
 */
@Component({
  selector: 'app-elements-dossier-autonome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ElementsDossier],
  providers: [DossierContenuStore],
  template: `
    @if (pret()) {
      <app-elements-dossier class="sans-filet" [reference]="reference()" [titre]="titre()" />
    } @else if (echec()) {
      <p class="ea-aide">Les éléments du dossier n’ont pas pu être lus.</p>
    } @else {
      <p class="ea-aide" role="status">Chargement des éléments du dossier…</p>
    }
  `,
  styles: `
    :host { display: block; }
    .ea-aide { margin: 0; font-size: 0.82rem; color: #5b6784; }
  `,
})
export class ElementsDossierAutonome implements OnInit {
  private readonly dossiers = inject(DossierService);
  private readonly contenu = inject(DossierContenuStore);

  readonly idDossier = input.required<number>();
  readonly titre = input('Le dossier');
  private readonly dossier = signal<Dossier | null>(null);
  readonly echec = signal(false);
  readonly pret = computed(() => this.dossier() !== null && !this.contenu.loading());
  readonly reference = computed(() => {
    const d = this.dossier();
    return d ? d.refeDossier || `Dossier n° ${d.idDossier}` : '';
  });

  ngOnInit(): void {
    this.dossiers.getById(this.idDossier()).subscribe({
      next: (d) => {
        const lu = signal(d);
        this.contenu.charger(lu.asReadonly());
        this.dossier.set(d);
      },
      error: () => this.echec.set(true),
    });
  }
}
