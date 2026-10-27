import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { ApiError } from '../../core/errors/api-error';
import { Capm } from '../../models';
import { CalendrierAnnuel } from '../circuit/calendrier-annuel';
import { messageSoumissionRefusee } from '../circuit/controles-libelles';
import { PpmFormFactory } from './ppm-form-factory';
import { PpmSaisieGrid } from './ppm-saisie-grid';

// ⚠️ Q-pièce (arbitrage du pilote, 14/10 ; backend Q1 V114 et Q2 V115) — calendrier complet, « sans objet », calendrier annuel produit.
const CAPMS: Capm[] = [
  { idCapm: 1, libelleProcessus: 'Lancement du DAO', ordre: 1, idMode: null } as Capm,
  { idCapm: 2, libelleProcessus: 'Ouverture des plis', ordre: 2, idMode: null } as Capm,
];
const refus = (code: string, details: unknown): ApiError =>
  ({ status: 409, message: 'x', code, raw: { error: { code, details } } }) as unknown as ApiError;

describe('Q-pièce — le refus CAPM_INCOMPLET, nommé ligne par ligne', () => {
  it('liste chaque ligne et ses processus manquants', () => {
    const m = messageSoumissionRefusee(refus('CAPM_INCOMPLET', { lignes: [{ idDetail: 7, designation: 'Pont', processus: ['Ouverture des plis', 'Attribution'] }] }));
    expect(m).toContain('calendrier prévisionnel est incomplet');
    expect(m).toContain('• Pont — Ouverture des plis, Attribution');
  });

  it('au-delà de trois processus, leur nombre ; au-delà de dix lignes, le reste compté (27/10)', () => {
    const processus = Array.from({ length: 27 }, (_, i) => 'P' + i);
    const lignes = Array.from({ length: 12 }, (_, i) => ({ idDetail: i, designation: 'Ligne ' + i, processus }));
    const m = messageSoumissionRefusee(refus('CAPM_INCOMPLET', { lignes }));
    expect(m).toContain('12 ligne(s) à compléter');
    expect(m).toContain('• Ligne 0 — 27 processus à dater');
    expect(m).toContain('… et 2 autre(s) ligne(s)');
    expect(m).not.toContain('P26');
  });
});

describe('Q-pièce — « sans objet » dans la fenêtre du calendrier', () => {
  function monter() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const f = TestBed.createComponent(PpmSaisieGrid);
    f.componentRef.setInput('capms', CAPMS);
    f.detectChanges();
    const factory = TestBed.inject(PpmFormFactory);
    const ligne = factory.ligneMarche();
    return { c: f.componentInstance, ligne, factory };
  }
  afterEach(() => TestBed.resetTestingModule());

  it('un processus sans objet exige son motif, n’a pas de date, et part ainsi au serveur', () => {
    const { c, ligne, factory } = monter();
    c.ouvrirDates(ligne);
    const [lancement, ouverture] = c.procControls();
    lancement.get('dateDebut')!.setValue('2026-11-02');
    ouverture.get('sansObjet')!.setValue(true);
    c.basculerSansObjet(ouverture);
    expect(ouverture.get('dateDebut')!.disabled).toBe(true);
    expect(c.procRestants()).toBe(0);

    c.validerDates();
    expect(c.procErreur(2)).toContain('motif');
    expect(c.datesCible()).not.toBeNull();

    ouverture.get('motifSansObjet')!.setValue('Procédure sans séance publique');
    c.validerDates();
    expect(c.datesCible()).toBeNull();
    const envoi = factory.processusPourEnvoi((ligne.get('processus') as FormArray).getRawValue() as Record<string, unknown>[]);
    expect(envoi).toEqual([
      { idCapm: 1, dateDebut: '2026-11-02', dateFin: undefined },
      { idCapm: 2, sansObjet: true, motifSansObjet: 'Procédure sans séance publique' },
    ]);
  });

  it('un brouillon s’enregistre incomplet, mais la fenêtre dit combien de processus restent', () => {
    const { c, ligne } = monter();
    c.ouvrirDates(ligne);
    c.procControls()[0].get('dateDebut')!.setValue('2026-11-02');
    expect(c.procRestants()).toBe(1);
    c.validerDates();
    expect(c.datesCible()).toBeNull();
    expect(((ligne.get('processus') as FormArray).controls as FormGroup[]).length).toBe(1);
  });
});

describe('Q-pièce — le calendrier annuel produit par l’application', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  function monter() {
    const f = TestBed.createComponent(CalendrierAnnuel);
    f.componentRef.setInput('idDossier', 100359);
    f.detectChanges();
    (f.nativeElement as HTMLElement).querySelector('button')!.click();
    return f;
  }

  it('ouvre le PDF servi', () => {
    const ouvrir = vi.spyOn(window, 'open').mockReturnValue(null);
    monter();
    http.expectOne('/api/dossiers/100359/calendrier-annuel').flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(ouvrir).toHaveBeenCalled();
    ouvrir.mockRestore();
  });

  it('nomme CALENDRIER_INDISPONIBLE, lu dans le corps binaire du refus', async () => {
    const f = monter();
    const corps = new Blob([JSON.stringify({ code: 'CALENDRIER_INDISPONIBLE', message: 'x' })], { type: 'application/json' });
    http.expectOne('/api/dossiers/100359/calendrier-annuel').flush(corps, { status: 409, statusText: 'Conflict' });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('[role=alert]')?.textContent).toContain('pas de plan de passation dans l’application');
  });
});
