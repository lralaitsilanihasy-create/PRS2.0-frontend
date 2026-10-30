import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { ProcedureInterne, Role } from '../../models';
import { FicheMarcheService } from '../../services/fiche-marche.services';
import { MandatService } from '../../services/comptes.services';
import { AuthService } from '../auth/auth.service';
import { VacanceStore } from '../vacance/vacance.store';
import { ProceduresEnLigneStore, RELECTURE_MS } from './procedures-en-ligne.store';

// ⚠️ 30/10 (mesure de performance) — la liste des procédures en ligne n'est plus relue à chaque navigation, et la vacance PRMP n'est
// demandée qu'une fois quand deux vérifications se croisent au démarrage.
describe('Relectures du layout limitées', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  describe('procédures en ligne', () => {
    const role = signal<Role | null>('ADMINISTRATEUR');
    const ref = signal<string | null>('ADMIN01');
    let appels = 0;
    let maintenant = 1_000;

    function store(): ProceduresEnLigneStore {
      appels = 0;
      role.set('ADMINISTRATEUR');
      ref.set('ADMIN01');
      vi.spyOn(performance, 'now').mockImplementation(() => maintenant);
      TestBed.configureTestingModule({
        providers: [
          ProceduresEnLigneStore,
          { provide: AuthService, useValue: { role, ref } },
          { provide: FicheMarcheService, useValue: { enLigne: () => { appels++; return of([{ idDmc: 1 } as ProcedureInterne]); } } },
        ],
      });
      return TestBed.inject(ProceduresEnLigneStore);
    }

    it('lue une fois, puis plus avant cinq minutes ; relue ensuite', () => {
      const s = store();
      s.verifier();
      expect(appels).toBe(1);
      expect(s.nombre()).toBe(1);
      maintenant += 60_000;
      s.verifier();
      s.verifier();
      expect(appels).toBe(1);
      maintenant += RELECTURE_MS;
      s.verifier();
      expect(appels).toBe(2);
    });

    it('relue tout de suite sur demande (après un geste), et au changement de compte', () => {
      const s = store();
      s.verifier();
      s.verifier(true);
      expect(appels).toBe(2);
      role.set('RESPONSABLE_PROCEDURE');
      ref.set('RESPRO1');
      s.verifier();
      expect(appels).toBe(3);
    });
  });

  it('vacance PRMP : deux vérifications simultanées ne font qu’un appel', () => {
    const reponse = new Subject<void>();
    let appels = 0;
    TestBed.configureTestingModule({
      providers: [
        VacanceStore,
        { provide: AuthService, useValue: { role: signal<Role | null>('PRMP') } },
        { provide: MandatService, useValue: { actif: () => { appels++; return reponse; } } },
      ],
    });
    const s = TestBed.inject(VacanceStore);
    s.verifier();
    s.verifier();
    expect(appels).toBe(1);
    reponse.next();
    reponse.complete();
    s.verifier();
    expect(appels).toBe(2);
  });
});
