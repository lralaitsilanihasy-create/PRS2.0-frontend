import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Attribution, Evaluation, LotAttribution, LotEvaluation, OffreEvaluee, QualiteSignataire, Seance, SignataireAttendu, libelleEtatOffre } from '../../../models';
import { statutDossierLabel } from '../../../shared/circuit/circuit-workflow';
import { horodatage, jjmmaaaa } from '../../../shared/prmp/avis-specifique-modele';
import { LIBELLES_ANORMALE, LIBELLES_ETAPE, LIBELLES_ETAT_EVALUATION, ariary } from '../../evaluation/libelles-evaluation';
import { TitulairesProposes } from '../../evaluation/titulaires-proposes';
import { QuorumCaoVue } from '../../procedure/quorum-cao';

/**
 * ⚠️ Manuel révisé, R4 (13/10) — les vues **dédiées** des trois écrans figés que la Commission lit le plus : la séance d'ouverture,
 * l'évaluation et l'attribution. Elles rendent le JSON figé (le DTO de lecture tel qu'il était servi à la soumission) en lecture
 * seule, sans aucun geste ni appel : un écran figé ne propose rien, il se lit.
 * ⚠️ 20/10 (pilote, « améliorer toutes les interfaces ») — même présentation que la ligne du plan, l'avis et la CAO : un en-tête qui dit
 * l'essentiel en chiffres, des blocs, des repères de couleur, tout en clair (plus de codes bruts) ; ce qui trompe une fois la séance
 * close est retiré (les parts, effacées après le déchiffrement, ne se comptent plus).
 */

const LIBELLES_ETAT_SEANCE: Readonly<Record<string, string>> = {
  A_VENIR: 'À venir',
  OUVERTE: 'Ouverte — les parts arrivent',
  DECHIFFREE: 'Offres ouvertes',
  PV_A_SIGNER: 'PV à signer par les membres présents',
  ILLISIBLE: 'Offres illisibles (constat)',
  CLOSE: 'Close — PV signé',
};

/** L'état d'une offre à la séance : son intégrité une fois ouverte, sinon son état de dépôt. */
const LIBELLES_OFFRE_SEANCE: Readonly<Record<string, { libelle: string; ton: 'ok' | 'ko' | 'neutre' }>> = {
  INTACTE: { libelle: 'Ouverte — intacte', ton: 'ok' },
  ALTEREE: { libelle: 'Ouverte — altérée', ton: 'ko' },
  LECTURE_IMPOSSIBLE: { libelle: 'Lecture impossible', ton: 'ko' },
  REMPLACEE: { libelle: 'Remplacée par une offre ultérieure — non ouverte', ton: 'neutre' },
  RETIREE: { libelle: 'Retirée par le candidat — non ouverte', ton: 'neutre' },
  DEPOSEE: { libelle: 'Déposée', ton: 'neutre' },
};
export function etatOffreSeance(etat: string): { libelle: string; ton: 'ok' | 'ko' | 'neutre' } {
  return LIBELLES_OFFRE_SEANCE[etat] ?? { libelle: libelleEtatOffre(etat), ton: 'neutre' };
}

export const LIBELLES_ETAT_ATTRIBUTION: Readonly<Record<string, string>> = {
  EN_EVALUATION: 'Évaluation en cours',
  PROPOSE: 'Proposition du rapport — dossier de marché à créer',
  AU_CONTROLE: 'Au contrôle de la Commission',
  AVIS_RENDU: 'Avis de la Commission rendu',
  ATTRIBUE: 'Attribué',
  INFORME: 'Candidats informés',
  SIGNABLE: "Signable — délai d'attente écoulé",
  SIGNE: 'Marché signé',
  NOTIFIE: 'Marché notifié',
  PUBLIE: "Avis d'attribution publié",
  RETIRE: 'Attribution retirée',
  INFRUCTUEUX: 'Déclaré infructueux',
};

const LIBELLES_AVIS: Readonly<Record<string, string>> = { FAV: 'favorable', FAVR: 'favorable avec réserves', DEF: 'défavorable' };

const LIBELLES_QUALITE: Readonly<Record<QualiteSignataire, string>> = { PRESIDENT: 'Président', REPRESENTANT: 'Représentant du président', MEMBRE: 'Membre' };

/** Une signature posée (PV d'ouverture, rapport) : les deux DTO partagent ces champs. */
interface SignaturePosee {
  im: string;
  nom: string;
  president: boolean;
  date?: string | null;
  empechement: boolean;
  motif: string | null;
  constatePar: string | null;
}

