import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ParametresCandidats } from '../../models';
import { ParametresCandidatsService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/**
 * Écran Administrateur — « Candidats : paramètres de l'espace en ligne » (`GET`/`PUT /api/parametres/candidats`,
 * soumission en ligne §B7). Deux réglages portent un AVERTISSEMENT, parce qu'ils désignent un raccordement qui
 * n'existe pas encore : la vérification `AUTOMATIQUE` du NIF (le raccordement à la DGI est vide, elle retombe sur les
 * pièces) et la confirmation par téléphone (aucune passerelle SMS : un code exigé ne partirait jamais, et plus
 * personne ne pourrait confirmer son compte). Les 400 nominatifs du serveur se posent sous le champ.
 */
@Component({
  selector: 'app-parametres-candidats-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <section class="pca">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Nomenclatures · espace candidat</div>
          <h1 class="page-title">Candidats — paramètres de l'espace en ligne</h1>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>
      <p class="page-role">
        Comment une entreprise s'inscrit, comment son NIF se vérifie, et quand un compte est nettoyé. Un réglage
        s'applique dès l'enregistrement, aux comptes existants comme aux nouveaux.
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les paramètres des candidats." (reessayer)="charger()" />
      } @else if (valeurs(); as v) {
        <form class="card cnm-form pca__form" aria-label="Paramètres des candidats" (submit)="$event.preventDefault(); enregistrer()" novalidate>
          <div class="cnm-form-grid">
            <label class="form-group pca__large">
              <span class="form-label">Vérification du NIF</span>
              <select class="form-control" id="pca-nif" (change)="poser('verificationNif', $any($event.target).value)">
                <option value="SUR_PIECES" [selected]="v.verificationNif === 'SUR_PIECES'">Sur pièces — l'Administrateur rapproche la carte fiscale du NIF</option>
                <option value="AUTOMATIQUE" [selected]="v.verificationNif === 'AUTOMATIQUE'">Automatique — interrogation du service de la DGI</option>
              </select>
              @if (v.verificationNif === 'AUTOMATIQUE') {
                <span class="form-hint pca__alerte">Le raccordement à la DGI n'est pas encore branché (interface inconnue) : la voie automatique répond « indisponible » et retombe sur les pièces, sans rien bloquer.</span>
              }
              @if (erreurChamp('verificationNif'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group pca__large pca__case">
              <input type="checkbox" id="pca-tel" [checked]="v.confirmationTelephone" (change)="poser('confirmationTelephone', $any($event.target).checked)" />
              <span>Exiger aussi un code par SMS à la confirmation du compte</span>
            </label>
            @if (v.confirmationTelephone) {
              <p class="alert alert-warning pca__large" role="alert"><span><strong>Aucune passerelle SMS n'est raccordée</strong> : le code exigé ne partirait jamais, et plus aucun candidat ne pourrait confirmer son compte. À laisser désactivé tant que le pilote n'a pas choisi de fournisseur.</span></p>
            }
            <label class="form-group">
              <span class="form-label">Inscriptions par adresse IP et par jour</span>
              <input class="form-control pca__court" type="number" min="1" id="pca-insc" [value]="v.inscriptionsParJour" (input)="poser('inscriptionsParJour', $any($event.target).valueAsNumber)" />
              @if (erreurChamp('inscriptionsParJour'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Suppression d'un compte jamais confirmé (jours)</span>
              <input class="form-control pca__court" type="number" min="1" id="pca-conf" [value]="v.delaiConfirmationJours" (input)="poser('delaiConfirmationJours', $any($event.target).valueAsNumber)" />
              @if (erreurChamp('delaiConfirmationJours'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Archivage d'un compte inactif (mois)</span>
              <input class="form-control pca__court" type="number" min="1" id="pca-inact" [value]="v.delaiInactiviteMois" (input)="poser('delaiInactiviteMois', $any($event.target).valueAsNumber)" />
              <span class="form-hint">Archivé, jamais supprimé : ses retraits et ses dépôts restent au journal.</span>
              @if (erreurChamp('delaiInactiviteMois'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Taille maximale d'une pièce de l'entreprise (Mo)</span>
              <input class="form-control pca__court" type="number" min="1" max="10" id="pca-taille" [value]="v.tailleMaxPieceMo" (input)="poser('tailleMaxPieceMo', $any($event.target).valueAsNumber)" />
              <span class="form-hint">La limite multipart du serveur est de 10 Mo : au-delà, ce plafond ne sert à rien.</span>
              @if (erreurChamp('tailleMaxPieceMo'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
          </div>
          <div class="pca__pied">
            <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button>
          </div>
        </form>
      }
    </section>
  `,
  styles: `
    .pca { display: flex; flex-direction: column; gap: 1rem; }
    .pca__form { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
    .pca__large { grid-column: span 2; }
    .pca__case { flex-direction: row; align-items: center; gap: 0.5rem; }
    .pca__court { max-width: 10rem; }
    .pca__alerte { color: var(--n-500); }
    .pca__pied { display: flex; gap: 0.6rem; }
  `,
})
export class ParametresCandidatsAdmin implements OnInit {
  private readonly service = inject(ParametresCandidatsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly erreur = signal(false);
  readonly valeurs = signal<ParametresCandidats | null>(null);
  readonly erreursChamps = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.service.lire().subscribe({
      next: (p) => {
        this.valeurs.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  poser<K extends keyof ParametresCandidats>(cle: K, valeur: ParametresCandidats[K]): void {
    this.valeurs.update((v) => (v ? { ...v, [cle]: valeur } : v));
  }

  erreurChamp(champ: string): string | undefined {
    return this.erreursChamps()[champ];
  }

  enregistrer(): void {
    const v = this.valeurs();
    if (!v || this.saving()) return;
    this.saving.set(true);
    this.erreursChamps.set({});
    this.service.definir(v).subscribe({
      next: (p) => {
        this.saving.set(false);
        this.valeurs.set(p);
        this.toast.success('Paramètres des candidats enregistrés.');
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        if (e.status === 400 && e.fieldErrors) this.erreursChamps.set(e.fieldErrors);
        else this.toast.error(e.message || "L'enregistrement n'a pas abouti.", 'Action impossible');
      },
    });
  }
}
