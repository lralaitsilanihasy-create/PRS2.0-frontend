# Demande backend — Relever la limite de 500 caractères sur l'objet du marché (`designationMarche`)

**Date** : 2026-09-10 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote — en
créant un dossier depuis un PPM PDF de **contrat cadre**, `POST /api/saisies/ppm` échoue en **400** sur
l'**objet** de deux marchés.

## Constat

```
POST /api/saisies/ppm → 400 "Validation échouée"
erreurs: [
  { champ: "marches[5].designationMarche",  message: "size must be between 0 and 500" },
  { champ: "marches[14].designationMarche", message: "size must be between 0 and 500" }
]
```

Les objets fautifs sont ceux des marchés « CONTRAT CADRE » qui **portent l'énumération complète des lots
dans l'objet** (« … répartie en Onze (11) lots : Lot 1 : Cardio-vasculaire … Lot 11 : Consommable
Médical »). Ils dépassent la borne `@Size(max=500)` de `designationMarche`.

## Pourquoi c'est un conflit de règles (et pas une donnée à corriger)

Garder l'énumération des lots **dans l'objet** est une **décision produit explicite** du **2026-07-18**
(« désignation INTÉGRALE, doublon voulu ») : l'objet conserve la liste des lots **en plus** de `lots[]`.
Les objets longs sont donc **attendus**, pas des accidents de transcription. La borne `@Size(max=500)`
**contredit** cette décision : elle interdit de créer un dossier de contrat cadre un peu détaillé.

**Arbitrage pilote (2026-09-10)** : on **relève la limite** (on ne raccourcit pas l'objet).

## Demande

1. **Relever la limite de `designationMarche`** au-delà de 500 :
   - **de préférence `TEXT`** (contenu descriptif, sans plafond métier), ou à défaut un **VARCHAR
     généreux (≥ 2000)**.
   - À faire **des deux côtés** : la colonne SQL **et** l'annotation Bean Validation `@Size(max=…)` (sinon
     la validation continue de refuser même si la colonne accepte).
2. **Tous les chemins d'écriture** de `designationMarche` doivent bénéficier du relèvement (même colonne) :
   `POST /api/saisies/ppm`, `PUT /api/saisies/ppm/{id}`, la **mise à jour** (`…/mise-a-jour`) et la
   **rectification** — pas seulement la création.
3. **Ne concerne PAS** `t_lot.designationLot` (la désignation de LOT, plafonnée à 200) — c'est un autre
   champ, inchangé. Seul l'**objet du marché** est visé.

## Côté front — déjà en place

J'ai posé un **garde-fou miroir** (`OBJET_MARCHE_MAX`, commit `c1b54ff` puis ajusté) qui reflète la borne
serveur actuelle (500) : bouton « Créer » désactivé + repère inline sur la cellule + message, pour ne plus
laisser filer un 400 brut. **Dis-moi la valeur finale retenue** (2000 ? TEXT/illimité ?) : je **bumpe**
`OBJET_MARCHE_MAX` à cette valeur (ou je retire le garde si la colonne devient non bornée). Une seule
constante à changer.

## Recette de contre-vérification

1. Créer (ou importer) un PPM avec un marché dont l'objet fait **> 500 caractères** (ex. 800).
2. `POST /api/saisies/ppm` → **201** attendu (plus de 400 `designationMarche`).
3. Idem sur `PUT /api/saisies/ppm/{id}`, une mise à jour et une rectification portant un objet long.
4. Vérifier que l'objet est **persisté intégralement** (pas de troncature silencieuse).
