import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Consommation, ContratVigueur } from '../../models';
import { BonsCommandeContrat, refusBon } from './bons-commande-contrat';

// ⚠️ Lot MS-3 (V126, 16/10) — les bons de commande d'un contrat : consommation, émission, annulation.
const CONTRAT = (extra: Partial<ContratVigueur> = {}): ContratVigueur => ({
  id: 7, idDmc: 50, lot: 1, typeMarche: 'CONTRAT_CADRE', objet: 'Consommables', acheteur: null, etat: 'EN_VIGUEUR', dateEffet: '2026-01-01',
  dateFin: '2026-12-31', periodeMois: 12, dureeMaxMois: 24, finMaximale: null, reconductible: false, reconductionsMax: null, reconductions: 0,
  preavisMois: null, dateLimiteDecision: null, montantEstime: 150000000, montantMinimum: null, montantMaximum: null, formeSubsequents: null,
  rythme: null, calendrier: null, titulaires: [], decisions: [], alertes: [], ...extra,
});
const CONSO = (extra: Partial<Consommation> = {}): Consommation => ({
  idContrat: 7, typeMarche: 'CONTRAT_CADRE', cumulHt: 300000, anneeDebut: null, anneeFin: null, cumulAnnee: null, minimum: null, maximum: null,
  resteMaximum: null, montantEstime: 150000000,
  subsequents: [{ idRemise: 3, numero: 1, objet: 'Cartouches', idOffre: 'o-1', titulaire: 'Titulaire 1', montantRetenu: 1000000, commande: 300000, reste: 700000 }],
  alertes: [], bons: [{ id: 11, idContrat: 7, idDmc: 50, lot: 1, typeMarche: 'CONTRAT_CADRE', numero: 1, idRemise: 3, numeroRemise: 1, idOffre: 'o-1', numeroOffre: 1, titulaire: 'Titulaire 1', etat: 'EMIS', objet: 'Cartouches', lieuLivraison: null, delaiLivraison: '10 jours', observations: null, lignes: [], montantHt: 300000, emisLe: '2026-10-16T10:00:00', emisPar: 'PRMP001', accuseLe: null, annuleLe: null, annulePar: null, motifAnnulation: null }],
  ...extra,
});
const api = (status: number, corps: object): ApiError => ({ status, message: 'x', raw: new HttpErrorResponse({ status, error: corps }) }) as unknown as ApiError;

