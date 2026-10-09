import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ElementTechnique, LotTechnique, MoyenneTechnique, PropositionTechnique, Technique } from '../../models';
import { EvaluationPiService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { DroitsEvaluation } from './droits-evaluation';
import { refusEvaluation } from './libelles-evaluation';

/** Une cellule de ma grille, en saisie. */
interface Saisie {
  note: string;
  motif: string;
}

const LIBELLES_STATUT: Readonly<Record<PropositionTechnique['statut'], string>> = { EN_COURS: 'En notation', QUALIFIEE: 'Qualifiée', ELIMINEE: 'Éliminée' };

/** Les éléments de la grille, regroupés par critère, dans l'ordre servi. */
export function parCritere(elements: ElementTechnique[]): { critere: string; libelle: string; elements: ElementTechnique[] }[] {
  const groupes: { critere: string; libelle: string; elements: ElementTechnique[] }[] = [];
  for (const e of elements) {
    let g = groupes.find((x) => x.critere === e.critere);
    if (!g) groupes.push((g = { critere: e.critere, libelle: e.libelleCritere || e.critere, elements: [] }));
    g.elements.push(e);
  }
  return groupes;
}

/**
 * Ce qui part au serveur pour ma grille : les éléments dont la note est saisie ; une note sans motif, ou hors du barème, est refusée ici
 * (le serveur redit `MOTIF_OBLIGATOIRE`, `NOTE_HORS_BAREME`). Rend la charge ou l'erreur à montrer.
 */
export function chargeGrille(elements: ElementTechnique[], saisie: (code: string) => Saisie | undefined):
  { notes: { element: string; note: number; motif: string }[] } | { erreur: string } {
  const notes: { element: string; note: number; motif: string }[] = [];
  for (const e of elements) {
    const s = saisie(e.code);
    if (!s || s.note.trim() === '') continue;
    const note = Number(s.note.replace(',', '.'));
    const nom = e.libelle || e.libelleCritere || e.code;
    if (!Number.isFinite(note) || note < 0 || note > e.max) return { erreur: `« ${nom} » : la note va de 0 à ${e.max}.` };
    if (!s.motif.trim()) return { erreur: `« ${nom} » : chaque note se motive.` };
    notes.push({ element: e.code, note, motif: s.motif.trim() });
  }
  return notes.length ? { notes } : { erreur: 'Saisissez au moins une note, motivée.' };
}

/**
 * ⚠️ **L'évaluation technique des propositions** (lot 3 PI, tranche PI-c — V87). Pour un lot : chaque proposition retenue à l'examen
 * préliminaire, la grille de la fiche (sous-critères, ou critère noté globalement) ; le membre déclaré sans conflit **saisit sa grille**,
 * chaque note motivée ; le serveur calcule la moyenne de chaque élément, la note technique (leur somme), signale les **écarts** au-delà du
 * seuil, et classe. Le président arrête l'étape (grilles complètes exigées) : sous le score minimum, la proposition est éliminée et son
 * enveloppe financière ne s'ouvrira pas.
 */
@Component({
  selector: 'app-etape-technique',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lotT(); as l) {
      <p class="text-sm text-muted et__aide">
        Chaque membre note chaque proposition sur la grille de la fiche, et motive chaque note. La note technique est la somme des moyennes
        (sur {{ total() }} points){{ technique().scoreMinimum != null ? ' ; le score minimum est de ' + technique().scoreMinimum + ' points' : '' }}.
        Un écart de plus de {{ technique().seuilEcartPourcent ?? 20 }} % du maximum entre la note la plus haute et la plus basse d’un élément est signalé.
      </p>
      @if (l.arret; as a) {
        <p class="text-sm et__arret">Évaluation technique arrêtée par {{ a.nom || a.par }} le {{ jj(a.le) }}{{ a.observation ? ' — ' + a.observation : '' }}.</p>
      } @else if (!l.conformiteArretee) {
        <p class="text-sm" role="status">La notation s’ouvre quand l’examen préliminaire du lot est arrêté par le président.</p>
      }
      @if (message(); as m) { <div class="alert alert-danger" role="alert"><span>{{ m }}</span></div> }

      @if (l.offres.length) {
        <div class="table-card et__classement">
          <table class="et__table">
            <caption class="cnm-sr-only">Le classement technique du lot {{ l.lot }}</caption>
            <thead><tr><th scope="col">N°</th><th scope="col">Candidat</th><th scope="col">Note technique</th><th scope="col">Grilles</th><th scope="col">Statut</th><th scope="col">Rang</th></tr></thead>
            <tbody>
              @for (o of l.offres; track o.idOffre) {
                <tr>
                  <td>{{ o.numero ?? '—' }}</td>
                  <td>{{ o.raisonSociale || o.nif }}</td>
                  <td><strong>{{ o.total ?? '—' }}</strong>@if (nbEcarts(o)) { <span class="badge badge-warning et__ecart">{{ nbEcarts(o) }} écart(s)</span> }</td>
                  <td>{{ o.complete ? 'complètes' : o.grilles.length + ' reçue(s)' }}</td>
                  <td><span class="badge" [class.badge-success]="o.statut === 'QUALIFIEE'" [class.badge-danger]="o.statut === 'ELIMINEE'" [class.badge-neutral]="o.statut === 'EN_COURS'">{{ statuts[o.statut] }}</span></td>
                  <td>{{ o.rang ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="text-sm">Aucune proposition retenue à l’examen préliminaire.</p>
      }

      @for (o of l.offres; track o.idOffre) {
        <details class="card et__offre" [open]="l.offres.length === 1">
          <summary class="et__entete">
            <strong>Proposition n° {{ o.numero ?? '—' }}</strong> · {{ o.raisonSociale || o.nif }}
            <span class="text-sm text-muted">— {{ o.total ?? '—' }} / {{ total() }}</span>
          </summary>
          @if (o.motifElimination) { <p class="text-sm et__elim">{{ o.motifElimination }}</p> }
          <div class="table-responsive">
            <table class="et__table et__grille">
              <thead>
                <tr>
                  <th scope="col">Élément</th><th scope="col">Max</th>
                  @if (peutNoter(l)) { <th scope="col">Ma note</th><th scope="col">Motif</th> }
                  <th scope="col">Moyenne</th><th scope="col">Min – max</th><th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                @for (g of groupes(); track g.critere) {
                  <tr class="et__critere"><th scope="rowgroup" [attr.colspan]="peutNoter(l) ? 7 : 5">{{ g.libelle }}</th></tr>
                  @for (e of g.elements; track e.code) {
                    @let m = moyenne(o, e.code);
                    <tr [class.et__ligne--ecart]="m?.ecart">
                      <td>{{ e.libelle || e.libelleCritere }}</td>
                      <td>{{ e.max }}</td>
                      @if (peutNoter(l)) {
                        <td><input class="form-control et__note" type="number" min="0" [max]="e.max" step="0.5" [attr.aria-label]="'Ma note — ' + (e.libelle || e.libelleCritere)" [value]="valeur(o.idOffre, e.code).note" [disabled]="envoi() === o.idOffre" (input)="poser(o.idOffre, e.code, 'note', $any($event.target).value)" /></td>
                        <td><input class="form-control" type="text" [attr.aria-label]="'Motif de ma note — ' + (e.libelle || e.libelleCritere)" [value]="valeur(o.idOffre, e.code).motif" [disabled]="envoi() === o.idOffre" (input)="poser(o.idOffre, e.code, 'motif', $any($event.target).value)" /></td>
                      }
                      <td>{{ m?.moyenne ?? '—' }}@if (m?.ecart) { <span class="badge badge-warning et__ecart" title="La note la plus haute et la plus basse s’écartent de plus du seuil">écart</span> }</td>
                      <td>{{ m && m.min != null ? m.min + ' – ' + m.max : '—' }}</td>
                      <td>{{ m?.nombreNotes ?? 0 }}</td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
          @if (peutNoter(l)) {
            <div class="et__actions">
              <button type="button" class="btn btn-primary btn-sm" [disabled]="envoi() === o.idOffre" (click)="enregistrer(o)">{{ envoi() === o.idOffre ? 'Enregistrement…' : 'Enregistrer ma grille' }}</button>
              @if (erreurOffre()?.idOffre === o.idOffre) { <span class="form-error">{{ erreurOffre()!.message }}</span> }
            </div>
          }
          @if (o.grilles.length) {
            <details class="et__membres">
              <summary>Les grilles des membres ({{ o.grilles.length }})</summary>
              <div class="table-responsive">
                <table class="et__table">
                  <thead><tr><th scope="col">Élément</th>@for (g of o.grilles; track g.im) { <th scope="col">{{ g.nom || g.im }}</th> }</tr></thead>
                  <tbody>
                    @for (e of technique().elements; track e.code) {
                      <tr>
                        <td>{{ e.libelle || e.libelleCritere }}</td>
                        @for (g of o.grilles; track g.im) {
                          @let n = noteDe(g.notes, e.code);
                          <td [title]="n?.motif ?? ''">{{ n?.note ?? '—' }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </details>
          }
        </details>
      }

      @if (droits().president && l.conformiteArretee) {
        <section class="card et__president" aria-label="Arrêt de l'évaluation technique par le président">
          @if (!l.arret) {
            <label class="form-group"><span class="form-label">Observation (facultative)</span><input class="form-control" type="text" [value]="observation()" (input)="observation.set($any($event.target).value)" /></label>
            <button type="button" class="btn btn-primary btn-sm" [disabled]="travail()" (click)="arreter(l)">Arrêter l’évaluation technique du lot {{ l.lot }}</button>
            <p class="text-sm text-muted">Les grilles de tous les membres doivent être complètes. Sous le score minimum, une proposition est éliminée : son enveloppe financière ne s’ouvrira pas.</p>
          } @else {
            <details>
              <summary>Rouvrir l’évaluation technique…</summary>
              <div class="et__rouvrir">
                <label class="form-group"><span class="form-label">Motif (obligatoire, porté au journal)</span><input class="form-control" type="text" [value]="motif()" (input)="motif.set($any($event.target).value)" /></label>
                <button type="button" class="btn btn-outline btn-sm" [disabled]="!motif().trim() || travail()" (click)="rouvrir(l)">Rouvrir</button>
              </div>
            </details>
          }
        </section>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.75rem; }
    .et__aide, .et__arret, .et__elim { margin: 0; }
    .et__elim { color: var(--danger-700, #b42318); font-weight: 600; }
    .et__table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .et__table th, .et__table td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--n-200); vertical-align: middle; }
    .et__critere th { background: var(--n-50, #f8fafc); font-weight: 700; }
    .et__ligne--ecart td { background: #fffbeb; }
    .et__note { width: 6rem; }
    .et__ecart { margin-left: 0.35rem; }
    .et__offre { padding: 0.6rem 0.9rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .et__entete { cursor: pointer; display: flex; gap: 0.4rem; align-items: baseline; flex-wrap: wrap; }
    .et__actions { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-top: 0.5rem; }
    .et__membres { margin-top: 0.5rem; }
    .et__membres summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
    .et__president { padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .et__rouvrir { display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap; margin-top: 0.4rem; }
  `,
})
export class EtapeTechnique {
  private readonly service = inject(EvaluationPiService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  readonly technique = input.required<Technique>();
  readonly lot = input.required<number>();
  readonly droits = input.required<DroitsEvaluation>();
  /** Le matricule du connecté : sa grille se pré-remplit de ses notes déjà enregistrées. */
  readonly moi = input<string | null>(null);
  readonly maj = output<Technique>();

  readonly statuts = LIBELLES_STATUT;
  readonly jj = dateHeureFr;
  readonly lotT = computed<LotTechnique | null>(() => this.technique().lots.find((l) => l.lot === this.lot()) ?? null);
  readonly groupes = computed(() => parCritere(this.technique().elements));
  readonly total = computed(() => Math.round(this.technique().elements.reduce((s, e) => s + e.max, 0) * 100) / 100);

  readonly saisies = signal<Map<string, Saisie>>(new Map());
  /** Les propositions dont ma grille est modifiée et non enregistrée : un rechargement ne l'écrase pas. */
  private readonly modifiees = new Set<string>();
  readonly envoi = signal<string | null>(null);
  readonly erreurOffre = signal<{ idOffre: string; message: string } | null>(null);
  readonly message = signal<string | null>(null);
  readonly travail = signal(false);
  readonly observation = signal('');
  readonly motif = signal('');

  constructor() {
    // Ma grille se reprend de mes notes enregistrées, sauf pour une proposition en cours de saisie.
    effect(() => {
      const t = this.technique();
      const moi = this.moi();
      untracked(() => {
        const m = new Map(this.saisies());
        for (const l of t.lots) {
          for (const o of l.offres) {
            if (this.modifiees.has(o.idOffre)) continue;
            const mienne = o.grilles.find((g) => g.im === moi);
            for (const e of t.elements) {
              const n = mienne?.notes.find((x) => x.element === e.code);
              m.set(this.cle(o.idOffre, e.code), { note: n ? String(n.note) : '', motif: n?.motif ?? '' });
            }
          }
        }
        this.saisies.set(m);
      });
    });
  }

  private cle(idOffre: string, element: string): string {
    return `${idOffre}|${element}`;
  }

  peutNoter(l: LotTechnique): boolean {
    return this.droits().decider && l.conformiteArretee && !l.arret;
  }

  valeur(idOffre: string, element: string): Saisie {
    return this.saisies().get(this.cle(idOffre, element)) ?? { note: '', motif: '' };
  }

  poser(idOffre: string, element: string, champ: keyof Saisie, v: string): void {
    this.modifiees.add(idOffre);
    this.saisies.update((m) => new Map(m).set(this.cle(idOffre, element), { ...this.valeur(idOffre, element), [champ]: v }));
  }

  moyenne(o: PropositionTechnique, element: string): MoyenneTechnique | null {
    return o.moyennes.find((m) => m.element === element) ?? null;
  }

  noteDe(notes: { element: string; note: number; motif: string | null }[], element: string) {
    return notes.find((n) => n.element === element) ?? null;
  }

  nbEcarts(o: PropositionTechnique): number {
    return o.moyennes.filter((m) => m.ecart).length;
  }

  enregistrer(o: PropositionTechnique): void {
    const charge = chargeGrille(this.technique().elements, (code) => this.saisies().get(this.cle(o.idOffre, code)));
    if ('erreur' in charge) {
      this.erreurOffre.set({ idOffre: o.idOffre, message: charge.erreur });
      return;
    }
    this.erreurOffre.set(null);
    this.envoi.set(o.idOffre);
    this.service.noter(this.idDmc(), o.idOffre, charge).subscribe({
      next: (t) => {
        this.envoi.set(null);
        this.modifiees.delete(o.idOffre);
        this.toast.success(`Votre grille de la proposition n° ${o.numero ?? '—'} est enregistrée.`);
        this.maj.emit(t);
      },
      error: (e: ApiError) => {
        this.envoi.set(null);
        this.erreurOffre.set({ idOffre: o.idOffre, message: refusEvaluation(e) });
      },
    });
  }

  arreter(l: LotTechnique): void {
    this.travail.set(true);
    this.message.set(null);
    this.service.arreter(this.idDmc(), l.lot, this.observation().trim() || null).subscribe({
      next: (t) => {
        this.travail.set(false);
        this.observation.set('');
        this.toast.success(`Évaluation technique du lot ${l.lot} arrêtée.`);
        this.maj.emit(t);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.message.set(refusEvaluation(e));
      },
    });
  }

  rouvrir(l: LotTechnique): void {
    this.travail.set(true);
    this.message.set(null);
    this.service.rouvrir(this.idDmc(), l.lot, this.motif().trim()).subscribe({
      next: (t) => {
        this.travail.set(false);
        this.motif.set('');
        this.toast.success(`Évaluation technique du lot ${l.lot} rouverte.`);
        this.maj.emit(t);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.message.set(refusEvaluation(e));
      },
    });
  }
}
