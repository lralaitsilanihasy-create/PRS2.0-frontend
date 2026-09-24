# Référentiel des champs de la fiche DAO — prestations intellectuelles

**Date** : 2026-09-24 · **Source** : `NatureMarches/DAO_Prestations Intellectuelles.xlsx`, remis par le pilote —
une feuille, 169 lignes, 150 informations, 64 rubriques.

**Fichier chargeable** : `referentiel-champs-fiche-dao-prestations-intellectuelles.csv` — **90 champs**,
44 rubriques, catégorie `PRESTATIONS_INTELLECTUELLES`, formes `QUANTITE_FIXE` et `A_COMMANDE`.

| | prestations intellectuelles |
|---|---|
| champs | 90 |
| rubriques | 44 |
| obligatoires | 56 |
| inactifs | 2 |
| **DPIC** | 50 |
| AE | 19 |
| CCAP | 21 |

## Ce que ce modèle a de particulier

### Un troisième document de consultation : le **DPIC**

Les fournitures et les travaux produisent un **DPAO**, le contrat-cadre un **DPAC**. Les prestations
intellectuelles produisent un **DPIC** — les données particulières des instructions aux consultants. C'est la
colonne du classeur, et cinquante champs y vont.

> ⚠️ **Besoin backend** : `DPIC` doit rejoindre les valeurs admises du document maître, comme `DPAC` l'a fait.
> Sans cela le fichier est rejeté à l'import. Si le backend préfère éviter une valeur de plus, la solution de
> repli est d'écrire `DPAO` dans le fichier et d'étendre sa règle de répartition — il remappe déjà
> `DPAO → DPAC` pour le contrat-cadre, il remapperait `DPAO → DPIC` pour cette catégorie. Le changement dans le
> fichier est alors un simple remplacement.

### Un quatrième code : `C`, le choix

Le classeur des prestations intellectuelles distingue `S` (source), `AS` (à saisir), `x` (repris) et **`C`
(choix)**. Quarante lignes portent `C` : ce sont les **branches d'une même alternative**, que la conversion fusionne
en un seul champ `LISTE` ou `OUI_NON`. Le fichier dit donc lui-même ce qu'il fallait deviner ailleurs — c'est un
progrès, et la fusion en est plus sûre.

### Un vocabulaire propre

Client et consultant plutôt qu'autorité contractante et entrepreneur. **Proposition technique** et **proposition
financière** plutôt qu'offre. **Mode de sélection** en quatre branches — qualité technique et prix, budget
prédéterminé, meilleure proposition financière parmi les techniquement qualifiés, qualité technique
exclusivement. **Mode de rémunération** en quatre branches — forfait, temps passé, résultat, lié au coût des
travaux. **Évaluation par points** sur cinq critères. **Négociations**, **transfert de connaissances**,
**utilisation des résultats**, **matériel confié par le client**.

### Aucun contrat-cadre

Le classeur n'a qu'une feuille : il n'y a pas de contrat-cadre de prestations intellectuelles. Les 90 champs
valent donc pour les formes `QUANTITE_FIXE` et `A_COMMANDE`. Sur DBPRS20, les quatre lignes de cette nature sont
toutes à quantité fixe, donc rien ne manque aujourd'hui.

> **À trancher par le pilote** : si un contrat-cadre de prestations intellectuelles devait exister, il faudrait
> son propre modèle. En attendant, une telle ligne ouvrirait une fiche presque vide — le serveur ne lui servirait
> que les informations reprises du plan.

## Règles de conversion (les mêmes que pour les trois fichiers précédents)

1. **Une ligne = un champ**, sauf les branches d'un même choix — ici explicitement marquées `C` — qui deviennent
   un seul champ `LISTE` ou `OUI_NON`. Les 150 informations donnent 90 champs.
2. **Le document maître** est la colonne portant `AS` ou `C` ; **les reprises** sont les colonnes portant `x`.
3. **Les 18 informations du plan ne sont pas dans le fichier** : le serveur les relit de la ligne.
4. **Le type** est déduit du libellé, avec `NOMBRE` pour les points de l'évaluation technique.
5. **La condition d'affichage** ne référence que des réponses de cadrage : `groupement`, `avance`.
6. **Contrôles** réemployés : `MONTANT_POSITIF`, `INTERETS_MORATOIRES_TAUX`, `PENALITES_PLAFOND_15`,
   `DATES_ORDRE:REMISE`.
7. **Catégorie** : `PRESTATIONS_INTELLECTUELLES` pour les 90.

## Les rubriques à semer par migration

Les 44 rubriques ci-dessous, à créer avant l'import des champs. Les rangs partent de 121 pour se ranger après
celles des fournitures (1 à 60) et des travaux (61 et suivants). Aucun bloc neuf : les dix existants suffisent,
il n'y a pas d'annexes dans ce modèle.

