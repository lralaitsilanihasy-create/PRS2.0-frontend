import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { LotAttribution, SuiviTitulaire, TitulairePropose } from '../../models';
import { AttributionLot } from './attribution-lot';

// ⚠️ MT-b1 et MT-b2 (V122, V123) — le contrat-cadre multi-attributaire : choix des titulaires, pièces et retrait de chacun.
const T = (rang: number, n: number): TitulairePropose => ({ idOffre: 'o-' + n, numero: n, candidat: 'Entreprise ' + n, montant: 1000 * n, montantTtc: 1200 * n, delai: '30 jours', rang });
const AVIS_FAV: LotAttribution = {
  lot: 1, etat: 'AVIS_RENDU', projetDisponible: true,
  proposition: { ...T(1, 4), infructueux: false, titulaires: [T(1, 4), T(2, 2), T(3, 7)], seulTitulaireQualifie: false },
  dossierMarche: { idDossier: 100380, sousType: 'MAOO', statut: 'CLOTURE', avis: 'FAV', creeLe: null, creePar: null },
};
const SUIVI = (t: TitulairePropose, extra: Partial<SuiviTitulaire> = {}): SuiviTitulaire => ({
  idOffre: t.idOffre, numero: t.numero, candidat: t.candidat, rang: t.rang, notificationRecueLe: null, retrait: null,
  pieces: { echeance: '2026-10-30', delaiDepasse: true, fiscaleConforme: null, socialeConforme: null, pieces: [], aeOriginalExige: true },
  ...extra,
});
const INFORME: LotAttribution = {
  ...AVIS_FAV, etat: 'INFORME',
  attributaire: { idOffre: 'o-4', numero: 4, candidat: 'Entreprise 4', nif: null, montant: 4000, montantTtc: 4800, delai: '30 jours', motif: null, le: '2026-10-16T09:00:00', par: 'PRMP001' },
  titulaires: [T(1, 4), T(2, 2)],
  information: { le: '2026-10-16T09:05:00', par: 'PRMP001', signataire: 'La PRMP', dateAffichage: '2026-10-16', lettres: [] },
  recours: [], explications: [],
  piecesAttributaire: { echeance: '2026-10-30', delaiDepasse: true, fiscaleConforme: null, socialeConforme: null, pieces: [] },
  suiviTitulaires: [SUIVI(T(1, 4)), SUIVI(T(2, 2), { retrait: { le: '2026-10-16T10:00:00', par: 'PRMP001', motif: 'Pièces non remises' } })],
};

describe('Contrat-cadre multi-attributaire (MT-b1, MT-b2)', () => {
  let fixture: ComponentFixture<AttributionLot>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (): string => (racine().textContent ?? '').replace(/\s+/g, ' ');
  const bouton = (debut: string): HTMLButtonElement => Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(debut)) as HTMLButtonElement;

  function monter(lot: LotAttribution): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AttributionLot);
    fixture.componentRef.setInput('idDmc', 50);
    fixture.componentRef.setInput('lot', lot);
    fixture.componentRef.setInput('prmp', true);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('MT-b1 : tous les proposés retenus par défaut — le corps n’en nomme aucun', () => {
    monter(AVIS_FAV);
    expect(racine().querySelectorAll('.al__choix input[type=checkbox]').length).toBe(3);
    bouton('Attribuer à 3 titulaires').click();
    const post = http.expectOne('/api/fiches-marche/50/attribution/lots/1/attribuer');
    expect(post.request.body).toEqual({ motif: null });
    post.flush({ idDmc: 50, lots: [] });
  });

  it('MT-b1 : une sélection partielle exige un motif et envoie les retenus', () => {
    monter(AVIS_FAV);
    (racine().querySelectorAll('.al__choix input[type=checkbox]')[2] as HTMLInputElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(bouton('Attribuer à 2 titulaires').disabled).toBe(true);
    const motif = Array.from(racine().querySelectorAll('label')).find((l) => l.textContent?.includes('Motif de la sélection partielle'))!.querySelector('input') as HTMLInputElement;
    motif.value = 'Capacité insuffisante pour le volume';
    motif.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    bouton('Attribuer à 2 titulaires').click();
    const post = http.expectOne('/api/fiches-marche/50/attribution/lots/1/attribuer');
    expect(post.request.body).toEqual({ motif: 'Capacité insuffisante pour le volume', titulaires: ['o-4', 'o-2'] });
    post.flush({ code: 'TITULAIRES_TROP_NOMBREUX', message: 'x' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(racine().querySelector('.alert-danger')?.textContent).toContain('nombre maximal');
  });

  it('MT-b2 : un suivi par titulaire ; le retiré est dit, l’autre se retire seul ; pas de réattribution', () => {
    monter(INFORME);
    expect(texte()).toContain('Contrat-cadre attribué à 2 titulaires');
    expect(texte()).toContain('Retiré le');
    expect(texte()).toContain('Le contrat-cadre continue avec les autres titulaires');
    expect(texte()).not.toContain('Pièces de l’attributaire');
    // L'original de l'acte d'engagement se dépose POUR le titulaire.
    expect(bouton('Enregistrer l’original reçu')).toBeTruthy();
    const motif = Array.from(racine().querySelectorAll('label')).find((l) => l.textContent?.includes('Motif du retrait'))!.querySelector('input') as HTMLInputElement;
    motif.value = 'Pièces fiscales non remises';
    motif.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    bouton('Retirer ce titulaire').click();
    const post = http.expectOne('/api/fiches-marche/50/attribution/lots/1/retirer');
    expect(post.request.body).toEqual({ motif: 'Pièces fiscales non remises', idOffre: 'o-4' });
    post.flush({ code: 'PIECES_NON_CONFORMES', message: 'x', details: { offres: [4] } }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(racine().querySelector('.alert-danger')?.textContent).toContain('(offre n° 4)');
  });

  it('MT-b2 : le contrat-cadre retiré en entier ne propose pas de réattribution (art. 18)', () => {
    monter({ ...INFORME, etat: 'RETIRE', retrait: { le: '2026-10-16T11:00:00', par: 'PRMP001', motif: 'Plus aucun titulaire' } });
    expect(texte()).toContain('ne se réattribue pas');
    expect(bouton('Réattribuer au candidat suivant')).toBeUndefined();
  });
});
