import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ChampFiche, FicheMarche, ReferentielFiche } from '../../models';
import { ChampFicheMarcheService, FicheMarcheService } from '../../services/fiche-marche.services';
import { CelluleFicheCliquee, FicheDaoDoc } from './fiche-dao-doc';

/**
 * ⚠️ Lot B de l'examen (26/09, contrat V44) — la fiche DAO lue comme un document de l'examen : ses informations
 * sont des cellules, une par lot quand le champ varie par lot, et un clic émet l'ancrage (`idDmc`, `champFiche`)
 * que l'écran d'examen porte sur la ligne d'observation.
 */
const champ = (c: Partial<ChampFiche> & Pick<ChampFiche, 'code' | 'libelle' | 'source'>): ChampFiche => ({
  bloc: c.code.slice(0, 3),
  rubrique: c.code.slice(4, 6),
  rang: Number(c.code.slice(7)),
  type: 'TEXTE',
  documentMaitre: 'DPAO',
  reprises: [],
  typesMarche: ['QUANTITE_FIXE'],
  obligatoire: false,
  ...c,
});

const REFERENTIEL: ReferentielFiche = {
  blocs: [
    { code: 'B01', libelle: 'Autorité contractante', rang: 1, rubriques: [{ code: 'AC', libelle: 'Identité', rang: 1 }] },
    { code: 'B04', libelle: 'Consultation', rang: 4, rubriques: [{ code: 'VO', libelle: 'Validité des offres', rang: 1 }, { code: 'CD', libelle: 'Composition du dossier', rang: 2 }] },
    { code: 'B05', libelle: 'Garanties', rang: 5, rubriques: [{ code: 'GS', libelle: 'Garantie de soumission', rang: 1 }] },
  ],
  champs: [
    champ({ code: 'B01-AC-01', libelle: 'Autorité contractante', source: 'PPM', clePpm: 'ENTITE' }),
    champ({ code: 'B04-VO-01', libelle: 'Durée de validité des offres', source: 'SAISIE', type: 'NOMBRE' }),
    champ({ code: 'B04-CD-01', libelle: 'Fiches de renseignements exigées', source: 'SAISIE', type: 'LISTE_MULTIPLE', options: ['A1', 'A2', 'A3', 'A4'] }),
    champ({ code: 'B05-GS-01', libelle: 'Garantie de soumission exigée', source: 'CADRAGE', cleCadrage: 'garantieSoumission' }),
    champ({ code: 'B05-GS-03', libelle: 'Montant de la garantie', source: 'SAISIE', type: 'MONTANT', parLot: true, condition: 'garantieSoumission = OUI' }),
    champ({ code: 'B05-GS-04', libelle: 'Pièce de garantie', source: 'SAISIE', type: 'PIECE', condition: 'garantieSoumission = OUI' }),
  ],
};

const FICHE: FicheMarche = {
  idFiche: 14,
  idDmc: 14,
  idDetail: 303090,
  idDossier: 100348,
  refeDossier: '00006/PPM-AGPM/CNM/2026',
  designationMarche: 'Fourniture et livraison de matériels informatiques',
  typeMarche: 'QUANTITE_FIXE',
  categorie: 'FOURNITURES_SERVICES',
  statut: 'VALIDEE',
  version: 1,
  cadrage: { alloti: 'OUI', garantieSoumission: 'OUI' },
  valeurs: { 'B04-VO-01': 105, 'B04-CD-01': 'A1,A3', 'B05-GS-03#1': 1600000, 'B05-GS-03#2': 2170000 },
  valeursPpm: { 'B01-AC-01': 'MINISTERE DE LA SANTE PUBLIQUE' },
  valeursCadrage: { 'B05-GS-01': 'OUI' },
  enLettres: { 'B05-GS-03#2': 'deux millions cent soixante-dix mille ariary' },
  nbLots: 2,
  saisieParLot: true,
};

