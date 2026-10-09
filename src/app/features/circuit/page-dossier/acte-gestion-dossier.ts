import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { validerFichier } from '../../../core/securite/fichiers-surs';
import { ActeGestion, DemandeActe, Dossier, PieceJointeDossier, TypePieceJointe } from '../../../models';
import { ActesGestionService, DossierService, PieceJointeDossierService } from '../../../services';
import { ActeFormulaire, demandeVide } from './acte-formulaire';
import { LIBELLES_CATEGORIE_MARCHE, ariary, dateCourte, libelleActe, manquesDemande, messageRefusActe } from './actes-gestion-modele';
import { LienDossier } from './lien-dossier';

/**
 * ⚠️ **L'acte de gestion d'un dossier `DGC`** (manuel de contrôle, tranche M5a — V98). Ce que l'acte déclare et son marché ; en
 * **brouillon**, pour la PRMP ou l'UGPM : la modification des déclarations (`PUT`), le dépôt des **pièces exigées** de son sous-type
 * (un acte né du marché n'a pas d'autre écran de saisie) et, pour la PRMP, la **soumission** — où le serveur rejoue les garde-fous.
 */
@Component({
  selector: 'app-acte-gestion-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ActeFormulaire],
  template: `
    @if (acte(); as a) {
      <section class="agd" aria-labelledby="agd-titre">
        <h2 class="agd__titre" id="agd-titre">{{ libelle(a) }}</h2>
        <p class="agd__ligne">
          <span>Marché : @if (lien(a.idDossierMarche); as l) { <a [routerLink]="l">ouvrir le dossier du marché</a> } @else { n° {{ a.idDossierMarche }} }</span>
          @if (a.sousType === 'AVN') { <span>· montant <strong>{{ ariary(a.montantHt) }}</strong> HT</span> }
          @if (a.montantInitialHt != null) { <span>· montant initial déclaré {{ ariary(a.montantInitialHt) }} HT</span> }
          @if (a.categorie) { <span>· {{ libellesCategorie[a.categorie] }}</span> }
          @if (a.dateReceptionProvisoire) { <span>· réception provisoire le {{ jj(a.dateReceptionProvisoire) }}</span> }
          @if (a.dateReceptionDefinitive) { <span>· réception définitive le {{ jj(a.dateReceptionDefinitive) }}</span> }
          @if (a.dateSolde) { <span>· soldé le {{ jj(a.dateSolde) }}</span> }
        </p>

        @if (editable()) {
          @if (edition()) {
            <div class="agd__bloc">
              <app-acte-formulaire [(demande)]="demande" [sousTypeFige]="true" [montantInitialConnu]="a.montantInitialHt == null" [categorieConnue]="a.categorie == null" [desactive]="occupe()" />
              @if (manquesEdition().length) { <ul class="agd__manques">@for (x of manquesEdition(); track x) { <li>{{ x }}</li> }</ul> }
              <div class="agd__actions">
                <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="edition.set(false)">Annuler</button>
                <button type="button" class="btn btn-primary btn-sm" [disabled]="occupe() || manquesEdition().length > 0" (click)="enregistrer()">Enregistrer les déclarations</button>
              </div>
            </div>
          } @else {
            <div><button type="button" class="btn btn-outline btn-sm" (click)="ouvrirEdition()">Modifier les déclarations</button></div>
          }

          <div class="agd__bloc">
            <h3 class="agd__sous">Pièces de l’acte</h3>
            @if (exigees().length) {
              <ul class="agd__pieces">
                @for (t of exigees(); track t.idTypePiece) {
                  <li class="agd__piece">
                    <span class="agd__piece-lib">{{ t.libellePiece }}<span class="agd__piece-etat">{{ jointe(t) ? ' — jointe' : t.obligatoire ? ' — obligatoire' : ' — facultative' }}</span></span>
                    <input type="file" accept=".pdf,.jpeg,.jpg,.png" [disabled]="occupe()" [attr.aria-label]="'Joindre : ' + t.libellePiece" (change)="joindre(t, $event)" />
                  </li>
                }
              </ul>
            } @else {
              <p class="agd__vide">Aucune pièce n’est exigée pour cet acte.</p>
            }
          </div>

          @if (refus(); as r) { <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div> }
          @if (estPrmp()) {
            <div class="agd__actions">
              <button type="button" class="btn btn-success" [disabled]="occupe()" (click)="soumettre()">{{ occupe() ? '…' : 'Soumettre l’acte à la Commission' }}</button>
              @if (nbManquantes()) { <span class="agd__aide">{{ nbManquantes() }} pièce(s) obligatoire(s) à joindre : la soumission sera refusée.</span> }
            </div>
          } @else {
            <p class="agd__vide">La soumission revient à la personne responsable des marchés publics.</p>
          }
        } @else if (refus(); as r) {
          <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div>
        }
      </section>
    }
  `,
  styles: `
    .agd { background: #fff; border: 1px solid var(--n-200); border-radius: 12px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .agd__titre { margin: 0; font-size: 0.95rem; }
    .agd__ligne { margin: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; font-size: 0.84rem; color: var(--n-600); }
    .agd__bloc { border-top: 1px dashed var(--n-200); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .agd__sous { margin: 0; font-size: 0.88rem; }
    .agd__pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .agd__piece { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; font-size: 0.85rem; }
    .agd__piece-lib { flex: 1 1 16rem; }
    .agd__piece-etat { color: var(--n-500); }
    .agd__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
    .agd__aide { font-size: 0.82rem; color: var(--warning-text); }
    .agd__vide { margin: 0; font-size: 0.84rem; color: var(--n-500); }
    .agd__manques { margin: 0; padding-left: 1.2rem; font-size: 0.84rem; color: var(--warning-text); }
  `,
})
export class ActeGestionDossier implements OnInit {
  private readonly service = inject(ActesGestionService);
  private readonly dossiers = inject(DossierService);
  private readonly pieces = inject(PieceJointeDossierService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly liens = inject(LienDossier);

  readonly dossier = input.required<Dossier>();
  /** L'acte a changé (déclarations, pièce, soumission) : la page relit le dossier. */
  readonly modifie = output<void>();

  readonly ariary = ariary;
  readonly jj = dateCourte;
  readonly libelle = libelleActe;
  readonly libellesCategorie = LIBELLES_CATEGORIE_MARCHE;

  readonly acte = signal<ActeGestion | null>(null);
  readonly exigees = signal<TypePieceJointe[]>([]);
  readonly deposees = signal<PieceJointeDossier[]>([]);
  readonly edition = signal(false);
  readonly demande = signal<DemandeActe>(demandeVide());
  readonly occupe = signal(false);
  readonly refus = signal<string | null>(null);

  readonly estPrmp = computed(() => this.auth.role() === 'PRMP');
  readonly editable = computed(() => this.dossier().statut === 'BROUILLON' && ['PRMP', 'UGPM'].includes(this.auth.role() ?? ''));
  readonly nbManquantes = computed(() => this.exigees().filter((t) => t.obligatoire && !this.jointe(t)).length);
  /**
   * Ce qui manque aux déclarations modifiées : la règle du dépôt, où un fait **non déclaré par l'acte** est un fait que le serveur
   * connaît déjà (il ne s'est donc pas demandé) — on le lui présente comme connu.
   */
  readonly manquesEdition = computed(() => {
    const d = this.demande();
    const a = this.acte();
    if (!a) return [];
    const connus = { montantInitialHt: a.montantInitialHt == null ? 1 : null, categorie: a.categorie == null ? ('FOURNITURES_SERVICES' as const) : null };
    return manquesDemande(d, connus);
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    const id = this.dossier().idDossier;
    forkJoin({
      acte: this.service.lire(id).pipe(catchError(() => of(null))),
      exigees: this.editable() ? this.dossiers.piecesExigees(id).pipe(catchError(() => of([] as TypePieceJointe[]))) : of([] as TypePieceJointe[]),
      deposees: this.editable() ? this.pieces.getByDossier(id).pipe(catchError(() => of([] as PieceJointeDossier[]))) : of([] as PieceJointeDossier[]),
    }).subscribe(({ acte, exigees, deposees }) => {
      this.acte.set(acte);
      this.exigees.set([...exigees].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)));
      this.deposees.set(deposees);
    });
  }

