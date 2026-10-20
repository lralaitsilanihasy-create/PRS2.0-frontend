import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ToastService } from '../../../core/notifications/toast.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError, codeErreur } from '../../../core/errors/api-error';
import { ouvrirBlobSur, TYPES_PIECE, validerFichier } from '../../../core/securite/fichiers-surs';
import { PieceJointeDossier, PublicationAgpm, REPERES_PIECE_PRODUITE, TypePieceJointe, messagePieceProduite, origineProduite } from '../../../models';
import { DossierService, PieceJointeDossierService, PvExamenService } from '../../../services';
import { PublicationAgpmPanneau } from '../../../shared/circuit/publication-agpm';
import { DossierContenuStore } from './dossier-contenu.store';

/**
 * Pièces jointes d'un dossier, en trois groupes : initiales, versions corrigées (rectification) et
 * après lettre de renvoi. Lit le `DossierContenuStore` de l'hôte ; l'ouverture passe par
 * `ouvrirBlobSur` (fichier téléversé rendu inerte).
 */
@Component({
  selector: 'app-dossier-pieces',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PublicationAgpmPanneau, RouterLink],
  template: `
    <!-- ⚠️ 18/10 (pilote) — dans la modale « Pièces jointes » de la page, le titre de la modale suffit : pas d'en-tête répété. -->
    @if (!sansEntete()) {
    <div class="dc-section-head">
      <div class="section-block-title">
        <div class="section-icon">📎</div>
        <span class="section-label">Pièces jointes</span>
        <span class="section-count">{{ contenu.pieces().length }} pièce(s)</span>
      </div>
    </div>
    }

    <div class="pieces-card">
      <!-- ⚠️ Manuel de contrôle, M2 (V95) — en brouillon, la liste que la soumission exigera, cochée pièce par pièce. -->
      @if (exigees().length > 0) {
        <div class="pieces-group" [attr.aria-labelledby]="sansEntete() ? null : 'pieces-exigees'" [attr.aria-label]="sansEntete() ? 'Pièces exigées pour soumettre' : null">
          <!-- ⚠️ 18/10 (pilote) — dans la modale de la page, ni en-tête « Pièces jointes » ni « Pièces exigées pour soumettre » : la liste suit le titre. -->
          @if (!sansEntete()) {
          <div class="pieces-group-hd">
            <span id="pieces-exigees" class="group-pill gp-blue">Pièces exigées pour soumettre</span>
            <span class="group-count">{{ nbObligatoiresManquantes() ? nbObligatoiresManquantes() + ' obligatoire(s) manquante(s)' : 'toutes les obligatoires sont jointes' }}</span>
          </div>
          }
          <!-- ⚠️ 18/10 (pilote) — une pièce que montre déjà un onglet du dossier n'est plus listée ici : un renvoi la remplace. -->
          <!-- ⚠️ 18/10 (pilote) — dans la modale de la page, les éléments ont leurs boutons dans le panneau d'étape : pas de renvoi. -->
          @if (renvois().length && !sansEntete()) {
            <p class="pe-renvoi">
              <span class="pe-etat" aria-hidden="true">✓</span>
              Fournies par l’application, dans leurs onglets :
              @for (r of renvois(); track r.onglet; let dernier = $last) {
                <button type="button" class="pe-lien" (click)="voir.emit(r.onglet)" [attr.title]="r.pieces">{{ r.libelle }}</button>{{ dernier ? '' : ' · ' }}
              }
            </p>
          }
          <ul class="pe-liste">
            @for (t of exigeesListees(); track t.idTypePiece) {
              <li class="pe-ligne" [class.pe-ligne--manque]="manquante(t)">
                <span class="pe-etat" aria-hidden="true">{{ deposees().has(t.idTypePiece) || fournie(t) ? '✓' : t.obligatoire ? '✕' : '–' }}</span>
                <span class="pe-lib">{{ t.libellePiece }}</span>
                <!-- ⚠️ R2 (V102) — une pièce « FACULTATIVE_EN_LIGNE » (imprimé du SIGMP pendant la transition) est servie facultative en ligne. -->
                <!-- ⚠️ 17/10 (demande « pieces-dmc-par-les-donnees », B1) — une pièce que l'application fournit par ses données. -->
                @if (fournie(t)) {
                  <span class="pe-tag pe-tag--app">fournie par l’application</span>
                  <!-- ⚠️ 18/10 (pilote, « supprimer la redondance ») — la pièce fournie a son onglet : on y renvoie, au lieu d'un second accès au PDF. -->
                  @if (ongletDe(t); as o) {
                    <button type="button" class="pe-ouvrir" (click)="voir.emit(o)" [attr.aria-label]="'Voir l’onglet : ' + t.libellePiece">Voir l’onglet</button>
                  } @else {
                    <button type="button" class="pe-ouvrir" [disabled]="ouverture() === t.idTypePiece" (click)="ouvrirFournie(t)" [attr.aria-label]="'Ouvrir : ' + t.libellePiece">Ouvrir</button>
                  }
                } @else if (repriseAgpm(t)) {
                  <span class="pe-tag pe-tag--app">déposée sur le plan, reprise d’office à la soumission</span>
                } @else if (!fichiersDe(t).length) {
                  <span class="pe-tag">{{ t.obligatoire ? 'obligatoire, manquante' : t.condition === 'FACULTATIVE_EN_LIGNE' ? 'facultative en ligne (transition SIGMP)' : 'facultative' }}</span>
                }
                <!-- ⚠️ 18/10 (pilote, « comment joindre tout autre document utile ») — le dépôt habituel, ici même, en brouillon. -->
                @if (peutJoindre(t)) {
                  <label class="btn btn-outline btn-sm pe-joindre">
                    {{ envoi() === t.idTypePiece ? 'Envoi… ' + restants() : fichiersDe(t).length ? 'Ajouter des fichiers' : 'Joindre' }}
                    <input type="file" multiple class="visually-hidden" accept=".pdf,.jpeg,.jpg,.png" [attr.aria-label]="'Joindre : ' + t.libellePiece"
                      [disabled]="envoi() !== null" (change)="joindre(t, $event)" />
                  </label>
                }
              </li>
              @if (t.code === 'AUTRE_DOCUMENT' && peutJoindre(t)) {
                <li class="pe-note">Autant de fichiers que voulu (PDF, JPEG ou PNG), plusieurs à la fois si besoin. Nommez chaque fichier d’après son contenu : son nom en tient lieu d’intitulé.</li>
              }
              <!-- ⚠️ 18/10 (pilote, « comment joindre la publication de l'AGPM ») — elle se dépose une fois sur le plan contrôlé (V118) :
                   le dépôt du plan est proposé ici même, et chaque dossier du plan la reprend d'office à sa soumission. -->
              @if (depotAgpmIci(t); as idPlan) {
                <li class="pe-depot">
                  <app-publication-agpm [idDossier]="idPlan" [plan]="true" (deposee)="publicationPlan.set($event)" />
                </li>
              }
              <!-- Les fichiers déposés sous la pièce, à leur place : ils ne sont plus répétés dans une seconde liste. -->
              @for (p of fichiersDe(t); track p.idPiece) {
                <li class="pe-fichier">
                  <span class="piece-file">{{ p.nomFichier || ('Pièce #' + p.idPiece) }}</span>
                  @if (produite(p); as o) { <span class="piece-fiche" [title]="reperes[o].aide">{{ reperes[o].court }}</span> }
                  @if (origine(p); as o) { <span class="piece-fiche" [title]="o.titre">{{ o.libelle }}</span> }
                  <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)" [attr.aria-label]="'Ouvrir ' + (p.nomFichier || t.libellePiece)">Ouvrir <span class="arrow">↗</span></button>
                  @if (peutJoindre(t) && !produite(p) && !origine(p)) {
                    <button class="btn btn-ghost btn-sm" type="button" (click)="retirer(p)" [attr.aria-label]="'Retirer ' + (p.nomFichier || 'le fichier')">Retirer</button>
                  }
                </li>
              }
            }
          </ul>
        </div>
      }
      <!-- ⚠️ 19/10 (pilote) — après la soumission, les pièces que l'application fournit restent visibles et s'ouvrent. -->
      @if (fourniesSoumis().length) {
        <div class="pieces-group" data-testid="pieces-fournies">
          <div class="pieces-group-hd">
            <span class="group-pill gp-blue">Fournies par l'application</span>
            <span class="group-count">{{ fourniesSoumis().length }} pièce(s)</span>
          </div>
          @for (t of fourniesSoumis(); track t.idTypePiece; let i = $index) {
            <div class="piece-row">
              <div class="piece-left">
                <span class="piece-index pi-blue">{{ i + 1 }}</span>
                <span class="piece-name">{{ t.libellePiece }}</span>
                <span class="piece-fiche" title="Produite par l'application à partir des données du dossier : rien à déposer.">application</span>
              </div>
              <!-- ⚠️ 20/10 (Q4) — un PV de la Commission sans document (aucun modèle) : dit tel quel, avec le dossier dont il procède. -->
              @if (t.code === 'PV_CNM_DMC' && !t.lien) {
                <span class="text-sm text-muted">PV sans document@if (contenu.dossier().procedure?.idDossierMiseEnConcurrence; as idMec) { · <a [routerLink]="['/dossier', idMec]">voir le dossier de mise en concurrence</a> }</span>
              } @else {
                <button class="btn-ouvrir" type="button" [disabled]="ouverture() === t.idTypePiece" (click)="ouvrirFournie(t)" [attr.aria-label]="'Ouvrir : ' + t.libellePiece">Ouvrir <span class="arrow">↗</span></button>
              }
            </div>
          }
        </div>
      }
      @if (piecesInitialesListees().length > 0) {
        <div class="pieces-group">
          <div class="pieces-group-hd">
            <span class="group-pill gp-blue">{{ exigees().length ? 'Autres pièces jointes' : 'Pièces initiales' }}</span>
            <span class="group-count">{{ piecesInitialesListees().length }} fichier(s)</span>
          </div>
          @for (p of piecesInitialesListees(); track p.idPiece; let i = $index) {
            <div class="piece-row">
              <div class="piece-left">
                <span class="piece-index pi-blue">{{ i + 1 }}</span>
                <span class="piece-name">
                  {{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}
                  <!-- ⚠️ Lot 2a (23/09) — un dossier porte désormais PLUSIEURS pièces du même type (le dossier
                       d'appel d'offres complet en compte quatre) : seul le nom du fichier les distingue. -->
                  @if (p.libellePiece && p.nomFichier) { <span class="piece-file">{{ p.nomFichier }}</span> }
                </span>
                @if (produite(p); as o) { <span class="piece-fiche" [title]="reperes[o].aide">{{ reperes[o].court }}</span> }
                @if (origine(p); as o) { <span class="piece-fiche" [title]="o.titre">{{ o.libelle }}</span> }
              </div>
              <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">Ouvrir <span class="arrow">↗</span></button>
            </div>
          }
        </div>
      }

      <!-- ⚠️ 2026-08-03 (demande user) — versions CORRIGÉES (rectification sur observations
           du PV) : section dédiée, distinctes des originales conservées ci-dessus. -->
      @if (piecesCorrigees().length > 0) {
        <div class="pieces-group">
          <div class="pieces-group-hd">
            <span class="group-pill gp-green">Versions corrigées (rectification)</span>
            <span class="group-count">{{ piecesCorrigees().length }} fichier(s)</span>
          </div>
          @for (p of piecesCorrigees(); track p.idPiece; let i = $index) {
            <div class="piece-row">
              <div class="piece-left">
                <span class="piece-index pi-green">{{ i + 1 }}</span>
                <span class="piece-name">
                  {{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}
                  <!-- ⚠️ Lot 2a (23/09) — un dossier porte désormais PLUSIEURS pièces du même type (le dossier
                       d'appel d'offres complet en compte quatre) : seul le nom du fichier les distingue. -->
                  @if (p.libellePiece && p.nomFichier) { <span class="piece-file">{{ p.nomFichier }}</span> }
                </span>
                @if (produite(p); as o) { <span class="piece-fiche" [title]="reperes[o].aide">{{ reperes[o].court }}</span> }
                @if (origine(p); as o) { <span class="piece-fiche" [title]="o.titre">{{ o.libelle }}</span> }
                <span class="vc-tag">Corrigée</span>
              </div>
              <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">Ouvrir <span class="arrow">↗</span></button>
            </div>
          }
        </div>
      }

      @if (piecesApresRenvoi().length > 0) {
        <div class="pieces-group">
          <div class="pieces-group-hd">
            <span class="group-pill gp-orange">Après lettre de renvoi</span>
            <span class="group-count">{{ piecesApresRenvoi().length }} fichier(s)</span>
          </div>
          @for (p of piecesApresRenvoi(); track p.idPiece; let i = $index) {
            <div class="piece-row">
              <div class="piece-left">
                <span class="piece-index pi-orange">{{ i + 1 }}</span>
                <span class="piece-name">
                  {{ p.libellePiece || p.nomFichier || ('Pièce #' + p.idPiece) }}
                  <!-- ⚠️ Lot 2a (23/09) — un dossier porte désormais PLUSIEURS pièces du même type (le dossier
                       d'appel d'offres complet en compte quatre) : seul le nom du fichier les distingue. -->
                  @if (p.libellePiece && p.nomFichier) { <span class="piece-file">{{ p.nomFichier }}</span> }
                </span>
                @if (produite(p); as o) { <span class="piece-fiche" [title]="reperes[o].aide">{{ reperes[o].court }}</span> }
                @if (origine(p); as o) { <span class="piece-fiche" [title]="o.titre">{{ o.libelle }}</span> }
                <span class="lr-tag">LR</span>
              </div>
              <button class="btn-ouvrir" type="button" (click)="ouvrirPiece(p)">Ouvrir <span class="arrow">↗</span></button>
            </div>
          }
        </div>
      }

      @if (contenu.pieces().length === 0) {
        <div class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">📭</span>
          <span class="empty-state-text">Aucune pièce jointe.</span>
        </div>
      }
    </div>
  `,
  styles: `
    /* Sans boîte propre : l'en-tête et la carte restent les enfants directs de la section de l'hôte. */
    :host { display: contents; }
    .dc-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 1rem; }
    .piece-file { display: block; font-size: 0.78rem; color: var(--n-500); overflow-wrap: anywhere; }
    /* Recette du 09/10 : le même retrait que les lignes de pièces (.piece-row, 9px 14px), sinon la liste colle aux bords de la carte. */
    .pe-liste { list-style: none; margin: 0; padding: 9px 14px; display: flex; flex-direction: column; gap: 0.25rem; }
    .pe-ligne { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.85rem; }
    .pe-etat { width: 1rem; font-weight: 700; color: var(--success-700, #047857); }
    .pe-ligne--manque .pe-etat, .pe-ligne--manque .pe-tag { color: var(--danger-700, #b42318); }
    .pe-lib { flex: 1; }
    .pe-joindre { margin-left: 0.5rem; }
    .pe-note { padding: 0 0 0.35rem 1.5rem; font-size: 0.78rem; color: var(--n-500); }
    .pe-depot { padding: 0.25rem 0 0.5rem 1.5rem; }
    .pe-renvoi { margin: 0; padding: 9px 14px 0; display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; font-size: 0.85rem; color: var(--n-700); }
    .pe-lien { border: none; background: none; padding: 0; color: var(--primary-700, #1d4ed8); text-decoration: underline; cursor: pointer; font: inherit; }
    .pe-fichier { display: flex; align-items: center; gap: 0.5rem; padding: 0.1rem 0 0.35rem 1.5rem; }
    .pe-fichier .piece-file { flex: 1; display: inline; }
    .pe-tag { font-size: 0.75rem; color: var(--n-500); }
    .pe-tag--app { color: var(--success-text, #15803d); font-weight: 600; }
    .pe-ouvrir { border: 1px solid var(--n-300); background: #fff; border-radius: 6px; padding: 0 0.5rem; font-size: 0.75rem; cursor: pointer; }
    .piece-fiche { flex: none; padding: 0.1rem 0.5rem; border-radius: 8px; background: #ecfdf5; color: #047857; font-size: 0.72rem; font-weight: 600; }
  `,
})
export class DossierPieces {
  protected readonly contenu = inject(DossierContenuStore);
  /** Sans l'en-tête « Pièces jointes » : l'hôte (la modale de la page) porte déjà ce titre. */
  readonly sansEntete = input(false);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  /** La pièce dont un fichier est en cours d'envoi. */
  readonly envoi = signal<number | null>(null);
  /**
   * ⚠️ 18/10 (pilote) — joindre depuis la page : PRMP et UGPM, dossier en brouillon, pièce ni fournie par l'application, ni produite
   * par la fiche, ni déposée sur le plan (la publication de l'AGPM se dépose sur le plan, V118).
   */
  peutJoindre(t: TypePieceJointe): boolean {
    const d = this.contenu.dossier();
    if (d.statut !== 'BROUILLON' || !['PRMP', 'UGPM'].includes(this.auth.role() ?? '')) return false;
    if (this.fournie(t) || this.ongletDe(t) || this.depotAgpmIci(t) || this.repriseAgpm(t)) return false;
    return !this.fichiersDe(t).some((p) => this.produite(p));
  }

