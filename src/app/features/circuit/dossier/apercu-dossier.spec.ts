import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { Dossier, Role } from '../../../models';
import { ApercuDossier } from './apercu-dossier';

@Component({
  imports: [ApercuDossier],
  template: `
    <app-apercu-dossier [dossier]="dossier" [lien]="['/president', 'dossier', 42]" [params]="{ retour: 'liste' }">
      <span gestes><button type="button" class="geste">Dispatcher</button></span>
      <div frise class="frise">frise du dossier</div>
    </app-apercu-dossier>
  `,
})
class Hote {
  dossier = { idDossier: 42, refeDossier: '00011/DAOO/CNM/2026', idTypeDossier: 'DMC', statut: 'SOUMIS' } as unknown as Dossier;
}

/** Répond à tout ce qui attend (listes vides) : la vague se termine, l'identité se monte. */
function repondre(http: HttpTestingController): void {
  let attente: TestRequest[];
  while ((attente = http.match(() => true)).length) {
    for (const req of attente) req.flush(req.request.url.endsWith('/chronometrage') ? null : []);
  }
}

// ⚠️ 31/10 (Espace de travail, lot 3c) — l'aperçu d'un dossier dans le volet de droite d'une liste.
describe('Aperçu du dossier (volet de droite)', () => {
  const monter = () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { role: signal<Role | null>('PRESIDENT') } },
      ],
    });
    const fixture = TestBed.createComponent(Hote);
    fixture.detectChanges();
    return { fixture, hote: fixture.nativeElement as HTMLElement, http: TestBed.inject(HttpTestingController) };
  };
  const texte = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('référence, statut, gestes de l’hôte avec « Ouvrir la page du dossier », frise ; l’identité une fois le contenu lu', () => {
    const { fixture, hote, http } = monter();
    expect(texte(hote.querySelector('.ad__ref'))).toBe('00011/DAOO/CNM/2026');
    expect(hote.querySelector('.ad__statut app-statut-badge')).not.toBeNull();
    expect(Array.from(hote.querySelectorAll('.ad__gestes button, .ad__gestes a')).map((b) => texte(b))).toEqual(['Dispatcher', 'Ouvrir la page du dossier']);
    expect(hote.querySelector('.ad__gestes a')?.getAttribute('href')).toBe('/president/dossier/42?retour=liste');
    expect(texte(hote.querySelector('.frise'))).toBe('frise du dossier');
    expect(hote.querySelector('[role="status"]')).not.toBeNull();
    expect(hote.querySelector('app-dossier-identite')).toBeNull();

    repondre(http);
    fixture.detectChanges();
    expect(hote.querySelector('[role="status"]')).toBeNull();
    expect(hote.querySelector('app-dossier-identite')).not.toBeNull();
  });
});
