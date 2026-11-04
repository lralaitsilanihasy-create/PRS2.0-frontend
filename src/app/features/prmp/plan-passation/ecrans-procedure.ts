import { Type } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

/** Les écrans de la procédure en ligne qui s'ouvrent en fenêtre depuis le plan. */
export type EcranProcedure = 'cao' | 'ami' | 'recus' | 'retraits' | 'questions' | 'depots' | 'seance' | 'evaluation';

/** Ce qu'une rangée demande d'ouvrir : l'écran, sa procédure, et le titre de la fenêtre. */
export interface OuvertureEcran {
  cle: EcranProcedure;
  idDmc: number;
  libelle: string;
  /** « Procédure 15/MTP/SG/PRMP.2026 », ou l'objet de la ligne avant le numéro. */
  sousTitre: string;
}

/**
 * ⚠️ 04/11 (pilote) — chaque écran, chargé à la demande (les mêmes que leurs routes : rien n'alourdit l'écran du plan tant qu'on
 * n'ouvre pas la fenêtre).
 */
export const CHARGEURS_ECRAN: Readonly<Record<EcranProcedure, () => Promise<Type<unknown>>>> = {
  cao: () => import('../cao-ecran').then((m) => m.CaoEcran),
  ami: () => import('../ami-dao').then((m) => m.AmiDao),
  recus: () => import('../recus-dao').then((m) => m.RecusDao),
  retraits: () => import('../retraits-dao').then((m) => m.RetraitsDao),
  questions: () => import('../questions-dao').then((m) => m.QuestionsDao),
  depots: () => import('../depots-dao').then((m) => m.DepotsDao),
  seance: () => import('../../procedure/seance-ecran').then((m) => m.SeanceEcran),
  evaluation: () => import('../../evaluation/evaluation-ecran').then((m) => m.EvaluationEcran),
};

/**
 * La route que lisent ces écrans (\`route.snapshot.paramMap.get('idDmc')\`, et \`data.espace\` pour l'évaluation), fournie à la fenêtre :
 * ils s'y affichent comme sur leur page, sans en changer une ligne. Leurs liens sont absolus (\`/procedure/…\`, \`/prmp/dao/…\`) : la route
 * fournie ne sert à aucun lien relatif.
 */
export function routeDeProcedure(idDmc: number): Partial<ActivatedRoute> {
  const params = { idDmc: String(idDmc) };
  const paramMap = convertToParamMap(params);
  const queryParamMap = convertToParamMap({});
  const data = { espace: 'interne' };
  return {
    snapshot: { params, paramMap, queryParams: {}, queryParamMap, data } as unknown as ActivatedRoute['snapshot'],
    params: of(params),
    paramMap: of(paramMap),
    queryParams: of({}),
    queryParamMap: of(queryParamMap),
    data: of(data),
  };
}
