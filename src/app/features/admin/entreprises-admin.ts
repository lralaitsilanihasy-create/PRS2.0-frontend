import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { Entreprise, PieceEntreprise, StatutVerificationNif } from '../../models';
import { EntreprisesAdminService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_STATUT_NIF, LIBELLES_TYPE_PIECE, dateHeureFr, messageExclusion, tailleLisible } from '../candidat/libelles-candidat';

const STATUTS: readonly StatutVerificationNif[] = ['NON_VERIFIE', 'REFUSE_SUR_PIECES', 'INCONNU_DGI', 'VERIFIE_SUR_PIECES', 'VERIFIE_DGI'];

/**
 * Écran Administrateur — **entreprises candidates : la vérification du NIF sur pièces** (`/api/admin/entreprises`,
 * soumission en ligne §B4). La file par défaut est `NON_VERIFIE`, les plus anciennes d'abord ; l'Administrateur ouvre
 * la carte fiscale (par `ouvrirBlobSur`, jamais une URL brute), la rapproche du NIF déclaré et décide : vérifié, ou
 * refusé avec un motif obligatoire que le candidat lira. **La décision ne bloque jamais un dépôt** (pilote, Q2) : la
 * commission la lit à l'ouverture des plis. Une exclusion de l'ARMP rapprochée est rappelée sur la fiche.
 */
