import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { Dossier, FicheRattachable } from '../../../models';
import { DossierService } from '../../../services';
import { FicheMarcheService } from '../../../services/fiche-marche.services';
import { Icone } from '../../../shared/ui/icone';

/**
 * ⚠️ **Fiche marché d'un dossier d'appel d'offres** (lot 1b, demande `docs/demande-backend-2026-09-23-fiche-marche-dossier.md`).
 *
 * Le chemin normal est l'inverse de cet encart : la fiche **produit** le dossier (étape 7 de `/prmp/dao/:idDmc`),
 * et l'encart n'a plus qu'à montrer ce qui est lié. Le **rattachement** offert ici est le **secours** des dossiers
 * créés avant la liaison — le n° 100332 du pilote — et ne s'ouvre donc qu'à la PRMP ou à son UGPM, sur un dossier
 * `DAO` resté en BROUILLON. Un dossier déjà transmis à la Commission ne se rattache plus : le serveur refuse
 * (`DOSSIER_NON_BROUILLON`) et l'écran n'en donne pas l'occasion.
 */
@Component({
  selector: 'app-fiche-marche-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icone],
  template: `
    <section class="fmd" aria-labelledby="fmd-titre">
      <h2 class="fmd__titre" id="fmd-titre"><app-icone nom="file" [taille]="16" />Fiche marché</h2>

      @if (dossier().ficheMarche; as f) {
        <p class="fmd__ligne">
          <span class="fmd__etat" [class.fmd__etat--ok]="f.statut === 'VALIDEE'">{{ f.statut === 'VALIDEE' ? 'Validée' : 'Brouillon' }}</span>
          <span>version {{ f.version }}</span>
          @if (f.nbAttendus) { <span>· {{ f.nbSaisis ?? 0 }} sur {{ f.nbAttendus }} informations</span> }
          @if (f.refeDossierPpm) { <span class="fmd__ppm">· ligne du plan {{ f.refeDossierPpm }}</span> }
        </p>
        @if (f.designationMarche) { <p class="fmd__obj">{{ f.designationMarche }}</p> }
        <div class="fmd__actions">
          @if (peutOuvrir()) { <a class="btn btn-secondary btn-sm" [routerLink]="['/prmp/dao', f.idDmc]">Ouvrir la fiche</a> }
          @if (peutRattacher()) { <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="detacher()">Détacher</button> }
        </div>
      } @else if (peutRattacher()) {
        <p class="fmd__vide">Aucune fiche marché n'est rattachée à ce dossier. Rattachez celle que vous avez déjà validée, ou préparez-en une depuis la ligne du plan de passation.</p>
        @if (!choix()) {
          <div class="fmd__actions">
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="occupe()" (click)="ouvrirChoix()">Rattacher une fiche marché</button>
            <a class="btn btn-outline btn-sm" routerLink="/prmp/dao">Préparer une fiche</a>
          </div>
        } @else {
          <div class="fmd__choix">
            @if (chargement()) {
              <p class="fmd__vide" role="status">Recherche des fiches validées…</p>
            } @else if (rattachables().length) {
              <ul class="fmd__liste">
                @for (f of rattachables(); track f.idDmc) {
                  <li>
                    <span class="fmd__liste-obj">{{ f.designationMarche || ('ligne ' + f.idDetail) }}</span>
                    <span class="fmd__ppm">{{ f.refeDossierPpm }} · version {{ f.version }}</span>
                    <button type="button" class="btn btn-secondary btn-sm" [disabled]="occupe()" (click)="rattacher(f)">Rattacher</button>
                  </li>
                }
              </ul>
            } @else {
              <p class="fmd__vide">Aucune fiche validée n'est disponible : une fiche se rattache une fois <strong>validée</strong>, et une seule fois.</p>
            }
            <button type="button" class="fmd__annuler" (click)="choix.set(false)">Annuler</button>
          </div>
        }
      } @else {
        <p class="fmd__vide">Aucune fiche marché n'est rattachée à ce dossier.</p>
      }
    </section>
  `,
  styles: `
    .fmd { background: #fff; border: 1px solid var(--n-200); border-radius: 12px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .fmd__titre { display: flex; align-items: center; gap: 0.4rem; margin: 0; font-size: 0.95rem; }
    .fmd__ligne { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; margin: 0; font-size: 0.84rem; color: var(--n-600); }
    .fmd__etat { padding: 0.05rem 0.5rem; border-radius: 999px; background: var(--n-100); color: var(--n-600); font-weight: 700; font-size: 0.74rem; }
    .fmd__etat--ok { background: #d1fae5; color: #047857; }
    .fmd__ppm { color: var(--n-500); font-size: 0.8rem; }
    .fmd__obj { margin: 0; font-weight: 600; font-size: 0.88rem; }
    .fmd__vide { margin: 0; font-size: 0.84rem; color: var(--n-500); }
    .fmd__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.15rem; }
    .fmd__choix { border-top: 1px dashed var(--n-200); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .fmd__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .fmd__liste li { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; font-size: 0.84rem; }
    .fmd__liste-obj { font-weight: 600; flex: 1; min-width: 12rem; }
    .fmd__annuler { align-self: flex-start; background: none; border: 0; color: var(--p-700); font: 600 0.82rem var(--font-base); cursor: pointer; text-decoration: underline; }
  `,
})
export class FicheMarcheDossier {
  readonly dossier = input.required<Dossier>();
  /** Le dossier a changé (rattaché ou détaché) : la page le relit. */
  readonly liaisonChangee = output<void>();

  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dossiers = inject(DossierService);
  private readonly fiches = inject(FicheMarcheService);

  readonly choix = signal(false);
  readonly chargement = signal(false);
  readonly occupe = signal(false);
  readonly rattachables = signal<FicheRattachable[]>([]);

  private readonly domaine = computed(() => this.auth.role() === 'PRMP' || this.auth.role() === 'UGPM');
  /** La fiche s'ouvre depuis l'espace PRMP : le lien n'est proposé qu'à qui peut l'atteindre. */
  readonly peutOuvrir = computed(() => this.domaine());
  /** Rattacher ou détacher : secours réservé au domaine PRMP, sur un dossier encore en brouillon. */
  readonly peutRattacher = computed(() => this.domaine() && this.dossier().statut === 'BROUILLON');

  ouvrirChoix(): void {
    this.choix.set(true);
    this.chargement.set(true);
    this.fiches.rattachables().subscribe({
      next: (l) => {
        this.rattachables.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.rattachables.set([]);
        this.chargement.set(false);
      },
    });
  }

  rattacher(f: FicheRattachable): void {
    if (this.occupe()) return;
    this.occupe.set(true);
    this.dossiers.rattacherFicheMarche(this.dossier().idDossier, f.idDmc).subscribe({
      next: () => {
        this.occupe.set(false);
        this.choix.set(false);
        this.toast.success('Fiche marché rattachée à ce dossier.');
        this.liaisonChangee.emit();
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.toast.error(e.message || 'La fiche n’a pas pu être rattachée.');
      },
    });
  }

  detacher(): void {
    if (this.occupe()) return;
    this.occupe.set(true);
    this.dossiers.detacherFicheMarche(this.dossier().idDossier).subscribe({
      next: () => {
        this.occupe.set(false);
        this.toast.success('Fiche marché détachée. Le dossier reste en brouillon.');
        this.liaisonChangee.emit();
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.toast.error(e.message || 'La fiche n’a pas pu être détachée.');
      },
    });
  }
}
