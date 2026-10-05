import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { empreinteCourte, formaterEmpreinte } from '../../core/securite/cles-detenteur';
import { Ceremonie, Depositaire, Detenteur } from '../../models';
import { CeremonieService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_ETAT_CEREMONIE, LIBELLES_ETAT_PART, classeCeremonie, classePart } from '../cao/libelles-cao';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { PartSecours } from './part-secours';

/**
 * Section **« Cérémonie des clés »** de l'écran du responsable de la procédure (lot 2b, ADR-0013 §1, §5) : l'état, les `n`
 * détenteurs et leurs empreintes, les avertissements (S1, marge), **clore** (409 nomme les manquants) et **rouvrir** (S4,
 * refusé dès la première offre), et la **part de secours** (S3). ⚠️ V71 (décision du pilote, 05/10) : la clé de secours naît
 * chez le **dépositaire**, depuis son espace ; le responsable en lit l'état (`app-part-secours`), et ne garde la vérification
 * et la perte que pour une clé de l'ancien geste.
 */
@Component({
  selector: 'app-ceremonie-responsable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, PartSecours],
  template: `
    <section class="cr" aria-labelledby="cr-titre">
      <h2 id="cr-titre" class="cr__h2">Cérémonie des clés</h2>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement de la cérémonie…</p>
      } @else if (refuse()) {
        <div class="alert alert-info" role="status"><span>La cérémonie n'est servie qu'au responsable de la procédure et aux membres de la commission.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="La cérémonie n'a pas pu être chargée." (reessayer)="charger()" />
      } @else if (ceremonie(); as c) {
        <div class="cr__etat">
          <span class="badge" [class]="'badge ' + classeCeremonie(c.etat)">{{ ceremonies[c.etat] }}</span>
          <span class="text-sm text-muted">{{ c.n }} parts (membres + secours), quorum {{ c.quorum ?? '—' }}{{ c.dateCloture ? ' · close le ' + dateHeure(c.dateCloture) : c.dateCeremoniePrevue ? ' · prévue le ' + dateHeure(c.dateCeremoniePrevue) : '' }}</span>
          @if (c.premierDepot) { <span class="badge badge-warning">Des offres sont déposées</span> }
        </div>
        @for (a of c.avertissements; track a.regle) { <p class="alert alert-warning" role="status"><span>{{ a.message }}</span></p> }
        @if (erreurAction(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }

        <div class="table-card">
          <table class="cr__table">
            <caption class="cnm-sr-only">Les détenteurs de parts et l'état de leur clé</caption>
            <thead><tr><th scope="col">Détenteur</th><th scope="col">Part</th><th scope="col">Empreinte de la clé publiée</th><th scope="col">Dernière vérification</th></tr></thead>
            <tbody>
              @for (d of c.detenteurs; track $index) {
                <tr>
                  <td>{{ d.nom }}@if (d.role === 'SECOURS') { <span class="text-xs text-muted"> — part de secours (dépositaire)</span> }</td>
                  <td><span class="badge" [class]="'badge ' + classePart(d.etatPart)">{{ parts[d.etatPart] }}</span>@if (d.remplacements) { <span class="text-xs text-muted"> · remplacée {{ d.remplacements }}×</span> }</td>
                  <td><code class="cnm-mono" [title]="d.empreinte ? formater(d.empreinte) : ''">{{ d.empreinte ? courte(d.empreinte) : '—' }}</code></td>
                  <td class="nowrap">{{ d.derniereVerification ? dateHeure(d.derniereVerification) : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="cr__actions">
          @if (c.etat !== 'CLOSE') {
            <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="cloturer()">{{ travail() ? '…' : 'Clore la cérémonie' }}</button>
            <span class="text-sm text-muted">Possible quand les {{ c.n }} clés sont publiées : les clés publiques sont alors servies aux candidats.</span>
          } @else if (!c.premierDepot) {
            @if (!confirmerReouverture()) {
              <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="confirmerReouverture.set(true)">Rouvrir la cérémonie…</button>
            } @else {
              <span class="cr__confirm">Toutes les parts seront à republier, et les paramètres internes redeviennent modifiables.
                <button type="button" class="btn btn-sm btn-danger" [disabled]="travail()" (click)="rouvrir()">Confirmer la réouverture</button>
                <button type="button" class="btn btn-sm btn-outline" (click)="confirmerReouverture.set(false)">Annuler</button>
              </span>
            }
          } @else {
            <span class="text-sm text-muted">Des offres sont scellées : la cérémonie ne se rouvre plus. Une part perdue se remplace par son détenteur ; la marge et la part de secours couvrent le reste.</span>
          }
        </div>

        <!-- ⚠️ V71 (05/10) : la part de secours se génère chez le dépositaire ; ici, son état (et l'ancien geste, s'il y a lieu). -->
        <app-part-secours [idDmc]="idDmc()" vue="responsable" [secours]="secours()" [depositaire]="depositaire()" (changement)="apresSecours()" />
      }
    </section>
  `,
  styles: `
    .cr { display: flex; flex-direction: column; gap: 0.75rem; }
    .cr__h2 { margin: 0.5rem 0 0; font-size: 1.05rem; }
    .cr__h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .cr__etat { margin: 0; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; font-size: 0.9rem; }
    .cr__table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .cr__table th, .cr__table td { text-align: left; padding: 0.45rem 0.7rem; border-bottom: 1px solid var(--n-200); vertical-align: top; }
    .cr__table th { color: var(--n-500); font-weight: 600; }
    .cr__actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .cr__confirm { display: inline-flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); }
    .cr__secours { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .cr__modal { max-width: 40rem; }
    .cr__corps { display: flex; flex-direction: column; gap: 0.6rem; }
    .cr__phrase { margin: 0; padding: 0.6rem 0.8rem; background: var(--n-100); border-radius: var(--radius-md); font-size: 1.1rem; letter-spacing: 0.02em; user-select: all; }
    .cr__emp { margin: 0; font-size: var(--text-sm); word-break: break-all; }
    .cr__case { display: flex; gap: 0.5rem; align-items: center; font-size: var(--text-sm); }
  `,
})
export class CeremonieResponsable {
  readonly idDmc = input.required<number>();
  /** Le dépositaire désigné dans les paramètres internes (son compte, V71) ; il génère lui-même la clé de secours. */
  readonly depositaire = input<Depositaire | null>(null);
  /** Le quorum des paramètres internes : son changement relit la cérémonie. */
  readonly quorum = input<number | null>(null);
  /** Un geste a changé l'état : le parent relit les paramètres internes (part de secours, journal). */
  readonly changement = output<void>();

