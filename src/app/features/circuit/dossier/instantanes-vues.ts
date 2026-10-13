import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Attribution, Evaluation, LotAttribution, OffreEvaluee, QualiteSignataire, Seance, SignataireAttendu } from '../../../models';
import { horodatage, jjmmaaaa } from '../../../shared/prmp/avis-specifique-modele';
import { LIBELLES_ANORMALE, LIBELLES_ETAPE, LIBELLES_ETAT_EVALUATION, ariary } from '../../evaluation/libelles-evaluation';
import { QuorumCaoVue } from '../../procedure/quorum-cao';

/**
 * ⚠️ Manuel révisé, R4 (13/10) — les vues **dédiées** des trois écrans figés que la Commission lit le plus : la séance d'ouverture,
 * l'évaluation et l'attribution. Elles rendent le JSON figé (le DTO de lecture tel qu'il était servi à la soumission) en lecture
 * seule, sans aucun geste ni appel : un écran figé ne propose rien, il se lit. Le rendu générique (`app-donnees-figees`) reste
 * disponible sous chacune, pour la donnée complète.
 */

const LIBELLES_ETAT_SEANCE: Readonly<Record<string, string>> = {
  A_VENIR: 'À venir',
  OUVERTE: 'Ouverte — les parts arrivent',
  DECHIFFREE: 'Offres ouvertes',
  PV_A_SIGNER: 'PV à signer par les membres présents',
  ILLISIBLE: 'Offres illisibles (constat)',
  CLOSE: 'Close — PV signé',
};

