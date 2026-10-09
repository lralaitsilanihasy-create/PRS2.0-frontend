import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { DemandeActe, Dossier, MarcheActes } from '../../../models';
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
 */
@Component({
  selector: 'app-actes-gestion-marche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ModaleDirective, ActeFormulaire],
  template: `
    @if (marche(); as m) {
      @if (m.actes.length || redacteur()) {
        <section class="agm" aria-labelledby="agm-titre">
          <h2 class="agm__titre" id="agm-titre">Actes de gestion du marché</h2>
          <p class="agm__faits">
            <span>Montant initial : <strong>{{ ariary(m.montantInitialHt) }}</strong> HT{{ m.sourceMontantInitial === 'DECLARE' ? ' (déclaré)' : '' }}</span>
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
                  <span class="agm__ref">{{ a.refeDossier || 'brouillon' }}</span>
                  <span class="badge" [class.badge-success]="a.avis === 'FAV' || a.avis === 'FAVR'" [class.badge-danger]="a.avis === 'DEF'" [class.badge-neutral]="!a.avis">{{ a.avis || a.statutDossier || '—' }}</span>
                  @if (lien(a.idDossier); as l) { <a class="agm__ouvrir" [routerLink]="l">Ouvrir</a> }
                </li>
              }
            </ul>
          } @else {
            <p class="agm__vide">Aucun acte de gestion sur ce marché.</p>
          }
          @if (redacteur()) {
            @if (marcheControle(m)) {
              <div><button type="button" class="btn btn-secondary btn-sm" (click)="ouvrir()">Déposer un acte de gestion</button></div>
            } @else {
              <p class="agm__vide">Un acte de gestion se dépose une fois le marché contrôlé favorablement par la Commission.</p>
            }
          }
        </section>
      }
    }

    @if (ouvert() && marche(); as m) {
      <div class="modal-backdrop">
        <div class="modal cnm-form agm__modale" role="dialog" aria-modal="true" aria-label="Déposer un acte de gestion" appModale (appModaleFermer)="fermer()">
          <header class="modal-header-plain">
            <span class="modal-title">Déposer un acte de gestion — {{ m.refeDossier || 'marché' }}</span>
            <button type="button" class="btn-close-plain" aria-label="Fermer" (click)="fermer()">✕</button>
          </header>
          <div class="modal-body">
            <app-acte-formulaire [(demande)]="demande" [montantInitialConnu]="m.montantInitialHt != null" [categorieConnue]="m.categorie != null" [desactive]="envoi()" />
            @if (demande().sousType === 'AVN') {
              @if (projection(); as p) {
                <p class="agm__projection" [class.agm__projection--ko]="p.depasse" role="status">
                  Avec cet avenant, n° {{ m.rangAvenantSuivant }} : {{ ariary(p.cumul) }} sur un plafond de {{ ariary(p.plafond) }}{{ p.depasse ? ' — le plafond serait dépassé : le serveur refusera.' : '.' }}
                </p>
              }
            }
            @if (manques().length) {
              <ul class="agm__manques">@for (x of manques(); track x) { <li>{{ x }}</li> }</ul>
            }
            @if (refus(); as r) { <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div> }
          </div>
          <footer class="modal-footer">
            <button type="button" class="btn btn-outline" [disabled]="envoi()" (click)="fermer()">Annuler</button>
            <button type="button" class="btn btn-primary" [disabled]="envoi() || manques().length > 0" (click)="deposer()">{{ envoi() ? 'Dépôt…' : 'Déposer l’acte en brouillon' }}</button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: `
    .agm { background: #fff; border: 1px solid var(--n-200); border-radius: 12px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .agm__titre { margin: 0; font-size: 0.95rem; }
    .agm__faits { margin: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; font-size: 0.84rem; color: var(--n-600); }
    .agm__plafond { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.84rem; }
    .agm__plafond progress { width: 100%; max-width: 28rem; }
    .agm__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    .agm__acte { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; font-size: 0.85rem; }
    .agm__nom { font-weight: 600; min-width: 9rem; }
    .agm__ref { color: var(--n-500); font-family: var(--font-mono, monospace); font-size: 0.8rem; }
    .agm__ouvrir { font-weight: 600; }
    .agm__vide { margin: 0; font-size: 0.84rem; color: var(--n-500); }
    .agm__modale { max-width: 40rem; }
    .agm__projection { margin: 0.6rem 0 0; font-size: 0.85rem; }
    .agm__projection--ko { color: var(--danger-700, #b42318); font-weight: 600; }
    .agm__manques { margin: 0.5rem 0 0; padding-left: 1.2rem; font-size: 0.84rem; color: var(--warning-text); }
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
  readonly jj = dateCourte;
  readonly libelle = libelleActe;
  readonly marcheControle = marcheControle;
  readonly libellesCategorie = LIBELLES_CATEGORIE_MARCHE;

  readonly marche = signal<MarcheActes | null>(null);
  readonly ouvert = signal(false);
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