  /** « 2/5 » pendant un envoi de plusieurs fichiers. */
  readonly restants = signal('');

  /** ⚠️ 18/10 (pilote, « et si on a plusieurs pièces à joindre ») — plusieurs fichiers d'un coup : chacun contrôlé, puis envoyé à son tour. */
  joindre(t: TypePieceJointe, ev: Event): void {
    const champ = ev.target as HTMLInputElement;
    const fichiers = Array.from(champ.files ?? []);
    champ.value = '';
    const refuses = fichiers.map((f) => ({ f, erreur: validerFichier(f, TYPES_PIECE) })).filter((x) => x.erreur);
    for (const r of refuses) this.toast.error(`« ${r.f.name} » : ${r.erreur}`);
    const valides = fichiers.filter((f) => !refuses.some((r) => r.f === f));
    if (!valides.length) return;
    this.envoi.set(t.idTypePiece);
    const suivant = (i: number): void => {
      if (i >= valides.length) { this.envoi.set(null); this.restants.set(''); return; }
      this.restants.set(valides.length > 1 ? `${i + 1}/${valides.length}` : '');
      const fd = new FormData();
      fd.append('data', new Blob([JSON.stringify({ idDossier: this.contenu.dossier().idDossier, idTypePiece: t.idTypePiece })], { type: 'application/json' }));
      fd.append('fichier', valides[i]);
      this.pieceService.upload(fd).subscribe({
        next: (p) => { this.contenu.pieces.update((l) => [...l, p]); suivant(i + 1); },
        error: () => { this.toast.error(`« ${valides[i].name} » n’a pas pu être joint. Réessayez.`); suivant(i + 1); },
      });
    };
    suivant(0);
  }