| code | bloc | libellé | rang | document maître | nb attendu | types de marché |
|---|---|---|---|---|---|---|
| `B02-CL` | B02 | Client et personne responsable | 121 | AE | 4 | QUANTITE_FIXE,A_COMMANDE |
| `B02-MS` | B02 | Mode de sélection | 122 | DPIC | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B02-OP` | B02 | Objet des prestations | 123 | DPIC | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B02-SP` | B02 | Signature de l'acte d'engagement | 124 | DPIC | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B03-GP` | B03 | Groupement de consultants | 121 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B03-NP` | B03 | Nantissement | 122 | AE | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B03-SP` | B03 | Sous-traitance | 123 | AE | 4 | QUANTITE_FIXE,A_COMMANDE |
| `B03-TP` | B03 | Titulaire | 124 | AE | 5 | QUANTITE_FIXE,A_COMMANDE |
| `B04-AI` | B04 | Assistance du client pendant la consultation | 121 | DPIC | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B04-DP` | B04 | Délai de validité des propositions | 122 | DPIC | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B04-EP` | B04 | Demande d'éclaircissements | 123 | DPIC | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B04-FL` | B04 | Forme des plis | 124 | DPIC | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B04-LH` | B04 | Lieu, date et heure de la remise | 125 | DPIC | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B04-LP` | B04 | Langue | 126 | DPIC | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B04-NP` | B04 | Contenu des propositions | 127 | DPIC | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B04-QT` | B04 | Proposition technique | 128 | DPIC | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B04-RU` | B04 | Réunion préparatoire | 129 | DPIC | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B04-VE` | B04 | Remise par voie électronique | 130 | DPIC | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B05-MP` | B05 | Monnaie | 121 | DPIC | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B05-PF` | B05 | Proposition financière et mode de rémunération | 122 | DPIC | 12 | QUANTITE_FIXE,A_COMMANDE |
| `B05-RP` | B05 | Caractère ferme ou révisable des prix | 123 | DPIC | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B06-CS` | B06 | Classement des propositions | 121 | DPIC | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B06-NG` | B06 | Négociations | 122 | DPIC | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B06-OF` | B06 | Ouverture des propositions financières | 123 | DPIC | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B06-TP` | B06 | Évaluation des propositions techniques | 124 | DPIC | 6 | QUANTITE_FIXE,A_COMMANDE |
| `B08-AI` | B08 | Avance forfaitaire | 121 | AE | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B08-DP` | B08 | Domiciliation bancaire | 122 | AE | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B08-IP` | B08 | Intérêts moratoires | 123 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B08-RP` | B08 | Modalités de règlement des comptes | 124 | CCAP | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B09-AI` | B09 | Assistance du client | 121 | CCAP | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B09-AP` | B09 | Assurance | 122 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-DK` | B09 | Documents contractuels | 123 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-DP` | B09 | Durée et délais | 124 | AE | 4 | QUANTITE_FIXE,A_COMMANDE |
| `B09-FC` | B09 | Fourniture de matériel par le consultant | 125 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-MF` | B09 | Matériel confié par le client | 126 | CCAP | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B09-MS` | B09 | Mesures de sécurité et protection du secret | 127 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-MV` | B09 | Modifications et avenants | 128 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-NC` | B09 | Notification au consultant | 129 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-OP` | B09 | Opération de vérification | 130 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-PP` | B09 | Pénalités et retenues | 131 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-UR` | B09 | Utilisation des résultats | 132 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B10-DP` | B10 | Dérogations aux documents généraux | 121 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B10-IN` | B10 | Indemnisation en cas de résiliation | 122 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B10-PP` | B10 | Procédure contentieuse | 123 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |

## Lignes écartées, fusionnées ou chargées inactives

| ligne | décision |
|---|---|
| L5, L6 (délégation, acte de nomination du client) | L6 chargée **inactive** (`B02-CL-04`), sans document au classeur ; L5 fusionnée avec `B02-CL-03` |
| L36 à L39 (mode de sélection, 4 branches `C`) | fusionnées en une liste `B02-MS-01` |
| L40 à L43 (groupements, 4 branches `C`) | portées par le reflet de cadrage `groupement`, la forme par `B03-GP-01` |
| L44, L45 (sous-traitance autorisée ou non) | fusionnées en `B03-SP-01` |
| L50, L100, L108, L109, L119 | **écartées** : en-têtes de rubrique, pas des informations |
| L51 à L58 (adresse en huit morceaux) | fusionnées en `B04-EP-01` + `B04-EP-02` : une adresse et une adresse électronique |
| L61 à L63 (contenu des propositions) | fusionnées en une liste `B04-NP-01` |
| L67 « indiquer ici, le cas échéant ?? » | **écartée** : point non identifiable, sans document |
| L68 à L81 (mode de rémunération) | fusionnées en `B05-PF-01` (liste à quatre branches) et ses compléments `B05-PF-02` à `B05-PF-10` |
| L86 à L88 (langue) | fusionnées en `B04-LP-01` + `B04-LP-02` |
| L90 (date d'effet, en-tête) | **écartée** ; L91 devient `B09-DP-01` |
| L93, L94 (durée globale ou date de fin) | fusionnées en `B09-DP-03` + `B09-DP-04` |
| L95, L96 (prix fermes ou révisables) | portées par le reflet de cadrage `prixRevisable` (`B05-RP-01`) |
| L98, L99 (réunion préparatoire) | fusionnées en `B04-RU-01` + `B04-RU-02` |
| L106, L107 (voie électronique) | fusionnées en `B04-VE-01` + `B04-VE-02` |
| L120 à L122 (domiciliation, 3 branches `C`) | fusionnées en une liste `B08-DP-01` |
| L123 à L126 (avance forfaitaire, 4 branches `C`) | portées par le reflet de cadrage `avance` et `B08-AI-02` |
| L133 à L137, L140 à L144, L146, L147 | fusionnées, branche par branche, dans leur rubrique |
| L145 (documents à fournir pour le matériel du consultant) | chargée **inactive** (`B09-FC-01`) : aucun document au classeur |

## Ce qui reste à trancher par le pilote

1. **Le contrat-cadre de prestations intellectuelles** n'existe pas au classeur. Faut-il en prévoir un ?
2. **Le titulaire** (lignes 10 à 15) est marqué `AS` sur l'acte d'engagement : chargé tel quel, contrairement aux
   travaux où il fallait le déduire.
3. **Les modèles Word** du DPIC, de l'acte d'engagement et du CCAP, pour le lot 2b — troisième jeu attendu.
