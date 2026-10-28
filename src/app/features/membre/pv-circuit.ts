import { PvExamen } from '../../models';

/**
 * ⚠️ 28/10 (maquette validée par le pilote, docs/maquette-2026-10-28-pv-simplifie.html) — la frise du circuit du projet de PV,
 * à la place des tuiles de signataires : examen, soumission, visa, signature. Chaque étape dit qui l'a faite ou qui doit la faire.
 */
export type EtatEtapePv = 'fait' | 'encours' | 'avenir';
export interface EtapeCircuitPv {
  libelle: string;
  /** Qui, et quand c'est fait (« RAKOTO Jean, le 28/10/2026 »). */
  detail: string;
  etat: EtatEtapePv;
}

/** Les noms résolus par l'écran (fiche contrôleur), et le dispatcheur, qui vise. */
export interface NomsCircuitPv {
  nom: (im?: string | null) => string;
  imDispatcheur?: string | null;
}

const APRES_SOUMISSION = ['PROJET_SOUMIS', 'PROJET_ACCEPTE', 'SIGNE'];

export function etapesCircuitPv(pv: PvExamen, noms: NomsCircuitPv): EtapeCircuitPv[] {
  const s = pv.statutPv;
  const le = (d?: string | null) => (d ? `, le ${dateFr(d)}` : '');
  const nom = (im?: string | null) => (im ? noms.nom(im) : '');
  const soumis = APRES_SOUMISSION.includes(s);
  const vise = s === 'PROJET_ACCEPTE' || s === 'SIGNE';
  const viseur = nom(pv.imCtrlPresident) || nom(noms.imDispatcheur) || 'Président ou Chef de commission';
  const cosignataires = [pv.nomMembreCoSignataire || nom(pv.imMembreCoSignataire), nom(pv.imCcCoSignataire)].filter(Boolean).join(' et ');
  return [
    { libelle: 'Examen', detail: nom(pv.imCtrlMembre) || 'Membre', etat: 'fait' },
    {
      libelle: s === 'EN_RECTIFICATION' ? 'Rectification' : 'Soumission du projet',
      detail: soumis ? `Soumis${le(pv.dateSoumissionInitiale)}` : s === 'EN_RECTIFICATION' ? 'Retourné au Membre' : 'Par le Membre',
      etat: soumis ? 'fait' : 'encours',
    },
    { libelle: 'Visa', detail: viseur + (vise ? le(pv.dateAcceptation) : ''), etat: vise ? 'fait' : s === 'PROJET_SOUMIS' ? 'encours' : 'avenir' },
    {
      libelle: 'Signature',
      detail: s === 'SIGNE' ? `${cosignataires || 'Co-signataires'}${le(pv.dateSignatureMembre ?? pv.dateSignatureCc)}` : cosignataires || 'Co-signataire désigné au visa',
      etat: s === 'SIGNE' ? 'fait' : s === 'PROJET_ACCEPTE' ? 'encours' : 'avenir',
    },
  ];
}

/** « 2026-10-28 » ou « 2026-10-28T14:05 » → « 28/10/2026 ». */
function dateFr(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

/** La phrase du pied de la fenêtre : où en est le PV, en clair (les gestes de chacun sont dans la barre d'actions). */
export function phraseEtatPv(pv: PvExamen, viseur: string): string {
  switch (pv.statutPv) {
    case 'BROUILLON':
      return `Soumettre envoie le projet à ${viseur} pour visa. Il pourra vous être retourné pour rectification.`;
    case 'EN_RECTIFICATION':
      return 'Le projet a été retourné : rectifiez l’examen, puis soumettez-le de nouveau.';
    case 'PROJET_SOUMIS':
      return `Le projet attend le visa de ${viseur} : viser arrête l’avis, désigne le co-signataire et pose sa signature.`;
    case 'PROJET_ACCEPTE':
      return 'Le projet est visé : il attend la signature du co-signataire désigné.';
    case 'SIGNE':
      return 'PV signé.';
    default:
      return '';
  }
}
