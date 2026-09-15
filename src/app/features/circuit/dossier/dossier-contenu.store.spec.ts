import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { Dossier, Role, VersionArchivee } from '../../../models';
import { DossierContenuStore } from './dossier-contenu.store';

const TOUS_LES_PROFILS: Role[] = [
  'PRMP',
  'UGPM',
  'PRESIDENT',
  'CHEF_COMMISSION',
  'SECRETAIRE',
  'MEMBRE',
  'VERIFICATEUR',
  'ASSISTANT_CONTROLEUR',
  'CHARGE_PUBLICATION',
  'ADMINISTRATEUR',
];

const VERSION: VersionArchivee = { idDossier: 42, numero: 1, origine: 'RECTIFICATION', dateVersion: '2026-09-10T10:00:00', nbLignes: 0 };

/** Plan de passation en vérification : vague complète ET sondage du diff de rectification. */
const PPM_EN_VERIFICATION: Dossier = { idDossier: 42, idTypeDossier: 'DDP', statut: 'EN_VERIFICATION' };
/** Dossier hors PPM : vague réduite. */
const DMC_SOUMIS: Dossier = { idDossier: 42, idTypeDossier: 'DMC', statut: 'SOUMIS' };

function creer(role: Role): { store: DossierContenuStore; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      DossierContenuStore,
      { provide: AuthService, useValue: { role: signal<Role | null>(role) } },
    ],
  });
  return { store: TestBed.inject(DossierContenuStore), http: TestBed.inject(HttpTestingController) };
}

/** Répond à tout ce qui attend : listes vides, sauf les versions archivées fournies. */
function repondre(http: HttpTestingController, versions: VersionArchivee[]): void {
  let attente: TestRequest[];
  while ((attente = http.match(() => true)).length) {
    for (const req of attente) {
      const url = req.request.url;
      if (url.endsWith('/versions-archivees')) req.flush(versions);
      else if (url.includes('/versions-archivees/')) req.flush({ version: VERSION, lignes: [] });
      else if (url.includes('diff')) req.flush({ lignes: [] });
      else if (url.endsWith('/chronometrage')) req.flush(null);
      else req.flush([]);
    }
  }
}

const appels = (http: HttpTestingController, suffixe: string) => http.match((r) => r.url === `/api/dossiers/42/${suffixe}`);

/**
 * Lot L4-F1 — règles de visibilité par profil portées par le store partagé de la consultation et de
 * la page dossier (plan L4, §3.2). Le journal et le chronométrage sont des vues INTERNES CNM : pour la
 * PRMP et l'UGPM, ils ne sont même pas demandés (audit 2026-09-14, C2).
 */
describe('DossierContenuStore — règles par profil', () => {
  for (const role of ['PRMP', 'UGPM'] as const) {
    for (const dossier of [PPM_EN_VERIFICATION, DMC_SOUMIS]) {
      it(`${role} : ni journal ni chronométrage demandés (dossier ${dossier.idTypeDossier})`, () => {
        const { store, http } = creer(role);
        store.charger(signal(dossier));
        expect(appels(http, 'journal').length).toBe(0);
        expect(appels(http, 'chronometrage').length).toBe(0);
        expect(store.restitutionsVisibles()).toBe(false);
      });
    }
  }

  for (const role of ['PRESIDENT', 'CHEF_COMMISSION', 'SECRETAIRE', 'MEMBRE', 'VERIFICATEUR', 'ASSISTANT_CONTROLEUR'] as const) {
    it(`${role} : journal et chronométrage demandés une fois chacun, dans la vague`, () => {
      const { store, http } = creer(role);
      store.charger(signal(PPM_EN_VERIFICATION));
      expect(appels(http, 'journal').length).toBe(1);
      expect(appels(http, 'chronometrage').length).toBe(1);
      expect(store.restitutionsVisibles()).toBe(true);
    });
  }

  for (const role of TOUS_LES_PROFILS) {
    const attendu = role === 'VERIFICATEUR';
    it(`${role} : onglet historique ${attendu ? 'visible' : 'masqué'} quand une version est archivée`, () => {
      const { store, http } = creer(role);
      store.charger(signal(PPM_EN_VERIFICATION));
      repondre(http, [VERSION]);
      expect(store.loading()).toBe(false);
      expect(store.versionsArchivees().length).toBe(1);
      expect(store.historiqueVersionsVisible()).toBe(attendu);
    });
  }

  it('VERIFICATEUR : pas d’onglet historique sans version archivée', () => {
    const { store, http } = creer('VERIFICATEUR');
    store.charger(signal(PPM_EN_VERIFICATION));
    repondre(http, []);
    expect(store.historiqueVersionsVisible()).toBe(false);
  });

  for (const role of TOUS_LES_PROFILS) {
    const attendu = role === 'PRMP' || role === 'UGPM' || role === 'SECRETAIRE';
    it(`${role} : référence PPM ${attendu ? 'visible' : 'masquée'}`, () => {
      const { store } = creer(role);
      expect(store.montrerReferencePpm()).toBe(attendu);
    });
  }
});

describe('DossierContenuStore — vague et versions archivées', () => {
  it('ne rend la main (loading) qu’une fois TOUTE la vague arrivée', () => {
    const { store, http } = creer('VERIFICATEUR');
    store.charger(signal(PPM_EN_VERIFICATION));
    expect(store.loading()).toBe(true);
    appels(http, 'versions-archivees').forEach((r) => r.flush([VERSION]));
    expect(store.loading()).toBe(true);
    repondre(http, [VERSION]);
    expect(store.loading()).toBe(false);
  });

  it('lit une version archivée une seule fois, puis la sert depuis le cache', () => {
    const { store, http } = creer('VERIFICATEUR');
    store.charger(signal(PPM_EN_VERIFICATION));
    repondre(http, [VERSION]);

    store.afficherVersion(VERSION);
    expect(store.versionChargement()).toBe(true);
    const lecture = appels(http, 'versions-archivees/1');
    expect(lecture.length).toBe(1);
    lecture[0].flush({ version: VERSION, lignes: [] });
    expect(store.versionVue()?.detail.version.numero).toBe(1);

    store.choisirVersion('courante');
    expect(store.versionAffichee()).toBeNull();
    store.choisirVersion('1');
    expect(appels(http, 'versions-archivees/1').length).toBe(0);
    expect(store.versionAffichee()).toBe(1);
    expect(store.versionChargement()).toBe(false);
    expect(store.versionVue()?.detail.version.numero).toBe(1);
  });
});
