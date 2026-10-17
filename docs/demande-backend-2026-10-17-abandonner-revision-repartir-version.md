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

> ⚠️ **2026-10-17, livré côté backend (B1)**, route **`DELETE /{idDmc}/revision`**. Elle rend le `FicheMarcheDto` de la dernière
> version validée.
> - **La suppression** : le brouillon part avec tout ce qu'il porte. Toutes les tables rattachées à une version sont en `ON DELETE
>   CASCADE`, et un brouillon n'a encore aucun document.
> - **Le journal du plan** : `FICHE_REVISION_ABANDONNEE`, « DAO, révision de la version m abandonnée : la fiche revient à la version
>   n ».
> - **Les refus** : 409 `PAS_DE_REVISION` et `PREMIERE_VERSION` comme demandé, plus un refus nouveau :
>   - **409 `MODE_MIGRE`** : un brouillon qui porte une migration documentée du mode de remise (R8, acte de l'Administrateur) ne
>     s'abandonne pas, pour ne pas effacer cette trace. Il se valide.
> - **Les droits** : ceux de la révision (PRMP, UGPM, et l'Administrateur comme pour toute écriture de la fiche).
> - **À noter** : la règle du 26/09 (« une fiche qui a de l'histoire ne s'abandonne pas ») est inchangée. Elle visait la fiche
>   entière, pas un brouillon de révision.

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

> ⚠️ **2026-10-17, livré côté backend (B2)**, au contrat demandé : **`POST /{idDmc}/reviser?depuis={n}`**.
> - **La copie** : celle de la révision ordinaire, faite depuis la version n. Ce sont les valeurs que le référentiel admet encore, le
>   cadrage, le besoin avec ses prix estimés, le matériel, le personnel, les pièces, les sous-critères et le fichier de
>   spécifications admis par la catégorie.
> - **Le numéro** : dernière + 1.
> - **Le journal du plan** : `FICHE_REVISION_OUVERTE`, « DAO, révision ouverte depuis la version n : version m en brouillon ».
>   Une révision ordinaire, sans `depuis`, ne journalise rien, comme avant.
> - **Les refus** :
>   - 404 si n est inconnue ou non validée ;
>   - 409 `REVISION_OUVERTE` si un brouillon existe déjà ;
>   - les refus habituels de la révision restent : `DOSSIER_EN_EXAMEN`, mandat, forme outillée.
> - **Les types de journal** `FICHE_REVISION_OUVERTE` et `FICHE_REVISION_ABANDONNEE` sont nouveaux. Le front leur donne un libellé
>   s'il en tient une liste.

## Q1 — Le mode de remise figé (R8)

Si la version n a un autre mode de remise que la dernière, le mode figé l'emporte (règle R8) et la copie prend le mode figé.
**Le front le suppose. Le backend confirme-t-il ?**

> ⚠️ **2026-10-17, réponse du backend à Q1 : oui, confirmé et appliqué.**
> - **Le mode figé** : c'est celui de la dernière version qui porte une migration documentée, sinon celui de la dernière version
>   validée (`modeFige`).
> - **La copie** : si la version n en a un autre, la copie prend le mode figé. Sans cela, la validation du brouillon serait refusée
>   (409 `MODE_FIGE`).
> - **Le test** : `DaoCompletIntegrationTest.abandonnerEtRepartir` (v1, v2 qui diffère, v3 depuis la v1, abandon vers la v2, refus,
>   journal).

## Ce que le front fera, dès la livraison

- **Étape 6** (« Validation PRMP ») d'une fiche en révision : un bouton « Abandonner cette révision », avec une confirmation qui
  dit « la fiche revient à la version n ».
- **Liste des versions figées** : un bouton « Repartir de cette version » sur chaque ligne, sauf la dernière, qui équivaut à la
  révision ordinaire.
- Recette sur la fiche 303339 : ouvrir une révision puis l'abandonner (la fiche reste en v5, validée) ; repartir de la v1, qui
  donnera une v6 au contenu de la v1, puis valider.

## Recette du front, 17/10 (backend 73fbafc, JAR redémarré)

Fiche 303339 (DMC 1), au départ en v5 validée, sans changer son état final :
- `POST …/reviser?depuis=1` : 200, brouillon **v6**, **aucun écart** de valeurs avec la v1. Les prescriptions générales de la v4 et
  de la v5 sont absentes, comme en v1 ;
- une seconde révision est refusée (409 `BROUILLON_EN_COURS`) ;
- `DELETE …/revision` : 200, la fiche revient en **v5 validée**. Les prescriptions générales y sont, et les versions restent 1 à 5 ;
- un second abandon est refusé (409 `PAS_DE_REVISION`).

**Front** :
- service `reviser(id, depuis?)` et `abandonnerRevision(id)` ;
- à l'étape 6, sur la liste des versions figées : « Repartir de cette version » sur chaque ligne sauf la dernière (vérifié à
  l'écran sur les versions 1 à 4) ;
- sur un brouillon de révision : « Abandonner cette révision », avec une confirmation qui dit « la fiche revient à la version n » ;
- un refus du serveur s'affiche avec son message (`MODE_MIGRE`, `PAS_DE_REVISION`).

1 320 tests verts, lint propre. Le front ne tient pas de liste de libellés du journal : rien à ajouter pour
`FICHE_REVISION_OUVERTE` et `FICHE_REVISION_ABANDONNEE`.
