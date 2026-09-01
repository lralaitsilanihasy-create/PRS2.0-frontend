import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { skip } from 'rxjs';

import { PermissionsService } from '../../core/auth/permissions.service';
import { DelegationsAffichageStore } from '../../core/preferences/delegations-affichage.store';
import { Dossier, TypeDossier } from '../../models';
import { DemandeRetraitService, DossierService, TypeDossierService } from '../../services';
import { DossiersRefreshStore } from '../prmp/dossiers-refresh.store';
import { ClassementConfig, ClassementGroupe, dossiersDuClassement, separerGroupesParDelegation, statutsPartages } from './classement-config';
import { DispatchsControleurs } from './dispatchs-controleurs';
import { DossiersCircuitListe } from './dossiers-circuit-liste';
import { RetraitsValidation } from './retraits-validation';

// Ré-export : les routes (president/cc/secretaire/membre) importent la config depuis ce fichier.
export * from './classement-config';

/**
 * Accueil « Mes dossiers » générique (config-driven) : arborescence type → groupe sous forme de cartes,
 * avec compteurs et un bandeau KPI (Total + un par groupe). Utilisé par les profils **Président** et **CC**
 * avec les groupes circuit (pré-dispatch / dispatch) ; le périmètre (toutes localités vs sa localité) est
 * appliqué par le backend. Chaque ligne pointe vers `{base}/:type/:groupe` (liste en lecture seule).
 *
 * Compteurs dérivés d'un seul `GET /api/dossiers` (scopé profil) filtré par statut — pas de N+1.
 */
