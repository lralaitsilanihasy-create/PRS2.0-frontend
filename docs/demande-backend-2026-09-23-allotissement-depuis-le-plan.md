# Demande backend — L'allotissement se déduit du plan, il ne se redemande pas (lot 1d)

**Date** : 2026-09-23 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande du pilote, captures à
l'appui — « lorsque le nombre de lots du plan est 1, répondre automatiquement **non** (non modifiable) pour *Le
marché est-il alloti ?* ; si le nombre de lots du plan est supérieur à 1, répondre automatiquement **oui** (non
modifiable), avec le nombre de lots donné par les informations reprises du PPM ».

Suite directe de `demande-backend-2026-09-23-type-marche-depuis-le-plan.md` (lot 1c) : **même règle, même raison**.
Une donnée déjà décidée au plan de passation ne se resaisit pas dans la fiche, et surtout ne peut pas le contredire.

## Constat (mesuré sur la base locale le 23/09)

Le référentiel sert déjà le nombre de lots du plan : `B02-LV-01` « Nombre de lots du plan », source `PPM`,
`clePpm = NB_LOTS_PPM`. Il est renseigné sur toutes les lignes du plan de test. Or le cadrage **redemande**
l'allotissement, et rien n'empêche la réponse de contredire le plan :

| fiche | ligne | `B02-LV-01` (plan) | `cadrage.alloti` (enregistré) | |
|---|---|---|---|---|
| 1 | 302873 | 1 | `NON` | cohérent |
| 2 | 302874 | 1 | absent | à répondre |
| 3 | 302896 | **4** | **`NON`** | **contredit le plan** |

La fiche 3 porte une ligne dont la désignation annonce elle-même « répartie en quatre (04) lots », et elle est
cadrée en marché non alloti. Le DPAO généré au lot 2 décrirait donc un projet global là où le plan prévoit quatre
lots — exactement le genre d'écart que la fiche devait rendre impossible.

`cadrage.nbLots` n'est renseigné sur aucune des trois fiches, alors que `B02-LV-01` et `B02-LV-02` (désignation des
lots) portent déjà l'information : c'est une double saisie qui ne sert qu'à diverger.

## Demande

### B1 — `alloti` et `nbLots` deviennent des données reprises, plus des réponses

- **Dérivés de `NB_LOTS_PPM`** de la ligne courante de la filiation, à chaque lecture, comme `typeMarche` au lot 1c :
  - `NB_LOTS_PPM = 1` → `alloti = NON`, `nbLots` absent ;
  - `NB_LOTS_PPM ≥ 2` → `alloti = OUI`, `nbLots = NB_LOTS_PPM`.
- **Le cadrage cesse de les porter** : les clés `alloti` et `nbLots` sont **ignorées** si le front les envoie encore
  (tolérance d'une version, comme pour `typeMarche`), et `cadrageComplet` ne les attend plus — **sept questions** au
  lieu de neuf en quantité fixe.
- **Ligne sans nombre de lots**, ou valeur non entière : rien n'est dérivé, la question **reste posée** comme
  aujourd'hui. On ne devine rien d'un plan incomplet, et on ne bloque pas une fiche pour autant.
- `B02-LV-04` « Marché alloti » et `B02-LV-05` « Nombre de lots » sont aujourd'hui de source `CADRAGE`. Ils doivent
  continuer à servir la même valeur, désormais dérivée — le plus simple est de les passer en source `PPM`, sur
  `NB_LOTS_PPM`, et de laisser `B02-LV-01` inchangé.

### B2 — Les fiches déjà cadrées à contresens

Sur DBPRS20, **une seule** fiche est concernée (DMC 3, cadrée `NON` contre un plan à 4 lots), et elle est en
brouillon. Aucune reprise de données n'est demandée : la valeur dérivée s'impose à la lecture suivante.

Si une **version validée** portait un allotissement contraire au plan, elle reste telle quelle — c'est un
enregistrement figé. Le signalement se fait comme `typeChange` au lot 1c : un booléen `allotiChange` sur le DTO,
vrai quand l'allotissement figé de la version diffère de celui que le plan donne aujourd'hui.

## Options écartées

- **Contrôler au lieu de dériver.** Un contrôle bloquant de plus, à lever à la main, pour une information que le
  serveur connaît déjà : c'est la double saisie avec une étape en plus.
- **Dériver seulement quand le cadrage est muet.** La fiche 3 montre le cas qui compte : une réponse déjà
  enregistrée, et fausse. Dériver à chaque lecture est la seule règle qui ne laisse pas d'écart s'installer.
- **Laisser le front imposer seul.** C'est ce qui est livré en attendant (voir ci-dessous), mais l'écran n'est pas
  une garde : un autre client, ou un appel direct, enregistrerait toujours un allotissement contraire au plan.

## Tests attendus (recette backend)

1. Ligne à 1 lot → `cadrage.alloti = NON`, pas de `nbLots`, quelle que soit la valeur enregistrée avant.
2. Ligne à 4 lots → `alloti = OUI`, `nbLots = 4`.
3. `PUT …/cadrage` envoyant `alloti` et `nbLots` → les clés sont ignorées, la lecture suivante sert les valeurs
   dérivées, et la requête n'échoue pas.
4. `cadrageComplet` vrai sans que `alloti` ni `nbLots` aient été répondus.
5. Ligne sans `NB_LOTS_PPM` → rien n'est dérivé, la question reste posée, la fiche reste enregistrable.
6. Version validée à contresens du plan → `allotiChange = true`, le cadrage figé est servi tel quel.

## Côté front (déjà livré, contre ce contrat)

En attendant la livraison, l'écran **impose déjà** la réponse du plan : la question reste affichée, la réponse est
celle du plan, les deux choix sont inertes, le nombre de lots est repris et non saisissable, et une mention
« repris du plan de passation » en donne l'origine. Quand le cadrage enregistré contredit le plan, un bandeau le dit
et invite à réenregistrer. Une fiche **validée** n'est jamais réécrite : ce qui a été figé reste affiché.

Recette navigateur verte sur les deux cas réels (fiche 2 à 1 lot, fiche 3 à 4 lots).

À la livraison, le front cessera d'envoyer `alloti` et `nbLots`, et la question quittera le cadrage pour rejoindre
les informations reprises — exactement comme le type de marché au lot 1c.
