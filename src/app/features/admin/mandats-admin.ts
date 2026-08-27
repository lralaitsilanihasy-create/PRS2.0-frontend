import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { Mandat, Prmp } from '../../models';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { MandatService, PrmpService } from '../../services';

/** Libellés d'affichage des statuts de mandat. */
const STATUT_LABELS: Record<string, string> = {
  ACTIF: 'Actif',
  EN_TRANSITION: 'En transition',
  ACHEVE: 'Achevé',
  ABROGE: 'Abrogé',
};

/**
 * **Mandats PRMP** (ADMINISTRATEUR) — spec « Mandats PRMP » : l'historique chronologique des mandats
 * (titulaire, dates, arrêté, statut dérivé serveur, n° 1/2), la **nomination / reconduction** (POST —
 * un nouvel arrêté est obligatoire, la reconduction est un mandat DISTINCT ; 409 explicites : 3ᵉ mandat,
 * arrêté réutilisé, prolongation déguisée, > 3 ans, chevauchement) et l'**abrogation** (motif obligatoire).
 * Un mandat `implicite` est reconstitué depuis t_prmp (DATE_NOMIN) tant qu'aucun mandat n'est déclaré —
 * déclarer le mandat initial est ce qui rend exacte la garde de renouvellement.
 */
