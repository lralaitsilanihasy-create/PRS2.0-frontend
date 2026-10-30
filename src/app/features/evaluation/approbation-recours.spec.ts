import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { LotAttribution } from '../../models';
import { messageDaoCompletAbsent } from '../../shared/prmp/avis-specifique-modele';
import { RecoursSuspensifsAdmin } from '../admin/recours-suspensifs-admin';
import { AttributionLot } from './attribution-lot';

// ⚠️ R9a (V111, 14/10, manuel révisé lot 2 §B4 n° 2, 13, 14) — contrat : docs/api-endpoints.md, tranche R9a.
const SIGNE: LotAttribution = {
  lot: 1, etat: 'SIGNE', projetDisponible: true, proposition: null,
  dossierMarche: { idDossier: 100372, sousType: 'MAOO', statut: 'CLOTURE', avis: 'FAV', creeLe: null, creePar: null },
  attributaire: { idOffre: 'o-4', numero: 4, candidat: 'Entreprise de recette', nif: '400', montant: 166000000, montantTtc: 201600000, delai: '3 mois', motif: null, le: '2026-10-07T16:00:00', par: 'PRMP001' },
  information: { le: '2026-10-07T16:05:00', par: 'PRMP001', signataire: 'La PRMP', dateAffichage: '2026-10-07', lettres: [] },
  delaiAttente: { debut: '2026-10-07', fin: '2026-10-17', signableLe: '2026-10-18', jours: 10, ecoule: true },
  recours: [], explications: [],
  piecesAttributaire: { echeance: '2026-10-22', delaiDepasse: false, fiscaleConforme: true, socialeConforme: true, pieces: [] },
  signature: { dateSignature: '2026-10-10', le: '2026-10-10T10:00:00', par: 'PRMP001', fichier: null },
} as unknown as LotAttribution;
// ⚠️ 29/10 (« chaine-attribution » B1, B4 ; V149) — signature → visa → approbation → enregistrement → notification.
const VISE = { ...SIGNE, visa: { date: '2026-10-11', reference: 'CF-2026-118', dispense: false, motif: null, le: '2026-10-11T09:00:00', par: 'PRMP001', fichier: null } } as LotAttribution;
const APPROUVE = { ...VISE, approbation: { autorite: 'Le Ministre', date: '2026-10-12', le: '2026-10-12T09:00:00', par: 'PRMP001', fichier: null } } as LotAttribution;
const ENREGISTRE = { ...APPROUVE, enregistrement: { date: '2026-10-13', reference: null, le: '2026-10-13T09:00:00', fichier: null } } as LotAttribution;

