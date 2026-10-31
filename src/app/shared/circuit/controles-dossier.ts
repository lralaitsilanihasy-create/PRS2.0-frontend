import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { telechargerBlob } from '../../core/securite/fichiers-surs';
import { ControleCorps, ControleResultat, PointsCtrl, ResultatControle } from '../../models';
import { ControleService } from '../../services';
import { LIBELLES_RESULTAT, bilanControles, controlesEffectifs, texteValeurs } from './controles-libelles';

/** La saisie d'un résultat (levée d'un contrôle existant, ou nouveau contrôle B). */
interface Saisie {
  /** Le contrôle levé (sa règle est reprise) ; `null` pour un nouveau contrôle. */
  cible: ControleResultat | null;
  idPointCtrl: number | null;
  regle: string;
  reference: string;
  libelle: string;
  resultat: ResultatControle;
  observation: string;
  bloquant: boolean;
}

/**
 * ⚠️ Manuel révisé, R5 (V105, 13/10) — les **contrôles d'un dossier** : les règles automatiques du serveur (évaluées à la soumission,
 * sous le n° de soumission des instantanés) et les contrôles **B** du Membre. Lecture pour tous ceux qui lisent le dossier ; en mode
 * `editable` (Membre attributaire, examen modifiable), le Membre **lève** une non-conformité (conforme ou sans objet, avec son
 * observation — par règle, le dernier résultat posé fait foi) et **ajoute** un contrôle (point de grille ou règle libre). L'hôte
 * possède la liste et la relit à `(pose)` ; le PDF de synthèse s'exporte pour l'archivage avec le PV.
 */
