import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import { AnalyseIa, EcartementRequest, ResumePreControle, Signalement } from '../../models';
import { PreControleService } from '../../services';
import { PreControlePanneau } from './pre-controle-panneau';

/** Un signalement de fractionnement, prioritaire et ouvert. */
const FRACTIONNEMENT: Signalement = {
  id: 11,
  type: 'FRACTIONNEMENT_COMPTE',
  libelleRegle: 'Lignes homogènes sur un même compte — à fusionner, éventuellement à allotir',
  gravite: 'PRIORITAIRE',
  source: 'REGLE',
  statut: 'OUVERT',
  description:
    '3 lignes du compte 61121, même forme de marché (quantités fixes), totalisent 180 000 000 Ar HT. ' +
    'Le manuel de contrôle a priori (p. 15) demande de les fusionner.',
  suggestion: 'Au lieu de : 3 lignes distinctes sur le compte 61121.\nLire : un seul marché.',
  idDetail: null,
  designationLigne: null,
  lignes: [
    { idDetail: 7601, designation: 'Achat de ramettes de papier', montant: 60000000 },
    { idDetail: 7602, designation: 'Achat de papier A4', montant: 60000000 },
    { idDetail: 7603, designation: 'Fourniture de papier', montant: 60000000 },
  ],
  idPointCtrl: 20,
  libellePointCtrl: 'Fractionnement illicite',
  dateDetection: '2026-09-20T10:12:31',
  ecartement: null,
  fige: false,
  dateLevee: null,
  detailLevee: null,
};

/** Une piste de l'assistant, à ne pas présenter comme un fait. */
const PISTE_IA: Signalement = {
  ...FRACTIONNEMENT,
  id: 12,
  type: 'FRACTIONNEMENT_DEGUISE',
  libelleRegle: 'Même besoin réparti sur des comptes différents',
  gravite: 'A_VERIFIER',
  source: 'IA',
  description: 'Ces deux lignes semblent viser la même route nationale.',
  suggestion: null,
  lignes: [],
  idDetail: 7604,
  designationLigne: 'Entretien de la RN2',
  idPointCtrl: null,
  libellePointCtrl: null,
};

const RESUME: ResumePreControle = {
  idPpm: 760,
  exercice: 2026,
  dateVerification: '2026-09-20T10:12:31',
  nbOuverts: 2,
  nbPrioritaires: 1,
  nbEcartes: 0,
  nbLeves: 0,
  signalements: [FRACTIONNEMENT, PISTE_IA],
};

/** Service factice : compte les appels et rend ce que le test lui donne. */
class FauxPreControle {
  resume: ResumePreControle = RESUME;
  echecLecture = false;
  verifications = 0;
  ecartements: { id: number; corps: EcartementRequest }[] = [];
  reprises: number[] = [];

  lire(): Observable<ResumePreControle> {
    return this.echecLecture ? throwError(() => ({ status: 500 })) : of(this.resume);
  }

  /**
   * La vérification reste **en attente** : c'est la seule façon d'éprouver la garde anti-double-clic —
   * avec une réponse immédiate, le verrou serait déjà relâché au second clic, comme il ne l'est jamais
   * face à un vrai serveur.
   */
  fluxVerifier = new Subject<ResumePreControle>();

  verifier(): Observable<ResumePreControle> {
    this.verifications++;
    this.fluxVerifier = new Subject<ResumePreControle>();
    return this.fluxVerifier;
  }

  ecarter(id: number, corps: EcartementRequest): Observable<Signalement> {
    this.ecartements.push({ id, corps });
    return of({ ...FRACTIONNEMENT, statut: 'ECARTE' as const });
  }

  reprendre(id: number): Observable<Signalement> {
    this.reprises.push(id);
    return of({ ...FRACTIONNEMENT, statut: 'OUVERT' as const });
  }

  /** L'analyse par l'assistant : `analyseAbsente` simule un serveur où l'assistant n'est pas activé (404). */
  analyses = 0;
  analyseAbsente = false;
  synthese: string | null = 'À regarder d’abord : lignes 7601 et 7602 (même besoin possible).';

  analyser(): Observable<AnalyseIa> {
    this.analyses++;
    if (this.analyseAbsente) {
      return throwError(() => ({ status: 404 }));
    }
    return of({ synthese: this.synthese, resume: { ...this.resume, signalements: [PISTE_IA] } });
  }
}

/**
 * Panneau du pré-contrôle du PPM (lot 3) — ce que l'écran doit rendre visible pour que l'outil reste une
 * aide : un fait et une piste distingués, l'avertissement avant tout écartement, un motif qui dit
 * quelque chose, et rien qui s'efface.
 */