export interface LigneSignature {
  nom: string;
  qualite: string;
  etat: string;
}

/**
 * Les signataires attendus (R1, V101) croisés avec les signatures posées ; sans liste d'attendus (PV antérieur à V101), les
 * signatures seules. Pure, pour les tests.
 */
export function lignesSignatures(attendus: readonly SignataireAttendu[] | null | undefined, signatures: readonly SignaturePosee[] | null | undefined): LigneSignature[] {
  const posees = signatures ?? [];
  const etatDe = (s: SignaturePosee | undefined): string => {
    if (!s) return 'en attente';
    if (s.empechement) return `empêchement constaté${s.motif ? ' — ' + s.motif : ''}${s.constatePar ? ' (par ' + s.constatePar + ')' : ''}`;
    return `signé le ${horodatage(s.date)}`;
  };
  if (attendus?.length) {
    return attendus.map((a) => ({ nom: a.nom, qualite: a.qualite ? LIBELLES_QUALITE[a.qualite] : 'Membre', etat: etatDe(posees.find((s) => s.im === a.im)) }));
  }
  return posees.map((s) => ({ nom: s.nom, qualite: s.president ? 'Président' : 'Membre', etat: etatDe(s) }));
}

/** Les décisions d'une offre, en clair, avec leur ton (pour la couleur). */
export function decisionsOffre(o: OffreEvaluee): { conformite: string; conformiteKo: boolean; anormale: string; anormaleKo: boolean; qualification: string; qualificationKo: boolean } {
  const c = o.conformite;
  const a = o.anormale;
  const q = o.qualification;
  return {
    conformite: !c?.decision ? '—' : c.decision === 'CONFORME' ? 'Conforme' : `Écartée${c.motif ? ' — ' + c.motif : ''}`,
    conformiteKo: c?.decision === 'ECARTEE',
    anormale: !a ? '—' : a.decision ? ((LIBELLES_ANORMALE as Record<string, string>)[a.decision] ?? a.decision) : a.suspectee ? 'Suspectée' : 'Non suspectée',
    anormaleKo: a?.decision === 'REJETEE',
    qualification: !q?.decision ? '—' : q.decision === 'QUALIFIE' ? 'Qualifiée' : `Non qualifiée${q.motif ? ' — ' + q.motif : ''}`,
    qualificationKo: q?.decision === 'NON_QUALIFIE',
  };
}

