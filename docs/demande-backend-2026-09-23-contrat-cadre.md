# Demande backend — Outiller le contrat-cadre (lot 4)

**Date** : 2026-09-23 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande du pilote, « prépare le lot
pour le contrat cadre et à commande », puis remise du **fichier de correspondance, partie contrat-cadre**. Le marché
à commande fait l'objet d'une demande séparée (`-23-marche-a-commande.md`).

> ⚠️ **Première rédaction corrigée en place le 23/09.** Ce document disait que le lot ne pouvait pas démarrer, faute
> de matière et de deux décisions. Le pilote a remis le fichier : **la matière existe, et les deux décisions y sont
> écrites**. Le lot est prêt.

## Constat (mesuré sur la base locale le 23/09)

| type | champs applicables | dont actifs | dont propres au type |
|---|---|---|---|
| `QUANTITE_FIXE` | 143 | 139 | 0 |
| `A_COMMANDE` | 151 | 146 | 8 |
| `CONTRAT_CADRE` | **35** | **35** | **0** |

Trente-cinq champs contre cent trente-neuf, aucun qui lui soit propre, et le bloc **`B07` « Contrat-cadre
(réservé) » porte zéro rubrique**. Une fiche de contrat-cadre ouverte aujourd'hui ne montrerait rien de ce qui fait
un contrat-cadre : ni accord-cadre, ni marchés subséquents, ni remise en concurrence.

## La matière est convertie et prête à charger

`docs/referentiel-champs-fiche-marche-contrat-cadre.csv` — **118 champs**, 38 rubriques, même format que les 116
des fournitures chargés le 23/09. La conversion est documentée ligne à ligne dans
`referentiel-champs-fiche-marche-contrat-cadre.md` : règles appliquées, fusions, lignes écartées, anomalies du
fichier source.

| bloc | champs |
|---|---|
| B02 Objet, allotissement & forme du contrat-cadre | 15 |
| B03 Candidats | 13 |
| B04 Dossier, remise & ouverture des offres | 20 |
| B05 Prix et montants | 6 |
| B06 Évaluation, attribution & notification | 10 |
| **B07 Marchés subséquents** | **26** |
| B08 Paiements, avances & garanties | 14 |
| B09 Exécution du marché | 10 |
| B10 Modifications, résiliation & litiges | 4 |

## Les deux décisions, tranchées par le fichier

### Décision 1 — le deuxième document est le **DPAC**, et il n'y a **pas de CCAP**

Le fichier le dit dans son sous-titre : « Contrat-cadre et marchés subséquents. **Le deuxième document est le
DPAC.** » Ses colonnes l'écrivent : PPM 22 source, **DPAC 3 à saisir, AE 79 à saisir, CCAP 0 à saisir**.

La colonne CCAP n'est pas incomplète, elle est **vide par construction** : dans un contrat-cadre, **l'acte
d'engagement est le contrat**, c'est lui qui porte les clauses. D'où 79 informations à l'AE, contre 15 à 18 dans les
deux autres modèles.

**Un contrat-cadre produit donc DPAC + AE, jamais de CCAP.** Le lot 2a n'a rien à changer : la sélection suit
`documentMaitre`, et `DPAC` y est déjà géré.

### Décision 2 — les 74 informations sans document se répartissent selon leur nature

Elles ne sont pas un mystère : à deux exceptions près, ce sont des rubriques qui existent **à l'identique** dans les
deux autres modèles, où elles sont rattachées au DPAO. Le fichier a omis de cocher la colonne DPAC, qui remplace le
DPAO ici.

- **Clause de consultation → `DPAC`** : tout B04, la monnaie en devise de B05, tout B06.
- **Clause contractuelle → `AE`** : la durée et la reconduction du contrat, B07, B08, B09, B10.

Après répartition : **36 champs au DPAC, 82 à l'AE**.

## Demande

### B1 — Charger le référentiel du contrat-cadre

