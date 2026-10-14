import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToastService } from '../../../core/notifications/toast.service';
import { Dossier, Instantane } from '../../../models';
import { DossierContenuStore } from './dossier-contenu.store';
import { RESOLVEUR_FIGES, ResolveurFiges } from '../../../shared/ui/donnees-figees';
import { DossierInstantanes, libelleEcranInstantane } from './dossier-instantanes';

const RESOLVEUR: ResolveurFiges = { resoudre: (cle, v) => (cle === 'idNature' && v === 1 ? 'Travaux' : cle === 'statut' && v === 'PREVU' ? 'Prévu' : null) };

const DOSSIER: Dossier = { idDossier: 100371, idTypeDossier: 'DDM', statut: 'SOUMIS', idLocalite: 'ANT' };

const ligne = (id: number, numeroSoumission: number, ecran: string, figeLe: string): Instantane => ({
  idInstantane: id, numeroSoumission, ecran, figeLe, figePar: 'ADMIN01', empreinte: 'abcdef0123456789abcdef0123456789', taille: 1200,
});

/** Deux soumissions ; la seconde porte l'évaluation (ouverte entre-temps) — servie dans l'ordre du serveur (soumission, puis écran). */
const LISTE: Instantane[] = [
  ligne(1, 1, 'PLAN', '2026-10-13T09:00:00'),
  ligne(2, 1, 'SEANCE', '2026-10-13T09:00:00'),
  ligne(3, 2, 'ATTRIBUTION', '2026-10-13T17:00:00'),
  ligne(4, 2, 'EVALUATION', '2026-10-13T17:00:00'),
  ligne(5, 2, 'PLAN', '2026-10-13T17:00:00'),
  ligne(6, 2, 'SEANCE', '2026-10-13T17:00:00'),
];

const EVALUATION = { idDmc: 40, etat: 'EN_COURS', ouverteLe: '2026-10-13T12:00:00', ouvertePar: null, declarations: [], lots: [], nonEvaluees: [], rapport: null };

describe('libelleEcranInstantane', () => {
  it('les neuf écrans en clair, un inconnu tel quel', () => {
    expect(libelleEcranInstantane('SEANCE')).toBe("Séance d'ouverture");
    expect(libelleEcranInstantane('DSS')).toBe('Sans suite');
    expect(libelleEcranInstantane('AUTRE')).toBe('AUTRE');
  });
});

