import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { DisponibiliteAvis, DocumentFiche } from '../../models';
import { erreurCandidat, lettresImprimees, sansAvis } from './avis-specifique-modele';
import { LettresInvitation } from './lettres-invitation';

const LISTE = [{ nom: 'Cabinet Alpha', adresse: 'Lot II A 12\nAntananarivo' }, { nom: 'Bureau Bêta', adresse: 'Rue 5, Toamasina' }];
const PUB = { dateEnvoi: '2026-10-05', lieu: 'Antananarivo', candidats: LISTE };
const doc = (idDocument: number, nomFichier: string, rang: number, autres: Partial<DocumentFiche> = {}): DocumentFiche =>
  ({ idDocument, type: 'LETTRE_INVITATION', nomFichier, extension: nomFichier.split('.').pop(), lot: null, version: 2, dateGeneration: '2026-10-05T14:30:00', publication: { ...PUB, rang }, ...autres });
const LETTRES = [
  doc(11, 'LETTRE_00004_303200_v2_20261005-143000_01.docx', 1),
  doc(12, 'LETTRE_00004_303200_v2_20261005-143000_01.pdf', 1),
  doc(13, 'LETTRE_00004_303200_v2_20261005-143000_02.pdf', 2),
  doc(14, 'LETTRE_00004_303200_v2_20261005-143000_02.docx', 2),
];

describe('Lettres d’invitation — règles pures (lot AV-4, 01/10)', () => {
  it('une impression = une lettre par candidat, PDF d’abord, destinataire lu dans la liste gardée en trace', () => {
    const imp = lettresImprimees([...LETTRES, { idDocument: 1, type: 'AVIS', nomFichier: 'AVIS_x.pdf' } as DocumentFiche]);
    expect(imp.length).toBe(1);
    expect(imp[0].lettres.map((l) => [l.rang, l.destinataire, l.fichiers.map((f) => f.idDocument)])).toEqual([
      [1, 'Cabinet Alpha', [12, 11]],
      [2, 'Bureau Bêta', [13, 14]],
    ]);
    expect(imp[0].publication?.lieu).toBe('Antananarivo');
  });

  it('les lettres quittent aussi la liste des pièces de l’étape 7', () => {
    expect(sansAvis([...LETTRES, { idDocument: 2, type: 'DPAO', nomFichier: 'DPAO.pdf' } as DocumentFiche]).map((d) => d.idDocument)).toEqual([2]);
  });

  it('une erreur nominative d’un candidat (indice à partir de 0) se rapporte au rang humain', () => {
    expect(erreurCandidat('candidats[1].nom')).toEqual({ rang: 2, champ: 'nom' });
    expect(erreurCandidat('candidats[0].adresse')).toEqual({ rang: 1, champ: 'adresse' });
    expect(erreurCandidat('candidats[2].email')).toEqual({ rang: 3, champ: 'email' });
    expect(erreurCandidat('lieu')).toBeNull();
  });
});

