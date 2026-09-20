import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';

import { EvenementSyntheseIa, FaitsDossier } from '../../../models/assistant-ia.model';
import { AssistantIaService } from '../../../services/assistant-ia.services';
import { SyntheseDossier } from './synthese-dossier';

const FAITS: FaitsDossier = {
  idDossier: 840,
  reference: '00840/PPM/CNM/2026',
  sections: [
    { titre: 'Le dossier', lignes: ['Statut : en examen', 'Soumis le 02/06/2026 à 10h30'] },
    { titre: 'Délais', lignes: ['Temps consommé par la CNM : 37 heures ouvrées'] },
  ],
  outilsLus: ['dossier', 'délais'],
  outilsRefuses: ['journal du circuit'],
};

/** Service factice : chaque demande ouvre un flux que le test alimente, et compte les coupures. */
class FauxAssistant {
  flux = new Subject<EvenementSyntheseIa>();
  demandes: number[] = [];
  coupures = 0;

  synthetiserDossier(idDossier: number): Observable<EvenementSyntheseIa> {
    this.demandes.push(idDossier);
    this.flux = new Subject<EvenementSyntheseIa>();
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
 * ⚠️ Synthèse d'un dossier (assistant IA, lot 2, étape 4) — ce que l'écran doit rendre visible pour
 * rester une aide et non un décideur : **les faits d'abord**, ce que le profil n'a pas pu lire,
 * la mention de vérification, et un geste qui ne part jamais tout seul.
 */
describe('SyntheseDossier', () => {
  let faux: FauxAssistant;

  function monter() {
    faux = new FauxAssistant();
    TestBed.configureTestingModule({
      imports: [SyntheseDossier],
      providers: [{ provide: AssistantIaService, useValue: faux }],
    });
    const fixture = TestBed.createComponent(SyntheseDossier);
    fixture.componentRef.setInput('idDossier', 840);
    fixture.detectChanges();
    return fixture;
  }

  function texte(fixture: ReturnType<typeof monter>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function cliquer(fixture: ReturnType<typeof monter>, libelle: string) {
    const bouton = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes(libelle),
    );
    bouton?.click();
    fixture.detectChanges();
  }

  it("ne demande RIEN à l'ouverture : le modèle ne tourne que si on le lui demande", () => {
    const fixture = monter();

    expect(faux.demandes).toEqual([]);
    expect(texte(fixture)).toContain('Résumer ce dossier');
  });

  it('affiche les faits dès leur arrivée, avant le moindre mot de la rédaction', () => {
    const fixture = monter();
    cliquer(fixture, 'Résumer ce dossier');

    expect(faux.demandes).toEqual([840]);
    faux.flux.next({ type: 'faits', faits: FAITS });
    fixture.detectChanges();

    const rendu = texte(fixture);
    expect(rendu).toContain('Le dossier');
    expect(rendu).toContain('Temps consommé par la CNM : 37 heures ouvrées');
    expect(rendu).toContain("L'assistant rédige…");
  });

  it('⚠️ nomme ce que le profil n’a pas pu lire : une section absente ne disparaît pas en silence', () => {
    const fixture = monter();
    cliquer(fixture, 'Résumer ce dossier');
    faux.flux.next({ type: 'faits', faits: FAITS });
    fixture.detectChanges();

    expect(texte(fixture)).toContain('journal du circuit');
  });

  it('assemble la rédaction au fil du flux et affiche la mention de vérification à la fin', () => {
    const fixture = monter();
    cliquer(fixture, 'Résumer ce dossier');
    faux.flux.next({ type: 'faits', faits: FAITS });
    faux.flux.next({ type: 'texte', texte: '**Où en est ce dossier**\nLe dossier est ' });
    faux.flux.next({ type: 'texte', texte: 'en examen.' });
    faux.flux.next({
      type: 'fin',
      modele: 'modele-test',
      dureeMs: 8200,
      mention: 'Elle ne vaut pas avis : la décision appartient à la Commission.',
    });
    faux.flux.complete();
    fixture.detectChanges();

    const rendu = texte(fixture);
    expect(rendu).toContain('Le dossier est en examen.');
    expect(rendu).toContain('Elle ne vaut pas avis');
    expect(rendu).toContain('Refaire la synthèse');
  });

  it('⚠️ le bloc disparaît quand le serveur dit l’assistant absent (404) : pas de geste qui échouera toujours', () => {
    const fixture = monter();
    cliquer(fixture, 'Résumer ce dossier');
    faux.flux.next({ type: 'erreur', message: "L'assistant IA n'est pas activé.", statut: 404 });
    faux.flux.complete();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.sd')).toBeNull();
  });

  it('une panne passagère, elle, se dit et laisse reprendre', () => {
    const fixture = monter();
    cliquer(fixture, 'Résumer ce dossier');
    faux.flux.next({ type: 'erreur', message: "L'assistant n'a pas pu répondre.", statut: 503 });
    faux.flux.complete();
    fixture.detectChanges();

    const rendu = texte(fixture);
    expect(rendu).toContain("L'assistant n'a pas pu répondre.");
    expect(rendu).toContain('Refaire la synthèse');
  });

  it('⚠️ seuls les QUATRE titres attendus deviennent des sous-titres : le modèle remplit les sections, il ne les invente pas', () => {
    const fixture = monter();
    cliquer(fixture, 'Résumer ce dossier');
    faux.flux.next({
      type: 'texte',
      texte:
        '**Les délais**\nLa Commission a consommé 37 heures.\n\n**Mon avis sur ce dossier**\nCeci est inventé.',
    });
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const soustitres = [...element.querySelectorAll('.sd__soustitre')].map((h) => h.textContent?.trim());
    expect(soustitres).toEqual(['Les délais']);
    // Le titre inventé n'est pas perdu pour autant : il reste du gras dans le texte.
    expect(element.textContent).toContain('Mon avis sur ce dossier');
  });

  it('quitter la page coupe la génération : le serveur cesse de calculer', () => {
    const fixture = monter();
    cliquer(fixture, 'Résumer ce dossier');
    fixture.destroy();

    expect(faux.coupures).toBe(1);
  });
});