@Component({
  selector: 'app-entreprises-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <section class="ea">
      <header class="page-header page-header--actions">
        <div>
          <div class="page-subtitle">Comptes &amp; personnes · espace candidat</div>
          <h1 class="page-title">Entreprises candidates</h1>
        </div>
        <label class="form-group ea__filtre">
          <span class="form-label">Vérification du NIF</span>
          <select class="form-control" [value]="statut()" (change)="filtrer($any($event.target).value)">
            @for (s of statuts; track s) { <option [value]="s">{{ libelles[s] }}</option> }
          </select>
        </label>
      </header>
      <p class="page-role">
        Les entreprises déclarées par les candidats, par état de vérification. Rapprochez la carte fiscale du NIF
        déclaré, puis décidez. La décision ne bloque aucun dépôt : la commission la lit à l'ouverture des plis.
      </p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Les entreprises n'ont pas pu être chargées." (reessayer)="charger()" />
      } @else if (!entreprises().length) {
        <div class="empty-state">
          <p class="empty-state-title">Aucune entreprise dans cet état.</p>
        </div>
      } @else {
        <ul class="ea__liste" aria-label="Entreprises">
          @for (e of entreprises(); track e.id) {
            <li class="card ea__carte">
              <div class="ea__tete">
                <div>
                  <strong>{{ e.raisonSociale }}</strong>
                  <span class="cnm-mono ea__nif">NIF {{ e.nif }}</span>
                  @if (e.stat) { <span class="cnm-mono ea__nif">STAT {{ e.stat }}</span> }
                  @if (e.rcs) { <span class="cnm-mono ea__nif">RCS {{ e.rcs }}</span> }
                </div>
                <div class="ea__etat">
                  <span class="badge" [class.badge-success]="e.verification.statut === 'VERIFIE_DGI' || e.verification.statut === 'VERIFIE_SUR_PIECES'" [class.badge-danger]="e.verification.statut === 'REFUSE_SUR_PIECES' || e.verification.statut === 'INCONNU_DGI'" [class.badge-neutral]="e.verification.statut === 'NON_VERIFIE'">{{ libelles[e.verification.statut] }}</span>
                  @if (e.exclusion) { <span class="badge badge-danger">Exclue par l'ARMP</span> }
                  <button type="button" class="btn btn-sm btn-outline" [attr.aria-expanded]="ouverte() === e.id" (click)="basculer(e.id)">{{ ouverte() === e.id ? 'Replier' : 'Examiner' }}</button>
                </div>
              </div>
              @if (ouverte() === e.id) {
                <div class="ea__detail">
                  <dl class="ea__dl">
                    <dt>Adresse</dt><dd>{{ e.adresse }}</dd>
                    <dt>Représentant</dt><dd>{{ e.representant.nom }} {{ e.representant.prenom }}{{ e.representant.fonction ? ' — ' + e.representant.fonction : '' }}</dd>
                    @if (e.verification.date) { <dt>Dernière décision</dt><dd>{{ dateHeure(e.verification.date) }}{{ e.verification.acteur ? ' par ' + e.verification.acteur : '' }}{{ e.verification.motif ? ' — ' + e.verification.motif : '' }}</dd> }
                  </dl>
                  @if (e.exclusion; as x) {
                    <p class="alert alert-danger" role="alert"><span>{{ message(x) }} <span class="text-sm">Motif : {{ x.motif }}.</span></span></p>
                  }

                  <h2 class="ea__h2">Pièces</h2>
                  @if (e.pieces.length) {
                    <ul class="ea__pieces">
                      @for (p of e.pieces; track p.id) {
                        <li class="ea__piece">
                          <span><strong>{{ typesPiece[p.type] }}</strong> <span class="text-xs text-muted">{{ p.nomFichier }} · {{ taille(p.taille) }} · {{ date(p.dateDepot) }}</span></span>
                          <button type="button" class="btn btn-sm btn-outline" [disabled]="ouvertureEnCours() === p.id" (click)="ouvrirPiece(e, p)">{{ ouvertureEnCours() === p.id ? 'Ouverture…' : 'Ouvrir' }}</button>
                        </li>
                      }
                    </ul>
                  } @else {
                    <p class="text-sm text-muted">Aucune pièce téléversée : la vérification sur pièces attend la carte fiscale.</p>
                  }

                  <h2 class="ea__h2">Décision</h2>
                  <form class="cnm-form ea__decision" (submit)="$event.preventDefault(); decider(e)" novalidate [attr.aria-label]="'Décision pour ' + e.raisonSociale">
                    <fieldset class="ea__choix">
                      <legend class="form-label">Issue de la vérification</legend>
                      <label class="ea__radio"><input type="radio" name="statut-{{ e.id }}" value="VERIFIE_SUR_PIECES" [checked]="decision() === 'VERIFIE_SUR_PIECES'" (change)="decision.set('VERIFIE_SUR_PIECES')" /> NIF vérifié sur pièces</label>
                      <label class="ea__radio"><input type="radio" name="statut-{{ e.id }}" value="REFUSE_SUR_PIECES" [checked]="decision() === 'REFUSE_SUR_PIECES'" (change)="decision.set('REFUSE_SUR_PIECES')" /> Pièces refusées</label>
                    </fieldset>
                    <label class="form-group">
                      <span class="form-label">Motif{{ decision() === 'REFUSE_SUR_PIECES' ? ' (obligatoire pour un refus, lu par le candidat)' : ' (facultatif)' }}</span>
                      <textarea class="form-control" rows="2" [value]="motif()" (input)="motif.set($any($event.target).value)" [class.error]="!!erreurMotif()"></textarea>
                      @if (erreurMotif(); as m) { <span class="form-error">{{ m }}</span> }
                    </label>
                    <div class="ea__pied">
                      <button type="submit" class="btn btn-primary btn-sm" [disabled]="!decision() || envoi()">{{ envoi() ? 'Enregistrement…' : 'Enregistrer la décision' }}</button>
                    </div>
                  </form>
                </div>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .ea { display: flex; flex-direction: column; gap: 1rem; }
    .ea__filtre { min-width: 16rem; margin: 0; }
    .ea__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .ea__carte { padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .ea__tete { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .ea__nif { margin-left: 0.75rem; font-size: var(--text-xs); color: var(--n-500); }
    .ea__etat { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .ea__detail { display: flex; flex-direction: column; gap: 0.6rem; padding-top: 0.6rem; border-top: 1px solid var(--n-200); }
    .ea__dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; font-size: var(--text-sm); }
    .ea__dl dt { color: var(--n-500); }
    .ea__dl dd { margin: 0; }
    .ea__h2 { margin: 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ea__pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .ea__piece { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.4rem 0.6rem; border: 1px solid var(--n-200); border-radius: var(--radius-md); font-size: var(--text-sm); }
    .ea__decision { display: flex; flex-direction: column; gap: 0.5rem; }
    .ea__choix { border: 0; padding: 0; margin: 0; display: flex; gap: 1rem; flex-wrap: wrap; }
    .ea__radio { display: inline-flex; align-items: center; gap: 0.35rem; font-size: var(--text-sm); }
    .ea__pied { display: flex; gap: 0.5rem; }
    @media (max-width: 600px) { .ea__dl { grid-template-columns: 1fr; } }
  `,
})
export class EntreprisesAdmin implements OnInit {
  private readonly service = inject(EntreprisesAdminService);
  private readonly toast = inject(ToastService);

  readonly statuts = STATUTS;
  readonly libelles = LIBELLES_STATUT_NIF;
  readonly typesPiece = LIBELLES_TYPE_PIECE;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;
  readonly message = messageExclusion;

  readonly statut = signal<StatutVerificationNif>('NON_VERIFIE');
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly entreprises = signal<Entreprise[]>([]);
  readonly ouverte = signal<number | null>(null);
  readonly ouvertureEnCours = signal<number | null>(null);

  readonly decision = signal<'VERIFIE_SUR_PIECES' | 'REFUSE_SUR_PIECES' | null>(null);
  readonly motif = signal('');
  readonly erreurMotif = signal<string | null>(null);
  readonly envoi = signal(false);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.liste(this.statut()).subscribe({
      next: (l) => {
        this.entreprises.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  filtrer(statut: string): void {
    this.statut.set(statut as StatutVerificationNif);
    this.ouverte.set(null);
    this.charger();
  }

  basculer(id: number): void {
    this.ouverte.update((o) => (o === id ? null : id));
    this.decision.set(null);
    this.motif.set('');
    this.erreurMotif.set(null);
  }

  ouvrirPiece(e: Entreprise, p: PieceEntreprise): void {
    if (this.ouvertureEnCours()) return;
    this.ouvertureEnCours.set(p.id);
    this.service.fichierPiece(e.id, p.id).subscribe({
      next: (blob) => {
        this.ouvertureEnCours.set(null);
        ouvrirBlobSur(blob);
      },
      error: () => this.ouvertureEnCours.set(null),
    });
  }

  decider(e: Entreprise): void {
    const statut = this.decision();
    if (!statut || this.envoi()) return;
    const motif = this.motif().trim();
    if (statut === 'REFUSE_SUR_PIECES' && !motif) {
      this.erreurMotif.set('Un refus porte toujours son motif : le candidat le lira pour corriger.');
      return;
    }
    this.envoi.set(true);
    this.erreurMotif.set(null);
    this.service.decider(e.id, { statut, motif: motif || null }).subscribe({
      next: (v) => {
        this.envoi.set(false);
        this.toast.success(`${e.raisonSociale} : ${LIBELLES_STATUT_NIF[v.statut]}.`, 'Décision enregistrée');
        // L'entreprise change d'état : elle quitte la file affichée, qu'on relit plutôt que de la deviner.
        this.ouverte.set(null);
        this.charger();
      },
      error: (err: ApiError) => {
        this.envoi.set(false);
        this.erreurMotif.set(err.message || "La décision n'a pas été enregistrée.");
      },
    });
  }
}