describe('Lettres d’invitation — l’encart et la modale de la liste restreinte', () => {
  let fixture: ComponentFixture<LettresInvitation>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rendre = (): void => { fixture.detectChanges(); };
  const bouton = (debut: string, dans: ParentNode = racine()): HTMLButtonElement | undefined =>
    Array.from(dans.querySelectorAll('button')).find((x) => texte(x).startsWith(debut)) as HTMLButtonElement | undefined;
  const modale = (): HTMLElement => racine().querySelector('[role="dialog"]') as HTMLElement;
  const saisir = (el: Element | null, v: string): void => { (el as HTMLInputElement).value = v; el!.dispatchEvent(new Event('input')); rendre(); };
  const dispo = (d: Partial<DisponibiliteAvis>): DisponibiliteAvis =>
    ({ disponible: false, raison: null, idAvis: null, statutPv: null, statutDossier: null, idDossierSoumis: 100, ...d });

  function monter(etat: DisponibiliteAvis, docs: DocumentFiche[] = [], preselection: object | null = null): void {
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ imports: [LettresInvitation], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LettresInvitation);
    fixture.componentRef.setInput('idDmc', 40);
    rendre();
    http.expectOne('/api/fiches-marche/40/lettres-invitation/disponibilite').flush(etat);
    http.expectOne('/api/fiches-marche/40/documents').flush(docs);
    const ps = http.expectOne('/api/fiches-marche/40/ami/preselection');
    if (preselection) ps.flush(preselection);
    else ps.flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
    rendre();
  }
  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('muet hors prestations intellectuelles', () => {
    monter(dispo({ raison: 'CATEGORIE_SANS_LETTRE' }));
    expect(racine().querySelector('.avs')).toBeNull();
  });

  it('disponible : la liste des lettres imprimées, puis la modale reprend la dernière liste et imprime une lettre par candidat', () => {
    monter(dispo({ disponible: true, idAvis: 'FAV', statutPv: 'SIGNE' }), LETTRES);
    expect(Array.from(racine().querySelectorAll('.lti__dest')).map(texte)).toEqual(['1. Cabinet Alpha', '2. Bureau Bêta']);
    expect(texte(racine().querySelector('.lti__impression'))).toContain('envoi du 05/10/2026, Antananarivo');
    bouton('Imprimer les lettres d’invitation')!.click();
    rendre();
    expect(modale().getAttribute('aria-label')).toBe('Imprimer les lettres d’invitation');
    expect(racine().querySelectorAll('.lti__candidat').length).toBe(2);
    // Un troisième candidat, à compléter avant d'imprimer.
    bouton('+ Ajouter un candidat', modale())!.click();
    rendre();
    expect(bouton('Imprimer 3 lettres', modale())!.disabled).toBe(true);
    const lignes = racine().querySelectorAll('.lti__candidat');
    saisir(lignes[2].querySelector('input'), 'Groupement Gamma');
    saisir(lignes[2].querySelector('textarea'), 'BP 45, Mahajanga');
    // ⚠️ PI-a — l'adresse électronique est facultative : saisie, elle part ; laissée vide, elle part nulle.
    saisir(lignes[2].querySelector('input[type="email"]'), ' contact@gamma.mg ');
    bouton('Imprimer 3 lettres', modale())!.click();
    const req = http.expectOne('/api/fiches-marche/40/lettres-invitation');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      ...PUB,
      candidats: [...LISTE.map((c) => ({ ...c, email: null })), { nom: 'Groupement Gamma', adresse: 'BP 45, Mahajanga', email: 'contact@gamma.mg' }],
    });
    req.flush([doc(31, 'LETTRE_00004_303200_v2_20261006-090000_03.pdf', 3, { dateGeneration: '2026-10-06T09:00:00' })], { status: 201, statusText: 'Created' });
    rendre();
    expect(modale()).toBeNull();
    expect(toast.success).toHaveBeenCalled();
    expect(racine().querySelectorAll('.lti__impression').length).toBe(2);
  });

  it('un 400 nominatif par candidat s’affiche sous le bon champ ; un candidat seul ne se retire pas', () => {
    monter(dispo({ disponible: true, idAvis: 'FAV', statutPv: 'SIGNE' }), LETTRES);
    bouton('Imprimer les lettres d’invitation')!.click();
    rendre();
    bouton('Imprimer 2 lettres', modale())!.click();
    http.expectOne('/api/fiches-marche/40/lettres-invitation').flush(
      { status: 400, message: 'Validation échouée', erreurs: [{ champ: 'candidats[1].adresse', message: 'L’adresse du candidat n° 2 est obligatoire.' }] },
      { status: 400, statusText: 'Bad Request' });
    rendre();
    const lignes = racine().querySelectorAll('.lti__candidat');
    expect(texte(lignes[1].querySelector('.form-error'))).toBe('L’adresse du candidat n° 2 est obligatoire.');
    expect(lignes[0].querySelector('.form-error')).toBeNull();
    // Retirer jusqu'au dernier : le bouton du dernier candidat reste désactivé.
    (lignes[1].querySelector('.lti__retirer') as HTMLButtonElement).click();
    rendre();
    expect((racine().querySelector('.lti__retirer') as HTMLButtonElement).disabled).toBe(true);
  });

  it('⚠️ AMI-b : avec une liste restreinte définitive, la modale la montre et n’envoie aucune saisie', () => {
    const liste = [
      { rang: 1, idExpression: 'e-1', idCandidat: 'C1', nif: '1', raisonSociale: 'Cabinet Alpha', note: 85 },
      { rang: 2, idExpression: 'e-2', idCandidat: 'C2', nif: '2', raisonSociale: 'Bureau Bêta', note: 78 },
    ];
    monter(dispo({ disponible: true, idAvis: 'FAV', statutPv: 'SIGNE' }), [], { etat: 'DEFINITIVE', liste });
    bouton('Imprimer les lettres d’invitation')!.click();
    rendre();
    expect(racine().querySelectorAll('.lti__candidat').length).toBe(0);
    expect(texte(modale())).toContain('Liste restreinte arrêtée par la commission (2 candidats)');
    saisir(modale().querySelector('input[type="date"]'), '2026-10-20');
    saisir(modale().querySelector('input[type="text"]'), 'Antananarivo');
    bouton('Imprimer 2 lettres', modale())!.click();
    const req = http.expectOne('/api/fiches-marche/40/lettres-invitation');
    expect(req.request.body).toEqual({ dateEnvoi: '2026-10-20', lieu: 'Antananarivo', candidats: [] });
    req.flush([], { status: 201, statusText: 'Created' });
  });
});
