import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Actualite } from '../../models/actualite.model';
import { AuditLog, CompteursAdmin } from '../../models';
import { AdminAccueil } from './admin-accueil';

/**
 * Lot 6 F2 — l'accueil de l'Administrateur.
 *
 * Deux choses sont éprouvées ici, et la seconde compte autant que la première :
 *
 * 1. ce que l'écran DIT des files d'attente (nombre, ancienneté, urgence) ;
 * 2. ce qu'il **n'affiche pas** — les mesures de la maquette A qui n'ont aucune source : échecs de
 *    connexion et sessions ouvertes (besoin B4), le bloc « Système » (aucune route), et la colonne
 *    « Valeur » avant → après du journal (trois champs que l'intercepteur n'écrit jamais). Le plan
 *    L6 §6 les interdit tant qu'elles ne sont pas mesurables : sans ces tests, rien n'empêcherait
 *    de les réintroduire à zéro.
 */
const COMPTEURS: CompteursAdmin = {
  inscriptionsEnAttente: 5,
  rattachementsEnAttente: 2,
  inscriptionDoyenneLe: '2026-09-14T08:00:00',
  rattachementDoyenLe: '2026-09-17T00:00:00',
  comptes: 134,
  comptesActifs: 128,
  comptesSuspendus: 3,
  mandatsExpirantSous30j: 2,
  journalAudit: 12480,
};

const ACTUALITE: Actualite = {
  idActualite: 7,
  titre: 'Fermeture technique du 20/09',
  contenuMd: 'Le service sera interrompu.',
  profilsCibles: [
    'PRMP',
    'UGPM',
    'SECRETAIRE',
    'PRESIDENT',
    'CHEF_COMMISSION',
    'MEMBRE',
    'VERIFICATEUR',
    'ASSISTANT_CONTROLEUR',
    'CHARGE_PUBLICATION',
    'ADMINISTRATEUR',
  ],
  statut: 'ACTIF',
  datePublication: '2026-09-15',
  dateExpiration: null,
  dateCreation: '2026-09-15T09:00:00',
  imAuteur: 'ADMIN01',
};

const CHANGEMENTS: AuditLog[] = [
  { idLog: 91, dateAction: '2026-09-16T14:32:00', imActeur: 'ADMIN01', nomTable: 'delais-standards', idEnregistrement: '4', typeAction: 'UPDATE' },
  { idLog: 90, dateAction: '2026-09-15T09:10:00', imActeur: 'ADMIN01', nomTable: 'parametres', typeAction: 'AGPM-SEUIL-MONTANT' },
];

