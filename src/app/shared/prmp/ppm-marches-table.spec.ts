import { ChangeDetectionStrategy, Component, Type, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Marche, MarchePrevision, ServiceBeneficiaire } from '../../models';
import { CapmService, ModePassationService, NatureService, ReferenceLookupService, StatutMarcheService } from '../../services';
import { DocumentVisionneuse } from '../ui/document-visionneuse';
import { COLONNES_PPM_OFFICIEL, CelluleCliquee, LignePpmOfficielle, ObservationCellule, RowExamState, montantOfficiel } from './document-officiel';
import { PpmMarchesTable } from './ppm-marches-table';

/**
 * ⚠️ 2026-09-14 (décision des chefs, refonte ergonomique lot 1) — le plan de passation s'affiche au
 * format du PDF officiel : 13 colonnes, dans l'ordre et aux largeurs du PDF. Ce que l'application
 * ajoute (état d'examen, statut du marché, versionnement, observations) est une annotation, jamais
 * une colonne, et se masque d'un coup.
 */

/** Référentiels résolus sans HTTP : seuls les libellés utiles au test. */
const REFERENTIELS = new Map<Type<unknown>, Map<string, string>>([
  [NatureService, new Map([['1', 'Fournitures']])],
  [ModePassationService, new Map([['7', "Appel d'Offres Ouvert"]])],
  [
    CapmService,
    new Map([
      ['10', 'LANCEMENT'],
      ['11', 'OUVERTURE DES PLIS'],
      ['12', 'ATTRIBUTION'],
    ]),
  ],
  [StatutMarcheService, new Map([['PREVU', 'Prévu']])],
]);
/** Texte d'une cellule tel qu'il se lit, sans les césures conditionnelles (U+00AD) de l'affichage. */
const sansCesure = (el: Element | null): string => (el?.textContent ?? '').replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim();

const lookupStub = {
  appels: 0,
  lookup(service: unknown) {
    this.appels++;
    return of(REFERENTIELS.get(service as Type<unknown>) ?? new Map<string, string>());
  },
};

const MARCHES: Marche[] = [
  { idDetail: 1, idDossier: 9, idPpm: 3, idNature: 1, idMode: 7, designationMarche: 'Fourniture de matériels informatiques', montEstim: 1590000000, financement: 'RPI', statut: 'PREVU' },
  { idDetail: 2, idDossier: 9, idPpm: 3, idNature: 1, idMode: 7, designationMarche: 'Maintenance du système', montEstim: 380000000, financement: 'RPI', statut: 'PREVU' },
];
const BENEFS: ServiceBeneficiaire[] = [
  { idBenef: 1, idDetail: 1, soaCode: '00-21-0-J00', numCompte: '2441', ancMontBenef: 1590000000 },
  { idBenef: 2, idDetail: 2, soaCode: '00-21-0-J00', numCompte: '6211', ancMontBenef: 250000000 },
  { idBenef: 3, idDetail: 2, soaCode: '00-61-0-D10', numCompte: '6211', ancMontBenef: 130000000 },
];
const PREVISIONS: MarchePrevision[] = [
  { idPrevision: 1, idDetail: 1, idCapm: 10, dateDebut: '2026-10-05' },
  { idPrevision: 2, idDetail: 1, idCapm: 11, dateDebut: '2026-11-04' },
  { idPrevision: 3, idDetail: 1, idCapm: 12, dateDebut: '2026-11-25' },
];

@Component({
  selector: 'app-hote-ppm-test',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PpmMarchesTable, DocumentVisionneuse],
  template: `
    <app-document-visionneuse [interrupteur]="true" [(annotations)]="annotations">
      <app-ppm-marches-table
        [marches]="marches"
        [beneficiaires]="benefs"
        [previsions]="previsions"
        [rowStateFn]="etatFn"
        [observations]="observations()"
        [celluleObservableFn]="observableFn"
        (rowClick)="cliques.push($event.idDetail)"
        (celluleClick)="cellules.push($event)"
      />
    </app-document-visionneuse>
  `,
})
class HotePpmTest {
  readonly marches = MARCHES;
  readonly benefs = BENEFS;
  readonly previsions = PREVISIONS;
  readonly annotations = signal(true);
  readonly observations = signal<ObservationCellule[]>([]);
  readonly etats = new Map<number, RowExamState>([
    [1, 'done-ras'],
    [2, 'current'],
  ]);
  readonly etatFn = (idDetail: number): RowExamState | null => this.etats.get(idDetail) ?? null;
  readonly cliques: number[] = [];
  readonly observableFn = (idDetail: number): boolean => idDetail === 2;
  readonly cellules: CelluleCliquee[] = [];
}

