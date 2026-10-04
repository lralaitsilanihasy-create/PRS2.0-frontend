import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CleCorps } from '../models';
import { CaoEspaceService, CaoService, CeremonieService, SeanceService } from './cao.services';

const CLE: CleCorps = {
  clePublique: 'MIIB',
  empreinte: 'ab'.repeat(32),
  enveloppe: { chiffre: 'AA==', iv: 'AAAAAAAAAAAAAAAA', sel: 'AAAAAAAAAAAAAAAAAAAAAA==', iterations: 600_000, kdf: 'PBKDF2-SHA-256', algorithme: 'AES-256-GCM' },
};

/**
 * Lots 2a et 2b (04/10) — les chemins du contrat. Deux familles se ressemblent : `/api/fiches-marche/{id}/cao` (la CAO
 * d'une fiche, PRMP) et `/api/cao/**` (l'espace du membre, public ou `MEMBRE_CAO`). La cérémonie, elle, vit sous la fiche
 * et distingue la part de secours par `?role=SECOURS` : l'oublier ferait vérifier la mauvaise clé.
 */
describe('Services de la CAO et de la cérémonie — chemins du contrat', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('la CAO d’une fiche : lecture, déclaration, décision PDF en multipart, invitation', () => {
    const s = TestBed.inject(CaoService);
    const http = TestBed.inject(HttpTestingController);

    s.lire(34).subscribe();
    http.expectOne({ method: 'GET', url: '/api/fiches-marche/34/cao' }).flush({ idDmc: 34, decision: { reference: null, date: null, fichier: false }, membres: [], etat: 'ABSENTE', anomalies: [] });

    s.definir(34, { decision: { reference: 'D-2026-12', date: '2026-10-01' }, membres: [] }).subscribe({ error: () => {} });
    http.expectOne({ method: 'PUT', url: '/api/fiches-marche/34/cao' }).flush({ erreurs: [{ champ: 'membres', message: 'Deux membres au moins.' }] }, { status: 400, statusText: 'Bad Request' });

    s.deposerDecision(34, new File(['%PDF-1.4'], 'decision.pdf', { type: 'application/pdf' })).subscribe();
    const post = http.expectOne({ method: 'POST', url: '/api/fiches-marche/34/cao/decision' });
    expect(post.request.body).toBeInstanceOf(FormData);
    expect((post.request.body as FormData).get('fichier')).toBeInstanceOf(File);
    post.flush({ idDmc: 34, decision: { reference: 'D-2026-12', date: '2026-10-01', fichier: true }, membres: [], etat: 'INCOMPLETE', anomalies: [] });

    s.inviter(34, 7).subscribe();
    http.expectOne({ method: 'POST', url: '/api/fiches-marche/34/cao/membres/7/inviter' }).flush({ id: 7 });
  });

  it('l’espace du membre : activation publique sur /api/cao, puis ses procédures', () => {
    const s = TestBed.inject(CaoEspaceService);
    const http = TestBed.inject(HttpTestingController);

    s.activer({ email: 'm@ac.mg', code: '123456', motDePasse: 'Test@1234' }).subscribe();
    const act = http.expectOne({ method: 'POST', url: '/api/cao/activation' });
    expect(act.request.body).toEqual({ email: 'm@ac.mg', code: '123456', motDePasse: 'Test@1234' });
    act.flush({ etat: 'ACTIF' });

    s.mesProcedures().subscribe();
    http.expectOne({ method: 'GET', url: '/api/cao/mes-procedures' }).flush([]);

    s.procedure(34).subscribe({ error: () => {} });
    http.expectOne({ method: 'GET', url: '/api/cao/procedures/34' }).flush({ message: 'x' }, { status: 403, statusText: 'Forbidden' });
  });

  it('la cérémonie : la part de secours se distingue par ?role=SECOURS, le défi se répond par son identifiant', () => {
    const s = TestBed.inject(CeremonieService);
    const http = TestBed.inject(HttpTestingController);

    s.lire(34).subscribe();
    http.expectOne({ method: 'GET', url: '/api/fiches-marche/34/ceremonie' }).flush({ idDmc: 34, etat: 'A_VENIR', detenteurs: [], avertissements: [], n: 3, quorum: 2, premierDepot: false });

    s.publierCle(34, CLE).subscribe();
    http.expectOne({ method: 'POST', url: '/api/fiches-marche/34/ceremonie/cles' }).flush({ role: 'MEMBRE' }, { status: 201, statusText: 'Created' });
    s.remplacerCle(34, CLE).subscribe();
    http.expectOne({ method: 'PUT', url: '/api/fiches-marche/34/ceremonie/cles' }).flush({ role: 'MEMBRE' });
    s.maCle(34).subscribe();
    http.expectOne({ method: 'GET', url: '/api/fiches-marche/34/ceremonie/cles/mienne' }).flush(CLE.enveloppe);

    s.publierSecours(34, CLE).subscribe();
    http.expectOne({ method: 'POST', url: '/api/fiches-marche/34/ceremonie/cles/secours' }).flush({ role: 'SECOURS' }, { status: 201, statusText: 'Created' });
    s.enveloppeSecours(34).subscribe();
    http.expectOne({ method: 'GET', url: '/api/fiches-marche/34/ceremonie/cles/secours' }).flush(CLE.enveloppe);

    // Sans rôle : la clé du membre connecté. Avec SECOURS : la part de secours, par le responsable.
    s.declarerPerdue(34).subscribe();
    http.expectOne({ method: 'POST', url: '/api/fiches-marche/34/ceremonie/cles/perdue' }).flush({ etatPart: 'PERDUE' });
    s.declarerPerdue(34, 'SECOURS').subscribe();
    http.expectOne({ method: 'POST', url: '/api/fiches-marche/34/ceremonie/cles/perdue?role=SECOURS' }).flush({ etatPart: 'PERDUE' });

    s.ouvrirDefi(34).subscribe();
    http.expectOne({ method: 'POST', url: '/api/fiches-marche/34/ceremonie/defi' }).flush({ idDefi: 'd1', chiffre: 'AA==', expire: '2026-10-04T10:05' }, { status: 201, statusText: 'Created' });
    s.ouvrirDefi(34, 'SECOURS').subscribe();
    http.expectOne({ method: 'POST', url: '/api/fiches-marche/34/ceremonie/defi?role=SECOURS' }).flush({ idDefi: 'd2', chiffre: 'AA==', expire: '2026-10-04T10:05' }, { status: 201, statusText: 'Created' });
    s.repondreDefi(34, 'd1', 'QUJD').subscribe();
    const rep = http.expectOne({ method: 'POST', url: '/api/fiches-marche/34/ceremonie/defi/d1' });
    expect(rep.request.body).toEqual({ clair: 'QUJD' });
    rep.flush({ etatPart: 'VERIFIEE' });

    s.cloturer(34).subscribe({ error: () => {} });
    http.expectOne({ method: 'POST', url: '/api/fiches-marche/34/ceremonie/cloturer' }).flush({ code: 'CLES_INCOMPLETES', message: 'Manquent : RAKOTO Jean, la part de secours.' }, { status: 409, statusText: 'Conflict' });
    s.rouvrir(34).subscribe();
    http.expectOne({ method: 'POST', url: '/api/fiches-marche/34/ceremonie/rouvrir' }).flush({ etat: 'A_REFAIRE' });

    // Les clés publiques des candidats : sur la ressource PUBLIQUE des procédures en ligne, pas sous la fiche.
    s.clesPubliques(34).subscribe({ error: () => {} });
    http.expectOne({ method: 'GET', url: '/api/procedures-en-ligne/34/cles' }).flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
  });
});

