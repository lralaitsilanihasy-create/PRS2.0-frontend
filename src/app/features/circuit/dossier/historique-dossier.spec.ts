import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EvenementHistorique, FiliationDossier, NoeudFiliation } from '../../../models';
import { HistoriqueDossier, codeLisible, compterDossiers, dateHistorique, detailLisible } from './historique-dossier';

/** « Historique du dossier » (pilote, 31/10) — filiation (B1) et historique (B2). */
describe('HistoriqueDossier', () => {
  const noeud = (id: number, ref: string, lien: string, enfants: NoeudFiliation[] = [], masque = false): NoeudFiliation => ({
    idDossier: masque ? null : id, refeDossier: masque ? null : ref, idTypeDossier: 'DMC', idSousType: null, statut: masque ? null : 'CLOTURE',
    dateRef: '2026-10-28', lien, lot: lien === 'MARCHE' ? 1 : null, ligne: null, masque, enfants,
  });
  const filiation: FiliationDossier = {
    idDossierDemande: 2,
    racine: noeud(1, '00001/PPM-AGPM/CNM/2026', 'RACINE', [
      noeud(2, '00002/DAOO-CC/CNM/2026', 'MISE_EN_CONCURRENCE', [noeud(3, '00009/MAOO-CC/CNM/2026', 'MARCHE')]),
      noeud(0, '', 'MISE_EN_CONCURRENCE', [], true),
    ]),
  };
  const evt = (type: string, reference: string | null, id: number | null = null): EvenementHistorique => ({
    type, date: '2026-10-28T11:20:00', id, reference, statut: null, avis: null, acteur: null, detail: null, lot: null, numero: null,
  });

  function monter() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const f = TestBed.createComponent(HistoriqueDossier);
    f.componentRef.setInput('idDossier', 2);
    f.detectChanges();
    return { f, http: TestBed.inject(HttpTestingController), el: f.nativeElement as HTMLElement };
  }

  it('affiche l’arbre, le dossier courant en évidence, puis l’historique du dossier courant', () => {
    const { f, http, el } = monter();
    http.expectOne('/api/dossiers/2/filiation').flush(filiation);
    f.detectChanges();
    http.expectOne('/api/dossiers/2/historique').flush([evt('PV', '00002/DAOO-CC/CNM/PV/2026'), evt('LETTRE_RENVOI', 'LR-12')]);
    f.detectChanges();
    expect(el.textContent).toContain('3 dossiers liés');
    expect(el.textContent).toContain('dossier hors de votre périmètre');
    expect(el.querySelector('.hd__choix--on')?.textContent).toContain('00002/DAOO-CC/CNM/2026');
    const evts = Array.from(el.querySelectorAll('.hd__evt')).map((e) => e.textContent ?? '');
    expect(evts[0]).toContain('Procès-verbal');
    expect(evts[0]).toContain('00002/DAOO-CC/CNM/PV/2026');
    expect(evts[1]).toContain('Lettre de renvoi');
    http.verify();
  });

  it('choisir un autre dossier de l’arbre demande SON historique, une seule fois', () => {
    const { f, http, el } = monter();
    http.expectOne('/api/dossiers/2/filiation').flush(filiation);
    f.detectChanges();
    http.expectOne('/api/dossiers/2/historique').flush([]);
    f.detectChanges();
    const marche = Array.from(el.querySelectorAll<HTMLButtonElement>('.hd__choix')).find((b) => b.textContent?.includes('00009'))!;
    marche.click();
    f.detectChanges();
    http.expectOne('/api/dossiers/3/historique').flush([evt('ATTRIBUTION', '00009/MAOO-CC/CNM/2026', 3)]);
    f.detectChanges();
    expect(el.querySelector('.hd__evts-titre')?.textContent).toContain('00009/MAOO-CC/CNM/2026');
    // L'attribution désigne un dossier : sa référence est un lien.
    expect(el.querySelector('.hd__evt a.hd__ref')).not.toBeNull();
    marche.click();
    f.detectChanges();
    http.expectNone('/api/dossiers/3/historique');
    http.verify();
  });

  it('se tait quand la route n’est pas servie (404), affiche une erreur sinon', () => {
    const { f, http, el } = monter();
    http.expectOne('/api/dossiers/2/filiation').flush(null, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(el.querySelector('.hd')).toBeNull();
    f.componentInstance.charger(2);
    http.expectOne('/api/dossiers/2/filiation').flush(null, { status: 500, statusText: 'Erreur' });
    f.detectChanges();
    expect(el.querySelector('app-etat-erreur')).not.toBeNull();
  });

  it('formate les dates, traduit les codes et compte les dossiers visibles', () => {
    expect(dateHistorique('2026-10-28T11:20:05')).toBe('28/10/2026 11:20');
    expect(dateHistorique('2026-10-28')).toBe('28/10/2026');
    // Minuit pile = élément sans heure (examen, PV) : pas de « 00:00 ».
    expect(dateHistorique('2026-10-28T00:00:00')).toBe('28/10/2026');
    expect(dateHistorique(null)).toBe('—');
    expect(codeLisible('EN_ATTENTE_DECISION_PRMP')).toBe('En attente de la décision de la PRMP');
    expect(codeLisible('FAVR')).toBe('Favorable avec réserves');
    expect(codeLisible('A_REEXAMINER')).toBe('A reexaminer');
    expect(codeLisible('attribué à MEMANT1')).toBe('attribué à MEMANT1');
    expect(detailLisible('levée le 2026-10-28T14:16:09.394762')).toBe('levée le 28/10/2026 14:16');
    expect(detailLisible('Passage 1 INITIAL')).toBe('Passage 1 initial');
    expect(detailLisible('APPROUVE')).toBe('Approuvé');
    expect(compterDossiers(filiation.racine)).toBe(3);
  });
});
