import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../../core/notifications/toast.service';
import { CategorieDao, ChampFiche, ImportDaoResult, PropositionImport, TypeMarche } from '../../../models';
import { ImportDao, cocheeDOffice, importPossible, memeValeur } from './import-dao';

const champ = (code: string, libelle: string): ChampFiche =>
  ({ code, bloc: code.slice(0, 3), rubrique: code.slice(0, 6), rang: 1, libelle, type: 'TEXTE', source: 'SAISIE', documentMaitre: 'DPAC', reprises: [], typesMarche: ['CONTRAT_CADRE'], condition: null, obligatoire: false }) as unknown as ChampFiche;
const CHAMPS = [champ('B04-CP-02', 'Date et heure limites de remise des offres'), champ('B04-RQ-03', 'Adresse exacte de remise des offres'), champ('B07-FS-01', 'Forme des marchés subséquents'), champ('B09-GP-02', 'Nature des garanties particulières'), champ('B04-DS-07', 'Nom du responsable')];

const prop = (code: string, valeur: string | number, confiance: PropositionImport['confiance'], autres: Partial<PropositionImport> = {}): PropositionImport =>
  ({ code, lot: null, valeur, brut: String(valeur), confiance, extrait: `… ${valeur} …`, actuelle: null, anomalies: [], ...autres });

/** Ce que le serveur rend pour un DAO de contrat-cadre (contrat de la demande du 28/09, livré). */
const RESULTAT: ImportDaoResult = {
  fichier: 'DAO-contrat-cadre.docx',
  empreinte: 'a'.repeat(64),
  modeles: [{ sigle: 'DPAC-CC', unites: 141, reconnues: 118 }, { sigle: 'AE-CC', unites: 263, reconnues: 214 }],
  cadrage: [
    { cle: 'attributaires', valeur: 'MULTI', section: 'MULTI', actuelle: null },
    { cle: 'avance', valeur: 'OUI', section: 'AVANCE', actuelle: 'NON' },
    { cle: 'modeRemise', valeur: 'PAPIER', section: 'PAPIER', actuelle: null },   // la fiche vaut « Papier » par défaut
    { cle: 'tauxAvance', valeur: 15, section: 'AVANCE', actuelle: null },         // un complément, nommé par son libellé
  ],
  propositions: [
    prop('B04-CP-02', '2026-11-20T10:00', 'haute'),                               // sûre, case vide : cochée
    prop('B04-RQ-03', 'Porte 204, 2e étage', 'haute', { actuelle: 'Bureau 12' }),  // sûre mais écraserait : non cochée
    prop('B07-FS-01', 'Marchés uniques non fractionnés', 'moyenne'),              // à vérifier : non cochée
    prop('B09-GP-02', 'Garantie des pièces', 'basse'),                            // incertaine : non cochée
    prop('B04-DS-07', 'X', 'haute', { anomalies: ['ne s’applique pas avec ce cadrage'] }), // bloquée
  ],
  ambigus: [{ candidats: ['B07-DE-02', 'B07-DE-03'], texte: 'Le délai de livraison est fixé à 2 mois.' }],
  divergences: [{ code: 'B02-OB-01', document: 'Pièces de rechange', plan: 'Fourniture de pièces de rechange' }],
  conflits: [],
  nonTrouves: ['B10-RS-03'],
  avertissements: [],
};