describe('Panneau du pré-contrôle du PPM', () => {
  let faux: FauxPreControle;

  /** Monte le panneau avec le profil, la référence d'acteur et le résumé que le test veut. */
  const monter = (options: { role?: string; ref?: string; resume?: ResumePreControle; echec?: boolean } = {}) => {
    faux = new FauxPreControle();
    if (options.resume) {
      faux.resume = options.resume;
    }
    faux.echecLecture = options.echec === true;
    const role = options.role ?? 'PRMP';
    const auth = {
      hasRole: (...roles: string[]) => roles.includes(role),
      ref: () => options.ref ?? 'PRMP001',
    };
    TestBed.configureTestingModule({
      imports: [PreControlePanneau],
      providers: [
        { provide: PreControleService, useValue: faux },
        { provide: AuthService, useValue: auth },
        {
          provide: ToastService,
          useValue: { success: () => 0, info: () => 0, warning: () => 0, error: () => 0 },
        },
      ],
    });
    const fixture = TestBed.createComponent(PreControlePanneau);
    fixture.componentRef.setInput('idPpm', 760);
    fixture.detectChanges();
    return { fixture, hote: fixture.nativeElement as HTMLElement, rendre: () => fixture.detectChanges() };
  };

  const boutons = (hote: HTMLElement, texte: string) =>
    [...hote.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent?.includes(texte));

  afterEach(() => TestBed.resetTestingModule());

  it('écrit la phrase du bandeau à partir des compteurs du serveur, et rappelle qu’il ne décide pas', () => {
    const { hote } = monter();

    expect(hote.querySelector('.pc__resume')?.textContent).toContain('2 points à regarder');
    expect(hote.querySelector('.pc__resume')?.textContent).toContain('dont 1 prioritaire');
    expect(hote.querySelector('.pc__mention')?.textContent).toContain('signale');
    expect(hote.querySelector('.pc__mention')?.textContent).toContain('ne refuse aucune soumission');
  });

  it('distingue un fait d’une piste de l’assistant — la pastille et son infobulle', () => {
    const { hote } = monter();
    const items = hote.querySelectorAll('.pc__item');

    expect(items.length).toBe(2);
    const badgesFait = [...items[0].querySelectorAll('.badge')].map((b) => b.textContent?.trim());
    expect(badgesFait).toContain('Règle');
    expect(badgesFait).toContain('Prioritaire');
    const piste = [...items[1].querySelectorAll('.badge')].find((b) => b.textContent?.includes('assistant'));
    expect(piste?.getAttribute('title')).toContain('pas un constat opposable');
  });

  it('montre les lignes visées avec leur montant du moment, et la correction telle qu’elle est rédigée', () => {
    const { hote } = monter();
    const premier = hote.querySelector('.pc__item')!;

    expect(premier.querySelectorAll('.pc__lignes tbody tr').length).toBe(3);
    expect(premier.querySelector('.pc__lignes tbody tr td')?.textContent).toContain('ramettes');
    expect(premier.querySelector('.pc__suggestion-texte')?.textContent).toContain('Au lieu de :');
    expect(premier.querySelector('.pc__suggestion-texte')?.textContent).toContain('Lire :');
    expect(premier.querySelector('.pc__point')?.textContent).toContain('Fractionnement illicite');
  });

  it('la fenêtre d’écartement dit l’avertissement en toutes lettres, et refuse un motif trop court', () => {
    const { hote, rendre } = monter();

    boutons(hote, 'Écarter ce signalement')[0].click();
    rendre();

    expect(hote.querySelector('[role="dialog"]')).not.toBeNull();
    expect(hote.querySelector('.alert-warning')?.textContent).toContain('visibles de l’autre côté du circuit');

    const valider = boutons(hote, 'Écarter, avec ce motif')[0];
    expect(valider.disabled).toBe(true);

    const zone = hote.querySelector<HTMLTextAreaElement>('#pc-motif')!;
    zone.value = 'RAS';
    zone.dispatchEvent(new Event('input'));
    rendre();
    expect(valider.disabled).toBe(true);

    zone.value = 'Trois sites distincts, livraisons séparées imposées par le magasin.';
    zone.dispatchEvent(new Event('input'));
    rendre();
    expect(valider.disabled).toBe(false);

    valider.click();
    expect(faux.ecartements.length).toBe(1);
    expect(faux.ecartements[0].id).toBe(11);
    expect(faux.ecartements[0].corps.avertissementLu).toBe(true);
    expect(faux.ecartements[0].corps.motif).toBe(
      'Trois sites distincts, livraisons séparées imposées par le magasin.',
    );
  });

  it('le contrôleur lit l’écartement de la PRMP avec son motif — et ne reprend pas ce qui n’est pas le sien', () => {
    const { hote } = monter({
      role: 'MEMBRE',
      ref: 'MEM001',
      resume: {
        ...RESUME,
        nbOuverts: 1,
        nbEcartes: 1,
        signalements: [
          {
            ...FRACTIONNEMENT,
            statut: 'ECARTE',
            ecartement: {
              typeActeur: 'PRMP',
              refActeur: 'PRMP001',
              date: '2026-09-20T11:00:00',
              motif: 'Trois sites distincts, livraisons séparées.',
            },
          },
        ],
      },
    });

    expect(hote.querySelector('.pc__ecartement-titre')?.textContent).toContain('Écarté par la PRMP');
    expect(hote.querySelector('.pc__ecartement-motif')?.textContent).toContain('Trois sites distincts');
    expect(boutons(hote, 'Reprendre').length).toBe(0);
  });

  it('un plan soumis fige les écartements : plus de bouton, et la raison est dite', () => {
    const { hote } = monter({ resume: { ...RESUME, signalements: [{ ...FRACTIONNEMENT, fige: true }] } });

    expect(boutons(hote, 'Écarter ce signalement').length).toBe(0);
    expect(hote.querySelector('.pc__fige')?.textContent).toContain('figés');
  });

  it('l’Assistant contrôleur lit sans écarter : aucun bouton d’écartement ne lui est proposé', () => {
    const { hote } = monter({ role: 'ASSISTANT_CONTROLEUR', ref: 'ASS001' });

    expect(hote.querySelectorAll('.pc__item').length).toBe(2);
    expect(boutons(hote, 'Écarter ce signalement').length).toBe(0);
  });

  it('on ne reprend que SON écartement, et seulement tant que le plan n’est pas soumis', () => {
    const { hote } = monter({
      role: 'PRMP',
      ref: 'PRMP001',
      resume: {
        ...RESUME,
        signalements: [
          {
            ...FRACTIONNEMENT,
            statut: 'ECARTE',
            ecartement: {
              typeActeur: 'PRMP',
              refActeur: 'PRMP001',
              date: null,
              motif: 'Motif suffisamment long pour être recevable.',
            },
          },
          {
            ...PISTE_IA,
            statut: 'ECARTE',
            ecartement: {
              typeActeur: 'PRMP',
              refActeur: 'PRMP999',
              date: null,
              motif: 'Écartement d’une autre PRMP.',
            },
          },
        ],
      },
    });

    const reprises = boutons(hote, 'Reprendre mon écartement');
    expect(reprises.length).toBe(1);

    reprises[0].click();
    expect(faux.reprises).toEqual([11]);
  });

  it('« Vérifier le plan » ne part qu’une fois, même au double-clic', () => {
    const { hote, rendre } = monter();
    const bouton = boutons(hote, 'Vérifier le plan')[0];

    bouton.click();
    bouton.click();
    rendre();

    expect(faux.verifications).toBe(1);
  });

  it('« Demander une piste à l’assistant » affiche où regarder d’abord, et la piste arrive marquée comme telle', () => {
    const { hote, rendre } = monter();

    boutons(hote, 'Demander une piste à l’assistant')[0].click();
    rendre();

    expect(faux.analyses).toBe(1);
    expect(hote.querySelector('.pc__synthese')?.textContent).toContain('À regarder d’abord');
    const badges = [...hote.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
    expect(badges).toContain('Piste de l’assistant');
  });

  it('un serveur sans assistant (404) cesse de le proposer, et les points des règles restent affichés', () => {
    const { hote, rendre } = monter();
    faux.analyseAbsente = true;

    boutons(hote, 'Demander une piste à l’assistant')[0].click();
    rendre();

    expect(boutons(hote, 'Demander une piste à l’assistant').length).toBe(0);
    expect(hote.querySelectorAll('.pc__item').length).toBe(2);
    expect(boutons(hote, 'Vérifier le plan').length).toBe(1);
  });

  it('un échec de chargement affiche l’état d’erreur et sa reprise — jamais un écran vide', () => {
    const { hote } = monter({ echec: true });

    expect(hote.querySelector('app-etat-erreur')).not.toBeNull();
    expect(hote.querySelector('[role="alert"]')?.textContent).toContain("n'empêche ni la saisie ni la soumission");
  });
});
