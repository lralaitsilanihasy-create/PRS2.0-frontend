import { Controleur, Interim, Role } from '../../models';
import { dateFr, interimairesAdmissibles, jusquA, periodeInterim, peutRevoquer, titulairesPossibles } from './interim-libelles';

const c = (imControleur: string, idProfile: number, idLocalite: string | null): Controleur => ({ imControleur, idProfile, idLocalite, transversal: false });
/** Référentiel des profils du décor : 1 Président, 3 CC, 4 Membre, 5 Vérificateur. */
const roleDe = (x: Controleur): Role | null =>
  x.idProfile === 1 ? 'PRESIDENT' : x.idProfile === 3 ? 'CHEF_COMMISSION' : x.idProfile === 4 ? 'MEMBRE' : x.idProfile === 5 ? 'VERIFICATEUR' : null;

const PRES = c('PRES001', 1, null);
const CC_ANT1 = c('CCANT01', 3, 'ANT');
const CC_ANT2 = c('CCANT02', 3, 'ANT');
const CC_TMS = c('CCTMS01', 3, 'TMS');
const MEM_ANT = c('MEMANT1', 4, 'ANT');
const MEM_TMS = c('MEMTMS1', 4, 'TMS');
const VER_ANT = c('VERANT1', 5, 'ANT');
const TOUS = [PRES, CC_ANT1, CC_ANT2, CC_TMS, MEM_ANT, MEM_TMS, VER_ANT];

describe('Intérim désigné — règles pures (arbitrage pilote du 21/09)', () => {
  it('le Président est suppléé par tout Chef de commission, de toute localité — jamais par un Membre', () => {
    expect(interimairesAdmissibles(PRES, TOUS, roleDe).map((x) => x.imControleur)).toEqual(['CCANT01', 'CCANT02', 'CCTMS01']);
  });

  it('un CC de la Centrale est suppléé par un autre CC de sa localité ou un Membre de sa localité — jamais lui-même, jamais ailleurs', () => {
    expect(interimairesAdmissibles(CC_ANT1, TOUS, roleDe).map((x) => x.imControleur)).toEqual(['CCANT02', 'MEMANT1']);
  });

  it('un CC régional (seul CC de sa localité) n’a que les Membres de sa localité', () => {
    expect(interimairesAdmissibles(CC_TMS, TOUS, roleDe).map((x) => x.imControleur)).toEqual(['MEMTMS1']);
  });

  it('un Membre ou un Vérificateur ne déclare pas d’absence dans ce lot : aucun intérimaire', () => {
    expect(interimairesAdmissibles(MEM_ANT, TOUS, roleDe)).toEqual([]);
    expect(interimairesAdmissibles(VER_ANT, TOUS, roleDe)).toEqual([]);
    expect(interimairesAdmissibles(null, TOUS, roleDe)).toEqual([]);
  });

  it('titulaires possibles : le Président et les Chefs de commission', () => {
    expect(titulairesPossibles(TOUS, roleDe).map((x) => x.imControleur)).toEqual(['PRES001', 'CCANT01', 'CCANT02', 'CCTMS01']);
  });

  it('révocation : titulaire, désignateur ou Admin, tant que l’intérim est ACTIF ou A_VENIR', () => {
    const i = { imTitulaire: 'CCANT01', designePar: 'ADMIN01', statut: 'ACTIF' } as Interim;
    expect(peutRevoquer(i, 'CCANT01', false)).toBe(true);
    expect(peutRevoquer(i, 'ADMIN01', false)).toBe(true);
    expect(peutRevoquer(i, 'MEMANT1', true)).toBe(true);
    expect(peutRevoquer(i, 'MEMANT1', false)).toBe(false);
    expect(peutRevoquer({ ...i, statut: 'A_VENIR' }, 'CCANT01', false)).toBe(true);
    expect(peutRevoquer({ ...i, statut: 'ACHEVE' }, 'CCANT01', true)).toBe(false);
    expect(peutRevoquer({ ...i, statut: 'REVOQUE' }, 'CCANT01', true)).toBe(false);
  });

  it('dates et périodes en français', () => {
    expect(dateFr('2026-09-30')).toBe('30/09/2026');
    expect(dateFr('2026-09-20T10:00:00')).toBe('20/09/2026');
    expect(dateFr(null)).toBe('');
    expect(periodeInterim({ dateDebut: '2026-09-21', dateFin: '2026-09-30' })).toBe('du 21/09/2026 au 30/09/2026');
    expect(periodeInterim({ dateDebut: '2026-09-21', dateFin: null })).toBe('à partir du 21/09/2026, sans terme');
    expect(jusquA({ dateFin: '2026-09-30' })).toBe("jusqu'au 30/09/2026");
    expect(jusquA({ dateFin: null })).toBe('sans terme');
  });
});
