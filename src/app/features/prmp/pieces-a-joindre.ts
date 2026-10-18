import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ouvrirBlobSur, TYPES_PIECE, validerFichier } from '../../core/securite/fichiers-surs';
import { PieceJointeDossier, PublicationAgpm, TypePieceJointe } from '../../models';
import { DossierService, PieceJointeDossierService } from '../../services';

/** Une pièce exigée du dossier, avec les fichiers déjà déposés sous elle. */
export interface PieceAJoindre {
  type: TypePieceJointe;
  fichiers: PieceJointeDossier[];
}

/** ⚠️ 17/10 (« pieces-dmc-par-les-donnees », B1) — une pièce que l'application fournit par ses données ne se joint pas, ni ne manque. */
export function fournieParApplication(t: TypePieceJointe): boolean { return t.fourniePar === 'APPLICATION'; }

/** Obligatoire, non fournie par l'application, sans fichier. */
export function manqueA(l: PieceAJoindre): boolean { return l.type.obligatoire && !fournieParApplication(l.type) && !l.fichiers.length; }

/** Les pièces exigées, chacune avec ses fichiers ; les obligatoires manquantes d'abord. */
export function piecesAJoindre(exigees: TypePieceJointe[], deposees: PieceJointeDossier[]): PieceAJoindre[] {
  const lignes = exigees.map((type) => ({ type, fichiers: deposees.filter((p) => p.idTypePiece === type.idTypePiece) }));
  const rang = (l: PieceAJoindre) => (manqueA(l) ? 0 : 1);
  return lignes.sort((a, b) => rang(a) - rang(b));
}

/**
 * ⚠️ 15/10 — un dossier produit par la fiche DAO naît en brouillon avec ses documents ; les pièces qui ne sortent pas de la fiche
 * (descriptif technique et plans des travaux, V119 ; publications, liste restreinte…) se joignent ici. La liste est celle du serveur
 * pour CE dossier (`GET /api/dossiers/{id}/pieces-exigees`, M2) : rien n'est réécrit ici. Une pièce admet plusieurs fichiers (lot 2a) ;
 * celles produites par la fiche ne se retirent pas (409 `PIECE_PRODUITE_PAR_FICHE`).
 */