@Component({
  selector: 'app-instantane-seance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QuorumCaoVue],
  template: `
    @let s = seance();
    <section class="iv">
      <div class="iv__tete">
        <p class="iv__sur">La séance d'ouverture des plis</p>
        <h3 class="iv__objet">{{ etat(s.etat) }}</h3>
        <div class="iv__chiffres">
          <div class="iv__chiffre"><span class="iv__chiffre-l">Ouverte le</span><span class="iv__chiffre-v">{{ s.ouverteLe ? horodatage(s.ouverteLe) : '—' }}</span></div>
          <div class="iv__chiffre"><span class="iv__chiffre-l">Offres déchiffrées le</span><span class="iv__chiffre-v">{{ s.dechiffreeLe ? horodatage(s.dechiffreeLe) : '—' }}</span></div>
          <div class="iv__chiffre"><span class="iv__chiffre-l">Offres ouvertes</span><span class="iv__chiffre-v">{{ ouvertes() }} sur {{ s.offres.length }}</span></div>
          <div class="iv__chiffre"><span class="iv__chiffre-l">Clés requises</span><span class="iv__chiffre-v">{{ s.quorum }}{{ s.secoursEmploye ? ' · secours employé' : '' }}</span></div>
        </div>
        @if (s.heureOuverture) { <p class="iv__note">Heure d'ouverture fixée : {{ horodatage(s.heureOuverture) }}.</p> }
        @if (s.secoursDemande; as d) { <p class="iv__note">Part de secours demandée le {{ horodatage(d.date) }} — motif : {{ d.motif }}.</p> }
      </div>

      <div class="iv__bloc">
        <h4 class="iv__titre">Membres de la commission <span class="iv__compte">{{ s.membres.length }}</span></h4>
        <ul class="iv__membres">
          @for (m of s.membres; track m.im) {
            <li><span class="iv__nom">{{ m.nom }}</span><span class="iv__qualite">{{ m.president ? 'Président' : 'Membre' }} · <span [class.iv__ok]="m.present" [class.iv__ko]="!m.present">{{ m.present ? 'présent' : 'absent' }}</span></span></li>
          }
        </ul>
        @if (s.autres.length) { <p class="iv__note">Autres présents : {{ autres() }}</p> }
        @if (s.etat === 'OUVERTE') { <p class="iv__note">Parts apportées : {{ partsApportees() }} sur {{ s.membres.length }}.</p> }
      </div>

      <div class="iv__bloc">
        <h4 class="iv__titre">Offres reçues <span class="iv__compte">{{ s.offres.length }}</span></h4>
        @if (s.offres.length) {
          <ul class="iv__offres">
            @for (o of s.offres; track $index) {
              @let e = etatOffre(o.etat);
              <li class="iv__offre" [class.iv__offre--ok]="e.ton === 'ok'" [class.iv__offre--ko]="e.ton === 'ko'">
                <span class="iv__offre-n">n° {{ o.numero ?? '—' }}{{ o.lot ? ' · lot ' + o.lot : '' }}</span>
                <span class="iv__offre-e">{{ e.libelle }}</span>
              </li>
            }
          </ul>
        } @else { <p class="iv__vide">Aucune offre déposée : la séance conduit à un PV de carence.</p> }
      </div>

      @if (s.pv; as pv) {
        <div class="iv__bloc">
          <h4 class="iv__titre">Procès-verbal d'ouverture</h4>
          <div class="iv__etapes">
            <span class="iv__etape" [class.iv__etape--fait]="pv.produit">{{ pv.produit ? '✓' : '·' }} Produit</span>
            <span class="iv__etape" [class.iv__etape--fait]="pv.publie">{{ pv.publie ? '✓' : '·' }} Publié aux soumissionnaires</span>
            <span class="iv__etape" [class.iv__etape--fait]="!!pv.signe">{{ pv.signe ? '✓' : '·' }} {{ pv.signe ? 'Signé' + (pv.signeLe ? ' le ' + horodatage(pv.signeLe) : '') : 'Non signé' }}</span>
          </div>
          @if (signatures().length) {
            <ul class="iv__signatures">
              @for (l of signatures(); track $index) {
                <li><span class="iv__nom">{{ l.nom }}</span><span class="iv__qualite">{{ l.qualite }}</span><span class="iv__sig" [class.iv__attente]="l.etat === 'en attente'">{{ l.etat }}</span></li>
              }
            </ul>
          }
          <app-quorum-cao [quorum]="pv.quorum" />
        </div>
      }
    </section>
  `,
  styleUrl: './instantanes-procedure.scss',
})
export class InstantaneSeanceVue {
  readonly seance = input.required<Seance>();
  readonly horodatage = horodatage;
  readonly etat = (e: string): string => LIBELLES_ETAT_SEANCE[e] ?? e;
  readonly etatOffre = etatOffreSeance;
  readonly ouvertes = computed(() => this.seance().offres.filter((o) => ['INTACTE', 'ALTEREE', 'LECTURE_IMPOSSIBLE'].includes(o.etat)).length);
  readonly partsApportees = computed(() => this.seance().membres.filter((m) => m.partsApportees).length);
  readonly autres = computed(() => this.seance().autres.map((a) => (a.qualite ? `${a.nom} (${a.qualite})` : a.nom)).join(', '));
  readonly signatures = computed(() => lignesSignatures(this.seance().pv?.signaturesAttendues, this.seance().pv?.signatures));
}

