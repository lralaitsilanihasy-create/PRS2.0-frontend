import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../../core/notifications/toast.service';
import { ArticleFiche, TypeMarche } from '../../../models';
import { FicheBesoin } from './fiche-besoin';

/** Le besoin tel que le serveur le sert : deux articles au lot 1, un au lot 2. */
const ARTICLES: ArticleFiche[] = [
  {
    idArticle: 1, lot: 1, ordre: 1, designation: 'Ordinateur portable', unite: 'U', quantite: 12,
    caracteristiques: [
      { idCaracteristique: 11, ordre: 1, libelle: 'Mémoire vive', exigence: '8 Go au minimum' },
      { idCaracteristique: 12, ordre: 2, libelle: 'Disque', exigence: 'SSD 512 Go' },
    ],
  },
  { idArticle: 2, lot: 1, ordre: 2, designation: 'Imprimante laser', unite: 'U', quantite: 3, caracteristiques: [] },
  { idArticle: 3, lot: 2, ordre: 1, designation: 'Chaise de bureau', unite: 'U', quantite: 40, caracteristiques: [] },
];

describe('Besoin de la fiche DAO (bloc B12, livraison V45 du 25/09)', () => {
  let fixture: ComponentFixture<FicheBesoin>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rendre = (): void => fixture.detectChanges();
  const bouton = (libelle: string): HTMLButtonElement => {
    const b = Array.from(racine().querySelectorAll('button')).find((x) => texte(x).startsWith(libelle));
    if (!b) throw new Error(`Bouton « ${libelle} » introuvable`);
    return b;
  };
  /** Les lignes d'articles du lot affiché (hors lignes de caractéristiques dépliées). */
  const lignes = (): HTMLTableRowElement[] => Array.from(racine().querySelectorAll('tbody tr:not(.bs__carac)'));
  const saisie = (ligne: Element, place = 0): HTMLInputElement =>
    Array.from(ligne.querySelectorAll('input[type="text"]'))[place] as HTMLInputElement;
  const ecrire = (champ: HTMLInputElement, valeur: string): void => {
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
  };

  interface Options {
    nbLots?: number;
    saisieParLot?: boolean;
    lecture?: boolean;
    typeMarche?: TypeMarche | null;
  }

  function monter(o: Options = {}): void {
    toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [FicheBesoin],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FicheBesoin);
    fixture.componentRef.setInput('idDmc', 42);
    fixture.componentRef.setInput('nbLots', o.nbLots ?? 2);
    fixture.componentRef.setInput('saisieParLot', o.saisieParLot ?? true);
    fixture.componentRef.setInput('lecture', o.lecture ?? false);
    fixture.componentRef.setInput('typeMarche', o.typeMarche ?? 'QUANTITE_FIXE');
    rendre();
  }

  /** Répond au chargement du besoin. `null` = route pas encore servie (repli sur une grille vide). */
  function ouvrir(articles: ArticleFiche[] | null): void {
    const q = http.expectOne('/api/fiches-marche/42/articles');
    expect(q.request.method).toBe('GET');
    if (articles) q.flush(articles);
    else q.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    rendre();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('un onglet par lot avec son compte, le lot 1 d’abord, les articles du lot seuls', () => {
    monter();
    ouvrir(ARTICLES);
    expect(Array.from(racine().querySelectorAll('.bs__lot')).map((b) => texte(b))).toEqual(['Lot 1 2', 'Lot 2 1']);
    expect(racine().querySelector('.bs__lot--actif')?.getAttribute('aria-selected')).toBe('true');
    expect(lignes().length).toBe(2);
    expect(saisie(lignes()[0]).value).toBe('Ordinateur portable');

    // On change de lot : les articles de l'autre lot ne se mélangent pas.
    bouton('Lot 2').click();
    rendre();
    expect(lignes().length).toBe(1);
    expect(saisie(lignes()[0]).value).toBe('Chaise de bureau');
  });

  it('les caractéristiques exigées se déplient article par article, et s’ajoutent', () => {
    monter();
    ouvrir(ARTICLES);
    // Elles ne sont pas dépliées d'emblée : deux exigences sous chaque article noieraient la grille.
    expect(racine().querySelector('.bs__carac')).toBeNull();
    bouton('▸ 2 caractéristique(s)').click();
    rendre();
    const exigences = Array.from(racine().querySelectorAll('.bs__carac .bs__cl'));
    expect(exigences.length).toBe(2);
    expect((exigences[0].querySelectorAll('input')[1] as HTMLInputElement).value).toBe('8 Go au minimum');

    bouton('+ Caractéristique exigée').click();
    rendre();
    expect(racine().querySelectorAll('.bs__carac .bs__cl').length).toBe(3);
    // Un article sans exigence le dit : c'est ce que le contrôle « besoin incomplet » réclamera.
    bouton('▸ 0 caractéristique(s)').click();
    rendre();
    expect(Array.from(racine().querySelectorAll('.bs__carac .bs__etat')).map((p) => texte(p)))
      .toEqual(['Aucune caractéristique exigée — le contrôle « besoin incomplet » la réclamera.']);
  });

  it('l’ordre affiché fait foi : monter un article renumérote le bordereau, et part dans cet ordre', () => {
    monter();
    ouvrir(ARTICLES);
    // Le premier ne se monte pas, le dernier ne se descend pas.
    expect((lignes()[0].querySelector('[aria-label="Monter cet article"]') as HTMLButtonElement).disabled).toBe(true);
    expect((lignes()[1].querySelector('[aria-label="Descendre cet article"]') as HTMLButtonElement).disabled).toBe(true);

    (lignes()[1].querySelector('[aria-label="Monter cet article"]') as HTMLButtonElement).click();
    rendre();
    expect(lignes().map((l) => saisie(l).value)).toEqual(['Imprimante laser', 'Ordinateur portable']);
    expect(lignes().map((l) => texte(l.querySelector('.bs__c-n')))).toEqual(['1', '2']);

    bouton('Enregistrer le lot 1').click();
    const put = http.expectOne((r) => r.url === '/api/fiches-marche/42/articles' && r.params.get('lot') === '1');
    expect(put.request.method).toBe('PUT');
    // ⚠️ L'ordre envoyé est celui de l'écran : le serveur pose l'`ordre` à partir de la position reçue.
    expect((put.request.body as { articles: ArticleFiche[] }).articles.map((a) => a.designation))
      .toEqual(['Imprimante laser', 'Ordinateur portable']);
    put.flush([
      { ...ARTICLES[1], ordre: 1 },
      { ...ARTICLES[0], ordre: 2 },
    ]);
    rendre();
    expect(toast.success).toHaveBeenCalledWith('Besoin du lot 1 enregistré.');
  });

  it('l’envoi ne porte que le lot affiché, avec la quantité de la forme du marché', () => {
    monter();
    ouvrir(ARTICLES);
    bouton('Lot 2').click();
    rendre();
    bouton('+ Article').click();
    rendre();
    ecrire(saisie(lignes()[1]), 'Table de réunion');
    const nombre = lignes()[1].querySelector('input[type="number"]') as HTMLInputElement;
    nombre.value = '6';
    nombre.dispatchEvent(new Event('input'));
    rendre();

    bouton('Enregistrer le lot 2').click();
    const put = http.expectOne((r) => r.url === '/api/fiches-marche/42/articles' && r.params.get('lot') === '2');
    // Quantité fixe : une seule quantité, et les bornes du marché à commande restent nulles.
    expect(put.request.body).toEqual({
      articles: [
        { lot: 2, designation: 'Chaise de bureau', unite: 'U', quantiteMin: null, quantiteMax: null, quantite: 40, caracteristiques: [] },
        { lot: 2, designation: 'Table de réunion', unite: 'U', quantiteMin: null, quantiteMax: null, quantite: 6, caracteristiques: [] },
      ],
    });
    put.flush([
      { idArticle: 3, lot: 2, ordre: 1, designation: 'Chaise de bureau', unite: 'U', quantite: 40, caracteristiques: [] },
      { idArticle: 4, lot: 2, ordre: 2, designation: 'Table de réunion', unite: 'U', quantite: 6, caracteristiques: [] },
    ]);
    rendre();
    // Le lot 1 n'a pas été touché par la réponse : son compte tient.
    expect(Array.from(racine().querySelectorAll('.bs__lot')).map((b) => texte(b))).toEqual(['Lot 1 2', 'Lot 2 2']);
  });

  it('marché à commande : deux quantités, minimum et maximum', () => {
    monter({ typeMarche: 'A_COMMANDE' });
    ouvrir([{ idArticle: 1, lot: 1, ordre: 1, designation: 'Carburant', unite: 'L', quantiteMin: 1000, quantiteMax: 5000, caracteristiques: [] }]);
    expect(Array.from(racine().querySelectorAll('thead th')).map((th) => texte(th)))
      .toEqual(['N°', 'Désignation', 'Unité', 'Quantité min.', 'Quantité max.', 'Actions']);
    bouton('Enregistrer le lot 1').click();
    const put = http.expectOne((r) => r.url === '/api/fiches-marche/42/articles' && r.params.get('lot') === '1');
    expect(put.request.body).toEqual({
      articles: [{ lot: 1, designation: 'Carburant', unite: 'L', quantiteMin: 1000, quantiteMax: 5000, quantite: null, caracteristiques: [] }],
    });
    put.flush([{ idArticle: 1, lot: 1, ordre: 1, designation: 'Carburant', unite: 'L', quantiteMin: 1000, quantiteMax: 5000, caracteristiques: [] }]);
  });

  it('« Dupliquer depuis le lot n » : les lots répétés se recopient, sans reprendre les identifiants', () => {
    monter({ nbLots: 3 });
    ouvrir(ARTICLES);
    bouton('Lot 3').click();
    rendre();
    // Un lot vide propose la copie des lots déjà garnis — le dossier réel 2463 répète ses lots 2 et 3.
    expect(texte(racine().querySelector('.bs__copie'))).toContain('Ce lot est vide.');
    expect(Array.from(racine().querySelectorAll('.bs__copie button')).map((b) => texte(b)))
      .toEqual(['Dupliquer depuis le lot 1', 'Dupliquer depuis le lot 2']);

    bouton('Dupliquer depuis le lot 1').click();
    rendre();
    expect(lignes().map((l) => saisie(l).value)).toEqual(['Ordinateur portable', 'Imprimante laser']);
    expect(toast.info).toHaveBeenCalledWith("2 article(s) repris du lot 1 — à ajuster avant d'enregistrer.");

    bouton('Enregistrer le lot 3').click();
    const put = http.expectOne((r) => r.url === '/api/fiches-marche/42/articles' && r.params.get('lot') === '3');
    const envoyes = (put.request.body as { articles: (ArticleFiche & { idArticle?: number })[] }).articles;
    // ⚠️ Ce sont de NOUVEAUX articles : sans cela le serveur déplacerait ceux du lot 1.
    expect(envoyes.every((a) => a.idArticle === undefined)).toBe(true);
    expect(envoyes[0].lot).toBe(3);
    expect(envoyes[0].caracteristiques.map((c) => c.libelle)).toEqual(['Mémoire vive', 'Disque']);
    put.flush(envoyes.map((a, i) => ({ ...a, idArticle: 10 + i, ordre: i + 1 })));
  });

  it('400 nominatifs : le message sous le champ visé, sans toast d’erreur en plus', () => {
    monter();
    ouvrir(ARTICLES);
    ecrire(saisie(lignes()[0]), '');
    rendre();
    bouton('Enregistrer le lot 1').click();
    http.expectOne((r) => r.url === '/api/fiches-marche/42/articles').flush(
      [{ champ: 'articles[0].designation', message: 'La désignation est obligatoire.' }],
      { status: 400, statusText: 'Bad Request' },
    );
    rendre();
    expect(texte(racine().querySelector('tbody tr.bs__ko .form-error'))).toBe('La désignation est obligatoire.');
    expect(toast.error).not.toHaveBeenCalled();

    // Changer de lot repart d'une grille propre : une erreur ne colle pas au rang d'un autre lot.
    bouton('Lot 2').click();
    rendre();
    expect(racine().querySelector('.form-error')).toBeNull();
  });

  it('lecture (Commission, ou fiche figée) : la grille se lit, aucun geste d’écriture', () => {
    monter({ lecture: true });
    ouvrir(ARTICLES);
    expect(racine().querySelector('input')).toBeNull();
    expect(Array.from(racine().querySelectorAll('tbody tr:not(.bs__carac) .bs__lu')).map((s) => texte(s)))
      .toEqual(['Ordinateur portable', 'U', '12', 'Imprimante laser', 'U', '3']);
    const libelles = Array.from(racine().querySelectorAll('button')).map((b) => texte(b));
    expect(libelles.some((l) => l.startsWith('Enregistrer') || l.startsWith('+ Article') || l.startsWith('Dupliquer'))).toBe(false);
    // Les exigences se lisent elles aussi, une fois dépliées.
    bouton('▸ 2 caractéristique(s)').click();
    rendre();
    expect(texte(racine().querySelector('.bs__carac .bs__cl'))).toBe('Mémoire vive — 8 Go au minimum');
  });

  it('ligne non allotie : pas d’onglet, un seul besoin, envoyé sans paramètre de lot', () => {
    monter({ nbLots: 1, saisieParLot: false });
    ouvrir([{ idArticle: 1, lot: null, ordre: 1, designation: 'Groupe électrogène', unite: 'U', quantite: 2, caracteristiques: [] }]);
    expect(racine().querySelector('.bs__lots')).toBeNull();
    expect(texte(bouton('Enregistrer le besoin'))).toBe('Enregistrer le besoin');
    bouton('Enregistrer le besoin').click();
    const put = http.expectOne('/api/fiches-marche/42/articles');
    expect(put.request.params.has('lot')).toBe(false);
    expect((put.request.body as { articles: ArticleFiche[] }).articles[0].lot).toBeNull();
    put.flush([{ idArticle: 1, lot: null, ordre: 1, designation: 'Groupe électrogène', unite: 'U', quantite: 2, caracteristiques: [] }]);
    rendre();
    expect(toast.success).toHaveBeenCalledWith('Besoin enregistré.');
  });

  it('route pas encore servie (404) : grille vide et invitation, pas d’écran en erreur', () => {
    monter();
    ouvrir(null);
    expect(texte(racine().querySelector('.bs__etat'))).toContain('Aucun article au lot 1');
    expect(racine().querySelector('table')).toBeNull();
    bouton('+ Article').click();
    rendre();
    expect(lignes().length).toBe(1);
  });
});
