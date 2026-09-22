import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { Interim, MesInterims, Role } from '../../models';
import { InterimService } from '../../services/comptes.services';
import { AuthService } from '../auth/auth.service';
import { InterimStore } from './interim.store';

export function interimFixture(partiel: Partial<Interim> = {}): Interim {
  return {
    idInterim: 7,
    imTitulaire: 'CCANT01',
    nomTitulaire: 'RAKOTO Hery',
    profilTitulaire: 'CHEF_COMMISSION',
    idLocaliteTitulaire: 'ANT',
    imInterimaire: 'MEMANT1',
    nomInterimaire: 'RABE Solo',
    profilInterimaire: 'MEMBRE',
    idLocaliteInterimaire: 'ANT',
    dateDebut: '2026-09-21',
    dateFin: '2026-09-30',
    motif: 'CONGE',
    reference: 'NS 2026-118',
    pieceNom: 'note.pdf',
    pieceDisponible: true,
    designePar: 'CCANT01',
    nomDesignePar: 'RAKOTO Hery',
    dateDesignation: '2026-09-20T10:00:00',
    statut: 'ACTIF',
    dateRevocation: null,
    motifRevocation: null,
    revoquePar: null,
    ...partiel,
  };
}

function configure(role: Role | null, ref: string | null, mes: () => ReturnType<InterimService['mes']>): { store: InterimStore; appels: () => number } {
  let appels = 0;
  TestBed.configureTestingModule({
    providers: [
      InterimStore,
      { provide: AuthService, useValue: { role: signal(role), ref: signal(ref) } },
      {
        provide: InterimService,
        useValue: {
          mes: () => {
            appels++;
            return mes();
          },
        },
      },
    ],
  });
  return { store: TestBed.inject(InterimStore), appels: () => appels };
}

describe('InterimStore — intérim désigné (21/09)', () => {
  it('Membre intérimaire d’un CC : `exerces` porte l’intérim, `titulaireSupplee` le retrouve par matricule', async () => {
    const i = interimFixture();
    const { store, appels } = configure('MEMBRE', 'MEMANT1', () => of<MesInterims>({ exerces: [i], subi: null, aVenir: [] }));
    await firstValueFrom(store.charger());
    expect(store.exerces()).toEqual([i]);
    expect(store.subi()).toBeNull();
    expect(store.suppleeQuelquUn()).toBe(true);
    expect(store.titulaireSupplee('CCANT01')).toBe(i);
    expect(store.titulaireSupplee('AUTRE')).toBeNull();
    expect(store.nomTitulaire('CCANT01')).toBe('RAKOTO Hery');
    expect(store.nomTitulaire('INCONNU')).toBe('INCONNU');
    expect(store.chargePour()).toBe('MEMANT1');
    expect(appels()).toBe(1);
  });

  it('profil non concerné (PRMP) : état vide SANS requête', async () => {
    const { store, appels } = configure('PRMP', 'PRMP001', () => of<MesInterims>({ exerces: [interimFixture()], subi: null, aVenir: [] }));
    await firstValueFrom(store.assurer());
    expect(store.exerces()).toEqual([]);
    expect(appels()).toBe(0);
  });

  it('`assurer` ne recharge pas un état déjà connu pour ce matricule ; `verifier` relit', async () => {
    const { store, appels } = configure('CHEF_COMMISSION', 'CCANT01', () => of<MesInterims>({ exerces: [], subi: interimFixture(), aVenir: [] }));
    await firstValueFrom(store.assurer());
    await firstValueFrom(store.assurer());
    expect(appels()).toBe(1);
    expect(store.subi()?.imInterimaire).toBe('MEMANT1');
    store.verifier();
    expect(appels()).toBe(2);
  });

  it('échec du serveur : l’état connu est conservé et rien ne lève (les gardes serveur tranchent)', async () => {
    let echoue = false;
    const { store } = configure('MEMBRE', 'MEMANT1', () =>
      echoue ? throwError(() => new Error('500')) : of<MesInterims>({ exerces: [interimFixture()], subi: null, aVenir: [] }),
    );
    await firstValueFrom(store.charger());
    echoue = true;
    const etat = await firstValueFrom(store.charger());
    expect(etat.exerces.length).toBe(1);
    expect(store.exerces().length).toBe(1);
  });

  it('`reinitialiser` efface tout (déconnexion)', async () => {
    const { store } = configure('MEMBRE', 'MEMANT1', () => of<MesInterims>({ exerces: [interimFixture()], subi: null, aVenir: [interimFixture({ statut: 'A_VENIR' })] }));
    await firstValueFrom(store.charger());
    store.reinitialiser();
    expect(store.exerces()).toEqual([]);
    expect(store.aVenir()).toEqual([]);
    expect(store.chargePour()).toBeNull();
  });
});
