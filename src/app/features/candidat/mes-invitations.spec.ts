import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { InvitationCandidat } from '../../models';
import { MesInvitations } from './mes-invitations';

const INVITATIONS: InvitationCandidat[] = [
  {
    idDmc: 49, reference: 'AMI-2026-049', objet: 'Étude de faisabilité', autoriteContractante: 'Ministère de démonstration', rang: 1,
    source: 'AMI', inviteLe: '2026-10-08T10:00:00', etatProcedure: 'OUVERTE', dateLimite: '2026-10-30T10:00', lettreDisponible: true,
  },
  {
    idDmc: 51, reference: null, objet: null, autoriteContractante: null, rang: null,
    source: 'SAISIE', inviteLe: null, etatProcedure: null, dateLimite: null, lettreDisponible: false,
  },
];

describe('Mes invitations (lot 3 PI, tranche PI-a — V84)', () => {
  let fixture: ComponentFixture<MesInvitations>;
  let http: HttpTestingController;

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function monter(): void {
    TestBed.configureTestingModule({
      imports: [MesInvitations],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MesInvitations);
    fixture.detectChanges();
  }

  afterEach(() => {
    http?.verify();
    vi.restoreAllMocks();
  });

  it('liste les invitations : source, rang, date limite ; la procédure et la lettre seulement quand elles existent', () => {
    monter();
    http.expectOne('/api/candidat/invitations').flush(INVITATIONS);
    fixture.detectChanges();
    const cartes = racine().querySelectorAll('.mi__inv');
    expect(cartes).toHaveLength(2);
    expect(texte(cartes[0])).toContain('Retenu sur la liste restreinte de l’appel à manifestation d’intérêt (rang 1)');
    expect(texte(cartes[0])).toContain('Dépôts ouverts');
    expect(texte(cartes[0])).toContain('date limite');
    expect(cartes[0].querySelector('a')?.getAttribute('href')).toBe('/candidat/procedures/49');
    expect(texte(cartes[1])).toContain('Procédure 51');
    expect(texte(cartes[1])).toContain('Procédure en préparation');
    expect(cartes[1].querySelector('a')).toBeNull();
    expect(cartes[1].querySelector('button')).toBeNull();
  });

  it('ouvre la lettre en PDF assaini dans un nouvel onglet ; un échec se dit à l’écran', () => {
    const cree = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const ouvre = vi.spyOn(window, 'open').mockReturnValue(null);
    monter();
    http.expectOne('/api/candidat/invitations').flush(INVITATIONS);
    fixture.detectChanges();
    const bouton = racine().querySelector('.mi__inv button') as HTMLButtonElement;
    bouton.click();
    http.expectOne('/api/candidat/invitations/49/lettre').flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(cree).toHaveBeenCalled();
    expect(ouvre).toHaveBeenCalledWith('blob:test', '_blank');

    bouton.click();
    http.expectOne('/api/candidat/invitations/49/lettre').flush(new Blob([]), { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(texte(racine().querySelector('[role="alert"]'))).toContain('n’a pas pu être ouverte');
  });

  it('sans invitation : explique le rattachement par l’adresse électronique', () => {
    monter();
    http.expectOne('/api/candidat/invitations').flush([]);
    fixture.detectChanges();
    expect(texte(racine().querySelector('.empty-state'))).toContain('créez votre compte avec cette même adresse');
  });
});
