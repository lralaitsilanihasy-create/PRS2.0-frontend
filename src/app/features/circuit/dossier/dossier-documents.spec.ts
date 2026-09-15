import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { Dossier, Role, VersionArchivee } from '../../../models';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierDocuments } from './dossier-documents';

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

function onglets(role: Role, versions?: VersionArchivee[]): string[] {
  preparer(role, versions);
  const fixture = TestBed.createComponent(DossierDocuments);
  fixture.detectChanges();
  vider([]);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return Array.from(el.querySelectorAll('[role="tab"]')).map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim());
}

describe('DossierDocuments — onglets par profil', () => {
  it('le Vérificateur voit l’onglet « Historique des versions » (archivées + la courante)', () => {
    const titres = onglets('VERIFICATEUR');
    expect(titres).toContain('Historique des versions 2');
    expect(titres.some((t) => t.startsWith('Plan de passation'))).toBe(true);
  });

  for (const role of ['PRESIDENT', 'CHEF_COMMISSION', 'MEMBRE', 'SECRETAIRE', 'PRMP', 'UGPM'] as const) {
    it(`${role} ne voit pas l’onglet historique, même avec une version archivée`, () => {
      const titres = onglets(role);
      expect(titres.some((t) => t.startsWith('Historique'))).toBe(false);
      expect(titres.some((t) => t.startsWith('Pièces jointes'))).toBe(true);
    });
  }

  it('sans version archivée, le Vérificateur n’a pas d’onglet historique', () => {
    expect(onglets('VERIFICATEUR', []).some((t) => t.startsWith('Historique'))).toBe(false);
  });
});
