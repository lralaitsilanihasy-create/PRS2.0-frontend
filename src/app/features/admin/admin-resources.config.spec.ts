import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CrudPage } from '../../shared/crud/crud-page';
import { REFERENTIELS } from './admin-resources.config';

/**
 * Audit 2026-09-14 (E3) — le formulaire générique n'envoie que les champs de sa configuration. Les
 * points de contrôle n'en déclaraient aucun pour la portée : toute modification d'un point FICHE,
 * AGPM, DOSSIER ou SUPPRESSION le repassait en LIGNE, et la création ne produisait que du LIGNE.
 */
describe('Points de contrôle (admin) — portée', () => {
  const config = REFERENTIELS.find((r) => r.slug === 'points-ctrls')!.config;
  const champ = config.fields.find((f) => f.key === 'portee');

  function ouvrirEcran(): { page: CrudPage; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { crud: config } }, queryParamMap: of(convertToParamMap({})) },
        },
      ],
    });
    return { page: TestBed.createComponent(CrudPage).componentInstance, http: TestBed.inject(HttpTestingController) };
  }

  it("propose exactement les valeurs de l'enum backend PorteePointCtrl", () => {
    const valeurs = (champ?.options ?? []).map((o) => (typeof o === 'object' ? o.value : o));
    expect(valeurs).toEqual(['LIGNE', 'DOSSIER', 'FICHE', 'AGPM', 'SUPPRESSION']);
    expect(champ?.required).toBe(true);
    expect(champ?.hideInList).toBeFalsy();
  });

  it('pré-remplit LIGNE à la création', () => {
    const { page } = ouvrirEcran();
    page.openCreate();
    expect(page.form.get('portee')?.value).toBe('LIGNE');
  });

  it("conserve la portée du point à la modification (le PUT l'envoie)", () => {
    const { page, http } = ouvrirEcran();
    page.openEdit({ idPointCtrl: 7, libelPointCtrl: 'Fiche complète', obligatoire: true, idTypeDossier: 'DDP', idSousType: null, portee: 'FICHE' });
    page.save();
    const put = http.match((r) => r.method === 'PUT');
    expect(put.length).toBe(1);
    expect(put[0].request.body.portee).toBe('FICHE');
  });
});
