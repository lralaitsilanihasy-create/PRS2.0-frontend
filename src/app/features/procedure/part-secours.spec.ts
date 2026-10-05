import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { Detenteur } from '../../models';
import { PartSecours, VuePartSecours } from './part-secours';

// V71 (décision du pilote, 05/10) — la clé de secours naît chez le dépositaire ; le responsable la suit.
const secours = (p: Partial<Detenteur>): Detenteur => ({
  role: 'SECOURS',
  im: null,
  nom: 'Dépositaire de recette',
  empreinte: null,
  clePublique: null,
  datePublication: null,
  etatPart: 'ABSENTE',
  derniereVerification: null,
  remplacements: 0,
  generePar: null,
  ...p,
});

describe('Part de secours (V71)', () => {
  let fixture: ComponentFixture<PartSecours>;
  const boutons = (): string[] => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map((b) => (b.textContent ?? '').trim());
  const texte = (): string => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  function monter(vue: VuePartSecours, s: Detenteur, cleARemplacer = false): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }] });
    fixture = TestBed.createComponent(PartSecours);
    fixture.componentRef.setInput('idDmc', 40);
    fixture.componentRef.setInput('vue', vue);
    fixture.componentRef.setInput('secours', s);
    fixture.componentRef.setInput('cleARemplacer', cleARemplacer);
    fixture.detectChanges();
  }

  it('dépositaire sans clé : il génère la sienne', () => {
    monter('depositaire', secours({}));
    expect(boutons()).toEqual(['Générer ma clé de secours…']);
  });

  it('dépositaire face à une clé de l’ancien geste : il génère la sienne pour la remplacer', () => {
    monter('depositaire', secours({ etatPart: 'PUBLIEE', generePar: 'RESPONSABLE', empreinte: 'ab'.repeat(32) }), true);
    expect(boutons()).toEqual(['Générer ma clé de secours…']);
    expect(texte()).toContain('La clé publiée n\'est pas la vôtre');
  });

  it('dépositaire avec sa clé : vérifier, remplacer, déclarer perdue', () => {
    monter('depositaire', secours({ etatPart: 'PUBLIEE', generePar: 'DEPOSITAIRE', empreinte: 'cd'.repeat(32) }));
    expect(boutons()).toEqual(['Vérifier ma part…', 'Remplacer ma clé…', 'Déclarer la part perdue…']);
  });

  it('responsable, clé du dépositaire : lecture seule', () => {
    monter('responsable', secours({ etatPart: 'PUBLIEE', generePar: 'DEPOSITAIRE', empreinte: 'cd'.repeat(32) }));
    expect(boutons()).toEqual([]);
    expect(texte()).toContain('La clé de secours se génère sur le poste du dépositaire');
  });

  it('responsable, clé de l’ancien geste : il garde la vérification et la perte, pas le remplacement', () => {
    monter('responsable', secours({ etatPart: 'PUBLIEE', generePar: 'RESPONSABLE', empreinte: 'ab'.repeat(32) }));
    expect(boutons()).toEqual(['Vérifier la part de secours…', 'Déclarer la part perdue…']);
    expect(texte()).toContain('le dépositaire génère désormais sa propre clé');
  });
});
