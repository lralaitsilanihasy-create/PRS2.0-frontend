import { CouvertureSousType, ModeleIntegre, ModelePvResume } from '../../../../models';
import { LIBELLES_NATURE, propositionPourFamille, reprisParModele, sansDocument } from '../modeles-pv-libelles';

/**
 * ⚠️ 21/10 (page « Modèles de procès-verbaux », cahier du pilote) — le modèle de vue de la liste, calculé des seules données servies :
 * `GET /api/modeles-pv` (modèles gérés), `/integres` (fichiers livrés avec le serveur) et `/couverture` (ce qui produit chaque
 * sous-type). Rien n'y est codé en dur : compteurs, barre de couverture et recommandation en découlent.
 *
 * Trois états, dans l'ordre d'urgence :
 * - `miss` « À créer » : une famille dont des sous-types n'ont aucun modèle — leur PV est signé sans document ;
 * - `prep` « À rédiger » : un modèle géré sans version en vigueur (pas encore de page, ou un brouillon à valider) ;
 * - `ok` « En service » : un modèle intégré qui produit, ou un modèle géré mis en vigueur.
 */
export type EtatLigne = 'miss' | 'prep' | 'ok';

export const ORDRE_ETATS: readonly EtatLigne[] = ['miss', 'prep', 'ok'];
export const LIBELLES_ETAT: Readonly<Record<EtatLigne, string>> = { miss: 'À créer', prep: 'À rédiger', ok: 'En service' };

/** Les étapes du cycle de vie d'un modèle ; `etape` d'une ligne = l'indice de l'étape en cours (4 : toutes faites). */
export const ETAPES_CYCLE: readonly string[] = ['Modèle créé', 'Page rédigée', 'Validation', 'En service'];

/** D'où vient une ligne : ce que font ses boutons en dépend. */
export type SourceLigne =
  | { type: 'famille'; famille: string; libelleFamille: string }
  | { type: 'gere'; id: number }
  | { type: 'integre'; code: string };

export interface InfoLigne {
  cle: string;
  valeur: string;
}

/** Une ligne de la liste (le « Modele » du cahier). */
export interface LigneModele {
  /** Clé stable : `famille-DDM`, `gere-2`, `integre-PV-PLAN-INTEGRE`. */
  id: string;
  nom: string;
  sousTitre: string;
  etat: EtatLigne;
  /** Codes de sous-types (vide avec `tous` pour la lettre de renvoi, qui les sert tous). */
  sousTypes: string[];
  /** Libellés des sous-types, pour les infobulles des puces. */
  libellesSousTypes: Readonly<Record<string, string>>;
  tous: boolean;
  infos: InfoLigne[];
  /** Le modèle reprendra des fichiers intégrés (les sous-types concernés) ; vide sinon. */
  remplace: string[];
  badge: string;
  etape: number;
  source: SourceLigne;
}

/** Couverture des sous-types (nature PV) : chaque sous-type compte une fois, dans l'état qui le décrit. */
export interface Couverture {
  total: number;
  parEtat: Record<EtatLigne, number>;
}

export interface Recommandation {
  ligne: LigneModele;
  texte: string;
}

