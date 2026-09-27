import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Dossier, FicheMarche, ObservationPv, PieceJointeDossier, VersionFiche } from '../../models';
import { DossierService, ObservationPvService, PieceJointeDossierService, TypePieceJointeService } from '../../services';
import { FicheMarcheService } from '../../services/fiche-marche.services';
import { RectifierDossierDao } from './rectifier-dossier-dao';

/**
 * ⚠️ Lot C1 (26/09) — « Rectifier un dossier DAO » : la correction est une révision validée de la fiche. L'écran
 * reconnaît la version examinée (servie par `versionSoumise`, sinon par les documents que le dossier porte), mène à
 * l'information visée, montre ce qui a changé, et ne resoumet qu'une révision validée.
 */
const fiche = (p: Partial<FicheMarche>): FicheMarche => ({
  idDmc: 16, idDetail: 303092, idDossier: 100352, designationMarche: 'Fourniture et livraison des matériels informatiques',
  typeMarche: 'A_COMMANDE', statut: 'VALIDEE', version: 1, cadrage: {}, valeurs: { 'B04-VO-01': 75, 'B05-GS-03#2': 2170000 }, valeursPpm: {},
  ...p,
});
const DOSSIER = { idDossier: 100353, refeDossier: '00001/DAO/CNM/2026', statut: 'EN_ATTENTE_DECISION_PRMP', idDmc: 16, idTypeDossier: 'DMC', ficheMarche: { idDmc: 16, idDetail: 303092, typeMarche: 'A_COMMANDE', statut: 'VALIDEE', version: 2 } } as unknown as Dossier;
const OBS: ObservationPv[] = [
  { idObservationPv: 1, idDossier: 100353, idPv: 41, source: 'POINT', statut: 'EMISE', libelle: 'Garantie de soumission : au lieu de « 2 170 000 Ariary », lire « 2 000 000 Ariary »', idDmc: 16, champFiche: 'B05-GS-03#2', libelleChampFiche: 'Montant de la garantie de soumission (Ariary)', valeurChampFiche: '2 170 000 Ariary', lot: 2 },
  { idObservationPv: 2, idDossier: 100353, idPv: 41, source: 'PIECE', statut: 'LEVEE', libelle: 'Pièce « Avis » : signature manquante' },
];
const PIECES: PieceJointeDossier[] = [
  { idPiece: 500, idDossier: 100353, idTypePiece: 90, nomFichier: 'DPAO.pdf', idDocumentFiche: 478 },
  { idPiece: 501, idDossier: 100353, idTypePiece: 7, nomFichier: 'piece-7.pdf', dateUpload: '2026-09-26' },
];
const VERSIONS: VersionFiche[] = [
  { idFiche: 30, version: 1, statut: 'VALIDEE', typeMarche: 'A_COMMANDE', dateValidation: '2026-09-26T18:43:38' },
  { idFiche: 31, version: 2, statut: 'VALIDEE', typeMarche: 'A_COMMANDE', dateValidation: '2026-09-26T19:48:47' },
] as VersionFiche[];

