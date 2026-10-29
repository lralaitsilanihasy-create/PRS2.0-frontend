# Demande backend — 2026-10-29 — Marché à commandes : les champs qui le régissent ne sont pas servis (travaux) ou pas exigés

## Contexte

Recette réelle des formes de marché du 29/10 (plan de recette 100395, ligne 303426, procédure 5, travaux, marché à commandes, chaîne
complète jusqu'à la réception définitive d'un bon ; contrat en vigueur n° 2). La fiche a été **validée sans aucun des champs propres au
marché à commandes** : le contrat en vigueur s'affiche avec « Période : — mois » et « Minimum · maximum annuels : — · — », sans délai de
garantie (« la réception provisoire vaut définitive »). Le bon de commande n'est donc **jamais plafonné par le maximum annuel**
(`MAXIMUM_DEPASSE` ne peut pas se déclencher) ; seule la quantité maximale par article (V148) a joué.

Or `ContratVigueurService.creerALaNotification` lit, pour un marché à commandes, `B02-AU-04` (période, bornée à 36 mois),
`B05-TP-02` (minimum annuel), `B05-TP-03` (maximum annuel), `B09-DX-03` (rythme), et la réception lit `B09-DG-01` (garantie).

Lecture du référentiel servi (`GET /api/champs-fiche-marche?typeMarche=A_COMMANDE&categorie=…`, le 29/10) :

| Champ | Fournitures et services | Travaux | CSV `docs/referentiel-champs-fiche-marche-fournitures.csv` |
|---|---|---|---|
| `B05-TP-02` Montant minimum annuel | **absent** | **absent** | obligatoire |
| `B05-TP-03` Montant maximum annuel estimé | facultatif | **absent** | facultatif |
| `B02-AU-03` Quantités minimum et maximum | absent | absent | obligatoire (hors document) |
| `B02-AU-04` Durée de validité (mois) | obligatoire | **absent** | obligatoire |
| `B02-AU-05` Date d'effet | absent | absent | obligatoire |
| `B02-AU-06` Rythme de commande | absent | absent | facultatif |
| `B09-DX-03` Modalités et période des commandes | facultatif | **absent** | facultatif |
| `B09-DG-01` Délai de garantie (mois) | obligatoire | **absent** | obligatoire |

## B1 — Servir au marché à commandes les champs que son contrat lit

Pour **les deux catégories** où la forme est ouverte (fournitures et services, travaux) :

- `B05-TP-02` (minimum annuel) et `B05-TP-03` (maximum annuel) : **servis et obligatoires** — le maximum est le plafond des bons
  (loi n° 2016-055, art. 30), sans lui la règle `MAXIMUM_DEPASSE` est morte ; le minimum peut-il valoir 0 ? (Q2) ;
- `B02-AU-04` (durée de validité, ≤ 36 mois) : servi et obligatoire en travaux comme en fournitures ;
- `B09-DG-01` (délai de garantie) : servi en travaux, comme en fournitures ;
- `B09-DX-03` (modalités et période des commandes) : servi en travaux ;
- l'écart entre le CSV et le référentiel servi (`B05-TP-02`, `B02-AU-05`, `B02-AU-03` absents) : à corriger dans un sens ou dans l'autre,
  et le CSV recopié côté front s'il change.

