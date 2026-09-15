import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { AFaire, Role } from '../../models';
import { DossierService } from '../../services';
import { exempleAFairePresident } from './a-faire/a-faire-contrat.exemple';
import { Home } from './home';

const erreur = (status: number, fieldErrors?: Record<string, string>): ApiError => ({ status, message: 'x', fieldErrors, raw: new HttpErrorResponse({ status }) });

describe("Accueil — atterrissage sur « À faire », avec repli", () => {
  const monter = (role: Role, reponse: () => Observable<AFaire>) => {
    const aFaire = vi.fn(reponse);
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { role: signal(role), login: signal('X'), nomAffichage: signal('RAKOTO Jean'), typeActeur: signal('CONTROLEUR'), localite: signal('ANT') },
        },
        { provide: DossierService, useValue: { aFaire } },
      ],
    });
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    return { aFaire, naviguer, fixture };
  };

  it("endpoint servi : « À faire » de l'espace, en transmettant la réponse", () => {
    const reponse = exempleAFairePresident();
    const { aFaire, naviguer } = monter('PRESIDENT', () => of(reponse));
    expect(aFaire).toHaveBeenCalledWith(false);
    expect(naviguer).toHaveBeenCalledWith('/president/a-faire', { replaceUrl: true, state: { aFaire: reponse } });
  });

  it("404, 501, ou route inconnue du backend (400 sur « id ») : l'atterrissage d'avant", () => {
    expect(monter('PRESIDENT', () => throwError(() => erreur(404))).naviguer).toHaveBeenCalledWith('/president/tableau-de-bord', { replaceUrl: true });
    TestBed.resetTestingModule();
    expect(monter('CHEF_COMMISSION', () => throwError(() => erreur(501))).naviguer).toHaveBeenCalledWith('/cc/tableau-de-bord', { replaceUrl: true });
    TestBed.resetTestingModule();
    expect(monter('PRMP', () => throwError(() => erreur(400, { id: 'valeur numérique attendue.' }))).naviguer).toHaveBeenCalledWith('/prmp/tableau-de-bord', {
      replaceUrl: true,
    });
  });

  it("repli d'un profil sans atterrissage dédié (Vérificateur) : la page d'accueil reste affichée", () => {
    const { naviguer, fixture } = monter('VERIFICATEUR', () => throwError(() => erreur(404)));
    fixture.detectChanges();
    expect(naviguer).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('.home__title')?.textContent).toContain('Bonjour RAKOTO Jean');
  });

  it('panne passagère (500) : « À faire » quand même, qui proposera « Réessayer » ; 401 : rien (login)', () => {
    expect(monter('MEMBRE', () => throwError(() => erreur(500))).naviguer).toHaveBeenCalledWith('/membre/a-faire', { replaceUrl: true });
    TestBed.resetTestingModule();
    expect(monter('MEMBRE', () => throwError(() => erreur(401))).naviguer).not.toHaveBeenCalled();
  });

  it("profils hors contrat : aucune sonde, la page d'accueil", () => {
    const { aFaire, naviguer, fixture } = monter('ADMINISTRATEUR', () => of(exempleAFairePresident()));
    expect(aFaire).not.toHaveBeenCalled();
    expect(naviguer).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).toBeNull();
  });
});
