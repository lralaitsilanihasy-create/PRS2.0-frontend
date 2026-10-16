import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { Remise, ReponseRemise } from '../../models';
import { ProfilRemise, RemiseDetail } from './remise-detail';

// ⚠️ Lot MS-2 (V125, 16/10) — une remise en concurrence : réponses, évaluation (président de la CAO, H1), décision de la PRMP.
const REPONSE = (n: number, extra: Partial<ReponseRemise> = {}): ReponseRemise => ({
  id: n, idOffre: 'o-' + n, numero: n, candidat: 'Titulaire ' + n, nature: 'DEVIS', voie: 'EN_LIGNE', montantHt: 1000 * n, montantTtc: 1200 * n,
  delai: '10 jours', recueLe: '2026-10-20T09:00:00', fichier: 'devis-' + n + '.pdf', conforme: null, motif: null, ecartPrixMoyen: null, rang: null, plafondDepasse: null, ...extra,
});
const REMISE = (extra: Partial<Remise> = {}): Remise => ({
  id: 3, idContrat: 7, idDmc: 50, lot: 1, numero: 1, mode: 'CONCURRENCE', etat: 'EN_COURS', objet: 'Cartouches', specifications: 'HP 305', criteres: null,
  lieuLivraison: null, delaiExecution: '15 jours', validiteJours: null, visite: null, echeance: '2026-10-21T10:00:00', echeancePassee: true,
  lanceeLe: '2026-10-16T10:00:00', lanceePar: 'PRMP001', lettreDisponible: true,
  consultes: [
    { idOffre: 'o-1', numero: 1, candidat: 'Titulaire 1', notifieLe: '2026-10-16T10:00:00', reponseRecue: true, sansReponse: false, absencesConsecutives: 0 },
    { idOffre: 'o-2', numero: 2, candidat: 'Titulaire 2', notifieLe: '2026-10-16T10:00:00', reponseRecue: true, sansReponse: false, absencesConsecutives: 0 },
  ],
  reponses: [REPONSE(1), REPONSE(2)], prixMoyen: null, idOffreProposee: null, observations: null, evalueeLe: null, evalueePar: null, rapportDisponible: false,
  idOffreRetenue: null, montantRetenu: null, motifDecision: null, decideeLe: null, decideePar: null, alertes: [], ...extra,
});

describe('Remise en concurrence (MS-2)', () => {
  let fixture: ComponentFixture<RemiseDetail>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (): string => (racine().textContent ?? '').replace(/\s+/g, ' ');
  const bouton = (debut: string): HTMLButtonElement => Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(debut)) as HTMLButtonElement;
  const saisir = (el: Element, v: string): void => { (el as HTMLInputElement).value = v; el.dispatchEvent(new Event('input')); };

  function monter(remise: Remise, profil: ProfilRemise): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RemiseDetail);
    fixture.componentRef.setInput('remise', remise);
    fixture.componentRef.setInput('profil', profil);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('avant l’échéance : les réponses sont dites fermées, et la PRMP lit sans évaluer', () => {
    monter(REMISE({ echeancePassee: false, reponses: [REPONSE(1, { montantHt: null, montantTtc: null, fichier: null })] }), 'PRMP');
    expect(texte()).toContain('restent fermées jusqu’à l’échéance');
    expect(bouton('Arrêter l’évaluation')).toBeUndefined();
    expect(texte()).toContain('Enregistrer une réponse reçue sur papier');
  });

  it('le président de la CAO évalue : conformité de chaque réponse (motif si non conforme), prix moyen, proposition', () => {
    monter(REMISE(), 'CAO');
    expect(bouton('Arrêter l’évaluation').disabled).toBe(true);
    const radios = racine().querySelectorAll('.rd__decision input[type=radio]');
    (radios[0] as HTMLInputElement).dispatchEvent(new Event('change')); // o-1 conforme
    (radios[3] as HTMLInputElement).dispatchEvent(new Event('change')); // o-2 non conforme
    fixture.detectChanges();
    expect(bouton('Arrêter l’évaluation').disabled).toBe(true);
    saisir(racine().querySelector('.rd__motif')!, 'Devis non signé');
    saisir(Array.from(racine().querySelectorAll('label')).find((l) => l.textContent?.includes('Prix moyen'))!.querySelector('input')!, '1100');
    fixture.detectChanges();
    bouton('Arrêter l’évaluation').click();
    const post = http.expectOne('/api/remises/3/evaluation');
    expect(post.request.body).toEqual({
      prixMoyen: 1100,
      decisions: [{ idOffre: 'o-1', conforme: true, motif: null }, { idOffre: 'o-2', conforme: false, motif: 'Devis non signé' }],
      idOffreProposee: null, observations: null,
    });
    post.flush({ code: 'x' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(racine().querySelector('.alert-danger')?.textContent).toContain('président de la commission');
  });

  it('évaluée : la PRMP attribue au seul proposé, ou déclare infructueuse avec un motif ; l’écart au prix moyen est montré', () => {
    monter(REMISE({ etat: 'EVALUEE', idOffreProposee: 'o-1', prixMoyen: 1100, rapportDisponible: true, alertes: ['DELIEMENT_POSSIBLE'],
      reponses: [REPONSE(1, { conforme: true, rang: 1, ecartPrixMoyen: -9.1 }), REPONSE(2, { conforme: false, motif: 'Devis non signé', ecartPrixMoyen: 81.8 })] }), 'PRMP');
    expect(texte()).toContain('Proposé : n° 1 · Titulaire 1');
    expect(texte()).toContain('+81.8 %');
    expect(texte()).toContain('délié de l’exclusivité');
    expect(bouton('Rapport simplifié (PDF)')).toBeTruthy();
    expect(bouton('Déclarer infructueuse').disabled).toBe(true);
    bouton('Attribuer le marché subséquent').click();
    const post = http.expectOne('/api/remises/3/attribution');
    expect(post.request.body).toEqual({ motif: null });
    post.flush(REMISE({ etat: 'ATTRIBUEE', idOffreProposee: 'o-1', idOffreRetenue: 'o-1', montantRetenu: 1000, decideeLe: '2026-10-22T09:00:00' }));
  });

  it('la réponse papier part en multipart avec le titulaire et la date de réception', () => {
    monter(REMISE({ echeancePassee: false, reponses: [] }), 'UGPM');
    const selects = racine().querySelectorAll('.rd__details select');
    (selects[0] as HTMLSelectElement).value = 'o-2';
    selects[0].dispatchEvent(new Event('change'));
    (selects[1] as HTMLSelectElement).value = 'FACTURE_PRO_FORMA';
    selects[1].dispatchEvent(new Event('change'));
    const label = (t: string): HTMLInputElement => Array.from(racine().querySelectorAll('label')).find((l) => l.textContent?.includes(t))!.querySelector('input')!;
    saisir(label('Reçue le'), '2026-10-17');
    saisir(label('Montant HT'), '2500');
    const fichier = new File(['%PDF-1.4'], 'devis.pdf', { type: 'application/pdf' });
    const input = label('La réponse');
    Object.defineProperty(input, 'files', { value: [fichier] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    bouton('Enregistrer la réponse').click();
    const post = http.expectOne('/api/remises/3/reponses');
    const fd = post.request.body as FormData;
    expect(fd.get('idOffre')).toBe('o-2');
    expect(fd.get('nature')).toBe('FACTURE_PRO_FORMA');
    expect(fd.get('montantHt')).toBe('2500');
    expect(fd.get('dateReception')).toBe('2026-10-17');
    expect(fd.get('montantTtc')).toBeNull();
    post.flush(REMISE({ echeancePassee: false }));
  });
});
