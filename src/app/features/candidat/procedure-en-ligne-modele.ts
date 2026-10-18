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
export function etapesParcours(p: ProcedureEnLigne, recu: RecuDao | null, connecte: boolean): EtapeParcours[] {
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
    detail: close
      ? `Clos depuis le ${limite || '—'}.`
      : p.depotsOuverts
        ? `Ouvert jusqu’au ${limite || '—'}.`
        : ouverture
          ? `Du ${ouverture} au ${limite || '—'}.`
          : `Jusqu’au ${limite || '—'}.`,
    etat: close ? 'clos' : p.depotsOuverts ? 'en-cours' : 'a-venir',
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
