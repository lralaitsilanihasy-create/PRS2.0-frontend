import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ToastService } from '../../core/notifications/toast.service';
import { ParametreRemiseElectronique } from '../../models';
import { ParametreRemiseElectroniqueService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

const NIVEAUX = ['Simple', 'Avancée', 'Qualifiée'] as const;

/**
 * Écran Administrateur — « Remise électronique : défauts et bornes ». Les valeurs par défaut du bloc B04-SE sont des
 * PROPOSITIONS du pilote, centralisées ici plutôt que codées dans l'écran de la fiche (cahier des charges du 27/09) :
 * recopiées dans une fiche à sa création, jamais rétroactives. Les bornes (niveau minimal de signature, taille maximale
 * de la plateforme, délai minimal de remise) sont lues par les règles du bilan. Contrat `GET`/`PUT
 * /api/parametres/fiche-remise-electronique` (demande du 27/09, §B1.4).
 */
@Component({
  selector: 'app-remise-electronique-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <section class="rea">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Nomenclatures · fiche DAO d'un appel d'offres</div>
          <h1 class="page-title">Remise électronique — défauts et bornes</h1>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>
      <p class="page-role">
        Ce que la fiche DAO propose d'avance en mode électronique, et ce que ses contrôles exigent au minimum. Une valeur
        par défaut se recopie dans une fiche à sa création ; une borne s'applique à chaque validation.
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (contratAbsent()) {
        <div class="alert alert-info" role="status"><span><strong>Contrat en attente du backend</strong> (demande du 27/09, §B1.4) : le paramètre n'est pas encore servi.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les paramètres de la remise électronique." (reessayer)="charger()" />
      } @else if (valeurs(); as v) {
        <form class="card cnm-form rea__form" aria-label="Paramètres de la remise électronique" (submit)="$event.preventDefault(); enregistrer()" novalidate>
          <div class="cnm-form-grid">
            <label class="form-group rea__large">
              <span class="form-label">Adresse de la plateforme de dépôt (défaut de B04-SE-02)</span>
              <input class="form-control" type="url" id="rea-url" [value]="v.plateformeUrl ?? ''" (input)="poser('plateformeUrl', $any($event.target).value || null)" />
            </label>
            <label class="form-group">
              <span class="form-label">Fuseau de l'heure de référence</span>
              <input class="form-control" type="text" id="rea-fuseau" placeholder="Indian/Antananarivo" [value]="v.fuseau ?? ''" (input)="poser('fuseau', $any($event.target).value || null)" />
            </label>
            <label class="form-group">
              <span class="form-label">Niveau minimal de signature (règle 4, défaut de B04-SE-05)</span>
              <select class="form-control" id="rea-signature" (change)="poser('signatureMin', $any($event.target).value || null)">
                <option value="" [selected]="!v.signatureMin">— Choisir —</option>
                @for (n of niveaux; track n) { <option [value]="n" [selected]="v.signatureMin === n">{{ n }}</option> }
              </select>
            </label>
            <label class="form-group">
              <span class="form-label">Taille maximale de la plateforme (Mo, règle 3)</span>
              <input class="form-control rea__court" type="number" min="1" id="rea-taille" [value]="v.tailleMaxPlateformeMo ?? ''" (input)="poser('tailleMaxPlateformeMo', $any($event.target).valueAsNumber || null)" />
            </label>
            <label class="form-group">
              <span class="form-label">Délai minimal entre publication et date limite (jours, règle 2)</span>
              <input class="form-control rea__court" type="number" min="0" id="rea-delai" [value]="v.delaiMinRemiseJours ?? ''" (input)="poser('delaiMinRemiseJours', $any($event.target).valueAsNumber || null)" />
            </label>
            <label class="form-group">
              <span class="form-label">Quorum de déchiffrement proposé</span>
              <input class="form-control rea__court" type="text" id="rea-quorum" placeholder="3/5" [value]="v.quorumDefaut ?? ''" (input)="poser('quorumDefaut', $any($event.target).value || null)" />
            </label>
            <label class="form-group">
              <span class="form-label">Rappel de vérification des parts de clé (jours avant la date limite)</span>
              <input class="form-control rea__court" type="number" min="0" id="rea-verif" [value]="v.verificationPartJours ?? ''" (input)="poser('verificationPartJours', $any($event.target).valueAsNumber ?? null)" />
              <span class="form-hint">Chaque détenteur dont la part n'est pas vérifiée depuis la clôture de la cérémonie est rappelé une fois (lot 2b, S2).</span>
            </label>
            <label class="form-group rea__large">
              <span class="form-label">Assistance aux candidats (défaut de B04-SE-14)</span>
              <textarea class="form-control" rows="2" id="rea-assistance" [value]="v.assistance ?? ''" (input)="poser('assistance', $any($event.target).value || null)"></textarea>
            </label>
          </div>
          <div class="rea__pied">
            <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button>
          </div>
        </form>
      }
    </section>
  `,
  styles: `
    .rea { display: flex; flex-direction: column; gap: 1rem; }
    .rea__form { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
    .rea__large { grid-column: span 2; }
    .rea__court { max-width: 10rem; }
    .rea__pied { display: flex; gap: 0.6rem; }
  `,
})
export class RemiseElectroniqueAdmin implements OnInit {
  private readonly service = inject(ParametreRemiseElectroniqueService);
  private readonly toast = inject(ToastService);

  readonly niveaux = NIVEAUX;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly erreur = signal(false);
  readonly contratAbsent = signal(false);
  readonly valeurs = signal<ParametreRemiseElectronique | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.contratAbsent.set(false);
    this.service.lire().subscribe({
      next: (p) => {
        this.valeurs.set(p);
        this.loading.set(false);
      },
      error: (e: { status?: number }) => {
        this.loading.set(false);
        if (e.status === 404) this.contratAbsent.set(true);
        else this.erreur.set(true);
      },
    });
  }

  poser<K extends keyof ParametreRemiseElectronique>(cle: K, valeur: ParametreRemiseElectronique[K]): void {
    this.valeurs.update((v) => (v ? { ...v, [cle]: valeur } : v));
  }

  enregistrer(): void {
    const v = this.valeurs();
    if (!v || this.saving()) return;
    this.saving.set(true);
    this.service.definir(v).subscribe({
      next: (p) => {
        this.saving.set(false);
        this.valeurs.set(p);
        this.toast.success('Paramètres de la remise électronique enregistrés.');
      },
      error: () => this.saving.set(false), // 400/403 → dialogue centralisé (message backend)
    });
  }
}
