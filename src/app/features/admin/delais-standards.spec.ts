import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { DelaiSousType } from '../../models';
import { DelaisStandards } from './delais-standards';

const LIGNES: DelaiSousType[] = [
  { idSousType: 'DSS', etape: 'EXAMEN', delaiHeures: 40, standardHeures: 40, surcharge: false },
  { idSousType: 'DSS', etape: 'DISPATCH', delaiHeures: 4, standardHeures: 8, surcharge: true },
];

describe('Délais standards — par sous-type (manuel de contrôle, M5b — V99)', () => {
  let fixture: ComponentFixture<DelaisStandards>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const lignes = () => Array.from(racine().querySelectorAll('.dst__st tbody tr'));

  beforeEach(() => {
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({ imports: [DelaisStandards], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DelaisStandards);
    fixture.detectChanges();
    http.expectOne('/api/delais-standards').flush([]);
    http.expectOne('/api/sous-type-dossiers').flush([
      { idSousType: 'DSS', libelleSousType: 'Déclaration sans suite', idTypeDossier: 'DSS' },
      { idSousType: 'DAOO', libelleSousType: 'DAO ouvert', idTypeDossier: 'DMC' },
    ]);
    fixture.detectChanges();
    fixture.componentInstance.choisirSousType('DSS');
    http.expectOne('/api/delais-standards/sous-types/DSS').flush(LIGNES);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('montre chaque étape : le standard, le délai du sous-type, et s’il est propre au sous-type', () => {
    expect(lignes()).toHaveLength(2);
    expect(texte(lignes()[0])).not.toContain('propre au sous-type');
    expect(texte(lignes()[1])).toContain('8 h');
    expect(texte(lignes()[1])).toContain('propre au sous-type');
    expect(texte(lignes()[1])).toContain('Revenir au standard');
  });

  it('règle le délai d’une étape, puis le rend au standard', () => {
    fixture.componentInstance.saisirSt('EXAMEN', '16');
    fixture.componentInstance.reglerSt(LIGNES[0]);
    const put = http.expectOne('/api/delais-standards/sous-types/DSS/EXAMEN');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ delaiHeures: 16 });
    put.flush({ ...LIGNES[0], delaiHeures: 16, surcharge: true });
    fixture.detectChanges();
    expect(texte(lignes()[0])).toContain('propre au sous-type');

    fixture.componentInstance.revenirSt(fixture.componentInstance.lignesSt()[1]);
    const del = http.expectOne('/api/delais-standards/sous-types/DSS/DISPATCH');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    fixture.detectChanges();
    expect(fixture.componentInstance.lignesSt()[1]).toMatchObject({ delaiHeures: 8, surcharge: false });
    expect(toast.success).toHaveBeenCalledTimes(2);
  });

  it('refuse un délai qui n’est pas un entier d’au moins 1 heure, sans appel', () => {
    fixture.componentInstance.saisirSt('EXAMEN', '0');
    fixture.componentInstance.reglerSt(LIGNES[0]);
    expect(toast.error).toHaveBeenCalled();
  });
});
