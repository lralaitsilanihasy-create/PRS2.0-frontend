import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApiError } from '../../core/errors/api-error';
import { QuorumCao } from '../../models';
import { QuorumCaoVue, libelleRegleQuorum, messageQuorum, suffixeQualite } from './quorum-cao';

describe('Quorum de la CAO (manuel révisé, R1 — V101)', () => {
  let fixture: ComponentFixture<QuorumCaoVue>;
  const texte = (): string => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ').trim();

  function monter(quorum: QuorumCao | null): void {
    TestBed.configureTestingModule({ imports: [QuorumCaoVue] });
    fixture = TestBed.createComponent(QuorumCaoVue);
    fixture.componentRef.setInput('quorum', quorum);
    fixture.detectChanges();
  }

  it('rien sans quorum servi (PV antérieur à V101)', () => {
    monter(null);
    expect(texte()).toBe('');
  });

  it('nomme le requis, l’obtenu, la règle et le président attendu', () => {
    monter({ regle: 'MAJORITE', requis: 2, obtenus: 1, atteint: false, presidentRequis: true, presidentSigne: false, representant: null, representantNom: null });
    expect(texte()).toContain('Quorum non atteint');
    expect(texte()).toContain('1 sur 2 requis (majorité des membres désignés)');
    expect(texte()).toContain('président attendu');
  });

  it('un représentant désigné est nommé à la place du président', () => {
    monter({ regle: '1', requis: 1, obtenus: 1, atteint: true, presidentRequis: true, presidentSigne: true, representant: 'K2', representantNom: 'Membre Deux' });
    expect(texte()).toContain('Quorum atteint');
    expect(texte()).toContain('représentant du président signataire (Membre Deux)');
  });

  it('libellés et message du refus 409 avec ses valeurs', () => {
    expect(libelleRegleQuorum('TOUS')).toBe('tous les membres désignés');
    expect(suffixeQualite('REPRESENTANT')).toBe(' — représentant du président');
    expect(suffixeQualite('MEMBRE')).toBe('');
    const e = { status: 409, message: 'x', raw: { error: { code: 'QUORUM_NON_ATTEINT', details: { regle: 'MAJORITE', requis: 2, obtenus: 1, presidentSigne: false } } } } as unknown as ApiError;
    const m = messageQuorum(e);
    expect(m).toContain('1 signataire(s) sur 2 requis');
    expect(m).toContain('le président, ou son représentant désigné, manque');
  });
});
