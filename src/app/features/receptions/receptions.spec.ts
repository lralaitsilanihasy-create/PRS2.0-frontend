import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { CommissionReception, ReceptionCommande, ReceptionsBon } from '../../models';
import { CommissionReceptionPanneau } from './commission-reception';
import { ReceptionsBonVue } from './receptions-bon';

// ⚠️ Lot MS-4 (V127, 16/10) — la commission de réception et la réception d'un bon.
const RECEPTION = (extra: Partial<ReceptionCommande> = {}): ReceptionCommande => ({
  id: 21, idBon: 11, numeroBon: 1, idContrat: 7, idDmc: 50, lot: 1, type: 'PROVISOIRE', etat: 'A_ETABLIR', dateLivraison: '2026-10-20',
  livraisonObservations: null, declareeLe: '2026-10-20T09:00:00', declareePar: 'Titulaire 1', decision: null, dateReception: null, motif: null,
  reserves: null, montantBon: 300000, montantRefaction: null, montantReceptionne: null, echeanceLivraison: null, joursRetard: null,
  tauxPenalite: null, plafondPenalite: null, penaliteIndicative: null, penaliteNote: null, etabliLe: null, etabliPar: null, pvDisponible: false,
  attendus: [], signeLe: null, ...extra,
});
const BON = (extra: Partial<ReceptionsBon> = {}): ReceptionsBon => ({
  idBon: 11, numero: 1, objet: 'Cartouches', titulaire: 'Titulaire 1', etatReception: 'EN_RECEPTION', garantieMois: 6, garantieJusquau: null,
  alertes: [], receptions: [RECEPTION()], ...extra,
});

