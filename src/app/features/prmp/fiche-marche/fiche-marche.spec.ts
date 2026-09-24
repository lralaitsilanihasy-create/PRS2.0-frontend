import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/notifications/toast.service';
import { DocumentFiche, FicheMarche, LigneEligible, ReferentielFiche, Role, VersionFiche } from '../../../models';
import { FicheMarcheEcran } from './fiche-marche';

/** Référentiel réduit servi par le serveur : B01 (PPM), B02 et B05 — une rubrique conditionnée (GS), un champ PPM. */
const REFERENTIEL: ReferentielFiche = {
  blocs: [
    { code: 'B01', libelle: 'Identification & données du PPM', rang: 1, rubriques: [{ code: 'AC', libelle: 'Acheteur', rang: 1 }] },
    { code: 'B02', libelle: 'Objet, allotissement & forme du marché', rang: 2, rubriques: [{ code: 'OB', libelle: 'Objet', rang: 1, documentMaitre: 'DPAO' }] },
    {
      code: 'B05',
      libelle: 'Prix, montants & garantie de soumission',
      rang: 5,
      rubriques: [
        { code: 'MO', libelle: 'Monnaie', rang: 3, documentMaitre: 'DPAO' },
        { code: 'GS', libelle: 'Garantie de soumission', rang: 4, documentMaitre: 'DPAO' },
      ],
    },
  ],
  champs: [
    { code: 'B01-AC-01', bloc: 'B01', rubrique: 'AC', rang: 1, libelle: 'Autorité contractante', type: 'TEXTE', source: 'PPM', documentMaitre: 'DPAO', reprises: ['AE', 'CCAP'], typesMarche: ['QUANTITE_FIXE'], obligatoire: true },
    { code: 'B02-OB-01', bloc: 'B02', rubrique: 'OB', rang: 1, libelle: 'Objet de l’appel d’offres', type: 'TEXTE_LONG', source: 'SAISIE', documentMaitre: 'DPAO', reprises: ['AE'], typesMarche: ['QUANTITE_FIXE'], obligatoire: true },
    { code: 'B05-MO-01', bloc: 'B05', rubrique: 'MO', rang: 1, libelle: 'Monnaie de l’offre', type: 'LISTE', options: ['Ariary', 'Euro'], source: 'SAISIE', documentMaitre: 'DPAO', reprises: [], typesMarche: ['QUANTITE_FIXE'], obligatoire: true },
    { code: 'B05-GS-01', bloc: 'B05', rubrique: 'GS', rang: 1, libelle: 'Garantie de soumission exigée', type: 'OUI_NON', source: 'CADRAGE', cleCadrage: 'garantieSoumission', documentMaitre: 'DPAO', reprises: ['AE'], typesMarche: ['QUANTITE_FIXE'], obligatoire: false, condition: 'garantieSoumission = OUI' },
    { code: 'B05-GS-02', bloc: 'B05', rubrique: 'GS', rang: 2, libelle: 'Montant de la garantie', type: 'MONTANT', source: 'SAISIE', documentMaitre: 'DPAO', reprises: ['AE', 'CCAP'], typesMarche: ['QUANTITE_FIXE'], obligatoire: true, condition: 'garantieSoumission = OUI', controle: 'entre 1 et 2 % du montant estimatif' },
  ],
};

/** Référentiel augmenté du champ PPM qui porte le nombre de lots du plan (clé `NB_LOTS_PPM`). */
const REF_AVEC_LOTS: ReferentielFiche = {
  ...REFERENTIEL,
  champs: [
    ...REFERENTIEL.champs,
    { code: 'B02-LV-01', bloc: 'B02', rubrique: 'LV', rang: 1, libelle: 'Nombre de lots du plan', type: 'TEXTE', source: 'PPM', clePpm: 'NB_LOTS_PPM', documentMaitre: 'DPAO', reprises: ['AE'], typesMarche: ['QUANTITE_FIXE'], obligatoire: false },
  ],
};

// ⚠️ Lot 1c — le type de marché n'est plus une réponse de cadrage : il vient de la forme du marché de la ligne du plan.
const CADRAGE_COMPLET = {
  alloti: 'NON', variantes: 'NON', groupement: 'NON', provenance: 'NATIONAL', typePrix: 'UNITAIRES',
  prixRevisable: 'NON', garantieSoumission: 'OUI', avance: 'NON', penalites: 'CCAG',
};

function fiche(partiel: Partial<FicheMarche> = {}): FicheMarche {
  return {
    idDmc: 42,
    idDetail: 7,
    idDossier: 3,
    refeDossier: 'PPM-2026-003',
    designationMarche: 'Fourniture de mobilier',
    typeMarche: 'QUANTITE_FIXE',
    categorie: 'FOURNITURES_SERVICES',
    statut: 'BROUILLON',
    version: 1,
    cadrage: { ...CADRAGE_COMPLET },
    valeurs: { 'B02-OB-01': 'Mobilier de bureau' },
    valeursPpm: { 'B01-AC-01': 'Ministère de l’Économie et des Finances' },
    valeursCadrage: { 'B05-GS-01': 'OUI' },
    enLettres: null,
    bilanControles: null,
    ...partiel,
  };
}

const LIGNES: LigneEligible[] = [
  { idDetail: 7, idDossier: 3, refeDossier: 'PPM-2026-003', designationMarche: 'Fourniture de mobilier', idMode: 1, libelleMode: 'Appel d’offres ouvert', montEstim: 420000000, dejaDao: false, formeMarche: 'QUANTITE_FIXE', formeOutillee: true, categorie: 'FOURNITURES_SERVICES', categorieOutillee: true },
  { idDetail: 9, idDossier: 3, refeDossier: 'PPM-2026-003', designationMarche: 'Véhicules', idMode: 1, libelleMode: 'Appel d’offres ouvert', montEstim: 90000000, dejaDao: true, idDmc: 42, formeMarche: 'QUANTITE_FIXE', formeOutillee: true, categorie: 'FOURNITURES_SERVICES', categorieOutillee: true },
  // Lot 1c : forme contrat-cadre — la ligne se voit, mais ne se prépare pas encore.
  { idDetail: 11, idDossier: 3, refeDossier: 'PPM-2026-003', designationMarche: 'Pneus (CONTRAT CADRE)', idMode: 1, libelleMode: 'Appel d’offres ouvert', montEstim: 50000000, dejaDao: false, formeMarche: 'CONTRAT_CADRE', formeOutillee: false, categorie: 'FOURNITURES_SERVICES', categorieOutillee: true },
];

