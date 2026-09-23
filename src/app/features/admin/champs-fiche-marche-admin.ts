import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiError, erreursParChamp } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { BlocFiche, ChampFiche, DocumentDao, ReferentielFiche, RubriqueFiche, SourceChamp, TypeChamp, TypeMarche } from '../../models';
import { ChampFicheMarcheService } from '../../services/fiche-marche.services';

const TYPES: TypeChamp[] = ['TEXTE', 'TEXTE_LONG', 'NOMBRE', 'MONTANT', 'POURCENTAGE', 'DATE', 'LISTE', 'OUI_NON', 'PIECE'];
const SOURCES: SourceChamp[] = ['SAISIE', 'PPM', 'CADRAGE'];
const DOCUMENTS: DocumentDao[] = ['DPAO', 'DPAC', 'AE', 'CCAP', 'AUCUN'];
const TYPES_MARCHE: TypeMarche[] = ['QUANTITE_FIXE', 'A_COMMANDE', 'CONTRAT_CADRE'];

/** Un champ vide, prêt pour la création. */
function vide(): ChampFiche {
  return { code: '', bloc: '', rubrique: '', rang: 0, libelle: '', type: 'TEXTE', source: 'SAISIE', documentMaitre: 'DPAO', reprises: [], typesMarche: ['QUANTITE_FIXE'], condition: null, obligatoire: false, texteType: null, controle: null, options: null, cleCadrage: null, clePpm: null, actif: true };
}

/**
 * **Champs de la fiche DAO** (ADMINISTRATEUR) — le référentiel `champs-fiche-marche` d'où l'écran de la fiche
 * d'un appel d'offres est dessiné (demande du 22/09, B1 : « écriture Admin, POST/PUT d'un champ »). Blocs et
 * rubriques sont figés par migration ; ici on complète les **informations** de chaque rubrique, une à une, en
 * attendant ou en complément du fichier de correspondance (import CSV au démarrage du serveur). Pas de suppression :
 * un champ écarté passe `actif = faux` et reste dans l'historique.
 */
