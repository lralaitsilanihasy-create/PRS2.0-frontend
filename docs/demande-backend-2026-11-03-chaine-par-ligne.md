# Demande backend — 2026-11-03 — La chaîne de la procédure, ligne par ligne du plan

## Contexte

Le pilote veut voir, en cliquant sur une ligne du plan de passation, la **chaîne de la procédure** de cette ligne : le plan, la
mise en concurrence, les dossiers de marché de ses lots, les actes de gestion. La PRMP et l'UGPM y voient aussi **l'étape suivante
à créer**, avec un bouton qui mène à l'écran qui la crée.

Le front l'a construit sur deux lectures existantes, faites **une fois** pour tout le tableau, à la première ligne ouverte :
- `GET /api/dossiers/{id}/filiation` du plan. Les nœuds `MISE_EN_CONCURRENCE` et `MARCHE` portent `ligne.idDetail`.
- `GET /api/dmcs/eligibles` (PRMP et UGPM seulement). Il donne la fiche, le dossier, les lots, l'attribution et le mode de remise
  de chaque ligne.

Deux manques restent.

## B1 — L'identité de la ligne à travers les versions, sur le nœud de la filiation

`ligne` vaut `{ idDetail, objet }`. `idDetail` identifie la ligne **dans une version** du plan : une mise à jour copie la ligne sous
une nouvelle PK. Une procédure lancée sur la version 1 reste rattachée à l'`idDetail` de la version 1. Depuis le tableau de la
version 2, le front ne la retrouve donc pas.

**Demandé** : ajouter `idLigneOrigine` dans `ligne`, soit `{ idDetail, idLigneOrigine, objet }`. C'est le `ID_LIGNE_ORIGINE` déjà
servi sur `MarcheDto`.

Le front compare déjà `ligne.idLigneOrigine` à `Marche.idLigneOrigine` quand les deux sont présents, à défaut `idDetail`. Il est
codé : il prendra le champ dès qu'il sera servi.

## B2 — Rattacher à sa ligne un dossier créé par « Créer un dossier »

Une ligne en **gré à gré** ne porte pas de fiche DAO. Son dossier de mise en concurrence, le **rapport justificatif** (`RJ`), se
crée par « Créer un dossier ». La chaîne de la ligne propose « Créer le rapport justificatif », qui ouvre cet écran sur la famille
`DMC` et le sous-type `RJ` choisis d'avance.

Mais le dossier ainsi créé n'est **rattaché à aucune ligne**. Il n'entre donc pas dans la filiation du plan, et la chaîne propose
encore de le créer. Il en va de même du marché de gré à gré (`MGG`) qui en découle.

**Demandé** :
- accepter à la création d'un dossier `DMC` ou `DDM` hors fiche une ligne d'origine facultative, par exemple `idDetailOrigine`.
  Il faut contrôler qu'elle appartient à un plan de la PRMP et qu'elle n'est pas déjà rattachée à un dossier de la même famille ;
- placer ce dossier dans la filiation sous la version du plan qui porte la ligne. Ce serait un nœud `MISE_EN_CONCURRENCE` pour
  un `RJ`, un nœud `MARCHE` avec `ligne` pour un `MGG`.

Le nom du champ et la règle de contrôle sont à fixer par le backend. Le front passera alors la ligne dans l'URL de « Créer un
dossier » (`&ligne=`) et l'enverra à la création.

## Hors de cette demande

- **Consultation de prix** : le front ne propose aucune étape tant que le pilote n'a pas dit quel dossier elle produit.
- **Actes de gestion** : la chaîne les montre, mais ne propose pas encore de les créer. Ce sera un second temps.

## Ce que fait le front

C'est livré sans attendre :
- la rangée de chaîne sous la ligne, sur la page d'un dossier de plan et dans la fenêtre de détail du plan ;
- l'étape à créer, avec :
  - « Préparer » ou « Reprendre les informations du DAO » ;
  - « Créer le dossier de marché », vers l'attribution en remise électronique, ou vers la procédure dans « Dossier de marché »
    en remise papier ;
  - « Créer le rapport justificatif ».

B1 et B2 lèvent les deux limites dites plus haut.

> ⚠️ **2026-11-03 — B1, B2 livrés (PRS20, V163), avec le nom du champ et la règle fixés.**
> - **B1** : `ligne` = `{ idDetail, idLigneOrigine, objet }` sur les nœuds de la filiation. `idLigneOrigine` est celui de `MarcheDto` :
>   l'`idDetail` de la première apparition de la ligne, ou son propre `idDetail` si elle n'a pas été copiée.
> - **B2, le champ** : `POST /api/saisies/dossier` accepte **`idDetailOrigine`**, facultatif ; `DossierDto.idDetailOrigine` le sert.
> - **B2, la règle** : 400 nominatif `idDetailOrigine` si la ligne est inconnue, retirée du plan, hors des plans de la PRMP, ou déjà
>   rattachée à un dossier de la **même famille** (un seul DMC et un seul DDM par ligne). Le rattachement est tracé au journal du dossier.
> - **B2, la place dans la filiation** : un **DMC** (RJ…) en nœud `MISE_EN_CONCURRENCE` sous la version du plan qui porte la ligne. Un
>   **DDM** (MGG…) en nœud `MARCHE` **sous le DMC de la même ligne** s'il existe, à défaut sous le plan. Chacun porte `ligne`.
> - **Limites** :
>   - le rattachement se pose à la création seulement : un dossier déjà créé ne se rattache pas après coup ;
>   - il désigne une ligne d'une version : depuis une version suivante, le front compare par `idLigneOrigine` ;
>   - le contrôle « déjà rattachée » porte sur cette même ligne, pas sur ses copies dans les autres versions.