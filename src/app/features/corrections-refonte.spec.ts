import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { ToastService } from '../core/notifications/toast.service';
import { Offre, libelleEtatOffre } from '../models';
import { MesOffres } from './candidat/mes-offres';
import { ResultatsPublics } from './candidat/resultats-publics';
import { NotificationsPage } from './transverse/notifications-page';

// ⚠️ 14/10 — anomalies d'affichage relevées pendant la refonte des présentations, corrigées.
describe('Corrections de la refonte — libellés en clair', () => {
  it('le type d’une notification retrouve ses accents ; les sigles restent en capitales', () => {
    const libelle = (t: string) => NotificationsPage.prototype.libelleType.call({}, t);
    expect(libelle('CLES_PUBLIEES')).toBe('Clés publiées');
    expect(libelle('RECU_A_VALIDER')).toBe('Reçu à valider');
    expect(libelle('PV_A_COSIGNER')).toBe('PV à cosigner');
    expect(libelle('DEPOTS_CLOS')).toBe('Dépôts clos');
  });

  it('l’état d’une offre en clair, jamais le code', () => {
    expect(libelleEtatOffre('REMPLACEE')).toBe('Remplacée');
    expect(libelleEtatOffre('RETIREE')).toBe('Retirée');
    expect(libelleEtatOffre(null)).toBe('—');
  });
});

describe('Corrections de la refonte — la page publique d’une procédure', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('un lot infructueux dit sa décision et son motif, sans champs vides', () => {
    const f = TestBed.createComponent(ResultatsPublics);
    f.componentRef.setInput('idDmc', 40);
    f.detectChanges();
    http.expectOne('/api/procedures-en-ligne/40/resultats').flush([
      { lot: 1, attributaire: 'Entreprise de recette BTP', montant: 143900000, dateInformation: '2026-10-07', dateAffichage: '2026-10-07' },
      { lot: 2, attributaire: null, montant: null, dateInformation: null, dateAffichage: null, infructueux: true, motifInfructuosite: 'Aucune offre qualifiée', dateDecision: '2026-10-09' },
    ]);
    f.detectChanges();
    const t = ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    expect(t).toContain('Lot 2 — déclaré infructueux le 09/10/2026');
    expect(t).toContain('Motif : Aucune offre qualifiée');
    expect(t).not.toContain('Résultat communiqué le · affiché le');
  });

  it('une procédure sans suite le dit, avec ses motifs', () => {
    const f = TestBed.createComponent(ResultatsPublics);
    f.componentRef.setInput('idDmc', 41);
    f.detectChanges();
    http.expectOne('/api/procedures-en-ligne/41/resultats').flush([
      { lot: null, attributaire: null, montant: null, dateInformation: null, dateAffichage: null, sansSuite: true, motifsSansSuite: 'Besoin disparu', dateDecision: '2026-10-10' },
    ]);
    f.detectChanges();
    const t = ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    expect(t).toContain('Procédure déclarée sans suite le 10/10/2026');
    expect(t).toContain('Motifs : Besoin disparu');
  });
});

describe('Corrections de la refonte — « Mes offres » après la date limite', () => {
  const OFFRE = { idOffre: 'o-1', idDmc: 44, reference: null, objet: 'Location', lot: null, etat: 'DEPOSEE', dateCreation: '2026-10-04T10:00:00', dateDepot: '2026-10-04T10:05:00', dateRetrait: null, numero: 4, taille: 2048, nombreMorceaux: 1, recus: 1, empreinte: 'ab'.repeat(32), remplace: null, remplaceePar: null } as Offre;

  function monter(depotsOuverts: boolean) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(MesOffres);
    f.detectChanges();
    http.expectOne('/api/candidat/offres').flush([OFFRE]);
    f.detectChanges();
    http.expectOne('/api/procedures-en-ligne/44').flush({ idDmc: 44, depotsOuverts, remplacementAutorise: true });
    // Les composants enfants (demandes, résultat) lisent aussi : réponses vides.
    for (const r of http.match(() => true)) r.flush(null, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    return (f.nativeElement as HTMLElement).textContent ?? '';
  }
  afterEach(() => TestBed.resetTestingModule());

  it('dépôts clos : ni « Remplacer » ni « Retirer… »', () => {
    const t = monter(false);
    expect(t).not.toContain('Remplacer');
    expect(t).not.toContain('Retirer…');
    expect(t).toContain('Accusé (PDF)');
  });

  it('dépôts ouverts : les deux gestes restent proposés', () => {
    const t = monter(true);
    expect(t).toContain('Remplacer');
    expect(t).toContain('Retirer…');
  });
});
