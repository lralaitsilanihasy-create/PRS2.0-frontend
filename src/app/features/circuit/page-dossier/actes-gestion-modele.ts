import { HttpErrorResponse } from '@angular/common/http';

import { ApiError, codeErreur, corpsErreur } from '../../../core/errors/api-error';
import { ActeGestion, CategorieMarche, DemandeActe, MarcheActes, SousTypeActe } from '../../../models';

/** Les actes de gestion du manuel (famille `DGC`), dans l'ordre du menu de dépôt. */
export const LIBELLES_ACTE: Readonly<Record<SousTypeActe, string>> = {
  AVN: 'Avenant',
  DR: 'Résiliation',
  INDEMN: 'Indemnité',
  PENAL: 'Remise de pénalités',
  SURSIS: 'Sursis d’exécution',
};
export const SOUS_TYPES_ACTE = Object.keys(LIBELLES_ACTE) as SousTypeActe[];

export const LIBELLES_CATEGORIE_MARCHE: Readonly<Record<CategorieMarche, string>> = {
  FOURNITURES_SERVICES: 'Fournitures et services',
  TRAVAUX: 'Travaux',
  PRESTATIONS_INTELLECTUELLES: 'Prestations intellectuelles',
};

/** Un acte ne se dépose que sur un marché dont le dernier PV signé est favorable (409 `MARCHE_NON_CONTROLE` sinon). */
export function marcheControle(m: MarcheActes): boolean {
  return m.avisMarche === 'FAV' || m.avisMarche === 'FAVR';
}

/** Le libellé d'un acte : « Avenant n° 2 », « Résiliation ». */
export function libelleActe(a: Pick<ActeGestion, 'sousType' | 'rang'>): string {
  return a.sousType === 'AVN' && a.rang ? `Avenant n° ${a.rang}` : LIBELLES_ACTE[a.sousType];
}

export function ariary(v: number | null | undefined): string {
  return v == null ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v)} Ar`;
}

function jj(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, j] = iso.slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
}
export { jj as dateCourte };

/**
 * Ce que le cumul des avenants deviendrait avec `montantHt` : `null` sans plafond connu. Indicatif — le serveur seul tranche, au dépôt
 * et de nouveau à la soumission (il ne compte que les avenants déjà soumis, hors avis défavorable).
 */
export function projectionPlafond(m: MarcheActes, montantHt: number | null): { cumul: number; plafond: number; depasse: boolean } | null {
  if (m.plafondAvenantsHt == null) return null;
  const cumul = (m.cumulAvenantsHt ?? 0) + (montantHt ?? 0);
  return { cumul, plafond: m.plafondAvenantsHt, depasse: cumul > m.plafondAvenantsHt };
}

/** Ce qui manque à une demande, avant l'envoi (le serveur redit le reste). */
export function manquesDemande(d: DemandeActe, m: Pick<MarcheActes, 'montantInitialHt' | 'categorie'> | null): string[] {
  const r: string[] = [];
  if (d.sousType === 'AVN' && (d.montantHt == null || d.montantHt === 0)) r.push('Le montant hors taxes de l’avenant (négatif pour une baisse).');
  if (d.sousType === 'AVN' && m?.montantInitialHt == null && !(d.montantInitialHt != null && d.montantInitialHt > 0)) r.push('Le montant initial hors taxes du marché.');
  if (d.sousType === 'AVN' && m?.categorie == null && !d.categorie) r.push('La catégorie du marché.');
  return r;
}

/** Le refus du serveur, dit au déposant (détails chiffrés compris). */
export function messageRefusActe(e: ApiError | HttpErrorResponse): string {
  const details = corpsErreur<{ details?: Record<string, unknown>; message?: string }>(e)?.details ?? {};
  const n = (k: string) => (typeof details[k] === 'number' ? (details[k] as number) : null);
  const d = (k: string) => (typeof details[k] === 'string' ? jj(details[k] as string) : null);
  switch (codeErreur(e)) {
    case 'MARCHE_NON_CONTROLE':
      return 'Le marché n’a pas encore reçu d’avis favorable de la Commission : aucun acte de gestion ne peut s’y rattacher.';
    case 'PAS_UN_MARCHE':
      return 'Un acte de gestion se dépose depuis un dossier de marché.';
    case 'SOUS_TYPE_HORS_DGC':
      return 'Choisissez un acte de gestion : avenant, résiliation, indemnité, remise de pénalités ou sursis.';
    case 'MONTANT_INITIAL_OBLIGATOIRE':
      return 'Le montant initial hors taxes du marché n’est pas connu : déclarez-le.';
    case 'CATEGORIE_OBLIGATOIRE':
      return 'La catégorie du marché n’est pas connue : déclarez-la.';
    case 'CATEGORIE_INCONNUE':
      return 'Catégorie de marché inconnue.';
    case 'AVENANT_APRES_RECEPTION':
      return `Un avenant ne se conclut plus après la réception${d('dateReception') ? ' du ' + d('dateReception') : ''} (manuel de contrôle).`;
    case 'AVENANT_APRES_SOLDE':
      return `Un avenant ne se conclut plus après le solde du marché${d('dateSolde') ? ', réglé le ' + d('dateSolde') : ''}.`;
    case 'AVENANT_PLAFOND': {
      const cumul = n('cumulHt'), plafond = n('plafondHt');
      return `Les avenants dépasseraient le tiers du montant initial${cumul != null && plafond != null ? ` : ${ariary(cumul)} pour un plafond de ${ariary(plafond)}` : ''}. Un tel changement relève d’un nouveau marché.`;
    }
    case 'DOSSIER_NON_BROUILLON':
      return 'L’acte est déjà transmis : ses déclarations ne se modifient plus.';
    case 'ACTE_SANS_MARCHE':
      return 'Cet acte n’est rattaché à aucun marché : il ne peut pas être soumis.';
  }
  const api = e as Partial<ApiError>;
  return api.message || 'L’opération n’a pas abouti.';
}
