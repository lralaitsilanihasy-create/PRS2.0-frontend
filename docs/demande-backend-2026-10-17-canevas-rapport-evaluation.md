# Demande backend — 2026-10-17 — Le canevas de rapport d'évaluation produit par l'application, et les autres pièces du manuel

## Contexte

Le pilote a comparé les pièces exigées du dossier DAO à la liste du **manuel de contrôle a priori**. Cette demande fait suite à
`demande-backend-2026-10-17-pieces-dmc-par-les-donnees.md` (B1 : fiche de présentation, calendrier et AGPM contrôlé fournis par
l'application).

**La liste du manuel** dépend du cas. On la compare ici à ce que sert `GET /api/dossiers/{id}/pieces-exigees` (V95, V115, B1
du 17/10) :

| Pièce du manuel | AO ouvert fournitures (p. 18) | AO ouvert travaux (p. 23) | Contrat-cadre (p. 32) | Prestations intellectuelles, DC (p. 35) | Aujourd'hui, dossier né d'une fiche |
|---|---|---|---|---|---|
| Fiche de présentation signée | ✓ | ✓ | ✓ | ✓ | fournie par l'application (B1) |
| Calendrier annuel mis à jour et signé | ✓ | ✓ | ✓ | — | fourni par l'application (B1) |
| AGPM contrôlé, avec le PV de la CNM | ✓ | ✓ | ✓ | ✓ | fourni par l'application (B1) |
| Publication de l'AGPM (journal) | ✓ | ✓ | ✓ | ✓ | **à téléverser**, une fois sur le plan (V118) |
| Projet d'avis spécifique | ✓ | ✓ | ✓ | lettre d'invitation | produit par la fiche, joint d'office |
| **Canevas de rapport d'évaluation** | ✓ | ✓ | — | ✓ | **ni servi ni produit** (`PAPIER` depuis V115) |
| **Bordereau des prix estimatifs** / **DQE** / **tableau des coûts estimatifs** | bordereau | DQE | — | tableau des coûts | produit par la fiche (V117), **exigé mais à téléverser** |
| **Tout autre document utile** | ✓ | ✓ | ✓ | ✓ | **pas de type de pièce** |
| Projet de DAO (ou de DC) | ✓ | ✓ | ✓ | ✓ | `DAO_COMPLET`, joint d'office |

Le contrat-cadre (`FORME = CONTRAT_CADRE`) est bien allégé du canevas et du bordereau : la liste de V95 suit la page 32 du manuel.
Le cas réel, les consomptibles informatiques (ligne 303339, dossier 100380), est un contrat-cadre : **rien ne change pour lui**,
hormis B3.

**La demande du pilote :** le canevas de rapport d'évaluation ne doit **pas être téléversé**. L'application le produit à partir de
ses données, comme la fiche de présentation. V115 l'avait déjà prévu, en attendant les modèles. Ces modèles sont dans le **guide
de la CAO** (annexes 1 fournitures, 2 travaux, 3 prestations intellectuelles), le même guide que suit déjà le rapport
d'évaluation (V78).

## B1 — Le canevas de rapport d'évaluation, produit par l'application

Pour un dossier `DMC` né d'une fiche **validée**, dont la liste porte `CANEVAS_RAPPORT` (`DAOO`, `DAOOI`, `DAOOPREQUAL`, `DAOR`,
`DAORI`, `DC`, hors contrat-cadre) :

