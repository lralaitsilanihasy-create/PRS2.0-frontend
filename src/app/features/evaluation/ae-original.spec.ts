import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { LotAttribution, PiecesAttributaire } from '../../models';
import { ResultatOffreCandidat } from '../candidat/resultat-offre';
import { AttributionLot } from './attribution-lot';

// ⚠️ R10 (V113, 14/10, manuel révisé lot 2 §B5) — l'original signé de l'acte d'engagement, en remise électronique.
const PIECES: PiecesAttributaire = {
  echeance: '2026-10-22', delaiDepasse: false, fiscaleConforme: true, socialeConforme: true, aeOriginalExige: true, aeOriginalConforme: null,
  pieces: [{ id: 7, type: 'ACTE_ENGAGEMENT_ORIGINAL', dateDelivrance: '2026-10-13', nom: 'ae-original.pdf', taille: 10, deposeLe: '2026-10-13T10:00:00', conforme: null, motif: null, verifieeLe: null }],
};
const INFORME = {
  lot: 1, etat: 'INFORME', projetDisponible: true, proposition: null,
  dossierMarche: { idDossier: 100372, sousType: 'MAOO', statut: 'CLOTURE', avis: 'FAV', creeLe: null, creePar: null },
  attributaire: { idOffre: 'o-4', numero: 4, candidat: 'Entreprise de recette', nif: '400', montant: 1, montantTtc: 1, delai: null, motif: null, le: '2026-10-07T16:00:00', par: 'PRMP001' },
  information: { le: '2026-10-07T16:05:00', par: 'PRMP001', signataire: 'La PRMP', dateAffichage: '2026-10-07', lettres: [] },
  delaiAttente: { debut: '2026-10-07', fin: '2026-10-17', signableLe: '2026-10-18', jours: 10, ecoule: true },
  recours: [], explications: [], piecesAttributaire: PIECES,
} as unknown as LotAttribution;

describe('R10 — l’original de l’acte d’engagement, côté PRMP', () => {
  let fixture: ComponentFixture<AttributionLot>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const bouton = (debut: string): HTMLButtonElement | undefined => Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(debut));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AttributionLot);
    fixture.componentRef.setInput('idDmc', 44);
    fixture.componentRef.setInput('lot', INFORME);
    fixture.componentRef.setInput('prmp', true);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('annonce l’original exigé, le liste « remis le », et la signature le cite', () => {
    const t = racine().textContent ?? '';
    expect(t).toContain('original signé de l’acte d’engagement');
    expect(t).toContain('Original signé de l’acte d’engagement · remis le 13/10/2026');
    expect(t).toContain('ainsi que l’original signé de son acte d’engagement');
  });

  it('l’état se lit sur le dernier dépôt : « à déposer » tant que rien n’est déposé, même si le serveur répond false (recette du 14/10)', () => {
    const c = fixture.componentInstance;
    const vide: PiecesAttributaire = { ...PIECES, aeOriginalConforme: false, pieces: [] };
    expect(c.etatPiece(vide, 'ACTE_ENGAGEMENT_ORIGINAL', false)).toBe('à déposer');
    expect(c.etatPiece(PIECES, 'ACTE_ENGAGEMENT_ORIGINAL', false)).toBe('à vérifier');
    const refuse = { ...PIECES.pieces[0], conforme: false };
    expect(c.etatPiece({ ...PIECES, pieces: [refuse] }, 'ACTE_ENGAGEMENT_ORIGINAL', false)).toBe('non conforme');
    expect(c.etatPiece({ ...PIECES, pieces: [refuse, { ...refuse, id: 8, conforme: true }] }, 'ACTE_ENGAGEMENT_ORIGINAL', false)).toBe('conforme');
    expect(c.etatPiece(vide, 'FISCALE', true)).toBe('à déposer');
  });

  it('la PRMP enregistre l’original reçu (date facultative) ; la signature refusée le nomme', () => {
    const comp = fixture.componentInstance as unknown as { fichiers: { set(v: Record<string, File>): void } };
    comp.fichiers.set({ aefichier: new File(['x'], 'scan.pdf', { type: 'application/pdf' }) });
    fixture.detectChanges();
    bouton('Enregistrer l’original reçu')!.click();
    const post = http.expectOne('/api/fiches-marche/44/attribution/lots/1/acte-engagement-original');
    expect((post.request.body as FormData).has('dateRemise')).toBe(false);
    expect((post.request.body as FormData).get('fichier')).toBeTruthy();
    post.flush({ code: 'AE_ORIGINAL_MANQUANT', message: 'x' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(racine().textContent).toContain('doit être déposé et reconnu conforme avant la signature');
  });
});

describe('R10 — l’original de l’acte d’engagement, côté attributaire', () => {
  it('reste déposable après l’échéance des quinze jours, tant qu’il n’est pas conforme', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    const c = TestBed.createComponent(ResultatOffreCandidat).componentInstance;
    expect(c.typesOfferts(PIECES)).toEqual(['FISCALE', 'SOCIALE', 'ACTE_ENGAGEMENT_ORIGINAL']);
    expect(c.typesOfferts({ ...PIECES, delaiDepasse: true })).toEqual(['ACTE_ENGAGEMENT_ORIGINAL']);
    expect(c.typeChoisi({ ...PIECES, delaiDepasse: true })).toBe('ACTE_ENGAGEMENT_ORIGINAL');
    expect(c.typesOfferts({ ...PIECES, aeOriginalConforme: true, delaiDepasse: true })).toEqual([]);
    expect(c.typesOfferts({ ...PIECES, aeOriginalExige: false })).toEqual(['FISCALE', 'SOCIALE']);
  });
});
