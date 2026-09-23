# Référentiel des champs de la fiche marché — contrat-cadre

**Date** : 2026-09-23 · **Source** : fichier de correspondance « DAO Fournitures et Services », carte des informations
du 23/09 (37 pages), modèle **Contrat-cadre** — 182 informations, 22 du PPM, 82 à saisir, 78 points à clarifier.
**Fichier chargeable** : `docs/referentiel-champs-fiche-marche-contrat-cadre.csv` (UTF-8, séparateur `;`, en-têtes =
noms JSON, listes séparées par des virgules) — **114 champs**, à charger par l'API Administrateur comme les 116 des
fournitures.

Ce document dit **comment** chaque ligne du fichier est devenue un champ, pour que le pilote corrige ce qui doit
l'être depuis l'écran Administrateur « Champs de la fiche marché » ou dans le CSV.

## Les deux décisions de l'esquisse, tranchées par le fichier lui-même

### Décision 1 — le deuxième document est le **DPAC**, et il n'y a **pas de CCAP**

Le fichier le dit dans son sous-titre : « Contrat-cadre et marchés subséquents. **Le deuxième document est le
DPAC.** » Ses colonnes le confirment :

| document | à saisir, selon le fichier |
|---|---|
| PPM | 22 (source) |
| **DPAC** | 3 |
| **AE** | 79 |
| **CCAP** | **0** |

La colonne CCAP n'est pas incomplète : elle est **vide par construction**. Un contrat-cadre ne produit pas de
cahier des clauses administratives particulières, parce que **l'acte d'engagement est lui-même le contrat** — c'est
lui qui porte les clauses. D'où les 79 informations qui y vont, contre 15 à 18 dans les deux autres modèles.

**Un contrat-cadre produit donc deux documents : le DPAC et l'AE.** La génération du lot 2a n'a rien à changer :
elle suit `documentMaitre`, et `DPAC` y est déjà géré.

### Décision 2 — les 74 informations sans document se répartissent selon leur **nature**

Soixante-quatorze lignes n'ont aucune colonne cochée. Elles ne sont pas un mystère : ce sont, à deux exceptions
près, des rubriques qui existent **à l'identique dans les deux autres modèles**, où elles sont rattachées au DPAO.
Le fichier a simplement omis de cocher la colonne DPAC, qui remplace le DPAO ici.

La règle appliquée, vérifiable rubrique par rubrique :

- **Clause de consultation → `DPAC`.** Tout B04 (dossier de consultation, présentation et remise des offres,
  calendrier prévisionnel), la monnaie en devise de B05, et tout B06 (examen des candidatures, sélection des offres,
  critères d'attribution). Ce sont exactement les rubriques que le modèle *quantité fixe* rattache au DPAO.
- **Clause contractuelle → `AE`.** La durée et la reconduction du contrat (B02), les marchés subséquents (B07), les
  paiements et avances (B08), l'exécution (B09), les modifications et litiges (B10). Ce sont les rubriques que les
  autres modèles rattachent au CCAP, lequel n'existe pas ici.

Résultat : **34 champs au DPAC, 80 à l’AE**, contre 3 et 79 dans le fichier brut.

## Règles de conversion (les mêmes que pour les fournitures)

1. **Une ligne du fichier = un champ**, sauf quand plusieurs lignes sont les **branches d'un même choix** : elles
   deviennent un seul champ `LISTE` ou `OUI_NON`. C'est le sens de l'esquisse — supprimer les « choisir et supprimer
   les mentions inutiles ».
2. **Le document maître** est la colonne « AS » ; **les reprises** sont les colonnes « x ».
3. **Les 22 informations du PPM ne sont pas dans le CSV** : le serveur les relit de la ligne du plan. Il faut en
   revanche **étendre à `CONTRAT_CADRE`** les `typesMarche` des champs PPM déjà semés (`B01-AC-*`, `B02-LV-*`,
   `B02-OB-01`) — voir la demande backend.
4. **Le type** est déduit du libellé : montant → `MONTANT`, « nombre de mois / jours / heures » → `NOMBRE`, « % » →
   `POURCENTAGE`, date → `DATE`, choix → `LISTE` / `OUI_NON`, le reste `TEXTE_LONG` (clauses) ou `TEXTE` (courts).
5. **La condition d'affichage** ne peut référencer que des **réponses de cadrage** (`alloti`, `groupement`,
   `attributaires`, `avance`…), jamais un autre champ : c'est la limite de la grammaire actuelle. Les champs qui
   dépendent d'un autre champ sont donc chargés **non obligatoires** plutôt que conditionnés.