  /** ⚠️ 19/10 (V137) — produite par la fiche DAO ou jointe d'office par l'attribution : ni retrait, ni remplacement. */
  readonly produite = origineProduite;
  readonly reperes = REPERES_PIECE_PRODUITE;

  retirer(p: PieceJointeDossier): void {
    if (p.idPiece == null) return;
    this.pieceService.supprimer(p.idPiece).subscribe({
      next: () => this.contenu.pieces.update((l) => l.filter((x) => x.idPiece !== p.idPiece)),
      error: (e: ApiError) => this.toast.error(messagePieceProduite(codeErreur(e)) ?? 'Le fichier n’a pas pu être retiré.'),
    });
  }
  private readonly dossiers = inject(DossierService);

  /**
   * ⚠️ Manuel de contrôle, M2 (V95) — les pièces exigées de ce dossier (sous-type, conditions de sa fiche), lues en **brouillon**
   * seulement : c'est la liste que la soumission refuse incomplète. Silencieux en cas d'échec (le groupe ne s'affiche pas).
   */
  readonly exigees = signal<TypePieceJointe[]>([]);
  /** ⚠️ 19/10 — hors brouillon : les pièces fournies par l'application (fiche de présentation, PV produits), montrées à tous. */
  readonly fourniesSoumis = signal<TypePieceJointe[]>([]);
  readonly deposees = computed(() => new Set(this.contenu.pieces().map((p) => p.idTypePiece)));
  readonly nbObligatoiresManquantes = computed(() => this.exigees().filter((t) => this.manquante(t)).length);
  private readonly pvService = inject(PvExamenService);
  /** La pièce dont le document est en cours d'ouverture (le bouton se grise le temps de la production). */
  readonly ouverture = signal<number | null>(null);

