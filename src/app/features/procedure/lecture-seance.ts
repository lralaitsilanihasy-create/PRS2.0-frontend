import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, inject, input, signal } from '@angular/core';

import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { DocumentFormulaire, Lecture, OffreLue, TypeAlerteLecture } from '../../models';
import { SeanceService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_STATUT_NIF } from '../candidat/libelles-candidat';

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
        @if (l.offres.length) {
          <!-- ⚠️ 19/10 (pilote) — la synthèse de la lecture, dans l'ordre d'arrivée : aller d'un coup d'œil à l'offre voulue. -->
          <div class="ls__synthese">
            <table class="ls__table" aria-label="Synthèse de la lecture des offres">
              <thead><tr><th scope="col">N°</th><th scope="col">Soumissionnaire</th><th scope="col" class="ls__num">Montant TTC</th><th scope="col">Délai</th><th scope="col">Intégrité</th><th scope="col">Alertes</th></tr></thead>
              <tbody>
                @for (o of l.offres; track o.idOffre) {
                  <tr>
                    <td><a class="ls__ancre" [href]="'#offre-' + o.idOffre" [attr.aria-label]="'Aller à l’offre n° ' + (o.numero ?? '?')" (click)="aller($event, o.idOffre)">{{ o.numero ?? '—' }}</a></td>
                    <td>{{ o.entreprise.raisonSociale }}{{ o.lot ? ' — lot ' + o.lot : '' }}</td>
                    <td class="ls__num"><strong>{{ montant(o.acteEngagement?.montantTtc) }}</strong></td>
                    <td>{{ o.acteEngagement ? o.acteEngagement.delai + ' ' + (o.acteEngagement.delaiUnite === 'MOIS' ? 'mois' : 'jours') : '—' }}</td>
                    <td><span class="badge" [class.badge-success]="o.integrite === 'INTACTE'" [class.badge-danger]="o.integrite !== 'INTACTE'">{{ integrites[o.integrite] ?? o.integrite }}</span></td>
                    <td>
                      @if (o.alertes.length || o.piecesManquantes.length) {
                        <span class="badge badge-warning">{{ o.alertes.length + (o.piecesManquantes.length ? 1 : 0) }}</span>
                      } @else {
                        <span class="text-muted">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @for (o of l.offres; track o.idOffre) {
          <article class="card ls__offre" tabindex="-1" [id]="'offre-' + o.idOffre" [class.ls__offre--ko]="o.integrite !== 'INTACTE'" [attr.aria-label]="'Offre n° ' + (o.numero ?? '?')">
            <header class="ls__tete">
              <span class="ls__numero" aria-hidden="true">{{ o.numero ?? '?' }}</span>
              <div class="ls__ident">
                <h3 class="ls__titre">{{ o.entreprise.raisonSociale }}{{ o.lot ? ' — lot ' + o.lot : '' }}</h3>
                <span class="text-sm text-muted">Offre n° {{ o.numero ?? '—' }} · NIF <span class="cnm-mono">{{ o.entreprise.nif }}</span>
                  @if (o.entreprise.verification; as v) {
                    · <span [class.ls__nif-ok]="v.statut === 'VERIFIE_DGI' || v.statut === 'VERIFIE_SUR_PIECES'" [class.ls__nif-ko]="v.statut === 'INCONNU_DGI' || v.statut === 'REFUSE_SUR_PIECES'">{{ statutsNif[v.statut] ?? v.statut }}</span>
                  }
                </span>
              </div>
              <span class="badge" [class.badge-success]="o.integrite === 'INTACTE'" [class.badge-danger]="o.integrite !== 'INTACTE'">{{ integrites[o.integrite] ?? o.integrite }}</span>
            </header>
            @if (o.motif) { <p class="text-sm ls__motif">{{ o.motif }}</p> }
            @if (o.groupement?.length) { <p class="text-sm ls__ligne">Groupement : {{ membres(o) }}</p> }
            @if (o.acteEngagement; as a) {
              <div class="ls__montants">
                <div class="ls__montant"><span>Montant HT</span><strong>{{ montant(a.montantHt) }}</strong></div>
                <div class="ls__montant ls__montant--ttc"><span>Montant TTC</span><strong>{{ montant(a.montantTtc) }}</strong></div>
                @if (o.formulaires && o.totaux; as t) {
                  <!-- Lot 5 : les totaux recalculés par le serveur depuis le bordereau scellé. -->
                  <div class="ls__montant ls__montant--calc" aria-label="Totaux recalculés depuis le bordereau"><span>Bordereau recalculé</span><strong>{{ montant(t.ttc) }} TTC</strong><small>{{ montant(t.ht) }} HT</small></div>
                  @if (t.htMin != null) {
                    <div class="ls__montant ls__montant--calc"><span>Au minimum</span><strong>{{ montant(t.ttcMin) }} TTC</strong><small>{{ montant(t.htMin) }} HT</small></div>
                  }
                }
              </div>
              <dl class="ls__ae">
                <div><dt>Délai</dt><dd>{{ a.delai }} {{ a.delaiUnite === 'MOIS' ? 'mois' : 'jours' }}</dd></div>
                <div><dt>Validité</dt><dd>{{ a.validiteJours }} jours</dd></div>
                <div><dt>Rabais</dt><dd>{{ o.rabais?.lecture || (isTexte(a.rabais) ? a.rabais : '') || '—' }}</dd></div>
                <div><dt>Garantie</dt><dd>{{ garantie(o) }}</dd></div>
                @if (o.fraisDossier; as fr) {
                  <!-- V72 : le reçu des frais de dossier, validé avant le retrait (lu par le serveur, pas dans l'offre). -->
                  <div class="ls__large"><dt>Frais de dossier</dt><dd>{{ fr.regle ? 'réglés' + (fr.referencePaiement ? ' · réf. ' + fr.referencePaiement : '') + (fr.dateValidation ? ' · reçu validé le ' + dateCourte(fr.dateValidation) : '') : 'aucun reçu validé' }}</dd></div>
                }
              </dl>
            }
            @if (o.piecesManquantes.length) { <p class="text-sm ls__manque">Pièces manquantes : {{ o.piecesManquantes.join(' ; ') }}</p> }
            @for (a of o.alertes; track $index) { <p class="alert alert-warning ls__alerte" role="note"><span>{{ alertes[a.type] ?? a.type }} : {{ a.message }}</span></p> }
            @if (erreurPiece()?.idOffre === o.idOffre) { <p class="alert alert-danger" role="alert"><span>{{ erreurPiece()!.message }}</span></p> }
            @if (piecesOuvrables() && (documents(o).length || o.pieces.length)) {
              <div class="ls__docs">
                @if (documents(o).length) {
                  <div class="ls__groupe">
                    <span class="ls__groupe-titre">Formulaires remplis en ligne</span>
                    <ul class="ls__pieces" aria-label="Formulaires remplis en ligne">
                      @for (d of documents(o); track d.type) {
                        <li><button type="button" class="btn btn-sm btn-secondary" [disabled]="ouverture() === o.idOffre + d.type" (click)="ouvrirFormulaire(o.idOffre, d.type)">{{ d.libelle }}</button></li>
                      }
                    </ul>
                  </div>
                }
                @if (o.pieces.length) {
                  <div class="ls__groupe">
                    <span class="ls__groupe-titre">Pièces jointes</span>
                    <ul class="ls__pieces" aria-label="Pièces jointes de l'offre">
                      @for (p of o.pieces; track p.code) {
                        <li>
                          @if (p.presente && p.nomFichier) {
                            <button type="button" class="btn btn-sm btn-outline" [disabled]="ouverture() === o.idOffre + p.nomFichier" (click)="ouvrir(o.idOffre, p.nomFichier!)">{{ p.libelle }}</button>
                            @if (p.empreinteConforme === false) { <span class="badge badge-danger">empreinte non conforme</span> }
                          } @else {
                            <span class="text-sm text-muted">{{ p.libelle }} — absente</span>
                          }
                        </li>
                      }
                    </ul>
                  </div>
                }
              </div>
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
    .ls { display: flex; flex-direction: column; gap: 0.8rem; }
    .ls__synthese { overflow-x: auto; border: 1px solid var(--n-200); border-radius: 10px; background: #fff; }
    .ls__table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .ls__table th { text-align: left; padding: 0.5rem 0.75rem; background: var(--p-100); color: var(--p-800); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
    .ls__table td { padding: 0.5rem 0.75rem; border-top: 1px solid var(--n-100); vertical-align: middle; }
    .ls__table .ls__num { text-align: right; white-space: nowrap; }
    .ls__ancre { display: inline-grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 50%; background: var(--p-100); color: var(--p-800); font-weight: 700; text-decoration: none; }
    .ls__ancre:hover, .ls__ancre:focus-visible { background: var(--p-600); color: #fff; }
    .ls__offre { padding: 1rem 1.15rem; display: flex; flex-direction: column; gap: 0.7rem; border-left: 4px solid var(--success-bdr); scroll-margin-top: 1rem; }
    .ls__offre:focus { outline: none; box-shadow: 0 0 0 3px var(--p-200); }
    .ls__offre--ko { border-left-color: var(--danger-bdr); }
    .ls__tete { display: flex; gap: 0.75rem; align-items: center; }
    .ls__numero { flex: none; width: 2.4rem; height: 2.4rem; border-radius: 50%; display: grid; place-items: center; background: var(--p-600); color: #fff; font-weight: 700; }
    .ls__ident { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .ls__titre { margin: 0; font-size: 1.05rem; }
    .ls__nif-ok { color: var(--success-text); font-weight: 600; }
    .ls__nif-ko { color: var(--danger-text); font-weight: 600; }
    .ls__motif, .ls__manque { margin: 0; color: var(--danger-text); }
    .ls__ligne { margin: 0; }
    .ls__montants { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.6rem; }
    .ls__montant { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.55rem 0.8rem; border-radius: 8px; background: var(--n-100); }
    .ls__montant span { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ls__montant strong { font-size: 1.05rem; color: var(--n-900); }
    .ls__montant small { font-size: 0.75rem; color: var(--n-500); }
    .ls__montant--ttc { background: var(--p-100); }
    .ls__montant--ttc strong { color: var(--p-800); }
    .ls__montant--calc { background: var(--info-bg); }
    .ls__ae { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.5rem 1rem; font-size: var(--text-sm); }
    .ls__ae > div { display: flex; flex-direction: column; }
    .ls__ae dt { color: var(--n-500); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .ls__ae dd { margin: 0; color: var(--n-800); }
    .ls__large { grid-column: 1 / -1; }
    .ls__alerte { margin: 0; }
    .ls__docs { display: flex; flex-wrap: wrap; gap: 0.75rem 1.5rem; padding-top: 0.7rem; border-top: 1px solid var(--n-200); }
    .ls__groupe { display: flex; flex-direction: column; gap: 0.35rem; }
    .ls__groupe-titre { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); font-weight: 600; }
    .ls__pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
    .ls__h3 { margin: 0.5rem 0 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ls__non { margin: 0; padding-left: 1.2rem; font-size: var(--text-sm); }
    .ls--projection { font-size: 1.25rem; }
    .ls--projection .ls__titre { font-size: 1.5rem; }
    .ls--projection .ls__table, .ls--projection .ls__ae { font-size: 1.15rem; }
    .ls--projection .ls__montant strong { font-size: 1.5rem; }
  `,
})
export class LectureSeance implements OnInit {
  readonly idDmc = input.required<number>();
  readonly piecesOuvrables = input(true);
  readonly projection = input(false);

  private readonly service = inject(SeanceService);
  private readonly document = inject(DOCUMENT);

  readonly integrites = LIBELLES_INTEGRITE;
  readonly statutsNif: Readonly<Record<string, string>> = LIBELLES_STATUT_NIF;
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
    MONTANT_DANS_TECHNIQUE: 'Montant dans l’enveloppe technique',
    FINANCIERE_MANQUANTE: 'Enveloppe financière manquante',
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

  /** ⚠️ 19/10 — la synthèse mène à la carte de l'offre sans toucher à l'URL. */
  aller(e: Event, idOffre: string): void {
    e.preventDefault();
    const cible = this.document.getElementById('offre-' + idOffre);
    cible?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    cible?.focus({ preventScroll: true });
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