describe("AdminAccueil — le poste d'administration", () => {
  let fixture: ComponentFixture<AdminAccueil>;
  let http: HttpTestingController;

  /** Monte l'écran et répond aux quatre lectures ; `null` sur `compteurs` simule l'échec du serveur. */
  function monter(
    options: {
      compteurs?: CompteursAdmin | null;
      changements?: AuditLog[];
      actualites?: Actualite[];
      actualitesActives?: boolean;
    } = {},
  ): AdminAccueil {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminAccueil);
    fixture.detectChanges();

    const badges = http.expectOne('/api/kpis/badges');
    if (options.compteurs === null) {
      badges.flush('indisponible', { status: 500, statusText: 'Server Error' });
    } else {
      badges.flush({ profil: 'ADMINISTRATEUR', compteurs: options.compteurs ?? COMPTEURS, aFaire: null });
    }
    const contenu = options.changements ?? CHANGEMENTS;
    http
      .expectOne((r) => r.url === '/api/audit-logs')
      .flush({ content: contenu, totalElements: contenu.length, totalPages: 1, number: 0, size: 5 });
    http.expectOne('/api/actualites').flush(options.actualites ?? [ACTUALITE]);
    http.expectOne('/api/parametres/actualites-actives').flush({ actif: options.actualitesActives ?? true });
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const texte = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  afterEach(() => {
    // `finally` : sans lui, un `verify()` qui échoue laisse le TestBed instancié et TOUS les tests
    // suivants tombent sur « already instantiated » — le vrai échec disparaît dans la cascade.
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('lit les compteurs en UN appel — le même `/api/kpis/badges` que la pastille du menu', () => {
    const ecran = monter();
    expect(ecran.compteurs()).toEqual(COMPTEURS);
    expect(ecran.erreur()).toBe(false);
  });

  it('les deux files portent leur nombre, leur destination et leur ancienneté', () => {
    const ecran = monter();
    const [inscriptions, rattachements] = ecran.files();
    expect(inscriptions.nombre).toBe(5);
    expect(inscriptions.lien).toBe('/admin/inscriptions');
    expect(rattachements.nombre).toBe(2);
    expect(rattachements.lien).toBe('/admin/rattachements');
    expect(texte()).toContain('La plus ancienne attend depuis');
  });

  it('dit « PRMP et UGPM » : depuis le 17/09 le compteur porte les deux files, comme l’écran', () => {
    monter();
    expect(texte()).toContain('Inscriptions PRMP et UGPM');
  });

  it("l'ancienneté d'un rattachement se lit en JOURS — sa date est ramenée à minuit côté serveur", () => {
    // Le serveur sert `DATE_DECLARATION.atStartOfDay()` : « depuis 10 heures » serait une précision inventée.
    const ecran = monter();
    expect(ecran.files()[1].attente?.libelle).toMatch(/^depuis (aujourd'hui|hier|\d+ jours)$/);
  });

  it('une file vide n’affiche ni ancienneté ni étiquette de retard', () => {
    const ecran = monter({
      compteurs: { ...COMPTEURS, inscriptionsEnAttente: 0, rattachementsEnAttente: 0, inscriptionDoyenneLe: null, rattachementDoyenLe: null },
    });
    expect(ecran.doyenne()).toBeNull();
    expect(texte()).toContain('Aucune demande en attente.');
    expect(texte()).not.toContain('en retard');
  });

  it('les tuiles d’accès donnent les comptes actifs, suspendus, et le total qui les remet à l’échelle', () => {
    monter();
    expect(texte()).toContain('comptes actifs');
    expect(texte()).toContain('comptes suspendus');
    expect(texte()).toContain('sur 134 comptes enregistrés');
  });

  it('accorde en français : 0 et 1 au singulier (« 1 compte », pas « 1 comptes »)', () => {
    monter({ compteurs: { ...COMPTEURS, comptes: 1, comptesActifs: 1, journalAudit: 0 } });
    expect(texte()).toContain('sur 1 compte enregistré');
    expect(texte()).toContain('0 écriture enregistrée');
  });

  it('les mandats qui expirent sous 30 jours sont annoncés, avec le chemin pour agir', () => {
    monter();
    expect(texte()).toContain('2 mandats PRMP expirent sous 30 jours');
    expect(texte()).toContain('Ouvrir les mandats PRMP');
  });

  it("leur absence a son état vide : « rien à surveiller » se dit, il ne se devine pas", () => {
    monter({ compteurs: { ...COMPTEURS, mandatsExpirantSous30j: 0 } });
    expect(texte()).toContain("Aucun mandat PRMP n'arrive à terme dans les 30 jours.");
  });

  it('demande les cinq réglages EN UN APPEL — c’est la raison d’être de B5', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminAccueil);
    fixture.detectChanges();

    const journal = http.expectOne((r) => r.url === '/api/audit-logs');
    // ⚠️ `table` porte le nom de RESSOURCE de l'API, pas celui de la table SQL : `AuditInterceptor`
    // écrit dans NOM_TABLE le premier segment du chemin appelé. `t_delai_standard` ne ramènerait rien.
    expect(journal.request.params.getAll('table')).toEqual([
      'delais-standards',
      'points-ctrls',
      'regle-alertes',
      'regle-anomalies',
      'parametres',
    ]);
    expect(journal.request.params.get('size')).toBe('4');

    journal.flush({ content: CHANGEMENTS, totalElements: 2, totalPages: 1, number: 0, size: 5 });
    http.expectOne('/api/kpis/badges').flush({ profil: 'ADMINISTRATEUR', compteurs: COMPTEURS, aFaire: null });
    http.expectOne('/api/actualites').flush([ACTUALITE]);
    http.expectOne('/api/parametres/actualites-actives').flush({ actif: true });
  });

  it("ne suit PAS les chaînes de contrôle : elles s'écrivent sur la ressource « controleurs », partagée", () => {
    // `PUT /api/controleurs/{im}/rattachement` est audité sous `controleurs`, comme toute correction
    // de fiche : suivre cette ressource noierait les réglages sous les modifications de contrôleurs.
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminAccueil);
    fixture.detectChanges();

    const journal = http.expectOne((r) => r.url === '/api/audit-logs');
    expect(journal.request.params.getAll('table')).not.toContain('controleurs');

    journal.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
    http.expectOne('/api/kpis/badges').flush({ profil: 'ADMINISTRATEUR', compteurs: COMPTEURS, aFaire: null });
    http.expectOne('/api/actualites').flush([ACTUALITE]);
    http.expectOne('/api/parametres/actualites-actives').flush({ actif: true });
  });

  it('nomme le réglage touché et le geste, sans jargon de table', () => {
    monter();
    expect(texte()).toContain('Délais standards');
    expect(texte()).toContain('Modification n° 4');
    expect(texte()).toContain('Paramètres généraux');
    // Un sous-chemin distingue deux réglages d'une même ressource : il est gardé tel quel.
    expect(texte()).toContain('AGPM-SEUIL-MONTANT');
  });

  it("aucun changement enregistré a son état vide, pas un tableau muet", () => {
    monter({ changements: [] });
    expect(texte()).toContain("Aucun réglage n'a été modifié depuis la mise en service.");
  });

  it("l'échec du journal n'emporte pas le reste de l'accueil, et se rejoue", () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminAccueil);
    fixture.detectChanges();
    http.expectOne('/api/kpis/badges').flush({ profil: 'ADMINISTRATEUR', compteurs: COMPTEURS, aFaire: null });
    http.expectOne((r) => r.url === '/api/audit-logs').flush('nope', { status: 500, statusText: 'Server Error' });
    http.expectOne('/api/actualites').flush([ACTUALITE]);
    http.expectOne('/api/parametres/actualites-actives').flush({ actif: true });
    fixture.detectChanges();

    expect(fixture.componentInstance.reglagesErreur()).toBe(true);
    expect(fixture.componentInstance.compteurs()).toEqual(COMPTEURS);
    expect(texte()).toContain("Les derniers changements de paramétrage n'ont pas pu être lus.");

    fixture.componentInstance.chargerReglages();
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/audit-logs')
      .flush({ content: CHANGEMENTS, totalElements: 2, totalPages: 1, number: 0, size: 5 });
    fixture.detectChanges();
    expect(fixture.componentInstance.reglagesErreur()).toBe(false);
  });

  it("l'actualité affichée est reprise avec son ciblage et son auteur", () => {
    const ecran = monter();
    expect(ecran.actualite()?.titre).toBe('Fermeture technique du 20/09');
    expect(texte()).toContain('Fermeture technique du 20/09');
    expect(texte()).toContain('tous profils');
    expect(texte()).toContain('ADMIN01');
  });

  it("une actualité ACTIVE n'est pas « affichée » si l'interrupteur global est à l'arrêt", () => {
    // Le serveur renvoie une liste vide à tout le monde dans ce cas : l'accueil doit dire pourquoi.
    const ecran = monter({ actualitesActives: false });
    expect(ecran.actualite()).toBeNull();
    expect(texte()).toContain("l'affichage à la connexion est désactivé");
  });

  it("une actualité inactive ou expirée n'est pas comptée comme affichée", () => {
    const ecran = monter({
      actualites: [
        { ...ACTUALITE, idActualite: 1, statut: 'INACTIF' },
        { ...ACTUALITE, idActualite: 2, dateExpiration: '2000-01-01' },
        { ...ACTUALITE, idActualite: 3, datePublication: '2999-01-01' },
      ],
    });
    expect(ecran.actualite()).toBeNull();
    expect(texte()).toContain("Aucune actualité n'est affichée à l'ouverture de session.");
  });

  it("l'échec des compteurs laisse un état d'erreur avec reprise, pas un écran vide (AUDIT M16)", () => {
    const ecran = monter({ compteurs: null });
    expect(ecran.erreur()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-etat-erreur')).not.toBeNull();
    expect(texte()).toContain("Les compteurs d'administration n'ont pas pu être chargés.");

    ecran.charger();
    fixture.detectChanges();
    http.expectOne('/api/kpis/badges').flush({ profil: 'ADMINISTRATEUR', compteurs: COMPTEURS, aFaire: null });
    fixture.detectChanges();
    expect(ecran.erreur()).toBe(false);
  });

  it("l'échec des actualités n'emporte pas le reste de l'accueil", () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminAccueil);
    fixture.detectChanges();
    http.expectOne('/api/kpis/badges').flush({ profil: 'ADMINISTRATEUR', compteurs: COMPTEURS, aFaire: null });
    http
      .expectOne((r) => r.url === '/api/audit-logs')
      .flush({ content: CHANGEMENTS, totalElements: 2, totalPages: 1, number: 0, size: 5 });
    // L'interrupteur répond d'abord : `forkJoin` ANNULE la requête sœur dès qu'une des deux échoue.
    http.expectOne('/api/parametres/actualites-actives').flush({ actif: true });
    http.expectOne('/api/actualites').flush('nope', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.componentInstance.actuErreur()).toBe(true);
    expect(fixture.componentInstance.compteurs()).toEqual(COMPTEURS);
    expect(texte()).toContain("Les actualités n'ont pas pu être lues.");
  });

  // ───────────────────────── Ce qui n'est PAS affiché (plan L6, §6) ─────────────────────────

  it("n'affiche AUCUNE mesure de connexion : leur source (B4) n'existe pas encore", () => {
    monter();
    expect(texte()).not.toContain('échecs de connexion');
    expect(texte()).not.toContain('sessions ouvertes');
    expect(texte()).not.toContain('Sessions');
  });

  it("n'affiche pas le bloc « Système » : schéma, migration et moteur d'alertes n'ont pas de route", () => {
    monter();
    expect(texte()).not.toContain('Schéma de base');
    expect(texte()).not.toContain('Dernière migration');
    expect(texte()).not.toContain("Moteur d'alertes");
    expect(texte()).not.toContain('Profils actifs');
  });

  it("n'affiche PAS la colonne « Valeur » (avant → après) : ces champs ne sont jamais écrits", () => {
    // `AuditLogService.enregistrer` ne renseigne ni champModifie, ni ancienneValeur, ni
    // nouvelleValeur : l'intercepteur journalise la requête, pas le diff.
    monter();
    expect(texte()).toContain('Derniers changements de paramétrage');
    expect(texte()).not.toContain('Valeur');
    expect(texte()).not.toContain('→');
  });

  it('ne lance que les quatre lectures attendues — aucun appel de rattrapage', () => {
    monter();
    http.expectNone(() => true);
  });
});
