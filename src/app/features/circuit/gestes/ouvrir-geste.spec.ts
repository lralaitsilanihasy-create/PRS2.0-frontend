import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { AFaireTache, Dispatch, Dossier, Reception } from '../../../models';
import { DispatchService, DossierService, ReceptionService } from '../../../services';
import { exempleAFairePresident } from '../../home/a-faire/a-faire-contrat.exemple';
import { OuvrirGeste } from './ouvrir-geste';

/**
 * Préparation des modales de geste, partagée par « À faire » et la page dossier (lot L4-F3) : chaque
 * modale ne lit que ce qu'elle attend — la réattribution seule demande le dispatch.
 */
describe('OuvrirGeste', () => {
  const lectures = { dossier: vi.fn(), reception: vi.fn(), dispatch: vi.fn() };

  beforeEach(() => {
    lectures.dossier = vi.fn((id: number) => of({ idDossier: id, statut: 'PRET_DISPATCH' } as Dossier));
    lectures.reception = vi.fn((id: number) => of({ idReception: id } as Reception));
    lectures.dispatch = vi.fn((id: number) => of({ idDispatch: id } as Dispatch));
    TestBed.configureTestingModule({
      providers: [
        { provide: DossierService, useValue: { getById: lectures.dossier } },
        { provide: ReceptionService, useValue: { getById: lectures.reception } },
        { provide: DispatchService, useValue: { getById: lectures.dispatch } },
      ],
    });
  });

  const tache = (refs: Partial<AFaireTache['refs']>): AFaireTache => {
    const t = exempleAFairePresident().taches[0];
    return { ...t, refs: { ...t.refs, ...refs } };
  };

  it('numérotation, pièces du dépôt, consultation : le dossier seul', async () => {
    const service = TestBed.inject(OuvrirGeste);
    const t = tache({ idReception: 7, idDispatch: 3 });
    for (const modale of ['reception', 'pieces-depot', 'consultation'] as const) {
      const m = await firstValueFrom(service.preparer(modale, t));
      expect(m).toEqual({ type: modale, dossier: { idDossier: t.dossier.idDossier, statut: 'PRET_DISPATCH' } });
    }
    expect(lectures.reception).not.toHaveBeenCalled();
    expect(lectures.dispatch).not.toHaveBeenCalled();
  });

  it('dispatch : dossier et réception ; réattribution : le dispatch en plus', async () => {
    const service = TestBed.inject(OuvrirGeste);
    const t = tache({ idReception: 7, idDispatch: 3 });

    const dispatch = await firstValueFrom(service.preparer('dispatch', t));
    expect(dispatch).toEqual({ type: 'dispatch', items: [{ dossier: expect.objectContaining({ idDossier: t.dossier.idDossier }), reception: { idReception: 7 } }], reattribution: null });
    expect(lectures.dispatch).not.toHaveBeenCalled();

    const reattribution = await firstValueFrom(service.preparer('reattribution', t));
    expect(reattribution).toEqual(expect.objectContaining({ type: 'dispatch', reattribution: { idDispatch: 3 } }));
    expect(lectures.dispatch).toHaveBeenCalledWith(3);
  });

  it('dispatch groupé : un élément par tâche, sans réattribution', async () => {
    const service = TestBed.inject(OuvrirGeste);
    const m = await firstValueFrom(service.preparerLot([tache({ idReception: 7 }), { ...tache({ idReception: 8 }), dossier: { ...tache({}).dossier, idDossier: 99 } }]));
    expect(m.type).toBe('dispatch');
    expect(m.type === 'dispatch' ? m.items.map((i) => [i.dossier.idDossier, i.reception.idReception]) : []).toEqual([
      [exempleAFairePresident().taches[0].dossier.idDossier, 7],
      [99, 8],
    ]);
  });
});
