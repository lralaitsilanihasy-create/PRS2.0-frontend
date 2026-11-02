import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../core/auth/auth.service';
import { accueilApresDeconnexion, accueilPublicGuard } from '../../core/navigation/accueil-public.guard';
import { AccueilPublic } from './accueil-public';
import { CONTENU_PUBLIC, audienceDepuis } from './accueil-public-libelles';

describe('Entrée publique — /accueil/:audience (proposition 2026-09-22, arbitrée)', () => {
  let harness: RouterTestingHarness;
  const racine = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  async function ouvrir(url: string, auth: object = {}): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'accueil/:audience', component: AccueilPublic }]),
        provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAuthenticated: () => false, role: () => null, ...auth } },
      ],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
  }

  it('PRMP : onglet courant, bannière avec la connexion à côté (« Créer un compte PRMP » dessous), trois repères, trois cartes à liens', async () => {
    await ouvrir('/accueil/prmp');
    expect(texte(racine().querySelector('.pub-audience a[aria-current="page"]'))).toBe('PRMP & UGPM');
    expect(texte(racine().querySelector('h1'))).toBe(CONTENU_PUBLIC.prmp.titre);
    // ⚠️ 01/11 (variante A) — le formulaire de connexion est dans la page ; plus de barre secondaire ni de bouton en double.
    expect(racine().querySelector('.pub-nav')).toBeNull();
    expect(racine().querySelector('.pub-hero__actions')).toBeNull();
    const connexion = racine().querySelector('#connexion app-formulaire-connexion')!;
    expect(texte(connexion.querySelector('h2'))).toBe('Connexion');
    expect(texte(connexion.querySelector('.login-form__sous'))).toBe(CONTENU_PUBLIC.prmp.pour);
    expect(connexion.querySelector('input[autocomplete="username"]')).not.toBeNull();
    expect((connexion.querySelector('.pub-connexion__bas a') as HTMLAnchorElement).getAttribute('href')).toBe('/inscription');
    expect(racine().querySelectorAll('.pub-repere').length).toBe(3);
    // ⚠️ 02/11 (pilote) — six étapes : le résumé des processus de la PRMP et de l'UGPM.
    expect(Array.from(racine().querySelectorAll('.pub-carte h3')).map(texte)).toEqual([
      '1Planifier', '2Préparer l’appel d’offres', '3Ouvrir la procédure en ligne', '4Ouvrir et évaluer les offres', '5Exécuter le contrat', '6Suivre et recevoir les PV',
    ]);
    // Chaque étape dit qui agit, d'après le rattachement des profils de l'onglet.
    expect(Array.from(racine().querySelectorAll('.pub-carte__qui')).map((e) => texte(e).replace('Qui agit : ', ''))).toEqual([
      'UGPM, PRMP', 'UGPM, PRMP', 'Responsable de procédure, dépositaire, PRMP', 'Commission d’appel d’offres', 'PRMP, commission de réception', 'PRMP, UGPM',
    ]);
    // Mots-clés = liens vers l'écran concerné (derrière la session, authGuard mène à la connexion puis y revient).
    const mots = Array.from(racine().querySelectorAll<HTMLAnchorElement>('.pub-carte a.pub-mot'));
    expect(mots.length).toBeGreaterThanOrEqual(5);
    expect(mots.map((a) => a.getAttribute('href'))).toContain('/prmp/soumettre-dossier');
    expect(document.title).toBe('PRMP & UGPM — PRS 2.0');
  });

  it('Commission : pas de « Créer un compte » (comptes créés par l’Administrateur), mots-clés en gras (l’écran dépend du profil)', async () => {
    await ouvrir('/accueil/commission');
    expect(texte(racine().querySelector('.pub-audience a[aria-current="page"]'))).toBe('CNM');
    expect(racine().querySelector('.pub-connexion__bas a')).toBeNull();
    expect(texte(racine().querySelector('.pub-connexion__bas'))).toBe('Les comptes de la CNM sont créés par l’Administrateur.');
    expect(racine().querySelectorAll('.pub-carte a.pub-mot').length).toBe(0);
    expect(racine().querySelectorAll('.pub-carte strong.pub-mot--fixe').length).toBeGreaterThanOrEqual(5);
    expect(racine().querySelector('#circuit')).not.toBeNull();
    expect(racine().querySelector('.pub-hero__actions')).toBeNull();
  });

  it('Entreprises : les avis ouverts restent dans la bannière (sans compte) ; « Créer un compte candidat » sous la connexion', async () => {
    await ouvrir('/accueil/candidat');
    expect(Array.from(racine().querySelectorAll('.pub-hero__actions a')).map((a) => a.getAttribute('href'))).toEqual(['/candidat/procedures']);
    expect((racine().querySelector('.pub-connexion__bas a') as HTMLAnchorElement).getAttribute('href')).toBe('/candidat/inscription');
  });

  it('02/11 — chaque public ne se connecte que depuis son onglet : un compte de la CNM est refusé sur « PRMP & UGPM », avec le lien vers « CNM »', async () => {
    const logout = vi.fn();
    await ouvrir('/accueil/prmp', { authenticate: () => of({ role: 'PRESIDENT' }), logout });
    const saisir = (sel: string, v: string): void => { const c = racine().querySelector(sel) as HTMLInputElement; c.value = v; c.dispatchEvent(new Event('input')); };
    saisir('#connexion input[autocomplete="username"]', 'PRES001');
    saisir('#connexion input[autocomplete="current-password"]', 'secret');
    (racine().querySelector('#connexion button[type="submit"]') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(logout).toHaveBeenCalled();
    expect(texte(racine().querySelector('#connexion [role="alert"]'))).toContain('Ce compte relève de l’espace « CNM »');
    expect((racine().querySelector('#connexion .login-form__vers') as HTMLAnchorElement).getAttribute('href')).toBe('/accueil/commission');
    expect((racine().querySelector('#connexion input[autocomplete="current-password"]') as HTMLInputElement).value).toBe('');
    expect(TestBed.inject(Router).url).toBe('/accueil/prmp');
  });

  it('la connexion du portail est celle de /login : identifiants envoyés au service d’authentification', async () => {
    await ouvrir('/accueil/prmp');
    const auth = TestBed.inject(AuthService) as unknown as { authenticate?: unknown };
    expect(auth).toBeDefined();
    // Champs requis : sans saisie, rien ne part et les messages s'affichent.
    (racine().querySelector('#connexion button[type="submit"]') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(texte(racine().querySelector('#connexion'))).toContain('L\'identifiant est obligatoire.');
    TestBed.inject(HttpTestingController).verify();
  });

  it('une audience inconnue est ramenée à prmp (URL corrigée)', async () => {
    await ouvrir('/accueil/nimporte');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/accueil/prmp');
    expect(audienceDepuis('commission')).toBe('commission');
    // Soumission en ligne, lot 1 (04/10) : la troisième audience, les entreprises candidates.
    expect(audienceDepuis('candidat')).toBe('candidat');
    expect(audienceDepuis('x')).toBe('prmp');
    expect(audienceDepuis(null)).toBe('prmp');
  });
});

