# Demande backend — 2026-10-15 — CCAG dans le DAO complet, descriptif technique et plans des travaux

## Contexte (décisions du pilote, 15/10)

Le pilote a demandé quelles pièces de la « mise en concurrence » ont des données absentes de l'application. Lecture du référentiel
(DBPRS20, V118) :

- Les sous-types d'appel d'offres et de consultation (`DAOO`, `DAOOI`, `DAOOPREQUAL`, `DAOR`, `DAORI`, `DC`) ont leur propre liste
  (`t_piece_sous_type`) : elle ne contient **ni** `CCAG` **ni** `CCTP`.
- La liste **de la famille** DMC (`t_type_piece_jointe`, `ID_TYPE_DOSSIER = 'DMC'`) exige encore cinq pièces : `DAO_COMPLET` (6),
  `CCAG` (7), `CCTP` (8), « Estimation du coût des travaux/fournitures » (10) et « Garantie de soumission » (11). Elle vaut pour un
  sous-type sans liste propre (`DP`) et s'affichait à « Créer dossier » avant le choix du sous-type (le front ne l'affiche plus).
- Aucune pièce ne porte le **descriptif technique et les plans** d'un marché de travaux : la fiche DAO ne les saisit pas (seuls les
  articles du devis le sont).

Décisions du pilote :
1. Le CCAG **n'est plus exigé** comme pièce, mais il est **inclus dans le DAO complet** quand celui-ci est assemblé (impression).
2. Le descriptif technique et les plans des travaux **restent de vrais documents à joindre**.

## B1 — Le CCAG n'est plus une pièce exigée

- Retirer l'exigence de `CCAG` partout, liste de la famille DMC comprise (`OBLIGATOIRE = false`, ou retrait de la liste : au choix du
  backend). Un dossier ancien qui l'avait jointe la garde.

## B2 — Le CCAG inclus dans le DAO complet

- À l'assemblage du DAO complet (`DAO_COMPLET`, Word et PDF, V73), ajouter le **CCAG de la catégorie** du marché, à l'endroit où le
  modèle type le prévoit (sinon en dernière partie) : CCAG des marchés de travaux, des fournitures et services, des prestations
  intellectuelles.
- Le DAO complet déjà produit n'est pas réécrit ; une version validée après la livraison l'inclut.

## B3 — Le descriptif technique et les plans des travaux, pièce à joindre

- Créer un type de pièce (par exemple `DESCRIPTIF_PLANS`, « Descriptif technique et plans des travaux »), exigé pour la catégorie
  `TRAVAUX` des sous-types `DAOO`, `DAOOI`, `DAOOPREQUAL`, `DAOR`, `DAORI`, sans condition `PAPIER` : le dossier produit par la fiche ne
  se soumet pas sans lui.
- Plusieurs fichiers admis (le descriptif et chaque plan), comme les pièces multiples du lot 2a.

## Hypothèses (à confirmer ou corriger)

- H1 — Les textes officiels des trois CCAG ne sont pas au serveur : le pilote les fournit (Word ou PDF). D'ici là, le DAO complet
  s'assemble sans eux et le dit (avertissement lisible par le front, par exemple dans `disponibilite` ou à la liste des documents).
- H2 — Le descriptif et les plans joints au dossier entrent aussi dans le **DAO complet** remis aux candidats (le retrait du DAO en
  ligne les sert) : un candidat ne peut pas chiffrer des travaux sans eux. À dire sinon.
- H3 — `CCTP`, l'estimation (10) et la garantie de soumission (11) de la liste de la famille restent pour `DP` ; rien d'autre ne change.
- H4 — La garantie de soumission reste une pièce du candidat ; les modèles de garantie (`C1`/`C2`) attendent toujours les modèles
  officiels.

## Ce que le front a fait / fera

- Fait (15/10) : « Créer dossier » n'affiche plus ni pièces ni bouton « Créer le dossier » avant le choix du sous-type.
- Après B3 : la pièce apparaît parmi les pièces à joindre de la page du dossier, dépôt multiple. Après B2 et H1 : l'avertissement du
  CCAG absent affiché près du DAO complet.

