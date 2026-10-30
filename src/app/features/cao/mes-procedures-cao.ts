import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MaProcedureCao } from '../../models';
import { CaoEspaceService, KpiService } from '../../services';
import { BandeauEspace, PuceBandeau } from '../../shared/ui/bandeau-espace';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { Icone } from '../../shared/ui/icone';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { LIBELLES_ETAT_CEREMONIE, LIBELLES_ETAT_PART, classeCeremonie, classePart, prochainPasCao } from './libelles-cao';

/**
 * « Mes procédures » (`GET /api/cao/mes-procedures`, lot 2a §B2) : les appels d'offres où le membre connecté siège, avec
 * l'état de la cérémonie et celui de sa part — ce qui lui dit, d'un coup d'œil, s'il a une clé à publier ou à vérifier.
 */
@Component({
  selector: 'app-mes-procedures-cao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, BandeauEspace, Icone],
  template: `
    <app-bandeau-espace surtitre="Commission d'appel d'offres" titre="Mes procédures" [puces]="puces()" />
    <p class="page-role mp__role">
      Les appels d'offres où vous siégez. Pour chacun, vous détenez une part de la clé qui ouvrira les offres : publiez
      votre clé avant la cérémonie, vérifiez votre part avant la date limite, puis apportez-la à la séance d'ouverture.
    </p>

    <!-- ⚠️ 07/10 — les compteurs de l'évaluation des offres (V78, GET /api/kpis/badges, ouvert au membre de la CAO). -->
    @if (evaluationsEnCours() || rapportsASigner()) {
      <div class="alert alert-info mp__compteurs" role="status">
        <span>
          @if (evaluationsEnCours()) { <strong>{{ evaluationsEnCours() }}</strong> évaluation(s) des offres en cours. }
          @if (rapportsASigner()) { <strong>{{ rapportsASigner() }}</strong> rapport(s) d'évaluation à signer. }
          Ouvrez la procédure, puis « Ouvrir l'évaluation ».
        </span>
      </div>
    }

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Vos procédures n'ont pas pu être chargées." (reessayer)="charger()" />
    } @else if (!procedures().length) {
      <div class="empty-state">
        <p class="empty-state-title">Vous ne siégez dans aucune commission pour l'instant.</p>
        <p class="empty-state-text">Une désignation par la PRMP vous arrive par courriel.</p>
      </div>
    } @else {
      <ul class="mp" aria-label="Mes procédures">
        @for (l of lignes(); track l.p.idDmc) {
          <li>
            <a class="mp__carte" [class]="'mp__carte mp__carte--' + l.pas.ton" [routerLink]="['/cao', 'procedures', l.p.idDmc]">
              <div class="mp__haut">
                <span class="cnm-mono mp__ref">{{ l.p.reference || 'Procédure' }}</span>
                @if (l.p.president) { <span class="badge badge-primary">Président</span> }
              </div>
              <h2 class="mp__objet">{{ l.p.objet || 'Objet non renseigné' }}</h2>
              @if (l.p.autoriteContractante) { <p class="mp__meta">{{ l.p.autoriteContractante }}</p> }
              <p class="mp__etats">
                <span class="badge" [class]="'badge ' + classePart(l.p.etatPart)">{{ parts[l.p.etatPart] }}</span>
                @if (l.p.etatCeremonie; as c) { <span class="badge" [class]="'badge ' + classeCeremonie(c)">Cérémonie {{ ceremonies[c] }}</span> }
              </p>
              @if (l.p.dateLimite) { <p class="mp__limite"><app-icone nom="clock" [taille]="14" /> Date limite des offres : <strong>{{ dateHeure(l.p.dateLimite) }}</strong></p> }
              <span class="mp__pas"><span>{{ l.pas.texte }}</span><app-icone nom="chev" [taille]="16" /></span>
            </a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .mp__role { margin: 0; }
    .mp__compteurs { margin: 0; }
    .mp { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); gap: 0.9rem; }
    .mp__carte { display: flex; flex-direction: column; gap: 0.4rem; height: 100%; box-sizing: border-box; padding: 1rem 1.1rem 0; background: #fff;
      border: 1px solid var(--n-200); border-top: 4px solid var(--n-300); border-radius: var(--radius-lg); text-decoration: none; color: inherit; overflow: hidden;
      transition: box-shadow 0.15s, transform 0.15s; }
    .mp__carte:hover, .mp__carte:focus-visible { box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08); transform: translateY(-1px); }
    .mp__haut { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .mp__ref { font-size: var(--text-sm); color: var(--p-700); font-weight: 700; }
    .mp__objet { margin: 0; font-size: 1.02rem; line-height: 1.35; }
    .mp__meta { margin: 0; font-size: var(--text-sm); color: var(--n-500); }
    .mp__etats { margin: 0.2rem 0 0; display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .mp__limite { margin: 0.1rem 0 0; display: flex; gap: 0.35rem; align-items: center; font-size: var(--text-sm); color: var(--n-600); }
    .mp__pas { margin: auto -1.1rem 0; padding: 0.6rem 1.1rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;
      font-size: var(--text-sm); font-weight: 700; border-top: 1px solid var(--n-200); background: var(--n-100); color: var(--n-700); }
    .mp__carte--action { border-top-color: var(--warning-text); }
    .mp__carte--action .mp__pas { background: var(--warning-bg); color: var(--warning-text); border-top-color: var(--warning-bdr); }
    .mp__carte--alerte { border-top-color: var(--danger-text); }
    .mp__carte--alerte .mp__pas { background: var(--danger-bg); color: var(--danger-text); border-top-color: var(--danger-bdr); }
    .mp__carte--attente { border-top-color: var(--info-text); }
    .mp__carte--attente .mp__pas { background: var(--info-bg); color: var(--info-text); border-top-color: var(--info-bdr); }
    .mp__carte--suite { border-top-color: var(--p-600); }
    .mp__carte--suite .mp__pas { background: var(--bouton-principal); color: #fff; border-top-color: var(--bouton-principal); }
  `,
})
export class MesProceduresCao implements OnInit {
  private readonly service = inject(CaoEspaceService);
  private readonly document = inject(DOCUMENT);
  private readonly kpi = inject(KpiService);

