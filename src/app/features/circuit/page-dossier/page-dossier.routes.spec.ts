import { Route, Routes } from '@angular/router';

import { routes as APP_ROUTES } from '../../../app.routes';
import { dossierAliasGuard } from '../../../core/navigation/dossier-alias.guard';
import { ASSISTANT_ROUTES } from '../../assistant/assistant.routes';
import { CC_ROUTES } from '../../cc/cc.routes';
import { MEMBRE_ROUTES } from '../../membre/membre.routes';
import { PRESIDENT_ROUTES } from '../../president/president.routes';
import { PRMP_ROUTES } from '../../prmp/prmp.routes';
import { SECRETAIRE_ROUTES } from '../../secretaire/secretaire.routes';
import { VERIFICATEUR_ROUTES } from '../../verificateur/verificateur.routes';
import { PageDossier } from './page-dossier';

/**
 * Lot L4-F2 — la page dossier est montée dans chacun des sept espaces du circuit (l'UGPM passe par
 * `prmp`), en mode « concentration », et l'alias `/dossier/:idDossier` passe par sa garde (plan L4, §2).
 */
describe('Routes de la page dossier', () => {
  const espaces: [string, Routes][] = [
    ['prmp', PRMP_ROUTES],
    ['secretaire', SECRETAIRE_ROUTES],
    ['membre', MEMBRE_ROUTES],
    ['president', PRESIDENT_ROUTES],
    ['cc', CC_ROUTES],
    ['verificateur', VERIFICATEUR_ROUTES],
    ['assistant', ASSISTANT_ROUTES],
  ];

  for (const [espace, routes] of espaces) {
    it(`${espace} : dossier/:idDossier, chargée à la demande, en concentration`, async () => {
      const route = routes.find((r) => r.path === 'dossier/:idDossier');
      expect(route?.data).toEqual({ title: 'Dossier', concentration: true });
      expect(route?.component).toBeUndefined();
      expect(await route?.loadComponent?.()).toBe(PageDossier);
    });
  }

  it('alias /dossier/:idDossier sous la coquille authentifiée, gardé par la redirection', () => {
    const coquille = APP_ROUTES.find((r) => r.path === '' && r.children);
    const alias = coquille?.children?.find((r: Route) => r.path === 'dossier/:idDossier');
    expect(coquille?.canActivate?.length).toBe(1);
    expect(alias?.canActivate).toEqual([dossierAliasGuard]);
  });
});
