import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import {
  Chronometrage,
  Dispatch,
  Dossier,
  ExamenDetail,
  Marche,
  PieceJointeDossier,
  PointsCtrl,
  PvExamen,
  Reception,
  ServiceBeneficiaire,
} from '../../models';
import {
  AvisService,
  CapmService,
  DelaiStandardService,
  DispatchService,
  DossierService,
  EntiteContractService,
  ExamenDetailService,
  ExamenPieceService,
  ExamenService,
  MarchePrevisionService,
  MarcheService,
  MiseAJourPpmService,
  ModePassationService,
  NatureService,
  PieceJointeDossierService,
  PointsCtrlService,
  PpmService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
  ServiceBeneficiaireService,
} from '../../services';
import { ExamenDossier } from './examen-dossier';

/**
 * Écran d'examen refondu (refonte ergonomique, lot 2) : parcours en six étapes, raison d'une
 * validation impossible, « Observer cette cellule » (cible V30 envoyée), synthèse et « Modifier ».
 * Les services sont simulés : l'écran ne fait que les appeler.
 */
const DOSSIER: Dossier = { idDossier: 42, idTypeDossier: 'DDP', idSousType: 'PPM', statut: 'DISPATCHE', refeDossier: '00012/MEF/PPM/2026', idEntiteContract: 1 };
const MARCHES: Marche[] = [
  { idDetail: 1, idDossier: 42, idPpm: 3, idNature: 1, idMode: 7, designationMarche: 'Matériels informatiques', montEstim: 420000000, financement: 'RPI' },
  { idDetail: 2, idDossier: 42, idPpm: 3, idNature: 1, idMode: 8, designationMarche: 'Frais de colloque', montEstim: 85000000, financement: 'RPI' },
  { idDetail: 3, idDossier: 42, idPpm: 3, idNature: 1, idMode: 7, designationMarche: 'Gardiennage', montEstim: 96000000, financement: 'RPI' },
];
const BENEFS: ServiceBeneficiaire[] = [{ idBenef: 31, idDetail: 2, soaCode: '00-21-0-J00', numCompte: '2441', ancMontBenef: 85000000 }];
const POINTS: PointsCtrl[] = [
  { idPointCtrl: 11, libelPointCtrl: 'Mode de passation conforme aux seuils', ordrePointCtrl: 1, obligatoire: true, idTypeDossier: 'DDP', portee: 'LIGNE' },
  { idPointCtrl: 12, libelPointCtrl: 'Dates prévisionnelles dans l’ordre', ordrePointCtrl: 2, obligatoire: true, idTypeDossier: 'DDP', portee: 'LIGNE' },
  { idPointCtrl: 21, libelPointCtrl: 'Absence de fractionnement', ordrePointCtrl: 3, obligatoire: false, idTypeDossier: 'DDP', portee: 'DOSSIER' },
];
const PIECES: PieceJointeDossier[] = [
  { idPiece: 100, idDossier: 42, idTypePiece: 1, libellePiece: 'Plan signé', format: 'PDF' },
  { idPiece: 101, idDossier: 42, idTypePiece: 2, libellePiece: 'Avis général de passation', format: 'PDF' },
];
const RECEPTIONS: Reception[] = [{ idReception: 7, idDossier: 42, numPassage: 1, typePassage: 'INITIAL' } as Reception];
const DISPATCHS: Dispatch[] = [{ idDispatch: 9, idReception: 7, instructions: 'Vérifier les modes des lignes 2 à 3', interimDispatch: false }];
const CHRONO: Chronometrage = {
  idDossier: 42,
  etapes: [{ etape: 'EXAMEN', occurrence: 1, entree: '2026-09-14T09:00:00', fin: null, dureeHeuresOuvrees: 6, enCours: true }],
  dureeBruteHeuresOuvrees: 6,
  dureeNetteHeuresOuvrees: 6,
  attentePrmpHeuresOuvrees: 0,
  etapeCourante: 'EXAMEN',
  attentePrmp: false,
};
const LIBELLES = new Map<Type<unknown>, Map<string, string>>([
  [NatureService, new Map([['1', 'Services']])],
  [ModePassationService, new Map([['7', "Appel d'Offres Ouvert"], ['8', 'Gré à gré']])],
  [EntiteContractService, new Map([['1', "Ministère de l'Économie et des Finances"]])],
]);

