import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PlanResume, TableauPlans } from './tableau-plans';

/** ⚠️ 04/11 (pilote, variante B) — le tableau des plans du Président, du CC et du Membre. */
describe('TableauPlans', () => {
  const plan = (p: Partial<PlanResume>): PlanResume => ({
    idDossier: 1, entite: 'X', reference: '00001/PPM', exercice: 2026, lignes: 10, montant: 1000, cloture: '28/10/2026', avancement: null, ...p,
  });
  const PLANS = [
    plan({ idDossier: 100390, entite: 'MINISTERE DES TRAVAUX PUBLICS', reference: '00001/PPM-AGPM', lignes: 34, montant: 418_400_000_000 }),
    plan({ idDossier: 100500, entite: "MINISTERE DE L'EDUCATION NATIONALE", reference: '00004/PPM-AGPM', lignes: 52, montant: 96_300_000_000 }),
    plan({ idDossier: 100600, entite: 'MINISTERE DE LA SANTE PUBLIQUE', reference: '00007/PPM', exercice: 2025, lignes: 41, montant: 71_250_000_000 }),
  ];

  const monter = (plans: PlanResume[]) => {
    TestBed.configureTestingModule({ imports: [TableauPlans], providers: [provideRouter([])] });
    const f = TestBed.createComponent(TableauPlans);
    f.componentRef.setInput('plans', plans);
    f.componentRef.setInput('espace', '/president');
    f.detectChanges();
    return f;
  };
  const texte = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('une ligne par plan, rangée par entité, qui ouvre le plan dans l’espace courant ; sans avancement servi, pas de colonne', () => {
    const f = monter(PLANS);
    const r = f.nativeElement as HTMLElement;
    const liens = Array.from(r.querySelectorAll<HTMLAnchorElement>('a.lien-ligne'));
    expect(liens.map((a) => a.textContent?.trim())).toEqual(["MINISTERE DE L'EDUCATION NATIONALE", 'MINISTERE DE LA SANTE PUBLIQUE', 'MINISTERE DES TRAVAUX PUBLICS']);
    expect(liens[2].getAttribute('href')).toBe('/president/plan/100390');
    expect(Array.from(r.querySelectorAll('th')).map((t) => texte(t))).toEqual(['Entité contractante', 'Référence', 'Lignes', 'Montant (Ar)', 'Clôturé le']);
    expect(texte(r.querySelector('.tp__resume'))).toBe('3 plans · 585 950 000 000,00 Ar');
  });

  it('recherche, exercice et tri par montant', () => {
    const f = monter(PLANS);
    const c = f.componentInstance;
    const r = f.nativeElement as HTMLElement;
    const entites = (): string[] => Array.from(r.querySelectorAll('a.lien-ligne')).map((a) => a.textContent?.trim() ?? '');
    c.recherche.set('sante');
    f.detectChanges();
    expect(entites()).toEqual(['MINISTERE DE LA SANTE PUBLIQUE']);
    c.recherche.set('');
    c.exercice.set('2026');
    c.tri.set('montant');
    f.detectChanges();
    expect(entites()).toEqual(['MINISTERE DES TRAVAUX PUBLICS', "MINISTERE DE L'EDUCATION NATIONALE"]);
  });

  it('avec l’avancement servi : la colonne, sa barre, son texte, et le tri par lignes sans étape', () => {
    const f = monter([
      PLANS[0],
      { ...PLANS[1], avancement: { lignes: 52, marche: 4, commission: 6, lancee: 10, preparation: 0, lancer: 9, aucune: 23 } },
    ]);
    const r = f.nativeElement as HTMLElement;
    expect(Array.from(r.querySelectorAll('th')).map((t) => texte(t))).toContain('Avancement des lignes');
    expect(texte(r.querySelector('.tp__avanc-t'))).toBe('14 lancées · 6 en cours · 9 à lancer · 23 sans étape');
    expect(Array.from(r.querySelectorAll('#tp-tri option')).map((o) => o.textContent?.trim())).toContain('Lignes sans étape (le plus d\'abord)');
  });
});