> ✅ **Backend, 2026-10-15 — réponse** (V119 ; arbitrage de l'utilisateur au backend le 15/10 : « pièce du dossier, servie aux
> candidats ») :
>
> **B1 — livré.** `CCAG` passe en `OBLIGATOIRE = false` dans la liste de la famille DMC. Aucun sous-type ne l'associait. Un dossier qui
> l'avait jointe la garde.
>
> **B2 — déjà livré le 06/10.**
> - ⚠️ **H1 corrigée** : les trois CCAG officiels sont au serveur depuis le DAO complet
>   (`modeles/dao-fixes/{TRAVAUX|FOURNITURES_SERVICES|PRESTATIONS_INTELLECTUELLES}-CCAG.docx`). Ils sont recopiés en partie **2.3** du DAO
>   complet, sous le titre « Cahier des Clauses Administratives Générales applicable aux marchés publics de … » de la catégorie.
> - Il n'y a donc **aucun avertissement à afficher**.
> - Seule limite : sans Word, le DAO complet n'est pas assemblé. Les documents séparés n'ont alors pas le CCAG, et le rattrapage
>   l'assemble plus tard.
>
> **B3 — livré.**
> - Nouvelle pièce **`DESCRIPTIF_PLANS`** « Descriptif technique et plans des travaux ». Elle est obligatoire, sans condition, pour la
>   catégorie `TRAVAUX` de `DAOO`, `DAOOI`, `DAOOPREQUAL`, `DAOR` et `DAORI` : le dossier ne se soumet pas sans elle.
> - Elle admet plusieurs fichiers, comme toute pièce.
>   - ⚠️ Les pièces n'acceptent que **PDF, JPEG et PNG**. Un descriptif en Word se dépose donc en PDF, ou dans les spécifications
>     techniques de la fiche, que le DAO complet insère en partie 2.2.
>
> **H2 — oui.**
> - Les fichiers de la pièce sont **servis aux candidats** avec les documents du DAO, par `GET /api/procedures-en-ligne/{idDmc}/documents`.
>   Chacun a pour `code` son nom de fichier et pour intitulé « Descriptif technique et plans des travaux — <fichier> ».
> - Ils se retirent comme les autres, par `…/documents/{code}`, et le retrait est inscrit au registre.
> - En rectification, seuls les fichiers de la version corrigée sont servis.
> - ⚠️ Ils ne sont **pas insérés dans le PDF du DAO complet** : ils sont remis à côté de lui, puisque les plans sont des PDF ou des images.
>
> **H3** et **H4** confirmées.

> ✅ **Front, 2026-10-15 — branché** :
> - B2 / H1 : aucun avertissement à afficher (H1 corrigée par le backend) ; rien à faire.
> - B3 : le brouillon d'un dossier produit par la fiche DAO n'offrait **aucun endroit** où joindre les pièces qui ne sortent pas de la
>   fiche. Nouveau panneau « Pièces du dossier » (`features/prmp/pieces-a-joindre.ts`) dans le brouillon : la liste de
>   `GET /api/dossiers/{id}/pieces-exigees`, obligatoires manquantes d'abord, plusieurs fichiers par pièce (PDF, JPEG, PNG), retrait des
>   fichiers déposés à la main (les pièces produites par la fiche ne se retirent pas). L'étape 7 de la fiche ne cite plus de liste figée
>   (elle annonçait encore l'estimation, la garantie et le CCAG) et mène au brouillon : « Joindre les pièces et soumettre ».
> - « Créer dossier » : ni pièces ni bouton de création avant le choix du sous-type (vérifié au navigateur sur le JAR de 19ac520, V119).
> - Recette du dépôt `DESCRIPTIF_PLANS` sur un vrai dossier **à faire** : la base ne compte aucun dossier depuis la remise à zéro du 14/10.
