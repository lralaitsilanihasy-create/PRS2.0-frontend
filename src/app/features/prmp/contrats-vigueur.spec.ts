import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ContratVigueur } from '../../models';
import { ContratsVigueur, refusReconduction } from './contrats-vigueur';

// ⚠️ Lot MS-1 (V124, 16/10) — les contrats en vigueur et la reconduction.
const CONTRAT = (extra: Partial<ContratVigueur> = {}): ContratVigueur => ({
  id: 7, idDmc: 50, lot: 1, typeMarche: 'CONTRAT_CADRE', objet: 'Consommables informatiques', acheteur: 'Ministère',
  etat: 'EN_VIGUEUR', dateEffet: '2026-01-01', dateFin: '2026-12-31', periodeMois: 12, dureeMaxMois: 24, finMaximale: '2027-12-31',
  reconductible: true, reconductionsMax: 1, reconductions: 0, preavisMois: 3, dateLimiteDecision: '2026-09-30',
  montantEstime: 150000000, montantMinimum: null, montantMaximum: null, formeSubsequents: 'Bons de commande', rythme: 'À la survenance du besoin', calendrier: null,
  titulaires: [{ idOffre: 'o-4', numero: 4, candidat: 'Entreprise 4', nif: '400', montant: 4000, delai: '30 jours', rang: 1 }],
  decisions: [], alertes: ['RECONDUCTION_A_DECIDER'],
  ...extra,
});
const api = (status: number, corps: object): ApiError => ({ status, message: 'x', raw: new HttpErrorResponse({ status, error: corps }) }) as unknown as ApiError;

