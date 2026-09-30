// Demande D4 §B6.3 (30/09) — une valeur de texte reprise dans le texte d'origine : cas communs avec le backend.
//   node --test test_reprojection.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { norm, carteNormalisee, reprojeterLigne, lireParagraphes } from './lire.mjs';

const reprise = (origine, valeurNormalisee = null) => {
  const carte = carteNormalisee(origine);
  assert.ok(carte, `carte reconstruite pour « ${origine} »`);
  return reprojeterLigne(valeurNormalisee ?? norm(origine), [carte]);
};

test('les cas communs proposés par le backend : la typographie d’origine est rendue', () => {
  assert.equal(reprise('Réservoir semi-enterré de 500 m³'), 'Réservoir semi-enterré de 500 m³');
  assert.equal(reprise('Assurance de l’entreprise'), 'Assurance de l’entreprise');
  assert.equal(reprise('Le « Lot 1 » seul'), 'Le « Lot 1 » seul');
  assert.equal(reprise('Campagne 2026–2027'), 'Campagne 2026–2027');
  assert.equal(reprise('Pièces du dossier : ﬁche A1'), 'Pièces du dossier : ﬁche A1');
  assert.equal(reprise('Montant : 500 Ariary'), 'Montant : 500 Ariary');   // une espace insécable seule est gardée
});

test('une partie du paragraphe : seule l’étendue de la valeur est reprise', () => {
  assert.equal(reprise('Objet : l’aménagement de la RN7 — tranche 1.', "l'aménagement de la RN7 - tranche 1"), 'l’aménagement de la RN7 — tranche 1');
});

test('les blancs multiples deviennent une espace ; une ligne absente rend null', () => {
  assert.equal(reprise('A  \t B'), 'A B');
  assert.equal(reprojeterLigne('introuvable', [carteNormalisee('autre chose')]), null);
});

test('une longueur qui change à la normalisation (« … » → « ... », ligature) ne décale pas la reprise', () => {
  assert.equal(reprise('Voir… l’annexe ﬁnale, puis « B »', "l'annexe finale, puis \" B \""),'l’annexe ﬁnale, puis « B »');
});

test('sans texte d’origine (banc, texte déjà extrait), la valeur reste normalisée', () => {
  const r = lireParagraphes(['Réservoir de 500 m3'], 'AE-T', {});
  assert.ok(Array.isArray(r.propositions));
});