describe('PpmMarchesTable — format du PDF officiel', () => {
  let fixture: ComponentFixture<PpmMarchesTable>;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const tous = (sel: string): HTMLElement[] => Array.from(racine().querySelectorAll<HTMLElement>(sel));
  /** Texte d'un en-tête, sans les césures conditionnelles (U+00AD) posées pour l'affichage. */
  const intitule = (th: Element): string => (th.textContent ?? '').replace(/\u00AD/g, '').trim();

  beforeEach(async () => {
    lookupStub.appels = 0;
    await TestBed.configureTestingModule({
      imports: [PpmMarchesTable],
      providers: [{ provide: ReferenceLookupService, useValue: lookupStub }],
    }).compileComponents();
    fixture = TestBed.createComponent(PpmMarchesTable);
    fixture.componentRef.setInput('marches', MARCHES);
    fixture.componentRef.setInput('beneficiaires', BENEFS);
    fixture.componentRef.setInput('previsions', PREVISIONS);
    fixture.detectChanges();
  });

  it('pose les 13 colonnes du PDF, dans son ordre et à ses largeurs', () => {
    expect(COLONNES_PPM_OFFICIEL.map((c) => c.largeur)).toEqual([6, 18, 8, 8, 8, 5, 8, 5, 8, 8, 6, 6, 6]);
    expect(COLONNES_PPM_OFFICIEL.reduce((s, c) => s + c.largeur, 0)).toBe(100);

    const cols = tous('colgroup col');
    expect(cols.length).toBe(13);
    expect(cols.map((c) => c.style.width)).toEqual(COLONNES_PPM_OFFICIEL.map((c) => `${c.largeur}%`));

    // Première rangée d'un marché : une cellule par colonne officielle, dans l'ordre du PDF.
    const premiereRangee = racine().querySelector('tbody tr') as HTMLElement;
    const champs = Array.from(premiereRangee.querySelectorAll('td')).map((td) => td.getAttribute('data-champ'));
    expect(champs).toEqual([
      'nature', 'objet', 'montEstim', 'nouvMontEstim', 'mode', 'financement',
      'soa', 'compte', 'montBenef', 'nouvMontBenef', 'lancement', 'ouverture', 'attribution',
    ]);
  });

  it("reprend les en-têtes du PDF sur deux rangées, sans colonne « STATUT DU MARCHÉ »", () => {
    const [rangee1, rangee2] = tous('thead tr');
    expect(Array.from(rangee1.querySelectorAll('th')).map(intitule)).toEqual([
      'NATURE', 'OBJET', 'MONTANT ESTIMATIF INITIAL', 'NOUVEAU MONTANT ESTIMATIF', 'MODE DE PASSATION', 'FINANCEMENT',
      'Informations sur le Bénéficiaire',
      'DATE PREVISIONNELLE DE LANCEMENT', 'DATE PREVISIONNELLE OUVERTURE DES PLIS', "DATE PREVISIONNELLE D'ATTRIBUTION",
    ]);
    expect(rangee1.querySelectorAll('th')[6].getAttribute('colspan')).toBe('4');
    expect(Array.from(rangee2.querySelectorAll('th')).map(intitule)).toEqual([
      'SERVICE BENEFICIAIRE', 'COMPTE', 'MONTANT ESTIMATIF PAR BENEFICIAIRE', 'NOUVEAU MONTANT ESTIMATIF PAR BENEFICIAIRE',
    ]);
    expect(tous('th').some((th) => /statut/i.test(th.textContent ?? ''))).toBe(false);
    // Intitulés écrits mot à mot, césures syllabiques posées : un mot ne se coupe qu'à une syllabe.
    const financement = rangee1.querySelectorAll('th')[5];
    expect(Array.from(financement.querySelectorAll('.doc-mot')).map((m) => m.textContent)).toEqual(['FI\u00ADNAN\u00ADCE\u00ADMENT']);
    expect(rangee2.querySelectorAll('th')[1].textContent).toBe('COMP\u00ADTE');
  });

  it('met en forme les valeurs comme le PDF : libellés résolus, montants à séparateur sécable, dates dd/MM/yyyy', () => {
    const cellule = (champ: string) => sansCesure(racine().querySelector(`tbody tr td[data-champ="${champ}"]`));
    expect(cellule('nature')).toBe('Fournitures');
    // Nature et mode : un mot par boîte, césures conditionnelles posées dans les mots longs.
    expect(racine().querySelector('td[data-champ="nature"] .doc-mot')?.textContent).toBe('Four\u00ADni\u00ADtures');
    expect(Array.from(racine().querySelectorAll('tbody tr:first-child td[data-champ="mode"] .doc-mot')).map((m) => m.textContent)).toEqual(['Ap\u00ADpel', "d'Offres", 'Ou\u00ADvert']);
    // Montants : texte seul, coupé entre groupes de chiffres (espace sécable), jamais en boîtes.
    expect(racine().querySelector('td[data-champ="montEstim"] .doc-mot')).toBeNull();
    expect(cellule('mode')).toBe("Appel d'Offres Ouvert");
    expect(cellule('montEstim')).toBe('1 590 000 000,00');
    expect(cellule('lancement')).toBe('05/10/2026');
    expect(cellule('ouverture')).toBe('04/11/2026');
    // Deux bénéficiaires : les colonnes du marché couvrent les deux rangées.
    const rangeesMarche2 = tous('tbody tr').slice(1);
    expect(rangeesMarche2.length).toBe(2);
    expect(rangeesMarche2[0].querySelector('td[data-champ="objet"]')?.getAttribute('rowspan')).toBe('2');
    expect(rangeesMarche2[1].querySelectorAll('td').length).toBe(4);
  });

  it('pose le statut du marché en annotation dans la marge droite, pas dans la grille', () => {
    const statuts = tous('.doc-statut');
    expect(statuts.length).toBe(2);
    expect(statuts[0].textContent).toContain('Prévu');
    // Rangé dans la dernière cellule officielle, dont la gouttière droite est réservée.
    expect(statuts[0].closest('td')?.getAttribute('data-champ')).toBe('attribution');
    expect(statuts[0].classList).toContain('doc-annot');
    expect(racine().querySelector('.doc-ppm')?.classList).toContain('doc-gouttiere-d');
  });

  it('formate un montant avec des espaces sécables, jamais insécables', () => {
    expect(montantOfficiel(8000000000)).toBe('8 000 000 000,00');
    // Ni espace insécable (U+00A0) ni espace fine insécable (U+202F, celle d'Intl fr-FR).
    expect(montantOfficiel(8000000000)).not.toMatch(/[\u00A0\u202F]/);
    expect(montantOfficiel(null)).toBe('');
    expect(montantOfficiel(-1234.5)).toBe('-1 234,50');
  });

  it("affiche des lignes déjà mises en forme (aperçu) sans charger aucun référentiel", async () => {
    TestBed.resetTestingModule();
    lookupStub.appels = 0;
    await TestBed.configureTestingModule({
      imports: [PpmMarchesTable],
      providers: [{ provide: ReferenceLookupService, useValue: lookupStub }],
    }).compileComponents();
    const f = TestBed.createComponent(PpmMarchesTable);
    const lignes: LignePpmOfficielle[] = [
      { idDetail: 1, nature: 'Travaux', objet: 'Réhabilitation', montEstim: 210000000, mode: 'AOO', financement: 'PIP', beneficiaires: [], dateLancement: '19/10/2026', dateOuverture: '', dateAttribution: '' },
    ];
    f.componentRef.setInput('lignes', lignes);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(lookupStub.appels).toBe(0);
    expect(sansCesure(el.querySelector('td[data-champ="nature"]'))).toBe('Travaux');
    // Aucun bénéficiaire : une rangée vide garde les 13 cellules.
    expect(el.querySelectorAll('tbody tr td').length).toBe(13);
  });
});

