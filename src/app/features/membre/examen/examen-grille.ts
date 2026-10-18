import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, effect, inject, input, output, signal } from '@angular/core';

import { Icone } from '../../../shared/ui/icone';
import { ActionGrille, PointVue, VueGrille, codesCites, pluriel } from './examen-modele';

/**
 * Panneau « grille de contrôle » de l'examen (maquette `ExamenLigne`, 2026-09-14) — à droite du
 * document, repliable en languette. Contexte de l'étape (ligne, objet, mode, montant, consigne,
 * justification tirée de la fiche), résumé des statuts, points RAS / Observation, corrections
 * « Au lieu de / Lire » avec leur cellule visée, navigation, et la RAISON d'une validation
 * impossible, dite avant le clic.
 *
 * Composant de présentation : il reçoit une vue calculée par l'écran et lui renvoie chaque geste
 * (`action`). Une seule couleur (ambre) pour les observations, comme dans le document.
 */
@Component({
  selector: 'app-examen-grille',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    @if (!ouverte()) {
      <button
        type="button"
        class="languette"
        aria-expanded="false"
        aria-controls="grille-controle"
        (click)="action.emit({ type: 'basculer' })"
      >
        <app-icone nom="chevl" [taille]="16" />
        <span class="languette__t">Grille de contrôle@if (vue().points.length) { · {{ statues() }}/{{ vue().points.length }}}</span>
        @if (vue().resume.obs) {
          <span class="languette__obs">{{ vue().resume.obs }}<span class="cnm-sr-only"> {{ vue().resume.obs > 1 ? 'observations' : 'observation' }}</span></span>
        }
        @if (vue().raison) {
          <span class="languette__alerte" [attr.title]="vue().raison"><app-icone nom="alert" [taille]="14" /></span>
        }
      </button>
    } @else {
      <section id="grille-controle" class="grille" aria-labelledby="grille-titre">
        <header class="grille__tete">
          <div class="grille__ligne1">
            <span class="grille__eyebrow">{{ vue().eyebrow }}</span>
            <button
              type="button"
              class="grille__replier"
              aria-expanded="true"
              aria-controls="grille-controle"
              aria-label="Replier la grille de contrôle"
              title="Replier la grille de contrôle"
              (click)="action.emit({ type: 'basculer' })"
            >
              <app-icone nom="chev" [taille]="16" />
            </button>
          </div>
          <h2 id="grille-titre" class="grille__titre">{{ vue().titre }}</h2>
          @if (vue().puces.length) {
            <div class="grille__puces">
              @for (p of vue().puces; track $index) {
                <span class="puce" [class.puce--mono]="p.mono" [class.puce--consigne]="p.consigne">{{ p.texte }}</span>
              }
            </div>
          }
          @for (j of vue().justifications; track j.titre) {
            <div class="grille__justif"><b>{{ j.titre }}</b>« {{ j.texte }} »</div>
          }
          @if (vue().points.length) {
            <!-- ⚠️ 18/10 (pilote, lot A) — une barre de progression, et un filtre sur les points encore ouverts. -->
            <div class="grille__progres">
              <div class="progres" role="progressbar" [attr.aria-valuenow]="statues()" aria-valuemin="0" [attr.aria-valuemax]="vue().points.length"
                [attr.aria-label]="statues() + ' points statués sur ' + vue().points.length">
                <span class="progres__ras" [style.width.%]="pct(vue().resume.ras)"></span><span class="progres__obs" [style.width.%]="pct(vue().resume.obs)"></span>
              </div>
              <span class="progres__txt"><b>{{ statues() }} / {{ vue().points.length }}</b> points statués@if (vue().resume.obs) { · {{ pluriel(vue().resume.obs, 'observation') }}}</span>
            </div>
            <p class="grille__resume">
              <span><i class="rond rond--ras" aria-hidden="true"></i>{{ vue().resume.ras }} RAS</span>
              <span><i class="rond rond--obs" aria-hidden="true"></i>{{ pluriel(vue().resume.obs, 'observation') }}</span>
              <button type="button" class="filtre" [class.filtre--on]="seulsOuverts()" [attr.aria-pressed]="seulsOuverts()" [disabled]="!vue().resume.aRenseigner && !seulsOuverts()"
                (click)="seulsOuverts.set(!seulsOuverts())">
                <i class="rond rond--vide" aria-hidden="true"></i>{{ vue().resume.aRenseigner }} à renseigner@if (seulsOuverts()) { · tout afficher }
              </button>
            </p>
          }
        </header>

        <div class="grille__points">
          @if (vue().piece; as pc) {
            <div class="pt" [class.pt--todo]="pc.statut === null">
              <div class="pt__h">
                <span class="pt__l" id="pt-l-piece">{{ pc.libelle }} <em aria-hidden="true">*</em></span>
                <div class="seg" role="radiogroup" aria-labelledby="pt-l-piece">
                  <label class="seg__opt seg__opt--ras" [class.is-on]="pc.statut === 'RAS'">
                    <input type="radio" class="seg__radio" [name]="'piece-' + pc.idPiece" [checked]="pc.statut === 'RAS'" [disabled]="vue().verrouille" (change)="action.emit({ type: 'statutPiece', statut: 'RAS' })" />RAS
                  </label>
                  <label class="seg__opt seg__opt--obs" [class.is-on]="pc.statut === 'OBS'">
                    <input type="radio" class="seg__radio" [name]="'piece-' + pc.idPiece" [checked]="pc.statut === 'OBS'" [disabled]="vue().verrouille" (change)="action.emit({ type: 'statutPiece', statut: 'OBS' })" />Observation
                  </label>
                </div>
              </div>
              <!-- ⚠️ 18/10 (pilote) — une seule pièce par étape : le rappel du bas (« Choisissez RAS ou Observation… ») suffit. -->
              @if (pc.statut === 'OBS') {
                <div class="obs">
                  <div class="obs__h">
                    @if (pc.numero) { <i class="obs__n">{{ pc.numero }}</i> }
                    <span>Observation sur la pièce</span>
                  </div>
                  <label class="obs__champ">
                    <span>Observation</span>
                    <textarea id="obs-piece" rows="3" [value]="pc.observation" [disabled]="vue().verrouille" (input)="action.emit({ type: 'observationPiece', valeur: valeurDe($event) })"></textarea>
                  </label>
                  @if (pc.seraRas) { <p class="pt__hint">Sans texte, la pièce sera validée RAS.</p> }
                  @if (pc.erreur) { <span class="form-error">{{ pc.erreur }}</span> }
                </div>
              }
            </div>
          }

          @for (p of pointsAffiches(); track p.idPt) {
            <!-- ⚠️ 18/10 (pilote, lot B) — une longue grille (plus de six points) ne déplie que le point en cours ; les autres tiennent
                 sur une ligne avec leur état, un clic (ou ↓ ↑) en ouvre un autre. -->
            @if (compact() && p.idPt !== ouvertEffectif()) {
              <button type="button" class="pt-ligne" [class.pt-ligne--todo]="p.statut === null" (click)="action.emit({ type: 'ouvrir', idPt: p.idPt })">
                <span class="pt__rang">{{ p.rang }}.</span><span class="pt-ligne__l">{{ p.libelle }}</span>
                <span class="etat etat--{{ etat(p) }}">{{ libelleEtat(p) }}</span>
              </button>
            } @else {
            <div class="pt" [class.pt--todo]="p.statut === null" [class.pt--courant]="compact()" [attr.aria-current]="compact() ? 'step' : null">
              <div class="pt__h">
                <span class="pt__l" [id]="'pt-l-' + p.idPt"><span class="pt__rang">{{ p.rang }}.</span> {{ p.libelle }}@if (p.obligatoire) {<em aria-hidden="true">&nbsp;*</em>}</span>
                <div class="seg" role="radiogroup" [attr.aria-labelledby]="'pt-l-' + p.idPt">
                  <label class="seg__opt seg__opt--ras" [class.is-on]="p.statut === 'RAS'">
                    <input type="radio" class="seg__radio" [name]="'st-' + p.idPt" [checked]="p.statut === 'RAS'" [disabled]="vue().verrouille" (change)="action.emit({ type: 'statut', idPt: p.idPt, statut: 'RAS' })" />RAS
                  </label>
                  <label class="seg__opt seg__opt--obs" [class.is-on]="p.statut === 'OBS'">
                    <input type="radio" class="seg__radio" [name]="'st-' + p.idPt" [checked]="p.statut === 'OBS'" [disabled]="vue().verrouille" (change)="action.emit({ type: 'statut', idPt: p.idPt, statut: 'OBS' })" />Observation
                  </label>
                </div>
              </div>
              <!-- ⚠️ 18/10 (pilote, lot A) — la description se replie sur une ligne ; « Détails » la déplie. -->
              @if (p.description) {
                <p class="pt__d" [class.pt__d--replie]="!deplies().has(p.idPt)">{{ p.description }}</p>
                <button type="button" class="pt__plus" [attr.aria-expanded]="deplies().has(p.idPt)" (click)="basculer(p.idPt)">{{ deplies().has(p.idPt) ? 'Moins' : 'Détails' }}</button>
              }
              <!-- ⚠️ 18/10 (pilote, lot B) — les informations que le point cite : un clic amène la fiche dessus et la surligne. -->
              <!-- Seules les informations que CETTE fiche porte (sa forme, sa catégorie) sont proposées ; les autres sont comptées. -->
              @let refs = refsDe(p.description);
              @if (refs.presentes.length || refs.absentes) {
                <div class="pt__refs">
                  @for (c of refs.presentes; track c) {
                    <button type="button" class="pt__ref" [attr.title]="'Voir ' + c + ' dans la fiche'" (click)="action.emit({ type: 'ref', code: c })">{{ c }}</button>
                  }
                  @if (refs.absentes) {
                    <span class="pt__absentes" [attr.title]="refs.listeAbsentes">{{ refs.absentes }} sans objet pour cette fiche</span>
                  }
                </div>
              }
              @if (p.statut === null) {
                <p class="pt__todo"><app-icone nom="alert" [taille]="13" />À renseigner</p>
              }
              @if (p.statut === 'OBS') {
                @for (o of p.observations; track o.index) {
                  <div class="obs">
                    <div class="obs__h">
                      @if (o.numero) { <i class="obs__n">{{ o.numero }}</i> }
                      <span class="obs__titre">{{ o.cellule ? 'Cellule « ' + o.cellule + ' »' : 'Correction ' + (o.index + 1) }}</span>
                      <button type="button" class="obs__retirer" [attr.aria-label]="'Retirer la correction ' + (o.index + 1) + ' du point ' + p.rang" (click)="action.emit({ type: 'retirer', idPt: p.idPt, index: o.index })">
                        <app-icone nom="x" [taille]="14" />
                      </button>
                    </div>
                    <div class="obs__diff">
                      <label class="obs__champ">
                        <span>Au lieu de</span>
                        <textarea rows="2" [id]="'obs-aulieude-' + p.idPt + '-' + o.index" [value]="o.auLieuDe" [disabled]="vue().verrouille" (input)="action.emit({ type: 'auLieuDe', idPt: p.idPt, index: o.index, valeur: valeurDe($event) })"></textarea>
                      </label>
                      <label class="obs__champ">
                        <span>Lire</span>
                        <textarea rows="2" [id]="'obs-lire-' + p.idPt + '-' + o.index" [value]="o.lire" [disabled]="vue().verrouille" (input)="action.emit({ type: 'lire', idPt: p.idPt, index: o.index, valeur: valeurDe($event) })"></textarea>
                      </label>
                    </div>
                    @if (vue().options.length) {
                      <label class="obs__cible">
                        <span>Cellule visée</span>
                        <select [disabled]="vue().verrouille" (change)="action.emit({ type: 'cible', idPt: p.idPt, index: o.index, cle: valeurDe($event) })">
                          <option value="" [selected]="!o.cleCible">Aucune</option>
                          @for (opt of vue().options; track opt.cle) {
                            <option [value]="opt.cle" [selected]="opt.cle === o.cleCible">{{ opt.libelle }}</option>
                          }
                        </select>
                      </label>
                    }
                  </div>
                } @empty {
                  <p class="pt__d">Aucune correction.</p>
                }
                <button type="button" class="obs__ajouter" [disabled]="vue().verrouille" (click)="action.emit({ type: 'ajouter', idPt: p.idPt })">
                  <app-icone nom="plus" [taille]="14" />Ajouter une correction
                </button>
                <!-- « Pas de texte = pas d'observation » (pilote 21/09) : dit d'avance, sans bloquer. -->
                @if (p.seraRas) { <p class="pt__hint">Sans correction renseignée, ce point sera validé RAS.</p> }
                @if (p.erreur) { <span class="form-error">{{ p.erreur }}</span> }
              }
              @if (compact()) {
                <div class="pt__nav">
                  <button type="button" class="pt__navbtn" [disabled]="!voisin(-1)" (click)="ouvrirVoisin(-1)"><app-icone nom="chevl" [taille]="14" />Point précédent</button>
                  <button type="button" class="pt__navbtn" [disabled]="!voisin(1)" (click)="ouvrirVoisin(1)">Point suivant<app-icone nom="chev" [taille]="14" /></button>
                </div>
              }
            </div>
            }
          }
        </div>

        <footer class="grille__pied">
          @if (vue().points.length || vue().piece) {
            <p class="grille__touches" aria-hidden="true"><kbd>R</kbd> RAS · <kbd>O</kbd> Observation@if (compact()) { · <kbd>↓</kbd><kbd>↑</kbd> point }· <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> valider</p>
          }
          <p class="grille__raison" aria-live="polite">
            @if (vue().raison) { <app-icone nom="alert" [taille]="14" />{{ vue().raison }} }
          </p>
          @if (enregistre()) {
            <!-- Seulement après un brouillon réellement enregistré (validation d'étape, mode création). -->
            <p class="grille__enregistre"><app-icone nom="check" [taille]="14" />Enregistré à {{ enregistre() }}</p>
          }
          <div class="grille__actions">
            @if (vue().libellePrecedent) {
              <button type="button" class="btn btn-outline grille__prec" (click)="action.emit({ type: 'precedent' })">
                <app-icone nom="chevl" [taille]="16" />{{ vue().libellePrecedent }}
              </button>
            }
            <button type="button" class="btn btn-primary grille__valider" [disabled]="!!vue().raison" (click)="action.emit({ type: 'valider' })">
              {{ vue().libelleValider }}<app-icone nom="chev" [taille]="16" />
            </button>
          </div>
        </footer>
      </section>
    }
  `,
  styleUrl: './examen-grille.scss',
  host: { '[class.grille--repliee]': '!ouverte()' },
})
export class ExamenGrille {
  /** ⚠️ 18/10 (lot A) — filtre « à renseigner » et descriptions dépliées : état d'affichage, propre au panneau. */
  readonly seulsOuverts = signal(false);
  readonly deplies = signal<ReadonlySet<number>>(new Set());
  readonly statues = computed(() => this.vue().resume.ras + this.vue().resume.obs);
  readonly pointsAffiches = computed(() => (this.seulsOuverts() ? this.vue().points.filter((p) => p.statut === null) : this.vue().points));
  pct(n: number): number { return this.vue().points.length ? (n / this.vue().points.length) * 100 : 0; }
  basculer(id: number): void {
    const s = new Set(this.deplies());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.deplies.set(s);
  }

  readonly vue = input.required<VueGrille>();
  /** ⚠️ 18/10 (lot B) — le point ouvert, tenu par l'écran (une observation posée depuis la fiche l'ouvre) ; nul : le premier à renseigner. */
  readonly pointOuvert = input<number | null>(null);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Plus de six points : la grille ne déplie que le point en cours. */
  readonly compact = computed(() => this.vue().points.length > 6);
  readonly ouvertEffectif = computed(() => {
    const pts = this.vue().points;
    const o = this.pointOuvert();
    if (o != null && pts.some((p) => p.idPt === o)) return o;
    return (pts.find((p) => p.statut === null) ?? pts[0])?.idPt ?? null;
  });
  /** ⚠️ 18/10 — les codes que la fiche rend ; nul : la fiche n'a pas encore été lue, toutes les références sont proposées. */
  readonly codesConnus = input<ReadonlySet<string> | null>(null);
  refsDe(description: string | null): { presentes: string[]; absentes: number; listeAbsentes: string } {
    const tous = codesCites(description);
    const connus = this.codesConnus();
    if (!connus) return { presentes: tous, absentes: 0, listeAbsentes: '' };
    const absentes = tous.filter((c) => !connus.has(c));
    return { presentes: tous.filter((c) => connus.has(c)), absentes: absentes.length, listeAbsentes: 'Absentes de cette fiche : ' + absentes.join(', ') };
  }
  constructor() {
    // Le point ouvert reste sous les yeux quand il change (clavier, « Point suivant », observation posée depuis la fiche).
    effect(() => {
      const id = this.ouvertEffectif();
      if (id == null || !this.compact()) return;
      setTimeout(() => this.hote.nativeElement.querySelector('.pt--courant')?.scrollIntoView({ block: 'nearest' }));
    });
  }
  etat(p: PointVue): 'ras' | 'obs' | 'vide' {
    return p.statut === null ? 'vide' : p.statut === 'OBS' && !p.seraRas ? 'obs' : 'ras';
  }
  libelleEtat(p: PointVue): string {
    const e = this.etat(p);
    if (e === 'vide') return 'à renseigner';
    if (e === 'ras') return 'RAS';
    const n = p.observations.map((x) => x.numero).filter((x): x is number => x != null);
    return n.length ? 'Obs. ' + n.join(', ') : 'Observation';
  }
  /** Le point voisin (−1 : précédent, +1 : suivant) dans la liste affichée. */
  voisin(sens: -1 | 1): PointVue | null {
    const pts = this.pointsAffiches();
    const i = pts.findIndex((p) => p.idPt === this.ouvertEffectif());
    return pts[i + sens] ?? null;
  }
  ouvrirVoisin(sens: -1 | 1): void {
    const v = this.voisin(sens);
    if (v) this.action.emit({ type: 'ouvrir', idPt: v.idPt });
  }

  /**
   * ⚠️ 18/10 (pilote, lot B) — le clavier : R (RAS) et O (Observation) sur le point ouvert ou la pièce, ↓ ↑ pour changer de point,
   * Ctrl+Entrée pour valider. Jamais pendant une saisie, ni quand une boîte de dialogue est ouverte.
   */
  @HostListener('document:keydown', ['$event'])
  clavier(e: KeyboardEvent): void {
    if (!this.ouverte() || this.vue().verrouille || e.altKey) return;
    const cible = e.target as HTMLElement | null;
    if (document.querySelector('[role="dialog"]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (!this.vue().raison) { e.preventDefault(); this.action.emit({ type: 'valider' }); }
      return;
    }
    if (e.ctrlKey || e.metaKey || (cible && cible.closest('input, textarea, select, [contenteditable="true"]'))) return;
    const k = e.key.toLowerCase();
    if (k !== 'r' && k !== 'o' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (this.vue().piece) {
      if (k === 'r' || k === 'o') {
        e.preventDefault();
        this.action.emit({ type: 'statutPiece', statut: k === 'r' ? 'RAS' : 'OBS' });
        if (k === 'o') setTimeout(() => (document.getElementById('obs-piece') as HTMLTextAreaElement | null)?.focus());
      }
      return;
    }
    const id = this.ouvertEffectif();
    if (id == null) return;
    if (k === 'r' || k === 'o') {
      e.preventDefault();
      this.action.emit({ type: 'statut', idPt: id, statut: k === 'r' ? 'RAS' : 'OBS' });
      if (k === 'o') setTimeout(() => (this.hote.nativeElement.querySelector(`[id^="obs-lire-${id}-"]`) as HTMLTextAreaElement | null)?.focus());
    } else if (this.compact()) {
      e.preventDefault();
      this.ouvrirVoisin(e.key === 'ArrowDown' ? 1 : -1);
    }
  }
  readonly ouverte = input(true);
  /** Heure du dernier brouillon de progression enregistré, s'il y en a un. */
  readonly enregistre = input<string | null>(null);
  readonly action = output<ActionGrille>();

  readonly pluriel = pluriel;

  valeurDe(ev: Event): string {
    return (ev.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }
}
