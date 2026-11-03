# Demande backend — 2026-11-03 — Fiche de présentation : la section « Procédure » devient « Données particulières »

## Contexte

Le pilote a lu la fiche de présentation d'un dossier de marché (00010/MAOO/CNM/2026). Il a demandé si la section **« Procédure »**
était l'avis spécifique. Ce n'est pas le cas : la section reprend les conditions de la mise en concurrence saisies dans les
informations du DAO (numéro du DAO, mode de remise, plateforme, lieu d'ouverture, validité des offres, garantie de soumission).
L'intitulé « Procédure » ne le dit pas.

**Décision du pilote (03/11)** : la section prend le nom du document de données particulières que produit la fiche.

## B1 — Le titre de la section `PROCEDURE`

`FichePresentationService` : la section `PROCEDURE` est construite à deux endroits. Le premier sert au dossier né d'une fiche, le
second au dossier de marché (`duMarche`). Son **titre** devient :

| Fiche | Titre |
|---|---|
| Contrat-cadre (`typeMarche = CONTRAT_CADRE`) | **Données particulières (DPAC)** |
| Prestations intellectuelles (`categorie = PRESTATIONS_INTELLECTUELLES`) | **Données particulières (DPIC)** |
| Autres cas | **Données particulières (DPAO)** |

L'ordre de test est celui du front (`documentEffectif`) : le contrat-cadre d'abord, puis la catégorie.

- Le **code** `PROCEDURE` ne change pas : le front lit ses lignes par ce code (`fiche-presentation-dao.ts`).
- Les lignes ne changent pas, y compris le calendrier du contrat-cadre (`B04-CP-0x`) et la liste restreinte (V156).
- Si la fiche de présentation a aussi un rendu PDF, il prend le même titre.

## Ce que fait le front

Rien à coder : l'écran affiche le titre servi. À la livraison, le front vérifie la fiche d'un dossier de marché et celle d'un
dossier d'appel d'offres.

> ⚠️ **2026-11-03 — B1 livré (PRS20, sans migration), sans écart.** La section `PROCEDURE` porte le titre « Données particulières
> (DPAC) », « (DPIC) » ou « (DPAO) », dans l'ordre demandé : contrat-cadre d'abord, puis catégorie. Cela vaut aux deux endroits, dossier
> né d'une fiche et dossier de marché. Le PDF (`…/fiche-presentation/pdf`) reprend le titre de la section, donc le même. Le code
> `PROCEDURE` et les lignes sont inchangés.