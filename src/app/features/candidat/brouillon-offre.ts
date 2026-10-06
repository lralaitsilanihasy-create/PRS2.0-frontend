import { ActeEngagementSaisi } from '../../core/securite/scellement';
import { SaisieOffre } from './offre-financiere';
import { SaisieTravaux } from './offre-travaux';

/**
 * Le **brouillon local** d'une offre en cours de saisie (lot 5, H4 — « le front garde un brouillon local, sans prix en clair
 * hors du poste, et l'efface au dépôt »). Il ne quitte jamais le navigateur : aucun appel au serveur, qui ne doit rien lire d'une
 * offre avant l'ouverture (ADR-0013). Il protège d'une page fermée ou rechargée par erreur.
 *
 * - **La clé porte le compte et la procédure** : sur un poste partagé, un autre compte candidat ne lit pas le brouillon du
 *   premier (constat S9 de l'audit : jamais un réglage d'un compte servi à un autre).
 * - **Les fichiers ne sont pas gardés** : le navigateur ne le permet pas sans les recopier ; l'écran le dit.
 * - **Il expire à la date limite** de la procédure, et s'efface au dépôt réussi.
 * - Le stockage peut être refusé (navigation privée, données bloquées) : tout passe par `try/catch`, l'écran marche sans.
 */
export interface BrouillonOffre {
  v: 1;
  enregistreLe: string;
  /** `AAAA-MM-JJTHH:MM` : au-delà, le brouillon est jeté. */
  dateLimite: string | null;
  lot: number | null;
  enGroupement: boolean;
  groupement: { nif: string; raisonSociale: string }[];
  ae: Partial<ActeEngagementSaisi>;
  garantie: { code: string; montant: number | null; emetteur: string };
  saisieOffre: SaisieOffre;
  saisieTravaux: SaisieTravaux;
}

const PREFIXE = 'prs.brouillon-offre';

export function cleBrouillon(login: string, idDmc: number): string {
  return `${PREFIXE}:${login.toLowerCase()}:${idDmc}`;
}

export function lireBrouillon(cle: string, maintenant = Date.now()): BrouillonOffre | null {
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return null;
    const b = JSON.parse(brut) as BrouillonOffre;
    if (b?.v !== 1 || !b.saisieOffre || !b.saisieTravaux) {
      localStorage.removeItem(cle);
      return null;
    }
    if (b.dateLimite && new Date(b.dateLimite).getTime() < maintenant) {
      localStorage.removeItem(cle);
      return null;
    }
    return b;
  } catch {
    return null;
  }
}

export function ecrireBrouillon(cle: string, b: BrouillonOffre): boolean {
  try {
    localStorage.setItem(cle, JSON.stringify(b));
    return true;
  } catch {
    return false;
  }
}

export function effacerBrouillon(cle: string): void {
  try {
    localStorage.removeItem(cle);
  } catch {
    /* stockage refusé : rien à effacer */
  }
}

/** Un brouillon qui ne contient rien de saisi ne vaut pas d'être gardé (ni annoncé). */
export function brouillonVide(b: Pick<BrouillonOffre, 'ae' | 'garantie' | 'saisieOffre' | 'saisieTravaux' | 'groupement'>): boolean {
  const o = b.saisieOffre;
  const t = b.saisieTravaux;
  return (
    !Object.values(o.prix).some((x) => x != null) &&
    !Object.values(o.dates).some(Boolean) &&
    !Object.keys(o.conformite).length &&
    !Object.values(t.k1).some((x) => x != null) &&
    !Object.keys(t.sousDetails).length &&
    !Object.values(t.chiffresAffaires).some((x) => x != null) &&
    t.liquidite.montant == null &&
    !t.references.length &&
    !Object.keys(t.personnel).length &&
    !Object.keys(t.materiel).length &&
    !b.groupement.length &&
    !b.garantie.code &&
    b.garantie.montant == null &&
    !b.ae.delai &&
    !b.ae.validiteJours &&
    !b.ae.rabais
  );
}
