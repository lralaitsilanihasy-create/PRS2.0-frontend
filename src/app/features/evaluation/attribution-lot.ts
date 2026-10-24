import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob, validerFichier } from '../../core/securite/fichiers-surs';
import { Attribution, FichierAttribution, LotAttribution, PiecesAttributaire, TypePieceAttributaire, TypeRecours } from '../../models';
import { LIBELLES_PIECE_ATTRIBUTAIRE, LIBELLES_RECOURS, MENTION_NON_SUSPENSIF, MENTION_SUSPENSIF } from './libelles-evaluation';
import { AttributionService } from '../../services';
import { dateFr } from '../../core/interim/interim-libelles';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { ariary } from './libelles-evaluation';
import { TitulairesProposes } from './titulaires-proposes';
import { maintenantServeur } from '../../core/horloge/heure-serveur';

const MESSAGES: Readonly<Record<string, string>> = {
  AVIS_NON_RENDU: 'La Commission n’a pas encore rendu son avis sur le dossier de marché.',
  AVIS_DEFAVORABLE: 'L’avis de la Commission est défavorable : le marché ne s’attribue pas.',
  OFFRE_NON_PROPOSEE: 'Le marché s’attribue à l’offre proposée par la commission d’appel d’offres, et à elle seule.',
  LOT_INFRUCTUEUX: 'Ce lot est proposé infructueux.',
  DEJA_ATTRIBUE: 'Le lot est déjà attribué.',
  DATE_AFFICHAGE_OBLIGATOIRE: 'La date d’affichage du résultat au siège est obligatoire.',
  DATE_AFFICHAGE_INVALIDE: 'La date d’affichage se situe entre la date de l’attribution et aujourd’hui.',
  NON_ATTRIBUE: 'Le lot n’est pas encore attribué.',
  DEJA_INFORME: 'Les candidats sont déjà informés.',
  DEJA_REPONDU: 'Cette demande a déjà sa réponse.',
  TEXTE_OBLIGATOIRE: 'La réponse est obligatoire.',
  FORMAT_INVALIDE: 'Le fichier doit être un PDF, une image JPEG ou PNG.',
  RAPPORT_OBLIGATOIRE: 'Le rapport de mise au point est obligatoire.',
  DEJA_SIGNE: 'Le marché est déjà signé.',
  LOT_RETIRE: 'Le marché a été retiré.',
  // ⚠️ 2d-2 (V92) — la réattribution.
  NON_RETIRE: 'Le marché n’est pas retiré : rien à réattribuer.',
  AUCUN_SUIVANT_ELIGIBLE: 'Aucun candidat suivant n’est éligible : seule une déclaration sans suite reste possible.',
  OFFRE_EXPIREE: 'L’offre du candidat suivant n’est plus valide.',
  SANS_SUITE_EN_COURS: 'Une demande de déclaration sans suite attend l’avis de la Commission : la signature attend.',
  SANS_SUITE_DECLAREE: 'La procédure est déclarée sans suite : plus aucun geste d’attribution.',
  TYPE_INVALIDE: 'Le type de recours n’est pas valide.',
  CHAMP_OBLIGATOIRE: 'Tous les champs du recours sont obligatoires.',
  DATE_INVALIDE: 'La date n’est pas valide.',
  ISSUE_INVALIDE: 'L’issue de la décision n’est pas valide.',
  MOTIF_OBLIGATOIRE: 'Le motif est obligatoire.',
  DEJA_DECIDE: 'Ce recours a déjà sa décision.',
  CONFORME_OBLIGATOIRE: 'Dites si la pièce est conforme.',
  DEJA_VERIFIEE: 'Cette pièce est déjà vérifiée.',
  NON_INFORME: 'Les candidats ne sont pas encore informés.',
  PIECES_CONFORMES: 'Les deux pièces sont conformes : le marché ne se retire pas.',
  DELAI_EN_COURS: 'L’attributaire a encore le temps de déposer ses pièces : le retrait attend l’échéance.',
  DELAI_ATTENTE: 'Le délai d’attente de dix jours francs n’est pas écoulé : la signature n’est pas encore possible.',
  RECOURS_EN_COURS: 'Un recours suspensif est en cours : la signature attend sa décision (20 jours au plus).',
  PIECES_NON_CONFORMES: 'Les pièces fiscale et sociale de l’attributaire doivent être reconnues conformes avant la signature.',
  FICHIER_OBLIGATOIRE: 'Le fichier est obligatoire.',
  NON_SIGNE: 'Le marché n’est pas encore signé.',
  DEJA_ENREGISTRE: 'Le marché est déjà enregistré.',
  NON_ENREGISTRE: 'Aucune notification sans enregistrement (art. 54).',
  // ⚠️ R9a (V111, 14/10) — l'approbation du marché, avant la notification (art. 54).
  DEJA_APPROUVE: 'Le marché est déjà approuvé.',
  MARCHE_NON_APPROUVE: 'Aucune notification sans l’approbation du marché (art. 54).',
  CHAMP_TROP_LONG: 'Un champ dépasse la longueur admise.',
  // ⚠️ R10 (V113, 14/10) — l'original signé de l'acte d'engagement, en remise électronique.
  // ⚠️ R6c (V108, règle 7) — complété par la limite servie (`messagePieceTropAncienne`).
  PIECE_TROP_ANCIENNE: 'Cette pièce est trop ancienne pour être reconnue conforme : déclarez-la non conforme, avec un motif.',
  AE_ORIGINAL_MANQUANT: 'L’original signé de l’acte d’engagement doit être déposé et reconnu conforme avant la signature (offre déposée et scellée en ligne).',
  DEJA_NOTIFIE: 'Le marché est déjà notifié.',
  NON_NOTIFIE: 'Le marché n’est pas encore notifié.',
  DEJA_PUBLIE: 'L’avis d’attribution est déjà publié.',
  // ⚠️ MT-b1 et MT-b2 (V122, V123) — le contrat-cadre multi-attributaire.
  TITULAIRES_TROP_NOMBREUX: 'Le nombre de titulaires retenus dépasse le nombre maximal fixé dans la fiche (DAO).',
  TITULAIRE_OBLIGATOIRE: 'Désignez le titulaire concerné.',
  NON_TITULAIRE: 'Cette offre n’est pas titulaire du contrat-cadre.',
  REATTRIBUTION_EXCLUE_CONTRAT_CADRE: 'Un contrat-cadre ne se réattribue pas : une fois conclu, il n’est plus ouvert à de nouveaux opérateurs (décret n° 2019-1064, art. 18).',
};

