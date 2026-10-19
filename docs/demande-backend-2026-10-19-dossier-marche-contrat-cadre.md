# Demande backend — 2026-10-19 — Le dossier de marché aligné sur le dossier de mise en concurrence (`MAOO-CC`)

## Contexte

Le pilote demande d'appliquer au dossier de marché (famille `DDM`) les règles déjà livrées pour le dossier de mise en concurrence
(famille `DMC`) : demandes du 18/10 « sous-type-contrat-cadre » (V131), « requalification-contrat-cadre » (V132) et
« grille-contrat-cadre » (V133, V134), et la liaison dossier-fiche du lot 1b.

Le cas qui le montre : les **produits d'entretien (ligne 303338, procédure 13-CC/MEF/SG/PRMP.2026)**, un contrat-cadre en remise
électronique. Le 19/10, son dossier de marché a été créé par l'attribution du lot 1 (`POST /api/fiches-marche/3/attribution/lots/1/dossier`),
puis soumis.

| | Dossier de mise en concurrence | Dossier de marché |
|---|---|---|
| Dossier | 100382 — 00003/DAOO-CC/CNM/2026 | 100383 — soumis, sans référence encore |
| Sous-type | `DAOO-CC` | `MAOO` |
| Lien à la fiche (`idDmc`) | 3 | **nul** |
| Lien au dossier de mise en concurrence | — | **nul** (`idDossierParent` nul) |
| Pièces produites par l'application | marquées (`idDocumentFiche`), non retirables | **non marquées** : projet de marché, DAO, bordereau, PV d'ouverture, rapport |

Le manuel de contrôle traite les deux d'un seul bloc : « C. Examen de Marché et Contrat-cadre sur Appel d'Offres Ouvert » (p. 50-52).

## B1 — Le sous-type `MAOO-CC`, produit par l'attribution d'un contrat-cadre

- **Le référentiel.** Une migration crée `MAOO-CC`, famille `DDM`, libellé proposé « Marché sur appel d'offres ouvert —
  contrat-cadre », grille de base `MAOO` (comme `DAOO-CC` hérite de `DAOO`).
- **Le sous-type déduit.** L'attribution d'un lot dont le dossier de mise en concurrence est en `DAOO-CC` produit un dossier
  `MAOO-CC`, et non `MAOO`. Aujourd'hui, la réponse B3 du 18/10 dit : « l'attribution d'un contrat-cadre produit toujours un `MAOO` ».
- **La référence.** Le segment suit le sous-type : `…/MAOO-CC/…`.
- **La contrainte** qui limite les sous-types d'un dossier né d'une attribution, s'il en existe une, admet `MAOO-CC`.

> ⚠️ **2026-10-19, livré (backend, V137), tel que demandé**
> - `MAOO-CC` existe : famille `DDM`, libellé « Marché sur appel d'offres ouvert — contrat-cadre », grille de base `MAOO`. Sa liste de
>   pièces est copiée de `MAOO`.
> - Le sous-type se lit sur le dossier de mise en concurrence de la fiche : `DAOO-CC` produit `MAOO-CC`, et la référence suit.
> - **La contrainte** : il n'y en a pas pour un dossier de marché. `ck_dossier_dmc_dao` ne vise que les dossiers qui portent `ID_DMC`.

## B2 — Le dossier de marché porte sa fiche et son dossier de mise en concurrence

- **Le lien à la fiche.** Le dossier créé par l'attribution porte `idDmc`, comme le dossier de mise en concurrence. C'est ce lien
  qui permet à la page du dossier et à la Commission de lire la procédure : fiche, séance, évaluation, attribution.
- **Le lien au dossier de mise en concurrence.** `idDossierParent` = le dossier de mise en concurrence de la procédure (ici
  100382). Le contrôle du marché s'y réfère : « le PV de la Commission sur le DAO correspondant » est une pièce du dossier (manuel,
  p. 50).