const deux = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`;

/** Construit les lignes des trois états. Les modèles archivés n'y figurent pas (la page les compte à part). */
export function construireLignes(
  modeles: readonly ModelePvResume[],
  integres: readonly ModeleIntegre[],
  couverture: readonly CouvertureSousType[],
  libellesFamilles: Readonly<Record<string, string>>,
): LigneModele[] {
  const libelles: Record<string, string> = {};
  for (const c of couverture) if (c.libelle) libelles[c.sousType] = c.libelle;
  const lignes: LigneModele[] = [];

  // À créer : les sous-types que rien ne produit et qu'aucun modèle ne sert, par famille.
  const parFamille = new Map<string, string[]>();
  for (const c of sansDocument(couverture)) {
    const f = c.famille ?? '—';
    parFamille.set(f, [...(parFamille.get(f) ?? []), c.sousType]);
  }
  for (const [famille, sousTypes] of parFamille) {
    const libelleFamille = libellesFamilles[famille] ?? famille;
    const propose = propositionPourFamille(famille, libelleFamille);
    lignes.push({
      id: `famille-${famille}`,
      nom: libelleFamille,
      sousTitre: 'Aucun modèle · PV signés sans document',
      etat: 'miss',
      sousTypes,
      libellesSousTypes: libelles,
      tous: false,
      infos: [
        { cle: 'Famille', valeur: famille },
        { cle: 'Modèle proposé', valeur: `${propose.libelle} (${propose.code})` },
        { cle: 'Fichiers', valeur: 'aucun' },
        { cle: 'Impact', valeur: `${deux(sousTypes.length, 'sous-type signé', 'sous-types signés')} sans document` },
      ],
      remplace: [],
      badge: `${deux(sousTypes.length, 'manquant', 'manquants')}`,
      etape: 0,
      source: { type: 'famille', famille, libelleFamille },
    });
  }

  // Modèles gérés : à déposer (ou à valider) tant qu'aucune version n'est en vigueur ; en service ensuite.
  for (const m of modeles) {
    if (m.etat !== 'ACTIF') continue;
    const remplace = reprisParModele(couverture, m.id);
    const d = m.derniere;
    const v = m.enVigueur;
    const etat: EtatLigne = v ? 'ok' : 'prep';
    const badge = v ? 'En vigueur' : !d ? 'À rédiger' : d.bloquant ? 'Contrôle bloquant' : 'À valider';
    const etape = v ? 4 : !d ? 1 : 2;
    lignes.push({
      id: `gere-${m.id}`,
      nom: m.libelle,
      sousTitre: m.nature === 'PV' ? m.code : `${m.code} · ${LIBELLES_NATURE[m.nature]}`,
      etat,
      sousTypes: [...m.sousTypes],
      libellesSousTypes: libelles,
      tous: false,
      infos: [
        { cle: 'Code', valeur: m.code },
        { cle: 'Type', valeur: LIBELLES_NATURE[m.nature] },
        { cle: 'Fichiers', valeur: v ? `version ${v.numero} en vigueur` : d ? `version ${d.numero} en brouillon` : 'aucune version déposée' },
        remplace.length
          ? { cle: 'Impact', valeur: `remplacera le modèle intégré pour ${remplace.join(' · ')}` }
          : { cle: 'Origine', valeur: 'créé dans cet écran' },
      ],
      remplace,
      badge,
      etape,
      source: { type: 'gere', id: m.id },
    });
  }

  // Modèles intégrés au serveur. ⚠️ 22/10 — un intégré relevé par un modèle de l'application (`enService: false`, relève D2/L2)
  // ne produit plus rien : il quitte la liste (la page le range sous « Modèles intégrés remplacés », en consultation).
  for (const i of integres) {
    if (!i.enService) continue;
    lignes.push({
      id: `integre-${i.code}`,
      nom: i.libelle,
      sousTitre: `Intégré à l’application · ${deux(i.fichiers.length, 'fichier Word', 'fichiers Word')}`,
      etat: i.enService ? 'ok' : 'prep',
      sousTypes: i.sousTypes ? [...i.sousTypes] : [],
      libellesSousTypes: libelles,
      tous: i.sousTypes === null,
      infos: [
        { cle: 'Code', valeur: i.code },
        { cle: 'Type', valeur: LIBELLES_NATURE[i.nature] },
        { cle: 'Fichiers', valeur: deux(i.fichiers.length, 'fichier Word', 'fichiers Word') },
        { cle: 'Origine', valeur: 'livré avec le serveur' },
      ],
      remplace: [],
      badge: i.enService ? 'En service' : 'Remplacé',
      etape: 4,
      source: { type: 'integre', code: i.code },
    });
  }
  return lignes;
}

/** La couverture des sous-types de PV : produit (intégré, ou modèle en vigueur) / modèle en préparation / rien. */
export function couvertureSousTypes(couverture: readonly CouvertureSousType[]): Couverture {
  const parEtat: Record<EtatLigne, number> = { miss: 0, prep: 0, ok: 0 };
  const pv = couverture.filter((c) => c.nature === 'PV');
  for (const c of pv) {
    if (c.produitPar !== 'AUCUN' || c.modeleRattache?.numeroEnVigueur != null) parEtat.ok++;
    else if (c.modeleRattache) parEtat.prep++;
    else parEtat.miss++;
  }
  return { total: pv.length, parEtat };
}

/** ⚠️ 21/10 — la couverture des lettres de renvoi, comptée à part de celle des PV (la barre ne compte que les PV). */
export interface CouvertureLettres {
  total: number;
  /** Produites par le modèle intégré (fichiers Word livrés avec le serveur). */
  integre: number;
  /** Produites par un modèle de l'application en vigueur. */
  modele: number;
  /** Sans document. */
  aucun: number;
  /** Le code du modèle intégré qui les produit, pour « Voir ». */
  codeIntegre: string | null;
}

export function couvertureLettres(couverture: readonly CouvertureSousType[]): CouvertureLettres {
  const lr = couverture.filter((c) => c.nature === 'LETTRE_RENVOI');
  const modele = lr.filter((c) => c.produitPar === 'GERE').length;
  const integre = lr.filter((c) => c.produitPar === 'INTEGRE').length;
  return { total: lr.length, integre, modele, aucun: lr.length - integre - modele, codeIntegre: lr.find((c) => c.integre)?.integre ?? null };
}

/** Le modèle à créer qui couvrirait le plus de sous-types d'un coup ; `null` s'il n'y a rien à créer. */
export function recommandation(lignes: readonly LigneModele[]): Recommandation | null {
  const aCreer = lignes.filter((l) => l.etat === 'miss');
  if (!aCreer.length) return null;
  const total = aCreer.reduce((n, l) => n + l.sousTypes.length, 0);
  const meilleure = [...aCreer].sort((a, b) => b.sousTypes.length - a.sousTypes.length || a.nom.localeCompare(b.nom))[0];
  const n = meilleure.sousTypes.length;
  const part = n === total ? 'soit tous les manques' : n * 2 > total ? 'soit plus de la moitié des manques' : n * 2 === total ? 'soit la moitié des manques' : `soit ${Math.round((100 * n) / total)} % des manques`;
  return {
    ligne: meilleure,
    texte: `Créer le modèle « ${meilleure.nom} » couvrirait ${deux(n, 'sous-type', 'sous-types')} d’un coup, ${part}.`,
  };
}

export type FiltreEtat = EtatLigne | 'tous';
export type Tri = 'priorite' | 'nom';

/** Recherche en direct sur le nom, le sous-titre et tous les codes (y compris ceux masqués derrière « +N »). */
export function filtrer(lignes: readonly LigneModele[], recherche: string, filtre: FiltreEtat): LigneModele[] {
  const q = recherche.trim().toLowerCase();
  return lignes.filter(
    (l) => (filtre === 'tous' || l.etat === filtre) && (!q || [l.nom, l.sousTitre, ...l.sousTypes].some((x) => x.toLowerCase().includes(q))),
  );
}

/** Groupes non vides, dans l'ordre d'urgence ; « priorité » = le plus de sous-types d'abord (la lettre, qui les sert tous, en tête). */
export function grouper(lignes: readonly LigneModele[], tri: Tri): { etat: EtatLigne; lignes: LigneModele[] }[] {
  const poids = (l: LigneModele): number => (l.tous ? Number.MAX_SAFE_INTEGER : l.sousTypes.length);
  const cmp = tri === 'nom' ? (a: LigneModele, b: LigneModele) => a.nom.localeCompare(b.nom) : (a: LigneModele, b: LigneModele) => poids(b) - poids(a) || a.nom.localeCompare(b.nom);
  return ORDRE_ETATS.map((etat) => ({ etat, lignes: lignes.filter((l) => l.etat === etat).sort(cmp) })).filter((g) => g.lignes.length);
}
