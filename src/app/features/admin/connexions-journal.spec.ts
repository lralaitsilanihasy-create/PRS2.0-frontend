import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Page, SessionConnexion } from '../../models';
import { ConnexionsJournal } from './connexions-journal';

/**
 * Lot 6 F5 — l'onglet « Connexions » du Journal.
 *
 * Quatre choses sont éprouvées ici :
 *
 * 1. **où partent les filtres et la pagination** : au SERVEUR. Filtrer la seule page affichée est le
 *    défaut M15 de l'audit — l'utilisateur croit chercher dans le journal et ne cherche que dans
 *    vingt-cinq lignes. Sans ce test, rien n'empêcherait d'y revenir sans que personne ne le voie
 *    avant la production ;
 * 2. **qu'un échec se distingue d'une connexion réussie** — c'est la raison d'être de cet écran, et
 *    la distinction ne tient pas à la couleur seule ;
 * 3. **que les trois états sont tenus** : chargement annoncé (`role="status"`), échec repris
 *    (`app-etat-erreur`), et surtout le **vide**, qui est le cas COURANT au démarrage ;
 * 4. **qu'un journal vide ne se dit pas comme « aucun résultat »** : ce sont deux situations, et
 *    l'une des deux se corrige en retirant un filtre.
 */
const LIGNES: SessionConnexion[] = [
  {
    acteur: 'CTR0142',
    login: 'm.rakotomalala',
    dateConnexion: '2026-09-17T08:32:17',
    dateDeconnexion: '2026-09-17T10:02:17',
    dureeSecondes: 5400,
    ipAdresse: '192.168.1.42',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
    succes: true,
  },
  {
    acteur: null,
    login: 'intrus.inconnu',
    dateConnexion: '2026-09-17T03:15:00',
    dateDeconnexion: null,
    dureeSecondes: null,
    ipAdresse: '10.0.0.7',
    userAgent: 'curl/8.4.0',
    succes: false,
  },
];

function page(contenu: SessionConnexion[], total = contenu.length, index = 0): Page<SessionConnexion> {
  return { content: contenu, totalElements: total, totalPages: Math.max(1, Math.ceil(total / 25)), number: index, size: 25 };
}