  readonly parts = LIBELLES_ETAT_PART;
  readonly ceremonies = LIBELLES_ETAT_CEREMONIE;
  readonly classePart = classePart;
  readonly classeCeremonie = classeCeremonie;
  readonly dateHeure = dateHeureFr;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly procedures = signal<MaProcedureCao[]>([]);
  readonly evaluationsEnCours = signal(0);
  readonly rapportsASigner = signal(0);
  /** ⚠️ 19/10 — chaque procédure avec son prochain pas ; celles qui attendent un geste du membre d'abord. */
  readonly lignes = computed(() => {
    const rang = { alerte: 0, action: 1, suite: 2, attente: 3 } as const;
    return this.procedures()
      .map((p) => ({ p, pas: prochainPasCao(p) }))
      .sort((x, y) => rang[x.pas.ton] - rang[y.pas.ton]);
  });
  readonly puces = computed<PuceBandeau[]>(() => {
    const l = this.lignes();
    if (!l.length) return [];
    const aFaire = l.filter((x) => x.pas.ton === 'action' || x.pas.ton === 'alerte').length;
    const presidees = l.filter((x) => x.p.president).length;
    return [
      { texte: l.length > 1 ? 'procédures' : 'procédure', fort: l.length },
      ...(presidees ? [{ texte: 'présidée(s)', fort: presidees }] : []),
      ...(aFaire ? [{ texte: 'clé(s) à traiter', fort: aFaire, accent: true }] : []),
    ];
  });

  ngOnInit(): void {
    this.document.title = 'Mes procédures — Commission d’appel d’offres — PRS 2.0';
    this.charger();
    // Silencieux : sans compteur, rien ne s'affiche.
    this.kpi.badges().subscribe({
      next: ({ compteurs }) => {
        this.evaluationsEnCours.set(compteurs['evaluationsEnCours'] ?? 0);
        this.rapportsASigner.set(compteurs['rapportsASigner'] ?? 0);
      },
      error: () => undefined,
    });
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.mesProcedures().subscribe({
      next: (l) => {
        this.procedures.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }
}
