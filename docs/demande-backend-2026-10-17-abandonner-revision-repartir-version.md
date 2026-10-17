# Demande backend — 2026-10-17 — Abandonner une révision, ou repartir d'une version antérieure de la fiche

## Contexte

Sur la fiche des consomptibles informatiques (ligne 303339), le pilote a ouvert une révision (`POST …/reviser`), qui a donné un
brouillon de **version 5**. Il demande alors : *« et si on ne veut pas la nouvelle version, mais plutôt la version précédente ? »*

Aujourd'hui, l'application ne sait ni **abandonner** une révision ouverte, ni **repartir** d'une version figée autre que la
dernière :
- `POST …/reviser` ouvre toujours un brouillon copié de la **dernière** version validée ;
- aucune route n'abandonne ce brouillon, et la fiche ne se supprime pas (`DELETE` répond 405) ;
- la seule issue est de **valider le brouillon tel quel**, ce qui donne une version identique avec un numéro de plus. C'est ce
  que le front a fait sur la fiche 303339, après avoir vérifié que la v5 était identique à la v4 (valeurs, cadrage, 12 articles).
- Repartir de la v2, par exemple, oblige à **ressaisir à la main** tout ce qui a changé depuis.

Un brouillon de révision ouvert ne gêne pas le dossier : c'est la dernière version **validée** qui fournit ses pièces. Il
encombre pourtant l'historique et laisse la fiche « en brouillon » sans raison.

## B1 — Abandonner la révision

`DELETE /{idDmc}/revision`, ou une route au choix du backend, sur une fiche dont la version courante est un **brouillon de
révision** (numéro > 1, une version validée existe) :
- **supprime le brouillon** : valeurs, cadrage, besoin, listes (matériel, personnel, pièces, sous-critères), PDF déposé ;
- **la fiche revient à sa dernière version validée** (statut `VALIDEE`) ;
- **ne crée aucune version** : les versions figées ne bougent pas ;
- journal du dossier : « révision de la version n abandonnée » ;
- **refus nommés** :
  - **409 `PAS_DE_REVISION`** si la version courante est validée ;
  - **409 `PREMIERE_VERSION`** si la fiche n'a jamais été validée (le brouillon initial ne s'abandonne pas ainsi).
- **Droits** : ceux de `reviser`, soit la PRMP et l'UGPM de tutelle.

## B2 — Repartir d'une version antérieure

`POST /{idDmc}/reviser?depuis={n}` (sans `depuis`, comportement actuel) ouvre une révision **copiée de la version figée n**, au
lieu de la dernière :
- **même copie que la révision actuelle**, mais depuis la version n : valeurs, cadrage, besoin et ses prix estimés, listes, PDF
  déposé ;
- le brouillon prend le **numéro suivant** (la dernière + 1). On ne revient jamais en arrière : on crée une version au contenu de
  l'ancienne, et l'historique n'est jamais réécrit. C'est la règle déjà suivie par les plans de passation (une mise à jour est
  toujours une nouvelle version) ;
- le brouillon est **contrôlé comme tout brouillon** à la validation (bilan, estimation au montant du plan, mode de remise figé
  R8). La version n a pu être validée sous un référentiel différent : les écarts sont signalés comme pour une révision ordinaire
  (V46, valeurs que plus aucune cellule ne porte) ;
- journal : « révision ouverte depuis la version n » ;
- **refus nommés** :
  - **404** si la version n n'existe pas ou n'est pas validée ;
  - **409 `REVISION_OUVERTE`** si un brouillon de révision existe déjà. Il faut alors l'abandonner (B1) d'abord.

## Q1 — Le mode de remise figé (R8)

Si la version n a un autre mode de remise que la dernière, le mode figé l'emporte (règle R8) et la copie prend le mode figé.
**Le front le suppose. Le backend confirme-t-il ?**

## Ce que le front fera, dès la livraison

- **Étape 6** (« Validation PRMP ») d'une fiche en révision : un bouton « Abandonner cette révision », avec une confirmation qui
  dit « la fiche revient à la version n ».
- **Liste des versions figées** : un bouton « Repartir de cette version » sur chaque ligne, sauf la dernière, qui équivaut à la
  révision ordinaire.
- Recette sur la fiche 303339 : ouvrir une révision puis l'abandonner (la fiche reste en v5, validée) ; repartir de la v1, qui
  donnera une v6 au contenu de la v1, puis valider.