> ⚠️ **2026-10-19, livré autrement (backend) : un champ servi, pas deux colonnes**
> - **Pas `idDmc`** : la colonne `t_dossier.ID_DMC` est **unique**. Une fiche a déjà son dossier de mise en concurrence et peut avoir
>   un dossier de marché par lot. De plus, plusieurs lectures prennent « `idDmc` non nul » pour « le DAO de la fiche ».
> - **Pas `idDossierParent`** : il désigne une **mise à jour**. Le périmètre d'examen traiterait le marché comme une mise à jour du DAO.
> - **À la place**, `GET /api/dossiers/{id}` (lecture unitaire) sert sur un dossier de marché né d'une attribution
>   **`procedure: { idDmc, lot, idDossierMiseEnConcurrence, refeDossierMiseEnConcurrence }`**. Il est lu sur `t_attribution`, rien
>   n'est stocké de plus, et il est absent sur les autres dossiers. Pour 100383 : `{ 3, 1, 100382, "00003/DAOO-CC/CNM/2026" }`.
> - **Le PV de la Commission sur le DAO** est servi en pièce fournie par l'application (B4).

## B3 — Les pièces produites par l'application, marquées comme telles

Les pièces que le serveur joint d'office au dossier de marché sont marquées comme celles d'une fiche (`idDocumentFiche`, ou un
marqueur équivalent servi sur `GET /api/piece-jointe-dossiers?dossier=`). Elles ne se retirent ni ne se remplacent à la main
(409 `PIECE_PRODUITE_PAR_FICHE`, ou un code propre). Aujourd'hui, la PRMP peut retirer le PV d'ouverture ou le rapport signé et
déposer autre chose à la place.

Pièces concernées sur 100383 :
- le projet de marché (n° 14) ;
- le DAO complet (n° 15) ;
- le bordereau (n° 16) ;
- le PV d'ouverture (n° 17) ;
- le rapport d'évaluation (n° 18).

> ⚠️ **2026-10-19, livré (backend, V137), avec un marqueur propre**
> - **Le marqueur** : `PieceJointeDossierDto` gagne **`produitePar`**, qui vaut `"ATTRIBUTION"` pour une pièce jointe d'office par la
>   création du dossier de marché, et `null` pour une pièce téléversée. `idDocumentFiche` reste réservé aux documents de la fiche.
> - **Les pièces marquées** : projet de marché, cahier des charges, devis estimatif, PV d'ouverture, rapport, questions et réponses,
>   et le bordereau de l'offre.
> - **Les refus** : le retrait (Administrateur compris) et le dépôt d'une pièce du même type répondent 409
>   **`PIECE_PRODUITE_PAR_APPLICATION`**. « Tout autre document » reste libre.
> - **Sur 100383**, la migration a marqué les pièces jointes d'office. Les numéros que donne la demande (14 à 18) sont des rangs à
>   l'écran : en base, ce sont les pièces 22 à 26.

## B4 — La liste des pièces de `MAOO-CC` : celle du manuel, page 50

Le manuel donne, pour le marché et le contrat-cadre sur appel d'offres ouvert :

| Ordre | Pièce du manuel | Code proposé | Fournie par |
|---|---|---|---|
| 1 | Fiche de présentation signée par la PRMP | `FICHE_PRESENTATION` | l'application (comme en `DAOO-CC`) |
| 2 | Journal de 1re publication de l'avis (ou lettres d'invitation avec accusé) | `PUBLICATION_AVIS` | la PRMP |
| 3 | Copie de l'AGPM publié | `PUBLICATION_AGPM` | reprise d'office (V118) |
| 4 | PV de la Commission sur le DAO correspondant | à créer, ou `PV_EXAMEN` | l'application : le PV signé du dossier parent |
| 5 | PV d'ouverture des plis par la CAO | `PV_OUVERTURE` | l'application (la séance) |
| 6 | Rapport d'évaluation des offres | `RAPPORT_ANALYSE` | l'application |
| 7 | PV de validation par la CAO | — | le rapport signé en tient lieu (« il vaut procès-verbal de validation ») |
| 8 | Bordereau des prix estimatifs (ou DQE) signé par la PRMP | `DEVIS_ESTIMATIF` | voir ci-dessous |
| 9 | Projet de marché | `PROJET_MARCHE` | l'application |
| 10 | Tout autre document utile | `AUTRE_DOCUMENT` | facultatif |