  /** ⚠️ 17/10 (B1) — fournie par l'application : elle ne compte jamais manquante. */
  fournie(t: TypePieceJointe): boolean { return t.fourniePar === 'APPLICATION'; }
  manquante(t: TypePieceJointe): boolean { return pieceManquante(t, this.contenu.pieces(), this.publicationPlan()); }

  /** ⚠️ 18/10 — la publication en vigueur du plan de la ligne (V118), lue sur ce dossier ; nulle tant qu'aucune n'est déposée. */
  readonly publicationPlan = signal<PublicationAgpm | null>(null);
  /** La publication est sur le plan, pas encore reprise au dossier : elle le sera à la soumission. */
  repriseAgpm(t: TypePieceJointe): boolean {
    return t.code === 'PUBLICATION_AGPM' && this.publicationPlan() !== null && !this.deposees().has(t.idTypePiece);
  }
  /** Le plan où déposer la publication, depuis le dossier né d'une fiche, tant que ni le plan ni le dossier ne la portent. */
  depotAgpmIci(t: TypePieceJointe): number | null {
    const idPlan = this.contenu.dossier().idDossierPlan;
    return t.code === 'PUBLICATION_AGPM' && idPlan && !this.repriseAgpm(t) && !this.deposees().has(t.idTypePiece) ? idPlan : null;
  }

