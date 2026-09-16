import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { NotificationsStore } from '../../core/notifications/notifications.store';
import { Notification, Role } from '../../models';
import { NotificationCenter } from './notification-center';

@Component({ selector: 'app-ecran-factice', template: '<h1>Écran</h1>' })
class EcranFactice {}

/**
 * ⚠️ Lot L5-F6 (2026-09-16) — « 403 silencieux » de la cloche.
 *
 * Une notification qui ne mène nulle part était quand même un `<button>` : le clic lançait
 * `GET /api/dossiers/{id}` pour ouvrir la modale de consultation, le serveur refusait au Chargé de
 * publication et à l'Administrateur, et `error: () => {}` avalait le refus. Il ne se passait rien,
 * sans un mot — et une requête partait pour rien à chaque clic.
 *
 * Ces tests montrent les deux moitiés du correctif : AUCUNE requête, et AUCUN bouton. Ils utilisent
 * les services RÉELS sur `HttpTestingController` — mocker le service de dossiers prouverait qu'on ne
 * l'appelle pas, pas qu'aucune requête ne part.
 */
const notifSansEcran = (idDossier?: number): Notification => ({
  idNotification: 7,
  idDossier,
  typeNotif: 'DOSSIER_CLOTURE',
  typeObjet: 'DOSSIER',
  titre: 'Dossier clôturé',
  corps: 'Le dossier 42 a été clôturé.',
  dateEnvoi: '2026-09-15T09:00:00',
  lu: true,
});

describe('Cloche — notification sans écran dédié (lot L5-F6)', () => {
  const monter = async (role: Role, notifs: Notification[]) => {
    TestBed.configureTestingModule({
      imports: [NotificationCenter],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'publication/publications', component: EcranFactice },
          { path: 'membre/dossier/:id', component: EcranFactice },
          { path: 'admin/inscriptions', component: EcranFactice },
        ]),
        {
          provide: AuthService,
          useValue: { role: signal(role), login: signal('X'), localite: signal(null), isAuthenticated: () => false },
        },
        { provide: NotificationsStore, useValue: { count: signal(0), actionLocale: () => undefined, revision: signal(0) } },
      ],
    });
    const fixture = TestBed.createComponent(NotificationCenter);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    // Ouvre le panneau : c'est le seul appel attendu de tout le scénario.
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.notif__bell')?.click();
    fixture.detectChanges();
    http.expectOne('/api/notifications/mes').flush(notifs);
    fixture.detectChanges();
    return { fixture, http, hote: fixture.nativeElement as HTMLElement };
  };

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  for (const role of ['CHARGE_PUBLICATION', 'ADMINISTRATEUR'] as const) {
    it(`${role} : la ligne n'est pas un bouton, porte la mention, et n'émet AUCUNE requête`, async () => {
      const { http, hote } = await monter(role, [notifSansEcran(42)]);

      const inerte = hote.querySelector('.notif__item--inerte') as HTMLElement;
      expect(inerte).not.toBeNull();
      expect(inerte.tagName.toLowerCase()).toBe('div');
      expect(hote.querySelectorAll('button.notif__item').length).toBe(0);
      expect(inerte.querySelector('.notif__item-note')?.textContent?.trim()).toBe(
        'Aucun écran dédié à votre profil pour ce dossier.',
      );
      // Le titre et le corps restent lisibles : on retire l'action, pas l'information.
      expect(inerte.textContent).toContain('Dossier clôturé');
      expect(inerte.textContent).toContain('Le dossier 42 a été clôturé.');

      // Le clic ne peut rien déclencher — il n'y a plus de gestionnaire. Rien ne part.
      inerte.click();
      http.expectNone('/api/dossiers/42');
      http.expectNone('/api/notifications/7/lu');
    });
  }

  it('sans objet, la mention ne parle pas de dossier', async () => {
    const { hote } = await monter('CHARGE_PUBLICATION', [notifSansEcran(undefined)]);
    expect(hote.querySelector('.notif__item-note')?.textContent?.trim()).toBe(
      'Aucun écran dédié à votre profil.',
    );
  });

  it("Chargé de publication : une notification qui, elle, a son écran reste actionnable", async () => {
    const { fixture, http, hote } = await monter('CHARGE_PUBLICATION', [
      { ...notifSansEcran(42), typeNotif: 'CLOTURE_ELIGIBLE', lu: true },
    ]);
    expect(hote.querySelector('.notif__item--inerte')).toBeNull();
    const bouton = hote.querySelector('button.notif__item') as HTMLButtonElement;
    expect(bouton).not.toBeNull();

    bouton.click();
    await fixture.whenStable();
    // L'écran d'action est atteint sans passer par le serveur.
    http.expectNone('/api/dossiers/42');
    expect(TestBed.inject(Router).url).toBe('/publication/publications');
  });

  it('Membre : rien ne change — le repli mène toujours à la PAGE du dossier (lot L4-F6)', async () => {
    const { fixture, http, hote } = await monter('MEMBRE', [notifSansEcran(42)]);
    expect(hote.querySelector('.notif__item--inerte')).toBeNull();
    const bouton = hote.querySelector('button.notif__item') as HTMLButtonElement;
    expect(bouton).not.toBeNull();

    bouton.click();
    await fixture.whenStable();
    http.expectNone('/api/dossiers/42');
    expect(TestBed.inject(Router).url).toContain('/membre/dossier/42');
  });

  it("Administrateur : une notification routée (inscription) reste un bouton", async () => {
    const { fixture, http, hote } = await monter('ADMINISTRATEUR', [
      { ...notifSansEcran(undefined), typeNotif: 'NOUVELLE_INSCRIPTION', typeObjet: 'COMPTE', lu: true },
    ]);
    expect(hote.querySelector('.notif__item--inerte')).toBeNull();
    (hote.querySelector('button.notif__item') as HTMLButtonElement).click();
    await fixture.whenStable();
    http.expectNone('/api/dossiers/42');
    expect(TestBed.inject(Router).url).toBe('/admin/inscriptions');
  });
});
