import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, input, signal } from '@angular/core';

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
  imports: [EtatErreur, NgTemplateOutlet],
  template: `
    @if (chargement()) {
      <p class="text-muted" role="status">Chargement de la lecture…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="La lecture n'a pas pu être chargée." (reessayer)="charger()" />
    } @else if (lecture(); as l) {
      <div class="ls" [class.ls--projection]="projection()">
        @if (!l.offres.length && !l.nonOuvertes.length) { <p class="empty-state-title">Aucune offre n'a été déposée.</p> }
        @if (comparatif() && !projection() && l.offres.length) {
          <!-- ⚠️ 02/11 (pilote, maquette « Séance d'ouverture », variante B) — les offres côte à côte, une colonne chacune ; une ligne par
               information, en ocre là où une alerte touche l'offre. À côté, les alertes regroupées par type et ce que l'hôte projette
               (la séance : membres, signatures, gestes). -->
          <div class="ls__comp">
            <div class="ls__comp-table">
              <table class="ls__table ls__table--comp" aria-label="Comparaison des offres lues">
                <thead>
                  <tr>
                    <th scope="col">Information</th>
                    @for (o of l.offres; track o.idOffre) { <th scope="col" class="ls__comp-o">n° {{ o.numero ?? '?' }} · {{ o.entreprise.raisonSociale }}{{ o.lot ? ' — lot ' + o.lot : '' }}</th> }
                  </tr>
                </thead>
                <tbody>
                  <tr class="ls__comp-fort"><th scope="row">Montant TTC</th>@for (o of l.offres; track o.idOffre) { <td class="ls__num">{{ insecable(montant(o.acteEngagement?.montantTtc)) }}</td> }</tr>
                  <tr><th scope="row">Montant HT</th>@for (o of l.offres; track o.idOffre) { <td class="ls__num">{{ insecable(montant(o.acteEngagement?.montantHt)) }}</td> }</tr>
                  @if (avecBordereau(l.offres)) {
                    <tr><th scope="row">Bordereau recalculé</th>@for (o of l.offres; track o.idOffre) {
                      <td class="ls__num">@if (o.formulaires && o.totaux; as t) {
                        @if (ecart(o.acteEngagement?.montantTtc, t.ttc); as e) { <span class="ls__pastille ls__pastille--ecart">écart de {{ montant(e) }}</span> }
                        @else { <span class="ls__pastille ls__pastille--ok">✓ concorde</span> }
                      } @else { — }</td> }</tr>
                    <tr><th scope="row">Au minimum (TTC)</th>@for (o of l.offres; track o.idOffre) { <td class="ls__num">{{ o.totaux?.htMin != null ? insecable(montant(o.totaux?.ttcMin)) : '—' }}</td> }</tr>
                  }
                  <tr><th scope="row">Délai</th>@for (o of l.offres; track o.idOffre) { <td class="ls__num">{{ o.acteEngagement ? o.acteEngagement.delai + ' ' + (o.acteEngagement.delaiUnite === 'MOIS' ? 'mois' : 'jours') : '—' }}</td> }</tr>
                  <tr><th scope="row">Validité</th>@for (o of l.offres; track o.idOffre) {
                    <td class="ls__num">{{ o.acteEngagement ? o.acteEngagement.validiteJours + ' jours' : '—' }}@if (validiteDe(o.numero); as v) { <small class="ls__expire">expire le {{ v.expire ?? '—' }}</small> }</td> }</tr>
                  <tr><th scope="row">Rabais</th>@for (o of l.offres; track o.idOffre) { <td class="ls__num">{{ o.rabais?.lecture || (isTexte(o.acteEngagement?.rabais) ? o.acteEngagement?.rabais : '') || 'aucun' }}</td> }</tr>
                  <tr><th scope="row">Garantie</th>@for (o of l.offres; track o.idOffre) { <td class="ls__num" [class.ls__comp-alerte]="aAlerte(o, 'GARANTIE_INSUFFISANTE')">{{ insecable(garantie(o)) }}</td> }</tr>
                  @for (g of alertesGroupees(); track g.type) {
                    <tr><th scope="row">{{ g.libelle }}</th>@for (o of l.offres; track o.idOffre) {
                      <td class="ls__num" [class.ls__comp-alerte]="aAlerte(o, g.type)">{{ aAlerte(o, g.type) ? insecable(messageAlerte(o, g.type)) : '—' }}</td> }</tr>
                  }
                  <tr><th scope="row">Intégrité</th>@for (o of l.offres; track o.idOffre) {
                    <td class="ls__num"><span class="badge" [class.badge-success]="o.integrite === 'INTACTE'" [class.badge-danger]="o.integrite !== 'INTACTE'">{{ integrites[o.integrite] ?? o.integrite }}</span></td> }</tr>
                  <tr><th scope="row">Identité</th>@for (o of l.offres; track o.idOffre) {
                    <td class="ls__num">NIF <span class="cnm-mono">{{ o.entreprise.nif }}</span>
                      <small class="ls__expire">{{ o.entreprise.verification ? (statutsNif[o.entreprise.verification.statut] ?? o.entreprise.verification.statut) : 'non vérifié' }}</small></td> }</tr>
                  @if (avecFrais(l.offres)) {
                    <tr><th scope="row">Frais de dossier</th>@for (o of l.offres; track o.idOffre) { <td class="ls__num">{{ o.fraisDossier ? (o.fraisDossier.regle ? 'réglés' : 'aucun reçu validé') : '—' }}</td> }</tr>
                  }
                  @if (avecManques(l.offres)) {
                    <tr><th scope="row">Pièces manquantes</th>@for (o of l.offres; track o.idOffre) { <td class="ls__num" [class.ls__comp-alerte]="o.piecesManquantes.length">{{ o.piecesManquantes.length ? o.piecesManquantes.join(' ; ') : '—' }}</td> }</tr>
                  }
                </tbody>
              </table>
            </div>
            <aside class="ls__comp-cote">
              <ng-content select="[cote]" />
              @if (alertesGroupees().length) {
                <section class="ls__comp-carte" aria-labelledby="ls-alertes">
                  <h4 id="ls-alertes" class="ls__comp-t">Alertes de la séance</h4>
                  @for (g of alertesGroupees(); track g.type) {
                    <div class="ls__comp-al"><strong>{{ g.libelle }}</strong>
                      @if (g.messages.length === 1) { <span>{{ insecable(g.messages[0]) }}</span> }
                      <span class="ls__comp-q">{{ g.numeros.length === l.offres.length ? (l.offres.length > 1 ? 'les ' + l.offres.length + ' offres' : 'l’offre') : 'offre' + (g.numeros.length > 1 ? 's' : '') + ' n° ' + g.numeros.join(', ') }}</span>
                    </div>
                  }
                </section>
              }
            </aside>
          </div>
          @if (l.nonOuvertes.length) {
            <h3 class="ls__h3">Offres non ouvertes</h3>
            <ul class="ls__non">
              @for (n of l.nonOuvertes; track $index) { <li>N° {{ n.numero ?? '—' }} · {{ n.entreprise }} — {{ n.etat }}{{ n.motif ? ' : ' + n.motif : '' }}</li> }
            </ul>
          }
        } @else if (onglets()) {
          <!-- ⚠️ 31/10 (pilote, maquette « Séance d'ouverture », variante B) — la fenêtre de la page du dossier : à gauche ce que l'hôte
               projette (présents, plis hors délai) et la synthèse ; à droite, une offre par onglet. Rien ne défile. -->
          <div class="ls__deux">
            <div class="ls__gauche">
              <ng-content select="[gauche]" />
              @if (l.offres.length) {
                <h4 class="ls__h4">Lecture des offres</h4>
                <ng-container [ngTemplateOutlet]="tableTpl" [ngTemplateOutletContext]="{ $implicit: l }" />
              }
              @if (l.nonOuvertes.length) {
                <h4 class="ls__h4">Offres non ouvertes</h4>
                <ul class="ls__non">
                  @for (n of l.nonOuvertes; track $index) { <li>N° {{ n.numero ?? '—' }} · {{ n.entreprise }} — {{ n.etat }}{{ n.motif ? ' : ' + n.motif : '' }}</li> }
                </ul>
              }
            </div>
            @if (offreCourante(); as o) {
              <div class="ls__droite">
                <div class="ls__onglets" role="tablist" aria-label="Offres lues">
                  @for (x of l.offres; track x.idOffre) {
                    <button type="button" class="ls__onglet" role="tab" [attr.aria-selected]="x.idOffre === o.idOffre" (click)="offreChoisie.set(x.idOffre)">Offre n° {{ x.numero ?? '?' }}</button>
                  }
                </div>
                <ng-container [ngTemplateOutlet]="offreTpl" [ngTemplateOutletContext]="{ $implicit: o }" />
              </div>
            }
          </div>
        } @else {
        @if (l.offres.length) {
          <!-- ⚠️ 19/10 (pilote) — la synthèse de la lecture, dans l'ordre d'arrivée : aller d'un coup d'œil à l'offre voulue. -->
          <ng-container [ngTemplateOutlet]="tableTpl" [ngTemplateOutletContext]="{ $implicit: l }" />
        }
        @for (o of l.offres; track o.idOffre) {
          <ng-container [ngTemplateOutlet]="offreTpl" [ngTemplateOutletContext]="{ $implicit: o }" />
        }
        @if (l.nonOuvertes.length) {
          <h3 class="ls__h3">Offres non ouvertes</h3>
          <ul class="ls__non">
            @for (n of l.nonOuvertes; track $index) { <li>N° {{ n.numero ?? '—' }} · {{ n.entreprise }} — {{ n.etat }}{{ n.motif ? ' : ' + n.motif : '' }}</li> }
          </ul>
        }
        }
      </div>
    }

    <ng-template #tableTpl let-l>
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
    </ng-template>

    <ng-template #offreTpl let-o>
      <article class="card ls__offre" tabindex="-1" [id]="'offre-' + o.idOffre" [class.ls__offre--ko]="o.integrite !== 'INTACTE'" [attr.aria-label]="'Offre n° ' + (o.numero ?? '?')">
        <header class="ls__tete">
          <span class="ls__numero" aria-hidden="true">{{ o.numero ?? '?' }}</span>
          <div class="ls__ident">
            <h3 class="ls__titre">{{ o.entreprise.raisonSociale }}{{ o.lot ? ' — lot ' + o.lot : '' }}</h3>
            <span class="text-sm text-muted">Offre n° {{ o.numero ?? '—' }} · NIF <span class="cnm-mono">{{ o.entreprise.nif }}</span>
              · STAT <span class="cnm-mono">{{ o.entreprise.stat || 'non déclaré' }}</span>
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
          <!-- ⚠️ 29/10 (pilote) — trois cases répétaient le même montant (HT, TTC, bordereau recalculé TTC et HT) : le montant lu à haute
               voix en grand, le HT dessous, et la concordance avec le bordereau recalculé par le serveur (lot 5) en une pastille. -->
          <div class="ls__lu">
            <div class="ls__lu-montant">
              <span class="ls__lu-l">Montant de l’offre, toutes taxes</span>
              <strong class="ls__lu-ttc">{{ montant(a.montantTtc) }}</strong>
              <span class="ls__lu-ht">{{ montant(a.montantHt) }} hors taxes</span>
            </div>
            @if (o.formulaires && o.totaux; as t) {
              <div class="ls__lu-controle">
                @if (ecart(a.montantTtc, t.ttc); as e) {
                  <span class="ls__pastille ls__pastille--ecart">Écart de {{ montant(e) }} avec le bordereau</span>
                  <span class="ls__lu-ht">Bordereau recalculé : {{ montant(t.ttc) }} TTC · {{ montant(t.ht) }} HT</span>
                } @else {
                  <span class="ls__pastille ls__pastille--ok">✓ Concorde avec le bordereau recalculé</span>
                }
                @if (t.htMin != null) { <span class="ls__lu-ht">Au minimum : {{ montant(t.ttcMin) }} TTC · {{ montant(t.htMin) }} HT</span> }
              </div>
            }
          </div>
          <dl class="ls__ae">
            <div><dt>Délai</dt><dd>{{ a.delai }} {{ a.delaiUnite === 'MOIS' ? 'mois' : 'jours' }}</dd></div>
            <div><dt>Validité</dt><dd>{{ a.validiteJours }} jours
                  @if (validiteDe(o.numero); as v) {
                    <small class="ls__expire">expire le {{ v.expire ?? '—' }} · {{ v.prorogations.length ? 'prorogée' : 'sans prorogation' }}</small>
                  }
                </dd></div>
            <div><dt>Rabais</dt><dd>{{ o.rabais?.lecture || (isTexte(a.rabais) ? a.rabais : '') || '—' }}</dd></div>
            <div><dt>Garantie</dt><dd>{{ insecable(garantie(o)) }}</dd></div>
            @if (o.fraisDossier; as fr) {
              <!-- V72 : le reçu des frais de dossier, validé avant le retrait (lu par le serveur, pas dans l'offre). -->
              <div class="ls__large"><dt>Frais de dossier</dt><dd>{{ fr.regle ? 'réglés' + (fr.referencePaiement ? ' · réf. ' + fr.referencePaiement : '') + (fr.dateValidation ? ' · reçu validé le ' + dateCourte(fr.dateValidation) : '') : 'aucun reçu validé' }}</dd></div>
            }
          </dl>
        }
        @if (o.piecesManquantes.length) { <p class="text-sm ls__manque">Pièces manquantes : {{ o.piecesManquantes.join(' ; ') }}</p> }
        @for (a of o.alertes; track $index) { <p class="alert alert-warning ls__alerte" role="note"><span>{{ libelleAlerte(a.type) }} : {{ insecable(a.message) }}</span></p> }
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
    </ng-template>
  `,
  styles: `
    .ls { display: flex; flex-direction: column; gap: 0.8rem; }
    .ls__synthese { overflow-x: auto; border: 1px solid var(--n-200); border-radius: 10px; background: var(--carte-fond); }
    .ls__table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .ls__table th { text-align: left; padding: 0.5rem 0.75rem; background: var(--p-100); color: var(--p-800); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
    .ls__table td { padding: 0.5rem 0.75rem; border-top: 1px solid var(--n-100); vertical-align: middle; }
    .ls__table .ls__num { text-align: right; white-space: nowrap; }
    .ls__ancre { display: inline-grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 50%; background: var(--p-100); color: var(--p-800); font-weight: 500; text-decoration: none; }
    .ls__ancre:hover, .ls__ancre:focus-visible { background: var(--bouton-principal); color: var(--texte-menu); }
    .ls__offre { padding: 1rem 1.15rem; display: flex; flex-direction: column; gap: 0.7rem; border-left: 4px solid var(--success-bdr); scroll-margin-top: 1rem; }
    .ls__offre:focus { outline: none; box-shadow: 0 0 0 3px var(--p-200); }
    .ls__offre--ko { border-left-color: var(--danger-bdr); }
    .ls__tete { display: flex; gap: 0.75rem; align-items: center; }
    .ls__numero { flex: none; width: 2.4rem; height: 2.4rem; border-radius: 50%; display: grid; place-items: center; background: var(--bouton-principal); color: var(--texte-menu); font-weight: 500; }
    .ls__ident { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .ls__titre { margin: 0; font-size: 1.05rem; }
    .ls__nif-ok { color: var(--success-text); font-weight: 500; }
    .ls__nif-ko { color: var(--danger-text); font-weight: 500; }
    .ls__motif, .ls__manque { margin: 0; color: var(--danger-text); }
    .ls__ligne { margin: 0; }
    /* ⚠️ 29/10 — le montant lu, et sa concordance avec le bordereau. */
    .ls__lu { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.6rem 1.5rem; padding: 0.75rem 1rem; border-radius: 10px; background: var(--p-50); border: 1px solid var(--p-100); }
    .ls__lu-montant { display: flex; flex-direction: column; gap: 0.1rem; }
    .ls__lu-l { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-500); font-weight: 500; }
    .ls__lu-ttc { font-size: 1.6rem; line-height: 1.15; color: var(--p-800); font-variant-numeric: tabular-nums; }
    .ls__lu-ht { font-size: var(--text-sm); color: var(--n-500); font-variant-numeric: tabular-nums; }
    .ls__lu-controle { display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; text-align: right; }
    .ls__pastille { display: inline-block; padding: 0.25rem 0.7rem; border-radius: 999px; font-size: var(--text-sm); font-weight: 500; }
    .ls__pastille--ok { background: var(--success-bg); color: var(--success-text); border: 1px solid var(--success-bdr); }
    .ls__pastille--ecart { background: var(--warning-bg); color: var(--warning-text); border: 1px solid var(--warning-bdr); }
    .ls--projection .ls__lu-ttc { font-size: 2.2rem; }
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
    .ls__groupe-titre { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); font-weight: 500; }
    .ls__pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
    .ls__h3 { margin: 0.5rem 0 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ls__non { margin: 0; padding-left: 1.2rem; font-size: var(--text-sm); }
    /* ⚠️ 31/10 (pilote, variante B) — synthèse à gauche, une offre par onglet à droite. */
    .ls__deux { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: start; }
    .ls__gauche, .ls__droite { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .ls__h4 { margin: 0; font-size: 14px; font-weight: 500; }
    .ls__onglets { display: flex; gap: 2px; border-bottom: 1px solid var(--bordure); }
    .ls__onglet { padding: 6px 12px; border: 1px solid transparent; border-bottom: 0; border-radius: 4px 4px 0 0; background: none; color: var(--texte-secondaire); font: inherit; font-size: 12.5px; cursor: pointer; }
    .ls__onglet[aria-selected="true"] { margin-bottom: -1px; background: var(--onglet-actif-fond); border-color: var(--bordure); color: var(--texte); font-weight: 500; }
    .ls__onglet:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: 2px; }
    .ls__deux .ls__offre { gap: 0.5rem; padding: 0.8rem 1rem; }
    .ls__deux .ls__lu-ttc { font-size: 1.35rem; }
    .ls__expire { display: block; font-size: 11px; color: var(--texte-secondaire); }
    @media (max-width: 52rem) { .ls__deux { grid-template-columns: minmax(0, 1fr); } }
    /* ⚠️ 02/11 (pilote, variante B) — le comparatif : les offres en colonnes, la séance et les alertes à côté. */
    .ls__comp { display: grid; grid-template-columns: minmax(0, 1fr) 19rem; gap: 12px; align-items: start; }
    .ls__comp-table { overflow-x: auto; border: 1px solid var(--bordure); border-radius: 6px; background: var(--carte-fond); }
    .ls__table--comp th[scope='row'] { text-align: left; font-weight: 400; color: var(--texte-secondaire); background: var(--carte-fond); text-transform: none; letter-spacing: 0; font-size: var(--text-sm); white-space: nowrap; }
    .ls__table--comp thead th { background: var(--section-fond); color: var(--texte-menu); text-transform: none; letter-spacing: 0; font-size: 0.8rem; font-weight: 500; white-space: normal; }
    .ls__table--comp th.ls__comp-o { text-align: right; }
    .ls__table--comp { table-layout: fixed; min-width: 40rem; }
    .ls__table--comp th[scope='row'], .ls__table--comp thead th:first-child { width: 10.5rem; white-space: normal; }
    .ls__table--comp td { border-top: 1px solid var(--bordure); white-space: normal !important; overflow-wrap: anywhere; }
    .ls__comp-fort td, .ls__comp-fort th[scope='row'] { font-size: 0.95rem; font-weight: 500 !important; color: var(--texte) !important; }
    .ls__comp-alerte { background: var(--examen-fond); color: var(--examen-texte); }
    .ls__comp-cote { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    .ls__comp-carte { display: flex; flex-direction: column; gap: 8px; padding: 0.75rem 0.9rem; border: 1px solid var(--bordure); border-radius: 6px; background: var(--carte-fond); }
    .ls__comp-t { margin: 0; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-secondaire); }
    .ls__comp-al { display: flex; flex-direction: column; gap: 3px; padding: 0.5rem 0.65rem; border-left: 4px solid var(--or); border-radius: 4px; background: var(--examen-fond); color: var(--examen-texte); font-size: var(--text-sm); }
    .ls__comp-al strong { color: var(--texte); font-weight: 500; }
    .ls__comp-q { font-size: 0.75rem; }
    @media (max-width: 64rem) { .ls__comp { grid-template-columns: minmax(0, 1fr); } }
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
  /** ⚠️ 31/10 (pilote, variante B) — une offre par onglet, la synthèse à côté : la fenêtre de la page du dossier. */
  readonly onglets = input(false);
  /** ⚠️ 02/11 (pilote, variante B) — les offres côte à côte (écran de la séance, hors projection). */
  readonly comparatif = input(false);
  /** Les validités calculées par l'hôte (date limite + durée, prorogations) : la date d'expiration s'affiche avec la validité. */
  readonly validites = input<readonly { numero: number | null; expire: string | null; prorogations: readonly unknown[] }[]>([]);
  readonly offreChoisie = signal<string | null>(null);
  readonly offreCourante = computed(() => {
    const offres = this.lecture()?.offres ?? [];
    return offres.find((o) => o.idOffre === this.offreChoisie()) ?? offres[0] ?? null;
  });

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
    if (this.onglets()) {
      this.offreChoisie.set(idOffre);
      return;
    }
    const cible = this.document.getElementById('offre-' + idOffre);
    cible?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    cible?.focus({ preventScroll: true });
  }

  /** ⚠️ 31/10 (pilote) — un montant ne se coupe jamais : espaces insécables entre ses groupes de chiffres et devant son unité. */
  insecable(texte: string | null | undefined): string {
    return (texte ?? '').replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00A0').replace(/(\d) (?=(Ar|Ariary|%)(?![\p{L}]))/gu, '$1\u00A0');
  }

  /** ⚠️ 02/11 (variante B) — les alertes regroupées par type : les offres touchées, et leurs messages distincts. */
  readonly alertesGroupees = computed(() => {
    const groupes = new Map<string, { type: string; libelle: string; numeros: (number | string)[]; messages: string[] }>();
    for (const o of this.lecture()?.offres ?? []) {
      for (const a of o.alertes) {
        const g = groupes.get(a.type) ?? { type: a.type, libelle: this.libelleAlerte(a.type), numeros: [], messages: [] };
        if (!g.numeros.includes(o.numero ?? '?')) g.numeros.push(o.numero ?? '?');
        if (!g.messages.includes(a.message)) g.messages.push(a.message);
        groupes.set(a.type, g);
      }
    }
    return [...groupes.values()];
  });

  aAlerte(o: OffreLue, type: string): boolean {
    return o.alertes.some((a) => a.type === type);
  }

  messageAlerte(o: OffreLue, type: string): string {
    return o.alertes.filter((a) => a.type === type).map((a) => a.message).join(' ; ');
  }

  avecBordereau(offres: readonly OffreLue[]): boolean {
    return offres.some((o) => !!o.formulaires && !!o.totaux);
  }

  avecFrais(offres: readonly OffreLue[]): boolean {
    return offres.some((o) => !!o.fraisDossier);
  }

  avecManques(offres: readonly OffreLue[]): boolean {
    return offres.some((o) => o.piecesManquantes.length > 0);
  }

  libelleAlerte(type: string): string {
    return (this.alertes as Readonly<Record<string, string>>)[type] ?? type;
  }

  validiteDe(numero: number | null): { expire: string | null; prorogations: readonly unknown[] } | null {
    return this.validites().find((v) => v.numero === numero) ?? null;
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

  /** Écart, en ariary, entre le montant de l'acte et le bordereau recalculé ; `null` s'ils concordent (à l'ariary près). */
  ecart(acte: number | null | undefined, bordereau: number | null | undefined): number | null {
    if (acte == null || bordereau == null) return null;
    const e = Math.abs(acte - bordereau);
    return e < 1 ? null : e;
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
