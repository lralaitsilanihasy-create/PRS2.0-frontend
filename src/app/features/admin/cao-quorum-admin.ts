import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ParametreCaoQuorumService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

type Mode = 'MAJORITE' | 'TOUS' | 'NOMBRE';

/**
 * Écran Administrateur — « Quorum de la commission d'appel d'offres » (manuel révisé, R1, V101 ; arbitrage Q5 du pilote du
 * 10/10 : quorum paramétrable, majorité par défaut). La règle est **globale** et bloque la clôture d'une séance d'ouverture, la
 * clôture de la seconde séance (PI), la production du rapport d'évaluation et l'arrêt de la liste de l'AMI, ainsi que tout
 * empêchement qui la rendrait inatteignable (409 `QUORUM_NON_ATTEINT`). Le président (ou le représentant qu'il désigne par
 * séance) est requis en plus du nombre. Une procédure peut la surcharger dans ses paramètres internes. Contrat
 * `GET`/`PUT /api/parametres/cao-quorum` : `MAJORITE` | `TOUS` | `"<n>"`.
 */
@Component({
  selector: 'app-cao-quorum-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <section class="cqa">
      <header class="page-header">
        <h1 class="page-title">Quorum de la commission d’appel d’offres</h1>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>

      <p class="alert alert-info">
        <span>
          Le quorum se vérifie à la <strong>clôture de la séance d’ouverture</strong>, à la clôture de la seconde séance d’une
          consultation, à la <strong>production du rapport d’évaluation</strong> et à l’arrêt de la liste d’un appel à manifestation
          d’intérêt ; un empêchement qui le rendrait inatteignable est refusé. Le <strong>président</strong>, ou le représentant qu’il
          désigne pour la séance, est toujours requis en plus du nombre. Une procédure peut avoir sa propre règle (paramètres internes).
          <strong>Attention</strong> : dans une commission de deux membres, la majorité vaut l’unanimité.
        </span>
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger la règle du quorum." (reessayer)="charger()" />
      } @else {
        <form class="card cqa__card" (submit)="$event.preventDefault(); enregistrer()" novalidate>
          <fieldset class="form-group cqa__choix">
            <legend class="form-label">Règle globale</legend>
            <label class="cqa__option">
              <input type="radio" name="regle" value="MAJORITE" [checked]="mode() === 'MAJORITE'" (change)="mode.set('MAJORITE')" />
              <span><strong>Majorité</strong> des membres désignés — plus de la moitié (2 sur 2, 2 sur 3, 3 sur 4…). Règle par défaut.</span>
            </label>
            <label class="cqa__option">
              <input type="radio" name="regle" value="TOUS" [checked]="mode() === 'TOUS'" (change)="mode.set('TOUS')" />
              <span><strong>Tous</strong> les membres désignés.</span>
            </label>
            <label class="cqa__option">
              <input type="radio" name="regle" value="NOMBRE" [checked]="mode() === 'NOMBRE'" (change)="mode.set('NOMBRE')" />
              <span>
                <strong>Un nombre</strong> de membres, au moins
                <input class="form-control cqa__nombre" type="number" min="1" step="1" aria-label="Nombre minimal de membres" [value]="nombre()" (input)="nombre.set($any($event.target).value); mode.set('NOMBRE')" />
                (borné par l’effectif de chaque commission).
              </span>
            </label>
          </fieldset>
          <p class="cqa__actuel text-sm text-muted">Règle en vigueur : <strong>{{ libelle(actuelle()) }}</strong></p>
          @if (erreurRegle(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
          <div class="cqa__actions">
            <button type="submit" class="btn btn-primary" [disabled]="saving() || !modifie()">{{ saving() ? 'Enregistrement…' : 'Enregistrer la règle' }}</button>
          </div>
        </form>
      }
    </section>
  `,
  styles: `
    .cqa { display: flex; flex-direction: column; gap: 1rem; }
    .cqa__card { display: flex; flex-direction: column; gap: 0.9rem; padding: 1.25rem; max-width: 44rem; }
    .cqa__choix { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .cqa__option { display: flex; gap: 0.6rem; align-items: baseline; cursor: pointer; }
    .cqa__nombre { display: inline-block; width: 5rem; margin: 0 0.3rem; }
    .cqa__actuel { margin: 0; }
    .cqa__actions { display: flex; justify-content: flex-end; }
  `,
})
export class CaoQuorumAdmin implements OnInit {
  private readonly service = inject(ParametreCaoQuorumService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly erreur = signal(false);
  readonly saving = signal(false);
  readonly actuelle = signal<string>('MAJORITE');
  readonly mode = signal<Mode>('MAJORITE');
  readonly nombre = signal<string>('');
  readonly erreurRegle = signal<string | null>(null);

  /** La règle telle que le serveur l'attend (`MAJORITE`, `TOUS` ou le nombre en chaîne). */
  readonly regle = computed(() => (this.mode() === 'NOMBRE' ? this.nombre().trim() : this.mode()));
  readonly modifie = computed(() => this.regle() !== '' && this.regle() !== this.actuelle());

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.service.lire().subscribe({
      next: (p) => {
        this.poser(p.regle);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  enregistrer(): void {
    if (this.saving() || !this.modifie()) return;
    const regle = this.regle();
    if (this.mode() === 'NOMBRE' && !/^[1-9]\d*$/.test(regle)) {
      this.erreurRegle.set('Le nombre de membres est un entier, au moins 1.');
      return;
    }
    this.saving.set(true);
    this.erreurRegle.set(null);
    this.service.definir(regle).subscribe({
      next: (p) => {
        this.saving.set(false);
        this.poser(p.regle);
        this.toast.success(`Quorum de la commission : ${this.libelle(p.regle)}.`);
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.saving.set(false);
        this.erreurRegle.set(codeErreur(e) === 'QUORUM_REGLE_INVALIDE' ? 'Règle refusée : « MAJORITE », « TOUS » ou un nombre entier au moins égal à 1.' : (e as ApiError).message || 'La règle n’a pas été enregistrée.');
      },
    });
  }

  libelle(regle: string): string {
    return regle === 'MAJORITE' ? 'majorité des membres désignés' : regle === 'TOUS' ? 'tous les membres désignés' : `au moins ${regle} membre(s)`;
  }

  private poser(regle: string): void {
    this.actuelle.set(regle);
    if (regle === 'MAJORITE' || regle === 'TOUS') {
      this.mode.set(regle);
      this.nombre.set('');
    } else {
      this.mode.set('NOMBRE');
      this.nombre.set(regle);
    }
    this.erreurRegle.set(null);
  }
}