  /** ⚠️ 19/10 (V137) — le document désigné par le lien servi : un PV de la Commission, ou une pièce du dossier (le rapport signé). */
  private sourceDuLien(lien: string | null | undefined) {
    const pv = /\/pv-examens\/(\d+)\/document$/.exec(lien ?? '');
    if (pv) return this.pvService.document(Number(pv[1]));
    const piece = /\/piece-jointe-dossiers\/(\d+)\/contenu$/.exec(lien ?? '');
    return piece ? this.pieceService.telecharger(Number(piece[1])) : null;
  }

  /** Le document qui fournit la pièce, en PDF : la fiche de présentation, le canevas de rapport, le calendrier annuel, ou le PV du plan. */
  ouvrirFournie(t: TypePieceJointe): void {
    const id = this.contenu.dossier().idDossier;
    const source = t.code === 'FICHE_PRESENTATION' ? this.dossiers.fichePresentationPdf(id)
      : t.code === 'CANEVAS_RAPPORT' ? this.dossiers.canevasRapportPdf(id)
      : t.code === 'CALENDRIER' ? this.dossiers.calendrierAnnuel(id)
      : t.idPvPlan != null ? this.pvService.document(t.idPvPlan)
      : this.sourceDuLien(t.lien);
    if (!source) { this.toast.error('Ce document n’est pas disponible.'); return; }
    this.ouverture.set(t.idTypePiece);
    source.subscribe({
      next: (b) => { this.ouverture.set(null); ouvrirBlobSur(b); },
      error: (e: { status?: number }) => {
        this.ouverture.set(null);
        // ⚠️ 19/10 — un refus se nomme : document pas encore produit (404), ou fermé à ce profil (403).
        this.toast.error(e.status === 404 ? 'Ce document n’existe pas encore.' : e.status === 403 ? 'Ce document n’est pas ouvert à votre profil.' : 'Le document n’a pas pu être produit.');
      },
    });
  }

