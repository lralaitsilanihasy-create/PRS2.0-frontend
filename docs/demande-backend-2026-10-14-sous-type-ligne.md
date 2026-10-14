# Demande backend — 2026-10-14 — le sous-type de dossier d'une ligne éligible

## Contexte (constat du pilote, 14/10)

Dans « Créer dossier », la PRMP choisit la famille « mise en concurrence », puis un **sous-type** (par exemple « Dossier
d'appel d'offres ouvert avec pré-qualification »), puis « Choisir la ligne du plan de passation ». La liste des lignes
(`GET /api/dmcs/eligibles`) proposait **toutes** les lignes éligibles, quel que soit leur sous-type. Or le sous-type du dossier
n'est pas celui que la PRMP a choisi : à la validation de la fiche, le serveur le **déduit de la ligne**
(`SousTypesDossier.dossierMiseEnConcurrence` : prestations intellectuelles → `DC` ; mode international → `DAOOI`/`DAORI` ;
avec pré-qualification → `DAOOPREQUAL` ; restreint → `DAOR` ; sinon `DAOO`). Choisir une ligne d'appel d'offres ouvert
après avoir choisi « avec pré-qualification » produisait donc, sans le dire, un dossier `DAOO`.

## B1 — Servir le sous-type de chaque ligne éligible

Sur chaque élément de `GET /api/dmcs/eligibles`, un champ **`sousType`** : le sous-type du dossier que la fiche de cette
ligne produira, calculé par **la même** règle que la validation (`SousTypesDossier.dossierMiseEnConcurrence`, mode de la
ligne et catégorie). Une seule source : le front ne doit pas tenir une copie de la règle.

## B2 — Filtrer par sous-type (facultatif)

`GET /api/dmcs/eligibles?sousType=DAOOPREQUAL` → les seules lignes de ce sous-type. Le front filtre aujourd'hui de son côté ;
le paramètre serveur n'est utile que si la liste devient longue.

## Hypothèses (à confirmer ou corriger)

- H1 — Le sous-type d'une ligne qui a déjà sa fiche (`dejaDao`) est celui de la règle à la date de la lecture, pas celui d'un
  dossier déjà produit (une fiche migrée ou une ligne dont le mode a changé dans une nouvelle version du plan peuvent
  différer : dans ce cas, dire lequel le champ porte).
- H2 — `DAO` (ancien code) n'est jamais servi : `DAOO` depuis la migration M1 (V94).

> ✅ **Front, 2026-10-14 — branché avec un repli** (vérifié par les tests et dans le navigateur) :
> - « Créer dossier » : l'encadré décrit **le sous-type choisi** (titre, mode ou nature que doit porter la ligne, raison,
>   documents que la fiche remplit) et le bouton transmet `?sousType=` à « Appels d'offres ».
> - « Appels d'offres » : avec `?sousType=`, seules les lignes de ce sous-type, sous un bandeau qui le nomme, avec « Voir
>   toutes les lignes éligibles » ; liste vide → message qui dit pourquoi et que la ligne se corrige dans le plan.
> - **Repli provisoire** : tant que `sousType` n'est pas servi, le front applique la règle du serveur au mode
>   (`libelleMode`) et à la catégorie de la ligne (`sousTypeDeLigne`, `models/fiche-marche.model.ts`). Dès que B1 est livré, le
>   champ servi l'emporte et la copie de la règle sera retirée.