Chargement du CSV par l'API Administrateur, comme les 116 du 23/09. **`B07` reçoit ses huit rubriques** : il existe
aujourd'hui avec zéro rubrique, ce qui le rend invisible.

### B2 — Étendre les champs du PPM au contrat-cadre

Les 22 informations du PPM ne sont pas dans le CSV : le serveur les relit de la ligne du plan. Il faut **ajouter
`CONTRAT_CADRE` aux `typesMarche`** des champs PPM déjà semés (`B01-AC-*`, `B02-LV-*`, `B02-OB-01`), sans quoi une
fiche de contrat-cadre n'aurait aucune information reprise.

### B3 — Ouvrir le type `CONTRAT_CADRE`

La liste des formes outillées s'étend, les 409 `FORME_NON_OUTILLEE` cessent pour ce type, et `blocsASaisir` ouvre
**B07** — cette règle est déjà écrite et testée côté front depuis le lot 1.

### B4 — Les rubriques servies doivent suivre le type de marché

`GET /api/champs-fiche-marche?typeMarche=` filtre déjà les **champs**. Il ne filtre pas les **rubriques** des blocs.
Or le contrat-cadre ajoute 38 rubriques à des blocs partagés : sans filtrage, une fiche à quantité fixe afficherait
des rubriques vides, puisque l'écran garde ouverte une rubrique sans champ — c'est ainsi qu'il signale un référentiel
à compléter.

**Une rubrique n'est servie que si au moins un de ses champs vaut pour le type demandé.**

### B5 — Les fiches contrat-cadre déjà créées

Sur DBPRS20, les DMC 3 et 4 portent des fiches gelées par le lot 1c. À l'ouverture du type, elles redeviennent
écrivables avec un cadrage à reprendre : leurs réponses ont été saisies sous un autre type. Aucune reprise de
données n'est demandée.

## Tests attendus (recette backend)

1. `GET /api/champs-fiche-marche?typeMarche=CONTRAT_CADRE` sert **B07 avec ses rubriques** et les 118 champs.
2. Le même appel pour `QUANTITE_FIXE` ne sert **aucune** des 38 rubriques du contrat-cadre (B4).
3. Un contrat-cadre ouvre **B07** dans ses blocs à saisir ; un marché à quantité fixe et un marché à commande, non.
4. `attributaires = MONO` ferme les rubriques de remise en concurrence ; `MULTI` les ouvre.
5. Une fiche de contrat-cadre sert ses **22 informations reprises** du plan (B2).
6. `POST …/valider` produit **DPAC et AE** — jamais de DPAO ni de CCAP pour ce type.
7. Ligne à `FORME_MARCHE = CONTRAT_CADRE` → `formeOutillee = true`, et les écritures cessent de répondre 409.

## Côté front

**Rien à écrire, et c'est voulu.** L'écran est piloté par la donnée depuis le lot 1 : blocs, rubriques, champs,
conditions et documents viennent tous du référentiel. Le jour où le contrat-cadre est chargé et ouvert, la fiche se
dessine seule, avec B07 en plus, et la **page courte** livrée le 23/09 disparaît d'elle-même pour ce type.

Un seul changement, déjà demandé au lot 3 : `FicheMarcheDto.typeOutille` servi par le serveur, pour que le front
cesse de tenir sa propre liste des types outillés.

## Ce qui reste à trancher par le pilote

1. **Ligne 6 du fichier**, note de l'équipe « Tsy PRMP ihany ve ireo ? » — la personne responsable des marchés
   passés sur la base du contrat-cadre est-elle simplement la PRMP ? Si oui, `B02-SG-01` devient un champ **PPM**
   repris, et non une saisie.
2. **Ligne 4**, l'acte de nomination : chargée **inactive**, faute de document au fichier.
3. **Ligne 91**, « ?????? » : écartée, non identifiable.

Ces trois points ne bloquent pas le lot : deux champs sur cent dix-huit.
