import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { DocumentProcedureEnLigne, ProcedureEnLigne, RecuDao } from '../../models';
import { ProceduresEnLigneService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { FraisDossier } from './frais-dossier';
import { ResultatsPublics } from './resultats-publics';
import { LIBELLES_CATEGORIES } from '../prmp/fiche-marche/fiche-marche-modele';
import { LIBELLES_ETAT_PROCEDURE, dateHeureFr, tailleLisible } from './libelles-candidat';

/**
 * Le détail d'une procédure ouverte en ligne (`GET /api/procedures-en-ligne/{idDmc}`, public, §B8) : calendrier, lots,
 * règles de la remise électronique — tout est lu sur la fiche validée, aucun paramètre interne. Le dossier d'appel
 * d'offres se retire **connecté** : chaque téléchargement inscrit une ligne au registre de la PRMP (compte, entreprise,
 * document, version), et l'écran le dit avant le clic. Hors critères, le serveur répond 404 sans dire lequel manque.
 */
@Component({
  selector: 'app-procedure-en-ligne-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, FraisDossier, ResultatsPublics],
  template: `
    <nav class="ped__ariane" aria-label="Fil d'Ariane">
      <a routerLink="/candidat/procedures">Procédures ouvertes</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{{ procedure()?.reference || 'Procédure' }}</span>
    </nav>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement de la procédure…</p>
    } @else if (introuvable()) {
      <div class="empty-state">
        <p class="empty-state-title">Cette procédure n'est pas ouverte en ligne.</p>
        <p class="empty-state-text">Elle n'existe pas, ou elle ne remplit pas les conditions de la remise électronique. <a routerLink="/candidat/procedures">Revenir aux procédures ouvertes</a>.</p>
      </div>
    } @else if (erreur()) {
      <app-etat-erreur message="La procédure n'a pas pu être chargée." (reessayer)="charger()" />
    } @else if (procedure(); as p) {
      <header class="page-header">
        <div class="page-subtitle">
          <span class="cnm-mono">{{ p.reference || ('procédure ' + p.idDmc) }}</span>
          · <span class="badge" [class.badge-success]="p.etat === 'OUVERTE'" [class.badge-warning]="p.etat === 'A_VENIR'" [class.badge-neutral]="p.etat === 'CLOSE'">{{ etats[p.etat] }}</span>
        </div>
        <h1 class="page-title">{{ p.objet || 'Objet non renseigné' }}</h1>
        <p class="ped__sous">
          @if (p.autoriteContractante) { <span>{{ p.autoriteContractante }}</span> }
          @if (p.categorie) { <span>{{ categories[p.categorie] }}</span> }
        </p>
      </header>

      <div class="ped__grille">
        <section class="card ped__bloc" aria-labelledby="ped-cal">
          <h2 id="ped-cal" class="ped__h2">Calendrier</h2>
          <dl class="ped__dl">
            <dt>Publication de l'avis</dt><dd>{{ p.datePublication ? date(p.datePublication) : '—' }}</dd>
            <dt>Ouverture des dépôts</dt><dd>{{ p.dateOuvertureDepots ? dateHeure(p.dateOuvertureDepots) : '—' }}</dd>
            <dt>Date limite de remise</dt><dd><strong>{{ p.dateLimite ? dateHeure(p.dateLimite) : '—' }}</strong></dd>
            <dt>Heure de référence</dt><dd>{{ p.heureReference || '—' }}</dd>
          </dl>
        </section>

        <section class="card ped__bloc" aria-labelledby="ped-lots">
          <h2 id="ped-lots" class="ped__h2">Lots</h2>
          @if (p.lots.length) {
            <ol class="ped__lots">
              @for (l of p.lots; track l.numero) { <li><span class="ped__lot-n">Lot {{ l.numero }}</span> {{ l.intitule || '' }}</li> }
            </ol>
          } @else {
            <p class="text-muted">Marché non alloti : une seule offre, pour l'ensemble.</p>
          }
        </section>

        <section class="card ped__bloc" aria-labelledby="ped-remise">
          <h2 id="ped-remise" class="ped__h2">Remise électronique</h2>
          <dl class="ped__dl">
            <dt>Signature exigée</dt><dd>{{ p.signatureExigee || 'Simple' }}</dd>
            <dt>Formats acceptés</dt><dd>{{ p.formatsAcceptes?.length ? p.formatsAcceptes!.join(', ') : '—' }}</dd>
            <dt>Taille maximale par fichier</dt><dd>{{ p.tailleMaxFichierMo != null ? p.tailleMaxFichierMo + ' Mo' : '—' }}</dd>
            <dt>Taille maximale par offre</dt><dd>{{ p.tailleMaxOffreMo != null ? p.tailleMaxOffreMo + ' Mo' : '—' }}</dd>
          </dl>
          @if (p.assistance) { <p class="ped__assist"><strong>Assistance aux candidats :</strong> {{ p.assistance }}</p> }
          <!-- ⚠️ Lot 3 (V68) — le dépôt : ouvert entre l'ouverture des dépôts et la date limite, à l'heure du serveur. -->
          @if (p.depotsOuverts && connecte() && !retraitAutorise()) {
            <!-- 06/10 (décision A) : dossier payant, le dépôt attend le reçu validé. -->
            <button type="button" class="btn btn-primary ped__deposer" disabled>Déposer une offre</button>
            <span class="text-sm text-muted">Le dépôt s’ouvre dès que votre reçu de paiement des frais de dossier est validé (section « Frais de dossier »).</span>
          } @else if (p.depotsOuverts && connecte()) {
            @if (p.categorie === 'PRESTATIONS_INTELLECTUELLES') {
              <!-- ⚠️ V86 (PI-b) — une proposition PI se dépose en deux enveloppes, la technique d'abord. -->
              <a class="btn btn-primary ped__deposer" [routerLink]="['/candidat', 'procedures', p.idDmc, 'offre']" [queryParams]="{ enveloppe: 'TECHNIQUE' }">Déposer ma proposition</a>
              <span class="text-sm text-muted">Deux enveloppes, chiffrées sur votre poste et déposées l’une après l’autre : la technique, sans aucun montant, puis la financière. Personne ne peut les lire avant leur séance d’ouverture.</span>
            } @else {
              <a class="btn btn-primary ped__deposer" [routerLink]="['/candidat', 'procedures', p.idDmc, 'offre']">Déposer une offre</a>
              <span class="text-sm text-muted">Votre offre est chiffrée sur votre poste : personne ne peut la lire avant la séance d'ouverture.{{ p.remplacementAutorise ? ' Vous pourrez la remplacer ou la retirer jusqu’à la date limite.' : '' }}</span>
            }
          } @else if (p.depotsOuverts) {
            <p class="text-sm">Pour déposer une offre, <a routerLink="/login" [queryParams]="{ returnUrl: lienRetour() }">connectez-vous</a> avec votre compte candidat.</p>
          } @else {
            <p class="text-sm text-muted">{{ p.etat === 'CLOSE' ? 'La date limite est passée : les dépôts sont clos.' : 'Les dépôts ne sont pas encore ouverts.' }}</p>
          }
        </section>

        @if (p.etat === 'CLOSE') {
          <!-- Recette du 05/10 : le PV publié n'était lisible nulle part à l'écran. -->
          <section class="card ped__bloc ped__bloc--large" aria-labelledby="ped-pv">
            <h2 id="ped-pv" class="ped__h2">Procès-verbal d'ouverture des plis</h2>
            <p class="text-sm">Quand la fiche le prévoit, un extrait du procès-verbal d'ouverture est publié ici après sa signature par la commission.</p>
            @if (pvAbsent()) {
              <p class="text-sm text-muted" role="status">Le procès-verbal d'ouverture n'est pas publié pour cette procédure.</p>
            } @else {
              <p><button type="button" class="btn btn-secondary btn-sm" [disabled]="pvEnCours()" (click)="lirePv(p.idDmc)">{{ pvEnCours() ? 'Ouverture…' : 'Lire le PV d’ouverture (PDF)' }}</button></p>
            }
          </section>
          <!-- ⚠️ 07/10 (attribution) — le résultat par lot, puis l'avis d'attribution publié (art. 53). -->
          <div class="ped__bloc--large"><app-resultats-publics [idDmc]="p.idDmc" /></div>
        }

        @if (p.retraitPayant) {
          <!-- V72 (06/10, voie B) : le dossier se retire après validation du reçu des frais de dossier. -->
          <section class="card ped__bloc ped__bloc--large" aria-labelledby="ped-frais">
            <h2 id="ped-frais" class="ped__h2">Frais de dossier</h2>
            @if (connecte()) {
              <app-frais-dossier [procedure]="p" [(recu)]="recu" />
            } @else {
              <p class="text-sm">Le dossier est payant. Pour déposer votre reçu de paiement, <a routerLink="/login" [queryParams]="{ returnUrl: lienRetour() }">connectez-vous</a> avec votre compte candidat.</p>
            }
          </section>
        }

        <section class="card ped__bloc ped__bloc--large" aria-labelledby="ped-docs">
          <h2 id="ped-docs" class="ped__h2">Dossier d'appel d'offres</h2>
          @if (!connecte()) {
            <p>Le dossier se retire avec un compte candidat. <a routerLink="/login" [queryParams]="{ returnUrl: lienRetour() }">Connectez-vous</a> ou <a routerLink="/candidat/inscription">créez un compte</a>.</p>
          } @else if (docsChargement()) {
            <p class="text-muted" role="status">Chargement des documents…</p>
          } @else if (docsErreur()) {
            <app-etat-erreur message="Les documents n'ont pas pu être listés." (reessayer)="chargerDocuments()" />
          } @else if (!documents().length) {
            <p class="text-muted">Aucun document n'est encore disponible pour cette procédure.</p>
          } @else {
            <p class="text-sm text-muted">Chaque retrait est inscrit au registre de la personne responsable des marchés, avec votre compte et votre entreprise.</p>
            @if (!retraitAutorise()) {
              <p class="alert alert-info" role="status"><span>Les documents se retireront dès que votre reçu de paiement des frais de dossier sera validé (section « Frais de dossier »).</span></p>
            }
            <ul class="ped__docs">
              @for (d of documents(); track d.code) {
                <li class="ped__doc">
                  <span class="ped__doc-nom">{{ d.intitule }}</span>
                  <span class="ped__doc-meta cnm-mono">{{ d.code }} · v{{ d.version }}{{ d.taille != null ? ' · ' + taille(d.taille) : '' }}</span>
                  <button type="button" class="btn btn-sm btn-primary" [disabled]="enCours() === d.code || !retraitAutorise()" (click)="retirer(d)">{{ enCours() === d.code ? 'Retrait…' : 'Retirer' }}</button>
                </li>
              }
            </ul>
          }
        </section>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .ped__ariane { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); margin-bottom: 0.75rem; }
    .ped__ariane a { color: var(--p-700); font-weight: 600; }
    .ped__sous { margin: 0.25rem 0 0; display: flex; gap: 0.75rem; flex-wrap: wrap; color: var(--n-500); font-size: var(--text-sm); }
    .ped__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); gap: 0.9rem; }
    .ped__bloc { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .ped__bloc--large { grid-column: 1 / -1; }
    .ped__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ped__dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; font-size: var(--text-sm); }
    .ped__dl dt { color: var(--n-500); }
    .ped__dl dd { margin: 0; }
    .ped__lots { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--text-sm); }
    .ped__lot-n { font-weight: 700; margin-right: 0.3rem; }
    .ped__assist { margin: 0; font-size: var(--text-sm); white-space: pre-line; }
    .ped__deposer { align-self: flex-start; }
    .ped__docs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .ped__doc { display: grid; grid-template-columns: 1fr auto auto; gap: 0.75rem; align-items: center; padding: 0.5rem 0.75rem; border: 1px solid var(--n-200); border-radius: var(--radius-md); }
    .ped__doc-nom { font-weight: 600; }
    .ped__doc-meta { font-size: var(--text-xs); color: var(--n-500); }
    @media (max-width: 600px) { .ped__doc { grid-template-columns: 1fr; } .ped__dl { grid-template-columns: 1fr; } }
  `,
})
export class ProcedureEnLigneDetail implements OnInit {
  private readonly service = inject(ProceduresEnLigneService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  readonly etats = LIBELLES_ETAT_PROCEDURE;
  readonly categories = LIBELLES_CATEGORIES;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly connecte = computed(() => this.auth.isAuthenticated() && this.auth.role() === 'CANDIDAT');
  readonly lienRetour = computed(() => `/candidat/procedures/${this.idDmc}`);

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly introuvable = signal(false);
  readonly procedure = signal<ProcedureEnLigne | null>(null);

  readonly docsChargement = signal(false);
  readonly docsErreur = signal(false);
  readonly documents = signal<DocumentProcedureEnLigne[]>([]);
  /** Le `code` du document en cours de retrait : un seul à la fois, le bouton le dit. */
  readonly enCours = signal<string | null>(null);
  readonly pvEnCours = signal(false);
  /** V72 — le reçu des frais de l'entreprise (lu par `app-frais-dossier`). */
  readonly recu = signal<RecuDao | null>(null);
  /** Retrait libre, ou reçu validé : le serveur garde la même règle (403 `FRAIS_NON_REGLES`). */
  readonly retraitAutorise = computed(() => !this.procedure()?.retraitPayant || this.recu()?.etat === 'VALIDE');
  readonly pvAbsent = signal(false);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.introuvable.set(false);
    this.service.detail(this.idDmc).subscribe({
      next: (p) => {
        this.procedure.set(p);
        this.document.title = `${p.reference || 'Procédure'} — Espace candidat — PRS 2.0`;
        this.chargement.set(false);
        if (this.connecte()) this.chargerDocuments();
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 404) this.introuvable.set(true);
        else this.erreur.set(true);
      },
    });
  }

  chargerDocuments(): void {
    this.docsChargement.set(true);
    this.docsErreur.set(false);
    this.service.documents(this.idDmc).subscribe({
      next: (docs) => {
        // V73 (06/10) — le dossier complet d'abord, puis les classeurs ; l'ordre du serveur sinon.
        this.documents.set([...docs].sort((a, b) => Number(/^DAO_COMPLET/i.test(b.code)) - Number(/^DAO_COMPLET/i.test(a.code))));
        this.docsChargement.set(false);
      },
      error: () => {
        this.docsErreur.set(true);
        this.docsChargement.set(false);
      },
    });
  }

  /** Le geste qui s'inscrit au registre : jamais déclenché par l'écran, toujours par le candidat. */
  retirer(d: DocumentProcedureEnLigne): void {
    if (this.enCours()) return;
    this.enCours.set(d.code);
    this.service.telecharger(this.idDmc, d.code).subscribe({
      next: (blob) => {
        telechargerBlob(blob, d.code);
        this.enCours.set(null);
        this.toast.success(`« ${d.intitule} » est enregistré sur votre poste. Ce retrait est inscrit au registre.`, 'Dossier retiré');
      },
      // 401/403 → dialogue centralisé ; 403 FRAIS_NON_REGLES (reçu pas encore validé) le dit en clair.
      error: () => this.enCours.set(null),
    });
  }

  /** L'extrait public du PV d'ouverture, ouvert dans un nouvel onglet (`ouvrirBlobSur`) ; 404 : non publié. */
  lirePv(idDmc: number): void {
    this.pvEnCours.set(true);
    this.service.pv(idDmc).subscribe({
      next: (b) => {
        this.pvEnCours.set(false);
        ouvrirBlobSur(b);
      },
      error: (e: { status?: number }) => {
        this.pvEnCours.set(false);
        if (e.status === 404) this.pvAbsent.set(true);
      },
    });
  }
}