describe('Import du DAO — la revue avant d’écrire (demande du pilote du 28/09)', () => {
  let fixture: ComponentFixture<ImportDao>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const bouton = (debut: string): HTMLButtonElement => {
    const b = Array.from(racine().querySelectorAll('button')).find((x) => texte(x).startsWith(debut));
    if (!b) throw new Error(`bouton « ${debut} » introuvable`);
    return b;
  };
  const caseDe = (libelle: string): HTMLInputElement => racine().querySelector(`input[type="checkbox"][aria-label="Retenir : ${libelle}"]`) as HTMLInputElement;

  function monter(typeMarche: TypeMarche | null = 'CONTRAT_CADRE', vierge = true, categorie: CategorieDao | null = null): void {
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({ imports: [ImportDao], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImportDao);
    fixture.componentRef.setInput('idDmc', 27);
    fixture.componentRef.setInput('champs', CHAMPS);
    fixture.componentRef.setInput('typeMarche', typeMarche);
    fixture.componentRef.setInput('categorie', categorie);
    fixture.componentRef.setInput('vierge', vierge);
    fixture.detectChanges();
  }
  function choisir(fichier: File): void {
    const champ = racine().querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(champ, 'files', { value: [fichier], configurable: true });
    champ.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }
  const DOCX = new File(['PK'], 'DAO.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  function lire(): void {
    choisir(DOCX);
    const req = http.expectOne('/api/fiches-marche/27/import');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('fichier')).toBeTruthy();
    req.flush(RESULTAT);
    fixture.detectChanges();
  }
  afterEach(() => http?.verify());

  it('règles pures : cochée d’office = sûre, sans anomalie, sur case vide ; même valeur tolère le type', () => {
    expect(cocheeDOffice(prop('X', 1, 'haute'))).toBe(true);
    expect(cocheeDOffice(prop('X', 1, 'moyenne'))).toBe(false);
    expect(cocheeDOffice(prop('X', 1, 'haute', { actuelle: '2' }))).toBe(false);
    expect(cocheeDOffice(prop('X', 1, 'haute', { anomalies: ['refus'] }))).toBe(false);
    expect(memeValeur(15, '15')).toBe(true);
    expect(memeValeur('Oui', 'OUI')).toBe(true);
    expect(memeValeur(null, '')).toBe(false);
  });

  it('proposé en tête du cadrage d’une fiche vierge ; un simple bouton sinon ; rien pour une forme sans modèle', () => {
    monter('CONTRAT_CADRE', true);
    expect(texte(racine())).toContain('Vous avez déjà le dossier d’appel d’offres ?');
    expect(bouton('Importer le DAO')).toBeTruthy();
    TestBed.resetTestingModule();
    monter('CONTRAT_CADRE', false);
    expect(bouton('Réimporter un DAO')).toBeTruthy();
    // ⚠️ 29/09 — lot D2 : les fournitures à quantité fixe s'importent aussi ; 30/09 — lot D4 : les travaux aussi.
    TestBed.resetTestingModule();
    monter('QUANTITE_FIXE', true, 'FOURNITURES_SERVICES');
    expect(racine().querySelector('input[type="file"]')).not.toBeNull();
    TestBed.resetTestingModule();
    monter('QUANTITE_FIXE', true, 'TRAVAUX');
    expect(racine().querySelector('input[type="file"]')).not.toBeNull();
    TestBed.resetTestingModule();
    monter('CONTRAT_CADRE', true, 'PRESTATIONS_INTELLECTUELLES');   // la seule forme sans modèle
    expect(racine().querySelector('input[type="file"]')).toBeNull();
  });

  it('règle d’ouverture : les couples décrits (miroir de ModelesDao) — fournitures D1/D2, PI D3, travaux D4', () => {
    expect(importPossible('CONTRAT_CADRE', 'FOURNITURES_SERVICES')).toBe(true);
    expect(importPossible('QUANTITE_FIXE', 'FOURNITURES_SERVICES')).toBe(true);
    expect(importPossible('A_COMMANDE', null)).toBe(true);                        // sans catégorie : lu comme fournitures
    expect(importPossible('QUANTITE_FIXE', 'PRESTATIONS_INTELLECTUELLES')).toBe(true);   // lot D3, 29/09
    expect(importPossible('A_COMMANDE', 'PRESTATIONS_INTELLECTUELLES')).toBe(true);
    expect(importPossible('CONTRAT_CADRE', 'PRESTATIONS_INTELLECTUELLES')).toBe(false);  // pas de contrat-cadre de PI
    expect(importPossible('CONTRAT_CADRE', 'TRAVAUX')).toBe(true);                // lot D4, 30/09 : DPAC-CC et AE-CC
    expect(importPossible('QUANTITE_FIXE', 'TRAVAUX')).toBe(true);                // DPAO-T, AE-T, CCAP-T
    expect(importPossible('A_COMMANDE', 'TRAVAUX')).toBe(true);
    expect(importPossible(null, 'FOURNITURES_SERVICES')).toBe(false);
  });

  it('le PDF est accepté depuis le 29/09 : il part au serveur comme un Word', () => {
    monter();
    choisir(new File(['%PDF-1.4'], 'DAO.pdf', { type: 'application/pdf' }));
    expect(racine().querySelector('.alert-danger')).toBeNull();
    const req = http.expectOne('/api/fiches-marche/27/import');
    expect(((req.request.body as FormData).get('fichier') as File).name).toBe('DAO.pdf');
    req.flush(RESULTAT);
  });

  it('un fichier ni Word ni PDF est refusé à l’écran, sans appel au serveur', () => {
    monter();
    choisir(new File(['x'], 'DAO.png', { type: 'image/png' }));
    expect(texte(racine().querySelector('.alert-danger'))).toContain('document Word (.docx) ou PDF attendu');
    http.expectNone('/api/fiches-marche/27/import');
  });

  it('la revue : cochée d’office la seule valeur sûre sur case vide ; les autres à cocher, la bloquée inaccessible', () => {
    monter();
    lire();
    expect(racine().querySelector('[role="dialog"]')?.getAttribute('aria-label')).toContain('Revue de l’import');
    expect(caseDe('Date et heure limites de remise des offres').checked).toBe(true);
    expect(caseDe('Adresse exacte de remise des offres').checked).toBe(false);   // écraserait « Bureau 12 »
    expect(caseDe('Forme des marchés subséquents').checked).toBe(false);          // à vérifier
    expect(caseDe('Nature des garanties particulières').checked).toBe(false);     // incertaine
    expect(caseDe('Nom du responsable').disabled).toBe(true);                     // anomalie
    expect(texte(racine())).toContain('ne s’applique pas avec ce cadrage');
    // Cadrage : la réponse sur une question sans réponse est retenue, celle qui changerait « Non » ne l'est pas.
    const cad = Array.from(racine().querySelectorAll('input[aria-label^="Retenir la réponse"]')) as HTMLInputElement[];
    expect(cad.map((c) => c.checked)).toEqual([true, false, false, true]);
    expect(cad[2].disabled).toBe(true);   // « Papier » : déjà la réponse (par défaut), rien à écrire
    expect(texte(racine())).toContain('Taux de l’avance');
    expect(texte(racine())).not.toContain('tauxAvance');
    expect(texte(racine())).toContain('Multi-attributaire');
    // Ce qui ne se propose pas se dit quand même.
    expect(texte(racine())).toContain('la lecture ne choisit pas');
    expect(texte(racine())).toContain('le plan fait foi');
    expect(bouton('Appliquer').textContent).toContain('Appliquer 3 lignes');
  });

  it('appliquer n’envoie QUE les lignes retenues, avec le fichier et son empreinte ; la fiche revient au parent', () => {
    monter();
    let rendue: unknown = null;
    fixture.componentInstance.applique.subscribe((f) => (rendue = f));
    lire();
    caseDe('Forme des marchés subséquents').click();   // la PRMP retient une valeur à vérifier
    fixture.detectChanges();
    bouton('Appliquer').click();
    const req = http.expectOne('/api/fiches-marche/27/import/appliquer');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      cadrage: { attributaires: 'MULTI', tauxAvance: 15 },
      valeurs: { 'B04-CP-02': '2026-11-20T10:00', 'B07-FS-01': 'Marchés uniques non fractionnés' },
      fichier: 'DAO-contrat-cadre.docx',
      empreinte: 'a'.repeat(64),
    });
    req.flush({ idFiche: 1, version: 3, statut: 'BROUILLON', cadrage: {}, valeurs: {} });
    fixture.detectChanges();
    expect(rendue).toMatchObject({ version: 3 });
    expect(toast.success).toHaveBeenCalled();
    expect(racine().querySelector('[role="dialog"]')).toBeNull();
  });

  it('un 400 nominatif : rien n’est écrit, la ligne refusée est montrée, la revue reste ouverte', () => {
    monter();
    lire();
    bouton('Appliquer').click();
    http.expectOne('/api/fiches-marche/27/import/appliquer').flush(
      { status: 400, erreurs: [{ champ: 'B04-CP-02', message: 'attend une date et une heure AAAA-MM-JJTHH:MM' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(texte(racine().querySelector('.alert-danger'))).toContain('Rien n’a été écrit');
    expect(texte(racine())).toContain('attend une date et une heure');
    expect(racine().querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('un refus du serveur à la lecture (forme sans modèle) est dit en clair', () => {
    monter();
    choisir(DOCX);
    http.expectOne('/api/fiches-marche/27/import').flush(
      { code: 'MODELE_ABSENT', message: 'L’import n’est pas encore possible pour ce type de marché : saisissez la fiche.' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();
    expect(texte(racine().querySelector('.alert-danger'))).toContain('saisissez la fiche');
  });

  it('lecture hybride (03/10, contrat demandé) : une valeur trouvée par clause est dite à vérifier ; un passage de liste se copie, il ne s’applique pas', async () => {
    monter();
    choisir(DOCX);
    const ecrit = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrit }, configurable: true });
    http.expectOne('/api/fiches-marche/27/import').flush({
      ...RESULTAT,
      propositions: [prop('B07-FS-01', 'Marchés uniques non fractionnés', 'moyenne', { source: 'clause' })],
      passages: [{ liste: 'MATERIEL', texte: 'Camions bennes ≥ 10 000 kg\t6\tau moins 4 en propre', paragraphe: 312 }],
    });
    fixture.detectChanges();
    expect(Array.from(racine().querySelectorAll('tbody .idao__note')).map((n) => texte(n))).toContain('trouvée par les mots-clés de sa clause — à vérifier');
    expect(caseDe('Marchés uniques non fractionnés')?.checked ?? false).toBe(false);
    expect(texte(racine().querySelector('.idao__passage strong'))).toBe('Matériel exigé — bloc B13');
    bouton('Copier le passage').click();
    await Promise.resolve();
    expect(ecrit).toHaveBeenCalledWith('Camions bennes ≥ 10 000 kg\t6\tau moins 4 en propre');
    await Promise.resolve();
    expect(toast.info).toHaveBeenCalledWith('Passage copié. Ouvrez « Matériel exigé — bloc B13 », puis « Coller une liste ».');
  });
});