  constructor() {
    effect((nettoyer) => {
      const d = this.contenu.dossier();
      this.exigees.set([]);
      this.fourniesSoumis.set([]);
      // ⚠️ 19/10 (pilote) — hors brouillon, la liste est lue aussi, pour les seules pièces que l'application fournit : sans elle, la
      // fiche de présentation et les PV qu'elle produit disparaissaient de la page à la soumission (403 ou 404 : rien ne s'affiche).
      if (d.statut !== 'BROUILLON') {
        const lecture = this.dossiers.piecesExigees(d.idDossier).subscribe({
          next: (l) => this.fourniesSoumis.set([...l].filter((t) => this.fournie(t) && !this.ongletDe(t)).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))),
          error: () => this.fourniesSoumis.set([]),
        });
        nettoyer(() => lecture.unsubscribe());
        return;
      }
      const abonnement = this.dossiers.piecesExigees(d.idDossier).subscribe({
        next: (l) => this.exigees.set([...l].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))),
        error: () => this.exigees.set([]),
      });
      // Silencieux : 404 sans publication, 403/409 hors plan.
      const publication = d.idDossierPlan
        ? this.dossiers.publicationAgpm(d.idDossier).subscribe({ next: (p) => this.publicationPlan.set(p), error: () => this.publicationPlan.set(null) })
        : null;
      nettoyer(() => { abonnement.unsubscribe(); publication?.unsubscribe(); });
    });
  }

  readonly piecesInitiales = computed(() => this.contenu.pieces().filter((p) => !p.apresLettreRenvoi && !p.versionCorrigee));
  /** Les types listés en pièces exigées : leurs fichiers s'affichent sous eux. */
  private readonly typesExiges = computed(() => new Set(this.exigees().map((t) => t.idTypePiece)));
  /** ⚠️ 18/10 — le groupe des pièces initiales ne garde que celles qu'aucune pièce exigée n'a déjà montrées. */
  readonly piecesInitialesListees = computed(() => this.piecesInitiales()
    .filter((p) => !this.typesExiges().has(p.idTypePiece) && !ongletDuFichier(p, avecProcedure(this.contenu.dossier()))));
  fichiersDe(t: TypePieceJointe): PieceJointeDossier[] { return this.piecesInitiales().filter((p) => p.idTypePiece === t.idTypePiece); }

  /** ⚠️ 18/10 (pilote) — les pièces exigées que n'affiche aucun onglet du dossier : les autres sont remplacées par un renvoi. */
  readonly exigeesListees = computed(() => this.exigees().filter((t) => !this.ongletDe(t)));
  /** Les onglets qui portent des pièces fournies, dans l'ordre des onglets ; l'infobulle nomme les pièces. */
  readonly renvois = computed(() => {
    const parOnglet = new Map<OngletPieceFournie, string[]>();
    const ajouter = (o: OngletPieceFournie, libelle: string) => {
      const l = parOnglet.get(o) ?? [];
      if (!l.includes(libelle)) parOnglet.set(o, [...l, libelle]);
    };
    for (const t of this.exigees()) {
      const o = this.ongletDe(t);
      if (o) ajouter(o, t.libellePiece);
    }
    // Les pièces produites par la fiche hors liste exigée (le bordereau d'un contrat-cadre, Q4 du 17/10).
    const avecFiche = avecProcedure(this.contenu.dossier());
    for (const p of this.piecesInitiales()) {
      const o = this.typesExiges().has(p.idTypePiece) ? null : ongletDuFichier(p, avecFiche);
      if (o) ajouter(o, p.libellePiece || p.nomFichier || '');
    }
    return ORDRE_ONGLETS.filter((o) => parOnglet.has(o))
      .map((o) => ({ onglet: o, libelle: o === 'avis' && this.lettre() ? 'Lettre d’invitation' : LIBELLES_ONGLET[o], pieces: parOnglet.get(o)!.join(' ; ') }));
  });

  /** Prestations intellectuelles : le projet joint est une lettre d'invitation. */
  private readonly lettre = computed(() => this.contenu.pieces().some((p) => (p.nomFichier ?? '').startsWith('LETTRE_PROJET_')));

  /** ⚠️ 18/10 — l'onglet du dossier qui montre une pièce fournie ; l'hôte bascule dessus. */
  readonly voir = output<OngletPieceFournie>();
  ongletDe(t: TypePieceJointe): OngletPieceFournie | null {
    if (!avecProcedure(this.contenu.dossier())) return null;
    if (this.fournie(t)) {
      switch (t.code) {
        case 'FICHE_PRESENTATION': return 'presentation';
        case 'PV_CNM_DMC': return 'pv-cnm';
        case 'PV_VALIDATION_CAO': return 'evaluation';
        case 'CANEVAS_RAPPORT': return 'canevas';
        case 'CALENDRIER': case 'AGPM_CONTROLE': case 'PPM_CONTROLE': return 'plan';
        default: return null;
      }
    }
    // ⚠️ 18/10 — une pièce dont TOUS les fichiers sont produits par la fiche et montrés par un même onglet.
    const onglets = new Set(this.fichiersDe(t).map((p) => ongletDuFichier(p, true)));
    const [seul] = [...onglets];
    return onglets.size === 1 && seul ? seul : null;
  }
  readonly piecesApresRenvoi = computed(() => this.contenu.pieces().filter((p) => p.apresLettreRenvoi));
  /** ⚠️ 2026-08-03 — versions CORRIGÉES déposées pendant la rectification (distinctes des originales). */
  readonly piecesCorrigees = computed(() => this.contenu.pieces().filter((p) => !p.apresLettreRenvoi && p.versionCorrigee));

  /** Télécharge et ouvre une pièce jointe dans un nouvel onglet (lecture seule). */
  readonly origine = originePiece;

  ouvrirPiece(p: PieceJointeDossier): void {
    if (p.idPiece == null) {
      return;
    }
    this.pieceService.telecharger(p.idPiece).subscribe({
      next: (blob) => ouvrirBlobSur(blob),
      error: () => this.toast.error("Impossible d'ouvrir la pièce."),
    });
  }
}

