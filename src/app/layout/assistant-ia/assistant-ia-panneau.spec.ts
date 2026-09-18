import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';

import { EtatAssistantIa, EvenementAssistantIa } from '../../models/assistant-ia.model';
import { AssistantIaService } from '../../services/assistant-ia.services';
import { AssistantIaPanneau } from './assistant-ia-panneau';

const ETAT: EtatAssistantIa = {
  actif: true,
  disponible: true,
  modele: 'qwen3.5:9b-q4_K_M',
  documents: [
    { libelle: 'Manuel de contrôle a priori (CNM, février 2026)', passages: 135 },
    { libelle: 'Règles de gestion de PRS', passages: 180 },
  ],
};

/** Service factice : chaque question ouvre un flux que le test alimente, et compte les coupures. */
class FauxAssistant {
  flux = new Subject<EvenementAssistantIa>();
  questions: string[] = [];
  coupures = 0;

  etat(): Observable<EtatAssistantIa> {
    return of(ETAT);
  }

  poser(question: string): Observable<EvenementAssistantIa> {
    this.questions.push(question);
    this.flux = new Subject<EvenementAssistantIa>();
    const flux = this.flux;
    return new Observable((abonne) => {
      const s = flux.subscribe(abonne);
      return () => {
        this.coupures++;
        s.unsubscribe();
      };
    });
  }
}

/**
 * Panneau de l'assistant IA (lot 1) : ce que l'écran doit rendre visible pour rester une aide et non
 * un décideur — les sources de chaque réponse, les citations qui ouvrent leur extrait, la mention de
 * vérification — et les gestes : envoyer, interrompre, réessayer, fermer.
 */
