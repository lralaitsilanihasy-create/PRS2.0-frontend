# Demande backend — 2026-11-04 — Plan de passation : « Tout autre document » à joindre

## Contexte

Depuis V164 (demande `demande-backend-2026-11-04-pieces-plan.md`, livrée), la liste des pièces d'un plan est vide : la famille DDP
ne portait que les six pièces détachées. Le backend a signalé l'écart : la famille DDP n'a pas de « Tout autre document »
(`AUTRE_DOCUMENT`, V130), qui n'est ajouté qu'aux listes **par sous-type** (`t_piece_sous_type`). Les sous-types `PPM` et
`PPM-AGPM` n'ont pas de liste propre, donc ils n'en ont pas hérité. Résultat : la PRMP ne peut plus joindre aucun document à un plan.

Le pilote a tranché (04/11) : **la PRMP doit pouvoir joindre un document complémentaire à un plan.**

Lu le 04/11, en lecture seule (ADMIN01) : `GET /api/dossiers/100404/pieces-exigees` et `GET /api/dossiers/100390/pieces-exigees`
renvoient `[]`.

## B1 — `AUTRE_DOCUMENT` proposé sur un plan (DDP, sous-types `PPM` et `PPM-AGPM`)

`GET /api/dossiers/{id}/pieces-exigees` d'un plan (et `GET /api/type-piece-jointes?sousType=PPM` / `PPM-AGPM`) sert le type
`AUTRE_DOCUMENT` comme il le sert ailleurs depuis V130 :
- facultatif (`obligatoire: false`), sans condition ;
- plusieurs fichiers admis, le nom du fichier tient lieu d'intitulé.

La forme est à votre choix : rattachement au sous-type (`t_piece_sous_type` pour `PPM` et `PPM-AGPM`), ou une autre résolution.
Dites-nous laquelle.

**À préserver** :
- rien d'autre ne revient dans la liste d'un plan : les six types détachés par V164 restent détachés ;
- la soumission d'un plan sans aucune pièce jointe reste possible (le document est facultatif) ;
- si le rattachement passe par `t_piece_sous_type`, vérifier que la liste du sous-type ne **remplace** pas la famille d'une façon
  qui ferait revenir ou disparaître autre chose (aujourd'hui la famille est vide, mais la règle doit rester juste si elle change).

## Ce que fait le front

Rien : l'onglet « Pièces jointes » affiche ce que `pieces-exigees` sert, avec son bouton « Joindre », comme sur les autres dossiers.

> ⚠️ **2026-11-04 — B1 livré (PRS20, V165), sans écart ; forme : `t_piece_sous_type`.**
> - **Forme** : la migration V165 donne aux sous-types `PPM` et `PPM-AGPM` une liste propre d'une seule pièce, `AUTRE_DOCUMENT` (V130),
>   facultative, sans condition, rang 1. Le dépôt de plusieurs fichiers de ce type était déjà admis.
> - **Rien ne revient, rien ne disparaît** : depuis V164, la famille DDP ne porte plus aucune pièce, donc la liste du sous-type ne masque
>   rien, et les six types détachés le restent. Un plan sans pièce reste soumissible : la pièce n'est pas obligatoire.
> - **Lecture** : `GET /api/type-piece-jointes?sousType=PPM` / `PPM-AGPM` et `GET /api/dossiers/{id}/pieces-exigees` d'un plan servent
>   désormais `[AUTRE_DOCUMENT]`, `obligatoire = false`.