@Component({
  selector: 'app-pieces-a-joindre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="paj" aria-labelledby="paj-titre">
      <h2 class="paj__titre" id="paj-titre">Pièces du dossier</h2>
      @if (chargement()) {
        <p class="paj__aide" role="status">Chargement des pièces exigées…</p>
      } @else {
        @if (manquantes(); as n) {
          <p class="paj__aide paj__aide--manque">{{ n }} pièce(s) obligatoire(s) à joindre avant la soumission.</p>
        } @else {
          <p class="paj__aide">Toutes les pièces obligatoires sont jointes.</p>
        }
        <ul class="paj__liste">
          @for (l of lignes(); track l.type.idTypePiece) {
            <li class="paj__piece" [class.paj__piece--manque]="manque(l)">
              <div class="paj__tete">
                <span class="paj__nom">{{ l.type.libellePiece }}</span>
                @if (fournie(l.type)) {
                  <span class="paj__etat paj__etat--app">fournie par l’application</span>
                } @else if (reprise(l)) {
                  <!-- ⚠️ 18/10 — V118 : déposée sur le plan, le serveur la joint d'office à la soumission. -->
                  <span class="paj__etat paj__etat--app">déposée sur le plan, reprise d’office à la soumission</span>
                } @else {
                <span class="paj__etat">{{ l.fichiers.length ? (l.fichiers.length + ' fichier(s)') : l.type.obligatoire ? 'obligatoire, manquante' : 'facultative' }}</span>
                <label class="btn btn-outline btn-sm">
                  {{ envoi() === l.type.idTypePiece ? 'Envoi…' : l.fichiers.length ? 'Ajouter des fichiers' : 'Joindre' }}
                  <input type="file" multiple class="visually-hidden" accept=".pdf,.jpeg,.jpg,.png" [attr.aria-label]="'Joindre : ' + l.type.libellePiece"
                    [disabled]="envoi() !== null" (change)="joindre(l.type, $event)" />
                </label>
                }
              </div>
              <!-- ⚠️ 17/10 (« canevas-rapport-evaluation », B3 ; V130) — le dépôt n'a pas d'intitulé : le nom du fichier en tient lieu. -->
              @if (l.type.code === 'AUTRE_DOCUMENT') {
                <p class="paj__note">Autant de fichiers que voulu. Nommez chaque fichier d’après son contenu : son nom en tient lieu d’intitulé.</p>
              }
              @for (f of l.fichiers; track f.idPiece) {
                <div class="paj__fichier">
                  <span>{{ f.nomFichier || ('Pièce #' + f.idPiece) }}</span>
                  @if (f.idDocumentFiche) { <span class="paj__meta">produite par la fiche DAO</span> }
                  <button type="button" class="btn btn-ghost btn-sm" (click)="ouvrir(f)">Ouvrir</button>
                  @if (!f.idDocumentFiche) {
                    <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer ' + (f.nomFichier || 'le fichier')" (click)="retirer(f)">Retirer</button>
                  }
                </div>
              }
            </li>
          }
        </ul>
        @if (refus(); as r) { <p class="paj__refus" role="alert">{{ r }}</p> }
      }
    </section>
  `,
  styles: `
    .paj { margin: 1rem 0; }
    .paj__titre { font-size: 1rem; margin: 0 0 0.25rem; }
    .paj__aide { font-size: var(--text-sm); margin: 0 0 0.5rem; }
    .paj__aide--manque { color: var(--danger-text); font-weight: 600; }
    .paj__liste { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
    .paj__piece { border: 1px solid var(--n-300); border-radius: 6px; padding: 0.5rem 0.75rem; }
    .paj__piece--manque { border-left: 4px solid var(--danger-text); }
    .paj__tete { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .paj__nom { font-weight: 600; flex: 1 1 auto; }
    .paj__etat, .paj__meta { font-size: var(--text-sm); color: var(--n-500); }
    .paj__etat--app { color: var(--success-text, #15803d); font-weight: 600; }
    .paj__note { margin: 0.25rem 0 0; font-size: var(--text-sm); color: var(--n-500); }
    .paj__fichier { display: flex; align-items: center; gap: 0.5rem; font-size: var(--text-sm); margin-top: 0.25rem; padding-left: 0.5rem; }
    .paj__refus { color: var(--danger-text); font-size: var(--text-sm); }
  `,
})
export class PiecesAJoindre implements OnInit {
  private readonly dossiers = inject(DossierService);
  private readonly pieces = inject(PieceJointeDossierService);

  readonly idDossier = input.required<number>();

  readonly chargement = signal(true);
  readonly exigees = signal<TypePieceJointe[]>([]);
  readonly deposees = signal<PieceJointeDossier[]>([]);
  readonly lignes = computed(() => piecesAJoindre(this.exigees(), this.deposees()));
  readonly manquantes = computed(() => this.lignes().filter((l) => this.manque(l)).length);
  readonly fournie = fournieParApplication;
  /** ⚠️ 18/10 — la publication de l'AGPM en vigueur sur le plan de la ligne (V118), nulle sans publication. */
  readonly publicationPlan = signal<PublicationAgpm | null>(null);
  reprise(l: PieceAJoindre): boolean { return l.type.code === 'PUBLICATION_AGPM' && !l.fichiers.length && this.publicationPlan() !== null; }
  manque(l: PieceAJoindre): boolean { return manqueA(l) && !this.reprise(l); }
  readonly envoi = signal<number | null>(null);
  readonly refus = signal<string | null>(null);

  ngOnInit(): void {
    forkJoin({
      exigees: this.dossiers.piecesExigees(this.idDossier()).pipe(catchError(() => of([] as TypePieceJointe[]))),
      deposees: this.pieces.getByDossier(this.idDossier()).pipe(catchError(() => of([] as PieceJointeDossier[]))),
      // Silencieux : 404 sans publication, 403/409 hors plan.
      publication: this.dossiers.publicationAgpm(this.idDossier()).pipe(catchError(() => of(null))),
    }).subscribe(({ exigees, deposees, publication }) => {
      this.exigees.set(exigees);
      this.deposees.set(deposees);
      this.publicationPlan.set(publication);
      this.chargement.set(false);
    });
  }

  /** ⚠️ 18/10 (pilote) — plusieurs fichiers d'un coup : chacun contrôlé, puis envoyé à son tour (un fichier par dépôt). */
  joindre(type: TypePieceJointe, ev: Event): void {
    const champ = ev.target as HTMLInputElement;
    const fichiers = Array.from(champ.files ?? []);
    champ.value = '';
    if (!fichiers.length) return;
    const refus: string[] = [];
    const valides = fichiers.filter((f) => {
      const erreur = validerFichier(f, TYPES_PIECE);
      if (erreur) refus.push(fichiers.length > 1 ? `« ${f.name} » : ${erreur}` : erreur);
      return !erreur;
    });
    this.refus.set(refus.length ? refus.join(' ') : null);
    if (!valides.length) return;
    this.envoi.set(type.idTypePiece);
    const suivant = (i: number): void => {
      if (i >= valides.length) { this.envoi.set(null); return; }
      const fd = new FormData();
      fd.append('data', new Blob([JSON.stringify({ idDossier: this.idDossier(), idTypePiece: type.idTypePiece })], { type: 'application/json' }));
      fd.append('fichier', valides[i]);
      this.pieces.upload(fd).subscribe({
        next: (p) => { this.deposees.update((d) => [...d, p]); suivant(i + 1); },
        error: () => {
          this.refus.set(((this.refus() ?? '') + ` « ${valides[i].name} » n’a pas pu être joint. Réessayez.`).trim());
          suivant(i + 1);
        },
      });
    };
    suivant(0);
  }

  retirer(p: PieceJointeDossier): void {
    if (p.idPiece == null) return;
    this.refus.set(null);
    this.pieces.supprimer(p.idPiece).subscribe({
      next: () => this.deposees.update((d) => d.filter((x) => x.idPiece !== p.idPiece)),
      error: (e: ApiError) =>
        this.refus.set(codeErreur(e) === 'PIECE_PRODUITE_PAR_FICHE' ? 'Cette pièce est produite par la fiche DAO : elle se corrige dans la fiche.' : 'Le fichier n’a pas pu être retiré.'),
    });
  }

  ouvrir(p: PieceJointeDossier): void {
    if (p.idPiece == null) return;
    this.pieces.telecharger(p.idPiece).subscribe((blob) => ouvrirBlobSur(blob));
  }
}
