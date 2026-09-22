import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { ReferentielFiche } from '../../models';
import { ChampsFicheMarcheAdmin } from './champs-fiche-marche-admin';

/** Référentiel tel que servi (livraison du 22/09) : rubriques en code complet, un champ CADRAGE, une rubrique vide. */
const REF: ReferentielFiche = {
  blocs: [
    { code: 'B05', libelle: 'Prix, montants & garantie de soumission', rang: 5, rubriques: [
      { code: 'B05-GS', libelle: 'Garantie de soumission', rang: 4, documentMaitre: 'DPAO', nbAttendu: 6 },
      { code: 'B05-MO', libelle: 'Monnaie', rang: 3, documentMaitre: 'DPAO', nbAttendu: 2 },
    ] },
    { code: 'B02', libelle: 'Objet, allotissement & forme du marché', rang: 2, rubriques: [{ code: 'B02-OB', libelle: 'Objet', rang: 1, documentMaitre: 'DPAO', nbAttendu: 1 }] },
  ],
  champs: [
    { code: 'B05-GS-01', bloc: 'B05', rubrique: 'B05-GS', rang: 1, libelle: 'Garantie de soumission exigée', type: 'OUI_NON', source: 'CADRAGE', documentMaitre: 'DPAO', reprises: ['AE'], typesMarche: ['QUANTITE_FIXE'], obligatoire: false, cleCadrage: 'garantieSoumission', actif: true },
    { code: 'B05-GS-02', bloc: 'B05', rubrique: 'B05-GS', rang: 2, libelle: 'Montant de la garantie', type: 'MONTANT', source: 'SAISIE', documentMaitre: 'DPAO', reprises: ['AE', 'CCAP'], typesMarche: ['QUANTITE_FIXE'], obligatoire: true, condition: 'garantieSoumission = OUI', actif: true },
  ],
};