- **Ce qui manque aujourd'hui** : le référentiel de `MAOO` porte déjà ces pièces. Le formulaire manuel de « Créer dossier »
  réclame la fiche de présentation, le PV de la Commission sur le dossier de mise en concurrence et le PV de validation par la
  CAO. Mais la liste servie au dossier **né de l'attribution** (`GET /api/dossiers/100383/pieces-exigees`) les omet : 8 pièces,
  sans fiche de présentation, ni PV de la Commission sur le DAO, ni PV de validation. Le front demande que le dossier né de
  l'attribution reçoive la liste entière, ses pièces fournies d'office par l'application.
- **Une pièce à revoir : le bordereau.** Le manuel demande le bordereau **estimatif signé par la PRMP**, c'est-à-dire son
  estimation. Le serveur a joint `bordereau-offre-4_3_lot1.pdf`, le bordereau de **l'offre retenue**. Pour 13-CC, l'estimation
  existe : 231 563 789 Ar, lue par les indicateurs de prix de l'évaluation. Le front propose de joindre le bordereau estimatif
  de la fiche, celui du dossier de mise en concurrence (pièce n° 32 de 100382), et de garder celui de l'offre retenue au projet de
  marché.
- **Le cahier des charges** (n° 15, facultatif) n'est pas dans la liste du manuel. Le DAO complet y est utile, mais en « autre
  document ».

> ⚠️ **2026-10-19, livré (backend), avec une correction du constat**
> - **Ce n'était pas une omission** : c'est la règle V102 (arbitrage du pilote du 10/10). La fiche de présentation, le PV de la
>   Commission sur le DAO et le PV de validation sont des pièces `PAPIER`, masquées pour une procédure menée en ligne.
> - **Elles sont maintenant servies, fournies par l'application** (`fourniePar: "APPLICATION"`, avec un `lien`) :
>   - `FICHE_PRESENTATION` : `/api/dossiers/{id}/fiche-presentation`.
>   - `PV_CNM_DMC` : le PV **signé** du dossier de mise en concurrence, `/api/pv-examens/{idPv}/document`.
>   - `PV_VALIDATION_CAO` : le rapport d'évaluation signé, qui en tient lieu, `/api/piece-jointe-dossiers/{idPiece}/contenu`.
> - **La fiche de présentation du marché** est celle de la procédure, avec une section **`ATTRIBUTION`** après `PROCEDURE` :
>   - `LOT` et `DOSSIER_MISE_EN_CONCURRENCE` ;
>   - `ATTRIBUTAIRE`, ou `TITULAIRES` par rang pour un contrat-cadre multi-attributaire ;
>   - `MONTANT_HT`, `MONTANT_TTC`, `DELAI` et `RAPPORT_SIGNE`.
>
>   `VALIDATION` gagne `DOSSIER_CREE_LE` et `DOSSIER_CREE_PAR`, et le PDF est titré « Dossier de marché ». **Hypothèse, à confirmer
>   par le pilote** : la création nominative du dossier de marché vaut signature, comme la validation de la fiche.
> - **Le bordereau** : livré comme le front le propose. Le devis estimatif est le bordereau (ou DQE) estimatif de la fiche ; celui de
>   l'offre retenue passe en `AUTRE_DOCUMENT`. Sur 100383, la migration a fait l'échange : la pièce 24 est devenue « autre document »
>   et une nouvelle pièce porte le bordereau estimatif de la fiche.
> - **Le cahier des charges** reste tel quel : il est déjà facultatif dans la liste de `MAOO`.

## B5 — Ce qui dépend du sous-type, à étendre à `MAOO-CC`

Comme le B3 du 18/10, le front demande de vérifier, et d'étendre au besoin :
- **Les points de contrôle** du manuel (p. 50-52) pour `MAOO-CC`, avec les variantes du contrat-cadre : plusieurs titulaires
  classés, offre indicative, sélection par la PRMP parmi les qualifiés (décret n° 2019-1064, art. 13) ;
