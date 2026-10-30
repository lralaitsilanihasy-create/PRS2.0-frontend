import { ChangeDetectionStrategy, Component, computed, input, inject, output, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob, validerFichier } from '../../core/securite/fichiers-surs';
import { AlerteRemise, NatureReponseRemise, Remise, ReponseRemise } from '../../models';
import { RemisesService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { ariary } from '../evaluation/libelles-evaluation';
import { maintenantServeur } from '../../core/horloge/heure-serveur';

export const NATURES_REPONSE: Readonly<Record<NatureReponseRemise, string>> = {
  DEVIS: 'Devis',
  FACTURE_PRO_FORMA: 'Facture pro forma',
  DOCUMENT_CONVENU: 'Document convenu au contrat-cadre',
};

export const ETATS_REMISE: Readonly<Record<string, { texte: string; classe: string }>> = {
  EN_COURS: { texte: 'En cours', classe: 'badge-info' },
  EVALUEE: { texte: 'Évaluée — décision de la PRMP', classe: 'badge-warning' },
  ATTRIBUEE: { texte: 'Marché subséquent attribué', classe: 'badge-success' },
  INFRUCTUEUSE: { texte: 'Infructueuse', classe: 'badge-danger' },
};

const ALERTES: Readonly<Record<string, string>> = {
  EXCLUSION_POSSIBLE: 'Un titulaire n’a pas répondu à trois remises consécutives : son exclusion est possible (décret, art. 22).',
  DELIEMENT_POSSIBLE: 'Deux remises consécutives à plus de 30 % du prix moyen : l’acheteur est délié de l’exclusivité pour cet achat (décret, art. 23).',
  PLAFOND_DEPASSE: 'Une complétude dépasse l’offre indicative au-delà du plafond d’augmentation du contrat-cadre.',
};

/** Les refus de la remise en concurrence, dits à l'utilisateur. */
export function refusRemise(e: ApiError): string {
  const details = corpsErreur<{ details?: { champ?: string; offres?: unknown[]; lot?: number } }>(e)?.details ?? {};
  // ⚠️ V151 (§B3) — une remise commune : le lot qui bloque tout le lancement.
  const duLot = details.lot != null ? ` du lot ${details.lot}` : '';
  switch (codeErreur(e)) {
    case 'CHAMP_OBLIGATOIRE': return `Un champ obligatoire manque${details.champ ? ' (' + details.champ + ')' : ''} : l’objet, les spécifications et le délai d’exécution.`;
    case 'ECHEANCE_INVALIDE': return 'L’échéance se situe entre maintenant et la fin du contrat.';
    case 'CONTRAT_ECHU': return 'Le contrat est échu : plus aucune remise en concurrence.';
    case 'FORME_SANS_REMISE': return 'Un marché à commandes s’exécute par bons de commande, sans remise en concurrence.';
    case 'SANS_TITULAIRE': return `Le contrat${duLot} n’a plus de titulaire à consulter${duLot ? ' : la remise commune à tous les lots ne part pas' : ''}.`;
    case 'REMISE_EN_COURS': return `Une remise est déjà en cours sur le contrat${duLot} : attribuez-la ou déclarez-la infructueuse d’abord.`;
    case 'NATURE_INVALIDE': return 'Choisissez la nature de la réponse.';
    case 'MONTANT_INVALIDE': return 'Le montant hors taxes doit être positif.';
    case 'DATE_INVALIDE': return 'La date de réception se situe entre le lancement et l’échéance.';
    case 'FICHIER_OBLIGATOIRE': return 'Le fichier de la réponse est obligatoire.';
    case 'FORMAT_INVALIDE': return 'Le fichier doit être un PDF, une image JPEG ou PNG.';
    case 'ECHEANCE_PASSEE': return 'L’échéance est passée : la réponse n’est plus reçue.';
    case 'REMISE_CLOSE': return 'La remise est close : elle ne reçoit plus de réponse.';
    case 'REPONSES_FERMEES': return 'Les réponses restent fermées jusqu’à l’échéance.';
    case 'PRIX_MOYEN_INVALIDE': return 'Le prix moyen doit être un montant positif.';
    case 'DECISIONS_INCOMPLETES': return 'Décidez la conformité de chaque réponse.';
    case 'MOTIF_OBLIGATOIRE': return 'Le motif est obligatoire.';
    case 'DEJA_EVALUEE': return 'La remise est déjà évaluée.';
    case 'ECHEANCE_NON_PASSEE': return 'L’évaluation attend l’échéance de la remise.';
    case 'OFFRE_NON_CONFORME': return 'La réponse proposée doit être conforme.';
    case 'NON_EVALUEE': return 'La remise n’est pas encore évaluée par la commission.';
    case 'AUCUNE_PROPOSITION': return 'Aucune réponse conforme n’est proposée : déclarez la remise infructueuse.';
  }
  if (e.status === 403) return 'Ce geste ne relève pas de votre profil (l’évaluation revient au président de la commission, la décision à la PRMP).';
  if (e.status === 413) return 'Le fichier dépasse la taille admise.';
  return e.message || 'Le geste n’a pas abouti.';
}

/** Aujourd'hui, au format des champs de date. */
function aujourdhui(): string {
  const d = maintenantServeur();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Qui regarde la remise : la PRMP décide ; PRMP et UGPM saisissent les réponses papier ; la CAO évalue (son président, H1). */
export type ProfilRemise = 'PRMP' | 'UGPM' | 'CAO' | 'LECTURE';

/**
 * ⚠️ Lot MS-2 (V125, 16/10) — **une remise en concurrence** et son marché subséquent (décret n° 2019-1064, art. 20-33) : la lettre
 * d'invitation, les titulaires consultés, leurs réponses (fermées jusqu'à l'échéance), la réponse papier d'un titulaire sans compte
 * (PRMP, UGPM), l'évaluation en collège restreint (⚠️ H1 : le président de la CAO du contrat-cadre ; prix moyen **saisi**), le
 * rapport simplifié, puis la décision de la PRMP : attribuer au seul proposé (art. 20, pas de saupoudrage) ou déclarer infructueux.
 * Les alertes du serveur (exclusion, déliement, plafond) ne bloquent rien.
 */
@Component({
  selector: 'app-remise-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = remise();
    <article class="rd" [attr.aria-label]="'Remise n° ' + r.numero">
      <header class="rd__tete">
        <h3 class="rd__h3">{{ r.mode === 'COMPLETUDE' ? 'Demande de complétude' : 'Remise en concurrence' }} n° {{ r.numero }} — {{ r.objet }}</h3>
        <span class="badge" [class]="etat(r.etat).classe">{{ etat(r.etat).texte }}</span>
      </header>
      <p class="text-sm rd__meta">
        Échéance le <strong>{{ dateHeure(r.echeance) }}</strong>{{ r.echeancePassee ? ' (passée)' : '' }}
        · délai d’exécution {{ r.delaiExecution || '—' }}{{ r.lieuLivraison ? ' · livraison : ' + r.lieuLivraison : '' }}
        {{ r.lanceeLe ? ' · lancée le ' + dateHeure(r.lanceeLe) + (r.lanceePar ? ' par ' + r.lanceePar : '') : '' }}
      </p>
      @if (r.mode === 'COMPLETUDE') { <p class="text-sm text-muted rd__meta">Un seul titulaire : il complète son offre initiale (décret, art. 18).</p> }
      <!-- ⚠️ 30/10 (« contrat-cadre-4b », §B3 ; V151) — une remise commune à tous les lots (décret, art. 31) ; chaque lot se décide à part. -->
      @if (r.lots?.length) {
        <p class="text-sm rd__meta">Remise commune à tous les lots (décret, art. 31) :
          @for (g of r.lots; track g.idRemise; let dernier = $last) { lot {{ g.lot ?? '—' }} (n° {{ g.numero }}, {{ etat(g.etat).texte.toLowerCase() }}){{ dernier ? '' : ' · ' }} }
          — l’évaluation et la décision restent celles de chaque lot.</p>
      }
      @for (a of r.alertes; track a) { <div class="alert alert-warning" role="note"><span>{{ alerte(a) }}</span></div> }

      <div class="rd__actions">
        @if (r.lettreDisponible) {
          <button type="button" class="btn btn-outline btn-sm" (click)="ouvrir(service.lettre(r.id))">Lettre d’invitation (PDF)</button>
          <button type="button" class="btn btn-ghost btn-sm" (click)="enregistrer(service.lettre(r.id, 'docx'), 'lettre-remise-' + r.id + '.docx')">Word</button>
        }
        @if (r.rapportDisponible) {
          <button type="button" class="btn btn-outline btn-sm" (click)="ouvrir(service.rapport(r.id))">Rapport simplifié (PDF)</button>
          <button type="button" class="btn btn-ghost btn-sm" (click)="enregistrer(service.rapport(r.id, 'docx'), 'rapport-remise-' + r.id + '.docx')">Word</button>
        }
      </div>

      <h4 class="rd__h4">Titulaires consultés</h4>
      <div class="cnm-table-wrap">
        <table class="cnm-table rd__table" aria-label="Titulaires consultés">
          <thead><tr><th scope="col">Offre</th><th scope="col">Titulaire</th><th scope="col">Invité le</th><th scope="col">Réponse</th></tr></thead>
          <tbody>
            @for (c of r.consultes; track c.idOffre) {
              <tr>
                <td>n° {{ c.numero ?? '—' }}</td><td>{{ c.candidat || '—' }}</td><td>{{ c.notifieLe ? dateHeure(c.notifieLe) : '—' }}</td>
                <td>
                  @if (c.reponseRecue) { <span class="badge badge-success">Reçue</span> }
                  @else if (c.sansReponse) { <span class="badge badge-danger">Sans réponse</span> }
                  @else { <span class="text-muted">Attendue</span> }
                  @if ((c.absencesConsecutives ?? 0) > 1) { <span class="text-sm text-muted"> · {{ c.absencesConsecutives }} absences consécutives</span> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h4 class="rd__h4">Réponses</h4>
      @if (!r.reponses.length) {
        <p class="text-sm text-muted">Aucune réponse reçue.</p>
      } @else {
        @if (!r.echeancePassee) { <p class="text-sm text-muted">Les réponses restent fermées jusqu’à l’échéance : montants, délais et fichiers s’affichent ensuite.</p> }
        <div class="cnm-table-wrap">
          <table class="cnm-table rd__table" aria-label="Réponses des titulaires">
            <thead><tr><th scope="col">Titulaire</th><th scope="col">Nature</th><th scope="col">Reçue le</th><th scope="col" class="rd__num">HT</th><th scope="col" class="rd__num">TTC</th><th scope="col">Délai</th><th scope="col" class="rd__num">Écart au prix moyen</th><th scope="col">Conformité</th><th scope="col"><span class="sr-only">Fichier</span></th></tr></thead>
            <tbody>
              @for (x of r.reponses; track x.id) {
                <tr [class.rd__retenue]="x.idOffre === r.idOffreRetenue">
                  <td>n° {{ x.numero ?? '—' }} · {{ x.candidat || '—' }}@if (x.idOffre === r.idOffreProposee && !r.idOffreRetenue) { <span class="badge badge-info">Proposée</span> }@if (x.idOffre === r.idOffreRetenue) { <span class="badge badge-success">Retenue</span> }</td>
                  <td>{{ nature(x.nature) }}{{ x.voie === 'PAPIER' ? ' (papier)' : '' }}</td>
                  <td class="text-sm">{{ x.recueLe ? dateHeure(x.recueLe) : '—' }}</td>
                  <td class="rd__num">{{ x.montantHt != null ? ariary(x.montantHt) : '—' }}</td>
                  <td class="rd__num">{{ x.montantTtc != null ? ariary(x.montantTtc) : '—' }}</td>
                  <td>{{ x.delai ?? '—' }}</td>
                  <td class="rd__num" [class.rd__ecart]="(x.ecartPrixMoyen ?? 0) > 30">{{ x.ecartPrixMoyen != null ? (x.ecartPrixMoyen > 0 ? '+' : '') + x.ecartPrixMoyen + ' %' : '—' }}@if (x.plafondDepasse) { <span class="badge badge-warning">Plafond dépassé</span> }</td>
                  <td>
                    @if (x.conforme === true) { <span class="badge badge-success">Conforme{{ x.rang ? ' · rang ' + x.rang : '' }}</span> }
                    @else if (x.conforme === false) { <span class="badge badge-danger">Non conforme</span> <span class="text-sm">{{ x.motif }}</span> }
                    @else { <span class="text-muted">—</span> }
                  </td>
                  <td>@if (x.fichier) { <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Réponse de ' + x.candidat + ' : ' + x.fichier" (click)="ouvrir(service.fichierReponse(r.id, x.id))">{{ x.fichier }}</button> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Réponse papier d'un titulaire sans compte (H2) : PRMP ou UGPM, tant que la remise est en cours. -->
      @if ((profil() === 'PRMP' || profil() === 'UGPM') && r.etat === 'EN_COURS') {
        <details class="rd__details">
          <summary>Enregistrer une réponse reçue sur papier…</summary>
          <div class="rd__form">
            <div class="rd__ligne">
              <label class="form-group"><span class="form-label">Titulaire</span>
                <select class="form-control" (change)="poser('pOffre', $any($event.target).value)">
                  <option value="">—</option>
                  @for (c of r.consultes; track c.idOffre) { <option [value]="c.idOffre" [selected]="champ('pOffre') === c.idOffre">n° {{ c.numero }} · {{ c.candidat }}</option> }
                </select>
              </label>
              <label class="form-group"><span class="form-label">Nature</span>
                <select class="form-control" (change)="poser('pNature', $any($event.target).value)">
                  <option value="">—</option>
                  @for (n of natures; track n) { <option [value]="n" [selected]="champ('pNature') === n">{{ nature(n) }}</option> }
                </select>
              </label>
              <label class="form-group"><span class="form-label">Reçue le</span><input class="form-control" type="date" [max]="aujourdhui" [value]="champ('pDate')" (input)="poser('pDate', $any($event.target).value)" /></label>
            </div>
            <div class="rd__ligne">
              <label class="form-group"><span class="form-label">Montant HT (Ariary)</span><input class="form-control" type="number" min="0" step="1" [value]="champ('pHt')" (input)="poser('pHt', $any($event.target).value)" /></label>
              <label class="form-group"><span class="form-label">Montant TTC (facultatif)</span><input class="form-control" type="number" min="0" step="1" [value]="champ('pTtc')" (input)="poser('pTtc', $any($event.target).value)" /></label>
              <label class="form-group"><span class="form-label">Délai proposé (facultatif)</span><input class="form-control" type="text" [value]="champ('pDelai')" (input)="poser('pDelai', $any($event.target).value)" /></label>
            </div>
            <label class="form-group"><span class="form-label">La réponse (PDF, JPEG, PNG)</span><input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisir($any($event.target))" /></label>
            <div><button type="button" class="btn btn-outline btn-sm" [disabled]="!papierComplet() || occupe()" (click)="enregistrerPapier(r)">Enregistrer la réponse</button></div>
          </div>
        </details>
      }

      <!-- Évaluation en collège restreint (art. 28, 33) : ⚠️ H1, le président de la CAO du contrat-cadre, après l'échéance. -->
      @if (r.etat === 'EN_COURS' && r.echeancePassee) {
        @if (profil() === 'CAO') {
          <fieldset class="rd__form rd__cadre">
            <legend class="form-label">Évaluation en collège restreint — réservée au président de la commission</legend>
            <label class="form-group rd__court"><span class="form-label">Prix moyen du marché (facultatif, selon les règles du contrat-cadre)</span><input class="form-control" type="number" min="0" step="1" [value]="champ('prixMoyen')" (input)="poser('prixMoyen', $any($event.target).value)" /></label>
            @for (x of r.reponses; track x.id) {
              <div class="rd__decision">
                <span class="text-sm"><strong>n° {{ x.numero }} · {{ x.candidat }}</strong> — {{ x.montantHt != null ? ariary(x.montantHt) + ' HT' : '' }}</span>
                <label class="text-sm"><input type="radio" [name]="'conf-' + r.id + '-' + x.idOffre" [checked]="champ('c' + x.idOffre) === 'oui'" (change)="poser('c' + x.idOffre, 'oui')" /> Conforme</label>
                <label class="text-sm"><input type="radio" [name]="'conf-' + r.id + '-' + x.idOffre" [checked]="champ('c' + x.idOffre) === 'non'" (change)="poser('c' + x.idOffre, 'non')" /> Non conforme</label>
                @if (champ('c' + x.idOffre) === 'non') {
                  <input class="form-control form-control-sm rd__motif" type="text" [attr.aria-label]="'Motif de non-conformité : ' + x.candidat" placeholder="Motif" [value]="champ('m' + x.idOffre)" (input)="poser('m' + x.idOffre, $any($event.target).value)" />
                }
              </div>
            } @empty { <p class="text-sm">Aucune réponse : l’évaluation constate l’absence d’offre, la PRMP déclarera la remise infructueuse.</p> }
            @if (conformes(r).length) {
              <label class="form-group"><span class="form-label">Réponse proposée (à défaut : la moins-disante conforme)</span>
                <select class="form-control" (change)="poser('proposee', $any($event.target).value)">
                  <option value="">La moins-disante conforme</option>
                  @for (x of conformes(r); track x.id) { <option [value]="x.idOffre" [selected]="champ('proposee') === x.idOffre">n° {{ x.numero }} · {{ x.candidat }}</option> }
                </select>
              </label>
            }
            <label class="form-group"><span class="form-label">Observations (facultatives)</span><textarea class="form-control" rows="2" [value]="champ('obs')" (input)="poser('obs', $any($event.target).value)"></textarea></label>
            <div><button type="button" class="btn btn-primary btn-sm" [disabled]="!evaluationComplete(r) || occupe()" (click)="evaluer(r)">Arrêter l’évaluation et produire le rapport</button></div>
          </fieldset>
        } @else {
          <p class="text-sm text-muted">L’échéance est passée : l’évaluation revient au président de la commission d’appel d’offres du contrat-cadre (collège restreint).</p>
        }
      }

      <!-- Décision de la PRMP (art. 29-30). -->
      @if (r.etat === 'EVALUEE') {
        @if (profil() === 'PRMP') {
          <div class="rd__form rd__cadre">
            <p class="text-sm"><strong>Décision</strong> — le marché subséquent s’attribue au seul titulaire proposé (art. 20 : un seul opérateur par marché subséquent).@if (proposee(r); as p) { Proposé : n° {{ p.numero }} · <strong>{{ p.candidat }}</strong> — {{ ariary(p.montantHt) }} HT. }</p>
            @if (proposee(r)) {
              <div class="rd__ligne">
                <label class="form-group rd__large"><span class="form-label">Motif (facultatif)</span><input class="form-control" type="text" [value]="champ('dMotif')" (input)="poser('dMotif', $any($event.target).value)" /></label>
                <button type="button" class="btn btn-primary btn-sm" [disabled]="occupe()" (click)="geste(service.attribuer(r.id, champ('dMotif').trim() || null), 'Le marché subséquent est attribué ; chaque titulaire consulté est informé.')">Attribuer le marché subséquent</button>
              </div>
            }
            <div class="rd__ligne">
              <label class="form-group rd__large"><span class="form-label">Motif de l’infructuosité</span><input class="form-control" type="text" [value]="champ('iMotif')" (input)="poser('iMotif', $any($event.target).value)" /></label>
              <button type="button" class="btn btn-danger btn-sm" [disabled]="!champ('iMotif').trim() || occupe()" (click)="geste(service.declarerInfructueuse(r.id, champ('iMotif').trim()), 'La remise est déclarée infructueuse ; les titulaires consultés sont informés.')">Déclarer infructueuse</button>
            </div>
          </div>
        } @else {
          <p class="text-sm text-muted">Évaluée le {{ dateHeure(r.evalueeLe) }} : la décision revient à la PRMP.</p>
        }
      }
      @if (r.etat === 'ATTRIBUEE' || r.etat === 'INFRUCTUEUSE') {
        <p class="text-sm rd__fin">
          @if (r.etat === 'ATTRIBUEE') { Marché subséquent attribué{{ retenue(r) ? ' à ' + retenue(r)!.candidat : '' }} pour {{ ariary(r.montantRetenu) }} HT } @else { Déclarée infructueuse }
          le {{ dateHeure(r.decideeLe) }}{{ r.motifDecision ? ' — ' + r.motifDecision : '' }}.
        </p>
      }
      @if (r.prixMoyen != null) { <p class="text-sm text-muted rd__meta">Prix moyen retenu par la commission : {{ ariary(r.prixMoyen) }} HT.{{ r.observations ? ' Observations : ' + r.observations : '' }}</p> }
      @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
    </article>
  `,
  styles: `
    .rd { display: flex; flex-direction: column; gap: 0.45rem; padding: 0.7rem 0.9rem; border-left: 3px solid var(--p-600); background: var(--n-50, #f8fafc); border-radius: 0 6px 6px 0; }
    .rd__tete { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .rd__h3 { margin: 0; font-size: 0.95rem; flex: 1 1 auto; }
    .rd__h4 { margin: 0.3rem 0 0; font-size: 0.85rem; color: var(--p-700); }
    .rd__meta { margin: 0; }
    .rd__actions { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .rd__table { font-size: 0.82rem; }
    .rd__table thead th { background: var(--p-100); color: var(--p-800); }
    .rd__num { text-align: right; white-space: nowrap; }
    .rd__ecart { color: var(--warning-text); font-weight: 600; }
    .rd__retenue td { background: var(--success-bg, #f0fdf4); }
    .rd__details summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
    .rd__form { display: flex; flex-direction: column; gap: 0.45rem; padding-top: 0.4rem; margin: 0; }
    .rd__cadre { border: 1px solid var(--n-200); border-radius: 6px; padding: 0.6rem 0.8rem; background: var(--n-0, #fff); }
    .rd__ligne { display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap; }
    .rd__large { flex: 1 1 18rem; }
    .rd__court { max-width: 22rem; }
    .rd__decision { display: flex; gap: 0.8rem; align-items: center; flex-wrap: wrap; }
    .rd__motif { max-width: 18rem; }
    .rd__fin { margin: 0; font-weight: 600; }
  `,
})
export class RemiseDetail {
  readonly remise = input.required<Remise>();
  readonly profil = input<ProfilRemise>('LECTURE');
  readonly maj = output<Remise>();

  readonly service = inject(RemisesService);
  private readonly toast = inject(ToastService);

  readonly ariary = ariary;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;
  readonly aujourdhui = aujourdhui();
  readonly natures = Object.keys(NATURES_REPONSE) as NatureReponseRemise[];

  readonly occupe = signal(false);
  readonly erreur = signal<string | null>(null);
  private readonly champs = signal<Record<string, string>>({});
  private readonly fichier = signal<File | null>(null);

  readonly papierComplet = computed(() => {
    const c = this.champs();
    return !!c['pOffre'] && !!c['pNature'] && !!c['pDate'] && Number(c['pHt']) > 0 && !!this.fichier();
  });

  champ(cle: string): string {
    return this.champs()[cle] ?? '';
  }

  poser(cle: string, valeur: string): void {
    this.champs.update((c) => ({ ...c, [cle]: valeur }));
  }

  choisir(champ: HTMLInputElement): void {
    const f = champ.files?.[0] ?? null;
    const erreur = f ? validerFichier(f) : null;
    if (erreur) {
      champ.value = '';
      this.erreur.set(erreur);
    }
    this.fichier.set(erreur ? null : f);
  }

  etat(e: string): { texte: string; classe: string } {
    return ETATS_REMISE[e] ?? { texte: e, classe: 'badge-neutral' };
  }

  alerte(a: AlerteRemise): string {
    return ALERTES[a] ?? a;
  }

  nature(n: string): string {
    return NATURES_REPONSE[n as NatureReponseRemise] ?? n;
  }

  /** Les réponses cochées conformes dans le formulaire d'évaluation. */
  conformes(r: Remise): ReponseRemise[] {
    return r.reponses.filter((x) => this.champ('c' + x.idOffre) === 'oui');
  }

  evaluationComplete(r: Remise): boolean {
    const pm = this.champ('prixMoyen');
    if (pm && !(Number(pm) > 0)) return false;
    return r.reponses.every((x) => this.champ('c' + x.idOffre) === 'oui' || (this.champ('c' + x.idOffre) === 'non' && !!this.champ('m' + x.idOffre).trim()));
  }

  proposee(r: Remise): ReponseRemise | null {
    return r.reponses.find((x) => x.idOffre === r.idOffreProposee) ?? null;
  }

  retenue(r: Remise): ReponseRemise | null {
    return r.reponses.find((x) => x.idOffre === r.idOffreRetenue) ?? null;
  }

  enregistrerPapier(r: Remise): void {
    const f = this.fichier();
    if (!f) return;
    const ttc = this.champ('pTtc');
    this.geste(
      this.service.reponsePapier(r.id, this.champ('pOffre'), {
        nature: this.champ('pNature') as NatureReponseRemise,
        montantHt: Number(this.champ('pHt')),
        montantTtc: ttc ? Number(ttc) : null,
        delai: this.champ('pDelai').trim() || null,
      }, this.champ('pDate'), f),
      'La réponse papier est enregistrée.',
    );
  }

  evaluer(r: Remise): void {
    const pm = this.champ('prixMoyen');
    this.geste(
      this.service.evaluer(r.id, {
        prixMoyen: pm ? Number(pm) : null,
        decisions: r.reponses.map((x) => {
          const conforme = this.champ('c' + x.idOffre) === 'oui';
          return { idOffre: x.idOffre, conforme, motif: conforme ? null : this.champ('m' + x.idOffre).trim() };
        }),
        idOffreProposee: this.champ('proposee') || null,
        observations: this.champ('obs').trim() || null,
      }),
      'L’évaluation est arrêtée et le rapport simplifié produit : la décision revient à la PRMP.',
    );
  }

  geste(appel: Observable<Remise>, succes: string): void {
    this.occupe.set(true);
    this.erreur.set(null);
    appel.subscribe({
      next: (r) => {
        this.occupe.set(false);
        this.champs.set({});
        this.fichier.set(null);
        this.toast.success(succes);
        this.maj.emit(r);
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.erreur.set(refusRemise(e));
      },
    });
  }

  ouvrir(appel: Observable<Blob>): void {
    appel.subscribe({ next: (b) => ouvrirBlobSur(b), error: (e: ApiError) => this.erreur.set(e.status === 404 ? 'Le document n’est pas encore disponible.' : refusRemise(e)) });
  }

  enregistrer(appel: Observable<Blob>, nom: string): void {
    appel.subscribe({ next: (b) => telechargerBlob(b, nom), error: (e: ApiError) => this.erreur.set(refusRemise(e)) });
  }
}
