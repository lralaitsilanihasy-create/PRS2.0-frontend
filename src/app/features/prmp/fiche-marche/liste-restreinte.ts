import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { ApiError, erreursParChamp } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { CandidatRestreint, ListeRestreinte, SourceListeRestreinte } from '../../../models';
import { FicheMarcheService } from '../../../services/fiche-marche.services';

/** Les sources que la PRMP déclare (décret, art. 11-2 et 13) ; l'appel à candidatures en ligne (B4) pose la sienne lui-même. */
export const SOURCES_SAISIES: readonly { code: SourceListeRestreinte; libelle: string; aide: string }[] = [
  { code: 'BASE_AUTORITE', libelle: 'Base de données de l’autorité contractante', aide: 'Les prestataires déjà connus de l’autorité contractante.' },
  { code: 'PREMIER_APPEL_OFFRES', libelle: 'Candidats qualifiés du premier appel d’offres', aide: 'Cas du prestataire défaillant.' },
  { code: 'REGISTRE_ARMP', libelle: 'Registre de l’ARMP', aide: 'Les prestataires inscrits au registre de l’ARMP.' },
  { code: 'ORGANISME_PROFESSIONNEL', libelle: 'Organisme professionnel', aide: 'Cas du petit nombre : OMERT, OMH, chambre de commerce…' },
];

export const MINIMUM_CANDIDATS = 3;

/** Une ligne d'écran : le candidat et sa clé locale, stable pendant la saisie. */
interface Ligne extends CandidatRestreint {
  cle: number;
}

/**
 * ⚠️ 02/11 (V156, demande « appel-offres-restreint », B3) — **la liste restreinte saisie**, à l'étape de cadrage d'une ligne en mode
 * restreint, sous le motif (B2). Sa source et trois candidats au moins (nom, adresse ; courriel, compte candidat et NIF facultatifs).
 * Lue avec la fiche, écrite par sa route propre (`PUT` remplace la liste) ; figée à la validation. La lettre `LETTRE-AOR` la reprend
 * dans son ordre : plus de seconde saisie à l'impression. Le PV de la CAO qui la valide reste une pièce du dossier (`PV_LISTE_RESTREINTE`).
 */