const LIBELLES_ETAT_ATTRIBUTION: Readonly<Record<string, string>> = {
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

@Component({
  selector: 'app-instantane-seance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QuorumCaoVue],
  template: `
    @let s = seance();
    <dl class="iv__dl">
      <dt>État</dt><dd>{{ etat(s.etat) }}</dd>
      <dt>Heure d'ouverture</dt><dd>{{ s.heureOuverture ? horodatage(s.heureOuverture) : '—' }}</dd>
      <dt>Ouverte le</dt><dd>{{ s.ouverteLe ? horodatage(s.ouverteLe) : '—' }}</dd>
      <dt>Offres déchiffrées le</dt><dd>{{ s.dechiffreeLe ? horodatage(s.dechiffreeLe) : '—' }}</dd>
      <dt>Quorum des détenteurs</dt><dd>{{ s.quorum }}{{ s.secoursEmploye ? ' — part de secours employée' : '' }}</dd>
      @if (s.secoursDemande; as d) { <dt>Part de secours demandée</dt><dd>le {{ horodatage(d.date) }} — motif : {{ d.motif }}</dd> }
    </dl>

    <h4 class="iv__h">Membres de la commission ({{ s.membres.length }})</h4>
    <div class="table-responsive">
      <table class="cnm-table iv__table">
        <thead><tr><th scope="col">Nom</th><th scope="col">Qualité</th><th scope="col">Présent</th><th scope="col">Parts apportées</th></tr></thead>
        <tbody>
          @for (m of s.membres; track m.im) {
            <tr><td>{{ m.nom }}</td><td>{{ m.president ? 'Président' : 'Membre' }}</td><td>{{ m.present ? 'oui' : 'non' }}</td><td>{{ m.partsApportees ? 'oui' : 'non' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
    @if (s.autres.length) { <p class="iv__p">Autres présents : {{ autres() }}</p> }

    <h4 class="iv__h">Offres reçues ({{ s.offres.length }})</h4>
    @if (s.offres.length) {
      <div class="table-responsive">
        <table class="cnm-table iv__table">
          <thead><tr><th scope="col">N°</th><th scope="col">Lot</th><th scope="col">État</th><th scope="col">Parts reçues</th></tr></thead>
          <tbody>
            @for (o of s.offres; track $index) {
              <tr><td>{{ o.numero ?? '—' }}</td><td>{{ o.lot ?? '—' }}</td><td>{{ o.etat }}</td><td>{{ o.partsRecues }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    } @else { <p class="iv__p text-muted">Aucune offre déposée : la séance conduit à un PV de carence.</p> }

    @if (s.pv; as pv) {
      <h4 class="iv__h">Procès-verbal d'ouverture</h4>
      <dl class="iv__dl">
        <dt>Produit</dt><dd>{{ pv.produit ? 'oui' : 'non' }}</dd>
        <dt>Publié aux soumissionnaires</dt><dd>{{ pv.publie ? 'oui' : 'non' }}</dd>
        <dt>Signé</dt><dd>{{ pv.signe ? 'oui' + (pv.signeLe ? ', le ' + horodatage(pv.signeLe) : '') : 'non' }}</dd>
      </dl>
      @if (signatures().length) {
        <div class="table-responsive">
          <table class="cnm-table iv__table">
            <thead><tr><th scope="col">Signataire</th><th scope="col">Qualité</th><th scope="col">Signature</th></tr></thead>
            <tbody>@for (l of signatures(); track $index) { <tr><td>{{ l.nom }}</td><td>{{ l.qualite }}</td><td>{{ l.etat }}</td></tr> }</tbody>
          </table>
        </div>
      }
      <app-quorum-cao [quorum]="pv.quorum" />
    }
  `,
  styles: `
    :host { display: block; font-size: var(--text-sm); }
    .iv__dl { display: grid; grid-template-columns: minmax(10rem, max-content) 1fr; gap: 0.2rem 1rem; margin: 0 0 0.5rem; }
    .iv__dl dt { color: var(--n-500); font-weight: 500; }
    .iv__dl dd { margin: 0; }
    .iv__h { margin: 0.9rem 0 0.3rem; font-size: var(--text-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; color: var(--n-700, #334155); }
    .iv__p { margin: 0.3rem 0; }
    .iv__table { width: 100%; }
    .iv__table td { vertical-align: top; white-space: normal; overflow-wrap: anywhere; }
  `,
})
export class InstantaneSeanceVue {
  readonly seance = input.required<Seance>();
  readonly horodatage = horodatage;
  readonly etat = (e: string): string => LIBELLES_ETAT_SEANCE[e] ?? e;
  readonly autres = computed(() => this.seance().autres.map((a) => (a.qualite ? `${a.nom} (${a.qualite})` : a.nom)).join(', '));
  readonly signatures = computed(() => lignesSignatures(this.seance().pv?.signaturesAttendues, this.seance().pv?.signatures));
}

@Component({
  selector: 'app-instantane-evaluation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QuorumCaoVue],
  template: `
    @let ev = evaluation();
    <dl class="iv__dl">
      <dt>État</dt><dd>{{ etat(ev.etat) }}</dd>
      <dt>Ouverte le</dt><dd>{{ horodatage(ev.ouverteLe) }}{{ ev.ouvertePar ? ' par ' + ev.ouvertePar : '' }}</dd>
    </dl>

    <h4 class="iv__h">Déclarations d'intérêts ({{ ev.declarations.length }})</h4>
    <div class="table-responsive">
      <table class="cnm-table iv__table">
        <thead><tr><th scope="col">Membre</th><th scope="col">Qualité</th><th scope="col">Signée</th><th scope="col">Conflit d'intérêts</th></tr></thead>
        <tbody>
          @for (d of ev.declarations; track d.membre) {
            <tr>
              <td>{{ d.nom }}</td><td>{{ d.president ? 'Président' : 'Membre' }}</td>
              <td>{{ d.signeeLe ? 'le ' + horodatage(d.signeeLe) : 'non' }}</td>
              <td>{{ d.conflit == null ? '—' : d.conflit ? 'oui' + (d.precision ? ' — ' + d.precision : '') : 'non' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @for (l of ev.lots; track l.lot) {
      <h4 class="iv__h">Lot {{ l.lot }} — étape : {{ etape(l.etape) }}</h4>
      @if (l.etapesArretees.length) {
        <p class="iv__p">Étapes arrêtées : @for (e of l.etapesArretees; track e.etape; let dernier = $last) {{{ etape(e.etape) }} le {{ horodatage(e.le) }}{{ e.nom ? ' par ' + e.nom : '' }}{{ dernier ? '' : ' · ' }}}.</p>
      }
      <div class="table-responsive">
        <table class="cnm-table iv__table">
          <thead>
            <tr>
              <th scope="col">N°</th><th scope="col">Candidat</th><th scope="col">Examen préliminaire</th><th scope="col">Prix lu (HT)</th>
              <th scope="col">Prix corrigé</th><th scope="col">Montant évalué</th><th scope="col">Rang</th><th scope="col">Offre anormale</th>
              <th scope="col">Post-qualification</th><th scope="col">Écartée</th>
            </tr>
          </thead>
          <tbody>
            @for (o of l.offres; track o.idOffre) {
              <tr [class.iv__ecartee]="!!o.ecartee">
                <td>{{ o.numero ?? '—' }}</td><td>{{ o.entreprise.raisonSociale }}</td>
                <td>{{ conformite(o) }}</td>
                <td>{{ ariary(o.evaluation?.prixLu) }}</td><td>{{ ariary(o.evaluation?.prixCorrige) }}</td><td>{{ ariary(o.evaluation?.montantEvalue) }}</td>
                <td>{{ o.rang ?? '—' }}{{ o.exAequo ? ' (ex æquo)' : '' }}</td>
                <td>{{ anormale(o) }}</td><td>{{ qualification(o) }}</td>
                <td>{{ o.ecartee ? etape(o.ecartee.etape) + (o.ecartee.motif ? ' — ' + o.ecartee.motif : '') : '' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (l.proposition; as p) {
        <p class="iv__p iv__prop">
          Proposition d'attribution :
          @if (p.infructueux) { <strong>infructueux</strong>{{ p.motifInfructuosite ? ' — ' + p.motifInfructuosite : '' }} }
          @else { <strong>{{ p.candidat }}</strong>{{ p.numero != null ? ' (offre n° ' + p.numero + ')' : '' }}, {{ ariary(p.montant) }} HT{{ p.montantTtc != null ? ' · ' + ariary(p.montantTtc) + ' TTC' : '' }}{{ p.delai != null ? ' · délai ' + p.delai : '' }} }
        </p>
      }
    }

    @if (ev.nonEvaluees.length) {
      <h4 class="iv__h">Offres non évaluées ({{ ev.nonEvaluees.length }})</h4>
      <div class="table-responsive">
        <table class="cnm-table iv__table">
          <thead><tr><th scope="col">N°</th><th scope="col">Entreprise</th><th scope="col">État</th><th scope="col">Motif</th></tr></thead>
          <tbody>@for (o of ev.nonEvaluees; track $index) { <tr><td>{{ o.numero ?? '—' }}</td><td>{{ entreprise(o.entreprise) }}</td><td>{{ o.etat }}</td><td>{{ o.motif ?? '—' }}</td></tr> }</tbody>
        </table>
      </div>
    }

    @if (ev.rapport; as r) {
      <h4 class="iv__h">Rapport d'évaluation</h4>
      <dl class="iv__dl">
        <dt>Produit le</dt><dd>{{ horodatage(r.produitLe) }}</dd>
        <dt>Signé</dt><dd>{{ r.signe ? 'oui' + (r.signeLe ? ', le ' + horodatage(r.signeLe) : '') : 'non' }}</dd>
        @if (r.observations) { <dt>Observations</dt><dd>{{ r.observations }}</dd> }
      </dl>
      @if (signatures().length) {
        <div class="table-responsive">
          <table class="cnm-table iv__table">
            <thead><tr><th scope="col">Signataire</th><th scope="col">Qualité</th><th scope="col">Signature</th></tr></thead>
            <tbody>@for (l of signatures(); track $index) { <tr><td>{{ l.nom }}</td><td>{{ l.qualite }}</td><td>{{ l.etat }}</td></tr> }</tbody>
          </table>
        </div>
      }
      <app-quorum-cao [quorum]="r.quorum" />
    }
  `,
  styles: `
    :host { display: block; font-size: var(--text-sm); }
    .iv__dl { display: grid; grid-template-columns: minmax(10rem, max-content) 1fr; gap: 0.2rem 1rem; margin: 0 0 0.5rem; }
    .iv__dl dt { color: var(--n-500); font-weight: 500; }
    .iv__dl dd { margin: 0; }
    .iv__h { margin: 0.9rem 0 0.3rem; font-size: var(--text-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; color: var(--n-700, #334155); }
    .iv__p { margin: 0.3rem 0; }
    .iv__prop { padding: 0.4rem 0.6rem; background: var(--n-50, #f8fafc); border-left: 3px solid var(--primary, #0f766e); }
    .iv__table { width: 100%; }
    .iv__table td { vertical-align: top; white-space: normal; overflow-wrap: anywhere; }
    .iv__ecartee td { color: var(--n-500); }
  `,
})
export class InstantaneEvaluationVue {
  readonly evaluation = input.required<Evaluation>();
  readonly horodatage = horodatage;
  readonly ariary = ariary;
  readonly etat = (e: string): string => (LIBELLES_ETAT_EVALUATION as Record<string, string>)[e] ?? e;
  readonly etape = (e: string): string => (LIBELLES_ETAPE as Record<string, string>)[e] ?? e;
  readonly signatures = computed(() => lignesSignatures(this.evaluation().rapport?.signaturesAttendues, this.evaluation().rapport?.signatures));

  conformite(o: OffreEvaluee): string {
    const c = o.conformite;
    if (!c?.decision) return '—';
    return c.decision === 'CONFORME' ? 'conforme' : `écartée${c.motif ? ' — ' + c.motif : ''}`;
  }

  anormale(o: OffreEvaluee): string {
    const a = o.anormale;
    if (!a) return '—';
    if (a.decision) return (LIBELLES_ANORMALE as Record<string, string>)[a.decision] ?? a.decision;
    return a.suspectee ? 'suspectée' : 'non';
  }

  qualification(o: OffreEvaluee): string {
    const q = o.qualification;
    if (!q?.decision) return '—';
    return q.decision === 'QUALIFIE' ? 'qualifiée' : `non qualifiée${q.motif ? ' — ' + q.motif : ''}`;
  }

  entreprise(e: Evaluation['nonEvaluees'][number]['entreprise']): string {
    if (!e) return '—';
    return typeof e === 'string' ? e : (e.raisonSociale ?? e.nif ?? '—');
  }
}

@Component({
  selector: 'app-instantane-attribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (l of attribution().lots; track l.lot) {
      <h4 class="iv__h">Lot {{ l.lot }} — {{ etat(l) }}</h4>
      <dl class="iv__dl">
        @if (l.proposition; as p) {
          <dt>Proposition du rapport</dt>
          <dd>@if (p.infructueux) { infructueux{{ p.motifInfructuosite ? ' — ' + p.motifInfructuosite : '' }} } @else { {{ p.candidat }}{{ p.numero != null ? ' (offre n° ' + p.numero + ')' : '' }}, {{ ariary(p.montant) }} HT{{ p.delai != null ? ' · délai ' + p.delai : '' }} }</dd>
        }
        @if (l.dossierMarche; as d) {
          <dt>Dossier de marché</dt>
          <dd>n° {{ d.idDossier }} · {{ d.sousType }}{{ d.statut ? ' · ' + d.statut : '' }}{{ d.avis ? ' · avis ' + avis(d.avis) : '' }}{{ d.creeLe ? ' · créé le ' + horodatage(d.creeLe) : '' }}</dd>
        }
        @if (l.attributaire; as a) {
          <dt>Attributaire</dt>
          <dd>{{ a.candidat }}{{ a.nif ? ' (NIF ' + a.nif + ')' : '' }} — {{ ariary(a.montant) }} HT{{ a.montantTtc != null ? ' · ' + ariary(a.montantTtc) + ' TTC' : '' }}{{ a.delai ? ' · délai ' + a.delai : '' }} · attribué le {{ horodatage(a.le) }}{{ a.motif ? ' — ' + a.motif : '' }}</dd>
        }
        @if (l.information; as i) {
          <dt>Information des candidats</dt>
          <dd>le {{ horodatage(i.le) }} · affichage le {{ jj(i.dateAffichage) }} · {{ i.lettres.length }} lettre(s)</dd>
        }
        @if (l.delaiAttente; as d) {
          <dt>Délai d'attente</dt>
          <dd>du {{ jj(d.debut) }} au {{ jj(d.fin) }} ({{ d.jours }} jours) · signable le {{ jj(d.signableLe) }}{{ d.ecoule ? ' · écoulé' : '' }}</dd>
        }
        @if (l.miseAuPoint; as m) { <dt>Mise au point</dt><dd>le {{ horodatage(m.le) }} — {{ m.rapport }}</dd> }
        @if (l.recours?.length) { <dt>Recours</dt><dd>{{ l.recours!.length }} déclaré(s)</dd> }
        @if (l.explications?.length) { <dt>Demandes d'explication</dt><dd>{{ l.explications!.length }}</dd> }
        @if (l.signature; as s) { <dt>Signature du marché</dt><dd>le {{ jj(s.dateSignature) }} (enregistrée le {{ horodatage(s.le) }})</dd> }
        @if (l.enregistrement; as e) { <dt>Enregistrement</dt><dd>le {{ jj(e.date) }}{{ e.reference ? ' · réf. ' + e.reference : '' }}</dd> }
        @if (l.notification; as n) { <dt>Notification</dt><dd>le {{ jj(n.date) }}{{ n.recueLe ? ' · reçue le ' + jj(n.recueLe) : n.receptionDeclaree ? ' · réception déclarée' : '' }}</dd> }
        @if (l.avisAttribution; as a) { <dt>Avis d'attribution</dt><dd>échéance {{ jj(a.echeance) }}{{ a.publieLe ? ' · publié le ' + horodatage(a.publieLe) : a.disponible ? ' · à publier' : '' }}</dd> }
        @if (l.piecesAttributaire; as p) { <dt>Pièces de l'attributaire</dt><dd>échéance {{ jj(p.echeance) }}{{ p.delaiDepasse ? ' · délai dépassé' : '' }} · fiscale : {{ ouiNon(p.fiscaleConforme) }} · sociale : {{ ouiNon(p.socialeConforme) }}</dd> }
        @if (l.retrait; as r) { <dt>Retrait</dt><dd>le {{ horodatage(r.le) }} — {{ r.motif }}</dd> }
        @if (l.infructuosite; as i) { <dt>Infructuosité</dt><dd>le {{ horodatage(i.le) }} — {{ i.motif }}{{ i.suite ? ' · suite : ' + i.suite : '' }}</dd> }
        @if (l.reprises?.length) { <dt>Reprises de l'évaluation</dt><dd>{{ l.reprises!.length }}</dd> }
      </dl>
    } @empty { <p class="iv__p text-muted">Aucun lot.</p> }
  `,
  styles: `
    :host { display: block; font-size: var(--text-sm); }
    .iv__dl { display: grid; grid-template-columns: minmax(10rem, max-content) 1fr; gap: 0.2rem 1rem; margin: 0 0 0.5rem; }
    .iv__dl dt { color: var(--n-500); font-weight: 500; }
    .iv__dl dd { margin: 0; overflow-wrap: anywhere; }
    .iv__h { margin: 0.9rem 0 0.3rem; font-size: var(--text-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; color: var(--n-700, #334155); }
    .iv__p { margin: 0.3rem 0; }
  `,
})
export class InstantaneAttributionVue {
  readonly attribution = input.required<Attribution>();
  readonly horodatage = horodatage;
  readonly jj = jjmmaaaa;
  readonly ariary = ariary;
  readonly etat = (l: LotAttribution): string => LIBELLES_ETAT_ATTRIBUTION[l.etat] ?? l.etat;
  readonly avis = (a: string): string => LIBELLES_AVIS[a] ?? a;
  readonly ouiNon = (v: boolean | null | undefined): string => (v == null ? 'à vérifier' : v ? 'conforme' : 'non conforme');
}