describe('Fiche DAO d’un appel d’offres (proposition DMC du 22/09, lot 1)', () => {
  let fixture: ComponentFixture<FicheMarcheEcran>;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  /** Cellules d'une ligne jointes par un espace (Angular retire les blancs entre `<td>`). */
  const cellules = (tr: Element): string => Array.from(tr.querySelectorAll('td')).map((td) => texte(td)).join(' ');
  const rendre = (): void => fixture.detectChanges();
  const bouton = (libelle: string): HTMLButtonElement => {
    const b = Array.from(racine().querySelectorAll('button')).find((x) => texte(x).startsWith(libelle));
    if (!b) throw new Error(`Bouton « ${libelle} » introuvable`);
    return b;
  };

  function monter(role: Role, idDmc: number | null, query: Record<string, string> = {}): void {
    toast = { success: vi.fn(), error: vi.fn() };
    params = new BehaviorSubject(convertToParamMap(idDmc == null ? {} : { idDmc: String(idDmc) }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable(), queryParamMap: new BehaviorSubject(convertToParamMap(query)).asObservable(), snapshot: { data: {} } } },
        { provide: AuthService, useValue: { role: signal(role) } },
        { provide: ToastService, useValue: toast },
      ],
    });
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.inject(Router).navigate = navigate as unknown as Router['navigate'];
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FicheMarcheEcran);
    rendre();
  }

  /**
   * Répond à la vague d'ouverture d'une fiche : fiche (`null` = 404), puis référentiel, versions et documents.
   * ⚠️ Lot 4 — le référentiel suit le TYPE DE LA FICHE, il n'est donc demandé qu'une fois la fiche lue ;
   * `typeMarcheAttendu` vérifie que c'est bien celui-là qui est demandé.
   */
  function ouvrir(ref: ReferentielFiche | null, f: FicheMarche | null, versions: VersionFiche[] | null = [], docs: DocumentFiche[] | null = null): void {
    const q = http.expectOne('/api/fiches-marche/42');
    if (f) q.flush(f);
    else q.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    const typeAttendu = f?.typeMarche ?? 'QUANTITE_FIXE';
    const r = http.expectOne((x) => x.url === '/api/champs-fiche-marche' && x.params.get('typeMarche') === typeAttendu);
    if (ref) r.flush(ref);
    else r.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    const v = http.expectOne('/api/fiches-marche/42/versions');
    if (versions) v.flush(versions);
    else v.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    // ⚠️ Lot 2 — l'écran demande les documents dès le chargement ; `null` = route pas encore servie (repli).
    const d = http.expectOne('/api/fiches-marche/42/documents');
    if (docs) d.flush(docs);
    else d.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    rendre();
  }

  afterEach(() => http.verify());

  it('choix de la ligne : lignes éligibles, « Préparer » crée le DMC puis ouvre la fiche, « Reprendre » ouvre l’existante', () => {
    monter('PRMP', null);
    http.expectOne('/api/dmcs/eligibles').flush(LIGNES);
    rendre();
    const lignes = Array.from(racine().querySelectorAll('tbody tr'));
    expect(lignes.length).toBe(3);
    // La forme du marché est montrée avec le mode : c'est elle qui donne le type de la fiche.
    // ⚠️ Lot 5 — la colonne porte la catégorie PUIS la forme, les deux venant du plan.
    expect(Array.from(racine().querySelectorAll('.fm__forme')).map((e) => texte(e)))
      .toEqual(['Fournitures et services', 'Quantité fixe', 'Fournitures et services', 'Quantité fixe', 'Fournitures et services', 'Contrat-cadre']);
    const bloquee = lignes[2].querySelector('button') as HTMLButtonElement;
    expect(texte(bloquee)).toBe('Pas encore pris en charge');
    expect(bloquee.disabled).toBe(true);
    expect(texte(lignes[0])).toContain('Fourniture de mobilier');
    expect(texte(lignes[0])).toContain('420 000 000 Ar');
    expect(racine().querySelector('.alert')).toBeNull();

    bouton('Reprendre la fiche').click();
    expect(navigate).toHaveBeenCalledWith(['/prmp/dao', 42]);

    bouton('Préparer l’appel d’offres').click();
    const post = http.expectOne('/api/dmcs/par-marche/7');
    expect(post.request.method).toBe('POST');
    post.flush({ idDmc: 51, idDetail: 7, idTypeDmc: 1, statut: 'A_PREPARER' });
    expect(navigate).toHaveBeenLastCalledWith(['/prmp/dao', 51]);
  });

  it('raccourci H3 : ?dossier= restreint la liste à ce PPM ; ?ligne= ouvre la ligne d’emblée (création puis navigation)', () => {
    monter('PRMP', null, { dossier: '3' });
    http.expectOne('/api/dmcs/eligibles').flush([...LIGNES, { ...LIGNES[0], idDetail: 30, idDossier: 8, refeDossier: 'PPM-2026-008', designationMarche: 'Autre PPM' }]);
    rendre();
    expect(racine().querySelectorAll('tbody tr').length).toBe(3);
    expect(texte(racine().querySelector('.fm__filtre'))).toContain('Lignes du plan de passation PPM-2026-003');
    expect((racine().querySelector('.fm__filtre a') as HTMLAnchorElement).getAttribute('href')).toBe('/prmp/dao');
    TestBed.resetTestingModule();

    monter('UGPM', null, { ligne: '7' });
    http.expectOne('/api/dmcs/eligibles').flush(LIGNES);
    const post = http.expectOne('/api/dmcs/par-marche/7');
    post.flush({ idDmc: 51, idDetail: 7, idTypeDmc: 1, statut: 'A_PREPARER' });
    expect(navigate).toHaveBeenCalledWith(['/prmp/dao', 51]);
    TestBed.resetTestingModule();

    // Ligne demandée absente des éligibles : la liste s'affiche, rien n'est créé.
    monter('UGPM', null, { ligne: '999' });
    http.expectOne('/api/dmcs/eligibles').flush(LIGNES);
    rendre();
    expect(navigate).not.toHaveBeenCalled();
    expect(racine().querySelectorAll('tbody tr').length).toBe(3);
  });

  it('forme non prise en charge : page courte — la ligne se lit, aucun formulaire inutile n’est déroulé', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ typeMarche: 'CONTRAT_CADRE', cadrage: {}, valeurs: {} }));
    // ⚠️ 23/09 — le bandeau ne réclame AUCUNE correction : la ligne est bien un contrat-cadre, c'est l'outil qui manque.
    const bandeau = texte(racine().querySelector('.alert-warning'));
    expect(bandeau).toContain('la ligne du plan de passation est bien de ce type');
    expect(bandeau).not.toContain('corrigez');
    // Ni cadrage, ni blocs, ni rail : rien ne sera enregistré, rien n'est demandé.
    expect(racine().querySelectorAll('.fm__q').length).toBe(0);
    expect(racine().querySelector('.fm__rail')).toBeNull();
    expect(Array.from(racine().querySelectorAll('button')).some((b) => texte(b).startsWith('Enregistrer'))).toBe(false);
    // Les informations de la ligne restent lisibles, dépliées.
    expect(texte(racine().querySelector('.fm__ppm'))).toContain('Ministère de l’Économie et des Finances');
    expect((racine().querySelector('.fm__ppm') as HTMLDetailsElement).open).toBe(true);
    expect(texte(racine().querySelector('.fm__attente'))).toContain('hors de l’application');
    // La phrase de rôle promet une saisie et des documents : elle se tait ici.
    expect(racine().querySelector('.page-role')).toBeNull();
  });

  it('c’est le SERVEUR qui dit ce qu’il outille : typeOutille prime sur la liste du front (lot 3 §B2)', () => {
    monter('PRMP', 42);
    // Le jour où le backend ouvre le marché à commande, l'écran suit sans livraison de son côté.
    ouvrir(REFERENTIEL, fiche({ typeMarche: 'A_COMMANDE', typeOutille: true, cadrage: {}, valeurs: {} }));
    expect(racine().querySelector('.fm__attente')).toBeNull();
    expect(racine().querySelector('.fm__rail')).not.toBeNull();
    expect(racine().querySelectorAll('.fm__q').length).toBe(9);
    TestBed.resetTestingModule();

    // Et inversement : un type que le front croit outillé mais que le serveur refuse reste en page courte.
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ typeMarche: 'QUANTITE_FIXE', typeOutille: false, cadrage: {}, valeurs: {} }));
    expect(racine().querySelector('.fm__attente')).not.toBeNull();
    expect(racine().querySelector('.fm__rail')).toBeNull();
  });

  it('catégorie non outillée : c’est ELLE qui est nommée, pas la forme — elle emporte tout le référentiel (lot 5)', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ categorie: 'TRAVAUX', typeOutille: false, typeMarche: 'QUANTITE_FIXE', cadrage: {}, valeurs: {} }));
    const bandeau = texte(racine().querySelector('.alert-warning'));
    expect(bandeau).toContain('catégorie « Travaux et réhabilitation »');
    expect(bandeau).toContain('fournitures et services');
    expect(bandeau).not.toContain('corrigez');
    expect(texte(racine().querySelector('.fm__attente'))).toContain('travaux et réhabilitation');
    expect(racine().querySelector('.fm__rail')).toBeNull();
  });

  it('nature absente ou non classée : là, il y a quelque chose à corriger (lot 5)', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ categorie: null, typeOutille: false, typeMarche: 'QUANTITE_FIXE', cadrage: {}, valeurs: {} }));
    const bandeau = texte(racine().querySelector('.alert-warning'));
    expect(bandeau).toContain('Nature absente ou non classée');
    expect(bandeau).toContain('Complétez');
    expect(texte(racine().querySelector('.fm__attente'))).toContain('rattacher cette nature');
  });

  it('le référentiel se demande sur les DEUX axes : type ET catégorie (lot 5)', () => {
    monter('PRMP', 42);
    const q = http.expectOne('/api/fiches-marche/42');
    q.flush(fiche({ typeMarche: 'A_COMMANDE', typeOutille: true, categorie: 'FOURNITURES_SERVICES' }));
    const r = http.expectOne((x) => x.url === '/api/champs-fiche-marche'
      && x.params.get('typeMarche') === 'A_COMMANDE' && x.params.get('categorie') === 'FOURNITURES_SERVICES');
    r.flush(REFERENTIEL);
    http.expectOne('/api/fiches-marche/42/versions').flush([]);
    http.expectOne('/api/fiches-marche/42/documents').flush([]);
    rendre();
    expect(racine().querySelector('.fm__rail')).not.toBeNull();
  });

  it('travaux : « le marché comporte-t-il des tranches ? » s’ajoute au cadrage (lot 5)', () => {
    monter('PRMP', 42);
    // Catégorie outillée côté serveur (typeOutille vrai) pour voir le cadrage, mais de catégorie TRAVAUX.
    ouvrir(REFERENTIEL, fiche({ categorie: 'TRAVAUX', typeOutille: true, typeMarche: 'QUANTITE_FIXE', cadrage: {}, valeurs: {} }));
    expect(racine().querySelector('input[name="q-tranches"]')).not.toBeNull();
    (racine().querySelector('input[name="q-tranches"][value="OUI"]') as HTMLInputElement).click();
    rendre();
    expect(fixture.componentInstance.cadrage()['tranches']).toBe('OUI');
    // La réponse tient : l'élagage juge sur le cadrage effectif, catégorie comprise.
    (racine().querySelector('input[name="q-variantes"][value="NON"]') as HTMLInputElement).click();
    rendre();
    expect(fixture.componentInstance.cadrage()['tranches']).toBe('OUI');
  });

  it('fournitures : la question des tranches n’est pas posée', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ cadrage: {}, valeurs: {} }));
    expect(racine().querySelector('input[name="q-tranches"]')).toBeNull();
  });

  it('forme du marché ABSENTE de la ligne : là, il y a quelque chose à corriger, et on le dit', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ typeMarche: null, cadrage: {}, valeurs: {} }));
    const bandeau = texte(racine().querySelector('.alert-warning'));
    expect(bandeau).toContain('Forme du marché absente de cette ligne du plan');
    expect(bandeau).toContain('Complétez');
    expect(texte(racine().querySelector('.fm__attente'))).toContain('Complétez-la dans le plan de passation');
  });

  it('version FIGÉE sous un autre type que celui du plan aujourd’hui : constat d’enregistrement, sans injonction', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ statut: 'VALIDEE', version: 1, typeMarche: 'CONTRAT_CADRE', typeChange: true, cadrage: {}, valeurs: {} }));
    const bandeaux = Array.from(racine().querySelectorAll('.alert-warning')).map((e) => texte(e)).join(' ');
    expect(bandeaux).toContain('validée sous un autre type de marché');
    expect(bandeaux).toContain('une nouvelle version repartira du type du plan');
    expect(bandeaux).not.toContain('reprenez-la depuis la ligne du plan');
  });

  it('BROUILLON : le type vient du plan, il n’y a donc rien à signaler', () => {
    monter('PRMP', 42);
    // ⚠️ Demande du pilote (23/09) : « le type de marché doit être du plan de passation de marché ».
    // Un brouillon est toujours du type du plan ; le type sous lequel il a commencé n'intéresse personne.
    ouvrir(REFERENTIEL, fiche({ typeMarche: 'CONTRAT_CADRE', typeChange: true, cadrage: {}, valeurs: {} }));
    const bandeaux = Array.from(racine().querySelectorAll('.alert-warning')).map((e) => texte(e)).join(' ');
    expect(bandeaux).not.toContain('autre type de marché');
    // Le bandeau qui compte reste là : cette forme n'est pas encore prise en charge.
    expect(bandeaux).toContain('Marché contrat-cadre');
  });
  it('contrat absent : bandeau « en attente du backend », aucune ligne — 400 compris (« eligibles » pris pour un id par l’existant)', () => {
    monter('PRMP', null);
    http.expectOne('/api/dmcs/eligibles').flush({ message: 'Failed to convert "eligibles"' }, { status: 400, statusText: 'Bad Request' });
    rendre();
    expect(texte(racine().querySelector('.alert'))).toContain('Contrat en attente du backend');
    expect(texte(racine().querySelector('.fm__vide'))).toContain('Aucune ligne');
    expect(racine().querySelector('app-etat-erreur')).toBeNull();
  });

  it('panne réelle (500) : état d’erreur avec « Réessayer », pas le bandeau de repli', () => {
    monter('PRMP', null);
    http.expectOne('/api/dmcs/eligibles').flush({}, { status: 500, statusText: 'Server Error' });
    rendre();
    expect(racine().querySelector('.alert')).toBeNull();
    expect(racine().querySelector('app-etat-erreur')).not.toBeNull();
    fixture.componentInstance.charger();
    http.expectOne('/api/dmcs/eligibles').flush(LIGNES);
    rendre();
    expect(racine().querySelectorAll('tbody tr').length).toBe(3);
  });

  it('fiche sans contrat : structure de l’esquisse (8 blocs à saisir, comptes attendus), cadrage ouvert mais non enregistrable', () => {
    monter('PRMP', 42);
    ouvrir(null, null, null);
    expect(texte(racine().querySelector('.alert'))).toContain('Contrat en attente du backend');
    expect(racine().querySelector('.fm__etape--courante .fm__etape-t')?.textContent).toBe('Cadrage');
    expect(texte(racine().querySelector('.fm__etape:nth-child(3) .fm__etape-s'))).toBe('8 blocs');
    expect(texte(racine().querySelector('.fm__total'))).toContain('0 sur 158');
    // Le cadrage se remplit ; le bouton reste désactivé tant que le serveur ne sert pas le contrat.
    for (const [cle, val] of Object.entries(CADRAGE_COMPLET)) {
      (racine().querySelector(`input[name="q-${cle}"][value="${val}"]`) as HTMLInputElement).click();
    }
    rendre();
    expect(fixture.componentInstance.cadrageOk()).toBe(true);
    expect(bouton('Enregistrer le cadrage').disabled).toBe(true);
  });

  it('allotissement : un lot au plan ⇒ « Non » imposé et verrouillé, la réponse part avec le cadrage', () => {
    monter('PRMP', 42);
    ouvrir(REF_AVEC_LOTS, fiche({ cadrage: {}, valeurs: {}, valeursPpm: { 'B02-LV-01': '1' } }));
    const alloti = Array.from(racine().querySelectorAll('input[name="q-alloti"]')) as HTMLInputElement[];
    expect(alloti.find((i) => i.value === 'NON')?.checked).toBe(true);
    expect(alloti.every((i) => i.disabled)).toBe(true);
    expect(texte(racine().querySelector('.fm__q-plan'))).toBe('repris du plan de passation');
    expect(texte(racine().querySelector('.fm__q--plan .fm__q-aide'))).toContain('annonce 1 lot ');
    // Un clic sur « Oui » ne change rien : la correction se fait dans le plan.
    alloti.find((i) => i.value === 'OUI')?.click();
    rendre();
    expect(fixture.componentInstance.cadrage()['alloti']).toBe('NON');
    // Pas de lot à saisir, donc pas de complément.
    expect(racine().querySelector('.fm__q-comp')).toBeNull();
  });

  it('allotissement : quatre lots au plan ⇒ « Oui » imposé, le nombre vient du plan et ne se saisit pas', () => {
    monter('PRMP', 42);
    ouvrir(REF_AVEC_LOTS, fiche({ cadrage: {}, valeurs: {}, valeursPpm: { 'B02-LV-01': '4' } }));
    const alloti = Array.from(racine().querySelectorAll('input[name="q-alloti"]')) as HTMLInputElement[];
    expect(alloti.find((i) => i.value === 'OUI')?.checked).toBe(true);
    expect(alloti.every((i) => i.disabled)).toBe(true);
    const nb = racine().querySelector('.fm__q-comp input') as HTMLInputElement;
    expect(nb.value).toBe('4');
    expect(nb.disabled).toBe(true);
    expect(fixture.componentInstance.cadrage()['nbLots']).toBe(4);
  });

  it('allotissement : le cadrage enregistré contredit le plan — la réponse du plan s’affiche, et on le dit', () => {
    monter('PRMP', 42);
    ouvrir(REF_AVEC_LOTS, fiche({ cadrage: { alloti: 'NON' }, valeurs: {}, valeursPpm: { 'B02-LV-01': '4' } }));
    expect(texte(racine().querySelector('.alert-warning'))).toContain('ne correspond plus au plan de passation');
    expect((racine().querySelector('input[name="q-alloti"][value="OUI"]') as HTMLInputElement).checked).toBe(true);
  });

  it('allotissement : une fiche VALIDÉE garde ce qui a été figé, le plan ne la réécrit pas', () => {
    monter('PRMP', 42);
    ouvrir(REF_AVEC_LOTS, fiche({ statut: 'VALIDEE', version: 1, cadrage: { ...CADRAGE_COMPLET, alloti: 'NON' }, valeurs: {}, valeursPpm: { 'B02-LV-01': '4' } }));
    fixture.componentInstance.allerA(1);
    rendre();
    expect(fixture.componentInstance.cadrage()['alloti']).toBe('NON');
    expect(racine().querySelector('.alert-warning')).toBeNull();
    expect(racine().querySelector('.fm__q-plan')).toBeNull();
  });

  it('allotissement : plan muet sur le nombre de lots ⇒ la question reste posée et modifiable', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ cadrage: {}, valeurs: {} }));
    const alloti = Array.from(racine().querySelectorAll('input[name="q-alloti"]')) as HTMLInputElement[];
    expect(alloti.some((i) => i.disabled)).toBe(false);
    expect(racine().querySelector('.fm__q-plan')).toBeNull();
  });

  it('écriture refusée : l’écran ne réclame aucun geste impossible', () => {
    monter('PRMP', 42);
    // Contrat absent : le cadrage s'affiche (il n'est pas vain, le serveur servira le contrat), mais le pied dit
    // pourquoi rien ne s'enregistre — et ne blâme pas les réponses manquantes.
    ouvrir(null, null, null);
    const pied = texte(racine().querySelector('.fm__aut'));
    expect(pied).toContain('ne sert pas encore le contrat');
    expect(pied).not.toContain('Répondez à toutes les questions');
  });

  it('cadrage d’un contrat-cadre : « mono ou multi-attributaire » se répond, et la réponse tient (lot 4)', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ typeMarche: 'CONTRAT_CADRE', typeOutille: true, cadrage: {}, valeurs: {} }));
    // ⚠️ La question est conditionnée au TYPE, qui a quitté le cadrage au lot 1c : l'élagage des réponses devenues
    // sans objet doit se juger sur le cadrage effectif, sinon la réponse est effacée à l'instant même où on la donne.
    (racine().querySelector('input[name="q-attributaires"][value="MULTI"]') as HTMLInputElement).click();
    rendre();
    expect(fixture.componentInstance.cadrage()['attributaires']).toBe('MULTI');
    // Une réponse suivante ne l'emporte pas non plus.
    (racine().querySelector('input[name="q-variantes"][value="NON"]') as HTMLInputElement).click();
    rendre();
    expect(fixture.componentInstance.cadrage()['attributaires']).toBe('MULTI');
  });

  it('cadrage : « forme du groupement » apparaît avec groupement = OUI et repart avec NON ; l’enregistrement envoie les réponses', () => {
    monter('UGPM', 42);
    ouvrir(REFERENTIEL, fiche({ cadrage: {}, valeurs: {} }));
    expect(racine().querySelector('.fm__etape--courante .fm__etape-t')?.textContent).toBe('Cadrage');
    const cocher = (cle: string, val: string): void => {
      (racine().querySelector(`input[name="q-${cle}"][value="${val}"]`) as HTMLInputElement).click();
      rendre();
    };
    expect(racine().querySelector('input[name="q-formeGroupement"]')).toBeNull();
    cocher('groupement', 'OUI');
    expect(racine().querySelector('input[name="q-formeGroupement"]')).not.toBeNull();
    cocher('formeGroupement', 'SOLIDAIRE_OBLIGATOIRE');
    cocher('groupement', 'NON');
    expect(racine().querySelector('input[name="q-formeGroupement"]')).toBeNull();
    expect(fixture.componentInstance.cadrage()['formeGroupement']).toBeUndefined();
    // ⚠️ Lot 1c — plus aucune question de type : c'est la forme du marché de la ligne du plan qui décide.
    expect(racine().querySelector('input[name="q-typeMarche"]')).toBeNull();

    for (const [cle, val] of Object.entries(CADRAGE_COMPLET)) if (cle !== 'groupement') cocher(cle, val);
    cocher('alloti', 'OUI');
    expect(bouton('Enregistrer le cadrage').disabled).toBe(true); // nombre de lots manquant
    const nb = racine().querySelector('.fm__q-comp input') as HTMLInputElement;
    nb.value = '3';
    nb.dispatchEvent(new Event('input'));
    rendre();
    expect(bouton('Enregistrer le cadrage').disabled).toBe(false);

    bouton('Enregistrer le cadrage').click();
    const put = http.expectOne('/api/fiches-marche/42/cadrage');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ cadrage: { ...CADRAGE_COMPLET, alloti: 'OUI', nbLots: 3 } });
    // Le type n'est jamais renvoyé : le serveur le tient du plan, l'écran ne le lui apprend pas.
    expect((put.request.body as { cadrage: Record<string, unknown> }).cadrage['typeMarche']).toBeUndefined();
    put.flush(fiche({ cadrage: { ...CADRAGE_COMPLET, alloti: 'OUI', nbLots: 3 }, valeurs: {} }));
    rendre();
    expect(racine().querySelector('.fm__etape--courante .fm__etape-t')?.textContent).toBe('Saisie par bloc');
    expect(texte(racine().querySelector('.fm__cadrage'))).toContain('Alloti · 3 lots');
  });

  it('blocs : dessinés depuis le référentiel, rubrique fermée par le cadrage cachée, champ PPM en lecture, PUT du bloc avec les seules valeurs saisies', () => {
    monter('UGPM', 42);
    ouvrir(REFERENTIEL, fiche());
    // Cadrage complet → on entre directement dans les blocs ; B01 n'est pas un bloc à saisir.
    expect(texte(racine().querySelector('.fm__bloc-tete h2'))).toBe('Objet, allotissement & forme du marché');
    const zone = racine().querySelector('#c-B02-OB-01') as HTMLTextAreaElement;
    expect(zone.value).toBe('Mobilier de bureau');
    zone.value = 'Mobilier de bureau — 3 lots';
    zone.dispatchEvent(new Event('input'));
    bouton('Enregistrer et continuer').click();
    const put = http.expectOne('/api/fiches-marche/42/blocs/B02');
    expect(put.request.body).toEqual({ valeurs: { 'B02-OB-01': 'Mobilier de bureau — 3 lots' } });
    put.flush(fiche({ valeurs: { 'B02-OB-01': 'Mobilier de bureau — 3 lots' } }));
    rendre();

    // B05 : GS ouverte (garantieSoumission = OUI), le montant est un nombre, les reprises sont affichées.
    expect(texte(racine().querySelector('.fm__bloc-tete h2'))).toBe('Prix, montants & garantie de soumission');
    // Le reflet du cadrage montre le libellé de la réponse, pas son code (valeursCadrage servi par le serveur).
    expect(texte(racine().querySelector('#c-B05-GS-01'))).toBe('Oui');
    expect(Array.from(racine().querySelectorAll('.fm__rub h3')).map((h) => texte(h))).toEqual(['Monnaie DPAO', 'Garantie de soumission DPAO']);
    const montant = racine().querySelector('#c-B05-GS-02') as HTMLInputElement;
    montant.value = '8400000';
    montant.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.valeurs()['B05-GS-02']).toBe(8400000);
    // Les lettres viennent du serveur (`enLettres`, B3), jamais calculées côté client.
    expect(racine().querySelector('.fm__lettres')).toBeNull();
    bouton('Enregistrer et voir les reprises').click();
    http.expectOne('/api/fiches-marche/42/blocs/B05').flush(fiche({ valeurs: { 'B05-GS-02': 8400000 }, enLettres: { 'B05-GS-02': 'huit millions quatre cent mille ariary' } }));
    rendre();
    fixture.componentInstance.allerAuBloc('B05');
    rendre();
    expect(texte(racine().querySelector('.fm__lettres'))).toBe('huit millions quatre cent mille ariary');
    const meta = racine().querySelector('#c-B05-GS-02')?.closest('.fm__champ')?.querySelectorAll('.fm__meta > span');
    expect(Array.from(meta ?? []).map((s) => texte(s))).toEqual(['à saisir', 'DPAO', 'repris dans', 'AE', 'CCAP', 'condition : garantieSoumission = OUI']);
    expect(texte(racine().querySelector('.fm__total'))).toContain('1 sur 3');
  });

  it('bloc refusé (400 nominatifs) : le message sous chaque champ, un toast de comptage, aucun changement d’étape', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ cadrage: { ...CADRAGE_COMPLET, garantieSoumission: 'NON' } }));
    fixture.componentInstance.allerAuBloc('B05');
    rendre();
    // GS fermée : une seule rubrique, un seul champ.
    expect(Array.from(racine().querySelectorAll('.fm__rub h3')).map((h) => texte(h))).toEqual(['Monnaie DPAO']);
    expect(racine().querySelector('#c-B05-GS-02')).toBeNull();
    bouton('Enregistrer et voir les reprises').click();
    http.expectOne('/api/fiches-marche/42/blocs/B05').flush([{ champ: 'B05-MO-01', message: 'Obligatoire.' }], { status: 400, statusText: 'Bad Request' });
    rendre();
    expect(texte(racine().querySelector('.fm__champ--ko .form-error'))).toBe('Obligatoire.');
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('1 champ(s) refusé(s)'));
    expect(racine().querySelector('.fm__etape--courante .fm__etape-t')?.textContent).toBe('Saisie par bloc');
    // La correction efface l'erreur du champ.
    const sel = racine().querySelector('#c-B05-MO-01') as HTMLSelectElement;
    sel.value = 'Ariary';
    sel.dispatchEvent(new Event('change'));
    rendre();
    expect(racine().querySelector('.fm__champ--ko')).toBeNull();
  });

  it('contrôles puis validation : un bloquant interdit de valider ; la PRMP valide (fige, versionne) ; l’UGPM ne voit pas le bouton', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche());
    fixture.componentInstance.etape.set(3);
    rendre();
    expect(texte(racine().querySelector('.fm__bloc-tete h2'))).toBe('Reprises');
    expect(Array.from(racine().querySelectorAll('.fm__champ-t')).map((e) => texte(e))).toEqual(['Autorité contractante', 'Objet de l’appel d’offres', 'Garantie de soumission exigée', 'Montant de la garantie']);
    // La reprise d'un reflet du cadrage montre le libellé de la réponse.
    expect(Array.from(racine().querySelectorAll('.fm__lecture')).map((e) => texte(e))[2]).toBe('Oui');
    bouton('Contrôler').click();
    http.expectOne('/api/fiches-marche/42/controler').flush({
      bloquants: [
        { regle: 'GS-01', champs: ['B05-GS-02'], bloc: 'B05', message: 'Montant de la garantie manquant.' },
        // Une information obligatoire vide n’est pas une anomalie : elle se compte par bloc, jamais ligne à ligne.
        { regle: 'OBLIGATOIRE', champs: ['B02-OB-01'], bloc: 'B02', message: '« Objet » est obligatoire.' },
        { regle: 'OBLIGATOIRE', champs: ['B05-MO-01'], bloc: 'B05', message: '« Monnaie » est obligatoire.' },
        { regle: 'OBLIGATOIRE', champs: ['B05-GS-01'], bloc: 'B05', message: '« Forme » est obligatoire.' },
      ],
      avertissements: [{ regle: 'OB-02', champs: ['B02-OB-01'], bloc: 'B02', message: 'Objet très court.' }],
      ok: [],
      nbSaisis: 1,
      nbAttendus: 4,
    });
    rendre();
    expect(texte(racine().querySelector('.fm__ctrl--r'))).toContain('3 information(s) obligatoire(s) restent à saisir');
    expect(Array.from(racine().querySelectorAll('.fm__ctrl--sous')).map((e) => texte(e))).toEqual([
      'B02 1 information(s) saisir', 'B05 2 information(s) saisir',
    ]);
    // L'anomalie de cohérence, elle, se lit en toutes lettres avec sa règle.
    expect(texte(Array.from(racine().querySelectorAll('.fm__ctrl--r')).at(-1))).toContain('Montant de la garantie manquant');
    expect(bouton('Passer à la validation').disabled).toBe(true);
    // Panneau latéral : une seule anomalie et un seul avertissement listés, les obligatoires comptés à part.
    expect(racine().querySelectorAll('.fm__ctrls li').length).toBe(2);
    expect(texte(racine().querySelector('.fm__ctrls .fm__ctrls-vide'))).toBe('3 information(s) obligatoire(s) restent à saisir — B02, B05.');

    // Le bloquant levé côté serveur : recontrôle, puis validation.
    bouton('Recontrôler').click();
    http.expectOne('/api/fiches-marche/42/controler').flush({ bloquants: [], avertissements: [], ok: [], nbSaisis: 4, nbAttendus: 4 });
    rendre();
    expect(texte(racine().querySelector('.fm__ok'))).toContain('peut être validée');
    bouton('Passer à la validation').click();
    rendre();
    bouton('Valider la fiche').click();
    const post = http.expectOne('/api/fiches-marche/42/valider');
    expect(post.request.method).toBe('POST');
    post.flush(fiche({ statut: 'VALIDEE', version: 1, dateValidation: '2026-09-22T10:05:00', validePar: 'PRMP001' }));
    // ⚠️ Lot 2 — la validation produit les documents : l'écran les relit pour les offrir sans recharger la page.
    http.expectOne('/api/fiches-marche/42/documents').flush([
      { idDocument: 11, type: 'DPAO', nomFichier: 'DPAO_PPM-2026-003_7_v1.docx', tailleOctets: 240000, dateGeneration: '2026-09-22T10:05:00', version: 1 },
      { idDocument: 12, type: 'AE', nomFichier: 'AE_PPM-2026-003_7_v1.docx', tailleOctets: 31000, dateGeneration: '2026-09-22T10:05:00', version: 1 },
    ] as DocumentFiche[]);
    rendre();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('version 1 figée'));
    expect(racine().querySelector('.fm__etape--courante .fm__etape-t')?.textContent).toBe('Documents');
    expect(texte(racine().querySelector('.page-subtitle'))).toContain('fiche validée, version 1');
    // La version figée rejoint l'historique de l'étape 6 sans relecture serveur (en-tête dérivé de la fiche).
    fixture.componentInstance.etape.set(5);
    rendre();
    expect(texte(racine().querySelector('.fm__ok'))).toContain('version 1 figée le 22/09/2026 10:05');
    expect(Array.from(racine().querySelectorAll('.fm__versions tbody tr')).map((tr) => cellules(tr))).toEqual(['1 22/09/2026 10:05 PRMP001 1 Documents']);
  });

  it('documents (lot 2) : listés sur une fiche validée, ouverts et enregistrés par le binaire du serveur', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ statut: 'VALIDEE', version: 2, dateValidation: '2026-09-22T10:05:00', validePar: 'PRMP001' }), [], [
      { idDocument: 11, type: 'DPAO', libelle: 'Données particulières de l’appel d’offres', nomFichier: 'DPAO_PPM-2026-003_7_v2.docx', tailleOctets: 240000, version: 2 },
      // Sans libellé servi, le sigle sert de repli.
      { idDocument: 12, type: 'CCAP', nomFichier: 'CCAP_PPM-2026-003_7_v2.docx', tailleOctets: 900, version: 2 },
    ] as DocumentFiche[]);
    fixture.componentInstance.allerA(6);
    rendre();
    const lignes = Array.from(racine().querySelectorAll('.fm__docs li'));
    expect(lignes.length).toBe(2);
    expect(texte(lignes[0])).toContain('DPAO_PPM-2026-003_7_v2.docx');
    // Le serveur nomme ses documents ; le sigle ne sert que de repli.
    expect(texte(lignes[0])).toContain('Données particulières de l’appel d’offres');
    expect(texte(lignes[1])).toContain('CCAP');
    expect(texte(lignes[0])).toContain('234 ko');
    expect(texte(lignes[1])).toContain('1 ko');

    (lignes[0].querySelectorAll('button')[1] as HTMLButtonElement).click(); // Enregistrer
    const get = http.expectOne('/api/fiches-marche/documents/11/contenu');
    expect(get.request.method).toBe('GET');
    expect(get.request.responseType).toBe('blob');
    get.flush(new Blob(['x'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  });

  it('documents : route pas encore servie (404) — l’étape annonce ce qui viendra, sans erreur ni liste vide trompeuse', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ statut: 'VALIDEE', version: 1 }), [], null);
    fixture.componentInstance.allerA(6);
    rendre();
    expect(racine().querySelector('.fm__docs')).toBeNull();
    expect(texte(racine().querySelector('#fm-docs')?.parentElement?.parentElement)).toContain('générés à la validation');
  });

  it('documents d’une version figée : « Documents » lit ceux de CETTE version, et sait dire qu’il n’y en a pas', () => {
    monter('PRMP', 42);
    ouvrir(REFERENTIEL, fiche({ statut: 'VALIDEE', version: 2 }), [
      { idFiche: 9, version: 2, statut: 'VALIDEE', typeMarche: 'QUANTITE_FIXE', dateValidation: '2026-09-22T16:30:00', validePar: 'PRMP001', nbValeurs: 130 },
      { idFiche: 8, version: 1, statut: 'VALIDEE', typeMarche: 'QUANTITE_FIXE', dateValidation: '2026-09-10T09:00:00', validePar: 'PRMP001', nbValeurs: 120 },
    ], []);
    fixture.componentInstance.allerA(5);
    rendre();
    const boutons = Array.from(racine().querySelectorAll('.fm__versions tbody button')) as HTMLButtonElement[];
    expect(boutons.length).toBe(2);

    boutons[1].click(); // la version 1, précédente
    const q = http.expectOne((r) => r.url === '/api/fiches-marche/42/documents' && r.params.get('version') === '1');
    q.flush([{ idDocument: 21, type: 'AE', libelle: 'Acte d’engagement', nomFichier: 'AE_PPM-2026-003_7_v1.pdf', tailleOctets: 2864, version: 1 }] as DocumentFiche[]);
    rendre();
    const bloc = racine().querySelector('.fm__versions-docs');
    expect(texte(bloc)).toContain('AE_PPM-2026-003_7_v1.pdf');
    expect(texte(bloc)).toContain('Acte d’engagement');

    // Un second clic referme, sans relire le serveur.
    (racine().querySelectorAll('.fm__versions tbody button')[1] as HTMLButtonElement).click();
    rendre();
    expect(racine().querySelector('.fm__versions-docs')).toBeNull();

    // Une version validée avant le lot 2 n'a pas de documents : on le dit, ce n'est pas une panne.
    (racine().querySelectorAll('.fm__versions tbody button')[0] as HTMLButtonElement).click();
    http.expectOne((r) => r.url === '/api/fiches-marche/42/documents' && r.params.get('version') === '2').flush([]);
    rendre();
    expect(texte(racine().querySelector('.fm__versions-docs'))).toContain('validée avant que la génération n’existe');
  });

  it('UGPM : la validation est réservée à la PRMP ; une fiche validée s’ouvre en lecture seule avec « nouvelle version »', () => {
    monter('UGPM', 42);
    // En-têtes de version tels que servis par `GET …/versions` (VersionFicheDto, livraison du 22/09), dans le désordre.
    const v1: VersionFiche = { idFiche: 5, version: 1, statut: 'VALIDEE', typeMarche: 'QUANTITE_FIXE', dateValidation: '2026-09-10T09:00:00', validePar: 'PRMP001', nbValeurs: 120 };
    const v2: VersionFiche = { idFiche: 9, version: 2, statut: 'VALIDEE', typeMarche: 'QUANTITE_FIXE', dateValidation: '2026-09-22T16:30:00', validePar: 'PRMP001', nbValeurs: 130 };
    ouvrir(REFERENTIEL, fiche({ statut: 'VALIDEE', version: 2, versionPpm: 3, idDetailCourant: 71, ligneSupprimee: true }), [v1, v2]);
    expect(racine().querySelector('.fm__etape--courante .fm__etape-t')?.textContent).toBe('Validation PRMP');
    // Historique des versions figées (B5), la plus récente en tête, la courante surlignée.
    const lignesV = Array.from(racine().querySelectorAll('.fm__versions tbody tr'));
    expect(lignesV.map((tr) => cellules(tr))).toEqual(['2 22/09/2026 16:30 PRMP001 130 Documents', '1 10/09/2026 09:00 PRMP001 120 Documents']);
    expect(lignesV[0].classList.contains('fm__versions--courante')).toBe(true);
    expect(lignesV[1].classList.contains('fm__versions--courante')).toBe(false);
    // Filiation (B2 §1) : la ligne est supprimée dans la version courante du PPM → avertissement, pas de blocage.
    expect(texte(racine().querySelector('.alert-warning'))).toContain('Ligne supprimée du plan de passation dans sa version courante (3)');
    expect(Array.from(racine().querySelectorAll('button')).some((b) => texte(b) === 'Valider la fiche')).toBe(false);
    bouton('Ouvrir une nouvelle version').click();
    http.expectOne('/api/fiches-marche/42/reviser').flush(fiche({ statut: 'BROUILLON', version: 3 }));
    rendre();
    expect(racine().querySelector('.fm__etape--courante .fm__etape-t')?.textContent).toBe('Saisie par bloc');
    expect(racine().querySelector('#c-B02-OB-01')).not.toBeNull(); // redevenu saisissable
  });
});
