import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiError, erreursParChamp } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ParametreCompteDao } from '../../models';
import { ParametreCompteDaoService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

type Cle = 'banque' | 'titulaire' | 'numeroCompte';

/**
 * Écran Administrateur — « Compte bancaire de l'ARMP (prix des DAO) » (01/10, avis spécifique §B8, décision du pilote).
 * Le prix d'un dossier d'appel d'offres se verse sur ce compte UNIQUE, que l'avis spécifique imprime
 * (« à verser sur le compte bancaire de l'ARMP : … »). Tant qu'il n'est pas réglé, l'avis imprime des pointillés et la
 * modale d'impression de la PRMP le signale. Contrat `GET`/`PUT /api/parametres/compte-dao` (PUT Administrateur seul,
 * les trois informations exigées, 400 nominatif, tracé à l'audit).
 */
@Component({
  selector: 'app-compte-dao-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <section class="cda">
      <header class="page-header">
        <h1 class="page-title">Compte bancaire de l’ARMP — prix des DAO</h1>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>

      <p class="alert alert-info">
        <span>
          Le prix d’un dossier d’appel d’offres se verse sur ce <strong>compte unique</strong>. L’avis spécifique de chaque
          appel d’offres l’imprime : « … à verser sur le compte bancaire de l’ARMP : <em>banque</em>, compte n°
          <em>numéro</em> au nom de <em>titulaire</em> ». Tant qu’il n’est pas réglé, l’avis imprime des pointillés.
        </span>
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger le compte bancaire de l’ARMP." (reessayer)="charger()" />
      } @else {
        <div class="card cda__card">
          @if (!regle()) { <p class="alert alert-warning" role="status"><span>Le compte n’est pas encore réglé : les avis imprimés portent des pointillés à sa place.</span></p> }
          <label class="form-group">
            <span class="form-label">Banque</span>
            <input class="form-control" type="text" [value]="saisie().banque" (input)="poser('banque', $any($event.target).value)" />
            @if (erreurs().banque; as m) { <span class="form-error">{{ m }}</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Titulaire du compte</span>
            <input class="form-control" type="text" [value]="saisie().titulaire" (input)="poser('titulaire', $any($event.target).value)" />
            @if (erreurs().titulaire; as m) { <span class="form-error">{{ m }}</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Numéro de compte</span>
            <input class="form-control cda__num" type="text" [value]="saisie().numeroCompte" (input)="poser('numeroCompte', $any($event.target).value)" />
            @if (erreurs().numeroCompte; as m) { <span class="form-error">{{ m }}</span> }
          </label>
          <p class="cda__apercu"><span class="form-label">Ce que l’avis imprimera</span> {{ apercu() }}</p>
          <div class="cda__actions">
            @if (miseAJour(); as m) { <span class="cda__maj">{{ m }}</span> }
            <button type="button" class="btn btn-primary" [disabled]="saving() || !complet()" (click)="enregistrer()">
              {{ saving() ? 'Enregistrement…' : 'Enregistrer le compte' }}
            </button>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .cda { display: flex; flex-direction: column; gap: 1rem; }
    .cda__card { display: flex; flex-direction: column; gap: 0.9rem; padding: 1.25rem; max-width: 40rem; }
    .cda__num { font-variant-numeric: tabular-nums; }
    .cda__apercu { margin: 0; display: flex; flex-direction: column; gap: 0.2rem; color: var(--n-700); }
    .cda__actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .cda__maj { color: var(--n-500); font-size: var(--text-sm); }
  `,
})
export class CompteDaoAdmin implements OnInit {
  private readonly service = inject(ParametreCompteDaoService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly erreur = signal(false);
  readonly saving = signal(false);
  readonly actuel = signal<ParametreCompteDao | null>(null);
  readonly saisie = signal<Record<Cle, string>>({ banque: '', titulaire: '', numeroCompte: '' });
  readonly erreurs = signal<Partial<Record<Cle, string>>>({});

  readonly regle = computed(() => {
    const a = this.actuel();
    return !!a?.banque && !!a?.titulaire && !!a?.numeroCompte;
  });
  readonly complet = computed(() => Object.values(this.saisie()).every((v) => v.trim() !== ''));
  /** Le rendu du jeton `{{PARAM.compte-dao}}`, tel que le serveur l'imprime (§B8.3). */
  readonly apercu = computed(() => {
    const s = this.saisie();
    const v = (x: string) => x.trim() || '………';
    return `${v(s.banque)}, compte n° ${v(s.numeroCompte)} au nom de ${v(s.titulaire)}`;
  });
  readonly miseAJour = computed(() => {
    const a = this.actuel();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(a?.misAJourLe ?? '');
    return m ? `Réglé le ${m[3]}/${m[2]}/${m[1]}${a?.misAJourPar ? ' par ' + a.misAJourPar : ''}` : null;
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.service.lire().subscribe({
      next: (c) => {
        this.actuel.set(c);
        this.saisie.set({ banque: c.banque ?? '', titulaire: c.titulaire ?? '', numeroCompte: c.numeroCompte ?? '' });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  poser(cle: Cle, valeur: string): void {
    this.saisie.update((s) => ({ ...s, [cle]: valeur }));
    if (this.erreurs()[cle]) this.erreurs.update((e) => ({ ...e, [cle]: undefined }));
  }

  enregistrer(): void {
    if (this.saving() || !this.complet()) return;
    this.saving.set(true);
    const s = this.saisie();
    this.service.definir({ banque: s.banque.trim(), titulaire: s.titulaire.trim(), numeroCompte: s.numeroCompte.trim() }).subscribe({
      next: (c) => {
        this.saving.set(false);
        this.actuel.set(c);
        this.toast.success('Compte bancaire de l’ARMP enregistré : les prochains avis l’imprimeront.');
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.saving.set(false);
        const parChamp = erreursParChamp(e);
        if (parChamp.size) this.erreurs.set(Object.fromEntries(parChamp) as Partial<Record<Cle, string>>);
        else this.toast.error('Le compte n’a pas été enregistré. Réessayez.');
      },
    });
  }
}
