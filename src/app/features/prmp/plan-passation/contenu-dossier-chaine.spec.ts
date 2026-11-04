import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { Dossier, Instantane, Role } from '../../../models';
import { ContenuDossierChaine, OuvertureElement, libelleElement } from './contenu-dossier-chaine';

const DDM: Dossier = { idDossier: 100402, idTypeDossier: 'DDM', statut: 'SOUMIS', idLocalite: 'ANT' };
const INSTANTANE: Instantane = { idInstantane: 1, numeroSoumission: 1, ecran: 'PLAN', figeLe: '2026-12-21T09:00:00', figePar: 'IMP001', empreinte: 'a'.repeat(64), taille: 100 };

/** ⚠️ 04/11 (pilote) — un dossier de la chaîne dans le volet du plan : sa barre d'éléments, chacun ouvert en modale. */
describe('ContenuDossierChaine', () => {
  function monter(masques: string[] = []): ComponentFixture<ContenuDossierChaine> {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: AuthService, useValue: { role: signal<Role | null>('MEMBRE') } }],
    });
    const f = TestBed.createComponent(ContenuDossierChaine);
    f.componentRef.setInput('idDossier', 100402);
    f.componentRef.setInput('intitule', 'Dossier de marché · lot 1');
    f.componentRef.setInput('ongletsMasques', masques);
    f.detectChanges();
    // Deux vagues : le dossier, puis le contenu du store (instantanés, pièces, contrôles…).
    const http = TestBed.inject(HttpTestingController);
    let attente: TestRequest[];
    while ((attente = http.match(() => true)).length) {
      for (const req of attente) {
        const url = req.request.url;
        if (url.endsWith('/dossiers/100402')) req.flush(DDM);
        else if (url.endsWith('/instantanes')) req.flush([INSTANTANE]);
        else if (url.endsWith('/chronometrage')) req.flush(null);
        else req.flush([]);
      }
      f.detectChanges();
    }
    return f;
  }
  const boutons = (el: HTMLElement) => Array.from(el.querySelectorAll('.cdc__elements button')).map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim());

  it('la barre des éléments, sans aucun contenu sur l’écran ; le dossier déposé attend sa référence', () => {
    const el = monter().nativeElement as HTMLElement;
    expect(boutons(el)).toEqual(['Pièces jointes 0', 'Écrans figés 1']);
    expect(el.querySelector('app-dossier-documents')).toBeNull();
    expect(el.querySelector('.cdc__r')?.textContent).toBe('Dossier #100402 · référence à la réception');
  });

  it('un clic demande l’ouverture à l’hôte (élément, intitulé, référence, magasin prêté) ; aucune fenêtre dans la barre', () => {
    const f = monter();
    const el = f.nativeElement as HTMLElement;
    const demandes: OuvertureElement[] = [];
    f.componentInstance.ouvrir.subscribe((e) => demandes.push(e));
    el.querySelectorAll<HTMLButtonElement>('.cdc__elements button')[1].click();
    f.detectChanges();
    expect(demandes.length).toBe(1);
    expect(demandes[0].cle).toBe('figes');
    expect(demandes[0].intitule).toBe('Dossier de marché · lot 1');
    expect(demandes[0].reference).toBe('Dossier #100402 · référence à la réception');
    expect(demandes[0].contenu.dossier().idDossier).toBe(100402);
    expect(libelleElement(demandes[0].contenu, 'figes')).toBe('Écrans figés');
    // La fenêtre est rendue par l'écran du plan, hors du volet collant : rien ici.
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('les éléments masqués par le plan ne sont pas dans la barre', () => {
    const el = monter(['pieces']).nativeElement as HTMLElement;
    expect(boutons(el)).toEqual(['Écrans figés 1']);
  });
});
