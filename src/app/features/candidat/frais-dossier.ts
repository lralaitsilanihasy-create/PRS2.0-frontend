import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, model, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { TYPES_PIECE, ouvrirBlobSur, validerFichier } from '../../core/securite/fichiers-surs';
import { ProcedureEnLigne, RecuDao } from '../../models';
import { ProceduresEnLigneService } from '../../services';
import { dateHeureFr } from './libelles-candidat';

const LIBELLES_ETAT: Readonly<Record<RecuDao['etat'], string>> = {
  EN_ATTENTE: 'En attente de validation',
  VALIDE: 'Validé',
  REFUSE: 'Refusé',
};

/** Le refus du dépôt d'un reçu, nommé (V72, §B2). */
function motifRefus(e: unknown): string {
  const api = e as Partial<ApiError> & { status?: number };
  switch (codeErreur(api as ApiError)) {
    case 'RECU_EN_ATTENTE':
      return 'Un reçu de votre entreprise attend déjà la décision de la personne responsable des marchés.';
    case 'RECU_DEJA_VALIDE':
      return 'Un reçu validé couvre déjà ces lots.';
    case 'PROCEDURE_FERMEE':
      return 'La date limite est passée, ou ce dossier est gratuit : aucun reçu n’est attendu.';
    case 'ENTREPRISE_ABSENTE':
      return 'Déclarez d’abord votre entreprise (« Mon entreprise ») : le reçu est rattaché à son NIF.';
    case 'ENTREPRISE_EXCLUE':
      return api.message || 'Votre entreprise est exclue des marchés publics.';
    case 'FORMAT_INVALIDE':
      return 'Le fichier n’est ni un PDF ni une image JPEG ou PNG.';
    case 'FICHIER_ABSENT':
      return 'Joignez le reçu.';
  }
  if (api.status === 413) return 'Le fichier dépasse la taille autorisée pour les pièces.';
  return api.message || 'Le reçu n’a pas pu être déposé.';
}

/**
 * Les **frais de dossier** d'une procédure à retrait payant (V72, voie B du 06/10) : les montants par lot et le compte de l'ARMP ;
 * le dépôt du reçu du versement ; son état (en attente, validé, refusé avec le motif). Les documents du DAO ne se retirent qu'avec un
 * reçu validé : le parent lit l'état par `recu`. Le reçu vaut pour **l'entreprise** (son NIF), pas pour le seul compte.
 */
