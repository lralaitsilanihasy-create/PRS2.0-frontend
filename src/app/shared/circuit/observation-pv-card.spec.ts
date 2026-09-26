import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ObservationPv } from '../../models';
import { ObservationPvCard, decomposerObservation } from './observation-pv-card';

/**
 * La carte d'une observation du PV : le libellé FIGÉ décomposé, et — ⚠️ lot B (V44, 26/09) — l'information de la
 * fiche DAO visée, nommée avec son lot et sa valeur observée, avec le lien vers la fiche dans l'espace du lecteur.
 */
const OBS: ObservationPv = {
  idObservationPv: 4,
  idDossier: 100349,
  idPv: 38,
  source: 'POINT',
  libelle: 'Contrôles du dossier — Garantie de soumission : au lieu de « 2170000 », lire « 2 000 000 Ariary »',
  statut: 'EMISE',
};

describe('ObservationPvCard', () => {
  let fixture: ComponentFixture<ObservationPvCard>;
  let role: string | null;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (sel: string): string => (racine().querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  beforeEach(async () => {
    role = 'VERIFICATEUR';
    await TestBed.configureTestingModule({
      imports: [ObservationPvCard],
      providers: [provideRouter([]), { provide: AuthService, useValue: { role: () => role } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ObservationPvCard);
    fixture.componentRef.setInput('obs', OBS);
    fixture.detectChanges();
  });

  it('décompose le libellé figé en contexte et correction « Au lieu de → Lire »', () => {
    expect(decomposerObservation(OBS.libelle)).toEqual({ contexte: 'Contrôles du dossier — Garantie de soumission', auLieuDe: '2170000', lire: '2 000 000 Ariary', demande: null });
    expect(texte('.opv__contexte')).toBe('Contrôles du dossier — Garantie de soumission');
    expect(texte('.opv__corr-col--avant .opv__corr-v')).toBe('2170000');
    expect(texte('.opv__corr-col--apres .opv__corr-v')).toBe('2 000 000 Ariary');
    // Sans ancrage sur la fiche, rien n'est ajouté.
    expect(racine().querySelector('.opv__fiche')).toBeNull();
  });

  it("nomme l'information de la fiche DAO visée, son lot et sa valeur observée, et mène à la fiche dans l'espace du lecteur", () => {
    fixture.componentRef.setInput('obs', {
      ...OBS,
      idDmc: 14,
      champFiche: 'B05-GS-03#2',
      libelleChampFiche: 'Montant de la garantie de soumission (Ariary)',
      valeurChampFiche: '2 170 000 Ariary (deux millions cent soixante-dix mille ariary)',
      lot: 2,
    });
    fixture.detectChanges();

    expect(texte('.opv__fiche')).toBe(
      'Information de la fiche DAO : Montant de la garantie de soumission (Ariary) — lot 2 · valeur observée « 2 170 000 Ariary (deux millions cent soixante-dix mille ariary) » Ouvrir la fiche',
    );
    expect(racine().querySelector<HTMLAnchorElement>('.opv__lien')?.getAttribute('href')).toBe('/verificateur/dao/14');
  });

  it("se passe du lien quand le lecteur n'a pas d'espace (Administrateur), et de tout libellé manquant", () => {
    role = null;
    fixture.componentRef.setInput('obs', { ...OBS, idDmc: 14, champFiche: 'B04-VO-01' });
    fixture.detectChanges();

    expect(texte('.opv__fiche')).toBe('Information de la fiche DAO : B04-VO-01');
    expect(racine().querySelector('.opv__lien')).toBeNull();
  });
});
