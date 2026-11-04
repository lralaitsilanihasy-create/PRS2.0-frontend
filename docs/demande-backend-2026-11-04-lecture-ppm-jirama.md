# Demande backend — 2026-11-04 — Lecture des plans PDF de la JIRAMA : comptes à six chiffres, « ¿ » entre les lots, année collée au montant

## Contexte

Le pilote importe les plans de la JIRO SY RANO MALAGASY (entité 10, PRMP 303229 « PRMPJIRAMA » depuis le 04/11) :
`JIRAMA PPM 0.pdf` (plan initial, 40 lignes) et `JIRAMA PPM MAJ 1.pdf` (mise à jour n° 1, 56 lignes). Ces fichiers sont sur
le poste du pilote, dans `C:\Users\LANTO\Downloads\`. Lus par `POST /api/saisies/ppm/import` (le 04/11, sans rien enregistrer)
et comparés au texte brut des pages (PDFBox 3.0.7, `setSortByPosition(true)`), trois défauts du lecteur `SaisiePpmImportService`
apparaissent. Les pages portent un filigrane (« REPOBLIKAN'I MADAGASIKARA… ») qui s'intercale dans le texte, sans effet ici.

## B1 — Compte à six chiffres

Ce plan écrit le compte sur **six chiffres** (`602212`, `602310`, `604001`, `322111`, `218500`…). Le jeton `compte` du lecteur
est `\d{3,4}` : il prend les quatre premiers chiffres et laisse les deux derniers, qui partent ailleurs.

- **MAJ 1, ligne 2** (pièces de rechange des groupes, contrat-cadre) : texte brut `JIRAMA/EP 602212 311 715 000.00`. Lu :
  compte `6022`, et `12` **recollé à la fin de l'objet** (« … (CONTRAT-CADRE) 12 »), avec l'anomalie « Montant réaligné … après
  recollage d'un fragment d'objet ».
- **PPM 0, « Expertise comptable pour le rapport d'audit 2024 »** : texte brut `AFS 604001 116 000 000.00`. Lu : compte `6040`,
  et `01` **collé au montant du bénéficiaire**, lu `1 116 000 000` au lieu de `116 000 000`. C'est une des deux causes de
  l'anomalie BLOQUANTE de cette ligne (voir B3).
- Même découpage sur d'autres lignes (`602310` lu `6023`, ligne 1 de la MAJ 1).

**Demandé** : accepter un compte de **3 à 6 chiffres** (`\d{3,6}`, borné : ni précédé ni suivi d'un chiffre), et le résoudre au
référentiel des comptes tel qu'il est écrit. Si le référentiel ne connaît que la racine à quatre chiffres, nous préférons
l'anomalie `REFERENTIEL_INCONNU` « Compte « 602212 » inconnu » à une troncature silencieuse. Dites-nous lequel le référentiel
porte.

## B2 — « ¿ » entre deux lots

Les objets à lots de ces plans séparent les lots par un caractère que la police du PDF ne sait pas décoder : « Lot 1 : Pièces
groupe DEUTZ 400KW ¿ Lot 2 : … », « Lot 1 : Matériels de rechange ¿ … », « Lot 6 : Gaz ¿ … ». Le nettoyage actuel (règles
ancrées : œ, élision) ne le traite pas ; l'anomalie `ENCODAGE_SUSPECT` est levée, et le pilote doit corriger chaque objet à la main.

**Demandé** : une règle ancrée de plus, non ambiguë : un « ¿ » (ou U+FFFD) **entouré d'espaces et suivi de « Lot »** (avec ou
sans « N° ») devient un tiret de séparation « – ». Les autres « ¿ » restent signalés comme aujourd'hui.

## B3 — Année de l'objet collée au montant

Même ligne du PPM 0 : texte brut `d'audit 2024` puis `116 000 000.00`. Lu : objet « Expertise comptable pour le rapport
d'audit 2 » et montant estimatif **24 116 000 000**, puis anomalie BLOQUANTE « Montant estimatif (24 116 000 000) ≠ somme des
bénéficiaires (1 116 000 000) ». Les vraies valeurs sont 116 000 000 pour le marché et le bénéficiaire, et le compte 604001.

**Demandé** : un nombre à quatre chiffres d'**année plausible** (19xx, 20xx) qui suit un mot de l'objet ne doit pas servir de
groupe de tête à un montant. Il reste dans l'objet. Si la règle est trop risquée en général, la limiter au cas où le montant
ainsi formé ne correspond pas à la somme des bénéficiaires alors que le montant sans ce préfixe y correspond (même logique que
le réalignement déjà en place).

## Hors demande, pour mémoire

MAJ 1, ligne 2 : le PDF porte un nouveau montant estimatif (468 794 467) mais **aucun nouveau montant pour son unique
bénéficiaire**. Le lecteur le restitue fidèlement ; c'est le document qui est incomplet, et l'écran demande la saisie. Le
pilote dira s'il souhaite une proposition automatique dans ce cas (un seul bénéficiaire : son nouveau montant = celui du marché).

## Ce que fait le front

Rien à changer : il affiche ce que le lecteur sert (objet, compte, montants, anomalies). Les trois correctifs se vérifient en
réimportant les deux PDF.

> ⚠️ **2026-11-04 — B1, B2, B3 livrés (PRS20, sans migration), vérifiés sur les deux PDF ; quatre précisions.**
> - **Le référentiel des comptes** ne porte que des **racines à 4 chiffres** (72 comptes, plus un à 3 chiffres). Les comptes de la
>   JIRAMA (602212, 604001…) sont donc lus tels qu'ils sont écrits et signalés `REFERENTIEL_INCONNU`, comme vous le préfériez. Pour les
>   résoudre, il faut ajouter ces comptes au référentiel : je ne les rattache pas à leur racine.
> - **Effet sur un autre plan** : sur le 161-PPM du MTP, le compte « 23175 » (écrit après « 6113, ») était tronqué en silence à
>   « 2317 » et résolu par chance. Il est désormais lu « 23175 » et signalé inconnu. Aucune autre différence sur le 161-PPM du MTP ni
>   sur le PPM du MIDSP (comparaison ligne à ligne avant / après).
> - **B3, forme générale** : plutôt que de reconnaître une année plausible, la règle est qu'un montant ne commence jamais au milieu
>   d'une suite de chiffres. « 2024 » reste ainsi dans l'objet, et la même règle corrige aussi « 604001 116 000 000 » (B1). Le
>   réalignement sur la somme des bénéficiaires reste en place pour les autres cas.
> - **B2** : la règle couvre aussi « Lot N° », U+FFFD et les majuscules (« LOT »). Un ancien test tenait « ¿ Lot n°02 » pour ambigu ;
>   il est mis à jour. Un « ¿ » collé à un mot (« Anosibe An¿ala ») reste signalé.
> - **Résultat sur les PDF** : PPM 0, 40 lignes ; « Expertise comptable pour le rapport d'audit 2024 », 116 000 000, compte 604001,
>   plus d'anomalie bloquante. MAJ 1, 56 lignes ; ligne 2 « … (CONTRAT-CADRE) » sans « 12 », compte 602212, lots séparés par « – ».
>   Tous les comptes lus ont six chiffres.
> - **Hors demande** (nouveau montant d'un bénéficiaire unique) : non traité, en attente du pilote.