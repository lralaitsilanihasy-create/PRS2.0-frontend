import { DocumentProcedureEnLigne, ProcedureEnLigne, RecuDao } from '../../models';

/**
 * ⚠️ 18/10 (pilote, refonte de la page de la procédure côté candidat) — les règles de présentation, sans Angular : le parcours du
 * candidat en étapes, les documents du DAO regroupés par intitulé (un même document en PDF et en Word = une ligne, deux boutons), le
 * temps qui reste avant la date limite. Aucune règle métier ici : l'état vient du serveur (`etat`, `depotsOuverts`, `retraitPayant`,
 * le reçu), le front ne fait que le dire.
 */

export type EtatEtape = 'fait' | 'en-cours' | 'a-faire' | 'bloque' | 'a-venir' | 'clos';

export interface EtapeParcours {
  cle: 'frais' | 'retrait' | 'questions' | 'depot';
  titre: string;
  detail: string;
  etat: EtatEtape;
  /** L'identifiant de la section qui porte le geste (défilement au clic). */
  cible: string;
}

export const LIBELLES_ETAT_ETAPE: Readonly<Record<EtatEtape, string>> = {
  fait: 'Fait',
  'en-cours': 'En cours',
  'a-faire': 'À faire',
  bloque: 'Verrouillé',
  'a-venir': 'À venir',
  clos: 'Clos',
};

