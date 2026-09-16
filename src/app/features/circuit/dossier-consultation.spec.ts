import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../models';
import { DossierConsultation } from './dossier-consultation';

function ouvrirEnTantQue(role: Role): { fixture: ComponentFixture<DossierConsultation>; http: HttpTestingController } {
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
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

const appels = (http: HttpTestingController, suffixe: string) => http.match((r) => r.url === `/api/dossiers/42/${suffixe}`);

/** Répond à tout ce qui attend (listes vides) : la vague se termine, le panneau se monte. */
function repondre(http: HttpTestingController): void {
  let attente: TestRequest[];
  while ((attente = http.match(() => true)).length) {
    for (const req of attente) req.flush(req.request.url.endsWith('/chronometrage') ? null : []);
  }
}

/**
 * Audit 2026-09-14 (C2) — le journal des actions et le chronométrage sont des vues INTERNES CNM.
 * La consultation les masquait pour la PRMP et son UGPM, mais les DEMANDAIT quand même : le serveur
 * leur livrait ainsi consignes de dispatch, commentaires de navette et acteurs de chaque étape.
 * Désormais le serveur répond 403 au journal pour ces profils ; la consultation ne doit plus
 * l'appeler (sans quoi l'erreur remonterait en toast à chaque ouverture), ni le chronométrage.
 */
describe('DossierConsultation — restitutions internes CNM', () => {
  for (const role of ['PRMP', 'UGPM'] as const) {
    it(`n'appelle ni le journal ni le chronométrage pour le profil ${role}`, () => {
      const { http } = ouvrirEnTantQue(role);
      expect(appels(http, 'journal').length).toBe(0);
      expect(appels(http, 'chronometrage').length).toBe(0);
    });
  }

  it('continue de charger journal et chronométrage pour un contrôleur', () => {
    const { http } = ouvrirEnTantQue('CHEF_COMMISSION');
    expect(appels(http, 'journal').length).toBe(1);
    expect(appels(http, 'chronometrage').length).toBe(1);
  });
});

/**
 * Lot L4-F7 — la coquille n'a plus qu'une forme. Le mode « embarqué » (rendu inline, sans voile,
 * sans bouton de fermeture ni pied) servait au seul écran de vérification, qui monte désormais le
 * bloc `DossierDocuments` directement. Ce qui subsiste est donc toujours un dialogue : voile,
 * `role="dialog"` nommé, croix de fermeture, pied — sans condition.
 */
describe('DossierConsultation — toujours une modale', () => {
  it('se rend en dialogue complet, quel que soit le contexte', () => {
    const { fixture, http } = ouvrirEnTantQue('VERIFICATEUR');
    repondre(http);
    fixture.detectChanges();
    const hote: HTMLElement = fixture.nativeElement;

    expect(hote.querySelector('.modal-backdrop')).toBeTruthy();
    const dialogue = hote.querySelector('.dc');
    expect(dialogue?.getAttribute('role')).toBe('dialog');
    expect(dialogue?.getAttribute('aria-modal')).toBe('true');
    // Nom accessible du dialogue : « Consultation — <type du dossier> » (acquis de l'audit a11y).
    expect(dialogue?.getAttribute('aria-label')).toContain('Consultation');
    expect(hote.querySelector('.dc-close')?.getAttribute('aria-label')).toBe('Fermer');
    expect(hote.querySelector('.dc-foot')).toBeTruthy();
  });

  it("n'expose plus d'entrée « embedded »", () => {
    const { fixture } = ouvrirEnTantQue('VERIFICATEUR');
    const entrees = Object.keys(fixture.componentInstance);
    // Témoin : la liste porte bien les entrées du composant — sans quoi l'assertion suivante
    // passerait pour de mauvaises raisons.
    expect(entrees).toContain('dossier');
    expect(entrees).not.toContain('embedded');
  });
});
