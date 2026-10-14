import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { toApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { LotAttribution } from '../../models';
import { ReputeApprouve } from '../../shared/circuit';
import { AttributionLot, messagePieceTropAncienne } from './attribution-lot';

// ⚠️ FR6 — manuel révisé lot 2, tranches R6b (V107) et R6c (V108) : contrat docs/api-endpoints.md.
describe('R6b — le plan réputé approuvé', () => {
  it('un marqueur daté à côté du statut, l’infobulle dit que l’avis tardif vaut observation ; rien sans marqueur', () => {
    const f = TestBed.createComponent(ReputeApprouve);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent?.trim()).toBe('');
    f.componentRef.setInput('le', '2026-10-19T10:20:00');
    f.detectChanges();
    const badge = (f.nativeElement as HTMLElement).querySelector('.badge') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('Réputé approuvé le 19/10/2026');
    expect(badge.title).toContain('un avis rendu après coup vaut observation');
    f.componentRef.setInput('court', true);
    f.detectChanges();
    expect(badge.textContent?.trim()).toBe('Réputé approuvé');
  });
});

describe('R6c — les délais de l’attribution', () => {
  let http: HttpTestingController;
  afterEach(() => http.verify());

  function rendre(lot: Partial<LotAttribution>): string {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(AttributionLot);
    f.componentRef.setInput('idDmc', 44);
    f.componentRef.setInput('lot', {
      lot: 1, etat: 'INFORME', projetDisponible: true, proposition: null, dossierMarche: null, recours: [], explications: [],
      attributaire: { idOffre: 'o-4', numero: 4, candidat: 'X', nif: '4', montant: 1, montantTtc: 1, delai: null, motif: null, le: '2026-10-07T16:00:00', par: null },
      information: { le: '2026-10-07T16:05:00', par: null, signataire: 'La PRMP', dateAffichage: '2026-10-07', lettres: [] },
      ...lot,
    } as unknown as LotAttribution);
    f.componentRef.setInput('prmp', true);
    f.detectChanges();
    return (f.nativeElement as HTMLElement).textContent ?? '';
  }

  it('le délai d’attente part de la réception présumée de l’information', () => {
    const t = rendre({ delaiAttente: { debut: '2026-10-10', fin: '2026-10-20', signableLe: '2026-10-21', jours: 10, ecoule: false, receptionLe: '2026-10-10', joursReception: 3 } });
    expect(t).toContain('réception présumée de l’information le 10/10/2026, 3 jours après l’envoi');
  });

  it('les limites des pièces fiscale et sociale sont annoncées', () => {
    const t = rendre({ piecesAttributaire: { echeance: '2026-10-22', delaiDepasse: false, fiscaleConforme: null, socialeConforme: null, pieces: [], limiteFiscale: '2026-04-07', limiteSociale: '2026-07-07' } });
    expect(t).toContain('Délivrées au plus tôt le 07/04/2026 (fiscale) et le 07/07/2026 (sociale)');
  });

  it('l’avis d’attribution compte depuis la réception de la notification, et se dit en retard', () => {
    const t = rendre({ avisAttribution: { depart: '2026-10-12', echeance: '2026-11-11', datePublication: null, publieLe: null, par: null, disponible: true, enRetard: true } });
    expect(t).toContain('30 jours après la réception de la notification par le titulaire, le 12/10/2026');
    expect(t).toContain('En retard');
  });

  it('PIECE_TROP_ANCIENNE nomme la pièce, sa date et la limite', () => {
    const e = toApiError(new HttpErrorResponse({ status: 400, error: { code: 'PIECE_TROP_ANCIENNE', details: { nature: 'SOCIALE', dateDelivrance: '2026-06-01', limite: '2026-07-07' } } }));
    expect(messagePieceTropAncienne(e)).toMatch(/^La situation sociale est délivrée le 01\/06\/2026, avant la limite du 07\/07\/2026/);
  });
});
