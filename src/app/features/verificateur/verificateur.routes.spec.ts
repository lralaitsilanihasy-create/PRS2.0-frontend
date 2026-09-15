import { Routes } from '@angular/router';

import { CC_ROUTES } from '../cc/cc.routes';
import { MEMBRE_ROUTES } from '../membre/membre.routes';
import { PRESIDENT_ROUTES } from '../president/president.routes';
import { VERIFICATEUR_ROUTES } from './verificateur.routes';

/**
 * ⚠️ Refonte ergonomique (recette du 2026-09-15) — le plan de passation de la vérification n'est
 * fluide (13 colonnes, aucun défilement horizontal à 1366 px) que si la barre latérale se range en
 * tiroir : les écrans de travail sur UN dossier déclarent le mode « concentration », dans chaque
 * espace qui les monte (titulaire et délégation).
 */
describe('Mode « concentration » des écrans de travail sur un dossier', () => {
  const route = (routes: Routes, chemin: string) => routes.find((r) => r.path === chemin);

  it('vérification : Vérificateur, Président et Chef de commission', () => {
    for (const routes of [VERIFICATEUR_ROUTES, PRESIDENT_ROUTES, CC_ROUTES]) {
      expect(route(routes, 'verifier/:idDossier')?.data).toEqual({ title: 'Vérifier un dossier', concentration: true });
    }
  });

  it("examen : l'écran de référence de la refonte garde le mode", () => {
    for (const routes of [MEMBRE_ROUTES, PRESIDENT_ROUTES, CC_ROUTES]) {
      expect(route(routes, 'examiner/:idDossier')?.data?.['concentration']).toBe(true);
    }
  });
});
