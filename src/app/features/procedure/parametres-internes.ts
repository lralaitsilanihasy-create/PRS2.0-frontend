import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiError, codeErreur, erreursParChamp } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { CompteDesignable, ParametresInternes } from '../../models';
import { FicheMarcheService } from '../../services/fiche-marche.services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/**
 * **Paramètres internes de la procédure** — écran SÉPARÉ de la fiche DAO, réservé au responsable de la procédure
 * (demande du 27/09, §B4 et §B5 ; plan Q6, Q7). Les membres de la commission détenteurs d'une part de clé
 * (INT-SE-01), le nombre de parts (INT-SE-02, calculé), le quorum de déchiffrement (INT-SE-03), la date de la
 * cérémonie des clés (INT-SE-04) et le responsable (INT-SE-05, posé par le serveur). Ces valeurs ne sont ni des
 * champs de la fiche ni des jetons : le moteur de rendu ne les voit jamais.
 *
 * ⚠️ Le droit est **par procédure**, pas par rôle de session : la route est transverse, ouverte à tout profil
 * connecté, et c'est le serveur qui répond 403 à quiconque n'est pas le titulaire — Administrateur compris. L'écran
 * nomme ce refus au lieu de rediriger : la personne sait pourquoi elle ne lit rien. Le journal servi ici porte
 * les anciennes et nouvelles valeurs ; le journal global de l'Administrateur ne les porte pas (Q7).
 */
