# Demande backend — 2026-10-17 — Les pièces du dossier DAO que l'application détient déjà sont satisfaites par ses données

## Contexte

Le pilote a créé depuis la fiche des consomptibles informatiques (ligne 303339, version 5, remise **papier**) le dossier
**100380** (`DMC` / `DAOO`, `idDmc` 1, brouillon). `GET /api/dossiers/100380/pieces-exigees` exige, entre autres :

| Code | Pièce | Condition | État au dossier |
|---|---|---|---|
| `FICHE_PRESENTATION` | Fiche de présentation datée et signée | `PAPIER` | manquante |
| `CALENDRIER` | Calendrier annuel de passation mis à jour et signé | `PAPIER` | manquante |
| `AGPM_CONTROLE` | AGPM (ou PPM) signé et contrôlé, avec le PV de la Commission | `PAPIER` | manquante |
| `PUBLICATION_AGPM` | Publication de l'AGPM (journal) | — | manquante |
| `AVIS_SPECIFIQUE` | Projet d'avis spécifique | `FACULTATIVE_EN_LIGNE` | jointe d'office |
| `DAO_COMPLET` | Dossier d'appel d'offres complet | — | jointe d'office |

Les trois premières sont exigées parce que la remise est sur papier. `PiecesExigees.contexte` ne tient un dossier pour « en
ligne » que si sa fiche est en remise électronique (R8, 13/10).

**Le pilote constate que l'application détient déjà ces informations**, et demande qu'on les présente **comme dans le dossier
de planification**, dont les éléments sont des onglets de données (fiche de présentation, plan, AGPM, pièces jointes) et non des
fichiers à déposer :
- **la fiche de présentation** : la ligne du plan et la fiche DAO, validée par la PRMP, en donnent tout le contenu ;
- **le calendrier annuel** est déjà **produit par l'application** depuis le plan contrôlé (`GET …/calendrier-annuel`, V115). Selon
  l'arbitrage du pilote du 14/10 (« Q-pièce »), il **remplace** la pièce « mis à jour et signé ». Mais la liste des pièces exigées
  la compte encore manquante ;
- **l'AGPM contrôlé avec le PV de la Commission** : le plan de la ligne (dossier 100379, `00001/PPM-AGPM/CNM/2026`) a été
  **examiné dans l'application**, et son PV est signé dans l'application.

**La publication de l'AGPM** n'est pas une donnée : c'est un justificatif externe, déposé une fois sur le plan et repris d'office
(V118). Elle reste une pièce : il n'y a rien à changer, sinon que le plan 100379 ne la porte pas encore.

## B1 — Trois pièces satisfaites par les données, pour un dossier né d'une fiche

Pour un dossier `DMC` qui porte une fiche **validée** (`ID_DMC`), **quel que soit le mode de remise** :
- `FICHE_PRESENTATION`, `CALENDRIER` et `AGPM_CONTROLE` sont **satisfaites d'office**. Le contrôle de soumission ne les compte
  plus manquantes, et la recevabilité du Secrétaire non plus ;
- `GET …/pieces-exigees` le dit, pour que l'écran l'affiche. Par exemple, un champ `fourniePar: "APPLICATION"` et la référence
  de ce qui la fournit :
  - le plan et son PV pour `AGPM_CONTROLE` (`idDossierPlan`, `idPv`) ;
  - le calendrier, avec la route qui le produit ;
  - la fiche de présentation, avec la route de B2.
- **Un dossier DAO créé à la main**, sans fiche, garde la règle actuelle : rien ne prouve alors les données.

## B2 — La fiche de présentation d'un dossier DAO

Le dossier de planification a sa fiche de présentation, produite des données et affichée en onglet (`FichePresentationDoc`).
Demande : la même chose pour un dossier DAO né d'une fiche, en données (lecture JSON) et en PDF pour l'impression.

**Q2 — Le contenu.** Le front propose :
- **identification** : autorité contractante, PRMP, référence du plan, ligne ;
- **marché** : objet, catégorie, mode de passation, forme, nombre de lots et leur désignation, montant estimatif du plan,
  source de financement, imputation budgétaire, compte ;
- **procédure** : numéro du DAO (`B02-OE-01`), dates prévisionnelles (`B04-CP-01` à `CP-08`), mode de remise des offres ;
- **validation** : version de la fiche, date et auteur de la validation.

Le backend ajuste ce contenu au modèle de fiche de présentation du manuel, s'il en existe un pour les DAO.

## B3 — De quoi faire un onglet « Plan de passation »

Le dossier DAO (`GET /api/dossiers/{id}`) dit **quel plan** porte sa ligne (dossier 100379) et **quel PV** l'a contrôlé. L'écran
présentera la ligne du plan dans un onglet, avec un lien vers le plan et son PV. Il ne crée aucune nouvelle donnée : il reprend
celles du plan.

## Questions

- **Q1 — La signature.** Les pièces exigent « datée et signée », « signé et contrôlé ». Le front propose d'en tenir lieu ainsi :
  - pour la fiche de présentation, par la **validation de la fiche par la PRMP** (date et auteur, journalisés) ;
  - pour l'AGPM, par le **PV signé dans l'application**.

  Le manuel de contrôle le permet-il ? C'est au pilote de trancher, s'il faut.
- **Q2** : le contenu de la fiche de présentation (B2).
- **Q3** : faut-il appliquer la même règle aux autres sous-types nés d'une fiche (`DAOOI`, `DAOR`, `DAORI`, `DC`…), qui exigent les
  mêmes pièces ? Le front le propose.

## Ce que le front fera, dès la livraison

- Le dossier né d'une fiche se présente **en onglets**, comme le dossier de planification :
  - « Fiche DAO » (les données, celles de l'examen) ;
  - « Fiche de présentation » (B2) ;
  - « Plan de passation » (B3) ;
  - « Calendrier » (déjà produit) ;
  - « Pièces jointes » (DAO complet, bordereau estimatif, projet d'avis, publication de l'AGPM).
- Dans la liste des pièces exigées, les trois pièces de B1 s'affichent « fournie par l'application », avec un lien vers leur onglet.
- Recette sur le dossier 100380 : plus que la publication de l'AGPM à fournir, une fois déposée sur le plan 100379.