describe('Écrans figés d’un dossier (manuel révisé, R4)', () => {
  let fixture: ComponentFixture<DossierInstantanes>;
  let http: HttpTestingController;
  let toast: { error: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  /** Les nœuds de texte joints par un espace : deux cellules voisines restent deux mots. */
  const texte = (): string => {
    const marche = document.createTreeWalker(racine(), NodeFilter.SHOW_TEXT);
    const morceaux: string[] = [];
    while (marche.nextNode()) morceaux.push(marche.currentNode.textContent ?? '');
    return morceaux.join(' ').replace(/\s+/g, ' ').trim();
  };
  const onglets = (): string[] => Array.from(racine().querySelectorAll('[role="tab"]')).map((b) => (b.textContent ?? '').trim());

  function monter(liste: Instantane[]): void {
    toast = { error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DossierInstantanes],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DossierContenuStore, useValue: { instantanes: signal(liste), dossier: signal(DOSSIER) } },
        { provide: ToastService, useValue: toast },
      ],
    });
    // ⚠️ 14/10 — le résolveur des référentiels (nature, mode, statut) est remplacé par une table fixe : pas de lecture réseau.
    TestBed.overrideComponent(DossierInstantanes, { set: { providers: [{ provide: RESOLVEUR_FIGES, useValue: RESOLVEUR }] } });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DossierInstantanes);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('ouvre la dernière soumission, ses écrans dans l’ordre de lecture, et lit le premier (PLAN) avec son numéro de soumission', () => {
    monter(LISTE);
    expect(onglets()).toEqual(['Ligne du plan', "Séance d'ouverture", 'Évaluation', 'Attribution']);
    const select = racine().querySelector<HTMLSelectElement>('#di-soumission');
    expect(select?.value).toBe('2');
    expect(texte()).toContain('6 écran(s) · 2 soumission(s)');
    const req = http.expectOne((r) => r.url === '/api/dossiers/100371/instantanes/PLAN');
    expect(req.request.params.get('soumission')).toBe('2');
    req.flush({ idDmc: 40, versionPpm: 3, ligne: { objet: 'Fournitures de bureau' } });
    fixture.detectChanges();
    expect(texte()).toContain('Figé à la soumission n° 2 du 13/10/2026 à 17:00 par ADMIN01');
    expect(texte()).toContain('empreinte abcdef012345…');
    expect(texte()).toContain('Version du plan 3');
    expect(texte()).toContain('Objet Fournitures de bureau');
    expect(racine().querySelector('.di__complet')).toBeNull();
  });

  it('choisir un écran à vue dédiée le lit et le rend en lecture seule, avec les données complètes sous un volet', () => {
    monter(LISTE);
    http.expectOne((r) => r.url === '/api/dossiers/100371/instantanes/PLAN').flush({});
    fixture.detectChanges();
    fixture.componentInstance.choisirEcran('EVALUATION');
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/dossiers/100371/instantanes/EVALUATION' && r.params.get('soumission') === '2').flush(EVALUATION);
    fixture.detectChanges();
    expect(racine().querySelector('app-instantane-evaluation')).not.toBeNull();
    expect(texte()).toContain('État En cours');
    expect(racine().querySelector('.di__complet')).not.toBeNull();
  });

  it('changer de soumission relit l’écran courant pour cette soumission ; un écran absent de celle-ci retombe sur le premier', () => {
    monter(LISTE);
    http.expectOne((r) => r.url === '/api/dossiers/100371/instantanes/PLAN').flush({});
    fixture.detectChanges();
    fixture.componentInstance.choisirEcran('EVALUATION');
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/dossiers/100371/instantanes/EVALUATION').flush(EVALUATION);
    fixture.detectChanges();
    fixture.componentInstance.choisirSoumission('1');
    fixture.detectChanges();
    // La soumission n° 1 n'a pas d'évaluation : le premier écran (PLAN) de cette soumission est lu.
    expect(onglets()).toEqual(['Ligne du plan', "Séance d'ouverture"]);
    const req = http.expectOne((r) => r.url === '/api/dossiers/100371/instantanes/PLAN');
    expect(req.request.params.get('soumission')).toBe('1');
    req.flush({});
    fixture.detectChanges();
    expect(texte()).toContain('Figé à la soumission n° 1 du 13/10/2026 à 09:00');
  });

  it('un échec de lecture montre l’état d’erreur avec reprise ; la reprise relit', () => {
    monter(LISTE);
    http.expectOne((r) => r.url === '/api/dossiers/100371/instantanes/PLAN').flush({ code: 'ERREUR' }, { status: 500, statusText: 'Erreur' });
    fixture.detectChanges();
    expect(racine().querySelector('app-etat-erreur')).not.toBeNull();
    fixture.componentInstance.relance.set(1);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/dossiers/100371/instantanes/PLAN').flush({});
    fixture.detectChanges();
    expect(racine().querySelector('app-etat-erreur')).toBeNull();
  });

  it('exporte le PDF de l’écran courant sous son nom serveur, par le téléchargement sûr', () => {
    monter(LISTE);
    http.expectOne((r) => r.url === '/api/dossiers/100371/instantanes/PLAN').flush({});
    fixture.detectChanges();
    // Même motif que `fichiers-surs.spec` : l'URL de blob est simulée, le clic du lien de téléchargement intercepté.
    const cree = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const liens: HTMLAnchorElement[] = [];
    const creer = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = creer(tag);
      if (tag === 'a') {
        vi.spyOn(el, 'click').mockImplementation(() => undefined);
        liens.push(el as HTMLAnchorElement);
      }
      return el;
    });
    racine().querySelector<HTMLButtonElement>('.di__bandeau button')!.click();
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/api/dossiers/100371/instantanes/PLAN/pdf');
    expect(req.request.params.get('soumission')).toBe('2');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    fixture.detectChanges();
    expect(cree).toHaveBeenCalledTimes(1);
    expect(liens.map((l) => l.download)).toEqual(['INSTANTANE_PLAN_100371_s2.pdf']);
    expect(toast.error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('sans instantané, rien n’est lu', () => {
    monter([]);
    http.expectNone((r) => r.url.includes('/instantanes/'));
    expect(texte()).toContain('Aucun écran figé');
  });
});
