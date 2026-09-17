import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import { CompteAuthResume, TypeActeur } from '../../models';
import { ActionsCompte } from './actions-compte';

/**
 * Lot 6 F4 — les trois gestes sur un compte de connexion, branchés sur des routes qui existaient
 * déjà et que le front n'appelait pas (ou par effet de bord). Ces tests portent sur ce qui part sur
 * le réseau : c'est le seul endroit où une confusion de login ou un geste non confirmé se voit.
 */
@Component({
  standalone: true,
  imports: [ActionsCompte],
  template: `
    <app-actions-compte [type]="type" [ref]="ref" [nom]="nom" [login]="login" (fermer)="ferme = true" />
  `,
})
class Hote {
  type: TypeActeur = 'PRMP';
  ref = 'PRMP000001';
  nom = 'Rasoa Voahangy';
  login: string | null = null;
  ferme = false;
}

const INACTIF = (ref: string, login: string, type: TypeActeur = 'PRMP'): CompteAuthResume => ({
  login,
  typeActeur: type,
  refActeur: ref,
  actif: false,
});

describe('ActionsCompte — suspendre, réactiver, réinitialiser', () => {
  let fixture: ComponentFixture<Hote>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };

  /** Monte la modale et répond à la lecture des comptes inactifs (la seule vue d'état du serveur). */
  function monter(
    options: { inactifs?: CompteAuthResume[]; hote?: Partial<Hote>; moi?: { login: string | null; ref: string | null; typeActeur: TypeActeur | null } } = {},
  ): ActionsCompte {
    const moi = options.moi ?? { login: 'admin01', ref: 'ADMIN01', typeActeur: 'CONTROLEUR' as TypeActeur };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        {
          provide: AuthService,
          useValue: {
            login: signal(moi.login),
            ref: signal(moi.ref),
            typeActeur: signal(moi.typeActeur),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Hote);
    Object.assign(fixture.componentInstance, options.hote ?? {});
    fixture.detectChanges();
    http.expectOne('/api/comptes-auth/en-attente').flush(options.inactifs ?? []);
    fixture.detectChanges();
    return fixture.debugElement.children[0].componentInstance as ActionsCompte;
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('lit l’état du compte : un compte inactif donne son login SANS qu’on ait à le saisir', () => {
    const modale = monter({ inactifs: [INACTIF('PRMP000001', 'r.voahangy')] });
    expect(modale.inactif()).toBe(true);
    expect(modale.loginConnu()).toBe('r.voahangy');
    expect(modale.loginCible()).toBe('r.voahangy');
  });

  it('ne confond pas deux personnes : même matricule, autre population', () => {
    // `refActeur` seul ne suffit pas — un IM_CONTROLEUR et un ID_PRMP peuvent coïncider.
    const modale = monter({ inactifs: [INACTIF('PRMP000001', 'quelqu.un', 'CONTROLEUR')] });
    expect(modale.inactif()).toBe(false);
    expect(modale.loginConnu()).toBeNull();
  });

  it('login inconnu (compte actif d’une PRMP) : aucune action ne part tant qu’il n’est pas saisi', () => {
    const modale = monter();
    expect(modale.loginConnu()).toBeNull();
    expect(modale.loginCible()).toBe('');

    modale.demander('suspendre');
    modale.confirmer();
    http.expectNone(() => true);

    modale.loginSaisi.setValue('r.voahangy');
    fixture.detectChanges();
    modale.confirmer();
    const requete = http.expectOne('/api/comptes-auth/r.voahangy/desactiver');
    expect(requete.request.method).toBe('POST');
    requete.flush({ login: 'r.voahangy', typeActeur: 'PRMP', refActeur: 'PRMP000001', actif: false });
    expect(modale.motDePasse()).toBeNull();
  });

  it('SUSPENDRE passe par une confirmation : demander ne suffit pas à envoyer', () => {
    const modale = monter({ hote: { login: 'r.voahangy' } });
    modale.demander('suspendre');
    fixture.detectChanges();
    expect(modale.confirmation()).toBe('suspendre');
    // Rien n'est parti : c'est `confirmer()` qui déclenche.
    http.expectNone(() => true);

    modale.confirmer();
    http.expectOne('/api/comptes-auth/r.voahangy/desactiver').flush({});
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('suspendu'));
  });

  it('REFUS de se suspendre soi-même — reconnu par l’acteur, avant même de connaître le login', () => {
    const modale = monter({
      hote: { type: 'CONTROLEUR', ref: 'ADMIN01', nom: 'Moi Même' },
      moi: { login: 'admin01', ref: 'ADMIN01', typeActeur: 'CONTROLEUR' },
    });
    expect(modale.estMonCompte()).toBe(true);

    modale.demander('suspendre');
    expect(modale.confirmation()).toBeNull();
    http.expectNone(() => true);
  });

  it('REFUS de se suspendre soi-même — reconnu aussi par le LOGIN, quand l’acteur diffère', () => {
    const modale = monter({
      hote: { login: 'admin01' },
      moi: { login: 'admin01', ref: 'AUTRE', typeActeur: 'CONTROLEUR' },
    });
    expect(modale.estMonCompte()).toBe(true);
    modale.demander('suspendre');
    http.expectNone(() => true);
  });

  it('RÉACTIVER un compte inactif : direct, sans confirmation — le geste rend un accès', () => {
    const modale = monter({ inactifs: [INACTIF('PRMP000001', 'r.voahangy')] });
    modale.reactiver();
    const requete = http.expectOne('/api/comptes-auth/r.voahangy/activer');
    expect(requete.request.method).toBe('POST');
    requete.flush({});
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('réactivé'));
  });

  it('RÉINITIALISER : confirmation, mot de passe tiré au sort, envoyé puis affiché UNE fois', () => {
    const modale = monter({ hote: { login: 'r.voahangy' } });
    modale.demander('reinitialiser');
    http.expectNone(() => true);

    modale.confirmer();
    const requete = http.expectOne('/api/comptes-auth/r.voahangy/reinitialiser-mot-de-passe');
    expect(requete.request.method).toBe('POST');
    const envoye = (requete.request.body as { nouveauMotDePasse: string }).nouveauMotDePasse;
    expect(envoye).toMatch(/^(?=.*\p{L})(?=.*\p{N}).{8,72}$/u);
    requete.flush({});
    fixture.detectChanges();

    // Affiché DANS la modale, jamais dans un toast : un toast s'efface, et il n'existe plus ailleurs.
    expect(modale.motDePasse()).toBe(envoye);
    expect(toast.success).not.toHaveBeenCalled();
    const texte = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texte).toContain(envoye);

    // Fermer l'efface : le composant est retiré, la valeur avec lui.
    modale.fermerAnime();
  });

  it('la modale se tient au clavier : nom accessible, champ nommé, refus expliqué et non caché', () => {
    const modale = monter({
      hote: { type: 'CONTROLEUR', ref: 'ADMIN01', nom: 'Moi Même' },
      moi: { login: 'admin01', ref: 'ADMIN01', typeActeur: 'CONTROLEUR' },
    });
    const page = fixture.nativeElement as HTMLElement;

    const dialogue = page.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialogue.getAttribute('aria-label')).toBe('Compte de connexion');
    expect(dialogue.hasAttribute('appModale')).toBe(true);

    // Nom accessible STABLE du champ : une étiquette, pas un texte de substitution.
    const champ = page.querySelector('input[type="text"]') as HTMLInputElement;
    expect(champ.closest('label')?.querySelector('.form-label')?.textContent).toContain('Login du compte');
    expect(champ.getAttribute('placeholder')).toBeNull();

    // Le refus est ÉCRIT, et le bouton reste visible mais désactivé : un bouton disparu n'explique rien.
    const suspendre = Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.includes('Suspendre'));
    expect(suspendre?.disabled).toBe(true);
    expect(page.textContent).toContain('C\'est votre propre compte');
    expect(modale.estMonCompte()).toBe(true);

    // Aucun élément cliquable qui ne soit pas un bouton ou un lien (acquis de l'audit).
    expect(page.querySelectorAll('div[click], span[click]').length).toBe(0);
  });

  it('un échec de lecture de l’état ne bloque rien : l’état est signalé, les actions restent ouvertes', () => {
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        { provide: AuthService, useValue: { login: signal('admin01'), ref: signal('ADMIN01'), typeActeur: signal('CONTROLEUR') } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Hote);
    fixture.componentInstance.login = 'r.voahangy';
    fixture.detectChanges();
    http.expectOne('/api/comptes-auth/en-attente').flush('', { status: 500, statusText: 'Erreur' });
    fixture.detectChanges();

    const modale = fixture.debugElement.children[0].componentInstance as ActionsCompte;
    expect(modale.echecEtat()).toBe(true);
    expect(modale.loginCible()).toBe('r.voahangy');
    modale.demander('suspendre');
    modale.confirmer();
    http.expectOne('/api/comptes-auth/r.voahangy/desactiver').flush({});
  });
});
