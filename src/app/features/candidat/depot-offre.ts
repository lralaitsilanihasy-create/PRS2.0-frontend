import { ChangeDetectionStrategy, Component, DOCUMENT, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { formaterEmpreinte } from '../../core/securite/cles-detenteur';
import { telechargerBlob, validerFichier } from '../../core/securite/fichiers-surs';
import { ActeEngagementSaisi, MembreGroupement, PieceJointe, construireContenu, sceller, typesDesFormats } from '../../core/securite/scellement';
import { Accuse, ClesPubliques, Entreprise, PieceAttendue, ProcedureEnLigne } from '../../models';
import { CeremonieService, EntrepriseCandidatService, OffresCandidatService, ProceduresEnLigneService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr, messageExclusion, tailleLisible } from './libelles-candidat';

/** Les étapes du dépôt, telles qu'on les montre pendant le scellement et l'envoi. */
type Phase = 'saisie' | 'archive' | 'scellement' | 'envoi' | 'cloture' | 'fait';

const ESSAIS_PAR_MORCEAU = 3;

/** Notre mot pour les codes du dépôt ; le message du serveur, servi tel quel, quand il nomme lui-même (exclusion). */
function motifDepot(e: unknown): string {
  const api = e as Partial<ApiError>;
  switch (codeErreur(api as ApiError)) {
    case 'ENTREPRISE_EXCLUE':
      return api.message || 'Votre entreprise est exclue des marchés publics : vous ne pouvez pas déposer d’offre.';
    case 'PROCEDURE_FERMEE':
      return 'Les dépôts ne sont pas ouverts pour cette procédure.';
    case 'DELAI_DEPASSE':
      return 'La date limite de remise est passée, à l’heure du serveur : l’offre n’a pas été déposée.';
    case 'CLES_INDISPONIBLES':
      return 'Les clés de la procédure ont changé pendant votre dépôt : rechargez la page et scellez de nouveau.';
    case 'ENTREPRISE_ABSENTE':
      return 'Déclarez d’abord votre entreprise (« Mon entreprise »), puis revenez déposer.';
    case 'REMPLACEMENT_INTERDIT':
      return 'Cette procédure n’autorise ni le remplacement ni le retrait d’une offre déposée.';
    case 'OFFRE_EXISTANTE':
      return 'Vous avez déjà déposé une offre pour ce lot : remplacez-la depuis « Mes offres ».';
    case 'TAILLE_DEPASSEE':
      return 'L’offre dépasse la taille maximale fixée par la procédure.';
    case 'MORCEAU_MANQUANT':
    case 'EMPREINTE_DIFFERENTE':
    case 'MORCEAU_INVALIDE':
      return 'L’envoi est arrivé incomplet ou altéré. Relancez le dépôt : rien n’a été déposé.';
    case 'LOT_INVALIDE':
      return 'Choisissez le lot pour lequel vous déposez.';
  }
  return (e as Error)?.message || api.message || 'Le dépôt n’a pas abouti.';
}

/**
 * **Déposer une offre** (`/candidat/procedures/:idDmc/offre`, lot 3, ADR-0013). Le candidat rassemble son offre — le lot,
 * l'éventuel groupement, l'**acte d'engagement** (son PDF signé et les quelques valeurs que la séance lira), les **pièces
 * attendues**, la **garantie** et son code de vérification — puis **« Sceller et déposer »** : l'archive se construit, se
 * chiffre **ici**, la clé de l'offre est partagée entre les détenteurs publiés, les morceaux partent un à un (repris en cas de
 * coupure), et le serveur rend l'**accusé** horodaté avec l'empreinte. Le serveur ne voit jamais le contenu ni un montant.
 * `?remplace=<idOffre>&lot=<n>` remplace une offre déposée (si la procédure l'autorise) ; l'ancienne ne tombe qu'au scellement
 * de la nouvelle.
 */
@Component({
  selector: 'app-depot-offre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    <nav class="do__ariane" aria-label="Fil d'Ariane">
      <a routerLink="/candidat/procedures">Procédures ouvertes</a><span aria-hidden="true">›</span>
      <a [routerLink]="['/candidat', 'procedures', idDmc]">{{ procedure()?.reference || 'Procédure' }}</a><span aria-hidden="true">›</span>
      <span aria-current="page">{{ remplace ? 'Remplacer mon offre' : 'Déposer une offre' }}</span>
    </nav>

    @if (chargement()) {
      <p class="text-muted" role="status">Préparation du dépôt…</p>
    } @else if (erreurChargement()) {
      <app-etat-erreur [message]="erreurChargement()!" (reessayer)="charger()" />
    } @else if (procedure(); as p) {
      <header class="page-header">
        <div class="page-subtitle">{{ remplace ? 'Remplacement d’une offre déposée' : 'Dépôt d’une offre' }}</div>
        <h1 class="page-title">{{ p.objet || 'Procédure ' + idDmc }}</h1>
        <p class="do__sous">
          @if (p.dateLimite) { <span>Date limite : <strong>{{ dateHeure(p.dateLimite) }}</strong> ({{ p.heureReference || 'heure du serveur' }})</span> }
          @if (resteLibelle(); as r) { <span class="badge" [class.badge-danger]="urgent()" [class.badge-info]="!urgent()">{{ r }}</span> }
        </p>
      </header>

      @if (bloquant(); as b) {
        <div class="alert alert-danger" role="alert"><span>{{ b }}</span></div>
      } @else if (phase() === 'fait' && accuse(); as a) {
        <!-- L'accusé de réception : ce que le candidat garde. -->
        <section class="card do__accuse" aria-labelledby="do-accuse">
          <h2 id="do-accuse" class="do__h2">Offre déposée</h2>
          <p>Votre offre est scellée et déposée le <strong>{{ dateHeure(a.offre.dateDepot) }}</strong> (heure du serveur), sous le numéro d’arrivée <strong>{{ a.offre.numero }}</strong>{{ a.offre.lot ? ', pour le lot ' + a.offre.lot : '' }}.</p>
          <p class="form-label">Empreinte de l’offre (SHA-256)</p>
          <p class="cnm-mono do__emp">{{ formater(a.offre.empreinte) }}</p>
          <p class="text-sm text-muted">Elle sera recalculée à l’ouverture des plis : une différence y serait signalée. Scellée pour {{ a.n }} détenteurs ; {{ a.quorum }} suffisent à l’ouvrir, à l’heure de la séance seulement. {{ taille(a.offre.taille) }}.</p>
          <div class="do__actions">
            <button type="button" class="btn btn-primary" [disabled]="pdfEnCours()" (click)="telechargerAccuse(a.offre.idOffre)">{{ pdfEnCours() ? '…' : 'Enregistrer l’accusé (PDF)' }}</button>
            <a class="btn btn-outline" routerLink="/candidat/offres">Mes offres</a>
          </div>
        </section>
      } @else {
        <form class="do__form" (submit)="$event.preventDefault(); deposer()" novalidate aria-label="Dépôt de l'offre">
          @if (erreurDepot(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }

          <section class="card do__bloc" aria-labelledby="do-ident">
            <h2 id="do-ident" class="do__h2">1. Le soumissionnaire</h2>
            @if (entreprise(); as en) {
              <p><strong>{{ en.raisonSociale }}</strong> · NIF <span class="cnm-mono">{{ en.nif }}</span></p>
            }
            @if (p.lots.length) {
              <label class="form-group do__court">
                <span class="form-label">Lot</span>
                <select class="form-control" [disabled]="!!remplace || occupe()" (change)="lot.set(+$any($event.target).value || null)">
                  <option value="" [selected]="lot() === null">— Choisir —</option>
                  @for (l of p.lots; track l.numero) { <option [value]="l.numero" [selected]="lot() === l.numero">Lot {{ l.numero }}{{ l.intitule ? ' — ' + l.intitule : '' }}</option> }
                </select>
              </label>
            }
            <label class="do__case"><input type="checkbox" [checked]="enGroupement()" [disabled]="occupe()" (change)="enGroupement.set($any($event.target).checked)" /> Je dépose en groupement, comme mandataire</label>
            @if (enGroupement()) {
              <p class="text-sm text-muted">Les autres membres du groupement. Leur NIF sert au seul contrôle d’exclusion ; le reste est scellé dans l’offre.</p>
              @for (m of groupement(); track $index; let i = $index) {
                <div class="do__ligne">
                  <input class="form-control" type="text" placeholder="NIF" [attr.aria-label]="'NIF du membre ' + (i + 1)" [value]="m.nif" (input)="poserMembre(i, 'nif', $any($event.target).value)" />
                  <input class="form-control" type="text" placeholder="Raison sociale" [attr.aria-label]="'Raison sociale du membre ' + (i + 1)" [value]="m.raisonSociale" (input)="poserMembre(i, 'raisonSociale', $any($event.target).value)" />
                  <button type="button" class="btn btn-sm btn-outline" [attr.aria-label]="'Retirer le membre ' + (i + 1)" (click)="retirerMembre(i)">✕</button>
                </div>
              }
              <button type="button" class="btn btn-sm btn-secondary" (click)="ajouterMembre()">Ajouter un membre</button>
            }
          </section>

          <section class="card do__bloc" aria-labelledby="do-ae">
            <h2 id="do-ae" class="do__h2">2. L’acte d’engagement</h2>
            <p class="text-sm text-muted">Ces valeurs seront lues à haute voix à l’ouverture des plis ; elles doivent être celles de votre acte signé, joint ci-dessous.</p>
            <div class="cnm-form-grid">
              <label class="form-group"><span class="form-label">Montant hors taxes (Ariary)</span><input class="form-control" type="number" min="0" step="1" [value]="ae().montantHt ?? ''" (input)="poserAe('montantHt', $any($event.target).valueAsNumber)" /></label>
              <label class="form-group"><span class="form-label">Montant toutes taxes (Ariary)</span><input class="form-control" type="number" min="0" step="1" [value]="ae().montantTtc ?? ''" (input)="poserAe('montantTtc', $any($event.target).valueAsNumber)" /></label>
              <label class="form-group"><span class="form-label">Délai d’exécution ou de livraison</span>
                <span class="do__duree">
                  <input class="form-control" type="number" min="1" step="1" [value]="ae().delai ?? ''" (input)="poserAe('delai', $any($event.target).valueAsNumber)" aria-label="Délai" />
                  <select class="form-control" (change)="poserAe('delaiUnite', $any($event.target).value)" aria-label="Unité du délai">
                    <option value="JOURS" [selected]="ae().delaiUnite === 'JOURS'">jours</option>
                    <option value="MOIS" [selected]="ae().delaiUnite === 'MOIS'">mois</option>
                  </select>
                </span>
              </label>
              <label class="form-group"><span class="form-label">Validité de l’offre (jours)</span><input class="form-control" type="number" min="1" step="1" [value]="ae().validiteJours ?? ''" (input)="poserAe('validiteJours', $any($event.target).valueAsNumber)" /></label>
              <label class="form-group do__large"><span class="form-label">Rabais (facultatif)</span><input class="form-control" type="text" placeholder="ex. 2 % en cas d’attribution des deux lots" [value]="ae().rabais ?? ''" (input)="poserAe('rabais', $any($event.target).value || null)" /></label>
            </div>
          </section>

          <section class="card do__bloc" aria-labelledby="do-pieces">
            <h2 id="do-pieces" class="do__h2">3. Les pièces</h2>
            <p class="text-sm text-muted">Formats acceptés : {{ (p.formatsAcceptes ?? ['PDF']).join(', ') }} · {{ p.tailleMaxFichierMo ?? '—' }} Mo par fichier · {{ p.tailleMaxOffreMo ?? '—' }} Mo pour l’offre entière.</p>
            <ul class="do__pieces">
              @for (pa of pieces(); track pa.code) {
                <li class="do__piece">
                  <div>
                    <strong>{{ pa.numero ? pa.numero + ' — ' : '' }}{{ pa.libelle }}</strong>
                    @if (pa.forme || pa.ancienneteMaxMois) { <span class="text-xs text-muted"> · {{ pa.forme }}{{ pa.ancienneteMaxMois ? ', de moins de ' + pa.ancienneteMaxMois + ' mois' : '' }}</span> }
                  </div>
                  <input class="form-control" type="file" [attr.accept]="accept()" [disabled]="occupe()" [attr.aria-label]="'Fichier : ' + pa.libelle" (change)="joindre(pa.code, $event)" />
                  @if (fichiers()[pa.code]; as f) { <span class="text-xs text-muted">{{ f.name }} · {{ taille(f.size) }}</span> }
                  @if (erreursFichier()[pa.code]; as m) { <span class="form-error">{{ m }}</span> }
                  @if (pa.code === 'GARANTIE') {
                    <label class="form-group do__court"><span class="form-label">Code de vérification de la garantie</span><input class="form-control" type="text" [value]="codeGarantie()" (input)="codeGarantie.set($any($event.target).value)" /></label>
                  }
                </li>
              }
            </ul>
            <p class="text-sm">Total : <strong>{{ taille(totalOctets()) }}</strong> · {{ nbJointes() }} pièce(s) sur {{ pieces().length }}</p>
          </section>

          <section class="card do__bloc" aria-labelledby="do-sceller">
            <h2 id="do-sceller" class="do__h2">4. Sceller et déposer</h2>
            <p class="text-sm">Votre offre sera chiffrée sur ce poste, pour les {{ cles()?.n }} détenteurs de la procédure ; {{ cles()?.quorum }} d’entre eux, ensemble et à l’heure de la séance seulement, pourront l’ouvrir. Personne ne peut la lire avant — ni le serveur, ni l’administration.</p>
            @if (manques().length) {
              <ul class="do__manques">@for (m of manques(); track m) { <li>{{ m }}</li> }</ul>
            }
            @if (occupe()) {
              <p role="status" class="do__progres"><strong>{{ libellePhase() }}</strong>@if (total()) { — {{ fait() }} / {{ total() }} }</p>
              <progress [max]="total() || 1" [value]="fait()"></progress>
            }
            <div class="do__actions">
              <button type="submit" class="btn btn-primary" [disabled]="occupe() || manques().length > 0">{{ occupe() ? 'Dépôt en cours…' : remplace ? 'Sceller et remplacer mon offre' : 'Sceller et déposer' }}</button>
              <a class="btn btn-outline" [routerLink]="['/candidat', 'procedures', idDmc]">Annuler</a>
            </div>
          </section>
        </form>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .do__ariane { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); color: var(--n-500); }
    .do__ariane a { color: var(--p-700); font-weight: 600; }
    .do__sous { margin: 0.25rem 0 0; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); color: var(--n-500); }
    .do__form { display: flex; flex-direction: column; gap: 1rem; }
    .do__bloc, .do__accuse { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .do__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .do__court { max-width: 22rem; }
    .do__large { grid-column: span 2; }
    .do__case { display: flex; gap: 0.5rem; align-items: center; font-size: var(--text-sm); }
    .do__ligne { display: grid; grid-template-columns: 12rem 1fr auto; gap: 0.5rem; }
    .do__duree { display: flex; gap: 0.4rem; }
    .do__pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .do__piece { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.6rem 0.75rem; border: 1px solid var(--n-200); border-radius: var(--radius-md); }
    .do__manques { margin: 0; padding-left: 1.2rem; font-size: var(--text-sm); color: var(--warning-text); }
    .do__progres { margin: 0; }
    .do__progres + progress { width: 100%; }
    .do__actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    .do__emp { margin: 0; word-break: break-all; font-size: var(--text-sm); }
    @media (max-width: 600px) { .do__large { grid-column: span 1; } .do__ligne { grid-template-columns: 1fr; } }
  `,
})
export class DepotOffre implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly procedures = inject(ProceduresEnLigneService);
  private readonly entreprises = inject(EntrepriseCandidatService);
  private readonly ceremonie = inject(CeremonieService);
  private readonly offres = inject(OffresCandidatService);
  private readonly document = inject(DOCUMENT);

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  /** L'offre remplacée, le cas échéant (`?remplace=`), et son lot (`?lot=`), figé. */
  readonly remplace = this.route.snapshot.queryParamMap.get('remplace');
  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;
  readonly formater = formaterEmpreinte;

  readonly chargement = signal(true);
  readonly erreurChargement = signal<string | null>(null);
  readonly bloquant = signal<string | null>(null);
  readonly procedure = signal<ProcedureEnLigne | null>(null);
  readonly pieces = signal<PieceAttendue[]>([]);
  readonly cles = signal<ClesPubliques | null>(null);
  readonly entreprise = signal<Entreprise | null>(null);

  readonly lot = signal<number | null>(Number(this.route.snapshot.queryParamMap.get('lot')) || null);
  readonly enGroupement = signal(false);
  readonly groupement = signal<{ nif: string; raisonSociale: string }[]>([]);
  readonly ae = signal<Partial<ActeEngagementSaisi>>({ monnaie: 'MGA', delaiUnite: 'JOURS', rabais: null });
  readonly fichiers = signal<Record<string, File>>({});
  readonly erreursFichier = signal<Record<string, string>>({});
  readonly codeGarantie = signal('');

  readonly phase = signal<Phase>('saisie');
  readonly fait = signal(0);
  readonly total = signal(0);
  readonly erreurDepot = signal<string | null>(null);
  readonly accuse = signal<Accuse | null>(null);
  readonly pdfEnCours = signal(false);

  /** Écart entre l'horloge du serveur et celle du poste, en ms : le temps restant se compte à l'heure du serveur. */
  private ecartHorloge = 0;
  readonly maintenant = signal(Date.now());
  private minuterie: ReturnType<typeof setInterval> | undefined;

  readonly occupe = computed(() => !['saisie', 'fait'].includes(this.phase()));
  readonly accept = computed(() => typesDesFormats(this.procedure()?.formatsAcceptes).join(','));
  readonly totalOctets = computed(() => Object.values(this.fichiers()).reduce((s, f) => s + f.size, 0));
  readonly nbJointes = computed(() => Object.keys(this.fichiers()).length);
  readonly resteMs = computed(() => {
    const limite = this.procedure()?.dateLimite;
    return limite ? new Date(limite).getTime() - (this.maintenant() + this.ecartHorloge) : null;
  });
  readonly urgent = computed(() => (this.resteMs() ?? Infinity) < 15 * 60_000);
  readonly resteLibelle = computed(() => {
    const ms = this.resteMs();
    if (ms == null) return null;
    if (ms <= 0) return 'Date limite passée';
    const min = Math.floor(ms / 60_000);
    const j = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    return `Il reste ${j ? j + ' j ' : ''}${h ? h + ' h ' : ''}${m} min`;
  });
  readonly libellePhase = computed(() => ({ saisie: '', archive: 'Assemblage de l’offre', scellement: 'Chiffrement sur ce poste', envoi: 'Envoi des morceaux', cloture: 'Scellement et accusé', fait: '' })[this.phase()]);

  /** Ce qui manque pour déposer, dit en clair : le bouton ne s'active qu'une fois la liste vide. */
  readonly manques = computed(() => {
    const p = this.procedure();
    const a = this.ae();
    const m: string[] = [];
    if (!p) return m;
    if (p.lots.length && this.lot() == null) m.push('Choisissez le lot.');
    if (!(a.montantHt! >= 0) || !(a.montantTtc! >= 0) || !a.montantHt || !a.montantTtc) m.push('Les montants de l’acte d’engagement.');
    if (!a.delai || a.delai < 1) m.push('Le délai.');
    if (!a.validiteJours || a.validiteJours < 1) m.push('La validité de l’offre.');
    const manquantes = this.pieces().filter((x) => x.obligatoire && !this.fichiers()[x.code]);
    if (manquantes.length) m.push(`${manquantes.length} pièce(s) à joindre : ${manquantes.map((x) => x.libelle).slice(0, 3).join(', ')}${manquantes.length > 3 ? '…' : ''}.`);
    if (this.pieces().some((x) => x.code === 'GARANTIE') && !this.codeGarantie().trim()) m.push('Le code de vérification de la garantie.');
    if (this.enGroupement() && (!this.groupement().length || this.groupement().some((g) => !g.nif.trim() || !g.raisonSociale.trim()))) m.push('Le NIF et la raison sociale de chaque membre du groupement.');
    if (Object.keys(this.erreursFichier()).length) m.push('Un fichier n’est pas accepté : remplacez-le.');
    const max = p.tailleMaxOffreMo;
    if (max && this.totalOctets() > max * 1024 * 1024) m.push(`L’offre dépasse ${max} Mo.`);
    if ((this.resteMs() ?? 1) <= 0) m.push('La date limite est passée.');
    return m;
  });

  ngOnInit(): void {
    this.charger();
    this.minuterie = setInterval(() => this.maintenant.set(Date.now()), 30_000);
  }

  ngOnDestroy(): void {
    clearInterval(this.minuterie);
  }

  charger(): void {
    this.chargement.set(true);
    this.erreurChargement.set(null);
    this.bloquant.set(null);
    forkJoin({
      procedure: this.procedures.detail(this.idDmc),
      pieces: this.procedures.pieces(this.idDmc),
      entreprise: this.entreprises.lire(),
      horloge: this.procedures.horloge(),
    }).subscribe({
      next: ({ procedure, pieces, entreprise, horloge }) => {
        this.procedure.set(procedure);
        this.pieces.set(pieces);
        this.entreprise.set(entreprise);
        this.ecartHorloge = new Date(horloge.maintenant).getTime() - Date.now();
        this.maintenant.set(Date.now());
        this.document.title = `Dépôt — ${procedure.reference || 'procédure'} — Espace candidat — PRS 2.0`;
        if (entreprise.exclusion) this.bloquant.set(messageExclusion(entreprise.exclusion));
        else if (!procedure.depotsOuverts) this.bloquant.set(procedure.etat === 'CLOSE' ? 'La date limite est passée : les dépôts sont clos.' : 'Les dépôts ne sont pas encore ouverts pour cette procédure.');
        else if (this.remplace && procedure.remplacementAutorise === false) this.bloquant.set('Cette procédure n’autorise pas le remplacement d’une offre déposée.');
        // Les clés publiées : sans elles, rien ne se scelle (404 tant que la cérémonie n'est pas close).
        this.ceremonie.clesPubliques(this.idDmc).subscribe({
          next: (c) => {
            this.cles.set(c);
            this.chargement.set(false);
          },
          error: () => {
            this.bloquant.set(this.bloquant() ?? 'Les clés de la procédure ne sont pas publiées : le dépôt n’est pas encore possible.');
            this.chargement.set(false);
          },
        });
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 404) this.erreurChargement.set('Déclarez d’abord votre entreprise (« Mon entreprise »), ou vérifiez que la procédure est ouverte en ligne.');
        else this.erreurChargement.set('Le dépôt n’a pas pu être préparé.');
      },
    });
  }

  poserAe<K extends keyof ActeEngagementSaisi>(cle: K, valeur: ActeEngagementSaisi[K]): void {
    this.ae.update((a) => ({ ...a, [cle]: Number.isNaN(valeur as number) ? undefined : valeur }));
  }

  ajouterMembre(): void {
    this.groupement.update((g) => [...g, { nif: '', raisonSociale: '' }]);
  }
  retirerMembre(i: number): void {
    this.groupement.update((g) => g.filter((_, j) => j !== i));
  }
  poserMembre(i: number, cle: 'nif' | 'raisonSociale', valeur: string): void {
    this.groupement.update((g) => g.map((m, j) => (j === i ? { ...m, [cle]: valeur } : m)));
  }

  joindre(code: string, ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    const p = this.procedure();
    const erreurs = { ...this.erreursFichier() };
    const fichiers = { ...this.fichiers() };
    delete erreurs[code];
    delete fichiers[code];
    if (f) {
      const erreur = validerFichier(f, typesDesFormats(p?.formatsAcceptes), p?.tailleMaxFichierMo ?? 50);
      if (erreur) erreurs[code] = erreur;
      else fichiers[code] = f;
    }
    this.erreursFichier.set(erreurs);
    this.fichiers.set(fichiers);
  }

  /** Le dépôt : archive → scellement → morceaux (avec reprise) → scellement serveur → accusé. */
  async deposer(): Promise<void> {
    const p = this.procedure();
    const cles = this.cles();
    const en = this.entreprise();
    if (!p || !cles || !en || this.occupe() || this.manques().length) return;
    this.erreurDepot.set(null);
    try {
      this.phase.set('archive');
      this.fait.set(0);
      this.total.set(0);
      const membres: MembreGroupement[] | null = this.enGroupement()
        ? [{ nif: en.nif, raisonSociale: en.raisonSociale, mandataire: true }, ...this.groupement().map((g) => ({ nif: g.nif.trim(), raisonSociale: g.raisonSociale.trim(), mandataire: false }))]
        : null;
      const jointes: PieceJointe[] = Object.entries(this.fichiers()).map(([code, fichier]) => ({ code, fichier }));
      const horloge = await firstValueFrom(this.procedures.horloge());
      const { contenu } = await construireContenu(
        { idDmc: this.idDmc, lot: this.lot(), entreprise: { nif: en.nif, raisonSociale: en.raisonSociale }, groupement: membres, acteEngagement: this.ae() as ActeEngagementSaisi },
        jointes,
        this.pieces().some((x) => x.code === 'GARANTIE') ? { code: 'GARANTIE', codeVerification: this.codeGarantie().trim() } : null,
        horloge.maintenant,
      );

      this.phase.set('scellement');
      const s = await sceller(contenu, cles, this.idDmc, this.lot(), (f, t) => {
        this.fait.set(f);
        this.total.set(t);
      });

      const offre = await firstValueFrom(
        this.offres.creer({ idDmc: this.idDmc, lot: this.lot(), enTete: s.enTete, remplace: this.remplace, groupementNifs: membres ? membres.slice(1).map((m) => m.nif) : undefined }),
      );

      this.phase.set('envoi');
      this.fait.set(0);
      this.total.set(s.morceaux.length);
      for (let rang = 0; rang < s.morceaux.length; rang++) {
        await this.envoyerAvecReprise(offre.idOffre, rang, s.morceaux[rang], s.empreintesMorceaux[rang]);
        this.fait.set(rang + 1);
      }

      this.phase.set('cloture');
      const accuse = await firstValueFrom(this.offres.sceller(offre.idOffre, s.empreinte));
      if (accuse.offre.empreinte && accuse.offre.empreinte !== s.empreinte) throw new Error('Le serveur annonce une empreinte différente de celle calculée ici : signalez-le à l’assistance.');
      this.accuse.set(accuse);
      this.phase.set('fait');
    } catch (e) {
      this.phase.set('saisie');
      this.erreurDepot.set(motifDepot(e));
    }
  }

  /** Un morceau perdu en route se renvoie : la route est rejouable. Une erreur à code (délai, offre scellée) ne se rejoue pas. */
  private async envoyerAvecReprise(idOffre: string, rang: number, morceau: Uint8Array<ArrayBuffer>, empreinte: string): Promise<void> {
    for (let essai = 1; ; essai++) {
      try {
        await firstValueFrom(this.offres.envoyerMorceau(idOffre, rang, morceau, empreinte));
        return;
      } catch (e) {
        const code = codeErreur(e as ApiError);
        if (code || essai >= ESSAIS_PAR_MORCEAU) throw e;
        await new Promise((r) => setTimeout(r, 1000 * essai));
      }
    }
  }

  telechargerAccuse(idOffre: string): void {
    this.pdfEnCours.set(true);
    this.offres.accuse(idOffre).subscribe({
      next: (b) => {
        this.pdfEnCours.set(false);
        telechargerBlob(b, `accuse-depot-${this.idDmc}-${idOffre.slice(0, 8)}.pdf`);
      },
      error: () => this.pdfEnCours.set(false),
    });
  }
}