/** ⚠️ MT-b1 et MT-b2 — les refus qui nomment des offres (`details.offres`) les citent quand ce sont des numéros. */
const AVEC_OFFRES = new Set(['OFFRE_NON_PROPOSEE', 'PIECES_NON_CONFORMES', 'AE_ORIGINAL_MANQUANT']);
export function offresEnDefaut(e: ApiError): string {
  const offres = corpsErreur<{ details?: { offres?: unknown } }>(e)?.details?.offres;
  const numeros = Array.isArray(offres) ? offres.filter((o): o is number => typeof o === 'number') : [];
  return numeros.length ? ` (offre${numeros.length > 1 ? 's' : ''} n° ${numeros.join(', ')})` : '';
}

const ISSUES: Readonly<Record<string, string>> = { REJETE: 'Rejeté', ACCUEILLI: 'Accueilli', AUTRE: 'Autre issue' };

/** ⚠️ R6c (V108, règle 7) — 400 `PIECE_TROP_ANCIENNE` à la vérification : `details { nature, dateDelivrance, limite, reference }`. */
export function messagePieceTropAncienne(e: ApiError): string {
  const d = corpsErreur<{ details?: { nature?: string; dateDelivrance?: string; limite?: string } }>(e)?.details ?? {};
  const jj = (iso?: string): string => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : '?'; };
  const quoi = d.nature === 'SOCIALE' ? 'La situation sociale' : d.nature === 'FISCALE' ? 'La situation fiscale' : 'La pièce';
  return `${quoi} est délivrée le ${jj(d.dateDelivrance)}, avant la limite du ${jj(d.limite)} : elle ne peut être reconnue conforme. Déclarez-la non conforme, avec un motif ; l’attributaire en déposera une plus récente.`;
}

/** Aujourd'hui, au format des champs de date (`AAAA-MM-JJ`), à l'heure locale. */
function aujourdhui(): string {
  const d = maintenantServeur();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * ⚠️ Attribution, tranches 2b et 2c (V80, V81) — le suivi d'un lot par la PRMP, de l'avis de la Commission à l'avis d'attribution :
 * attribuer à l'offre proposée (Q4) ; informer les candidats (lettres signées, date d'affichage, dix jours francs comptés depuis la plus
 * tardive de l'information et de l'affichage, art. 78) ; répondre aux explications (art. 52-II) ; la mise au point (art. 35-VIII) ;
 * les recours (titre VIII : réexamen non suspensif, révision ARMP et référé suspensifs, 20 jours au plus) ; les pièces fiscales et
 * sociales de l'attributaire (art. 20-I) et le retrait ; la signature, l'enregistrement (Q6), la notification (art. 54) et l'avis
 * d'attribution (art. 53). Chaque geste ne s'ouvre qu'à son tour ; le serveur reste l'autorité et nomme ses refus. Les autres lecteurs
 * (UGPM, responsable, commission) voient le même suivi sans geste.
 */
