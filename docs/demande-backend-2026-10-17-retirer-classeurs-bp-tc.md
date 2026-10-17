# Demande backend — 2026-10-17 — Ne plus produire les classeurs BP et TC à la validation de la fiche

## Contexte

À l'étape 7 de la fiche des consomptibles informatiques (ligne 303339, version 1 validée), la liste « Documents et dossier à
soumettre » montre quatre fichiers :
- **DAO** : le DAO complet ;
- **BP** : le bordereau des prix, en classeur Excel ;
- **TC** : le tableau de conformité des spécifications techniques, en classeur Excel ;
- **BE** : le bordereau des prix estimatifs.

Le pilote constate que **BP et TC font double emploi** avec le DAO complet. Depuis la charte du 16/10, celui-ci porte les mêmes
tableaux, générés du même besoin (`TableauxBesoin`) :
- le **cadre du bordereau des prix** (annexe 1 de l'acte d'engagement) ;
- le **tableau des spécifications techniques**, avec la colonne « propositions du candidat » (section 2.2) ;
- en travaux, le **bordereau des prix unitaires** et le **détail quantitatif et estimatif**.

Les classeurs n'apportent rien à la Commission. Ils ne servaient qu'aux candidats, comme tableur à remplir.

**Arbitrage du pilote (17/10)** : ne plus les produire. Le DAO complet et le bordereau estimatif (BE) suffisent.

## B1 — Ne plus générer BP ni TC

`DocumentsFicheMarcheService` produit les classeurs à la validation, dans la boucle sur `List.of("BP")` (travaux) ou
`List.of("BP", "TC")`. Demande : **plus aucun classeur** produit pour une nouvelle version, dans toutes les catégories.

- Les versions déjà validées gardent leurs fichiers, sans rattrapage : une version figée ne change pas.
- `GenerateurClasseursFiche` devient inutile. Le backend décide s'il le retire ou le garde inactif.
- Le **BE** (`BORDEREAU_ESTIMATIF`) et le **DQE estimatif** (`DQE_ESTIMATIF`) restent produits, et joints d'office au
  dossier sous `BORDEREAU_PRIX` / `DQE`. Ils ne sont pas concernés.

> ⚠️ **2026-10-17, livré côté backend (B1).**
> - **Plus aucun classeur produit** à la validation, dans toutes les catégories : la production est retirée de
>   `DocumentsFicheMarcheService`, et **`GenerateurClasseursFiche` est supprimé** (code mort).
> - **Ce qui ne change pas** :
>   - les versions déjà validées gardent leurs classeurs, et la liste les sert avec leur titre (`SelectionDocumentsFiche`, gardé) ;
>   - `BORDEREAU_ESTIMATIF` et `DQE_ESTIMATIF` restent produits ;
>   - pas de migration : la contrainte des types de document admet toujours `BP` et `TC`, pour les anciennes versions.
> - **Les tests** qui vérifiaient le contenu des classeurs (protection, formules, séries des travaux) sont retirés. Les mêmes
>   tableaux sont testés dans le DAO complet (`TableauxBesoinTest`).

## Questions

- **Q1** : BP ou TC servent-ils ailleurs qu'à la production ? Par exemple au retrait du DAO par les candidats, au cahier des
  charges, à la soumission en ligne (offre en formulaires, lot 5), à l'évaluation des offres, à la jointure des documents au
  dossier DMC (`FicheMarcheDossierService`, lot 2a) ou au journal. Le front n'a trouvé que la production elle-même.
- **Q2** : un dossier déjà créé depuis une version qui les porte les garde-t-il comme pièces ? Le front suppose que oui :
  on ne retire rien d'un dossier existant.

> ⚠️ **2026-10-17, réponses du backend.**
> - **Q1 : non, à une précision près.** BP et TC ne servaient qu'à leur production et à la liste `GET …/documents`.
>   - **La précision** : cette liste est aussi celle du **retrait du DAO par les candidats**. Sur une nouvelle version, un candidat
>     reçoit le DAO complet (`.docx` et `.pdf`), sans tableur à remplir. C'est l'effet voulu par l'arbitrage du pilote.
>   - **Aucun autre usage** :
>     - pas de pièce de dossier : la jointure (`FicheMarcheDossierService`) et le cahier des charges de l'attribution ne prennent
>       que les PDF ;
>     - ni la soumission en ligne, ni l'évaluation, ni le journal ne les lisent ; les formulaires en ligne partent du besoin.
> - **Q2 : la question ne se pose pas.** Un `.xlsx` n'a jamais été joint à un dossier : aucun dossier ne porte BP ni TC comme pièce.

## Ce que le front fera, dès la livraison

- Rien d'obligatoire : l'étape 7 liste ce que le serveur sert. Sur une nouvelle version, elle ne montrera plus que le DAO et le BE.
- Retrait de `BP` et `TC` du type `PieceProduite` et de l'ordre d'affichage (`ORDRE_PIECES`). Les libellés restent tant que
  d'anciennes versions les servent.
- Recette : une révision de la fiche 303339, validée en version 2, ne produit plus que le DAO complet et le BE.
