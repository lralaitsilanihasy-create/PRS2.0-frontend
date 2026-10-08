import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { ApiError, codeErreur, erreursParChamp } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { SousCritere } from '../../../models';
import { FicheMarcheService } from '../../../services/fiche-marche.services';
import { empreinte, ListeASauver } from './liste-a-sauver';

/** Un critère technique de la fiche (`B06-TP-02` à `-06`) : son libellé et ses points, lus dans la fiche. */
export interface CritereTechnique {
  code: string;
  libelle: string;
  points: number | null;
}

interface Ligne extends SousCritere {
  cle: number;
}

/** Les points des sous-critères d'un critère : leur somme, et si elle tient les points du critère. */
export function bilanCritere(c: CritereTechnique, lignes: SousCritere[]): { somme: number; ok: boolean } {
  const l = lignes.filter((x) => x.critere === c.code);
  const somme = Math.round(l.reduce((s, x) => s + (Number(x.points) || 0), 0) * 100) / 100;
  return { somme, ok: !l.length || (c.points != null && somme === c.points) };
}

/**
 * ⚠️ **Lot 3 PI, tranche PI-a (V84)** — les **sous-critères** des critères techniques d'une fiche de prestations intellectuelles
 * (arbitrage Q3 du pilote : saisis dans la fiche). Chaque critère `B06-TP-02` à `-06` peut se détailler en sous-critères pondérés
 * (un barème par expert pour le personnel clé, par exemple), dont la somme fait ses points ; un critère sans sous-critère se note
 * globalement. La liste se remplace en bloc ; elle se fige à la validation (le bilan bloque `SOUS_CRITERES_POINTS`).
 */
