import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/notifications/toast.service';
import { FicheMarche, LigneEligible, ReferentielFiche, Role, VersionFiche } from '../../../models';
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
    { code: 'B05-GS-01', bloc: 'B05', rubrique: 'GS', rang: 1, libelle: 'Forme de la garantie', type: 'LISTE', options: ['Caution', 'Chèque de banque'], source: 'SAISIE', documentMaitre: 'DPAO', reprises: [], typesMarche: ['QUANTITE_FIXE'], obligatoire: true, condition: 'garantieSoumission = OUI' },
    { code: 'B05-GS-02', bloc: 'B05', rubrique: 'GS', rang: 2, libelle: 'Montant de la garantie', type: 'MONTANT', source: 'SAISIE', documentMaitre: 'DPAO', reprises: ['AE', 'CCAP'], typesMarche: ['QUANTITE_FIXE'], obligatoire: true, condition: 'garantieSoumission = OUI', controle: 'entre 1 et 2 % du montant estimatif' },
  ],
};

const CADRAGE_COMPLET = {
  typeMarche: 'QUANTITE_FIXE', alloti: 'NON', variantes: 'NON', groupement: 'NON', provenance: 'NATIONAL', typePrix: 'UNITAIRES',
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
    statut: 'BROUILLON',
    version: 1,
    cadrage: { ...CADRAGE_COMPLET },
    valeurs: { 'B02-OB-01': 'Mobilier de bureau' },
    valeursPpm: { 'B01-AC-01': 'Ministère de l’Économie et des Finances' },
    enLettres: null,
    bilanControles: null,
    ...partiel,
  };
}

const LIGNES: LigneEligible[] = [
  { idDetail: 7, idDossier: 3, refeDossier: 'PPM-2026-003', designationMarche: 'Fourniture de mobilier', idMode: 1, libelleMode: 'Appel d’offres ouvert', montEstim: 420000000, dejaDao: false },
  { idDetail: 9, idDossier: 3, refeDossier: 'PPM-2026-003', designationMarche: 'Véhicules', idMode: 1, libelleMode: 'Appel d’offres ouvert', montEstim: 90000000, dejaDao: true, idDmc: 42 },
];

describe('Fiche marché d’un appel d’offres (proposition DMC du 22/09, lot 1)', () => {
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

  /** Répond à la vague d'ouverture d'une fiche : référentiel + fiche (`null` = 404) + versions figées. */
  function ouvrir(ref: ReferentielFiche | null, f: FicheMarche | null, versions: VersionFiche[] | null = []): void {
    const r = http.expectOne((x) => x.url === '/api/champs-fiche-marche' && x.params.get('typeMarche') === 'QUANTITE_FIXE');
    if (ref) r.flush(ref);
    else r.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    const q = http.expectOne('/api/fiches-marche/42');
    if (f) q.flush(f);
    else q.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    const v = http.expectOne('/api/fiches-marche/42/versions');
    if (versions) v.flush(versions);
    else v.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    rendre();
  }

  afterEach(() => http.verify());

  it('choix de la ligne : lignes éligibles, « Préparer » crée le DMC puis ouvre la fiche, « Reprendre » ouvre l’existante', () => {
    monter('PRMP', null);
    http.expectOne('/api/dmcs/eligibles').flush(LIGNES);
    rendre();
    const lignes = Array.from(racine().querySelectorAll('tbody tr'));
    expect(lignes.length).toBe(2);
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
    expect(racine().querySelectorAll('tbody tr').length).toBe(2);
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
    expect(racine().querySelectorAll('tbody tr').length).toBe(2);
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
    expect(racine().querySelectorAll('tbody tr').length).toBe(2);
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

  it('cadrage : « forme du groupement » apparaît avec groupement = OUI et repart avec NON ; l’enregistrement envoie les réponses', () => {
    monter('UGPM', 42);
    ouvrir(REFERENTIEL, fiche({ cadrage: { typeMarche: 'QUANTITE_FIXE' }, valeurs: {} }));
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
    // « À commande » et « Contrat-cadre » sont annoncés mais indisponibles (lots 3 et 4).
    expect((racine().querySelector('input[name="q-typeMarche"][value="A_COMMANDE"]') as HTMLInputElement).disabled).toBe(true);

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
    expect(texte(racine().querySelector('.fm__total'))).toContain('1 sur 4');
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
    expect(Array.from(racine().querySelectorAll('.fm__champ-t')).map((e) => texte(e))).toEqual(['Autorité contractante', 'Objet de l’appel d’offres', 'Montant de la garantie']);
    bouton('Contrôler').click();
    http.expectOne('/api/fiches-marche/42/controler').flush({
      bloquants: [{ regle: 'GS-01', champs: ['B05-GS-02'], bloc: 'B05', message: 'Montant de la garantie manquant.' }],
      avertissements: [{ regle: 'OB-02', champs: ['B02-OB-01'], bloc: 'B02', message: 'Objet très court.' }],
      ok: [],
      nbSaisis: 1,
      nbAttendus: 4,
    });
    rendre();
    expect(texte(racine().querySelector('.fm__ctrl--r'))).toContain('Montant de la garantie manquant');
    expect(bouton('Passer à la validation').disabled).toBe(true);
    expect(racine().querySelectorAll('.fm__ctrls li').length).toBe(2);

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
    rendre();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('version 1 figée'));
    expect(racine().querySelector('.fm__etape--courante .fm__etape-t')?.textContent).toBe('Documents');
    expect(texte(racine().querySelector('.page-subtitle'))).toContain('fiche validée, version 1');
    // La version figée rejoint l'historique de l'étape 6 sans relecture serveur (en-tête dérivé de la fiche).
    fixture.componentInstance.etape.set(5);
    rendre();
    expect(texte(racine().querySelector('.fm__ok'))).toContain('version 1 figée le 22/09/2026 10:05');
    expect(Array.from(racine().querySelectorAll('.fm__versions tbody tr')).map((tr) => cellules(tr))).toEqual(['1 22/09/2026 10:05 PRMP001 1']);
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
    expect(lignesV.map((tr) => cellules(tr))).toEqual(['2 22/09/2026 16:30 PRMP001 130', '1 10/09/2026 09:00 PRMP001 120']);
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
