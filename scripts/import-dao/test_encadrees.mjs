// Règle 10 (17/10, demande « champs-deduits-du-dao ») — attestation par encadrement, parité de LectureDao.encadrees.
//   node --test test_encadrees.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { encadrees } from './lire.mjs';

const us = [
  { texte: 'ARTICLE 16 – Assurance', sections: [] },
  { texte: 'Sans objet.', sections: ['ASSURANCE-NON'] },
  { texte: 'Le titulaire souscrit une assurance couvrant {{B09-AU-03}} risques.', sections: ['ASSURANCE-OUI'] },
  { texte: 'ARTICLE 17 – Modifications relatives au titulaire', sections: [] },
];
const distinctif = (u) => u.sections.length > 0 && u.texte.replace(/\{\{[^{}]+}}/g, ' ').replace(/[^\p{L}]/gu, '').length >= 20;
const trouves = new Map([[0, 0], [3, 3]]);

test('« Sans objet » entre ses deux articles reconnus : la section est attestée (DAO de 303339)', () => {
  const doc = ['ARTICLE 16 – Assurance', 'Sans objet', '.', 'ARTICLE 17 – Modifications relatives au titulaire'];
  assert.deepEqual([...encadrees(us, distinctif, trouves, doc, new Set())], ['ASSURANCE-NON']);
});

test('un paragraphe de plus entre les deux articles l’écarte (6114 : renvoi au CCAG)', () => {
  const doc = ['ARTICLE 16 – Assurance', 'Sans objet.', 'Les dispositions de l’article 17 du CCAG Fournitures sont applicables', 'ARTICLE 17 – Modifications relatives au titulaire'];
  const t = new Map([[0, 0], [3, 3]]);
  assert.equal(encadrees(us, distinctif, t, doc, new Set()).size, 0);
});

test('une section à jeton ou distinctive ne s’atteste jamais par encadrement ; une section déjà vue est laissée', () => {
  const doc = ['ARTICLE 16 – Assurance', 'Le titulaire souscrit une assurance couvrant tous risques.', 'ARTICLE 17 – Modifications relatives au titulaire'];
  assert.equal(encadrees(us, distinctif, new Map([[0, 0], [3, 2]]), doc, new Set()).has('ASSURANCE-OUI'), false);
  const doc2 = ['ARTICLE 16 – Assurance', 'Sans objet.', 'ARTICLE 17 – Modifications relatives au titulaire'];
  assert.equal(encadrees(us, distinctif, new Map([[0, 0], [3, 2]]), doc2, new Set(['ASSURANCE-NON'])).size, 0);
});

test('sans voisin reconnu d’un côté, rien n’est attesté', () => {
  const doc = ['Sans objet.', 'ARTICLE 17 – Modifications relatives au titulaire'];
  assert.equal(encadrees(us, distinctif, new Map([[3, 1]]), doc, new Set()).size, 0);
});
