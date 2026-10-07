import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { LotAttribution } from '../../models';
import { AttributionLot } from './attribution-lot';

// Attribution, tranches 2b et 2c (V80, V81) — le suivi d'un lot par la PRMP.
const AVIS_FAV: LotAttribution = {
  lot: 1, etat: 'AVIS_RENDU', projetDisponible: true,
  proposition: { idOffre: 'o-4', numero: 4, candidat: 'Entreprise de recette', montant: 166000000, montantTtc: 201600000, delai: '3 mois', infructueux: false },
  dossierMarche: { idDossier: 100372, sousType: 'MAOO', statut: 'CLOTURE', avis: 'FAV', creeLe: null, creePar: null },
};
const ATTRIBUE: LotAttribution = { ...AVIS_FAV, etat: 'ATTRIBUE', attributaire: { idOffre: 'o-4', numero: 4, candidat: 'Entreprise de recette', nif: '400', montant: 166000000, montantTtc: 201600000, delai: '3 mois', motif: null, le: '2026-10-07T16:00:00', par: 'PRMP001' } };
const INFORME: LotAttribution = {
  ...ATTRIBUE, etat: 'INFORME',
  information: { le: '2026-10-07T16:05:00', par: 'PRMP001', signataire: 'La PRMP', dateAffichage: '2026-10-07', lettres: [{ id: 1, idOffre: 'o-4', numero: 4, candidat: 'Entreprise de recette', type: 'ATTRIBUTION', motif: null, envoyeeLe: '2026-10-07T16:05:00', lueLe: null }] },
  delaiAttente: { debut: '2026-10-07', fin: '2026-10-17', signableLe: '2026-10-18', jours: 10, ecoule: false },
  recours: [], explications: [],
  piecesAttributaire: { echeance: '2026-10-22', delaiDepasse: false, fiscaleConforme: null, socialeConforme: null, pieces: [] },
};

describe('Attribution d’un lot (tranches 2b, 2c)', () => {
  let fixture: ComponentFixture<AttributionLot>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const bouton = (debut: string): HTMLButtonElement => Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(debut)) as HTMLButtonElement;

  function monter(lot: LotAttribution, prmp = true): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AttributionLot);
    fixture.componentRef.setInput('idDmc', 44);
    fixture.componentRef.setInput('lot', lot);
    fixture.componentRef.setInput('prmp', prmp);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('avis favorable : la PRMP attribue à l’offre proposée, et à elle seule', () => {
    monter(AVIS_FAV);
    expect(racine().textContent).toContain('Elle seule peut être attribuée');
    bouton('Attribuer à l’offre proposée').click();
    const post = http.expectOne('/api/fiches-marche/44/attribution/lots/1/attribuer');
    expect(post.request.body).toEqual({ motif: null });
    post.flush({ code: 'OFFRE_NON_PROPOSEE', message: 'x' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(racine().querySelector('.alert-danger')?.textContent).toContain('et à elle seule');
  });

  it('attribué : informer envoie la date d’affichage déclarée', () => {
    monter(ATTRIBUE);
    const champ = racine().querySelector('input[type=date]') as HTMLInputElement;
    champ.value = '2026-10-06';
    champ.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    bouton('Signer et envoyer les lettres').click();
    const post = http.expectOne('/api/fiches-marche/44/attribution/lots/1/informer');
    expect(post.request.body).toEqual({ dateAffichage: '2026-10-06' });
    post.flush({ idDmc: 44, lots: [INFORME] });
  });

  it('informé : les lettres, le délai d’attente ; signer avant son terme est refusé et nommé', () => {
    monter(INFORME);
    expect(racine().textContent).toContain('signature possible à partir du');
    expect(racine().textContent).toContain('pas encore');
    const dates = racine().querySelectorAll('section[aria-label="Signer le marché"] input');
    (dates[0] as HTMLInputElement).value = '2026-10-08';
    dates[0].dispatchEvent(new Event('input'));
    const fichier = dates[1] as HTMLInputElement;
    Object.defineProperty(fichier, 'files', { value: [new File(['%PDF'], 'marche.pdf', { type: 'application/pdf' })] });
    fichier.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    bouton('Déposer le marché signé').click();
    const post = http.expectOne('/api/fiches-marche/44/attribution/lots/1/signature');
    expect((post.request.body as FormData).get('dateSignature')).toBe('2026-10-08');
    expect((post.request.body as FormData).get('fichier')).toBeTruthy();
    post.flush({ code: 'DELAI_ATTENTE', message: 'x' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(racine().querySelector('.alert-danger')?.textContent).toContain('dix jours francs');
  });

  it('un recours en révision se déclare en multipart ; suspensif, il est signalé', () => {
    monter({ ...INFORME, recours: [{ id: 3, type: 'REVISION_ARMP', dateReception: '2026-10-07', requerant: 'Société écartée', objet: 'Contestation du motif', declareLe: '', declarePar: null, fichiers: [], suspensif: true, finSuspension: '2026-10-27', echeanceReponse: null, bloquant: true, decision: null }] });
    expect(racine().textContent).toContain('Signature suspendue');
    const form = racine().querySelector('details.al__details') as HTMLElement;
    (form.querySelector('select') as HTMLSelectElement).value = 'REFERE';
    form.querySelector('select')!.dispatchEvent(new Event('change'));
    const champs = form.querySelectorAll('input:not([type=file])');
    (champs[0] as HTMLInputElement).value = '2026-10-08';
    champs[0].dispatchEvent(new Event('input'));
    (champs[1] as HTMLInputElement).value = 'Société écartée';
    champs[1].dispatchEvent(new Event('input'));
    (champs[2] as HTMLInputElement).value = 'Référé';
    champs[2].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    bouton('Déclarer le recours').click();
    const post = http.expectOne('/api/fiches-marche/44/attribution/lots/1/recours');
    const fd = post.request.body as FormData;
    expect([fd.get('type'), fd.get('dateReception'), fd.get('requerant'), fd.get('objet')]).toEqual(['REFERE', '2026-10-08', 'Société écartée', 'Référé']);
    post.flush({ idDmc: 44, lots: [INFORME] });
  });

  it('l’UGPM et les autres lecteurs voient le suivi sans geste', () => {
    monter(INFORME, false);
    expect(Array.from(racine().querySelectorAll('button')).some((b) => /Déposer|Déclarer|Signer|Attribuer/.test(b.textContent ?? ''))).toBe(false);
    expect(racine().textContent).toContain('Candidats informés');
  });
});
