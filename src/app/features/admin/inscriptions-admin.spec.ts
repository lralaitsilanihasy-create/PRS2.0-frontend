import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { InscriptionEnAttente } from '../../models';
import { InscriptionService } from '../../services';
import { InscriptionsAdmin } from './inscriptions-admin';

const INSCRIPTION = (login: string, type: 'PRMP' | 'UGPM', nom: string): InscriptionEnAttente =>
  ({ login, type, nom, prenoms: 'Hery', email: login.toLowerCase() + '@exemple.mg', entitesDeclarees: type === 'PRMP' ? [{ idEntiteContract: 1, libelle: 'Ministère de la Santé' }] : [], idPrmpTutelle: type === 'UGPM' ? 'PRMP001' : null }) as unknown as InscriptionEnAttente;

// ⚠️ 31/10 (Espace de travail, lot 3b) — les demandes d'accès en deux volets.
describe('Demandes d’accès — deux volets', () => {
  const monter = (lignes: InscriptionEnAttente[]) => {
    const downloadPiece = vi.fn(() => throwError(() => ({ status: 404 })));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: InscriptionService, useValue: { enAttente: () => of(lignes), downloadPiece } },
      ],
    });
    const fixture = TestBed.createComponent(InscriptionsAdmin);
    fixture.detectChanges();
    return { fixture, hote: fixture.nativeElement as HTMLElement, downloadPiece };
  };
  const texte = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('les inscriptions à gauche ; la première est choisie d’office, son détail et ses gestes à droite', () => {
    const { hote, downloadPiece } = monter([INSCRIPTION('RAKOTO1', 'PRMP', 'Rakoto'), INSCRIPTION('RABE2', 'UGPM', 'Rabe')]);
    const lignes = Array.from(hote.querySelectorAll('.ia__item'));
    expect(lignes.map((l) => texte(l.querySelector('.ia__login')))).toEqual(['RAKOTO1', 'RABE2']);
    expect(lignes[0].classList).toContain('ia__item--on');
    expect(texte(hote.querySelector('.ia-detail__title'))).toBe('PRMP RAKOTO1 — Rakoto Hery');
    expect(Array.from(hote.querySelectorAll('.ia-detail__head button')).map((b) => texte(b))).toEqual(['Valider', 'Refuser']);
    expect(Array.from(hote.querySelectorAll('.ia__pieces button')).map((b) => texte(b))).toEqual(['Informations', 'Arrêté', 'CIN', 'Photo']);
    expect(texte(hote.querySelector('.ia-detail__entites'))).toContain('Ministère de la Santé');
    expect(downloadPiece).toHaveBeenCalledWith('RAKOTO1', 'PHOTO');
  });

  it('choisir une autre inscription l’affiche à droite ; une pièce s’ouvre dans le même volet', () => {
    const { fixture, hote, downloadPiece } = monter([INSCRIPTION('RAKOTO1', 'PRMP', 'Rakoto'), INSCRIPTION('RABE2', 'UGPM', 'Rabe')]);
    hote.querySelectorAll<HTMLButtonElement>('.ia__ligne')[1].click();
    fixture.detectChanges();
    expect(texte(hote.querySelector('.ia-detail__title'))).toBe('UGPM RABE2 — Rabe Hery');
    expect(Array.from(hote.querySelectorAll('.ia__pieces button')).map((b) => texte(b))).toEqual(['Informations', 'CIN', 'Photo']);
    Array.from(hote.querySelectorAll<HTMLButtonElement>('.ia__pieces button')).find((b) => texte(b) === 'CIN')!.click();
    fixture.detectChanges();
    expect(downloadPiece).toHaveBeenLastCalledWith('RABE2', 'CIN');
    expect(texte(hote.querySelector('.ia-detail__no-photo'))).toBe('Aucune pièce');
  });

  it('sans inscription en attente : le message, pas de volets', () => {
    const { hote } = monter([]);
    expect(hote.querySelector('app-deux-volets')).toBeNull();
    expect(texte(hote)).toContain('Aucune inscription en attente.');
  });
});