describe('Séance d’ouverture (lot 4) — chemins du contrat', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('état, ouverture, présences, parts (secours avec motif), lecture, pièce, PV, constat', () => {
    const s = TestBed.inject(SeanceService);
    const http = TestBed.inject(HttpTestingController);
    const u = '/api/fiches-marche/40/seance';

    s.lire(40).subscribe();
    http.expectOne({ method: 'GET', url: u }).flush({ etat: 'A_VENIR' });
    s.ouvrir(40).subscribe({ error: () => {} });
    http.expectOne({ method: 'POST', url: `${u}/ouvrir` }).flush({ code: 'SEANCE_PREMATUREE' }, { status: 409, statusText: 'Conflict' });
    s.presences(40, ['K000000001'], [{ nom: 'Observateur', qualite: null }]).subscribe();
    const pr = http.expectOne({ method: 'PUT', url: `${u}/presences` });
    expect(pr.request.body).toEqual({ presents: ['K000000001'], autres: [{ nom: 'Observateur', qualite: null }] });
    pr.flush({});

    s.mesParts(40).subscribe();
    http.expectOne({ method: 'GET', url: `${u}/mes-parts` }).flush([]);
    s.mesParts(40, 'SECOURS').subscribe();
    http.expectOne({ method: 'GET', url: `${u}/mes-parts?role=SECOURS` }).flush([]);
    s.apporterParts(40, [{ idOffre: 'o', partClaire: 'AA==' }]).subscribe();
    const p1 = http.expectOne({ method: 'POST', url: `${u}/parts` });
    // Sans motif pour un membre : la clé n'est pas envoyée.
    expect(p1.request.body).toEqual({ parts: [{ idOffre: 'o', partClaire: 'AA==' }] });
    p1.flush({});
    s.apporterParts(40, [], 'SECOURS', 'Membre absent').subscribe();
    const p2 = http.expectOne({ method: 'POST', url: `${u}/parts?role=SECOURS` });
    expect(p2.request.body.motif).toBe('Membre absent');
    p2.flush({});

    s.lecture(40).subscribe();
    http.expectOne({ method: 'GET', url: `${u}/lecture` }).flush({ offres: [], nonOuvertes: [] });
    s.piece(40, 'o', 'AE-acte.pdf').subscribe();
    const pc = http.expectOne({ method: 'GET', url: `${u}/offres/o/pieces/AE-acte.pdf` });
    expect(pc.request.responseType).toBe('blob');
    pc.flush(new Blob());
    s.produirePv(40, null).subscribe();
    http.expectOne({ method: 'POST', url: `${u}/pv` }).flush({});
    s.pv(40).subscribe();
    http.expectOne({ method: 'GET', url: `${u}/pv` }).flush(new Blob());
    s.constaterIllisible(40, 'Parts perdues').subscribe();
    http.expectOne({ method: 'POST', url: `${u}/constater-illisible` }).flush({});
  });
});
