import { SousTypeDossier } from '../../models';
import { SOUS_TYPES_PAR_LA_LIGNE, trierSousTypesCreables } from './sous-types-par-la-ligne';

/** ⚠️ 04/11 (pilote, temps 1) — « Créer un dossier » ne propose plus ce qui se crée depuis la ligne du plan. */
describe('trierSousTypesCreables', () => {
  const st = (id: string): SousTypeDossier => ({ idSousType: id, libelleSousType: id, idTypeDossier: 'DMC' } as SousTypeDossier);
  const dmc = [st('CP'), st('RJ'), st('DAOO'), st('DC')];

  it('sans ligne : la consultation de prix reste, le rapport justificatif et les dossiers d’appel d’offres partent vers le plan', () => {
    const t = trierSousTypesCreables(dmc, false);
    expect(t.proposes.map((x) => x.idSousType)).toEqual(['CP']);
    expect(t.parLaLigne.map((x) => x.idSousType)).toEqual(['RJ', 'DAOO', 'DC']);
  });

  it('depuis la ligne du plan (?ligne=) : tout est proposé, le sous-type voulu peut être choisi d’avance', () => {
    const t = trierSousTypesCreables(dmc, true);
    expect(t.proposes.map((x) => x.idSousType)).toEqual(['CP', 'RJ', 'DAOO', 'DC']);
    expect(t.parLaLigne).toEqual([]);
  });

  it('le marché de gré à gré se crée depuis la ligne ; un acte de gestion, non', () => {
    expect(SOUS_TYPES_PAR_LA_LIGNE.has('MGG')).toBe(true);
    expect(SOUS_TYPES_PAR_LA_LIGNE.has('AVENANT')).toBe(false);
  });
});