@Component({
  selector: 'app-mandats-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, ReactiveFormsModule],
  template: `
    <section class="ma">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Comptes & hiérarchie</div>
          <h1 class="page-title">Mandats PRMP</h1>
        </div>
        <button type="button" class="btn btn-primary" (click)="ouvrirCreation()">+ Nouveau mandat</button>
      </header>
      <p class="ma__intro">
        Un mandat dure <strong>3 ans à partir de la date de l'arrêté de nomination</strong> et n'est
        renouvelable qu'<strong>une fois</strong> (2 mandats consécutifs maximum). Une
        <strong>reconduction est un mandat distinct</strong> — nouvel arrêté obligatoire, jamais une
        prolongation. Un mandat <em>implicite</em> (reconstitué depuis la fiche PRMP) s'affiche tant
        qu'aucun mandat n'est déclaré : déclarez le mandat initial pour fiabiliser la règle.
      </p>

      <div class="ma__filtre">
        <label class="form-label" for="ma-prmp">PRMP</label>
        <select id="ma-prmp" class="form-control" (change)="filtrePrmp.set($any($event.target).value || null)">
          <option value="">— Toutes —</option>
          @for (p of prmps(); track p.idPrmp) {
            <option [value]="p.idPrmp" [selected]="filtrePrmp() === p.idPrmp">{{ p.idPrmp }} — {{ p.nomPrmp }} {{ p.prenomsPrmp }}</option>
          }
        </select>
      </div>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr><th scope="col">PRMP</th><th scope="col">Titulaire</th><th scope="col">N°</th><th scope="col">Début (arrêté)</th><th scope="col">Fin</th><th scope="col">Arrêté</th><th scope="col">Statut</th><th scope="col" class="r">Actions</th></tr>
            </thead>
            <tbody>
              @for (m of mandatsAffiches(); track m.idMandat ?? m.idPrmp + m.dateDebut) {
                <tr>
                  <td class="ma__id">{{ m.idPrmp }}</td>
                  <td>{{ m.titulaire || '—' }}</td>
                  <td class="ma__c">{{ m.numeroMandat ?? '—' }}</td>
                  <td class="ma__c">{{ m.dateDebut }}</td>
                  <td class="ma__c">{{ m.dateFin }}</td>
                  <td>{{ m.refArrete || '—' }} @if (m.implicite) { <span class="badge ma__implicite" title="Mandat reconstitué depuis la fiche PRMP (aucun mandat déclaré)">implicite</span> }</td>
                  <td>
                    <span class="badge" [class]="'ma__statut ma__statut--' + m.statut.toLowerCase()">{{ statutLabel(m.statut) }}</span>
                    @if (m.statut === 'ABROGE' && m.motifAbrogation) { <div class="ma__motif" [title]="m.motifAbrogation">{{ m.motifAbrogation }}</div> }
                  </td>
                  <td>
                    <div class="td-actions ma__actions">
                      @if (m.statut === 'ACTIF' && !m.implicite) {
                        <button type="button" class="btn btn-danger btn-sm" (click)="ouvrirAbrogation(m)">Abroger</button>
                      }
                      @if (m.statut !== 'ABROGE') {
                        <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirCreation(m)">Reconduire</button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="ma__empty">Aucun mandat.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <!-- Nomination / reconduction : nouvel arrêté OBLIGATOIRE, dates neuves (jamais une prolongation). -->
    @if (creationOuverte()) {
      <div class="modal-backdrop" [class.closing]="closingCreation()">
        <form class="modal confirm-modal cnm-form" [formGroup]="form" (ngSubmit)="creer()" role="dialog" aria-modal="true" aria-label="Nomination d'une PRMP" appModale appModaleClicExterieur (appModaleFermer)="fermerCreationAnime()" novalidate>
          <div class="modal-header-plain"><span class="modal-title">Nouveau mandat (nomination / reconduction)</span></div>
          <div class="modal-body">
            <label class="form-group">
              <span class="form-label required">PRMP</span>
              <select class="form-control" formControlName="idPrmp">
                <option value="" disabled>— Choisir —</option>
                @for (p of prmps(); track p.idPrmp) { <option [value]="p.idPrmp">{{ p.idPrmp }} — {{ p.nomPrmp }} {{ p.prenomsPrmp }}</option> }
              </select>
            </label>
            <label class="form-group">
              <span class="form-label required">Référence de l'arrêté (nouvel arrêté)</span>
              <input class="form-control" type="text" formControlName="refArrete" />
              <span class="form-hint">Un arrêté n'est jamais réutilisé — même pour la même personne.</span>
            </label>
            <label class="form-group">
              <span class="form-label required">Date de l'arrêté de nomination</span>
              <input class="form-control" type="date" formControlName="dateDebut" />
              <span class="form-hint">Le mandat de 3 ans court à partir de cette date{{ finCalculee() ? ' — fin calculée : ' + finCalculee() : '' }}.</span>
            </label>
            <label class="form-group">
              <span class="form-label">Date de fin (défaut : date de l'arrêté + 3 ans − 1 jour)</span>
              <input class="form-control" type="date" formControlName="dateFin" />
            </label>
            <label class="form-group">
              <span class="form-label">Titulaire (défaut : nom de la fiche PRMP)</span>
              <input class="form-control" type="text" formControlName="titulaire" />
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="fermerCreationAnime()">Annuler</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving() || form.invalid">{{ saving() ? 'Enregistrement…' : 'Nommer' }}</button>
          </div>
        </form>
      </div>
    }

    <!-- Abrogation : fin de fonction avant terme, motif obligatoire. -->
    @if (abrogation(); as m) {
      <div class="modal-backdrop" [class.closing]="closingAbrogation()">
        <form class="modal confirm-modal cnm-form" [formGroup]="formAbrogation" (ngSubmit)="abroger(m)" role="alertdialog" aria-modal="true" aria-label="Abrogation du mandat" appModale appModaleClicExterieur (appModaleFermer)="fermerAbrogationAnime()" novalidate>
          <div class="modal-header-plain"><span class="modal-title">Abroger le mandat — {{ m.idPrmp }} ({{ m.refArrete }})</span></div>
          <div class="modal-body">
            <p class="text-muted">
              Fin de fonction avant terme. Les dossiers restent attribués à ce titulaire ; le traitement
              sera <strong>suspendu</strong> (vacance) jusqu'à la nomination du successeur.
            </p>
            <label class="form-group">
              <span class="form-label required">Motif</span>
              <textarea class="form-control" rows="3" formControlName="motif"></textarea>
            </label>
            <label class="form-group">
              <span class="form-label">Date d'abrogation (défaut : aujourd'hui)</span>
              <input class="form-control" type="date" formControlName="dateAbrogation" />
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="fermerAbrogationAnime()">Annuler</button>
            <button type="submit" class="btn btn-danger" [disabled]="saving() || formAbrogation.invalid">{{ saving() ? 'Abrogation…' : 'Abroger' }}</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    .ma { display: flex; flex-direction: column; gap: 1rem; }
    .ma__intro { margin: -0.4rem 0 0; color: var(--n-500); max-width: 62rem; }
    .ma__filtre { display: flex; align-items: center; gap: 0.6rem; }
    .ma__filtre .form-control { max-width: 26rem; }
    .ma__id { font-weight: 600; color: var(--c-800); white-space: nowrap; }
    .ma__c { text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .ma__actions { justify-content: flex-end; }
    .ma__empty { text-align: center; color: var(--n-400); padding: 1.5rem; }
    .ma__implicite { background: var(--n-100); color: var(--n-500); font-style: italic; }
    .ma__motif { font-size: var(--text-xs); color: var(--n-400); max-width: 14rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ma__statut--actif { background: var(--success-bg, #dcfce7); color: var(--success-text, #16a34a); }
    .ma__statut--en_transition { background: var(--warning-bg, #fef3c7); color: var(--warning-text, #b45309); }
    .ma__statut--acheve { background: var(--n-100); color: var(--n-500); }
    .ma__statut--abroge { background: var(--danger-bg, #fee2e2); color: var(--danger-text, #dc2626); }
  `,
})
export class MandatsAdmin implements OnInit {
  /** Animation de sortie du modal (voir `fermerAvecAnimation`). */
  readonly closingCreation = signal(false);
  /** Ferme le modal en jouant l'animation de sortie (voile, Échap, boutons). */
  fermerCreationAnime(): void {
    fermerAvecAnimation(this.closingCreation, () => this.fermerCreation());
  }
  /** Animation de sortie du modal (voir `fermerAvecAnimation`). */
  readonly closingAbrogation = signal(false);
  /** Ferme le modal en jouant l'animation de sortie (voile, Échap, boutons). */
  fermerAbrogationAnime(): void {
    fermerAvecAnimation(this.closingAbrogation, () => this.fermerAbrogation());
  }
  private readonly mandatService = inject(MandatService);
  private readonly prmpService = inject(PrmpService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly mandats = signal<Mandat[]>([]);
  readonly prmps = signal<Prmp[]>([]);
  readonly filtrePrmp = signal<string | null>(null);
  readonly creationOuverte = signal(false);
  readonly abrogation = signal<Mandat | null>(null);

  readonly form = this.fb.nonNullable.group({
    idPrmp: ['', Validators.required],
    refArrete: ['', Validators.required],
    dateDebut: ['', Validators.required],
    dateFin: [''],
    titulaire: [''],
  });
  readonly formAbrogation = this.fb.nonNullable.group({
    motif: ['', Validators.required],
    dateAbrogation: [''],
  });

  /** Historique affiché : filtre PRMP client (la liste ADMIN reçoit tout, déjà chronologique). */
  readonly mandatsAffiches = computed(() => {
    const f = this.filtrePrmp();
    return f ? this.mandats().filter((m) => m.idPrmp === f) : this.mandats();
  });

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.loading.set(true);
    // ⚠️ Le backend ne matérialise un mandat IMPLICITE (reconstitué depuis t_prmp) que sur une requête
    // filtrée `?prmp=` — la liste globale ne porte que les mandats déclarés (t_mandat). Pour montrer
    // l'état réel de chaque PRMP (implicites compris), on interroge l'historique PAR PRMP en parallèle.
    this.prmpService.list().subscribe({
      next: (prmps) => {
        this.prmps.set(prmps);
        if (!prmps.length) {
          this.mandats.set([]);
          this.loading.set(false);
          return;
        }
        forkJoin(prmps.map((p) => this.mandatService.historique({ prmp: p.idPrmp }))).subscribe({
          next: (parPrmp) => {
            this.mandats.set(parPrmp.flat());
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  statutLabel(statut: string): string {
    return STATUT_LABELS[statut] ?? statut;
  }

  /** Ouvre la nomination — pré-remplie depuis un mandat existant pour une reconduction (nouvel arrêté à saisir). */
  ouvrirCreation(depuis?: Mandat): void {
    this.form.reset({
      idPrmp: depuis?.idPrmp ?? '',
      refArrete: '',
      dateDebut: depuis ? this.lendemain(depuis.dateFin) : '',
      dateFin: '',
      titulaire: '',
    });
    this.creationOuverte.set(true);
  }
  fermerCreation(): void {
    if (!this.saving()) this.creationOuverte.set(false);
  }
  creer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.mandatService
      .creer({
        idPrmp: v.idPrmp,
        refArrete: v.refArrete.trim(),
        dateDebut: v.dateDebut,
        dateFin: v.dateFin || undefined,
        titulaire: v.titulaire.trim() || undefined,
      })
      .subscribe({
        next: (m) => {
          this.saving.set(false);
          this.creationOuverte.set(false);
          this.toast.success(`Mandat n°${m.numeroMandat ?? '?'} de ${m.idPrmp} enregistré (${m.refArrete}).`);
          this.charger();
        },
        // 409 (3ᵉ mandat, arrêté réutilisé, prolongation, > 3 ans, chevauchement) → message backend (dialogue centralisé).
        error: (_e: ApiError) => this.saving.set(false),
      });
  }

  ouvrirAbrogation(m: Mandat): void {
    this.formAbrogation.reset({ motif: '', dateAbrogation: '' });
    this.abrogation.set(m);
  }
  fermerAbrogation(): void {
    if (!this.saving()) this.abrogation.set(null);
  }
  abroger(m: Mandat): void {
    if (this.formAbrogation.invalid || m.idMandat == null) {
      this.formAbrogation.markAllAsTouched();
      return;
    }
    const v = this.formAbrogation.getRawValue();
    this.saving.set(true);
    this.mandatService.abroger(m.idMandat, { motif: v.motif.trim(), dateAbrogation: v.dateAbrogation || undefined }).subscribe({
      next: () => {
        this.saving.set(false);
        this.abrogation.set(null);
        this.toast.success(`Mandat de ${m.idPrmp} abrogé — le poste est vacant jusqu'à la prochaine nomination.`);
        this.charger();
      },
      error: (_e: ApiError) => this.saving.set(false),
    });
  }

  /** Fin de mandat calculée depuis la date de l'arrêté saisie (arrêté + 3 ans − 1 jour), en `jj/mm/aaaa`. */
  finCalculee(): string {
    const d = this.form.controls.dateDebut.value;
    if (!d) return '';
    const [y, m, day] = d.split('-').map(Number);
    if (!y || !m || !day) return '';
    const dt = new Date(y + 3, m - 1, day - 1);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
  }

  /** Lendemain d'une date ISO (pré-remplissage d'une reconduction : elle ne recouvre jamais le mandat précédent). */
  private lendemain(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
}
