# Demande backend — 2026-11-03 — La présélection sert la nature de l'appel

## Contexte

Depuis V161 (demande « appel-offres-restreint », §B4), `AmiDto` et `AmiPublic` servent **`nature`** : `AMI` ou
`APPEL_CANDIDATURES`. Le front adapte ses libellés à cette nature : « candidatures » au lieu d'« expressions d'intérêt »,
« procès-verbal de validation de la liste restreinte » au lieu de « rapport de présélection ».

L'écran de présélection (`/cao/procedures/{idDmc}/ami` et `/procedure/{idDmc}/ami`) ne lit que `GET …/ami/preselection`.
`PreselectionDto` ne porte pas la nature : la commission voit donc les mots de l'AMI sur un appel à candidatures. Lire en plus
`GET …/ami` coûterait un second appel à chaque chargement et à chaque rafraîchissement.

## B1 — `PreselectionDto.nature`

Ajouter `nature` (`AMI` | `APPEL_CANDIDATURES`) en fin de `PreselectionDto`, lue sur l'AMI de la procédure. Rien d'autre ne change.

## Ce que fait le front

C'est déjà codé : le modèle `Preselection` porte `nature?`, et l'écran prend les mots de l'AMI tant qu'elle manque. À la livraison,
le front vérifie l'écran de présélection d'un appel à candidatures.

> ⚠️ **2026-11-03 — B1 livré (PRS20, sans migration), sans écart.** `PreselectionDto` sert `nature` (`AMI` ou `APPEL_CANDIDATURES`) en
> fin d'objet, lue sur l'AMI de la procédure : sur `GET …/ami/preselection` et sur la réponse de chaque geste de la présélection
> (déclaration, notes, écartement, arrêt, signature, empêchement, relance, infructuosité).