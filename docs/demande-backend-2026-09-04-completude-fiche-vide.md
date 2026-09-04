# Demande backend — Complétude d'examen : « on ne contrôle pas le vide »

**Date** : 2026-09-04 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote

> « S'il n'y a pas de contenu dans un onglet, sauter le contrôle car on ne contrôle pas le vide. »

## Contexte

Le front vient de SAUTER l'étape « grille de la fiche de présentation » (resp. AGPM) quand le
document dérivé est **vide** — fiche sans marché dérogatoire, ni délai aménagé, ni contrat-cadre
(`nbMarchesConcernes = 0`) ; AGPM sans ligne. Le document reste consultable dans son onglet, mais
aucun point FICHE/AGPM n'est statué.

Or `ExamenService.validerCompletude` exige **inconditionnellement** une évaluation de chaque point
non-LIGNE de la grille effective : la soumission d'un examen de dossier à fiche vide répond
désormais **400 « grille »** alors qu'il n'y a rien à contrôler.

## Demande

Dans `validerCompletude` : ne pas exiger les points de portée **FICHE** quand la fiche n'a pas de
contenu — même dérivation que le document : parmi les marchés **non supprimés** du dossier, aucun
en **mode dérogatoire**, aucun à **délais aménagés**, aucun **contrat-cadre** (les trois listes de
la fiche vides). Par symétrie, ne pas exiger les points **AGPM** si l'AGPM n'a aucune ligne (cas
théorique : le sous-type PPM-AGPM implique ≥1 ligne en AO ouvert — garde de cohérence, pas de
comportement attendu différent).

Les évaluations FICHE/AGPM **excédentaires** (statuées avant que la fiche ne se vide par mise à
jour, ou par un brouillon antérieur) restent acceptées — seule l'EXIGENCE tombe.

## Tests attendus

1. Dossier PPM dont la fiche est vide (aucun dérogatoire/délai/contrat-cadre) : soumission d'examen
   **sans** évaluation FICHE → acceptée (plus de 400 « grille »).
2. Dossier avec ≥1 marché dérogatoire : soumission sans évaluation FICHE → **400** (anti-régression).
3. Dossier PPM-AGPM : points AGPM toujours exigés (l'AGPM a du contenu par construction).
