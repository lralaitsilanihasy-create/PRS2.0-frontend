import { PRESENTATION_SOUS_TYPE_FICHE, SOUS_TYPES_FICHE_DAO, sousTypeDeLigne } from '.';

// ⚠️ 14/10 (constat du pilote) — le sous-type d'une ligne suit la règle du serveur (SousTypesDossier.dossierMiseEnConcurrence).
describe('sousTypeDeLigne — la règle du serveur, en repli tant que le sous-type n’est pas servi', () => {
  const l = (libelleMode: string | null, categorie: 'FOURNITURES_SERVICES' | 'TRAVAUX' | 'PRESTATIONS_INTELLECTUELLES' | null = 'TRAVAUX') => ({ libelleMode, categorie, sousType: null });

  it('mode de la ligne, puis catégorie', () => {
    expect(sousTypeDeLigne(l('Appel d’offres ouvert'))).toBe('DAOO');
    expect(sousTypeDeLigne(l('Appel d’offres restreint'))).toBe('DAOR');
    expect(sousTypeDeLigne(l('APPEL D’OFFRE OUVERT INTERNATIONAL'))).toBe('DAOOI');
    expect(sousTypeDeLigne(l('Appel d’offres restreint international'))).toBe('DAORI');
    expect(sousTypeDeLigne(l('APPEL D’OFFRE AVEC PRÉ-QUALIFICATION'))).toBe('DAOOPREQUAL');
    expect(sousTypeDeLigne(l('Appel d’offres ouvert', 'PRESTATIONS_INTELLECTUELLES'))).toBe('DC');
    expect(sousTypeDeLigne(l(null))).toBe('DAOO');
  });

  it('le sous-type servi par le serveur l’emporte', () => {
    expect(sousTypeDeLigne({ libelleMode: 'Appel d’offres ouvert', categorie: 'TRAVAUX', sousType: 'DAOR' })).toBe('DAOR');
  });

  it('chaque sous-type produit par une fiche a sa présentation', () => {
    for (const t of SOUS_TYPES_FICHE_DAO) expect(PRESENTATION_SOUS_TYPE_FICHE[t]?.titre).toBeTruthy();
    expect(PRESENTATION_SOUS_TYPE_FICHE['DAOOPREQUAL'].titre).toContain('pré-qualification');
    expect(PRESENTATION_SOUS_TYPE_FICHE['DC'].documents).toContain('DPIC');
  });
});