describe('Champs de la fiche marché — référentiel Administrateur (B1, 22/09)', () => {
  let fixture: ComponentFixture<ChampsFicheMarcheAdmin>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rendre = (): void => fixture.detectChanges();
  const bouton = (libelle: string): HTMLButtonElement => {
    const b = Array.from(racine().querySelectorAll('button')).find((x) => texte(x) === libelle);
    if (!b) throw new Error(`Bouton « ${libelle} » introuvable`);
    return b;
  };

  function monter(ref: ReferentielFiche | null): void {
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ChampsFicheMarcheAdmin);
    rendre();
    const r = http.expectOne((x) => x.url === '/api/champs-fiche-marche' && !x.params.has('typeMarche'));
    if (ref) r.flush(ref);
    else r.flush({}, { status: 404, statusText: 'Not Found' });
    rendre();
  }

  afterEach(() => http.verify());

  it('groupe les champs par bloc puis rubrique (ordre des rangs), compte n / attendus, signale les rubriques incomplètes', () => {
    monter(REF);
    expect(Array.from(racine().querySelectorAll('.cfm__bloc th')).map((th) => texte(th))).toEqual(['B02 — Objet, allotissement & forme du marché', 'B05 — Prix, montants & garantie de soumission']);
    const rubriques = Array.from(racine().querySelectorAll('.cfm__rub'));
    expect(rubriques.map((r) => texte(r.querySelector('.cfm__rub-l')))).toEqual(['Objet', 'Monnaie', 'Garantie de soumission']);
    expect(rubriques.map((r) => texte(r.querySelector('.badge')))).toEqual(['0 / 1', '0 / 2', '2 / 6']);
    expect(rubriques.every((r) => r.querySelector('.badge')?.classList.contains('badge-warning'))).toBe(true);
    expect(texte(racine().querySelector('.cfm__resume'))).toContain('2 champ(s) — 2 actif(s), 1 à saisir, 0 du PPM, 1 du cadrage');
    expect(texte(racine().querySelector('.cfm__resume'))).toContain('Attendus par l’esquisse : 9'.replace('’', "'"));
    expect(racine().querySelectorAll('tbody tr:not(.cfm__bloc):not(.cfm__rub)').length).toBe(2);
  });

  it('création : le formulaire envoie un POST typé (listes, condition, clé de cadrage) et la ligne rejoint sa rubrique', () => {
    monter(REF);
    bouton('+ Ajouter un champ').click();
    rendre();
    const form = racine().querySelector('form') as HTMLFormElement;
    expect(form.getAttribute('aria-label')).toBe('Nouveau champ');
    const saisir = (sel: string, v: string, ev = 'input'): void => {
      const el = form.querySelector(sel) as HTMLInputElement;
      el.value = v;
      el.dispatchEvent(new Event(ev));
      rendre();
    };
    expect(bouton('Créer le champ').disabled).toBe(true);
    saisir('input[placeholder="B05-GS-02"]', 'b05-gs-03');
    saisir('input.form-control:not([placeholder])', 'Forme de la garantie');
    saisir('select.form-control', 'LISTE', 'change');
    saisir('input[placeholder^="Caution"]', 'Caution, Chèque de banque');
    saisir('input[placeholder^="garantieSoumission ="]', 'garantieSoumission = OUI');
    (Array.from(form.querySelectorAll('.cfm__case input')).find((i) => texte(i.parentElement).includes('CCAP')) as HTMLInputElement).click();
    rendre();
    expect(bouton('Créer le champ').disabled).toBe(false);
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    const post = http.expectOne('/api/champs-fiche-marche');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toMatchObject({ code: 'B05-GS-03', libelle: 'Forme de la garantie', type: 'LISTE', source: 'SAISIE', options: ['Caution', 'Chèque de banque'], condition: 'garantieSoumission = OUI', reprises: ['CCAP'], typesMarche: ['QUANTITE_FIXE'], actif: true });
    post.flush({ ...post.request.body, bloc: 'B05', rubrique: 'B05-GS', rang: 3 });
    rendre();
    expect(racine().querySelector('form')).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Champ B05-GS-03 créé.');
    expect(texte(Array.from(racine().querySelectorAll('.cfm__rub')).find((r) => texte(r).includes('Garantie de soumission'))?.querySelector('.badge'))).toBe('3 / 6');
  });

  it('modification : le code est verrouillé, un 400 nominatif se pose sous le champ fautif, sans toast', () => {
    monter(REF);
    Array.from(racine().querySelectorAll('button')).filter((b) => texte(b) === 'Modifier')[1].click();
    rendre();
    const form = racine().querySelector('form') as HTMLFormElement;
    expect(form.getAttribute('aria-label')).toBe('Modifier le champ B05-GS-02');
    expect((form.querySelector('input[placeholder="B05-GS-02"]') as HTMLInputElement).readOnly).toBe(true);
    const cond = form.querySelector('input[placeholder^="garantieSoumission ="]') as HTMLInputElement;
    cond.value = 'garantieSoumission OUI';
    cond.dispatchEvent(new Event('input'));
    rendre();
    expect(bouton('Enregistrer').disabled).toBe(false);
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    const put = http.expectOne('/api/champs-fiche-marche/B05-GS-02');
    expect(put.request.method).toBe('PUT');
    put.flush({ message: 'Validation échouée', erreurs: [{ champ: 'condition', message: 'Condition illisible.' }] }, { status: 400, statusText: 'Bad Request' });
    rendre();
    expect(texte(racine().querySelector('form .form-error'))).toBe('Condition illisible.');
    expect(toast.error).not.toHaveBeenCalled();
    expect(racine().querySelector('form')).not.toBeNull();
    // Désactiver un champ = actif faux (pas de suppression).
    (form.querySelector('.cfm__case input[checked]') as HTMLInputElement | null)?.dispatchEvent(new Event('change'));
    bouton('Annuler').click();
    rendre();
    expect(racine().querySelector('form')).toBeNull();
  });

  it('serveur sans le lot 1 : tableau vide explicite, aucune erreur bloquante', () => {
    monter(null);
    expect(texte(racine().querySelector('tbody td'))).toContain('n’est pas servi'.replace('’', "'"));
    expect(racine().querySelector('app-etat-erreur')).toBeNull();
  });
});
