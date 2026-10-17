import { FicheMarche } from '../../models';
import { numeroProcedure } from './entete-procedure';

const fiche = (typeMarche: FicheMarche['typeMarche'], valeurs: Record<string, unknown>) =>
  ({ typeMarche, valeurs }) as Pick<FicheMarche, 'typeMarche' | 'valeurs'>;

describe('En-tête de procédure — le numéro, comme sur le DAO complet (charte, R1 et R6)', () => {
  it('appel d’offres : B02-OB-03 ; vide sans numéro saisi', () => {
    expect(numeroProcedure(fiche('QUANTITE_FIXE', { 'B02-OB-03': ' AOO n° 12/MEF ', 'B02-OE-01': '07-CC' }))).toBe('AOO n° 12/MEF');
    expect(numeroProcedure(fiche('QUANTITE_FIXE', {}))).toBe('');
  });

  it('contrat-cadre : B02-OE-01 d’abord, puis B02-OB-03', () => {
    expect(numeroProcedure(fiche('CONTRAT_CADRE', { 'B02-OE-01': '07-CC/MEF/SG/PRMP.2027', 'B02-OB-03': 'autre' }))).toBe('07-CC/MEF/SG/PRMP.2027');
    expect(numeroProcedure(fiche('CONTRAT_CADRE', { 'B02-OB-03': 'AOO n° 3' }))).toBe('AOO n° 3');
  });
});
