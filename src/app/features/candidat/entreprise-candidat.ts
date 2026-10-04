import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { TYPES_PIECE, validerFichier } from '../../core/securite/fichiers-surs';
import { Entreprise, TypePieceEntreprise } from '../../models';
import { EntrepriseCandidatService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import {
  EXPLICATIONS_STATUT_NIF,
  LIBELLES_STATUT_NIF,
  LIBELLES_TYPE_PIECE,
  TYPES_PIECE_ENTREPRISE,
  dateHeureFr,
  messageExclusion,
  tailleLisible,
} from './libelles-candidat';

/** La limite multipart du serveur : au-delà, `tailleMaxPieceMo` ne sert à rien (demande du 04/10, §B3). */
const PIECE_MAX_MO = 10;

/** Les codes 409 de l'unicité, et le champ sous lequel poser le message servi. */
const CHAMP_DU_409: Readonly<Record<string, 'nif' | 'stat' | 'rcs'>> = {
  NIF_EXISTANT: 'nif',
  STAT_EXISTANT: 'stat',
  RCS_EXISTANT: 'rcs',
};

/**
 * « Mon entreprise » (`/api/candidat/entreprise`, §B3 à §B5) — un compte, une entreprise, déclarée une fois pour
 * toutes : raison sociale, NIF (unique sur la plateforme, comme le STAT et le RCS), adresse, représentant, puis les
 * pièces (carte fiscale, statuts, pouvoir). L'écran montre aussi ce que l'entreprise ne décide pas : la
 * **vérification du NIF** (par l'Administrateur sur pièces, ou par la DGI ; elle ne bloque jamais un dépôt) et, s'il y a
 * lieu, le **signalement d'une exclusion** de l'ARMP — dans les termes mêmes du refus qui l'attendrait au dépôt.
 */
@Component({
  selector: 'app-entreprise-candidat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, EtatErreur],
  template: `
    <header class="page-header">
      <div class="page-subtitle">Espace candidat</div>
      <h1 class="page-title">Mon entreprise</h1>
    </header>
    <p class="page-role">
      Déclarez votre entreprise une fois pour toutes ; vos offres s'y rattacheront. Un NIF, un STAT ou un RCS n'appartient
      qu'à une seule entreprise sur la plateforme.
    </p>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Votre entreprise n'a pas pu être chargée." (reessayer)="charger()" />
    } @else {
      @if (entreprise()?.exclusion; as x) {
        <div class="alert alert-danger ec__exclusion" role="alert">
          <strong>Entreprise signalée comme exclue des marchés publics.</strong>
          <span>{{ exclusion(x) }}</span>
          <span class="text-sm">Motif : {{ x.motif }}. Si cette exclusion ne vous concerne pas, contactez l'assistance indiquée dans la procédure.</span>
        </div>
      }

      <div class="ec__grille">
        <form class="card cnm-form ec__form" [formGroup]="form" (ngSubmit)="enregistrer()" novalidate aria-label="Déclaration de l'entreprise">
          <h2 class="ec__h2">{{ entreprise() ? 'Identité de l’entreprise' : 'Déclarer mon entreprise' }}</h2>
          @if (erreurForm(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }

          <div class="cnm-form-grid">
            <label class="form-group ec__large">
              <span class="form-label">Raison sociale</span>
              <input class="form-control" type="text" formControlName="raisonSociale" autocomplete="organization" required [class.error]="invalide('raisonSociale')" />
              @if (manque('raisonSociale')) { <span class="form-error">Obligatoire.</span> }
              @if (erreurChamp('raisonSociale'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">NIF</span>
              <input class="form-control" type="text" formControlName="nif" required [class.error]="invalide('nif')" />
              @if (manque('nif')) { <span class="form-error">Obligatoire.</span> }
              @if (erreurChamp('nif'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">STAT (facultatif)</span>
              <input class="form-control" type="text" formControlName="stat" [class.error]="!!erreurChamp('stat')" />
              @if (erreurChamp('stat'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">RCS (facultatif)</span>
              <input class="form-control" type="text" formControlName="rcs" [class.error]="!!erreurChamp('rcs')" />
              @if (erreurChamp('rcs'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group ec__large">
              <span class="form-label">Adresse</span>
              <textarea class="form-control" rows="2" formControlName="adresse" autocomplete="street-address" required [class.error]="invalide('adresse')"></textarea>
              @if (manque('adresse')) { <span class="form-error">Obligatoire.</span> }
              @if (erreurChamp('adresse'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Représentant — nom</span>
              <input class="form-control" type="text" formControlName="representantNom" required [class.error]="invalide('representantNom')" />
              @if (manque('representantNom')) { <span class="form-error">Obligatoire.</span> }
              @if (erreurChamp('representant.nom'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Représentant — prénom</span>
              <input class="form-control" type="text" formControlName="representantPrenom" required [class.error]="invalide('representantPrenom')" />
              @if (manque('representantPrenom')) { <span class="form-error">Obligatoire.</span> }
              @if (erreurChamp('representant.prenom'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Représentant — fonction (facultatif)</span>
              <input class="form-control" type="text" formControlName="representantFonction" />
            </label>
          </div>
          <div class="ec__pied">
            <button type="submit" class="btn btn-primary" [disabled]="envoi()">{{ envoi() ? 'Enregistrement…' : entreprise() ? 'Enregistrer' : 'Déclarer mon entreprise' }}</button>
            @if (entreprise()) { <span class="text-sm text-muted">Un NIF changé remet la vérification à zéro.</span> }
          </div>
        </form>

        <div class="ec__cote">
          @if (entreprise(); as e) {
            <section class="card ec__bloc" aria-labelledby="ec-verif">
              <h2 id="ec-verif" class="ec__h2">Vérification du NIF</h2>
              <p class="ec__statut">
                <span class="badge" [class.badge-success]="e.verification.statut === 'VERIFIE_DGI' || e.verification.statut === 'VERIFIE_SUR_PIECES'" [class.badge-danger]="e.verification.statut === 'REFUSE_SUR_PIECES' || e.verification.statut === 'INCONNU_DGI'" [class.badge-neutral]="e.verification.statut === 'NON_VERIFIE'">{{ statuts[e.verification.statut] }}</span>
                @if (e.verification.date) { <span class="text-sm text-muted">le {{ dateHeure(e.verification.date) }}</span> }
              </p>
              <p class="text-sm">{{ explications[e.verification.statut] }}</p>
              @if (e.verification.motif) { <p class="text-sm"><strong>Motif :</strong> {{ e.verification.motif }}</p> }
            </section>

            <section class="card ec__bloc" aria-labelledby="ec-pieces">
              <h2 id="ec-pieces" class="ec__h2">Pièces</h2>
              @if (e.pieces.length) {
                <ul class="ec__pieces">
                  @for (p of e.pieces; track p.id) {
                    <li class="ec__piece">
                      <span><strong>{{ typesPiece[p.type] }}</strong><br /><span class="text-xs text-muted">{{ p.nomFichier }} · {{ taille(p.taille) }} · {{ date(p.dateDepot) }}</span></span>
                      <button type="button" class="btn btn-sm btn-outline" [disabled]="suppression() === p.id" (click)="supprimer(p.id)" [attr.aria-label]="'Supprimer ' + typesPiece[p.type] + ' ' + p.nomFichier">{{ suppression() === p.id ? '…' : 'Supprimer' }}</button>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-sm text-muted">Aucune pièce. La carte fiscale permet la vérification de votre NIF sur pièces.</p>
              }
              <div class="ec__ajout">
                <label class="form-group">
                  <span class="form-label">Nature de la pièce</span>
                  <select class="form-control" [value]="typeChoisi()" (change)="typeChoisi.set($any($event.target).value)">
                    @for (t of typesPieceListe; track t) { <option [value]="t">{{ typesPiece[t] }}</option> }
                  </select>
                </label>
                <label class="form-group">
                  <span class="form-label">Fichier (PDF, JPEG ou PNG, {{ pieceMaxMo }} Mo au plus)</span>
                  <input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisirFichier($event)" />
                  @if (fichierErreur(); as m) { <span class="form-error">{{ m }}</span> }
                </label>
                <button type="button" class="btn btn-secondary btn-sm" [disabled]="!fichier() || televersement()" (click)="televerser()">{{ televersement() ? 'Envoi…' : 'Téléverser' }}</button>
              </div>
            </section>
          } @else {
            <section class="card ec__bloc">
              <h2 class="ec__h2">Après la déclaration</h2>
              <p class="text-sm">Vous pourrez téléverser vos pièces (carte fiscale, statuts, pouvoir du signataire). L'Administrateur vérifie votre NIF sur la carte fiscale ; cela ne bloque aucun dépôt.</p>
            </section>
          }
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .ec__exclusion { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; }
    .ec__grille { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 1rem; align-items: start; }
    .ec__form, .ec__bloc { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .ec__large { grid-column: span 2; }
    .ec__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ec__pied { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .ec__cote { display: flex; flex-direction: column; gap: 1rem; }
    .ec__statut { margin: 0; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .ec__pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .ec__piece { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.45rem 0.6rem; border: 1px solid var(--n-200); border-radius: var(--radius-md); font-size: var(--text-sm); }
    .ec__ajout { display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--n-200); }
    @media (max-width: 900px) { .ec__grille { grid-template-columns: 1fr; } }
    @media (max-width: 600px) { .ec__large { grid-column: span 1; } }
  `,
})
export class EntrepriseCandidat implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(EntrepriseCandidatService);
  private readonly toast = inject(ToastService);

  readonly statuts = LIBELLES_STATUT_NIF;
  readonly explications = EXPLICATIONS_STATUT_NIF;
  readonly typesPiece = LIBELLES_TYPE_PIECE;
  readonly typesPieceListe = TYPES_PIECE_ENTREPRISE;
  readonly pieceMaxMo = PIECE_MAX_MO;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;
  readonly exclusion = messageExclusion;

  readonly form = this.fb.nonNullable.group({
    raisonSociale: ['', Validators.required],
    nif: ['', Validators.required],
    stat: [''],
    rcs: [''],
    adresse: ['', Validators.required],
    representantNom: ['', Validators.required],
    representantPrenom: ['', Validators.required],
    representantFonction: [''],
  });

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  /** `null` tant qu'elle n'est pas déclarée (404 serveur) : le formulaire est alors vide. */
  readonly entreprise = signal<Entreprise | null>(null);
  readonly envoi = signal(false);
  readonly erreurForm = signal<string | null>(null);
  readonly erreursChamps = signal<Record<string, string>>({});

  readonly typeChoisi = signal<TypePieceEntreprise>('CARTE_FISCALE');
  readonly fichier = signal<File | null>(null);
  readonly fichierErreur = signal<string | null>(null);
  readonly televersement = signal(false);
  readonly suppression = signal<number | null>(null);

  constructor() {
    inject(DOCUMENT).title = 'Mon entreprise — Espace candidat — PRS 2.0';
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.lire().subscribe({
      next: (e) => {
        this.poser(e);
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 404) this.entreprise.set(null); // pas encore déclarée : formulaire vide, pas une panne
        else this.erreur.set(true);
      },
    });
  }

  private poser(e: Entreprise): void {
    this.entreprise.set(e);
    this.form.patchValue({
      raisonSociale: e.raisonSociale,
      nif: e.nif,
      stat: e.stat ?? '',
      rcs: e.rcs ?? '',
      adresse: e.adresse,
      representantNom: e.representant.nom,
      representantPrenom: e.representant.prenom,
      representantFonction: e.representant.fonction ?? '',
    });
  }

  touche(champ: keyof typeof this.form.controls): boolean {
    return this.form.controls[champ].touched;
  }

  manque(champ: keyof typeof this.form.controls): boolean {
    return this.touche(champ) && this.form.controls[champ].hasError('required');
  }

  invalide(champ: keyof typeof this.form.controls): boolean {
    return (this.touche(champ) && this.form.controls[champ].invalid) || !!this.erreursChamps()[champ];
  }

  erreurChamp(champ: string): string | undefined {
    return this.erreursChamps()[champ];
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.envoi.set(true);
    this.erreurForm.set(null);
    this.erreursChamps.set({});
    const v = this.form.getRawValue();
    this.service
      .declarer({
        raisonSociale: v.raisonSociale.trim(),
        nif: v.nif.trim(),
        stat: v.stat.trim() || null,
        rcs: v.rcs.trim() || null,
        adresse: v.adresse.trim(),
        representant: { nom: v.representantNom.trim(), prenom: v.representantPrenom.trim(), fonction: v.representantFonction.trim() || null },
      })
      .subscribe({
        next: (e) => {
          this.envoi.set(false);
          this.poser(e);
          this.toast.success('Votre entreprise est enregistrée.', 'C’est fait');
        },
        error: (e: ApiError) => {
          this.envoi.set(false);
          if (e.status === 400 && e.fieldErrors) {
            this.erreursChamps.set(e.fieldErrors);
          } else if (e.status === 409 && e.code && CHAMP_DU_409[e.code]) {
            this.erreursChamps.set({ [CHAMP_DU_409[e.code]]: e.message });
          } else {
            this.erreurForm.set(e.message || "L'enregistrement n'a pas abouti.");
          }
        },
      });
  }

  choisirFichier(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) {
      this.fichier.set(null);
      this.fichierErreur.set(null);
      return;
    }
    const erreur = validerFichier(file, TYPES_PIECE, PIECE_MAX_MO);
    this.fichierErreur.set(erreur);
    this.fichier.set(erreur ? null : file);
  }

  televerser(): void {
    const f = this.fichier();
    if (!f || this.televersement()) return;
    this.televersement.set(true);
    this.fichierErreur.set(null);
    this.service.ajouterPiece(this.typeChoisi(), f).subscribe({
      next: (piece) => {
        this.televersement.set(false);
        this.fichier.set(null);
        this.entreprise.update((e) => (e ? { ...e, pieces: [...e.pieces, piece] } : e));
        this.toast.success(`${LIBELLES_TYPE_PIECE[piece.type]} téléversée.`);
      },
      error: (e: ApiError) => {
        this.televersement.set(false);
        if (e.status === 413) this.fichierErreur.set("Pièce trop volumineuse pour le plafond fixé par l'Administrateur.");
        else if (e.status === 409) this.fichierErreur.set("Déclarez d'abord votre entreprise, puis téléversez ses pièces.");
        else this.fichierErreur.set(e.message || "Le téléversement n'a pas abouti.");
      },
    });
  }

  supprimer(id: number): void {
    if (this.suppression()) return;
    this.suppression.set(id);
    this.service.supprimerPiece(id).subscribe({
      next: () => {
        this.suppression.set(null);
        this.entreprise.update((e) => (e ? { ...e, pieces: e.pieces.filter((p) => p.id !== id) } : e));
      },
      error: () => this.suppression.set(null),
    });
  }
}