@Component({
  selector: 'app-fiche-sous-criteres',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="fsc" aria-labelledby="fsc-titre">
      <h3 id="fsc-titre" class="fsc__titre">Sous-critères de l’évaluation technique</h3>
      <p class="fsc__aide">
        Facultatif : un critère peut se détailler en sous-critères, dont la somme des points doit faire ceux du critère. La
        commission notera chaque sous-critère ; un critère sans sous-critère est noté globalement.
      </p>
      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des sous-critères…</p>
      } @else {
        @for (c of criteres(); track c.code) {
          @let b = bilan(c);
          <div class="fsc__critere">
            <div class="fsc__tete">
              <span class="cnm-mono fsc__code">{{ c.code }}</span>
              <strong>{{ c.libelle }}</strong>
              <span class="fsc__pts">{{ c.points != null ? c.points + ' points' : 'points à saisir' }}</span>
              @if (lignesDe(c.code).length) {
                <span class="fsc__somme" [class.fsc__ko]="!b.ok">sous-critères : {{ b.somme }}{{ b.ok ? '' : ' — doit faire ' + (c.points ?? '?') }}</span>
              }
            </div>
            @for (l of lignesDe(c.code); track l.cle; let i = $index) {
              <div class="fsc__ligne">
                <span class="fsc__lettre" aria-hidden="true">{{ lettre(i) }})</span>
                <input class="form-control" [attr.aria-label]="'Sous-critère ' + lettre(i) + ' de ' + c.libelle" [value]="l.libelle" [disabled]="lecture()" (input)="poser(l.cle, 'libelle', valeur($event))" />
                <input class="form-control fsc__points" type="number" min="0" step="0.5" [attr.aria-label]="'Points du sous-critère ' + lettre(i) + ' de ' + c.libelle" [value]="l.points" [disabled]="lecture()" (input)="poser(l.cle, 'points', valeur($event))" />
                @if (!lecture()) {
                  <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer le sous-critère ' + lettre(i) + ' de ' + c.libelle" (click)="retirer(l.cle)">✕</button>
                }
                @if (erreur(l.cle); as m) { <span class="form-error fsc__err">{{ m }}</span> }
              </div>
            }
            @if (!lecture()) {
              <button type="button" class="btn btn-outline btn-sm fsc__ajout" (click)="ajouter(c.code)">Ajouter un sous-critère</button>
            }
          </div>
        }
        @if (refus(); as r) { <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div> }
        @if (!lecture()) {
          <div class="fsc__actions">
            <button type="button" class="btn btn-primary btn-sm" [disabled]="enregistrement() || !modifie()" (click)="enregistrer()">{{ enregistrement() ? 'Enregistrement…' : 'Enregistrer les sous-critères' }}</button>
            @if (!toutJuste()) { <span class="text-sm fsc__ko">Un critère détaillé doit totaliser ses points : la validation le bloquera.</span> }
          </div>
        }
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .fsc { border-top: 1px solid var(--n-200); margin-top: 1rem; padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .fsc__titre { margin: 0; font-size: 1rem; }
    .fsc__aide { margin: 0; font-size: var(--text-sm); color: var(--n-500); }
    .fsc__critere { border: 1px solid var(--n-200); border-radius: var(--radius-md, 6px); padding: 0.6rem 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .fsc__tete { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.6rem; }
    .fsc__code { font-size: var(--text-sm); color: var(--n-500); }
    .fsc__pts, .fsc__somme { font-size: var(--text-sm); color: var(--n-500); }
    .fsc__ko { color: var(--danger-700, #b42318); font-weight: 600; }
    .fsc__ligne { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
    .fsc__ligne .form-control { flex: 1 1 18rem; }
    .fsc__ligne .fsc__points { flex: 0 0 7rem; }
    .fsc__lettre { width: 1.5rem; color: var(--n-500); }
    .fsc__err { flex-basis: 100%; }
    .fsc__ajout { align-self: flex-start; }
    .fsc__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
  `,
})
export class FicheSousCriteres implements ListeASauver {
  private readonly fiches = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  readonly criteres = input.required<CritereTechnique[]>();
  /** Fiche figée ou lecteur de la Commission. */
  readonly lecture = input<boolean>(false);
  /** Les sous-critères viennent d'être enregistrés : la page relit son bilan. */
  readonly enregistre = output<void>();

  readonly chargement = signal(true);
  readonly enregistrement = signal(false);
  readonly lignes = signal<Ligne[]>([]);
  readonly refus = signal<string | null>(null);
  private readonly erreurs = signal<Map<string, string>>(new Map());
  private readonly reference = signal('[]');
  private cles = 0;

  readonly modifie = computed(() => empreinte(this.charge()) !==this.reference());
  readonly toutJuste = computed(() => this.criteres().every((c) => bilanCritere(c, this.lignes()).ok));

  constructor() {
    effect(() => {
      const id = this.idDmc();
      this.chargement.set(true);
      this.fiches.sousCriteres(id).subscribe({
        next: (l) => this.recevoir(l),
        error: () => this.recevoir([]),
      });
    });
  }

  private recevoir(l: SousCritere[]): void {
    this.lignes.set([...l].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).map((x) => ({ critere: x.critere, libelle: x.libelle, points: x.points, cle: ++this.cles })));
    this.reference.set(empreinte(this.charge()));
    this.chargement.set(false);
  }

  /** Le corps envoyé : dans l'ordre des critères, puis de saisie. */
  private charge(): SousCritere[] {
    const ordre = this.criteres().map((c) => c.code);
    return [...this.lignes()]
      .sort((a, b) => ordre.indexOf(a.critere) - ordre.indexOf(b.critere))
      .map(({ critere, libelle, points }) => ({ critere, libelle: libelle.trim(), points: Number(points) || 0 }));
  }

  lignesDe(code: string): Ligne[] {
    return this.lignes().filter((l) => l.critere === code);
  }

  bilan(c: CritereTechnique): { somme: number; ok: boolean } {
    return bilanCritere(c, this.lignes());
  }

  lettre(i: number): string {
    return String.fromCharCode(97 + i);
  }

  valeur(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }

  ajouter(critere: string): void {
    this.lignes.update((l) => [...l, { critere, libelle: '', points: 0, cle: ++this.cles }]);
  }

  retirer(cle: number): void {
    this.lignes.update((l) => l.filter((x) => x.cle !== cle));
  }

  poser(cle: number, champ: 'libelle' | 'points', v: string): void {
    this.lignes.update((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: champ === 'points' ? Number(v) : v } : x)));
  }

  /** L'erreur du serveur pour une ligne (`sousCriteres[i].libelle`…), i étant son rang dans le corps envoyé. */
  erreur(cle: number): string | null {
    const ordre = this.criteres().map((c) => c.code);
    const i = [...this.lignes()].sort((a, b) => ordre.indexOf(a.critere) - ordre.indexOf(b.critere)).findIndex((x) => x.cle === cle);
    const e = this.erreurs();
    return e.get(`sousCriteres[${i}].libelle`) ?? e.get(`sousCriteres[${i}].points`) ?? e.get(`sousCriteres[${i}].critere`) ?? null;
  }

  enregistrer(): void {
    if (!this.enregistrement()) void this.envoyer(true);
  }

  /** ⚠️ Avant de quitter le bloc (`ListeASauver`) : enregistrer les sous-critères modifiés. */
  async sauver(): Promise<boolean> {
    if (this.lecture() || !this.modifie()) return true;
    return this.envoyer(false);
  }

  /** Le `PUT` ; l'abonnement met l'écran à jour à la réponse même, la promesse dit l'issue. */
  private envoyer(annoncer: boolean): Promise<boolean> {
    this.enregistrement.set(true);
    this.refus.set(null);
    this.erreurs.set(new Map());
    return new Promise((resoudre) =>
      this.fiches.enregistrerSousCriteres(this.idDmc(), this.charge()).subscribe({
        next: (l) => {
          this.enregistrement.set(false);
          this.recevoir(l);
          if (annoncer) this.toast.success('Sous-critères enregistrés.');
          this.enregistre.emit();
          resoudre(true);
        },
        error: (e: ApiError | HttpErrorResponse) => {
          this.enregistrement.set(false);
          this.refuser(e);
          resoudre(false);
        },
      }),
    );
  }

  private refuser(e: ApiError | HttpErrorResponse): void {
    const champs = erreursParChamp(e);
    if (champs.size) {
      this.erreurs.set(champs);
      this.refus.set('Des sous-critères sont incomplets : voir sous chaque ligne.');
      return;
    }
    const code = codeErreur(e);
    this.refus.set(
      code === 'FICHE_VALIDEE'
        ? 'La fiche est validée : ouvrez une révision pour modifier les sous-critères.'
        : code === 'SOUS_CRITERES_HORS_PERIMETRE'
          ? 'Les sous-critères ne concernent que les prestations intellectuelles.'
          : 'L’enregistrement a échoué. Réessayez.',
    );
  }
}
