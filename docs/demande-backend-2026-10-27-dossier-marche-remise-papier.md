# Demande backend — 2026-10-27 — Le dossier de marché d'une procédure à remise papier, rattaché à sa procédure

## Contexte

Pour un dossier de marché, l'écran « Créer dossier » de la PRMP (famille « marché », sous-type `MAOO-CC` par exemple) propose deux
chemins.

**1. Remise électronique.** « Choisir la procédure » liste les procédures de `GET /api/dmcs/eligibles` qui ont des offres déposées
en ligne et un dossier de mise en concurrence clôturé. Le dossier de marché naît de l'attribution du lot
(`POST /api/fiches-marche/{id}/attribution/lots/{lot}/dossier`). Toutes ses pièces sont produites d'office et se lisent en données
(V137, « dossier-marche-donnees » du 20/10).

**2. Remise papier**, la procédure étant « évaluée hors de l'application » : la PRMP crée un dossier vide
(`POST /api/saisies/dossier`), **sans lien avec sa procédure**. Elle téléverse ensuite les **9 pièces obligatoires** :
- fiche de présentation datée et signée ;
- journal de première publication de l'avis ;
- publication de l'AGPM ;
- PV de la Commission sur le DAO ;
- PV d'ouverture des offres ;
- rapport d'analyse des offres ;
- PV de validation de l'évaluation par la CAO ;
- devis estimatif détaillé ;
- projet de marché signé.

Or, depuis le 15/10 (`DOSSIER_PAR_FICHE`), **tout DAO se prépare dans une fiche, remise papier comprise** (cadrage
`modeRemise: PAPIER`). Par exemple, la fiche des consomptibles informatiques (ligne 303339) est en remise papier. Pour une telle
procédure, l'application **possède déjà** une partie de ces pièces :

| Pièce exigée | Ce que l'application a déjà |
|---|---|
| Fiche de présentation | les données de la ligne du plan et de la fiche, comme pour un dossier né de l'attribution |
| PV de la Commission sur le DAO | le PV signé de l'examen du dossier de mise en concurrence |
| Devis estimatif détaillé | le bordereau (ou DQE) estimatif de la fiche validée |
| Publication de l'AGPM | déposée une fois sur le plan, reprise d'office (V118) |

Les cinq autres n'existent que sur papier, puisque la séance et l'évaluation ont eu lieu hors de l'application :
- journal de première publication de l'avis ;
- PV d'ouverture ;
- rapport d'analyse ;
- PV de validation de la CAO ;
- projet de marché signé.

**Le pilote demande (27/10)** que le dossier de marché d'une procédure papier passe lui aussi par « Choisir la procédure ».
Il serait ainsi rattaché à sa procédure : l'application fournit d'office ce qu'elle a, et la PRMP ne joint que les documents papier.
La création libre, sans procédure, disparaît pour les sous-types de marché qui procèdent d'une fiche.

## P1 — Les procédures papier parmi les procédures éligibles

`GET /api/dmcs/eligibles` (ou une lecture dédiée, au choix du backend) sert aussi les procédures **à remise papier** dont :
- la fiche est validée ;
- le dossier de mise en concurrence est clôturé, avec un PV favorable ou favorable avec réserves levées ;
- l'avis spécifique est publié.

Pour chacune, sont servis :
- le **mode de remise** (`PAPIER` / `ELECTRONIQUE`) ;
- les **lots** ;
- les **dossiers de marché déjà créés** par lot, comme aujourd'hui (`dossiersMarche`).

> ⚠️ **2026-10-27, livré (backend) — sur `GET /api/dmcs/eligibles`**, trois champs de plus par ligne, nuls sans fiche :
> - **`modeRemise`** : `PAPIER` ou `ELECTRONIQUE`, le mode figé par la dernière version validée. Il est nul tant qu'aucune version
>   n'est validée.
> - **`lots`** : `[{ lot, intitule }]`, les lots de la ligne du plan. Une ligne sans lot a un lot `1`, avec `intitule` nul.
> - **`marchePapier`** : `{ ouvert, motif }`, servi en remise papier seulement (nul sinon). Le front n'a pas à refaire les trois
>   conditions : `ouvert` les résume. Quand il vaut `false`, `motif` donne la première qui manque :
>   - `FICHE_NON_VALIDEE` ;
>   - `DOSSIER_NON_CLOTURE` : le dossier de mise en concurrence n'est pas encore `CLOTURE` ;
>   - `AVIS_NON_FAVORABLE` : le PV signé n'est ni `FAV` ni `FAVR`. Un `FAVR` clôturé a ses réserves levées ;
>   - `AVIS_NON_PUBLIE` : l'avis spécifique n'a jamais été imprimé. C'est l'impression qui vaut publication : elle lance la ligne.
> - **`dossiersMarche`** sert aussi les dossiers de marché papier.

