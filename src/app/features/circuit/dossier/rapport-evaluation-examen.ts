import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { ouvrirBlobSur } from '../../../core/securite/fichiers-surs';
import { Cao, ControleResultat, CoteConformite, DemandeEvaluation, EntreeJournalEvaluation, EstimationEvaluation, Evaluation, FicheMarche, IndicateursPrix, OffreEvaluee, ReferentielFiche, SpecificationOffre, VerificationConformite } from '../../../models';
import { CaoService, ChampFicheMarcheService, EvaluationService, FicheMarcheService } from '../../../services';
import { constatLisible } from '../../../shared/circuit/controles-libelles';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { dateHeureFr } from '../../candidat/libelles-candidat';
import { LIBELLES_ORIGINE } from '../../cao/libelles-cao';
import { LIBELLES_ANORMALE, LIBELLES_GROUPE_CRITERE, LIBELLES_REGLE, ariary, ecartPourCent } from '../../evaluation/libelles-evaluation';
import { PARTIES_RAPPORT, PartieRapport, idPartieRapport } from './parties-rapport-evaluation';
import { LIBELLES_COTE, syntheseOffre } from './procedure-marche-docs';

/** Les vérifications de l'examen préliminaire que le point « Conformité des documents essentiels » vise, dans l'ordre du point. */
const DOCUMENTS_ESSENTIELS: readonly string[] = ['AE_DATE_SIGNE', 'AE_PRIX', 'VALIDITE_OFFRE', 'DELAI', 'GARANTIE', 'GARANTIE_VALIDITE', 'VISITE_LIEUX', 'PIECES', 'BORDEREAU', 'INTEGRITE'];
const LIBELLES_REJET: Readonly<Record<string, string>> = { IRRECEVABLE: 'irrecevable', NON_CONFORME: 'non conforme', INAPPROPRIEE: 'inappropriée', INACCEPTABLE: 'inacceptable' };
const LIBELLES_ETAPE: Readonly<Record<string, string>> = { CONFORMITE: 'examen préliminaire', EVALUATION: 'montant évalué', ANORMALES: 'offres anormales', QUALIFICATION: 'post-qualification', RAPPORT: 'rapport' };

/**
 * ⚠️ 05/11 (pilote, tableau validé, `docs/examen-rapport-evaluation-donnees-2026-11-05.md`) — le **rapport d'évaluation tel que l'examen
 * d'un dossier de marché le lit** : huit parties dans l'ordre de travail de la commission, chacune nommant les points de la grille qu'elle
 * sert (`PARTIES_RAPPORT`), chaque partie ayant son ancre (la grille y mène). Une lecture en données de l'évaluation enregistrée — jamais
 * une ressaisie — qui montre ce que la commission a décidé, qui, quand, sur quelle règle du DAO ; les contrôles automatiques du serveur
 * s'affichent sous le point qu'ils éclairent. Ce que le serveur ne sert pas encore (demande `rapport-evaluation-examen`, B1-B4) est dit
 * « en attente du serveur », jamais deviné. La fenêtre de la page du dossier (`EvaluationMarcheDoc`) reste la lecture de la PRMP et de la CAO.
 */
