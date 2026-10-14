import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { routePourNotification } from '../../core/notifications/notification-route';
import { ToastService } from '../../core/notifications/toast.service';
import { Notification, QuestionCandidat, QuestionsProcedure } from '../../models';
import { QuestionsProcedureVue } from '../candidat/questions-procedure';
import { QuestionsDao } from './questions-dao';

// ⚠️ R7 (V109, 13/10 ; art. 35-II) — les questions des candidats ; contrat docs/api-endpoints.md, tranche R7.
const Q = (id: number, extra: Partial<QuestionCandidat> = {}): QuestionCandidat => ({
  id, idDmc: 40, question: `Question ${id}`, poseeLe: '2026-10-02T09:00:00', auteur: null, auteurCompte: null, mienne: false,
  etat: 'EN_ATTENTE', reponse: null, reponseNom: null, reponseTaille: null, repondueLe: null, publieeLe: null, ...extra,
});
const OUVERTES: QuestionsProcedure = { dateLimite: '2026-10-30T10:00', clotureLe: '2026-10-20', closes: false, joursAvantLimite: 10, questions: [] };

describe('R7 — les questions, côté candidat et public', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function monter(connecte: boolean) {
    const f = TestBed.createComponent(QuestionsProcedureVue);
    f.componentRef.setInput('idDmc', 40);
    f.componentRef.setInput('connecte', connecte);
    f.detectChanges();
    return f;
  }

  it('sans session : la fenêtre, les réponses diffusées anonymes, l’invitation à se connecter', () => {
    const f = monter(false);
    http.expectOne('/api/procedures-en-ligne/40/questions').flush({ ...OUVERTES, questions: [Q(1, { etat: 'REPONDUE', reponse: 'Oui, le lot 2 admet les variantes.', publieeLe: '2026-10-05T11:00:00', repondueLe: '2026-10-05T11:00:00' })] });
    f.detectChanges();
    const t = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(t).toContain('Questions recevables jusqu’au 20/10/2026 inclus');
    expect(t).toContain('Oui, le lot 2 admet les variantes.');
    expect(t).toContain('connectez-vous');
    expect((f.nativeElement as HTMLElement).querySelector('textarea')).toBeNull();
  });

  it('candidat connecté : ses questions, puis le refus DOSSIER_NON_RETIRE nommé', () => {
    const f = monter(true);
    http.expectOne('/api/procedures-en-ligne/40/questions').flush(OUVERTES);
    http.expectOne('/api/procedures-en-ligne/40/questions/miennes').flush([Q(3, { mienne: true })]);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('en attente de réponse');
    const champ = (f.nativeElement as HTMLElement).querySelector('textarea') as HTMLTextAreaElement;
    champ.value = 'Le délai d’exécution est-il ferme ?';
    champ.dispatchEvent(new Event('input'));
    f.detectChanges();
    (Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Poser la question')) as HTMLButtonElement).click();
    const post = http.expectOne((r) => r.method === 'POST' && r.url === '/api/procedures-en-ligne/40/questions');
    expect(post.request.body).toEqual({ question: 'Le délai d’exécution est-il ferme ?' });
    post.flush({ code: 'DOSSIER_NON_RETIRE', message: 'x' }, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('[role=alert]')?.textContent).toContain('ayant retiré le dossier');
  });

  it('closes : plus de formulaire, la date de clôture est dite', () => {
    const f = monter(true);
    http.expectOne('/api/procedures-en-ligne/40/questions').flush({ ...OUVERTES, closes: true });
    http.expectOne('/api/procedures-en-ligne/40/questions/miennes').flush([]);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('closes');
    expect((f.nativeElement as HTMLElement).querySelector('textarea')).toBeNull();
  });
});

describe('R7 — les questions, côté PRMP', () => {
  let http: HttpTestingController;
  function monter(role: string) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: AuthService, useValue: { role: signal(role), domainePrmpLabel: () => 'Ministère de recette' } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ idDmc: '40' }) } } }],
    });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(QuestionsDao);
    f.detectChanges();
    http.match('/api/fiches-marche/40').forEach((r) => r.flush(null));
    http.expectOne('/api/fiches-marche/40/questions').flush({ ...OUVERTES, questions: [Q(5, { auteur: 'Entreprise Une', auteurCompte: 'cand1@exemple.mg' })] });
    f.detectChanges();
    return f;
  }
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('la PRMP lit l’auteur et répond : la réponse part en multipart, la question passe « répondue et diffusée »', () => {
    const f = monter('PRMP');
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Entreprise Une (cand1@exemple.mg)');
    expect(el.textContent).toContain('1 question en attente de réponse');
    const champ = el.querySelector('textarea') as HTMLTextAreaElement;
    champ.value = 'Le délai est ferme.';
    champ.dispatchEvent(new Event('input'));
    f.detectChanges();
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Répondre et diffuser')) as HTMLButtonElement).click();
    const post = http.expectOne('/api/fiches-marche/40/questions/5/reponse');
    expect((post.request.body as FormData).get('texte')).toBe('Le délai est ferme.');
    expect((post.request.body as FormData).has('fichier')).toBe(false);
    post.flush(Q(5, { auteur: 'Entreprise Une', etat: 'REPONDUE', reponse: 'Le délai est ferme.', repondueLe: '2026-10-14T10:00:00', publieeLe: '2026-10-14T10:00:00' }));
    f.detectChanges();
    expect(el.textContent).toContain('Répondue et diffusée le 14/10/2026');
    expect(el.querySelector('textarea')).toBeNull();
  });

  it('l’UGPM lit sans pouvoir répondre', () => {
    const f = monter('UGPM');
    expect((f.nativeElement as HTMLElement).querySelector('textarea')).toBeNull();
  });
});

describe('R7 — la notification QUESTION_POSEE', () => {
  it('mène la PRMP et l’UGPM à l’écran des questions de la procédure', () => {
    const n = { typeNotif: 'QUESTION_POSEE', idObjet: 40 } as unknown as Notification;
    expect(routePourNotification(n, 'PRMP')).toEqual({ genre: 'route', commands: ['/prmp', 'dao', '40', 'questions'] });
    expect(routePourNotification(n, 'UGPM')).toEqual({ genre: 'route', commands: ['/prmp', 'dao', '40', 'questions'] });
  });
});