describe('ConnexionsJournal — le journal des connexions', () => {
  let fixture: ComponentFixture<ConnexionsJournal>;
  let http: HttpTestingController;

  /** Monte l'onglet et répond à sa lecture d'ouverture ; `null` simule l'échec du serveur. */
  function monter(
    options: { reponse?: Page<SessionConnexion> | null; succesInitial?: boolean | null; acteurInitial?: string } = {},
  ): ConnexionsJournal {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConnexionsJournal);
    if (options.succesInitial !== undefined) {
      fixture.componentRef.setInput('succesInitial', options.succesInitial);
    }
    if (options.acteurInitial !== undefined) {
      fixture.componentRef.setInput('acteurInitial', options.acteurInitial);
    }
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/api/sessions');
    if (options.reponse === null) {
      req.flush('boum', { status: 500, statusText: 'Server Error' });
    } else {
      req.flush(options.reponse ?? page(LIGNES));
    }
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  /** Les paramètres de la DERNIÈRE requête partie — c'est là que se lit « côté serveur ». */
  function derniereRequete(): URLSearchParams {
    const req = http.expectOne((r) => r.url === '/api/sessions');
    const params = new URLSearchParams();
    for (const cle of req.request.params.keys()) {
      params.set(cle, req.request.params.get(cle) ?? '');
    }
    req.flush(page([]));
    fixture.detectChanges();
    return params;
  }

  const texte = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('lit la première page au serveur, taille comprise', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConnexionsJournal);
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/api/sessions');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('25');
    // Aucun filtre au départ : le journal s'ouvre entier.
    expect(req.request.params.has('succes')).toBe(false);
    expect(req.request.params.has('acteur')).toBe(false);
    req.flush(page(LIGNES));
    fixture.detectChanges();
    expect(fixture.componentInstance.lignes().length).toBe(2);
  });

  it('les quatre filtres partent au SERVEUR — pas dans la page affichée (défaut M15)', () => {
    const ecran = monter();
    ecran.form.setValue({ acteur: 'CTR0142', succes: 'false', du: '2026-09-01', au: '2026-09-17' });
    ecran.appliquer();
    fixture.detectChanges();
    const params = derniereRequete();
    expect(params.get('acteur')).toBe('CTR0142');
    expect(params.get('succes')).toBe('false');
    expect(params.get('du')).toBe('2026-09-01');
    expect(params.get('au')).toBe('2026-09-17');
    // Un filtre change la page demandée : on repart de la première, pas de la septième.
    expect(params.get('page')).toBe('0');
  });

  it('un filtre vide est OMIS : une date vide partirait en 400', () => {
    const ecran = monter();
    ecran.form.setValue({ acteur: '  ', succes: '', du: '', au: '' });
    ecran.appliquer();
    fixture.detectChanges();
    const params = derniereRequete();
    expect(params.has('acteur')).toBe(false);
    expect(params.has('succes')).toBe(false);
    expect(params.has('du')).toBe(false);
    expect(params.has('au')).toBe(false);
  });

  it('la pagination part au serveur elle aussi', () => {
    const ecran = monter({ reponse: page(LIGNES, 60) });
    ecran.pageSuivante();
    fixture.detectChanges();
    expect(derniereRequete().get('page')).toBe('1');
  });

  it('une tentative REFUSÉE se distingue — et pas par la couleur seule', () => {
    monter();
    const html = fixture.nativeElement as HTMLElement;
    const lignes = [...html.querySelectorAll('tbody tr')];
    expect(lignes.length).toBe(2);
    // Le mot, d'abord : la distinction est lisible, pas seulement visible.
    expect(lignes[0].textContent).toContain('Acceptée');
    expect(lignes[1].textContent).toContain('Refusée');
    // La teinte de ligne vient EN PLUS, jamais seule.
    expect(lignes[0].classList.contains('cx__ligne--echec')).toBe(false);
    expect(lignes[1].classList.contains('cx__ligne--echec')).toBe(true);
  });

  it('un login inconnu est nommé — c’est la ligne qu’on vient regarder', () => {
    // `acteur` est nul : il n'y a personne à désigner, mais le login TENTÉ, lui, est journalisé.
    monter();
    expect(texte()).toContain('intrus.inconnu');
    expect(texte()).toContain('login inconnu');
  });

  it('dit la durée, l’instant et le poste ; une session non fermée n’a pas de durée inventée', () => {
    monter();
    expect(texte()).toContain('17/09/2026 08:32');
    expect(texte()).toContain('1 h 30');
    expect(texte()).toContain('Chrome · Windows');
    // L'échec n'a ni fin ni durée : un tiret, pas un zéro.
    expect(texte()).toContain('curl');
  });

  it('une connexion réussie sans déconnexion se dit « non fermée », pas « en cours »', () => {
    // Fermer son onglet ne déconnecte pas : rien ne permet de distinguer les deux cas, et l'écran
    // ne tranche donc pas à la place du serveur.
    monter({ reponse: page([{ ...LIGNES[0], dateDeconnexion: null, dureeSecondes: null }]) });
    expect(texte()).toContain('non fermée');
  });

  it('journal VIDE : l’état courant du démarrage est soigné, et dit pourquoi il est vide', () => {
    monter({ reponse: page([]) });
    expect(texte()).toContain('Le journal des connexions est vide');
    expect(texte()).toContain('que les connexions postérieures à sa mise en service');
    // Pas de tableau à sept colonnes vides derrière.
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody')).toBeNull();
  });

  it('aucun résultat ≠ journal vide : le second se corrige en retirant un filtre', () => {
    const ecran = monter({ reponse: page([]) });
    ecran.form.setValue({ acteur: 'INCONNU', succes: '', du: '', au: '' });
    ecran.appliquer();
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/sessions').flush(page([]));
    fixture.detectChanges();
    expect(texte()).toContain('Aucune connexion ne correspond à ces critères');
    expect(texte()).toContain('Retirer les filtres');
  });

  it('chargement ANNONCÉ : un lecteur d’écran l’apprend (role="status")', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConnexionsJournal);
    fixture.detectChanges();
    const statut = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(statut?.textContent).toContain('Chargement');
    http.expectOne((r) => r.url === '/api/sessions').flush(page(LIGNES));
    fixture.detectChanges();
  });

  it('échec du serveur : l’état d’erreur reste À L’ÉCRAN, avec sa reprise', () => {
    // Un toast disparaît et laisse l'utilisateur devant un écran vide, sans explication ni moyen de
    // relancer (AUDIT.md P9).
    const ecran = monter({ reponse: null });
    expect(ecran.erreur()).toBe(true);
    expect(texte()).toContain('Impossible de charger le journal des connexions');
    ecran.recharger();
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/sessions').flush(page(LIGNES));
    fixture.detectChanges();
    expect(texte()).toContain('m.rakotomalala');
  });

  it('s’ouvre déjà filtré quand l’accueil ou une fiche l’y envoie — et le filtre est VISIBLE', () => {
    const ecran = monter({ succesInitial: false, acteurInitial: 'CTR0142' });
    expect(ecran.form.getRawValue()).toEqual({ acteur: 'CTR0142', succes: 'false', du: '', au: '' });
    // Le filtre de départ a bien servi la première lecture, il n'est pas décoratif.
    ecran.appliquer();
    fixture.detectChanges();
    const params = derniereRequete();
    expect(params.get('succes')).toBe('false');
    expect(params.get('acteur')).toBe('CTR0142');
  });

  it('rend le User-Agent TEL QUEL quand il n’est pas reconnu : pas de catégorie inventée', () => {
    const ecran = monter();
    expect(ecran.poste('AgentMaison/1.0')).toBe('AgentMaison/1.0');
    expect(ecran.poste(null)).toBe('—');
  });

  it('une durée se lit en secondes, minutes ou heures, jamais en secondes brutes', () => {
    const ecran = monter();
    expect(ecran.duree(42)).toBe('42 s');
    expect(ecran.duree(1080)).toBe('18 min');
    expect(ecran.duree(7500)).toBe('2 h 05');
    expect(ecran.duree(7200)).toBe('2 h');
  });
});
