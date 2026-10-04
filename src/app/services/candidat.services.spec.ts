import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Entreprise, RetraitDao } from '../models';
import {
  CandidatInscriptionService,
  EntrepriseCandidatService,
  EntreprisesAdminService,
  ExclusionsArmpService,
  OffresCandidatService,
  ProceduresEnLigneService,
} from './candidat.services';
import { FicheMarcheService } from './fiche-marche.services';

/**
 * Soumission en ligne, lot 1 (04/10) — les chemins du contrat, tels que le backend les a confirmés. Deux familles se
 * ressemblent et ne se confondent pas : `/api/candidats/**` (le COMPTE, public, au pluriel) et `/api/candidat/**`
 * (l'ENTREPRISE du connecté, au singulier). Se tromper d'un « s » ne casse aucune compilation : l'inscription
 * répondrait 403 et la déclaration 404.
 */
describe('Services du candidat — chemins du contrat', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('le compte : inscription, confirmation et renvoi des codes sur /api/candidats (pluriel, public)', () => {
    const s = TestBed.inject(CandidatInscriptionService);
    const http = TestBed.inject(HttpTestingController);

    s.inscrire({ email: 'a@b.mg', telephone: '0340000000', motDePasse: 'Test@1234', nom: 'RAKOTO', prenom: 'Jean' }).subscribe();
    http.expectOne({ method: 'POST', url: '/api/candidats/inscription' }).flush({ idCompte: 'C000000001', etat: 'A_CONFIRMER' }, { status: 201, statusText: 'Created' });

    s.confirmer({ email: 'a@b.mg', codeEmail: '123456' }).subscribe();
    const conf = http.expectOne({ method: 'POST', url: '/api/candidats/confirmation' });
    // Sans code SMS, la clé n'est pas envoyée du tout (la passerelle n'existe pas ; le serveur ne l'exige pas).
    expect(conf.request.body).toEqual({ email: 'a@b.mg', codeEmail: '123456' });
    conf.flush({ etat: 'CONFIRME' });

    let fini = false;
    s.renvoyerCodes('a@b.mg').subscribe({ complete: () => (fini = true) });
    http.expectOne({ method: 'POST', url: '/api/candidats/codes' }).flush(null, { status: 204, statusText: 'No Content' });
    expect(fini).toBe(true);
  });

  it('l’entreprise du connecté : /api/candidat/entreprise (singulier), sans identifiant de compte dans l’URL', () => {
    const s = TestBed.inject(EntrepriseCandidatService);
    const http = TestBed.inject(HttpTestingController);

    let erreur: { status?: number } | undefined;
    s.lire().subscribe({ error: (e: { status?: number }) => (erreur = e) });
    // Pas encore déclarée : 404, que l'écran traite comme « formulaire vide », jamais comme une panne.
    http.expectOne({ method: 'GET', url: '/api/candidat/entreprise' }).flush({ message: 'Aucune entreprise' }, { status: 404, statusText: 'Not Found' });
    expect(erreur?.status).toBe(404);

    let recue: Entreprise | undefined;
    s.declarer({ raisonSociale: 'SARL X', nif: '1234567890', adresse: 'Lot II', representant: { nom: 'RAKOTO', prenom: 'Jean' } }).subscribe((e) => (recue = e));
    const put = http.expectOne({ method: 'PUT', url: '/api/candidat/entreprise' });
    put.flush({ id: 1, raisonSociale: 'SARL X', nif: '1234567890', stat: null, rcs: null, adresse: 'Lot II', representant: { nom: 'RAKOTO', prenom: 'Jean' }, pieces: [], verification: { statut: 'NON_VERIFIE', source: null, date: null, acteur: null, motif: null }, exclusion: null });
    expect(recue?.verification.statut).toBe('NON_VERIFIE');

    s.ajouterPiece('CARTE_FISCALE', new File(['%PDF-1.4'], 'carte.pdf', { type: 'application/pdf' })).subscribe();
    const post = http.expectOne({ method: 'POST', url: '/api/candidat/entreprise/pieces' });
    expect(post.request.body).toBeInstanceOf(FormData);
    expect((post.request.body as FormData).get('type')).toBe('CARTE_FISCALE');
    post.flush({ id: 7, type: 'CARTE_FISCALE', nomFichier: 'carte.pdf', format: 'PDF', taille: 8, dateDepot: '2026-10-04T10:00' }, { status: 201, statusText: 'Created' });

    s.supprimerPiece(7).subscribe();
    http.expectOne({ method: 'DELETE', url: '/api/candidat/entreprise/pieces/7' }).flush(null, { status: 204, statusText: 'No Content' });
  });

  it('les procédures en ligne : liste et détail publics, documents et téléchargement (blob) du candidat', () => {
    const s = TestBed.inject(ProceduresEnLigneService);
    const http = TestBed.inject(HttpTestingController);

    s.liste().subscribe();
    http.expectOne({ method: 'GET', url: '/api/procedures-en-ligne' }).flush([]);

    s.detail(34).subscribe({ error: () => {} });
    http.expectOne({ method: 'GET', url: '/api/procedures-en-ligne/34' }).flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });

    s.documents(34).subscribe();
    http.expectOne({ method: 'GET', url: '/api/procedures-en-ligne/34/documents' }).flush([]);

    let blob: Blob | undefined;
    s.telecharger(34, 'DPAO v2.pdf').subscribe((b) => (blob = b));
    // Le code est le NOM DU FICHIER : il peut porter des blancs, il est donc encodé dans l'URL.
    const req = http.expectOne({ method: 'GET', url: '/api/procedures-en-ligne/34/documents/DPAO%20v2.pdf' });
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(blob).toBeInstanceOf(Blob);
  });

  it('l’Administrateur : entreprises par statut (NON_VERIFIE par défaut côté serveur), décision, pièce en blob', () => {
    const s = TestBed.inject(EntreprisesAdminService);
    const http = TestBed.inject(HttpTestingController);

    s.liste().subscribe();
    http.expectOne({ method: 'GET', url: '/api/admin/entreprises' }).flush([]);

    s.liste('REFUSE_SUR_PIECES').subscribe();
    http.expectOne({ method: 'GET', url: '/api/admin/entreprises?verification=REFUSE_SUR_PIECES' }).flush([]);

    s.decider(3, { statut: 'REFUSE_SUR_PIECES', motif: 'Carte fiscale illisible' }).subscribe();
    http.expectOne({ method: 'POST', url: '/api/admin/entreprises/3/verification' }).flush({ statut: 'REFUSE_SUR_PIECES', source: 'SUR_PIECES', date: '2026-10-04T10:00', acteur: 'ADMIN01', motif: 'Carte fiscale illisible' });

    s.fichierPiece(3, 9).subscribe();
    const req = http.expectOne({ method: 'GET', url: '/api/admin/entreprises/3/pieces/9/fichier' });
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });

  it('les exclusions de l’ARMP : liste, création, modification — et pas de suppression', () => {
    const s = TestBed.inject(ExclusionsArmpService);
    const http = TestBed.inject(HttpTestingController);

    s.liste().subscribe();
    http.expectOne({ method: 'GET', url: '/api/exclusions-armp' }).flush([]);

    const corps = { nif: '1234567890', raisonSociale: 'SARL X', motif: 'Fausse déclaration', referenceDecision: 'ARMP/2026/12', dateDebut: '2026-10-01', dateFin: null };
    s.creer(corps).subscribe();
    http.expectOne({ method: 'POST', url: '/api/exclusions-armp' }).flush({ ...corps, id: 1, enCours: true, journal: [] }, { status: 201, statusText: 'Created' });

    s.modifier(1, { ...corps, dateFin: '2027-10-01' }).subscribe();
    http.expectOne({ method: 'PUT', url: '/api/exclusions-armp/1' }).flush({ ...corps, id: 1, dateFin: '2027-10-01', enCours: true, journal: [] });

    // Le service n'offre aucun `supprimer` : la ressource répond 405, et l'écran ne le propose pas.
    expect('supprimer' in s).toBe(false);
  });

  it('le registre des retraits du DAO : sur la fiche, pour la PRMP de la fiche', () => {
    const s = TestBed.inject(FicheMarcheService);
    const http = TestBed.inject(HttpTestingController);

    let recus: RetraitDao[] | undefined;
    s.retraits(34).subscribe((r) => (recus = r));
    http.expectOne({ method: 'GET', url: '/api/fiches-marche/34/retraits' }).flush([
      { date: '2026-10-04T09:12', compte: 'a@b.mg', entreprise: null, nif: null, document: 'DPAO.pdf', version: 2 },
    ]);
    expect(recus?.length).toBe(1);
    expect(recus?.[0].entreprise).toBeNull();
  });
});

