import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { ChampFiche, DisponibiliteAvis, DocumentFiche } from '../../models';
import { AvisSpecifique } from './avis-specifique';
import { avisImprimes, champsVidesAvis, horodatage, jjmmaaaa, messageIndisponible, sansAvis } from './avis-specifique-modele';

const doc = (idDocument: number, type: DocumentFiche['type'], nomFichier: string, autres: Partial<DocumentFiche> = {}): DocumentFiche =>
  ({ idDocument, type, nomFichier, extension: nomFichier.split('.').pop(), lot: null, version: 1, ...autres });
const PUB = { datePublication: '2026-10-05', jmpNumero: '123', jmpDate: '2026-01-15', supports: 'le quotidien du 06/10/2026' };
const AVIS_1 = [
  doc(11, 'AVIS', 'AVIS_00004_303121_v1_20261005-100000.docx', { dateGeneration: '2026-10-05T10:00:00', publication: PUB }),
  doc(12, 'AVIS', 'AVIS_00004_303121_v1_20261005-100000.pdf', { dateGeneration: '2026-10-05T10:00:00', publication: PUB }),
];
const AVIS_2 = [
  doc(21, 'AVIS', 'AVIS_00004_303121_v2_20261012-093000.pdf', { dateGeneration: '2026-10-12T09:30:00', version: 2, publication: { ...PUB, datePublication: '2026-10-13' } }),
  doc(22, 'AVIS', 'AVIS_00004_303121_v2_20261012-093000.docx', { dateGeneration: '2026-10-12T09:30:00', version: 2, publication: { ...PUB, datePublication: '2026-10-13' } }),
];
const champ = (code: string, libelle: string, autres: Partial<ChampFiche> = {}): ChampFiche =>
  ({ code, bloc: code.slice(0, 3), rubrique: code.slice(4, 6), rang: 1, libelle, type: 'TEXTE', source: 'SAISIE', documentMaitre: 'DPAC', reprises: [], typesMarche: ['QUANTITE_FIXE'], obligatoire: false, ...autres }) as ChampFiche;

describe('Avis spécifique — règles pures (plan du 30/09, AV-3)', () => {
  it('les avis imprimés : une impression = une paire, PDF d’abord, la plus récente en tête ; les autres pièces ignorées', () => {
    const liste = avisImprimes([doc(1, 'DPAO', 'DPAO_v1.pdf'), ...AVIS_1, ...AVIS_2]);
    expect(liste.map((a) => a.fichiers.map((f) => f.idDocument))).toEqual([[21, 22], [12, 11]]);
    expect(liste[0].version).toBe(2);
    expect(liste[0].publication?.datePublication).toBe('2026-10-13');
    expect(sansAvis([doc(1, 'DPAO', 'DPAO_v1.pdf'), ...AVIS_1]).map((d) => d.idDocument)).toEqual([1]);
  });

  it('les raisons du serveur se lisent en clair ; rien pour les prestations intellectuelles ni quand l’avis est disponible', () => {
    expect(messageIndisponible('RESERVES_NON_LEVEES')).toContain('après la levée des réserves');
    expect(messageIndisponible('PV_NON_SIGNE')).toContain('PV de la Commission est signé');
    expect(messageIndisponible('AVIS_NON_FAVORABLE')).toContain('pas d’avis favorable');
    expect(messageIndisponible('CATEGORIE_SANS_AVIS')).toBeNull();
    expect(messageIndisponible(null)).toBeNull();
    expect(messageIndisponible('RAISON_FUTURE')).toContain('pas encore disponible');
  });

  it('les champs vides que l’avis imprimerait en pointillés : ceux de la forme, la garantie seulement si elle est exigée, lot par lot', () => {
    const champs = [
      champ('B04-DS-05', 'Montant à payer pour le dossier'),
      champ('B04-DS-07', 'Nom du responsable'),
      champ('B04-DS-08', 'Fonction', { actif: false }),
      champ('B05-GS-03', 'Montant de la garantie', { parLot: true }),
      champ('B02-OB-02', 'Autre champ'),
    ];
    const valeurs = { 'B04-DS-07': 'M. Rakoto', 'B05-GS-03#1': '500000' };
    expect(champsVidesAvis(champs, valeurs, { garantieSoumission: 'OUI' }, 2, true).map((c) => c.code)).toEqual(['B04-DS-05', 'B05-GS-03']);
    expect(champsVidesAvis(champs, { ...valeurs, 'B05-GS-03#2': '400000' }, { garantieSoumission: 'OUI' }, 2, true).map((c) => c.code)).toEqual(['B04-DS-05']);
    expect(champsVidesAvis(champs, valeurs, { garantieSoumission: 'NON' }, 2, true).map((c) => c.code)).toEqual(['B04-DS-05']);
  });

  it('dates lisibles', () => {
    expect(jjmmaaaa('2026-10-05')).toBe('05/10/2026');
    expect(horodatage('2026-10-05T14:30:00')).toBe('05/10/2026 à 14:30');
    expect(jjmmaaaa(null)).toBe('');
  });
});