  lien(idDossier: number): (string | number)[] | null {
    return this.liens.disponible() ? this.liens.commandes(idDossier) : null;
  }

  jointe(t: TypePieceJointe): boolean {
    return this.deposees().some((p) => p.idTypePiece === t.idTypePiece);
  }

  ouvrirEdition(): void {
    const a = this.acte();
    if (!a) return;
    this.demande.set({
      sousType: a.sousType,
      montantHt: a.montantHt,
      montantInitialHt: a.montantInitialHt,
      categorie: a.categorie,
      dateReceptionProvisoire: a.dateReceptionProvisoire,
      dateReceptionDefinitive: a.dateReceptionDefinitive,
      dateSolde: a.dateSolde,
    });
    this.refus.set(null);
    this.edition.set(true);
  }

  enregistrer(): void {
    const d = this.demande();
    if (this.occupe()) return;
    this.occupe.set(true);
    this.refus.set(null);
    this.service.modifier(this.dossier().idDossier, d).subscribe({
      next: (a) => {
        this.occupe.set(false);
        this.acte.set(a);
        this.edition.set(false);
        this.toast.success('Déclarations de l’acte enregistrées.');
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.occupe.set(false);
        this.refus.set(messageRefusActe(e));
      },
    });
  }

  joindre(t: TypePieceJointe, ev: Event): void {
    const champ = ev.target as HTMLInputElement;
    const f = champ.files?.[0];
    if (!f) return;
    const erreur = validerFichier(f);
    if (erreur) {
      this.refus.set(erreur);
      champ.value = '';
      return;
    }
    const fd = new FormData();
    fd.append('data', new Blob([JSON.stringify({ idDossier: this.dossier().idDossier, idTypePiece: t.idTypePiece })], { type: 'application/json' }));
    fd.append('fichier', f, f.name);
    this.occupe.set(true);
    this.refus.set(null);
    this.pieces.upload(fd).subscribe({
      next: (p) => {
        this.occupe.set(false);
        champ.value = '';
        this.deposees.update((l) => [...l, p]);
        this.toast.success(`Pièce jointe : ${t.libellePiece}.`);
        this.modifie.emit();
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.occupe.set(false);
        this.refus.set(messageRefusActe(e));
      },
    });
  }

  soumettre(): void {
    if (this.occupe()) return;
    this.occupe.set(true);
    this.refus.set(null);
    this.dossiers.soumettre(this.dossier().idDossier).subscribe({
      next: () => {
        this.occupe.set(false);
        this.toast.success('Acte soumis à la Commission.');
        this.modifie.emit();
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.occupe.set(false);
        this.refus.set(messageRefusActe(e));
      },
    });
  }
}
