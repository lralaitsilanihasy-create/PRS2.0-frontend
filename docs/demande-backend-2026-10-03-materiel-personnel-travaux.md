# Demande backend — Fiche DAO des travaux : le matériel et le personnel exigés, en listes

**Date** : 2026-10-03 · **Émetteur** : front · **Origine** : plan `docs/plan-2026-10-02-fiche-travaux-structuree.md`,
**lot 3**, lancé par le pilote le 03/10 (« poursuis le lot 3 »), après la clôture des lots 1 et 2
(`demande-backend-2026-10-02-dqe-et-seuils-travaux.md`). La règle Q4 du plan vaut ici aussi : **les champs texte
existants restent en complément**, et la liste fait foi.

**Ce qui manque aujourd'hui.** La clause 6.3 du DPAO-T imprime :
- le matériel exigé dans un texte libre, `B03-QT-09` (le libellé parle de « forme sous laquelle l'entrepreneur
  disposera du matériel », mais le champ remplace en fait le trou « <indiquer une liste de ces gros matériels> ») ;
- le personnel clé dans un autre texte libre, `B03-QT-13`.

Un texte ne se contrôle pas, et la soumission en ligne ne peut pas s'en servir. La correspondance avec le DAO du MTP l'a
relevé (⚠ sur `B03-QT-09`, information sans champ n° 2).

**Les deux cas réels** (fiches des faits ; DAO non suivis, filigranes nominatifs) :

| | MEN, bâtiment (`jeu-donnees-men-travaux-faits.md`) | MTP, route (`jeu-donnees-mtp-routier-faits.md` §3) |
|---|---|---|
| **matériel** | 5 engins, **1 de chaque**, « propriété ou location justifiée » : bétonnière ≥ 350 l, camion ou camionnette ≥ 2,5 t, voiture de liaison 4×4, pervibrateur, groupe électrogène ≥ 3 kVA | **10 engins**, avec un **nombre** et un **minimum en propre** : camions bennes ≥ 10 000 kg, 6 dont au moins 4 en propre ; citerne à eau ≥ 5 000 l, 2 dont au moins 1 en propre ; 8 autres « en propre » (pelle, chargeuse, niveleuse, compacteurs lourd et léger, 2 bétonnières ≥ 500 l, 2 pervibrateurs, 4×4) |
| **personnel** | **par lot** : 1 conducteur de travaux (ingénieur BTP ou équivalent, 3 ans), 1 chef de chantier (technicien supérieur BTP, 3 ans) ; CV avec photo, diplôme certifié | conducteur de travaux (ingénieur BTP ou génie civil, **5 ans en travaux routiers**) ; chef de chantier (ingénieur ou TS, **3 ans en travaux routiers**) ; CV et diplôme certifié |

Les noms de propriétés, de ressources et de jetons ci-dessous sont des **propositions**, à votre main.

---

## B1 — Deux listes de la fiche, sur le modèle du besoin

### B1.1 — Les ressources

Comme `/articles` : des données de la version de fiche, figées à la validation, copiées à la révision, pour la
catégorie **TRAVAUX** seulement (409 hors travaux, comme `BESOIN_HORS_PERIMETRE`).