> ⚠️ **2026-10-29 — B1 non livré au référentiel : il revient sur deux arbitrages du pilote. Travaux en attente de Q1.**
> - **Il n'y avait pas d'écart CSV / référentiel** : la colonne `actif` du CSV (15ᵉ) dit déjà `non` pour `B05-TP-02`, `B02-AU-03` et
>   `B02-AU-05` ; le tableau ci-dessus a lu la colonne `obligatoire`. `B02-AU-03` (le besoin porte les quantités, V45) et
>   `B02-AU-05` (la date d'effet est la notification) **restent inactifs**.
> - **`B05-TP-02` retiré et `B05-TP-03` facultatif sont des arbitrages du pilote du 29/09**
>   (`demande-backend-2026-09-29-champs-non-imprimes-fournitures.md` : décision 1 pour le G1, §B6 pour `B05-TP-03`). Ils ont été pris
>   **avant** que le contrat en vigueur ne lise ces montants (MS-1 et MS-3, 16/10 : minimum annuel, plafond `MAXIMUM_DEPASSE`). Le
>   serveur ne les renverse pas seul : voir **Q3** ci-dessous. Le référentiel et le CSV restent **inchangés**. D'ici là, le plafond
>   annuel joue dès que `B05-TP-03` est saisi.
> - **`B02-AU-04`, `B09-DG-01`, `B09-DX-03` sont déjà servis** en fournitures (le tableau le dit).
> - **Travaux : rien n'est servi tant que Q1 n'est pas tranchée.** Et `B09-DG-01` ne sera pas servi en travaux : le référentiel des
>   travaux a son propre délai de garantie, **`B09-GT-01`**, que la réception d'un marché à commandes de travaux **lit désormais**
>   (elle lisait `B09-DG-01`, absent : la procédure 5 n'avait donc jamais de garantie).

## B2 — Un contrôle de cohérence au bilan

Règle bloquante, par exemple `MARCHE_A_COMMANDES_MONTANTS` : minimum ≤ maximum ; maximum annuel × durée (en années) cohérent avec le
montant de la ligne du plan (avertissement si l'écart dépasse un seuil, comme `ESTIMATION_ECART`).

> ⚠️ **2026-10-29 — livré sous ce nom** (bloc `B05`, lot par lot, marché à commandes). Minimum > maximum : bloquant ; cohérent : `ok`.
> Maximum × `B02-AU-04` / 12 à plus de **10 %** du montant du lot au plan : **avertissement** (seuil supposé, à confirmer). Non évalué
> sans maximum, durée ou montant au plan. `champs` du contrôle : `B05-TP-02`, `B05-TP-03` (et `B02-AU-04` pour l'avertissement).

## B3 — Les fiches déjà validées

La procédure 5 (recette) et toute fiche à commandes validée avant la livraison n'ont pas ces valeurs : leur contrat en vigueur reste sans
plafond. Le dire ; une révision de la fiche (`POST …/reviser`) suffit-elle, ou le contrat en vigueur déjà créé doit-il être relu ?

> ⚠️ **2026-10-29 — la révision ne suffit pas : le contrat fige ses valeurs à la notification.** Nouvelle route
> **`POST /api/contrats-en-vigueur/{id}/relecture`** (PRMP de la fiche, sans corps) → `ContratVigueurDto` : relit la dernière version
> validée (même lecture qu'à la notification) ; `dateFin` recalculée de `dateEffet` tant qu'aucune reconduction n'a eu lieu ; bons,
> remises et réceptions intacts. 409 `CONTRAT_ECHU`, `FICHE_NON_VALIDEE`, `FORME_CHANGEE`. Journal `CONTRAT_RELU`. Pour la
> procédure 5 : réviser la fiche, la revalider avec la période et le maximum (et le minimum), puis relire le contrat n° 2. ⚠️ La
> procédure 5 est en **travaux** : ses champs n'existeront qu'après Q1. Le front peut proposer un bouton « Relire depuis la fiche »
> dans l'écran du contrat.

## Questions

- **Q1** — Le marché à commandes est-il admis pour les **travaux** ? Le plan et la fiche l'acceptent aujourd'hui. Si non : refuser la
  forme à la saisie du plan pour la catégorie travaux, plutôt que de servir les champs.
- **Q2** — Le minimum annuel est-il obligatoire (la loi parle d'un minimum et d'un maximum), ou peut-il être nul ?
- ⚠️ **Q3 (ajoutée par le backend le 2026-10-29)** — Le 29/09, le pilote a retiré `B05-TP-02` (minimum annuel) et rendu `B05-TP-03`
  (maximum annuel « estimé ») facultatif, parce qu'aucun document ne les imprime. Depuis le 16/10, le contrat en vigueur s'en sert :
  le maximum est le plafond des bons de l'année (409 `MAXIMUM_DEPASSE`), le minimum déclenche l'alerte `MINIMUM_NON_ATTEINT`.
  Faut-il **réactiver `B05-TP-02`** et **rendre `B05-TP-03` obligatoire** ? (Proposition du backend : oui pour les deux ; le
  caractère obligatoire du minimum suit Q2.) Le changement est prêt : CSV et script du référentiel, sans code.

## Ce que fera le front

Rien à coder pour B1 et B2 : la fiche suit le référentiel et le bilan servis. L'écran du contrat en vigueur affiche déjà période, minimum
et maximum quand ils existent. Une nouvelle recette de la procédure à commandes vérifiera le plafond annuel des bons.

> ⚠️ **Front, 2026-10-29 — livré** (sur PRS20 1307a57).
> - **B3** : bouton « Relire depuis la fiche » dans l'écran du contrat en vigueur (PRMP seule, contrat en vigueur), refus nommés
>   (`CONTRAT_ECHU`, `FICHE_NON_VALIDEE`, `FORME_CHANGEE`) ; après relecture, les termes et la consommation des bons sont relus.
> - **B1, B2** : rien à coder (référentiel et bilan servis).
> - **Erratum du front** : le tableau du contexte lisait la colonne `obligatoire` du CSV, pas `actif` ; il n'y avait pas d'écart CSV /
>   référentiel (voir l'encadré du backend sous B1).
> - En attente du pilote : Q1 (marché à commandes en travaux), Q2 (minimum nul ?), Q3 (réactiver `B05-TP-02`, `B05-TP-03` obligatoire).

## Réponses tirées des textes (front, 2026-10-29 — à valider par le juriste)

Lecture de la loi n° 2016-055 (dossier `D:\TEXTES MP`), à la demande du pilote.

- **Q1 — Le marché à commandes en travaux ?** **Oui.** Art. 30-I : il est « conclu avec un fournisseur, un **entrepreneur** ou un
  prestataire de service ». → servir aux travaux les champs du marché à commandes (B1).
- **Q2 — Le minimum peut-il être nul ?** **Non.** Art. 30-I : le marché « en fixe le minimum et le maximum » ; art. 30-II : la PRMP est
  « tenue, sous peine d'indemnisation de son cocontractant, de lui passer commande à hauteur du minimum prévu au contrat ».
- **Q3 — Réactiver le minimum, rendre le maximum obligatoire ?** **Oui sur le principe** (art. 30-I et II), mais voir **B4** : la loi
  les fixe **en quantité**, pas en montant annuel.

## B4 — Minimum et maximum : en quantité, sur la durée du marché (nouveau, issu des textes)

Art. 30-I : « Le marché doit déterminer les spécifications, la consistance et le prix des prestations […] et en fixe le minimum et le
maximum **en quantité** », pour une durée de trois ans au plus. Art. 30-III : le montant du marché tient compte « de la valeur maximale
estimée du besoin pour **l'ensemble de la durée** du marché ».

Écarts avec le serveur :
- le minimum et le maximum servis sont des **montants annuels** (`B05-TP-02`, `B05-TP-03`, plafond `MAXIMUM_DEPASSE` par année
  contractuelle) ;
- le plafond en quantité livré le 29/10 (V148, `QUANTITE_MAX_DEPASSEE`) compte les bons **de l'année contractuelle**, alors que la
  loi ne parle pas d'année.

À trancher avec le pilote et le juriste : les quantités minimum et maximum du besoin (`quantiteMin`, `quantiteMax`) valent-elles pour
**toute la durée** du marché ? Les montants annuels sont-ils seulement un complément du DAO (« rythme »), ou faut-il les retirer au
profit des quantités ? Le front suivra le contrat retenu (libellés « cette année » du tableau des quantités).

## B5 — La reconduction du marché à commandes (arbitrage A1, issu des textes)

Le serveur force `RECONDUCTIBLE = false` (`ContratVigueurService`, l. 137-138) alors que sa documentation l'admet dans la limite de
trois ans. La loi (art. 30-I) ne fixe que la durée maximale, **trois ans**, et n'interdit pas la reconduction. Demandé : autoriser la
reconduction d'un marché à commandes tant que la durée totale (période × (1 + reconductions)) ne dépasse pas 36 mois, sur le modèle
du contrat-cadre (décision de la PRMP, 409 `DUREE_MAX_ATTEINTE`).

## ⚠️ Décision du pilote (2026-10-29) : « suivre les textes en vigueur »

Les réponses ci-dessus deviennent des demandes fermes :

- **D1 — Le plafond est en quantité, sur toute la durée du marché** (art. 30-I et II). `QUANTITE_MAX_DEPASSEE` cumule les bons émis
  **depuis la prise d'effet du contrat** (et non plus de l'année contractuelle) ; `Consommation.articles` donne le commandé et le reste
  **sur la durée** (`commandeDuree`, `resteQuantite` ; le front renommera « Commandé cette année »).
- **D2 — Le minimum est en quantité, et il est dû** (art. 30-II). `quantiteMin` est obligatoire et positif pour chaque article d'un marché
  à commandes (bilan de la fiche) ; l'alerte `QUANTITE_MIN_NON_ATTEINTE` se calcule sur la durée du contrat, à l'approche de sa fin.
- **D3 — Les montants annuels ne sont pas une exigence des textes.** `B05-TP-02` reste **inactif** et `B05-TP-03` **facultatif** (Q3 :
  non, contrairement à la proposition) ; `MAXIMUM_DEPASSE` (montant annuel) n'a plus de fondement : à rendre **non bloquant** (alerte
  `MAXIMUM_ESTIME_DEPASSE`, comme `MONTANT_ESTIME_DEPASSE` du contrat-cadre), la valeur maximale estimée valant pour la durée du marché
  (art. 30-III). La règle `MARCHE_A_COMMANDES_MONTANTS` garde son contrôle min ≤ max seulement si les deux montants sont saisis.
- **D4 — Travaux** (Q1 : oui). Servir aux travaux `B02-AU-04` (durée, ≤ 36 mois) et `B09-DX-03` (modalités des commandes) ; la
  garantie est déjà lue sur `B09-GT-01`.
- **D5 — Reconduction** (B5 ci-dessus) : autorisée tant que la durée totale ne dépasse pas trois ans.