@Component({
  selector: 'app-champs-fiche-marche-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cfm">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Nomenclatures · fiche DAO d'un appel d'offres</div>
          <h1 class="page-title">Champs de la fiche DAO</h1>
        </div>
        <div class="cfm__actions">
          <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
          <button type="button" class="btn btn-primary btn-sm" (click)="nouveau()" [disabled]="loading()">+ Ajouter un champ</button>
        </div>
      </header>
      <p class="page-role">
        L'écran de la fiche DAO est dessiné depuis ce référentiel : ajouter une information ou changer sa condition
        d'affichage ne recompile rien. Chaque rubrique annonce le nombre d'informations attendues par le fichier de
        correspondance ; le fichier complet se charge en une fois par l'import CSV du serveur.
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        <div class="cfm__resume">
          <span><strong>{{ nbChamps() }}</strong> champ(s) — {{ nbActifs() }} actif(s), {{ nbParSource()['SAISIE'] ?? 0 }} à saisir, {{ nbParSource()['PPM'] ?? 0 }} du PPM, {{ nbParSource()['CADRAGE'] ?? 0 }} du cadrage</span>
          <span class="cfm__attendu">Attendus par l'esquisse : <strong>{{ nbAttendus() }}</strong></span>
        </div>

        @if (edition(); as c) {
          <form class="card cnm-form cfm__form" [attr.aria-label]="creation() ? 'Nouveau champ' : 'Modifier le champ ' + c.code" (submit)="$event.preventDefault(); enregistrer()" novalidate>
            <h2 class="cfm__form-titre">{{ creation() ? 'Nouveau champ' : 'Champ ' + c.code }}</h2>
            <div class="cnm-form-grid">
              <label class="form-group">
                <span class="form-label">Code *</span>
                <input class="form-control cnm-mono" type="text" [value]="c.code" [readonly]="!creation()" placeholder="B05-GS-02" (input)="poser('code', $any($event.target).value.toUpperCase())" />
                <span class="form-hint">Bloc, rubrique, rang : <code>B05-GS-02</code>. Le bloc et la rubrique en découlent.</span>
                @if (erreur('code'); as m) { <span class="form-error">{{ m }}</span> }
              </label>
              <label class="form-group cfm__large">
                <span class="form-label">Libellé *</span>
                <input class="form-control" type="text" [value]="c.libelle" (input)="poser('libelle', $any($event.target).value)" />
                @if (erreur('libelle'); as m) { <span class="form-error">{{ m }}</span> }
              </label>
              <label class="form-group">
                <span class="form-label">Type *</span>
                <select class="form-control" [value]="c.type" (change)="poser('type', $any($event.target).value)">
                  @for (t of types; track t) { <option [value]="t">{{ t }}</option> }
                </select>
                @if (erreur('type'); as m) { <span class="form-error">{{ m }}</span> }
              </label>
              <label class="form-group">
                <span class="form-label">Source *</span>
                <select class="form-control" [value]="c.source" (change)="poser('source', $any($event.target).value)">
                  @for (s of sources; track s) { <option [value]="s">{{ libelleSource(s) }}</option> }
                </select>
                @if (erreur('source'); as m) { <span class="form-error">{{ m }}</span> }
              </label>
              <label class="form-group">
                <span class="form-label">Document maître</span>
                <select class="form-control" [value]="c.documentMaitre" (change)="poser('documentMaitre', $any($event.target).value)">
                  @for (d of documents; track d) { <option [value]="d">{{ d === 'AUCUN' ? 'Sans document' : d }}</option> }
                </select>
              </label>
              <fieldset class="form-group">
                <legend class="form-label">Repris dans</legend>
                <div class="cfm__cases">
                  @for (d of documents.slice(0, 4); track d) {
                    <label class="cfm__case"><input type="checkbox" [checked]="c.reprises.includes(d)" (change)="basculer('reprises', d)" /> {{ d }}</label>
                  }
                </div>
              </fieldset>
              <fieldset class="form-group">
                <legend class="form-label">Types de marché *</legend>
                <div class="cfm__cases">
                  @for (t of typesMarche; track t) {
                    <label class="cfm__case"><input type="checkbox" [checked]="c.typesMarche.includes(t)" (change)="basculer('typesMarche', t)" /> {{ libelleTypeMarche(t) }}</label>
                  }
                </div>
                @if (erreur('typesMarche'); as m) { <span class="form-error">{{ m }}</span> }
              </fieldset>
              <label class="form-group cfm__large">
                <span class="form-label">Condition d'affichage</span>
                <input class="form-control cnm-mono" type="text" [value]="c.condition ?? ''" placeholder="garantieSoumission = OUI et typePrix = UNITAIRES" (input)="poser('condition', $any($event.target).value || null)" />
                <span class="form-hint">Sur les réponses du cadrage : <code>cle = VALEUR</code>, <code>!=</code>, <code>et</code>, <code>ou</code> ; vide = toujours affiché.</span>
                @if (erreur('condition'); as m) { <span class="form-error">{{ m }}</span> }
              </label>
              @if (c.type === 'LISTE') {
                <label class="form-group cfm__large">
                  <span class="form-label">Options de la liste *</span>
                  <input class="form-control" type="text" [value]="(c.options ?? []).join(', ')" placeholder="Caution, Chèque de banque, Garantie bancaire" (input)="poserListe('options', $any($event.target).value)" />
                  @if (erreur('options'); as m) { <span class="form-error">{{ m }}</span> }
                </label>
              }
              @if (c.source === 'CADRAGE') {
                <label class="form-group">
                  <span class="form-label">Clé de cadrage *</span>
                  <input class="form-control cnm-mono" type="text" [value]="c.cleCadrage ?? ''" placeholder="garantieSoumission" (input)="poser('cleCadrage', $any($event.target).value || null)" />
                  @if (erreur('cleCadrage'); as m) { <span class="form-error">{{ m }}</span> }
                </label>
              }
              @if (c.source === 'PPM') {
                <label class="form-group">
                  <span class="form-label">Clé du PPM *</span>
                  <input class="form-control cnm-mono" type="text" [value]="c.clePpm ?? ''" placeholder="MONTANT" (input)="poser('clePpm', $any($event.target).value || null)" />
                  @if (erreur('clePpm'); as m) { <span class="form-error">{{ m }}</span> }
                </label>
              }
              <label class="form-group">
                <span class="form-label">Règle de contrôle</span>
                <input class="form-control cnm-mono" type="text" [value]="c.controle ?? ''" placeholder="VALIDITE_GARANTIE_SUP_OFFRE:GARANTIE" (input)="poser('controle', $any($event.target).value || null)" />
                <span class="form-hint"><code>REGLE</code> ou <code>REGLE:ROLE</code> quand la règle lit plusieurs champs.</span>
                @if (erreur('controle'); as m) { <span class="form-error">{{ m }}</span> }
              </label>
              <label class="form-group cfm__large">
                <span class="form-label">Texte type</span>
                <textarea class="form-control" rows="2" [value]="c.texteType ?? ''" placeholder="Phrase d'insertion dans le document, avec des {codes} de champs" (input)="poser('texteType', $any($event.target).value || null)"></textarea>
                @if (erreur('texteType'); as m) { <span class="form-error">{{ m }}</span> }
              </label>
              <div class="form-group cfm__cases">
                <label class="cfm__case"><input type="checkbox" [checked]="c.obligatoire" (change)="poser('obligatoire', $any($event.target).checked)" /> Obligatoire</label>
                <label class="cfm__case"><input type="checkbox" [checked]="c.actif !== false" (change)="poser('actif', $any($event.target).checked)" /> Actif</label>
              </div>
            </div>
            <div class="cfm__pied">
              <button type="submit" class="btn btn-primary" [disabled]="saving() || !c.code || !c.libelle">{{ saving() ? 'Enregistrement…' : creation() ? 'Créer le champ' : 'Enregistrer' }}</button>
              <button type="button" class="btn btn-outline" (click)="annuler()" [disabled]="saving()">Annuler</button>
            </div>
          </form>
        }

        <div class="table-responsive">
          <table class="cnm-table cfm__table">
            <thead>
              <tr><th scope="col">Code</th><th scope="col">Libellé</th><th scope="col">Type</th><th scope="col">Source</th><th scope="col">Document → repris dans</th><th scope="col">Marchés</th><th scope="col">Condition</th><th scope="col">État</th><th scope="col"><span class="cnm-sr-only">Action</span></th></tr>
            </thead>
            <tbody>
              @for (b of blocs(); track b.code) {
                <tr class="cfm__bloc"><th scope="rowgroup" colspan="9">{{ b.code }} — {{ b.libelle }}</th></tr>
                @for (r of rubriques(b); track r.code) {
                  <tr class="cfm__rub">
                    <td colspan="9">
                      <div class="cfm__rub-in">
                        <span class="cfm__rub-l">{{ r.libelle }}</span>
                        <span class="cnm-mono cfm__rub-c">{{ r.code }}</span>
                        <!-- Le compte de l'esquisse est indicatif (une ligne du fichier = une information) : plusieurs
                             lignes deviennent UN champ (liste, oui/non, question de cadrage). Seule une rubrique VIDE alerte. -->
                        <span class="badge" [class.badge-warning]="champsDe(b, r).length === 0" [attr.title]="(r.nbAttendu ?? 0) + ' information(s) annoncée(s) par l’esquisse'">{{ champsDe(b, r).length }} champ(s) · {{ r.nbAttendu ?? '?' }} attendu(s)</span>
                        @if (r.documentMaitre) { <span class="badge">{{ r.documentMaitre }}</span> }
                      </div>
                    </td>
                  </tr>
                  @for (c of champsDe(b, r); track c.code) {
                    <tr [class.cfm__inactif]="c.actif === false">
                      <td class="cnm-mono cfm__code">{{ c.code }}</td>
                      <td>{{ c.libelle }}</td>
                      <td>{{ c.type }}</td>
                      <td>{{ libelleSource(c.source) }}</td>
                      <td>{{ c.documentMaitre === 'AUCUN' ? '—' : c.documentMaitre }}{{ c.reprises.length ? ' → ' + c.reprises.join(', ') : '' }}</td>
                      <td>{{ typesCourts(c) }}</td>
                      <td class="cnm-mono cfm__cond">{{ c.condition || '—' }}</td>
                      <td class="cfm__etat">{{ c.actif === false ? 'inactif' : c.obligatoire ? 'obligatoire' : '—' }}</td>
                      <td><button type="button" class="btn btn-secondary btn-sm" (click)="modifier(c)">Modifier</button></td>
                    </tr>
                  }
                }
              } @empty {
                <tr><td colspan="9" class="cnm-muted">Le référentiel n'est pas servi par le serveur (lot 1 backend absent).</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .cfm { display: flex; flex-direction: column; gap: 1rem; }
    .cfm__actions { display: flex; gap: 0.5rem; }
    .cfm__resume { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; font-size: var(--text-sm, 0.85rem); color: var(--n-500); }
    .cfm__form { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .cfm__form-titre { margin: 0; font-size: 1rem; }
    .cfm__large { grid-column: span 2; }
    .cfm__cases { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
    .cfm__case { display: inline-flex; gap: 0.35rem; align-items: center; font-size: 0.86rem; }
    .cfm__pied { display: flex; gap: 0.6rem; }
    .cfm fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
    .cfm__table { font-size: 0.84rem; }
    .cfm__table td, .cfm__table th { padding: 0.4rem 0.5rem; vertical-align: middle; }
    .cfm__code { white-space: nowrap; font-size: 0.8rem; }
    .cfm__bloc th { text-align: left; background: var(--p-50); color: var(--p-800); font-weight: 700; padding: 0.5rem 0.6rem; }
    .cfm__rub td { background: var(--n-50); padding: 0.3rem 0.6rem; }
    .cfm__rub-in { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .cfm__rub-l { font-weight: 600; }
    .cfm__rub-c { color: var(--n-500); font-size: 0.78rem; }
    .cfm__cond { font-size: 0.76rem; max-width: 16rem; overflow-wrap: anywhere; }
    .cfm__etat { color: var(--n-500); white-space: nowrap; }
    .cfm__inactif td { color: var(--n-400); text-decoration: line-through; }
    .cfm__inactif td:last-child { text-decoration: none; }
  `,
})
export class ChampsFicheMarcheAdmin implements OnInit {
  private readonly service = inject(ChampFicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly types = TYPES;
  readonly sources = SOURCES;
  readonly documents = DOCUMENTS;
  readonly typesMarche = TYPES_MARCHE;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly referentiel = signal<ReferentielFiche>({ blocs: [], champs: [] });
  /** Champ en cours d'édition (copie), `null` = formulaire fermé. */
  readonly edition = signal<ChampFiche | null>(null);
  readonly creation = signal(false);
  readonly erreurs = signal<ReadonlyMap<string, string>>(new Map());

  readonly blocs = computed(() => [...this.referentiel().blocs].sort((a, b) => a.rang - b.rang));
  readonly nbChamps = computed(() => this.referentiel().champs.length);
  readonly nbActifs = computed(() => this.referentiel().champs.filter((c) => c.actif !== false).length);
  readonly nbParSource = computed(() => {
    const n: Record<string, number> = {};
    for (const c of this.referentiel().champs) n[c.source] = (n[c.source] ?? 0) + 1;
    return n;
  });
  readonly nbAttendus = computed(() => this.referentiel().blocs.flatMap((b) => b.rubriques).reduce((s, r) => s + (r.nbAttendu ?? 0), 0));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.service.referentiel().subscribe({
      next: (r) => {
        this.referentiel.set(r ?? { blocs: [], champs: [] });
        this.loading.set(false);
      },
      error: () => {
        this.referentiel.set({ blocs: [], champs: [] });
        this.loading.set(false);
      },
    });
  }

  rubriques(b: BlocFiche): RubriqueFiche[] {
    return [...b.rubriques].sort((a, c) => a.rang - c.rang);
  }

  /** Champs d'une rubrique (le serveur sert la rubrique en code complet « B05-GS », l'esquisse en code court). */
  champsDe(b: BlocFiche, r: RubriqueFiche): ChampFiche[] {
    const complet = r.code.startsWith(`${b.code}-`) ? r.code : `${b.code}-${r.code}`;
    return this.referentiel().champs.filter((c) => c.rubrique === complet || (c.bloc === b.code && c.rubrique === r.code)).sort((x, y) => x.rang - y.rang);
  }

  libelleSource(s: SourceChamp): string {
    return s === 'PPM' ? 'repris du PPM' : s === 'CADRAGE' ? 'repris du cadrage' : 'à saisir';
  }
  libelleTypeMarche(t: TypeMarche): string {
    return t === 'QUANTITE_FIXE' ? 'Quantité fixe' : t === 'A_COMMANDE' ? 'À commande' : 'Contrat-cadre';
  }
  typesCourts(c: ChampFiche): string {
    return c.typesMarche.map((t) => (t === 'QUANTITE_FIXE' ? 'QF' : t === 'A_COMMANDE' ? 'AC' : 'CC')).join(', ');
  }
  erreur(cle: string): string | null {
    return this.erreurs().get(cle) ?? null;
  }

  nouveau(): void {
    this.creation.set(true);
    this.erreurs.set(new Map());
    this.edition.set(vide());
  }
  modifier(c: ChampFiche): void {
    this.creation.set(false);
    this.erreurs.set(new Map());
    this.edition.set({ ...c, reprises: [...(c.reprises ?? [])], typesMarche: [...(c.typesMarche ?? [])], options: c.options ? [...c.options] : null });
  }
  annuler(): void {
    this.edition.set(null);
    this.erreurs.set(new Map());
  }

  poser<K extends keyof ChampFiche>(cle: K, valeur: ChampFiche[K]): void {
    this.edition.update((c) => (c ? { ...c, [cle]: valeur } : c));
    if (this.erreurs().has(cle)) this.erreurs.update((m) => { const n = new Map(m); n.delete(cle); return n; });
  }
  poserListe(cle: 'options', brut: string): void {
    const liste = brut.split(',').map((s) => s.trim()).filter(Boolean);
    this.poser(cle, liste.length ? liste : null);
  }
  basculer(cle: 'reprises' | 'typesMarche', valeur: string): void {
    this.edition.update((c) => {
      if (!c) return c;
      const actuel = c[cle] as string[];
      const suivant = actuel.includes(valeur) ? actuel.filter((x) => x !== valeur) : [...actuel, valeur];
      return { ...c, [cle]: suivant };
    });
  }

  enregistrer(): void {
    const c = this.edition();
    if (!c || this.saving()) return;
    this.saving.set(true);
    const appel = this.creation() ? this.service.creer(c) : this.service.modifier(c.code, c);
    appel.subscribe({
      next: (sauve) => {
        this.saving.set(false);
        this.referentiel.update((r) => ({ ...r, champs: this.creation() ? [...r.champs, sauve] : r.champs.map((x) => (x.code === sauve.code ? sauve : x)) }));
        this.toast.success(`Champ ${sauve.code} ${this.creation() ? 'créé' : 'enregistré'}.`);
        this.edition.set(null);
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.saving.set(false);
        const parChamp = erreursParChamp(e);
        if (e.status === 400 && parChamp.size) this.erreurs.set(parChamp);
        else this.toast.error(e.message || 'Enregistrement impossible.');
      },
    });
  }
}
