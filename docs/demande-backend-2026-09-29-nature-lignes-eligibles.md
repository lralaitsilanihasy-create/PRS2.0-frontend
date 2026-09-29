# Demande backend — la nature de la ligne dans `GET /api/dmcs/eligibles`

**Date** : 2026-09-29 · **Émetteur** : front · **Origine** : demande du pilote sur l'écran « Fiche DAO — choisir la
ligne du plan de passation » : colonne **Nature** après la référence du dossier, et « Ligne de marché » renommée
« Objet du marché » (fait côté front).

## B1 — Deux champs de plus dans `LigneEligibleDto`

| Champ | Type | Source |
|---|---|---|
| `idNature` | `Integer`, `null` si la ligne n'en a pas | `t_marche.ID_NATURE` |
| `libelleNature` | `String`, `null` si la ligne n'en a pas | `t_nature.libelle` |

Le serveur lit déjà la nature de chaque ligne pour en déduire `categorie` (lot 5) : les deux champs viennent de la même
lecture, **sans requête de plus par ligne**.

La catégorie ne suffit pas à l'écran : « Services » et « Fournitures » sont deux natures d'une même catégorie
(`FOURNITURES_SERVICES`), et c'est la nature du plan que la PRMP veut lire.

## Côté front (déjà fait)

`LigneEligible` porte `idNature?` et `libelleNature?` (facultatifs). La colonne affiche `libelleNature`, et « — » tant
que le champ n'est pas servi.

## Ce que le backend rend

Le commit, le test (une ligne de nature « Services » rend `libelleNature = "Services"`, une ligne sans nature rend
`null`), `docs/api-endpoints.md` à jour, et un encadré ⚠️ daté ici pour tout écart.