describe('Avis spécifique — l’encart et la modale d’impression', () => {
  let fixture: ComponentFixture<AvisSpecifique>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const bouton = (debut: string): HTMLButtonElement | undefined => Array.from(racine().querySelectorAll('button')).find((x) => texte(x).startsWith(debut));
  const rendre = (): void => { fixture.detectChanges(); };
  const boutonModale = (debut: string): HTMLButtonElement => {
    const b = Array.from(racine().querySelectorAll('[role="dialog"] button')).find((x) => texte(x).startsWith(debut)) as HTMLButtonElement | undefined;
    if (!b) throw new Error(`bouton « ${debut} » absent de la modale`);
    return b;
  };
  const dispo = (d: Partial<DisponibiliteAvis>): DisponibiliteAvis =>
    ({ disponible: false, raison: null, idAvis: null, statutPv: null, statutDossier: null, idDossierSoumis: 100, ...d });

  function monter(etat: DisponibiliteAvis | 'refus', docs: DocumentFiche[] = [], lecture = false): void {
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ imports: [AvisSpecifique], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AvisSpecifique);
    fixture.componentRef.setInput('idDmc', 38);
    fixture.componentRef.setInput('lecture', lecture);
    rendre();
    const d = http.expectOne('/api/fiches-marche/38/avis-specifique/disponibilite');
    if (etat === 'refus') d.flush({ message: 'Accès refusé' }, { status: 403, statusText: 'Forbidden' });
    else d.flush(etat);
    http.expectOne('/api/fiches-marche/38/documents').flush([doc(1, 'DPAO', 'DPAO_v1.pdf'), ...docs]);
    rendre();
  }

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('muet quand le serveur refuse la lecture, et pour les prestations intellectuelles', () => {
    monter('refus');
    expect(racine().querySelector('.avs')).toBeNull();
    TestBed.resetTestingModule();
    monter(dispo({ raison: 'CATEGORIE_SANS_AVIS' }));
    expect(racine().querySelector('.avs')).toBeNull();
  });

  it('FAVR non levé : la raison, sans bouton ; les avis déjà imprimés restent listés', () => {
    monter(dispo({ raison: 'RESERVES_NON_LEVEES', idAvis: 'FAVR', statutPv: 'SIGNE' }), AVIS_1);
    expect(texte(racine().querySelector('.avs__attente'))).toContain('après la levée des réserves');
    expect(bouton('Imprimer l’avis spécifique')).toBeUndefined();
    expect(racine().querySelectorAll('.avs__avis').length).toBe(1);
    expect(texte(racine().querySelector('.avs__avis'))).toContain('publication du 05/10/2026');
  });

  it('disponible : imprimer ouvre la modale, reprend la dernière publication, prévient des champs vides, puis produit l’avis', () => {
    monter(dispo({ disponible: true, idAvis: 'FAV', statutPv: 'SIGNE' }), AVIS_1);
    expect(texte(racine().querySelector('.avs__txt'))).toContain('favorable');
    bouton('Imprimer l’avis spécifique')!.click();
    rendre();
    http.expectOne('/api/fiches-marche/38').flush({ idDmc: 38, typeMarche: 'QUANTITE_FIXE', categorie: 'TRAVAUX', cadrage: { garantieSoumission: 'OUI' }, valeurs: { 'B04-DS-07': 'M. Rakoto' }, valeursPpm: {}, nbLots: 1, saisieParLot: false });
    http.expectOne((r) => r.url === '/api/champs-fiche-marche').flush({ blocs: [], champs: [champ('B04-DS-05', 'Montant à payer pour le dossier'), champ('B04-DS-07', 'Nom du responsable'), champ('B05-GQ-03', 'Montant de la garantie de soumission')] });
    rendre();
    const modale = racine().querySelector('[role="dialog"]')!;
    expect(modale.getAttribute('aria-label')).toBe('Imprimer l’avis spécifique d’appel d’offres');
    // La réimpression garde la publication de la précédente.
    expect((modale.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('123');
    expect(Array.from(modale.querySelectorAll('.avs__vides li')).map(texte)).toEqual(['Montant à payer pour le dossier', 'Montant de la garantie de soumission']);

    boutonModale('Imprimer l’avis').click();
    const req = http.expectOne('/api/fiches-marche/38/avis-specifique');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(PUB);
    req.flush(AVIS_2, { status: 201, statusText: 'Created' });
    rendre();
    expect(racine().querySelector('[role="dialog"]')).toBeNull();
    expect(toast.success).toHaveBeenCalled();
    expect(racine().querySelectorAll('.avs__avis').length).toBe(2);
    expect(texte(racine().querySelector('.avs__avis--dernier'))).toContain('fiche version 2');
  });

  it('les erreurs : 400 nominatif sous le champ ; 409 AVIS_INDISPONIBLE nommé, puis l’état relu', () => {
    monter(dispo({ disponible: true, idAvis: 'FAVR', statutPv: 'SIGNE' }), AVIS_1);
    bouton('Imprimer l’avis spécifique')!.click();
    rendre();
    http.expectOne('/api/fiches-marche/38').flush({ idDmc: 38, typeMarche: 'QUANTITE_FIXE', categorie: 'FOURNITURES_SERVICES', cadrage: {}, valeurs: {}, valeursPpm: {}, nbLots: 1 });
    http.expectOne((r) => r.url === '/api/champs-fiche-marche').flush({ blocs: [], champs: [] });
    rendre();
    boutonModale('Imprimer l’avis').click();
    http.expectOne('/api/fiches-marche/38/avis-specifique').flush(
      { status: 400, message: 'Validation échouée', erreurs: [{ champ: 'jmpDate', message: 'La date du Journal des Marchés Publics de l’avis général est invalide.' }] },
      { status: 400, statusText: 'Bad Request' });
    rendre();
    expect(texte(racine().querySelector('.form-error'))).toContain('Journal des Marchés Publics');

    boutonModale('Imprimer l’avis').click();
    http.expectOne('/api/fiches-marche/38/avis-specifique').flush(
      { status: 409, code: 'AVIS_INDISPONIBLE', message: 'Réserves non levées', details: { raison: 'RESERVES_NON_LEVEES' } },
      { status: 409, statusText: 'Conflict' });
    rendre();
    expect(texte(racine().querySelector('[role="dialog"] .alert-danger'))).toContain('après la levée des réserves');
    http.expectOne('/api/fiches-marche/38/avis-specifique/disponibilite').flush(dispo({ raison: 'RESERVES_NON_LEVEES', idAvis: 'FAVR' }));
    http.expectOne('/api/fiches-marche/38/documents').flush([...AVIS_1]);
  });

  it('§B7.5 — le numéro du JMP et les supports sont facultatifs : les deux dates suffisent pour imprimer', () => {
    monter(dispo({ disponible: true, idAvis: 'FAV', statutPv: 'SIGNE' }));
    bouton('Imprimer l’avis spécifique')!.click();
    rendre();
    http.expectOne('/api/fiches-marche/38').flush({ idDmc: 38, typeMarche: 'CONTRAT_CADRE', categorie: 'TRAVAUX', cadrage: {}, valeurs: {}, valeursPpm: {}, nbLots: 3 });
    http.expectOne((r) => r.url === '/api/champs-fiche-marche').flush({ blocs: [], champs: [] });
    rendre();
    const c = fixture.componentInstance;
    c.poser('datePublication', '2026-09-09');
    expect(c.complete()).toBe(false);
    c.poser('jmpDate', '2026-07-31');
    expect(c.complete()).toBe(true);
    rendre();
    boutonModale('Imprimer l’avis').click();
    const req = http.expectOne('/api/fiches-marche/38/avis-specifique');
    expect(req.request.body).toEqual({ datePublication: '2026-09-09', jmpNumero: '', jmpDate: '2026-07-31', supports: '' });
    req.flush([]);
  });

  it('en lecture seule : la liste, sans bouton d’impression', () => {
    monter(dispo({ disponible: true, idAvis: 'FAV', statutPv: 'SIGNE' }), AVIS_1, true);
    expect(bouton('Imprimer l’avis spécifique')).toBeUndefined();
    expect(bouton('Ouvrir le PDF')).toBeDefined();
  });
});