describe('PpmMarchesTable — annotations', () => {
  let fixture: ComponentFixture<HotePpmTest>;
  let hote: HotePpmTest;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HotePpmTest],
      providers: [{ provide: ReferenceLookupService, useValue: lookupStub }],
    }).compileComponents();
    fixture = TestBed.createComponent(HotePpmTest);
    hote = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("rend l'état d'examen en marqueur de marge (forme CSS, libellé accessible), sans colonne", () => {
    expect(racine().querySelectorAll('colgroup col').length).toBe(13);
    const [ras, cours] = Array.from(racine().querySelectorAll<HTMLElement>('.doc-marqueur'));
    expect(ras.classList).toContain('doc-marqueur--ras');
    expect(ras.getAttribute('role')).toBe('img');
    expect(ras.getAttribute('aria-label')).toBe('Examinée — sans observation');
    expect(ras.getAttribute('title')).toBe('Examinée — sans observation');
    // Plus de glyphe ✓ ✗ ● • – : la forme est dessinée en CSS.
    expect(ras.textContent?.trim()).toBe('');
    expect(ras.closest('td')?.getAttribute('data-champ')).toBe('nature');
    expect(cours.classList).toContain('doc-marqueur--cours');
    expect(cours.closest('tr')?.classList).toContain('doc-ligne--courante');
    expect(racine().querySelector('.doc-ppm')?.classList).toContain('doc-gouttiere-g');
  });

  it("encadre la cellule observée et y pose la pastille numérotée", () => {
    hote.observations.set([{ idDetail: 1, champ: 'montEstim', numero: 2 }]);
    fixture.detectChanges();
    const cellule = racine().querySelector('tbody tr td[data-champ="montEstim"]') as HTMLElement;
    expect(cellule.classList).toContain('doc-cellule--observee');
    expect(cellule.querySelector('.doc-pastille')?.textContent?.trim()).toBe('2');
    expect(cellule.querySelector('.doc-pastilles')?.getAttribute('aria-label')).toBe('Observation n° 2');
    // Les autres cellules restent intactes.
    expect(racine().querySelectorAll('.doc-cellule--observee').length).toBe(1);
  });

  it("n'encadre que le bénéficiaire visé d'une colonne par bénéficiaire (idBenefCible)", () => {
    hote.observations.set([{ idDetail: 2, champ: 'compte', numero: 3, idBenef: 3 }]);
    fixture.detectChanges();
    const [rangee1, rangee2] = Array.from(racine().querySelectorAll<HTMLElement>('tbody tr')).slice(1, 3);
    const compte1 = rangee1.querySelector('td[data-champ="compte"]') as HTMLElement;
    const compte2 = rangee2.querySelector('td[data-champ="compte"]') as HTMLElement;
    expect(compte1.classList).not.toContain('doc-cellule--observee');
    expect(compte2.classList).toContain('doc-cellule--observee');
    expect(compte2.querySelector('.doc-pastille')?.textContent?.trim()).toBe('3');

    // Sans bénéficiaire visé : toutes les rangées de la ligne, une seule pastille (première rangée).
    hote.observations.set([{ idDetail: 2, champ: 'compte', numero: 4 }]);
    fixture.detectChanges();
    expect(compte1.classList).toContain('doc-cellule--observee');
    expect(compte2.classList).toContain('doc-cellule--observee');
    expect(racine().querySelectorAll('.doc-pastille').length).toBe(1);
  });

  it('« Observer cette cellule » : seules les lignes désignées sont observables, le clic émet code, bénéficiaire et valeur affichée', () => {
    const rangees = Array.from(racine().querySelectorAll<HTMLElement>('tbody tr'));
    expect(rangees[0].querySelector('td.doc-cellule--observable')).toBeNull();
    expect(rangees[1].querySelectorAll('td.doc-cellule--observable').length).toBe(13);

    (rangees[2].querySelector('td[data-champ="montBenef"]') as HTMLElement).click();
    (rangees[1].querySelector('td[data-champ="mode"]') as HTMLElement).click();
    expect(hote.cellules.map(({ idDetail, champ, idBenef, valeur }) => ({ idDetail, champ, idBenef, valeur }))).toEqual([
      { idDetail: 2, champ: 'montBenef', idBenef: 3, valeur: '130 000 000,00' },
      { idDetail: 2, champ: 'mode', idBenef: null, valeur: "Appel d'Offres Ouvert" },
    ]);
    expect(hote.cellules[1].element.getAttribute('data-champ')).toBe('mode');
    // Le clic de ligne suit, inchangé.
    expect(hote.cliques).toEqual([2, 2]);
  });

  it("l'interrupteur « Annotations » masque tout : marqueurs, statuts, pastilles, surlignage et gouttières", () => {
    hote.observations.set([{ idDetail: 2, champ: 'objet', numero: 1 }]);
    fixture.detectChanges();
    const bouton = racine().querySelector('button.doc-interrupteur') as HTMLButtonElement;
    expect(bouton.getAttribute('aria-pressed')).toBe('true');
    expect(racine().querySelectorAll('.doc-annot').length).toBeGreaterThan(0);

    bouton.click();
    fixture.detectChanges();

    expect(hote.annotations()).toBe(false);
    expect(bouton.getAttribute('aria-pressed')).toBe('false');
    expect(racine().querySelectorAll('.doc-annot').length).toBe(0);
    expect(racine().querySelectorAll('.doc-cellule--observee, .doc-ligne--courante').length).toBe(0);
    const doc = racine().querySelector('.doc-ppm') as HTMLElement;
    expect(doc.classList).toContain('doc-annotations-masquees');
    expect(doc.classList).not.toContain('doc-gouttiere-g');
    expect(doc.classList).not.toContain('doc-gouttiere-d');
    expect(racine().querySelector('.doc-feuille')?.classList).toContain('doc-annotations-masquees');
    // Le document, lui, est intact : mêmes 13 colonnes, mêmes valeurs.
    expect(racine().querySelectorAll('colgroup col').length).toBe(13);
    expect(sansCesure(racine().querySelector('td[data-champ="objet"]'))).toBe('Fourniture de matériels informatiques');
  });

  it('garde le clic de ligne, sauf hors examen', () => {
    const rangees = Array.from(racine().querySelectorAll<HTMLElement>('tbody tr'));
    rangees[1].click();
    expect(hote.cliques).toEqual([2]);
    hote.etats.set(1, 'hors');
    fixture.componentInstance.observations.set([]); // relance la détection
    fixture.detectChanges();
    rangees[0].click();
    expect(hote.cliques).toEqual([2]);
  });
});

