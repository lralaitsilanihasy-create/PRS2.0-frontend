import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { DossierSoumis, EntreeJournalEvaluation, ETAPES_EVALUATION, EtapeEvaluation, Evaluation, Financiere, LotEvaluation, Negociations, OffreEvaluee, Technique, libelleEtatOffre } from '../../models';
import { AttributionService, CaoEspaceService, EvaluationPiService, EvaluationService } from '../../services';
import { BandeauEspace } from '../../shared/ui/bandeau-espace';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { DroitsEvaluation, EspaceEvaluation, droitsEvaluation, etapeArretee, etapeAtteinte } from './droits-evaluation';
import { AttributionLots } from './attribution-lots';
import { EtapeClose } from './etapes-closes';
import { AnormaleOffre, IndicateursPrixVue } from './etape-anormales';
import { ConformiteOffre } from './etape-conformite';
import { MontantOffre, TableauEvaluation } from './etape-montant';
import { EtapeQualification } from './etape-qualification';
import { EtapeTechnique } from './etape-technique';
import { SeanceFinanciereVue } from './seance-financiere';
import { EtapeFinanciere } from './etape-financiere';
import { NegociationPi } from './negociation-pi';
import { SansSuiteVue } from './sans-suite';
import { LIBELLES_ETAPE, LIBELLES_ETAT_EVALUATION, NUMERO_ETAPE, ariary, refusEvaluation } from './libelles-evaluation';
import { RapportEvaluationVue } from './rapport-evaluation';
import { SelecteurOffres, offreParDefaut } from './selecteur-offres';

/** ⚠️ 02/11 (pilote, variante B) — une entrée du sommaire de l'écran. */
interface EntreeSommaire {
  cle: string;
  libelle: string;
  etat?: string;
  inactive?: boolean;
  faite?: boolean;
}

/**
 * L'**évaluation des offres** d'une procédure en ligne (lot 1, V76-V78 ; guide d'évaluation du 07/10, étapes 2 à 5 et rapport).
 * Un même écran, deux espaces :
 * - `/cao/procedures/:idDmc/evaluation` — les **membres de la CAO** signent leur déclaration préalable, puis décident, étape par
 *   étape et lot par lot ; le **président** arrête et rouvre les étapes ; tous signent le rapport ;
 * - `/procedure/:idDmc/evaluation` — le **responsable** ouvre l'évaluation et produit le rapport ; la **PRMP** demande précisions
 *   et justifications aux candidats ; l'**UGPM** lit.
 * Le serveur calcule et garde tout (montant évalué, rang, tour de post-qualification, proposition d'attribution) ; l'écran
 * affiche, saisit, et nomme chaque refus. Confidentiel : rien n'est visible des candidats avant l'information officielle (lot 2).
 */
