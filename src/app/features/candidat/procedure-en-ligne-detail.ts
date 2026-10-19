import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { DocumentProcedureEnLigne, ProcedureEnLigne, RecuDao } from '../../models';
import { OffresCandidatService, ProceduresEnLigneService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { Icone } from '../../shared/ui/icone';
import { FraisDossier } from './frais-dossier';
import { ResultatsPublics } from './resultats-publics';
import { QuestionsProcedureVue } from './questions-procedure';
import { LIBELLES_CATEGORIES } from '../prmp/fiche-marche/fiche-marche-modele';
import { LIBELLES_ETAT_PROCEDURE, dateHeureFr, tailleLisible } from './libelles-candidat';
import { LIBELLES_ETAT_ETAPE, OffreDeposee, etapesParcours, grouperDocuments, jalons, offresDeposees, tempsRestant } from './procedure-en-ligne-modele';

/**
 * Le détail d'une procédure ouverte en ligne (`GET /api/procedures-en-ligne/{idDmc}`, public, §B8) : calendrier, lots,
 * règles de la remise électronique — tout est lu sur la fiche validée, aucun paramètre interne. Le dossier d'appel
 * d'offres se retire **connecté** : chaque téléchargement inscrit une ligne au registre de la PRMP (compte, entreprise,
 * document, version), et l'écran le dit avant le clic. Hors critères, le serveur répond 404 sans dire lequel manque.
 */
@Component({
  selector: 'app-procedure-en-ligne-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, FraisDossier, ResultatsPublics, QuestionsProcedureVue, Icone],
  template: `
    <nav class="ped__ariane" aria-label="Fil d'Ariane">
      <a routerLink="/candidat/procedures">Procédures ouvertes</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{{ procedure()?.objet || procedure()?.reference || 'Procédure' }}</span>
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
      <!-- ⚠️ 18/10 (pilote) — l'en-tête : l'objet d'abord, la date limite mise en avant avec le temps qui reste. -->
      <header class="card ped__tete">
        <div class="ped__tete-texte">
          <p class="ped__ref">
            <span class="cnm-mono">{{ p.reference || ('procédure ' + p.idDmc) }}</span>
            <span class="badge" [class.badge-success]="p.etat === 'OUVERTE'" [class.badge-warning]="p.etat === 'A_VENIR'" [class.badge-neutral]="p.etat === 'CLOSE'">{{ etats[p.etat] }}</span>
          </p>
          <h1 class="ped__titre">{{ p.objet || 'Objet non renseigné' }}</h1>
          <p class="ped__sous">
            @if (p.autoriteContractante) { <span><app-icone nom="board" [taille]="14" />{{ p.autoriteContractante }}</span> }
            @if (p.categorie) { <span><app-icone nom="layers" [taille]="14" />{{ categories[p.categorie] }}</span> }
            <span><app-icone nom="columns" [taille]="14" />{{ p.lots.length > 1 ? p.lots.length + ' lots' : 'Lot unique' }}</span>
          </p>
        </div>
        <div class="ped__echeance" [class.ped__echeance--close]="p.etat === 'CLOSE'">
          <span class="ped__echeance-lib">Date limite de remise</span>
          <strong class="ped__echeance-date">{{ p.dateLimite ? dateHeure(p.dateLimite) : '—' }}</strong>
          <span class="ped__echeance-reste">{{ p.etat === 'CLOSE' ? 'Les dépôts sont clos.' : (reste() ?? '') }}</span>
        </div>
      </header>

      <!-- Le parcours du candidat : chaque étape dit son état et mène à sa section. -->
      @if (p.etat !== 'CLOSE') {
        <section class="ped__parcours" aria-labelledby="ped-parcours">
          <h2 id="ped-parcours" class="ped__h2 ped__parcours-titre"><app-icone nom="board" [taille]="16" />Votre parcours</h2>
          <ol class="ped__etapes">
            @for (e of etapes(); track e.cle; let i = $index) {
              <li>
                <button type="button" class="ped__etape" [attr.data-etat]="e.etat" (click)="allerA(e.cible)">
                  <span class="ped__etape-n" aria-hidden="true">@if (e.etat === 'fait') { <app-icone nom="check" [taille]="14" /> } @else { {{ i + 1 }} }</span>
                  <span class="ped__etape-corps">
                    <span class="ped__etape-titre">{{ e.titre }}</span>
                    <span class="ped__etape-detail">{{ e.detail }}</span>
                  </span>
                  <span class="ped__etape-etat">{{ etatsEtape[e.etat] }}</span>
                </button>
              </li>
            }
          </ol>
          @if (!connecte()) {
            <p class="ped__invite"><app-icone nom="key" [taille]="15" />Pour retirer le dossier, poser une question ou déposer une offre, <a routerLink="/login" [queryParams]="{ returnUrl: lienRetour() }">connectez-vous</a> ou <a routerLink="/candidat/inscription">créez un compte candidat</a>.</p>
          }
        </section>
      }

      <div class="ped__corps">
        <div class="ped__principal">
          @if (p.etat === 'CLOSE') {
            <!-- Recette du 05/10 : le PV publié n'était lisible nulle part à l'écran. -->
            <section class="card ped__bloc" aria-labelledby="ped-pv">
              <h2 id="ped-pv" class="ped__h2"><app-icone nom="file" [taille]="16" />Procès-verbal d'ouverture des plis</h2>
              <p class="text-sm">Quand la fiche le prévoit, un extrait du procès-verbal d'ouverture est publié ici après sa signature par la commission.</p>
              @if (pvAbsent()) {
                <p class="text-sm text-muted" role="status">Le procès-verbal d'ouverture n'est pas publié pour cette procédure.</p>
              } @else {
                <p><button type="button" class="btn btn-secondary btn-sm" [disabled]="pvEnCours()" (click)="lirePv(p.idDmc)">{{ pvEnCours() ? 'Ouverture…' : 'Lire le PV d’ouverture (PDF)' }}</button></p>
              }
            </section>
            <!-- ⚠️ 07/10 (attribution) — le résultat par lot, puis l'avis d'attribution publié (art. 53). -->
            <app-resultats-publics [idDmc]="p.idDmc" />
          }

          @if (p.retraitPayant) {
            <!-- V72 (06/10, voie B) : le dossier se retire après validation du reçu des frais de dossier. -->
            <section class="card ped__bloc" id="ped-frais" aria-labelledby="ped-frais-t">
              <h2 id="ped-frais-t" class="ped__h2"><app-icone nom="hash" [taille]="16" />Frais de dossier</h2>
              @if (connecte()) {
                <app-frais-dossier [procedure]="p" [(recu)]="recu" />
              } @else {
                <p class="text-sm">Le dossier est payant. Pour déposer votre reçu de paiement, <a routerLink="/login" [queryParams]="{ returnUrl: lienRetour() }">connectez-vous</a> avec votre compte candidat.</p>
              }
            </section>
          }

          <section class="card ped__bloc" id="ped-docs" aria-labelledby="ped-docs-t">
            <h2 id="ped-docs-t" class="ped__h2"><app-icone nom="download" [taille]="16" />Dossier d'appel d'offres</h2>
            @if (!connecte()) {
              <p class="text-sm">Le dossier se retire avec un compte candidat. <a routerLink="/login" [queryParams]="{ returnUrl: lienRetour() }">Connectez-vous</a> ou <a routerLink="/candidat/inscription">créez un compte</a>.</p>
            } @else if (docsChargement()) {
              <p class="text-muted" role="status">Chargement des documents…</p>
            } @else if (docsErreur()) {
              <app-etat-erreur message="Les documents n'ont pas pu être listés." (reessayer)="chargerDocuments()" />
            } @else if (!documents().length) {
              <p class="text-muted">Aucun document n'est encore disponible pour cette procédure.</p>
            } @else {
              @if (!retraitAutorise()) {
                <p class="ped__verrou" role="status">
                  <app-icone nom="key" [taille]="15" />
                  <span>Les documents se retirent dès que votre reçu des frais de dossier est validé.</span>
                  <button type="button" class="btn btn-sm btn-outline" (click)="allerA('ped-frais')">Aller aux frais de dossier</button>
                </p>
              }
              <ul class="ped__docs">
                @for (g of groupes(); track g.intitule) {
                  <li class="ped__doc">
                    <span class="ped__doc-icone" aria-hidden="true"><app-icone nom="file" [taille]="18" /></span>
                    <span class="ped__doc-nom">{{ g.intitule }}<span class="ped__doc-version">version {{ g.formats[0].document.version }}</span></span>
                    <span class="ped__doc-formats">
                      @for (f of g.formats; track f.document.code) {
                        <button type="button" class="btn btn-sm" [class.btn-primary]="f.format === 'PDF'" [class.btn-outline]="f.format !== 'PDF'"
                          [disabled]="enCours() === f.document.code || !retraitAutorise()"
                          [attr.aria-label]="'Retirer « ' + g.intitule + ' » en ' + f.format"
                          [attr.title]="f.document.code"
                          (click)="retirer(f.document)">
                          <app-icone nom="download" [taille]="14" />{{ enCours() === f.document.code ? 'Retrait…' : f.format }}{{ f.document.taille != null ? ' · ' + taille(f.document.taille) : '' }}
                        </button>
                      }
                    </span>
                  </li>
                }
              </ul>
              <p class="text-xs text-muted">Chaque retrait est inscrit au registre de la personne responsable des marchés, avec votre compte et votre entreprise.</p>
            }
          </section>

          <!-- ⚠️ R7 (V109) — les questions des candidats jusqu'à J−10 ; réponses diffusées, anonymisées. -->
          <app-questions-procedure [idDmc]="idDmc" [connecte]="connecte()" [lienRetour]="lienRetour()" />
        </div>

        <aside class="ped__cote" aria-label="Informations de la procédure">
          <section class="card ped__bloc" aria-labelledby="ped-cal">
            <h2 id="ped-cal" class="ped__h2"><app-icone nom="calendar" [taille]="16" />Calendrier</h2>
            <ol class="ped__frise">
              @for (j of frise(); track j.libelle) {
                <li [class.ped__jalon--passe]="j.passe" [class.ped__jalon--fort]="j.fort">
                  <span class="ped__jalon-lib">{{ j.libelle }}</span>
                  <span class="ped__jalon-date">{{ j.date }}</span>
                </li>
              }
            </ol>
            @if (p.heureReference) { <p class="text-xs text-muted">Heure qui fait foi : {{ p.heureReference }}.</p> }
          </section>

          <section class="card ped__bloc" id="ped-remise" aria-labelledby="ped-remise-t">
            <h2 id="ped-remise-t" class="ped__h2"><app-icone nom="shield" [taille]="16" />Remise électronique</h2>
            <dl class="ped__dl">
              <dt>Signature exigée</dt><dd>{{ p.signatureExigee || 'Simple' }}</dd>
              <dt>Formats acceptés</dt><dd>{{ p.formatsAcceptes?.length ? p.formatsAcceptes!.join(', ') : '—' }}</dd>
              <dt>Par fichier</dt><dd>{{ p.tailleMaxFichierMo != null ? p.tailleMaxFichierMo + ' Mo au plus' : '—' }}</dd>
              <dt>Par offre</dt><dd>{{ p.tailleMaxOffreMo != null ? p.tailleMaxOffreMo + ' Mo au plus' : '—' }}</dd>
            </dl>
            <!-- ⚠️ Lot 3 (V68) — le dépôt : ouvert entre l'ouverture des dépôts et la date limite, à l'heure du serveur. -->
            <!-- ⚠️ 19/10 (pilote) — une offre déjà déposée : le bouton « Déposer » menait à un formulaire que le serveur refuse à la fin
                 (409 OFFRE_EXISTANTE). L'écran dit le dépôt et propose de le remplacer. Marché alloti ou proposition PI : inchangé. -->
            @if (deposeUnique(); as d) {
              <p class="ped__depose" role="status"><app-icone nom="check" [taille]="15" />Votre offre est déposée le {{ dateHeure(d.dateDepot) }}{{ d.numero ? ', sous le n° ' + d.numero : '' }}.</p>
              <div class="ped__depose-actions">
                @if (p.depotsOuverts && p.remplacementAutorise !== false) {
                  <a class="btn btn-sm btn-primary" [routerLink]="['/candidat', 'procedures', p.idDmc, 'offre']" [queryParams]="{ remplace: d.idOffre }">Remplacer mon offre</a>
                }
                <a class="btn btn-sm btn-outline" routerLink="/candidat/offres">Mes offres</a>
              </div>
              @if (p.depotsOuverts && p.remplacementAutorise !== false) {
                <span class="text-sm text-muted">Vous pouvez la remplacer jusqu’au <strong>{{ p.dateLimite ? dateHeure(p.dateLimite) : '—' }}</strong> (heure du serveur) ; un remplacement inachevé à cette heure n’est pas reçu, et l’offre précédente reste celle qui sera ouverte. Une seule offre par entreprise : la remplacer annule la précédente.</span>
              } @else {
                <span class="text-sm text-muted">Une seule offre par entreprise.</span>
              }
            } @else if (p.depotsOuverts && connecte() && !retraitAutorise()) {
              <!-- 06/10 (décision A) : dossier payant, le dépôt attend le reçu validé. -->
              <button type="button" class="btn btn-primary ped__deposer" disabled>Déposer une offre</button>
              <span class="text-sm text-muted">Le dépôt s’ouvre dès que votre reçu de paiement des frais de dossier est validé.</span>
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
              <p class="ped__note">
                <app-icone nom="clock" [taille]="14" />
                @if (p.etat === 'CLOSE') { La date limite est passée : les dépôts sont clos. }
                @else if (p.dateOuvertureDepots) { Les dépôts ouvrent le {{ dateHeure(p.dateOuvertureDepots) }}. }
                @else { Les dépôts ne sont pas encore ouverts. }
              </p>
            }
          </section>

          @if (p.lots.length > 1) {
            <section class="card ped__bloc" aria-labelledby="ped-lots">
              <h2 id="ped-lots" class="ped__h2"><app-icone nom="columns" [taille]="16" />Lots</h2>
              <ol class="ped__lots">
                @for (l of p.lots; track l.numero) { <li><span class="ped__lot-n">Lot {{ l.numero }}</span> {{ l.intitule || '' }}</li> }
              </ol>
            </section>
          }

          @if (p.assistance) {
            <section class="card ped__bloc ped__assist" aria-labelledby="ped-assist">
              <h2 id="ped-assist" class="ped__h2"><app-icone nom="message" [taille]="16" />Assistance aux candidats</h2>
              <p class="text-sm">{{ p.assistance }}</p>
            </section>
          }
        </aside>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .ped__ariane { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); margin-bottom: 0.75rem; flex-wrap: wrap; }
    .ped__ariane a { color: var(--p-700); font-weight: 600; }

    /* En-tête */
    .ped__tete { display: grid; grid-template-columns: 1fr auto; gap: 1.25rem; align-items: center; padding: 1.25rem 1.4rem; margin-bottom: 1rem;
      border-top: 4px solid var(--p-600); }
    .ped__ref { margin: 0 0 0.35rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); color: var(--n-500); }
    .ped__titre { margin: 0; font-size: 1.55rem; line-height: 1.25; color: var(--n-800); }
    .ped__sous { margin: 0.5rem 0 0; display: flex; gap: 0.4rem 1.1rem; flex-wrap: wrap; color: var(--n-500); font-size: var(--text-sm); }
    .ped__sous span { display: inline-flex; gap: 0.35rem; align-items: center; }
    .ped__echeance { display: flex; flex-direction: column; align-items: flex-end; gap: 0.15rem; padding: 0.8rem 1.1rem; border-radius: var(--radius-md);
      background: var(--p-100); color: var(--p-800); text-align: right; min-width: 14rem; }
    .ped__echeance--close { background: var(--n-100); color: var(--n-600); }
    .ped__echeance-lib { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
    .ped__echeance-date { font-size: 1.2rem; }
    .ped__echeance-reste { font-size: var(--text-sm); }

    /* Parcours */
    .ped__parcours { margin-bottom: 1rem; }
    .ped__h2.ped__parcours-titre { margin-bottom: 0.55rem; }
    .ped__etapes { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: 0.6rem; }
    .ped__etape { width: 100%; height: 100%; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; gap: 0.15rem 0.65rem; text-align: left;
      padding: 0.75rem 0.85rem; border: 1px solid var(--n-200); border-radius: var(--radius-md); background: #fff; font: inherit; color: inherit; cursor: pointer;
      box-shadow: var(--shadow-sm); transition: border-color .15s, box-shadow .15s; }
    .ped__etape:hover, .ped__etape:focus-visible { border-color: var(--p-400); box-shadow: var(--shadow-md); }
    .ped__etape-n { grid-row: 1 / 3; width: 1.8rem; height: 1.8rem; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: var(--text-sm);
      background: var(--n-100); color: var(--n-600); }
    .ped__etape-corps { display: flex; flex-direction: column; gap: 0.1rem; }
    .ped__etape-titre { font-weight: 700; font-size: var(--text-sm); color: var(--n-800); }
    .ped__etape-detail { font-size: var(--text-xs); color: var(--n-500); }
    .ped__etape-etat { grid-column: 2; justify-self: start; margin-top: 0.3rem; font-size: var(--text-xs); font-weight: 700; padding: 0.05rem 0.5rem;
      border-radius: var(--radius-full); background: var(--n-100); color: var(--n-600); }
    .ped__etape[data-etat='fait'] .ped__etape-n, .ped__etape[data-etat='fait'] .ped__etape-etat { background: #d1fae5; color: #065f46; }
    .ped__etape[data-etat='a-faire'] { border-color: var(--p-300); }
    .ped__etape[data-etat='a-faire'] .ped__etape-n { background: var(--p-600); color: #fff; }
    .ped__etape[data-etat='a-faire'] .ped__etape-etat { background: var(--p-100); color: var(--p-800); }
    .ped__etape[data-etat='en-cours'] .ped__etape-n, .ped__etape[data-etat='en-cours'] .ped__etape-etat { background: #fef3c7; color: #92400e; }
    .ped__invite { margin: 0.6rem 0 0; display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); color: var(--n-600); }
    .ped__invite a { font-weight: 600; }

    /* Corps : deux colonnes */
    .ped__corps { display: grid; grid-template-columns: minmax(0, 1fr) minmax(17rem, 22rem); gap: 1rem; align-items: start; }
    .ped__principal, .ped__cote { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    .ped__cote { position: sticky; top: 1rem; }
    .ped__bloc { padding: 1rem 1.15rem; display: flex; flex-direction: column; gap: 0.6rem; scroll-margin-top: 1rem; }
    .ped__h2 { margin: 0; display: flex; gap: 0.45rem; align-items: center; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-600); }
    .ped__h2 app-icone { color: var(--p-600); }
    .ped__h2:focus { outline: none; }
    .ped__dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 0.9rem; font-size: var(--text-sm); }
    .ped__dl dt { color: var(--n-500); }
    .ped__dl dd { margin: 0; font-weight: 600; color: var(--n-700); }
    .ped__note { margin: 0; display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-600); background: var(--n-100);
      padding: 0.5rem 0.65rem; border-radius: var(--radius-md); }
    .ped__deposer { align-self: flex-start; }
    .ped__depose { margin: 0; display: flex; gap: 0.4rem; align-items: center; padding: 0.5rem 0.65rem; border-radius: var(--radius-md); background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: var(--text-sm); font-weight: 600; }
    .ped__depose-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }

    /* Frise du calendrier */
    .ped__frise { list-style: none; margin: 0 0 0 0.4rem; padding: 0 0 0 1.1rem; display: flex; flex-direction: column; gap: 0.75rem; border-left: 2px solid var(--p-200); }
    .ped__frise li { position: relative; display: flex; flex-direction: column; }
    .ped__frise li::before { content: ''; position: absolute; left: calc(-1.1rem - 6px); top: 0.3rem; width: 10px; height: 10px; border-radius: 50%;
      background: #fff; border: 2px solid var(--p-400); }
    .ped__frise li.ped__jalon--passe::before { background: var(--p-600); border-color: var(--p-600); }
    .ped__frise li.ped__jalon--fort::before { border-color: var(--p-700); }
    .ped__jalon-lib { font-size: var(--text-xs); color: var(--n-500); }
    .ped__jalon-date { font-size: var(--text-sm); font-weight: 600; color: var(--n-700); }
    .ped__jalon--fort .ped__jalon-date { color: var(--p-800); font-weight: 700; }

    /* Documents */
    .ped__verrou { margin: 0; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; padding: 0.6rem 0.75rem; border-radius: var(--radius-md);
      background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: var(--text-sm); }
    .ped__verrou span { flex: 1 1 14rem; }
    .ped__docs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .ped__doc { display: grid; grid-template-columns: auto 1fr auto; gap: 0.75rem; align-items: center; padding: 0.65rem 0.8rem; border: 1px solid var(--n-200);
      border-radius: var(--radius-md); background: var(--n-100); }
    .ped__doc-icone { width: 2.2rem; height: 2.2rem; border-radius: var(--radius-md); display: grid; place-items: center; background: #fff; color: var(--p-600); }
    .ped__doc-nom { font-weight: 600; color: var(--n-800); display: flex; flex-direction: column; }
    .ped__doc-version { font-weight: 400; font-size: var(--text-xs); color: var(--n-500); }
    .ped__doc-formats { display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: flex-end; }
    .ped__doc-formats .btn { display: inline-flex; gap: 0.35rem; align-items: center; }

    .ped__lots { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--text-sm); }
    .ped__lot-n { font-weight: 700; margin-right: 0.3rem; }
    .ped__assist p { margin: 0; white-space: pre-line; }

    @media (max-width: 960px) {
      .ped__corps { grid-template-columns: 1fr; }
      .ped__cote { position: static; }
    }
    @media (max-width: 640px) {
      .ped__tete { grid-template-columns: 1fr; }
      .ped__echeance { align-items: flex-start; text-align: left; min-width: 0; }
      .ped__doc { grid-template-columns: auto 1fr; }
      .ped__doc-formats { grid-column: 1 / -1; justify-content: flex-start; }
      .ped__dl { grid-template-columns: 1fr; }
    }
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
  private readonly offres = inject(OffresCandidatService);
  /** ⚠️ 19/10 (pilote) — l'offre déposée de l'entreprise sur cette procédure, lue sur « Mes offres » (connecté seulement). */
  readonly depose = signal<OffreDeposee | null>(null);
  /** Le dépôt affiché à la place du bouton : marché non alloti, hors proposition PI à deux enveloppes. */
  readonly deposeUnique = computed(() => {
    const p = this.procedure();
    return p && p.lots.length <= 1 && p.categorie !== 'PRESTATIONS_INTELLECTUELLES' ? this.depose() : null;
  });

  // ⚠️ 18/10 (pilote) — la présentation : parcours en étapes, documents regroupés par intitulé, frise, temps restant.
  readonly etatsEtape = LIBELLES_ETAT_ETAPE;
  readonly etapes = computed(() => {
    const p = this.procedure();
    return p ? etapesParcours(p, this.recu(), this.connecte(), this.depose()) : [];
  });
  readonly groupes = computed(() => grouperDocuments(this.documents()));
  readonly frise = computed(() => {
    const p = this.procedure();
    return p ? jalons(p) : [];
  });
  readonly reste = computed(() => tempsRestant(this.procedure()?.dateLimite));

  /** Mène à la section qui porte le geste de l'étape, et y pose le focus (clavier, lecteur d'écran). */
  allerA(id: string): void {
    const el = this.document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const titre = el.matches('h2') ? el : el.querySelector('h2');
    if (titre instanceof HTMLElement) {
      titre.setAttribute('tabindex', '-1');
      titre.focus({ preventScroll: true });
    }
  }

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
        if (this.connecte()) {
          this.chargerDocuments();
          this.offres.liste().subscribe({ next: (l) => this.depose.set(offresDeposees(l, this.idDmc)[0] ?? null), error: () => this.depose.set(null) });
        }
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