@Component({
  selector: 'app-instantane-evaluation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QuorumCaoVue, TitulairesProposes],
  template: `
    @let ev = evaluation();
    <section class="iv">
      <div class="iv__tete">
        <p class="iv__sur">L'évaluation des offres</p>
        <h3 class="iv__objet">{{ etat(ev.etat) }}</h3>
        <div class="iv__chiffres">
          <div class="iv__chiffre"><span class="iv__chiffre-l">Ouverte le</span><span class="iv__chiffre-v">{{ horodatage(ev.ouverteLe) }}</span></div>
          @if (ev.ouvertePar) { <div class="iv__chiffre"><span class="iv__chiffre-l">Par</span><span class="iv__chiffre-v">{{ ev.ouvertePar }}</span></div> }
          <div class="iv__chiffre"><span class="iv__chiffre-l">Offres évaluées</span><span class="iv__chiffre-v">{{ nbOffres() }}</span></div>
          @if (ev.rapport?.signe) { <div class="iv__chiffre"><span class="iv__chiffre-l">Rapport validé le</span><span class="iv__chiffre-v">{{ horodatage(ev.rapport!.signeLe) }}</span></div> }
        </div>
      </div>

      <div class="iv__bloc">
        <h4 class="iv__titre">Déclarations des membres <span class="iv__compte">{{ ev.declarations.length }}</span></h4>
        <ul class="iv__membres">
          @for (d of ev.declarations; track d.membre) {
            <li>
              <span class="iv__nom">{{ d.nom }}{{ d.president ? ' — président' : '' }}</span>
              <span class="iv__qualite">
                @if (!d.signeeLe) { <span class="iv__attente">non signée</span> }
                @else if (d.conflit) { <span class="iv__ko">conflit déclaré{{ d.precision ? ' — ' + d.precision : '' }}</span> }
                @else { <span class="iv__ok">aucun conflit</span> · {{ horodatage(d.signeeLe) }} }
              </span>
            </li>
          }
        </ul>
      </div>

      @for (l of ev.lots; track l.lot) {
        <div class="iv__bloc">
          <h4 class="iv__titre">Lot {{ l.lot }} — {{ etape(l.etape) }}</h4>
          @if (l.etapesArretees.length) {
            <ol class="iv__frise">
              @for (e of l.etapesArretees; track e.etape) {
                <li class="iv__jalon"><span class="iv__jalon-d">{{ horodatage(e.le) }}</span><span class="iv__jalon-l">{{ etape(e.etape) }} arrêtée{{ e.nom ? ' par ' + e.nom : '' }}</span></li>
              }
            </ol>
          }
          <div class="table-responsive">
            <table class="cnm-table iv__table" [attr.aria-label]="'Offres du lot ' + l.lot">
              <thead>
                <tr>
                  <th scope="col">Rang</th><th scope="col">Offre</th><th scope="col">Candidat</th><th scope="col">Examen préliminaire</th>
                  @if (corrigees(l)) { <th scope="col" class="iv__num">Prix lu HT</th><th scope="col" class="iv__num">Prix corrigé</th> }
                  <th scope="col" class="iv__num">Montant évalué HT</th><th scope="col">Offre anormale</th><th scope="col">Post-qualification</th>
                </tr>
              </thead>
              <tbody>
                @for (o of trier(l.offres); track o.idOffre) {
                  @let d = decisions(o);
                  <tr [class.iv__ecartee]="!!o.ecartee">
                    <td><span class="iv__rang">{{ o.rang ?? '—' }}</span>{{ o.exAequo ? ' ex æquo' : '' }}</td>
                    <td>n° {{ o.numero ?? '—' }}</td><td>{{ o.entreprise.raisonSociale }}</td>
                    <td [class.iv__ko]="d.conformiteKo">{{ d.conformite }}</td>
                    @if (corrigees(l)) { <td class="iv__num">{{ ariary(o.evaluation?.prixLu) }}</td><td class="iv__num">{{ ariary(o.evaluation?.prixCorrige) }}</td> }
                    <td class="iv__num"><strong>{{ ariary(o.evaluation?.montantEvalue) }}</strong></td>
                    <td [class.iv__ko]="d.anormaleKo">{{ d.anormale }}</td><td [class.iv__ko]="d.qualificationKo" [class.iv__ok]="d.qualification === 'Qualifiée'">{{ d.qualification }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (l.proposition; as p) {
            <div class="iv__prop">
              @if (p.titulaires?.length) {
                <app-titulaires-proposes [titulaires]="p.titulaires" [lot]="l.lot" />
              } @else {
                <span class="iv__prop-l">Proposition d'attribution :</span>
                @if (p.infructueux) { <strong>infructueux</strong>{{ p.motifInfructuosite ? ' — ' + p.motifInfructuosite : '' }} }
                @else { <strong>{{ p.candidat }}</strong>{{ p.numero != null ? ' (offre n° ' + p.numero + ')' : '' }}, {{ ariary(p.montant) }} HT{{ p.montantTtc != null ? ' · ' + ariary(p.montantTtc) + ' TTC' : '' }}{{ p.delai != null ? ' · délai ' + p.delai : '' }} }
              }
            </div>
          }
        </div>
      }

      @if (ev.nonEvaluees.length) {
        <div class="iv__bloc">
          <h4 class="iv__titre">Offres non évaluées <span class="iv__compte">{{ ev.nonEvaluees.length }}</span></h4>
          <ul class="iv__supports">@for (o of ev.nonEvaluees; track $index) { <li>n° {{ o.numero ?? '—' }} · {{ entreprise(o.entreprise) }} — {{ etatOffre(o.etat) }}{{ o.motif ? ' : ' + o.motif : '' }}</li> }</ul>
        </div>
      }

      @if (ev.rapport; as r) {
        <div class="iv__bloc">
          <h4 class="iv__titre">Rapport d'évaluation — PV de validation</h4>
          <div class="iv__etapes">
            <span class="iv__etape iv__etape--fait">✓ Produit le {{ horodatage(r.produitLe) }}</span>
            <span class="iv__etape" [class.iv__etape--fait]="r.signe">{{ r.signe ? '✓ Validé le ' + horodatage(r.signeLe) : '· Signatures en cours' }}</span>
          </div>
          @if (r.observations) { <p class="iv__citation">« {{ r.observations }} »</p> }
          @if (signatures().length) {
            <ul class="iv__signatures">
              @for (s of signatures(); track $index) {
                <li><span class="iv__nom">{{ s.nom }}</span><span class="iv__qualite">{{ s.qualite }}</span><span class="iv__sig" [class.iv__attente]="s.etat === 'en attente'">{{ s.etat }}</span></li>
              }
            </ul>
          }
          <app-quorum-cao [quorum]="r.quorum" />
        </div>
      }
    </section>
  `,
  styleUrl: './instantanes-procedure.scss',
})
export class InstantaneEvaluationVue {
  readonly etatOffre = libelleEtatOffre;
  readonly evaluation = input.required<Evaluation>();
  readonly horodatage = horodatage;
  readonly ariary = ariary;
  readonly decisions = decisionsOffre;
  readonly etat = (e: string): string => (LIBELLES_ETAT_EVALUATION as Record<string, string>)[e] ?? e;
  readonly etape = (e: string): string => (LIBELLES_ETAPE as Record<string, string>)[e] ?? e;
  readonly signatures = computed(() => lignesSignatures(this.evaluation().rapport?.signaturesAttendues, this.evaluation().rapport?.signatures));
  readonly nbOffres = computed(() => this.evaluation().lots.reduce((n, l) => n + l.offres.length, 0));

