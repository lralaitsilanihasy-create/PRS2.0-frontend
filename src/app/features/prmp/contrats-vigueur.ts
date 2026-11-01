import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { AlerteContrat, CommissionReception, Consommation, ContratVigueur, DecisionReconduction, Remise, TypeContratVigueur } from '../../models';
import { ContratsVigueurService, RemisesService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
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

type OngletContrat = 'bons' | 'remises' | 'titulaires' | 'reception' | 'termes' | 'reconduction';

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
 *
 * ⚠️ 01/11 (pilote, maquette « Contrats en vigueur », variante A) — deux volets ; le contrat en tableau de bord : en-tête et geste
 * principal (émettre un bon, en fenêtre), quatre indicateurs (échéance, commandé, titulaires, réception), puis des onglets (bons,
 * remises, titulaires, réception, termes, reconduction), chacun avec son geste. Le contrat se nomme par la référence de son dossier de
 * marché (demande « contrats-vigueur-liste », B1), jamais « fiche N » ; une case sans valeur ne s'affiche plus.
 */
@Component({
  selector: 'app-contrats-vigueur',
  imports: [EtatErreur, ModaleDirective, DeuxVolets, RemiseDetail, BonsCommandeContrat, CommissionReceptionPanneau],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cv">
      <header class="page-header">
        <h1 class="page-title">Contrats en vigueur</h1>
      </header>
      <p class="page-role">Vos contrats-cadres et marchés à commandes notifiés : leurs titulaires, ce qui a été commandé, la réception des bons et les échéances.</p>
      <div class="cv__seg" role="group" aria-label="Contrats affichés">
        @for (f of filtres; track f.cle) {
          <button type="button" [attr.aria-pressed]="filtre() === f.cle" (click)="filtre.set(f.cle)">{{ f.libelle }} <span class="cv__n">{{ compte(f.cle) }}</span></button>
        }
      </div>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des contrats…</p>
      } @else if (erreurListe(); as m) {
        <app-etat-erreur [message]="m" aide="La liste n’a pas pu être lue." (reessayer)="charger()" />
      } @else if (!visibles().length) {
        <p class="text-muted">{{ contrats().length ? 'Aucun contrat dans ce filtre.' : 'Aucun contrat en vigueur : un contrat se crée à la notification d’un lot de contrat-cadre ou de marché à commandes.' }}</p>
      } @else {
        <!-- ⚠️ 01/11 (pilote, maquette « Contrats en vigueur », variante A) — deux volets : la liste à gauche (échéance en jauge) ; à droite,
             le contrat en TABLEAU DE BORD : en-tête et geste principal, quatre indicateurs, puis des onglets (un seul bloc visible). -->
        <app-deux-volets [ouvert]="!!selection()" [cle]="selection()?.id ?? null" libelleListe="Contrats" libelleDetail="Détail du contrat"
                         invite="Choisissez un contrat : son détail s’affiche ici.">
          <ul liste class="cv__liste">
            @for (c of visibles(); track c.id) {
              <li class="cv__item" [class.cv__item--echu]="c.etat === 'ECHU'">
                <button type="button" class="cv__ligne" [attr.aria-pressed]="ouvert() === c.id" aria-controls="cv-detail" (click)="choisir(c.id)">
                  <span class="cv__ligne-tete">
                    <span [class]="'cv__fam ' + famille(c)">{{ type(c) }}</span>
                    <span class="cv__badges">
                      @for (a of c.alertes; track a) { <span class="badge" [class]="alerte(a).classe">{{ alerte(a).texte }}</span> }
                      @if (!c.alertes.length) { <span class="badge" [class]="c.etat === 'ECHU' ? 'badge-neutral' : 'badge-success'">{{ c.etat === 'ECHU' ? 'Échu' : 'En vigueur' }}</span> }
                    </span>
                  </span>
                  <span class="cv__objet">{{ c.objet || 'Objet non renseigné' }}</span>
                  <span class="cv__sous">{{ referenceContrat(c) }}</span>
                  <span class="cv__echeance">
                    <span>fin {{ date(c.dateFin) }}</span>
                    <span class="cv__jauge" aria-hidden="true"><i [style.width.%]="ecoule(c)"></i></span>
                    <span>{{ ecoule(c) }} %</span>
                  </span>
                </button>
              </li>
            }
          </ul>
          <div detail>
            @if (selection(); as c) {
              <article class="cv__det" id="cv-detail" [attr.aria-label]="'Contrat — ' + (c.objet || referenceContrat(c))">
                <div class="cv__tete">
                  <div class="cv__tete-g">
                    <span class="cv__ligne-tete">
                      <span [class]="'cv__fam ' + famille(c)">{{ type(c) }}</span>
                      @for (a of c.alertes; track a) { <span class="badge" [class]="alerte(a).classe">{{ alerte(a).texte }}</span> }
                      @if (!c.alertes.length) { <span class="badge" [class]="c.etat === 'ECHU' ? 'badge-neutral' : 'badge-success'">{{ c.etat === 'ECHU' ? 'Échu' : 'En vigueur' }}</span> }
                    </span>
                    <h2 class="cv__titre">{{ c.objet || 'Objet non renseigné' }}</h2>
                    <span class="cv__sous"><strong class="cv__ref">{{ referenceContrat(c) }}</strong>@if (c.acheteur?.trim()) { · {{ c.acheteur!.trim() }} }</span>
                  </div>
                  @if (bons()?.peutEmettre()) {
                    <button type="button" class="btn btn-primary btn-sm cv__principal" (click)="bons()?.ouvrirEmission()">Émettre un bon de commande</button>
                  }
                </div>

                <dl class="cv__ind">
                  <div>
                    <dt>Échéance</dt><dd class="cv__ind-v">{{ date(c.dateFin) }}</dd>
                    <dd><span class="cv__jauge" aria-hidden="true"><i [style.width.%]="ecoule(c)"></i></span></dd>
                    <dd class="cv__ind-d">{{ ecoule(c) }} % écoulé{{ resteJours(c) }}</dd>
                  </div>
                  <div>
                    <dt>Commandé</dt>
                    @if (commande(c); as m) {
                      <dd class="cv__ind-v">{{ ariary(m) }}</dd>
                      @if (c.montantEstime) {
                        <dd><span class="cv__jauge" aria-hidden="true"><i [style.width.%]="partEstimeNombre(c)"></i></span></dd>
                      }
                      <dd class="cv__ind-d">HT{{ c.montantEstime ? ' · ' + partEstimeNombre(c) + ' % de ' + ariary(c.montantEstime) + ' estimés' : '' }}</dd>
                    } @else {
                      <dd class="cv__ind-v">—</dd><dd class="cv__ind-d">aucun bon émis</dd>
                    }
                  </div>
                  <div>
                    <dt>{{ c.titulaires.length > 1 ? 'Titulaires' : 'Titulaire' }}</dt>
                    <dd class="cv__ind-v">{{ c.titulaires.length > 1 ? c.titulaires.length + ' (liste fermée)' : (c.titulaires[0]?.candidat || '—') }}</dd>
                    <dd class="cv__ind-d">{{ c.titulaires.length > 1 ? 'rang 1 : ' + (c.titulaires[0].candidat || '—') : (c.titulaires[0] ? 'offre n° ' + (c.titulaires[0].numero ?? '—') + (c.titulaires[0].delai ? ' · délai ' + c.titulaires[0].delai : '') : '') }}</dd>
                  </div>
                  <div [class.cv__ind--alerte]="sansAccuse() > 0">
                    <dt>Réception</dt>
                    <dd class="cv__ind-v">{{ sansAccuse() ? sansAccuse() + (sansAccuse() > 1 ? ' bons en attente' : ' bon en attente') : 'à jour' }}</dd>
                    <dd class="cv__ind-d">{{ sansAccuse() ? 'accusé du titulaire attendu' : resumeReception() }}</dd>
                  </div>
                </dl>

                <div class="cv__onglets" role="tablist" aria-label="Blocs du contrat">
                  @for (o of onglets(c); track o.cle) {
                    <button type="button" role="tab" [id]="'cv-tab-' + o.cle" [attr.aria-selected]="onglet() === o.cle" [attr.aria-controls]="'cv-pan-' + o.cle"
                      [attr.tabindex]="onglet() === o.cle ? 0 : -1" (click)="onglet.set(o.cle)" (keydown)="naviguerOnglets($event, c)">
                      {{ o.libelle }}@if (o.n != null) { <span class="cv__compte" [class.cv__compte--att]="o.attention">{{ o.n }}</span> }
                    </button>
                  }
                </div>

                <!-- Les panneaux restent montés (masqués) : les bons nourrissent les indicateurs et portent la fenêtre d'émission. -->
                <div class="cv__panneau" role="tabpanel" id="cv-pan-bons" aria-labelledby="cv-tab-bons" [hidden]="onglet() !== 'bons'">
                  @for (k of [cleBons() + '-' + c.id]; track k) {
                    <app-bons-commande-contrat [contrat]="c" [prmp]="prmp()" [ugpm]="ugpm()" [presideeParPrmp]="presideeParPrmp()" (lue)="conso.set($event)" />
                  }
                  <p class="cv__cadre">{{ c.typeMarche === 'A_COMMANDE' ? 'Marché à commandes : loi n° 2016-055, art. 30.' : 'Bons des marchés subséquents attribués : décret n° 2019-1064, art. 33.' }}</p>
                </div>

                <!-- ⚠️ Lot MS-2 (V125, 16/10) — les remises en concurrence du contrat-cadre et leurs marchés subséquents. -->
                @if (c.typeMarche !== 'A_COMMANDE') {
                  <div class="cv__panneau" role="tabpanel" id="cv-pan-remises" aria-labelledby="cv-tab-remises" [hidden]="onglet() !== 'remises'">
                    @if ((prmp() || ugpm()) && c.etat === 'EN_VIGUEUR' && !remiseOuverte() && !chargementRemises()) {
                      <div class="cv__barre">
                        <button type="button" class="btn btn-sm" [class.btn-primary]="c.alertes.includes('REMISE_A_LANCER')" [class.btn-outline]="!c.alertes.includes('REMISE_A_LANCER')" (click)="ouvrirFenetre('remise')">Lancer une remise en concurrence</button>
                      </div>
                    }
                    @if (c.prochaineRemise; as p) {
                      <p class="text-sm cv__note">Prochaine remise au calendrier : {{ date(p) }} @if (p < aujourdhui) { <span class="badge badge-danger">En retard</span> }</p>
                    }
                    @if (chargementRemises()) {
                      <p class="text-sm text-muted" role="status">Chargement des remises…</p>
                    } @else {
                      @for (r of remises(); track r.id) {
                        <app-remise-detail [remise]="r" [profil]="profilRemise()" (maj)="remiseAJour($event)" />
                      } @empty { <p class="text-sm text-muted">Aucune remise en concurrence pour ce contrat.</p> }
                      @if (erreurRemises(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }
                    }
                    <p class="cv__cadre">Marchés subséquents : décret n° 2019-1064, art. 20 à 33.</p>
                  </div>
                }

                <div class="cv__panneau" role="tabpanel" id="cv-pan-titulaires" aria-labelledby="cv-tab-titulaires" [hidden]="onglet() !== 'titulaires'">
                  <div class="cnm-table-wrap">
                    <table class="cnm-table cv__table" [attr.aria-label]="'Titulaires — ' + (c.objet || referenceContrat(c))">
                      <thead><tr><th scope="col">Rang</th><th scope="col">Titulaire</th><th scope="col">Offre</th><th scope="col">NIF</th><th scope="col" class="cv__num">Offre indicative HT</th><th scope="col">Délai</th></tr></thead>
                      <tbody>
                        @for (t of c.titulaires; track t.idOffre) {
                          <tr><td>{{ t.rang ?? '—' }}</td><td>{{ t.candidat || '—' }}</td><td class="cv__nowrap">n° {{ t.numero ?? '—' }}</td><td>{{ t.nif || '—' }}</td><td class="cv__num">{{ ariary(t.montant) }}</td><td>{{ t.delai ?? '—' }}</td></tr>
                        } @empty { <tr><td colspan="6" class="text-muted">Aucun titulaire.</td></tr> }
                      </tbody>
                    </table>
                  </div>
                  <p class="cv__cadre">Liste fermée : décret n° 2019-1064, art. 18.</p>
                </div>

                <!-- ⚠️ Lot MS-4 (V127, 16/10) — la commission de réception, désignée par décision de la PRMP (Q1 ; loi art. 13). -->
                <div class="cv__panneau" role="tabpanel" id="cv-pan-reception" aria-labelledby="cv-tab-reception" [hidden]="onglet() !== 'reception'">
                  <!-- Recréée à chaque contrat : elle ne lit sa commission qu'à sa création (sinon celle du contrat précédent restait affichée). -->
                  @for (k of [c.id]; track k) {
                    <app-commission-reception [idContrat]="c.id" [peutDesigner]="prmp() || ugpm()" (lue)="commissionLue($event)" />
                  }
                  <p class="cv__cadre">Commission de réception : loi n° 2016-055, art. 13.</p>
                </div>

                <div class="cv__panneau" role="tabpanel" id="cv-pan-termes" aria-labelledby="cv-tab-termes" [hidden]="onglet() !== 'termes'">
                  <dl class="cv__grille">
                    <div><dt>Prise d’effet</dt><dd>{{ date(c.dateEffet) }}, à la notification</dd></div>
                    @if (c.periodeMois) { <div><dt>Période</dt><dd>{{ c.periodeMois }} mois · fin le {{ date(c.dateFin) }}</dd></div> }
                    @else { <div><dt>Fin</dt><dd>{{ date(c.dateFin) }}</dd></div> }
                    @if (c.dureeMaxMois) { <div><dt>Durée maximale</dt><dd>{{ c.dureeMaxMois }} mois{{ c.finMaximale ? ' · au plus tard le ' + date(c.finMaximale) : '' }}</dd></div> }
                    <div><dt>Reconduction</dt><dd>{{ c.reconductible ? c.reconductions + ' sur ' + (c.reconductionsMax ?? '—') + ' décidée(s)' + (c.preavisMois ? ' · préavis ' + c.preavisMois + ' mois' : '') : 'non reconductible' }}</dd></div>
                    @if (c.montantEstime != null) { <div><dt>Montant estimé</dt><dd>{{ ariary(c.montantEstime) }} HT</dd></div> }
                    @if (c.montantMinimum != null) { <div><dt>Minimum</dt><dd>{{ ariary(c.montantMinimum) }}</dd></div> }
                    @if (c.montantMaximum != null) { <div><dt>Maximum</dt><dd>{{ ariary(c.montantMaximum) }}</dd></div> }
                    @if (c.formeSubsequents) { <div><dt>Forme des marchés subséquents</dt><dd>{{ c.formeSubsequents }}</dd></div> }
                    @if (c.rythme) { <div><dt>Rythme</dt><dd>{{ c.rythme }}</dd></div> }
                    @if (c.calendrier) { <div class="cv__large"><dt>Calendrier</dt><dd>{{ c.calendrier }}</dd></div> }
                    @if (c.periodiciteMois) {
                      <div><dt>Remises au calendrier</dt><dd>tous les {{ c.periodiciteMois }} mois{{ c.premiereRemise ? ', à partir du ' + date(c.premiereRemise) : '' }}</dd></div>
                    }
                  </dl>
                  <!-- ⚠️ 29/10 (« marche-a-commandes-champs », §B3) — les termes sont figés à la notification : après une révision de la fiche, la PRMP les relit. -->
                  @if (prmp() && c.etat === 'EN_VIGUEUR') {
                    <div class="cv__relecture">
                      <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="relire(c)">Relire depuis la fiche</button>
                      <span class="text-sm text-muted">Reprend la période, les montants et la reconduction de la dernière version validée de la fiche ; les bons, remises et réceptions restent intacts.</span>
                    </div>
                    @if (refusRelecture(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }
                  }
                  <p class="cv__cadre">Figés depuis la fiche validée.</p>
                </div>

                @if (c.reconductible) {
                  <div class="cv__panneau" role="tabpanel" id="cv-pan-reconduction" aria-labelledby="cv-tab-reconduction" [hidden]="onglet() !== 'reconduction'">
                    <dl class="cv__grille">
                      <div><dt>Reconductions décidées</dt><dd>{{ c.reconductions }} sur {{ c.reconductionsMax ?? '—' }}</dd></div>
                      @if (c.preavisMois) { <div><dt>Préavis</dt><dd>{{ c.preavisMois }} mois</dd></div> }
                      @if (c.dateLimiteDecision) { <div><dt>Décision attendue avant le</dt><dd>{{ date(c.dateLimiteDecision) }}</dd></div> }
                    </dl>
                    @if (prmp() && reconductionOuverte(c)) {
                      <div class="cv__barre">
                        <button type="button" class="btn btn-sm" [class.btn-primary]="c.alertes.includes('RECONDUCTION_A_DECIDER')" [class.btn-outline]="!c.alertes.includes('RECONDUCTION_A_DECIDER')" (click)="ouvrirFenetre('reconduction')">Décider la reconduction</button>
                      </div>
                    }
                    @if (c.decisions.length) {
                      <ul class="cv__decisions">
                        @for (d of c.decisions; track d.id) {
                          <li class="text-sm">
                            <strong>{{ d.decision === 'RECONDUIRE' ? 'Reconduit' : 'Non reconduit' }}</strong> — décision {{ d.reference }} du {{ date(d.dateDecision) }}{{ d.nouvelleFin ? ' : fin reportée au ' + date(d.nouvelleFin) : '' }}
                            @if (d.horsPreavis) { <span class="badge badge-warning">Hors préavis</span> }
                            <span class="text-muted"> · enregistrée le {{ dateHeure(d.le) }}{{ d.par ? ' par ' + d.par : '' }}</span>
                          </li>
                        }
                      </ul>
                    } @else { <p class="text-sm text-muted">Aucune décision de reconduction.</p> }
                    <p class="cv__cadre">Reconduction : AE-CC, art. 7.3.</p>
                  </div>
                }
              </article>
            }
          </div>
        </app-deux-volets>
        <!-- Les fenêtres de geste : lancer une remise, décider la reconduction. -->
        @if (selection(); as c) {
          @if (fenetre() === 'remise') {
            <div class="modal-backdrop">
              <div class="modal modal-lg" role="dialog" aria-modal="true" aria-label="Lancer une remise en concurrence" appModale (appModaleFermer)="fenetre.set(null)">
                <div class="modal-header">
                  <h2 class="modal-title">Lancer une remise en concurrence</h2>
                  <button type="button" class="btn-close" aria-label="Fermer" (click)="fenetre.set(null)">✕</button>
                </div>
                <div class="modal-body cv__form">
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
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-outline" (click)="fenetre.set(null)">Annuler</button>
                  <button type="button" class="btn btn-primary" [disabled]="!lr('objet').trim() || !lr('specifications').trim() || !lr('delaiExecution').trim() || occupe()" (click)="lancer(c)">Lancer et envoyer les lettres d’invitation</button>
                </div>
              </div>
            </div>
          }

          @if (fenetre() === 'reconduction') {
            <div class="modal-backdrop">
              <div class="modal" role="dialog" aria-modal="true" aria-label="Décider la reconduction" appModale (appModaleFermer)="fenetre.set(null)">
                <div class="modal-header">
                  <h2 class="modal-title">Décider la reconduction de la période en cours</h2>
                  <button type="button" class="btn-close" aria-label="Fermer" (click)="fenetre.set(null)">✕</button>
                </div>
                <div class="modal-body cv__form">
                  <fieldset class="cv__radios">
                    <legend class="form-label">Décision</legend>
                    <label><input type="radio" [name]="'cv-dec-' + c.id" [checked]="decision() === 'RECONDUIRE'" (change)="decision.set('RECONDUIRE')" /> Reconduire</label>
                    <label><input type="radio" [name]="'cv-dec-' + c.id" [checked]="decision() === 'NE_PAS_RECONDUIRE'" (change)="decision.set('NE_PAS_RECONDUIRE')" /> Ne pas reconduire</label>
                  </fieldset>
                  <div class="cv__champs">
                    <label class="form-group"><span class="form-label">Référence de la décision écrite</span><input class="form-control" type="text" [value]="reference()" (input)="reference.set($any($event.target).value)" /></label>
                    <label class="form-group"><span class="form-label">Date de la décision</span><input class="form-control" type="date" [min]="c.dateEffet" [max]="aujourdhui" [value]="dateDecision()" (input)="dateDecision.set($any($event.target).value)" /></label>
                  </div>
                  @if (c.dateLimiteDecision && aujourdhui > c.dateLimiteDecision) {
                    <p class="text-sm cv__alerte">La limite du préavis ({{ date(c.dateLimiteDecision) }}) est passée : la décision sera acceptée, mais marquée hors préavis.</p>
                  }
                  @if (refus(); as r) { <div class="alert alert-danger" role="alert">{{ r }}</div> }
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-outline" (click)="fenetre.set(null)">Annuler</button>
                  <button type="button" class="btn btn-primary" [disabled]="!decision() || !reference().trim() || !dateDecision() || occupe()" (click)="decider(c)">Enregistrer la décision</button>
                </div>
              </div>
            </div>
          }
        }
      }
    </section>
  `,
  styles: `
    .cv { display: flex; flex-direction: column; gap: 0.75rem; }
    .cv .page-header, .cv .page-role { margin: 0; }
    .cv__seg { display: inline-flex; align-self: flex-start; flex-wrap: wrap; border: 1px solid var(--bordure); border-radius: 6px; overflow: hidden; background: var(--carte-fond); }
    .cv__seg button { border: 0; border-left: 1px solid var(--bordure); background: var(--carte-fond); padding: 0.3rem 0.8rem; font-size: 0.8125rem; cursor: pointer; color: var(--texte); }
    .cv__seg button:first-child { border-left: 0; }
    .cv__seg button[aria-pressed='true'] { background: var(--section-fond); color: var(--texte-menu); font-weight: 500; }
    .cv__seg button:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: -2px; }
    .cv__n { margin-left: 0.25rem; font-size: 0.72rem; opacity: 0.85; }

    /* Volet de gauche : des lignes compactes ; la ligne choisie porte l'onglet actif et un filet. */
    .cv__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .cv__item { border-bottom: 1px solid var(--bordure); }
    .cv__item--echu { opacity: 0.85; }
    .cv__ligne { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: flex; flex-direction: column; gap: 0.25rem; padding: 0.6rem 0.8rem; }
    .cv__ligne:hover { background: var(--ligne-survol); }
    .cv__ligne[aria-pressed='true'] { background: var(--onglet-actif-fond); box-shadow: inset 3px 0 0 var(--section-fond); }
    .cv__ligne:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: -2px; }
    .cv__ligne-tete { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; justify-content: space-between; }
    .cv__tete .cv__ligne-tete { justify-content: flex-start; }
    .cv__badges { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .cv__objet { font-weight: 500; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .cv__sous { font-size: 0.75rem; color: var(--texte-secondaire); }
    .cv__echeance { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: var(--texte-secondaire); white-space: nowrap; }
    .cv__echeance .cv__jauge { flex: 1; }
    .cv__fam { display: inline-flex; padding: 1px 7px; border-radius: 4px; font-size: 0.7rem; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; background: var(--fam-fond); color: var(--texte); box-shadow: inset 3px 0 0 var(--fam); }
    .cv__jauge { display: block; height: 6px; border-radius: 3px; background: var(--neutre-fond); overflow: hidden; }
    .cv__jauge i { display: block; height: 100%; background: var(--menu-fond); }

    /* Volet de droite : le contrat en tableau de bord. */
    .cv__det { display: flex; flex-direction: column; min-width: 0; }
    .cv__tete { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 0.6rem 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--bordure); }
    .cv__tete-g { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; flex: 1 1 22rem; }
    .cv__titre { margin: 0.15rem 0 0; font-size: 1.05rem; font-weight: 500; line-height: 1.35; }
    .cv__ref { color: var(--texte); font-weight: 500; }
    .cv__ind { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; border-bottom: 1px solid var(--bordure); }
    .cv__ind > div { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.65rem 0.9rem; border-left: 1px solid var(--bordure); min-width: 0; }
    .cv__ind > div:first-child { border-left: 0; padding-left: 0; }
    .cv__ind dt { font-size: 0.75rem; color: var(--texte-secondaire); }
    .cv__ind dd { margin: 0; }
    .cv__ind-v { font-size: 1rem; font-weight: 500; overflow-wrap: anywhere; }
    .cv__ind-d { font-size: 0.75rem; color: var(--texte-secondaire); }
    .cv__ind--alerte .cv__ind-v { color: var(--examen-texte); }
    .cv__onglets { display: flex; gap: 2px; border-bottom: 1px solid var(--bordure); overflow-x: auto; }
    .cv__onglets button { border: 0; background: none; padding: 0.55rem 0.8rem; font-size: 0.85rem; cursor: pointer; border-bottom: 3px solid transparent; white-space: nowrap; color: var(--texte-secondaire); }
    .cv__onglets button[aria-selected='true'] { color: var(--texte); font-weight: 500; border-bottom-color: var(--section-fond); }
    .cv__onglets button:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: -2px; }
    .cv__compte { margin-left: 0.35rem; padding: 0 0.4rem; border-radius: 8px; font-size: 0.72rem; background: var(--neutre-fond); color: var(--neutre-texte); }
    .cv__compte--att { background: var(--examen-fond); color: var(--examen-texte); }
    .cv__panneau { display: flex; flex-direction: column; gap: 0.6rem; padding-top: 0.8rem; }
    .cv__panneau[hidden] { display: none; }
    .cv__barre { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .cv__note { margin: 0; }
    .cv__cadre { margin: 0; font-size: 0.75rem; color: var(--texte-secondaire); }
    .cv__table { font-size: 0.84rem; }
    .cv__num { text-align: right; white-space: nowrap; }
    .cv__nowrap { white-space: nowrap; }
    .cv__grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.5rem 1.2rem; margin: 0; }
    .cv__grille dt { font-size: 0.75rem; color: var(--texte-secondaire); }
    .cv__grille dd { margin: 0; font-size: 0.875rem; }
    .cv__large { grid-column: 1 / -1; }
    .cv__relecture { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .cv__decisions { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.25rem; }

    .cv__form { display: flex; flex-direction: column; gap: 0.6rem; }
    .cv__radios { display: flex; gap: 1.2rem; font-size: var(--text-sm); border: 0; margin: 0; padding: 0; }
    .cv__radios legend { float: left; margin-right: 0.6rem; }
    .cv__champs { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    .cv__champs .form-group { flex: 1 1 12rem; }
    .cv__alerte { margin: 0; color: var(--examen-texte); }
    @media (max-width: 900px) {
      .cv__ind { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .cv__ind > div:nth-child(3) { border-left: 0; padding-left: 0; }
      .cv__ind > div:nth-child(n + 3) { border-top: 1px solid var(--bordure); }
    }
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
  /** ⚠️ 01/11 (variante B) — ce que les sections ont lu, pour leur ligne de titre. */
  readonly conso = signal<Consommation | null>(null);
  readonly commission = signal<CommissionReception | null | undefined>(undefined);
  /** ⚠️ 01/11 (variante A) — l'onglet affiché du contrat ouvert. */
  readonly onglet = signal<OngletContrat>('bons');
  /** Les bons dont le titulaire n'a pas accusé réception (lus par le bloc des bons, à défaut servis par la liste). */
  readonly sansAccuse = computed(() => {
    const k = this.conso();
    if (k) return k.bons.filter((b) => b.etat !== 'ANNULE' && !b.accuseLe).length;
    return this.selection()?.bonsSansAccuse ?? 0;
  });
  /** La fenêtre de geste ouverte (remise, reconduction). */
  readonly fenetre = signal<'remise' | 'reconduction' | null>(null);
  /** Le bloc des bons du contrat ouvert : il porte l'émission (fenêtre). */
  readonly bons = viewChild(BonsCommandeContrat);
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
    this.conso.set(null);
    this.commission.set(undefined);
    this.fenetre.set(null);
    const c = this.contrats().find((x) => x.id === id);
    // L'onglet qui porte l'alerte d'abord : une remise à lancer, une reconduction à décider ; sinon les bons.
    this.onglet.set(c?.alertes.includes('REMISE_A_LANCER') ? 'remises' : c?.alertes.includes('RECONDUCTION_A_DECIDER') ? 'reconduction' : 'bons');
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
        this.fenetre.set(null);
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

  ouvrirFenetre(f: 'remise' | 'reconduction'): void {
    this.refusLancement.set(null);
    this.refus.set(null);
    this.fenetre.set(f);
  }

  commissionLue(k: CommissionReception | null): void {
    this.commission.set(k);
    this.presideeParPrmp.set(!!k && k.membres.length > 0 && k.presideeParPrmp);
  }

  /** La référence du dossier de marché (B1), à défaut le lot — jamais l'identifiant interne de la fiche. */
  referenceContrat(c: ContratVigueur): string {
    return c.refeDossierMarche ? `${c.refeDossierMarche} · lot ${c.lot}` : `Lot ${c.lot}`;
  }

  /** Ce qui a été commandé, HT : lu par le bloc des bons, à défaut servi par la liste (B2). */
  commande(c: ContratVigueur): number | null {
    const k = this.conso();
    const m = k && k.idContrat === c.id ? k.cumulHt : c.commandeHt;
    return m ? m : null;
  }

  /** La part de l'estimé déjà commandée, de 0 à 100. */
  partEstimeNombre(c: ContratVigueur): number {
    const m = this.commande(c);
    return m && c.montantEstime ? Math.min(100, Math.round((m / c.montantEstime) * 100)) : 0;
  }

  famille(c: ContratVigueur): string {
    return c.typeMarche === 'A_COMMANDE' ? 'fam-marche' : 'fam-mec';
  }

  /** Les onglets du contrat : les remises pour un contrat-cadre, la reconduction pour un contrat reconductible. */
  onglets(c: ContratVigueur): { cle: OngletContrat; libelle: string; n?: number; attention?: boolean }[] {
    const k = this.conso();
    const nBons = k && k.idContrat === c.id ? k.bons.filter((b) => b.etat !== 'ANNULE').length : c.bonsEmis ?? undefined;
    return [
      { cle: 'bons', libelle: 'Bons de commande', n: nBons, attention: this.sansAccuse() > 0 },
      ...(c.typeMarche !== 'A_COMMANDE' ? [{ cle: 'remises' as const, libelle: 'Remises en concurrence', n: this.chargementRemises() ? undefined : this.remises().length, attention: c.alertes.includes('REMISE_A_LANCER') }] : []),
      { cle: 'titulaires', libelle: 'Titulaires', n: c.titulaires.length },
      { cle: 'reception', libelle: 'Réception' },
      { cle: 'termes', libelle: 'Termes du contrat' },
      ...(c.reconductible ? [{ cle: 'reconduction' as const, libelle: 'Reconduction', attention: c.alertes.includes('RECONDUCTION_A_DECIDER') }] : []),
    ];
  }

  /** Flèches gauche et droite, Début et Fin : d'un onglet à l'autre (motif ARIA des onglets). */
  naviguerOnglets(e: KeyboardEvent, c: ContratVigueur): void {
    const cles = this.onglets(c).map((o) => o.cle);
    const i = cles.indexOf(this.onglet());
    const j = e.key === 'ArrowRight' ? (i + 1) % cles.length : e.key === 'ArrowLeft' ? (i - 1 + cles.length) % cles.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? cles.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    this.onglet.set(cles[j]);
    const hote = (e.currentTarget as HTMLElement).parentElement;
    setTimeout(() => (hote?.querySelector(`#cv-tab-${cles[j]}`) as HTMLElement | null)?.focus());
  }

  /** La part de la durée du contrat déjà écoulée, de 0 à 100. */
  ecoule(c: ContratVigueur): number {
    const debut = Date.parse(c.dateEffet), fin = Date.parse(c.dateFin), ici = Date.parse(this.aujourdhui);
    if (!(fin > debut)) return 0;
    return Math.max(0, Math.min(100, Math.round(((ici - debut) / (fin - debut)) * 100)));
  }

  resteJours(c: ContratVigueur): string {
    const j = Math.round((Date.parse(c.dateFin) - Date.parse(this.aujourdhui)) / 86_400_000);
    return j > 0 ? ` · reste ${j} jour${j > 1 ? 's' : ''}` : '';
  }

  readonly resumeReception = computed(() => {
    const k = this.commission();
    if (k === undefined) return '';
    const n = k?.membres.length ?? 0;
    return n ? `commission désignée · ${n} membre${n > 1 ? 's' : ''}` : 'commission à désigner';
  });

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
        this.fenetre.set(null);
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