6. **Obligatoire** : oui pour ce qu'un contrat-cadre ne peut omettre (durées, montants, adresses, dates, critères) ;
   non pour les clauses optionnelles. **74 champs sur 114** sont obligatoires.
7. **Contrôles** : les règles du catalogue déjà outillé sont réemployées — `DATES_ORDRE` sur les cinq dates du
   calendrier, `MONTANT_POSITIF`, `AVANCE_SUP_5_GARANTIE`, `DELAI_PAIEMENT_75`, `INTERETS_MORATOIRES_TAUX`,
   `PENALITES_PLAFOND_15`.
8. **Types de marché** : tous les champs du CSV valent `CONTRAT_CADRE` seul.

## Ce que donne la conversion

| bloc | champs | rubriques |
|---|---|---|
| B02 Objet, allotissement & forme du contrat-cadre | 13 | objet et étendue, signataire, procédure, durée, allotissement |
| B03 Candidats | 12 | titulaire, groupement, sous-traitance |
| B04 Dossier, remise & ouverture des offres | 20 | dossier de consultation, présentation, remise, renseignements, calendrier |
| B05 Prix et montants | 6 | unité monétaire, montant, prix des marchés |
| B06 Évaluation, attribution & notification | 10 | candidatures, sélection, critères, notification |
| **B07 Marchés subséquents** | **26** | passation, forme, attribution, termes non couverts, pièces, durée, délais, pénalités |
| B08 Paiements, avances & garanties | 13 | financement et sûretés, facturation et paiement |
| B09 Exécution du marché | 10 | exécution administrative, vérification, garanties, assurance |
| B10 Modifications, résiliation & litiges | 4 | recours, modifications, résiliations |

**114 champs**, 37 rubriques, 113 actifs et 1 inactif. Par type : 46 textes longs, 21 textes, 14 listes, 12 nombres,
9 oui/non, 7 dates, 3 montants, 2 pourcentages.

**Un seul champ de source `CADRAGE`** : `B02-AL-03`, le mono ou multi-attributaire — le seul que la migration V35
ne sème pas.

> ⚠️ **23/09, après la livraison backend — quatre reflets de cadrage retirés du CSV.** La première conversion en
> créait cinq. Or V35 sème **douze** reflets de cadrage pour les **trois** types : quatre faisaient donc double
> emploi (allotissement, forme de prix, forme du groupement, avance), et la même réponse se serait affichée deux
> fois dans la fiche et dans les documents. Ce sont les quatre du CSV qui partent, pas ceux de V35 : les douze de
> V35 forment une famille cohérente, aux mêmes codes et dans les mêmes rubriques pour les trois types, et la scinder
> donnerait deux règles de placement pour une seule famille. La rubrique `B02-FC` « Forme du contrat-cadre » se vide
> et doit être retirée de V39, qui n’est encore appliquée nulle part.

## Lignes écartées, fusionnées ou chargées inactives