## P2 — Créer le dossier de marché d'un lot d'une procédure papier

- **Une route de création** pour une procédure papier : par exemple `POST /api/fiches-marche/{id}/marche-papier/lots/{lot}/dossier`, ou
  la route d'attribution acceptant une procédure papier. Elle crée le dossier `DDM` du sous-type correspondant (`MAOO-CC` ←
  `DAOO-CC`…), **rattaché** à la procédure (`procedure` servi par `GET /api/dossiers/{id}`, comme pour un dossier né de
  l'attribution), en brouillon.
- **409** si le lot a déjà son dossier de marché (`DOSSIER_EXISTANT`, avec `idDossier`), si la procédure est électronique (son
  dossier naît de l'attribution), ou si le dossier de mise en concurrence n'est pas clôturé.
- **Pièces fournies d'office** (`fourniePar: APPLICATION`, rien à déposer ni à déclarer conforme à la réception) :
  - la fiche de présentation, produite des données : ligne du plan, fiche, procédure, sans les sections « séance » et
    « évaluation » ;
  - le PV de la Commission sur le DAO (`PV_CNM_DMC`, avec son `idPv`) ;
  - le devis estimatif : le bordereau de la fiche, joint d'office comme `BORDEREAU_ESTIMATIF_…` ;
  - la publication de l'AGPM, reprise du plan.
- **Pièces à joindre** par la PRMP, obligatoires :
  - journal de première publication de l'avis ;
  - PV d'ouverture des offres ;
  - rapport d'analyse des offres ;
  - PV de validation de l'évaluation par la CAO ;
  - projet de marché signé.

  Elles restent des pièces déposées, que le Secrétaire déclare conformes à la réception, comme aujourd'hui.

> ⚠️ **2026-10-27, livré (backend) — `POST /api/fiches-marche/{idDmc}/marche-papier/lots/{lot}/dossier`**
> - **Qui** : la PRMP de la fiche, ou son UGPM.
> - **Réponse** : 201 et le `DossierDto` du dossier `DDM` créé, en brouillon, avec `procedure` servi. Le sous-type suit la règle de
>   l'attribution : `DAOO-CC` → `MAOO-CC`, prestations intellectuelles → `MPI`, etc.
> - **Erreurs** : 403 ; 404 (procédure ou lot inconnus) ; 409 `DOSSIER_EXISTANT` (avec `idDossier`), `PROCEDURE_ELECTRONIQUE`,
>   `FICHE_NON_VALIDEE`, `DOSSIER_NON_CLOTURE`, `AVIS_NON_FAVORABLE`, `AVIS_NON_PUBLIE` (les motifs de P1), `SANS_SUITE_DECLAREE`.
> - **Le lien avec la procédure** : une ligne `t_attribution` du lot, marquée `REMISE_PAPIER` (migration V142), sans offre proposée.
>   C'est le lien d'un dossier né de l'attribution : `procedure`, la lecture de la Commission et les actes de gestion le suivent.
> - **⚠️ Écart sur les pièces de l'application.** Elles sont fournies de deux façons, comme pour un dossier né de l'attribution :
>   - **fournies par les données** (`fourniePar: APPLICATION`) : la fiche de présentation et le PV de la Commission sur le DAO
>     (`PV_CNM_DMC`, `idPv`). La fiche de présentation garde l'identification, le marché, la mise en concurrence et la procédure.
>     Sa section `ATTRIBUTION` se réduit au lot et à une ligne `REMISE_PAPIER`, qui renvoie aux pièces papier. Elle n'a ni `SEANCE`
>     ni `EVALUATION` ;
>   - **jointes d'office comme pièces** : le devis estimatif (bordereau ou DQE de la fiche, `PRODUITE_PAR` `ATTRIBUTION` : il ne se
>     retire ni ne se remplace à la main) et la publication de l'AGPM reprise du plan. Ce sont des pièces du dossier, comme pour
>     un dossier né de l'attribution, et non des `fourniePar`.
> - **Le PV de validation de la CAO reste à joindre.** Pour un dossier né de l'attribution, il est fourni par le rapport signé
>   produit par l'application. Ici, aucun rapport n'est produit.
> - **Journal** : `DOSSIER_MARCHE_PAPIER`, sur le dossier de marché et sur le dossier de mise en concurrence.
> - **Le marché se signe hors de l'application** : un acte de gestion n'attend pas ce marché signé ici (`MARCHE_NON_SIGNE` ne joue
>   pas).

## P3 — Plus de création libre d'un dossier de marché qui procède d'une fiche

`POST /api/saisies/dossier` refuse les sous-types de marché qui procèdent d'une fiche (`MAOO`, `MAOO-CC`, `MAOR`, `MAOOI`, `MAORI`,
`MAOOPREQUAL`, `MPI`), sur le modèle de `DOSSIER_PAR_FICHE` : 409 `DOSSIER_PAR_PROCEDURE`, avec un message qui renvoie à « Choisir la
procédure ». Les dossiers déjà créés hors procédure restent tels quels.

