import { EchangeDto } from '../../models';
import { DossiersClotures } from './dossiers-clotures';

/**
 * ⚠️ Vues internes CNM (correctif du 2026-09-15) : pour la PRMP, le serveur ne sert plus le matricule
 * du vérificateur sur les OBSERVATION de l'historique des échanges. L'écran nomme alors l'institution
 * et n'affiche jamais de séparateur orphelin (« 10/09/2026 · »).
 */
describe('DossiersClotures — auteur d’un échange', () => {
  const acteurEchange = (e: EchangeDto) => DossiersClotures.prototype.acteurEchange.call(null, e);
  const echange = (type: EchangeDto['type'], acteur: string | null): EchangeDto => ({ type, date: '2026-09-10', acteur, texte: 'Texte' });

  it('affiche le matricule quand le serveur le sert (profils CNM)', () => {
    expect(acteurEchange(echange('OBSERVATION', 'VERIF01'))).toBe('VERIF01');
  });

  it('nomme la Commission quand le matricule du vérificateur est masqué (PRMP)', () => {
    expect(acteurEchange(echange('OBSERVATION', null))).toBe('Commission nationale des marchés');
  });

  it('n’invente rien pour une rectification sans auteur', () => {
    expect(acteurEchange(echange('RECTIFICATION', null))).toBe('');
  });
});