describe('Contrats en vigueur (MS-1)', () => {
  let fixture: ComponentFixture<ContratsVigueur>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (): string => (racine().textContent ?? '').replace(/\s+/g, ' ');
  const bouton = (debut: string): HTMLButtonElement => Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(debut)) as HTMLButtonElement;

  function monter(role: string, contrats: ContratVigueur[], query: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }, { provide: AuthService, useValue: { role: signal(role) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ContratsVigueur);
    fixture.detectChanges();
    http.expectOne('/api/contrats-en-vigueur').flush(contrats);
    fixture.detectChanges();
  }

  afterEach(() => {
    // ⚠️ MS-3 — le bloc des bons de commande lit la consommation du contrat ouvert.
    http.match((r) => r.url.endsWith('/bons-commande')).forEach((r) => r.flush({ idContrat: 7, typeMarche: 'CONTRAT_CADRE', cumulHt: 0, anneeDebut: null, anneeFin: null, cumulAnnee: null, minimum: null, maximum: null, resteMaximum: null, montantEstime: null, subsequents: [], alertes: [], bons: [] }));
    // ⚠️ MS-4 — la commission de réception du contrat ouvert.
    http.match((r) => r.url.endsWith('/commission-reception')).forEach((r) => r.flush({ idContrat: 7, decisionReference: null, decisionDate: null, presideeParPrmp: true, membres: [], majLe: null, majPar: null }));
    http.verify();
    TestBed.resetTestingModule();
  });

  it('liste les contrats, les alertes d’abord ; une ligne s’ouvre sur place sur ses titulaires', () => {
    monter('PRMP', [CONTRAT({ id: 8, objet: 'Fournitures de bureau', alertes: [], dateFin: '2026-11-30' }), CONTRAT()]);
    const lignes = racine().querySelectorAll('.cv__ligne');
    expect(lignes.length).toBe(2);
    expect(lignes[0].textContent).toContain('Consommables informatiques');
    expect(lignes[0].textContent).toContain('Reconduction à décider');
    (lignes[0] as HTMLButtonElement).click();
    http.expectOne('/api/contrats-en-vigueur/7/remises').flush([]);
    fixture.detectChanges();
    expect(texte()).toContain('liste fermée');
    expect(texte()).toContain('Entreprise 4');
    expect(texte()).toContain('au plus tard le 31/12/2027');
  });

  it('un marché à commandes (code serveur A_COMMANDE) : ni remise en concurrence ni lecture des remises', () => {
    monter('PRMP', [CONTRAT({ typeMarche: 'A_COMMANDE', titulaires: [], montantEstime: null, montantMinimum: 1000, montantMaximum: 5000000 })]);
    expect(racine().querySelector('.cv__ligne')?.textContent).toContain('Marché à commandes');
    (racine().querySelector('.cv__ligne') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectNone('/api/contrats-en-vigueur/7/remises');
    // Le bloc des bons suit la branche du marché à commandes : il lit les articles du besoin (prix du bordereau).
    http.expectOne('/api/fiches-marche/50/articles').flush([]);
    expect(texte()).not.toContain('Remises en concurrence');
    expect(texte()).toContain('marché à commandes (loi n° 2016-055, art. 30)');
  });

  it('29/10 (V147) — ouvert depuis une notification (?dmc=) : le contrat s’ouvre ; remise au calendrier en retard, formulaire déplié', () => {
    monter('PRMP', [
      CONTRAT({ id: 8, idDmc: 49, objet: 'Autre contrat', alertes: [] }),
      CONTRAT({ alertes: ['REMISE_A_LANCER'], periodiciteMois: 3, premiereRemise: '2026-01-15', prochaineRemise: '2026-01-15' }),
    ], { dmc: '50' });
    http.expectOne('/api/contrats-en-vigueur/7/remises').flush([]);
    fixture.detectChanges();
    expect(racine().querySelector('#cv-detail-7')).not.toBeNull();
    expect(racine().querySelector('#cv-detail-8')).toBeNull();
    expect(texte()).toContain('Remise en concurrence à lancer');
    expect(texte()).toContain('tous les 3 mois, à partir du 15/01/2026');
    expect(texte()).toContain('En retard');
    expect((racine().querySelector('.cv__details') as HTMLDetailsElement).open).toBe(true);
  });

  it('29/10 (PRS20 1307a57) — la PRMP relit les termes depuis la fiche ; le refus est nommé ; l’UGPM n’a pas le bouton', () => {
    monter('PRMP', [CONTRAT({ typeMarche: 'A_COMMANDE', titulaires: [], montantMaximum: null, alertes: [] })]);
    (racine().querySelector('.cv__ligne') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne('/api/fiches-marche/50/articles').flush([]);
    bouton('Relire depuis la fiche').click();
    http.expectOne((r) => r.method === 'POST' && r.url === '/api/contrats-en-vigueur/7/relecture')
      .flush({ code: 'FICHE_NON_VALIDEE', message: 'x' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(texte()).toContain('revalidez-la avant de relire le contrat');
    bouton('Relire depuis la fiche').click();
    http.expectOne('/api/contrats-en-vigueur/7/relecture').flush(CONTRAT({ typeMarche: 'A_COMMANDE', titulaires: [], montantMaximum: 900000000, alertes: [] }));
    fixture.detectChanges();
    expect(texte()).toContain('900 000 000 Ar');
    TestBed.resetTestingModule();

    monter('UGPM', [CONTRAT({ typeMarche: 'A_COMMANDE', titulaires: [], alertes: [] })]);
    (racine().querySelector('.cv__ligne') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne('/api/fiches-marche/50/articles').flush([]);
    expect(bouton('Relire depuis la fiche')).toBeUndefined();
  });

  it('la PRMP décide la reconduction (référence et date) ; le contrat revient à jour', () => {
    monter('PRMP', [CONTRAT()]);
    (racine().querySelector('.cv__ligne') as HTMLButtonElement).click();
    http.expectOne('/api/contrats-en-vigueur/7/remises').flush([]);
    fixture.detectChanges();
    (racine().querySelector('input[type=radio]') as HTMLInputElement).dispatchEvent(new Event('change'));
    const ref = Array.from(racine().querySelectorAll('label')).find((l) => l.textContent?.includes('Référence'))!.querySelector('input') as HTMLInputElement;
    ref.value = 'Décision n° 12/PRMP';
    ref.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    bouton('Enregistrer la décision').click();
    const post = http.expectOne('/api/contrats-en-vigueur/7/reconduction');
    expect(post.request.body).toMatchObject({ decision: 'RECONDUIRE', reference: 'Décision n° 12/PRMP' });
    post.flush(CONTRAT({ dateFin: '2027-12-31', reconductions: 1, alertes: [], decisions: [{ id: 1, decision: 'RECONDUIRE', reference: 'Décision n° 12/PRMP', dateDecision: '2026-10-16', finAvant: '2026-12-31', nouvelleFin: '2027-12-31', horsPreavis: true, le: '2026-10-16T10:00:00', par: 'PRMP001' }] }));
    fixture.detectChanges();
    expect(texte()).toContain('Reconduit');
    expect(texte()).toContain('Hors préavis');
    expect(bouton('Enregistrer la décision')).toBeUndefined();
  });

  it('l’UGPM lit sans décider', () => {
    monter('UGPM', [CONTRAT()]);
    (racine().querySelector('.cv__ligne') as HTMLButtonElement).click();
    http.expectOne('/api/contrats-en-vigueur/7/remises').flush([]);
    fixture.detectChanges();
    expect(bouton('Enregistrer la décision')).toBeUndefined();
  });

  it('nomme les refus de la reconduction', () => {
    expect(refusReconduction(api(409, { code: 'DUREE_MAX_ATTEINTE', details: { finMaximale: '2027-12-31' } }))).toContain('31/12/2027');
    expect(refusReconduction(api(409, { code: 'DEJA_DECIDE' }))).toContain('déjà prise');
  });

  it('MS-2 : la PRMP lance une remise (échéance avec secondes) ; la remise rendue s’affiche', () => {
    monter('PRMP', [CONTRAT({ alertes: [] })]);
    (racine().querySelector('.cv__ligne') as HTMLButtonElement).click();
    http.expectOne('/api/contrats-en-vigueur/7/remises').flush([]);
    fixture.detectChanges();
    const champ = (libelle: string): HTMLInputElement | HTMLTextAreaElement =>
      Array.from(racine().querySelectorAll('label')).find((l) => l.textContent?.includes(libelle))!.querySelector('input, textarea') as HTMLInputElement;
    const remplir = (libelle: string, v: string): void => { const c = champ(libelle); c.value = v; c.dispatchEvent(new Event('input')); };
    remplir('Objet du marché subséquent', 'Cartouches du 1er trimestre');
    remplir('Spécifications', '200 cartouches HP 305');
    remplir('Délai d’exécution', '15 jours');
    remplir('Date et heure limites', '2026-10-30T10:00');
    fixture.detectChanges();
    bouton('Lancer et envoyer').click();
    const post = http.expectOne('/api/contrats-en-vigueur/7/remises');
    expect(post.request.body).toMatchObject({ objet: 'Cartouches du 1er trimestre', specifications: '200 cartouches HP 305', delaiExecution: '15 jours', echeance: '2026-10-30T10:00:00', criteres: null });
    post.flush({ id: 3, idContrat: 7, idDmc: 50, lot: 1, numero: 1, mode: 'CONCURRENCE', etat: 'EN_COURS', objet: 'Cartouches du 1er trimestre', specifications: '200 cartouches HP 305', criteres: null, lieuLivraison: null, delaiExecution: '15 jours', validiteJours: null, visite: null, echeance: '2026-10-30T10:00:00', echeancePassee: false, lanceeLe: '2026-10-16T10:00:00', lanceePar: 'PRMP001', lettreDisponible: true, consultes: [], reponses: [], prixMoyen: null, idOffreProposee: null, observations: null, evalueeLe: null, evalueePar: null, rapportDisponible: false, idOffreRetenue: null, montantRetenu: null, motifDecision: null, decideeLe: null, decideePar: null, alertes: [] });
    fixture.detectChanges();
    expect(texte()).toContain('Remise en concurrence n° 1 — Cartouches du 1er trimestre');
    // Une seule remise ouverte à la fois : le lancement se referme.
    expect(bouton('Lancer et envoyer')).toBeUndefined();
  });
});