@Component({
  selector: 'app-controles-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let b = bilan();
    <div class="cd__tete">
      <p class="cd__bilan">
        @if (b.total) {
          <span class="badge badge-success">{{ b.conformes }} conforme(s)</span>
          <span class="badge" [class.badge-danger]="b.nonConformes" [class.badge-neutral]="!b.nonConformes">{{ b.nonConformes }} non conforme(s)@if (b.bloquants) { , dont {{ b.bloquants }} bloquant(s) }</span>
          <span class="badge badge-neutral">{{ b.sansObjet }} sans objet</span>
        } @else {
          <span class="text-muted">Aucun contrôle enregistré pour ce dossier{{ editable() ? ' — les contrôles automatiques s’écrivent à la soumission ; vous pouvez poser les vôtres ci-dessous.' : '.' }}</span>
        }
      </p>
      <span class="cd__actions">
        @if (b.total) {
          <button type="button" class="btn btn-sm btn-outline" [disabled]="pdfEnCours()" (click)="exporterPdf()">{{ pdfEnCours() ? 'Export…' : 'Exporter en PDF' }}</button>
        }
        @if (editable()) {
          <button type="button" class="btn btn-sm btn-secondary" [disabled]="!!saisie()" (click)="ouvrirAjout()">+ Ajouter un contrôle</button>
        }
      </span>
    </div>

    @if (effectifs().length) {
      <div class="table-responsive">
        <table class="cnm-table cd__table">
          <thead>
            <tr>
              <th scope="col">Référence</th><th scope="col">Contrôle</th><th scope="col">Résultat</th>
              <th scope="col">Constat / observation</th><th scope="col">Par</th>
              @if (editable()) { <th scope="col"><span class="cnm-sr-only">Action</span></th> }
            </tr>
          </thead>
          <tbody>
            @for (c of effectifs(); track c.idControle) {
              <tr [class.cd__nc]="c.resultat === 'NON_CONFORME'">
                <td class="cd__ref">{{ c.reference || '—' }}</td>
                <td>{{ c.libelle || c.regle }}<span class="cd__regle cnm-mono">{{ c.regle }}</span></td>
                <td>
                  <span class="badge" [class.badge-success]="c.resultat === 'CONFORME'" [class.badge-danger]="c.resultat === 'NON_CONFORME'" [class.badge-neutral]="c.resultat === 'NON_APPLICABLE'">{{ libelle(c.resultat) }}</span>
                  @if (c.bloquant) { <span class="badge badge-warning">bloquant</span> }
                </td>
                <td class="cd__valeurs">
                  @if (c.observation) { <span>{{ c.observation }}</span> }
                  @if (valeurs(c); as v) { <span class="cd__constat">{{ v }}</span> }
                </td>
                <td class="cd__par">{{ c.auteur === 'SERVEUR' ? 'automatique' : (c.auteur || '—') }}@if (c.dateControle) { <br /><span class="text-muted">{{ quand(c.dateControle) }}</span> }</td>
                @if (editable()) {
                  <td><button type="button" class="btn btn-sm btn-outline" [disabled]="!!saisie()" (click)="ouvrirLevee(c)">{{ c.resultat === 'NON_CONFORME' ? 'Lever…' : 'Reposer…' }}</button></td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (historique().length > effectifs().length) {
        <details class="cd__hist">
          <summary>Historique complet ({{ historique().length }} résultat(s))</summary>
          <ul>
            @for (c of historique(); track c.idControle) {
              <li>{{ quand(c.dateControle) }} · {{ c.reference || c.regle }} · {{ libelle(c.resultat) }} · {{ c.auteur === 'SERVEUR' ? 'automatique' : c.auteur }}{{ c.observation ? ' — ' + c.observation : '' }}</li>
            }
          </ul>
        </details>
      }
    }

    @if (saisie(); as s) {
      <form class="cd__form" (submit)="poser($event)" [attr.aria-label]="s.cible ? 'Lever ou reposer le contrôle ' + (s.cible.reference || s.cible.regle) : 'Ajouter un contrôle'">
        <p class="cd__form-titre">{{ s.cible ? 'Contrôle ' + (s.cible.reference || s.cible.regle) + ' — ' + (s.cible.libelle || '') : 'Nouveau contrôle du Membre' }}</p>
        @if (!s.cible) {
          <div class="cd__ligne">
            <label class="form-group cd__champ">
              <span class="form-label">Point de la grille</span>
              <select class="form-control" [value]="s.idPointCtrl ?? ''" (change)="poserPoint($any($event.target).value)">
                <option value="">— règle libre —</option>
                @for (p of points(); track p.idPointCtrl) { <option [value]="p.idPointCtrl">{{ p.libelPointCtrl || 'Point #' + p.idPointCtrl }}</option> }
              </select>
            </label>
            @if (s.idPointCtrl == null) {
              <label class="form-group cd__champ"><span class="form-label">Règle (code)</span><input class="form-control" type="text" [value]="s.regle" (input)="modifier('regle', $any($event.target).value)" placeholder="ex. PIECE_ILLISIBLE" /></label>
              <label class="form-group cd__champ"><span class="form-label">Référence du manuel</span><input class="form-control" type="text" [value]="s.reference" (input)="modifier('reference', $any($event.target).value)" placeholder="ex. 2-III-A P5" /></label>
              <label class="form-group cd__champ cd__champ--large"><span class="form-label">Libellé</span><input class="form-control" type="text" [value]="s.libelle" (input)="modifier('libelle', $any($event.target).value)" /></label>
            }
          </div>
        }
        <div class="cd__ligne">
          <fieldset class="form-group cd__champ">
            <legend class="form-label">Résultat</legend>
            <div class="cd__opts">
              @for (r of RESULTATS; track r) {
                <label class="cd__opt"><input type="radio" name="cd-resultat" [value]="r" [checked]="s.resultat === r" (change)="modifier('resultat', r)" /> {{ libelle(r) }}</label>
              }
            </div>
          </fieldset>
          <label class="cd__opt cd__bloquant"><input type="checkbox" [checked]="s.bloquant" (change)="modifier('bloquant', $any($event.target).checked)" /> bloquant</label>
        </div>
        <label class="form-group">
          <span class="form-label">Observation{{ s.resultat === 'NON_CONFORME' ? '' : ' (facultative)' }}</span>
          <textarea class="form-control" rows="2" [value]="s.observation" (input)="modifier('observation', $any($event.target).value)"></textarea>
        </label>
        @if (erreur(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
        <div class="cd__form-actions">
          <button type="submit" class="btn btn-sm btn-primary" [disabled]="envoi() || !complete()">{{ envoi() ? 'Enregistrement…' : 'Enregistrer le résultat' }}</button>
          <button type="button" class="btn btn-sm btn-outline" [disabled]="envoi()" (click)="fermer()">Annuler</button>
        </div>
      </form>
    }
  `,
  styles: `
    :host { display: block; font-size: var(--text-sm); }
    .cd__tete { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
    .cd__bilan { margin: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
    .cd__actions { display: flex; gap: 0.4rem; }
    /* La table commune met ses cellules sur une ligne : ici les libellés et constats se replient, chaque colonne garde sa place. */
    .cd__table { width: 100%; table-layout: fixed; }
    .cd__table th:nth-child(1) { width: 8rem; }
    .cd__table th:nth-child(3) { width: 9.5rem; }
    .cd__table th:nth-child(5) { width: 8.5rem; }
    .cd__table th:nth-child(6) { width: 6.5rem; }
    .cd__table td { vertical-align: top; white-space: normal; overflow-wrap: break-word; }
    .cd__table td.cd__ref { font-weight: 500; }
    .cd__regle { display: block; font-size: var(--text-xs); color: var(--n-400); overflow-wrap: anywhere; }
    .cd__nc td:first-child { border-left: 3px solid var(--danger-700, var(--retard-texte)); }
    .cd__valeurs span { display: block; }
    .cd__constat { font-size: var(--text-xs); color: var(--n-500); }
    .cd__table td.cd__par { white-space: nowrap; }
    .cd__hist { margin-top: 0.5rem; color: var(--n-500); }
    .cd__hist ul { margin: 0.3rem 0 0 1rem; padding: 0; }
    .cd__form { margin-top: 0.8rem; padding: 0.75rem; border: 1px solid var(--n-300); border-radius: 6px; background: var(--n-50); }
    .cd__form-titre { margin: 0 0 0.5rem; font-weight: 500; }
    .cd__ligne { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; align-items: flex-end; }
    .cd__champ { flex: 1 1 12rem; margin-bottom: 0.4rem; }
    .cd__champ--large { flex-basis: 100%; }
    .cd__opts { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; }
    .cd__opt { display: inline-flex; align-items: center; gap: 0.3rem; }
    .cd__bloquant { margin-bottom: 0.6rem; }
    .cd__form-actions { display: flex; gap: 0.4rem; margin-top: 0.4rem; }
  `,
})
export class ControlesDossier {
  readonly idDossier = input.required<number>();
  readonly controles = input.required<ControleResultat[]>();
  /** Le Membre attributaire, examen modifiable : lever et ajouter. */
  readonly editable = input(false);
  /** Les points de la grille du dossier, proposés pour un contrôle B. */
  readonly points = input<PointsCtrl[]>([]);
  /** Après un résultat posé : l'hôte relit la liste. */
  readonly pose = output<ControleResultat>();

  private readonly service = inject(ControleService);
  private readonly toast = inject(ToastService);

  readonly RESULTATS: readonly ResultatControle[] = ['CONFORME', 'NON_CONFORME', 'NON_APPLICABLE'];
  readonly libelle = (r: ResultatControle): string => LIBELLES_RESULTAT[r] ?? r;
  readonly effectifs = computed(() => controlesEffectifs(this.controles()));
  readonly historique = computed(() => [...this.controles()].sort((a, b) => (b.dateControle ?? '').localeCompare(a.dateControle ?? '') || b.idControle - a.idControle));
  readonly bilan = computed(() => bilanControles(this.controles()));

  readonly saisie = signal<Saisie | null>(null);
  readonly envoi = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly pdfEnCours = signal(false);
  readonly complete = computed(() => {
    const s = this.saisie();
    if (!s) return false;
    if (s.resultat === 'NON_CONFORME' && !s.observation.trim()) return false;
    if (s.cible) return true;
    return s.idPointCtrl != null || !!s.regle.trim();
  });

  valeurs(c: ControleResultat): string {
    return texteValeurs(c.valeurs);
  }

  quand(iso: string | null): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso ?? '');
    return m ? (m[4] ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : `${m[3]}/${m[2]}/${m[1]}`) : '';
  }

  ouvrirLevee(c: ControleResultat): void {
    this.erreur.set(null);
    this.saisie.set({
      cible: c,
      idPointCtrl: c.idPointCtrl,
      regle: c.regle,
      reference: c.reference ?? '',
      libelle: c.libelle ?? '',
      resultat: c.resultat === 'NON_CONFORME' ? 'CONFORME' : 'NON_CONFORME',
      observation: '',
      bloquant: c.bloquant,
    });
  }

  ouvrirAjout(): void {
    this.erreur.set(null);
    this.saisie.set({ cible: null, idPointCtrl: null, regle: '', reference: '', libelle: '', resultat: 'NON_CONFORME', observation: '', bloquant: false });
  }

  fermer(): void {
    this.saisie.set(null);
    this.erreur.set(null);
  }

  poserPoint(valeur: string): void {
    const s = this.saisie();
    if (!s) return;
    const id = valeur ? Number(valeur) : null;
    const p = id != null ? this.points().find((x) => x.idPointCtrl === id) : null;
    this.saisie.set({ ...s, idPointCtrl: id, libelle: p ? (p.libelPointCtrl ?? '') : s.libelle });
  }

  modifier<K extends keyof Saisie>(champ: K, valeur: Saisie[K]): void {
    const s = this.saisie();
    if (s) this.saisie.set({ ...s, [champ]: valeur });
  }

  poser(evt: Event): void {
    evt.preventDefault();
    const s = this.saisie();
    if (!s || !this.complete()) return;
    const corps: ControleCorps = {
      resultat: s.resultat,
      observation: s.observation.trim() || null,
      bloquant: s.bloquant,
      ...(s.idPointCtrl != null ? { idPointCtrl: s.idPointCtrl } : { regle: s.regle.trim() }),
      reference: s.reference.trim() || null,
      libelle: s.libelle.trim() || null,
    };
    this.envoi.set(true);
    this.erreur.set(null);
    this.service.poser(this.idDossier(), corps).subscribe({
      next: (r) => {
        this.envoi.set(false);
        this.saisie.set(null);
        this.toast.success(s.cible ? 'Résultat posé : le dernier résultat de la règle fait foi.' : 'Contrôle enregistré.');
        this.pose.emit(r);
      },
      error: (e: ApiError) => {
        this.envoi.set(false);
        const detail = e.fieldErrors ? Object.values(e.fieldErrors).join(' ') : '';
        this.erreur.set(codeErreur(e) === 'EXAMEN_ABSENT' ? "L'examen n'est pas ouvert : enregistrez d'abord une étape de l'examen, puis posez le contrôle." : detail || e.message || 'Le contrôle n’a pas pu être enregistré.');
      },
    });
  }

  exporterPdf(): void {
    const id = this.idDossier();
    this.pdfEnCours.set(true);
    this.service.pdf(id).subscribe({
      next: (blob) => {
        this.pdfEnCours.set(false);
        telechargerBlob(blob, `CONTROLES_${id}.pdf`);
      },
      error: () => {
        this.pdfEnCours.set(false);
        this.toast.error("L'export PDF des contrôles a échoué.");
      },
    });
  }
}
