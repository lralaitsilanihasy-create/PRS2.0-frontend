# Demande backend — Import du DAO : un trou laissé au candidat ne rend pas un paragraphe distinctif

**Date** : 2026-10-01 · **Émetteur** : front · **Origine** : `docs/demande-backend-2026-10-01-dao-travaux-men.md`, §B4.3
(défaut annoncé, « j'attends la demande dédiée »). Un seul besoin.

## B1 — `LectureDao` : ne pas compter les lettres des trous `<…>` dans le critère « distinctif »

**Le défaut.** Une section n'est attestée que par un paragraphe reconnu dont le texte fixe compte au moins 20 lettres
(« distinctif »), et qu'aucun autre paragraphe du modèle ne partage sous d'autres sections. Les lettres d'un trou laissé
au candidat comptaient. Dans le CCAP-T :

| annexe | paragraphe du modèle | section |
|---|---|---|
| garantie bancaire de bonne exécution | « ATTENDU QUE <nom du Titulaire> » | `ANNEXE-GBE-BANCAIRE` |
| garantie de restitution d'avance | « ATTENDU QUE » puis « <nom du Titulaire> », deux paragraphes | `ANNEXE-AVANCE` |

Le premier passe pour distinctif (24 lettres), alors que 14 viennent du trou. Le filtre des doublons ne voit rien : dans
le modèle, les textes diffèrent. Mais un document où ces deux paragraphes de la restitution d'avance sont fusionnés,
cas ordinaire d'une autre mise en page, redonne exactement le premier. La lecture atteste alors `ANNEXE-GBE-BANCAIRE`
et déduit **`B05-GE-01 = OUI`** sur un DAO qui ne demande pas de garantie de bonne exécution. Banc du front : graines 6
et 10, CCAP-T, cadrage « tout oui ». L'erreur existait avant le 01/10 ; ce sont les contrôles ajoutés au banc au §B4 qui
l'ont révélée.

**La règle (règle 7 de `scripts/import-dao/README.md`).** Pour compter les lettres du critère « distinctif », retirer
d'abord les jetons (comme aujourd'hui) **et les trous `<…>`**. Rien d'autre ne change : la reconnaissance du paragraphe,
ses valeurs et sa confiance sont les mêmes ; seul le droit d'attester sa section est retiré à un paragraphe dont le texte
propre est trop court.

Prototype : `scripts/import-dao/lire.mjs`, fonction `distinctif` dans `lireParagraphes` —
`u.texte.replace(JETON, ' ').replace(/<[^<>]*>/g, ' ')` avant de compter.

**Mesures du front** (banc : 22 passes par lecture, rendu propre puis graines 1 à 12) :

| | avant | après |
|---|---|---|
| réponses déduites fausses | 2 (graines 6 et 10) | **0** |
| rappel, fausses valeurs, réponses déduites justes | — | **identiques** sur les 13 lectures |
| DAO du MEN (DPAO-T, AE-T, CCAP-T), 2463 (DPAO-F, AE-F, CCAP-F) | — | **inchangés** (paragraphes reconnus, valeurs, confiances, cadrage) |

**Recette attendue** : la parité habituelle sur les 18 documents (aucune ligne de lecture ne doit changer sur ces
documents propres), et un test qui reproduit la fusion : sur le rendu du CCAP-T sans garantie de bonne exécution et avec
avance, « ATTENDU QUE » et « <nom du Titulaire> » de l'annexe de restitution d'avance réunis en un paragraphe ne doivent
plus déduire `B05-GE-01`.