@Component({
  selector: 'app-evaluation-ecran',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, BandeauEspace, SelecteurOffres, AttributionLots, ConformiteOffre, MontantOffre, TableauEvaluation, IndicateursPrixVue, AnormaleOffre, EtapeQualification, EtapeTechnique, SeanceFinanciereVue, EtapeFinanciere, NegociationPi, SansSuiteVue, RapportEvaluationVue, EtapeClose],
  template: `
    <!-- La coquille interne porte son fil d'Ariane (parents déclarés sur la route) ; l'espace CAO n'en a pas : l'écran le pose. -->
    @if (espace === 'cao') {
      <nav class="ev__ariane" aria-label="Fil d'Ariane">
        <a routerLink="/cao/mes-procedures">Mes procédures</a><span aria-hidden="true">›</span>
        <a [routerLink]="['/cao/procedures', idDmc]">Procédure</a><span aria-hidden="true">›</span>
        <span aria-current="page">{{ technique() ? 'Évaluation des propositions' : 'Évaluation des offres' }}</span>
      </nav>
    }

    <!-- ⚠️ 19/10 (pilote) — dans l'espace de la commission, le bandeau des écrans du membre, avec la référence de la procédure
         (plus le numéro interne). La coquille interne garde son en-tête. -->
    @if (espace === 'cao') {
      <app-bandeau-espace [surtitre]="procedureCao()?.reference || 'Procédure'" [mono]="true" [titre]="technique() ? 'Évaluation des propositions' : 'Évaluation des offres'"
        [puces]="procedureCao()?.objet ? [{ texte: procedureCao()!.objet! }] : []">
        <span bandeau-badge class="badge badge-primary">{{ qui().charAt(0).toUpperCase() + qui().slice(1) }}</span>
      </app-bandeau-espace>
      @if (evaluation()) {
        <div class="ev__entete-actions ev__entete-actions--cao">
          <button type="button" class="btn btn-outline btn-sm" [disabled]="chargement()" (click)="charger()">Rafraîchir</button>
        </div>
      }
    } @else {
      <header class="page-header page-header--actions">
        <div>
          <div class="page-subtitle">Procédure n° {{ idDmc }} · {{ qui() }}</div>
          <h1 class="page-title">{{ technique() ? 'Évaluation des propositions' : 'Évaluation des offres' }}</h1>
        </div>
        <div class="ev__entete-actions">
          @if (lienFiche()) { <a class="btn btn-outline btn-sm" [routerLink]="lienFiche()!">Informations du DAO</a> }
          @if (evaluation()) { <button type="button" class="btn btn-outline btn-sm" [disabled]="chargement()" (click)="charger()">Rafraîchir</button> }
        </div>
      </header>
    }

    @if (chargement() && !evaluation()) {
      <p class="text-muted" role="status">Chargement de l'évaluation…</p>
    } @else if (refuse()) {
      <div class="alert alert-info" role="status"><span>L'évaluation est réservée aux membres de la commission, au responsable de la procédure, et à la PRMP et l'UGPM de la fiche.</span></div>
    } @else if (nonOuverte()) {
      <section class="card ev__bloc">
        <p>L'évaluation n'est pas encore ouverte. Elle s'ouvre quand le PV d'ouverture est signé de tous.</p>
        @if (droits().responsable) {
          <button type="button" class="btn btn-primary btn-sm ev__btn" [disabled]="travail()" (click)="ouvrir()">Ouvrir l'évaluation</button>
        }
        @if (message(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }
      </section>
    } @else if (erreur()) {
      <app-etat-erreur message="L'évaluation n'a pas pu être chargée." (reessayer)="charger()" />
    } @else if (evaluation(); as ev) {
      <div class="ev__etat">
        <span class="badge" [class.badge-info]="ev.etat === 'EN_COURS'" [class.badge-warning]="ev.etat === 'RAPPORT_A_SIGNER'" [class.badge-success]="ev.etat === 'CLOSE'">{{ etats[ev.etat] }}</span>
        <span class="text-sm text-muted">Ouverte le {{ dateHeure(ev.ouverteLe) }}{{ ev.ouvertePar ? ' par ' + ev.ouvertePar : '' }}</span>
        <span class="text-sm text-muted">Confidentiel jusqu'à l'information des candidats (art. 12-V, 35-V).</span>
      </div>
      @if (message(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }
      <!-- ⚠️ R9c (14/10) — un dossier de marché soumis ferme l'évaluation : les gestes d'écriture se retirent (droits). -->
      <app-etape-close [dossier]="etapeClose()" [lienDossier]="prmpOuUgpm()" />

      <!-- ⚠️ 02/11 (pilote, maquette « Évaluation des offres », variante B) — les chiffres clés, puis DEUX VOLETS : à gauche le sommaire
           (l'évaluation étape par étape, l'attribution, le suivi), à droite UNE partie à la fois, avec « précédente / suivante ». -->
      @if (cles().length) {
        <dl class="ev-cles">
          @for (c of cles(); track c.libelle) {
            <div [class.ev-cles--or]="c.or"><dt>{{ c.libelle }}</dt><dd>{{ c.valeur }}@if (c.complement) { <small> · {{ c.complement }}</small> }</dd></div>
          }
        </dl>
      }

      @if (ev.lots.length > 1) {
        <div class="ev__lots" role="tablist" aria-label="Lots">
          @for (l of ev.lots; track l.lot) {
            <button type="button" role="tab" class="btn btn-sm" [class.btn-primary]="l.lot === lotChoisi()" [class.btn-outline]="l.lot !== lotChoisi()" [attr.aria-selected]="l.lot === lotChoisi()" (click)="choisirLot(l.lot)">Lot {{ l.lot }} — {{ etapes[l.etape] }}</button>
          }
        </div>
      }

      <div class="ev-vol">
        <nav class="ev-rail" aria-label="Parties de l'évaluation">
          @for (g of sommaire(); track g.titre) {
            <span class="ev-rail__t">{{ g.titre }}</span>
            @for (e of g.entrees; track e.cle) {
              <button type="button" class="ev-rail__b" [class.ev-rail__b--faite]="e.faite" [attr.aria-current]="partieCourante() === e.cle ? 'true' : null"
                      [disabled]="e.inactive" (click)="aller(e.cle)">
                <span>{{ e.libelle }}</span>@if (e.etat) { <small>{{ e.etat }}</small> }
              </button>
            }
          }
        </nav>

        <section class="ev-partie" aria-live="polite">
          @if (partieCourante().startsWith('etape:') && lot(); as l) {
            <h2 class="ev-partie__t">{{ libelleEtape(etapeChoisie()) }}@if (ev.lots.length > 1) { <span class="ev-partie__lot">· lot {{ l.lot }}</span> }<span class="ev-pill">{{ etatEtape(l, etapeChoisie()) }}</span></h2>
            @if (arret(l, etapeChoisie()); as a) {
              <p class="text-sm ev__arret">Étape arrêtée par {{ a.nom || a.par }} le {{ dateHeure(a.le) }}{{ a.observation ? ' — ' + a.observation : '' }}.</p>
            }

            <div class="ev__panneau">
              @switch (etapeChoisie()) {
                @case ('CONFORMITE') {
                  <p class="text-sm text-muted ev__aide">Recevabilité, éligibilité et conformité pour l'essentiel (art. 43, 46) : la grille est pré-remplie depuis la séance ; la CAO décide, offre par offre.</p>
                  <!-- ⚠️ 19/10 (pilote) — les offres en cartes : un clic affiche l'offre choisie, seule (recréée à chaque choix). -->
                  <app-selecteur-offres [offres]="l.offres" etape="CONFORMITE" [choisie]="choisie(l.offres, 'CONFORMITE')" (choisir)="offreChoisie.set($event)" />
                  @for (o of affichees(l.offres, 'CONFORMITE'); track o.idOffre) {
                    <app-conformite-offre [idDmc]="idDmc" [offre]="o" [droits]="droits()" [figee]="arretee(l, 'CONFORMITE')" (maj)="appliquer($event)" />
                  }
                  @if (l.offres.length > 1) {
                    <div class="ev__voisines">
                      <button type="button" class="btn btn-nuit btn-sm" (click)="voisine(l.offres, 'CONFORMITE', -1)">‹ Offre précédente</button>
                      <button type="button" class="btn btn-nuit btn-sm" (click)="voisine(l.offres, 'CONFORMITE', 1)">Offre suivante ›</button>
                    </div>
                  }
                }
                @case ('EVALUATION') {
                  @if (technique(); as t) {
                    <!-- ⚠️ Lot 3 PI, PI-c (V87) — la notation technique des propositions, par membre. -->
                    <app-etape-technique [idDmc]="idDmc" [technique]="t" [lot]="l.lot" [droits]="droits()" [moi]="moi()" (maj)="technique.set($event)" />
                  } @else {
                  <p class="text-sm text-muted ev__aide">Corrections arithmétiques, rabais, préférence et critères du DAO ; le serveur calcule le montant évalué hors taxes et classe (art. 47).</p>
                  <app-selecteur-offres [offres]="retenues(l)" etape="EVALUATION" [choisie]="choisie(retenues(l), 'EVALUATION')" (choisir)="offreChoisie.set($event)" />
                  @for (o of affichees(retenues(l), 'EVALUATION'); track o.idOffre) {
                    <app-montant-offre [idDmc]="idDmc" [offre]="o" [droits]="droits()" [figee]="arretee(l, 'EVALUATION')" (maj)="appliquer($event)" />
                  }
                  @if (retenues(l).length > 1) {
                    <div class="ev__voisines">
                      <button type="button" class="btn btn-nuit btn-sm" (click)="voisine(retenues(l), 'EVALUATION', -1)">‹ Offre précédente</button>
                      <button type="button" class="btn btn-nuit btn-sm" (click)="voisine(retenues(l), 'EVALUATION', 1)">Offre suivante ›</button>
                    </div>
                  }
                  <app-tableau-evaluation [idDmc]="idDmc" [lot]="l" [droits]="droitsTableau(l)" (maj)="appliquer($event)" />
                  }
                }
                @case ('ANORMALES') {
                  <app-indicateurs-prix [idDmc]="idDmc" [lot]="l.lot" />
                  <app-selecteur-offres [offres]="classees(l)" etape="ANORMALES" [choisie]="choisie(classees(l), 'ANORMALES')" (choisir)="offreChoisie.set($event)" />
                  @for (o of affichees(classees(l), 'ANORMALES'); track o.idOffre) {
                    <app-anormale-offre [idDmc]="idDmc" [offre]="o" [droits]="droits()" [figee]="arretee(l, 'ANORMALES')" (maj)="appliquer($event)" />
                  }
                  @if (classees(l).length > 1) {
                    <div class="ev__voisines">
                      <button type="button" class="btn btn-nuit btn-sm" (click)="voisine(classees(l), 'ANORMALES', -1)">‹ Offre précédente</button>
                      <button type="button" class="btn btn-nuit btn-sm" (click)="voisine(classees(l), 'ANORMALES', 1)">Offre suivante ›</button>
                    </div>
                  }
                }
                @case ('QUALIFICATION') {
                  <app-etape-qualification [idDmc]="idDmc" [lot]="l" [droits]="droits()" (maj)="appliquer($event)" />
                }
                @case ('RAPPORT') {
                  @if (technique()) {
                    <!-- ⚠️ PI-d2b (V90) — le lot est prêt quand le serveur sert sa proposition : attribuable (négociation réussie) ou infructueux. -->
                    @if (l.proposition; as p) {
                      @if (p.infructueux) {
                        <p><strong>La commission propose de déclarer le lot {{ l.lot }} infructueux</strong>{{ p.motifInfructuosite ? ' : ' + p.motifInfructuosite : '' }}.</p>
                      } @else {
                        <p><strong>Proposition d’attribution — lot {{ l.lot }}</strong> : proposition n° {{ p.numero ?? '—' }} · {{ p.candidat }}</p>
                        <p class="text-sm">Prix corrigé {{ ariary(p.montant) }} HT · {{ ariary(p.montantTtc) }} TTC lu · délai {{ p.delai ?? '—' }} (acte d’engagement), après négociation réussie.</p>
                      }
                    } @else {
                      <p class="text-sm">Le lot {{ l.lot }} n’est pas encore prêt : classement à arrêter, ou négociation à mener ou à conclure.</p>
                    }
                  } @else {
                  <p class="text-sm">Toutes les étapes du lot {{ l.lot }} sont arrêtées.</p>
                  }
                  <!-- Le rapport lui-même : production, signatures, documents. -->
                  <app-rapport-evaluation [idDmc]="idDmc" [evaluation]="ev" [droits]="droits()" [moi]="moi()" [pi]="!!technique()" (maj)="appliquer($event)" />
                }
              }
            </div>

            @if (droits().president && etapeChoisie() !== 'RAPPORT' && !(technique() && etapeChoisie() === 'EVALUATION')) {
              <section class="card ev__president" aria-label="Arrêt de l'étape par le président">
                @if (!arretee(l, etapeChoisie()) && l.etape === etapeChoisie()) {
                  <label class="form-group"><span class="form-label">Observation (facultative)</span><input class="form-control" type="text" [value]="observation()" (input)="observation.set($any($event.target).value)" /></label>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="travail()" (click)="arreter(l)">Arrêter l'étape « {{ etapes[etapeChoisie()] }} »</button>
                  <p class="text-sm text-muted ev__aide">Arrêter fige les décisions de l'étape pour ce lot et ouvre l'étape suivante.</p>
                } @else if (arretee(l, etapeChoisie())) {
                  <details>
                    <summary>Rouvrir l'étape (et les suivantes du lot)…</summary>
                    <div class="ev__rouvrir">
                      <label class="form-group"><span class="form-label">Motif (obligatoire, porté au journal)</span><input class="form-control" type="text" [value]="motifReouverture()" (input)="motifReouverture.set($any($event.target).value)" /></label>
                      <button type="button" class="btn btn-ocre btn-sm" [disabled]="!motifReouverture().trim() || travail()" (click)="rouvrir(l)">Rouvrir</button>
                    </div>
                  </details>
                }
              </section>
            }
          } @else {
            @switch (partieCourante()) {
              @case ('declarations') {
                <!-- P6 : la déclaration préalable de chaque membre. -->
                <h2 class="ev-partie__t">Déclarations des membres</h2>
                <ul class="ev__decl">
                  @for (d of ev.declarations; track d.membre) {
                    <li>
                      <strong>{{ d.nom }}</strong>{{ d.president ? ' — président' : '' }} :
                      @if (!d.signeeLe) { <span class="text-muted">déclaration à signer</span> }
                      @else if (d.conflit) { <span class="badge badge-danger">conflit d'intérêts déclaré</span>{{ d.precision ? ' — ' + d.precision : '' }} <span class="text-sm text-muted">(lit, ne décide pas)</span> }
                      @else { <span class="text-sm">aucun conflit, confidentialité acceptée — le {{ dateHeure(d.signeeLe) }}</span> }
                    </li>
                  }
                </ul>
                @if (droits().membre && !droits().declaree && ev.etat === 'EN_COURS') {
                  <fieldset class="ev__form-decl">
                    <legend class="form-label">Votre déclaration (avant toute décision ; elle ne se reprend pas)</legend>
                    <label><input type="radio" name="ev-conflit" [checked]="conflit() === false" (change)="conflit.set(false)" /> Je n'ai aucun intérêt financier ou personnel dans une entreprise candidate (art. 21-d).</label>
                    <label><input type="radio" name="ev-conflit" [checked]="conflit() === true" (change)="conflit.set(true)" /> Je déclare un conflit d'intérêts : je lirai l'évaluation sans y décider.</label>
                    @if (conflit()) {
                      <label class="form-group"><span class="form-label">Précision</span><input class="form-control" type="text" [value]="precision()" (input)="precision.set($any($event.target).value)" /></label>
                    }
                    <label><input type="checkbox" [checked]="confidentialite()" (change)="confidentialite.set($any($event.target).checked)" /> Je m'engage à ne divulguer aucune information sur les offres, les notes ou le classement avant la publication officielle (art. 12-V).</label>
                    <button type="button" class="btn btn-primary btn-sm ev__btn" [disabled]="conflit() === null || !confidentialite() || travail()" (click)="declarer()">Signer ma déclaration</button>
                  </fieldset>
                } @else if (droits().conflit) {
                  <p class="text-sm">Vous avez déclaré un conflit d'intérêts : vous lisez l'évaluation, vous n'y décidez rien.</p>
                }
              }
              @case ('nonEvaluees') {
                <h2 class="ev-partie__t">Offres non évaluées</h2>
                <ul class="ev__decl">
                  @for (n of ev.nonEvaluees; track $index) { <li>Offre n° {{ n.numero ?? '—' }} · {{ nomEntreprise(n.entreprise) }} — {{ etatOffre(n.etat) }}{{ n.motif ? ' : ' + n.motif : '' }}</li> }
                </ul>
              }
              <!-- ⚠️ Lot 3 PI, PI-d1 (V88) — la seconde séance : les enveloppes financières des propositions qualifiées, une fois l'évaluation
                   technique arrêtée sur chaque lot ; ⚠️ PI-d2a (V89) — puis l'évaluation financière et le classement, puis la négociation. -->
              @case ('seanceFin') {
                <app-seance-financiere [idDmc]="idDmc" [droits]="droits()" [espace]="espace" [membres]="ev.declarations" (etatChange)="chargerFinanciere()" />
              }
              @case ('financiere') {
                @if (financiere(); as f) {
                  <app-etape-financiere [idDmc]="idDmc" [financiere]="f" [lot]="lot()?.lot ?? 1" [droits]="droits()" (maj)="apresFinanciere($event)" />
                }
              }
              @case ('negociation') {
                @if (negociations(); as n) {
                  <app-negociation-pi [idDmc]="idDmc" [negociations]="n" [lot]="lot()?.lot ?? 1" [conduite]="prmpOuUgpm() && !etapeClose()" (maj)="apresNegociation($event)" />
                }
              }
              <!-- ⚠️ Lot 2, tranche 2a (V79) — après le rapport signé : le dossier de marché de chaque lot, au contrôle de la Commission. -->
              @case ('attribution') {
                <app-attribution-lots [idDmc]="idDmc" [prmpOuUgpm]="prmpOuUgpm()" [prmp]="espace === 'interne' && role() === 'PRMP'" />
              }
              <!-- ⚠️ 2d-3 (V93) — la déclaration sans suite : à tout moment avant la signature d'un marché, dans la coquille interne. -->
              @case ('sansSuite') {
                <app-sans-suite [idDmc]="idDmc" [prmp]="role() === 'PRMP'" [lienDossier]="prmpOuUgpm()" />
              }
              @case ('journal') {
                <h2 class="ev-partie__t">Journal de l'évaluation</h2>
                @if (journal(); as j) {
                  <ul class="ev__journal">
                    @for (x of j; track $index) { <li><span class="text-muted">{{ dateHeure(x.date) }}</span> · <strong>{{ x.acteur }}</strong> · {{ x.action }}{{ x.detail ? ' — ' + x.detail : '' }}</li> }
                  </ul>
                } @else {
                  <p class="text-sm text-muted" role="status">Chargement du journal…</p>
                }
              }
            }
          }

          <div class="ev-nav">
            <button type="button" class="btn btn-gris btn-sm" [disabled]="!voisinePartie(-1)" (click)="allerVoisine(-1)">‹ {{ voisinePartie(-1)?.libelle ?? 'Précédente' }}</button>
            <button type="button" class="btn btn-word btn-sm" [disabled]="!voisinePartie(1)" (click)="allerVoisine(1)">{{ voisinePartie(1)?.libelle ?? 'Suivante' }} ›</button>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.9rem; }
    .ev__ariane { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); flex-wrap: wrap; }
    .ev__ariane a { color: var(--p-700); font-weight: 500; }
    .ev__entete-actions { display: flex; gap: 0.5rem; }
    .ev__voisines { display: flex; justify-content: space-between; gap: 0.5rem; }
    .ev__entete-actions--cao { justify-content: flex-end; margin-top: -0.25rem; }
    .ev__etat { display: flex; gap: 0.7rem; align-items: center; flex-wrap: wrap; }
    .ev__bloc { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .ev__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ev__decl { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--text-sm); }
    .ev__form-decl { border: 1px solid var(--n-200); border-radius: 6px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.35rem; font-size: var(--text-sm); }
    .ev__btn { align-self: flex-start; }
    .ev__lots { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    /* ⚠️ 02/11 (pilote, variante B) — les chiffres clés, puis deux volets : le sommaire bleu nuit, une partie à la fois. */
    .ev-cles { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); margin: 0; background: var(--section-fond); color: var(--texte-menu); border-radius: 6px; }
    .ev-cles > div { min-width: 0; padding: 8px 14px; border-left: 1px solid var(--menu-survol); }
    .ev-cles > div:first-child { border-left: 0; }
    .ev-cles dt { font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--texte-menu-secondaire); }
    .ev-cles dd { margin: 0; font-size: 15px; font-weight: 500; overflow-wrap: anywhere; }
    .ev-cles dd small { font-size: 11.5px; font-weight: 400; color: var(--texte-menu-secondaire); }
    .ev-cles--or dd { color: var(--or); }
    .ev-vol { display: grid; grid-template-columns: 16.5rem minmax(0, 1fr); background: var(--carte-fond); border: 1px solid var(--bordure); border-radius: 6px; overflow: hidden; }
    .ev-rail { display: flex; flex-direction: column; gap: 1px; padding: 8px 6px; background: var(--menu-fond); color: var(--texte-menu); }
    .ev-rail__t { padding: 8px 8px 4px; font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--texte-menu-secondaire); }
    .ev-rail__t:first-child { padding-top: 2px; }
    .ev-rail__b { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 6px 12px; border: 0; border-radius: 4px; background: transparent; color: var(--texte-menu); font: inherit; font-size: 13px; line-height: 1.3; text-align: left; cursor: pointer; }
    .ev-rail__b small { flex: none; font-size: 11.5px; opacity: 0.85; }
    .ev-rail__b:hover:not(:disabled) { background: var(--menu-survol); }
    .ev-rail__b:disabled { cursor: default; opacity: 0.55; }
    .ev-rail__b[aria-current='true'] { background: var(--onglet-actif-fond); color: var(--texte); font-weight: 500; box-shadow: inset 3px 0 0 var(--or); }
    .ev-rail__b:focus-visible { outline: 2px solid var(--or); outline-offset: -2px; }
    .ev-partie { min-width: 0; display: flex; flex-direction: column; gap: 0.7rem; padding: 0.9rem 1rem 1rem; }
    .ev-partie__t { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0; padding-bottom: 0.6rem; border-bottom: 1px solid var(--bordure); font-size: 1rem; font-weight: 500; }
    .ev-partie__lot { font-weight: 400; color: var(--texte-secondaire); }
    .ev-pill { padding: 1px 8px; border-radius: 10px; background: var(--neutre-fond); color: var(--neutre-texte); font-size: 11.5px; font-weight: 500; }
    .ev-nav { display: flex; justify-content: space-between; gap: 0.5rem; margin-top: auto; padding-top: 0.75rem; border-top: 1px solid var(--bordure); }
    .ev__arret, .ev__aide { margin: 0; }
    .ev__panneau { display: flex; flex-direction: column; gap: 0.7rem; }
    .ev__president { padding: 0.7rem 1rem; display: flex; flex-direction: column; gap: 0.4rem; border-left: 4px solid var(--p-600); }
    .ev__president .btn { align-self: flex-start; }
    .ev__rouvrir { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; align-items: end; padding-top: 0.4rem; }
    .ev__journal { margin: 0; padding-left: 1.1rem; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 0.2rem; max-height: 22rem; overflow: auto; }
    details > summary { cursor: pointer; }
    @media (max-width: 900px) {
      .ev__rouvrir { grid-template-columns: 1fr; }
      .ev-cles { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ev-cles > div:nth-child(odd) { border-left: 0; }
      .ev-vol { grid-template-columns: minmax(0, 1fr); }
      .ev-rail { flex-direction: row; flex-wrap: wrap; }
      .ev-rail__t { display: none; }
    }
  `,
})
export class EvaluationEcran implements OnInit {
  readonly etatOffre = libelleEtatOffre;
  private readonly service = inject(EvaluationService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly espace: EspaceEvaluation = this.route.snapshot.data['espace'] === 'cao' ? 'cao' : 'interne';
  readonly etats = LIBELLES_ETAT_EVALUATION;
  readonly etapes = LIBELLES_ETAPE;
  readonly numeros = NUMERO_ETAPE;
  readonly ordreEtapes: readonly EtapeEvaluation[] = [...ETAPES_EVALUATION, 'RAPPORT'];
  readonly dateHeure = dateHeureFr;
  readonly ariary = ariary;

  readonly chargement = signal(true);
  readonly refuse = signal(false);
  readonly nonOuverte = signal(false);
  readonly erreur = signal(false);
  readonly message = signal<string | null>(null);
  readonly travail = signal(false);
  readonly evaluation = signal<Evaluation | null>(null);
  readonly lotChoisi = signal(1);
  readonly etapeChoisie = signal<EtapeEvaluation>('CONFORMITE');
  /** ⚠️ 19/10 — l'offre choisie dans les cartes ; à défaut (ou hors de la liste de l'étape), la première qui attend une décision. */
  readonly offreChoisie = signal<string | null>(null);

  choisie(offres: readonly OffreEvaluee[], etape: EtapeEvaluation): string | null {
    const id = this.offreChoisie();
    return id && offres.some((o) => o.idOffre === id) ? id : offreParDefaut(offres, etape);
  }

  affichees(offres: readonly OffreEvaluee[], etape: EtapeEvaluation): OffreEvaluee[] {
    const id = this.choisie(offres, etape);
    return offres.filter((o) => o.idOffre === id);
  }

  voisine(offres: readonly OffreEvaluee[], etape: EtapeEvaluation, pas: 1 | -1): void {
    const i = offres.findIndex((o) => o.idOffre === this.choisie(offres, etape));
    const n = offres.length;
    if (n) this.offreChoisie.set(offres[(i + pas + n) % n].idOffre);
  }
  readonly conflit = signal<boolean | null>(null);
  readonly precision = signal('');
  readonly confidentialite = signal(false);
  readonly observation = signal('');
  readonly motifReouverture = signal('');
  readonly journal = signal<EntreeJournalEvaluation[] | null>(null);
  /**
   * ⚠️ Lot 3 PI, PI-c (V87) — la notation technique, si la procédure est de prestations intellectuelles (409 `CATEGORIE_SANS_NOTATION_TECHNIQUE`
   * sinon : `null`). Sa présence fait le mode PI : examen préliminaire, évaluation technique, rapport.
   */
  readonly technique = signal<Technique | null>(null);
  /** ⚠️ PI-d2a — l'évaluation financière et la négociation ; nulles tant que le serveur ne les sert pas (séance non ouverte, hors PI). */
  readonly financiere = signal<Financiere | null>(null);
  readonly negociations = signal<Negociations | null>(null);
  private readonly pi = inject(EvaluationPiService);
  private readonly attribution = inject(AttributionService);
  /** ⚠️ R9c (14/10) — le dossier de marché soumis qui ferme l'évaluation ; relu à chaque chargement (une reprise le lève). */
  readonly etapeClose = signal<DossierSoumis | null>(null);
  /** ⚠️ PI-d1 — l'évaluation technique est arrêtée sur chaque lot : la seconde séance peut s'ouvrir. */
  readonly techniqueArretee = computed(() => {
    const t = this.technique();
    return !!t && t.lots.length > 0 && t.lots.every((l) => !!l.arret);
  });
  readonly etapesVisibles = computed<readonly EtapeEvaluation[]>(() => (this.technique() ? ['CONFORMITE', 'EVALUATION', 'RAPPORT'] : this.ordreEtapes));

  // ── ⚠️ 02/11 (pilote, maquette « Évaluation des offres », variante B) — deux volets ──────────────────────────────────────────
  /** La partie affichée hors des étapes (déclarations, attribution, journal…) ; nulle : l'étape choisie (`etape:<code>`). */
  readonly partie = signal<string | null>(null);
  readonly partieCourante = computed(() => this.partie() ?? 'etape:' + this.etapeChoisie());
  /** Le sommaire : l'évaluation étape par étape (et, en PI, la partie financière), l'attribution, le suivi. */
  readonly sommaire = computed<{ titre: string; entrees: EntreeSommaire[] }[]>(() => {
    const ev = this.evaluation();
    const l = this.lot();
    if (!ev) return [];
    const evaluation: EntreeSommaire[] = this.etapesVisibles().map((e) => ({
      cle: 'etape:' + e,
      libelle: this.libelleEtape(e),
      etat: l ? this.etatEtape(l, e) : '',
      inactive: !l || !this.atteinte(l, e),
      faite: !!l && (this.arretee(l, e) || this.rapportSigne(e)),
    }));
    if (this.techniqueArretee()) evaluation.push({ cle: 'seanceFin', libelle: 'Séance financière' });
    if (this.financiere()) evaluation.push({ cle: 'financiere', libelle: 'Évaluation financière' });
    if (this.negociations()) evaluation.push({ cle: 'negociation', libelle: 'Négociation' });
    const attribution: EntreeSommaire[] = [];
    if (ev.etat === 'CLOSE' || ev.etat === 'EN_COURS') attribution.push({ cle: 'attribution', libelle: 'Attribution et marché' });
    if (this.espace === 'interne') attribution.push({ cle: 'sansSuite', libelle: 'Déclaration sans suite' });
    const signees = ev.declarations.filter((d) => !!d.signeeLe).length;
    const suivi: EntreeSommaire[] = [{ cle: 'declarations', libelle: 'Déclarations des membres', etat: `${signees} / ${ev.declarations.length}` }];
    if (ev.nonEvaluees.length) suivi.push({ cle: 'nonEvaluees', libelle: 'Offres non évaluées', etat: String(ev.nonEvaluees.length) });
    if (this.journalOuvert()) suivi.push({ cle: 'journal', libelle: 'Journal' });
    return [
      { titre: 'Évaluation', entrees: evaluation },
      ...(attribution.length ? [{ titre: 'Attribution', entrees: attribution }] : []),
      { titre: 'Suivi', entrees: suivi },
    ];
  });
  /** Les chiffres clés du lot affiché : offres, conformes, proposition du rapport, état de l'évaluation. */
  readonly cles = computed<{ libelle: string; valeur: string; complement?: string; or?: boolean }[]>(() => {
    const ev = this.evaluation();
    const l = this.lot();
    if (!ev || !l) return [];
    const conformes = l.offres.filter((o) => o.conformite?.decision === 'CONFORME').length;
    const p = l.proposition;
    return [
      { libelle: 'Offres', valeur: `${l.offres.length} évaluée${l.offres.length > 1 ? 's' : ''}`, complement: `${conformes} conforme${conformes > 1 ? 's' : ''}` },
      ...(p && !p.infructueux && p.candidat ? [{ libelle: 'Attributaire proposé', valeur: p.candidat, complement: p.numero != null ? `offre n° ${p.numero}` : undefined }] : []),
      ...(p && !p.infructueux && p.montant != null ? [{ libelle: 'Montant proposé HT', valeur: `${ariary(p.montant)}`, or: true }] : []),
      ...(p?.infructueux ? [{ libelle: 'Proposition', valeur: 'lot infructueux' }] : []),
      { libelle: 'Évaluation', valeur: this.etats[ev.etat] },
    ];
  });

  aller(cle: string): void {
    if (cle.startsWith('etape:')) {
      this.partie.set(null);
      this.etapeChoisie.set(cle.slice('etape:'.length) as EtapeEvaluation);
      return;
    }
    this.partie.set(cle);
    if (cle === 'journal') this.lireJournal(true);
  }

  /** L'entrée voisine du sommaire (les étapes non atteintes sont sautées). */
  voisinePartie(pas: 1 | -1): EntreeSommaire | null {
    const entrees = this.sommaire().flatMap((g) => g.entrees).filter((e) => !e.inactive);
    const i = entrees.findIndex((e) => e.cle === this.partieCourante());
    return i < 0 ? null : entrees[i + pas] ?? null;
  }

  allerVoisine(pas: 1 | -1): void {
    const v = this.voisinePartie(pas);
    if (v) this.aller(v.cle);
  }

  readonly moi = computed(() => this.auth.ref());
  readonly droits = computed<DroitsEvaluation>(() => droitsEvaluation(this.evaluation(), this.espace, this.moi(), this.auth.role(), !!this.etapeClose()));
  readonly lot = computed<LotEvaluation | null>(() => this.evaluation()?.lots.find((l) => l.lot === this.lotChoisi()) ?? this.evaluation()?.lots[0] ?? null);
  readonly lienFiche = computed(() => (['PRMP', 'UGPM'].includes(this.auth.role() ?? '') ? ['/prmp', 'dao', this.idDmc] : null));
  readonly qui = computed(() => {
    const d = this.droits();
    // Le titre suit la déclaration (qui préside), pas le droit d'arrêter, qui cesse avec l'évaluation close.
    const preside = this.evaluation()?.declarations.some((x) => x.membre === this.moi() && x.president);
    if (this.espace === 'cao') return preside ? 'président de la commission' : 'membre de la commission';
    return d.responsable ? 'responsable de la procédure' : this.auth.role() === 'PRMP' ? 'PRMP' : 'lecture';
  });
  /** La PRMP ou son UGPM, dans la coquille interne : elles créent le dossier de marché. */
  readonly role = computed(() => this.auth.role());
  readonly prmpOuUgpm = computed(() => this.espace === 'interne' && ['PRMP', 'UGPM'].includes(this.auth.role() ?? ''));
  /** Le journal : CAO, responsable, PRMP — pas l'UGPM (403). */
  readonly journalOuvert = computed(() => this.espace === 'cao' || this.auth.role() !== 'UGPM');

  // ⚠️ 19/10 — la référence et l'objet pour le bandeau de l'espace de la commission (vue du membre, déjà servie à la page de la procédure).
  private readonly caoEspace = inject(CaoEspaceService);
  readonly procedureCao = signal<{ reference: string | null; objet: string | null } | null>(null);

  ngOnInit(): void {
    this.charger();
    if (this.espace === 'cao') {
      this.caoEspace.procedure(this.idDmc).subscribe({ next: (v) => this.procedureCao.set(v.procedure), error: () => this.procedureCao.set(null) });
    }
  }

  charger(): void {
    this.chargement.set(true);
    this.refuse.set(false);
    this.erreur.set(false);
    this.service.lire(this.idDmc).subscribe({
      next: (ev) => {
        this.chargement.set(false);
        this.nonOuverte.set(false);
        this.appliquer(ev, true);
        this.chargerTechnique();
        this.attribution.dossierSoumis(this.idDmc).subscribe((d) => this.etapeClose.set(d));
        this.document.title = `Évaluation — procédure ${this.idDmc} — PRS 2.0`;
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        if (e.status === 404) this.nonOuverte.set(true);
        else if (e.status === 403) this.refuse.set(true);
        else this.erreur.set(true);
      },
    });
  }

  /** Une évaluation neuve (lecture ou réponse d'un geste) ; au premier chargement, on se place sur l'étape en cours. */
  appliquer(ev: Evaluation, premier = false): void {
    const avant = this.lot()?.etape;
    this.evaluation.set(ev);
    this.message.set(null);
    this.journal.set(null);
    const l = this.lot();
    if (l && (premier || l.etape !== avant)) this.etapeChoisie.set(l.etape);
    // Un membre qui n'a pas signé sa déclaration commence par elle : il ne décide rien avant.
    if (premier && this.droits().membre && !this.droits().declaree && ev.etat === 'EN_COURS') this.partie.set('declarations');
    if (this.partie() === 'journal') this.lireJournal(true);
  }

  choisirLot(lot: number): void {
    this.lotChoisi.set(lot);
    this.partie.set(null);
    const l = this.lot();
    if (l) this.etapeChoisie.set(l.etape);
  }

  arretee(l: LotEvaluation, e: EtapeEvaluation): boolean {
    const t = this.lotTechnique(l);
    if (t && e === 'EVALUATION') return !!t.arret;
    return etapeArretee(l, e);
  }

  atteinte(l: LotEvaluation, e: EtapeEvaluation): boolean {
    const t = this.lotTechnique(l);
    if (t && e === 'EVALUATION') return t.conformiteArretee;
    if (t && e === 'RAPPORT') return !!t.arret;
    return etapeAtteinte(l, e);
  }

  /** L'étape en cours du lot ; en PI, l'évaluation technique tant qu'elle n'est pas arrêtée, puis le rapport. */
  courante(l: LotEvaluation): EtapeEvaluation {
    const t = this.lotTechnique(l);
    if (!t || !t.conformiteArretee) return l.etape;
    return t.arret ? 'RAPPORT' : 'EVALUATION';
  }

  /**
   * ⚠️ 14/10 (refonte des présentations) — l'étape « Rapport » n'est jamais « arrêtée » comme les autres : elle disait « en cours »
   * sur un rapport signé de tous. Elle suit désormais l'état de l'évaluation : à signer, puis signé.
   */
  rapportSigne(e: EtapeEvaluation): boolean {
    return e === 'RAPPORT' && this.evaluation()?.etat === 'CLOSE';
  }
  etatEtape(l: LotEvaluation, e: EtapeEvaluation): string {
    if (this.arretee(l, e)) return 'arrêtée';
    if (e === 'RAPPORT' && this.courante(l) === e) {
      const etat = this.evaluation()?.etat;
      if (etat === 'CLOSE') return 'signé';
      if (etat === 'RAPPORT_A_SIGNER') return 'à signer';
    }
    return this.courante(l) === e ? 'en cours' : 'à venir';
  }

  libelleEtape(e: EtapeEvaluation): string {
    return this.technique() && e === 'EVALUATION' ? 'Évaluation technique' : this.etapes[e];
  }

  private lotTechnique(l: LotEvaluation) {
    return this.technique()?.lots.find((x) => x.lot === l.lot) ?? null;
  }

  /** ⚠️ PI-d2a — l'évaluation financière et la négociation, relues ensemble (l'une conditionne l'autre) ; silencieuses en cas d'échec. */
  chargerFinanciere(): void {
    this.pi.evaluationFinanciere(this.idDmc).subscribe({ next: (f) => this.financiere.set(f), error: () => this.financiere.set(null) });
    this.pi.negociations(this.idDmc).subscribe({ next: (n) => this.negociations.set(n), error: () => this.negociations.set(null) });
  }

  /** Un classement arrêté ou rouvert ouvre ou ferme la négociation : elle se relit. */
  apresFinanciere(f: Financiere): void {
    this.financiere.set(f);
    this.pi.negociations(this.idDmc).subscribe({ next: (n) => this.negociations.set(n), error: () => this.negociations.set(null) });
  }

  /** Une négociation conclue fige les montants (ou ouvre le suivant) : l'évaluation financière se relit. */
  apresNegociation(n: Negociations): void {
    this.negociations.set(n);
    this.pi.evaluationFinanciere(this.idDmc).subscribe({ next: (f) => this.financiere.set(f), error: () => this.financiere.set(null) });
  }

  /** Silencieux : hors prestations intellectuelles (409) ou sans évaluation (404), l'écran reste celui des offres. */
  private chargerTechnique(): void {
    this.pi.technique(this.idDmc).subscribe({
      next: (t) => {
        this.technique.set(t);
        if (t.lots.length && t.lots.every((l) => !!l.arret)) this.chargerFinanciere();
        const l = this.lot();
        if (l) this.etapeChoisie.set(this.courante(l));
      },
      error: () => this.technique.set(null),
    });
  }

  arret(l: LotEvaluation, e: EtapeEvaluation) {
    // En PI, l'arrêt technique se lit dans l'étape elle-même.
    if (this.lotTechnique(l) && e === 'EVALUATION') return null;
    return l.etapesArretees.find((a) => a.etape === e) ?? null;
  }

  /** Étape 3 : les offres retenues à l'examen préliminaire (et celles écartées ensuite, pour mémoire). */
  retenues(l: LotEvaluation): OffreEvaluee[] {
    return l.offres.filter((o) => o.conformite?.decision === 'CONFORME');
  }

  /** Étape 4 : les offres classées à l'étape 3, et celles qu'elle a rejetées. */
  classees(l: LotEvaluation): OffreEvaluee[] {
    return l.offres
      .filter((o) => o.rang != null || o.ecartee?.etape === 'ANORMALES' || o.ecartee?.etape === 'QUALIFICATION')
      .sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999));
  }

  /** Le départage n'est ouvert qu'à l'étape 3, tant qu'elle n'est pas arrêtée. */
  droitsTableau(l: LotEvaluation): DroitsEvaluation {
    const d = this.droits();
    return etapeArretee(l, 'EVALUATION') ? { ...d, decider: false } : d;
  }

  nomEntreprise(e: unknown): string {
    if (!e) return '—';
    if (typeof e === 'string') return e;
    const o = e as { raisonSociale?: string; nif?: string };
    return o.raisonSociale ?? o.nif ?? '—';
  }

  ouvrir(): void {
    this.geste(this.service.ouvrir(this.idDmc), 'L’évaluation est ouverte : les membres de la commission et la PRMP sont notifiés.', () => this.nonOuverte.set(false));
  }

  declarer(): void {
    const conflit = this.conflit();
    if (conflit === null) return;
    this.geste(this.service.declarer(this.idDmc, conflit, conflit ? this.precision().trim() || null : null), conflit ? 'Votre conflit est déclaré : vous lisez sans décider.' : 'Votre déclaration est signée : vous pouvez décider.');
  }

  arreter(l: LotEvaluation): void {
    this.geste(this.service.arreter(this.idDmc, l.lot, this.etapeChoisie(), this.observation().trim() || null), 'L’étape est arrêtée.', () => this.observation.set(''));
  }

  rouvrir(l: LotEvaluation): void {
    this.geste(this.service.rouvrir(this.idDmc, l.lot, this.etapeChoisie(), this.motifReouverture().trim()), 'L’étape est rouverte, avec les suivantes du lot.', () => this.motifReouverture.set(''));
  }

  lireJournal(ouvert: boolean): void {
    if (!ouvert || this.journal()) return;
    this.service.journal(this.idDmc).subscribe({
      next: (j) => this.journal.set([...j].reverse()),
      error: (e: ApiError) => this.message.set(refusEvaluation(e)),
    });
  }

  private geste(appel: ReturnType<EvaluationService['lire']>, succes: string, apres?: () => void): void {
    this.travail.set(true);
    this.message.set(null);
    appel.subscribe({
      next: (ev) => {
        this.travail.set(false);
        apres?.();
        this.appliquer(ev, !this.evaluation());
        this.toast.success(succes);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.message.set(refusEvaluation(e));
      },
    });
  }
}
