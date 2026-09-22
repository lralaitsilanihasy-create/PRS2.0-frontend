import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { InterimStore } from '../../core/interim/interim.store';
import { ToastService } from '../../core/notifications/toast.service';
import { Controleur, Interim, Localite, Profile, Role } from '../../models';
import { InterimsEcran } from './interims-ecran';

const PROFILS: Profile[] = [
  { idProfile: 1, profile: 'Président' },
  { idProfile: 3, profile: 'Chef de commission' },
  { idProfile: 4, profile: 'Membre' },
  { idProfile: 5, profile: 'Contrôleur vérificateur' },
];
const c = (imControleur: string, nomCont: string, idProfile: number, idLocalite: string | null): Controleur => ({ imControleur, nomCont, prenomsCont: 'X', idProfile, idLocalite, transversal: false });
const CONTROLEURS: Controleur[] = [
  c('PRES001', 'RANDRIANARISON', 1, null),
  c('CCANT01', 'RAKOTO', 3, 'ANT'),
  c('CCANT02', 'RABE', 3, 'ANT'),
  c('CCTMS01', 'RAZAFY', 3, 'TMS'),
  c('MEMANT1', 'RAFIDIMANANA', 4, 'ANT'),
  c('MEMTMS1', 'RANAIVO', 4, 'TMS'),
  c('VERANT1', 'RASOA', 5, 'ANT'),
];
const LOCALITES = [{ idLocalite: 'ANT', libelleLocalite: 'Antananarivo' }, { idLocalite: 'TMS', libelleLocalite: 'Toamasina' }] as Localite[];

function interim(partiel: Partial<Interim> = {}): Interim {
  return {
    idInterim: 7,
    imTitulaire: 'CCANT01',
    nomTitulaire: 'RAKOTO Hery',
    profilTitulaire: 'CHEF_COMMISSION',
    idLocaliteTitulaire: 'ANT',
    imInterimaire: 'MEMANT1',
    nomInterimaire: 'RAFIDIMANANA Rina',
    profilInterimaire: 'MEMBRE',
    idLocaliteInterimaire: 'ANT',
    dateDebut: '2026-09-21',
    dateFin: '2026-09-30',
    motif: 'CONGE',
    reference: 'NS 2026-118',
    pieceNom: 'note.pdf',
    pieceDisponible: true,
    designePar: 'CCANT01',
    nomDesignePar: 'RAKOTO Hery',
    dateDesignation: '2026-09-20T10:00:00',
    statut: 'ACTIF',
    dateRevocation: null,
    motifRevocation: null,
    revoquePar: null,
    ...partiel,
  };
}