describe('Panneau de l’assistant IA', () => {
  let faux: FauxAssistant;

  const monter = (etat: EtatAssistantIa = ETAT) => {
    faux = new FauxAssistant();
    TestBed.configureTestingModule({
      imports: [AssistantIaPanneau],
      providers: [{ provide: AssistantIaService, useValue: faux }],
    });
    const fixture = TestBed.createComponent(AssistantIaPanneau);
    fixture.componentRef.setInput('ouvert', true);
    fixture.componentRef.setInput('etat', etat);
    fixture.detectChanges();
    const hote = fixture.nativeElement as HTMLElement;
    const rendre = () => fixture.detectChanges();
    return { fixture, hote, rendre };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('accueille avec les documents consultés et des questions d’exemple, et rappelle qu’il ne décide pas', () => {
    const { hote } = monter();

    expect(hote.querySelector('.aia__sous-titre')?.textContent).toContain('il ne décide pas');
    expect([...hote.querySelectorAll('.aia__documents li')].map((li) => li.textContent?.trim())).toEqual([
      'Manuel de contrôle a priori (CNM, février 2026)',
      'Règles de gestion de PRS',
    ]);
    expect(hote.querySelectorAll('.aia__exemple').length).toBe(4);
    expect(hote.querySelector('.aia__mention')?.textContent).toContain('Il ne remplace ni le contrôleur ni l');
  });

  it('une question d’exemple part au clic ; la réponse s’écrit, ses citations ouvrent l’extrait cité', () => {
    const { hote, rendre } = monter();

    hote.querySelector<HTMLButtonElement>('.aia__exemple')?.click();
    rendre();
    expect(faux.questions).toEqual(['Quelles sont les seules formes de fractionnement autorisées ?']);
    expect(hote.querySelector('.aia__question')?.textContent).toContain('formes de fractionnement');
    expect(hote.querySelector('.aia__attente')).not.toBeNull();

    faux.flux.next({
      type: 'sources',
      sources: [{ numero: 1, document: 'Manuel', reference: 'p. 15', extrait: 'Les seules formes de fractionnement autorisées…' }],
    });
    faux.flux.next({ type: 'texte', texte: "L'allotissement, les tranches et les commandes " });
    faux.flux.next({ type: 'texte', texte: '[1].' });
    faux.flux.next({ type: 'fin', modele: 'qwen', dureeMs: 3000 });
    rendre();

    expect(hote.querySelector('.aia__attente')).toBeNull();
    expect(hote.querySelector('.aia__para')?.textContent).toContain("L'allotissement, les tranches et les commandes");
    const citation = hote.querySelector<HTMLButtonElement>('.aia__cite');
    expect(citation?.getAttribute('aria-label')).toBe('Source 1 : Manuel, p. 15');
    expect(hote.querySelector('.aia__sources-titre')?.textContent).toContain('Sources consultées');
    expect(hote.querySelector('.aia__extrait')).toBeNull();

    citation?.click();
    rendre();
    expect(citation?.getAttribute('aria-expanded')).toBe('true');
    expect(hote.querySelector('.aia__extrait')?.textContent).toContain('Les seules formes de fractionnement');
    expect(hote.querySelector('[role="status"][aria-live]')?.textContent).toContain('terminée');
  });

  it('une réponse qui ne cite aucun extrait (question hors des documents) replie ses extraits', () => {
    const { fixture, hote, rendre } = monter();
    fixture.componentInstance.envoyer('Quelle est la recette du romazava ?');
    faux.flux.next({
      type: 'sources',
      sources: [{ numero: 1, document: 'Règles', reference: 'Constats de recette', extrait: 'Recette du 2026-09-04…' }],
    });
    faux.flux.next({ type: 'texte', texte: 'Les extraits fournis ne traitent pas de cette question.' });
    faux.flux.next({ type: 'fin', modele: 'qwen', dureeMs: 2000 });
    rendre();

    const repli = hote.querySelector<HTMLDetailsElement>('details.aia__sources');
    expect(repli?.open).toBe(false);
    expect(repli?.querySelector('summary')?.textContent).toContain("Extraits consultés (1) — la réponse n'en cite aucun");
    expect(hote.querySelector('p.aia__sources-titre')).toBeNull();
  });

  it('en cas d’erreur, le message s’affiche à la place de la réponse et « Réessayer » repose la même question', () => {
    const { fixture, hote, rendre } = monter();
    fixture.componentInstance.envoyer('Quel délai ?');
    rendre();

    faux.flux.next({ type: 'erreur', message: 'Le service de calcul de l’assistant ne répond pas.' });
    faux.flux.complete();
    rendre();

    expect(hote.querySelector('[role="alert"]')?.textContent).toContain('ne répond pas');
    const reessayer = [...hote.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('Réessayer'));
    reessayer?.click();
    rendre();
    expect(faux.questions).toEqual(['Quel délai ?', 'Quel délai ?']);
  });

  it('« Arrêter » coupe la réponse en cours (le serveur cesse de calculer) et le dit', () => {
    const { fixture, hote, rendre } = monter();
    fixture.componentInstance.envoyer('Quel délai ?');
    faux.flux.next({ type: 'texte', texte: 'Le délai est ' });
    rendre();

    const arreter = [...hote.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Arrêter');
    arreter?.click();
    rendre();

    expect(faux.coupures).toBe(1);
    expect(hote.querySelector('.aia__note')?.textContent).toContain('Réponse interrompue');
    expect(hote.querySelector('.aia__para')?.textContent).toContain('Le délai est');
  });

  it('Entrée envoie la question, Maj+Entrée va à la ligne ; rien ne part pendant une réponse', () => {
    const { hote, rendre } = monter();
    const zone = hote.querySelector<HTMLTextAreaElement>('#aia-question')!;

    zone.value = 'Première question';
    zone.dispatchEvent(new Event('input'));
    zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    rendre();
    expect(faux.questions).toEqual([]);

    zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    rendre();
    expect(faux.questions).toEqual(['Première question']);

    zone.value = 'Deuxième question';
    zone.dispatchEvent(new Event('input'));
    zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    rendre();
    expect(faux.questions).toEqual(['Première question']);
  });

  it('prévient quand le service de calcul ne répond pas', () => {
    const { hote } = monter({ ...ETAT, disponible: false });

    expect(hote.querySelector('.alert-warning')?.textContent).toContain("ne répond pas pour l'instant");
  });

  it('se ferme par son bouton et par Échap', () => {
    const { fixture, hote } = monter();
    let fermetures = 0;
    fixture.componentInstance.fermer.subscribe(() => fermetures++);

    hote.querySelector<HTMLButtonElement>('.aia__fermer')?.click();
    hote.querySelector('#aia-question')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(fermetures).toBe(2);
  });

  it('fermé, le panneau est retiré de l’affichage et de l’arbre d’accessibilité, conversation conservée', () => {
    const { fixture, hote, rendre } = monter();
    fixture.componentInstance.envoyer('Quel délai ?');
    rendre();

    fixture.componentRef.setInput('ouvert', false);
    rendre();

    expect(hote.querySelector('aside')?.hidden).toBe(true);
    expect(fixture.componentInstance.echanges()).toHaveLength(1);
  });
});
