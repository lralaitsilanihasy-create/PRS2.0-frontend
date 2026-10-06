import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../../core/notifications/toast.service';
import { PieceExigee } from '../../../models';
import { FichePieces } from './fiche-pieces';

/** Extraits du DAO routier du MTP (fiche des faits §4), tels que le serveur les servira. */
const PIECES: PieceExigee[] = [
  { idPiece: 1, ordre: 1, rubrique: 'ADMINISTRATIVE', numero: '01', libelle: 'Carte professionnelle 2026', forme: 'copie légalisée par le centre fiscal', ancienneteMaxMois: 3, parLot: false, modele: null },
  { idPiece: 2, ordre: 2, rubrique: 'OFFRE', numero: '05', libelle: 'Quittance ARMP pour l’achat du dossier', forme: null, ancienneteMaxMois: null, parLot: false, modele: null },
  { idPiece: 3, ordre: 3, rubrique: 'OFFRE', numero: '09', libelle: 'Planning général', forme: null, ancienneteMaxMois: null, parLot: false, modele: 'annexe 5, planning 8-a' },
];

describe('Pièces de l’offre exigées (lot 4 du chantier b — contrat demandé le 03/10)', () => {
  let fixture: ComponentFixture<FichePieces>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rendre = (): void => fixture.detectChanges();
  const bouton = (libelle: string, dans: ParentNode = racine()): HTMLButtonElement => {
    const b = Array.from(dans.querySelectorAll('button')).find((x) => texte(x).startsWith(libelle));
    if (!b) throw new Error(`Bouton « ${libelle} » introuvable`);
    return b;
  };
  const section = (rubrique: string): HTMLElement => racine().querySelector(`section[aria-labelledby="pc-${rubrique}"]`) as HTMLElement;
  const apercu = (rubrique: string): string[] => Array.from(section(rubrique).querySelectorAll('.pc__apercu span:not(.pc__apercu-t)')).map((s) => texte(s));

  function monter(o: { lecture?: boolean; texte?: string | null; texteOffre?: string | null } = {}): void {
    toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [FichePieces],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FichePieces);
    fixture.componentRef.setInput('idDmc', 42);
    fixture.componentRef.setInput('lecture', o.lecture ?? false);
    fixture.componentRef.setInput('texteAdministratif', o.texte ?? null);
    fixture.componentRef.setInput('texteOffre', o.texteOffre ?? null);
    rendre();
  }

  function ouvrir(pieces: PieceExigee[] | null): void {
    const q = http.expectOne('/api/fiches-marche/42/pieces');
    if (pieces) q.flush(pieces);
    else q.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    // V73 — les spécifications techniques (section sous la liste) : aucun fichier.
    http.expectOne('/api/fiches-marche/42/specifications').flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    rendre();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('deux rubriques de la clause 6.2, chacune avec l’aperçu de ses lignes', () => {
    monter();
    ouvrir(PIECES);
    expect(apercu('ADMINISTRATIVE')).toEqual(['- 01 : Carte professionnelle 2026, copie légalisée par le centre fiscal, datée de moins de 3 mois']);
    expect(apercu('OFFRE')).toEqual(['- 05 : Quittance ARMP pour l’achat du dossier', '- 09 : Planning général, selon le modèle : annexe 5, planning 8-a']);
  });

  it('« Reprendre les pièces du document type » : six pièces administratives, à ajuster avant d’enregistrer', () => {
    monter();
    ouvrir([]);
    bouton('Reprendre les pièces du document type', section('ADMINISTRATIVE')).click();
    rendre();
    expect(apercu('ADMINISTRATIVE').length).toBe(6);
    expect(apercu('ADMINISTRATIVE')[1]).toBe('- État 211 bis, photocopie certifiée, datée de moins de 3 mois');
    expect(toast.info).toHaveBeenCalled();
    // Le bouton disparaît dès que la rubrique a des pièces.
    expect(Array.from(section('ADMINISTRATIVE').querySelectorAll('button')).some((b) => texte(b).startsWith('Reprendre'))).toBe(false);
  });

  it('le texte de B03-CQ-01 rempli avec une liste administrative : plus d’avertissement (C4 — le texte ne s’imprime plus)', () => {
    monter({ texte: 'une photocopie certifiée de la Carte Professionnelle…' });
    ouvrir(PIECES);
    expect(section('ADMINISTRATIVE').querySelector('.pc__alerte')).toBeNull();
  });

  it('une seule liste envoyée, rubrique par rubrique dans l’ordre affiché ; 400 sous la bonne pièce', () => {
    monter();
    ouvrir(PIECES);
    // Une pièce ajoutée aux administratives APRÈS les autres : elle part quand même avec sa rubrique, avant l'offre.
    bouton('+ Pièce', section('ADMINISTRATIVE')).click();
    rendre();
    bouton('Enregistrer les pièces').click();
    const put = http.expectOne('/api/fiches-marche/42/pieces');
    const envoye = (put.request.body as { pieces: (PieceExigee & { cle?: number })[] }).pieces;
    expect(envoye.map((p) => [p.rubrique, p.numero])).toEqual([
      ['ADMINISTRATIVE', '01'],
      ['ADMINISTRATIVE', null],
      ['OFFRE', '05'],
      ['OFFRE', '09'],
    ]);
    expect(envoye.every((p) => p.cle === undefined && p.idPiece === undefined)).toBe(true);
    put.flush([{ champ: 'pieces[1].libelle', message: 'Le libellé de la pièce est obligatoire.' }], { status: 400, statusText: 'Bad Request' });
    rendre();
    const erreurs = Array.from(section('ADMINISTRATIVE').querySelectorAll('.form-error')).map((e) => texte(e));
    expect(erreurs).toEqual(['Le libellé de la pièce est obligatoire.']);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('route pas encore servie (404) : rubriques vides ; lecture : aucun geste d’écriture', () => {
    monter({ lecture: true });
    ouvrir(null);
    expect(Array.from(racine().querySelectorAll('.pc__etat')).map((e) => texte(e))).toEqual(['Aucune pièce.', 'Aucune pièce.']);
    expect(racine().querySelector('button')).toBeNull();
  });

  it('« Coller une liste » (03/10) : collées dans la rubrique choisie, forme et ancienneté reconnues', () => {
    monter();
    ouvrir([]);
    bouton('Coller une liste', section('ADMINISTRATIVE')).click();
    rendre();
    const zone = racine().querySelector('textarea') as HTMLTextAreaElement;
    zone.value = "Un certificat de non faillite daté de moins de 03 mois (original)\nCopie certifiée conforme à l'original de la carte statistique datée de moins de deux (03) mois";
    zone.dispatchEvent(new Event('input'));
    rendre();
    bouton('Ajouter 2 entrée(s)').click();
    rendre();
    expect(apercu('ADMINISTRATIVE')).toEqual([
      '- Certificat de non faillite, original, datée de moins de 3 mois',
      '- Carte statistique, copie certifiée conforme à l’original, datée de moins de 3 mois',
    ]);
    expect(apercu('OFFRE')).toEqual([]);
  });

  it('« Proposer la liste à partir du texte » (06/10, SE_PIECES_LISTEES) : le collage part du texte de la fiche', () => {
    monter({ texteOffre: 'Le planning général\nUn échéancier de paiement (original)' });
    ouvrir([]);
    bouton('Proposer la liste à partir du texte', section('OFFRE')).click();
    rendre();
    expect((racine().querySelector('textarea') as HTMLTextAreaElement).value).toContain('échéancier de paiement');
    bouton('Ajouter 2 entrée(s)').click();
    rendre();
    expect(apercu('OFFRE')).toHaveLength(2);
    // La liste remplie, le raccourci s'efface ; sans texte, il n'apparaît pas.
    expect(racine().textContent).not.toContain('Proposer la liste à partir du texte');
  });
});
