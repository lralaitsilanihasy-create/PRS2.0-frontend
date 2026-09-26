# Demande backend — défaire une fiche marché ouverte par erreur

*Front → backend, 25/09/2026.*

## Le constat

Une fiche marché **ne se défait pas**. Vérifié à l'instant sur la base de développement :

```
DELETE /api/dmcs/2           → 405 « Méthode DELETE non autorisée. Méthodes permises : GET. »
DELETE /api/fiches-marche/2  → 405 « Méthode DELETE non autorisée. Méthodes permises : GET. »
```

Aucun endpoint ne supprime non plus une version figée ni un document produit.

Or le dossier, lui, se défait : `DELETE /api/dossiers/{id}` supprime un **brouillon sans historique**. La symétrie
manque, et elle manque au mauvais endroit — la fiche est le premier geste, celui qu'on fait avant d'avoir tout
compris.

## Le besoin, en une phrase

**Une PRMP qui ouvre une fiche sur la mauvaise ligne du plan ne peut plus la défaire.** La ligne reste marquée
« déjà un DAO » définitivement : `GET /api/dmcs/eligibles` la sert avec `dejaDao = true`, l'écran n'offre plus que
« Reprendre la fiche », et le geste de préparation est perdu pour cette ligne. Sur notre base de démonstration, sept
lignes sur dix sont aujourd'hui dans cet état — dont trois par de simples essais.

Ce n'est pas un confort d'environnement de test : c'est une erreur de saisie ordinaire, qu'aucun geste ne rattrape.

## B1 — Supprimer une fiche **sans historique**

`DELETE /api/dmcs/{idDmc}` (ou `/api/fiches-marche/{idDmc}`, à votre convenance — l'écran appellera ce que vous
servirez).

**Conditions cumulatives**, toutes vérifiées par le serveur :