describe('ExamenDossier — écran refondu (lot 2)', () => {
  let fixture: ComponentFixture<ExamenDossier>;
  let ecran: ExamenDossier;
  let creations: ExamenDetail[];
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (sel: string): string => (racine().querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rendre = (): void => fixture.detectChanges();

  beforeEach(async () => {
    creations = [];
    const liste = <T>(rows: T[]) => ({ list: () => of(rows) });
    TestBed.configureTestingModule({
      imports: [ExamenDossier],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ idDossier: '42' }) } } },
        { provide: AuthService, useValue: { ref: () => 'IM1' } },
        { provide: ToastService, useValue: { info: vi.fn(), success: vi.fn(), error: vi.fn() } },
        { provide: ReferenceLookupService, useValue: { lookup: (s: Type<unknown>) => of(LIBELLES.get(s) ?? new Map<string, string>()) } },
        { provide: DossierService, useValue: { getById: () => of(DOSSIER), chronometrage: () => of(CHRONO) } },
        { provide: DelaiStandardService, useValue: { listeSilencieuse: () => of([{ etape: 'EXAMEN', delaiHeures: 16 }]) } },
        { provide: PieceJointeDossierService, useValue: { getByDossier: () => of(PIECES), telecharger: () => NEVER } },
        { provide: ExamenPieceService, useValue: { ...liste([]), create: () => of({}), update: () => of({}) } },
        { provide: PpmService, useValue: liste([{ idPpm: 3, idDossier: 42, exercice: 2026, signataire: 'H. Rakoto', dateSignature: '2026-09-02', reference: 'PPM-3' }]) },
        { provide: MarcheService, useValue: liste(MARCHES) },
        { provide: ReceptionService, useValue: liste(RECEPTIONS) },
        { provide: DispatchService, useValue: liste(DISPATCHS) },
        { provide: PointsCtrlService, useValue: { grille: () => of(POINTS), list: () => of(POINTS) } },
        { provide: ExamenService, useValue: { ...liste([]), create: () => of({}), soumettre: () => of({ idPv: 5, idExamen: 1 }) } },
        {
          provide: ExamenDetailService,
          useValue: { ...liste([]), create: (d: ExamenDetail) => (creations.push(d), of(d)), update: (_: number, d: ExamenDetail) => of(d) },
        },
        { provide: PvExamenService, useValue: { ...liste([] as PvExamen[]), update: () => of({}) } },
        { provide: MiseAJourPpmService, useValue: { perimetreExamen: () => of(null), diff: () => NEVER } },
        { provide: ServiceBeneficiaireService, useValue: liste(BENEFS) },
        { provide: MarchePrevisionService, useValue: liste([]) },
        { provide: AvisService, useValue: liste([{ idAvis: 'FAV', libelleAvis: 'Favorable' }, { idAvis: 'FAVR', libelleAvis: 'Favorable avec réserves' }]) },
        { provide: ModePassationService, useValue: liste([]) },
        { provide: CapmService, useValue: liste([]) },
      ],
    });
    fixture = TestBed.createComponent(ExamenDossier);
    ecran = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    rendre();
    await fixture.whenStable();
    rendre();
  });

  const etapeParcours = (libelle: string): HTMLElement =>
    Array.from(racine().querySelectorAll<HTMLElement>('.pc')).find((e) => e.textContent?.includes(libelle)) as HTMLElement;
  const valider = (): void => {
    (racine().querySelector('.grille__valider') as HTMLButtonElement).click();
    rendre();
  };
  const choisirObservation = (idPt: number): void => {
    const radio = racine().querySelector<HTMLInputElement>(`input[name="st-${idPt}"]:not(:checked)`) as HTMLInputElement;
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    rendre();
  };
  const choisirPiece = (idPiece: number, option: 0 | 1): void => {
    const radio = racine().querySelectorAll<HTMLInputElement>(`input[name="piece-${idPiece}"]`)[option];
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    rendre();
  };
  const saisir = (id: string, valeur: string): void => {
    const champ = racine().querySelector<HTMLTextAreaElement>('#' + id) as HTMLTextAreaElement;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
    rendre();
  };

  it("compose l'en-tête compact : référence, entité, consigne du dispatch et délai tiré du chronométrage", () => {
    expect(texte('.tete__h1')).toBe('Examen 00012/MEF/PPM/2026');
    expect(texte('.tete__ent')).toContain("Ministère de l'Économie et des Finances · 3 lignes");
    expect(texte('.consigne')).toContain('Consigne : « Vérifier les modes des lignes 2 à 3 »');
    expect(texte('.delai')).toMatch(/^Reste 10 h · avant mer\.? 16\/09, 09:00$/);
  });

  it('parcours : états et compteurs des six étapes, « sans objet » non cliquable', () => {
    expect(texte('app-examen-parcours')).toContain('Fiche de présentation');
    const fiche = etapeParcours('Fiche de présentation');
    expect(fiche.tagName).toBe('DIV');
    expect(fiche.textContent).toContain('Sans objet pour ce dossier');
    expect(etapeParcours("Projet d'AGPM").textContent).toContain('Sans objet pour ce plan');
    const lignes = etapeParcours('Lignes du plan');
    expect(lignes.tagName).toBe('BUTTON');
    expect(lignes.getAttribute('aria-current')).toBe('step');
    expect(lignes.textContent).toContain('0 sur 3');
    expect(etapeParcours('Pièces jointes').textContent).toContain('0 sur 2');
    expect(etapeParcours('Contrôles du dossier').textContent).toContain('À faire');

    valider(); // ligne 1 : RAS par défaut
    choisirObservation(11); // ligne 2 : une correction sur le point 1
    saisir('obs-lire-11-0', 'Consultation de prix ouverte');
    valider();

    expect(etapeParcours('Lignes du plan').textContent).toContain('2 sur 3 · 1 observation');
    expect(ecran.derniereSauvegarde()).not.toBeNull(); // brouillon réellement enregistré à la validation
    expect(texte('.grille__enregistre')).toMatch(/^Enregistré à \d\d:\d\d$/);
    // Ligne 2 dans la marge du plan : avec observation ; ligne 3 : en cours.
    expect(ecran.etatLigneFn(2)).toBe('done-obs');
    expect(ecran.etatLigneFn(3)).toBe('current');
  });

  it('dit pourquoi la validation est impossible, et désactive le bouton', () => {
    expect(texte('.grille__raison')).toBe('');
    choisirObservation(11);
    expect(texte('.grille__raison')).toBe("Complétez l'observation du point 1 (« Au lieu de » ou « Lire ») pour valider la ligne 1.");
    expect((racine().querySelector('.grille__valider') as HTMLButtonElement).disabled).toBe(true);

    saisir('obs-aulieude-11-0', 'Gré à gré');
    expect(texte('.grille__raison')).toBe('');

    // Point non statué (grille enrichie après coup) : on nomme le point à renseigner.
    ecran['resultats'].update((m) => {
      const n = new Map(m);
      n.delete('1:12');
      return n;
    });
    rendre();
    expect(texte('.grille__raison')).toBe('Renseignez le point 2 pour valider la ligne 1.');
    expect(texte('.grille__valider')).toBe('Valider la ligne 1 et passer à la 2');
  });

  it("« Observer cette cellule » pré-remplit « Au lieu de », encadre la cellule et envoie la cible", () => {
    const mode = racine().querySelector('tbody tr td[data-champ="mode"]') as HTMLElement;
    expect(mode.classList).toContain('doc-cellule--observable');
    mode.click();
    rendre();
    const proposition = racine().querySelector('.prop') as HTMLElement;
    expect(proposition.getAttribute('role')).toBe('dialog');
    expect(proposition.textContent).toContain('Observer « MODE DE PASSATION »');
    expect(proposition.textContent).toContain("Au lieu de : « Appel d'Offres Ouvert »");
    (proposition.querySelector('.prop__point') as HTMLButtonElement).click();
    rendre();

    expect(racine().querySelector('.prop')).toBeNull();
    expect((racine().querySelector('#obs-aulieude-11-0') as HTMLTextAreaElement).value).toBe("Appel d'Offres Ouvert");
    expect(texte('.obs__titre')).toBe('Cellule « MODE DE PASSATION »');
    const encadree = racine().querySelector('tbody tr td[data-champ="mode"]') as HTMLElement;
    expect(encadree.classList).toContain('doc-cellule--observee');
    expect(encadree.querySelector('.doc-pastille')?.textContent?.trim()).toBe('1');

    saisir('obs-lire-11-0', 'Consultation de prix ouverte');
    valider();
    const detail = creations.find((d) => d.idDetail === 1 && d.idPtControle === 11) as ExamenDetail;
    expect(detail.conforme).toBe(false);
    expect(detail.observations).toEqual([
      { auLieuDe: "Appel d'Offres Ouvert", lire: 'Consultation de prix ouverte', ordre: 1, champ: 'mode', idMarcheCible: 1, idBenefCible: null },
    ]);
    // Sans cible, la ligne d'observation part comme avant (aucun champ ajouté).
    expect(creations.find((d) => d.idDetail === 2 && d.idPtControle === 11)?.observations).toEqual([]);
  });

  it('« Cellule visée » (équivalent clavier) : un bénéficiaire précis, valeur reprise dans « Au lieu de »', () => {
    valider(); // → ligne 2, qui a un bénéficiaire
    expect(texte('.grille__eyebrow')).toBe('Ligne 2 sur 3');
    expect(texte('.grille__puces')).toContain('Consigne'); // la consigne vise les lignes 2 à 3
    choisirObservation(11);
    const select = racine().querySelector('.obs__cible select') as HTMLSelectElement;
    select.value = 'compte|31';
    select.dispatchEvent(new Event('change'));
    rendre();
    expect(ecran.resultat(2, 11).observations[0]).toEqual({ auLieuDe: '2441', lire: '', champ: 'compte', idMarcheCible: 2, idBenefCible: 31 });
  });

  it('synthèse : récapitulatif numéroté par étape, « Modifier » ramène à l\'endroit, synthèse obligatoire', () => {
    valider(); // ligne 1
    choisirObservation(12); // ligne 2, point 2
    saisir('obs-lire-12-0', 'Lancement avant ouverture des plis');
    valider(); // ligne 2
    valider(); // ligne 3
    // Pièces : pas de RAS par défaut (règle existante) — la raison le dit.
    expect(texte('.grille__raison')).toBe('Choisissez RAS ou Observation pour valider la pièce 1.');
    choisirPiece(100, 0);
    valider(); // pièce 1
    choisirPiece(101, 1);
    saisir('obs-piece', 'Document non signé par la PRMP');
    valider(); // pièce 2
    valider(); // contrôles du dossier
    expect(ecran.estEtapeAvis()).toBe(true);

    const groupes = Array.from(racine().querySelectorAll<HTMLElement>('.g'));
    const groupe = (libelle: string): string => (groupes.find((g) => g.textContent?.includes(libelle))?.textContent ?? '').replace(/\s+/g, ' ');
    expect(groupe('Fiche de présentation')).toContain('Sans objet');
    expect(groupe('Lignes du plan')).toContain('3 lignes examinées');
    expect(groupe('Lignes du plan')).toContain('1 observation');
    expect(groupe('Lignes du plan')).toContain('Ligne 2');
    expect(groupe('Lignes du plan')).toContain('2 lignes sans observation');
    expect(groupe('Pièces jointes')).toContain('Pièce 2');
    expect(groupe('Pièces jointes')).toContain('Document non signé par la PRMP');
    expect(groupe('Contrôles du dossier')).toContain('RAS');
    expect(Array.from(racine().querySelectorAll('.o__n')).map((n) => n.textContent?.trim())).toEqual(['1', '2']);
    expect(texte('.recap__consigne')).toContain('lignes 2 et 3 ; observations sur la ligne 2.');
    expect(texte('.next')).toContain('Le projet de PV est créé en brouillon avec 2 observations');

    // Soumettre sans synthèse : refusé, avec la raison.
    (racine().querySelector('.avis__principal') as HTMLButtonElement).click();
    rendre();
    expect(texte('.form-error')).toBe('Rédigez la synthèse des observations : elle accompagne votre avis dans le projet de PV.');
    expect(ecran.avis()).toBe('FAVR'); // avis suggéré pré-sélectionné (règle de cohérence)

    // « Modifier » l'observation 1 : retour à la ligne 2.
    (racine().querySelector('.o .lien') as HTMLButtonElement).click();
    rendre();
    expect(ecran.estEtapeAvis()).toBe(false);
    expect(texte('.grille__eyebrow')).toBe('Ligne 2 sur 3');
    expect((racine().querySelector('#obs-lire-12-0') as HTMLTextAreaElement).value).toBe('Lancement avant ouverture des plis');
  });
});
