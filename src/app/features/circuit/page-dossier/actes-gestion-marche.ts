import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { DemandeActe, Dossier, MarcheActes, SOUS_TYPES_MARCHE_CONTRAT_CADRE } from '../../../models';
import { ActesGestionService } from '../../../services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { ActeFormulaire, demandeVide } from './acte-formulaire';
import { LIBELLES_CATEGORIE_MARCHE, ariary, dateCourte, libelleActe, manquesDemande, marcheControle, messageRefusActe, projectionPlafond } from './actes-gestion-modele';
import { LienDossier } from './lien-dossier';

/**
 * ⚠️ **Actes de gestion d'un marché** (manuel de contrôle, tranche M5a — V98). Sur la page d'un dossier de marché (famille `DDM`) :
 * les faits retenus (montant initial, catégorie, réceptions, solde), le cumul des avenants face au **plafond du tiers**, la liste des
 * actes avec leur avis, et — pour la PRMP ou l'UGPM, une fois le marché contrôlé favorablement — le **dépôt** d'un acte, qui naît en
 * brouillon : la page de son dossier s'ouvre aussitôt pour y joindre les pièces et le soumettre.
 *
 * ⚠️ 01/11 (pilote, « ne pas encombrer l'écran ») — une BARRE d'une ligne, repliée : le nombre d'actes, la part du plafond des avenants
 * et le bouton de dépôt ; « Détails » déplie les faits du marché et la liste des actes.
 */
