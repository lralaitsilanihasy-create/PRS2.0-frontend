import { GesteAFaire } from '../../../models';
import { LIBELLES_GESTES } from './a-faire-libelles';

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
});
