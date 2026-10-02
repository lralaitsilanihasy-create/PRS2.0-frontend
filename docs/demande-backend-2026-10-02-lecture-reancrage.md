# Demande backend — Import du DAO : une fausse première accroche ne doit plus bloquer la lecture (réancrage)

**Date** : 2026-10-02 · **Émetteur** : front · **Origine** : premier DAO de travaux **routiers** réel, fourni par le pilote
le 02/10 (`Documents Types/Travaux/ExemplesDAO/DAO_Travaux_routiers.pdf`, MTP ; faits :
`docs/jeu-donnees-mtp-routier-faits.md`). Un seul besoin.

## B1 — `LectureDao` : réancrer après cinq paragraphes distinctifs manqués d'affilée

**Le défaut.** La lecture cherche le premier paragraphe du modèle dans tout le document, puis chaque suivant dans une
fenêtre de 60 paragraphes après le dernier reconnu. Si la première accroche est **fausse**, la fenêtre ne rejoint jamais
le vrai texte. Sur le DAO du MTP, l'accroche tombe dans le **sommaire** : la ligne « 1.2 Données Particulières de
l'Appel d'Offres (DPAO) » ressemble au titre du modèle, alors que le vrai DPAO est 300 paragraphes plus loin, après les
instructions aux candidats. Résultat : **1 paragraphe reconnu sur 161**. Lu seul (pages du DPAO), le même texte en donne 11.

Le défaut n'est pas propre à ce dossier : le CCAP du MEN (5 reconnus sur 419) et celui du 2463 (3 sur 299) en
souffraient aussi.

**La règle (règle 8 de `scripts/import-dao/README.md`).**
- Compter les paragraphes **distinctifs** du modèle (au sens de la règle 7, et non répétés ailleurs dans le modèle)
  cherchés en vain d'affilée.
- Dès que ce compte atteint **5**, le paragraphe distinctif suivant se cherche dans **tout le reste** du document (du
  curseur à la fin), et non plus dans la fenêtre de 60.
- Toute reconnaissance remet le compte à zéro.
- Rien d'autre ne change : motifs, confiances, valeurs, sections attestées.

Prototype : `scripts/import-dao/lire.mjs`, étape 1 de `lireParagraphes` (`REANCRAGE`, `manques`).

**Mesures du front** (paragraphes reconnus, avant → après) :

| document | DPAO / DPAO-T | AE | CCAP |
|---|---|---|---|
| MTP routier | 1 → 8 | 34 → 34 | 5 → **65** |
| MEN travaux | 45 → 46 | 44 → 45 | 5 → **58** |
| 2463 fournitures | 28 → 28 | 41 → 42 | 3 → **20** |

- **Banc** (22 passes par lecture, propre et graines 1 à 12) : **identique ligne pour ligne** (rappel, fausses valeurs,
  réponses déduites) ; Q10 tenu, 0 réponse déduite fausse.
- **2463** : valeurs proposées identiques.
- **Valeurs nouvelles** : justes en confiance haute (MTP : `B09-RP-03` = 07, `B02-OT-01` = « l'entretien des routes à
  Madagascar ») ; les erreurs nouvelles restent en confiance basse (MTP : la phrase des pénalités lue comme `B09-VQ-01`).
- **Réponses déduites nouvelles** : MTP, `B09-FM-01` = OUI (juste, CCAP art. 20) ; MEN, `B08-MR-01` = OUI (« les comptes
  seront réglés en une seule fois », CCAP art. 16 — contradiction connue du dossier, fiche des faits du MEN §9.8).

**Recette attendue** :
- la parité habituelle sur les 18 documents, avec les lignes de lecture qui changent attendues sur les CCAP des trois
  DAO réels ;
- un test qui place un sommaire avant le modèle : la lecture doit retrouver la suite.
