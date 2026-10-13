import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Attribution, Evaluation, Seance } from '../../../models';
import { InstantaneAttributionVue, InstantaneEvaluationVue, InstantaneSeanceVue, lignesSignatures } from './instantanes-vues';

/** Les nœuds de texte joints par un espace : deux cellules voisines restent deux mots. */
const texteDe = (f: ComponentFixture<unknown>): string => {
  const marche = document.createTreeWalker(f.nativeElement as HTMLElement, NodeFilter.SHOW_TEXT);
  const morceaux: string[] = [];
  while (marche.nextNode()) morceaux.push(marche.currentNode.textContent ?? '');
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};
/** Le montant tel que `texteDe` le rend : l'espace fine insécable du format fr-FR y devient un espace ordinaire. */
const AR = (v: number): string => `${new Intl.NumberFormat('fr-FR').format(v)} Ar`.replace(/\s+/g, ' ');

describe('Vues dédiées des écrans figés (manuel révisé, R4)', () => {
  it('lignesSignatures : les attendus (R1) croisés avec les signatures posées — signé, empêché, en attente', () => {
    const lignes = lignesSignatures(
      [
        { im: 'K1', nom: 'Président', qualite: 'PRESIDENT' },
        { im: 'K2', nom: 'Membre A', qualite: 'MEMBRE' },
        { im: 'K3', nom: 'Membre B', qualite: 'MEMBRE' },
      ],
      [
        { im: 'K1', nom: 'Président', president: true, date: '2026-10-13T11:00:00', empechement: false, motif: null, constatePar: null },
        { im: 'K3', nom: 'Membre B', president: false, date: '2026-10-13T11:05:00', empechement: true, motif: 'absent', constatePar: 'K1' },
      ],
    );
    expect(lignes.map((l) => l.qualite)).toEqual(['Président', 'Membre', 'Membre']);
    expect(lignes[0].etat).toBe('signé le 13/10/2026 à 11:00');
    expect(lignes[1].etat).toBe('en attente');
    expect(lignes[2].etat).toBe('empêchement constaté — absent (par K1)');
  });

  it('lignesSignatures : sans liste d’attendus (PV antérieur à V101), les signatures seules', () => {
    const lignes = lignesSignatures(undefined, [{ im: 'K1', nom: 'Président', president: true, date: '2026-10-01T09:00:00', empechement: false, motif: null, constatePar: null }]);
    expect(lignes).toEqual([{ nom: 'Président', qualite: 'Président', etat: 'signé le 01/10/2026 à 09:00' }]);
    expect(lignesSignatures(undefined, undefined)).toEqual([]);
  });

  it('séance figée : état, membres, offres et PV en lecture seule — sans aucun bouton', () => {
    TestBed.configureTestingModule({ imports: [InstantaneSeanceVue] });
    const fixture = TestBed.createComponent(InstantaneSeanceVue);
    const seance: Seance = {
      idDmc: 40,
      etat: 'CLOSE',
      heureOuverture: '2026-10-13T10:00:00',
      ouverteLe: '2026-10-13T10:01:00',
      ouverteDans: null,
      quorum: 2,
      membres: [
        { im: 'K1', nom: 'Président', president: true, present: true, partsApportees: true },
        { im: 'K2', nom: 'Membre A', president: false, present: false, partsApportees: false },
      ],
      autres: [{ nom: 'Observateur', qualite: 'représentant de la PRMP' }],
      secoursEmploye: false,
      offres: [{ numero: 1, lot: 1, etat: 'INTEGRE', partsRecues: 2 }],
      dechiffreeLe: '2026-10-13T10:30:00',
      pv: { produit: true, publie: true, signe: true, signeLe: '2026-10-13T11:00:00', signatures: [], signaturesAttendues: [], quorum: null },
    };
    fixture.componentRef.setInput('seance', seance);
    fixture.detectChanges();
    const t = texteDe(fixture);
    expect(t).toContain('Close — PV signé');
    expect(t).toContain('Membres de la commission (2)');
    expect(t).toContain('Président Président oui oui');
    expect(t).toContain('Autres présents : Observateur (représentant de la PRMP)');
    expect(t).toContain('Offres reçues (1)');
    expect(t).toContain('oui, le 13/10/2026 à 11:00');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button').length).toBe(0);
  });

  it('évaluation figée : déclarations, offres par lot avec leurs décisions, proposition et rapport', () => {
    TestBed.configureTestingModule({ imports: [InstantaneEvaluationVue] });
    const fixture = TestBed.createComponent(InstantaneEvaluationVue);
    const ev = {
      idDmc: 40,
      etat: 'CLOSE',
      ouverteLe: '2026-10-13T12:00:00',
      ouvertePar: 'ADMIN01',
      declarations: [{ membre: 'K1', nom: 'Président', president: true, signeeLe: '2026-10-13T12:05:00', conflit: false, precision: null }],
      lots: [
        {
          lot: 1,
          etape: 'RAPPORT',
          etapesArretees: [{ etape: 'CONFORMITE', par: 'K1', nom: 'Président', le: '2026-10-13T13:00:00', observation: null }],
          offres: [
            {
              idOffre: 'o1', numero: 1, entreprise: { nif: '1', raisonSociale: 'Alpha' },
              conformite: { verifications: [], decision: 'CONFORME', qualification: null, motif: null, clause: null, par: null, nom: null, le: null },
              evaluation: { prixLu: 1000000, prixLuTtc: null, corrections: [], refusCandidat: null, rabais: null, preference: null, criteres: [], prixCorrige: 1000000, montantEvalue: 950000, par: null, nom: null, le: null },
              anormale: { suspectee: false, decision: null, motif: null, justification: null, par: null, nom: null, le: null },
              qualification: { idOffre: 'o1', numero: 1, criteres: [], decision: 'QUALIFIE', motif: null, clause: null, par: null, nom: null, le: null },
              rang: 1, ecartee: null, precisionsEnAttente: 0,
            },
            {
              idOffre: 'o2', numero: 2, entreprise: { nif: '2', raisonSociale: 'Beta' },
              conformite: { verifications: [], decision: 'ECARTEE', qualification: 'SUBSTANTIELLE', motif: 'garantie absente', clause: 'IC 19', par: null, nom: null, le: null },
              evaluation: null, anormale: null, qualification: null, rang: null,
              ecartee: { etape: 'CONFORMITE', qualification: 'SUBSTANTIELLE', motif: 'garantie absente', clause: 'IC 19', par: null, nom: null, le: null }, precisionsEnAttente: 0,
            },
          ],
          proposition: { idOffre: 'o1', numero: 1, candidat: 'Alpha', montant: 950000, montantTtc: null, delai: '30 jours', infructueux: false },
        },
      ],
      nonEvaluees: [],
      rapport: { produitLe: '2026-10-13T14:00:00', observations: 'RAS', signe: true, signeLe: '2026-10-13T15:00:00', signatures: [], signaturesAttendues: [], quorum: { regle: 'MAJORITE', requis: 1, obtenus: 1, atteint: true, presidentRequis: true, presidentSigne: true, representant: null, representantNom: null } },
    } as unknown as Evaluation;
    fixture.componentRef.setInput('evaluation', ev);
    fixture.detectChanges();
    const t = texteDe(fixture);
    expect(t).toContain('Close — rapport signé');
    expect(t).toContain('Lot 1 — étape : Rapport');
    expect(t).toContain('Étapes arrêtées : Examen préliminaire le 13/10/2026 à 13:00 par Président');
    expect(t).toContain('1 Alpha conforme');
    expect(t).toContain('qualifiée');
    expect(t).toContain('2 Beta écartée — garantie absente');
    expect(t).toContain(`Proposition d'attribution : Alpha (offre n° 1), ${AR(950000)} HT · délai 30 jours`);
    expect(t).toContain('Observations RAS');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button').length).toBe(0);
  });

  it('attribution figée : l’état de chaque lot et ses étapes renseignées seulement', () => {
    TestBed.configureTestingModule({ imports: [InstantaneAttributionVue] });
    const fixture = TestBed.createComponent(InstantaneAttributionVue);
    const attribution: Attribution = {
      idDmc: 40,
      lots: [
        {
          lot: 1,
          etat: 'AU_CONTROLE',
          proposition: { idOffre: 'o1', numero: 1, candidat: 'Alpha', montant: 950000, montantTtc: null, delai: '30 jours', infructueux: false },
          dossierMarche: { idDossier: 100371, sousType: 'DDM-AOO', statut: 'SOUMIS', avis: null, creeLe: '2026-10-13T16:00:00', creePar: 'ADMIN01' },
          projetDisponible: true,
        },
      ],
    };
    fixture.componentRef.setInput('attribution', attribution);
    fixture.detectChanges();
    const t = texteDe(fixture);
    expect(t).toContain('Lot 1 — Au contrôle de la Commission');
    expect(t).toContain(`Proposition du rapport Alpha (offre n° 1), ${AR(950000)} HT · délai 30 jours`);
    expect(t).toContain('Dossier de marché n° 100371 · DDM-AOO · SOUMIS · créé le 13/10/2026 à 16:00');
    expect(t).not.toContain('Attributaire');
    expect(t).not.toContain('Retrait');
  });
});
