# Signalement backend — Le journal attribue la CRÉATION à la PRMP au lieu de l'UGPM créatrice

**Date** : 2026-09-08 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote — un
dossier **créé par une UGPM** puis **soumis par la PRMP** apparaît dans le journal des actions avec la
CRÉATION attribuée à la **PRMP**, pas à l'UGPM.

## Constat (dossier #100305)

Le `DossierDto` porte la bonne donnée :

```json
{
  "idDossier": 100305,
  "creePar": "UGPM002", "creeParNom": "RALAITSILANIHASY Lantonirina Annick",   // l'UGPM
  "soumisPar": "PRMP001", "soumisParNom": "Randrianarivo La Personne",          // la PRMP
  "idPrmp": "IMP001"
}
```

Mais `GET /api/dossiers/100305/journal` dérive :

```
CREATION    nomOperateur = "La Personne Randrianarivo"  (idPrmpOperateur = IMP001)   ← la PRMP, FAUX
SOUMISSION  nomOperateur = "La Personne Randrianarivo"                               ← la PRMP, correct
RECEPTION   nomOperateur = "Secretaire ANT Rasoa"                                     ← correct
```

La **CRÉATION** est attribuée à la **PRMP** (via `idPrmp`/l'attribution PRMP), alors que le dossier a
été **créé par l'UGPM** (`creePar = UGPM002`). La SOUMISSION, elle, est correctement rattachée à
`soumisPar` (la PRMP).

## Demande

Dans la dérivation du journal (fusion à la lecture), l'événement **`CREATION`** doit prendre son
opérateur dans **`creePar` / `creeParNom`** (le créateur réel — l'UGPM quand c'est elle qui a saisi le
brouillon), **pas** dans l'attribution PRMP du dossier. La donnée existe déjà sur le dossier
(`creePar`/`creeParNom`), il s'agit juste de l'utiliser pour cette ligne.

- `SOUMISSION` reste sur `soumisPar`/`soumisParNom` (déjà correct).
- Rétroactif comme le reste de la fusion (les dossiers déjà créés par une UGPM doivent se corriger à
  la relecture).
- Visibilité : la création reste un acte de rang 0 (visible de tous), qu'elle soit d'une PRMP ou
  d'une UGPM.

## Côté front — rien à changer

Le front affiche `nomOperateur` tel que servi par le journal (colonne « Opérateur »). Dès que la
dérivation renseigne le créateur réel, la colonne affichera l'UGPM sans adaptation.

## Recette de contre-vérification

1. UGPM crée un dossier (login UGPM) puis la PRMP le soumet.
2. `GET /dossiers/{id}/journal` : la ligne `CREATION` doit porter `nomOperateur` = **le nom de l'UGPM**
   (`creeParNom`), et `SOUMISSION` = le nom de la PRMP (`soumisParNom`).