/** `AAAA-MM-JJTHH:MM` → `JJ/MM/AAAA à HH:MM` (ou `JJ/MM/AAAA` sans heure). */
function dateLisible(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso ?? '');
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` à ${m[4]}:${m[5]}` : ''}`;
}

/**
 * Le parcours du candidat sur cette procédure. `recu` : le reçu de son entreprise (`null` sans reçu, ou visiteur). `connecte` : un
 * visiteur voit les mêmes étapes, toutes « à faire » une fois connecté.
 */
/** ⚠️ 19/10 (pilote) — l'offre déjà déposée par l'entreprise sur cette procédure (la plus récente), lue sur « Mes offres ». */
export interface OffreDeposee {
  idOffre: string;
  dateDepot: string | null;
  numero: number | null;
  lot: number | null;
}

/** Les offres DÉPOSÉES (ni remplacées, ni retirées) de cette procédure, la plus récente d'abord. */
export function offresDeposees(offres: readonly { idOffre: string; idDmc: number; etat: string; dateDepot: string | null; numero: number | null; lot: number | null }[], idDmc: number): OffreDeposee[] {
  return offres
    .filter((o) => o.idDmc === idDmc && o.etat === 'DEPOSEE')
    .map((o) => ({ idOffre: o.idOffre, dateDepot: o.dateDepot, numero: o.numero, lot: o.lot }))
    .sort((a, b) => (b.dateDepot ?? '').localeCompare(a.dateDepot ?? ''));
}

export function etapesParcours(p: ProcedureEnLigne, recu: RecuDao | null, connecte: boolean, depose: OffreDeposee | null = null): EtapeParcours[] {
  const close = p.etat === 'CLOSE';
  const etapes: EtapeParcours[] = [];
  const payant = !!p.retraitPayant;
  const recuValide = recu?.etat === 'VALIDE';
  if (payant) {
    etapes.push({
      cle: 'frais',
      titre: 'Régler les frais de dossier',
      detail: !recu
        ? 'Versez les frais puis déposez votre reçu.'
        : recu.etat === 'VALIDE'
          ? 'Reçu validé.'
          : recu.etat === 'REFUSE'
            ? 'Reçu refusé : déposez-en un nouveau.'
            : 'Reçu déposé, en attente de validation.',
      etat: close ? 'clos' : recuValide ? 'fait' : recu?.etat === 'EN_ATTENTE' ? 'en-cours' : 'a-faire',
      cible: 'ped-frais',
    });
  }
  const retraitOuvert = !payant || recuValide;
  etapes.push({
    cle: 'retrait',
    titre: 'Retirer le dossier d’appel d’offres',
    detail: retraitOuvert ? (payant ? 'Disponible : votre reçu est validé.' : 'Dossier gratuit, disponible.') : 'Après la validation de votre reçu.',
    etat: close ? 'clos' : !connecte ? 'a-faire' : retraitOuvert ? 'a-faire' : 'bloque',
    cible: 'ped-docs',
  });
  etapes.push({
    cle: 'questions',
    titre: 'Poser vos questions',
    detail: 'Jusqu’à dix jours avant la date limite, après le retrait du dossier.',
    etat: close ? 'clos' : 'a-faire',
    cible: 'qp-titre',
  });
  const ouverture = dateLisible(p.dateOuvertureDepots);
  const limite = dateLisible(p.dateLimite);
  etapes.push({
    cle: 'depot',
    titre: 'Déposer votre offre',
    detail: depose
      ? `Déposée le ${dateLisible(depose.dateDepot) || '—'}${depose.numero ? `, n° ${depose.numero}` : ''}.`
      : close
      ? `Clos depuis le ${limite || '—'}.`
      : p.depotsOuverts
        ? `Ouvert jusqu’au ${limite || '—'}.`
        : ouverture
          ? `Du ${ouverture} au ${limite || '—'}.`
          : `Jusqu’au ${limite || '—'}.`,
    etat: depose ? 'fait' : close ? 'clos' : p.depotsOuverts ? 'en-cours' : 'a-venir',
    cible: 'ped-remise',
  });
  return etapes;
}

/** Un document du DAO dans un format : le bouton de retrait. */
export interface FormatDocument {
  document: DocumentProcedureEnLigne;
  /** « PDF », « Word », « Excel », ou l'extension en capitales. */
  format: string;
}

export interface GroupeDocuments {
  intitule: string;
  formats: FormatDocument[];
}

const FORMATS: Readonly<Record<string, string>> = { pdf: 'PDF', docx: 'Word', doc: 'Word', xlsx: 'Excel', xls: 'Excel', zip: 'ZIP' };

export function formatDuFichier(code: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(code)?.[1]?.toLowerCase() ?? '';
  return FORMATS[ext] ?? (ext ? ext.toUpperCase() : 'Fichier');
}

/** Regroupe par intitulé, dans l'ordre du premier rencontré ; le PDF en tête de chaque groupe (le format de lecture). */
export function grouperDocuments(docs: readonly DocumentProcedureEnLigne[]): GroupeDocuments[] {
  const groupes = new Map<string, GroupeDocuments>();
  for (const d of docs) {
    const g = groupes.get(d.intitule) ?? { intitule: d.intitule, formats: [] };
    g.formats.push({ document: d, format: formatDuFichier(d.code) });
    groupes.set(d.intitule, g);
  }
  for (const g of groupes.values()) g.formats.sort((a, b) => Number(b.format === 'PDF') - Number(a.format === 'PDF'));
  return [...groupes.values()];
}

/**
 * Le temps qui reste avant la date limite, en clair : « dans 137 jours », « demain », « aujourd’hui », « dans 3 heures » ; `null`
 * passée ou illisible. Indicatif : l'heure qui fait foi est celle du serveur, que l'écran affiche à côté.
 */
export function tempsRestant(dateLimite: string | null | undefined, maintenant: Date = new Date()): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(dateLimite ?? '');
  if (!m) return null;
  const limite = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 23), Number(m[5] ?? 59));
  const ms = limite.getTime() - maintenant.getTime();
  if (ms <= 0) return null;
  const heures = Math.floor(ms / 3_600_000);
  if (heures < 24) return heures <= 1 ? 'dans moins d’une heure' : `dans ${heures} heures`;
  const jourLimite = new Date(limite.getFullYear(), limite.getMonth(), limite.getDate()).getTime();
  const aujourdHui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).getTime();
  const jours = Math.round((jourLimite - aujourdHui) / 86_400_000);
  return jours === 1 ? 'demain' : `dans ${jours} jours`;
}

/** Les jalons du calendrier, passés ou non (frise de la colonne latérale). */
export interface Jalon {
  libelle: string;
  date: string;
  passe: boolean;
  fort?: boolean;
}

export function jalons(p: ProcedureEnLigne, maintenant: Date = new Date()): Jalon[] {
  const passe = (iso: string | null | undefined): boolean => {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso ?? '');
    return !!m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)).getTime() <= maintenant.getTime();
  };
  const liste: Jalon[] = [];
  if (p.datePublication) liste.push({ libelle: 'Publication de l’avis', date: dateLisible(p.datePublication), passe: passe(p.datePublication) });
  if (p.dateOuvertureDepots) liste.push({ libelle: 'Ouverture des dépôts', date: dateLisible(p.dateOuvertureDepots), passe: passe(p.dateOuvertureDepots) });
  if (p.dateLimite) liste.push({ libelle: 'Date limite de remise', date: dateLisible(p.dateLimite), passe: passe(p.dateLimite), fort: true });
  return liste;
}

// ── La liste des procédures (19/10, maquette du pilote) ──────────────────────────────────────────────────────

/** Une ligne de la liste : un appel d'offres ou un appel à manifestation d'intérêt, présentés de la même façon. */
export interface LigneProcedure {
  cle: string;
  genre: 'AO' | 'AMI';
  lien: (string | number)[];
  reference: string;
  etat: 'OUVERTE' | 'A_VENIR' | 'CLOSE';
  objet: string;
  autorite: string | null;
  categorie: string | null;
  lots: string;
  dateLimite: string | null;
  dateOuverture: string | null;
  /** Jours pleins avant la date limite (0 le dernier jour) ; `null` sans date ou passée. */
  joursRestants: number | null;
  /** Part écoulée de la période de dépôt, de 0 à 100 ; `null` à venir ou sans dates. */
  avancement: number | null;
}

export type FiltreProcedures = 'TOUTES' | 'OUVERTE' | 'A_VENIR';

const dateDe = (iso: string | null | undefined): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)) : null;
};

export function joursAvant(dateLimite: string | null | undefined, maintenant: Date): number | null {
  const d = dateDe(dateLimite);
  if (!d || d.getTime() <= maintenant.getTime()) return null;
  const jourLimite = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const aujourdHui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).getTime();
  return Math.round((jourLimite - aujourdHui) / 86_400_000);
}

/** La part écoulée entre le début (ouverture des dépôts, à défaut publication) et la date limite. */
export function avancementDepot(debut: string | null | undefined, fin: string | null | undefined, maintenant: Date): number | null {
  const a = dateDe(debut);
  const b = dateDe(fin);
  if (!a || !b || b.getTime() <= a.getTime()) return null;
  const p = ((maintenant.getTime() - a.getTime()) / (b.getTime() - a.getTime())) * 100;
  return Math.max(0, Math.min(100, Math.round(p)));
}

export interface AmiLigne {
  idDmc: number;
  reference: string | null;
  objet: string | null;
  autoriteContractante: string | null;
  dateLimite: string | null;
  publieLe: string | null;
  ouvert: boolean;
}

export function lignesProcedures(
  procedures: readonly ProcedureEnLigne[],
  amis: readonly AmiLigne[],
  categories: Readonly<Record<string, string>>,
  maintenant: Date = new Date(),
): LigneProcedure[] {
  const lignes: LigneProcedure[] = [
    ...amis.map((a): LigneProcedure => ({
      cle: `AMI-${a.idDmc}`,
      genre: 'AMI',
      lien: ['/candidat', 'amis', a.idDmc],
      reference: a.reference || `appel ${a.idDmc}`,
      etat: a.ouvert ? 'OUVERTE' : 'CLOSE',
      objet: a.objet || 'Objet non renseigné',
      autorite: a.autoriteContractante,
      categorie: 'Manifestation d’intérêt',
      lots: 'Prestations intellectuelles',
      dateLimite: a.dateLimite,
      dateOuverture: a.publieLe,
      joursRestants: a.ouvert ? joursAvant(a.dateLimite, maintenant) : null,
      avancement: a.ouvert ? avancementDepot(a.publieLe, a.dateLimite, maintenant) : null,
    })),
    ...procedures.map((p): LigneProcedure => ({
      cle: `AO-${p.idDmc}`,
      genre: 'AO',
      lien: ['/candidat', 'procedures', p.idDmc],
      reference: p.reference || `procédure ${p.idDmc}`,
      etat: p.etat,
      objet: p.objet || 'Objet non renseigné',
      autorite: p.autoriteContractante,
      categorie: p.categorie ? (categories[p.categorie] ?? null) : null,
      lots: p.lots.length > 1 ? `${p.lots.length} lots` : 'Lot unique',
      dateLimite: p.dateLimite,
      dateOuverture: p.dateOuvertureDepots,
      joursRestants: p.etat === 'CLOSE' ? null : joursAvant(p.dateLimite, maintenant),
      avancement: p.etat === 'OUVERTE' ? avancementDepot(p.dateOuvertureDepots ?? p.datePublication, p.dateLimite, maintenant) : null,
    })),
  ];
  // La date limite la plus proche d'abord, les closes à la fin.
  return lignes.sort(
    (x, y) => Number(x.etat === 'CLOSE') - Number(y.etat === 'CLOSE') || (dateDe(x.dateLimite)?.getTime() ?? Infinity) - (dateDe(y.dateLimite)?.getTime() ?? Infinity),
  );
}

export function compteursProcedures(lignes: readonly LigneProcedure[]): { ouvertes: number; aVenir: number; prochaine: number | null } {
  const ouvertes = lignes.filter((l) => l.etat === 'OUVERTE');
  const jours = ouvertes.map((l) => l.joursRestants).filter((j): j is number => j != null);
  return { ouvertes: ouvertes.length, aVenir: lignes.filter((l) => l.etat === 'A_VENIR').length, prochaine: jours.length ? Math.min(...jours) : null };
}

/** Le filtre d'état et la recherche (référence, objet, autorité), sans accents ni casse. */
export function filtrerProcedures(lignes: readonly LigneProcedure[], texte: string, filtre: FiltreProcedures): LigneProcedure[] {
  const norm = (s: string | null): string => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(texte.trim());
  return lignes.filter((l) => (filtre === 'TOUTES' || l.etat === filtre) && (!q || [l.reference, l.objet, l.autorite].some((c) => norm(c).includes(q))));
}
