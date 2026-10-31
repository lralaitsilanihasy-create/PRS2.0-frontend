import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { AlerteContrat, ContratVigueur, DecisionReconduction, Remise, TypeContratVigueur } from '../../models';
import { ContratsVigueurService, RemisesService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { DeuxVolets } from '../../shared/ui/deux-volets';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { ariary } from '../evaluation/libelles-evaluation';
import { ProfilRemise, RemiseDetail, refusRemise } from '../remises/remise-detail';
import { BonsCommandeContrat } from '../bons-commande/bons-commande-contrat';
import { CommissionReceptionPanneau } from '../receptions/commission-reception';
import { maintenantServeur } from '../../core/horloge/heure-serveur';

const ALERTES: Readonly<Record<string, { texte: string; classe: string }>> = {
  RECONDUCTION_A_DECIDER: { texte: 'Reconduction à décider', classe: 'badge-warning' },
  ECHEANCE_PROCHE: { texte: 'Échéance dans moins de 30 jours', classe: 'badge-warning' },
  ECHU: { texte: 'Échu', classe: 'badge-danger' },
  // ⚠️ Lot MS-3 (V126) — les alertes de consommation, jamais bloquantes.
  MINIMUM_NON_ATTEINT: { texte: 'Minimum annuel non atteint', classe: 'badge-warning' },
  MONTANT_ESTIME_DEPASSE: { texte: 'Montant estimé dépassé', classe: 'badge-warning' },
  // ⚠️ 29/10 (« contrat-cadre-4a », §B3 ; V147) — une échéance du calendrier des remises approche (J−15) ou est passée sans remise.
  REMISE_A_LANCER: { texte: 'Remise en concurrence à lancer', classe: 'badge-warning' },
  // ⚠️ 29/10 (« marche-a-commandes-champs », D3) — la valeur maximale estimée du marché à commandes est dépassée : signalé, jamais refusé.
  MAXIMUM_ESTIME_DEPASSE: { texte: 'Maximum estimé dépassé', classe: 'badge-warning' },
};

const TYPES: Readonly<Record<TypeContratVigueur, string>> = {
  CONTRAT_CADRE: 'Contrat-cadre',
  A_COMMANDE: 'Marché à commandes',
};

/** Les refus de la reconduction, dits à la PRMP. */
export function refusReconduction(e: ApiError): string {
  const details = corpsErreur<{ details?: { finMaximale?: string } }>(e)?.details ?? {};
  switch (codeErreur(e)) {
    case 'DECISION_INVALIDE': return 'Choisissez de reconduire ou de ne pas reconduire.';
    case 'DECISION_OBLIGATOIRE': return 'La référence de votre décision écrite est obligatoire.';
    case 'DATE_INVALIDE': return 'La date de la décision se situe entre la prise d’effet du contrat et aujourd’hui.';
    case 'CONTRAT_ECHU': return 'Le contrat est échu : il ne se reconduit plus.';
    case 'NON_RECONDUCTIBLE': return 'Ce contrat n’est pas reconductible (fiche validée).';
    case 'RECONDUCTIONS_EPUISEES': return 'Toutes les reconductions prévues ont été décidées.';
    case 'DUREE_MAX_ATTEINTE': return `Une reconduction dépasserait la durée maximale du contrat${details.finMaximale ? ' (fin au plus tard le ' + dateFr(details.finMaximale) + ')' : ''}.`;
    case 'DEJA_DECIDE': return 'La décision de cette période est déjà prise.';
  }
  if (e.status === 403) return 'La reconduction se décide par la PRMP de la procédure.';
  return e.message || 'La décision n’a pas abouti.';
}

/** ⚠️ 29/10 — les refus de la relecture des termes depuis la fiche. */
export function refusRelecture(e: ApiError): string {
  switch (codeErreur(e)) {
    case 'CONTRAT_ECHU': return 'Le contrat est échu : ses termes ne se relisent plus.';
    case 'FICHE_NON_VALIDEE': return 'La fiche est en révision : revalidez-la avant de relire le contrat.';
    case 'FORME_CHANGEE': return 'La forme du marché de la fiche n’est plus celle du contrat : il ne se relit pas.';
  }
  if (e.status === 403) return 'Les termes du contrat se relisent par la PRMP de la procédure.';
  return e.message || 'La relecture n’a pas abouti.';
}

/** Aujourd'hui, au format des champs de date. */
function aujourdhui(): string {
  const d = maintenantServeur();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * ⚠️ Lot MS-1 (V124, 16/10 ; demande « marchés subséquents ») — **les contrats en vigueur** : un par lot notifié de contrat-cadre ou
 * de marché à commandes. Ce qui le régit est figé depuis la fiche validée ; ses titulaires forment une liste fermée (décret
 * n° 2019-1064, art. 18). La PRMP y décide par écrit la **reconduction** de chaque période (AE-CC, art. 7.3) ; l'UGPM lit.
 * Les alertes (reconduction à décider, échéance proche, échu) sont calculées par le serveur. Une ligne s'ouvre sur place.
 */
@Component({
  selector: 'app-contrats-vigueur',
  imports: [EtatErreur, DeuxVolets, RemiseDetail, BonsCommandeContrat, CommissionReceptionPanneau],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cv">
      <header class="cv__tete">
        <h1 class="cv__h1">Contrats en vigueur</h1>
        <p class="text-sm text-muted cv__intro">Contrats-cadres et marchés à commandes notifiés : titulaires, échéances et reconductions, remises en concurrence, bons de commande et leur réception.</p>
        <div class="cv__filtres" role="group" aria-label="Filtrer les contrats">
          @for (f of filtres; track f.cle) {
            <button type="button" class="btn btn-sm" [class.btn-primary]="filtre() === f.cle" [class.btn-outline]="filtre() !== f.cle" [attr.aria-pressed]="filtre() === f.cle" (click)="filtre.set(f.cle)">{{ f.libelle }} ({{ compte(f.cle) }})</button>
          }
        </div>
      </header>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des contrats…</p>
      } @else if (erreurListe(); as m) {
        <app-etat-erreur [message]="m" aide="La liste n’a pas pu être lue." (reessayer)="charger()" />
      } @else if (!visibles().length) {
        <p class="text-muted">{{ contrats().length ? 'Aucun contrat dans ce filtre.' : 'Aucun contrat en vigueur : un contrat se crée à la notification d’un lot de contrat-cadre ou de marché à commandes.' }}</p>
      } @else {
        <!-- ⚠️ 31/10 (pilote, Espace de travail, lot 3) — deux volets : la liste à gauche, le détail du contrat choisi à droite,
             sans changer de page. Le premier contrat est choisi d'office. -->
        <app-deux-volets [ouvert]="!!selection()" [cle]="selection()?.id ?? null" libelleListe="Contrats" libelleDetail="Détail du contrat"
                         invite="Choisissez un contrat : son détail s’affiche ici.">
        <ul liste class="cv__liste">
          @for (c of visibles(); track c.id) {
            <li class="cv__carte" [class.cv__carte--echu]="c.etat === 'ECHU'" [class.cv__carte--on]="ouvert() === c.id">
              <button type="button" class="cv__ligne" [attr.aria-pressed]="ouvert() === c.id" [attr.aria-controls]="'cv-detail-' + c.id" (click)="choisir(c.id)">
                <span class="cv__type">{{ type(c) }}</span>
                <span class="cv__objet"><strong>{{ c.objet || 'Objet non renseigné' }}</strong>@if (c.acheteur) { <span class="text-muted"> · {{ c.acheteur }}</span> }<span class="text-muted"> · fiche {{ c.idDmc }}, lot {{ c.lot }}</span></span>
                <span class="cv__echeance">Fin le <strong>{{ date(c.dateFin) }}</strong></span>
                <span class="cv__badges">
                  @for (a of c.alertes; track a) { <span class="badge" [class]="alerte(a).classe">{{ alerte(a).texte }}</span> }
                  @if (!c.alertes.length) { <span class="badge badge-success">En vigueur</span> }
                </span>
              </button>
            </li>
          }
        </ul>
        <div detail>
              @if (selection(); as c) {
                <div class="cv__detail" [id]="'cv-detail-' + c.id">
                  <div class="cv__detail-tete">
                    <span class="cv__type">{{ type(c) }} · fiche {{ c.idDmc }}, lot {{ c.lot }}</span>
                    <h2 class="cv__detail-titre">{{ c.objet || 'Objet non renseigné' }}</h2>
                    @if (c.acheteur) { <span class="text-sm text-muted">{{ c.acheteur }}</span> }
                  </div>
                  <dl class="cv__grille">
                    <div><dt>Prise d’effet</dt><dd>{{ date(c.dateEffet) }} (notification)</dd></div>
                    <div><dt>Période</dt><dd>{{ c.periodeMois ?? '—' }} mois · fin le {{ date(c.dateFin) }}</dd></div>
                    <div><dt>Durée maximale</dt><dd>{{ c.dureeMaxMois ?? '—' }} mois{{ c.finMaximale ? ' · au plus tard le ' + date(c.finMaximale) : '' }}</dd></div>
                    <div><dt>Reconduction</dt><dd>{{ c.reconductible ? c.reconductions + ' sur ' + (c.reconductionsMax ?? '—') + ' décidée(s)' + (c.preavisMois ? ' · préavis ' + c.preavisMois + ' mois' : '') : 'non reconductible' }}</dd></div>
                    @if (c.reconductible && c.dateLimiteDecision) { <div><dt>Décision attendue avant le</dt><dd>{{ date(c.dateLimiteDecision) }}</dd></div> }
                    @if (c.montantEstime != null) { <div><dt>Montant estimé</dt><dd>{{ ariary(c.montantEstime) }} HT</dd></div> }
                    @if (c.montantMinimum != null) { <div><dt>Minimum</dt><dd>{{ ariary(c.montantMinimum) }}</dd></div> }
                    @if (c.montantMaximum != null) { <div><dt>Maximum</dt><dd>{{ ariary(c.montantMaximum) }}</dd></div> }
                    @if (c.formeSubsequents) { <div><dt>Forme des marchés subséquents</dt><dd>{{ c.formeSubsequents }}</dd></div> }
                    @if (c.rythme) { <div><dt>Rythme</dt><dd>{{ c.rythme }}</dd></div> }
                    @if (c.calendrier) { <div class="cv__large"><dt>Calendrier</dt><dd>{{ c.calendrier }}</dd></div> }
                    @if (c.periodiciteMois) {
                      <div><dt>Remises au calendrier</dt><dd>tous les {{ c.periodiciteMois }} mois{{ c.premiereRemise ? ', à partir du ' + date(c.premiereRemise) : '' }}</dd></div>
                    }
                    @if (c.prochaineRemise; as p) {
                      <div><dt>Prochaine remise</dt><dd>{{ date(p) }} @if (p < aujourdhui) { <span class="badge badge-danger">En retard</span> }</dd></div>
                    }
                  </dl>
                  <!-- ⚠️ 29/10 (« marche-a-commandes-champs », §B3) — les termes sont figés à la notification : après une révision de la fiche, la PRMP les relit. -->
                  @if (prmp() && c.etat === 'EN_VIGUEUR') {
                    <div class="cv__relecture">
                      <button type="button" class="btn btn-ghost btn-sm" [disabled]="occupe()" (click)="relire(c)">Relire depuis la fiche</button>
                      <span class="text-sm text-muted">Reprend la période, les montants et la reconduction de la dernière version validée de la fiche ; les bons, remises et réceptions restent intacts.</span>
                    </div>
                    @if (refusRelecture(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }
                  }

                  <h2 class="cv__h2">Titulaires <span class="text-muted text-sm">— liste fermée (décret n° 2019-1064, art. 18)</span></h2>
                  <div class="cnm-table-wrap">
                    <table class="cnm-table cv__table" [attr.aria-label]="'Titulaires du contrat ' + c.id">
                      <thead><tr><th scope="col">Rang</th><th scope="col">Offre</th><th scope="col">Titulaire</th><th scope="col">NIF</th><th scope="col" class="cv__num">Offre indicative HT</th><th scope="col">Délai</th></tr></thead>
                      <tbody>
                        @for (t of c.titulaires; track t.idOffre) {
                          <tr><td>{{ t.rang ?? '—' }}</td><td>n° {{ t.numero ?? '—' }}</td><td>{{ t.candidat || '—' }}</td><td class="cnm-mono">{{ t.nif || '—' }}</td><td class="cv__num">{{ ariary(t.montant) }}</td><td>{{ t.delai ?? '—' }}</td></tr>
                        } @empty { <tr><td colspan="6" class="text-muted">Aucun titulaire.</td></tr> }
                      </tbody>
                    </table>
                  </div>

                  @if (c.decisions.length) {
                    <h2 class="cv__h2">Décisions de reconduction</h2>
                    <ul class="cv__decisions">
                      @for (d of c.decisions; track d.id) {
                        <li class="text-sm">
                          <strong>{{ d.decision === 'RECONDUIRE' ? 'Reconduit' : 'Non reconduit' }}</strong> — décision {{ d.reference }} du {{ date(d.dateDecision) }}{{ d.nouvelleFin ? ' : fin reportée au ' + date(d.nouvelleFin) : '' }}
                          @if (d.horsPreavis) { <span class="badge badge-warning">Hors préavis</span> }
                          <span class="text-muted"> · enregistrée le {{ dateHeure(d.le) }}{{ d.par ? ' par ' + d.par : '' }}</span>
                        </li>
                      }
                    </ul>
                  }

                  <!-- ⚠️ Lot MS-2 (V125, 16/10) — les remises en concurrence du contrat-cadre et leurs marchés subséquents. -->
                  @if (c.typeMarche !== 'A_COMMANDE') {
                    <h2 class="cv__h2">Remises en concurrence <span class="text-muted text-sm">— marchés subséquents (décret n° 2019-1064, art. 20-33)</span></h2>
                    @if (chargementRemises()) {
                      <p class="text-sm text-muted" role="status">Chargement des remises…</p>
                    } @else {
                      @for (r of remises(); track r.id) {
                        <app-remise-detail [remise]="r" [profil]="profilRemise()" (maj)="remiseAJour($event)" />
                      } @empty { <p class="text-sm text-muted">Aucune remise en concurrence pour ce contrat.</p> }
                      @if (erreurRemises(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }
                    }
                    @if ((prmp() || ugpm()) && c.etat === 'EN_VIGUEUR' && !remiseOuverte()) {
                      <details class="cv__details" [open]="c.alertes.includes('REMISE_A_LANCER')">
                        <summary>Lancer une remise en concurrence…</summary>
                        <div class="cv__form cv__form--remise">
                          <p class="text-sm text-muted">Tous les titulaires non retirés sont consultés (art. 21) ; s’il n’en reste qu’un, il est invité à compléter son offre initiale. La lettre d’invitation suit l’annexe 1 du document type.</p>
                          @if (c.rythme === selonCalendrier) {
                            <!-- ⚠️ 30/10 (« contrat-cadre-4b », §B3 ; V151) — au calendrier, la remise porte sur tous les lots de la procédure. -->
                            <p class="text-sm" role="note">Remises au calendrier : la remise est lancée pour <strong>tous les lots</strong> de la procédure au même calendrier (décret, art. 31), une par lot ; chaque lot s’évalue et se décide à part.</p>
                          }
                          <label class="form-group"><span class="form-label">Objet du marché subséquent</span><input class="form-control" type="text" [value]="lr('objet')" (input)="poserLr('objet', $any($event.target).value)" /></label>
                          <label class="form-group"><span class="form-label">Spécifications (annexe 2 de la lettre)</span><textarea class="form-control" rows="3" [value]="lr('specifications')" (input)="poserLr('specifications', $any($event.target).value)"></textarea></label>
                          <label class="form-group"><span class="form-label">Critères d’attribution (facultatif)</span><input class="form-control" type="text" [value]="lr('criteres')" (input)="poserLr('criteres', $any($event.target).value)" /></label>
                          <div class="cv__champs">
                            <label class="form-group"><span class="form-label">Délai d’exécution</span><input class="form-control" type="text" [value]="lr('delaiExecution')" (input)="poserLr('delaiExecution', $any($event.target).value)" /></label>
                            <label class="form-group"><span class="form-label">Lieu de livraison (facultatif)</span><input class="form-control" type="text" [value]="lr('lieuLivraison')" (input)="poserLr('lieuLivraison', $any($event.target).value)" /></label>
                            <label class="form-group"><span class="form-label">Validité des offres, en jours (facultatif)</span><input class="form-control" type="number" min="1" step="1" [value]="lr('validiteJours')" (input)="poserLr('validiteJours', $any($event.target).value)" /></label>
                          </div>
                          <div class="cv__champs">
                            <label class="form-group"><span class="form-label">Date et heure limites des réponses</span><input class="form-control" type="datetime-local" [value]="lr('echeance')" (input)="poserLr('echeance', $any($event.target).value)" /></label>
                            <label class="form-group cv__large"><span class="form-label">Visite des lieux (facultatif)</span><input class="form-control" type="text" [value]="lr('visite')" (input)="poserLr('visite', $any($event.target).value)" /></label>
                          </div>
                          <p class="text-sm text-muted">Échéance entre maintenant et la fin du contrat ({{ date(c.dateFin) }}) ; vide pour un titulaire unique, elle vaut le délai de complétude du contrat-cadre.</p>
                          @if (refusLancement(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }
                          <div><button type="button" class="btn btn-primary btn-sm" [disabled]="!lr('objet').trim() || !lr('specifications').trim() || !lr('delaiExecution').trim() || occupe()" (click)="lancer(c)">Lancer et envoyer les lettres d’invitation</button></div>
                        </div>
                      </details>
                    }
                  }

                  <!-- ⚠️ Lot MS-3 (V126, 16/10) — les bons de commande ; relus quand une remise change (une attribution ouvre l'émission). -->
                  <h2 class="cv__h2">Bons de commande <span class="text-muted text-sm">— {{ c.typeMarche === 'A_COMMANDE' ? 'marché à commandes (loi n° 2016-055, art. 30)' : 'des marchés subséquents attribués (décret n° 2019-1064, art. 33)' }}</span></h2>
                  @for (k of [cleBons()]; track k) {
                    <app-bons-commande-contrat [contrat]="c" [prmp]="prmp()" [ugpm]="ugpm()" [presideeParPrmp]="presideeParPrmp()" />
                  }

                  <!-- ⚠️ Lot MS-4 (V127, 16/10) — la commission de réception, désignée par décision de la PRMP (Q1 ; loi art. 13). -->
                  <h2 class="cv__h2">Commission de réception <span class="text-muted text-sm">— loi n° 2016-055, art. 13</span></h2>
                  <app-commission-reception [idContrat]="c.id" [peutDesigner]="prmp() || ugpm()" (lue)="presideeParPrmp.set(!!$event && $event.membres.length > 0 && $event.presideeParPrmp)" />

                  @if (prmp() && reconductionOuverte(c)) {
                    <fieldset class="cv__form">
                      <legend class="form-label">Décider la reconduction de la période en cours</legend>
                      <div class="cv__radios">
                        <label><input type="radio" [name]="'cv-dec-' + c.id" [checked]="decision() === 'RECONDUIRE'" (change)="decision.set('RECONDUIRE')" /> Reconduire</label>
                        <label><input type="radio" [name]="'cv-dec-' + c.id" [checked]="decision() === 'NE_PAS_RECONDUIRE'" (change)="decision.set('NE_PAS_RECONDUIRE')" /> Ne pas reconduire</label>
                      </div>
                      <div class="cv__champs">
                        <label class="form-group"><span class="form-label">Référence de la décision écrite</span><input class="form-control" type="text" [value]="reference()" (input)="reference.set($any($event.target).value)" /></label>
                        <label class="form-group"><span class="form-label">Date de la décision</span><input class="form-control" type="date" [min]="c.dateEffet" [max]="aujourdhui" [value]="dateDecision()" (input)="dateDecision.set($any($event.target).value)" /></label>
                      </div>
                      @if (c.dateLimiteDecision && aujourdhui > c.dateLimiteDecision) {
                        <p class="text-sm cv__alerte">La limite du préavis ({{ date(c.dateLimiteDecision) }}) est passée : la décision sera acceptée, mais marquée hors préavis.</p>
                      }
                      @if (refus(); as r) { <div class="alert alert-danger" role="alert">{{ r }}</div> }
                      <div><button type="button" class="btn btn-primary btn-sm" [disabled]="!decision() || !reference().trim() || !dateDecision() || occupe()" (click)="decider(c)">Enregistrer la décision</button></div>
                    </fieldset>
                  }
                </div>
              }
        </div>
        </app-deux-volets>
      }
    </section>
  `,
  styles: `
    .cv { display: flex; flex-direction: column; gap: 0.9rem; }
    .cv__tete { display: flex; flex-direction: column; gap: 0.4rem; }
    .cv__h1 { margin: 0; font-size: 1.3rem; }
    .cv__intro { margin: 0; }
    .cv__filtres { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    /* ⚠️ 31/10 (Espace de travail) — volet de gauche : des lignes compactes ; la ligne choisie porte l'onglet actif et un filet. */
    .cv__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .cv__carte { padding: 0; overflow: hidden; border-bottom: 1px solid var(--bordure); }
    .cv__carte--on { background: var(--onglet-actif-fond); box-shadow: inset 3px 0 0 var(--menu-fond); }
    .cv__detail-tete { display: flex; flex-direction: column; gap: 2px; padding-bottom: 8px; border-bottom: 1px solid var(--bordure); }
    .cv__detail-titre { margin: 2px 0 0; font-size: 15px; font-weight: 500; line-height: 1.35; }
    .cv__carte--echu { opacity: 0.85; }
    .cv__ligne { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'type type' 'objet objet' 'echeance badges'; gap: 0.25rem 0.6rem; align-items: center; padding: 0.6rem 0.8rem; }
    .cv__ligne .cv__type { grid-area: type; } .cv__ligne .cv__objet { grid-area: objet; } .cv__ligne .cv__echeance { grid-area: echeance; } .cv__ligne .cv__badges { grid-area: badges; }
    .cv__ligne:focus-visible { outline: 2px solid var(--p-600); outline-offset: -2px; }
    .cv__ligne:hover { background: var(--n-100); }
    .cv__type { font-size: 0.78rem; font-weight: 500; color: var(--p-700); text-transform: uppercase; letter-spacing: 0.03em; }
    .cv__objet { min-width: 0; overflow-wrap: anywhere; }
    .cv__echeance { font-size: var(--text-sm); white-space: nowrap; }
    .cv__badges { display: flex; gap: 0.3rem; flex-wrap: wrap; justify-content: flex-end; }
    .cv__detail { display: flex; flex-direction: column; gap: 0.6rem; }
    .cv__grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.5rem 1.2rem; margin: 0; }
    .cv__grille dt { font-size: 0.74rem; color: var(--n-500); }
    .cv__grille dd { margin: 0; font-size: 0.88rem; }
    .cv__large { grid-column: 1 / -1; }
    .cv__h2 { margin: 0.3rem 0 0; font-size: 0.95rem; color: var(--p-700); }
    .cv__table { font-size: 0.84rem; }
    .cv__table thead th { background: var(--p-100); color: var(--p-800); }
    .cv__num { text-align: right; white-space: nowrap; }
    .cv__decisions { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .cv__form { border: 1px solid var(--n-200); border-radius: 6px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.5rem; margin: 0; }
    .cv__radios { display: flex; gap: 1.2rem; font-size: var(--text-sm); }
    .cv__champs { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    .cv__alerte { margin: 0; color: var(--warning-text); }
    .cv__details summary { cursor: pointer; font-size: var(--text-sm); font-weight: 500; }
    .cv__form--remise { border: 0; padding: 0.4rem 0 0; }
    .cv__large { flex: 1 1 18rem; }
    .cv__relecture { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-top: 0.4rem; }
    @media (max-width: 800px) { .cv__badges { justify-content: flex-end; } }
  `,
})
export class ContratsVigueur implements OnInit {
  private readonly service = inject(ContratsVigueurService);
  private readonly remisesService = inject(RemisesService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  /**
   * ⚠️ 29/10 (« contrat-cadre-4a », §B2-B3) — `?dmc=` (et `&lot=`) : la notification d'un contrat (reconduction, échéance, remise à
   * lancer ; objet PROCEDURE = idDmc) ouvre ce contrat sur place, une fois, au premier chargement.
   */
  private aOuvrir: { idDmc: number; lot: number | null } | null = (() => {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const dmc = Number(q.get('dmc'));
    const lot = Number(q.get('lot'));
    return dmc > 0 ? { idDmc: dmc, lot: lot > 0 ? lot : null } : null;
  })();

  readonly date = dateFr;
  /** ⚠️ 30/10 (V151) — le rythme qui fait une remise commune à tous les lots (texte du serveur, `ContratVigueurService.SELON_CALENDRIER`). */
  readonly selonCalendrier = 'Selon le calendrier fixé ci-après';
  readonly dateHeure = dateHeureFr;
  readonly ariary = ariary;
  readonly aujourdhui = aujourdhui();
  readonly filtres = [
    { cle: 'TOUS', libelle: 'Tous' },
    { cle: 'ALERTES', libelle: 'À surveiller' },
    { cle: 'EN_VIGUEUR', libelle: 'En vigueur' },
    { cle: 'ECHU', libelle: 'Échus' },
  ] as const;

  readonly chargement = signal(true);
  readonly erreurListe = signal<string | null>(null);
  readonly contrats = signal<ContratVigueur[]>([]);
  readonly filtre = signal<'TOUS' | 'ALERTES' | 'EN_VIGUEUR' | 'ECHU'>('TOUS');
  readonly ouvert = signal<number | null>(null);

  readonly decision = signal<DecisionReconduction | null>(null);
  readonly reference = signal('');
  readonly dateDecision = signal(aujourdhui());
  readonly occupe = signal(false);
  readonly refus = signal<string | null>(null);
  readonly refusRelecture = signal<string | null>(null);

  /** La PRMP décide ; l'UGPM, la Commission et l'Administrateur lisent (le serveur reste la garde). */
  readonly prmp = computed(() => this.auth.role() === 'PRMP');
  readonly ugpm = computed(() => this.auth.role() === 'UGPM');
  readonly profilRemise = computed<ProfilRemise>(() => (this.prmp() ? 'PRMP' : this.ugpm() ? 'UGPM' : 'LECTURE'));

  // ⚠️ Lot MS-2 — les remises du contrat ouvert, et le formulaire de lancement.
  readonly remises = signal<Remise[]>([]);
  /** Recrée le bloc des bons de commande (relecture de la consommation). */
  readonly cleBons = signal(0);
  /** ⚠️ MS-4 — la PRMP préside la commission de réception du contrat ouvert. */
  readonly presideeParPrmp = signal(false);
  readonly chargementRemises = signal(false);
  readonly erreurRemises = signal<string | null>(null);
  readonly refusLancement = signal<string | null>(null);
  private readonly lancement = signal<Record<string, string>>({});
  /** Une seule remise ouverte à la fois par contrat (409 `REMISE_EN_COURS`). */
  readonly remiseOuverte = computed(() => this.remises().some((r) => r.etat === 'EN_COURS' || r.etat === 'EVALUEE'));
  /** Les contrats à surveiller d'abord, puis par échéance. */
  readonly visibles = computed(() => {
    const f = this.filtre();
    return this.contrats()
      .filter((c) => f === 'TOUS' || (f === 'ALERTES' ? c.alertes.length > 0 : c.etat === f))
      .sort((a, b) => Number(b.alertes.length > 0) - Number(a.alertes.length > 0) || a.dateFin.localeCompare(b.dateFin));
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreurListe.set(null);
    this.service.lister().subscribe({
      next: (l) => {
        this.contrats.set(l);
        this.chargement.set(false);
        const cible = this.aOuvrir;
        this.aOuvrir = null;
        const c = cible && l.find((x) => x.idDmc === cible.idDmc && (cible.lot == null || x.lot === cible.lot));
        if (c && this.ouvert() !== c.id) this.basculer(c.id);
        // ⚠️ 31/10 (deux volets) — sans contrat demandé, le premier de la liste est choisi d'office.
        else if (!c && this.ouvert() == null && this.visibles().length) this.basculer(this.visibles()[0].id);
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        this.erreurListe.set(e.status === 403 ? 'Les contrats en vigueur ne sont pas ouverts à votre profil.' : 'Les contrats en vigueur n’ont pas pu être chargés.');
      },
    });
  }

  compte(cle: string): number {
    return this.contrats().filter((c) => cle === 'TOUS' || (cle === 'ALERTES' ? c.alertes.length > 0 : c.etat === cle)).length;
  }

  /** Le contrat choisi dans le volet de gauche, s'il est dans le filtre courant. */
  readonly selection = computed(() => this.visibles().find((c) => c.id === this.ouvert()) ?? null);

  /** ⚠️ 31/10 (deux volets) — choisir un contrat l'affiche à droite ; le choisir à nouveau ne le replie pas. */
  choisir(id: number): void {
    if (this.ouvert() !== id) this.basculer(id);
  }

  basculer(id: number): void {
    this.ouvert.set(this.ouvert() === id ? null : id);
    this.remises.set([]);
    this.presideeParPrmp.set(false);
    this.lancement.set({});
    this.refusLancement.set(null);
    if (this.ouvert() === id && this.contrats().find((c) => c.id === id)?.typeMarche !== 'A_COMMANDE') this.chargerRemises(id);
    this.decision.set(null);
    this.reference.set('');
    this.dateDecision.set(aujourdhui());
    this.refus.set(null);
  }

  chargerRemises(id: number): void {
    this.chargementRemises.set(true);
    this.erreurRemises.set(null);
    this.remisesService.duContrat(id).subscribe({
      next: (l) => {
        this.chargementRemises.set(false);
        this.remises.set([...l].sort((a, b) => b.numero - a.numero));
      },
      error: (e: ApiError) => {
        this.chargementRemises.set(false);
        this.erreurRemises.set(refusRemise(e));
      },
    });
  }

  remiseAJour(r: Remise): void {
    this.remises.update((l) => l.map((x) => (x.id === r.id ? r : x)));
    this.cleBons.update((k) => k + 1);
  }

  lr(cle: string): string {
    return this.lancement()[cle] ?? '';
  }

  poserLr(cle: string, valeur: string): void {
    this.lancement.update((l) => ({ ...l, [cle]: valeur }));
  }

  lancer(c: ContratVigueur): void {
    const v = (k: string): string | null => this.lr(k).trim() || null;
    const echeance = this.lr('echeance');
    this.occupe.set(true);
    this.refusLancement.set(null);
    this.remisesService.lancer(c.id, {
      objet: this.lr('objet').trim(),
      specifications: this.lr('specifications').trim(),
      criteres: v('criteres'),
      lieuLivraison: v('lieuLivraison'),
      delaiExecution: this.lr('delaiExecution').trim(),
      validiteJours: this.lr('validiteJours') ? Number(this.lr('validiteJours')) : null,
      visite: v('visite'),
      // `datetime-local` rend AAAA-MM-JJTHH:MM ; le serveur attend des secondes.
      echeance: echeance ? (echeance.length === 16 ? echeance + ':00' : echeance) : null,
    }).subscribe({
      next: (r) => {
        this.occupe.set(false);
        this.lancement.set({});
        this.remises.update((l) => [r, ...l]);
        this.toast.success((r.lots?.length ?? 0) > 1
          ? `La remise commune est lancée pour ${r.lots!.length} lots : les titulaires de chaque lot reçoivent leur lettre d’invitation.`
          : `La remise n° ${r.numero} est lancée : les titulaires reçoivent leur lettre d’invitation.`);
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.refusLancement.set(refusRemise(e));
      },
    });
  }

  type(c: ContratVigueur): string {
    return c.typeMarche ? TYPES[c.typeMarche] : 'Contrat';
  }

  alerte(a: AlerteContrat): { texte: string; classe: string } {
    return ALERTES[a] ?? { texte: a, classe: 'badge-neutral' };
  }

  /** Une reconduction encore possible : contrat en vigueur, reconductible, reconductions non épuisées (le serveur garde le reste). */
  reconductionOuverte(c: ContratVigueur): boolean {
    return c.etat === 'EN_VIGUEUR' && c.reconductible && (c.reconductionsMax == null || c.reconductions < c.reconductionsMax)
      && (c.alertes.includes('RECONDUCTION_A_DECIDER') || !c.decisions.some((d) => d.finAvant === c.dateFin));
  }

  relire(c: ContratVigueur): void {
    this.occupe.set(true);
    this.refusRelecture.set(null);
    this.service.relecture(c.id).subscribe({
      next: (maj) => {
        this.occupe.set(false);
        this.contrats.update((l) => l.map((x) => (x.id === maj.id ? maj : x)));
        this.cleBons.update((n) => n + 1);   // la durée, les quantités ou le maximum ont pu changer : la consommation se relit
        this.toast.success(`Les termes du contrat sont relus depuis la fiche : fin le ${dateFr(maj.dateFin)}.`);
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.refusRelecture.set(refusRelecture(e));
      },
    });
  }

  decider(c: ContratVigueur): void {
    const decision = this.decision();
    if (!decision) return;
    this.occupe.set(true);
    this.refus.set(null);
    this.service.reconduction(c.id, { decision, reference: this.reference().trim(), dateDecision: this.dateDecision() }).subscribe({
      next: (maj) => {
        this.occupe.set(false);
        this.contrats.update((l) => l.map((x) => (x.id === maj.id ? maj : x)));
        this.decision.set(null);
        this.reference.set('');
        this.toast.success(decision === 'RECONDUIRE' ? `Le contrat est reconduit : il prend fin le ${dateFr(maj.dateFin)}.` : 'La décision de ne pas reconduire est enregistrée.');
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.refus.set(refusReconduction(e));
      },
    });
  }
}