describe('Réception des commandes (MS-4)', () => {
  let http: HttpTestingController;
  const texte = (el: HTMLElement): string => (el.textContent ?? '').replace(/\s+/g, ' ');
  const bouton = (el: HTMLElement, debut: string): HTMLButtonElement => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(debut)) as HTMLButtonElement;
  const saisir = (el: Element, v: string): void => { (el as HTMLInputElement).value = v; el.dispatchEvent(new Event('input')); };
  const choisir = (el: Element, v: string): void => { (el as HTMLSelectElement).value = v; el.dispatchEvent(new Event('change')); };

  function preparer(): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  describe('réception d’un bon', () => {
    let fixture: ComponentFixture<ReceptionsBonVue>;
    const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;

    function monter(bon: ReceptionsBon, entrees: Record<string, unknown>): void {
      preparer();
      fixture = TestBed.createComponent(ReceptionsBonVue);
      fixture.componentRef.setInput('idBon', 11);
      for (const [k, v] of Object.entries(entrees)) fixture.componentRef.setInput(k, v);
      fixture.detectChanges();
      http.expectOne('/api/receptions-commandes/bons/11').flush(bon);
      fixture.detectChanges();
    }

    it('le président établit le PV : une réfaction exige motif et montant ; le taux vide part nul (1 ‰ côté serveur)', () => {
      monter(BON(), { president: true });
      const select = racine().querySelector('.rb__details select')!;
      choisir(select, 'REFACTION');
      fixture.detectChanges();
      expect(bouton(racine(), 'Établir le procès-verbal').disabled).toBe(true);
      const label = (t: string): HTMLInputElement => Array.from(racine().querySelectorAll('label')).find((l) => l.textContent?.includes(t))!.querySelector('input')!;
      saisir(label('Montant de la réfaction'), '20000');
      saisir(label('Motif'), 'Deux cartouches abîmées');
      fixture.detectChanges();
      bouton(racine(), 'Établir le procès-verbal').click();
      const post = http.expectOne('/api/receptions-commandes/21/pv');
      expect(post.request.body).toEqual({ decision: 'REFACTION', dateReception: null, motif: 'Deux cartouches abîmées', reserves: null, montantRefaction: 20000, tauxJournalier: null });
      post.flush(RECEPTION({ etat: 'PV_ETABLI' }));
      http.expectOne('/api/receptions-commandes/bons/11').flush(BON());
    });

    it('la PRMP signataire signe le PV établi ; la pénalité est dite indicative ; pas de PV pour un simple lecteur', () => {
      const etabli = RECEPTION({ etat: 'PV_ETABLI', decision: 'RECEPTION', dateReception: '2026-10-22', pvDisponible: true, echeanceLivraison: '2026-10-18', joursRetard: 2, tauxPenalite: 1, penaliteIndicative: 600,
        attendus: [{ signataire: 'PRMP', nom: 'La PRMP', president: true, signeLe: null }, { signataire: 'K001', nom: 'Rabe', president: false, signeLe: null }] });
      monter(BON({ receptions: [etabli] }), { signataire: 'PRMP' });
      expect(texte(racine())).toContain('2 jour(s) de retard');
      expect(texte(racine())).toContain('jamais retenue');
      expect(bouton(racine(), 'Établir')).toBeUndefined();
      bouton(racine(), 'Signer le procès-verbal').click();
      http.expectOne('/api/receptions-commandes/21/signature').flush(etabli);
      http.expectOne('/api/receptions-commandes/bons/11').flush(BON({ receptions: [etabli] }));
    });

    it('bon à livrer : la PRMP ou l’UGPM déclare la livraison ; garantie écoulée : le président ouvre la définitive', () => {
      monter(BON({ etatReception: 'A_LIVRER', receptions: [] }), { peutDeclarer: true });
      bouton(racine(), 'Déclarer la livraison').click();
      const post = http.expectOne('/api/receptions-commandes/bons/11/livraison');
      expect(post.request.body).toEqual({ dateLivraison: null, observations: null });
      post.flush(BON());
      http.expectOne('/api/receptions-commandes/bons/11').flush(BON());
      TestBed.resetTestingModule();

      monter(BON({ etatReception: 'RECU_PROVISOIRE', alertes: ['RECEPTION_DEFINITIVE_A_PRONONCER'], receptions: [RECEPTION({ etat: 'SIGNE', decision: 'RECEPTION' })] }), { president: true });
      bouton(racine(), 'Ouvrir la réception définitive').click();
      http.expectOne('/api/receptions-commandes/bons/11/definitive').flush(BON());
      http.expectOne('/api/receptions-commandes/bons/11').flush(BON());
    });
  });

  describe('commission de réception', () => {
    let fixture: ComponentFixture<CommissionReceptionPanneau>;
    const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const VIDE: CommissionReception = { idContrat: 7, decisionReference: null, decisionDate: null, presideeParPrmp: true, membres: [], majLe: null, majPar: null };

    it('la PRMP désigne : présidée par elle par défaut ; sinon un membre préside et il en faut deux', () => {
      preparer();
      fixture = TestBed.createComponent(CommissionReceptionPanneau);
      fixture.componentRef.setInput('idContrat', 7);
      fixture.componentRef.setInput('peutDesigner', true);
      const lue = vi.fn();
      fixture.componentInstance.lue.subscribe(lue);
      fixture.detectChanges();
      http.expectOne('/api/contrats-en-vigueur/7/commission-reception').flush(VIDE);
      fixture.detectChanges();
      expect(texte(racine())).toContain('non désignée');
      expect(lue).toHaveBeenCalledWith(VIDE);

      const label = (t: string): HTMLInputElement => Array.from(racine().querySelectorAll('label')).find((l) => l.textContent?.includes(t))!.querySelector('input')!;
      saisir(label('Référence de la décision'), 'Décision n° 7/PRMP');
      const ligne = racine().querySelectorAll('.cr__table tbody input');
      saisir(ligne[0], 'Rabe');
      saisir(ligne[2], 'rabe@exemple.mg');
      fixture.detectChanges();
      expect(bouton(racine(), 'Enregistrer la commission').disabled).toBe(false);

      // Présidée par un membre : il en faut deux, dont un président.
      (racine().querySelector('input[type=checkbox]') as HTMLInputElement).click();
      fixture.detectChanges();
      expect(bouton(racine(), 'Enregistrer la commission').disabled).toBe(true);
      (racine().querySelector('input[type=checkbox]') as HTMLInputElement).click();
      fixture.detectChanges();

      bouton(racine(), 'Enregistrer la commission').click();
      const put = http.expectOne('/api/contrats-en-vigueur/7/commission-reception');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body.presideeParPrmp).toBe(true);
      expect(put.request.body.membres).toEqual([{ nom: 'Rabe', prenom: null, email: 'rabe@exemple.mg', fonction: null, president: false }]);
      put.flush({ ...VIDE, decisionReference: 'Décision n° 7/PRMP', decisionDate: '2026-10-16', membres: [{ id: 1, nom: 'Rabe', prenom: null, email: 'rabe@exemple.mg', fonction: null, president: false, idCompte: 'K001', compteActif: false }] });
      fixture.detectChanges();
      expect(texte(racine())).toContain('présidée par la PRMP');
      expect(texte(racine())).toContain('Invitation envoyée');
    });
  });
});