| Méthode | URL (proposée) | Corps | Réponse |
|---|---|---|---|
| GET | `/api/fiches-marche/{idDmc}/materiel` | — | `MaterielExigeDto[]`, dans l'ordre |
| PUT | `/api/fiches-marche/{idDmc}/materiel` | `{ "materiel": [MaterielExigeDto…] }` | toute la liste (remplacement ; l'ordre est la position) |
| GET | `/api/fiches-marche/{idDmc}/personnel` | — | `PersonnelExigeDto[]` |
| PUT | `/api/fiches-marche/{idDmc}/personnel` | `{ "personnel": [PersonnelExigeDto…] }` | toute la liste |

**Pas de lot dans l'adresse** : dans les deux DAO, les exigences sont les mêmes pour tous les lots. Le MEN dit « par
lot » pour signifier que **chaque** lot mobilise son équipe : c'est un drapeau de la ligne (`parLot`), pas une liste
par lot (H1).

### B1.2 — Une ligne de matériel

| propriété | type | MEN | MTP | règle |
|---|---|---|---|---|
| `designation` | texte ≤ 200 | « Bétonnière » | « Camions bennes » | obligatoire |
| `caracteristique` | texte ≤ 200, facultatif | « ≥ 350 l » | « ≥ 10 000 kg » | capacité, puissance… |
| `nombre` | entier ≥ 1 | 1 | 6 | obligatoire |
| `minimumEnPropre` | entier 0…`nombre`, facultatif | — | 4 | `null` = propriété ou location indifférente ; `= nombre` = tout en propre |
| `parLot` | booléen, défaut `false` | — | — | « par lot » : le nombre vaut pour chaque lot |

400 nominatifs (`materiel[i].nombre`…) : désignation manquante ou trop longue, nombre < 1, minimum hors de 0…nombre.

### B1.3 — Une ligne de personnel

| propriété | type | MEN | MTP | règle |
|---|---|---|---|---|
| `poste` | texte ≤ 200 | « Conducteur de travaux » | « Conducteur de travaux » | obligatoire |
| `nombre` | entier ≥ 1, défaut 1 | 1 | 1 | |
| `diplome` | texte ≤ 500, facultatif | « Ingénieur BTP ou équivalent (génie civil, industriel, rural, architecture) » | « Ingénieur BTP ou génie civil » | |
| `experienceAnnees` | entier ≥ 0, facultatif | 3 | 5 | |
| `domaineExperience` | texte ≤ 200, facultatif | — | « travaux routiers » | |
| `justificatifs` | texte ≤ 500, facultatif | « CV avec photo, diplôme certifié » | « CV et diplôme certifié » | |
| `parLot` | booléen, défaut `false` | `true` | — | |

### B1.4 — Où l'écran les saisit

Un bloc à rendu propre, comme `B12` : **proposé `B13` « Matériel et personnel exigés »**, avec `rendu = 'MOYENS'`, servi
au référentiel des travaux (les trois types de marché, comme le DQE). L'écran y montre les deux listes. Les champs
`B03-QT-09` et `B03-QT-13` restent dans `B03`, en complément.

---

## B2 — L'impression : deux jetons, une ligne par entrée

Le moteur sait déjà écrire une ligne par élément (`{{BESOIN.series}}`). Les jetons proposés :

- **`{{MOYENS.materiel}}`**, une ligne par engin :
  - avec un minimum : « - Camions bennes ≥ 10 000 kg : 6, dont au moins 4 en propre » ;
  - tout en propre : « - Niveleuse : 1, en propre » ;
  - sans minimum : « - Bétonnière ≥ 350 l : 1 » ;
  - par lot : « … : 1 par lot ».
- **`{{MOYENS.personnel}}`**, une ligne par poste : « - Conducteur de travaux (1) : ingénieur BTP ou génie civil ; au
  moins 5 ans d'expérience en travaux routiers ; justificatifs : CV et diplôme certifié ». Les morceaux absents
  disparaissent avec leur séparateur. Par lot : « (1 par lot) ».

Liste vide : pointillés, comme les autres jetons. C'est **le front** qui recopiera le DPAO-T (clause 6.3, (c) et (e)) :
la liste d'abord, puis le texte de `B03-QT-09` / `B03-QT-13` s'il est saisi. Je vous enverrai le modèle avec ses
conditions, une fois les noms des jetons fixés, et le texte soumis au pilote.

---

## B3 — Les contrôles

- **`MATERIEL_EXIGE`** (bloquant) : une fiche de travaux doit dire son matériel, par la liste **ou** par `B03-QT-09`.
  `B03-QT-09`, aujourd'hui obligatoire, devient **facultatif** (H2).
- **`PERSONNEL_CLE`** : aucun contrôle nouveau. `B03-QT-13` est facultatif, et la liste aussi.
- `B03-QT-10` (années d'expérience du directeur des travaux, (d) de la clause 6.3) **ne change pas** (H3).

---

## Hypothèses

- **H1** — Une seule liste par fiche, avec un drapeau `parLot` sur la ligne, plutôt qu'une liste par lot. Aucun des deux
  DAO n'a d'exigence propre à un lot.
- **H2** — `B03-QT-09` devient facultatif, remplacé par la règle `MATERIEL_EXIGE` (liste ou texte).
- **H3** — Le (d) « directeur de travaux ayant n ans » reste un champ à part. Au MTP, il recoupe le conducteur de travaux
  de la liste (5 ans), mais le document type en fait un critère distinct.

**Recette attendue** :
- **MTP** : les 10 engins avec nombres et minimums en propre, et les 2 postes avec leur domaine d'expérience. Le DPAO
  imprime les deux listes à la clause 6.3 (après la recopie du front). Un minimum supérieur au nombre donne un 400.
- **MEN** : 5 engins sans minimum, 2 postes `parLot`. Une fiche sans liste ni `B03-QT-09` est refusée par
  `MATERIEL_EXIGE`, et la révision copie les deux listes.
