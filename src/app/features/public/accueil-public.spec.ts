import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../core/auth/auth.service';
import { accueilPublicGuard } from '../../core/navigation/accueil-public.guard';
import { AccueilPublic } from './accueil-public';
import { CONTENU_PUBLIC, audienceDepuis } from './accueil-public-libelles';

describe('Entrée publique — /accueil/:audience (proposition 2026-09-22, arbitrée)', () => {
  let harness: RouterTestingHarness;
  const racine = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  async function ouvrir(url: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'accueil/:audience', component: AccueilPublic }]),
        { provide: AuthService, useValue: { isAuthenticated: () => false, role: () => null } },
      ],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
  }

  it('PRMP : onglet courant, barre « ce que vous pouvez faire » avec « Créer un compte PRMP », bannière, trois repères, trois cartes à liens', async () => {
    await ouvrir('/accueil/prmp');
    expect(texte(racine().querySelector('.pub-audience a[aria-current="page"]'))).toBe('PRMP & UGPM');
    expect(texte(racine().querySelector('h1'))).toBe(CONTENU_PUBLIC.prmp.titre);
    expect(Array.from(racine().querySelectorAll('.pub-nav__in a')).map(texte)).toEqual([
      'Déposer un plan de passation',
      'Suivre le contrôle',
      'Consulter les PV définitifs',
      'Créer un compte PRMP',
    ]);
    expect((racine().querySelector('.pub-nav__cta') as HTMLAnchorElement).getAttribute('href')).toBe('/inscription');
    expect(racine().querySelectorAll('.pub-repere').length).toBe(3);
    expect(Array.from(racine().querySelectorAll('.pub-carte h3')).map(texte)).toEqual(['Déposer un dossier', 'Suivre le contrôle', 'Consulter les PV']);
    // Mots-clés = liens vers l'écran concerné (derrière la session, authGuard mène à la connexion puis y revient).
    const mots = Array.from(racine().querySelectorAll<HTMLAnchorElement>('.pub-carte a.pub-mot'));
    expect(mots.length).toBeGreaterThanOrEqual(5);
    expect(mots.map((a) => a.getAttribute('href'))).toContain('/prmp/soumettre-dossier');
    expect((racine().querySelector('.pub-top__actions a') as HTMLAnchorElement).getAttribute('href')).toBe('/login');
    expect(document.title).toBe('PRMP & UGPM — PRS 2.0');
  });

  it('Commission : pas de « Créer un compte », une ancre vers le circuit, mots-clés en gras (l’écran dépend du profil)', async () => {
    await ouvrir('/accueil/commission');
    expect(texte(racine().querySelector('.pub-audience a[aria-current="page"]'))).toBe('Commission');
    expect(racine().querySelector('.pub-nav__cta')).toBeNull();
    expect(racine().querySelectorAll('.pub-carte a.pub-mot').length).toBe(0);
    expect(racine().querySelectorAll('.pub-carte strong.pub-mot--fixe').length).toBeGreaterThanOrEqual(5);
    const ancre = racine().querySelector('.pub-nav__in a[href="#circuit"]') as HTMLAnchorElement;
    expect(texte(ancre)).toBe('Le circuit de contrôle');
    expect(racine().querySelector('#circuit')).not.toBeNull();
    expect(Array.from(racine().querySelectorAll('.pub-hero__actions a')).map(texte)).toEqual(['Se connecter']);
  });

  it('une audience inconnue est ramenée à prmp (URL corrigée)', async () => {
    await ouvrir('/accueil/nimporte');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/accueil/prmp');
    expect(audienceDepuis('commission')).toBe('commission');
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
