import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { ArticleFiche, BonCommande, Consommation, ContratVigueur } from '../../models';
import { BonsCommandeService, FicheMarcheService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { ariary } from '../evaluation/libelles-evaluation';
import { ReceptionsBonVue } from '../receptions/receptions-bon';

export const ALERTES_CONSOMMATION: Readonly<Record<string, string>> = {
  MINIMUM_NON_ATTEINT: 'Le minimum annuel n’est pas atteint à moins de 30 jours de la fin de l’année contractuelle (loi n° 2016-055, art. 30-II).',
  MONTANT_ESTIME_DEPASSE: 'Les commandes dépassent la valeur maximale estimée du contrat-cadre (décret n° 2019-1064, art. 8) : signalé, jamais refusé.',
  // ⚠️ 29/10 (« bons-reception », §B1 ; V148).
  QUANTITE_MIN_NON_ATTEINTE: 'Au moins un article n’atteint pas sa quantité minimale à moins de 30 jours de la fin du contrat : la PRMP doit commander au moins ce minimum (loi n° 2016-055, art. 30-II).',
  // ⚠️ 29/10 (« suivre les textes », D3) — la valeur maximale estimée n'est plus un plafond : le dépassement est signalé (art. 30-III).
  MAXIMUM_ESTIME_DEPASSE: 'Les commandes dépassent la valeur maximale estimée du marché à commandes (loi n° 2016-055, art. 30-III) : signalé, jamais refusé.',
};

/** Une quantité lisible (« 12 », « 2,5 »). */
const qte = (n: unknown): string => (typeof n === 'number' ? n.toLocaleString('fr-FR') : '?');

/** Les refus des bons de commande, dits à la PRMP. */
export function refusBon(e: ApiError): string {
  const d = corpsErreur<{ details?: Record<string, unknown> }>(e)?.details ?? {};
  const ar = (k: string): string => (typeof d[k] === 'number' ? ariary(d[k] as number) : '?');
  switch (codeErreur(e)) {
    case 'CHAMP_OBLIGATOIRE': return `Un champ obligatoire manque${d['champ'] ? ' (' + d['champ'] + ')' : ''}.`;
    case 'REMISE_OBLIGATOIRE': return 'Choisissez le marché subséquent dont le bon relève.';
    case 'REMISE_NON_ATTRIBUEE': return 'Ce marché subséquent n’est pas attribué : pas de bon de commande avant l’attribution (décret, art. 33).';
    case 'LIGNES_OBLIGATOIRES': return 'Le bon doit porter au moins un article.';
    case 'QUANTITE_INVALIDE': return 'Chaque quantité doit être positive.';
    case 'PRIX_OBLIGATOIRE': return 'Saisissez le prix unitaire : le bordereau de l’offre n’est pas lisible pour cet article.';
    case 'ARTICLE_INCONNU': return 'Cet article n’appartient pas au besoin du contrat.';
    case 'PRIX_HORS_BORDEREAU': return `Le prix de l’article${d['rang'] ? ' n° ' + d['rang'] : ''} doit être celui du bordereau de l’offre (${ar('prixBordereau')}) : laissez le prix vide pour le reprendre.`;
    case 'CONTRAT_ECHU': return 'Le contrat est échu : plus aucune commande.';
    case 'SANS_TITULAIRE': return 'Le contrat n’a plus de titulaire.';
    case 'MONTANT_SUBSEQUENT_DEPASSE': return `Le bon dépasse le montant retenu du marché subséquent (${ar('montantRetenu')} ; déjà commandé ${ar('dejaCommande')}).`;
    case 'QUANTITE_MAX_DEPASSEE': return `L’article${d['rang'] ? ' de la ligne n° ' + d['rang'] : ''} dépasse sa quantité maximale sur la durée du marché (${qte(d['quantiteMax'])} ; déjà commandé ${qte(d['dejaCommande'])}, demandé ${qte(d['demande'])}).`;
    case 'MOTIF_OBLIGATOIRE': return 'Le motif de l’annulation est obligatoire.';
    case 'DEJA_ANNULE': return 'Ce bon est déjà annulé.';
  }
  if (e.status === 403) return 'Le bon de commande s’émet et s’annule par la PRMP de la procédure.';
  return e.message || 'Le geste n’a pas abouti.';
}

interface LigneSaisie {
  idArticle: number | null;
  designation: string;
  unite: string;
  quantite: string;
  prix: string;
}

const LIGNE_VIDE = (): LigneSaisie => ({ idArticle: null, designation: '', unite: '', quantite: '', prix: '' });

/**
 * ⚠️ Lot MS-3 (V126, 16/10) — **les bons de commande d'un contrat en vigueur** : la consommation (cumul ; marché à commandes : année
 * contractuelle, minimum et maximum annuels ; contrat-cadre : chaque marché subséquent, son montant retenu et ce qui reste), les
 * bons émis (document, accusé de réception du titulaire, annulation motivée), et l'émission par la PRMP. Contrat-cadre : le bon
 * relève d'un marché subséquent attribué, les prix sont saisis. Marché à commandes : les articles du besoin, au prix du bordereau
 * scellé de l'offre quand le prix est laissé vide.
 */
@Component({
  selector: 'app-bons-commande-contrat',
  imports: [ReceptionsBonVue],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = contrat();
    @if (chargement()) {
      <p class="text-sm text-muted" role="status">Chargement des bons de commande…</p>
    } @else if (erreurLecture(); as m) {
      <div class="alert alert-danger" role="alert">{{ m }} <button type="button" class="btn btn-ghost btn-sm" (click)="charger()">Réessayer</button></div>
    } @else if (conso(); as k) {
      <dl class="bc__grille">
        <div><dt>Commandé sur la durée du contrat</dt><dd>{{ ariary(k.cumulHt) }} HT@if (k.cumulTtc) { · {{ ariary(k.cumulTtc) }} TTC }</dd></div>
        @if (commandes()) {
          <div><dt>Année contractuelle</dt><dd>du {{ date(k.anneeDebut) }} au {{ date(k.anneeFin) }}</dd></div>
          <div><dt>Commandé cette année</dt><dd>{{ ariary(k.cumulAnnee) }} HT</dd></div>
          <div><dt>Minimum annuel · maximum estimé</dt><dd>{{ k.minimum != null ? ariary(k.minimum) : '—' }} · {{ k.maximum != null ? ariary(k.maximum) : '—' }}</dd></div>
          @if (k.resteMaximum != null) { <div><dt>Reste avant le maximum estimé (durée du marché)</dt><dd [class.bc__depasse]="k.resteMaximum < 0">{{ ariary(k.resteMaximum) }} HT</dd></div> }
        } @else if (k.montantEstime != null) {
          <div><dt>Valeur maximale estimée</dt><dd>{{ ariary(k.montantEstime) }} HT</dd></div>
        }
      </dl>
      @for (a of k.alertes; track a) { <div class="alert alert-warning" role="note"><span>{{ alerte(a) }}</span></div> }

      <!-- ⚠️ 29/10 (« bons-reception », §B1 ; V148) — marché à commandes : les quantités de l'année par article du besoin. -->
      @if (commandes() && k.articles?.length) {
        <div class="cnm-table-wrap">
          <table class="cnm-table bc__table" aria-label="Quantités commandées sur la durée du marché, par article">
            <thead><tr><th scope="col">Article du besoin</th><th scope="col">Unité</th><th scope="col" class="bc__num">Minimum</th><th scope="col" class="bc__num">Maximum</th><th scope="col" class="bc__num">Commandé sur la durée</th><th scope="col" class="bc__num">Reste</th></tr></thead>
            <tbody>
              @for (a of k.articles; track a.idArticle) {
                <tr [class.bc__epuise]="a.resteQuantite === 0">
                  <td>{{ a.designation || '—' }}</td><td>{{ a.unite || '—' }}</td>
                  <td class="bc__num">{{ quantite(a.quantiteMin) }}</td><td class="bc__num">{{ quantite(a.quantiteMax) }}</td>
                  <td class="bc__num">{{ quantite(a.commandeDuree) }}</td><td class="bc__num">{{ quantite(a.resteQuantite) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (!commandes() && k.subsequents.length) {
        <div class="cnm-table-wrap">
          <table class="cnm-table bc__table" aria-label="Marchés subséquents attribués">
            <thead><tr><th scope="col">Marché subséquent</th><th scope="col">Titulaire retenu</th><th scope="col" class="bc__num">Montant retenu HT</th><th scope="col" class="bc__num">Commandé</th><th scope="col" class="bc__num">Reste</th></tr></thead>
            <tbody>
              @for (s of k.subsequents; track s.idRemise) {
                <tr><td>Remise n° {{ s.numero }}{{ s.objet ? ' — ' + s.objet : '' }}</td><td>{{ s.titulaire || '—' }}</td><td class="bc__num">{{ ariary(s.montantRetenu) }}</td><td class="bc__num">{{ ariary(s.commande) }}</td><td class="bc__num">{{ ariary(s.reste) }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (k.bons.length) {
        <div class="cnm-table-wrap">
          <table class="cnm-table bc__table" aria-label="Bons de commande">
            <thead><tr><th scope="col">Bon</th><th scope="col">Titulaire</th><th scope="col">Objet</th><th scope="col" class="bc__num">Montant HT</th><th scope="col">Émis le</th><th scope="col">Accusé de réception</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>
              @for (b of k.bons; track b.id) {
                <tr [class.bc__annule]="b.etat === 'ANNULE'">
                  <td>n° {{ b.numero }}{{ b.numeroRemise ? ' (remise n° ' + b.numeroRemise + ')' : '' }}</td>
                  <td>{{ b.titulaire || '—' }}</td>
                  <td>{{ b.objet || '—' }}</td>
                  <td class="bc__num">{{ ariary(b.montantHt) }}@if (b.montantTtc != null) { <br /><span class="text-muted">{{ ariary(b.montantTtc) }} TTC ({{ b.tauxTva }} %)</span> }</td>
                  <td class="text-sm">{{ dateHeure(b.emisLe) }}</td>
                  <td class="text-sm">
                    @if (b.etat === 'ANNULE') { <span class="badge badge-danger">Annulé</span> {{ b.motifAnnulation }} }
                    @else if (b.accuseLe) { {{ dateHeure(b.accuseLe) }} }
                    @else { <span class="text-muted">en attente</span> }
                  </td>
                  <td class="bc__actions">
                    <button type="button" class="btn btn-outline btn-sm" [attr.aria-label]="'Bon n° ' + b.numero + ' (PDF)'" (click)="ouvrir(service.document(b.id))">PDF</button>
                    <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Bon n° ' + b.numero + ' (Word)'" (click)="enregistrer(service.document(b.id, 'docx'), 'bon-commande-' + b.numero + '.docx')">Word</button>
                    @if (b.etat === 'EMIS') {
                      <button type="button" class="btn btn-ghost btn-sm" [attr.aria-expanded]="reception() === b.id" [attr.aria-label]="'Réception du bon n° ' + b.numero" (click)="reception.set(reception() === b.id ? null : b.id)">Réception</button>
                    }
                    @if (prmp() && b.etat === 'EMIS') {
                      <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Annuler le bon n° ' + b.numero" (click)="annulation.set(annulation() === b.id ? null : b.id)">Annuler…</button>
                    }
                  </td>
                </tr>
                <!-- ⚠️ Lot MS-4 (V127) — la réception du bon : livraison, PV du président, signatures, définitive. -->
                @if (reception() === b.id) {
                  <tr><td colspan="7">
                    <app-receptions-bon [idBon]="b.id" [peutDeclarer]="prmp() || ugpm()" [president]="prmp() && presideeParPrmp()" [signataire]="prmp() ? 'PRMP' : null" />
                  </td></tr>
                }
                @if (annulation() === b.id) {
                  <tr><td colspan="7">
                    <div class="bc__ligne">
                      <label class="form-group bc__large"><span class="form-label">Motif de l’annulation du bon n° {{ b.numero }}</span><input class="form-control" type="text" [value]="motifAnnulation()" (input)="motifAnnulation.set($any($event.target).value)" /></label>
                      <button type="button" class="btn btn-danger btn-sm" [disabled]="!motifAnnulation().trim() || occupe()" (click)="annuler(b)">Annuler le bon</button>
                    </div>
                  </td></tr>
                }
              }
            </tbody>
          </table>
        </div>
      } @else { <p class="text-sm text-muted">Aucun bon de commande émis.</p> }

      @if (prmp() && c.etat === 'EN_VIGUEUR' && (commandes() || k.subsequents.length)) {
        <details class="bc__details">
          <summary>Émettre un bon de commande…</summary>
          <div class="bc__form">
            @if (!commandes()) {
              <label class="form-group"><span class="form-label">Marché subséquent</span>
                <select class="form-control" (change)="idRemise.set($any($event.target).value ? +$any($event.target).value : null)">
                  <option value="">—</option>
                  @for (s of k.subsequents; track s.idRemise) { <option [value]="s.idRemise" [selected]="idRemise() === s.idRemise">Remise n° {{ s.numero }} · {{ s.titulaire }} — reste {{ ariary(s.reste) }}</option> }
                </select>
              </label>
            }
            <div class="bc__ligne">
              <label class="form-group bc__large"><span class="form-label">Objet{{ commandes() ? '' : ' (vide : celui du marché subséquent)' }}</span><input class="form-control" type="text" [value]="entete().objet" (input)="poserEntete('objet', $any($event.target).value)" /></label>
              <label class="form-group"><span class="form-label">Délai de livraison</span><input class="form-control" type="text" [value]="entete().delai" (input)="poserEntete('delai', $any($event.target).value)" /></label>
              <label class="form-group"><span class="form-label">Lieu de livraison</span><input class="form-control" type="text" [value]="entete().lieu" (input)="poserEntete('lieu', $any($event.target).value)" /></label>
            </div>
            <div class="cnm-table-wrap">
              <table class="cnm-table bc__table" aria-label="Articles du bon">
                <thead><tr><th scope="col">{{ commandes() ? 'Article du besoin' : 'Désignation' }}</th><th scope="col">Unité</th><th scope="col">Quantité</th><th scope="col">Prix unitaire HT{{ commandes() ? ' (vide : bordereau)' : '' }}</th><th scope="col" class="bc__num">Montant</th><th scope="col"><span class="sr-only">Retirer</span></th></tr></thead>
                <tbody>
                  @for (l of lignes(); track $index; let i = $index) {
                    <tr>
                      <td>
                        @if (commandes() && articles().length) {
                          <select class="form-control form-control-sm" [attr.aria-label]="'Article de la ligne ' + (i + 1)" (change)="choisirArticle(i, $any($event.target).value)">
                            <option value="">—</option>
                            @for (a of articles(); track a.idArticle) { <option [value]="a.idArticle" [selected]="l.idArticle === a.idArticle">{{ a.designation }}{{ resteArticle(a.idArticle) }}</option> }
                          </select>
                        } @else {
                          <input class="form-control form-control-sm" type="text" [attr.aria-label]="'Désignation de la ligne ' + (i + 1)" [value]="l.designation" (input)="poserLigne(i, 'designation', $any($event.target).value)" />
                        }
                      </td>
                      <td><input class="form-control form-control-sm bc__court" type="text" [attr.aria-label]="'Unité de la ligne ' + (i + 1)" [disabled]="l.idArticle != null" [value]="l.unite" (input)="poserLigne(i, 'unite', $any($event.target).value)" /></td>
                      <td><input class="form-control form-control-sm bc__court" type="number" min="0" step="any" [attr.aria-label]="'Quantité de la ligne ' + (i + 1)" [value]="l.quantite" (input)="poserLigne(i, 'quantite', $any($event.target).value)" /></td>
                      <td><input class="form-control form-control-sm" type="number" min="0" step="any" [attr.aria-label]="'Prix unitaire de la ligne ' + (i + 1)" [value]="l.prix" (input)="poserLigne(i, 'prix', $any($event.target).value)" /></td>
                      <td class="bc__num">{{ montantLigne(l) != null ? ariary(montantLigne(l)) : '—' }}</td>
                      <td>@if (lignes().length > 1) { <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer la ligne ' + (i + 1)" (click)="retirerLigne(i)">✕</button> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="bc__ligne bc__pied">
              <button type="button" class="btn btn-ghost btn-sm" (click)="ajouterLigne()">Ajouter un article</button>
              <span class="text-sm">Total HT saisi : <strong>{{ ariary(totalSaisi()) }}</strong>{{ prixManquants() ? ' (hors prix repris du bordereau)' : '' }}</span>
            </div>
            <label class="form-group"><span class="form-label">Observations (facultatives)</span><input class="form-control" type="text" [value]="entete().observations" (input)="poserEntete('observations', $any($event.target).value)" /></label>
            @if (refus(); as r) { <div class="alert alert-danger" role="alert">{{ r }}</div> }
            <div><button type="button" class="btn btn-primary btn-sm" [disabled]="!emissionComplete() || occupe()" (click)="emettre()">Émettre et notifier le bon</button></div>
          </div>
        </details>
      } @else if (prmp() && c.etat === 'EN_VIGUEUR' && !commandes()) {
        <p class="text-sm text-muted">Un bon de commande relève d’un marché subséquent attribué (décret, art. 33) : attribuez d’abord une remise en concurrence.</p>
      }
      @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.5rem; }
    .bc__grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0.4rem 1.2rem; margin: 0; }
    .bc__grille dt { font-size: 0.74rem; color: var(--n-500); }
    .bc__grille dd { margin: 0; font-size: 0.88rem; font-weight: 500; }
    .bc__table { font-size: 0.82rem; }
    .bc__table thead th { background: var(--p-100); color: var(--p-800); }
    .bc__num { text-align: right; white-space: nowrap; }
    .bc__annule td { color: var(--n-500); }
    .bc__epuise td { color: var(--n-500); }
    .bc__depasse { color: var(--danger-text); }
    .bc__actions { display: flex; gap: 0.25rem; white-space: nowrap; }
    .bc__details summary { cursor: pointer; font-size: var(--text-sm); font-weight: 500; }
    .bc__form { display: flex; flex-direction: column; gap: 0.45rem; padding-top: 0.4rem; }
    .bc__ligne { display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap; }
    .bc__large { flex: 1 1 16rem; }
    .bc__court { max-width: 7rem; }
    .bc__pied { justify-content: space-between; align-items: center; }
  `,
})
export class BonsCommandeContrat implements OnInit {
  readonly contrat = input.required<ContratVigueur>();
  /** Seule la PRMP émet et annule ; les autres lisent. */
  readonly prmp = input(false);
  /** ⚠️ MS-4 — l'UGPM déclare aussi la livraison. */
  readonly ugpm = input(false);
  /** ⚠️ MS-4 — la PRMP préside la commission de réception : elle établit le PV et signe. */
  readonly presideeParPrmp = input(false);
  /** Le bon dont la réception est dépliée. */
  readonly reception = signal<number | null>(null);

  readonly service = inject(BonsCommandeService);
  private readonly fiches = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly ariary = ariary;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;

  readonly chargement = signal(true);
  readonly erreurLecture = signal<string | null>(null);
  readonly conso = signal<Consommation | null>(null);
  readonly articles = signal<(ArticleFiche & { idArticle: number })[]>([]);
  readonly occupe = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly refus = signal<string | null>(null);
  readonly annulation = signal<number | null>(null);
  readonly motifAnnulation = signal('');

  readonly idRemise = signal<number | null>(null);
  readonly entete = signal({ objet: '', delai: '', lieu: '', observations: '' });
  readonly lignes = signal<LigneSaisie[]>([LIGNE_VIDE()]);

  readonly commandes = computed(() => this.contrat().typeMarche === 'A_COMMANDE');
  readonly totalSaisi = computed(() => this.lignes().reduce((t, l) => t + (this.montantLigne(l) ?? 0), 0));
  readonly prixManquants = computed(() => this.lignes().some((l) => l.idArticle != null && !l.prix));
  readonly emissionComplete = computed(() => {
    if (!this.commandes() && !this.idRemise()) return false;
    if (this.commandes() && !this.entete().objet.trim()) return false;
    return this.lignes().every((l) => (l.idArticle != null || !!l.designation.trim()) && Number(l.quantite) > 0
      && (l.prix ? Number(l.prix) > 0 : this.commandes() && l.idArticle != null));
  });

  ngOnInit(): void {
    this.charger();
    if (this.commandes()) {
      // Les articles du besoin du lot (route de la fiche) : leur prix vient du bordereau scellé de l'offre.
      this.fiches.articles(this.contrat().idDmc).subscribe({
        next: (l) => this.articles.set(l.filter((a): a is ArticleFiche & { idArticle: number } => a.idArticle != null && (a.lot == null || a.lot === this.contrat().lot))),
        error: () => this.articles.set([]),
      });
    }
  }

  charger(): void {
    this.chargement.set(true);
    this.erreurLecture.set(null);
    this.service.consommation(this.contrat().id).subscribe({
      next: (k) => {
        this.conso.set(k);
        this.chargement.set(false);
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        this.erreurLecture.set(e.status === 403 ? 'Les bons de commande ne sont pas ouverts à votre profil.' : 'Les bons de commande n’ont pas pu être chargés.');
      },
    });
  }

  alerte(a: string): string {
    return ALERTES_CONSOMMATION[a] ?? a;
  }

  quantite(n: number | null): string {
    return n == null ? '—' : n.toLocaleString('fr-FR');
  }

  /** ⚠️ V148 — le reste de l'année d'un article, dit dans la liste de choix (« — reste 40 ») ; rien sans maximum. */
  resteArticle(idArticle: number): string {
    const a = this.conso()?.articles?.find((x) => x.idArticle === idArticle);
    return a?.resteQuantite != null ? ` — reste ${this.quantite(a.resteQuantite)}` : '';
  }

  montantLigne(l: LigneSaisie): number | null {
    const q = Number(l.quantite);
    const p = Number(l.prix);
    return q > 0 && p > 0 ? Math.round(q * p * 100) / 100 : null;
  }

  poserEntete(cle: 'objet' | 'delai' | 'lieu' | 'observations', v: string): void {
    this.entete.update((e) => ({ ...e, [cle]: v }));
  }

  poserLigne(i: number, cle: 'designation' | 'unite' | 'quantite' | 'prix', v: string): void {
    this.lignes.update((l) => l.map((x, k) => (k === i ? { ...x, [cle]: v } : x)));
  }

  choisirArticle(i: number, valeur: string): void {
    const a = this.articles().find((x) => String(x.idArticle) === valeur) ?? null;
    this.lignes.update((l) => l.map((x, k) => (k === i ? { ...x, idArticle: a?.idArticle ?? null, designation: a?.designation ?? '', unite: a?.unite ?? '' } : x)));
  }

  ajouterLigne(): void {
    this.lignes.update((l) => [...l, LIGNE_VIDE()]);
  }

  retirerLigne(i: number): void {
    this.lignes.update((l) => l.filter((_, k) => k !== i));
  }

  emettre(): void {
    const e = this.entete();
    const v = (s: string): string | null => s.trim() || null;
    this.occupe.set(true);
    this.refus.set(null);
    this.service.emettre(this.contrat().id, {
      idRemise: this.commandes() ? null : this.idRemise(),
      objet: v(e.objet),
      lieuLivraison: v(e.lieu),
      delaiLivraison: v(e.delai),
      observations: v(e.observations),
      lignes: this.lignes().map((l) => ({
        idArticle: l.idArticle,
        designation: l.idArticle != null ? null : l.designation.trim(),
        unite: l.idArticle != null ? null : l.unite.trim() || null,
        quantite: Number(l.quantite),
        prixUnitaire: l.prix ? Number(l.prix) : null,
      })),
    }).subscribe({
      next: (b) => {
        this.occupe.set(false);
        this.idRemise.set(null);
        this.entete.set({ objet: '', delai: '', lieu: '', observations: '' });
        this.lignes.set([LIGNE_VIDE()]);
        this.toast.success(`Le bon de commande n° ${b.numero} est émis (${ariary(b.montantHt)} HT) et notifié au titulaire.`);
        this.charger();
      },
      error: (err: ApiError) => {
        this.occupe.set(false);
        this.refus.set(refusBon(err));
      },
    });
  }

  annuler(b: BonCommande): void {
    this.occupe.set(true);
    this.erreur.set(null);
    this.service.annuler(b.id, this.motifAnnulation().trim()).subscribe({
      next: () => {
        this.occupe.set(false);
        this.annulation.set(null);
        this.motifAnnulation.set('');
        this.toast.success(`Le bon n° ${b.numero} est annulé ; il sort des cumuls et le titulaire est informé.`);
        this.charger();
      },
      error: (err: ApiError) => {
        this.occupe.set(false);
        this.erreur.set(refusBon(err));
      },
    });
  }

  ouvrir(appel: Observable<Blob>): void {
    appel.subscribe({ next: (b) => ouvrirBlobSur(b), error: (e: ApiError) => this.erreur.set(e.status === 404 ? 'Le bon n’est pas disponible.' : refusBon(e)) });
  }

  enregistrer(appel: Observable<Blob>, nom: string): void {
    appel.subscribe({ next: (b) => telechargerBlob(b, nom), error: (e: ApiError) => this.erreur.set(refusBon(e)) });
  }
}
