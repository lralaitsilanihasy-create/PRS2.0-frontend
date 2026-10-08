import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, RouterLink, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import { Ami } from '../../models';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { AmiDao } from './ami-dao';

// AMI en ligne, tranche AMI-a (07/10, V82) — l'appel à manifestation d'intérêt, côté PRMP / UGPM.
const URL = '/api/fiches-marche/50/ami';
const BROUILLON: Ami = {
  idDmc: 50, etat: 'BROUILLON', objet: 'Étude de faisabilité', autoriteContractante: 'Ministère', reference: 'AMI-50', dateLimite: '2026-11-02T10:00:00',
  criteres: [{ code: 'C1', libelle: 'Expérience', poids: 60, description: null }, { code: 'C2', libelle: 'Références', poids: 40, description: null }],
  pieces: ['Lettre de manifestation signée'], noteMinimale: 70, nombreRetenus: 6, motifDispense: null, publications: [], avisDisponible: true,
  publieLe: null, publiePar: null, lectureOuverte: false, nombreExpressions: 0,
};

describe('Appel à manifestation d’intérêt, côté PRMP', () => {
  let fixture: ComponentFixture<AmiDao>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const bouton = (texte: string): HTMLButtonElement =>
    Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.includes(texte)) as HTMLButtonElement;

  function monter(role = 'PRMP'): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ idDmc: '50' }) } } },
        { provide: AuthService, useValue: { role: signal(role) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(AmiDao, { set: { imports: [EtatErreur, RouterLink], schemas: [CUSTOM_ELEMENTS_SCHEMA] } });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AmiDao);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('sans appel (404) : le formulaire vide, six retenus par défaut, enregistrement bloqué tant que le total ne fait pas 100', () => {
    monter();
    http.expectOne(URL).flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(racine().textContent).toContain('Préparer l’appel');
    expect((racine().querySelector('#ami-retenus') as HTMLInputElement).value).toBe('6');
    const c = fixture.componentInstance;
    c.poserCritere(c.criteres()[0].id, 'poids', '80');
    c.dateLimite.set('2026-11-02T10:00');
    c.poserCritere(c.criteres()[0].id, 'libelle', 'Expérience');
    fixture.detectChanges();
    expect(c.total()).toBe(80);
    expect(bouton('Enregistrer').disabled).toBe(true);
    c.poserCritere(c.criteres()[0].id, 'poids', '100');
    fixture.detectChanges();
    expect(bouton('Enregistrer').disabled).toBe(false);
  });

  it('enregistre la préparation (PUT) : secondes ajoutées, pièces vides écartées, refus nommé', () => {
    monter();
    http.expectOne(URL).flush(BROUILLON);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.ajouterPiece();
    c.dateLimite.set('2026-11-03T09:30');
    bouton('Enregistrer').click();
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === URL);
    expect(put.request.body).toEqual({
      dateLimite: '2026-11-03T09:30:00',
      criteres: [{ code: 'C1', libelle: 'Expérience', poids: 60, description: null }, { code: 'C2', libelle: 'Références', poids: 40, description: null }],
      pieces: ['Lettre de manifestation signée'],
      noteMinimale: 70,
      nombreRetenus: 6,
    });
    put.flush({ message: 'x', code: 'DATE_LIMITE_INVALIDE' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(racine().textContent).toContain('La date limite doit être à venir.');
  });

  it('la PRMP publie avec au moins un support daté ; l’UGPM ne voit pas le geste', () => {
    monter();
    http.expectOne(URL).flush(BROUILLON);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(bouton('Publier et signer').disabled).toBe(true);
    const id = c.publications()[0].id;
    c.poserPublication(id, 'support', 'Journal des marchés publics');
    c.poserPublication(id, 'date', '2026-10-08');
    fixture.detectChanges();
    bouton('Publier et signer').click();
    const post = http.expectOne(`${URL}/publier`);
    expect(post.request.body).toEqual({ publications: [{ support: 'Journal des marchés publics', date: '2026-10-08', reference: null }] });
    post.flush({ ...BROUILLON, etat: 'PUBLIE', publications: [{ support: 'Journal des marchés publics', date: '2026-10-08', reference: null }], publieLe: '2026-10-08T09:00:00' });
    fixture.detectChanges();
    expect(racine().textContent).toContain('Publié');
    expect(racine().textContent).toContain('Elles se lisent après la date limite');
    expect(racine().querySelector('#ami-prep')).toBeNull();

    TestBed.resetTestingModule();
    monter('UGPM');
    http.expectOne(URL).flush(BROUILLON);
    fixture.detectChanges();
    expect(racine().querySelector('#ami-prep')).not.toBeNull();
    expect(bouton('Publier et signer')).toBeUndefined();
  });

  it('après la date limite : les expressions se lisent', () => {
    monter();
    http.expectOne(URL).flush({ ...BROUILLON, etat: 'PUBLIE', lectureOuverte: true, nombreExpressions: 1 });
    http.expectOne(`${URL}/expressions`).flush([
      { id: 'e-1', numero: 1, nif: '1234567890', raisonSociale: 'Cabinet de recette', etat: 'DEPOSEE', deposeeLe: '2026-10-20T10:00:00', empreinte: 'abc',
        lettre: 'Nous manifestons notre intérêt.', qualifications: null, references: [], groupement: [], pieces: [{ id: 7, libelle: 'Lettre de manifestation signée', nom: 'p1-lettre.pdf', format: 'PDF', taille: 2048, empreinte: 'def' }] },
    ]);
    fixture.detectChanges();
    expect(racine().textContent).toContain('Cabinet de recette');
    expect(racine().textContent).toContain('Nous manifestons notre intérêt.');
  });
});
