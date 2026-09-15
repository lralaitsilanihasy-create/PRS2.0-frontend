import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Role } from '../../models';
import { AuthService } from '../auth/auth.service';
import { dossierAliasGuard } from './dossier-alias.guard';

@Component({ template: '' })
class EcranFactice {}

const ESPACES = ['prmp', 'secretaire', 'membre', 'president', 'cc', 'verificateur', 'assistant'];

async function naviguer(role: Role, url: string): Promise<string> {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { role: signal<Role | null>(role) } },
      provideRouter([
        { path: 'dossier/:idDossier', canActivate: [dossierAliasGuard], children: [] },
        { path: 'acces-refuse', component: EcranFactice },
        ...ESPACES.map((espace) => ({ path: `${espace}/dossier/:idDossier`, component: EcranFactice })),
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  return TestBed.inject(Router).url;
}

/** Lot L4-F2 — l'alias `/dossier/:id` mène chaque profil du circuit à la page de son espace (plan L4, §2). */
describe('dossierAliasGuard', () => {
  const attendus: [Role, string][] = [
    ['PRESIDENT', 'president'],
    ['CHEF_COMMISSION', 'cc'],
    ['SECRETAIRE', 'secretaire'],
    ['MEMBRE', 'membre'],
    ['VERIFICATEUR', 'verificateur'],
    ['ASSISTANT_CONTROLEUR', 'assistant'],
    ['PRMP', 'prmp'],
    ['UGPM', 'prmp'],
  ];

  for (const [role, espace] of attendus) {
    it(`${role} arrive dans l'espace « ${espace} »`, async () => {
      expect(await naviguer(role, '/dossier/100007')).toBe(`/${espace}/dossier/100007`);
    });
  }

  it('garde les paramètres de requête et le fragment', async () => {
    expect(await naviguer('MEMBRE', '/dossier/42?returnUrl=%2Fmembre%2Fa-faire&geste=EXAMINER#plan')).toBe(
      '/membre/dossier/42?returnUrl=%2Fmembre%2Fa-faire&geste=EXAMINER#plan',
    );
  });

  for (const role of ['ADMINISTRATEUR', 'CHARGE_PUBLICATION'] as const) {
    it(`${role} n'a pas la page : accès refusé`, async () => {
      expect(await naviguer(role, '/dossier/100007')).toBe('/acces-refuse');
    });
  }
});
