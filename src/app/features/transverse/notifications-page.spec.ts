import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { NotificationsStore } from '../../core/notifications/notifications.store';
import { Notification, Role } from '../../models';
import { NotificationsPage } from './notifications-page';

@Component({ selector: 'app-ecran-factice', template: '<h1>Écran</h1>' })
class EcranFactice {}

/**
 * ⚠️ Lot L5-F6 (2026-09-16) — même correctif que la cloche, sur l'écran dédié : une notification qui
 * ne mène nulle part n'est plus un bouton et n'appelle plus le serveur. Elle reste MARQUABLE lue :
 * les boutons de droite sont une autre commande, qui, elle, agit.
 */
const notif = (over: Partial<Notification> = {}): Notification => ({
  idNotification: 7,
  idDossier: 42,
  typeNotif: 'DOSSIER_CLOTURE',
  typeObjet: 'DOSSIER',
  titre: 'Dossier clôturé',
  dateEnvoi: '2026-09-15T09:00:00',
  lu: true,
  ...over,
});

describe('Page /notifications — notification sans écran dédié (lot L5-F6)', () => {
  const monter = async (role: Role, notifs: Notification[]) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'notifications', component: NotificationsPage },
          { path: 'membre/dossier/:id', component: EcranFactice },
        ]),
        {
          provide: AuthService,
          useValue: { role: signal(role), login: signal('X'), localite: signal(null), isAuthenticated: () => false },
        },
        { provide: NotificationsStore, useValue: { count: signal(0), actionLocale: () => undefined, revision: signal(0) } },
      ],
    });
    await TestBed.inject(Router).navigateByUrl('/notifications');
    const fixture = TestBed.createComponent(NotificationsPage);
    const http = TestBed.inject(HttpTestingController);
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
    it(`${role} : ligne inerte, mention explicite, aucune requête — mais toujours marquable lue`, async () => {
      const { hote, http } = await monter(role, [notif()]);

      const inerte = hote.querySelector('.np__corps--inerte') as HTMLElement;
      expect(inerte).not.toBeNull();
      expect(inerte.tagName.toLowerCase()).toBe('div');
      expect(hote.querySelectorAll('button.np__corps').length).toBe(0);
      expect(inerte.querySelector('.np__note')?.textContent?.trim()).toBe(
        'Aucun écran dédié à votre profil pour ce dossier.',
      );
      inerte.click();
      http.expectNone('/api/dossiers/42');

      // La commande qui, elle, agit reste offerte.
      const marquer = hote.querySelector('.np__actions button') as HTMLButtonElement;
      expect(marquer.textContent?.trim()).toBe('Marquer non lue');
      marquer.click();
      http.expectOne('/api/notifications/7/non-lu').flush(notif({ lu: false }));
    });
  }

  it('Membre : la ligne reste un bouton et mène à la page du dossier, sans appel au serveur', async () => {
    const { fixture, hote, http } = await monter('MEMBRE', [notif()]);
    expect(hote.querySelector('.np__corps--inerte')).toBeNull();
    (hote.querySelector('button.np__corps') as HTMLButtonElement).click();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    http.expectNone('/api/dossiers/42');
    expect(TestBed.inject(Router).url).toContain('/membre/dossier/42');
  });

  it("Chargé de publication : une notification routée garde son bouton", async () => {
    const { hote } = await monter('CHARGE_PUBLICATION', [notif({ typeNotif: 'CLOTURE_ELIGIBLE' })]);
    expect(hote.querySelector('.np__corps--inerte')).toBeNull();
    expect(hote.querySelector('button.np__corps')).not.toBeNull();
  });
});