describe('Bons de commande d’un contrat (MS-3)', () => {
  let fixture: ComponentFixture<BonsCommandeContrat>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (): string => (racine().textContent ?? '').replace(/\s+/g, ' ');
  const bouton = (debut: string): HTMLButtonElement => Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(debut)) as HTMLButtonElement;
  const saisir = (el: Element, v: string): void => { (el as HTMLInputElement).value = v; el.dispatchEvent(new Event('input')); };

  function monter(contrat: ContratVigueur, conso: Consommation, prmp = true): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BonsCommandeContrat);
    fixture.componentRef.setInput('contrat', contrat);
    fixture.componentRef.setInput('prmp', prmp);
    fixture.detectChanges();
    http.expectOne('/api/contrats-en-vigueur/7/bons-commande').flush(conso);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('contrat-cadre : consommation par marché subséquent ; le bon émis porte la remise et les prix saisis', () => {
    monter(CONTRAT(), CONSO());
    expect(texte()).toContain('Remise n° 1 — Cartouches');
    expect(texte()).toContain('en attente');
    const select = racine().querySelector('.bc__form select') as HTMLSelectElement;
    select.value = '3';
    select.dispatchEvent(new Event('change'));
    const ligne = racine().querySelectorAll('.bc__form tbody tr input');
    saisir(ligne[0], 'Cartouche HP 305');
    saisir(ligne[1], 'unité');
    saisir(ligne[2], '20');
    saisir(ligne[3], '15000');
    fixture.detectChanges();
    expect(texte()).toContain('Total HT saisi');
    bouton('Émettre et notifier').click();
    const post = http.expectOne('/api/contrats-en-vigueur/7/bons-commande');
    expect(post.request.body).toEqual({
      idRemise: 3, objet: null, lieuLivraison: null, delaiLivraison: null, observations: null,
      lignes: [{ idArticle: null, designation: 'Cartouche HP 305', unite: 'unité', quantite: 20, prixUnitaire: 15000 }],
    });
    post.flush({ code: 'MONTANT_SUBSEQUENT_DEPASSE', message: 'x', details: { montantRetenu: 1000000, dejaCommande: 300000 } }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(racine().querySelector('.alert-danger')?.textContent).toContain('montant retenu du marché subséquent');
  });

  it('marché à commandes : articles du besoin du lot, prix vide = bordereau ; maximum annuel', () => {
    monter(CONTRAT({ typeMarche: 'MARCHE_A_COMMANDES' }), CONSO({ typeMarche: 'MARCHE_A_COMMANDES', subsequents: [], bons: [], anneeDebut: '2026-01-01', anneeFin: '2026-12-31', cumulAnnee: 0, minimum: 1000, maximum: 5000000, resteMaximum: 5000000, alertes: ['MINIMUM_NON_ATTEINT'] }));
    http.expectOne('/api/fiches-marche/50/articles').flush([
      { idArticle: 41, lot: 1, designation: 'Ramette A4', unite: 'paquet', caracteristiques: [] },
      { idArticle: 42, lot: 2, designation: 'Autre lot', unite: 'u', caracteristiques: [] },
    ]);
    fixture.detectChanges();
    expect(texte()).toContain('Minimum · maximum annuels');
    expect(texte()).toContain('minimum annuel n’est pas atteint');
    const objet = Array.from(racine().querySelectorAll('label')).find((l) => l.textContent?.startsWith('Objet'))!.querySelector('input')!;
    saisir(objet, 'Ramettes d’octobre');
    const select = racine().querySelector('.bc__form tbody select') as HTMLSelectElement;
    expect(select.options.length).toBe(2); // « — » et le seul article du lot 1
    select.value = '41';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    saisir(racine().querySelectorAll('.bc__form tbody tr input')[1], '100');
    fixture.detectChanges();
    expect(texte()).toContain('hors prix repris du bordereau');
    bouton('Émettre et notifier').click();
    const post = http.expectOne('/api/contrats-en-vigueur/7/bons-commande');
    expect(post.request.body.lignes).toEqual([{ idArticle: 41, designation: null, unite: null, quantite: 100, prixUnitaire: null }]);
    expect(post.request.body.idRemise).toBeNull();
    post.flush({ id: 12, numero: 1, montantHt: 250000 });
    http.expectOne('/api/contrats-en-vigueur/7/bons-commande').flush(CONSO({ typeMarche: 'MARCHE_A_COMMANDES', subsequents: [] }));
  });

  it('la PRMP annule un bon avec un motif ; l’UGPM lit sans émettre ni annuler', () => {
    monter(CONTRAT(), CONSO());
    bouton('Annuler…').click();
    fixture.detectChanges();
    saisir(Array.from(racine().querySelectorAll('label')).find((l) => l.textContent?.includes('Motif de l’annulation'))!.querySelector('input')!, 'Doublon');
    fixture.detectChanges();
    bouton('Annuler le bon').click();
    const post = http.expectOne('/api/bons-commande/11/annulation');
    expect(post.request.body).toEqual({ motif: 'Doublon' });
    post.flush({});
    http.expectOne('/api/contrats-en-vigueur/7/bons-commande').flush(CONSO());
    TestBed.resetTestingModule();
    monter(CONTRAT(), CONSO(), false);
    expect(bouton('Annuler…')).toBeUndefined();
    expect(texte()).not.toContain('Émettre un bon de commande');
  });

  it('nomme les refus', () => {
    expect(refusBon(api(400, { code: 'PRIX_HORS_BORDEREAU', details: { rang: 2, prixBordereau: 2500 } }))).toContain('article n° 2');
    expect(refusBon(api(409, { code: 'REMISE_NON_ATTRIBUEE' }))).toContain('art. 33');
  });
});
