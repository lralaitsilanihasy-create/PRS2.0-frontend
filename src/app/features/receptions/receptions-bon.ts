import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { DecisionReceptionCommande, ReceptionCommande, ReceptionsBon } from '../../models';
import { ReceptionsCommandesService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { ariary } from '../evaluation/libelles-evaluation';
import { maintenantServeur } from '../../core/horloge/heure-serveur';
import { LigneQuantite, QuantitesLignes, SaisieQuantites, quantiteSaisie, quantitesValides } from './quantites-lignes';

export const ETATS_RECEPTION_BON: Readonly<Record<string, { texte: string; classe: string }>> = {
  A_LIVRER: { texte: 'À livrer', classe: 'badge-neutral' },
  EN_RECEPTION: { texte: 'Livré — réception en cours', classe: 'badge-info' },
  AJOURNE: { texte: 'Ajourné — nouvelle livraison attendue', classe: 'badge-warning' },
  REJETE: { texte: 'Rejeté — nouvelle livraison attendue', classe: 'badge-danger' },
  // ⚠️ 29/10 (« bons-reception », §B3 ; V148) — une partie reçue, un reliquat attend sa livraison.
  RECU_PARTIEL: { texte: 'Reçu en partie — reliquat à livrer', classe: 'badge-info' },
  RECU_PROVISOIRE: { texte: 'Reçu (provisoire) — garantie en cours', classe: 'badge-success' },
  EN_RECEPTION_DEFINITIVE: { texte: 'Réception définitive en cours', classe: 'badge-info' },
  RECU_DEFINITIF: { texte: 'Reçu définitivement', classe: 'badge-success' },
  ANNULE: { texte: 'Bon annulé', classe: 'badge-neutral' },
};

export const DECISIONS_RECEPTION: Readonly<Record<DecisionReceptionCommande, string>> = {
  RECEPTION: 'Réception',
  AJOURNEMENT: 'Ajournement',
  REFACTION: 'Réception avec réfaction',
  REJET: 'Rejet',
};

/** Une nouvelle livraison se déclare sur un bon à livrer, ajourné, rejeté, ou reçu en partie (V148). */
export function livraisonAttendue(etat: string): boolean {
  return etat === 'A_LIVRER' || etat === 'AJOURNE' || etat === 'REJETE' || etat === 'RECU_PARTIEL';
}

const nb = (n: number): string => n.toLocaleString('fr-FR');

/** ⚠️ V148 — les lignes qu'une livraison peut apporter : celles qui ont un reliquat (plafond). Vide pour un bon d'avant V148. */
export function lignesALivrer(d: ReceptionsBon): LigneQuantite[] {
  return (d.lignes ?? []).filter((l) => l.reliquat > 0).map((l) => ({
    rang: l.rang, designation: l.designation, unite: l.unite, max: l.reliquat,
    rappel: `commandé ${nb(l.commande)} · reçu ${nb(l.recu)}`,
  }));
}

/** ⚠️ V148 — les lignes qu'un PV peut recevoir : celles que la livraison apporte (plafond : la quantité livrée). */
export function lignesARecevoir(r: ReceptionCommande): LigneQuantite[] {
  return (r.lignes ?? []).filter((l) => l.quantiteLivree > 0).map((l) => ({
    rang: l.rang, designation: l.designation, unite: l.unite, max: l.quantiteLivree,
    rappel: `commandé ${nb(l.quantiteCommandee)} · livré ${nb(l.quantiteLivree)}`,
  }));
}

/** Les refus de la réception des commandes. */
export function refusReception(e: ApiError): string {
  const erreurs = corpsErreur<{ erreurs?: unknown[] }>(e)?.erreurs;
  switch (codeErreur(e)) {
    case 'DATE_INVALIDE': return 'La date se situe entre la livraison (ou l’émission du bon) et aujourd’hui.';
    case 'BON_ANNULE': return 'Ce bon est annulé : il ne se livre plus.';
    case 'RECEPTION_EN_COURS': return 'Une réception est déjà en cours pour ce bon.';
    case 'DEJA_RECU': return 'Déjà reçu : le bon, ou cette livraison pour sa réception définitive.';
    case 'DECISION_INVALIDE': return 'Choisissez la décision (la réception définitive n’admet que la réception ou l’ajournement).';
    case 'MOTIF_OBLIGATOIRE': return 'Toute décision autre que la réception se motive.';
    case 'REFACTION_INVALIDE': return 'La réfaction est un montant positif, inférieur à la valeur reçue.';
    case 'QUANTITE_LIVREE_INVALIDE': return `La quantité livrée${detail(e, 'rang') ? ' de la ligne n° ' + detail(e, 'rang') : ''} doit être comprise entre 0 et le reliquat${detail(e, 'reliquat') ? ' (' + detail(e, 'reliquat') + ')' : ''}, et au moins une quantité positive.`;
    case 'QUANTITE_RECUE_INVALIDE': return `La quantité reçue${detail(e, 'rang') ? ' de la ligne n° ' + detail(e, 'rang') : ''} ne peut dépasser la quantité livrée${detail(e, 'quantiteLivree') ? ' (' + detail(e, 'quantiteLivree') + ')' : ''}, et au moins une quantité reçue doit être positive.`;
    case 'TAUX_INVALIDE': return 'Le taux journalier de pénalité doit être positif.';
    case 'COMMISSION_NON_DESIGNEE': return 'La commission de réception du contrat n’est pas encore désignée.';
    case 'PV_SIGNE': return 'Le procès-verbal est signé : il ne se rétablit plus.';
    case 'PV_NON_ETABLI': return 'Le procès-verbal n’est pas encore établi.';
    case 'DEJA_SIGNE': return 'Vous avez déjà signé ce procès-verbal.';
    case 'NON_RECU': return 'Le bon n’a pas encore de réception provisoire prononcée.';
    case 'GARANTIE_EN_COURS': return 'Le délai de garantie court encore : la réception définitive attend son terme.';
    case 'SANS_GARANTIE': return 'Sans délai de garantie, la réception provisoire vaut définitive.';
    case 'PV_EN_SIGNATURE': return 'Un procès-verbal attend ses signatures : la commission ne se recompose pas d’ici là.';
  }
  if (Array.isArray(erreurs) && erreurs.length) return erreurs.map((x) => (typeof x === 'string' ? x : (x as { message?: string }).message ?? '')).filter(Boolean).join(' ');
  if (e.status === 403) return 'Ce geste ne relève pas de votre rôle dans la commission de réception.';
  return e.message || 'Le geste n’a pas abouti.';
}

/** Un détail d'un refus, en texte (vide s'il manque). */
function detail(e: ApiError, cle: string): string {
  const v = corpsErreur<{ details?: Record<string, unknown> }>(e)?.details?.[cle];
  return typeof v === 'number' ? v.toLocaleString('fr-FR') : typeof v === 'string' ? v : '';
}

function aujourdhui(): string {
  const d = maintenantServeur();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * ⚠️ Lot MS-4 (V127, 16/10) — **la réception d'un bon de commande** (loi n° 2016-055, art. 13 ; CCAG fournitures, art. 22) : son état,
 * la garantie, chaque réception (provisoire, puis définitive) avec la livraison, le procès-verbal (décision, retard et pénalité
 * **indicative**, jamais retenue) et ses signatures. Gestes, selon qui regarde : déclarer la livraison (`peutDeclarer` : PRMP, UGPM) ;
 * établir le PV et ouvrir la réception définitive (`president` : le président de la commission, ou la PRMP quand elle préside) ;
 * signer (`signataire` : l'identifiant attendu — `PRMP`, ou le compte K… du membre). Le serveur reste la garde.
 */
@Component({
  selector: 'app-receptions-bon',
  imports: [QuantitesLignes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chargement()) {
      <p class="text-sm text-muted" role="status">Chargement de la réception…</p>
    } @else if (etat(); as d) {
      <div class="rb">
        <p class="text-sm rb__tete">
          <span class="badge" [class]="libelleEtat(d.etatReception).classe">{{ libelleEtat(d.etatReception).texte }}</span>
          @if (d.garantieMois) { Garantie de {{ d.garantieMois }} mois{{ d.garantieJusquau ? ', jusqu’au ' + date(d.garantieJusquau) : '' }}. }
          @else { Sans délai de garantie : la réception provisoire vaut définitive. }
        </p>
        <!-- ⚠️ 30/10 (« ccag-penalites-reception », §B5 ; V150) — la décision de la commission dans les 15 jours de la livraison (CCAG, art. 22.1). -->
        @if (d.alertes.includes('DECISION_RECEPTION_DEPASSEE')) {
          <div class="alert alert-danger" role="note">Le délai de décision de la commission de réception est dépassé (15 jours après la livraison, CCAG art. 22.1).</div>
        } @else if (d.alertes.includes('DECISION_RECEPTION_PROCHE')) {
          <div class="alert alert-warning" role="note">La décision de la commission de réception est due dans 3 jours au plus (15 jours après la livraison, CCAG art. 22.1).</div>
        }
        @if (d.alertes.includes('RECEPTION_DEFINITIVE_A_PRONONCER')) {
          <div class="alert alert-warning" role="note">
            <span>Le délai de garantie d’une livraison est écoulé : sa réception définitive est à prononcer.</span>
            @if (president()) { <button type="button" class="btn btn-primary btn-sm" [disabled]="occupe()" (click)="geste(service.ouvrirDefinitive(d.idBon), 'La réception définitive est ouverte : établissez son procès-verbal.')">Ouvrir la réception définitive</button> }
          </div>
        }

        <!-- ⚠️ 29/10 (« bons-reception », §B3 ; V148) — où en est chaque ligne du bon (vide pour un bon d'avant V148). -->
        @if (d.lignes?.length) {
          <div class="cnm-table-wrap">
            <table class="cnm-table rb__table" [attr.aria-label]="'Situation des articles du bon n° ' + d.numero">
              <thead><tr><th scope="col">Article</th><th scope="col">Unité</th><th scope="col" class="rb__num">Commandé</th><th scope="col" class="rb__num">Livré</th><th scope="col" class="rb__num">Reçu</th><th scope="col" class="rb__num">Reliquat</th></tr></thead>
              <tbody>
                @for (l of d.lignes; track l.rang) {
                  <tr><td>{{ l.designation || 'Ligne ' + l.rang }}</td><td>{{ l.unite || '—' }}</td><td class="rb__num">{{ nombre(l.commande) }}</td><td class="rb__num">{{ nombre(l.livre) }}</td><td class="rb__num">{{ nombre(l.recu) }}</td><td class="rb__num">{{ nombre(l.reliquat) }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        }

        @for (r of d.receptions; track r.id) {
          <article class="rb__reception" [attr.aria-label]="'Réception ' + (r.type === 'DEFINITIVE' ? 'définitive' : 'provisoire')">
            <h5 class="rb__h5">Réception {{ r.type === 'DEFINITIVE' ? 'définitive' + deLaLivraison(d, r) : 'provisoire' }}
              — {{ r.etat === 'SIGNE' ? 'PV signé le ' + dateHeure(r.signeLe) : r.etat === 'PV_ETABLI' ? 'PV en signature' : 'PV à établir' }}</h5>
            @if (r.dateLivraison) { <p class="text-sm">Livraison le {{ date(r.dateLivraison) }}{{ r.livraisonObservations ? ' — ' + r.livraisonObservations : '' }}{{ r.declareePar ? ' (déclarée par ' + r.declareePar + ')' : '' }}.</p> }
            @if (r.decisionAvantLe && r.etat !== 'SIGNE') { <p class="text-sm">Décision de la commission avant le {{ date(r.decisionAvantLe) }} (CCAG, art. 22.1).</p> }
            @if (r.lignes?.length) {
              <p class="text-sm">
                @for (l of r.lignes; track l.rang; let dernier = $last) {
                  {{ l.designation || 'Ligne ' + l.rang }} : livré {{ nombre(l.quantiteLivree) }}{{ l.quantiteRecue != null ? ', reçu ' + nombre(l.quantiteRecue) : '' }}{{ dernier ? '' : ' · ' }}
                }
                @if (r.valeurLivree != null) { — valeur livrée {{ ariary(r.valeurLivree) }} HT }
              </p>
            }
            @if (r.decision) {
              <p class="text-sm"><strong>{{ decisions[r.decision] }}</strong> le {{ date(r.dateReception) }}{{ r.motif ? ' — ' + r.motif : '' }}{{ r.reserves ? ' · réserves : ' + r.reserves : '' }}</p>
              @if (r.montantRefaction) { <p class="text-sm">Réfaction de {{ ariary(r.montantRefaction) }} : montant réceptionné {{ ariary(r.montantReceptionne) }} HT.</p> }
              @if (r.joursRetard != null || r.penaliteNote) {
                <p class="text-sm rb__penalite">
                  @if (r.echeanceLivraison) { Échéance de livraison le {{ date(r.echeanceLivraison) }} · }
                  @if (r.joursRetard != null) { {{ r.joursRetard > 0 ? r.joursRetard + ' jour(s) de retard' : 'livré dans le délai' }} }
                  @if (r.penaliteIndicative) { · pénalité <strong>indicative</strong> {{ ariary(r.penaliteIndicative) }} ({{ r.tauxPenalite }} ‰ par jour{{ r.plafondPenalite ? ', plafond ' + ariary(r.plafondPenalite) : '' }}) — jamais retenue par l’application }
                  {{ r.penaliteNote ? ' · ' + r.penaliteNote : '' }}
                </p>
              }
            }
            <!-- ⚠️ V150 (§B3 ; CCAG fournitures, art. 22.2) — chaque livraison reçue a sa garantie, puis sa réception définitive partielle. -->
            @if (r.type !== 'DEFINITIVE' && r.garantieJusquau) {
              @let def = definitiveDe(d, r);
              <p class="text-sm">{{ def ? 'Réception définitive ' + (def.etat === 'SIGNE' ? 'prononcée' : 'en cours') : 'Garantie de cette livraison jusqu’au ' + date(r.garantieJusquau) }}.</p>
            }
            @if (r.attendus.length) {
              <ul class="rb__signatures" aria-label="Signatures du procès-verbal">
                @for (a of r.attendus; track a.signataire) {
                  <li class="text-sm">{{ a.nom || a.signataire }}{{ a.president ? ' (président)' : '' }} — {{ a.signeLe ? 'signé le ' + dateHeure(a.signeLe) : 'à signer' }}</li>
                }
              </ul>
            }
            <div class="rb__actions">
              @if (r.pvDisponible) {
                <button type="button" class="btn btn-outline btn-sm" (click)="ouvrir(service.pv(r.id))">Procès-verbal (PDF)</button>
                <button type="button" class="btn btn-ghost btn-sm" (click)="enregistrer(service.pv(r.id, 'docx'), 'pv-reception-bon-' + d.numero + '.docx')">Word</button>
              }
              @if (president() && definitiveDue(d, r)) {
                <button type="button" class="btn btn-primary btn-sm" [disabled]="occupe()" (click)="geste(service.ouvrirDefinitive(d.idBon, r.id), 'La réception définitive de cette livraison est ouverte : établissez son procès-verbal.')">Ouvrir la réception définitive de cette livraison</button>
              }
              @if (r.etat === 'PV_ETABLI' && doitSigner(r)) {
                <button type="button" class="btn btn-primary btn-sm" [disabled]="occupe()" (click)="signer(r)">Signer le procès-verbal</button>
              }
            </div>

            @if (president() && r.etat !== 'SIGNE') {
              <details class="rb__details" [open]="r.etat === 'A_ETABLIR'">
                <summary>{{ r.etat === 'A_ETABLIR' ? 'Établir le procès-verbal' : 'Rétablir le procès-verbal (les signatures repartent de zéro)…' }}</summary>
                <div class="rb__form">
                  <div class="rb__ligne">
                    <label class="form-group"><span class="form-label">Décision</span>
                      <select class="form-control" (change)="poser('decision', $any($event.target).value)">
                        <option value="">—</option>
                        @for (k of decisionsPour(r); track k) { <option [value]="k" [selected]="champ('decision') === k">{{ decisions[k] }}</option> }
                      </select>
                    </label>
                    <label class="form-group"><span class="form-label">Date de la réception</span><input class="form-control" type="date" [min]="r.dateLivraison" [max]="aujourdhui" [value]="champ('date')" (input)="poser('date', $any($event.target).value)" /></label>
                    @if (champ('decision') === 'REFACTION') {
                      <label class="form-group"><span class="form-label">Montant de la réfaction (HT)</span><input class="form-control" type="number" min="0" step="any" [value]="champ('refaction')" (input)="poser('refaction', $any($event.target).value)" /></label>
                    }
                    @if (champ('decision') === 'RECEPTION' || champ('decision') === 'REFACTION') {
                      <label class="form-group"><span class="form-label">Taux de pénalité (‰ par jour ; vide : taux du CCAP, sinon du CCAG)</span><input class="form-control" type="number" min="0" step="any" [value]="champ('taux')" (input)="poser('taux', $any($event.target).value)" /></label>
                    }
                  </div>
                  @if (accepte() && lignesARecevoir(r).length) {
                    <app-quantites-lignes [lignes]="lignesARecevoir(r)" [saisie]="saisieRecue()" (saisieChange)="saisieRecue.set($event)" colonne="Quantité reçue" titre="Quantités reçues par article" />
                  }
                  @if (champ('decision') && champ('decision') !== 'RECEPTION') {
                    <label class="form-group"><span class="form-label">Motif</span><input class="form-control" type="text" [value]="champ('motif')" (input)="poser('motif', $any($event.target).value)" /></label>
                  }
                  <label class="form-group"><span class="form-label">Réserves (facultatives)</span><input class="form-control" type="text" [value]="champ('reserves')" (input)="poser('reserves', $any($event.target).value)" /></label>
                  <div><button type="button" class="btn btn-primary btn-sm" [disabled]="!pvComplet() || !recuesValides(r) || occupe()" (click)="etablir(r)">{{ r.etat === 'A_ETABLIR' ? 'Établir le procès-verbal' : 'Rétablir le procès-verbal' }}</button></div>
                </div>
              </details>
            }
          </article>
        } @empty { <p class="text-sm text-muted">Aucune livraison déclarée.</p> }

        @if (peutDeclarer() && livraisonAttendue(d.etatReception)) {
          <details class="rb__details">
            <summary>Déclarer la livraison…</summary>
            @if (lignesALivrer(d).length) {
              <div class="rb__form">
                <app-quantites-lignes [lignes]="lignesALivrer(d)" [saisie]="saisieLivree()" (saisieChange)="saisieLivree.set($event)" colonne="Quantité livrée" titre="Quantités livrées par article" />
              </div>
            }
            <div class="rb__ligne rb__form">
              <label class="form-group"><span class="form-label">Livré le</span><input class="form-control" type="date" [max]="aujourdhui" [value]="champ('livre')" (input)="poser('livre', $any($event.target).value)" /></label>
              <label class="form-group rb__large"><span class="form-label">Observations (facultatives)</span><input class="form-control" type="text" [value]="champ('obsLivraison')" (input)="poser('obsLivraison', $any($event.target).value)" /></label>
              <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe() || !livreesValides(d)" (click)="declarer(d)">Déclarer la livraison</button>
            </div>
          </details>
        }
        @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
      </div>
    } @else if (erreur(); as e) {
      <div class="alert alert-danger" role="alert">{{ e }}</div>
    }
  `,
  styles: `
    .rb { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.5rem 0.7rem; border-left: 3px solid var(--p-300); background: var(--n-50); }
    .rb__tete { margin: 0; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .rb__reception { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.4rem 0; border-top: 1px solid var(--n-200); }
    .rb__reception p { margin: 0; }
    .rb__h5 { margin: 0; font-size: 0.85rem; color: var(--p-700); }
    .rb__penalite { color: var(--n-700); }
    .rb__signatures { margin: 0; padding-left: 1.1rem; }
    .rb__actions { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .rb__details summary { cursor: pointer; font-size: var(--text-sm); font-weight: 500; }
    .rb__form { display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.35rem; }
    .rb__ligne { display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap; flex-direction: row; }
    .rb__large { flex: 1 1 16rem; }
    .rb__table { font-size: 0.82rem; }
    .rb__num { text-align: right; white-space: nowrap; }
  `,
})
export class ReceptionsBonVue implements OnInit {
  readonly idBon = input.required<number>();
  /** PRMP ou UGPM : déclarer la livraison. */
  readonly peutDeclarer = input(false);
  /** Le président de la commission (ou la PRMP quand elle préside) : établir le PV, ouvrir la définitive. */
  readonly president = input(false);
  /** L'identifiant de signataire du connecté (`PRMP`, ou son compte K…) ; nul : ne signe pas ici. */
  readonly signataire = input<string | null>(null);
  /** Membre de la commission : il signe sans connaître son identifiant (`aSigner` de « miennes »). */
  readonly signerSansIdentifiant = input(false);
  /** ⚠️ 29/10 (recette des formes) — un geste a abouti : le parent relit ce qui dépend de l’état du bon (liste du membre, badges). */
  readonly gesteFait = output<void>();

  readonly service = inject(ReceptionsCommandesService);
  private readonly toast = inject(ToastService);

  readonly ariary = ariary;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;
  readonly decisions = DECISIONS_RECEPTION;
  readonly livraisonAttendue = livraisonAttendue;
  readonly lignesALivrer = lignesALivrer;
  readonly lignesARecevoir = lignesARecevoir;
  readonly aujourdhui = aujourdhui();
  /** ⚠️ V148 — les quantités saisies à la livraison et au procès-verbal (préremplies au plafond). */
  readonly saisieLivree = signal<SaisieQuantites>({});
  readonly saisieRecue = signal<SaisieQuantites>({});

  readonly chargement = signal(true);
  readonly etat = signal<ReceptionsBon | null>(null);
  readonly occupe = signal(false);
  readonly erreur = signal<string | null>(null);
  private readonly champs = signal<Record<string, string>>({});

  readonly pvComplet = computed(() => {
    const c = this.champs();
    if (!c['decision']) return false;
    if (c['decision'] !== 'RECEPTION' && !(c['motif'] ?? '').trim()) return false;
    if (c['decision'] === 'REFACTION' && !(Number(c['refaction']) > 0)) return false;
    return true;
  });

  /** Réception ou réfaction : le PV dit ce qu'il reçoit ; ajournement et rejet ne reçoivent rien. */
  readonly accepte = computed(() => this.champs()['decision'] === 'RECEPTION' || this.champs()['decision'] === 'REFACTION');

  ngOnInit(): void {
    this.charger();
  }

  nombre(n: number | null | undefined): string {
    return n == null ? '—' : n.toLocaleString('fr-FR');
  }

  livreesValides(d: ReceptionsBon): boolean {
    const l = lignesALivrer(d);
    return !l.length || quantitesValides(l, this.saisieLivree());
  }

  recuesValides(r: ReceptionCommande): boolean {
    const l = lignesARecevoir(r);
    return !this.accepte() || !l.length || quantitesValides(l, this.saisieRecue());
  }

  /** Les quantités à envoyer, toutes les lignes saisissables comprises (une ligne omise vaudrait 0 à la livraison). */
  private quantites(lignes: LigneQuantite[], s: SaisieQuantites): { rang: number; q: number }[] {
    return lignes.map((l) => ({ rang: l.rang, q: quantiteSaisie(l, s) }));
  }

  charger(): void {
    this.chargement.set(true);
    this.service.duBon(this.idBon()).subscribe({
      next: (d) => {
        this.etat.set(d);
        this.chargement.set(false);
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        this.erreur.set(refusReception(e));
      },
    });
  }

  libelleEtat(e: string): { texte: string; classe: string } {
    return ETATS_RECEPTION_BON[e] ?? { texte: e, classe: 'badge-neutral' };
  }

  decisionsPour(r: ReceptionCommande): DecisionReceptionCommande[] {
    return r.type === 'DEFINITIVE' ? ['RECEPTION', 'AJOURNEMENT'] : ['RECEPTION', 'AJOURNEMENT', 'REFACTION', 'REJET'];
  }

  /** ⚠️ V150 (§B3) — la réception définitive qui prononce cette livraison, s'il y en a une. */
  definitiveDe(d: ReceptionsBon, r: ReceptionCommande): ReceptionCommande | undefined {
    return d.receptions.find((x) => x.type === 'DEFINITIVE' && x.idProvisoire === r.id);
  }

  /** ⚠️ V150 (§B3) — la garantie de cette livraison est écoulée, sa définitive pas ouverte, et aucune réception en cours sur le bon. */
  definitiveDue(d: ReceptionsBon, r: ReceptionCommande): boolean {
    return r.type !== 'DEFINITIVE' && r.etat === 'SIGNE' && !!r.garantieJusquau && r.garantieJusquau <= this.aujourdhui
      && !this.definitiveDe(d, r) && !d.receptions.some((x) => x.etat !== 'SIGNE');
  }

  /** ⚠️ V150 (§B3) — « de la livraison du … » pour une réception définitive qui nomme sa livraison. */
  deLaLivraison(d: ReceptionsBon, r: ReceptionCommande): string {
    const p = d.receptions.find((x) => x.id === r.idProvisoire);
    return p?.dateLivraison ? ` de la livraison du ${this.date(p.dateLivraison)}` : '';
  }

  /** Le connecté est-il un signataire attendu, sans avoir signé ? */
  doitSigner(r: ReceptionCommande): boolean {
    const s = this.signataire();
    if (s) return r.attendus.some((a) => a.signataire === s && !a.signeLe);
    return this.signerSansIdentifiant();
  }

  champ(cle: string): string {
    return this.champs()[cle] ?? '';
  }

  poser(cle: string, v: string): void {
    this.champs.update((c) => ({ ...c, [cle]: v }));
  }

  declarer(d: ReceptionsBon): void {
    const lignes = lignesALivrer(d);
    this.geste(this.service.declarerLivraison(d.idBon, {
      dateLivraison: this.champ('livre') || null,
      observations: this.champ('obsLivraison').trim() || null,
      ...(lignes.length ? { lignes: this.quantites(lignes, this.saisieLivree()).map((x) => ({ rang: x.rang, quantiteLivree: x.q })) } : {}),
    }),
      'La livraison est déclarée : la commission de réception est avertie.');
  }

  etablir(r: ReceptionCommande): void {
    const c = this.champs();
    const decision = c['decision'] as DecisionReceptionCommande;
    const lignes = this.accepte() ? lignesARecevoir(r) : [];
    this.geste(this.service.etablirPv(r.id, {
      ...(lignes.length ? { lignes: this.quantites(lignes, this.saisieRecue()).map((x) => ({ rang: x.rang, quantiteRecue: x.q })) } : {}),
      decision,
      dateReception: c['date'] || null,
      motif: decision === 'RECEPTION' ? null : (c['motif'] ?? '').trim(),
      reserves: (c['reserves'] ?? '').trim() || null,
      montantRefaction: decision === 'REFACTION' ? Number(c['refaction']) : null,
      tauxJournalier: c['taux'] ? Number(c['taux']) : null,
    }), 'Le procès-verbal est établi : chaque signataire est invité à le signer.');
  }

  signer(r: ReceptionCommande): void {
    this.geste(this.service.signer(r.id), 'Votre signature est enregistrée.');
  }

  /** Chaque geste relit l'état du bon (la réponse ne porte pas toujours tout le bon). */
  geste(appel: Observable<unknown>, succes: string): void {
    this.occupe.set(true);
    this.erreur.set(null);
    appel.subscribe({
      next: () => {
        this.occupe.set(false);
        this.champs.set({});
        this.saisieLivree.set({});
        this.saisieRecue.set({});
        this.toast.success(succes);
        this.gesteFait.emit();
        this.charger();
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.erreur.set(refusReception(e));
      },
    });
  }

  ouvrir(appel: Observable<Blob>): void {
    appel.subscribe({ next: (b) => ouvrirBlobSur(b), error: (e: ApiError) => this.erreur.set(e.status === 404 ? 'Le procès-verbal n’est pas encore disponible.' : refusReception(e)) });
  }

  enregistrer(appel: Observable<Blob>, nom: string): void {
    appel.subscribe({ next: (b) => telechargerBlob(b, nom), error: (e: ApiError) => this.erreur.set(refusReception(e)) });
  }
}
