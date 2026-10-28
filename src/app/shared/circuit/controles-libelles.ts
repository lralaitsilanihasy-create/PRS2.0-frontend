import { HttpErrorResponse } from '@angular/common/http';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { ControleBloquant, ControleResultat, ResultatControle } from '../../models';

/**
 * ⚠️ Manuel révisé, R5 (V105, 13/10) — règles pures des contrôles : libellés, mise en forme des valeurs constatées, message du refus
 * `CONTROLES_BLOQUANTS` (soumission, resoumission) et du refus `CONTROLE_NON_CONFORME` (avis favorable sans réserve), et la
 * **levée** : par règle, le dernier résultat posé fait foi.
 */

export const LIBELLES_RESULTAT: Readonly<Record<ResultatControle, string>> = {
  CONFORME: 'Conforme',
  NON_CONFORME: 'Non conforme',
  NON_APPLICABLE: 'Sans objet',
};

/** Une valeur constatée en clair : dates en `JJ/MM/AAAA`, booléens en oui / non, objets dépliés sur un niveau. */
export function texteValeur(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(v);
    return m ? (m[4] ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : `${m[3]}/${m[2]}/${m[1]}`) : v;
  }
  if (Array.isArray(v)) return v.map(texteValeur).join(', ');
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k} : ${typeof x === 'object' && x !== null ? JSON.stringify(x) : texteValeur(x)}`)
    .join(' · ');
}

/** Les valeurs constatées d'un contrôle en une ligne : `clé : valeur · clé : valeur`. */
export function texteValeurs(valeurs: Record<string, unknown> | null | undefined): string {
  if (!valeurs) return '';
  return Object.entries(valeurs)
    .map(([k, v]) => `${k} : ${texteValeur(v)}`)
    .join(' · ');
}

/**
 * Le refus 400 `CONTROLES_BLOQUANTS` (`details.controles[{ code, reference, libelle, valeurs }]`), un contrôle par ligne, pour la
 * boîte de dialogue (qui respecte les retours à la ligne) ; `null` si l'erreur est d'une autre nature.
 */
export function messageControlesBloquants(e: ApiError | HttpErrorResponse): string | null {
  if (codeErreur(e) !== 'CONTROLES_BLOQUANTS') return null;
  const controles = corpsErreur<{ details?: { controles?: ControleBloquant[] } }>(e)?.details?.controles ?? [];
  if (!controles.length) return 'La soumission est refusée : un contrôle bloquant n’est pas conforme.';
  const lignes = controles.map((c) => {
    const ref = c.reference ? `[${c.reference}] ` : '';
    const vals = texteValeurs(c.valeurs);
    return `• ${ref}${c.libelle || c.code}${vals ? ' — ' + vals : ''}`;
  });
  return `La soumission est refusée : ${controles.length} contrôle(s) bloquant(s) non conforme(s). Corrigez, puis soumettez de nouveau.\n${lignes.join('\n')}`;
}

/**
 * Le message d'un refus de soumission ou de resoumission : les contrôles bloquants nommés un à un, sinon les erreurs par champ,
 * sinon le message du serveur, sinon le repli donné.
 */
export function messageSoumissionRefusee(e: ApiError, repli = 'Échec de la soumission.'): string {
  const bloquants = messageControlesBloquants(e);
  if (bloquants) return bloquants;
  const capm = messageCapmIncomplet(e);
  if (capm) return capm;
  const dao = messageDaoCompletEnPreparation(e);
  if (dao) return dao;
  const detail = e.fieldErrors ? Object.values(e.fieldErrors).join(' ') : '';
  return detail || e.message || repli;
}

/**
 * ⚠️ 28/10 (demande « dao-complet-en-file », Q5, V144) — le refus 409 `DAO_COMPLET_EN_PREPARATION` `{ rang }` de la soumission, de la
 * resoumission ou de la transmission des compléments : la Commission examine le DAO tel que les candidats le recevront. Le message du
 * serveur nomme déjà le rang ; le repli le reconstruit (`rang` nul = assemblage en cours).
 */
export function messageDaoCompletEnPreparation(e: ApiError | HttpErrorResponse): string | null {
  if (codeErreur(e) !== 'DAO_COMPLET_EN_PREPARATION') return null;
  const corps = corpsErreur<{ message?: string; details?: { rang?: number | null } }>(e);
  const serveur = corps?.message?.trim();
  if (serveur) return serveur;
  const rang = corps?.details?.rang;
  const ou = rang != null ? `n° ${rang} dans la file` : 'assemblage en cours';
  return `Le DAO complet est en préparation (${ou}) : la Commission examine le DAO tel que les candidats le recevront. Réessayez quand il sera prêt ; vous serez prévenu.`;
}

/**
 * ⚠️ Q-pièce (backend Q1, V114, 14/10) — le refus 409 `CAPM_INCOMPLET` à la soumission d'un plan : chaque ligne doit dater ou marquer
 * « sans objet » tous les processus du calendrier de son mode. `details.lignes` = `[{ idDetail, designation, processus: [libellés] }]`.
 */
export function messageCapmIncomplet(e: ApiError | HttpErrorResponse): string | null {
  if (codeErreur(e) !== 'CAPM_INCOMPLET') return null;
  const lignes = corpsErreur<{ details?: { lignes?: { designation?: string | null; processus?: string[] }[] } }>(e)?.details?.lignes ?? [];
  const tete = 'Le calendrier prévisionnel est incomplet : chaque ligne doit dater, ou marquer « sans objet » avec un motif, tous les processus de son mode de passation.';
  if (!lignes.length) return tete;
  // ⚠️ 27/10 (pilote) — la liste complète des processus, ligne par ligne, rendait le message illisible (7 lignes × 27 processus) :
  // une ligne par marché, avec le nombre de processus à compléter ; les processus se voient dans « Voir dates » de la ligne.
  const MAX = 10;
  const court = (t: string) => (t.length > 70 ? t.slice(0, 69).trimEnd() + '…' : t);
  const detail = lignes.slice(0, MAX).map((l) => {
    const n = (l.processus ?? []).length;
    // Jusqu'à trois processus, leurs noms ; au-delà, leur nombre.
    const quoi = n <= 3 ? (l.processus ?? []).join(', ') : `${n} processus à dater`;
    return `• ${court(l.designation || 'ligne sans objet')} — ${quoi}`;
  });
  if (lignes.length > MAX) detail.push(`• … et ${lignes.length - MAX} autre(s) ligne(s)`);
  return `${tete}\n${lignes.length} ligne(s) à compléter (bouton « Voir dates » de chaque ligne) :\n${detail.join('\n')}`;
}

/** Le refus 409 `CONTROLE_NON_CONFORME` de l'avis « Favorable » sans réserve ; `null` pour une autre erreur. */
export function messageControleNonConforme(e: ApiError | HttpErrorResponse): string | null {
  if (codeErreur(e) !== 'CONTROLE_NON_CONFORME') return null;
  // Le serveur nomme les règles en cause et les issues (« levez-les ou choisissez… ») : on garde son message, on dit où lever.
  const serveur = corpsErreur<{ message?: string }>(e)?.message?.trim() ?? '';
  const ou = 'Les contrôles se lèvent depuis le bouton « Contrôles » de l’en-tête (conforme ou sans objet, avec votre observation).';
  return serveur
    ? `${serveur} ${ou}`
    : `Une non-conformité non levée interdit l’avis « Favorable » sans réserve : levez-la, ou choisissez « Favorable avec réserves ». ${ou}`;
}

/** Les contrôles tels qu'ils comptent : par règle, le dernier résultat posé (l'ordre du serveur est chronologique ; on garde le plus récent). */
export function controlesEffectifs(liste: readonly ControleResultat[]): ControleResultat[] {
  const parRegle = new Map<string, ControleResultat>();
  const cle = (c: ControleResultat): string => c.regle || (c.idPointCtrl != null ? `POINT_${c.idPointCtrl}` : String(c.idControle));
  const date = (c: ControleResultat): string => c.dateControle ?? '';
  for (const c of liste) {
    const k = cle(c);
    const deja = parRegle.get(k);
    if (!deja || date(c) >= date(deja) || (date(c) === date(deja) && c.idControle > deja.idControle)) parRegle.set(k, c);
  }
  return [...parRegle.values()];
}

export interface BilanControles {
  total: number;
  conformes: number;
  nonConformes: number;
  sansObjet: number;
  /** Non conformes et bloquants : la soumission les aurait refusés — ici, ce sont ceux posés après (Membre) ou levés puis reposés. */
  bloquants: number;
}

export function bilanControles(liste: readonly ControleResultat[]): BilanControles {
  const eff = controlesEffectifs(liste);
  return {
    total: eff.length,
    conformes: eff.filter((c) => c.resultat === 'CONFORME').length,
    nonConformes: eff.filter((c) => c.resultat === 'NON_CONFORME').length,
    sansObjet: eff.filter((c) => c.resultat === 'NON_APPLICABLE').length,
    bloquants: eff.filter((c) => c.resultat === 'NON_CONFORME' && c.bloquant).length,
  };
}
