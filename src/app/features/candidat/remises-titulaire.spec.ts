import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RemiseTitulaire } from '../../models';
import { RemisesTitulaire } from './remises-titulaire';

// ⚠️ Lot MS-2 (V125, 16/10) — le titulaire répond à la remise en concurrence jusqu'à l'échéance.
const REMISE = (extra: Partial<RemiseTitulaire> = {}): RemiseTitulaire => ({
  id: 3, numero: 1, idOffre: 'o-1', objet: 'Cartouches', objetContrat: 'Consommables informatiques', echeance: '2026-10-30T10:00:00',
  echeancePassee: false, delaiExecution: '15 jours', lieuLivraison: 'Antananarivo', maReponse: null, resultat: 'EN_COURS', motif: null, dateContrat: '2026-01-10',
  ...extra,
});

describe('Remises en concurrence du titulaire (MS-2)', () => {
  let fixture: ComponentFixture<RemisesTitulaire>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (): string => (racine().textContent ?? '').replace(/\s+/g, ' ');
  const bouton = (debut: string): HTMLButtonElement => Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(debut)) as HTMLButtonElement;

  function monter(remises: RemiseTitulaire[]): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RemisesTitulaire);
    fixture.detectChanges();
    http.expectOne('/api/candidat/remises').flush(remises);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('répond en multipart (nature, montant, fichier) ; la réponse rendue remplace le formulaire', () => {
    monter([REMISE()]);
    expect(texte()).toContain('Contrat-cadre : Consommables informatiques');
    const select = racine().querySelector('select') as HTMLSelectElement;
    select.value = 'DEVIS';
    select.dispatchEvent(new Event('change'));
    const champ = (t: string): HTMLInputElement => Array.from(racine().querySelectorAll('label')).find((l) => l.textContent?.includes(t))!.querySelector('input')!;
    const ht = champ('Montant HT');
    ht.value = '180000';
    ht.dispatchEvent(new Event('input'));
    const fichier = champ('Votre réponse');
    Object.defineProperty(fichier, 'files', { value: [new File(['%PDF-1.4'], 'devis.pdf', { type: 'application/pdf' })] });
    fichier.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    bouton('Envoyer ma réponse').click();
    const post = http.expectOne('/api/candidat/remises/3/reponse');
    const fd = post.request.body as FormData;
    expect(fd.get('nature')).toBe('DEVIS');
    expect(fd.get('montantHt')).toBe('180000');
    post.flush(REMISE({ maReponse: { id: 9, idOffre: 'o-1', numero: 1, candidat: null, nature: 'DEVIS', voie: 'EN_LIGNE', montantHt: 180000, montantTtc: null, delai: null, recueLe: '2026-10-16T11:00:00', fichier: 'devis.pdf', conforme: null, motif: null, ecartPrixMoyen: null, rang: null, plafondDepasse: null } }));
    fixture.detectChanges();
    expect(texte()).toContain('Votre réponse : Devis');
    expect(bouton('Remplacer ma réponse')).toBeTruthy();
  });

  it('échéance passée sans réponse : plus de formulaire ; le résultat et son motif sont dits', () => {
    monter([REMISE({ echeancePassee: true, resultat: 'NON_RETENU', motif: 'Aucune réponse reçue.' })]);
    expect(texte()).toContain('Aucune réponse avant l’échéance');
    expect(texte()).toContain('Non retenu');
    expect(bouton('Envoyer ma réponse')).toBeUndefined();
  });
});