1. **Le document.** Le canevas suit le plan du rapport d'évaluation du guide, pour la catégorie de la fiche. Il porte ce que la
   fiche sait **avant les offres** :
   - **références** : numéro du DAO, objet, autorité contractante, mode de passation, lots (objet et montant au plan) ;
   - **examen préliminaire** : les pièces administratives et les garanties exigées (forme, montant, validité), le délai de
     validité des offres ;
   - **conformité** : les critères de conformité et les spécifications techniques, par lot ;
   - **évaluation** : la méthode (offre évaluée la moins disante, ou la notation et ses sous-critères en prestations
     intellectuelles), et, s'ils sont prévus, la marge de préférence, les variantes et les rabais ;
   - **post-qualification** : les critères de qualification ;
   - **ce que la CAO remplira** : des tableaux vides (plis reçus, corrections arithmétiques, classement, proposition
     d'attribution), puis les signatures.

   Il prend la **version soumise** de la fiche, celle que la Commission examine. En prestations intellectuelles, le guide prévoit
   deux rapports (propositions techniques, puis rapport final) : voir Q2.
2. **Deux lectures**, sur le modèle de la fiche de présentation (B2 du 17/10) : les données, pour l'écran, et le PDF, pour
   l'impression. Les routes sont au choix du backend ; le front propose `GET /api/dossiers/{id}/canevas-rapport` et
   `…/canevas-rapport/pdf`.
3. **La pièce.** `CANEVAS_RAPPORT` revient dans `GET …/pieces-exigees` pour ces dossiers, **fournie par l'application** comme en
   B1 du 17/10 :
   - `fourniePar: "APPLICATION"`, `lien` = la route du point 2 ;
   - jamais comptée manquante, ni à la soumission ni à la recevabilité ;
   - jamais téléversée.

   Un dossier saisi hors de l'application garde la règle de V115 (`PAPIER`).

> ⚠️ **2026-10-17, livré côté backend (B1)** : `GET /api/dossiers/{id}/canevas-rapport` (données) et `…/canevas-rapport/pdf`.
> - **Garde et refus** : la garde de lecture du dossier ; 409 `CANEVAS_INDISPONIBLE` sans fiche validée, et au contrat-cadre.
> - **La forme** : `{ idDossier, idDmc, versionFiche, categorie, sections: [{ code, titre, partie, lignes, tableau }] }`.
>   - `lignes` : ce que la fiche exige, en « libellé : valeur », comme la fiche de présentation.
>   - `tableau` : `{ colonnes, rangees, rangeesVides }`, ce que la commission remplit. `rangees` sont les rangées déjà nommées
>     (première colonne) ; `rangeesVides` le nombre de rangées vierges à imprimer.
>   - `partie` : en prestations intellectuelles.
> - **Le plan** suit celui du rapport que l'évaluation produit (V78, guide de la CAO), avec 9 sections en fournitures et travaux :
>   - les références ;
>   - les plis reçus ;
>   - l'examen préliminaire : garantie, validité, pièces, visite, et la grille de ses vérifications à coter C / SC / NC / SO, la
>     même que la séance ;
>   - la conformité : délai, articles par lot, une rangée par caractéristique exigée ;
>   - l'évaluation : méthode, marge, variantes, plusieurs lots, offres anormales, et le tableau des corrections ;
>   - le classement ;
>   - la post-qualification : les critères de qualification de la fiche ;
>   - l'attribution : « Marché » ou « Lot n » ;
>   - les signatures.
>
>   Le détail des codes est dans `PRS20/docs/api-endpoints.md`.
> - **La version** : la version **soumise** du dossier, à défaut la dernière validée.
> - **La pièce** : `CANEVAS_RAPPORT` est servie `fourniePar: "APPLICATION"`, `lien` = `/api/dossiers/{id}/canevas-rapport`, dans les
>   deux modes de remise. Elle n'est jamais manquante ni téléversée.

## B2 — Le bordereau, le DQE et le tableau des coûts, fournis par l'application

La fiche validée produit déjà le bordereau des prix estimatifs (`BORDEREAU_ESTIMATIF`) et le DQE estimatif (`DQE_ESTIMATIF`), un
PDF par lot, avec la mention « la validation tracée de la fiche vaut signature » (V117 ; Q1 du 17/10). La liste les exige pourtant
encore comme pièces à téléverser (`BORDEREAU_PRIX` en fournitures, `DQE` en travaux, hors contrat-cadre).

Demande : pour un dossier né d'une fiche validée, `BORDEREAU_PRIX` et `DQE` sont **fournis par l'application** :
- `fourniePar: "APPLICATION"` ;
- `lien` = le document de la version soumise (`GET /api/fiches-marche/{idDmc}/documents/{id}/contenu`), ou la liste des documents
  s'il y a plusieurs lots.

`TABLEAU_COUTS` (prestations intellectuelles) suit la même règle si la fiche le produit : voir Q1.

> ⚠️ **2026-10-17, réponse du backend (B2) : déjà en place, rien à changer.**
> - **Depuis V117 (14/10)**, la fiche validée produit le bordereau estimatif (fournitures) ou le DQE estimatif (travaux). Ils sont
>   **joints d'office au dossier**, sous les pièces `BORDEREAU_PRIX` et `DQE`, comme le DAO complet sous `DAO_COMPLET`. Ce ne sont
>   pas des pièces à téléverser : dans `pieces-exigees`, ce sont des pièces jointes, déposées par l'application, avec leur fichier.
> - **Pourquoi le front l'a cru** : aucun dossier hors contrat-cadre n'existait dans la base de recette, le constat n'a donc pas pu
>   être fait.
> - **Pourquoi rien ne change** : le passage en `fourniePar` ne s'impose pas. Ces documents sont de vrais fichiers du dossier, que
>   la Commission télécharge comme les autres. Le dépôt manuel sous ces pièces est d'ailleurs refusé (409
>   `PIECE_PRODUITE_PAR_FICHE`).

