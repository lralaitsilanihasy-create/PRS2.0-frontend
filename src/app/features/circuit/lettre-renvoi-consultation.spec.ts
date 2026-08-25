import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { LettreRenvoi } from '../../models';
import { LettreRenvoiConsultation } from './lettre-renvoi-consultation';

/**
 * Fenêtre de génération post-commit du PDF (`documentDisponible`, backend 2026-08-19) : entre la
 * signature et la production du document, un clic sur « ⬇ PDF » retombe (lentement) sur la
 * régénération paresseuse plutôt que sur un 404 — mais laisser le bouton actif pendant cette
 * fenêtre donne quand même une expérience dégradée. Ces tests verrouillent le contrat d'affichage :
 * bouton actif seulement quand le document est réellement prêt, message explicatif sinon, et
 * aucun bouton pour une lettre non signée (elle n'a jamais de document).
 */
describe('LettreRenvoiConsultation — bouton PDF conditionné à documentDisponible', () => {
  function preparer(): { fixture: ComponentFixture<LettreRenvoiConsultation>; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { source: 'localite' },
              paramMap: convertToParamMap({}),
            },
          },
        },
        { provide: AuthService, useValue: { role: () => null } },
      ],
    });
    const fixture = TestBed.createComponent(LettreRenvoiConsultation);
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  /** Bouton « ⬇ PDF » de la ligne (s'il existe), quel que soit son état. */
  function boutonPdf(tr: Element): HTMLButtonElement | undefined {
    return Array.from(tr.querySelectorAll('button')).find((b) => b.textContent?.trim() === '⬇ PDF');
  }

  const lettres: LettreRenvoi[] = [
    { idLettre: 1, idExamen: 1, statut: 'SOUMIS' },
    { idLettre: 2, idExamen: 2, statut: 'SIGNE', documentDisponible: true },
    { idLettre: 3, idExamen: 3, statut: 'SIGNE', documentDisponible: false },
  ];

  function charger(fixture: ComponentFixture<LettreRenvoiConsultation>, http: HttpTestingController): void {
    http.expectOne('/api/dossiers').flush([]);
    http.expectOne('/api/lettre-renvois').flush(lettres);
    fixture.detectChanges();
  }

  it('n’affiche aucun bouton PDF pour une lettre non signée', () => {
    const { fixture, http } = preparer();
    charger(fixture, http);

    const lignes = fixture.nativeElement.querySelectorAll('tbody > tr');
    expect(boutonPdf(lignes[0])).toBeUndefined();
    http.verify();
  });

  it('affiche un bouton PDF actif quand le document est disponible', () => {
    const { fixture, http } = preparer();
    charger(fixture, http);

    const lignes = fixture.nativeElement.querySelectorAll('tbody > tr');
    const bouton = boutonPdf(lignes[1]);
    expect(bouton).toBeDefined();
    expect(bouton!.disabled).toBe(false);
    http.verify();
  });

  it('remplace le bouton par un message le temps de la génération post-commit', () => {
    const { fixture, http } = preparer();
    charger(fixture, http);

    const lignes = fixture.nativeElement.querySelectorAll('tbody > tr');
    const bouton = boutonPdf(lignes[2]);
    expect(bouton).toBeDefined();
    expect(bouton!.disabled).toBe(true);
    expect(bouton!.title).toContain("indisponible pour l'instant");
    http.verify();
  });
});