| condition | sinon |
|---|---|
| la fiche est en **brouillon** | 409 `FICHE_VALIDEE` |
| elle n'a **aucune version figée** | 409 `FICHE_AVEC_HISTORIQUE` |
| elle n'a **produit aucun document** | 409 `FICHE_AVEC_DOCUMENTS` |
| elle n'est **rattachée à aucun dossier** (`idDossierSoumis` nul) | 409 `FICHE_AVEC_DOSSIER`, portant l'`idDossier` dans le corps |
| le demandeur est la **PRMP propriétaire** (ou son UGPM, si vous l'admettez ailleurs) | 403 |

**Effets attendus** : la fiche, son DMC et ses valeurs disparaissent ; la ligne du plan redevient **préparable**
(`dejaDao = false` sur `GET /api/dmcs/eligibles`) ; 404 si la fiche n'existe pas.

Les codes 409 nous importent plus que le message : l'écran dira « cette fiche a déjà produit des documents, elle ne
se supprime plus » avec le mot juste, sans réimplémenter la règle.

> ⚠️ **Livré le 2026-09-26 (backend)** — **`DELETE /api/fiches-marche/{idDmc}`** → **204** (`DELETE /api/dmcs/{id}`
> reste 405). Les cinq conditions et leurs codes tels que demandés, avec ces précisions :
>
> - **Profils** : PRMP propriétaire **et son UGPM** (le périmètre du plan en décide, comme pour l'écriture de la fiche) ;
>   Administrateur et contrôleurs → 403. Mandat actif exigé (409 `VACANCE_PRMP`), comme toute écriture de la fiche.
> - **Ordre des refus** : 403 profil, 404 DMC inconnu, 403 hors périmètre, 409 `DMC_NON_DAO`, 409 `VACANCE_PRMP`, puis
>   `FICHE_VALIDEE` (dernière version validée) → `FICHE_AVEC_HISTORIQUE` (révision ouverte sur une version validée) →
>   `FICHE_AVEC_DOCUMENTS` → `FICHE_AVEC_DOSSIER` (avec `idDossier`). Comme un dossier ne reçoit qu'une fiche validée
>   et que seule une validation produit des documents, les deux derniers codes sont des défenses : en pratique, l'écran
>   rencontrera `FICHE_VALIDEE` et `FICHE_AVEC_HISTORIQUE`.
> - **Effets** : DMC, versions, valeurs **et besoin** (articles, caractéristiques) effacés ; la ligne redevient
>   préparable ; `GET /api/fiches-marche/{idDmc}` → 404. Une fiche **jamais enregistrée** (DMC seul, fiche virtuelle)
>   se supprime de même. La forme et la catégorie de la ligne n'y font rien : une fiche devenue non outillée se supprime
>   aussi.
> - **Journal du plan** : `FICHE_MARCHE_SUPPRIMEE`, « DAO de la ligne 303069 (DMC 5) supprimé, sans historique ».

## B2 — Et une fiche qui a de l'histoire ?

Nous ne demandons **pas** de la supprimer : une version figée et ses documents sont des enregistrements. Mais la
ligne du plan reste alors bloquée pour toujours, et c'est le cas qui nous embarrasse le plus sur la base de
démonstration.

Deux pistes, à trancher par vous — c'est une règle de gestion, pas une préférence d'écran :

1. **Abandonner** la fiche (un statut `ABANDONNEE`, conservé avec son historique) : la ligne redevient préparable,
   et la fiche abandonnée reste lisible dans l'historique de la ligne ;
2. **Ne rien faire** : une ligne dont la fiche est validée n'a pas à être re-préparée — la révision (`reviser`) est
   le geste prévu, et il suffit.

Si c'est la 2, dites-le : nous l'écrirons à l'écran au lieu de le laisser deviner. Si c'est la 1, elle appelle son
propre lot.

> ⚠️ **ARBITRÉ PAR LE PILOTE le 2026-09-26 : la PISTE 2.** Une fiche validée ne se supprime pas et ne s'abandonne
> pas ; la **révision** est le geste qui la corrige. L'écran l'écrit désormais à l'étape 6 d'une fiche figée
> (« Une fiche validée ne se supprime pas : c'est la révision qui la corrige. »), à côté d'« Ouvrir une nouvelle
> version » — la règle ne se déduit pas de l'absence d'un bouton. La piste 1 (abandon) n'est pas retenue : elle
> n'appelle donc aucun lot.
>
> ⚠️ **Réponse du backend (2026-09-26) : la piste 2, à confirmer par le pilote.** Une version validée est un acte — la
> même règle a été tenue pour les formulaires du candidat (« une version validée n'est jamais convertie ») — et la
> **révision** est le geste prévu pour la corriger. Une ligne dont la fiche est validée n'a pas à être re-préparée :
> l'écran peut l'écrire tel quel (« cette fiche est validée : ouvrez une révision pour la corriger »). Si le pilote
> préfère l'abandon (piste 1), c'est un lot à part : un statut `ABANDONNEE`, la fiche conservée et lisible, la ligne
> rouverte — et la question de ce que devient un dossier déjà rattaché.

## Ce que le front fera

Sur une fiche en brouillon **sans version figée**, un geste « Supprimer cette fiche » dans l'étape 6, avec
confirmation nommée (« la fiche de la ligne 303069 sera supprimée ; la ligne redeviendra préparable »). Le geste
n'apparaîtra pas dès qu'une des conditions du §B1 tombe — et l'écran affichera la raison servie par le 409 si le
serveur refuse quand même.

Rien ne sera codé tant que l'endpoint n'est pas servi.

## En attendant, pour la base de démonstration

Nous demandons par ailleurs un **script SQL de remise à zéro** des fiches d'essai (DMC 2 à 7, leurs fiches,
versions et documents ; la fiche 1 — équipements de protection individuelle — est la démonstration en cours et
reste). C'est ponctuel, et sans rapport avec le besoin ci-dessus, qui lui est permanent.
