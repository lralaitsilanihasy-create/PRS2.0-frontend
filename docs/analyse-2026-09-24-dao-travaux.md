# Analyse du fichier de correspondance « DAO Travaux »

**Date** : 2026-09-24 · **Source** : `NatureMarches/DAO_Travaux.xlsx`, remis par le pilote · **Auteur** : frontend
(`frontendprs2`).

Ce document dit **ce que le classeur contient**, et les **trois décisions de structure** qu'il impose avant toute
conversion. Il ne convertit rien : la conversion est mécanique une fois ces décisions prises, comme elle l'a été
pour les 116 champs des fournitures et les 114 du contrat-cadre.

## Ce que contient le classeur

Deux feuilles, six colonnes utiles : la rubrique, l'information, puis **PPM · DPAO · AE · CCAP**. Quatre codes au
lieu de trois — le fichier des fournitures n'en avait que trois.

| code | sens |
|---|---|
| `S` | source : vient du plan de passation |
| `AS` | à saisir dans ce document |
| `x` | déjà existant, repris d'un autre document |
| **`FAR`** | **formulaire à remplir** — nouveau, absent du fichier des fournitures |

### Feuille 1 — « A tranche_Alloti » : 195 informations, 88 rubriques

| colonne | codes |
|---|---|
| PPM | 22 `S` |
| DPAO | 57 `AS` · 10 `x` |
| AE | 22 `AS` · 13 `x` |
| CCAP | 73 `AS` · 20 `x` · **6 `FAR`** |
| aucun code | 9 lignes |

### Feuille 2 — « Contrat-cadre » : 221 informations, 56 rubriques

| colonne | codes |
|---|---|
| PPM | 20 `S` · 2 marquées « ? » |
| DPAC | 40 `AS` · 12 `x` |
| AE | **96 `AS`** · 16 `x` |
| CCAP | **0 `AS`** · 109 `x` |
| aucun code | 46 lignes |

**Le contrat-cadre des travaux confirme la règle du contrat-cadre des fournitures** : son CCAP ne porte **aucune**
information propre, seulement des reprises ; c'est l'acte d'engagement qui porte les clauses, avec 96 informations
à saisir. La décision prise le 23/09 — un contrat-cadre produit DPAC et AE, jamais de CCAP — vaut donc pour les
deux catégories. Ce n'est pas une particularité des fournitures, c'est la nature du contrat-cadre.

## Ce que les travaux ont et que les fournitures n'ont pas

Le vocabulaire est un autre métier, et cela confirme qu'une catégorie ne peut pas être un simple filtre sur le même
référentiel :

- **Maître d'ouvrage** et **maître d'œuvre**, avec la référence du lien contractuel entre eux ;
- **tranches** : tranche ferme, tranches conditionnelles 1 et 2 — qui s'ajoutent aux lots et aux variantes ;
- **visite des lieux**, **réunion préparatoire**, **préparation des travaux**, **visa des documents d'exécution** ;
- **réception provisoire**, **délai de garantie**, **retenue de garantie**, **garantie de restitution d'avance** ;
- **augmentation et diminution dans la masse des travaux**, **changement dans l'importance des diverses natures
  d'ouvrage**, **cas de force majeure** ;
- **acomptes sur approvisionnements**, **intérêts moratoires dus à l'Entrepreneur**, **estimation des engagements
  financiers du maître de l'ouvrage** ;
- **onze rubriques d'annexes** : décomposition du prix forfaitaire, bordereau de prix unitaires et détail
  quantitatif, paramètres de la formule de révision, demande d'acceptation des sous-traitants, état des sommes
  versées à des tiers, et les six modèles marqués `FAR`.

Rien de tout cela n'existe dans les 265 champs chargés. À l'inverse, les incoterms, le lieu de livraison,
l'emballage ou le marquage des fournitures n'ont pas de sens ici.

## Les trois décisions de structure

### Décision A — la feuille « A tranche_Alloti » et la forme du marché

Les fournitures avaient **trois** formes : quantité fixe, à commande, contrat-cadre. Le classeur des travaux n'a que
**deux** feuilles : « à tranche / alloti » et « contrat-cadre ». Il n'y a pas de marché de travaux « à commande », et
« à tranche » n'est **pas** une valeur de `FORME_MARCHE` en base, qui n'en connaît que trois.

Sur DBPRS20, les huit lignes de travaux sont **six en quantité fixe et deux en contrat-cadre**.

**Proposition** : la feuille 1 est le **marché de travaux ordinaire**, quelle que soit sa forme au plan. Les
tranches ne sont pas une forme de marché mais une **réponse de cadrage**, au même titre que l'allotissement — le
classeur les range d'ailleurs dans la rubrique « Lots, variantes et tranches », parmi les lignes ordinaires. Une
question de cadrage s'ajoute donc pour les travaux : « Le marché comporte-t-il des tranches ? », qui ouvre la
tranche ferme et les tranches conditionnelles.

Rien à changer en base : `FORME_MARCHE` garde ses trois valeurs.

### Décision B — `FAR`, le formulaire à remplir : tranchée par le pilote

