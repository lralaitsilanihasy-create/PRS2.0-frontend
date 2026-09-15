import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { DiffDossier, Dossier, Role, VersionArchivee } from '../../../models';
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

  /**
   * Recette L4-Q2, défaut (m) : après un geste fait sur la page dossier, le journal et le chronométrage
   * sont relus — eux SEULS. Sans cela, le compteur du bouton « Journal » restait sur sa valeur
   * d'ouverture jusqu'au prochain rechargement.
   */
  describe('relecture des restitutions après un geste', () => {
    it('contrôleur : journal et chronométrage relus, rien d’autre', () => {
      const { store, http } = creer('PRESIDENT');
      store.charger(signal(PPM_EN_VERIFICATION));
      repondre(http, []);
      store.rafraichirRestitutions();
      expect(appels(http, 'journal').length).toBe(1);
      expect(appels(http, 'chronometrage').length).toBe(1);
      expect(http.match(() => true).length).toBe(0);
    });

    for (const role of ['PRMP', 'UGPM'] as const) {
      it(`${role} : rien n’est demandé (règle C2)`, () => {
        const { store, http } = creer(role);
        store.charger(signal(PPM_EN_VERIFICATION));
        repondre(http, []);
        store.rafraichirRestitutions();
        expect(http.match(() => true).length).toBe(0);
      });
    }

    it('sans charger() : aucun appel, aucune exception', () => {
      const { store, http } = creer('PRESIDENT');
      store.rafraichirRestitutions();
      expect(http.match(() => true).length).toBe(0);
    });
  });

  for (const role of TOUS_LES_PROFILS) {
    const attendu = role === 'VERIFICATEUR';
    // L'UGPM et le Chargé de publication ne lisent pas le versionnement (403 serveur) : rien n'est demandé.
    const lues = role !== 'UGPM' && role !== 'CHARGE_PUBLICATION';
    it(`${role} : onglet historique ${attendu ? 'visible' : 'masqué'} quand une version est archivée`, () => {
      const { store, http } = creer(role);
      store.charger(signal(PPM_EN_VERIFICATION));
      repondre(http, [VERSION]);
      expect(store.loading()).toBe(false);
      expect(store.versionsArchivees().length).toBe(lues ? 1 : 0);
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

/**
 * Lot L4-F2 — plus de 403 ni de 409 muets à l'ouverture (plan L4, §8.2). Vaut pour la modale de
 * consultation comme pour la page dossier : les deux passent par ce store.
 */
describe('DossierContenuStore — lectures du versionnement demandées à bon escient', () => {
  /** Mise à jour d'un PPM, en vérification : sonde le diff de mise à jour ET le diff de rectification. */
  const MISE_A_JOUR_EN_VERIFICATION: Dossier = { ...PPM_EN_VERIFICATION, idDossierParent: 41 };
  const DIFF_RECTIFICATION: DiffDossier = {
    idDossier: 42,
    fige: false,
    recap: { inchangees: 0, modifiees: 1, nouvelles: 0, supprimees: 0, restaurees: 0, total: 1 },
    lignes: [{ idDetail: 7, idLigneOrigine: 7, type: 'MODIFIEE', apparieePar: 'ORIGINE', champs: [{ champ: 'montEstim', avant: '10', apres: '12' }] }],
  };

  for (const role of ['UGPM', 'CHARGE_PUBLICATION'] as const) {
    it(`${role} : ni diff, ni diff de rectification, ni versions archivées (le serveur répond 403)`, () => {
      const { store, http } = creer(role);
      store.charger(signal(MISE_A_JOUR_EN_VERIFICATION));
      expect(store.lectureVersionsPermise()).toBe(false);
      expect(appels(http, 'diff').length).toBe(0);
      expect(appels(http, 'versions-archivees').length).toBe(0);
      repondre(http, []);
      expect(appels(http, 'diff-rectification').length).toBe(0);
      expect(store.loading()).toBe(false);
    });
  }

  for (const role of ['PRMP', 'PRESIDENT', 'CHEF_COMMISSION', 'SECRETAIRE', 'MEMBRE', 'VERIFICATEUR', 'ASSISTANT_CONTROLEUR', 'ADMINISTRATEUR'] as const) {
    it(`${role} : diff de mise à jour et versions archivées demandés une fois chacun`, () => {
      const { store, http } = creer(role);
      store.charger(signal(MISE_A_JOUR_EN_VERIFICATION));
      expect(store.lectureVersionsPermise()).toBe(true);
      expect(appels(http, 'diff').length).toBe(1);
      expect(appels(http, 'versions-archivees').length).toBe(1);
    });
  }

  it('dossier jamais rectifié : le diff de rectification n’est pas demandé (le serveur répondrait 409)', () => {
    const { store, http } = creer('VERIFICATEUR');
    store.charger(signal(PPM_EN_VERIFICATION));
    expect(appels(http, 'diff-rectification').length).toBe(0);
    appels(http, 'versions-archivees').forEach((r) => r.flush([]));
    expect(appels(http, 'diff-rectification').length).toBe(0);
    repondre(http, []);
    expect(store.loading()).toBe(false);
    expect(store.changements()).toBeNull();
  });

  it('dossier rectifié : le diff du dernier cycle est lu après les versions, et appliqué dans la vague', () => {
    const { store, http } = creer('VERIFICATEUR');
    store.charger(signal(PPM_EN_VERIFICATION));
    appels(http, 'versions-archivees').forEach((r) => r.flush([VERSION]));
    const diff = appels(http, 'diff-rectification');
    expect(diff.length).toBe(1);
    diff[0].flush(DIFF_RECTIFICATION);
    expect(store.loading()).toBe(true);
    repondre(http, [VERSION]);
    expect(store.loading()).toBe(false);
    expect(store.legendeChangements()).toBe('Rectification :');
    expect(store.changements()?.get(7)).toBe('MODIFIEE');
    expect(store.detailsChangements()?.get(7)).toBe('montEstim : 10 → 12');
  });

  it('statut hors rectification : pas de diff de rectification, même avec une version archivée', () => {
    const { store, http } = creer('PRESIDENT');
    store.charger(signal({ ...PPM_EN_VERIFICATION, statut: 'DISPATCHE' }));
    appels(http, 'versions-archivees').forEach((r) => r.flush([VERSION]));
    expect(appels(http, 'diff-rectification').length).toBe(0);
  });
});
