import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { Dossier, Ppm, Role, VersionArchivee } from '../../../models';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierIdentite } from './dossier-identite';

const VERSION: VersionArchivee = { idDossier: 42, numero: 1, origine: 'RECTIFICATION', dateVersion: '2026-09-10T10:00:00', nbLignes: 0 };
const PPM: Dossier = { idDossier: 42, idTypeDossier: 'DDP', statut: 'EN_VERIFICATION', idLocalite: 'ANT' };

function preparer(role: Role, versions: VersionArchivee[] = [VERSION]): DossierContenuStore {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      DossierContenuStore,
      { provide: AuthService, useValue: { role: signal<Role | null>(role) } },
    ],
  });
  const store = TestBed.inject(DossierContenuStore);
  store.charger(signal(PPM));
  vider(versions);
  return store;
}

/** Répond à tout ce qui attend (listes vides, versions archivées fournies), rendu des blocs compris. */
function vider(versions: VersionArchivee[]): void {
  const http = TestBed.inject(HttpTestingController);
  let attente: TestRequest[];
  while ((attente = http.match(() => true)).length) {
    for (const req of attente) {
      const url = req.request.url;
      if (url.endsWith('/versions-archivees')) req.flush(versions);
      else if (url.includes('diff')) req.flush({ lignes: [] });
      else if (url.endsWith('/chronometrage')) req.flush(null);
      else req.flush([]);
    }
  }
}

describe('DossierIdentite — référence PPM par profil', () => {
  const PPM_LU = { idPpm: 7, idDossier: 42, exercice: 2026, reference: 'REF-PRMP-2026', signataire: 'Signataire' } as Ppm;

  function lignes(role: Role): string[] {
    const store = preparer(role, []);
    store.ppm.set(PPM_LU);
    const fixture = TestBed.createComponent(DossierIdentite);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    return Array.from(el.querySelectorAll('.dc-meta-label')).map((l) => (l.textContent ?? '').trim());
  }

  for (const role of ['PRMP', 'UGPM', 'SECRETAIRE'] as const) {
    it(`${role} voit la référence PRMP`, () => {
      expect(lignes(role)).toContain('Référence PRMP');
    });
  }

  for (const role of ['PRESIDENT', 'CHEF_COMMISSION', 'MEMBRE', 'VERIFICATEUR', 'ASSISTANT_CONTROLEUR'] as const) {
    it(`${role} ne voit pas la référence PRMP`, () => {
      const vues = lignes(role);
      expect(vues).not.toContain('Référence PRMP');
      expect(vues).toContain('Exercice');
    });
  }
});
