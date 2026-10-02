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

> ⚠️ **Livraison backend du 2026-10-02.** Conforme. `LectureDao` porte la règle 8 à l'identique (`REANCRAGE = 5` ; le compte
> porte sur les paragraphes distinctifs, au sens de la règle 7 ; le réancrage ne vaut que pour un paragraphe distinctif non
> répété).
>
> **Parité** sur **19** documents, les 18 habituels plus le DAO routier du MTP (gardé hors dépôt) : extraction identique,
> **1 118 lignes** de lecture identiques. Les lignes qui changent avec la règle sont celles attendues ; on retrouve vos
> mesures :
> - CCAP-T : MTP 5 → **65**, MEN 5 → **58** ;
> - CCAP-F du 2463 : 3 → **20** ;
> - DPAO-T du MTP : 1 → **8** ;
> - AE-F du 2463 : 41 → 42.
>
> **Un écart ancien, trouvé et corrigé au passage.** Sur le MTP, les avis se lisaient différemment (front 3 paragraphes,
> serveur 1). `LectureDao` ignorait **toutes** les lignes `TITRE` d'un modèle ; chez vous, seule celle d'en tête est le
> titre du document, et une ligne `TITRE` du corps est un bloc. Depuis que l'avis et la lettre d'invitation ont leur
> titre sous l'en-tête (40f2b4a), leur première accroche différait donc. Désormais, seule la ligne `TITRE` en tête est
> ignorée. Sans effet sur l'import, qui ne lit ni l'avis ni la lettre ; la parité est de nouveau exacte.
>
> **Test** : `ModelesDaoTravauxTest.sommaireAvantLeTexte`. Un rendu du CCAP-T est précédé d'un « sommaire » (ses trois
> premières lignes) et de 80 paragraphes sans rapport. La lecture reconnaît **265** paragraphes sur 290, contre **2** sans
> la règle ; ceux qui sont manqués avant le réancrage restent perdus, comme prévu.
>
> ✅ **Contre-recette du front, 2026-10-02 (JAR de 13:34).** `POST /api/fiches-marche/31/import` (fiche de travaux en
> brouillon ; lecture seule, rien n'est écrit), sur les deux DAO réels :
>
> | DAO | DPAO-T | CCAP-T | AE-T |
> |---|---|---|---|
> | MTP routier | **8** / 161 | **65** / 415 | 34 / 293 |
> | MEN travaux | 46 / 161 | **58** / 415 | 45 / 293 |
>
> Les comptes sont identiques au prototype. Les valeurs nouvelles sont bien servies :
> - MTP : `B09-RP-03` = 7 et `B02-OT-01` = « l'entretien des routes à Madagascar », en confiance haute ; `B09-FM-01` = OUI ;
> - MEN : `B08-MR-01` = OUI.
>
> Besoin clos.
