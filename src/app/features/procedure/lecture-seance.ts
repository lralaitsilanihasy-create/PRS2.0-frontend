import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';

import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { DocumentFormulaire, Lecture, OffreLue, TypeAlerteLecture } from '../../models';
import { SeanceService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

const LIBELLES_INTEGRITE: Readonly<Record<string, string>> = {
  INTACTE: 'Intacte',
  ALTEREE: 'Altérée',
  LECTURE_IMPOSSIBLE: 'Lecture impossible',
};

/**
 * La **lecture en séance** (lot 4, `GET …/seance/lecture`) : offre par offre, dans l'ordre d'arrivée, ce que la séance lit à
 * haute voix — soumissionnaire et groupement, lot, montants, délai, validité, rabais, garantie, pièces manquantes, intégrité,
 * vérification du NIF, alertes (rapprochements, exclusion) — puis les offres non ouvertes et pourquoi. Les pièces s'ouvrent par
 * `ouvrirBlobSur` (`piecesOuvrables` : les membres de la CAO seulement, arbitrage du pilote du 04/10 ; les autres lisent sans
 * ouvrir). `projection` grossit le texte.
 */
@Component({
  selector: 'app-lecture-seance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    @if (chargement()) {
      <p class="text-muted" role="status">Chargement de la lecture…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="La lecture n'a pas pu être chargée." (reessayer)="charger()" />
    } @else if (lecture(); as l) {
      <div class="ls" [class.ls--projection]="projection()">
        @if (!l.offres.length && !l.nonOuvertes.length) { <p class="empty-state-title">Aucune offre n'a été déposée.</p> }
        @for (o of l.offres; track o.idOffre) {
          <article class="card ls__offre" [attr.aria-label]="'Offre n° ' + (o.numero ?? '?')">
            <header class="ls__tete">
              <h3 class="ls__titre">Offre n° {{ o.numero ?? '—' }}{{ o.lot ? ' — lot ' + o.lot : '' }} · {{ o.entreprise.raisonSociale }}</h3>
              <span class="badge" [class.badge-success]="o.integrite === 'INTACTE'" [class.badge-danger]="o.integrite !== 'INTACTE'">{{ integrites[o.integrite] ?? o.integrite }}</span>
            </header>
            @if (o.motif) { <p class="text-sm ls__motif">{{ o.motif }}</p> }
            <p class="text-sm">NIF <span class="cnm-mono">{{ o.entreprise.nif }}</span>@if (o.entreprise.verification; as v) { · vérification : {{ v.statut }} }</p>
            @if (o.groupement?.length) { <p class="text-sm">Groupement : {{ membres(o) }}</p> }
            @if (o.acteEngagement; as a) {
              <dl class="ls__ae">
                <dt>Montant HT</dt><dd>{{ montant(a.montantHt) }}</dd>
                <dt>Montant TTC</dt><dd><strong>{{ montant(a.montantTtc) }}</strong></dd>
                <dt>Délai</dt><dd>{{ a.delai }} {{ a.delaiUnite === 'MOIS' ? 'mois' : 'jours' }}</dd>
                <dt>Validité</dt><dd>{{ a.validiteJours }} jours</dd>
                <dt>Rabais</dt><dd>{{ o.rabais?.lecture || (isTexte(a.rabais) ? a.rabais : '') || '—' }}</dd>
                <dt>Garantie</dt><dd>{{ garantie(o) }}</dd>
                @if (o.fraisDossier; as fr) {
                  <!-- V72 : le reçu des frais de dossier, validé avant le retrait (lu par le serveur, pas dans l'offre). -->
                  <dt>Frais de dossier</dt><dd>{{ fr.regle ? 'réglés' + (fr.referencePaiement ? ' · réf. ' + fr.referencePaiement : '') + (fr.dateValidation ? ' · reçu validé le ' + dateCourte(fr.dateValidation) : '') : 'aucun reçu validé' }}</dd>
                }
              </dl>
            }
            @if (o.formulaires && o.totaux; as t) {
              <!-- Lot 5 : les totaux recalculés par le serveur depuis le bordereau scellé. -->
              <dl class="ls__ae ls__totaux" aria-label="Totaux recalculés depuis le bordereau">
                <dt>Bordereau, HT</dt><dd>{{ montant(t.ht) }}</dd>
                <dt>Bordereau, TTC</dt><dd>{{ montant(t.ttc) }}</dd>
                @if (t.htMin != null) {
                  <dt>Au minimum, HT</dt><dd>{{ montant(t.htMin) }}</dd>
                  <dt>Au minimum, TTC</dt><dd>{{ montant(t.ttcMin) }}</dd>
                }
              </dl>
            }
            @if (o.piecesManquantes.length) { <p class="text-sm ls__manque">Pièces manquantes : {{ o.piecesManquantes.join(' ; ') }}</p> }
            @for (a of o.alertes; track $index) { <p class="alert alert-warning ls__alerte" role="note"><span>{{ alertes[a.type] ?? a.type }} : {{ a.message }}</span></p> }
            @if (erreurPiece()?.idOffre === o.idOffre) { <p class="alert alert-danger" role="alert"><span>{{ erreurPiece()!.message }}</span></p> }
            @if (piecesOuvrables() && documents(o).length) {
              <ul class="ls__pieces" aria-label="Formulaires remplis en ligne">
                @for (d of documents(o); track d.type) {
                  <li><button type="button" class="btn btn-sm btn-secondary" [disabled]="ouverture() === o.idOffre + d.type" (click)="ouvrirFormulaire(o.idOffre, d.type)">{{ d.libelle }} (rempli)</button></li>
                }
              </ul>
            }
            @if (piecesOuvrables() && o.pieces.length) {
              <ul class="ls__pieces">
                @for (p of o.pieces; track p.code) {
                  <li>
                    @if (p.presente && p.nomFichier) {
                      <button type="button" class="btn btn-sm btn-outline" [disabled]="ouverture() === o.idOffre + p.nomFichier" (click)="ouvrir(o.idOffre, p.nomFichier!)">{{ p.libelle }}</button>
                      @if (p.empreinteConforme === false) { <span class="badge badge-danger">empreinte non conforme</span> }
                    } @else { <span class="text-sm text-muted">{{ p.libelle }} — absente</span> }
                  </li>
                }
              </ul>
            }
          </article>
        }
        @if (l.nonOuvertes.length) {
          <h3 class="ls__h3">Offres non ouvertes</h3>
          <ul class="ls__non">
            @for (n of l.nonOuvertes; track $index) { <li>N° {{ n.numero ?? '—' }} · {{ n.entreprise }} — {{ n.etat }}{{ n.motif ? ' : ' + n.motif : '' }}</li> }
          </ul>
        }
      </div>
    }
  `,
  styles: `
    .ls { display: flex; flex-direction: column; gap: 0.75rem; }
    .ls__offre { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .ls__tete { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .ls__titre { margin: 0; font-size: 1rem; }
    .ls__motif, .ls__manque { margin: 0; color: var(--danger-text); }
    .ls__ae { margin: 0; display: grid; grid-template-columns: max-content 1fr max-content 1fr; gap: 0.25rem 1rem; font-size: var(--text-sm); }
    .ls__ae dt { color: var(--n-500); }
    .ls__ae dd { margin: 0; }
    .ls__alerte { margin: 0; }
    .ls__totaux { padding-top: 0.3rem; border-top: 1px dashed var(--n-200); }
    .ls__pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .ls__h3 { margin: 0.5rem 0 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ls__non { margin: 0; padding-left: 1.2rem; font-size: var(--text-sm); }
    .ls--projection { font-size: 1.25rem; }
    .ls--projection .ls__titre { font-size: 1.5rem; }
    .ls--projection .ls__ae { font-size: 1.2rem; }
    @media (max-width: 700px) { .ls__ae { grid-template-columns: max-content 1fr; } }
  `,
})
export class LectureSeance implements OnInit {
  readonly idDmc = input.required<number>();
  readonly piecesOuvrables = input(true);
  readonly projection = input(false);

  private readonly service = inject(SeanceService);

  readonly integrites = LIBELLES_INTEGRITE;
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly lecture = signal<Lecture | null>(null);
  readonly ouverture = signal<string | null>(null);
  readonly erreurPiece = signal<{ idOffre: string; message: string } | null>(null);
  readonly alertes: Readonly<Record<TypeAlerteLecture, string>> = {
    RAPPROCHEMENT: 'Rapprochement',
    EXCLUSION: 'Exclusion',
    GARANTIE_INSUFFISANTE: 'Garantie insuffisante',
    TOTAL_DIVERGENT: 'Total divergent',
    AE_DIVERGENT: 'Acte d’engagement divergent du bordereau',
    PRIX_MANQUANT: 'Prix manquant',
    LETTRES_DIVERGENTES: 'Prix en lettres divergent des chiffres',
    PLAFOND_DEPASSE: 'Plafond dépassé',
    NON_CONFORME: 'Non-conformité déclarée',
    LIVRAISON_HORS_DELAI: 'Livraison hors délai',
    CA_INSUFFISANT: 'Chiffre d’affaires insuffisant',
    LIQUIDITE_INSUFFISANTE: 'Liquidité insuffisante',
    REFERENCES_INSUFFISANTES: 'Références insuffisantes',
    PERSONNEL_INCOMPLET: 'Personnel incomplet',
    MATERIEL_INCOMPLET: 'Matériel incomplet',
    SOUS_DETAIL_INCOHERENT: 'Sous-détail incohérent',
    FORMULAIRES_ILLISIBLES: 'Formulaires illisibles',
    FRAIS_NON_REGLES: 'Frais de dossier non réglés',
    RABAIS_INVALIDE: 'Rabais invalide',
    RABAIS_LOTS: 'Rabais : lots incohérents',
  };
  /** Lot 5 — les documents remplis, produits à la volée ; le DQE des travaux est le même document que le bordereau. */
  readonly documentsFormulaires: readonly { type: DocumentFormulaire; libelle: string }[] = [
    { type: 'BORDEREAU', libelle: 'Bordereau des prix' },
    { type: 'CONFORMITE', libelle: 'Conformité technique' },
    { type: 'CAPACITES', libelle: 'Capacités' },
  ];

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.lecture(this.idDmc()).subscribe({
      next: (l) => {
        this.lecture.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  membres(o: OffreLue): string {
    return (o.groupement ?? []).map((g) => `${g.raisonSociale} (${g.nif})${g.mandataire ? ', mandataire' : ''}`).join(' ; ');
  }

  dateCourte(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR');
  }

  /** Un rabais texte (offres plus anciennes) ; le rabais structuré se lit dans `OffreLue.rabais.lecture`. */
  isTexte(v: unknown): v is string {
    return typeof v === 'string' && !!v;
  }

  montant(v: number | null | undefined): string {
    return v == null ? '—' : `${new Intl.NumberFormat('fr-FR').format(v)} Ar`;
  }

  /** ⚠️ V70 (§B3) : montant et émetteur lus au manifeste de format 2 ; une offre de format 1 n'a que le code. */
  garantie(o: OffreLue): string {
    const g = o.garantie;
    if (!g) return '—';
    const parts = [g.presente ? 'jointe' : 'absente'];
    if (g.montant != null) parts.push(this.montant(g.montant));
    if (g.emetteur) parts.push('émise par ' + g.emetteur);
    parts.push('code ' + g.codeVerification);
    return parts.join(' · ');
  }

  /** §B5 — seulement les documents que l'offre porte (`partiesFormulaires`, servi par la lecture). */
  documents(o: OffreLue): readonly { type: DocumentFormulaire; libelle: string }[] {
    const parties = o.partiesFormulaires ?? [];
    return this.documentsFormulaires.filter((d) => parties.includes(d.type));
  }

  ouvrirFormulaire(idOffre: string, type: DocumentFormulaire): void {
    this.ouverture.set(idOffre + type);
    this.erreurPiece.set(null);
    this.service.formulairePdf(this.idDmc(), idOffre, type).subscribe({
      next: (b) => {
        this.ouverture.set(null);
        ouvrirBlobSur(b);
      },
      error: (e: { status?: number }) => {
        this.ouverture.set(null);
        const message =
          e.status === 403
            ? 'Les formulaires des offres sont réservés aux membres de la commission d’appel d’offres.'
            : e.status === 404
              ? 'Ce formulaire n’est plus conservé : la durée de conservation des offres est échue.'
              : 'Le formulaire n’a pas pu être produit.';
        this.erreurPiece.set({ idOffre, message });
      },
    });
  }

  ouvrir(idOffre: string, nom: string): void {
    this.ouverture.set(idOffre + nom);
    this.erreurPiece.set(null);
    this.service.piece(this.idDmc(), idOffre, nom).subscribe({
      next: (b) => {
        this.ouverture.set(null);
        ouvrirBlobSur(b);
      },
      // Le corps d'erreur d'un Blob n'est pas décodé : le refus est nommé d'après le statut (V70 — 403 `PIECE_RESERVEE_CAO`,
      // 404 après la purge de conservation).
      error: (e: { status?: number }) => {
        this.ouverture.set(null);
        const message =
          e.status === 403
            ? 'Les pièces des offres sont réservées aux membres de la commission d’appel d’offres.'
            : e.status === 404
              ? 'Cette pièce n’est plus conservée : la durée de conservation des offres est échue et elles ont été purgées.'
              : 'La pièce n’a pas pu être ouverte.';
        this.erreurPiece.set({ idOffre, message });
      },
    });
  }
}