@Component({
  selector: 'app-rapport-evaluation-examen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    @if (chargement()) {
      <p class="pmd__aide" role="status">Chargement du rapport d'évaluation…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Le rapport d'évaluation n'a pas pu être lu." (reessayer)="charger()" />
    } @else if (lotEval(); as l) {
      <section class="pmd pre" aria-label="Rapport d'évaluation, lu pour l'examen">
        <p class="pre__intro">
          <strong>Rapport d'évaluation — lot {{ l.lot }}</strong> · {{ offresTriees().length }} offre{{ offresTriees().length > 1 ? 's' : '' }} évaluée{{ offresTriees().length > 1 ? 's' : '' }}
          @if (ev()?.rapport; as r) { · produit le {{ date(r.produitLe) }}{{ r.signe ? ', signé le ' + date(r.signeLe) : ', signatures en cours' }} } @else { · rapport non produit }
          <button type="button" class="pme-lien pre__pdf" [disabled]="pdfOccupe()" (click)="ouvrirPdf()">{{ pdfOccupe() ? 'Ouverture…' : 'Ouvrir le PDF du rapport' }}</button>
          @if (pdfErreur(); as e) { <span class="pre__manque">{{ e }}</span> }
        </p>
        <nav class="pre__sommaire" aria-label="Parties du rapport">
          @for (p of parties; track p.cle) { <a class="pre__som" [href]="'#' + id(p.cle)" (click)="aller($event, p.cle)">{{ p.cle }} · {{ p.libelle }}</a> }
        </nav>

        <!-- ── A ── -->
        <section class="pme-partie" [id]="id('A')" [class.pme-partie--visee]="viseeCle() === 'A'" [attr.aria-labelledby]="id('A') + '-t'">
          <header class="pme-partie__tete"><span class="pme-partie__lettre">A</span><h3 class="pme-partie__titre" [id]="id('A') + '-t'">Commission et déclarations</h3><span class="pme-partie__pts">{{ pointsDe('A') }}</span></header>
          @if (cao(); as c) {
            <p class="pmd__ligne"><strong>Décision de désignation :</strong> {{ c.decision.reference || '—' }}{{ c.decision.date ? ' du ' + jour(c.decision.date) : '' }}
              @if (c.decision.fichier) { <span class="pmd-pill pmd-pill--ok">PDF signé joint</span> } @else { <span class="pmd-pill pmd-pill--ko">décision signée non jointe</span> }</p>
            <ul class="pmd-encart__liste">
              @for (m of c.membres; track m.id) { <li><strong>{{ m.nom }} {{ m.prenom }}</strong><span>&nbsp;— {{ m.president ? 'président · ' : '' }}{{ origine(m.origine) }}{{ m.fonction ? ' · ' + m.fonction : '' }}{{ m.organisme ? ' · ' + m.organisme : '' }}</span></li> }
            </ul>
          } @else { <p class="pmd__aide">La commission n'est pas servie à votre profil.</p> }
          @if (ev()?.declarations?.length) {
            <p class="pmd__etiquette">Déclarations d'absence de conflit d'intérêts</p>
            <ul class="pmd-encart__liste">
              @for (d of ev()!.declarations; track d.membre) {
                <li [class.pmd__attendue]="!d.signeeLe || d.conflit"><strong>{{ d.nom }}</strong><span>&nbsp;— {{ d.president ? 'président · ' : '' }}{{ !d.signeeLe ? 'déclaration non signée' : d.conflit ? 'conflit déclaré' + (d.precision ? ' — ' + d.precision : '') : 'absence de conflit, signée le ' + date(d.signeeLe) }}</span></li>
              }
            </ul>
          } @else { <p class="pmd__aide">Aucune déclaration de conflit d'intérêts enregistrée.</p> }
        </section>

        <!-- ── B ── -->
        <section class="pme-partie" [id]="id('B')" [class.pme-partie--visee]="viseeCle() === 'B'" [attr.aria-labelledby]="id('B') + '-t'">
          <header class="pme-partie__tete"><span class="pme-partie__lettre">B</span><h3 class="pme-partie__titre" [id]="id('B') + '-t'">Synthèse et classement</h3><span class="pme-partie__pts">{{ pointsDe('B') }}</span></header>
          <table class="cnm-table pmd__table pme-table" aria-label="Classement des offres par montant évalué">
            <thead><tr><th scope="col">Rang</th><th scope="col">Offre</th><th scope="col">Soumissionnaire</th><th scope="col">Examen préliminaire · rejet</th><th scope="col" class="pmd__num">Montant évalué HT</th><th scope="col" class="pmd__num">Écart à l'estimation</th><th scope="col" class="pmd__num">Écart à la moyenne</th><th scope="col">Offre anormale</th><th scope="col">Post-qualification</th></tr></thead>
            <tbody>
              @for (o of offresTriees(); track o.idOffre) {
                @let s = synthese(o);
                @let ix = indicateurDe(o.idOffre);
                <tr [class.pmd__ecartee]="!!o.ecartee" [class.pme-premier]="o.rang === 1 && !o.ecartee">
                  <td>{{ o.rang ?? '—' }}@if (o.exAequo) { <span class="pmd-pill pmd-pill--att">ex æquo</span> }</td>
                  <td>n° {{ o.numero ?? '—' }}</td><td>{{ o.entreprise.raisonSociale }}</td>
                  <td>{{ s.conformite }}@if (o.ecartee; as r) { <span class="pre__rejet"> — écartée ({{ etape(r.etape) }}{{ r.qualification ? ', ' + rejet(r.qualification) : '' }}){{ r.motif ? ' : ' + r.motif : '' }}@if (r.clause) { <span class="pmd-pill">clause {{ r.clause }}</span> } @else { <span class="pmd-pill pmd-pill--ko">sans clause du DAO</span> }</span> }</td>
                  <td class="pmd__num pme-fort">{{ ariary(o.evaluation?.montantEvalue) }}</td>
                  <td class="pmd__num">{{ ecart(ix?.ecartEstimation) }}</td><td class="pmd__num">{{ ecart(ix?.ecartMoyenne) }}</td>
                  <td>{{ s.anormale }}</td><td>{{ s.qualification }}</td>
                </tr>
              }
            </tbody>
          </table>
          @for (j of departages(); track j.date) { <p class="pmd__ligne"><strong>Départage :</strong> {{ j.detail || '—' }} <span class="pme-constat">({{ j.acteur }}, {{ date(j.date) }})</span></p> }
          @if (ev()?.nonEvaluees?.length) {
            <p class="pmd__ligne"><strong>Offres non évaluées :</strong> @for (n of ev()!.nonEvaluees; track $index) { n° {{ n.numero ?? '—' }} ({{ n.etat }}{{ n.motif ? ' — ' + n.motif : '' }}){{ $last ? '' : ' ; ' }} }</p>
          }
          @if (l.proposition; as p) {
            <p class="pmd__ligne pre__prop">
              <strong>Proposition d'attribution :</strong>
              @if (p.infructueux) { lot infructueux{{ p.motifInfructuosite ? ' — ' + p.motifInfructuosite : '' }} }
              @else { offre n° {{ p.numero ?? '—' }} · {{ p.candidat }} · <span class="pme-fort">{{ ariary(p.montant) }}</span> HT{{ p.montantTtc ? ' (' + ariary(p.montantTtc) + ' TTC)' : '' }}{{ p.delai ? ' · délai ' + p.delai : '' }}{{ p.seulTitulaireQualifie ? ' · seul titulaire qualifié' : '' }} }
            </p>
          } @else { <p class="pmd__aide">Aucune proposition d'attribution servie (rapport non signé, ou profil sans accès).</p> }
        </section>

        <!-- ── C ── -->
        <section class="pme-partie" [id]="id('C')" [class.pme-partie--visee]="viseeCle() === 'C'" [attr.aria-labelledby]="id('C') + '-t'">
          <header class="pme-partie__tete"><span class="pme-partie__lettre">C</span><h3 class="pme-partie__titre" [id]="id('C') + '-t'">Examen préliminaire</h3><span class="pme-partie__pts">{{ pointsDe('C') }}</span></header>
          @for (o of offresTriees(); track o.idOffre) {
            <details class="pmd__detail" [open]="o.rang === 1 || !!o.ecartee">
              <summary>Offre n° {{ o.numero ?? '—' }} · {{ o.entreprise.raisonSociale }} — {{ synthese(o).conformite }}{{ o.conformite?.clause ? ' · clause ' + o.conformite!.clause : '' }}</summary>
              @if (o.conformite?.verifications?.length) {
                @let groupes = verificationsDe(o);
                <p class="pmd__etiquette">Documents essentiels (point de la grille)</p>
                <table class="cnm-table pmd__table pme-table" [attr.aria-label]="'Documents essentiels de l’offre n° ' + o.numero">
                  <tbody>
                    @for (v of groupes.essentiels; track v.code) {
                      @let c = v.cote ?? v.coteProposee;
                      <tr><td><span class="pmd-pill" [class.pmd-pill--ok]="c === 'C' || c === 'SC'" [class.pmd-pill--ko]="c === 'NC'" [class.pmd-pill--att]="!c">{{ cote(c) }}</span></td><td>{{ v.libelle }}</td><td class="pme-constat">{{ v.observation || v.constat || '—' }}</td></tr>
                    }
                  </tbody>
                </table>
                @if (groupes.autres.length) {
                  <p class="pmd__etiquette">Autres vérifications</p>
                  <table class="cnm-table pmd__table pme-table" [attr.aria-label]="'Autres vérifications de l’offre n° ' + o.numero">
                    <tbody>
                      @for (v of groupes.autres; track v.code) {
                        @let c = v.cote ?? v.coteProposee;
                        <tr><td><span class="pmd-pill" [class.pmd-pill--ok]="c === 'C' || c === 'SC'" [class.pmd-pill--ko]="c === 'NC'" [class.pmd-pill--att]="!c">{{ cote(c) }}</span></td><td>{{ v.libelle }}</td><td class="pme-constat">{{ v.observation || v.constat || '—' }}</td></tr>
                      }
                    </tbody>
                  </table>
                }
                @if (o.conformite?.motif) { <p class="pmd__ligne"><strong>Décision :</strong> {{ o.conformite!.decision === 'ECARTEE' ? 'écartée' : 'conforme' }}{{ o.conformite!.qualification ? ' (' + rejet(o.conformite!.qualification) + ')' : '' }} — {{ o.conformite!.motif }}</p> }
                <p class="pmd__aide">{{ o.conformite!.nom ? 'Saisi par ' + o.conformite!.nom + (o.conformite!.le ? ' le ' + date(o.conformite!.le) : '') : '' }}</p>
              } @else { <p class="pmd__aide">Examen préliminaire non renseigné.</p> }
              @if (precisions()[o.idOffre]; as ps) {
                @if (ps.length) {
                  <p class="pmd__etiquette">Demandes de précisions</p>
                  <ul class="pmd-encart__liste">
                    @for (d of ps; track d.idDemande) { <li>{{ demande(d) }}</li> }
                  </ul>
                }
              }
            </details>
          }
        </section>

        <!-- ── D ── -->
        <section class="pme-partie" [id]="id('D')" [class.pme-partie--visee]="viseeCle() === 'D'" [attr.aria-labelledby]="id('D') + '-t'">
          <header class="pme-partie__tete"><span class="pme-partie__lettre">D</span><h3 class="pme-partie__titre" [id]="id('D') + '-t'">Montant évalué</h3><span class="pme-partie__pts">{{ pointsDe('D') }}</span></header>
          @if (informationsDao().length) {
            <div class="pmd-encart">
              <h4 class="pmd-encart__titre">Ce que le DAO dit de l'évaluation (bloc B06 de la fiche validée)</h4>
              @for (m of informationsDao(); track m.code) { <p class="pmd__ligne"><span class="pme-constat">{{ m.code }} · {{ m.libelle }} :</span> {{ m.valeur ?? '— non renseigné' }}</p> }
            </div>
          } @else { <p class="pmd__aide">Le bloc B06 de la fiche (évaluation des offres) n'est pas servi à votre profil.</p> }
          <p class="pmd__ligne"><strong>Variantes :</strong> {{ variantes() }}</p>
          @for (c of controlesDe(['CORRECTIONS_HORS_CALCUL']); track c.idControle) { <p class="pme-ctrl" [class.pme-ctrl--ok]="c.resultat === 'CONFORME'" [class.pme-ctrl--ko]="c.resultat === 'NON_CONFORME'"><strong>Contrôle automatique</strong> {{ c.libelle || c.regle }} — {{ resultat(c) }}{{ constat(c) ? ' : ' + constat(c) : '' }}</p> }
          @for (o of offresTriees(); track o.idOffre) {
            @if (o.evaluation; as e) {
              <details class="pmd__detail" [open]="o.rang === 1">
                <summary>Offre n° {{ o.numero ?? '—' }} · {{ o.entreprise.raisonSociale }} — prix lu {{ ariary(e.prixLu) }} HT → montant évalué <span class="pme-fort">{{ ariary(e.montantEvalue) }}</span></summary>
                @if (e.corrections.length) {
                  <p class="pmd__etiquette">Corrections arithmétiques</p>
                  <ul class="pmd-encart__liste">
                    @for (k of e.corrections; track $index) { <li>{{ k.ligne != null ? 'ligne ' + k.ligne + ' · ' : '' }}{{ k.libelle }} : {{ ariary(k.avant) }} → {{ ariary(k.apres) }} ({{ regle(k.regle) }}){{ k.ecart ? ' — hors calcul' : '' }}{{ k.motif ? ' — ' + k.motif : '' }}{{ k.retenue === false ? ' — non retenue' : '' }}</li> }
                  </ul>
                } @else { <p class="pmd__aide">Aucune correction arithmétique.</p> }
                @if (e.refusCandidat; as rc) { <p class="pmd__ligne"><strong>Correction refusée par le candidat :</strong> {{ rc.motif }} (clause {{ rc.clause }})</p> }
                <p class="pmd__ligne"><strong>Rabais :</strong> {{ rabais(o) }}</p>
                <p class="pmd__ligne"><strong>Marge de préférence :</strong> {{ e.preference?.eligible ? 'appliquée' + (e.preference?.taux != null ? ' (' + e.preference!.taux + ' %' + (e.preference?.ajustement != null ? ', ajustement ' + ariary(e.preference!.ajustement) : '') + ')' : '') : 'non appliquée' }}{{ e.preference?.motif ? ' — ' + e.preference!.motif : '' }}</p>
                @if (e.criteres.length) {
                  <p class="pmd__etiquette">Critères monétisés</p>
                  <ul class="pmd-encart__liste">@for (k of e.criteres; track $index) { <li>{{ k.libelle }} : {{ ariary(k.montant) }} — {{ k.justification }}</li> }</ul>
                }
                <p class="pmd__ligne">Prix corrigé <span class="pme-fort">{{ ariary(e.prixCorrige) }}</span> · montant évalué <span class="pme-fort">{{ ariary(e.montantEvalue) }}</span> HT{{ e.nom ? ' — saisi par ' + e.nom + (e.le ? ' le ' + date(e.le) : '') : '' }}</p>
              </details>
            }
          }
        </section>

        <!-- ── E ── -->
        <section class="pme-partie" [id]="id('E')" [class.pme-partie--visee]="viseeCle() === 'E'" [attr.aria-labelledby]="id('E') + '-t'">
          <header class="pme-partie__tete"><span class="pme-partie__lettre">E</span><h3 class="pme-partie__titre" [id]="id('E') + '-t'">Offres anormales et moralité des prix</h3><span class="pme-partie__pts">{{ pointsDe('E') }}</span></header>
          <div class="pmd-encart">
            <h4 class="pmd-encart__titre">Méthode et seuils</h4>
            <p class="pmd__ligne">{{ methodeAnormales() || 'Méthode de détection non renseignée au DAO (B06-EO-07).' }}</p>
            <p class="pmd__ligne">Estimation de la fiche <span class="pme-fort">{{ ariary(indicateurs()?.estimation) }}</span> HT · moyenne des offres <span class="pme-fort">{{ ariary(indicateurs()?.moyenne) }}</span> HT</p>
            <p class="pre__manque">Seuils appliqués (haute, basse) et les deux moyennes de la méthode : en attente du serveur (demande rapport-evaluation-examen, B1).</p>
          </div>
          <table class="cnm-table pmd__table pme-table" aria-label="Offres anormales : écarts, demandes et décisions">
            <thead><tr><th scope="col">Offre</th><th scope="col" class="pmd__num">Montant évalué HT</th><th scope="col" class="pmd__num">Écart à l'estimation</th><th scope="col" class="pmd__num">Écart à la moyenne</th><th scope="col">Décision</th><th scope="col">Demande écrite de justification et réponse</th></tr></thead>
            <tbody>
              @for (o of offresTriees(); track o.idOffre) {
                @let ix = indicateurDe(o.idOffre);
                @let a = o.anormale;
                <tr [class.pmd__ecartee]="!!o.ecartee">
                  <td>n° {{ o.numero ?? '—' }}</td><td class="pmd__num">{{ ariary(o.evaluation?.montantEvalue) }}</td>
                  <td class="pmd__num">{{ ecart(ix?.ecartEstimation) }}</td><td class="pmd__num">{{ ecart(ix?.ecartMoyenne) }}</td>
                  <td>{{ a?.decision ? anormale(a!.decision!) : '—' }}{{ a?.motif ? ' — ' + a!.motif : '' }}@if (a?.nom) { <span class="pme-constat"> ({{ a!.nom }}, {{ date(a!.le) }})</span> }</td>
                  <td>@if (a?.justification; as j) { {{ demande(j) }} } @else if (a?.decision === 'REJETEE') { <span class="pmd-pill pmd-pill--ko">rejet sans demande écrite tracée</span> } @else { — }@if (a?.defautReponse) { <span class="pmd-pill pmd-pill--att">défaut de réponse à l'échéance</span> }</td>
                </tr>
              }
            </tbody>
          </table>
          @if (alertes().length) {
            <p class="pmd__etiquette">Prix unitaires écartés du bordereau (sous-détails)</p>
            <ul class="pmd-encart__liste">@for (x of alertes(); track $index) { <li><strong>Offre n° {{ x.numero ?? '—' }}</strong> — {{ x.alerte }}</li> }</ul>
          }
          <div class="pmd-encart">
            <h4 class="pmd-encart__titre">Moralité des prix</h4>
            @if (arret('ANORMALES'); as ar) { <p class="pmd__ligne"><strong>Observation de la commission à l'arrêt de l'étape</strong> ({{ ar.nom || ar.par }}, {{ date(ar.le) }}) : {{ ar.observation || '— aucune observation' }}</p> }
            @else { <p class="pmd__aide">L'étape des offres anormales n'est pas arrêtée.</p> }
            <p class="pre__manque">Mention explicite de la vérification de la moralité des prix unitaires (circulaire, XII-2) : en attente du serveur (B2) — jusque-là, elle se lit dans l'observation ci-dessus ou dans le PDF du rapport.</p>
            <details class="pmd__detail" (toggle)="lireEstimation($event)">
              <summary>Estimation détaillée de la PRMP (non publiée)</summary>
              @switch (estimation()) {
                @case ('chargement') { <p class="pmd__aide" role="status">Chargement…</p> }
                @case ('absente') { <p class="pmd__aide">Pas d'estimation détaillée servie pour ce lot (fiche validée avant la règle, ou profil sans accès).</p> }
                @case (null) {}
                @default {
                  @let es = estimationLue();
                  @if (es) {
                    <p class="pmd__ligne">Total estimé <span class="pme-fort">{{ ariary(es.totalEstime) }}</span> HT · montant du lot au plan <span class="pme-fort">{{ ariary(es.montantPlan) }}</span></p>
                    <table class="cnm-table pmd__table pme-table" aria-label="Estimation détaillée de la PRMP">
                      <thead><tr><th scope="col">N°</th><th scope="col">Désignation</th><th scope="col">Unité</th><th scope="col" class="pmd__num">Quantité</th><th scope="col" class="pmd__num">Prix unitaire estimé</th><th scope="col" class="pmd__num">Montant</th></tr></thead>
                      <tbody>@for (a of es.articles; track $index) { <tr><td>{{ a.numeroPrix || a.ordre || $index + 1 }}</td><td>{{ a.designation }}</td><td>{{ a.unite }}</td><td class="pmd__num">{{ a.quantite ?? '—' }}</td><td class="pmd__num">{{ ariary(a.prixUnitaireEstime) }}</td><td class="pmd__num">{{ ariary(a.montant) }}</td></tr> }</tbody>
                    </table>
                  }
                }
              }
            </details>
          </div>
        </section>

        <!-- ── F ── -->
        <section class="pme-partie" [id]="id('F')" [class.pme-partie--visee]="viseeCle() === 'F'" [attr.aria-labelledby]="id('F') + '-t'">
          <header class="pme-partie__tete"><span class="pme-partie__lettre">F</span><h3 class="pme-partie__titre" [id]="id('F') + '-t'">Spécifications techniques</h3><span class="pme-partie__pts">{{ pointsDe('F') }}</span></header>
          @for (o of offresTriees(); track o.idOffre) {
            <details class="pmd__detail" [open]="o.rang === 1">
              <summary>Offre n° {{ o.numero ?? '—' }} · {{ o.entreprise.raisonSociale }}@if (specs()[o.idOffre]; as sp) { — {{ sp.length ? sp.length + ' caractéristique(s) cotée(s)' : 'offre par pièces' }} }</summary>
              @if (specs()[o.idOffre]; as sp) {
                @if (sp.length) {
                  <table class="cnm-table pmd__table pme-table" [attr.aria-label]="'Spécifications de l’offre n° ' + o.numero">
                    <thead><tr><th scope="col">Article · caractéristique</th><th scope="col">Exigé (DAO, B12)</th><th scope="col">Proposé</th><th scope="col">Cote</th></tr></thead>
                    <tbody>
                      @for (x of sp; track x.idArticle + '-' + x.idCaracteristique) {
                        <tr [class.pmd__ko]="(x.cote ?? x.coteProposee) === 'NC'">
                          <td>{{ x.article }}{{ x.marque ? ' · ' + x.marque : '' }}{{ x.modele ? ' ' + x.modele : '' }} · {{ x.caracteristique }}</td><td>{{ x.exigee || '—' }}</td>
                          <td>{{ x.proposee || '—' }}{{ x.declareeConforme === false ? ' (déclarée non conforme)' : '' }}</td>
                          <td>{{ cote(x.cote ?? x.coteProposee) }}{{ x.observation ? ' — ' + x.observation : '' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  @let vt = verificationTechnique(o);
                  <p class="pmd__ligne">Offre déposée par pièces : la conformité technique se lit dans l'examen préliminaire — <strong>{{ vt ? cote(vt.cote ?? vt.coteProposee) : 'non renseignée' }}</strong>{{ vt?.observation || vt?.constat ? ' : ' + (vt!.observation || vt!.constat) : '' }}</p>
                }
              } @else { <p class="pmd__aide">Les spécifications de cette offre ne sont pas servies à votre profil.</p> }
            </details>
          }
        </section>

        <!-- ── G ── -->
        <section class="pme-partie" [id]="id('G')" [class.pme-partie--visee]="viseeCle() === 'G'" [attr.aria-labelledby]="id('G') + '-t'">
          <header class="pme-partie__tete"><span class="pme-partie__lettre">G</span><h3 class="pme-partie__titre" [id]="id('G') + '-t'">Post-qualification</h3><span class="pme-partie__pts">{{ pointsDe('G') }}</span></header>
          @for (o of offresQualifiees(); track o.idOffre) {
            @let q = o.qualification!;
            <p class="pmd__ligne pme-titre"><strong>Offre n° {{ o.numero ?? '—' }} · {{ o.entreprise.raisonSociale }}</strong><span>&nbsp;— NIF {{ o.entreprise.nif }} · {{ q.decision === 'QUALIFIE' ? 'qualifiée' : q.decision === 'NON_QUALIFIE' ? 'non qualifiée' : 'post-qualification en cours' }}{{ q.clause ? ' · clause ' + q.clause : '' }}{{ q.nom ? ' · ' + q.nom + (q.le ? ', ' + date(q.le) : '') : '' }}</span></p>
            <p class="pre__manque">STAT, RCS et activités de l'entreprise (objet couvert) : en attente du serveur (B3) ; le critère juridique ci-dessous porte le constat de la commission.</p>
            <table class="cnm-table pmd__table pme-table" [attr.aria-label]="'Critères de post-qualification de l’offre n° ' + o.numero">
              <thead><tr><th scope="col">Critère</th><th scope="col">Code du DAO</th><th scope="col">Exigence du DAO</th><th scope="col">Décision et constat</th></tr></thead>
              <tbody>
                @for (k of q.criteres; track k.code; let i = $index) {
                  @if (i === 0 || q.criteres[i - 1].groupe !== k.groupe) { <tr class="pme-groupe"><th scope="rowgroup" colspan="4">{{ groupe(k.groupe) }}</th></tr> }
                  <tr>
                    <td><strong>{{ k.libelle }}</strong></td>
                    <td>@if (codeDao(k.code)) { <span class="pme-constat">{{ k.code }}</span> } @else { <span class="pmd-pill pmd-pill--att" title="Ce critère ne porte pas de code d'information de la fiche DAO : vérifier qu'il vient bien du DAO validé">hors fiche · {{ k.code }}</span> }</td>
                    <td>{{ k.exigence || '—' }}</td>
                    <td><span class="pmd-pill" [class.pmd-pill--ok]="k.decision === 'SATISFAIT'" [class.pmd-pill--ko]="k.decision === 'NON_SATISFAIT'">{{ k.decision === 'SATISFAIT' ? 'Satisfait' : k.decision === 'NON_SATISFAIT' ? 'Non satisfait' : 'à décider' }}</span>@if (k.motif || k.constat) { <span class="pme-constat">&nbsp;{{ k.motif || k.constat }}</span> }</td>
                  </tr>
                }
              </tbody>
            </table>
            @if (q.motif) { <p class="pmd__ligne">{{ q.motif }}</p> }
          } @empty { <p class="pmd__aide">Aucune post-qualification conduite (l'étape n'est pas atteinte, ou l'offre classée première n'a pas été examinée).</p> }
        </section>

        <!-- ── H ── -->
        <section class="pme-partie" [id]="id('H')" [class.pme-partie--visee]="viseeCle() === 'H'" [attr.aria-labelledby]="id('H') + '-t'">
          <header class="pme-partie__tete"><span class="pme-partie__lettre">H</span><h3 class="pme-partie__titre" [id]="id('H') + '-t'">Rapport signé — PV de validation</h3><span class="pme-partie__pts">{{ pointsDe('H') }}</span></header>
          @if (ev()?.rapport; as r) {
            <p class="pmd__ligne">Rapport produit le {{ date(r.produitLe) }}{{ r.signe ? ', validé le ' + date(r.signeLe) + ' (dernière signature)' : ', signatures en cours' }}. <span class="pme-constat">Le rapport signé par la commission vaut PV de validation (manuel révisé, R1).</span></p>
            @if (r.observations) { <p class="pmd__ligne"><strong>Observations du responsable :</strong> « {{ r.observations }} »</p> }
            @if (r.quorum; as q) {
              <p class="pmd__ligne"><strong>Quorum :</strong> <span class="pmd-pill" [class.pmd-pill--ok]="q.atteint" [class.pmd-pill--ko]="!q.atteint">{{ q.atteint ? 'atteint' : 'non atteint' }}</span> {{ q.obtenus }} signataire(s) sur {{ q.requis }} requis ({{ q.regle }}){{ q.presidentRequis ? ' · président ' + (q.presidentSigne ? 'signataire' : q.representantNom ? 'représenté par ' + q.representantNom : 'NON signataire') : '' }}</p>
            }
            <p class="pmd__etiquette">Signataires</p>
            <ul class="pmd-encart__liste">
              @for (g of r.signatures; track $index) { <li [class.pmd__attendue]="g.empechement"><strong>{{ g.nom }}</strong><span>&nbsp;— {{ g.president ? 'président · ' : '' }}{{ g.empechement ? 'empêché' + (g.motif ? ' : ' + g.motif : '') + (g.constatePar ? ' (constaté par ' + g.constatePar + ')' : '') : 'signé le ' + date(g.date) }}{{ g.observation ? ' — observation : « ' + g.observation + ' »' : '' }}</span></li> }
              @for (g of r.signaturesAttendues; track $index) { <li class="pmd__attendue">{{ g.nom }} — signature attendue</li> }
            </ul>
            @if (ev()?.rapportsRetires?.length) {
              <p class="pmd__etiquette">Rapports retirés avant validation</p>
              <ul class="pmd-encart__liste">@for (x of ev()!.rapportsRetires!; track x.id) { <li>Produit le {{ date(x.produitLe) }}, retiré le {{ date(x.retireLe) }}{{ x.nom ? ' par ' + x.nom : '' }} — {{ x.motif }}{{ x.signatures ? ' (signatures tombées : ' + x.signatures + ')' : '' }}</li> }</ul>
            }
          } @else { <p class="pmd__aide">Rapport non produit : l'évaluation est encore en cours.</p> }
          @for (c of controlesDe(['DOCUMENTS_EVALUATION_SIGNES', 'QUORUM_COMMISSION']); track c.idControle) { <p class="pme-ctrl" [class.pme-ctrl--ok]="c.resultat === 'CONFORME'" [class.pme-ctrl--ko]="c.resultat === 'NON_CONFORME'"><strong>Contrôle automatique</strong> {{ c.libelle || c.regle }} — {{ resultat(c) }}{{ constat(c) ? ' : ' + constat(c) : '' }}</p> }
        </section>
      </section>
    }
  `,
  styleUrl: './procedure-marche-docs.scss',
})
export class RapportEvaluationExamen implements OnInit {
  readonly idDmc = input.required<number>();
  readonly lot = input<number | null>(null);
  /** Les contrôles automatiques du dossier (`GET /api/dossiers/{id}/controles`) : affichés sous le point qu'ils éclairent. */
  readonly controles = input<readonly ControleResultat[]>([]);
  /** La partie que la grille demande de montrer : défilement et surlignage bref (jeton : une nouvelle demande, même partie). */
  readonly visee = input<{ cle: string; jeton: number } | null>(null);

  private readonly service = inject(EvaluationService);
  private readonly caoService = inject(CaoService);
  private readonly fiches = inject(FicheMarcheService);
  private readonly champs = inject(ChampFicheMarcheService);

  readonly parties = PARTIES_RAPPORT;
  readonly id = idPartieRapport;
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly ev = signal<Evaluation | null>(null);
  readonly cao = signal<Cao | null>(null);
  readonly indicateurs = signal<IndicateursPrix | null>(null);
  readonly specs = signal<Record<string, SpecificationOffre[]>>({});
  readonly precisions = signal<Record<string, DemandeEvaluation[]>>({});
  readonly fiche = signal<FicheMarche | null>(null);
  readonly referentiel = signal<ReferentielFiche | null>(null);
  readonly journal = signal<EntreeJournalEvaluation[]>([]);
  readonly estimation = signal<'chargement' | 'absente' | 'lue' | null>(null);
  readonly estimationLue = signal<EstimationEvaluation | null>(null);
  readonly pdfOccupe = signal(false);
  readonly pdfErreur = signal<string | null>(null);
  readonly viseeCle = signal<string | null>(null);

  readonly lotEval = computed(() => { const e = this.ev(); return e?.lots.find((l) => l.lot === this.lot()) ?? e?.lots[0] ?? null; });
  readonly offresTriees = computed(() => [...(this.lotEval()?.offres ?? [])].sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99) || (a.numero ?? 0) - (b.numero ?? 0)));
  readonly offresQualifiees = computed(() => this.offresTriees().filter((o) => !!o.qualification?.criteres?.length));
  readonly departages = computed(() => this.journal().filter((j) => j.action === 'DEPARTAGE'));
  /**
   * Ce que le DAO dit de l'évaluation : les informations du bloc B06 de la fiche validée, avec leur libellé du référentiel (les codes
   * diffèrent entre fournitures et travaux : rien n'est codé ici) ; une information vide est dite « non renseignée ».
   */
  readonly informationsDao = computed(() => {
    const f = this.fiche();
    const champs = this.referentiel()?.champs ?? [];
    if (!f) return [];
    return champs.filter((c) => c.bloc === 'B06' && c.actif !== false).map((c) => {
      const v = f.valeurs[c.code];
      return { code: c.code, libelle: c.libelle, valeur: v == null || String(v).trim() === '' ? null : String(v) };
    });
  });
  /** La méthode de détection des offres anormales : celle que les indicateurs servent, sinon l'information du DAO qui en parle. */
  readonly methodeAnormales = computed(() => {
    const m = this.indicateurs()?.methodeDao;
    if (m) return m;
    return this.informationsDao().find((x) => /anormal/i.test(x.libelle))?.valeur ?? null;
  });
  /** Le cadrage dit si le DAO autorise les variantes ; l'évaluation ne dit pas encore si une offre en porte (B4). */
  readonly variantes = computed(() => {
    const c = (this.fiche()?.cadrage ?? {}) as Record<string, unknown>;
    const v = c['variantes'];
    if (v == null) return 'cadrage de la fiche non servi à votre profil';
    return String(v).toUpperCase() === 'OUI' || v === true
      ? 'autorisées par le DAO — l’évaluation ne dit pas encore si une offre en porte une ni comment elle a été évaluée (en attente du serveur, B4)'
      : 'non autorisées par le DAO : le montant évalué n’en comporte aucune';
  });
  readonly alertes = computed(() => (this.indicateurs()?.offres ?? []).flatMap((o) => o.alertes.map((alerte) => ({ numero: o.numero, alerte }))));

  readonly synthese = syntheseOffre;
  readonly ariary = ariary;
  readonly date = dateHeureFr;
  ecart(v: number | null | undefined): string { return v == null ? '—' : ecartPourCent(v); }
  cote(c: CoteConformite | null | undefined): string { return c ? LIBELLES_COTE[c] : 'à examiner'; }
  regle(r: keyof typeof LIBELLES_REGLE): string { return LIBELLES_REGLE[r]; }
  groupe(g: keyof typeof LIBELLES_GROUPE_CRITERE): string { return LIBELLES_GROUPE_CRITERE[g]; }
  anormale(d: keyof typeof LIBELLES_ANORMALE): string { return LIBELLES_ANORMALE[d] ?? d; }
  origine(o: string): string { return (LIBELLES_ORIGINE as Record<string, string>)[o] ?? o; }
  rejet(q: string): string { return LIBELLES_REJET[q] ?? q; }
  etape(e: string): string { return LIBELLES_ETAPE[e] ?? e; }
  jour(iso: string): string { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; }
  pointsDe(cle: PartieRapport['cle']): string { return 'Points : ' + (PARTIES_RAPPORT.find((p) => p.cle === cle)?.points ?? []).join(' · '); }
  codeDao(code: string | null | undefined): boolean { return /^B\d{2}-[A-Z]{2}-\d{2}/.test(code ?? ''); }
  indicateurDe(idOffre: string): IndicateursPrix['offres'][number] | null { return this.indicateurs()?.offres.find((x) => x.idOffre === idOffre) ?? null; }
  arret(etape: string) { return this.lotEval()?.etapesArretees.find((e) => e.etape === etape) ?? null; }
  controlesDe(regles: readonly string[]): ControleResultat[] { return this.controles().filter((c) => regles.includes(c.regle)); }
  resultat(c: ControleResultat): string { return c.resultat === 'CONFORME' ? 'conforme' : c.resultat === 'NON_CONFORME' ? 'NON CONFORME' : 'sans objet'; }
  constat(c: ControleResultat): string { return constatLisible(c.regle, c.valeurs); }
  verificationTechnique(o: OffreEvaluee): VerificationConformite | null { return o.conformite?.verifications.find((v) => v.code === 'CONFORMITE_TECHNIQUE') ?? null; }
  /** Les vérifications visées par le point « documents essentiels », dans l'ordre du point, puis les autres. */
  verificationsDe(o: OffreEvaluee): { essentiels: VerificationConformite[]; autres: VerificationConformite[] } {
    const l = o.conformite?.verifications ?? [];
    const essentiels = DOCUMENTS_ESSENTIELS.map((code) => l.find((v) => v.code === code)).filter((v): v is VerificationConformite => !!v);
    return { essentiels, autres: l.filter((v) => !DOCUMENTS_ESSENTIELS.includes(v.code)) };
  }
  rabais(o: OffreEvaluee): string {
    const r = o.evaluation?.rabais;
    if (!r || !r.montant) return o.rabaisDeclare ? 'déclaré par le candidat, non retenu' + (r?.motif ? ' — ' + r.motif : '') : 'aucun';
    const nature = r.nature === 'POURCENTAGE' && r.valeur != null ? `${r.valeur} %` : r.nature === 'MONTANT' && r.valeur != null ? ariary(r.valeur) : null;
    return `${ariary(r.montant)}${nature ? ' (' + nature + ')' : ''}${r.condition === 'LOTS' && r.lots?.length ? ' — conditionné aux lots ' + r.lots.join(', ') : ''}${r.lecture ? ' — lu : ' + r.lecture : ''}${r.motif ? ' — ' + r.motif : ''}`;
  }
  /** Une demande (précision ou justification) et son issue, en une phrase. */
  demande(d: DemandeEvaluation): string {
    const tete = `${d.type === 'JUSTIFICATION' ? 'Justification demandée' : 'Précision demandée'} le ${dateHeureFr(d.demandeeLe)}${d.delaiJours != null ? ` (${d.delaiJours} j` + (d.echeance ? `, échéance ${dateHeureFr(d.echeance)}` : '') + ')' : ''} : « ${d.question} »`;
    const issue = d.etat === 'REPONDUE' ? ` — réponse le ${dateHeureFr(d.reponduLe)}${d.reponse ? ' : « ' + d.reponse + ' »' : ''}${d.fichier ? ' (pièce : ' + d.fichier + ')' : ''}`
      : d.etat === 'EXPIREE' ? ' — échéance passée sans réponse' : ' — en attente de réponse';
    return tete + issue;
  }

  private readonly suiviVisee = effect(() => {
    const v = this.visee();
    if (!v) return;
    this.viseeCle.set(v.cle);
    setTimeout(() => document.getElementById(idPartieRapport(v.cle))?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }));
    setTimeout(() => { if (this.viseeCle() === v.cle) this.viseeCle.set(null); }, 2500);
  });

  aller(ev: Event, cle: string): void {
    ev.preventDefault();
    document.getElementById(idPartieRapport(cle))?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.lire(this.idDmc()).subscribe({
      next: (e) => {
        this.ev.set(e);
        this.chargement.set(false);
        const id = this.idDmc();
        const lot = this.lotEval()?.lot ?? 1;
        // Les compléments sont facultatifs : un refus (403 avant la signature, profil) retire sa donnée, l'écran le dit.
        this.caoService.lire(id).subscribe({ next: (c) => this.cao.set(c), error: () => {} });
        this.service.indicateursPrix(id, lot).subscribe({ next: (i) => this.indicateurs.set(i), error: () => {} });
        this.fiches.lire(id).subscribe({
          next: (f) => {
            this.fiche.set(f);
            // Le référentiel suit le type et la catégorie de la fiche : il donne son libellé à chaque information du bloc B06.
            this.champs.referentiel(f.typeMarche ?? undefined, f.categorie ?? null).subscribe({ next: (r) => this.referentiel.set(r), error: () => {} });
          },
          error: () => {},
        });
        this.service.journal(id).subscribe({ next: (j) => this.journal.set(j), error: () => {} });
        const offres = this.lotEval()?.offres ?? [];
        if (offres.length) {
          forkJoin(offres.map((o) => this.service.specifications(id, o.idOffre).pipe(catchError(() => of(null))))).subscribe((l) => {
            this.specs.set(Object.fromEntries(offres.flatMap((o, i) => (l[i] ? [[o.idOffre, l[i]!] as const] : []))));
          });
          forkJoin(offres.map((o) => this.service.precisions(id, o.idOffre).pipe(catchError(() => of([] as DemandeEvaluation[]))))).subscribe((l) => {
            this.precisions.set(Object.fromEntries(offres.map((o, i) => [o.idOffre, l[i]])));
          });
        }
      },
      error: () => { this.erreur.set(true); this.chargement.set(false); },
    });
  }

  lireEstimation(ev: Event): void {
    if (!(ev.target as HTMLDetailsElement).open || this.estimation()) return;
    this.estimation.set('chargement');
    this.service.estimation(this.idDmc(), this.lotEval()?.lot ?? 1).subscribe({
      next: (e) => { this.estimationLue.set(e); this.estimation.set('lue'); },
      error: () => this.estimation.set('absente'),
    });
  }

  ouvrirPdf(): void {
    this.pdfOccupe.set(true);
    this.pdfErreur.set(null);
    this.service.rapport(this.idDmc()).subscribe({
      next: (b) => { this.pdfOccupe.set(false); ouvrirBlobSur(b); },
      error: () => { this.pdfOccupe.set(false); this.pdfErreur.set('Le PDF du rapport n’est pas servi à votre profil, ou n’est pas encore produit.'); },
    });
  }
}
