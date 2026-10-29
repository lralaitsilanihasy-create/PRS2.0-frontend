import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { ReceptionAMoi, ReceptionCommande, ReceptionsBon } from '../../models';
import { ReceptionsMembre } from './receptions-membre';

const RECEPTION = { id: 21, idBon: 11, numeroBon: 1, idContrat: 2, idDmc: 5, lot: 1, type: 'PROVISOIRE', etat: 'PV_ETABLI', decision: 'RECEPTION',
  attendus: [], pvDisponible: true } as unknown as ReceptionCommande;
const MIENNE = (aSigner: boolean): ReceptionAMoi => ({ reception: RECEPTION, objetBon: 'Reprise de chaussée', titulaire: 'SAVA Routes', president: false, aEtablir: false, aSigner });
const BON = { idBon: 11, numero: 1, objet: null, titulaire: null, etatReception: 'EN_RECEPTION', garantieMois: null, garantieJusquau: null, alertes: [],
  receptions: [RECEPTION] } as unknown as ReceptionsBon;

describe('Réceptions du membre de la commission', () => {
  it('29/10 (recette des formes) — après sa signature, la liste est relue : le badge « À signer » disparaît', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ReceptionsMembre);
    const racine = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne('/api/receptions-commandes/miennes').flush([MIENNE(true)]);
    fixture.detectChanges();
    http.expectOne('/api/receptions-commandes/bons/11').flush(BON);
    fixture.detectChanges();
    expect(racine.querySelector('.rm__tete')?.textContent).toContain('À signer');

    Array.from(racine.querySelectorAll('button')).find((b) => b.textContent?.includes('Signer le procès-verbal'))!.click();
    http.expectOne('/api/receptions-commandes/21/signature').flush(RECEPTION);
    http.expectOne('/api/receptions-commandes/bons/11').flush(BON);
    http.expectOne('/api/receptions-commandes/miennes').flush([MIENNE(false)]);
    fixture.detectChanges();
    expect(racine.querySelector('.rm__tete')?.textContent).not.toContain('À signer');
    http.verify();
  });
});