## B3 — « Tout autre document que la PRMP estime utile »

Le manuel la cite dans **chaque** liste. La bibliothèque des pièces (V95) n'a pas de type pour elle : la PRMP ne peut donc rien
joindre en dehors des pièces nommées.

Demande : un type de pièce `AUTRE_DOCUMENT` (« Tout autre document utile à l'appréciation du dossier ») dans chaque liste du
manuel, avec ces propriétés :
- **facultatif** et **téléversé** ;
- **plusieurs fichiers** possibles ;
- un **intitulé libre** par fichier, si le dépôt le permet. Sinon, le nom du fichier en tient lieu.

> ⚠️ **2026-10-17, livré côté backend (B3), migration V130.**
> - **Le type** : `AUTRE_DOCUMENT`, « Tout autre document utile à l'appréciation du dossier ».
> - **Les listes** : il est ajouté **en dernier, facultatif**, à chaque liste de sous-type (21 listes), sans condition.
> - **Le dépôt** : il se fait par le dépôt habituel des pièces, qui admet déjà **plusieurs fichiers** d'un même type.
> - **L'intitulé** : le dépôt n'a pas de champ d'intitulé, c'est donc le **nom du fichier** qui en tient lieu. L'écran peut inviter
>   la PRMP à nommer son fichier en conséquence.

## Questions

- **Q1 — Le tableau des coûts estimatifs.** La fiche de prestations intellectuelles produit-elle un tableau des coûts estimatifs,
  comme le bordereau en fournitures ? Le front n'en voit pas dans `GET …/documents`. Si elle ne le produit pas, il reste à
  téléverser.
- **Q2 — Le canevas en prestations intellectuelles.** Le guide a deux rapports. Le front propose **un seul canevas en deux
  parties** (évaluation technique, puis évaluation finale), parce que le manuel ne cite qu'une pièce.
- **Q3 — Le rapport d'évaluation suit le canevas.** Après l'ouverture des plis, le rapport (V78) doit-il reprendre les critères du
  canevas examiné par la Commission ? Ils viennent de la même version de fiche, donc ils devraient concorder. Le front propose que
  le backend le vérifie, ou au moins le signale.
- **Q4 — Le bordereau d'un contrat-cadre.** Pour un contrat-cadre, le bordereau estimatif est joint d'office, en « pièce initiale »
  (dossier 100380), alors que le manuel ne le demande pas. Le front propose de le laisser joint : il tient lieu d'un « autre
  document utile ».

> ⚠️ **2026-10-17, réponses du backend.**
> - **Q1 — Non.** La fiche de prestations intellectuelles ne produit pas de tableau des coûts estimatifs. `TABLEAU_COUTS` reste à
>   téléverser : c'est l'arbitrage H3 du 14/10, inchangé.
> - **Q2 — Oui, un seul canevas en deux parties**, comme proposé.
>   - **Partie `TECHNIQUE`** : références, propositions reçues, examen préliminaire, évaluation technique et signatures.
>     L'évaluation technique reprend les critères `B06-TP-02` à `06`, leurs points et leurs sous-critères, avec le score minimum.
>   - **Partie `FINALE`** : ouverture financière, évaluation combinée avec les poids T et F, négociations et signatures.
> - **Q3 — Le rapport le signale, il ne bloque pas.** En section 1, le rapport d'évaluation écrit « Critères repris de la version
>   n de la fiche ». Si la Commission des marchés a examiné une autre version, dont le canevas est tiré, il l'écrit aussi.
>   - Ce cas reste rare : une révision est refusée tant que la Commission tient le dossier (`DOSSIER_EN_EXAMEN`).
> - **Q4 — D'accord, le bordereau du contrat-cadre reste joint.**
> - **Pour la recette** : il faut une ligne hors contrat-cadre, en fournitures puis en travaux, avec une fiche validée.

## Côté front, après livraison

- **Onglet « Canevas de rapport »** dans le dossier DAO, à côté de « Fiche de présentation », quand la pièce est fournie par
  l'application.
- **Bouton « Ouvrir »** de la liste des pièces, pour le canevas, le bordereau et le DQE.
- **Dépôt « Autre document »** dans les pièces jointes.

La recette demande une fiche **hors contrat-cadre**, en fournitures, puis en travaux. Aujourd'hui, aucune ligne de ce type n'est
éligible dans la base de recette.