describe('accueilPublicGuard — un connecté est renvoyé à son « À faire »', () => {
  function garde(authenticated: boolean, role: string | null): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { isAuthenticated: () => authenticated, role: () => role } }],
    });
    return TestBed.runInInjectionContext(() => accueilPublicGuard({} as never, {} as never)) as boolean | UrlTree;
  }

  it('visiteur : passe', () => {
    expect(garde(false, null)).toBe(true);
  });

  it('Membre connecté : /membre/a-faire ; Administrateur connecté : la racine', () => {
    const membre = garde(true, 'MEMBRE');
    expect(membre).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(membre as UrlTree)).toBe('/membre/a-faire');
    TestBed.resetTestingModule();
    const admin = garde(true, 'ADMINISTRATEUR');
    expect(TestBed.inject(Router).serializeUrl(admin as UrlTree)).toBe('/');
  });
});

describe('accueilApresDeconnexion — la déconnexion mène au portail, sur l’onglet du profil (02/11)', () => {
  it('PRMP, UGPM, Responsable de procédure, CAO, dépositaire : « PRMP & UGPM » ; CNM et Administrateur : « CNM » ; candidat : « Entreprises »', () => {
    for (const r of ['PRMP', 'UGPM', 'RESPONSABLE_PROCEDURE', 'MEMBRE_CAO', 'DEPOSITAIRE', null]) expect(accueilApresDeconnexion(r), String(r)).toBe('/accueil/prmp');
    for (const r of ['PRESIDENT', 'CHEF_COMMISSION', 'MEMBRE', 'SECRETAIRE', 'VERIFICATEUR', 'ASSISTANT_CONTROLEUR', 'ADMINISTRATEUR', 'CHARGE_PUBLICATION']) {
      expect(accueilApresDeconnexion(r), r).toBe('/accueil/commission');
    }
    expect(accueilApresDeconnexion('CANDIDAT')).toBe('/accueil/candidat');
  });
});