  /** Le classement d'abord (rang croissant), les offres sans rang ensuite, par numéro. */
  trier(offres: readonly OffreEvaluee[]): OffreEvaluee[] {
    return [...offres].sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999) || (a.numero ?? 0) - (b.numero ?? 0));
  }

  /** Les colonnes « prix lu / corrigé » ne se montrent que si une correction a changé un prix. */
  corrigees(l: LotEvaluation): boolean {
    return l.offres.some((o) => o.evaluation && o.evaluation.prixLu != null && o.evaluation.prixCorrige != null && o.evaluation.prixLu !== o.evaluation.prixCorrige);
  }

  entreprise(e: Evaluation['nonEvaluees'][number]['entreprise']): string {
    if (!e) return '—';
    return typeof e === 'string' ? e : (e.raisonSociale ?? e.nif ?? '—');
  }
}

@Component({
  selector: 'app-instantane-attribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TitulairesProposes],
  template: `
    <section class="iv">
      @for (l of attribution().lots; track l.lot) {
        <div class="iv__tete">
          <p class="iv__sur">L'attribution — lot {{ l.lot }}</p>
          <h3 class="iv__objet">{{ etat(l) }}</h3>
          @if (l.dossierMarche; as d) {
            <p class="iv__note">Dossier de marché n° {{ d.idDossier }} · {{ d.sousType }}{{ d.statut ? ' · ' + statut(d.statut) : '' }}{{ d.avis ? ' · avis ' + avis(d.avis) : '' }}{{ d.creeLe ? ' · créé le ' + horodatage(d.creeLe) : '' }}</p>
          }
        </div>

        @if (l.proposition; as p) {
          <div class="iv__bloc">
            <h4 class="iv__titre">Proposition du rapport</h4>
            @if (p.titulaires?.length) {
              <app-titulaires-proposes [titulaires]="p.titulaires" [lot]="l.lot" />
            } @else if (p.infructueux) {
              <p class="iv__note">Lot proposé infructueux{{ p.motifInfructuosite ? ' — ' + p.motifInfructuosite : '' }}.</p>
            } @else {
              <p class="iv__note"><strong>{{ p.candidat }}</strong>{{ p.numero != null ? ' (offre n° ' + p.numero + ')' : '' }}, {{ ariary(p.montant) }} HT{{ p.delai != null ? ' · délai ' + p.delai : '' }}</p>
            }
          </div>
        }

        @if (suites(l).length) {
          <div class="iv__bloc">
            <h4 class="iv__titre">Après l'avis de la Commission</h4>
            <dl class="iv__lignes iv__lignes--larges">
              @for (s of suites(l); track s.l) { <div><dt>{{ s.l }}</dt><dd>{{ s.v }}</dd></div> }
            </dl>
          </div>
        }
      } @empty { <p class="iv__vide">Aucun lot.</p> }
    </section>
  `,
  styleUrl: './instantanes-procedure.scss',
})
export class InstantaneAttributionVue {
  readonly attribution = input.required<Attribution>();
  readonly horodatage = horodatage;
  readonly jj = jjmmaaaa;
  readonly ariary = ariary;
  readonly statut = statutDossierLabel;
  readonly etat = (l: LotAttribution): string => LIBELLES_ETAT_ATTRIBUTION[l.etat] ?? l.etat;
  readonly avis = (a: string): string => LIBELLES_AVIS[a] ?? a;
  readonly ouiNon = (v: boolean | null | undefined): string => (v == null ? 'à vérifier' : v ? 'conforme' : 'non conforme');