describe('Écran « Mon intérim » / « Intérims » (intérim désigné, 21/09)', () => {
  let fixture: ComponentFixture<InterimsEcran>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let store: { subi: ReturnType<typeof signal<Interim | null>>; exerces: ReturnType<typeof signal<Interim[]>>; verifier: ReturnType<typeof vi.fn> };

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rendre = (): void => fixture.detectChanges();

  function monter(role: Role, ref: string, admin: boolean): void {
    toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
    store = { subi: signal<Interim | null>(null), exerces: signal<Interim[]>([]), verifier: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: admin ? { admin: true } : {} } } },
        { provide: AuthService, useValue: { role: signal(role), ref: signal(ref), nomAffichage: signal('RAKOTO Hery') } },
        { provide: InterimStore, useValue: store },
        { provide: ToastService, useValue: toast },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InterimsEcran);
    rendre();
  }

  /** Répond à la vague de chargement : historique(s), annuaire, profils, localités. */
  function repondreChargement(interims: Interim[], admin: boolean): void {
    if (admin) {
      http.expectOne('/api/interims').flush(interims);
    } else {
      http.expectOne((r) => r.url === '/api/interims' && r.params.get('titulaire') === 'CCANT01').flush(interims.filter((i) => i.imTitulaire === 'CCANT01'));
      http.expectOne((r) => r.url === '/api/interims' && r.params.get('interimaire') === 'CCANT01').flush(interims.filter((i) => i.imInterimaire === 'CCANT01'));
    }
    http.expectOne('/api/controleurs').flush(CONTROLEURS);
    http.expectOne('/api/profiles').flush(PROFILS);
    http.expectOne('/api/localites').flush(LOCALITES);
    rendre();
  }

  afterEach(() => http.verify());

  it('CC : historique (titulaire ∪ intérimaire, dédoublonné, le plus récent en tête), pièce, révocation offerte au titulaire seul', () => {
    monter('CHEF_COMMISSION', 'CCANT01', false);
    const acheve = interim({ idInterim: 3, statut: 'ACHEVE', dateDebut: '2026-08-01', dateFin: '2026-08-10' });
    const actif = interim();
    const exerce = interim({ idInterim: 9, imTitulaire: 'PRES001', nomTitulaire: 'RANDRIANARISON Sitraka', profilTitulaire: 'PRESIDENT', idLocaliteTitulaire: null, imInterimaire: 'CCANT01', nomInterimaire: 'RAKOTO Hery', profilInterimaire: 'CHEF_COMMISSION', designePar: 'PRES001' });
    // `actif` est servi par les deux filtres (titulaire ET, par le décor, intérimaire) : une seule ligne attendue.
    http.expectOne((r) => r.url === '/api/interims' && r.params.get('titulaire') === 'CCANT01').flush([acheve, actif]);
    http.expectOne((r) => r.url === '/api/interims' && r.params.get('interimaire') === 'CCANT01').flush([actif, exerce]);
    http.expectOne('/api/controleurs').flush(CONTROLEURS);
    http.expectOne('/api/profiles').flush(PROFILS);
    http.expectOne('/api/localites').flush(LOCALITES);
    rendre();

    const lignes = Array.from(racine().querySelectorAll('tbody tr'));
    expect(lignes.length).toBe(3);
    expect(texte(lignes[0].querySelector('.it__nom'))).toBe('RANDRIANARISON Sitraka');
    expect(texte(lignes[0].querySelector('.it__sous'))).toBe('Président');
    expect(texte(lignes[1].querySelector('.it__nom'))).toBe('RAKOTO Hery');
    expect(texte(lignes[1].querySelector('.it__sous'))).toBe('Chef de commission · Antananarivo');
    expect(texte(lignes[1].querySelectorAll('td')[2])).toBe('du 21/09/2026 au 30/09/2026');
    expect(texte(lignes[1].querySelector('.it__statut'))).toBe('En cours');
    expect(texte(lignes[2].querySelector('.it__statut'))).toBe('Achevé');
    // Révocation : l'intérim que je subis (titulaire) — pas celui que j'exerce pour le Président (désigné par lui), ni l'achevé.
    expect(lignes.map((l) => !!l.querySelector('.btn-danger'))).toEqual([false, true, false]);

    // La pièce s'ouvre par le chemin sûr : une requête blob.
    (lignes[1].querySelector('.it__piece') as HTMLButtonElement).click();
    const piece = http.expectOne('/api/interims/7/piece');
    expect(piece.request.responseType).toBe('blob');
    piece.flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
  });

  it('CC : désignation — intérimaires admissibles = autre CC ou Membre de SA localité ; POST multipart data + piece ; le store est relu', () => {
    monter('CHEF_COMMISSION', 'CCANT01', false);
    repondreChargement([], false);
    expect(texte(racine().querySelector('tbody'))).toBe('Aucun intérim.');

    (racine().querySelector('.page-header .btn-primary') as HTMLButtonElement).click();
    rendre();
    const options = Array.from(racine().querySelectorAll<HTMLOptionElement>('select[formControlName="imInterimaire"] option')).map((o) => o.value).filter(Boolean);
    expect(options).toEqual(['CCANT02', 'MEMANT1']);
    expect(texte(racine().querySelector('.it__moi'))).toBe('Titulaire absent : RAKOTO Hery (vous).');

    const composant = fixture.componentInstance;
    composant.form.setValue({ imTitulaire: 'CCANT01', imInterimaire: 'MEMANT1', dateDebut: '2026-09-22', dateFin: '2026-09-30', motif: 'MISSION', reference: 'NS 2026-120' });
    const pdf = new File(['%PDF-1.4'], 'note.pdf', { type: 'application/pdf' });
    composant.choisirPiece({ target: { files: [pdf] } } as unknown as Event);
    rendre();
    (racine().querySelector('form .btn-primary') as HTMLButtonElement).click();

    const post = http.expectOne('/api/interims');
    expect(post.request.method).toBe('POST');
    const form = post.request.body as FormData;
    // FormData recopie le fichier sous le nom donné : même nom, même taille, même type.
    const envoye = form.get('piece') as File;
    expect(envoye.name).toBe('note.pdf');
    expect(envoye.size).toBe(pdf.size);
    expect(form.get('data')).toBeInstanceOf(Blob);
    post.flush(interim({ idInterim: 11, motif: 'MISSION', reference: 'NS 2026-120', avertissements: ['Déjà attributaire de 2 dossiers en cours.'] }));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('RAFIDIMANANA Rina désigné(e) intérimaire de RAKOTO Hery'));
    expect(toast.warning).toHaveBeenCalledWith('Déjà attributaire de 2 dossiers en cours.');
    expect(store.verifier).toHaveBeenCalled();
    repondreChargement([interim({ idInterim: 11 })], false);
    expect(racine().querySelector('.modal')).toBeNull();
    expect(racine().querySelectorAll('tbody tr').length).toBe(1);
  });

  it('CC : sans pièce ou sans date de fin (hors vacance de poste), « Désigner » reste inactif ; une vacance de poste libère la fin', () => {
    monter('CHEF_COMMISSION', 'CCANT01', false);
    repondreChargement([], false);
    (racine().querySelector('.page-header .btn-primary') as HTMLButtonElement).click();
    rendre();
    const composant = fixture.componentInstance;
    composant.form.setValue({ imTitulaire: 'CCANT01', imInterimaire: 'MEMANT1', dateDebut: '2026-09-22', dateFin: '', motif: 'CONGE', reference: 'NS' });
    rendre();
    const bouton = (): HTMLButtonElement => racine().querySelector('form .btn-primary') as HTMLButtonElement;
    expect(bouton().disabled).toBe(true);
    composant.choisirPiece({ target: { files: [new File(['%PDF-1.4'], 'n.pdf', { type: 'application/pdf' })] } } as unknown as Event);
    rendre();
    expect(bouton().disabled).toBe(true); // date de fin manquante
    composant.form.controls.motif.setValue('VACANCE_POSTE');
    rendre();
    expect(bouton().disabled).toBe(false);
    // Une image n'est pas une pièce : refus en miroir du serveur.
    composant.choisirPiece({ target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } } as unknown as Event);
    rendre();
    expect(texte(racine().querySelector('.form-error'))).toContain('PDF attendu');
    expect(bouton().disabled).toBe(true);
  });

  it('CC : révocation — motif obligatoire, POST /revoquer, store relu', () => {
    monter('CHEF_COMMISSION', 'CCANT01', false);
    repondreChargement([interim()], false);
    (racine().querySelector('tbody .btn-danger') as HTMLButtonElement).click();
    rendre();
    expect(texte(racine().querySelector('.modal-title'))).toBe("Révoquer l'intérim de RAFIDIMANANA Rina");
    const composant = fixture.componentInstance;
    composant.formRevocation.setValue({ motif: 'Retour anticipé', dateRevocation: '' });
    rendre();
    (racine().querySelector('form .btn-danger') as HTMLButtonElement).click();
    const post = http.expectOne('/api/interims/7/revoquer');
    expect(post.request.body).toEqual({ motif: 'Retour anticipé', dateRevocation: undefined });
    post.flush(interim({ statut: 'REVOQUE', dateRevocation: '2026-09-22', motifRevocation: 'Retour anticipé' }));
    expect(toast.success).toHaveBeenCalled();
    expect(store.verifier).toHaveBeenCalled();
    repondreChargement([interim({ statut: 'REVOQUE', dateRevocation: '2026-09-22', motifRevocation: 'Retour anticipé' })], false);
    expect(texte(racine().querySelector('tbody .it__statut'))).toBe('Révoqué');
    expect(racine().querySelector('tbody .btn-danger')).toBeNull();
  });

  it('Administrateur : tout l’historique, titulaire à choisir parmi Président et CC, admissibles selon le titulaire, révocation partout', () => {
    monter('ADMINISTRATEUR', 'ADMIN01', true);
    repondreChargement([interim(), interim({ idInterim: 8, imTitulaire: 'PRES001', profilTitulaire: 'PRESIDENT', designePar: 'PRES001', statut: 'A_VENIR' })], true);
    expect(racine().querySelector('.it__cartes')).toBeNull();
    expect(Array.from(racine().querySelectorAll('tbody tr')).map((l) => !!l.querySelector('.btn-danger'))).toEqual([true, true]);

    (racine().querySelector('.page-header .btn-primary') as HTMLButtonElement).click();
    rendre();
    const titulaires = Array.from(racine().querySelectorAll<HTMLOptionElement>('select[formControlName="imTitulaire"] option')).map((o) => o.value).filter(Boolean);
    expect(titulaires).toEqual(['PRES001', 'CCANT01', 'CCANT02', 'CCTMS01']);
    const composant = fixture.componentInstance;
    composant.form.controls.imTitulaire.setValue('PRES001');
    rendre();
    const admissibles = (): string[] => Array.from(racine().querySelectorAll<HTMLOptionElement>('select[formControlName="imInterimaire"] option')).map((o) => o.value).filter(Boolean);
    expect(admissibles()).toEqual(['CCANT01', 'CCANT02', 'CCTMS01']);
    composant.form.controls.imTitulaire.setValue('CCTMS01');
    rendre();
    expect(admissibles()).toEqual(['MEMTMS1']);
  });
});
