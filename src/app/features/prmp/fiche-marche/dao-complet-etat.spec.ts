import { ApiError } from '../../../core/errors/api-error';
import { messageSoumissionRefusee } from '../../../shared/circuit/controles-libelles';
import { daoCompletEnPreparation, phraseDaoComplet } from './dao-complet-etat';

describe('DAO complet en file (V144) — l’état en une phrase', () => {
  const d = (etat: 'EN_FILE' | 'EN_COURS' | 'PRET' | 'ECHEC' | 'SANS_WORD', rang: number | null = null, motif: string | null = null) => ({ etat, rang, depuis: null, motif });

  it('en file : le rang, et la promesse de prévenir', () => {
    expect(phraseDaoComplet(d('EN_FILE', 3))?.texte).toBe('Le DAO complet est en préparation — n° 3 dans la file. Vous serez prévenu quand il sera prêt.');
  });

  it('en file après un échec : le motif et le nouvel essai', () => {
    const p = phraseDaoComplet(d('EN_FILE', 1, 'Délai dépassé.'));
    expect(p?.texte).toContain('n’a pas pu être assemblé (Délai dépassé) : un nouvel essai est prévu — n° 1 dans la file');
    expect(p?.ton).toBe('info');
  });

  it('en échec : alerte, avec le motif', () => {
    const p = phraseDaoComplet(d('ECHEC', null, 'Word absent'));
    expect(p?.ton).toBe('alerte');
    expect(p?.texte).toContain('après trois essais (Word absent)');
  });

  it('prêt, ou sans version validée : rien à dire', () => {
    expect(phraseDaoComplet(d('PRET'))).toBeNull();
    expect(phraseDaoComplet(null)).toBeNull();
  });

  it('la préparation couvre la file et l’assemblage, pas le reste', () => {
    expect(daoCompletEnPreparation(d('EN_FILE', 1))).toBe(true);
    expect(daoCompletEnPreparation(d('EN_COURS'))).toBe(true);
    expect(daoCompletEnPreparation(d('PRET'))).toBe(false);
    expect(daoCompletEnPreparation(d('ECHEC'))).toBe(false);
    expect(daoCompletEnPreparation(null)).toBe(false);
  });
});

describe('DAO complet en file (V144, Q5) — le refus de soumission', () => {
  const refus = (corps: object): ApiError => ({ status: 409, message: 'x', code: 'DAO_COMPLET_EN_PREPARATION', raw: { error: { code: 'DAO_COMPLET_EN_PREPARATION', ...corps } } }) as unknown as ApiError;

  it('garde le message du serveur, qui nomme le rang', () => {
    const m = 'Le DAO complet est en préparation (n° 2 dans la file) : la Commission examine le DAO tel que les candidats le recevront.';
    expect(messageSoumissionRefusee(refus({ message: m, details: { rang: 2 } }))).toBe(m);
  });

  it('sans message, le reconstruit : rang, ou assemblage en cours', () => {
    expect(messageSoumissionRefusee(refus({ details: { rang: 4 } }))).toContain('(n° 4 dans la file)');
    expect(messageSoumissionRefusee(refus({ details: { rang: null } }))).toContain('(assemblage en cours)');
  });
});
