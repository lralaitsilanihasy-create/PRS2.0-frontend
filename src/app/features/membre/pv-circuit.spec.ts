import { PvExamen } from '../../models';
import { etapesCircuitPv, phraseEtatPv } from './pv-circuit';

describe('Frise du circuit du projet de PV (maquette du 28/10)', () => {
  const noms = { nom: (im?: string | null) => ({ MEMANT1: 'RAFIDIMANANA Rina', PRES001: 'RAKOTO Président' })[im ?? ''] ?? im ?? '', imDispatcheur: 'PRES001' };
  const pv = (p: Partial<PvExamen>): PvExamen => ({ idPv: 1, idExamen: 1, statutPv: 'BROUILLON', nbNavettes: 0, imCtrlMembre: 'MEMANT1', ...p }) as PvExamen;
  const etats = (p: Partial<PvExamen>) => etapesCircuitPv(pv(p), noms).map((e) => e.etat);

  it('brouillon : l’examen fait, la soumission en cours, le visa du dispatcheur à venir', () => {
    const e = etapesCircuitPv(pv({}), noms);
    expect(e.map((x) => x.etat)).toEqual(['fait', 'encours', 'avenir', 'avenir']);
    expect(e[0].detail).toBe('RAFIDIMANANA Rina');
    expect(e[2].detail).toBe('RAKOTO Président');
  });

  it('chaque statut avance la frise d’une étape', () => {
    expect(etats({ statutPv: 'PROJET_SOUMIS', dateSoumissionInitiale: '2026-10-28' })).toEqual(['fait', 'fait', 'encours', 'avenir']);
    expect(etats({ statutPv: 'PROJET_ACCEPTE' })).toEqual(['fait', 'fait', 'fait', 'encours']);
    expect(etats({ statutPv: 'SIGNE' })).toEqual(['fait', 'fait', 'fait', 'fait']);
  });

  it('les dates s’écrivent à la française, et le co-signataire se nomme une fois désigné', () => {
    const e = etapesCircuitPv(pv({ statutPv: 'SIGNE', dateSoumissionInitiale: '2026-10-28', dateAcceptation: '2026-10-29', nomMembreCoSignataire: 'RAFIDIMANANA Rina', dateSignatureMembre: '2026-10-29' }), noms);
    expect(e[1].detail).toBe('Soumis, le 28/10/2026');
    expect(e[2].detail).toBe('RAKOTO Président, le 29/10/2026');
    expect(e[3].detail).toBe('RAFIDIMANANA Rina, le 29/10/2026');
  });

  it('retourné : l’étape devient la rectification', () => {
    const e = etapesCircuitPv(pv({ statutPv: 'EN_RECTIFICATION' }), noms);
    expect(e[1]).toEqual({ libelle: 'Rectification', detail: 'Retourné au Membre', etat: 'encours' });
  });

  it('la phrase du pied nomme le viseur', () => {
    expect(phraseEtatPv(pv({}), 'RAKOTO Président')).toContain('Soumettre envoie le projet à RAKOTO Président pour visa');
    expect(phraseEtatPv(pv({ statutPv: 'SIGNE' }), 'x')).toBe('PV signé.');
  });
});
