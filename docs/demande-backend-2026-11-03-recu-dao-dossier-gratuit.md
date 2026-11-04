# Demande backend — 2026-11-03 — Dossier gratuit : le reçu des frais de dossier n'est plus exigé dans l'offre

## Contexte

Le jeu de recette des routes de Maintirano (ligne 303392, DAO 00002/DAOO/CNM/2026) porte sur un appel d'offres ouvert en
remise électronique. Aucun frais de dossier n'est renseigné : le dossier est **gratuit**. Le retrait passe donc sans reçu
(`PROCEDURE_FERMEE`, « gratuit », sur le dépôt d'un reçu).

Pourtant, `GET /api/procedures-en-ligne/{idDmc}/pieces` sert la pièce `RECU-DAO` (« Reçu du paiement des frais de dossier »)
avec `obligatoire: true`. Le formulaire d'offre la demande comme toute pièce obligatoire. Les trois candidats ont dû joindre
une pièce de recette qui disait « dossier gratuit, sans frais » pour pouvoir sceller leur offre. Un vrai candidat ne
saurait pas quoi joindre.

Cela vient de `ProceduresEnLigneService.attendues` :

```java
boolean payant = l.dto().retraitPayant();
…
out.add(new PieceAttendue("RECU-DAO", …, !payant, null, dejaFourni, technique));
```

Avec un dossier payant, le reçu validé au retrait tient lieu de preuve et la pièce n'est pas obligatoire (§B5 du 06/10).
Sans frais, elle « reste exigée comme avant ». Or, sans frais, il n'existe aucun reçu à produire.

## B1 — `RECU-DAO` absent des pièces attendues d'un dossier gratuit

Quand **aucun lot n'a de frais** (le cas où `fraisParLot` renvoie `null`), `attendues` **n'ajoute pas** la pièce `RECU-DAO`.
Cela vaut pour la version publique (`piecesAttendues`) et pour la version interne (`piecesAttenduesInternes`), qui partagent
`attendues`.

- Le cas payant ne change pas : la pièce reste servie, non obligatoire, avec `dejaFourni`.
- Si le contrôle de complétude de l'offre (scellement, puis lecture de la séance et conformité « PIECES ») s'appuie sur la même
  liste, il suit sans autre changement. S'il a sa propre liste, il faut l'aligner.
- Les offres déjà scellées gardent la pièce qu'elles ont jointe ; rien à reprendre.

**Variante acceptable, si le juriste préfère garder la ligne :** servir `RECU-DAO` avec `obligatoire: false` et un `format`
« Sans objet — dossier gratuit ». Le front affiche ce qui est servi.

## Ce que fait le front

Rien à coder : le formulaire d'offre lit la liste servie et n'exige que les pièces marquées obligatoires. À la livraison, le
front vérifie le formulaire d'un candidat sur une procédure gratuite (lecture seule, sans dépôt).

> ⚠️ **2026-11-03 — B1 livré (PRS20, sans migration), avec un écart choisi par l'utilisateur : « gratuit » = frais saisis à 0.**
> - **Règle livrée** : `RECU-DAO` n'est plus attendu quand le dossier est **déclaré gratuit**, c'est-à-dire quand chaque lot porte des
>   frais **saisis à 0** (`B04-DS-05`, `B04-DK-04`, la valeur du lot d'abord). Les versions publique (`GET …/pieces`) et interne
>   (séance, évaluation) sont alignées. Le serveur ne contrôle pas la complétude au scellement : l'offre est chiffrée.
> - **Écart avec la demande** : des frais **vides** gardent `RECU-DAO` **obligatoire**, comme avant. L'absence du champ ne prouve pas la
>   gratuité (règle du 06/10). Le pilote a confirmé le 04/10 que le reçu est une pièce obligatoire de l'offre. L'utilisateur a choisi de
>   ne pas renverser ces deux décisions.
> - **Maintirano (procédure 10)** : sa fiche n'a aucun montant de frais. Pour lever `RECU-DAO`, il faut **réviser la fiche** en
>   saisissant 0 en frais de dossier, puis la revalider.
> - **Question au pilote (Q1)** : un dossier gratuit se déclare-t-il bien par des frais à 0 ? Ou faut-il qu'un champ vide vaille gratuit,
>   au risque qu'un oubli de saisie dispense du reçu ?