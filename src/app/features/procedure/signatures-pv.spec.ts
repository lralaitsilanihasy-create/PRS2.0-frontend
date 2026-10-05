import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { Seance } from '../../models';
import { SignaturesPv, VueSignatures } from './signatures-pv';

// V70 (arbitrage du pilote, 04/10, §B2) — le PV d'ouverture signé par les membres présents de la CAO.
const SEANCE: Seance = {
  idDmc: 40,
  etat: 'PV_A_SIGNER',
  heureOuverture: null,
  ouverteLe: '2026-10-04T21:31:00',
  ouverteDans: null,
  quorum: 2,
  membres: [
    { im: 'K1', nom: 'Membre Un', president: true, present: true, partsApportees: false },
    { im: 'K2', nom: 'Membre Deux', president: false, present: true, partsApportees: false },
  ],
  autres: [],
  secoursEmploye: false,
  offres: [],
  dechiffreeLe: '2026-10-04T21:32:00',
  pv: { produit: true, publie: false, signe: false, signatures: [], signaturesAttendues: [{ im: 'K1', nom: 'Membre Un' }, { im: 'K2', nom: 'Membre Deux' }] },
};

describe('Signatures du PV d’ouverture (V70)', () => {
  let fixture: ComponentFixture<SignaturesPv>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (): string => (racine().textContent ?? '').replace(/\s+/g, ' ').trim();
  const bouton = (nom: string): HTMLButtonElement | undefined => Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.trim() === nom);

  function monter(vue: VueSignatures, moi: string | null, seance: Seance = SEANCE): void {
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SignaturesPv);
    fixture.componentRef.setInput('idDmc', 40);
    fixture.componentRef.setInput('seance', seance);
    fixture.componentRef.setInput('vue', vue);
    fixture.componentRef.setInput('moi', moi);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('membre attendu : signe après avoir coché la relecture ; le PV rendu remonte au parent', () => {
    monter('membre', 'K2');
    let remonte: Seance | null = null;
    fixture.componentInstance.geste.subscribe((s) => (remonte = s));
    expect(texte()).toContain('2 signature(s) attendue(s)');
    expect(texte()).toContain('En attente : Membre Un, Membre Deux');
    const signer = bouton('Signer le PV d’ouverture') ?? bouton("Signer le PV d'ouverture");
    expect(signer?.disabled).toBe(true);
    (racine().querySelector('.sp__case input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(signer?.disabled).toBe(false);
    signer!.click();
    const req = http.expectOne('/api/fiches-marche/40/seance/pv/signer');
    expect(req.request.method).toBe('POST');
    const apres: Seance = { ...SEANCE, pv: { ...SEANCE.pv!, signatures: [{ im: 'K2', nom: 'Membre Deux', president: false, date: '2026-10-04T21:40:00', empechement: false, motif: null, constatePar: null }], signaturesAttendues: [{ im: 'K1', nom: 'Membre Un' }] } };
    req.flush(apres);
    expect(remonte).toEqual(apres);
    expect(toast.success).toHaveBeenCalledWith('Votre signature est posée sur le PV.');
    // Un membre ordinaire ne constate pas d'empêchement.
    expect(racine().querySelector('.sp__empechement')).toBeNull();
  });

  it('président : constate l’empêchement d’un autre signataire, motif obligatoire', () => {
    monter('membre', 'K1');
    expect(racine().querySelector('.sp__empechement')).not.toBeNull();
    const options = Array.from(racine().querySelectorAll('.sp__empechement option')).map((o) => o.textContent?.trim());
    expect(options).toEqual(['— Choisir —', 'Membre Deux']);
    const select = racine().querySelector('.sp__empechement select') as HTMLSelectElement;
    select.value = 'K2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(bouton('Constater l’empêchement') ?? bouton("Constater l'empêchement")).toBeDefined();
    const constater = (bouton('Constater l’empêchement') ?? bouton("Constater l'empêchement"))!;
    expect(constater.disabled).toBe(true);
    const motif = racine().querySelector('.sp__empechement input') as HTMLInputElement;
    motif.value = 'Mission hors du pays';
    motif.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    constater.click();
    const req = http.expectOne('/api/fiches-marche/40/seance/pv/empechement');
    expect(req.request.body).toEqual({ im: 'K2', motif: 'Mission hors du pays' });
    req.flush({ message: 'Conflit', code: 'DEJA_SIGNE' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(texte()).toContain('Cette signature est déjà posée.');
  });

  it('responsable : suit les signatures ; ne constate un empêchement que si le président est lui-même empêché', () => {
    monter('responsable', 'ADMIN01');
    expect(bouton('Signer le PV d’ouverture') ?? bouton("Signer le PV d'ouverture")).toBeUndefined();
    expect(racine().querySelector('.sp__empechement')).toBeNull();
    TestBed.resetTestingModule();
    const presidentEmpeche: Seance = {
      ...SEANCE,
      pv: { ...SEANCE.pv!, signatures: [{ im: 'K1', nom: 'Membre Un', president: true, date: '2026-10-04T21:45:00', empechement: true, motif: 'Hospitalisé', constatePar: 'ADMIN01' }], signaturesAttendues: [{ im: 'K2', nom: 'Membre Deux' }] },
    };
    monter('responsable', 'ADMIN01', presidentEmpeche);
    expect(texte()).toContain('empêché de signer : Hospitalisé (constaté par ADMIN01');
    expect(racine().querySelector('.sp__empechement')).not.toBeNull();
  });

  it('PV signé de tous : plus aucun geste', () => {
    monter('membre', 'K1', { ...SEANCE, etat: 'CLOSE', pv: { produit: true, publie: true, signe: true, signatures: [], signaturesAttendues: [] } });
    expect(texte()).toContain('PV signé');
    expect(racine().querySelectorAll('button').length).toBe(0);
  });
});
