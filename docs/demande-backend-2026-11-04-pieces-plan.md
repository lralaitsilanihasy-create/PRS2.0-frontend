# Demande backend — 2026-11-04 — Pièces d'un plan de passation : ne plus proposer ce que l'application produit

## Contexte

Sur un brouillon de plan (constat du pilote sur le plan de la JIRAMA, 40 lignes), l'onglet « Pièces jointes » liste six « pièces
exigées pour soumettre », toutes facultatives. Le pilote a demandé s'il fallait encore les joindre : aucune n'est utile, et leur
présence laisse croire le contraire. Le pilote a choisi de les retirer **à la source** (le référentiel ou sa résolution), pas par
un filtre de l'écran.

Lu le 04/11, en lecture seule (ADMIN01) : `GET /api/type-piece-jointes?sousType=PPM` et `?sousType=PPM-AGPM` servent la même liste
de famille `DDP`, et `GET /api/dossiers/100390/pieces-exigees` la reprend telle quelle, sans `fourniePar` :

| Type | Code | Libellé | Pourquoi la PRMP n'a rien à joindre |
|---|---|---|---|
| 2 | — | Fiche de présentation | Calculée des lignes du plan (onglet « Fiche de présentation »). |
| 1 | — | Projet de Plan de passation des marchés | C'est le plan saisi lui-même (onglet « Plan de passation »). |
| 21 | `AGPM` | Avis Général de Passation de Marché | Le projet d'AGPM est dérivé du plan et examiné avec sa grille ; la pièce n'est plus exigée depuis l'arbitrage du 03/09. |
| 5 | — | Journal de publication de l'AGPM | N'existe pas avant l'avis de la Commission ; depuis V118 (15/10) il se dépose une fois sur le plan validé (`publication-agpm`). |
| 22 | `PV_PRECEDENT` | PV du dossier précédent | Mise à jour seulement ; constitué par l'application, jamais déposé par la PRMP (règles de gestion, « on n'exige que ce que l'application détient »). |
| 23 | `PPM_ANTERIEUR` | PPM antérieur daté et signé | Même cas ; l'historique se lit par `/versions`, `/versions-archivees`, `/diff`. |

## B1 — La liste d'un plan ne propose plus ces six pièces

Sur `GET /api/dossiers/{id}/pieces-exigees` d'un dossier `DDP` (et la liste de sous-type `PPM` / `PPM-AGPM`), ces six types ne
figurent plus parmi les pièces à joindre. La forme est à votre choix, dites-nous laquelle :

- **(a)** les détacher de la liste du plan (référentiel ou résolution), pour 2, 1, 21 et 5 ; pour 22 et 23, ne plus les servir à la
  PRMP, puisque la garde de soumission d'une version les constitue elle-même ;
- **(b)** les garder listées avec `fourniePar: "APPLICATION"` (le mécanisme du 17/10 pour la mise en concurrence), avec un `lien`
  quand il existe. Le front les affiche alors « fournie par l'application », sans bouton « Joindre ».

Le front préfère **(a)** pour 5 (rien n'existe à la soumission) et accepte l'une ou l'autre pour les autres.

**À préserver** :
- les pièces déjà jointes à des plans existants restent lisibles (aucune suppression de type ni de pièce) ;
- la garde des versions (types 22 et 23, reconstitués avant contrôle) ne change pas ;
- le type 1 est la source du « PPM antérieur » quand un ancêtre le porte : s'il n'est plus proposé, plus aucun plan ne le portera ;
  l'exigence du PPM antérieur tombe alors toujours, comme aujourd'hui pour tous les dossiers du pilote. Signalez-nous si cela vous
  paraît devoir rester ouvert ;
- la PRMP garde la possibilité de joindre un document complémentaire (« Tout autre document »), si la famille l'a.

## Ce que fait le front

Rien tant que la liste ne change pas : l'écran affiche ce que `pieces-exigees` sert. Avec (b), il affiche déjà « fournie par
l'application » pour les pièces qui portent `fourniePar`.

> ⚠️ **2026-11-04 — B1 livré (PRS20, V164), forme (a) pour les six pièces.**
> - **Forme (a)** : la migration V164 détache les types 1, 2, 5, 21, 22 et 23 de la famille DDP (`ID_TYPE_DOSSIER` nul, comme la
>   bibliothèque des pièces du manuel). `GET /api/type-piece-jointes?sousType=PPM` / `PPM-AGPM` et `GET /api/dossiers/{id}/pieces-exigees`
>   d'un plan ne les servent plus.
> - **La liste d'un plan est désormais vide** : la famille DDP ne portait que ces six pièces.
> - **Rien n'est supprimé** : les types restent, et les pièces déjà jointes restent lisibles. La garde des versions écrit toujours les
>   pièces 22 et 23 par leur identifiant ; son contrôle ne change pas.
> - **Type 1, source du PPM antérieur** : plus aucun plan ne portera de « Projet de PPM » joint, donc le PPM antérieur ne sera jamais
>   exigé, comme aujourd'hui pour tous les dossiers du pilote. Rien à garder ouvert de notre côté.
> - **Écart — document complémentaire** : la famille DDP n'a **pas** de « Tout autre document » (`AUTRE_DOCUMENT` n'existe que dans les
>   listes par sous-type, V130). Un plan n'offre donc plus aucun dépôt de pièce. Dites-nous si le pilote veut ce dépôt sur un plan.
> - **Vérification** : la base de test n'a pas les identifiants 1 à 23 de la recette ; la migration, gardée par la famille DDP, ne s'y
>   applique pas. Je la vérifierai en recette après la livraison.