| Ligne du fichier | Décision |
|---|---|
| 3 « par délégation du » (B01) | **écartée** : reprise sans document maître, mention de la ligne 2 |
| 4 « désigner la nature et le numéro de l'acte de nomination » | chargée **inactive** (`B02-SG-03`) : aucun document au fichier, à confirmer |
| 6 et 7 (personne responsable, délégation) | déplacées en **B02** (`B02-SG-01/02`) : B01 est le bloc du PPM, il n'est **jamais saisi** |
| 27, 28, 29 (rédactions du rythme) | fusionnées en une liste `B02-PC-02` |
| 31 forme de prix | portée par le reflet **`B05-TP-01`** de V35 (`typePrix`), commun aux trois types |
| 32 montant indicatif | fusionnée avec 82, en `B05-MT-01/02` (hors taxes et toutes taxes) |
| 35, 36, 37 (reconductible) | fusionnées en `B02-DC-03` + `B02-DC-04` |
| 38 « Unique ou Alloti ? » | portée par **`B02-LV-04`** de V35 (`alloti`) — **déduit du plan** depuis le lot 1d |
| 39 mono ou multi-attributaire | devient un champ **`CADRAGE`** (`attributaires`) |
| 45, 46 · 53, 54 (qualité du représentant) | fusionnées en une liste, pour le titulaire et pour le membre du groupement |
| 47 solidaire ou conjoint | portée par **`B03-GR-02`** de V35 (`formeGroupement`) |
| 51 NIF du membre | **écartée** : doublon de la ligne 50, signalé par le fichier |
| 56 « <choisir et supprimer les mentions inutiles> » | **écartée** : mention de gabarit, pas une information |
| 58 « indiquer la date des étapes » | **écartée** : en-tête des lignes 76 à 80, qui portent les dates |
| 67 à 73 (remise papier et électronique) | fusionnées en `B04-RQ-01..05` |
| 88, 89 (le prix est un critère) | fusionnées en `B05-PM-02` |
| 91 « ?????? » | **écartée** : point non identifié, signalé par le fichier |
| 103, 104, 105 (fait générateur) | fusionnées en une liste `B07-PS-01` |
| 108, 109 (forme des marchés subséquents) | fusionnées en une liste `B07-FS-01` |
| 116 à 122 (options d'attribution) | fusionnées en `B07-MA-03/04/05` |
| 128, 129 (durée fixée ou non) | fusionnées en `B07-DU-02` + `B07-DU-03` |
| 131 à 135 (reconductions) | fusionnées en `B07-DU-04/05/06` |
| 137 à 145 (délais d'exécution) | fusionnées en `B07-DE-01..04` |
| 146 à 152 (pénalités) | fusionnées en `B07-PE-01/02/03` |
| 153, 154, 155 (avance) | portées par **`B08-AV-01`** de V35 (`avance`) ; `B08-FI-02/03/04` en détaillent les modalités |
| 161 code « 89- » | **anomalie du fichier** corrigée : le champ existe (`B08-FP-02`), le code est ignoré |
| 169, 170, 171 (modalités d'exécution) | fusionnées en `B09-EA-01/02/03` |
| 172, 173 (vérification) | fusionnées en `B09-VA-01` + `B09-VA-02` |
| 174, 175 · 176, 177 (garanties, assurance) | fusionnées en `B09-GP-01/02` et `B09-AU-01/02` |

**Deux codes de rubrique ont été changés** pour éviter une collision avec le référentiel déjà chargé :
`B04-RQ` au lieu de `B04-RO` (la remise des offres des fournitures occupe déjà `RO`) et `B09-AU` au lieu de
`B09-AS` (l'assurance des fournitures occupe déjà `AS`). Un code de champ est unique dans tout le référentiel.

## Ce qui reste à trancher par le pilote

1. **Les 78 points à clarifier** du modèle contrat-cadre sont couverts par les décisions ci-dessus, sauf deux :
   la ligne 4 (acte de nomination), chargée inactive, et la ligne 91, écartée.
2. **La note de l'équipe sur la ligne 6** — « Tsy PRMP ihany ve ireo ? », la personne responsable des marchés passés
   sur la base du contrat-cadre n'est-elle pas simplement la PRMP ? Si oui, `B02-SG-01` devient un champ **PPM**
   repris, et non une saisie.
3. **Le montant indicatif hors taxes et toutes taxes** (`B05-MT-01/02`) : le fichier n'en demande qu'un, libellé
   « indiquer le montant indicatif en Ariary H.T, et indiquer montant indicatif en Ariary T.T.C ». Deux champs ont
   été créés, parce qu'une information par valeur vaut mieux qu'un texte à deux nombres.
