import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToastService } from '../../../core/notifications/toast.service';
import { Dossier, EcartsInstantanes, Instantane } from '../../../models';
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
  /** ⚠️ 01/11 (variante A) — le sommaire : le nom de chaque écran (sans son numéro ni son résumé). */
  const onglets = (): string[] => Array.from(racine().querySelectorAll('[role="tab"] .di__nom')).map((b) => (b.textContent ?? '').trim());

  function monter(liste: Instantane[], options: { statut?: string; ecarts?: Map<number, EcartsInstantanes> } = {}): void {
    toast = { error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DossierInstantanes],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DossierContenuStore, useValue: { instantanes: signal(liste), dossier: signal({ ...DOSSIER, statut: options.statut ?? DOSSIER.statut }),
          ecarts: signal(options.ecarts ?? new Map()), chargerEcarts: vi.fn() } },
        { provide: ToastService, useValue: toast },
      ],
    });
    // ⚠️ 14/10 — le résolveur des référentiels (nature, mode, statut) est remplacé par une table fixe : pas de lecture réseau.
    TestBed.overrideComponent(DossierInstantanes, { set: { providers: [{ provide: RESOLVEUR_FIGES, useValue: RESOLVEUR }] } });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DossierInstantanes);
    fixture.detectChanges();
  }

  /**
   * ⚠️ 01/11 (variante A) — les écrans d'une soumission sont lus ensemble : chaque requête en cours reçoit sa réponse (par défaut `{}`),
   * et le numéro de soumission demandé est vérifié.
   */
  function servir(soumission: number, reponses: Record<string, unknown> = {}, echecs: readonly string[] = []): string[] {
    const reqs = http.match((r) => r.url.startsWith('/api/dossiers/100371/instantanes/'));
    const ecrans: string[] = [];
    for (const r of reqs) {
      const ecran = r.request.url.split('/').pop() ?? '';
      ecrans.push(ecran);
      expect(r.request.params.get('soumission')).toBe(String(soumission));
      if (echecs.includes(ecran)) r.flush({ code: 'ERREUR' }, { status: 500, statusText: 'Erreur' });
      else r.flush(reponses[ecran] ?? {});
    }
    fixture.detectChanges();
    return ecrans;
  }

  afterEach(() => http.verify());

  // ⚠️ 01/11 (pilote) — pendant le contrôle seulement : « ≠ » sur l'écran qui a changé, et la liste de ses écarts.
  const ECARTS = new Map<number, EcartsInstantanes>([[2, { soumission: 2, figeLe: '2026-10-13T17:00:00', ecrans: [
    { ecran: 'PLAN', identique: false, comparable: true, tronque: false, ecarts: [{ chemin: 'ligne.montant', libelle: 'Ligne du plan — Montant', soumis: '1 000 Ar', actuel: '2 000 Ar' }] },
    { ecran: 'SEANCE', identique: true, comparable: true, tronque: false, ecarts: [] },
  ] }]]);

  it('pendant le contrôle, l’écran qui a changé porte « ≠ » et déplie ses écarts', () => {
    monter(LISTE, { ecarts: ECARTS });
    servir(2);
    expect(onglets()[0]).toContain('≠');
    expect(onglets()[1]).not.toContain('≠');
    racine().querySelector<HTMLButtonElement>('.di__ecart')!.click();
    fixture.detectChanges();
    expect(texte()).toContain('1 écart avec la soumission n° 2');
    expect(texte()).toContain('Ligne du plan — Montant 1 000 Ar 2 000 Ar');
  });

  it('une fois le PV signé, plus de comparaison', () => {
    monter(LISTE, { statut: 'CLOTURE', ecarts: ECARTS });
    servir(2);
    expect(onglets()[0]).not.toContain('≠');
    expect(racine().querySelector('.di__ecart')).toBeNull();
  });

  it('le bandeau de la soumission, le sommaire dans l’ordre de la procédure avec un résumé par écran, puis le premier écran', () => {
    monter(LISTE);
    // ⚠️ 01/11 (variante A) — le bandeau : la soumission, sa date, son auteur, le nombre d'écrans.
    expect(racine().querySelector<HTMLSelectElement>('#di-soumission')?.value).toBe('2');
    expect(texte()).toContain('figée le 13/10/2026 à 17:00 par ADMIN01');
    expect(texte()).toContain('4 écrans · 2 soumissions');
    expect(onglets()).toEqual(['Ligne du plan', "Séance d'ouverture", 'Évaluation', 'Attribution']);
    // Les quatre écrans de la soumission n° 2 sont lus ensemble.
    expect(servir(2, {
      PLAN: { idDmc: 40, versionPpm: 3, ligne: { idDetail: 7 }, valeurs: { OBJET: 'Fournitures de bureau', PPM_REFERENCE: '00001/MLF/PPM/2026', MONTANT_ESTIMATIF: '45 000 000' } },
      EVALUATION,
    }).sort()).toEqual(['ATTRIBUTION', 'EVALUATION', 'PLAN', 'SEANCE']);
    // Le résumé du sommaire.
    expect(racine().querySelector('[role="tab"] .di__resume')?.textContent?.trim()).toBe('45 000 000 Ar');
    // La ligne du plan : sa vue dédiée, l'objet en une ligne puis la bande « en bref ».
    expect(racine().querySelector('.di__titre')?.textContent?.trim()).toBe('Ligne du plan');
    expect(racine().querySelector('app-instantane-plan')).not.toBeNull();
    expect(racine().querySelector('.iv__ligne')?.textContent?.trim()).toBe('Ligne n° 7 · Fournitures de bureau');
    expect(texte()).toContain('Montant estimatif 45 000 000 Ar');
    expect(texte()).toContain('Référence 00001/MLF/PPM/2026');
    expect(texte()).toContain('mise à jour n° 3');
  });

  it('choisir un écran le montre sans le relire : la soumission entière est déjà lue', () => {
    monter(LISTE);
    servir(2, { EVALUATION });
    fixture.componentInstance.choisirEcran('EVALUATION');
    fixture.detectChanges();
    http.expectNone((r) => r.url.includes('/instantanes/'));
    expect(racine().querySelector('app-instantane-evaluation')).not.toBeNull();
    expect(texte()).toContain("L'évaluation des offres En cours");
  });

  it('changer de soumission lit les écrans de celle-ci ; un écran absent retombe sur le premier', () => {
    monter(LISTE);
    servir(2, { EVALUATION });
    fixture.componentInstance.choisirEcran('EVALUATION');
    fixture.componentInstance.choisirSoumission('1');
    fixture.detectChanges();
    // La soumission n° 1 n'a pas d'évaluation : le premier écran (PLAN) de cette soumission est montré.
    expect(onglets()).toEqual(['Ligne du plan', "Séance d'ouverture"]);
    expect(servir(1).sort()).toEqual(['PLAN', 'SEANCE']);
    expect(racine().querySelector('app-instantane-plan')).not.toBeNull();
  });

  it('un échec de lecture montre l’état d’erreur avec reprise ; la reprise relit', () => {
    monter(LISTE);
    servir(2, {}, ['PLAN']);
    expect(racine().querySelector('app-etat-erreur')).not.toBeNull();
    fixture.componentInstance.relance.set(1);
    fixture.detectChanges();
    servir(2);
    expect(racine().querySelector('app-etat-erreur')).toBeNull();
  });

  it('sans instantané, rien n’est lu', () => {
    monter([]);
    http.expectNone((r) => r.url.includes('/instantanes/'));
    expect(texte()).toContain('Aucun écran figé');
  });
});
