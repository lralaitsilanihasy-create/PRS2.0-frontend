import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { originePiece } from '../../features/circuit/dossier/dossier-pieces';
import { PublicationAgpm } from '../../models';
import { PublicationAgpmPanneau } from './publication-agpm';

// ⚠️ V118 (15/10, décision du pilote) — la publication de l'AGPM déposée une fois sur le plan, reprise d'office par chaque dossier.
const PUB: PublicationAgpm = {
  idPublication: 1, idDossierPlan: 90, journal: 'JMP', numero: '123', dateParution: '2026-01-15', referenceAgpm: 'AGPM-2026-01',
  nomFichier: 'jmp.pdf', taille: 10, deposePar: 'PRMP001', deposeLe: '2026-01-16T09:00:00', remplaceeLe: null, enVigueur: true, heritee: false,
};

describe('V118 — la publication de l’AGPM sur le plan', () => {
  let http: HttpTestingController;
  let f: ComponentFixture<PublicationAgpmPanneau>;
  const texte = () => ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
  const bouton = (debut: string) =>
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => (b.textContent ?? '').trim().startsWith(debut)) as HTMLButtonElement | undefined;

  function monter(role: string, plan: boolean, reponse: PublicationAgpm | 404): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { role: signal(role) } }],
    });
    http = TestBed.inject(HttpTestingController);
    f = TestBed.createComponent(PublicationAgpmPanneau);
    f.componentRef.setInput('idDossier', 90);
    f.componentRef.setInput('plan', plan);
    f.detectChanges();
    const req = http.expectOne('/api/dossiers/90/publication-agpm');
    if (reponse === 404) req.flush({ code: 'X' }, { status: 404, statusText: 'Not Found' });
    else req.flush(reponse);
    f.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('un dossier sans publication sur son plan : muet', () => {
    monter('SECRETAIRE', false, 404);
    expect((f.nativeElement as HTMLElement).querySelector('.pa')).toBeNull();
  });

  it('un dossier du plan la lit, sans pouvoir la déposer', () => {
    monter('MEMBRE', false, { ...PUB, heritee: true });
    expect(texte()).toContain('JMP n° 123 du 15/01/2026, AGPM AGPM-2026-01');
    expect(texte()).toContain('version précédente du plan');
    expect(bouton('Ouvrir le journal')).toBeDefined();
    expect(bouton('Remplacer')).toBeUndefined();
  });

  it('sur le plan, la PRMP la dépose (multipart) ; le refus PLAN_NON_CONTROLE est nommé', () => {
    monter('PRMP', true, 404);
    expect(texte()).toContain('pas encore déposée');
    bouton('Déposer la publication')!.click();
    f.detectChanges();
    // ⚠️ 18/10 — la référence de l'AGPM est pré-remplie avec celle du plan.
    http.expectOne('/api/dossiers/90').flush({ idDossier: 90, refeDossier: '00001/PPM-AGPM/CNM/2026' });
    const c = f.componentInstance;
    expect(c.saisie().referenceAgpm).toBe('00001/PPM-AGPM/CNM/2026');
    expect(c.complete()).toBe(false);
    c.fichier.set(new File(['%PDF'], 'jmp.pdf', { type: 'application/pdf' }));
    c.poser('journal', 'JMP');
    c.poser('dateParution', '2026-01-15');
    c.poser('referenceAgpm', 'AGPM-2026-01');
    expect(c.complete()).toBe(true);

    c.deposer();
    http.expectOne('/api/dossiers/90/publication-agpm').flush(
      { status: 409, code: 'PLAN_NON_CONTROLE', message: 'Plan non contrôlé' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(texte()).toContain('une fois le PV de la Commission signé avec un avis favorable');

    c.deposer();
    const req = http.expectOne('/api/dossiers/90/publication-agpm');
    const corps = req.request.body as FormData;
    expect(req.request.method).toBe('POST');
    expect([corps.get('journal'), corps.get('dateParution'), corps.get('referenceAgpm'), corps.get('numero')]).toEqual(['JMP', '2026-01-15', 'AGPM-2026-01', null]);
    req.flush(PUB, { status: 201, statusText: 'Created' });
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('[role="dialog"]')).toBeNull();
    expect(bouton('Remplacer la publication')).toBeDefined();
  });

  it('la pièce reprise du plan et le relevé de l’AMI sont reconnus à leur nom de fichier', () => {
    http = { verify: () => undefined } as unknown as HttpTestingController;
    expect(originePiece({ idDossier: 1, idTypePiece: 2, nomFichier: 'PUBLICATION_AGPM_AGPM-2026-01.pdf' })?.libelle).toBe('reprise du plan');
    expect(originePiece({ idDossier: 1, idTypePiece: 3, nomFichier: 'releve-ouverture-ami_44.pdf' })?.libelle).toBe('AMI en ligne');
    expect(originePiece({ idDossier: 1, idTypePiece: 4, nomFichier: 'dao.pdf' })).toBeNull();
  });
});