/**
 * ⚠️ 18/10 (pilote) — une pièce obligatoire manque tant qu'elle n'est ni fournie par l'application (B1 du 17/10), ni déposée sur le
 * plan quand c'est la publication de l'AGPM (reprise d'office à la soumission, V118), ni jointe au dossier. Partagée par la liste des
 * pièces et par le bouton « Soumettre le dossier » de la page.
 */
export function pieceManquante(t: TypePieceJointe, pieces: readonly PieceJointeDossier[], publicationPlan: PublicationAgpm | null): boolean {
  if (!t.obligatoire || t.fourniePar === 'APPLICATION') return false;
  if (t.code === 'PUBLICATION_AGPM' && publicationPlan) return false;
  return !pieces.some((p) => p.idTypePiece === t.idTypePiece);
}

/**
 * ⚠️ 20/10 — le dossier porte une procédure dont l'application détient les données : né d'une fiche DAO (`idDmc`), ou dossier de
 * marché né d'une attribution (`procedure`, V137). Ses pièces produites se lisent alors en onglets.
 */
export function avecProcedure(d: { idDmc?: number | null; procedure?: { idDmc: number } | null }): boolean {
  return !!(d.idDmc || d.procedure);
}

/** La fiche dont procède le dossier : la sienne (dossier de mise en concurrence), ou celle de sa procédure (dossier de marché). */
export function ficheDuDossier(d: { idDmc?: number | null; procedure?: { idDmc: number } | null }): number | null {
  return d.idDmc ?? d.procedure?.idDmc ?? null;
}

