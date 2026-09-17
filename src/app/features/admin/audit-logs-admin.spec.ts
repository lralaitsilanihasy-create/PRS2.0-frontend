import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { vi } from 'vitest';

import { AuditLogsAdmin } from './audit-logs-admin';

/**
 * Lot 6 F5 — le Journal et ses deux onglets.
 *
 * Ce qui est éprouvé ici n'est pas le contenu des deux journaux (chacun a son propre fichier de
 * tests) mais la **coupure entre eux** :
 *
 * 1. l'onglet d'ouverture reste **Actions** — l'écran existait avant, personne ne doit être
 *    dérouté ;
 * 2. **un seul journal est lu à la fois.** Arriver sur les connexions ne doit pas demander au
 *    serveur une page d'audit que personne n'ouvrira, et réciproquement ;
 * 3. l'onglet est **dans l'URL** : c'est ce qui permet à l'accueil et à une fiche d'annuaire d'y
 *    renvoyer directement, filtre compris ;
 * 4. les deux onglets respectent le motif ARIA « tablist » — sans `aria-selected` ni `tabindex`
 *    roulant, un lecteur d'écran n'annonce pas lequel est ouvert et le clavier ne peut plus en
 *    changer.
 */
describe('AuditLogsAdmin — le Journal, deux onglets', () => {
  let fixture: ComponentFixture<AuditLogsAdmin>;
  let http: HttpTestingController;

  /** Monte l'écran avec les paramètres d'URL donnés, sans répondre aux requêtes. */
  function monter(parametres: Record<string, string> = {}): AuditLogsAdmin {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(parametres) } } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuditLogsAdmin);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const onglets = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')] as HTMLButtonElement[];

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('s’ouvre sur « Actions » et ne lit QUE le journal d’audit', () => {
    const ecran = monter();
    expect(ecran.onglet()).toBe('actions');
    http.expectOne((r) => r.url === '/api/audit-logs').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });
    http.expectNone((r) => r.url === '/api/sessions');
  });

  it('`?journal=connexions` ouvre les connexions et ne lit PAS le journal d’audit', () => {
    // Demander une page que personne n'ouvrira est un appel de trop sur une table qui grossit sans fin.
    const ecran = monter({ journal: 'connexions' });
    expect(ecran.onglet()).toBe('connexions');
    http.expectOne((r) => r.url === '/api/sessions').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });
    http.expectNone((r) => r.url === '/api/audit-logs');
  });

  it('un `?journal=` inattendu retombe sur « Actions », il ne casse pas l’écran', () => {
    const ecran = monter({ journal: 'nimporte-quoi' });
    expect(ecran.onglet()).toBe('actions');
    http.expectOne((r) => r.url === '/api/audit-logs').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });
  });

  it('`?succes=false` ouvre les connexions sur les tentatives refusées (lien de l’accueil)', () => {
    monter({ journal: 'connexions', succes: 'false' });
    const req = http.expectOne((r) => r.url === '/api/sessions');
    expect(req.request.params.get('succes')).toBe('false');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });
  });

  it('`?acteur=` ouvre les connexions d’une personne (lien « Ses connexions »)', () => {
    monter({ journal: 'connexions', acteur: 'CTR0142' });
    const req = http.expectOne((r) => r.url === '/api/sessions');
    expect(req.request.params.get('acteur')).toBe('CTR0142');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });
  });

  it('un `?succes=` illisible ne filtre RIEN : on n’ouvre pas un journal amputé en silence', () => {
    monter({ journal: 'connexions', succes: 'peut-être' });
    const req = http.expectOne((r) => r.url === '/api/sessions');
    expect(req.request.params.has('succes')).toBe(false);
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });
  });

  it('changer d’onglet charge l’autre journal, une seule fois', () => {
    const ecran = monter();
    http.expectOne((r) => r.url === '/api/audit-logs').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });

    ecran.ouvrir('connexions');
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/sessions').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });

    // Retour sur « Actions » : la page est déjà en mémoire, on ne la redemande pas.
    ecran.ouvrir('actions');
    fixture.detectChanges();
    http.expectNone(() => true);
    expect(ecran.onglet()).toBe('actions');
  });

  it('les deux onglets disent lequel est ouvert, et le clavier peut en changer', () => {
    const ecran = monter();
    http.expectOne((r) => r.url === '/api/audit-logs').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });

    const [actions, connexions] = onglets();
    expect(actions.getAttribute('aria-selected')).toBe('true');
    expect(connexions.getAttribute('aria-selected')).toBe('false');
    // `tabindex` roulant : la tabulation entre dans la barre d'onglets par celui qui est ouvert.
    expect(actions.getAttribute('tabindex')).toBe('0');
    expect(connexions.getAttribute('tabindex')).toBe('-1');
    expect(actions.getAttribute('aria-controls')).toBe('al-panneau-actions');

    ecran.clavier(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(ecran.onglet()).toBe('connexions');
    http.expectOne((r) => r.url === '/api/sessions').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });
  });

  it('une touche qui n’est pas une flèche ne change pas d’onglet', () => {
    const ecran = monter();
    http.expectOne((r) => r.url === '/api/audit-logs').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });
    ecran.clavier(new KeyboardEvent('keydown', { key: 'a' }));
    expect(ecran.onglet()).toBe('actions');
  });
});