@Component({
  selector: 'app-liste-restreinte',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="lr" id="fm-liste-restreinte" aria-labelledby="lr-t" [class.lr--manque]="!liste() && !lecture()">
      <div class="lr__tete">
        <h3 id="lr-t" class="lr__t">Liste restreinte des candidats</h3>
        @if (!liste() && !lecture()) { <span class="lr__manque">à saisir avant de valider</span> }
        <span class="lr__ref">Trois candidats au moins — validée par la CAO (PV joint au dossier)</span>
      </div>
      @if (lecture()) {
        @if (liste(); as l) {
          <p class="lr__src">Source : <b>{{ l.libelleSource || libelleSource(l.source) }}</b></p>
          <ol class="lr__lue">
            @for (c of l.candidats; track $index) {
              <li><b>{{ c.nom }}</b> — {{ c.adresse }}@if (c.email) { · {{ c.email }} }@if (c.idCandidat) { · compte {{ c.idCandidat }} }@if (c.nif) { · NIF {{ c.nif }} }</li>
            }
          </ol>
        } @else {
          <p class="lr__src">Aucune liste saisie.</p>
        }
      } @else if (liste()?.source === 'APPEL_CANDIDATURES') {
        <p class="lr__src">Cette liste est arrêtée par la commission au terme de l’appel à candidatures en ligne : elle ne se saisit pas ici.</p>
      } @else {
        <fieldset class="lr__sources">
          <legend class="lr__l">D’où viennent les candidats ?</legend>
          @for (s of sources; track s.code) {
            <label class="lr__opt" [class.lr__opt--on]="source() === s.code">
              <input type="radio" name="source-liste-restreinte" [value]="s.code" [checked]="source() === s.code" (change)="source.set(s.code)" />
              <span class="lr__opt-l">{{ s.libelle }}</span>
              <span class="lr__opt-t">{{ s.aide }}</span>
            </label>
          }
        </fieldset>
        @if (erreurs().get('source'); as e) { <span class="form-error">{{ e }}</span> }

        <ol class="lr__cands" aria-label="Candidats de la liste restreinte">
          @for (c of lignes(); track c.cle; let i = $index) {
            <li class="lr__cand">
              <span class="lr__rang" aria-hidden="true">{{ i + 1 }}.</span>
              <div class="lr__champs">
                <label class="lr__ch lr__ch--nom"><span>Nom ou raison sociale</span>
                  <input class="form-control" [value]="c.nom" maxlength="255" (input)="poser(c.cle, 'nom', $event)" />
                  @if (erreur(i, 'nom'); as e) { <span class="form-error">{{ e }}</span> }
                </label>
                <label class="lr__ch lr__ch--adr"><span>Adresse</span>
                  <textarea class="form-control" rows="2" maxlength="1000" [value]="c.adresse" (input)="poser(c.cle, 'adresse', $event)"></textarea>
                  @if (erreur(i, 'adresse'); as e) { <span class="form-error">{{ e }}</span> }
                </label>
                <label class="lr__ch"><span>Adresse électronique <i>facultative</i></span>
                  <input class="form-control" type="email" maxlength="150" [value]="c.email ?? ''" (input)="poser(c.cle, 'email', $event)" />
                  @if (erreur(i, 'email'); as e) { <span class="form-error">{{ e }}</span> }
                </label>
                <label class="lr__ch"><span>N° de compte candidat <i>facultatif</i></span>
                  <input class="form-control" [value]="c.idCandidat ?? ''" (input)="poser(c.cle, 'idCandidat', $event)" />
                  @if (erreur(i, 'idCandidat'); as e) { <span class="form-error">{{ e }}</span> }
                </label>
                <label class="lr__ch"><span>NIF <i>facultatif</i></span>
                  <input class="form-control" maxlength="30" [value]="c.nif ?? ''" (input)="poser(c.cle, 'nif', $event)" />
                  @if (erreur(i, 'nif'); as e) { <span class="form-error">{{ e }}</span> }
                </label>
              </div>
              <div class="lr__gestes">
                <button type="button" class="btn btn-ghost btn-sm" [disabled]="i === 0" [attr.aria-label]="'Monter le candidat ' + (i + 1)" (click)="deplacer(c.cle, -1)">↑</button>
                <button type="button" class="btn btn-ghost btn-sm" [disabled]="i === lignes().length - 1" [attr.aria-label]="'Descendre le candidat ' + (i + 1)" (click)="deplacer(c.cle, 1)">↓</button>
                <button type="button" class="btn btn-ghost btn-sm" [disabled]="lignes().length <= 1" [attr.aria-label]="'Retirer le candidat ' + (i + 1)" (click)="retirer(c.cle)">✕</button>
              </div>
            </li>
          }
        </ol>
        @if (erreurs().get('candidats'); as e) { <span class="form-error">{{ e }}</span> }
        <p class="lr__aide">Un courriel ou un numéro de compte candidat (de la forme C000000001, communiqué par l’entreprise) ouvre la procédure en ligne à l’invité : chacun reçoit sa lettre d’invitation, qui reprend cette liste dans cet ordre.</p>
        <div class="lr__pied">
          <button type="button" class="btn btn-outline btn-sm" (click)="ajouter()">+ Ajouter un candidat</button>
          <button type="button" class="btn btn-primary btn-sm" [disabled]="!pret() || !modifie() || saving()" (click)="enregistrer()">
            {{ saving() ? 'Enregistrement…' : 'Enregistrer la liste' }}
          </button>
          <span class="lr__aide">{{ complets() }} candidat{{ complets() > 1 ? 's' : '' }} complet{{ complets() > 1 ? 's' : '' }} sur {{ minimum }} au moins@if (liste()?.saisiLe; as le) { · enregistrée le {{ dateFr(le) }} }</span>
        </div>
      }
    </section>
  `,
  styles: `
    .lr { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.8rem 1rem; margin-bottom: 0.9rem; border: 1px solid var(--bordure); border-radius: 10px; background: var(--carte-fond); }
    .lr--manque { border-left: 3px solid var(--examen-texte); }
    .lr__tete { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem 0.75rem; }
    .lr__t { margin: 0; font-size: 0.95rem; font-weight: 500; }
    .lr__manque { color: var(--examen-texte); font-weight: 500; font-size: 0.72rem; text-transform: uppercase; }
    .lr__ref { margin-left: auto; font-size: 0.76rem; color: var(--texte-secondaire); }
    .lr__sources { border: 0; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.5rem; }
    .lr__l { font-weight: 500; font-size: 0.86rem; margin-bottom: 0.35rem; }
    .lr__opt { position: relative; display: flex; flex-direction: column; gap: 0.15rem; padding: 0.5rem 0.7rem; border: 1px solid var(--n-300); border-radius: 9px; background: var(--carte-fond); cursor: pointer; }
    .lr__opt input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .lr__opt--on { border-color: var(--menu-fond); background: var(--p-50); }
    .lr__opt:has(input:focus-visible) { outline: 2px solid var(--p-600); outline-offset: 2px; }
    .lr__opt-l { font-weight: 500; font-size: 0.86rem; }
    .lr__opt-t { font-size: 0.78rem; color: var(--texte-secondaire); line-height: 1.4; }
    .lr__cands { list-style: none; margin: 0.25rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .lr__cand { display: grid; grid-template-columns: 1.6rem 1fr auto; gap: 0.5rem; align-items: start; padding: 0.5rem 0.6rem; border: 1px solid var(--bordure); border-radius: 8px; }
    .lr__rang { padding-top: 1.45rem; color: var(--texte-secondaire); font-variant-numeric: tabular-nums; }
    .lr__champs { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.4rem 0.6rem; }
    .lr__ch { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.8rem; grid-column: span 2; }
    .lr__ch > span { font-weight: 500; }
    .lr__ch i { font-style: normal; font-weight: 400; color: var(--texte-secondaire); }
    .lr__ch--nom { grid-column: span 3; }
    .lr__ch--adr { grid-column: span 3; }
    .lr__gestes { display: flex; gap: 0.15rem; padding-top: 1.2rem; }
    .lr__pied { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .lr__aide, .lr__src { margin: 0; font-size: 0.78rem; color: var(--texte-secondaire); }
    .lr__src { font-size: 0.86rem; color: var(--texte); }
    .lr__lue { margin: 0; padding-left: 1.4rem; font-size: 0.86rem; line-height: 1.6; }
    @media (max-width: 768px) {
      .lr__champs { grid-template-columns: 1fr; }
      .lr__ch, .lr__ch--nom, .lr__ch--adr { grid-column: auto; }
      .lr__cand { grid-template-columns: 1.4rem 1fr; }
      .lr__gestes { grid-column: 2; padding-top: 0; }
    }
  `,
})
export class ListeRestreinteFiche {
  private readonly fiches = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  /** La liste servie avec la fiche (`FicheMarche.listeRestreinte`), nulle tant qu'elle n'est pas saisie. */
  readonly liste = input<ListeRestreinte | null>(null);
  /** Fiche figée ou lecteur de la Commission : la liste se lit. */
  readonly lecture = input(false);
  /** La liste vient d'être enregistrée : la page la reporte sur la fiche et relit son bilan. */
  readonly enregistre = output<ListeRestreinte>();

  readonly sources = SOURCES_SAISIES;
  readonly minimum = MINIMUM_CANDIDATS;
  readonly source = signal<SourceListeRestreinte | null>(null);
  readonly lignes = signal<Ligne[]>([]);
  readonly saving = signal(false);
  /** Erreurs servies par le serveur, par chemin (`source`, `candidats`, `candidats[0].nom`). */
  readonly erreurs = signal<Map<string, string>>(new Map());
  private cles = 0;

  readonly complets = computed(() => this.lignes().filter((c) => c.nom.trim() && c.adresse.trim()).length);
  readonly pret = computed(() => !!this.source() && this.complets() >= MINIMUM_CANDIDATS && this.complets() === this.lignes().length);
  readonly modifie = computed(() => {
    const l = this.liste();
    return this.source() !== (l?.source ?? null) || JSON.stringify(this.charge()) !== JSON.stringify(nettoyer(l?.candidats ?? []));
  });

  constructor() {
    effect(() => {
      const l = this.liste();
      this.source.set(l?.source ?? null);
      const cands = l?.candidats?.length ? l.candidats : Array.from({ length: MINIMUM_CANDIDATS }, () => ({ nom: '', adresse: '' }));
      this.lignes.set(cands.map((c) => ({ ...c, cle: ++this.cles })));
    });
  }

  libelleSource(code: string): string {
    return SOURCES_SAISIES.find((s) => s.code === code)?.libelle ?? code;
  }

  erreur(i: number, champ: string): string | null {
    return this.erreurs().get(`candidats[${i}].${champ}`) ?? null;
  }

  poser(cle: number, champ: 'nom' | 'adresse' | 'email' | 'idCandidat' | 'nif', ev: Event): void {
    const valeur = (ev.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.lignes.update((l) => l.map((c) => (c.cle === cle ? { ...c, [champ]: valeur } : c)));
  }

  ajouter(): void {
    this.lignes.update((l) => [...l, { nom: '', adresse: '', cle: ++this.cles }]);
  }

  retirer(cle: number): void {
    if (this.lignes().length <= 1) return;
    this.lignes.update((l) => l.filter((c) => c.cle !== cle));
  }

  deplacer(cle: number, pas: -1 | 1): void {
    const l = [...this.lignes()];
    const i = l.findIndex((c) => c.cle === cle);
    const j = i + pas;
    if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    this.lignes.set(l);
  }

  dateFr(iso: string): string {
    const [d, h] = iso.split('T');
    const [a, m, j] = d.split('-');
    return `${j}/${m}/${a}${h ? ' à ' + h.slice(0, 5) : ''}`;
  }

  /** Ce que le `PUT` envoie, dans l'ordre affiché, sans clé d'écran ni rang ; un champ facultatif vide part nul. */
  private charge(): CandidatRestreint[] {
    return nettoyer(this.lignes());
  }

  enregistrer(): void {
    const source = this.source();
    if (!source || this.saving() || this.lecture()) return;
    this.saving.set(true);
    this.fiches.enregistrerListeRestreinte(this.idDmc(), { source, candidats: this.charge() }).subscribe({
      next: (l) => {
        this.saving.set(false);
        this.erreurs.set(new Map());
        this.toast.success('Liste restreinte enregistrée.');
        this.enregistre.emit(l);
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        const parChamp = erreursParChamp(e);
        this.erreurs.set(parChamp);
        if (!parChamp.size) this.toast.error(e?.message ?? 'La liste n’a pas pu être enregistrée.');
      },
    });
  }
}

function nettoyer(l: CandidatRestreint[]): CandidatRestreint[] {
  return l.map((c) => ({
    nom: c.nom.trim(),
    adresse: c.adresse.trim(),
    email: c.email?.trim() || null,
    idCandidat: c.idCandidat?.trim() || null,
    nif: c.nif?.trim() || null,
  }));
}
