import { TestBed } from '@angular/core/testing';

import { PpmIdentification, lireCalendrier, lireServices } from './ppm-identification';

// 15/10 (demande du pilote) — l'identification reprise du plan, en rubriques et en tableaux.
describe('Identification reprise de la ligne du plan', () => {
  it('lit les services bénéficiaires et le calendrier ; un format inattendu reste brut', () => {
    expect(lireServices('00-21-0-B00-00000 (159 652 575) ; 00-21-0-B03-00000 (14 743 900)')).toEqual([
      { service: '00-21-0-B00-00000', montant: '159 652 575' },
      { service: '00-21-0-B03-00000', montant: '14 743 900' },
    ]);
    expect(lireCalendrier('Choix de la procédure : allotissement éventuel — forme du marché : 2026-04-28 ; Examen par le bailleur : sans objet')).toEqual([
      { processus: 'Choix de la procédure : allotissement éventuel — forme du marché', date: '28/04/2026', sansObjet: false },
      { processus: 'Examen par le bailleur', date: 'sans objet', sansObjet: true },
    ]);
    expect(lireCalendrier('texte libre sans date')).toBeNull();
    expect(lireServices(null)).toBeNull();
  });

  it('range les informations par rubrique et met les valeurs longues en tableaux', () => {
    const f = TestBed.createComponent(PpmIdentification);
    f.componentRef.setInput('valeurs', [
      { code: 'B01-AC-01', libelle: 'Autorité contractante', valeur: 'MEF' },
      { code: 'B01-AC-11', libelle: 'Référence du dossier de planification', valeur: '00001/PPM-AGPM/CNM/2026' },
      { code: 'B01-AC-14', libelle: 'Montant estimatif (Ariary)', valeur: '412 404 275' },
      { code: 'B01-AC-16', libelle: 'Service(s) bénéficiaire(s)', valeur: '00-21-0-B00-00000 (159 652 575)' },
      { code: 'B01-AC-18', libelle: 'Dates prévisionnelles', valeur: 'Ouverture des plis : 2026-07-02' },
      { code: 'B99-XX-01', libelle: 'Inconnu', valeur: 'x' },
    ]);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('.pi__titre')).map((t) => (t.textContent ?? '').replace(/\s+/g, ' ').trim())).toEqual([
      'Autorité contractante', 'Plan de passation', 'Marché', 'Autres informations', 'Services bénéficiaires 1', 'Calendrier de passation 1 processus',
    ]);
    expect(el.textContent).toContain('412 404 275 Ar');
    expect(el.querySelectorAll('table').length).toBe(2);
    expect(el.textContent).toContain('02/07/2026');
  });
});
