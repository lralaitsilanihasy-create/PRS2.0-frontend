import { HttpErrorResponse } from '@angular/common/http';

import { ApiError, toApiError } from '../../core/errors/api-error';
import { ControleResultat } from '../../models';
import { bilanControles, controlesEffectifs, messageControleNonConforme, messageControlesBloquants, messageSoumissionRefusee, texteValeurs } from './controles-libelles';

const erreur = (status: number, body: unknown): ApiError => toApiError(new HttpErrorResponse({ status, error: body, url: '/api/dossiers/1/soumettre' }));

const ligne = (p: Partial<ControleResultat>): ControleResultat => ({
  idControle: 1, numeroSoumission: 1, reference: null, idPointCtrl: null, regle: 'R', libelle: null, valeurs: null, resultat: 'CONFORME', bloquant: false, auteur: 'SERVEUR', dateControle: '2026-10-13T10:00:00', observation: null,
  ...p,
});

describe('Contrôles du dossier — règles pures (manuel révisé, R5)', () => {
  it('texteValeurs : les valeurs constatées en une ligne, dates et booléens en clair', () => {
    expect(texteValeurs({ procedureEnLigne: true, pvOuvertureSigne: false, rapportSigneLe: '2026-10-07T09:44:22', pvOuverture: { constate: false } })).toBe(
      'procedureEnLigne : oui · pvOuvertureSigne : non · rapportSigneLe : 07/10/2026 09:44 · pvOuverture : constate : non',
    );
    expect(texteValeurs(null)).toBe('');
  });

  it('messageControlesBloquants : le refus 400 nomme chaque contrôle avec sa référence et ses valeurs, un par ligne', () => {
    const e = erreur(400, {
      code: 'CONTROLES_BLOQUANTS',
      message: 'Soumission refusée : 2 contrôle(s) bloquant(s)…',
      details: {
        controles: [
          { code: 'DOCUMENTS_EVALUATION_SIGNES', reference: '2-III-A P5', libelle: "Documents d'évaluation signés", valeurs: { pvOuvertureSigne: false, rapportSigne: true } },
          { code: 'QUORUM_COMMISSION', reference: null, libelle: null, valeurs: null },
        ],
      },
    });
    const m = messageControlesBloquants(e);
    expect(m).toContain('2 contrôle(s) bloquant(s)');
    expect(m).toContain("\n• [2-III-A P5] Documents d'évaluation signés — pvOuvertureSigne : non · rapportSigne : oui");
    expect(m).toContain('\n• QUORUM_COMMISSION');
    expect(messageControlesBloquants(erreur(409, { code: 'VACANCE_PRMP', message: 'x' }))).toBeNull();
  });

  it('messageSoumissionRefusee : bloquants, sinon erreurs par champ, sinon message, sinon repli', () => {
    expect(messageSoumissionRefusee(erreur(400, { code: 'CONTROLES_BLOQUANTS', details: { controles: [{ code: 'X', reference: null, libelle: 'Règle X', valeurs: null }] } }))).toContain('• Règle X');
    expect(messageSoumissionRefusee({ status: 400, message: 'Données saisies invalides.', fieldErrors: { piecesJointes: 'Pièce manquante.' } } as unknown as ApiError)).toBe('Pièce manquante.');
    expect(messageSoumissionRefusee(erreur(409, { message: 'Dossier déjà soumis.' }))).toBe('Dossier déjà soumis.');
    expect(messageSoumissionRefusee({ status: 0, message: '' } as unknown as ApiError, 'Repli.')).toBe('Repli.');
  });

  it('messageControleNonConforme : le 409 de l’avis favorable sans réserve, avec le message du serveur', () => {
    // Message réel du serveur (recette FR5, 13/10).
    const serveur = 'Le dossier porte 1 contrôle(s) non conforme(s) non levé(s) (POINT_20) : l\'avis « Favorable » (sans réserve) est incohérent — levez-les ou choisissez « Favorable avec réserves » ou « Défavorable ».';
    const m = messageControleNonConforme(erreur(409, { code: 'CONTROLE_NON_CONFORME', message: serveur }));
    expect(m).toBe(`${serveur} Les contrôles se lèvent depuis le bouton « Contrôles » de l’en-tête (conforme ou sans objet, avec votre observation).`);
    expect(messageControleNonConforme(erreur(409, { code: 'CONTROLE_NON_CONFORME' }))).toContain('choisissez « Favorable avec réserves »');
    expect(messageControleNonConforme(erreur(409, { code: 'EXAMEN_ABSENT' }))).toBeNull();
  });

  it('controlesEffectifs / bilanControles : par règle, le dernier résultat posé fait foi (levée par le Membre)', () => {
    const liste = [
      ligne({ idControle: 1, regle: 'DELAI_PUBLICITE', resultat: 'CONFORME', bloquant: true }),
      ligne({ idControle: 2, regle: 'DOCUMENTS_EVALUATION_SIGNES', resultat: 'NON_CONFORME', bloquant: false }),
      ligne({ idControle: 3, regle: 'DOCUMENTS_EVALUATION_SIGNES', resultat: 'NON_APPLICABLE', auteur: 'IM1', dateControle: '2026-10-13T11:00:00', observation: 'séance hors ligne' }),
      ligne({ idControle: 4, regle: 'POINT_7', idPointCtrl: 7, resultat: 'NON_CONFORME', bloquant: true, auteur: 'IM1', dateControle: '2026-10-13T11:05:00' }),
    ];
    const eff = controlesEffectifs(liste);
    expect(eff.map((c) => c.idControle)).toEqual([1, 3, 4]);
    expect(bilanControles(liste)).toEqual({ total: 3, conformes: 1, nonConformes: 1, sansObjet: 1, bloquants: 1 });
  });
});
