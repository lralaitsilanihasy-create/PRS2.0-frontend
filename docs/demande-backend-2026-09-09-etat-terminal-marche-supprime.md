# Demande backend — État TERMINAL obligatoire pour un marché supprimé (CPO / Achat Direct)

**Date** : 2026-09-09 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : règle pilote — à la mise à
jour d'un PPM, un marché **supprimé** de certains modes doit porter un **état de marché terminal** avant que
la mise à jour ne soit créée. Le front pose déjà la garde (bloque « Créer la mise à jour ») ; on demande la
**même garde côté serveur** (défense en profondeur, un appel direct ne doit pas passer).

## Règle

À la **création d'une mise à jour** (soumission d'un dossier version — le geste « Créer la mise à jour »,
`POST /api/dossiers/{id}/soumettre` pour un dossier à `idDossierParent`), **refuser (400)** s'il existe au
moins un marché **supprimé** (`t_marche.SUPPRIMEE = true`) **dont le mode de passation** est
**« Consultation des Prix Ouverte »** ou **« Achat Direct »** **et** dont le **statut** (`t_marche.STATUT`)
vaut **`PREVU`** (ou est nul).

- Autrement dit : un tel marché doit porter un **code de statut ≠ `PREVU`** (un état terminal du référentiel
  `/api/statut-marches` : Attribué, Annulé, …).
- Le **libellé exact** des deux modes visés (référentiel `mode-passations`) : `Consultation des Prix Ouverte`
  (idMode 4 en base actuelle) et `Achat Direct` (idMode 5). ⚠️ La variante `CONSULTATION DE PRIX OUVERTE PIP`
  (idMode 8) est **hors périmètre** (libellé différent). À vous de choisir la clé de comparaison la plus
  robuste (id, code, ou libellé normalisé) — le front compare par **libellé normalisé** faute de code sur le
  mode.
- Message d'erreur explicite (affiché en dialogue côté front), nommant les marchés concernés si possible.

## Côté front — déjà en place

Écran de mise à jour (`mise-a-jour-ppm`) : panneau **« État des marchés supprimés — obligatoire »** listant
les marchés supprimés en CPO / Achat Direct, avec une liste déroulante des états **terminaux** du référentiel
(`PREVU` exclu, placeholder « — À renseigner — »). L'état est écrit sur le marché (`PUT /api/marches/{id}`,
`statut`) via le bouton « Enregistrer », et « Créer la mise à jour » est **bloqué** tant qu'un marché concerné
n'a pas d'état terminal enregistré. La garde serveur reste l'autorité (le bouton n'est qu'un garde-fou d'UI).

## Contre-recette attendue (backend)

1. Mise à jour avec un marché **supprimé** en « Consultation des Prix Ouverte », `STATUT = PREVU` →
   `POST …/soumettre` **400** (message explicite), rien de créé.
2. Même marché avec `STATUT = ANNULE` (ou tout code ≠ PREVU) → soumission **200/201**.
3. Marché supprimé d'un **autre mode** (ex. Appel d'offres ouvert) avec `STATUT = PREVU` → **pas** de blocage
   (hors périmètre).
4. Marché **non supprimé** en CPO avec `STATUT = PREVU` → **pas** de blocage.
