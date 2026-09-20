import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SKIP_ERROR_TOAST } from '../core/errors/api-error';
import { EvenementAssistantIa } from '../models/assistant-ia.model';
import { AssistantIaService, lireEvenementsSse, versEvenementAssistant } from './assistant-ia.services';

const SOURCES = '[{"numero":1,"document":"Manuel","reference":"p. 15","extrait":"Fractionnement…"}]';

/** Flux SSE tel que le serveur l'écrit (Spring : `event:` puis `data:`, blocs séparés par une ligne vide). */
function sse(nom: string, donnees: string): string {
  return `event:${nom}\ndata:${donnees}\n\n`;
}

describe('Assistant IA — lecture du flux SSE', () => {
  it('découpe les événements complets et garde le morceau inachevé pour la suite', () => {
    const { evenements, reste } = lireEvenementsSse(sse('sources', SOURCES) + sse('texte', '{"t":"Le "}') + 'event:tex');

    expect(evenements).toEqual([
      { nom: 'sources', donnees: SOURCES },
      { nom: 'texte', donnees: '{"t":"Le "}' },
    ]);
    expect(reste).toBe('event:tex');
  });

  it('réunit les lignes data: d’un même événement, accepte les fins de ligne CRLF', () => {
    const { evenements } = lireEvenementsSse('event: texte\r\ndata: {"t":\r\ndata: "x"}\r\n\r\n');

    expect(evenements).toEqual([{ nom: 'texte', donnees: '{"t":\n"x"}' }]);
  });

  it('traduit les quatre événements du serveur et ignore un nom inconnu', () => {
    expect(versEvenementAssistant({ nom: 'texte', donnees: '{"t":"Bonjour"}' })).toEqual({ type: 'texte', texte: 'Bonjour' });
    expect(versEvenementAssistant({ nom: 'fin', donnees: '{"modele":"qwen","dureeMs":4200}' })).toEqual({
      type: 'fin',
      modele: 'qwen',
      dureeMs: 4200,
    });
    expect(versEvenementAssistant({ nom: 'erreur', donnees: '{"message":"Service en panne"}' })).toEqual({
      type: 'erreur',
      message: 'Service en panne',
    });
    expect(versEvenementAssistant({ nom: 'sources', donnees: SOURCES })).toEqual({
      type: 'sources',
      sources: [{ numero: 1, document: 'Manuel', reference: 'p. 15', extrait: 'Fractionnement…' }],
    });
    expect(versEvenementAssistant({ nom: 'ping', donnees: '{}' })).toBeNull();
  });
});

describe('AssistantIaService', () => {
  let service: AssistantIaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AssistantIaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("lit l'état sans toast d'erreur global (le panneau gère lui-même l'échec)", () => {
    service.etat().subscribe();

    const req = http.expectOne('/api/assistant-ia/etat');
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    req.flush({ actif: true, disponible: true, modele: 'qwen', documents: [] });
  });

  it('pose la question en POST et rend les événements au fil du téléchargement, puis se termine', () => {
    const recus: EvenementAssistantIa[] = [];
    let termine = false;
    service.poser('Le fractionnement ?').subscribe({ next: (e) => recus.push(e), complete: () => (termine = true) });

    const req = http.expectOne('/api/assistant-ia/questions');
    expect(req.request.method).toBe('POST');
    // ⚠️ Lot 4 : le corps porte aussi l'historique — vide au premier tour, jamais absent, pour que le
    // serveur n'ait pas à distinguer « pas d'historique » de « champ oublié ».
    expect(req.request.body).toEqual({ question: 'Le fractionnement ?', historique: [] });
    expect(req.request.headers.get('Accept')).toContain('text/event-stream');
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);

    const partie1 = sse('sources', SOURCES) + 'event:texte\ndata:{"t":"Un seul ';
    const partie2 = partie1 + 'marché [1]."}\n\n';
    const complet = partie2 + sse('fin', '{"modele":"qwen","dureeMs":3000}');
    req.event({ type: HttpEventType.DownloadProgress, loaded: partie1.length, partialText: partie1 });
    expect(recus.map((e) => e.type)).toEqual(['sources']);
    req.event({ type: HttpEventType.DownloadProgress, loaded: partie2.length, partialText: partie2 });
    expect(recus[1]).toEqual({ type: 'texte', texte: 'Un seul marché [1].' });
    req.flush(complet);

    expect(recus.map((e) => e.type)).toEqual(['sources', 'texte', 'fin']);
    expect(termine).toBe(true);
  });

  it("transforme un échec de la requête en événement d'erreur lisible, sans faire échouer le flux", () => {
    const recus: EvenementAssistantIa[] = [];
    let erreur = false;
    service.poser('Quel délai ?').subscribe({ next: (e) => recus.push(e), error: () => (erreur = true) });

    http.expectOne('/api/assistant-ia/questions').flush(
      { status: 404, message: "L'assistant IA n'est pas activé." },
      { status: 404, statusText: 'Not Found' },
    );

    expect(erreur).toBe(false);
    expect(recus).toEqual([{ type: 'erreur', message: "L'assistant IA n'est pas activé." }]);
  });

  it('coupe la requête quand on se désabonne (le serveur cesse alors de calculer)', () => {
    const abonnement = service.poser('Quel délai ?').subscribe();
    const req = http.expectOne('/api/assistant-ia/questions');

    abonnement.unsubscribe();

    expect(req.cancelled).toBe(true);
  });
});