  /** Les étapes après le contrôle, seulement celles qui sont renseignées, dans l'ordre du suivi. */
  suites(l: LotAttribution): { l: string; v: string }[] {
    const h = this.horodatage, j = this.jj, a = this.ariary;
    const r: { l: string; v: string }[] = [];
    if (l.attributaire) { const x = l.attributaire; r.push({ l: 'Attributaire', v: `${x.candidat}${x.nif ? ' (NIF ' + x.nif + ')' : ''} — ${a(x.montant)} HT${x.montantTtc != null ? ' · ' + a(x.montantTtc) + ' TTC' : ''}${x.delai ? ' · délai ' + x.delai : ''} · attribué le ${h(x.le)}${x.motif ? ' — ' + x.motif : ''}` }); }
    if (l.information) r.push({ l: 'Information des candidats', v: `le ${h(l.information.le)} · affichage le ${j(l.information.dateAffichage)} · ${l.information.lettres.length} lettre(s)` });
    if (l.delaiAttente) { const d = l.delaiAttente; r.push({ l: "Délai d'attente", v: `du ${j(d.debut)} au ${j(d.fin)} (${d.jours} jours) · signable le ${j(d.signableLe)}${d.ecoule ? ' · écoulé' : ''}` }); }
    if (l.miseAuPoint) r.push({ l: 'Mise au point', v: `le ${h(l.miseAuPoint.le)} — ${l.miseAuPoint.rapport}` });
    if (l.recours?.length) r.push({ l: 'Recours', v: `${l.recours.length} déclaré(s)` });
    if (l.explications?.length) r.push({ l: "Demandes d'explication", v: String(l.explications.length) });
    if (l.signature) r.push({ l: 'Signature du marché', v: `le ${j(l.signature.dateSignature)} (enregistrée le ${h(l.signature.le)})` });
    if (l.enregistrement) r.push({ l: 'Enregistrement', v: `le ${j(l.enregistrement.date)}${l.enregistrement.reference ? ' · réf. ' + l.enregistrement.reference : ''}` });
    if (l.notification) { const n = l.notification; r.push({ l: 'Notification', v: `le ${j(n.date)}${n.recueLe ? ' · reçue le ' + j(n.recueLe) : n.receptionDeclaree ? ' · réception déclarée' : ''}` }); }
    if (l.avisAttribution) { const x = l.avisAttribution; r.push({ l: "Avis d'attribution", v: `échéance ${j(x.echeance)}${x.publieLe ? ' · publié le ' + h(x.publieLe) : x.disponible ? ' · à publier' : ''}` }); }
    if (l.piecesAttributaire) { const p = l.piecesAttributaire; r.push({ l: "Pièces de l'attributaire", v: `échéance ${j(p.echeance)}${p.delaiDepasse ? ' · délai dépassé' : ''} · fiscale : ${this.ouiNon(p.fiscaleConforme)} · sociale : ${this.ouiNon(p.socialeConforme)}` }); }
    if (l.retrait) r.push({ l: 'Retrait', v: `le ${h(l.retrait.le)} — ${l.retrait.motif}` });
    if (l.infructuosite) r.push({ l: 'Infructuosité', v: `le ${h(l.infructuosite.le)} — ${l.infructuosite.motif}${l.infructuosite.suite ? ' · suite : ' + l.infructuosite.suite : ''}` });
    if (l.reprises?.length) r.push({ l: "Reprises de l'évaluation", v: String(l.reprises.length) });
    return r;
  }
}
