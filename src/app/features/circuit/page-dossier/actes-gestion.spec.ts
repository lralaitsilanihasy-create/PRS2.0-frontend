import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/notifications/toast.service';
import { ActeGestion, Dossier, MarcheActes, Role } from '../../../models';
import { ActeGestionDossier } from './acte-gestion-dossier';
import { ActesGestionMarche } from './actes-gestion-marche';
import { manquesDemande, messageRefusActe, projectionPlafond } from './actes-gestion-modele';
import { demandeVide } from './acte-formulaire';

const AVENANT: ActeGestion = {
  idActe: 1, idDossier: 900, idDossierMarche: 500, sousType: 'AVN', rang: 1, montantHt: 10_000_000, montantInitialHt: null, categorie: null,
  dateReceptionProvisoire: null, dateReceptionDefinitive: null, dateSolde: null, statutDossier: 'EXAMINE', refeDossier: '00012/AVN1/CNM/2026',
  avis: 'FAV', compteDansLeCumul: true, creeLe: '2026-10-09T08:00:00',
};
const MARCHE: MarcheActes = {
  idDossierMarche: 500, sousTypeMarche: 'MAOO', refeDossier: '00010/MAOO/CNM/2026', avisMarche: 'FAV', montantInitialHt: 90_000_000,
  sourceMontantInitial: 'ATTRIBUTION', categorie: 'TRAVAUX', sourceCategorie: 'FICHE', dateReceptionProvisoire: null, dateReceptionDefinitive: null,
  dateSolde: null, cumulAvenantsHt: 10_000_000, plafondAvenantsHt: 30_000_000, rangAvenantSuivant: 2, actes: [AVENANT],
};
const erreur = (status: number, corps: object) => new HttpErrorResponse({ status, error: corps });

