import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToastService } from '../../core/notifications/toast.service';
import { ControleResultat } from '../../models';
import { ControlesDossier } from './controles-dossier';

const ligne = (p: Partial<ControleResultat>): ControleResultat => ({
  idControle: 1, numeroSoumission: 1, reference: null, idPointCtrl: null, regle: 'R', libelle: null, valeurs: null, resultat: 'CONFORME', bloquant: false, auteur: 'SERVEUR', dateControle: '2026-10-13T10:00:00', observation: null,
  ...p,
});

const LISTE: ControleResultat[] = [
  ligne({ idControle: 1, regle: 'DELAI_PUBLICITE', reference: '2-II P2', libelle: 'Délai de publicité', resultat: 'CONFORME', bloquant: true, valeurs: { constate: 32, requis: 30 } }),
  ligne({ idControle: 2, regle: 'DOCUMENTS_EVALUATION_SIGNES', reference: '2-III-A P5', libelle: "Documents d'évaluation signés", resultat: 'NON_CONFORME', valeurs: { pvOuvertureSigne: false } }),
];

describe('Contrôles du dossier — composant (manuel révisé, R5)', () => {
  let fixture: ComponentFixture<ControlesDossier>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (): string => {
    const marche = document.createTreeWalker(racine(), NodeFilter.SHOW_TEXT);
    const morceaux: string[] = [];
    while (marche.nextNode()) morceaux.push(marche.currentNode.textContent ?? '');
    return morceaux.join(' ').replace(/\s+/g, ' ').trim();
  };

  function monter(controles: ControleResultat[], editable: boolean): void {
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ imports: [ControlesDossier], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ControlesDossier);
    fixture.componentRef.setInput('idDossier', 100378);
    fixture.componentRef.setInput('controles', controles);
    fixture.componentRef.setInput('editable', editable);
    fixture.componentRef.setInput('points', [{ idPointCtrl: 7, libelPointCtrl: 'Fractionnement', obligatoire: true, idTypeDossier: 'DMC' }]);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('lecture : le bilan, une ligne par règle effective avec ses valeurs, sans aucun geste', () => {
    monter(LISTE, false);
    const t = texte();
    expect(t).toContain('1 conforme(s) 1 non conforme(s) 1 sans objet'.replace('1 sans objet', '0 sans objet'));
    expect(t).toContain("2-III-A P5 Documents d'évaluation signés DOCUMENTS_EVALUATION_SIGNES Non conforme pvOuvertureSigne : non automatique");
    expect(t).toContain('Conforme bloquant constate : 32 · requis : 30');
    expect(racine().querySelectorAll('tbody tr').length).toBe(2);
    expect(Array.from(racine().querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual(['Exporter en PDF']);
  });

  it('sans contrôle, le dit ; en mode éditable, propose d’en poser', () => {
    monter([], true);
    expect(texte()).toContain('Aucun contrôle enregistré pour ce dossier — les contrôles automatiques s’écrivent à la soumission');
    expect(racine().querySelector('table')).toBeNull();
    expect(Array.from(racine().querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual(['+ Ajouter un contrôle']);
  });

  it('lever une non-conformité : le Membre pose CONFORME ou sans objet sur la même règle, avec son observation ; l’hôte est prévenu', () => {
    monter(LISTE, true);
    const changements: ControleResultat[] = [];
    fixture.componentInstance.pose.subscribe((c) => changements.push(c));
    const lever = Array.from(racine().querySelectorAll<HTMLButtonElement>('tbody button')).find((b) => b.textContent?.includes('Lever'))!;
    lever.click();
    fixture.detectChanges();
    const form = racine().querySelector('form')!;
    expect(form.getAttribute('aria-label')).toBe('Lever ou reposer le contrôle 2-III-A P5');
    // Levée sans observation : possible (observation facultative hors NON_CONFORME).
    expect(fixture.componentInstance.complete()).toBe(true);
    fixture.componentInstance.modifier('resultat', 'NON_APPLICABLE');
    fixture.componentInstance.modifier('observation', 'Séance tenue hors ligne, PV papier joint.');
    fixture.detectChanges();
    form.dispatchEvent(new Event('submit'));
    const req = http.expectOne('/api/dossiers/100378/controles');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ resultat: 'NON_APPLICABLE', observation: 'Séance tenue hors ligne, PV papier joint.', bloquant: false, regle: 'DOCUMENTS_EVALUATION_SIGNES', reference: '2-III-A P5', libelle: "Documents d'évaluation signés" });
    req.flush(ligne({ idControle: 9, regle: 'DOCUMENTS_EVALUATION_SIGNES', resultat: 'NON_APPLICABLE', auteur: 'IM1' }));
    fixture.detectChanges();
    expect(changements.length).toBe(1);
    expect(toast.success).toHaveBeenCalled();
    expect(racine().querySelector('form')).toBeNull();
  });

  it('ajouter un contrôle B sur un point de grille : NON_CONFORME exige une observation ; le corps porte idPointCtrl', () => {
    monter([], true);
    racine().querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.complete()).toBe(false);
    fixture.componentInstance.poserPoint('7');
    fixture.componentInstance.modifier('observation', 'Lot découpé pour contourner le seuil.');
    fixture.componentInstance.modifier('bloquant', true);
    fixture.detectChanges();
    expect(fixture.componentInstance.complete()).toBe(true);
    racine().querySelector('form')!.dispatchEvent(new Event('submit'));
    const req = http.expectOne('/api/dossiers/100378/controles');
    expect(req.request.body).toEqual({ resultat: 'NON_CONFORME', observation: 'Lot découpé pour contourner le seuil.', bloquant: true, idPointCtrl: 7, reference: null, libelle: 'Fractionnement' });
    req.flush({ code: 'EXAMEN_ABSENT' }, { status: 409, statusText: 'Conflit' });
    fixture.detectChanges();
    expect(texte()).toContain("L'examen n'est pas ouvert");
    expect(racine().querySelector('form')).not.toBeNull();
  });

  it('exporte la synthèse PDF sous son nom serveur', () => {
    monter(LISTE, false);
    const cree = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const liens: HTMLAnchorElement[] = [];
    const creer = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = creer(tag);
      if (tag === 'a') {
        vi.spyOn(el, 'click').mockImplementation(() => undefined);
        liens.push(el as HTMLAnchorElement);
      }
      return el;
    });
    racine().querySelector<HTMLButtonElement>('button')!.click();
    http.expectOne('/api/dossiers/100378/controles/pdf').flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    fixture.detectChanges();
    expect(cree).toHaveBeenCalledTimes(1);
    expect(liens.map((l) => l.download)).toEqual(['CONTROLES_100378.pdf']);
    vi.restoreAllMocks();
  });
});