> ⚠️ **2026-10-27, livré (backend)**
> - **409 `DOSSIER_PAR_PROCEDURE`** pour ces sept sous-types, sur `POST /api/saisies/dossier` et sur la création brute de
>   l'Administrateur.
> - **Aucune exception** (voir Q1). Le message renvoie au choix de la procédure, puis du lot.

## P4 — Le dossier de marché dit si sa procédure est papier (complément du 27/10)

Un dossier de marché papier se lit avec les mêmes onglets qu'un dossier né de l'attribution, **sauf** la séance d'ouverture, le
rapport d'évaluation et l'attribution, qui n'existent pas dans l'application. Le front doit le savoir **sur le dossier**, sans appel de
plus, pour ne pas les proposer. La page du dossier, la réception, l'examen et la consultation lisent `GET /api/dossiers/{id}`.

- **`procedure.remisePapier`** (booléen) dans `DossierDto.Procedure` :
  - `true` pour un dossier créé par `POST …/marche-papier/lots/{lot}/dossier` (attribution marquée `REMISE_PAPIER`) ;
  - `false` sinon.

> ⚠️ **2026-10-27, livré (backend), conforme à la demande**
> - **`procedure.remisePapier`** vaut `true` pour un dossier de marché papier et `false` pour un dossier né de l'attribution. Il est
>   servi par `GET /api/dossiers/{id}` et partout où `procedure` l'est déjà, sans appel de plus.
> - **`procedure` reste nul pour tout autre dossier.**
> - **Recette** : le dossier 100388 (consomptibles, lot 1) le servira à `true` dès le redémarrage du backend sur ce commit.

## Questions

- **Q1 — Les procédures antérieures au 15/10**, dont le DAO n'est pas passé par une fiche : en reste-t-il en cours ? Si oui, faut-il
  garder pour elles la création libre, par exemple à l'Administrateur seul ?
- **Q2 — Les informations de la procédure papier** : le pilote souhaitera sans doute saisir, à la création, quelques faits que
  l'application n'a pas pour une procédure papier :
  - date de la séance d'ouverture ;
  - nombre d'offres reçues ;
  - attributaire proposé ;
  - montant.

  Ils alimenteraient la fiche de présentation. Le front propose de les laisser **hors de cette demande** : les pièces papier les
  portent, et la Commission les lit.
- **Q3 — Le Secrétaire** voit-il, sur la fenêtre de réception, la distinction « fournie par l'application » ou « à déclarer
  conforme » telle qu'elle existe déjà (`fourniePar`) ? Aucun changement n'est attendu côté réception.

> ⚠️ **2026-10-27, réponses (backend)**
> - **Q1 — Il n'en reste aucune en cours** (base de recette, 27/10) :
>   - les quatre dossiers de mise en concurrence (`DAOO-CC`, 100380 à 100386) sont tous nés d'une fiche ;
>   - les deux dossiers de marché (100383, 100387) sont nés de l'attribution.
>
>   La saisie libre est donc refusée sans exception, Administrateur compris, comme `DOSSIER_PAR_FICHE`.
> - **Q2 — D'accord pour les laisser hors de cette demande.** La fiche de présentation ne les montre pas. Sa ligne `REMISE_PAPIER`
>   renvoie au PV d'ouverture, au rapport d'analyse et au projet de marché joints.
> - **Q3 — Oui, sans changement.** `fourniePar` est calculé de la même façon pour ce dossier : `APPLICATION` sur la fiche de
>   présentation et le PV de la CNM. Le devis estimatif et la publication de l'AGPM sont des pièces jointes du dossier, traitées à la
>   réception comme celles d'un dossier né de l'attribution (voir l'écart en P2).

## Côté front, à la livraison

- « Choisir la procédure » liste aussi les procédures papier, avec une pastille « remise papier ». La ligne mène au lot ; « Créer le
  dossier de marché » le crée rattaché.
- Le dossier se lit comme un dossier né de l'attribution : fiche de présentation, PV de la CNM, fiche DAO, bordereau. Les cinq pièces
  papier s'y joignent, et l'examen pièce par pièce ne porte que sur elles.
- Le formulaire de création libre disparaît pour ces sous-types : le texte « Procédure à remise papier, évaluée hors de l'application :
  créez le dossier de marché ci-dessous » est retiré.