@Component({
  selector: 'app-dossiers-classement',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DispatchsControleurs, DossiersCircuitListe, RetraitsValidation],
  template: `
    <section class="md">
      <header class="page-header">
        <div>
          <div class="page-subtitle">{{ cfg.subtitle }}</div>
          <h1 class="page-title">Mes dossiers</h1>
        </div>
      </header>
      <p class="md__intro">Retrouvez les dossiers par <strong>type</strong> et par <strong>étape du circuit</strong>.</p>

      @if (loading()) {
        <div class="md__kpis">
          @for (i of [1, 2, 3]; track i) { <div class="cnm-stat"><span class="skeleton md__sk-kpi"></span></div> }
        </div>
        <div class="md__grid">
          @for (i of [1, 2, 3]; track i) {
            <article class="md__card md__card--sk"><div class="md__inner">
              <div class="md__head">
                <span class="skeleton md__sk-chip"></span>
                <div class="md__titles"><span class="skeleton md__sk-line" style="width: 70%"></span><span class="skeleton md__sk-line" style="width: 40%"></span></div>
              </div>
              <span class="skeleton md__sk-row"></span><span class="skeleton md__sk-row"></span>
            </div></article>
          }
        </div>
      } @else {
        <div class="md__kpis">
          <div class="cnm-stat cnm-stat--blue">
            <div class="cnm-stat__icon" aria-hidden="true">📊</div>
            <div class="cnm-stat__body">
              <div class="cnm-stat__value">{{ totalDossiers() }}</div>
              <div class="cnm-stat__label">Total dossiers</div>
              <!-- ⚠️ Demande user (2026-08-28) — la somme des tuiles ne tombe pas sur le total :
                   « Pré-dispatch » et « Enregistrés » couvrent le même statut. La phrase est du
                   VRAI TEXTE, pas une infobulle : une explication qu'il faut survoler pour lire
                   n'existe pas au clavier ni au lecteur d'écran. -->
              @if (explicationTotal(); as note) {
                <p class="md__note-total">{{ note }}</p>
              }
            </div>
          </div>
          @for (g of groupesVisibles(); track g.key) {
            <div class="cnm-stat" [class.cnm-stat--amber]="g.kind === 'a'" [class.cnm-stat--green]="g.kind === 'b'">
              <div class="cnm-stat__icon" aria-hidden="true">{{ g.icon }}</div>
              <div class="cnm-stat__body">
                <div class="cnm-stat__value">{{ totalGroupe(g.key) }}</div>
                <div class="cnm-stat__label">{{ g.label }}</div>
                @if (delegationDe(g); as prof) {
                  <span class="md__deleg md__deleg--tuile" [title]="'Tâche du profil ' + prof + ' — exercée par délégation active.'">⤴ Délégation · {{ prof }}</span>
                }
              </div>
            </div>
          }
        </div>

        <div class="md__grid">
          @for (t of types(); track t.idTypeDossier) {
            <article class="md__card"><div class="md__inner">
              <div class="md__head">
                <span class="md__chip">{{ chip(t) }}</span>
                <div class="md__titles">
                  <h2 class="md__title">{{ t.libelleType || t.idTypeDossier }}</h2>
                  <span class="md__code">{{ t.idTypeDossier }}</span>
                </div>
                <!-- Même compte que la tuile « Total dossiers », à l'échelle du type : des dossiers
                     DISTINCTS. Le nom accessible le dit, car le seul chiffre ne le dit pas. -->
                <span
                  class="md__total"
                  [attr.aria-label]="total(t.idTypeDossier) + ' dossiers distincts pour ce type'"
                  [title]="explicationTotal() ?? ''"
                >{{ total(t.idTypeDossier) }}</span>
              </div>

              <div class="md__bar" [class.md__bar--empty]="total(t.idTypeDossier) === 0" role="img" [attr.aria-label]="repartitionLabel(t.idTypeDossier)">
                @for (g of groupesVisibles(); track g.key) {
                  <span class="md__bar-seg" [class.md__bar-seg--a]="g.kind === 'a'" [class.md__bar-seg--b]="g.kind === 'b'" [style.width.%]="pct(t.idTypeDossier, g.key)"></span>
                }
              </div>

              <!-- ⚠️ Demande user (2026-08-28) — deux sections : les tâches du profil connecté, puis
                   celles exercées par délégation sous leur propre intitulé. Elles étaient
                   intercalées (« Réceptions » et « Enregistrés » avant « Pré-dispatch »). -->
              <div class="md__rows">
                @for (sec of sectionsGroupes(); track sec.cle) {
                  @if (sec.titre) {
                    <!-- ⚠️ Demande user (2026-08-28) — la rubrique se replie, d'un geste partagé
                         avec la barre latérale. Repli d'AFFICHAGE : aucun droit n'est retiré.
                         L'intitulé reste visible, sinon rien ne permettrait de la rouvrir. -->
                    <button
                      type="button"
                      class="md__rows-sep"
                      [attr.aria-expanded]="delegationsAffichees()"
                      [title]="(delegationsAffichees() ? 'Replier' : 'Déplier') + ' les tâches exercées par délégation (sans effet sur vos droits).'"
                      (click)="basculerDelegations()"
                    >
                      <span class="md__rows-sep-texte">{{ sec.titre }}</span>
                      <span class="md__rows-sep-marque" aria-hidden="true">⤴</span>
                      <span class="md__rows-sep-chevron" [class.md__rows-sep-chevron--ouvert]="delegationsAffichees()" aria-hidden="true">›</span>
                    </button>
                  }
                  @for (g of (sec.titre && !delegationsAffichees() ? [] : sec.items); track g.key) {
                    <button type="button" class="md__row" [class.md__row--actif]="estSelection(t.idTypeDossier, g.key)" (click)="choisir(t.idTypeDossier, g.key)">
                      <span class="md__row-ic" [class.md__row-ic--a]="g.kind === 'a'" [class.md__row-ic--b]="g.kind === 'b'" aria-hidden="true">{{ g.icon }}</span>
                      <span class="md__row-label">{{ g.label }}
                        @if (delegationDe(g); as prof) {
                          <span class="md__deleg" [title]="'Tâche du profil ' + prof + ' — exercée par délégation active.'">⤴ {{ prof }}</span>
                        }
                      </span>
                      <span class="md__row-count">{{ compte(t.idTypeDossier, g.key) }}</span>
                      <span class="md__row-arrow" aria-hidden="true">›</span>
                    </button>
                  }
                  <!-- ⚠️ 2026-08-07 (demande user) — les demandes de retrait rejoignent la carte du type
                       concerné, à la place de leur entrée de menu, et se déplient SOUS les cartes comme
                       les autres lignes (même geste que Pré-dispatch / Dispatch). La ligne reste affichée
                       à zéro : c'est le seul chemin vers l'écran, il ne doit pas disparaître — d'où son
                       rattachement à la section « propre », qui existe toujours, fût-elle vide. -->
                  @if (sec.cle === 'propre' && cfg.retraitsPath) {
                    <button
                      type="button"
                      class="md__row md__row--lien"
                      [class.md__row--actif]="estSelectionRetrait(t.idTypeDossier)"
                      (click)="choisirRetraits(t.idTypeDossier)"
                    >
                      <span class="md__row-ic md__row-ic--r" aria-hidden="true">↩</span>
                      <span class="md__row-label">Demandes de retrait</span>
                      <span class="md__row-count" [class.md__row-count--alerte]="retraitsDe(t.idTypeDossier) > 0">
                        {{ retraitsDe(t.idTypeDossier) }}
                      </span>
                      <span class="md__row-arrow" aria-hidden="true">›</span>
                    </button>
                  }
                }
              </div>
            </div></article>
          } @empty {
            <div class="empty-state">
              <span class="empty-state-icon" aria-hidden="true">📭</span>
              <div class="empty-state-title">Aucun type de dossier</div>
              <div class="empty-state-text">Aucun type de dossier n'est disponible pour le moment.</div>
            </div>
          }
        </div>
      }

      @if (selection(); as sel) {
        <app-dossiers-circuit-liste [embed]="sel" />
      }

      <!-- Demandes de retrait du type choisi : même emplacement, même geste que les groupes du circuit. -->
      @if (selectionRetrait(); as type) {
        <app-retraits-validation [type]="type" [embedded]="true" />
      }

      @if (cfg.statDispatchsControleurs) {
        <app-dispatchs-controleurs />
      }
    </section>
  `,
  styles: `
    .md { display: flex; flex-direction: column; gap: 1.15rem; }
    .md__intro { margin: -0.4rem 0 0; color: var(--n-500); }
    .md__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.9rem; }
    .md__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(18.5rem, 22rem)); gap: 1.1rem; justify-content: center; }
    .md__card { position: relative; background: #fff; border: 1px solid var(--n-200); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); overflow: hidden; transition: var(--transition); }
    .md__card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--grad-primary); }
    .md__card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: var(--p-200); }
    .md__inner { padding: 1.15rem 1.1rem 0.85rem; display: flex; flex-direction: column; gap: 0.7rem; }
    .md__head { display: flex; align-items: center; gap: 0.75rem; }
    .md__chip { flex-shrink: 0; width: 2.6rem; height: 2.6rem; display: inline-flex; align-items: center; justify-content: center; background: var(--grad-primary); color: #fff; font-weight: 800; font-size: 0.8rem; letter-spacing: 0.02em; border-radius: var(--radius-md); box-shadow: 0 3px 10px rgba(102, 126, 234, 0.35); }
    .md__titles { min-width: 0; flex: 1; display: flex; flex-direction: column; }
    .md__title { margin: 0; font-size: var(--text-md); font-weight: 700; color: var(--n-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .md__code { font-size: var(--text-xs); color: var(--n-400); letter-spacing: 0.04em; text-transform: uppercase; }
    .md__total { flex-shrink: 0; min-width: 1.7rem; padding: 0.12rem 0.55rem; background: var(--p-50); color: var(--p-600); border: 1px solid var(--p-200); border-radius: var(--radius-full); font-weight: 800; font-size: var(--text-sm); text-align: center; font-variant-numeric: tabular-nums; }
    .md__bar { display: flex; height: 6px; border-radius: var(--radius-full); background: var(--n-100); overflow: hidden; }
    .md__bar-seg { height: 100%; transition: width 300ms var(--ease-out); }
    .md__bar-seg--a { background: var(--warning-text); }
    .md__bar-seg--b { background: var(--p-500); }
    .md__rows { display: flex; flex-direction: column; gap: 2px; }
    .md__row { display: flex; align-items: center; gap: 0.65rem; width: 100%; padding: 0.55rem 0.55rem; border: 0; background: transparent; font: inherit; text-align: left; cursor: pointer; border-radius: var(--radius-md); color: var(--n-700); text-decoration: none; transition: var(--transition); }
    .md__row:hover { background: var(--p-50); color: var(--n-800); }
    .md__row--actif { background: var(--p-50); color: var(--p-600); }
    .md__row-ic { flex-shrink: 0; width: 1.7rem; height: 1.7rem; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); font-size: 0.95rem; line-height: 1; }
    .md__row-ic--a { background: var(--warning-bg); color: var(--warning-text); }
    .md__row-ic--b { background: var(--p-100); color: var(--p-600); }
    /* Demandes de retrait : ligne à part (elle quitte l'écran au lieu de déplier une liste), séparée
       des étapes du circuit par un filet, et comptée en rouge dès qu'il y a quelque chose à décider. */
    .md__row--lien { margin-top: 0.25rem; padding-top: 0.6rem; border-top: 1px solid var(--n-100); border-radius: 0 0 var(--radius-md) var(--radius-md); }
    .md__row-ic--r { background: var(--danger-bg); color: var(--danger-text); }
    .md__row-count--alerte { background: var(--danger-bg); color: var(--danger-text); }
    .md__row:hover .md__row-count--alerte { background: var(--danger-text); color: #fff; }
    .md__row-label { font-weight: 600; }
    /* Badge « tâche exercée par délégation » (spec 2026-08-14) — discret, absent chez le titulaire. */
    .md__deleg { display: inline-block; margin-left: 0.4rem; padding: 0.05rem 0.45rem; border-radius: var(--radius-full); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.03em; background: var(--c-50); color: var(--c-800); border: 1px solid var(--c-100); vertical-align: middle; }
    .md__deleg--tuile { margin-left: 0; margin-top: 0.15rem; align-self: flex-start; }
    /* Note explicative du total (demande user 2026-08-28) : dit pourquoi la somme des tuiles ne
       tombe pas sur le total. Petite, mais du texte réel — et sur fond coloré de la tuile bleue,
       donc en blanc légèrement voilé plutôt qu'en gris (le contraste doit tenir). */
    .md__note-total { margin: 0.25rem 0 0; max-width: 22rem; font-size: 0.66rem; line-height: 1.35; font-weight: 500; color: rgba(255, 255, 255, 0.92); }
    /* Intitulé de section des lignes (demande user 2026-08-28) : sépare les tâches du profil de
       celles exercées par délégation. Étiquette de rubrique, jamais cliquable — un filet et une
       capitale espacée, rien qui puisse se confondre avec une ligne de la carte. */
    .md__rows-sep { display: flex; align-items: center; gap: 0.35rem; width: 100%; margin: 0.55rem 0 0.15rem; padding: 0.55rem 0 0.1rem; border: 0; border-top: 1px solid var(--n-100); background: transparent; font: inherit; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; text-align: left; color: var(--n-500); cursor: pointer; transition: var(--transition); }
    .md__rows-sep:hover { color: var(--n-700); }
    .md__rows-sep-marque { font-size: 0.72rem; }
    /* Chevron : pointe à droite replié, vers le bas déplié. */
    .md__rows-sep-chevron { margin-left: auto; font-size: 0.9rem; line-height: 1; transition: transform 0.15s ease; }
    .md__rows-sep-chevron--ouvert { transform: rotate(90deg); }
    .md__row-count { margin-left: auto; min-width: 1.5rem; padding: 0 0.45rem; background: var(--n-100); color: var(--n-600); border-radius: var(--radius-full); font-weight: 700; font-size: var(--text-sm); text-align: center; font-variant-numeric: tabular-nums; }
    .md__row:hover .md__row-count { background: var(--p-100); color: var(--p-600); }
    .md__row-arrow { color: var(--n-400); font-size: 1.1rem; line-height: 1; transition: transform 130ms var(--ease-out), color 130ms var(--ease-out); }
    .md__row:hover .md__row-arrow { color: var(--p-500); transform: translateX(3px); }
    .md__card--sk::before { background: var(--n-200); }
    .md__sk-kpi { display: block; width: 60%; height: 1.9rem; }
    .md__sk-chip { display: block; width: 2.6rem; height: 2.6rem; border-radius: var(--radius-md); flex-shrink: 0; }
    .md__sk-line { display: block; height: 0.75rem; }
    .md__sk-line + .md__sk-line { margin-top: 0.4rem; }
    .md__sk-row { display: block; height: 2.5rem; border-radius: var(--radius-md); }
    @media (max-width: 520px) { .md__kpis { grid-template-columns: 1fr 1fr; } }
  `,
})
export class DossiersClassement {
  private readonly route = inject(ActivatedRoute);
  private readonly typeDossierService = inject(TypeDossierService);
  private readonly dossierService = inject(DossierService);
  private readonly demandeRetraitService = inject(DemandeRetraitService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly permissions = inject(PermissionsService);

  /** Config du classement (statique, fournie par la route). */
  readonly cfg = this.route.snapshot.data['classement'] as ClassementConfig;

  /**
   * ⚠️ Délégation ascendante (spec 2026-08-14) — un groupe porteur d'actions n'est AFFICHÉ que si au
   * moins une de ses actions est permise au profil courant (titulaire OU paire active en base) : le
   * groupe « Réceptions » (tâche du Secrétaire) apparaît chez Président/CC seulement si la paire est
   * active — la désactiver en base le retire, zéro code. Un groupe sans action reste toujours visible.
   */
  private groupePermis(g: ClassementGroupe): boolean {
    const exigences: boolean[] = [];
    if (g.actionReception) exigences.push(this.permissions.can('RECEPTION_WRITE'));
    if (g.actionDispatch || g.actionAnnulerDispatch) exigences.push(this.permissions.can('DISPATCH_WRITE'));
    if (g.actionExamen || g.actionModifierExamen) exigences.push(this.permissions.can('EXAMEN_WRITE'));
    // Groupe sans action rattaché à un profil délégable (ex. Enregistrés) : identité ou délégation exercée.
    if (g.delegation) exigences.push(this.permissions.peutExecuter(g.delegation));
    return exigences.length === 0 || exigences.some(Boolean);
  }
  /**
   * Groupes affichables, RANGÉS : d'abord ceux du profil connecté, puis ceux exercés par délégation.
   *
   * ⚠️ Demande user (2026-08-28) — même exigence que pour la barre latérale : ne pas mélanger. Dans
   * les cartes, « Réceptions » et « Enregistrés » (tâches du Secrétaire) s'intercalaient AVANT
   * « Pré-dispatch » et « Dispatch », qui sont les tâches propres du Président et du CC.
   *
   * La clé de partage est `delegationDe(g)`, pas le champ `delegation` : « Réceptions » ne porte pas
   * ce champ mais est bien exercé par délégation chez P/CC (via son `actionReception` et la capacité
   * RECEPTION_WRITE). Trier sur le champ seul laisserait « Réceptions » du mauvais côté.
   */
  readonly groupesVisibles = computed(() => {
    const permis = this.cfg.groupes.filter((g) => this.groupePermis(g));
    return [...permis.filter((g) => !this.delegationDe(g)), ...permis.filter((g) => !!this.delegationDe(g))];
  });

  /**
   * Les mêmes groupes, scindés en sections pour les lignes des cartes. Le partage vit dans
   * `separerGroupesParDelegation` (module `classement-config`), où il est testé — notamment le fait
   * que la section « propre » subsiste vide, pour ne pas emporter la ligne « Demandes de retrait ».
   */
  readonly sectionsGroupes = computed(() =>
    separerGroupesParDelegation(this.groupesVisibles(), (g) => !!this.delegationDe(g)),
  );

  /**
   * Repli des rubriques déléguées (demande user 2026-08-28), partagé avec la barre latérale : un
   * seul geste range les tâches déléguées partout. Repli d'AFFICHAGE — aucun droit n'est retiré,
   * contrairement aux interrupteurs du 15/08 (cf. `DelegationsAffichageStore`).
   *
   * Les tuiles du bandeau KPI, elles, restent complètes : replier range les lignes d'action, pas
   * les compteurs — un Président qui a rangé les réceptions doit continuer de voir qu'il en reste.
   */
  private readonly delegationsAffichage = inject(DelegationsAffichageStore);
  readonly delegationsAffichees = this.delegationsAffichage.affichees;
  basculerDelegations(): void {
    this.delegationsAffichage.basculer();
  }

  /**
   * Profil TITULAIRE de la tâche du groupe quand elle n'est exercée que PAR DÉLÉGATION (badge
   * « ⤴ Délégation · X ») : `null` chez le titulaire lui-même (le Secrétaire ne voit rien sur son
   * écran) et pour les groupes portant une action native du profil courant (ex. Dispatch chez P/CC).
   */
  delegationDe(g: ClassementGroupe): string | null {
    // Groupe sans action rattaché à un profil (`delegation`) : badge chez le non-titulaire seulement.
    if (g.delegation === 'SECRETAIRE' && this.permissions.parDelegation('RECEPTION_WRITE')) return 'Secrétaire';
    if (g.actionReception && this.permissions.parDelegation('RECEPTION_WRITE')) return 'Secrétaire';
    if (
      g.actionExamen &&
      !g.actionDispatch &&
      !g.actionAnnulerDispatch &&
      !g.actionReception &&
      this.permissions.parDelegation('EXAMEN_WRITE')
    ) {
      return 'Membre';
    }
    return null;
  }

  private static readonly ORDRE_FAMILLE: Record<string, number> = { DDP: 0, DMC: 1, DDM: 2 };

  readonly types = signal<TypeDossier[]>([]);
  readonly loading = signal(true);
  /** Groupe déplié sous le classement (liste inline, même motif que « Voir les dossiers ») ; null = replié. */
  readonly selection = signal<{ type: string; groupe: string } | null>(null);
  /** Type dont les demandes de retrait sont dépliées sous le classement ; null = replié. */
  readonly selectionRetrait = signal<string | null>(null);
  /** idTypeDossier → { groupeKey → compte }. ⚠️ Un dossier peut compter dans PLUSIEURS groupes
   * (statut partagé, ex. PRET_DISPATCH ∈ Enregistrés ET Pré-dispatch) — les totaux utilisent
   * `distincts`, jamais la somme des groupes. */
  private readonly compteurs = signal<Map<string, Record<string, number>>>(new Map());
  /** idTypeDossier → nombre de dossiers DISTINCTS couverts par au moins un groupe. */
  private readonly distincts = signal<Map<string, number>>(new Map());
  /** idTypeDossier → nombre de demandes de retrait en attente (config `retraitsPath` seulement). */
  private readonly retraitsParType = signal<Record<string, number>>({});

  readonly totalDossiers = computed(() => {
    let n = 0;
    for (const v of this.distincts().values()) n += v;
    return n;
  });

  /**
   * Explication du décalage entre la somme des tuiles et le total — `null` quand il n'y en a pas.
   *
   * ⚠️ Demande user (2026-08-28) : « lever l'ambiguïté ». Un Président lisait 3 Pré-dispatch,
   * 0 Dispatch, 1 Réception et 3 Enregistrés, soit 7, en face d'un total affiché à 4. Les deux
   * chiffres sont justes mais ne comptent pas la même chose : les tuiles comptent par groupe, le
   * total compte des dossiers DISTINCTS — et « Pré-dispatch » et « Enregistrés » couvrent le
   * même statut. Sans un mot d'explication, l'écran donne l'impression de se tromper.
   *
   * La phrase n'apparaît QUE si l'écart existe réellement à l'écran : un recouvrement structurel
   * sans dossier dans le statut concerné ne mérite pas qu'on encombre le bandeau.
   */
  readonly explicationTotal = computed<string | null>(() => {
    const somme = this.groupesVisibles().reduce((s, g) => s + this.totalGroupe(g.key), 0);
    if (somme <= this.totalDossiers()) return null;
    const visibles = new Set(this.groupesVisibles().map((g) => g.label));
    const partages = statutsPartages(this.groupesVisibles()).filter((p) =>
      p.labels.every((l) => visibles.has(l)),
    );
    if (!partages.length) return null;
    const paires = partages.map((p) => p.labels.join(' » et « ')).join(' ; ');
    return `Dossiers distincts : un même dossier figure à la fois dans « ${paires} » — deux vues de la même donnée. Le total ne le compte qu'une fois.`;
  });

  constructor() {
    this.typeDossierService.list().subscribe({
      next: (rows) => {
        const rang = (id: string) => DossiersClassement.ORDRE_FAMILLE[id] ?? 99;
        this.types.set([...rows].sort((a, b) => rang(a.idTypeDossier) - rang(b.idTypeDossier)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.chargerCompteurs();
    // Mutation signalée par le drill-down embarqué (dispatch/réception) → compteurs à jour sans navigation.
    toObservable(this.dossiersRefresh.revision)
      .pipe(skip(1), takeUntilDestroyed())
      .subscribe(() => this.chargerCompteurs());
  }

  /** Un seul chargement scopé profil : on ne retient que les statuts couverts par les groupes. */
  private chargerCompteurs(): void {
    dossiersDuClassement(this.cfg, this.dossierService).subscribe({
      next: (rows) => {
        this.grouper(rows);
        if (this.cfg.retraitsPath) {
          this.chargerRetraits(rows);
        }
      },
      error: () => {},
    });
  }

  /**
   * Demandes de retrait en attente, ventilées par type de dossier. La demande ne porte que
   * `idDossier` : le type vient de la liste de dossiers DÉJÀ chargée ci-dessus — un appel de plus,
   * pas un par demande.
   */
  private chargerRetraits(dossiers: Dossier[]): void {
    const typeParDossier = new Map<number, string>();
    for (const d of dossiers) {
      if (d.idDossier != null && d.idTypeDossier) {
        typeParDossier.set(d.idDossier, d.idTypeDossier);
      }
    }
    this.demandeRetraitService.aValider().subscribe({
      next: (demandes) => {
        const parType: Record<string, number> = {};
        for (const r of demandes) {
          const type = typeParDossier.get(r.idDossier);
          if (type) {
            parType[type] = (parType[type] ?? 0) + 1;
          }
        }
        this.retraitsParType.set(parType);
      },
      error: () => {},
    });
  }

  /** Demandes de retrait en attente sur les dossiers de ce type. */
  retraitsDe(idType: string): number {
    return this.retraitsParType()[idType] ?? 0;
  }

  /** Ventile chaque dossier dans TOUS les groupes couvrant son statut, et compte les distincts. */
  private grouper(rows: Dossier[]): void {
    const m = new Map<string, Record<string, number>>();
    const dist = new Map<string, number>();
    for (const d of rows) {
      if (!d.idTypeDossier || !d.statut) continue;
      const groupes = this.cfg.groupes.filter((g) => g.statuts.includes(d.statut!));
      if (!groupes.length) continue;
      const rec = m.get(d.idTypeDossier) ?? {};
      for (const g of groupes) rec[g.key] = (rec[g.key] ?? 0) + 1;
      m.set(d.idTypeDossier, rec);
      dist.set(d.idTypeDossier, (dist.get(d.idTypeDossier) ?? 0) + 1);
    }
    this.compteurs.set(m);
    this.distincts.set(dist);
  }

  /** Déplie la liste du groupe sous le classement (re-clic = replie). */
  choisir(type: string, groupe: string): void {
    const cur = this.selection();
    this.selection.set(cur && cur.type === type && cur.groupe === groupe ? null : { type, groupe });
    // Un seul panneau à la fois sous les cartes : ouvrir un groupe referme les demandes de retrait.
    this.selectionRetrait.set(null);
  }

  /** Déplie les demandes de retrait du type sous le classement (re-clic = replie). */
  choisirRetraits(type: string): void {
    const cur = this.selectionRetrait();
    this.selectionRetrait.set(cur === type ? null : type);
    this.selection.set(null);
  }
  estSelectionRetrait(type: string): boolean {
    return this.selectionRetrait() === type;
  }
  estSelection(type: string, groupe: string): boolean {
    const cur = this.selection();
    return !!cur && cur.type === type && cur.groupe === groupe;
  }
  chip(t: TypeDossier): string {
    return (t.idTypeDossier || '?').slice(0, 3).toUpperCase();
  }
  compte(type: string, groupe: string): number {
    return this.compteurs().get(type)?.[groupe] ?? 0;
  }
  /** Dossiers DISTINCTS du type (un statut partagé par 2 groupes ne compte qu'une fois). */
  total(type: string): number {
    return this.distincts().get(type) ?? 0;
  }
  totalGroupe(groupe: string): number {
    let n = 0;
    for (const rec of this.compteurs().values()) n += rec[groupe] ?? 0;
    return n;
  }
  /** Part du groupe dans la barre : dénominateur = somme des groupes VISIBLES (segments ≤ 100 %). */
  pct(type: string, groupe: string): number {
    const t = this.groupesVisibles().reduce((somme, g) => somme + this.compte(type, g.key), 0);
    return t === 0 ? 0 : (this.compte(type, groupe) / t) * 100;
  }
  repartitionLabel(type: string): string {
    return this.groupesVisibles()
      .map((g) => `${this.compte(type, g.key)} ${g.label}`)
      .join(', ');
  }
}
