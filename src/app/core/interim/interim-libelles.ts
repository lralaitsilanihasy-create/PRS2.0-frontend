import { Controleur, Interim, MotifInterim, Role, StatutInterim } from '../../models';

/**
 * Libellés et règles pures de l'intérim désigné (demande 2026-09-21, backend `e867082`) — fichier unique,
 * comme `libelles-profils.ts` : le serveur ne sert que des codes. Tables `Record` exhaustives.
 */
export const LIBELLES_MOTIFS_INTERIM: Readonly<Record<MotifInterim, string>> = {
  CONGE: 'Congé',
  MISSION: 'Mission',
  MALADIE: 'Maladie',
  VACANCE_POSTE: 'Vacance de poste',
  AUTRE: 'Autre',
};

export const LIBELLES_STATUTS_INTERIM: Readonly<Record<StatutInterim, string>> = {
  A_VENIR: 'À venir',
  ACTIF: 'En cours',
  ACHEVE: 'Achevé',
  REVOQUE: 'Révoqué',
};

/** `2026-09-30` → `30/09/2026` ; vide sans date. Une date-heure ISO garde son jour. */
export function dateFr(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** « du 21/09/2026 au 30/09/2026 », ou « à partir du 21/09/2026, sans terme » (vacance de poste). */
export function periodeInterim(i: Pick<Interim, 'dateDebut' | 'dateFin'>): string {
  return i.dateFin ? `du ${dateFr(i.dateDebut)} au ${dateFr(i.dateFin)}` : `à partir du ${dateFr(i.dateDebut)}, sans terme`;
}

/** « jusqu'au 30/09/2026 » ou « sans terme » — pour les bannières. */
export function jusquA(i: Pick<Interim, 'dateFin'>): string {
  return i.dateFin ? `jusqu'au ${dateFr(i.dateFin)}` : 'sans terme';
}

/** Date du jour au format ISO (`yyyy-MM-dd`), en heure locale — valeur par défaut des formulaires. */
export function aujourdHuiIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** « NOM Prénoms » d'une fiche contrôleur, à défaut son matricule. */
export function nomControleur(c: Pick<Controleur, 'imControleur' | 'nomCont' | 'prenomsCont'>): string {
  return [c.nomCont, c.prenomsCont].filter(Boolean).join(' ') || c.imControleur;
}

/**
 * Qui peut suppléer qui (arbitrage pilote du 21/09, §B3 de la demande) — MIROIR de la garde serveur, pour ne
 * proposer que des choix valides ; le serveur reste l'autorité (409 nominatif) :
 *  - Président ← tout Chef de commission, toute localité ;
 *  - Chef de commission ← un autre CC de SA localité (la Centrale en a trois), ou un Membre de sa localité.
 * Tout autre titulaire n'a pas d'intérim dans ce lot : liste vide.
 */
export function interimairesAdmissibles(
  titulaire: Controleur | null | undefined,
  tous: readonly Controleur[],
  roleDe: (c: Controleur) => Role | null,
): Controleur[] {
  if (!titulaire) return [];
  const roleTitulaire = roleDe(titulaire);
  const candidats = tous.filter((c) => c.imControleur !== titulaire.imControleur);
  if (roleTitulaire === 'PRESIDENT') return candidats.filter((c) => roleDe(c) === 'CHEF_COMMISSION');
  if (roleTitulaire === 'CHEF_COMMISSION') {
    return candidats.filter((c) => {
      const r = roleDe(c);
      return (r === 'CHEF_COMMISSION' || r === 'MEMBRE') && !!titulaire.idLocalite && c.idLocalite === titulaire.idLocalite;
    });
  }
  return [];
}

/** Titulaires possibles d'un intérim (lot 1) : Président et Chefs de commission. */
export function titulairesPossibles(tous: readonly Controleur[], roleDe: (c: Controleur) => Role | null): Controleur[] {
  return tous.filter((c) => {
    const r = roleDe(c);
    return r === 'PRESIDENT' || r === 'CHEF_COMMISSION';
  });
}

/**
 * Le connecté peut-il révoquer cet intérim ? Miroir de la garde serveur : le titulaire, le désignateur ou
 * l'Administrateur, et seulement tant que l'intérim est ACTIF ou A_VENIR (409 sinon).
 */
export function peutRevoquer(i: Interim, moi: string | null, admin: boolean): boolean {
  if (i.statut !== 'ACTIF' && i.statut !== 'A_VENIR') return false;
  return admin || (!!moi && (i.imTitulaire === moi || i.designePar === moi));
}