@Component({
  selector: 'app-attribution-lot',
  imports: [NgTemplateOutlet, TitulairesProposes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let l = lot();
    <div class="al">
      <!-- 1. Attribuer -->
      @if (l.attributaire; as a) {
        <section class="al__bloc al__fait" aria-label="Attribution">
          <h4 class="al__h4">Attribué</h4>
          @if (l.titulaires?.length) {
            <!-- ⚠️ MT-b1 (V122) — les titulaires retenus par la PRMP ; le motif d'une sélection partielle. -->
            <app-titulaires-proposes [titulaires]="l.titulaires" [retenus]="true" [lot]="l.lot" />
            <p class="text-sm">Le {{ dateHeure(a.le) }}{{ a.motif ? ' — ' + a.motif : '' }}</p>
          } @else {
            <p class="text-sm">Offre n° {{ a.numero }} · <strong>{{ a.candidat }}</strong>{{ a.nif ? ' (NIF ' + a.nif + ')' : '' }} — {{ ariary(a.montant) }} HT · délai {{ a.delai ?? '—' }} — le {{ dateHeure(a.le) }}</p>
          }
        </section>
      } @else if (l.dossierMarche?.avis === 'DEF') {
        <p class="text-sm al__alerte">Avis défavorable de la Commission : le marché ne s’attribue pas. La PRMP reprend l’évaluation ou déclare le lot infructueux (ci-dessous).</p>
      } @else if (prmp() && l.dossierMarche?.avis && l.proposition?.titulaires?.length && !l.proposition?.infructueux) {
        <!-- ⚠️ MT-b1 (V122, décret n° 2019-1064 art. 13-14) — la PRMP retient tout ou partie des titulaires proposés ; motif si une partie seulement. -->
        <section class="al__bloc" aria-label="Attribuer le contrat-cadre">
          <h4 class="al__h4">Attribuer le contrat-cadre</h4>
          <p class="text-sm">Retenez les titulaires parmi ceux que la commission d’appel d’offres propose (art. 13 du décret). Tous sont cochés : décochez ceux que vous ne retenez pas, avec un motif.</p>
          <fieldset class="al__choix">
            <legend class="sr-only">Titulaires retenus</legend>
            @for (t of l.proposition!.titulaires!; track t.idOffre) {
              <label class="text-sm"><input type="checkbox" [checked]="!exclus().has(t.idOffre)" (change)="basculer(t.idOffre)" />
                Rang {{ t.rang ?? '—' }} · offre n° {{ t.numero ?? '—' }} · <strong>{{ t.candidat }}</strong> — {{ ariary(t.montant) }} HT</label>
            }
          </fieldset>
          @if (exclus().size) {
            <label class="form-group"><span class="form-label">Motif de la sélection partielle</span><input class="form-control" type="text" [value]="champ('amotif')" (input)="poser('amotif', $any($event.target).value)" /></label>
          }
          <button type="button" class="btn btn-primary btn-sm al__btn" [disabled]="occupe() || !retenus(l).length || (exclus().size > 0 && !champ('amotif').trim())" (click)="attribuerTitulaires(l)">Attribuer à {{ retenus(l).length }} titulaire{{ retenus(l).length > 1 ? 's' : '' }}</button>
        </section>
      } @else if (prmp() && l.dossierMarche?.avis && l.proposition && !l.proposition.infructueux) {
        <section class="al__bloc" aria-label="Attribuer">
          <h4 class="al__h4">Attribuer le marché</h4>
          <p class="text-sm">À l’offre proposée par la commission d’appel d’offres : n° {{ l.proposition.numero }} · {{ l.proposition.candidat }} — {{ ariary(l.proposition.montant) }} HT. Elle seule peut être attribuée (art. 35-VII).</p>
          <button type="button" class="btn btn-primary btn-sm al__btn" [disabled]="occupe()" (click)="geste(service.attribuer(idDmc(), l.lot, null), 'Le marché est attribué : informez maintenant les candidats.')">Attribuer à l’offre proposée</button>
        </section>
      }

      <!-- 2. Informer -->
      @if (l.information; as inf) {
        <section class="al__bloc al__fait" aria-label="Information des candidats">
          <h4 class="al__h4">Candidats informés</h4>
          <p class="text-sm">Le {{ dateHeure(inf.le) }}{{ inf.signataire ? ', lettres signées électroniquement par ' + inf.signataire : '' }} · affichage au siège le {{ date(inf.dateAffichage) }}</p>
          <div class="cnm-table-wrap">
            <table class="cnm-table" aria-label="Lettres aux candidats">
              <thead><tr><th scope="col">Offre</th><th scope="col">Candidat</th><th scope="col">Lettre</th><th scope="col">Courriel</th><th scope="col">Lue sur la plateforme</th><th scope="col"><span class="sr-only">Ouvrir</span></th></tr></thead>
              <tbody>
                @for (x of inf.lettres; track x.id) {
                  <tr>
                    <td>n° {{ x.numero ?? '—' }}</td><td>{{ x.candidat }}</td>
                    <td>{{ x.type === 'ATTRIBUTION' ? 'Attribution' : 'Non retenue' }}</td>
                    <td class="text-sm">{{ x.envoyeeLe ? dateHeure(x.envoyeeLe) : 'sans adresse' }}</td>
                    <td class="text-sm">{{ x.lueLe ? dateHeure(x.lueLe) : 'pas encore' }}</td>
                    <td class="al__actions">
                      <button type="button" class="btn btn-outline btn-sm" [attr.aria-label]="'Lettre à ' + x.candidat + ' (PDF)'" (click)="ouvrir(service.lettre(idDmc(), l.lot, x.idOffre))">PDF</button>
                      <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Lettre à ' + x.candidat + ' (Word)'" (click)="enregistrer(service.lettre(idDmc(), l.lot, x.idOffre, 'docx'), 'lettre-' + idDmc() + '-' + x.numero + '.docx')">Word</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (l.delaiAttente; as d) {
            <p class="text-sm" [class.al__ok]="d.ecoule">
              <!-- ⚠️ R6c (V108, règle 6) — le départ est la réception présumée (envoi + n jours), ou l'affichage s'il est plus tardif. -->
              Délai d’attente : {{ d.jours }} jours francs à compter du {{ date(d.debut) }} ({{ d.receptionLe ? 'réception présumée de l’information le ' + date(d.receptionLe) + ', ' + d.joursReception + ' jour' + ((d.joursReception ?? 0) > 1 ? 's' : '') + ' après l’envoi, ou affichage s’il est plus tardif' : 'plus tardive de l’information et de l’affichage' }}) —
              @if (d.ecoule) { <strong>écoulé</strong> : la signature est possible depuis le {{ date(d.signableLe) }}. } @else { signature possible à partir du <strong>{{ date(d.signableLe) }}</strong>. }
            </p>
          }
        </section>
      } @else if (prmp() && l.attributaire) {
        <section class="al__bloc" aria-label="Informer les candidats">
          <h4 class="al__h4">Informer les candidats (art. 52)</h4>
          <p class="text-sm">Le serveur produit une lettre par offre évaluée, signée électroniquement par vous : l’attribution à l’attributaire ; aux autres, le rejet et ses motifs tirés du rapport, l’attributaire, le montant, le délai d’attente et le droit de demander des explications.</p>
          <div class="al__ligne">
            <label class="form-group"><span class="form-label">Date d’affichage du résultat au siège</span><input class="form-control" type="date" [value]="dateAffichage()" (input)="dateAffichage.set($any($event.target).value)" /></label>
            <button type="button" class="btn btn-primary btn-sm" [disabled]="!dateAffichage() || occupe()" (click)="geste(service.informer(idDmc(), l.lot, dateAffichage()), 'Les lettres sont signées et envoyées ; le délai d’attente court.')">Signer et envoyer les lettres</button>
          </div>
        </section>
      }

      <!-- 3. Explications (art. 52-II) -->
      @if (l.explications?.length) {
        <section class="al__bloc" aria-label="Demandes d'explication">
          <h4 class="al__h4">Demandes d’explication des candidats</h4>
          @for (e of l.explications; track e.id) {
            <div class="al__fil">
              <p class="text-sm"><strong>Offre n° {{ e.numero }} · {{ e.candidat }}</strong>, le {{ dateHeure(e.demandeeLe) }} : « {{ e.question }} »</p>
              @if (e.etat === 'REPONDUE') {
                <p class="text-sm">Réponse du {{ dateHeure(e.reponduLe) }} : {{ e.reponse }}</p>
                @if (e.reponseNom) { <button type="button" class="btn btn-ghost btn-sm al__btn" (click)="ouvrir(service.fichierExplication(idDmc(), e.id))">Pièce jointe : {{ e.reponseNom }}</button> }
              } @else if (prmp()) {
                <label class="form-group"><span class="form-label">Votre réponse écrite</span><textarea class="form-control" rows="2" [value]="champ('rep' + e.id)" (input)="poser('rep' + e.id, $any($event.target).value)"></textarea></label>
                <input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" [attr.aria-label]="'Pièce jointe à la réponse à l’offre n° ' + e.numero" (change)="choisir('rep' + e.id, $any($event.target))" />
                <button type="button" class="btn btn-outline btn-sm al__btn" [disabled]="!champ('rep' + e.id).trim() || occupe()" (click)="geste(service.repondreExplication(idDmc(), e.id, champ('rep' + e.id).trim(), fichier('rep' + e.id)), 'Votre réponse est envoyée au candidat.', true)">Répondre</button>
              } @else { <p class="text-sm text-muted">En attente de la réponse de la PRMP.</p> }
            </div>
          }
        </section>
      }

      @if (l.information) {
        <!-- 4. Recours (titre VIII) -->
        <section class="al__bloc" aria-label="Recours">
          <h4 class="al__h4">Recours</h4>
          @for (r of l.recours ?? []; track r.id) {
            <div class="al__fil" [class.al__bloque]="r.bloquant">
              <p class="text-sm"><strong>{{ libellesRecours[r.type] }}</strong></p>
              <p class="text-sm">{{ r.requerant }}, reçu le {{ date(r.dateReception) }} : {{ r.objet }}</p>
              @if (r.bloquant) { <p class="text-sm"><strong>Signature suspendue</strong> jusqu’à la décision, au plus tard le {{ date(r.finSuspension) }}.</p> }
              @if (r.echeanceReponse && !r.decision) { <p class="text-sm">Réponse de la PRMP attendue avant le {{ date(r.echeanceReponse) }}.</p> }
              @if (r.decision; as d) {
                <p class="text-sm">Décision du {{ date(d.date) }} : <strong>{{ issues[d.issue] }}</strong> — {{ d.motif }}</p>
              } @else if (prmp()) {
                <div class="al__ligne">
                  <label class="form-group"><span class="form-label">Date de la décision</span><input class="form-control" type="date" [value]="champ('dd' + r.id)" (input)="poser('dd' + r.id, $any($event.target).value)" /></label>
                  <label class="form-group"><span class="form-label">Issue</span>
                    <select class="form-control" (change)="poser('di' + r.id, $any($event.target).value)">
                      <option value="">—</option>
                      @for (i of codesIssues; track i) { <option [value]="i" [selected]="champ('di' + r.id) === i">{{ issues[i] }}</option> }
                    </select>
                  </label>
                  <label class="form-group al__large"><span class="form-label">Motif</span><input class="form-control" type="text" [value]="champ('dm' + r.id)" (input)="poser('dm' + r.id, $any($event.target).value)" /></label>
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="!champ('dd' + r.id) || !champ('di' + r.id) || !champ('dm' + r.id).trim() || occupe()" (click)="geste(service.deciderRecours(idDmc(), l.lot, r.id, { date: champ('dd' + r.id), issue: champ('di' + r.id), motif: champ('dm' + r.id).trim() }, null), 'La décision est enregistrée.')">Enregistrer la décision</button>
                </div>
              }
            </div>
          } @empty { <p class="text-sm text-muted">Aucun recours déclaré.</p> }
          @if (prmp() && !l.signature && !l.retrait) {
            <details class="al__details">
              <summary>Déclarer un recours reçu…</summary>
              <div class="al__form">
                <label class="form-group"><span class="form-label">Type</span>
                  <select class="form-control" (change)="poser('rtype', $any($event.target).value)">
                    <option value="">—</option>
                    @for (t of typesRecours; track t) { <option [value]="t" [selected]="champ('rtype') === t">{{ libelleTypeRecours(t) }}</option> }
                  </select>
                </label>
                <label class="form-group"><span class="form-label">Reçu le</span><input class="form-control" type="date" [value]="champ('rdate')" (input)="poser('rdate', $any($event.target).value)" /></label>
                <label class="form-group"><span class="form-label">Requérant</span><input class="form-control" type="text" [value]="champ('rqui')" (input)="poser('rqui', $any($event.target).value)" /></label>
                <label class="form-group al__large"><span class="form-label">Objet</span><input class="form-control" type="text" [value]="champ('robjet')" (input)="poser('robjet', $any($event.target).value)" /></label>
                <input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" aria-label="Pièce du recours" (change)="choisir('rfichier', $any($event.target))" />
                <button type="button" class="btn btn-outline btn-sm al__btn" [disabled]="!champ('rtype') || !champ('rdate') || !champ('rqui').trim() || !champ('robjet').trim() || occupe()" (click)="declarer()">Déclarer le recours</button>
              </div>
            </details>
          }
        </section>

        <!-- 5. Pièces fiscales et sociales de l'attributaire (art. 20-I) ; ⚠️ MT-b2 (V123) — de chaque titulaire du contrat-cadre. -->
        @if (multi()) {
          @for (t of l.suiviTitulaires ?? []; track t.idOffre) {
            <section class="al__bloc" [class.al__fait]="t.retrait" [attr.aria-label]="'Titulaire ' + (t.candidat ?? '')">
              <h4 class="al__h4">Titulaire — rang {{ t.rang ?? '—' }} · offre n° {{ t.numero ?? '—' }} · {{ t.candidat }}</h4>
              @if (t.retrait; as rt) {
                <p class="text-sm al__alerte">Retiré le {{ dateHeure(rt.le) }} : {{ rt.motif }}. Le contrat-cadre continue avec les autres titulaires.</p>
              } @else {
                @if (t.pieces; as pa) {
                  <ng-container *ngTemplateOutlet="piecesTpl; context: { $implicit: pa, t: t }" />
                } @else { <p class="text-sm text-muted">Aucune pièce attendue pour l’instant.</p> }
                @if (l.notification) {
                  <p class="text-sm">{{ t.notificationRecueLe ? 'Notification reçue le ' + dateHeure(t.notificationRecueLe) + '.' : 'Réception de la notification en attente : sa première lecture en fera foi.' }}</p>
                }
              }
            </section>
          }
        } @else if (l.piecesAttributaire; as pa) {
          <section class="al__bloc" aria-label="Pièces de l'attributaire">
            <h4 class="al__h4">Pièces de l’attributaire</h4>
            <ng-container *ngTemplateOutlet="piecesTpl; context: { $implicit: pa, t: null }" />
          </section>
        }
        <ng-template #piecesTpl let-pa let-t="t">
            <p class="text-sm">À déposer avant le <strong>{{ date(pa.echeance) }}</strong>{{ pa.delaiDepasse ? ' — échéance passée' : '' }} : situation fiscale de moins de six mois ({{ etatPiece(pa, 'FISCALE', pa.fiscaleConforme) }}), situation sociale de moins de trois mois ({{ etatPiece(pa, 'SOCIALE', pa.socialeConforme) }}).@if (pa.limiteFiscale || pa.limiteSociale) { Délivrées au plus tôt le {{ date(pa.limiteFiscale) }} (fiscale) et le {{ date(pa.limiteSociale) }} (sociale) : une pièce plus ancienne ne peut être reconnue conforme. }</p>
            <!-- ⚠️ R10 (V113, 14/10) — offre déposée et scellée en ligne : l'original signé de l'acte d'engagement, avant la signature. -->
            @if (pa.aeOriginalExige) {
              <p class="text-sm">Offre déposée et scellée en ligne : l’<strong>original signé de l’acte d’engagement</strong> est remis avant la signature du marché, sans l’échéance des quinze jours ({{ etatPiece(pa, 'ACTE_ENGAGEMENT_ORIGINAL', pa.aeOriginalConforme) }}).</p>
            }
            @for (p of pa.pieces; track p.id) {
              <div class="al__piece">
                <span class="text-sm">{{ libellePiece(p.type) }} · {{ p.type === 'ACTE_ENGAGEMENT_ORIGINAL' ? 'remis le' : 'délivrée le' }} {{ date(p.dateDelivrance) }} · déposée le {{ dateHeure(p.deposeLe) }}</span>
                <button type="button" class="btn btn-ghost btn-sm" (click)="ouvrir(service.fichier(idDmc(), p.id))">{{ p.nom }}</button>
                @if (p.conforme === true) { <span class="badge badge-success">Conforme</span> }
                @else if (p.conforme === false) { <span class="badge badge-danger">Non conforme — {{ p.motif }}</span> }
                @else if (prmp()) {
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="geste(service.verifierPiece(idDmc(), l.lot, p.id, true, null), 'La pièce est reconnue conforme.')">Conforme</button>
                  <input class="form-control form-control-sm al__motif" type="text" placeholder="Motif" [attr.aria-label]="'Motif de non-conformité de la pièce ' + p.nom" [value]="champ('pm' + p.id)" (input)="poser('pm' + p.id, $any($event.target).value)" />
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="!champ('pm' + p.id).trim() || occupe()" (click)="geste(service.verifierPiece(idDmc(), l.lot, p.id, false, champ('pm' + p.id).trim()), 'La pièce est déclarée non conforme ; le titulaire peut en déposer une autre avant l’échéance.')">Non conforme</button>
                } @else { <span class="badge badge-warning">À vérifier</span> }
              </div>
            } @empty { <p class="text-sm text-muted">Aucune pièce déposée.</p> }
            @if (prmp() && pa.aeOriginalExige && !pa.aeOriginalConforme && !l.signature && !l.retrait) {
              <!-- La PRMP qui a reçu l'original le dépose elle-même (scan), puis le vérifie comme une pièce ; en multi-attributaire, pour CE titulaire. -->
              <div class="al__ligne">
                <label class="form-group"><span class="form-label">Original reçu le (facultatif)</span><input class="form-control" type="date" [max]="aujourdhui" [value]="champ('aedate' + cle(t))" (input)="poser('aedate' + cle(t), $any($event.target).value)" /></label>
                <label class="form-group al__large"><span class="form-label">Scan de l’original signé (PDF, JPEG, PNG)</span><input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisir('aefichier' + cle(t), $any($event.target))" /></label>
                <button type="button" class="btn btn-outline btn-sm" [disabled]="!fichier('aefichier' + cle(t)) || occupe()" (click)="geste(service.deposerAeOriginal(idDmc(), l.lot, champ('aedate' + cle(t)) || null, fichier('aefichier' + cle(t))!, t?.idOffre ?? null), 'L’original est enregistré ; vérifiez-le pour ouvrir la signature.')">Enregistrer l’original reçu</button>
              </div>
            }
            @if (prmp() && pa.delaiDepasse && !(pa.fiscaleConforme && pa.socialeConforme) && !l.signature && !l.retrait) {
              <div class="al__ligne">
                <label class="form-group al__large"><span class="form-label">Motif du retrait (art. 20-I)</span><input class="form-control" type="text" [value]="champ('retrait' + cle(t))" (input)="poser('retrait' + cle(t), $any($event.target).value)" /></label>
                @if (t) {
                  <!-- ⚠️ MT-b2 (V123, réponse 2 du pilote) — un titulaire est retiré seul : le contrat-cadre continue avec les autres. -->
                  <button type="button" class="btn btn-danger btn-sm" [disabled]="!champ('retrait' + cle(t)).trim() || occupe()" (click)="geste(service.retirer(idDmc(), l.lot, champ('retrait' + cle(t)).trim(), t.idOffre), 'Le titulaire est retiré et notifié ; le contrat-cadre continue avec les autres.')">Retirer ce titulaire</button>
                } @else {
                  <button type="button" class="btn btn-danger btn-sm" [disabled]="!champ('retrait').trim() || occupe()" (click)="geste(service.retirer(idDmc(), l.lot, champ('retrait').trim()), 'Le marché est retiré ; l’attributaire est notifié.')">Retirer le marché</button>
                }
              </div>
            }
        </ng-template>
        @if (l.retrait; as rt) {
          <p class="text-sm al__alerte">Marché <strong>retiré</strong> le {{ dateHeure(rt.le) }} : {{ rt.motif }}.</p>
          @if (multi()) {
            <!-- ⚠️ MT-b1 (art. 18) — un contrat-cadre conclu n'est plus ouvert à de nouveaux opérateurs : pas de réattribution. -->
            <p class="text-sm text-muted">Un contrat-cadre ne se réattribue pas à un candidat non titulaire (décret n° 2019-1064, art. 18).</p>
          } @else if (prmp()) {
            <!-- ⚠️ 2d-2 (V92, Q8) — au candidat suivant : sa post-qualification (ou, en PI, sa négociation), offre encore valide, nouvelle information. -->
            <div class="al__ligne">
              <label class="form-group al__large"><span class="form-label">Motif de la réattribution</span><input class="form-control" type="text" [value]="champ('reattribution')" (input)="poser('reattribution', $any($event.target).value)" /></label>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="!champ('reattribution').trim() || occupe()" (click)="geste(service.reattribuer(idDmc(), l.lot, champ('reattribution').trim()), 'L’évaluation est rouverte pour le candidat suivant : nouveau rapport, nouveau dossier, nouvelle information.')">Réattribuer au candidat suivant</button>
            </div>
            <p class="text-sm text-muted">Le suivant passe sa post-qualification (en prestations intellectuelles : sa négociation) ; son offre doit être encore valide. Sans suivant éligible, seule une déclaration sans suite reste possible.</p>
          }
        }

        <!-- 6. Mise au point (art. 35-VIII) -->
        @if (l.miseAuPoint; as m) {
          <section class="al__bloc al__fait" aria-label="Mise au point"><h4 class="al__h4">Mise au point</h4><p class="text-sm">{{ m.rapport }}</p>
            @if (m.fichier) { <button type="button" class="btn btn-ghost btn-sm al__btn" (click)="ouvrirFichier(m.fichier)">{{ m.fichier.nom }}</button> }
          </section>
        }
        @if (prmp() && !l.signature && !l.retrait) {
          <details class="al__details">
            <summary>{{ l.miseAuPoint ? 'Refaire la mise au point…' : 'Mise au point avec l’attributaire (facultative)…' }}</summary>
            <div class="al__form">
              <label class="form-group al__large"><span class="form-label">Rapport de mise au point (sans remettre en cause les caractéristiques substantielles)</span><textarea class="form-control" rows="2" [value]="champ('map')" (input)="poser('map', $any($event.target).value)"></textarea></label>
              <input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" aria-label="Pièce de la mise au point" (change)="choisir('mapf', $any($event.target))" />
              <button type="button" class="btn btn-outline btn-sm al__btn" [disabled]="!champ('map').trim() || occupe()" (click)="geste(service.miseAuPoint(idDmc(), l.lot, champ('map').trim(), fichier('mapf')), 'La mise au point est enregistrée.')">Enregistrer la mise au point</button>
            </div>
          </details>
        }

        <!-- 7. Signature, 8. approbation et enregistrement (indépendants l'un de l'autre), 9. notification, 10. avis -->
        @if (l.signature; as sg) {
          <section class="al__bloc al__fait" aria-label="Signature"><h4 class="al__h4">Marché signé le {{ date(sg.dateSignature) }}</h4>
            @if (sg.fichier) { <button type="button" class="btn btn-ghost btn-sm al__btn" (click)="ouvrirFichier(sg.fichier)">{{ sg.fichier.nom }}</button> }
          </section>
        } @else if (prmp() && !l.retrait) {
          <section class="al__bloc" aria-label="Signer le marché">
            <h4 class="al__h4">Signer le marché</h4>
            @if (multi()) {
              <p class="text-sm text-muted">Le contrat-cadre est signé par vous et <strong>tous</strong> les titulaires non retirés (art. 15 du décret). Ouvert quand le délai d’attente est écoulé, sans recours suspensif, et les pièces de <strong>chaque</strong> titulaire reconnues conformes (et l’original de son acte d’engagement, s’il est exigé).</p>
            } @else {
              <p class="text-sm text-muted">Ouvert quand le délai d’attente est écoulé, sans recours suspensif, et les deux pièces de l’attributaire reconnues conformes{{ l.piecesAttributaire?.aeOriginalExige ? ', ainsi que l’original signé de son acte d’engagement' : '' }}.</p>
            }
            <div class="al__ligne">
              <label class="form-group"><span class="form-label">Date de signature</span><input class="form-control" type="date" [value]="champ('sdate')" (input)="poser('sdate', $any($event.target).value)" /></label>
              <label class="form-group al__large"><span class="form-label">Le marché signé (PDF, JPEG, PNG)</span><input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisir('sfichier', $any($event.target))" /></label>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="!champ('sdate') || !fichier('sfichier') || occupe()" (click)="geste(service.signer(idDmc(), l.lot, champ('sdate'), fichier('sfichier')!), 'Le marché signé est déposé ; approuvez-le et enregistrez-le avant de le notifier.')">Déposer le marché signé</button>
            </div>
          </section>
        }
        <!-- ⚠️ R9a (V111, 14/10) — l'approbation du marché par l'autorité compétente (art. 54) : sans elle, pas de notification. -->
        @if (l.approbation; as ap) {
          <section class="al__bloc al__fait" aria-label="Approbation"><h4 class="al__h4">Approuvé le {{ date(ap.date) }} — {{ ap.autorite }}</h4>
            @if (ap.fichier) { <button type="button" class="btn btn-ghost btn-sm al__btn" (click)="ouvrirFichier(ap.fichier)">{{ ap.fichier.nom }}</button> }
          </section>
        } @else if (prmp() && l.signature && !l.notification) {
          <section class="al__bloc" aria-label="Approbation">
            <h4 class="al__h4">Approbation du marché (art. 54)</h4>
            <p class="text-sm text-muted">Par l’autorité compétente, à une date comprise entre la signature et aujourd’hui ; la décision d’approbation est jointe.</p>
            <div class="al__ligne">
              <label class="form-group al__large"><span class="form-label">Autorité d’approbation</span><input class="form-control" type="text" maxlength="200" [value]="champ('aaut')" (input)="poser('aaut', $any($event.target).value)" /></label>
              <label class="form-group"><span class="form-label">Date d’approbation</span><input class="form-control" type="date" [min]="l.signature?.dateSignature ?? null" [max]="aujourdhui" [value]="champ('adate')" (input)="poser('adate', $any($event.target).value)" /></label>
              <label class="form-group al__large"><span class="form-label">Décision d’approbation (PDF, JPEG, PNG)</span><input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisir('afichier', $any($event.target))" /></label>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="!champ('aaut').trim() || !champ('adate') || !fichier('afichier') || occupe()" (click)="geste(service.approuver(idDmc(), l.lot, champ('aaut').trim(), champ('adate'), fichier('afichier')!), 'Le marché est approuvé.')">Déclarer l’approbation</button>
            </div>
          </section>
        }
        @if (l.signature) {
          @if (l.enregistrement; as en) {
            <section class="al__bloc al__fait" aria-label="Enregistrement"><h4 class="al__h4">Enregistré le {{ date(en.date) }}{{ en.reference ? ' — ' + en.reference : '' }}</h4>
              @if (en.fichier) { <button type="button" class="btn btn-ghost btn-sm al__btn" (click)="ouvrirFichier(en.fichier)">{{ en.fichier.nom }}</button> }
            </section>
          } @else if (prmp()) {
            <section class="al__bloc" aria-label="Enregistrement">
              <h4 class="al__h4">Enregistrement (art. 54)</h4>
              <div class="al__ligne">
                <label class="form-group"><span class="form-label">Date d’enregistrement</span><input class="form-control" type="date" [value]="champ('edate')" (input)="poser('edate', $any($event.target).value)" /></label>
                <label class="form-group"><span class="form-label">Référence (facultative)</span><input class="form-control" type="text" [value]="champ('eref')" (input)="poser('eref', $any($event.target).value)" /></label>
                <label class="form-group al__large"><span class="form-label">Justificatif (quittance)</span><input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisir('efichier', $any($event.target))" /></label>
                <button type="button" class="btn btn-primary btn-sm" [disabled]="!champ('edate') || !fichier('efichier') || occupe()" (click)="geste(service.enregistrer(idDmc(), l.lot, champ('edate'), champ('eref').trim() || null, fichier('efichier')!), 'L’enregistrement est déclaré ; le marché peut être notifié.')">Déclarer l’enregistrement</button>
              </div>
            </section>
          }
        }
        @if (l.notification || (l.enregistrement && l.approbation)) {
          @if (l.notification; as nt) {
            <section class="al__bloc al__fait" aria-label="Notification">
              <h4 class="al__h4">Notifié le {{ date(nt.date) }}</h4>
              @if (multi()) {
                <p class="text-sm">Notifié à chaque titulaire non retiré : la réception de chacun se lit dans son suivi, ci-dessus.</p>
              } @else {
              <p class="text-sm">{{ nt.recueLe ? 'Reçu par l’attributaire le ' + dateHeure(nt.recueLe) + (nt.receptionDeclaree ? ' (réception déclarée)' : ' (accusé de lecture de la plateforme)') + ' : le marché prend effet à cette date.' : 'Réception en attente : la première lecture du marché par l’attributaire en fera foi.' }}</p>
              }
            </section>
          } @else if (prmp()) {
            <section class="al__bloc" aria-label="Notification">
              <h4 class="al__h4">Notifier le marché (art. 54)</h4>
              <div class="al__ligne">
                <label class="form-group"><span class="form-label">Date de notification</span><input class="form-control" type="date" [value]="champ('ndate')" (input)="poser('ndate', $any($event.target).value)" /></label>
                <label class="form-group"><span class="form-label">Date de réception (si connue)</span><input class="form-control" type="date" [value]="champ('nrec')" (input)="poser('nrec', $any($event.target).value)" /></label>
                <button type="button" class="btn btn-primary btn-sm" [disabled]="!champ('ndate') || occupe()" (click)="geste(service.notifier(idDmc(), l.lot, champ('ndate'), champ('nrec') || null), 'Le marché est notifié à l’attributaire.')">Notifier</button>
              </div>
            </section>
          }
        } @else if (prmp() && l.signature && !l.retrait) {
          <p class="text-sm text-muted">La notification s’ouvre quand le marché est <strong>approuvé</strong> et <strong>enregistré</strong> (art. 54){{ manqueNotification(l) }}.</p>
        }
        @if (l.avisAttribution; as av) {
          <section class="al__bloc" [class.al__fait]="av.publieLe" aria-label="Avis d'attribution">
            <h4 class="al__h4">Avis d’attribution (art. 53)</h4>
            @if (av.publieLe) {
              <p class="text-sm">Publié le {{ date(av.datePublication) }} — échéance du {{ date(av.echeance) }}.@if (av.enRetard) { <span class="badge badge-warning">Publié après l’échéance</span> }</p>
              <div class="al__actions">
                <button type="button" class="btn btn-outline btn-sm" (click)="ouvrir(service.avis(idDmc(), l.lot))">Avis (PDF)</button>
                <button type="button" class="btn btn-ghost btn-sm" (click)="enregistrer(service.avis(idDmc(), l.lot, 'docx'), 'avis-attribution-' + idDmc() + '-lot' + l.lot + '.docx')">Word</button>
              </div>
            } @else {
              <!-- ⚠️ R6c (V108, règle 8) — 30 jours depuis la réception de la notification par le titulaire ; non bloquant. -->
              <p class="text-sm">À publier avant le <strong>{{ date(av.echeance) }}</strong> (30 jours après {{ av.depart ? 'la réception de la notification par le titulaire, le ' + date(av.depart) : 'la notification' }}).@if (av.enRetard) { <span class="badge badge-danger">En retard</span> }</p>
              @if (prmp()) {
                <div class="al__ligne">
                  <label class="form-group"><span class="form-label">Date de publication</span><input class="form-control" type="date" [value]="champ('apub')" (input)="poser('apub', $any($event.target).value)" /></label>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="!champ('apub') || occupe()" (click)="geste(service.publierAvis(idDmc(), l.lot, champ('apub')), 'L’avis d’attribution est signé et publié sur la procédure.')">Signer et publier l’avis</button>
                </div>
              }
            }
          </section>
        }
      }
      @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
    </div>
  `,
  styles: `
    .al { display: flex; flex-direction: column; gap: 0.5rem; }
    .al__bloc { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.5rem 0.7rem; border-left: 3px solid var(--p-600); background: var(--n-100); }
    .al__fait { border-left-color: var(--n-300); }
    .al__h4 { margin: 0; font-size: 0.9rem; }
    .al__bloc p, .al__fil p { margin: 0; }
    .al__btn { align-self: flex-start; }
    .al__ligne { display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap; }
    .al__large { flex: 1 1 18rem; }
    .al__form { display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.4rem; }
    .al__fil { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.4rem 0; border-top: 1px solid var(--n-200); }
    .al__bloque { border-left: 3px solid var(--warning-text); padding-left: 0.5rem; }
    .al__piece { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .al__motif { max-width: 14rem; }
    .al__choix { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
    .al__choix label { display: flex; gap: 0.4rem; align-items: baseline; }
    .al__actions { display: flex; gap: 0.3rem; }
    .al__alerte { margin: 0; color: var(--warning-text); }
    .al__ok { color: var(--success-text); }
    .al__details summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
  `,
})
export class AttributionLot {
  readonly idDmc = input.required<number>();
  readonly lot = input.required<LotAttribution>();
  /** La PRMP de la fiche : seule à agir sur l'attribution (l'UGPM lit). */
  readonly prmp = input(false);
  /** ⚠️ R9a (V111) — les recours qui suspendent la signature, selon le réglage du moment ; nul : non lu (la liste n'en dit rien). */
  readonly recoursSuspensifs = input<TypeRecours[] | null>(null);
  readonly maj = output<Attribution | null>();

  readonly service = inject(AttributionService);
  private readonly toast = inject(ToastService);

  readonly ariary = ariary;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;
  readonly libellesRecours = LIBELLES_RECOURS;
  readonly libellesPieces = LIBELLES_PIECE_ATTRIBUTAIRE;
  readonly typesRecours = Object.keys(LIBELLES_RECOURS) as TypeRecours[];

  /** Le type à déclarer, avec son effet sur la signature d'après le réglage de l'Administrateur (R9a). */
  libelleTypeRecours(t: TypeRecours): string {
    const s = this.recoursSuspensifs();
    return s ? `${LIBELLES_RECOURS[t]} — ${s.includes(t) ? MENTION_SUSPENSIF : MENTION_NON_SUSPENSIF}` : LIBELLES_RECOURS[t];
  }
  readonly issues = ISSUES;
  readonly codesIssues = Object.keys(ISSUES);

  readonly occupe = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly dateAffichage = signal(aujourdhui());
  /** Borne haute des dates de geste (approbation). */
  readonly aujourdhui = aujourdhui();

  /** Ce qui manque encore à la notification (R9a) : l'approbation, l'enregistrement, ou les deux. */
  manqueNotification(l: LotAttribution): string {
    const manque = [!l.approbation ? 'l’approbation' : null, !l.enregistrement ? 'l’enregistrement' : null].filter(Boolean);
    return manque.length ? ` — il manque ${manque.join(' et ')}` : '';
  }
  private readonly champs = signal<Record<string, string>>({});
  private readonly fichiers = signal<Record<string, File | null>>({});
  readonly etatLot = computed(() => this.lot().etat);

  /** ⚠️ MT-b1 et MT-b2 — un contrat-cadre multi-attributaire, une fois attribué : titulaires retenus et leur suivi. */
  readonly multi = computed(() => (this.lot().titulaires?.length ?? 0) > 0 || (this.lot().suiviTitulaires?.length ?? 0) > 0);
  /** Les titulaires proposés que la PRMP décoche (non retenus) ; aucun par défaut : tous sont retenus. */
  readonly exclus = signal<ReadonlySet<string>>(new Set());

  basculer(idOffre: string): void {
    this.exclus.update((x) => {
      const n = new Set(x);
      if (n.has(idOffre)) n.delete(idOffre); else n.add(idOffre);
      return n;
    });
  }

  retenus(l: LotAttribution): string[] {
    return (l.proposition?.titulaires ?? []).map((t) => t.idOffre).filter((id) => !this.exclus().has(id));
  }

  /** Tous retenus : le corps n'en nomme aucun (le serveur les retient tous) ; une partie : leur liste et le motif. */
  attribuerTitulaires(l: LotAttribution): void {
    const partiel = this.exclus().size > 0;
    const n = this.retenus(l).length;
    this.geste(
      this.service.attribuer(this.idDmc(), l.lot, partiel ? this.champ('amotif').trim() : null, partiel ? this.retenus(l) : null),
      `Le contrat-cadre est attribué à ${n} titulaire${n > 1 ? 's' : ''} : informez maintenant les candidats.`,
    );
  }

  /** Le suffixe des champs d'un titulaire (MT-b2) ; vide pour l'attributaire unique. */
  cle(t: { idOffre: string } | null | undefined): string {
    return t ? '-' + t.idOffre : '';
  }

  libellePiece(type: string): string {
    return LIBELLES_PIECE_ATTRIBUTAIRE[type as TypePieceAttributaire] ?? type;
  }

  champ(cle: string): string {
    return this.champs()[cle] ?? '';
  }

  poser(cle: string, valeur: string): void {
    this.champs.update((c) => ({ ...c, [cle]: valeur }));
  }

  fichier(cle: string): File | null {
    return this.fichiers()[cle] ?? null;
  }

  choisir(cle: string, champ: HTMLInputElement): void {
    const f = champ.files?.[0] ?? null;
    const erreur = f ? validerFichier(f) : null;
    if (erreur) {
      champ.value = '';
      this.erreur.set(erreur);
    }
    this.fichiers.update((x) => ({ ...x, [cle]: erreur ? null : f }));
  }

  /**
   * L'état d'une pièce, lu sur le dernier dépôt de ce type : le serveur répond `false` aussi quand rien n'est déposé (constaté en
   * recette le 14/10 sur l'original de l'AE), et « non conforme » ne se dit que d'une pièce vérifiée et refusée.
   */
  etatPiece(pa: PiecesAttributaire, type: TypePieceAttributaire, conforme: boolean | null | undefined): string {
    const derniere = pa.pieces.filter((p) => p.type === type).at(-1);
    if (!derniere) return 'à déposer';
    if (conforme === true || derniere.conforme === true) return 'conforme';
    return derniere.conforme === false ? 'non conforme' : 'à vérifier';
  }

  declarer(): void {
    const corps = { type: this.champ('rtype'), dateReception: this.champ('rdate'), requerant: this.champ('rqui').trim(), objet: this.champ('robjet').trim() };
    this.geste(this.service.declarerRecours(this.idDmc(), this.lot().lot, corps, this.fichier('rfichier')), 'Le recours est déclaré.');
  }

  /**
   * Un geste qui rend l'attribution à jour (ou, pour une réponse à une explication, l'explication seule : le parent relit alors
   * l'attribution). Les champs saisis sont vidés après un succès.
   */
  geste(appel: Observable<unknown>, succes: string, relire = false): void {
    this.occupe.set(true);
    this.erreur.set(null);
    appel.subscribe({
      next: (r) => {
        this.occupe.set(false);
        this.champs.set({});
        this.fichiers.set({});
        this.exclus.set(new Set());
        this.toast.success(succes);
        this.maj.emit(relire ? null : (r as Attribution));
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        if (codeErreur(e) === 'PIECE_TROP_ANCIENNE') { this.erreur.set(messagePieceTropAncienne(e)); return; }
        const code = codeErreur(e) ?? '';
        if (MESSAGES[code] && AVEC_OFFRES.has(code) && offresEnDefaut(e)) { this.erreur.set(MESSAGES[code].replace(/\.$/, '') + offresEnDefaut(e) + '.'); return; }
        this.erreur.set(MESSAGES[code] ?? (e.status === 413 ? 'Le fichier dépasse la taille admise.' : e.message || 'Le geste n’a pas abouti.'));
      },
    });
  }

  ouvrir(appel: Observable<Blob>): void {
    appel.subscribe({ next: (b) => ouvrirBlobSur(b), error: (e: ApiError) => this.erreur.set(e.status === 404 ? 'Le document n’est pas encore disponible.' : e.message) });
  }

  ouvrirFichier(f: FichierAttribution): void {
    this.ouvrir(this.service.fichier(this.idDmc(), f.id));
  }

  enregistrer(appel: Observable<Blob>, nom: string): void {
    appel.subscribe({ next: (b) => telechargerBlob(b, nom), error: (e: ApiError) => this.erreur.set(e.message) });
  }
}