@Component({
  selector: 'app-hote-ppm-actions-test',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PpmMarchesTable],
  template: `
    <app-ppm-marches-table [marches]="marches" [beneficiaires]="benefs">
      <ng-template #rowActions let-m><button type="button" class="action">Modifier {{ m.idDetail }}</button></ng-template>
    </app-ppm-marches-table>
  `,
})
class HotePpmActionsTest {
  readonly marches = MARCHES;
  readonly benefs = BENEFS;
}

describe("PpmMarchesTable — colonne d'outils des écrans d'édition", () => {
  it('ajoute les actions HORS document et y range le statut, sans toucher aux 13 colonnes', async () => {
    await TestBed.configureTestingModule({
      imports: [HotePpmActionsTest],
      providers: [{ provide: ReferenceLookupService, useValue: lookupStub }],
    }).compileComponents();
    const fixture = TestBed.createComponent(HotePpmActionsTest);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const outils = el.querySelectorAll('td.doc-hors-feuille');
    expect(outils.length).toBe(2);
    expect(outils[0].querySelector('.action')?.textContent?.trim()).toBe('Modifier 1');
    expect(outils[0].querySelector('.doc-statut')?.textContent).toContain('Prévu');
    expect(el.querySelector('th.doc-hors-feuille')?.textContent?.trim()).toBe('ACTIONS');
    expect(el.querySelectorAll('tbody tr:first-child td[data-champ]').length).toBe(13);
    // Le statut n'occupe pas la marge droite : la colonne d'outils la remplace.
    expect(el.querySelector('.doc-ppm')?.classList).not.toContain('doc-gouttiere-d');
  });
});