describe('Actes de gestion (manuel de contrôle, M5a — V98)', () => {
  describe('les règles de l’écran', () => {
    it('projette le cumul des avenants face au plafond du tiers', () => {
      expect(projectionPlafond(MARCHE, 15_000_000)).toEqual({ cumul: 25_000_000, plafond: 30_000_000, depasse: false });
      expect(projectionPlafond(MARCHE, 25_000_000)?.depasse).toBe(true);
      expect(projectionPlafond({ ...MARCHE, plafondAvenantsHt: null }, 1)).toBeNull();
    });

    it('un avenant exige son montant, et le montant initial et la catégorie quand le serveur ne les connaît pas', () => {
      expect(manquesDemande(demandeVide('AVN'), MARCHE)).toEqual(['Le montant hors taxes de l’avenant (négatif pour une baisse).']);
      expect(manquesDemande({ ...demandeVide('AVN'), montantHt: -2_000_000 }, { montantInitialHt: null, categorie: null })).toHaveLength(2);
      expect(manquesDemande(demandeVide('DR'), { montantInitialHt: null, categorie: null })).toEqual([]);
    });

    it('nomme les refus du serveur, détails chiffrés compris', () => {
      expect(messageRefusActe(erreur(409, { code: 'AVENANT_PLAFOND', details: { cumulHt: 35_000_000, plafondHt: 30_000_000 } }))).toContain('35');
      expect(messageRefusActe(erreur(409, { code: 'AVENANT_APRES_RECEPTION', details: { dateReception: '2026-09-30' } }))).toContain('du 30/09/2026');
      expect(messageRefusActe(erreur(409, { code: 'MARCHE_NON_CONTROLE' }))).toContain('avis favorable');
      // Recette du 09/10 : un 400 de soumission dit ses pièces manquantes, pas « Validation échouée ».
      const manque = erreur(400, { message: 'Validation échouée', erreurs: [{ message: 'La pièce \'Projet de décision\' est obligatoire.' }, { champ: 'x', message: 'La pièce \'Justificatifs\' est obligatoire.' }] });
      expect(messageRefusActe(manque)).toBe('La pièce \'Projet de décision\' est obligatoire. La pièce \'Justificatifs\' est obligatoire.');
      // Normalisé par l'intercepteur : la table par champ n'a gardé que la dernière pièce ; la liste brute (`raw`) fait foi.
      const normalise = { status: 400, message: 'Validation échouée', fieldErrors: { piecesJointes: 'La pièce \'B\' est obligatoire.' },
        raw: erreur(400, { erreurs: [{ champ: 'piecesJointes', message: 'La pièce \'A\' est obligatoire.' }, { champ: 'piecesJointes', message: 'La pièce \'B\' est obligatoire.' }] }) };
      expect(messageRefusActe(normalise as never)).toBe('La pièce \'A\' est obligatoire. La pièce \'B\' est obligatoire.');
    });
  });

  function preparer(role: Role) {
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { role: signal<Role | null>(role) } },
        { provide: ToastService, useValue: toast },
      ],
    });
    return { http: TestBed.inject(HttpTestingController), toast };
  }
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  describe('l’encart du marché', () => {
    let fixture: ComponentFixture<ActesGestionMarche>;

    function monter(role: Role, marche: MarcheActes) {
      const r = preparer(role);
      fixture = TestBed.createComponent(ActesGestionMarche);
      fixture.componentRef.setInput('dossier', { idDossier: 500, idTypeDossier: 'DDM', statut: 'CLOTURE' } as Dossier);
      fixture.detectChanges();
      r.http.expectOne('/api/dossiers/500/actes-gestion').flush(marche);
      fixture.detectChanges();
      return r;
    }

    it('montre les faits, le plafond et les actes ; la PRMP dépose, l’acte s’ouvre en brouillon', () => {
      const { http, toast } = monter('PRMP', MARCHE);
      const el = fixture.nativeElement as HTMLElement;
      expect(texte(el.querySelector('.agm__plafond'))).toContain('le tiers du montant initial');
      expect(texte(el.querySelector('.agm__acte'))).toContain('Avenant n° 1');
      expect(texte(el.querySelector('.agm__ref'))).toBe('00012/AVN1/CNM/2026');
      const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      fixture.componentInstance.ouvrir();
      fixture.componentInstance.demande.update((d) => ({ ...d, montantHt: 5_000_000 }));
      fixture.detectChanges();
      expect(texte(el.querySelector('.agm__projection'))).toContain('n° 2');
      fixture.componentInstance.deposer();
      const req = http.expectOne('/api/dossiers/500/actes-gestion');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toMatchObject({ sousType: 'AVN', montantHt: 5_000_000 });
      req.flush({ ...AVENANT, idActe: 2, idDossier: 901, rang: 2, statutDossier: 'BROUILLON', refeDossier: null, avis: null });
      expect(toast.success).toHaveBeenCalledWith('Avenant n° 2 déposé en brouillon : joignez ses pièces, puis soumettez-le.');
      expect(nav.mock.calls[0][0]).toEqual(['/', 'prmp', 'dossier', 901]);
    });

    it('un refus du serveur reste dans la modale, nommé', () => {
      const { http } = monter('PRMP', MARCHE);
      fixture.componentInstance.ouvrir();
      fixture.componentInstance.demande.update((d) => ({ ...d, montantHt: 25_000_000 }));
      fixture.componentInstance.deposer();
      http.expectOne('/api/dossiers/500/actes-gestion').flush(
        { code: 'AVENANT_PLAFOND', message: 'Plafond', details: { cumulHt: 35_000_000, plafondHt: 30_000_000 } },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();
      expect(fixture.componentInstance.ouvert()).toBe(true);
      expect(texte((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]'))).toContain('Un tel changement relève d’un nouveau marché');
    });

    it('marché non contrôlé : la PRMP lit pourquoi elle ne peut pas déposer ; un autre profil sans acte ne voit rien', () => {
      monter('PRMP', { ...MARCHE, avisMarche: null, actes: [] });
      expect(texte((fixture.nativeElement as HTMLElement).querySelector('.agm'))).toContain('une fois le marché contrôlé favorablement');
      TestBed.resetTestingModule();
      monter('MEMBRE', { ...MARCHE, actes: [] });
      expect((fixture.nativeElement as HTMLElement).querySelector('.agm')).toBeNull();
    });
  });

  describe('l’encart du dossier de l’acte', () => {
    it('en brouillon : les pièces exigées, le dépôt d’une pièce, la soumission par la PRMP', () => {
      const { http, toast } = preparer('PRMP');
      const fixture = TestBed.createComponent(ActeGestionDossier);
      fixture.componentRef.setInput('dossier', { idDossier: 901, idTypeDossier: 'DGC', idSousType: 'AVN', statut: 'BROUILLON' } as Dossier);
      fixture.detectChanges();
      http.expectOne('/api/actes-gestion/901').flush({ ...AVENANT, idDossier: 901, rang: 2, statutDossier: 'BROUILLON' });
      http.expectOne('/api/dossiers/901/pieces-exigees').flush([{ idTypePiece: 4, libellePiece: 'Projet d’avenant', obligatoire: true }]);
      http.expectOne((r) => r.url.includes('piece-jointe-dossiers')).flush([]);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(texte(el.querySelector('.agd__titre'))).toBe('Avenant n° 2');
      expect(texte(el.querySelector('.agd__piece'))).toContain('Projet d’avenant — obligatoire');
      expect(texte(el.querySelector('.agd__aide'))).toContain('1 pièce(s) obligatoire(s)');

      fixture.componentInstance.soumettre();
      const req = http.expectOne('/api/dossiers/901/soumettre');
      req.flush({});
      expect(toast.success).toHaveBeenCalledWith('Acte soumis à la Commission.');
    });
  });
});
