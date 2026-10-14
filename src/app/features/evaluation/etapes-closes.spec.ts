import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { errorTitle } from '../../core/errors/api-error';
import { Attribution, Evaluation, LotAttribution, dossierSoumis } from '../../models';
import { droitsEvaluation } from './droits-evaluation';
import { EtapeClose } from './etapes-closes';

// ⚠️ R9c (14/10, manuel révisé lot 2 §B4 n° 15) — l'immutabilité des étapes closes (contrat : docs/api-endpoints.md, tranche R9c).
const LOT = (lot: number, statut: string | null, idDossier = 100370 + lot): LotAttribution =>
  ({ lot, etat: 'AU_CONTROLE', proposition: null, dossierMarche: statut === null ? null : { idDossier, sousType: 'DDM-AOO', statut, avis: null, creeLe: null, creePar: null }, projetDisponible: false }) as LotAttribution;
const ATT = (...lots: LotAttribution[]): Attribution => ({ idDmc: 40, lots });

describe('Étapes closes (R9c) — la règle du serveur', () => {
  it('aucun dossier de marché, ou un brouillon : rien n’est fermé', () => {
    expect(dossierSoumis(null)).toBeNull();
    expect(dossierSoumis(ATT(LOT(1, null), LOT(2, 'BROUILLON')))).toBeNull();
  });

  it('le premier lot, dans l’ordre, dont le dossier n’est plus un brouillon ferme la procédure entière', () => {
    expect(dossierSoumis(ATT(LOT(2, 'SOUMIS'), LOT(1, 'BROUILLON')))).toEqual({ idDossier: 100372, lot: 2 });
    expect(dossierSoumis(ATT(LOT(3, 'CLOTURE'), LOT(2, 'EXAMINE')))).toEqual({ idDossier: 100372, lot: 2 });
  });
});

describe('Étapes closes (R9c) — les droits de l’évaluation', () => {
  const EV = {
    etat: 'EN_COURS',
    declarations: [{ membre: 'K1', signeeLe: '2026-10-08T09:00:00', conflit: false, president: true }],
  } as unknown as Evaluation;

  it('étape close : plus aucun geste d’écriture, l’identité reste', () => {
    expect(droitsEvaluation(EV, 'cao', 'K1', null, true)).toMatchObject({ membre: true, declaree: true, decider: false, president: false });
    expect(droitsEvaluation(EV, 'interne', 'P', 'PRMP', true).prmp).toBe(false);
    expect(droitsEvaluation(EV, 'interne', 'R', 'RESPONSABLE', true).responsable).toBe(false);
  });

  it('sans verrou, rien ne change', () => {
    expect(droitsEvaluation(EV, 'cao', 'K1', null)).toMatchObject({ decider: true, president: true });
    expect(droitsEvaluation(EV, 'interne', 'R', 'RESPONSABLE').responsable).toBe(true);
  });
});

describe('Étapes closes (R9c) — le bandeau et le refus', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('nomme le dossier soumis et la seule voie de réouverture ; le lien seulement pour la PRMP et l’UGPM', () => {
    const f = TestBed.createComponent(EtapeClose);
    f.componentRef.setInput('dossier', { idDossier: 100371, lot: 1 });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[role="status"]')?.textContent).toContain('dossier de marché n° 100371 (lot 1)');
    expect(el.textContent).toContain('reprise de l’évaluation après avis défavorable');
    expect(el.querySelector('a')).toBeNull();
    f.componentRef.setInput('lienDossier', true);
    f.detectChanges();
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/prmp/dossier/100371');
  });

  it('sans dossier soumis, rien ne s’affiche', () => {
    const f = TestBed.createComponent(EtapeClose);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });

  it('le refus du serveur porte le titre « Étape close »', () => {
    expect(errorTitle(409, 'ETAPE_CLOSE')).toBe('Étape close');
  });
});