describe('R9a — l’approbation du marché avant la notification (art. 54)', () => {
  let fixture: ComponentFixture<AttributionLot>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const bouton = (debut: string): HTMLButtonElement | undefined => Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(debut));

  function monter(lot: LotAttribution, suspensifs: string[] | null = null): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AttributionLot);
    fixture.componentRef.setInput('idDmc', 44);
    fixture.componentRef.setInput('lot', lot);
    fixture.componentRef.setInput('prmp', true);
    fixture.componentRef.setInput('recoursSuspensifs', suspensifs);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('V149 — signé sans visa : ni approbation ni enregistrement ; l’écran dit ce qui manque, dans l’ordre', () => {
    monter(SIGNE);
    expect(bouton('Notifier')).toBeUndefined();
    expect(bouton('Déclarer l’approbation')).toBeUndefined();
    expect(bouton('Déclarer l’enregistrement')).toBeUndefined();
    expect(bouton('Déclarer le visa')).toBeDefined();
    expect(racine().textContent).toContain('il manque le visa, l’approbation et l’enregistrement');
  });

  it('V149 — le visa : marché visé (date, référence, fichier) ou dispense motivée (exception CHED), sans fichier', () => {
    monter(SIGNE);
    const section = racine().querySelector('[aria-label="Visa du contrôleur financier"]') as HTMLElement;
    const date = section.querySelector('input[type=date]') as HTMLInputElement;
    expect(date.min).toBe('2026-10-10');
    (section.querySelectorAll('input[type=radio]')[1] as HTMLInputElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const motif = racine().querySelector('[aria-label="Visa du contrôleur financier"] input[type=text]') as HTMLInputElement;
    motif.value = 'Exception de contrôle préalable (CHED)';
    motif.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    bouton('Enregistrer la dispense')!.click();
    const post = http.expectOne('/api/fiches-marche/44/attribution/lots/1/visa');
    const corps = post.request.body as FormData;
    expect(corps.get('dispense')).toBe('true');
    expect(corps.get('motif')).toBe('Exception de contrôle préalable (CHED)');
    expect(corps.get('fichier')).toBeNull();
    post.flush({ code: 'DEJA_VISE', message: 'x' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(racine().querySelector('.alert-danger, [role=alert]')?.textContent).toContain('visa du marché est déjà enregistré');
  });

  it('V149 — visé : l’approbation s’ouvre, l’enregistrement attend l’approbation', () => {
    monter(VISE);
    expect(racine().textContent).toContain('Visé par le contrôleur financier le 11/10/2026 — CF-2026-118');
    expect(bouton('Déclarer l’approbation')).toBeDefined();
    expect(bouton('Déclarer l’enregistrement')).toBeUndefined();
    expect(racine().textContent).toContain('il manque l’approbation et l’enregistrement');
  });

  it('V149 — la décision d’attribution se lit ; le rappel d’informer les candidats', () => {
    monter({ ...SIGNE, decisionDisponible: true, information: null, signature: null, candidatsAInformer: true } as unknown as LotAttribution);
    expect(bouton('Décision d’attribution (PDF)')).toBeDefined();
    expect(racine().textContent).toContain('dès le choix de l’attributaire (art. 52-I)');
  });

  it('approuver envoie l’autorité, la date et la décision ; la date est bornée par le visa', () => {
    monter(VISE);
    const section = racine().querySelector('[aria-label="Approbation"]') as HTMLElement;
    const [autorite, date] = Array.from(section.querySelectorAll('input')) as HTMLInputElement[];
    expect(date.min).toBe('2026-10-11');
    autorite.value = ' Le Ministre ';
    autorite.dispatchEvent(new Event('input'));
    date.value = '2026-10-12';
    date.dispatchEvent(new Event('input'));
    const comp = fixture.componentInstance as unknown as { fichiers: { set(v: Record<string, File>): void } };
    comp.fichiers.set({ afichier: new File(['x'], 'approbation.pdf', { type: 'application/pdf' }) });
    fixture.detectChanges();
    bouton('Déclarer l’approbation')!.click();
    const post = http.expectOne('/api/fiches-marche/44/attribution/lots/1/approbation');
    const corps = post.request.body as FormData;
    expect(corps.get('autorite')).toBe('Le Ministre');
    expect(corps.get('dateApprobation')).toBe('2026-10-12');
    post.flush({ code: 'DEJA_APPROUVE', message: 'x' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(racine().querySelector('.alert-danger, [role=alert]')?.textContent).toContain('déjà approuvé');
  });

  it('visé, approuvé et enregistré : la notification s’ouvre, l’approbation se lit', () => {
    monter(ENREGISTRE);
    expect(racine().textContent).toContain('Approuvé le 12/10/2026 — Le Ministre');
    expect(bouton('Notifier')).toBeDefined();
  });

  it('la liste des recours dit leur effet selon le réglage de l’Administrateur', () => {
    monter(SIGNE, ['REFERE']);
    const c = fixture.componentInstance;
    expect(c.libelleTypeRecours('REFERE')).toContain('suspend la signature');
    expect(c.libelleTypeRecours('REVISION_ARMP')).toContain('non suspensif');
    fixture.componentRef.setInput('recoursSuspensifs', null);
    expect(c.libelleTypeRecours('REVISION_ARMP')).toBe('Demande en révision auprès de l’ARMP (art. 80)');
  });
});

describe('R9a — l’écran « Recours suspensifs » (Administrateur)', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lit le réglage, décoche tout et envoie une liste vide (aucun recours suspensif)', () => {
    const f = TestBed.createComponent(RecoursSuspensifsAdmin);
    f.detectChanges();
    http.expectOne('/api/parametres/recours-suspensifs').flush({ types: ['REVISION_ARMP', 'REFERE'], connus: ['REEXAMEN', 'REVISION_ARMP', 'REFERE'] });
    f.detectChanges();
    const cases = Array.from((f.nativeElement as HTMLElement).querySelectorAll('input[type=checkbox]')) as HTMLInputElement[];
    expect(cases.map((x) => x.checked)).toEqual([false, true, true]);
    for (const x of cases.filter((y) => y.checked)) { x.checked = false; x.dispatchEvent(new Event('change')); }
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('aucun ne suspendra');
    f.componentInstance.enregistrer();
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/parametres/recours-suspensifs');
    expect(put.request.body).toEqual({ types: [] });
    put.flush({ types: [], connus: ['REEXAMEN', 'REVISION_ARMP', 'REFERE'] });
    expect(f.componentInstance.modifie()).toBe(false);
  });
});

describe('R9a — le DAO complet avant la publication', () => {
  it('le refus DAO_COMPLET_ABSENT nomme la version et dit de réessayer', () => {
    const e = new HttpErrorResponse({ status: 409, error: { code: 'DAO_COMPLET_ABSENT', details: { version: 3 } } });
    expect(messageDaoCompletAbsent(e, 'avis')).toContain('de la version 3');
    expect(messageDaoCompletAbsent(e, 'lettres')).toMatch(/^Les lettres ne s’impriment/);
  });

  it('⚠️ V144 — le refus porte le rang dans la file, ou l’assemblage en cours', () => {
    const enFile = new HttpErrorResponse({ status: 409, error: { code: 'DAO_COMPLET_ABSENT', details: { version: 2, rang: 1 } } });
    expect(messageDaoCompletAbsent(enFile, 'avis')).toContain('en préparation (n° 1 dans la file)');
    const enCours = new HttpErrorResponse({ status: 409, error: { code: 'DAO_COMPLET_ABSENT', details: { version: 2, rang: null } } });
    expect(messageDaoCompletAbsent(enCours, 'avis')).toContain('(assemblage en cours)');
  });
});
