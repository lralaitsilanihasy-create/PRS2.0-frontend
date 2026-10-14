import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { toApiError } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { MigrationMode, refusMigration } from './migration-mode';

// ⚠️ R8 (V110, 13/10) — la migration documentée du mode de remise, Administrateur seul.
describe('Migration du mode de remise (R8)', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('propose l’autre mode, exige le motif, envoie la migration et prévient la fiche', () => {
    const f = TestBed.createComponent(MigrationMode);
    f.componentRef.setInput('idDmc', 42);
    f.componentRef.setInput('modeActuel', 'ELECTRONIQUE');
    let migree = 0;
    f.componentInstance.migree.subscribe(() => migree++);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    (el.querySelector('button') as HTMLButtonElement).click();
    f.detectChanges();
    const valider = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Migrer vers la remise papier')) as HTMLButtonElement;
    expect(valider.disabled).toBe(true);
    const motif = el.querySelector('textarea') as HTMLTextAreaElement;
    motif.value = 'Plateforme indisponible';
    motif.dispatchEvent(new Event('input'));
    f.detectChanges();
    valider.click();
    const post = http.expectOne('/api/fiches-marche/42/migrer-mode');
    expect(post.request.body).toEqual({ modeRemise: 'PAPIER', motif: 'Plateforme indisponible' });
    post.flush({});
    expect(migree).toBe(1);
  });

  it('nomme le point de non-retour et les autres refus', () => {
    const e = (code: string, details?: object) => toApiError(new HttpErrorResponse({ status: 409, error: { code, details } }));
    expect(refusMigration(e('MODE_IRREVERSIBLE', { raison: 'OFFRES' }))).toContain('des offres sont déjà déposées en ligne');
    expect(refusMigration(e('MODE_IRREVERSIBLE', { raison: 'CEREMONIE_CLOSE' }))).toContain('la cérémonie des clés est close');
    expect(refusMigration(e('MODE_NON_FIGE'))).toContain('dans le cadrage');
  });
});
