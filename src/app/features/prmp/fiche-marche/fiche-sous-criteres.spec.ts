import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../../core/notifications/toast.service';
import { SousCritere } from '../../../models';
import { bilanCritere, CritereTechnique, FicheSousCriteres } from './fiche-sous-criteres';

const CRITERES: CritereTechnique[] = [
  { code: 'B06-TP-02', libelle: 'Expérience du consultant', points: 10 },
  { code: 'B06-TP-03', libelle: 'Méthodologie et plan de travail', points: 30 },
  { code: 'B06-TP-04', libelle: 'Personnel clé', points: null },
];
const SERVIS: SousCritere[] = [
  { ordre: 2, critere: 'B06-TP-03', libelle: 'Plan de travail', points: 10 },
  { ordre: 1, critere: 'B06-TP-03', libelle: 'Approche technique et méthodologie', points: 20 },
];
const URL = '/api/fiches-marche/42/sous-criteres';

describe('Sous-critères des critères techniques (lot 3 PI, tranche PI-a — V84)', () => {
  let fixture: ComponentFixture<FicheSousCriteres>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rendre = (): void => fixture.detectChanges();
  const boutons = (libelle: string): HTMLButtonElement[] => Array.from(racine().querySelectorAll('button')).filter((x) => texte(x).startsWith(libelle));
  const ecrire = (champ: HTMLInputElement, valeur: string): void => {
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
  };

  function monter(servis: SousCritere[], lecture = false): void {
    toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [FicheSousCriteres],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FicheSousCriteres);
    fixture.componentRef.setInput('idDmc', 42);
    fixture.componentRef.setInput('criteres', CRITERES);
    fixture.componentRef.setInput('lecture', lecture);
    rendre();
    http.expectOne(URL).flush(servis);
    rendre();
  }

  afterEach(() => http?.verify());

  it('la somme des sous-critères doit faire les points du critère ; un critère sans sous-critère se note globalement', () => {
    expect(bilanCritere(CRITERES[0], [])).toEqual({ somme: 0, ok: true });
    expect(bilanCritere(CRITERES[1], SERVIS)).toEqual({ somme: 30, ok: true });
    expect(bilanCritere(CRITERES[1], [SERVIS[0]])).toEqual({ somme: 10, ok: false });
    expect(bilanCritere(CRITERES[2], [{ critere: 'B06-TP-04', libelle: 'Chef de mission', points: 5 }]).ok).toBe(false);
  });

  it('range les sous-critères servis sous leur critère, dans l’ordre, lettrés a), b)', () => {
    monter(SERVIS);
    const blocs = racine().querySelectorAll('.fsc__critere');
    expect(blocs).toHaveLength(3);
    const lignes = blocs[1].querySelectorAll('.fsc__ligne');
    expect(lignes).toHaveLength(2);
    expect((lignes[0].querySelector('input') as HTMLInputElement).value).toBe('Approche technique et méthodologie');
    expect(texte(lignes[1].querySelector('.fsc__lettre'))).toBe('b)');
    expect(texte(blocs[1].querySelector('.fsc__somme'))).toBe('sous-critères : 30');
    expect(blocs[0].querySelector('.fsc__ligne')).toBeNull();
  });

  it('signale un écart de points, puis remplace la liste en bloc dans l’ordre des critères', () => {
    monter(SERVIS);
    const enregistrer = boutons('Enregistrer les sous-critères')[0];
    expect(enregistrer.disabled).toBe(true);

    boutons('Ajouter un sous-critère')[0].click();
    rendre();
    const ligne = racine().querySelectorAll('.fsc__critere')[0].querySelector('.fsc__ligne') as HTMLElement;
    const [libelle, points] = Array.from(ligne.querySelectorAll('input'));
    ecrire(libelle, 'Références similaires');
    ecrire(points, '6');
    rendre();
    expect(texte(racine().querySelector('.fsc__critere .fsc__somme'))).toBe('sous-critères : 6 — doit faire 10');
    expect(texte(racine().querySelector('.fsc__actions'))).toContain('la validation le bloquera');
    expect(enregistrer.disabled).toBe(false);

    enregistrer.click();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      sousCriteres: [
        { critere: 'B06-TP-02', libelle: 'Références similaires', points: 6 },
        { critere: 'B06-TP-03', libelle: 'Approche technique et méthodologie', points: 20 },
        { critere: 'B06-TP-03', libelle: 'Plan de travail', points: 10 },
      ],
    });
    req.flush(req.request.body.sousCriteres.map((s: SousCritere, i: number) => ({ ...s, ordre: i + 1 })));
    rendre();
    expect(toast.success).toHaveBeenCalledWith('Sous-critères enregistrés.');
    expect(fixture.componentInstance.modifie()).toBe(false);
  });

  it('montre l’erreur du serveur sous la ligne visée, et le refus d’une fiche validée', async () => {
    monter(SERVIS);
    racine().querySelector<HTMLButtonElement>('button[aria-label^="Retirer le sous-critère a"]')!.click();
    rendre();
    const issue = fixture.componentInstance.sauver();
    http.expectOne(URL).flush(
      { code: 'VALIDATION', message: 'Invalide', erreurs: [{ champ: 'sousCriteres[0].libelle', message: 'Le libellé est obligatoire.' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(await issue).toBe(false);
    rendre();
    expect(texte(racine().querySelector('.form-error'))).toBe('Le libellé est obligatoire.');

    fixture.componentInstance.enregistrer();
    http.expectOne(URL).flush({ code: 'FICHE_VALIDEE', message: 'Fiche validée' }, { status: 409, statusText: 'Conflict' });
    rendre();
    expect(texte(racine().querySelector('[role="alert"]'))).toContain('La fiche est validée');
  });

  it('en lecture : ni ajout, ni retrait, ni enregistrement', async () => {
    monter(SERVIS, true);
    expect(boutons('Ajouter un sous-critère')).toHaveLength(0);
    expect(boutons('Enregistrer')).toHaveLength(0);
    expect(racine().querySelectorAll('input:disabled')).toHaveLength(4);
    expect(await fixture.componentInstance.sauver()).toBe(true);
  });
});
