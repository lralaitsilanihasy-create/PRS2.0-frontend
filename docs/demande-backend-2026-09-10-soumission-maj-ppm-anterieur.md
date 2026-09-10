# Demande backend — Soumission d'une mise à jour bloquée : « PPM antérieur signé » manquant

**Date** : 2026-09-10 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : en montant le décor de
contre-recette de l'examen scopé (soumettre une mise à jour multi-lignes puis l'examiner), la **soumission**
d'une mise à jour échoue en **400**.

## Constat

`POST /api/dossiers/100312/soumettre` (100312 = mise à jour, parent 100308) →

```
400 Validation échouée
erreurs: [{ champ: "piecesJointes",
            message: "Le PPM daté et signé des versions antérieures est obligatoire pour une mise à jour." }]
```

Pièces jointes réelles de 100312 : **seulement le type 22** (`PV_PRECEDENT`, `PV-00001-…​.pdf`). **Aucune pièce
type 23 (`PPM_ANTERIEUR`)** n'est présente.

## Pourquoi c'est important (chemin critique)

La documentation (`docs/regles-gestion` versionnement) indique que ces pièces d'historique sont **constituées
automatiquement** et que **« la garde de soumission répare avant de contrôler — un brouillon ne doit pas se
retrouver à devoir fournir un document qu'il ne peut produire »**. Or ici la garde **refuse** au lieu de
réparer. Conséquence : **aucune mise à jour dans cet état ne peut être soumise**, donc **jamais dispatchée ni
examinée** — ce qui bloque de fait la fonctionnalité « examen scopé aux lignes changées » qu'on vient de livrer.

## Questions / demande

1. L'auto-génération du **`PPM_ANTERIEUR` (type 23)** à la soumission est-elle censée produire ce document
   pour TOUTE mise à jour ? Si oui, pourquoi échoue-t-elle pour 100312 (elle a bien produit le `PV_PRECEDENT`
   type 22, mais pas le type 23) ?
2. Dépend-elle d'un **PPM daté et signé de l'ancêtre 100308** ? Si l'ancêtre (dossier de test) n'a pas ce
   document source, comment une mise à jour d'un tel dossier peut-elle être soumise ? (Réparer = générer le
   document manquant depuis la chaîne, ou l'exigence doit-elle tomber quand la source n'existe pas ?)
3. Le cas se reproduira-t-il sur une mise à jour créée par le **flux normal** (import UI), ou est-ce spécifique
   aux dossiers montés par appel API direct (`POST /api/saisies/ppm/{id}/mise-a-jour`) sans génération
   ultérieure du document ?

## Ce que ça débloque côté front

Rien à livrer côté front : l'examen scopé est déjà livré (`3008b3b`) et vérifié (mock tous cas + non-régression
+ 181 tests). Une fois la soumission d'une mise à jour possible, je monte le décor (mise à jour multi-lignes
soumise → dispatchée à un Membre) et je fais la **contre-recette réelle end-to-end** du périmètre d'examen.