@Component({
  selector: 'app-actes-gestion-marche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ModaleDirective, ActeFormulaire],
  template: `
    @if (marche(); as m) {
      <!-- ⚠️ 19/10 (pilote) — rien avant le contrôle : un acte ne se dépose que sur un marché au PV favorable (FAV, FAVR). -->
      @if (m.actes.length || (redacteur() && (m.avisMarche === 'FAV' || m.avisMarche === 'FAVR'))) {
        <section class="agm" aria-labelledby="agm-titre">
          <div class="agm__barre">
            <h2 class="agm__titre" id="agm-titre">Actes de gestion</h2>
            <span class="agm__resume">{{ m.actes.length ? m.actes.length + ' acte' + (m.actes.length > 1 ? 's' : '') : 'aucun acte' }}</span>
            @if (m.plafondAvenantsHt != null) {
              <span class="agm__resume" [title]="'Avenants : ' + ariary(m.cumulAvenantsHt ?? 0) + ' sur un plafond de ' + ariary(m.plafondAvenantsHt) + ' (le tiers du montant initial)'">
                · avenants {{ ariary(m.cumulAvenantsHt ?? 0) }} / {{ ariary(m.plafondAvenantsHt) }}
                <progress class="agm__jauge" [max]="m.plafondAvenantsHt || 1" [value]="(m.cumulAvenantsHt ?? 0) < 0 ? 0 : (m.cumulAvenantsHt ?? 0)" aria-label="Part du plafond des avenants consommée"></progress>
              </span>
            }
            <span class="agm__espace"></span>
            @if (redacteur() && marcheControle(m)) {
              <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrir()">Déposer un acte de gestion</button>
            }
            <button type="button" class="btn btn-outline btn-sm" [attr.aria-expanded]="deplie()" aria-controls="agm-detail" (click)="deplie.set(!deplie())">
              Détails <span aria-hidden="true">{{ deplie() ? '▴' : '▾' }}</span></button>
          </div>
          @if (deplie()) {
          <div class="agm__detail" id="agm-detail">
          <p class="agm__faits">
            @if (m.montantInitialHt == null && contratCadre.has(m.sousTypeMarche ?? '')) {
              <span>Contrat-cadre : montants par titulaire</span>
            } @else {
              <span>Montant initial : <strong>{{ ariary(m.montantInitialHt) }}</strong> HT{{ m.sourceMontantInitial === 'DECLARE' ? ' (déclaré)' : m.sourceMontantInitial === 'PROPOSITION' ? ' (offre proposée, pas encore attribuée)' : '' }}</span>
            }
            @if (m.categorie) { <span>· {{ libellesCategorie[m.categorie] }}{{ m.sourceCategorie === 'DECLARE' ? ' (déclarée)' : '' }}</span> }
            @if (m.dateReceptionProvisoire) { <span>· réception provisoire le {{ jj(m.dateReceptionProvisoire) }}</span> }
            @if (m.dateReceptionDefinitive) { <span>· réception définitive le {{ jj(m.dateReceptionDefinitive) }}</span> }
            @if (m.dateSolde) { <span>· soldé le {{ jj(m.dateSolde) }}</span> }
          </p>
          @if (m.plafondAvenantsHt != null) {
            <div class="agm__plafond">
              <span>Avenants : <strong>{{ ariary(m.cumulAvenantsHt ?? 0) }}</strong> sur un plafond de {{ ariary(m.plafondAvenantsHt) }} (le tiers du montant initial)</span>
              <progress [max]="m.plafondAvenantsHt || 1" [value]="(m.cumulAvenantsHt ?? 0) < 0 ? 0 : (m.cumulAvenantsHt ?? 0)" aria-label="Part du plafond des avenants consommée"></progress>
            </div>
          }
          @if (m.actes.length) {
            <ul class="agm__liste">
              @for (a of m.actes; track a.idActe) {
                <li class="agm__acte">
                  <span class="agm__nom">{{ libelle(a) }}</span>
                  @if (a.sousType === 'AVN') { <span>{{ ariary(a.montantHt) }} HT{{ a.compteDansLeCumul ? '' : ' · hors cumul' }}</span> }
                  <!-- Recette du 09/10 : la référence s'attribue à la réception — un acte soumis n'en a pas encore, il n'est pas « brouillon ». -->
                  <span class="agm__ref">{{ a.refeDossier || (a.statutDossier === 'BROUILLON' ? 'brouillon' : 'référence à la réception') }}</span>
                  <span class="badge" [class.badge-success]="a.avis === 'FAV' || a.avis === 'FAVR'" [class.badge-danger]="a.avis === 'DEF'" [class.badge-neutral]="!a.avis">{{ a.avis || a.statutDossier || '—' }}</span>
                  @if (lien(a.idDossier); as l) { <a class="agm__ouvrir" [routerLink]="l">Ouvrir</a> }
                </li>
              }
            </ul>
          } @else {
            <p class="agm__vide">Aucun acte de gestion sur ce marché.</p>
          }
          @if (redacteur() && !marcheControle(m)) {
            <p class="agm__vide">Un acte de gestion se dépose une fois le marché contrôlé favorablement par la Commission.</p>
          }
          </div>
          }
        </section>
      }
    }

    @if (ouvert() && marche(); as m) {
      <div class="modal-backdrop">
        <div class="modal cnm-form agm__modale" role="dialog" aria-modal="true" aria-label="Déposer un acte de gestion" appModale (appModaleFermer)="fermer()">
          <!-- ⚠️ 01/11 (pilote, « améliorer ») — l'en-tête des autres fenêtres : titre, marché, bouton de fermeture à sa place. -->
          <div class="modal-header">
            <h2 class="modal-title">Déposer un acte de gestion <span class="agm__ref">· {{ m.refeDossier || 'marché' }}</span></h2>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermer()">✕</button>
          </div>
          <div class="modal-body">
            <app-acte-formulaire [(demande)]="demande" [montantInitialConnu]="m.montantInitialHt != null" [categorieConnue]="m.categorie != null" [desactive]="envoi()" />
            <!-- Le plafond des avenants : seulement une fois le montant saisi, en jauge, avec la marge qui reste. -->
            @if (demande().sousType === 'AVN' && demande().montantHt) {
              @if (projection(); as p) {
                <div class="agm__projection" [class.agm__projection--ko]="p.depasse" role="status">
                  <span class="agm__projection-t">Avenant n° {{ m.rangAvenantSuivant }} · cumul des avenants {{ ariary(p.cumul) }} sur un plafond de {{ ariary(p.plafond) }}</span>
                  <progress [max]="p.plafond || 1" [value]="p.cumul < 0 ? 0 : (p.cumul > p.plafond ? p.plafond : p.cumul)" aria-hidden="true"></progress>
                  <span class="agm__projection-r">{{ p.depasse ? 'Plafond dépassé de ' + ariary(p.cumul - p.plafond) + ' : le dépôt sera refusé.' : 'Il reste ' + ariary(p.plafond - p.cumul) + ' sous le plafond (le tiers du montant initial).' }}</span>
                </div>
              }
            }
            @if (refus(); as r) { <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div> }
          </div>
          <footer class="modal-footer agm__pied">
            <!-- Ce qui manque se dit près du bouton qu'il bloque, sans alerte affichée d'emblée. -->
            @if (manques().length) { <span class="agm__manque">Pour déposer : {{ manquesTexte() }}</span> }
            <button type="button" class="btn btn-outline" [disabled]="envoi()" (click)="fermer()">Annuler</button>
            <button type="button" class="btn btn-primary" [disabled]="envoi() || manques().length > 0" (click)="deposer()">{{ envoi() ? 'Dépôt…' : 'Déposer l’acte en brouillon' }}</button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: `
    .agm { background: var(--carte-fond); border: 1px solid var(--bordure); border-radius: 8px; padding: 0.5rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .agm__barre { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.6rem; }
    .agm__titre { margin: 0; font-size: 0.95rem; font-weight: 500; }
    .agm__resume { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.84rem; color: var(--texte-secondaire); }
    .agm__jauge { width: 5rem; height: 0.5rem; }
    .agm__espace { flex: 1; }
    .agm__detail { display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--bordure); }
    .agm__faits { margin: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; font-size: 0.84rem; color: var(--n-600); }
    .agm__plafond { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.84rem; }
    .agm__plafond progress { width: 100%; max-width: 28rem; }
    .agm__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    .agm__acte { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; font-size: 0.85rem; }
    .agm__nom { font-weight: 500; min-width: 9rem; }
    .agm__ref { color: var(--n-500); font-family: var(--police-texte); font-size: 0.8rem; }
    .agm__ouvrir { font-weight: 500; }
    .agm__vide { margin: 0; font-size: 0.84rem; color: var(--n-500); }
    .agm__modale { max-width: 40rem; }
    .agm__ref { font-weight: 400; color: var(--texte-secondaire); font-size: 0.9rem; }
    .agm__projection { display: flex; flex-direction: column; gap: 0.3rem; margin: 0.8rem 0 0; padding: 0.6rem 0.8rem; border-radius: 6px;
      background: var(--favorable-fond); color: var(--texte); font-size: 0.85rem; }
    .agm__projection progress { width: 100%; height: 0.5rem; }
    .agm__projection-r { font-weight: 500; color: var(--favorable-texte); }
    .agm__projection--ko { background: var(--retard-fond); }
    .agm__projection--ko .agm__projection-r { color: var(--retard-texte); }
    .agm__pied { flex-wrap: wrap; }
    .agm__manque { margin-right: auto; font-size: 0.82rem; color: var(--texte-secondaire); }
  `,
})
export class ActesGestionMarche implements OnInit {
  private readonly service = inject(ActesGestionService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly liens = inject(LienDossier);

  readonly dossier = input.required<Dossier>();

  readonly ariary = ariary;
  /** ⚠️ 30/10 (V152) — MAOO-CC et MAOR-CC : un contrat-cadre n'a pas de montant initial unique. */
  readonly contratCadre = SOUS_TYPES_MARCHE_CONTRAT_CADRE;
  readonly jj = dateCourte;
  readonly libelle = libelleActe;
  readonly marcheControle = marcheControle;
  readonly libellesCategorie = LIBELLES_CATEGORIE_MARCHE;

  readonly marche = signal<MarcheActes | null>(null);
  readonly ouvert = signal(false);
  /** ⚠️ 01/11 (pilote) — la barre est repliée : « Détails » montre les faits du marché et la liste des actes. */
  readonly deplie = signal(false);
  readonly envoi = signal(false);
  readonly refus = signal<string | null>(null);
  readonly demande = signal<DemandeActe>(demandeVide());

  /** Le dépôt est à la PRMP ou à son UGPM ; le serveur vérifie que ce sont bien ceux du marché. */
  readonly redacteur = computed(() => ['PRMP', 'UGPM'].includes(this.auth.role() ?? ''));
  readonly projection = computed(() => {
    const m = this.marche();
    return m ? projectionPlafond(m, this.demande().montantHt) : null;
  });
  readonly manques = computed(() => manquesDemande(this.demande(), this.marche()));
  /** ⚠️ 01/11 — ce qui manque, en une phrase près du bouton (« le montant hors taxes de l'avenant… »). */
  readonly manquesTexte = computed(() => this.manques().map((x) => x.charAt(0).toLowerCase() + x.slice(1).replace(/\.$/, '')).join(' ; ') + '.');

  ngOnInit(): void {
    this.charger();
  }

  /** Silencieux : un profil sans lecture, ou une route absente, ne montre simplement pas l'encart. */
  charger(): void {
    this.service.marche(this.dossier().idDossier).subscribe({
      next: (m) => this.marche.set(m),
      error: () => this.marche.set(null),
    });
  }

  lien(idDossier: number): (string | number)[] | null {
    return this.liens.disponible() ? this.liens.commandes(idDossier) : null;
  }

  ouvrir(): void {
    const m = this.marche();
    this.demande.set({
      ...demandeVide(),
      dateReceptionProvisoire: m?.dateReceptionProvisoire ?? null,
      dateReceptionDefinitive: m?.dateReceptionDefinitive ?? null,
      dateSolde: m?.dateSolde ?? null,
    });
    this.refus.set(null);
    this.ouvert.set(true);
  }

  fermer(): void {
    if (!this.envoi()) this.ouvert.set(false);
  }

  deposer(): void {
    const m = this.marche();
    if (!m || this.envoi() || this.manques().length) return;
    this.envoi.set(true);
    this.refus.set(null);
    this.service.deposer(m.idDossierMarche, this.demande()).subscribe({
      next: (a) => {
        this.envoi.set(false);
        this.ouvert.set(false);
        this.toast.success(`${libelleActe(a)} déposé en brouillon : joignez ses pièces, puis soumettez-le.`);
        const l = this.lien(a.idDossier);
        if (l) void this.router.navigate(l, { queryParams: this.liens.params() });
        else this.charger();
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.envoi.set(false);
        this.refus.set(messageRefusActe(e));
      },
    });
  }
}