/** Les onglets d'un dossier né d'une fiche qui montrent une pièce fournie par l'application. */
// ⚠️ 20/10 (« dossier-marche-donnees ») — + les éléments d'un dossier de marché né d'une attribution : séance, évaluation, attribution, PV de la Commission.
export type OngletPieceFournie = 'presentation' | 'fiche-dao' | 'avis' | 'plan' | 'canevas' | 'bordereau' | 'seance' | 'evaluation' | 'attribution' | 'pv-cnm';
const LIBELLES_ONGLET: Record<OngletPieceFournie, string> = {
  presentation: 'Fiche de présentation',
  'fiche-dao': 'Fiche DAO',
  avis: 'Avis spécifique',
  plan: 'Plan de passation',
  canevas: 'Canevas de rapport',
  bordereau: 'Bordereau estimatif',
  seance: 'Séance d’ouverture',
  evaluation: 'Rapport d’évaluation',
  attribution: 'Attribution',
  'pv-cnm': 'PV de la Commission sur le DAO',
};
const ORDRE_ONGLETS: readonly OngletPieceFournie[] = ['presentation', 'fiche-dao', 'avis', 'plan', 'canevas', 'bordereau', 'pv-cnm', 'seance', 'evaluation', 'attribution'];

/**
 * ⚠️ 18/10 (pilote) — l'onglet qui présente en données un fichier produit par la fiche DAO (`idDocumentFiche`), reconnu à son nom :
 * le DAO complet (la fiche, rendue dans le modèle type), le projet d'avis ou de lettre d'invitation (B1 du 18/10), et le bordereau
 * ou DQE estimatif. Hors dossier né d'une fiche : aucun.
 */
export function ongletDuFichier(p: PieceJointeDossier, avecFiche: boolean): OngletPieceFournie | null {
  if (!avecFiche) return null;
  const nom = p.nomFichier ?? '';
  // ⚠️ 20/10 (V137) — une pièce jointe d'office par l'attribution (`produitePar`) : reconnue à son nom, comme celles de la fiche.
  if (p.produitePar === 'ATTRIBUTION') {
    if (nom.startsWith('pv-ouverture')) return 'seance';
    if (nom.startsWith('rapport-evaluation')) return 'evaluation';
    if (nom.startsWith('projet-de-marche') || nom.startsWith('bordereau-offre')) return 'attribution';
  }
  if (!p.idDocumentFiche && p.produitePar !== 'ATTRIBUTION') return null;
  if (nom.startsWith('DAO_COMPLET_')) return 'fiche-dao';
  if (nom.startsWith('AVIS_PROJET_') || nom.startsWith('LETTRE_PROJET_')) return 'avis';
  if (nom.startsWith('BORDEREAU_ESTIMATIF_') || nom.startsWith('DQE_ESTIMATIF_')) return 'bordereau';
  return null;
}

/**
 * ⚠️ V118 (15/10) — une pièce jointe d'office par l'application, sans marque propre au serveur : reconnue à son nom de fichier.
 * La publication de l'AGPM reprise du plan (`PUBLICATION_AGPM_<référence>.pdf`) et le relevé d'ouverture des expressions de l'AMI
 * (`releve-ouverture-ami_<idDmc>.pdf`, sous la pièce du PV de l'AMI).
 */
export function originePiece(p: PieceJointeDossier): { libelle: string; titre: string } | null {
  const nom = p.nomFichier ?? '';
  if (nom.startsWith('PUBLICATION_AGPM_')) {
    return { libelle: 'reprise du plan', titre: 'Déposée une fois sur le plan de passation, et reprise d’office par chaque dossier du plan.' };
  }
  if (nom.startsWith('releve-ouverture-ami_')) {
    return { libelle: 'AMI en ligne', titre: 'Produit par l’application avec le rapport de présélection signé, dont les signatures le valident.' };
  }
  return null;
}
