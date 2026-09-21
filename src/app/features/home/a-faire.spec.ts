import { Component, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { AFaire, Dispatch, Dossier, Reception, Role } from '../../models';
import { DispatchService, DossierService, ReceptionService } from '../../services';
import { DispatchForm, DispatchItem } from '../circuit/dispatch-form';
import { AFaireEcran } from './a-faire';
import { exempleAFairePresident, exempleAFairePrmp, exempleDelegationsPresident } from './a-faire/a-faire-contrat.exemple';

// Doublure de la seule modale restée sur l'accueil (lot L4-F6) : le dispatch GROUPÉ.
@Component({ selector: 'app-dispatch-form', template: '<p class="doublure-dispatch">{{ items().length }}</p>' })
class DispatchFormDoublure {
  readonly items = input.required<DispatchItem[]>();
  readonly reattribution = input<Dispatch | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();
}

const erreur = (status: number, fieldErrors?: Record<string, string>): ApiError => ({ status, message: 'x', fieldErrors, raw: new HttpErrorResponse({ status }) });

describe('Accueil « À faire » (écran)', () => {
  let aFaire: ReturnType<typeof vi.fn<(delegations: boolean) => Observable<AFaire>>>;
  let harness: RouterTestingHarness;
  const racine = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const tous = (sel: string): HTMLElement[] => Array.from(racine().querySelectorAll<HTMLElement>(sel));
  const rendre = (): void => harness.detectChanges();

  const monter = async (role: Role, reponse: () => Observable<AFaire>, url: string): Promise<void> => {
    aFaire = vi.fn((delegations: boolean) => (delegations ? of(exempleDelegationsPresident()) : reponse()));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'president/a-faire', component: AFaireEcran },
          { path: 'prmp/a-faire', component: AFaireEcran },
        ]),
        { provide: AuthService, useValue: { role: signal(role), nomAffichage: signal('RAVELOMANANA Mamy'), login: signal('PRES001') } },
        { provide: DossierService, useValue: { aFaire, getById: (id: number) => of({ idDossier: id, statut: 'PRET_DISPATCH' } as Dossier) } },
        { provide: ReceptionService, useValue: { getById: (id: number) => of({ idReception: id, idDossier: 1 } as Reception) } },
        { provide: DispatchService, useValue: { getById: (id: number) => of({ idDispatch: id, idReception: 1 } as Dispatch) } },
      ],
    });
    TestBed.overrideComponent(AFaireEcran, {
      remove: { imports: [DispatchForm] },
      add: { imports: [DispatchFormDoublure] },
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    rendre();
  };
  const president = (): Promise<void> => monter('PRESIDENT', () => of(exempleAFairePresident()), '/president/a-faire');

  it('rend en-tête, compteurs et sections à partir du JSON du contrat', async () => {
    await president();
    expect(texte(racine().querySelector('h1'))).toBe('À faire');
    expect(texte(racine().querySelector('.af__lead'))).toBe('Bonjour Mamy. 5 actions vous attendent, dont 1 en retard.');
    expect(tous('.af-compteurs__c').map(texte)).toEqual(['1 en retard', '2 bientôt à échéance', '1 dans les délais', '1 sans délai']);
    const sections = tous('.af-liste > .af-sec');
    expect(sections.map((s) => [texte(s.querySelector('h2')), texte(s.querySelector('.af-sec__n')), texte(s.querySelector('.af-sec__std'))])).toEqual([
      ['À dispatcher', '3', 'Délai standard 8 h'],
      ['Projets de PV à viser', '1', 'Délai standard 16 h'],
      ['Demandes de retrait', '1', 'Sans délai standard'],
    ]);
    const premiere = sections[0].querySelector('.af-l') as HTMLElement;
    expect(texte(premiere.querySelector('.af-l__meta'))).toBe('DAO Antananarivo · Numéroté le 11/09');
    expect(texte(premiere.querySelector('.af-l__delai'))).toBe('1 h de retard 9 h sur 8 h');
    // ⚠️ Pilote 21/09 — plus de bouton d'action sur la ligne (il doublait le panneau) : seul le corps cliquable.
    expect(premiere.querySelector('.af-l__act')).toBeNull();
    expect(texte(sections[0].querySelector('.af-sec__lot'))).toBe('Dispatcher la sélection');
    // Une action, un verbe : l'aperçu de la ligne sélectionnée porte le verbe, en clair.
    expect(texte(racine().querySelector('.suite__t'))).toBe('Dispatcher le dossier');
    expect(texte(racine().querySelector('.ap__principal'))).toBe('Dispatcher le dossier');
    expect(aFaire).toHaveBeenCalledTimes(1);
    expect(aFaire).toHaveBeenCalledWith(false);
  });

  it("respecte le tri serveur : lignes dans l'ordre servi, pas celui des références", async () => {
    await president();
    expect(tous('.af-liste > .af-sec')[0].querySelectorAll('.af-l__ref').length).toBe(3);
    expect(Array.from(tous('.af-liste > .af-sec')[0].querySelectorAll('.af-l__ref')).map(texte)).toEqual(['00015/DGSR/DAO/2026', '00014/MTP/PPM/2026', '00016/FR/PPM/2026']);
    (tous('.af-vues__b').find((b) => texte(b) === 'Par localité') as HTMLButtonElement).click();
    rendre();
    expect(tous('.af-liste > .af-sec h2').map(texte)).toEqual(['Antananarivo']);
    expect(tous('.af-liste .af-l__ref').map(texte)).toEqual(['00015/DGSR/DAO/2026', '00014/MTP/PPM/2026', '00002/MTP/PPM-AGPM/2026', '00016/FR/PPM/2026', '00009/DGB/PPM/2026']);
  });

  it("aperçu : la première ligne par défaut, puis la ligne choisie (clic ou flèches)", async () => {
    await president();
    const corps = tous('.af-l__corps');
    expect(corps[0].getAttribute('aria-pressed')).toBe('true');
    expect(texte(racine().querySelector('.ap__ref'))).toBe('00015/DGSR/DAO/2026');

    corps[0].focus();
    corps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    rendre();
    expect(document.activeElement).toBe(tous('.af-l__corps')[1]);
    expect(texte(racine().querySelector('.ap__ref'))).toBe('00014/MTP/PPM/2026');

    tous('.af-l__corps')[3].click(); // 00002, projet de PV à viser
    rendre();
    const apercu = racine().querySelector('app-a-faire-apercu') as HTMLElement;
    expect(texte(apercu.querySelector('.ap__ref'))).toBe('00002/MTP/PPM-AGPM/2026');
    expect(texte(apercu.querySelector('.suite__t'))).toBe('Viser le projet de PV');
    expect(texte(apercu.querySelector('.suite__d'))).toMatch(/^Reste 5 h · avant mar\.? 15\/09, 12:00$/);
    expect(apercu.querySelectorAll('.frise__e').length).toBe(7);
    expect(texte(apercu.querySelector('.frise'))).toContain('Naina Razafindrakoto');
    expect(Array.from(apercu.querySelectorAll('.ap__actions button')).map(texte)).toEqual(['Viser le projet de PV', 'Retourner le projet pour rectification', 'Lettre de renvoi']); // « Lettre de renvoi » : troisième issue de la décision, dérivée côté écran (pilote 21/09)
    // Lot L4-F6 : « Consulter le dossier » est un LIEN vers la page, avec le retour vers l'accueil.
    const consulter = apercu.querySelector('.ap__actions a') as HTMLAnchorElement;
    expect(texte(consulter)).toBe('Consulter le dossier');
    expect(consulter.getAttribute('href')).toBe('/president/dossier/1002?returnUrl=%2Fpresident%2Fa-faire');
    expect((apercu.querySelector('.ap__ref a') as HTMLAnchorElement).getAttribute('href')).toBe('/president/dossier/1002?returnUrl=%2Fpresident%2Fa-faire');
  });

  it("aperçu PRMP : ni acteurs ni faits internes, compteur en pause", async () => {
    await monter('PRMP', () => of(exempleAFairePrmp()), '/prmp/a-faire');
    expect(texte(racine().querySelector('.af__lead'))).toBe('Bonjour Mamy. 2 dossiers attendent une action de votre part.');
    tous('.af-l__corps')[1].click(); // à rectifier
    rendre();
    const apercu = racine().querySelector('app-a-faire-apercu') as HTMLElement;
    expect(Array.from(apercu.querySelectorAll('.frise__e')).every((e) => !e.hasAttribute('title'))).toBe(true);
    expect(texte(apercu.querySelector('.frise'))).not.toMatch(/Rasoanaivo|Razafindrakoto/);
    expect(apercu.querySelector('.frise__e--pause')).not.toBeNull();
    expect(texte(apercu.querySelector('.faits'))).not.toContain('Examiné par');
    expect(texte(apercu.querySelector('.suite__d'))).toBe('En pause · depuis le 12/09');
    // Ligne : texte court, la date sous la barre (plus rien de tronqué dans la colonne du délai).
    expect(texte(tous('.af-l__delai')[1])).toBe('En pause Depuis le 12/09');
  });

  it('bloc délégation : replié, hors compteurs, lignes demandées au dépli seulement', async () => {
    await president();
    const bouton = racine().querySelector('.af-deleg__b') as HTMLButtonElement;
    expect(texte(racine().querySelector('.af-deleg__txt'))).toBe(
      '3 tâches peuvent aussi être prises en charge à un autre titre (délégation, intérim, collègue, suppléance), hors compteurs : à réceptionner et numéroter (3).',
    );
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(racine().querySelector('.af-deleg__corps')).toBeNull();

    bouton.click();
    rendre();
    expect(aFaire).toHaveBeenLastCalledWith(true);
    const lignes = Array.from(racine().querySelectorAll('.af-deleg__corps .af-l'));
    expect(lignes.map((l) => texte(l.querySelector('.af-l__ref')))).toEqual(['Dépôt du 14/09 à 09:12', 'Dépôt du 14/09 à 10:30', 'Dépôt du 14/09 à 14:10']);
    expect(texte(lignes[0].querySelector('.af-l__mode'))).toBe('Par délégation');
    expect(tous('.af-compteurs__c').map(texte)[0]).toBe('1 en retard');
  });

  it('gestes : la page du dossier pour les gestes courts, l’écran de travail sinon', async () => {
    await president();
    const router = TestBed.inject(Router);
    const naviguer = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    // ⚠️ Pilote 21/09 — le geste se joue depuis le PANNEAU de la ligne sélectionnée (plus de bouton de ligne).
    const agirSur = (ref: string): void => {
      (tous('.af-l__corps').find((b) => texte(b).includes(ref)) as HTMLButtonElement).click();
      rendre();
      (racine().querySelector('.ap__principal') as HTMLButtonElement).click();
    };

    // Navette du PV et décision de retrait : la page, ouverte sur l'étape (décision 2 du plan L4).
    agirSur('00002/MTP/PPM-AGPM/2026');
    expect(naviguer).toHaveBeenLastCalledWith(['/', 'president', 'dossier', 1002], { queryParams: { returnUrl: '/president/a-faire', geste: 'VISER' } });
    agirSur('00009/DGB/PPM/2026');
    expect(naviguer).toHaveBeenLastCalledWith(['/', 'president', 'dossier', 1009], { queryParams: { returnUrl: '/president/a-faire', geste: 'DECIDER_RETRAIT' } });
    agirSur('00015/DGSR/DAO/2026');
    expect(naviguer).toHaveBeenLastCalledWith(['/', 'president', 'dossier', 1051], { queryParams: { returnUrl: '/president/a-faire', geste: 'DISPATCHER' } });

    // Le regroupement choisi part dans le retour : la liste se retrouve telle qu'on l'a quittée.
    (tous('.af-vues__b').find((b) => texte(b) === 'Par étape') as HTMLButtonElement).click();
    rendre();
    agirSur('00015/DGSR/DAO/2026');
    expect(naviguer).toHaveBeenLastCalledWith(['/', 'president', 'dossier', 1051], { queryParams: { returnUrl: '/president/a-faire?vue=etape', geste: 'DISPATCHER' } });
  });

  it('dispatch groupé : la seule modale restée sur l’accueil', async () => {
    await president();
    const coches = tous('.af-l__coche input') as HTMLInputElement[];
    expect(coches.length).toBe(3);
    coches[0].click();
    coches[2].click();
    rendre();
    const lot = racine().querySelector('.af-sec__lot') as HTMLButtonElement;
    expect(texte(lot)).toBe('Dispatcher la sélection (2)');
    lot.click();
    rendre();
    expect(texte(racine().querySelector('.doublure-dispatch'))).toBe('2');
  });

  it('reprend la réponse transmise par l’accueil, sans second appel', async () => {
    await monter('PRESIDENT', () => of(exempleAFairePresident()), '/prmp/a-faire');
    aFaire.mockClear();
    await TestBed.inject(Router).navigateByUrl('/president/a-faire', { state: { aFaire: exempleAFairePresident() } });
    rendre();
    expect(aFaire).not.toHaveBeenCalled();
    expect(tous('.af-l').length).toBe(5);
  });

  it("endpoint pas encore servi : un mot et l'écran habituel ; panne : « Réessayer »", async () => {
    await monter('PRESIDENT', () => throwError(() => erreur(400, { id: 'valeur numérique attendue.' })), '/president/a-faire');
    expect(texte(racine().querySelector('.af-vide__t'))).toBe("L'accueil « À faire » n'est pas encore servi par le serveur.");
    expect(racine().querySelector('.af-vide a')?.getAttribute('href')).toBe('/president/tableau-de-bord');
    expect(racine().querySelector('app-etat-erreur')).toBeNull();

    TestBed.resetTestingModule();
    await monter('PRESIDENT', () => throwError(() => erreur(500)), '/president/a-faire');
    expect(racine().querySelector('app-etat-erreur')).not.toBeNull();
    (racine().querySelector('app-etat-erreur button') as HTMLButtonElement).click();
    expect(aFaire).toHaveBeenCalledTimes(2);
  });
});