@Component({
  selector: 'app-parametres-internes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, EtatErreur],
  template: `
    <section class="pi">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Procédure n° {{ idDmc() }} · responsable de la procédure</div>
          <h1 class="page-title">Paramètres internes de la remise électronique</h1>
        </div>
        <button type="button" class="btn btn-outline btn-sm" (click)="retour()">Retour</button>
      </header>
      <p class="page-role">
        Ce que la plateforme de dépôt saura de cette procédure sans jamais l'imprimer dans le dossier : qui détient une part
        de clé, combien de parts suffisent pour déchiffrer, quand la cérémonie des clés a lieu. Seul le responsable de la
        procédure lit et modifie cet écran ; chaque modification est journalisée avec l'ancienne et la nouvelle valeur.
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (refuse()) {
        <div class="alert alert-warning" role="status">
          <span><strong>Accès réservé au responsable de la procédure.</strong> Vous n'êtes pas désigné responsable de cette
          procédure : ses paramètres internes ne vous sont pas servis, même en lecture. La désignation se fait par
          l'Administrateur, depuis la fiche DAO.</span>
        </div>
      } @else if (contratAbsent()) {
        <div class="alert alert-info" role="status">
          <span><strong>Contrat en attente du backend</strong> (demande du 27/09, §B4) : la route des paramètres internes n'est
          pas encore servie.</span>
        </div>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les paramètres internes." (reessayer)="charger()" />
      } @else if (donnees(); as d) {
        <div class="pi__etat">
          <span class="badge" [class.badge-success]="d.etat === 'COMPLETS'" [class.badge-warning]="d.etat !== 'COMPLETS'">Paramètres {{ libelleEtat(d.etat) }}</span>
          @if (d.responsable; as r) { <span>Responsable : <strong>{{ r.nom }}</strong>&nbsp;<span class="cnm-mono">{{ r.im }}</span></span> }
          @else { <span class="pi__manque">Aucun responsable désigné</span> }
        </div>
        @if (d.anomalies.length) {
          <ul class="pi__anomalies" aria-label="Règles non satisfaites">
            @for (a of d.anomalies; track a.regle) { <li><span class="cnm-mono">{{ a.regle }}</span> {{ a.message }}</li> }
          </ul>
        }

        <form class="card cnm-form pi__form" aria-label="Paramètres internes" (submit)="$event.preventDefault(); enregistrer()" novalidate>
          <fieldset class="form-group">
            <legend class="form-label">Membres de la commission détenteurs d'une part de clé <span class="pi__code">INT-SE-01</span></legend>
            @if (candidats(); as cands) {
              @if (cands.length) {
                <div class="pi__cases">
                  @for (c of cands; track c.im) {
                    <label class="pi__case">
                      <input type="checkbox" [value]="c.im" [checked]="membres().includes(c.im)" (change)="basculerMembre(c.im, $any($event.target).checked)" />
                      <span>{{ c.nom }} <span class="cnm-mono">{{ c.im }}</span>@if (c.profil) { <span class="pi__profil"> · {{ c.profil }}</span> }</span>
                    </label>
                  }
                </div>
              } @else {
                <p class="text-muted">Aucun compte désignable n'est servi pour cette procédure.</p>
              }
            } @else {
              <p class="text-muted" role="status">Comptes en cours de chargement…</p>
            }
            @if (erreurDe('membresCommission'); as m) { <span class="form-error">{{ m }}</span> }
          </fieldset>

          <div class="cnm-form-grid">
            <div class="form-group">
              <span class="form-label">Nombre de parts (n) <span class="pi__code">INT-SE-02</span></span>
              <div class="pi__lecture" id="pi-nombre-parts">{{ membres().length }} <span class="pi__calc">calculé</span></div>
            </div>
            <label class="form-group">
              <span class="form-label">Quorum de déchiffrement (k) <span class="pi__code">INT-SE-03</span></span>
              <input class="form-control pi__court" id="pi-quorum" type="number" min="2" [max]="membres().length || null" [value]="quorum() ?? ''" (input)="quorum.set($any($event.target).valueAsNumber || null)" />
              <span class="form-hint">Entre 2 et le nombre de membres ; proposé : {{ quorumPropose() }}.</span>
              @if (erreurDe('quorum'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Date de la cérémonie des clés <span class="pi__code">INT-SE-04</span></span>
              <input class="form-control" id="pi-ceremonie" type="datetime-local" [value]="dateCeremonie() ?? ''" (input)="dateCeremonie.set($any($event.target).value || null)" />
              <span class="form-hint">Avant la publication de l'avis (règle 8).</span>
              @if (erreurDe('dateCeremonie'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <div class="form-group">
              <span class="form-label">Responsable de la procédure <span class="pi__code">INT-SE-05</span></span>
              <div class="pi__lecture" id="pi-responsable">{{ d.responsable ? d.responsable.nom + ' (' + d.responsable.im + ')' : '—' }} <span class="pi__calc">désigné par l'Administrateur</span></div>
            </div>
          </div>
          <div class="pi__pied">
            <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button>
          </div>
        </form>

        <h2 class="pi__h2">Journal des modifications</h2>
        @if (d.journal.length) {
          <div class="table-responsive">
            <table class="cnm-table pi__journal">
              <thead><tr><th scope="col">Date</th><th scope="col">Par</th><th scope="col">Champ</th><th scope="col">Ancienne valeur</th><th scope="col">Nouvelle valeur</th></tr></thead>
              <tbody>
                @for (e of d.journal; track $index) {
                  <tr><td class="cnm-mono">{{ e.date | date: 'dd/MM/yyyy HH:mm' }}</td><td>{{ e.nomActeur || e.acteur }}</td><td class="cnm-mono">{{ e.champ }}</td><td>{{ e.ancienneValeur ?? '—' }}</td><td>{{ e.nouvelleValeur ?? '—' }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="text-muted">Aucune modification enregistrée.</p>
        }
      }
    </section>
  `,
  styles: `
    .pi { display: flex; flex-direction: column; gap: 1rem; }
    .pi__etat { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; font-size: 0.9rem; }
    .pi__manque { color: var(--warning-text, #8a5a00); font-weight: 600; }
    .pi__anomalies { margin: 0; padding-left: 1.2rem; color: var(--n-700); font-size: 0.88rem; }
    .pi__form { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
    .pi fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
    .pi__cases { display: flex; flex-direction: column; gap: 0.35rem; }
    .pi__case { display: inline-flex; gap: 0.45rem; align-items: center; font-size: 0.9rem; }
    .pi__profil, .pi__code { color: var(--n-500); font-size: 0.78rem; font-weight: 400; }
    .pi__code { margin-left: 0.3rem; font-family: var(--font-mono, ui-monospace, monospace); }
    .pi__lecture { padding: 0.45rem 0.6rem; border-radius: 8px; background: var(--n-100); color: var(--n-700); font-size: 0.9rem; }
    .pi__calc { margin-left: 0.4rem; font-size: 0.74rem; font-style: italic; color: var(--n-500); }
    .pi__court { max-width: 8rem; }
    .pi__pied { display: flex; gap: 0.6rem; }
    .pi__h2 { margin: 0.5rem 0 0; font-size: 1.05rem; }
    .pi__journal { font-size: 0.86rem; }
  `,
})
export class ParametresInternesEcran implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly service = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly idDmc = signal<number | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly refuse = signal(false);
  readonly contratAbsent = signal(false);
  readonly erreur = signal(false);
  readonly donnees = signal<ParametresInternes | null>(null);
  readonly candidats = signal<CompteDesignable[] | null>(null);
  readonly erreurs = signal<ReadonlyMap<string, string>>(new Map());

  // les trois valeurs saisies ; le reste est calculé ou posé par le serveur
  readonly membres = signal<string[]>([]);
  readonly quorum = signal<number | null>(null);
  readonly dateCeremonie = signal<string | null>(null);
  /** « 3 sur 5 » : le quorum proposé suit la règle du défaut (3/5), borné à [2, n]. */
  readonly quorumPropose = computed(() => {
    const n = this.membres().length;
    return n ? Math.min(n, Math.max(2, Math.ceil((n * 3) / 5))) : 3;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      const id = Number(p.get('idDmc'));
      this.idDmc.set(Number.isFinite(id) && id > 0 ? id : null);
      this.charger();
    });
  }

  charger(): void {
    const id = this.idDmc();
    if (id == null) return;
    this.loading.set(true);
    this.refuse.set(false);
    this.contratAbsent.set(false);
    this.erreur.set(false);
    this.service.parametresInternes(id).subscribe({
      next: (d) => {
        this.poser(d);
        this.loading.set(false);
        this.service.candidatsParametresInternes(id).subscribe({ next: (c) => this.candidats.set(c ?? []), error: () => this.candidats.set([]) });
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.loading.set(false);
        if (e.status === 403) this.refuse.set(true);
        else if (e.status === 404) this.contratAbsent.set(true);
        else this.erreur.set(true);
      },
    });
  }

  private poser(d: ParametresInternes): void {
    this.donnees.set(d);
    this.membres.set((d.membresCommission ?? []).map((m) => m.im));
    this.quorum.set(d.quorum ?? null);
    this.dateCeremonie.set(d.dateCeremonie ?? null);
    this.erreurs.set(new Map());
  }

  libelleEtat(etat: ParametresInternes['etat']): string {
    return etat === 'COMPLETS' ? 'complets' : etat === 'INCOMPLETS' ? 'incomplets' : 'à saisir';
  }
  erreurDe(cle: string): string | null {
    return this.erreurs().get(cle) ?? null;
  }
  basculerMembre(im: string, coche: boolean): void {
    this.membres.update((l) => (coche ? (l.includes(im) ? l : [...l, im]) : l.filter((x) => x !== im)));
  }
  retour(): void {
    this.location.back();
  }

  enregistrer(): void {
    const id = this.idDmc();
    if (id == null || this.saving()) return;
    this.saving.set(true);
    this.service.enregistrerParametresInternes(id, { membresCommission: this.membres(), quorum: this.quorum(), dateCeremonie: this.dateCeremonie() }).subscribe({
      next: (d) => {
        this.saving.set(false);
        this.poser(d);
        this.toast.success(`Paramètres internes enregistrés — ${this.libelleEtat(d.etat)}.`);
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.saving.set(false);
        const parChamp = erreursParChamp(e);
        if (e.status === 400 && parChamp.size) {
          this.erreurs.set(parChamp);
          return;
        }
        this.toast.error(this.motif(e));
      },
    });
  }

  /** Notre mot pour un code connu, le message du serveur sinon. */
  private motif(e: ApiError | HttpErrorResponse): string {
    switch (codeErreur(e)) {
      case 'MEMBRE_COMMISSION':
        return 'Le responsable de la procédure ne peut pas détenir une part de clé : retirez-le de la commission.';
      case 'FICHE_VALIDEE':
        return 'La fiche est validée en remise électronique : ses paramètres internes ne se modifient plus.';
      default:
        return e.status === 403 ? 'Seul le responsable de la procédure modifie ces paramètres.' : e.message || 'Enregistrement impossible.';
    }
  }
}