@Component({
  selector: 'app-frais-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @let p = procedure();
    <dl class="fd__dl">
      @for (f of p.fraisDossier ?? []; track f.lot) {
        <dt>{{ f.lot ? 'Lot ' + f.lot : 'Frais du dossier' }}</dt><dd><strong>{{ nombre(f.montant) }} Ar</strong></dd>
      }
      @if (p.compteDao; as c) {
        <dt>À verser au compte</dt><dd>{{ c.titulaire }}{{ c.banque ? ' · ' + c.banque : '' }} · <span class="cnm-mono">{{ c.numeroCompte }}</span></dd>
      }
    </dl>
    <p class="text-sm text-muted">Le paiement se fait hors de la plateforme. Déposez ensuite le reçu de votre versement : le dossier se retire dès que la personne responsable des marchés l’a validé.</p>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement de votre reçu…</p>
    } @else {
      @if (recu(); as r) {
        <div class="fd__etat" [class.fd__etat--ok]="r.etat === 'VALIDE'" [class.fd__etat--ko]="r.etat === 'REFUSE'" role="status">
          <span class="badge" [class.badge-success]="r.etat === 'VALIDE'" [class.badge-warning]="r.etat === 'EN_ATTENTE'" [class.badge-danger]="r.etat === 'REFUSE'">{{ etats[r.etat] }}</span>
          <span class="text-sm">Reçu {{ r.referencePaiement }} du {{ dateCourte(r.datePaiement) }} · {{ nombre(r.montant) }} Ar{{ r.lots?.length ? ' · lots ' + r.lots!.join(', ') : '' }} · déposé le {{ dateHeure(r.dateDepot) }}</span>
          @if (r.etat === 'REFUSE' && r.motifRefus) { <span class="text-sm fd__motif">Motif du refus : {{ r.motifRefus }}</span> }
          @if (r.etat === 'VALIDE' && r.dateDecision) { <span class="text-sm">Validé le {{ dateHeure(r.dateDecision) }} : vous pouvez retirer le dossier.</span> }
          <button type="button" class="btn btn-sm btn-outline fd__voir" [disabled]="ouverture()" (click)="voir()">Voir mon reçu</button>
        </div>
      }
      @if (peutDeposer()) {
        @if (!formulaire()) {
          <button type="button" class="btn btn-primary btn-sm fd__ouvrir" (click)="formulaire.set(true)">{{ recu() ? (recu()!.etat === 'REFUSE' ? 'Déposer un nouveau reçu' : 'Déposer un reçu pour d’autres lots') : 'Déposer mon reçu de paiement' }}</button>
        } @else {
          <form class="fd__form" (submit)="$event.preventDefault(); deposer()" novalidate aria-label="Dépôt du reçu des frais de dossier">
            @if (erreur(); as e) {
              <div class="alert alert-danger" role="alert"><span>{{ e }}@if (entrepriseAbsente()) { <a routerLink="/candidat/entreprise"> Mon entreprise</a> }</span></div>
            }
            @if (lotsOffrables().length > 1) {
              <fieldset class="fd__lots">
                <legend class="form-label">Lots couverts par ce versement</legend>
                @for (n of lotsOffrables(); track n) {
                  <label><input type="checkbox" [checked]="lots().includes(n)" (change)="basculerLot(n, $any($event.target).checked)" /> Lot {{ n }}</label>
                }
              </fieldset>
            }
            <div class="fd__grille">
              <label class="form-group"><span class="form-label">Montant versé (Ariary)</span><input class="form-control" type="number" min="1" step="1" [value]="montant() ?? ''" (input)="montant.set($any($event.target).valueAsNumber || null)" /></label>
              <label class="form-group"><span class="form-label">Référence du versement</span><input class="form-control" type="text" placeholder="n° du bordereau ou de la quittance" [value]="reference()" (input)="reference.set($any($event.target).value)" /></label>
              <label class="form-group"><span class="form-label">Date du versement</span><input class="form-control" type="date" [max]="aujourdhui" [value]="datePaiement()" (input)="datePaiement.set($any($event.target).value)" /></label>
              <label class="form-group"><span class="form-label">Banque (facultatif)</span><input class="form-control" type="text" [value]="banque()" (input)="banque.set($any($event.target).value)" /></label>
            </div>
            <label class="form-group"><span class="form-label">Reçu (PDF, JPEG ou PNG)</span>
              <input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisir($event)" /></label>
            @if (erreurFichier(); as m) { <span class="form-error">{{ m }}</span> }
            @if (montantBas()) { <p class="text-sm fd__alerte">Le montant est inférieur aux frais des lots choisis ({{ nombre(fraisAttendus()) }} Ar) : la personne responsable des marchés en jugera.</p> }
            <div class="fd__actions">
              <button type="submit" class="btn btn-primary btn-sm" [disabled]="envoi() || !complet()">{{ envoi() ? 'Dépôt…' : 'Déposer le reçu' }}</button>
              <button type="button" class="btn btn-outline btn-sm" [disabled]="envoi()" (click)="formulaire.set(false)">Annuler</button>
            </div>
          </form>
        }
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.6rem; }
    .fd__dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; font-size: var(--text-sm); }
    .fd__dl dt { color: var(--n-500); }
    .fd__dl dd { margin: 0; }
    .fd__etat { display: flex; flex-wrap: wrap; gap: 0.4rem 0.75rem; align-items: center; padding: 0.6rem 0.75rem; border: 1px solid var(--n-200); border-left: 4px solid var(--warning-text); border-radius: var(--radius-md); }
    .fd__etat--ok { border-left-color: var(--success-text); }
    .fd__etat--ko { border-left-color: var(--danger-text); }
    .fd__motif { color: var(--danger-text); flex-basis: 100%; }
    .fd__voir { margin-left: auto; }
    .fd__ouvrir { align-self: flex-start; }
    .fd__form { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; border: 1px solid var(--n-200); border-radius: var(--radius-md); }
    .fd__lots { border: 0; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; font-size: var(--text-sm); }
    .fd__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: 0.5rem; }
    .fd__alerte { margin: 0; color: var(--warning-text); }
    .fd__actions { display: flex; gap: 0.5rem; }
  `,
})
export class FraisDossier implements OnInit {
  private readonly service = inject(ProceduresEnLigneService);

  readonly procedure = input.required<ProcedureEnLigne>();
  /** Le reçu le plus récent de l'entreprise, partagé avec le parent (qui en déduit le droit de retirer). */
  readonly recu = model<RecuDao | null>(null);

  readonly etats = LIBELLES_ETAT;
  readonly dateHeure = dateHeureFr;
  readonly aujourdhui = new Date().toISOString().slice(0, 10);

  readonly chargement = signal(true);
  readonly formulaire = signal(false);
  readonly envoi = signal(false);
  readonly ouverture = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly entrepriseAbsente = signal(false);
  readonly lots = signal<number[]>([]);
  readonly montant = signal<number | null>(null);
  readonly reference = signal('');
  readonly datePaiement = signal('');
  readonly banque = signal('');
  readonly fichier = signal<File | null>(null);
  readonly erreurFichier = signal<string | null>(null);

  /** Les lots qu'un nouveau reçu peut couvrir : tous, sauf ceux d'un reçu déjà validé. */
  readonly lotsOffrables = computed(() => {
    const tous = this.procedure().lots.map((l) => l.numero);
    const r = this.recu();
    if (r?.etat !== 'VALIDE') return tous;
    return r.lots?.length ? tous.filter((n) => !r.lots!.includes(n)) : [];
  });
  readonly peutDeposer = computed(() => {
    const p = this.procedure();
    const r = this.recu();
    if (p.etat === 'CLOSE') return false;
    if (!r || r.etat === 'REFUSE') return true;
    return r.etat === 'VALIDE' && this.lotsOffrables().length > 0;
  });
  readonly fraisAttendus = computed(() => {
    const frais = this.procedure().fraisDossier ?? [];
    const choisis = this.lots();
    return frais.filter((f) => f.lot == null || !choisis.length || choisis.includes(f.lot)).reduce((s, f) => s + f.montant, 0);
  });
  readonly montantBas = computed(() => (this.montant() ?? 0) > 0 && this.montant()! < this.fraisAttendus());
  readonly complet = computed(
    () => !!this.fichier() && (this.montant() ?? 0) > 0 && !!this.reference().trim() && !!this.datePaiement() && (this.lotsOffrables().length <= 1 || this.lots().length > 0),
  );

  ngOnInit(): void {
    this.service.monRecu(this.procedure().idDmc).subscribe({
      next: (r) => {
        this.recu.set(r);
        this.chargement.set(false);
      },
      error: () => {
        this.recu.set(null); // 404 : aucun reçu encore
        this.chargement.set(false);
      },
    });
  }

  basculerLot(n: number, coche: boolean): void {
    this.lots.update((l) => (coche ? [...l, n].sort((a, b) => a - b) : l.filter((x) => x !== n)));
  }

  choisir(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    const err = f ? validerFichier(f, TYPES_PIECE) : null;
    this.erreurFichier.set(err);
    this.fichier.set(err ? null : f);
  }

  deposer(): void {
    const f = this.fichier();
    if (!f || !this.complet() || this.envoi()) return;
    this.envoi.set(true);
    this.erreur.set(null);
    this.entrepriseAbsente.set(false);
    const offrables = this.lotsOffrables();
    // Un seul lot possible, ou un marché non alloti : « tout le dossier » (null) — sauf pour compléter d'autres lots.
    const lots = offrables.length > 1 ? this.lots() : this.recu()?.etat === 'VALIDE' ? offrables : null;
    this.service
      .deposerRecu(this.procedure().idDmc, { lots, montant: this.montant()!, referencePaiement: this.reference().trim(), datePaiement: this.datePaiement(), banque: this.banque().trim() || null }, f)
      .subscribe({
        next: (r) => {
          this.recu.set(r);
          this.envoi.set(false);
          this.formulaire.set(false);
          this.fichier.set(null);
        },
        error: (e) => {
          this.envoi.set(false);
          this.entrepriseAbsente.set(codeErreur(e as ApiError) === 'ENTREPRISE_ABSENTE');
          this.erreur.set(motifRefus(e));
        },
      });
  }

  voir(): void {
    this.ouverture.set(true);
    this.service.monRecuFichier(this.procedure().idDmc).subscribe({
      next: (b) => {
        this.ouverture.set(false);
        ouvrirBlobSur(b);
      },
      error: () => this.ouverture.set(false),
    });
  }

  nombre(v: number | null | undefined): string {
    return v == null ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
  dateCourte(iso: string): string {
    return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('fr-FR');
  }
}
