import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { ControleResultat, Dossier, Instantane, Role, VersionArchivee } from '../../../models';
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

/**
 * ⚠️ Manuel révisé, R4 (V104, 13/10) — un dossier de procédure (DMC, DDM, DGC, DSS) qui porte des écrans figés les présente en
 * onglet à côté des pièces jointes ; sans instantané (dossier soumis avant V104, ou non soumis), la section des pièces reste seule.
 */
describe('DossierDocuments — écrans figés d’un dossier de procédure', () => {
  const DDM: Dossier = { idDossier: 100371, idTypeDossier: 'DDM', statut: 'SOUMIS', idLocalite: 'ANT' };
  const INSTANTANES: Instantane[] = [
    { idInstantane: 1, numeroSoumission: 1, ecran: 'PLAN', figeLe: '2026-10-13T09:00:00', figePar: 'ADMIN01', empreinte: 'a'.repeat(64), taille: 100 },
    { idInstantane: 2, numeroSoumission: 1, ecran: 'SEANCE', figeLe: '2026-10-13T09:00:00', figePar: 'ADMIN01', empreinte: 'b'.repeat(64), taille: 100 },
  ];

  const CONTROLE: ControleResultat = { idControle: 1, numeroSoumission: 1, reference: '2-II P2', idPointCtrl: null, regle: 'DELAI_PUBLICITE', libelle: 'Délai de publicité', valeurs: null, resultat: 'CONFORME', bloquant: true, auteur: 'SERVEUR', dateControle: '2026-10-13T09:00:00', observation: null };

  function monter(role: Role, instantanes: Instantane[], controles: ControleResultat[] = []): ComponentFixture<DossierDocuments> {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), DossierContenuStore, { provide: AuthService, useValue: { role: signal<Role | null>(role) } }],
    });
    const store = TestBed.inject(DossierContenuStore);
    store.charger(signal(DDM));
    const http = TestBed.inject(HttpTestingController);
    let attente: TestRequest[];
    while ((attente = http.match(() => true)).length) {
      for (const req of attente) {
        if (req.request.url.endsWith('/instantanes')) req.flush(instantanes);
        else if (req.request.url.endsWith('/controles')) req.flush(controles);
        else if (req.request.url.endsWith('/chronometrage')) req.flush(null);
        else req.flush([]);
      }
    }
    const fixture = TestBed.createComponent(DossierDocuments);
    fixture.detectChanges();
    return fixture;
  }

  it('le Membre voit « Pièces jointes » et « Écrans figés (n) » en onglets, les pièces ouvertes', () => {
    const el = monter('MEMBRE', INSTANTANES).nativeElement as HTMLElement;
    const titres = Array.from(el.querySelectorAll('[role="tab"]')).map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(titres).toEqual(['Pièces jointes 0', 'Écrans figés 2']);
    expect(el.querySelector('app-dossier-pieces')).not.toBeNull();
    expect(el.querySelector('app-dossier-instantanes')).toBeNull();
  });

  it('sans instantané ni contrôle, pas d’onglet : la section des pièces seule, comme avant', () => {
    const el = monter('MEMBRE', []).nativeElement as HTMLElement;
    expect(el.querySelector('[role="tablist"]')).toBeNull();
    expect(el.querySelector('app-dossier-pieces')).not.toBeNull();
  });

  it('⚠️ R5 — avec des contrôles enregistrés, l’onglet « Contrôles (n) » s’ajoute, en lecture (PRMP comprise)', () => {
    const fixture = monter('PRMP', [], [CONTROLE]);
    const el = fixture.nativeElement as HTMLElement;
    const titres = Array.from(el.querySelectorAll('[role="tab"]')).map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(titres).toEqual(['Pièces jointes 0', 'Contrôles 1']);
    el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    fixture.detectChanges();
    expect(el.querySelector('app-controles-dossier')).not.toBeNull();
    expect(el.querySelector('app-dossier-pieces')).toBeNull();
    // Lecture seule : ni « Lever… » ni « Ajouter ».
    expect(Array.from(el.querySelectorAll('app-controles-dossier button')).map((b) => b.textContent?.trim())).toEqual(['Exporter en PDF']);
  });
});