describe('FicheDaoDoc — la fiche DAO comme document de l’examen (lot B)', () => {
  let fixture: ComponentFixture<FicheDaoDoc>;
  let lire: ReturnType<typeof vi.fn>;
  let referentiel: ReturnType<typeof vi.fn>;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const lignes = (): HTMLTableRowElement[] => Array.from(racine().querySelectorAll<HTMLTableRowElement>('tr'));
  const ligne = (libelle: string): HTMLTableRowElement => {
    const l = lignes().find((tr) => tr.querySelector('th')?.textContent?.replace(/\s+/g, ' ').trim() === libelle);
    if (!l) throw new Error(`ligne introuvable : ${libelle} — présentes : ${lignes().map((tr) => tr.querySelector('th')?.textContent?.replace(/\s+/g, ' ').trim()).join(' | ')}`);
    return l;
  };

  beforeEach(async () => {
    lire = vi.fn().mockReturnValue(of(FICHE));
    referentiel = vi.fn().mockReturnValue(of(REFERENTIEL));
    await TestBed.configureTestingModule({
      imports: [FicheDaoDoc],
      providers: [
        { provide: FicheMarcheService, useValue: { lire } },
        { provide: ChampFicheMarcheService, useValue: { referentiel } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FicheDaoDoc);
    fixture.componentRef.setInput('idDmc', 14);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('charge la fiche puis le référentiel de sa forme et de sa catégorie, et se présente comme un document', () => {
    expect(lire).toHaveBeenCalledWith(14);
    expect(referentiel).toHaveBeenCalledWith('QUANTITE_FIXE', 'FOURNITURES_SERVICES');
    expect(racine().querySelector('.doc-titre')?.textContent).toContain('Fiche DAO — Fourniture et livraison de matériels informatiques');
    expect(racine().querySelector('.doc-sous-titre')?.textContent?.replace(/\s+/g, ' ')).toContain('version 1 · validée · 2 lots');
    // B01 (repris du plan) ne se saisit pas : il ne se lit pas ici non plus — comme l'écran de saisie.
    const titres = Array.from(racine().querySelectorAll('.doc-bloc-titre')).map((h) => h.textContent?.replace(/\s+/g, ' ').trim());
    expect(titres).toEqual(['B04 Consultation', 'B05 Garanties']);
  });

  it('montre chaque information en clair — une cellule par lot quand le champ varie par lot, jamais une pièce', () => {
    expect(ligne('Durée de validité des offres').querySelector('.doc-val')?.textContent).toBe('105');
    expect(ligne('Fiches de renseignements exigées').querySelector('.doc-val')?.textContent).toBe('A1, A3');
    expect(ligne('Garantie de soumission exigée').querySelector('.doc-val')?.textContent).toBe('Oui');
    // Un montant se lit comme le document l'imprime : groupé par milliers, avec ses lettres quand le serveur les sert.
    expect(ligne('Montant de la garantie lot 1').querySelector('.doc-val')?.textContent).toBe('1 600 000 Ariary');
    expect(ligne('Montant de la garantie lot 2').querySelector('.doc-val')?.textContent).toBe('2 170 000 Ariary (deux millions cent soixante-dix mille ariary)');
    expect(lignes().some((tr) => tr.textContent?.includes('Pièce de garantie'))).toBe(false);
  });

  it('« Observer cette information » : émet l’ancrage du contrat V44 (idDmc, champFiche avec le rang de lot), seulement si observable', () => {
    const emis: Omit<CelluleFicheCliquee, 'element'>[] = [];
    fixture.componentInstance.celluleClick.subscribe(({ idDmc, champFiche, lot, libelle, valeur }) => emis.push({ idDmc, champFiche, lot, libelle, valeur }));
    const cellule = (lib: string): HTMLElement => ligne(lib).querySelector<HTMLElement>('td.doc-cellule')!;

    cellule('Durée de validité des offres').click();
    expect(emis).toEqual([]);
    expect(racine().querySelector('.doc-cellule--observable')).toBeNull();

    fixture.componentRef.setInput('observable', true);
    fixture.detectChanges();
    expect(racine().querySelectorAll('.doc-cellule--observable').length).toBe(5);
    cellule('Durée de validité des offres').click();
    cellule('Montant de la garantie lot 2').click();
    expect(emis).toEqual([
      { idDmc: 14, champFiche: 'B04-VO-01', lot: null, libelle: 'Durée de validité des offres', valeur: '105' },
      { idDmc: 14, champFiche: 'B05-GS-03#2', lot: 2, libelle: 'Montant de la garantie', valeur: '2 170 000 Ariary (deux millions cent soixante-dix mille ariary)' },
    ]);
  });

  it('pose la pastille numérotée sur l’information observée, et la retire quand les annotations sont masquées', () => {
    expect(racine().querySelectorAll('.doc-cellule--observee').length).toBe(0);
    fixture.componentRef.setInput('observations', [{ champFiche: 'b05-gs-03#2', numero: 4 }, { champFiche: 'B04-VO-01', numero: 2 }]);
    fixture.detectChanges();

    const lot2 = ligne('Montant de la garantie lot 2').querySelector('td')!;
    expect(lot2.classList).toContain('doc-cellule--observee');
    expect(lot2.querySelector('.doc-pastille')?.textContent?.trim()).toBe('4');
    expect(lot2.querySelector('.doc-sr')?.textContent).toContain('4');
    expect(ligne('Montant de la garantie lot 1').querySelector('td')?.classList).not.toContain('doc-cellule--observee');
    expect(racine().querySelectorAll('.doc-cellule--observee').length).toBe(2);

    fixture.componentRef.setInput('annotations', false);
    fixture.detectChanges();
    expect(racine().querySelectorAll('.doc-cellule--observee').length).toBe(0);
    expect(racine().querySelectorAll('.doc-pastille').length).toBe(0);
  });

  it('dit que la fiche n’a pas pu être lue quand le serveur la refuse, sans laisser un document vide', async () => {
    lire.mockReturnValue(throwError(() => new Error('403')));
    fixture = TestBed.createComponent(FicheDaoDoc);
    fixture.componentRef.setInput('idDmc', 99);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(racine().querySelector('.doc-etat')?.textContent).toContain("La fiche DAO de ce dossier n'a pas pu être lue.");
    expect(racine().querySelector('table')).toBeNull();
  });
});