describe('RectifierDossierDao — la révision de la fiche corrige un dossier DAO', () => {
  let fixture: ComponentFixture<RectifierDossierDao>;
  let lire: ReturnType<typeof vi.fn>;
  let versions: ReturnType<typeof vi.fn>;
  let documents: ReturnType<typeof vi.fn>;
  let version: ReturnType<typeof vi.fn>;
  let reviser: ReturnType<typeof vi.fn>;
  let resoumettre: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (sel: string): string => (racine().querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  /** La section d'une étape, reconnue par son numéro (les cartes ne sont pas les seuls `div` de la page). */
  const etape = (n: string): HTMLElement => Array.from(racine().querySelectorAll<HTMLElement>('.rd-form')).find((d) => d.querySelector('.rd-step')?.textContent?.trim() === n)!;
  const etape2 = (): string => (etape('2').textContent ?? '').replace(/\s+/g, ' ').trim();
  const bouton = (nom: RegExp): HTMLButtonElement => Array.from(racine().querySelectorAll<HTMLButtonElement>('button')).find((b) => nom.test(b.textContent ?? ''))!;

  const monter = async (f: FicheMarche | null, vs: VersionFiche[] = VERSIONS) => {
    lire = vi.fn().mockReturnValue(of(f));
    versions = vi.fn().mockReturnValue(of(vs));
    // Les documents de la version 1 sont ceux que le dossier porte (478) ; la version 2 en a produit d'autres.
    documents = vi.fn().mockImplementation((_id: number, n?: number) => of(n === 1 ? [{ idDocument: 478 }, { idDocument: 479 }] : [{ idDocument: 531 }]));
    version = vi.fn().mockReturnValue(of(fiche({ version: 1, valeurs: { 'B04-VO-01': 75, 'B05-GS-03#2': 2170000 } })));
    reviser = vi.fn().mockReturnValue(of(fiche({ statut: 'BROUILLON', version: 3 })));
    resoumettre = vi.fn().mockReturnValue(of(DOSSIER));
    await TestBed.configureTestingModule({
      imports: [RectifierDossierDao],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['idDossier', '100353']]) } } },
        { provide: AuthService, useValue: { role: () => 'PRMP' } },
        // Le chronométrage (enfant) tolère l'erreur : il se tait, l'écran ne dépend pas de lui.
        { provide: DossierService, useValue: { getById: () => of(DOSSIER), resoumettre, chronometrage: () => throwError(() => new Error('hors test')) } },
        { provide: ObservationPvService, useValue: { parDossier: () => of(OBS) } },
        { provide: PieceJointeDossierService, useValue: { getByDossier: () => of(PIECES), upload: vi.fn() } },
        { provide: TypePieceJointeService, useValue: { getByTypeDossier: () => of([{ idTypePiece: 7, libellePiece: 'Cahier des clauses administratives générales', obligatoire: true }]) } },
        { provide: FicheMarcheService, useValue: { lire, versions, documents, version, reviser } },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as unknown as ReturnType<typeof vi.fn>;
    fixture = TestBed.createComponent(RectifierDossierDao);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it("reconnaît la version examinée par les documents que le dossier porte, et ferme la resoumission tant qu'elle n'est pas révisée", async () => {
    // Le résumé du dossier dit v2, mais les pièces produites viennent de la v1 : c'est la v1 qui a été examinée.
    await monter(fiche({ version: 1 }));
    expect(fixture.componentInstance.versionSoumise()).toBe(1);
    expect(fixture.componentInstance.etatRevision()).toBe('a-ouvrir');
    expect(etape2()).toContain('La version 1 de la fiche est celle que la Commission a examinée');
    expect(bouton(/resoumettre/).disabled).toBe(true);
    expect(texte('.rd-garde')).toContain("s'ouvrira quand la révision de la fiche sera validée");
    // Étape 1 : deux cartes, mais un seul « Corriger dans la fiche » — l'observation de pièce (levée, sans ancrage) n'en a pas.
    expect(racine().querySelectorAll('app-observation-pv-card').length).toBe(2);
    const liens = racine().querySelectorAll<HTMLAnchorElement>('.rd-corriger');
    expect(liens.length).toBe(1);
    expect(liens[0].getAttribute('href')).toBe('/prmp/dao/16?champ=B05-GS-03%232&reviser=1');
    // Étape 3 : seule la pièce déposée à part est à remplacer, jamais une pièce produite par la fiche.
    expect(fixture.componentInstance.piecesDeposees().map((p) => p.idPiece)).toEqual([501]);
    expect(etape('3').textContent).toContain('Cahier des clauses administratives générales');
  });

  it("« Ouvrir la révision » ouvre la version suivante puis mène à la fiche", async () => {
    await monter(fiche({ version: 1 }));
    bouton(/Ouvrir la révision/).click();
    expect(reviser).toHaveBeenCalledWith(16);
    expect(navigate).toHaveBeenCalledWith(['/prmp/dao', 16]);
  });

  it('une révision en cours (brouillon) se reprend, sans resoumission possible', async () => {
    await monter(fiche({ statut: 'BROUILLON', version: 2 }));
    expect(fixture.componentInstance.etatRevision()).toBe('en-cours');
    expect(etape2()).toContain('Révision version 2 en cours');
    expect(etape('2').querySelector<HTMLAnchorElement>('a')?.getAttribute('href')).toBe('/prmp/dao/16');
    expect(bouton(/resoumettre/).disabled).toBe(true);
  });

  it('une révision validée montre ce qui a changé et ouvre « Décrire et resoumettre »', async () => {
    await monter(fiche({ version: 2, valeurs: { 'B04-VO-01': 75, 'B05-GS-03#2': 2000000 }, dateValidation: '2026-09-26T19:48:47' }));
    expect(fixture.componentInstance.etatRevision()).toBe('validee');
    expect(version).toHaveBeenCalledWith(16, 1);
    expect(etape2()).toContain('Révision version 2 validée');
    expect(etape2()).toContain('remplace la version 1 examinée');
    expect(fixture.componentInstance.changees()).toEqual([{ cle: 'B05-GS-03#2', avant: '2170000', apres: '2000000' }]);
    expect(Array.from(racine().querySelectorAll('.rd-diff__t tbody td')).map((td) => td.textContent?.trim())).toEqual(['B05-GS-03#2', '2170000', '2000000']);

    const motif = racine().querySelector<HTMLTextAreaElement>('textarea')!;
    expect(bouton(/resoumettre/).disabled).toBe(true); // sans motif
    motif.value = 'Garantie de soumission du lot 2 ramenée à 2 % du maximum.';
    motif.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(bouton(/resoumettre/).disabled).toBe(false);
    bouton(/resoumettre/).click();
    expect(resoumettre).toHaveBeenCalledWith(100353, { motifRectification: 'Garantie de soumission du lot 2 ramenée à 2 % du maximum.' });
    expect(navigate).toHaveBeenCalledWith(['/prmp/a-rectifier']);
  });

  it("prend `versionSoumise` du serveur quand il la sert (B1), avant tout repli", async () => {
    const d = { ...DOSSIER, ficheMarche: { ...DOSSIER.ficheMarche, versionSoumise: 2 } } as unknown as Dossier;
    await monter(fiche({ version: 2 }));
    fixture.componentInstance.dossier.set(d);
    expect(fixture.componentInstance.versionSoumise()).toBe(2);
    expect(fixture.componentInstance.etatRevision()).toBe('a-ouvrir');
  });
});
