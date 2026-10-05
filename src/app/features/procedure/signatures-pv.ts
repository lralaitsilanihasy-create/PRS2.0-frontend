import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { Seance } from '../../models';
import { SeanceService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';

/** Qui regarde : un membre de la CAO (il signe ; président, il constate un empêchement), le responsable, ou un lecteur. */
export type VueSignatures = 'membre' | 'responsable' | 'lecture';

/**
 * ⚠️ V70 (arbitrage du pilote, 04/10, `demande-backend-2026-10-04-arbitrages-soumission-en-ligne` §B2) — les **signatures du
 * PV d'ouverture**. Chaque membre présent signe depuis son espace (signature simple : l'acte authentifié du membre connecté) ;
 * les signataires sont figés à la production du PV ; l'extrait n'est publié qu'à la dernière signature.
 * Un signataire qui ne peut pas signer : le **président** constate l'empêchement, avec un motif imprimé au PV — ou le
 * **responsable** si le président est lui-même empêché. Le serveur reste l'autorité : un refus est nommé, jamais deviné.
 */
@Component({
  selector: 'app-signatures-pv',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (seance().pv; as pv) {
      <section class="sp" aria-labelledby="sp-titre">
        <h3 id="sp-titre" class="sp__h3">
          Signatures du PV
          <span class="badge" [class.badge-success]="pv.signe" [class.badge-warning]="!pv.signe && attendues().length" [class.badge-neutral]="anterieur()">{{ pv.signe ? 'PV signé' : anterieur() ? 'Signé sur papier (PV antérieur à la signature en ligne)' : 'À signer — ' + attendues().length + ' signature(s) attendue(s)' }}</span>
        </h3>
        @if (pv.signatures?.length) {
          <ul class="sp__liste" aria-label="Signatures posées">
            @for (g of pv.signatures; track g.im) {
              <li>
                <strong>{{ g.nom }}</strong>{{ g.president ? ' — président' : '' }}
                @if (g.empechement) {
                  <span class="text-sm"> · empêché de signer : {{ g.motif }} (constaté par {{ g.constatePar }} le {{ dateHeure(g.date) }})</span>
                } @else {
                  <span class="text-sm text-muted"> · signé électroniquement le {{ dateHeure(g.date) }}</span>
                }
              </li>
            }
          </ul>
        }
        @if (attendues().length) {
          <p class="text-sm sp__attendues">En attente : {{ nomsAttendus() }}</p>
        }
        @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }

        @if (vue() === 'membre' && jeDoisSigner()) {
          <div class="sp__signer">
            <p class="text-sm">Relisez le PV, puis signez : votre signature est horodatée, journalisée et imprimée au PV.</p>
            <div class="sp__actions">
              <button type="button" class="btn btn-outline btn-sm" [disabled]="travail()" (click)="relire()">Relire le PV (PDF)</button>
              <label class="sp__case"><input type="checkbox" [checked]="lu()" (change)="lu.set($any($event.target).checked)" /> J'ai relu le PV et je le signe</label>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="!lu() || travail()" (click)="signer()">Signer le PV d'ouverture</button>
            </div>
          </div>
        }

        @if (peutConstater()) {
          <details class="sp__empechement">
            <summary>Constater l'empêchement d'un signataire…</summary>
            <div class="sp__form">
              <label class="form-group">
                <span class="form-label">Signataire empêché</span>
                <select class="form-control" (change)="empeche.set($any($event.target).value)">
                  <option value="" [selected]="!empeche()">— Choisir —</option>
                  @for (a of attenduesSaufMoi(); track a.im) { <option [value]="a.im" [selected]="empeche() === a.im">{{ a.nom }}</option> }
                </select>
              </label>
              <label class="form-group">
                <span class="form-label">Motif (imprimé au PV)</span>
                <input class="form-control" type="text" [value]="motif()" (input)="motif.set($any($event.target).value)" />
              </label>
              <button type="button" class="btn btn-outline btn-sm" [disabled]="!empeche() || !motif().trim() || travail()" (click)="constater()">Constater l'empêchement</button>
            </div>
          </details>
        }
      </section>
    }
  `,
  styles: `
    .sp { display: flex; flex-direction: column; gap: 0.5rem; }
    .sp__h3 { margin: 0; font-size: 0.95rem; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .sp__liste { margin: 0; padding-left: 1.1rem; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 0.25rem; }
    .sp__attendues { margin: 0; }
    .sp__signer { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.6rem 0.8rem; border: 1px solid var(--n-200); border-radius: var(--radius-md, 6px); }
    .sp__actions { display: flex; gap: 0.7rem; flex-wrap: wrap; align-items: center; }
    .sp__case { display: inline-flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); }
    .sp__empechement summary { cursor: pointer; font-size: var(--text-sm); }
    .sp__form { display: grid; grid-template-columns: 1fr 2fr auto; gap: 0.5rem; align-items: end; padding-top: 0.5rem; }
    @media (max-width: 700px) { .sp__form { grid-template-columns: 1fr; } }
  `,
})
export class SignaturesPv {
  readonly idDmc = input.required<number>();
  readonly seance = input.required<Seance>();
  readonly vue = input.required<VueSignatures>();
  /** Identifiant de l'utilisateur connecté (`K…` pour un membre de la CAO). */
  readonly moi = input<string | null>(null);
  readonly geste = output<Seance>();

  private readonly service = inject(SeanceService);
  private readonly toast = inject(ToastService);

  readonly dateHeure = dateHeureFr;
  readonly travail = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly lu = signal(false);
  readonly empeche = signal('');
  readonly motif = signal('');

  readonly attendues = computed(() => this.seance().pv?.signaturesAttendues ?? []);
  /** Un PV produit avant V70 : ni signature ni signataire attendu — il porte des lignes de signature sur papier. */
  readonly anterieur = computed(() => {
    const pv = this.seance().pv;
    return !!pv && !pv.signe && !(pv.signatures?.length) && !this.attendues().length;
  });
  readonly nomsAttendus = computed(() => this.attendues().map((a) => a.nom).join(', '));
  readonly jeDoisSigner = computed(() => this.attendues().some((a) => a.im === this.moi()));
  readonly attenduesSaufMoi = computed(() => this.attendues().filter((a) => a.im !== this.moi()));
  /** Le président constate ; le responsable aussi, mais seulement une fois le président lui-même empêché (contrat V70). */
  readonly peutConstater = computed(() => {
    const s = this.seance();
    if (s.pv?.signe || !this.attenduesSaufMoi().length) return false;
    if (this.vue() === 'membre') return s.membres.some((m) => m.im === this.moi() && m.president);
    if (this.vue() === 'responsable') {
      const president = s.membres.find((m) => m.president);
      return !!president && (s.pv?.signatures ?? []).some((g) => g.im === president.im && g.empechement);
    }
    return false;
  });

  relire(): void {
    this.travail.set(true);
    this.service.pv(this.idDmc()).subscribe({
      next: (b) => {
        this.travail.set(false);
        ouvrirBlobSur(b);
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  signer(): void {
    this.travail.set(true);
    this.erreur.set(null);
    this.service.signerPv(this.idDmc()).subscribe({
      next: (s) => {
        this.travail.set(false);
        this.lu.set(false);
        this.geste.emit(s);
        this.toast.success(s.pv?.signe ? 'Votre signature est posée : le PV est signé de tous.' : 'Votre signature est posée sur le PV.');
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  constater(): void {
    this.travail.set(true);
    this.erreur.set(null);
    this.service.constaterEmpechement(this.idDmc(), this.empeche(), this.motif().trim()).subscribe({
      next: (s) => {
        this.travail.set(false);
        this.empeche.set('');
        this.motif.set('');
        this.geste.emit(s);
        this.toast.success("L'empêchement est constaté ; il est imprimé au PV.");
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  private echec(e: ApiError): void {
    this.travail.set(false);
    switch (codeErreur(e)) {
      case 'NON_PRESENT':
        this.erreur.set("Vous n'êtes pas signataire de ce PV : seuls les membres présents à la séance le signent.");
        return;
      case 'DEJA_SIGNE':
        this.erreur.set('Cette signature est déjà posée.');
        return;
      case 'PV_NON_PRODUIT':
        this.erreur.set("Le PV n'est pas encore produit par le responsable de la procédure.");
        return;
      case 'MOTIF_ABSENT':
        this.erreur.set("Le motif de l'empêchement est obligatoire.");
        return;
      case 'NON_SIGNATAIRE':
        this.erreur.set("Cette personne n'est pas signataire du PV.");
        return;
    }
    this.erreur.set(e.message || "Le geste n'a pas abouti.");
  }
}
