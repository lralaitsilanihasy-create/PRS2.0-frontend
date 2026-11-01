/**
 * ⚠️ Manuel révisé, R4 (V104, 13/10) — les **écrans figés** à la soumission d'un dossier (`t_dossier_instantane`, immuable) :
 * à chaque soumission ou resoumission, le serveur garde le JSON du DTO de lecture de chaque écran de la famille, tel qu'il était
 * servi à cet instant. C'est ce que lisent les profils CNM à la place des pièces retirées (R2) ; les membres de la CAO gardent
 * leurs écrans vivants. Un écran sans donnée à cet instant (séance non ouverte, AMI non préparé…) n'est pas figé.
 */

/** Les neuf écrans figés ; une famille n'en porte qu'une partie (DMC : PLAN, AVIS, AMI, CAO ; DDM : + SEANCE, EVALUATION, ATTRIBUTION ; DGC : ATTRIBUTION, ACTE ; DSS : DSS, ATTRIBUTION). */
export type EcranInstantane = 'PLAN' | 'AVIS' | 'AMI' | 'CAO' | 'SEANCE' | 'EVALUATION' | 'ATTRIBUTION' | 'ACTE' | 'DSS' | (string & {});

/** Une ligne de `GET /api/dossiers/{id}/instantanes`, par soumission puis par écran. */
export interface Instantane {
  idInstantane: number;
  numeroSoumission: number;
  ecran: EcranInstantane;
  figeLe: string;
  /** Le matricule de l'acteur de la soumission (la PRMP ou son UGPM). */
  figePar: string | null;
  /** SHA-256 du JSON figé, reprise au pied de l'export PDF. */
  empreinte: string;
  /** Octets du JSON. */
  taille: number;
}

/** ⚠️ 01/11 (« ecarts-ecrans-figes », §B1) — un écart entre l'écran figé et son état actuel, libellé et valeurs formatés par le serveur. */
export interface EcartInstantane {
  chemin: string;
  libelle: string;
  /** `null` : valeur absente à la soumission (ajout). */
  soumis: string | null;
  /** `null` : valeur absente aujourd'hui (retrait). */
  actuel: string | null;
}

/** Un écran figé comparé à son état actuel. `comparable: false` : l'écran ne se recalcule pas pour l'appelant (`identique` nul). */
export interface EcartsEcranInstantane {
  ecran: EcranInstantane;
  identique: boolean | null;
  comparable: boolean;
  /** Plus de 50 écarts : la liste est coupée. */
  tronque: boolean;
  ecarts: EcartInstantane[];
}

/** `GET /api/dossiers/{id}/instantanes/ecarts[?soumission=n]` — 404 sans écran figé. */
export interface EcartsInstantanes {
  soumission: number;
  figeLe: string;
  ecrans: EcartsEcranInstantane[];
}