describe('Offres du candidat (lot 3) — chemins du contrat', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('création, morceaux en octets bruts avec leur empreinte, scellement, retrait, accusé ; pièces et horloge publiques', () => {
    const s = TestBed.inject(OffresCandidatService);
    const p = TestBed.inject(ProceduresEnLigneService);
    const f = TestBed.inject(FicheMarcheService);
    const http = TestBed.inject(HttpTestingController);

    s.creer({ idDmc: 40, lot: 1, enTete: '{"version":1}', remplace: null }).subscribe();
    const c = http.expectOne({ method: 'POST', url: '/api/candidat/offres' });
    // L'en-tête voyage en CHAÎNE : ses octets UTF-8 sont ce que l'empreinte couvre.
    expect(typeof c.request.body.enTete).toBe('string');
    c.flush({ idOffre: 'u-1', etat: 'EN_COURS' }, { status: 201, statusText: 'Created' });

    s.envoyerMorceau('u-1', 0, new Uint8Array([1, 2, 3]), 'ab'.repeat(32)).subscribe();
    const m = http.expectOne({ method: 'PUT', url: '/api/candidat/offres/u-1/morceaux/0' });
    expect(m.request.headers.get('X-Empreinte')).toBe('ab'.repeat(32));
    expect(m.request.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(m.request.body).toBeInstanceOf(Blob);
    m.flush({ rang: 0, taille: 3, recus: 1 });

    s.sceller('u-1', 'cd'.repeat(32)).subscribe();
    const sc = http.expectOne({ method: 'POST', url: '/api/candidat/offres/u-1/sceller' });
    expect(sc.request.body).toEqual({ empreinte: 'cd'.repeat(32) });
    sc.flush({ offre: { idOffre: 'u-1', etat: 'DEPOSEE' }, entreprise: { nif: '1', raisonSociale: 'X' }, n: 3, quorum: 2, empreintesDetenteurs: [] });

    s.accuse('u-1').subscribe();
    const a = http.expectOne({ method: 'GET', url: '/api/candidat/offres/u-1/accuse' });
    expect(a.request.responseType).toBe('blob');
    a.flush(new Blob());

    s.retirer('u-1').subscribe();
    http.expectOne({ method: 'DELETE', url: '/api/candidat/offres/u-1' }).flush({ idOffre: 'u-1', etat: 'RETIREE' });

    p.pieces(40).subscribe();
    http.expectOne({ method: 'GET', url: '/api/procedures-en-ligne/40/pieces' }).flush([]);
    p.horloge().subscribe();
    http.expectOne({ method: 'GET', url: '/api/horloge' }).flush({ maintenant: '2026-10-04T18:00:00', fuseau: 'Indian/Antananarivo' });
    f.depots(40).subscribe();
    http.expectOne({ method: 'GET', url: '/api/fiches-marche/40/depots' }).flush({ clos: false, nombre: 2, dateLimite: null, depots: null });
  });
});