- **les modèles de PV** de la Commission ;
- **les délais de traitement** ;
- **la création directe** : `POST /api/saisies/dossier` avec `MAOO-CC` → 409, comme `DAOO-CC` (`DOSSIER_PAR_FICHE`, ou un code
  propre `DOSSIER_PAR_ATTRIBUTION`).

> ⚠️ **2026-10-19, vérifié (backend)**
> - **Points de contrôle et motifs** : hérités de `MAOO` par la grille de base, sans rien à faire. Les **variantes propres au
>   contrat-cadre** (plusieurs titulaires classés, offre indicative, sélection par la PRMP, art. 13) demandent des textes. Ils ne
>   sont **pas livrés** : au pilote de les fournir, ou à l'Administrateur de les saisir (variante `FORME = CONTRAT_CADRE`, comme pour
>   `DAOO`).
> - **Modèles de PV** : ils ne dépendent pas du sous-type d'un dossier de marché. Rien à faire.
> - **Délais de traitement** : aucun sous-type n'a de délai propre (`tr_delai_sous_type` est vide), ce sont les délais standards.
>   Rien à faire.
> - **Création directe** : voir Q2.

## Questions

- **Q1 — Le dossier 100383.** Il est soumis mais pas encore réceptionné : il n'a pas de référence. Le front propose de le
  **requalifier en `MAOO-CC`** et de le lier à sa fiche et à 100382, par une migration ponctuelle comme V132. Sinon, il garde
  `MAOO` et la recette continue avec lui.
- **Q2 — La création directe des autres sous-types de marché.** Une procédure menée dans l'application (remise électronique)
  produit son dossier de marché à l'attribution. Une procédure à remise papier est évaluée hors de l'application et n'a pas
  d'attribution : son dossier de marché se crée à la main. Le front propose de refuser la création directe **seulement pour un
  marché dont la procédure a été évaluée dans l'application**. Le serveur peut-il le savoir sans lien à la fiche (le formulaire
  manuel n'en porte pas) ? Sinon, la création directe reste ouverte pour `MAOO`, `MAOOI`, `MAOR`…, et seule `MAOO-CC` est refusée.
- **Q3 — Les autres modes.** Comme Q3 du 18/10 : un contrat-cadre en appel d'offres restreint ou international garde `MAOR` ou
  `MAOOI`, sans nouveau sous-type ?

> ⚠️ **2026-10-19, réponses (backend)**
> - **Q1 — oui, fait par V137.** 100383 passe en `MAOO-CC`, avec une ligne `SOUS_TYPE_REQUALIFIE` au journal. Ses pièces d'office sont
>   marquées et son devis estimatif est remplacé (B4). Son lien à la fiche et à 100382 se lit dans `procedure` (B2). Sa référence
>   portera `…/MAOO-CC/…` à la réception.
> - **Q2 — rien n'est refusé.** Le serveur ne peut pas savoir, à la saisie manuelle, si la procédure a été évaluée dans
>   l'application. Surtout, un contrat-cadre en remise papier n'a pas d'attribution : son dossier `MAOO-CC` doit pouvoir se créer à
>   la main. La création directe reste donc ouverte pour tous les sous-types de marché, `MAOO-CC` compris. L'encadré du front
>   (« naît de l'attribution du lot ») suffit à orienter la PRMP.
> - **Q3 — oui**, comme le 18/10 : `MAOR` et `MAOOI` restent sans variante contrat-cadre.

## Côté front

Fait le 19/10, sans attendre B1 :
- **« Créer dossier », famille « marché »** : pour un sous-type de marché sur appel d'offres ou de prestations intellectuelles,
  un encadré dit d'abord que le dossier de marché d'une procédure menée dans l'application naît de l'attribution du lot, avec le
  lien « Choisir la procédure ». Le formulaire reste dessous, nommé pour la procédure à remise papier.
- **`MAOO-CC`** est déjà déclaré parmi ces sous-types : il apparaîtra dans la liste dès que le référentiel le portera.

À faire après B1 à B3 :
- la page du dossier de marché affichera sa fiche et son dossier de mise en concurrence ;
- les pièces produites par l'application s'y liront en données, comme pour le dossier de mise en concurrence.
