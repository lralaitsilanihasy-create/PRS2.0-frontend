import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../models';
import { DossierConsultation } from './dossier-consultation';

/**
 * Audit 2026-09-14 (C2) — le journal des actions et le chronométrage sont des vues INTERNES CNM.
 * La consultation les masquait pour la PRMP et son UGPM, mais les DEMANDAIT quand même : le serveur
 * leur livrait ainsi consignes de dispatch, commentaires de navette et acteurs de chaque étape.
 * Désormais le serveur répond 403 au journal pour ces profils ; la consultation ne doit plus
 * l'appeler (sans quoi l'erreur remonterait en toast à chaque ouverture), ni le chronométrage.
 */
describe('DossierConsultation — restitutions internes CNM', () => {
  function ouvrirEnTantQue(role: Role): HttpTestingController {
    TestBed.configureTestingModule({
      imports: [DossierConsultation],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { role: signal<Role | null>(role) } },
      ],
    });
    const fixture = TestBed.createComponent(DossierConsultation);
    // Dossier hors PPM au statut SOUMIS : vague réduite, aucun sondage de diff.
    fixture.componentRef.setInput('dossier', { idDossier: 42, idTypeDossier: 'DMC', statut: 'SOUMIS' });
    fixture.detectChanges();
    return TestBed.inject(HttpTestingController);
  }

  const appels = (http: HttpTestingController, suffixe: string) =>
    http.match((r) => r.url === `/api/dossiers/42/${suffixe}`);

  for (const role of ['PRMP', 'UGPM'] as const) {
    it(`n'appelle ni le journal ni le chronométrage pour le profil ${role}`, () => {
      const http = ouvrirEnTantQue(role);
      expect(appels(http, 'journal').length).toBe(0);
      expect(appels(http, 'chronometrage').length).toBe(0);
    });
  }

  it('continue de charger journal et chronométrage pour un contrôleur', () => {
    const http = ouvrirEnTantQue('CHEF_COMMISSION');
    expect(appels(http, 'journal').length).toBe(1);
    expect(appels(http, 'chronometrage').length).toBe(1);
  });
});
