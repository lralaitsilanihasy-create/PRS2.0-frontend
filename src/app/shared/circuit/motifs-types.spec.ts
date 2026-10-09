import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MotifType } from '../../models';
import { MotifsTypes, insererTexte } from './motifs-types';

const MOTIFS: MotifType[] = [
  { idMotif: 1, idTypeDossier: 'DMC', idSousType: 'DAOO', nature: 'RENVOI', libelle: 'Critères de qualification', texte: 'Revoir les critères de qualification : …' },
  { idMotif: 2, idTypeDossier: 'DMC', idSousType: null, nature: 'RENVOI', libelle: 'Pièces manquantes', texte: 'Joindre les pièces suivantes : …' },
];

describe('Motifs-types de la conclusion (manuel de contrôle, M4 — V97)', () => {
  describe('insererTexte', () => {
    it('au curseur, sur une ligne à lui quand le texte autour n’en finit pas une', () => {
      expect(insererTexte('', 'Motif')).toEqual({ valeur: 'Motif', curseur: 5 });
      expect(insererTexte('Avant', 'Motif')).toEqual({ valeur: 'Avant\nMotif', curseur: 11 });
      expect(insererTexte('Avant\n', 'Motif')).toEqual({ valeur: 'Avant\nMotif', curseur: 11 });
      expect(insererTexte('AB', 'M', 1)).toEqual({ valeur: 'A\nM\nB', curseur: 3 });
    });

    it('remplace la sélection', () => {
      expect(insererTexte('Avant\nXXX\nAprès', 'Motif', 6, 9)).toEqual({ valeur: 'Avant\nMotif\nAprès', curseur: 11 });
    });
  });

  describe('le sélecteur', () => {
    let fixture: ComponentFixture<MotifsTypes>;
    let http: HttpTestingController;
    let emis: string[];
    const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [MotifsTypes], providers: [provideHttpClient(), provideHttpClientTesting()] });
      http = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(MotifsTypes);
      fixture.componentRef.setInput('idDossier', 42);
      fixture.componentRef.setInput('nature', 'RENVOI');
      emis = [];
      fixture.componentInstance.inserer.subscribe((t) => emis.push(t));
      fixture.detectChanges();
    });

    afterEach(() => http.verify());

    it('ne lit rien tant qu’on n’ouvre pas ; à l’ouverture, les motifs du dossier pour la nature', () => {
      expect(racine().querySelector('summary')?.textContent?.trim()).toBe('Insérer un motif de renvoi');
      http.expectNone(() => true);
      fixture.componentInstance.basculer(true);
      const req = http.expectOne((r) => r.url === '/api/dossiers/42/motifs-types');
      expect(req.request.params.get('nature')).toBe('RENVOI');
      req.flush(MOTIFS);
      fixture.detectChanges();
      expect(Array.from(racine().querySelectorAll('.mt__motif strong')).map((x) => x.textContent)).toEqual(['Critères de qualification', 'Pièces manquantes']);
      // Une seconde ouverture ne relit pas.
      fixture.componentInstance.basculer(true);
      http.expectNone(() => true);
    });

    it('un clic émet le texte du motif et replie le volet', () => {
      const volet = racine().querySelector('details') as HTMLDetailsElement;
      volet.open = true;
      fixture.componentInstance.basculer(true);
      http.expectOne((r) => r.url === '/api/dossiers/42/motifs-types').flush(MOTIFS);
      fixture.detectChanges();
      (racine().querySelectorAll('.mt__motif')[1] as HTMLButtonElement).click();
      expect(emis).toEqual(['Joindre les pièces suivantes : …']);
      expect(volet.open).toBe(false);
    });

    it('un échec se dit, et la réouverture relit', () => {
      fixture.componentInstance.basculer(true);
      http.expectOne((r) => r.url === '/api/dossiers/42/motifs-types').flush({}, { status: 500, statusText: 'Erreur' });
      fixture.detectChanges();
      expect(racine().querySelector('[role="alert"]')?.textContent).toContain('n’ont pas pu être chargés');
      fixture.componentInstance.basculer(true);
      http.expectOne((r) => r.url === '/api/dossiers/42/motifs-types').flush([]);
      fixture.detectChanges();
      expect(racine().textContent).toContain('Aucun motif-type pour ce dossier.');
    });
  });
});
