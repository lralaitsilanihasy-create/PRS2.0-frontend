import { GesteAFaire } from '../../../models';
import { LIBELLES_GESTES, libelleGeste } from './a-faire-libelles';

describe('Libellés des gestes « À faire »', () => {
  it("une action, un verbe : l'aperçu reprend le verbe du bouton de ligne (recette du 15/09)", () => {
    const verbe = (libelle: string): string => libelle.split(' ')[0];
    const ecarts = (Object.entries(LIBELLES_GESTES) as [GesteAFaire, (typeof LIBELLES_GESTES)[GesteAFaire]][])
      .filter(([, l]) => verbe(l.long) !== verbe(l.court) || l.long.length < l.court.length)
      .map(([g, l]) => `${g} : « ${l.court} » / « ${l.long} »`);
    expect(ecarts).toEqual([]);
    expect(LIBELLES_GESTES.DISPATCHER).toMatchObject({ court: 'Dispatcher', long: 'Dispatcher le dossier' });
    expect(LIBELLES_GESTES.NUMEROTER).toMatchObject({ court: 'Numéroter', long: 'Numéroter le dépôt' });
  });

  it('18/10 (§B3) — IMPRIMER_AVIS dit « les lettres » quand la tâche porte des lettres d’invitation, « l’avis » sinon', () => {
    expect(libelleGeste('IMPRIMER_AVIS', { document: 'LETTRES_INVITATION' })).toMatchObject({ court: 'Imprimer les lettres', long: 'Imprimer les lettres d’invitation' });
    expect(libelleGeste('IMPRIMER_AVIS', { document: 'AVIS_SPECIFIQUE' })).toBe(LIBELLES_GESTES.IMPRIMER_AVIS);
    expect(libelleGeste('IMPRIMER_AVIS', null)).toBe(LIBELLES_GESTES.IMPRIMER_AVIS);
    expect(libelleGeste('RECTIFIER', { document: 'LETTRES_INVITATION' })).toBe(LIBELLES_GESTES.RECTIFIER);
  });
});