  private readonly service = inject(CeremonieService);
  private readonly toast = inject(ToastService);

  readonly parts = LIBELLES_ETAT_PART;
  readonly ceremonies = LIBELLES_ETAT_CEREMONIE;
  readonly classePart = classePart;
  readonly classeCeremonie = classeCeremonie;
  readonly dateHeure = dateHeureFr;
  readonly formater = formaterEmpreinte;
  readonly courte = empreinteCourte;

  readonly chargement = signal(true);
  readonly refuse = signal(false);
  readonly erreur = signal(false);
  readonly ceremonie = signal<Ceremonie | null>(null);
  readonly secours = computed<Detenteur | null>(() => this.ceremonie()?.detenteurs.find((d) => d.role === 'SECOURS') ?? null);

  readonly travail = signal(false);
  readonly erreurAction = signal<string | null>(null);
  readonly confirmerReouverture = signal(false);

  constructor() {
    // Lue au premier affichage, puis relue chaque fois que les paramètres internes changent (quorum, dépositaire) : sans quoi,
    // après « Enregistrer », la section gardait « quorum — » et une part de secours sans nom (capture du 05/10, fiche 41).
    effect(() => {
      this.depositaire();
      this.quorum();
      untracked(() => this.charger());
    });
  }

  charger(): void {
    this.chargement.set(true);
    this.refuse.set(false);
    this.erreur.set(false);
    this.service.lire(this.idDmc()).subscribe({
      next: (c) => {
        this.ceremonie.set(c);
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 403) this.refuse.set(true);
        else this.erreur.set(true);
      },
    });
  }

  private apres(message: string): void {
    this.travail.set(false);
    this.toast.success(message);
    this.charger();
    this.changement.emit();
  }

  cloturer(): void {
    if (this.travail()) return;
    this.travail.set(true);
    this.erreurAction.set(null);
    this.service.cloturer(this.idDmc()).subscribe({
      next: () => this.apres('Cérémonie close : les clés publiques sont publiées aux candidats.'),
      error: (e: ApiError) => {
        this.travail.set(false);
        this.erreurAction.set(this.motif(e));
      },
    });
  }

  rouvrir(): void {
    if (this.travail()) return;
    this.travail.set(true);
    this.erreurAction.set(null);
    this.confirmerReouverture.set(false);
    this.service.rouvrir(this.idDmc()).subscribe({
      next: () => this.apres('Cérémonie rouverte : chaque membre republie sa clé, puis vous la reclorez.'),
      error: (e: ApiError) => {
        this.travail.set(false);
        this.erreurAction.set(this.motif(e));
      },
    });
  }

  /** Un geste sur la part de secours : on relit la cérémonie, et le parent ses paramètres internes. */
  apresSecours(): void {
    this.charger();
    this.changement.emit();
  }

  private motif(e: unknown): string {
    const api = e as Partial<ApiError> & { status?: number };
    switch (codeErreur(api as ApiError)) {
      case 'CLES_INCOMPLETES':
        return api.message || 'Des clés manquent : la cérémonie ne se clôt pas.';
      case 'DEPOT_EXISTANT':
        return 'Des offres sont scellées : la cérémonie ne se rouvre plus.';
      case 'DEPOSITAIRE_ABSENT':
        return 'Désignez d’abord le dépositaire de la part de secours, puis enregistrez.';
      case 'CEREMONIE_CLOSE':
      case 'CLE_EXISTANTE':
        return 'La clé de secours est déjà publiée : passez par « Remplacer la clé de secours ».';
      case 'DEFI_ECHOUE':
        return 'Le défi a échoué : la clé déverrouillée n’est pas celle publiée pour la part de secours.';
      case 'DEFI_EXPIRE':
        return 'Le défi a expiré (cinq minutes) : recommencez.';
      case 'CLE_ABSENTE':
        return 'Aucune clé de secours publiée.';
    }
    if (api.status === 404) return 'Aucune enveloppe de secours gardée par le serveur.';
    if (api.status === 403) return 'Ce geste est réservé au responsable de la procédure.';
    return (e as Error)?.message || 'Le geste n’a pas abouti.';
  }
}
