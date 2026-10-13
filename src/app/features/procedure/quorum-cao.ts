import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { QualiteSignataire, QuorumCao } from '../../models';

/** La règle du quorum, en clair : `MAJORITE`, `TOUS` ou un nombre. */
export function libelleRegleQuorum(regle: string | null | undefined): string {
  return regle === 'MAJORITE' ? 'majorité des membres désignés' : regle === 'TOUS' ? 'tous les membres désignés' : regle ? `au moins ${regle} membre(s)` : 'règle globale';
}

/** La qualité d'un signataire attendu, en suffixe (« — président », « — représentant du président »), vide pour un membre. */
export function suffixeQualite(qualite: QualiteSignataire | null | undefined): string {
  return qualite === 'PRESIDENT' ? ' — président' : qualite === 'REPRESENTANT' ? ' — représentant du président' : '';
}

/**
 * ⚠️ R1 (V101) — le refus 409 `QUORUM_NON_ATTEINT`, nommé avec ses valeurs (`details` : `regle`, `requis`, `obtenus`, `presidentSigne`) :
 * clôture d'une séance, production du rapport, arrêt de la liste de l'AMI, ou empêchement qui rendrait le quorum inatteignable.
 */
export function messageQuorum(e: ApiError): string {
  const d = corpsErreur<{ details?: { regle?: string; requis?: number; obtenus?: number; presidentSigne?: boolean } }>(e)?.details ?? {};
  const compte = d.requis != null ? ` : ${d.obtenus ?? 0} signataire(s) sur ${d.requis} requis (${libelleRegleQuorum(d.regle)})` : '';
  const president = d.presidentSigne === false ? ' ; le président, ou son représentant désigné, manque' : '';
  return `Quorum de la commission non atteint${compte}${president}. Le geste est refusé ; l’Administrateur peut régler la règle, ou la procédure la surcharger.`;
}

/** Vrai si le refus est celui du quorum (pour les écrans qui ont leur propre table de messages). */
export function estRefusQuorum(e: ApiError): boolean {
  return codeErreur(e) === 'QUORUM_NON_ATTEINT';
}

/**
 * ⚠️ Manuel révisé, R1 (V101, arbitrage Q5 du 10/10) — le quorum délibératif de la CAO tel que le serveur le sert avec un PV ou un
 * rapport : requis, obtenus, règle, président (ou représentant désigné). Rien n'est calculé ici : le serveur est l'autorité.
 */
@Component({
  selector: 'app-quorum-cao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (quorum(); as q) {
      <p class="qc" [class.qc--ko]="!q.atteint">
        <span class="badge" [class.badge-success]="q.atteint" [class.badge-warning]="!q.atteint">Quorum {{ q.atteint ? 'atteint' : 'non atteint' }}</span>
        <span class="text-sm">{{ q.obtenus }} sur {{ q.requis }} requis ({{ regle(q.regle) }})</span>
        @if (q.presidentRequis) {
          <span class="text-sm" [class.text-muted]="q.presidentSigne">· {{ q.representant ? 'représentant du président' : 'président' }} {{ q.presidentSigne ? 'signataire' : 'attendu' }}{{ q.representantNom ? ' (' + q.representantNom + ')' : '' }}</span>
        }
      </p>
    }
  `,
  styles: `
    .qc { margin: 0; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  `,
})
export class QuorumCaoVue {
  readonly quorum = input<QuorumCao | null | undefined>(null);
  readonly regle = libelleRegleQuorum;
}
