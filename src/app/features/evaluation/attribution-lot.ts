import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob, validerFichier } from '../../core/securite/fichiers-surs';
import { Attribution, FichierAttribution, LotAttribution, TypeRecours } from '../../models';
import { AttributionService } from '../../services';
import { dateFr } from '../../core/interim/interim-libelles';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { ariary } from './libelles-evaluation';

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
  DEJA_NOTIFIE: 'Le marché est déjà notifié.',
  NON_NOTIFIE: 'Le marché n’est pas encore notifié.',
  DEJA_PUBLIE: 'L’avis d’attribution est déjà publié.',
};

export const LIBELLES_RECOURS: Readonly<Record<TypeRecours, string>> = {
  REEXAMEN: 'Demande de réexamen auprès de la PRMP (art. 79) — non suspensive, réponse sous 10 jours',
  REVISION_ARMP: 'Demande en révision auprès de l’ARMP (art. 80) — suspend la signature, 20 jours au plus',
  REFERE: 'Référé précontractuel (art. 78) — suspend la signature, 20 jours au plus',
};
const ISSUES: Readonly<Record<string, string>> = { REJETE: 'Rejeté', ACCUEILLI: 'Accueilli', AUTRE: 'Autre issue' };

/** Aujourd'hui, au format des champs de date (`AAAA-MM-JJ`), à l'heure locale. */
function aujourdhui(): string {
  const d = new Date();
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let l = lot();
    <div class="al">
      <!-- 1. Attribuer -->
      @if (l.attributaire; as a) {
        <section class="al__bloc al__fait" aria-label="Attribution">
          <h4 class="al__h4">Attribué</h4>
          <p class="text-sm">Offre n° {{ a.numero }} · <strong>{{ a.candidat }}</strong>{{ a.nif ? ' (NIF ' + a.nif + ')' : '' }} — {{ ariary(a.montant) }} HT · délai {{ a.delai ?? '—' }} — le {{ dateHeure(a.le) }}</p>
        </section>
      } @else if (l.dossierMarche?.avis === 'DEF') {
        <p class="text-sm al__alerte">Avis défavorable de la Commission : le marché ne s’attribue pas. La reprise de l’évaluation ou l’infructuosité se décident en tranche suivante.</p>
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
              Délai d’attente : {{ d.jours }} jours francs à compter du {{ date(d.debut) }} (plus tardive de l’information et de l’affichage) —
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
                    @for (t of typesRecours; track t) { <option [value]="t" [selected]="champ('rtype') === t">{{ libellesRecours[t] }}</option> }
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

        <!-- 5. Pièces fiscales et sociales de l'attributaire (art. 20-I) -->
        @if (l.piecesAttributaire; as pa) {
          <section class="al__bloc" aria-label="Pièces de l'attributaire">
            <h4 class="al__h4">Pièces fiscales et sociales de l’attributaire</h4>
            <p class="text-sm">À déposer avant le <strong>{{ date(pa.echeance) }}</strong>{{ pa.delaiDepasse ? ' — échéance passée' : '' }} : situation fiscale de moins de six mois ({{ etatPiece(pa.fiscaleConforme) }}), situation sociale de moins de trois mois ({{ etatPiece(pa.socialeConforme) }}).</p>
            @for (p of pa.pieces; track p.id) {
              <div class="al__piece">
                <span class="text-sm">{{ p.type === 'FISCALE' ? 'Fiscale' : 'Sociale' }} · délivrée le {{ date(p.dateDelivrance) }} · déposée le {{ dateHeure(p.deposeLe) }}</span>
                <button type="button" class="btn btn-ghost btn-sm" (click)="ouvrir(service.fichier(idDmc(), p.id))">{{ p.nom }}</button>
                @if (p.conforme === true) { <span class="badge badge-success">Conforme</span> }
                @else if (p.conforme === false) { <span class="badge badge-danger">Non conforme — {{ p.motif }}</span> }
                @else if (prmp()) {
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="geste(service.verifierPiece(idDmc(), l.lot, p.id, true, null), 'La pièce est reconnue conforme.')">Conforme</button>
                  <input class="form-control form-control-sm al__motif" type="text" placeholder="Motif" [attr.aria-label]="'Motif de non-conformité de la pièce ' + p.nom" [value]="champ('pm' + p.id)" (input)="poser('pm' + p.id, $any($event.target).value)" />
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="!champ('pm' + p.id).trim() || occupe()" (click)="geste(service.verifierPiece(idDmc(), l.lot, p.id, false, champ('pm' + p.id).trim()), 'La pièce est déclarée non conforme ; l’attributaire peut en déposer une autre avant l’échéance.')">Non conforme</button>
                } @else { <span class="badge badge-warning">À vérifier</span> }
              </div>
            } @empty { <p class="text-sm text-muted">Aucune pièce déposée.</p> }
            @if (prmp() && pa.delaiDepasse && !(pa.fiscaleConforme && pa.socialeConforme) && !l.signature && !l.retrait) {
              <div class="al__ligne">
                <label class="form-group al__large"><span class="form-label">Motif du retrait (art. 20-I)</span><input class="form-control" type="text" [value]="champ('retrait')" (input)="poser('retrait', $any($event.target).value)" /></label>
                <button type="button" class="btn btn-danger btn-sm" [disabled]="!champ('retrait').trim() || occupe()" (click)="geste(service.retirer(idDmc(), l.lot, champ('retrait').trim()), 'Le marché est retiré ; l’attributaire est notifié.')">Retirer le marché</button>
              </div>
            }
          </section>
        }
        @if (l.retrait; as rt) { <p class="text-sm al__alerte">Marché <strong>retiré</strong> le {{ dateHeure(rt.le) }} : {{ rt.motif }}. La réattribution au candidat suivant vient en tranche suivante.</p> }

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

        <!-- 7. Signature, 8. enregistrement, 9. notification, 10. avis -->
        @if (l.signature; as sg) {
          <section class="al__bloc al__fait" aria-label="Signature"><h4 class="al__h4">Marché signé le {{ date(sg.dateSignature) }}</h4>
            @if (sg.fichier) { <button type="button" class="btn btn-ghost btn-sm al__btn" (click)="ouvrirFichier(sg.fichier)">{{ sg.fichier.nom }}</button> }
          </section>
        } @else if (prmp() && !l.retrait) {
          <section class="al__bloc" aria-label="Signer le marché">
            <h4 class="al__h4">Signer le marché</h4>
            <p class="text-sm text-muted">Ouvert quand le délai d’attente est écoulé, sans recours suspensif, et les deux pièces de l’attributaire reconnues conformes.</p>
            <div class="al__ligne">
              <label class="form-group"><span class="form-label">Date de signature</span><input class="form-control" type="date" [value]="champ('sdate')" (input)="poser('sdate', $any($event.target).value)" /></label>
              <label class="form-group al__large"><span class="form-label">Le marché signé (PDF, JPEG, PNG)</span><input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisir('sfichier', $any($event.target))" /></label>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="!champ('sdate') || !fichier('sfichier') || occupe()" (click)="geste(service.signer(idDmc(), l.lot, champ('sdate'), fichier('sfichier')!), 'Le marché signé est déposé ; enregistrez-le avant de le notifier.')">Déposer le marché signé</button>
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
        @if (l.enregistrement) {
          @if (l.notification; as nt) {
            <section class="al__bloc al__fait" aria-label="Notification">
              <h4 class="al__h4">Notifié le {{ date(nt.date) }}</h4>
              <p class="text-sm">{{ nt.recueLe ? 'Reçu par l’attributaire le ' + dateHeure(nt.recueLe) + (nt.receptionDeclaree ? ' (réception déclarée)' : ' (accusé de lecture de la plateforme)') + ' : le marché prend effet à cette date.' : 'Réception en attente : la première lecture du marché par l’attributaire en fera foi.' }}</p>
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
        }
        @if (l.avisAttribution; as av) {
          <section class="al__bloc" [class.al__fait]="av.publieLe" aria-label="Avis d'attribution">
            <h4 class="al__h4">Avis d’attribution (art. 53)</h4>
            @if (av.publieLe) {
              <p class="text-sm">Publié le {{ date(av.datePublication) }} — échéance du {{ date(av.echeance) }}.</p>
              <div class="al__actions">
                <button type="button" class="btn btn-outline btn-sm" (click)="ouvrir(service.avis(idDmc(), l.lot))">Avis (PDF)</button>
                <button type="button" class="btn btn-ghost btn-sm" (click)="enregistrer(service.avis(idDmc(), l.lot, 'docx'), 'avis-attribution-' + idDmc() + '-lot' + l.lot + '.docx')">Word</button>
              </div>
            } @else {
              <p class="text-sm">À publier avant le <strong>{{ date(av.echeance) }}</strong> (30 jours après la notification).</p>
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
  readonly maj = output<Attribution | null>();

  readonly service = inject(AttributionService);
  private readonly toast = inject(ToastService);

  readonly ariary = ariary;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;
  readonly libellesRecours = LIBELLES_RECOURS;
  readonly typesRecours = Object.keys(LIBELLES_RECOURS) as TypeRecours[];
  readonly issues = ISSUES;
  readonly codesIssues = Object.keys(ISSUES);

  readonly occupe = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly dateAffichage = signal(aujourdhui());
  private readonly champs = signal<Record<string, string>>({});
  private readonly fichiers = signal<Record<string, File | null>>({});
  readonly etatLot = computed(() => this.lot().etat);

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

  etatPiece(c: boolean | null): string {
    return c === true ? 'conforme' : c === false ? 'non conforme' : 'à déposer ou à vérifier';
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
        this.toast.success(succes);
        this.maj.emit(relire ? null : (r as Attribution));
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.erreur.set(MESSAGES[codeErreur(e) ?? ''] ?? (e.status === 413 ? 'Le fichier dépasse la taille admise.' : e.message || 'Le geste n’a pas abouti.'));
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
