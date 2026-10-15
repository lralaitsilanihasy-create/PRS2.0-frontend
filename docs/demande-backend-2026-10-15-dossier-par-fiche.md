# Demande backend — 2026-10-15 — un dossier d'appel d'offres se prépare dans l'application

## Contexte (décision du pilote, 15/10)

Dans « Créer dossier », famille « mise en concurrence », un volet replié offrait encore un **secours** : « Le dossier est déjà
préparé hors de l'application ? Créer un dossier vide et y joindre les documents. » Le pilote veut que le dossier d'appel d'offres
(et de consultation) **soit préparé dans l'application** : par la fiche DAO, qui produit le dossier, ses documents et ses écrans
figés, et rend inutiles les pièces que l'application tient (R2, Q-pièce, Q11).

Le front a retiré ce volet pour les sous-types qu'une fiche produit (`DAOO`, `DAOOI`, `DAOOPREQUAL`, `DAOR`, `DAORI`, `DC`) ; les
autres sous-types de la famille (`DPREQUAL`, `DP`, `RJ`) gardent le formulaire.

## B1 — Refuser la création directe d'un dossier de ces sous-types

La création d'un dossier hors fiche (la saisie d'un dossier vide, `POST` de la saisie d'un dossier, appelée par le formulaire de
« Créer dossier ») refuse un sous-type de `SousTypesDossier.PRODUITS_PAR_FICHE` : 409 nommé (par exemple `DOSSIER_PAR_FICHE`,
« Un dossier d'appel d'offres se prépare dans sa fiche DAO »). Seule `FicheMarcheDossierService` (la validation de la fiche) les crée.

## Hypothèses (à confirmer ou corriger)

- H1 — Les dossiers de ces sous-types déjà créés hors fiche (brouillons ou soumis) restent tels quels : ils se complètent, se
  soumettent et se rectifient comme avant ; seule la **création** est fermée.
- H2 — L'Administrateur n'a pas d'exception (pas de création hors fiche, même pour une reprise de l'historique). À dire sinon.
- H3 — Les pièces de la liste « dossier saisi » (condition `PAPIER`) restent utiles pour les dossiers anciens (H1) et pour les autres
  sous-types ; rien à retirer du référentiel.

## Ce que le front a fait (15/10)

- « Créer dossier » : pour un sous-type d'appel d'offres ou de consultation, seul l'encadré de la fiche DAO et son bouton « Choisir la
  ligne du plan de passation » ; plus de volet « préparé hors de l'application », plus de bouton « Créer le dossier ». Garde de
  principe dans la création.
- À brancher après B1 : le refus nommé, si un ancien écran ou un appel direct tentait encore la création.
