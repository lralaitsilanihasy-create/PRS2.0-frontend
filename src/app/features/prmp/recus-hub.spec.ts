import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { LigneEligible, RecuDao } from '../../models';
import { DmcService, FicheMarcheService } from '../../services';
import { RecusHub } from './recus-hub';

const LIGNE = (idDmc: number, designationMarche: string, recusEnAttente: number): LigneEligible =>
  ({ idDmc, idDossier: 1, refeDossier: '00001/PPM-AGPM/CNM/2026', designationMarche, recusEnAttente, nbOffres: 2, sousType: 'DAOO' }) as unknown as LigneEligible;
const RECU = (idRecu: number, etat: RecuDao['etat']): RecuDao =>
  ({ idRecu, lots: null, montant: 100000, referencePaiement: 'REF-' + idRecu, datePaiement: '2026-10-20', banque: null, nomFichier: 'recu.pdf', dateDepot: '2026-10-21T10:00:00', etat, motifRefus: null, dateDecision: null, decidePar: null, entreprise: { raisonSociale: 'Entreprise ' + idRecu, nif: '1' } }) as RecuDao;

// ⚠️ 31/10 (Espace de travail, lot 3b) — les reçus des frais en deux volets.
describe('Reçus des frais de dossier — deux volets', () => {
  const monter = () => {
    const recus = vi.fn((id: number) => of(id === 20 ? [RECU(1, 'EN_ATTENTE'), RECU(2, 'VALIDE')] : []));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: DmcService, useValue: { eligibles: () => of([LIGNE(10, 'Fournitures de bureau', 0), LIGNE(20, 'Entretien des voies urbaines', 1)]) } },
        { provide: FicheMarcheService, useValue: { recus } },
      ],
    });
    const fixture = TestBed.createComponent(RecusHub);
    fixture.detectChanges();
    return { fixture, hote: fixture.nativeElement as HTMLElement, recus };
  };
  const texte = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('les appels d’offres à gauche, ceux qui ont des reçus à valider en tête ; le premier est choisi d’office et ses reçus lus', () => {
    const { hote, recus } = monter();
    const lignes = Array.from(hote.querySelectorAll('.rh__item'));
    expect(lignes.map((l) => texte(l.querySelector('.rh__objet')))).toEqual(['Entretien des voies urbaines', 'Fournitures de bureau']);
    expect(lignes[0].classList).toContain('rh__item--on');
    expect(recus).toHaveBeenCalledWith(20);
    expect(texte(hote.querySelector('.rh__detail-titre'))).toBe('Entretien des voies urbaines');
    expect(texte(hote.querySelector('.rh__detail'))).toContain('1 reçu attend votre décision · 2 au total');
  });

  it('choisir un autre appel d’offres affiche ses reçus à droite, sans changer de page', () => {
    const { fixture, hote, recus } = monter();
    (hote.querySelectorAll<HTMLButtonElement>('.rh__ligne')[1]).click();
    fixture.detectChanges();
    expect(recus).toHaveBeenLastCalledWith(10);
    expect(texte(hote.querySelector('.rh__detail-titre'))).toBe('Fournitures de bureau');
    expect(texte(hote.querySelector('.rh__detail'))).toContain('Aucun reçu déposé pour l’instant');
  });

  it('un reçu décidé prend son état ; le compte « à valider » de l’appel d’offres et l’indicateur suivent', () => {
    const { fixture, hote } = monter();
    fixture.componentInstance.appliquer(20, RECU(1, 'VALIDE'));
    fixture.detectChanges();
    expect(texte(hote.querySelector('.rh__item'))).not.toContain('à valider');
    const premier = hote.querySelector('app-carte-indicateurs .ci__case');
    expect([texte(premier?.querySelector('dt') ?? null), texte(premier?.querySelector('dd') ?? null)]).toEqual(['reçu à valider', '0']);
  });
});