Six informations du CCAP portent `FAR` : les modèles de formule de révision de prix, de garantie bancaire et de
caution de bonne exécution, de garantie et de caution de restitution d'avance, et le cadre de bordereau de prix.

> ⚠️ **24/09 — réponse du pilote.** « Les FAR sont des formulaires à remplir qu'on va créer ultérieurement dont on
> attend leur modèle. » Ce ne sont donc **ni une saisie, ni une pièce que la PRMP téléverse** : ce sont des
> **annexes du dossier, encore à produire**, dont les modèles n'existent pas.
>
> Ma première proposition — les charger en type `PIECE` — était fausse : `PIECE` désigne un fichier que
> quelqu'un joint au dossier, alors qu'un FAR sera **engendré** comme le sont le DPAO, l'acte d'engagement et le
> CCAP, puis rempli par le candidat.

**Décision retenue** : les six sont **chargés inactifs**, avec leur rubrique et leur document maître (`CCAP`),
et une mention en texte type qui dit ce qui est attendu. Ils tiennent ainsi la place et gardent la trace, sans
rien demander à personne ni rien promettre à l'écran. Le jour où les modèles arrivent, il suffit de les activer
depuis l'écran Administrateur et de leur donner leur type — c'est exactement le traitement déjà appliqué au rythme
de commande des marchés à commande et à l'acte de nomination du contrat-cadre.

**Conséquence sur le matériel attendu du pilote** : il y a désormais **deux jeux de modèles** distincts, et il ne
faut pas les confondre.

| jeu | ce que c'est | pour quel lot |
|---|---|---|
| Modèles Word du DPAO, de l'AE et du CCAP | les documents **engendrés depuis la fiche** ; la mise en page provisoire du lot 2a les attend | lot 2b |
| Les six **modèles de FAR** | les **annexes** que le candidat remplira : formule de révision, garanties et cautions, cadre de bordereau | à créer, date inconnue |

### Décision C — la structure en blocs

Le fichier des fournitures arrivait **déjà organisé en dix blocs** `B01` à `B10`. Celui des travaux est **plat** :
88 rubriques sur la feuille 1, 56 sur la feuille 2, sans numérotation.

**Proposition** : reprendre la même colonne vertébrale `B01` à `B10`, qui n'est pas propre aux fournitures mais au
déroulé d'un dossier d'appel d'offres — identification, objet et lots, candidats, dossier et remise des offres,
prix et garanties, évaluation, paiements, exécution, modifications et litiges — en y ajoutant, pour les travaux,
un bloc des **annexes et formulaires**. Les 88 rubriques s'y rangent sans reste ; le détail du rangement sera
donné, rubrique par rubrique, dans le document de conversion, comme pour les deux fichiers précédents.

## Points à clarifier, relevés dans le classeur

| feuille | ligne | point |
|---|---|---|
| A tranche_Alloti | 9 lignes | aucun document : tranches, groupement, fiches d'information, formes de la garantie de bonne exécution, évaluation par lot ou sur l'ensemble, date d'effet, domiciliation bancaire, autres pièces contractuelles |
| Contrat-cadre | 46 lignes | aucun document — même situation qu'aux fournitures, où la règle « consultation au DPAC, clauses contractuelles à l'AE » les a réparties |
| Contrat-cadre | L45, L53 | « Groupement d'entrepreneurs solidaire / conjoint ???? » |
| Contrat-cadre | L93 à L96 | transmission électronique : trois options marquées « ??? » |
| Contrat-cadre | L180 | « ?????? », variation des prix des marchés |
| Contrat-cadre | L221 | « Liste des renvois ???? » |
| Contrat-cadre | L5, L6, L9 | délégation et acte de nomination, sans document — déjà rencontré aux fournitures |

Aucun n'empêche la conversion : ils se chargent inactifs ou s'écartent, avec la trace, comme les 125 points du
fichier des fournitures.

## Ce qui bloque, et dans quel ordre

1. **L'axe des catégories n'existe pas encore.** Le référentiel n'a qu'une dimension, le type de marché
   (`demande-backend-2026-09-24-categories-de-fiche-dao.md`, lot 5). Sans lui, un CSV de travaux ne peut être ni
   chargé ni distingué : les codes `B02-OB-01` et consorts sont déjà pris par les fournitures.
2. **Une fois l'axe livré**, la conversion est mécanique : deux CSV, leur document de conversion, et le chargement
   par l'import — comme les deux fois précédentes.
3. **Les modèles Word des travaux** seront nécessaires au lot 2b, comme ceux des fournitures, et manquent également.
4. **Les six modèles de FAR** sont à créer et n'ont pas de date. Ils ne bloquent rien : les champs sont chargés
   inactifs et s'activeront le jour venu.

## Volume attendu

416 lignes d'information, dont 42 du plan. Après fusion des branches d'un même choix et retrait des doublons, la
conversion devrait produire de l'ordre de **150 à 200 champs** pour les deux formes réunies — à comparer aux 116
des fournitures et aux 114 du contrat-cadre de fournitures.
