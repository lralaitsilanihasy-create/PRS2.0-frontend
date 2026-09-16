import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { Role } from '../../../models';
import { LienDossier } from './lien-dossier';

/**
 * Lot L4-F6 — le lien d'une liste vers la page d'un dossier. Deux règles tiennent tout le lot :
 * l'espace vient du RÔLE (pas de l'URL), et le retour est l'URL courante entière.
 */
describe('LienDossier', () => {
  let url = '/president/tableau-de-bord?page=1';
  const role = signal<Role | null>('PRESIDENT');

  const service = (): LienDossier => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { role } },
        { provide: Router, useValue: { get url() { return url; } } },
      ],
    });
    return TestBed.inject(LienDossier);
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('chaque profil du circuit a la page dans SON espace', () => {
    const s = service();
    const attendu: [Role, string][] = [
      ['PRESIDENT', 'president'],
      ['CHEF_COMMISSION', 'cc'],
      ['SECRETAIRE', 'secretaire'],
      ['MEMBRE', 'membre'],
      ['VERIFICATEUR', 'verificateur'],
      ['ASSISTANT_CONTROLEUR', 'assistant'],
      ['PRMP', 'prmp'],
      ['UGPM', 'prmp'],
    ];
    for (const [r, espace] of attendu) {
      role.set(r);
      expect(s.disponible()).toBe(true);
      expect(s.commandes(1052)).toEqual(['/', espace, 'dossier', 1052]);
    }
  });

  it("sans espace (Administrateur, Chargé de publication) : aucun lien, l'écran garde ce qu'il avait", () => {
    const s = service();
    for (const r of ['ADMINISTRATEUR', 'CHARGE_PUBLICATION'] as Role[]) {
      role.set(r);
      expect(s.disponible()).toBe(false);
      expect(s.commandes(1052)).toEqual([]);
    }
    role.set(null);
    expect(s.disponible()).toBe(false);
  });

  it("le retour est l'URL courante ENTIÈRE : page, filtres et tri de la liste", () => {
    role.set('PRESIDENT');
    const s = service();
    expect(s.params()).toEqual({ returnUrl: '/president/tableau-de-bord?page=1' });
    url = '/president/repartition-dispatch?controleur=MEMANT2';
    expect(s.params()).toEqual({ returnUrl: '/president/repartition-dispatch?controleur=MEMANT2' });
  });

  it("un écran qui sait mieux que l'URL où revenir impose son retour", () => {
    role.set('MEMBRE');
    const s = service();
    expect(s.params('/membre/a-faire?vue=etape')).toEqual({ returnUrl: '/membre/a-faire?vue=etape' });
  });
});
