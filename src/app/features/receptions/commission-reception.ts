import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { CommissionReception } from '../../models';
import { ReceptionsCommandesService } from '../../services';
import { refusReception } from './receptions-bon';
import { maintenantServeur } from '../../core/horloge/heure-serveur';

interface MembreSaisi {
  nom: string;
  prenom: string;
  email: string;
  fonction: string;
  president: boolean;
}

const MEMBRE_VIDE = (): MembreSaisi => ({ nom: '', prenom: '', email: '', fonction: '', president: false });

function aujourdhui(): string {
  const d = maintenantServeur();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * ⚠️ Lot MS-4 (V127, 16/10 ; réponse Q1 du pilote) — **la commission de réception** d'un contrat en vigueur, désignée par décision de
 * la PRMP comme pour la CAO (loi n° 2016-055, art. 13) : la décision (référence, date), la présidence (la PRMP par défaut, sinon un
 * membre qui la représente, art. 13-IV) et les membres, au moins deux personnes en comptant la PRMP qui préside. Chaque membre reçoit
 * un compte (invitation par courriel). Saisie par la PRMP ou l'UGPM ; recomposée librement, sauf pendant qu'un PV attend ses
 * signatures.
 */
@Component({
  selector: 'app-commission-reception',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chargement()) {
      <p class="text-sm text-muted" role="status">Chargement de la commission de réception…</p>
    } @else {
      @let k = commission();
      @if (k && k.membres.length) {
        <p class="text-sm cr__meta">Désignée par la décision {{ k.decisionReference }} du {{ date(k.decisionDate) }} · présidée par {{ k.presideeParPrmp ? 'la PRMP' : presidentNom(k) }}.</p>
        <ul class="cr__membres">
          @for (m of k.membres; track m.email) {
            <li class="text-sm">{{ m.prenom }} {{ m.nom }}{{ m.fonction ? ', ' + m.fonction : '' }}{{ m.president ? ' — président' : '' }} · {{ m.email }}
              <span class="badge" [class.badge-success]="m.compteActif" [class.badge-warning]="!m.compteActif">{{ m.compteActif ? 'Compte actif' : 'Invitation envoyée' }}</span></li>
          }
        </ul>
      } @else {
        <p class="text-sm text-muted">Commission de réception non désignée : aucun procès-verbal de réception ne peut être établi.</p>
      }

      @if (peutDesigner()) {
        <details class="cr__details" [open]="ouvert()" (toggle)="ouvert.set($any($event.target).open)">
          <summary>{{ k?.membres?.length ? 'Recomposer la commission…' : 'Désigner la commission de réception…' }}</summary>
          <div class="cr__form">
            <div class="cr__ligne">
              <label class="form-group"><span class="form-label">Référence de la décision de la PRMP</span><input class="form-control" type="text" [value]="reference()" (input)="reference.set($any($event.target).value)" /></label>
              <label class="form-group"><span class="form-label">Date de la décision</span><input class="form-control" type="date" [max]="aujourdhui" [value]="dateDecision()" (input)="dateDecision.set($any($event.target).value)" /></label>
            </div>
            <label class="text-sm"><input type="checkbox" [checked]="presideeParPrmp()" (change)="presideeParPrmp.set($any($event.target).checked)" /> La PRMP préside la commission</label>
            <div class="cnm-table-wrap">
              <table class="cnm-table cr__table" aria-label="Membres de la commission de réception">
                <thead><tr><th scope="col">Nom</th><th scope="col">Prénom</th><th scope="col">Adresse électronique</th><th scope="col">Fonction</th>@if (!presideeParPrmp()) { <th scope="col">Préside</th> }<th scope="col"><span class="sr-only">Retirer</span></th></tr></thead>
                <tbody>
                  @for (m of membres(); track $index; let i = $index) {
                    <tr>
                      <td><input class="form-control form-control-sm" type="text" [attr.aria-label]="'Nom du membre ' + (i + 1)" [value]="m.nom" (input)="poser(i, 'nom', $any($event.target).value)" /></td>
                      <td><input class="form-control form-control-sm" type="text" [attr.aria-label]="'Prénom du membre ' + (i + 1)" [value]="m.prenom" (input)="poser(i, 'prenom', $any($event.target).value)" /></td>
                      <td><input class="form-control form-control-sm" type="email" [attr.aria-label]="'Adresse du membre ' + (i + 1)" [value]="m.email" (input)="poser(i, 'email', $any($event.target).value)" /></td>
                      <td><input class="form-control form-control-sm" type="text" [attr.aria-label]="'Fonction du membre ' + (i + 1)" [value]="m.fonction" (input)="poser(i, 'fonction', $any($event.target).value)" /></td>
                      @if (!presideeParPrmp()) { <td><input type="radio" name="cr-president" [attr.aria-label]="'Le membre ' + (i + 1) + ' préside'" [checked]="m.president" (change)="presider(i)" /></td> }
                      <td>@if (membres().length > 1) { <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer le membre ' + (i + 1)" (click)="retirer(i)">✕</button> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div><button type="button" class="btn btn-ghost btn-sm" (click)="membres.update((l) => [...l, vide()])">Ajouter un membre</button></div>
            <p class="text-sm text-muted">Au moins deux personnes, la PRMP comprise quand elle préside ; sinon un membre préside et la représente (art. 13-IV). Chaque membre reçoit un compte et une invitation par courriel.</p>
            @if (refus(); as r) { <div class="alert alert-danger" role="alert">{{ r }}</div> }
            <div><button type="button" class="btn btn-primary btn-sm" [disabled]="!complete() || occupe()" (click)="designer()">Enregistrer la commission</button></div>
          </div>
        </details>
      }
      @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.4rem; }
    .cr__meta { margin: 0; }
    .cr__membres { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.15rem; }
    .cr__details summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
    .cr__form { display: flex; flex-direction: column; gap: 0.45rem; padding-top: 0.4rem; }
    .cr__ligne { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end; }
    .cr__table { font-size: 0.82rem; }
    .cr__table thead th { background: var(--p-100); color: var(--p-800); }
  `,
})
export class CommissionReceptionPanneau implements OnInit {
  readonly idContrat = input.required<number>();
  /** PRMP ou UGPM de la fiche. */
  readonly peutDesigner = input(false);
  /** La commission lue ou enregistrée (le parent en déduit qui préside). */
  readonly lue = output<CommissionReception | null>();

  private readonly service = inject(ReceptionsCommandesService);
  private readonly toast = inject(ToastService);

  readonly date = dateFr;
  readonly aujourdhui = aujourdhui();
  readonly vide = MEMBRE_VIDE;

  readonly chargement = signal(true);
  readonly commission = signal<CommissionReception | null>(null);
  readonly erreur = signal<string | null>(null);
  readonly refus = signal<string | null>(null);
  readonly occupe = signal(false);
  readonly ouvert = signal(false);

  readonly reference = signal('');
  readonly dateDecision = signal(aujourdhui());
  readonly presideeParPrmp = signal(true);
  readonly membres = signal<MembreSaisi[]>([MEMBRE_VIDE()]);

  readonly complete = computed(() => {
    const m = this.membres();
    if (!this.reference().trim() || !this.dateDecision()) return false;
    if (!m.every((x) => x.nom.trim() && /.+@.+\..+/.test(x.email.trim()))) return false;
    if (new Set(m.map((x) => x.email.trim().toLowerCase())).size !== m.length) return false;
    return this.presideeParPrmp() ? m.length >= 1 : m.length >= 2 && m.filter((x) => x.president).length === 1;
  });

  ngOnInit(): void {
    this.service.commission(this.idContrat()).subscribe({
      next: (k) => {
        this.chargement.set(false);
        this.appliquer(k);
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        if (e.status === 404) { this.lue.emit(null); return; }
        this.erreur.set(refusReception(e));
      },
    });
  }

  /** Affiche la commission et pré-remplit le formulaire de recomposition. */
  private appliquer(k: CommissionReception): void {
    this.commission.set(k);
    this.lue.emit(k);
    if (k.membres.length) {
      this.reference.set(k.decisionReference ?? '');
      this.dateDecision.set(k.decisionDate ?? aujourdhui());
      this.presideeParPrmp.set(k.presideeParPrmp);
      this.membres.set(k.membres.map((m) => ({ nom: m.nom, prenom: m.prenom ?? '', email: m.email, fonction: m.fonction ?? '', president: m.president })));
    }
  }

  presidentNom(k: CommissionReception): string {
    const p = k.membres.find((m) => m.president);
    return p ? `${p.prenom ?? ''} ${p.nom}`.trim() : '—';
  }

  poser(i: number, cle: 'nom' | 'prenom' | 'email' | 'fonction', v: string): void {
    this.membres.update((l) => l.map((m, k) => (k === i ? { ...m, [cle]: v } : m)));
  }

  presider(i: number): void {
    this.membres.update((l) => l.map((m, k) => ({ ...m, president: k === i })));
  }

  retirer(i: number): void {
    this.membres.update((l) => l.filter((_, k) => k !== i));
  }

  designer(): void {
    const parPrmp = this.presideeParPrmp();
    this.occupe.set(true);
    this.refus.set(null);
    this.service.designer(this.idContrat(), {
      decision: { reference: this.reference().trim(), date: this.dateDecision() },
      presideeParPrmp: parPrmp,
      membres: this.membres().map((m) => ({ nom: m.nom.trim(), prenom: m.prenom.trim() || null, email: m.email.trim(), fonction: m.fonction.trim() || null, president: !parPrmp && m.president })),
    }).subscribe({
      next: (k) => {
        this.occupe.set(false);
        this.ouvert.set(false);
        this.appliquer(k);
        this.toast.success('La commission de réception est désignée ; chaque membre reçoit son invitation.');
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.refus.set(refusReception(e));
      },
    });
  }
}
