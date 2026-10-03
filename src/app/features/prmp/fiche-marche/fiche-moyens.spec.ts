import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../../core/notifications/toast.service';
import { MaterielExige, PersonnelExige } from '../../../models';
import { FicheMoyens } from './fiche-moyens';

/** Extraits du DAO routier du MTP (fiche des faits §3), tels que le serveur les servira. */
const MATERIEL: MaterielExige[] = [
  { idMateriel: 1, ordre: 1, designation: 'Camions bennes', caracteristique: '≥ 10 000 kg', nombre: 6, minimumEnPropre: 4, parLot: false },
  { idMateriel: 2, ordre: 2, designation: 'Niveleuse', caracteristique: null, nombre: 1, minimumEnPropre: 1, parLot: false },
];
const PERSONNEL: PersonnelExige[] = [
  { idPersonnel: 1, ordre: 1, poste: 'Conducteur de travaux', nombre: 1, diplome: 'Ingénieur BTP ou génie civil', experienceAnnees: 5, domaineExperience: 'travaux routiers', justificatifs: 'CV et diplôme certifié', parLot: false },
];

describe('Matériel et personnel exigés (lot 3 du chantier b — contrat demandé le 03/10)', () => {
  let fixture: ComponentFixture<FicheMoyens>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rendre = (): void => fixture.detectChanges();
  const bouton = (libelle: string): HTMLButtonElement => {
    const b = Array.from(racine().querySelectorAll('button')).find((x) => texte(x).startsWith(libelle));
    if (!b) throw new Error(`Bouton « ${libelle} » introuvable`);
    return b;
  };
  const ecrire = (champ: HTMLInputElement, valeur: string): void => {
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
  };

  function monter(lecture = false): void {
    toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [FicheMoyens],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FicheMoyens);
    fixture.componentRef.setInput('idDmc', 42);
    fixture.componentRef.setInput('lecture', lecture);
    rendre();
  }

  /** Répond aux deux chargements ; `null` = route pas encore servie (404). */
  function ouvrir(materiel: MaterielExige[] | null, personnel: PersonnelExige[] | null): void {
    const repondre = (url: string, corps: unknown[] | null) => {
      const q = http.expectOne(url);
      if (corps) q.flush(corps);
      else q.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    };
    repondre('/api/fiches-marche/42/materiel', materiel);
    repondre('/api/fiches-marche/42/personnel', personnel);
    rendre();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('montre chaque liste et l’aperçu de la ligne que le DPAO imprimera', () => {
    monter();
    ouvrir(MATERIEL, PERSONNEL);
    expect(Array.from(racine().querySelectorAll('.mo__apercu span:not(.mo__apercu-t)')).map((s) => texte(s))).toEqual([
      '- Camions bennes ≥ 10 000 kg : 6, dont au moins 4 en propre',
      '- Niveleuse : 1, en propre',
    ]);
    expect(texte(racine().querySelector('.mo__apercu-l'))).toBe(
      "- Conducteur de travaux (1) : ingénieur BTP ou génie civil ; au moins 5 ans d'expérience en travaux routiers ; justificatifs : CV et diplôme certifié",
    );
  });

  it('un minimum en propre au-delà du nombre est signalé avant l’envoi', () => {
    monter();
    ouvrir(MATERIEL, []);
    const min = racine().querySelector('input[aria-label="Minimum en propre du matériel 1"]') as HTMLInputElement;
    ecrire(min, '7');
    rendre();
    expect(texte(racine().querySelector('.form-error'))).toBe('Au plus le nombre exigé');
  });

  it('chaque liste s’enregistre seule, dans l’ordre affiché, sans les identifiants d’écran', () => {
    monter();
    ouvrir(MATERIEL, []);
    (racine().querySelector('button[aria-label="Descendre ce matériel"]') as HTMLButtonElement).click();
    rendre();
    bouton('Enregistrer le matériel').click();
    const put = http.expectOne('/api/fiches-marche/42/materiel');
    expect(put.request.method).toBe('PUT');
    const envoye = (put.request.body as { materiel: (MaterielExige & { cle?: number })[] }).materiel;
    expect(envoye.map((m) => m.designation)).toEqual(['Niveleuse', 'Camions bennes']);
    expect(envoye.every((m) => m.cle === undefined && m.idMateriel === undefined)).toBe(true);
    put.flush(envoye.map((m, i) => ({ ...m, idMateriel: 10 + i, ordre: i + 1 })));
    rendre();
    expect(toast.success).toHaveBeenCalledWith('Matériel exigé enregistré.');
  });

  it('ajout d’un poste : l’aperçu suit la saisie ; 400 nominatif sous le champ', () => {
    monter();
    ouvrir([], []);
    bouton('+ Poste').click();
    rendre();
    const poste = racine().querySelector('.mo__poste input[type="text"]') as HTMLInputElement;
    ecrire(poste, 'Chef de chantier');
    rendre();
    expect(texte(racine().querySelector('.mo__apercu-l'))).toBe('- Chef de chantier (1)');
    bouton('Enregistrer le personnel').click();
    http.expectOne('/api/fiches-marche/42/personnel').flush(
      [{ champ: 'personnel[0].poste', message: 'Le poste est trop long.' }],
      { status: 400, statusText: 'Bad Request' },
    );
    rendre();
    expect(texte(racine().querySelector('.mo__poste .form-error'))).toBe('Le poste est trop long.');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('route pas encore servie (404) : listes vides et invitation ; lecture : aucun geste d’écriture', () => {
    monter(true);
    ouvrir(null, PERSONNEL);
    expect(texte(racine().querySelector('.mo__etat'))).toBe('Aucun matériel exigé.');
    expect(racine().querySelector('input')).toBeNull();
    expect(Array.from(racine().querySelectorAll('button')).length).toBe(0);
    expect(texte(racine().querySelector('.mo__lu'))).toContain('- Conducteur de travaux (1)');
  });

  it('« Coller une liste » (03/10) : le passage du DAO du MEN donne cinq engins, ajoutés seulement au clic', () => {
    monter();
    ouvrir([], []);
    Array.from(racine().querySelectorAll('button')).filter((b) => texte(b) === 'Coller une liste')[0].click();
    rendre();
    const zone = racine().querySelector('textarea') as HTMLTextAreaElement;
    zone.value = 'Un (01) bétonnière de 350 litres minimum ; une (01) voiture de liaison de type 4x4 — en propriété ou en location';
    zone.dispatchEvent(new Event('input'));
    rendre();
    expect(texte(racine().querySelector('.modal [role="status"]'))).toBe('2 entrée(s) reconnue(s).');
    expect(Array.from(racine().querySelectorAll('.cl__apercu span')).map((s) => texte(s))).toEqual([
      '- Bétonnière de 350 litres minimum : 1',
      '- Voiture de liaison de type 4x4 : 1',
    ]);
    expect(racine().querySelectorAll('.mo tbody tr').length).toBe(0);
    bouton('Ajouter 2 entrée(s)').click();
    rendre();
    expect(racine().querySelector('textarea')).toBeNull();
    expect(racine().querySelectorAll('.mo tbody tr').length).toBe(2);
    expect(toast.info).toHaveBeenCalledWith("2 entrée(s) ajoutée(s) — à vérifier avant d'enregistrer.");
  });
});
